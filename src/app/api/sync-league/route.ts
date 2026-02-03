import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST() {
    try {
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );

        // 1. Get the league table URL
        const { data: urlData, error: urlError } = await supabase
            .from('documents')
            .select('url')
            .eq('name', 'League Table')
            .maybeSingle();

        if (urlError || !urlData?.url) {
            return NextResponse.json({ error: 'League table URL not found' }, { status: 404 });
        }

        // 2. Fetch the league table HTML
        const response = await fetch(urlData.url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            next: { revalidate: 0 }
        });

        if (!response.ok) {
            return NextResponse.json({ error: 'Failed to fetch league table' }, { status: 500 });
        }

        const html = await response.text();

        // 3. Parse the data (Basic scraping since we don't have a DOM parser)
        // Mitoo tables are usually simple <table><tr>...</tr></table>
        // We look for "Camden United" and then find the rank before it or after it.
        // Usually: <tr><td>Pos</td><td>Team</td>...</tr>

        // Find the index of "Camden United"
        const teamIndex = html.indexOf('Camden United');
        if (teamIndex === -1) {
            return NextResponse.json({ error: 'Team not found in league table' }, { status: 404 });
        }

        // Search backwards for the rank
        // Rank is usually in the first <td> of the <tr>
        const beforeTeam = html.substring(0, teamIndex);
        const lastTrIndex = beforeTeam.lastIndexOf('<tr');
        const teamRow = html.substring(lastTrIndex, html.indexOf('</tr>', teamIndex));

        // Extract cells: <td>Value</td>
        const cells = teamRow.match(/<td[^>]*>(.*?)<\/td>/g)?.map(c => c.replace(/<[^>]*>/g, '').trim()) || [];

        if (cells.length < 2) {
            return NextResponse.json({ error: 'Failed to parse team row' }, { status: 500 });
        }

        // Standard Mitoo table indices (may vary, but usually):
        // 0: POS, 1: TEAM, 2: PLD, 3: W, 4: D, 5: L, 6: F, 7: A, 8: GD, 9: PTS
        const rawPos = cells[0];
        const points = cells[9] || cells[cells.length - 1]; // Fallback to last cell if index is wrong

        // Clean up position (e.g., "1" -> "1st", "2" -> "2nd")
        const posInt = parseInt(rawPos);
        let position = rawPos;
        if (!isNaN(posInt)) {
            const lastDigit = posInt % 10;
            const lastTwoDigits = posInt % 100;
            if (lastTwoDigits >= 11 && lastTwoDigits <= 13) {
                position = `${posInt}th`;
            } else {
                switch (lastDigit) {
                    case 1: position = `${posInt}st`; break;
                    case 2: position = `${posInt}nd`; break;
                    case 3: position = `${posInt}rd`; break;
                    default: position = `${posInt}th`; break;
                }
            }
        }

        // 4. Update the 'League Stats' document
        const stats = JSON.stringify({
            position,
            points: points || "0",
            lastUpdated: new Date().toISOString()
        });

        const { data: existing } = await supabase
            .from('documents')
            .select('id')
            .eq('name', 'League Stats')
            .maybeSingle();

        if (existing) {
            await supabase.from('documents').update({ url: stats }).eq('id', existing.id);
        } else {
            await supabase.from('documents').insert([{
                name: 'League Stats',
                type: 'Stats',
                category: 'General',
                url: stats
            }]);
        }

        return NextResponse.json({ success: true, position, points });
    } catch (error: any) {
        console.error('Sync Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
