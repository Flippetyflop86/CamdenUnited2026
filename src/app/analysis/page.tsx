"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { Match, Player } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Target, Activity, Trash2, ShieldHalf, LayoutDashboard, RotateCcw, BarChart } from "lucide-react";
import Link from "next/link";
import { useClub } from "@/context/club-context";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MatchStatsDialog } from "@/components/matches/match-stats-dialog";

type ShotOutcome = "Goal" | "Saved" | "Missed" | "Blocked";

type BuildUpType = "Attacking Transition" | "Defensive Transition" | "Settled Possession" | "Set Piece";
type ChanceQuality = "Delivery" | "1/2 Chance" | "Chance" | "Massive Chance";

interface Shot {
    id: string;
    playerId: string;
    x: number; // percentage 0-100
    y: number; // percentage 0-100
    outcome: ShotOutcome;
    minute?: number;
    buildUp?: BuildUpType;
    quality?: ChanceQuality;
    isDelivery?: boolean;
}

interface DominanceStats {
    deliveries: number;
    halfChances: number;
    chances: number;
    ooohs: number;
    goals: number;
}

interface MatchAnalysis {
    goals: { playerId: string; count: number }[];
    assists: { playerId: string; count: number }[];
    shots: Shot[];
    dominance: { us: DominanceStats, opposition: DominanceStats };
}

const calculateDominancePoints = (stats: DominanceStats) => {
    if (!stats) return 0;
    return (stats.deliveries || 0) * 1 +
           (stats.halfChances || 0) * 2 +
           (stats.chances || 0) * 3 +
           (stats.ooohs || 0) * 5 +
           (stats.goals || 0) * 10;
};

