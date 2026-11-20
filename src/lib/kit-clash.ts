/**
 * Kit Clash Detection & Automatic Away-Kit Resolver (#10)
 * Detects colour clashes between our club's Home / Away shirt hex colours and the opposition's strip.
 */

const KNOWN_OPPONENT_PRIMARY_COLORS: Record<string, { hex: string; label: string }> = {
    // Middlesex County League & London clubs
    "london samurai rovers": { hex: "#1d4ed8", label: "Royal Blue" },
    "bedfont sports": { hex: "#dc2626", label: "Red / Black" },
    "camden & islington": { hex: "#dc2626", label: "Red / Black" },
    "camden and islington": { hex: "#dc2626", label: "Red / Black" },
    "stonewall": { hex: "#e11d48", label: "Red / White" },
    "kensington dragons": { hex: "#dc2626", label: "Red" },
    "hayes & yeading": { hex: "#dc2626", label: "Red / White" },
    "larkspur rovers": { hex: "#9f1239", label: "Claret / Blue" },
    "fh whistlers": { hex: "#1e3a8a", label: "Navy Blue" },
    "wood lane": { hex: "#2563eb", label: "Blue" },
    "sporting duet": { hex: "#16a34a", label: "Green / White" },
    "harrow united": { hex: "#dc2626", label: "Red" },
    "kodak": { hex: "#eab308", label: "Yellow / Black" },
    "hayes & hillingdon": { hex: "#2563eb", label: "Blue" },
    "hayes and hillingdon": { hex: "#2563eb", label: "Blue" },
    "apollo london": { hex: "#0284c7", label: "Sky Blue" },
    "explorers": { hex: "#f59e0b", label: "Amber / Black" },
    "lbs lions": { hex: "#1e293b", label: "Black / Gold" },
    "indian gymkhana": { hex: "#ca8a04", label: "Gold / Maroon" },
    "hilltop": { hex: "#eab308", label: "Yellow / Green" },
    "jolof sports": { hex: "#16a34a", label: "Green" },
    "london fennecs": { hex: "#ffffff", label: "White / Green" },
    "pfc victoria": { hex: "#dc2626", label: "Red" },
    "brook house": { hex: "#2563eb", label: "Blue / White" },
};

const NAME_KEYWORD_COLORS: Array<{ regex: RegExp; hex: string; label: string }> = [
    { regex: /\b(reds|crimson|scarlet|arsenal)\b/i, hex: "#dc2626", label: "Red" },
    { regex: /\b(claret|maroon|burgundy)\b/i, hex: "#881337", label: "Claret" },
    { regex: /\b(blues|bluebirds|navy|royals)\b/i, hex: "#1d4ed8", label: "Blue" },
    { regex: /\b(greens|emerald|celtic|shamrock|forest)\b/i, hex: "#16a34a", label: "Green" },
    { regex: /\b(yellows|gold|amber|canaries|wasps)\b/i, hex: "#eab308", label: "Yellow" },
    { regex: /\b(lilywhites|whites)\b/i, hex: "#f8fafc", label: "White" },
    { regex: /\b(all blacks|blackbirds)\b/i, hex: "#171717", label: "Black" },
    { regex: /\b(purple|violets)\b/i, hex: "#7c3aed", label: "Purple" },
    { regex: /\b(orange|tangerines)\b/i, hex: "#ea580c", label: "Orange" },
];

export function parseHexRgb(hex?: string | null): { r: number; g: number; b: number } | null {
    if (!hex) return null;
    const clean = hex.replace("#", "").trim();
    const full =
        clean.length === 3
            ? clean
                  .split("")
                  .map((c) => c + c)
                  .join("")
            : clean;
    if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
    return {
        r: parseInt(full.slice(0, 2), 16),
        g: parseInt(full.slice(2, 4), 16),
        b: parseInt(full.slice(4, 6), 16),
    };
}

/**
 * Perceptual weighted RGB colour distance (Redmean formula, 0 = identical, ~765 = black vs white).
 * Two football shirts typically clash visually on a pitch when Redmean distance < 165.
 */
