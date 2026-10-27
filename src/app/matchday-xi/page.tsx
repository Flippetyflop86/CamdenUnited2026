"use client";

import { useState, useEffect, useRef } from "react";
import { MatchdayXI, MatchdayPlayerEventStats, Player, Match, Position } from "@/types";
import { FORMATIONS, FORMATION_NAMES, getDisplayPosition } from "@/lib/formations";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    Plus,
    Trash2,
    Save,
    FileDown,
    Calendar,
    MapPin,
    Clock,
    GripVertical,
    Trophy,
    MessageCircle,
    Search,
    X,
    Loader2,
    RefreshCw,
    Sparkles,
    ChevronDown,
    ChevronUp,
    CheckCircle2,
    AlertCircle,
    Award,
    FileText,
    Hash,
    Pencil,
    RotateCcw,
    Image as ImageIcon,
    ArrowLeftRight,
    UserPlus,
    Shirt,
    Star
} from "lucide-react";
import { useClub } from "@/context/club-context";
import { useAuth } from "@/context/auth-context";
import { supabase } from "@/lib/supabase";
import { formatPlayerName, isFormerPlayer, parsePlayerDeparture } from "@/lib/utils";
import { calculateMeetTime } from "@/lib/whatsapp-utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WeeklyFootballCalendar } from "@/components/calendar/WeeklyFootballCalendar";

const POSITION_ORDER: { [key: string]: number } = {
    'GK': 1,
    'CB': 2, 'RB': 3, 'LB': 4, 'RWB': 5, 'LWB': 6, 'DEF': 7,
    'CDM': 8, 'CM': 9, 'CAM': 10, 'RM': 11, 'LM': 12, 'MID': 13,
    'LW': 14,
    'RW': 15,
    'CF': 16, 'ST': 17, 'FWD': 18
};

function parseLineupFromNotes(notes?: string): any | null {
    if (!notes || !notes.includes("[Lineup: ")) return null;
    const startIdx = notes.indexOf("[Lineup: ");
    const jsonStart = startIdx + "[Lineup: ".length;
    let depth = 0;
    let inString = false;
    let escape = false;
    for (let i = jsonStart; i < notes.length; i++) {
        const ch = notes[i];
        if (escape) { escape = false; continue; }
        if (ch === "\\") { escape = true; continue; }
        if (ch === '"') { inString = !inString; continue; }
        if (inString) continue;
        if (ch === "{") depth++;
        else if (ch === "}") {
            depth--;
            if (depth === 0) {
                try {
                    return JSON.parse(notes.substring(jsonStart, i + 1));
                } catch (e) {
                    console.warn("Failed to parse lineup JSON from notes:", e);
                    return null;
                }
            }
        }
    }
    return null;
}

function stripLineupFromNotes(notes?: string): string {
    if (!notes || !notes.includes("[Lineup: ")) return (notes || "").trim();
    const startIdx = notes.indexOf("[Lineup: ");
    const jsonStart = startIdx + "[Lineup: ".length;
    let depth = 0;
    let inString = false;
    let escape = false;
    for (let i = jsonStart; i < notes.length; i++) {
        const ch = notes[i];
        if (escape) { escape = false; continue; }
        if (ch === "\\") { escape = true; continue; }
        if (ch === '"') { inString = !inString; continue; }
        if (inString) continue;
        if (ch === "{") depth++;
        else if (ch === "}") {
            depth--;
            if (depth === 0) {
                const closeBracketIdx = notes[i + 1] === "]" ? i + 2 : i + 1;
                return (notes.substring(0, startIdx) + notes.substring(closeBracketIdx)).trim();
            }
        }
    }
    return notes.trim();
}

