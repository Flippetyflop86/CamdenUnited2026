import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

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

        const foundStats: Record<string, { goals: number, assists: number, yellow_cards: number, red_cards: number, minutes_played: number }> = {};

        // Helper to find a player ID by name
        const matchPlayer = (text: string) => {
            const cleanText = text.toLowerCase().replace(/[^a-z -]/g, '');
            for (const p of players) {
                const fullName = `${p.first_name.toLowerCase()} ${p.last_name.toLowerCase()}`;
                const initialLastName = `${p.first_name[0]?.toLowerCase()} ${p.last_name.toLowerCase()}`;
                if (cleanText.includes(fullName) || cleanText.includes(initialLastName) || cleanText === p.last_name.toLowerCase()) {
                    return p.id;
                }
            }
            return null;
        };

        // Strategy 1: FA Full-Time typical Lineup table
        // Usually rows have Name, Goals, Yellow, Red
        $('table tr, tbody tr').each((i, row) => {
            const cells = $(row).find('td');
            if (cells.length >= 2) {
                const cellTexts = cells.map((_, cell) => $(cell).text().trim()).get();
                // Attempt to match player
                const playerId = matchPlayer(cellTexts.join(' '));
                if (playerId) {
                    if (!foundStats[playerId]) {
                        foundStats[playerId] = { goals: 0, assists: 0, yellow_cards: 0, red_cards: 0, minutes_played: 90 };
                    }
                    // Very simple heuristic: if a cell contains a number and it's near the end, it might be a goal or card.
                    // A proper implementation would map column headers. For now we look for icon hints or just 1s.
                    // If the row text literally contains (1) or a goal icon
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
                        foundStats[playerId] = { goals: 0, assists: 0, yellow_cards: 0, red_cards: 0, minutes_played: 90 };
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
                    foundStats[playerId] = { goals: 0, assists: 0, yellow_cards: 0, red_cards: 0, minutes_played: 90 };
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
