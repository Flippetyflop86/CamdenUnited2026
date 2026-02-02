"use client";
// forcing refresh

import { useState, useEffect, useRef } from "react";
import { Player, SquadType } from "@/types";
import { PlayerCard } from "@/components/squad/player-card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Plus, Filter, ImageIcon, Trash2, RefreshCw } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function SquadPage() {
    const [searchTerm, setSearchTerm] = useState("");
    const [squadFilter, setSquadFilter] = useState<SquadType>("firstTeam");
    const [positionFilter, setPositionFilter] = useState<"All" | "GK" | "DEF" | "MID" | "FWD">("All");
    const [showAvailableOnly, setShowAvailableOnly] = useState(false);
    const [players, setPlayers] = useState<Player[]>([]);
    const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const hasLoaded = useRef(false);

    // Mappings for UI display
    const SQUAD_LABELS: Record<SquadType, string> = {
        firstTeam: "First Team",
        midweek: "Midweek",
        youth: "Youth"
    };

    // Image processing helper






    // 1. Initial load: Supabase
    useEffect(() => {
        const storedFilter = localStorage.getItem("camden-united-squad-filter");
        if (storedFilter) setSquadFilter(storedFilter as SquadType);

        fetchData();

        // Real-time Subscription for Players
        const channel = supabase
            .channel("public:players")
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "players" },
                () => fetchData() // Re-fetch on any change for simplicity
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, []);

    async function fetchData() {
        try {
            // Fetch Players & Matches concurrently
            const [playersRes, matchesRes] = await Promise.all([
                supabase.from("players").select("*"),
                supabase.from("matches").select("*")
            ]);

            if (playersRes.error) throw playersRes.error;
            const dbPlayers = playersRes.data || [];

            // Map DB snake_case to CamelCase TS types if needed, 
            // OR simple cast if we align types. 
            // Our Schema uses snake_case (first_name), but App uses camelCase (firstName).
            // We need a mapper.

            // --- GOAL SYNC LOGIC ---
            const goalMap = new Map<string, number>();
            const matches = matchesRes.data || [];

            matches.forEach((m: any) => {
                if (m.goalscorers) {
                    const scorers = m.goalscorers.split(",");
                    scorers.forEach((s: string) => {
                        const segment = s.trim();
                        // Parse "Name(3)" format
                        const match = segment.match(/([^(]+)(?:\((\d+)\))?/);
                        if (match) {
                            const name = match[1].trim();
                            const count = match[2] ? parseInt(match[2]) : 1;
                            goalMap.set(name.toLowerCase(), (goalMap.get(name.toLowerCase()) || 0) + count);
                        }
                    });
                }
            });

            // Map and Merge Stats
            const formattedPlayers: Player[] = dbPlayers.map((p: any) => {
                // Determine goals from Map
                let goals = 0;
                // Try strict match "F.Lastname"
                const strictKey = `${p.first_name?.[0]}.${p.last_name}`.toLowerCase();
                if (goalMap.has(strictKey)) goals = goalMap.get(strictKey) || 0;
                else {
                    // Loose match
                    for (const [key, val] of goalMap.entries()) {
                        if (key.includes(p.last_name.toLowerCase())) {
                            if (goals === 0) goals = val; // Take first reasonable match if 0
                        }
                    }
                }

                return {
                    id: p.id,
                    firstName: p.first_name,
                    lastName: p.last_name,
                    position: p.position as any,
                    squadNumber: p.squad_number,
                    age: p.age,
                    nationality: p.nationality,
                    squad: p.squad as SquadType,
                    medicalStatus: p.medical_status as any,
                    availability: p.availability,
                    contractExpiry: p.contract_expiry,
                    imageUrl: p.image_url,
                    appearances: p.appearances,
                    goals: goals, // Calculated from live matches
                    assists: p.assists,
                    dateOfBirth: p.date_of_birth,
                    notes: p.notes,
                    isInTrainingSquad: p.is_in_training_squad
                };
            });

            setPlayers(formattedPlayers);
            hasLoaded.current = true;
        } catch (e) {
            console.error("Error fetching squad:", e);
        }
    }

    // 2. Persist Squad Filter
    useEffect(() => {
        if (hasLoaded.current) {
            localStorage.setItem("camden-united-squad-filter", squadFilter);
        }
    }, [squadFilter]);

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure?")) return;

        // Optimistic Update
        setPlayers((prev) => prev.filter((p) => p.id !== id));

        const { error } = await supabase.from("players").delete().eq("id", id);
        if (error) {
            alert("Error deleting player");
            fetchData(); // Revert
        }
    };

    // ... filteredPlayers ...
    const filteredPlayers = players.filter((player) => {
        const matchesSearch =
            player.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            player.lastName.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesSquad = player.squad === squadFilter;
        const matchesPosition = positionFilter === "All" ||
            (positionFilter === "GK" && player.position === "GK") ||
            (positionFilter === "DEF" && ["LB", "CB", "RB"].includes(player.position)) ||
            (positionFilter === "MID" && ["CDM", "CM", "CAM", "LW", "RW"].includes(player.position)) ||
            (positionFilter === "FWD" && ["CF", "ST"].includes(player.position));
        const matchesAvailability = !showAvailableOnly || player.medicalStatus === "Available";
        return matchesSearch && matchesSquad && matchesPosition && matchesAvailability;
    });

    // ... positionOrder ...
    const positionOrder: Record<string, number> = {
        "GK": 1, "LB": 2, "CB": 3, "RB": 4,
        "CDM": 5, "CM": 6, "CAM": 7, "LW": 8, "RW": 9,
        "CF": 10, "ST": 11
    };

    // ... sortedPlayers ...
    const sortedPlayers = [...filteredPlayers].sort((a, b) => {
        return (positionOrder[a.position] || 99) - (positionOrder[b.position] || 99);
    });

    // ... handleEdit logic ...
    const handleEdit = (player: Player) => {
        setEditingPlayer(player);
        setPreviewImage(player.imageUrl || null);
    };

    // ... handleImageUpload ...
    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && editingPlayer) {
            const reader = new FileReader();
            reader.onloadend = () => {
                const result = reader.result as string;
                setPreviewImage(result);
                setEditingPlayer({ ...editingPlayer, imageUrl: result });
            };
            reader.readAsDataURL(file);
        }
    };

    // ... handlePaste ...
    const handlePaste = (e: React.ClipboardEvent) => {
        const items = e.clipboardData?.items;
        if (items && editingPlayer) {
            for (let i = 0; i < items.length; i++) {
                if (items[i].type.indexOf("image") !== -1) {
                    const file = items[i].getAsFile();
                    if (file) {
                        const reader = new FileReader();
                        reader.onloadend = () => {
                            const result = reader.result as string;
                            setPreviewImage(result);
                            setEditingPlayer({ ...editingPlayer, imageUrl: result });
                        };
                        reader.readAsDataURL(file);
                    }
                    break;
                }
            }
        }
    };

    const handleAddPlayer = () => {
        const newPlayer: Player = {
            id: "new", // Placeholder, will be ignored by DB insert if we omit it or let DB gen it
            firstName: "",
            lastName: "",
            position: "GK",
            squadNumber: 0,
            age: 0,
            nationality: "English",
            squad: squadFilter,
            medicalStatus: "Available",
            contractExpiry: "2026-06-30",
            availability: true,
            appearances: 0,
            goals: 0,
            assists: 0,
            imageUrl: "/placeholder-player.png",
            isInTrainingSquad: true
        };
        setEditingPlayer(newPlayer);
        setPreviewImage("/placeholder-player.png");
    };

    const handleSavePlayer = async (updatedPlayer: Player) => {
        const isNew = updatedPlayer.id === "new" || !updatedPlayer.id.includes("-"); // Rough check

        // Prepare payload for Supabase (snake_case)
        const payload: any = {
            first_name: updatedPlayer.firstName,
            last_name: updatedPlayer.lastName,
            position: updatedPlayer.position,
            squad_number: updatedPlayer.squadNumber,
            date_of_birth: updatedPlayer.dateOfBirth,
            nationality: updatedPlayer.nationality,
            squad: updatedPlayer.squad,
            medical_status: updatedPlayer.medicalStatus,
            availability: updatedPlayer.availability,
            image_url: updatedPlayer.imageUrl, // We save the string (url or base64) directly
            notes: updatedPlayer.notes,
            is_in_training_squad: updatedPlayer.isInTrainingSquad,
            // We usually don't manually set appearances/goals here if they come from matches,
            // but we might want to allow manual override? For now, stick to basic fields.
            age: updatedPlayer.age
        };

        if (updatedPlayer.dateOfBirth) {
            // Recalc age
            const birthDate = new Date(updatedPlayer.dateOfBirth);
            const today = new Date();
            let age = today.getFullYear() - birthDate.getFullYear();
            const m = today.getMonth() - birthDate.getMonth();
            if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
            payload.age = age;
        }

        try {
            if (isNew) {
                // INSERT
                const { error } = await supabase.from("players").insert([payload]);
                if (error) throw error;
            } else {
                // UPDATE
                const { error } = await supabase
                    .from("players")
                    .update(payload)
                    .eq("id", updatedPlayer.id);
                if (error) throw error;
            }

            // Refresh data to get generated IDs and sync state
            await fetchData();
            setEditingPlayer(null);
            setPreviewImage(null);
        } catch (e: any) {
            alert("Error saving player: " + e.message);
        }
    };

    const handleStatusToggle = async (player: Player) => {
        const currentStatus = player.medicalStatus;
        let nextStatus = "Available";
        if (currentStatus === "Available") nextStatus = "Unavailable";
        else if (currentStatus === "Unavailable") nextStatus = "Holiday";
        else if (currentStatus === "Holiday") nextStatus = "Injured";
        else if (currentStatus === "Injured") nextStatus = "Available";

        // Optimistic
        setPlayers(prev => prev.map(p => p.id === player.id ? { ...p, medicalStatus: nextStatus as any } : p));

        // DB Update
        await supabase.from("players").update({ medical_status: nextStatus }).eq("id", player.id);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-slate-900">Squad Management</h2>
                    <p className="text-slate-500">View and manage player profiles, availability, and stats.</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">

                    <Button className="bg-red-600 hover:bg-red-700" onClick={handleAddPlayer}>
                        <Plus className="h-4 w-4 mr-2" /> Add Player
                    </Button>
                </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 bg-white p-4 rounded-lg border shadow-sm">
                <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
                    <Input
                        placeholder="Search players..."
                        className="pl-9"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex gap-2">
                    {(["firstTeam", "midweek", "youth"] as const).map((squad) => (
                        <Button
                            key={squad}
                            variant={squadFilter === squad ? "default" : "outline"}
                            onClick={() => setSquadFilter(squad)}
                            className={squadFilter === squad ? "bg-slate-900" : ""}
                        >
                            {SQUAD_LABELS[squad]}
                        </Button>
                    ))}
                </div>
                <div className="flex gap-2">
                    {(["All", "GK", "DEF", "MID", "FWD"] as const).map((pos) => (
                        <Button
                            key={pos}
                            variant={positionFilter === pos ? "default" : "outline"}
                            onClick={() => setPositionFilter(pos)}
                            className={
                                positionFilter === pos
                                    ? pos === "GK" ? "bg-amber-500 hover:bg-amber-600 text-white"
                                        : pos === "DEF" ? "bg-sky-600 hover:bg-sky-700 text-white"
                                            : pos === "MID" ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                                                : pos === "FWD" ? "bg-rose-600 hover:bg-rose-700 text-white"
                                                    : "bg-slate-900"
                                    : ""
                            }
                        >
                            {pos}
                        </Button>
                    ))}
                </div>
                <div className="flex gap-2 items-center">
                    <Button
                        variant={showAvailableOnly ? "default" : "outline"}
                        onClick={() => setShowAvailableOnly(!showAvailableOnly)}
                        className={showAvailableOnly ? "bg-green-600 hover:bg-green-700 text-white border-green-600" : "border-dashed"}
                    >
                        {showAvailableOnly ? "Showing Available" : "Show Available Only"}
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {sortedPlayers.map((player) => (
                    <PlayerCard
                        key={player.id}
                        player={player}
                        onDelete={handleDelete}
                        onEdit={handleEdit}
                        onStatusToggle={handleStatusToggle}
                    />
                ))}
            </div>

            {filteredPlayers.length === 0 && (
                <div className="text-center py-12 text-slate-500">
                    <p>No players found matching your criteria.</p>
                    <Button variant="link" onClick={() => { setSearchTerm(""); setSquadFilter("firstTeam"); setPositionFilter("All"); setShowAvailableOnly(false); }}>
                        Clear filters
                    </Button>
                </div>
            )}

            {editingPlayer && (
                <div className="fixed inset-0 z-50 flex justify-end">
                    <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={() => setEditingPlayer(null)} />
                    <div onPaste={handlePaste} className="relative h-screen w-[450px] bg-white shadow-xl border-l flex flex-col animate-in slide-in-from-right duration-300">
                        <div className="p-3 border-b flex items-center justify-between shrink-0 bg-slate-50">
                            <h2 className="text-lg font-semibold text-slate-800">{editingPlayer.firstName ? "Edit Player" : "Add Player"}</h2>
                            <button onClick={() => setEditingPlayer(null)} className="text-sm text-slate-400 hover:text-slate-700 p-2">✕</button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-sm">
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <label className="block text-xs font-medium text-slate-500">First Name</label>
                                    <Input
                                        value={editingPlayer.firstName}
                                        onChange={(e) => setEditingPlayer({ ...editingPlayer, firstName: e.target.value })}
                                        className="w-full h-8 px-2 text-sm"
                                        placeholder="First Name"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="block text-xs font-medium text-slate-500">Last Name</label>
                                    <Input
                                        value={editingPlayer.lastName}
                                        onChange={(e) => setEditingPlayer({ ...editingPlayer, lastName: e.target.value })}
                                        className="w-full h-8 px-2 text-sm"
                                        placeholder="Last Name"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="block text-xs font-medium text-slate-500">Photograph</label>
                                <div
                                    className="flex items-center gap-3 p-2 bg-slate-50 rounded border border-slate-100 group transition-colors hover:bg-slate-100 hover:border-slate-300"
                                    onDragOver={(e) => {
                                        e.preventDefault();
                                        e.currentTarget.classList.add('border-blue-500', 'bg-blue-50');
                                    }}
                                    onDragLeave={(e) => {
                                        e.preventDefault();
                                        e.currentTarget.classList.remove('border-blue-500', 'bg-blue-50');
                                    }}
                                    onDrop={(e) => {
                                        e.preventDefault();
                                        e.currentTarget.classList.remove('border-blue-500', 'bg-blue-50');
                                        const file = e.dataTransfer.files?.[0];
                                        if (file && editingPlayer) {
                                            const reader = new FileReader();
                                            reader.onloadend = () => {
                                                setEditingPlayer({ ...editingPlayer, imageUrl: reader.result as string });
                                            };
                                            reader.readAsDataURL(file);
                                        }
                                    }}
                                >
                                    <div className="h-14 w-14 rounded-full bg-white border border-slate-200 flex-shrink-0 overflow-hidden flex items-center justify-center relative">
                                        {previewImage ? (
                                            <img src={previewImage} alt="Preview" className="h-full w-full object-cover" />
                                        ) : (
                                            <span className="text-[9px] text-slate-300">No Img</span>
                                        )}
                                    </div>
                                    <div className="flex-1">
                                        <Input
                                            type="file"
                                            accept="image/*"
                                            onChange={handleImageUpload}
                                            className="h-8 text-[11px] file:mr-2 file:py-1 file:px-2 file:rounded-full file:border-0 file:text-[10px] file:font-semibold file:bg-slate-100 file:text-slate-600 hover:file:bg-slate-200"
                                        />
                                        <p className="text-[10px] text-slate-400 mt-1 ml-1">
                                            <strong>Drag & Drop</strong>, Paste (Ctrl+V), or Click to Browse.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="space-y-1">
                                    <label className="block text-xs font-medium text-slate-500">Squad</label>
                                    <div className="flex gap-2">
                                        {(["firstTeam", "midweek", "youth"] as const).map(squad => (
                                            <button
                                                key={squad}
                                                onClick={() => setEditingPlayer({ ...editingPlayer, squad })}
                                                className={`px-3 py-1.5 text-xs border rounded transition-colors ${editingPlayer.squad === squad
                                                    ? "bg-slate-900 text-white border-slate-900"
                                                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                                                    }`}
                                            >
                                                {SQUAD_LABELS[squad]}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {editingPlayer.squad !== "firstTeam" && (
                                    <div className="flex items-center gap-2 p-2 bg-slate-50 rounded border border-slate-200">
                                        <input
                                            type="checkbox"
                                            id="trainingSquad"
                                            checked={editingPlayer.isInTrainingSquad || false}
                                            onChange={(e) => setEditingPlayer({ ...editingPlayer, isInTrainingSquad: e.target.checked })}
                                            className="h-4 w-4 rounded border-gray-300 text-slate-900 focus:ring-slate-900"
                                        />
                                        <label htmlFor="trainingSquad" className="text-xs font-medium text-slate-700 cursor-pointer">
                                            Include in Training Tracker
                                        </label>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-1">
                                <label className="block text-xs font-medium text-slate-500">Position</label>
                                <select
                                    className="w-full h-8 border rounded px-2 text-xs bg-white focus:ring-2 focus:ring-slate-400 focus:outline-none"
                                    value={editingPlayer.position}
                                    onChange={(e) => setEditingPlayer({ ...editingPlayer, position: e.target.value as any })}
                                >
                                    <option value="GK">Goalkeeper (GK)</option>
                                    <option value="LB">Left Back (LB)</option>
                                    <option value="CB">Centre Back (CB)</option>
                                    <option value="RB">Right Back (RB)</option>
                                    <option value="CDM">Defensive Mid (CDM)</option>
                                    <option value="CM">Centre Mid (CM)</option>
                                    <option value="CAM">Attacking Mid (CAM)</option>
                                    <option value="LW">Left Wing (LW)</option>
                                    <option value="RW">Right Wing (RW)</option>
                                    <option value="CF">Centre Forward (CF)</option>
                                    <option value="ST">Striker (ST)</option>
                                </select>
                            </div>

                            <div className="space-y-1">
                                <label className="block text-xs font-medium text-slate-500">Date of Birth</label>
                                <div className="flex gap-2">
                                    <Input
                                        type="date"
                                        value={editingPlayer.dateOfBirth || ""}
                                        onChange={(e) => setEditingPlayer({ ...editingPlayer, dateOfBirth: e.target.value })}
                                        className="w-full h-8 px-2 text-xs"
                                    />
                                    <div className="w-12 h-8 flex items-center justify-center bg-slate-50 border rounded text-xs font-medium text-slate-600">
                                        {editingPlayer.age}
                                    </div>
                                </div>
                            </div>



                            <div className="space-y-1">
                                <label className="block text-xs font-medium text-slate-500">Notes</label>
                                <textarea
                                    className="w-full h-24 px-3 py-2 border rounded-md text-xs resize-none focus:ring-2 focus:ring-slate-400 focus:outline-none"
                                    value={editingPlayer.notes || ""}
                                    onChange={(e) => setEditingPlayer({ ...editingPlayer, notes: e.target.value })}
                                    placeholder="Add player notes..."
                                ></textarea>
                            </div>
                        </div>

                        <div className="p-4 border-t flex justify-between items-center shrink-0 bg-slate-50">
                            <button
                                onClick={() => {
                                    if (confirm("Delete this player permanently?")) {
                                        handleDelete(editingPlayer.id);
                                        setEditingPlayer(null);
                                    }
                                }}
                                className="px-3 py-1.5 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                            >
                                Delete Player
                            </button>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setEditingPlayer(null)}
                                    className="px-4 py-1.5 text-xs border border-slate-300 rounded hover:bg-slate-100 text-slate-700 transition-colors"
                                >
                                    Cancel
                                </button>
                                <Button
                                    onClick={() => handleSavePlayer(editingPlayer)}
                                    className="px-6 py-1.5 text-xs bg-slate-900 hover:bg-slate-800 text-white rounded shadow-sm transition-all active:scale-95"
                                >
                                    Save Player
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
