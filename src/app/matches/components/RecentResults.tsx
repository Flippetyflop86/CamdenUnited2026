"use client";

import { Match } from "@/types";
import { ReactNode, useState } from "react";
import { Button } from "@/components/ui/button";

interface RecentResultsProps {
    matches: Match[];
    renderCard: (match: Match) => ReactNode;
}

export function RecentResults({ matches, renderCard }: RecentResultsProps) {
    const [isExpanded, setIsExpanded] = useState(false);

    if (matches.length === 0) return null;

    const displayCount = 5;
    const displayedMatches = isExpanded ? matches : matches.slice(0, displayCount);

    return (
        <div className="space-y-4 mb-12 opacity-80 hover:opacity-100 transition-opacity">
            <h2 className="text-sm font-semibold tracking-wider text-muted-foreground uppercase">Recent Results</h2>
            <div className="space-y-4">
                {displayedMatches.map(match => (
                    <div key={match.id}>{renderCard(match)}</div>
                ))}
            </div>
            {matches.length > displayCount && (
                <div className="pt-4 flex justify-center">
                    <Button 
                        variant="outline" 
                        className="text-muted-foreground border-border hover:bg-surface-2 hover:text-foreground"
                        onClick={() => setIsExpanded(!isExpanded)}
                    >
                        {isExpanded ? "Show Less" : "View Full Results Archive"}
                    </Button>
                </div>
            )}
        </div>
    );
}
