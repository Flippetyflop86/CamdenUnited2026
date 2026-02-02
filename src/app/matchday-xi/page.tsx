"use client";

import { useState, useEffect } from "react";
import { MatchdayXI, Player, Match } from "@/types";
import { FORMATIONS, FORMATION_NAMES } from "@/lib/formations";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Save, FileDown, Calendar, MapPin, Clock } from "lucide-react";
import { useClub } from "@/context/club-context";
import { supabase } from "@/lib/supabase";

export default function MatchdayXIPage() {
    const { settings } = useClub();
    const [lineup, setLineup] = useState<MatchdayXI | null>(null);
    const [players, setPlayers] = useState<Player[]>([]);
    const [isEditing, setIsEditing] = useState(false);
    const [nextMatch, setNextMatch] = useState<Match | null>(null);

    // ... (keep state) ...

    // Load Data
    useEffect(() => {
        fetchData();

        // Subscription for realtime updates (optional but good for multi-user)
        const channel = supabase.channel('public:matchday_xis')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'matchday_xis' }, fetchLineupOnly)
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
        const { data } = await supabase.from('players').select('*').eq('squad', 'firstTeam');
        if (data) {
            const mapped = data.map((p: any) => ({
                id: p.id,
                firstName: p.first_name,
                lastName: p.last_name,
                position: p.position,
                squad: p.squad,
                // ... map other fields if needed for sorting
            }));

            // Sort logic
            const positionOrder: { [key: string]: number } = {
                'GK': 1,
                'CB': 2, 'RB': 2, 'LB': 2, 'DEF': 2,
                'CDM': 3, 'CM': 3, 'CAM': 3, 'MID': 3,
                'RW': 4, 'LW': 4, 'CF': 4, 'FWD': 4
            };

            setPlayers(mapped.sort((a: any, b: any) => {
                const orderA = positionOrder[a.position] || 5;
                const orderB = positionOrder[b.position] || 5;
                if (orderA !== orderB) return orderA - orderB;
                return a.lastName.localeCompare(b.lastName);
            }));
        }
    };

    const fetchMatches = async () => {
        const { data } = await supabase.from('matches').select('*').eq('result', 'Pending').order('date', { ascending: true });
        if (data && data.length > 0) {
            // Find next match relative to today
            const now = new Date();
            now.setHours(0, 0, 0, 0);
            const upcoming = data.find((m: any) => new Date(m.date) >= now);
            if (upcoming) {
                setNextMatch({
                    id: upcoming.id,
                    opponent: upcoming.opponent,
                    date: upcoming.date,
                    time: upcoming.time,
                    location: upcoming.location,
                    isHome: upcoming.is_home,
                    result: upcoming.result,
                    stats: upcoming.stats,
                    goals: upcoming.goals
                });
            }
        }
    };

    const saveLineup = async (newLineup: MatchdayXI) => {
        // Debounce or just save
        // Ideally checking if id exists in DB, if "default-xi" generate new ID
        const payload = {
            formation: newLineup.formation,
            starters: newLineup.starters,
            substitutes: newLineup.substitutes,
            created_at: new Date().toISOString() // updating timestamp really
        };

        if (newLineup.id === "default-xi") {
            const { data } = await supabase.from('matchday_xis').insert([payload]).select();
            if (data) {
                setLineup({ ...newLineup, id: data[0].id });
            }
        } else {
            await supabase.from('matchday_xis').update(payload).eq('id', newLineup.id);
        }
    };

    const handleFormationChange = (newFormation: string) => {
        if (lineup) {
            const updated = {
                ...lineup,
                formation: newFormation,
                starters: {}, // Reset starters
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
            setLineup({
                ...lineup,
                substitutes: newSubs,
                updatedAt: new Date().toISOString(),
            });
        }
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

    if (!lineup) return <div>Loading...</div>;

    const formation = FORMATIONS[lineup.formation];
    const selectedPlayerIds = [
        ...Object.values(lineup.starters),
        ...lineup.substitutes
    ].filter(Boolean);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-slate-900">Matchday XI</h2>
                    <p className="text-slate-500">Select your starting lineup and substitutes ({players.length} players available)</p>
                </div>
                <Button onClick={handleExportPDF} className="bg-blue-600 hover:bg-blue-700">
                    <FileDown className="h-4 w-4 mr-2" />
                    Export PDF
                </Button>
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
                        <div className="flex gap-6 text-sm">
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

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Main Content - Formation Display */}
                <div className="lg:col-span-3 space-y-6">
                    {/* Formation Selector */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-sm">Formation</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <select
                                value={lineup.formation}
                                onChange={(e) => handleFormationChange(e.target.value)}
                                className="w-full md:w-64 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:outline-none"
                            >
                                {FORMATION_NAMES.map(name => (
                                    <option key={name} value={name}>{name}</option>
                                ))}
                            </select>
                        </CardContent>
                    </Card>

                    {/* Football Pitch */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-sm">Starting XI</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="relative w-full max-w-2xl mx-auto bg-green-600 rounded-lg overflow-hidden shadow-xl border-4 border-slate-200" style={{ paddingBottom: "75%" }}>
                                {/* Pitch markings */}
                                <div className="absolute inset-0">
                                    <div className="absolute inset-2 border-2 border-white/40"></div>
                                    <div className="absolute left-2 right-2 top-1/2 border-t-2 border-white/40"></div>
                                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 border-2 border-white/40 rounded-full"></div>
                                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-white/60 rounded-full"></div>
                                    <div className="absolute left-1/2 -translate-x-1/2 top-2 w-24 h-12 border-2 border-white/40 border-t-0"></div>
                                    <div className="absolute left-1/2 -translate-x-1/2 bottom-2 w-24 h-12 border-2 border-white/40 border-b-0"></div>
                                    <div className="absolute left-1/2 -translate-x-1/2 top-2 w-14 h-6 border-2 border-white/40 border-t-0"></div>
                                    <div className="absolute left-1/2 -translate-x-1/2 bottom-2 w-14 h-6 border-2 border-white/40 border-b-0"></div>

                                    {/* Watermark */}
                                    {settings.logo && (
                                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
                                            <img src={settings.logo} alt="Watermark" className="w-48 h-48 object-contain grayscale brightness-125" />
                                        </div>
                                    )}
                                </div>

                                {/* Player positions */}
                                {formation.map((pos, idx) => (
                                    <div
                                        key={idx}
                                        className="absolute -translate-x-1/2 -translate-y-1/2"
                                        style={{
                                            left: `${pos.x}%`,
                                            top: `${pos.y}%`,
                                        }}
                                    >
                                        <div className="flex flex-col items-center">
                                            <div className="w-7 h-7 bg-white border-2 border-red-600 rounded-full flex items-center justify-center shadow-lg mb-1">
                                                <span className="text-[9px] font-bold text-slate-900">{pos.number}</span>
                                            </div>
                                            <select
                                                value={lineup.starters[idx] || ""}
                                                onChange={(e) => handleStarterChange(idx, e.target.value)}
                                                className="text-[10px] px-1 py-0.5 border rounded bg-white/95 focus:ring-1 focus:ring-red-500 focus:outline-none min-w-[80px]"
                                            >
                                                <option value="">{pos.label}</option>
                                                {players
                                                    .filter(p => !selectedPlayerIds.includes(p.id) || lineup.starters[idx] === p.id)
                                                    .map(player => {
                                                        const fullName = `${player.firstName} ${player.lastName}`;
                                                        let displayName = player.firstName;
                                                        if (fullName === "Mohamed Abdalla") displayName = "Suarez";
                                                        if (fullName === "Said Tahir") displayName = "Bobo";

                                                        return (
                                                            <option key={player.id} value={player.id}>
                                                                {displayName}
                                                            </option>
                                                        );
                                                    })}
                                            </select>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Substitutes Panel */}
                <Card className="lg:col-span-1">
                    <CardHeader>
                        <CardTitle className="text-sm">Substitutes</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {lineup.substitutes.map((subId, idx) => (
                            <div key={idx} className="flex gap-2 items-center">
                                <span className="text-xs font-semibold text-slate-600 w-4">{idx + 1}.</span>
                                <select
                                    value={subId}
                                    onChange={(e) => handleSubChange(idx, e.target.value)}
                                    className="flex-1 text-xs px-2 py-1.5 border rounded focus:ring-2 focus:ring-red-500 focus:outline-none"
                                >
                                    <option value="">Select player</option>
                                    {players
                                        .filter(p => !selectedPlayerIds.includes(p.id) || lineup.substitutes[idx] === p.id)
                                        .map(player => {
                                            const fullName = `${player.firstName} ${player.lastName}`;
                                            let displayName = player.firstName;
                                            if (fullName === "Mohamed Abdalla") displayName = "Suarez";
                                            if (fullName === "Said Tahir") displayName = "Bobo";

                                            return (
                                                <option key={player.id} value={player.id}>
                                                    {displayName}
                                                </option>
                                            );
                                        })}
                                </select>
                                {lineup.substitutes.length > 1 && (
                                    <button
                                        onClick={() => handleRemoveSub(idx)}
                                        className="p-1 text-slate-400 hover:text-red-600 transition-colors"
                                    >
                                        <Trash2 className="h-3 w-3" />
                                    </button>
                                )}
                            </div>
                        ))}
                        <Button
                            onClick={handleAddSub}
                            size="sm"
                            variant="outline"
                            className="w-full mt-2"
                        >
                            <Plus className="h-3 w-3 mr-1" />
                            Add Sub
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
