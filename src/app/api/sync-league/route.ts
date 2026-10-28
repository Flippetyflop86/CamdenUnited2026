import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import { checkRateLimit, getClientIdentifier } from '@/lib/rate-limit';

function isOurClubMatch(candidate: string, clubName: string): boolean {
    const c = candidate.toLowerCase().trim();
    const target = clubName.toLowerCase().trim();
    const core = target.replace(/\bfc\b/g, '').trim();
    if (!c || !target) return false;
    // Avoid matching "Camden & Islington United" when looking for "Camden United"
    if (c === target) return true;
    if (core.length >= 4 && c === core) return true;
    return c.includes(target);
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        let { url, clubName, clubId } = body;

        const clientId = getClientIdentifier(request, clubId || clubName);
        const rateLimit = checkRateLimit('sync-league', clientId, 10);
        if (!rateLimit.allowed) {
            return NextResponse.json({
                success: false,
                errorType: 'RATE_LIMITED',
                error: rateLimit.errorMessage
            }, { status: 429 });
        }

        if (!url || !clubName) {
            return NextResponse.json({ success: false, error: 'Missing url or clubName' }, { status: 400 });
        }

        url = String(url).trim();

        // If user provided a Mitoo TeamHist / TeamHistAll URL, automatically convert to LeagueTab.cfm for standings
        let fetchUrl = url;
        if (/mitoofootball\.com/i.test(fetchUrl)) {
            fetchUrl = fetchUrl.replace(/TeamHist(?:All)?\.cfm/i, 'LeagueTab.cfm');
            // Upgrade MDX2025 to MDX2026 so current 2026/27 season standings load automatically
            fetchUrl = fetchUrl.replace(/LeagueCode=MDX2025/i, 'LeagueCode=MDX2026');
        }

        // Fetch without spoofed Sec-Ch-Ua headers (which trigger Cloudflare TLS/header mismatch blocks)
        let response = await fetch(fetchUrl, {
            headers: {
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-GB,en;q=0.9',
            },
            cache: 'no-store'
        });

        if (!response.ok) {
            if (response.status === 403 || response.status === 520 || response.status === 503) {
                return NextResponse.json({
                    success: false,
                    errorType: 'BLOCKED',
                    error: 'The league website is actively blocking automated access (Cloudflare).'
                }, { status: 403 });
            }
            return NextResponse.json({ success: false, error: 'Failed to access the league website.' }, { status: 400 });
        }

        const html = await response.text();
        if (/<title>\s*(Just a moment|Attention Required)/i.test(html)) {
            return NextResponse.json({
                success: false,
                errorType: 'BLOCKED',
                error: 'The league website requires a browser CAPTCHA challenge.'
            }, { status: 403 });
        }

        const $ = cheerio.load(html);
        const teams: any[] = [];
        let position: number | null = null;
        let foundName = "";

        // Parse full league standings rows (supports Mitoo 9-col [Team, P, W, D, L, F, A, GD, Pts] and standard 10-col [Pos, Team, P, W, D, L, F, A, GD, Pts])
        $('table tr').each((_, row) => {
            const cells = $(row)
                .find('td')
                .map((__, td) => $(td).text().trim().replace(/\s+/g, ' '))
                .get()
                .filter(c => c !== '');

            if (cells.length < 6 || cells.length > 16) return;

            // Check if trailing cells are numeric stats
            const numericTail: number[] = [];
            let idx = cells.length - 1;
            while (idx >= 0) {
                const clean = cells[idx].replace(/^\+/, '');
                if (/^-?\d+$/.test(clean)) {
                    numericTail.unshift(parseInt(clean, 10));
                    idx--;
                } else {
                    break;
                }
            }

            // A valid standings row has at least 6 trailing numbers (P, W, D, L, [F, A], GD, Pts) and 1-2 leading cells ([Pos], Team)
            if (numericTail.length < 6) return;
            const headCells = cells.slice(0, idx + 1);
            if (headCells.length === 0 || headCells.length > 3) return;

            let rowPos = teams.length + 1;
            let teamName = headCells[headCells.length - 1];
            if (headCells.length >= 2 && /^\d+\.?$/.test(headCells[0])) {
                rowPos = parseInt(headCells[0], 10);
            }

            // Skip header or summary rows
            if (!teamName || /^(team|club|pos|position|played|overall|total|home|away|notes?)$/i.test(teamName)) return;
            if (/saturday|sunday|monday|tuesday|wednesday|thursday|friday|points|awarded|void/i.test(teamName)) return;

            let played = 0, won = 0, drawn = 0, lost = 0, goals_for = 0, goals_against = 0, goal_difference = 0, points = 0;

            if (numericTail.length >= 13) {
                const slice = numericTail.slice(-13);
                played = slice[0];
                won = slice[1] + slice[6];
                drawn = slice[2] + slice[7];
                lost = slice[3] + slice[8];
                goals_for = slice[4] + slice[9];
                goals_against = slice[5] + slice[10];
                goal_difference = slice[11];
                points = slice[12];
            } else if (numericTail.length >= 8) {
                const slice = numericTail.slice(0, 8);
                played = slice[0];
                won = slice[1];
                drawn = slice[2];
                lost = slice[3];
                goals_for = slice[4];
                goals_against = slice[5];
                goal_difference = slice[6];
                points = slice[7];
            } else if (numericTail.length === 7) {
                played = numericTail[0];
                won = numericTail[1];
                drawn = numericTail[2];
                lost = numericTail[3];
                goals_for = numericTail[4];
                goals_against = numericTail[5];
                goal_difference = goals_for - goals_against;
                points = numericTail[6];
            } else if (numericTail.length === 6) {
                played = numericTail[0];
                won = numericTail[1];
                drawn = numericTail[2];
                lost = numericTail[3];
                goal_difference = numericTail[4];
                points = numericTail[5];
            }

            // Basic sanity check: played should roughly equal won + drawn + lost (within 2 for awarded/void games)
            if (played < 0 || played > 60 || Math.abs(played - (won + drawn + lost)) > 3) return;

            // Avoid duplicate team entries if multiple tables exist on page
            if (teams.some(t => t.team_name.toLowerCase() === teamName.toLowerCase())) return;

            const isOurClub = isOurClubMatch(teamName, clubName);
            const finalPos = teams.length + 1;

            if (isOurClub && position === null) {
                position = finalPos;
                foundName = teamName;
            }

            teams.push({
                position: finalPos,
                team_name: teamName,
                played,
                won,
                drawn,
                lost,
                goals_for,
                goals_against,
                goal_difference,
                points,
                is_our_club: isOurClub
            });
        });

        let leagueName = $('title').text().trim() || $('.league-title').text().trim() || "Premier Division";
        if (leagueName.toLowerCase().includes("football.mitoo")) {
            leagueName = "Middlesex County Football League - Premier Division";
        }

        if (teams.length > 0) {
            return NextResponse.json({
                success: true,
                position: position ?? (teams.find(t => t.is_our_club)?.position || null),
                foundName,
                leagueName,
                resolvedUrl: fetchUrl,
                teams
            });
        }

        return NextResponse.json({
            success: false,
            error: `Could not find a standings table on that page.`
        }, { status: 404 });

    } catch (error: any) {
        console.error('League Scraper Error:', error);
        if (
            error.message === 'fetch failed' ||
            error.code === 'ECONNRESET' ||
            (error.message || '').includes('socket hang up')
        ) {
            return NextResponse.json({
                success: false,
                errorType: 'BLOCKED',
                error: 'The league website is actively blocking automated access (Cloudflare).'
            }, { status: 403 });
        }

        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
