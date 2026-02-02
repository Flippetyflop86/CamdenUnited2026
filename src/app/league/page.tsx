"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ExternalLink, AlertCircle, Settings } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function LeagueTablePage() {
    const [iframeError, setIframeError] = useState(false);
    const [leagueUrl, setLeagueUrl] = useState("https://mitoofootball.com/LeagueTab.cfm?TblName=Matches&DivisionID=64&LeagueCode=MDX2025");
    const [tempUrl, setTempUrl] = useState(leagueUrl);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    useEffect(() => {
        fetchLeagueUrl();
    }, []);

    const fetchLeagueUrl = async () => {
        const { data } = await supabase.from('documents').select('*').eq('name', 'League Table').single();
        if (data) {
            setLeagueUrl(data.url);
            setTempUrl(data.url);
        }
    };

    const saveLeagueUrl = async () => {
        const { data: existing } = await supabase.from('documents').select('id').eq('name', 'League Table').maybeSingle();

        if (existing) {
            await supabase.from('documents').update({ url: tempUrl }).eq('id', existing.id);
        } else {
            await supabase.from('documents').insert([{
                name: 'League Table',
                type: 'Link',
                category: 'General',
                url: tempUrl
            }]);
        }

        setLeagueUrl(tempUrl);
        setIsSettingsOpen(false);
        setIframeError(false);
    };

    return (
        <div className="h-full flex flex-col gap-2">
            {/* Settings Button */}
            <div className="flex justify-end">
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
                                Update the league table URL when you move to a different league (e.g., FA Full-Time).
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label>League Table URL</Label>
                                <Input
                                    value={tempUrl}
                                    onChange={(e) => setTempUrl(e.target.value)}
                                    placeholder="https://fulltime.thefa.com/..."
                                />
                                <p className="text-xs text-slate-500">
                                    Paste the URL from Mitoo Football, FA Full-Time, or any other league website.
                                </p>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsSettingsOpen(false)}>
                                Cancel
                            </Button>
                            <Button onClick={saveLeagueUrl} className="bg-red-600 hover:bg-red-700">
                                Save URL
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            <Card className="flex-1">
                <CardContent className="p-0 h-full">
                    {!iframeError ? (
                        <div className="relative w-full h-full overflow-hidden" style={{ minHeight: 'calc(100vh - 180px)' }}>
                            <iframe
                                src={leagueUrl}
                                className="w-full border-0 rounded-lg"
                                style={{
                                    height: 'calc(100% + 250px)',
                                    marginTop: '-250px'
                                }}
                                title="League Table"
                                onError={() => setIframeError(true)}
                                sandbox="allow-same-origin allow-scripts"
                            />
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                            <AlertCircle className="h-12 w-12 text-amber-500 mb-4" />
                            <h3 className="text-lg font-semibold text-slate-900 mb-2">
                                Unable to embed league table
                            </h3>
                            <p className="text-sm text-slate-500 mb-4 max-w-md">
                                The league website has blocked embedding. Click the button below to view the table in a new tab.
                            </p>
                            <Button
                                onClick={() => window.open(leagueUrl, '_blank')}
                                className="bg-red-600 hover:bg-red-700"
                            >
                                <ExternalLink className="h-4 w-4 mr-2" />
                                View League Table
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
