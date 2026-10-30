"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { RefreshCw, Link2, FileSpreadsheet, ClipboardPaste, CheckCircle2, AlertTriangle, Trash2, Plus } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getDefaultKickoffTime, resolveFixtureKickoffTime } from "@/lib/whatsapp-utils";

interface ImportCentreProps {
    clubId: string;
    clubName: string;
    clubSettings: any;
    knownOpponents?: string[];
    onImportComplete: (importedIds?: string[]) => void;
    isOpen?: boolean;
    onOpenChange?: (open: boolean) => void;
}

export function FootballDataImportCentre({
    clubId,
    clubName,
    clubSettings,
    knownOpponents = [],
    onImportComplete,
    isOpen,
    onOpenChange
}: ImportCentreProps) {
    const [activeMode, setActiveMode] = useState<'none' | 'url' | 'paste' | 'csv'>('paste');
    const [inputText, setInputText] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    // Preview Modal State
    const [previewData, setPreviewData] = useState<any[]>([]);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const handleParse = async () => {
        if (!inputText.trim()) return;
        setIsLoading(true);

        try {
            if (activeMode === 'paste') {
                const res = await fetch('/api/parse-schedule', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        rawText: inputText,
                        clubName: clubName || "ClubFlow",
                        defaultKickOff: "15:00",
                        knownOpponents
                    })
                });
                const data = await res.json();
                if (data.success && data.parsed && data.parsed.length > 0) {
                    setPreviewData(data.parsed);
                    setIsPreviewOpen(true);
                } else if (data.success && (!data.parsed || data.parsed.length === 0)) {
                    alert("No fixtures could be recognized from the pasted text. Try including a date and opponent name on each line (e.g. '15/08/2026 15:00 ClubFlow United vs Hackney Wick').");
                } else {
                    alert(data.error || "Failed to parse schedule");
                }
            } else if (activeMode === 'url') {
                const res = await fetch('/api/sync-fixtures', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url: inputText, clubName: clubName || "ClubFlow" })
                });
                const data = await res.json();
                const rawList = data.fixtures || data.matches;
                if (data.success && Array.isArray(rawList) && rawList.length > 0) {
                    const mapped = rawList.map((f: any) => ({
                        id: Math.random().toString(36).substring(2, 9),
                        date: f.date,
                        time: resolveFixtureKickoffTime(f.date, f.time),
                        opponent: f.opponent,
                        is_home: f.is_home,
                        competition: f.competition || clubSettings?.defaultCompetition || "League",
                        venue: f.is_home ? (clubSettings?.homeGround || "Home") : "Away",
                        status: (!f.date || !f.opponent) ? 'warning' : 'ready',
                        warnings: []
                    }));
                    setPreviewData(mapped);
                    setIsPreviewOpen(true);
                } else {
                    setActiveMode('paste');
                    setInputText("");
                    alert("FA Full-Time uses Cloudflare security to block automated link scrapers.\n\nWe've switched you to 'Paste Schedule Text' — simply highlight and copy the fixtures table on your FA Full-Time page and paste it directly into the box!");
                }
            } else if (activeMode === 'csv') {
                const lines = inputText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
                const parsedRows: any[] = [];
                for (let i = 0; i < lines.length; i++) {
                    const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
                    if (cols.length < 2) continue;
                    if (i === 0 && /date|opponent|home/i.test(lines[i])) continue; // skip header row
                    const rowDate = cols[0] || new Date().toISOString().split('T')[0];
                    parsedRows.push({
                        id: Math.random().toString(36).substring(2, 9),
                        date: rowDate,
                        time: cols[1] || getDefaultKickoffTime(rowDate),
                        opponent: cols[2] || "",
                        is_home: cols[3] ? !/away|^a$/i.test(cols[3]) : true,
                        competition: cols[4] || "League",
                        venue: cols[3] && /away|^a$/i.test(cols[3]) ? "Away" : "Home",
                        status: cols[0] && cols[2] ? 'ready' : 'warning',
                        warnings: []
                    });
                }
                if (parsedRows.length > 0) {
                    setPreviewData(parsedRows);
                    setIsPreviewOpen(true);
                } else {
                    alert("Could not parse CSV rows. Format as: YYYY-MM-DD, HH:MM, Opponent, Home/Away, Competition");
                }
            }
        } catch (error: any) {
            alert("Error: " + error.message);
        } finally {
            setIsLoading(false);
        }
    };

    const recomputeRowStatus = (item: any) => {
        const warnings: string[] = [];
        if (!item.date) warnings.push('missing_date');
        if (!item.time) warnings.push('missing_time');
        if (!item.opponent || !item.opponent.trim()) warnings.push('check_opponent');
        return {
            ...item,
            warnings,
            status: warnings.length > 0 ? 'warning' : 'ready'
        };
    };

    const updatePreviewItem = (id: string, field: string, value: any) => {
        setPreviewData(prev => prev.map(item => {
            if (item.id !== id) return item;
            const updated = { ...item, [field]: value };
            if (field === 'date') {
                const curKo = (item.time || "").trim().slice(0, 5);
                if (!curKo || curKo === "15:00" || curKo === "19:45" || curKo === "14:00") {
                    updated.time = getDefaultKickoffTime(value);
                }
            }
            if (field === 'is_home') {
                updated.venue = value ? (clubSettings?.homeGround || "Home") : "Away";
            }
            return recomputeRowStatus(updated);
        }));
    };

    const addBlankPreviewRow = () => {
        const today = new Date().toISOString().split('T')[0];
        setPreviewData(prev => [
            ...prev,
            recomputeRowStatus({
                id: Math.random().toString(36).substring(2, 9),
                date: today,
                time: getDefaultKickoffTime(today),
                opponent: "",
                is_home: true,
                competition: "League",
                venue: "Home"
            })
        ]);
    };

    const removePreviewItem = (id: string) => {
        setPreviewData(prev => prev.filter(item => item.id !== id));
    };

    const handleConfirmImport = async () => {
        const validRows = previewData.filter(f => f.opponent && f.opponent.trim() && f.date);
        if (validRows.length === 0) {
            alert("Please ensure at least one fixture has both a Date and an Opponent name.");
            return;
        }
        setIsSaving(true);
        try {
            const toInsert = validRows.map(f => ({
                club_id: clubId || undefined,
                date: f.date,
                time: f.time || getDefaultKickoffTime(f.date),
                opponent: f.opponent.trim(),
                is_home: f.is_home,
                competition: f.competition || "League",
                notes: `[Location: ${f.venue || (f.is_home ? "Home" : "Away")}][Surface: 4G]`,
                scoreline: "",
                result: "Pending"
            }));

            const query = supabase.from('matches').select('id, date, opponent, competition, is_home');
            const { data: existing } = clubId ? await query.eq('club_id', clubId) : await query;

            const finalInsert: any[] = [];
            let updatedCount = 0;
            for (const item of toInsert) {
                const existingMatch = existing?.find(e =>
                    e.date === item.date &&
                    e.opponent.toLowerCase().trim() === item.opponent.toLowerCase().trim()
                );
                if (!existingMatch) {
                    finalInsert.push(item);
                } else if (existingMatch.competition !== item.competition || existingMatch.is_home !== item.is_home) {
                    await supabase
                        .from('matches')
                        .update({ competition: item.competition, is_home: item.is_home })
                        .eq('id', existingMatch.id);
                    updatedCount++;
                }
            }

            let insertedIds: string[] = [];
            if (finalInsert.length > 0) {
                let { data: insertedData, error } = await supabase.from('matches').insert(finalInsert).select('id');
                if (error && error.message.includes('club_id')) {
                    const fallbackInsert = finalInsert.map(({ club_id, ...rest }) => rest);
                    const retry = await supabase.from('matches').insert(fallbackInsert).select('id');
                    error = retry.error;
                    insertedData = retry.data;
                }
                if (error) throw error;
                insertedIds = (insertedData || []).map((r: any) => r.id);
            } else if (updatedCount === 0) {
                alert("All listed fixtures already exist on those dates (duplicates skipped).");
            }

            setIsPreviewOpen(false);
            setInputText("");
            if (onOpenChange) onOpenChange(false);
            onImportComplete(insertedIds);

        } catch (error: any) {
            alert("Database Error: " + error.message);
        } finally {
            setIsSaving(false);
        }
    };

    const importerBody = (
        <div className="space-y-4">
            <datalist id="import-opponents-datalist">
                {knownOpponents.map(opp => (
                    <option key={opp} value={opp} />
                ))}
            </datalist>

            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap gap-2">
                    <Button
                        type="button"
                        variant={activeMode === 'paste' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => { setActiveMode('paste'); setInputText(""); }}
                        className={activeMode === 'paste' ? "bg-brand text-brand-foreground" : "bg-surface-2 border-border"}
                    >
                        <ClipboardPaste className="h-4 w-4 mr-2 text-emerald-500" />
                        Paste Schedule Text
                    </Button>
                    <Button
                        type="button"
                        variant={activeMode === 'url' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => {
                            setActiveMode('url');
                            setInputText(clubSettings?.leagueUrl || "https://mitoofootball.com/TeamHistAll.cfm?CI=68&TblName=Matches&LeagueCode=MDX2026&DivisionID=64");
                        }}
                        className={activeMode === 'url' ? "bg-brand text-brand-foreground" : "bg-surface-2 border-border"}
                    >
                        <Link2 className="h-4 w-4 mr-2 text-indigo-400" />
                        Import from League URL
                    </Button>
                    <Button
                        type="button"
                        variant={activeMode === 'csv' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => { setActiveMode('csv'); setInputText(""); }}
                        className={activeMode === 'csv' ? "bg-brand text-brand-foreground" : "bg-surface-2 border-border"}
                    >
                        <FileSpreadsheet className="h-4 w-4 mr-2 text-amber-500" />
                        Import CSV
                    </Button>
                </div>
            </div>

            <div className="pt-2 space-y-3">
                {activeMode === 'url' && (
                    <div className="flex flex-col sm:flex-row gap-2">
                        <Input
                            placeholder="https://mitoofootball.com/TeamHistAll.cfm?..."
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            className="bg-surface-2 border-border flex-1"
                        />
                        <Button onClick={handleParse} disabled={isLoading || !inputText.trim()} className="bg-indigo-600 hover:bg-indigo-700 text-white shrink-0">
                            {isLoading ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : null}
                            Fetch & Review
                        </Button>
                    </div>
                )}

                {activeMode === 'paste' && (
                    <div className="space-y-3">
                        <p className="text-xs text-muted-foreground">
                            Highlight and copy rows directly from <strong>FA Full-Time / Mitoo</strong>, WhatsApp, or an email and paste below. League &amp; Cup competitions are detected automatically, and you can review every row before saving.
                        </p>
                        <Textarea
                            placeholder={"Example:\n15/08/2026 14:00  ClubFlow United vs Hackney Wick\n22/08/2026 14:00  Athletic Newham vs ClubFlow United"}
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            className="bg-surface-2 border-border min-h-[140px] font-mono text-xs"
                        />
                        <div className="flex justify-between items-center">
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                    setPreviewData([{
                                        id: Math.random().toString(36).substring(2, 9),
                                        date: new Date().toISOString().split('T')[0],
                                        time: clubSettings?.defaultHomeKickOff || "14:00",
                                        opponent: "",
                                        is_home: true,
                                        competition: "League",
                                        venue: "Home",
                                        status: 'warning',
                                        warnings: ['check_opponent']
                                    }]);
                                    setIsPreviewOpen(true);
                                }}
                                className="text-xs text-muted-foreground hover:text-foreground"
                            >
                                <Plus className="h-3.5 w-3.5 mr-1" /> Open Manual Bulk Grid Instead
                            </Button>
                            <Button onClick={handleParse} disabled={isLoading || !inputText.trim()} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                                {isLoading ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : null}
                                Parse & Review Fixtures
                            </Button>
                        </div>
                    </div>
                )}

                {activeMode === 'csv' && (
                    <div className="space-y-3">
                        <p className="text-xs text-muted-foreground">
                            Paste comma-separated lines: <code className="bg-surface-2 px-1 py-0.5 rounded">YYYY-MM-DD, HH:MM, Opponent, Home/Away, Competition</code>
                        </p>
                        <Textarea
                            placeholder={"2026-08-15, 14:00, Hackney Wick, Home, League\n2026-08-22, 14:00, Athletic Newham, Away, Cup"}
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            className="bg-surface-2 border-border min-h-[120px] font-mono text-xs"
                        />
                        <div className="flex justify-end">
                            <Button onClick={handleParse} disabled={isLoading || !inputText.trim()} className="bg-amber-600 hover:bg-amber-700 text-white">
                                Parse CSV & Review
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );

    return (
        <>
            {isOpen !== undefined && onOpenChange ? (
                <Dialog open={isOpen} onOpenChange={onOpenChange}>
                    <DialogContent className="sm:max-w-[680px] bg-surface-1 border-border text-foreground">
                        <DialogHeader>
                            <DialogTitle className="text-lg font-bold">Paste / Import Fixtures</DialogTitle>
                            <DialogDescription className="text-xs text-muted-foreground">
                                Paste schedules from FA Full-Time, import from a link, or enter multiple fixtures in a table.
                            </DialogDescription>
                        </DialogHeader>
                        {importerBody}
                    </DialogContent>
                </Dialog>
            ) : null}

            {/* Editable Review Import Modal (#1) */}
            <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
                <DialogContent className="max-w-4xl bg-surface-1 border-border text-foreground max-h-[88vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold flex items-center justify-between pr-6">
                            <span>Review & Edit Imported Fixtures ({previewData.length})</span>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={addBlankPreviewRow}
                                className="h-8 text-xs border-border bg-surface-2"
                            >
                                <Plus className="h-3.5 w-3.5 mr-1" /> Add Row
                            </Button>
                        </DialogTitle>
                        <DialogDescription className="text-muted-foreground text-xs">
                            Every field below is editable. Fix any misread opponent names, toggle <strong>Home / Away</strong>, or click the red trash icon to remove unwanted rows before importing.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto py-3">
                        {previewData.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                                No fixtures in list. Click &ldquo;Add Row&rdquo; above or paste again.
                            </div>
                        ) : (
                            <div className="border border-border rounded-lg overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-surface-2 text-muted-foreground text-[11px] uppercase border-b border-border">
                                        <tr>
                                            <th className="px-3 py-2.5 w-10">Status</th>
                                            <th className="px-3 py-2.5 w-36">Date</th>
                                            <th className="px-3 py-2.5 w-28">KO Time</th>
                                            <th className="px-3 py-2.5 w-24 text-center">H / A</th>
                                            <th className="px-3 py-2.5 min-w-[200px]">Opposition Team</th>
                                            <th className="px-3 py-2.5 w-32">Competition</th>
                                            <th className="px-3 py-2.5 w-12 text-right">Delete</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border bg-surface-1">
                                        {previewData.map((item) => (
                                            <tr key={item.id} className="hover:bg-surface-2/40 transition-colors">
                                                <td className="px-3 py-2">
                                                    {item.status === 'ready' ? (
                                                        <span className="inline-flex items-center text-emerald-500" title="Ready to import">
                                                            <CheckCircle2 className="h-4 w-4" />
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center text-amber-500" title="Please check highlighted fields">
                                                            <AlertTriangle className="h-4 w-4" />
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-3 py-2">
                                                    <Input
                                                        type="date"
                                                        value={item.date || ""}
                                                        onChange={(e) => updatePreviewItem(item.id, 'date', e.target.value)}
                                                        className={`h-8 text-xs px-2 bg-surface-2 ${!item.date ? 'border-amber-500' : 'border-border'}`}
                                                    />
                                                </td>
                                                <td className="px-3 py-2">
                                                    <Input
                                                        type="time"
                                                        value={item.time || ""}
                                                        onChange={(e) => updatePreviewItem(item.id, 'time', e.target.value)}
                                                        className={`h-8 text-xs px-2 bg-surface-2 ${!item.time ? 'border-amber-500' : 'border-border'}`}
                                                    />
                                                </td>
                                                <td className="px-3 py-2 text-center">
                                                    <button
                                                        type="button"
                                                        onClick={() => updatePreviewItem(item.id, 'is_home', !item.is_home)}
                                                        className={`px-2.5 py-1 rounded text-xs font-bold border transition-colors ${
                                                            item.is_home
                                                                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/25'
                                                                : 'bg-sky-500/15 text-sky-400 border-sky-500/30 hover:bg-sky-500/25'
                                                        }`}
                                                        title="Click to toggle Home / Away"
                                                    >
                                                        {item.is_home ? 'HOME' : 'AWAY'}
                                                    </button>
                                                </td>
                                                <td className="px-3 py-2">
                                                    <Input
                                                        type="text"
                                                        list="import-opponents-datalist"
                                                        placeholder="Enter opponent name..."
                                                        value={item.opponent || ""}
                                                        onChange={(e) => updatePreviewItem(item.id, 'opponent', e.target.value)}
                                                        className={`h-8 text-xs font-semibold bg-surface-2 ${!item.opponent?.trim() ? 'border-amber-500' : 'border-border'}`}
                                                    />
                                                </td>
                                                <td className="px-3 py-2">
                                                    <select
                                                        value={item.competition || "League"}
                                                        onChange={(e) => updatePreviewItem(item.id, 'competition', e.target.value)}
                                                        className="h-8 w-full rounded-md border border-border bg-surface-2 px-2 text-xs text-foreground outline-none"
                                                    >
                                                        <option value="League">League</option>
                                                        <option value="Cup">Cup</option>
                                                        <option value="Friendly">Friendly</option>
                                                    </select>
                                                </td>
                                                <td className="px-3 py-2 text-right">
                                                    <button
                                                        type="button"
                                                        onClick={() => removePreviewItem(item.id)}
                                                        className="p-1.5 rounded hover:bg-rose-500/15 text-rose-500 transition-colors"
                                                        title="Remove this fixture row"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    <DialogFooter className="border-t border-border pt-4 flex items-center justify-between">
                        <span className="text-xs text-muted-foreground mr-auto">
                            {previewData.filter(f => f.opponent?.trim() && f.date).length} valid fixture(s) ready to save
                        </span>
                        <Button variant="ghost" onClick={() => setIsPreviewOpen(false)}>Cancel</Button>
                        <Button
                            onClick={handleConfirmImport}
                            disabled={isSaving || previewData.length === 0}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                        >
                            {isSaving ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : null}
                            Confirm & Import ({previewData.filter(f => f.opponent?.trim() && f.date).length})
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
