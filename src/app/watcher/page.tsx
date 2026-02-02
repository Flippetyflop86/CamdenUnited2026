"use client";

import { useState, useEffect } from "react";
import { Match, WatcherMatchStats, WatcherHalfStats, WatcherTeamStats } from "@/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useClub } from "@/context/club-context";
import { Save, AlertCircle, TrendingUp, Activity, RotateCcw, Target } from "lucide-react";
import { supabase } from "@/lib/supabase";

const initialHalfStats: WatcherHalfStats = {
    deliveries: 0,
    halfChances: 0,
    chances: 0,
    massiveChancesNoShot: 0,
    massiveChancesShot: 0,
    goals: 0
};

const initialTeamStats: WatcherTeamStats = {
    firstHalf: { ...initialHalfStats },
    secondHalf: { ...initialHalfStats }
};

export default function WatcherPage() {
    const { settings } = useClub();
    const [matches, setMatches] = useState<Match[]>([]);
    const [watcherStats, setWatcherStats] = useState<WatcherMatchStats[]>([]);
    const [selectedMatchId, setSelectedMatchId] = useState<string>("");

    // Form state
    const [currentStats, setCurrentStats] = useState<WatcherMatchStats | null>(null);
    const [isDirty, setIsDirty] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);

    useEffect(() => {
        fetchData();
        const channel = supabase.channel('public:watcher_stats')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'watcher_stats' }, fetchStatsOnly)
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, []);

    const fetchData = async () => {
        await Promise.all([fetchMatches(), fetchStatsOnly()]);
    };

    const fetchMatches = async () => {
        const { data } = await supabase.from('matches').select('*').neq('result', 'Pending').order('date', { ascending: false });
        if (data) setMatches(data as any);
    };

    const fetchStatsOnly = async () => {
        const { data } = await supabase.from('watcher_stats').select('*');
        if (data) {
            setWatcherStats(data.map((s: any) => ({
                id: s.id,
                matchId: s.match_id,
                us: s.us,
                opposition: s.opposition,
                createdAt: s.created_at,
                updatedAt: s.updated_at
            })));
        }
    };

    // ... handleMatchSelect remains same ...

    // ... updateHalfStat remains same ...

    const saveStats = async () => {
        if (!currentStats) return;

        const payload = {
            match_id: currentStats.matchId,
            us: currentStats.us,
            opposition: currentStats.opposition,
            updated_at: new Date().toISOString()
        };

        try {
            // Check if exists
            const existing = watcherStats.find(s => s.matchId === currentStats.matchId);

            if (existing) {
                await supabase.from('watcher_stats').update(payload).eq('match_id', currentStats.matchId);
            } else {
                await supabase.from('watcher_stats').insert([payload]);
            }

            setIsDirty(false);
            // alert("Stats saved successfully"); // Optional
        } catch (e: any) {
            alert("Error saving stats: " + e.message);
        }
    };

    const importScreenshotData = async () => {
        if (!selectedMatchId) {
            alert("Please select a match from the dropdown first.");
            return;
        }

        const newStats: WatcherMatchStats = {
            id: Date.now().toString(),
            matchId: selectedMatchId,
            us: {
                firstHalf: { deliveries: 2, halfChances: 2, chances: 2, massiveChancesNoShot: 0, massiveChancesShot: 1, goals: 2 },
                secondHalf: { deliveries: 7, halfChances: 1, chances: 2, massiveChancesNoShot: 0, massiveChancesShot: 5, goals: 1 }
            },
            opposition: {
                firstHalf: { deliveries: 10, halfChances: 2, chances: 2, massiveChancesNoShot: 0, massiveChancesShot: 1, goals: 0 },
                secondHalf: { deliveries: 13, halfChances: 4, chances: 1, massiveChancesNoShot: 0, massiveChancesShot: 0, goals: 1 }
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        // Save immediately
        const payload = {
            match_id: selectedMatchId,
            us: newStats.us,
            opposition: newStats.opposition,
            updated_at: new Date().toISOString()
        };

        // Upsert logic
        const { error } = await supabase.from('watcher_stats').upsert(payload, { onConflict: 'match_id' });

        if (error) {
            alert("Error importing stats: " + error.message);
        } else {
            setCurrentStats(newStats);
            alert(`Data imported!`);
        }
    };

    // ... handlePaste remains same ...

    // ... inside parseOCRText ...
    // Need to intercept where it calls save logic at end of parseOCRText

    const handlePaste = async () => {
        try {
            const clipboardItems = await navigator.clipboard.read();
            for (const item of clipboardItems) {
                if (item.types.some(type => type.startsWith('image/'))) {
                    const blob = await item.getType(item.types.find(type => type.startsWith('image/'))!);
                    processImage(blob);
                    return;
                }
            }
            alert("No image found in clipboard. Please take a screenshot (Win+Shift+S) and try again.");
        } catch (err) {
            console.error(err);
            alert("Failed to read clipboard. Please click 'Allow' if asked, or use Ctrl+V on the page.");
        }
    };

    const processImage = async (imageBlob: Blob) => {
        if (!selectedMatchId) {
            alert("Please select a match first.");
            setIsProcessing(false); // Ensure processing state is reset
            return;
        }

        setIsProcessing(true);
        try {
            // @ts-ignore - Tesseract added via script tag
            const Tesseract = window.Tesseract;
            if (!Tesseract) {
                alert("OCR Library not loaded. Please refresh the page.");
                setIsProcessing(false);
                return;
            }

            const { data: { text } } = await Tesseract.recognize(imageBlob, 'eng', {
                logger: (m: any) => console.log(m)
            });

            console.log("OCR Text:", text);
            parseOCRText(text);

        } catch (err) {
            console.error(err);
            alert("Failed to process image.");
        } finally {
            setIsProcessing(false);
        }
    };

    const parseOCRText = (text: string) => {
        console.log("Raw OCR Text:", text); // Debugging

        const lines = text.split('\n').filter(line => line.trim().length > 0);

        let firstHalfUs: number[] = [];
        let firstHalfOpp: number[] = [];
        let secondHalfUs: number[] = [];
        let secondHalfOpp: number[] = [];

        let section = "none"; // none, 1st, 2nd
        let rowsInsection = 0;

        lines.forEach(line => {
            const lower = line.toLowerCase();

            // Section Detection - explicit keywords
            if (lower.includes("1st half") || lower.includes("ist half") || lower.includes("1st")) {
                section = "1st";
                rowsInsection = 0;
                return;
            }
            if (lower.includes("2nd half") || lower.includes("on half") || lower.includes("2nd")) {
                section = "2nd";
                rowsInsection = 0;
                return;
            }

            // Extract numbers
            // We strip out common non-digit noise but keep spaces to separate numbers if helpful? 
            // Actually simply matching \d+ is usually robust enough for Tesseract unless it reads 'O' as '0' or 'l' as '1'.
            // Tesseract generally does okay with digits in tables.
            const numbers = line.match(/\d+/g)?.map(Number) || [];

            // Heuristic: A valid stat line should have at least 3 numbers (Delivery, Half Chance, Chance...)
            // If massive chance or goal is 0/blank, it might be missed, so we accept 3.
            if (numbers.length >= 3) {
                rowsInsection++;

                // Positional Logic: 
                // Row 1 in a section is Us. Row 2 is THEM.
                // We ignore subsequent rows (totals).

                if (section === "1st") {
                    if (rowsInsection === 1) firstHalfUs = numbers;
                    else if (rowsInsection === 2) firstHalfOpp = numbers;
                } else if (section === "2nd") {
                    if (rowsInsection === 1) secondHalfUs = numbers;
                    else if (rowsInsection === 2) secondHalfOpp = numbers;
                }
            }
        });

        // Fallback: If we missed the "2nd Half" header but found 4 valid rows, assume the last 2 are 2nd half.
        // (Not implemented for simplicity, but good to keep in mind).

        if (firstHalfUs.length === 0 || secondHalfUs.length === 0) {
            console.warn("Parsing failed", { firstHalfUs, firstHalfOpp, secondHalfUs, secondHalfOpp });
            alert(`Could not detect all stats rows.\n\nTip: Ensure the screenshot includes "1st Half" and "2nd Half" headers.\n\nRaw Text Found: ${text.substring(0, 100)}...`);
            return;
        }

        // Helper: Pad arrays to 5 elements (Delivery, Half, Chance, Massive, Goal)
        const pad = (arr: number[]) => {
            const padded = [...arr];
            while (padded.length < 5) padded.push(0); // Assume missing trailing values are 0 (e.g. no goals)
            return padded;
        };

        // Map array to stats. 
        // Index 0: Delivery, 1: Half Chance, 2: Chance, 3: Massive Chance, 4: Goals
        const mapStats = (arr: number[]) => {
            const p = pad(arr);
            return {
                deliveries: p[0] || 0,
                halfChances: p[1] || 0,
                chances: p[2] || 0,
                massiveChancesNoShot: 0,
                massiveChancesShot: p[3] || 0,
                goals: p[4] || 0
            };
        };

        const newStats: WatcherMatchStats = {
            id: Date.now().toString(),
            matchId: selectedMatchId!,
            us: {
                firstHalf: mapStats(firstHalfUs),
                secondHalf: mapStats(secondHalfUs)
            },
            opposition: {
                firstHalf: mapStats(firstHalfOpp),
                secondHalf: mapStats(secondHalfOpp)
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        // Update existing stats or add new ones
        const payload = {
            match_id: selectedMatchId!,
            us: newStats.us,
            opposition: newStats.opposition,
            updated_at: new Date().toISOString()
        };

        supabase.from('watcher_stats').upsert(payload, { onConflict: 'match_id' }).then(({ error }) => {
            if (error) alert("Error saving OCR stats: " + error.message);
            else alert("Stats updated from screenshot!");
        });

        setCurrentStats(newStats);
    };

    const handleResetStats = async () => {
        if (!currentStats) return;
        if (!confirm("Are you sure you want to reset all stats for this match? This will clear the data from your graph.")) return;

        // Delete from DB
        await supabase.from('watcher_stats').delete().eq('match_id', currentStats.matchId);

        // Reset UI
        const resetStats = {
            ...currentStats,
            us: JSON.parse(JSON.stringify(initialTeamStats)),
            opposition: JSON.parse(JSON.stringify(initialTeamStats))
        };
        setCurrentStats(resetStats);
        setIsDirty(false);
    };

    const calculateTotals = (teamStats: WatcherTeamStats) => {
        const keys = Object.keys(initialHalfStats) as (keyof WatcherHalfStats)[];
        const totals: Record<string, number> = {};

        keys.forEach(key => {
            totals[key] = (teamStats.firstHalf[key] || 0) + (teamStats.secondHalf[key] || 0);
        });

        return totals as unknown as WatcherHalfStats;
    };

    const getDominantTeam = (usTotal: number, oppTotal: number, opponentName: string) => {
        if (usTotal > oppTotal) return { text: settings.name, color: "text-green-600" };
        if (oppTotal > usTotal) return { text: opponentName, color: "text-red-600" };
        return { text: "Equal", color: "text-slate-500" };
    };

    const calculateConversionRate = (goals: number, massiveChancesShot: number) => {
        if (massiveChancesShot === 0) return 0;
        return ((goals / massiveChancesShot) * 100).toFixed(1);
    };

    const calculateDominance = (stats: WatcherHalfStats) => {
        return (stats.deliveries * 1) +
            (stats.halfChances * 2) +
            (stats.chances * 3) +
            (stats.massiveChancesNoShot * 4) +
            (stats.massiveChancesShot * 5);
    };

    // Aggregate Stats
    const aggregateStats = watcherStats.reduce((acc, curr) => {
        ['us', 'opposition'].forEach((team) => {
            const t = team as 'us' | 'opposition';
            ['firstHalf', 'secondHalf'].forEach((half) => {
                const h = half as 'firstHalf' | 'secondHalf';
                const stats = curr[team as 'us' | 'opposition'][half as 'firstHalf' | 'secondHalf'];

                Object.keys(stats).forEach(k => {
                    const key = k as keyof WatcherHalfStats;
                    if (!acc[t]) acc[t] = {} as any;
                    if (!acc[t][key]) acc[t][key] = 0;
                    acc[t][key] += (stats[key] || 0);
                });
            });
        });
        return acc;
    }, { us: {}, opposition: {} } as Record<'us' | 'opposition', Record<keyof WatcherHalfStats, number>>);

    const gamesCount = watcherStats.length || 1;

    // Derived opponent name
    const selectedMatch = matches.find(m => m.id === selectedMatchId);
    const opponentName = selectedMatch ? selectedMatch.opponent : "Opposition";

    // Helper to render input row
    const StatRow = ({ label, field }: { label: string, field: keyof WatcherHalfStats }) => (
        <div className="grid grid-cols-5 gap-2 items-center border-b border-slate-100 py-3 last:border-0 hover:bg-slate-50 transition-colors">
            <div className="text-sm font-medium text-slate-600 md:col-span-1">{label}</div>
            <div className="md:col-span-2 grid grid-cols-2 gap-2">
                <Input
                    type="number" className="h-8 text-center" placeholder="1H"
                    value={currentStats?.us.firstHalf[field] || 0}
                    onChange={(e) => updateHalfStat("us", "firstHalf", field, e.target.value)}
                />
                <Input
                    type="number" className="h-8 text-center" placeholder="2H"
                    value={currentStats?.us.secondHalf[field] || 0}
                    onChange={(e) => updateHalfStat("us", "secondHalf", field, e.target.value)}
                />
            </div>
            <div className="md:col-span-2 grid grid-cols-2 gap-2">
                <Input
                    type="number" className="h-8 text-center border-red-200 focus-visible:ring-red-500" placeholder="1H"
                    value={currentStats?.opposition.firstHalf[field] || 0}
                    onChange={(e) => updateHalfStat("opposition", "firstHalf", field, e.target.value)}
                />
                <Input
                    type="number" className="h-8 text-center border-red-200 focus-visible:ring-red-500" placeholder="2H"
                    value={currentStats?.opposition.secondHalf[field] || 0}
                    onChange={(e) => updateHalfStat("opposition", "secondHalf", field, e.target.value)}
                />
            </div>
        </div>
    );

    return (
        <div className="space-y-6 pb-12">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-slate-900">Watcher System</h2>
                    <p className="text-slate-500">Track dominance and advanced metrics for recorded games.</p>
                    <Button
                        onClick={handlePaste}
                        disabled={isProcessing}
                        variant="default"
                        size="sm"
                        className="mt-2 text-xs bg-blue-600 hover:bg-blue-700"
                    >
                        {isProcessing ? "Processing Screenshot..." : "Paste Screenshot (Ctrl+V)"}
                    </Button>
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                    <select
                        className="h-10 w-full sm:w-[250px] rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
                        value={selectedMatchId}
                        onChange={(e) => handleMatchSelect(e.target.value)}
                    >
                        <option value="">Select a played match...</option>
                        {matches
                            .filter(m => m.result !== "Pending")
                            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                            .map(match => (
                                <option key={match.id} value={match.id}>
                                    {match.isHome ? 'vs' : '@'} {match.opponent} ({match.scoreline || 'N/A'})
                                </option>
                            ))
                        }
                    </select>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">

                {/* INPUT SECTION */}
                <div className="lg:col-span-7 space-y-6">
                    {selectedMatchId && currentStats ? (
                        <Card>
                            <CardHeader className="pb-3 border-b flex flex-row items-center justify-between">
                                <div>
                                    <CardTitle>Match Data Entry</CardTitle>
                                    <CardDescription>Enter stats for both halves</CardDescription>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button
                                        onClick={handleResetStats}
                                        variant="ghost"
                                        size="sm"
                                        className="text-slate-400 hover:text-red-500 hover:bg-red-50"
                                    >
                                        <RotateCcw className="h-4 w-4 mr-2" />
                                        Reset
                                    </Button>
                                    {isDirty && (
                                        <Button onClick={saveStats} size="sm" className="bg-green-600 hover:bg-green-700">
                                            <Save className="h-4 w-4 mr-2" />
                                            Save Changes
                                        </Button>
                                    )}
                                </div>
                            </CardHeader>
                            <CardContent className="pt-4">
                                <div className="grid grid-cols-5 gap-2 mb-4 text-xs font-bold uppercase text-slate-400 text-center">
                                    <div className="md:col-span-1 text-left">Metric</div>
                                    <div className="md:col-span-2 text-green-700">{settings.name} (H1 / H2)</div>
                                    <div className="md:col-span-2 text-red-600">{opponentName} (H1 / H2)</div>
                                </div>

                                <StatRow label="Deliveries" field="deliveries" />
                                <StatRow label="1/2 Chances" field="halfChances" />
                                <StatRow label="Chances" field="chances" />
                                <StatRow label="Massive Chance (No Shot)" field="massiveChancesNoShot" />
                                <StatRow label="Massive Chance (Shot)" field="massiveChancesShot" />
                                <StatRow label="Goals" field="goals" />

                            </CardContent>
                        </Card>
                    ) : (
                        <Card className="border-dashed border-2 shadow-none bg-slate-50">
                            <CardContent className="flex flex-col items-center justify-center py-12 text-center text-slate-400">
                                <Activity className="h-10 w-10 mb-3 opacity-20" />
                                <p>Select a completed match above to view or enter watcher data.</p>
                            </CardContent>
                        </Card>
                    )}

                    {/* SEASON AVERAGES */}
                    {watcherStats.length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">Season Averages (Recorded Games)</CardTitle>
                                <CardDescription>
                                    Based on {watcherStats.length} games. Note: Personnel changes may impact relevance.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b text-left text-xs font-medium text-slate-500 uppercase">
                                                <th className="pb-2">Metric (Avg)</th>
                                                <th className="pb-2 text-center">{settings.name}</th>
                                                <th className="pb-2 text-center">Opposition</th>
                                                <th className="pb-2 text-right">Diff</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {(['deliveries', 'halfChances', 'chances', 'massiveChancesNoShot', 'massiveChancesShot', 'goals'] as (keyof WatcherHalfStats)[]).map(key => {
                                                const usAvg = (aggregateStats.us[key] || 0) / gamesCount;
                                                const oppAvg = (aggregateStats.opposition[key] || 0) / gamesCount;
                                                const diff = usAvg - oppAvg;

                                                return (
                                                    <tr key={key}>
                                                        <td className="py-2 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</td>
                                                        <td className="py-2 text-center font-medium">{usAvg.toFixed(1)}</td>
                                                        <td className="py-2 text-center text-slate-600">{oppAvg.toFixed(1)}</td>
                                                        <td className={`py-2 text-right font-bold ${diff > 0 ? 'text-green-600' : diff < 0 ? 'text-red-600' : 'text-slate-400'}`}>
                                                            {diff > 0 ? '+' : ''}{diff.toFixed(1)}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                            {/* Conversion Rate Row */}
                                            <tr className="bg-slate-50 font-bold">
                                                <td className="py-2">Massive Chance Conv. %</td>
                                                <td className="py-2 text-center text-green-700">
                                                    {calculateConversionRate(aggregateStats.us.goals || 0, aggregateStats.us.massiveChancesShot || 0)}%
                                                </td>
                                                <td className="py-2 text-center text-red-700">
                                                    {calculateConversionRate(aggregateStats.opposition.goals || 0, aggregateStats.opposition.massiveChancesShot || 0)}%
                                                </td>
                                                <td className="py-2 text-right text-slate-400">-</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>

                {/* ANALYSIS SECTION */}
                <div className="lg:col-span-5 space-y-6">
                    {selectedMatchId && currentStats ? (
                        <>
                            {/* NEW VERDICT CARD */}
                            <Card className="bg-white border-slate-200 shadow-md mb-6">
                                <CardHeader className="pb-2">
                                    <div className="flex items-center gap-2">
                                        <Target className="h-5 w-5 text-indigo-600" />
                                        <CardTitle className="text-lg text-slate-900">Performance Verdict</CardTitle>
                                    </div>
                                    <CardDescription>Based on quality of chances created (excluding goals)</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    {(() => {
                                        const usTotals = calculateTotals(currentStats.us);
                                        const oppTotals = calculateTotals(currentStats.opposition);
                                        const usScore = calculateDominance(usTotals);
                                        const oppScore = calculateDominance(oppTotals);
                                        const totalScore = usScore + oppScore;
                                        const usPercent = totalScore > 0 ? (usScore / totalScore) * 100 : 50;

                                        return (
                                            <div className="space-y-4">
                                                <div className="flex justify-between items-end text-xl font-bold">
                                                    <span className={usScore >= oppScore ? "text-green-600" : "text-red-500"}>{settings.name}: {usScore}</span>
                                                    <span className={oppScore > usScore ? "text-green-600" : "text-red-500"}>{opponentName}: {oppScore}</span>
                                                </div>
                                                <div className="h-6 bg-slate-100 rounded-lg overflow-hidden flex relative border border-slate-200">
                                                    <div style={{ width: `${usPercent}%` }} className={`h-full transition-all duration-500 ${usScore >= oppScore ? "bg-green-500" : "bg-red-500"}`} />
                                                    <div className={`flex-1 h-full ${usScore >= oppScore ? "bg-red-500" : "bg-green-500"}`} />
                                                    {/* Center Marker */}
                                                    <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-white/50 z-10" />
                                                </div>
                                                <p className="text-sm font-medium text-slate-600 text-center">
                                                    {usScore >= oppScore
                                                        ? (usScore > oppScore ? "✅ We were the dominant team" : "⚖️ Evenly matched")
                                                        : "❌ Opposition was dominant"}
                                                </p>
                                            </div>
                                        );
                                    })()}
                                </CardContent>
                            </Card>

                            <Card className="bg-slate-900 text-white border-slate-800">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-lg">Match Analysis</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    {(() => {
                                        const usTotals = calculateTotals(currentStats.us);
                                        const oppTotals = calculateTotals(currentStats.opposition);

                                        return (
                                            <div className="space-y-4">
                                                <div className="flex justify-between items-end border-b border-slate-700 pb-1">
                                                    <span className="text-sm text-slate-400">Total Dominance</span>
                                                </div>
                                                {(['deliveries', 'halfChances', 'chances', 'massiveChancesNoShot', 'massiveChancesShot'] as (keyof WatcherHalfStats)[]).map(key => {
                                                    const dom = getDominantTeam(usTotals[key], oppTotals[key], opponentName);
                                                    let label = key.replace(/([A-Z])/g, ' $1').trim();
                                                    if (key === 'halfChances') label = '1/2 Chances';
                                                    if (key === 'massiveChancesNoShot') label = 'Massive Chance (No Shot)';
                                                    if (key === 'massiveChancesShot') label = 'Massive Chance (Shot)';

                                                    return (
                                                        <div key={key} className="flex justify-between items-center text-sm">
                                                            <span className="capitalize text-slate-300">{label}</span>
                                                            <div className="flex items-center gap-3">
                                                                <span className="font-mono text-slate-500 text-xs">{usTotals[key]} - {oppTotals[key]}</span>
                                                                <span className={`font-bold ${dom.color === 'text-green-600' ? 'text-green-400' : dom.color === 'text-red-600' ? 'text-red-400' : 'text-slate-500'}`}>
                                                                    {dom.text}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        );
                                    })()}
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <div className="flex items-center gap-2">
                                        <TrendingUp className="h-4 w-4 text-blue-500" />
                                        <CardTitle className="text-base">Half-Time Comparison</CardTitle>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-4 text-sm">
                                        <div>
                                            <div className="flex justify-between font-medium mb-1">
                                                <span>First Half Goals</span>
                                                <span className="text-slate-500">{currentStats.us.firstHalf.goals} - {currentStats.opposition.firstHalf.goals}</span>
                                            </div>
                                            <div className="h-2 bg-slate-100 rounded-full overflow-hidden flex">
                                                <div style={{ width: `${(currentStats.us.firstHalf.goals + currentStats.opposition.firstHalf.goals) > 0 ? (currentStats.us.firstHalf.goals / (currentStats.us.firstHalf.goals + currentStats.opposition.firstHalf.goals)) * 100 : 50}%` }} className="bg-green-500 h-full" />
                                                <div className="bg-red-500 flex-1 h-full" />
                                            </div>
                                        </div>
                                        <div>
                                            <div className="flex justify-between font-medium mb-1">
                                                <span>Second Half Goals</span>
                                                <span className="text-slate-500">{currentStats.us.secondHalf.goals} - {currentStats.opposition.secondHalf.goals}</span>
                                            </div>
                                            <div className="h-2 bg-slate-100 rounded-full overflow-hidden flex">
                                                <div style={{ width: `${(currentStats.us.secondHalf.goals + currentStats.opposition.secondHalf.goals) > 0 ? (currentStats.us.secondHalf.goals / (currentStats.us.secondHalf.goals + currentStats.opposition.secondHalf.goals)) * 100 : 50}%` }} className="bg-green-500 h-full" />
                                                <div className="bg-red-500 flex-1 h-full" />
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </>
                    ) : (
                        <div className="h-full flex items-center justify-center border-l border-slate-100 pl-6">
                            <p className="text-slate-300 italic text-sm text-center max-w-xs">
                                Select a match to view analysis and dominance metrics.
                            </p>
                        </div>
                    )
                    }
                </div >
            </div >
        </div >
    );
}
