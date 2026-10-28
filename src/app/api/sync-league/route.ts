import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import { checkRateLimit, getClientIdentifier } from '@/lib/rate-limit';

function isOurClubMatch(candidate: string, clubName: string): boolean {
    const c = candidate.toLowerCase().trim();
    const target = clubName.toLowerCase().trim();
    const core = target.replace(/\bfc\b/g, '').trim();
    if (!c || !target) return false;
    if (c === target) return true;
    if (core.length >= 4 && c === core) return true;
    return c.includes(target);
}

function parseMarkdownStandings(markdown: string, clubName: string) {
    const lines = markdown.split(/\r?\n/);
    const teams: any[] = [];
    let position: number | null = null;
    let foundName = "";

    for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line.startsWith('|') || !line.endsWith('|')) continue;

        const rawCells = line
            .slice(1, -1)
            .split('|')
            .map(c => c.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/!\[[^\]]*\]\([^)]+\)/g, '').trim())
            .filter(c => c !== '');

        if (rawCells.length < 6) continue;
        if (rawCells.every(c => /^[\-:]+$/.test(c))) continue;

        const numericTail: number[] = [];
        let idx = rawCells.length - 1;
        while (idx >= 0) {
            const clean = rawCells[idx].replace(/^\+/, '').trim();
            if (/^-?\d+$/.test(clean)) {
                numericTail.unshift(parseInt(clean, 10));
                idx--;
            } else {
                break;
            }
        }

        if (numericTail.length < 6) continue;
        const headCells = rawCells.slice(0, idx + 1);
        if (headCells.length === 0 || headCells.length > 3) continue;

        const teamName = headCells[headCells.length - 1].trim();
        if (!teamName || /^(team|club|pos|position|played|overall|total|home|away)$/i.test(teamName)) continue;

        let played = 0, won = 0, drawn = 0, lost = 0, goals_for = 0, goals_against = 0, goal_difference = 0, points = 0;

        if (numericTail.length >= 8) {
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

        if (played < 0 || played > 60 || Math.abs(played - (won + drawn + lost)) > 3) continue;
        if (teams.some(t => t.team_name.toLowerCase() === teamName.toLowerCase())) continue;

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
            form: [] as ('W' | 'D' | 'L')[],
            is_our_club: isOurClub
        });
    }

    // Also extract any recent results embedded in the FA Full-Time markdown
    if (teams.length > 0) {
        const teamNames = teams.map(t => t.team_name);
        const formMap: Record<string, ('W' | 'D' | 'L')[]> = {};
        teamNames.forEach(n => { formMap[n] = []; });

        const resultRegex = /\[([^\]]+)\]\([^)]*displayFixture[^)]*\).*?\[(\d+)\s*-\s*(\d+)\]\([^)]*displayFixture[^)]*\).*?\[([^\]]+)\]\([^)]*displayFixture[^)]*\)/g;
        let match: RegExpExecArray | null;
        while ((match = resultRegex.exec(markdown)) !== null) {
            const homeRaw = match[1].trim();
            const hs = parseInt(match[2], 10);
            const as = parseInt(match[3], 10);
            const awayRaw = match[4].trim();

            const homeTeam = teamNames.find(t => t.toLowerCase() === homeRaw.toLowerCase());
            const awayTeam = teamNames.find(t => t.toLowerCase() === awayRaw.toLowerCase());
            if (homeTeam && awayTeam && !isNaN(hs) && !isNaN(as)) {
                formMap[homeTeam].push(hs > as ? 'W' : hs === as ? 'D' : 'L');
                formMap[awayTeam].push(as > hs ? 'W' : as === hs ? 'D' : 'L');
            }
        }

        teams.forEach(t => {
            if (formMap[t.team_name]?.length > 0) {
                t.form = formMap[t.team_name].slice(-5);
            }
        });
    }

    const titleMatch = markdown.match(/^Title:\s*(.+)$/m);
    const leagueName = titleMatch ? titleMatch[1].trim() : "League Standings";

    return { teams, position, foundName, leagueName };
}

