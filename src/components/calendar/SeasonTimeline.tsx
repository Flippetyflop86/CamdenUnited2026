"use client";

import React, { useMemo } from "react";
import { Match } from "@/types";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface SeasonTimelineProps {
    matches: Match[];
    currentDate: Date;
    onMonthChange: (date: Date) => void;
    leagueTeams?: any[];
}

export function SeasonTimeline({ matches, currentDate, onMonthChange, leagueTeams = [] }: SeasonTimelineProps) {
    const monthMatches = useMemo(() => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        
        return matches
            .filter(m => {
                const d = new Date(m.date);
                return d.getFullYear() === year && d.getMonth() === month;
            })
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }, [matches, currentDate]);

    const monthName = currentDate.toLocaleDateString("en-US", { month: "long" });
    const shortMonthName = currentDate.toLocaleDateString("en-US", { month: "short" });

    const prevMonth = () => {
        const d = new Date(currentDate);
        d.setMonth(d.getMonth() - 1);
        onMonthChange(d);
    };

    const nextMonth = () => {
        const d = new Date(currentDate);
        d.setMonth(d.getMonth() + 1);
        onMonthChange(d);
    };

    return (
        <div className="w-full flex items-center bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 mb-6 shadow-xl relative overflow-hidden">
            {/* Subtle glow/background effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-slate-800/30 to-transparent pointer-events-none" />
            
            <div className="flex items-center gap-4 w-full relative z-10">
                <div className="flex items-center gap-2 pr-4 border-r border-slate-700/50">
                    <button onClick={prevMonth} className="text-slate-400 hover:text-white transition-colors p-1">
                        <ChevronLeft className="h-4 w-4" />
                    </button>
                    <span className="text-sm font-black text-white tracking-widest uppercase w-12 text-center">
                        {shortMonthName}
                    </span>
                    <button onClick={nextMonth} className="text-slate-400 hover:text-white transition-colors p-1">
                        <ChevronRight className="h-4 w-4" />
                    </button>
                </div>

                <div className="flex-1 flex items-center gap-2 overflow-x-auto no-scrollbar scroll-smooth">
                    {monthMatches.length === 0 ? (
                        <div className="text-xs text-slate-500 font-medium uppercase tracking-widest italic w-full text-center">
                            No fixtures scheduled in {monthName}
                        </div>
                    ) : (
                        monthMatches.map((match, idx) => {
                            const isHome = match.isHome;
                            const isCup = match.competition?.toLowerCase().includes("cup");
                            const opponentTeamInfo = leagueTeams.find(t => t.name.toLowerCase() === match.opponent.toLowerCase());
                            
                            return (
                                <div 
                                    key={match.id || idx} 
                                    className="flex flex-col items-center gap-1 group relative cursor-pointer min-w-[36px]"
                                    title={`${match.opponent} (${isHome ? 'H' : 'A'})`}
                                >
                                    <div className="text-[9px] font-black uppercase text-slate-500 tracking-wider">
                                        {new Date(match.date).getDate()}
                                    </div>
                                    <div className={`
                                        h-8 w-8 rounded-full flex items-center justify-center border-2 transition-transform duration-200 group-hover:scale-110 shadow-lg
                                        ${isCup 
                                            ? "bg-amber-500/20 border-amber-500 text-amber-500" 
                                            : "bg-slate-800 border-slate-600 text-slate-300"
                                        }
                                    `}>
                                        {opponentTeamInfo?.badge_url ? (
                                            <img src={opponentTeamInfo.badge_url} alt="" className="h-5 w-5 object-contain" />
                                        ) : (
                                            <span className="text-xs font-black">
                                                {isCup ? "🏆" : (isHome ? "H" : "A")}
                                            </span>
                                        )}
                                    </div>
                                    
                                    {/* Tooltip */}
                                    <div className="absolute -bottom-8 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap bg-slate-800 text-white text-[10px] font-bold px-2 py-1 rounded shadow-xl z-50 pointer-events-none">
                                        {match.opponent} ({isHome ? 'H' : 'A'})
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
                
                <div className="pl-4 border-l border-slate-700/50 flex flex-col items-end shrink-0 hidden sm:flex">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Fixtures</span>
                    <span className="text-sm text-white font-black">{monthMatches.length}</span>
                </div>
            </div>
        </div>
    );
}
