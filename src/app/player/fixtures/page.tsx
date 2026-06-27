"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { CalendarDays, Clock, MapPin, Trophy, RefreshCw } from "lucide-react";

export default function PlayerFixturesList() {
    const [fixtures, setFixtures] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchFixtures() {
            try {
                const today = new Date().toISOString().split("T")[0];
                const { data } = await supabase
                    .from("matches")
                    .select("*")
                    .gte("date", today)
                    .order("date", { ascending: true });

                if (data) setFixtures(data);
            } catch (err) {
                console.error("Failed to load fixtures:", err);
            } finally {
                setLoading(false);
            }
        }

        fetchFixtures();
    }, []);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-12 gap-3 sm:ml-44">
                <RefreshCw className="h-8 w-8 text-red-600 animate-spin" />
                <p className="text-slate-400 text-xs">Loading fixtures...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 sm:ml-44">
            <div>
                <h1 className="text-2xl font-black tracking-tight text-white">Upcoming Fixtures</h1>
                <p className="text-xs text-slate-400">View upcoming match schedules, home venue details, and competition leagues.</p>
            </div>

            <div className="grid gap-3">
                {fixtures.length === 0 ? (
                    <div className="text-center py-12 border border-dashed border-slate-800 rounded-xl bg-slate-900/20">
                        <p className="text-xs text-slate-500 font-medium">No upcoming fixtures scheduled.</p>
                    </div>
                ) : (
                    fixtures.map((match) => {
                        const dateFormatted = new Date(match.date).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
                        
                        return (
                            <Card key={match.id} className="border-slate-800 bg-slate-900/60 overflow-hidden">
                                <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                    <div className="space-y-1.5">
                                        <div className="flex items-center gap-2">
                                            <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded ${
                                                match.is_home ? "bg-red-600/10 text-red-400 border border-red-500/20" : "bg-slate-800 text-slate-400 border border-slate-700"
                                            }`}>
                                                {match.is_home ? "Home" : "Away"}
                                            </span>
                                            <p className="text-sm font-bold text-white">Camden United vs {match.opponent}</p>
                                        </div>

                                        <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-slate-400">
                                            <span className="flex items-center gap-1.5"><CalendarDays className="h-4 w-4 text-slate-500" /> {dateFormatted}</span>
                                            <span className="flex items-center gap-1.5"><Clock className="h-4 w-4 text-slate-500" /> {match.time}</span>
                                            <span className="flex items-center gap-1.5"><MapPin className="h-4 w-4 text-slate-500" /> {match.location}</span>
                                        </div>
                                    </div>

                                    {match.competition && (
                                        <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800/80 px-2.5 py-1 rounded-lg shrink-0 self-start sm:self-center">
                                            <Trophy className="h-3.5 w-3.5 text-amber-500" />
                                            <span className="text-[10px] font-bold text-slate-400">{match.competition}</span>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        );
                    })
                )}
            </div>
        </div>
    );
}
