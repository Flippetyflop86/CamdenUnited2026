import { NextResponse } from 'next/server';

const NON_OPPONENT_PATTERNS = [
    /^premier\s+division$/i,
    /^division\s*(1|2|3|4|one|two|three|four|i|ii|iii|iv)$/i,
    /^senior\s+division$/i,
    /^intermediate\s+division$/i,
    /^combination\s+division$/i,
    /^middlesex\s+county(\s+football)?\s+league$/i,
    /^fa\s+full[\s\-]*time$/i,
    /^(league|senior|challenge|charity|county|open|junior|supplementary|president'?s|chairman'?s)\s+(cup|trophy|shield|plate)$/i,
    /^cup$/i,
    /^league$/i,
    /^friendly$/i,
    /^first\s+team$/i,
    /^reserves$/i,
    /^development$/i,
    /^u\d{2}s?$/i,
    /^round\s*\d+[a-z]?$/i,
    /^\d+(?:st|nd|rd|th)\s+round$/i,
    /^(?:first|second|third|fourth|fifth|sixth|preliminary|extra\s+preliminary|qualifying|\d+(?:st|nd|rd|th)\s+qualifying)\s+round$/i,
    /^round\s+(?:one|two|three|four|five|six)$/i,
    /^(?:quarter[\s\-]*finals?|semi[\s\-]*finals?|(?:the\s+|grand\s+)?finals?|qf|sf|play[\s\-]*offs?|replay)$/i,
    /^group\s+(?:[a-z0-9]+|stage)$/i,
    /^(date|time|kick\s*off|ko|home|away|venue|pitch|ground|competition|division|status|result|score|match|fixtures?|notes?)$/i,
    /^(mon|tue|wed|thu|fri|sat|sun)(day|sday|nesday|rsday)?$/i,
    /^(tbc|tbd|n\/a|postponed|cancelled|walkover|h\/w|a\/w|vs?\.?)$/i,
    /^\d{1,2}\s*[:\.]\s*\d{2}$/,
    /^\d{1,2}\s*-\s*\d{1,2}$/,
];

function isNonOpponentToken(raw: string): boolean {
    const trimmed = raw.trim();
    if (!trimmed || trimmed.length < 2) return true;
    for (const rx of NON_OPPONENT_PATTERNS) {
        if (rx.test(trimmed)) return true;
    }
    // Check if it looks like a pure competition/division/cup name
    if (/\b(premier division|division \d|division one|division two|league cup|challenge cup|senior cup|county cup|middlesex county|premier cup|division cup|\bcup\b|\btrophy\b|\bshield\b)\b/i.test(trimmed) && !/\b(fc|united|city|town|athletic|rov|rovers|wanderers|albion|spurs|rangers|park|boys|club|sc|afc|bfc|cfc|lions|stonewall|explorers|whistlers|samurai|apollo|duet)\b/i.test(trimmed)) {
        return true;
    }
    return false;
}

