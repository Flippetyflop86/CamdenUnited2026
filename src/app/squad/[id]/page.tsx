"use client";

import { useEffect, useState } from "react";
import { cn, formatPlayerName } from "@/lib/utils";
import { notFound, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, Edit, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { Player } from "@/types";
import { supabase } from "@/lib/supabase";
import { useClub } from "@/context/club-context";
import { Input } from "@/components/ui/input";

export default function PlayerProfilePage() {
    const params = useParams();
    const id = params?.id as string;
    const [player, setPlayer] = useState<Player | null>(null);
    const [loading, setLoading] = useState(true);
    const getCurrentSeasonStr = () => {
        const d = new Date();
        const year = d.getFullYear();
        const month = d.getMonth(); // 0 = Jan, 5 = Jun
        return month >= 5 
            ? `${year.toString().slice(2)}/${(year + 1).toString().slice(2)}`
            : `${(year - 1).toString().slice(2)}/${year.toString().slice(2)}`;
    };

    const [seasonFilter, setSeasonFilter] = useState<string>("26/27");
    const [availableSeasons, setAvailableSeasons] = useState<string[]>([]);
    const [calculatedStats, setCalculatedStats] = useState({ apps: 0, goals: 0, assists: 0 });
    const [recentActivity, setRecentActivity] = useState<any[]>([]);

    // Invite player portal states
    const [inviteEmail, setInviteEmail] = useState("");
    const [inviteMobile, setInviteMobile] = useState("");
    const [inviteLoading, setInviteLoading] = useState(false);
    const [inviteSuccess, setInviteSuccess] = useState(false);
    const [inviteError, setInviteError] = useState("");

    const handleInvitePlayer = async (e: React.FormEvent) => {
        e.preventDefault();
        setInviteLoading(true);
        setInviteError("");
        setInviteSuccess(false);

        try {
            const { data: sessionData } = await supabase.auth.getSession();
            const token = sessionData?.session?.access_token;
            if (!token) throw new Error("Authentication failed");

            const res = await fetch("/api/player/invite", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({
                    playerId: id,
                    email: inviteEmail,
                    mobileNumber: inviteMobile
                })
            });

            const data = await res.json();
            if (!res.ok || !data.success) {
                throw new Error(data.error || "Failed to send invitation");
            }

            setInviteSuccess(true);
            setPlayer(prev => prev ? { ...prev, email: inviteEmail, mobileNumber: inviteMobile, status: "Pending Activation" } as any : null);
        } catch (err: any) {
            setInviteError(err.message || "Failed to invite player.");
        } finally {
            setInviteLoading(false);
        }
    };

    const handleRevokeDevice = async (deviceToken: string) => {
        if (!player) return;
        if (!confirm("Revoke access for this device? The player will need to verify via email OTP next time they respond.")) return;

        const updatedDevices = (player as any).trustedDevices.filter((d: any) => d.token !== deviceToken);

        try {
            const { error } = await supabase
                .from("players")
                .update({ trusted_devices: updatedDevices })
                .eq("id", player.id);

            if (error) throw error;
            setPlayer(prev => prev ? { ...prev, trustedDevices: updatedDevices } as any : null);
        } catch (err: any) {
            alert("Failed to revoke device access: " + err.message);
        }
    };

    const handleResetPlayerPin = async () => {
        if (!player) return;
        if (!confirm(`Are you sure you want to reset the PIN for ${formatPlayerName(player)}? They will be required to choose a new 6-digit PIN the next time they respond.`)) return;

        try {
            const { error } = await supabase
                .from("players")
                .update({ 
                    pin_hash: null, 
                    status: "Pending Invitation" 
                })
                .eq("id", player.id);

            if (error) throw error;
            setPlayer(prev => prev ? { ...prev, status: "Pending Invitation" } as any : null);
            alert("PIN has been successfully reset! The player can now choose a new PIN when they next open their availability link.");
        } catch (err: any) {
            alert("Failed to reset PIN: " + err.message);
        }
    };

    const { settings } = useClub();
    const currentSquads = settings.squads || ["First Team"];

    useEffect(() => {
        const fetchPlayer = async () => {
            if (!id) return;
            
            const [playerRes, matchesRes, statsRes, sessionsRes] = await Promise.all([
                supabase.from('players').select('*, email, mobile_number, status, trusted_devices').eq('id', id).single(),
                supabase.from('matches').select('id, date'),
                supabase.from('match_player_stats').select('*').eq('player_id', id),
                supabase.from('training_sessions').select('id, date, topic, attendance').order('date', { ascending: false }).limit(10)
            ]);

            if (sessionsRes.data) {
                const playerSessions = sessionsRes.data.map((session: any) => {
                    const attendanceList = session.attendance || [];
                    const record = attendanceList.find((a: any) => a.playerId === id);
                    return {
                        id: session.id,
                        date: session.date,
                        topic: session.topic || "Squad Practice",
                        status: record?.status || "Unanswered",
                        notes: record?.notes || ""
                    };
                });
                setRecentActivity(playerSessions);
            }

            if (playerRes.data) {
                const data = playerRes.data;
                setPlayer({
                    id: data.id,
                    firstName: data.first_name,
                    lastName: data.last_name,
                    position: data.position,
                    squadNumber: data.squad_number,
                    age: data.age,
                    nationality: data.nationality,
                    squad: data.squad,
                    medicalStatus: data.medical_status,
                    availability: data.availability,
                    contractExpiry: data.contract_expiry,
                    imageUrl: data.image_url,
                    appearances: data.appearances, // fallback
                    goals: data.goals, // fallback
                    assists: data.assists, // fallback
                    dateOfBirth: data.date_of_birth,
                    notes: data.notes,
                    isInTrainingSquad: data.is_in_training_squad,
                    medicalNotes: data.medical_notes,
                    email: data.email,
                    mobileNumber: data.mobile_number,
                    status: data.status || "Pending Activation",
                    trustedDevices: data.trusted_devices || [],
                    nickname: data.nickname || "",
                    useNickname: data.use_nickname || false
                } as any);
            }

            // Calculate dynamic stats
            const matches = matchesRes.data || [];
            const stats = statsRes.data || [];

            const matchSeasons = new Map<string, string>();
            const seasonSet = new Set<string>();
            matches.forEach((m: any) => {
                let seasonStr = "";
                if (!m.date) {
                    seasonStr = getCurrentSeasonStr();
                } else {
                    const d = new Date(m.date);
                    if (isNaN(d.getTime())) {
                        seasonStr = getCurrentSeasonStr();
                    } else {
                        const year = d.getFullYear();
                        const month = d.getMonth();
                        if (month >= 5) seasonStr = `${year.toString().slice(2)}/${(year + 1).toString().slice(2)}`;
                        else seasonStr = `${(year - 1).toString().slice(2)}/${year.toString().slice(2)}`;
                    }
                }
                matchSeasons.set(m.id, seasonStr);
                seasonSet.add(seasonStr);
            });
            seasonSet.add(getCurrentSeasonStr());
            setAvailableSeasons(Array.from(seasonSet).sort().reverse());

            let apps = 0; let goals = 0; let assists = 0;
            stats.forEach((s: any) => {
                const season = matchSeasons.get(s.match_id);
                if (seasonFilter !== "All" && season !== seasonFilter) return;
                apps += 1;
                goals += (s.goals || 0);
                assists += (s.assists || 0);
            });
            setCalculatedStats({ apps, goals, assists });

            setLoading(false);
        };
        fetchPlayer();
    }, [id, seasonFilter]);

    if (loading) return <div className="p-8 text-center text-slate-500">Loading profile...</div>;
    if (!player) return notFound();

    const SQUAD_LABELS: Record<string, string> = { firstTeam: "First Team", midweek: "Midweek", youth: "Youth" };
    const squadLabel = SQUAD_LABELS[player.squad as string] || player.squad;

    let displayAge = player.age;
    if (player.dateOfBirth) {
        const birthDate = new Date(player.dateOfBirth);
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        displayAge = age;
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" asChild>
                    <Link href="/squad">
                        <ArrowLeft className="h-4 w-4" />
                    </Link>
                </Button>
                <h1 className="text-lg font-medium text-slate-500">Back to Squad</h1>
            </div>

            {/* Header Section */}
            <div className="flex flex-col md:flex-row gap-6 items-start bg-white p-6 rounded-lg border shadow-sm">
                <Avatar className="h-32 w-32 border-4 border-slate-100">
                    <AvatarImage src={player.imageUrl} />
                    <AvatarFallback className="text-4xl bg-slate-900 text-white font-bold">
                        {player.firstName[0]}{player.lastName[0]}
                    </AvatarFallback>
                </Avatar>

                <div className="flex-1 space-y-2">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <h2 className="text-3xl font-bold text-slate-900">{formatPlayerName(player)}</h2>
                            <div className="flex items-center gap-3 mt-1">
                                <span className="text-slate-500 font-medium">{player.position}</span>
                                <Badge className="bg-slate-900">{squadLabel}</Badge>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <Button asChild className="bg-slate-900 hover:bg-slate-800">
                                <Link href="/squad">
                                    <Edit className="h-4 w-4 mr-2" /> Edit Profile
                                </Link>
                            </Button>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                        <div>
                            <p className="text-xs text-slate-500 uppercase font-bold">Nationality</p>
                            <p className="font-medium">{player.nationality}</p>
                        </div>
                        <div>
                            <p className="text-xs text-slate-500 uppercase font-bold">Age</p>
                            <p className="font-medium">{displayAge}</p>
                        </div>
                        <div>
                            <p className="text-xs text-slate-500 uppercase font-bold">Status</p>
                            <p className={`font-medium ${player.medicalStatus === 'Available' ? 'text-green-600' : 'text-red-600'}`}>
                                {player.medicalStatus}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="mt-6 space-y-6">
                <div className="flex justify-between items-center bg-slate-50 p-4 border rounded-lg">
                    <span className="font-bold text-slate-700">Display Stats For:</span>
                    <select
                        value={seasonFilter}
                        onChange={(e) => setSeasonFilter(e.target.value)}
                        className="h-9 px-3 bg-white border border-slate-200 rounded-md text-sm font-medium focus:outline-none focus:ring-2 focus:ring-red-500"
                    >
                        <option value="All">All Time</option>
                        {availableSeasons.map(s => (
                            <option key={s} value={s}>{s} Season</option>
                        ))}
                    </select>
                </div>

                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <Card>
                        <CardHeader className="pb-2"><CardTitle className="text-sm text-slate-500">Appearances</CardTitle></CardHeader>
                        <CardContent><div className="text-2xl font-bold">{calculatedStats.apps}</div></CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2"><CardTitle className="text-sm text-slate-500">Goals</CardTitle></CardHeader>
                        <CardContent><div className="text-2xl font-bold">{calculatedStats.goals}</div></CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2"><CardTitle className="text-sm text-slate-500">Assists</CardTitle></CardHeader>
                        <CardContent><div className="text-2xl font-bold">{calculatedStats.assists}</div></CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2"><CardTitle className="text-sm text-slate-500">Mins Played</CardTitle></CardHeader>
                        <CardContent><div className="text-2xl font-bold">{player.appearances * 90}</div></CardContent>
                    </Card>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Recent Activity</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {recentActivity.length === 0 ? (
                                <p className="text-sm text-slate-500 italic">No recent training activities recorded.</p>
                            ) : (
                                recentActivity.map((activity, i) => {
                                    const dateFormatted = new Date(activity.date).toLocaleDateString("en-GB", {
                                        day: "numeric",
                                        month: "short",
                                        year: "numeric"
                                    });
                                    return (
                                        <div key={i} className="flex items-center gap-4 border-b pb-4 last:border-0 last:pb-0">
                                            <div className={`h-2.5 w-2.5 rounded-full ${
                                                activity.status === "Present" ? "bg-green-500" : activity.status === "Late" ? "bg-amber-500" : activity.status === "Absent" ? "bg-red-500" : "bg-slate-400"
                                            }`} />
                                            <div>
                                                <p className="text-sm font-medium text-slate-850">
                                                    Training Session - {dateFormatted}
                                                </p>
                                                <p className="text-xs text-slate-500">
                                                    Topic: {activity.topic} • <span className={`font-bold ${
                                                        activity.status === "Present" ? "text-green-600" : activity.status === "Late" ? "text-amber-600" : activity.status === "Absent" ? "text-red-600" : "text-slate-500"
                                                    }`}>{activity.status}</span> {activity.notes && `(${activity.notes})`}
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
