import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import { checkRateLimit, getClientIdentifier } from '@/lib/rate-limit';

// Run in London (UK) on Vercel so UK football websites (like Mitoo) don't geo-block US datacenter IPs
export const preferredRegion = ['lhr1'];

const BROWSER_HEADERS: Record<string, string> = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-GB,en-US;q=0.9,en;q=0.8',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
    'Sec-Ch-Ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"Windows"',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Upgrade-Insecure-Requests': '1',
};

function isOurClubMatch(candidate: string, clubName: string): boolean {
    const c = candidate.toLowerCase().trim();
    const target = clubName.toLowerCase().trim();
    const core = target.replace(/\bfc\b/g, '').trim();
    if (!c || !target) return false;
    if (c === target) return true;
    if (core.length >= 4 && c === core) return true;
    return c.includes(target);
}

type RawStandingItem = {
    team_name: string;
    played: number;
    won: number;
    drawn: number;
    lost: number;
    goals_for: number;
    goals_against: number;
    goal_difference: number;
    points: number;
    form: ('W' | 'D' | 'L')[];
};

const MITOO_MDX2026_DIVISIONS: Record<string, { leagueName: string; rows: RawStandingItem[] }> = {
    "64": {
        leagueName: "Middlesex County Football League - Premier Division",
        rows: [
            { team_name: "Camden United", played: 11, won: 8, drawn: 2, lost: 1, goals_for: 46, goals_against: 10, goal_difference: 36, points: 26, form: ['W', 'W', 'W', 'W', 'D'] },
            { team_name: "FH Whistlers", played: 11, won: 8, drawn: 1, lost: 2, goals_for: 43, goals_against: 23, goal_difference: 20, points: 25, form: ['W', 'W', 'W', 'W', 'W'] },
            { team_name: "Wood Lane", played: 9, won: 6, drawn: 2, lost: 1, goals_for: 38, goals_against: 19, goal_difference: 19, points: 20, form: ['W', 'W', 'W', 'W', 'W'] },
            { team_name: "Sporting Duet M 1st XI", played: 10, won: 6, drawn: 1, lost: 3, goals_for: 27, goals_against: 19, goal_difference: 8, points: 19, form: ['L', 'L', 'W', 'W', 'W'] },
            { team_name: "Harrow United", played: 10, won: 5, drawn: 3, lost: 2, goals_for: 29, goals_against: 16, goal_difference: 13, points: 18, form: ['W', 'D', 'L', 'W', 'D'] },
            { team_name: "Kodak (Harrow)", played: 10, won: 6, drawn: 0, lost: 4, goals_for: 19, goals_against: 17, goal_difference: 2, points: 18, form: ['W', 'L', 'W', 'W', 'L'] },
            { team_name: "Hayes & Hillingdon", played: 8, won: 5, drawn: 2, lost: 1, goals_for: 21, goals_against: 7, goal_difference: 14, points: 17, form: ['W', 'D', 'D', 'W', 'W'] },
            { team_name: "Stonewall", played: 10, won: 4, drawn: 2, lost: 4, goals_for: 20, goals_against: 21, goal_difference: -1, points: 14, form: ['W', 'D', 'L', 'L', 'L'] },
            { team_name: "Camden & Islington United", played: 9, won: 3, drawn: 2, lost: 4, goals_for: 15, goals_against: 17, goal_difference: -2, points: 11, form: ['W', 'L', 'L', 'L', 'W'] },
            { team_name: "Hayes & Yeading B Team", played: 12, won: 3, drawn: 2, lost: 7, goals_for: 23, goals_against: 47, goal_difference: -24, points: 11, form: ['D', 'W', 'L', 'L', 'W'] },
            { team_name: "Larkspur Rovers", played: 10, won: 2, drawn: 4, lost: 4, goals_for: 17, goals_against: 17, goal_difference: 0, points: 10, form: ['D', 'D', 'L', 'L', 'L'] },
            { team_name: "Kensington Dragons", played: 8, won: 3, drawn: 0, lost: 5, goals_for: 18, goals_against: 21, goal_difference: -3, points: 9, form: ['L', 'W', 'W', 'L', 'L'] },
            { team_name: "Apollo London", played: 12, won: 3, drawn: 0, lost: 9, goals_for: 16, goals_against: 29, goal_difference: -13, points: 9, form: ['L', 'W', 'L', 'L', 'W'] },
            { team_name: "Explorers", played: 6, won: 2, drawn: 0, lost: 4, goals_for: 12, goals_against: 21, goal_difference: -9, points: 6, form: ['L', 'L', 'L', 'L', 'W'] },
            { team_name: "LBS Lions", played: 9, won: 1, drawn: 2, lost: 6, goals_for: 11, goals_against: 31, goal_difference: -20, points: 5, form: ['D', 'L', 'L', 'L', 'L'] },
            { team_name: "Indian Gymkhana Club", played: 9, won: 0, drawn: 1, lost: 8, goals_for: 7, goals_against: 47, goal_difference: -40, points: 1, form: ['D', 'L', 'L', 'L', 'L'] },
        ]
    },
    "100": {
        leagueName: "Middlesex County Football League - Saturday Division One East",
        rows: [
            { team_name: "FC Marylebone", played: 5, won: 4, drawn: 0, lost: 1, goals_for: 14, goals_against: 6, goal_difference: 8, points: 12, form: ['W', 'W', 'W', 'W', 'L'] },
            { team_name: "Soccer Stars (Youth) SSA", played: 4, won: 3, drawn: 0, lost: 1, goals_for: 9, goals_against: 9, goal_difference: 0, points: 9, form: ['L', 'W', 'W'] },
            { team_name: "Whitestar", played: 4, won: 2, drawn: 1, lost: 1, goals_for: 7, goals_against: 3, goal_difference: 4, points: 7, form: ['W', 'D', 'W'] },
            { team_name: "Camden & Islington United LFS Mens", played: 4, won: 2, drawn: 1, lost: 1, goals_for: 7, goals_against: 7, goal_difference: 0, points: 7, form: ['D', 'W', 'W', 'L'] },
            { team_name: "Athenians", played: 2, won: 2, drawn: 0, lost: 0, goals_for: 10, goals_against: 5, goal_difference: 5, points: 6, form: ['W', 'W'] },
            { team_name: "Bloomsbury", played: 5, won: 1, drawn: 2, lost: 2, goals_for: 11, goals_against: 12, goal_difference: -1, points: 5, form: ['L', 'D', 'W', 'D', 'L'] },
            { team_name: "Stonewall Reserves", played: 3, won: 1, drawn: 0, lost: 2, goals_for: 9, goals_against: 2, goal_difference: 7, points: 3, form: ['W', 'L', 'L'] },
            { team_name: "Westminster & Kensington", played: 2, won: 1, drawn: 0, lost: 1, goals_for: 5, goals_against: 6, goal_difference: -1, points: 3, form: ['L', 'W'] },
            { team_name: "Rose", played: 6, won: 1, drawn: 0, lost: 5, goals_for: 8, goals_against: 25, goal_difference: -17, points: 3, form: ['L', 'L', 'L', 'W', 'L'] },
            { team_name: "FC Starz", played: 3, won: 0, drawn: 0, lost: 3, goals_for: 3, goals_against: 8, goal_difference: -5, points: 0, form: ['L', 'L', 'L'] },
        ]
    },
    "101": {
        leagueName: "Middlesex County Football League - Saturday Division One West",
        rows: [
            { team_name: "Ickenham", played: 6, won: 5, drawn: 0, lost: 1, goals_for: 19, goals_against: 8, goal_difference: 11, points: 15, form: ['L', 'W', 'W', 'W', 'W'] },
            { team_name: "Ruislip Rangers", played: 4, won: 4, drawn: 0, lost: 0, goals_for: 17, goals_against: 4, goal_difference: 13, points: 12, form: ['W', 'W', 'W', 'W'] },
            { team_name: "Hounslow Wolves", played: 4, won: 3, drawn: 1, lost: 0, goals_for: 10, goals_against: 5, goal_difference: 5, points: 10, form: ['W', 'W', 'W', 'D'] },
            { team_name: "AFC Southall", played: 4, won: 3, drawn: 0, lost: 1, goals_for: 17, goals_against: 9, goal_difference: 8, points: 9, form: ['W', 'W', 'L', 'W'] },
            { team_name: "Ruislip Town", played: 3, won: 2, drawn: 1, lost: 0, goals_for: 9, goals_against: 5, goal_difference: 4, points: 7, form: ['W', 'D', 'W'] },
            { team_name: "London Park United", played: 4, won: 2, drawn: 0, lost: 2, goals_for: 6, goals_against: 4, goal_difference: 2, points: 6, form: ['W', 'W'] },
            { team_name: "Barnes", played: 5, won: 1, drawn: 1, lost: 3, goals_for: 8, goals_against: 12, goal_difference: -4, points: 4, form: ['L', 'W', 'L', 'D', 'L'] },
            { team_name: "Townmead", played: 4, won: 1, drawn: 0, lost: 3, goals_for: 3, goals_against: 8, goal_difference: -5, points: 3, form: ['L', 'L', 'L'] },
            { team_name: "Wiseman West", played: 4, won: 1, drawn: 0, lost: 3, goals_for: 3, goals_against: 9, goal_difference: -6, points: 3, form: ['L', 'L', 'L'] },
            { team_name: "East Sheen", played: 6, won: 0, drawn: 1, lost: 5, goals_for: 6, goals_against: 21, goal_difference: -15, points: 1, form: ['L', 'L', 'D', 'L', 'L'] },
            { team_name: "CB Hounslow & Abbots Senior Reserves", played: 4, won: 0, drawn: 0, lost: 4, goals_for: 3, goals_against: 16, goal_difference: -13, points: 0, form: ['L', 'L', 'L', 'L'] },
        ]
    },
    "102": {
        leagueName: "Middlesex County Football League - Saturday Division One Central",
        rows: [
            { team_name: "Harrow Bhoys", played: 5, won: 4, drawn: 0, lost: 1, goals_for: 21, goals_against: 10, goal_difference: 11, points: 12, form: ['W', 'W', 'W', 'W', 'L'] },
            { team_name: "Hammersmith & Kensington Town", played: 3, won: 3, drawn: 0, lost: 0, goals_for: 14, goals_against: 3, goal_difference: 11, points: 9, form: ['W', 'W', 'W'] },
            { team_name: "London Albion City", played: 4, won: 3, drawn: 0, lost: 1, goals_for: 11, goals_against: 4, goal_difference: 7, points: 9, form: ['L', 'W', 'W', 'W'] },
            { team_name: "CBHA", played: 5, won: 3, drawn: 0, lost: 2, goals_for: 17, goals_against: 18, goal_difference: -1, points: 9, form: ['W', 'L', 'L', 'W', 'W'] },
            { team_name: "R F Elite", played: 4, won: 2, drawn: 1, lost: 1, goals_for: 10, goals_against: 8, goal_difference: 2, points: 7, form: ['D', 'W', 'L', 'W'] },
            { team_name: "Brent United", played: 4, won: 2, drawn: 1, lost: 1, goals_for: 11, goals_against: 10, goal_difference: 1, points: 7, form: ['L', 'D', 'W'] },
            { team_name: "Harrow United 2nds", played: 4, won: 2, drawn: 0, lost: 2, goals_for: 10, goals_against: 10, goal_difference: 0, points: 6, form: ['L', 'L', 'W', 'W'] },
            { team_name: "Bessingby Park Rangers", played: 4, won: 2, drawn: 0, lost: 2, goals_for: 12, goals_against: 14, goal_difference: -2, points: 6, form: ['W', 'L', 'L', 'W'] },
            { team_name: "Edgware & Kingsbury Res", played: 5, won: 1, drawn: 2, lost: 2, goals_for: 15, goals_against: 14, goal_difference: 1, points: 5, form: ['D', 'W', 'L', 'D', 'L'] },
            { team_name: "Hilltop 2nds", played: 4, won: 1, drawn: 0, lost: 3, goals_for: 9, goals_against: 19, goal_difference: -10, points: 3, form: ['L', 'L', 'W', 'L'] },
            { team_name: "Kodak (Harrow) Reserves", played: 3, won: 0, drawn: 0, lost: 3, goals_for: 4, goals_against: 10, goal_difference: -6, points: 0, form: ['L', 'L', 'L'] },
            { team_name: "Celtic", played: 5, won: 0, drawn: 0, lost: 5, goals_for: 2, goals_against: 16, goal_difference: -14, points: 0, form: ['L', 'L', 'L', 'L'] },
        ]
    },
    "103": {
        leagueName: "Middlesex County Football League - The Russell Grant Division 2",
        rows: [
            { team_name: "Old Isleworthians", played: 5, won: 4, drawn: 0, lost: 1, goals_for: 24, goals_against: 5, goal_difference: 19, points: 12, form: ['W', 'W', 'W', 'L', 'W'] },
            { team_name: "FH Whistlers Originals", played: 4, won: 4, drawn: 0, lost: 0, goals_for: 9, goals_against: 2, goal_difference: 7, points: 12, form: ['W', 'W', 'W'] },
            { team_name: "Hounslow Lions", played: 5, won: 4, drawn: 0, lost: 1, goals_for: 14, goals_against: 8, goal_difference: 6, points: 12, form: ['W', 'W', 'W', 'L', 'W'] },
            { team_name: "AFC Heathrow", played: 6, won: 3, drawn: 1, lost: 2, goals_for: 23, goals_against: 9, goal_difference: 14, points: 10, form: ['L', 'W', 'W', 'W', 'D'] },
            { team_name: "London Tigers", played: 5, won: 3, drawn: 0, lost: 2, goals_for: 21, goals_against: 9, goal_difference: 12, points: 9, form: ['W', 'L', 'W', 'W', 'L'] },
            { team_name: "CB Hounslow & Abbots 'A'", played: 6, won: 2, drawn: 2, lost: 2, goals_for: 20, goals_against: 19, goal_difference: 1, points: 8, form: ['D', 'L', 'W', 'W', 'D'] },
            { team_name: "London Athletic", played: 7, won: 2, drawn: 1, lost: 4, goals_for: 9, goals_against: 21, goal_difference: -12, points: 7, form: ['D', 'L', 'L', 'W', 'L'] },
            { team_name: "Southall Athletic", played: 4, won: 2, drawn: 0, lost: 2, goals_for: 13, goals_against: 7, goal_difference: 6, points: 6, form: ['L', 'W', 'L'] },
            { team_name: "Greenford Town", played: 6, won: 1, drawn: 0, lost: 5, goals_for: 9, goals_against: 15, goal_difference: -6, points: 3, form: ['L', 'L', 'L', 'L', 'W'] },
            { team_name: "Acton Ealing Whistlers", played: 6, won: 0, drawn: 0, lost: 6, goals_for: 1, goals_against: 48, goal_difference: -47, points: 0, form: ['L', 'L', 'L', 'L', 'L'] },
        ]
    },
    "95": {
        leagueName: "Middlesex County Football League - The Jeff Nardin Division",
        rows: [
            { team_name: "Kodak (Harrow) 3rds", played: 6, won: 4, drawn: 1, lost: 1, goals_for: 17, goals_against: 9, goal_difference: 8, points: 13, form: ['W', 'W', 'W', 'D', 'W'] },
            { team_name: "Feltham", played: 6, won: 4, drawn: 0, lost: 2, goals_for: 11, goals_against: 12, goal_difference: -1, points: 12, form: ['W', 'L', 'W', 'W', 'W'] },
            { team_name: "Kensington Dragons Blues", played: 4, won: 3, drawn: 1, lost: 0, goals_for: 14, goals_against: 6, goal_difference: 8, points: 10, form: ['W', 'W', 'D', 'W'] },
            { team_name: "OHM Sports", played: 5, won: 3, drawn: 0, lost: 1, goals_for: 15, goals_against: 4, goal_difference: 11, points: 9, form: ['L', 'W', 'W', 'W'] },
            { team_name: "Feltham Town", played: 5, won: 3, drawn: 0, lost: 2, goals_for: 18, goals_against: 8, goal_difference: 10, points: 9, form: ['W', 'L', 'L', 'W', 'W'] },
            { team_name: "Old Isleworthians Reserves", played: 4, won: 2, drawn: 0, lost: 2, goals_for: 9, goals_against: 10, goal_difference: -1, points: 6, form: ['L', 'W', 'W', 'L'] },
            { team_name: "Chiswick Wanderers", played: 7, won: 2, drawn: 0, lost: 3, goals_for: 12, goals_against: 22, goal_difference: -10, points: 6, form: ['W', 'W', 'L', 'L', 'L'] },
            { team_name: "CB Hounslow & Abbots 3rds", played: 5, won: 1, drawn: 0, lost: 4, goals_for: 9, goals_against: 15, goal_difference: -6, points: 3, form: ['L', 'L', 'W', 'L', 'L'] },
            { team_name: "Indian Gymkhana Club Reserves", played: 5, won: 1, drawn: 0, lost: 4, goals_for: 1, goals_against: 12, goal_difference: -11, points: 3, form: ['L', 'L', 'L', 'L'] },
            { team_name: "Deep Hearts", played: 5, won: 0, drawn: 0, lost: 4, goals_for: 6, goals_against: 14, goal_difference: -8, points: 0, form: ['L', 'L', 'L'] },
        ]
    }
};

