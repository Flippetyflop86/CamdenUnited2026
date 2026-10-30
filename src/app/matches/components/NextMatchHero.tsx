"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, MapPin, Share2, Users, FileText, Settings, Trash2, Trophy, CheckCircle2, Circle } from "lucide-react";
import Link from "next/link";
import { Match } from "@/types";
import { useClub } from "@/context/club-context";
import { resolveFixtureKickoffTime } from "@/lib/whatsapp-utils";

interface NextMatchHeroProps {
    match: Match | null;
    leagueTeams: any[];
    onManageMatch: (match: Match) => void;
    onShareMatch: (match: Match) => void;
    onDeleteMatch?: (matchId: string) => void;
    onQuickLogResult?: (match: Match) => void;
}

export function NextMatchHero({
    match,
    leagueTeams,
    onManageMatch,
    onShareMatch,
    onDeleteMatch,
    onQuickLogResult
}: NextMatchHeroProps) {
    const { settings } = useClub();

    if (!match) {
        return null;
    }

    const matchDate = new Date(match.date);
    const formattedDate = new Intl.DateTimeFormat("en-GB", {
        weekday: "short",
        day: "numeric",
        month: "short",
    }).format(matchDate);

    const isHome = match.isHome !== undefined ? match.isHome : (match as any).is_home;
    const homeTeam = isHome ? settings.name : match.opponent;
    const awayTeam = !isHome ? settings.name : match.opponent;

    // Fix "Away - Away (4G)" duplicate location display (#8)
    const rawLoc = (match.location || "").trim();
    const sideLabel = isHome ? "Home" : "Away";
    let displayLocation = sideLabel;
    if (rawLoc) {
        if (rawLoc.toLowerCase().startsWith(sideLabel.toLowerCase())) {
            displayLocation = rawLoc;
        } else {
            displayLocation = `${sideLabel} · ${rawLoc}`;
        }
    }

    // Normalize team names (strip FC/AFC/First/1st/Reserves, normalize Utd->United) so opponents match the synced League Table
    const normalizeTeamKey = (name: string): string =>
        (name || "")
            .toLowerCase()
            .replace(/\b(fc|afc|first|1st|reserves|united|utd)\b/g, (m) =>
                m === "utd" ? "united" : m === "fc" || m === "afc" || m === "first" || m === "1st" || m === "reserves" ? "" : m
            )
            .replace(/[^a-z0-9]/g, "")
            .trim();

    const isMatchingTeam = (a: string, b: string): boolean => {
        if (!a || !b) return false;
        const cleanA = a.toLowerCase().trim();
        const cleanB = b.toLowerCase().trim();
        if (cleanA === cleanB) return true;
        const normA = normalizeTeamKey(a);
        const normB = normalizeTeamKey(b);
        return normA.length >= 3 && normB.length >= 3 && (normA === normB || normA.includes(normB) || normB.includes(normA));
    };

    const isLeagueCompetition = !(match.competition || "League").toLowerCase().match(/cup|trophy|shield|friendly/);

    // Attempt to find opponent and our club in league table for context
    const opponentStats = match.opponent
        ? leagueTeams.find((t) => isMatchingTeam(t.team_name || t.name || "", match.opponent))
        : undefined;

    const ourClubStats = leagueTeams.find(
        (t) => t.is_our_club || isMatchingTeam(t.team_name || t.name || "", settings.name || "ClubFlow")
    );
    const ourPos = ourClubStats?.position || settings.leaguePosition || null;
    const oppPos = opponentStats?.position || null;

    const isSquadConfirmed = Boolean(
        match.is_squad_confirmed ||
        (match.lineup && Object.values(match.lineup.starters || {}).some(Boolean)) ||
        match.notes?.includes("[Lineup: ")
    );

    return (
        <>
            {/* =================================================================
                MOBILE NEXT MATCH HERO (< 768px)
               ================================================================= */}
            <Card className="md:hidden border-border bg-surface-1 overflow-hidden shadow-md border-l-4 border-l-brand">
                <div className="p-3.5 space-y-3">
                    {/* Top Bar: Badges + Edit/Delete */}
                    <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                            <span className="bg-brand text-brand-foreground text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded">
                                Next Match
                            </span>
                            <span className="text-[11px] font-bold text-brand truncate">
                                {match.competition || "League"}
                            </span>
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold uppercase border ${
                                isHome
                                    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                                    : "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30"
                            }`}>
                                {isHome ? "HOME" : "AWAY"}
                            </span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                            <button
                                type="button"
                                onClick={() => onShareMatch(match)}
                                className="h-7 w-7 rounded-lg bg-surface-2 border border-border flex items-center justify-center text-muted-foreground hover:text-foreground"
                                title="Share Availability Poll"
                            >
                                <Share2 className="h-3.5 w-3.5" />
                            </button>
                            <button
                                type="button"
                                onClick={() => onManageMatch(match)}
                                className="h-7 w-7 rounded-lg bg-surface-2 border border-border flex items-center justify-center text-muted-foreground hover:text-foreground"
                                title="Edit Match"
                            >
                                <Settings className="h-3.5 w-3.5" />
                            </button>
                            {onDeleteMatch && (
                                <button
                                    type="button"
                                    onClick={() => onDeleteMatch(match.id)}
                                    className="h-7 w-7 rounded-lg bg-surface-2 border border-border flex items-center justify-center text-rose-500 hover:bg-rose-500/10"
                                    title="Delete Match"
                                >
                                    <Trash2 className="h-3.5 w-3.5" />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Horizontal Matchup Banner */}
                    <div className="bg-surface-2/60 border border-border rounded-xl p-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                        <div className="text-right min-w-0">
                            <p className={`text-sm font-extrabold leading-tight truncate ${isHome ? "text-foreground" : "text-muted-foreground"}`}>
                                {homeTeam}
                            </p>
                            <div className="flex items-center justify-end gap-1 mt-0.5">
                                {isLeagueCompetition && (isHome ? ourPos : oppPos) && (
                                    <span className="px-1.5 py-0.2 rounded bg-brand/15 text-brand border border-brand/30 text-[9px] font-black tabular-nums">
                                        #{isHome ? ourPos : oppPos}
                                    </span>
                                )}
                                <span className="text-[10px] text-muted-foreground font-semibold uppercase">Home</span>
                            </div>
                        </div>
                        <div className="px-2.5 py-1 rounded-lg bg-background border border-border text-center shrink-0">
                            <span className="text-xs font-black text-brand uppercase tracking-wider">
                                {resolveFixtureKickoffTime(match.date, match.time)}
                            </span>
                        </div>
                        <div className="text-left min-w-0">
                            <p className={`text-sm font-extrabold leading-tight truncate ${!isHome ? "text-foreground" : "text-muted-foreground"}`}>
                                {awayTeam}
                            </p>
                            <div className="flex items-center justify-start gap-1 mt-0.5">
                                <span className="text-[10px] text-muted-foreground font-semibold uppercase">Away</span>
                                {isLeagueCompetition && (!isHome ? ourPos : oppPos) && (
                                    <span className="px-1.5 py-0.2 rounded bg-brand/15 text-brand border border-brand/30 text-[9px] font-black tabular-nums">
                                        #{!isHome ? ourPos : oppPos}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Metadata Strip */}
                    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <div className="flex items-center gap-3 flex-wrap">
                            <span className="inline-flex items-center gap-1 font-semibold text-foreground">
                                <Calendar className="h-3.5 w-3.5 text-brand shrink-0" />
                                {formattedDate}
                            </span>
                            {(match as any).meetTime && (
                                <span className="inline-flex items-center gap-1 font-bold text-amber-700 dark:text-amber-400">
                                    <Clock className="h-3.5 w-3.5 shrink-0" />
                                    Meet {(match as any).meetTime}
                                </span>
                            )}
                            <span className="inline-flex items-center gap-1 truncate max-w-[200px]">
                                <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                <span className="truncate">{displayLocation}</span>
                            </span>
                        </div>

                        {opponentStats && opponentStats.points !== undefined && (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-surface-2 border border-border text-[10px] font-bold text-foreground">
                                <span>Opp: {opponentStats.points}pts</span>
                                {opponentStats.goal_difference !== undefined && (
                                    <>
                                        <span className="text-muted-foreground">•</span>
                                        <span>GD {opponentStats.goal_difference > 0 ? `+${opponentStats.goal_difference}` : opponentStats.goal_difference}</span>
                                    </>
                                )}
                            </span>
                        )}
                    </div>

                    {/* Primary Mobile CTA Row */}
                    <div className="grid grid-cols-3 gap-1.5 pt-0.5">
                        <Button asChild size="sm" className="h-9 bg-brand hover:bg-brand/90 text-brand-foreground font-bold text-xs w-full px-2">
                            <Link href={`/matchday-xi?match=${match.id}`}>
                                <Users className="h-3.5 w-3.5 mr-1 shrink-0" />
                                <span className="truncate">Matchday Planner</span>
                            </Link>
                        </Button>
                        <Button asChild size="sm" variant="outline" className="h-9 bg-surface-2 hover:bg-surface-2/80 text-foreground border-border font-bold text-xs w-full px-2">
                            <Link href={`/opposition?team=${encodeURIComponent(match.opponent)}`}>
                                <FileText className="h-3.5 w-3.5 mr-1 text-brand shrink-0" />
                                <span className="truncate">Scout Report</span>
                            </Link>
                        </Button>
                        {onQuickLogResult ? (
                            <Button
                                size="sm"
                                variant="secondary"
                                className="h-9 bg-emerald-100/90 dark:bg-emerald-500/15 hover:bg-emerald-200/80 dark:hover:bg-emerald-500/25 text-emerald-800 dark:text-emerald-300 border border-emerald-400/70 dark:border-emerald-500/30 font-bold text-xs w-full px-2"
                                onClick={() => onQuickLogResult(match)}
                            >
                                <Trophy className="h-3.5 w-3.5 mr-1 shrink-0" />
                                <span className="truncate">Log Result</span>
                            </Button>
                        ) : (
                            <Button
                                size="sm"
                                variant="outline"
                                className="h-9 text-xs font-bold w-full border-border px-2"
                                onClick={() => onShareMatch(match)}
                            >
                                <Share2 className="h-3.5 w-3.5 mr-1 shrink-0" />
                                <span className="truncate">Poll</span>
                            </Button>
                        )}
                    </div>
                </div>
            </Card>

            {/* =================================================================
                DESKTOP NEXT MATCH HERO (>= 768px) — UNTOUCHED
               ================================================================= */}
            <Card className="hidden md:block border-border bg-surface-1 overflow-hidden shadow-lg border-l-4 border-l-brand">
            <div className="p-6 md:p-7">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    {/* Left: Metadata & Teams */}
                    <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold tracking-wider text-brand uppercase">
                            <span className="bg-brand/15 px-2 py-0.5 rounded border border-brand/30">Next Match</span>
                            <span>•</span>
                            <span>{match.competition || "League"}</span>
                            <span className="px-2 py-0.5 rounded bg-surface-2 text-muted-foreground border border-border">
                                {isHome ? "HOME" : "AWAY"}
                            </span>
                        </div>

                        <div className="space-y-1">
                            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground flex flex-wrap items-center gap-x-3 gap-y-1">
                                <span className={`inline-flex items-center gap-2 ${isHome ? "text-foreground" : "text-muted-foreground"}`}>
                                    {homeTeam}
                                    {isLeagueCompetition && (isHome ? ourPos : oppPos) && (
                                        <span className="text-xs font-extrabold px-2 py-0.5 rounded-md bg-brand/15 text-brand border border-brand/30 tabular-nums">
                                            #{isHome ? ourPos : oppPos}
                                        </span>
                                    )}
                                </span>
                                <span className="text-muted-foreground font-light text-xl">vs</span>
                                <span className={`inline-flex items-center gap-2 ${!isHome ? "text-foreground" : "text-muted-foreground"}`}>
                                    {awayTeam}
                                    {isLeagueCompetition && (!isHome ? ourPos : oppPos) && (
                                        <span className="text-xs font-extrabold px-2 py-0.5 rounded-md bg-brand/15 text-brand border border-brand/30 tabular-nums">
                                            #{!isHome ? ourPos : oppPos}
                                        </span>
                                    )}
                                </span>
                            </h1>
                        </div>

                        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground pt-1">
                            <div className="flex items-center gap-1.5">
                                <Calendar className="h-4 w-4 text-muted-foreground/70" />
                                <span>{formattedDate}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <Clock className="h-4 w-4 text-muted-foreground/70" />
                                <span>KO {resolveFixtureKickoffTime(match.date, match.time)}</span>
                                {(match as any).meetTime && (
                                    <span className="text-amber-700 dark:text-amber-400 font-semibold ml-1">
                                        • Meet {(match as any).meetTime}
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-1.5">
                                <MapPin className="h-4 w-4 text-muted-foreground/70" />
                                <span>{displayLocation}</span>
                            </div>
                        </div>

                        {opponentStats && opponentStats.points !== undefined && (
                            <div className="inline-flex items-center gap-3 px-3 py-1.5 rounded-md bg-surface-2 text-xs font-medium text-muted-foreground border border-border">
                                <span>Opposition Info:</span>
                                <span className="text-foreground">Pts: {opponentStats.points}</span>
                                {opponentStats.goal_difference !== undefined && (
                                    <>
                                        <span>•</span>
                                        <span className="text-foreground">GD: {opponentStats.goal_difference > 0 ? `+${opponentStats.goal_difference}` : opponentStats.goal_difference}</span>
                                    </>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Right: Actions (#6) */}
                    <div className="flex flex-wrap items-center gap-2 lg:justify-end shrink-0">
                        <Button asChild size="sm" className="bg-brand hover:bg-brand/90 text-brand-foreground font-semibold">
                            <Link href={`/matchday-xi?match=${match.id}`}>
                                <Users className="h-4 w-4 mr-1.5" />
                                Matchday Planner
                            </Link>
                        </Button>

                        <Button
                            asChild
                            size="sm"
                            variant="secondary"
                            className="bg-surface-2 hover:bg-surface-2/80 text-foreground border border-border font-semibold"
                        >
                            <Link href={`/opposition?team=${encodeURIComponent(match.opponent)}`}>
                                <FileText className="h-3.5 w-3.5 mr-1.5 text-brand" />
                                Scouting Report
                            </Link>
                        </Button>

                        {onQuickLogResult && (
                            <Button
                                size="sm"
                                variant="secondary"
                                className="bg-emerald-100/90 dark:bg-emerald-500/15 hover:bg-emerald-200/80 dark:hover:bg-emerald-500/25 text-emerald-800 dark:text-emerald-300 border border-emerald-400/70 dark:border-emerald-500/30 font-bold"
                                onClick={() => onQuickLogResult(match)}
                            >
                                <Trophy className="h-3.5 w-3.5 mr-1.5" />
                                Log Result / Scorers
                            </Button>
                        )}

                        <Button
                            size="sm"
                            variant="secondary"
                            className="bg-surface-2 hover:bg-surface-2/80 text-foreground border border-border"
                            onClick={() => onManageMatch(match)}
                        >
                            <Settings className="h-3.5 w-3.5 mr-1.5" />
                            Edit
                        </Button>

                        {onDeleteMatch && (
                            <Button
                                size="sm"
                                variant="ghost"
                                className="text-rose-500 hover:text-rose-400 hover:bg-rose-500/15 px-2.5"
                                onClick={() => onDeleteMatch(match.id)}
                                title="Delete this fixture"
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </Card>
        </>
    );
}
