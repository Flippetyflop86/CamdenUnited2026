"use client";

import { useState, useEffect } from "react";
import { Player, Position } from "@/types";
import { FORMATIONS, FORMATION_NAMES } from "@/lib/formations";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    Users,
    Shield,
    Search,
    AlertTriangle,
    CheckCircle2,
    Settings,
    X,
    Filter,
    FileText,
    TrendingUp,
    ChevronRight,
    Clipboard,
    Activity,
    Info,
    CalendarDays,
    Trash2
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useClub } from "@/context/club-context";
import { useAuth } from "@/context/auth-context";
import Link from "next/link";

// Mapping traditional position labels to human-readable full names
const POSITION_FULL_NAMES: Record<string, string> = {
    "GK": "Goalkeeper",
    "LB": "Left Back",
    "CB": "Centre Back",
    "RB": "Right Back",
    "LWB": "Left Wing Back",
    "RWB": "Right Wing Back",
    "CDM": "Defensive Midfielder",
    "CM": "Central Midfielder",
    "CAM": "Attacking Midfielder",
    "LM": "Left Midfielder",
    "RM": "Right Midfielder",
    "LW": "Left Winger",
    "RW": "Right Winger",
    "ST": "Striker",
    "CF": "Centre Forward"
};

// Map position keys to position category
const getPositionCategory = (pos: string): "GK" | "DEF" | "MID" | "FWD" => {
    const p = pos.toUpperCase();
    if (["GK"].includes(p)) return "GK";
    if (["CB", "RB", "LB", "DEF", "RWB", "LWB", "RM", "LM"].includes(p)) {
        if (["RM", "LM"].includes(p)) return "MID";
        return "DEF";
    }
    if (["CM", "CDM", "CAM", "MID"].includes(p)) return "MID";
    if (["ST", "CF", "RW", "LW", "FWD"].includes(p)) return "FWD";
    return "MID";
};

