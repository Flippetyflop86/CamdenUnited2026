"use client";

import { useState, useEffect } from "react";
import { OppositionTeam } from "@/types";
import { FORMATIONS, FORMATION_NAMES } from "@/lib/formations";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Edit2, Save, X, FileDown, History, ChevronRight } from "lucide-react";
import { useClub } from "@/context/club-context";
import { supabase } from "@/lib/supabase";

export default function OppositionReportsPage() {
    const { settings } = useClub();
    const [teams, setTeams] = useState<OppositionTeam[]>([]);
    const [selectedTeam, setSelectedTeam] = useState<OppositionTeam | null>(null);
    const [isEditing, setIsEditing] = useState(true); // Default to editing mode for new report
    const [editedTeam, setEditedTeam] = useState<OppositionTeam | null>(null);

    // ... (keep state) ...

    // Load Teams from Supabase
    useEffect(() => {
        fetchTeams();

        const channel = supabase
            .channel("public:opposition_teams")
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "opposition_teams" },
                () => fetchTeams()
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, []);

    async function fetchTeams() {
        const { data, error } = await supabase.from("opposition_teams").select("*");
        if (error) {
            console.error("Error fetching teams:", error);
            return;
        }

        const mapped: OppositionTeam[] = (data || []).map((t: any) => ({
            id: t.id,
            name: t.name,
            formation: t.formation,
            notes: t.notes || {},
            lineup: t.lineup || [],
            createdAt: t.created_at,
            updatedAt: t.updated_at
        }));

        setTeams(mapped);

        // If we have teams and no selection, maybe don't select? 
        // Or keep logic of new report if empty.
        if (mapped.length === 0) {
            handleStartNewReport();
        }
    }

    const handleStartNewReport = () => {
        const newTeam: OppositionTeam = {
            id: "new",
            name: "",
            formation: "4-4-2",
            notes: {
                buildUp: "",
                inPossession: "",
                outOfPossession: "",
                outOfPossessionGoalKicks: "",
                transition: "",
                setPieces: "",
                keyPersonnel: "",
                consistencyOfPersonnel: "",
                strengths: "",
                weaknesses: "",
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
        setSelectedTeam(null);
        setEditedTeam(newTeam);
        setIsEditing(true);
    };

    const handleDeleteTeam = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm("Delete this opposition report?")) return;

        // Optimistic
        setTeams(prev => prev.filter(t => t.id !== id));
        if (selectedTeam?.id === id) {
            handleStartNewReport();
        }

        const { error } = await supabase.from("opposition_teams").delete().eq("id", id);
        if (error) {
            alert("Error deleting team");
            fetchTeams();
        }
    };

    // ... (handleSelectTeam, handleEditTeam remain same) ...

    const handleSaveTeam = async () => {
        if (!editedTeam) return;
        if (!editedTeam.name.trim()) {
            alert("Please enter a team name");
            return;
        }

        const isNew = editedTeam.id === "new" || !editedTeam.id.includes("-"); // Rough check

        const payload = {
            name: editedTeam.name,
            formation: editedTeam.formation,
            notes: editedTeam.notes,
            lineup: editedTeam.lineup,
            updated_at: new Date().toISOString()
        };

        try {
            let savedId = editedTeam.id;

            if (isNew) {
                // INSERT
                const { data, error } = await supabase.from("opposition_teams").insert([payload]).select().single();
                if (error) throw error;
                if (data) {
                    savedId = data.id;
                    // Update state with returned data to get real ID
                    const newT: OppositionTeam = {
                        ...editedTeam,
                        id: data.id,
                        createdAt: data.created_at,
                        updatedAt: data.updated_at
                    };
                    setSelectedTeam(newT);
                    setTeams(prev => [...prev, newT]);
                }
            } else {
                // UPDATE
                const { error } = await supabase.from("opposition_teams").update(payload).eq("id", editedTeam.id);
                if (error) throw error;

                setSelectedTeam({ ...editedTeam, updatedAt: new Date().toISOString() });
                // Optimistic update of list
                setTeams(prev => prev.map(t => t.id === editedTeam.id ? { ...editedTeam, updatedAt: new Date().toISOString() } : t));
            }

            setIsEditing(false);
            setEditedTeam(null);
            fetchTeams(); // Sync full state to be safe
        } catch (e: any) {
            alert("Error saving report: " + e.message);
        }
    };

    const handleCancelEdit = () => {
        if (selectedTeam) {
            // Cancel editing existing team
            setIsEditing(false);
            setEditedTeam(null);
        } else {
            // Cancel creating new team - maybe just reset form?
            // Or do nothing? Let's just reset to a fresh blank.
            handleStartNewReport();
        }
    };



    const handleExportPDF = () => {
        const teamToExport = isEditing ? editedTeam : selectedTeam;
        if (!teamToExport) return;

        // Create a printable HTML structure
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        const formationFn = FORMATIONS[teamToExport.formation] || [];

        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>${teamToExport.name} - Opposition Report</title>
                <style>
                    body { font-family: 'Segoe UI', sans-serif; padding: 40px; max-width: 900px; margin: 0 auto; color: #1e293b; }
                    .header { border-bottom: 3px solid #dc2626; padding-bottom: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: flex-end; }
                    .header-left { display: flex; align-items: center; gap: 20px; }
                    .logo { height: 80px; width: auto; object-fit: contain; }
                    h1 { color: #1e293b; margin: 0; font-size: 2.5em; line-height: 1; }
                    .meta { text-align: right; color: #64748b; font-size: 0.9em; }
                    .formation-container { background: #166534; padding: 20px; border-radius: 12px; margin: 20px 0; position: relative; height: 500px; border: 4px solid #14532d; }
                    
                    /* Pitch Markings */
                    .pitch-line { position: absolute; background: rgba(255,255,255,0.3); }
                    .center-line { width: 100%; height: 2px; top: 50%; left: 0; }
                    .center-circle { width: 100px; height: 100px; border: 2px solid rgba(255,255,255,0.3); border-radius: 50%; top: 50%; left: 50%; transform: translate(-50%, -50%); }
                    .box-top { width: 200px; height: 100px; border: 2px solid rgba(255,255,255,0.3); border-top: none; top: 0; left: 50%; transform: translateX(-50%); }
                    .box-bottom { width: 200px; height: 100px; border: 2px solid rgba(255,255,255,0.3); border-bottom: none; bottom: 0; left: 50%; transform: translateX(-50%); }

                    .player { position: absolute; transform: translate(-50%, -50%); display: flex; flex-direction: column; align-items: center; }
                    .player-dot { width: 32px; height: 32px; background: white; border: 3px solid #dc2626; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.2); }
                    .player-label { background: rgba(0,0,0,0.8); color: white; padding: 2px 6px; border-radius: 4px; font-size: 10px; margin-top: 4px; font-weight: 600; white-space: nowrap; }
                    
                    .grid-notes { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 30px; }
                    .note-section { break-inside: avoid; background: #f8fafc; border-radius: 8px; padding: 15px; border-left: 4px solid #cbd5e1; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
                    .note-title { font-weight: bold; color: #334155; margin-bottom: 8px; font-size: 0.9em; text-transform: uppercase; letter-spacing: 0.5px; }
                    .note-content { font-size: 0.95em; line-height: 1.5; white-space: pre-wrap; }
                    
                    /* Colors matching the UI */
                    .border-blue { border-left-color: #3b82f6; } .text-blue { color: #1d4ed8; }
                    .border-green { border-left-color: #22c55e; } .text-green { color: #15803d; }
                    .border-red { border-left-color: #ef4444; } .text-red { color: #b91c1c; }
                    .border-purple { border-left-color: #a855f7; } .text-purple { color: #7e22ce; }
                    .border-orange { border-left-color: #f97316; } .text-orange { color: #c2410c; }
                    .border-yellow { border-left-color: #eab308; } .text-yellow { color: #a16207; }

                    @media print {
                        body { padding: 0; }
                        .formation-container { page-break-inside: avoid; }
                        .grid-notes { display: block; }
                        .note-section { margin-bottom: 20px; border: 1px solid #e2e8f0; border-left-width: 4px; }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <div class="header-left">
                        ${settings.logo ? `<img src="${settings.logo}" class="logo" />` : ''}
                        <div>
                            <div style="font-size: 12px; font-weight: bold; color: #dc2626; text-transform: uppercase; margin-bottom: 5px;">${settings.name} Opposition Analysis</div>
                            <h1>${teamToExport.name}</h1>
                        </div>
                    </div>
                    <div class="meta">
                        <div><strong>Formation:</strong> ${teamToExport.formation}</div>
                        <div>${new Date(teamToExport.updatedAt).toLocaleDateString()}</div>
                    </div>
                </div>

                <div class="formation-container">
                    <div class="pitch-line center-line"></div>
                    <div class="pitch-line center-circle"></div>
                    <div class="pitch-line box-top"></div>
                    <div class="pitch-line box-bottom"></div>
                    
                    ${formationFn.map((pos, idx) => `
                        <div class="player" style="left: ${pos.x}%; top: ${pos.y}%;">
                            <div class="player-dot">${pos.number}</div>
                            <div class="player-label">${pos.label}</div>
                            ${teamToExport.lineup && teamToExport.lineup[idx] ? `<div style="background: white; color: black; padding: 2px 4px; border-radius: 4px; font-size: 10px; margin-top: 2px; font-weight: bold; white-space: nowrap; box-shadow: 0 1px 2px rgba(0,0,0,0.1);">${teamToExport.lineup[idx]}</div>` : ''}
                        </div>
                    `).join('')}
                </div>

                <div class="grid-notes">
                    <div class="note-section border-blue">
                        <div class="note-title text-blue">Build Up (Goal Kicks)</div>
                        <div class="note-content">${teamToExport.notes.buildUp || 'No notes recorded.'}</div>
                    </div>
                    <div class="note-section border-green">
                        <div class="note-title text-green">In Possession</div>
                        <div class="note-content">${teamToExport.notes.inPossession || 'No notes recorded.'}</div>
                    </div>
                    <div class="note-section border-red">
                        <div class="note-title text-red">Out Of Possession</div>
                        <div class="note-content">${teamToExport.notes.outOfPossession || 'No notes recorded.'}</div>
                    </div>
                    <div class="note-section border-purple">
                        <div class="note-title text-purple">Transition</div>
                        <div class="note-content">${teamToExport.notes.transition || 'No notes recorded.'}</div>
                    </div>
                    <div class="note-section border-orange">
                        <div class="note-title text-orange">Set Pieces</div>
                        <div class="note-content">${teamToExport.notes.setPieces || 'No notes recorded.'}</div>
                    </div>
                    <div class="note-section border-yellow">
                        <div class="note-title text-yellow">Key Players</div>
                        <div class="note-content">${teamToExport.notes.keyPersonnel || 'No notes recorded.'}</div>
                    </div>
                </div>
                
                <script>window.print();</script>
            </body >
            </html >
        `);
        printWindow.document.close();
    };

    // Derived state for display
    const currentTeam = isEditing ? editedTeam : selectedTeam;
    // Don't crash if something is null unexpectedly (though our logic tries to prevent it)
    const displayTeam = currentTeam || {
        name: "New Opposition Team",
        formation: "4-4-2",
        notes: {}
    } as OppositionTeam;

    // Safety check for notes
    if (displayTeam && !displayTeam.notes) {
        displayTeam.notes = {
            buildUp: "",
            inPossession: "",
            outOfPossession: "",
            outOfPossessionGoalKicks: "",
            transition: "",
            setPieces: "",
            keyPersonnel: "",
            consistencyOfPersonnel: "",
            strengths: "",
            weaknesses: "",
        };
    }

    const formation = FORMATIONS[displayTeam.formation] || [];

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-slate-900">Opposition Reports</h2>
                    <p className="text-slate-500">Create detailed scouting reports and match plans</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Left Panel - Sidebar (Team List) - Span 3 */}
                <Card className="lg:col-span-3 h-fit sticky top-6">
                    <CardHeader className="pb-3">
                        <Button
                            onClick={handleStartNewReport}
                            className="w-full bg-red-600 hover:bg-red-700 text-white shadow-sm"
                        >
                            <Plus className="h-4 w-4 mr-2" />
                            New Report
                        </Button>
                    </CardHeader>
                    <CardContent className="px-2 pb-2">
                        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-2 mb-2">History</div>
                        {teams.length === 0 ? (
                            <div className="p-4 text-center text-sm text-slate-400 italic">
                                No saved reports yet.
                            </div>
                        ) : (
                            <div className="space-y-1 max-h-[600px] overflow-y-auto">
                                {teams.map(team => (
                                    <div
                                        key={team.id}
                                        onClick={() => handleSelectTeam(team)}
                                        className={`group flex items - center justify - between p - 3 rounded - md cursor - pointer transition - all ${selectedTeam?.id === team.id
                                            ? "bg-slate-100 ring-1 ring-slate-200 shadow-sm"
                                            : "hover:bg-slate-50"
                                            } `}
                                    >
                                        <div className="flex-1 min-w-0">
                                            <div className={`font - medium truncate ${selectedTeam?.id === team.id ? 'text-red-700' : 'text-slate-700'} `}>
                                                {team.name}
                                            </div>
                                            <div className="text-[10px] text-slate-500 flex items-center">
                                                <History className="h-3 w-3 mr-1" />
                                                {new Date(team.updatedAt).toLocaleDateString()}
                                            </div>
                                        </div>
                                        <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6 text-slate-400 hover:text-red-600"
                                                onClick={(e) => handleDeleteTeam(team.id, e)}
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </Button>
                                            {selectedTeam?.id === team.id && (
                                                <ChevronRight className="h-4 w-4 text-red-500 ml-1" />
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Right Panel - Editor/Viewer - Span 9 */}
                <div className="lg:col-span-9 space-y-6">
                    {/* Main Content Area */}
                    <div className="flex flex-col gap-6">

                        {/* 1. Header & Controls */}
                        <Card className="border-red-100 shadow-sm">
                            <CardContent className="p-5">
                                <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
                                    <div className="flex-1 w-full">
                                        {isEditing ? (
                                            <div className="space-y-1">
                                                <label className="text-xs font-semibold text-slate-500 uppercase">Opposition Name</label>
                                                <Input
                                                    value={editedTeam?.name || ""}
                                                    onChange={(e) => setEditedTeam(prev => prev ? { ...prev, name: e.target.value } : null)}
                                                    className="text-2xl font-bold h-12"
                                                    placeholder="e.g. AFC Richmond"
                                                    autoFocus={!selectedTeam} // Autofocus if new report
                                                />
                                            </div>
                                        ) : (
                                            <div>
                                                <div className="text-xs font-semibold text-slate-500 uppercase flex items-center gap-2">
                                                    Report for
                                                    <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-600 font-mono text-[10px]">
                                                        {new Date(displayTeam.updatedAt).toLocaleDateString()}
                                                    </span>
                                                </div>
                                                <h1 className="text-3xl font-bold text-slate-900 mt-1">{displayTeam.name}</h1>
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-2 w-full md:w-auto">
                                        {isEditing ? (
                                            <>
                                                <Button onClick={handleSaveTeam} className="bg-green-600 hover:bg-green-700 flex-1 md:flex-none">
                                                    <Save className="h-4 w-4 mr-2" />
                                                    Save Report
                                                </Button>
                                                <Button onClick={handleCancelEdit} variant="outline" className="flex-1 md:flex-none">
                                                    <X className="h-4 w-4 mr-2" />
                                                    Cancel
                                                </Button>
                                            </>
                                        ) : (
                                            <>
                                                <Button onClick={handleEditTeam} variant="outline" className="border-slate-300">
                                                    <Edit2 className="h-4 w-4 mr-2" />
                                                    Edit
                                                </Button>
                                                <Button onClick={handleExportPDF} variant="outline" className="border-slate-300 text-blue-600 hover:text-blue-700 hover:bg-blue-50">
                                                    <FileDown className="h-4 w-4 mr-2" />
                                                    Export PDF
                                                </Button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* 2. Formation & Pitch */}
                        <div className="flex flex-col gap-6">
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-medium text-slate-500 uppercase tracking-wider">Formation Setup</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <select
                                        value={displayTeam.formation}
                                        onChange={(e) => {
                                            if (isEditing && editedTeam) {
                                                setEditedTeam({ ...editedTeam, formation: e.target.value });
                                            }
                                        }}
                                        disabled={!isEditing}
                                        className="w-full px-3 py-2 border rounded-md text-sm bg-white focus:ring-2 focus:ring-red-500 outline-none disabled:bg-slate-50 disabled:text-slate-500"
                                    >
                                        {FORMATION_NAMES.map(name => (
                                            <option key={name} value={name}>{name}</option>
                                        ))}
                                    </select>

                                    <div className="mt-4 p-3 bg-slate-50 rounded text-xs text-slate-500 leading-relaxed">
                                        Select the formation to visualize the team structure on the pitch. This will be included in the PDF export.
                                    </div>


                                </CardContent>
                            </Card>

                            <Card className="overflow-hidden border-0 shadow-md ring-1 ring-slate-200">
                                <CardContent className="p-0">
                                    <div className="relative w-full bg-emerald-600" style={{ paddingBottom: "105%" }}>
                                        {/* Pitch markings */}
                                        <div className="absolute inset-0 opacity-40">
                                            <div className="absolute inset-4 border-2 border-white/60 rounded-sm"></div>
                                            <div className="absolute left-4 right-4 top-1/2 border-t-2 border-white/60"></div>
                                            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 border-2 border-white/60 rounded-full"></div>
                                            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-white rounded-full"></div>
                                            <div className="absolute left-1/2 -translate-x-1/2 top-4 w-32 h-16 border-2 border-white/60 border-t-0"></div>
                                            <div className="absolute left-1/2 -translate-x-1/2 bottom-4 w-32 h-16 border-2 border-white/60 border-b-0"></div>

                                            {/* Watermark */}
                                            {settings.logo && (
                                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
                                                    <img src={settings.logo} alt="Watermark" className="w-64 h-64 object-contain grayscale brightness-125" />
                                                </div>
                                            )}
                                        </div>

                                        {/* Player positions */}
                                        {formation.map((pos, idx) => {
                                            // Determine if player is in top half (GK/Def) or bottom half (Mid/Att)
                                            // We use 45% as cut-off to be safe
                                            const isTopHalf = pos.y < 45;

                                            return (
                                                <div
                                                    key={idx}
                                                    className="absolute z-10"
                                                    style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
                                                >
                                                    {/* The Dot - Always Centered on the Coordinate */}
                                                    <div className="absolute -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-white border-2 border-red-600 rounded-full flex items-center justify-center shadow-lg cursor-default z-20 group">
                                                        <span className="text-[10px] font-bold text-slate-900">{pos.number}</span>
                                                    </div>

                                                    {/* Labels & Inputs - Positioned Relative to Dot */}
                                                    {/* If Top Half: Render BELOW dot (top-5) */}
                                                    {/* If Bottom Half: Render ABOVE dot (bottom-5) and reverse column so input is furthest out */}
                                                    <div className={`absolute -translate-x-1/2 flex flex-col items-center gap-1 w-32 z-30 ${isTopHalf ? 'top-5' : 'bottom-5 flex-col-reverse'
                                                        }`}>
                                                        {/* Position Label */}
                                                        <span className="text-[9px] font-bold text-white bg-slate-900/40 px-1.5 py-0.5 rounded backdrop-blur-sm shadow-sm">
                                                            {pos.label}
                                                        </span>

                                                        {/* Player Name Edit/Display */}
                                                        <div className="pointer-events-auto">
                                                            {isEditing ? (
                                                                <input
                                                                    type="text"
                                                                    value={editedTeam?.lineup?.[idx] || ""}
                                                                    onChange={(e) => {
                                                                        if (!editedTeam) return;
                                                                        const newLineup = [...(editedTeam.lineup || [])];
                                                                        while (newLineup.length <= idx) newLineup.push("");
                                                                        newLineup[idx] = e.target.value;
                                                                        setEditedTeam({ ...editedTeam, lineup: newLineup });
                                                                    }}
                                                                    className="w-24 text-[10px] text-center bg-white/95 border border-slate-300 rounded px-1.5 py-1 text-slate-900 shadow-sm focus:ring-2 focus:ring-red-500 outline-none placeholder:text-slate-400 opacity-90 hover:opacity-100 transition-opacity"
                                                                    placeholder="Player"
                                                                />
                                                            ) : (
                                                                displayTeam.lineup && displayTeam.lineup[idx] && (
                                                                    <span className="text-[10px] font-bold text-slate-900 bg-white px-2 py-0.5 rounded shadow-sm whitespace-nowrap border border-slate-200">
                                                                        {displayTeam.lineup[idx]}
                                                                    </span>
                                                                )
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        {/* 3. Detailed Notes */}
                        <div className="space-y-4">
                            <ul className="flex flex-wrap gap-4 text-sm font-medium text-slate-500 border-b border-slate-200 pb-2 mb-4">
                                <li className="text-red-600 border-b-2 border-red-600 pb-2">Full Analysis</li>
                            </ul>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="rounded-lg border bg-white shadow-sm overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 transition-all">
                                    <div className="px-3 py-2 border-b bg-slate-50 flex items-center gap-2 border-l-4 border-l-blue-500">
                                        <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                        <span className="text-xs font-bold uppercase text-blue-700">Build Up</span>
                                    </div>
                                    <textarea
                                        value={isEditing ? editedTeam?.notes.buildUp : displayTeam.notes.buildUp}
                                        onChange={(e) => {
                                            if (isEditing && editedTeam) {
                                                setEditedTeam({
                                                    ...editedTeam,
                                                    notes: { ...editedTeam.notes, buildUp: e.target.value }
                                                });
                                            }
                                        }}
                                        disabled={!isEditing}
                                        placeholder="How do they build from the back? Goal kick strategies?"
                                        className="w-full h-32 p-3 text-sm resize-none outline-none disabled:bg-white disabled:text-slate-700"
                                    />
                                </div>

                                <div className="rounded-lg border bg-white shadow-sm overflow-hidden focus-within:ring-2 focus-within:ring-green-500 transition-all">
                                    <div className="px-3 py-2 border-b bg-slate-50 flex items-center gap-2 border-l-4 border-l-green-500">
                                        <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                        <span className="text-xs font-bold uppercase text-green-700">In Possession</span>
                                    </div>
                                    <textarea
                                        value={isEditing ? editedTeam?.notes.inPossession : displayTeam.notes.inPossession}
                                        onChange={(e) => {
                                            if (isEditing && editedTeam) {
                                                setEditedTeam({
                                                    ...editedTeam,
                                                    notes: { ...editedTeam.notes, inPossession: e.target.value }
                                                });
                                            }
                                        }}
                                        disabled={!isEditing}
                                        placeholder="Attacking patterns, key combinations, style of play..."
                                        className="w-full h-32 p-3 text-sm resize-none outline-none disabled:bg-white disabled:text-slate-700"
                                    />
                                </div>

                                <div className="rounded-lg border bg-white shadow-sm overflow-hidden focus-within:ring-2 focus-within:ring-red-500 transition-all">
                                    <div className="px-3 py-2 border-b bg-slate-50 flex items-center gap-2 border-l-4 border-l-red-500">
                                        <div className="w-2 h-2 rounded-full bg-red-500"></div>
                                        <span className="text-xs font-bold uppercase text-red-700">Out Of Possession</span>
                                    </div>
                                    <textarea
                                        value={isEditing ? editedTeam?.notes.outOfPossession : displayTeam.notes.outOfPossession}
                                        onChange={(e) => {
                                            if (isEditing && editedTeam) {
                                                setEditedTeam({
                                                    ...editedTeam,
                                                    notes: { ...editedTeam.notes, outOfPossession: e.target.value }
                                                });
                                            }
                                        }}
                                        disabled={!isEditing}
                                        placeholder="Defensive shape, pressing triggers, vulnerabilities..."
                                        className="w-full h-32 p-3 text-sm resize-none outline-none disabled:bg-white disabled:text-slate-700"
                                    />
                                </div>

                                <div className="rounded-lg border bg-white shadow-sm overflow-hidden focus-within:ring-2 focus-within:ring-purple-500 transition-all">
                                    <div className="px-3 py-2 border-b bg-slate-50 flex items-center gap-2 border-l-4 border-l-purple-500">
                                        <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                                        <span className="text-xs font-bold uppercase text-purple-700">Transition</span>
                                    </div>
                                    <textarea
                                        value={isEditing ? editedTeam?.notes.transition : displayTeam.notes.transition}
                                        onChange={(e) => {
                                            if (isEditing && editedTeam) {
                                                setEditedTeam({
                                                    ...editedTeam,
                                                    notes: { ...editedTeam.notes, transition: e.target.value }
                                                });
                                            }
                                        }}
                                        disabled={!isEditing}
                                        placeholder="Counter-attacks, reaction to losing possession..."
                                        className="w-full h-32 p-3 text-sm resize-none outline-none disabled:bg-white disabled:text-slate-700"
                                    />
                                </div>

                                <div className="rounded-lg border bg-white shadow-sm overflow-hidden focus-within:ring-2 focus-within:ring-orange-500 transition-all">
                                    <div className="px-3 py-2 border-b bg-slate-50 flex items-center gap-2 border-l-4 border-l-orange-500">
                                        <div className="w-2 h-2 rounded-full bg-orange-500"></div>
                                        <span className="text-xs font-bold uppercase text-orange-700">Set Pieces</span>
                                    </div>
                                    <textarea
                                        value={isEditing ? editedTeam?.notes.setPieces : displayTeam.notes.setPieces}
                                        onChange={(e) => {
                                            if (isEditing && editedTeam) {
                                                setEditedTeam({
                                                    ...editedTeam,
                                                    notes: { ...editedTeam.notes, setPieces: e.target.value }
                                                });
                                            }
                                        }}
                                        disabled={!isEditing}
                                        placeholder="Corners, free kicks, penalties, throw-ins..."
                                        className="w-full h-32 p-3 text-sm resize-none outline-none disabled:bg-white disabled:text-slate-700"
                                    />
                                </div>

                                <div className="rounded-lg border bg-white shadow-sm overflow-hidden focus-within:ring-2 focus-within:ring-yellow-500 transition-all">
                                    <div className="px-3 py-2 border-b bg-slate-50 flex items-center gap-2 border-l-4 border-l-yellow-500">
                                        <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                                        <span className="text-xs font-bold uppercase text-yellow-700">Key Personnel</span>
                                    </div>
                                    <textarea
                                        value={isEditing ? editedTeam?.notes.keyPersonnel : displayTeam.notes.keyPersonnel}
                                        onChange={(e) => {
                                            if (isEditing && editedTeam) {
                                                setEditedTeam({
                                                    ...editedTeam,
                                                    notes: { ...editedTeam.notes, keyPersonnel: e.target.value }
                                                });
                                            }
                                        }}
                                        disabled={!isEditing}
                                        placeholder="Danger men, weak links, player tendencies..."
                                        className="w-full h-32 p-3 text-sm resize-none outline-none disabled:bg-white disabled:text-slate-700"
                                    />
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
            </div>

        </div>
    );
}
