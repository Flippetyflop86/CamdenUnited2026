"use client";

import { useState, useEffect } from "react";
import { Player, Position } from "@/types";
import { FORMATIONS, FORMATION_NAMES } from "@/lib/formations";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    Users,
    Search,
    AlertTriangle,
    CheckCircle2,
    X,
    Trash2,
    AlertCircle,
    Info
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useClub } from "@/context/club-context";
import { useAuth } from "@/context/auth-context";
import Link from "next/link";

const POSITION_FULL_NAMES: Record<string, string> = {
    "GK": "Goalkeeper",
    "LB": "Left Back",
    "CB": "Centre Back",
    "LCB": "Left Centre Back",
    "RCB": "Right Centre Back",
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

const getShortPosition = (pos: string): string => {
    const p = (pos || "").trim().toLowerCase();
    if (p === "goalkeeper" || p === "gk") return "GK";
    if (p === "centre back" || p === "center back" || p === "cb") return "CB";
    if (p === "left centre back" || p === "lcb") return "LCB";
    if (p === "right centre back" || p === "rcb") return "RCB";
    if (p === "left back" || p === "lb") return "LB";
    if (p === "right back" || p === "rb") return "RB";
    if (p === "left wing back" || p === "lwb") return "LWB";
    if (p === "right wing-back" || p === "rwb") return "RWB";
    if (p === "defensive midfielder" || p === "cdm") return "CDM";
    if (p === "central midfielder" || p === "cm") return "CM";
    if (p === "attacking midfielder" || p === "cam") return "CAM";
    if (p === "left midfielder" || p === "lm") return "LM";
    if (p === "right midfielder" || p === "rm") return "RM";
    if (p === "left winger" || p === "left wing" || p === "lw") return "LW";
    if (p === "right winger" || p === "right wing" || p === "rw") return "RW";
    if (p === "striker" || p === "forward" || p === "st") return "ST";
    if (p === "centre forward" || p === "cf") return "CF";
    return "CM"; // default fallback
};

const getPositionCategory = (pos: string): "GK" | "DEF" | "MID" | "FWD" => {
    const p = getShortPosition(pos);
    if (p === "GK") return "GK";
    if (["CB", "LCB", "RCB", "RB", "LB", "RWB", "LWB"].includes(p)) return "DEF";
    if (["CM", "CDM", "CAM", "RM", "LM"].includes(p)) return "MID";
    if (["ST", "CF", "RW", "LW"].includes(p)) return "FWD";
    return "MID";
};

export default function SquadDepthPage() {
    const { settings, isLoaded: isClubLoaded } = useClub();
    
    const currentSquads = settings.squads || ["First Team"];
    const [activeSquadTab, setActiveSquadTab] = useState<string>(currentSquads[0] || "First Team");
    const [formation, setFormation] = useState<string>("4-3-3");
    
    const [players, setPlayers] = useState<Player[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
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

    // Assignments map: { [playerId]: "zoneKey" }
    const [assignments, setAssignments] = useState<Record<string, string>>({});

    // Fetch players from supabase
    const fetchPlayers = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase.from("players").select("*");

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

                const filteredBySquad = mapped.filter(p => {
                    const playerSquads = Array.isArray(p.squad) 
                        ? p.squad 
                        : typeof p.squad === "string" 
                        ? (p.squad.startsWith("[") ? JSON.parse(p.squad) : [p.squad])
                        : [p.squad];
                    
                    return activeSquadTab === "All" || playerSquads.some((s: string) => {
                        const squadClean = (s || "").toLowerCase().replace(/[\s-_]+/g, '');
                        const tabClean = activeSquadTab.toLowerCase().replace(/[\s-_]+/g, '');
                        return squadClean === tabClean;
                    });
                });

                setPlayers(filteredBySquad);
            }
        } catch (err) {
            console.error("Error fetching players:", err);
        } finally {
            setLoading(false);
        }
    };

    // Load assignments & formation
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

    const saveAssignments = (newAssignments: Record<string, string>) => {
        setAssignments(newAssignments);
        localStorage.setItem(`clubflow_squad_depth_assignments_${activeSquadTab}`, JSON.stringify(newAssignments));
    };

    const handleFormationChange = (newFormation: string) => {
        setFormation(newFormation);
        localStorage.setItem(`clubflow_squad_depth_formation_${activeSquadTab}`, newFormation);
    };

    const handleDragStart = (playerId: string) => {
        setDraggedPlayerId(playerId);
    };

    const handleDrop = (zoneKey: string) => {
        if (!draggedPlayerId) return;
        const newAssignments = { ...assignments, [draggedPlayerId]: zoneKey };
        saveAssignments(newAssignments);
        setDraggedPlayerId(null);
    };

    const handleResetAssignments = () => {
        if (confirm("Are you sure you want to clear current drag positioning overrides?")) {
            saveAssignments({});
        }
    };

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

    // Calculate player age dynamically from DOB or fall back to age column
    const getPlayerAge = (p: Player) => {
        if (p.dateOfBirth) {
            const birthDate = new Date(p.dateOfBirth);
            const today = new Date();
            if (!isNaN(birthDate.getTime())) {
                let age = today.getFullYear() - birthDate.getFullYear();
                const m = today.getMonth() - birthDate.getMonth();
                if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
                    age--;
                }
                return age;
            }
        }
        return p.age || 25;
    };

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

            setPlayers(prev => prev.map(p => p.id === selectedPlayer.id ? { ...p, notes: serializedNotes, availability: details.availability } : p));
            setSelectedPlayer(prev => prev ? { ...prev, notes: serializedNotes, availability: details.availability } : null);
        } catch (err: any) {
            alert("Failed to save player details: " + err.message);
        }
    };

    const activePositions = FORMATIONS[formation] || FORMATIONS["4-3-3"];

    // Find default visual zone for a player with round-robin distribution and LCB/RCB mapping
    const getPlayerZone = (p: Player, squadPlayers: Player[]) => {
        if (assignments[p.id]) return assignments[p.id];
        
        // Out-of-action default zones
        if (p.medicalStatus === "Injured") return "Injured";
        if (p.medicalStatus === "Suspended") return "Suspended";
        if (p.medicalStatus === "Holiday" || p.medicalStatus === "Unavailable") return "Unavailable";

        const shortPos = getShortPosition(p.position);

        // Find matching zones in active formation
        let matchingZones = activePositions.filter(pos => {
            const zLabel = pos.label.toUpperCase();
            if (shortPos === "LCB" || shortPos === "RCB" || shortPos === "CB") {
                return zLabel === "CB";
            }
            if (shortPos === "ST" || shortPos === "CF") {
                return zLabel === "ST" || zLabel === "CF";
            }
            if (shortPos === "CM" || shortPos === "CDM" || shortPos === "CAM") {
                return zLabel === "CM" || zLabel === "CDM" || zLabel === "CAM";
            }
            return zLabel === shortPos;
        });

        if (matchingZones.length === 0) return null;

        // Sort left-to-right (x ascending)
        matchingZones = [...matchingZones].sort((a, b) => a.x - b.x);

        // Map Left Centre Back directly to leftmost zone
        if (shortPos === "LCB" && matchingZones.length > 1) {
            const z = matchingZones[0];
            return `${z.label}_${z.number}`;
        }
        // Map Right Centre Back directly to rightmost zone
        if (shortPos === "RCB" && matchingZones.length > 1) {
            const z = matchingZones[matchingZones.length - 1];
            return `${z.label}_${z.number}`;
        }

        // Even distribution round-robin
        const groupPlayers = squadPlayers
            .filter(pl => {
                if (assignments[pl.id]) return false;
                if (pl.medicalStatus === "Injured" || pl.medicalStatus === "Suspended" || pl.medicalStatus === "Holiday" || pl.medicalStatus === "Unavailable") return false;
                
                const plShort = getShortPosition(pl.position);
                if (shortPos === "CB" || shortPos === "LCB" || shortPos === "RCB") {
                    return plShort === "CB" || plShort === "LCB" || plShort === "RCB";
                }
                if (shortPos === "ST" || shortPos === "CF") {
                    return plShort === "ST" || plShort === "CF";
                }
                if (shortPos === "CM" || shortPos === "CDM" || shortPos === "CAM") {
                    return plShort === "CM" || plShort === "CDM" || plShort === "CAM";
                }
                return plShort === shortPos;
            })
            .sort((a, b) => a.id.localeCompare(b.id));

        const playerIdx = groupPlayers.findIndex(pl => pl.id === p.id);
        if (playerIdx === -1) {
            const z = matchingZones[0];
            return `${z.label}_${z.number}`;
        }

        const targetZone = matchingZones[playerIdx % matchingZones.length];
        return `${targetZone.label}_${targetZone.number}`;
    };

    // Filter registry pool players based on UI filters
    const filteredPlayers = players.filter(p => {
        const notesObj = getParsedNotes(p.notes || "");
        const fullName = `${p.firstName} ${p.lastName}`.toLowerCase();
        if (searchQuery && !fullName.includes(searchQuery.toLowerCase())) return false;
        if (filterPosition !== "All" && getPositionCategory(p.position) !== filterPosition) return false;
        if (filterAgeMax !== "All" && getPlayerAge(p) > parseInt(filterAgeMax)) return false;
        if (filterAvailability !== "All" && p.availability !== (filterAvailability === "Available")) return false;
        if (filterFoot !== "All" && notesObj.preferredFoot !== filterFoot) return false;
        if (filterYouth && getPlayerAge(p) >= 21) return false;
        if (filterTrialists && !p.notes?.toLowerCase().includes("trial")) return false;
        return true;
    });

    // Stats calculations
    const totalPlayers = players.length;
    const avgAge = totalPlayers > 0 ? (players.reduce((sum, p) => sum + getPlayerAge(p), 0) / totalPlayers).toFixed(1) : "0.0";
    const gkCount = players.filter(p => getPositionCategory(p.position) === "GK").length;
    const defCount = players.filter(p => getPositionCategory(p.position) === "DEF").length;
    const midCount = players.filter(p => getPositionCategory(p.position) === "MID").length;
    const fwdCount = players.filter(p => getPositionCategory(p.position) === "FWD").length;

    const getInsights = () => {
        const insights: { type: "warning" | "success" | "info"; text: string }[] = [];

        if (gkCount === 0) insights.push({ type: "warning", text: "No Goalkeepers rostered." });
        else if (gkCount === 1) insights.push({ type: "warning", text: "No backup GK cover (Only 1 GK)." });
        else insights.push({ type: "success", text: "Healthy Goalkeeper depth." });

        const zoneRequired: Record<string, number> = {};
        activePositions.forEach(pos => {
            zoneRequired[pos.label] = (zoneRequired[pos.label] || 0) + 1;
        });

        Object.keys(zoneRequired).forEach(label => {
            const count = players.filter(p => getPlayerZone(p, players) && getPlayerZone(p, players)!.startsWith(label)).length;
            if (count === 0) {
                insights.push({ type: "warning", text: `No depth cover at all for ${POSITION_FULL_NAMES[label] || label}.` });
            } else if (count < zoneRequired[label]) {
                insights.push({ type: "warning", text: `Understaffed position: ${POSITION_FULL_NAMES[label] || label} (Needs ${zoneRequired[label]}, has ${count}).` });
            } else if (count > zoneRequired[label] * 3) {
                insights.push({ type: "success", text: `Overloaded depth at ${POSITION_FULL_NAMES[label] || label} (${count} options).` });
            }
        });

        return insights;
    };

    const insights = getInsights();

    return (
        <div className="space-y-6 text-slate-900 pb-12">
            {/* Header & Tabs */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-5">
                <div>
                    <h1 className="text-2xl font-black tracking-tight">Squad Depth Planner</h1>
                    <p className="text-xs text-slate-500 mt-1">Visualize full squad coverage, analyze positional depth, and manage backups.</p>
                </div>
                
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

            {/* Filter & Action Panel */}
            <div className="bg-white p-4 rounded-xl border shadow-xs flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-4 text-xs">
                    <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-500 uppercase tracking-wider">Formation</span>
                        <select
                            value={formation}
                            onChange={(e) => handleFormationChange(e.target.value)}
                            className="bg-slate-50 border border-slate-200 rounded-lg font-bold py-2 px-3 focus:outline-none focus:ring-2 focus:ring-red-500"
                        >
                            {FORMATION_NAMES.map(f => (
                                <option key={f} value={f}>{f}</option>
                            ))}
                        </select>
                    </div>

                    <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                        <Input
                            placeholder="Quick search player..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-8 text-xs h-9 bg-slate-50 min-w-[200px]"
                        />
                    </div>

                    <select
                        value={filterFoot}
                        onChange={(e) => setFilterFoot(e.target.value)}
                        className="bg-slate-50 border border-slate-200 rounded-lg p-2 focus:outline-none font-medium"
                    >
                        <option value="All">All Feet</option>
                        <option value="Right">Right Foot</option>
                        <option value="Left">Left Foot</option>
                        <option value="Both">Both Feet</option>
                    </select>

                    <select
                        value={filterAvailability}
                        onChange={(e) => setFilterAvailability(e.target.value)}
                        className="bg-slate-50 border border-slate-200 rounded-lg p-2 focus:outline-none font-medium"
                    >
                        <option value="All">All Availabilities</option>
                        <option value="Available">Available</option>
                        <option value="Unavailable">Unavailable</option>
                    </select>

                    <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-650">
                        <input
                            type="checkbox"
                            checked={filterYouth}
                            onChange={(e) => setFilterYouth(e.target.checked)}
                            className="rounded border-slate-355 text-red-600 focus:ring-red-500"
                        />
                        <span>Youth (&lt;21)</span>
                    </label>

                    <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-655">
                        <input
                            type="checkbox"
                            checked={filterTrialists}
                            onChange={(e) => setFilterTrialists(e.target.checked)}
                            className="rounded border-slate-355 text-red-600 focus:ring-red-500"
                        />
                        <span>Trialists</span>
                    </label>
                </div>

                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={handleResetAssignments} className="text-slate-500 hover:text-red-655 font-bold">
                        <Trash2 className="h-4 w-4 mr-1.5" /> Clear Drag Overrides
                    </Button>
                </div>
            </div>

            {/* Main Visual Board - Pitch takes maximum space */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
                
                {/* Visual Pitch - Takes 3 cols on desktop */}
                <div className="lg:col-span-3 space-y-4">
                    <div className="relative bg-emerald-800 rounded-2xl border-4 border-emerald-600/40 p-6 min-h-[660px] shadow-2xl flex flex-col justify-between overflow-hidden select-none">
                        
                        {/* Grass Stripe Overlays */}
                        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-10">
                            {Array.from({ length: 8 }).map((_, idx) => (
                                <div key={idx} className={`h-[85px] w-full ${idx % 2 === 0 ? 'bg-black' : 'bg-transparent'}`} />
                            ))}
                        </div>

                        {/* Pitch Markings */}
                        <div className="absolute inset-6 border-2 border-white/20 pointer-events-none">
                            <div className="absolute top-1/2 left-0 right-0 border-t-2 border-white/20" />
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 border-2 border-white/20 rounded-full" />
                            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-28 border-2 border-white/20 border-t-0" />
                            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-64 h-28 border-2 border-white/20 border-b-0" />
                        </div>

                        {/* Visual Position Zones - Scaled safely to keep GK fully on-pitch */}
                        <div className="absolute inset-0 p-10 flex flex-col justify-between">
                            {activePositions.map((pos) => {
                                const zoneKey = `${pos.label}_${pos.number}`;
                                const zonePlayers = filteredPlayers.filter(p => getPlayerZone(p, players) === zoneKey);

                                // GK is at y: 5 originally. We scale y from 12% to 88% to prevent GK or ST getting cut off.
                                const adjustedY = 12 + (pos.y * 0.76);
                                const adjustedX = pos.x;

                                return (
                                    <div
                                        key={zoneKey}
                                        onDragOver={(e) => e.preventDefault()}
                                        onDrop={() => handleDrop(zoneKey)}
                                        className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center min-w-[135px] z-10"
                                        style={{ left: `${adjustedX}%`, top: `${adjustedY}%` }}
                                    >
                                        <div className="px-3 py-0.5 rounded-full bg-slate-900 border border-slate-700/80 text-[10px] font-black text-slate-200 shadow-md">
                                            {pos.label}
                                        </div>

                                        {/* Placed players stack - Text only player cards */}
                                        <div className="min-h-[64px] w-full mt-2 flex flex-col items-center justify-start rounded-xl border-2 border-dashed border-white/20 bg-slate-950/20 backdrop-blur-md p-1.5 gap-1.5 transition-all hover:bg-slate-950/30">
                                            {zonePlayers.length === 0 ? (
                                                <span className="text-[9px] text-white/40 italic font-bold my-auto">Empty</span>
                                            ) : (
                                                zonePlayers.map(p => (
                                                    <div
                                                        key={p.id}
                                                        draggable
                                                        onDragStart={() => handleDragStart(p.id)}
                                                        onClick={() => {
                                                            setSelectedPlayer(p);
                                                            setIsDrawerOpen(true);
                                                        }}
                                                        className="flex items-center justify-between gap-2 bg-slate-950 hover:border-red-400 border border-slate-800 text-white rounded-lg p-2.5 text-xs font-bold shadow-md cursor-grab w-full transition-all"
                                                    >
                                                        <div className="overflow-hidden flex-1 leading-tight text-left">
                                                            <p className="truncate text-white text-[12px] font-black">{p.firstName} {p.lastName}</p>
                                                            <p className="text-[10px] text-slate-400 font-semibold truncate">
                                                                {p.position} {p.secondaryPositions && p.secondaryPositions.length > 0 && `/ ${p.secondaryPositions.join(" / ")}`}
                                                            </p>
                                                        </div>
                                                        <span className={`h-2 w-2 rounded-full shrink-0 ${p.availability ? 'bg-green-500' : 'bg-red-500'}`} />
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

                {/* Left Side: Stats, Insights, and Out-of-Action categories */}
                <div className="lg:col-span-1 space-y-4">
                    
                    {/* Insights Card */}
                    <Card className="border shadow-sm">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-black flex items-center gap-1.5 text-slate-800">
                                <AlertCircle className="h-4 w-4 text-slate-500" /> Positional Insights
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2 text-xs font-semibold">
                            {insights.length === 0 ? (
                                <p className="text-slate-400 italic">No alarms triggered. Squad is well balanced.</p>
                            ) : (
                                insights.map((insight, idx) => (
                                    <div key={idx} className="flex items-start gap-2 leading-tight">
                                        {insight.type === "warning" ? (
                                            <AlertTriangle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                                        ) : insight.type === "success" ? (
                                            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                                        ) : (
                                            <Info className="h-4 w-4 text-slate-500 shrink-0 mt-0.5" />
                                        )}
                                        <span className="text-slate-700">{insight.text}</span>
                                    </div>
                                ))
                            )}
                        </CardContent>
                    </Card>

                    {/* Stats Summary */}
                    <Card className="border shadow-sm">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-black">Squad Numbers</CardTitle>
                        </CardHeader>
                        <CardContent className="grid grid-cols-2 gap-2.5 text-xs">
                            <div className="bg-slate-50 p-2.5 rounded-lg border">
                                <span className="text-[10px] text-slate-400 uppercase font-black block">Total Players</span>
                                <span className="text-lg font-black text-slate-850">{totalPlayers}</span>
                            </div>
                            <div className="bg-slate-50 p-2.5 rounded-lg border">
                                <span className="text-[10px] text-slate-400 uppercase font-black block">Average Age</span>
                                <span className="text-lg font-black text-slate-850">{avgAge} yrs</span>
                            </div>
                            <div className="col-span-2 bg-slate-50 p-3 rounded-lg border space-y-1">
                                <span className="text-[10px] text-slate-400 uppercase font-black block mb-2 text-center">Depth per Category</span>
                                <div className="grid grid-cols-4 text-center font-bold text-[11px] gap-1">
                                    <div className="border-r"><span className="block text-[9px] text-slate-400">GK</span>{gkCount}</div>
                                    <div className="border-r"><span className="block text-[9px] text-slate-400">DEF</span>{defCount}</div>
                                    <div className="border-r"><span className="block text-[9px] text-slate-400">MID</span>{midCount}</div>
                                    <div><span className="block text-[9px] text-slate-400">FWD</span>{fwdCount}</div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Out of Action / Status planning zones */}
                    <div className="space-y-3">
                        <h3 className="text-xs font-black uppercase text-slate-500 tracking-wider">Out of Action</h3>
                        <div className="grid grid-cols-1 gap-2.5">
                            {["Injured", "Suspended", "Unavailable", "Loan", "Youth Players", "Trialists"].map((statusKey) => {
                                const columnPlayers = filteredPlayers.filter(p => getPlayerZone(p, players) === statusKey);
                                return (
                                    <div
                                        key={statusKey}
                                        onDragOver={(e) => e.preventDefault()}
                                        onDrop={() => handleDrop(statusKey)}
                                        className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 flex flex-col gap-2 min-h-[90px] transition-all hover:bg-slate-100"
                                    >
                                        <div className="flex items-center justify-between border-b pb-1 border-slate-200">
                                            <span className="text-[10px] font-black text-slate-600 uppercase tracking-wider">{statusKey}</span>
                                            <Badge variant="outline" className="text-[9px] px-1 py-0 scale-90">{columnPlayers.length}</Badge>
                                        </div>
                                        <div className="flex flex-col gap-1.5 max-h-[160px] overflow-y-auto">
                                            {columnPlayers.length === 0 ? (
                                                <span className="text-[9px] text-slate-400 italic mt-1">Drop player here</span>
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
                                                        className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg p-2.5 text-xs font-bold hover:border-slate-400 cursor-grab truncate shadow-xs"
                                                    >
                                                        <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${p.availability ? "bg-green-500" : "bg-red-500"}`} />
                                                        <span className="truncate flex-1 text-slate-800 text-[11px] font-black">{p.firstName} {p.lastName}</span>
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
            </div>

            {/* Quick Side Detail Panel */}
            {isDrawerOpen && selectedPlayer && (
                <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex justify-end animate-in fade-in duration-150">
                    <div className="bg-white w-full max-w-md h-full shadow-2xl p-6 overflow-y-auto space-y-6 flex flex-col justify-between animate-in slide-in-from-right duration-200">
                        <div className="space-y-6">
                            <div className="flex justify-between items-start border-b pb-4">
                                <div className="flex items-center gap-3">
                                    <div>
                                        <h2 className="text-lg font-black tracking-tight text-slate-900">{selectedPlayer.firstName} {selectedPlayer.lastName}</h2>
                                        <p className="text-xs text-slate-500 font-medium">Position: {selectedPlayer.position}</p>
                                    </div>
                                </div>
                                <button onClick={() => setIsDrawerOpen(false)} className="p-1 hover:bg-slate-100 rounded-lg">
                                    <X className="h-5 w-5 text-slate-400" />
                                </button>
                            </div>

                            <div className="grid grid-cols-2 gap-4 text-xs">
                                <div>
                                    <span className="text-slate-400 font-bold uppercase block text-[9px]">Age</span>
                                    <span className="font-bold text-slate-800">{getPlayerAge(selectedPlayer)} years old</span>
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
                                        className="mt-1 bg-slate-50 border rounded-lg p-1.5 focus:outline-none w-full font-bold"
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
                                        className="mt-1 bg-slate-50 border rounded-lg p-1.5 focus:outline-none w-full font-bold"
                                    >
                                        <option value="Right">Right</option>
                                        <option value="Left">Left</option>
                                        <option value="Both">Both</option>
                                    </select>
                                </div>
                            </div>

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
                                        className="mt-1 w-full bg-slate-50 border rounded-lg p-1.5 focus:outline-none font-bold"
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
                                        className="mt-1 w-full bg-slate-50 border rounded-lg p-1.5 focus:outline-none font-bold"
                                    />
                                </div>
                            </div>

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
                                    className="w-full bg-slate-50 border rounded-lg p-2 focus:outline-none text-xs font-bold"
                                />
                            </div>

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
                                    className="w-full bg-slate-50 border rounded-lg p-2 focus:outline-none text-xs font-bold"
                                />
                            </div>
                        </div>

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
