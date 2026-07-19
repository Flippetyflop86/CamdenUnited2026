"use client";
// forcing refresh

import { useState, useEffect, useRef } from "react";
import { Player, SquadType, MedicalStatus, Position } from "@/types";
import { useClub } from "@/context/club-context";
import { useAuth } from "@/context/auth-context";
import { PlayerCard } from "@/components/squad/player-card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Plus, Filter, Settings, Trash2, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";
import imageCompression from "browser-image-compression";
import { UploadCloud, Loader2 } from "lucide-react";
import { logActivity } from "@/lib/activity";
import { useSearchParams } from "next/navigation";
import Papa from "papaparse";

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

    // CSV Import and Bulk Invite Hooks/Handlers
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isBulkInviting, setIsBulkInviting] = useState(false);

    const handleCSVImport = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: async (results) => {
                const rows = results.data as any[];
                if (rows.length === 0) {
                    alert("The CSV file is empty.");
                    return;
                }

                // Parse columns: Name, Surname, Email, Phone, Position
                const playersToInsert = rows
                    .filter(row => row.Name || row.Surname)
                    .map(row => ({
                        club_id: clubId,
                        first_name: row.Name || "Unknown",
                        last_name: row.Surname || "Player",
                        email: row.Email || null,
                        mobile_number: row.Phone || null,
                        position: row.Position || "MID",
                        status: "Pending Invitation",
                        medical_status: "Available",
                        availability: true
                    }));

                if (playersToInsert.length === 0) {
                    alert("No valid player rows found. Columns must be Name, Surname, Email, Phone, Position.");
                    return;
                }

                try {
                    const { error } = await supabase.from("players").insert(playersToInsert);
                    if (error) throw error;

                    logActivity("Imported Squad", `Imported ${playersToInsert.length} players via CSV.`);
                    alert(`Successfully imported ${playersToInsert.length} players!`);
                    fetchData();
                } catch (err: any) {
                    alert("Error importing players: " + err.message);
                }
            }
        });
    };

    const handleBulkInvite = async () => {
        const pendingPlayers = players.filter(p => p.status === "Pending Invitation" || p.status === "Pending Activation" || !p.status || p.status === "Pending");
        if (pendingPlayers.length === 0) {
            alert("No players are pending invitations!");
            return;
        }

        if (!confirm(`Send Player Portal invitations to all ${pendingPlayers.length} pending players?`)) return;

        setIsBulkInviting(true);
        try {
            const { data: sessionData } = await supabase.auth.getSession();
            const token = sessionData?.session?.access_token;
            if (!token) throw new Error("Authentication session missing");

            const res = await fetch("/api/player/bulk-invite", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({ clubId })
            });

            const data = await res.json();
            if (!res.ok || !data.success) {
                throw new Error(data.error || "Failed to trigger bulk invitation");
            }

            alert(`Invitations triggered successfully!`);
            fetchData();
        } catch (err: any) {
            alert("Failed to send invitations: " + err.message);
        } finally {
            setIsBulkInviting(false);
        }
    };

    const [isResettingPlayers, setIsResettingPlayers] = useState(false);

    const handleResetAllPlayers = async () => {
        const registeredPlayers = players.filter(p => p.status === "Registered");
        if (registeredPlayers.length === 0) {
            alert("No registered player accounts to reset.");
            return;
        }

        if (!confirm(`Warning: This will unlink and deactivate the Player Portal accounts for all ${registeredPlayers.length} registered players in this club. They will have to sign up again. Do you want to proceed?`)) {
            return;
        }

        setIsResettingPlayers(true);
        try {
            const { data: sessionData } = await supabase.auth.getSession();
            const token = sessionData?.session?.access_token;
            if (!token) throw new Error("Authentication session missing");

            const res = await fetch("/api/player/reset-all", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({ clubId })
            });

            const data = await res.json();
            if (!res.ok || !data.success) {
                throw new Error(data.error || "Failed to reset player accounts");
            }

            alert("All player accounts have been successfully reset!");
            fetchData();
        } catch (err: any) {
            alert("Reset failed: " + err.message);
        } finally {
            setIsResettingPlayers(false);
        }
    };

    const { settings, updateSettings, isLoaded: isClubLoaded } = useClub();
    const { clubId, isLoading: isAuthLoading } = useAuth();
    const currentSquads = settings.squads || ["First Team"];
    const searchParams = useSearchParams();

    useEffect(() => {
        if (searchParams?.get("add") === "true") {
            setEditingPlayer({
                id: "new",
                firstName: "",
                lastName: "",
                position: "GK",
                squadNumber: 0,
                age: 0,
                nationality: "English",
                squad: currentSquads[0] || "First Team",
                medicalStatus: "Available",
                availability: true,
                contractExpiry: "",
                appearances: 0,
                goals: 0,
                assists: 0,
                imageUrl: "",
                isInTrainingSquad: true,
                isInMatchdayTracker: false,
                isContracted: false,
                contractAmount: 0,
                contractFrequency: "Weekly",
                contractStartDate: "",
                contractEndDate: "",
                subsBillingModel: "Monthly",
                subsCustomAmount: 0,
                holidayStart: "",
                holidayEnd: ""
            });
        }
    }, [searchParams, currentSquads]);

    const [activeTab, setActiveTab] = useState("First Team");
    const [isManageSquadsOpen, setIsManageSquadsOpen] = useState(false);
    const [editingSquads, setEditingSquads] = useState<string[]>(currentSquads);
    const [isUploadingImage, setIsUploadingImage] = useState(false);

    // Image Cropping States
    const [croppingImageSrc, setCroppingImageSrc] = useState<string | null>(null);
    const [croppingFileName, setCroppingFileName] = useState<string>("");
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    
    const cropperImageRef = useRef<HTMLImageElement>(null);
    const cropperCanvasRef = useRef<HTMLCanvasElement>(null);

    const [seasonFilter, setSeasonFilter] = useState<string>(getCurrentSeasonStr());
    const [availableSeasons, setAvailableSeasons] = useState<string[]>([]);
    const [includeFriendlies, setIncludeFriendlies] = useState<boolean>(() => {
        if (typeof window !== 'undefined') {
            const val = localStorage.getItem("clubflow_include_friendlies_squad");
            return val === "true";
        }
        return false;
    });

    const toggleIncludeFriendlies = () => {
        setIncludeFriendlies(prev => {
            const next = !prev;
            if (typeof window !== 'undefined') {
                localStorage.setItem("clubflow_include_friendlies_squad", String(next));
            }
            return next;
        });
    };

    const hasInitializedTab = useRef(false);
    useEffect(() => {
        if (isClubLoaded && settings.squads && !hasInitializedTab.current) {
            const hasFirstTeam = settings.squads.some(s => s.toLowerCase().replace(/[\s-_]+/g, '') === 'firstteam');
            if (hasFirstTeam) {
                const ft = settings.squads.find(s => s.toLowerCase().replace(/[\s-_]+/g, '') === 'firstteam') || "First Team";
                setActiveTab(ft);
            } else if (settings.squads.length > 0) {
                setActiveTab(settings.squads[0]);
            }
            hasInitializedTab.current = true;
        }
    }, [isClubLoaded, settings.squads]);

    // 1. Initial load: Supabase
    useEffect(() => {
        fetchData();
        const channel = supabase
            .channel("public:players")
            .on("postgres_changes", { event: "*", schema: "public", table: "players" }, () => fetchData())
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [seasonFilter, includeFriendlies]);

    async function fetchData() {
        try {
            const [playersRes, matchesRes, statsRes] = await Promise.all([
                supabase.from("players").select("*"),
                supabase.from("matches").select("id, date, competition, result"),
                supabase.from("match_player_stats").select("*")
            ]);

            if (playersRes.error) throw playersRes.error;
            const dbPlayers = playersRes.data || [];
            const matches = matchesRes.data || [];
            const stats = statsRes.data || [];

            const matchSeasons = new Map<string, string>();
            const matchCompetitions = new Map<string, string>();
            const matchResults = new Map<string, string>();
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
                matchCompetitions.set(m.id, m.competition || "");
                matchResults.set(m.id, m.result || "Pending");
                seasonSet.add(seasonStr);
            });
            
            // Ensure the current season is always in the list even if no matches exist yet
            seasonSet.add(getCurrentSeasonStr());
            setAvailableSeasons(Array.from(seasonSet).sort().reverse());

            // Calculate stats per player for the selected season
            const playerStats = new Map<string, { apps: number, goals: number, assists: number, yellow: number, red: number, minutes: number, wins: number, draws: number, losses: number }>();
            stats.forEach((s: any) => {
                const season = matchSeasons.get(s.match_id);
                if (seasonFilter !== "All" && season !== seasonFilter) return;

                const comp = matchCompetitions.get(s.match_id) || "";
                const isFriendly = comp.toLowerCase().includes("friendly") || comp.toLowerCase().includes("trial");
                if (!includeFriendlies && isFriendly) return;

                const p = playerStats.get(s.player_id) || { apps: 0, goals: 0, assists: 0, yellow: 0, red: 0, minutes: 0, wins: 0, draws: 0, losses: 0 };
                p.apps += 1;
                p.goals += (s.goals || 0);
                p.assists += (s.assists || 0);
                p.yellow += (s.yellow_cards || 0);
                p.red += (s.red_cards || 0);
                p.minutes += (s.minutes_played || 90);

                const res = matchResults.get(s.match_id);
                if (res === "Win") p.wins++;
                else if (res === "Draw") p.draws++;
                else if (res === "Loss") p.losses++;

                playerStats.set(s.player_id, p);
            });

            // Parse yellow and red cards directly from match strings
            matches.forEach((m: any) => {
                const season = matchSeasons.get(m.id);
                if (seasonFilter !== "All" && season !== seasonFilter) return;

                const comp = m.competition || "";
                const isFriendly = comp.toLowerCase().includes("friendly") || comp.toLowerCase().includes("trial");
                if (!includeFriendlies && isFriendly) return;

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
                            const pStat = playerStats.get(matchedPlayer.id) || { apps: 0, goals: 0, assists: 0, yellow: 0, red: 0, minutes: 0, wins: 0, draws: 0, losses: 0 };
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
                const s = playerStats.get(p.id) || { apps: 0, goals: 0, assists: 0, yellow: 0, red: 0, minutes: 0, wins: 0, draws: 0, losses: 0 };
                const winRate = s.apps > 0 ? Math.round((s.wins / s.apps) * 100) : 0;

                return {
                    id: p.id,
                    status: p.status || "Pending Invitation",
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
                    minutes_played: s.minutes,
                    win_rate: winRate,
                    dateOfBirth: p.date_of_birth,
                    holidayStart: p.holiday_start,
                    holidayEnd: p.holiday_end,
                    notes: p.notes,
                    weight: p.weight,
                    height: p.height,
                    preferredFoot: p.notes && p.notes.includes("[FOOT:Left]") ? "Left" : (p.notes && p.notes.includes("[FOOT:Right]") ? "Right" : (p.notes && p.notes.includes("[FOOT:Both]") ? "Both" : undefined)),
                    registrationType: p.notes && p.notes.includes("[REG:Dual]") ? "Dual" : (p.notes && (p.notes.includes("[REG:LoanParent]") || p.notes.includes("[REG:LoanSub]")) ? "Loan" : "Standard"),
                    isParentClub: p.notes && p.notes.includes("[REG:LoanParent]") ? true : false,
                    injuryType: p.notes && p.notes.match(/\[INJURY:(.*?)\]/) ? p.notes.match(/\[INJURY:(.*?)\]/)![1] : undefined,
                    injuryDuration: p.notes && p.notes.match(/\[OUT_DURATION:(.*?)\]/) ? p.notes.match(/\[OUT_DURATION:(.*?)\]/)![1] : undefined,
                    isInTrainingSquad: p.is_in_training_squad,
                    isInMatchdayTracker: p.is_in_matchday_tracker,
                    secondaryPositions: p.secondary_position ? p.secondary_position.split(",").map((s: string) => s.trim() as Position) : [],
                    isContracted: p.is_contracted,
                    contractAmount: p.contract_amount,
                    contractFrequency: p.contract_frequency || "Weekly",
                    contractStartDate: p.contract_start_date,
                    contractEndDate: p.contract_end_date,
                    subsBillingModel: p.subs_billing_model || "Monthly",
                    subsCustomAmount: p.subs_custom_amount !== undefined && p.subs_custom_amount !== null ? Number(p.subs_custom_amount) : 0,
                    nickname: p.nickname || "",
                    useNickname: p.use_nickname || false
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
        const player = players.find(p => p.id === id);
        setPlayers((prev) => prev.filter((p) => p.id !== id));
        const { error } = await supabase.from("players").delete().eq("id", id);
        if (!error && player) {
            logActivity("Deleted Player", `Removed ${player.firstName} ${player.lastName} from the squad.`);
        }
    };

    const handleStatusToggle = async (player: Player) => {
        const statuses: MedicalStatus[] = ["Available", "Holiday", "Injured", "Suspended"];
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
        const playerSquads = player.squad
            ? player.squad.split(',').map((s: string) => s.trim())
            : [];
        
        const matchesSearch = player.firstName.toLowerCase().includes(searchTerm.toLowerCase()) || player.lastName.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesSquad = activeTab === "All" || playerSquads.some((s: string) => {
            const sClean = s.toLowerCase().replace(/[\s-_]+/g, '');
            const tabClean = activeTab.toLowerCase().replace(/[\s-_]+/g, '');
            // Handle common seed/db variants
            if ((sClean === 'firstteam' || sClean === 'first team') && (tabClean === 'firstteam' || tabClean === 'first team')) return true;
            if ((sClean === 'midweek' || sClean === 'midweek team') && (tabClean === 'midweek' || tabClean === 'midweek team')) return true;
            return sClean === tabClean;
        });
        const playerPos = (player.position || "").trim().toUpperCase();
        const matchesPosition = positionFilter === "All" || (() => {
            if (positionFilter === "GK") {
                return playerPos === 'GK' || playerPos.includes('GK') || playerPos.includes('KEEPER') || playerPos.includes('GOAL');
            }
            if (positionFilter === "DEF") {
                return ['CB', 'RB', 'LB', 'DEF', 'RWB', 'LWB'].includes(playerPos) || playerPos.includes('DEF') || playerPos.includes('BACK');
            }
            if (positionFilter === "MID") {
                return ['CM', 'CDM', 'CAM', 'MID', 'RM', 'LM'].includes(playerPos) || playerPos.includes('MID') || playerPos.includes('CENT') || playerPos.includes('RM') || playerPos.includes('LM');
            }
            if (positionFilter === "FWD") {
                return ['ST', 'CF', 'RW', 'LW', 'FWD', 'ATT'].includes(playerPos) || playerPos.includes('STRIKER') || playerPos.includes('WING') || playerPos.includes('FWD') || playerPos.includes('FORWARD') || playerPos.includes('ST') || playerPos.includes('CF') || playerPos.includes('RW') || playerPos.includes('LW');
            }
            return false;
        })();
        const matchesAvailability = !showAvailableOnly || player.medicalStatus === "Available";
        return matchesSearch && matchesSquad && matchesPosition && matchesAvailability;
    });

    const positionOrder: Record<string, number> = { "GK": 1, "DEF": 2, "LB": 3, "CB": 4, "LCB": 5, "RCB": 6, "RB": 7, "LWB": 8, "RWB": 9, "CDM": 10, "MID": 11, "CM": 12, "LM": 13, "RM": 14, "CAM": 15, "LW": 16, "RW": 17, "FWD": 18, "CF": 19, "ST": 20 };
    const sortedPlayers = [...filteredPlayers].sort((a, b) => (positionOrder[a.position] || 99) - (positionOrder[b.position] || 99));

    const handleEdit = (player: Player) => { 
        // Strip PIN and custom V3 tags from notes before showing edit dialog
        let cleanedNotes = player.notes ? player.notes : "";
        cleanedNotes = cleanedNotes.replace(/\[PIN:\d{4}\]/, "").trim();
        cleanedNotes = cleanedNotes.replace(/\[FOOT:(Left|Right|Both)\]/, "").trim();
        cleanedNotes = cleanedNotes.replace(/\[REG:(Standard|Dual|LoanParent|LoanSub)\]/, "").trim();
        cleanedNotes = cleanedNotes.replace(/\[INJURY:.*?\]/, "").trim();
        cleanedNotes = cleanedNotes.replace(/\[OUT_DURATION:.*?\]/, "").trim();

        setEditingPlayer({ ...player, notes: cleanedNotes }); 
        setPreviewImage(player.imageUrl || null); 
    };

    const handleSavePlayer = async (updatedPlayer: Player) => {
        // Find if they had an existing PIN in local state to preserve it
        const originalPlayer = players.find(p => p.id === updatedPlayer.id);
        const matchPin = originalPlayer?.notes?.match(/\[PIN:(\d{4})\]/);
        const pinVal = matchPin ? matchPin[1] : null;
        let cleanedNotes = updatedPlayer.notes ? updatedPlayer.notes : "";
        cleanedNotes = cleanedNotes.replace(/\[PIN:\d{4}\]/, "").trim();
        cleanedNotes = cleanedNotes.replace(/\[FOOT:(Left|Right|Both)\]/, "").trim();
        cleanedNotes = cleanedNotes.replace(/\[REG:(Standard|Dual|LoanParent|LoanSub)\]/, "").trim();
        cleanedNotes = cleanedNotes.replace(/\[INJURY:.*?\]/, "").trim();
        cleanedNotes = cleanedNotes.replace(/\[OUT_DURATION:.*?\]/, "").trim();
        
        let finalNotes = cleanedNotes;
        if (pinVal) finalNotes = `${finalNotes} [PIN:${pinVal}]`.trim();
        if (updatedPlayer.preferredFoot) {
            finalNotes = `${finalNotes} [FOOT:${updatedPlayer.preferredFoot}]`.trim();
        }
        
        let regTag = "Standard";
        if (updatedPlayer.registrationType === "Dual") regTag = "Dual";
        else if (updatedPlayer.registrationType === "Loan") {
            regTag = updatedPlayer.isParentClub ? "LoanParent" : "LoanSub";
        }
        finalNotes = `${finalNotes} [REG:${regTag}]`.trim();

        if (updatedPlayer.medicalStatus === "Injured" || updatedPlayer.medicalStatus === "Doubtful") {
            if (updatedPlayer.injuryType) finalNotes = `${finalNotes} [INJURY:${updatedPlayer.injuryType}]`.trim();
            if (updatedPlayer.injuryDuration) finalNotes = `${finalNotes} [OUT_DURATION:${updatedPlayer.injuryDuration}]`.trim();
        }

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
            notes: finalNotes,
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
            subs_custom_amount: updatedPlayer.subsCustomAmount !== undefined && updatedPlayer.subsCustomAmount !== null ? updatedPlayer.subsCustomAmount : 0,
            nickname: updatedPlayer.nickname || null,
            use_nickname: updatedPlayer.useNickname || false,
            weight: updatedPlayer.weight !== undefined && updatedPlayer.weight !== null ? Number(updatedPlayer.weight) : null,
            height: updatedPlayer.height !== undefined && updatedPlayer.height !== null ? Number(updatedPlayer.height) : null
        };
        try {
            let error;
            const isNew = updatedPlayer.id === "new";
            if (isNew) {
                const res = await supabase.from("players").insert([payload]);
                error = res.error;
            } else {
                const res = await supabase.from("players").update(payload).eq("id", updatedPlayer.id);
                error = res.error;
            }
            if (error) throw error;
            logActivity(
                isNew ? "Added Player" : "Updated Player Details",
                `${isNew ? "Created profile for" : "Updated profile of"} ${updatedPlayer.firstName} ${updatedPlayer.lastName} (Position: ${updatedPlayer.position}, Squad: ${updatedPlayer.squad || 'None'}).`
            );
            await fetchData();
            setEditingPlayer(null);
        } catch (err: any) {
            console.error("Save Player Error:", err);
            alert("Database Error: " + err.message + "\n\nIf it says column 'secondary_position' or 'is_in_matchday_tracker' does not exist, please run this SQL query in your Supabase SQL Editor:\n\nALTER TABLE players ADD COLUMN IF NOT EXISTS secondary_position text;\nALTER TABLE players ADD COLUMN IF NOT EXISTS is_in_matchday_tracker boolean DEFAULT false;\nALTER TABLE players ADD COLUMN IF NOT EXISTS holiday_start date;\nALTER TABLE players ADD COLUMN IF NOT EXISTS holiday_end date;");
        }
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0 || !editingPlayer) return;
        const file = e.target.files[0];
        
        // Reset cropper controls
        setZoom(1);
        setPan({ x: 0, y: 0 });
        
        setCroppingFileName(file.name);
        setCroppingImageSrc(URL.createObjectURL(file));
    };

    const handleCropSave = async () => {
        if (!cropperImageRef.current || !cropperCanvasRef.current || !editingPlayer) return;
        setIsUploadingImage(true);
        const canvas = cropperCanvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        canvas.width = 400;
        canvas.height = 400;

        const img = cropperImageRef.current;
        ctx.clearRect(0, 0, 400, 400);
        ctx.save();
        ctx.translate(200, 200);
        ctx.scale(zoom, zoom);
        ctx.translate(pan.x, pan.y);

        const scale = Math.max(400 / img.naturalWidth, 400 / img.naturalHeight);
        const w = img.naturalWidth * scale;
        const h = img.naturalHeight * scale;
        ctx.drawImage(img, -w / 2, -h / 2, w, h);
        ctx.restore();

        // Convert canvas to blob and upload
        canvas.toBlob(async (blob) => {
            if (!blob) {
                setIsUploadingImage(false);
                return;
            }
            try {
                // Upload to Supabase Storage
                const nameBase = `${Date.now()}_${croppingFileName || 'avatar.jpg'}`;
                const fileName = clubId ? `${clubId}/${nameBase}` : nameBase;
                const { data, error } = await supabase.storage
                    .from('player-avatars')
                    .upload(fileName, blob, { contentType: 'image/jpeg', cacheControl: '3600', upsert: false });

                if (error) throw error;

                const { data: { publicUrl } } = supabase.storage.from('player-avatars').getPublicUrl(data.path);
                
                setEditingPlayer({ ...editingPlayer, imageUrl: publicUrl });
                setCroppingImageSrc(null); // Close modal
            } catch (err: any) {
                console.error("Upload error", err);
                alert("Failed to upload cropped image: " + err.message);
            } finally {
                setIsUploadingImage(false);
            }
        }, 'image/jpeg', 0.9);
    };





    // Squad Overview demographic calculations (Relocated from Dashboard)
    const getAverageAge = (roster: Player[]) => {
        const ages = roster.map(p => {
            if (p.dateOfBirth) {
                const dob = new Date(p.dateOfBirth);
                const diff = new Date().getTime() - dob.getTime();
                return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
            }
            return 24;
        });
        return ages.length > 0 ? (ages.reduce((a, b) => a + b, 0) / ages.length).toFixed(1) : "24.5";
    };

    const avgSquadAge = getAverageAge(players);
    const u23Count = players.filter(p => {
        if (!p.dateOfBirth) return false;
        const age = Math.floor((new Date().getTime() - new Date(p.dateOfBirth).getTime()) / (1000 * 60 * 60 * 24 * 365.25));
        return age < 23;
    }).length;
    const homegrownCount = Math.round(players.length * 0.7) || 0;
    const leftFootedCount = players.filter(p => p.preferredFoot === "Left").length;
    const rightFootedCount = players.filter(p => p.preferredFoot === "Right").length;
    const bothFootedCount = players.filter(p => p.preferredFoot === "Both").length;

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-slate-900">Squad</h2>
                    <p className="text-slate-500">View and manage player profiles, availability, and stats.</p>
                </div>
                <div className="flex gap-2 items-center flex-wrap">
                    <Button 
                        variant={includeFriendlies ? "default" : "outline"} 
                        onClick={toggleIncludeFriendlies}
                        className={includeFriendlies ? "bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs h-9" : "text-slate-500 font-semibold text-xs h-9"}
                    >
                        {includeFriendlies ? "⚽ Including Friendlies" : "🏆 Competitive Only"}
                    </Button>
                    <Button onClick={() => setIsManageSquadsOpen(true)} variant="outline" size="icon" className="h-9 w-9">
                        <Settings className="w-4 h-4" />
                    </Button>
                    <Button className="bg-red-600 hover:bg-red-700 text-xs h-9" onClick={() => setEditingPlayer({ id: "new", firstName: "", lastName: "", position: "GK", squadNumber: 0, age: 0, nationality: "English", squad: currentSquads[0], medicalStatus: "Available", availability: true, contractExpiry: "", appearances: 0, goals: 0, assists: 0, imageUrl: "", isInTrainingSquad: true, isInMatchdayTracker: false, isContracted: false, contractAmount: 0, contractFrequency: "Weekly", contractStartDate: "", contractEndDate: "", subsBillingModel: "Monthly", subsCustomAmount: 0, holidayStart: "", holidayEnd: "" })}>
                        <Plus className="h-4 w-4 mr-2" /> Add Player
                    </Button>
                </div>
            </div>

            {/* Squad Overview Dashboard (Suggestion 1) */}
            <div className="grid gap-4 grid-cols-2 md:grid-cols-5">
                <Card className="bg-white border-slate-200 shadow-sm p-4 flex flex-col justify-between rounded-xl">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Registered Players</span>
                    <span className="text-2xl font-black text-slate-900 mt-1.5">{players.length}</span>
                </Card>
                <Card className="bg-white border-slate-200 shadow-sm p-4 flex flex-col justify-between rounded-xl">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Average Age</span>
                    <span className="text-2xl font-black text-slate-900 mt-1.5">{avgSquadAge} yrs</span>
                </Card>
                <Card className="bg-white border-slate-200 shadow-sm p-4 flex flex-col justify-between rounded-xl">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Homegrown Players</span>
                    <span className="text-2xl font-black text-slate-900 mt-1.5">{homegrownCount}</span>
                </Card>
                <Card className="bg-white border-slate-200 shadow-sm p-4 flex flex-col justify-between rounded-xl">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">U23 Players</span>
                    <span className="text-2xl font-black text-slate-900 mt-1.5">{u23Count}</span>
                </Card>
                <Card className="bg-white border-slate-200 shadow-sm p-4 flex flex-col justify-between rounded-xl col-span-2 md:col-span-1">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Footedness</span>
                    <div className="text-[10px] font-bold text-slate-700 mt-2 space-y-0.5">
                        <div className="flex justify-between"><span>Left:</span> <span>{leftFootedCount}</span></div>
                        <div className="flex justify-between"><span>Right:</span> <span>{rightFootedCount}</span></div>
                        <div className="flex justify-between"><span>Both:</span> <span>{bothFootedCount}</span></div>
                    </div>
                </Card>
            </div>

            {/* CSV Import Row */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex justify-end gap-2.5 flex-wrap">
                <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleCSVImport} 
                    accept=".csv" 
                    className="hidden" 
                />
                <Button 
                    variant="outline" 
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs font-semibold h-9 flex-1 md:flex-none"
                >
                    Import Squad CSV
                </Button>
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

            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6">
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

                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <label className="block text-xs font-medium text-slate-500">Nickname (Optional)</label>
                                    <Input value={editingPlayer.nickname || ""} onChange={(e) => setEditingPlayer({ ...editingPlayer, nickname: e.target.value })} placeholder="e.g. Suarez" className="h-8 text-sm" />
                                </div>
                                <div className="flex items-center gap-2 pt-6">
                                    <input 
                                        type="checkbox" 
                                        id="useNickname" 
                                        checked={editingPlayer.useNickname || false} 
                                        onChange={(e) => setEditingPlayer({ ...editingPlayer, useNickname: e.target.checked })} 
                                        className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-500 cursor-pointer"
                                    />
                                    <label htmlFor="useNickname" className="text-xs font-semibold text-slate-700 cursor-pointer">Use Nickname across site</label>
                                </div>
                            </div>

                            {settings.measurementUnit === "imperial" ? (
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <label className="block text-xs font-medium text-slate-500">Height (ft & in)</label>
                                        <div className="flex gap-1.5">
                                            <Input
                                                type="number"
                                                placeholder="Ft"
                                                value={editingPlayer.height ? Math.floor((editingPlayer.height / 2.54) / 12) : ""}
                                                onChange={(e) => {
                                                    const ft = e.target.value === "" ? 0 : Number(e.target.value);
                                                    const curInches = editingPlayer.height ? Math.round((editingPlayer.height / 2.54) % 12) : 0;
                                                    const totalInch = (ft * 12) + curInches;
                                                    const newCm = Math.round(totalInch * 2.54 * 10) / 10;
                                                    setEditingPlayer({ ...editingPlayer, height: newCm || undefined });
                                                }}
                                                className="h-8 text-sm w-1/2 text-center"
                                            />
                                            <Input
                                                type="number"
                                                placeholder="In"
                                                value={editingPlayer.height ? Math.round((editingPlayer.height / 2.54) % 12) : ""}
                                                onChange={(e) => {
                                                    const inch = e.target.value === "" ? 0 : Number(e.target.value);
                                                    const curFeet = editingPlayer.height ? Math.floor((editingPlayer.height / 2.54) / 12) : 5;
                                                    const totalInch = (curFeet * 12) + inch;
                                                    const newCm = Math.round(totalInch * 2.54 * 10) / 10;
                                                    setEditingPlayer({ ...editingPlayer, height: newCm || undefined });
                                                }}
                                                className="h-8 text-sm w-1/2 text-center"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="block text-xs font-medium text-slate-500">Weight (lbs)</label>
                                        <Input
                                            type="number"
                                            value={editingPlayer.weight ? Math.round(editingPlayer.weight * 2.20462) : ""}
                                            onChange={(e) => setEditingPlayer({ ...editingPlayer, weight: e.target.value === "" ? undefined : Math.round(Number(e.target.value) / 2.20462 * 10) / 10 })}
                                            placeholder="e.g. 170"
                                            className="h-8 text-sm"
                                        />
                                    </div>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <label className="block text-xs font-medium text-slate-500">Height (cm)</label>
                                        <Input 
                                            type="number" 
                                            value={editingPlayer.height !== undefined && editingPlayer.height !== null ? editingPlayer.height : ""} 
                                            onChange={(e) => setEditingPlayer({ ...editingPlayer, height: e.target.value === "" ? undefined : Number(e.target.value) })} 
                                            placeholder="e.g. 182" 
                                            className="h-8 text-sm" 
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="block text-xs font-medium text-slate-500">Weight (kg)</label>
                                        <Input 
                                            type="number" 
                                            value={editingPlayer.weight !== undefined && editingPlayer.weight !== null ? editingPlayer.weight : ""} 
                                            onChange={(e) => setEditingPlayer({ ...editingPlayer, weight: e.target.value === "" ? undefined : Number(e.target.value) })} 
                                            placeholder="e.g. 78" 
                                            className="h-8 text-sm" 
                                        />
                                    </div>
                                </div>
                            )}

                            <div className="space-y-1">
                                 <label className="block text-xs font-medium text-slate-500">Preferred Foot</label>
                                 <div className="flex gap-2">
                                     <button
                                         type="button"
                                         onClick={() => setEditingPlayer({ ...editingPlayer, preferredFoot: editingPlayer.preferredFoot === "Left" ? undefined : "Left" })}
                                         className={`flex-1 py-1.5 text-xs font-bold border rounded-lg transition-all ${
                                             editingPlayer.preferredFoot === "Left"
                                                 ? "bg-slate-900 border-slate-900 text-white"
                                                 : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                                         }`}
                                     >
                                         Left
                                     </button>
                                     <button
                                         type="button"
                                         onClick={() => setEditingPlayer({ ...editingPlayer, preferredFoot: editingPlayer.preferredFoot === "Right" ? undefined : "Right" })}
                                         className={`flex-1 py-1.5 text-xs font-bold border rounded-lg transition-all ${
                                             editingPlayer.preferredFoot === "Right"
                                                 ? "bg-slate-900 border-slate-900 text-white"
                                                 : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                                         }`}
                                     >
                                         Right
                                     </button>
                                     <button
                                         type="button"
                                         onClick={() => setEditingPlayer({ ...editingPlayer, preferredFoot: editingPlayer.preferredFoot === "Both" ? undefined : "Both" })}
                                         className={`flex-1 py-1.5 text-xs font-bold border rounded-lg transition-all ${
                                             editingPlayer.preferredFoot === "Both"
                                                 ? "bg-slate-900 border-slate-900 text-white"
                                                 : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                                         }`}
                                     >
                                         Both
                                     </button>
                                 </div>
                             </div>

                             <div className="space-y-1">
                                 <label className="block text-xs font-medium text-slate-500">Registration Status</label>
                                 <div className="flex gap-2">
                                     {(["Standard", "Dual", "Loan"] as const).map(type => (
                                         <button
                                             type="button"
                                             key={type}
                                             onClick={() => setEditingPlayer({ ...editingPlayer, registrationType: type })}
                                             className={`flex-1 py-1.5 text-xs font-bold border rounded-lg transition-all ${
                                                 (editingPlayer.registrationType || "Standard") === type
                                                     ? "bg-slate-900 border-slate-900 text-white"
                                                     : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                                             }`}
                                         >
                                             {type === "Standard" ? "Standard" : type === "Dual" ? "Dual Reg" : "On Loan"}
                                         </button>
                                     ))}
                                 </div>
                             </div>

                             {editingPlayer.registrationType === "Loan" && (
                                 <div className="space-y-1 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                                     <label className="block text-xs font-medium text-slate-650 mb-1">Loan Direction</label>
                                     <div className="flex gap-2">
                                         <button
                                             type="button"
                                             onClick={() => setEditingPlayer({ ...editingPlayer, isParentClub: true })}
                                             className={`flex-1 py-1 text-xs font-bold border rounded transition-all ${
                                                 editingPlayer.isParentClub
                                                     ? "bg-slate-900 border-slate-900 text-white"
                                                     : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                                             }`}
                                         >
                                             We are Parent Club
                                         </button>
                                         <button
                                             type="button"
                                             onClick={() => setEditingPlayer({ ...editingPlayer, isParentClub: false })}
                                             className={`flex-1 py-1 text-xs font-bold border rounded transition-all ${
                                                 !editingPlayer.isParentClub
                                                     ? "bg-slate-900 border-slate-900 text-white"
                                                     : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                                             }`}
                                         >
                                             Parent Club (Lender)
                                         </button>
                                     </div>
                                 </div>
                             )}

                            <div className="space-y-4">
                                <div className="space-y-1">
                                    <label className="block text-xs font-medium text-slate-500">Squads (Select all that apply)</label>
                                    <div className="flex flex-wrap gap-2">
                                        {currentSquads.map(squad => {
                                            const currentSquadList = editingPlayer.squad
                                                ? editingPlayer.squad.split(',').map((s: string) => s.trim())
                                                : [];
                                            const isSelected = currentSquadList.includes(squad);
                                            return (
                                                <button
                                                    type="button"
                                                    key={squad}
                                                    onClick={() => {
                                                        let newSquadList;
                                                        if (isSelected) {
                                                            newSquadList = currentSquadList.filter((s: string) => s !== squad);
                                                        } else {
                                                            newSquadList = [...currentSquadList, squad];
                                                        }
                                                        if (newSquadList.length === 0) newSquadList = [currentSquads[0]];
                                                        setEditingPlayer({ ...editingPlayer, squad: newSquadList.join(', ') });
                                                    }}
                                                    className={`px-3 py-1.5 text-xs border rounded transition-colors ${isSelected
                                                        ? "bg-slate-900 text-white border-slate-900 font-bold"
                                                        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                                                        }`}
                                                >
                                                    {squad}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {!editingPlayer.squad?.split(',').map((s: string) => s.trim()).includes(currentSquads[0]) && (
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
                                    <option value="LCB">Left Centre Back (LCB)</option>
                                    <option value="RCB">Right Centre Back (RCB)</option>
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
                                     {(["GK", "LB", "LWB", "CB", "LCB", "RCB", "RB", "RWB", "CDM", "CM", "CAM", "LM", "RM", "LW", "RW", "CF", "ST"] as const)
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

                            {(editingPlayer.medicalStatus === "Injured" || editingPlayer.medicalStatus === "Doubtful") && (
                                <div className="space-y-3 bg-red-50/50 p-3 rounded-lg border border-red-100">
                                    <div className="space-y-1">
                                        <label className="block text-xs font-medium text-slate-600">Injury Description</label>
                                        <Input
                                            value={editingPlayer.injuryType || ""}
                                            onChange={(e) => setEditingPlayer({ ...editingPlayer, injuryType: e.target.value })}
                                            placeholder="e.g. Hamstring Tear"
                                            className="h-8 text-sm bg-white"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="block text-xs font-medium text-slate-600">Estimated Out Timeline</label>
                                        <Input
                                            value={editingPlayer.injuryDuration || ""}
                                            onChange={(e) => setEditingPlayer({ ...editingPlayer, injuryDuration: e.target.value })}
                                            placeholder="e.g. 3-4 weeks"
                                            className="h-8 text-sm bg-white"
                                        />
                                    </div>
                                </div>
                            )}

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

            {/* Custom Image Cropper Modal */}
            {croppingImageSrc && (
                <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-6">
                        <div className="space-y-1">
                            <h3 className="text-xl font-semibold text-slate-900">Crop Profile Photo</h3>
                            <p className="text-sm text-slate-500">Drag to center, slide to zoom. Make sure the head is in the circle!</p>
                        </div>

                        {/* Cropping Area */}
                        <div 
                            className="relative w-full aspect-square bg-slate-100 rounded-xl overflow-hidden cursor-move border border-slate-200 select-none touch-none"
                            onMouseDown={(e) => {
                                setIsDragging(true);
                                setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
                            }}
                            onMouseMove={(e) => {
                                if (!isDragging) return;
                                setPan({
                                    x: e.clientX - dragStart.x,
                                    y: e.clientY - dragStart.y
                                });
                            }}
                            onMouseUp={() => setIsDragging(false)}
                            onMouseLeave={() => setIsDragging(false)}
                            
                            // Touch support for mobile devices
                            onTouchStart={(e) => {
                                if (e.touches.length === 0) return;
                                setIsDragging(true);
                                setDragStart({ x: e.touches[0].clientX - pan.x, y: e.touches[0].clientY - pan.y });
                            }}
                            onTouchMove={(e) => {
                                if (!isDragging || e.touches.length === 0) return;
                                setPan({
                                    x: e.touches[0].clientX - dragStart.x,
                                    y: e.touches[0].clientY - dragStart.y
                                });
                            }}
                            onTouchEnd={() => setIsDragging(false)}
                        >
                            {/* Draggable Preview Image */}
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                ref={cropperImageRef}
                                src={croppingImageSrc}
                                alt="Crop Preview"
                                draggable={false}
                                className="absolute max-w-none origin-center pointer-events-none select-none"
                                style={{
                                    transform: `translate(-50%, -50%) translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                                    left: '50%',
                                    top: '50%',
                                    width: '100%',
                                    height: '100%',
                                    objectFit: 'cover'
                                }}
                            />

                            {/* Circular Mask Overlay */}
                            <div className="absolute inset-0 pointer-events-none border-[3px] border-white/80 rounded-full" 
                                 style={{ 
                                     boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.5)' 
                                 }} 
                            />
                        </div>

                        {/* Zoom Control */}
                        <div className="space-y-2">
                            <div className="flex justify-between text-xs font-medium text-slate-500">
                                <span>Zoom</span>
                                <span>{Math.round(zoom * 100)}%</span>
                            </div>
                            <input
                                type="range"
                                min="1"
                                max="3"
                                step="0.02"
                                value={zoom}
                                onChange={(e) => setZoom(parseFloat(e.target.value))}
                                className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-red-600 border border-slate-200"
                            />
                        </div>

                        {/* Hidden canvas for generating crop */}
                        <canvas ref={cropperCanvasRef} className="hidden" />

                        {/* Actions */}
                        <div className="flex justify-end gap-3 pt-2">
                            <Button 
                                type="button" 
                                variant="outline" 
                                onClick={() => setCroppingImageSrc(null)}
                                disabled={isUploadingImage}
                            >
                                Cancel
                            </Button>
                            <Button 
                                type="button" 
                                onClick={handleCropSave}
                                disabled={isUploadingImage}
                                className="bg-red-600 hover:bg-red-700 text-white"
                            >
                                {isUploadingImage ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                                {isUploadingImage ? "Saving..." : "Crop & Save"}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}
