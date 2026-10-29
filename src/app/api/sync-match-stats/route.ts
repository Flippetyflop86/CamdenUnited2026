import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import { supabase } from '@/lib/supabase';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { url, matchId, clubName } = body;

        if (!url || !matchId || !clubName) {
            return NextResponse.json({ success: false, error: 'Missing url, matchId, or clubName' }, { status: 400 });
        }

        // Fetch the match details page
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

        // Fetch all players for the club from Supabase to match against
        const { data: players } = await supabase.from('players').select('id, first_name, last_name');
        if (!players) {
            return NextResponse.json({ success: false, error: 'Could not fetch players from database.' }, { status: 500 });
        }

        const foundStats: Record<string, { goals: number, assists: number, yellow_cards: number, red_cards: number, minutes_played: number, participation_type: 'STARTER' | 'SUB' | 'UNUSED_SUB' }> = {};

        // Helper to find a player ID by name (supports "FirstName LastName", "F LastName", "LastName F", and unique surname)
        const matchPlayer = (text: string) => {
            const cleanText = text.toLowerCase().replace(/[^a-z -]/g, ' ').replace(/\s+/g, ' ').trim();
            const padded = ` ${cleanText} `;
            for (const p of players) {
                const first = (p.first_name || '').toLowerCase().trim();
                const last = (p.last_name || '').toLowerCase().trim();
                if (!first || !last) continue;
                const fInit = first[0];
                const baseSurname = last.split(/\s+/).pop()!;

                const patterns = [
                    ` ${first} ${last} `,
                    ` ${fInit} ${last} `,
                    ` ${last} ${fInit} `,
                    ` ${fInit} ${baseSurname} `,
                    ` ${baseSurname} ${fInit} `,
                ];
                if (patterns.some(pat => padded.includes(pat))) {
                    return p.id;
                }
            }
            for (const p of players) {
                const last = (p.last_name || '').toLowerCase().trim();
                if (!last) continue;
                const baseSurname = last.split(/\s+/).pop()!;
                if (padded.includes(` ${last} `) || padded.includes(` ${baseSurname} `)) {
                    const sameSurnameCount = players.filter(other => {
                        const oLast = (other.last_name || '').toLowerCase().trim();
                        return oLast === last || oLast.split(/\s+/).pop() === baseSurname;
                    }).length;
                    if (sameSurnameCount === 1) {
                        return p.id;
                    }
                }
            }
            return null;
        };

        // Strategy 1: FA Full-Time / Mitoo typical Lineup table
        // Usually rows have Name, Goals, Yellow, Red, and optionally sub Y / sub N
        $('table tr, tbody tr').each((i, row) => {
            const cells = $(row).find('td');
            if (cells.length >= 2) {
                const cellTexts = cells.map((_, cell) => $(cell).text().trim()).get();
                const joinedRow = cellTexts.join(' ');
                // Attempt to match player
                const playerId = matchPlayer(joinedRow);
                if (playerId) {
                    const isUnusedSub = /\bsub\s*n\b/i.test(joinedRow) || /\bunused\b/i.test(joinedRow);
                    const isUsedSub = !isUnusedSub && (/\bsub\s*y\b/i.test(joinedRow) || /\bsub\b/i.test(joinedRow));
                    const partType: 'STARTER' | 'SUB' | 'UNUSED_SUB' = isUnusedSub ? 'UNUSED_SUB' : isUsedSub ? 'SUB' : 'STARTER';
                    const mins = partType === 'UNUSED_SUB' ? 0 : partType === 'SUB' ? 30 : 90;

                    if (!foundStats[playerId]) {
                        foundStats[playerId] = { goals: 0, assists: 0, yellow_cards: 0, red_cards: 0, minutes_played: mins, participation_type: partType };
                    }
                    const rowText = $(row).text();
                    const goalMatch = rowText.match(/\(?(\d+)\)?\s*Goal/i) || rowText.match(/(\d+)\s*⚽/);
                    if (goalMatch) {
                        foundStats[playerId].goals += parseInt(goalMatch[1]);
                    } else if (rowText.includes('⚽')) {
                        foundStats[playerId].goals += 1;
                    }
                }
            }
        });

        // Strategy 2: Goalscorers listed in a summary paragraph (e.g. "Goals: Smith (2), Jones")
        const bodyText = $('body').text().replace(/\s+/g, ' ');
        const goalSections = bodyText.match(/Goalscorers?:(.*?)(?:$|Yellow|Red|Referee|Attendance)/i);
        if (goalSections && goalSections[1]) {
            const scorers = goalSections[1].split(',');
            for (const scorerText of scorers) {
                const playerId = matchPlayer(scorerText);
                if (playerId) {
                    if (!foundStats[playerId]) {
                        foundStats[playerId] = { goals: 0, assists: 0, yellow_cards: 0, red_cards: 0, minutes_played: 90, participation_type: 'STARTER' };
                    }
                    const countMatch = scorerText.match(/\((\d+)\)/);
                    if (countMatch) {
                        foundStats[playerId].goals += parseInt(countMatch[1]);
                    } else if (foundStats[playerId].goals === 0) {
                        foundStats[playerId].goals += 1; // Default to 1 if no number specified but they are in the list
                    }
                }
            }
        }

        // Strategy 3: Just appearances. If a name is mentioned in the lineup section or match report.
        const lineupSections = bodyText.match(/Lineup:(.*?)(?:$|Substitutes|Goals|Manager)/i);
        if (lineupSections && lineupSections[1]) {
            const names = lineupSections[1].split(',');
            for (const name of names) {
                const playerId = matchPlayer(name);
                if (playerId && !foundStats[playerId]) {
                    foundStats[playerId] = { goals: 0, assists: 0, yellow_cards: 0, red_cards: 0, minutes_played: 90, participation_type: 'STARTER' };
                }
            }
        }

        // Return the gathered stats
        const finalStats = Object.entries(foundStats).map(([player_id, stats]) => ({
            match_id: matchId,
            player_id,
            ...stats
        }));

        return NextResponse.json({ success: true, stats: finalStats });
    } catch (error: any) {
        console.error("Sync match stats error:", error);
        return NextResponse.json({ success: false, error: error.message || 'Unknown error' }, { status: 500 });
    }
}
