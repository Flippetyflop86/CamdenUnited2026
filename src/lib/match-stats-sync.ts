import { supabase } from "@/lib/supabase";

export interface SimplePlayerRef {
    id: string;
    first_name?: string;
    last_name?: string;
    firstName?: string;
    lastName?: string;
    nickname?: string;
    use_nickname?: boolean;
    useNickname?: boolean;
    position?: string;
    squad?: string;
}

export interface ParsedStatToken {
    rawName: string;
    count: number;
    playerId?: string;
}

export function formatPlayerShortName(p: SimplePlayerRef): string {
    const first = (p.first_name ?? p.firstName ?? "").trim();
    const last = (p.last_name ?? p.lastName ?? "").trim();
    if (!first && !last) return "Unknown";
    if (!last) return first;
    if (!first) return last;
    return `${first[0]}.${last}`;
}

export function formatPlayerFullName(p: SimplePlayerRef): string {
    const first = (p.first_name ?? p.firstName ?? "").trim();
    const last = (p.last_name ?? p.lastName ?? "").trim();
    return `${first} ${last}`.trim();
}

/**
 * Matches a text name token (e.g. "K.Ali", "Kieran Ali", "Ali") to a player in the squad list.
 */
export function matchTokenToPlayer(tokenName: string, players: SimplePlayerRef[]): SimplePlayerRef | undefined {
    const clean = tokenName.trim().toLowerCase().replace(/\s+/g, " ");
    if (!clean || clean === "og" || clean === "own goal" || clean.startsWith("own goal")) {
        return undefined;
    }

    // 1. Exact match on "f.lastname" or "first lastname" or nickname
    for (const p of players) {
        const shortName = formatPlayerShortName(p).toLowerCase();
        const fullName = formatPlayerFullName(p).toLowerCase();
        const nick = (p.nickname || "").trim().toLowerCase();
        if (clean === shortName || clean === fullName || (nick && clean === nick)) {
            return p;
        }
        // Also check without dot: "k ali"
        if (clean === shortName.replace(".", " ")) {
            return p;
        }
    }

    // 2. Unique last_name match
    const lastMatches = players.filter(p => {
        const last = (p.last_name ?? p.lastName ?? "").trim().toLowerCase();
        return last && last === clean;
    });
    if (lastMatches.length === 1) {
        return lastMatches[0];
    }

    // 3. Initial + partial last name match
    const dotParts = clean.split(/[\.\s]+/);
    if (dotParts.length >= 2 && dotParts[0].length === 1) {
        const initial = dotParts[0];
        const restLast = dotParts.slice(1).join(" ");
        const initMatches = players.filter(p => {
            const first = (p.first_name ?? p.firstName ?? "").trim().toLowerCase();
            const last = (p.last_name ?? p.lastName ?? "").trim().toLowerCase();
            return first.startsWith(initial) && last === restLast;
        });
        if (initMatches.length >= 1) return initMatches[0];
    }

    return undefined;
}

/**
 * Parses a comma-separated string like "J.Smith (2), K.Ali, Own Goal" into structured tokens.
 */
export function parseStatTextString(text: string | null | undefined, players: SimplePlayerRef[] = []): ParsedStatToken[] {
    if (!text || !text.trim()) return [];
    const parts = text
        .split(",")
        .map(s => s.trim())
        .filter(Boolean);

    const results: ParsedStatToken[] = [];

    for (const part of parts) {
        // Match e.g. "J.Smith (2)" or "J.Smith x2" or "J.Smith 2"
        const parenMatch = part.match(/^(.*?)\s*(?:\((\d+)\)|x(\d+))$/i);
        let rawName = part.trim();
        let count = 1;
        if (parenMatch) {
            rawName = parenMatch[1].trim();
            count = parseInt(parenMatch[2] || parenMatch[3] || "1", 10) || 1;
        }
        if (!rawName) continue;

        const matched = players.length > 0 ? matchTokenToPlayer(rawName, players) : undefined;
        if (matched) {
            const existing = results.find(r => r.playerId === matched.id);
            if (existing) {
                existing.count += count;
            } else {
                results.push({
                    rawName: formatPlayerShortName(matched),
                    count,
                    playerId: matched.id
                });
            }
        } else {
            const existingRaw = results.find(r => !r.playerId && r.rawName.toLowerCase() === rawName.toLowerCase());
            if (existingRaw) {
                existingRaw.count += count;
            } else {
                results.push({ rawName, count });
            }
        }
    }

    return results;
}

