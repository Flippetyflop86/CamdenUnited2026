"use client";

import { useState, useEffect } from "react";
import { Player, Position } from "@/types";
import { FORMATIONS, FORMATION_NAMES } from "@/lib/formations";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Shield,
    CheckCircle2,
    X,
    Info,
    GripVertical,
    Star,
    AlertCircle,
    UserX,
    TrendingUp
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useClub } from "@/context/club-context";
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
    return "CM"; // default fallback
};

export default function SquadPlannerPage() {
    const { settings, isLoaded: isClubLoaded } = useClub();
    
    const currentSquads = settings.squads || ["First Team"];
    const [activeSquadTab, setActiveSquadTab] = useState<string>(currentSquads[0] || "First Team");
    const [formation, setFormation] = useState<string>("4-3-3");
    
    const [players, setPlayers] = useState<Player[]>([]);
    const [loading, setLoading] = useState(true);
    
    // Drag and drop tracking
    const [draggedPlayerId, setDraggedPlayerId] = useState<string | null>(null);
    const [draggedSourcePos, setDraggedSourcePos] = useState<string | null>(null);

    // Scenario Planning state: local set of unavailable player IDs
    const [scenarioUnavailability, setScenarioUnavailability] = useState<Set<string>>(new Set());

    // Position Details Modal
    const [selectedPos, setSelectedPos] = useState<string | null>(null);

    // Depth chart map: { [positionLabel]: playerId[] }
    const [depthChart, setDepthChart] = useState<Record<string, string[]>>({});

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
                    contractExpiry: p.contract_expiry || "",
                    availability: p.availability ?? true,
                    appearances: p.appearances || 0,
                    goals: p.goals || 0,
                    assists: p.assists || 0,
                    imageUrl: p.image_url,
                    notes: p.notes || "",
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
        const checkMatch = (pos: string, targetLabel: string): boolean => {
            const pShort = getShortPosition(pos);
            if (pShort === targetLabel) return true;
            
            if (pShort === "CB" && (targetLabel === "LCB" || targetLabel === "RCB")) return true;
            if (pShort === "CM" && (targetLabel === "LCM" || targetLabel === "RCM")) return true;
            if (pShort === "CAM" && (targetLabel === "LAM" || targetLabel === "RAM")) return true;
            if (pShort === "CDM" && (targetLabel === "LDM" || targetLabel === "RDM")) return true;
            
            if ((pShort === "LCB" || pShort === "RCB") && targetLabel === "CB") return true;
            if ((pShort === "LCM" || pShort === "RCM") && targetLabel === "CM") return true;
            if ((pShort === "LAM" || pShort === "RAM") && targetLabel === "CAM") return true;
            if ((pShort === "LDM" || pShort === "RDM") && targetLabel === "CDM") return true;
            
            return false;
        };

        if (checkMatch(p.position, posLabel)) return true;
        if (p.secondaryPositions && p.secondaryPositions.length > 0) {
            return p.secondaryPositions.some(secPos => checkMatch(secPos, posLabel));
        }
        return false;
    };

    const initializeDepthChart = (squadPlayers: Player[]) => {
        const saved = localStorage.getItem(`clubflow_squad_planner_chart_${activeSquadTab}`);
        let loadedChart: Record<string, string[]> = {};
        if (saved) {
            try {
                loadedChart = JSON.parse(saved);
            } catch (e) {
                loadedChart = {};
            }
        }

        const currentIds = new Set(squadPlayers.map(p => p.id));
        Object.keys(loadedChart).forEach(pos => {
            loadedChart[pos] = (loadedChart[pos] || []).filter(id => currentIds.has(id));
        });

        const allPossibleLabels = ["GK", "LB", "CB", "LCB", "RCB", "RB", "LWB", "RWB", "CDM", "LDM", "RDM", "CM", "LCM", "RCM", "CAM", "LAM", "RAM", "LM", "RM", "LW", "RW", "ST", "CF"];

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
        localStorage.setItem(`clubflow_squad_planner_chart_${activeSquadTab}`, JSON.stringify(loadedChart));
    };

    useEffect(() => {
        if (isClubLoaded) {
            fetchPlayers();
            
            const savedFormation = localStorage.getItem(`clubflow_squad_planner_formation_${activeSquadTab}`);
            if (savedFormation) {
                setFormation(savedFormation);
            } else {
                setFormation("4-3-3");
            }
        }
    }, [activeSquadTab, isClubLoaded]);

    const saveDepthChart = (newChart: Record<string, string[]>) => {
        setDepthChart(newChart);
        localStorage.setItem(`clubflow_squad_planner_chart_${activeSquadTab}`, JSON.stringify(newChart));
    };

    const handleFormationChange = (newFormation: string) => {
        setFormation(newFormation);
        localStorage.setItem(`clubflow_squad_planner_formation_${activeSquadTab}`, newFormation);
    };

    const handleDragStart = (playerId: string, posKey: string) => {
        setDraggedPlayerId(playerId);
        setDraggedSourcePos(posKey);
    };

    const handleDropOnPosition = (targetPos: string, targetIndex?: number) => {
        if (!draggedPlayerId || !draggedSourcePos) return;

        let newChart = { ...depthChart };
        
        if (draggedSourcePos === targetPos) {
            const list = [...(newChart[targetPos] || [])];
            const sourceIndex = list.indexOf(draggedPlayerId);
            if (sourceIndex > -1 && targetIndex !== undefined && sourceIndex !== targetIndex) {
                list.splice(sourceIndex, 1);
                list.splice(targetIndex, 0, draggedPlayerId);
                newChart[targetPos] = list;
            }
        }

        saveDepthChart(newChart);
        setDraggedPlayerId(null);
        setDraggedSourcePos(null);
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

    const activePositions = FORMATIONS[formation] || FORMATIONS["4-3-3"];
    const uniqueFormationLabels = Array.from(new Set(activePositions.map(pos => pos.label)));

    const getActivePosPlayers = (posLabel: string) => {
        const ids = depthChart[posLabel] || [];
        return ids
            .map(id => players.find(p => p.id === id))
            .filter((p): p is Player => !!p && p.availability && !scenarioUnavailability.has(p.id));
    };

    const getAllPosPlayers = (posLabel: string) => {
        const ids = depthChart[posLabel] || [];
        return ids.map(id => players.find(p => p.id === id)).filter((p): p is Player => !!p);
    };

    const isOutofPosition = (p: Player, targetLabel: string) => {
        return getShortPosition(p.position) !== getShortPosition(targetLabel);
    };

    const getUnitLabels = (unit: "GK" | "DEF" | "MID" | "ATT") => {
        const unitLabels: string[] = [];
        uniqueFormationLabels.forEach(label => {
            const p = getShortPosition(label);
            if (unit === "GK" && p === "GK") unitLabels.push(label);
            if (unit === "DEF" && ["CB", "LCB", "RCB", "LB", "RB", "LWB", "RWB"].includes(p)) unitLabels.push(label);
            if (unit === "MID" && ["CM", "LCM", "RCM", "CDM", "LDM", "RDM", "CAM", "LAM", "RAM", "LM", "RM"].includes(p)) unitLabels.push(label);
            if (unit === "ATT" && ["ST", "CF", "LW", "RW"].includes(p)) unitLabels.push(label);
        });
        return unitLabels;
    };

    const evaluateUnitBalance = (unit: "GK" | "DEF" | "MID" | "ATT") => {
        const labels = getUnitLabels(unit);
        if (labels.length === 0) return null;
        
        let totalSlots = labels.length;
        let totalNaturalCover = 0;
        let totalCover = 0;
        let issues: string[] = [];

        labels.forEach(label => {
            const active = getActivePosPlayers(label);
            const natural = active.filter(p => !isOutofPosition(p, label));
            totalNaturalCover += natural.length;
            totalCover += active.length;
            
            if (active.length === 0) issues.push(`No cover for ${label}`);
            else if (natural.length === 0) issues.push(`No natural cover for ${label}`);
        });

        let grade = "Adequate";
        let color = "text-yellow-600 bg-yellow-50 border-yellow-200";
        if (issues.length > 0) {
            grade = "Thin";
            color = "text-red-600 bg-red-50 border-red-200";
        } else if (totalNaturalCover >= totalSlots * 2) {
            grade = "Excellent";
            color = "text-emerald-600 bg-emerald-50 border-emerald-200";
        } else if (totalNaturalCover > totalSlots) {
            grade = "Good";
            color = "text-green-600 bg-green-50 border-green-200";
        }

        return { grade, color, issues, totalCover, totalNaturalCover };
    };

    const getRecruitmentPriorities = () => {
        const priorities: { title: string; reason: string; backup: string; severity: "Critical" | "High" | "Medium" }[] = [];

        uniqueFormationLabels.forEach(label => {
            const activeList = getActivePosPlayers(label);
            const naturalList = activeList.filter(p => !isOutofPosition(p, label));
            
            if (activeList.length === 0) {
                priorities.push({
                    title: `Natural ${POSITION_FULL_NAMES[label] || label}`,
                    reason: `No recognised or makeshift players available in this position.`,
                    backup: "None available.",
                    severity: "Critical"
                });
            } else if (naturalList.length === 0) {
                priorities.push({
                    title: `Natural ${POSITION_FULL_NAMES[label] || label}`,
                    reason: `No recognised natural options for this role.`,
                    backup: `Relying on ${activeList[0].firstName} ${activeList[0].lastName} (Out of Position).`,
                    severity: "High"
                });
            } else if (naturalList.length === 1) {
                priorities.push({
                    title: `Backup ${POSITION_FULL_NAMES[label] || label}`,
                    reason: `Only one recognised natural player covering this position.`,
                    backup: activeList.length > 1 ? `Makeshift cover: ${activeList[1].firstName} ${activeList[1].lastName} (${getShortPosition(activeList[1].position)})` : "No backups available.",
                    severity: "Medium"
                });
            }
        });
        
        return priorities.sort((a, b) => {
            const severityOrder = { Critical: 3, High: 2, Medium: 1 };
            return severityOrder[b.severity] - severityOrder[a.severity];
        }).slice(0, 4);
    };

    const getDisplayLabel = (label: string) => {
        const map: Record<string, string> = { 'LCB': 'CB', 'RCB': 'CB', 'LDM': 'DM', 'RDM': 'DM', 'LAM': 'CAM', 'RAM': 'CAM' };
        return map[label] || label;
    };

    const squadBalance = [
        { unit: "Goalkeepers", data: evaluateUnitBalance("GK") },
        { unit: "Defensive Depth", data: evaluateUnitBalance("DEF") },
        { unit: "Midfield Depth", data: evaluateUnitBalance("MID") },
        { unit: "Attacking Depth", data: evaluateUnitBalance("ATT") }
    ].filter(item => item.data !== null);

    const recruitmentPriorities = getRecruitmentPriorities();

    return (
        <div className="space-y-8 text-slate-900 pb-16 max-w-[1400px] mx-auto">
            
            {/* Header & Vision */}
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 border-b pb-6">
                <div className="max-w-3xl">
                    <h1 className="text-3xl font-black tracking-tight mb-2">Season Planning</h1>
                    <p className="text-sm text-slate-500 leading-relaxed max-w-2xl">
                        This module is the strategic planning workspace for the club. Evaluate squad balance, test formations, and identify long-term recruitment needs to ensure the squad is structurally prepared to compete across the entire season.
                    </p>
                </div>
                
                <div className="flex flex-col items-end gap-3 shrink-0">
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

            {/* Tactical Pitch (Hero Centerpiece) */}
            <div className="relative bg-emerald-800/95 rounded-2xl border-[6px] border-emerald-900/40 p-6 min-h-[760px] shadow-2xl flex flex-col justify-between overflow-hidden select-none mb-12">
                {/* Grass Stripe Overlays */}
                <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-[0.03]">
                    {Array.from({ length: 10 }).map((_, idx) => (
                        <div key={idx} className={`h-[76px] w-full ${idx % 2 === 0 ? 'bg-black' : 'bg-transparent'}`} />
                    ))}
                </div>

                {/* Pitch Markings */}
                <div className="absolute inset-8 border-2 border-white/20 pointer-events-none">
                    <div className="absolute top-1/2 left-0 right-0 border-t-2 border-white/20" />
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-40 border-2 border-white/20 rounded-full" />
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-72 h-32 border-2 border-white/20 border-t-0" />
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-72 h-32 border-2 border-white/20 border-b-0" />
                </div>
                
                {/* Subtle Watermark */}
                {settings.logo && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-10">
                        <img src={settings.logo} alt="Watermark" className="w-64 h-64 object-contain grayscale brightness-125" />
                    </div>
                )}

                {/* Scenario Planning Toggle Helper */}
                <div className="absolute top-4 left-4 z-20 bg-black/40 backdrop-blur-sm rounded-lg p-3 border border-white/10 max-w-xs text-white/80 text-[11px] leading-tight">
                    <div className="flex items-center gap-1.5 mb-1 text-white font-bold">
                        <AlertCircle className="h-3.5 w-3.5 text-orange-400" /> Scenario Planning
                    </div>
                    Click the dot next to a player's name to temporarily mark them unavailable (e.g. injured). The pitch will instantly recalculate your depth.
                </div>

                {/* Visual Position Nodes on the Pitch */}
                <div className="absolute inset-0 p-10 flex flex-col justify-between">
                    {(() => {
                        const renderedCounts: Record<string, number> = {};
                        return activePositions.map((pos) => {
                            const zoneKey = `${pos.label}_${pos.number}`;
                            
                            const positionIndex = renderedCounts[pos.label] || 0;
                            renderedCounts[pos.label] = positionIndex + 1;

                            const positionPlayers = getActivePosPlayers(pos.label);
                            const topPlayers = positionPlayers.slice(0, 3);

                            const adjustedY = 12 + (pos.y * 0.76);
                            const adjustedX = pos.x;

                            return (
                                <div
                                    key={zoneKey}
                                    onClick={() => setSelectedPos(pos.label)}
                                    className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center min-w-[140px] max-w-[150px] z-10 cursor-pointer group hover:z-30"
                                    style={{ left: `${adjustedX}%`, top: `${adjustedY}%` }}
                                >
                                    {/* Zone Label Header */}
                                    <div className="px-3 py-1 rounded-t-lg bg-slate-900 border-x border-t border-slate-700/80 text-[11px] font-black text-slate-200 shadow-md group-hover:bg-brand group-hover:border-brand transition-colors w-full text-center tracking-widest uppercase">
                                        {getDisplayLabel(pos.label)}
                                    </div>

                                    {/* Placed Card (Stack) */}
                                    <div className="w-full bg-slate-900/90 border-x border-b border-slate-700/80 rounded-b-lg shadow-xl overflow-hidden backdrop-blur-md">
                                        {topPlayers.length > 0 ? (
                                            <div className="flex flex-col">
                                                {topPlayers.map((player, idx) => {
                                                    const choiceLabel = idx === 0 ? "1st" : idx === 1 ? "2nd" : "3rd";
                                                    const isUnavail = scenarioUnavailability.has(player.id);
                                                    
                                                    return (
                                                        <div 
                                                            key={player.id} 
                                                            draggable
                                                            onDragStart={(e) => { e.stopPropagation(); handleDragStart(player.id, pos.label); }}
                                                            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                                                            onDrop={(e) => { e.preventDefault(); e.stopPropagation(); handleDropOnPosition(pos.label, idx); }}
                                                            className={`px-2 py-1.5 flex items-center justify-between border-b border-slate-800 last:border-b-0 hover:bg-slate-800 transition-colors ${isUnavail ? 'opacity-40 grayscale' : ''}`}
                                                        >
                                                            <div className="flex items-center gap-1.5 overflow-hidden">
                                                                <span className="text-[9px] font-bold text-slate-500 w-4">{choiceLabel}</span>
                                                                <span className={`truncate text-[11px] font-semibold ${idx === 0 ? 'text-white' : 'text-slate-300'}`}>
                                                                    {player.firstName[0]}. {player.lastName}
                                                                </span>
                                                            </div>
                                                            <button 
                                                                onClick={(e) => toggleScenarioAvailability(player.id, e)}
                                                                className={`h-2 w-2 rounded-full shrink-0 ml-1 hover:scale-150 transition-transform ${isUnavail ? 'bg-red-500' : 'bg-green-500'}`} 
                                                                title={isUnavail ? "Mark Available" : "Mark Unavailable (Scenario)"}
                                                            />
                                                        </div>
                                                    )
                                                })}
                                                {positionPlayers.length > 3 && (
                                                    <div className="px-2 py-1 bg-slate-950 text-center text-[9px] text-slate-500 font-bold uppercase tracking-wider">
                                                        +{positionPlayers.length - 3} More
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="flex flex-col items-center justify-center h-12 text-slate-600 text-[10px] font-bold uppercase tracking-wider bg-slate-950">
                                                <span>No Options</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        });
                    })()}
                </div>
            </div>

            {/* Strategic Insights Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                
                {/* Squad Balance (Replaces Position Rankings) */}
                <div className="space-y-4">
                    <h2 className="text-xl font-black tracking-tight flex items-center gap-2">
                        <Shield className="h-5 w-5 text-brand" /> Squad Balance
                    </h2>
                    <div className="grid gap-3">
                        {squadBalance.map((item, idx) => (
                            <Card key={idx} className="border shadow-sm">
                                <div className="p-4 flex items-start justify-between gap-4">
                                    <div>
                                        <h3 className="font-bold text-slate-900 mb-1">{item.unit}</h3>
                                        {item.data?.issues.length === 0 ? (
                                            <p className="text-sm text-slate-500 leading-tight">Well covered. {item.data.totalNaturalCover} natural options available across the unit.</p>
                                        ) : (
                                            <ul className="text-sm text-slate-500 leading-tight space-y-1 list-disc pl-4">
                                                {item.data?.issues.map((issue, i) => <li key={i}>{issue}</li>)}
                                            </ul>
                                        )}
                                    </div>
                                    <Badge variant="outline" className={`shrink-0 ${item.data?.color} font-bold px-3 py-1`}>
                                        {item.data?.grade}
                                    </Badge>
                                </div>
                            </Card>
                        ))}
                    </div>
                </div>

                {/* Intelligent Recruitment Priorities */}
                <div className="space-y-4">
                    <h2 className="text-xl font-black tracking-tight flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-brand" /> Recruitment Priorities
                    </h2>
                    <div className="grid gap-3">
                        {recruitmentPriorities.length === 0 ? (
                            <Card className="border shadow-sm bg-slate-50">
                                <div className="p-6 text-center text-slate-500 font-medium">
                                    No pressing recruitment priorities based on the current depth chart.
                                </div>
                            </Card>
                        ) : (
                            recruitmentPriorities.map((item, idx) => (
                                <Card key={idx} className="border shadow-sm overflow-hidden flex">
                                    <div className={`w-1.5 shrink-0 ${item.severity === 'Critical' ? 'bg-red-500' : item.severity === 'High' ? 'bg-orange-500' : 'bg-yellow-400'}`} />
                                    <div className="p-4 flex-1">
                                        <div className="flex items-center justify-between mb-1.5">
                                            <h3 className="font-bold text-slate-900">{item.title}</h3>
                                            <div className="flex gap-0.5">
                                                {Array.from({ length: item.severity === 'Critical' ? 5 : item.severity === 'High' ? 4 : 3 }).map((_, i) => (
                                                    <Star key={i} className={`h-3.5 w-3.5 fill-current ${item.severity === 'Critical' ? 'text-red-500' : item.severity === 'High' ? 'text-orange-500' : 'text-yellow-400'}`} />
                                                ))}
                                            </div>
                                        </div>
                                        <p className="text-sm text-slate-600 mb-2 font-medium">{item.reason}</p>
                                        <div className="bg-slate-50 rounded p-2 border border-slate-100 text-xs text-slate-500">
                                            <strong className="text-slate-700">Current backup:</strong> {item.backup}
                                        </div>
                                    </div>
                                </Card>
                            ))
                        )}
                    </div>
                </div>

            </div>

            {/* Position Breakdown Modal */}
            <Dialog open={!!selectedPos} onOpenChange={(open) => !open && setSelectedPos(null)}>
                <DialogContent className="sm:max-w-md bg-surface-1 border-border">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-black">
                            {selectedPos ? (POSITION_FULL_NAMES[selectedPos] || selectedPos) : ''} Depth
                        </DialogTitle>
                    </DialogHeader>
                    
                    <div className="py-4 space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                        {selectedPos && (() => {
                            const allPlayers = getAllPosPlayers(selectedPos);
                            
                            if (allPlayers.length === 0) {
                                return <p className="text-slate-500 text-sm text-center py-8">No players assigned to this role.</p>
                            }

                            return allPlayers.map((player, idx) => {
                                const roleLabel = idx === 0 ? "First Choice" : idx === 1 ? "Competing" : idx === 2 ? "Development" : "Emergency Cover";
                                const isUnavail = scenarioUnavailability.has(player.id);
                                const isRealUnavail = !player.availability;
                                const oop = isOutofPosition(player, selectedPos);

                                return (
                                    <div key={player.id} className={`flex items-center justify-between p-3 rounded-lg border ${isUnavail || isRealUnavail ? 'bg-slate-50 opacity-60 grayscale' : 'bg-white shadow-sm'}`}>
                                        <div className="flex items-center gap-3">
                                            <div className="h-10 w-10 rounded-full bg-slate-200 overflow-hidden shrink-0">
                                                {player.imageUrl ? (
                                                    <img src={player.imageUrl} alt="Profile" className="h-full w-full object-cover" />
                                                ) : (
                                                    <div className="h-full w-full flex items-center justify-center text-slate-400 font-bold bg-slate-100">
                                                        {player.firstName[0]}
                                                    </div>
                                                )}
                                            </div>
                                            <div>
                                                <div className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                                                    {player.firstName} {player.lastName}
                                                    {(isUnavail || isRealUnavail) && <span title="Unavailable"><AlertCircle className="h-3 w-3 text-red-500" /></span>}
                                                </div>
                                                <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                                                    <Badge variant="secondary" className="text-[9px] px-1.5 py-0 rounded font-black tracking-wider bg-slate-100">{roleLabel}</Badge>
                                                    {oop && <span className="text-orange-500 font-medium text-[10px]">Out of position</span>}
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <Button 
                                            variant="ghost" 
                                            size="sm" 
                                            className={`text-[10px] h-7 px-2 font-bold ${isUnavail ? 'text-green-600 hover:bg-green-50' : 'text-slate-500 hover:text-red-500 hover:bg-red-50'}`}
                                            onClick={(e) => toggleScenarioAvailability(player.id, e)}
                                        >
                                            {isUnavail ? "Mark Available" : "Simulate Injury"}
                                        </Button>
                                    </div>
                                );
                            });
                        })()}
                    </div>
                </DialogContent>
            </Dialog>

        </div>
    );
}
