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
    Info,
    ChevronDown,
    ChevronUp,
    GripVertical,
    Plus,
    UserCheck,
    Lock,
    Star,
    ShieldAlert
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useClub } from "@/context/club-context";
import { useAuth } from "@/context/auth-context";
import Link from "next/link";

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
    
    // Drag and drop tracking
    const [draggedPlayerId, setDraggedPlayerId] = useState<string | null>(null);
    const [draggedSourcePos, setDraggedSourcePos] = useState<string | null>(null);

    // Sidebar details drawer
    const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);

    // Accordions expand/collapse map: { [positionLabel]: boolean }
    const [expandedPositions, setExpandedPositions] = useState<Record<string, boolean>>({});

    // Filter states
    const [filterAgeMax, setFilterAgeMax] = useState<string>("All");
    const [filterAvailability, setFilterAvailability] = useState<string>("All");
    const [filterFoot, setFilterFoot] = useState<string>("All");
    const [filterYouth, setFilterYouth] = useState<boolean>(false);
    const [filterTrialists, setFilterTrialists] = useState<boolean>(false);

    // Position assignments: { [positionLabel]: playerId[] }
    // e.g. { "LB": [ "id1", "id2" ], "CB": [ "id3", "id4" ] }
    const [depthChart, setDepthChart] = useState<Record<string, string[]>>({});

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
                initializeDepthChart(filteredBySquad);
            }
        } catch (err) {
            console.error("Error fetching players:", err);
        } finally {
            setLoading(false);
        }
    };

    // Initialize depth chart by merging saved config and natural/default positions
    const initializeDepthChart = (squadPlayers: Player[]) => {
        const saved = localStorage.getItem(`clubflow_squad_depth_chart_${activeSquadTab}`);
        let loadedChart: Record<string, string[]> = {};
        if (saved) {
            try {
                loadedChart = JSON.parse(saved);
            } catch (e) {
                loadedChart = {};
            }
        }

        // Clean out IDs that don't exist anymore or are out of squad
        const currentIds = new Set(squadPlayers.map(p => p.id));
        Object.keys(loadedChart).forEach(pos => {
            loadedChart[pos] = (loadedChart[pos] || []).filter(id => currentIds.has(id));
        });

        // Ensure all active players are assigned somewhere
        const assignedIds = new Set<string>();
        Object.values(loadedChart).forEach(arr => arr.forEach(id => assignedIds.add(id)));

        squadPlayers.forEach(p => {
            if (!assignedIds.has(p.id)) {
                // Determine their short position key (e.g. GK, LCB, CB)
                let posKey = getShortPosition(p.position);
                
                // If they are LCB/RCB, default them to "CB" zone list
                if (posKey === "LCB" || posKey === "RCB") {
                    posKey = "CB";
                }

                if (!loadedChart[posKey]) {
                    loadedChart[posKey] = [];
                }
                loadedChart[posKey].push(p.id);
                assignedIds.add(p.id);
            }
        });

        setDepthChart(loadedChart);
        localStorage.setItem(`clubflow_squad_depth_chart_${activeSquadTab}`, JSON.stringify(loadedChart));
    };

    // Load setup
    useEffect(() => {
        if (isClubLoaded) {
            fetchPlayers();
            
            const savedFormation = localStorage.getItem(`clubflow_squad_depth_formation_${activeSquadTab}`);
            if (savedFormation) {
                setFormation(savedFormation);
            } else {
                setFormation("4-3-3");
            }
        }
    }, [activeSquadTab, isClubLoaded]);

    const saveDepthChart = (newChart: Record<string, string[]>) => {
        setDepthChart(newChart);
        localStorage.setItem(`clubflow_squad_depth_chart_${activeSquadTab}`, JSON.stringify(newChart));
    };

    const handleFormationChange = (newFormation: string) => {
        setFormation(newFormation);
        localStorage.setItem(`clubflow_squad_depth_formation_${activeSquadTab}`, newFormation);
    };

    // Drag start
    const handleDragStart = (playerId: string, posKey: string) => {
        setDraggedPlayerId(playerId);
        setDraggedSourcePos(posKey);
    };

    // Drag over list item to swap order (internal ranking)
    const handleDragOverItem = (e: React.DragEvent, targetIndex: number, targetPos: string) => {
        e.preventDefault();
        if (!draggedPlayerId || !draggedSourcePos || draggedSourcePos !== targetPos) return;

        const currentList = [...(depthChart[targetPos] || [])];
        const sourceIndex = currentList.indexOf(draggedPlayerId);
        if (sourceIndex === -1 || sourceIndex === targetIndex) return;

        // Reorder
        currentList.splice(sourceIndex, 1);
        currentList.splice(targetIndex, 0, draggedPlayerId);

        const newChart = { ...depthChart, [targetPos]: currentList };
        saveDepthChart(newChart);
    };

    // Drop player onto a different position accordion header or target zone
    const handleDropOnPosition = (targetPos: string) => {
        if (!draggedPlayerId || !draggedSourcePos || draggedSourcePos === targetPos) return;

        // Remove from old list
        const sourceList = (depthChart[draggedSourcePos] || []).filter(id => id !== draggedPlayerId);
        // Append to new list
        const targetList = [...(depthChart[targetPos] || []), draggedPlayerId];

        const newChart = {
            ...depthChart,
            [draggedSourcePos]: sourceList,
            [targetPos]: targetList
        };
        saveDepthChart(newChart);

        // Auto-expand target accordion
        setExpandedPositions(prev => ({ ...prev, [targetPos]: true }));

        setDraggedPlayerId(null);
        setDraggedSourcePos(null);
    };

    const handleResetChart = () => {
        if (confirm("Are you sure you want to reset all custom positional ranking overrides?")) {
            localStorage.removeItem(`clubflow_squad_depth_chart_${activeSquadTab}`);
            initializeDepthChart(players);
        }
    };

    const getParsedNotes = (notesStr: string | undefined) => {
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

    // Filtered players based on top filter options
    const filterPlayer = (p: Player) => {
        const notesObj = getParsedNotes(p.notes || "");
        const fullName = `${p.firstName} ${p.lastName}`.toLowerCase();
        if (searchQuery && !fullName.includes(searchQuery.toLowerCase())) return false;
        if (filterAgeMax !== "All" && getPlayerAge(p) > parseInt(filterAgeMax)) return false;
        if (filterAvailability !== "All" && p.availability !== (filterAvailability === "Available")) return false;
        if (filterFoot !== "All" && notesObj.preferredFoot !== filterFoot) return false;
        if (filterYouth && getPlayerAge(p) >= 21) return false;
        if (filterTrialists && !p.notes?.toLowerCase().includes("trial")) return false;
        return true;
    };

    // Render helper to get active players in a position zone
    const getActivePosPlayers = (posLabel: string) => {
        // Find players assigned to this position in the depth chart
        const ids = depthChart[posLabel] || [];
        return ids
            .map(id => players.find(p => p.id === id))
            .filter((p): p is Player => !!p && filterPlayer(p));
    };

    // Stats calculations
    const totalPlayers = players.length;
    const avgAge = totalPlayers > 0 ? (players.reduce((sum, p) => sum + getPlayerAge(p), 0) / totalPlayers).toFixed(1) : "0.0";
    const unavailableCount = players.filter(p => !p.availability).length;

    // Get position strength rating
    const getPositionStrength = (posLabel: string) => {
        const pList = getActivePosPlayers(posLabel);
        const availableCount = pList.filter(p => p.availability).length;
        if (availableCount === 0) return { rating: "Critical" as const, colorClass: "text-red-500 bg-red-500/10 border-red-500/25", score: 1 };
        if (pList.length >= 5) return { rating: "Excellent" as const, colorClass: "text-emerald-550 bg-emerald-500/10 border-emerald-500/25", score: 5 };
        if (pList.length >= 3) return { rating: "Strong" as const, colorClass: "text-emerald-450 bg-emerald-500/10 border-emerald-500/25", score: 4 };
        if (pList.length === 2) return { rating: "Adequate" as const, colorClass: "text-amber-500 bg-amber-500/10 border-amber-500/25", score: 3 };
        return { rating: "Weak" as const, colorClass: "text-orange-500 bg-orange-500/10 border-orange-500/25", score: 2 };
    };

    // Count weak positions
    const uniqueFormationLabels = Array.from(new Set(activePositions.map(pos => pos.label)));
    const weakPositionsCount = uniqueFormationLabels.filter(label => {
        const strength = getPositionStrength(label).rating;
        return strength === "Weak" || strength === "Critical";
    }).length;

    // Count natural positions covered
    const naturalCoveredCount = uniqueFormationLabels.filter(label => {
        const pList = getActivePosPlayers(label);
        return pList.some(p => getShortPosition(p.position) === label);
    }).length;

    // Formation Suitability Star Rating
    const getFormationRating = () => {
        let totalScore = 0;
        uniqueFormationLabels.forEach(label => {
            totalScore += getPositionStrength(label).score;
        });
        const average = uniqueFormationLabels.length > 0 ? totalScore / uniqueFormationLabels.length : 0;
        return Math.min(5, Math.max(1, Math.round(average)));
    };
    const formationRating = getFormationRating();

    // Sporting Director Position Insights
    const getSquadPlanningInsights = () => {
        const list: string[] = [];
        
        // GK checks
        const gks = getActivePosPlayers("GK");
        const availableGks = gks.filter(p => p.availability).length;
        if (availableGks === 0) {
            list.push("🔴 GK: No available goalkeeper registered. Critical recruitment priority.");
        } else if (gks.length === 1) {
            list.push("🟠 GK: No active backup goalkeeper available.");
        } else {
            const avgGkAge = gks.reduce((a, b) => a + getPlayerAge(b), 0) / gks.length;
            if (avgGkAge > 31) {
                list.push(`🟠 GK: Average age of goalkeepers exceeds 31 (${avgGkAge.toFixed(1)}). Future recruitment recommended.`);
            }
        }

        // Natural player counts check
        uniqueFormationLabels.forEach(label => {
            if (label === "GK") return;
            const pList = getActivePosPlayers(label);
            const naturalCount = pList.filter(p => getShortPosition(p.position) === label).length;
            const availableCount = pList.filter(p => p.availability).length;
            
            if (pList.length === 0) {
                list.push(`🔴 ${label}: Position completely empty.`);
            } else if (availableCount === 0) {
                list.push(`🔴 ${label}: All assigned players are currently unavailable.`);
            } else if (naturalCount === 0) {
                list.push(`🟠 ${label}: Lacks natural options (playing out of position or utility players).`);
            } else if (pList.length === 1) {
                list.push(`🟠 ${label}: Lacks backup depth (1 option only).`);
            } else if (pList.length >= 5) {
                list.push(`🟢 ${label}: Excellent depth with ${pList.length} options.`);
            }
        });

        // Left-footed check in defense
        const lbs = getActivePosPlayers("LB");
        const hasLeftFootedLb = lbs.some(p => getParsedNotes(p.notes).preferredFoot === "Left" || getParsedNotes(p.notes).preferredFoot === "Both");
        if (lbs.length > 0 && !hasLeftFootedLb) {
            list.push("🟠 Defense: LB lacks a natural left-footed specialist.");
        }

        return list;
    };
    const squadPlanningInsights = getSquadPlanningInsights();

    // Recruitment priorities generator
    const getRecruitmentPriorities = () => {
        const priorities: { title: string; reason: string; severity: "Critical" | "Weak" | "Adequate" }[] = [];

        uniqueFormationLabels.forEach(label => {
            const pList = getActivePosPlayers(label);
            const availableCount = pList.filter(p => p.availability).length;
            
            if (pList.length === 0 || availableCount === 0) {
                priorities.push({
                    title: `Natural ${POSITION_FULL_NAMES[label] || label}`,
                    reason: `No active or available coverage for this role.`,
                    severity: "Critical"
                });
            } else if (pList.length === 1) {
                priorities.push({
                    title: `Backup ${POSITION_FULL_NAMES[label] || label}`,
                    reason: `Only one recognized player currently covers this position.`,
                    severity: "Weak"
                });
            }
        });
        
        return priorities.sort((a, b) => {
            const severityOrder = { Critical: 3, Weak: 2, Adequate: 1 };
            return severityOrder[b.severity] - severityOrder[a.severity];
        }).slice(0, 3);
    };
    const recruitmentPriorities = getRecruitmentPriorities();

    // Toggle expand/collapse for a position accordion
    const toggleAccordion = (posLabel: string) => {
        setExpandedPositions(prev => ({
            ...prev,
            [posLabel]: !prev[posLabel]
        }));
    };

    return (
        <div className="space-y-6 text-slate-900 pb-12">
            {/* Header & Tabs */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-5">
                <div>
                    <h1 className="text-2xl font-black tracking-tight">Squad Planning Centre</h1>
                    <p className="text-xs text-slate-500 mt-1">Visualize full squad coverage, analyze positional depth, and manage backups.</p>
                </div>
                
                <div className="flex bg-slate-100 p-1 rounded-xl w-fit">
                    {currentSquads.map((sq) => (
                        <button
                            key={sq}
                            onClick={() => setActiveSquadTab(sq)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                activeSquadTab === sq ? "bg-white text-slate-955 shadow-sm" : "text-slate-500 hover:text-slate-850"
                            }`}
                        >
                            {sq}
                        </button>
                    ))}
                </div>
            </div>

            {/* Filter & Action Panel */}
            <div className="bg-white p-4 rounded-xl border shadow-sm flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-3 text-xs">
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
                            className="pl-8 text-xs h-9 bg-slate-50 min-w-[180px]"
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

                    <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-600">
                        <input
                            type="checkbox"
                            checked={filterYouth}
                            onChange={(e) => setFilterYouth(e.target.checked)}
                            className="rounded border-slate-300 text-red-650 focus:ring-red-500"
                        />
                        <span>Youth (&lt;21)</span>
                    </label>

                    <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-650">
                        <input
                            type="checkbox"
                            checked={filterTrialists}
                            onChange={(e) => setFilterTrialists(e.target.checked)}
                            className="rounded border-slate-300 text-red-650 focus:ring-red-500"
                        />
                        <span>Trialists</span>
                    </label>
                </div>

                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={handleResetChart} className="text-slate-500 hover:text-red-600 font-bold text-xs h-9">
                        <Trash2 className="h-4 w-4 mr-1.5" /> Reset Custom Planner
                    </Button>
                </div>
            </div>

            {/* Top Tactical Dashboard Cards (Suggestion 10) */}
            <div className="grid gap-4 grid-cols-2 md:grid-cols-6 relative z-10">
                <div className="bg-white border p-3.5 rounded-xl shadow-xs">
                    <span className="text-[9px] text-slate-400 uppercase font-black tracking-wider block">Registered Players</span>
                    <span className="text-xl font-black text-slate-900 mt-1 block">{totalPlayers}</span>
                </div>
                <div className="bg-white border p-3.5 rounded-xl shadow-xs">
                    <span className="text-[9px] text-slate-400 uppercase font-black tracking-wider block">Average Age</span>
                    <span className="text-xl font-black text-slate-900 mt-1 block">{avgAge} yrs</span>
                </div>
                <div className="bg-white border p-3.5 rounded-xl shadow-xs">
                    <span className="text-[9px] text-slate-400 uppercase font-black tracking-wider block">Positions Covered</span>
                    <span className="text-xl font-black text-slate-900 mt-1 block">{naturalCoveredCount} / {uniqueFormationLabels.length}</span>
                </div>
                <div className="bg-white border p-3.5 rounded-xl shadow-xs">
                    <span className="text-[9px] text-slate-400 uppercase font-black tracking-wider block">Unavailable Players</span>
                    <span className="text-xl font-black text-red-500 mt-1 block">{unavailableCount}</span>
                </div>
                <div className="bg-white border p-3.5 rounded-xl shadow-xs">
                    <span className="text-[9px] text-slate-400 uppercase font-black tracking-wider block">Weak Positions</span>
                    <span className="text-xl font-black text-orange-500 mt-1 block">{weakPositionsCount}</span>
                </div>
                <div className="bg-white border p-3.5 rounded-xl shadow-xs flex flex-col justify-between">
                    <span className="text-[9px] text-slate-400 uppercase font-black tracking-wider block">Formation Rating</span>
                    <div className="flex gap-0.5 text-amber-500 mt-1">
                        {Array.from({ length: 5 }).map((_, idx) => (
                            <Star key={idx} className={`h-4.5 w-4.5 ${idx < formationRating ? "fill-amber-500 text-amber-500" : "text-slate-200"}`} />
                        ))}
                    </div>
                </div>
            </div>

            {/* Split Screen Layout */}
            <div className="grid grid-cols-1 xl:grid-cols-5 gap-6 items-start">
                
                {/* Visual Pitch - Takes 3/5 width (60%) */}
                <div className="xl:col-span-3 space-y-4">
                    <div className="relative bg-emerald-800 rounded-2xl border-4 border-emerald-650/40 p-6 min-h-[640px] shadow-2xl flex flex-col justify-between overflow-hidden select-none">
                        
                        {/* Grass Stripe Overlays */}
                        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-10">
                            {Array.from({ length: 8 }).map((_, idx) => (
                                <div key={idx} className={`h-[80px] w-full ${idx % 2 === 0 ? 'bg-black' : 'bg-transparent'}`} />
                            ))}
                        </div>

                        {/* Pitch Markings */}
                        <div className="absolute inset-6 border-2 border-white/20 pointer-events-none">
                            <div className="absolute top-1/2 left-0 right-0 border-t-2 border-white/20" />
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 border-2 border-white/20 rounded-full" />
                            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-28 border-2 border-white/20 border-t-0" />
                            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-64 h-28 border-2 border-white/20 border-b-0" />
                        </div>

                        {/* Visual Position Nodes on the Pitch */}
                        <div className="absolute inset-0 p-10 flex flex-col justify-between">
                            {activePositions.map((pos) => {
                                const zoneKey = `${pos.label}_${pos.number}`;
                                const positionPlayers = getActivePosPlayers(pos.label);
                                
                                // Starter is the first choice in depth list
                                const starter = positionPlayers[0];

                                const adjustedY = 12 + (pos.y * 0.76);
                                const adjustedX = pos.x;

                                return (
                                    <div
                                        key={zoneKey}
                                        onDragOver={(e) => e.preventDefault()}
                                        onDrop={() => handleDropOnPosition(pos.label)}
                                        onClick={() => {
                                            toggleAccordion(pos.label);
                                            const element = document.getElementById(`depth-accordion-${pos.label}`);
                                            if (element) {
                                                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                            }
                                        }}
                                        className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center min-w-[130px] z-10 cursor-pointer group"
                                        style={{ left: `${adjustedX}%`, top: `${adjustedY}%` }}
                                    >
                                        {/* Zone Label Header */}
                                        <div className="px-3 py-0.5 rounded-full bg-slate-900 border border-slate-700/80 text-[10px] font-black text-slate-200 shadow-md group-hover:border-red-500 transition-colors">
                                            {pos.label}
                                        </div>

                                        {/* Placed 1st Choice Card (Simplified: No backup counts, Suggestion 1 & 2) */}
                                        <div className="w-full mt-2 bg-slate-950/85 border border-slate-800 text-white rounded-xl p-2.5 text-center shadow-lg transition-all group-hover:scale-105 group-hover:border-slate-500">
                                            {starter ? (
                                                <div className="space-y-1.5 text-left">
                                                    <div className="flex items-center justify-between gap-1">
                                                        <span className="truncate text-white text-[11px] font-bold">
                                                            {starter.notes?.includes("[CAPTAIN]") && "👑 "}
                                                            {starter.firstName[0]}. {starter.lastName}
                                                        </span>
                                                        <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${starter.availability ? 'bg-green-500' : 'bg-red-500'}`} />
                                                    </div>
                                                    
                                                    <div className="flex items-center justify-between text-[9px] text-slate-400 font-semibold pt-1 border-t border-slate-850">
                                                        <span>Starter</span>
                                                        {starter.squadNumber > 0 && <span>#{starter.squadNumber}</span>}
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="flex flex-col items-center justify-center h-10 text-slate-500 text-[10px] italic">
                                                    <span>No Starter</span>
                                                    <span className="text-[8px] text-red-400 font-bold flex items-center gap-0.5"><AlertCircle className="h-2 w-2" /> Shortage</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Right Panel: Squad Summary & Rankings - Takes 2/5 width (40%) */}
                <div className="xl:col-span-2 space-y-6">
                    {/* Squad Summary Card (Suggestion 9) */}
                    <Card className="bg-white border rounded-xl shadow-xs">
                        <CardHeader className="pb-3 border-b">
                            <CardTitle className="text-xs font-black uppercase text-slate-500 tracking-wider">Squad Summary</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-3.5 space-y-3.5 text-xs text-slate-700">
                            <div className="flex justify-between items-center bg-slate-50 p-2.5 rounded-lg border">
                                <span className="font-bold text-slate-650">Current Formation Suitability</span>
                                <div className="flex items-center gap-2">
                                    <span className="font-black text-slate-900">{formation}</span>
                                    <Badge className="bg-slate-200 text-slate-800 text-[9px] font-bold">
                                        {formationRating >= 4 ? "Excellent Match" : formationRating >= 3 ? "Adequate Match" : "Lacks Depth"}
                                    </Badge>
                                </div>
                            </div>
                            <p className="text-[11px] text-slate-500 leading-normal">
                                This planner calculates positional strength, backup hierarchies, and recruitment recommendations dynamically based on the current selection of first-choice starters and tactical parameters.
                            </p>
                        </CardContent>
                    </Card>

                    {/* Squad Insights (Suggestion 9 & 5) */}
                    <Card className="bg-white border rounded-xl shadow-xs">
                        <CardHeader className="pb-3 border-b">
                            <CardTitle className="text-xs font-black uppercase text-slate-500 tracking-wider">Squad Insights</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-3.5 text-xs font-semibold space-y-2">
                            <div className="space-y-2.5 max-h-[160px] overflow-y-auto pr-1">
                                {squadPlanningInsights.length === 0 ? (
                                    <p className="text-slate-400 italic font-normal">No operational warnings. Squad balance is currently stable.</p>
                                ) : (
                                    squadPlanningInsights.map((text, idx) => (
                                        <div key={idx} className="flex items-start gap-2 leading-tight">
                                            <span className="text-slate-700">{text}</span>
                                        </div>
                                    ))
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Recruitment Priorities (Suggestion 9 & 6) */}
                    <Card className="bg-white border rounded-xl shadow-xs">
                        <CardHeader className="pb-3 border-b">
                            <CardTitle className="text-xs font-black uppercase text-slate-500 tracking-wider">Recruitment Priorities</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-3.5 text-xs space-y-3">
                            {recruitmentPriorities.length === 0 ? (
                                <p className="text-slate-400 italic text-center py-2">No outstanding positional coverage warnings.</p>
                            ) : (
                                recruitmentPriorities.map((item, idx) => (
                                    <div key={idx} className="bg-slate-50 p-3 rounded-lg border border-slate-200 flex justify-between items-start">
                                        <div className="space-y-1">
                                            <span className="font-black text-slate-900 block text-xs">Priority {idx + 1}: {item.title}</span>
                                            <span className="text-[10px] text-slate-500 leading-normal block">{item.reason}</span>
                                        </div>
                                        <Badge className={`text-[8px] font-black uppercase shrink-0 ${
                                            item.severity === "Critical" ? "bg-red-500/10 text-red-500 border border-red-500/20" : "bg-orange-500/10 text-orange-500 border border-orange-500/20"
                                        }`}>
                                            {item.severity}
                                        </Badge>
                                    </div>
                                ))
                            )}
                        </CardContent>
                    </Card>

                    {/* Accordion List for Positional Depth Chart (Rankings, Suggestion 9, 3 & 11) */}
                    <div className="space-y-3 bg-white p-4 rounded-xl border shadow-sm">
                        <div className="flex items-center justify-between border-b pb-3">
                            <h3 className="text-xs font-black uppercase text-slate-500 tracking-wider">Position Rankings</h3>
                            <span className="text-[9px] bg-slate-100 text-slate-500 font-bold px-2 py-0.5 rounded">Drag to reorder rankings</span>
                        </div>

                        <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
                            {Array.from(new Set(activePositions.map(pos => pos.label))).map((posLabel) => {
                                const posPlayers = getActivePosPlayers(posLabel);
                                const isExpanded = !!expandedPositions[posLabel];
                                const strength = getPositionStrength(posLabel);

                                // Compute positional stats (Suggestion 8)
                                const ageAvg = posPlayers.length > 0 ? (posPlayers.reduce((a, b) => a + getPlayerAge(b), 0) / posPlayers.length).toFixed(1) : "0";
                                const leftCount = posPlayers.filter(p => getParsedNotes(p.notes).preferredFoot === "Left").length;
                                const rightCount = posPlayers.filter(p => getParsedNotes(p.notes).preferredFoot === "Right").length;
                                const bothCount = posPlayers.filter(p => getParsedNotes(p.notes).preferredFoot === "Both").length;
                                const availableCount = posPlayers.filter(p => p.availability).length;
                                const naturalCount = posPlayers.filter(p => getShortPosition(p.position) === posLabel).length;
                                const utilityCount = posPlayers.length - naturalCount;

                                return (
                                    <div
                                        key={posLabel}
                                        id={`depth-accordion-${posLabel}`}
                                        onDragOver={(e) => e.preventDefault()}
                                        onDrop={() => handleDropOnPosition(posLabel)}
                                        className="border rounded-xl bg-slate-50/50 overflow-hidden"
                                    >
                                        {/* Accordion Trigger Header with Rating (Suggestion 4) */}
                                        <div
                                            onClick={() => toggleAccordion(posLabel)}
                                            className="flex items-center justify-between p-3.5 cursor-pointer bg-slate-50 hover:bg-slate-100 border-b transition-colors select-none"
                                        >
                                            <div className="flex items-center gap-2">
                                                <span className="font-black text-xs text-slate-900 w-10 block">{posLabel}</span>
                                                <span className="text-[10px] text-slate-400 font-bold hidden sm:inline">({POSITION_FULL_NAMES[posLabel] || posLabel})</span>
                                            </div>
                                            
                                            <div className="flex items-center gap-3">
                                                <Badge className={`text-[8px] font-black uppercase tracking-wider ${strength.colorClass}`}>
                                                    {strength.rating}
                                                </Badge>
                                                {isExpanded ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                                            </div>
                                        </div>

                                        {/* Accordion Expanded Content (Position Cards, Suggestion 11) */}
                                        {isExpanded && (
                                            <div className="p-3.5 space-y-3 bg-white">
                                                {/* Positional Stats Ticker (Suggestion 8) */}
                                                <div className="grid grid-cols-3 gap-2 bg-slate-50 p-2.5 rounded-lg border text-[9px] text-slate-650 font-bold mb-2">
                                                    <div>Players: <span className="text-slate-900 font-black">{posPlayers.length}</span></div>
                                                    <div>Avg Age: <span className="text-slate-900 font-black">{ageAvg} yrs</span></div>
                                                    <div>Available: <span className="text-slate-900 font-black">{availableCount}</span></div>
                                                    <div>Left/Right/Both: <span className="text-slate-900 font-black">{leftCount}/{rightCount}/{bothCount}</span></div>
                                                    <div>Natural: <span className="text-slate-900 font-black">{naturalCount}</span></div>
                                                    <div>Utility: <span className="text-slate-900 font-black">{utilityCount}</span></div>
                                                </div>

                                                {posPlayers.length === 0 ? (
                                                    <p className="text-[10px] text-slate-400 italic text-center py-4">No players assigned. Drag a player here to fill position.</p>
                                                ) : (
                                                    posPlayers.map((p, index) => {
                                                        // Professional Rank Hierarchy (Suggestion 11)
                                                        const rankLabel = index === 0 ? "Starter" : index === 1 ? "Backup" : index === 2 ? "Rotation" : index === 3 ? "Development" : "Emergency Cover";
                                                        
                                                        return (
                                                            <div
                                                                key={p.id}
                                                                draggable
                                                                onDragStart={() => handleDragStart(p.id, posLabel)}
                                                                onDragOver={(e) => handleDragOverItem(e, index, posLabel)}
                                                                onClick={() => {
                                                                    setSelectedPlayer(p);
                                                                    setIsDrawerOpen(true);
                                                                }}
                                                                className="flex items-center justify-between p-2.5 border rounded-lg hover:border-slate-400 bg-white shadow-xs cursor-grab group select-none"
                                                            >
                                                                <div className="flex items-center gap-2.5 overflow-hidden">
                                                                    <GripVertical className="h-3.5 w-3.5 text-slate-300 group-hover:text-slate-500 shrink-0" />
                                                                    <div className="text-left overflow-hidden">
                                                                        <p className="font-bold text-xs text-slate-800 truncate">
                                                                            {p.firstName} {p.lastName}
                                                                        </p>
                                                                        <p className="text-[9px] text-slate-400">
                                                                            Natural: {p.position} {p.secondaryPositions && p.secondaryPositions.length > 0 && `/ ${p.secondaryPositions.join(" / ")}`}
                                                                        </p>
                                                                    </div>
                                                                </div>

                                                                <div className="flex items-center gap-2 shrink-0">
                                                                    <Badge variant="secondary" className={`text-[8px] font-black px-1.5 py-0.5 rounded-md ${
                                                                        index === 0 ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-650'
                                                                    }`}>
                                                                        {rankLabel}
                                                                    </Badge>
                                                                    <span className={`h-2 w-2 rounded-full ${p.availability ? "bg-green-500" : "bg-red-500"}`} />
                                                                </div>
                                                            </div>
                                                        );
                                                    })
                                                )}
                                            </div>
                                        )}
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
                                    <span className="text-slate-400 font-bold uppercase block text-[9px]">Height ({settings.measurementUnit === 'imperial' ? 'ft & in' : 'cm'})</span>
                                    <input
                                        type="text"
                                        placeholder={settings.measurementUnit === 'imperial' ? "e.g. 5'11\"" : "e.g. 182cm"}
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
                                    <span className="text-slate-400 font-bold uppercase block text-[9px]">Weight ({settings.measurementUnit === 'imperial' ? 'lbs' : 'kg'})</span>
                                    <input
                                        type="text"
                                        placeholder={settings.measurementUnit === 'imperial' ? "e.g. 170lbs" : "e.g. 78kg"}
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
