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
    const { settings } = useClub();
    const [matches, setMatches] = useState<Match[]>([]);
    const [nextMatch, setNextMatch] = useState<Match | null>(null);
    const [lastResult, setLastResult] = useState<Match | null>(null);
    const [upcomingFixtures, setUpcomingFixtures] = useState<Match[]>([]);
    const [leaguePosition, setLeaguePosition] = useState<string>("3rd");
    const [leaguePoints, setLeaguePoints] = useState<string>("45");
    const [isEditingLeague, setIsEditingLeague] = useState(false);
    const [totalSquad, setTotalSquad] = useState(0);
    const [midweekCount, setMidweekCount] = useState(0);
    const [youthCount, setYouthCount] = useState(0);
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncSuccess, setSyncSuccess] = useState(false);

    useEffect(() => {
        fetchData();

        // Subscriptions a
        const channels = [
            supabase.channel('public:matches').on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, fetchMatches),
            supabase.channel('public:players').on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, fetchSquad),
            // Subscribe to league stats changes if another user updates it
            supabase.channel('public:documents:league').on('postgres_changes', { event: '*', schema: 'public', table: 'documents', filter: "name=eq.League Stats" }, fetchLeagueStats)
        ];

        channels.forEach(c => c.subscribe());

        return () => {
            channels.forEach(c => supabase.removeChannel(c));
        };
    }, []);

    const fetchData = () => {
        fetchMatches();
        fetchSquad();
        fetchLeagueStats();
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
            setTotalSquad(data.filter((p: any) => p.squad === "firstTeam").length);
            setMidweekCount(data.filter((p: any) => p.squad === "midweek").length);
            setYouthCount(data.filter((p: any) => p.squad === "youth").length);
        }
    };

    const fetchLeagueStats = async () => {
        const { data } = await supabase.from('documents').select('url').eq('name', 'League Stats').single();
        if (data && data.url) {
            try {
                const { position, points } = JSON.parse(data.url);
                setLeaguePosition(position || "3rd");
                setLeaguePoints(points || "45");
            } catch (e) {
                // If not json, maybe just raw string or error
            }
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

    const saveLeagueStats = async () => {
        const val = JSON.stringify({
            position: leaguePosition,
            points: leaguePoints
        });

        // Upsert
        const { data: existing } = await supabase.from('documents').select('id').eq('name', 'League Stats').maybeSingle();

        if (existing) {
            await supabase.from('documents').update({ url: val }).eq('id', existing.id);
        } else {
            await supabase.from('documents').insert([{
                name: 'League Stats',
                type: 'Stats',
                category: 'General',
                url: val
            }]);
        }

        setIsEditingLeague(false);
    };

    const syncLeague = async () => {
        setIsSyncing(true);
        setSyncSuccess(false);

        try {
            const res = await fetch('/api/sync-league', { method: 'POST' });
            const data = await res.json();

            if (data.success) {
                setLeaguePosition(data.position);
                setLeaguePoints(data.points);
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

    const stats = [
        {
            title: "First Team Squad",
            value: totalSquad.toString(),
            description: `+${midweekCount} Midweek • +${youthCount} Youth`,
            icon: Users,
        },
        {
            title: "League Position",
            value: leaguePosition,
            description: `${leaguePoints} Points`,
            icon: Trophy,
            trendUp: true,
            editable: true
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
                                        disabled={isSyncing}
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
                            {stat.title === "League Position" && isEditingLeague ? (
                                <div className="space-y-2">
                                    <input
                                        type="text"
                                        value={leaguePosition}
                                        onChange={(e) => setLeaguePosition(e.target.value)}
                                        className="w-full text-2xl font-bold text-slate-900 border-b-2 border-blue-500 focus:outline-none bg-transparent"
                                        placeholder="e.g., 3rd"
                                    />
                                    <input
                                        type="text"
                                        value={leaguePoints}
                                        onChange={(e) => setLeaguePoints(e.target.value)}
                                        className="w-full text-xs text-slate-500 border-b border-blue-300 focus:outline-none bg-transparent"
                                        placeholder="Points"
                                    />
                                    <div className="flex gap-2 mt-2">
                                        <button
                                            onClick={saveLeagueStats}
                                            className="text-xs px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700"
                                        >
                                            Save
                                        </button>
                                        <button
                                            onClick={() => setIsEditingLeague(false)}
                                            className="text-xs px-2 py-1 bg-slate-300 text-slate-700 rounded hover:bg-slate-400"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div
                                        className={`text-2xl font-bold text-slate-900 ${stat.title === "League Position" ? "cursor-pointer hover:text-blue-600" : ""}`}
                                        onClick={() => stat.title === "League Position" && setIsEditingLeague(true)}
                                    >
                                        {stat.value}
                                    </div>
                                    <p className="text-xs text-slate-500 mb-1">{stat.description}</p>
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
                                    {stat.title === "League Position" && !isEditingLeague && (
                                        <p className="text-[10px] text-blue-500 mt-1">Click to edit</p>
                                    )}
                                </>
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
