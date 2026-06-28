"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarDays, Clock, MapPin, CheckCircle, XCircle, AlertCircle, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function PlayerDashboard() {
    const router = useRouter();
    const [playerName, setPlayerName] = useState("");
    const [playerId, setPlayerId] = useState("");
    const [upcomingMatches, setUpcomingMatches] = useState<any[]>([]);
    const [upcomingTraining, setUpcomingTraining] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchPlayerAndUpcoming() {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (!session?.user) {
                    router.push("/login");
                    return;
                }

                const { data: player, error: playerErr } = await supabase
                    .from("players")
                    .select("*")
                    .eq("user_id", session.user.id)
                    .single();

                if (playerErr || !player) {
                    setPlayerName(session.user.user_metadata?.first_name || "Player");
                } else {
                    setPlayerId(player.id);
                    setPlayerName(player.first_name);
                }

                const today = new Date().toISOString().split("T")[0];
                const { data: matches } = await supabase
                    .from("matches")
                    .select("*")
                    .gte("date", today)
                    .order("date", { ascending: true })
                    .limit(5);

                const { data: training } = await supabase
                    .from("training_sessions")
                    .select("*")
                    .gte("date", today)
                    .order("date", { ascending: true })
                    .limit(5);

                if (matches) setUpcomingMatches(matches);
                if (training) setUpcomingTraining(training);

            } catch (err) {
                console.error("Failed to load dashboard data:", err);
            } finally {
                setLoading(false);
            }
        }

        fetchPlayerAndUpcoming();
    }, [router]);

    // Get availability status for a match
    const getMatchRsvp = (match: any) => {
        const currentNotes = match.notes || "";
        const matchRaw = currentNotes.match(/\[AVAILABILITY:\s*(.*?)\s*\]/);
        if (matchRaw && matchRaw[1]) {
            try {
                const list = JSON.parse(matchRaw[1]);
                const record = list.find((a: any) => a.playerId === playerId);
                return record?.status || "Unanswered";
            } catch (e) {
                return "Unanswered";
            }
        }
        return "Unanswered";
    };

    // Get RSVP status for training
    const getTrainingRsvp = (session: any) => {
        const attendance = session.attendance || [];
        const record = attendance.find((a: any) => a.playerId === playerId);
        if (!record) return "Unanswered";
        if (record.status === "Present") return "Available";
        if (record.status === "Late") return "Maybe";
        return "Unavailable";
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
                <RefreshCw className="h-8 w-8 text-red-600 animate-spin" />
                <p className="text-slate-400 text-xs">Loading upcoming schedule...</p>
            </div>
        );
    }

    const allEvents = [
        ...upcomingMatches.map(m => ({ ...m, type: "match" })),
        ...upcomingTraining.map(t => ({ ...t, type: "training" }))
    ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const pendingEvents = allEvents.filter(e => {
        const rsvp = e.type === "match" ? getMatchRsvp(e) : getTrainingRsvp(e);
        return rsvp === "Unanswered";
    });

    return (
        <div className="space-y-6 sm:ml-44">
            {/* Header Welcomer */}
            <div>
                <h1 className="text-2xl font-black tracking-tight text-white">Welcome, {playerName}!</h1>
                <p className="text-xs text-slate-400">Here are your upcoming matches, trainings, and outstanding RSVPs.</p>
            </div>

            {/* Outstanding RSVPs */}
            {pendingEvents.length > 0 && (
                <Card className="border-red-900/50 bg-red-950/10 shadow-lg">
                    <CardHeader className="py-4 border-b border-red-950/40 flex flex-row items-center gap-2">
                        <AlertCircle className="h-5 w-5 text-red-500 shrink-0" />
                        <div>
                            <CardTitle className="text-sm font-bold text-white">Action Required</CardTitle>
                            <CardDescription className="text-[10px] text-slate-400">Please RSVP to the following upcoming sessions.</CardDescription>
                        </div>
                    </CardHeader>
                    <CardContent className="divide-y divide-red-950/30 py-0">
                        {pendingEvents.map((event) => {
                            const dateFormatted = new Date(event.date).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
                            const eventLabel = event.type === "match" ? `Match vs ${event.opponent}` : `Training: ${event.topic || "Practice"}`;
                            
                            return (
                                <div key={event.id} className="py-3.5 flex items-center justify-between gap-4">
                                    <div className="space-y-0.5">
                                        <p className="text-xs font-bold text-white">{eventLabel}</p>
                                        <p className="text-[10px] text-slate-400 flex items-center gap-1.5">
                                            <CalendarDays className="h-3 w-3" /> {dateFormatted} @ {event.time}
                                        </p>
                                    </div>
                                    <Link href={`/respond/${event.event_token || event.id}`}>
                                        <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs h-8 px-4 rounded-lg">
                                            Respond
                                        </Button>
                                    </Link>
                                </div>
                            );
                        })}
                    </CardContent>
                </Card>
            )}

            {/* Full Schedule */}
            <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Upcoming Schedule</h3>
                {allEvents.length === 0 ? (
                    <div className="text-center py-12 border border-dashed border-slate-800 rounded-xl bg-slate-900/20">
                        <p className="text-xs text-slate-500 font-medium">No upcoming games or training sessions scheduled.</p>
                    </div>
                ) : (
                    <div className="grid gap-3">
                        {allEvents.map((event) => {
                            const dateFormatted = new Date(event.date).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
                            const eventLabel = event.type === "match" ? `Match vs ${event.opponent}` : `Training: ${event.topic || "Practice"}`;
                            const rsvp = event.type === "match" ? getMatchRsvp(event) : getTrainingRsvp(event);

                            return (
                                <Card key={event.id} className="border-slate-800 bg-slate-900/60 overflow-hidden">
                                    <CardContent className="p-4 flex items-center justify-between gap-4">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2">
                                                <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded ${
                                                    event.type === "match" ? "bg-blue-600/10 text-blue-400 border border-blue-500/20" : "bg-emerald-600/10 text-emerald-400 border border-emerald-500/20"
                                                }`}>
                                                    {event.type}
                                                </span>
                                                <p className="text-xs font-bold text-white">{eventLabel}</p>
                                            </div>
                                            <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-slate-400">
                                                <span className="flex items-center gap-1"><CalendarDays className="h-3 w-3" /> {dateFormatted}</span>
                                                <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {event.time}</span>
                                                <span className="flex items-center gap-1"><MapPin className="h-3 w-3 text-slate-500" /> {event.location}</span>
                                            </div>
                                        </div>

                                        <div className="shrink-0 flex items-center gap-2.5">
                                            <div className="text-right hidden sm:block">
                                                <span className={`text-[10px] font-bold ${
                                                    rsvp === "Available" ? "text-emerald-400" : rsvp === "Maybe" ? "text-amber-400" : rsvp === "Unavailable" ? "text-red-400" : "text-slate-400"
                                                }`}>
                                                    {rsvp}
                                                </span>
                                            </div>
                                            <Link href={`/respond/${event.event_token || event.id}`}>
                                                <Button size="sm" variant="outline" className="border-slate-800 hover:bg-slate-800 text-white text-xs h-8">
                                                    Change
                                                </Button>
                                            </Link>
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
