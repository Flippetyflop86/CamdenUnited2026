"use client";
// forcing refresh

import { useState, useEffect, useRef } from "react";
import { Player, SquadType, MedicalStatus, Position } from "@/types";
import {
    DEPARTURE_REASONS,
    formatPlayerName,
    isFormerPlayer,
    isPlayerInDeletedSquad,
    normalizeSquadKey,
    parsePlayerDeparture,
    serializeDepartureToNotes,
    stripDepartureTags,
    getLoanExpiryStatus,
} from "@/lib/utils";
import { useClub } from "@/context/club-context";
import { useAuth } from "@/context/auth-context";
import { PlayerCard } from "@/components/squad/player-card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import {
    Search,
    Plus,
    Filter,
    Settings,
    Trash2,
    X,
    UserMinus,
    RotateCcw,
    Archive,
    Users,
    LayoutGrid,
    List,
    CheckSquare,
    Check,
    ArrowUpDown,
    ArrowUp,
    ArrowDown,
    Download,
    Building2,
    Clock,
    Pencil,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { PageSection } from "@/components/layout/page-section";
import { SectionHeader } from "@/components/ui/section-header";
import { supabase } from "@/lib/supabase";
import imageCompression from "browser-image-compression";
import { UploadCloud, Loader2 } from "lucide-react";
import { logActivity } from "@/lib/activity";
import { useSearchParams, useRouter } from "next/navigation";
import Papa from "papaparse";

const getCurrentSeasonStr = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = d.getMonth(); // 0 = Jan, 5 = Jun
    return month >= 5 
        ? `${year.toString().slice(2)}/${(year + 1).toString().slice(2)}`
        : `${(year - 1).toString().slice(2)}/${year.toString().slice(2)}`;
};

type TableSortField = "position" | "squadNumber" | "name" | "age" | "status" | "apps" | "starts" | "subApps" | "goals" | "assists" | "minutes" | "cards";

const getPlayerAge = (player: Player): number | null => {
    if (player.dateOfBirth) {
        const birthDate = new Date(player.dateOfBirth);
        if (!isNaN(birthDate.getTime())) {
            const today = new Date();
            let age = today.getFullYear() - birthDate.getFullYear();
            const m = today.getMonth() - birthDate.getMonth();
            if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
                age--;
            }
            return age;
        }
    }
    if (typeof player.age === "number" && player.age > 0) {
        return player.age;
    }
    return null;
};