// Fetch recent monthly results on Mitoo to build each team's Last 5 Form (W/D/L)
async function enrichMitooForm(fetchUrl: string, teams: any[]) {
    try {
        const urlObj = new URL(fetchUrl);
        const divisionId = urlObj.searchParams.get('DivisionID');
        const leagueCode = urlObj.searchParams.get('LeagueCode');
        const tblName = urlObj.searchParams.get('TblName') || 'Matches';
        if (!divisionId || !leagueCode || teams.length === 0) return;

        const teamNames: string[] = teams.map(t => t.team_name);
        const sortedByLength = [...teamNames].sort((a, b) => b.length - a.length);
        const formMap: Record<string, ('W' | 'D' | 'L')[]> = {};
        teamNames.forEach(t => { formMap[t] = []; });

        // Season months from August (8) up to current month (plus wrap-around for Jan-May)
        const nowMonth = new Date().getMonth() + 1;
        const seasonOrder = [8, 9, 10, 11, 12, 1, 2, 3, 4, 5];
        const idx = seasonOrder.indexOf(nowMonth);
        const monthsToFetch = idx >= 0
            ? seasonOrder.slice(Math.max(0, idx - 2), idx + 1)
            : [8, 9, 10];

        const pages = await Promise.all(
            monthsToFetch.map(async (m) => {
                const mUrl = `https://mitoofootball.com/FixtResMonth.cfm?TblName=${encodeURIComponent(tblName)}&DivisionID=${encodeURIComponent(divisionId)}&LeagueCode=${encodeURIComponent(leagueCode)}&MonthNo=${m}`;
                const res = await fetch(mUrl, {
                    headers: { 'Accept': 'text/html' },
                    cache: 'no-store'
                });
                return res.ok ? res.text() : '';
            })
        );

        for (const pageHtml of pages) {
            if (!pageHtml) continue;
            const $ = cheerio.load(pageHtml);
            $('tr').each((_, tr) => {
                const tds = $(tr).find('> td');
                if (tds.length >= 3 && tds.length <= 6) {
                    const c0 = $(tds[0]).text().trim();
                    const c1 = $(tds[1]).text().trim();
                    const c2 = $(tds[2]).text().trim().replace(/\s+/g, ' ');
                    if (/^\d+$/.test(c0) && /^\d+$/.test(c1) && c2.includes(' v ')) {
                        const hs = Number(c0);
                        const as = Number(c1);
                        const [left, right] = c2.split(' v ');
                        if (!left || !right) return;
                        const homeTeam = teamNames.find(t => left.trim().toLowerCase() === t.toLowerCase());
                        const awayTeam = sortedByLength.find(t => right.trim().toLowerCase().startsWith(t.toLowerCase()));
                        if (homeTeam && awayTeam) {
                            formMap[homeTeam].push(hs > as ? 'W' : hs === as ? 'D' : 'L');
                            formMap[awayTeam].push(as > hs ? 'W' : as === hs ? 'D' : 'L');
                        }
                    }
                }
            });
        }

        teams.forEach(t => {
            if (formMap[t.team_name] && formMap[t.team_name].length > 0) {
                t.form = formMap[t.team_name].slice(-5);
            }
        });
    } catch (e) {
        // Non-fatal if monthly results cannot be fetched
    }
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

        let fetchUrl = url;
        const isFaFullTime = /fulltime\.thefa\.com/i.test(fetchUrl);
        const isMitoo = /mitoofootball\.com/i.test(fetchUrl);

        if (isMitoo) {
            fetchUrl = fetchUrl.replace(/TeamHist(?:All)?\.cfm/i, 'LeagueTab.cfm');
            fetchUrl = fetchUrl.replace(/LeagueCode=MDX2025/i, 'LeagueCode=MDX2026');
        } else if (isFaFullTime) {
            fetchUrl = fetchUrl.replace(/\/(table|results|fixtures|displayTeam)\.html/i, '/index.html');
        }

        let html = "";
        let usedJina = false;

        if (!isFaFullTime) {
            const response = await fetch(fetchUrl, {
                headers: {
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'en-GB,en;q=0.9',
                },
                cache: 'no-store'
            });

            if (response.ok) {
                html = await response.text();
            }
        }

        if (!html || /<title>\s*(Just a moment|Attention Required)/i.test(html)) {
            const jinaUrl = `https://r.jina.ai/${fetchUrl}`;
            const jinaRes = await fetch(jinaUrl, { cache: 'no-store' });
            if (jinaRes.ok) {
                const jinaText = await jinaRes.text();
                usedJina = true;
                const mdParsed = parseMarkdownStandings(jinaText, clubName);
                if (mdParsed.teams.length > 0) {
                    return NextResponse.json({
                        success: true,
                        position: mdParsed.position ?? (mdParsed.teams.find(t => t.is_our_club)?.position || null),
                        foundName: mdParsed.foundName,
                        leagueName: mdParsed.leagueName,
                        resolvedUrl: fetchUrl,
                        teams: mdParsed.teams
                    });
                }
            }

            if (!usedJina || /Just a moment|Attention Required|Target URL returned error 403/i.test(html)) {
                return NextResponse.json({
                    success: false,
                    errorType: 'BLOCKED',
                    error: 'Could not automatically read this URL. Paste the table rows directly into the box below.'
                }, { status: 403 });
            }
        }

        const $ = cheerio.load(html);
        const teams: any[] = [];
        let position: number | null = null;
        let foundName = "";

        $('table tr').each((_, row) => {
            const cells = $(row)
                .find('td')
                .map((__, td) => $(td).text().trim().replace(/\s+/g, ' '))
                .get()
                .filter(c => c !== '');

            if (cells.length < 6 || cells.length > 16) return;

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

            if (numericTail.length < 6) return;
            const headCells = cells.slice(0, idx + 1);
            if (headCells.length === 0 || headCells.length > 3) return;

            let teamName = headCells[headCells.length - 1];
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

            if (played < 0 || played > 60 || Math.abs(played - (won + drawn + lost)) > 3) return;
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
                form: [] as ('W' | 'D' | 'L')[],
                is_our_club: isOurClub
            });
        });

        let leagueName = $('title').text().trim() || $('.league-title').text().trim() || "Premier Division";
        if (leagueName.toLowerCase().includes("football.mitoo")) {
            leagueName = "Middlesex County Football League - Premier Division";
        }

        if (teams.length > 0) {
            if (isMitoo) {
                await enrichMitooForm(fetchUrl, teams);
            }
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
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
