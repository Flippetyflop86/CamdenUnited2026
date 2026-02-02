"use client";

import { useState, useEffect } from "react";
import { Match } from "@/types";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, CalendarDays, Clock, MapPin, Trophy, Target, Upload, Activity, Edit2, Filter, ArrowUpDown } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FixtureScout } from "@/components/matches/fixture-scout";
import { FixtureImporter } from "@/components/matches/fixture-importer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/lib/supabase";

export default function MatchesPage() {
    const [matches, setMatches] = useState<Match[]>([]);
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    // UI State
    const [filterType, setFilterType] = useState<"all" | "league" | "cup" | "friendly">("all");
    const [resultSort, setResultSort] = useState<"desc" | "asc">("desc"); // desc = Newest First

    // Form State
    const [formData, setFormData] = useState<Omit<Match, "id" | "result">>({
        date: "",
        time: "15:00",
        opponent: "",
        isHome: true,
        competition: "Premier Division",
        scoreline: "",
        goalscorers: "",
        assists: "",
        notes: ""
    });

    // ... (keep state) ...

    // Load Matches from Supabase
    useEffect(() => {
        fetchMatches();

        const channel = supabase
            .channel("public:matches")
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "matches" },
                () => fetchMatches()
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, []);

    async function fetchMatches() {
        const { data, error } = await supabase.from("matches").select("*");
        if (error) {
            console.error("Error fetching matches:", error);
            return;
        }

        const mapped: Match[] = (data || []).map((m: any) => ({
            id: m.id,
            date: m.date,
            time: m.time,
            opponent: m.opponent,
            isHome: m.is_home, // map snake_case
            competition: m.competition,
            scoreline: m.scoreline,
            result: m.result as any,
            goalscorers: m.goalscorers,
            assists: m.assists,
            notes: m.notes
        }));

        setMatches(mapped);
    }

    const handleSaveMatch = async () => {
        if (!formData.opponent || !formData.date) return;

        const result = determineResult(formData.scoreline, formData.isHome);
        const isNew = !editingId;

        const payload = {
            date: formData.date,
            time: formData.time,
            opponent: formData.opponent,
            is_home: formData.isHome, // db column
            competition: formData.competition,
            scoreline: formData.scoreline,
            result: result,
            goalscorers: formData.goalscorers,
            assists: formData.assists,
            notes: formData.notes
        };

        try {
            if (isNew) {
                const { error } = await supabase.from("matches").insert([payload]);
                if (error) throw error;
            } else {
                const { error } = await supabase.from("matches").update(payload).eq("id", editingId);
                if (error) throw error;
            }

            // Re-fetch handled by subscription usually, but we can optimistically update or just wait
            resetForm();
        } catch (e: any) {
            alert("Error saving match: " + e.message);
        }
    };

    const handleEditMatch = (match: Match) => {
        setFormData({
            date: match.date,
            time: match.time,
            opponent: match.opponent,
            isHome: match.isHome,
            competition: match.competition,
            scoreline: match.scoreline || "",
            goalscorers: match.goalscorers || "",
            assists: match.assists || "",
            notes: match.notes || ""
        });
        setEditingId(match.id);
        setIsAddOpen(true);
    };

    const handleDeleteMatch = async (id: string) => {
        if (!confirm("Are you sure you want to delete this match?")) return;

        // Optimistic
        setMatches(matches.filter(m => m.id !== id));

        const { error } = await supabase.from("matches").delete().eq("id", id);
        if (error) {
            alert("Failed to delete match");
            fetchMatches(); // revert
        }
    };

    const resetForm = () => {
        setIsAddOpen(false);
        setEditingId(null);
        setFormData({
            date: "",
            time: "15:00",
            opponent: "",
            isHome: true,
            competition: "Premier Division",
            scoreline: "",
            goalscorers: "",
            notes: ""
        });
    };

    const determineResult = (score?: string, isHome?: boolean): "Win" | "Loss" | "Draw" | "Pending" | undefined => {
        if (!score) return "Pending";
        const parts = score.split(/[-:]/);
        if (parts.length !== 2) return undefined;

        const homeScore = parseInt(parts[0].trim());
        const awayScore = parseInt(parts[1].trim());

        if (isNaN(homeScore) || isNaN(awayScore)) return undefined;
        if (homeScore === awayScore) return "Draw";

        if (isHome) {
            return homeScore > awayScore ? "Win" : "Loss";
        } else {
            // We are Away. Score is Home - Away.
            return awayScore > homeScore ? "Win" : "Loss";
        }
    };

    // Helper result styling
    const getResultColor = (result?: string) => {
        switch (result) {
            case "Win": return "text-green-600 bg-green-50 border-green-200";
            case "Loss": return "text-red-600 bg-red-50 border-red-200";
            case "Draw": return "text-amber-600 bg-amber-50 border-amber-200";
            default: return "text-slate-500 bg-slate-50 border-slate-200";
        }
    };

    // --- Filtering & Sorting Logic ---
    const getCompetitionType = (comp: string): "league" | "cup" | "friendly" => {
        const lower = comp.toLowerCase();
        if (lower.includes("cup") || lower.includes("trophy") || lower.includes("shield")) return "cup";
        if (lower.includes("friendly")) return "friendly";
        return "league";
    };

    const filteredMatches = matches.filter(match => {
        if (filterType === "all") return true;
        const type = getCompetitionType(match.competition);
        return type === filterType;
    });

    const now = new Date();

    // Upcoming: Date is in future (or today pending)
    const upcomingMatches = filteredMatches.filter(m => {
        const d = new Date(m.date);
        return d >= new Date(now.setHours(0, 0, 0, 0)) && m.result === "Pending";
    }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()); // Ascending (Soonest first)

    // Past: Date is in past OR result is documented
    const pastMatches = filteredMatches.filter(m => {
        const d = new Date(m.date);
        return d < new Date(now.setHours(0, 0, 0, 0)) || m.result !== "Pending";
    }).sort((a, b) => {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        return resultSort === "desc" ? dateB - dateA : dateA - dateB;
    });

    const MatchCard = ({ match }: { match: Match }) => (
        <Card className="overflow-hidden hover:shadow-md transition-shadow">
            <CardHeader className="py-4 bg-slate-50/50 border-b flex flex-row items-center justify-between">
                <div className="flex items-center gap-3">
                    <Badge variant="outline" className={`bg-white ${match.competition.toLowerCase().includes("cup") ? "border-amber-200 text-amber-700" : "border-slate-200"
                        }`}>
                        {match.competition}
                    </Badge>
                    <span className="text-sm text-slate-500 flex items-center gap-1">
                        <CalendarDays className="h-3 w-3" /> {new Date(match.date).toLocaleDateString()}
                    </span>
                </div>
                <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-blue-600" onClick={() => handleEditMatch(match)}>
                        <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-600" onClick={() => handleDeleteMatch(match.id)}>
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="py-4">
                <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                    {/* Home Team */}
                    <div className="flex-1 flex items-center justify-end gap-4 text-right">
                        <span className={`font-bold text-lg ${match.isHome ? 'text-slate-900' : 'text-slate-500'}`}>
                            {match.isHome ? "Camden United" : match.opponent}
                        </span>
                        {match.isHome && <span className="text-xs px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded">H</span>}
                    </div>

                    {/* Score / VS */}
                    <div className="flex flex-col items-center min-w-[100px]">
                        <div className="text-2xl font-black text-slate-900 tracking-tight">
                            {match.scoreline || "v"}
                        </div>
                        {match.result && (
                            <Badge variant="outline" className={`mt-1 text-[10px] uppercase px-2 py-0 ${getResultColor(match.result)}`}>
                                {match.result}
                            </Badge>
                        )}
                    </div>

                    {/* Away Team */}
                    <div className="flex-1 flex items-center justify-start gap-4 text-left">
                        {!match.isHome && <span className="text-xs px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded">A</span>}
                        <span className={`font-bold text-lg ${!match.isHome ? 'text-slate-900' : 'text-slate-500'}`}>
                            {!match.isHome ? "Camden United" : match.opponent}
                        </span>
                    </div>
                </div>

                {/* Details */}
                {(match.goalscorers || match.assists || match.notes) && (
                    <div className="mt-4 pt-4 border-t flex flex-col items-center text-center space-y-2">
                        {(match.goalscorers || match.assists) && (
                            <div className="space-y-1">
                                {match.goalscorers && (
                                    <div className="flex items-start gap-2 text-sm text-slate-600">
                                        <Activity className="h-4 w-4 mt-0.5 text-green-600 shrink-0" />
                                        <span>{match.goalscorers}</span>
                                    </div>
                                )}
                                {match.assists && (
                                    <div className="flex items-start gap-2 text-sm text-slate-600">
                                        <span className="h-4 w-4 mt-0.5 flex items-center justify-center text-xs font-bold shrink-0">🅰️</span>
                                        <span>{match.assists}</span>
                                    </div>
                                )}
                            </div>
                        )}
                        {match.notes && (
                            <div className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-1 rounded">
                                Note: {match.notes}
                            </div>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );

    return (
        <div className="space-y-8">
            {/* Header & Controls */}
            <div className="flex flex-col md:flex-row gap-6 md:items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-slate-900">Matches & Results</h2>
                    <p className="text-slate-500">Track fixtures, results, and match statistics.</p>
                </div>
                <div className="flex items-center gap-2">
                    <Dialog open={isAddOpen} onOpenChange={(open: boolean) => {
                        setIsAddOpen(open);
                        if (!open) resetForm();
                    }}>
                        <DialogTrigger asChild>
                            <Button className="bg-red-600 hover:bg-red-700">
                                <Plus className="h-4 w-4 mr-2" /> Add Match
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
                            <DialogHeader>
                                <DialogTitle>{editingId ? "Edit Match" : "Add New Match"}</DialogTitle>
                                <DialogDescription>{editingId ? "Update match details." : "Enter fixture details and scoreline."}</DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-3 py-2">
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1.5">
                                        <Label>Date</Label>
                                        <Input type="date" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label>Time</Label>
                                        <Input type="time" value={formData.time} onChange={e => setFormData({ ...formData, time: e.target.value })} />
                                    </div>
                                </div>
                                <div className="grid grid-cols-4 gap-3 items-end">
                                    <div className="col-span-1 space-y-1.5">
                                        <Label>Venue</Label>
                                        <Select
                                            value={formData.isHome ? "Home" : "Away"}
                                            onValueChange={(v: string) => setFormData({ ...formData, isHome: v === "Home" })}
                                        >
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="Home">Home</SelectItem>
                                                <SelectItem value="Away">Away</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="col-span-3 space-y-1.5">
                                        <Label>Opponent</Label>
                                        <Input
                                            placeholder="Opponent Name"
                                            value={formData.opponent}
                                            onChange={e => setFormData({ ...formData, opponent: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Goalscorers</Label>
                                        <Textarea
                                            placeholder="e.g. J.Smith (2), D.Jones"
                                            value={formData.goalscorers}
                                            onChange={(e) => setFormData({ ...formData, goalscorers: e.target.value })}
                                            className="h-20"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Assists</Label>
                                        <Textarea
                                            placeholder="e.g. M.Ali, K.West"
                                            value={formData.assists}
                                            onChange={(e) => setFormData({ ...formData, assists: e.target.value })}
                                            className="h-20"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Competition</Label>
                                    <Input
                                        placeholder="League, Cup, Friendly..."
                                        value={formData.competition}
                                        onChange={e => setFormData({ ...formData, competition: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Scoreline</Label>
                                    <div className="flex items-center gap-4">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-bold text-slate-500 w-12 text-right">Home</span>
                                            <Input
                                                className="w-16 text-center font-bold text-lg"
                                                placeholder="0"
                                                value={(formData.scoreline || "").split('-')[0]?.trim() || ""}
                                                onChange={e => {
                                                    const home = e.target.value;
                                                    const away = (formData.scoreline || "").split('-')[1]?.trim() || "";
                                                    setFormData({ ...formData, scoreline: `${home}-${away}` });
                                                }}
                                            />
                                        </div>
                                        <span className="text-slate-400 font-bold">-</span>
                                        <div className="flex items-center gap-2">
                                            <Input
                                                className="w-16 text-center font-bold text-lg"
                                                placeholder="0"
                                                value={(formData.scoreline || "").split('-')[1]?.trim() || ""}
                                                onChange={e => {
                                                    const home = (formData.scoreline || "").split('-')[0]?.trim() || "";
                                                    const away = e.target.value;
                                                    setFormData({ ...formData, scoreline: `${home}-${away}` });
                                                }}
                                            />
                                            <span className="text-sm font-bold text-slate-500 w-12">Away</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Goalscorers</Label>
                                    <Textarea
                                        className="min-h-[60px]"
                                        placeholder="Comma separated (e.g. Smith, Jones)"
                                        value={formData.goalscorers || ""}
                                        onChange={e => setFormData({ ...formData, goalscorers: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Notes</Label>
                                    <Textarea
                                        className="min-h-[60px]"
                                        placeholder="Any special notes (e.g. Points adjustment)"
                                        value={formData.notes || ""}
                                        onChange={e => setFormData({ ...formData, notes: e.target.value })}
                                    />
                                </div>
                            </div>
                            <DialogFooter className="gap-2 sm:gap-0">
                                {editingId && formData.scoreline && (
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        onClick={() => setFormData({ ...formData, scoreline: "", goalscorers: "", notes: "" })}
                                        className="mr-auto text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200"
                                    >
                                        Reset to Upcoming
                                    </Button>
                                )}
                                <Button variant="outline" onClick={resetForm}>Cancel</Button>
                                <Button onClick={handleSaveMatch} className="bg-red-600 hover:bg-red-700">
                                    {editingId ? "Update Match" : "Save Match"}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2 pb-2 border-b border-slate-100">
                <Button
                    variant={filterType === "all" ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => setFilterType("all")}
                    className="rounded-full"
                >
                    All Matches
                </Button>
                <Button
                    variant={filterType === "league" ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => setFilterType("league")}
                    className="rounded-full"
                >
                    League
                </Button>
                <Button
                    variant={filterType === "cup" ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => setFilterType("cup")}
                    className="rounded-full"
                >
                    Cups
                </Button>
                <Button
                    variant={filterType === "friendly" ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => setFilterType("friendly")}
                    className="rounded-full"
                >
                    Friendlies
                </Button>
            </div>

            {/* Import Tool */}
            <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                    <div className="p-2 bg-indigo-100 rounded-full">
                        <Target className="h-5 w-5 text-indigo-600" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-indigo-900">Import Matches via Text</h3>
                        <p className="text-sm text-indigo-700">Copy & paste fixture lists from WhatsApp, FA Full-Time, or emails.</p>
                    </div>
                </div>
                <FixtureScout onImport={(newMatches) => {
                    setMatches([...matches, ...newMatches].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()));
                }} />
                <div className="h-8 w-px bg-indigo-200 hidden sm:block"></div>
                <FixtureImporter onImport={(newMatches) => {
                    setMatches([...matches, ...newMatches].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()));
                }} />
            </div>

            {/* Tabs for Fixtures / Results */}
            <Tabs defaultValue="upcoming" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="upcoming">Upcoming Fixtures ({upcomingMatches.length})</TabsTrigger>
                    <TabsTrigger value="results">Results ({pastMatches.length})</TabsTrigger>
                </TabsList>

                <TabsContent value="upcoming" className="space-y-4">
                    {upcomingMatches.length === 0 ? (
                        <div className="text-center py-12 text-slate-400 border-2 border-dashed rounded-lg bg-slate-50/50">
                            <p>No upcoming fixtures found matching filters.</p>
                        </div>
                    ) : (
                        upcomingMatches.map(match => <MatchCard key={match.id} match={match} />)
                    )}
                </TabsContent>

                <TabsContent value="results" className="space-y-4">
                    {/* Sort Control */}
                    <div className="flex justify-end mb-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="text-slate-500 text-xs gap-1"
                            onClick={() => setResultSort(resultSort === "desc" ? "asc" : "desc")}
                        >
                            <ArrowUpDown className="h-3 w-3" />
                            {resultSort === "desc" ? "Newest First" : "Oldest First"}
                        </Button>
                    </div>

                    {pastMatches.length === 0 ? (
                        <div className="text-center py-12 text-slate-400 border-2 border-dashed rounded-lg bg-slate-50/50">
                            <p>No results found matching filters.</p>
                        </div>
                    ) : (
                        pastMatches.map(match => <MatchCard key={match.id} match={match} />)
                    )}
                </TabsContent>
            </Tabs>
        </div>
    );
}