export default function MatchdayXIPage() {
    const { settings, isLoaded: isClubLoaded } = useClub();
    const { isLoading: isAuthLoading } = useAuth();
    const [lineup, setLineup] = useState<MatchdayXI | null>(null);
    const [players, setPlayers] = useState<Player[]>([]);
    const [isEditing, setIsEditing] = useState(false);
    const [matches, setMatches] = useState<Match[]>([]);
    const [selectedMatchId, setSelectedMatchId] = useState<string>("");
    const [nextMatch, setNextMatch] = useState<Match | null>(null);
    const loadedLineupKeyRef = useRef<string>("");
    const [draggedPlayer, setDraggedPlayer] = useState<string | null>(null);
    const [draggedSource, setDraggedSource] = useState<{type: 'squad' | 'pitch' | 'sub', index?: number} | null>(null);
    const [squadFilter, setSquadFilter] = useState<"All" | "GK" | "DEF" | "MID" | "FWD">("All");
    const [panelSearchQuery, setPanelSearchQuery] = useState<string>("");
    const currentSquads = settings.squads || ["First Team"];
    const [activeSquadTab, setActiveSquadTab] = useState<string>(currentSquads[0] || "First Team");
    const [activeSlot, setActiveSlot] = useState<{type: 'pitch' | 'sub', index: number, label: string} | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [showUnavailableSection, setShowUnavailableSection] = useState<boolean>(false);
    const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "draft">("draft");
    const [editingNamePlayerId, setEditingNamePlayerId] = useState<string | null>(null);
    const [editingNameValue, setEditingNameValue] = useState<string>("");
    const [editingNumberSlot, setEditingNumberSlot] = useState<string | null>(null);
    const [editingNumberValue, setEditingNumberValue] = useState<string>("");
    const [showTrialistForm, setShowTrialistForm] = useState<boolean>(false);
    const [trialistInputName, setTrialistInputName] = useState<string>("");
    const [trialistInputNumber, setTrialistInputNumber] = useState<string>("");
    const [seasonStatsMap, setSeasonStatsMap] = useState<Record<string, { apps: number; goals: number; assists: number }>>({});
    const [currentMatchStatsMap, setCurrentMatchStatsMap] = useState<Record<string, { goals: number; assists: number; yellowCards: number; redCards: number }>>({});
    const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);
    const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const notesDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const venueDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const showToast = (message: string, type: "success" | "error" | "info" = "success") => {
        if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
        setToast({ message, type });
        toastTimeoutRef.current = setTimeout(() => {
            setToast(null);
        }, 3500);
    };

    const getPositionCategory = (pos: string) => {
        const p = pos.toUpperCase();
        if (['GK'].includes(p)) return 'GK';
        if (['CB', 'RB', 'LB', 'DEF', 'RWB', 'LWB'].includes(p)) return 'DEF';
        if (['CM', 'CDM', 'CAM', 'MID', 'RM', 'LM'].includes(p)) return 'MID';
        if (['ST', 'CF', 'RW', 'LW', 'FWD'].includes(p)) return 'FWD';
        return 'All';
    };

    const isIdealPosition = (playerPos: string, slotLabel: string) => {
        const p = playerPos.toUpperCase();
        const s = slotLabel.toUpperCase();
        
        // Exact match
        if (p === s) return true;
        
        // Goalkeeper
        if (s === 'GK') return p === 'GK';
        
        // Centre Backs
        if (['CB', 'LCB', 'RCB'].includes(s)) {
            return ['CB', 'DEF'].includes(p);
        }
        
        // Left Backs
        if (['LB', 'LWB'].includes(s)) {
            return ['LB', 'LWB', 'DEF'].includes(p);
        }
        
        // Right Backs
        if (['RB', 'RWB'].includes(s)) {
            return ['RB', 'RWB', 'DEF'].includes(p);
        }
        
        // Defensive Midfielders (DM)
        if (['CDM', 'LDM', 'RDM', 'DM'].includes(s)) {
            return ['CDM', 'DM', 'CM', 'MID'].includes(p);
        }
        
        // Attacking Midfielders (CAM)
        if (['CAM', 'LAM', 'RAM', 'AM'].includes(s)) {
            return ['CAM', 'CM', 'AM', 'MID'].includes(p);
        }
        
        // Central Midfielders
        if (['CM', 'MID'].includes(s)) {
            return ['CM', 'CDM', 'CAM', 'DM', 'AM', 'MID'].includes(p);
        }
        
        // Wide Midfielders / Wingers
        if (['LM', 'RM', 'LW', 'RW'].includes(s)) {
            return ['LM', 'RM', 'LW', 'RW', 'MID', 'FWD'].includes(p);
        }
        
        // Forwards
        if (['ST', 'CF', 'FWD'].includes(s)) {
            return ['ST', 'CF', 'FWD'].includes(p);
        }
        
        return false;
    };

    const getPositionFitStatus = (player: Player, slotLabel: string): { status: "ideal" | "secondary" | "out"; label: string } => {
        if (isIdealPosition(player.position, slotLabel)) {
            return { status: "ideal", label: `Natural fit (${player.position})` };
        }
        if (player.secondaryPositions && player.secondaryPositions.some(pos => isIdealPosition(pos, slotLabel))) {
            return { status: "secondary", label: `Secondary position (${player.secondaryPositions.join(", ")})` };
        }
        if (getPositionCategory(player.position) === getPositionCategory(slotLabel)) {
            return { status: "secondary", label: `Same unit (${player.position} in ${slotLabel})` };
        }
        return { status: "out", label: `Out of position (${player.position} playing ${slotLabel})` };
    };

    // Load Data
    useEffect(() => {
        fetchPlayers();
        fetchMatches();
        fetchSeasonStats();

        // Subscription for realtime updates (optional but good for multi-user)
        const channel = supabase.channel('public:matchday_xis')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'matchday_xis' }, () => fetchLineupOnly())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, () => fetchPlayers())
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, []);

    useEffect(() => {
        if (currentSquads.length > 0 && !currentSquads.includes(activeSquadTab)) {
            setActiveSquadTab(currentSquads[0]);
        }
    }, [currentSquads, activeSquadTab]);

    useEffect(() => {
        fetchLineupOnly();
    }, [activeSquadTab]);

    const fetchSeasonStats = async () => {
        try {
            const { data } = await supabase.from('match_player_stats').select('player_id, goals, assists, minutes_played');
            if (data) {
                const map: Record<string, { apps: number; goals: number; assists: number }> = {};
                data.forEach((row: any) => {
                    const pid = row.player_id;
                    if (!pid) return;
                    if (!map[pid]) map[pid] = { apps: 0, goals: 0, assists: 0 };
                    if ((row.minutes_played ?? 90) > 0) map[pid].apps += 1;
                    map[pid].goals += Number(row.goals) || 0;
                    map[pid].assists += Number(row.assists) || 0;
                });
                setSeasonStatsMap(map);
            }
        } catch (err) {
            console.warn("Error fetching season stats:", err);
        }
    };

    const fetchCurrentMatchStats = async (matchId: string) => {
        if (!matchId) return;
        try {
            const { data } = await supabase
                .from('match_player_stats')
                .select('player_id, goals, assists, yellow_cards, red_cards')
                .eq('match_id', matchId);
            const map: Record<string, { goals: number; assists: number; yellowCards: number; redCards: number }> = {};
            (data || []).forEach((row: any) => {
                if (!row.player_id) return;
                map[row.player_id] = {
                    goals: Number(row.goals) || 0,
                    assists: Number(row.assists) || 0,
                    yellowCards: Number(row.yellow_cards) || 0,
                    redCards: Number(row.red_cards) || 0
                };
            });
            setCurrentMatchStatsMap(map);
        } catch (err) {
            console.warn("Error fetching match stats:", err);
        }
    };

    const fetchData = async () => {
        await Promise.all([fetchLineupOnly(), fetchPlayers(), fetchMatches(), fetchSeasonStats()]);
    };

    const fetchLineupOnly = async (isFallback = false) => {
        if (selectedMatchId && !isFallback) return;
        try {
            const { data, error } = await supabase
                .from('matchday_xis')
                .select('*')
                .eq('squad', activeSquadTab)
                .order('created_at', { ascending: false })
                .limit(1);

            if (error && (
                error.message.includes('column "squad" does not exist') || 
                error.message.includes("Could not find the 'squad' column") || 
                error.message.includes("squad")
            )) {
                // Fallback for database migration pending
                const fallbackRes = await supabase.from('matchday_xis').select('*').order('created_at', { ascending: false }).limit(1);
                if (fallbackRes.data && fallbackRes.data.length > 0) {
                    setLineup({
                        id: fallbackRes.data[0].id,
                        formation: fallbackRes.data[0].formation,
                        starters: fallbackRes.data[0].starters,
                        substitutes: fallbackRes.data[0].substitutes,
                        squad: activeSquadTab,
                        createdAt: fallbackRes.data[0].created_at,
                        updatedAt: fallbackRes.data[0].created_at
                    });
                    return;
                }
            } else if (data && data.length > 0) {
                setLineup({
                    id: data[0].id,
                    formation: data[0].formation,
                    starters: data[0].starters,
                    substitutes: data[0].substitutes,
                    squad: data[0].squad,
                    createdAt: data[0].created_at,
                    updatedAt: data[0].created_at
                });
                return;
            }
        } catch (e) {
            console.error("Error fetching lineup:", e);
        }

        // Default empty lineup if nothing found
        setLineup({
            id: "default-xi",
            formation: "4-2-3-1",
            starters: {},
            substitutes: ["", "", "", "", ""],
            squad: activeSquadTab,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        });
    };

    const fetchPlayers = async () => {
        const { data } = await supabase.from('players').select('*');
        if (data) {
            const mapped = data.map((p: any) => {
                const dep = parsePlayerDeparture(p);
                const notesStr = p.notes || "";
                const injuryMatch = notesStr.match(/\[INJURY:(.*?)\]/);
                const durationMatch = notesStr.match(/\[OUT_DURATION:(.*?)\]/);
                const suspReasonMatch = notesStr.match(/\[SUSPENSION_REASON:(.*?)\]/);
                return {
                    id: p.id,
                    firstName: p.first_name,
                    lastName: p.last_name,
                    position: p.position,
                    squad: p.squad,
                    squadNumber: p.squad_number || 0,
                    age: p.age || 0,
                    nationality: p.nationality || "Unknown",
                    medicalStatus: p.medical_status || "Available",
                    holidayStart: p.holiday_start,
                    holidayEnd: p.holiday_end,
                    injuryType: injuryMatch ? injuryMatch[1] : undefined,
                    injuryDuration: durationMatch ? durationMatch[1] : undefined,
                    suspensionReason: suspReasonMatch ? suspReasonMatch[1] : undefined,
                    contractExpiry: p.contract_expiry || "",
                    availability: p.availability ?? true,
                    appearances: p.appearances || 0,
                    goals: p.goals || 0,
                    assists: p.assists || 0,
                    imageUrl: p.image_url,
                    isInMatchdayTracker: p.is_in_matchday_tracker,
                    secondaryPositions: p.secondary_position ? p.secondary_position.split(",").map((s: string) => s.trim() as Position) : [],
                    nickname: p.nickname || "",
                    useNickname: p.use_nickname || false,
                    notes: p.notes,
                    departureStatus: dep.departureStatus,
                    departureReason: dep.departureReason,
                    departureDate: dep.departureDate,
                    departureNotes: dep.departureNotes,
                };
            });

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
        const { data } = await supabase.from('matches').select('*').order('date', { ascending: false });
        if (data && data.length > 0) {
            const mapped = data.map((m: any) => ({
                id: m.id,
                opponent: m.opponent,
                date: m.date,
                time: m.time,
                competition: m.competition || "League",
                isHome: m.is_home,
                result: m.result,
                event_token: m.event_token,
                notes: m.notes || ""
            }));
            setMatches(mapped);
            
            const urlMatchId = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("match") : null;
            const requestedMatch = urlMatchId ? mapped.find((m: any) => m.id === urlMatchId) : null;
            const today = new Date().toISOString().split('T')[0];
            const upcoming = requestedMatch || [...mapped].reverse().find((m: any) => m.date >= today) || mapped[0];
            if (upcoming) {
                setSelectedMatchId(upcoming.id);
                setNextMatch(upcoming);
            }
        }
    };

    // Load lineup when selectedMatchId changes
    useEffect(() => {
        if (!selectedMatchId || matches.length === 0) return;

        const currentKey = `${activeSquadTab}-${selectedMatchId}`;
        if (loadedLineupKeyRef.current === currentKey) {
            return;
        }

        const currentMatch = matches.find(m => m.id === selectedMatchId);
        if (!currentMatch) return;

        setNextMatch(currentMatch);
        fetchCurrentMatchStats(selectedMatchId);

        const parsed = parseLineupFromNotes(currentMatch.notes);
        if (parsed) {
            const hasStarters = Object.values(parsed.starters || {}).some(Boolean);
            setLineup({
                id: `match-lineup-${currentMatch.id}`,
                formation: parsed.formation || "4-2-3-1",
                starters: parsed.starters || {},
                substitutes: parsed.substitutes || ["", "", "", "", ""],
                usedSubstitutes: parsed.usedSubstitutes || [],
                substitutions: parsed.substitutions || [],
                captainId: parsed.captainId || "",
                viceCaptainId: parsed.viceCaptainId || "",
                penaltyTakerId: parsed.penaltyTakerId || "",
                cornerTakerId: parsed.cornerTakerId || "",
                freeKickTakerId: parsed.freeKickTakerId || "",
                tacticalNotes: parsed.tacticalNotes || "",
                customNames: parsed.customNames || {},
                customNumbers: parsed.customNumbers || {},
                kitOverride: parsed.kitOverride || "auto",
                customKitColor: parsed.customKitColor || "",
                gkKitColor: parsed.gkKitColor || "#10b981",
                meetOffsetMinutes: typeof parsed.meetOffsetMinutes === "number" ? parsed.meetOffsetMinutes : -60,
                venueNotes: parsed.venueNotes || "",
                motmPlayerId: parsed.motmPlayerId || "",
                matchEvents: parsed.matchEvents || {},
                squad: activeSquadTab,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });
            setSaveStatus(hasStarters ? "saved" : "draft");
            loadedLineupKeyRef.current = currentKey;
            return;
        }

        // Fallback to blank lineup
        setLineup({
            id: `match-lineup-${selectedMatchId}`,
            formation: "4-2-3-1",
            starters: {},
            substitutes: ["", "", "", "", ""],
            usedSubstitutes: [],
            substitutions: [],
            captainId: "",
            viceCaptainId: "",
            penaltyTakerId: "",
            cornerTakerId: "",
            freeKickTakerId: "",
            tacticalNotes: "",
            customNames: {},
            customNumbers: {},
            kitOverride: "auto",
            customKitColor: "",
            gkKitColor: "#10b981",
            meetOffsetMinutes: -60,
            venueNotes: "",
            motmPlayerId: "",
            matchEvents: {},
            squad: activeSquadTab,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });
        setSaveStatus("draft");
        loadedLineupKeyRef.current = currentKey;
    }, [selectedMatchId, matches, activeSquadTab]);

    const syncLineupAppearancesToDatabase = async (matchId: string, newLineup: MatchdayXI & { usedSubstitutes?: string[] }) => {
        const playerIds = new Set<string>();
        const isRealPlayerId = (id: any): id is string => Boolean(id && typeof id === "string" && !id.startsWith("trialist-"));

        if (newLineup.starters) {
            Object.values(newLineup.starters).forEach((id: any) => {
                if (isRealPlayerId(id)) playerIds.add(id);
            });
        }

        if (newLineup.usedSubstitutes && Array.isArray(newLineup.usedSubstitutes)) {
            newLineup.usedSubstitutes.forEach((id: any) => {
                if (isRealPlayerId(id)) playerIds.add(id);
            });
        } else if (newLineup.substitutes && Array.isArray(newLineup.substitutes)) {
            newLineup.substitutes.forEach((id: any) => {
                if (isRealPlayerId(id)) playerIds.add(id);
            });
        }

        // Calculate minutes played using a timeline
        const minutesMap = new Map<string, number>();
        const onPitchSince = new Map<string, number>();

        // Initialize starters
        if (newLineup.starters) {
            Object.values(newLineup.starters).forEach((id: any) => {
                if (isRealPlayerId(id)) {
                    onPitchSince.set(id, 0);
                    minutesMap.set(id, 0);
                }
            });
        }

        // Initialize playing subs
        if (newLineup.usedSubstitutes && Array.isArray(newLineup.usedSubstitutes)) {
            newLineup.usedSubstitutes.forEach((id: any) => {
                if (isRealPlayerId(id)) {
                    minutesMap.set(id, 0);
                }
            });
        }

        // Sort substitutions chronologically by minute
        const sortedSubs = [...(newLineup.substitutions || [])]
            .filter(sub => sub.subId)
            .sort((a, b) => (Number(a.minute) || 60) - (Number(b.minute) || 60));

        sortedSubs.forEach(sub => {
            const subMin = Number(sub.minute) || 60;
            
            // 1. Take the replaced player off the pitch
            if (sub.replacedId && onPitchSince.has(sub.replacedId)) {
                const startedAt = onPitchSince.get(sub.replacedId)!;
                const played = Math.max(0, subMin - startedAt);
                minutesMap.set(sub.replacedId, (minutesMap.get(sub.replacedId) || 0) + played);
                onPitchSince.delete(sub.replacedId);
            }
            
            // 2. Put the sub onto the pitch
            if (isRealPlayerId(sub.subId)) {
                if (!minutesMap.has(sub.subId)) {
                    minutesMap.set(sub.subId, 0);
                }
                onPitchSince.set(sub.subId, subMin);
            }
        });

        // End of match (90th minute) - add remaining time for everyone still on pitch
        onPitchSince.forEach((startedAt, id) => {
            const played = Math.max(0, 90 - startedAt);
            minutesMap.set(id, (minutesMap.get(id) || 0) + played);
        });

        // Ensure any used sub that wasn't logged in substitutions gets a fallback of 30 mins
        if (newLineup.usedSubstitutes && Array.isArray(newLineup.usedSubstitutes)) {
            newLineup.usedSubstitutes.forEach((id: any) => {
                if (isRealPlayerId(id) && minutesMap.get(id) === 0) {
                    const hasSubRecord = newLineup.substitutions?.some(s => s.subId === id);
                    if (!hasSubRecord) {
                        minutesMap.set(id, 30);
                    }
                }
            });
        }

        // Fetch current stats for the match
        const { data: existingStats, error: fetchErr } = await supabase
            .from('match_player_stats')
            .select('*')
            .eq('match_id', matchId);

        if (fetchErr) {
            console.error("Error fetching match stats:", fetchErr);
            return;
        }

        const existingMap = new Map<string, any>();
        existingStats?.forEach(s => existingMap.set(s.player_id, s));

        // 1. Ensure rows exist for everyone in the lineup with calculated minutes & any logged match events (#10)
        for (const playerId of playerIds) {
            const mins = minutesMap.get(playerId) ?? 90;
            const existing = existingMap.get(playerId);
            const ev = newLineup.matchEvents?.[playerId];
            if (!existing) {
                const { error: insertErr } = await supabase
                    .from('match_player_stats')
                    .insert([{
                        match_id: matchId,
                        player_id: playerId,
                        goals: ev?.goals ?? 0,
                        assists: ev?.assists ?? 0,
                        minutes_played: mins,
                        yellow_cards: ev?.yellowCards ?? 0,
                        red_cards: ev?.redCards ?? 0
                    }]);
                if (insertErr) console.error("Error inserting stats row:", insertErr);
            } else {
                const updatePayload: any = { minutes_played: mins };
                if (ev) {
                    if (typeof ev.goals === "number") updatePayload.goals = ev.goals;
                    if (typeof ev.assists === "number") updatePayload.assists = ev.assists;
                    if (typeof ev.yellowCards === "number") updatePayload.yellow_cards = ev.yellowCards;
                    if (typeof ev.redCards === "number") updatePayload.red_cards = ev.redCards;
                }
                const { error: updateErr } = await supabase
                    .from('match_player_stats')
                    .update(updatePayload)
                    .eq('id', existing.id);
                if (updateErr) console.error("Error updating stats row minutes:", updateErr);
            }
        }

        // 2. Remove rows for players NOT in the lineup anymore (who have no other stats)
        for (const existing of existingStats || []) {
            if (!playerIds.has(existing.player_id)) {
                const hasStats = (existing.goals || 0) > 0 || (existing.assists || 0) > 0 || (existing.yellow_cards || 0) > 0 || (existing.red_cards || 0) > 0;
                if (!hasStats) {
                    const { error: deleteErr } = await supabase
                        .from('match_player_stats')
                        .delete()
                        .eq('id', existing.id);
                    if (deleteErr) console.error("Error deleting stats row:", deleteErr);
                }
            }
        }
    };

    const saveLineup = async (newLineup: MatchdayXI & { usedSubstitutes?: string[] }) => {
        if (!selectedMatchId) return;
        const currentMatch = matches.find(m => m.id === selectedMatchId);
        if (!currentMatch) return;

        setSaveStatus("saving");

        const starterIdSet = new Set(Object.values(newLineup.starters || {}).filter(Boolean));
        const validCaptainId = newLineup.captainId && starterIdSet.has(newLineup.captainId) ? newLineup.captainId : "";
        const validViceCaptainId = newLineup.viceCaptainId && starterIdSet.has(newLineup.viceCaptainId) ? newLineup.viceCaptainId : "";
        const validPenaltyTakerId = newLineup.penaltyTakerId && starterIdSet.has(newLineup.penaltyTakerId) ? newLineup.penaltyTakerId : "";
        const validCornerTakerId = newLineup.cornerTakerId && starterIdSet.has(newLineup.cornerTakerId) ? newLineup.cornerTakerId : "";
        const validFreeKickTakerId = newLineup.freeKickTakerId && starterIdSet.has(newLineup.freeKickTakerId) ? newLineup.freeKickTakerId : "";

        if (
            validCaptainId !== (newLineup.captainId || "") ||
            validViceCaptainId !== (newLineup.viceCaptainId || "") ||
            validPenaltyTakerId !== (newLineup.penaltyTakerId || "") ||
            validCornerTakerId !== (newLineup.cornerTakerId || "") ||
            validFreeKickTakerId !== (newLineup.freeKickTakerId || "")
        ) {
            newLineup = {
                ...newLineup,
                captainId: validCaptainId,
                viceCaptainId: validViceCaptainId,
                penaltyTakerId: validPenaltyTakerId,
                cornerTakerId: validCornerTakerId,
                freeKickTakerId: validFreeKickTakerId,
            };
            setLineup(newLineup);
        }

        const serialized = {
            formation: newLineup.formation,
            starters: newLineup.starters,
            substitutes: newLineup.substitutes,
            usedSubstitutes: newLineup.usedSubstitutes || [],
            substitutions: newLineup.substitutions || [],
            captainId: validCaptainId,
            viceCaptainId: validViceCaptainId,
            penaltyTakerId: validPenaltyTakerId,
            cornerTakerId: validCornerTakerId,
            freeKickTakerId: validFreeKickTakerId,
            tacticalNotes: newLineup.tacticalNotes || "",
            customNames: newLineup.customNames || {},
            customNumbers: newLineup.customNumbers || {},
            kitOverride: newLineup.kitOverride || "auto",
            customKitColor: newLineup.customKitColor || "",
            gkKitColor: newLineup.gkKitColor || "#10b981",
            meetOffsetMinutes: typeof newLineup.meetOffsetMinutes === "number" ? newLineup.meetOffsetMinutes : -60,
            venueNotes: newLineup.venueNotes || "",
            motmPlayerId: newLineup.motmPlayerId || "",
            matchEvents: newLineup.matchEvents || {}
        };

        const cleanNotes = stripLineupFromNotes(currentMatch.notes);
        const updatedNotes = `[Lineup: ${JSON.stringify(serialized)}]\n${cleanNotes}`.trim();

        // Update local matches state so we don't trigger re-fetch loops
        setMatches(prev => prev.map(m => m.id === selectedMatchId ? { ...m, notes: updatedNotes } : m));

        // Update database match notes
        const { error } = await supabase
            .from('matches')
            .update({ notes: updatedNotes })
            .eq('id', selectedMatchId);

        if (error) {
            console.error("Save Match Lineup Error:", error);
            setSaveStatus("draft");
            showToast("Database Error: " + error.message, "error");
            return;
        }

        // If this match has already been completed, automatically sync appearances directly to the squad page!
        if (currentMatch.result && currentMatch.result !== "Pending") {
            await syncLineupAppearancesToDatabase(selectedMatchId, newLineup);
        }

        // Also save as fallback template to matchday_xis
        const payload = {
            formation: newLineup.formation,
            starters: newLineup.starters,
            substitutes: newLineup.substitutes,
            squad: activeSquadTab,
            created_at: new Date().toISOString()
        };

        if (newLineup.id === "default-xi") {
            const { data } = await supabase.from('matchday_xis').insert([payload]).select();
            if (data && data.length > 0) {
                newLineup.id = data[0].id;
            }
        } else if (!newLineup.id.startsWith("match-lineup-")) {
            await supabase.from('matchday_xis').update(payload).eq('id', newLineup.id);
        }

        const hasStarters = Object.values(newLineup.starters || {}).some(Boolean);
        setSaveStatus(hasStarters ? "saved" : "draft");
    };

    const handleRoleChange = (field: "captainId" | "viceCaptainId" | "penaltyTakerId" | "cornerTakerId" | "freeKickTakerId", value: string) => {
        if (!lineup) return;
        const updated: MatchdayXI = {
            ...lineup,
            [field]: value,
            updatedAt: new Date().toISOString()
        };
        setLineup(updated);
        saveLineup(updated);
    };

    const handleCustomNameChange = (playerId: string, rawCustomName: string) => {
        if (!lineup || !playerId) return;
        const player = players.find(p => p.id === playerId);
        const defaultFullName = player ? formatPlayerName(player) : "";
        const defaultNick = player?.useNickname && player?.nickname?.trim() ? player.nickname.trim() : defaultFullName;
        const trimmed = rawCustomName.trim();

        const nextCustomNames = { ...(lineup.customNames || {}) };
        if (playerId.startsWith("trialist-")) {
            nextCustomNames[playerId] = trimmed || "Trialist";
        } else if (!trimmed || trimmed === defaultFullName || trimmed === defaultNick) {
            delete nextCustomNames[playerId];
        } else {
            nextCustomNames[playerId] = trimmed;
        }

        const updated: MatchdayXI = {
            ...lineup,
            customNames: nextCustomNames,
            updatedAt: new Date().toISOString()
        };
        setLineup(updated);
        saveLineup(updated);
    };

    const handleCustomNumberChange = (slotKey: string, rawVal: string, defaultNum: number) => {
        if (!lineup) return;
        const parsedNum = parseInt(rawVal.trim(), 10);
        const nextCustomNumbers = { ...(lineup.customNumbers || {}) };

        if (!rawVal.trim() || isNaN(parsedNum) || parsedNum <= 0 || parsedNum === defaultNum) {
            delete nextCustomNumbers[slotKey];
        } else {
            nextCustomNumbers[slotKey] = Math.min(99, Math.max(1, parsedNum));
        }

        const updated: MatchdayXI = {
            ...lineup,
            customNumbers: nextCustomNumbers,
            updatedAt: new Date().toISOString()
        };
        setLineup(updated);
        saveLineup(updated);
    };

    const handleResetCustomNumbers = () => {
        if (!lineup) return;
        const updated: MatchdayXI = {
            ...lineup,
            customNumbers: {},
            updatedAt: new Date().toISOString()
        };
        setLineup(updated);
        saveLineup(updated);
        setEditingNumberSlot(null);
        showToast("Shirt numbers set to 1–11 on the field", "info");
    };

    const handleTacticalNotesChange = (notes: string) => {
        if (!lineup) return;
        const updated: MatchdayXI = {
            ...lineup,
            tacticalNotes: notes,
            updatedAt: new Date().toISOString()
        };
        setLineup(updated);
        if (notesDebounceRef.current) clearTimeout(notesDebounceRef.current);
        setSaveStatus("saving");
        notesDebounceRef.current = setTimeout(() => {
            saveLineup(updated);
        }, 600);
    };

    const handleVenueNotesChange = (venueNotes: string) => {
        if (!lineup) return;
        const updated: MatchdayXI = {
            ...lineup,
            venueNotes,
            updatedAt: new Date().toISOString()
        };
        setLineup(updated);
        if (venueDebounceRef.current) clearTimeout(venueDebounceRef.current);
        setSaveStatus("saving");
        venueDebounceRef.current = setTimeout(() => {
            saveLineup(updated);
        }, 600);
    };

    const handleMeetOffsetChange = (offsetMins: number) => {
        if (!lineup) return;
        const updated: MatchdayXI = {
            ...lineup,
            meetOffsetMinutes: offsetMins,
            updatedAt: new Date().toISOString()
        };
        setLineup(updated);
        saveLineup(updated);
    };

    const handleKitChange = (kitOverride: "auto" | "home" | "away" | "custom", customKitColor?: string, gkKitColor?: string) => {
        if (!lineup) return;
        const updated: MatchdayXI = {
            ...lineup,
            kitOverride,
            customKitColor: customKitColor !== undefined ? customKitColor : lineup.customKitColor,
            gkKitColor: gkKitColor !== undefined ? gkKitColor : lineup.gkKitColor,
            updatedAt: new Date().toISOString()
        };
        setLineup(updated);
        saveLineup(updated);
    };

    const isTrialistId = (rawId?: string | null): boolean => Boolean(rawId && rawId.startsWith("trialist-"));

    const resolvePlayerOrTrialist = (rawId?: string | null): Player | null => {
        if (!rawId) return null;
        const existing = players.find(p => p.id === rawId);
        if (existing) return existing;
        if (isTrialistId(rawId)) {
            const name = lineup?.customNames?.[rawId]?.trim() || "Trialist";
            return {
                id: rawId,
                firstName: name,
                lastName: "",
                position: "MID" as Position,
                squad: activeSquadTab,
                squadNumber: 0,
                age: 0,
                nationality: "Guest",
                medicalStatus: "Available",
                contractExpiry: "",
                availability: true,
                appearances: 0,
                goals: 0,
                assists: 0
            };
        }
        return null;
    };

    const handleAddTrialistToActiveSlot = () => {
        if (!lineup || !activeSlot) return;
        const guestName = trialistInputName.trim() || "Trialist";
        const trialistId = `trialist-${Date.now()}`;
        const nextCustomNames = { ...(lineup.customNames || {}), [trialistId]: guestName };
        const nextCustomNumbers = { ...(lineup.customNumbers || {}) };
        const slotKey = `${activeSlot.type}-${activeSlot.index}`;
        const parsedNum = parseInt(trialistInputNumber.trim(), 10);
        if (!isNaN(parsedNum) && parsedNum >= 1 && parsedNum <= 99) {
            nextCustomNumbers[slotKey] = parsedNum;
        }

        const newStarters = { ...lineup.starters };
        const newSubs = [...lineup.substitutes];
        if (activeSlot.type === "pitch") {
            newStarters[activeSlot.index] = trialistId;
        } else {
            newSubs[activeSlot.index] = trialistId;
        }

        const updated: MatchdayXI = {
            ...lineup,
            starters: newStarters,
            substitutes: newSubs,
            customNames: nextCustomNames,
            customNumbers: nextCustomNumbers,
            updatedAt: new Date().toISOString()
        };
        setLineup(updated);
        saveLineup(updated);
        setTrialistInputName("");
        setTrialistInputNumber("");
        setShowTrialistForm(false);
        setActiveSlot(null);
        showToast(`Added ${guestName} as a Guest / Trialist`);
    };

    const handleSwapSlots = (
        targetOrType: { type: "pitch" | "sub"; index: number; label?: string } | "pitch" | "sub",
        maybeIdx?: number
    ) => {
        if (!lineup || !activeSlot) return;
        const targetType = typeof targetOrType === "object" ? targetOrType.type : targetOrType;
        const targetIdx = typeof targetOrType === "object" ? targetOrType.index : (maybeIdx ?? 0);
        if (activeSlot.type === targetType && activeSlot.index === targetIdx) return;

        const newStarters = { ...lineup.starters };
        const newSubs = [...lineup.substitutes];

        const sourceId = activeSlot.type === "pitch"
            ? (newStarters[activeSlot.index] || "")
            : (newSubs[activeSlot.index] || "");
        const targetId = targetType === "pitch"
            ? (newStarters[targetIdx] || "")
            : (newSubs[targetIdx] || "");

        if (activeSlot.type === "pitch") {
            if (targetId) newStarters[activeSlot.index] = targetId;
            else delete newStarters[activeSlot.index];
        } else {
            newSubs[activeSlot.index] = targetId;
        }

        if (targetType === "pitch") {
            if (sourceId) newStarters[targetIdx] = sourceId;
            else delete newStarters[targetIdx];
        } else {
            newSubs[targetIdx] = sourceId;
        }

        const updated: MatchdayXI = {
            ...lineup,
            starters: newStarters,
            substitutes: newSubs,
            updatedAt: new Date().toISOString()
        };
        setLineup(updated);
        saveLineup(updated);
        setActiveSlot(null);
        showToast("Swapped players");
    };

    const getPlayerMatchEventStats = (playerId: string): Required<MatchdayPlayerEventStats> => {
        const fromLineup = lineup?.matchEvents?.[playerId];
        const fromDb = currentMatchStatsMap[playerId];
        return {
            goals: fromLineup?.goals ?? fromDb?.goals ?? 0,
            assists: fromLineup?.assists ?? fromDb?.assists ?? 0,
            yellowCards: fromLineup?.yellowCards ?? fromDb?.yellowCards ?? 0,
            redCards: fromLineup?.redCards ?? fromDb?.redCards ?? 0,
        };
    };

    const handleMatchEventStatChange = async (
        playerId: string,
        field: keyof MatchdayPlayerEventStats,
        delta: number
    ) => {
        if (!lineup || !playerId) return;
        const current = getPlayerMatchEventStats(playerId);
        const maxVal = field === "redCards" ? 1 : field === "yellowCards" ? 2 : 20;
        const nextVal = Math.min(maxVal, Math.max(0, (current[field] || 0) + delta));

        const nextEventsForPlayer: Required<MatchdayPlayerEventStats> = {
            ...current,
            [field]: nextVal
        };

        const nextMatchEvents = {
            ...(lineup.matchEvents || {}),
            [playerId]: nextEventsForPlayer
        };

        setCurrentMatchStatsMap(prev => ({
            ...prev,
            [playerId]: nextEventsForPlayer
        }));

        const updated: MatchdayXI = {
            ...lineup,
            matchEvents: nextMatchEvents,
            updatedAt: new Date().toISOString()
        };
        setLineup(updated);
        await saveLineup(updated);

        // Also sync directly to match_player_stats in Supabase if it's a real squad player (#10)
        if (selectedMatchId && !playerId.startsWith("trialist-")) {
            try {
                const { data: existingRows } = await supabase
                    .from('match_player_stats')
                    .select('id')
                    .eq('match_id', selectedMatchId)
                    .eq('player_id', playerId)
                    .limit(1);

                const payload = {
                    goals: nextEventsForPlayer.goals,
                    assists: nextEventsForPlayer.assists,
                    yellow_cards: nextEventsForPlayer.yellowCards,
                    red_cards: nextEventsForPlayer.redCards
                };

                if (existingRows && existingRows.length > 0) {
                    await supabase
                        .from('match_player_stats')
                        .update(payload)
                        .eq('id', existingRows[0].id);
                } else {
                    await supabase
                        .from('match_player_stats')
                        .insert([{
                            match_id: selectedMatchId,
                            player_id: playerId,
                            minutes_played: 90,
                            ...payload
                        }]);
                }
                fetchSeasonStats();
            } catch (err) {
                console.warn("Error syncing match event stat:", err);
            }
        }
    };

    const handleMotmToggle = (playerId: string) => {
        if (!lineup || !playerId) return;
        const nextMotm = lineup.motmPlayerId === playerId ? "" : playerId;
        const updated: MatchdayXI = {
            ...lineup,
            motmPlayerId: nextMotm,
            updatedAt: new Date().toISOString()
        };
        setLineup(updated);
        saveLineup(updated);
        const p = resolvePlayerOrTrialist(playerId);
        showToast(nextMotm ? `⭐ ${p ? getMatchdayDisplayName(p) : "Player"} set as Man of the Match!` : "MOTM cleared", "info");
    };

    const handleSubDetailChange = (subId: string, replacedId: string, minute: number) => {
        if (!lineup) return;
        const currentSubs = lineup.substitutions || [];
        const filtered = currentSubs.filter(s => s.subId !== subId);
        
        let updatedSubs = filtered;
        if (replacedId || minute) {
            updatedSubs = [...filtered, { subId, replacedId, minute }];
        }
        
        const updated = {
            ...lineup,
            substitutions: updatedSubs,
            updatedAt: new Date().toISOString()
        };
        setLineup(updated);
        saveLineup(updated);
    };

    const handleFormationChange = (newFormation: string) => {
        if (lineup) {
            const updated = {
                ...lineup,
                formation: newFormation,
                starters: lineup.starters,
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
        const cleared: MatchdayXI = {
            ...lineup,
            starters: {},
            substitutes: Array(lineup.substitutes.length).fill(""),
            usedSubstitutes: [],
            substitutions: [],
            updatedAt: new Date().toISOString()
        };
        setLineup(cleared);
        saveLineup(cleared);
        showToast("Pitch and bench cleared", "info");
    };

    const handleAutoFillLastLineup = async () => {
        if (!lineup) return;
        try {
            const formerIds = new Set(players.filter(p => isFormerPlayer(p)).map(p => p.id));

            // 1. First look through previous matches (sorted newest first, excluding current match) for a saved [Lineup: ...]
            const currentMatchObj = matches.find(m => m.id === selectedMatchId);
            const sortedOtherMatches = [...matches]
                .filter(m => m.id !== selectedMatchId)
                .sort((a, b) => {
                    if (currentMatchObj) {
                        const aBefore = a.date <= currentMatchObj.date ? 0 : 1;
                        const bBefore = b.date <= currentMatchObj.date ? 0 : 1;
                        if (aBefore !== bBefore) return aBefore - bBefore;
                    }
                    return b.date.localeCompare(a.date);
                });

            let sourceLineup: any = null;
            let sourceLabel = "previous match";

            for (const m of sortedOtherMatches) {
                const parsed = parseLineupFromNotes(m.notes);
                if (parsed && parsed.starters && Object.values(parsed.starters).some(Boolean)) {
                    sourceLineup = parsed;
                    sourceLabel = `vs ${m.opponent} (${new Date(m.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })})`;
                    break;
                }
            }

            // 2. Fallback to matchday_xis table if no match had a saved lineup
            if (!sourceLineup) {
                const { data, error } = await supabase
                    .from('matchday_xis')
                    .select('*')
                    .order('created_at', { ascending: false })
                    .limit(2);

                if (error) throw error;

                let lastRow = data?.[0];
                if (lastRow && lastRow.id === lineup.id) {
                    lastRow = data?.[1];
                }
                if (lastRow && lastRow.starters && Object.values(lastRow.starters).some(Boolean)) {
                    sourceLineup = lastRow;
                    sourceLabel = "saved template";
                }
            }

            if (!sourceLineup) {
                showToast("No previous match lineups found to auto-fill", "info");
                return;
            }

            const cleanedStarters: Record<number, string> = {};
            Object.entries(sourceLineup.starters || {}).forEach(([slotIdx, pid]) => {
                if (pid && !formerIds.has(String(pid))) {
                    cleanedStarters[Number(slotIdx)] = String(pid);
                }
            });
            const cleanedSubs = (sourceLineup.substitutes || ["", "", "", "", ""]).map((pid: string) =>
                pid && !formerIds.has(pid) ? pid : ""
            );

            const updated: MatchdayXI = {
                ...lineup,
                formation: sourceLineup.formation || lineup.formation,
                starters: cleanedStarters,
                substitutes: cleanedSubs.length > 0 ? cleanedSubs : ["", "", "", "", ""],
                captainId: sourceLineup.captainId && !formerIds.has(sourceLineup.captainId) ? sourceLineup.captainId : lineup.captainId,
                viceCaptainId: sourceLineup.viceCaptainId && !formerIds.has(sourceLineup.viceCaptainId) ? sourceLineup.viceCaptainId : lineup.viceCaptainId,
                penaltyTakerId: sourceLineup.penaltyTakerId && !formerIds.has(sourceLineup.penaltyTakerId) ? sourceLineup.penaltyTakerId : lineup.penaltyTakerId,
                cornerTakerId: sourceLineup.cornerTakerId && !formerIds.has(sourceLineup.cornerTakerId) ? sourceLineup.cornerTakerId : lineup.cornerTakerId,
                freeKickTakerId: sourceLineup.freeKickTakerId && !formerIds.has(sourceLineup.freeKickTakerId) ? sourceLineup.freeKickTakerId : lineup.freeKickTakerId,
                updatedAt: new Date().toISOString()
            };
            setLineup(updated);
            await saveLineup(updated);
            showToast(`Copied XI (${updated.formation}) from ${sourceLabel}`);
        } catch (err: any) {
            showToast("Error auto-filling lineup: " + err.message, "error");
        }
    };

    const handleAutoPickXI = async () => {
        if (!lineup) return;
        const currentFormation = FORMATIONS[lineup.formation];
        if (!currentFormation) return;

        const usedIds = new Set<string>([
            ...Object.values(lineup.starters).filter(Boolean),
            ...lineup.substitutes.filter(Boolean)
        ]);

        const pool = players.filter(p => !usedIds.has(p.id) && isPlayerAvailable(p) && isPlayerInMatchdayTracker(p));
        if (pool.length === 0) {
            showToast("No additional available players to auto-pick", "info");
            return;
        }

        const newStarters = { ...lineup.starters };
        let filledCount = 0;

        currentFormation.forEach((slot, idx) => {
            if (newStarters[idx]) return;
            const slotCat = getPositionCategory(slot.label);
            let bestPlayer: Player | null = null;
            let bestScore = -1;

            for (const candidate of pool) {
                if (usedIds.has(candidate.id)) continue;
                let score = 0;
                if (isIdealPosition(candidate.position, slot.label)) score = 30;
                else if (candidate.secondaryPositions?.some(pos => isIdealPosition(pos, slot.label))) score = 20;
                else if (getPositionCategory(candidate.position) === slotCat) score = 10;
                else if (candidate.secondaryPositions?.some(pos => getPositionCategory(pos) === slotCat)) score = 8;
                else if (slot.label.toUpperCase() !== "GK" && candidate.position.toUpperCase() !== "GK") score = 1;

                if (score > bestScore) {
                    bestScore = score;
                    bestPlayer = candidate;
                }
            }

            if (bestPlayer && bestScore > 0) {
                newStarters[idx] = bestPlayer.id;
                usedIds.add(bestPlayer.id);
                filledCount++;
            }
        });

        if (filledCount === 0) {
            showToast("All Starting XI slots are already filled", "info");
            return;
        }

        const updated: MatchdayXI = {
            ...lineup,
            starters: newStarters,
            updatedAt: new Date().toISOString()
        };
        setLineup(updated);
        await saveLineup(updated);
        showToast(`Auto-picked ${filledCount} player${filledCount > 1 ? "s" : ""} into Starting XI`);
    };

    const handleAutoFillBench = async () => {
        if (!lineup) return;
        const usedIds = new Set<string>([
            ...Object.values(lineup.starters).filter(Boolean),
            ...lineup.substitutes.filter(Boolean)
        ]);
        const pool = players.filter(p => !usedIds.has(p.id) && isPlayerAvailable(p) && isPlayerInMatchdayTracker(p));
        if (pool.length === 0) {
            showToast("No additional available players to fill the bench", "info");
            return;
        }

        const newSubs = [...lineup.substitutes];
        let added = 0;

        // Fill existing empty bench slots first
        for (let i = 0; i < newSubs.length; i++) {
            if (!newSubs[i] && pool.length > added) {
                newSubs[i] = pool[added].id;
                added++;
            }
        }

        // If all bench slots were already full and more players are available (up to 7 subs total), add up to remaining pool
        while (newSubs.length < 7 && added < pool.length) {
            newSubs.push(pool[added].id);
            added++;
        }

        if (added === 0) {
            showToast("Bench is already full", "info");
            return;
        }

        const updated: MatchdayXI = {
            ...lineup,
            substitutes: newSubs,
            updatedAt: new Date().toISOString()
        };
        setLineup(updated);
        await saveLineup(updated);
        showToast(`Filled bench with ${added} available player${added > 1 ? "s" : ""}`);
    };

    const handleClearBench = async () => {
        if (!lineup) return;
        const hasAny = lineup.substitutes.some(Boolean);
        if (!hasAny) {
            showToast("Bench is already empty", "info");
            return;
        }
        const updated: MatchdayXI = {
            ...lineup,
            substitutes: Array(Math.max(5, lineup.substitutes.length)).fill(""),
            usedSubstitutes: [],
            substitutions: [],
            updatedAt: new Date().toISOString()
        };
        setLineup(updated);
        await saveLineup(updated);
        showToast("Cleared bench", "info");
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

    const getPitchPlayerDisplayName = (player: Player | null | undefined) => {
        if (!player) return "";
        const customName = lineup?.customNames?.[player.id]?.trim();
        if (customName) return customName;
        if (player.id.startsWith("trialist-")) return player.firstName || "Trialist";
        if (player.useNickname && player.nickname && player.nickname.trim().length > 0) {
            return player.nickname.trim();
        }
        const fullName = formatPlayerName(player);
        if (fullName.length > 12 && player.firstName?.trim() && player.lastName?.trim()) {
            return `${player.firstName.trim().charAt(0)}. ${player.lastName.trim()}`;
        }
        return fullName;
    };

    const getMatchdayDisplayName = (player: Player | null | undefined) => {
        if (!player) return "";
        const customName = lineup?.customNames?.[player.id]?.trim();
        if (customName) return customName;
        if (player.id.startsWith("trialist-")) return player.firstName || "Trialist";
        return formatPlayerName(player);
    };

    const getSlotDisplayNumber = (type: "pitch" | "sub", idx: number, defaultNum: number, player?: Player | null): number => {
        const slotCustom = lineup?.customNumbers?.[`${type}-${idx}`];
        if (slotCustom && slotCustom > 0) return slotCustom;
        if (player?.id && lineup?.customNumbers?.[player.id] && lineup.customNumbers[player.id] > 0) {
            return lineup.customNumbers[player.id];
        }
        return defaultNum;
    };

    const getEffectiveOutfieldKitColor = (): string => {
        const mode = lineup?.kitOverride || "auto";
        if (mode === "home") return settings.homeKitShirt || "#dc2626";
        if (mode === "away") return settings.awayKitShirt || "#0f172a";
        if (mode === "custom" && lineup?.customKitColor) return lineup.customKitColor;
        return (nextMatch && !nextMatch.isHome)
            ? (settings.awayKitShirt || "#000000")
            : (settings.homeKitShirt || "#ffffff");
    };

    const getEffectiveGkKitColor = (): string => {
        return lineup?.gkKitColor || "#10b981";
    };

    const getContrastTextColor = (bgColor: string): string => {
        const hex = (bgColor || "").replace("#", "").trim();
        const fullHex = hex.length === 3 ? hex.split("").map(c => c + c).join("") : hex;
        if (fullHex.length !== 6) return "#ffffff";
        const r = parseInt(fullHex.substr(0, 2), 16);
        const g = parseInt(fullHex.substr(2, 2), 16);
        const b = parseInt(fullHex.substr(4, 2), 16);
        if (isNaN(r) || isNaN(g) || isNaN(b)) return "#ffffff";
        const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
        return yiq >= 145 ? "#000000" : "#ffffff";
    };

    const getFormattedMeetTime = (): string => {
        if (!nextMatch || !nextMatch.time) return "TBD";
        const offset = typeof lineup?.meetOffsetMinutes === "number" ? lineup.meetOffsetMinutes : -60;
        return calculateMeetTime(nextMatch.time, offset);
    };

    const handleDownloadPitchGraphic = () => {
        if (!lineup) return;
        try {
            const canvas = document.createElement("canvas");
            const W = 1200;
            const H = 1520;
            canvas.width = W;
            canvas.height = H;
            const ctx = canvas.getContext("2d");
            if (!ctx) return;

            const currentFormation = FORMATIONS[lineup.formation] || [];
            const outfieldColor = getEffectiveOutfieldKitColor();
            const gkColor = getEffectiveGkKitColor();
            const meetTimeStr = getFormattedMeetTime();
            const venueLabel = lineup.venueNotes?.trim()
                ? lineup.venueNotes.trim()
                : nextMatch
                    ? (nextMatch.isHome ? (settings.homeGround || "Home") : "Away")
                    : "TBD";

            // 1. Background
            const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
            bgGrad.addColorStop(0, "#090d16");
            bgGrad.addColorStop(1, "#111827");
            ctx.fillStyle = bgGrad;
            ctx.fillRect(0, 0, W, H);

            // Top Accent Bar
            ctx.fillStyle = settings.primaryColor || "#dc2626";
            ctx.fillRect(0, 0, W, 12);

            // 2. Header Text
            ctx.fillStyle = "#94a3b8";
            ctx.font = "bold 20px -apple-system, BlinkMacSystemFont, Segoe UI, Arial, sans-serif";
            ctx.textAlign = "center";
            const compText = nextMatch
                ? `${(nextMatch.competition || "MATCHDAY").toUpperCase()} • ${new Date(nextMatch.date).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" }).toUpperCase()}`
                : "MATCHDAY STARTING XI";
            ctx.fillText(compText, W / 2, 56);

            ctx.fillStyle = "#ffffff";
            ctx.font = "900 44px -apple-system, BlinkMacSystemFont, Segoe UI, Arial, sans-serif";
            const fixtureTitle = nextMatch
                ? `${settings.name.toUpperCase()} vs ${nextMatch.opponent.toUpperCase()}`
                : `${settings.name.toUpperCase()} — ${activeSquadTab.toUpperCase()}`;
            ctx.fillText(fixtureTitle, W / 2, 108);

            ctx.fillStyle = "#cbd5e1";
            ctx.font = "bold 20px -apple-system, BlinkMacSystemFont, Segoe UI, Arial, sans-serif";
            const metaLine = nextMatch
                ? `KO: ${nextMatch.time || "TBD"}   •   MEET: ${meetTimeStr}   •   VENUE: ${venueLabel}   •   FORMATION: ${lineup.formation}`
                : `FORMATION: ${lineup.formation}`;
            ctx.fillText(metaLine, W / 2, 144);

            // 3. Pitch Box
            const pitchX = 90;
            const pitchY = 175;
            const pitchW = W - 180;
            const pitchH = 1020;

            // Pitch turf stripes
            const stripeCount = 10;
            const stripeH = pitchH / stripeCount;
            for (let i = 0; i < stripeCount; i++) {
                ctx.fillStyle = i % 2 === 0 ? "#2b7c3d" : "#256e35";
                ctx.fillRect(pitchX, pitchY + i * stripeH, pitchW, stripeH);
            }

            // Pitch border & lines
            ctx.strokeStyle = "rgba(255,255,255,0.55)";
            ctx.lineWidth = 4;
            ctx.strokeRect(pitchX + 24, pitchY + 24, pitchW - 48, pitchH - 48);

            // Halfway line & center circle
            const midY = pitchY + pitchH / 2;
            ctx.beginPath();
            ctx.moveTo(pitchX + 24, midY);
            ctx.lineTo(pitchX + pitchW - 24, midY);
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(pitchX + pitchW / 2, midY, 85, 0, Math.PI * 2);
            ctx.stroke();

            // Penalty boxes
            const boxW = 320;
            const boxH = 135;
            ctx.strokeRect(pitchX + (pitchW - boxW) / 2, pitchY + 24, boxW, boxH);
            ctx.strokeRect(pitchX + (pitchW - boxW) / 2, pitchY + pitchH - 24 - boxH, boxW, boxH);

            // 4. Draw Players on Pitch
            currentFormation.forEach((pos, idx) => {
                const pid = lineup.starters[idx];
                const playerObj = resolvePlayerOrTrialist(pid);
                const pName = playerObj ? getPitchPlayerDisplayName(playerObj) : pos.label;
                const shirtNum = getSlotDisplayNumber("pitch", idx, pos.number, playerObj);
                const isGK = pos.label.toUpperCase() === "GK" || idx === 0;
                const fillCol = isGK ? gkColor : outfieldColor;
                const txtCol = getContrastTextColor(fillCol);
                const isCapt = Boolean(pid && lineup.captainId === pid);

                const cx = pitchX + (pos.x / 100) * pitchW;
                const cy = pitchY + (pos.y / 100) * pitchH;

                // Circle Jersey Badge
                ctx.save();
                ctx.beginPath();
                ctx.arc(cx, cy - 10, 32, 0, Math.PI * 2);
                ctx.fillStyle = fillCol;
                ctx.fill();
                ctx.lineWidth = 4;
                ctx.strokeStyle = "#ffffff";
                ctx.stroke();
                ctx.restore();

                // Shirt Number
                ctx.fillStyle = txtCol;
                ctx.font = "900 26px -apple-system, BlinkMacSystemFont, Segoe UI, Arial, sans-serif";
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText(String(shirtNum), cx, cy - 9);

                // Captain Badge
                if (isCapt) {
                    ctx.beginPath();
                    ctx.arc(cx - 24, cy - 34, 13, 0, Math.PI * 2);
                    ctx.fillStyle = "#f59e0b";
                    ctx.fill();
                    ctx.lineWidth = 2;
                    ctx.strokeStyle = "#ffffff";
                    ctx.stroke();
                    ctx.fillStyle = "#000000";
                    ctx.font = "900 13px -apple-system, BlinkMacSystemFont, Segoe UI, Arial, sans-serif";
                    ctx.fillText("C", cx - 24, cy - 33);
                }

                // Name Pill
                ctx.font = "bold 20px -apple-system, BlinkMacSystemFont, Segoe UI, Arial, sans-serif";
                const textW = Math.max(90, ctx.measureText(pName).width + 28);
                const pillX = cx - textW / 2;
                const pillY = cy + 28;
                const pillH = 34;

                ctx.fillStyle = "rgba(15, 23, 42, 0.92)";
                ctx.beginPath();
                ctx.roundRect(pillX, pillY, textW, pillH, 17);
                ctx.fill();
                ctx.lineWidth = 1.5;
                ctx.strokeStyle = "rgba(255,255,255,0.25)";
                ctx.stroke();

                ctx.fillStyle = "#ffffff";
                ctx.textBaseline = "middle";
                ctx.fillText(pName, cx, pillY + pillH / 2 + 1);
            });

            // 5. Footer Bench & Roles Bar
            const footerY = pitchY + pitchH + 30;
            ctx.fillStyle = "#1e293b";
            ctx.beginPath();
            ctx.roundRect(pitchX, footerY, pitchW, 250, 18);
            ctx.fill();

            ctx.fillStyle = "#f59e0b";
            ctx.font = "900 20px -apple-system, BlinkMacSystemFont, Segoe UI, Arial, sans-serif";
            ctx.textAlign = "left";
            ctx.fillText("BENCH / SUBSTITUTES", pitchX + 28, footerY + 40);

            const activeSubs = lineup.substitutes
                .map((subId, sIdx) => ({ subId, sIdx, player: resolvePlayerOrTrialist(subId) }))
                .filter(item => Boolean(item.player));

            ctx.fillStyle = "#f8fafc";
            ctx.font = "bold 21px -apple-system, BlinkMacSystemFont, Segoe UI, Arial, sans-serif";
            if (activeSubs.length > 0) {
                const subStrings = activeSubs.map(({ sIdx, player }) => {
                    const num = getSlotDisplayNumber("sub", sIdx, 12 + sIdx, player);
                    return `#${num} ${getMatchdayDisplayName(player)}`;
                });
                ctx.fillText(subStrings.join("    •    "), pitchX + 28, footerY + 82, pitchW - 56);
            } else {
                ctx.fillStyle = "#94a3b8";
                ctx.fillText("No substitutes assigned", pitchX + 28, footerY + 82);
            }

            // Roles row in footer
            const roleItems: string[] = [];
            if (lineup.captainId) {
                const c = resolvePlayerOrTrialist(lineup.captainId);
                if (c) roleLinesPush(roleItems, `Captain: ${getMatchdayDisplayName(c)}`);
            }
            if (lineup.viceCaptainId) {
                const vc = resolvePlayerOrTrialist(lineup.viceCaptainId);
                if (vc) roleLinesPush(roleItems, `Vice-Captain: ${getMatchdayDisplayName(vc)}`);
            }
            if (lineup.penaltyTakerId) {
                const p = resolvePlayerOrTrialist(lineup.penaltyTakerId);
                if (p) roleLinesPush(roleItems, `Penalties: ${getMatchdayDisplayName(p)}`);
            }
            if (lineup.cornerTakerId) {
                const cr = resolvePlayerOrTrialist(lineup.cornerTakerId);
                if (cr) roleLinesPush(roleItems, `Corners: ${getMatchdayDisplayName(cr)}`);
            }
            if (lineup.freeKickTakerId) {
                const fk = resolvePlayerOrTrialist(lineup.freeKickTakerId);
                if (fk) roleLinesPush(roleItems, `Free Kicks: ${getMatchdayDisplayName(fk)}`);
            }

            function roleLinesPush(arr: string[], item: string) {
                arr.push(item);
            }

            if (roleItems.length > 0) {
                ctx.fillStyle = "#94a3b8";
                ctx.font = "bold 18px -apple-system, BlinkMacSystemFont, Segoe UI, Arial, sans-serif";
                ctx.fillText(roleItems.join("   |   "), pitchX + 28, footerY + 145, pitchW - 56);
            }

            if (lineup.tacticalNotes?.trim()) {
                ctx.fillStyle = "#cbd5e1";
                ctx.font = "italic 18px -apple-system, BlinkMacSystemFont, Segoe UI, Arial, sans-serif";
                const singleLineNotes = lineup.tacticalNotes.trim().replace(/\s+/g, " ");
                ctx.fillText(`Notes: ${singleLineNotes}`, pitchX + 28, footerY + 195, pitchW - 56);
            }

            const link = document.createElement("a");
            const slug = nextMatch
                ? `vs-${nextMatch.opponent.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`
                : "starting-xi";
            link.download = `${settings.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${slug}.png`;
            link.href = canvas.toDataURL("image/png");
            link.click();
            showToast("Pitch Graphic PNG downloaded!");
        } catch (err: any) {
            console.error("Error exporting graphic:", err);
            showToast("Could not generate image: " + err.message, "error");
        }
    };

    const handleExportPDF = () => {
        if (!lineup) return;

        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        const formation = FORMATIONS[lineup.formation];
        const kitColor = getEffectiveOutfieldKitColor();
        const gkColor = getEffectiveGkKitColor();

        const getPlayerName = (playerId?: string) => {
            if (!playerId) return 'TBD';
            const player = resolvePlayerOrTrialist(playerId);
            if (!player) return 'TBD';
            return getMatchdayDisplayName(player);
        };

        const captainName = lineup.captainId ? getPlayerName(lineup.captainId) : "";
        const viceCaptainName = lineup.viceCaptainId ? getPlayerName(lineup.viceCaptainId) : "";
        const penName = lineup.penaltyTakerId ? getPlayerName(lineup.penaltyTakerId) : "";
        const cornerName = lineup.cornerTakerId ? getPlayerName(lineup.cornerTakerId) : "";
        const fkName = lineup.freeKickTakerId ? getPlayerName(lineup.freeKickTakerId) : "";
        const meetTime = getFormattedMeetTime();
        const venueDisplay = lineup.venueNotes?.trim()
            ? lineup.venueNotes.trim()
            : (nextMatch ? (nextMatch.isHome ? (settings.homeGround || 'Home') : 'Away') : 'TBD');

        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>${settings.name} - Matchday Team Sheet</title>
                <style>
                    * { box-sizing: border-box; }
                    body {
                        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
                        padding: 28px 36px;
                        max-width: 860px;
                        margin: 0 auto;
                        color: #0f172a;
                    }
                    .header {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        margin-bottom: 16px;
                        border-bottom: 3px solid #dc2626;
                        padding-bottom: 12px;
                    }
                    .header h1 {
                        color: #0f172a;
                        font-size: 22px;
                        margin: 0 0 4px 0;
                    }
                    .header .subtitle {
                        font-size: 13px;
                        color: #475569;
                        font-weight: 600;
                    }
                    .logo {
                        height: 56px;
                        width: auto;
                        object-fit: contain;
                    }
                    .meta-grid {
                        display: grid;
                        grid-template-columns: repeat(4, 1fr);
                        gap: 10px;
                        background: #f8fafc;
                        padding: 12px 16px;
                        border-radius: 10px;
                        border: 1px solid #e2e8f0;
                        margin-bottom: 18px;
                        font-size: 12px;
                    }
                    .meta-item span {
                        display: block;
                        font-size: 10px;
                        text-transform: uppercase;
                        color: #64748b;
                        font-weight: 700;
                        margin-bottom: 2px;
                    }
                    .meta-item strong {
                        font-size: 13px;
                        color: #0f172a;
                    }
                    .main-grid {
                        display: grid;
                        grid-template-columns: 1.35fr 1fr;
                        gap: 20px;
                        align-items: start;
                    }
                    .formation {
                        background: #2b7c3d;
                        border-radius: 12px;
                        position: relative;
                        height: 440px;
                        border: 2px solid #1e293b;
                        overflow: hidden;
                    }
                    .pitch-outline {
                        position: absolute;
                        inset: 10px;
                        border: 2px solid rgba(255,255,255,0.45);
                        pointer-events: none;
                    }
                    .pitch-half {
                        position: absolute;
                        left: 10px;
                        right: 10px;
                        top: 50%;
                        border-top: 2px solid rgba(255,255,255,0.45);
                    }
                    .pitch-circle {
                        position: absolute;
                        left: 50%;
                        top: 50%;
                        width: 64px;
                        height: 64px;
                        border: 2px solid rgba(255,255,255,0.45);
                        border-radius: 50%;
                        transform: translate(-50%, -50%);
                    }
                    .pitch-box-top {
                        position: absolute;
                        left: 50%;
                        top: 10px;
                        width: 110px;
                        height: 48px;
                        border: 2px solid rgba(255,255,255,0.45);
                        border-top: none;
                        transform: translateX(-50%);
                    }
                    .pitch-box-bottom {
                        position: absolute;
                        left: 50%;
                        bottom: 10px;
                        width: 110px;
                        height: 48px;
                        border: 2px solid rgba(255,255,255,0.45);
                        border-bottom: none;
                        transform: translateX(-50%);
                    }
                    .player {
                        position: absolute;
                        background: ${kitColor};
                        color: ${getContrastTextColor(kitColor)};
                        border: 2px solid #ffffff;
                        border-radius: 50%;
                        width: 32px;
                        height: 32px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-weight: 800;
                        font-size: 11px;
                        transform: translate(-50%, -50%);
                        box-shadow: 0 2px 4px rgba(0,0,0,0.35);
                    }
                    .player.gk {
                        background: ${gkColor};
                        color: ${getContrastTextColor(gkColor)};
                    }
                    .captain-badge {
                        position: absolute;
                        top: -5px;
                        right: -6px;
                        background: #f59e0b;
                        color: #000;
                        font-size: 8px;
                        font-weight: 900;
                        width: 14px;
                        height: 14px;
                        border-radius: 50%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        border: 1px solid #fff;
                    }
                    .player-name {
                        position: absolute;
                        font-size: 10px;
                        font-weight: 700;
                        color: #0f172a;
                        background: rgba(255,255,255,0.95);
                        padding: 2px 7px;
                        border-radius: 10px;
                        transform: translate(-50%, 18px);
                        white-space: nowrap;
                        box-shadow: 0 1px 3px rgba(0,0,0,0.25);
                    }
                    .panel {
                        background: #f8fafc;
                        border: 1px solid #e2e8f0;
                        border-radius: 10px;
                        padding: 12px 14px;
                        margin-bottom: 12px;
                    }
                    .panel h3 {
                        margin: 0 0 8px 0;
                        font-size: 12px;
                        text-transform: uppercase;
                        letter-spacing: 0.05em;
                        color: #dc2626;
                        border-bottom: 1px solid #e2e8f0;
                        padding-bottom: 5px;
                    }
                    .list {
                        list-style: none;
                        padding: 0;
                        margin: 0;
                        font-size: 12px;
                    }
                    .list li {
                        padding: 4px 0;
                        border-bottom: 1px dashed #e2e8f0;
                        display: flex;
                        justify-content: space-between;
                    }
                    .list li:last-child { border-bottom: none; }
                    .notes-box {
                        font-size: 12px;
                        white-space: pre-wrap;
                        line-height: 1.45;
                        color: #334155;
                    }
                    @media print {
                        body { padding: 12px; }
                        .formation, .player, .captain-badge { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <div>
                        <h1>${settings.name} — Matchday Team Sheet</h1>
                        <div class="subtitle">${nextMatch ? `${nextMatch.isHome ? 'Home' : 'Away'} vs ${nextMatch.opponent} • ${nextMatch.competition || 'Match'}` : activeSquadTab}</div>
                    </div>
                    ${settings.logo ? `<img src="${settings.logo}" class="logo" />` : ''}
                </div>
                
                <div class="meta-grid">
                    <div class="meta-item">
                        <span>Date & Kick-Off</span>
                        <strong>${nextMatch ? `${new Date(nextMatch.date).toLocaleDateString('en-GB')} @ ${nextMatch.time}` : new Date().toLocaleDateString('en-GB')}</strong>
                    </div>
                    <div class="meta-item">
                        <span>Meet Time & Venue</span>
                        <strong>${meetTime} (${venueDisplay})</strong>
                    </div>
                    <div class="meta-item">
                        <span>Formation</span>
                        <strong>${lineup.formation}</strong>
                    </div>
                    <div class="meta-item">
                        <span>Captain</span>
                        <strong>${captainName || 'TBD'}${viceCaptainName ? ` (VC: ${viceCaptainName})` : ''}</strong>
                    </div>
                </div>
                
                <div class="main-grid">
                    <div class="formation">
                        <div class="pitch-outline"></div>
                        <div class="pitch-half"></div>
                        <div class="pitch-circle"></div>
                        <div class="pitch-box-top"></div>
                        <div class="pitch-box-bottom"></div>
                        ${formation.map((pos, idx) => {
                            const playerId = lineup.starters[idx];
                            const playerObj = resolvePlayerOrTrialist(playerId);
                            const playerName = playerObj ? getPitchPlayerDisplayName(playerObj) : pos.label;
                            const shirtNum = getSlotDisplayNumber("pitch", idx, pos.number, playerObj);
                            const isCapt = Boolean(playerId && lineup.captainId === playerId);
                            const isGK = pos.label.toUpperCase() === "GK" || idx === 0;
                            return `
                                <div class="player ${isGK ? 'gk' : ''}" style="left: ${pos.x}%; top: ${pos.y}%;">
                                    ${shirtNum}
                                    ${isCapt ? `<span class="captain-badge">C</span>` : ''}
                                </div>
                                <div class="player-name" style="left: ${pos.x}%; top: ${pos.y}%;">
                                    ${playerName}
                                </div>
                            `;
                        }).join('')}
                    </div>

                    <div>
                        <div class="panel">
                            <h3>Starting XI</h3>
                            <ul class="list">
                                ${formation.map((pos, idx) => {
                                    const pid = lineup.starters[idx];
                                    const pObj = resolvePlayerOrTrialist(pid);
                                    const num = getSlotDisplayNumber("pitch", idx, pos.number, pObj);
                                    const isCapt = Boolean(pid && lineup.captainId === pid);
                                    const isVC = Boolean(pid && lineup.viceCaptainId === pid);
                                    return `<li><span><strong>#${num}</strong> ${pObj ? getMatchdayDisplayName(pObj) : 'TBD'} ${isCapt ? '<strong>(C)</strong>' : isVC ? '(VC)' : ''}</span><span style="color:#64748b;font-weight:600">${pos.label}</span></li>`;
                                }).join('')}
                            </ul>
                        </div>

                        <div class="panel">
                            <h3>Substitutes</h3>
                            <ul class="list">
                                ${lineup.substitutes.filter(Boolean).length > 0 ? lineup.substitutes.map((subId, subSlotIdx) => ({ subId, subSlotIdx })).filter(item => Boolean(item.subId)).map(({ subId, subSlotIdx }) => {
                                    const pObj = resolvePlayerOrTrialist(subId);
                                    const subNum = getSlotDisplayNumber("sub", subSlotIdx, 12 + subSlotIdx, pObj);
                                    const subDetail = lineup.substitutions?.find(s => s.subId === subId);
                                    const replacedPlayer = subDetail?.replacedId ? resolvePlayerOrTrialist(subDetail.replacedId) : null;
                                    const subNote = lineup.usedSubstitutes?.includes(subId)
                                        ? (replacedPlayer ? `On ${subDetail?.minute || 60}' for ${getMatchdayDisplayName(replacedPlayer)}` : `Played`)
                                        : (pObj?.position || '');
                                    return `<li><span><strong>#${subNum}</strong> ${pObj ? getMatchdayDisplayName(pObj) : 'TBD'}</span><span style="color:#64748b;font-size:11px">${subNote}</span></li>`;
                                }).join('') : '<li><span>No substitutes assigned</span></li>'}
                            </ul>
                        </div>

                        ${(penName || cornerName || fkName) ? `
                        <div class="panel">
                            <h3>Set-Piece Takers</h3>
                            <ul class="list">
                                ${penName ? `<li><span>Penalties</span><strong>${penName}</strong></li>` : ''}
                                ${cornerName ? `<li><span>Corners</span><strong>${cornerName}</strong></li>` : ''}
                                ${fkName ? `<li><span>Free Kicks</span><strong>${fkName}</strong></li>` : ''}
                            </ul>
                        </div>
                        ` : ''}

                        ${lineup.tacticalNotes?.trim() ? `
                        <div class="panel">
                            <h3>Tactical Instructions & Notes</h3>
                            <div class="notes-box">${lineup.tacticalNotes.trim()}</div>
                        </div>
                        ` : ''}
                    </div>
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

    const handleCopyTeamSheetToWhatsApp = () => {
        if (!lineup) return;
        const formation = FORMATIONS[lineup.formation] || [];
        const dateFormatted = nextMatch
            ? new Date(nextMatch.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
            : new Date().toLocaleDateString('en-GB');
        const meetTime = getFormattedMeetTime();
        const venueStr = lineup.venueNotes?.trim()
            ? lineup.venueNotes.trim()
            : (nextMatch ? (nextMatch.isHome ? (settings.homeGround || "Home") : "Away") : "");

        let msg = `⚽ *${settings.name.toUpperCase()} — MATCHDAY SQUAD* ⚽\n`;
        if (nextMatch) {
            msg += `*${nextMatch.isHome ? '🏠 Home' : '🚌 Away'} vs ${nextMatch.opponent}*\n`;
            msg += `🏆 ${nextMatch.competition || 'Match'} | 📅 ${dateFormatted}\n`;
            msg += `⏰ KO: ${nextMatch.time || 'TBD'} (📍 Meet: ${meetTime}${venueStr ? ` @ ${venueStr}` : ''})\n`;
        }
        msg += `📋 Formation: *${lineup.formation}*\n\n`;

        msg += `*STARTING XI:*\n`;
        formation.forEach((pos, idx) => {
            const pid = lineup.starters[idx];
            const pObj = resolvePlayerOrTrialist(pid);
            const num = getSlotDisplayNumber("pitch", idx, pos.number, pObj);
            const isCapt = pid && lineup.captainId === pid ? " *(C)*" : (pid && lineup.viceCaptainId === pid ? " *(VC)*" : "");
            msg += `${num}. *${pos.label}* — ${pObj ? getMatchdayDisplayName(pObj) : 'TBD'}${isCapt}\n`;
        });

        const activeSubsWithIdx = lineup.substitutes.map((subId, subSlotIdx) => ({ subId, subSlotIdx })).filter(item => Boolean(item.subId));
        if (activeSubsWithIdx.length > 0) {
            msg += `\n*SUBSTITUTES:*\n`;
            activeSubsWithIdx.forEach(({ subId, subSlotIdx }) => {
                const pObj = resolvePlayerOrTrialist(subId);
                const subNum = getSlotDisplayNumber("sub", subSlotIdx, 12 + subSlotIdx, pObj);
                msg += `${subNum}. ${pObj ? `${getMatchdayDisplayName(pObj)}${pObj.id.startsWith("trialist-") ? " (Guest)" : ` (${pObj.position})`}` : 'TBD'}\n`;
            });
        }

        const roleLines: string[] = [];
        if (lineup.captainId) {
            const c = resolvePlayerOrTrialist(lineup.captainId);
            if (c) roleLines.push(`©️ Captain: ${getMatchdayDisplayName(c)}`);
        }
        if (lineup.penaltyTakerId) {
            const p = resolvePlayerOrTrialist(lineup.penaltyTakerId);
            if (p) roleLines.push(`⚽ Penalties: ${getMatchdayDisplayName(p)}`);
        }
        if (lineup.cornerTakerId) {
            const cr = resolvePlayerOrTrialist(lineup.cornerTakerId);
            if (cr) roleLines.push(`🚩 Corners: ${getMatchdayDisplayName(cr)}`);
        }
        if (lineup.freeKickTakerId) {
            const fk = resolvePlayerOrTrialist(lineup.freeKickTakerId);
            if (fk) roleLines.push(`🎯 Free Kicks: ${getMatchdayDisplayName(fk)}`);
        }
        if (roleLines.length > 0) {
            msg += `\n*ROLES & SET PIECES:*\n${roleLines.join("\n")}\n`;
        }

        if (lineup.tacticalNotes && lineup.tacticalNotes.trim()) {
            msg += `\n📝 *TACTICAL NOTES:*\n${lineup.tacticalNotes.trim()}\n`;
        }

        navigator.clipboard.writeText(msg).then(() => {
            showToast("Team Sheet copied & opening WhatsApp");
            const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
            window.open(whatsappUrl, '_blank');
        }).catch(() => {
            const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
            window.open(whatsappUrl, '_blank');
        });
    };

    const handleCopyPollToWhatsApp = () => {
        if (!lineup) return;
        
        let msgTemplate = `⚽ *MATCHDAY AVAILABILITY POLL* ⚽\n\n`;
        if (nextMatch) {
            msgTemplate += `*${nextMatch.isHome ? '🏠 Home' : '🚌 Away'} vs {opponent}*\n`;
            msgTemplate += `🏆 {competition}\n`;
            msgTemplate += `📅 {date}\n`;
            msgTemplate += `⏰ Kick-off: {time}\n`;
            msgTemplate += `📍 Meet Time: {meet_time}\n`;
            if (lineup.venueNotes?.trim()) {
                msgTemplate += `🏟️ Venue / Pitch: ${lineup.venueNotes.trim()}\n`;
            }
            msgTemplate += `🔑 Session Code: {code}\n\n`;
        } else {
            msgTemplate += `*Upcoming Match TBD*\n\n`;
        }
        msgTemplate += `🔴 Please confirm your availability for this match as soon as possible! Let's go boys!\n\n`;
        if (nextMatch) {
            const checkinLink = `${window.location.origin}/respond/${nextMatch.event_token || nextMatch.id}`;
            msgTemplate += `🔗 Log availability here:\n${checkinLink}`;
        }

        const dateFormatted = nextMatch 
            ? new Date(nextMatch.date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) 
            : new Date().toLocaleDateString('en-GB');

        const meetTime = getFormattedMeetTime();
        const sessionCode = nextMatch ? ("CU" + (nextMatch.event_token || nextMatch.id).replace(/-/g, "").substring(0, 4)).toUpperCase() : "TBD";

        const formattedMsg = msgTemplate
            .replace(/{opponent}/g, nextMatch ? nextMatch.opponent : "TBD")
            .replace(/{competition}/g, nextMatch ? (nextMatch.competition || "Match") : "Match")
            .replace(/{date}/g, dateFormatted)
            .replace(/{time}/g, nextMatch ? nextMatch.time : "TBD")
            .replace(/{meet_time}/g, meetTime)
            .replace(/{code}/g, sessionCode);

        navigator.clipboard.writeText(formattedMsg).then(() => {
            showToast("Availability Poll copied & opening WhatsApp");
            const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(formattedMsg)}`;
            window.open(whatsappUrl, '_blank');
        }).catch(() => {
            const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(formattedMsg)}`;
            window.open(whatsappUrl, '_blank');
        });
    };

    if (!lineup) return <div>Loading...</div>;

    const formation = FORMATIONS[lineup.formation];
    const selectedPlayerIds = [
        ...Object.values(lineup.starters),
        ...lineup.substitutes
    ].filter(Boolean);

    const selectedSquadPlayers = selectedPlayerIds
        .map(id => resolvePlayerOrTrialist(id))
        .filter((p): p is Player => Boolean(p));

    const selectedStarterPlayers = Object.values(lineup.starters)
        .filter(Boolean)
        .map(id => resolvePlayerOrTrialist(id))
        .filter((p): p is Player => Boolean(p));

    // Recent Form / Previous Match Starters & Subs (#9)
    const { lastMatchStarterIds, lastMatchSubIds } = (() => {
        const starterSet = new Set<string>();
        const subSet = new Set<string>();
        const currentMatchObj = matches.find(m => m.id === selectedMatchId);
        const sortedOtherMatches = [...matches]
            .filter(m => m.id !== selectedMatchId)
            .sort((a, b) => {
                if (currentMatchObj) {
                    const aBefore = a.date <= currentMatchObj.date ? 0 : 1;
                    const bBefore = b.date <= currentMatchObj.date ? 0 : 1;
                    if (aBefore !== bBefore) return aBefore - bBefore;
                }
                return b.date.localeCompare(a.date);
            });

        for (const m of sortedOtherMatches) {
            const parsed = parseLineupFromNotes(m.notes);
            if (parsed && parsed.starters && Object.values(parsed.starters).some(Boolean)) {
                Object.values(parsed.starters).forEach((id: any) => {
                    if (id) starterSet.add(String(id));
                });
                (parsed.substitutes || []).forEach((id: any) => {
                    if (id) subSet.add(String(id));
                });
                break;
            }
        }
        return { lastMatchStarterIds: starterSet, lastMatchSubIds: subSet };
    })();

    // Live calculation of minutes played and substitution badges (#7)
    const { liveMinutesMap, subbedOffMap } = (() => {
        const minutesMap = new Map<string, number>();
        const onPitchSince = new Map<string, number>();
        const offMap = new Map<string, { minute: number; subId: string }>();

        Object.values(lineup.starters || {}).forEach((id: any) => {
            if (id) {
                onPitchSince.set(id, 0);
                minutesMap.set(id, 0);
            }
        });

        (lineup.usedSubstitutes || []).forEach((id: string) => {
            if (id) minutesMap.set(id, 0);
        });

        const sortedSubs = [...(lineup.substitutions || [])]
            .filter(sub => sub.subId && (lineup.usedSubstitutes || []).includes(sub.subId))
            .sort((a, b) => (Number(a.minute) || 60) - (Number(b.minute) || 60));

        sortedSubs.forEach(sub => {
            const subMin = Number(sub.minute) || 60;
            if (sub.replacedId && onPitchSince.has(sub.replacedId)) {
                const startedAt = onPitchSince.get(sub.replacedId)!;
                const played = Math.max(0, subMin - startedAt);
                minutesMap.set(sub.replacedId, (minutesMap.get(sub.replacedId) || 0) + played);
                onPitchSince.delete(sub.replacedId);
                offMap.set(sub.replacedId, { minute: subMin, subId: sub.subId });
            }
            if (sub.subId) {
                if (!minutesMap.has(sub.subId)) minutesMap.set(sub.subId, 0);
                onPitchSince.set(sub.subId, subMin);
            }
        });

        onPitchSince.forEach((startedAt, id) => {
            const played = Math.max(0, 90 - startedAt);
            minutesMap.set(id, (minutesMap.get(id) || 0) + played);
        });

        (lineup.usedSubstitutes || []).forEach((id: string) => {
            if (id && minutesMap.get(id) === 0) {
                const hasSubRecord = lineup.substitutions?.some(s => s.subId === id && s.replacedId);
                if (!hasSubRecord) minutesMap.set(id, 30);
            }
        });

        return { liveMinutesMap: minutesMap, subbedOffMap: offMap };
    })();

    const activePlayerId = activeSlot
        ? activeSlot.type === 'pitch'
            ? lineup.starters[activeSlot.index]
            : lineup.substitutes[activeSlot.index]
        : null;

    const activePlayer = activePlayerId ? resolvePlayerOrTrialist(activePlayerId) : null;

    const getTodayString = () => {
        const d = new Date();
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const getTargetDate = () => {
        if (nextMatch?.date) return nextMatch.date;
        return getTodayString();
    };

    const isPlayerAvailable = (p: Player) => {
        if (isFormerPlayer(p)) return false;
        if (p.medicalStatus === "Available") return true;
        if (p.medicalStatus === "Holiday") {
            if (!p.holidayStart || !p.holidayEnd) return false;
            const targetDate = getTargetDate();
            if (targetDate < p.holidayStart || targetDate > p.holidayEnd) return true;
        }
        return false;
    };

    const isPlayerInMatchdayTracker = (p: Player) => {
        const playerSquads = p.squad
            ? p.squad.split(',').map((s: string) => s.trim().toLowerCase().replace(/\s+/g, ''))
            : [];
        const activeTabClean = activeSquadTab.toLowerCase().replace(/\s+/g, '');
        const matchesSquad = playerSquads.includes(activeTabClean);
        const isDual = playerSquads.includes("dualregistration");
        const isFirstTeamTab = activeTabClean === 'firstteam';
        return matchesSquad || isDual || (isFirstTeamTab && p.isInMatchdayTracker === true);
    };

    const availablePlayers = players.filter(p => !selectedPlayerIds.includes(p.id) && isPlayerAvailable(p) && isPlayerInMatchdayTracker(p));
    const unavailablePlayers = players.filter(p => ! isFormerPlayer(p) && !selectedPlayerIds.includes(p.id) && !isPlayerAvailable(p) && isPlayerInMatchdayTracker(p));

    const targetCategory = activeSlot && activeSlot.type === 'pitch' ? getPositionCategory(activeSlot.label) : 'All';

    const filteredAvailable = availablePlayers.filter(p => {
        const fullName = `${p.firstName} ${p.lastName}`.toLowerCase();
        return fullName.includes(searchQuery.toLowerCase()) || p.position.toLowerCase().includes(searchQuery.toLowerCase());
    });

    const sortedPlayers = [...filteredAvailable].sort((a, b) => {
        if (activeSlot && activeSlot.type === 'pitch') {
            const getScore = (player: Player) => {
                if (isIdealPosition(player.position, activeSlot.label)) return 3;
                if (player.secondaryPositions && player.secondaryPositions.some(pos => isIdealPosition(pos, activeSlot.label))) return 2;
                if (getPositionCategory(player.position) === targetCategory) return 1;
                if (player.secondaryPositions && player.secondaryPositions.some(pos => getPositionCategory(pos) === targetCategory)) return 1;
                return 0;
            };
            const scoreA = getScore(a);
            const scoreB = getScore(b);
            if (scoreA !== scoreB) return scoreB - scoreA;
        } else {
            const catA = getPositionCategory(a.position);
            const catB = getPositionCategory(b.position);
            
            if (targetCategory !== 'All') {
                const matchA = catA === targetCategory ? 1 : 0;
                const matchB = catB === targetCategory ? 1 : 0;
                if (matchA !== matchB) return matchB - matchA;
            }
        }
        
        // Group by exact position first using global POSITION_ORDER
        const orderA = POSITION_ORDER[a.position.toUpperCase()] || 99;
        const orderB = POSITION_ORDER[b.position.toUpperCase()] || 99;
        if (orderA !== orderB) return orderA - orderB;
        
        return a.lastName.localeCompare(b.lastName);
    });



    return (
        <div className="pb-16 flex flex-col gap-4 relative">
            {/* Non-blocking Toast Banner */}
            {toast && (
                <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-xl border backdrop-blur-md animate-in fade-in slide-in-from-bottom-3 duration-200 bg-surface-1 border-border text-foreground">
                    {toast.type === "error" ? (
                        <AlertCircle className="h-4 w-4 text-status-error shrink-0" />
                    ) : (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                    )}
                    <span className="text-xs font-bold">{toast.message}</span>
                    <button onClick={() => setToast(null)} className="ml-2 text-muted-foreground hover:text-foreground">
                        <X className="h-3.5 w-3.5" />
                    </button>
                </div>
            )}

            {/* #1 Compact Fixture Header Bar + #7 Editable Meet Time & Venue Notes */}
            <div className="bg-surface-1 rounded-2xl shadow-sm border border-border px-4 py-3.5 md:px-6 md:py-4 relative overflow-hidden">
                <div className="absolute inset-0 pointer-events-none opacity-[0.03] dark:opacity-[0.02]" style={{ backgroundImage: 'radial-gradient(circle at center, currentColor 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>

                <div className="relative z-10 flex flex-col gap-3">
                    {/* Top Row: Fixture Title + Metadata + Fixture Selector */}
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 min-w-0">
                            {nextMatch ? (
                                <>
                                    <div className="flex items-center gap-2 text-lg md:text-2xl font-black tracking-tight leading-tight">
                                        <span className={nextMatch.isHome ? "text-foreground" : "text-muted-foreground"}>
                                            {settings.name}
                                        </span>
                                        <span className="text-muted-foreground text-xs font-extrabold uppercase px-1.5 py-0.5 rounded bg-surface-2">vs</span>
                                        <span className={!nextMatch.isHome ? "text-foreground" : "text-muted-foreground"}>
                                            {nextMatch.opponent}
                                        </span>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                                        <span className="inline-flex items-center gap-1 text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                                            <Trophy className="h-3 w-3" /> {nextMatch.competition || "Friendly"}
                                        </span>
                                        <span className="inline-flex items-center gap-1">
                                            <Calendar className="h-3.5 w-3.5" />
                                            {new Date(nextMatch.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                                        </span>
                                        <span className="inline-flex items-center gap-1">
                                            <Clock className="h-3.5 w-3.5" /> KO {nextMatch.time}
                                        </span>
                                    </div>
                                </>
                            ) : (
                                <h2 className="text-lg font-black text-foreground">No Upcoming Matches</h2>
                            )}
                        </div>

                        {/* Fixture Dropdown Selector */}
                        <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground hidden sm:inline">Fixture:</span>
                            <select
                                value={selectedMatchId}
                                onChange={(e) => setSelectedMatchId(e.target.value)}
                                className="bg-surface-2 hover:bg-surface-3 border border-border text-foreground text-xs rounded-xl px-3 py-1.5 transition-colors focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer font-bold max-w-full sm:max-w-[320px] truncate"
                            >
                                {matches.map(m => {
                                    const formattedDate = new Date(m.date).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' });
                                    return (
                                        <option key={m.id} value={m.id} className="bg-surface-1 text-foreground">
                                            {m.isHome ? "🏠" : "🚌"} vs {m.opponent} ({formattedDate}) {m.result !== "Pending" ? `[${m.result}]` : ""}
                                        </option>
                                    );
                                })}
                            </select>
                        </div>
                    </div>

                    {/* Bottom Row (#7): Editable Meet Time & Pitch / Postcode / Venue Notes */}
                    {nextMatch && (
                        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/60 text-xs">
                            <div className="flex items-center gap-1.5 bg-surface-2 border border-border rounded-lg px-2.5 py-1">
                                <Clock className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Meet:</span>
                                <span className="text-xs font-extrabold text-foreground">{getFormattedMeetTime()}</span>
                                <select
                                    value={lineup.meetOffsetMinutes ?? 60}
                                    onChange={(e) => {
                                        const mins = parseInt(e.target.value, 10) || 60;
                                        const updated: MatchdayXI = {
                                            ...lineup,
                                            meetOffsetMinutes: mins,
                                            updatedAt: new Date().toISOString()
                                        };
                                        setLineup(updated);
                                        saveLineup(updated);
                                    }}
                                    title="Select Meet Time offset before Kick-Off (included in WhatsApp & PDF)"
                                    className="bg-transparent text-[11px] font-bold text-primary focus:outline-none cursor-pointer ml-1"
                                >
                                    <option value={30} className="bg-surface-1 text-foreground">(30m before KO)</option>
                                    <option value={45} className="bg-surface-1 text-foreground">(45m before KO)</option>
                                    <option value={60} className="bg-surface-1 text-foreground">(60m before KO)</option>
                                    <option value={75} className="bg-surface-1 text-foreground">(75m before KO)</option>
                                    <option value={90} className="bg-surface-1 text-foreground">(90m before KO)</option>
                                </select>
                            </div>

                            <div className="flex items-center gap-1.5 bg-surface-2 border border-border rounded-lg px-2.5 py-1 flex-1 min-w-[220px]">
                                <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
                                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground shrink-0">
                                    {nextMatch.isHome ? "Home:" : "Away:"}
                                </span>
                                <input
                                    type="text"
                                    value={lineup.venueNotes ?? ""}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        const updated: MatchdayXI = {
                                            ...lineup,
                                            venueNotes: val,
                                            updatedAt: new Date().toISOString()
                                        };
                                        setLineup(updated);
                                        saveLineup(updated);
                                    }}
                                    placeholder={`${nextMatch.isHome ? (settings.homeGround || "Home Ground") : "Away Venue"} — Add pitch #, postcode or parking info...`}
                                    className="w-full bg-transparent text-xs font-medium text-foreground placeholder-muted-foreground focus:outline-none"
                                />
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Action Bar */}
            <div className="flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-3 px-1">
                <div className="flex items-center justify-between sm:justify-start gap-3 overflow-x-auto no-scrollbar max-w-full">
                    <div className="flex space-x-1.5">
                        {currentSquads.map(squad => (
                            <button 
                                key={squad} 
                                onClick={() => setActiveSquadTab(squad)} 
                                className={`px-3.5 py-1.5 text-xs font-bold rounded-lg whitespace-nowrap transition-colors ${activeSquadTab === squad ? "bg-foreground text-background shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-surface-2"}`}
                            >
                                {squad}
                            </button>
                        ))}
                    </div>

                    {/* Live Save Status Indicator */}
                    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border shrink-0 ${
                        saveStatus === "saving"
                            ? "bg-amber-500/10 text-amber-500 border-amber-500/20"
                            : saveStatus === "saved"
                                ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                                : "bg-surface-2 text-muted-foreground border-border"
                    }`}>
                        {saveStatus === "saving" ? (
                            <>
                                <Loader2 className="h-3 w-3 animate-spin" />
                                <span>Saving...</span>
                            </>
                        ) : saveStatus === "saved" ? (
                            <>
                                <CheckCircle2 className="h-3 w-3" />
                                <span>XI Saved</span>
                            </>
                        ) : (
                            <span>Draft</span>
                        )}
                    </div>
                </div>
                
                <div className="flex flex-wrap items-center gap-2">
                    <Button onClick={handleClearLineup} variant="outline" className="h-9 text-xs shadow-sm bg-surface-1 border-border text-foreground hover:bg-surface-2" title="Clear Pitch & Bench">
                        <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button onClick={handleAutoFillLastLineup} variant="outline" className="h-9 text-xs shadow-sm bg-surface-1 border-border text-foreground hover:bg-surface-2" title="Copy Lineup from Previous Match">
                        <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                        Last XI
                    </Button>
                    <Button onClick={handleAutoPickXI} variant="outline" className="h-9 text-xs shadow-sm bg-surface-1 border-border text-foreground hover:bg-surface-2" title="Auto-Pick Available Players into Empty Pitch Slots">
                        <Sparkles className="h-3.5 w-3.5 mr-1.5 text-amber-500" />
                        Auto-Pick
                    </Button>
                    <Button onClick={handleCopyTeamSheetToWhatsApp} className="h-9 text-xs bg-emerald-600 hover:bg-emerald-700 text-white border-none shadow-sm flex" title="Share Starting XI & Bench on WhatsApp">
                        <MessageCircle className="h-3.5 w-3.5 mr-1.5" />
                        Share XI
                    </Button>
                    <Button onClick={handleCopyPollToWhatsApp} variant="outline" className="h-9 text-xs shadow-sm bg-surface-1 border-border text-foreground hover:bg-surface-2" title="Share Matchday Availability Check-In Poll on WhatsApp">
                        Poll
                    </Button>
                    {/* #4 Export / Download Pitch Graphic as PNG Image */}
                    <Button onClick={handleDownloadPitchGraphic} variant="outline" className="h-9 text-xs shadow-sm bg-surface-1 border-border text-foreground hover:bg-surface-2" title="Download High-Res Starting XI Pitch Graphic (PNG) for WhatsApp / Instagram">
                        <ImageIcon className="h-3.5 w-3.5 mr-1.5 text-primary" />
                        Graphic
                    </Button>
                    <Button onClick={handleExportPDF} variant="outline" className="h-9 text-xs shadow-sm bg-surface-1 border-border text-foreground hover:bg-surface-2" title="Print / Export Team Sheet PDF">
                        <FileDown className="h-3.5 w-3.5 mr-1.5" />
                        PDF
                    </Button>
                    <Button onClick={async () => {
                        if (!selectedMatchId || !lineup) return;
                        await saveLineup(lineup);
                        const matchObj = matches.find(m => m.id === selectedMatchId);
                        const opponentName = matchObj ? matchObj.opponent : "this game";
                        showToast(`Lineup saved for vs ${opponentName}!`);
                    }} className="h-9 text-xs bg-brand text-brand-foreground hover:bg-brand/90 font-bold shadow-sm px-4">
                        <Save className="h-3.5 w-3.5 mr-1.5" />
                        Save Lineup
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 lg:h-[760px]">
                
                {/* Left Panel - Squad (#2 Search Bar + #9 Season Stats & Last XI Badges) */}
                <div 
                    className="lg:col-span-1 h-[480px] lg:h-full flex flex-col bg-surface-1 rounded-2xl border border-border shadow-sm order-2 lg:order-1 min-h-0 overflow-hidden"
                    onDragOver={handleDragOver}
                    onDrop={handleDropOnSquad}
                >
                    <div className="p-3.5 border-b border-border flex items-center justify-between shrink-0">
                        <span className="cf-card-title">Available Players</span>
                        <span className="cf-metadata mt-0.5">{availablePlayers.length} Available</span>
                    </div>

                    {/* Position Filter Pills */}
                    <div className="px-2.5 pt-2 pb-1.5 bg-surface-2 flex gap-1 overflow-x-auto no-scrollbar shrink-0 z-10">
                        {(["All", "GK", "DEF", "MID", "FWD"] as const).map(f => (
                            <button
                                key={f}
                                onClick={() => setSquadFilter(f)}
                                className={`px-2.5 py-1 text-[11px] font-bold rounded-full transition-all whitespace-nowrap ${squadFilter === f ? 'bg-foreground text-background shadow-sm' : 'text-muted-foreground hover:text-foreground hover:bg-surface-3'}`}
                            >
                                {f}
                            </button>
                        ))}
                    </div>

                    {/* #2 Quick Search Input inside Left Panel */}
                    <div className="px-2.5 pb-2 pt-1 border-b border-border bg-surface-2 shrink-0">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
                            <input
                                type="text"
                                value={panelSearchQuery}
                                onChange={(e) => setPanelSearchQuery(e.target.value)}
                                placeholder="Search squad..."
                                className="w-full pl-8 pr-7 py-1 bg-surface-1 border border-border rounded-lg text-xs text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                            />
                            {panelSearchQuery && (
                                <button
                                    type="button"
                                    onClick={() => setPanelSearchQuery("")}
                                    className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
                                >
                                    <X className="h-3.5 w-3.5" />
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="p-2.5 space-y-2 overflow-y-auto flex-1 scrollbar-thin">
                        {sortedPlayers
                            .filter(p => squadFilter === "All" || getPositionCategory(p.position) === squadFilter)
                            .filter(p => {
                                if (!panelSearchQuery.trim()) return true;
                                const q = panelSearchQuery.toLowerCase();
                                const fullName = `${p.firstName} ${p.lastName}`.toLowerCase();
                                return fullName.includes(q) || p.position.toLowerCase().includes(q);
                            })
                            .map(player => {
                                const displayName = formatPlayerName(player);
                                const rawSeasonStats = seasonStatsMap[player.id];
                                const appsCount = Math.max(rawSeasonStats?.apps || 0, player.appearances || 0);
                                const goalsCount = Math.max(rawSeasonStats?.goals || 0, player.goals || 0);
                                const assistsCount = Math.max(rawSeasonStats?.assists || 0, player.assists || 0);
                                const startedLast = lastMatchStarterIds.has(player.id);
                                const subLast = !startedLast && lastMatchSubIds.has(player.id);

                                return (
                                    <div 
                                        key={player.id}
                                        draggable
                                        onDragStart={(e) => handleDragStart(e, player.id, {type: 'squad'})}
                                        className="group flex flex-col p-2.5 border border-border rounded-xl cursor-grab active:cursor-grabbing hover:border-foreground/30 bg-surface-1 transition-all shadow-sm relative overflow-hidden gap-1"
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <GripVertical className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                                                <div className="flex flex-col min-w-0">
                                                    <span className="cf-card-title truncate w-full" title={displayName}>{displayName}</span>
                                                    <span className="text-[10px] uppercase text-muted-foreground font-bold">
                                                        {player.position}
                                                        {player.secondaryPositions && player.secondaryPositions.length > 0 ? ` • ${player.secondaryPositions.join("/")}` : ""}
                                                    </span>
                                                </div>
                                            </div>
                                            {player.squadNumber > 0 && (
                                                <span className="text-[10px] font-bold text-muted-foreground bg-surface-2 px-1.5 py-0.5 rounded shrink-0">
                                                    #{player.squadNumber}
                                                </span>
                                            )}
                                        </div>

                                        {/* #9 Season Stats & Last Match XI Badges */}
                                        {(appsCount > 0 || goalsCount > 0 || assistsCount > 0 || startedLast || subLast) && (
                                            <div className="flex flex-wrap items-center gap-1 pl-6 pt-0.5">
                                                {startedLast && (
                                                    <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">
                                                        Started Last XI
                                                    </span>
                                                )}
                                                {subLast && (
                                                    <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-blue-500/15 text-blue-400 border border-blue-500/30">
                                                        Sub Last XI
                                                    </span>
                                                )}
                                                {(appsCount > 0 || goalsCount > 0 || assistsCount > 0) && (
                                                    <span className="text-[9px] font-bold text-muted-foreground bg-surface-2 px-1.5 py-0.2 rounded">
                                                        {appsCount} {appsCount === 1 ? "App" : "Apps"}
                                                        {goalsCount > 0 ? ` • ${goalsCount}G` : ""}
                                                        {assistsCount > 0 ? ` • ${assistsCount}A` : ""}
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                        })}
                        {availablePlayers.length === 0 && (
                            <div className="text-center py-6 text-slate-400 dark:text-slate-500 text-sm border-2 border-dashed rounded-lg border-slate-200 dark:border-slate-800 m-2">
                                <span className="text-xl mb-1 block">✅</span>
                                Squad deployed!
                            </div>
                        )}
                    </div>

                    {/* Collapsible Unavailable / Doubtful Section */}
                    {unavailablePlayers.length > 0 && (
                        <div className="border-t border-border bg-surface-2/60 shrink-0">
                            <button
                                type="button"
                                onClick={() => setShowUnavailableSection(prev => !prev)}
                                className="w-full px-3.5 py-2.5 flex items-center justify-between text-xs font-bold text-muted-foreground hover:text-foreground transition-colors"
                            >
                                <span className="flex items-center gap-1.5">
                                    <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                                    Unavailable / Doubtful ({unavailablePlayers.length})
                                </span>
                                {showUnavailableSection ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
                            </button>
                            {showUnavailableSection && (
                                <div className="max-h-48 overflow-y-auto px-3 pb-3 space-y-1.5 scrollbar-thin">
                                    {unavailablePlayers
                                        .filter(p => squadFilter === "All" || getPositionCategory(p.position) === squadFilter)
                                        .filter(p => {
                                            if (!panelSearchQuery.trim()) return true;
                                            const q = panelSearchQuery.toLowerCase();
                                            const fullName = `${p.firstName} ${p.lastName}`.toLowerCase();
                                            return fullName.includes(q) || p.position.toLowerCase().includes(q);
                                        })
                                        .map(player => {
                                            const displayName = formatPlayerName(player);
                                            const statusColor =
                                                player.medicalStatus === "Doubtful"
                                                    ? "bg-amber-500/15 text-amber-500 border-amber-500/30"
                                                    : player.medicalStatus === "Holiday"
                                                        ? "bg-blue-500/15 text-blue-400 border-blue-500/30"
                                                        : player.medicalStatus === "At Parent Club"
                                                            ? "bg-purple-500/15 text-purple-400 border-purple-500/30"
                                                            : "bg-red-500/15 text-red-400 border-red-500/30";
                                            const detailText =
                                                player.medicalStatus === "Injured" || player.medicalStatus === "Doubtful"
                                                    ? [player.injuryType, player.injuryDuration].filter(Boolean).join(" • ")
                                                    : player.medicalStatus === "Suspended"
                                                        ? player.suspensionReason
                                                        : player.medicalStatus === "Holiday" && player.holidayEnd
                                                            ? `Back ${new Date(player.holidayEnd).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}`
                                                            : "";

                                            return (
                                                <div
                                                    key={player.id}
                                                    draggable
                                                    onDragStart={(e) => handleDragStart(e, player.id, { type: 'squad' })}
                                                    title="Drag onto pitch/bench to override availability"
                                                    className="flex items-center justify-between gap-2 p-2 rounded-lg border border-border/70 bg-surface-1/80 opacity-85 hover:opacity-100 cursor-grab active:cursor-grabbing transition-all"
                                                >
                                                    <div className="min-w-0">
                                                        <div className="text-xs font-bold text-foreground truncate">{displayName}</div>
                                                        <div className="text-[10px] text-muted-foreground truncate">
                                                            {player.position}{detailText ? ` • ${detailText}` : ""}
                                                        </div>
                                                    </div>
                                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${statusColor}`}>
                                                        {player.medicalStatus}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Center Content - Formation Display (#3 Kit Selector, #6 Trialists, #10 Live Match Events) */}
                <div className="lg:col-span-3 h-auto lg:h-full flex flex-col order-1 lg:order-2 min-h-0 overflow-hidden rounded-xl">
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 z-10 shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="flex flex-col">
                                <span className="cf-section-title">Starting XI</span>
                                <span className="cf-metadata">{Object.values(lineup.starters).filter(Boolean).length} / 11 Selected</span>
                            </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                            {/* #3 Per-Match Kit Colour Selector + Goalkeeper Jersey Colour */}
                            <div className="flex items-center gap-1 bg-surface-1 border border-border rounded-xl px-2 py-1 shadow-sm">
                                <Shirt className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                <select
                                    value={lineup.kitOverride || "auto"}
                                    onChange={(e) => {
                                        const mode = e.target.value as "auto" | "home" | "away" | "custom";
                                        const updated: MatchdayXI = {
                                            ...lineup,
                                            kitOverride: mode,
                                            updatedAt: new Date().toISOString()
                                        };
                                        setLineup(updated);
                                        saveLineup(updated);
                                    }}
                                    title="Select Matchday Kit Colour"
                                    className="bg-transparent text-xs font-bold text-foreground focus:outline-none cursor-pointer"
                                >
                                    <option value="auto" className="bg-surface-1 text-foreground">Kit: Auto ({nextMatch?.isHome === false ? "Away" : "Home"})</option>
                                    <option value="home" className="bg-surface-1 text-foreground">Kit: Home</option>
                                    <option value="away" className="bg-surface-1 text-foreground">Kit: Away</option>
                                    <option value="custom" className="bg-surface-1 text-foreground">Kit: Custom</option>
                                </select>
                                {lineup.kitOverride === "custom" && (
                                    <input
                                        type="color"
                                        value={lineup.customKitColor || getEffectiveOutfieldKitColor()}
                                        onChange={(e) => {
                                            const updated: MatchdayXI = {
                                                ...lineup,
                                                customKitColor: e.target.value,
                                                updatedAt: new Date().toISOString()
                                            };
                                            setLineup(updated);
                                            saveLineup(updated);
                                        }}
                                        title="Pick Custom Outfield Jersey Colour"
                                        className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent p-0"
                                    />
                                )}
                                <span className="text-[10px] font-bold text-muted-foreground ml-1">GK:</span>
                                <input
                                    type="color"
                                    value={getEffectiveGkKitColor()}
                                    onChange={(e) => {
                                        const updated: MatchdayXI = {
                                            ...lineup,
                                            gkKitColor: e.target.value,
                                            updatedAt: new Date().toISOString()
                                        };
                                        setLineup(updated);
                                        saveLineup(updated);
                                    }}
                                    title="Pick Goalkeeper (#1) Jersey Colour"
                                    className="w-4 h-4 rounded cursor-pointer border-0 bg-transparent p-0"
                                />
                            </div>

                            {/* 1-11 Button: Shows/Resets 1-11 on the pitch */}
                            <button
                                type="button"
                                onClick={handleResetCustomNumbers}
                                className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-colors flex items-center gap-1.5 shadow-sm ${
                                    !lineup.customNumbers || Object.keys(lineup.customNumbers).length === 0
                                        ? "bg-foreground text-background border-foreground"
                                        : "bg-surface-1 text-foreground border-border hover:border-foreground/30"
                                }`}
                                title="Set all shirt numbers on the field to 1–11 (click any shirt number on the pitch to change it manually)"
                            >
                                <span>1–11</span>
                                {lineup.customNumbers && Object.keys(lineup.customNumbers).length > 0 && (
                                    <RotateCcw className="h-3 w-3 opacity-80" />
                                )}
                            </button>

                            <select
                                value={lineup.formation}
                                onChange={(e) => handleFormationChange(e.target.value)}
                                className="px-3 py-1.5 border border-border rounded-xl text-xs font-bold focus:ring-2 focus:ring-primary focus:outline-none bg-surface-1 text-foreground shadow-sm hover:border-foreground/30 transition-colors cursor-pointer"
                            >
                                {FORMATION_NAMES.map(name => (
                                    <option key={name} value={name}>{name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div className="flex-1 flex items-center justify-center min-h-0">
                        <div className="relative w-full h-[560px] lg:h-full max-w-[680px] mx-auto bg-[#2b7c3d] rounded-2xl shadow-xl overflow-hidden">
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
                                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-10">
                                        <img src={settings.logo} alt="Watermark" className="w-48 h-48 object-contain grayscale brightness-125" />
                                    </div>
                                )}
                            </div>

                            {/* Player positions */}
                            {formation.map((pos, idx) => {
                                const rawPlayerId = lineup.starters[idx];
                                const player = resolvePlayerOrTrialist(rawPlayerId);
                                const playerId = player ? rawPlayerId : null;
                                const displayName = player ? getPitchPlayerDisplayName(player) : "";
                                const fullPlayerName = player ? getMatchdayDisplayName(player) : "";
                                const slotKey = `pitch-${idx}`;
                                const displayedNumber = getSlotDisplayNumber("pitch", idx, pos.number, player);
                                const isEditingThisNumber = editingNumberSlot === slotKey;
                                const isCaptain = Boolean(playerId && lineup.captainId === playerId);
                                const isViceCaptain = Boolean(playerId && lineup.viceCaptainId === playerId);
                                const subOffInfo = playerId ? subbedOffMap.get(playerId) : undefined;
                                const starterMins = playerId ? liveMinutesMap.get(playerId) : undefined;
                                const isGkSlot = idx === 0 || pos.label === "GK";
                                const kitColor = isGkSlot ? getEffectiveGkKitColor() : getEffectiveOutfieldKitColor();
                                const playerEvents = playerId ? (lineup.matchEvents?.[playerId] || currentMatchStatsMap[playerId]) : undefined;
                                const isMotm = Boolean(playerId && lineup.motmPlayerId === playerId);

                                const jerseyTextColor = (() => {
                                    const hex = kitColor.replace("#", "").trim();
                                    const fullHex = hex.length === 3
                                        ? hex.split("").map(c => c + c).join("")
                                        : hex;
                                    if (fullHex.length !== 6) return "#ffffff";
                                    const r = parseInt(fullHex.substr(0, 2), 16);
                                    const g = parseInt(fullHex.substr(2, 2), 16);
                                    const b = parseInt(fullHex.substr(4, 2), 16);
                                    if (isNaN(r) || isNaN(g) || isNaN(b)) return "#ffffff";
                                    const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
                                    return (yiq >= 140) ? "#000000" : "#ffffff";
                                })();

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
                                            draggable={!!playerId && !isEditingThisNumber && editingNamePlayerId !== playerId}
                                            onDragStart={(e) => playerId && handleDragStart(e, playerId, {type: 'pitch', index: idx})}
                                            onClick={() => setActiveSlot({ type: 'pitch', index: idx, label: pos.label })}
                                    >
                                        <div className="relative">
                                            {/* Jersey SVG Icon colored dynamically based on kit selector & GK slot */}
                                            <svg 
                                                className="w-9 h-9 sm:w-11 sm:h-11 drop-shadow-[0_2px_4px_rgba(0,0,0,0.45)] mb-0.5 z-10 transition-transform group-hover:scale-105" 
                                                viewBox="0 0 100 100" 
                                                fill="none" 
                                                xmlns="http://www.w3.org/2000/svg"
                                            >
                                                {/* Shirt Body */}
                                                <path d="M 30,20 L 70,20 L 85,35 L 75,45 L 68,38 L 68,85 L 32,85 L 32,38 L 25,45 L 15,35 Z" fill={kitColor} stroke="#000" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
                                                {/* Collar */}
                                                <path d="M 40,20 Q 50,28 60,20" stroke="#000" strokeWidth="3.5" fill="none" />
                                                {/* Always render crisp number inside shirt unless actively typing a new number */}
                                                {!isEditingThisNumber && (
                                                    <text 
                                                        x="50" 
                                                        y="57" 
                                                        textAnchor="middle" 
                                                        fill={jerseyTextColor} 
                                                        fontSize="28" 
                                                        fontWeight="900" 
                                                        dy=".3em"
                                                    >
                                                        {displayedNumber}
                                                    </text>
                                                )}
                                            </svg>

                                            {/* Clickable Shirt Number Overlay / Inline Editor right on the pitch */}
                                            {isEditingThisNumber ? (
                                                <input
                                                    type="text"
                                                    inputMode="numeric"
                                                    autoFocus
                                                    maxLength={2}
                                                    value={editingNumberValue}
                                                    onFocus={(e) => e.currentTarget.select()}
                                                    onClick={(e) => e.stopPropagation()}
                                                    onChange={(e) => {
                                                        const digits = e.target.value.replace(/[^0-9]/g, "");
                                                        setEditingNumberValue(digits);
                                                    }}
                                                    onKeyDown={(e) => {
                                                        e.stopPropagation();
                                                        if (e.key === "Enter") {
                                                            handleCustomNumberChange(slotKey, editingNumberValue, pos.number);
                                                            setEditingNumberSlot(null);
                                                        } else if (e.key === "Escape") {
                                                            setEditingNumberSlot(null);
                                                        }
                                                    }}
                                                    onBlur={() => {
                                                        handleCustomNumberChange(slotKey, editingNumberValue, pos.number);
                                                        setEditingNumberSlot(null);
                                                    }}
                                                    className="absolute inset-0 m-auto w-7 h-6 bg-slate-950/90 text-white text-center font-black text-xs rounded ring-2 ring-amber-400 outline-none z-30 p-0"
                                                />
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setEditingNumberSlot(slotKey);
                                                        setEditingNumberValue(String(displayedNumber));
                                                    }}
                                                    title={`Shirt #${displayedNumber} — Click to change number manually (Default: ${pos.number})`}
                                                    className="absolute inset-0 m-auto w-6 h-5 sm:w-7 sm:h-6 rounded z-20 hover:ring-1 hover:ring-amber-400 hover:bg-black/15 transition-all cursor-text"
                                                />
                                            )}

                                            {/* Captain / Vice-Captain Armband Badge */}
                                            {playerId && (isCaptain || isViceCaptain) && (
                                                <span
                                                    title={isCaptain ? "Team Captain (C)" : "Vice-Captain (VC)"}
                                                    className={`absolute -top-1 -left-1.5 z-20 px-1 min-w-[16px] h-4 rounded-full text-[9px] font-black flex items-center justify-center shadow border ${
                                                        isCaptain
                                                            ? "bg-amber-400 text-black border-white"
                                                            : "bg-slate-200 text-slate-900 border-white"
                                                    }`}
                                                >
                                                    {isCaptain ? "C" : "VC"}
                                                </span>
                                            )}

                                            {/* Quick hover Captain toggle button */}
                                            {playerId && !isCaptain && (
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleRoleChange("captainId", playerId);
                                                        showToast(`${fullPlayerName} set as Captain (C)`);
                                                    }}
                                                    title="Make Captain (C)"
                                                    className="absolute -top-1 -left-1.5 z-20 w-4 h-4 rounded-full bg-slate-900/80 text-amber-400 border border-amber-400/60 text-[8px] font-black flex items-center justify-center opacity-0 md:group-hover:opacity-100 transition-opacity hover:bg-amber-400 hover:text-black"
                                                >
                                                    C
                                                </button>
                                            )}

                                            {/* Subbed-off badge on pitch */}
                                            {subOffInfo && (
                                                <span
                                                    title={`Subbed off at ${subOffInfo.minute}' (${starterMins ?? subOffInfo.minute} mins played)`}
                                                    className="absolute -top-1 -right-3 z-20 px-1 py-0.2 rounded-full bg-amber-500 text-black text-[8px] font-extrabold shadow border border-white whitespace-nowrap"
                                                >
                                                    🔄 {subOffInfo.minute}&apos;
                                                </span>
                                            )}

                                            {/* #10 Live Match Event Badges on Pitch (Goals, Assists, Cards, MOTM) */}
                                            {playerId && (isMotm || (playerEvents && (playerEvents.goals > 0 || playerEvents.assists > 0 || playerEvents.yellowCards > 0 || playerEvents.redCards > 0))) && (
                                                <div className="absolute -bottom-1 -right-3 z-20 flex items-center gap-0.5 bg-slate-950/90 text-white px-1 py-0.2 rounded-full text-[8px] font-black border border-white/30 shadow">
                                                    {isMotm && <span title="Man of the Match">⭐</span>}
                                                    {playerEvents && playerEvents.goals > 0 && (
                                                        <span title={`${playerEvents.goals} Goal(s)`}>⚽{playerEvents.goals > 1 ? playerEvents.goals : ""}</span>
                                                    )}
                                                    {playerEvents && playerEvents.assists > 0 && (
                                                        <span title={`${playerEvents.assists} Assist(s)`}>👟{playerEvents.assists > 1 ? playerEvents.assists : ""}</span>
                                                    )}
                                                    {playerEvents && playerEvents.yellowCards > 0 && <span title="Yellow Card">🟨</span>}
                                                    {playerEvents && playerEvents.redCards > 0 && <span title="Red Card">🟥</span>}
                                                </div>
                                            )}
                                        </div>
                                        
                                        {/* Name Tag (Inline Custom Name Edit) */}
                                        <div
                                            title={
                                                playerId
                                                    ? `${fullPlayerName}${lineup.customNames?.[playerId]?.trim() && !isTrialistId(playerId) ? ` (Stats: ${player?.firstName} ${player?.lastName})` : ""} • ${pos.label}`
                                                    : pos.label
                                            }
                                            onDoubleClick={(e) => {
                                                if (!playerId) return;
                                                e.stopPropagation();
                                                setEditingNamePlayerId(playerId);
                                                setEditingNameValue(fullPlayerName);
                                            }}
                                            className={`px-2 py-0.5 rounded-full shadow-md min-w-[50px] sm:min-w-[64px] text-center relative transition-all flex items-center justify-center ${playerId ? 'bg-surface-1/95 border border-border backdrop-blur-sm' : 'bg-black/35 border border-white/20 backdrop-blur-sm'}`}
                                        >
                                            {playerId && editingNamePlayerId === playerId ? (
                                                <input
                                                    type="text"
                                                    autoFocus
                                                    value={editingNameValue}
                                                    onClick={(e) => e.stopPropagation()}
                                                    onChange={(e) => setEditingNameValue(e.target.value)}
                                                    onKeyDown={(e) => {
                                                        e.stopPropagation();
                                                        if (e.key === "Enter") {
                                                            handleCustomNameChange(playerId, editingNameValue);
                                                            setEditingNamePlayerId(null);
                                                            showToast("Matchday display name updated");
                                                        } else if (e.key === "Escape") {
                                                            setEditingNamePlayerId(null);
                                                        }
                                                    }}
                                                    onBlur={() => {
                                                        handleCustomNameChange(playerId, editingNameValue);
                                                        setEditingNamePlayerId(null);
                                                    }}
                                                    placeholder={player ? formatPlayerName(player) : "Display name..."}
                                                    className="w-[88px] sm:w-[104px] bg-surface-2 text-foreground text-[10px] sm:text-[11px] font-bold text-center rounded px-1 py-0.5 outline-none ring-1 ring-primary"
                                                />
                                            ) : (
                                                <span className={`text-[9px] sm:text-[11px] font-bold tracking-tight whitespace-nowrap truncate max-w-[84px] sm:max-w-[102px] ${playerId ? 'text-foreground' : 'text-white/75'}`}>
                                                    {playerId ? displayName : getDisplayPosition(pos.label)}
                                                </span>
                                            )}

                                            {/* Edit Name Button (floating badge on hover so it takes 0px of pill width) */}
                                            {playerId && editingNamePlayerId !== playerId && (
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setEditingNamePlayerId(playerId);
                                                        setEditingNameValue(fullPlayerName);
                                                    }}
                                                    title="Edit display name for Pitch & Team Sheet"
                                                    className="absolute -top-2 -left-2 bg-slate-800 text-white rounded-full w-4 h-4 flex items-center justify-center opacity-0 md:group-hover:opacity-100 hover:bg-primary transition-opacity z-20 shadow"
                                                >
                                                    <Pencil className="h-2.5 w-2.5" />
                                                </button>
                                            )}
                                            
                                            {/* Remove Button */}
                                            {playerId && editingNamePlayerId !== playerId && (
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); handleRemoveFromPitch(idx); }}
                                                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center opacity-0 md:group-hover:opacity-100 hover:bg-red-600 transition-opacity z-20 shadow"
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
                    </div>
                </div>

                {/* Right Panel - Bench (#8 One-Click Fill/Clear Bench, #6 Trialists, #10 Event Badges) */}
                <div className="lg:col-span-1 h-[400px] lg:h-full flex flex-col bg-surface-1 rounded-2xl border border-border shadow-sm order-3 min-h-0 overflow-hidden">
                    <div className="p-3.5 border-b border-slate-200/60 dark:border-slate-800/60 flex items-center justify-between gap-1 shrink-0">
                        <div className="flex flex-col min-w-0">
                            <span className="cf-card-title">Bench</span>
                            <span className="cf-metadata mt-0.5">{lineup.substitutes.filter(Boolean).length} / {lineup.substitutes.length} Selected</span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                            <button
                                type="button"
                                onClick={handleAutoFillBench}
                                title="Auto-fill empty bench slots with top available players"
                                className="text-amber-500 hover:text-amber-400 font-bold text-[10px] flex items-center px-2 py-1 rounded-full bg-amber-500/10 hover:bg-amber-500/20 transition-colors"
                            >
                                <Sparkles className="h-3 w-3 mr-0.5" /> Fill
                            </button>
                            {lineup.substitutes.some(Boolean) && (
                                <button
                                    type="button"
                                    onClick={handleClearBench}
                                    title="Clear all players from the bench"
                                    className="text-muted-foreground hover:text-destructive font-bold text-[10px] flex items-center px-2 py-1 rounded-full bg-surface-2 hover:bg-destructive/10 transition-colors"
                                >
                                    Clear
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={handleAddSub}
                                title="Add another substitute slot"
                                className="text-primary hover:text-primary font-bold text-[10px] flex items-center px-2.5 py-1 rounded-full bg-primary/10 hover:bg-primary/20 transition-colors"
                            >
                                <Plus className="h-3 w-3 mr-0.5" /> ADD
                            </button>
                        </div>
                    </div>
                    <div className="p-3 space-y-2 overflow-y-auto flex-1 scrollbar-thin">
                        {lineup.substitutes.map((rawSubId, idx) => {
                            const player = resolvePlayerOrTrialist(rawSubId);
                            const subId = player ? rawSubId : "";
                            const displayName = getMatchdayDisplayName(player);
                            const defaultSubNumber = 12 + idx;
                            const subSlotKey = `sub-${idx}`;
                            const displayedSubNumber = getSlotDisplayNumber("sub", idx, defaultSubNumber, player);
                            const isEditingSubNumber = editingNumberSlot === subSlotKey;
                            const isTrialist = isTrialistId(subId);
                            const hasCustomSubName = Boolean(subId && !isTrialist && lineup.customNames?.[subId]?.trim());
                            const subDetail = lineup.substitutions?.find(s => s.subId === subId);
                            const isSubPlayed = Boolean(subId && lineup.usedSubstitutes?.includes(subId));
                            const subMinutes = isSubPlayed ? (liveMinutesMap.get(subId) ?? 30) : 0;
                            const subEvents = subId ? (lineup.matchEvents?.[subId] || currentMatchStatsMap[subId]) : undefined;
                            const isSubMotm = Boolean(subId && lineup.motmPlayerId === subId);

                            return (
                                <div key={idx} className="space-y-1.5 p-1.5 rounded-xl border border-border bg-surface-1 shadow-sm">
                                    <div 
                                        className="flex flex-col gap-1.5 w-full"
                                        onDragOver={handleDragOver}
                                        onDrop={(e) => handleDropOnSub(e, idx)}
                                    >
                                        <div className="flex items-center gap-1.5 w-full">
                                            {isEditingSubNumber ? (
                                                <input
                                                    type="text"
                                                    inputMode="numeric"
                                                    autoFocus
                                                    maxLength={2}
                                                    value={editingNumberValue}
                                                    onFocus={(e) => e.currentTarget.select()}
                                                    onChange={(e) => setEditingNumberValue(e.target.value.replace(/[^0-9]/g, ""))}
                                                    onKeyDown={(e) => {
                                                        if (e.key === "Enter") {
                                                            handleCustomNumberChange(subSlotKey, editingNumberValue, defaultSubNumber);
                                                            setEditingNumberSlot(null);
                                                        } else if (e.key === "Escape") {
                                                            setEditingNumberSlot(null);
                                                        }
                                                    }}
                                                    onBlur={() => {
                                                        handleCustomNumberChange(subSlotKey, editingNumberValue, defaultSubNumber);
                                                        setEditingNumberSlot(null);
                                                    }}
                                                    className="w-7 h-6 rounded-md bg-surface-2 border border-primary text-[10px] font-black text-center text-foreground outline-none ring-1 ring-primary shrink-0 p-0"
                                                />
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setEditingNumberSlot(subSlotKey);
                                                        setEditingNumberValue(String(displayedSubNumber));
                                                    }}
                                                    title={`Shirt #${displayedSubNumber} — Click to change number manually (Default: ${defaultSubNumber})`}
                                                    className="w-7 h-6 rounded-md bg-surface-2 hover:bg-surface-3 border border-border text-[10px] font-extrabold text-center text-foreground transition-colors shrink-0"
                                                >
                                                    {displayedSubNumber}
                                                </button>
                                            )}
                                            
                                            <div 
                                                draggable={!!subId && editingNamePlayerId !== subId}
                                                onDragStart={(e) => subId && handleDragStart(e, subId, {type: 'sub', index: idx})}
                                                onClick={() => {
                                                    if (editingNamePlayerId === subId) return;
                                                    setActiveSlot({ type: 'sub', index: idx, label: `Bench Slot ${idx + 1}` });
                                                }}
                                                className={`flex-1 min-w-0 flex items-center justify-between px-2.5 py-2 border rounded-xl shadow-sm transition-all cursor-pointer ${subId ? 'bg-surface-1 hover:border-primary/50 border-border group' : 'bg-surface-2 border-dashed border-border text-muted-foreground hover:bg-surface-3'}`}
                                            >
                                                {subId ? (
                                                    <>
                                                        <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                                            <GripVertical className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                                                            {editingNamePlayerId === subId ? (
                                                                <input
                                                                    type="text"
                                                                    autoFocus
                                                                    value={editingNameValue}
                                                                    onClick={(e) => e.stopPropagation()}
                                                                    onChange={(e) => setEditingNameValue(e.target.value)}
                                                                    onKeyDown={(e) => {
                                                                        e.stopPropagation();
                                                                        if (e.key === "Enter") {
                                                                            handleCustomNameChange(subId, editingNameValue);
                                                                            setEditingNamePlayerId(null);
                                                                            showToast("Matchday display name updated");
                                                                        } else if (e.key === "Escape") {
                                                                            setEditingNamePlayerId(null);
                                                                        }
                                                                    }}
                                                                    onBlur={() => {
                                                                        handleCustomNameChange(subId, editingNameValue);
                                                                        setEditingNamePlayerId(null);
                                                                    }}
                                                                    placeholder={player ? formatPlayerName(player) : "Display name..."}
                                                                    className="w-full bg-surface-2 text-foreground text-xs font-semibold rounded px-1.5 py-0.5 outline-none ring-1 ring-primary"
                                                                />
                                                            ) : (
                                                                <>
                                                                    <span className="font-semibold text-xs text-foreground truncate" title={displayName}>{displayName}</span>
                                                                    <button
                                                                        type="button"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setEditingNamePlayerId(subId);
                                                                            setEditingNameValue(displayName);
                                                                        }}
                                                                        title="Edit display name for Team Sheet"
                                                                        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-primary transition-opacity p-0.5 shrink-0"
                                                                    >
                                                                        <Pencil className="h-3 w-3" />
                                                                    </button>
                                                                </>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-1 shrink-0 ml-1">
                                                            {(isSubMotm || (subEvents && (subEvents.goals > 0 || subEvents.assists > 0 || subEvents.yellowCards > 0 || subEvents.redCards > 0))) && (
                                                                <span className="text-[9px] font-bold bg-surface-2 px-1 py-0.5 rounded flex items-center gap-0.5">
                                                                    {isSubMotm && "⭐"}
                                                                    {subEvents && subEvents.goals > 0 && `⚽${subEvents.goals > 1 ? subEvents.goals : ""}`}
                                                                    {subEvents && subEvents.assists > 0 && `👟${subEvents.assists > 1 ? subEvents.assists : ""}`}
                                                                    {subEvents && subEvents.yellowCards > 0 && "🟨"}
                                                                    {subEvents && subEvents.redCards > 0 && "🟥"}
                                                                </span>
                                                            )}
                                                            <span className="text-[9px] uppercase text-muted-foreground font-bold bg-surface-2 px-1.5 py-0.5 rounded">
                                                                {isTrialist ? "GUEST" : player?.position}
                                                            </span>
                                                        </div>
                                                    </>
                                                ) : (
                                                    <span className="text-[10px] font-medium text-center w-full block">Click or drag here</span>
                                                )}
                                            </div>

                                            {lineup.substitutes.length > 1 && (
                                                <button
                                                    onClick={() => handleRemoveSub(idx)}
                                                    className="p-1 text-slate-400 hover:text-red-600 transition-colors rounded-full hover:bg-red-50 shrink-0"
                                                    title="Remove slot"
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </button>
                                            )}
                                        </div>

                                        {subId && (
                                            <div className="flex items-center justify-between pl-5 pr-1 gap-1">
                                                <div className="flex items-center gap-1 min-w-0">
                                                    <span className="text-[10px] text-muted-foreground truncate">
                                                        {isTrialist
                                                            ? "Trialist / Guest (Excluded from Squad DB)"
                                                            : hasCustomSubName
                                                                ? `Stats: ${player?.firstName} ${player?.lastName}`
                                                                : `${player?.firstName} ${player?.lastName}`}
                                                    </span>
                                                    {hasCustomSubName && (
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleCustomNameChange(subId, "");
                                                                showToast("Reset to default player name", "info");
                                                            }}
                                                            title="Reset to original player name"
                                                            className="text-muted-foreground hover:text-primary shrink-0"
                                                        >
                                                            <RotateCcw className="h-2.5 w-2.5" />
                                                        </button>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-1 shrink-0">
                                                    {isSubPlayed && (
                                                        <span className="px-1.5 py-0.5 rounded-full text-[9px] font-extrabold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                                                            {subMinutes}&apos; played
                                                        </span>
                                                    )}
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            const usedSubs = lineup.usedSubstitutes || [];
                                                            let nextUsed;
                                                            let nextSubstitutions = lineup.substitutions || [];
                                                            if (usedSubs.includes(subId)) {
                                                                nextUsed = usedSubs.filter(id => id !== subId);
                                                                nextSubstitutions = nextSubstitutions.filter(s => s.subId !== subId);
                                                            } else {
                                                                nextUsed = [...usedSubs, subId];
                                                            }
                                                            const updated = { ...lineup, usedSubstitutes: nextUsed, substitutions: nextSubstitutions, updatedAt: new Date().toISOString() };
                                                            setLineup(updated);
                                                            saveLineup(updated);
                                                        }}
                                                        className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold border transition-colors shrink-0 ${isSubPlayed ? "bg-status-success/15 text-status-success border-status-success/30 hover:bg-status-success/25" : "bg-surface-2 text-muted-foreground border-border hover:bg-surface-3 hover:text-foreground"}`}
                                                    >
                                                        {isSubPlayed ? "✓ Played" : "Unused"}
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    {subId && isSubPlayed && (
                                        <div className="pl-6 pr-2 py-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-t border-border mt-1.5 bg-surface-2 rounded-lg">
                                            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Subbed For:</span>
                                            <div className="flex items-center gap-1 flex-1 justify-end">
                                                <select
                                                    value={subDetail?.replacedId || ""}
                                                    onChange={(e) => handleSubDetailChange(subId, e.target.value, subDetail?.minute || 60)}
                                                    className="text-[10px] bg-surface-1 border border-border text-foreground rounded-md px-2 py-1 h-7 max-w-[120px] outline-none font-medium focus:border-primary"
                                                >
                                                    <option value="">Replaced player...</option>
                                                    <optgroup label="Starters">
                                                        {Object.entries(lineup.starters).map(([slotIdx, starterId]) => {
                                                            if (!starterId) return null;
                                                            const starter = resolvePlayerOrTrialist(starterId);
                                                            const slotLabel = formation[Number(slotIdx)]?.label || slotIdx;
                                                            return (
                                                                <option key={starterId} value={starterId}>
                                                                    {starter ? getMatchdayDisplayName(starter) : "Unknown"} ({slotLabel})
                                                                </option>
                                                            );
                                                        })}
                                                    </optgroup>
                                                    <optgroup label="Substitutes">
                                                        {lineup.substitutes.map((rawId, sIdx) => {
                                                            if (!rawId || rawId === subId) return null;
                                                            if (!lineup.usedSubstitutes?.includes(rawId)) return null;
                                                            const otherSub = resolvePlayerOrTrialist(rawId);
                                                            return (
                                                                <option key={rawId} value={rawId}>
                                                                    {otherSub ? getMatchdayDisplayName(otherSub) : "Unknown"} (Sub #{sIdx + 1})
                                                                </option>
                                                            );
                                                        })}
                                                    </optgroup>
                                                </select>
                                                <div className="flex items-center gap-1 font-bold text-[9px] text-slate-500">
                                                    <span>Min:</span>
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        max="90"
                                                        value={subDetail?.minute ?? ""}
                                                        placeholder="60"
                                                        onChange={(e) => handleSubDetailChange(subId, subDetail?.replacedId || "", parseInt(e.target.value) || 60)}
                                                        className="text-[10px] bg-surface-1 border border-border text-foreground rounded-md px-1 py-1 h-7 w-10 text-center outline-none focus:border-primary"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Matchday Roles, Set-Piece Takers & Tactical Instructions */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Roles & Set-Piece Takers */}
                <div className="bg-surface-1 rounded-2xl border border-border p-5 shadow-sm space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Award className="h-4 w-4 text-amber-500" />
                            <h3 className="cf-card-title">Captain &amp; Set-Piece Takers</h3>
                        </div>
                        <span className="cf-metadata">Included on Team Sheet, Graphic &amp; WhatsApp</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Captain (C)</label>
                            <select
                                value={lineup.captainId || ""}
                                onChange={(e) => handleRoleChange("captainId", e.target.value)}
                                className="w-full h-9 px-2.5 rounded-xl bg-surface-2 border border-border text-xs font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                            >
                                <option value="">Select Captain...</option>
                                {selectedStarterPlayers.map(p => (
                                    <option key={p.id} value={p.id}>{getMatchdayDisplayName(p)} ({p.position})</option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-1">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Vice-Captain (VC)</label>
                            <select
                                value={lineup.viceCaptainId || ""}
                                onChange={(e) => handleRoleChange("viceCaptainId", e.target.value)}
                                className="w-full h-9 px-2.5 rounded-xl bg-surface-2 border border-border text-xs font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                            >
                                <option value="">Select Vice-Captain...</option>
                                {selectedStarterPlayers.map(p => (
                                    <option key={p.id} value={p.id}>{getMatchdayDisplayName(p)} ({p.position})</option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-1">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Penalties</label>
                            <select
                                value={lineup.penaltyTakerId || ""}
                                onChange={(e) => handleRoleChange("penaltyTakerId", e.target.value)}
                                className="w-full h-9 px-2.5 rounded-xl bg-surface-2 border border-border text-xs font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                            >
                                <option value="">Select Penalty Taker...</option>
                                {selectedStarterPlayers.map(p => (
                                    <option key={p.id} value={p.id}>{getMatchdayDisplayName(p)} ({p.position})</option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-1">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Corners</label>
                            <select
                                value={lineup.cornerTakerId || ""}
                                onChange={(e) => handleRoleChange("cornerTakerId", e.target.value)}
                                className="w-full h-9 px-2.5 rounded-xl bg-surface-2 border border-border text-xs font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                            >
                                <option value="">Select Corner Taker...</option>
                                {selectedStarterPlayers.map(p => (
                                    <option key={p.id} value={p.id}>{getMatchdayDisplayName(p)} ({p.position})</option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-1 sm:col-span-2 md:col-span-2">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Free Kicks</label>
                            <select
                                value={lineup.freeKickTakerId || ""}
                                onChange={(e) => handleRoleChange("freeKickTakerId", e.target.value)}
                                className="w-full h-9 px-2.5 rounded-xl bg-surface-2 border border-border text-xs font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                            >
                                <option value="">Select Free Kick Taker...</option>
                                {selectedStarterPlayers.map(p => (
                                    <option key={p.id} value={p.id}>{getMatchdayDisplayName(p)} ({p.position})</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                {/* Tactical Instructions & Matchday Notes */}
                <div className="bg-surface-1 rounded-2xl border border-border p-5 shadow-sm flex flex-col space-y-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-primary" />
                            <h3 className="cf-card-title">Tactical Instructions &amp; Matchday Notes</h3>
                        </div>
                        <span className="cf-metadata">Auto-saves &amp; prints on PDF</span>
                    </div>
                    <textarea
                        value={lineup.tacticalNotes || ""}
                        onChange={(e) => handleTacticalNotesChange(e.target.value)}
                        placeholder="Add key tactical reminders, pressing triggers, opposition threats, or warm-up notes for this fixture..."
                        rows={4}
                        className="w-full flex-1 rounded-xl bg-surface-2 border border-border p-3 text-xs text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                    />
                </div>
            </div>

            {/* Assign Player Modal/Drawer (#5 Click-to-Swap, #6 Add Trialist, #10 Post-Match Stats & MOTM) */}
            {activeSlot && (
                <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
                    <div 
                        className="fixed inset-0" 
                        onClick={() => { setActiveSlot(null); setSearchQuery(""); setShowTrialistForm(false); }}
                    />
                    <div className="bg-surface-1 border border-border w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl max-h-[88vh] sm:max-h-[84vh] flex flex-col shadow-2xl z-10 overflow-hidden animate-in slide-in-from-bottom duration-200">
                        {/* Modal Header */}
                        <div className="p-4 sm:p-5 border-b border-border flex items-center justify-between shrink-0 bg-surface-1 backdrop-blur-md">
                            <div>
                                <h3 className="cf-section-title">Assign Player</h3>
                                <p className="cf-metadata mt-0.5">Select player for position: <span className="font-bold text-primary">{activeSlot.label}</span></p>
                            </div>
                            <button 
                                onClick={() => { setActiveSlot(null); setSearchQuery(""); setShowTrialistForm(false); }}
                                className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        {/* Search Input + #6 "+ Trialist / Guest" Toggle Button */}
                        <div className="p-3 border-b border-border bg-surface-2 shrink-0 space-y-2">
                            <div className="flex items-center gap-2">
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                                    <input
                                        type="text"
                                        placeholder="Search player by name or position..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full pl-9 pr-4 py-1.5 bg-surface-1 border border-border rounded-xl text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                                    />
                                </div>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        const defaultNum = activeSlot.type === "pitch"
                                            ? (formation[activeSlot.index]?.number || activeSlot.index + 1)
                                            : (12 + activeSlot.index);
                                        setTrialistInputNumber(String(defaultNum));
                                        setShowTrialistForm(prev => !prev);
                                    }}
                                    className="h-9 px-2.5 text-xs font-bold rounded-xl border-primary/30 text-primary hover:bg-primary/10 shrink-0"
                                    title="Add a Trialist or Guest Player for this match only (without cluttering your database squad)"
                                >
                                    <UserPlus className="h-3.5 w-3.5 mr-1" />
                                    Trialist
                                </Button>
                            </div>

                            {/* #6 Collapsible Trialist / Guest Player Form */}
                            {showTrialistForm && (
                                <div className="p-2.5 rounded-xl bg-surface-1 border border-primary/30 space-y-2 animate-in fade-in duration-150">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-primary">
                                            + Add Trialist / Guest Player (Match Only)
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => setShowTrialistForm(false)}
                                            className="text-muted-foreground hover:text-foreground"
                                        >
                                            <X className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="number"
                                            min={1}
                                            max={99}
                                            value={trialistInputNumber}
                                            onChange={(e) => setTrialistInputNumber(e.target.value)}
                                            placeholder="#"
                                            className="w-14 h-8 px-2 bg-surface-2 border border-border rounded-lg text-xs font-bold text-center text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                                        />
                                        <input
                                            type="text"
                                            autoFocus
                                            value={trialistInputName}
                                            onChange={(e) => setTrialistInputName(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter") {
                                                    e.preventDefault();
                                                    handleAddTrialistToActiveSlot();
                                                }
                                            }}
                                            placeholder="e.g. Trialist GK or Alex Smith..."
                                            className="flex-1 h-8 px-2.5 bg-surface-2 border border-border rounded-lg text-xs font-medium text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                                        />
                                        <Button
                                            type="button"
                                            size="sm"
                                            onClick={handleAddTrialistToActiveSlot}
                                            className="h-8 px-3 text-xs font-bold bg-primary text-primary-foreground rounded-lg shrink-0"
                                        >
                                            Assign
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Player List */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-surface-0">
                            {/* Current Assigned Player */}
                            {activePlayer && (
                                <div className="p-3 border border-primary/20 rounded-2xl bg-primary/5 flex flex-col gap-2.5 mb-2">
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex flex-col min-w-0">
                                            <span className="text-[10px] uppercase font-bold text-primary tracking-wider">Currently Assigned</span>
                                            <span className="cf-card-title text-foreground truncate">
                                                {getMatchdayDisplayName(activePlayer)}
                                            </span>
                                            <span className="text-[10px] text-muted-foreground font-bold uppercase">
                                                {isTrialistId(activePlayer.id)
                                                    ? "Trialist / Guest Player"
                                                    : `${activePlayer.position}${lineup.customNames?.[activePlayer.id]?.trim() ? ` • Stats: ${activePlayer.firstName} ${activePlayer.lastName}` : ""}`}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1.5 shrink-0">
                                            {activeSlot.type === 'pitch' && (
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    onMouseDown={(e) => {
                                                        e.preventDefault();
                                                        const nextCapt = lineup.captainId === activePlayer.id ? "" : activePlayer.id;
                                                        handleRoleChange("captainId", nextCapt);
                                                        showToast(nextCapt ? `${getMatchdayDisplayName(activePlayer)} set as Captain (C)` : "Captain unassigned", "info");
                                                    }}
                                                    className={`h-8 text-xs font-bold rounded-lg px-2.5 ${lineup.captainId === activePlayer.id ? "bg-amber-400 text-black border-amber-400 hover:bg-amber-500" : ""}`}
                                                >
                                                    {lineup.captainId === activePlayer.id ? "© Captain" : "Make (C)"}
                                                </Button>
                                            )}
                                            <Button
                                                onMouseDown={(e) => {
                                                    e.preventDefault();
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
                                                className="h-8 text-xs bg-destructive hover:bg-destructive/90 text-white font-bold rounded-lg px-3"
                                            >
                                                <Trash2 className="h-3.5 w-3.5 mr-1" /> Remove
                                            </Button>
                                        </div>
                                    </div>

                                    {/* Custom Matchday Shirt # & Display Name Override */}
                                    <div className="pt-2 border-t border-primary/15 space-y-1.5">
                                        <div className="grid grid-cols-4 gap-2">
                                            <div className="col-span-1 space-y-1">
                                                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                                                    <Hash className="h-2.5 w-2.5 text-primary" />
                                                    Shirt #
                                                </label>
                                                {(() => {
                                                    const slotKey = `${activeSlot.type}-${activeSlot.index}`;
                                                    const defaultNum = activeSlot.type === "pitch"
                                                        ? (formation[activeSlot.index]?.number || activeSlot.index + 1)
                                                        : (12 + activeSlot.index);
                                                    const currentNum = lineup.customNumbers?.[slotKey] ?? getSlotDisplayNumber(activeSlot.type, activeSlot.index, defaultNum, activePlayer);
                                                    return (
                                                        <input
                                                            type="number"
                                                            min={1}
                                                            max={99}
                                                            value={currentNum}
                                                            onClick={(e) => (e.target as HTMLInputElement).select()}
                                                            onChange={(e) => handleCustomNumberChange(slotKey, e.target.value, defaultNum)}
                                                            placeholder={String(defaultNum)}
                                                            className="w-full h-8 px-2 bg-surface-1 border border-border rounded-lg text-xs font-extrabold text-center text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                                                        />
                                                    );
                                                })()}
                                            </div>
                                            <div className="col-span-3 space-y-1">
                                                <div className="flex items-center justify-between">
                                                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                                                        <Pencil className="h-2.5 w-2.5 text-primary" />
                                                        Pitch &amp; Team Sheet Name
                                                    </label>
                                                    {!isTrialistId(activePlayer.id) && lineup.customNames?.[activePlayer.id]?.trim() && (
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                handleCustomNameChange(activePlayer.id, "");
                                                                showToast("Reset to default player name", "info");
                                                            }}
                                                            className="text-[10px] font-bold text-primary hover:underline flex items-center gap-0.5"
                                                        >
                                                            <RotateCcw className="h-2.5 w-2.5" /> Reset
                                                        </button>
                                                    )}
                                                </div>
                                                <input
                                                    type="text"
                                                    value={lineup.customNames?.[activePlayer.id] ?? ""}
                                                    onChange={(e) => handleCustomNameChange(activePlayer.id, e.target.value)}
                                                    placeholder={`Default: ${formatPlayerName(activePlayer)}`}
                                                    className="w-full h-8 px-2.5 bg-surface-1 border border-border rounded-lg text-xs font-medium text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* #10 Post-Match Quick Stats Entry (Goals, Assists, Yellow/Red Cards, MOTM) */}
                                    {!isTrialistId(activePlayer.id) && (() => {
                                        const ev = lineup.matchEvents?.[activePlayer.id] || currentMatchStatsMap[activePlayer.id] || {
                                            goals: 0,
                                            assists: 0,
                                            yellowCards: 0,
                                            redCards: 0
                                        };
                                        const isMotm = lineup.motmPlayerId === activePlayer.id;

                                        return (
                                            <div className="pt-2 border-t border-primary/15 space-y-1.5">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                                        Match Stats &amp; Events (Syncs to Player Stats)
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleMotmToggle(activePlayer.id)}
                                                        className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border flex items-center gap-1 transition-colors ${
                                                            isMotm
                                                                ? "bg-amber-400 text-black border-amber-400"
                                                                : "bg-surface-1 text-muted-foreground border-border hover:text-foreground"
                                                        }`}
                                                    >
                                                        <Star className="h-3 w-3" />
                                                        {isMotm ? "⭐ MOTM" : "Set MOTM"}
                                                    </button>
                                                </div>
                                                <div className="grid grid-cols-4 gap-1.5">
                                                    {(
                                                        [
                                                            { field: "goals", label: "⚽ Goals", val: ev.goals },
                                                            { field: "assists", label: "👟 Assists", val: ev.assists },
                                                            { field: "yellowCards", label: "🟨 Yellow", val: ev.yellowCards },
                                                            { field: "redCards", label: "🟥 Red", val: ev.redCards }
                                                        ] as const
                                                    ).map(item => (
                                                        <div key={item.field} className="bg-surface-1 border border-border rounded-lg p-1.5 flex flex-col items-center">
                                                            <span className="text-[9px] font-bold text-muted-foreground">{item.label}</span>
                                                            <div className="flex items-center gap-1.5 mt-1">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleMatchEventStatChange(activePlayer.id, item.field, -1)}
                                                                    className="w-5 h-5 rounded bg-surface-2 hover:bg-surface-3 text-xs font-black flex items-center justify-center"
                                                                >
                                                                    -
                                                                </button>
                                                                <span className="text-xs font-black min-w-[14px] text-center">{item.val}</span>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleMatchEventStatChange(activePlayer.id, item.field, 1)}
                                                                    className="w-5 h-5 rounded bg-surface-2 hover:bg-surface-3 text-xs font-black flex items-center justify-center"
                                                                >
                                                                    +
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })()}

                                    {/* #5 Click-to-Swap With Another Pitch or Bench Player */}
                                    <div className="pt-2 border-t border-primary/15 space-y-1.5">
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                                            <ArrowLeftRight className="h-3 w-3 text-primary" />
                                            Quick Swap Position With:
                                        </span>
                                        <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto scrollbar-thin">
                                            {formation.map((pos, pIdx) => {
                                                if (activeSlot.type === "pitch" && activeSlot.index === pIdx) return null;
                                                const otherId = lineup.starters[pIdx];
                                                const otherPlayer = resolvePlayerOrTrialist(otherId);
                                                if (!otherPlayer) return null;
                                                return (
                                                    <button
                                                        key={`swap-pitch-${pIdx}`}
                                                        type="button"
                                                        onClick={() => handleSwapSlots({ type: "pitch", index: pIdx, label: pos.label })}
                                                        className="px-2 py-1 rounded-lg bg-surface-1 hover:bg-primary/15 border border-border hover:border-primary/40 text-[10px] font-bold text-foreground transition-colors flex items-center gap-1"
                                                    >
                                                        <span className="text-primary font-black">{pos.label}:</span>
                                                        <span>{getPitchPlayerDisplayName(otherPlayer)}</span>
                                                    </button>
                                                );
                                            })}
                                            {lineup.substitutes.map((sId, sIdx) => {
                                                if (activeSlot.type === "sub" && activeSlot.index === sIdx) return null;
                                                const otherSub = resolvePlayerOrTrialist(sId);
                                                if (!otherSub) return null;
                                                return (
                                                    <button
                                                        key={`swap-sub-${sIdx}`}
                                                        type="button"
                                                        onClick={() => handleSwapSlots({ type: "sub", index: sIdx, label: `Sub #${12 + sIdx}` })}
                                                        className="px-2 py-1 rounded-lg bg-surface-1 hover:bg-primary/15 border border-border hover:border-primary/40 text-[10px] font-bold text-foreground transition-colors flex items-center gap-1"
                                                    >
                                                        <span className="text-muted-foreground font-black">Sub:</span>
                                                        <span>{getPitchPlayerDisplayName(otherSub)}</span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
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
                                    const matchesTarget = activeSlot.type === 'pitch' && isIdealPosition(player.position, activeSlot.label);
                                    const matchesSecondary = activeSlot.type === 'pitch' && player.secondaryPositions && player.secondaryPositions.some(pos => isIdealPosition(pos, activeSlot.label));
                                    const rawPStats = seasonStatsMap[player.id];
                                    const appsCount = Math.max(rawPStats?.apps || 0, player.appearances || 0);
                                    const goalsCount = Math.max(rawPStats?.goals || 0, player.goals || 0);
                                    const assistsCount = Math.max(rawPStats?.assists || 0, player.assists || 0);
                                    const startedLast = lastMatchStarterIds.has(player.id);
                                    const subLast = !startedLast && lastMatchSubIds.has(player.id);

                                    return (
                                        <button
                                            key={player.id}
                                            onMouseDown={(e) => {
                                                e.preventDefault();
                                                if (activeSlot.type === 'pitch') {
                                                    handleStarterChange(activeSlot.index, player.id);
                                                } else {
                                                    handleSubChange(activeSlot.index, player.id);
                                                }
                                                setActiveSlot(null);
                                                setSearchQuery("");
                                            }}
                                            className={`w-full flex items-center justify-between gap-2 p-3 border rounded-xl transition-all text-left group
                                                ${matchesTarget 
                                                    ? 'bg-primary/5 border-primary/20 hover:border-primary/50 hover:bg-primary/10' 
                                                    : matchesSecondary
                                                        ? 'bg-status-warning/5 border-status-warning/20 hover:border-status-warning/50 hover:bg-status-warning/10'
                                                        : 'bg-surface-1 border-border hover:border-foreground/30 hover:bg-surface-2'
                                                }`}
                                        >
                                            <div className="flex flex-col min-w-0 gap-1">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-sm font-bold text-foreground group-hover:text-primary transition-colors truncate">
                                                        {formatPlayerName(player)}
                                                    </span>
                                                    <span className="text-[10px] text-muted-foreground font-semibold uppercase shrink-0">
                                                        {player.position} {player.secondaryPositions && player.secondaryPositions.length > 0 ? `• ${player.secondaryPositions.join("/")}` : ''}
                                                    </span>
                                                </div>
                                                {(appsCount > 0 || goalsCount > 0 || assistsCount > 0 || startedLast || subLast) && (
                                                    <div className="flex flex-wrap items-center gap-1">
                                                        {startedLast && (
                                                            <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">
                                                                Started Last XI
                                                            </span>
                                                        )}
                                                        {subLast && (
                                                            <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-blue-500/15 text-blue-400 border border-blue-500/30">
                                                                Sub Last XI
                                                            </span>
                                                        )}
                                                        {(appsCount > 0 || goalsCount > 0 || assistsCount > 0) && (
                                                            <span className="text-[9px] font-bold text-muted-foreground bg-surface-2 px-1.5 py-0.2 rounded">
                                                                {appsCount} {appsCount === 1 ? "App" : "Apps"}
                                                                {goalsCount > 0 ? ` • ${goalsCount}G` : ""}
                                                                {assistsCount > 0 ? ` • ${assistsCount}A` : ""}
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                            {matchesTarget && (
                                                <span className="bg-primary/10 text-primary border border-primary/20 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0">
                                                    Ideal Position
                                                </span>
                                            )}
                                            {!matchesTarget && matchesSecondary && (
                                                <span className="bg-status-warning/10 text-status-warning border border-status-warning/20 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0">
                                                    Secondary Option
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

                            {/* Doubtful / Unavailable Override Options in Modal */}
                            {unavailablePlayers.length > 0 && (
                                <div className="pt-3 border-t border-border mt-3 space-y-1.5">
                                    <div className="text-[10px] font-bold text-amber-500 uppercase tracking-wider px-1">
                                        Unavailable / Doubtful (Click to Override)
                                    </div>
                                    {unavailablePlayers
                                        .filter(p => {
                                            const fullName = `${p.firstName} ${p.lastName}`.toLowerCase();
                                            return fullName.includes(searchQuery.toLowerCase()) || p.position.toLowerCase().includes(searchQuery.toLowerCase());
                                        })
                                        .map(player => (
                                            <button
                                                key={player.id}
                                                onMouseDown={(e) => {
                                                    e.preventDefault();
                                                    if (activeSlot.type === 'pitch') {
                                                        handleStarterChange(activeSlot.index, player.id);
                                                    } else {
                                                        handleSubChange(activeSlot.index, player.id);
                                                    }
                                                    setActiveSlot(null);
                                                    setSearchQuery("");
                                                }}
                                                className="w-full flex items-center justify-between p-2.5 border border-border/70 rounded-xl bg-surface-1/60 hover:bg-surface-2 transition-all text-left opacity-80 hover:opacity-100"
                                            >
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-bold text-foreground">
                                                        {formatPlayerName(player)}
                                                    </span>
                                                    <span className="text-[10px] text-muted-foreground uppercase">
                                                        {player.position}
                                                    </span>
                                                </div>
                                                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-500 border border-amber-500/30">
                                                    {player.medicalStatus}
                                                </span>
                                            </button>
                                        ))}
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="p-4 bg-surface-2 border-t border-border flex justify-end shrink-0">
                            <Button 
                                onMouseDown={(e) => { e.preventDefault(); setActiveSlot(null); setSearchQuery(""); setShowTrialistForm(false); }}
                                className="bg-surface-3 hover:bg-border text-foreground border-none font-bold text-xs rounded-lg"
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
