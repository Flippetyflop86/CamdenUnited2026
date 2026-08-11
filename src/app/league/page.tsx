"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ExternalLink, AlertCircle, Settings, Trophy, Link as LinkIcon, Image as ImageIcon, FileText, CheckCircle2 } from "lucide-react";
import { useClub } from "@/context/club-context";
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
    
    // Import State
    const [importMode, setImportMode] = useState<'url' | 'screenshot' | 'text'>('url');
    const [urlInput, setUrlInput] = useState("");
    const [textInput, setTextInput] = useState("");
    const [screenshotImage, setScreenshotImage] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    const [isExtracting, setIsExtracting] = useState(false);
    const [extractionStatus, setExtractionStatus] = useState("");
    const [extractionError, setExtractionError] = useState<{title: string, message: string} | null>(null);
    
    // Preview State
    const [previewData, setPreviewData] = useState<LeagueRow[] | null>(null);
    const [isImporting, setIsImporting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);

    // Existing Data
    const [currentTable, setCurrentTable] = useState<LeagueRow[] | null>(null);

    // Mock fetching the canonical table
    useEffect(() => {
        // In reality, this would fetch from the new `league_table` Supabase table
        // For now we leave it empty to show the empty state
        setCurrentTable(null);
    }, []);

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
            // Sequence loading states
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
                    message: data.error || "We couldn't read the table clearly."
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
        
        // Recalculate GD and Points if relevant
        if (['won', 'drawn', 'lost', 'goals_for', 'goals_against'].includes(field)) {
             const row = newData[index];
             row.goal_difference = row.goals_for - row.goals_against;
             row.points = (row.won * 3) + row.drawn;
        }
        
        setPreviewData(newData);
    };

    const handleExtractUrl = async () => {
        if (!urlInput) return;
        
        setIsExtracting(true);
        setExtractionError(null);
        setExtractionStatus("Analysing webpage...");
        
        try {
            const res = await fetch('/api/sync-league', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: urlInput, clubName: settings.name })
            });

            const data = await res.json();
            
            if (data.errorType === 'BLOCKED') {
                // Graceful fallback
                setExtractionError({
                    title: "Security blocks detected",
                    message: "We couldn't read that page directly because the league website is blocking automated access, but there's another quick way."
                });
                setImportMode('text'); // Pivot to text
            } else if (!data.success) {
                setExtractionError({
                    title: "Extraction failed",
                    message: data.error || "Could not find a league table on this page."
                });
            } else {
                // Mock preview data since sync-league only returns position for now
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

    const handleExtractText = async () => {
        if (!textInput) return;
        
        setIsExtracting(true);
        setExtractionError(null);
        setExtractionStatus("Analysing pasted text...");
        
        setTimeout(() => {
            setIsExtracting(false);
            setExtractionStatus("");
            
            // Mock preview data
            setPreviewData([
                { position: 1, team_name: "Camden United", played: 10, won: 8, drawn: 1, lost: 1, goals_for: 24, goals_against: 8, goal_difference: 16, points: 25, is_our_club: true },
                { position: 2, team_name: "London FC", played: 10, won: 7, drawn: 2, lost: 1, goals_for: 20, goals_against: 10, goal_difference: 10, points: 23, is_our_club: false },
            ]);
        }, 2000);
    };

    const handleConfirmImport = async () => {
        if (!previewData) return;
        setIsImporting(true);
        try {
            // Wait we will implement real supabase call here next, mock for now
            await fetch('/api/league/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ teams: previewData, clubName: settings.name })
            });
            setCurrentTable(previewData);
            setPreviewData(null);
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
                    <p className="text-muted-foreground mt-1">Review the extracted data before importing. You can make manual corrections if necessary.</p>
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
                                        <th className="px-4 py-3 font-medium text-center">GD</th>
                                        <th className="px-4 py-3 font-medium text-center">Pts</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {previewData.map((row, idx) => (
                                        <tr key={idx} className={`border-b border-border transition-colors ${row.is_our_club ? 'bg-primary/5 border-l-4 border-l-primary' : ''}`}>
                                            <td className="px-2 py-2">
                                                <Input type="number" value={row.position} onChange={(e) => handleRowChange(idx, 'position', parseInt(e.target.value) || 0)} className="w-16 h-8 px-1 text-center font-semibold bg-transparent border-transparent hover:border-border focus:bg-background" />
                                            </td>
                                            <td className={`px-2 py-2 ${row.is_our_club ? 'font-bold text-primary' : 'font-medium text-foreground'}`}>
                                                <Input type="text" value={row.team_name} onChange={(e) => handleRowChange(idx, 'team_name', e.target.value)} className="h-8 px-2 bg-transparent border-transparent hover:border-border focus:bg-background w-full min-w-[140px]" />
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
                <p className="text-muted-foreground">Your league table has been successfully saved and is now visible across ClubFlow.</p>
                <div className="flex gap-3 mt-4 w-full">
                    <Button variant="outline" className="flex-1" onClick={() => setIsSuccess(false)}>Import Another</Button>
                    <Button className="flex-1 bg-brand hover:bg-brand/90 text-white" onClick={() => { setIsSuccess(false); setCurrentTable(currentTable || []); }}>View Table</Button>
                </div>
            </div>
        );
    }

    // If we have an existing table, show it
    if (currentTable) {
        return (
            <div className="h-full flex flex-col gap-6">
                 <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 bg-brand/10 rounded-full flex items-center justify-center">
                            <Trophy className="h-5 w-5 text-brand" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-foreground">League Standings</h2>
                            <p className="text-sm text-muted-foreground">Canonical league data</p>
                        </div>
                    </div>
                    <Button variant="outline" onClick={() => setCurrentTable(null)}>
                        Update Table
                    </Button>
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
                                        <th className="px-4 py-3 font-medium text-center">GD</th>
                                        <th className="px-4 py-3 font-medium text-center">Pts</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {currentTable.map((row, idx) => (
                                        <tr key={idx} className={`border-b border-border transition-colors ${row.is_our_club ? 'bg-primary/5 border-l-4 border-l-primary' : ''}`}>
                                            <td className="px-4 py-3 font-semibold">{row.position}</td>
                                            <td className={`px-4 py-3 ${row.is_our_club ? 'font-bold text-primary' : 'font-medium text-foreground'}`}>
                                                {row.team_name}
                                            </td>
                                            <td className="px-4 py-3 text-center">{row.played}</td>
                                            <td className="px-4 py-3 text-center">{row.won}</td>
                                            <td className="px-4 py-3 text-center">{row.drawn}</td>
                                            <td className="px-4 py-3 text-center">{row.lost}</td>
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
        )
    }

    // Empty State: Import Workflow
    return (
        <div className="h-full flex flex-col gap-6 max-w-2xl mx-auto py-12">
            <div className="text-center mb-4">
                <div className="mx-auto h-16 w-16 bg-brand/10 rounded-full flex items-center justify-center mb-4">
                    <Trophy className="h-8 w-8 text-brand" />
                </div>
                <h2 className="text-3xl font-bold text-foreground tracking-tight">Import League Table</h2>
                <p className="text-muted-foreground mt-2 text-lg">
                    ClubFlow intelligently extracts standings from any league website.
                </p>
            </div>

            {extractionError && (
                <div className="bg-red-950 border border-red-900 rounded-xl p-4 flex gap-3 items-start animate-in fade-in slide-in-from-top-2">
                    <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                    <div>
                        <h4 className="font-semibold text-red-400">{extractionError.title}</h4>
                        <p className="text-sm text-red-300 mt-1">{extractionError.message}</p>
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
                            League URL
                        </button>
                        <button 
                            onClick={() => { setImportMode('screenshot'); setExtractionError(null); }}
                            className={`flex-1 pb-3 text-sm font-semibold transition-all border-b-2 ${importMode === 'screenshot' ? 'border-brand text-brand' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                        >
                            <ImageIcon className="h-4 w-4 mx-auto mb-1" />
                            Screenshot
                        </button>
                        <button 
                            onClick={() => { setImportMode('text'); setExtractionError(null); }}
                            className={`flex-1 pb-3 text-sm font-semibold transition-all border-b-2 ${importMode === 'text' ? 'border-brand text-brand' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                        >
                            <FileText className="h-4 w-4 mx-auto mb-1" />
                            Paste Text
                        </button>
                    </div>
                </CardHeader>
                <CardContent className="p-6">
                    {importMode === 'url' && (
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="url">League Website URL</Label>
                                <Input 
                                    id="url" 
                                    placeholder="https://fulltime.thefa.com/..." 
                                    value={urlInput}
                                    onChange={(e) => setUrlInput(e.target.value)}
                                    className="bg-background"
                                />
                                <p className="text-xs text-muted-foreground">We support FA Full-Time, Mitoo, and most standard league websites.</p>
                            </div>
                            <Button 
                                onClick={handleExtractUrl} 
                                className="w-full bg-brand hover:bg-brand/90 text-white" 
                                disabled={!urlInput || isExtracting}
                            >
                                {isExtracting ? extractionStatus || "Connecting..." : "Sync League"}
                            </Button>
                        </div>
                    )}

                    {importMode === 'text' && (
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="text">Pasted Table Content</Label>
                                <Textarea 
                                    id="text" 
                                    placeholder="Highlight the table on the website, press Ctrl+C, and paste it here..." 
                                    value={textInput}
                                    onChange={(e) => setTextInput(e.target.value)}
                                    className="min-h-[160px] bg-background font-mono text-sm"
                                />
                            </div>
                            <Button 
                                onClick={handleExtractText} 
                                className="w-full bg-brand hover:bg-brand/90 text-white" 
                                disabled={!textInput || isExtracting}
                            >
                                {isExtracting ? extractionStatus || "Analysing..." : "Extract from Text"}
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
                                    <h4 className="font-semibold text-foreground text-lg mb-1">Upload a screenshot</h4>
                                    <p className="text-sm text-muted-foreground max-w-sm">Drag an image here, paste from your clipboard, or click to browse files.</p>
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