/**
 * Formats player counts + any extra manual tokens (e.g. "Own Goal") into a standard string:
 * "K.Ali (2), M.Al Nashi"
 */
export function formatStatTokensToString(
    playerCounts: Record<string, number>,
    players: SimplePlayerRef[],
    extraManualTokens: { rawName: string; count: number }[] = []
): string {
    const items: string[] = [];

    Object.entries(playerCounts).forEach(([playerId, count]) => {
        if (!count || count <= 0) return;
        const p = players.find(x => x.id === playerId);
        const name = p ? formatPlayerShortName(p) : "";
        if (!name) return;
        items.push(count > 1 ? `${name} (${count})` : name);
    });

    extraManualTokens.forEach(tok => {
        if (!tok.rawName.trim() || tok.count <= 0) return;
        items.push(tok.count > 1 ? `${tok.rawName.trim()} (${tok.count})` : tok.rawName.trim());
    });

    return items.join(", ");
}

/**
 * Extracts our club's goals and opponent's goals from a scoreline string ("3-1" or "3 - 1")
 * Note: In ClubFlow matches table, `result` is stored in standard `Home - Away` order (or `X-Y`).
 */
export function parseMatchScoreline(
    scoreline: string | null | undefined,
    isHome: boolean
): { homeGoals: number; awayGoals: number; clubGoals: number; opponentGoals: number } | null {
    if (!scoreline || !scoreline.includes("-")) return null;
    const clean = scoreline.trim();
    const match = clean.match(/^(\d+)\s*-\s*(\d+)$/);
    if (!match) return null;
    const homeGoals = parseInt(match[1], 10);
    const awayGoals = parseInt(match[2], 10);
    if (isNaN(homeGoals) || isNaN(awayGoals)) return null;

    return {
        homeGoals,
        awayGoals,
        clubGoals: isHome ? homeGoals : awayGoals,
        opponentGoals: isHome ? awayGoals : homeGoals
    };
}

export function computeMatchOutcome(
    scoreline: string | null | undefined,
    isHome: boolean
): "Win" | "Loss" | "Draw" | "Pending" {
    const parsed = parseMatchScoreline(scoreline, isHome);
    if (!parsed) return "Pending";
    if (parsed.clubGoals > parsed.opponentGoals) return "Win";
    if (parsed.clubGoals < parsed.opponentGoals) return "Loss";
    return "Draw";
}

/**
 * Synchronizes a match's player goals & assists across:
 * 1. `match_player_stats` rows in Supabase
 * 2. `matches.goalscorers` & `matches.assists` text columns
 * 3. `matches.notes` embedded `[Lineup: ...]` JSON (`matchEvents`)
 * while preserving any manual/unmatched text tokens (like "Own Goal").
 */
