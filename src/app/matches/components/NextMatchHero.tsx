"use client";

import { Match } from "@/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, Clock, MapPin, Share2, Target, Settings, Activity, ShieldHalf } from "lucide-react";
import Link from "next/link";
import { useClub } from "@/context/club-context";

interface NextMatchHeroProps {
    match: Match;
    leagueTeams?: any[];
    onManageMatch: (match: Match) => void;
    onShareMatch: (match: Match) => void;
}

export function NextMatchHero({ match, leagueTeams = [], onManageMatch, onShareMatch }: NextMatchHeroProps) {
    const { settings } = useClub();
    
    const isHome = match.isHome;
    const homeTeam = isHome ? settings.name : match.opponent;
    const awayTeam = isHome ? match.opponent : settings.name;
    const opponentTeamInfo = leagueTeams.find(t => t.name.toLowerCase() === match.opponent.toLowerCase());

    const dateObj = new Date(match.date);
    const dateFormatted = new Intl.DateTimeFormat("en-GB", { weekday: 'long', day: 'numeric', month: 'long' }).format(dateObj);

    // Simple countdown logic (Days only for simplicity, could be expanded)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const matchDate = new Date(match.date);
    matchDate.setHours(0, 0, 0, 0);
    const diffTime = Math.abs(matchDate.getTime() - today.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    let countdownText = `${diffDays} Days`;
    if (diffDays === 0) countdownText = "Today";
    if (diffDays === 1) countdownText = "Tomorrow";

    return (
        <div className="space-y-4 mb-12">
            <h2 className="text-sm font-semibold tracking-wider text-muted-foreground uppercase">Next Match</h2>
            
            <Card className="border-border bg-surface-1 overflow-hidden">
                <div className="p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-8 text-center md:text-left">
                    
                    {/* Fixture Details */}
                    <div className="flex-1">
                        <Badge variant="outline" className="mb-4 bg-brand/10 text-brand border-brand/20">
                            {match.competition || "Fixture"}
                        </Badge>
                        <h3 className="text-4xl md:text-5xl font-black tracking-tight text-foreground mb-2 flex items-center justify-center md:justify-start gap-4">
                            <span className={`flex items-center gap-3 ${isHome ? "text-foreground" : "text-muted-foreground"}`}>
                                {isHome && settings.logo && <img src={settings.logo} alt="Club Logo" className="h-8 w-8 md:h-10 md:w-10 object-contain rounded-full" />}
                                {!isHome && opponentTeamInfo?.badge_url && <img src={opponentTeamInfo.badge_url} alt="Badge" className="h-8 w-8 md:h-10 md:w-10 object-contain" />}
                                {homeTeam}
                            </span>
                            <span className="text-muted-foreground font-normal text-3xl">vs</span>
                            <span className={`flex items-center gap-3 ${!isHome ? "text-foreground" : "text-muted-foreground"}`}>
                                {!isHome && settings.logo && <img src={settings.logo} alt="Club Logo" className="h-8 w-8 md:h-10 md:w-10 object-contain rounded-full" />}
                                {isHome && opponentTeamInfo?.badge_url && <img src={opponentTeamInfo.badge_url} alt="Badge" className="h-8 w-8 md:h-10 md:w-10 object-contain" />}
                                {awayTeam}
                            </span>
                        </h3>
                        
                        <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 mt-6 text-sm text-muted-foreground font-medium">
                            <div className="flex items-center gap-1.5">
                                <CalendarDays className="h-4 w-4" />
                                {dateFormatted}
                            </div>
                            <div className="flex items-center gap-1.5">
                                <Clock className="h-4 w-4" />
                                {match.time}
                            </div>
                            <div className="flex items-center gap-1.5">
                                <MapPin className="h-4 w-4" />
                                {isHome ? "Home" : "Away"} {match.location ? `- ${match.location}` : ""} {match.surface ? `(${match.surface})` : ""}
                            </div>
                        </div>
                    </div>
                    
                    {/* Countdown */}
                    <div className="flex flex-col items-center justify-center p-6 bg-surface-2 rounded-2xl border border-border/50 min-w-[160px]">
                        <span className="text-sm font-medium text-muted-foreground mb-1">Kick-off in</span>
                        <span className="text-3xl font-black tracking-tight text-foreground">{countdownText}</span>
                    </div>
                </div>
                
                {/* Action Bar */}
                <div className="border-t border-border bg-surface-2/50 p-4">
                    <div className="flex flex-wrap items-center gap-3">
                        <Button variant="default" className="bg-brand hover:bg-brand/90" onClick={() => onManageMatch(match)}>
                            <Settings className="h-4 w-4 mr-2" />
                            Manage Match
                        </Button>
                        <Button variant="outline" className="border-border text-foreground hover:bg-surface-3" asChild>
                            <Link href={`/matchday-xi?match=${match.id}`}>
                                <ShieldHalf className="h-4 w-4 mr-2" />
                                Matchday XI
                            </Link>
                        </Button>
                        <Button variant="outline" className="border-border text-foreground hover:bg-surface-3" asChild>
                            <Link href={`/analysis?match=${match.id}`}>
                                <Activity className="h-4 w-4 mr-2" />
                                Analysis
                            </Link>
                        </Button>
                        <Button variant="outline" className="border-border text-foreground hover:bg-surface-3 ml-auto" onClick={() => onShareMatch(match)}>
                            <Share2 className="h-4 w-4 mr-2" />
                            Share
                        </Button>
                    </div>
                </div>
            </Card>
        </div>
    );
}
