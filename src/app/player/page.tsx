"use client";

import { useState, useEffect } from "react";
import { supabase, unproxiedSupabase } from "@/lib/supabase";
import { calculateClubFlowFee, parsePaymentDescription } from "@/lib/clubflow-pay";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, Clock, MapPin, AlertCircle, RefreshCw, CreditCard } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function PlayerDashboard() {
    const router = useRouter();
    const [playerName, setPlayerName] = useState("");
    const [playerId, setPlayerId] = useState("");
    const [upcomingMatches, setUpcomingMatches] = useState<any[]>([]);
    const [upcomingTraining, setUpcomingTraining] = useState<any[]>([]);
    const [unansweredPayments, setUnansweredPayments] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchPlayerAndUpcoming() {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (!session?.user) {
                    router.push("/login");
                    return;
                }

                const { data: player, error: playerErr } = await unproxiedSupabase
                    .from("players")
                    .select("*")
                    .eq("user_id", session.user.id)
                    .single();

                if (playerErr || !player) {
                    setPlayerName(session.user.user_metadata?.first_name || "Player");
                } else {
                    setPlayerId(player.id);
                    setPlayerName(player.first_name);

                    const { data: openPayments } = await unproxiedSupabase
                        .from("player_payment_requests")
                        .select("*")
                        .eq("player_id", player.id)
                        .eq("status", "Unpaid")
                        .order("created_at", { ascending: false });

                    if (openPayments) {
                        setUnansweredPayments(openPayments);
                    }
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

    const getMatchRsvp = (match: any) => {
        const currentNotes = match.notes || "";
        const matchRaw = currentNotes.match(/\[AVAILABILITY:\s*(.*?)\s*\]/);
        if (matchRaw && matchRaw[1]) {
            try {
                const list = JSON.parse(matchRaw[1]);
                const record = list.find((a: any) => a.playerId === playerId);
                return record?.status || "Unanswered";
            } catch {
                return "Unanswered";
            }
        }
        return "Unanswered";
    };

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

    const todayStr = new Date().toISOString().split("T")[0];

    return (
        <div className="space-y-6 sm:ml-44">
            {/* Header Welcomer */}
            <div>
                <h1 className="text-2xl font-black tracking-tight text-white">Welcome, {playerName}!</h1>
                <p className="text-xs text-slate-400">
                    Your unanswered payments, upcoming fixtures, training sessions, and RSVPs.
                </p>
            </div>

            {/* Spond-Style Unanswered Payments Card */}
            {unansweredPayments.length > 0 && (
                <Card className="border-amber-500/40 bg-amber-950/15 shadow-lg">
                    <CardHeader className="py-4 border-b border-amber-500/20 flex flex-row items-center gap-2.5">
                        <CreditCard className="h-5 w-5 text-amber-400 shrink-0" />
                        <div>
                            <CardTitle className="text-sm font-bold text-white">
                                Unanswered Payment{unansweredPayments.length === 1 ? "" : "s"} ({unansweredPayments.length})
                            </CardTitle>
                            <CardDescription className="text-[11px] text-slate-300">
                                Pay in 1 tap via Link, Apple Pay, Google Pay, or Card.
                            </CardDescription>
                        </div>
                    </CardHeader>
                    <CardContent className="divide-y divide-amber-500/15 py-0">
                        {unansweredPayments.map(pay => {
                            const meta = parsePaymentDescription(pay.description);
                            const breakdown = calculateClubFlowFee(Number(pay.amount || 0), meta.feeCoverage);
                            const isOverdue = Boolean(meta.dueDate && meta.dueDate < todayStr);
                            return (
                                <div key={pay.id} className="py-3.5 flex items-center justify-between gap-4">
                                    <div className="space-y-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <p className="text-xs font-bold text-white truncate">
                                                {meta.cleanDescription}
                                            </p>
                                            <Badge
                                                className={`text-[9px] font-bold px-1.5 py-0 ${
                                                    meta.requirement === "optional"
                                                        ? "bg-sky-500/15 text-sky-300 border-sky-500/30"
                                                        : "bg-amber-500/15 text-amber-300 border-amber-500/30"
                                                }`}
                                            >
                                                {meta.requirement === "optional" ? "Optional" : "Required"}
                                            </Badge>
                                        </div>
                                        <p className="text-[11px] text-slate-300 flex items-center gap-2 flex-wrap">
                                            <span className="font-bold text-emerald-400">
                                                £{breakdown.basePrice.toFixed(2)}
                                            </span>
                                            {meta.dueDate && (
                                                <span className={isOverdue ? "text-rose-400 font-semibold" : "text-slate-400"}>
                                                    • Due{" "}
                                                    {new Date(meta.dueDate + "T12:00:00Z").toLocaleDateString("en-GB", {
                                                        day: "numeric",
                                                        month: "short",
                                                    })}
                                                </span>
                                            )}
                                        </p>
                                    </div>
                                    <Link href={`/pay/${pay.id}`}>
                                        <Button
                                            size="sm"
                                            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs h-8 px-4 rounded-lg shrink-0"
                                        >
                                            Pay £{breakdown.playerTotalPayable.toFixed(2)}
                                        </Button>
                                    </Link>
                                </div>
                            );
                        })}
                    </CardContent>
                </Card>
            )}

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
