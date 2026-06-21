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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/lib/supabase";
import { useClub } from "@/context/club-context";
import { RefreshCw } from "lucide-react";
import { MatchStatsDialog } from "@/components/matches/match-stats-dialog";

export default function MatchesPage() {
    const [matches, setMatches] = useState<Match[]>([]);
    const [leagueTeams, setLeagueTeams] = useState<any[]>([]);
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const { settings, updateSettings } = useClub();
    const [isSyncing, setIsSyncing] = useState(false);
    const [isEditingUrl, setIsEditingUrl] = useState(false);
    const [tempUrl, setTempUrl] = useState("");

    const getCurrentSeasonStr = () => {
        const d = new Date();
        const year = d.getFullYear();
        const month = d.getMonth(); // 0 = Jan, 5 = Jun
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

    // UI State
    const [filterType, setFilterType] = useState<"all" | "league" | "cup" | "friendly">("all");
    const [seasonFilter, setSeasonFilter] = useState<string>("26/27");
    const [resultSort, setResultSort] = useState<"desc" | "asc">("desc"); // desc = Newest First

    // Form State
    const [formData, setFormData] = useState<Omit<Match, "id" | "result">>({
        date: "",
        time: "15:00",
        opponent: "",
        isHome: true,
        competition: "League Match",
        scoreline: "",
        goalscorers: "",
        assists: "",
        yellow_cards: "",
        red_cards: "",
        notes: "",
        surface: "4G",
        location: ""
    });

    // ... (keep state) ...

    // Load Matches and League Teams from Supabase
    useEffect(() => {
        fetchMatches();
        fetchLeagueTeams();

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

    async function fetchLeagueTeams() {
        const { data } = await supabase.from("league_teams").select("*");
        if (data) setLeagueTeams(data);
    }

    async function fetchMatches() {
        const { data, error } = await supabase.from("matches").select("*");
        if (error) {
            console.error("Error fetching matches:", error.message || error);
            return;
        }

        const mapped: Match[] = data.map((m: any) => {
            const locationMatch = m.notes ? m.notes.match(/\[Location: (.*?)\]/) : null;
            const location = locationMatch ? locationMatch[1] : "";

            const surfaceMatch = m.notes ? m.notes.match(/\[Surface: (.*?)\]/) : null;
            const surface = surfaceMatch ? surfaceMatch[1] : "4G";

            let cleanNotes = m.notes || "";
            cleanNotes = cleanNotes.replace(/\[Location: .*?\]\n?/, "");
            cleanNotes = cleanNotes.replace(/\[Surface: .*?\]\n?/, "").trim();
            
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
                yellow_cards: m.yellow_cards,
                red_cards: m.red_cards,
                notes: cleanNotes,
                surface: surface,
                location: location
            };
        });

        setMatches(mapped);
    }

    const handleSaveMatch = async () => {
        if (!formData.opponent || !formData.date) return;

        let cleanScoreline = formData.scoreline;
        if (cleanScoreline && cleanScoreline.includes('-')) {
            const parts = cleanScoreline.split('-');
            if (parts[0].trim() === "" && parts[1].trim() === "") {
                cleanScoreline = "";
            } else {
                const home = parts[0].trim() || "0";
                const away = parts[1].trim() || "0";
                cleanScoreline = `${home} - ${away}`;
            }
        }

        const result = determineResult(cleanScoreline, formData.isHome);
        const isNew = !editingId;

        // Build combined metadata in the notes column
        const locationPrefix = `[Location: ${formData.location || ""}]`;
        const surfacePrefix = `[Surface: ${formData.surface || "4G"}]`;
        const combinedNotes = `${locationPrefix}${surfacePrefix}\n${formData.notes || ""}`.trim();

        const payload = {
            date: formData.date,
            time: formData.time,
            opponent: formData.opponent,
            is_home: formData.isHome,
            competition: formData.competition,
            scoreline: cleanScoreline,
            result: result,
            goalscorers: formData.goalscorers,
            assists: formData.assists,
            yellow_cards: formData.yellow_cards,
            red_cards: formData.red_cards,
            notes: combinedNotes
        };

        try {
            if (isNew) {
                const { error } = await supabase.from("matches").insert([payload]);
                if (error) throw error;
            } else {
                const { error } = await supabase.from("matches").update(payload).eq("id", editingId);
                if (error) throw error;
            }

            // Explicitly fetch matches to ensure the screen updates instantly
            await fetchMatches();
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
            yellow_cards: match.yellow_cards || "",
            red_cards: match.red_cards || "",
            notes: match.notes || "",
            surface: match.surface || "4G",
            location: match.location || ""
        });
        setEditingId(match.id);
        setIsAddOpen(true);
    };

    const handleDeleteMatch = async (id: string) => {
        if (!confirm("Are you sure you want to delete this match?")) return;
        
        // Optimistically remove from UI instantly
        setMatches(prev => prev.filter(m => m.id !== id));
        
        try {
            const { error } = await supabase.from('matches').delete().eq('id', id);
            if (error) {
                // Revert on error
                fetchMatches();
                throw error;
            }
        } catch (e: any) {
            alert("Failed to delete match: " + e.message);
        }
    };

    const handleSyncFixtures = async () => {
        if (!settings.leagueUrl) {
            alert("Please set your League URL in the Club Settings (Settings -> League Integration) first.");
            return;
        }

        setIsSyncing(true);
        try {
            const res = await fetch('/api/sync-fixtures', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: settings.leagueUrl, clubName: settings.name })
            });

            const data = await res.json();
            
            if (data.success && data.matches.length > 0) {
                // Upsert logic: For each scraped match, check if it exists by Date + Opponent
                let hasError = false;
                for (const match of data.matches) {
                    const { data: existing } = await supabase
                        .from('matches')
                        .select('id')
                        .eq('date', match.date)
                        .eq('opponent', match.opponent)
                        .single();

                    if (existing) {
                        // Update existing match result
                        const { error } = await supabase
                            .from('matches')
                            .update({
                                time: match.time,
                                is_home: match.is_home,
                                result: match.result,
                                scoreline: match.scoreline,
                                competition: match.competition
                            })
                            .eq('id', existing.id);
                        if (error) { alert("Failed to sync match: " + error.message); hasError = true; break; }
                    } else {
                        // Insert new match
                        const { error } = await supabase
                            .from('matches')
                            .insert({
                                date: match.date,
                                time: match.time,
                                opponent: match.opponent,
                                is_home: match.is_home,
                                competition: match.competition,
                                result: match.result,
                                scoreline: match.scoreline,
                                notes: match.notes
                            });
                        if (error) { alert("Failed to insert match: " + error.message); hasError = true; break; }
                    }
                }
                
                if (!hasError) {
                    alert(`Successfully synced ${data.matches.length} fixtures!`);
                    fetchMatches();
                }
            } else if (data.success) {
                alert("No fixtures found for your club on that page. Make sure your Club Name matches exactly.");
            } else {
                alert("Sync failed: " + data.error);
            }
        } catch (err: any) {
            alert("Error connecting to sync server: " + err.message);
        } finally {
            setIsSyncing(false);
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
            competition: "League Match",
            scoreline: "",
            goalscorers: "",
            assists: "",
            yellow_cards: "",
            red_cards: "",
            notes: "",
            surface: "4G",
            location: ""
        });
    };

    const determineResult = (score?: string, isHome?: boolean): "Win" | "Loss" | "Draw" | "Pending" | undefined => {
        if (!score) return "Pending";
        const parts = score.split(/[-:]/);
        if (parts.length !== 2) return "Pending";

        const homeStr = parts[0].trim() || "0";
        const awayStr = parts[1].trim() || "0";
        
        const homeScore = parseInt(homeStr);
        const awayScore = parseInt(awayStr);

        if (isNaN(homeScore) || isNaN(awayScore)) return "Pending";
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
    const getSeasonFromDate = (dateString: string) => {
        if (!dateString) return getCurrentSeasonStr();
        const d = new Date(dateString);
        if (isNaN(d.getTime())) return getCurrentSeasonStr();
        const year = d.getFullYear();
        const month = d.getMonth(); // 0-11, 5 is June
        if (month >= 5) {
            return `${year.toString().slice(-2)}/${(year + 1).toString().slice(-2)}`;
        } else {
            return `${(year - 1).toString().slice(-2)}/${year.toString().slice(-2)}`;
        }
    };

    const availableSeasons = Array.from(new Set([...matches.map(m => getSeasonFromDate(m.date)), getCurrentSeasonStr(), getNextSeasonStr()])).sort().reverse();

    const getCompetitionType = (comp: string): "league" | "cup" | "friendly" => {
        const lower = comp.toLowerCase();
        if (lower.includes("cup") || lower.includes("trophy") || lower.includes("shield")) return "cup";
        if (lower.includes("friendly")) return "friendly";
        return "league";
    };

    const filteredMatches = matches.filter(match => {
        if (seasonFilter !== "All" && getSeasonFromDate(match.date) !== seasonFilter) return false;
        
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

    const MatchCard = ({ match, isPast }: { match: Match, isPast?: boolean }) => (
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
                    {!isPast && <MatchStatsDialog matchId={match.id} matchDate={match.date} opponent={match.opponent} />}
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
                        <div className="text-2xl font-black text-slate-900 tracking-tight flex items-center justify-center min-w-[80px]">
                            {match.scoreline ? (
                                match.scoreline.includes('-') ? (
                                    <div className="flex items-center gap-2">
                                        <span>{match.scoreline.split('-')[0].trim() || "0"}</span>
                                        <span className="text-slate-300">-</span>
                                        <span>{match.scoreline.split('-')[1].trim() || "0"}</span>
                                    </div>
                                ) : match.scoreline
                            ) : "v"}
                        </div>
                        {match.result && (
                            <Badge variant="outline" className={`mt-1 text-[10px] uppercase px-2 py-0 ${getResultColor(match.result)}`}>
                                {match.result}
                            </Badge>
                        )}
                        {match.location && (
                            <span className="text-xs text-slate-500 mt-1.5 flex items-center justify-center gap-1 bg-slate-100/80 px-2 py-0.5 rounded-full font-medium">
                                <MapPin className="h-3 w-3 text-slate-400 shrink-0" /> {match.location}
                            </span>
                        )}
                    </div>

                    {/* Away Team */}
                    <div className="flex-1 flex items-center justify-start gap-4 text-left">
                        {!match.isHome && <span className="text-xs px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded">A</span>}
                        <span className={`font-bold text-lg flex items-center gap-2 ${!match.isHome ? 'text-slate-900' : 'text-slate-500'}`}>
                            {(!match.isHome && leagueTeams.find(t => t.name === match.opponent)?.badge_url) && (
                                <img src={leagueTeams.find(t => t.name === match.opponent)?.badge_url} alt="Badge" className="h-6 w-6 object-contain" />
                            )}
                            {!match.isHome ? "Camden United" : match.opponent}
                            {(match.isHome && leagueTeams.find(t => t.name === match.opponent)?.badge_url) && (
                                <img src={leagueTeams.find(t => t.name === match.opponent)?.badge_url} alt="Badge" className="h-6 w-6 object-contain" />
                            )}
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
            {isPast && (
                <div className="p-4 bg-slate-50 border-t">
                    <MatchStatsDialog matchId={match.id} matchDate={match.date} opponent={match.opponent} variant="full" />
                </div>
            )}
        </Card>
    );

    return (
        <div className="space-y-8">
            {/* Header & Controls */}
            <div className="flex flex-col md:flex-row gap-6 md:items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-slate-900">Fixtures & Results</h2>
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
                                <div className="space-y-1.5">
                                    <Label>Location / Venue Address</Label>
                                    <Input
                                        placeholder="e.g. Market Road Pitches, N7 9PL"
                                        value={formData.location || ""}
                                        onChange={e => setFormData({ ...formData, location: e.target.value })}
                                    />
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
                                            list="league-teams-list"
                                            placeholder="Select or type opponent name"
                                            value={formData.opponent}
                                            onChange={e => setFormData({ ...formData, opponent: e.target.value })}
                                        />
                                        <datalist id="league-teams-list">
                                            {leagueTeams.map(team => (
                                                <option key={team.id} value={team.name} />
                                            ))}
                                        </datalist>
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
                                    <div className="space-y-2">
                                        <Label>Yellow Cards</Label>
                                        <Textarea
                                            placeholder="e.g. J.Smith, P.Maldini"
                                            value={formData.yellow_cards}
                                            onChange={(e) => setFormData({ ...formData, yellow_cards: e.target.value })}
                                            className="h-16"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Red Cards</Label>
                                        <Textarea
                                            placeholder="e.g. S.Ramos"
                                            value={formData.red_cards}
                                            onChange={(e) => setFormData({ ...formData, red_cards: e.target.value })}
                                            className="h-16"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Competition</Label>
                                    <Select
                                        value={formData.competition}
                                        onValueChange={(v: string) => setFormData({ ...formData, competition: v })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select Competition" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="League Match">League Match</SelectItem>
                                            <SelectItem value="Alec Smith Premier Division Cup">Alec Smith Premier Division Cup</SelectItem>
                                            <SelectItem value="Middlesex Cup">Middlesex Cup</SelectItem>
                                            <SelectItem value="Friendly">Friendly</SelectItem>
                                            <SelectItem value="Trial Match">Trial Match</SelectItem>
                                            {/* Legacy Support for older fixtures like "Premier Division" */}
                                            {formData.competition && !["League Match", "Alec Smith Premier Division Cup", "Middlesex Cup", "Friendly", "Trial Match"].includes(formData.competition) && (
                                                <SelectItem value={formData.competition}>{formData.competition}</SelectItem>
                                            )}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Surface</Label>
                                    <Select
                                        value={formData.surface || "4G"}
                                        onValueChange={(v) => setFormData({ ...formData, surface: v as "4G" | "Grass" })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select Surface" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Grass">Grass</SelectItem>
                                            <SelectItem value="4G">4G</SelectItem>
                                        </SelectContent>
                                    </Select>
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
                                        variant="outline"
                                        onClick={() => setFormData({ ...formData, scoreline: "", goalscorers: "", assists: "", yellow_cards: "", red_cards: "", notes: "" })}
                                        className="h-8 text-xs text-slate-500 bg-amber-50 hover:bg-amber-100 border border-amber-200 mr-auto"
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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-100">
                <div className="flex flex-wrap items-center gap-2">
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
                
                <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-slate-500 hidden sm:inline-block">Season:</span>
                    <Select value={seasonFilter} onValueChange={setSeasonFilter}>
                        <SelectTrigger className="h-9 w-[160px] text-sm bg-white border-slate-200 shadow-sm font-medium">
                            <SelectValue placeholder="Select Season" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="All">All Seasons</SelectItem>
                            {availableSeasons.map(season => (
                                <SelectItem key={season} value={season}>20{season.split('/')[0]}/20{season.split('/')[1]}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Import Tool */}
            <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                    <div className="p-2 bg-indigo-100 rounded-full">
                        <Target className="h-5 w-5 text-indigo-600" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-indigo-900">League Integration</h3>
                        <p className="text-sm text-indigo-700">Sync directly with your live league website.</p>
                    </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 items-center w-full sm:w-auto">
                    {(!settings.leagueUrl || isEditingUrl) ? (
                        <div className="flex flex-1 sm:flex-none gap-2 w-full">
                            <Input 
                                placeholder="Paste FA Full-Time URL..." 
                                value={tempUrl} 
                                onChange={e => setTempUrl(e.target.value)}
                                className="w-full sm:w-64 bg-white border-indigo-200"
                            />
                            <Button 
                                onClick={() => {
                                    if (tempUrl.trim()) {
                                        updateSettings({ leagueUrl: tempUrl.trim() });
                                        setIsEditingUrl(false);
                                    }
                                }}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white shrink-0"
                            >
                                Save
                            </Button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                            <Button variant="ghost" size="sm" onClick={() => { setTempUrl(settings.leagueUrl!); setIsEditingUrl(true); }} className="text-indigo-600 hover:text-indigo-800 hover:bg-indigo-100 hidden sm:flex">
                                Edit URL
                            </Button>
                            <Button 
                                onClick={handleSyncFixtures} 
                                disabled={isSyncing}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white flex-1 sm:flex-none"
                            >
                                <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? "animate-spin" : ""}`} />
                                {isSyncing ? "Syncing..." : "Sync from League URL"}
                            </Button>
                        </div>
                    )}
                </div>
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
                        upcomingMatches.map(match => <MatchCard key={match.id} match={match} isPast={false} />)
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
                        pastMatches.map(match => <MatchCard key={match.id} match={match} isPast={true} />)
                    )}
                </TabsContent>
            </Tabs>
        </div>
    );
}
