"use client";

import { useEffect, useState } from "react";
import { TrainingSession, Player } from "@/types";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowLeft, CalendarDays, MapPin, Clock, Download } from "lucide-react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

function formatSquad(squad: string) {
    if (squad === "firstTeam") return "First Team";
    if (squad === "midweek") return "Midweek";
    if (squad === "youth") return "Youth";
    return squad;
}

export default function TrainingSessionPage() {
    const routeParams = useParams();
    const [session, setSession] = useState<TrainingSession | null>(null);
    const [players, setPlayers] = useState<Player[]>([]);
    const [loading, setLoading] = useState(true);
    const [unsavedChanges, setUnsavedChanges] = useState(false);

    useEffect(() => {
        const fetchSessionData = async () => {
            const id = routeParams?.id;
            const sessionId = Array.isArray(id) ? id[0] : id;
            if (!sessionId) return;

            try {
                const [sessionRes, playersRes] = await Promise.all([
                    supabase.from('training_sessions').select('*').eq('id', sessionId).single(),
                    supabase.from('players').select('*')
                ]);

                if (playersRes.data) {
                    const mappedPlayers: Player[] = playersRes.data.map((p: any) => ({
                        id: p.id,
                        firstName: p.first_name,
                        lastName: p.last_name,
                        position: p.position,
                        squadNumber: p.squad_number,
                        age: p.age,
                        nationality: p.nationality,
                        squad: p.squad,
                        medicalStatus: p.medical_status,
                        availability: p.availability,
                        contractExpiry: p.contract_expiry,
                        imageUrl: p.image_url,
                        appearances: p.appearances,
                        goals: p.goals,
                        assists: p.assists,
                        dateOfBirth: p.date_of_birth,
                        notes: p.notes,
                        isInTrainingSquad: p.is_in_training_squad
                    }));
                    setPlayers(mappedPlayers);

                    if (sessionRes.data) {
                        const existingAttendance: any[] = sessionRes.data.attendance || [];

                        // Pre-populate ALL eligible players as Absent if no record exists
                        const eligible = mappedPlayers.filter(p => p.squad === "firstTeam" || p.isInTrainingSquad);
                        const prePopulated = eligible.map(p => {
                            const existing = existingAttendance.find(a => a.playerId === p.id);
                            return existing || { playerId: p.id, status: 'Absent', notes: '' };
                        });

                        setSession({ ...sessionRes.data, attendance: prePopulated });
                    }
                }
            } catch (error) {
                console.error("Error fetching data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchSessionData();
    }, [routeParams]);

    // Single tap: toggle Present ↔ Absent
    const handleTogglePresent = (playerId: string) => {
        if (!session) return;
        const idx = session.attendance.findIndex(a => a.playerId === playerId);
        let updated = [...session.attendance];

        if (idx >= 0) {
            const current = updated[idx].status;
            updated[idx] = { ...updated[idx], status: current === 'Present' ? 'Absent' : 'Present' };
        } else {
            updated.push({ playerId, status: 'Present', notes: '' });
        }

        setSession({ ...session, attendance: updated });
        setUnsavedChanges(true);
    };

    // Small 🚑 button: toggle Injured ↔ Absent
    const handleMarkInjured = (playerId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!session) return;
        const idx = session.attendance.findIndex(a => a.playerId === playerId);
        let updated = [...session.attendance];

        if (idx >= 0) {
            const current = updated[idx].status;
            updated[idx] = { ...updated[idx], status: current === 'Injured' ? 'Absent' : 'Injured' };
        } else {
            updated.push({ playerId, status: 'Injured', notes: '' });
        }

        setSession({ ...session, attendance: updated });
        setUnsavedChanges(true);
    };

    const handleSave = async () => {
        if (!session) return;
        const { error } = await supabase
            .from('training_sessions')
            .update({ attendance: session.attendance })
            .eq('id', session.id);

        if (error) {
            alert("Error saving attendance: " + error.message);
        } else {
            setUnsavedChanges(false);
        }
    };

    const downloadSessionCSV = () => {
        if (!session) return;
        const headers = ["Player", "Squad", "Position", "Status"];
        const rows = eligiblePlayers.map(p => {
            const record = session.attendance.find(a => a.playerId === p.id);
            return [`${p.firstName} ${p.lastName}`, p.squad, p.position, record?.status ?? 'Absent'];
        });
        const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `session_${session.date}_${session.squad}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    if (loading) return <div className="p-8 text-center">Loading session details...</div>;
    if (!session) return <div className="p-8 text-center">Session not found.</div>;

    const positionOrder: Record<string, number> = {
        "GK": 1, "RB": 2, "LB": 2, "CB": 2, "RWB": 2, "LWB": 2, "DEF": 2,
        "CDM": 3, "CM": 3, "CAM": 3, "RM": 3, "LM": 3, "MID": 3,
        "RW": 4, "LW": 4, "CF": 4, "ST": 4, "FWD": 4
    };

    const eligiblePlayers = players
        .filter(p => p.squad === "firstTeam" || p.isInTrainingSquad)
        .sort((a, b) => (positionOrder[a.position] || 99) - (positionOrder[b.position] || 99));

    const presentCount = session.attendance.filter(a => a.status === 'Present').length;
    const absentCount = session.attendance.filter(a => a.status === 'Absent').length;
    const injuredCount = session.attendance.filter(a => a.status === 'Injured').length;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" asChild>
                    <Link href="/training"><ArrowLeft className="h-4 w-4" /></Link>
                </Button>
                <div className="flex-1">
                    <h1 className="text-2xl font-bold text-slate-900">Manage Session</h1>
                </div>
                {unsavedChanges && (
                    <Badge variant="destructive" className="animate-pulse">Unsaved Changes</Badge>
                )}
            </div>

            {/* Session Details */}
            <Card className="w-full border-l-4 border-l-red-600 shadow-sm">
                <CardHeader className="pb-2">
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                        <div>
                            <Badge className="w-fit mb-2" variant="outline">
                                {formatSquad(session.squad as string)} Squad
                            </Badge>
                            <CardTitle className="text-xl">{session.topic || "General Session"}</CardTitle>
                            <CardDescription>Session Details</CardDescription>
                        </div>
                        <div className="flex gap-3">
                            <div className="text-center px-4 py-2 bg-green-50 rounded-lg border border-green-100 min-w-[80px]">
                                <p className="text-2xl font-bold text-green-700 leading-none">{presentCount}</p>
                                <p className="text-xs text-green-600 font-bold uppercase tracking-wider mt-1">Present</p>
                            </div>
                            <div className="text-center px-4 py-2 bg-slate-100 rounded-lg border border-slate-200 min-w-[80px]">
                                <p className="text-2xl font-bold text-slate-600 leading-none">{absentCount}</p>
                                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-1">Absent</p>
                            </div>
                            {injuredCount > 0 && (
                                <div className="text-center px-4 py-2 bg-red-50 rounded-lg border border-red-100 min-w-[80px]">
                                    <p className="text-2xl font-bold text-red-700 leading-none">{injuredCount}</p>
                                    <p className="text-xs text-red-600 font-bold uppercase tracking-wider mt-1">Injured</p>
                                </div>
                            )}
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-wrap gap-x-8 gap-y-2 mt-2">
                        <div className="flex items-center gap-3 text-slate-700">
                            <CalendarDays className="h-5 w-5 text-red-600" />
                            <span className="font-medium">{session.date}</span>
                        </div>
                        <div className="flex items-center gap-3 text-slate-700">
                            <Clock className="h-5 w-5 text-red-600" />
                            <span className="font-medium">{session.time}</span>
                        </div>
                        <div className="flex items-center gap-3 text-slate-700">
                            <MapPin className="h-5 w-5 text-red-600" />
                            <span className="font-medium">{session.location}</span>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Attendance Register */}
            <Card className="shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between border-b bg-slate-50/50 flex-wrap gap-3">
                    <div>
                        <CardTitle>Attendance Register</CardTitle>
                        <CardDescription>
                            Tap a player to mark <strong>Present</strong> (green). Tap again to mark Absent. Use 🚑 for injuries.
                        </CardDescription>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={downloadSessionCSV}>
                            <Download className="h-4 w-4 mr-2" /> Export
                        </Button>
                        <Button
                            onClick={handleSave}
                            disabled={!unsavedChanges}
                            className={unsavedChanges ? "bg-red-600 hover:bg-red-700" : ""}
                        >
                            {unsavedChanges ? "Save Changes" : "Saved ✓"}
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="p-4">
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                        {eligiblePlayers.map((player) => {
                            const record = session.attendance.find(a => a.playerId === player.id);
                            const status = record?.status ?? 'Absent';
                            const isPresent = status === 'Present';
                            const isInjured = status === 'Injured';

                            return (
                                <div
                                    key={player.id}
                                    onClick={() => handleTogglePresent(player.id)}
                                    className={`
                                        relative flex flex-col items-center justify-center p-3 rounded-xl border-2 cursor-pointer
                                        transition-all duration-150 select-none text-center gap-1 min-h-[100px]
                                        ${isPresent
                                            ? 'bg-green-500 border-green-400 shadow-md scale-[1.02]'
                                            : isInjured
                                                ? 'bg-red-50 border-red-300'
                                                : 'bg-white border-slate-200 hover:border-slate-400 hover:bg-slate-50'
                                        }
                                    `}
                                >
                                    {/* Injured toggle */}
                                    <button
                                        onClick={(e) => handleMarkInjured(player.id, e)}
                                        title="Toggle Injured"
                                        className={`absolute top-1.5 right-1.5 rounded-full w-5 h-5 text-[10px] flex items-center justify-center transition-colors z-10
                                            ${isInjured ? 'bg-red-500' : 'bg-slate-100 hover:bg-red-100'}`}
                                    >
                                        🚑
                                    </button>

                                    <span className={`text-[10px] font-bold uppercase tracking-wider ${isPresent ? 'text-green-100' : 'text-slate-400'}`}>
                                        {player.position}
                                    </span>
                                    <span className={`text-sm font-bold leading-tight ${isPresent ? 'text-white' : isInjured ? 'text-red-700' : 'text-slate-800'}`}>
                                        {player.firstName}
                                    </span>
                                    <span className={`text-[11px] leading-tight ${isPresent ? 'text-green-100' : 'text-slate-500'}`}>
                                        {player.lastName}
                                    </span>
                                    <div className={`mt-1.5 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full
                                        ${isPresent ? 'bg-green-400 text-white' : isInjured ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-400'}`}>
                                        {isPresent ? '✓ Here' : isInjured ? 'Injured' : 'Absent'}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    {eligiblePlayers.length === 0 && (
                        <div className="text-center py-10 text-slate-500">No players found for this squad.</div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