export function getKitColorDistance(hexA: string, hexB: string): number {
    const a = parseHexRgb(hexA);
    const b = parseHexRgb(hexB);
    if (!a || !b) return 999;
    const rMean = (a.r + b.r) / 2;
    const dR = a.r - b.r;
    const dG = a.g - b.g;
    const dB = a.b - b.b;
    return Math.sqrt(
        (2 + rMean / 256) * dR * dR +
            4 * dG * dG +
            (2 + (255 - rMean) / 256) * dB * dB
    );
}

export function inferOpponentKitColor(
    opponentName?: string | null,
    explicitOpponentHex?: string | null
): { hex: string; label: string } | null {
    if (explicitOpponentHex && parseHexRgb(explicitOpponentHex)) {
        return { hex: explicitOpponentHex, label: "Opponent Kit" };
    }
    if (!opponentName) return null;
    const lower = opponentName.toLowerCase().trim();

    for (const [clubKey, info] of Object.entries(KNOWN_OPPONENT_PRIMARY_COLORS)) {
        if (lower.includes(clubKey)) {
            return info;
        }
    }
    for (const kw of NAME_KEYWORD_COLORS) {
        if (kw.regex.test(opponentName)) {
            return { hex: kw.hex, label: kw.label };
        }
    }
    return null;
}

export interface KitClashAssessment {
    opponentColor: { hex: string; label: string } | null;
    homeClashesWithOpponent: boolean;
    awayClashesWithOpponent: boolean;
    activeKitClashes: boolean;
    recommendedKit: "home" | "away";
    autoSwitchedToAway: boolean;
}

export function assessMatchdayKitClash(params: {
    ourHomeHex: string;
    ourAwayHex: string;
    activeOutfieldHex: string;
    kitOverride?: "auto" | "home" | "away" | "custom";
    isHome?: boolean;
    opponentName?: string | null;
    explicitOpponentHex?: string | null;
}): KitClashAssessment {
    const {
        ourHomeHex,
        ourAwayHex,
        activeOutfieldHex,
        kitOverride = "auto",
        isHome = true,
        opponentName,
        explicitOpponentHex,
    } = params;

    const opponentColor = inferOpponentKitColor(opponentName, explicitOpponentHex);
    const CLASH_THRESHOLD = 165;

    if (!opponentColor) {
        const fallbackRec = isHome ? "home" : "away";
        return {
            opponentColor: null,
            homeClashesWithOpponent: false,
            awayClashesWithOpponent: false,
            activeKitClashes: false,
            recommendedKit: fallbackRec,
            autoSwitchedToAway: false,
        };
    }

    const homeDist = getKitColorDistance(ourHomeHex, opponentColor.hex);
    const awayDist = getKitColorDistance(ourAwayHex, opponentColor.hex);
    const activeDist = getKitColorDistance(activeOutfieldHex, opponentColor.hex);

    const homeClashesWithOpponent = homeDist < CLASH_THRESHOLD;
    const awayClashesWithOpponent = awayDist < CLASH_THRESHOLD;

    // When Away and our Home kit clashes with the host's Home kit, switch to Away kit;
    // When Away and our Home kit does NOT clash (or our Away kit clashes worse!), wear the cleaner contrast kit!
    let recommendedKit: "home" | "away" = isHome ? "home" : "away";
    if (!isHome) {
        if (homeClashesWithOpponent && !awayClashesWithOpponent) {
            recommendedKit = "away";
        } else if (awayClashesWithOpponent && !homeClashesWithOpponent) {
            recommendedKit = "home";
        } else {
            recommendedKit = awayDist >= homeDist ? "away" : "home";
        }
    } else if (homeClashesWithOpponent && !awayClashesWithOpponent) {
        // Even at Home (e.g. cup tie or shared kit warning), flag that opponent wears similar colours
        recommendedKit = "home";
    }

    const autoSwitchedToAway =
        kitOverride === "auto" && !isHome && homeClashesWithOpponent && recommendedKit === "away";

    return {
        opponentColor,
        homeClashesWithOpponent,
        awayClashesWithOpponent,
        activeKitClashes: !isHome && activeDist < CLASH_THRESHOLD,
        recommendedKit,
        autoSwitchedToAway,
    };
}
