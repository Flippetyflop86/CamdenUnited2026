"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ExternalLink, AlertCircle, Settings, Trophy, Link as LinkIcon, Image as ImageIcon, FileText, CheckCircle2 } from "lucide-react";
import { useClub } from "@/context/club-context";
import { useAuth } from "@/context/auth-context";
import { supabase } from "@/lib/supabase";
import { Textarea } from "@/components/ui/textarea";

// Mock LeagueRow type
type LeagueRow = {
    position: number;
    team_name: string;
    played: number;
    won: number;
    drawn: number;
    lost: number;
    goals_for: number;
    goals_against: number;
    goal_difference: number;
    points: number;
    is_our_club: boolean;
};

export default function LeagueTablePage() {
    const { settings, updateSettings } = useClub();
    const { clubId } = useAuth();
    
    // Default to 'url' for live auto-sync
    const [importMode, setImportMode] = useState<'url' | 'text' | 'screenshot'>('url');
    const [urlInput, setUrlInput] = useState("");
    const [textInput, setTextInput] = useState("");
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    const [isExtracting, setIsExtracting] = useState(false);
    const [isAutoSyncing, setIsAutoSyncing] = useState(false);
    const [extractionStatus, setExtractionStatus] = useState("");
    const [extractionError, setExtractionError] = useState<{title: string, message: string} | null>(null);
    const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
    
    // Preview State
    const [previewData, setPreviewData] = useState<LeagueRow[] | null>(null);
    const [isImporting, setIsImporting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);

    // Existing Data
    const [currentTable, setCurrentTable] = useState<LeagueRow[] | null>(null);
    const [showImporter, setShowImporter] = useState(false);
    const hasAutoSyncedRef = useRef(false);

    const storageKey = clubId ? `clubflow_league_table_${clubId}` : "clubflow_league_table";
    const syncTimestampKey = `${storageKey}_synced_at`;

    // Auto-sync live league table
    const autoSyncFromUrl = async (targetUrl: string, silent = true) => {
        if (!targetUrl) return;
        if (silent) setIsAutoSyncing(true);
        else {
            setIsExtracting(true);
            setExtractionError(null);
            setExtractionStatus("Syncing live standings from league website...");
        }

        try {
            const res = await fetch('/api/sync-league', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: targetUrl, clubName: settings.name || "Camden United", clubId })
            });
            const data = await res.json();
            if (data.success && Array.isArray(data.teams) && data.teams.length > 0) {
                setCurrentTable(data.teams);
                const nowIso = new Date().toISOString();
                setLastSyncedAt(nowIso);
                try {
                    localStorage.setItem(storageKey, JSON.stringify(data.teams));
                    localStorage.setItem(syncTimestampKey, nowIso);
                } catch (e) {}

                const ourRow = data.teams.find((r: any) => r.is_our_club);
                if (ourRow && ourRow.position && ourRow.position !== settings.leaguePosition) {
                    updateSettings({
                        leaguePosition: ourRow.position,
                        leagueUrl: data.resolvedUrl || targetUrl
                    }).catch(() => {});
                }
                setShowImporter(false);
            } else if (!silent) {
                if (data.errorType === 'RATE_LIMITED') {
                    setExtractionError({
                        title: "Daily sync limit reached (10/day)",
                        message: data.error || "You have reached the maximum of 10 live syncs per 24 hours."
                    });
                } else if (data.errorType === 'BLOCKED') {
                    setExtractionError({
                        title: "This website blocks direct automated sync",
                        message: "Use the Paste Table Text or Screenshot tab below for websites protected by Cloudflare CAPTCHA."
                    });
                    setImportMode('text');
                } else {
                    setExtractionError({
                        title: "Could not find standings on that URL",
                        message: data.error || "Please check the league URL or paste the table text."
                    });
                }
            }
        } catch (err) {
            if (!silent) {
                setExtractionError({
                    title: "Connection error",
                    message: "Could not reach the league website."
                });
            }
        } finally {
            setIsAutoSyncing(false);
            setIsExtracting(false);
            setExtractionStatus("");
        }
    };

    // Load saved league table from localStorage AND auto-sync live if cache is older than 6 hours
    useEffect(() => {
        const defaultMitooUrl = (settings.name || "").toLowerCase().includes("camden")
            ? "https://mitoofootball.com/LeagueTab.cfm?TblName=Matches&DivisionID=64&LeagueCode=MDX2026"
            : "";
        const activeUrl = settings.leagueUrl || defaultMitooUrl;

        if (activeUrl && !urlInput) {
            setUrlInput(activeUrl);
        }
        let hasValidCachedTable = false;
        let isCacheFresh = false;
        try {
            const saved = localStorage.getItem(storageKey);
            const savedAt = localStorage.getItem(syncTimestampKey);
            if (savedAt) {
                setLastSyncedAt(savedAt);
                const ageMs = Date.now() - new Date(savedAt).getTime();
                if (ageMs < 6 * 60 * 60 * 1000) {
                    isCacheFresh = true;
                }
            }
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    setCurrentTable(parsed);
                    hasValidCachedTable = true;
                }
            } else if (settings.lastImportHistory?.leagueTable && Array.isArray(settings.lastImportHistory.leagueTable) && settings.lastImportHistory.leagueTable.length > 0) {
                setCurrentTable(settings.lastImportHistory.leagueTable);
                hasValidCachedTable = true;
            }
        } catch (e) {
            console.warn("Failed to load cached league table:", e);
        }

        if (activeUrl && !hasAutoSyncedRef.current && (!hasValidCachedTable || !isCacheFresh)) {
            hasAutoSyncedRef.current = true;
            autoSyncFromUrl(activeUrl, true);
        }
    }, [clubId, settings.leagueUrl, settings.name]);

    const isOurClubName = (teamName: string): boolean => {
        const clubLower = (settings.name || "Camden United").toLowerCase().trim();
        const clubCore = clubLower.replace(/\bfc\b/g, "").trim();
        const candidate = teamName.toLowerCase().trim();
        return candidate === clubLower || candidate.includes(clubLower) || (clubCore.length >= 4 && candidate.includes(clubCore));
    };

    const parseLeagueStandingsText = (raw: string): LeagueRow[] => {
        const lines = raw
            .split(/\r?\n/)
            .map(l => l.trim())
            .filter(Boolean);

        const rows: LeagueRow[] = [];

        for (const line of lines) {
            // Skip header rows
            if (/^(pos|position|rank|#)?\s*(team|club|played|p\s+w\s+d\s+l|overall|home|away)\b/i.test(line) && !/\d+\s+\d+\s+\d+/.test(line)) {
                continue;
            }
            if (/^(fa full-time|premier division|division\s+\d+|standings|table|key|legend|last updated)/i.test(line) && !/\d+\s+\d+\s+\d+/.test(line)) {
                continue;
            }

            const tokens = line.split(/\t+|\s{2,}|\s+/).filter(Boolean);
            if (tokens.length < 5) continue;

            // Collect trailing numeric tokens from the right
            const nums: number[] = [];
            let idx = tokens.length - 1;
            while (idx >= 0) {
                const tok = tokens[idx].replace(/^\+/, '');
                if (/^\d+[\-:]\d+$/.test(tok)) {
                    const [f, a] = tok.split(/[\-:]/).map(Number);
                    nums.unshift(f, a);
                    idx--;
                    continue;
                }
                if (/^-?\d+$/.test(tok)) {
                    nums.unshift( parseInt(tok, 10) );
                    idx--;
                } else {
                    if (nums.length === 0 && /^[WDL\-]{1,6}$/i.test(tok)) {
                        idx--;
                        continue;
                    }
                    break;
                }
            }

            if (nums.length < 4) continue;

            const leftTokens = tokens.slice(0, idx + 1);
            let position = rows.length + 1;
            let nameTokens = leftTokens;

            if (leftTokens.length > 1 && /^\d+\.?$/.test(leftTokens[0])) {
                position = parseInt(leftTokens[0], 10);
                nameTokens = leftTokens.slice(1);
            } else if (leftTokens.length === 0 && nums.length >= 7) {
                continue;
            }

            const teamName = nameTokens
                .join(" ")
                .replace(/^[\-\d\.\)]+\s*/, "")
                .trim();

            if (!teamName || teamName.length < 2 || /^(total|overall|home|away|pos|team|club|p|w|d|l|pts)$/i.test(teamName)) {
                continue;
            }

            let played = 0, won = 0, drawn = 0, lost = 0, goals_for = 0, goals_against = 0, goal_difference = 0, points = 0;

            if (nums.length >= 13) {
                const slice = nums.slice(-13);
                played = slice[0];
                won = slice[1] + slice[6];
                drawn = slice[2] + slice[7];
                lost = slice[3] + slice[8];
                goals_for = slice[4] + slice[9];
                goals_against = slice[5] + slice[10];
                goal_difference = slice[11];
                points = slice[12];
            } else if (nums.length === 11) {
                played = nums[0];
                won = nums[1] + nums[4];
                drawn = nums[2] + nums[5];
                lost = nums[3] + nums[6];
                goals_for = nums[7];
                goals_against = nums[8];
                goal_difference = nums[9];
                points = nums[10];
            } else if (nums.length >= 8) {
                const slice = nums.slice(0, 8);
                played = slice[0];
                won = slice[1];
                drawn = slice[2];
                lost = slice[3];
                goals_for = slice[4];
                goals_against = slice[5];
                goal_difference = slice[6];
                points = slice[7];
            } else if (nums.length === 7) {
                played = nums[0];
                won = nums[1];
                drawn = nums[2];
                lost = nums[3];
                goals_for = nums[4];
                goals_against = nums[5];
                goal_difference = goals_for - goals_against;
                points = nums[6];
            } else if (nums.length === 6) {
                played = nums[0];
                won = nums[1];
                drawn = nums[2];
                lost = nums[3];
                goal_difference = nums[4];
                points = nums[5];
            } else if (nums.length >= 4) {
                played = nums[0];
                won = nums[1];
                drawn = nums[2];
                lost = nums[3] ?? 0;
                points = nums[nums.length - 1];
            }

            rows.push({
                position: position || rows.length + 1,
                team_name: teamName,
                played,
                won,
                drawn,
                lost,
                goals_for,
                goals_against,
                goal_difference,
                points,
                is_our_club: isOurClubName(teamName)
            });
        }

        return rows.map((r, i) => ({
            ...r,
            position: r.position || i + 1
        }));
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && file.type.startsWith('image/')) {
            loadImage(file);
        }
    };

    const handlePaste = (e: React.ClipboardEvent) => {
        const items = e.clipboardData.items;
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.startsWith('image/')) {
                const file = items[i].getAsFile();
                if (file) loadImage(file);
                break;
            }
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        const file = e.dataTransfer.files?.[0];
        if (file && file.type.startsWith('image/')) {
            loadImage(file);
        }
    };

    const processScreenshot = async (base64Image: string) => {
        setIsExtracting(true);
        setExtractionError(null);
        setExtractionStatus("Reading screenshot...");
        
        try {
            const statusSequence = [
                "Identifying teams...",
                "Matching columns...",
                "Preparing your ClubFlow table..."
            ];
            
            let statusIndex = 0;
            const interval = setInterval(() => {
                if (statusIndex < statusSequence.length) {
                    setExtractionStatus(statusSequence[statusIndex]);
                    statusIndex++;
                }
            }, 1200);

            const res = await fetch('/api/parse-league', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image: base64Image, clubName: settings.name })
            });

            clearInterval(interval);
            const data = await res.json();
            
            if (!data.success) {
                setExtractionError({
                    title: "Extraction failed",
                    message: data.error || "We couldn't read the table clearly. Try pasting the table text instead."
                });
            } else {
                setPreviewData(data.teams);
            }
        } catch (error) {
            setExtractionError({
                title: "Network error",
                message: "Could not reach the extraction service."
            });
        } finally {
            setIsExtracting(false);
            setExtractionStatus("");
        }
    };

    const loadImage = (file: File) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            if (e.target?.result) {
                const base64Image = e.target.result as string;
                processScreenshot(base64Image);
            }
        };
        reader.readAsDataURL(file);
    };

    const handleRowChange = (index: number, field: keyof LeagueRow, value: any) => {
        if (!previewData) return;
        const newData = [...previewData];
        // @ts-ignore
        newData[index][field] = value;
        if (field === 'team_name') {
            newData[index].is_our_club = isOurClubName(String(value));
        }
        
        if (['won', 'drawn', 'lost', 'goals_for', 'goals_against'].includes(field)) {
             const row = newData[index];
             if (field === 'goals_for' || field === 'goals_against') {
                 row.goal_difference = row.goals_for - row.goals_against;
             }
             if (field === 'won' || field === 'drawn') {
                 row.points = (row.won * 3) + row.drawn;
             }
        }
        
        setPreviewData(newData);
    };

    const handleExtractUrl = async () => {
        if (!urlInput.trim()) return;
        await autoSyncFromUrl(urlInput.trim(), false);
    };

    const handleExtractText = async () => {
        if (!textInput.trim()) return;
        
        setIsExtracting(true);
        setExtractionError(null);
        setExtractionStatus("Parsing standings rows...");
        
        setTimeout(() => {
            const parsed = parseLeagueStandingsText(textInput);
            setIsExtracting(false);
            setExtractionStatus("");

            if (parsed.length === 0) {
                setExtractionError({
                    title: "Couldn't detect table rows",
                    message: "Make sure you highlight and copy the rows from the league table (including team names and numbers like P, W, D, L, Pts)."
                });
                return;
            }
            setPreviewData(parsed);
        }, 250);
    };

    const handleConfirmImport = async () => {
        if (!previewData || previewData.length === 0) return;
        setIsImporting(true);
        try {
            // Save to localStorage immediately
            localStorage.setItem(storageKey, JSON.stringify(previewData));

            // Find our club's position and update club settings so Dashboard shows the live position
            const ourRow = previewData.find(r => r.is_our_club || isOurClubName(r.team_name));
            const newUpdates: any = {
                lastImportHistory: {
                    ...(settings.lastImportHistory || {}),
                    leagueTable: previewData,
                    updatedAt: new Date().toISOString()
                }
            };
            if (ourRow && ourRow.position) {
                newUpdates.leaguePosition = ourRow.position;
            }
            if (urlInput && urlInput.trim()) {
                newUpdates.leagueUrl = urlInput.trim();
            }
            await updateSettings(newUpdates).catch(() => {});

            // Also ensure all division opponent teams exist in league_teams for autocomplete
            for (const row of previewData) {
                if (!row.team_name || isOurClubName(row.team_name)) continue;
                const { data: existing } = await supabase
                    .from('league_teams')
                    .select('id')
                    .ilike('name', row.team_name.trim())
                    .maybeSingle();
                if (!existing) {
                    await supabase.from('league_teams').insert({
                        name: row.team_name.trim(),
                        club_id: clubId || undefined
                    }).then(() => {});
                }
            }

            setCurrentTable(previewData);
            setPreviewData(null);
            setShowImporter(false);
            setIsSuccess(true);
        } catch (error) {
            console.error(error);
        } finally {
            setIsImporting(false);
        }
    };

    // If we have a preview, show the Review Screen
    if (previewData) {
        return (
            <div className="h-full flex flex-col gap-6 max-w-4xl mx-auto py-8">
                <div>
                    <h2 className="text-2xl font-bold text-foreground">Review League Table</h2>
                    <p className="text-muted-foreground mt-1">Review the extracted standings before saving. Every cell is editable.</p>
                </div>
                
                <Card className="border-border bg-surface-1">
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-muted-foreground uppercase bg-surface-2 border-b border-border">
                                    <tr>
                                        <th className="px-4 py-3 font-medium">Pos</th>
                                        <th className="px-4 py-3 font-medium">Club</th>
                                        <th className="px-4 py-3 font-medium text-center">P</th>
                                        <th className="px-4 py-3 font-medium text-center">W</th>
                                        <th className="px-4 py-3 font-medium text-center">D</th>
                                        <th className="px-4 py-3 font-medium text-center">L</th>
                                        <th className="px-4 py-3 font-medium text-center">GF</th>
                                        <th className="px-4 py-3 font-medium text-center">GA</th>
                                        <th className="px-4 py-3 font-medium text-center">GD</th>
                                        <th className="px-4 py-3 font-medium text-center">Pts</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {previewData.map((row, idx) => (
                                        <tr key={idx} className={`border-b border-border transition-colors ${row.is_our_club ? 'bg-primary/10 border-l-4 border-l-primary' : ''}`}>
                                            <td className="px-2 py-2">
                                                <Input type="number" value={row.position} onChange={(e) => handleRowChange(idx, 'position', parseInt(e.target.value) || 0)} className="w-14 h-8 px-1 text-center font-semibold bg-transparent border-transparent hover:border-border focus:bg-background" />
                                            </td>
                                            <td className={`px-2 py-2 ${row.is_our_club ? 'font-bold text-primary' : 'font-medium text-foreground'}`}>
                                                <Input type="text" value={row.team_name} onChange={(e) => handleRowChange(idx, 'team_name', e.target.value)} className="h-8 px-2 bg-transparent border-transparent hover:border-border focus:bg-background w-full min-w-[160px]" />
                                            </td>
                                            <td className="px-2 py-2">
                                                <Input type="number" value={row.played} onChange={(e) => handleRowChange(idx, 'played', parseInt(e.target.value) || 0)} className="w-12 h-8 px-1 text-center bg-transparent border-transparent hover:border-border focus:bg-background" />
                                            </td>
                                            <td className="px-2 py-2">
                                                <Input type="number" value={row.won} onChange={(e) => handleRowChange(idx, 'won', parseInt(e.target.value) || 0)} className="w-12 h-8 px-1 text-center bg-transparent border-transparent hover:border-border focus:bg-background" />
                                            </td>
                                            <td className="px-2 py-2">
                                                <Input type="number" value={row.drawn} onChange={(e) => handleRowChange(idx, 'drawn', parseInt(e.target.value) || 0)} className="w-12 h-8 px-1 text-center bg-transparent border-transparent hover:border-border focus:bg-background" />
                                            </td>
                                            <td className="px-2 py-2">
                                                <Input type="number" value={row.lost} onChange={(e) => handleRowChange(idx, 'lost', parseInt(e.target.value) || 0)} className="w-12 h-8 px-1 text-center bg-transparent border-transparent hover:border-border focus:bg-background" />
                                            </td>
                                            <td className="px-2 py-2">
                                                <Input type="number" value={row.goals_for} onChange={(e) => handleRowChange(idx, 'goals_for', parseInt(e.target.value) || 0)} className="w-12 h-8 px-1 text-center bg-transparent border-transparent hover:border-border focus:bg-background" />
                                            </td>
                                            <td className="px-2 py-2">
                                                <Input type="number" value={row.goals_against} onChange={(e) => handleRowChange(idx, 'goals_against', parseInt(e.target.value) || 0)} className="w-12 h-8 px-1 text-center bg-transparent border-transparent hover:border-border focus:bg-background" />
                                            </td>
                                            <td className="px-2 py-2 text-center text-muted-foreground font-mono text-xs">{row.goal_difference > 0 ? '+' + row.goal_difference : row.goal_difference}</td>
                                            <td className="px-2 py-2">
                                                 <Input type="number" value={row.points} onChange={(e) => handleRowChange(idx, 'points', parseInt(e.target.value) || 0)} className="w-12 h-8 px-1 text-center font-bold text-foreground bg-transparent border-transparent hover:border-border focus:bg-background" />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>

                <div className="flex justify-between items-center mt-2">
                    <span className="text-sm font-medium text-muted-foreground">{previewData.length} teams recognised</span>
                    <div className="flex gap-3">
                        <Button variant="outline" onClick={() => setPreviewData(null)} disabled={isImporting}>
                            Cancel
                        </Button>
                        <Button onClick={handleConfirmImport} className="bg-brand hover:bg-brand/90 text-white" disabled={isImporting}>
                            {isImporting ? "Saving..." : "Save League Table"}
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    // Success View
    if (isSuccess) {
        return (
            <div className="h-full flex flex-col items-center justify-center gap-4 py-20 max-w-md mx-auto text-center">
                <div className="w-16 h-16 bg-green-500/20 text-green-500 rounded-full flex items-center justify-center mb-2">
                    <CheckCircle2 className="h-8 w-8" />
                </div>
                <h2 className="text-2xl font-bold text-foreground">League table updated</h2>
                <p className="text-muted-foreground">Your standings and club position have been saved across ClubFlow.</p>
                <div className="flex gap-3 mt-4 w-full">
                    <Button variant="outline" className="flex-1" onClick={() => { setIsSuccess(false); setShowImporter(true); }}>Update Again</Button>
                    <Button className="flex-1 bg-brand hover:bg-brand/90 text-white" onClick={() => { setIsSuccess(false); setShowImporter(false); }}>View Table</Button>
                </div>
            </div>
        );
    }

    // If we have an existing table and aren't actively re-importing, show it
    if (currentTable && currentTable.length > 0 && !showImporter) {
        return (
            <div className="h-full flex flex-col gap-6">
                 <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 bg-brand/10 rounded-full flex items-center justify-center">
                            <Trophy className="h-5 w-5 text-brand" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                                <span>League Standings</span>
                                {isAutoSyncing && (
                                    <span className="text-xs font-normal text-emerald-500 animate-pulse">
                                        Syncing live...
                                    </span>
                                )}
                            </h2>
                            <p className="text-sm text-muted-foreground">
                                {lastSyncedAt
                                    ? `Synced live from league website today at ${new Date(lastSyncedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`
                                    : settings.lastImportHistory?.updatedAt
                                        ? `Last updated ${new Date(settings.lastImportHistory.updatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
                                        : "Live division standings"}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        {urlInput && (
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={isAutoSyncing}
                                onClick={() => autoSyncFromUrl(urlInput, false)}
                            >
                                {isAutoSyncing ? "Syncing..." : "🔄 Refresh Live Standings"}
                            </Button>
                        )}
                        {urlInput && (
                            <Button variant="outline" size="sm" onClick={() => window.open(urlInput, '_blank')}>
                                <ExternalLink className="h-4 w-4 mr-1.5" /> Open League Website
                            </Button>
                        )}
                        <Button onClick={() => setShowImporter(true)} className="bg-brand hover:bg-brand/90 text-white" size="sm">
                            Change Source / Import
                        </Button>
                    </div>
                </div>
                
                <Card className="border-border bg-surface-1">
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-muted-foreground uppercase bg-surface-2 border-b border-border">
                                    <tr>
                                        <th className="px-4 py-3 font-medium">Pos</th>
                                        <th className="px-4 py-3 font-medium">Club</th>
                                        <th className="px-4 py-3 font-medium text-center">P</th>
                                        <th className="px-4 py-3 font-medium text-center">W</th>
                                        <th className="px-4 py-3 font-medium text-center">D</th>
                                        <th className="px-4 py-3 font-medium text-center">L</th>
                                        <th className="px-4 py-3 font-medium text-center">GF</th>
                                        <th className="px-4 py-3 font-medium text-center">GA</th>
                                        <th className="px-4 py-3 font-medium text-center">GD</th>
                                        <th className="px-4 py-3 font-medium text-center">Pts</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {currentTable.map((row, idx) => (
                                        <tr key={idx} className={`border-b border-border transition-colors ${row.is_our_club ? 'bg-primary/10 border-l-4 border-l-primary' : ''}`}>
                                            <td className="px-4 py-3 font-semibold">{row.position}</td>
                                            <td className={`px-4 py-3 ${row.is_our_club ? 'font-bold text-primary' : 'font-medium text-foreground'}`}>
                                                {row.team_name}
                                            </td>
                                            <td className="px-4 py-3 text-center">{row.played}</td>
                                            <td className="px-4 py-3 text-center">{row.won}</td>
                                            <td className="px-4 py-3 text-center">{row.drawn}</td>
                                            <td className="px-4 py-3 text-center">{row.lost}</td>
                                            <td className="px-4 py-3 text-center text-muted-foreground">{row.goals_for ?? "-"}</td>
                                            <td className="px-4 py-3 text-center text-muted-foreground">{row.goals_against ?? "-"}</td>
                                            <td className="px-4 py-3 text-center font-mono text-xs text-muted-foreground">{row.goal_difference > 0 ? '+' + row.goal_difference : row.goal_difference}</td>
                                            <td className="px-4 py-3 text-center font-bold text-foreground">{row.points}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    // Import Workflow
    return (
        <div className="h-full flex flex-col gap-6 max-w-2xl mx-auto py-12">
            <div className="text-center mb-2">
                <div className="mx-auto h-16 w-16 bg-brand/10 rounded-full flex items-center justify-center mb-4">
                    <Trophy className="h-8 w-8 text-brand" />
                </div>
                <h2 className="text-3xl font-bold text-foreground tracking-tight">Connect League Table</h2>
                <p className="text-muted-foreground mt-2 text-sm sm:text-base">
                    Connect your league URL once and ClubFlow will automatically sync live standings every time you open this page.
                </p>
                {currentTable && currentTable.length > 0 && (
                    <Button variant="ghost" size="sm" onClick={() => setShowImporter(false)} className="mt-2 text-xs text-muted-foreground">
                        ← Back to Live Standings
                    </Button>
                )}
            </div>

            {extractionError && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex gap-3 items-start animate-in fade-in slide-in-from-top-2">
                    <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                    <div>
                        <h4 className="font-semibold text-amber-500 text-sm">{extractionError.title}</h4>
                        <p className="text-xs text-muted-foreground mt-1">{extractionError.message}</p>
                    </div>
                </div>
            )}

            <Card className="border-border bg-surface-1 shadow-sm">
                <CardHeader className="border-b border-border bg-surface-2/50">
                    <div className="flex gap-4">
                        <button 
                            onClick={() => { setImportMode('url'); setExtractionError(null); }}
                            className={`flex-1 pb-3 text-sm font-semibold transition-all border-b-2 ${importMode === 'url' ? 'border-brand text-brand' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                        >
                            <LinkIcon className="h-4 w-4 mx-auto mb-1" />
                            Live League URL (Auto-Sync)
                        </button>
                        <button 
                            onClick={() => { setImportMode('text'); setExtractionError(null); }}
                            className={`flex-1 pb-3 text-sm font-semibold transition-all border-b-2 ${importMode === 'text' ? 'border-brand text-brand' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                        >
                            <FileText className="h-4 w-4 mx-auto mb-1" />
                            Paste Table Text
                        </button>
                        <button 
                            onClick={() => { setImportMode('screenshot'); setExtractionError(null); }}
                            className={`flex-1 pb-3 text-sm font-semibold transition-all border-b-2 ${importMode === 'screenshot' ? 'border-brand text-brand' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                        >
                            <ImageIcon className="h-4 w-4 mx-auto mb-1" />
                            Screenshot
                        </button>
                    </div>
                </CardHeader>
                <CardContent className="p-6">
                    {importMode === 'url' && (
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="url">League Standings or Team URL</Label>
                                <Input
                                    id="url"
                                    placeholder="https://mitoofootball.com/LeagueTab.cfm?..."
                                    value={urlInput}
                                    onChange={(e) => setUrlInput(e.target.value)}
                                    className="bg-background"
                                />
                                <p className="text-xs text-muted-foreground">
                                    Paste your Mitoo or League URL once — standings will automatically stay updated every week without re-importing.
                                </p>
                            </div>
                            <Button
                                onClick={handleExtractUrl}
                                className="w-full bg-brand hover:bg-brand/90 text-white font-semibold"
                                disabled={!urlInput.trim() || isExtracting}
                            >
                                {isExtracting ? extractionStatus || "Syncing Live Standings..." : "Connect & Sync Live Table"}
                            </Button>
                        </div>
                    )}

                    {importMode === 'text' && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                                <Label htmlFor="text">Paste Standings Rows</Label>
                                {urlInput && (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => window.open(urlInput, '_blank')}
                                        className="h-7 text-xs"
                                    >
                                        <ExternalLink className="h-3.5 w-3.5 mr-1.5" /> Open My League Page ↗
                                    </Button>
                                )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Fallback for websites behind a CAPTCHA: highlight the standings table, press <strong>Ctrl+C</strong>, and paste below.
                            </p>
                            <Textarea 
                                id="text" 
                                placeholder={"Example:\n1\tCamden United\t11\t8\t2\t0\t45\t8\t+37\t26"}
                                value={textInput}
                                onChange={(e) => setTextInput(e.target.value)}
                                className="min-h-[180px] bg-background font-mono text-xs"
                            />
                            <Button 
                                onClick={handleExtractText} 
                                className="w-full bg-brand hover:bg-brand/90 text-white font-semibold" 
                                disabled={!textInput.trim() || isExtracting}
                            >
                                {isExtracting ? extractionStatus || "Parsing..." : "Parse & Review Standings"}
                            </Button>
                        </div>
                    )}

                    {importMode === 'screenshot' && (
                        <div 
                            className="space-y-4 text-center py-8 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-inset rounded-xl transition-all"
                            onPaste={handlePaste}
                            onDragOver={handleDragOver}
                            onDrop={handleDrop}
                            tabIndex={0}
                        >
                            <input 
                                type="file" 
                                accept="image/*" 
                                className="hidden" 
                                ref={fileInputRef}
                                onChange={handleFileChange}
                            />
                            
                            {isExtracting ? (
                                <div className="flex flex-col items-center justify-center py-12 px-4 border-2 border-transparent">
                                    <div className="w-12 h-12 rounded-full border-4 border-primary/30 border-t-primary animate-spin mb-6"></div>
                                    <h4 className="font-semibold text-foreground text-lg mb-2 flex items-center gap-2">
                                        <span className="text-xl">⚽</span> {extractionStatus}
                                    </h4>
                                    <p className="text-sm text-muted-foreground max-w-sm">Turning the screenshot into editable ClubFlow data.</p>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-10 px-4 border-2 border-dashed border-border rounded-xl bg-surface-2/50 cursor-pointer hover:bg-surface-2 transition-colors" onClick={() => fileInputRef.current?.click()}>
                                    <div className="w-14 h-14 rounded-full bg-surface-2 flex items-center justify-center mb-4 shadow-sm border border-border">
                                        <ImageIcon className="h-6 w-6 text-muted-foreground" />
                                    </div>
                                    <h4 className="font-semibold text-foreground text-lg mb-1">Upload or Paste a Screenshot</h4>
                                    <p className="text-sm text-muted-foreground max-w-sm">Drag an image here, press Ctrl+V to paste from your clipboard, or click to browse files.</p>
                                    <Button variant="outline" className="mt-6 border-border bg-surface-1 shadow-sm font-semibold px-6" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}>
                                        Browse Files
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