export default function AnalysisPage() {
    const { settings } = useClub();
    const [matches, setMatches] = useState<Match[]>([]);
    const [players, setPlayers] = useState<Player[]>([]);
    const [selectedMatchId, setSelectedMatchId] = useState<string>("");
    const [goalPlayerId, setGoalPlayerId] = useState<string>("");
    const [assistPlayerId, setAssistPlayerId] = useState<string>("");
    const defaultDominance = {
        us: { deliveries: 0, halfChances: 0, chances: 0, ooohs: 0, goals: 0 },
        opposition: { deliveries: 0, halfChances: 0, chances: 0, ooohs: 0, goals: 0 }
    };
    const [analysis, setAnalysis] = useState<MatchAnalysis>({ goals: [], assists: [], shots: [], dominance: defaultDominance });
    const [isSaving, setIsSaving] = useState(false);
    const selectedMatch = matches.find(m => m.id === selectedMatchId);

    // Shot Dialog State
    const [isShotDialogOpen, setIsShotDialogOpen] = useState(false);
    const [pendingShot, setPendingShot] = useState<{ x: number, y: number } | null>(null);
    const [shotForm, setShotForm] = useState<{
        playerId: string;
        outcome: ShotOutcome;
        minute: string;
        buildUp?: BuildUpType;
        quality?: ChanceQuality;
        isDelivery?: boolean;
    }>({ playerId: "", outcome: "Goal" as ShotOutcome, minute: "" });

    const pitchRef = useRef<HTMLDivElement>(null);
    const reticleRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        fetchInitialData();
    }, []);

    useEffect(() => {
        if (matches.length > 0) {
            const params = new URLSearchParams(window.location.search);
            const mId = params.get("matchId");
            if (mId && matches.some(m => m.id === mId)) {
                setSelectedMatchId(mId);
            }
        }
    }, [matches]);

    useEffect(() => {
        if (selectedMatchId) {
            loadMatchAnalysis(selectedMatchId);
        } else {
            setAnalysis({ goals: [], assists: [], shots: [], dominance: defaultDominance });
        }
    }, [selectedMatchId]);

    async function fetchInitialData() {
        try {
            const [matchesRes, playersRes] = await Promise.all([
                supabase.from("matches").select("*").order("date", { ascending: false }),
                supabase.from("players").select("*")
            ]);

            if (matchesRes.data) {
                setMatches(matchesRes.data.map(m => ({
                    id: m.id,
                    date: m.date,
                    opponent: m.opponent,
                    isHome: m.is_home,
                    scoreline: m.scoreline,
                    competition: m.competition,
                    time: m.time
                })) as Match[]);
            }

            if (playersRes.data) {
                const posOrder: Record<string, number> = { "GK": 1, "DEF": 2, "MID": 3, "FWD": 4 };
                const mappedPlayers = playersRes.data.map(p => ({
                    id: p.id,
                    firstName: p.first_name,
                    lastName: p.last_name,
                    position: p.position
                })).sort((a, b) => (posOrder[a.position] || 5) - (posOrder[b.position] || 5));
                
                // Add Generic Opposition Player
                mappedPlayers.push({
                    id: "opposition",
                    firstName: "Opposition",
                    lastName: "Player",
                    position: "FWD"
                });

                setPlayers(mappedPlayers as Player[]);
            }
        } catch (e: any) {
            console.error("Fetch error:", e.message || e);
        }
    }

    async function loadMatchAnalysis(matchId: string) {
        try {
            const { data, error } = await supabase
                .from("watcher_stats")
                .select("stats")
                .eq("match_id", matchId)
                .maybeSingle();

            if (error) throw error;

            if (data?.stats) {
                const loaded = data.stats as MatchAnalysis;
                if (!loaded.dominance) loaded.dominance = defaultDominance;
                setAnalysis(loaded);
            } else {
                setAnalysis({ goals: [], assists: [], shots: [], dominance: defaultDominance });
            }
        } catch (e: any) {
            console.error("Error loading analysis:", e.message || e);
            setAnalysis({ goals: [], assists: [], shots: [], dominance: defaultDominance });
        }
    }

    const saveAnalysis = async () => {
        if (!selectedMatchId) return;
        setIsSaving(true);
        try {
            // Check if exists
            const { data: existing } = await supabase.from("watcher_stats").select("id").eq("match_id", selectedMatchId).maybeSingle();

            if (existing) {
                await supabase.from("watcher_stats").update({ stats: analysis }).eq("id", existing.id);
            } else {
                await supabase.from("watcher_stats").insert([{ match_id: selectedMatchId, stats: analysis }]);
            }

            // Automatically sync the goalscorers and assists to the Fixtures page!
            const goalscorersText = analysis.goals.map(g => `${getPlayerName(g.playerId)}${g.count > 1 ? ` (${g.count})` : ''}`).join(', ');
            const assistsText = analysis.assists.map(a => `${getPlayerName(a.playerId)}${a.count > 1 ? ` (${a.count})` : ''}`).join(', ');
            
            await supabase.from("matches").update({
                goalscorers: goalscorersText,
                assists: assistsText
            }).eq("id", selectedMatchId);

            alert("Analysis saved successfully! The Fixtures page has been updated with the goalscorers.");
        } catch (e: any) {
            alert("Error saving: " + (e.message || e));
        }
        setIsSaving(false);
    };

    const handlePitchClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!pitchRef.current || !selectedMatchId) return;
        const rect = pitchRef.current.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        setPendingShot({ x, y });
        if (y > 50) {
            setShotForm({ playerId: "opposition", outcome: "Missed", minute: "" });
        } else {
            setShotForm({ playerId: "", outcome: "Missed", minute: "" });
        }
        setIsShotDialogOpen(true);
    };

    const confirmShot = () => {
        if (!pendingShot || !shotForm.playerId) return;
        
        const newShot: Shot = {
            id: Math.random().toString(),
            playerId: shotForm.playerId,
            x: pendingShot.x,
            y: pendingShot.y,
            outcome: shotForm.outcome,
            minute: shotForm.minute ? parseInt(shotForm.minute) : undefined,
            buildUp: shotForm.buildUp,
            quality: shotForm.quality,
            isDelivery: shotForm.isDelivery
        };

        setAnalysis(prev => {
            const newState = { ...prev, shots: [...prev.shots, newShot] };
            
            // Auto-sync shot to db for real-time Stats map updates
            if (selectedMatchId) {
                supabase.from("watcher_stats").select("id").eq("match_id", selectedMatchId).maybeSingle().then(({ data }) => {
                    if (data) supabase.from("watcher_stats").update({ stats: newState }).eq("id", data.id).then();
                });
            }
            
            return newState;
        });
        
        setIsShotDialogOpen(false);
        setPendingShot(null);
    };

    const deleteShot = (shotId: string) => {
        setAnalysis(prev => {
            const newShots = prev.shots.filter(s => s.id !== shotId);
            const newState = { ...prev, shots: newShots };
            
            // Auto-sync deletion to db for real-time Stats map updates
            if (selectedMatchId) {
                supabase.from("watcher_stats").select("id").eq("match_id", selectedMatchId).maybeSingle().then(({ data }) => {
                    if (data) supabase.from("watcher_stats").update({ stats: newState }).eq("id", data.id).then();
                });
            }
            
            return newState;
        });
    };

    const getShotColor = (outcome: ShotOutcome) => {
        switch (outcome) {
            case "Goal": return "bg-green-500 border-white";
            case "Saved": return "bg-amber-500 border-white";
            case "Blocked": return "bg-slate-500 border-white";
            case "Missed": return "bg-red-500 border-white";
            default: return "bg-white";
        }
    };

    const getPlayerName = (id: string) => {
        const p = players.find(p => p.id === id);
        return p ? `${p.firstName} ${p.lastName}` : "Unknown Player";
    };

    const addGoalStat = (playerId: string) => {
        if (!playerId) return;
        setAnalysis(prev => {
            const existing = prev.goals.find(g => g.playerId === playerId);
            if (existing) {
                return { ...prev, goals: prev.goals.map(g => g.playerId === playerId ? { ...g, count: g.count + 1 } : g) };
            }
            return { ...prev, goals: [...prev.goals, { playerId, count: 1 }] };
        });
    };

    const addAssistStat = (playerId: string) => {
        if (!playerId) return;
        setAnalysis(prev => {
            const existing = prev.assists.find(g => g.playerId === playerId);
            if (existing) {
                return { ...prev, assists: prev.assists.map(g => g.playerId === playerId ? { ...g, count: g.count + 1 } : g) };
            }
            return { ...prev, assists: [...prev.assists, { playerId, count: 1 }] };
        });
    };

    const updateDominance = (team: "us" | "opposition", key: keyof DominanceStats, change: number) => {
        setAnalysis(prev => {
            const newDominance = { 
                us: { ...prev.dominance.us },
                opposition: { ...prev.dominance.opposition }
            };
            const current = newDominance[team][key] || 0;
            newDominance[team][key] = Math.max(0, current + change);
            return { ...prev, dominance: newDominance };
        });
    };
    const handleResetAllMetrics = () => {
        if (!confirm("Are you sure you want to reset all dominance tracker metrics for both teams?")) return;
        setAnalysis(prev => ({
            ...prev,
            dominance: {
                us: { deliveries: 0, halfChances: 0, chances: 0, ooohs: 0, goals: 0 },
                opposition: { deliveries: 0, halfChances: 0, chances: 0, ooohs: 0, goals: 0 }
            }
        }));
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-slate-900">Match Analysis</h2>
                    <p className="text-slate-500">Log deep insights, shot maps, goals, and assists for every fixture.</p>
                </div>
                <div className="flex gap-2">
                    <Link href="/opposition">
                        <Button variant="outline" className="bg-slate-50">
                            <ShieldHalf className="h-4 w-4 mr-2" /> Opposition Reports
                        </Button>
                    </Link>
                </div>
            </div>

            <Card className="border-slate-200 shadow-sm">
                <CardContent className="pt-6">
                    <div className="flex flex-col md:flex-row gap-4 items-end">
                        <div className="flex-1 space-y-2 w-full">
                            <Label>Select Match to Analyze</Label>
                            <Select value={selectedMatchId} onValueChange={setSelectedMatchId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Choose a fixture...">
                                        {selectedMatchId && matches.find(m => m.id === selectedMatchId) 
                                            ? (() => {
                                                const m = matches.find(mat => mat.id === selectedMatchId)!;
                                                return `${new Date(m.date).toLocaleDateString()} - ${m.isHome ? "vs" : "@"} ${m.opponent} ${m.scoreline ? `(${m.scoreline})` : ""}`;
                                              })()
                                            : null}
                                    </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                    {matches.map(m => (
                                        <SelectItem key={m.id} value={m.id}>
                                            {`${new Date(m.date).toLocaleDateString()} - ${m.isHome ? "vs" : "@"} ${m.opponent} ${m.scoreline ? `(${m.scoreline})` : ""}`}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        {selectedMatchId && (
                            <Button onClick={saveAnalysis} disabled={isSaving} className="bg-indigo-600 hover:bg-indigo-700 text-white w-full md:w-auto">
                                {isSaving ? "Saving..." : "Save Analysis Data"}
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>

            {selectedMatchId && (
                <Tabs defaultValue="analysis" className="space-y-6 animate-in fade-in duration-300">
                    <TabsList className="bg-slate-100 p-1 rounded-xl w-full sm:w-auto flex border border-slate-200">
                        <TabsTrigger value="analysis" className="rounded-lg px-4 py-2 font-semibold flex items-center justify-center gap-2">
                            <Activity className="h-4 w-4" /> Match Analysis & Shot Map
                        </TabsTrigger>
                        <TabsTrigger value="squad-stats" className="rounded-lg px-4 py-2 font-semibold flex items-center justify-center gap-2">
                            <BarChart className="h-4 w-4" /> Squad Player Stats
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="analysis" className="space-y-6 mt-0">
                        {/* Match Dominance Tracking */}
                        <Card>
                            <CardHeader className="bg-indigo-50/50 border-b py-4 flex flex-row items-center justify-between">
                                <CardTitle className="text-base flex items-center gap-2 text-indigo-900">
                                    <Activity className="h-4 w-4" /> Match Dominance Tracker
                                </CardTitle>
                                <Button 
                                    onClick={handleResetAllMetrics}
                                    variant="outline"
                                    size="sm"
                                    className="h-8 border-indigo-200 hover:bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center gap-1 rounded-lg px-3"
                                >
                                    <RotateCcw className="h-3.5 w-3.5" /> Reset All Metrics
                                </Button>
                            </CardHeader>
                            <CardContent className="pt-6">
                                {(() => {
                                    const usPoints = calculateDominancePoints(analysis.dominance?.us);
                                    const oppPoints = calculateDominancePoints(analysis.dominance?.opposition);
                                    const totalPoints = usPoints + oppPoints;
                                    const usPercent = totalPoints > 0 ? (usPoints / totalPoints) * 100 : 50;
                                    const oppPercent = totalPoints > 0 ? (oppPoints / totalPoints) * 100 : 50;
                                    return (
                                        <div className="mb-6 bg-slate-50 p-4 rounded-xl border border-slate-100 max-w-2xl mx-auto">
                                            <div className="flex justify-between items-center mb-2">
                                                <div className="text-left">
                                                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">{settings.name}</span>
                                                    <div className="text-xl font-black text-slate-900">{usPoints} <span className="text-xs font-normal text-slate-500">pts</span></div>
                                                </div>
                                                <div className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full uppercase tracking-wider">
                                                    Dominance Score
                                                </div>
                                                <div className="text-right">
                                                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Opposition</span>
                                                    <div className="text-xl font-black text-rose-700">{oppPoints} <span className="text-xs font-normal text-slate-500">pts</span></div>
                                                </div>
                                            </div>
                                            
                                            {/* Comparative Progress Bar */}
                                            <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden flex">
                                                <div className="bg-indigo-600 transition-all duration-500" style={{ width: `${usPercent}%` }}></div>
                                                <div className="bg-rose-500 transition-all duration-500" style={{ width: `${oppPercent}%` }}></div>
                                            </div>
                                            
                                            {/* Points Key */}
                                            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 justify-center text-[10px] text-slate-500 border-t border-slate-200/60 pt-2.5">
                                                <span className="flex items-center gap-1 font-medium"><span className="text-indigo-600 font-bold">Goal</span> 10 pts</span>
                                                <span className="flex items-center gap-1 font-medium"><span className="text-indigo-600 font-bold">Massive Chance</span> 5 pts</span>
                                                <span className="flex items-center gap-1 font-medium"><span className="text-indigo-600 font-bold">Chance</span> 3 pts</span>
                                                <span className="flex items-center gap-1 font-medium"><span className="text-indigo-600 font-bold">Half Chance</span> 2 pts</span>
                                                <span className="flex items-center gap-1 font-medium"><span className="text-indigo-600 font-bold">Delivery</span> 1 pt</span>
                                            </div>
                                        </div>
                                    );
                                })()}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-center">
                                    {/* Camden United */}
                                    <div>
                                        <h3 className="font-bold text-lg text-slate-800 mb-4">{settings.name}</h3>
                                        <div className="space-y-3">
                                            {["deliveries", "halfChances", "chances", "ooohs", "goals"].map((key) => (
                                                <div key={key} className="flex items-center justify-between bg-slate-50 p-2 rounded">
                                                    <span className="capitalize text-sm font-medium text-slate-700">{key === "ooohs" ? "Massive Chances" : key.replace(/([A-Z])/g, ' $1').trim()}</span>
                                                    <div className="flex items-center gap-2">
                                                        <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => updateDominance("us", key as any, -1)}>-</Button>
                                                        <span className="w-6 font-bold text-slate-900 text-lg">{analysis.dominance?.us[key as keyof DominanceStats] || 0}</span>
                                                        <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => updateDominance("us", key as any, 1)}>+</Button>
                                                        <Button 
                                                            size="sm" 
                                                            variant="ghost" 
                                                            className="h-7 w-7 p-0 text-slate-400 hover:text-red-500 hover:bg-red-50"
                                                            onClick={() => {
                                                                setAnalysis(prev => {
                                                                    const newDominance = { 
                                                                        us: { ...prev.dominance.us },
                                                                        opposition: { ...prev.dominance.opposition }
                                                                    };
                                                                    newDominance.us[key as keyof DominanceStats] = 0;
                                                                    return { ...prev, dominance: newDominance };
                                                                });
                                                            }}
                                                            title="Reset metric"
                                                        >
                                                            <RotateCcw className="h-3 w-3" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    {/* Opposition */}
                                    <div>
                                        <h3 className="font-bold text-lg text-rose-800 mb-4">Opposition</h3>
                                        <div className="space-y-3">
                                            {["deliveries", "halfChances", "chances", "ooohs", "goals"].map((key) => (
                                                <div key={key} className="flex items-center justify-between bg-rose-50 p-2 rounded border border-rose-100">
                                                    <span className="capitalize text-sm font-medium text-rose-800">{key === "ooohs" ? "Massive Chances" : key.replace(/([A-Z])/g, ' $1').trim()}</span>
                                                    <div className="flex items-center gap-2">
                                                        <Button size="sm" variant="outline" className="h-7 w-7 p-0 border-rose-200 text-rose-700" onClick={() => updateDominance("opposition", key as any, -1)}>-</Button>
                                                        <span className="w-6 font-bold text-rose-900 text-lg">{analysis.dominance?.opposition[key as keyof DominanceStats] || 0}</span>
                                                        <Button size="sm" variant="outline" className="h-7 w-7 p-0 border-rose-200 text-rose-700" onClick={() => updateDominance("opposition", key as any, 1)}>+</Button>
                                                        <Button 
                                                            size="sm" 
                                                            variant="ghost" 
                                                            className="h-7 w-7 p-0 text-rose-400 hover:text-red-500 hover:bg-rose-50"
                                                            onClick={() => {
                                                                setAnalysis(prev => {
                                                                    const newDominance = { 
                                                                        us: { ...prev.dominance.us },
                                                                        opposition: { ...prev.dominance.opposition }
                                                                    };
                                                                    newDominance.opposition[key as keyof DominanceStats] = 0;
                                                                    return { ...prev, dominance: newDominance };
                                                                });
                                                            }}
                                                            title="Reset metric"
                                                        >
                                                            <RotateCcw className="h-3 w-3" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            
                            {/* Left Column: Goals & Assists */}
                            <div className="space-y-6 lg:col-span-1">
                            <Card>
                                <CardHeader className="bg-slate-50 border-b py-4">
                                    <CardTitle className="text-base flex items-center gap-2">
                                        <Activity className="h-4 w-4 text-green-600" /> Goals Log
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="pt-4 space-y-4">
                                    <div className="flex flex-col sm:flex-row gap-2">
                                        <Select value={goalPlayerId} onValueChange={setGoalPlayerId}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Add Goalscorer...">
                                                    {goalPlayerId && getPlayerName(goalPlayerId)}
                                                </SelectValue>
                                            </SelectTrigger>
                                            <SelectContent>
                                                {players.map(p => (
                                                    <SelectItem key={p.id} value={p.id}>{p.firstName} {p.lastName}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <Button size="sm" onClick={() => addGoalStat(goalPlayerId)}><Plus className="h-4 w-4"/></Button>
                                    </div>
                                    <div className="space-y-2">
                                        {analysis.goals.map(g => (
                                            <div key={g.playerId} className="flex items-center justify-between p-2 bg-slate-50 rounded border">
                                                <span className="text-sm font-medium text-slate-700">{getPlayerName(g.playerId)}</span>
                                                <div className="flex items-center gap-3">
                                                    <span className="text-xs font-bold bg-green-100 text-green-800 px-2 py-0.5 rounded-full">{g.count}</span>
                                                    <button onClick={() => setAnalysis(prev => ({ ...prev, goals: prev.goals.filter(x => x.playerId !== g.playerId) }))} className="text-slate-400 hover:text-red-500">
                                                        <Trash2 className="h-3 w-3" />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                        {analysis.goals.length === 0 && <p className="text-xs text-slate-400 text-center py-2">No goals logged.</p>}
                                    </div>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader className="bg-slate-50 border-b py-4">
                                    <CardTitle className="text-base flex items-center gap-2">
                                        <span>🅰️</span> Assists Log
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="pt-4 space-y-4">
                                    <div className="flex flex-col sm:flex-row gap-2">
                                        <Select value={assistPlayerId} onValueChange={setAssistPlayerId}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Add Assist...">
                                                    {assistPlayerId && getPlayerName(assistPlayerId)}
                                                </SelectValue>
                                            </SelectTrigger>
                                            <SelectContent>
                                                {players.map(p => (
                                                    <SelectItem key={p.id} value={p.id}>{p.firstName} {p.lastName}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <Button size="sm" onClick={() => addAssistStat(assistPlayerId)}><Plus className="h-4 w-4"/></Button>
                                    </div>
                                    <div className="space-y-2">
                                        {analysis.assists.map(a => (
                                            <div key={a.playerId} className="flex items-center justify-between p-2 bg-slate-50 rounded border">
                                                <span className="text-sm font-medium text-slate-700">{getPlayerName(a.playerId)}</span>
                                                <div className="flex items-center gap-3">
                                                    <span className="text-xs font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">{a.count}</span>
                                                    <button onClick={() => setAnalysis(prev => ({ ...prev, assists: prev.assists.filter(x => x.playerId !== a.playerId) }))} className="text-slate-400 hover:text-red-500">
                                                        <Trash2 className="h-3 w-3" />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                        {analysis.assists.length === 0 && <p className="text-xs text-slate-400 text-center py-2">No assists logged.</p>}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Right Column: Shot Map */}
                        <div className="lg:col-span-2 space-y-4">
                            <Card className="overflow-hidden">
                                <CardHeader className="bg-slate-50 border-b py-4 flex flex-row items-center justify-between">
                                    <div>
                                        <CardTitle className="text-base flex items-center gap-2">
                                            <Target className="h-4 w-4 text-indigo-600" /> Shot Location Map
                                        </CardTitle>
                                        <p className="text-xs text-slate-500 mt-1">Click anywhere on the pitch to log a shot.</p>
                                    </div>
                                    <div className="flex gap-3 text-[10px] font-medium uppercase">
                                        <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-green-500"></div>Goal</div>
                                        <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-amber-500"></div>Saved</div>
                                        <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-500"></div>Missed</div>
                                        <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-slate-500"></div>Blocked</div>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-4 bg-slate-100 flex justify-center">
                                    {/* Interactive Pitch */}
                                    <div 
                                        ref={pitchRef}
                                        onClick={handlePitchClick}
                                        onMouseMove={(e) => {
                                            const rect = pitchRef.current?.getBoundingClientRect();
                                            if (rect && reticleRef.current) {
                                                const x = ((e.clientX - rect.left) / rect.width) * 100;
                                                const y = ((e.clientY - rect.top) / rect.height) * 100;
                                                reticleRef.current.style.display = "flex";
                                                reticleRef.current.style.left = `${x}%`;
                                                reticleRef.current.style.top = `${y}%`;
                                            }
                                        }}
                                        onMouseLeave={() => {
                                            if (reticleRef.current) {
                                                reticleRef.current.style.display = "none";
                                            }
                                        }}
                                        className="relative w-full max-w-md aspect-[2/3] bg-emerald-600 rounded cursor-crosshair border-4 border-emerald-700 shadow-inner overflow-hidden"
                                        style={{
                                            backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 10%, rgba(255,255,255,0.05) 10%, rgba(255,255,255,0.05) 20%)"
                                        }}
                                    >
                                        {/* Pinpoint hover indicator */}
                                        <div 
                                            ref={reticleRef}
                                            className="absolute w-3 h-3 -ml-1.5 -mt-1.5 rounded-full bg-red-500 border border-white shadow pointer-events-none z-20 animate-pulse"
                                            style={{ display: "none", left: "0%", top: "0%" }}
                                        />

                                        {/* Pitch Markings */}
                                        <div className="absolute inset-0 border-2 border-white/50 m-2"></div>
                                        {/* Center line */}
                                        <div className="absolute top-1/2 left-2 right-2 h-px bg-white/50"></div>
                                        {/* Center circle */}
                                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 rounded-full border-2 border-white/50"></div>
                                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-white/50"></div>
                                        
                                        {/* Penalty Areas */}
                                        <div className="absolute top-2 left-1/2 -translate-x-1/2 w-1/2 h-1/6 border-2 border-white/50 border-t-0"></div>
                                        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-1/2 h-1/6 border-2 border-white/50 border-b-0"></div>
                                        
                                        {/* Goal Areas */}
                                        <div className="absolute top-2 left-1/2 -translate-x-1/2 w-1/4 h-[8%] border-2 border-white/50 border-t-0"></div>
                                        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-1/4 h-[8%] border-2 border-white/50 border-b-0"></div>
                                        
                                        {/* Penalty Spots */}
                                        <div className="absolute top-[12%] left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-white/70"></div>
                                        <div className="absolute bottom-[12%] left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-white/70"></div>
                                        
                                        {/* Goals */}
                                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/6 h-2 border-2 border-white/70 border-t-0 bg-emerald-600/50"></div>
                                        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1/6 h-2 border-2 border-white/70 border-b-0 bg-emerald-600/50"></div>

                                        {/* Direction indicator */}
                                        <div className="absolute left-1/2 top-1/4 -translate-x-1/2 text-white/20 font-black text-4xl pointer-events-none rotate-180">ATTACKING</div>
                                        <div className="absolute left-1/2 bottom-1/4 -translate-x-1/2 text-white/20 font-black text-4xl pointer-events-none">DEFENDING</div>

                                        {/* Shots rendered */}
                                        {analysis.shots.map((shot) => (
                                            <div 
                                                key={shot.id}
                                                className={`absolute w-4 h-4 -ml-2 -mt-2 rounded-full border-2 shadow-sm flex items-center justify-center group ${getShotColor(shot.outcome)}`}
                                                style={{ left: `${shot.x}%`, top: `${shot.y}%` }}
                                            >
                                                <div className="hidden group-hover:block absolute bottom-full mb-1 bg-slate-900 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap z-10 pointer-events-none">
                                                    {getPlayerName(shot.playerId)} - {shot.outcome} {shot.minute ? `(${shot.minute}')` : ''}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>

                            <div className="bg-white p-4 rounded-lg border shadow-sm flex flex-col gap-2">
                                <h4 className="text-sm font-semibold text-slate-800">Shot List</h4>
                                {analysis.shots.length === 0 ? (
                                    <p className="text-xs text-slate-500">No shots recorded yet.</p>
                                ) : (
                                    <div className="max-h-40 overflow-y-auto space-y-1">
                                        {analysis.shots.map((shot, i) => (
                                            <div key={shot.id} className="flex items-center justify-between text-xs py-1.5 px-2 bg-slate-50 hover:bg-slate-100 rounded">
                                                <div className="flex items-center gap-2">
                                                    <div className={`w-2 h-2 rounded-full ${getShotColor(shot.outcome)}`}></div>
                                                    <span className="font-medium text-slate-700">{getPlayerName(shot.playerId)}</span>
                                                    <span className="text-slate-500">{shot.outcome} {shot.minute ? `(${shot.minute}')` : ''}</span>
                                                    {shot.quality && <span className="text-[10px] bg-slate-200 px-1 rounded text-slate-600">{shot.quality}</span>}
                                                    {shot.buildUp && <span className="text-[10px] bg-indigo-100 text-indigo-700 px-1 rounded">{shot.buildUp}</span>}
                                                    {shot.isDelivery && <span className="text-[10px] bg-blue-100 text-blue-700 px-1 rounded">Delivery</span>}
                                                </div>
                                                <button onClick={() => deleteShot(shot.id)} className="text-slate-400 hover:text-red-500">
                                                    <Trash2 className="h-3 w-3" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                            </div>
                        </div>
                    </TabsContent>

                    <TabsContent value="squad-stats" className="mt-0">
                        {selectedMatchId && matches.find(m => m.id === selectedMatchId) ? (
                            <MatchStatsDialog 
                                matchId={selectedMatchId} 
                                matchDate={matches.find(m => m.id === selectedMatchId)!.date} 
                                opponent={matches.find(m => m.id === selectedMatchId)!.opponent} 
                                variant="inline" 
                            />
                        ) : (
                            <div className="p-8 text-center text-slate-400 bg-white border border-dashed rounded-lg">
                                Select a fixture first.
                            </div>
                        )}
                    </TabsContent>
                </Tabs>
            )}

            <Dialog open={isShotDialogOpen} onOpenChange={setIsShotDialogOpen}>
                <DialogContent className="sm:max-w-[400px]">
                    <DialogHeader>
                        <DialogTitle>Log Shot</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        {pendingShot && pendingShot.y > 50 ? (
                            <div className="space-y-2">
                                <Label>Player</Label>
                                <Input disabled value="Opposition Player" className="bg-slate-50 cursor-not-allowed" />
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <Label>Player</Label>
                                <Select value={shotForm.playerId} onValueChange={(v) => setShotForm({ ...shotForm, playerId: v })}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Who took the shot?">
                                            {shotForm.playerId && getPlayerName(shotForm.playerId)}
                                        </SelectValue>
                                    </SelectTrigger>
                                    <SelectContent>
                                        {players.filter(p => p.id !== "opposition").map(p => (
                                            <SelectItem key={p.id} value={p.id}>{p.firstName} {p.lastName}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                        <div className="space-y-2">
                            <Label>Outcome</Label>
                            <Select value={shotForm.outcome} onValueChange={(v) => setShotForm({ ...shotForm, outcome: v as ShotOutcome })}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Goal">Goal</SelectItem>
                                    <SelectItem value="Saved">Saved</SelectItem>
                                    <SelectItem value="Blocked">Blocked</SelectItem>
                                    <SelectItem value="Missed">Missed</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Minute (Optional)</Label>
                            <Input type="number" min="1" max="120" placeholder="e.g. 45" value={shotForm.minute} onChange={(e) => setShotForm({ ...shotForm, minute: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                            <Label>Build-Up Type</Label>
                            <Select value={shotForm.buildUp || ""} onValueChange={(v) => setShotForm({ ...shotForm, buildUp: v as BuildUpType })}>
                                <SelectTrigger>
                                    <SelectValue placeholder="How did the chance start?" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Attacking Transition">Attacking Transition</SelectItem>
                                    <SelectItem value="Defensive Transition">Defensive Transition</SelectItem>
                                    <SelectItem value="Settled Possession">Settled Possession</SelectItem>
                                    <SelectItem value="Set Piece">Set Piece</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Chance Quality</Label>
                            <Select value={shotForm.quality || ""} onValueChange={(v) => setShotForm({ ...shotForm, quality: v as ChanceQuality })}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Rate the chance" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Delivery">Delivery</SelectItem>
                                    <SelectItem value="1/2 Chance">1/2 Chance</SelectItem>
                                    <SelectItem value="Chance">Chance</SelectItem>
                                    <SelectItem value="Massive Chance">Massive Chance</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex items-center space-x-2 mt-2">
                            <input 
                                type="checkbox" 
                                id="isDelivery" 
                                checked={shotForm.isDelivery || false} 
                                onChange={(e) => setShotForm({ ...shotForm, isDelivery: e.target.checked })}
                                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                            />
                            <Label htmlFor="isDelivery" className="font-normal cursor-pointer">Resulted from a delivery into the box</Label>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsShotDialogOpen(false)}>Cancel</Button>
                        <Button onClick={confirmShot} disabled={!shotForm.playerId} className="bg-indigo-600 hover:bg-indigo-700">Add Shot</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
