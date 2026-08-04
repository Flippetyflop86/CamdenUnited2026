"use client";

import React, { useState, useEffect } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { PageSection } from "@/components/layout/page-section";
import { FootballCalendar } from "@/components/calendar/FootballCalendar";
import { SeasonTimeline } from "@/components/calendar/SeasonTimeline";
import { supabase } from "@/lib/supabase";
import { Match, TrainingSession } from "@/types";
import { Calendar as CalendarIcon, Filter, LayoutGrid, List } from "lucide-react";

export default function CalendarPage() {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [viewMode, setViewMode] = useState<"Month" | "Week" | "Agenda">("Month");
    
    const [matches, setMatches] = useState<Match[]>([]);
    const [trainingSessions, setTrainingSessions] = useState<TrainingSession[]>([]);
    const [leagueTeams, setLeagueTeams] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const [filters, setFilters] = useState<Record<string, boolean>>({
        All: true,
        Matches: true,
        Training: true,
        Medical: true,
        Meetings: true,
        Academy: true,
        Women: true,
        Analysis: true
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setIsLoading(true);
        const [mRes, tRes, lRes] = await Promise.all([
            supabase.from("matches").select("*"),
            supabase.from("training_sessions").select("*"),
            supabase.from("league_teams").select("*")
        ]);

        if (mRes.data) setMatches(mRes.data);
        if (tRes.data) setTrainingSessions(tRes.data);
        if (lRes.data) setLeagueTeams(lRes.data);
        setIsLoading(false);
    };

    const toggleFilter = (f: string) => {
        if (f === "All") {
            const allOn = !filters.All;
            const newF = { ...filters };
            Object.keys(newF).forEach(k => newF[k] = allOn);
            setFilters(newF);
        } else {
            setFilters(prev => ({
                ...prev,
                [f]: !prev[f],
                All: false
            }));
        }
    };

    return (
        <div className="space-y-6 pb-12">
            <PageHeader 
                title="Football Calendar" 
                description="The central operational timeline for Camden United."
            />

            <PageSection>
                {/* Top Filters & View Toggles */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
                    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
                        {Object.keys(filters).map(f => (
                            <button 
                                key={f}
                                onClick={() => toggleFilter(f)}
                                className={`
                                    px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-colors shrink-0
                                    ${filters[f] ? "bg-slate-800 text-white" : "bg-white border border-slate-200 text-slate-500 hover:bg-slate-50"}
                                `}
                            >
                                {f}
                            </button>
                        ))}
                    </div>
                    
                    <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-1 shrink-0">
                        {[
                            { id: "Month", icon: LayoutGrid },
                            { id: "Week", icon: CalendarIcon },
                            { id: "Agenda", icon: List }
                        ].map(v => (
                            <button
                                key={v.id}
                                onClick={() => setViewMode(v.id as any)}
                                className={`
                                    flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-colors
                                    ${viewMode === v.id ? "bg-slate-100 text-slate-900" : "text-slate-500 hover:bg-slate-50"}
                                `}
                            >
                                <v.icon className="h-3.5 w-3.5" />
                                {v.id}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Season Timeline */}
                <SeasonTimeline 
                    matches={matches} 
                    currentDate={currentDate} 
                    onMonthChange={setCurrentDate}
                    leagueTeams={leagueTeams}
                />

                {/* Calendar Area */}
                {isLoading ? (
                    <div className="h-96 w-full flex items-center justify-center bg-white rounded-xl border border-slate-200 shadow-sm">
                        <div className="animate-spin h-8 w-8 border-4 border-slate-200 border-t-brand rounded-full"></div>
                    </div>
                ) : (
                    viewMode === "Month" ? (
                        <FootballCalendar 
                            currentDate={currentDate} 
                            matches={matches} 
                            trainingSessions={trainingSessions} 
                            leagueTeams={leagueTeams}
                            filters={filters}
                            onDateClick={(d) => setCurrentDate(d)}
                        />
                    ) : (
                        <div className="h-96 w-full flex items-center justify-center bg-slate-900 rounded-xl border border-slate-800 shadow-xl relative overflow-hidden">
                            <div className="absolute inset-0 pointer-events-none opacity-5">
                                <div className="absolute top-1/2 left-0 right-0 h-0 border-t-2 border-white"></div>
                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 border-2 border-white rounded-full"></div>
                            </div>
                            <div className="relative z-10 text-center">
                                <h3 className="text-xl font-black text-white mb-2">{viewMode} View</h3>
                                <p className="text-slate-400 text-sm">Contextual {viewMode.toLowerCase()} planner goes here.</p>
                            </div>
                        </div>
                    )
                )}
            </PageSection>
        </div>
    );
}
