"use client";

import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Plus, Minus, Trophy, CheckCircle2, AlertTriangle, RefreshCw, Users } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Match } from "@/types";
import {
    SimplePlayerRef,
    parseStatTextString,
    syncMatchGoalsAndAssistsEverywhere,
    ensureStatsHydratedFromMatchText,
    extractLineupFromRawNotes
} from "@/lib/match-stats-sync";
import Link from "next/link";

interface QuickResultScorersModalProps {
    match: Match | null;
    clubName: string;
    isOpen: boolean;
    onClose: () => void;
    onSaved: () => void;
}

export function QuickResultScorersModal({
    match,
    clubName,
    isOpen,
    onClose,
    onSaved
}: QuickResultScorersModalProps) {
    const [homeGoals, setHomeGoals] = useState<string>("");
    const [awayGoals, setAwayGoals] = useState<string>("");
    const [players, setPlayers] = useState<SimplePlayerRef[]>([]);
    const [playerGoals, setPlayerGoals] = useState<Record<string, number>>({});
    const [playerAssists, setPlayerAssists] = useState<Record<string, number>>({});
    const [ownGoals, setOwnGoals] = useState<number>(0);
    const [extraManualGoals, setExtraManualGoals] = useState<{ rawName: string; count: number }[]>([]);
    const [extraManualAssists, setExtraManualAssists] = useState<{ rawName: string; count: number }[]>([]);
    const [lineupIds, setLineupIds] = useState<{ starters: Set<string>; subs: Set<string>; starterOrder: string[] }>({
        starters: new Set(),
        subs: new Set(),
        starterOrder: []
    });
    const [search, setSearch] = useState("");
    const [filterTab, setFilterTab] = useState<"active" | "all">("active");
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (!isOpen || !match) return;
        loadMatchAndStats(match);
    }, [isOpen, match?.id]);

    const loadMatchAndStats = async (m: Match) => {
        setIsLoading(true);
        setSearch("");

        // Fetch fresh match row from DB so we always have raw `notes`, `scoreline`, `goalscorers`, `assists`
        const { data: freshMatch } = await supabase
            .from("matches")
            .select("notes, scoreline, result, goalscorers, assists, club_id")
            .eq("id", m.id)
            .single();

        // Parse existing scoreline
        const rawScore = freshMatch?.scoreline || m.scoreline || (m.result && m.result.includes("-") ? m.result : "");
        if (rawScore && rawScore.includes("-")) {
            const parts = rawScore.split("-").map((s: string) => s.trim());
            setHomeGoals(parts[0] ?? "");
            setAwayGoals(parts[1] ?? "");
        } else {
            setHomeGoals("");
            setAwayGoals("");
        }

        // Extract lineup starters & subs from freshMatch.notes or m.rawNotes or m.lineup
        const starterSet = new Set<string>();
        const subSet = new Set<string>();
        const starterOrder: string[] = [];

        const rawNotesStr = freshMatch?.notes || (m as any).rawNotes || m.notes || "";
        const extracted = extractLineupFromRawNotes(rawNotesStr);
        if (extracted.wasRepaired && extracted.normalizedRawNotes) {
            await supabase.from("matches").update({ notes: extracted.normalizedRawNotes }).eq("id", m.id);
        }

        const parsedLineup = extracted.parsedLineup || m.lineup;
        if (parsedLineup) {
            Object.keys(parsedLineup.starters || {})
                .sort((a, b) => Number(a) - Number(b))
                .forEach((slotKey) => {
                    const id = parsedLineup.starters?.[slotKey];
                    if (id && typeof id === "string" && !id.startsWith("trialist-")) {
                        starterSet.add(id);
                        starterOrder.push(id);
                    }
                });
            (parsedLineup.substitutes || []).forEach((id: any) => {
                if (id && typeof id === "string" && !id.startsWith("trialist-")) subSet.add(id);
            });
            (parsedLineup.usedSubstitutes || []).forEach((id: any) => {
                if (id && typeof id === "string" && !id.startsWith("trialist-") && !starterSet.has(id)) subSet.add(id);
            });
        }
        setLineupIds({ starters: starterSet, subs: subSet, starterOrder });

        // Load players (filtered by club_id if present)
        let pQuery = supabase
            .from("players")
            .select("id, first_name, last_name, position, squad, nickname, use_nickname")
            .order("last_name");
        const clubIdToUse = freshMatch?.club_id || (m as any).club_id;
        if (clubIdToUse) {
            pQuery = pQuery.eq("club_id", clubIdToUse);
        }
        const { data: pData } = await pQuery;
        const pList: SimplePlayerRef[] = pData || [];
        setPlayers(pList);

        const goalscorersText = freshMatch?.goalscorers ?? m.goalscorers;
        const assistsText = freshMatch?.assists ?? m.assists;

        // Ensure any text-logged goals/assists from earlier in the season are hydrated into match_player_stats
        await ensureStatsHydratedFromMatchText(m.id, goalscorersText, assistsText, pList);

        // Fetch match_player_stats
        const { data: sData } = await supabase
            .from("match_player_stats")
            .select("*")
            .eq("match_id", m.id);

        const gMap: Record<string, number> = {};
        const aMap: Record<string, number> = {};
        (sData || []).forEach((row: any) => {
            if (row.player_id && (Number(row.goals) || 0) > 0) {
                gMap[row.player_id] = Number(row.goals);
            }
            if (row.player_id && (Number(row.assists) || 0) > 0) {
                aMap[row.player_id] = Number(row.assists);
            }
        });

        // Check for manual/unmatched tokens (e.g. "Own Goal")
        const parsedGoalTokens = parseStatTextString(goalscorersText, pList);
        const parsedAssistTokens = parseStatTextString(assistsText, pList);

        let ogCount = 0;
        const otherManualGoals: { rawName: string; count: number }[] = [];
        parsedGoalTokens.filter(t => !t.playerId).forEach(t => {
            if (/^(og|own goal)$/i.test(t.rawName.trim())) {
                ogCount += t.count;
            } else {
                otherManualGoals.push({ rawName: t.rawName, count: t.count });
            }
        });

        setOwnGoals(ogCount);
        setExtraManualGoals(otherManualGoals);
        setExtraManualAssists(parsedAssistTokens.filter(t => !t.playerId).map(t => ({ rawName: t.rawName, count: t.count })));
        setPlayerGoals(gMap);
        setPlayerAssists(aMap);
        // Always open on Matchday XI & Subs tab first
        setFilterTab("active");
        setIsLoading(false);
    };

    const isHome = match ? (match.isHome !== undefined ? match.isHome : (match as any).is_home) : true;
    const homeTeamName = isHome ? clubName : (match?.opponent || "Opponent");
    const awayTeamName = !isHome ? clubName : (match?.opponent || "Opponent");

    const clubExpectedGoals = useMemo(() => {
        const h = parseInt(homeGoals, 10);
        const a = parseInt(awayGoals, 10);
        if (isNaN(h) || isNaN(a)) return null;
        return isHome ? h : a;
    }, [homeGoals, awayGoals, isHome]);

    const totalAssignedGoals = useMemo(() => {
        const fromPlayers = Object.values(playerGoals).reduce((acc, v) => acc + (v || 0), 0);
        const fromManual = extraManualGoals.reduce((acc, m) => acc + (m.count || 0), 0);
        return fromPlayers + ownGoals + fromManual;
    }, [playerGoals, ownGoals, extraManualGoals]);

    const totalAssignedAssists = useMemo(() => {
        const fromPlayers = Object.values(playerAssists).reduce((acc, v) => acc + (v || 0), 0);
        const fromManual = extraManualAssists.reduce((acc, m) => acc + (m.count || 0), 0);
        return fromPlayers + fromManual;
    }, [playerAssists, extraManualAssists]);

    const adjustPlayerStat = (playerId: string, type: "goals" | "assists", delta: number) => {
        if (type === "goals") {
            setPlayerGoals(prev => {
                const nextVal = Math.max(0, (prev[playerId] || 0) + delta);
                const copy = { ...prev };
                if (nextVal === 0) delete copy[playerId];
                else copy[playerId] = nextVal;
                return copy;
            });
        } else {
            setPlayerAssists(prev => {
                const nextVal = Math.max(0, (prev[playerId] || 0) + delta);
                const copy = { ...prev };
                if (nextVal === 0) delete copy[playerId];
                else copy[playerId] = nextVal;
                return copy;
            });
        }
    };

    const matchdaySquadCount = useMemo(() => {
        const ids = new Set<string>([...lineupIds.starters, ...lineupIds.subs, ...Object.keys(playerGoals), ...Object.keys(playerAssists)]);
        return ids.size;
    }, [lineupIds, playerGoals, playerAssists]);

    const sortedFilteredPlayers = useMemo(() => {
        return players
            .filter(p => {
                const fullName = `${p.first_name || ""} ${p.last_name || ""} ${p.nickname || ""}`.toLowerCase();
                if (search.trim()) {
                    return fullName.includes(search.trim().toLowerCase());
                }
                if (filterTab === "active") {
                    const hasStat = (playerGoals[p.id] || 0) > 0 || (playerAssists[p.id] || 0) > 0;
                    const inLineup = lineupIds.starters.has(p.id) || lineupIds.subs.has(p.id);
                    return hasStat || inLineup;
                }
                return true;
            })
            .sort((a, b) => {
                // Sort Starters first (in formation slot order), then Subs, then others
                const aIsStarter = lineupIds.starters.has(a.id);
                const bIsStarter = lineupIds.starters.has(b.id);
                if (aIsStarter && !bIsStarter) return -1;
                if (!aIsStarter && bIsStarter) return 1;
                if (aIsStarter && bIsStarter) {
                    return lineupIds.starterOrder.indexOf(a.id) - lineupIds.starterOrder.indexOf(b.id);
                }
                const aIsSub = lineupIds.subs.has(a.id);
                const bIsSub = lineupIds.subs.has(b.id);
                if (aIsSub && !bIsSub) return -1;
                if (!aIsSub && bIsSub) return 1;
                return (a.last_name || "").localeCompare(b.last_name || "");
            });
    }, [players, search, filterTab, playerGoals, playerAssists, lineupIds]);

    const handleSaveAll = async () => {
        if (!match) return;
        setIsSaving(true);
        try {
            const hTrim = homeGoals.trim();
            const aTrim = awayGoals.trim();
            const newScoreline = (hTrim !== "" && aTrim !== "") ? `${hTrim} - ${aTrim}` : "";

            // Fetch existing match_player_stats for this match
            const { data: existingRows } = await supabase
                .from("match_player_stats")
                .select("*")
                .eq("match_id", match.id);

            const rows = existingRows || [];
            const allPlayerIdsToTouch = new Set<string>([
                ...rows.map((r: any) => r.player_id),
                ...Object.keys(playerGoals),
                ...Object.keys(playerAssists)
            ]);

            for (const pid of allPlayerIdsToTouch) {
                if (!pid) continue;
                const g = playerGoals[pid] || 0;
                const a = playerAssists[pid] || 0;
                const existing = rows.find((r: any) => r.player_id === pid);

                if (existing) {
                    await supabase
                        .from("match_player_stats")
                        .update({ goals: g, assists: a })
                        .eq("id", existing.id);
                } else if (g > 0 || a > 0) {
                    const isSub = lineupIds.subs.has(pid) && !lineupIds.starters.has(pid);
                    await supabase
                        .from("match_player_stats")
                        .insert([{
                            match_id: match.id,
                            player_id: pid,
                            goals: g,
                            assists: a,
                            yellow_cards: 0,
                            red_cards: 0,
                            minutes_played: isSub ? 30 : 90,
                            participation_type: isSub ? "SUB" : "STARTER"
                        }]);
                }
            }

            const manualGoalsToSave = [...extraManualGoals];
            if (ownGoals > 0) {
                manualGoalsToSave.push({ rawName: "Own Goal", count: ownGoals });
            }

            await syncMatchGoalsAndAssistsEverywhere(match.id, {
                overrideScoreline: newScoreline,
                manualGoalTokens: manualGoalsToSave,
                manualAssistTokens: extraManualAssists
            });

            onSaved();
            onClose();
        } catch (err: any) {
            alert("Failed to save result and scorers: " + err.message);
        } finally {
            setIsSaving(false);
        }
    };

    if (!match) return null;

    return (
        <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
            <DialogContent className="sm:max-w-[600px] bg-surface-1 border-border text-foreground max-h-[90vh] flex flex-col p-0 overflow-hidden">
                <DialogHeader className="p-5 pb-3 border-b border-border bg-surface-2/50">
                    <div className="flex items-center justify-between pr-6">
                        <DialogTitle className="text-lg font-bold flex items-center gap-2">
                            <Trophy className="h-5 w-5 text-emerald-500" />
                            Log Result, Goals & Assists
                        </DialogTitle>
                        <Button asChild variant="outline" size="sm" className="h-7 text-xs bg-surface-1 border-border">
                            <Link href={`/matchday-xi?match=${match.id}`}>
                                <Users className="h-3.5 w-3.5 mr-1.5 text-brand" /> Open Matchday XI
                            </Link>
                        </Button>
                    </div>
                    <DialogDescription className="text-xs text-muted-foreground">
                        Changes here automatically sync with <strong>Matchday XI</strong> and <strong>Squad Player Stats</strong>.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto p-5 space-y-5">
                    {/* 1. Scoreline Section */}
                    <div className="bg-surface-2 border border-border rounded-xl p-4 space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground"> Final Scoreline</span>
                            {(homeGoals !== "" || awayGoals !== "") && (
                                <button
                                    type="button"
                                    onClick={() => { setHomeGoals(""); setAwayGoals(""); }}
                                    className="text-[11px] text-amber-700 dark:text-amber-400 hover:underline font-semibold"
                                >
                                    Clear Score (Mark as Upcoming)
                                </button>
                            )}
                        </div>

                        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                            <div className="text-right">
                                <div className={`text-sm font-bold truncate ${isHome ? "text-emerald-700 dark:text-emerald-400" : "text-foreground"}`}>
                                    {homeTeamName}
                                </div>
                                <div className="text-[10px] text-muted-foreground uppercase">Home</div>
                            </div>

                            <div className="flex items-center gap-2">
                                <Input
                                    type="number"
                                    min={0}
                                    max={30}
                                    placeholder="-"
                                    value={homeGoals}
                                    onChange={(e) => setHomeGoals(e.target.value)}
                                    className="w-14 h-11 text-center text-lg font-black bg-surface-1 border-border"
                                />
                                <span className="text-muted-foreground font-bold text-lg">:</span>
                                <Input
                                    type="number"
                                    min={0}
                                    max={30}
                                    placeholder="-"
                                    value={awayGoals}
                                    onChange={(e) => setAwayGoals(e.target.value)}
                                    className="w-14 h-11 text-center text-lg font-black bg-surface-1 border-border"
                                />
                            </div>

                            <div className="text-left">
                                <div className={`text-sm font-bold truncate ${!isHome ? "text-emerald-700 dark:text-emerald-400" : "text-foreground"}`}>
                                    {awayTeamName}
                                </div>
                                <div className="text-[10px] text-muted-foreground uppercase">Away</div>
                            </div>
                        </div>

                        {/* Scoreline vs Logged Goals Validation (#20) */}
                        {clubExpectedGoals !== null && (
                            <div className={`flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-semibold border ${
                                totalAssignedGoals === clubExpectedGoals
                                    ? "bg-emerald-100/90 dark:bg-emerald-500/15 border-emerald-400/70 dark:border-emerald-500/30 text-emerald-900 dark:text-emerald-300"
                                    : "bg-amber-100 dark:bg-amber-500/15 border-amber-400 dark:border-amber-500/30 text-amber-900 dark:text-amber-300"
                            }`}>
                                <span className="flex items-center gap-1.5">
                                    {totalAssignedGoals === clubExpectedGoals ? (
                                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                                    ) : (
                                        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                                    )}
                                    <span>
                                        {clubName} Goals Assigned: <strong>{totalAssignedGoals} / {clubExpectedGoals}</strong>
                                    </span>
                                </span>
                                <span className="text-[11px] opacity-85">
                                    Assists Logged: <strong>{totalAssignedAssists}</strong>
                                </span>
                            </div>
                        )}
                    </div>

                    {/* 2. Scorers & Assists Picker */}
                    <div className="space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 bg-surface-2 p-1 rounded-lg border border-border">
                                <button
                                    type="button"
                                    onClick={() => setFilterTab("active")}
                                    className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors ${
                                        filterTab === "active"
                                            ? "bg-brand text-brand-foreground shadow-sm"
                                            : "text-muted-foreground hover:text-foreground"
                                    }`}
                                >
                                    Matchday XI &amp; Subs ({matchdaySquadCount})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setFilterTab("all")}
                                    className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors ${
                                        filterTab === "all"
                                            ? "bg-brand text-brand-foreground shadow-sm"
                                            : "text-muted-foreground hover:text-foreground"
                                    }`}
                                >
                                    Full Club Squad ({players.length})
                                </button>
                            </div>

                            <div className="relative flex-1 sm:max-w-[210px]">
                                <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
                                <Input
                                    placeholder="Search player..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="pl-8 h-8 text-xs bg-surface-2 border-border"
                                />
                            </div>
                        </div>

                        {isLoading ? (
                            <div className="py-10 text-center text-xs text-muted-foreground">Loading Matchday XI &amp; match stats...</div>
                        ) : (
                            <div className="border border-border rounded-xl divide-y divide-border max-h-[290px] overflow-y-auto bg-surface-2/30">
                                {sortedFilteredPlayers.length === 0 && filterTab === "active" && !search.trim() ? (
                                    <div className="p-6 text-center space-y-2.5">
                                        <p className="text-xs font-medium text-muted-foreground">
                                            No Matchday XI has been saved for this match yet.
                                        </p>
                                        <div className="flex items-center justify-center gap-2">
                                            <Button asChild size="sm" variant="outline" className="h-7 text-xs">
                                                <Link href={`/matchday-xi?match=${match.id}`}>
                                                    <Users className="h-3.5 w-3.5 mr-1.5 text-brand" />
                                                    Set Matchday XI First
                                                </Link>
                                            </Button>
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant="secondary"
                                                className="h-7 text-xs"
                                                onClick={() => setFilterTab("all")}
                                            >
                                                Or Pick From Full Squad
                                            </Button>
                                        </div>
                                    </div>
                                ) : null}
                                {sortedFilteredPlayers.map((p) => {
                                    const g = playerGoals[p.id] || 0;
                                    const a = playerAssists[p.id] || 0;
                                    const isStarter = lineupIds.starters.has(p.id);
                                    const isSub = lineupIds.subs.has(p.id);

                                    return (
                                        <div
                                            key={p.id}
                                            className={`flex items-center justify-between px-3.5 py-2.5 text-sm transition-colors ${
                                                g > 0 || a > 0 ? "bg-emerald-500/5" : "hover:bg-surface-2/60"
                                            }`}
                                        >
                                            <div className="flex items-center gap-2 min-w-0 pr-2">
                                                <span className="font-semibold text-foreground truncate">
                                                    {p.first_name} {p.last_name}
                                                </span>
                                                <span className="text-[10px] text-muted-foreground uppercase font-bold">{p.position}</span>
                                                {isStarter && (
                                                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-100/90 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-400/70 dark:border-emerald-500/30">
                                                        XI
                                                    </span>
                                                )}
                                                {!isStarter && isSub && (
                                                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-sky-100/90 dark:bg-sky-500/15 text-sky-800 dark:text-sky-300 border border-sky-400/70 dark:border-sky-500/30">
                                                        SUB
                                                    </span>
                                                )}
                                            </div>

                                            <div className="flex items-center gap-3 shrink-0">
                                                {/* Goals Stepper */}
                                                <div className="flex items-center gap-1">
                                                    <span className="text-[11px] text-muted-foreground mr-0.5">⚽</span>
                                                    <div className="flex items-center bg-surface-1 border border-border rounded-full overflow-hidden">
                                                        <button
                                                            type="button"
                                                            onClick={() => adjustPlayerStat(p.id, "goals", -1)}
                                                            className="px-2 py-1 hover:bg-surface-2 text-muted-foreground hover:text-foreground"
                                                        >
                                                            <Minus className="h-3 w-3" />
                                                        </button>
                                                        <span className={`w-6 text-center text-xs font-bold ${g > 0 ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground"}`}>
                                                            {g}
                                                        </span>
                                                        <button
                                                            type="button"
                                                            onClick={() => adjustPlayerStat(p.id, "goals", 1)}
                                                            className="px-2 py-1 hover:bg-surface-2 text-muted-foreground hover:text-foreground"
                                                        >
                                                            <Plus className="h-3 w-3" />
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Assists Stepper */}
                                                <div className="flex items-center gap-1">
                                                    <span className="text-[11px] text-muted-foreground mr-0.5">👟</span>
                                                    <div className="flex items-center bg-surface-1 border border-border rounded-full overflow-hidden">
                                                        <button
                                                            type="button"
                                                            onClick={() => adjustPlayerStat(p.id, "assists", -1)}
                                                            className="px-2 py-1 hover:bg-surface-2 text-muted-foreground hover:text-foreground"
                                                        >
                                                            <Minus className="h-3 w-3" />
                                                        </button>
                                                        <span className={`w-6 text-center text-xs font-bold ${a > 0 ? "text-sky-700 dark:text-sky-400" : "text-muted-foreground"}`}>
                                                            {a}
                                                        </span>
                                                        <button
                                                            type="button"
                                                            onClick={() => adjustPlayerStat(p.id, "assists", 1)}
                                                            className="px-2 py-1 hover:bg-surface-2 text-muted-foreground hover:text-foreground"
                                                        >
                                                            <Plus className="h-3 w-3" />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}

                                {/* Own Goal row */}
                                <div className="flex items-center justify-between px-3.5 py-2.5 text-sm bg-surface-2/40">
                                    <div className="flex items-center gap-2">
                                        <span className="font-semibold text-muted-foreground">Opposition Own Goal (OG)</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <span className="text-[11px] text-muted-foreground mr-0.5">⚽</span>
                                        <div className="flex items-center bg-surface-1 border border-border rounded-full overflow-hidden">
                                            <button
                                                type="button"
                                                onClick={() => setOwnGoals(v => Math.max(0, v - 1))}
                                                className="px-2 py-1 hover:bg-surface-2 text-muted-foreground hover:text-foreground"
                                            >
                                                <Minus className="h-3 w-3" />
                                            </button>
                                            <span className={`w-6 text-center text-xs font-bold ${ownGoals > 0 ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground"}`}>
                                                {ownGoals}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => setOwnGoals(v => v + 1)}
                                                className="px-2 py-1 hover:bg-surface-2 text-muted-foreground hover:text-foreground"
                                            >
                                                <Plus className="h-3 w-3" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <DialogFooter className="p-4 border-t border-border bg-surface-2/60 flex items-center justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
                    <Button
                        size="sm"
                        onClick={handleSaveAll}
                        disabled={isSaving}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                    >
                        {isSaving ? <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
                        Save Result & Sync Stats
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