export async function syncMatchGoalsAndAssistsEverywhere(
    matchId: string,
    options?: {
        overrideScoreline?: string;
        manualGoalTokens?: { rawName: string; count: number }[];
        manualAssistTokens?: { rawName: string; count: number }[];
    }
): Promise<{ goalscorers: string | null; assists: string | null }> {
    const [{ data: matchRow }, { data: statRows }, { data: allPlayers }] = await Promise.all([
        supabase.from("matches").select("id, is_home, scoreline, result, goalscorers, assists, notes").eq("id", matchId).single(),
        supabase.from("match_player_stats").select("*").eq("match_id", matchId),
        supabase.from("players").select("id, first_name, last_name, nickname, use_nickname")
    ]);

    const playersList: SimplePlayerRef[] = allPlayers || [];
    const currentStats = statRows || [];

    // Preserve any existing manual tokens (like "Own Goal") from matches.goalscorers / matches.assists if not overridden
    const existingGoalTokens = parseStatTextString(matchRow?.goalscorers, playersList);
    const existingAssistTokens = parseStatTextString(matchRow?.assists, playersList);

    const preservedManualGoals = options?.manualGoalTokens !== undefined
        ? options.manualGoalTokens
        : existingGoalTokens.filter(t => !t.playerId);

    const preservedManualAssists = options?.manualAssistTokens !== undefined
        ? options.manualAssistTokens
        : existingAssistTokens.filter(t => !t.playerId);

    const goalCounts: Record<string, number> = {};
    const assistCounts: Record<string, number> = {};

    currentStats.forEach((row: any) => {
        if (row.player_id && (Number(row.goals) || 0) > 0) {
            goalCounts[row.player_id] = Number(row.goals);
        }
        if (row.player_id && (Number(row.assists) || 0) > 0) {
            assistCounts[row.player_id] = Number(row.assists);
        }
    });

    // Also check if lineup in matches.notes has trialist goals/assists or needs its matchEvents updated
    let updatedNotes = matchRow?.notes || "";
    if (updatedNotes.includes("[Lineup: ")) {
        const startIdx = updatedNotes.indexOf("[Lineup: ");
        const jsonStartIdx = startIdx + "[Lineup: ".length;
        let depth = 0;
        let inString = false;
        let escape = false;
        let jsonEndIdx = -1;

        for (let i = jsonStartIdx; i < updatedNotes.length; i++) {
            const ch = updatedNotes[i];
            if (escape) { escape = false; continue; }
            if (ch === "\\") { escape = true; continue; }
            if (ch === '"') { inString = !inString; continue; }
            if (inString) continue;
            if (ch === "{") depth++;
            else if (ch === "}") {
                depth--;
                if (depth === 0) {
                    jsonEndIdx = i;
                    break;
                }
            }
        }

        if (jsonEndIdx !== -1) {
            try {
                const jsonStr = updatedNotes.substring(jsonStartIdx, jsonEndIdx + 1);
                const parsedLineup = JSON.parse(jsonStr);
                const nextMatchEvents: Record<string, any> = { ...(parsedLineup.matchEvents || {}) };

                // Sync real player stats into lineup.matchEvents
                currentStats.forEach((row: any) => {
                    if (!row.player_id) return;
                    const prev = nextMatchEvents[row.player_id] || { goals: 0, assists: 0, yellowCards: 0, redCards: 0 };
                    nextMatchEvents[row.player_id] = {
                        goals: Number(row.goals) || 0,
                        assists: Number(row.assists) || 0,
                        yellowCards: Number(row.yellow_cards ?? prev.yellowCards) || 0,
                        redCards: Number(row.red_cards ?? prev.redCards) || 0
                    };
                });

                // Clear zeroed out real players that were removed from stats
                Object.keys(nextMatchEvents).forEach(pid => {
                    if (pid.startsWith("trialist-")) {
                        // Include trialist goals/assists in manual tokens if not already there
                        const tName = parsedLineup.customNames?.[pid] || "Trialist";
                        const tGoals = Number(nextMatchEvents[pid]?.goals) || 0;
                        const tAssists = Number(nextMatchEvents[pid]?.assists) || 0;
                        if (tGoals > 0 && !preservedManualGoals.some(m => m.rawName.toLowerCase() === tName.toLowerCase())) {
                            preservedManualGoals.push({ rawName: tName, count: tGoals });
                        }
                        if (tAssists > 0 && !preservedManualAssists.some(m => m.rawName.toLowerCase() === tName.toLowerCase())) {
                            preservedManualAssists.push({ rawName: tName, count: tAssists });
                        }
                    } else {
                        const statRow = currentStats.find((r: any) => r.player_id === pid);
                        if (!statRow) {
                            nextMatchEvents[pid] = {
                                ...(nextMatchEvents[pid] || {}),
                                goals: 0,
                                assists: 0
                            };
                        }
                    }
                });

                parsedLineup.matchEvents = nextMatchEvents;
                const tagCloseIdx = updatedNotes[jsonEndIdx + 1] === "]" ? jsonEndIdx + 2 : jsonEndIdx + 1;
                const before = updatedNotes.substring(0, startIdx);
                const after = updatedNotes.substring(tagCloseIdx);
                updatedNotes = `${before}[Lineup: ${JSON.stringify(parsedLineup)}]${after}`.trim();
            } catch (e) {
                console.warn("Failed to sync lineup matchEvents in notes:", e);
            }
        }
    }

    const goalscorersStr = formatStatTokensToString(goalCounts, playersList, preservedManualGoals) || "";
    const assistsStr = formatStatTokensToString(assistCounts, playersList, preservedManualAssists) || "";

    const updatePayload: Record<string, any> = {
        goalscorers: goalscorersStr,
        assists: assistsStr,
        notes: updatedNotes
    };

    if (options?.overrideScoreline !== undefined) {
        const cleanScore = options.overrideScoreline.trim();
        updatePayload.scoreline = cleanScore;
        updatePayload.result = computeMatchOutcome(cleanScore, Boolean(matchRow?.is_home ?? true));
    }

    await supabase.from("matches").update(updatePayload).eq("id", matchId);

    return { goalscorers: goalscorersStr, assists: assistsStr };
}

