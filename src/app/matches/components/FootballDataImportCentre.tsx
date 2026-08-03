"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
    CalendarDays, 
    Link2, 
    ClipboardPaste,
    CheckCircle2,
    AlertCircle,
    ChevronRight,
    ArrowRight,
    Trash2,
    Clock,
    X,
    Save,
    Puzzle
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

interface ParsedItem {
    id: string;
    date: string | null;
    time: string | null;
    opponent: string;
    is_home: boolean;
    competition: string;
    venue: string;
    status: 'ready' | 'warning' | 'duplicate';
    warnings: string[];
}

interface FootballDataImportCentreProps {
    clubId: string;
    clubName: string;
    clubSettings: any;
    onImportComplete: () => void;
}

export function FootballDataImportCentre({ clubId, clubName, clubSettings, onImportComplete }: FootballDataImportCentreProps) {
    const [isPasteModalOpen, setIsPasteModalOpen] = useState(false);
    const [isBrowserIntegrationModalOpen, setIsBrowserIntegrationModalOpen] = useState(false);
    const [rawText, setRawText] = useState("");
    const [isParsing, setIsParsing] = useState(false);
    
    const [isReviewOpen, setIsReviewOpen] = useState(false);
    const [parsedItems, setParsedItems] = useState<ParsedItem[]>([]);
    
    const [isSuccessOpen, setIsSuccessOpen] = useState(false);
    const [importStats, setImportStats] = useState({ imported: 0, skipped: 0, reviews: 0 });

    const handleParse = async () => {
        if (!rawText.trim()) return;
        setIsParsing(true);
        try {
            const res = await fetch('/api/parse-schedule', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rawText, clubName, defaultKickOff: clubSettings?.defaultHomeKickOff })
            });
            const data = await res.json();
            if (data.success) {
                // Check DB for duplicates here (skipped for brevity in this initial iteration, will add in next pass)
                setParsedItems(data.parsed);
                setIsPasteModalOpen(false);
                setRawText("");
                setIsReviewOpen(true);
            }
        } catch (error) {
            console.error("Failed to parse", error);
        } finally {
            setIsParsing(false);
        }
    };

    const handleImport = async () => {
        const readyFixtures = parsedItems.filter(i => i.status === 'ready');
        
        try {
            const res = await fetch('/api/import-fixtures', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fixtures: readyFixtures, clubId })
            });
            
            const data = await res.json();
            if (!data.success) {
                console.error("Import failed:", data.error);
                alert("Failed to import: " + data.error);
                return;
            }
            
            setImportStats({
                imported: readyFixtures.length,
                skipped: parsedItems.filter(i => i.status === 'duplicate').length,
                reviews: parsedItems.filter(i => i.status === 'warning').length
            });
            
            setIsReviewOpen(false);
            setIsSuccessOpen(true);
            onImportComplete();
        } catch (e) {
            console.error(e);
        }
    };

    const removeItem = (id: string) => {
        setParsedItems(prev => prev.filter(p => p.id !== id));
    };

    return (
        <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold font-heading text-foreground">Import Fixtures</h2>
                <Badge variant="outline" className="bg-brand/10 text-brand border-brand/20">Data Centre</Badge>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Method 1: Paste (Primary) */}
                <Card 
                    className="border-brand/20 bg-brand/5 hover:bg-brand/10 transition-colors cursor-pointer p-6 flex flex-col justify-between"
                    onClick={() => setIsPasteModalOpen(true)}
                >
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                                <div className="h-8 w-8 rounded-full bg-brand/20 flex items-center justify-center">
                                    <ClipboardPaste className="h-4 w-4 text-brand" />
                                </div>
                                <h3 className="font-semibold text-foreground">Paste Fixture List</h3>
                            </div>
                            <Badge className="bg-brand text-primary-foreground">Recommended</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-2">
                            Fastest and most reliable. Copy fixtures from FA Full-Time, Mitoo, email, WhatsApp, or spreadsheet.
                        </p>
                    </div>
                    <div className="mt-4 flex items-center text-sm font-medium text-brand">
                        Start Import <ArrowRight className="h-4 w-4 ml-1" />
                    </div>
                </Card>

                {/* Method 2: Browser Integration */}
                <Card className="border-border bg-surface-1 p-6 flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                                <div className="h-8 w-8 rounded-full bg-brand/10 flex items-center justify-center">
                                    <Puzzle className="h-4 w-4 text-brand" />
                                </div>
                                <h3 className="font-semibold text-foreground">Browser Integration</h3>
                            </div>
                            <Badge variant="outline" className="text-muted-foreground border-brand/20 bg-brand/5 text-brand">Chrome & Edge</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-2">
                            Install the ClubFlow Browser Extension to import fixtures directly from supported football websites without copying and pasting.
                        </p>
                    </div>
                    <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <Button type="button" variant="outline" className="font-bold border-brand/30 text-brand bg-brand/10 hover:bg-brand/20" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsBrowserIntegrationModalOpen(true); }}>
                            Install Extension
                        </Button>
                        <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsBrowserIntegrationModalOpen(true); }} className="text-xs font-semibold text-muted-foreground hover:text-foreground hover:underline text-left">
                            Learn More
                        </button>
                    </div>
                </Card>
            </div>

            {/* Import History */}
            {clubSettings?.lastImportHistory && (
                <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground px-2">
                    <Clock className="h-4 w-4" />
                    <span>
                        Last Import: {clubSettings.lastImportHistory.imported} imported, {clubSettings.lastImportHistory.skipped} skipped, {clubSettings.lastImportHistory.failed} failed.
                    </span>
                    <span className="opacity-50">({new Date(clubSettings.lastImportHistory.date).toLocaleDateString()})</span>
                </div>
            )}

            {/* Browser Integration Modal */}
            <Dialog open={isBrowserIntegrationModalOpen} onOpenChange={setIsBrowserIntegrationModalOpen}>
                <DialogContent className="sm:max-w-md bg-surface-1 border-border">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Puzzle className="h-5 w-5 text-brand" />
                            Browser Integration
                        </DialogTitle>
                        <DialogDescription>
                            Import fixtures with a single click.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4 text-sm text-foreground">
                        <p>
                            The <strong>ClubFlow Browser Extension</strong> (for Chrome & Edge) is currently in development.
                        </p>
                        <p>
                            Once released, it will sit in your browser toolbar. When you visit a supported league website (like FA Full-Time), you can click it to automatically extract all fixtures and send them directly into the ClubFlow Import Engine.
                        </p>
                        <p className="text-muted-foreground">
                            For now, please continue using the <strong className="text-foreground">Paste Fixture List</strong> method, which uses AI to instantly parse any text you copy from those websites.
                        </p>
                    </div>
                    <div className="flex justify-end">
                        <Button onClick={() => setIsBrowserIntegrationModalOpen(false)} className="bg-brand hover:bg-brand/90 text-primary-foreground">
                            Got it
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Paste Modal */}
            <Dialog open={isPasteModalOpen} onOpenChange={setIsPasteModalOpen}>
                <DialogContent className="sm:max-w-xl bg-surface-1 border-border" preventCloseOnOutsideClick={true}>
                    <DialogHeader>
                        <DialogTitle>Paste Fixture List</DialogTitle>
                        <DialogDescription>
                            Highlight your fixtures on FA Full-Time, Mitoo, or a spreadsheet, press Ctrl+C, and paste them below.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <Textarea 
                            placeholder="e.g. Camden United vs Hackney FC  14:00  Sat 15 Aug" 
                            className="min-h-[200px] bg-surface-2 border-border font-mono text-sm"
                            value={rawText}
                            onChange={(e) => setRawText(e.target.value)}
                        />
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setIsPasteModalOpen(false)}>Cancel</Button>
                        <Button onClick={handleParse} disabled={!rawText.trim() || isParsing} className="bg-brand hover:bg-brand/90 text-primary-foreground">
                            {isParsing ? "Parsing..." : "Parse Text"}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Gmail-Style Review Modal */}
            <Dialog open={isReviewOpen} onOpenChange={setIsReviewOpen}>
                <DialogContent className="max-w-4xl bg-surface-1 border-border max-h-[90vh] flex flex-col" preventCloseOnOutsideClick={true}>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            Review Import
                            <Badge variant="secondary">{parsedItems.length} found</Badge>
                        </DialogTitle>
                        <DialogDescription>
                            Review your parsed fixtures. Resolve any warnings before importing.
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="flex-1 overflow-y-auto py-4 space-y-2 pr-2">
                        {parsedItems.map((item, idx) => (
                            <div key={item.id} className="group flex items-center justify-between p-3 rounded-lg border border-border bg-surface-2/50 hover:bg-surface-2 transition-colors">
                                <div className="flex items-center gap-4 flex-1">
                                    {/* Status Icon */}
                                    {item.status === 'ready' && <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />}
                                    {item.status === 'warning' && <AlertCircle className="h-5 w-5 text-amber-500 shrink-0" />}
                                    {item.status === 'duplicate' && <AlertCircle className="h-5 w-5 text-slate-500 shrink-0" />}
                                    
                                    {/* Match Info */}
                                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-6 flex-1 text-sm">
                                        <div className="w-24 font-medium">{item.date ? new Date(item.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : 'Unknown Date'}</div>
                                        <div className="w-16 text-muted-foreground">{item.is_home ? "Home" : "Away"}</div>
                                        <div className="flex-1 font-semibold truncate">{item.opponent}</div>
                                        <div className="w-24 text-muted-foreground truncate">{item.competition}</div>
                                        
                                        {/* Kick Off resolution */}
                                        <div className="w-32">
                                            {item.warnings.includes('missing_time') ? (
                                                <Input 
                                                    type="time" 
                                                    className="h-8 w-24 bg-amber-500/10 border-amber-500/50 text-amber-500" 
                                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                                        const newItems = [...parsedItems];
                                                        const idx = newItems.findIndex(i => i.id === item.id);
                                                        if (idx > -1 && e.target.value) {
                                                            newItems[idx].time = e.target.value;
                                                            newItems[idx].warnings = newItems[idx].warnings.filter(w => w !== 'missing_time');
                                                            if (newItems[idx].warnings.length === 0) newItems[idx].status = 'ready';
                                                            setParsedItems(newItems);
                                                        }
                                                    }}
                                                />
                                            ) : (
                                                <span className="font-mono">{item.time}</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                
                                {/* Actions */}
                                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button variant="ghost" size="icon" onClick={() => removeItem(item.id)} className="h-8 w-8 text-muted-foreground hover:text-red-500">
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                    
                    <div className="flex justify-between items-center pt-4 border-t border-border mt-auto">
                        <div className="text-sm text-muted-foreground">
                            {parsedItems.filter(i => i.status === 'warning').length > 0 ? (
                                <span className="text-amber-500 flex items-center gap-1"><AlertCircle className="h-4 w-4"/> Resolve warnings to ensure accuracy</span>
                            ) : (
                                <span className="text-emerald-500 flex items-center gap-1"><CheckCircle2 className="h-4 w-4"/> All ready to import</span>
                            )}
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={() => setIsReviewOpen(false)}>Discard</Button>
                            <Button onClick={handleImport} className="bg-brand hover:bg-brand/90 text-primary-foreground">
                                Import {parsedItems.length} Fixtures
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Success Summary */}
            <Dialog open={isSuccessOpen} onOpenChange={setIsSuccessOpen}>
                <DialogContent className="sm:max-w-md bg-surface-1 border-border text-center pb-8" preventCloseOnOutsideClick={true}>
                    <div className="flex justify-center mt-6 mb-4">
                        <div className="h-16 w-16 rounded-full bg-emerald-500/20 flex items-center justify-center">
                            <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                        </div>
                    </div>
                    <DialogHeader>
                        <DialogTitle className="text-2xl text-center">Import Complete</DialogTitle>
                    </DialogHeader>
                    
                    <div className="space-y-4 my-6">
                        <div className="flex justify-between items-center p-3 rounded-lg bg-surface-2 border border-border">
                            <span className="text-foreground">Imported</span>
                            <span className="font-semibold text-emerald-500">{importStats.imported}</span>
                        </div>
                        <div className="flex justify-between items-center p-3 rounded-lg bg-surface-2 border border-border">
                            <span className="text-foreground">Duplicates Skipped</span>
                            <span className="font-semibold text-muted-foreground">{importStats.skipped}</span>
                        </div>
                        <div className="flex justify-between items-center p-3 rounded-lg bg-surface-2 border border-border">
                            <span className="text-foreground">Requires Review</span>
                            <span className="font-semibold text-amber-500">{importStats.reviews}</span>
                        </div>
                    </div>
                    
                    <Button onClick={() => setIsSuccessOpen(false)} className="w-full bg-brand hover:bg-brand/90 text-primary-foreground">
                        Close
                    </Button>
                </DialogContent>
            </Dialog>
        </div>
    );
}
