"use client";

import { CheckCircle2, Clock, CalendarDays, RefreshCw } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function LeagueSync() {
    return (
        <Card className="border-border bg-surface-1 mb-8 overflow-hidden">
            <div className="flex flex-col sm:flex-row items-center justify-between p-4 sm:p-6 gap-4">
                <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
                        <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-foreground flex items-center gap-2">
                            League Connection
                            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">Connected</Badge>
                        </h3>
                        <p className="text-sm text-muted-foreground mt-1">
                            Mitoo League Integration Active
                        </p>
                    </div>
                </div>
                
                <div className="flex items-center gap-6 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        <span>Last synced: 2 minutes ago</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <CalendarDays className="h-4 w-4" />
                        <span>Fixtures: 18</span>
                    </div>
                    <div className="flex items-center gap-2 text-brand">
                        <RefreshCw className="h-4 w-4" />
                        <span>Next sync: Automatic</span>
                    </div>
                </div>
            </div>
        </Card>
    );
}
