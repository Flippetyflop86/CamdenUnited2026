/**
 * Calculates the meet time based on kick-off time and an offset in minutes.
 * @param kickoffTime Kick-off time in "HH:MM" format
 * @param offsetMinutes Offset in minutes (negative for before, positive for after)
 */
export function calculateMeetTime(kickoffTime: string, offsetMinutes: number = -60): string {
    if (!kickoffTime || !kickoffTime.includes(':')) return "";
    const [hStr, mStr] = kickoffTime.split(':');
    const hours = parseInt(hStr, 10);
    const minutes = parseInt(mStr, 10);
    if (isNaN(hours) || isNaN(minutes)) return kickoffTime;

    let totalMinutes = hours * 60 + minutes + offsetMinutes;
    // Handle day boundary wrap around
    if (totalMinutes < 0) {
        totalMinutes = (totalMinutes % 1440) + 1440;
    }
    totalMinutes = totalMinutes % 1440;

    const newHours = Math.floor(totalMinutes / 60);
    const newMinutes = totalMinutes % 60;

    return `${String(newHours).padStart(2, '0')}:${String(newMinutes).padStart(2, '0')}`;
}

/**
 * Returns the default kick-off time for a given date:
 * - Midweek (Monday–Friday): "19:45" (7:45 PM)
 * - Saturday (or any other day/unspecified): "15:00" (3:00 PM)
 */
export function getDefaultKickoffTime(dateStr?: string | null): string {
    if (!dateStr) return "15:00";
    const clean = dateStr.trim();
    if (!clean) return "15:00";
    const d = new Date(clean.includes("T") ? clean : `${clean}T12:00:00`);
    if (isNaN(d.getTime())) return "15:00";
    const day = d.getDay(); // 0 = Sun, 1..5 = Mon..Fri, 6 = Sat
    if (day >= 1 && day <= 5) {
        return "19:45";
    }
    return "15:00";
}

/**
 * Resolves a fixture's kick-off time, upgrading legacy "14:00" or missing defaults
 * to "19:45" for midweek fixtures (Mon–Fri) and "15:00" for Saturday fixtures.
 */
export function resolveFixtureKickoffTime(dateStr?: string | null, rawTime?: string | null): string {
    const clean = (rawTime || "").trim().slice(0, 5);
    const defaultForDate = getDefaultKickoffTime(dateStr);
    if (!clean || clean === "14:00") {
        return defaultForDate;
    }
    if (defaultForDate === "19:45" && clean === "15:00") {
        return "19:45";
    }
    return clean;
}

/**
 * Known full ground addresses (with postcodes) for clubs and venues in the Middlesex County Football League & London area.
 */
