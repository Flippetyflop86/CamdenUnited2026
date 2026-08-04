
"use client";

import { useState, useEffect } from "react";
import { Player, Position, MatchdayXI, SquadDepth } from "@/types";
import { FORMATIONS, FORMATION_NAMES, getDisplayPosition } from "@/lib/formations";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
    Shield,
    GripVertical,
    Star,
    AlertCircle,
    TrendingUp,
    Wand2,
    Save,
    Trash2,
    Plus,
    Clock,
    ChevronDown,
    ChevronUp
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useClub } from "@/context/club-context";
import { WeeklyFootballCalendar } from "@/components/calendar/WeeklyFootballCalendar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
    "LDM": "Left Defensive Midfielder",
    "RDM": "Right Defensive Midfielder",
    "CM": "Central Midfielder",
    "LCM": "Left Central Midfielder",
    "RCM": "Right Central Midfielder",
    "CAM": "Attacking Midfielder",
    "LAM": "Advanced Left 8",
    "RAM": "Advanced Right 8",
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
    if (p === "left defensive midfielder" || p === "ldm") return "LDM";
    if (p === "right defensive midfielder" || p === "rdm") return "RDM";
    if (p === "central midfielder" || p === "cm") return "CM";
    if (p === "left central midfielder" || p === "lcm") return "LCM";
    if (p === "right central midfielder" || p === "rcm") return "RCM";
    if (p === "attacking midfielder" || p === "cam") return "CAM";
    if (p === "left attacking midfielder" || p === "lam") return "LAM";
    if (p === "right attacking midfielder" || p === "ram") return "RAM";
    if (p === "left midfielder" || p === "lm") return "LM";
    if (p === "right midfielder" || p === "rm") return "RM";
    if (p === "left winger" || p === "left wing" || p === "lw") return "LW";
    if (p === "right winger" || p === "right wing" || p === "rw") return "RW";
    if (p === "striker" || p === "forward" || p === "st" || p === "centre forward" || p === "cf") return "ST";
    return "CM";
};

