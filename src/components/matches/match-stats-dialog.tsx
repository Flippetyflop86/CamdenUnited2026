"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, Plus, Minus, Search, Trash2, Filter, RefreshCw, Link as LinkIcon } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useClub } from "@/context/club-context";

interface MatchPlayerStat {
    id: string;
    player_id: string;
    goals: number;
    assists: number;
    yellow_cards: number;
    red_cards: number;
    minutes_played: number;
}

export function MatchStatsDialog({ matchId, matchDate, opponent, variant = 'icon' }: { matchId: string, matchDate: string, opponent: string, variant?: 'icon' | 'full' | 'inline' }) {
    const [isOpen, setIsOpen] = useState(false);
    const [players, setPlayers] = useState<any[]>([]);
    const [stats, setStats] = useState<MatchPlayerStat[]>([]);
    const [search, setSearch] = useState("");
    const [squadFilter, setSquadFilter] = useState("All");
    const [isLoading, setIsLoading] = useState(false);
    
    // Auto-Fetch State
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncUrl, setSyncUrl] = useState("");
    const [showSyncInput, setShowSyncInput] = useState(false);

    const { settings } = useClub();
    const currentSquads = settings.squads || ["First Team"];

    useEffect(() => {
        if (isOpen || variant === 'inline') {
            fetchData();
        }
    }, [isOpen, matchId, variant]);

    const fetchData = async () => {
        setIsLoading(true);
        // Fetch all players
        const { data: pData } = await supabase.from('players').select('id, first_name, last_name, position, squad').order('last_name');
        if (pData) setPlayers(pData);

        // Fetch existing stats for this match
        const { data: sData } = await supabase.from('match_player_stats').select('*').eq('match_id', matchId);
        if (sData) setStats(sData);
        setIsLoading(false);
    };

    const addPlayerToMatch = async (playerId: string) => {
        if (stats.find(s => s.player_id === playerId)) return;
        
        // Optimistic insert
        const newStat = { match_id: matchId, player_id: playerId, goals: 0, assists: 0, yellow_cards: 0, red_cards: 0, minutes_played: 90 };
        const { data, error } = await supabase.from('match_player_stats').insert([newStat]).select().single();
        
        if (error) {
            alert("Error adding player: " + error.message);
        } else if (data) {
            setStats(prev => [...prev, data]);
        }
    };

    const updateStat = async (statId: string, field: string, increment: number) => {
        const stat = stats.find(s => s.id === statId);
        if (!stat) return;
        
        const newValue = Math.max(0, (stat as any)[field] + increment);
        
        // Optimistic UI
        setStats(prev => prev.map(s => s.id === statId ? { ...s, [field]: newValue } : s));

        const { error } = await supabase.from('match_player_stats').update({ [field]: newValue }).eq('id', statId);
        if (error) {
            alert("Error updating stat: " + error.message);
            fetchData(); // Revert
        }
    };

    const removePlayerFromMatch = async (statId: string) => {
        if (!confirm("Remove this player from the match stats?")) return;
        
        setStats(prev => prev.filter(s => s.id !== statId));
        
        const { error } = await supabase.from('match_player_stats').delete().eq('id', statId);
        if (error) {
            alert("Error removing player: " + error.message);
            fetchData();
        }
    };

    const handleAutoSync = async () => {
        if (!syncUrl.trim()) return;
        setIsSyncing(true);
        try {
            const res = await fetch('/api/sync-match-stats', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: syncUrl, matchId, clubName: "Camden United" }) // You can pass settings.clubName here too
            });
            const data = await res.json();
            
            if (!res.ok || !data.success) {
                alert(data.error || "Failed to auto-sync match stats.");
                setIsSyncing(false);
                return;
            }

            if (data.stats && data.stats.length > 0) {
                // Delete existing stats to prevent duplicates? Or just insert new ones?
                // For safety, let's insert and ignore duplicates if they exist, or just insert all
                const { error } = await supabase.from('match_player_stats').insert(data.stats);
                if (error) alert("Error saving synced stats: " + error.message);
                else {
                    alert(`Successfully synced ${data.stats.length} players from the link!`);
                    setShowSyncInput(false);
                    fetchData();
                }
            } else {
                alert("No players matched from the page. Ensure the URL is a Match Details page with lineups/goalscorers.");
            }
        } catch (error: any) {
            alert("Sync error: " + error.message);
        } finally {
            setIsSyncing(false);
        }
    };

    const positionOrder: Record<string, number> = {
        'GK': 1, 'RB': 2, 'CB': 3, 'LB': 4, 'RWB': 5, 'LWB': 6, 'DEF': 7,
        'CDM': 8, 'CM': 9, 'CAM': 10, 'RM': 11, 'LM': 12, 'MID': 13,
        'RW': 14, 'LW': 15, 'CF': 16, 'ST': 17, 'FWD': 18
    };

    const SQUAD_LABELS: Record<string, string> = { firstTeam: "First Team", midweek: "Midweek", youth: "Youth" };

    const availablePlayers = players
        .filter(p => !stats.find(s => s.player_id === p.id))
        .filter(p => search === "" || `${p.first_name} ${p.last_name}`.toLowerCase().includes(search.toLowerCase()))
        .filter(p => {
            const mappedSquad = SQUAD_LABELS[p.squad] || p.squad;
            return squadFilter === "All" || mappedSquad === squadFilter;
        })
        .sort((a, b) => {
            const orderA = positionOrder[a.position] || 99;
            const orderB = positionOrder[b.position] || 99;
            if (orderA !== orderB) return orderA - orderB;
            return a.last_name.localeCompare(b.last_name);
        });

    if (variant === 'inline') {
        return (
            <Card className="border-slate-200 shadow-sm overflow-hidden flex flex-col bg-slate-50">
                <CardHeader className="shrink-0 pb-4 border-b bg-white">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                            <CardTitle className="text-xl font-bold">Squad Player Stats</CardTitle>
                            <p className="text-sm text-slate-500">
                                {new Date(matchDate).toLocaleDateString()} vs {opponent}
                            </p>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                            {showSyncInput ? (
                                <div className="flex items-center gap-2">
                                    <Input 
                                        placeholder="Paste Match URL..." 
                                        value={syncUrl}
                                        onChange={(e) => setSyncUrl(e.target.value)}
                                        className="h-8 text-xs w-64 bg-white"
                                    />
                                    <Button size="sm" onClick={handleAutoSync} disabled={isSyncing} className="h-8 bg-indigo-600 hover:bg-indigo-700">
                                        {isSyncing ? <RefreshCw className="h-3 w-3 animate-spin mr-1" /> : <RefreshCw className="h-3 w-3 mr-1" />}
                                        Fetch
                                    </Button>
                                    <Button size="sm" variant="ghost" onClick={() => setShowSyncInput(false)} className="h-8 px-2 text-slate-400">Cancel</Button>
                                </div>
                            ) : (
                                <Button size="sm" variant="outline" onClick={() => setShowSyncInput(true)} className="h-8 text-xs bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100">
                                    <LinkIcon className="h-3 w-3 mr-1.5" /> Auto-Fetch from URL
                                </Button>
                            )}
                        </div>
                    </div>
                </CardHeader>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 min-h-[450px]">
                    {/* Left: Players in Match */}
                    <div className="flex flex-col h-[400px] overflow-hidden bg-white border rounded-lg shadow-sm">
                        <div className="p-3 bg-slate-900 text-white font-bold text-sm sticky top-0 z-10 flex justify-between items-center">
                            <span>Players Logged ({stats.length})</span>
                            <span className="text-xs font-normal text-slate-400">All get +1 App</span>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 space-y-2">
                            {stats.length === 0 ? (
                                <div className="text-center p-6 text-slate-400 text-sm">
                                    No players logged yet.<br/>Select from the right panel.
                                </div>
                            ) : (
                                stats.map(stat => {
                                    const p = players.find(x => x.id === stat.player_id);
                                    if (!p) return null;
                                    return (
                                        <div key={stat.id} className="bg-slate-50 border rounded-lg p-2 text-sm flex flex-col gap-2">
                                            <div className="flex justify-between items-center border-b pb-2">
                                                <span className="font-bold">{p.first_name} {p.last_name}</span>
                                                <button onClick={() => removePlayerFromMatch(stat.id)} className="text-slate-400 hover:text-red-500 transition-colors">
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <div className="flex items-center gap-2">
                                                    <span className="w-12 text-xs text-slate-500 font-medium">Goals</span>
                                                    <div className="flex items-center bg-white border rounded-full overflow-hidden">
                                                        <button onClick={() => updateStat(stat.id, 'goals', -1)} className="px-2 py-1 hover:bg-slate-100"><Minus className="h-3 w-3" /></button>
                                                        <span className="w-6 text-center font-bold text-emerald-600">{stat.goals}</span>
                                                        <button onClick={() => updateStat(stat.id, 'goals', 1)} className="px-2 py-1 hover:bg-slate-100"><Plus className="h-3 w-3" /></button>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="w-12 text-xs text-slate-500 font-medium">Assists</span>
                                                    <div className="flex items-center bg-white border rounded-full overflow-hidden">
                                                        <button onClick={() => updateStat(stat.id, 'assists', -1)} className="px-2 py-1 hover:bg-slate-100"><Minus className="h-3 w-3" /></button>
                                                        <span className="w-6 text-center font-bold text-blue-600">{stat.assists}</span>
                                                        <button onClick={() => updateStat(stat.id, 'assists', 1)} className="px-2 py-1 hover:bg-slate-100"><Plus className="h-3 w-3" /></button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>

                    {/* Right: Available Players */}
                    <div className="flex flex-col h-[400px] overflow-hidden bg-white border rounded-lg shadow-sm">
                        <div className="p-3 bg-slate-100 border-b sticky top-0 z-10 space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="font-bold text-sm text-slate-700">Available Squad</span>
                                <select 
                                    className="text-xs bg-white border border-slate-200 rounded px-2 py-1 outline-none"
                                    value={squadFilter}
                                    onChange={(e) => setSquadFilter(e.target.value)}
                                >
                                    <option value="All">All Squads</option>
                                    {currentSquads.map((s: string) => (
                                        <option key={s} value={s}>{s}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="relative">
                                <Search className="absolute left-2 top-2 h-4 w-4 text-slate-400" />
                                <Input 
                                    placeholder="Search player..." 
                                    className="pl-8 h-8 text-sm"
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 space-y-1">
                            {availablePlayers.map(p => (
                                <div key={p.id} className="flex justify-between items-center p-2 hover:bg-slate-50 rounded-lg group transition-colors border border-transparent hover:border-slate-100">
                                    <div>
                                        <span className="font-semibold text-sm">{p.first_name} {p.last_name}</span>
                                        <span className="ml-2 text-xs text-slate-400">{p.position}</span>
                                    </div>
                                    <Button size="sm" variant="outline" className="h-7 bg-white text-emerald-600 border-emerald-200 hover:bg-emerald-50 hover:border-emerald-300 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => addPlayerToMatch(p.id)}>
                                        <Plus className="h-3 w-3 mr-1" /> Add
                                    </Button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </Card>
        );
    }

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                {variant === 'icon' ? (
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-emerald-600">
                        <BarChart3 className="h-4 w-4" />
                    </Button>
                ) : (
                    <Button variant="outline" className={`w-full font-bold ${stats.length > 0 ? "border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100" : "border-red-200 text-red-700 bg-red-50 hover:bg-red-100"}`}>
                        <BarChart3 className="h-4 w-4 mr-2" /> 
                        {stats.length > 0 ? `View Match Stats (${stats.length} players)` : "Log Match Stats"}
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[700px] bg-slate-50 max-h-[90vh] overflow-hidden flex flex-col">
                <DialogHeader className="shrink-0 pb-4 border-b">
                    <div className="flex items-start justify-between pr-8">
                        <div>
                            <DialogTitle className="text-2xl font-bold">Match Stats</DialogTitle>
                            <p className="text-sm text-slate-500">
                                {new Date(matchDate).toLocaleDateString()} vs {opponent}
                            </p>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                            {showSyncInput ? (
                                <div className="flex items-center gap-2">
                                    <Input 
                                        placeholder="Paste Match URL..." 
                                        value={syncUrl}
                                        onChange={(e) => setSyncUrl(e.target.value)}
                                        className="h-8 text-xs w-64 bg-white"
                                    />
                                    <Button size="sm" onClick={handleAutoSync} disabled={isSyncing} className="h-8 bg-indigo-600 hover:bg-indigo-700">
                                        {isSyncing ? <RefreshCw className="h-3 w-3 animate-spin mr-1" /> : <RefreshCw className="h-3 w-3 mr-1" />}
                                        Fetch
                                    </Button>
                                    <Button size="sm" variant="ghost" onClick={() => setShowSyncInput(false)} className="h-8 px-2 text-slate-400">Cancel</Button>
                                </div>
                            ) : (
                                <Button size="sm" variant="outline" onClick={() => setShowSyncInput(true)} className="h-8 text-xs bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100">
                                    <LinkIcon className="h-3 w-3 mr-1.5" /> Auto-Fetch from URL
                                </Button>
                            )}
                        </div>
                    </div>
                </DialogHeader>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1 min-h-0 overflow-hidden">
                    {/* Left: Players in Match */}
                    <div className="flex flex-col h-full overflow-hidden bg-white border rounded-lg shadow-sm">
                        <div className="p-3 bg-slate-900 text-white font-bold text-sm sticky top-0 z-10 flex justify-between items-center">
                            <span>Players Logged ({stats.length})</span>
                            <span className="text-xs font-normal text-slate-400">All get +1 App</span>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 space-y-2">
                            {stats.length === 0 ? (
                                <div className="text-center p-6 text-slate-400 text-sm">
                                    No players logged yet.<br/>Select from the right panel.
                                </div>
                            ) : (
                                stats.map(stat => {
                                    const p = players.find(x => x.id === stat.player_id);
                                    if (!p) return null;
                                    return (
                                        <div key={stat.id} className="bg-slate-50 border rounded-lg p-2 text-sm flex flex-col gap-2">
                                            <div className="flex justify-between items-center border-b pb-2">
                                                <span className="font-bold">{p.first_name} {p.last_name}</span>
                                                <button onClick={() => removePlayerFromMatch(stat.id)} className="text-slate-400 hover:text-red-500 transition-colors">
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <div className="flex items-center gap-2">
                                                    <span className="w-12 text-xs text-slate-500 font-medium">Goals</span>
                                                    <div className="flex items-center bg-white border rounded-full overflow-hidden">
                                                        <button onClick={() => updateStat(stat.id, 'goals', -1)} className="px-2 py-1 hover:bg-slate-100"><Minus className="h-3 w-3" /></button>
                                                        <span className="w-6 text-center font-bold text-emerald-600">{stat.goals}</span>
                                                        <button onClick={() => updateStat(stat.id, 'goals', 1)} className="px-2 py-1 hover:bg-slate-100"><Plus className="h-3 w-3" /></button>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="w-12 text-xs text-slate-500 font-medium">Assists</span>
                                                    <div className="flex items-center bg-white border rounded-full overflow-hidden">
                                                        <button onClick={() => updateStat(stat.id, 'assists', -1)} className="px-2 py-1 hover:bg-slate-100"><Minus className="h-3 w-3" /></button>
                                                        <span className="w-6 text-center font-bold text-blue-600">{stat.assists}</span>
                                                        <button onClick={() => updateStat(stat.id, 'assists', 1)} className="px-2 py-1 hover:bg-slate-100"><Plus className="h-3 w-3" /></button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>

                    {/* Right: Available Players */}
                    <div className="flex flex-col h-full overflow-hidden bg-white border rounded-lg shadow-sm">
                        <div className="p-3 bg-slate-100 border-b sticky top-0 z-10 space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="font-bold text-sm text-slate-700">Available Squad</span>
                                <select 
                                    className="text-xs bg-white border border-slate-200 rounded px-2 py-1 outline-none"
                                    value={squadFilter}
                                    onChange={(e) => setSquadFilter(e.target.value)}
                                >
                                    <option value="All">All Squads</option>
                                    {currentSquads.map((s: string) => (
                                        <option key={s} value={s}>{s}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="relative">
                                <Search className="absolute left-2 top-2 h-4 w-4 text-slate-400" />
                                <Input 
                                    placeholder="Search player..." 
                                    className="pl-8 h-8 text-sm"
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 space-y-1">
                            {availablePlayers.map(p => (
                                <div key={p.id} className="flex justify-between items-center p-2 hover:bg-slate-50 rounded-lg group transition-colors border border-transparent hover:border-slate-100">
                                    <div>
                                        <span className="font-semibold text-sm">{p.first_name} {p.last_name}</span>
                                        <span className="ml-2 text-xs text-slate-400">{p.position}</span>
                                    </div>
                                    <Button size="sm" variant="outline" className="h-7 bg-white text-emerald-600 border-emerald-200 hover:bg-emerald-50 hover:border-emerald-300 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => addPlayerToMatch(p.id)}>
                                        <Plus className="h-3 w-3 mr-1" /> Add
                                    </Button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
