"use client";

import { useState, useEffect } from "react";
import { MatchdayXI, Player, Match } from "@/types";
import { FORMATIONS, FORMATION_NAMES } from "@/lib/formations";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Save, FileDown, Calendar, MapPin, Clock, GripVertical, Trophy, MessageCircle, Search, X } from "lucide-react";
import { useClub } from "@/context/club-context";
import { supabase } from "@/lib/supabase";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const POSITION_ORDER: { [key: string]: number } = {
    'GK': 1,
    'CB': 2, 'RB': 3, 'LB': 4, 'RWB': 5, 'LWB': 6, 'DEF': 7,
    'CDM': 8, 'CM': 9, 'CAM': 10, 'RM': 11, 'LM': 12, 'MID': 13,
    'LW': 14,
    'RW': 15,
    'CF': 16, 'ST': 17, 'FWD': 18
};

export default function MatchdayXIPage() {
    const { settings } = useClub();
    const [lineup, setLineup] = useState<MatchdayXI | null>(null);
    const [players, setPlayers] = useState<Player[]>([]);
    const [isEditing, setIsEditing] = useState(false);
    const [nextMatch, setNextMatch] = useState<Match | null>(null);
    const [draggedPlayer, setDraggedPlayer] = useState<string | null>(null);
    const [draggedSource, setDraggedSource] = useState<{type: 'squad' | 'pitch' | 'sub', index?: number} | null>(null);
    const [squadFilter, setSquadFilter] = useState<"All" | "GK" | "DEF" | "MID" | "FWD">("All");
    const [activeSlot, setActiveSlot] = useState<{type: 'pitch' | 'sub', index: number, label: string} | null>(null);
    const [searchQuery, setSearchQuery] = useState("");

    const getPositionCategory = (pos: string) => {
        const p = pos.toUpperCase();
        if (['GK'].includes(p)) return 'GK';
        if (['CB', 'RB', 'LB', 'DEF', 'RWB', 'LWB'].includes(p)) return 'DEF';
        if (['CM', 'CDM', 'CAM', 'MID', 'RM', 'LM'].includes(p)) return 'MID';
        if (['ST', 'CF', 'RW', 'LW', 'FWD'].includes(p)) return 'FWD';
        return 'All';
    };

    // ... (keep state) ...

    // Load Data
    useEffect(() => {
        fetchData();

        // Subscription for realtime updates (optional but good for multi-user)
        const channel = supabase.channel('public:matchday_xis')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'matchday_xis' }, () => fetchLineupOnly())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, () => fetchPlayers())
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, []);

    const fetchData = async () => {
        await Promise.all([fetchLineupOnly(), fetchPlayers(), fetchMatches()]);
    };

    const fetchLineupOnly = async () => {
        const { data } = await supabase.from('matchday_xis').select('*').order('created_at', { ascending: false }).limit(1);
        if (data && data.length > 0) {
            setLineup({
                id: data[0].id,
                formation: data[0].formation,
                starters: data[0].starters,
                substitutes: data[0].substitutes,
                createdAt: data[0].created_at,
                updatedAt: data[0].created_at
            });
        } else {
            // Default
            setLineup({
                id: "default-xi", // Will be replaced by UUID on insert check or just handled
                formation: "4-2-3-1",
                starters: {},
                substitutes: ["", "", "", "", ""],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            });
        }
    };

    const fetchPlayers = async () => {
        const { data } = await supabase.from('players').select('*');
        if (data) {
            const mapped = data.map((p: any) => ({
                id: p.id,
                firstName: p.first_name,
                lastName: p.last_name,
                position: p.position,
                squad: p.squad,
                // Default values for required fields not needed for this view
                squadNumber: p.squad_number || 0,
                age: p.age || 0,
                nationality: p.nationality || "Unknown",
                medicalStatus: p.medical_status || "Available",
                contractExpiry: p.contract_expiry || "",
                availability: p.availability ?? true,
                appearances: p.appearances || 0,
                goals: p.goals || 0,
                assists: p.assists || 0,
                imageUrl: p.image_url, // Added mapping
            }));

            // Sort logic using global POSITION_ORDER
            setPlayers(mapped.sort((a: any, b: any) => {
                const orderA = POSITION_ORDER[a.position.toUpperCase()] || 99;
                const orderB = POSITION_ORDER[b.position.toUpperCase()] || 99;
                if (orderA !== orderB) return orderA - orderB;
                return a.lastName.localeCompare(b.lastName);
            }));
        }
    };

    const fetchMatches = async () => {
        const { data } = await supabase.from('matches').select('*').eq('result', 'Pending').order('date', { ascending: true });
        if (data && data.length > 0) {
            // Find next match relative to today (uses YYYY-MM-DD string comparison to persist through the whole match day until midnight)
            const today = new Date().toISOString().split('T')[0];
            const upcoming = data.find((m: any) => m.date >= today);
            if (upcoming) {
                setNextMatch({
                    id: upcoming.id,
                    opponent: upcoming.opponent,
                    date: upcoming.date,
                    time: upcoming.time,
                    competition: upcoming.competition || "League",
                    isHome: upcoming.is_home,
                    result: upcoming.result,
                    // Remove extra fields not in Match interface
                    // location: upcoming.location, 
                    // stats: upcoming.stats,
                    // goals: upcoming.goals
                });
            }
        }
    };

    const saveLineup = async (newLineup: MatchdayXI) => {
        const payload = {
            formation: newLineup.formation,
            starters: newLineup.starters,
            substitutes: newLineup.substitutes,
            created_at: new Date().toISOString()
        };

        if (newLineup.id === "default-xi") {
            const { data, error } = await supabase.from('matchday_xis').insert([payload]).select();
            if (error) {
                console.error("Save Lineup Error:", error);
                alert("Database Error: " + error.message + " (Have you run the SQL script for matchday_xis?)");
                return;
            }
            if (data && data.length > 0) {
                setLineup({ ...newLineup, id: data[0].id });
            }
        } else {
            const { error } = await supabase.from('matchday_xis').update(payload).eq('id', newLineup.id);
            if (error) {
                console.error("Update Lineup Error:", error);
                alert("Database Error: " + error.message);
            }
        }
    };

    const handleFormationChange = (newFormation: string) => {
        if (lineup) {
            const updated = {
                ...lineup,
                formation: newFormation,
                starters: lineup.starters, // Preserve existing players, they will just map to the new positions at the same indices
                updatedAt: new Date().toISOString(),
            };
            setLineup(updated);
            saveLineup(updated);
        }
    };

    const handleStarterChange = (positionIndex: number, playerId: string) => {
        if (lineup) {
            const updated = {
                ...lineup,
                starters: {
                    ...lineup.starters,
                    [positionIndex]: playerId,
                },
                updatedAt: new Date().toISOString(),
            };
            setLineup(updated);
            saveLineup(updated);
        }
    };

    const handleSubChange = (subIndex: number, playerId: string) => {
        if (lineup) {
            const newSubs = [...lineup.substitutes];
            newSubs[subIndex] = playerId;
            const updated = {
                ...lineup,
                substitutes: newSubs,
                updatedAt: new Date().toISOString(),
            };
            setLineup(updated);
            saveLineup(updated);
        }
    };

    const handleAddSub = () => {
        if (lineup) {
            const updated = {
                ...lineup,
                substitutes: [...lineup.substitutes, ""],
                updatedAt: new Date().toISOString(),
            };
            setLineup(updated);
            saveLineup(updated);
        }
    };

    const handleRemoveSub = (subIndex: number) => {
        if (lineup && lineup.substitutes.length > 1) {
            const newSubs = lineup.substitutes.filter((_, idx) => idx !== subIndex);
            const updated = {
                ...lineup,
                substitutes: newSubs,
                updatedAt: new Date().toISOString(),
            };
            setLineup(updated);
            saveLineup(updated);
        }
    };

    const handleClearLineup = () => {
        if (!lineup) return;
        if (!confirm("Are you sure you want to clear the entire pitch and bench?")) return;
        const cleared = {
            ...lineup,
            starters: {},
            substitutes: Array(lineup.substitutes.length).fill(""),
            updatedAt: new Date().toISOString()
        };
        setLineup(cleared);
        saveLineup(cleared);
    };

    // --- Drag and Drop Logic ---
    const handleDragStart = (e: React.DragEvent, playerId: string, source: {type: 'squad' | 'pitch' | 'sub', index?: number}) => {
        setDraggedPlayer(playerId);
        setDraggedSource(source);
        e.dataTransfer.setData('text/plain', playerId);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault(); 
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDropOnPitch = (e: React.DragEvent, targetIndex: number) => {
        e.preventDefault();
        if (!draggedPlayer || !lineup) return;

        let newStarters = { ...lineup.starters };
        let newSubs = [...lineup.substitutes];
        const existingPlayerInTarget = newStarters[targetIndex];

        if (draggedSource?.type === 'pitch' && draggedSource.index !== undefined) {
            newStarters[draggedSource.index] = existingPlayerInTarget || "";
            newStarters[targetIndex] = draggedPlayer;
        } else if (draggedSource?.type === 'sub' && draggedSource.index !== undefined) {
            newSubs[draggedSource.index] = existingPlayerInTarget || "";
            newStarters[targetIndex] = draggedPlayer;
        } else {
            newStarters[targetIndex] = draggedPlayer;
        }

        const updated = { ...lineup, starters: newStarters, substitutes: newSubs, updatedAt: new Date().toISOString() };
        setLineup(updated);
        saveLineup(updated);
        setDraggedPlayer(null);
        setDraggedSource(null);
    };

    const handleRemoveFromPitch = (targetIndex: number) => {
        if (!lineup) return;
        const newStarters = { ...lineup.starters };
        delete newStarters[targetIndex];
        const updated = { ...lineup, starters: newStarters, updatedAt: new Date().toISOString() };
        setLineup(updated);
        saveLineup(updated);
    };

    const handleDropOnSub = (e: React.DragEvent, targetIndex: number) => {
        e.preventDefault();
        if (!draggedPlayer || !lineup) return;

        let newStarters = { ...lineup.starters };
        let newSubs = [...lineup.substitutes];
        const existingPlayerInTarget = newSubs[targetIndex];

        if (draggedSource?.type === 'pitch' && draggedSource.index !== undefined) {
            newStarters[draggedSource.index] = existingPlayerInTarget || "";
            newSubs[targetIndex] = draggedPlayer;
        } else if (draggedSource?.type === 'sub' && draggedSource.index !== undefined) {
            newSubs[draggedSource.index] = existingPlayerInTarget || "";
            newSubs[targetIndex] = draggedPlayer;
        } else {
            newSubs[targetIndex] = draggedPlayer;
        }

        const updated = { ...lineup, starters: newStarters, substitutes: newSubs, updatedAt: new Date().toISOString() };
        setLineup(updated);
        saveLineup(updated);
        setDraggedPlayer(null);
        setDraggedSource(null);
    };

    const handleDropOnSquad = (e: React.DragEvent) => {
        e.preventDefault();
        if (!draggedPlayer || !lineup) return;

        let newStarters = { ...lineup.starters };
        let newSubs = [...lineup.substitutes];

        if (draggedSource?.type === 'pitch' && draggedSource.index !== undefined) {
            delete newStarters[draggedSource.index];
        } else if (draggedSource?.type === 'sub' && draggedSource.index !== undefined) {
            newSubs[draggedSource.index] = "";
        }

        const updated = { ...lineup, starters: newStarters, substitutes: newSubs, updatedAt: new Date().toISOString() };
        setLineup(updated);
        saveLineup(updated);
        setDraggedPlayer(null);
        setDraggedSource(null);
    };

    const handleExportPDF = () => {
        if (!lineup) return;

        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        const formation = FORMATIONS[lineup.formation];

        const getDisplayName = (player: { firstName: string; lastName: string }) => {
            const fullName = `${player.firstName} ${player.lastName}`;
            if (fullName === "Mohamed Abdalla") return "Suarez";
            if (fullName === "Said Tahir") return "Bobo";
            return player.firstName;
        };

        const getPlayerName = (playerId: string) => {
            const player = players.find(p => p.id === playerId);
            if (!player) return 'TBD';
            const displayName = getDisplayName(player);
            return displayName;
        };

        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Matchday XI - Team Sheet</title>
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        padding: 40px;
                        max-width: 800px;
                        margin: 0 auto;
                    }
                    h1 {
                        color: #dc2626;
                        margin: 0;
                    }
                    .header {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        margin-bottom: 20px;
                        border-bottom: 3px solid #dc2626;
                        padding-bottom: 10px;
                    }
                    .logo {
                        height: 60px;
                        width: auto;
                        object-fit: contain;
                    }
                    h2 {
                        color: #1e293b;
                        margin-top: 30px;
                        font-size: 18px;
                    }
                    .formation {
                        background: #22c55e;
                        padding: 20px;
                        border-radius: 8px;
                        margin: 20px 0;
                        position: relative;
                        height: 400px;
                    }
                    .player {
                        position: absolute;
                        background: white;
                        border: 2px solid #dc2626;
                        border-radius: 50%;
                        width: 35px;
                        height: 35px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-weight: bold;
                        font-size: 11px;
                        transform: translate(-50%, -50%);
                    }
                    .player-name {
                        position: absolute;
                        font-size: 10px;
                        font-weight: bold;
                        color: white;
                        background: rgba(0,0,0,0.7);
                        padding: 3px 6px;
                        border-radius: 3px;
                        transform: translate(-50%, 25px);
                        white-space: nowrap;
                    }
                    .subs {
                        margin-top: 30px;
                    }
                    .subs ul {
                        list-style: none;
                        padding: 0;
                    }
                    .subs li {
                        padding: 8px;
                        background: #f8fafc;
                        margin: 5px 0;
                        border-left: 4px solid #dc2626;
                        padding-left: 12px;
                    }
                    @media print {
                        body { padding: 20px; }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>${settings.name} - Matchday Squad</h1>
                    ${settings.logo ? `<img src="${settings.logo}" class="logo" />` : ''}
                </div>
                
                <div style="background: #f1f5f9; padding: 15px; border-radius: 8px; margin-bottom: 20px; border-left: 5px solid #dc2626;">
                    <h3 style="margin: 0 0 10px 0; color: #0f172a;">Match Details</h3>
                    <p style="margin: 5px 0;"><strong>Opposition:</strong> ${nextMatch ? nextMatch.opponent : 'TBD'}</p>
                    <p style="margin: 5px 0;"><strong>Venue:</strong> ${nextMatch ? (nextMatch.isHome ? 'Home' : 'Away') : 'TBD'}</p>
                    <p style="margin: 5px 0;"><strong>Kick-off:</strong> ${nextMatch ? `${new Date(nextMatch.date).toLocaleDateString()} @ ${nextMatch.time}` : new Date().toLocaleDateString()}</p>
                    <p style="margin: 5px 0;"><strong>Formation:</strong> ${lineup.formation}</p>
                </div>
                
                <h2>Starting XI</h2>
                <div class="formation">
                    ${formation.map((pos, idx) => {
            const playerId = lineup.starters[idx];
            const playerName = playerId ? getPlayerName(playerId) : pos.label;
            return `
                            <div class="player" style="left: ${pos.x}%; top: ${pos.y}%;">
                                ${pos.number}
                            </div>
                            <div class="player-name" style="left: ${pos.x}%; top: ${pos.y}%;">
                                ${playerName}
                            </div>
                        `;
        }).join('')}
                </div>

                <div class="subs">
                    <h2>Substitutes</h2>
                    <ul>
                        ${lineup.substitutes.map((subId, idx) =>
            `<li>${idx + 1}. ${subId ? getPlayerName(subId) : 'TBD'}</li>`
        ).join('')}
                    </ul>
                </div>

                <script>
                    window.onload = function() {
                        window.print();
                    }
                </script>
            </body>
            </html>
        `);

        printWindow.document.close();
    };

    const handleCopyToWhatsApp = () => {
        if (!lineup) return;
        
        let msgTemplate = `⚽ *MATCHDAY DETAILS* ⚽\n\n`;
        if (nextMatch) {
            msgTemplate += `*${nextMatch.isHome ? '🏠 Home' : '🚌 Away'} vs {opponent}*\n`;
            msgTemplate += `🏆 {competition}\n`;
            msgTemplate += `📅 {date}\n`;
            msgTemplate += `⏰ Kick-off: {time}\n\n`;
        } else {
            msgTemplate += `*Upcoming Match TBD*\n\n`;
        }
        msgTemplate += `🔴 Please confirm if you are driving directly or need a lift! Let's go boys!`;

        const dateFormatted = nextMatch 
            ? new Date(nextMatch.date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) 
            : new Date().toLocaleDateString('en-GB');

        const formattedMsg = msgTemplate
            .replace(/{opponent}/g, nextMatch ? nextMatch.opponent : "TBD")
            .replace(/{competition}/g, nextMatch ? (nextMatch.competition || "Match") : "Match")
            .replace(/{date}/g, dateFormatted)
            .replace(/{time}/g, nextMatch ? nextMatch.time : "TBD");

        navigator.clipboard.writeText(formattedMsg).then(() => {
            alert("Matchday details copied to clipboard! Paste it into WhatsApp.");
        }).catch(err => {
            console.error('Failed to copy: ', err);
            alert("Failed to copy to clipboard.");
        });
    };

    if (!lineup) return <div>Loading...</div>;

    const formation = FORMATIONS[lineup.formation];
    const selectedPlayerIds = [
        ...Object.values(lineup.starters),
        ...lineup.substitutes
    ].filter(Boolean);

    const activePlayerId = activeSlot
        ? activeSlot.type === 'pitch'
            ? lineup.starters[activeSlot.index]
            : lineup.substitutes[activeSlot.index]
        : null;

    const activePlayer = activePlayerId ? players.find(p => p.id === activePlayerId) : null;

    const availablePlayers = players.filter(p => !selectedPlayerIds.includes(p.id) && p.medicalStatus === "Available");

    const targetCategory = activeSlot && activeSlot.type === 'pitch' ? getPositionCategory(activeSlot.label) : 'All';

    const filteredAvailable = availablePlayers.filter(p => {
        const fullName = `${p.firstName} ${p.lastName}`.toLowerCase();
        return fullName.includes(searchQuery.toLowerCase()) || p.position.toLowerCase().includes(searchQuery.toLowerCase());
    });

    const sortedPlayers = [...filteredAvailable].sort((a, b) => {
        const catA = getPositionCategory(a.position);
        const catB = getPositionCategory(b.position);
        
        if (targetCategory !== 'All') {
            const matchA = catA === targetCategory ? 1 : 0;
            const matchB = catB === targetCategory ? 1 : 0;
            if (matchA !== matchB) return matchB - matchA;
        }
        
        // Group by exact position first using global POSITION_ORDER
        const orderA = POSITION_ORDER[a.position.toUpperCase()] || 99;
        const orderB = POSITION_ORDER[b.position.toUpperCase()] || 99;
        if (orderA !== orderB) return orderA - orderB;
        
        return a.lastName.localeCompare(b.lastName);
    });

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-slate-900">Matchday XI</h2>
                    <p className="text-slate-500">Select your starting lineup and substitutes ({players.filter(p => p.medicalStatus === "Available").length} players available)</p>
                </div>
                <div className="flex items-center gap-3">
                    <Button onClick={handleClearLineup} variant="outline" className="border-slate-300 hover:bg-slate-100 text-slate-700">
                        <Trash2 className="h-4 w-4 mr-2" />
                        Clear Pitch
                    </Button>
                    <Button onClick={handleCopyToWhatsApp} className="bg-emerald-600 hover:bg-emerald-700 text-white border-none hidden sm:flex">
                        <MessageCircle className="h-4 w-4 mr-2" />
                        Copy to WhatsApp
                    </Button>
                    <Button onClick={handleExportPDF} className="bg-blue-600 hover:bg-blue-700">
                        <FileDown className="h-4 w-4 mr-2" />
                        Export PDF
                    </Button>
                </div>
            </div>

            {nextMatch && (
                <Card className="bg-slate-900 text-white border-slate-800">
                    <CardContent className="flex items-center justify-between p-6">
                        <div className="space-y-1">
                            <p className="text-slate-400 text-sm font-medium uppercase tracking-wider">Upcoming Match</p>
                            <h3 className="text-2xl font-bold flex items-center gap-2">
                                <span className={nextMatch.isHome ? "text-white" : "text-slate-400"}>Camden United</span>
                                <span className="text-slate-500 text-lg">vs</span>
                                <span className={!nextMatch.isHome ? "text-white" : "text-slate-400"}>{nextMatch.opponent}</span>
                            </h3>
                        </div>
                        <div className="flex gap-6 text-sm flex-wrap mt-4 sm:mt-0">
                            <div className="flex items-center gap-2">
                                <Trophy className="h-4 w-4 text-red-500" />
                                <span className="font-semibold text-slate-300">{nextMatch.competition || "Match"}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-red-500" />
                                <span>{new Date(nextMatch.date).toLocaleDateString()}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Clock className="h-4 w-4 text-red-500" />
                                <span>{nextMatch.time}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <MapPin className="h-4 w-4 text-red-500" />
                                <span>{nextMatch.isHome ? 'Home' : 'Away'}</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 lg:h-[650px]">
                
                {/* Left Panel - Squad */}
                <Card 
                    className="lg:col-span-1 h-[400px] lg:h-full flex flex-col border-slate-200 shadow-md order-2 lg:order-1 min-h-0 overflow-hidden"
                    onDragOver={handleDragOver}
                    onDrop={handleDropOnSquad}
                >
                    <div className="p-3 bg-slate-100 font-bold text-xs uppercase tracking-wider text-slate-500 border-b border-slate-200 flex items-center justify-between">
                        <span>Available Squad</span>
                        <span className="bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full text-[10px]">{players.filter(p => !selectedPlayerIds.includes(p.id) && p.medicalStatus === "Available").length}</span>
                    </div>
                    <div className="p-2 border-b border-slate-200 bg-white flex gap-1 overflow-x-auto no-scrollbar shrink-0 shadow-sm z-10">
                        {(["All", "GK", "DEF", "MID", "FWD"] as const).map(f => (
                            <button
                                key={f}
                                onClick={() => setSquadFilter(f)}
                                className={`px-3 py-1.5 text-[11px] font-bold rounded-full transition-all whitespace-nowrap ${squadFilter === f ? 'bg-slate-900 text-white shadow-sm' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                            >
                                {f}
                            </button>
                        ))}
                    </div>
                    <div className="p-3 space-y-2 overflow-y-auto flex-1 bg-slate-50/30">
                        {players
                            .filter(p => !selectedPlayerIds.includes(p.id) && p.medicalStatus === "Available")
                            .filter(p => squadFilter === "All" || getPositionCategory(p.position) === squadFilter)
                            .map(player => {
                                const fullName = `${player.firstName} ${player.lastName}`;
                                let displayName = player.firstName;
                                if (fullName === "Mohamed Abdalla") displayName = "Suarez";
                                if (fullName === "Said Tahir") displayName = "Bobo";

                                return (
                                    <div 
                                        key={player.id}
                                        draggable
                                        onDragStart={(e) => handleDragStart(e, player.id, {type: 'squad'})}
                                        className="flex items-center gap-3 p-2 border border-slate-200 rounded-lg bg-white shadow-sm cursor-grab active:cursor-grabbing hover:border-red-400 hover:shadow-md transition-all group"
                                    >
                                        <GripVertical className="h-4 w-4 text-slate-300 group-hover:text-red-400 transition-colors" />
                                        <div className="flex flex-col">
                                            <span className="text-xs font-bold text-slate-800">{displayName}</span>
                                            <span className="text-[9px] uppercase text-slate-500 font-bold tracking-wider">{player.position}</span>
                                        </div>
                                    </div>
                                );
                        })}
                        {players.filter(p => !selectedPlayerIds.includes(p.id) && p.medicalStatus === "Available").length === 0 && (
                            <div className="text-center py-6 text-slate-400 text-sm border-2 border-dashed rounded-lg border-slate-200 m-2">
                                <span className="text-xl mb-1 block">✅</span>
                                Squad deployed!
                            </div>
                        )}
                    </div>
                </Card>

                {/* Center Content - Formation Display */}
                <Card className="lg:col-span-2 h-auto lg:h-full flex flex-col order-1 lg:order-2 min-h-0 overflow-hidden">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0 border-b border-slate-100 bg-white z-10 shrink-0">
                        <CardTitle className="text-sm font-bold">Starting XI</CardTitle>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider hidden sm:inline">Formation</span>
                            <select
                                value={lineup.formation}
                                onChange={(e) => handleFormationChange(e.target.value)}
                                className="px-2 py-1.5 border rounded-md text-xs font-bold focus:ring-2 focus:ring-red-500 focus:outline-none bg-slate-50"
                            >
                                {FORMATION_NAMES.map(name => (
                                    <option key={name} value={name}>{name}</option>
                                ))}
                            </select>
                        </div>
                    </CardHeader>
                    <CardContent className="flex-1 flex items-center justify-center p-4 bg-slate-50/50">
                        <div className="relative w-full h-[500px] md:h-full max-w-[500px] mx-auto bg-green-600 rounded-lg shadow-xl border-4 border-slate-200">
                            {/* Pitch markings */}
                            <div className="absolute inset-0 overflow-hidden rounded-sm pointer-events-none">
                                <div className="absolute inset-2 border-2 border-white/40"></div>
                                <div className="absolute left-2 right-2 top-1/2 border-t-2 border-white/40"></div>
                                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 sm:w-16 sm:h-16 border-2 border-white/40 rounded-full"></div>
                                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-white/60 rounded-full"></div>
                                <div className="absolute left-1/2 -translate-x-1/2 top-2 w-20 h-10 sm:w-24 sm:h-12 border-2 border-white/40 border-t-0"></div>
                                <div className="absolute left-1/2 -translate-x-1/2 bottom-2 w-20 h-10 sm:w-24 sm:h-12 border-2 border-white/40 border-b-0"></div>
                                <div className="absolute left-1/2 -translate-x-1/2 top-2 w-12 h-5 sm:w-14 sm:h-6 border-2 border-white/40 border-t-0"></div>
                                <div className="absolute left-1/2 -translate-x-1/2 bottom-2 w-12 h-5 sm:w-14 sm:h-6 border-2 border-white/40 border-b-0"></div>

                                {/* Watermark */}
                                {settings.logo && (
                                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
                                        <img src={settings.logo} alt="Watermark" className="w-48 h-48 object-contain grayscale brightness-125" />
                                    </div>
                                )}
                            </div>

                            {/* Player positions */}
                            {formation.map((pos, idx) => {
                                const rawPlayerId = lineup.starters[idx];
                                const player = rawPlayerId ? players.find(p => p.id === rawPlayerId) : null;
                                const playerId = player ? rawPlayerId : null;
                                const fullName = player ? `${player.firstName} ${player.lastName}` : "";
                                let displayName = player ? player.firstName : "";
                                if (fullName === "Mohamed Abdalla") displayName = "Suarez";
                                if (fullName === "Said Tahir") displayName = "Bobo";

                                const kitColor = (nextMatch && !nextMatch.isHome)
                                    ? (settings.awayKitShirt || "#000000")
                                    : (settings.homeKitShirt || "#ffffff");

                                return (
                                <div
                                    key={idx}
                                    className="absolute -translate-x-1/2 -translate-y-1/2"
                                    style={{
                                        left: `${pos.x}%`,
                                        top: `${pos.y}%`,
                                    }}
                                    onDragOver={handleDragOver}
                                    onDrop={(e) => handleDropOnPitch(e, idx)}
                                >
                                    <div className="flex flex-col items-center group relative cursor-pointer"
                                            draggable={!!playerId}
                                            onDragStart={(e) => playerId && handleDragStart(e, playerId, {type: 'pitch', index: idx})}
                                            onClick={() => setActiveSlot({ type: 'pitch', index: idx, label: pos.label })}
                                    >
                                        {/* Jersey SVG Icon colored dynamically based on home/away venue */}
                                        <svg 
                                            className="w-8 h-8 sm:w-10 sm:h-10 drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)] mb-0.5 sm:mb-1 z-10 transition-transform group-hover:scale-110" 
                                            viewBox="0 0 100 100" 
                                            fill="none" 
                                            xmlns="http://www.w3.org/2000/svg"
                                        >
                                            {/* Shirt Body */}
                                            <path d="M 30,20 L 70,20 L 85,35 L 75,45 L 68,38 L 68,85 L 32,85 L 32,38 L 25,45 L 15,35 Z" fill={kitColor} stroke="#000" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
                                            {/* Collar */}
                                            <path d="M 40,20 Q 50,28 60,20" stroke="#000" strokeWidth="3.5" fill="none" />
                                            {/* Number */}
                                            <text 
                                                x="50" 
                                                y="58" 
                                                textAnchor="middle" 
                                                fill={
                                                    (() => {
                                                        const hex = kitColor.replace("#", "");
                                                        if (hex.length !== 6) return "#000000";
                                                        const r = parseInt(hex.substr(0, 2), 16);
                                                        const g = parseInt(hex.substr(2, 2), 16);
                                                        const b = parseInt(hex.substr(4, 2), 16);
                                                        const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
                                                        return (yiq >= 128) ? "#000000" : "#ffffff";
                                                    })()
                                                } 
                                                fontSize="26" 
                                                fontWeight="bold" 
                                                dy=".3em"
                                            >
                                                {pos.number}
                                            </text>
                                        </svg>
                                        
                                        {/* Name Tag */}
                                        <div className={`
                                            px-1 sm:px-2 py-0.5 rounded shadow-sm min-w-[52px] sm:min-w-[80px] text-center border relative
                                            ${playerId ? 'bg-slate-900 border-slate-700' : 'bg-white/90 border-dashed border-slate-400'}
                                        `}>
                                            <span className={`text-[9px] sm:text-[12px] font-bold tracking-tight ${playerId ? 'text-white' : 'text-slate-500'}`}>
                                                {playerId ? displayName : pos.label}
                                            </span>
                                            
                                            {/* Remove Button */}
                                            {playerId && (
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); handleRemoveFromPitch(idx); }}
                                                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center opacity-0 md:group-hover:opacity-100 hover:bg-red-600 transition-opacity z-20"
                                                >
                                                    <span className="text-[10px] font-bold leading-none -mt-[1px]">×</span>
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>

                {/* Right Panel - Bench */}
                <Card className="lg:col-span-1 h-[400px] lg:h-full flex flex-col border-slate-200 shadow-md bg-slate-50/30 order-3 min-h-0 overflow-hidden">
                    <div className="p-3 bg-slate-100 border-b border-slate-200 font-bold text-xs uppercase tracking-wider text-slate-500 flex justify-between items-center">
                        <span>Bench ({lineup.substitutes.filter(Boolean).length})</span>
                        <button onClick={handleAddSub} className="text-red-600 hover:text-red-700 font-bold text-[10px] flex items-center px-2 py-1 rounded bg-red-50 hover:bg-red-100 transition-colors">
                            <Plus className="h-3 w-3 mr-0.5" /> ADD SLOT
                        </button>
                    </div>
                    <div className="p-3 space-y-2 overflow-y-auto flex-1">
                        {lineup.substitutes.map((rawSubId, idx) => {
                            const player = rawSubId ? players.find(p => p.id === rawSubId) : null;
                            const subId = player ? rawSubId : "";
                            const fullName = player ? `${player.firstName} ${player.lastName}` : "";
                            let displayName = player ? player.firstName : "";
                            if (fullName === "Mohamed Abdalla") displayName = "Suarez";
                            if (fullName === "Said Tahir") displayName = "Bobo";

                            return (
                                <div 
                                    key={idx} 
                                    className="flex items-center gap-2"
                                    onDragOver={handleDragOver}
                                    onDrop={(e) => handleDropOnSub(e, idx)}
                                >
                                    <span className="text-[10px] font-bold text-slate-400 w-3">{idx + 1}.</span>
                                    
                                    <div 
                                        draggable={!!subId}
                                        onDragStart={(e) => subId && handleDragStart(e, subId, {type: 'sub', index: idx})}
                                        onClick={() => setActiveSlot({ type: 'sub', index: idx, label: `Bench Slot ${idx + 1}` })}
                                        className={`flex-1 flex items-center justify-between p-2 border rounded-lg shadow-sm transition-all cursor-pointer hover:border-slate-400
                                            ${subId ? 'bg-white hover:border-red-400 border-slate-200 group' : 'bg-slate-100 border-dashed border-slate-300 text-slate-400 hover:bg-slate-200'}`}
                                    >
                                        {subId ? (
                                            <>
                                                <div className="flex items-center gap-2">
                                                    <GripVertical className="h-4 w-4 text-slate-300 group-hover:text-red-400 transition-colors" />
                                                    <span className="text-xs font-bold text-slate-800">{displayName}</span>
                                                </div>
                                                <span className="text-[9px] uppercase text-slate-500 font-bold mr-1">{player?.position}</span>
                                            </>
                                        ) : (
                                            <span className="text-[10px] font-medium text-center w-full block">Drag here</span>
                                        )}
                                    </div>
                                    
                                    {lineup.substitutes.length > 1 && (
                                        <button
                                            onClick={() => handleRemoveSub(idx)}
                                            className="p-1.5 text-slate-400 hover:text-red-600 transition-colors rounded-full hover:bg-red-50"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </Card>
            </div>

            {/* Assign Player Modal/Drawer */}
            {activeSlot && (
                <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
                    <div 
                        className="fixed inset-0" 
                        onClick={() => { setActiveSlot(null); setSearchQuery(""); }}
                    />
                    <div className="bg-slate-900 border border-slate-800 text-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl max-h-[85vh] sm:max-h-[80vh] flex flex-col shadow-2xl z-10 overflow-hidden animate-in slide-in-from-bottom duration-200">
                        {/* Modal Header */}
                        <div className="p-4 border-b border-slate-800 flex items-center justify-between shrink-0 bg-slate-900/50 backdrop-blur-md">
                            <div>
                                <h3 className="text-base font-bold text-white">Assign Player</h3>
                                <p className="text-xs text-slate-400">Select player for position: <span className="font-semibold text-red-500">{activeSlot.label}</span></p>
                            </div>
                            <button 
                                onClick={() => { setActiveSlot(null); setSearchQuery(""); }}
                                className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        {/* Search Input */}
                        <div className="p-3 border-b border-slate-800 bg-slate-950/40 shrink-0">
                            <div className="relative">
                                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                                <input
                                    type="text"
                                    placeholder="Search player by name or position..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-9 pr-4 py-2 bg-slate-850 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                                />
                            </div>
                        </div>

                        {/* Player List */}
                        <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-slate-950/20">
                            {/* Current Assigned Player */}
                            {activePlayer && (
                                <div className="p-2.5 border border-red-500/30 rounded-xl bg-red-950/10 flex items-center justify-between">
                                    <div className="flex flex-col">
                                        <span className="text-[10px] uppercase font-bold text-red-500 tracking-wider">Currently Assigned</span>
                                        <span className="text-sm font-bold text-white">
                                            {activePlayer.firstName} {activePlayer.lastName}
                                        </span>
                                        <span className="text-[10px] text-slate-400 font-bold uppercase">{activePlayer.position}</span>
                                    </div>
                                    <Button
                                        onClick={() => {
                                            if (activeSlot.type === 'pitch') {
                                                handleRemoveFromPitch(activeSlot.index);
                                            } else {
                                                handleSubChange(activeSlot.index, "");
                                            }
                                            setActiveSlot(null);
                                            setSearchQuery("");
                                        }}
                                        variant="destructive"
                                        size="sm"
                                        className="h-8 text-xs bg-red-600 hover:bg-red-700 font-bold"
                                    >
                                        <Trash2 className="h-3.5 w-3.5 mr-1" /> Remove
                                    </Button>
                                </div>
                            )}

                            {/* Divider if we have both current player and available list */}
                            {activePlayer && sortedPlayers.length > 0 && (
                                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-1 pt-1">
                                    Available Options
                                </div>
                            )}

                            {sortedPlayers.length > 0 ? (
                                sortedPlayers.map(player => {
                                    const matchesTarget = activeSlot.type === 'pitch' && getPositionCategory(player.position) === targetCategory;
                                    const fullName = `${player.firstName} ${player.lastName}`;
                                    let displayName = player.firstName;
                                    if (fullName === "Mohamed Abdalla") displayName = "Suarez";
                                    if (fullName === "Said Tahir") displayName = "Bobo";

                                    return (
                                        <button
                                            key={player.id}
                                            onClick={() => {
                                                if (activeSlot.type === 'pitch') {
                                                    handleStarterChange(activeSlot.index, player.id);
                                                } else {
                                                    handleSubChange(activeSlot.index, player.id);
                                                }
                                                setActiveSlot(null);
                                                setSearchQuery("");
                                            }}
                                            className={`w-full flex items-center justify-between p-3 border rounded-xl transition-all text-left group
                                                ${matchesTarget 
                                                    ? 'bg-slate-800/80 border-red-500/20 hover:border-red-500/50 hover:bg-slate-800' 
                                                    : 'bg-slate-900 border-slate-800 hover:border-slate-700 hover:bg-slate-850'
                                                }`}
                                        >
                                            <div className="flex flex-col">
                                                <span className="text-sm font-bold text-white group-hover:text-red-400 transition-colors">
                                                    {player.firstName} {player.lastName}
                                                </span>
                                                <span className="text-[10px] text-slate-400 font-semibold uppercase">
                                                    {player.position}
                                                </span>
                                            </div>
                                            {matchesTarget && (
                                                <span className="bg-red-500/10 text-red-500 border border-red-500/20 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                                                    Ideal Position
                                                </span>
                                            )}
                                        </button>
                                    );
                                })
                            ) : (
                                <div className="text-center py-8 text-slate-500 text-sm">
                                    No available players found
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="p-3 bg-slate-950/60 border-t border-slate-800 flex justify-end shrink-0">
                            <Button 
                                onClick={() => { setActiveSlot(null); setSearchQuery(""); }}
                                className="bg-slate-800 hover:bg-slate-750 text-white border-none font-bold text-xs"
                            >
                                Cancel
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
