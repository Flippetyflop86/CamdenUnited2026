import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import { checkRateLimit, getClientIdentifier } from '@/lib/rate-limit';
import { getDefaultKickoffTime } from '@/lib/whatsapp-utils';

function parseDateToken(raw: string): string | null {
    // 1. Long date e.g. "Saturday, 31 October 2026"
    const longMatch = raw.match(/\b(?:(?:mon|tue|wed|thu|fri|sat|sun)[a-z]*,?\s+)?(\d{1,2})(?:st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{4}|\d{2})\b/i);
    if (longMatch) {
        const day = longMatch[1].padStart(2, '0');
        const monthMap: Record<string, string> = {
            jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
            jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
        };
        const month = monthMap[longMatch[2].toLowerCase().slice(0, 3)] || '01';
        const year = longMatch[3].length === 2 ? `20${longMatch[3]}` : longMatch[3];
        return `${year}-${month}-${day}`;
    }

    // 2. Short date DD/MM/YYYY or DD/MM/YY
    const shortMatch = raw.match(/\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})\b/);
    if (shortMatch) {
        const day = shortMatch[1].padStart(2, '0');
        const month = shortMatch[2].padStart(2, '0');
        const year = shortMatch[3].length === 2 ? `20${shortMatch[3]}` : shortMatch[3];
        return `${year}-${month}-${day}`;
    }

    return null;
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        let { url, clubName, clubId } = body;

        const clientId = getClientIdentifier(request, clubId || clubName);
        const rateLimit = checkRateLimit('sync-fixtures', clientId, 10);
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

        // For Mitoo URLs, upgrade TeamHist.cfm -> TeamHistAll.cfm (which includes both League and Cup fixtures) and MDX2025 -> MDX2026
        if (/mitoofootball\.com/i.test(fetchUrl)) {
            fetchUrl = fetchUrl.replace(/LeagueCode=MDX2025/i, 'LeagueCode=MDX2026');
            if (/TeamHist\.cfm/i.test(fetchUrl)) {
                fetchUrl = fetchUrl.replace(/TeamHist\.cfm/i, 'TeamHistAll.cfm');
            } else if (/LeagueTab\.cfm/i.test(fetchUrl)) {
                // First fetch LeagueTab to find our club's CI parameter if not in URL
                const tabRes = await fetch(fetchUrl, {
                    headers: { 'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' },
                    cache: 'no-store'
                });
                if (tabRes.ok) {
                    const tabHtml = await tabRes.text();
                    const $tab = cheerio.load(tabHtml);
                    let teamHref = '';
                    $tab('a').each((_, a) => {
                        const txt = $tab(a).text().trim();
                        const href = $tab(a).attr('href') || '';
                        if (txt.toLowerCase() === clubName.toLowerCase().trim() && /TeamHist/i.test(href)) {
                            teamHref = href;
                        }
                    });
                    if (teamHref) {
                        const base = new URL(fetchUrl);
                        fetchUrl = `${base.origin}/${teamHref.replace(/^\//, '').replace(/TeamHist\.cfm/i, 'TeamHistAll.cfm')}`;
                    }
                }
            }
        }

        const response = await fetch(fetchUrl, {
            headers: {
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-GB,en;q=0.9',
            },
            cache: 'no-store'
        });

        if (!response.ok) {
            return NextResponse.json({
                success: false,
                error: `Failed to access the league website (HTTP ${response.status}).`
            }, { status: 400 });
        }

        const html = await response.text();
        if (/<title>\s*(Just a moment|Attention Required)/i.test(html)) {
            return NextResponse.json({
                success: false,
                error: `The league website requires a browser CAPTCHA challenge.`
            }, { status: 403 });
        }

        const $ = cheerio.load(html);
        const matches: any[] = [];
        const clubLower = clubName.toLowerCase().trim();
        const clubCore = clubLower.replace(/\bfc\b/g, '').trim();

        const isOurClub = (name: string): boolean => {
            const n = name.toLowerCase().trim();
            if (!n) return false;
            if (n === clubLower || (clubCore.length >= 4 && n === clubCore)) return true;
            // Avoid matching "Camden & Islington United" for "Camden United"
            return n.includes(clubLower);
        };

        $('table tr').each((_, row) => {
            const rawCells = $(row).find('td').map((__, td) => $(td).text().trim().replace(/\s+/g, ' ')).get();
            if (rawCells.length < 5 || rawCells.length > 10) return;

            // Skip void matches
            if (rawCells.some(c => /\[\s*void\s*\]|^v$/i.test(c))) return;

            // Check if any cell has a valid date
            let dateIso: string | null = null;
            for (const c of rawCells) {
                const parsed = parseDateToken(c);
                if (parsed) {
                    dateIso = parsed;
                    break;
                }
            }
            if (!dateIso) return;

            // Mitoo TeamHistAll 7-column format:
            // [0] Result ('W'|'D'|'L'|''), [1] Competition ('Premier Division' | 'Middlesex County FA Premier Cup Quarter Final'), [2] HomeTeam, [3] HomeScore, [4] AwayScore, [5] AwayTeam, [6] Date
            // Mitoo TeamHist 6-column format:
            // [0] Result, [1] HomeTeam, [2] HomeScore, [3] AwayScore, [4] AwayTeam, [5] Date
            let compCell = '';
            let homeTeam = '';
            let homeScore = '';
            let awayScore = '';
            let awayTeam = '';

            if (rawCells.length >= 7 && parseDateToken(rawCells[6])) {
                compCell = rawCells[1];
                homeTeam = rawCells[2];
                homeScore = rawCells[3];
                awayScore = rawCells[4];
                awayTeam = rawCells[5];
            } else if (rawCells.length >= 6 && parseDateToken(rawCells[5])) {
                homeTeam = rawCells[1];
                homeScore = rawCells[2];
                awayScore = rawCells[3];
                awayTeam = rawCells[4];
            } else {
                // Fallback generic row
                const clubIdx = rawCells.findIndex(c => isOurClub(c));
                if (clubIdx === -1) return;
                compCell = rawCells.join(' ');
                homeTeam = rawCells[clubIdx];
                const otherTeam = rawCells.find((c, idx) => idx !== clubIdx && c.length > 2 && !parseDateToken(c) && !/^\d+$/.test(c) && !/^(w|d|l|vs?)$/i.test(c) && !/\b(division|cup|trophy|shield)\b/i.test(c));
                if (!otherTeam) return;
                const otherIdx = rawCells.indexOf(otherTeam);
                if (clubIdx < otherIdx) {
                    homeTeam = rawCells[clubIdx];
                    awayTeam = otherTeam;
                } else {
                    homeTeam = otherTeam;
                    awayTeam = rawCells[clubIdx];
                }
            }

            const weAreHome = isOurClub(homeTeam);
            const weAreAway = isOurClub(awayTeam);
            if (!weAreHome && !weAreAway) return;

            const opponent = (weAreHome ? awayTeam : homeTeam).replace(/\[\s*void\s*\]/gi, '').trim();
            if (!opponent || isOurClub(opponent)) return;

            const competition = /\b(cup|trophy|shield|plate|vase|quarter[\s\-]*finals?|semi[\s\-]*finals?|round\s+\d+)\b/i.test(compCell)
                ? "Cup"
                : (/\b(friendly|pre-season)\b/i.test(compCell) ? "Friendly" : "League");

            let scoreline: string | null = null;
            let result = "Pending";
            if (/^\d+$/.test(homeScore) && /^\d+$/.test(awayScore)) {
                const h = parseInt(homeScore, 10);
                const a = parseInt(awayScore, 10);
                scoreline = `${h} - ${a}`;
                if (weAreHome) {
                    result = h > a ? "Win" : (h < a ? "Loss" : "Draw");
                } else {
                    result = a > h ? "Win" : (a < h ? "Loss" : "Draw");
                }
            }

            matches.push({
                date: dateIso,
                time: getDefaultKickoffTime(dateIso),
                opponent,
                is_home: weAreHome,
                result,
                scoreline,
                competition,
                notes: `[Location: ${weAreHome ? "Home" : "Away"}][Surface: 4G]`
            });
        });

        const uniqueMatches = Array.from(new Set(matches.map(m => JSON.stringify(m)))).map(s => JSON.parse(s));

        return NextResponse.json({
            success: true,
            matches: uniqueMatches,
            fixtures: uniqueMatches
        });

    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
