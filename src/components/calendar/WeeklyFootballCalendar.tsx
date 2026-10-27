"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trophy, Dumbbell, Calendar as CalendarIcon, ChevronLeft, ChevronRight, ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface CalendarProps {
    matches?: any[];
    trainings?: any[];
    title?: string;
    daysToShow?: 7 | 14;
    onSelectMatch?: (matchId: string) => void;
}

export function WeeklyFootballCalendar({
    matches: propMatches,
    trainings: propTrainings,
    title = "Next 14 Days",
    daysToShow = 14,
    onSelectMatch
}: CalendarProps) {
    const [fetchedMatches, setFetchedMatches] = useState<any[]>([]);
    const [fetchedTrainings, setFetchedTrainings] = useState<any[]>([]);
    const [weekOffset, setWeekOffset] = useState(0);
    const [isCollapsed, setIsCollapsed] = useState(false);

    useEffect(() => {
        if (typeof window !== "undefined") {
            const saved = localStorage.getItem("clubflow_calendar_collapsed");
            if (saved === "true") setIsCollapsed(true);
        }
    }, []);

    const toggleCollapse = () => {
        const next = !isCollapsed;
        setIsCollapsed(next);
        if (typeof window !== "undefined") {
            localStorage.setItem("clubflow_calendar_collapsed", String(next));
        }
    };

    useEffect(() => {
        const loadInternalData = async () => {
            if (!propMatches) {
                const { data: mData } = await supabase.from('matches').select('*');
                if (mData) setFetchedMatches(mData);
            }
            if (!propTrainings) {
                const { data: tData } = await supabase.from('training_sessions').select('*');
                if (tData) setFetchedTrainings(tData);
            }
        };
        loadInternalData();
    }, [propMatches, propTrainings]);

    const activeMatches = propMatches || fetchedMatches;
    const activeTrainings = propTrainings || fetchedTrainings;

    // Generate days starting from Monday of current week + weekOffset
    const getCalendarDays = () => {
        const today = new Date();
        const currentDay = today.getDay(); // 0 is Sun, 1 is Mon
        const diff = today.getDate() - currentDay + (currentDay === 0 ? -6 : 1) + (weekOffset * 7);

        const startOfPeriod = new Date(today);
        startOfPeriod.setDate(diff);
        startOfPeriod.setHours(0, 0, 0, 0);

        const days = [];
        for (let i = 0; i < daysToShow; i++) {
            const d = new Date(startOfPeriod);
            d.setDate(startOfPeriod.getDate() + i);
            days.push(d);
        }
        return days;
    };

    const calendarDays = getCalendarDays();
    const todayStr = new Date().toISOString().split('T')[0];

    const getEventsForDate = (dateObj: Date) => {
        const year = dateObj.getFullYear();
        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
        const day = String(dateObj.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;

        const dayMatches = activeMatches.filter(m => m.date === dateStr);
        const dayTrainings = activeTrainings.filter(t => t.date === dateStr);

        const events: any[] = [];

        dayMatches.forEach(m => {
            const isHome = m.isHome !== undefined ? m.isHome : m.is_home;
            const score = m.scoreline !== undefined ? m.scoreline : (m.result && m.result !== "Pending" ? m.result : "");
            events.push({
                type: 'match',
                id: m.id,
                title: `${isHome ? 'vs' : '@'} ${m.opponent}`,
                opponent: m.opponent,
                time: (m.time || '14:00').slice(0, 5),
                isHome,
                score,
                competition: m.competition || 'League'
            });
        });

        dayTrainings.forEach(t => {
            events.push({
                type: 'training',
                id: t.id,
                title: 'Training',
                time: (t.start_time || t.time || '19:30').slice(0, 5),
                subtitle: t.location || ''
            });
        });

        return { dateStr, events };
    };

    // Count upcoming matches & trainings in this window
    const windowSummary = calendarDays.reduce(
        (acc, d) => {
            const { events } = getEventsForDate(d);
            events.forEach(e => {
                if (e.type === 'match') acc.matches += 1;
                if (e.type === 'training') acc.trainings += 1;
            });
            return acc;
        },
        { matches: 0, trainings: 0 }
    );

    const periodStartLabel = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(calendarDays[0]);
    const periodEndLabel = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(calendarDays[calendarDays.length - 1]);

    return (
        <div className="space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                <div className="flex items-center gap-2.5">
                    <h2 className="text-sm font-semibold tracking-wider text-muted-foreground uppercase flex items-center gap-2">
                        <CalendarIcon className="h-4 w-4 text-brand" /> {title}
                    </h2>
                    <span className="text-xs font-medium text-muted-foreground bg-surface-2 px-2 py-0.5 rounded-full border border-border">
                        {periodStartLabel} – {periodEndLabel}
                    </span>
                    {isCollapsed && (
                        <span className="text-xs text-emerald-400 font-semibold">
                            · {windowSummary.matches} {windowSummary.matches === 1 ? "Match" : "Matches"}
                            {windowSummary.trainings > 0 ? `, ${windowSummary.trainings} Training` : ""}
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-1.5">
                    {!isCollapsed && (
                        <div className="flex items-center bg-surface-1 border border-border rounded-md overflow-hidden">
                            <button
                                type="button"
                                onClick={() => setWeekOffset(w => w - 1)}
                                className="px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-surface-2 transition-colors"
                                title="Previous Week"
                            >
                                <ChevronLeft className="h-3.5 w-3.5" />
                            </button>
                            <button
                                type="button"
                                onClick={() => setWeekOffset(0)}
                                className={`px-2.5 py-1 text-[11px] font-semibold border-x border-border transition-colors ${
                                    weekOffset === 0 ? "text-brand bg-brand/10" : "text-muted-foreground hover:text-foreground hover:bg-surface-2"
                                }`}
                            >
                                Today
                            </button>
                            <button
                                type="button"
                                onClick={() => setWeekOffset(w => w + 1)}
                                className="px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-surface-2 transition-colors"
                                title="Next Week"
                            >
                                <ChevronRight className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    )}
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={toggleCollapse}
                        className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                    >
                        {isCollapsed ? (
                            <>Show Calendar <ChevronDown className="h-3.5 w-3.5 ml-1" /></>
                        ) : (
                            <>Hide <ChevronUp className="h-3.5 w-3.5 ml-1" /></>
                        )}
                    </Button>
                </div>
            </div>

            {!isCollapsed && (
                <Card className="bg-surface-1 border-border shadow-sm overflow-hidden">
                    <div className="grid grid-cols-2 sm:grid-cols-7 divide-y sm:divide-y-0 sm:divide-x divide-border">
                        {calendarDays.map((dayObj, i) => {
                            const { dateStr, events } = getEventsForDate(dayObj);
                            const isToday = dateStr === todayStr;
                            const dayName = new Intl.DateTimeFormat('en-GB', { weekday: 'short' }).format(dayObj);
                            const dayNumber = dayObj.getDate();
                            const monthShort = new Intl.DateTimeFormat('en-GB', { month: 'short' }).format(dayObj);
                            const isSecondWeekRow = i >= 7;

                            return (
                                <div
                                    key={dateStr}
                                    className={`p-2.5 min-h-[82px] flex flex-col transition-colors ${
                                        isSecondWeekRow ? 'sm:border-t sm:border-border' : ''
                                    } ${isToday ? 'bg-brand/5' : 'hover:bg-surface-2/40'}`}
                                >
                                    <div className="flex items-center justify-between mb-1.5">
                                        <span className={`text-[10px] font-bold uppercase tracking-wider ${isToday ? 'text-brand' : 'text-muted-foreground'}`}>
                                            {dayName}
                                        </span>
                                        <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full flex items-center justify-center ${
                                            isToday ? 'bg-brand text-brand-foreground' : 'text-foreground'
                                        }`}>
                                            {dayNumber} {(dayNumber === 1 || i === 0) ? monthShort : ''}
                                        </span>
                                    </div>

                                    <div className="flex-1 flex flex-col gap-1 justify-center">
                                        {events.length === 0 ? (
                                            <div className="text-center py-1">
                                                <span className="text-[10px] font-medium text-muted-foreground/30 select-none">—</span>
                                            </div>
                                        ) : (
                                            events.map((ev, idx) => (
                                                ev.type === 'match' ? (
                                                    <button
                                                        type="button"
                                                        key={`${ev.id}-${idx}`}
                                                        onClick={() => onSelectMatch && onSelectMatch(ev.id)}
                                                        title={`${ev.title} (${ev.time}) ${ev.score ? `- Result: ${ev.score}` : ''}`}
                                                        className={`text-left p-1.5 rounded border flex flex-col gap-0.5 transition-all cursor-pointer ${
                                                            ev.isHome
                                                                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                                                                : 'bg-sky-500/10 border-sky-500/30 text-sky-400 hover:bg-sky-500/20'
                                                        }`}
                                                    >
                                                        <div className="flex items-center justify-between gap-1 text-[10px] font-bold leading-tight">
                                                            <span className="flex items-center gap-1 truncate">
                                                                <Trophy className="h-2.5 w-2.5 shrink-0" />
                                                                <span className="truncate">{ev.title}</span>
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center justify-between text-[9px] opacity-85 font-semibold">
                                                            <span>{ev.time}</span>
                                                            {ev.score ? (
                                                                <span className="bg-black/30 px-1 rounded font-bold">{ev.score}</span>
                                                            ) : (
                                                                <span>{ev.isHome ? 'H' : 'A'}</span>
                                                            )}
                                                        </div>
                                                    </button>
                                                ) : (
                                                    <div
                                                        key={`${ev.id}-${idx}`}
                                                        className="p-1.5 rounded bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex flex-col gap-0.5"
                                                    >
                                                        <div className="flex items-center gap-1 text-[10px] font-bold leading-tight">
                                                            <Dumbbell className="h-2.5 w-2.5 shrink-0" />
                                                            <span className="truncate">{ev.title}</span>
                                                        </div>
                                                        <span className="text-[9px] text-indigo-400/80 pl-3.5">{ev.time}</span>
                                                    </div>
                                                )
                                            ))
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </Card>
            )}
        </div>
    );
}
