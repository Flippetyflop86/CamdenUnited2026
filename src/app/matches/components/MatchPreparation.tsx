"use client";

import { Card } from "@/components/ui/card";
import { CheckCircle2, Circle, AlertCircle, ArrowRight } from "lucide-react";
import Link from "next/link";
import { Match } from "@/types";

interface MatchPreparationProps {
    nextMatch: Match | null;
}

export function MatchPreparation({ nextMatch }: MatchPreparationProps) {
    if (!nextMatch) return null;

    return (
        <div className="space-y-4 mb-12">
            <h2 className="text-sm font-semibold tracking-wider text-muted-foreground uppercase">Preparing for Matchday</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Squad Availability */}
                <Link href={`/respond/${nextMatch.event_token || nextMatch.id}`} className="block group">
                    <Card className="border-border bg-surface-1 p-5 hover:bg-surface-2 transition-colors h-full flex flex-col">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-sm font-medium text-foreground">Squad Availability</span>
                            <AlertCircle className="h-4 w-4 text-amber-500" />
                        </div>
                        <p className="text-sm text-muted-foreground mb-4 flex-1">
                            Awaiting 6 player responses
                        </p>
                        <div className="flex items-center text-xs font-semibold text-brand group-hover:underline">
                            Manage responses <ArrowRight className="h-3 w-3 ml-1" />
                        </div>
                    </Card>
                </Link>

                {/* Training */}
                <Link href="/training" className="block group">
                    <Card className="border-border bg-surface-1 p-5 hover:bg-surface-2 transition-colors h-full flex flex-col">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-sm font-medium text-foreground">Training Week</span>
                            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        </div>
                        <p className="text-sm text-muted-foreground mb-4 flex-1">
                            Session scheduled for Thursday
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
                            <Circle className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <p className="text-sm text-muted-foreground mb-4 flex-1">
                            Starting XI not yet confirmed
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
