"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Match, Player } from "@/types";
import { Trophy, TrendingUp, TrendingDown, Goal, ShieldAlert, AlertCircle, Target, Clock, Flame, Zap, Activity, Lock } from "lucide-react";
import { useClub } from "@/context/club-context";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";

interface ScorerStats {
    name: string;
    goals: number;
}

interface AssistStats {
    name: string;
    assists: number;
}

interface Shot {
    id: string;
    playerId: string;
    x: number;
    y: number;
    outcome: "Goal" | "Saved" | "Missed" | "Blocked";
    minute?: number;
    matchId?: string;
    buildUp?: string;
    quality?: string;
    isDelivery?: boolean;
}

export default function StatsPage() {
    const { settings } = useClub();
    const [matches, setMatches] = useState<Match[]>([]);
    // Season Filter State
    const getCurrentSeasonStr = () => {
        const d = new Date();
        const year = d.getFullYear();
        const month = d.getMonth();
        return month >= 5 
            ? `${year.toString().slice(2)}/${(year + 1).toString().slice(2)}`
            : `${(year - 1).toString().slice(2)}/${year.toString().slice(2)}`;
    };

    const getNextSeasonStr = () => {
        const d = new Date();
        const year = d.getFullYear();
        const month = d.getMonth();
        return month >= 5
            ? `${(year + 1).toString().slice(2)}/${(year + 2).toString().slice(2)}`
            : `${year.toString().slice(2)}/${(year + 1).toString().slice(2)}`;
    };

    const getSeasonFromDate = (dateString: string) => {
        if (!dateString) return getCurrentSeasonStr();
        const d = new Date(dateString);
        if (isNaN(d.getTime())) return getCurrentSeasonStr();
        const year = d.getFullYear();
        const month = d.getMonth();
        return month >= 5 
            ? `${year.toString().slice(2)}/${(year + 1).toString().slice(2)}`
            : `${(year - 1).toString().slice(2)}/${year.toString().slice(2)}`;
    };

    const [seasonFilter, setSeasonFilter] = useState<string>("All");
    const [matchTypeFilter, setMatchTypeFilter] = useState<"All" | "Competitive" | "Friendly">("All");
    const [uniqueSeasons, setUniqueSeasons] = useState<string[]>([]);
    const [availableSeasons, setAvailableSeasons] = useState<string[]>([]);

    useEffect(() => {
        if (matches.length > 0) {
            const seasons = Array.from(new Set([...matches.map(m => getSeasonFromDate(m.date)), getCurrentSeasonStr(), getNextSeasonStr()])).sort().reverse();
            setAvailableSeasons(seasons);
            setUniqueSeasons(seasons);
        } else {
            setAvailableSeasons([getNextSeasonStr(), getCurrentSeasonStr()]);
            setUniqueSeasons([getNextSeasonStr(), getCurrentSeasonStr()]);
        }
    }, [matches]);

    useEffect(() => {
        fetchData();

        // Setup subscriptions for realtime updates
        const channels = [
            supabase.channel('public:matches').on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, fetchData)
        ];
        channels.forEach(c => c.subscribe());

        return () => { channels.forEach(c => supabase.removeChannel(c)); };
    }, []);

    useEffect(() => {
        if (matches.length > 0) {
            let filteredMatches = seasonFilter === "All" ? matches : matches.filter(m => getSeasonFromDate(m.date) === seasonFilter);
            if (matchTypeFilter !== "All") {
                filteredMatches = filteredMatches.filter(m => {
                    const isFriendly = m.competition === "Friendly" || m.competition === "Pre-Season";
                    return matchTypeFilter === "Friendly" ? isFriendly : !isFriendly;
                });
            }
            calculateMatchStats(filteredMatches);
        } else {
            calculateMatchStats([]);
        }
    }, [matches, seasonFilter, matchTypeFilter]);

    const [winRate, setWinRate] = useState(0);
    const [goalsScored, setGoalsScored] = useState(0);
    const [goalsConceded, setGoalsConceded] = useState(0);
    const [playedCount, setPlayedCount] = useState(0);

    const [topScorers, setTopScorers] = useState<ScorerStats[]>([]);
    const [topAssisters, setTopAssisters] = useState<AssistStats[]>([]);

    const [homeStats, setHomeStats] = useState({ wins: 0, draws: 0, losses: 0, played: 0 });
    const [awayStats, setAwayStats] = useState({ wins: 0, draws: 0, losses: 0, played: 0 });
    const [grassStats, setGrassStats] = useState({ wins: 0, draws: 0, losses: 0, played: 0 });
    const [surface4GStats, setSurface4GStats] = useState({ wins: 0, draws: 0, losses: 0, played: 0 });

    // Shot Analytics States
    const [allShots, setAllShots] = useState<Shot[]>([]);
    const [playersMap, setPlayersMap] = useState<Record<string, string>>({});
    const [conversionRates, setConversionRates] = useState<{name: string, goals: number, shots: number, rate: number}[]>([]);
    const [boxShotPercent, setBoxShotPercent] = useState(0);
    const [showOnlyGoals, setShowOnlyGoals] = useState(false);
    const [showOpposition, setShowOpposition] = useState(false);
    const [massiveChanceConvRate, setMassiveChanceConvRate] = useState(0);
    const [buildUpStats, setBuildUpStats] = useState<{name: string, value: number}[]>([]);
    const [concededBuildUpStats, setConcededBuildUpStats] = useState<{name: string, value: number}[]>([]);

    const fetchData = async () => {
        const [matchesRes, playersRes, watcherRes] = await Promise.all([
            supabase.from('matches').select('*'),
            supabase.from('players').select('*'),
            supabase.from('watcher_stats').select('*')
        ]);

        const matchesData = matchesRes.data;
        const playersData = playersRes.data || [];
        const watcherData = watcherRes.data || [];

        // Build Player Map
        const pMap: Record<string, string> = { "opposition": "Opposition Player" };
        playersData.forEach((p: any) => {
            pMap[p.id] = `${p.first_name} ${p.last_name}`;
        });
        setPlayersMap(pMap);

        // Parse all shots
        let globalShots: Shot[] = [];
        watcherData.forEach((w: any) => {
            if (w.stats && w.stats.shots && Array.isArray(w.stats.shots)) {
                w.stats.shots.forEach((s: any) => {
                    globalShots.push({ ...s, matchId: w.match_id });
                });
            }
        });
        setAllShots(globalShots);

        if (matchesData) {
            const parsedMatches: Match[] = matchesData.map(m => {
                const surfaceMatch = m.notes ? m.notes.match(/\[Surface: (.*?)\]/) : null;
                const surface = surfaceMatch ? surfaceMatch[1] : "4G";
                const cleanNotes = m.notes ? m.notes.replace(/\[Surface: .*?\]\n?/, "").trim() : "";
                
                return {
                    id: m.id,
                    date: m.date,
                    time: m.time,
                    opponent: m.opponent,
                    isHome: m.is_home,
                    competition: m.competition,
                    scoreline: m.scoreline,
                    result: m.result,
                    goalscorers: m.goalscorers,
                    assists: m.assists,
                    notes: cleanNotes,
                    surface: surface
                };
            });
            setMatches(parsedMatches);
        }
    };

    // Calculate advanced metrics when season filter or shots change
    useEffect(() => {
        if (allShots.length === 0) return;

        // Filter shots by season and match type
        const filteredShots = allShots.filter(s => {
            const m = matches.find(match => match.id === s.matchId);
            if (!m) return false;
            if (seasonFilter !== "All" && getSeasonFromDate(m.date) !== seasonFilter) return false;
            
            if (matchTypeFilter !== "All") {
                const isFriendly = m.competition === "Friendly" || m.competition === "Pre-Season";
                if (matchTypeFilter === "Friendly" && !isFriendly) return false;
                if (matchTypeFilter === "Competitive" && isFriendly) return false;
            }
            return true;
        });

        // 1. Box Shot Percentage
        // Box coordinates (Attacking top): x between 25-75%, y between 0-16.66%
        let boxShots = 0;
        filteredShots.forEach(s => {
            if (s.x >= 25 && s.x <= 75 && s.y <= 16.66) boxShots++;
        });
        setBoxShotPercent(filteredShots.length > 0 ? Math.round((boxShots / filteredShots.length) * 100) : 0);

        // 2. Conversion Rates
        const playerShotStats: Record<string, { shots: number, goals: number }> = {};
        filteredShots.forEach(s => {
            if (s.playerId === "opposition") return; // Skip opposition for our conversion table
            if (!playerShotStats[s.playerId]) playerShotStats[s.playerId] = { shots: 0, goals: 0 };
            playerShotStats[s.playerId].shots++;
            if (s.outcome === "Goal") playerShotStats[s.playerId].goals++;
        });

        const convRates = Object.entries(playerShotStats)
            .filter(([_, stats]) => stats.shots > 0) // only players who took shots
            .map(([id, stats]) => ({
                name: playersMap[id] || "Unknown",
                goals: stats.goals,
                shots: stats.shots,
                rate: Math.round((stats.goals / stats.shots) * 100)
            }))
            .sort((a, b) => b.rate - a.rate)
            .slice(0, 5); // Top 5
        setConversionRates(convRates);

        // 3. Build-Up Analytics
        const buildUpCounts: Record<string, number> = {};
        const concededBuildUpCounts: Record<string, number> = {};
        filteredShots.forEach(s => {
            if (!s.buildUp) return;
            if (s.playerId === "opposition") {
                concededBuildUpCounts[s.buildUp] = (concededBuildUpCounts[s.buildUp] || 0) + 1;
            } else {
                buildUpCounts[s.buildUp] = (buildUpCounts[s.buildUp] || 0) + 1;
            }
        });
        const buildUpArr = Object.entries(buildUpCounts).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value);
        setBuildUpStats(buildUpArr);

        const concededBuildUpArr = Object.entries(concededBuildUpCounts).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value);
        setConcededBuildUpStats(concededBuildUpArr);

        // 4. Massive Chance Conversion Rate
        let massiveChances = 0;
        let massiveChanceGoals = 0;
        filteredShots.forEach(s => {
            if (s.playerId === "opposition") return;
            if (s.quality === "Massive Chance") {
                massiveChances++;
                if (s.outcome === "Goal") massiveChanceGoals++;
            }
        });
        setMassiveChanceConvRate(massiveChances > 0 ? Math.round((massiveChanceGoals / massiveChances) * 100) : 0);
        
    }, [allShots, matches, seasonFilter, matchTypeFilter, playersMap]);

    const getShotColor = (outcome: "Goal" | "Saved" | "Missed" | "Blocked") => {
        switch (outcome) {
            case "Goal": return "bg-green-500 border-white";
            case "Saved": return "bg-amber-500 border-white";
            case "Blocked": return "bg-slate-500 border-white";
            case "Missed": return "bg-red-500 border-white";
            default: return "bg-white";
        }
    };

    const calculateMatchStats = (matchList: Match[]) => {
        let wins = 0;
        let played = 0;
        let scored = 0;
        let conceded = 0;

        // Grouping Logic to merge variations like "M.Hassan", "Mohammed Hassan", "Hassan"
        const groupPlayers = (rawList: { name: string, count: number }[]) => {
            const groups: Record<string, { total: number, displayNames: Record<string, number> }> = {};
            
            rawList.forEach(item => {
                const clean = item.name.replace(/\./g, ' ').trim().toUpperCase();
                const parts = clean.split(/\s+/);
                
                let key = clean;
                if (parts.length >= 2) {
                    const initial = parts[0][0];
                    const surname = parts[parts.length - 1];
                    key = `${initial} ${surname}`;
                } else if (parts.length === 1) {
                    key = parts[0]; 
                }

                if (!groups[key]) {
                    groups[key] = { total: 0, displayNames: {} };
                }
                groups[key].total += item.count;
                groups[key].displayNames[item.name] = (groups[key].displayNames[item.name] || 0) + item.count;
            });

            const finalGroups: Record<string, typeof groups[string]> = {};
            Object.keys(groups).forEach(key => {
                if (!key.includes(' ')) {
                    const match = Object.keys(groups).find(k => k.includes(' ') && k.endsWith(key));
                    if (match) {
                        if (!finalGroups[match]) finalGroups[match] = { total: 0, displayNames: {} };
                        finalGroups[match].total += groups[key].total;
                        Object.entries(groups[key].displayNames).forEach(([name, count]) => {
                            finalGroups[match].displayNames[name] = (finalGroups[match].displayNames[name] || 0) + count;
                        });
                        return;
                    }
                }
                
                if (!finalGroups[key]) finalGroups[key] = { total: 0, displayNames: {} };
                finalGroups[key].total += groups[key].total;
                Object.entries(groups[key].displayNames).forEach(([name, count]) => {
                    finalGroups[key].displayNames[name] = (finalGroups[key].displayNames[name] || 0) + count;
                });
            });

            return Object.values(finalGroups).map(group => {
                const bestName = Object.entries(group.displayNames).sort((a, b) => b[1] - a[1])[0][0];
                return { name: bestName, goals: group.total, assists: group.total }; // return both keys for generic use
            }).sort((a, b) => b.goals - a.goals).slice(0, 5);
        };

        const rawScorers: { name: string, count: number }[] = [];
        const rawAssists: { name: string, count: number }[] = [];

        const hStats = { wins: 0, draws: 0, losses: 0, played: 0 };
        const aStats = { wins: 0, draws: 0, losses: 0, played: 0 };
        const gStats = { wins: 0, draws: 0, losses: 0, played: 0 };
        const s4Stats = { wins: 0, draws: 0, losses: 0, played: 0 };

        matchList.forEach(match => {
            // 1. Calculate Win/Loss/Goals
            if (match.result && match.result !== "Pending") {
                played++;
                
                if (match.result === "Win") {
                    wins++;
                    if (match.isHome) hStats.wins++; else aStats.wins++;
                    if (match.surface === "4G") s4Stats.wins++; else gStats.wins++;
                } else if (match.result === "Draw") {
                    if (match.isHome) hStats.draws++; else aStats.draws++;
                    if (match.surface === "4G") s4Stats.draws++; else gStats.draws++;
                } else if (match.result === "Loss") {
                    if (match.isHome) hStats.losses++; else aStats.losses++;
                    if (match.surface === "4G") s4Stats.losses++; else gStats.losses++;
                }
                
                if (match.isHome) hStats.played++; else aStats.played++;
                if (match.surface === "4G") s4Stats.played++; else gStats.played++;

                // Parse Scoreline (Assuming format "2-1" or similar)
                if (match.scoreline && match.scoreline.includes("-")) {
                    const [homeStr, awayStr] = match.scoreline.split("-");
                    const num1 = parseInt(homeStr) || 0;
                    const num2 = parseInt(awayStr) || 0;

                    if (match.result === "Win") {
                        scored += Math.max(num1, num2);
                        conceded += Math.min(num1, num2);
                    } else if (match.result === "Loss") {
                        scored += Math.min(num1, num2);
                        conceded += Math.max(num1, num2);
                    } else {
                        // Draw
                        scored += num1;
                        conceded += num2;
                    }
                }
            }

            // 2. Parse Goalscorers
            if (match.goalscorers) {
                const normalizedGoalscorers = match.goalscorers
                    .replace(/\s+and\s+/gi, ',')
                    .replace(/\s*&\s*/g, ',')
                    .replace(/\s*\+\s*/g, ',')
                    .replace(/\s*\/\s*/g, ',');
                const entries = normalizedGoalscorers.split(",");
                entries.forEach(entry => {
                    entry = entry.trim();
                    if (!entry) return;

                    const trailingMatch = entry.match(/\s*\(?(?:x\s*)?(\d+)\)?$/i);
                    const leadingMatch = entry.match(/^\(?(\d+)(?:\s*x)?\)?\s*/i);
                    let count = 1;
                    let name = entry;

                    if (trailingMatch) {
                        count = parseInt(trailingMatch[1]);
                        name = entry.replace(/\s*\(?(?:x\s*)?\d+\)?$/i, "").trim();
                    } else if (leadingMatch) {
                        count = parseInt(leadingMatch[1]);
                        name = entry.replace(/^\(?\d+(?:\s*x)?\)?\s*/i, "").trim();
                    }

                    if (name) {
                        rawScorers.push({ name, count });
                    }
                });
            }

            // 3. Parse Assists
            if (match.assists) {
                const normalizedAssists = match.assists
                    .replace(/\s+and\s+/gi, ',')
                    .replace(/\s*&\s*/g, ',')
                    .replace(/\s*\+\s*/g, ',')
                    .replace(/\s*\/\s*/g, ',');
                const entries = normalizedAssists.split(",");
                entries.forEach(entry => {
                    entry = entry.trim();
                    if (!entry) return;

                    const trailingMatch = entry.match(/\s*\(?(?:x\s*)?(\d+)\)?$/i);
                    const leadingMatch = entry.match(/^\(?(\d+)(?:\s*x)?\)?\s*/i);
                    let count = 1;
                    let name = entry;

                    if (trailingMatch) {
                        count = parseInt(trailingMatch[1]);
                        name = entry.replace(/\s*\(?(?:x\s*)?\d+\)?$/i, "").trim();
                    } else if (leadingMatch) {
                        count = parseInt(leadingMatch[1]);
                        name = entry.replace(/^\(?\d+(?:\s*x)?\)?\s*/i, "").trim();
                    }

                    if (name) {
                        rawAssists.push({ name, count });
                    }
                });
            }
        });

        // Set Basic Stats
        setPlayedCount(played);
        setGoalsScored(scored);
        setGoalsConceded(conceded);
        setWinRate(played > 0 ? Math.round((wins / played) * 100) : 0);

        setHomeStats(hStats);
        setAwayStats(aStats);
        setGrassStats(gStats);
        setSurface4GStats(s4Stats);

        // Group & Sort
        setTopScorers(groupPlayers(rawScorers).map(p => ({ name: p.name, goals: p.goals })));
        setTopAssisters(groupPlayers(rawAssists).map(p => ({ name: p.name, assists: p.assists })));
    };

    return (
        <div className="relative min-h-[80vh] flex flex-col items-center justify-center p-4">
            {/* Blurred background preview */}
            <div className="absolute inset-0 filter blur-[6px] opacity-20 pointer-events-none select-none overflow-hidden max-w-5xl mx-auto flex flex-col gap-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h2 className="text-3xl font-bold tracking-tight text-slate-900">Season Statistics</h2>
                        <p className="text-slate-500">Performance overview.</p>
                    </div>
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                    <Card className="bg-white border-slate-200 shadow-sm"><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Win Rate</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">78%</div></CardContent></Card>
                    <Card className="bg-white border-slate-200 shadow-sm"><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Goals Scored</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-green-600">42</div></CardContent></Card>
                    <Card className="bg-white border-slate-200 shadow-sm"><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Goals Conceded</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-red-600">12</div></CardContent></Card>
                </div>
                <div className="h-64 bg-slate-100 rounded-xl border border-dashed border-slate-300 flex items-center justify-center">
                    <span className="text-slate-400 text-sm">Interactive Pitch Analytics Map</span>
                </div>
            </div>

            {/* Lock Modal */}
            <Card className="relative z-10 max-w-md w-full bg-slate-900 border-slate-800 text-white shadow-2xl p-8 flex flex-col items-center text-center">
                <div className="h-14 w-14 bg-red-500/10 rounded-full flex items-center justify-center mb-6 text-red-500 border border-red-500/20">
                    <Lock className="h-6 w-6" />
                </div>
                <CardTitle className="text-2xl font-black tracking-tight mb-2">Premium Analytics Suite</CardTitle>
                <CardDescription className="text-slate-400 text-sm mb-6 leading-relaxed">
                    Unlock advanced shot maps, conversion rates, pitch-surface performance analysis, and automated player ratings to elevate your team's matchday strategy.
                </CardDescription>
                <div className="w-full bg-slate-950/50 rounded-xl p-4 mb-6 border border-slate-800 text-left space-y-2.5">
                    <div className="flex items-center gap-2.5 text-xs text-slate-300">
                        <span className="text-green-500 font-bold">✓</span> Shot origin mapping & heatmaps
                    </div>
                    <div className="flex items-center gap-2.5 text-xs text-slate-300">
                        <span className="text-green-500 font-bold">✓</span> Individual player conversion analytics
                    </div>
                    <div className="flex items-center gap-2.5 text-xs text-slate-300">
                        <span className="text-green-500 font-bold">✓</span> Historical season-on-season filters
                    </div>
                </div>
                <Button className="w-full bg-red-600 hover:bg-red-700 text-white font-medium h-12 text-sm shadow-lg shadow-red-900/50">
                    Upgrade to Premium
                </Button>
            </Card>
        </div>
    );

    // Legacy un-locked return:
    return (
        <div className="h-full flex flex-col gap-6 max-w-5xl mx-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-slate-900">Season Statistics</h2>
                    <p className="text-slate-500">Performance overview for {settings.name}.</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                    <Select value={seasonFilter} onValueChange={setSeasonFilter}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Filter by Season" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="All">All Seasons</SelectItem>
                            {uniqueSeasons.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    <Select value={matchTypeFilter} onValueChange={(v: any) => setMatchTypeFilter(v)}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Match Type" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="All">All Matches</SelectItem>
                            <SelectItem value="Competitive">Competitive</SelectItem>
                            <SelectItem value="Friendly">Friendlies</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Key Metrics Grid */}
            <div className="grid gap-4 md:grid-cols-3">
                <Card className="bg-white border-slate-200 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-slate-500">Win Rate</CardTitle>
                        <Trophy className="h-4 w-4 text-amber-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-slate-900">{winRate}%</div>
                        <p className="text-xs text-slate-500">
                            From {playedCount} matches played
                        </p>
                    </CardContent>
                </Card>
                <Card className="bg-white border-slate-200 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-slate-500">Goals Scored</CardTitle>
                        <TrendingUp className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">{goalsScored}</div>
                        <p className="text-xs text-slate-500">
                            {playedCount > 0 ? (goalsScored / playedCount).toFixed(1) : "0.0"} per match
                        </p>
                    </CardContent>
                </Card>
                <Card className="bg-white border-slate-200 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-slate-500">Goals Conceded</CardTitle>
                        <ShieldAlert className="h-4 w-4 text-red-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-600">{goalsConceded}</div>
                        <p className="text-xs text-slate-500">
                            {playedCount > 0 ? (goalsConceded / playedCount).toFixed(1) : "0.0"} per match
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Win Rate Breakdowns */}
            <div className="grid gap-4 md:grid-cols-2">
                <Card className="bg-white border-slate-200 shadow-sm">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-lg font-bold">Home vs Away</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="font-bold text-slate-900">Home</p>
                                <p className="text-xs text-slate-500">{homeStats.played} Matches</p>
                            </div>
                            <div className="text-right">
                                <p className="font-bold text-slate-900">{homeStats.played > 0 ? Math.round((homeStats.wins / homeStats.played) * 100) : 0}% Win Rate</p>
                                <p className="text-xs text-slate-500">{homeStats.wins}W, {homeStats.draws}D, {homeStats.losses}L</p>
                            </div>
                        </div>
                        <div className="h-px bg-slate-100 w-full" />
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="font-bold text-slate-900">Away</p>
                                <p className="text-xs text-slate-500">{awayStats.played} Matches</p>
                            </div>
                            <div className="text-right">
                                <p className="font-bold text-slate-900">{awayStats.played > 0 ? Math.round((awayStats.wins / awayStats.played) * 100) : 0}% Win Rate</p>
                                <p className="text-xs text-slate-500">{awayStats.wins}W, {awayStats.draws}D, {awayStats.losses}L</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                
                <Card className="bg-white border-slate-200 shadow-sm">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-lg font-bold">Surface Performance</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="font-bold text-slate-900">Grass</p>
                                <p className="text-xs text-slate-500">{grassStats.played} Matches</p>
                            </div>
                            <div className="text-right">
                                <p className="font-bold text-slate-900">{grassStats.played > 0 ? Math.round((grassStats.wins / grassStats.played) * 100) : 0}% Win Rate</p>
                                <p className="text-xs text-slate-500">{grassStats.wins}W, {grassStats.draws}D, {grassStats.losses}L</p>
                            </div>
                        </div>
                        <div className="h-px bg-slate-100 w-full" />
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="font-bold text-slate-900">4G</p>
                                <p className="text-xs text-slate-500">{surface4GStats.played} Matches</p>
                            </div>
                            <div className="text-right">
                                <p className="font-bold text-slate-900">{surface4GStats.played > 0 ? Math.round((surface4GStats.wins / surface4GStats.played) * 100) : 0}% Win Rate</p>
                                <p className="text-xs text-slate-500">{surface4GStats.wins}W, {surface4GStats.draws}D, {surface4GStats.losses}L</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Advanced Shot Analytics */}
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-4">
                <Card className="col-span-1 xl:col-span-1">
                    <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                        <div>
                            <CardTitle className="flex items-center gap-2">
                                <Target className="h-5 w-5 text-emerald-600" />
                                Global Shot Map
                            </CardTitle>
                            <CardDescription>
                                All shots taken {seasonFilter !== "All" ? `in ${seasonFilter}` : "across all seasons"}. ({boxShotPercent}% inside the box)
                            </CardDescription>
                        </div>
                        <div className="flex flex-col md:flex-row items-start md:items-center space-y-2 md:space-y-0 md:space-x-4 mt-1">
                            <div className="flex items-center space-x-2">
                                <input 
                                    type="checkbox" 
                                    id="showOpposition" 
                                    checked={showOpposition} 
                                    onChange={(e) => setShowOpposition(e.target.checked)}
                                    className="rounded border-gray-300 text-rose-600 focus:ring-rose-500"
                                />
                                <Label htmlFor="showOpposition" className="text-xs font-medium cursor-pointer text-slate-700">Opposition</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <input 
                                    type="checkbox" 
                                    id="showOnlyGoals" 
                                    checked={showOnlyGoals} 
                                    onChange={(e) => setShowOnlyGoals(e.target.checked)}
                                    className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                                />
                                <Label htmlFor="showOnlyGoals" className="text-xs font-medium cursor-pointer text-slate-700">Goals Only</Label>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="flex flex-col items-center">
                        <div 
                            className="relative w-full max-w-sm aspect-[2/3] bg-emerald-600 rounded border-4 border-emerald-700 shadow-inner overflow-hidden"
                            style={{
                                backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 10%, rgba(255,255,255,0.05) 10%, rgba(255,255,255,0.05) 20%)"
                            }}
                        >
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
                            {allShots.filter(s => {
                                const m = matches.find(match => match.id === s.matchId);
                                if (!m) return false;
                                if (seasonFilter !== "All" && getSeasonFromDate(m.date) !== seasonFilter) return false;
                                
                                if (matchTypeFilter !== "All") {
                                    const isFriendly = m.competition === "Friendly" || m.competition === "Pre-Season";
                                    if (matchTypeFilter === "Friendly" && !isFriendly) return false;
                                    if (matchTypeFilter === "Competitive" && isFriendly) return false;
                                }

                                if (showOpposition) {
                                    if (s.playerId !== "opposition") return false;
                                } else {
                                    if (s.playerId === "opposition") return false;
                                }

                                if (showOnlyGoals && s.outcome !== "Goal") return false;
                                return true;
                            }).map((shot) => (
                                <div 
                                    key={shot.id}
                                    className={`absolute w-3 h-3 -ml-1.5 -mt-1.5 rounded-full border shadow-sm flex items-center justify-center group ${getShotColor(shot.outcome)}`}
                                    style={{ left: `${shot.x}%`, top: `${shot.y}%` }}
                                >
                                    <div className="hidden group-hover:block absolute bottom-full mb-1 bg-slate-900 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap z-10 pointer-events-none">
                                        {playersMap[shot.playerId] || "Unknown"} - {shot.outcome}
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="mt-4 flex gap-3 justify-center text-xs text-slate-500">
                            <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-green-500"></div> Goal</span>
                            <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-amber-500"></div> Saved</span>
                            <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-500"></div> Missed</span>
                            <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-slate-500"></div> Blocked</span>
                        </div>
                    </CardContent>
                </Card>

                <Card className="col-span-1 border-rose-100 bg-rose-50/10">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-rose-700">
                            <Flame className="h-5 w-5" />
                            Conversion Rates
                        </CardTitle>
                        <CardDescription>
                            Shot-to-Goal accuracy (from Match Analysis logs)
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {conversionRates.length > 0 ? (
                                <>
                                    {conversionRates.map((stat, index) => (
                                        <div key={stat.name} className="flex items-center justify-between border-b border-slate-100 last:border-0 pb-2 last:pb-0">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-bold text-slate-400 w-4">{index + 1}</span>
                                                <span className="text-sm font-medium text-slate-700">{stat.name}</span>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-bold text-slate-900 text-sm">{stat.rate}%</p>
                                                <p className="text-[10px] text-slate-500">{stat.goals}G / {stat.shots}S</p>
                                            </div>
                                        </div>
                                    ))}
                                    <div className="mt-4 pt-4 border-t border-rose-200">
                                        <h4 className="text-xs font-bold text-rose-800 uppercase tracking-wider mb-2">Massive Chance Conversion</h4>
                                        <div className="flex items-center justify-between bg-white p-3 rounded border border-rose-100">
                                            <span className="text-sm font-medium text-slate-700">Team Accuracy</span>
                                            <span className="font-black text-rose-600 text-lg">{massiveChanceConvRate}%</span>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div className="text-center py-8 text-slate-400 text-sm">
                                    No shots recorded in Match Analysis yet.
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Build-Up Analytics */}
                <Card className="col-span-1 border-indigo-100 bg-indigo-50/10">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-indigo-700">
                            <Activity className="h-5 w-5" />
                            Chance Creation
                        </CardTitle>
                        <CardDescription>
                            Where your shots typically come from
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {buildUpStats.length > 0 ? (
                                buildUpStats.map((stat, index) => {
                                    const totalShots = buildUpStats.reduce((acc, curr) => acc + curr.value, 0);
                                    const percentage = Math.round((stat.value / totalShots) * 100);
                                    return (
                                        <div key={stat.name} className="space-y-1">
                                            <div className="flex items-center justify-between text-sm">
                                                <span className="font-medium text-slate-700">{stat.name}</span>
                                                <span className="font-bold text-slate-900">{stat.value} Shots ({percentage}%)</span>
                                            </div>
                                            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                                                <div className="bg-indigo-500 h-2 rounded-full" style={{ width: `${percentage}%` }}></div>
                                            </div>
                                        </div>
                                    )
                                })
                            ) : (
                                <div className="text-center py-8 text-slate-400 text-sm">
                                    No build-up data recorded yet.
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Chances Conceded Analytics */}
                <Card className="col-span-1 border-slate-200 bg-slate-50/50">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-slate-700">
                            <ShieldAlert className="h-5 w-5" />
                            Chances Conceded
                        </CardTitle>
                        <CardDescription>
                            Where opposition shots originate from
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {concededBuildUpStats.length > 0 ? (
                                concededBuildUpStats.map((stat, index) => {
                                    const totalShots = concededBuildUpStats.reduce((acc, curr) => acc + curr.value, 0);
                                    const percentage = Math.round((stat.value / totalShots) * 100);
                                    return (
                                        <div key={stat.name} className="space-y-1">
                                            <div className="flex items-center justify-between text-sm">
                                                <span className="font-medium text-slate-700">{stat.name}</span>
                                                <span className="font-bold text-slate-900">{stat.value} Shots ({percentage}%)</span>
                                            </div>
                                            <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                                                <div className="bg-slate-500 h-2 rounded-full" style={{ width: `${percentage}%` }}></div>
                                            </div>
                                        </div>
                                    )
                                })
                            ) : (
                                <div className="text-center py-8 text-slate-400 text-sm">
                                    No opposition build-up data recorded yet.
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Top Scorers Section */}
            <div className="grid gap-4 md:grid-cols-2">
                <Card className="col-span-1">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Goal className="h-5 w-5 text-slate-900" />
                            Top Scorers
                        </CardTitle>
                        <CardDescription>
                            Calculated from match report data.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {topScorers.length > 0 ? (
                                topScorers.map((scorer, index) => (
                                    <div key={scorer.name} className="flex items-center justify-between border-b border-slate-100 last:border-0 pb-2 last:pb-0">
                                        <div className="flex items-center gap-3">
                                            <div className={`
                                                flex h-8 w-8 items-center justify-center rounded-full font-bold text-xs
                                                ${index === 0 ? "bg-yellow-100 text-yellow-700" :
                                                    index === 1 ? "bg-slate-100 text-slate-700" :
                                                        index === 2 ? "bg-orange-100 text-orange-700" : "bg-slate-50 text-slate-500"}
                                            `}>
                                                {index + 1}
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium text-slate-900">{scorer.name}</p>
                                            </div>
                                        </div>
                                        <div className="font-bold text-slate-900">{scorer.goals}</div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-8 text-slate-400 text-sm">
                                    No goals recorded in match reports yet.
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Explanation / Hint */}
                <Card className="col-span-1 border-blue-100 bg-blue-50/50">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-blue-700">
                            <AlertCircle className="h-5 w-5" />
                            How it works
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm text-slate-600 space-y-2">
                        <p>
                            Top Scorers are now automatically updated based on the <strong>Goalscorers</strong> field in your <strong>Matches</strong> tab.
                        </p>
                        <p>
                            Make sure to enter names consistently (e.g. <em>"M.Hassan"</em>) so they count towards the same player total!
                        </p>
                    </CardContent>
                </Card>

                {/* Top Assisters */}
                <Card className="col-span-1 border-indigo-100 bg-indigo-50/10">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <span className="h-5 w-5 flex items-center justify-center text-sm font-bold">🅰️</span>
                            Top Assisters
                        </CardTitle>
                        <CardDescription>
                            Most creative providers this season.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {topAssisters.length > 0 ? (
                                topAssisters.map((player, index) => (
                                    <div key={player.name} className="flex items-center justify-between border-b border-slate-100 last:border-0 pb-2 last:pb-0">
                                        <div className="flex items-center gap-3">
                                            <div className={`
                                                flex h-8 w-8 items-center justify-center rounded-full font-bold text-xs
                                                ${index === 0 ? "bg-indigo-100 text-indigo-700" :
                                                    index === 1 ? "bg-slate-100 text-slate-700" :
                                                        index === 2 ? "bg-slate-50 text-slate-600" : "bg-white text-slate-400 border border-slate-100"}
                                            `}>
                                                {index + 1}
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium text-slate-900">{player.name}</p>
                                            </div>
                                        </div>
                                        <div className="font-bold text-slate-900">{player.assists}</div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-8 text-slate-400 text-sm">
                                    No assists recorded yet.
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>

        </div>
    );
}