const KNOWN_GROUND_ADDRESSES: Record<string, string> = {
    "new river": "New River Sports Centre, White Hart Lane, Wood Green, London, N22 5QW",
    "new river sports centre": "New River Sports Centre, White Hart Lane, Wood Green, London, N22 5QW",
    "new river stadium": "New River Sports Centre, White Hart Lane, Wood Green, London, N22 5QW",
    "camden united": "New River Sports Centre, White Hart Lane, Wood Green, London, N22 5QW",
    "bedfont sports": "Bedfont Sports Recreation Ground, Hatton Road, Bedfont, Feltham, TW14 9QT",
    "market road": "Market Road Football Pitches, Market Road, Islington, London, N7 9PL",
    "camden & islington united": "Market Road Football Pitches, Market Road, Islington, London, N7 9PL",
    "camden and islington united": "Market Road Football Pitches, Market Road, Islington, London, N7 9PL",
    "larkspur rovers": "Lord Halsbury Memorial Playing Fields, Priors Farm Lane, Northolt, UB5 5FE",
    "fh whistlers": "Brentham Club, 38A Meadvale Road, Ealing, London, W5 1NP",
    "apollo london": "Christ's College Finchley, East End Road, Finchley, London, N2 0SE",
    "lbs lions": "Club Des Sports, East Acton Lane, Acton, London, W3 7HB",
    "explorers": "Brunel University Sports Park, Kingston Lane, Uxbridge, UB8 3PW",
    "wood lane": "Brunel University Sports Park, Kingston Lane, Uxbridge, UB8 3PW",
    "london samurai rovers": "Rectory Meadow, Park Road, Hanworth, Feltham, TW13 6PN",
    "sporting duet": "Gunnersbury Park Sports Hub, Popes Lane, London, W3 8LQ",
    "sporting duet m 1st xi": "Gunnersbury Park Sports Hub, Popes Lane, London, W3 8LQ",
    "harrow united": "Claremont High School, Claremont Avenue, Kenton, Harrow, HA3 0UH",
    "kodak (harrow)": "Harrow Weald Recreation Ground, Uxbridge Road, Harrow Weald, HA3 6SW",
    "kodak": "Harrow Weald Recreation Ground, Uxbridge Road, Harrow Weald, HA3 6SW",
    "hayes & hillingdon": "Middlesex Stadium, Breakspear Road, Ruislip, HA4 7SB",
    "hayes and hillingdon": "Middlesex Stadium, Breakspear Road, Ruislip, HA4 7SB",
    "hayes & yeading": "SkyEx Community Stadium, Beaconsfield Road, Hayes, UB4 0SL",
    "hayes & yeading b team": "SkyEx Community Stadium, Beaconsfield Road, Hayes, UB4 0SL",
    "stonewall": "New River Sports Centre, White Hart Lane, Wood Green, London, N22 5QW",
    "kensington dragons": "Linford Christie Stadium, Du Cane Road, White City, London, W12 0DF",
    "indian gymkhana": "Indian Gymkhana Club, Thornbury Avenue, Osterley, Isleworth, TW7 4NQ",
    "indian gymkhana club": "Indian Gymkhana Club, Thornbury Avenue, Osterley, Isleworth, TW7 4NQ",
    "pfc victoria": "Robert Parker Stadium, Short Lane, Stanwell, Staines-upon-Thames, TW19 7BQ",
    "pfc victoria res.": "Robert Parker Stadium, Short Lane, Stanwell, Staines-upon-Thames, TW19 7BQ",
    "jolof sports": "Memorial Park 3G, Memorial Avenue, West Ham, London, E15 3DB",
    "london fennecs": "Paddington Recreation Ground, Randolph Avenue, Maida Vale, London, W9 1PD",
    "eagles land cricklewood": "Vale Farm Sports Centre, Watford Road, Wembley, HA0 3HG",
    "brook house": "Kingshill Avenue, Hayes, Middlesex, UB4 8BZ",
    "hilltop": "Silver Jubilee Park, Townsend Lane, Kingsbury, London, NW9 7NE",
    "hilltop 2nds": "Silver Jubilee Park, Townsend Lane, Kingsbury, London, NW9 7NE"
};

function isGenericVenueLabel(value?: string | null): boolean {
    if (!value) return true;
    const clean = value.trim().toLowerCase();
    return !clean || clean === "home" || clean === "away" || clean === "home ground" || clean === "away ground" || clean === "tbc" || clean === "tbd";
}

function expandKnownVenueAddress(rawVenue?: string | null): string {
    if (!rawVenue) return "";
    const trimmed = rawVenue.trim();
    if (!trimmed) return "";
    const lower = trimmed.toLowerCase();
    if (KNOWN_GROUND_ADDRESSES[lower]) {
        return KNOWN_GROUND_ADDRESSES[lower];
    }
    return trimmed;
}

function lookupOpponentGroundAddress(opponent?: string | null): string {
    if (!opponent) return "";
    const lower = opponent
        .toLowerCase()
        .replace(/\[\s*void\s*\]/gi, "")
        .replace(/\b(fc|afc|1st xi|first xi|reserves|res\.?)\b/gi, "")
        .replace(/\s+/g, " ")
        .trim();
    const rawLower = opponent.toLowerCase().trim();
    if (KNOWN_GROUND_ADDRESSES[rawLower]) return KNOWN_GROUND_ADDRESSES[rawLower];
    if (KNOWN_GROUND_ADDRESSES[lower]) return KNOWN_GROUND_ADDRESSES[lower];

    for (const [key, addr] of Object.entries(KNOWN_GROUND_ADDRESSES)) {
        if (key.length >= 4 && (rawLower.includes(key) || lower.includes(key))) {
            return addr;
        }
    }
    return "";
}

/**
 * Resolves the full ground address for any fixture (whether Home or Away).
 * Priority:
 * 1. Explicit full address set on the fixture (`customVenue`, `venueNotes`, `location`, `confirmDetails.stadiumAddress`, `confirmDetails.pollMeetLocation`)
 * 2. If Home match: club's configured `confirmDefaults.stadiumAddress` or `homeGround` (expanded to full address with postcode if known)
 * 3. If Away match: known opponent ground address lookup, or `<Opponent> Away Ground` if no specific address is stored yet.
 */