function cleanTeamCandidate(raw: string): string {
    return raw
        .replace(/\b\d{1,2}:\d{2}\b/g, '')
        .replace(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun),?\b/gi, '')
        .replace(/\b\d{1,2}(st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*(\s+\d{2,4})?\b/gi, '')
        .replace(/\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/g, '')
        .replace(/\((home|away|h|a|first team)\)/gi, '')
        .replace(/\b(premier division|division \d+|division one|division two)\b/gi, '')
        .replace(/\b(quarter[\s\-]*finals?|semi[\s\-]*finals?|round\s+\d+[a-z]?|\d+(?:st|nd|rd|th)\s+round|(?:first|second|third|fourth|preliminary|qualifying)\s+round)\b/gi, '')
        .replace(/^[\s\-–—:|•]+|[\s\-–—:|•]+$/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function detectCompetitionFromText(text: string): string {
    if (/\b(cup|trophy|shield|plate|vase|quarter[\s\-]*finals?|semi[\s\-]*finals?|round\s+\d+|\d+(?:st|nd|rd|th)\s+round|preliminary\s+round|qualifying\s+round)\b/i.test(text)) return "Cup";
    if (/\b(friendly|pre-season|preseason|warmup)\b/i.test(text)) return "Friendly";
    return "League";
}

function parseDateFromLine(line: string): { isoDate: string; matchedText: string } | null {
    // 1. Long date e.g. "Saturday, 15 August 2026" or "15th Aug 2026" or "15 Aug 26"
    const longRegex = /\b(?:(?:mon|tue|wed|thu|fri|sat|sun)[a-z]*,?\s+)?(\d{1,2})(?:st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*(?:\s+(\d{4}|\d{2}))?\b/i;
    const mLong = line.match(longRegex);
    if (mLong) {
        const day = mLong[1].padStart(2, '0');
        const monthMap: Record<string, string> = {
            jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
            jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
        };
        const month = monthMap[mLong[2].toLowerCase().slice(0, 3)] || '01';
        let year = mLong[3] || String(new Date().getFullYear());
        if (year.length === 2) year = `20${year}`;
        return { isoDate: `${year}-${month}-${day}`, matchedText: mLong[0] };
    }

    // 2. ISO date YYYY-MM-DD
    const isoRegex = /\b(20\d{2})-(\d{2})-(\d{2})\b/;
    const mIso = line.match(isoRegex);
    if (mIso) {
        return { isoDate: mIso[0], matchedText: mIso[0] };
    }

    // 3. UK Short date DD/MM/YYYY or DD/MM/YY or DD-MM-YYYY
    const shortRegex = /\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})\b/;
    const mShort = line.match(shortRegex);
    if (mShort) {
        const day = mShort[1].padStart(2, '0');
        const month = mShort[2].padStart(2, '0');
        const year = mShort[3].length === 2 ? `20${mShort[3]}` : mShort[3];
        if (Number(month) >= 1 && Number(month) <= 12 && Number(day) >= 1 && Number(day) <= 31) {
            return { isoDate: `${year}-${month}-${day}`, matchedText: mShort[0] };
        }
    }

    return null;
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { rawText, clubName, defaultKickOff, knownOpponents = [] } = body;

        if (!rawText || !clubName) {
            return NextResponse.json({ success: false, error: 'Missing rawText or clubName' }, { status: 400 });
        }

        const clubLower = clubName.trim().toLowerCase();
        // Also support matching core club name without "FC"
        const clubCoreLower = clubLower.replace(/\bfc\b/g, '').trim();

        const isOurClub = (candidate: string): boolean => {
            const c = candidate.toLowerCase();
            return c.includes(clubLower) || (clubCoreLower.length >= 4 && c.includes(clubCoreLower));
        };

        // Match candidate against knownOpponents if close
        const resolveKnownOpponent = (candidate: string): string => {
            const cleaned = cleanTeamCandidate(candidate);
            if (!cleaned) return '';
            const cLower = cleaned.toLowerCase();
            for (const known of knownOpponents as string[]) {
                const kTrim = known.trim();
                if (!kTrim) continue;
                const kLower = kTrim.toLowerCase();
                if (cLower === kLower || cLower.includes(kLower) || kLower.includes(cLower)) {
                    return kTrim;
                }
            }
            return cleaned;
        };

        const rawLines: string[] = String(rawText).split(/\r?\n/).map((l: string) => l.trim()).filter((l: string) => l.length > 0);
        const parsedFixtures: any[] = [];

        let currentDate: string | null = null;
        let currentTime: string | null = null;
        let currentCompetition: string = "League";
        const timeRegex = /\b(\d{1,2}:\d{2})\b/;

        for (let i = 0; i < rawLines.length; i++) {
            const line = rawLines[i];

            // Track competition context if a standalone header line appears (e.g. Line 1 of a 2-line FA Full-Time Cup entry)
            if (!isOurClub(line)) {
                if (/\b(cup|trophy|shield|plate|vase)\b/i.test(line)) {
                    currentCompetition = "Cup";
                } else if (/\b(friendly|pre-season|preseason)\b/i.test(line)) {
                    currentCompetition = "Friendly";
                } else if (isNonOpponentToken(line) && /\b(division|league)\b/i.test(line)) {
                    currentCompetition = "League";
                }
            }

            const dateFound = parseDateFromLine(line);
            if (dateFound) {
                currentDate = dateFound.isoDate;
            }

            const timeMatch = line.match(timeRegex);
            if (timeMatch) {
                currentTime = timeMatch[1].padStart(5, '0');
            }

            // Does this line contain our club name?
            if (isOurClub(line)) {
                const detectedOnLine = detectCompetitionFromText(line);
                const hasExplicitLeagueOnLine = /\b(premier\s+division|division\s+\d+|division\s+one|division\s+two|league)\b/i.test(line) && !/\b(cup|trophy|shield|plate|vase)\b/i.test(line);
                const lineComp = detectedOnLine !== "League"
                    ? detectedOnLine
                    : (hasExplicitLeagueOnLine ? "League" : currentCompetition);

                // Strip date and time tokens from the line before extracting teams
                let workLine = line;
                if (dateFound) workLine = workLine.replace(dateFound.matchedText, '  ');
                if (timeMatch) workLine = workLine.replace(timeMatch[0], '  ');

                let extractedOpponent = '';
                let extractedIsHome: boolean | null = null;

                // Strategy 1: Explicit "Home vs Away" or "Home v Away" or "Home - Away"
                const vsMatch = workLine.split(/\s+(?:vs?\.?|-|–|@)\s+/i);
                if (vsMatch.length >= 2) {
                    // Find which segment contains our club
                    const clubIdx = vsMatch.findIndex(seg => isOurClub(seg));
                    if (clubIdx !== -1) {
                        // Check left and right neighbors that aren't non-opponent headers
                        const candidates: { text: string; isHome: boolean }[] = [];
                        if (clubIdx === 0 && vsMatch[1]) {
                            candidates.push({ text: vsMatch[1], isHome: true });
                        } else if (clubIdx > 0) {
                            candidates.push({ text: vsMatch[clubIdx - 1], isHome: false });
                            if (vsMatch[clubIdx + 1]) {
                                candidates.push({ text: vsMatch[clubIdx + 1], isHome: true });
                            }
                        }

                        for (const cand of candidates) {
                            // Split further by tabs/double-spaces in case competition/venue is attached
                            const subCols = cand.text.split(/\t|\s{2,}/).map(cleanTeamCandidate).filter(Boolean);
                            const validSub = subCols.find(sc => !isNonOpponentToken(sc) && !isOurClub(sc));
                            if (validSub) {
                                extractedOpponent = resolveKnownOpponent(validSub);
                                extractedIsHome = cand.isHome;
                                break;
                            }
                        }
                    }
                }

                // Strategy 2: Tab or multi-space separated columns (FA Full-Time table rows)
                if (!extractedOpponent) {
                    const columns = workLine
                        .split(/\t|\s{2,}/)
                        .map(c => cleanTeamCandidate(c))
                        .filter(c => c.length > 1 && !/^(vs?\.?|-|\d+\s*-\s*\d+)$/i.test(c));

                    const clubColIdx = columns.findIndex(c => isOurClub(c));
                    if (clubColIdx !== -1) {
                        // Look at other columns that are valid team names (not "Premier Division", not "League", etc.)
                        const teamCols = columns
                            .map((col, idx) => ({ col, idx }))
                            .filter(item => item.idx !== clubColIdx && !isNonOpponentToken(item.col) && !isOurClub(item.col));

                        if (teamCols.length > 0) {
                            // Prefer a column that matches a known opponent, otherwise the closest column to clubColIdx
                            const knownMatch = teamCols.find(tc =>
                                (knownOpponents as string[]).some(ko => ko && tc.col.toLowerCase().includes(ko.toLowerCase()))
                            );
                            const chosen = knownMatch || teamCols.sort((a, b) => Math.abs(a.idx - clubColIdx) - Math.abs(b.idx - clubColIdx))[0];
                            extractedOpponent = resolveKnownOpponent(chosen.col);
                            extractedIsHome = clubColIdx < chosen.idx;
                        }
                    }
                }

                // Strategy 3: Multi-line block (where opponent is on the immediately preceding or following line)
                if (!extractedOpponent) {
                    const prevLine = i > 0 ? cleanTeamCandidate(rawLines[i - 1]) : '';
                    const nextLine = i + 1 < rawLines.length ? cleanTeamCandidate(rawLines[i + 1]) : '';
                    const nextNextLine = i + 2 < rawLines.length ? cleanTeamCandidate(rawLines[i + 2]) : '';

                    if (nextLine && (/^(vs?\.?|\d{1,2}:\d{2})$/i.test(rawLines[i + 1].trim())) && nextNextLine && !isNonOpponentToken(nextNextLine) && !isOurClub(nextNextLine)) {
                        extractedOpponent = resolveKnownOpponent(nextNextLine);
                        extractedIsHome = true;
                        i += 2; // advance past opponent line
                    } else if (nextLine && !isNonOpponentToken(nextLine) && !isOurClub(nextLine) && !parseDateFromLine(rawLines[i + 1])) {
                        extractedOpponent = resolveKnownOpponent(nextLine);
                        extractedIsHome = true;
                        i += 1;
                    } else if (prevLine && !isNonOpponentToken(prevLine) && !isOurClub(prevLine) && !parseDateFromLine(rawLines[i - 1])) {
                        extractedOpponent = resolveKnownOpponent(prevLine);
                        extractedIsHome = false;
                    }
                }

                if (extractedOpponent && !isNonOpponentToken(extractedOpponent)) {
                    // Check explicit (H) / (A) marker in original line
                    if (/\((h|home)\)/i.test(line)) extractedIsHome = true;
                    if (/\((a|away)\)/i.test(line)) extractedIsHome = false;
                    const isHome = extractedIsHome ?? true;

                    parsedFixtures.push({
                        date: currentDate,
                        time: currentTime || defaultKickOff || "14:00",
                        opponent: extractedOpponent,
                        is_home: isHome,
                        competition: lineComp,
                        venue: isHome ? "Home" : "Away",
                        status: 'ready'
                    });
                    currentCompetition = "League";
                }
            }
        }

        // Fallback: What if the user pasted a simple list of opponents + dates WITHOUT typing "Camden United" on every line?
        // e.g. "15/08/2026 14:00 Hackney Wick (H)" or "22/08/2026 Athletic Newham Away"
        if (parsedFixtures.length === 0) {
            for (const line of rawLines) {
                if (isNonOpponentToken(line)) continue;
                const dMatch = parseDateFromLine(line);
                const tMatch = line.match(timeRegex);
                let rest = line;
                if (dMatch) rest = rest.replace(dMatch.matchedText, ' ');
                if (tMatch) rest = rest.replace(tMatch[0], ' ');
                const isAway = /\b(away|\(a\))\b/i.test(rest);
                const comp = detectCompetitionFromText(rest);
                const candidate = cleanTeamCandidate(rest.replace(/\b(home|away|\(h\)|\(a\)|vs?\.?)\b/gi, ' '));
                if (candidate && !isNonOpponentToken(candidate) && !isOurClub(candidate) && (dMatch || currentDate)) {
                    if (dMatch) currentDate = dMatch.isoDate;
                    parsedFixtures.push({
                        date: currentDate,
                        time: tMatch ? tMatch[1].padStart(5, '0') : (defaultKickOff || "14:00"),
                        opponent: resolveKnownOpponent(candidate),
                        is_home: !isAway,
                        competition: comp,
                        venue: !isAway ? "Home" : "Away",
                        status: 'ready'
                    });
                }
            }
        }

        // Post-processing for warnings
        const processed = parsedFixtures.map(f => {
            let status = 'ready';
            const warnings: string[] = [];

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
            if (!f.opponent || isNonOpponentToken(f.opponent)) {
                status = 'warning';
                warnings.push('check_opponent');
            }

            return {
                ...f,
                id: Math.random().toString(36).substring(2, 9),
                status,
                warnings
            };
        });

        // Deduplicate locally parsed items
        const unique = [];
        const seen = new Set();
        for (const f of processed) {
            const key = `${f.date}-${f.opponent.toLowerCase()}-${f.is_home}`;
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