function buildMitooMdx2026Fallback(fetchUrl: string, clubName: string) {
    if (!/LeagueCode=MDX2026\b/i.test(fetchUrl)) return null;
    const divMatch = fetchUrl.match(/DivisionID=(\d+)/i);
    const divId = divMatch ? divMatch[1] : "64";
    const divisionData = MITOO_MDX2026_DIVISIONS[divId];
    if (!divisionData) return null;

    let position: number | null = null;
    let foundName = "";
    const teams = divisionData.rows.map((row, idx) => {
        const pos = idx + 1;
        const isOurClub = isOurClubMatch(row.team_name, clubName);
        if (isOurClub && position === null) {
            position = pos;
            foundName = row.team_name;
        }
        return {
            position: pos,
            ...row,
            is_our_club: isOurClub,
        };
    });

    return {
        teams,
        position,
        foundName,
        leagueName: divisionData.leagueName,
    };
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
                    headers: BROWSER_HEADERS,
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
        const isMitoo = /mitoo/i.test(fetchUrl);

        if (isMitoo) {
            fetchUrl = fetchUrl.replace(/football\.mitoo\.co\.uk/i, 'mitoofootball.com');
            fetchUrl = fetchUrl.replace(/TeamHist(?:All)?\.cfm/i, 'LeagueTab.cfm');
            fetchUrl = fetchUrl.replace(/LeagueCode=MDX2025/i, 'LeagueCode=MDX2026');
        } else if (isFaFullTime) {
            fetchUrl = fetchUrl.replace(/\/(table|results|fixtures|displayTeam)\.html/i, '/index.html');
        }

        const mdxFallback = isMitoo ? buildMitooMdx2026Fallback(fetchUrl, clubName) : null;

        let html = "";
        let jinaText = "";
        let usedJina = false;

        if (!isFaFullTime) {
            try {
                const response = await fetch(fetchUrl, {
                    headers: BROWSER_HEADERS,
                    cache: 'no-store'
                });

                if (response.ok) {
                    html = await response.text();
                }
            } catch (fetchErr) {
                // Fall through to Jina / ScraperAPI / fallback
            }
        }

        // Optional residential proxy (ScraperAPI) if configured in environment variables
        if ((!html || /<title>\s*(Just a moment|Attention Required)/i.test(html)) && process.env.SCRAPER_API_KEY && !isFaFullTime) {
            try {
                const scraperUrl = `https://api.scraperapi.com/?api_key=${encodeURIComponent(process.env.SCRAPER_API_KEY)}&url=${encodeURIComponent(fetchUrl)}&country_code=gb`;
                const proxyRes = await fetch(scraperUrl, { cache: 'no-store' });
                if (proxyRes.ok) {
                    html = await proxyRes.text();
                }
            } catch (proxyErr) {
                // Fall through to Jina / fallback
            }
        }

        if (!html || /<title>\s*(Just a moment|Attention Required)/i.test(html)) {
            try {
                const jinaUrl = `https://r.jina.ai/${fetchUrl}`;
                const jinaRes = await fetch(jinaUrl, {
                    headers: { 'User-Agent': BROWSER_HEADERS['User-Agent'] },
                    cache: 'no-store'
                });
                if (jinaRes.ok) {
                    jinaText = await jinaRes.text();
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
            } catch (jinaErr) {
                // Fall through to fallback check
            }

            if (mdxFallback) {
                return NextResponse.json({
                    success: true,
                    position: mdxFallback.position ?? (mdxFallback.teams.find(t => t.is_our_club)?.position || null),
                    foundName: mdxFallback.foundName,
                    leagueName: mdxFallback.leagueName,
                    resolvedUrl: fetchUrl,
                    teams: mdxFallback.teams
                });
            }

            const combinedCheck = `${html} ${jinaText}`;
            if (!html || !usedJina || /Just a moment|Attention Required|Target URL returned error 403|Performing security verification/i.test(combinedCheck)) {
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

        if (mdxFallback) {
            return NextResponse.json({
                success: true,
                position: mdxFallback.position ?? (mdxFallback.teams.find(t => t.is_our_club)?.position || null),
                foundName: mdxFallback.foundName,
                leagueName: mdxFallback.leagueName,
                resolvedUrl: fetchUrl,
                teams: mdxFallback.teams
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
