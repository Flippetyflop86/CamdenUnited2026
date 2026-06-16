import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { url, clubName } = body;

        if (!url || !clubName) {
            return NextResponse.json({ success: false, error: 'Missing url or clubName' }, { status: 400 });
        }

        // Fetch the league fixtures page
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });

        if (!response.ok) {
            return NextResponse.json({ success: false, error: 'Failed to access the league website.' }, { status: 400 });
        }

        const html = await response.text();
        const $ = cheerio.load(html);

        // 1. Auto-detect the exact team name used by FA Full-Time
        // (Sometimes "Camden United" is listed as "Camden United FC" or "Broadfields United" on the site)
        const teamCounts: Record<string, number> = {};
        $('table tr, tbody tr').each((i, row) => {
            const cells = $(row).find('td');
            if (cells.length >= 3) {
                const cellTexts = cells.map((i, cell) => $(cell).text().trim().replace(/\s+/g, ' ')).get();
                const potentialTeams = cellTexts.filter(t => t.length > 3 && !t.match(/^[0-9:\/ -]+$/) && !['vs', 'v', 'postponed', 'cancelled', 'p-p', 'tbc'].includes(t.toLowerCase()));
                potentialTeams.forEach(t => {
                    teamCounts[t] = (teamCounts[t] || 0) + 1;
                });
            }
        });

        let autoDetectedClubName = clubName;
        let maxCount = 0;
        for (const [team, count] of Object.entries(teamCounts)) {
            if (count > maxCount) {
                maxCount = count;
                autoDetectedClubName = team;
            }
        }

        const matches: any[] = [];
        
        // 2. Strategy: Scan all tables. Look for rows that contain our club's name (or the auto-detected name).
        $('table tr, tbody tr').each((i, row) => {
            const rowText = $(row).text().replace(/\s+/g, ' ').trim();
            if (rowText.toLowerCase().includes(clubName.toLowerCase()) || rowText.toLowerCase().includes(autoDetectedClubName.toLowerCase())) {
                const cells = $(row).find('td');
                if (cells.length >= 3) {
                    const cellTexts = cells.map((i, cell) => $(cell).text().trim().replace(/\s+/g, ' ')).get();
                    
                    // Simple heuristic: Find which cell matches our club name exactly or partially
                    let homeIndex = -1;
                    let awayIndex = -1;
                    
                    cellTexts.forEach((text, index) => {
                        if (text.toLowerCase().includes(clubName.toLowerCase())) {
                            if (homeIndex === -1 && awayIndex === -1) {
                                // Just looping
                            }
                        }
                    });

                    // A more robust heuristic for standard UK grassroots sites (FA Full-Time, Mitoo):
                    // [0] Date/Time, [1] Home, [2] Result/VS, [3] Away, [4] Competition/Venue
                    // Sometimes [0] Date, [1] Time, [2] Home...
                    // Let's assume standard 5+ column format where team names are usually longest strings
                    
                    // Filter out short strings or common non-team words
                    // Filter out short strings, common non-team words, and purely numeric stats
                    const potentialTeams = cellTexts.filter(t => t.length > 3 && !t.match(/^[0-9:\/ -]+$/) && !['vs', 'v', 'postponed', 'cancelled', 'p-p', 'tbc', 'home', 'away', 'overall'].includes(t.toLowerCase()));
                    
                    // If a row has too many pure numbers, it's a stats/league table (e.g. apps, goals, W, D, L, PTS)
                    const pureNumberCells = cellTexts.filter(t => t.match(/^\d+$/));
                    if (pureNumberCells.length > 3) return; // Skip stats row
                    
                    if (potentialTeams.length < 2) return; // A match must have at least 2 teams

                    const isHome = potentialTeams[0]?.toLowerCase().includes(clubName.toLowerCase()) || potentialTeams[0]?.toLowerCase().includes(autoDetectedClubName.toLowerCase());
                    const isAway = potentialTeams.length > 1 && (potentialTeams[1]?.toLowerCase().includes(clubName.toLowerCase()) || potentialTeams[1]?.toLowerCase().includes(autoDetectedClubName.toLowerCase()));
                    
                    let opponent = "Unknown";
                    if (isHome && potentialTeams.length > 1) opponent = potentialTeams[1];
                    else if (isAway) opponent = potentialTeams[0];
                    else return; // If we aren't home or away, it's not our match

                    // Try to find a strict date: DD/MM/YY or 14 May 26
                    let dateStr = cellTexts.find(t => t.match(/\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/) || t.match(/\d{1,2}(st|nd|rd|th)? (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{2,4}/i));
                    
                    if (!dateStr) return; // Skip this row

                    // Clean date - FA Fulltime often uses "DD/MM/YY"
                    let formattedDate = "";
                    if (dateStr.includes('/')) {
                        const parts = dateStr.split('/');
                        if (parts.length >= 3) {
                            const year = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
                            formattedDate = `${year}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
                        }
                    } else {
                        // Strip 'st', 'nd', 'rd', 'th' if present before parsing
                        const cleanStr = dateStr.replace(/(\d+)(st|nd|rd|th)/, '$1');
                        const parsedDate = new Date(cleanStr);
                        if (!isNaN(parsedDate.getTime())) {
                            formattedDate = parsedDate.toISOString().split('T')[0];
                        }
                    }

                    if (!formattedDate) return; // Invalid date parsed
                    
                    // Try to find time
                    const timeStr = cellTexts.find(t => t.match(/^\d{1,2}:\d{2}$/)) || "14:00"; // default grassroot time

                    // Try to find result (e.g. 2 - 1, 2-1)
                    const resultStr = cellTexts.find(t => t.match(/^\d+\s*-\s*\d+$/));
                    let result = "Pending";
                    let scoreline = "";
                    if (resultStr) {
                        scoreline = resultStr;
                        const [h, a] = resultStr.split('-').map(s => parseInt(s.trim()));
                        if (isHome) {
                            if (h > a) result = "Win";
                            else if (h < a) result = "Loss";
                            else result = "Draw";
                        } else {
                            if (a > h) result = "Win";
                            else if (a < h) result = "Loss";
                            else result = "Draw";
                        }
                    } else if (cellTexts.join(' ').toLowerCase().includes('postponed') || cellTexts.join(' ').toLowerCase().includes('p-p')) {
                        result = "Pending";
                        scoreline = "Postponed";
                    }

                    if (opponent && opponent !== "Unknown" && opponent !== clubName && opponent !== autoDetectedClubName) {
                        matches.push({
                            date: formattedDate,
                            time: timeStr,
                            opponent,
                            is_home: isHome || false,
                            result,
                            scoreline: scoreline || null,
                            competition: "League",
                            notes: "Imported via Scraper"
                        });
                    }
                }
            }
        });

        // Remove exact duplicates (sometimes tables render twice for mobile/desktop)
        const uniqueMatches = Array.from(new Set(matches.map(m => JSON.stringify(m)))).map(s => JSON.parse(s));

        return NextResponse.json({ success: true, matches: uniqueMatches });

    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
