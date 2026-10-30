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

    // 3. Initial + partial last name match ("k.ali", "k ali") OR "lastname initial" ("ali k", "feka e")
    const dotParts = clean.split(/[\.\s]+/).filter(Boolean);
    if (dotParts.length >= 2) {
        if (dotParts[0].length === 1) {
            const initial = dotParts[0];
            const restLast = dotParts.slice(1).join(" ");
            const initMatches = players.filter(p => {
                const first = (p.first_name ?? p.firstName ?? "").trim().toLowerCase();
                const last = (p.last_name ?? p.lastName ?? "").trim().toLowerCase();
                return first.startsWith(initial) && (last === restLast || last.endsWith(` ${restLast}`));
            });
            if (initMatches.length >= 1) return initMatches[0];
        }
        const lastToken = dotParts[dotParts.length - 1];
        if (lastToken.length === 1) {
            const initial = lastToken;
            const restLast = dotParts.slice(0, -1).join(" ");
            const initMatches = players.filter(p => {
                const first = (p.first_name ?? p.firstName ?? "").trim().toLowerCase();
                const last = (p.last_name ?? p.lastName ?? "").trim().toLowerCase();
                return first.startsWith(initial) && (last === restLast || last.endsWith(` ${restLast}`));
            });
            if (initMatches.length >= 1) return initMatches[0];
        }
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

    // Also check if lineup in matches.notes has trialist goals/assists, needs its matchEvents updated,
    // or has starters / used substitutes that haven't been synced into match_player_stats yet
    const normalizedNotesInfo = normalizeMatchNotesString(matchRow?.notes || "");
    let updatedNotes = normalizedNotesInfo.normalized;
    const effectiveScoreline = options?.overrideScoreline !== undefined
        ? options.overrideScoreline.trim()
        : (matchRow?.scoreline || "");
    const effectiveOutcome = options?.overrideScoreline !== undefined
        ? computeMatchOutcome(effectiveScoreline, Boolean(matchRow?.is_home ?? true))
        : (matchRow?.result || "Pending");
    const isCompletedMatch = effectiveOutcome !== "Pending" || Boolean(effectiveScoreline && effectiveScoreline.includes("-"));

    if (updatedNotes.includes("[Lineup: ")) {
        const extracted = extractLineupFromRawNotes(updatedNotes);
        if (extracted.parsedLineup) {
            try {
                const parsedLineup = extracted.parsedLineup;
                const nextMatchEvents: Record<string, any> = { ...(parsedLineup.matchEvents || {}) };

                // If the match is completed, ensure all starters and used substitutes from the lineup
                // exist in match_player_stats with accurate participation_type ('STARTER' | 'SUB') and minutes_played
                if (isCompletedMatch) {
                    const participationMap = computeLineupParticipation(parsedLineup);
                    for (const [pid, part] of participationMap.entries()) {
                        if (part.participationType === "UNUSED_SUB") continue;
                        const existingStat = currentStats.find((r: any) => r.player_id === pid);
                        const ev = nextMatchEvents[pid];
                        if (!existingStat) {
                            const newRowPayload = {
                                match_id: matchId,
                                player_id: pid,
                                goals: Number(ev?.goals) || 0,
                                assists: Number(ev?.assists) || 0,
                                yellow_cards: Number(ev?.yellowCards) || 0,
                                red_cards: Number(ev?.redCards) || 0,
                                minutes_played: part.minutesPlayed,
                                participation_type: part.participationType,
                                sub_events: part.subEvents,
                            };
                            const { data: inserted } = await supabase
                                .from("match_player_stats")
                                .insert([newRowPayload])
                                .select()
                                .single();
                            if (inserted) {
                                currentStats.push(inserted);
                                if (inserted.goals > 0) goalCounts[pid] = Number(inserted.goals);
                                if (inserted.assists > 0) assistCounts[pid] = Number(inserted.assists);
                            }
                        } else if (
                            existingStat.participation_type !== part.participationType ||
                            (part.participationType === "SUB" && (existingStat.minutes_played ?? 0) === 0 && part.minutesPlayed > 0)
                        ) {
                            const nextMins =
                                part.participationType === "SUB" && (existingStat.minutes_played === 0 || existingStat.minutes_played === 90)
                                    ? part.minutesPlayed
                                    : (existingStat.minutes_played ?? part.minutesPlayed);
                            await supabase
                                .from("match_player_stats")
                                .update({
                                    participation_type: part.participationType,
                                    minutes_played: nextMins,
                                })
                                .eq("id", existingStat.id);
                            existingStat.participation_type = part.participationType;
                            existingStat.minutes_played = nextMins;
                        }
                    }
                }

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
                updatedNotes = `[Lineup: ${JSON.stringify(parsedLineup)}]\n${extracted.cleanNotes}`.trim();
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
 * Repairs any `notes` string where a legacy save wedged `[Location:...][Surface:...][MeetTime:...]`
 * in the middle of a `[Lineup: {...}]` JSON block right after `"substitutions":[...}]`.
 */
export function normalizeMatchNotesString(rawNotes?: string | null): { normalized: string; wasRepaired: boolean } {
    if (!rawNotes || !rawNotes.includes("[Lineup: ")) {
        return { normalized: rawNotes || "", wasRepaired: false };
    }
    const wedgedRegex = /(\}\])\s*(\r?\n(?:\[(?:Location|Surface|MeetTime):[^\]]*\]\s*)+)\r?\n\s*(?="[a-zA-Z0-9_]+":)/;
    if (wedgedRegex.test(rawNotes)) {
        let extractedTags = "";
        const repaired = rawNotes.replace(wedgedRegex, (_match, closingArr, tagsBlock) => {
            extractedTags = tagsBlock.trim();
            return `${closingArr},`;
        });
        const finalNormalized = `${repaired.trim()}\n${extractedTags}`.trim();
        return { normalized: finalNormalized, wasRepaired: true };
    }
    return { normalized: rawNotes, wasRepaired: false };
}

/**
 * Extracts `[Lineup: {...}]` from a `matches.notes` string using balanced brace matching,
 * automatically repairing split lineup JSON if needed.
 */
export function extractLineupFromRawNotes(rawNotes?: string | null): {
    parsedLineup: any | null;
    lineupTag: string;
    cleanNotes: string;
    normalizedRawNotes: string;
    wasRepaired: boolean;
} {
    const { normalized, wasRepaired } = normalizeMatchNotesString(rawNotes);
    if (!normalized || !normalized.includes("[Lineup: ")) {
        return { parsedLineup: null, lineupTag: "", cleanNotes: normalized || "", normalizedRawNotes: normalized || "", wasRepaired: false };
    }

    const tagStartIdx = normalized.indexOf("[Lineup: ");
    const jsonStartIdx = tagStartIdx + "[Lineup: ".length;
    let depth = 0;
    let inString = false;
    let escape = false;
    let jsonEndIdx = -1;

    for (let i = jsonStartIdx; i < normalized.length; i++) {
        const ch = normalized[i];
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
        const jsonStr = normalized.substring(jsonStartIdx, jsonEndIdx + 1);
        const tagCloseIdx = normalized[jsonEndIdx + 1] === "]" ? jsonEndIdx + 2 : jsonEndIdx + 1;
        let parsedLineup = null;
        try {
            parsedLineup = JSON.parse(jsonStr);
        } catch {
            // Ignore malformed JSON silently
        }
        const lineupTag = normalized.substring(tagStartIdx, tagCloseIdx);
        const cleanNotes = (normalized.substring(0, tagStartIdx) + normalized.substring(tagCloseIdx)).trim();
        return { parsedLineup, lineupTag, cleanNotes, normalizedRawNotes: normalized, wasRepaired };
    }

    return { parsedLineup: null, lineupTag: "", cleanNotes: normalized, normalizedRawNotes: normalized, wasRepaired };
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

export interface LineupPlayerParticipation {
    participationType: "STARTER" | "SUB" | "UNUSED_SUB";
    minutesPlayed: number;
    subEvents: { type: "on" | "off"; minute: number }[];
    goals: number;
    assists: number;
    yellowCards: number;
    redCards: number;
}

/**
 * Computes accurate player participation (`STARTER`, `SUB`, `UNUSED_SUB`) and `minutesPlayed`
 * from a parsed `[Lineup: {...}]` JSON object (`starters`, `substitutes`, `usedSubstitutes`, `substitutions`, `matchEvents`).
 */
export function computeLineupParticipation(parsedLineup: any): Map<string, LineupPlayerParticipation> {
    const result = new Map<string, LineupPlayerParticipation>();
    if (!parsedLineup || typeof parsedLineup !== "object") return result;

    const isRealPlayerId = (id: any): id is string =>
        Boolean(id && typeof id === "string" && !id.startsWith("trialist-"));

    const starterSet = new Set<string>();
    const usedSubSet = new Set<string>();
    const benchSubSet = new Set<string>();

    if (parsedLineup.starters && typeof parsedLineup.starters === "object") {
        Object.values(parsedLineup.starters).forEach((id: any) => {
            if (isRealPlayerId(id)) starterSet.add(id);
        });
    }

    if (Array.isArray(parsedLineup.substitutes)) {
        parsedLineup.substitutes.forEach((id: any) => {
            if (isRealPlayerId(id) && !starterSet.has(id)) benchSubSet.add(id);
        });
    }

    if (Array.isArray(parsedLineup.usedSubstitutes)) {
        parsedLineup.usedSubstitutes.forEach((id: any) => {
            if (isRealPlayerId(id) && !starterSet.has(id)) {
                usedSubSet.add(id);
                benchSubSet.add(id);
            }
        });
    }

    // Also treat any player with a substitution record (`subId`) as a used substitute
    const rawSubs: any[] = Array.isArray(parsedLineup.substitutions) ? parsedLineup.substitutions : [];
    rawSubs.forEach((sub: any) => {
        if (isRealPlayerId(sub?.subId) && !starterSet.has(sub.subId)) {
            usedSubSet.add(sub.subId);
            benchSubSet.add(sub.subId);
        }
    });

    // Also treat any bench player who recorded a goal, assist, yellow card, or red card in matchEvents as a used substitute
    const matchEvents = parsedLineup.matchEvents || {};
    Object.entries(matchEvents).forEach(([pid, ev]: [string, any]) => {
        if (!isRealPlayerId(pid) || starterSet.has(pid)) return;
        const hasEvent =
            (Number(ev?.goals) || 0) > 0 ||
            (Number(ev?.assists) || 0) > 0 ||
            (Number(ev?.yellowCards) || 0) > 0 ||
            (Number(ev?.redCards) || 0) > 0;
        if (hasEvent) {
            usedSubSet.add(pid);
            benchSubSet.add(pid);
        }
    });

    // Calculate minutes played using a chronological substitution timeline
    const matchDuration = Number(parsedLineup.matchDurationMinutes) > 0 ? Number(parsedLineup.matchDurationMinutes) : 90;
    const defaultSubMin = Math.round((matchDuration * 2) / 3);
    const defaultSubPlayed = Math.max(10, matchDuration - defaultSubMin);
    const minutesMap = new Map<string, number>();
    const onPitchSince = new Map<string, number>();
    const subEventsMap = new Map<string, { type: "on" | "off"; minute: number }[]>();

    starterSet.forEach((id) => {
        onPitchSince.set(id, 0);
        minutesMap.set(id, 0);
        subEventsMap.set(id, []);
    });

    usedSubSet.forEach((id) => {
        minutesMap.set(id, 0);
        subEventsMap.set(id, []);
    });

    const sortedSubs = [...rawSubs]
        .filter((sub) => sub && sub.subId)
        .sort((a, b) => (Number(a.minute) || defaultSubMin) - (Number(b.minute) || defaultSubMin));

    sortedSubs.forEach((sub) => {
        const subMin = Number(sub.minute) || defaultSubMin;

        if (isRealPlayerId(sub.replacedId) && onPitchSince.has(sub.replacedId)) {
            const startedAt = onPitchSince.get(sub.replacedId)!;
            const played = Math.max(0, subMin - startedAt);
            minutesMap.set(sub.replacedId, (minutesMap.get(sub.replacedId) || 0) + played);
            onPitchSince.delete(sub.replacedId);
            const evs = subEventsMap.get(sub.replacedId) || [];
            evs.push({ type: "off", minute: subMin });
            subEventsMap.set(sub.replacedId, evs);
        }

        if (isRealPlayerId(sub.subId)) {
            if (!minutesMap.has(sub.subId)) minutesMap.set(sub.subId, 0);
            onPitchSince.set(sub.subId, subMin);
            const evs = subEventsMap.get(sub.subId) || [];
            evs.push({ type: "on", minute: subMin });
            subEventsMap.set(sub.subId, evs);
        }
    });

    onPitchSince.forEach((startedAt, id) => {
        const played = startedAt > 0 ? Math.max(1, matchDuration - startedAt) : Math.max(0, matchDuration - startedAt);
        minutesMap.set(id, (minutesMap.get(id) || 0) + played);
    });

    sortedSubs.forEach((sub) => {
        if (isRealPlayerId(sub.subId) && typeof sub.customMinutesPlayed === "number") {
            minutesMap.set(sub.subId, Math.max(1, sub.customMinutesPlayed));
        }
    });

    usedSubSet.forEach((id) => {
        if ((minutesMap.get(id) || 0) === 0) {
            const hasSubRecord = sortedSubs.some((s) => s.subId === id);
            if (!hasSubRecord) {
                minutesMap.set(id, defaultSubPlayed);
            }
        }
    });

    starterSet.forEach((id) => {
        const ev = matchEvents[id] || {};
        result.set(id, {
            participationType: "STARTER",
            minutesPlayed: minutesMap.get(id) ?? matchDuration,
            subEvents: subEventsMap.get(id) || [],
            goals: Number(ev.goals) || 0,
            assists: Number(ev.assists) || 0,
            yellowCards: Number(ev.yellowCards) || 0,
            redCards: Number(ev.redCards) || 0,
        });
    });

    usedSubSet.forEach((id) => {
        const ev = matchEvents[id] || {};
        result.set(id, {
            participationType: "SUB",
            minutesPlayed: minutesMap.get(id) ?? defaultSubPlayed,
            subEvents: subEventsMap.get(id) || [],
            goals: Number(ev.goals) || 0,
            assists: Number(ev.assists) || 0,
            yellowCards: Number(ev.yellowCards) || 0,
            redCards: Number(ev.redCards) || 0,
        });
    });

    benchSubSet.forEach((id) => {
        if (starterSet.has(id) || usedSubSet.has(id)) return;
        const ev = matchEvents[id] || {};
        result.set(id, {
            participationType: "UNUSED_SUB",
            minutesPlayed: 0,
            subEvents: [],
            goals: Number(ev.goals) || 0,
            assists: Number(ev.assists) || 0,
            yellowCards: Number(ev.yellowCards) || 0,
            redCards: Number(ev.redCards) || 0,
        });
    });

    return result;
}

