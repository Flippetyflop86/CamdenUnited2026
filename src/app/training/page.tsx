"use client";

import { useState, useEffect } from "react";
import { TrainingSession, Player } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, CalendarDays, MapPin, Users, Trash2, Pencil, BarChart3, List, Download, ClipboardList, MessageCircle, Copy, ExternalLink, Link2, Repeat } from "lucide-react";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/lib/supabase";
import { useClub } from "@/context/club-context";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

// I'll stick to native date formatting for zero-dep speed unless complex.
function formatDate(dateStr: string) {
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat("en-GB", { weekday: 'short', day: 'numeric', month: 'short' }).format(date);
}

function getSeasonString(date: Date) {
    const year = date.getFullYear();
    const month = date.getMonth(); // 0-11
    // Season starts June 1st (Month index 5)
    // If before June, we are in the (Year-1)/Year season.
    // If after June, we are in the Year/(Year+1) season.
    const startYear = month < 5 ? year - 1 : year;
    return `${startYear}/${startYear + 1}`;
}

function formatSquad(squad: string) {
    if (squad === "firstTeam") return "First Team";
    if (squad === "midweek") return "Midweek";
    if (squad === "youth") return "Youth";
    return squad;
}

export default function TrainingPage() {
    const { settings } = useClub();
    const currentSquads = settings.squads || ["First Team"];

    const [sessions, setSessions] = useState<TrainingSession[]>([]);
    const [players, setPlayers] = useState<Player[]>([]);
    const [activeTab, setActiveTab] = useState<'sessions' | 'stats'>('sessions');

    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
    const [newSession, setNewSession] = useState<{
        date: string;
        time: string;
        location: string;
        squad: string;
        topic: string;
    }>({
        date: "",
        time: "20:15",
        location: settings.trainingLocation || "",
        squad: currentSquads[0] || "First Team",
        topic: ""
    });

    const [squadFilter, setSquadFilter] = useState<string>("All");

    // WhatsApp Generated Availability Poll State
    const [activeShareSession, setActiveShareSession] = useState<TrainingSession | null>(null);
    const [includeVenue, setIncludeVenue] = useState(true);
    const [includeTopic, setIncludeTopic] = useState(true);
    const [includeNotes, setIncludeNotes] = useState(true);
    const [additionalNotes, setAdditionalNotes] = useState("");
    const [copyStatus, setCopyStatus] = useState<"idle" | "copied">("idle");

    useEffect(() => {
        if (settings.trainingLocation && !newSession.location && !editingSessionId) {
            setNewSession(prev => ({ ...prev, location: settings.trainingLocation || "" }));
        }
    }, [settings.trainingLocation, editingSessionId]);


    useEffect(() => {
        fetchData();

        const channel = supabase
            .channel("public:training_sessions")
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "training_sessions" },
                () => fetchSessionsOnly()
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, []);

    const fetchData = async () => {
        await Promise.all([fetchSessionsOnly(), fetchPlayers()]);
    };

    const fetchSessionsOnly = async () => {
        const { data, error } = await supabase.from("training_sessions").select("*");
        if (!error && data) {
            setSessions(data.map((s: any) => ({
                id: s.id,
                date: s.date,
                time: s.time,
                location: s.location,
                squad: s.squad,
                topic: s.topic,
                attendance: s.attendance || [],
                notes: s.notes
            })));
        }
    };

    const fetchPlayers = async () => {
        const { data, error } = await supabase.from("players").select("*");
        if (!error && data) {
            // Map simple fields needed for stats
            setPlayers(data.map((p: any) => ({
                id: p.id,
                firstName: p.first_name,
                lastName: p.last_name,
                squad: p.squad,
                isInTrainingSquad: p.is_in_training_squad,
                isInMatchdayTracker: p.is_in_matchday_tracker,
                imageUrl: p.image_url,
                // ... other fields not strictly needed for this page but good for types
                position: p.position,
                squadNumber: p.squad_number,
                medicalStatus: p.medical_status
            } as any)));
        }
    };

    // Note: Removed local storage save effect.

    const handleSchedule = async () => {
        const payload = {
            date: newSession.date,
            time: newSession.time,
            location: newSession.location,
            squad: newSession.squad,
            topic: newSession.topic || "General Session"
        };

        try {
            if (editingSessionId) {
                const { error } = await supabase
                    .from("training_sessions")
                    .update(payload)
                    .eq("id", editingSessionId);
                if (error) throw error;
            } else {
                // New session
                const { error } = await supabase
                    .from("training_sessions")
                    .insert([{ ...payload, attendance: [], notes: "" }]);
                if (error) throw error;
            }
            // Fetch/Subscribe will handle UI update
            setIsDialogOpen(false);
            // Reset form but keep location
            setNewSession({
                date: "",
                time: "20:15",
                location: settings.trainingLocation || "",
                squad: currentSquads[0] || "First Team",
                topic: ""
            });
            setEditingSessionId(null);
        } catch (e: any) {
            alert("Error saving session: " + e.message);
        }
    };

    const handleRepeatNextWeek = async (session: TrainingSession, e: React.MouseEvent) => {
        e.stopPropagation();
        
        // Calculate date of next week (add 7 days)
        const d = new Date(session.date);
        d.setDate(d.getDate() + 7);
        const nextWeekDate = d.toISOString().split('T')[0];

        const payload = {
            date: nextWeekDate,
            time: session.time,
            location: session.location,
            squad: session.squad,
            topic: session.topic || "General Session"
        };

        try {
            const { error } = await supabase
                .from("training_sessions")
                .insert([{ ...payload, attendance: [], notes: "" }]);

            if (error) throw error;
            alert(`Session repeated successfully for next week (${nextWeekDate})!`);
            fetchSessionsOnly();
        } catch (err: any) {
            alert("Failed to repeat session: " + err.message);
        }
    };

    const handleEdit = (session: TrainingSession) => {
        setNewSession({
            date: session.date,
            time: session.time,
            location: session.location,
            squad: session.squad,
            topic: session.topic || ""
        });
        setEditingSessionId(session.id);
        setIsDialogOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (window.confirm("Are you sure you want to delete this session?")) {
            const { error } = await supabase.from("training_sessions").delete().eq("id", id);
            if (error) {
                alert("Error deleting session");
            } else {
                // Optimistic or let subscription handle it? Subscription handles it but optimist is nicer
                setSessions(sessions.filter(s => s.id !== id));
            }
        }
    };

    const handleOpenNew = () => {
        setEditingSessionId(null);
        setNewSession({
            date: "",
            time: "20:15",
            location: settings.trainingLocation || "",
            squad: currentSquads[0] || "First Team",
            topic: ""
        });
        setIsDialogOpen(true);
    };

    const isFirstTeamSquad = (squad: string) => {
        return squad === "firstTeam" || squad === "First Team" || squad === currentSquads[0];
    };

    const getSessionAttendanceStats = (session: TrainingSession) => {
        const attendedCount = session.attendance.filter(a => a.status === 'Present' || a.status === 'Late').length;
        const eligiblePlayers = players.filter(p => 
            session.squad === "All" 
                ? (isFirstTeamSquad(p.squad) || p.isInTrainingSquad) 
                : (p.squad === session.squad || (session.squad === "First Team" && isFirstTeamSquad(p.squad)))
        );
        const totalEligible = eligiblePlayers.length;
        const percentage = totalEligible > 0 ? Math.round((attendedCount / totalEligible) * 100) : 0;
        return { attendedCount, totalEligible, percentage };
    };

    const filteredSessions = sessions.filter(s => squadFilter === "All" || s.squad === squadFilter);

    const upcomingSessions = filteredSessions.sort((a, b) =>
        new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    const formatTrainingDate = (dateStr: string) => {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        const weekday = new Intl.DateTimeFormat("en-GB", { weekday: 'long' }).format(d);
        const day = d.getDate();
        const month = new Intl.DateTimeFormat("en-GB", { month: 'long' }).format(d);
        const year = d.getFullYear();
        return `${weekday} ${day} ${month} ${year}`;
    };

    const formatTime12h = (timeStr: string) => {
        if (!timeStr || !timeStr.includes(':')) return { time: timeStr, emoji: "🕒" };
        const [hStr, mStr] = timeStr.split(':');
        let hours = parseInt(hStr, 10);
        const minutes = parseInt(mStr, 10);
        if (isNaN(hours) || isNaN(minutes)) return { time: timeStr, emoji: "🕒" };

        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12;
        hours = hours ? hours : 12;
        const minutesStr = minutes < 10 ? '0' + minutes : minutes;
        const formatted = `${hours}:${minutesStr} ${ampm}`;

        let emoji = "🕒";
        if (hours === 7) emoji = minutes >= 30 ? "🕢" : "🕖";
        else if (hours === 8) emoji = minutes >= 30 ? "🕣" : "🕗";
        else if (hours === 9) emoji = minutes >= 30 ? "🕤" : "🕘";
        else if (hours === 10) emoji = minutes >= 30 ? "🕥" : "🕙";
        else if (hours === 11) emoji = minutes >= 30 ? "🕦" : "🕚";
        else if (hours === 12) emoji = minutes >= 30 ? "🕧" : "🕛";
        else if (hours === 1) emoji = minutes >= 30 ? "🕜" : "🕐";
        else if (hours === 2) emoji = minutes >= 30 ? "🕝" : "🕑";
        else if (hours === 3) emoji = minutes >= 30 ? "🕞" : "🕒";
        else if (hours === 4) emoji = minutes >= 30 ? "🕟" : "🕓";
        else if (hours === 5) emoji = minutes >= 30 ? "🕠" : "🕔";
        else if (hours === 6) emoji = minutes >= 30 ? "🕡" : "🕕";

        return { time: formatted, emoji };
    };

    const handleOpenShare = (session: TrainingSession) => {
        setActiveShareSession(session);
        setIncludeVenue(true);
        setIncludeTopic(true);
        setIncludeNotes(true);
        setAdditionalNotes("");
        setCopyStatus("idle");
    };

    const getTrainingGeneratedPollText = () => {
        if (!activeShareSession) return "";

        let parts: string[] = [];
        parts.push("⚽ TRAINING AVAILABILITY");

        let details: string[] = [];
        const dateFormatted = formatTrainingDate(activeShareSession.date);
        details.push(`📅 ${dateFormatted}`);

        const timeInfo = formatTime12h(activeShareSession.time);
        details.push(`${timeInfo.emoji} ${timeInfo.time}`);

        if (includeVenue && activeShareSession.location) {
            details.push(`📍 ${activeShareSession.location}`);
        }

        if (includeTopic && activeShareSession.topic) {
            details.push(`📋 Topic: ${activeShareSession.topic}`);
        }

        parts.push(details.join("\n"));

        if (includeNotes && additionalNotes.trim()) {
            parts.push(additionalNotes.trim());
        }

        parts.push("Please confirm your availability:\n\n✅ Available\n❌ Unavailable");

        return parts.join("\n\n");
    };

    const handleCopyTrainingShareText = () => {
        const text = getTrainingGeneratedPollText();
        if (!text) return;
        navigator.clipboard.writeText(text).then(() => {
            setCopyStatus("copied");
            setTimeout(() => setCopyStatus("idle"), 2000);
        }).catch(err => {
            console.error("Failed to copy text:", err);
            alert("Failed to copy to clipboard.");
        });
    };

    const handleSendTrainingWhatsApp = () => {
        const text = getTrainingGeneratedPollText();
        if (!text) return;
        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
    };

    // Calculate Season Stats
    const now = new Date();

    // Determine Season Start Date (Standard Season Logic: Starts June 1st)
    const currentYear = now.getFullYear();
    const startYear = now.getMonth() < 5 ? currentYear - 1 : currentYear; // Month 5 is June
    
    let seasonStartDate = new Date(startYear, 5, 1);
    
    // Absolute minimum tracking date: June 1st 2026
    const absoluteMinimumDate = new Date(2026, 5, 1);
    if (seasonStartDate < absoluteMinimumDate) {
        seasonStartDate = absoluteMinimumDate;
    }

    const seasonLabelYear = seasonStartDate.getFullYear();
    const displaySeasonLabel = `Season ${seasonLabelYear.toString().slice(-2)}/${(seasonLabelYear + 1).toString().slice(-2)} (Tracking from June 1st)`;

    const seasonSessions = sessions.filter(s => {
        const d = new Date(s.date);
        // Include any session in the season window that has attendance marked,
        // whether past or future (so pre-scheduled sessions with saved attendance count)
        const hasAttendance = s.attendance && s.attendance.length > 0;
        return d >= seasonStartDate && (d <= now || hasAttendance);
    });

    const leaderboardSessions = seasonSessions.filter(s => squadFilter === "All" || s.squad === squadFilter);

    const leaderboardPlayers = squadFilter === "All"
        ? players.filter(p => isFirstTeamSquad(p.squad) || p.isInTrainingSquad)
        : players.filter(p => p.squad === squadFilter || (squadFilter === "First Team" && isFirstTeamSquad(p.squad)));

    const playerStats = leaderboardPlayers
        .map(player => {
            const attended = leaderboardSessions.filter(s => {
                const record = s.attendance.find(a => a.playerId === player.id);
                return record?.status === 'Present' || record?.status === 'Late'; // Late counts as present? Let's say yes for attendance stats, or maybe distinguish. Usually "Attended" includes late.
            }).length;

            const total = leaderboardSessions.length;
            const percentage = total > 0 ? Math.round((attended / total) * 100) : 0;

            return { ...player, stats: { attended, total, percentage } };
        })
        .sort((a, b) => b.stats.percentage - a.stats.percentage); // Sort by %

    const downloadStatsCSV = () => {
        const headers = ["Player", "Squad", "Attended", "Total", "Percentage"];
        const rows = playerStats.map(p => [
            `${p.firstName} ${p.lastName}`,
            p.squad,
            p.stats.attended,
            p.stats.total,
            `${p.stats.percentage}%`
        ]);

        const csvContent = [
            headers.join(","),
            ...rows.map(row => row.join(","))
        ].join("\n");

        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `training_stats_${displaySeasonLabel.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-slate-900">Training</h2>
                    <p className="text-slate-500">Manage sessions and track attendance.</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <select
                        value={squadFilter}
                        onChange={(e) => setSquadFilter(e.target.value)}
                        className="flex h-9 rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-950 cursor-pointer text-slate-700 font-medium"
                    >
                        <option value="All">All Squads</option>
                        {currentSquads.map((squad) => (
                            <option key={squad} value={squad}>
                                {squad}
                            </option>
                        ))}
                    </select>
                    <div className="flex bg-slate-100 p-1 rounded-lg">
                        <button
                            onClick={() => setActiveTab('sessions')}
                            className={`flex items-center px-3 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === 'sessions' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
                        >
                            <List className="h-4 w-4 mr-2" /> Sessions
                        </button>
                        <button
                            onClick={() => setActiveTab('stats')}
                            className={`flex items-center px-3 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === 'stats' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
                        >
                            <BarChart3 className="h-4 w-4 mr-2" /> Training Attendance
                        </button>
                    </div>
                    {activeTab === 'sessions' && (
                        <div className="flex gap-2">
                            <Button className="bg-emerald-600 hover:bg-emerald-700 hidden sm:flex" onClick={() => {
                                const nextSession = upcomingSessions.find(s => new Date(s.date) >= new Date(new Date().setHours(0,0,0,0)));
                                if (nextSession) {
                                    handleOpenShare(nextSession);
                                } else {
                                    alert("No upcoming training sessions found.");
                                }
                            }}>
                                <MessageCircle className="h-4 w-4 mr-2" /> WhatsApp Poll
                            </Button>
                            <Button className="bg-red-600 hover:bg-red-700" onClick={handleOpenNew}>
                                <Plus className="h-4 w-4 mr-2" /> Schedule Session
                            </Button>
                        </div>
                    )}
                </div>
            </div>

            {activeTab === 'sessions' ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {upcomingSessions.map((session) => (
                        <Card key={session.id} className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-red-600 group relative">
                            <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-indigo-650" onClick={(e) => handleRepeatNextWeek(session, e)} title="Repeat Next Week">
                                    <Repeat className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50" onClick={(e) => { e.stopPropagation(); handleOpenShare(session); }}>
                                    <MessageCircle className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-blue-600" onClick={(e) => { e.stopPropagation(); handleEdit(session); }}>
                                    <Pencil className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-650" onClick={(e) => { e.stopPropagation(); handleDelete(session.id); }}>
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                            <CardHeader className="pb-2">
                                <div className="flex justify-between items-start pr-16">
                                    <Badge variant="outline">{formatSquad(session.squad)} Squad</Badge>
                                </div>
                                <CardTitle className="text-lg mt-2">{session.topic || "General Session"}</CardTitle>
                                <CardDescription className="flex items-center gap-1">
                                    <CalendarDays className="h-3 w-3" /> {formatDate(session.date)} • {session.time} - 22:00
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2 text-sm text-slate-600">
                                    <div className="flex items-center gap-2">
                                        <MapPin className="h-4 w-4 text-slate-400" />
                                        <span>{session.location}</span>
                                    </div>
                                    {(() => {
                                        const { attendedCount, totalEligible, percentage } = getSessionAttendanceStats(session);
                                        return (
                                            <div className="flex items-center gap-2">
                                                <Users className="h-4 w-4 text-slate-400" />
                                                <span>{attendedCount} / {totalEligible} ({percentage}%) players attended</span>
                                            </div>
                                        );
                                    })()}
                                </div>
                                <div className="flex gap-2 mt-4">
                                    <Button variant="secondary" className="flex-1" asChild>
                                        <Link href={`/training/${session.id}`}>Manage Session</Link>
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        className="text-slate-600 hover:text-slate-900 border-slate-200"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            const link = `${window.location.origin}/checkin/${session.id}`;
                                            navigator.clipboard.writeText(link);
                                            alert("Check-in link copied to clipboard!");
                                        }}
                                        title="Copy Public Check-in Link"
                                    >
                                        <Link2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                    {upcomingSessions.length === 0 && (
                        <div className="col-span-full py-12 text-center text-slate-500 border-2 border-dashed rounded-lg">
                            No training sessions scheduled.
                        </div>
                    )}
                </div>
            ) : (
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle>Training Attendance</CardTitle>
                                <CardDescription>Tracking {displaySeasonLabel}</CardDescription>
                            </div>
                            <div className="flex items-center gap-4">
                                <Button variant="outline" size="sm" onClick={downloadStatsCSV}>
                                    <Download className="h-4 w-4 mr-2" /> Export CSV
                                </Button>
                                <div className="text-right">
                                    <p className="text-sm font-medium text-slate-500">Total Sessions</p>
                                    <p className="text-2xl font-bold">{leaderboardSessions.length}</p>
                                </div>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-50 text-slate-500 uppercase font-medium">
                                    <tr>
                                        <th className="px-4 py-3 rounded-l-lg">Player</th>
                                        <th className="px-4 py-3">Squad</th>
                                        <th className="px-4 py-3 text-center">Attended</th>
                                        <th className="px-4 py-3 text-center">Attendance %</th>
                                        <th className="px-4 py-3 rounded-r-lg">Progress</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {playerStats.map((player) => (
                                        <tr key={player.id} className="hover:bg-slate-50">
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-3">
                                                    <Avatar className="h-8 w-8">
                                                        <AvatarImage src={player.imageUrl} />
                                                        <AvatarFallback>{player.firstName[0]}{player.lastName[0]}</AvatarFallback>
                                                    </Avatar>
                                                    <span className="font-medium text-slate-900">{player.firstName} {player.lastName}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-slate-500">{formatSquad(player.squad)}</td>
                                            <td className="px-4 py-3 text-center">
                                                <div className="font-medium">{player.stats.attended}/{player.stats.total}</div>
                                                <div className="text-xs text-slate-500 mt-0.5">{player.stats.percentage}%</div>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <Badge variant={player.stats.percentage >= 80 ? 'default' : player.stats.percentage >= 50 ? 'secondary' : 'destructive'}>
                                                    {player.stats.percentage}%
                                                </Badge>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="w-full bg-slate-200 rounded-full h-2">
                                                    <div
                                                        className={`h-2 rounded-full ${player.stats.percentage >= 80 ? 'bg-green-500' : player.stats.percentage >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                                                        style={{ width: `${player.stats.percentage}%` }}
                                                    ></div>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {playerStats.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                                                No training stats available for this season yet.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            )}

            {isDialogOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden">
                        <div className="p-4 border-b bg-slate-50 flex justify-between items-center">
                            <h3 className="font-semibold text-lg">{editingSessionId ? "Edit Session" : "Schedule New Session"}</h3>
                            <button onClick={() => setIsDialogOpen(false)} className="text-slate-400 hover:text-slate-700">✕</button>
                        </div>
                        <div className="p-4 space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Date</label>
                                <Input
                                    type="date"
                                    value={newSession.date}
                                    onChange={(e) => setNewSession({ ...newSession, date: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Time</label>
                                <Input
                                    type="time"
                                    value={newSession.time}
                                    onChange={(e) => setNewSession({ ...newSession, time: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Location</label>
                                <Input
                                    value={newSession.location}
                                    onChange={(e) => setNewSession({ ...newSession, location: e.target.value })}
                                    placeholder="Enter location"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Squad</label>
                                <select
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                    value={newSession.squad}
                                    onChange={(e) => setNewSession({ ...newSession, squad: e.target.value as any })}
                                >
                                    <option value="All">All Squads</option>
                                    {currentSquads.map(squad => (
                                        <option key={squad} value={squad}>{squad}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Topic (Optional)</label>
                                <Input
                                    value={newSession.topic}
                                    onChange={(e) => setNewSession({ ...newSession, topic: e.target.value })}
                                    placeholder="e.g. Possession & Pressing"
                                />
                            </div>
                        </div>
                        <div className="p-4 border-t bg-slate-50 flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                            <Button onClick={handleSchedule} disabled={!newSession.date}>
                                {editingSessionId ? "Save Changes" : "Schedule"}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
            {/* Share WhatsApp Poll Modal */}
            <Dialog open={activeShareSession !== null} onOpenChange={(open) => { if (!open) setActiveShareSession(null); }}>
                <DialogContent className="sm:max-w-[620px] max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-emerald-700">
                            <MessageCircle className="h-5 w-5" /> Generate Training Availability Poll
                        </DialogTitle>
                        <DialogDescription>
                            Configure the details to generate an availability message for training.
                        </DialogDescription>
                    </DialogHeader>

                    {activeShareSession && (
                        <div className="grid gap-4 py-2 text-slate-800">
                            {/* Toggle switches/checkboxes */}
                            <div className="space-y-2 border-b border-slate-100 pb-3">
                                <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Include Details:</Label>
                                <div className="grid grid-cols-3 gap-2">
                                    <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer p-1.5 hover:bg-slate-50 rounded">
                                        <input
                                            type="checkbox"
                                            checked={includeVenue}
                                            onChange={(e) => setIncludeVenue(e.target.checked)}
                                            className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                        />
                                        <span>Venue</span>
                                    </label>
                                    <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer p-1.5 hover:bg-slate-50 rounded">
                                        <input
                                            type="checkbox"
                                            checked={includeTopic}
                                            onChange={(e) => setIncludeTopic(e.target.checked)}
                                            className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                        />
                                        <span>Topic</span>
                                    </label>
                                    <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer p-1.5 hover:bg-slate-50 rounded">
                                        <input
                                            type="checkbox"
                                            checked={includeNotes}
                                            onChange={(e) => setIncludeNotes(e.target.checked)}
                                            className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                        />
                                        <span>Notes</span>
                                    </label>
                                </div>
                            </div>

                            {/* Additional Notes Textarea */}
                            {includeNotes && (
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-semibold">Additional Notes (Optional)</Label>
                                    <Textarea
                                        value={additionalNotes}
                                        onChange={(e) => setAdditionalNotes(e.target.value)}
                                        placeholder="e.g. ⚠ Bring running trainers."
                                        className="text-xs min-h-[60px] border-slate-200"
                                    />
                                </div>
                            )}

                            {/* Live Preview block */}
                            <div className="space-y-1.5 border-t border-slate-100 pt-3">
                                <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Live Preview</Label>
                                <div className="relative">
                                    <Textarea
                                        value={getTrainingGeneratedPollText()}
                                        readOnly
                                        className="text-xs min-h-[200px] font-mono bg-slate-50 border-slate-200 text-slate-600 focus-visible:ring-0 cursor-default"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    <DialogFooter className="gap-2 sm:gap-0 border-t border-slate-100 pt-3">
                        <Button variant="outline" onClick={() => setActiveShareSession(null)}>
                            Cancel
                        </Button>
                        <Button
                            variant={copyStatus === "copied" ? "default" : "secondary"}
                            onClick={handleCopyTrainingShareText}
                            className={`font-semibold min-w-[160px] transition-all ${
                                copyStatus === "copied" 
                                    ? "bg-green-600 hover:bg-green-600 text-white" 
                                    : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                            }`}
                        >
                            {copyStatus === "copied" ? "✓ Copied Successfully" : "Copy to Clipboard"}
                        </Button>
                        <Button
                            onClick={handleSendTrainingWhatsApp}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                        >
                            <ExternalLink className="h-4 w-4 mr-2" /> Send to WhatsApp
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
