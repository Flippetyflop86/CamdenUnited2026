"use client";
// forcing refresh

import { useState, useEffect, useRef } from "react";
import { Player, SquadType, MedicalStatus, Position } from "@/types";
import { useClub } from "@/context/club-context";
import { PlayerCard } from "@/components/squad/player-card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Plus, Filter, Settings, Trash2, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/lib/supabase";
import imageCompression from "browser-image-compression";
import { UploadCloud, Loader2 } from "lucide-react";

const getCurrentSeasonStr = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = d.getMonth(); // 0 = Jan, 5 = Jun
    return month >= 5 
        ? `${year.toString().slice(2)}/${(year + 1).toString().slice(2)}`
        : `${(year - 1).toString().slice(2)}/${year.toString().slice(2)}`;
};

export default function SquadPage() {
    const [searchTerm, setSearchTerm] = useState("");
    const [positionFilter, setPositionFilter] = useState<"All" | "GK" | "DEF" | "MID" | "FWD">("All");
    const [showAvailableOnly, setShowAvailableOnly] = useState(false);
    const [players, setPlayers] = useState<Player[]>([]);
    const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const hasLoaded = useRef(false);

    const { settings, updateSettings } = useClub();
    const currentSquads = settings.squads || ["First Team"];
    const [activeTab, setActiveTab] = useState(currentSquads[0] || "All");
    const [isManageSquadsOpen, setIsManageSquadsOpen] = useState(false);
    const [editingSquads, setEditingSquads] = useState<string[]>(currentSquads);
    const [isUploadingImage, setIsUploadingImage] = useState(false);

    const [seasonFilter, setSeasonFilter] = useState<string>(getCurrentSeasonStr());
    const [availableSeasons, setAvailableSeasons] = useState<string[]>([]);

    // 1. Initial load: Supabase
    useEffect(() => {
        fetchData();
        const channel = supabase
            .channel("public:players")
            .on("postgres_changes", { event: "*", schema: "public", table: "players" }, () => fetchData())
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [seasonFilter]);

    async function fetchData() {
        try {
            const [playersRes, matchesRes, statsRes] = await Promise.all([
                supabase.from("players").select("*"),
                supabase.from("matches").select("id, date"),
                supabase.from("match_player_stats").select("*")
            ]);

            if (playersRes.error) throw playersRes.error;
            const dbPlayers = playersRes.data || [];
            const matches = matchesRes.data || [];
            const stats = statsRes.data || [];

            const matchSeasons = new Map<string, string>();
            const seasonSet = new Set<string>();
            
            matches.forEach((m: any) => {
                let seasonStr = "";
                if (!m.date) {
                    seasonStr = getCurrentSeasonStr();
                } else {
                    const d = new Date(m.date);
                    if (isNaN(d.getTime())) {
                        seasonStr = getCurrentSeasonStr();
                    } else {
                        const year = d.getFullYear();
                        const month = d.getMonth(); // 0 = Jan, 5 = Jun
                        if (month >= 5) {
                            seasonStr = `${year.toString().slice(2)}/${(year + 1).toString().slice(2)}`;
                        } else {
                            seasonStr = `${(year - 1).toString().slice(2)}/${year.toString().slice(2)}`;
                        }
                    }
                }
                matchSeasons.set(m.id, seasonStr);
                seasonSet.add(seasonStr);
            });
            
            // Ensure the current season is always in the list even if no matches exist yet
            seasonSet.add(getCurrentSeasonStr());
            setAvailableSeasons(Array.from(seasonSet).sort().reverse());

            // Calculate stats per player for the selected season
            const playerStats = new Map<string, { apps: number, goals: number, assists: number, yellow: number, red: number }>();
            stats.forEach((s: any) => {
                const season = matchSeasons.get(s.match_id);
                if (seasonFilter !== "All" && season !== seasonFilter) return;

                const p = playerStats.get(s.player_id) || { apps: 0, goals: 0, assists: 0, yellow: 0, red: 0 };
                p.apps += 1;
                p.goals += (s.goals || 0);
                p.assists += (s.assists || 0);
                playerStats.set(s.player_id, p);
            });

            // Parse yellow and red cards directly from match strings
            matches.forEach((m: any) => {
                const season = matchSeasons.get(m.id);
                if (seasonFilter !== "All" && season !== seasonFilter) return;

                const parseCards = (cardStr: string, type: 'yellow' | 'red') => {
                    if (!cardStr) return;
                    const entries = cardStr.split(",");
                    entries.forEach(entry => {
                        entry = entry.trim();
                        if (!entry) return;
                        
                        let count = 1;
                        let name = entry;
                        const trailingMatch = entry.match(/\s*\(?(?:x\s*)?(\d+)\)?$/i);
                        if (trailingMatch) {
                            count = parseInt(trailingMatch[1]);
                            name = entry.replace(/\s*\(?(?:x\s*)?\d+\)?$/i, "").trim();
                        }
                        
                        const matchedPlayer = dbPlayers.find((p: any) => {
                            const fullName = `${p.first_name} ${p.last_name}`.toLowerCase();
                            const initialLast = `${p.first_name.charAt(0)}.${p.last_name}`.toLowerCase();
                            const initialSpaceLast = `${p.first_name.charAt(0)} ${p.last_name}`.toLowerCase();
                            const justLast = p.last_name.toLowerCase();
                            const search = name.toLowerCase();
                            return fullName.includes(search) || initialLast.includes(search) || initialSpaceLast.includes(search) || justLast === search;
                        });

                        if (matchedPlayer) {
                            const pStat = playerStats.get(matchedPlayer.id) || { apps: 0, goals: 0, assists: 0, yellow: 0, red: 0 };
                            if (type === 'yellow') pStat.yellow += count;
                            if (type === 'red') pStat.red += count;
                            playerStats.set(matchedPlayer.id, pStat);
                        }
                    });
                };
                
                // We use m.yellow_cards and m.red_cards from matches table
                parseCards(m.yellow_cards, 'yellow');
                parseCards(m.red_cards, 'red');
            });

            const formattedPlayers: Player[] = dbPlayers.map((p: any) => {
                const s = playerStats.get(p.id) || { apps: 0, goals: 0, assists: 0, yellow: 0, red: 0 };

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
                    appearances: s.apps,
                    goals: s.goals,
                    assists: s.assists,
                    yellow_cards: s.yellow,
                    red_cards: s.red,
                    dateOfBirth: p.date_of_birth,
                    holidayStart: p.holiday_start,
                    holidayEnd: p.holiday_end,
                    notes: p.notes,
                    isInTrainingSquad: p.is_in_training_squad,
                    isInMatchdayTracker: p.is_in_matchday_tracker,
                    secondaryPositions: p.secondary_position ? p.secondary_position.split(",").map((s: string) => s.trim() as Position) : [],
                    isContracted: p.is_contracted,
                    contractAmount: p.contract_amount,
                    contractFrequency: p.contract_frequency || "Weekly",
                    contractStartDate: p.contract_start_date,
                    contractEndDate: p.contract_end_date,
                    subsBillingModel: p.subs_billing_model || "Monthly",
                    subsCustomAmount: p.subs_custom_amount !== undefined && p.subs_custom_amount !== null ? Number(p.subs_custom_amount) : 0
                };
            });

            setPlayers(formattedPlayers);
            hasLoaded.current = true;
        } catch (e: any) {
            console.error("Error fetching squad:", e.message || e);
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure?")) return;
        setPlayers((prev) => prev.filter((p) => p.id !== id));
        await supabase.from("players").delete().eq("id", id);
    };

    const handleStatusToggle = async (player: Player) => {
        const statuses: MedicalStatus[] = ["Available", "Holiday", "Injured"];
        let nextIndex = 0;
        const currentIndex = statuses.indexOf(player.medicalStatus);
        if (currentIndex !== -1) {
            nextIndex = (currentIndex + 1) % statuses.length;
        }
        const nextStatus = statuses[nextIndex];

        setPlayers((prev) =>
            prev.map((p) => (p.id === player.id ? { ...p, medicalStatus: nextStatus } : p))
        );

        const { error } = await supabase
            .from("players")
            .update({ medical_status: nextStatus })
            .eq("id", player.id);

        if (error) {
            console.error("Error updating player status:", error);
            await fetchData();
        }
    };

    const filteredPlayers = players.filter((player) => {
        const SQUAD_LABELS: Record<string, string> = { firstTeam: "First Team", midweek: "Midweek", youth: "Youth" };
        const mappedSquad = SQUAD_LABELS[player.squad] || player.squad;
        
        const matchesSearch = player.firstName.toLowerCase().includes(searchTerm.toLowerCase()) || player.lastName.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesSquad = activeTab === "All" || mappedSquad === activeTab;
        const matchesPosition = positionFilter === "All" || (positionFilter === "GK" && player.position === "GK") || (positionFilter === "DEF" && ["DEF", "LB", "CB", "RB", "LWB", "RWB"].includes(player.position)) || (positionFilter === "MID" && ["MID", "CDM", "CM", "CAM", "LM", "RM"].includes(player.position)) || (positionFilter === "FWD" && ["FWD", "CF", "ST", "LW", "RW"].includes(player.position));
        const matchesAvailability = !showAvailableOnly || player.medicalStatus === "Available";
        return matchesSearch && matchesSquad && matchesPosition && matchesAvailability;
    });

    const positionOrder: Record<string, number> = { "GK": 1, "DEF": 2, "LB": 3, "CB": 4, "RB": 5, "LWB": 6, "RWB": 7, "CDM": 8, "MID": 9, "CM": 10, "LM": 11, "RM": 12, "CAM": 13, "LW": 14, "RW": 15, "FWD": 16, "CF": 17, "ST": 18 };
    const sortedPlayers = [...filteredPlayers].sort((a, b) => (positionOrder[a.position] || 99) - (positionOrder[b.position] || 99));

    const handleEdit = (player: Player) => { setEditingPlayer(player); setPreviewImage(player.imageUrl || null); };

    const handleSavePlayer = async (updatedPlayer: Player) => {
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
            image_url: updatedPlayer.imageUrl,
            notes: updatedPlayer.notes,
            holiday_start: updatedPlayer.holidayStart || null,
            holiday_end: updatedPlayer.holidayEnd || null,
            is_in_training_squad: updatedPlayer.isInTrainingSquad,
            is_in_matchday_tracker: updatedPlayer.isInMatchdayTracker,
            secondary_position: updatedPlayer.secondaryPositions && updatedPlayer.secondaryPositions.length > 0 ? updatedPlayer.secondaryPositions.join(",") : null,
            is_contracted: updatedPlayer.isContracted,
            contract_amount: updatedPlayer.contractAmount,
            contract_frequency: updatedPlayer.contractFrequency,
            contract_start_date: updatedPlayer.contractStartDate ? updatedPlayer.contractStartDate : null,
            contract_end_date: updatedPlayer.contractEndDate ? updatedPlayer.contractEndDate : null,
            subs_billing_model: updatedPlayer.subsBillingModel || "Monthly",
            subs_custom_amount: updatedPlayer.subsCustomAmount !== undefined && updatedPlayer.subsCustomAmount !== null ? updatedPlayer.subsCustomAmount : 0
        };
        try {
            let error;
            if (updatedPlayer.id === "new") {
                const res = await supabase.from("players").insert([payload]);
                error = res.error;
            } else {
                const res = await supabase.from("players").update(payload).eq("id", updatedPlayer.id);
                error = res.error;
            }
            if (error) throw error;
            await fetchData();
            setEditingPlayer(null);
        } catch (err: any) {
            console.error("Save Player Error:", err);
            alert("Database Error: " + err.message + "\n\nIf it says column 'secondary_position' or 'is_in_matchday_tracker' does not exist, please run this SQL query in your Supabase SQL Editor:\n\nALTER TABLE players ADD COLUMN IF NOT EXISTS secondary_position text;\nALTER TABLE players ADD COLUMN IF NOT EXISTS is_in_matchday_tracker boolean DEFAULT false;\nALTER TABLE players ADD COLUMN IF NOT EXISTS holiday_start date;\nALTER TABLE players ADD COLUMN IF NOT EXISTS holiday_end date;");
        }
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0 || !editingPlayer) return;
        const file = e.target.files[0];
        setIsUploadingImage(true);

        try {
            // Compress Image
            const options = {
                maxSizeMB: 0.1,
                maxWidthOrHeight: 400,
                useWebWorker: true
            };
            const compressedFile = await imageCompression(file, options);

            // Upload to Supabase Storage
            const fileName = `${Date.now()}_${compressedFile.name}`;
            const { data, error } = await supabase.storage
                .from('player-avatars')
                .upload(fileName, compressedFile, { cacheControl: '3600', upsert: false });

            if (error) throw error;

            // Get Public URL
            const { data: { publicUrl } } = supabase.storage.from('player-avatars').getPublicUrl(data.path);
            
            // Update State
            setEditingPlayer({ ...editingPlayer, imageUrl: publicUrl });

        } catch (error: any) {
            console.error("Upload error", error);
            alert("Failed to upload image. Make sure you created the 'player-avatars' public bucket in Supabase.");
        } finally {
            setIsUploadingImage(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-slate-900">Squad</h2>
                    <p className="text-slate-500">View and manage player profiles, availability, and stats.</p>
                </div>
                <div className="flex gap-2">
                    <Button onClick={() => setIsManageSquadsOpen(true)} variant="outline" size="icon">
                        <Settings className="w-4 h-4" />
                    </Button>
                    <Button className="bg-red-600 hover:bg-red-700" onClick={() => setEditingPlayer({ id: "new", firstName: "", lastName: "", position: "GK", squadNumber: 0, age: 0, nationality: "English", squad: currentSquads[0], medicalStatus: "Available", availability: true, contractExpiry: "", appearances: 0, goals: 0, assists: 0, imageUrl: "", isInTrainingSquad: true, isInMatchdayTracker: false, isContracted: false, contractAmount: 0, contractFrequency: "Weekly", contractStartDate: "", contractEndDate: "", subsBillingModel: "Monthly", subsCustomAmount: 0, holidayStart: "", holidayEnd: "" })}>
                        <Plus className="h-4 w-4 mr-2" /> Add Player
                    </Button>
                </div>
            </div>

            <div className="flex space-x-2 border-b border-slate-200 pb-2 overflow-x-auto no-scrollbar">
                <button onClick={() => setActiveTab("All")} className={`px-4 py-2 text-sm font-medium rounded-md whitespace-nowrap transition-colors ${activeTab === "All" ? "bg-red-50 text-red-700" : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"}`}>All Players</button>
                {currentSquads.map(squad => (
                    <button key={squad} onClick={() => setActiveTab(squad)} className={`px-4 py-2 text-sm font-medium rounded-md whitespace-nowrap transition-colors ${activeTab === squad ? "bg-red-50 text-red-700" : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"}`}>{squad}</button>
                ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-4 bg-white p-4 rounded-lg border shadow-sm items-center">
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
                    <Input placeholder="Search players..." className="pl-9" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                </div>

                <div className="flex gap-2 overflow-x-auto no-scrollbar shrink-0 max-w-full">
                    {(["All", "GK", "DEF", "MID", "FWD"] as const).map((pos) => (
                        <Button key={pos} variant={positionFilter === pos ? "default" : "outline"} onClick={() => setPositionFilter(pos)}>{pos}</Button>
                    ))}
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
                </div>
            )}

            {editingPlayer && (
                <div className="fixed inset-0 z-50 flex justify-end">
                    <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={() => setEditingPlayer(null)} />
                    <div className="relative h-full w-full max-w-[450px] bg-white shadow-xl border-l flex flex-col animate-in slide-in-from-right duration-300">
                        <div className="p-3 border-b flex items-center justify-between shrink-0 bg-slate-50">
                            <h2 className="text-lg font-semibold text-slate-800">{editingPlayer.firstName ? "Edit Player" : "Add Player"}</h2>
                            <button onClick={() => setEditingPlayer(null)} className="text-sm text-slate-400 hover:text-slate-700 p-2">✕</button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-sm">
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <label className="block text-xs font-medium text-slate-500">First Name</label>
                                    <Input value={editingPlayer.firstName} onChange={(e) => setEditingPlayer({ ...editingPlayer, firstName: e.target.value })} className="h-8 text-sm" />
                                </div>
                                <div className="space-y-1">
                                    <label className="block text-xs font-medium text-slate-500">Last Name</label>
                                    <Input value={editingPlayer.lastName} onChange={(e) => setEditingPlayer({ ...editingPlayer, lastName: e.target.value })} className="h-8 text-sm" />
                                </div>
                            </div>
                            
                            <div className="space-y-1">
                                <label className="block text-xs font-medium text-slate-500">Player Photo</label>
                                <div className="flex items-center gap-4">
                                    {editingPlayer.imageUrl ? (
                                        <div className="relative h-12 w-12 rounded-full overflow-hidden border-2 border-slate-200 shrink-0 bg-slate-100">
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img src={editingPlayer.imageUrl} alt="Avatar" className="object-cover h-full w-full" />
                                        </div>
                                    ) : (
                                        <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center shrink-0 border-2 border-slate-200">
                                            <span className="text-slate-400 font-bold text-xs">{editingPlayer.firstName?.[0]}{editingPlayer.lastName?.[0]}</span>
                                        </div>
                                    )}
                                    <label className="flex items-center justify-center px-4 py-2 border border-slate-200 rounded-md shadow-sm text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 cursor-pointer flex-1 transition-colors">
                                        {isUploadingImage ? <Loader2 className="h-4 w-4 mr-2 animate-spin text-slate-500" /> : <UploadCloud className="h-4 w-4 mr-2 text-slate-500" />}
                                        {isUploadingImage ? "Uploading..." : "Upload Photo"}
                                        <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} disabled={isUploadingImage} />
                                    </label>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="space-y-1">
                                    <label className="block text-xs font-medium text-slate-500">Squad</label>
                                    <div className="flex flex-wrap gap-2">
                                        {currentSquads.map(squad => (
                                            <button
                                                key={squad}
                                                onClick={() => setEditingPlayer({ ...editingPlayer, squad })}
                                                className={`px-3 py-1.5 text-xs border rounded transition-colors ${editingPlayer.squad === squad
                                                    ? "bg-slate-900 text-white border-slate-900"
                                                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                                                    }`}
                                            >
                                                {squad}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {editingPlayer.squad !== currentSquads[0] && (
                                     <div className="space-y-2 p-2 bg-slate-50 rounded border border-slate-200">
                                         <div className="flex items-center gap-2">
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
                                         <div className="flex items-center gap-2 border-t pt-2 border-slate-200">
                                             <input
                                                 type="checkbox"
                                                 id="matchdayTracker"
                                                 checked={editingPlayer.isInMatchdayTracker || false}
                                                 onChange={(e) => setEditingPlayer({ ...editingPlayer, isInMatchdayTracker: e.target.checked })}
                                                 className="h-4 w-4 rounded border-gray-300 text-slate-900 focus:ring-slate-900"
                                             />
                                             <label htmlFor="matchdayTracker" className="text-xs font-medium text-slate-700 cursor-pointer">
                                                 Include in Matchday XI Tracker
                                             </label>
                                         </div>
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
                                    <option value="LWB">Left Wing Back (LWB)</option>
                                    <option value="CB">Centre Back (CB)</option>
                                    <option value="RB">Right Back (RB)</option>
                                    <option value="RWB">Right Wing Back (RWB)</option>
                                    <option value="CDM">Defensive Mid (CDM)</option>
                                    <option value="CM">Centre Mid (CM)</option>
                                    <option value="CAM">Attacking Mid (CAM)</option>
                                    <option value="LW">Left Wing (LW)</option>
                                    <option value="RW">Right Wing (RW)</option>
                                    <option value="CF">Centre Forward (CF)</option>
                                    <option value="ST">Striker (ST)</option>
                                </select>
                            </div>                             
                            <div className="space-y-1.5">
                                 <label className="block text-xs font-medium text-slate-500">Secondary Positions (Select Multiple)</label>
                                 <div className="flex flex-wrap gap-1.5 max-h-[160px] overflow-y-auto p-1 bg-slate-50 rounded border border-slate-200">
                                     {(["GK", "LB", "LWB", "CB", "RB", "RWB", "CDM", "CM", "CAM", "LM", "RM", "LW", "RW", "CF", "ST"] as const)
                                         .filter(pos => pos !== editingPlayer.position)
                                         .map(pos => {
                                             const isSelected = (editingPlayer.secondaryPositions || []).includes(pos);
                                             return (
                                                 <button
                                                     key={pos}
                                                     type="button"
                                                     onClick={() => {
                                                         const current = editingPlayer.secondaryPositions || [];
                                                         const next = current.includes(pos)
                                                             ? current.filter(p => p !== pos)
                                                             : [...current, pos];
                                                         setEditingPlayer({ ...editingPlayer, secondaryPositions: next });
                                                     }}
                                                     className={`px-2 py-1 text-[10px] font-semibold border rounded-full transition-all whitespace-nowrap ${
                                                         isSelected 
                                                             ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                                                             : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                                                     }`}
                                                 >
                                                     {pos}
                                                 </button>
                                             );
                                         })}
                                 </div>
                             </div>

                            <div className="space-y-1">
                                <label className="block text-xs font-medium text-slate-500">Status</label>
                                <select
                                    className="w-full h-8 border rounded px-2 text-xs bg-white focus:ring-2 focus:ring-slate-400 focus:outline-none"
                                    value={editingPlayer.medicalStatus || "Available"}
                                    onChange={(e) => setEditingPlayer({ ...editingPlayer, medicalStatus: e.target.value as any })}
                                >
                                    <option value="Available">Available</option>
                                    <option value="Holiday">On Holiday</option>
                                    <option value="Injured">Injured</option>
                                    <option value="Unavailable">Unavailable</option>
                                    <option value="Doubtful">Doubtful</option>
                                    <option value="Suspended">Suspended</option>
                                </select>
                            </div>

                            <div className="space-y-1">
    <label className="block text-xs font-medium text-slate-500">Date of Birth</label>
    <div className="flex gap-2">
        <Input
            type="date"
            value={editingPlayer.dateOfBirth || ""}
            onChange={(e) => {
                const dob = e.target.value;
                let computedAge = editingPlayer.age;
                if (dob) {
                    const birthDate = new Date(dob);
                    const today = new Date();
                    let age = today.getFullYear() - birthDate.getFullYear();
                    const m = today.getMonth() - birthDate.getMonth();
                    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
                        age--;
                    }
                    computedAge = age;
                }
                setEditingPlayer({ ...editingPlayer, dateOfBirth: dob, age: computedAge });
            }}
            className="w-full h-8 px-2 text-xs"
        />
        <div className="w-12 h-8 flex items-center justify-center bg-slate-50 border rounded text-xs font-medium text-slate-600">{editingPlayer.age}</div>
    </div>
</div>
<div className="space-y-1 mt-2">
    <label className="block text-xs font-medium text-slate-500">Holiday Start</label>
    <Input
        type="date"
        value={editingPlayer.holidayStart || ""}
        onChange={e => setEditingPlayer({ ...editingPlayer, holidayStart: e.target.value })}
        className="w-full h-8 px-2 text-xs"
    />
</div>
<div className="space-y-1 mt-2">
    <label className="block text-xs font-medium text-slate-500">Holiday End</label>
    <Input
        type="date"
        value={editingPlayer.holidayEnd || ""}
        onChange={e => setEditingPlayer({ ...editingPlayer, holidayEnd: e.target.value })}
        className="w-full h-8 px-2 text-xs"
    />
</div>

                            {/* Player Contracts Section */}
                            {settings.contractsEnabled && (
                                <div className="pt-2 border-t mt-2 border-slate-100">
                                    <label className="flex items-center gap-2 text-sm font-medium text-slate-700 cursor-pointer mb-3">
                                        <input
                                            type="checkbox"
                                            checked={editingPlayer.isContracted || false}
                                            onChange={(e) => setEditingPlayer({ 
                                                ...editingPlayer, 
                                                isContracted: e.target.checked,
                                                contractFrequency: e.target.checked ? (editingPlayer.contractFrequency || "Weekly") : "Weekly"
                                            })}
                                            className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
                                        />
                                        Player is Contracted (Paid by Club)
                                    </label>

                                    {editingPlayer.isContracted && (
                                        <div className="grid grid-cols-2 gap-3 mb-2 p-3 bg-red-50/50 rounded border border-red-100">
                                            <div className="space-y-1">
                                                <label className="text-xs font-medium text-slate-500">Contract Amount (£)</label>
                                                <Input
                                                    type="number"
                                                    value={editingPlayer.contractAmount || ''}
                                                    onChange={(e) => setEditingPlayer({ ...editingPlayer, contractAmount: parseFloat(e.target.value) || 0 })}
                                                    className="h-8 text-xs bg-white"
                                                    placeholder="0"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-xs font-medium text-slate-500">Frequency</label>
                                                <select
                                                    value={editingPlayer.contractFrequency || 'Weekly'}
                                                    onChange={(e) => setEditingPlayer({ ...editingPlayer, contractFrequency: e.target.value as any })}
                                                    className="w-full h-8 px-2 border rounded-md text-xs bg-white"
                                                >
                                                    <option value="Weekly">Weekly</option>
                                                    <option value="Monthly">Monthly</option>
                                                </select>
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-xs font-medium text-slate-500">Start Date</label>
                                                <Input
                                                    type="date"
                                                    value={editingPlayer.contractStartDate || ''}
                                                    onChange={(e) => setEditingPlayer({ ...editingPlayer, contractStartDate: e.target.value })}
                                                    className="h-8 text-xs bg-white"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-xs font-medium text-slate-500">End Date</label>
                                                <Input
                                                    type="date"
                                                    value={editingPlayer.contractEndDate || ''}
                                                    onChange={(e) => setEditingPlayer({ ...editingPlayer, contractEndDate: e.target.value })}
                                                    className="h-8 text-xs bg-white"
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Player Subscriptions Section */}
                            {settings.subsEnabled && (
                                <div className="pt-2 border-t mt-2 border-slate-100">
                                    <div className="text-sm font-semibold text-slate-700 mb-2">Player Subscriptions Billing</div>
                                    <div className="grid grid-cols-2 gap-3 mb-2 p-3 bg-indigo-50/50 rounded border border-indigo-100">
                                        <div className="space-y-1">
                                            <label className="text-xs font-medium text-slate-500">Billing Model</label>
                                            <select
                                                value={editingPlayer.subsBillingModel || 'Monthly'}
                                                onChange={(e) => {
                                                    const val = e.target.value as any;
                                                    setEditingPlayer({ 
                                                        ...editingPlayer, 
                                                        subsBillingModel: val,
                                                        subsCustomAmount: val === "Exempt" ? 0 : editingPlayer.subsCustomAmount
                                                    });
                                                }}
                                                className="w-full h-8 px-2 border rounded-md text-xs bg-white"
                                            >
                                                <option value="Monthly">Flat Monthly Subs</option>
                                                <option value="Pay-As-You-Go">Pay-As-You-Go (Per Session)</option>
                                                <option value="Matchday-PAYG">Matchday-PAYG (Per Match)</option>
                                                <option value="Both-PAYG">Both PAYG (Sessions + Matches)</option>
                                                <option value="Exempt">Exempt (No Fee)</option>
                                            </select>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs font-medium text-slate-500">
                                                {editingPlayer.subsBillingModel === 'Pay-As-You-Go' ? 'Custom Session Fee (£)' :
                                                 editingPlayer.subsBillingModel === 'Matchday-PAYG' ? 'Custom Matchday Fee (£)' :
                                                 editingPlayer.subsBillingModel === 'Both-PAYG' ? 'Custom Matchday Fee (£)' :
                                                 'Custom Monthly Sub (£)'}
                                            </label>
                                            <Input
                                                type="number"
                                                placeholder={editingPlayer.subsBillingModel === 'Exempt' ? '0' : 'Optional (assumes 0 if empty)'}
                                                disabled={editingPlayer.subsBillingModel === 'Exempt'}
                                                value={editingPlayer.subsCustomAmount || ''}
                                                onChange={(e) => setEditingPlayer({ ...editingPlayer, subsCustomAmount: parseFloat(e.target.value) || 0 })}
                                                className="h-8 text-xs bg-white disabled:opacity-50"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}


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

                        <div className="p-4 pb-8 sm:pb-4 border-t flex justify-between items-center shrink-0 bg-slate-50">
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

            {/* Manage Squads Modal */}
            <Dialog open={isManageSquadsOpen} onOpenChange={(open) => {
                setIsManageSquadsOpen(open);
                if (open) setEditingSquads(currentSquads);
            }}>
                <DialogContent className="sm:max-w-[400px]">
                    <DialogHeader>
                        <DialogTitle>Manage Squads</DialogTitle>
                        <DialogDescription>
                            Define the squads for your club. These will be available when assigning players.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        {editingSquads.map((squad, index) => (
                            <div key={index} className="flex gap-2">
                                <Input
                                    value={squad}
                                    onChange={(e) => {
                                        const newSquads = [...editingSquads];
                                        newSquads[index] = e.target.value;
                                        setEditingSquads(newSquads);
                                    }}
                                    placeholder="Squad Name"
                                />
                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => {
                                        setEditingSquads(editingSquads.filter((_, i) => i !== index));
                                    }}
                                >
                                    <Trash2 className="w-4 h-4 text-slate-500 hover:text-red-600" />
                                </Button>
                            </div>
                        ))}
                        <Button
                            variant="outline"
                            className="w-full border-dashed"
                            onClick={() => setEditingSquads([...editingSquads, "New Squad"])}
                        >
                            <Plus className="w-4 h-4 mr-2" /> Add Squad
                        </Button>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsManageSquadsOpen(false)}>Cancel</Button>
                        <Button onClick={async () => {
                            const cleanSquads = editingSquads.filter(s => s.trim() !== "");
                            await updateSettings({ squads: cleanSquads });
                            if (!cleanSquads.includes(activeTab) && activeTab !== "All") setActiveTab("All");
                            setIsManageSquadsOpen(false);
                        }} className="bg-red-600 hover:bg-red-700">Save Squads</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

        </div>
    );
}
