"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarDays, Clock, MapPin, CheckCircle, XCircle, HelpCircle, RefreshCw } from "lucide-react";
import Link from "next/link";

export default function PlayerAvailabilityHistory() {
    const [playerId, setPlayerId] = useState("");
    const [allEvents, setAllEvents] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const storedPlayerId = localStorage.getItem("cf_player_id") || "";
        setPlayerId(storedPlayerId);

        if (!storedPlayerId) return;

        async function fetchHistory() {
            try {
                // Fetch matches
                const { data: matches } = await supabase
                    .from("matches")
                    .select("*")
                    .order("date", { ascending: false });

                // Fetch training sessions
                const { data: training } = await supabase
                    .from("training_sessions")
                    .select("*")
                    .order("date", { ascending: false });

                const combined = [
                    ...(matches || []).map(m => ({ ...m, type: "match" })),
                    ...(training || []).map(t => ({ ...t, type: "training" }))
                ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

                setAllEvents(combined);
            } catch (err) {
                console.error("Failed to load availability history:", err);
            } finally {
                setLoading(false);
            }
        }

        fetchHistory();
    }, []);

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
            <div className="flex flex-col items-center justify-center py-12 gap-3 sm:ml-44">
                <RefreshCw className="h-8 w-8 text-red-600 animate-spin" />
                <p className="text-slate-400 text-xs">Loading availability history...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 sm:ml-44">
            <div>
                <h1 className="text-2xl font-black tracking-tight text-white">Availability History</h1>
                <p className="text-xs text-slate-400">View and update your availability records for past and upcoming events.</p>
            </div>

            <div className="grid gap-3">
                {allEvents.length === 0 ? (
                    <div className="text-center py-12 border border-dashed border-slate-800 rounded-xl bg-slate-900/20">
                        <p className="text-xs text-slate-500 font-medium">No events found in history.</p>
                    </div>
                ) : (
                    allEvents.map((event) => {
                        const dateFormatted = new Date(event.date).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
                        const eventLabel = event.type === "match" ? `Match vs ${event.opponent}` : `Training: ${event.topic || "Practice"}`;
                        const rsvp = event.type === "match" ? getMatchRsvp(event) : getTrainingRsvp(event);
                        const isUpcoming = new Date(event.date) >= new Date(new Date().setHours(0,0,0,0));

                        return (
                            <Card key={event.id} className={`border-slate-800 ${isUpcoming ? 'bg-slate-900/60' : 'bg-slate-900/20 opacity-80'} overflow-hidden`}>
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
                                        <div className="flex items-center gap-1">
                                            {rsvp === "Available" ? (
                                                <CheckCircle className="h-4 w-4 text-emerald-500" />
                                            ) : rsvp === "Unavailable" ? (
                                                <XCircle className="h-4 w-4 text-red-500" />
                                            ) : rsvp === "Maybe" ? (
                                                <HelpCircle className="h-4 w-4 text-amber-500" />
                                            ) : (
                                                <div className="h-4 w-4 rounded-full border border-slate-700 bg-slate-800" />
                                            )}
                                            <span className={`text-[10px] font-bold hidden sm:inline ${
                                                rsvp === "Available" ? "text-emerald-400" : rsvp === "Maybe" ? "text-amber-400" : rsvp === "Unavailable" ? "text-red-400" : "text-slate-500"
                                            }`}>
                                                {rsvp}
                                            </span>
                                        </div>
                                        {isUpcoming && (
                                            <Link href={`/respond/${event.id}`}>
                                                <Button size="sm" variant="outline" className="border-slate-800 hover:bg-slate-800 text-white text-xs h-8">
                                                    Change
                                                </Button>
                                            </Link>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })
                )}
            </div>
        </div>
    );
}
