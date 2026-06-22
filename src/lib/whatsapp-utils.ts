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
 * Replaces placeholders in the template string with match details and customized inputs.
 */
export function generateWhatsAppMessage(
    template: string,
    match: { opponent: string; isHome: boolean; competition: string; date: string; time: string; },
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

    return template
        .replace(/{opponent}/g, match.opponent || "TBD")
        .replace(/{venue}/g, match.isHome ? "Home" : "Away")
        .replace(/{competition}/g, match.competition || "TBD")
        .replace(/{date}/g, formattedDate)
        .replace(/{time}/g, match.time || "TBD")
        .replace(/{meet_time}/g, vars.meetTime || "TBD")
        .replace(/{meet_location}/g, vars.meetLocation || "TBD")
        .replace(/{surface}/g, vars.surface || "TBD")
        .replace(/{notes}/g, vars.notes || "")
        .replace(/{formation}/g, vars.formation || "TBD")
        .replace(/{starting_xi}/g, vars.startingXi || "TBD")
        .replace(/{bench}/g, vars.bench || "TBD");
}
