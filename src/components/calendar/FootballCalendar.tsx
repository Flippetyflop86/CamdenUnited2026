"use client";

import React, { useMemo } from "react";
import { Match, TrainingSession } from "@/types";
import { Sun, Users } from "lucide-react";

interface FootballCalendarProps {
    currentDate: Date;
    matches: Match[];
    trainingSessions: TrainingSession[];
    leagueTeams?: any[];
    filters: Record<string, boolean>;
    onDateClick?: (date: Date) => void;
}

export function FootballCalendar({ currentDate, matches, trainingSessions, leagueTeams = [], filters, onDateClick }: FootballCalendarProps) {
    const todayStr = new Date().toISOString().split("T")[0];

    const calendarGrid = useMemo(() => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        
        const days = [];
        // Add preceding empty days to start on Monday
        const startOffset = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
        for (let i = 0; i < startOffset; i++) {
            const d = new Date(year, month, 1 - (startOffset - i));
            days.push({ date: d, isCurrentMonth: false });
        }
        
        for (let i = 1; i <= lastDay.getDate(); i++) {
            const d = new Date(year, month, i);
            days.push({ date: d, isCurrentMonth: true });
        }
        
        // Add trailing empty days to complete the week
        const endOffset = 7 - (days.length % 7);
        if (endOffset < 7) {
            for (let i = 1; i <= endOffset; i++) {
                const d = new Date(year, month + 1, i);
                days.push({ date: d, isCurrentMonth: false });
            }
        }
        
        return days;
    }, [currentDate]);

    const getEventsForDay = (date: Date) => {
        const dateStr = date.toISOString().split("T")[0];
        
        const dayMatches = filters.Matches !== false 
            ? matches.filter(m => m.date === dateStr) 
            : [];
            
        const dayTraining = filters.Training !== false 
            ? trainingSessions.filter(s => s.date === dateStr) 
            : [];
            
        return {
            matches: dayMatches,
            training: dayTraining
        };
    };

    return (
        <div className="w-full bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl relative">
            {/* Very faint pitch markings overlay */}
            <div className="absolute inset-0 pointer-events-none opacity-5">
                <div className="absolute inset-x-8 top-12 bottom-12 border-2 border-white rounded-lg"></div>
                <div className="absolute top-1/2 left-0 right-0 h-0 border-t-2 border-white"></div>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 border-2 border-white rounded-full"></div>
                <div className="absolute top-12 left-1/2 -translate-x-1/2 w-48 h-32 border-2 border-white border-t-0"></div>
                <div className="absolute bottom-12 left-1/2 -translate-x-1/2 w-48 h-32 border-2 border-white border-b-0"></div>
            </div>

            <div className="relative z-10">
                {/* Header Days */}
                <div className="grid grid-cols-7 border-b border-slate-800 bg-slate-900/80 backdrop-blur">
                    {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(day => (
                        <div key={day} className="py-3 px-2 text-center text-xs font-black uppercase tracking-widest text-slate-500">
                            {day}
                        </div>
                    ))}
                </div>

                {/* Grid */}
                <div className="grid grid-cols-7 divide-x divide-y divide-slate-800/60 bg-slate-900/40">
                    {calendarGrid.map((cell, idx) => {
                        const dateStr = cell.date.toISOString().split("T")[0];
                        const isToday = dateStr === todayStr;
                        const events = getEventsForDay(cell.date);
                        
                        return (
                            <div 
                                key={idx} 
                                onClick={() => onDateClick?.(cell.date)}
                                className={`
                                    min-h-[140px] p-2 relative group cursor-pointer transition-colors hover:bg-slate-800/40
                                    ${!cell.isCurrentMonth ? "opacity-30" : "opacity-100"}
                                `}
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <span className={`
                                        text-xs font-black 
                                        ${isToday ? "bg-red-600 text-white px-2 py-0.5 rounded-sm" : "text-slate-500"}
                                    `}>
                                        {cell.date.getDate()}
                                    </span>
                                    
                                    {events.matches.length > 0 && (
                                        <div className="flex items-center gap-1 text-[10px] text-slate-400 font-semibold bg-slate-800/80 px-1.5 py-0.5 rounded border border-slate-700">
                                            <Sun className="h-3 w-3 text-amber-400" />
                                            18°
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-1.5 mt-2">
                                    {events.matches.map((match, i) => {
                                        const opponentTeamInfo = leagueTeams.find(t => t.name.toLowerCase() === match.opponent.toLowerCase());
                                        const isCup = match.competition?.toLowerCase().includes("cup");
                                        
                                        return (
                                            <div key={i} className={`
                                                relative p-2 rounded-md border
                                                ${isCup ? "bg-amber-500/10 border-amber-500/30 text-amber-400" : "bg-red-500/10 border-red-500/30 text-red-400"}
                                            `}>
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className="text-[9px] font-bold uppercase tracking-wider">
                                                        {isCup ? "★★★★ Cup" : "★★★★★ Match"}
                                                    </span>
                                                    <span className="text-[9px] font-bold">{match.time || "15:00"}</span>
                                                </div>
                                                <div className="font-bold text-xs truncate flex items-center gap-1.5 text-white">
                                                    {opponentTeamInfo?.badge_url && (
                                                        <img src={opponentTeamInfo.badge_url} alt="" className="h-3.5 w-3.5 object-contain" />
                                                    )}
                                                    {match.opponent}
                                                </div>
                                                
                                                {/* Hover Popover */}
                                                <div className="absolute left-full top-0 ml-2 w-48 bg-slate-800 border border-slate-700 shadow-2xl rounded-lg p-3 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
                                                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">{match.competition || "Friendly"}</div>
                                                    <div className="font-bold text-white text-sm mb-2">{match.opponent} ({match.isHome ? "H" : "A"})</div>
                                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                                        <div className="bg-slate-900 p-1.5 rounded">
                                                            <div className="text-slate-500 text-[9px] uppercase tracking-wider">Time</div>
                                                            <div className="text-slate-300 font-semibold">{match.time || "15:00"}</div>
                                                        </div>
                                                        <div className="bg-slate-900 p-1.5 rounded">
                                                            <div className="text-slate-500 text-[9px] uppercase tracking-wider">Status</div>
                                                            <div className="text-emerald-400 font-semibold">{match.is_squad_confirmed ? "XI Saved" : "Prep Reqd"}</div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })}

                                    {events.training.map((session, i) => {
                                        const confirmed = session.attendance?.filter((a: any) => a.status === 'Present' || a.status === 'Late').length || 0;
                                        // Fake workload intensity for demo purposes based on day of week
                                        const dayOfWeek = cell.date.getDay();
                                        const intensityBlocks = (dayOfWeek === 2 || dayOfWeek === 3) ? [1,1,1,1] : [1,1,0,0];
                                        
                                        return (
                                            <div key={i} className="p-2 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 relative">
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-500">★★★ Training</span>
                                                    <div className="flex gap-0.5">
                                                        {intensityBlocks.map((active, idx) => (
                                                            <div key={idx} className={`h-1.5 w-1.5 rounded-sm ${active ? 'bg-emerald-500' : 'bg-emerald-500/20'}`} />
                                                        ))}
                                                    </div>
                                                </div>
                                                <div className="font-bold text-[11px] truncate text-slate-300">
                                                    {(session as any).focus || (session as any).topic || "Possession"}
                                                </div>
                                                <div className="mt-1 flex items-center gap-1 text-[9px] font-medium text-slate-400">
                                                    <Users className="h-3 w-3" />
                                                    {confirmed} Available
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    );
}
