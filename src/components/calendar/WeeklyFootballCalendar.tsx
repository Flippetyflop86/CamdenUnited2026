"use client";

import React, { useState, useMemo, useEffect } from "react";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, MapPin, Clock, Users } from "lucide-react";
import { useClub } from "@/context/club-context";
import { Match, TrainingSession } from "@/types";
import { supabase } from "@/lib/supabase";

interface WeeklyFootballCalendarProps {
    matches?: Match[];
    trainingSessions?: TrainingSession[];
    initialDate?: Date;
}

export function WeeklyFootballCalendar({ matches: propMatches, trainingSessions: propTrainingSessions, initialDate = new Date() }: WeeklyFootballCalendarProps) {
    const { settings } = useClub();
    const [weekOffset, setWeekOffset] = useState(0);
    const [fetchedMatches, setFetchedMatches] = useState<Match[]>([]);
    const [fetchedSessions, setFetchedSessions] = useState<TrainingSession[]>([]);
    const [leagueTeams, setLeagueTeams] = useState<any[]>([]);

    useEffect(() => {
        if (!propMatches) {
            supabase.from('matches').select('*').then(({ data }) => {
                if (data) setFetchedMatches(data);
            });
        }
        supabase.from('league_teams').select('*').then(({ data }) => {
            if (data) setLeagueTeams(data);
        });
    }, [propMatches]);

    useEffect(() => {
        if (!propTrainingSessions) {
            supabase.from('training_sessions').select('*').then(({ data }) => {
                if (data) setFetchedSessions(data);
            });
        }
    }, [propTrainingSessions]);

    const matches = propMatches || fetchedMatches;
    const trainingSessions = propTrainingSessions || fetchedSessions;

    const todayStr = new Date().toISOString().split("T")[0];

    // Calculate days of the current viewed week
    const weekDays = useMemo(() => {
        const date = new Date(initialDate);
        date.setDate(date.getDate() + weekOffset * 7);
        const day = date.getDay();
        const diff = date.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
        const monday = new Date(date.setDate(diff));

        const days = [];
        for (let i = 0; i < 7; i++) {
            const current = new Date(monday);
            current.setDate(monday.getDate() + i);
            days.push(current);
        }
        return days;
    }, [initialDate, weekOffset]);

    const getDayEvents = (date: Date) => {
        const dateStr = date.toISOString().split("T")[0];
        
        // Find match
        const dayMatches = matches.filter(m => m.date === dateStr);
        // Find training
        const daySessions = trainingSessions.filter(s => s.date === dateStr);
        
        return {
            matches: dayMatches,
            sessions: daySessions
        };
    };

    // Calculate Matchday numbering
    // Find next match in this week or future to label MD-X
    const getMatchdayLabel = (date: Date, events: { matches: Match[], sessions: TrainingSession[] }, dayIndex: number) => {
        const dayName = date.toLocaleDateString("en-US", { weekday: "long" });
        if (!settings.useMatchdayNumbering) return dayName;

        if (events.matches.length > 0) return "Matchday";

        // If no match today, find the next match in the future (within a reasonable timeframe, e.g. next 7 days)
        // For simplicity, we just look at the current week's matches
        const dateStr = date.toISOString().split("T")[0];
        const futureMatches = matches.filter(m => m.date >= dateStr).sort((a, b) => a.date.localeCompare(b.date));
        
        if (futureMatches.length > 0) {
            const nextMatch = futureMatches[0];
            const nextMatchDate = new Date(nextMatch.date);
            const diffTime = nextMatchDate.getTime() - date.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if (diffDays === 0) return "Matchday";
            if (diffDays > 0 && diffDays <= 6) return `MD-${diffDays}`;
        }

        // Look backwards for recovery
        const pastMatches = matches.filter(m => m.date < dateStr).sort((a, b) => b.date.localeCompare(a.date));
        if (pastMatches.length > 0) {
            const lastMatch = pastMatches[0];
            const lastMatchDate = new Date(lastMatch.date);
            const diffTime = date.getTime() - lastMatchDate.getTime();
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
            
            if (diffDays === 1) return "Recovery"; // MD+1
        }

        return dayName;
    };

    const nextWeek = () => setWeekOffset(prev => prev + 1);
    const prevWeek = () => setWeekOffset(prev => prev - 1);
    const currentWeek = () => setWeekOffset(0);

    const isCurrentWeek = weekOffset === 0;

    return (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm flex flex-col w-full mb-6">
            <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50">
                <div className="flex items-center gap-2">
                    <CalendarIcon className="h-4 w-4 text-slate-500" />
                    <h3 className="font-bold text-slate-800 text-sm tracking-wide uppercase">This Week</h3>
                </div>
                <div className="flex items-center gap-1">
                    <button onClick={prevWeek} className="p-1.5 rounded-md hover:bg-slate-200 text-slate-600 transition-colors">
                        <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button 
                        onClick={currentWeek} 
                        className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${isCurrentWeek ? 'bg-slate-200 text-slate-800' : 'text-slate-600 hover:bg-slate-200'}`}
                    >
                        Current Week
                    </button>
                    <button onClick={nextWeek} className="p-1.5 rounded-md hover:bg-slate-200 text-slate-600 transition-colors">
                        <ChevronRight className="h-4 w-4" />
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-7 divide-y md:divide-y-0 md:divide-x divide-slate-100">
                {weekDays.map((date, idx) => {
                    const dateStr = date.toISOString().split("T")[0];
                    const isToday = dateStr === todayStr;
                    const events = getDayEvents(date);
                    const dayLabel = getMatchdayLabel(date, events, idx);
                    
                    const hasMatch = events.matches.length > 0;
                    const hasTraining = events.sessions.length > 0;
                    
                    // Determine primary event type and color
                    let eventType = "Rest";
                    let typeLabel = "Rest";
                    let bgClass = "bg-transparent";
                    let textClass = "text-slate-500";
                    let borderClass = "border-transparent";

                    if (hasMatch) {
                        eventType = "Match";
                        typeLabel = "MATCH";
                        bgClass = "bg-rose-50/50";
                        textClass = "text-rose-700";
                        borderClass = isToday ? "border-rose-400" : "border-rose-200";
                    } else if (hasTraining) {
                        eventType = "Training";
                        typeLabel = "TRAINING";
                        bgClass = "bg-emerald-50/50";
                        textClass = "text-emerald-700";
                        borderClass = isToday ? "border-emerald-400" : "border-emerald-200";
                    } else if (dayLabel === "Recovery") {
                        eventType = "Recovery";
                        typeLabel = "RECOVERY";
                        bgClass = "bg-sky-50/50";
                        textClass = "text-sky-700";
                        borderClass = isToday ? "border-sky-400" : "border-sky-200";
                    } else {
                        bgClass = "bg-slate-50/30";
                        borderClass = isToday ? "border-slate-400" : "border-transparent";
                    }

                    return (
                        <div key={dateStr} className={`flex flex-col min-h-[140px] p-3 transition-colors ${bgClass} ${isToday ? `border-t-4 ${borderClass}` : 'border-t-4 border-transparent'}`}>
                            <div className="flex justify-between items-start mb-2">
                                <span className={`text-[10px] font-black uppercase tracking-wider ${isToday ? 'text-slate-900' : 'text-slate-500'}`}>
                                    {dayLabel}
                                </span>
                                <span className={`text-xs font-semibold ${isToday ? 'text-slate-900 bg-slate-200 px-1.5 py-0.5 rounded' : 'text-slate-400'}`}>
                                    {date.getDate()}
                                </span>
                            </div>

                            <div className="mt-1 flex-1">
                                {hasMatch ? (
                                    <div className="space-y-2">
                                        <div className={`text-xs font-bold flex items-center gap-1.5 ${textClass}`}>
                                            {leagueTeams.find(t => t.name.toLowerCase() === events.matches[0].opponent.toLowerCase())?.badge_url && (
                                                <img src={leagueTeams.find(t => t.name.toLowerCase() === events.matches[0].opponent.toLowerCase())?.badge_url} alt="Badge" className="h-4 w-4 object-contain" />
                                            )}
                                            {events.matches[0].opponent}
                                        </div>
                                        <div className="flex items-center gap-1 text-[10px] text-slate-500">
                                            <Clock className="w-3 h-3" />
                                            {events.matches[0].time || "TBC"}
                                        </div>
                                        <div className="mt-2 text-[10px] font-semibold text-slate-600 bg-white/60 px-1.5 py-1 rounded inline-block">
                                            {events.matches[0].is_squad_confirmed ? "XI Saved" : "Prep Required"}
                                        </div>
                                    </div>
                                ) : hasTraining ? (
                                    <div className="space-y-2">
                                        <div className={`text-xs font-bold ${textClass}`}>
                                            {events.sessions[0].topic || "Session"}
                                        </div>
                                        <div className="flex items-center gap-1 text-[10px] text-slate-500">
                                            <Clock className="w-3 h-3" />
                                            {events.sessions[0].time || "TBC"}
                                        </div>
                                        <div className="mt-2 flex items-center gap-1 text-[10px] font-semibold text-slate-600 bg-white/60 px-1.5 py-1 rounded inline-block">
                                            <Users className="w-3 h-3 inline-block mr-1" />
                                            {events.sessions[0].attendance?.filter((a: any) => a.status === 'Present' || a.status === 'Late').length || 0} Confirmed
                                        </div>
                                    </div>
                                ) : eventType === "Recovery" ? (
                                    <div className="space-y-2">
                                        <div className={`text-xs font-bold ${textClass}`}>
                                            Recovery
                                        </div>
                                        <div className="text-[10px] text-slate-500">
                                            Light Session
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-[10px] text-slate-400 font-medium italic mt-1">
                                        No football activity
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