/**
 * Hydrates `match_player_stats` from existing `matches.goalscorers` and `matches.assists` text
 * if a match has text-logged goals/assists from earlier in the season that aren't in `match_player_stats` yet.
 */
export async function ensureStatsHydratedFromMatchText(
    matchId: string,
    goalscorersText: string | null | undefined,
    assistsText: string | null | undefined,
    players: SimplePlayerRef[]
): Promise<boolean> {
    if ((!goalscorersText || !goalscorersText.trim()) && (!assistsText || !assistsText.trim())) {
        return false;
    }

    const goalTokens = parseStatTextString(goalscorersText, players).filter(t => t.playerId);
    const assistTokens = parseStatTextString(assistsText, players).filter(t => t.playerId);
    if (goalTokens.length === 0 && assistTokens.length === 0) return false;

    const { data: existingStats } = await supabase
        .from("match_player_stats")
        .select("*")
        .eq("match_id", matchId);

    const rows = existingStats || [];
    const totalDbGoals = rows.reduce((acc: number, r: any) => acc + (Number(r.goals) || 0), 0);
    const totalDbAssists = rows.reduce((acc: number, r: any) => acc + (Number(r.assists) || 0), 0);

    // Only auto-hydrate if DB stats currently have 0 goals (when goalTokens exist) or 0 assists (when assistTokens exist)
    const shouldHydrateGoals = goalTokens.length > 0 && totalDbGoals === 0;
    const shouldHydrateAssists = assistTokens.length > 0 && totalDbAssists === 0;

    if (!shouldHydrateGoals && !shouldHydrateAssists) return false;

    const playerIdsToTouch = new Set<string>();
    if (shouldHydrateGoals) goalTokens.forEach(t => t.playerId && playerIdsToTouch.add(t.playerId));
    if (shouldHydrateAssists) assistTokens.forEach(t => t.playerId && playerIdsToTouch.add(t.playerId));

    let changed = false;
    for (const pid of playerIdsToTouch) {
        const gCount = shouldHydrateGoals ? (goalTokens.find(t => t.playerId === pid)?.count || 0) : undefined;
        const aCount = shouldHydrateAssists ? (assistTokens.find(t => t.playerId === pid)?.count || 0) : undefined;
        const existingRow = rows.find((r: any) => r.player_id === pid);

        if (existingRow) {
            const payload: Record<string, any> = {};
            if (gCount !== undefined) payload.goals = gCount;
            if (aCount !== undefined) payload.assists = aCount;
            await supabase.from("match_player_stats").update(payload).eq("id", existingRow.id);
            changed = true;
        } else {
            await supabase.from("match_player_stats").insert([{
                match_id: matchId,
                player_id: pid,
                goals: gCount ?? 0,
                assists: aCount ?? 0,
                yellow_cards: 0,
                red_cards: 0,
                minutes_played: 90,
                participation_type: "STARTER"
            }]);
            changed = true;
        }
    }

    return changed;
}
