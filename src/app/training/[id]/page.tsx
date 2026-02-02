"use client";


import { useEffect, useState } from "react";
import { TrainingSession, Player } from "@/types";
import { notFound, useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, CalendarDays, MapPin, Clock, CheckCircle2, XCircle, AlertCircle, HelpCircle, Download } from "lucide-react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export default function TrainingSessionPage() {
    const router = useRouter();
    const routeParams = useParams();
    const [session, setSession] = useState<TrainingSession | null>(null);
    const [players, setPlayers] = useState<Player[]>([]);
    const [loading, setLoading] = useState(true);
    const [unsavedChanges, setUnsavedChanges] = useState(false);

    useEffect(() => {
        const fetchSessionData = async () => {
            // Ensure id is treated as a string
            const id = routeParams?.id;
            const sessionId = Array.isArray(id) ? id[0] : id;

            if (!sessionId) return;

            try {
                // Fetch Session and Players in parallel
                const [sessionRes, playersRes] = await Promise.all([
                    supabase.from('training_sessions').select('*').eq('id', sessionId).single(),
                    supabase.from('players').select('*')
                ]);

                if (sessionRes.data) {
                    setSession({
                        ...sessionRes.data,
                        // Ensure attendance is an array
                        attendance: sessionRes.data.attendance || []
                    });
                }

                if (playersRes.data) {
                    setPlayers(playersRes.data.map((p: any) => ({
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
                    })));
                }

            } catch (error) {
                console.error("Error fetching data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchSessionData();
    }, [routeParams]);

    const handleAttendance = (playerId: string, status: 'Present' | 'Absent' | 'Late' | 'Injured') => {
        if (!session) return;

        const existingRecordIndex = session.attendance.findIndex(a => a.playerId === playerId);
        let updatedattendance = [...session.attendance];

        if (existingRecordIndex >= 0) {
            updatedattendance[existingRecordIndex] = { ...updatedattendance[existingRecordIndex], status };
        } else {
            updatedattendance.push({ playerId, status, notes: "" });
        }

        setSession({ ...session, attendance: updatedattendance });
        setUnsavedChanges(true);
    };

    const handleSave = async () => {
        if (!session) return;

        const { error } = await supabase
            .from('training_sessions')
            .update({ attendance: session.attendance })
            .eq('id', session.id);

        if (error) {
            alert("Error saving attendance");
            console.error(error);
        } else {
            setUnsavedChanges(false);
            // alert("Attendance saved successfully!"); 
            // Optional: sleek toast or simple alert. The button text changes to "Saved" so alert might be redundant.
        }
    };

    const downloadSessionCSV = () => {
        if (!session) return;

        const headers = ["Player", "Squad", "Position", "Status"];
        const rows = eligiblePlayers.map(p => {
            const record = session.attendance.find(a => a.playerId === p.id);
            const status = record ? record.status : "Not Set";
            return [
                `${p.firstName} ${p.lastName}`,
                p.squad,
                p.position,
                status
            ];
        });

        const csvContent = [
            headers.join(","),
            ...rows.map(row => row.join(","))
        ].join("\n");

        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `session_${session.date}_${session.squad}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    if (loading) {
        return <div className="p-8 text-center">Loading session details...</div>;
    }

    if (!session) {
        return <div className="p-8 text-center">Session not found.</div>;
    }

    // Include firstTeam automatically, plus others marked for training
    const eligiblePlayers = players.filter(p => p.squad === "firstTeam" || p.isInTrainingSquad).sort((a, b) => {
        const positionOrder: Record<string, number> = {
            "GK": 1,
            "RB": 2, "LB": 2, "CB": 2, "RWB": 2, "LWB": 2, "DEF": 2,
            "CDM": 3, "CM": 3, "CAM": 3, "RM": 3, "LM": 3, "MID": 3,
            "RW": 4, "LW": 4, "CF": 4, "ST": 4, "FWD": 4
        };
        const orderA = positionOrder[a.position] || 99;
        const orderB = positionOrder[b.position] || 99;
        return orderA - orderB;
    });

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" asChild>
                    <Link href="/training">
                        <ArrowLeft className="h-4 w-4" />
                    </Link>
                </Button>
                <div className="flex-1">
                    <h1 className="text-2xl font-bold text-slate-900">Manage Session</h1>
                </div>
                {unsavedChanges && (
                    <Badge variant="destructive" className="animate-pulse">Unsaved Changes</Badge>
                )}
            </div>

            <div className="flex flex-col gap-6">
                {/* Session Details Card - Full Width at Top */}
                <Card className="w-full border-l-4 border-l-red-600 shadow-sm">
                    <CardHeader className="pb-2">
                        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                            <div>
                                <Badge className="w-fit mb-2" variant="outline">
                                    {{ firstTeam: "First Team", midweek: "Midweek", youth: "Youth" }[session.squad as string] || session.squad} Squad
                                </Badge>
                                <CardTitle className="text-xl">{session.topic || "General Session"}</CardTitle>
                                <CardDescription>Session Details</CardDescription>
                            </div>
                            <div className="flex gap-4">
                                <div className="text-center px-4 py-2 bg-green-50 rounded-lg border border-green-100 min-w-[100px]">
                                    <p className="text-2xl font-bold text-green-700 leading-none">
                                        {session.attendance.filter(a => a.status === 'Present').length}
                                    </p>
                                    <p className="text-xs text-green-600 font-bold uppercase tracking-wider mt-1">Present</p>
                                </div>
                                <div className="text-center px-4 py-2 bg-red-50 rounded-lg border border-red-100 min-w-[100px]">
                                    <p className="text-2xl font-bold text-red-700 leading-none">
                                        {session.attendance.filter(a => a.status === 'Absent').length}
                                    </p>
                                    <p className="text-xs text-red-600 font-bold uppercase tracking-wider mt-1">Absent</p>
                                </div>
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

                {/* Attendance List - Full Width Below */}
                <Card className="flex-1 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between border-b bg-slate-50/50">
                        <div>
                            <CardTitle>Attendance Register</CardTitle>
                            <CardDescription>Mark player availability</CardDescription>
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={downloadSessionCSV}>
                                <Download className="h-4 w-4 mr-2" /> Export Data
                            </Button>
                            <Button onClick={handleSave} disabled={!unsavedChanges} className={unsavedChanges ? "bg-red-600 hover:bg-red-700" : ""}>
                                {unsavedChanges ? "Save Changes" : "Saved"}
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="p-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                                {eligiblePlayers.map((player) => {
                                    const record = session.attendance.find(a => a.playerId === player.id);
                                    const status = record?.status;

                                    return (
                                        <div key={player.id} className="flex flex-col justify-between p-3 bg-white rounded-lg border hover:border-slate-300 hover:shadow-sm transition-all gap-3 h-full">
                                            <div className="min-w-0 w-full text-center">
                                                <p className="font-medium text-sm text-slate-900 truncate" title={`${player.firstName} ${player.lastName}`}>
                                                    {player.firstName} {player.lastName}
                                                </p>
                                                <p className="text-xs text-slate-500 font-medium">{player.position}</p>
                                            </div>

                                            <div className="flex items-center justify-center gap-1 bg-slate-100 p-1 rounded-lg w-full">
                                                <StatusButton
                                                    active={status === 'Present'}
                                                    type="Present"
                                                    icon={CheckCircle2}
                                                    activeClass="bg-green-500 text-white shadow-sm"
                                                    onClick={() => handleAttendance(player.id, 'Present')}
                                                />
                                                <StatusButton
                                                    active={status === 'Injured'}
                                                    type="Injured"
                                                    icon={AlertCircle}
                                                    activeClass="bg-red-500 text-white shadow-sm"
                                                    onClick={() => handleAttendance(player.id, 'Injured')}
                                                />
                                                <StatusButton
                                                    active={status === 'Absent'}
                                                    type="Absent"
                                                    icon={XCircle}
                                                    activeClass="bg-slate-600 text-white shadow-sm"
                                                    onClick={() => handleAttendance(player.id, 'Absent')}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            {eligiblePlayers.length === 0 && (
                                <div className="text-center py-10 text-slate-500">
                                    No players found for this squad.
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

function StatusButton({ active, type, icon: Icon, activeClass, onClick }: any) {
    return (
        <button
            onClick={onClick}
            className={`p-2 rounded-md transition-all duration-200 ${active ? activeClass : 'text-slate-400 hover:text-slate-600 hover:bg-slate-200'}`}
            title={`Mark as ${type}`}
        >
            <Icon className="h-5 w-5" />
        </button>
    )
}
