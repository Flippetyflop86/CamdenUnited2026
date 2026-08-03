"use client";

import { CheckCircle2, Clock, CalendarDays, RefreshCw, Link2, AlertCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface LeagueSyncProps {
    isSyncing: boolean;
    leagueUrl: string | null;
    tempUrl: string;
    isEditingUrl: boolean;
    setTempUrl: (url: string) => void;
    setIsEditingUrl: (editing: boolean) => void;
    onSaveUrl: () => void;
    onSync: () => void;
    fixturesCount: number;
}

export function LeagueSync({ 
    isSyncing, 
    leagueUrl, 
    tempUrl, 
    isEditingUrl, 
    setTempUrl, 
    setIsEditingUrl, 
    onSaveUrl, 
    onSync,
    fixturesCount
}: LeagueSyncProps) {
    
    const showUrlForm = !leagueUrl || isEditingUrl;

    return (
        <Card className="border-border bg-surface-1 mb-8 overflow-hidden">
            <div className="flex flex-col sm:flex-row items-center justify-between p-4 sm:p-6 gap-6">
                
                {/* Left Side: Status */}
                <div className="flex items-center gap-4 w-full sm:w-auto">
                    {leagueUrl ? (
                        <div className="h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
                            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                        </div>
                    ) : (
                        <div className="h-10 w-10 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
                            <AlertCircle className="h-5 w-5 text-amber-500" />
                        </div>
                    )}
                    <div>
                        <h3 className="font-semibold text-foreground flex items-center gap-2">
                            League Connection
                            {leagueUrl ? (
                                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">Connected</Badge>
                            ) : (
                                <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20">Disconnected</Badge>
                            )}
                        </h3>
                        <p className="text-sm text-muted-foreground mt-1">
                            {leagueUrl ? "FA Full-Time Integration Active" : "Connect a league website to sync fixtures"}
                        </p>
                    </div>
                </div>
                
                {/* Right Side: Actions & Stats */}
                <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6 w-full sm:w-auto">
                    {showUrlForm ? (
                        <div className="flex w-full sm:w-auto items-center gap-2">
                            <Input 
                                placeholder="Paste FA Full-Time URL..." 
                                value={tempUrl} 
                                onChange={e => setTempUrl(e.target.value)}
                                className="w-full sm:w-64 bg-surface-2 border-border"
                            />
                            <Button 
                                onClick={onSaveUrl}
                                className="bg-brand hover:bg-brand/90 text-primary-foreground shrink-0"
                            >
                                Save
                            </Button>
                        </div>
                    ) : (
                        <>
                            <div className="flex items-center gap-6 text-sm text-muted-foreground mr-2">
                                <div className="flex items-center gap-2">
                                    <CalendarDays className="h-4 w-4" />
                                    <span>Fixtures: {fixturesCount}</span>
                                </div>
                            </div>
                            
                            <div className="flex items-center gap-2 w-full sm:w-auto">
                                <Button 
                                    variant="outline" 
                                    size="sm" 
                                    onClick={() => { setTempUrl(leagueUrl); setIsEditingUrl(true); }} 
                                    className="border-border text-foreground hover:bg-surface-2 hidden sm:flex"
                                >
                                    <Link2 className="h-4 w-4 mr-2 text-muted-foreground" />
                                    Edit URL
                                </Button>
                                <Button 
                                    onClick={onSync} 
                                    disabled={isSyncing}
                                    variant="secondary"
                                    className="flex-1 sm:flex-none border border-border"
                                >
                                    <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? "animate-spin" : ""}`} />
                                    {isSyncing ? "Syncing..." : "Sync Now"}
                                </Button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </Card>
    );
}
