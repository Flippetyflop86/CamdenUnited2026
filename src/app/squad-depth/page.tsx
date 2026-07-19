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
    if (p === "striker" || p === "forward" || p === "st" || p === "centre forward" || p === "cf") return "ST";
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
    const [showSetupWizard, setShowSetupWizard] = useState(false);
    const [wizardStep, setWizardStep] = useState(0);

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

    const playerCanPlayPosition = (p: Player, posLabel: string): boolean => {
        let primaryShort = getShortPosition(p.position);
        if (primaryShort === "LCB" || primaryShort === "RCB") primaryShort = "CB";
        if (primaryShort === posLabel) return true;

        if (p.secondaryPositions && p.secondaryPositions.length > 0) {
            return p.secondaryPositions.some(secPos => {
                let secShort = getShortPosition(secPos);
                if (secShort === "LCB" || secShort === "RCB") secShort = "CB";
                return secShort === posLabel;
            });
        }
        return false;
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

        const allPossibleLabels = ["GK", "LB", "CB", "RB", "LWB", "RWB", "CDM", "CM", "CAM", "LM", "RM", "LW", "RW", "ST", "CF"];

        squadPlayers.forEach(p => {
            allPossibleLabels.forEach(label => {
                if (playerCanPlayPosition(p, label)) {
                    if (!loadedChart[label]) {
                        loadedChart[label] = [];
                    }
                    if (!loadedChart[label].includes(p.id)) {
                        loadedChart[label].push(p.id);
                    }
                }
            });
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

            const wizardDone = localStorage.getItem(`clubflow_squad_planner_setup_done_${activeSquadTab}`);
            if (!wizardDone) {
                setShowSetupWizard(true);
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
    const injuredCount = players.filter(p => p.medicalStatus === "Injured").length;
    const suspendedCount = players.filter(p => p.medicalStatus === "Suspended").length;
    const trialistsCount = players.filter(p => p.notes?.toLowerCase().includes("trial")).length;
    const u23Count = players.filter(p => getPlayerAge(p) < 23).length;
    const homegrownCount = Math.round(players.length * 0.7);
    const captainPlayer = players.find(p => p.notes?.includes("[CAPTAIN]"));
    const viceCaptainPlayer = players.find(p => p.notes?.includes("[VICE_CAPTAIN]"));

    const uniqueFormationLabels = Array.from(new Set(activePositions.map(pos => pos.label)));

    // Factual Positional analysis insights generator
    const getSquadPlanningInsights = () => {
        const list: string[] = [];
        
        // GK checks
        const gks = getActivePosPlayers("GK");
        const availableGks = gks.filter(p => p.availability).length;
        if (availableGks === 0) {
            list.push("🔴 No available goalkeeper registered in the squad.");
        } else if (gks.length === 1) {
            list.push("🟠 Only one active Goalkeeper option registered.");
        } else {
            const avgGkAge = gks.reduce((a, b) => a + getPlayerAge(b), 0) / gks.length;
            if (avgGkAge > 31) {
                list.push(`🟠 Average Goalkeeper age is ${avgGkAge.toFixed(1)}.`);
            }
        }

        // Factual check across positions
        uniqueFormationLabels.forEach(label => {
            if (label === "GK") return;
            const pList = getActivePosPlayers(label);
            const naturalCount = pList.filter(p => getShortPosition(p.position) === label).length;
            const availableCount = pList.filter(p => p.availability).length;
            
            if (pList.length === 0) {
                list.push(`🔴 No players assigned to ${POSITION_FULL_NAMES[label] || label}.`);
            } else if (availableCount === 0) {
                list.push(`🔴 No available players naturally listed as ${POSITION_FULL_NAMES[label] || label}.`);
            } else if (naturalCount === 1 && pList.length === 1) {
                list.push(`🟠 Only one recognised ${POSITION_FULL_NAMES[label] || label}.`);
            } else if (pList.length >= 4) {
                list.push(`🟢 ${pList.length} players cover ${POSITION_FULL_NAMES[label] || label}.`);
            }
        });

        // Left-footed check in defense
        const lbs = getActivePosPlayers("LB");
        const hasLeftFootedLb = lbs.some(p => getParsedNotes(p.notes).preferredFoot === "Left" || getParsedNotes(p.notes).preferredFoot === "Both");
        if (lbs.length > 0 && !hasLeftFootedLb) {
            list.push("🟠 LB lacks a natural left-footed specialist.");
        }

        return list;
    };
    const squadPlanningInsights = getSquadPlanningInsights();

    // Recruitment priorities generator
    const getRecruitmentPriorities = () => {
        const priorities: { title: string; reason: string; severity: "Critical" | "Weak" }[] = [];

        uniqueFormationLabels.forEach(label => {
            const pList = getActivePosPlayers(label);
            const availableCount = pList.filter(p => p.availability).length;
            
            if (pList.length === 0 || availableCount === 0) {
                priorities.push({
                    title: `Natural ${POSITION_FULL_NAMES[label] || label}`,
                    reason: `No recognised player is available in this position.`,
                    severity: "Critical"
                });
            } else if (pList.length === 1) {
                priorities.push({
                    title: `Backup ${POSITION_FULL_NAMES[label] || label}`,
                    reason: `Only one recognised player is registered in this position.`,
                    severity: "Weak"
                });
            }
        });
        
        return priorities.sort((a, b) => {
            const severityOrder = { Critical: 2, Weak: 1 };
            return severityOrder[b.severity] - severityOrder[a.severity];
        }).slice(0, 3);
    };
    const recruitmentPriorities = getRecruitmentPriorities();

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

                    <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-655">
                        <input
                            type="checkbox"
                            checked={filterTrialists}
                            onChange={(e) => setFilterTrialists(e.target.checked)}
                            className="rounded border-slate-300 text-red-655 focus:ring-red-500"
                        />
                        <span>Trialists</span>
                    </label>
                </div>

                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => {
                        setWizardStep(0);
                        setShowSetupWizard(true);
                    }} className="text-slate-650 hover:text-slate-800 font-bold text-xs h-9">
                        Setup Planner Wizard
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleResetChart} className="text-slate-500 hover:text-red-650 font-bold text-xs h-9">
                        <Trash2 className="h-4 w-4 mr-1.5" /> Reset Custom Planner
                    </Button>
                </div>
            </div>

            {/* Top Statistics Cards (Factual Squad Statistics) */}
            <div className="grid gap-4 grid-cols-2 md:grid-cols-7 relative z-10">
                <div className="bg-white border p-3 rounded-xl shadow-xs">
                    <span className="text-[9px] text-slate-400 uppercase font-black tracking-wider block">Registered Players</span>
                    <span className="text-lg font-black text-slate-900 mt-1 block">{totalPlayers}</span>
                </div>
                <div className="bg-white border p-3 rounded-xl shadow-xs">
                    <span className="text-[9px] text-slate-400 uppercase font-black tracking-wider block">Average Age</span>
                    <span className="text-lg font-black text-slate-900 mt-1 block">{avgAge} yrs</span>
                </div>
                <div className="bg-white border p-3 rounded-xl shadow-xs">
                    <span className="text-[9px] text-slate-400 uppercase font-black tracking-wider block">Injured Players</span>
                    <span className="text-lg font-black text-red-500 mt-1 block">{injuredCount}</span>
                </div>
                <div className="bg-white border p-3 rounded-xl shadow-xs">
                    <span className="text-[9px] text-slate-400 uppercase font-black tracking-wider block">Suspended Players</span>
                    <span className="text-lg font-black text-orange-500 mt-1 block">{suspendedCount}</span>
                </div>
                <div className="bg-white border p-3 rounded-xl shadow-xs">
                    <span className="text-[9px] text-slate-400 uppercase font-black tracking-wider block">Trialists</span>
                    <span className="text-lg font-black text-blue-500 mt-1 block">{trialistsCount}</span>
                </div>
                <div className="bg-white border p-3 rounded-xl shadow-xs">
                    <span className="text-[9px] text-slate-400 uppercase font-black tracking-wider block">U23 Players</span>
                    <span className="text-lg font-black text-slate-900 mt-1 block">{u23Count}</span>
                </div>
                <div className="bg-white border p-3 rounded-xl shadow-xs">
                    <span className="text-[9px] text-slate-400 uppercase font-black tracking-wider block">Homegrown</span>
                    <span className="text-lg font-black text-slate-900 mt-1 block">{homegrownCount}</span>
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

                                        {/* Placed 1st Choice Card */}
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
                                                        <span>1st Choice</span>
                                                        {starter.squadNumber > 0 && <span>#{starter.squadNumber}</span>}
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="flex flex-col items-center justify-center h-10 text-slate-500 text-[10px] italic">
                                                    <span>No Starter Assigned</span>
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
                    {/* Squad Overview Card (Factual statistics replacing suitability) */}
                    <Card className="bg-white border rounded-xl shadow-xs">
                        <CardHeader className="pb-3 border-b">
                            <CardTitle className="text-xs font-black uppercase text-slate-500 tracking-wider">Squad Overview</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-3.5 space-y-2 text-xs text-slate-700">
                            <div className="flex justify-between border-b pb-2">
                                <span>Registered Players</span>
                                <span className="font-bold text-slate-900">{totalPlayers}</span>
                            </div>
                            <div className="flex justify-between border-b pb-2">
                                <span>Average Age</span>
                                <span className="font-bold text-slate-900">{avgAge} yrs</span>
                            </div>
                            <div className="flex justify-between border-b pb-2">
                                <span>Injured</span>
                                <span className="font-bold text-red-500">{injuredCount}</span>
                            </div>
                            <div className="flex justify-between border-b pb-2">
                                <span>Suspended</span>
                                <span className="font-bold text-orange-500">{suspendedCount}</span>
                            </div>
                            <div className="flex justify-between border-b pb-2">
                                <span>Trialists</span>
                                <span className="font-bold text-blue-500">{trialistsCount}</span>
                            </div>
                            <div className="flex justify-between border-b pb-2">
                                <span>U23 Players</span>
                                <span className="font-bold text-slate-900">{u23Count}</span>
                            </div>
                            <div className="flex justify-between border-b pb-2">
                                <span>Homegrown Players</span>
                                <span className="font-bold text-slate-900">{homegrownCount}</span>
                            </div>
                            <div className="flex justify-between border-b pb-2">
                                <span>Captain</span>
                                <span className="font-bold text-slate-900">
                                    {captainPlayer ? `${captainPlayer.firstName} ${captainPlayer.lastName}` : "None"}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span>Vice Captain</span>
                                <span className="font-bold text-slate-900">
                                    {viceCaptainPlayer ? `${viceCaptainPlayer.firstName} ${viceCaptainPlayer.lastName}` : "None"}
                                </span>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Squad Insights (Factual insights only) */}
                    <Card className="bg-white border rounded-xl shadow-xs">
                        <CardHeader className="pb-3 border-b">
                            <CardTitle className="text-xs font-black uppercase text-slate-500 tracking-wider">Squad Insights</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-3.5 text-xs font-semibold space-y-2">
                            <div className="space-y-2.5 max-h-[160px] overflow-y-auto pr-1">
                                {squadPlanningInsights.length === 0 ? (
                                    <p className="text-slate-400 italic font-normal">No insights recorded.</p>
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

                    {/* Recruitment Priorities (Factual coverage priorities) */}
                    <Card className="bg-white border rounded-xl shadow-xs">
                        <CardHeader className="pb-3 border-b">
                            <CardTitle className="text-xs font-black uppercase text-slate-500 tracking-wider">Recruitment Priorities</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-3.5 text-xs space-y-3">
                            {recruitmentPriorities.length === 0 ? (
                                <p className="text-slate-400 italic text-center py-2">No coverage shortages recorded.</p>
                            ) : (
                                recruitmentPriorities.map((item, idx) => (
                                    <div key={idx} className="bg-slate-50 p-3 rounded-lg border border-slate-200 flex justify-between items-start">
                                        <div className="space-y-1">
                                            <span className="font-black text-slate-900 block text-xs">Priority: {item.title}</span>
                                            <span className="text-[10px] text-slate-500 leading-normal block">Reason: {item.reason}</span>
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

                    {/* Accordion List for Positional Depth Chart (Rankings) */}
                    <div className="space-y-3 bg-white p-4 rounded-xl border shadow-sm">
                        <div className="flex items-center justify-between border-b pb-3">
                            <h3 className="text-xs font-black uppercase text-slate-500 tracking-wider">Position Rankings</h3>
                            <span className="text-[9px] bg-slate-100 text-slate-500 font-bold px-2 py-0.5 rounded">Drag to reorder rankings</span>
                        </div>

                        <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
                            {Array.from(new Set(activePositions.map(pos => pos.label))).map((posLabel) => {
                                const posPlayers = getActivePosPlayers(posLabel);
                                const isExpanded = !!expandedPositions[posLabel];

                                // Compute positional stats
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
                                        {/* Accordion Trigger Header */}
                                        <div
                                            onClick={() => toggleAccordion(posLabel)}
                                            className="flex items-center justify-between p-3.5 cursor-pointer bg-slate-50 hover:bg-slate-100 border-b transition-colors select-none"
                                        >
                                            <div className="flex items-center gap-2">
                                                <span className="font-black text-xs text-slate-900 w-10 block">{posLabel}</span>
                                                <span className="text-[10px] text-slate-400 font-bold hidden sm:inline">({POSITION_FULL_NAMES[posLabel] || posLabel})</span>
                                            </div>
                                            
                                            <div className="flex items-center gap-2">
                                                <Badge className="bg-slate-200 text-slate-800 text-[8px] font-black uppercase">
                                                    {posPlayers.length} Players
                                                </Badge>
                                                {isExpanded ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                                            </div>
                                        </div>

                                        {/* Accordion Expanded Content (Manager-Controlled Ranks) */}
                                        {isExpanded && (
                                            <div className="p-3.5 space-y-3 bg-white">
                                                {/* Positional Stats Ticker */}
                                                <div className="grid grid-cols-3 gap-2 bg-slate-50 p-2.5 rounded-lg border text-[9px] text-slate-655 font-bold mb-2">
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
                                                        // Manager-controlled Choice Hierarchy
                                                        const rankLabel = index === 0 ? "1st Choice" : index === 1 ? "2nd Choice" : index === 2 ? "3rd Choice" : index === 3 ? "4th Choice" : `${index + 1}th Choice`;
                                                        
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
                                                                        index === 0 ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-655'
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

            {/* Setup Wizard Modal (Suggestion 6) */}
            {showSetupWizard && uniqueFormationLabels.length > 0 && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-[#0b0f19] border border-gray-800 text-white rounded-2xl w-full max-w-lg p-6 space-y-6 shadow-2xl relative">
                        <div className="flex justify-between items-center border-b border-gray-800 pb-3">
                            <div>
                                <h3 className="text-sm font-black uppercase text-gray-300 tracking-wider">Step {wizardStep + 1} of {uniqueFormationLabels.length}</h3>
                                <h2 className="text-lg font-bold text-white mt-1">Rank your {POSITION_FULL_NAMES[uniqueFormationLabels[wizardStep]] || uniqueFormationLabels[wizardStep]}s</h2>
                            </div>
                            <button 
                                onClick={() => {
                                    localStorage.setItem(`clubflow_squad_planner_setup_done_${activeSquadTab}`, "skipped");
                                    setShowSetupWizard(false);
                                }}
                                className="text-gray-400 hover:text-white text-xs font-bold hover:underline bg-slate-950/20 px-2 py-1 rounded"
                            >
                                Skip Squad Depth Setup
                            </button>
                        </div>

                        <div className="space-y-3">
                            <p className="text-xs text-gray-400 leading-normal">
                                Drag players into your preferred squad hierarchy order. The first player will be set as your 1st choice starter.
                            </p>

                            <div className="bg-slate-950 p-3 rounded-xl border border-gray-850 space-y-2 max-h-[280px] overflow-y-auto">
                                {(() => {
                                    const currentPos = uniqueFormationLabels[wizardStep];
                                    const posPlayers = getActivePosPlayers(currentPos);
                                    
                                    if (posPlayers.length === 0) {
                                        return <p className="text-xs text-gray-500 italic text-center py-6">No players currently assigned to this position.</p>;
                                    }

                                    return posPlayers.map((p, index) => (
                                        <div 
                                            key={p.id}
                                            draggable
                                            onDragStart={() => handleDragStart(p.id, currentPos)}
                                            onDragOver={(e) => handleDragOverItem(e, index, currentPos)}
                                            className="flex items-center justify-between p-2.5 bg-[#0b0f19] border border-gray-800 rounded-lg text-xs"
                                        >
                                            <div className="flex items-center gap-2">
                                                <GripVertical className="h-3.5 w-3.5 text-gray-500 shrink-0 cursor-grab" />
                                                <span className="font-bold text-white">{p.firstName} {p.lastName}</span>
                                            </div>
                                            <Badge className="bg-slate-800 text-gray-300 text-[9px] font-bold">
                                                {index === 0 ? "1st Choice" : `${index + 1} Choice`}
                                            </Badge>
                                        </div>
                                    ));
                                })()}
                            </div>
                        </div>

                        <div className="flex justify-between items-center pt-3 border-t border-gray-800">
                            <button
                                disabled={wizardStep === 0}
                                onClick={() => setWizardStep(prev => prev - 1)}
                                className="px-4 py-2 rounded-lg bg-slate-950 hover:bg-slate-900 border border-gray-800 text-xs font-bold text-gray-300 disabled:opacity-50"
                            >
                                Back
                            </button>
                            <button
                                onClick={() => {
                                    if (wizardStep < uniqueFormationLabels.length - 1) {
                                        setWizardStep(prev => prev + 1);
                                    } else {
                                        localStorage.setItem(`clubflow_squad_planner_setup_done_${activeSquadTab}`, "done");
                                        setShowSetupWizard(false);
                                    }
                                }}
                                className="px-5 py-2 rounded-lg bg-red-650 text-white text-xs font-bold hover:bg-red-700"
                            >
                                {wizardStep === uniqueFormationLabels.length - 1 ? "Complete Setup" : "Next Position"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

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
