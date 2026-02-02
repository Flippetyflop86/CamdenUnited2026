"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Match } from "@/types";
import { Trophy, TrendingUp, TrendingDown, Goal, ShieldAlert, AlertCircle, Target, Clock } from "lucide-react";
import { useClub } from "@/context/club-context";
import { ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, Cell, Legend, Label, BarChart, Bar } from "recharts";
import { WatcherMatchStats } from "@/types";
import { calculateDominance, calculateTotals } from "@/lib/stats-utils";
import { supabase } from "@/lib/supabase";

interface ScorerStats {
    name: string;
    goals: number;
}

interface AssistStats {
    name: string;
    assists: number;
}

export default function StatsPage() {
    const { settings } = useClub();
    const [matches, setMatches] = useState<Match[]>([]);
    const [performanceData, setPerformanceData] = useState<any[]>([]);

    // Stats State
    const [winRate, setWinRate] = useState(0);
    const [goalsScored, setGoalsScored] = useState(0);
    const [goalsConceded, setGoalsConceded] = useState(0);
    const [playedCount, setPlayedCount] = useState(0);

    // Derived Top Scorers & Assisters
    const [topScorers, setTopScorers] = useState<ScorerStats[]>([]);
    const [topAssisters, setTopAssisters] = useState<AssistStats[]>([]);

    // Advanced Watcher Stats
    const [clinicality, setClinicality] = useState<{ rate: number, goals: number, chances: number } | null>(null);
    const [halfStats, setHalfStats] = useState<{ us1: number, us2: number, opp1: number, opp2: number } | null>(null);

    // ... (keep state) ...

    useEffect(() => {
        fetchData();

        // Setup subscriptions for realtime updates
        const channels = [
            supabase.channel('public:matches').on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, fetchData),
            supabase.channel('public:watcher_stats').on('postgres_changes', { event: '*', schema: 'public', table: 'watcher_stats' }, fetchData)
        ];
        channels.forEach(c => c.subscribe());

        return () => { channels.forEach(c => supabase.removeChannel(c)); };
    }, []);

    const fetchData = async () => {
        const [{ data: matchesData }, { data: watcherData }] = await Promise.all([
            supabase.from('matches').select('*'),
            supabase.from('watcher_stats').select('*')
        ]);

        if (matchesData) {
            const parsedMatches: Match[] = matchesData as any;
            setMatches(parsedMatches);
            calculateMatchStats(parsedMatches);

            // Calculate Performance Correlation
            if (watcherData) { // Use watcherData directly
                const watcherStats: WatcherMatchStats[] = watcherData.map((s: any) => ({
                    id: s.id,
                    matchId: s.match_id,
                    us: s.us,
                    opposition: s.opposition,
                    createdAt: s.created_at,
                    updatedAt: s.updated_at
                }));

                const correlationData = parsedMatches
                    .filter(m => m.result && m.result !== "Pending") // Only played matches
                    .map(match => {
                        const stats = watcherStats.find(s => s.matchId === match.id);
                        if (!stats) return null;

                        const usTotals = calculateTotals(stats.us);
                        const oppTotals = calculateTotals(stats.opposition);
                        const usScore = calculateDominance(usTotals);
                        const oppScore = calculateDominance(oppTotals);

                        // Margin: Positive = US Dominance, Negative = OPP Dominance
                        const margin = usScore - oppScore;

                        // Parse Scoreline for Goal Diff
                        let goalDiff = 0;
                        if (match.scoreline && match.scoreline.includes("-")) {
                            const [homeStr, awayStr] = match.scoreline.split("-");
                            const homeGoals = parseInt(homeStr) || 0;
                            const awayGoals = parseInt(awayStr) || 0;
                            // Calculate diff relative to US
                            if (match.isHome) goalDiff = homeGoals - awayGoals;
                            else goalDiff = awayGoals - homeGoals;
                        }

                        return {
                            opponent: match.opponent,
                            result: match.result,
                            margin: margin,
                            goalDifference: goalDiff,
                            usScore,
                            oppScore,
                            date: match.date,
                            scoreline: match.scoreline
                        };
                    })
                    .filter(item => item !== null) // Remove matches without watcher data
                    .sort((a, b) => new Date(a!.date).getTime() - new Date(b!.date).getTime()); // Sort by date

                setPerformanceData(correlationData);

                // Calculate Advanced Aggregates
                let totalGoals = 0;
                let totalMassiveChances = 0;
                let us1Goals = 0;
                let us2Goals = 0;
                let opp1Goals = 0;
                let opp2Goals = 0;

                watcherStats.forEach(stat => {
                    // Clinicality
                    const us = stat.us;
                    totalGoals += (us.firstHalf.goals + us.secondHalf.goals);
                    totalMassiveChances += (us.firstHalf.massiveChancesShot + us.firstHalf.massiveChancesNoShot +
                        us.secondHalf.massiveChancesShot + us.secondHalf.massiveChancesNoShot);

                    // Game State
                    us1Goals += us.firstHalf.goals;
                    us2Goals += us.secondHalf.goals;
                    opp1Goals += stat.opposition.firstHalf.goals;
                    opp2Goals += stat.opposition.secondHalf.goals;
                });

                if (totalMassiveChances > 0) {
                    setClinicality({
                        rate: Math.round((totalGoals / totalMassiveChances) * 100),
                        goals: totalGoals,
                        chances: totalMassiveChances
                    });
                }

                setHalfStats({
                    us1: us1Goals,
                    us2: us2Goals,
                    opp1: opp1Goals,
                    opp2: opp2Goals
                });
            }
        }
    };

    const calculateMatchStats = (matchList: Match[]) => {
        let wins = 0;
        let played = 0;
        let scored = 0;
        let conceded = 0;

        // Scorer Map
        const scorerMap: Record<string, number> = {};
        const assistMap: Record<string, number> = {};

        matchList.forEach(match => {
            // 1. Calculate Win/Loss/Goals
            if (match.result && match.result !== "Pending") {
                played++;
                if (match.result === "Win") wins++;

                // Parse Scoreline (Assuming format "2-1" or similar)
                if (match.scoreline && match.scoreline.includes("-")) {
                    const [homeStr, awayStr] = match.scoreline.split("-");
                    const homeGoals = parseInt(homeStr) || 0;
                    const awayGoals = parseInt(awayStr) || 0;

                    if (match.isHome) {
                        scored += homeGoals;
                        conceded += awayGoals;
                    } else {
                        scored += awayGoals;
                        conceded += homeGoals;
                    }
                }
            }

            // 2. Parse Goalscorers (Even for pending/loss if documented, though usually for played)
            if (match.goalscorers) {
                // Split by comma
                const entries = match.goalscorers.split(",");
                entries.forEach(entry => {
                    entry = entry.trim();
                    if (!entry) return;

                    // Check for (N) pattern
                    const matchCount = entry.match(/\((\d+)\)/);
                    let count = 1;
                    let name = entry;

                    if (matchCount) {
                        count = parseInt(matchCount[1]);
                        name = entry.replace(/\(\d+\)/, "").trim();
                    }

                    if (name) {
                        scorerMap[name] = (scorerMap[name] || 0) + count;
                    }
                });
            }

            // 3. Parse Assists
            if (match.assists) {
                const entries = match.assists.split(",");
                entries.forEach(entry => {
                    let name = entry.trim();
                    // Handle duplicates or counts if user enters "Player (2)" for assists too
                    const matchCount = name.match(/\((\d+)\)/);
                    let count = 1;

                    if (matchCount) {
                        count = parseInt(matchCount[1]);
                        name = name.replace(/\(\d+\)/, "").trim();
                    }

                    if (name) {
                        assistMap[name] = (assistMap[name] || 0) + count;
                    }
                });
            }
        });

        // Set Basic Stats
        setPlayedCount(played);
        setGoalsScored(scored);
        setGoalsConceded(conceded);
        setWinRate(played > 0 ? Math.round((wins / played) * 100) : 0);

        // Sort Top Scorers
        const sortedScorers = Object.entries(scorerMap)
            .map(([name, goals]) => ({ name, goals }))
            .sort((a, b) => b.goals - a.goals)
            .slice(0, 5);

        setTopScorers(sortedScorers);

        // Sort Top Assisters
        const sortedAssisters = Object.entries(assistMap)
            .map(([name, assists]) => ({ name, assists }))
            .sort((a, b) => b.assists - a.assists)
            .slice(0, 5);

        setTopAssisters(sortedAssisters);
    };

    return (
        <div className="space-y-6 pb-12">
            <div>
                <h2 className="text-3xl font-bold tracking-tight text-slate-900">Season Statistics</h2>
                <p className="text-slate-500">Performance overview for {settings.name}.</p>
            </div>

            {/* Key Metrics Grid */}
            <div className="grid gap-4 md:grid-cols-3">
                <Card className="bg-white border-slate-200 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-slate-600">
                            Win Rate
                        </CardTitle>
                        <Trophy className="h-4 w-4 text-yellow-500" />
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
                        <CardTitle className="text-sm font-medium text-slate-600">
                            Goals Scored
                        </CardTitle>
                        <TrendingUp className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">{goalsScored}</div>
                        <p className="text-xs text-slate-500">
                            {playedCount > 0 ? (goalsScored / playedCount).toFixed(1) : 0} per match
                        </p>
                    </CardContent>
                </Card>

                <Card className="bg-white border-slate-200 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-slate-600">
                            Goals Conceded
                        </CardTitle>
                        <ShieldAlert className="h-4 w-4 text-red-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-600">{goalsConceded}</div>
                        <p className="text-xs text-slate-500">
                            {playedCount > 0 ? (goalsConceded / playedCount).toFixed(1) : 0} per match
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Performance Correlation Chart */}
            <Card className="bg-white border-slate-200 shadow-sm">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-indigo-600" />
                        Performance Efficiency Matrix
                    </CardTitle>
                    <CardDescription>
                        Attacking Dominance (X) vs. Goal Difference (Y).
                        <span className="block mt-1 text-xs text-slate-400">
                            • Top-Right: Deserved Win | Bottom-Right: Unlucky Loss | Top-Left: Lucky Win
                        </span>
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="h-[400px] w-full">
                        {performanceData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <ScatterChart margin={{ top: 20, right: 30, left: 10, bottom: 20 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />

                                    {/* Quadrant Lines */}
                                    <ReferenceLine x={0} stroke="#cbd5e1" strokeWidth={2} />
                                    <ReferenceLine y={0} stroke="#cbd5e1" strokeWidth={2} />

                                    <XAxis
                                        type="number"
                                        dataKey="margin"
                                        name="Dominance Margin"
                                        tick={{ fontSize: 12, fill: '#64748b' }}
                                        axisLine={{ stroke: '#e2e8f0' }}
                                        tickLine={false}
                                        domain={['auto', 'auto']}
                                    >
                                        <Label value="Dominance (Creation Score)" offset={0} position="bottom" style={{ fill: '#94a3b8', fontSize: 12 }} />
                                    </XAxis>

                                    <YAxis
                                        type="number"
                                        dataKey="goalDifference"
                                        name="Goal Difference"
                                        tick={{ fontSize: 12, fill: '#64748b' }}
                                        axisLine={{ stroke: '#e2e8f0' }}
                                        tickLine={false}
                                        domain={['auto', 'auto']}
                                    >
                                        <Label value="Goal Difference" angle={-90} position="insideLeft" style={{ fill: '#94a3b8', fontSize: 12 }} />
                                    </YAxis>

                                    <Tooltip
                                        cursor={{ strokeDasharray: '3 3' }}
                                        content={({ active, payload }) => {
                                            if (active && payload && payload.length) {
                                                const data = payload[0].payload;
                                                return (
                                                    <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-lg text-sm">
                                                        <p className="font-bold text-slate-900 mb-1">{data.opponent}</p>
                                                        <p className="text-slate-500 mb-2">{data.scoreline} ({data.result})</p>

                                                        <div className="space-y-1 text-xs">
                                                            <div className="flex justify-between gap-4">
                                                                <span className="text-slate-500">Dominance:</span>
                                                                <span className={data.margin > 0 ? "text-green-600 font-bold" : "text-red-500 font-bold"}>
                                                                    {data.margin > 0 ? "+" : ""}{data.margin}
                                                                </span>
                                                            </div>
                                                            <div className="flex justify-between gap-4">
                                                                <span className="text-slate-500">Goal Diff:</span>
                                                                <span className={data.goalDifference > 0 ? "text-green-600 font-bold" : "text-red-500 font-bold"}>
                                                                    {data.goalDifference > 0 ? "+" : ""}{data.goalDifference}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            }
                                            return null;
                                        }}
                                    />

                                    <Scatter name="Matches" data={performanceData}>
                                        {performanceData.map((entry: any, index: number) => {
                                            const res = entry.result?.toLowerCase() || "";
                                            let color = "#94a3b8"; // Default Draw/Gray
                                            if (res.includes("win")) color = "#22c55e"; // Green
                                            if (res.includes("loss") || res.includes("lose") || res.includes("lost")) color = "#ef4444"; // Red
                                            return <Cell key={`cell-${index}`} fill={color} />;
                                        })}
                                    </Scatter>
                                </ScatterChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-slate-400 text-sm">
                                <TrendingUp className="h-8 w-8 mb-2 opacity-20" />
                                <p>No match performance data available yet.</p>
                                <p className="text-xs mt-1">Input stats in the Watcher tab to see this graph.</p>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

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

            {/* Advanced Stats Section */}
            {(clinicality || halfStats) && (
                <div className="grid gap-4 md:grid-cols-2">
                    {/* Clinicality */}
                    <Card className="bg-white border-slate-200 shadow-sm">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Target className="h-5 w-5 text-red-600" />
                                Clinicality Rating
                            </CardTitle>
                            <CardDescription>Conversion rate of Massive Chances.</CardDescription>
                        </CardHeader>
                        <CardContent className="flex flex-col items-center justify-center py-6">
                            {clinicality ? (
                                <>
                                    <div className="relative flex items-center justify-center h-32 w-32">
                                        {/* Simple CSS Ring */}
                                        <svg className="h-full w-full transform -rotate-90" viewBox="0 0 36 36">
                                            {/* Background Circle */}
                                            <path
                                                className="text-slate-100"
                                                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="4"
                                            />
                                            {/* Foreground Circle */}
                                            <path
                                                className={clinicality.rate > 40 ? "text-green-500" : clinicality.rate > 25 ? "text-yellow-500" : "text-red-500"}
                                                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="4"
                                                strokeDasharray={`${clinicality.rate}, 100`}
                                            />
                                        </svg>
                                        <div className="absolute flex flex-col items-center justify-center text-slate-900">
                                            <span className="text-3xl font-bold">{clinicality.rate}%</span>
                                        </div>
                                    </div>
                                    <div className="mt-4 text-center text-sm text-slate-500">
                                        <p>Scored <span className="font-bold text-slate-900">{clinicality.goals}</span> goals from <span className="font-bold text-slate-900">{clinicality.chances}</span> massive chances.</p>
                                    </div>
                                </>
                            ) : (
                                <p className="text-slate-400">No massive chances recorded yet.</p>
                            )}
                        </CardContent>
                    </Card>

                    {/* Game State Analysis */}
                    <Card className="bg-white border-slate-200 shadow-sm">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Clock className="h-5 w-5 text-blue-600" />
                                Game State Analysis
                            </CardTitle>
                            <CardDescription>When do we score and concede?</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {halfStats ? (
                                <div className="h-[200px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart
                                            data={[
                                                { name: "1st Half", scored: halfStats.us1, conceded: halfStats.opp1 },
                                                { name: "2nd Half", scored: halfStats.us2, conceded: halfStats.opp2 }
                                            ]}
                                            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                                        >
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                            <XAxis dataKey="name" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                                            <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                                            <Tooltip
                                                cursor={{ fill: 'transparent' }}
                                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                            />
                                            <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                                            <Bar dataKey="scored" name="Scored" fill="#22c55e" radius={[4, 4, 0, 0]} barSize={40} />
                                            <Bar dataKey="conceded" name="Conceded" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={40} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            ) : (
                                <div className="text-center py-8 text-slate-400 text-sm">
                                    No half-time data available.
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}
