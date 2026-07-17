import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { url, clubName } = body;

        if (!url || !clubName) {
            return NextResponse.json({ success: false, error: 'Missing url or clubName' }, { status: 400 });
        }

        // Fetch the league page
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

        let position: number | null = null;
        let foundName = "";

        // Common table selectors for FA Full-Time and Mitoo
        const rows = $('table tr, tbody tr');

        // Iterate over rows to find the club
        rows.each((i, row) => {
            const rowText = $(row).text().toLowerCase();
            if (rowText.includes(clubName.toLowerCase())) {
                // We found a row with the club's name!
                // Usually the position is the very first number in the row, or the first <td>
                const cells = $(row).find('td, th');
                
                // Method 1: Get the first cell text and try to parse it
                if (cells.length > 0) {
                    const firstCellText = $(cells[0]).text().trim();
                    const parsedPos = parseInt(firstCellText, 10);
                    
                    if (!isNaN(parsedPos)) {
                        position = parsedPos;
                    } else {
                        // Method 2: Fallback for sites like Mitoo which don't have a position number column
                        // Count the preceding rows in the same table that look like valid team rows
                        let prevTeamRows = 0;
                        $(row).prevAll('tr').each((_, prevRow) => {
                            const prevText = $(prevRow).text().toLowerCase();
                            // Skip header rows
                            if (!prevText.includes('games played') && !prevText.includes('points') && !prevText.includes('goals for') && !prevText.includes('goal difference')) {
                                // A valid league table row usually has at least 5-6 columns (Played, Won, Drawn, Lost, Points, etc.)
                                if ($(prevRow).find('td, th').length >= 5) {
                                    prevTeamRows++;
                                }
                            }
                        });
                        position = prevTeamRows + 1;
                    }
                    
                    foundName = $(row).text().replace(/\s+/g, ' ').trim();
                    return false; // Break out of the each loop
                }
            }
        });

        let leagueName = $('title').text().trim() || $('.league-title').text().trim() || "";
        if (leagueName.toLowerCase().includes("fa full-time")) {
            leagueName = leagueName.replace(/-\s*fa\s*full-time/i, "").trim();
        }
        if (leagueName.includes("|")) {
            leagueName = leagueName.split("|")[0].trim();
        } else if (leagueName.includes("-")) {
            leagueName = leagueName.split("-")[0].trim();
        }

        if (position !== null) {
            return NextResponse.json({ success: true, position, foundName, leagueName });
        } else {
            return NextResponse.json({ 
                success: false, 
                error: `Could not find '${clubName}' in the league table. Make sure your club name exactly matches the name used on the league website.` 
            }, { status: 404 });
        }

    } catch (error: any) {
        console.error('League Scraper Error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
