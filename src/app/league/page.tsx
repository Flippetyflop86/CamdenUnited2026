"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ExternalLink, AlertCircle, Settings, Trophy } from "lucide-react";
import { useClub } from "@/context/club-context";

export default function LeagueTablePage() {
    const { settings, updateSettings } = useClub();
    const [iframeError, setIframeError] = useState(false);
    
    // Local state for the settings modal
    const [tempUrl, setTempUrl] = useState(settings.leagueUrl || "");
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [errorMsg, setErrorMsg] = useState("");

    // Sync modal state when settings change
    useEffect(() => {
        setTempUrl(settings.leagueUrl || "");
        setErrorMsg("");
    }, [settings.leagueUrl, isSettingsOpen]);

    const saveSettings = async () => {
        setIsSaving(true);
        setErrorMsg("");
        
        try {
            let scrapedPosition = null;

            if (tempUrl) {
                // Try to scrape the position
                const res = await fetch('/api/sync-league', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url: tempUrl, clubName: settings.name })
                });

                const data = await res.json();
                
                if (data.success && data.position) {
                    scrapedPosition = data.position;
                    if (data.leagueName) {
                        localStorage.setItem("clubflow_league_name", data.leagueName);
                    }
                } else if (!data.success && data.error) {
                    setErrorMsg(data.error);
                    setIsSaving(false);
                    return; // Stop and let them fix it
                }
            }

            await updateSettings({ 
                leagueUrl: tempUrl || null,
                leaguePosition: scrapedPosition
            });
            setIsSettingsOpen(false);
            setIframeError(false);
        } catch (error) {
            setErrorMsg("Failed to save league settings");
            console.error(error);
        } finally {
            setIsSaving(false);
        }
    };

    const hasLeagueUrl = !!settings.leagueUrl;
    const proxyUrl = hasLeagueUrl ? `/api/proxy-league?url=${encodeURIComponent(settings.leagueUrl!)}` : "";

    return (
        <div className="h-full flex flex-col gap-4">
            {/* Header / Settings Row */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 bg-yellow-500/10 rounded-full flex items-center justify-center">
                        <Trophy className="h-5 w-5 text-yellow-600" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-slate-900">League Standings</h2>
                        <p className="text-sm text-slate-500">
                            {settings.leaguePosition 
                                ? `Currently in ${settings.leaguePosition}${['st','nd','rd'][((settings.leaguePosition+90)%100-10)%10-1]||'th'} place` 
                                : "Track your league progress"}
                        </p>
                    </div>
                </div>

                <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
                    <DialogTrigger asChild>
                        <Button variant="outline" size="sm" className="gap-2">
                            <Settings className="h-4 w-4" />
                            League Settings
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>League Table Settings</DialogTitle>
                            <DialogDescription>
                                Update your league table URL and current position.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            {errorMsg && (
                                <div className="bg-red-50 text-red-600 text-sm p-3 rounded-md border border-red-200">
                                    {errorMsg}
                                </div>
                            )}
                            <div className="space-y-2">
                                <Label>League Table URL</Label>
                                <Input
                                    value={tempUrl}
                                    onChange={(e) => setTempUrl(e.target.value)}
                                    placeholder="https://fulltime.thefa.com/..."
                                />
                                <p className="text-xs text-slate-500">
                                    Paste the URL from Mitoo Football, FA Full-Time, etc. The system will automatically scrape your position based on your club name.
                                </p>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsSettingsOpen(false)} disabled={isSaving}>
                                Cancel
                            </Button>
                            <Button onClick={saveSettings} className="bg-red-600 hover:bg-red-700" disabled={isSaving}>
                                {isSaving ? "Saving..." : "Save Settings"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            <Card className="flex-1 overflow-hidden border-slate-200">
                <CardContent className="p-0 h-full flex flex-col">
                    {!hasLeagueUrl ? (
                        <div className="flex flex-col items-center justify-center py-20 px-4 text-center h-full">
                            <Trophy className="h-16 w-16 text-slate-200 mb-4" />
                            <h3 className="text-xl font-bold text-slate-900 mb-2">No League Configured</h3>
                            <p className="text-slate-500 mb-6 max-w-md">
                                You haven't added a league table yet. Configure your league settings to track your position automatically.
                            </p>
                            <Button onClick={() => setIsSettingsOpen(true)} className="bg-red-600 hover:bg-red-700">
                                Configure League Now
                            </Button>
                        </div>
                    ) : !iframeError ? (
                        <div className="relative w-full h-full min-h-[600px] overflow-hidden bg-slate-50">
                            {/* Loading State Skeleton */}
                            <div className="absolute inset-0 flex items-center justify-center -z-10">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
                            </div>
                            <iframe
                                src={proxyUrl}
                                className="w-full h-full border-0"
                                title="League Table Proxy"
                                onError={() => setIframeError(true)}
                            />
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-20 px-4 text-center h-full">
                            <AlertCircle className="h-16 w-16 text-amber-500 mb-4" />
                            <h3 className="text-xl font-bold text-slate-900 mb-2">
                                Unable to load embedded table
                            </h3>
                            <p className="text-slate-500 mb-6 max-w-md">
                                The league website could not be securely proxied. You can still view it in a new tab.
                            </p>
                            <Button
                                onClick={() => window.open(settings.leagueUrl!, '_blank')}
                                className="bg-red-600 hover:bg-red-700"
                            >
                                <ExternalLink className="h-4 w-4 mr-2" />
                                Open League Table
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