export default function SquadPlannerPage() {
    const { settings, isLoaded: isClubLoaded } = useClub();
    
    const currentSquads = settings.squads || ["First Team"];
    const [activeSquadTab, setActiveSquadTab] = useState<string>(currentSquads[0] || "First Team");
    const [formation, setFormation] = useState<string>("4-3-3");
    
    const [players, setPlayers] = useState<Player[]>([]);
    const [loading, setLoading] = useState(true);
    
    // DB State
    const [depthChart, setDepthChart] = useState<Record<string, string[]>>({});
    const [hasLoadedConfig, setHasLoadedConfig] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [showOnboarding, setShowOnboarding] = useState(false);

    // Planner Mode
    const [isScenarioMode, setIsScenarioMode] = useState(false);
    const [scenarioUnavailability, setScenarioUnavailability] = useState<Set<string>>(new Set());

    // Pitch Interactions
    const [selectedPos, setSelectedPos] = useState<string | null>(null);
    const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
    const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
    const [draggedPlayerId, setDraggedPlayerId] = useState<string | null>(null);

    const activePositions = FORMATIONS[formation] || FORMATIONS["4-3-3"];
    const uniqueFormationLabels = Array.from(new Set(activePositions.map(pos => pos.label)));

    const fetchData = async () => {
        setLoading(true);
        try {
            const { data: pData } = await supabase.from("players").select("*");
            let filteredPlayers: Player[] = [];
            if (pData) {
                const mapped: Player[] = pData.map((p: any) => ({
                    id: p.id,
                    firstName: p.first_name,
                    lastName: p.last_name,
                    position: p.position as Position,
                    squadNumber: p.squad_number || 0,
                    age: p.age || 0,
                    nationality: p.nationality || "British",
                    squad: p.squad,
                    medicalStatus: p.medical_status || "Available",
                    contractExpiry: p.contract_expiry || "",
                    availability: p.availability ?? true,
                    appearances: p.appearances || 0,
                    goals: p.goals || 0,
                    assists: p.assists || 0,
                    imageUrl: p.image_url,
                    notes: p.notes || "",
                    secondaryPositions: p.secondary_position ? p.secondary_position.split(",").map((s: string) => s.trim() as Position) : []
                }));

                filteredPlayers = mapped.filter(p => {
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
                setPlayers(filteredPlayers);
            }

            const { data: dData, error: dErr } = await supabase
                .from("squad_depths")
                .select("*")
                .eq("squad", activeSquadTab)
                .limit(1);
            
            if (dData && dData.length > 0) {
                setDepthChart(dData[0].depth_chart || {});
                setFormation(dData[0].formation || "4-3-3");
                setShowOnboarding(false);
            } else {
                setDepthChart({});
                setShowOnboarding(true);
            }

            setHasLoadedConfig(true);
        } catch (err) {
            console.error("Error fetching planner data:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isClubLoaded) {
            fetchData();
        }
    }, [activeSquadTab, isClubLoaded]);

    const saveToDatabase = async (newChart: Record<string, string[]>, newFormation: string) => {
        setDepthChart(newChart);
        setFormation(newFormation);
        setIsSaving(true);
        try {
            const { data: existing } = await supabase.from("squad_depths").select("id").eq("squad", activeSquadTab).limit(1);
            if (existing && existing.length > 0) {
                await supabase.from("squad_depths").update({
                    formation: newFormation,
                    depth_chart: newChart,
                    updated_at: new Date().toISOString()
                }).eq("id", existing[0].id);
            } else {
                await supabase.from("squad_depths").insert({
                    squad: activeSquadTab,
                    formation: newFormation,
                    depth_chart: newChart
                });
            }
        } catch (e) {
            console.error("Failed to save depth chart", e);
        } finally {
            setIsSaving(false);
        }
    };

    const handleFormationChange = (newFormation: string) => {
        saveToDatabase(depthChart, newFormation);
    };

    const buildIntelligently = async () => {
        setLoading(true);
        setShowOnboarding(false);
        try {
            const newChart: Record<string, string[]> = {};
            const { data: mxData } = await supabase
                .from("matchday_xis")
                .select("*")
                .eq("squad", activeSquadTab)
                .order("created_at", { ascending: false })
                .limit(1);

            let primaryAssigned = new Set<string>();
            const activeFormPositions = FORMATIONS[formation] || FORMATIONS["4-3-3"];
            const formLabels = Array.from(new Set(activeFormPositions.map(pos => pos.label)));

            formLabels.forEach(l => { newChart[l] = []; });

            if (mxData && mxData.length > 0) {
                const starters = mxData[0].starters;
                const matchFormationStr = mxData[0].formation;
                const matchPositions = FORMATIONS[matchFormationStr] || FORMATIONS["4-3-3"];
                
                Object.keys(starters).forEach(posIndex => {
                    const playerId = starters[posIndex];
                    const posDef = matchPositions[parseInt(posIndex)];
                    if (posDef && playerId) {
                        const label = posDef.label;
                        if (newChart[label]) {
                            if (!newChart[label].includes(playerId)) {
                                newChart[label].push(playerId);
                                primaryAssigned.add(playerId);
                            }
                        }
                    }
                });
            }

            const fits = (p: Player, role: string, strict: boolean) => {
                const pShort = getShortPosition(p.position);
                const rShort = getShortPosition(role);
                if (pShort === rShort) return true;
                if (!strict && p.secondaryPositions?.some(sp => getShortPosition(sp) === rShort)) return true;
                if (!strict) {
                    if (["CB", "LCB", "RCB"].includes(rShort) && ["CB", "LB", "RB", "LWB", "RWB", "CDM"].includes(pShort)) return true;
                    if (["LB", "LWB"].includes(rShort) && ["LB", "LWB", "LM", "CB"].includes(pShort)) return true;
                    if (["RB", "RWB"].includes(rShort) && ["RB", "RWB", "RM", "CB"].includes(pShort)) return true;
                    if (["CM", "CDM", "CAM", "LDM", "RDM", "LCM", "RCM", "LAM", "RAM"].includes(rShort) && ["CM", "CDM", "CAM", "LM", "RM"].includes(pShort)) return true;
                    if (["LM", "LW"].includes(rShort) && ["LM", "LW", "LB", "LWB", "ST", "CAM"].includes(pShort)) return true;
                    if (["RM", "RW"].includes(rShort) && ["RM", "RW", "RB", "RWB", "ST", "CAM"].includes(pShort)) return true;
                    if (["ST", "CF"].includes(rShort) && ["ST", "CF", "LW", "RW", "CAM"].includes(pShort)) return true;
                }
                return false;
            };

            players.forEach(p => {
                if (primaryAssigned.has(p.id)) return;
                for (const label of formLabels) {
                    if (fits(p, label, true) && newChart[label].length < 3) {
                        newChart[label].push(p.id);
                        primaryAssigned.add(p.id);
                        return;
                    }
                }
                for (const label of formLabels) {
                    if (fits(p, label, false) && newChart[label].length < 3) {
                        newChart[label].push(p.id);
                        primaryAssigned.add(p.id);
                        return;
                    }
                }
            });

            await saveToDatabase(newChart, formation);
        } catch (e) {
            console.error("Auto build failed", e);
        } finally {
            setLoading(false);
        }
    };

    const handleSkipOnboarding = () => {
        setShowOnboarding(false);
        saveToDatabase({}, formation);
    };

    const getPrimaryAssignment = (playerId: string): string | null => {
        for (const label of uniqueFormationLabels) {
            if (depthChart[label] && depthChart[label].length > 0 && depthChart[label][0] === playerId) {
                return label;
            }
        }
        for (const label of uniqueFormationLabels) {
            if (depthChart[label] && depthChart[label].includes(playerId)) {
                return label;
            }
        }
        return null;
    };
    
    const getPlayerCoverage = (player: Player) => {
        const primary = getPrimaryAssignment(player.id);
        const alsoCovers: string[] = [];
        const emergency: string[] = [];

        uniqueFormationLabels.forEach(label => {
            if (depthChart[label] && depthChart[label].includes(player.id)) {
                if (label !== primary) {
                    const pShort = getShortPosition(player.position);
                    const lShort = getShortPosition(label);
                    const isNat = pShort === lShort;
                    const isSec = player.secondaryPositions?.some(sp => getShortPosition(sp) === lShort);
                    if (isNat || isSec) {
                        alsoCovers.push(label);
                    } else {
                        emergency.push(label);
                    }
                }
            }
        });

        return { primary, alsoCovers, emergency };
    };

    const toggleScenarioAvailability = (playerId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const newSet = new Set(scenarioUnavailability);
        if (newSet.has(playerId)) {
            newSet.delete(playerId);
        } else {
            newSet.add(playerId);
        }
        setScenarioUnavailability(newSet);
    };
    
    const toggleNodeExpansion = (e: React.MouseEvent, label: string) => {
        e.stopPropagation();
        const next = new Set(expandedNodes);
        if(next.has(label)) next.delete(label);
        else next.add(label);
        setExpandedNodes(next);
    };

    const getActivePosPlayers = (posLabel: string) => {
        const ids = depthChart[posLabel] || [];
        return ids
            .map(id => players.find(p => p.id === id))
            .filter((p): p is Player => !!p && p.availability && !scenarioUnavailability.has(p.id));
    };



    const handleDragStart = (e: React.DragEvent, id: string) => {
        setDraggedPlayerId(id);
    };

    const handleDrop = (e: React.DragEvent, targetIndex: number) => {
        e.preventDefault();
        if (!selectedPos || !draggedPlayerId) return;

        const currentList = [...(depthChart[selectedPos] || [])];
        const sourceIndex = currentList.indexOf(draggedPlayerId);
        
        if (sourceIndex > -1) {
            currentList.splice(sourceIndex, 1);
            currentList.splice(targetIndex, 0, draggedPlayerId);
            saveToDatabase({ ...depthChart, [selectedPos]: currentList }, formation);
        }
        setDraggedPlayerId(null);
    };

    const removeFromPos = (playerId: string) => {
        if (!selectedPos) return;
        const currentList = [...(depthChart[selectedPos] || [])];
        const newChart = { ...depthChart, [selectedPos]: currentList.filter(id => id !== playerId) };
        saveToDatabase(newChart, formation);
    };

    const addToPos = (playerId: string) => {
        if (!selectedPos) return;
        const currentList = [...(depthChart[selectedPos] || [])];
        if (!currentList.includes(playerId)) {
            currentList.push(playerId);
            saveToDatabase({ ...depthChart, [selectedPos]: currentList }, formation);
        }
    };

    if (loading && !hasLoadedConfig) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="flex flex-col items-center gap-4">
                    <Clock className="h-8 w-8 text-slate-300 animate-spin" />
                    <p className="text-sm font-bold text-slate-400 uppercase tracking-wider">Loading Planner...</p>
                </div>
            </div>
        )
    }

    if (showOnboarding) {
        return (
            <div className="min-h-[80vh] flex flex-col items-center justify-center p-6 text-center">
                <div className="max-w-xl w-full bg-white rounded-3xl border shadow-xl p-10 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-2 bg-brand" />
                    <div className="h-16 w-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Wand2 className="h-8 w-8 text-brand" />
                    </div>
                    <h1 className="text-3xl font-black text-slate-900 mb-4 tracking-tight">Welcome to Squad Planner</h1>
                    <p className="text-slate-600 leading-relaxed mb-10">
                        To build your squad depth, we first need to understand your strongest team. We can intelligently generate a first draft using your club's recent match history, allowing you to simply refine it over time.
                    </p>
                    <div className="space-y-4">
                        <Button 
                            onClick={buildIntelligently} 
                            disabled={loading}
                            className="w-full h-14 text-lg font-bold bg-brand hover:bg-brand-dark text-white rounded-xl shadow-md hover:shadow-lg transition-all"
                        >
                            {loading ? "Generating..." : "✅ Use Saved Matchday XI (Recommended)"}
                        </Button>
                        <Button 
                            onClick={handleSkipOnboarding}
                            disabled={loading}
                            variant="outline" 
                            className="w-full h-14 text-lg font-bold border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl"
                        >
                            Build depth manually
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8 text-slate-900 pb-16 max-w-[1400px] mx-auto">
            
            {/* LEVEL 0: Football Week */}
            <WeeklyFootballCalendar title="Squad Planning Timeline" />

            {/* Header & Vision */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b pb-6">
                <div className="max-w-3xl">
                    <h1 className="text-3xl font-black tracking-tight mb-2">Squad Structure</h1>
                    <p className="text-sm text-slate-500 leading-relaxed max-w-2xl">
                        Evaluate squad balance, test formations, and identify long-term recruitment needs to ensure the squad is structurally prepared to compete across the entire season.
                    </p>
                </div>
                
                <div className="flex flex-col items-end gap-3 shrink-0">
                    <div className="flex items-center gap-4">
                        {isSaving && <span className="text-xs font-bold text-slate-400 flex items-center gap-1"><Save className="h-3 w-3" /> Saving...</span>}
                        <div className="flex items-center gap-2 bg-white border shadow-sm rounded-lg p-1.5 px-3">
                            <Label htmlFor="scenario-mode" className="text-xs font-bold text-slate-600 cursor-pointer">
                                Planning Mode: <span className={isScenarioMode ? "text-orange-500" : "text-brand"}>{isScenarioMode ? "Scenario" : "Normal"}</span>
                            </Label>
                            <Switch 
                                id="scenario-mode" 
                                checked={isScenarioMode}
                                onCheckedChange={setIsScenarioMode}
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <div className="flex bg-slate-100 p-1 rounded-xl w-fit">
                            {currentSquads.map((sq) => (
                                <button
                                    key={sq}
                                    onClick={() => setActiveSquadTab(sq)}
                                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                        activeSquadTab === sq ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
                                    }`}
                                >
                                    {sq}
                                </button>
                            ))}
                        </div>
                        
                        <div className="flex items-center gap-2 bg-white border shadow-sm rounded-lg p-1.5 pr-3">
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider pl-2">Formation</span>
                            <select
                                value={formation}
                                onChange={(e) => handleFormationChange(e.target.value)}
                                className="bg-slate-50 border border-slate-200 rounded-md font-bold py-1.5 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand cursor-pointer"
                            >
                                {FORMATION_NAMES.map(f => (
                                    <option key={f} value={f}>{f}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tactical Pitch (Hero Centerpiece) */}
            <div className="relative bg-emerald-800/95 rounded-2xl border-[6px] border-emerald-900/40 p-6 min-h-[760px] shadow-2xl flex flex-col justify-between overflow-hidden select-none mb-12">
                <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-[0.03]">
                    {Array.from({ length: 10 }).map((_, idx) => (
                        <div key={idx} className={`h-[76px] w-full ${idx % 2 === 0 ? 'bg-black' : 'bg-transparent'}`} />
                    ))}
                </div>

                <div className="absolute inset-8 border-2 border-white/20 pointer-events-none">
                    <div className="absolute top-1/2 left-0 right-0 border-t-2 border-white/20" />
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-40 border-2 border-white/20 rounded-full" />
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-72 h-32 border-2 border-white/20 border-t-0" />
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-72 h-32 border-2 border-white/20 border-b-0" />
                </div>
                
                {settings.logo && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-10">
                        <img src={settings.logo} alt="Watermark" className="w-64 h-64 object-contain grayscale brightness-125" />
                    </div>
                )}

                {isScenarioMode && (
                    <div className="absolute top-4 left-4 z-20 bg-black/60 backdrop-blur-md rounded-lg p-3 border border-orange-500/30 max-w-xs text-white/90 text-xs leading-tight shadow-xl">
                        <div className="flex items-center gap-1.5 mb-1.5 text-orange-400 font-black tracking-wider uppercase">
                            <AlertCircle className="h-4 w-4" /> Scenario Mode Active
                        </div>
                        Click the dots next to players to simulate injuries or suspensions. The depth chart will instantly recalculate without affecting your database.
                    </div>
                )}

                {/* Visual Position Nodes */}
                <div className="absolute inset-0 p-10 flex flex-col justify-between">
                    {(() => {
                        const renderedCounts: Record<string, number> = {};
                        return activePositions.map((pos) => {
                            const zoneKey = `${pos.label}_${pos.number}`;
                            
                            const positionIndex = renderedCounts[pos.label] || 0;
                            renderedCounts[pos.label] = positionIndex + 1;

                            const rawPositionPlayers = depthChart[pos.label] || [];
                            
                            const primaryPlayers: Player[] = [];
                            const alsoCovers: Player[] = [];

                            rawPositionPlayers.forEach(id => {
                                const p = players.find(x => x.id === id);
                                if (!p) return;
                                const pPrimary = getPrimaryAssignment(p.id);
                                if (pPrimary === pos.label) {
                                    primaryPlayers.push(p);
                                } else {
                                    alsoCovers.push(p);
                                }
                            });

                            const adjustedY = 12 + (pos.y * 0.76);
                            const adjustedX = pos.x;

                            const isExpanded = expandedNodes.has(pos.label);
                            const visiblePrimary = isExpanded ? primaryPlayers : primaryPlayers.slice(0, 3);

                            return (
                                <div
                                    key={zoneKey}
                                    className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center min-w-[140px] max-w-[160px] z-10 group hover:z-30 transition-transform"
                                    style={{ left: `${adjustedX}%`, top: `${adjustedY}%` }}
                                >
                                    <div 
                                        onClick={() => setSelectedPos(pos.label)}
                                        className="px-3 py-1 rounded-t-lg bg-slate-900 border-x border-t border-slate-700/80 text-[11px] font-black text-slate-200 shadow-md group-hover:bg-brand group-hover:border-brand transition-colors w-full text-center tracking-widest uppercase cursor-pointer"
                                        title="Click to edit position depth"
                                    >
                                        {getDisplayPosition(pos.label)}
                                    </div>

                                    <div className="w-full bg-slate-900/95 border-x border-b border-slate-700/80 rounded-b-lg shadow-2xl overflow-hidden backdrop-blur-md">
                                        {primaryPlayers.length > 0 ? (
                                            <div className="flex flex-col">
                                                {visiblePrimary.map((player, idx) => {
                                                    const choiceLabel = isExpanded && idx >= 3 
                                                        ? "Cover" 
                                                        : (idx === 0 ? "Starter" : idx === 1 ? "Competition" : "Rotation");
                                                        
                                                    const isUnavail = isScenarioMode && scenarioUnavailability.has(player.id);
                                                    const isRealUnavail = !player.availability;
                                                    
                                                    return (
                                                        <div 
                                                            key={player.id} 
                                                            onClick={(e) => { e.stopPropagation(); setSelectedPlayerId(player.id); }}
                                                            className={`px-2 py-2 flex flex-col border-b border-slate-800 last:border-b-0 hover:bg-slate-800 transition-colors cursor-pointer ${(isUnavail || isRealUnavail) ? 'opacity-40 grayscale' : ''}`}
                                                            title="Click to view player coverage"
                                                        >
                                                            <div className="text-[8px] font-black text-slate-500 tracking-wider uppercase mb-0.5">{choiceLabel}</div>
                                                            <div className="flex items-center justify-between">
                                                                <span className={`truncate text-[11px] font-semibold ${idx === 0 ? 'text-white' : 'text-slate-300'}`}>
                                                                    {player.firstName[0]}. {player.lastName}
                                                                </span>
                                                                {isScenarioMode && (
                                                                    <button 
                                                                        onClick={(e) => toggleScenarioAvailability(player.id, e)}
                                                                        className={`h-2.5 w-2.5 rounded-full shrink-0 ml-1 hover:scale-150 transition-transform ${isUnavail ? 'bg-red-500' : 'bg-green-500'}`} 
                                                                    />
                                                                )}
                                                                {(!isScenarioMode && isRealUnavail) && (
                                                                    <AlertCircle className="h-2.5 w-2.5 text-red-500 shrink-0 ml-1" />
                                                                )}
                                                            </div>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        ) : (
                                            <div className="flex flex-col items-center justify-center h-12 text-slate-600 text-[10px] font-bold uppercase tracking-wider bg-slate-950">
                                                <span>No Options</span>
                                            </div>
                                        )}
                                        
                                        {/* Expand Toggle */}
                                        {primaryPlayers.length > 3 && (
                                            <button 
                                                onClick={(e) => toggleNodeExpansion(e, pos.label)}
                                                className="w-full py-1.5 bg-slate-800 hover:bg-slate-700 text-[9px] font-bold text-slate-400 tracking-widest uppercase transition-colors flex items-center justify-center gap-1 border-t border-slate-700/50"
                                            >
                                                {isExpanded ? (
                                                    <><ChevronUp className="h-3 w-3" /> Hide</>
                                                ) : (
                                                    <><ChevronDown className="h-3 w-3" /> +{primaryPlayers.length - 3} More Players</>
                                                )}
                                            </button>
                                        )}
                                        
                                        {/* Also Covers Snippet */}
                                        {alsoCovers.length > 0 && (
                                            <div className="bg-slate-950 px-2 py-2 border-t border-slate-800/80">
                                                <div className="text-[8px] font-black text-slate-600 uppercase tracking-widest mb-1">Also Covers</div>
                                                <div className="flex flex-wrap gap-x-1.5 gap-y-0.5">
                                                    {alsoCovers.slice(0, 3).map(p => (
                                                        <span 
                                                            key={p.id} 
                                                            onClick={(e) => { e.stopPropagation(); setSelectedPlayerId(p.id); }}
                                                            className="text-[9px] text-slate-400 font-medium hover:text-white cursor-pointer transition-colors"
                                                            title="Click to view player coverage"
                                                        >
                                                            {p.firstName[0]}. {p.lastName}{alsoCovers.length > 1 ? ',' : ''}
                                                        </span>
                                                    ))}
                                                    {alsoCovers.length > 3 && <span className="text-[9px] text-slate-600">+{alsoCovers.length - 3}</span>}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        });
                    })()}
                </div>
            </div>


            {/* Position Depth Editor Modal */}
            <Dialog open={!!selectedPos} onOpenChange={(open) => !open && setSelectedPos(null)}>
                <DialogContent className="sm:max-w-2xl bg-slate-50 border-border p-0 overflow-hidden">
                    <div className="bg-white border-b px-6 py-4 flex items-center justify-between">
                        <div>
                            <DialogTitle className="text-xl font-black text-slate-900">
                                {selectedPos ? (POSITION_FULL_NAMES[selectedPos] || selectedPos) : ''} ({getDisplayPosition(selectedPos || '')})
                            </DialogTitle>
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-1">Depth Editor</p>
                        </div>
                    </div>
                    
                    <div className="flex h-[60vh]">
                        {/* Current Assignments */}
                        <div className="w-1/2 border-r bg-white p-4 overflow-y-auto">
                            <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider mb-4">Assigned Players</h4>
                            
                            {selectedPos && (() => {
                                const assignedIds = depthChart[selectedPos] || [];
                                if (assignedIds.length === 0) {
                                    return (
                                        <div 
                                            onDragOver={(e) => e.preventDefault()}
                                            onDrop={(e) => handleDrop(e, 0)}
                                            className="h-32 border-2 border-dashed border-slate-200 rounded-xl flex items-center justify-center text-slate-400 text-xs font-bold"
                                        >
                                            Drag players here
                                        </div>
                                    )
                                }
                                
                                return assignedIds.map((id, idx) => {
                                    const p = players.find(x => x.id === id);
                                    if (!p) return null;
                                    
                                    const primaryRole = getPrimaryAssignment(p.id);
                                    const isPrimaryHere = primaryRole === selectedPos;
                                    const fit = getShortPosition(p.position) === getShortPosition(selectedPos) ? 'Natural' 
                                              : p.secondaryPositions?.some(sp => getShortPosition(sp) === getShortPosition(selectedPos)) ? 'Secondary' 
                                              : 'Emergency';

                                    return (
                                        <div 
                                            key={p.id}
                                            draggable
                                            onDragStart={(e) => handleDragStart(e, p.id)}
                                            onDragOver={(e) => e.preventDefault()}
                                            onDrop={(e) => handleDrop(e, idx)}
                                            className="flex items-center gap-3 p-3 bg-white border shadow-sm rounded-xl mb-2 cursor-grab active:cursor-grabbing hover:border-slate-300 transition-all group"
                                        >
                                            <GripVertical className="h-4 w-4 text-slate-300" />
                                            <div className="flex-1">
                                                <div className="flex items-center justify-between">
                                                    <span className="font-bold text-sm text-slate-900">{p.firstName} {p.lastName}</span>
                                                    {!isPrimaryHere && <Badge variant="secondary" className="text-[9px] bg-slate-100 text-slate-600">Also Covers</Badge>}
                                                </div>
                                                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-1 flex gap-2">
                                                    <span>{idx === 0 ? "Starter" : idx === 1 ? "Competition" : idx === 2 ? "Rotation" : "Cover"}</span>
                                                    <span className="text-slate-300">•</span>
                                                    <span className={fit === 'Natural' ? 'text-slate-700' : fit === 'Secondary' ? 'text-slate-500' : 'text-slate-400'}>
                                                        {fit}
                                                    </span>
                                                </div>
                                            </div>
                                            <button 
                                                onClick={() => removeFromPos(p.id)}
                                                className="h-8 w-8 rounded flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    )
                                })
                            })()}
                        </div>

                        {/* Available Squad */}
                        <div className="w-1/2 bg-slate-50 p-4 overflow-y-auto">
                            <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider mb-4">Squad Options</h4>
                            <div className="space-y-2">
                                {selectedPos && players.filter(p => !(depthChart[selectedPos] || []).includes(p.id)).sort((a,b) => {
                                    const aFit = getShortPosition(a.position) === getShortPosition(selectedPos) ? 3 : a.secondaryPositions?.some(sp => getShortPosition(sp) === getShortPosition(selectedPos)) ? 2 : 1;
                                    const bFit = getShortPosition(b.position) === getShortPosition(selectedPos) ? 3 : b.secondaryPositions?.some(sp => getShortPosition(sp) === getShortPosition(selectedPos)) ? 2 : 1;
                                    return bFit - aFit;
                                }).map(p => {
                                    const fit = getShortPosition(p.position) === getShortPosition(selectedPos) ? 'Natural' 
                                              : p.secondaryPositions?.some(sp => getShortPosition(sp) === getShortPosition(selectedPos)) ? 'Secondary' 
                                              : 'Out of position';
                                    const pPrimary = getPrimaryAssignment(p.id);

                                    return (
                                        <div 
                                            key={p.id}
                                            draggable
                                            onDragStart={(e) => handleDragStart(e, p.id)}
                                            className="flex items-center justify-between p-2.5 bg-white border border-transparent rounded-lg hover:border-slate-200 transition-colors"
                                        >
                                            <div>
                                                <div className="font-bold text-sm text-slate-900">{p.firstName} {p.lastName}</div>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <span className={`text-[9px] font-bold uppercase tracking-wider ${fit === 'Natural' ? 'text-slate-700' : fit === 'Secondary' ? 'text-slate-500' : 'text-slate-400'}`}>
                                                        {fit}
                                                    </span>
                                                    {pPrimary && <span className="text-[9px] text-slate-400">(Primary: {pPrimary})</span>}
                                                </div>
                                            </div>
                                            <Button 
                                                variant="ghost" 
                                                size="sm" 
                                                className="h-7 w-7 p-0 rounded-full text-slate-400 hover:text-brand hover:bg-brand/10"
                                                onClick={() => addToPos(p.id)}
                                            >
                                                <Plus className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Player Coverage Modal */}
            <Dialog open={!!selectedPlayerId} onOpenChange={(open) => !open && setSelectedPlayerId(null)}>
                <DialogContent className="sm:max-w-md bg-white border-border">
                    {selectedPlayerId && (() => {
                        const player = players.find(p => p.id === selectedPlayerId);
                        if (!player) return null;
                        
                        const coverage = getPlayerCoverage(player);

                        return (
                            <div className="py-2">
                                <DialogHeader className="mb-6">
                                    <DialogTitle className="text-2xl font-black text-slate-900">
                                        {player.firstName} {player.lastName}
                                    </DialogTitle>
                                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-1">Player Coverage</p>
                                </DialogHeader>
                                
                                <div className="space-y-6">
                                    <div>
                                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 border-b pb-2">Primary Role</h4>
                                        {coverage.primary ? (
                                            <div className="font-bold text-lg text-slate-900">{POSITION_FULL_NAMES[coverage.primary] || coverage.primary}</div>
                                        ) : (
                                            <div className="text-sm text-slate-500 italic">No primary role assigned</div>
                                        )}
                                    </div>

                                    <div>
                                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 border-b pb-2">Also Covers</h4>
                                        {coverage.alsoCovers.length > 0 ? (
                                            <div className="flex flex-wrap gap-2">
                                                {coverage.alsoCovers.map(role => (
                                                    <Badge key={role} variant="secondary" className="bg-slate-100 text-slate-700 font-bold hover:bg-slate-200">
                                                        {POSITION_FULL_NAMES[role] || role} ({getDisplayPosition(role)})
                                                    </Badge>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="text-sm text-slate-500 italic">No secondary cover assigned</div>
                                        )}
                                    </div>

                                    <div>
                                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 border-b pb-2">Emergency Cover</h4>
                                        {coverage.emergency.length > 0 ? (
                                            <div className="flex flex-wrap gap-2">
                                                {coverage.emergency.map(role => (
                                                    <Badge key={role} variant="outline" className="text-slate-500 font-medium">
                                                        {POSITION_FULL_NAMES[role] || role} ({getDisplayPosition(role)})
                                                    </Badge>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="text-sm text-slate-500 italic">No emergency cover assigned</div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )
                    })()}
                </DialogContent>
            </Dialog>

        </div>
    );
}