export default function SquadDepthPage() {
    const { settings, isLoaded: isClubLoaded } = useClub();
    const { user, role } = useAuth();
    
    // Squads & current active squad tab
    const currentSquads = settings.squads || ["First Team"];
    const [activeSquadTab, setActiveSquadTab] = useState<string>(currentSquads[0] || "First Team");

    // Formations
    const [formation, setFormation] = useState<string>("4-3-3");
    
    // Master players & state
    const [players, setPlayers] = useState<Player[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");

    // Drag-and-drop state
    const [draggedPlayerId, setDraggedPlayerId] = useState<string | null>(null);

    // Sidebar drawer details
    const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);

    // Filter states
    const [filterPosition, setFilterPosition] = useState<string>("All");
    const [filterAgeMax, setFilterAgeMax] = useState<string>("All");
    const [filterAvailability, setFilterAvailability] = useState<string>("All");
    const [filterFoot, setFilterFoot] = useState<string>("All");
    const [filterYouth, setFilterYouth] = useState<boolean>(false);
    const [filterTrialists, setFilterTrialists] = useState<boolean>(false);

    // Player position zone mappings: { [playerId]: "positionZoneKey" }
    // e.g. "GK", "CB_1", "LB", "Bench", "Injured", etc.
    const [assignments, setAssignments] = useState<Record<string, string>>({});

    // Fetch players from supabase
    const fetchPlayers = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from("players")
                .select("*")
                .eq("squad", activeSquadTab === "First Team" ? "firstTeam" : activeSquadTab === "Midweek" ? "midweek" : activeSquadTab === "Youth" ? "youth" : activeSquadTab);

            if (data) {
                const mapped: Player[] = data.map((p: any) => ({
                    id: p.id,
                    firstName: p.first_name,
                    lastName: p.last_name,
                    position: p.position as Position,
                    squadNumber: p.squad_number || 0,
                    age: p.age || 0,
                    nationality: p.nationality || "British",
                    squad: p.squad,
                    medicalStatus: p.medical_status || "Available",
                    holidayStart: p.holiday_start,
                    holidayEnd: p.holiday_end,
                    contractExpiry: p.contract_expiry || "",
                    availability: p.availability ?? true,
                    appearances: p.appearances || 0,
                    goals: p.goals || 0,
                    assists: p.assists || 0,
                    imageUrl: p.image_url,
                    notes: p.notes || "",
                    isInTrainingSquad: p.is_in_training_squad,
                    secondaryPositions: p.secondary_position ? p.secondary_position.split(",").map((s: string) => s.trim() as Position) : []
                }));
                setPlayers(mapped);
            }
        } catch (err) {
            console.error("Error fetching players:", err);
        } finally {
            setLoading(false);
        }
    };

    // Load assignments & formation from localStorage
    useEffect(() => {
        if (isClubLoaded) {
            fetchPlayers();
            
            const savedFormation = localStorage.getItem(`clubflow_squad_depth_formation_${activeSquadTab}`);
            if (savedFormation) {
                setFormation(savedFormation);
            } else {
                setFormation("4-3-3");
            }

            const savedAssignments = localStorage.getItem(`clubflow_squad_depth_assignments_${activeSquadTab}`);
            if (savedAssignments) {
                try {
                    setAssignments(JSON.parse(savedAssignments));
                } catch (e) {
                    setAssignments({});
                }
            } else {
                setAssignments({});
            }
        }
    }, [activeSquadTab, isClubLoaded]);

    // Save assignments to localStorage automatically when they change
    const saveAssignments = (newAssignments: Record<string, string>) => {
        setAssignments(newAssignments);
        localStorage.setItem(`clubflow_squad_depth_assignments_${activeSquadTab}`, JSON.stringify(newAssignments));
    };

    // Save formation selection
    const handleFormationChange = (newFormation: string) => {
        setFormation(newFormation);
        localStorage.setItem(`clubflow_squad_depth_formation_${activeSquadTab}`, newFormation);
    };

    // Drag start
    const handleDragStart = (playerId: string) => {
        setDraggedPlayerId(playerId);
    };

    // Drop handler
    const handleDrop = (zoneKey: string) => {
        if (!draggedPlayerId) return;
        const newAssignments = { ...assignments, [draggedPlayerId]: zoneKey };
        saveAssignments(newAssignments);
        setDraggedPlayerId(null);
    };

    // Reset all assignments on the current board
    const handleResetAssignments = () => {
        if (confirm("Are you sure you want to clear the current squad depth layout assignments?")) {
            saveAssignments({});
        }
    };

    // Helper helper to get custom parsed notes fields
    const getParsedNotes = (notesStr: string) => {
        let parsed = { coachNotes: "", preferredFoot: "Right", height: "", weight: "", developmentPlan: "" };
        try {
            if (notesStr && notesStr.trim().startsWith("{")) {
                parsed = { ...parsed, ...JSON.parse(notesStr) };
            } else {
                parsed.coachNotes = notesStr || "";
            }
        } catch (e) {
            parsed.coachNotes = notesStr || "";
        }
        return parsed;
    };

    // Update player custom notes / profile metadata
    const handleSavePlayerDetails = async (details: { coachNotes: string; preferredFoot: string; height: string; weight: string; developmentPlan: string; availability: boolean }) => {
        if (!selectedPlayer) return;

        const serializedNotes = JSON.stringify({
            coachNotes: details.coachNotes,
            preferredFoot: details.preferredFoot,
            height: details.height,
            weight: details.weight,
            developmentPlan: details.developmentPlan
        });

        try {
            const { error } = await supabase
                .from("players")
                .update({
                    notes: serializedNotes,
                    availability: details.availability
                })
                .eq("id", selectedPlayer.id);

            if (error) throw error;

            // Update local state
            setPlayers(prev => prev.map(p => p.id === selectedPlayer.id ? { ...p, notes: serializedNotes, availability: details.availability } : p));
            setSelectedPlayer(prev => prev ? { ...prev, notes: serializedNotes, availability: details.availability } : null);
        } catch (err: any) {
            alert("Failed to save player details: " + err.message);
        }
    };

    // Active positions on the pitch from formations configuration
    const activePositions = FORMATIONS[formation] || FORMATIONS["4-3-3"];

    // Filter players based on UI configuration
    const filteredPlayers = players.filter(p => {
        const notesObj = getParsedNotes(p.notes || "");
        
        // Search query
        const fullName = `${p.firstName} ${p.lastName}`.toLowerCase();
        if (searchQuery && !fullName.includes(searchQuery.toLowerCase())) return false;

        // Position category
        if (filterPosition !== "All") {
            const cat = getPositionCategory(p.position);
            if (cat !== filterPosition) return false;
        }

        // Age filter
        if (filterAgeMax !== "All") {
            const maxAge = parseInt(filterAgeMax);
            if (p.age > maxAge) return false;
        }

        // Availability filter
        if (filterAvailability !== "All") {
            const isAvail = filterAvailability === "Available";
            if (p.availability !== isAvail) return false;
        }

        // Preferred foot filter
        if (filterFoot !== "All" && notesObj.preferredFoot !== filterFoot) return false;

        // Youth player filter (assuming age < 20 or explicitly in notes/squad)
        if (filterYouth && p.age >= 21) return false;

        // Trialists filter (competitions/trial status inside notes or name)
        if (filterTrialists && !p.notes?.toLowerCase().includes("trial")) return false;

        return true;
    });

    // Statistics Calculations
    const totalPlayers = players.length;
    const avgAge = totalPlayers > 0 ? (players.reduce((sum, p) => sum + p.age, 0) / totalPlayers).toFixed(1) : "0.0";
    const gkCount = players.filter(p => getPositionCategory(p.position) === "GK").length;
    const defCount = players.filter(p => getPositionCategory(p.position) === "DEF").length;
    const midCount = players.filter(p => getPositionCategory(p.position) === "MID").length;
    const fwdCount = players.filter(p => getPositionCategory(p.position) === "FWD").length;

    // Positional analysis insights generator
    const getInsights = () => {
        const insights: { type: "warning" | "success" | "info"; text: string }[] = [];

        // 1. Goalkeeper cover check
        if (gkCount === 0) {
            insights.push({ type: "warning", text: "No recognized Goalkeeper in the roster." });
        } else if (gkCount === 1) {
            insights.push({ type: "warning", text: "No backup goalkeeper cover (Only 1 GK rostered)." });
        } else {
            insights.push({ type: "success", text: "Healthy Goalkeeper depth." });
        }

        // 2. Count positions based on active formation positions
        const zoneAssignments: Record<string, number> = {};
        activePositions.forEach(pos => {
            zoneAssignments[pos.label] = (zoneAssignments[pos.label] || 0) + 1;
        });

        // Let's count how many players we have assigned or naturally fit each position key
        Object.keys(zoneAssignments).forEach(label => {
            const recognizedPlayers = players.filter(p => 
                p.position.toUpperCase() === label.toUpperCase() || 
                p.secondaryPositions?.some(sp => sp.toUpperCase() === label.toUpperCase())
            );

            if (recognizedPlayers.length === 0) {
                insights.push({ type: "warning", text: `No natural coverage or backup for ${POSITION_FULL_NAMES[label] || label}.` });
            } else if (recognizedPlayers.length < zoneAssignments[label] * 2) {
                insights.push({ type: "info", text: `Thin coverage for ${POSITION_FULL_NAMES[label] || label} (${recognizedPlayers.length} cover options).` });
            } else if (recognizedPlayers.length >= zoneAssignments[label] * 4) {
                insights.push({ type: "success", text: `Excellent depth for ${POSITION_FULL_NAMES[label] || label} (${recognizedPlayers.length} cover options).` });
            }
        });

        // Overall overload checks
        if (defCount > 10) insights.push({ type: "info", text: "Overloaded defensive block (10+ Defenders)." });
        if (midCount > 12) insights.push({ type: "info", text: "High central midfield density." });

        return insights;
    };

    const insights = getInsights();

    return (
        <div className="space-y-6 text-slate-900 pb-12">
            {/* Header & Tabs */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-5">
                <div>
                    <h1 className="text-2xl font-black tracking-tight">Squad Depth Planner</h1>
                    <p className="text-xs text-slate-500 mt-1">Visualize positional backup depth, explore tactically, and find squad cover.</p>
                </div>
                
                {/* Squad Selector */}
                <div className="flex bg-slate-100 p-1 rounded-xl w-fit">
                    {currentSquads.map((sq) => (
                        <button
                            key={sq}
                            onClick={() => setActiveSquadTab(sq)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                activeSquadTab === sq ? "bg-white text-slate-950 shadow-sm" : "text-slate-500 hover:text-slate-800"
                            }`}
                        >
                            {sq}
                        </button>
                    ))}
                </div>
            </div>

            {/* Formation & Action Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-xl border shadow-xs">
                <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Formation</span>
                    <select
                        value={formation}
                        onChange={(e) => handleFormationChange(e.target.value)}
                        className="bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold py-2 px-3 focus:outline-none focus:ring-2 focus:ring-red-500"
                    >
                        {FORMATION_NAMES.map(f => (
                            <option key={f} value={f}>{f}</option>
                        ))}
                    </select>
                </div>

                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={handleResetAssignments} className="text-slate-500 hover:text-red-600">
                        <Trash2 className="h-4 w-4 mr-1.5" /> Clear Layout
                    </Button>
                </div>
            </div>

            {/* Main Layout Grid */}
            <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 items-start">
                
                {/* Left Side: Filter, Search & Unassigned Player Pool */}
                <div className="xl:col-span-1 space-y-4">
                    <Card className="border shadow-sm">
                        <CardHeader className="pb-3 flex flex-row items-center justify-between">
                            <CardTitle className="text-sm font-black flex items-center gap-1.5">
                                <Users className="h-4 w-4 text-slate-500" /> Player Registry
                            </CardTitle>
                            <Badge variant="outline">{filteredPlayers.length} Players</Badge>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* Search */}
                            <div className="relative">
                                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                                <Input
                                    placeholder="Search player..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-8 text-xs h-9 bg-slate-50"
                                />
                            </div>

                            {/* Filters collapsible panel or flat select lists */}
                            <div className="space-y-2 pt-2 border-t text-xs">
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Position</label>
                                    <select
                                        value={filterPosition}
                                        onChange={(e) => setFilterPosition(e.target.value)}
                                        className="w-full bg-slate-50 border rounded-lg p-1.5 focus:outline-none"
                                    >
                                        <option value="All">All Categories</option>
                                        <option value="GK">Goalkeepers</option>
                                        <option value="DEF">Defenders</option>
                                        <option value="MID">Midfielders</option>
                                        <option value="FWD">Forwards</option>
                                    </select>
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Preferred Foot</label>
                                        <select
                                            value={filterFoot}
                                            onChange={(e) => setFilterFoot(e.target.value)}
                                            className="w-full bg-slate-50 border rounded-lg p-1.5 focus:outline-none"
                                        >
                                            <option value="All">All</option>
                                            <option value="Right">Right</option>
                                            <option value="Left">Left</option>
                                            <option value="Both">Both</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Availability</label>
                                        <select
                                            value={filterAvailability}
                                            onChange={(e) => setFilterAvailability(e.target.value)}
                                            className="w-full bg-slate-50 border rounded-lg p-1.5 focus:outline-none"
                                        >
                                            <option value="All">All</option>
                                            <option value="Available">Available</option>
                                            <option value="Unavailable">Unavailable</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="flex gap-4 pt-2">
                                    <label className="flex items-center gap-1.5 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={filterYouth}
                                            onChange={(e) => setFilterYouth(e.target.checked)}
                                            className="rounded border-slate-300 text-red-600 focus:ring-red-500"
                                        />
                                        <span>Youth (&lt;21)</span>
                                    </label>
                                    <label className="flex items-center gap-1.5 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={filterTrialists}
                                            onChange={(e) => setFilterTrialists(e.target.checked)}
                                            className="rounded border-slate-300 text-red-600 focus:ring-red-500"
                                        />
                                        <span>Trialists</span>
                                    </label>
                                </div>
                            </div>

                            {/* Scrollable list of draggable player cards */}
                            <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                                {loading ? (
                                    <div className="text-center py-4 text-xs text-slate-400">Loading squad...</div>
                                ) : filteredPlayers.length === 0 ? (
                                    <div className="text-center py-4 text-xs text-slate-400">No players match filters.</div>
                                ) : (
                                    filteredPlayers.map(p => {
                                        const isAssigned = !!assignments[p.id];
                                        return (
                                            <div
                                                key={p.id}
                                                draggable
                                                onDragStart={() => handleDragStart(p.id)}
                                                onClick={() => {
                                                    setSelectedPlayer(p);
                                                    setIsDrawerOpen(true);
                                                }}
                                                className={`p-2 rounded-lg border text-xs flex items-center justify-between cursor-grab hover:border-slate-400 transition-all ${
                                                    isAssigned ? "bg-slate-50 border-slate-200 opacity-60" : "bg-white border-slate-200"
                                                }`}
                                            >
                                                <div className="flex items-center gap-2 overflow-hidden">
                                                    <Avatar className="h-6 w-6">
                                                        <AvatarImage src={p.imageUrl} />
                                                        <AvatarFallback className="text-[9px] bg-slate-900 text-white font-bold">
                                                            {p.firstName[0]}{p.lastName[0]}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <div className="overflow-hidden">
                                                        <p className="font-bold text-slate-800 truncate">{p.firstName} {p.lastName}</p>
                                                        <p className="text-[9px] text-slate-400">
                                                            {p.position} {p.secondaryPositions && p.secondaryPositions.length > 0 && `/ ${p.secondaryPositions.join(" / ")}`}
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-1">
                                                    <span className={`h-1.5 w-1.5 rounded-full ${p.availability ? "bg-green-500" : "bg-red-500"}`} />
                                                    {isAssigned && (
                                                        <Badge variant="secondary" className="text-[8px] px-1 py-0 scale-90">
                                                            {assignments[p.id]}
                                                        </Badge>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Stats Summary Panel */}
                    <Card className="border shadow-sm text-xs">
                        <CardHeader className="pb-2"><CardTitle className="text-sm font-black">Squad Numbers</CardTitle></CardHeader>
                        <CardContent className="grid grid-cols-2 gap-2 text-slate-600">
                            <div className="bg-slate-50 p-2 rounded-lg">
                                <span className="text-[10px] text-slate-400 uppercase font-bold block">Total Players</span>
                                <span className="text-lg font-black text-slate-800">{totalPlayers}</span>
                            </div>
                            <div className="bg-slate-50 p-2 rounded-lg">
                                <span className="text-[10px] text-slate-400 uppercase font-bold block">Average Age</span>
                                <span className="text-lg font-black text-slate-800">{avgAge} yrs</span>
                            </div>
                            <div className="col-span-2 bg-slate-50 p-2.5 rounded-lg space-y-1">
                                <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Coverage Count</span>
                                <div className="grid grid-cols-4 text-center font-bold text-[10px]">
                                    <div className="border-r"><span className="block text-slate-400">GK</span>{gkCount}</div>
                                    <div className="border-r"><span className="block text-slate-400">DEF</span>{defCount}</div>
                                    <div className="border-r"><span className="block text-slate-400">MID</span>{midCount}</div>
                                    <div><span className="block text-slate-400">FWD</span>{fwdCount}</div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Right Side: Interactive Pitch & Additional Sections */}
                <div className="xl:col-span-3 space-y-6">
                    {/* The Visual Pitch */}
                    <div className="relative bg-emerald-700 rounded-2xl overflow-hidden shadow-lg border-2 border-emerald-600/40 p-4 min-h-[480px] select-none">
                        {/* Grass Stripe Overlays */}
                        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-10">
                            {Array.from({ length: 10 }).map((_, idx) => (
                                <div key={idx} className={`h-[48px] w-full ${idx % 2 === 0 ? 'bg-black' : 'bg-transparent'}`} />
                            ))}
                        </div>

                        {/* Pitch Markings */}
                        <div className="absolute inset-4 border border-white/20 pointer-events-none">
                            <div className="absolute top-1/2 left-0 right-0 border-t border-white/20" />
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 border border-white/20 rounded-full" />
                            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-20 border border-white/20 border-t-0" />
                            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-48 h-20 border border-white/20 border-b-0" />
                        </div>

                        {/* Visual Position Nodes on the Pitch */}
                        <div className="absolute inset-0 p-8 flex flex-col justify-between">
                            {activePositions.map((pos, index) => {
                                const zoneKey = `${pos.label}_${pos.number}`;
                                // Get players assigned to this zone
                                const assignedPlayers = players.filter(p => assignments[p.id] === zoneKey);

                                return (
                                    <div
                                        key={zoneKey}
                                        onDragOver={(e) => e.preventDefault()}
                                        onDrop={() => handleDrop(zoneKey)}
                                        className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center group"
                                        style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
                                    >
                                        {/* Zone Title / Drop Zone Indicator */}
                                        <div className="px-2 py-0.5 rounded-full bg-slate-950/80 border border-white/20 text-[9px] font-black text-white shadow-md select-none">
                                            {pos.label}
                                        </div>

                                        {/* Placed Player Cards or empty target */}
                                        <div className="min-h-[50px] min-w-[70px] mt-1.5 flex flex-col items-center justify-center rounded-lg border border-dashed border-white/20 bg-white/5 backdrop-blur-xs p-1 gap-1">
                                            {assignedPlayers.length === 0 ? (
                                                <span className="text-[8px] text-white/40 italic">Drop here</span>
                                            ) : (
                                                assignedPlayers.map(ap => (
                                                    <div
                                                        key={ap.id}
                                                        draggable
                                                        onDragStart={() => handleDragStart(ap.id)}
                                                        onClick={() => {
                                                            setSelectedPlayer(ap);
                                                            setIsDrawerOpen(true);
                                                        }}
                                                        className="flex items-center gap-1 bg-slate-900 border border-white/20 text-white rounded px-1.5 py-0.5 text-[8px] font-medium shadow-sm hover:border-red-400 transition-colors cursor-grab w-full max-w-[90px] overflow-hidden"
                                                    >
                                                        <span className={`h-1 w-1 rounded-full shrink-0 ${ap.availability ? 'bg-green-500' : 'bg-red-500'}`} />
                                                        <span className="truncate flex-1">{ap.firstName[0]}. {ap.lastName}</span>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Bottom Area: Bench and Special Status Placements */}
                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                        
                        {/* Bench Drop Zone (Col span 3) */}
                        <div
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={() => handleDrop("Bench")}
                            className="lg:col-span-3 bg-slate-900 border border-slate-800 rounded-2xl p-4 text-white space-y-3"
                        >
                            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                                <h3 className="text-xs font-black tracking-widest uppercase text-slate-400">Bench / Reserves</h3>
                                <Badge variant="secondary" className="bg-slate-800 text-white border border-slate-700 text-[9px]">
                                    {players.filter(p => assignments[p.id] === "Bench").length} Placed
                                </Badge>
                            </div>

                            <div className="flex flex-wrap gap-2 min-h-[64px] items-center p-2 rounded-xl bg-slate-950/40 border border-slate-800/80">
                                {players.filter(p => assignments[p.id] === "Bench").length === 0 ? (
                                    <p className="text-xs text-slate-500 italic w-full text-center py-4">Drag and drop players here to add to the Bench pool</p>
                                ) : (
                                    players.filter(p => assignments[p.id] === "Bench").map(p => (
                                        <div
                                            key={p.id}
                                            draggable
                                            onDragStart={() => handleDragStart(p.id)}
                                            onClick={() => {
                                                setSelectedPlayer(p);
                                                setIsDrawerOpen(true);
                                            }}
                                            className="flex items-center gap-1.5 bg-slate-850 hover:bg-slate-800 border border-slate-700 rounded-lg p-1.5 text-xs cursor-grab"
                                        >
                                            <Avatar className="h-5 w-5">
                                                <AvatarImage src={p.imageUrl} />
                                                <AvatarFallback className="text-[8px] bg-slate-900 text-white font-bold">
                                                    {p.firstName[0]}{p.lastName[0]}
                                                </AvatarFallback>
                                            </Avatar>
                                            <span className="font-bold">{p.lastName}</span>
                                            <span className="text-[9px] text-slate-400 font-medium">({p.position})</span>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Insights Sidebar (Col span 1) */}
                        <div className="lg:col-span-1 bg-white border rounded-2xl p-4 shadow-sm space-y-3">
                            <h3 className="text-xs font-black uppercase text-slate-500 tracking-wider">Squad Insights</h3>
                            <div className="space-y-2 max-h-[140px] overflow-y-auto pr-1">
                                {insights.map((insight, idx) => (
                                    <div key={idx} className="flex items-start gap-1.5 text-[11px] leading-tight">
                                        {insight.type === "warning" ? (
                                            <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0 mt-0.5" />
                                        ) : insight.type === "success" ? (
                                            <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0 mt-0.5" />
                                        ) : (
                                            <Info className="h-3.5 w-3.5 text-slate-500 shrink-0 mt-0.5" />
                                        )}
                                        <span className="text-slate-650 font-medium">{insight.text}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Planning Columns Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                        {["Injured", "Suspended", "Unavailable", "Loan", "Youth Players", "Trialists"].map((statusKey) => {
                            const columnPlayers = players.filter(p => assignments[p.id] === statusKey);
                            return (
                                <div
                                    key={statusKey}
                                    onDragOver={(e) => e.preventDefault()}
                                    onDrop={() => handleDrop(statusKey)}
                                    className="bg-slate-50 border rounded-xl p-3 flex flex-col gap-2 min-h-[120px] transition-colors hover:border-slate-350"
                                >
                                    <div className="flex items-center justify-between border-b pb-1">
                                        <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">{statusKey}</span>
                                        <Badge variant="secondary" className="text-[9px] px-1 py-0 scale-90">{columnPlayers.length}</Badge>
                                    </div>
                                    <div className="flex flex-col gap-1.5 overflow-y-auto max-h-[160px] flex-1">
                                        {columnPlayers.length === 0 ? (
                                            <span className="text-[9px] text-slate-400 italic block text-center mt-4">Drop here</span>
                                        ) : (
                                            columnPlayers.map(p => (
                                                <div
                                                    key={p.id}
                                                    draggable
                                                    onDragStart={() => handleDragStart(p.id)}
                                                    onClick={() => {
                                                        setSelectedPlayer(p);
                                                        setIsDrawerOpen(true);
                                                    }}
                                                    className="flex items-center gap-1.5 bg-white border rounded p-1 text-[10px] font-bold hover:border-slate-400 cursor-grab truncate"
                                                >
                                                    <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${p.availability ? "bg-green-500" : "bg-red-500"}`} />
                                                    <span className="truncate">{p.firstName[0]}. {p.lastName}</span>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Quick Side Detail Panel */}
            {isDrawerOpen && selectedPlayer && (
                <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex justify-end animate-in fade-in duration-150">
                    <div className="bg-white w-full max-w-md h-full shadow-2xl p-6 overflow-y-auto space-y-6 flex flex-col justify-between animate-in slide-in-from-right duration-200">
                        <div className="space-y-6">
                            {/* Drawer Header */}
                            <div className="flex justify-between items-start border-b pb-4">
                                <div className="flex items-center gap-3">
                                    <Avatar className="h-12 w-12 border-2 border-slate-100">
                                        <AvatarImage src={selectedPlayer.imageUrl} />
                                        <AvatarFallback className="bg-slate-900 text-white font-bold text-sm">
                                            {selectedPlayer.firstName[0]}{selectedPlayer.lastName[0]}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <h2 className="text-lg font-black tracking-tight text-slate-900">{selectedPlayer.firstName} {selectedPlayer.lastName}</h2>
                                        <p className="text-xs text-slate-500 font-medium">Position: {selectedPlayer.position}</p>
                                    </div>
                                </div>
                                <button onClick={() => setIsDrawerOpen(false)} className="p-1 hover:bg-slate-100 rounded-lg">
                                    <X className="h-5 w-5 text-slate-400" />
                                </button>
                            </div>

                            {/* Player Info Attributes */}
                            <div className="grid grid-cols-2 gap-4 text-xs">
                                <div>
                                    <span className="text-slate-400 font-bold uppercase block text-[9px]">Age</span>
                                    <span className="font-bold text-slate-800">{selectedPlayer.age} years old</span>
                                </div>
                                <div>
                                    <span className="text-slate-400 font-bold uppercase block text-[9px]">Nationality</span>
                                    <span className="font-bold text-slate-800">{selectedPlayer.nationality || "British"}</span>
                                </div>
                                <div>
                                    <span className="text-slate-400 font-bold uppercase block text-[9px]">Availability Status</span>
                                    <select
                                        value={selectedPlayer.availability ? "Available" : "Unavailable"}
                                        onChange={(e) => handleSavePlayerDetails({
                                            ...getParsedNotes(selectedPlayer.notes || ""),
                                            availability: e.target.value === "Available"
                                        })}
                                        className="mt-1 bg-slate-50 border rounded-lg p-1.5 focus:outline-none w-full"
                                    >
                                        <option value="Available">Available</option>
                                        <option value="Unavailable">Unavailable</option>
                                    </select>
                                </div>
                                <div>
                                    <span className="text-slate-400 font-bold uppercase block text-[9px]">Preferred Foot</span>
                                    <select
                                        value={getParsedNotes(selectedPlayer.notes || "").preferredFoot}
                                        onChange={(e) => handleSavePlayerDetails({
                                            ...getParsedNotes(selectedPlayer.notes || ""),
                                            preferredFoot: e.target.value,
                                            availability: selectedPlayer.availability
                                        })}
                                        className="mt-1 bg-slate-50 border rounded-lg p-1.5 focus:outline-none w-full"
                                    >
                                        <option value="Right">Right</option>
                                        <option value="Left">Left</option>
                                        <option value="Both">Both</option>
                                    </select>
                                </div>
                            </div>

                            {/* Physical Dimensions */}
                            <div className="grid grid-cols-2 gap-4 text-xs pt-4 border-t">
                                <div>
                                    <span className="text-slate-400 font-bold uppercase block text-[9px]">Height (optional)</span>
                                    <input
                                        type="text"
                                        placeholder="e.g. 182cm"
                                        value={getParsedNotes(selectedPlayer.notes || "").height}
                                        onChange={(e) => handleSavePlayerDetails({
                                            ...getParsedNotes(selectedPlayer.notes || ""),
                                            height: e.target.value,
                                            availability: selectedPlayer.availability
                                        })}
                                        className="mt-1 w-full bg-slate-50 border rounded-lg p-1.5 focus:outline-none"
                                    />
                                </div>
                                <div>
                                    <span className="text-slate-400 font-bold uppercase block text-[9px]">Weight (optional)</span>
                                    <input
                                        type="text"
                                        placeholder="e.g. 78kg"
                                        value={getParsedNotes(selectedPlayer.notes || "").weight}
                                        onChange={(e) => handleSavePlayerDetails({
                                            ...getParsedNotes(selectedPlayer.notes || ""),
                                            weight: e.target.value,
                                            availability: selectedPlayer.availability
                                        })}
                                        className="mt-1 w-full bg-slate-50 border rounded-lg p-1.5 focus:outline-none"
                                    />
                                </div>
                            </div>

                            {/* Coach Notes */}
                            <div className="space-y-1.5 pt-4 border-t text-xs">
                                <span className="text-slate-400 font-bold uppercase block text-[9px]">Coach Notes</span>
                                <textarea
                                    rows={3}
                                    placeholder="Write notes about tactical role, flexibility..."
                                    value={getParsedNotes(selectedPlayer.notes || "").coachNotes}
                                    onChange={(e) => handleSavePlayerDetails({
                                        ...getParsedNotes(selectedPlayer.notes || ""),
                                        coachNotes: e.target.value,
                                        availability: selectedPlayer.availability
                                    })}
                                    className="w-full bg-slate-50 border rounded-lg p-2 focus:outline-none text-xs"
                                />
                            </div>

                            {/* Development Plan */}
                            <div className="space-y-1.5 pt-4 border-t text-xs">
                                <span className="text-slate-400 font-bold uppercase block text-[9px]">Development Plan</span>
                                <textarea
                                    rows={3}
                                    placeholder="Outline areas for improvement or next season goals..."
                                    value={getParsedNotes(selectedPlayer.notes || "").developmentPlan}
                                    onChange={(e) => handleSavePlayerDetails({
                                        ...getParsedNotes(selectedPlayer.notes || ""),
                                        developmentPlan: e.target.value,
                                        availability: selectedPlayer.availability
                                    })}
                                    className="w-full bg-slate-50 border rounded-lg p-2 focus:outline-none text-xs"
                                />
                            </div>
                        </div>

                        {/* View Full Profile link */}
                        <div className="pt-4 border-t">
                            <Button asChild className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2 rounded-lg text-xs">
                                <Link href={`/squad/${selectedPlayer.id}`}>
                                    View Full Profile
                                </Link>
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
