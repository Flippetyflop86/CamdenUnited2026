"use client";

import { Match } from "@/types";
import { ReactNode } from "react";
import { Button } from "@/components/ui/button";

interface RecentResultsProps {
    matches: Match[];
    renderCard: (match: Match) => ReactNode;
}

export function RecentResults({ matches, renderCard }: RecentResultsProps) {
    if (matches.length === 0) return null;

    return (
        <div className="space-y-4 mb-12 opacity-80 hover:opacity-100 transition-opacity">
            <h2 className="text-sm font-semibold tracking-wider text-muted-foreground uppercase">Recent Results</h2>
            <div className="space-y-4">
                {matches.map(match => (
                    <div key={match.id}>{renderCard(match)}</div>
                ))}
            </div>
            {matches.length >= 5 && (
                <div className="pt-4 flex justify-center">
                    <Button variant="outline" className="text-muted-foreground border-border hover:bg-surface-2 hover:text-foreground">
                        View Full Results Archive
                    </Button>
                </div>
            )}
        </div>
    );
}
