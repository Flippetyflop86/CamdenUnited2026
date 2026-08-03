"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { CheckCircle2, Circle, ArrowRight } from "lucide-react";
import Link from "next/link";
import { Match } from "@/types";
import { supabase } from "@/lib/supabase";

interface MatchPreparationProps {
    nextMatch: Match | null;
}

export function MatchPreparation({ nextMatch }: MatchPreparationProps) {
    const [hasTrainingThisWeek, setHasTrainingThisWeek] = useState(false);
    const [trainingDay, setTrainingDay] = useState("");

    useEffect(() => {
        const checkTraining = async () => {
            const today = new Date();
            const startOfWeek = new Date(today);
            startOfWeek.setDate(today.getDate() - today.getDay() + (today.getDay() === 0 ? -6 : 1)); // Monday
            const endOfWeek = new Date(startOfWeek);
            endOfWeek.setDate(startOfWeek.getDate() + 6); // Sunday

            const { data } = await supabase
                .from('training_sessions')
                .select('*')
                .gte('date', startOfWeek.toISOString().split('T')[0])
                .lte('date', endOfWeek.toISOString().split('T')[0])
                .order('date', { ascending: true });

            if (data && data.length > 0) {
                setHasTrainingThisWeek(true);
                const d = new Date(data[0].date);
                setTrainingDay(new Intl.DateTimeFormat("en-GB", { weekday: 'long' }).format(d));
            } else {
                setHasTrainingThisWeek(false);
            }
        };
        checkTraining();
    }, []);

    if (!nextMatch) return null;

    const isSquadConfirmed = nextMatch.is_squad_confirmed === true;

    return (
        <div className="space-y-4 mb-12">
            <h2 className="text-sm font-semibold tracking-wider text-muted-foreground uppercase">Preparing for Matchday</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                
                {/* Training */}
                <Link href="/training" className="block group">
                    <Card className="border-border bg-surface-1 p-5 hover:bg-surface-2 transition-colors h-full flex flex-col">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-sm font-medium text-foreground">Training Week</span>
                            {hasTrainingThisWeek ? (
                                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                            ) : (
                                <Circle className="h-4 w-4 text-muted-foreground" />
                            )}
                        </div>
                        <p className="text-sm text-muted-foreground mb-4 flex-1">
                            {hasTrainingThisWeek ? `Session scheduled for ${trainingDay}` : "No session scheduled"}
                        </p>
                        <div className="flex items-center text-xs font-semibold text-brand group-hover:underline">
                            View training plan <ArrowRight className="h-3 w-3 ml-1" />
                        </div>
                    </Card>
                </Link>

                {/* Matchday XI */}
                <Link href={`/matchday-xi?match=${nextMatch.id}`} className="block group">
                    <Card className="border-border bg-surface-1 p-5 hover:bg-surface-2 transition-colors h-full flex flex-col">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-sm font-medium text-foreground">Matchday XI</span>
                            {isSquadConfirmed ? (
                                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                            ) : (
                                <Circle className="h-4 w-4 text-muted-foreground" />
                            )}
                        </div>
                        <p className="text-sm text-muted-foreground mb-4 flex-1">
                            {isSquadConfirmed ? "Starting XI confirmed" : "Starting XI not yet confirmed"}
                        </p>
                        <div className="flex items-center text-xs font-semibold text-brand group-hover:underline">
                            Select squad <ArrowRight className="h-3 w-3 ml-1" />
                        </div>
                    </Card>
                </Link>

                {/* Opposition Report */}
                <Link href="/opposition" className="block group">
                    <Card className="border-border bg-surface-1 p-5 hover:bg-surface-2 transition-colors h-full flex flex-col">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-sm font-medium text-foreground">Opposition Report</span>
                            <Circle className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <p className="text-sm text-muted-foreground mb-4 flex-1">
                            No report created yet
                        </p>
                        <div className="flex items-center text-xs font-semibold text-brand group-hover:underline">
                            Create report <ArrowRight className="h-3 w-3 ml-1" />
                        </div>
                    </Card>
                </Link>
            </div>
        </div>
    );
}
