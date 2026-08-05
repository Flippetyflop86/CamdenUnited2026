"use client";

import { useState, useEffect } from "react";
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
    
    const [isExtracting, setIsExtracting] = useState(false);
    const [extractionStatus, setExtractionStatus] = useState("");
    const [extractionError, setExtractionError] = useState<{title: string, message: string} | null>(null);
    
    // Preview State
    const [previewData, setPreviewData] = useState<LeagueRow[] | null>(null);
    const [isImporting, setIsImporting] = useState(false);

    // Existing Data
    const [currentTable, setCurrentTable] = useState<LeagueRow[] | null>(null);

    // Mock fetching the canonical table
    useEffect(() => {
        // In reality, this would fetch from the new `league_table` Supabase table
        // For now we leave it empty to show the empty state
        setCurrentTable(null);
    }, []);

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
                // If it worked, set preview data (Mocked for now since sync-league currently only gets position)
                // We will implement the full extraction API next
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
        
        // This will call the Gemini API via /api/extract-league
        // Mocking delay for now until API is built
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
        setIsImporting(true);
        // This will insert into `league_table` Supabase table
        setTimeout(() => {
            setIsImporting(false);
            setCurrentTable(previewData);
            setPreviewData(null);
        }, 1000);
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
                                    {previewData.map((row) => (
                                        <tr key={row.position} className={`border-b border-border ${row.is_our_club ? 'bg-brand/5' : ''}`}>
                                            <td className="px-4 py-3 font-semibold">{row.position}</td>
                                            <td className={`px-4 py-3 ${row.is_our_club ? 'font-bold text-brand' : 'font-medium text-foreground'}`}>
                                                {row.team_name}
                                            </td>
                                            <td className="px-4 py-3 text-center">{row.played}</td>
                                            <td className="px-4 py-3 text-center">{row.won}</td>
                                            <td className="px-4 py-3 text-center">{row.drawn}</td>
                                            <td className="px-4 py-3 text-center">{row.lost}</td>
                                            <td className="px-4 py-3 text-center">{row.goal_difference}</td>
                                            <td className="px-4 py-3 text-center font-bold">{row.points}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>

                <div className="flex justify-end gap-3">
                    <Button variant="outline" onClick={() => setPreviewData(null)} disabled={isImporting}>
                        Cancel
                    </Button>
                    <Button onClick={handleConfirmImport} className="bg-brand hover:bg-brand/90 text-white" disabled={isImporting}>
                        {isImporting ? "Importing..." : "Confirm & Import Table"}
                    </Button>
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
                {/* Render the actual table here (similar to preview) */}
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
                <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-start gap-3 text-left">
                    <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                    <div>
                        <h4 className="font-semibold text-amber-900">{extractionError.title}</h4>
                        <p className="text-sm text-amber-800 mt-1">{extractionError.message}</p>
                    </div>
                </div>
            )}

            <Card className="border-border bg-surface-1 shadow-sm overflow-hidden">
                <div className="flex border-b border-border bg-surface-2">
                    <button 
                        onClick={() => setImportMode('url')}
                        className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 border-b-2 transition-colors ${importMode === 'url' ? 'border-brand text-brand bg-surface-1' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                    >
                        <LinkIcon className="h-4 w-4" />
                        Paste URL
                    </button>
                    <button 
                        onClick={() => setImportMode('text')}
                        className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 border-b-2 transition-colors ${importMode === 'text' ? 'border-brand text-brand bg-surface-1' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                    >
                        <FileText className="h-4 w-4" />
                        Paste Text
                    </button>
                    <button 
                        onClick={() => setImportMode('screenshot')}
                        className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 border-b-2 transition-colors ${importMode === 'screenshot' ? 'border-brand text-brand bg-surface-1' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                    >
                        <ImageIcon className="h-4 w-4" />
                        Screenshot
                    </button>
                </div>
                
                <CardContent className="p-6">
                    {importMode === 'url' && (
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="url">League Website URL</Label>
                                <Input 
                                    id="url" 
                                    placeholder="https://mitoofootball.com/..." 
                                    value={urlInput}
                                    onChange={(e) => setUrlInput(e.target.value)}
                                    className="bg-background"
                                />
                                <p className="text-xs text-muted-foreground">We support Mitoo, FA Full-Time, League Republic, and more.</p>
                            </div>
                            <Button 
                                onClick={handleExtractUrl} 
                                className="w-full bg-brand hover:bg-brand/90 text-white" 
                                disabled={!urlInput || isExtracting}
                            >
                                {isExtracting ? extractionStatus || "Analysing..." : "Import League Table"}
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
                        <div className="space-y-4 text-center py-8">
                            <div className="mx-auto w-12 h-12 rounded-full bg-surface-2 flex items-center justify-center mb-2">
                                <ImageIcon className="h-6 w-6 text-muted-foreground" />
                            </div>
                            <div>
                                <h4 className="font-semibold text-foreground">Upload a screenshot</h4>
                                <p className="text-sm text-muted-foreground mt-1">Take a screenshot of the league table and drag it here.</p>
                            </div>
                            <Button variant="outline" className="mt-4">
                                Browse Files
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
