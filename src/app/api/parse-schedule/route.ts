import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { rawText, clubName, defaultKickOff } = body;

        if (!rawText || !clubName) {
            return NextResponse.json({ success: false, error: 'Missing rawText or clubName' }, { status: 400 });
        }

        // Very basic initial heuristic parser.
        // It looks for dates, times, and teams.
        // We will refine this later, but for Sprint 11 we want to get the architecture connected.
        
        const lines = rawText.split('\n').map((l: string) => l.trim()).filter((l: string) => l.length > 0);
        const parsedFixtures: any[] = [];
        
        let currentDate: string | null = null;
        let currentTime: string | null = null;
        
        // Basic Regex patterns
        const dateRegex = /\b\d{1,2}(st|nd|rd|th)?\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{4}|\d{2})\b/i;
        const shortDateRegex = /\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/;
        const timeRegex = /\b\d{1,2}:\d{2}\b/;
        
        for (const line of lines) {
            // Check for date in line
            let dateMatch = line.match(dateRegex);
            if (dateMatch) {
                // Parse date string to standard YYYY-MM-DD
                const dStr = dateMatch[0].replace(/(\d+)(st|nd|rd|th)/, '$1');
                const d = new Date(dStr);
                if (!isNaN(d.getTime())) {
                    currentDate = d.toISOString().split('T')[0];
                }
            } else {
                let shortMatch = line.match(shortDateRegex);
                if (shortMatch) {
                    const parts = shortMatch[0].split(/[\/\-]/);
                    if (parts.length >= 3) {
                        const year = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
                        currentDate = `${year}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
                    }
                }
            }
            
            // Check for time in line
            let timeMatch = line.match(timeRegex);
            if (timeMatch) {
                currentTime = timeMatch[0];
            }
            
            // Look for teams in line (very heuristic: looking for our club name)
            if (line.toLowerCase().includes(clubName.toLowerCase())) {
                const parts = line.split(/\b(?:vs|v|-)\b/i);
                if (parts.length === 2) {
                    const homeTeam = parts[0].trim();
                    const awayTeam = parts[1].trim();
                    
                    const isHome = homeTeam.toLowerCase().includes(clubName.toLowerCase());
                    const opponent = isHome ? awayTeam : homeTeam;
                    
                    parsedFixtures.push({
                        date: currentDate,
                        time: currentTime,
                        opponent: opponent,
                        is_home: isHome,
                        competition: "League",
                        venue: isHome ? "Home Ground" : "Away",
                        status: 'ready'
                    });
                } else {
                    // Fallback column-based parsing (like FA Full Time copy paste)
                    // e.g. "Hayes & Yeading B Team    Camden United    Saturday, 15 August 2026"
                    // If it contains the club name and a date, it's likely a row.
                    if (currentDate) {
                        // Strip date from line
                        let cleanLine = line;
                        if (dateMatch) cleanLine = cleanLine.replace(dateMatch[0], '');
                        if (shortDateRegex) {
                            const sm = line.match(shortDateRegex);
                            if (sm) cleanLine = cleanLine.replace(sm[0], '');
                        }
                        
                        // Split by large gaps
                        const columns = cleanLine.split(/\s{2,}|\t/).filter((c: string) => c.trim().length > 0);
                        if (columns.length >= 2) {
                            const isHome = columns[0].toLowerCase().includes(clubName.toLowerCase());
                            const opponent = isHome ? columns[1] : columns[0];
                            parsedFixtures.push({
                                date: currentDate,
                                time: currentTime,
                                opponent: opponent,
                                is_home: isHome,
                                competition: "League",
                                venue: isHome ? "Home Ground" : "Away",
                                status: 'ready'
                            });
                        }
                    }
                }
            }
        }
        
        // Post-processing for warnings
        const processed = parsedFixtures.map(f => {
            let status = 'ready';
            let warnings = [];
            
            if (!f.time) {
                if (defaultKickOff) {
                    f.time = defaultKickOff;
                } else {
                    status = 'warning';
                    warnings.push('missing_time');
                }
            }
            if (!f.date) {
                status = 'warning';
                warnings.push('missing_date');
            }
            
            return {
                ...f,
                id: Math.random().toString(36).substring(7), // temporary ID for the preview UI
                status,
                warnings
            };
        });

        // Deduplicate locally parsed items
        const unique = [];
        const seen = new Set();
        for (const f of processed) {
            const key = `${f.date}-${f.opponent}`;
            if (!seen.has(key)) {
                seen.add(key);
                unique.push(f);
            }
        }

        return NextResponse.json({ success: true, parsed: unique });

    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
