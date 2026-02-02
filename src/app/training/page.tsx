"use client";

import { useState, useEffect } from "react";
import { TrainingSession, SquadType, Player } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, CalendarDays, MapPin, Users, Trash2, Pencil, BarChart3, List, Download, ClipboardList } from "lucide-react";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/lib/supabase";

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

export default function TrainingPage() {
    const SQUAD_LABELS: Record<string, string> = {
        firstTeam: "First Team",
        midweek: "Midweek",
        youth: "Youth"
    };

    const [sessions, setSessions] = useState<TrainingSession[]>([]);
    const [players, setPlayers] = useState<Player[]>([]);
    const [activeTab, setActiveTab] = useState<'sessions' | 'stats'>('sessions');

    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
    const [newSession, setNewSession] = useState<{
        date: string;
        time: string;
        location: string;
        squad: SquadType | "All";
        topic: string;
    }>({
        date: "",
        time: "20:15",
        location: "Harris Lowe Academy",
        squad: "firstTeam",
        topic: ""
    });
    // ...

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
                location: "Harris Lowe Academy",
                squad: "firstTeam",
                topic: ""
            });
            setEditingSessionId(null);
        } catch (e: any) {
            alert("Error saving session: " + e.message);
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
            location: "Harris Lowe Academy",
            squad: "firstTeam",
            topic: ""
        });
        setIsDialogOpen(true);
    };

    const upcomingSessions = sessions.sort((a, b) =>
        new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    // Calculate Season Stats
    const now = new Date();

    // Determine Season Start Date
    let seasonStartDate: Date;
    let displaySeasonLabel = "Current Season";

    // Current period requested: Jan 6th 2026 until June 2026.
    if (now < new Date(2026, 5, 1)) {
        seasonStartDate = new Date(2026, 0, 6); // Jan 6th
        displaySeasonLabel = "From Jan 6th, 2026";
    } else {
        // Standard Season Logic (Starts June 1st)
        const currentYear = now.getFullYear();
        const startYear = now.getMonth() < 5 ? currentYear - 1 : currentYear;
        seasonStartDate = new Date(startYear, 5, 1);
        displaySeasonLabel = `Season ${startYear}/${startYear + 1} (Starts June 1st)`;
    }

    const seasonSessions = sessions.filter(s => {
        const d = new Date(s.date);
        // Include session if it's in the season AND in the past (or today)
        return d >= seasonStartDate && d <= now;
    });

    const playerStats = players
        .filter(p => p.squad === "firstTeam" || p.isInTrainingSquad) // firstTeam + tracked players
        .map(player => {
            const attended = seasonSessions.filter(s => {
                const record = s.attendance.find(a => a.playerId === player.id);
                return record?.status === 'Present' || record?.status === 'Late'; // Late counts as present? Let's say yes for attendance stats, or maybe distinguish. Usually "Attended" includes late.
            }).length;

            const total = seasonSessions.length;
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
                <div className="flex items-center gap-3">
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
                            <BarChart3 className="h-4 w-4 mr-2" /> Season Stats
                        </button>
                    </div>
                    {activeTab === 'sessions' && (
                        <div className="flex gap-2">
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
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-blue-600" onClick={(e) => { e.stopPropagation(); handleEdit(session); }}>
                                    <Pencil className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-600" onClick={(e) => { e.stopPropagation(); handleDelete(session.id); }}>
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                            <CardHeader className="pb-2">
                                <div className="flex justify-between items-start pr-16">
                                    <Badge variant="outline">{session.squad} Squad</Badge>
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
                                    <div className="flex items-center gap-2">
                                        <Users className="h-4 w-4 text-slate-400" />
                                        <span>{session.attendance.filter(a => a.status === 'Present' || a.status === 'Late').length} players attended</span>
                                    </div>
                                </div>
                                <Button variant="secondary" className="w-full mt-4" asChild>
                                    <Link href={`/training/${session.id}`}>Manage Session</Link>
                                </Button>
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
                                <CardTitle>Attendance Leaderboard</CardTitle>
                                <CardDescription>Tracking {displaySeasonLabel}</CardDescription>
                            </div>
                            <div className="flex items-center gap-4">
                                <Button variant="outline" size="sm" onClick={downloadStatsCSV}>
                                    <Download className="h-4 w-4 mr-2" /> Export CSV
                                </Button>
                                <div className="text-right">
                                    <p className="text-sm font-medium text-slate-500">Total Sessions</p>
                                    <p className="text-2xl font-bold">{seasonSessions.length}</p>
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
                                        <th className="px-4 py-3 text-center">% Rate</th>
                                        <th className="px-4 py-3 rounded-r-lg">Status</th>
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
                                            <td className="px-4 py-3 text-slate-500">{SQUAD_LABELS[player.squad] || player.squad}</td>
                                            <td className="px-4 py-3 text-center font-medium">{player.stats.attended} / {player.stats.total}</td>
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
                                    <option value="firstTeam">First Team</option>
                                    <option value="midweek">Midweek</option>
                                    <option value="youth">Youth</option>
                                    <option value="All">All Squads</option>
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
        </div>
    );
}
