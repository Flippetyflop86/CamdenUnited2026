"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, MapPin, Share2, Users, FileText, Settings, Trash2, Trophy, CheckCircle2, Circle } from "lucide-react";
import Link from "next/link";
import { Match } from "@/types";
import { useClub } from "@/context/club-context";

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

    // Attempt to find opponent in league table for context
    const oppLower = (match.opponent || "").toLowerCase();
    const opponentStats = oppLower
        ? leagueTeams.find((t) => {
              const tName = (t.team_name || t.name || "").toLowerCase();
              return tName && (tName.includes(oppLower) || oppLower.includes(tName));
          })
        : undefined;

    const isSquadConfirmed = Boolean(
        match.is_squad_confirmed ||
        (match.lineup && Object.values(match.lineup.starters || {}).some(Boolean)) ||
        match.notes?.includes("[Lineup: ")
    );

    return (
        <Card className="border-border bg-surface-1 overflow-hidden shadow-lg border-l-4 border-l-brand">
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
                                <span className={isHome ? "text-foreground" : "text-muted-foreground"}>{homeTeam}</span>
                                <span className="text-muted-foreground font-light text-xl">vs</span>
                                <span className={!isHome ? "text-foreground" : "text-muted-foreground"}>{awayTeam}</span>
                            </h1>
                        </div>

                        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground pt-1">
                            <div className="flex items-center gap-1.5">
                                <Calendar className="h-4 w-4 text-muted-foreground/70" />
                                <span>{formattedDate}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <Clock className="h-4 w-4 text-muted-foreground/70" />
                                <span>KO {(match.time || "14:00").slice(0, 5)}</span>
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

                        {opponentStats && (
                            <div className="inline-flex items-center gap-3 px-3 py-1.5 rounded-md bg-surface-2 text-xs font-medium text-muted-foreground border border-border">
                                <span>Opposition Info:</span>
                                <span className="text-foreground">Pos: #{opponentStats.position}</span>
                                <span>•</span>
                                <span className="text-foreground">Pts: {opponentStats.points}</span>
                                <span>•</span>
                                <span className="text-foreground">GD: {opponentStats.goal_difference > 0 ? `+${opponentStats.goal_difference}` : opponentStats.goal_difference}</span>
                            </div>
                        )}
                    </div>

                    {/* Right: Actions (#6) */}
                    <div className="flex flex-wrap items-center gap-2 lg:justify-end shrink-0">
                        <Button asChild size="sm" className="bg-brand hover:bg-brand/90 text-brand-foreground font-semibold">
                            <Link href={`/matchday-xi?match=${match.id}`}>
                                <Users className="h-4 w-4 mr-1.5" />
                                Matchday XI
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
    );
}