export default function SquadPage() {
    const [searchTerm, setSearchTerm] = useState("");
    const [positionFilter, setPositionFilter] = useState<"All" | "GK" | "DEF" | "MID" | "FWD">("All");
    const [showAvailableOnly, setShowAvailableOnly] = useState(false);
    const [showLoanOnly, setShowLoanOnly] = useState(false);
    const [squadViewMode, setSquadViewMode] = useState<"active" | "former">("active");
    const [displayLayout, setDisplayLayout] = useState<"grid" | "table">("table");
    const [tableSortField, setTableSortField] = useState<TableSortField>("position");
    const [tableSortAsc, setTableSortAsc] = useState<boolean>(true);

    useEffect(() => {
        if (typeof window !== "undefined") {
            const savedLayout = localStorage.getItem("clubflow_squad_display_layout");
            if (savedLayout === "grid" || savedLayout === "table") {
                setDisplayLayout(savedLayout);
            } else {
                setDisplayLayout(window.innerWidth >= 768 ? "table" : "grid");
            }
        }
    }, []);

    const handleLayoutChange = (layout: "grid" | "table") => {
        setDisplayLayout(layout);
        if (typeof window !== "undefined") {
            localStorage.setItem("clubflow_squad_display_layout", layout);
        }
    };

    // Bulk Selection States
    const [isBulkMode, setIsBulkMode] = useState<boolean>(false);
    const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
    const [isBulkUpdating, setIsBulkUpdating] = useState<boolean>(false);
    const [isBulkDepartOpen, setIsBulkDepartOpen] = useState<boolean>(false);

    const [players, setPlayers] = useState<Player[]>([]);
    const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
    const [departingPlayer, setDepartingPlayer] = useState<Player | null>(null);
    const [departureReason, setDepartureReason] = useState<string>("Left club");
    const [departureDate, setDepartureDate] = useState<string>(() => new Date().toISOString().split("T")[0]);
    const [departureNotes, setDepartureNotes] = useState<string>("");
    const [isSavingDeparture, setIsSavingDeparture] = useState(false);
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
    const router = useRouter();

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
        if (isClubLoaded && settings.squads && settings.squads.length > 0) {
            const tabExists = activeTab === "All" || settings.squads.includes(activeTab);
            if (!hasInitializedTab.current || !tabExists) {
                const hasFirstTeam = settings.squads.some(s => s.toLowerCase().replace(/[\s-_]+/g, '') === 'firstteam');
                if (hasFirstTeam) {
                    const ft = settings.squads.find(s => s.toLowerCase().replace(/[\s-_]+/g, '') === 'firstteam') || "First Team";
                    setActiveTab(ft);
                } else {
                    setActiveTab(settings.squads[0]);
                }
                if (settings.name !== "My Club") {
                    hasInitializedTab.current = true;
                }
            }
        }
    }, [isClubLoaded, settings.squads, settings.name, activeTab]);

    // Ensure initial tab doesn't hide all players if they belong to another squad or have no squad tag
    const hasCheckedInitialPlayerMatch = useRef(false);
    useEffect(() => {
        if (!hasCheckedInitialPlayerMatch.current && players.length > 0 && activeTab !== "All") {
            hasCheckedInitialPlayerMatch.current = true;
            const tabClean = activeTab.toLowerCase().replace(/[\s-_]+/g, '');
            const anyMatchesTab = players.some((p) => {
                const pSquads = p.squad ? p.squad.split(',').map((s: string) => s.trim()) : [];
                return pSquads.some((s: string) => {
                    const sClean = s.toLowerCase().replace(/[\s-_]+/g, '');
                    if ((sClean === 'firstteam' || sClean === 'first team') && (tabClean === 'firstteam' || tabClean === 'first team')) return true;
                    if ((sClean === 'midweek' || sClean === 'midweek team') && (tabClean === 'midweek' || tabClean === 'midweek team')) return true;
                    return sClean === tabClean;
                });
            });
            if (!anyMatchesTab) {
                setActiveTab("All");
            }
        }
    }, [players, activeTab]);

    // 1. Initial load: Supabase
    useEffect(() => {
        fetchData();
        const channel = supabase
            .channel("public:players")
            .on("postgres_changes", { event: "*", schema: "public", table: "players" }, () => fetchData())
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [seasonFilter, includeFriendlies, clubId, isAuthLoading]);

    async function fetchData(retryCount = 0) {
        try {
            const [playersRes, matchesRes, statsRes] = await Promise.all([
                supabase.from("players").select("*"),
                supabase.from("matches").select("id, date, competition, result"),
                supabase.from("match_player_stats").select("*")
            ]);

            if (playersRes.error) {
                if (retryCount < 2) {
                    setTimeout(() => fetchData(retryCount + 1), 400);
                    return;
                }
                throw playersRes.error;
            }
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
            const playerStats = new Map<string, { apps: number, starts: number, subApps: number, goals: number, assists: number, yellow: number, red: number, minutes: number, wins: number, draws: number, losses: number }>();
            stats.forEach((s: any) => {
                const season = matchSeasons.get(s.match_id);
                if (seasonFilter !== "All" && season !== seasonFilter) return;

                const comp = matchCompetitions.get(s.match_id) || "";
                const isFriendly = comp.toLowerCase().includes("friendly") || comp.toLowerCase().includes("trial");
                if (!includeFriendlies && isFriendly) return;

                const p = playerStats.get(s.player_id) || { apps: 0, starts: 0, subApps: 0, goals: 0, assists: 0, yellow: 0, red: 0, minutes: 0, wins: 0, draws: 0, losses: 0 };
                
                // Sprint 13 implementation: accurate participation counting
                if (s.participation_type === 'STARTER') {
                    p.apps += 1;
                    p.starts += 1;
                    p.minutes += (s.minutes_played !== undefined && s.minutes_played !== null ? s.minutes_played : 90);
                } else if (s.participation_type === 'SUB') {
                    p.apps += 1;
                    p.subApps += 1;
                    p.minutes += (s.minutes_played || 0);
                } else if (s.participation_type === 'UNUSED_SUB') {
                    // Do not increment apps, starts, or minutes
                } else {
                    // Legacy fallback
                    p.apps += 1;
                    p.starts += 1; // legacy default to start
                    p.minutes += (s.minutes_played !== undefined && s.minutes_played !== null ? s.minutes_played : 90);
                }
                
                p.goals += (s.goals || 0);
                p.assists += (s.assists || 0);
                p.yellow += (s.yellow_cards || 0);
                p.red += (s.red_cards || 0);

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
                            const pStat = playerStats.get(matchedPlayer.id) || { apps: 0, starts: 0, subApps: 0, goals: 0, assists: 0, yellow: 0, red: 0, minutes: 0, wins: 0, draws: 0, losses: 0 };
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
                const s = playerStats.get(p.id) || { apps: 0, starts: 0, subApps: 0, goals: 0, assists: 0, yellow: 0, red: 0, minutes: 0, wins: 0, draws: 0, losses: 0 };
                const winRate = s.apps > 0 ? Math.round((s.wins / s.apps) * 100) : 0;
                const dep = parsePlayerDeparture(p);

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
                    starts: s.starts,
                    subApps: s.subApps,
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
                    loanClub: p.notes && p.notes.match(/\[LOAN_CLUB:([^\]]+)\]/) ? p.notes.match(/\[LOAN_CLUB:([^\]]+)\]/)![1] : undefined,
                    loanEndDate: p.notes && p.notes.match(/\[LOAN_END:([^\]]+)\]/) ? p.notes.match(/\[LOAN_END:([^\]]+)\]/)![1] : undefined,
                    injuryType: p.notes && p.notes.match(/\[INJURY:(.*?)\]/) ? p.notes.match(/\[INJURY:(.*?)\]/)![1] : undefined,
                    injuryDuration: p.notes && p.notes.match(/\[OUT_DURATION:(.*?)\]/) ? p.notes.match(/\[OUT_DURATION:(.*?)\]/)![1] : undefined,
                    suspensionReason: p.notes && p.notes.match(/\[SUSPENSION_REASON:(.*?)\]/) ? p.notes.match(/\[SUSPENSION_REASON:(.*?)\]/)![1] : undefined,
                    suspensionDuration: p.notes && p.notes.match(/\[SUSPENSION_DURATION:(.*?)\]/) ? p.notes.match(/\[SUSPENSION_DURATION:(.*?)\]/)![1] : undefined,
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
                    useNickname: p.use_nickname || false,
                    departureStatus: dep.departureStatus,
                    departureReason: dep.departureReason,
                    departureDate: dep.departureDate,
                    departureNotes: dep.departureNotes,
                };
            });

            setPlayers(formattedPlayers);
            hasLoaded.current = true;
        } catch (e: any) {
            console.error("Error fetching squad:", e.message || e);
        }
    }

    const openDepartureDialog = (player: Player) => {
        const isLoanOrDual = player.registrationType === "Loan" || player.registrationType === "Dual";
        setDepartingPlayer(player);
        setDepartureReason(player.departureReason || (isLoanOrDual ? "Returned to parent club" : "Left club"));
        setDepartureDate(player.departureDate || new Date().toISOString().split("T")[0]);
        setDepartureNotes(player.departureNotes || "");
    };

    const handleMarkPlayerLeft = async () => {
        if (!departingPlayer) return;
        setIsSavingDeparture(true);
        try {
            const updatedNotes = serializeDepartureToNotes(departingPlayer.notes, {
                reason: departureReason,
                date: departureDate,
                notes: departureNotes,
            });

            // Update notes & availability (preserves all match_player_stats, training attendance, and payment history)
            const { error } = await supabase
                .from("players")
                .update({
                    notes: updatedNotes,
                    availability: false,
                })
                .eq("id", departingPlayer.id);

            if (error) throw error;

            // Best-effort update of dedicated columns if sprint_14 migration has been applied
            await supabase
                .from("players")
                .update({
                    club_status: departureReason,
                    departure_reason: departureReason,
                    departure_date: departureDate || null,
                    departure_notes: departureNotes || null,
                } as any)
                .eq("id", departingPlayer.id);

            logActivity(
                "Player Left Club",
                `Marked ${departingPlayer.firstName} ${departingPlayer.lastName} as having left the club (${departureReason}${departureDate ? ` on ${departureDate}` : ""}). Historical match and training records preserved.`
            );

            setDepartingPlayer(null);
            await fetchData();
        } catch (err: any) {
            console.error("Mark player left error:", err);
            alert(`Failed to update player status: ${err.message}`);
        } finally {
            setIsSavingDeparture(false);
        }
    };

    const handleRestorePlayer = async (player: Player) => {
        const restoredNotes = stripDepartureTags(player.notes);
        try {
            const { error } = await supabase
                .from("players")
                .update({
                    notes: restoredNotes,
                    medical_status: "Available",
                    availability: true,
                })
                .eq("id", player.id);

            if (error) throw error;

            // Best-effort clear of dedicated columns if sprint_14 migration has been applied
            await supabase
                .from("players")
                .update({
                    club_status: "Active",
                    departure_reason: null,
                    departure_date: null,
                    departure_notes: null,
                } as any)
                .eq("id", player.id);

            logActivity(
                "Restored Player to Squad",
                `Restored ${player.firstName} ${player.lastName} to the active squad.`
            );

            await fetchData();
        } catch (err: any) {
            console.error("Restore player error:", err);
            alert(`Failed to restore player: ${err.message}`);
        }
    };

    const handleDeletePlayerFromDb = async (player: Player) => {
        const fullName = formatPlayerName(player);
        const confirmed = window.confirm(
            `Permanently delete ${fullName} from the database?\n\nThis will remove the player profile and cannot be undone.`
        );
        if (!confirmed) return;

        try {
            // Clean up dependent stats/records first so foreign keys never block deletion
            await supabase.from("match_player_stats").delete().eq("player_id", player.id);

            const { error } = await supabase.from("players").delete().eq("id", player.id);
            if (error) throw error;

            setPlayers((prev) => prev.filter((p) => p.id !== player.id));
            if (editingPlayer?.id === player.id) {
                setEditingPlayer(null);
            }

            logActivity(
                "Deleted Former Player",
                `Permanently removed ${player.firstName} ${player.lastName} from the database.`
            );

            await fetchData();
        } catch (err: any) {
            console.error("Delete player error:", err);
            alert(`Failed to delete player from database: ${err.message}`);
        }
    };

    const handleDeleteAllFormerPlayers = async () => {
        if (formerSquadPlayers.length === 0) return;
        const count = formerSquadPlayers.length;
        const confirmed = window.confirm(
            `Permanently delete all ${count} former player${count === 1 ? "" : "s"} currently listed from the database?\n\nThis action cannot be undone.`
        );
        if (!confirmed) return;

        try {
            const ids = formerSquadPlayers.map((p) => p.id);
            await supabase.from("match_player_stats").delete().in("player_id", ids);

            const { error } = await supabase.from("players").delete().in("id", ids);
            if (error) throw error;

            setPlayers((prev) => prev.filter((p) => !ids.includes(p.id)));
            logActivity(
                "Deleted All Former Players",
                `Permanently removed ${count} former player(s) from the database.`
            );

            await fetchData();
        } catch (err: any) {
            console.error("Delete all former players error:", err);
            alert(`Failed to delete former players: ${err.message}`);
        }
    };

    const handleStatusToggle = async (player: Player) => {
        if (isFormerPlayer(player)) return;
        const statuses: MedicalStatus[] = ["Available", "Holiday", "Injured", "Suspended", "At Parent Club"];
        let nextIndex = 0;
        const currentIndex = statuses.indexOf(player.medicalStatus);
        if (currentIndex !== -1) {
            nextIndex = (currentIndex + 1) % statuses.length;
        }
        const nextStatus = statuses[nextIndex];
        const nextAvailability = nextStatus === "Available";

        setPlayers((prev) =>
            prev.map((p) => (p.id === player.id ? { ...p, medicalStatus: nextStatus, availability: nextAvailability } : p))
        );

        const { error } = await supabase
            .from("players")
            .update({ medical_status: nextStatus, availability: nextAvailability })
            .eq("id", player.id);

        if (error) {
            console.error("Error updating player status:", error);
            await fetchData();
        }
    };

    // Bulk Selection Helpers
    const toggleSelectPlayer = (playerId: string) => {
        setSelectedPlayerIds((prev) =>
            prev.includes(playerId) ? prev.filter((id) => id !== playerId) : [...prev, playerId]
        );
    };

    const handleBulkMedicalStatus = async (newStatus: MedicalStatus) => {
        if (selectedPlayerIds.length === 0) return;
        setIsBulkUpdating(true);
        try {
            const { error } = await supabase
                .from("players")
                .update({
                    medical_status: newStatus,
                    availability: newStatus === "Available",
                })
                .in("id", selectedPlayerIds);

            if (error) throw error;
            logActivity(
                "Bulk Squad Status Update",
                `Updated medical status to ${newStatus} for ${selectedPlayerIds.length} player(s).`
            );
            await fetchData();
            setSelectedPlayerIds([]);
        } catch (err: any) {
            alert(`Bulk status update failed: ${err.message}`);
        } finally {
            setIsBulkUpdating(false);
        }
    };

    const handleBulkAssignSquad = async (targetSquad: string) => {
        if (selectedPlayerIds.length === 0 || !targetSquad) return;
        setIsBulkUpdating(true);
        try {
            const { error } = await supabase
                .from("players")
                .update({ squad: targetSquad })
                .in("id", selectedPlayerIds);

            if (error) throw error;
            logActivity(
                "Bulk Squad Assignment",
                `Assigned ${selectedPlayerIds.length} player(s) to ${targetSquad}.`
            );
            await fetchData();
            setSelectedPlayerIds([]);
        } catch (err: any) {
            alert(`Bulk squad assignment failed: ${err.message}`);
        } finally {
            setIsBulkUpdating(false);
        }
    };

    const handleBulkTrackerUpdate = async (
        field: "is_in_training_squad" | "is_in_matchday_tracker",
        value: boolean
    ) => {
        if (selectedPlayerIds.length === 0) return;
        setIsBulkUpdating(true);
        try {
            const { error } = await supabase
                .from("players")
                .update({ [field]: value })
                .in("id", selectedPlayerIds);

            if (error) throw error;
            const label = field === "is_in_training_squad" ? "Training Tracker" : "Matchday XI Tracker";
            logActivity(
                "Bulk Tracker Update",
                `${value ? "Added" : "Removed"} ${selectedPlayerIds.length} player(s) ${value ? "to" : "from"} ${label}.`
            );
            await fetchData();
            setSelectedPlayerIds([]);
        } catch (err: any) {
            alert(`Bulk tracker update failed: ${err.message}`);
        } finally {
            setIsBulkUpdating(false);
        }
    };

    const handleBulkMarkLeft = async () => {
        if (selectedPlayerIds.length === 0) return;
        setIsSavingDeparture(true);
        try {
            const targetPlayers = players.filter((p) => selectedPlayerIds.includes(p.id));
            await Promise.all(
                targetPlayers.map(async (p) => {
                    const updatedNotes = serializeDepartureToNotes(p.notes, {
                        reason: departureReason,
                        date: departureDate,
                        notes: departureNotes,
                    });
                    await supabase
                        .from("players")
                        .update({
                            notes: updatedNotes,
                            availability: false,
                        })
                        .eq("id", p.id);
                    await supabase
                        .from("players")
                        .update({
                            club_status: departureReason,
                            departure_reason: departureReason,
                            departure_date: departureDate || null,
                            departure_notes: departureNotes || null,
                        } as any)
                        .eq("id", p.id);
                })
            );

            logActivity(
                "Bulk Marked Players Left Club",
                `Marked ${targetPlayers.length} player(s) as having left the club (${departureReason}). Historical records preserved.`
            );
            setIsBulkDepartOpen(false);
            setSelectedPlayerIds([]);
            await fetchData();
        } catch (err: any) {
            alert(`Failed to mark selected players as left: ${err.message}`);
        } finally {
            setIsSavingDeparture(false);
        }
    };

    const handleBulkRestore = async () => {
        if (selectedPlayerIds.length === 0) return;
        setIsBulkUpdating(true);
        try {
            const targetPlayers = players.filter((p) => selectedPlayerIds.includes(p.id));
            await Promise.all(
                targetPlayers.map(async (p) => {
                    const restoredNotes = stripDepartureTags(p.notes);
                    await supabase
                        .from("players")
                        .update({
                            notes: restoredNotes,
                            medical_status: "Available",
                            availability: true,
                        })
                        .eq("id", p.id);
                    await supabase
                        .from("players")
                        .update({
                            club_status: "Active",
                            departure_reason: null,
                            departure_date: null,
                            departure_notes: null,
                        } as any)
                        .eq("id", p.id);
                })
            );

            logActivity(
                "Bulk Restored Players",
                `Restored ${targetPlayers.length} player(s) to the active squad.`
            );
            setSelectedPlayerIds([]);
            await fetchData();
        } catch (err: any) {
            alert(`Failed to restore selected players: ${err.message}`);
        } finally {
            setIsBulkUpdating(false);
        }
    };

    const handleExportCSV = (subset?: Player[]) => {
        const list = subset && subset.length > 0 ? subset : filteredPlayers;
        if (list.length === 0) {
            alert("No players to export.");
            return;
        }
        const headers = [
            "Squad #",
            "First Name",
            "Last Name",
            "Position",
            "Secondary Positions",
            "Squad",
            "Club Status",
            "Medical Status",
            "Registration",
            "Parent/Loan Club",
            "Loan Expiry",
            "Apps",
            "Starts",
            "Sub Apps",
            "Goals",
            "Assists",
            "Minutes",
            "Yellow Cards",
            "Red Cards",
        ];
        const rows = list.map((p) => {
            const dep = parsePlayerDeparture(p);
            return [
                p.squadNumber || "",
                p.firstName,
                p.lastName,
                p.position,
                (p.secondaryPositions || []).join("/"),
                p.squad || "",
                dep.isFormer ? dep.departureReason || dep.departureStatus : "Active",
                p.medicalStatus,
                p.registrationType || "Standard",
                p.loanClub || "",
                p.loanEndDate || "",
                p.appearances ?? 0,
                p.starts ?? 0,
                p.subApps ?? 0,
                p.goals ?? 0,
                p.assists ?? 0,
                (p as any).minutes_played ?? 0,
                p.yellow_cards ?? 0,
                p.red_cards ?? 0,
            ];
        });
        const csvContent =
            "data:text/csv;charset=utf-8," +
            [headers, ...rows]
                .map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(","))
                .join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `squad_export_${new Date().toISOString().split("T")[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const isPlayerFormerOrDeletedSquad = (p: Player) =>
        isFormerPlayer(p) || isPlayerInDeletedSquad(p.squad, currentSquads);

    const activeSquadPlayers = players.filter((p) => !isPlayerFormerOrDeletedSquad(p));
    const formerSquadPlayers = players.filter((p) => isPlayerFormerOrDeletedSquad(p));

    const filteredPlayers = players.filter((player) => {
        const playerIsFormer = isPlayerFormerOrDeletedSquad(player);
        if (squadViewMode === "active" && playerIsFormer) return false;
        if (squadViewMode === "former" && !playerIsFormer) return false;

        const playerSquads = player.squad
            ? player.squad.split(',').map((s: string) => s.trim())
            : [];
        
        const matchesSearch =
            player.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            player.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (player.departureReason || "").toLowerCase().includes(searchTerm.toLowerCase());
        const matchesSquad =
            activeTab === "All" ||
            (squadViewMode === "former" && isPlayerInDeletedSquad(player.squad, currentSquads)) ||
            playerSquads.some((s: string) => {
                const sClean = s.toLowerCase().replace(/[\s-_]+/g, '');
                const tabClean = activeTab.toLowerCase().replace(/[\s-_]+/g, '');
                // Handle common seed/db variants
                if ((sClean === 'firstteam' || sClean === 'first team') && (tabClean === 'firstteam' || tabClean === 'first team')) return true;
                if ((sClean === 'midweek' || sClean === 'midweek team') && (tabClean === 'midweek' || tabClean === 'midweek team')) return true;
                return sClean === tabClean;
            });
        const matchesSinglePos = (posRaw: string) => {
            const p = (posRaw || "").trim().toUpperCase();
            if (!p) return false;
            if (positionFilter === "GK") {
                return p === 'GK' || p.includes('GK') || p.includes('KEEPER') || p.includes('GOAL');
            }
            if (positionFilter === "DEF") {
                return ['CB', 'RB', 'LB', 'DEF', 'RWB', 'LWB'].includes(p) || p.includes('DEF') || p.includes('BACK');
            }
            if (positionFilter === "MID") {
                return ['CM', 'CDM', 'CAM', 'MID', 'RM', 'LM'].includes(p) || p.includes('MID') || p.includes('CENT') || p.includes('RM') || p.includes('LM');
            }
            if (positionFilter === "FWD") {
                return ['ST', 'CF', 'RW', 'LW', 'FWD', 'ATT'].includes(p) || p.includes('STRIKER') || p.includes('WING') || p.includes('FWD') || p.includes('FORWARD') || p.includes('ST') || p.includes('CF') || p.includes('RW') || p.includes('LW');
            }
            return false;
        };
        const matchesPosition =
            positionFilter === "All" ||
            matchesSinglePos(player.position) ||
            (player.secondaryPositions || []).some((secPos) => matchesSinglePos(secPos));
        const matchesAvailability = squadViewMode === "former" || !showAvailableOnly || player.medicalStatus === "Available";
        const matchesLoan = !showLoanOnly || (player.registrationType === "Loan" && !player.isParentClub);
        return matchesSearch && matchesSquad && matchesPosition && matchesAvailability && matchesLoan;
    });

    const positionOrder: Record<string, number> = { "GK": 1, "DEF": 2, "LB": 3, "CB": 4, "LCB": 5, "RCB": 6, "RB": 7, "LWB": 8, "RWB": 9, "CDM": 10, "MID": 11, "CM": 12, "LM": 13, "RM": 14, "CAM": 15, "LW": 16, "RW": 17, "FWD": 18, "CF": 19, "ST": 20 };
    const sortedPlayers = [...filteredPlayers].sort((a, b) => (positionOrder[a.position] || 99) - (positionOrder[b.position] || 99));

    const tableSortedPlayers = [...filteredPlayers].sort((a, b) => {
        const dir = tableSortAsc ? 1 : -1;
        switch (tableSortField) {
            case "position":
                return ((positionOrder[a.position] || 99) - (positionOrder[b.position] || 99)) * dir;
            case "squadNumber":
                return ((a.squadNumber || 999) - (b.squadNumber || 999)) * dir;
            case "name":
                return formatPlayerName(a).localeCompare(formatPlayerName(b)) * dir;
            case "age":
                return ((getPlayerAge(a) ?? 99) - (getPlayerAge(b) ?? 99)) * dir;
            case "status":
                return (a.medicalStatus || "").localeCompare(b.medicalStatus || "") * dir;
            case "apps":
                return ((a.appearances ?? 0) - (b.appearances ?? 0)) * dir;
            case "starts":
                return ((a.starts ?? 0) - (b.starts ?? 0)) * dir;
            case "subApps":
                return ((a.subApps ?? 0) - (b.subApps ?? 0)) * dir;
            case "goals":
                return ((a.goals ?? 0) - (b.goals ?? 0)) * dir;
            case "assists":
                return ((a.assists ?? 0) - (b.assists ?? 0)) * dir;
            case "minutes":
                return (((a as any).minutes_played ?? 0) - ((b as any).minutes_played ?? 0)) * dir;
            case "cards":
                return (((a.yellow_cards ?? 0) + (a.red_cards ?? 0) * 3) - ((b.yellow_cards ?? 0) + (b.red_cards ?? 0) * 3)) * dir;
            default:
                return 0;
        }
    });

    const handleTableSort = (field: TableSortField) => {
        if (tableSortField === field) {
            setTableSortAsc((prev) => !prev);
        } else {
            setTableSortField(field);
            // Default numeric stats to descending first click
            const numericFields: TableSortField[] = ["apps", "starts", "subApps", "goals", "assists", "minutes", "cards"];
            setTableSortAsc(!numericFields.includes(field));
        }
    };

    const handleEdit = (player: Player) => { 
        // Strip PIN, departure tags, loan tags, and custom V3 tags from notes before showing edit dialog
        let cleanedNotes = stripDepartureTags(player.notes ? player.notes : "");
        cleanedNotes = cleanedNotes.replace(/\[PIN:\d{4}\]/, "").trim();
        cleanedNotes = cleanedNotes.replace(/\[FOOT:(Left|Right|Both)\]/, "").trim();
        cleanedNotes = cleanedNotes.replace(/\[REG:(Standard|Dual|LoanParent|LoanSub)\]/, "").trim();
        cleanedNotes = cleanedNotes.replace(/\[LOAN_CLUB:[^\]]*\]/g, "").trim();
        cleanedNotes = cleanedNotes.replace(/\[LOAN_END:[^\]]*\]/g, "").trim();
        cleanedNotes = cleanedNotes.replace(/\[INJURY:.*?\]/, "").trim();
        cleanedNotes = cleanedNotes.replace(/\[OUT_DURATION:.*?\]/, "").trim();
        cleanedNotes = cleanedNotes.replace(/\[SUSPENSION_REASON:.*?\]/, "").trim();
        cleanedNotes = cleanedNotes.replace(/\[SUSPENSION_DURATION:.*?\]/, "").trim();

        setEditingPlayer({ ...player, notes: cleanedNotes }); 
        setPreviewImage(player.imageUrl || null); 
    };

    const [editReturnTo, setEditReturnTo] = useState<string | null>(null);

    const closeEditDrawer = () => {
        setEditingPlayer(null);
        if (editReturnTo) {
            const dest = editReturnTo;
            setEditReturnTo(null);
            router.push(dest);
        }
    };

    useEffect(() => {
        const editId = searchParams?.get("edit");
        const returnToParam = searchParams?.get("returnTo");
        if (editId && players.length > 0) {
            const target = players.find((p) => p.id === editId);
            if (target) {
                if (returnToParam) {
                    setEditReturnTo(returnToParam);
                }
                handleEdit(target);
                router.replace("/squad", { scroll: false });
            }
        }
    }, [searchParams, players]);

    const handleSavePlayer = async (updatedPlayer: Player) => {
        // Find if they had an existing PIN or departure info in local state to preserve it
        const originalPlayer = players.find(p => p.id === updatedPlayer.id);
        const matchPin = originalPlayer?.notes?.match(/\[PIN:(\d{4})\]/);
        const pinVal = matchPin ? matchPin[1] : null;
        const origDep = originalPlayer ? parsePlayerDeparture(originalPlayer) : { isFormer: false, departureStatus: "Active" as const };
        let cleanedNotes = stripDepartureTags(updatedPlayer.notes ? updatedPlayer.notes : "");
        cleanedNotes = cleanedNotes.replace(/\[PIN:\d{4}\]/, "").trim();
        cleanedNotes = cleanedNotes.replace(/\[FOOT:(Left|Right|Both)\]/, "").trim();
        cleanedNotes = cleanedNotes.replace(/\[REG:(Standard|Dual|LoanParent|LoanSub)\]/, "").trim();
        cleanedNotes = cleanedNotes.replace(/\[LOAN_CLUB:[^\]]*\]/g, "").trim();
        cleanedNotes = cleanedNotes.replace(/\[LOAN_END:[^\]]*\]/g, "").trim();
        cleanedNotes = cleanedNotes.replace(/\[INJURY:.*?\]/, "").trim();
        cleanedNotes = cleanedNotes.replace(/\[OUT_DURATION:.*?\]/, "").trim();
        cleanedNotes = cleanedNotes.replace(/\[SUSPENSION_REASON:.*?\]/, "").trim();
        cleanedNotes = cleanedNotes.replace(/\[SUSPENSION_DURATION:.*?\]/, "").trim();
        
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

        if (updatedPlayer.registrationType === "Loan" || updatedPlayer.registrationType === "Dual") {
            const cleanClub = (updatedPlayer.loanClub || "").trim().replace(/[\[\]]/g, "");
            if (cleanClub) {
                finalNotes = `${finalNotes} [LOAN_CLUB:${cleanClub}]`.trim();
            }
            if (updatedPlayer.registrationType === "Loan" && updatedPlayer.loanEndDate) {
                finalNotes = `${finalNotes} [LOAN_END:${updatedPlayer.loanEndDate.trim()}]`.trim();
            }
        }

        if (updatedPlayer.medicalStatus === "Injured" || updatedPlayer.medicalStatus === "Doubtful") {
            if (updatedPlayer.injuryType) finalNotes = `${finalNotes} [INJURY:${updatedPlayer.injuryType}]`.trim();
            if (updatedPlayer.injuryDuration) finalNotes = `${finalNotes} [OUT_DURATION:${updatedPlayer.injuryDuration}]`.trim();
        }
        if (updatedPlayer.medicalStatus === "Suspended") {
            if (updatedPlayer.suspensionReason) finalNotes = `${finalNotes} [SUSPENSION_REASON:${updatedPlayer.suspensionReason}]`.trim();
            if (updatedPlayer.suspensionDuration) finalNotes = `${finalNotes} [SUSPENSION_DURATION:${updatedPlayer.suspensionDuration}]`.trim();
        }

        if (origDep.isFormer) {
            finalNotes = serializeDepartureToNotes(finalNotes, {
                reason: origDep.departureReason || origDep.departureStatus,
                date: origDep.departureDate,
                notes: origDep.departureNotes,
            });
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
            closeEditDrawer();
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

    const expiringLoans = activeSquadPlayers.filter((p) => {
        if (p.registrationType !== "Loan" || !p.loanEndDate) return false;
        const exp = getLoanExpiryStatus(p.loanEndDate);
        return exp.status === "expired" || exp.status === "expiring_soon";
    });

    const getStatusBadgeStyle = (status: string) => {
        switch (status) {
            case "Available": return "bg-status-success/10 text-status-success border-status-success/20 hover:bg-status-success/20";
            case "Unavailable": return "bg-muted text-muted-foreground border-border hover:bg-muted/80";
            case "Holiday": return "bg-status-info/10 text-status-info border-status-info/20 hover:bg-status-info/20";
            case "Injured": return "bg-status-error/10 text-status-error border-status-error/20 hover:bg-status-error/20";
            case "Suspended": return "bg-status-error/10 text-status-error border-status-error/20 hover:bg-status-error/20";
            case "Doubtful": return "bg-status-warning/10 text-status-warning border-status-warning/20 hover:bg-status-warning/20";
            case "At Parent Club": return "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20 hover:bg-purple-500/20";
            default: return "bg-muted text-muted-foreground border-border hover:bg-muted/80";
        }
    };

    const renderSortIcon = (field: TableSortField) => {
        if (tableSortField !== field) return <ArrowUpDown className="w-3 h-3 opacity-40" />;
        return tableSortAsc ? <ArrowUp className="w-3 h-3 text-primary" /> : <ArrowDown className="w-3 h-3 text-primary" />;
    };

    const allFilteredSelected =
        filteredPlayers.length > 0 && filteredPlayers.every((p) => selectedPlayerIds.includes(p.id));

    const toggleSelectAllFiltered = () => {
        if (allFilteredSelected) {
            const filteredSet = new Set(filteredPlayers.map((p) => p.id));
            setSelectedPlayerIds((prev) => prev.filter((id) => !filteredSet.has(id)));
        } else {
            const merged = new Set([...selectedPlayerIds, ...filteredPlayers.map((p) => p.id)]);
            setSelectedPlayerIds(Array.from(merged));
        }
    };

    const hasAnySquadNumbers = filteredPlayers.some((p) => (p.squadNumber ?? 0) > 0);
    const activeInjuredCount = activeSquadPlayers.filter((p) => p.medicalStatus === "Injured").length;
    const activeSuspendedCount = activeSquadPlayers.filter((p) => p.medicalStatus === "Suspended").length;
    const activeHolidayCount = activeSquadPlayers.filter((p) => p.medicalStatus === "Holiday").length;
    const activeParentClubCount = activeSquadPlayers.filter((p) => p.medicalStatus === "At Parent Club").length;
    const activeOnLoanCount = activeSquadPlayers.filter((p) => p.registrationType === "Loan" && !p.isParentClub).length;

    const renderMobilePosBadge = (posRaw: string) => {
        const p = (posRaw || "").trim().toUpperCase();
        let cls = "bg-surface-2 text-foreground border-border";
        if (p === "GK" || p.includes("GK")) {
            cls = "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30";
        } else if (["CB", "RB", "LB", "DEF", "RWB", "LWB", "LCB", "RCB"].includes(p) || p.includes("DEF")) {
            cls = "bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30";
        } else if (["CM", "CDM", "CAM", "MID", "RM", "LM"].includes(p) || p.includes("MID")) {
            cls = "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30";
        } else if (["ST", "CF", "RW", "LW", "FWD", "ATT"].includes(p) || p.includes("FWD")) {
            cls = "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30";
        }
        return (
            <span className={`font-bold px-1.5 py-0.2 border rounded text-[9px] uppercase tracking-tight shrink-0 ${cls}`}>
                {posRaw}
            </span>
        );
    };

    const renderMobilePlayerRow = (player: Player) => {
        const dep = parsePlayerDeparture(player);
        const isFormer = isFormerPlayer(player);
        const loanExpiry = getLoanExpiryStatus(player.loanEndDate);

        let statusSubLabel = "";
        if (!isFormer) {
            if (player.medicalStatus === "Injured" || player.medicalStatus === "Doubtful") {
                statusSubLabel = [player.injuryType, player.injuryDuration].filter(Boolean).join(" • ");
            } else if (player.medicalStatus === "Holiday" && player.holidayEnd) {
                const parsedEnd = new Date(player.holidayEnd + "T00:00:00");
                statusSubLabel = !isNaN(parsedEnd.getTime())
                    ? `Back ${parsedEnd.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`
                    : `Back ${player.holidayEnd}`;
            } else if (player.medicalStatus === "Suspended") {
                statusSubLabel = [player.suspensionReason, player.suspensionDuration].filter(Boolean).join(" • ");
            }
        }

        return (
            <div
                key={player.id}
                onClick={() => router.push(`/squad/${player.id}`)}
                className="flex items-center justify-between gap-2 px-3 py-2.5 bg-card active:bg-surface-2/80 transition-colors cursor-pointer"
            >
                {/* Left: Avatar + Name + Position/Status subline */}
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div className="relative shrink-0">
                        <div className="w-10 h-10 rounded-full bg-surface-2 border border-border flex items-center justify-center text-xs font-bold text-muted-foreground overflow-hidden">
                            {player.imageUrl &&
                            player.imageUrl !== "/placeholder-player.png" &&
                            !player.imageUrl.startsWith("idb:") ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                    src={player.imageUrl}
                                    alt={formatPlayerName(player)}
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <>
                                    {player.firstName?.charAt(0)}
                                    {player.lastName?.charAt(0)}
                                </>
                            )}
                        </div>
                        {player.squadNumber > 0 && (
                            <span className="absolute -bottom-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-foreground text-background text-[9px] font-black flex items-center justify-center leading-none border border-background">
                                {player.squadNumber}
                            </span>
                        )}
                    </div>

                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                            <span className="font-bold text-sm text-foreground truncate">
                                {formatPlayerName(player)}
                            </span>
                            {(player.registrationType === "Loan" || player.registrationType === "Dual") && (
                                <span className="text-[9px] font-bold px-1 py-0.2 bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 rounded uppercase shrink-0">
                                    {player.registrationType === "Loan"
                                        ? player.isParentClub
                                            ? "Loan Out"
                                            : "Loan In"
                                        : "Dual"}
                                </span>
                            )}
                            {(player.yellow_cards ?? 0) > 0 && (
                                <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-muted-foreground shrink-0">
                                    <span className="w-1.5 h-2.5 bg-yellow-400 rounded-[1px] inline-block" />
                                    {player.yellow_cards}
                                </span>
                            )}
                            {(player.red_cards ?? 0) > 0 && (
                                <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-muted-foreground shrink-0">
                                    <span className="w-1.5 h-2.5 bg-red-500 rounded-[1px] inline-block" />
                                    {player.red_cards}
                                </span>
                            )}
                        </div>

                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                            {renderMobilePosBadge(player.position)}

                            {isFormer ? (
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 font-semibold">
                                    {dep.departureReason || dep.departureStatus}
                                </span>
                            ) : (
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleStatusToggle(player);
                                    }}
                                    className={`text-[10px] font-semibold px-1.5 py-0.2 rounded border transition-colors ${getStatusBadgeStyle(
                                        player.medicalStatus
                                    )}`}
                                >
                                    {player.medicalStatus}
                                </button>
                            )}

                            {statusSubLabel && (
                                <span className="text-[10px] text-muted-foreground truncate max-w-[120px]">
                                    {statusSubLabel}
                                </span>
                            )}

                            {player.registrationType === "Loan" && loanExpiry.status !== "none" && (
                                <span
                                    className={`text-[10px] font-semibold ${
                                        loanExpiry.status === "expired"
                                            ? "text-red-500"
                                            : loanExpiry.status === "expiring_soon"
                                            ? "text-amber-500"
                                            : "text-muted-foreground"
                                    }`}
                                >
                                    • {loanExpiry.label}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right: Compact Stat Columns (APP / G / A) + Quick Action */}
                <div className="flex items-center gap-1 shrink-0">
                    <div className="w-7 text-center">
                        <span className="text-xs font-bold text-foreground">{player.appearances ?? 0}</span>
                    </div>
                    <div className="w-7 text-center">
                        <span
                            className={`text-xs font-bold ${
                                (player.goals ?? 0) > 0
                                    ? "text-emerald-600 dark:text-emerald-400"
                                    : "text-muted-foreground/50"
                            }`}
                        >
                            {player.goals ?? 0}
                        </span>
                    </div>
                    <div className="w-7 text-center">
                        <span
                            className={`text-xs font-bold ${
                                (player.assists ?? 0) > 0
                                    ? "text-sky-600 dark:text-sky-400"
                                    : "text-muted-foreground/50"
                            }`}
                        >
                            {player.assists ?? 0}
                        </span>
                    </div>

                    <div
                        className="pl-1 flex items-center gap-1"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {isFormer ? (
                            <>
                                <button
                                    type="button"
                                    onClick={() => handleRestorePlayer(player)}
                                    className="h-7 w-7 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 flex items-center justify-center"
                                    title="Restore Player to Active Squad"
                                >
                                    <RotateCcw className="w-3.5 h-3.5" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleDeletePlayerFromDb(player)}
                                    className="h-7 w-7 rounded-lg border border-red-500/30 bg-red-500/10 text-red-600 flex items-center justify-center"
                                    title="Permanently Remove from Database"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            </>
                        ) : (
                            <button
                                type="button"
                                onClick={() => handleEdit(player)}
                                className="h-7 w-7 rounded-lg border border-border bg-surface-1 text-muted-foreground active:text-foreground flex items-center justify-center"
                                title="Edit Player"
                            >
                                <Pencil className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    const mobilePositionGroups = [
        {
            label: "Goalkeepers",
            players: tableSortedPlayers.filter((p) => ["GK"].includes(p.position)),
        },
        {
            label: "Defenders",
            players: tableSortedPlayers.filter((p) =>
                ["DEF", "CB", "LCB", "RCB", "RB", "LB", "RWB", "LWB"].includes(p.position)
            ),
        },
        {
            label: "Midfielders",
            players: tableSortedPlayers.filter((p) =>
                ["MID", "CDM", "CM", "CAM", "RM", "LM"].includes(p.position)
            ),
        },
        {
            label: "Forwards",
            players: tableSortedPlayers.filter((p) =>
                ["FWD", "ST", "CF", "RW", "LW"].includes(p.position)
            ),
        },
    ].filter((g) => g.players.length > 0);

    return (
        <div className="pb-16 bg-background min-h-screen">
            {/* =====================================================================
                MOBILE SQUAD VIEW (< 768px) — Fantasy Football Hub / FotMob Style
               ===================================================================== */}
            <div className="md:hidden flex flex-col">
                {/* 1. Compact Mobile Top Header */}
                <div className="px-4 pt-4 pb-3 bg-surface-1 border-b border-border space-y-3">
                    <div className="flex items-center justify-between gap-2">
                        <h1 className="text-xl font-black text-foreground tracking-tight leading-none">
                            Squad
                        </h1>

                        <div className="flex items-center gap-1.5">
                            <Button
                                variant={includeFriendlies ? "secondary" : "outline"}
                                size="sm"
                                onClick={toggleIncludeFriendlies}
                                className="h-8 px-2.5 text-[11px] font-semibold"
                                title={includeFriendlies ? "Including Friendlies" : "Competitive Only"}
                            >
                                {includeFriendlies ? "⚽ All" : "🏆 Comp"}
                            </Button>
                            <Button
                                onClick={() => setIsManageSquadsOpen(true)}
                                variant="outline"
                                size="icon"
                                className="h-8 w-8"
                                title="Manage Squads"
                            >
                                <Settings className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                                size="sm"
                                className="bg-brand text-brand-foreground hover:bg-brand/90 h-8 px-3 text-xs font-bold shadow-xs"
                                onClick={() =>
                                    setEditingPlayer({
                                        id: "new",
                                        firstName: "",
                                        lastName: "",
                                        position: "GK",
                                        squadNumber: 0,
                                        age: 0,
                                        nationality: "English",
                                        squad: currentSquads[0],
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
                                        holidayEnd: "",
                                    })
                                }
                            >
                                <Plus className="h-3.5 w-3.5 mr-1" /> Add
                            </Button>
                        </div>
                    </div>

                    {/* Structured 4-Column Squad Status Strip */}
                    <div className="grid grid-cols-4 divide-x divide-border rounded-xl border border-border bg-background shadow-2xs overflow-hidden text-center">
                        <div className="py-2 px-1">
                            <p className="text-sm font-black text-foreground leading-none">
                                {activeSquadPlayers.length}
                            </p>
                            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mt-1">
                                Active
                            </p>
                        </div>
                        <div className="py-2 px-1">
                            <p className="text-sm font-black text-status-success leading-none">
                                {activeSquadPlayers.filter((p) => p.medicalStatus === "Available").length}
                            </p>
                            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mt-1">
                                Fit
                            </p>
                        </div>
                        <div className="py-2 px-1">
                            <p className="text-sm font-black text-status-error leading-none">
                                {activeInjuredCount + activeSuspendedCount}
                            </p>
                            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mt-1">
                                {activeSuspendedCount > 0 ? "Inj / Susp" : "Injured"}
                            </p>
                        </div>
                        <div className="py-2 px-1">
                            <p className="text-sm font-black text-blue-500 leading-none">
                                {activeHolidayCount + activeParentClubCount}
                            </p>
                            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mt-1">
                                Away
                            </p>
                        </div>
                    </div>

                    {/* 2. Squad Tabs Strip */}
                    <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar -mx-4 px-4 pt-0.5">
                        <button
                            type="button"
                            onClick={() => setActiveTab("All")}
                            className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${
                                activeTab === "All"
                                    ? "bg-foreground text-background shadow-xs"
                                    : "bg-surface-2 text-muted-foreground"
                            }`}
                        >
                            All Players
                        </button>
                        {currentSquads.map((squad) => (
                            <button
                                key={squad}
                                type="button"
                                onClick={() => setActiveTab(squad)}
                                className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${
                                    activeTab === squad
                                        ? "bg-foreground text-background shadow-xs"
                                        : "bg-surface-2 text-muted-foreground"
                                }`}
                            >
                                {squad}
                            </button>
                        ))}
                    </div>

                    {/* 3. Full-Width Active vs Former Players Toggle (Never Cut Off on Mobile) */}
                    <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-background border border-border">
                        <button
                            type="button"
                            onClick={() => {
                                setSquadViewMode("active");
                                setSelectedPlayerIds([]);
                            }}
                            className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-bold transition-all ${
                                squadViewMode === "active"
                                    ? "bg-foreground text-background shadow-xs"
                                    : "text-muted-foreground hover:text-foreground"
                            }`}
                        >
                            <Users className="w-3.5 h-3.5 shrink-0" />
                            <span>Active Squad</span>
                            <span
                                className={`text-[10px] px-1.5 py-0.5 rounded-full leading-none ${
                                    squadViewMode === "active"
                                        ? "bg-background/20 text-background"
                                        : "bg-surface-2 text-muted-foreground"
                                }`}
                            >
                                {activeSquadPlayers.length}
                            </span>
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setSquadViewMode("former");
                                setSelectedPlayerIds([]);
                            }}
                            className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-bold transition-all ${
                                squadViewMode === "former"
                                    ? "bg-amber-500 text-white shadow-xs"
                                    : "text-muted-foreground hover:text-foreground"
                            }`}
                        >
                            <Archive className="w-3.5 h-3.5 shrink-0" />
                            <span>Former Players</span>
                            <span
                                className={`text-[10px] px-1.5 py-0.5 rounded-full leading-none ${
                                    squadViewMode === "former"
                                        ? "bg-white/25 text-white"
                                        : "bg-surface-2 text-muted-foreground"
                                }`}
                            >
                                {formerSquadPlayers.length}
                            </span>
                        </button>
                    </div>

                    {/* 4. Search + Position & Sort Pills */}
                    <div className="space-y-2">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                            <Input
                                placeholder="Search player name or #..."
                                className="pl-8 pr-8 h-9 text-xs bg-background border-border rounded-lg"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                            {searchTerm && (
                                <button
                                    type="button"
                                    onClick={() => setSearchTerm("")}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>

                        <div className="flex items-center justify-between gap-1.5">
                            {/* Position Filter Pills */}
                            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
                                {(["All", "GK", "DEF", "MID", "FWD"] as const).map((pos) => (
                                    <button
                                        key={pos}
                                        type="button"
                                        onClick={() => setPositionFilter(pos)}
                                        className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors shrink-0 ${
                                            positionFilter === pos
                                                ? "bg-brand text-brand-foreground shadow-xs"
                                                : "bg-background border border-border text-muted-foreground"
                                        }`}
                                    >
                                        {pos}
                                    </button>
                                ))}
                            </div>

                            {/* Sort Pill */}
                            <button
                                type="button"
                                onClick={() => {
                                    const order: TableSortField[] = ["position", "apps", "goals", "assists", "name"];
                                    const nextIdx = (order.indexOf(tableSortField) + 1) % order.length;
                                    const nextField = order[nextIdx];
                                    setTableSortField(nextField);
                                    setTableSortAsc(nextField === "position" || nextField === "name");
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-background border border-border text-foreground whitespace-nowrap shrink-0"
                            >
                                <ArrowUpDown className="w-3 h-3 text-muted-foreground" />
                                {tableSortField === "position"
                                    ? "By Pos"
                                    : tableSortField === "apps"
                                    ? "Top Apps"
                                    : tableSortField === "goals"
                                    ? "Top Goals"
                                    : tableSortField === "assists"
                                    ? "Top Asts"
                                    : "A–Z"}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Former Players Mobile Banner & Database Cleanup */}
                {squadViewMode === "former" && (
                    <div className="mx-3 mt-3 p-3 rounded-xl border border-amber-500/30 bg-amber-500/5 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                                <Archive className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                Former Players ({formerSquadPlayers.length})
                            </span>
                            {formerSquadPlayers.length > 0 && (
                                <button
                                    type="button"
                                    onClick={handleDeleteAllFormerPlayers}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400 text-[11px] font-bold active:scale-95 transition-all"
                                >
                                    <Trash2 className="w-3 h-3" />
                                    Remove All from DB
                                </button>
                            )}
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-snug">
                            Tap the green arrow (<RotateCcw className="w-2.5 h-2.5 inline text-emerald-600" />) to restore a player to the active squad, or the red trash icon (<Trash2 className="w-2.5 h-2.5 inline text-red-600" />) to permanently delete them from the database.
                        </p>
                    </div>
                )}

                {/* Loan Expiry Warning on Mobile */}
                {squadViewMode === "active" && expiringLoans.length > 0 && (
                    <div className="mx-3 mt-3 p-2.5 rounded-lg border border-purple-500/30 bg-purple-500/5 text-[11px] flex items-center gap-2 overflow-x-auto no-scrollbar">
                        <span className="font-bold text-purple-600 dark:text-purple-400 shrink-0 inline-flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" /> Loans:
                        </span>
                        {expiringLoans.map((lp) => {
                            const exp = getLoanExpiryStatus(lp.loanEndDate);
                            return (
                                <button
                                    key={lp.id}
                                    type="button"
                                    onClick={() => handleEdit(lp)}
                                    className="px-2 py-0.5 rounded border border-purple-500/30 bg-background font-semibold whitespace-nowrap shrink-0"
                                >
                                    {formatPlayerName(lp)} • {exp.label}
                                </button>
                            );
                        })}
                    </div>
                )}

                {/* 5. Mobile Player List (Grouped by Position or Ranked by Stat) */}
                <div className="px-3 pt-3 space-y-3">
                    {tableSortedPlayers.length === 0 ? (
                        <div className="text-center py-12 text-xs text-muted-foreground bg-card rounded-xl border border-border">
                            {squadViewMode === "former"
                                ? "No former players recorded yet."
                                : "No players found matching your filters."}
                        </div>
                    ) : tableSortField === "position" && positionFilter === "All" ? (
                        mobilePositionGroups.map((group) => (
                            <div
                                key={group.label}
                                className="rounded-xl border border-border bg-card overflow-hidden shadow-xs"
                            >
                                <div className="flex items-center justify-between px-3 py-2 bg-surface-1 border-b border-border text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
                                    <span>
                                        {group.label} ({group.players.length})
                                    </span>
                                    <div className={`flex items-center gap-1 ${squadViewMode === "former" ? "pr-16" : "pr-8"}`}>
                                        <span className="w-7 text-center">APP</span>
                                        <span className="w-7 text-center">G</span>
                                        <span className="w-7 text-center">A</span>
                                    </div>
                                </div>
                                <div className="divide-y divide-border/60">
                                    {group.players.map((player) => renderMobilePlayerRow(player))}
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="rounded-xl border border-border bg-card overflow-hidden shadow-xs">
                            <div className="flex items-center justify-between px-3 py-2 bg-surface-1 border-b border-border text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
                                <span>Players ({tableSortedPlayers.length})</span>
                                <div className={`flex items-center gap-1 ${squadViewMode === "former" ? "pr-16" : "pr-8"}`}>
                                    <span className="w-7 text-center">APP</span>
                                    <span className="w-7 text-center">G</span>
                                    <span className="w-7 text-center">A</span>
                                </div>
                            </div>
                            <div className="divide-y divide-border/60">
                                {tableSortedPlayers.map((player) => renderMobilePlayerRow(player))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* =====================================================================
                DESKTOP SQUAD VIEW (>= 768px) — Untouched
               ===================================================================== */}
            <div className="hidden md:block">
            <PageHeader 
                title="Squad" 
                description="Manage player profiles, availability, and stats."
            >
                <Button 
                    variant={includeFriendlies ? "secondary" : "outline"} 
                    onClick={toggleIncludeFriendlies}
                    className="text-xs h-9 shadow-sm"
                >
                    {includeFriendlies ? "⚽ Including Friendlies" : "🏆 Competitive Only"}
                </Button>
                <Button 
                    variant="outline" 
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs h-9 shadow-sm"
                >
                    Import CSV
                </Button>
                <input type="file" ref={fileInputRef} onChange={handleCSVImport} accept=".csv" className="hidden" />
                <Button onClick={() => setIsManageSquadsOpen(true)} variant="outline" size="icon" className="h-9 w-9 shadow-sm">
                    <Settings className="w-4 h-4" />
                </Button>
                <Button className="bg-brand text-brand-foreground hover:bg-brand/90 text-xs h-9 shadow-sm" onClick={() => setEditingPlayer({ id: "new", firstName: "", lastName: "", position: "GK", squadNumber: 0, age: 0, nationality: "English", squad: currentSquads[0], medicalStatus: "Available", availability: true, contractExpiry: "", appearances: 0, goals: 0, assists: 0, imageUrl: "", isInTrainingSquad: true, isInMatchdayTracker: false, isContracted: false, contractAmount: 0, contractFrequency: "Weekly", contractStartDate: "", contractEndDate: "", subsBillingModel: "Monthly", subsCustomAmount: 0, holidayStart: "", holidayEnd: "" })}>
                    <Plus className="h-4 w-4 mr-2" /> Add Player
                </Button>
            </PageHeader>

            <PageSection>
                {/* Squad Summary & Controls */}
                <div className="flex flex-col xl:flex-row gap-3 justify-between items-stretch xl:items-center mb-6">
                    {/* Compact Squad Summary (Active Squad Counts - Single Line) */}
                    <div className="flex items-center gap-3 text-xs sm:text-sm bg-surface-1 border border-border px-3.5 py-2 rounded-lg shadow-sm overflow-x-auto no-scrollbar whitespace-nowrap shrink-0">
                        <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-foreground">{activeSquadPlayers.length}</span>
                            <span className="text-muted-foreground">Active</span>
                        </div>
                        <div className="w-px h-3.5 bg-border shrink-0" />
                        <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-status-success">{activeSquadPlayers.filter(p => p.medicalStatus === "Available").length}</span>
                            <span className="text-muted-foreground">Available</span>
                        </div>
                        {activeInjuredCount > 0 && (
                            <>
                                <div className="w-px h-3.5 bg-border shrink-0" />
                                <div className="flex items-center gap-1.5">
                                    <span className="font-semibold text-status-error">{activeInjuredCount}</span>
                                    <span className="text-muted-foreground">Injured</span>
                                </div>
                            </>
                        )}
                        {activeSuspendedCount > 0 && (
                            <>
                                <div className="w-px h-3.5 bg-border shrink-0" />
                                <div className="flex items-center gap-1.5">
                                    <span className="font-semibold text-status-warning">{activeSuspendedCount}</span>
                                    <span className="text-muted-foreground">Suspended</span>
                                </div>
                            </>
                        )}
                        {activeHolidayCount > 0 && (
                            <>
                                <div className="w-px h-3.5 bg-border shrink-0" />
                                <div className="flex items-center gap-1.5">
                                    <span className="font-semibold text-blue-500">{activeHolidayCount}</span>
                                    <span className="text-muted-foreground">On Holiday</span>
                                </div>
                            </>
                        )}
                        {activeParentClubCount > 0 && (
                            <>
                                <div className="w-px h-3.5 bg-border shrink-0" />
                                <div className="flex items-center gap-1.5">
                                    <span className="font-semibold text-purple-600 dark:text-purple-400">{activeParentClubCount}</span>
                                    <span className="text-muted-foreground">At Parent Club</span>
                                </div>
                            </>
                        )}
                        {(activeOnLoanCount > 0 || showLoanOnly) && (
                            <>
                                <div className="w-px h-3.5 bg-border shrink-0" />
                                <button
                                    onClick={() => setShowLoanOnly(prev => !prev)}
                                    className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-semibold transition-colors ${showLoanOnly ? "bg-purple-100 text-purple-700 border border-purple-300" : "text-muted-foreground hover:text-foreground"}`}
                                >
                                    <span>{activeOnLoanCount}</span>
                                    <span>On Loan</span>
                                </button>
                            </>
                        )}
                    </div>

                    {/* Single-Row Filter Bar */}
                    <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto xl:justify-end">
                        <div className="relative w-full sm:w-40 shrink-0">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                            <Input placeholder="Search players..." className="pl-8 h-9 text-xs bg-background border-border" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                        </div>

                        <div className="flex gap-1 bg-surface-1 p-1 rounded-lg border border-border shrink-0">
                            <button
                                onClick={() => {
                                    setSquadViewMode("active");
                                    setSelectedPlayerIds([]);
                                }}
                                className={`flex items-center justify-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                                    squadViewMode === "active"
                                        ? "bg-background shadow-sm text-foreground"
                                        : "text-muted-foreground hover:text-foreground"
                                }`}
                            >
                                <Users className="w-3.5 h-3.5" />
                                Active
                                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-surface-2 text-muted-foreground">
                                    {activeSquadPlayers.length}
                                </span>
                            </button>
                            <button
                                onClick={() => {
                                    setSquadViewMode("former");
                                    setSelectedPlayerIds([]);
                                }}
                                className={`flex items-center justify-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                                    squadViewMode === "former"
                                        ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 shadow-sm"
                                        : "text-muted-foreground hover:text-foreground"
                                }`}
                            >
                                <Archive className="w-3.5 h-3.5" />
                                Former
                                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-surface-2 text-muted-foreground">
                                    {formerSquadPlayers.length}
                                </span>
                            </button>
                        </div>

                        <div className="flex gap-0.5 shrink-0 bg-surface-1 p-1 rounded-lg border border-border">
                            {(["All", "GK", "DEF", "MID", "FWD"] as const).map((pos) => (
                                <button 
                                    key={pos} 
                                    onClick={() => setPositionFilter(pos)}
                                    className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${positionFilter === pos ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                                >
                                    {pos}
                                </button>
                            ))}
                        </div>

                        {/* View Layout Toggle (Cards vs Compact) */}
                        <div className="flex gap-1 bg-surface-1 p-1 rounded-lg border border-border shrink-0">
                            <button
                                type="button"
                                onClick={() => handleLayoutChange("grid")}
                                className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                                    displayLayout === "grid"
                                        ? "bg-background shadow-sm text-foreground"
                                        : "text-muted-foreground hover:text-foreground"
                                }`}
                                title="Card Grid View"
                            >
                                <LayoutGrid className="w-3.5 h-3.5" />
                                <span className="hidden 2xl:inline">Cards</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => handleLayoutChange("table")}
                                className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                                    displayLayout === "table"
                                        ? "bg-background shadow-sm text-foreground"
                                        : "text-muted-foreground hover:text-foreground"
                                }`}
                                title="Compact View"
                            >
                                <List className="w-3.5 h-3.5" />
                                <span className="hidden 2xl:inline">Compact</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Loan Expiry Warning Banner */}
                {squadViewMode === "active" && expiringLoans.length > 0 && (
                    <div className="mb-4 p-3 rounded-xl border border-purple-500/30 bg-purple-500/5 flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="inline-flex items-center gap-1 font-bold text-purple-700 dark:text-purple-300">
                                <Clock className="w-4 h-4" />
                                Loan Expiry Tracker:
                            </span>
                            {expiringLoans.map((lp) => {
                                const exp = getLoanExpiryStatus(lp.loanEndDate);
                                return (
                                    <button
                                        key={lp.id}
                                        type="button"
                                        onClick={() => handleEdit(lp)}
                                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border font-semibold transition-colors ${
                                            exp.status === "expired"
                                                ? "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30 hover:bg-red-500/20"
                                                : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/20"
                                        }`}
                                    >
                                        <span>{formatPlayerName(lp)}</span>
                                        {lp.loanClub && <span className="opacity-75">({lp.loanClub})</span>}
                                        <span>• {exp.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Squad Filter Tabs */}
                <div className="flex space-x-2 border-b border-border pb-px mb-6 overflow-x-auto no-scrollbar">
                    <button onClick={() => setActiveTab("All")} className={`px-4 py-2.5 text-sm font-semibold whitespace-nowrap transition-colors border-b-2 ${activeTab === "All" ? "border-brand text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>All Players</button>
                    {currentSquads.map(squad => (
                        <button key={squad} onClick={() => setActiveTab(squad)} className={`px-4 py-2.5 text-sm font-semibold whitespace-nowrap transition-colors border-b-2 ${activeTab === squad ? "border-brand text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>{squad}</button>
                    ))}
                </div>

                {squadViewMode === "former" && (
                    <div className="mb-6 p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="space-y-0.5">
                            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                                <Archive className="w-4 h-4 text-amber-500" />
                                Former &amp; Archived Players
                            </h3>
                            <p className="text-xs text-muted-foreground">
                                These players have left the club or returned to their parent club. Click the green restore button to return a player to the active squad, or the red trash button to permanently remove them from the database.
                            </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            {formerSquadPlayers.length > 0 && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleDeleteAllFormerPlayers}
                                    className="text-xs border-red-500/30 text-red-600 hover:bg-red-500/10 hover:text-red-700"
                                >
                                    <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                                    Remove All from DB ({formerSquadPlayers.length})
                                </Button>
                            )}
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setSquadViewMode("active")}
                                className="text-xs"
                            >
                                Back to Active Squad
                            </Button>
                        </div>
                    </div>
                )}

                {/* Main Squad Content: Grid View vs Compact Table View */}
                {filteredPlayers.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                        {squadViewMode === "former" ? (
                            <p>No former players recorded yet.</p>
                        ) : (
                            <p>No players found matching your criteria.</p>
                        )}
                    </div>
                ) : displayLayout === "table" ? (
                    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-border bg-surface-1/80 text-muted-foreground uppercase tracking-wider text-[10px] font-bold select-none">
                                        {hasAnySquadNumbers && (
                                            <th
                                                onClick={() => handleTableSort("squadNumber")}
                                                className="py-3 pl-4 pr-2 cursor-pointer hover:text-foreground transition-colors w-12"
                                            >
                                                <div className="flex items-center gap-1"># {renderSortIcon("squadNumber")}</div>
                                            </th>
                                        )}
                                        <th
                                            onClick={() => handleTableSort("name")}
                                            className={`py-3 ${hasAnySquadNumbers ? "px-3" : "pl-4 pr-3"} cursor-pointer hover:text-foreground transition-colors min-w-[200px]`}
                                        >
                                            <div className="flex items-center gap-1">Player {renderSortIcon("name")}</div>
                                        </th>
                                        <th
                                            onClick={() => handleTableSort("age")}
                                            className="py-3 px-2 text-center cursor-pointer hover:text-foreground transition-colors hidden sm:table-cell"
                                        >
                                            <div className="flex items-center justify-center gap-1">Age {renderSortIcon("age")}</div>
                                        </th>
                                        <th
                                            onClick={() => handleTableSort("position")}
                                            className="py-3 px-2.5 cursor-pointer hover:text-foreground transition-colors"
                                        >
                                            <div className="flex items-center gap-1">Pos {renderSortIcon("position")}</div>
                                        </th>
                                        {activeTab === "All" && (
                                            <th className="py-3 px-2.5 hidden md:table-cell">Squad</th>
                                        )}
                                        <th
                                            onClick={() => handleTableSort("status")}
                                            className="py-3 px-2.5 cursor-pointer hover:text-foreground transition-colors"
                                        >
                                            <div className="flex items-center gap-1">Status {renderSortIcon("status")}</div>
                                        </th>
                                        <th
                                            onClick={() => handleTableSort("apps")}
                                            className="py-3 px-2 text-center cursor-pointer hover:text-foreground transition-colors"
                                            title="Total Appearances (Starts + Sub)"
                                        >
                                            <div className="flex items-center justify-center gap-1">Apps {renderSortIcon("apps")}</div>
                                        </th>
                                        <th
                                            onClick={() => handleTableSort("starts")}
                                            className="py-3 px-2 text-center cursor-pointer hover:text-foreground transition-colors hidden sm:table-cell"
                                            title="Starts"
                                        >
                                            <div className="flex items-center justify-center gap-1">Starts {renderSortIcon("starts")}</div>
                                        </th>
                                        <th
                                            onClick={() => handleTableSort("subApps")}
                                            className="py-3 px-2 text-center cursor-pointer hover:text-foreground transition-colors hidden sm:table-cell"
                                            title="Substitute Appearances"
                                        >
                                            <div className="flex items-center justify-center gap-1">Sub {renderSortIcon("subApps")}</div>
                                        </th>
                                        <th
                                            onClick={() => handleTableSort("goals")}
                                            className="py-3 px-2 text-center cursor-pointer hover:text-foreground transition-colors"
                                        >
                                            <div className="flex items-center justify-center gap-1">Goals {renderSortIcon("goals")}</div>
                                        </th>
                                        <th
                                            onClick={() => handleTableSort("assists")}
                                            className="py-3 px-2 text-center cursor-pointer hover:text-foreground transition-colors"
                                        >
                                            <div className="flex items-center justify-center gap-1">Asts {renderSortIcon("assists")}</div>
                                        </th>
                                        <th
                                            onClick={() => handleTableSort("minutes")}
                                            className="py-3 px-2 text-center cursor-pointer hover:text-foreground transition-colors hidden lg:table-cell"
                                        >
                                            <div className="flex items-center justify-center gap-1">Mins {renderSortIcon("minutes")}</div>
                                        </th>
                                        <th
                                            onClick={() => handleTableSort("cards")}
                                            className="py-3 px-2 text-center cursor-pointer hover:text-foreground transition-colors hidden md:table-cell"
                                        >
                                            <div className="flex items-center justify-center gap-1">Cards {renderSortIcon("cards")}</div>
                                        </th>
                                        <th className="py-3 pl-2 pr-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/60">
                                    {tableSortedPlayers.map((player) => {
                                        const dep = parsePlayerDeparture(player);
                                        const isFormer = isFormerPlayer(player);
                                        const loanExpiry = getLoanExpiryStatus(player.loanEndDate);
                                        const playerAge = getPlayerAge(player);

                                        return (
                                            <tr
                                                key={player.id}
                                                onClick={() => router.push(`/squad/${player.id}`)}
                                                className="transition-colors hover:bg-surface-1/70 cursor-pointer"
                                            >
                                                {hasAnySquadNumbers && (
                                                    <td className="py-2.5 pl-4 pr-2 font-mono text-muted-foreground font-semibold">
                                                        {player.squadNumber > 0 ? `#${player.squadNumber}` : "—"}
                                                    </td>
                                                )}
                                                <td className={`py-2.5 ${hasAnySquadNumbers ? "px-3" : "pl-4 pr-3"}`}>
                                                    <div className="flex items-center gap-2.5">
                                                        <div className="w-7 h-7 rounded-full bg-surface-2 border border-border flex items-center justify-center text-[10px] font-bold text-muted-foreground shrink-0 overflow-hidden">
                                                            {player.imageUrl &&
                                                            player.imageUrl !== "/placeholder-player.png" &&
                                                            !player.imageUrl.startsWith("idb:") ? (
                                                                // eslint-disable-next-line @next/next/no-img-element
                                                                <img
                                                                    src={player.imageUrl}
                                                                    alt={formatPlayerName(player)}
                                                                    className="w-full h-full object-cover"
                                                                />
                                                            ) : (
                                                                <>
                                                                    {player.firstName?.charAt(0)}
                                                                    {player.lastName?.charAt(0)}
                                                                </>
                                                            )}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                                <Link
                                                                    href={`/squad/${player.id}`}
                                                                    onClick={(e) => e.stopPropagation()}
                                                                    className="font-bold text-foreground hover:text-primary transition-colors truncate"
                                                                >
                                                                    {formatPlayerName(player)}
                                                                </Link>
                                                                {(player.registrationType === "Loan" ||
                                                                    player.registrationType === "Dual") && (
                                                                    <span className="text-[9px] font-bold px-1.5 py-0.2 bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 rounded uppercase">
                                                                        {player.registrationType === "Loan"
                                                                            ? player.isParentClub
                                                                                ? "Loan Out"
                                                                                : "Loan In"
                                                                            : "Dual"}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            {/* Loan Club & Expiry Sub-row */}
                                                            {(player.loanClub ||
                                                                (player.registrationType === "Loan" &&
                                                                    loanExpiry.status !== "none")) && (
                                                                <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-muted-foreground flex-wrap">
                                                                    {player.loanClub && (
                                                                        <span className="inline-flex items-center gap-1 text-purple-600 dark:text-purple-400 font-medium">
                                                                            <Building2 className="w-2.5 h-2.5" />
                                                                            {player.loanClub}
                                                                        </span>
                                                                    )}
                                                                    {player.registrationType === "Loan" &&
                                                                        loanExpiry.status !== "none" && (
                                                                            <span
                                                                                className={`font-semibold ${
                                                                                    loanExpiry.status === "expired"
                                                                                        ? "text-red-500"
                                                                                        : loanExpiry.status ===
                                                                                          "expiring_soon"
                                                                                        ? "text-amber-500"
                                                                                        : "text-muted-foreground"
                                                                                }`}
                                                                            >
                                                                                • {loanExpiry.label}
                                                                            </span>
                                                                        )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="py-2.5 px-2 text-center text-muted-foreground font-medium hidden sm:table-cell">
                                                    {playerAge !== null ? playerAge : "—"}
                                                </td>
                                                <td className="py-2.5 px-2.5 whitespace-nowrap">
                                                    {(() => {
                                                        const p = (player.position || "").trim().toUpperCase();
                                                        let posBadgeClass = "bg-background text-foreground border-border";
                                                        if (p === "GK" || p.includes("GK") || p.includes("KEEPER")) {
                                                            posBadgeClass = "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25";
                                                        } else if (["CB", "RB", "LB", "DEF", "RWB", "LWB"].includes(p) || p.includes("DEF") || p.includes("BACK")) {
                                                            posBadgeClass = "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/25";
                                                        } else if (["CM", "CDM", "CAM", "MID", "RM", "LM"].includes(p) || p.includes("MID")) {
                                                            posBadgeClass = "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25";
                                                        } else if (["ST", "CF", "RW", "LW", "FWD", "ATT"].includes(p) || p.includes("FWD") || p.includes("WING") || p.includes("STRIKER")) {
                                                            posBadgeClass = "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/25";
                                                        }
                                                        const secList = (player.secondaryPositions || []).filter(
                                                            (s) => s && s.trim().toUpperCase() !== p
                                                        );
                                                        const visibleSec = secList.slice(0, 2);
                                                        const extraSecCount = secList.length - visibleSec.length;

                                                        return (
                                                            <div
                                                                className="inline-flex items-center gap-1.5"
                                                                title={
                                                                    secList.length > 0
                                                                        ? `Primary: ${player.position} • Secondary: ${secList.join(", ")}`
                                                                        : `Primary: ${player.position}`
                                                                }
                                                            >
                                                                <span className={`font-bold px-1.5 py-0.5 border rounded text-[10px] uppercase tracking-tight ${posBadgeClass}`}>
                                                                    {player.position}
                                                                </span>
                                                                {visibleSec.length > 0 && (
                                                                    <span className="text-[10px] text-muted-foreground font-medium">
                                                                        {visibleSec.join(", ")}
                                                                        {extraSecCount > 0 && (
                                                                            <span className="ml-1 text-[9px] font-semibold opacity-75">
                                                                                +{extraSecCount}
                                                                            </span>
                                                                        )}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        );
                                                    })()}
                                                </td>
                                                {activeTab === "All" && (
                                                    <td className="py-2.5 px-2.5 text-muted-foreground hidden md:table-cell truncate max-w-[140px]">
                                                        {player.squad
                                                            ? player.squad
                                                                  .split(",")
                                                                  .map((s) => {
                                                                      const clean = s.trim();
                                                                      const LEGACY_LABELS: Record<string, string> = {
                                                                          firstTeam: "First Team",
                                                                          firstteam: "First Team",
                                                                          midweek: "Midweek",
                                                                          youth: "Youth",
                                                                      };
                                                                      return LEGACY_LABELS[clean] || clean;
                                                                  })
                                                                  .join(", ")
                                                            : "—"}
                                                    </td>
                                                )}
                                                <td className="py-2.5 px-2.5" onClick={(e) => e.stopPropagation()}>
                                                    {isFormer ? (
                                                        <div className="flex flex-col items-start gap-0.5">
                                                            <Badge className="text-[10px] px-1.5 py-0.2 bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 font-semibold">
                                                                {dep.departureReason || dep.departureStatus}
                                                            </Badge>
                                                            {dep.departureDate && (
                                                                <span className="text-[9px] text-muted-foreground">
                                                                    {dep.departureDate}
                                                                </span>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        (() => {
                                                            let statusSubLabel = "";
                                                            if (player.medicalStatus === "Injured" || player.medicalStatus === "Doubtful") {
                                                                statusSubLabel = [player.injuryType, player.injuryDuration]
                                                                    .filter(Boolean)
                                                                    .join(" • ");
                                                            } else if (player.medicalStatus === "Holiday") {
                                                                if (player.holidayEnd) {
                                                                    const parsedEnd = new Date(player.holidayEnd + "T00:00:00");
                                                                    const formattedEnd = !isNaN(parsedEnd.getTime())
                                                                        ? parsedEnd.toLocaleDateString("en-GB", { day: "numeric", month: "short" })
                                                                        : player.holidayEnd;
                                                                    statusSubLabel = `Back ${formattedEnd}`;
                                                                } else if (player.holidayStart) {
                                                                    const parsedStart = new Date(player.holidayStart + "T00:00:00");
                                                                    const formattedStart = !isNaN(parsedStart.getTime())
                                                                        ? parsedStart.toLocaleDateString("en-GB", { day: "numeric", month: "short" })
                                                                        : player.holidayStart;
                                                                    statusSubLabel = `From ${formattedStart}`;
                                                                }
                                                            } else if (player.medicalStatus === "Suspended") {
                                                                statusSubLabel = [player.suspensionReason, player.suspensionDuration]
                                                                    .filter(Boolean)
                                                                    .join(" • ");
                                                            }

                                                            return (
                                                                <div className="flex flex-col items-start gap-0.5">
                                                                    <Badge
                                                                        onClick={() => handleStatusToggle(player)}
                                                                        className={`border cursor-pointer select-none text-[10px] px-2 py-0.5 rounded transition-colors ${getStatusBadgeStyle(
                                                                            player.medicalStatus
                                                                        )}`}
                                                                    >
                                                                        {player.medicalStatus}
                                                                    </Badge>
                                                                    {statusSubLabel && (
                                                                        <span
                                                                            className="text-[10px] text-muted-foreground font-medium leading-tight max-w-[150px] truncate"
                                                                            title={statusSubLabel}
                                                                        >
                                                                            {statusSubLabel}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            );
                                                        })()
                                                    )}
                                                </td>
                                                <td className="py-2.5 px-2 text-center font-bold text-foreground">
                                                    {player.appearances ?? 0}
                                                </td>
                                                <td className="py-2.5 px-2 text-center text-muted-foreground hidden sm:table-cell">
                                                    {player.starts ?? 0}
                                                </td>
                                                <td className="py-2.5 px-2 text-center text-muted-foreground hidden sm:table-cell">
                                                    {player.subApps ?? 0}
                                                </td>
                                                <td className="py-2.5 px-2 text-center font-bold text-foreground">
                                                    {player.goals ?? 0}
                                                </td>
                                                <td className="py-2.5 px-2 text-center font-bold text-foreground">
                                                    {player.assists ?? 0}
                                                </td>
                                                <td className="py-2.5 px-2 text-center text-muted-foreground hidden lg:table-cell">
                                                    {(player as any).minutes_played ?? 0}
                                                </td>
                                                <td className="py-2.5 px-2 text-center hidden md:table-cell">
                                                    <div className="flex items-center justify-center gap-1.5">
                                                        {(player.yellow_cards ?? 0) > 0 && (
                                                            <span className="inline-flex items-center gap-0.5 font-bold text-muted-foreground">
                                                                <span className="w-2 h-2.5 bg-yellow-400 rounded-[2px] inline-block" />
                                                                {player.yellow_cards}
                                                            </span>
                                                        )}
                                                        {(player.red_cards ?? 0) > 0 && (
                                                            <span className="inline-flex items-center gap-0.5 font-bold text-muted-foreground">
                                                                <span className="w-2 h-2.5 bg-red-500 rounded-[2px] inline-block" />
                                                                {player.red_cards}
                                                            </span>
                                                        )}
                                                        {(player.yellow_cards ?? 0) === 0 &&
                                                            (player.red_cards ?? 0) === 0 && (
                                                                <span className="text-muted-foreground/40">—</span>
                                                            )}
                                                    </div>
                                                </td>
                                                <td
                                                    className="py-2.5 pl-2 pr-4 text-right"
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    <div className="flex items-center justify-end gap-1">
                                                        <Button
                                                            variant="outline"
                                                            size="icon"
                                                            onClick={() => handleEdit(player)}
                                                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                                            title="Edit Player"
                                                        >
                                                            <Pencil className="w-3.5 h-3.5" />
                                                        </Button>
                                                        {isFormer ? (
                                                            <>
                                                                <Button
                                                                    variant="outline"
                                                                    size="icon"
                                                                    onClick={() => handleRestorePlayer(player)}
                                                                    className="h-7 w-7 text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/10"
                                                                    title="Restore to Active Squad"
                                                                >
                                                                    <RotateCcw className="w-3.5 h-3.5" />
                                                                </Button>
                                                                <Button
                                                                    variant="outline"
                                                                    size="icon"
                                                                    onClick={() => handleDeletePlayerFromDb(player)}
                                                                    className="h-7 w-7 text-red-600 border-red-500/30 hover:bg-red-500/10"
                                                                    title="Permanently Remove from Database"
                                                                >
                                                                    <Trash2 className="w-3.5 h-3.5" />
                                                                </Button>
                                                            </>
                                                        ) : (
                                                            <Button
                                                                variant="outline"
                                                                size="icon"
                                                                onClick={() => openDepartureDialog(player)}
                                                                className="h-7 w-7 text-muted-foreground hover:text-amber-600 hover:border-amber-500/40"
                                                                title="Mark as Left Club"
                                                            >
                                                                <UserMinus className="w-3.5 h-3.5" />
                                                            </Button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-10">
                        {/* Goalkeepers */}
                        {sortedPlayers.filter(p => ["GK"].includes(p.position)).length > 0 && (
                            <div>
                                <SectionHeader title="Goalkeepers" className="mb-4" />
                                <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
                                    {sortedPlayers.filter(p => ["GK"].includes(p.position)).map(player => (
                                        <PlayerCard
                                            key={player.id}
                                            player={player}
                                            onMarkLeft={openDepartureDialog}
                                            onRestore={handleRestorePlayer}
                                            onDelete={() => handleDeletePlayerFromDb(player)}
                                            onEdit={handleEdit}
                                            onStatusToggle={handleStatusToggle}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Defenders */}
                        {sortedPlayers.filter(p => ["DEF", "CB", "LCB", "RCB", "RB", "LB", "RWB", "LWB"].includes(p.position)).length > 0 && (
                            <div>
                                <SectionHeader title="Defenders" className="mb-4" />
                                <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
                                    {sortedPlayers.filter(p => ["DEF", "CB", "LCB", "RCB", "RB", "LB", "RWB", "LWB"].includes(p.position)).map(player => (
                                        <PlayerCard
                                            key={player.id}
                                            player={player}
                                            onMarkLeft={openDepartureDialog}
                                            onRestore={handleRestorePlayer}
                                            onDelete={() => handleDeletePlayerFromDb(player)}
                                            onEdit={handleEdit}
                                            onStatusToggle={handleStatusToggle}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Midfielders */}
                        {sortedPlayers.filter(p => ["MID", "CDM", "CM", "CAM", "RM", "LM"].includes(p.position)).length > 0 && (
                            <div>
                                <SectionHeader title="Midfielders" className="mb-4" />
                                <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
                                    {sortedPlayers.filter(p => ["MID", "CDM", "CM", "CAM", "RM", "LM"].includes(p.position)).map(player => (
                                        <PlayerCard
                                            key={player.id}
                                            player={player}
                                            onMarkLeft={openDepartureDialog}
                                            onRestore={handleRestorePlayer}
                                            onDelete={() => handleDeletePlayerFromDb(player)}
                                            onEdit={handleEdit}
                                            onStatusToggle={handleStatusToggle}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Forwards */}
                        {sortedPlayers.filter(p => ["FWD", "ST", "CF", "RW", "LW"].includes(p.position)).length > 0 && (
                            <div>
                                <SectionHeader title="Forwards" className="mb-4" />
                                <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
                                    {sortedPlayers.filter(p => ["FWD", "ST", "CF", "RW", "LW"].includes(p.position)).map(player => (
                                        <PlayerCard
                                            key={player.id}
                                            player={player}
                                            onMarkLeft={openDepartureDialog}
                                            onRestore={handleRestorePlayer}
                                            onDelete={() => handleDeletePlayerFromDb(player)}
                                            onEdit={handleEdit}
                                            onStatusToggle={handleStatusToggle}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </PageSection>
            </div>

            {editingPlayer && (
                <div className="fixed inset-0 z-[60] flex justify-end">
                    <div className="absolute inset-0 bg-background/50 backdrop-blur-sm" onClick={closeEditDrawer} />
                    <div className="relative h-[100dvh] sm:h-full w-full max-w-[450px] bg-surface-1 shadow-2xl border-l border-border flex flex-col animate-in slide-in-from-right duration-300">
                        <div className="p-3 border-b border-border flex items-center justify-between shrink-0 bg-surface-2">
                            <h2 className="text-base sm:text-lg font-semibold text-foreground">{editingPlayer.firstName ? "Edit Player" : "Add Player"}</h2>
                            <button onClick={closeEditDrawer} className="text-sm text-muted-foreground hover:text-foreground p-2">✕</button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-3.5 sm:p-4 space-y-4 text-sm">
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

                             {(editingPlayer.registrationType === "Loan" || editingPlayer.registrationType === "Dual") && (
                                 <div className="space-y-3 bg-purple-50/60 p-3 rounded-lg border border-purple-200">
                                     {editingPlayer.registrationType === "Loan" && (
                                         <div>
                                             <label className="block text-xs font-medium text-slate-600 mb-1">Loan Direction</label>
                                             <div className="flex gap-2">
                                                 <button
                                                     type="button"
                                                     onClick={() => setEditingPlayer({ ...editingPlayer, isParentClub: false })}
                                                     className={`flex-1 py-1.5 text-xs font-bold border rounded transition-all ${
                                                         !editingPlayer.isParentClub
                                                             ? "bg-slate-900 border-slate-900 text-white"
                                                             : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                                                     }`}
                                                 >
                                                     Loaned In (From Parent Club)
                                                 </button>
                                                 <button
                                                     type="button"
                                                     onClick={() => setEditingPlayer({ ...editingPlayer, isParentClub: true })}
                                                     className={`flex-1 py-1.5 text-xs font-bold border rounded transition-all ${
                                                         editingPlayer.isParentClub
                                                             ? "bg-slate-900 border-slate-900 text-white"
                                                             : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                                                     }`}
                                                 >
                                                     Loaned Out (We Are Parent)
                                                 </button>
                                             </div>
                                         </div>
                                     )}

                                     <div className="space-y-1">
                                         <label className="block text-xs font-medium text-slate-600">
                                             {editingPlayer.registrationType === "Loan"
                                                 ? editingPlayer.isParentClub
                                                     ? "Destination Loan Club Name"
                                                     : "Parent Club Name"
                                                 : "Dual Registration Club Name"}
                                         </label>
                                         <Input
                                             value={editingPlayer.loanClub || ""}
                                             onChange={(e) => setEditingPlayer({ ...editingPlayer, loanClub: e.target.value })}
                                             placeholder={
                                                 editingPlayer.registrationType === "Loan"
                                                     ? editingPlayer.isParentClub
                                                         ? "e.g. Hendon FC"
                                                         : "e.g. Barnet FC"
                                                     : "e.g. Wingate & Finchley"
                                             }
                                             className="h-8 text-xs bg-white"
                                         />
                                     </div>

                                     {editingPlayer.registrationType === "Loan" && (
                                         <div className="space-y-1">
                                             <div className="flex items-center justify-between">
                                                 <label className="block text-xs font-medium text-slate-600">
                                                     Loan Expiry Date
                                                 </label>
                                                 {editingPlayer.loanEndDate && (
                                                     <span className="text-[10px] font-bold text-purple-700">
                                                         {getLoanExpiryStatus(editingPlayer.loanEndDate).label}
                                                     </span>
                                                 )}
                                             </div>
                                             <Input
                                                 type="date"
                                                 value={editingPlayer.loanEndDate || ""}
                                                 onChange={(e) => setEditingPlayer({ ...editingPlayer, loanEndDate: e.target.value })}
                                                 className="h-8 text-xs bg-white"
                                             />
                                         </div>
                                     )}
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
                                    <option value="At Parent Club">At Parent Club</option>
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

                            {editingPlayer.medicalStatus === "Suspended" && (
                                <div className="space-y-3 bg-red-50/50 p-3 rounded-lg border border-red-100">
                                    <div className="space-y-1">
                                        <label className="block text-xs font-medium text-slate-600">Suspension Reason</label>
                                        <Input
                                            value={editingPlayer.suspensionReason || ""}
                                            onChange={(e) => setEditingPlayer({ ...editingPlayer, suspensionReason: e.target.value })}
                                            placeholder="e.g. 5 Yellow Cards / Red Card"
                                            className="h-8 text-sm bg-white"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="block text-xs font-medium text-slate-600">Suspension Duration (matches/days)</label>
                                        <Input
                                            value={editingPlayer.suspensionDuration || ""}
                                            onChange={(e) => setEditingPlayer({ ...editingPlayer, suspensionDuration: e.target.value })}
                                            placeholder="e.g. 3 matches"
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

                        <div className="p-3 sm:p-4 pb-6 sm:pb-4 border-t border-border flex justify-between items-center gap-2 shrink-0 bg-surface-2">
                            {editingPlayer.id !== "new" ? (
                                isFormerPlayer(editingPlayer) ? (
                                    <div className="flex items-center gap-1.5 shrink-0">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const p = players.find(pl => pl.id === editingPlayer.id) || editingPlayer;
                                                setEditingPlayer(null);
                                                handleRestorePlayer(p);
                                            }}
                                            className="px-2 sm:px-3 py-1.5 text-xs font-semibold text-emerald-600 hover:bg-emerald-500/10 rounded transition-colors flex items-center gap-1 shrink-0"
                                        >
                                            <RotateCcw className="w-3.5 h-3.5" />
                                            <span>Restore</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const p = players.find(pl => pl.id === editingPlayer.id) || editingPlayer;
                                                handleDeletePlayerFromDb(p);
                                            }}
                                            className="px-2 sm:px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-500/10 rounded transition-colors flex items-center gap-1 shrink-0"
                                            title="Permanently Delete from Database"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                            <span>Delete DB</span>
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const p = players.find(pl => pl.id === editingPlayer.id) || editingPlayer;
                                            setEditingPlayer(null);
                                            openDepartureDialog(p);
                                        }}
                                        className="px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-amber-600 hover:bg-amber-500/10 rounded transition-colors flex items-center gap-1.5 shrink-0"
                                    >
                                        <UserMinus className="w-3.5 h-3.5" />
                                        <span className="hidden xs:inline">Mark as Left Club</span>
                                        <span className="xs:hidden">Mark Left</span>
                                    </button>
                                )
                            ) : <div />}
                            <div className="flex gap-2 shrink-0">
                                <button
                                    onClick={closeEditDrawer}
                                    className="px-3 sm:px-4 py-1.5 text-xs border border-border rounded hover:bg-muted text-muted-foreground transition-colors"
                                >
                                    Cancel
                                </button>
                                <Button
                                    onClick={() => handleSavePlayer(editingPlayer)}
                                    className="px-4 sm:px-6 py-1.5 text-xs bg-brand hover:bg-brand/90 text-brand-foreground rounded shadow-sm transition-all active:scale-95"
                                >
                                    Save Player
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Mark Player(s) as Left Club Modal */}
            <Dialog open={!!departingPlayer || isBulkDepartOpen} onOpenChange={(open) => {
                if (!open) {
                    setDepartingPlayer(null);
                    setIsBulkDepartOpen(false);
                }
            }}>
                <DialogContent className="sm:max-w-[460px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <UserMinus className="w-5 h-5 text-amber-500" />
                            {isBulkDepartOpen
                                ? `Mark ${selectedPlayerIds.length} Selected Player(s) as Left Club`
                                : `Mark ${departingPlayer ? formatPlayerName(departingPlayer) : "Player"} as Left Club`}
                        </DialogTitle>
                        <DialogDescription>
                            This will move {isBulkDepartOpen ? "the selected players" : "the player"} out of your active squad into <strong>Former Players</strong>. All historical appearances, goals, assists, and training attendance records will be preserved.
                        </DialogDescription>
                    </DialogHeader>

                    {(departingPlayer || isBulkDepartOpen) && (
                        <div className="space-y-4 py-2">
                            {departingPlayer && (departingPlayer.registrationType === "Loan" || departingPlayer.registrationType === "Dual") && (
                                <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/25 text-xs text-purple-700 dark:text-purple-300 flex items-center justify-between gap-2">
                                    <span>
                                        <strong>{departingPlayer.registrationType === "Loan" ? "Loan Player" : "Dual-Registered Player"}:</strong> &ldquo;Returned to parent club&rdquo; is recommended when a loan or dual spell concludes.
                                    </span>
                                </div>
                            )}

                            <div className="space-y-2">
                                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                    Departure Status / Reason
                                </label>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {DEPARTURE_REASONS.map((reason) => {
                                        const isSelected = departureReason === reason;
                                        const isRecommended =
                                            reason === "Returned to parent club" &&
                                            departingPlayer &&
                                            (departingPlayer.registrationType === "Loan" || departingPlayer.registrationType === "Dual");
                                        return (
                                            <button
                                                key={reason}
                                                type="button"
                                                onClick={() => setDepartureReason(reason)}
                                                className={`text-left px-3 py-2 rounded-lg border text-xs font-semibold transition-all flex items-center justify-between gap-1.5 ${
                                                    isSelected
                                                        ? "bg-amber-500/15 border-amber-500 text-foreground shadow-sm"
                                                        : "bg-surface-1 border-border text-muted-foreground hover:text-foreground hover:bg-surface-2"
                                                }`}
                                            >
                                                <span className="truncate">{reason}</span>
                                                {isRecommended && (
                                                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-600 dark:text-purple-300 font-bold shrink-0">
                                                        Loan/Dual
                                                    </span>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                    Departure Date
                                </label>
                                <Input
                                    type="date"
                                    value={departureDate}
                                    onChange={(e) => setDepartureDate(e.target.value)}
                                    className="h-9 text-sm"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                    Departure Note (Optional)
                                </label>
                                <textarea
                                    value={departureNotes}
                                    onChange={(e) => setDepartureNotes(e.target.value)}
                                    placeholder="e.g. Recalled by parent club after loan spell, transferred to local side..."
                                    className="w-full h-20 px-3 py-2 border border-border rounded-md text-xs bg-background text-foreground resize-none focus:ring-2 focus:ring-brand/40 focus:outline-none"
                                />
                            </div>
                        </div>
                    )}

                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button
                            variant="outline"
                            onClick={() => {
                                setDepartingPlayer(null);
                                setIsBulkDepartOpen(false);
                            }}
                            disabled={isSavingDeparture}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={isBulkDepartOpen ? handleBulkMarkLeft : handleMarkPlayerLeft}
                            disabled={isSavingDeparture}
                            className="bg-amber-600 hover:bg-amber-700 text-white"
                        >
                            {isSavingDeparture ? "Archiving..." : "Mark as Left Club"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

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
                            try {
                                const cleanSquads = editingSquads.map(s => s.trim()).filter(Boolean);
                                const finalSquads = cleanSquads.length > 0 ? cleanSquads : ["First Team"];
                                await updateSettings({ squads: finalSquads });

                                // Automatically update or mark players affected by deleted squads
                                const todayIso = new Date().toISOString().split("T")[0];
                                const finalKeys = new Set(finalSquads.map(s => normalizeSquadKey(s)));
                                await Promise.all(
                                    players.map(async (p) => {
                                        if (!p.squad || isFormerPlayer(p)) return;
                                        const parts = p.squad.split(",").map(s => s.trim()).filter(Boolean);
                                        if (parts.length === 0) return;
                                        const remainingParts = parts.filter(part => finalKeys.has(normalizeSquadKey(part)));
                                        if (remainingParts.length === 0) {
                                            // Player was registered only for the deleted squad -> mark as Left club
                                            const updatedNotes = serializeDepartureToNotes(p.notes, {
                                                reason: "Left club",
                                                date: todayIso,
                                            });
                                            await supabase
                                                .from("players")
                                                .update({
                                                    notes: updatedNotes,
                                                    availability: false,
                                                    is_in_training_squad: false,
                                                    is_in_matchday_tracker: false,
                                                })
                                                .eq("id", p.id);
                                        } else if (remainingParts.length !== parts.length) {
                                            // Player belonged to multiple squads; keep only remaining active squads
                                            await supabase
                                                .from("players")
                                                .update({
                                                    squad: remainingParts.join(", "),
                                                })
                                                .eq("id", p.id);
                                        }
                                    })
                                );
                                await fetchData();

                                if (!finalSquads.includes(activeTab) && activeTab !== "All") {
                                    setActiveTab(finalSquads[0] || "All");
                                }
                                setIsManageSquadsOpen(false);
                            } catch (err: any) {
                                alert("Failed to save squads: " + (err?.message || "Unknown error"));
                            }
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
