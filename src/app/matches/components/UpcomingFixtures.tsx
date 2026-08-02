"use client";

import { Match } from "@/types";
import { ReactNode } from "react";

interface UpcomingFixturesProps {
    matches: Match[];
    renderCard: (match: Match) => ReactNode;
}

export function UpcomingFixtures({ matches, renderCard }: UpcomingFixturesProps) {
    if (matches.length === 0) {
        return (
            <div className="space-y-4 mb-12">
                <h2 className="text-sm font-semibold tracking-wider text-muted-foreground uppercase">Upcoming Fixtures</h2>
                <div className="text-center py-12 text-muted-foreground border-2 border-dashed border-border rounded-lg bg-surface-1/50">
                    <p>No upcoming fixtures found matching filters.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4 mb-12">
            <h2 className="text-sm font-semibold tracking-wider text-muted-foreground uppercase">Upcoming Fixtures</h2>
            <div className="space-y-4">
                {matches.map(match => (
                    <div key={match.id}>{renderCard(match)}</div>
                ))}
            </div>
        </div>
    );
}
