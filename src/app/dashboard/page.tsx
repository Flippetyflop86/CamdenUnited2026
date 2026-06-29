"use client";

import { useState, useEffect } from "react";
import { Match, Player } from "@/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FORMATIONS } from "@/lib/formations";
import {
    Users,
    Trophy,
    Activity,
    CalendarDays,
    ArrowUpRight,
    ArrowDownRight,
    RefreshCw,
    Check,
    Clock,
    LayoutDashboard
} from "lucide-react";
import { useClub } from "@/context/club-context";
import { supabase } from "@/lib/supabase";
import { formatPlayerName } from "@/lib/utils";

export default function DashboardPage() {
    const { settings, updateSettings } = useClub();
    const [matches, setMatches] = useState<Match[]>([]);
    const [players, setPlayers] = useState<Player[]>([]);
    const [lineup, setLineup] = useState<any>(null);
    const [nextMatch, setNextMatch] = useState<Match | null>(null);
    const [lastResult, setLastResult] = useState<Match | null>(null);
    const [upcomingFixtures, setUpcomingFixtures] = useState<Match[]>([]);
    const [squadCounts, setSquadCounts] = useState<Record<string, number>>({});
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncSuccess, setSyncSuccess] = useState(false);
    const [timeLeft, setTimeLeft] = useState<{ days: number; hours: number; minutes: number; seconds: number } | null>(null);
    const [activities, setActivities] = useState<any[]>([]);

    useEffect(() => {
        fetchData();

        // Subscriptions
        const channels = [
            supabase.channel('public:matches').on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, fetchMatches),
            supabase.channel('public:players').on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, fetchSquad),
            supabase.channel('public:matchday_xis').on('postgres_changes', { event: '*', schema: 'public', table: 'matchday_xis' }, fetchLineup),
            supabase.channel('public:activity_logs').on('postgres_changes', { event: '*', schema: 'public', table: 'activity_logs' }, fetchActivities)
        ];

        channels.forEach(c => c.subscribe());

        return () => {
            channels.forEach(c => supabase.removeChannel(c));
        };
    }, []);

    useEffect(() => {
        if (!nextMatch) return;
        const calculateTimeLeft = () => {
            const matchDateTime = new Date(`${nextMatch.date}T${nextMatch.time || "12:00:00"}`);
            const difference = matchDateTime.getTime() - new Date().getTime();
            if (difference <= 0) {
                setTimeLeft(null);
                return;
            }
            setTimeLeft({
                days: Math.floor(difference / (1000 * 60 * 60 * 24)),
                hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
                minutes: Math.floor((difference / 1000 / 60) % 60),
                seconds: Math.floor((difference / 1000) % 60)
            });
        };
        calculateTimeLeft();
        const timer = setInterval(calculateTimeLeft, 1000);
        return () => clearInterval(timer);
    }, [nextMatch]);

    const fetchData = () => {
        fetchMatches();
        fetchSquad();
        fetchLineup();
        fetchActivities();
    };

    const fetchLineup = async () => {
        const { data } = await supabase
            .from('matchday_xis')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(1);
        if (data && data.length > 0) {
            setLineup(data[0]);
        }
    };

    const fetchActivities = async () => {
        const { data } = await supabase
            .from('activity_logs')
            .select('*')
            .eq('action', 'Player RSVP Check-in')
            .order('created_at', { ascending: false })
            .limit(5);
        if (data) setActivities(data);
    };

    const fetchMatches = async () => {
        const { data } = await supabase.from('matches').select('*');
        if (data) {
            const loadedMatches: Match[] = data.map((m: any) => {
                const locationMatch = m.notes ? m.notes.match(/\[Location: (.*?)\]/) : null;
                const location = locationMatch ? locationMatch[1] : "";
                
                const surfaceMatch = m.notes ? m.notes.match(/\[Surface: (.*?)\]/) : null;
                const surface = surfaceMatch ? surfaceMatch[1] : "4G";
                
                let cleanNotes = m.notes || "";
                cleanNotes = cleanNotes.replace(/\[Location: .*?\]\n?/, "");
                cleanNotes = cleanNotes.replace(/\[Surface: .*?\]\n?/, "").trim();
                
                return {
                    id: m.id,
                    date: m.date,
                    time: m.time,
                    opponent: m.opponent,
                    isHome: m.is_home,
                    competition: m.competition,
                    scoreline: m.scoreline,
                    result: m.result,
                    goalscorers: m.goalscorers,
                    assists: m.assists,
                    notes: cleanNotes,
                    surface: surface,
                    location: location
                };
            });
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
        const { data } = await supabase.from('players').select('id, first_name, last_name, position, squad, image_url, date_of_birth, appearances, goals, assists, nickname, use_nickname');
        if (data) {
            const mapped: Player[] = data.map((p: any) => ({
                id: p.id,
                firstName: p.first_name,
                lastName: p.last_name,
                position: p.position,
                squad: p.squad,
                squadNumber: 0,
                age: 0,
                nationality: "",
                dateOfBirth: p.date_of_birth,
                medicalStatus: "Available",
                contractExpiry: "",
                availability: true,
                appearances: p.appearances || 0,
                goals: p.goals || 0,
                assists: p.assists || 0,
                nickname: p.nickname || "",
                useNickname: p.use_nickname || false
            }));
            setPlayers(mapped);

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
            case "Win": return "text-emerald-600 font-extrabold";
            case "Draw": return "text-amber-500 font-extrabold";
            case "Loss": return "text-red-600 font-extrabold";
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
            link: "/squad",
            linkText: "+ Add Players"
        },
        {
            title: "League Position",
            value: displayLeaguePosition,
            description: settings.leagueUrl ? "View Full Table" : "Setup League Table",
            icon: Trophy,
            trendUp: settings.leaguePosition !== null && settings.leaguePosition <= 3,
            link: "/league",
            linkText: "Configure table"
        },
        {
            title: "Next Match",
            value: nextMatch ? `${nextMatch.isHome ? 'vs' : '@'} ${nextMatch.opponent}` : "No fixtures",
            description: nextMatch 
                ? `${formatDateTime(nextMatch.date, nextMatch.time)}${nextMatch.location ? ` • ${nextMatch.location}` : ""}` 
                : "Check Matches tab",
            icon: CalendarDays,
            trend: nextMatch ? (nextMatch.isHome ? "Home Game" : "Away Game") : "",
            trendUp: true,
            link: "/matches",
            linkText: "+ Schedule Match"
        },
        {
            title: "Last Result",
            value: lastResult?.scoreline || "N/A",
            description: lastResult ? `${lastResult.isHome ? 'vs' : '@'} ${lastResult.opponent}` : "No results yet",
            icon: Activity,
            trend: lastResult?.result || "",
            trendUp: lastResult?.result === "Win",
            link: "/matches",
            linkText: "+ Enter Score"
        }
    ];

    const getStatCardColors = (title: string) => {
        if (title.includes("Squad")) return {
            borderGlow: "hover:border-emerald-500/30 hover:shadow-emerald-500/5",
            accent: "bg-emerald-500",
            iconBg: "bg-emerald-50 text-emerald-600"
        };
        if (title.includes("League")) return {
            borderGlow: "hover:border-amber-500/30 hover:shadow-amber-500/5",
            accent: "bg-amber-500",
            iconBg: "bg-amber-50 text-amber-600"
        };
        if (title.includes("Next")) return {
            borderGlow: "hover:border-red-500/30 hover:shadow-red-500/5",
            accent: "bg-red-500",
            iconBg: "bg-red-50 text-red-600"
        };
        return {
            borderGlow: "hover:border-blue-500/30 hover:shadow-blue-500/5",
            accent: "bg-blue-500",
            iconBg: "bg-blue-50 text-blue-600"
        };
    };

    const getPositionCounts = () => {
        const counts = { GK: 0, DEF: 0, MID: 0, FWD: 0 };
        players.forEach(p => {
            const pos = p.position.toUpperCase();
            if (['GK'].includes(pos)) counts.GK++;
            else if (['CB', 'RB', 'LB', 'DEF', 'RWB', 'LWB'].includes(pos)) counts.DEF++;
            else if (['CM', 'CDM', 'CAM', 'MID', 'RM', 'LM'].includes(pos)) counts.MID++;
            else if (['ST', 'CF', 'RW', 'LW', 'FWD'].includes(pos)) counts.FWD++;
        });
        return counts;
    };

    const positionCounts = getPositionCounts();
    const totalPosCount = Object.values(positionCounts).reduce((a, b) => a + b, 0) || 1;
    const positionConfigs = [
        { label: "Goalkeepers", count: positionCounts.GK, color: "bg-orange-500", track: "bg-orange-500/10" },
        { label: "Defenders", count: positionCounts.DEF, color: "bg-blue-500", track: "bg-blue-500/10" },
        { label: "Midfielders", count: positionCounts.MID, color: "bg-yellow-500", track: "bg-yellow-500/10" },
        { label: "Forwards", count: positionCounts.FWD, color: "bg-red-500", track: "bg-red-500/10" },
    ];

    const renderMiniPitch = () => {
        if (!lineup || !players.length || Object.keys(lineup.starters || {}).length === 0) return (
            <div className="h-[290px] flex flex-col items-center justify-center border-2 border-dashed rounded-xl border-slate-200/60 text-slate-400 text-xs p-4 text-center bg-slate-50/20 backdrop-blur-sm">
                <span className="text-3xl mb-2">📋</span>
                <p className="font-bold text-slate-700 text-xs">No lineup selected</p>
                <p className="text-[10px] text-slate-550 max-w-[160px] mx-auto mt-0.5 leading-tight">Choose your starting XI and save your formations.</p>
                <a href="/matchday-xi" className="mt-3 px-3 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-extrabold text-[9px] rounded-full transition-colors uppercase tracking-wide">
                    + Design Lineup
                </a>
            </div>
        );

        const formation = FORMATIONS[lineup.formation] || FORMATIONS["4-2-3-1"];
        const kitColor = settings.homeKitShirt || "#ffffff";

        return (
            <div className="relative w-full max-w-[280px] h-[290px] bg-emerald-600 rounded-xl overflow-hidden shadow-lg border-2 border-emerald-500/40 flex-shrink-0 mx-auto transition-transform hover:scale-[1.02] duration-300">
                {/* Grass stripes */}
                <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-10">
                    {Array.from({ length: 6 }).map((_, idx) => (
                        <div key={idx} className={`h-[48px] w-full ${idx % 2 === 0 ? 'bg-black' : 'bg-transparent'}`} />
                    ))}
                </div>

                {/* Pitch Markings */}
                <div className="absolute inset-0 border-2 border-white/20 m-2 pointer-events-none">
                    <div className="absolute top-1/2 left-2 right-2 border-t border-white/20" />
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 border border-white/20 rounded-full" />
                    <div className="absolute top-1 left-1/2 -translate-x-1/2 w-16 h-8 border border-white/20 border-t-0" />
                    <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-16 h-8 border border-white/20 border-b-0" />
                </div>

                {/* Player Nodes */}
                {formation.map((pos, idx) => {
                    const playerId = lineup.starters?.[idx];
                    const player = playerId ? players.find(p => p.id === playerId) : null;
                    const name = player ? (player.useNickname && player.nickname ? player.nickname : `${player.firstName.charAt(0)}. ${player.lastName}`) : pos.label;
                    
                    return (
                        <div 
                            key={idx}
                            className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center"
                            style={{
                                left: `${pos.x}%`,
                                top: `${pos.y}%`,
                            }}
                        >
                            <div 
                                className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-black text-white border border-black/35 shadow-md"
                                style={{ backgroundColor: pos.label === "GK" ? "#ea580c" : kitColor }}
                            >
                                {pos.number}
                            </div>
                            <span className="text-[7px] font-extrabold text-white bg-slate-950/80 px-1 py-0.5 rounded shadow mt-0.5 max-w-[48px] truncate leading-none">
                                {name}
                            </span>
                        </div>
                    );
                })}
            </div>
        );
    };

    const hasPlayers = players.length > 0;
    const hasMatches = matches.length > 0;
    const hasLineup = lineup && Object.keys(lineup.starters || {}).length > 0;
    const hasLeagueUrl = !!settings.leagueUrl;

    const checklistSteps = [
        { label: "Add Players", completed: hasPlayers, link: "/squad" },
        { label: "Schedule Match", completed: hasMatches, link: "/matches" },
        { label: "Pick Lineup", completed: hasLineup, link: "/matchday-xi" },
        { label: "Link League Url", completed: hasLeagueUrl, link: "/admin" }
    ];
    const completedStepsCount = checklistSteps.filter(s => s.completed).length;
    const showSetupChecklist = completedStepsCount < 4;

    const getUpcomingBirthdays = (squadPlayers: Player[]) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const upcoming = [];
        
        for (const player of squadPlayers) {
            if (!player.dateOfBirth) continue;
            const dob = new Date(player.dateOfBirth);
            if (isNaN(dob.getTime())) continue;
            
            const nextBirthday = new Date(today.getFullYear(), dob.getMonth(), dob.getDate());
            if (nextBirthday.getTime() < today.getTime()) {
                nextBirthday.setFullYear(today.getFullYear() + 1);
            }
            
            const diffTime = nextBirthday.getTime() - today.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            if (diffDays >= 0 && diffDays <= 7) {
                upcoming.push({ player, daysLeft: diffDays, nextBirthday });
            }
        }
        
        return upcoming.sort((a, b) => a.daysLeft - b.daysLeft);
    };

    const birthdays = getUpcomingBirthdays(players);

    return (
        <div className="space-y-6 relative">
            <style>{`
                @keyframes float-slow {
                    0%, 100% { transform: translate(0px, 0px) scale(1); }
                    50% { transform: translate(30px, -45px) scale(1.08); }
                }
                @keyframes float-slower {
                    0%, 100% { transform: translate(0px, 0px) scale(1); }
                    50% { transform: translate(-25px, 35px) scale(0.92); }
                }
                .animate-float-slow {
                    animation: float-slow 20s ease-in-out infinite;
                }
                .animate-float-slower {
                    animation: float-slower 25s ease-in-out infinite;
                }
            `}</style>

            {/* Animated Background Gradients */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden z-0 opacity-25">
                <div className="absolute top-[10%] left-[5%] w-[450px] h-[450px] rounded-full bg-gradient-to-br from-red-500/15 via-red-500/5 to-transparent blur-[90px] animate-float-slow" />
                <div className="absolute bottom-[15%] right-[5%] w-[500px] h-[500px] rounded-full bg-gradient-to-tr from-slate-400/20 via-slate-500/5 to-transparent blur-[100px] animate-float-slower" />
            </div>

            <div className="flex items-center gap-4 relative z-10">
                {settings.logo && (
                    <div className="h-16 w-16 relative flex-shrink-0 hover:scale-105 transition-transform duration-300">
                        <img
                            src={settings.logo}
                            alt={settings.name}
                            className="h-full w-full object-contain drop-shadow-md"
                        />
                    </div>
                )}
                <div>
                    <h2 className="text-3xl font-black tracking-tight text-slate-900 bg-clip-text bg-gradient-to-r from-slate-900 to-slate-700">
                        {settings.name} Dashboard
                    </h2>
                    <p className="text-slate-500 text-sm font-medium">Welcome back, Coach. Here's what's happening at {settings.name}.</p>
                </div>
            </div>

            {/* Birthday Alerts Banner */}
            {birthdays.length > 0 && (
                <Card className="bg-gradient-to-r from-pink-500/5 via-purple-500/5 to-indigo-500/5 border-pink-500/20 shadow-sm relative overflow-hidden z-10 border mb-6 animate-in slide-in-from-top-4 duration-300">
                    <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <span className="text-2xl animate-bounce">🎉</span>
                            <div>
                                <h4 className="text-sm font-bold text-slate-900">Upcoming Squad Birthdays</h4>
                                <p className="text-xs text-slate-550">
                                    {birthdays.map(b => {
                                        const daysText = b.daysLeft === 0 ? "today!" : `in ${b.daysLeft} days (${b.nextBirthday.getDate()} ${b.nextBirthday.toLocaleString('en-GB', { month: 'short' })})`;
                                        return `${formatPlayerName(b.player)} turns ${new Date().getFullYear() - new Date(b.player.dateOfBirth!).getFullYear()} ${daysText}`;
                                    }).join(", ")}
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Quick Start Checklist Banner */}
            {showSetupChecklist && (
                <Card className="bg-gradient-to-br from-slate-900 to-slate-800 text-white border-slate-800 relative overflow-hidden shadow-xl mb-6 z-10 border">
                    {/* ambient red glow inside dark card */}
                    <div className="absolute top-0 right-0 w-32 h-32 bg-red-600/10 rounded-full blur-2xl pointer-events-none" />
                    <CardContent className="p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                        <div className="space-y-1.5 flex-1">
                            <div className="flex items-center gap-2">
                                <Badge className="bg-red-500 hover:bg-red-500 text-white text-[9px] uppercase font-black px-2 py-0.5 tracking-wider border-none">Quick Start</Badge>
                                <span className="text-[11px] font-bold text-slate-400">Club Setup Progress: {completedStepsCount}/4 steps</span>
                            </div>
                            <h3 className="text-base font-black tracking-tight text-white">Get your Club Flowing</h3>
                            <p className="text-slate-400 text-xs font-medium">Follow these core steps to fully unlock the power of your club operating system.</p>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2 w-full md:w-auto shrink-0 text-xs">
                            {checklistSteps.map(step => (
                                <a 
                                    key={step.label} 
                                    href={step.link}
                                    className={`flex items-center gap-2 p-2 rounded-lg border transition-all ${
                                        step.completed 
                                            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 font-semibold' 
                                            : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10 font-bold'
                                    }`}
                                >
                                    <div className={`h-4 w-4 rounded-full flex items-center justify-center shrink-0 border ${
                                        step.completed ? 'bg-emerald-500 border-emerald-500 text-white text-[10px]' : 'border-slate-500 text-transparent'
                                    }`}>
                                        ✓
                                    </div>
                                    <span>{step.label}</span>
                                </a>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Stats Card Grid */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 relative z-10">
                {stats.map((stat) => {
                    const cfg = getStatCardColors(stat.title);
                    const isEmpty = stat.value === "0" || stat.value === "Unranked" || stat.value === "No fixtures" || stat.value === "N/A";
                    return (
                        <Card 
                            key={stat.title} 
                            className={`bg-white/70 backdrop-blur-md border-white/40 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5 duration-300 relative overflow-hidden group border ${cfg.borderGlow}`}
                        >
                            {/* Color Side Stripe */}
                            <div className={`absolute top-0 left-0 w-1 h-full ${cfg.accent} opacity-80`} />
                            
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-500">
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
                                            className={`p-1 rounded-full hover:bg-slate-100/80 transition-colors ${isSyncing ? 'animate-spin' : ''} ${syncSuccess ? 'text-green-600' : 'text-slate-400'}`}
                                            title="Sync with League Table"
                                        >
                                            {syncSuccess ? <Check className="h-3.5 w-3.5" /> : <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`} />}
                                        </button>
                                    )}
                                    <div className={`p-1.5 rounded-lg ${cfg.iconBg}`}>
                                        <stat.icon className="h-4 w-4" />
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-1">
                                <div className={`text-2xl font-black tracking-tight ${isEmpty ? 'text-slate-400' : 'text-slate-900'}`}>
                                    {stat.value}
                                </div>
                                
                                {stat.title === "Next Match" && timeLeft && (
                                    <div className="flex items-center gap-1.5 bg-red-500/10 px-2 py-0.5 rounded text-[10px] font-black text-red-600 w-max tracking-wide">
                                        <Clock className="h-3 w-3 animate-pulse" />
                                        <span>Countdown: {timeLeft.days}d {timeLeft.hours}h {timeLeft.minutes}m {timeLeft.seconds}s</span>
                                    </div>
                                )}

                                {isEmpty && stat.link ? (
                                    <a href={stat.link} className="text-[11px] text-red-650 mt-1 flex items-center hover:text-red-700 font-extrabold group-hover:underline uppercase tracking-wide">
                                        {stat.linkText} <ArrowUpRight className="h-3 w-3 ml-0.5" />
                                    </a>
                                ) : (stat as any).link ? (
                                    <a href={(stat as any).link} className="text-xs text-red-600 mt-1 flex items-center hover:text-red-700 font-bold group-hover:underline">
                                        {stat.description} <ArrowUpRight className="h-3 w-3 ml-0.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                                    </a>
                                ) : (
                                    <p className="text-xs text-slate-500 font-medium">{stat.description}</p>
                                )}

                                {stat.trend && !isEmpty && (
                                    <div className={`flex items-center text-xs mt-1 ${stat.title === "Last Result"
                                        ? getResultColor(stat.trend)
                                        : stat.trendUp ? 'text-green-600' : 'text-red-600'
                                        }`}>
                                        {stat.title !== "Last Result" && (
                                            stat.trendUp ? <ArrowUpRight className="h-3 w-3 mr-0.5" /> : <ArrowDownRight className="h-3 w-3 mr-0.5" />
                                        )}
                                        <span className="font-bold uppercase tracking-wider text-[10px]">{stat.trend}</span>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            {/* Layout Grid */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7 relative z-10">
                {/* Form & Pitch Panel */}
                <Card className="col-span-7 lg:col-span-4 bg-white/70 backdrop-blur-md border-white/40 shadow-sm border">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-lg font-bold text-slate-900">Performance & Lineup</CardTitle>
                        <CardDescription className="text-xs">Recent Form and Visual Pitch Layout</CardDescription>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-center">
                        {/* Interactive Form Timeline */}
                        <div className="space-y-4">
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Recent Form</h4>
                            {matches.filter(m => m.result !== "Pending").length > 0 ? (
                                <div className="flex flex-col items-center gap-6 w-full py-2">
                                    <div className="relative flex items-center justify-center gap-3 sm:gap-4 z-10 w-full">
                                        <div className="absolute top-1/2 left-4 right-4 h-0.5 bg-slate-200/50 -translate-y-1/2 -z-10" />

                                        {matches
                                            .filter(m => m.result !== "Pending")
                                            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                                            .slice(0, 5)
                                            .reverse()
                                            .map((match, i) => {
                                                const isWin = match.result === "Win";
                                                const isLoss = match.result === "Loss";
                                                const colorClass = isWin 
                                                    ? "bg-gradient-to-tr from-emerald-500 to-green-400 shadow-lg shadow-emerald-500/20" 
                                                    : isLoss 
                                                        ? "bg-gradient-to-tr from-red-600 to-rose-450 shadow-lg shadow-red-500/20" 
                                                        : "bg-gradient-to-tr from-amber-500 to-yellow-400 shadow-lg shadow-amber-500/20";

                                                return (
                                                    <div key={i} className="flex flex-col items-center gap-1.5 relative group">
                                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-white cursor-pointer transition-all hover:scale-115 hover:-translate-y-0.5 ${colorClass}`}>
                                                            {match.result?.[0]}
                                                        </div>
                                                        <span className="text-[9px] font-extrabold text-slate-500 bg-white border border-slate-200 px-1.5 py-0.5 rounded-full shadow-sm">
                                                            {formatDate(match.date)}
                                                        </span>

                                                        {/* Hover Tooltip */}
                                                        <div className="absolute bottom-full mb-3 hidden group-hover:flex flex-col z-35 bg-slate-900 text-white text-[10px] rounded-xl p-3 whitespace-nowrap shadow-xl border border-slate-800 animate-in fade-in slide-in-from-bottom-1 duration-150">
                                                            <div className="font-bold text-xs border-b border-slate-800 pb-1 mb-1.5 flex items-center justify-between gap-4">
                                                                <span>{match.isHome ? '🏠 Home' : '🚌 Away'} vs {match.opponent}</span>
                                                                <span className={`text-[9px] uppercase font-black px-1.5 py-0.5 rounded ${
                                                                    isWin ? 'bg-emerald-500/20 text-emerald-400' : isLoss ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'
                                                                }`}>
                                                                    {match.result}
                                                                </span>
                                                            </div>
                                                            <div className="text-slate-300 font-semibold">Score: <span className="text-white font-bold">{match.scoreline}</span></div>
                                                            <div className="text-slate-400 text-[9px] mt-0.5">{match.competition}</div>
                                                            {match.goalscorers && <div className="text-emerald-400 font-medium text-[9px] mt-1 max-w-[180px] truncate">⚽ {match.goalscorers}</div>}
                                                            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900"></div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-6 text-center text-slate-400 border-2 border-dashed rounded-xl border-slate-200/50 bg-slate-50/20 p-4">
                                    <span className="text-3xl mb-1.5 animate-pulse">📊</span>
                                    <p className="font-bold text-[11px] text-slate-700">No match records yet</p>
                                    <p className="text-[9px] text-slate-550 max-w-[170px] mx-auto mt-0.5 leading-tight">Match updates will automatically generate your form path here.</p>
                                    <a href="/matches" className="mt-3 px-3 py-1 bg-red-50 hover:bg-red-100 text-red-700 font-extrabold text-[9px] rounded-full transition-colors tracking-wide uppercase">
                                        + Schedule Match
                                    </a>
                                </div>
                            )}
                        </div>

                        {/* Lineup Widget */}
                        <div className="flex flex-col justify-center">
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 text-center sm:text-left">First Team Lineup</h4>
                            {renderMiniPitch()}
                        </div>
                    </CardContent>
                </Card>

                {/* Squad Balance & Upcoming panel */}
                <Card className="col-span-7 lg:col-span-3 bg-white/70 backdrop-blur-md border-white/40 shadow-sm border flex flex-col justify-between">
                    <div>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-lg font-bold text-slate-900">Squad Position Balance</CardTitle>
                            <CardDescription className="text-xs">Detailed positional depth metrics</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {players.length > 0 ? (
                                <div className="space-y-3.5">
                                    {positionConfigs.map(cfg => {
                                        const percent = Math.round((cfg.count / totalPosCount) * 100) || 0;
                                        return (
                                            <div key={cfg.label} className="space-y-1">
                                                <div className="flex justify-between text-xs font-bold text-slate-700">
                                                    <span>{cfg.label}</span>
                                                    <span className="text-slate-500">{cfg.count} player{cfg.count !== 1 ? 's' : ''} ({percent}%)</span>
                                                </div>
                                                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden relative shadow-inner">
                                                    <div 
                                                        className={`h-full ${cfg.color} rounded-full transition-all duration-1000 ease-out`}
                                                        style={{ width: `${percent}%` }}
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-6 text-center text-slate-450 border border-dashed border-slate-200/60 rounded-xl bg-slate-50/20 p-4">
                                    <span className="text-3xl mb-1.5">👥</span>
                                    <p className="font-bold text-[11px] text-slate-700">Squad list is empty</p>
                                    <p className="text-[9px] text-slate-550 max-w-[170px] mx-auto mt-0.5 leading-tight">Add club members to see depth balance charts here.</p>
                                    <a href="/squad" className="mt-3 px-3 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 font-extrabold text-[9px] rounded-full transition-colors tracking-wide uppercase">
                                        + Add Player
                                    </a>
                                </div>
                            )}
                        </CardContent>
                    </div>

                    <div className="border-t border-slate-100 pt-3 mt-4">
                        <CardHeader className="py-2">
                            <CardTitle className="text-sm font-bold text-slate-900">Upcoming Fixtures</CardTitle>
                        </CardHeader>
                        <CardContent className="pb-4">
                            <div className="space-y-3">
                                {upcomingFixtures.length > 0 ? (
                                    upcomingFixtures.map((match, i) => (
                                        <div key={i} className="flex items-center justify-between border-b border-slate-105 pb-2 last:border-0 last:pb-0">
                                            <div>
                                                <p className="font-semibold text-xs text-slate-800">{match.opponent}</p>
                                                <p className="text-[10px] text-slate-500 font-medium">
                                                    {match.isHome ? "🏠 Home" : "🚌 Away"} • {match.competition}
                                                </p>
                                            </div>
                                            <div className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">{formatDate(match.date)}</div>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-xs text-slate-450 text-center py-2 font-medium">No upcoming fixtures scheduled</p>
                                )}
                            </div>
                        </CardContent>
                    </div>
                </Card>
            </div>

            {/* Live Activity Feed */}
            <Card className="bg-white/70 backdrop-blur-md border-white/40 shadow-sm border relative z-10">
                <CardHeader className="pb-3">
                    <CardTitle className="text-base font-bold text-slate-900">Recent Squad RSVP Check-ins</CardTitle>
                    <CardDescription className="text-xs">Real-time availability updates from players</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {activities.length === 0 ? (
                            <p className="text-xs text-slate-500 italic text-center py-4">No recent RSVPs logged yet.</p>
                        ) : (
                            activities.map((act, i) => {
                                const isAvailable = act.details.includes("marked Available") || act.details.includes("Present");
                                return (
                                    <div key={i} className="flex items-start justify-between gap-4 border-b pb-3 last:border-0 last:pb-0">
                                        <div className="flex items-start gap-3">
                                            <div className={`h-8 w-8 rounded-full flex items-center justify-center font-black text-xs shrink-0 ${
                                                isAvailable ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200"
                                            }`}>
                                                {isAvailable ? "✓" : "✗"}
                                            </div>
                                            <div>
                                                <p className="text-xs font-bold text-slate-800">{act.user_name}</p>
                                                <p className="text-xs text-slate-550 mt-0.5">{act.details}</p>
                                            </div>
                                        </div>
                                        <div className="text-[10px] text-slate-405 shrink-0 font-medium mt-0.5">
                                            {new Date(act.created_at).toLocaleDateString("en-GB", {
                                                day: "numeric",
                                                month: "short",
                                                hour: "2-digit",
                                                minute: "2-digit"
                                            })}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Player Stats Leaderboard */}
            <div className="grid gap-6 md:grid-cols-3 relative z-10">
                {/* Top Goalscorers */}
                <Card className="bg-white/70 backdrop-blur-md border-white/40 shadow-sm border">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-505 flex items-center gap-2">
                            <span>⚽</span> Top Goalscorers
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {players
                                .filter(p => p.goals > 0)
                                .sort((a, b) => b.goals - a.goals)
                                .slice(0, 5)
                                .map((player, i) => (
                                    <div key={player.id} className="flex items-center justify-between text-xs">
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-slate-400 w-4">{i + 1}.</span>
                                            <span className="font-semibold text-slate-800">{formatPlayerName(player)}</span>
                                        </div>
                                        <span className="font-black text-slate-900 bg-red-50 text-red-600 px-2 py-0.5 rounded border border-red-100">{player.goals} goal{player.goals !== 1 ? 's' : ''}</span>
                                    </div>
                                ))}
                            {players.filter(p => p.goals > 0).length === 0 && (
                                <p className="text-xs text-slate-400 italic text-center py-2">No goals scored yet.</p>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Top Playmakers */}
                <Card className="bg-white/70 backdrop-blur-md border-white/40 shadow-sm border">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-505 flex items-center gap-2">
                            <span>🅰️</span> Top Playmakers (Assists)
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {players
                                .filter(p => p.assists > 0)
                                .sort((a, b) => b.assists - a.assists)
                                .slice(0, 5)
                                .map((player, i) => (
                                    <div key={player.id} className="flex items-center justify-between text-xs">
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-slate-400 w-4">{i + 1}.</span>
                                            <span className="font-semibold text-slate-800">{formatPlayerName(player)}</span>
                                        </div>
                                        <span className="font-black text-slate-900 bg-blue-50 text-blue-600 px-2 py-0.5 rounded border border-blue-100">{player.assists} assist{player.assists !== 1 ? 's' : ''}</span>
                                    </div>
                                ))}
                            {players.filter(p => p.assists > 0).length === 0 && (
                                <p className="text-xs text-slate-400 italic text-center py-2">No assists logged yet.</p>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Most Appearances */}
                <Card className="bg-white/70 backdrop-blur-md border-white/40 shadow-sm border">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-505 flex items-center gap-2">
                            <span>🏃</span> Most Appearances
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {players
                                .filter(p => p.appearances > 0)
                                .sort((a, b) => b.appearances - a.appearances)
                                .slice(0, 5)
                                .map((player, i) => (
                                    <div key={player.id} className="flex items-center justify-between text-xs">
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-slate-400 w-4">{i + 1}.</span>
                                            <span className="font-semibold text-slate-800">{formatPlayerName(player)}</span>
                                        </div>
                                        <span className="font-black text-slate-900 bg-emerald-50 text-emerald-650 px-2 py-0.5 rounded border border-emerald-100">{player.appearances} match{player.appearances !== 1 ? 'es' : ''}</span>
                                    </div>
                                ))}
                            {players.filter(p => p.appearances > 0).length === 0 && (
                                <p className="text-xs text-slate-400 italic text-center py-2">No appearances logged yet.</p>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
