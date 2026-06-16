"use client";

import { useState, useEffect } from "react";
import { Match, Player } from "@/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    Users,
    Trophy,
    Activity,
    CalendarDays,
    ArrowUpRight,
    ArrowDownRight,
    RefreshCw,
    Check
} from "lucide-react";
import { useClub } from "@/context/club-context";
import { supabase } from "@/lib/supabase";

export default function DashboardPage() {
    const { settings, updateSettings } = useClub();
    const [matches, setMatches] = useState<Match[]>([]);
    const [nextMatch, setNextMatch] = useState<Match | null>(null);
    const [lastResult, setLastResult] = useState<Match | null>(null);
    const [upcomingFixtures, setUpcomingFixtures] = useState<Match[]>([]);
    const [squadCounts, setSquadCounts] = useState<Record<string, number>>({});
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncSuccess, setSyncSuccess] = useState(false);

    useEffect(() => {
        fetchData();

        // Subscriptions
        const channels = [
            supabase.channel('public:matches').on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, fetchMatches),
            supabase.channel('public:players').on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, fetchSquad)
        ];

        channels.forEach(c => c.subscribe());

        return () => {
            channels.forEach(c => supabase.removeChannel(c));
        };
    }, []);

    const fetchData = () => {
        fetchMatches();
        fetchSquad();
    };

    const fetchMatches = async () => {
        const { data } = await supabase.from('matches').select('*');
        if (data) {
            const loadedMatches: Match[] = data as any;
            setMatches(loadedMatches);

            const now = new Date();
            now.setHours(0, 0, 0, 0);

            const upcoming = loadedMatches
                .filter(m => m.result === "Pending" && new Date(m.date) >= now)
                .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

            setNextMatch(upcoming[0] || null);
            setUpcomingFixtures(upcoming.slice(0, 3));

            const completed = loadedMatches
                .filter(m => m.result !== "Pending")
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

            setLastResult(completed[0] || null);
        }
    };

    const fetchSquad = async () => {
        const { data } = await supabase.from('players').select('squad');
        if (data) {
            const counts: Record<string, number> = {};
            const SQUAD_LABELS: Record<string, string> = { firstTeam: "First Team", midweek: "Midweek", youth: "Youth" };
            
            data.forEach((p: any) => {
                const rawSquad = p.squad || "Unknown";
                const mappedSquad = SQUAD_LABELS[rawSquad] || rawSquad;
                counts[mappedSquad] = (counts[mappedSquad] || 0) + 1;
            });
            setSquadCounts(counts);
        }
    };

    const syncLeague = async () => {
        if (!settings.leagueUrl) {
            alert("Please configure a League URL first.");
            return;
        }

        setIsSyncing(true);
        setSyncSuccess(false);

        try {
            const res = await fetch('/api/sync-league', { 
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: settings.leagueUrl, clubName: settings.name })
            });
            const data = await res.json();

            if (data.success && data.position) {
                await updateSettings({ leaguePosition: data.position });
                
                setSyncSuccess(true);
                setTimeout(() => setSyncSuccess(false), 3000);
            } else {
                alert("Failed to sync: " + (data.error || "Unknown error"));
            }
        } catch (e) {
            alert("Error during sync. Check console.");
            console.error(e);
        } finally {
            setIsSyncing(false);
        }
    };

    // removed window.addEventListener logic

    // ... date helpers ...
    const formatDate = (dateStr: string) => {
        if (!dateStr) return "";
        return new Date(dateStr).toLocaleDateString("en-GB", {
            day: "numeric",
            month: "short"
        });
    };

    const formatDateTime = (dateStr: string, timeStr: string) => {
        if (!dateStr) return "";
        const d = new Date(dateStr).toLocaleDateString("en-GB", {
            weekday: "short",
            day: "numeric",
            month: "short"
        });
        return `${d} • ${timeStr || "TBD"}`;
    };

    const getResultColor = (result: string) => {
        switch (result) {
            case "Win": return "text-green-600";
            case "Draw": return "text-amber-500";
            case "Loss": return "text-red-600";
            default: return "text-slate-500";
        }
    };

    const getLeaguePositionSuffix = (pos: number) => {
        const j = pos % 10, k = pos % 100;
        if (j == 1 && k != 11) return "st";
        if (j == 2 && k != 12) return "nd";
        if (j == 3 && k != 13) return "rd";
        return "th";
    };

    const displayLeaguePosition = settings.leaguePosition 
        ? `${settings.leaguePosition}${getLeaguePositionSuffix(settings.leaguePosition)}` 
        : "Unranked";

    const currentSquads = settings.squads || ["First Team"];
    const mainSquad = currentSquads[0];
    const mainSquadCount = squadCounts[mainSquad] || 0;
    
    // Create dynamic description string for all OTHER squads
    const otherSquadsStr = currentSquads
        .slice(1)
        .map(sq => `+${squadCounts[sq] || 0} ${sq}`)
        .join(" • ");

    const stats = [
        {
            title: `${mainSquad} Squad`,
            value: mainSquadCount.toString(),
            description: otherSquadsStr || "No other squads",
            icon: Users,
        },
        {
            title: "League Position",
            value: displayLeaguePosition,
            description: settings.leagueUrl ? "View Full Table" : "Setup League Table",
            icon: Trophy,
            trendUp: settings.leaguePosition !== null && settings.leaguePosition <= 3,
            link: "/league"
        },
        {
            title: "Next Match",
            value: nextMatch ? `${nextMatch.isHome ? 'vs' : '@'} ${nextMatch.opponent}` : "No fixtures",
            description: nextMatch ? formatDateTime(nextMatch.date, nextMatch.time) : "Check Matches tab",
            icon: CalendarDays,
            trend: nextMatch ? (nextMatch.isHome ? "Home Game" : "Away Game") : "",
            trendUp: true
        },
        {
            title: "Last Result",
            value: lastResult?.scoreline || "N/A",
            description: lastResult ? `${lastResult.isHome ? 'vs' : '@'} ${lastResult.opponent}` : "No results yet",
            icon: Activity,
            trend: lastResult?.result || "",
            trendUp: lastResult?.result === "Win"
        }
    ];

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                {settings.logo && (
                    <div className="h-16 w-16 relative flex-shrink-0">
                        <img
                            src={settings.logo}
                            alt={settings.name}
                            className="h-full w-full object-contain drop-shadow-sm"
                        />
                    </div>
                )}
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-slate-900">{settings.name} Dashboard</h2>
                    <p className="text-slate-500">Welcome back, Coach. Here's what's happening at {settings.name}.</p>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {stats.map((stat) => (
                    <Card key={stat.title}>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium text-slate-600">
                                {stat.title}
                            </CardTitle>
                            <div className="flex items-center gap-2">
                                {stat.title === "League Position" && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            syncLeague();
                                        }}
                                        disabled={isSyncing || !settings.leagueUrl}
                                        className={`p-1 rounded-full hover:bg-slate-100 transition-colors ${isSyncing ? 'animate-spin' : ''} ${syncSuccess ? 'text-green-600' : 'text-slate-400'}`}
                                        title="Sync with League Table"
                                    >
                                        {syncSuccess ? <Check className="h-3.5 w-3.5" /> : <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`} />}
                                    </button>
                                )}
                                <stat.icon className="h-4 w-4 text-slate-500" />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-slate-900">
                                {stat.value}
                            </div>
                            
                            {(stat as any).link ? (
                                <a href={(stat as any).link} className="text-xs text-red-600 mt-1 flex items-center hover:text-red-700 font-medium">
                                    {stat.description} <ArrowUpRight className="h-3 w-3 ml-1" />
                                </a>
                            ) : (
                                <p className="text-xs text-slate-500 mb-1">{stat.description}</p>
                            )}

                            {stat.trend && (
                                <div className={`flex items-center text-xs ${stat.title === "Last Result"
                                    ? getResultColor(stat.trend)
                                    : stat.trendUp ? 'text-green-600' : 'text-red-600'
                                    }`}>
                                    {stat.title !== "Last Result" && (
                                        stat.trendUp ? <ArrowUpRight className="h-3 w-3 mr-1" /> : <ArrowDownRight className="h-3 w-3 mr-1" />
                                    )}
                                    {stat.trend}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                ))}
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                <Card className="col-span-7 lg:col-span-4">
                    <CardHeader>
                        <CardTitle>Recent Form</CardTitle>
                        <CardDescription>
                            Last 5 matches performance
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="pl-2">
                        <div className="h-[200px] flex items-center justify-center">
                            {matches.length > 0 ? (
                                <div className="flex items-center gap-2">
                                    {matches
                                        .filter(m => m.result !== "Pending")
                                        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                                        .slice(0, 5)
                                        .reverse()
                                        .map((match, i) => (
                                            <div key={i} className="flex flex-col items-center gap-1 relative group">
                                                <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-white cursor-pointer transition-transform hover:scale-110 ${match.result === "Win" ? "bg-green-500" :
                                                    match.result === "Loss" ? "bg-red-500" :
                                                        "bg-amber-500"
                                                    }`}>
                                                    {match.result?.[0]}
                                                </div>
                                                <span className="text-[10px] text-slate-500">{formatDate(match.date)}</span>

                                                {/* Hover Tooltip */}
                                                <div className="absolute bottom-full mb-2 hidden group-hover:block z-10 bg-slate-900 text-white text-xs rounded-lg px-3 py-2 whitespace-nowrap shadow-lg">
                                                    <div className="font-semibold">{match.isHome ? 'vs' : '@'} {match.opponent}</div>
                                                    <div className="text-slate-300">{match.scoreline}</div>
                                                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900"></div>
                                                </div>
                                            </div>
                                        ))}
                                </div>
                            ) : (
                                <p className="text-slate-400">No match data available</p>
                            )}
                        </div>
                    </CardContent>
                </Card>

                <Card className="col-span-7 lg:col-span-3">
                    <CardHeader>
                        <CardTitle>Upcoming Fixtures</CardTitle>
                        <CardDescription>
                            Next {upcomingFixtures.length} games
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {upcomingFixtures.length > 0 ? (
                                upcomingFixtures.map((match, i) => (
                                    <div key={i} className="flex items-center justify-between border-b pb-2 last:border-0 last:pb-0">
                                        <div>
                                            <p className="font-medium text-sm">{match.opponent}</p>
                                            <p className="text-xs text-slate-500">
                                                {match.isHome ? "Home" : "Away"} • {match.competition}
                                            </p>
                                        </div>
                                        <div className="text-sm font-semibold text-slate-600">{formatDate(match.date)}</div>
                                    </div>
                                ))
                            ) : (
                                <p className="text-sm text-slate-400 text-center py-4">No upcoming fixtures</p>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div >
    );
}