export function resolveFullMatchAddress(params: {
    isHome?: boolean;
    opponent?: string | null;
    location?: string | null;
    venueNotes?: string | null;
    stadiumAddress?: string | null;
    pollMeetLocation?: string | null;
    rawNotes?: string | null;
    homeGround?: string | null;
    defaultStadiumAddress?: string | null;
    clubName?: string | null;
}): string {
    const {
        isHome = true,
        opponent,
        location,
        venueNotes,
        stadiumAddress,
        pollMeetLocation,
        rawNotes,
        homeGround,
        defaultStadiumAddress,
        clubName
    } = params;

    let notesVenue = "";
    let notesConfirmAddress = "";
    let notesPollLocation = "";

    if (rawNotes) {
        const locMatch = rawNotes.match(/\[Location:\s*([^\]]*)\]/i);
        if (locMatch && locMatch[1]) {
            notesVenue = locMatch[1].trim();
        }
        const cdMatch = rawNotes.match(/\[ConfirmDetails:\s*([^\]]*)\]/i);
        if (cdMatch && cdMatch[1]) {
            try {
                const parsed = JSON.parse(decodeURIComponent(cdMatch[1].trim()));
                if (parsed?.stadiumAddress) notesConfirmAddress = String(parsed.stadiumAddress).trim();
                if (parsed?.pollMeetLocation) notesPollLocation = String(parsed.pollMeetLocation).trim();
            } catch {}
        }
        if (rawNotes.includes("[Lineup: ")) {
            try {
                const start = rawNotes.indexOf("[Lineup: ") + 9;
                const end = rawNotes.indexOf("}]", start);
                if (end !== -1) {
                    const parsedLineup = JSON.parse(rawNotes.slice(start, end + 1));
                    if (parsedLineup?.venueNotes && !isGenericVenueLabel(parsedLineup.venueNotes)) {
                        notesVenue = String(parsedLineup.venueNotes).trim();
                    }
                }
            } catch {}
        }
    }

    const explicitCandidates = [
        venueNotes,
        pollMeetLocation,
        stadiumAddress,
        location,
        notesPollLocation,
        notesConfirmAddress,
        notesVenue
    ];

    for (const candidate of explicitCandidates) {
        if (candidate && !isGenericVenueLabel(candidate)) {
            return expandKnownVenueAddress(candidate);
        }
    }

    if (isHome) {
        const homeCandidates = [defaultStadiumAddress, homeGround, clubName];
        for (const hc of homeCandidates) {
            if (hc && !isGenericVenueLabel(hc)) {
                const expanded = expandKnownVenueAddress(hc);
                if (expanded && expanded !== clubName) return expanded;
            }
        }
        if (clubName && KNOWN_GROUND_ADDRESSES[clubName.toLowerCase().trim()]) {
            return KNOWN_GROUND_ADDRESSES[clubName.toLowerCase().trim()];
        }
        return expandKnownVenueAddress(homeGround || defaultStadiumAddress || "New River Sports Centre, White Hart Lane, Wood Green, London, N22 5QW");
    }

    const oppGround = lookupOpponentGroundAddress(opponent);
    if (oppGround) {
        return oppGround;
    }

    return opponent ? `${opponent.trim()} Ground (Full address TBC)` : "Away Ground (Full address TBC)";
}

/**
 * Replaces placeholders in the template string with match details and customized inputs.
 */
export function generateWhatsAppMessage(
    template: string,
    match: { opponent: string; isHome: boolean; competition: string; date: string; time: string; location?: string; },
    vars: {
        meetTime: string;
        meetLocation: string;
        surface: string;
        notes: string;
        formation?: string;
        startingXi?: string;
        bench?: string;
    }
): string {
    if (!template) return "";

    const dateObj = new Date(match.date);
    const formattedDate = isNaN(dateObj.getTime())
        ? match.date
        : new Intl.DateTimeFormat("en-GB", { weekday: 'short', day: 'numeric', month: 'short' }).format(dateObj);

    const fullAddress = resolveFullMatchAddress({
        isHome: match.isHome,
        opponent: match.opponent,
        location: vars.meetLocation || match.location
    });

    return template
        .replace(/{opponent}/g, match.opponent || "TBD")
        .replace(/{venue}/g, fullAddress)
        .replace(/{competition}/g, match.competition || "TBD")
        .replace(/{date}/g, formattedDate)
        .replace(/{time}/g, match.time || "TBD")
        .replace(/{meet_time}/g, vars.meetTime || "TBD")
        .replace(/{meet_location}/g, fullAddress)
        .replace(/{surface}/g, vars.surface || "TBD")
        .replace(/{notes}/g, vars.notes || "")
        .replace(/{formation}/g, vars.formation || "TBD")
        .replace(/{starting_xi}/g, vars.startingXi || "TBD")
        .replace(/{bench}/g, vars.bench || "TBD");
}

