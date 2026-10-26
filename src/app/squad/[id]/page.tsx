"use client";

import { useEffect, useState } from "react";
import {
    cn,
    DEPARTURE_REASONS,
    formatPlayerName,
    isFormerPlayer,
    parsePlayerDeparture,
    serializeDepartureToNotes,
    stripDepartureTags,
    getLoanExpiryStatus,
} from "@/lib/utils";
import { notFound, useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import {
    ArrowLeft,
    ChevronLeft,
    ChevronRight,
    ChevronDown,
    Edit,
    UserMinus,
    RotateCcw,
    Archive,
    Building2,
    Clock,
    Trophy,
    Activity,
    Footprints,
    Ruler,
    ShieldCheck,
    ExternalLink,
    Check,
} from "lucide-react";
import Link from "next/link";
import { MedicalStatus, Player, Position } from "@/types";
import { supabase } from "@/lib/supabase";
import { useClub } from "@/context/club-context";
import { Input } from "@/components/ui/input";
import { logActivity } from "@/lib/activity";

const POSITION_ORDER: Record<string, number> = {
    GK: 1,
    DEF: 2,
    LB: 3,
    CB: 4,
    LCB: 5,
    RCB: 6,
    RB: 7,
    LWB: 8,
    RWB: 9,
    CDM: 10,
    MID: 11,
    CM: 12,
    LM: 13,
    RM: 14,
    CAM: 15,
    LW: 16,
    RW: 17,
    FWD: 18,
    CF: 19,
    ST: 20,
};

interface NavPlayerItem {
    id: string;
    name: string;
    position: string;
    squadNumber?: number;
}

export default function PlayerProfilePage() {
    const params = useParams();
    const router = useRouter();
    const id = params?.id as string;
    const [player, setPlayer] = useState<Player | null>(null);
    const [loading, setLoading] = useState(true);
    const [isDepartureOpen, setIsDepartureOpen] = useState(false);
    const [departureReason, setDepartureReason] = useState<string>("Left club");
    const [departureDate, setDepartureDate] = useState<string>(() => new Date().toISOString().split("T")[0]);
    const [departureNotes, setDepartureNotes] = useState<string>("");
    const [isSavingDeparture, setIsSavingDeparture] = useState(false);

    // Prev / Next Squad Navigation State
    const [prevPlayer, setPrevPlayer] = useState<NavPlayerItem | null>(null);
    const [nextPlayer, setNextPlayer] = useState<NavPlayerItem | null>(null);
    const [squadNavIndex, setSquadNavIndex] = useState<{ current: number; total: number } | null>(null);

    // Status Quick-Picker Popover State
    const [isStatusPickerOpen, setIsStatusPickerOpen] = useState(false);
    const [pickerStatus, setPickerStatus] = useState<MedicalStatus>("Available");
    const [pickerInjuryType, setPickerInjuryType] = useState("");
    const [pickerInjuryDuration, setPickerInjuryDuration] = useState("");
    const [pickerHolidayStart, setPickerHolidayStart] = useState("");
    const [pickerHolidayEnd, setPickerHolidayEnd] = useState("");
    const [pickerSuspensionReason, setPickerSuspensionReason] = useState("");
    const [pickerSuspensionDuration, setPickerSuspensionDuration] = useState("");
    const [isSavingStatus, setIsSavingStatus] = useState(false);

    const getCurrentSeasonStr = () => {
        const d = new Date();
        const year = d.getFullYear();
        const month = d.getMonth(); // 0 = Jan, 5 = Jun
        return month >= 5 
            ? `${year.toString().slice(2)}/${(year + 1).toString().slice(2)}`
            : `${(year - 1).toString().slice(2)}/${year.toString().slice(2)}`;
    };

    const [seasonFilter, setSeasonFilter] = useState<string>(() => getCurrentSeasonStr());
    const [availableSeasons, setAvailableSeasons] = useState<string[]>([]);
    const [calculatedStats, setCalculatedStats] = useState({
        apps: 0,
        starts: 0,
        subApps: 0,
        goals: 0,
        assists: 0,
        yellow: 0,
        red: 0,
        minutes: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        winRate: 0,
        cleanSheets: 0,
        goalsConceded: 0,
    });
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
    const [recentActivity, setRecentActivity] = useState<any[]>([]);
    const [matchLog, setMatchLog] = useState<any[]>([]);
    const [activityTab, setActivityTab] = useState<"matches" | "training">("matches");

    const { settings } = useClub();

    const fetchPlayer = async () => {
        if (!id) return;
        
        const [playerRes, matchesRes, statsRes, sessionsRes, allPlayersRes] = await Promise.all([
            supabase.from('players').select('*, email, mobile_number, status, trusted_devices').eq('id', id).single(),
            supabase.from('matches').select('id, date, opponent, is_home, competition, scoreline, result'),
            supabase.from('match_player_stats').select('*').eq('player_id', id),
            supabase.from('training_sessions').select('id, date, topic, attendance').order('date', { ascending: false }).limit(25),
            supabase.from('players').select('id, first_name, last_name, nickname, use_nickname, position, squad_number, notes, club_status, departure_reason')
        ]);

        const rawPlayer = playerRes.data;
        const dep = rawPlayer ? parsePlayerDeparture(rawPlayer) : { isFormer: false, departureStatus: "Active" as const };

        // Build Prev / Next player switcher list sorted by Position -> Squad # -> Name
        if (allPlayersRes.data && rawPlayer) {
            const sameStatusPlayers = allPlayersRes.data
                .map((p: any) => {
                    const pDep = parsePlayerDeparture(p);
                    return {
                        id: p.id,
                        firstName: p.first_name || "",
                        lastName: p.last_name || "",
                        nickname: p.nickname || "",
                        useNickname: p.use_nickname || false,
                        position: p.position || "MID",
                        squadNumber: p.squad_number || 999,
                        isFormer: pDep.isFormer,
                    };
                })
                .filter((p: any) => p.isFormer === dep.isFormer)
                .sort((a: any, b: any) => {
                    const posDiff = (POSITION_ORDER[a.position] || 99) - (POSITION_ORDER[b.position] || 99);
                    if (posDiff !== 0) return posDiff;
                    if (a.squadNumber !== b.squadNumber) return a.squadNumber - b.squadNumber;
                    return formatPlayerName(a as any).localeCompare(formatPlayerName(b as any));
                });

            const idx = sameStatusPlayers.findIndex((p: any) => p.id === id);
            if (idx !== -1 && sameStatusPlayers.length > 1) {
                const prevIdx = (idx - 1 + sameStatusPlayers.length) % sameStatusPlayers.length;
                const nextIdx = (idx + 1) % sameStatusPlayers.length;
                const prevP = sameStatusPlayers[prevIdx];
                const nextP = sameStatusPlayers[nextIdx];
                setPrevPlayer({
                    id: prevP.id,
                    name: formatPlayerName(prevP as any),
                    position: prevP.position,
                    squadNumber: prevP.squadNumber !== 999 ? prevP.squadNumber : undefined,
                });
                setNextPlayer({
                    id: nextP.id,
                    name: formatPlayerName(nextP as any),
                    position: nextP.position,
                    squadNumber: nextP.squadNumber !== 999 ? nextP.squadNumber : undefined,
                });
                setSquadNavIndex({ current: idx + 1, total: sameStatusPlayers.length });
            } else {
                setPrevPlayer(null);
                setNextPlayer(null);
                setSquadNavIndex(null);
            }
        }

        if (sessionsRes.data) {
            const relevantSessions = sessionsRes.data.filter((session: any) => {
                const attendanceList = session.attendance || [];
                const hasRecord = attendanceList.some((a: any) => a.playerId === id);
                if (hasRecord) return true;
                if (dep.isFormer) {
                    return dep.departureDate ? session.date <= dep.departureDate : false;
                }
                return true;
            }).slice(0, 12);

            const playerSessions = relevantSessions.map((session: any) => {
                const attendanceList = session.attendance || [];
                const record = attendanceList.find((a: any) => a.playerId === id);
                return {
                    id: session.id,
                    date: session.date,
                    topic: session.topic || "Squad Practice",
                    status: record?.status || "Unanswered",
                    notes: record?.notes || ""
                };
            });
            setRecentActivity(playerSessions);
        }

        if (rawPlayer) {
            const notesRaw = rawPlayer.notes || "";
            const regType = notesRaw.includes("[REG:Dual]")
                ? "Dual"
                : (notesRaw.includes("[REG:LoanParent]") || notesRaw.includes("[REG:LoanSub]") ? "Loan" : "Standard");
            const isParentClub = notesRaw.includes("[REG:LoanParent]") ? true : false;
            const loanClub = notesRaw.match(/\[LOAN_CLUB:([^\]]+)\]/) ? notesRaw.match(/\[LOAN_CLUB:([^\]]+)\]/)![1] : undefined;
            const loanEndDate = notesRaw.match(/\[LOAN_END:([^\]]+)\]/) ? notesRaw.match(/\[LOAN_END:([^\]]+)\]/)![1] : undefined;
            const preferredFoot = notesRaw.includes("[FOOT:Left]")
                ? "Left"
                : notesRaw.includes("[FOOT:Right]")
                ? "Right"
                : notesRaw.includes("[FOOT:Both]")
                ? "Both"
                : undefined;
            const injuryType = notesRaw.match(/\[INJURY:(.*?)\]/) ? notesRaw.match(/\[INJURY:(.*?)\]/)![1] : undefined;
            const injuryDuration = notesRaw.match(/\[OUT_DURATION:(.*?)\]/) ? notesRaw.match(/\[OUT_DURATION:(.*?)\]/)![1] : undefined;
            const suspensionReason = notesRaw.match(/\[SUSPENSION_REASON:(.*?)\]/) ? notesRaw.match(/\[SUSPENSION_REASON:(.*?)\]/)![1] : undefined;
            const suspensionDuration = notesRaw.match(/\[SUSPENSION_DURATION:(.*?)\]/) ? notesRaw.match(/\[SUSPENSION_DURATION:(.*?)\]/)![1] : undefined;
            const secondaryPositions = rawPlayer.secondary_position
                ? rawPlayer.secondary_position.split(",").map((s: string) => s.trim() as Position).filter(Boolean)
                : [];

            setPlayer({
                id: rawPlayer.id,
                firstName: rawPlayer.first_name,
                lastName: rawPlayer.last_name,
                position: rawPlayer.position,
                secondaryPositions,
                squadNumber: rawPlayer.squad_number,
                age: rawPlayer.age,
                nationality: rawPlayer.nationality,
                squad: rawPlayer.squad,
                medicalStatus: rawPlayer.medical_status,
                availability: rawPlayer.availability,
                contractExpiry: rawPlayer.contract_expiry,
                imageUrl: rawPlayer.image_url,
                appearances: rawPlayer.appearances, // fallback
                goals: rawPlayer.goals, // fallback
                assists: rawPlayer.assists, // fallback
                dateOfBirth: rawPlayer.date_of_birth,
                holidayStart: rawPlayer.holiday_start,
                holidayEnd: rawPlayer.holiday_end,
                weight: rawPlayer.weight,
                height: rawPlayer.height,
                preferredFoot,
                injuryType,
                injuryDuration,
                suspensionReason,
                suspensionDuration,
                notes: rawPlayer.notes,
                isInTrainingSquad: rawPlayer.is_in_training_squad,
                medicalNotes: rawPlayer.medical_notes,
                email: rawPlayer.email,
                mobileNumber: rawPlayer.mobile_number,
                status: rawPlayer.status || "Pending Activation",
                trustedDevices: rawPlayer.trusted_devices || [],
                nickname: rawPlayer.nickname || "",
                useNickname: rawPlayer.use_nickname || false,
                registrationType: regType,
                isParentClub,
                loanClub,
                loanEndDate,
                departureStatus: dep.departureStatus,
                departureReason: dep.departureReason,
                departureDate: dep.departureDate,
                departureNotes: dep.departureNotes,
            } as any);
        }

        // Calculate dynamic stats & match log
        const matches = matchesRes.data || [];
        const stats = statsRes.data || [];

        const matchSeasons = new Map<string, string>();
        const matchCompetitions = new Map<string, string>();
        const matchResultsMap = new Map<string, string>();
        const matchDetailsMap = new Map<string, any>();
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
                    const month = d.getMonth();
                    if (month >= 5) seasonStr = `${year.toString().slice(2)}/${(year + 1).toString().slice(2)}`;
                    else seasonStr = `${(year - 1).toString().slice(2)}/${year.toString().slice(2)}`;
                }
            }
            matchSeasons.set(m.id, seasonStr);
            matchCompetitions.set(m.id, m.competition || "");
            matchResultsMap.set(m.id, m.result || "Pending");
            matchDetailsMap.set(m.id, m);
            seasonSet.add(seasonStr);
        });
        seasonSet.add(getCurrentSeasonStr());
        setAvailableSeasons(Array.from(seasonSet).sort().reverse());

        let apps = 0;
        let starts = 0;
        let subApps = 0;
        let goals = 0;
        let assists = 0;
        let yellow = 0;
        let red = 0;
        let minutes = 0;
        let wins = 0;
        let draws = 0;
        let losses = 0;
        let cleanSheets = 0;
        let goalsConceded = 0;
        const logEntries: any[] = [];
        
        stats.forEach((s: any) => {
            const season = matchSeasons.get(s.match_id);
            if (seasonFilter !== "All" && season !== seasonFilter) return;

            const comp = matchCompetitions.get(s.match_id) || "";
            const isFriendly = comp.toLowerCase().includes("friendly") || comp.toLowerCase().includes("trial");
            if (!includeFriendlies && isFriendly) return;

            const matchInfo = matchDetailsMap.get(s.match_id);
            let roleLabel = "Starter";
            let minsPlayed = 0;

            // Sprint 13 implementation: accurate participation counting
            if (s.participation_type === 'STARTER') {
                apps += 1;
                starts += 1;
                minsPlayed = s.minutes_played !== undefined && s.minutes_played !== null ? s.minutes_played : 90;
                minutes += minsPlayed;
                roleLabel = "Starter";
            } else if (s.participation_type === 'SUB') {
                apps += 1;
                subApps += 1;
                minsPlayed = s.minutes_played || 0;
                minutes += minsPlayed;
                roleLabel = "Sub";
            } else if (s.participation_type === 'UNUSED_SUB') {
                // 0 apps, 0 mins
                roleLabel = "Unused Sub";
                minsPlayed = 0;
            } else {
                // Legacy fallback
                apps += 1;
                starts += 1;
                minsPlayed = s.minutes_played !== undefined && s.minutes_played !== null ? s.minutes_played : 90;
                minutes += minsPlayed;
                roleLabel = "Starter";
            }

            goals += (s.goals || 0);
            assists += (s.assists || 0);
            yellow += (s.yellow_cards || 0);
            red += (s.red_cards || 0);

            const res = matchResultsMap.get(s.match_id);
            let keptCleanSheet = false;
            if (s.participation_type !== 'UNUSED_SUB') {
                if (res === "Win") wins++;
                else if (res === "Draw") draws++;
                else if (res === "Loss") losses++;

                // Calculate Clean Sheets & Conceded from scoreline when match has a result
                if (matchInfo?.scoreline && matchInfo.scoreline.includes("-") && (res === "Win" || res === "Draw" || res === "Loss")) {
                    const [part1, part2] = matchInfo.scoreline.split("-");
                    const num1 = parseInt(part1.trim(), 10);
                    const num2 = parseInt(part2.trim(), 10);
                    if (!isNaN(num1) && !isNaN(num2)) {
                        let concededInMatch = 0;
                        if (res === "Win") {
                            concededInMatch = Math.min(num1, num2);
                        } else if (res === "Loss") {
                            concededInMatch = Math.max(num1, num2);
                        } else {
                            concededInMatch = num2;
                        }
                        goalsConceded += concededInMatch;
                        if (concededInMatch === 0) {
                            cleanSheets += 1;
                            keptCleanSheet = true;
                        }
                    }
                }
            }

            if (matchInfo) {
                logEntries.push({
                    matchId: s.match_id,
                    date: matchInfo.date || "",
                    opponent: matchInfo.opponent || "Unknown Opponent",
                    isHome: matchInfo.is_home,
                    competition: matchInfo.competition || "League",
                    scoreline: matchInfo.scoreline || "",
                    result: matchInfo.result || "Pending",
                    role: roleLabel,
                    minutes: minsPlayed,
                    goals: s.goals || 0,
                    assists: s.assists || 0,
                    yellow: s.yellow_cards || 0,
                    red: s.red_cards || 0,
                    cleanSheet: keptCleanSheet,
                });
            }
        });

        logEntries.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
        setMatchLog(logEntries);

        const winRate = apps > 0 ? Math.round((wins / apps) * 100) : 0;
        setCalculatedStats({
            apps,
            starts,
            subApps,
            goals,
            assists,
            yellow,
            red,
            minutes,
            wins,
            draws,
            losses,
            winRate,
            cleanSheets,
            goalsConceded,
        });

        setLoading(false);
    };

    useEffect(() => {
        fetchPlayer();
    }, [id, seasonFilter, includeFriendlies]);

    const handleOpenStatusPicker = () => {
        if (!player || isFormerPlayer(player)) return;
        setPickerStatus(player.medicalStatus || "Available");
        setPickerInjuryType(player.injuryType || "");
        setPickerInjuryDuration(player.injuryDuration || "");
        setPickerHolidayStart(player.holidayStart || "");
        setPickerHolidayEnd(player.holidayEnd || "");
        setPickerSuspensionReason(player.suspensionReason || "");
        setPickerSuspensionDuration(player.suspensionDuration || "");
        setIsStatusPickerOpen((prev) => !prev);
    };

    const handleSaveQuickStatus = async (overrideStatus?: MedicalStatus) => {
        if (!player || isFormerPlayer(player)) return;
        const nextStatus = overrideStatus || pickerStatus;
        const nextAvailability = nextStatus === "Available";
        setIsSavingStatus(true);

        try {
            // Rebuild notes preserving existing tags while updating injury/suspension tags
            let updatedNotes = (player.notes || "")
                .replace(/\[INJURY:.*?\]/g, "")
                .replace(/\[OUT_DURATION:.*?\]/g, "")
                .replace(/\[SUSPENSION_REASON:.*?\]/g, "")
                .replace(/\[SUSPENSION_DURATION:.*?\]/g, "")
                .trim();

            if (nextStatus === "Injured" || nextStatus === "Doubtful") {
                if (pickerInjuryType.trim()) {
                    updatedNotes = `${updatedNotes} [INJURY:${pickerInjuryType.trim()}]`.trim();
                }
                if (pickerInjuryDuration.trim()) {
                    updatedNotes = `${updatedNotes} [OUT_DURATION:${pickerInjuryDuration.trim()}]`.trim();
                }
            } else if (nextStatus === "Suspended") {
                if (pickerSuspensionReason.trim()) {
                    updatedNotes = `${updatedNotes} [SUSPENSION_REASON:${pickerSuspensionReason.trim()}]`.trim();
                }
                if (pickerSuspensionDuration.trim()) {
                    updatedNotes = `${updatedNotes} [SUSPENSION_DURATION:${pickerSuspensionDuration.trim()}]`.trim();
                }
            }

            const payload: any = {
                medical_status: nextStatus,
                availability: nextAvailability,
                notes: updatedNotes,
                holiday_start: nextStatus === "Holiday" ? pickerHolidayStart || null : player.holidayStart || null,
                holiday_end: nextStatus === "Holiday" ? pickerHolidayEnd || null : player.holidayEnd || null,
            };

            const { error } = await supabase.from("players").update(payload).eq("id", player.id);
            if (error) throw error;

            setPlayer((prev) =>
                prev
                    ? {
                          ...prev,
                          medicalStatus: nextStatus,
                          availability: nextAvailability,
                          notes: updatedNotes,
                          injuryType:
                              nextStatus === "Injured" || nextStatus === "Doubtful"
                                  ? pickerInjuryType.trim() || undefined
                                  : undefined,
                          injuryDuration:
                              nextStatus === "Injured" || nextStatus === "Doubtful"
                                  ? pickerInjuryDuration.trim() || undefined
                                  : undefined,
                          holidayStart: nextStatus === "Holiday" ? pickerHolidayStart || undefined : prev.holidayStart,
                          holidayEnd: nextStatus === "Holiday" ? pickerHolidayEnd || undefined : prev.holidayEnd,
                          suspensionReason:
                              nextStatus === "Suspended" ? pickerSuspensionReason.trim() || undefined : undefined,
                          suspensionDuration:
                              nextStatus === "Suspended" ? pickerSuspensionDuration.trim() || undefined : undefined,
                      }
                    : null
            );
            setIsStatusPickerOpen(false);
        } catch (err: any) {
            console.error("Error updating player status:", err);
            await fetchPlayer();
        } finally {
            setIsSavingStatus(false);
        }
    };

    const getStatusBadgeStyle = (status: string) => {
        switch (status) {
            case "Available":
                return "bg-status-success/10 text-status-success border-status-success/25 hover:bg-status-success/20";
            case "Unavailable":
                return "bg-muted text-muted-foreground border-border hover:bg-muted/80";
            case "Holiday":
                return "bg-status-info/10 text-status-info border-status-info/25 hover:bg-status-info/20";
            case "Injured":
            case "Suspended":
                return "bg-status-error/10 text-status-error border-status-error/25 hover:bg-status-error/20";
            case "Doubtful":
                return "bg-status-warning/10 text-status-warning border-status-warning/25 hover:bg-status-warning/20";
            case "At Parent Club":
                return "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/25 hover:bg-purple-500/20";
            default:
                return "bg-muted text-muted-foreground border-border hover:bg-muted/80";
        }
    };

    const handleOpenDepartureDialog = () => {
        if (!player) return;
        const isLoanOrDual = player.registrationType === "Loan" || player.registrationType === "Dual";
        setDepartureReason(player.departureReason || (isLoanOrDual ? "Returned to parent club" : "Left club"));
        setDepartureDate(player.departureDate || new Date().toISOString().split("T")[0]);
        setDepartureNotes(player.departureNotes || "");
        setIsDepartureOpen(true);
    };

    const handleMarkLeft = async () => {
        if (!player) return;
        setIsSavingDeparture(true);
        try {
            const updatedNotes = serializeDepartureToNotes(player.notes, {
                reason: departureReason,
                date: departureDate,
                notes: departureNotes,
            });
            const { error } = await supabase
                .from("players")
                .update({
                    notes: updatedNotes,
                    availability: false,
                })
                .eq("id", player.id);
            if (error) throw error;

            await supabase
                .from("players")
                .update({
                    club_status: departureReason,
                    departure_reason: departureReason,
                    departure_date: departureDate || null,
                    departure_notes: departureNotes || null,
                } as any)
                .eq("id", player.id);

            logActivity(
                "Player Left Club",
                `Marked ${player.firstName} ${player.lastName} as having left the club (${departureReason}${departureDate ? ` on ${departureDate}` : ""}). Historical match and training records preserved.`
            );
            setIsDepartureOpen(false);
            await fetchPlayer();
        } catch (err: any) {
            alert("Failed to update player status: " + err.message);
        } finally {
            setIsSavingDeparture(false);
        }
    };

    const handleRestore = async () => {
        if (!player) return;
        try {
            const restoredNotes = stripDepartureTags(player.notes);
            const { error } = await supabase
                .from("players")
                .update({
                    notes: restoredNotes,
                    medical_status: "Available",
                    availability: true,
                })
                .eq("id", player.id);
            if (error) throw error;

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
            await fetchPlayer();
        } catch (err: any) {
            alert("Failed to restore player: " + err.message);
        }
    };

    if (loading) return <div className="p-8 text-center text-muted-foreground">Loading profile...</div>;
    if (!player) return notFound();

    const isFormer = isFormerPlayer(player);
    const departureInfo = parsePlayerDeparture(player);
    const SQUAD_LABELS: Record<string, string> = {
        firstTeam: "First Team",
        firstteam: "First Team",
        midweek: "Midweek",
        youth: "Youth",
    };
    const squadList = (player.squad || "")
        .split(",")
        .map((s) => {
            const clean = s.trim();
            return SQUAD_LABELS[clean] || clean;
        })
        .filter(Boolean);

    let displayAge = player.age;
    let formattedDob: string | null = null;
    if (player.dateOfBirth) {
        const birthDate = new Date(player.dateOfBirth);
        if (!isNaN(birthDate.getTime())) {
            const today = new Date();
            let age = today.getFullYear() - birthDate.getFullYear();
            const m = today.getMonth() - birthDate.getMonth();
            if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
                age--;
            }
            displayAge = age;
            formattedDob = birthDate.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
        }
    }

    // Position badge styling matching Squad Page
    const pUpper = (player.position || "").trim().toUpperCase();
    let posBadgeClass = "bg-surface-2 text-foreground border-border";
    if (pUpper === "GK" || pUpper.includes("GK") || pUpper.includes("KEEPER")) {
        posBadgeClass = "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25";
    } else if (["CB", "RB", "LB", "DEF", "RWB", "LWB"].includes(pUpper) || pUpper.includes("DEF") || pUpper.includes("BACK")) {
        posBadgeClass = "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/25";
    } else if (["CM", "CDM", "CAM", "MID", "RM", "LM"].includes(pUpper) || pUpper.includes("MID")) {
        posBadgeClass = "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25";
    } else if (["ST", "CF", "RW", "LW", "FWD", "ATT"].includes(pUpper) || pUpper.includes("FWD") || pUpper.includes("WING") || pUpper.includes("STRIKER")) {
        posBadgeClass = "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/25";
    }
    const secPositions = (player.secondaryPositions || []).filter(
        (s) => s && s.trim().toUpperCase() !== pUpper
    );

    // Strip internal tags from player notes for clean display
    const cleanPlayerNotes = stripDepartureTags(player.notes || "")
        .replace(/\[PIN:\d{4}\]/g, "")
        .replace(/\[FOOT:(Left|Right|Both)\]/g, "")
        .replace(/\[REG:(Standard|Dual|LoanParent|LoanSub)\]/g, "")
        .replace(/\[LOAN_CLUB:[^\]]*\]/g, "")
        .replace(/\[LOAN_END:[^\]]*\]/g, "")
        .replace(/\[INJURY:.*?\]/g, "")
        .replace(/\[OUT_DURATION:.*?\]/g, "")
        .replace(/\[SUSPENSION_REASON:.*?\]/g, "")
        .replace(/\[SUSPENSION_DURATION:.*?\]/g, "")
        .trim();

    // Contextual Status Details
    let statusContextText = "";
    if (!isFormer) {
        if (player.medicalStatus === "Injured" || player.medicalStatus === "Doubtful") {
            statusContextText = [player.injuryType, player.injuryDuration].filter(Boolean).join(" • ");
        } else if (player.medicalStatus === "Holiday") {
            if (player.holidayStart && player.holidayEnd) {
                const sDate = new Date(player.holidayStart + "T00:00:00");
                const eDate = new Date(player.holidayEnd + "T00:00:00");
                const sFmt = !isNaN(sDate.getTime()) ? sDate.toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : player.holidayStart;
                const eFmt = !isNaN(eDate.getTime()) ? eDate.toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : player.holidayEnd;
                statusContextText = `${sFmt} – ${eFmt} (Back ${eFmt})`;
            } else if (player.holidayEnd) {
                const eDate = new Date(player.holidayEnd + "T00:00:00");
                const eFmt = !isNaN(eDate.getTime()) ? eDate.toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : player.holidayEnd;
                statusContextText = `Back ${eFmt}`;
            }
        } else if (player.medicalStatus === "Suspended") {
            statusContextText = [player.suspensionReason, player.suspensionDuration].filter(Boolean).join(" • ");
        } else if (player.medicalStatus === "At Parent Club" && player.loanClub) {
            statusContextText = `Currently with ${player.loanClub}`;
        }
    }

    // Training attendance summary
    const recordedTrainingCount = recentActivity.filter((a) => a.status !== "Unanswered").length;
    const attendedTrainingCount = recentActivity.filter((a) => a.status === "Present" || a.status === "Late").length;
    const trainingAttendanceRate =
        recordedTrainingCount > 0 ? Math.round((attendedTrainingCount / recordedTrainingCount) * 100) : null;

    const avgMinsPerApp = calculatedStats.apps > 0 ? Math.round(calculatedStats.minutes / calculatedStats.apps) : 0;
    const goalsPer90 =
        calculatedStats.minutes >= 45 && calculatedStats.goals > 0
            ? ((calculatedStats.goals / calculatedStats.minutes) * 90).toFixed(2)
            : null;
    const contributionsPer90 =
        calculatedStats.minutes >= 45 && calculatedStats.goals + calculatedStats.assists > 0
            ? (((calculatedStats.goals + calculatedStats.assists) / calculatedStats.minutes) * 90).toFixed(2)
            : null;
    const cleanSheetRate =
        calculatedStats.apps > 0 ? Math.round((calculatedStats.cleanSheets / calculatedStats.apps) * 100) : 0;
    const isDefensivePlayer =
        pUpper === "GK" ||
        pUpper.includes("GK") ||
        pUpper.includes("KEEPER") ||
        ["CB", "RB", "LB", "DEF", "RWB", "LWB", "LCB", "RCB"].includes(pUpper) ||
        pUpper.includes("DEF") ||
        pUpper.includes("BACK");

    // Last 5 played matches for form strip (chronological oldest -> newest left-to-right, or newest on right)
    const lastFiveForm = matchLog
        .filter((m) => m.role !== "Unused Sub" && (m.result === "Win" || m.result === "Draw" || m.result === "Loss"))
        .slice(0, 5)
        .reverse();

    const STATUS_OPTIONS: MedicalStatus[] = [
        "Available",
        "Doubtful",
        "Injured",
        "Holiday",
        "Suspended",
        "At Parent Club",
    ];

    return (
        <div className="space-y-5">
            {/* Top Navigation, Prev/Next Switcher & Season / Competition Controls */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3 flex-wrap">
                    <Link
                        href="/squad"
                        className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <span className="h-8 w-8 rounded-lg border border-border bg-surface-1 flex items-center justify-center shadow-sm">
                            <ArrowLeft className="h-4 w-4" />
                        </span>
                        <span>Back to Squad</span>
                    </Link>

                    {/* Prev / Next Player Switcher */}
                    {prevPlayer && nextPlayer && (
                        <div className="inline-flex items-center rounded-lg border border-border bg-surface-1 p-0.5 shadow-sm">
                            <Link
                                href={`/squad/${prevPlayer.id}`}
                                title={`Previous: ${prevPlayer.name} (${prevPlayer.position})`}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-surface-2 transition-colors"
                            >
                                <ChevronLeft className="h-3.5 w-3.5 shrink-0" />
                                <span className="hidden sm:inline max-w-[110px] truncate">{prevPlayer.name}</span>
                                <span className="sm:hidden">Prev</span>
                            </Link>
                            {squadNavIndex && (
                                <span className="px-2 text-[10px] font-mono font-bold text-muted-foreground border-x border-border/60 select-none">
                                    {squadNavIndex.current}/{squadNavIndex.total}
                                </span>
                            )}
                            <Link
                                href={`/squad/${nextPlayer.id}`}
                                title={`Next: ${nextPlayer.name} (${nextPlayer.position})`}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-surface-2 transition-colors"
                            >
                                <span className="hidden sm:inline max-w-[110px] truncate">{nextPlayer.name}</span>
                                <span className="sm:hidden">Next</span>
                                <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                            </Link>
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    <select
                        value={seasonFilter}
                        onChange={(e) => setSeasonFilter(e.target.value)}
                        className="h-9 px-3 bg-surface-1 border border-border rounded-lg text-xs font-semibold text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer"
                    >
                        <option value="All">All Time Stats</option>
                        {availableSeasons.map((s) => (
                            <option key={s} value={s}>
                                {s} Season
                            </option>
                        ))}
                    </select>
                    <Button
                        variant={includeFriendlies ? "default" : "outline"}
                        onClick={toggleIncludeFriendlies}
                        className={
                            includeFriendlies
                                ? "bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs h-9 rounded-lg shadow-sm"
                                : "bg-surface-1 text-muted-foreground hover:text-foreground border-border font-semibold text-xs h-9 rounded-lg shadow-sm"
                        }
                    >
                        {includeFriendlies ? "⚽ Including Friendlies" : "🏆 Competitive Only"}
                    </Button>
                </div>
            </div>

            {isFormer && (
                <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2 text-sm font-bold text-amber-800 dark:text-amber-300">
                            <Archive className="w-4 h-4" />
                            <span>Former Player — {departureInfo.departureReason || departureInfo.departureStatus}</span>
                            {departureInfo.departureDate && (
                                <span className="text-xs font-normal text-amber-700 dark:text-amber-400">
                                    (Left on{" "}
                                    {new Date(departureInfo.departureDate + "T00:00:00").toLocaleDateString("en-GB", {
                                        day: "numeric",
                                        month: "short",
                                        year: "numeric",
                                    })}
                                    )
                                </span>
                            )}
                        </div>
                        {departureInfo.departureNotes && (
                            <p className="text-xs text-amber-700 dark:text-amber-300/90 italic">
                                Note: &ldquo;{departureInfo.departureNotes}&rdquo;
                            </p>
                        )}
                        <p className="text-xs text-muted-foreground">
                            Historical match statistics and training records are preserved. You can restore this player to the active squad at any time.
                        </p>
                    </div>
                    <Button
                        onClick={handleRestore}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white shrink-0 text-xs h-9 gap-1.5"
                    >
                        <RotateCcw className="h-3.5 w-3.5" /> Restore to Active Squad
                    </Button>
                </div>
            )}

            {/* Header Section */}
            <div className="flex flex-col md:flex-row gap-5 items-start bg-surface-1 p-5 sm:p-6 rounded-xl border border-border shadow-sm">
                <div className="relative shrink-0">
                    <Avatar className="h-24 w-24 sm:h-28 sm:w-28 border-2 border-border shadow-sm bg-surface-2">
                        <AvatarImage
                            src={
                                player.imageUrl &&
                                player.imageUrl !== "/placeholder-player.png" &&
                                !player.imageUrl.startsWith("idb:")
                                    ? player.imageUrl
                                    : undefined
                            }
                            alt={formatPlayerName(player)}
                            className="object-cover"
                        />
                        <AvatarFallback className="text-2xl sm:text-3xl bg-surface-2 text-foreground font-extrabold tracking-tight">
                            {player.firstName?.[0]}
                            {player.lastName?.[0]}
                        </AvatarFallback>
                    </Avatar>
                    {player.squadNumber > 0 && (
                        <span className="absolute -bottom-1 -right-1 px-2 py-0.5 rounded-md bg-foreground text-background font-mono text-xs font-extrabold shadow">
                            #{player.squadNumber}
                        </span>
                    )}
                </div>

                <div className="flex-1 w-full space-y-4">
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                        <div className="space-y-2">
                            <div className="flex items-center gap-2.5 flex-wrap">
                                <h2 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
                                    {formatPlayerName(player)}
                                </h2>
                                {!isFormer && (
                                    <div className="relative inline-flex items-center gap-1.5 flex-wrap">
                                        <Badge
                                            onClick={handleOpenStatusPicker}
                                            title="Click to change player status"
                                            className={cn(
                                                "border cursor-pointer select-none text-xs px-2.5 py-0.5 rounded-md font-semibold transition-colors inline-flex items-center gap-1",
                                                getStatusBadgeStyle(player.medicalStatus)
                                            )}
                                        >
                                            <span>{player.medicalStatus}</span>
                                            <ChevronDown className="h-3 w-3 opacity-70" />
                                        </Badge>
                                        {statusContextText && (
                                            <span className="text-xs font-medium text-muted-foreground bg-surface-2 border border-border/70 px-2 py-0.5 rounded-md">
                                                {statusContextText}
                                            </span>
                                        )}

                                        {/* Status Quick-Picker Popover */}
                                        {isStatusPickerOpen && (
                                            <>
                                                <div
                                                    className="fixed inset-0 z-40"
                                                    onClick={() => setIsStatusPickerOpen(false)}
                                                />
                                                <div className="absolute left-0 top-full mt-2 z-50 w-72 sm:w-80 rounded-xl border border-border bg-surface-1 p-3.5 shadow-xl space-y-3">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                                                            Set Availability Status
                                                        </span>
                                                        <button
                                                            type="button"
                                                            onClick={() => setIsStatusPickerOpen(false)}
                                                            className="text-xs text-muted-foreground hover:text-foreground"
                                                        >
                                                            ✕
                                                        </button>
                                                    </div>

                                                    <div className="grid grid-cols-2 gap-1.5">
                                                        {STATUS_OPTIONS.map((st) => {
                                                            const active = pickerStatus === st;
                                                            return (
                                                                <button
                                                                    key={st}
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setPickerStatus(st);
                                                                        if (st === "Available" || st === "At Parent Club") {
                                                                            handleSaveQuickStatus(st);
                                                                        }
                                                                    }}
                                                                    className={cn(
                                                                        "px-2.5 py-1.5 rounded-lg border text-xs font-semibold text-left flex items-center justify-between transition-all",
                                                                        active
                                                                            ? getStatusBadgeStyle(st)
                                                                            : "bg-surface-2/60 border-border text-muted-foreground hover:text-foreground hover:bg-surface-2"
                                                                    )}
                                                                >
                                                                    <span className="truncate">{st}</span>
                                                                    {active && <Check className="h-3 w-3 shrink-0" />}
                                                                </button>
                                                            );
                                                        })}
                                                    </div>

                                                    {(pickerStatus === "Injured" || pickerStatus === "Doubtful") && (
                                                        <div className="space-y-2 pt-1 border-t border-border/60">
                                                            <Input
                                                                placeholder="Injury / issue (e.g. Hamstring)"
                                                                value={pickerInjuryType}
                                                                onChange={(e) => setPickerInjuryType(e.target.value)}
                                                                className="h-8 text-xs"
                                                            />
                                                            <Input
                                                                placeholder="Expected return (e.g. 2 weeks)"
                                                                value={pickerInjuryDuration}
                                                                onChange={(e) => setPickerInjuryDuration(e.target.value)}
                                                                className="h-8 text-xs"
                                                            />
                                                            <Button
                                                                size="sm"
                                                                disabled={isSavingStatus}
                                                                onClick={() => handleSaveQuickStatus()}
                                                                className="w-full h-8 text-xs font-semibold"
                                                            >
                                                                {isSavingStatus ? "Saving..." : `Save ${pickerStatus} Status`}
                                                            </Button>
                                                        </div>
                                                    )}

                                                    {pickerStatus === "Holiday" && (
                                                        <div className="space-y-2 pt-1 border-t border-border/60">
                                                            <div className="grid grid-cols-2 gap-2">
                                                                <div>
                                                                    <label className="text-[10px] font-bold uppercase text-muted-foreground block mb-1">
                                                                        From
                                                                    </label>
                                                                    <Input
                                                                        type="date"
                                                                        value={pickerHolidayStart}
                                                                        onChange={(e) => setPickerHolidayStart(e.target.value)}
                                                                        className="h-8 text-xs px-2"
                                                                    />
                                                                </div>
                                                                <div>
                                                                    <label className="text-[10px] font-bold uppercase text-muted-foreground block mb-1">
                                                                        Return Date
                                                                    </label>
                                                                    <Input
                                                                        type="date"
                                                                        value={pickerHolidayEnd}
                                                                        onChange={(e) => setPickerHolidayEnd(e.target.value)}
                                                                        className="h-8 text-xs px-2"
                                                                    />
                                                                </div>
                                                            </div>
                                                            <Button
                                                                size="sm"
                                                                disabled={isSavingStatus}
                                                                onClick={() => handleSaveQuickStatus()}
                                                                className="w-full h-8 text-xs font-semibold"
                                                            >
                                                                {isSavingStatus ? "Saving..." : "Save Holiday Dates"}
                                                            </Button>
                                                        </div>
                                                    )}

                                                    {pickerStatus === "Suspended" && (
                                                        <div className="space-y-2 pt-1 border-t border-border/60">
                                                            <Input
                                                                placeholder="Reason (e.g. 5 Yellow Cards / Red Card)"
                                                                value={pickerSuspensionReason}
                                                                onChange={(e) => setPickerSuspensionReason(e.target.value)}
                                                                className="h-8 text-xs"
                                                            />
                                                            <Input
                                                                placeholder="Duration (e.g. 1 Match)"
                                                                value={pickerSuspensionDuration}
                                                                onChange={(e) => setPickerSuspensionDuration(e.target.value)}
                                                                className="h-8 text-xs"
                                                            />
                                                            <Button
                                                                size="sm"
                                                                disabled={isSavingStatus}
                                                                onClick={() => handleSaveQuickStatus()}
                                                                className="w-full h-8 text-xs font-semibold"
                                                            >
                                                                {isSavingStatus ? "Saving..." : "Save Suspension"}
                                                            </Button>
                                                        </div>
                                                    )}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="flex items-center gap-2 flex-wrap">
                                <span
                                    className={cn(
                                        "font-bold px-2 py-0.5 border rounded text-xs uppercase tracking-tight",
                                        posBadgeClass
                                    )}
                                >
                                    {player.position}
                                </span>
                                {secPositions.length > 0 && (
                                    <span className="text-xs text-muted-foreground font-medium px-2 py-0.5 rounded bg-surface-2 border border-border/60">
                                        Also plays: <strong className="text-foreground">{secPositions.join(", ")}</strong>
                                    </span>
                                )}
                                {squadList.map((sq) => (
                                    <Badge key={sq} variant="secondary" className="bg-surface-2 text-foreground border border-border text-xs font-semibold">
                                        {sq}
                                    </Badge>
                                ))}
                                {(player.registrationType === "Loan" || player.registrationType === "Dual") && (
                                    <Badge variant="outline" className="border-purple-500/30 text-purple-600 dark:text-purple-400 bg-purple-500/10 text-xs font-semibold">
                                        {player.registrationType === "Loan"
                                            ? player.isParentClub
                                                ? "Loaned Out"
                                                : "Loan In"
                                            : "Dual Reg"}
                                    </Badge>
                                )}
                                {player.loanClub && (
                                    <Badge variant="outline" className="border-purple-500/30 text-purple-600 dark:text-purple-400 bg-purple-500/10 gap-1 text-xs font-semibold">
                                        <Building2 className="w-3 h-3" />
                                        {player.registrationType === "Loan"
                                            ? player.isParentClub
                                                ? `To: ${player.loanClub}`
                                                : `From: ${player.loanClub}`
                                            : `Dual: ${player.loanClub}`}
                                    </Badge>
                                )}
                                {player.registrationType === "Loan" && player.loanEndDate && (
                                    <Badge
                                        variant="outline"
                                        className={cn(
                                            "gap-1 text-xs font-semibold",
                                            getLoanExpiryStatus(player.loanEndDate).status === "expired"
                                                ? "border-red-500/30 text-red-600 dark:text-red-400 bg-red-500/10"
                                                : getLoanExpiryStatus(player.loanEndDate).status === "expiring_soon"
                                                ? "border-amber-500/30 text-amber-600 dark:text-amber-400 bg-amber-500/10"
                                                : "border-border text-muted-foreground bg-surface-2"
                                        )}
                                    >
                                        <Clock className="w-3 h-3" />
                                        {getLoanExpiryStatus(player.loanEndDate).label}
                                    </Badge>
                                )}
                                {isFormer && (
                                    <Badge variant="outline" className="border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/10">
                                        {departureInfo.departureReason || departureInfo.departureStatus}
                                    </Badge>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center flex-wrap gap-2 shrink-0">
                            {isFormer ? (
                                <Button
                                    variant="outline"
                                    onClick={handleRestore}
                                    className="border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 h-9 px-3 text-xs font-semibold gap-1.5 rounded-lg"
                                >
                                    <RotateCcw className="h-3.5 w-3.5" /> Restore to Squad
                                </Button>
                            ) : (
                                <Button
                                    variant="ghost"
                                    onClick={handleOpenDepartureDialog}
                                    className="text-muted-foreground hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-500/10 border border-transparent hover:border-amber-500/25 h-9 px-3 text-xs font-medium gap-1.5 rounded-lg"
                                >
                                    <UserMinus className="h-3.5 w-3.5" /> Mark as Left Club
                                </Button>
                            )}
                            <Button
                                variant="outline"
                                asChild
                                className="bg-surface-2 hover:bg-border/60 text-foreground border-border h-9 px-3.5 text-xs font-semibold gap-1.5 rounded-lg shadow-sm"
                            >
                                <Link href={`/squad?edit=${player.id}&returnTo=/squad/${player.id}`}>
                                    <Edit className="h-3.5 w-3.5" /> Edit Profile
                                </Link>
                            </Button>
                        </div>
                    </div>

                    {/* Attribute Strip — Only shows populated fields + Last 5 Form */}
                    <div className="flex flex-wrap items-start gap-x-8 gap-y-3 pt-3.5 border-t border-border/60">
                        <div>
                            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Age / DOB</p>
                            <p className="font-semibold text-foreground text-sm mt-0.5">
                                {displayAge ? `${displayAge} yrs` : "—"}
                                {formattedDob && (
                                    <span className="ml-1.5 text-xs text-muted-foreground font-normal">({formattedDob})</span>
                                )}
                            </p>
                        </div>
                        {player.preferredFoot && (
                            <div>
                                <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Preferred Foot</p>
                                <p className="font-semibold text-foreground text-sm mt-0.5 flex items-center gap-1">
                                    <Footprints className="w-3.5 h-3.5 text-muted-foreground" />
                                    {player.preferredFoot}
                                </p>
                            </div>
                        )}
                        {(player.height || player.weight) && (
                            <div>
                                <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Physical</p>
                                <p className="font-semibold text-foreground text-sm mt-0.5 flex items-center gap-1">
                                    <Ruler className="w-3.5 h-3.5 text-muted-foreground" />
                                    {[player.height ? `${player.height}cm` : null, player.weight ? `${player.weight}kg` : null]
                                        .filter(Boolean)
                                        .join(" • ")}
                                </p>
                            </div>
                        )}
                        {player.loanClub && (
                            <div>
                                <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                                    {player.registrationType === "Loan"
                                        ? player.isParentClub
                                            ? "Loaned To"
                                            : "Parent Club"
                                        : "Dual Reg Club"}
                                </p>
                                <p className="font-semibold text-purple-600 dark:text-purple-400 text-sm mt-0.5">{player.loanClub}</p>
                            </div>
                        )}
                        {lastFiveForm.length > 0 && (
                            <div>
                                <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                                    Recent Form (Last {lastFiveForm.length})
                                </p>
                                <div className="flex items-center gap-1 mt-1">
                                    {lastFiveForm.map((fm, i) => {
                                        const letter = fm.result === "Win" ? "W" : fm.result === "Draw" ? "D" : "L";
                                        const pillCls =
                                            fm.result === "Win"
                                                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                                                : fm.result === "Draw"
                                                ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30"
                                                : "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30";
                                        return (
                                            <Link
                                                key={`${fm.matchId}-${i}`}
                                                href={`/analysis?matchId=${fm.matchId}`}
                                                title={`${letter} ${fm.scoreline || ""} vs ${fm.opponent} (${fm.isHome ? "H" : "A"})${fm.goals ? ` • ${fm.goals}G` : ""}${fm.assists ? ` • ${fm.assists}A` : ""}`}
                                                className={cn(
                                                    "w-6 h-6 rounded-md border text-[11px] font-extrabold flex items-center justify-center transition-transform hover:scale-110",
                                                    pillCls
                                                )}
                                            >
                                                {letter}
                                            </Link>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Clean Coach / Medical Notes (if present) */}
                    {(cleanPlayerNotes || player.medicalNotes) && (
                        <div className="pt-3 border-t border-border/60 flex flex-col sm:flex-row gap-3 text-xs">
                            {cleanPlayerNotes && (
                                <div className="flex-1 p-2.5 rounded-lg bg-surface-2/70 border border-border/60">
                                    <span className="font-bold uppercase tracking-wider text-[10px] text-muted-foreground block mb-0.5">
                                        Player Notes
                                    </span>
                                    <p className="text-foreground">{cleanPlayerNotes}</p>
                                </div>
                            )}
                            {player.medicalNotes && (
                                <div className="flex-1 p-2.5 rounded-lg bg-rose-500/5 border border-rose-500/20">
                                    <span className="font-bold uppercase tracking-wider text-[10px] text-rose-600 dark:text-rose-400 block mb-0.5">
                                        Medical Notes
                                    </span>
                                    <p className="text-foreground">{player.medicalNotes}</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <div className="space-y-5">
                <div className="grid gap-3.5 grid-cols-2 lg:grid-cols-4">
                    {/* Appearances */}
                    <Card className="bg-surface-1 border-border shadow-sm overflow-hidden">
                        <CardHeader className="pb-1 pt-3.5 px-4">
                            <div className="text-[11px] uppercase tracking-wider font-bold text-indigo-600 dark:text-indigo-400 flex justify-between items-center">
                                <span>Appearances</span>
                                <span className="text-[10px] text-muted-foreground normal-case font-medium">
                                    {calculatedStats.starts} Starts • {calculatedStats.subApps} Subs
                                </span>
                            </div>
                        </CardHeader>
                        <CardContent className="pb-3.5 px-4">
                            <div className="text-2xl sm:text-3xl font-extrabold text-foreground">{calculatedStats.apps}</div>
                        </CardContent>
                    </Card>

                    {/* Goals */}
                    <Card className="bg-surface-1 border-border shadow-sm overflow-hidden">
                        <CardHeader className="pb-1 pt-3.5 px-4">
                            <div className="text-[11px] uppercase tracking-wider font-bold text-emerald-600 dark:text-emerald-400 flex justify-between items-center">
                                <span>Goals</span>
                                {goalsPer90 && (
                                    <span className="text-[10px] text-muted-foreground normal-case font-medium">
                                        {goalsPer90} / 90
                                    </span>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent className="pb-3.5 px-4">
                            <div className="text-2xl sm:text-3xl font-extrabold text-foreground">{calculatedStats.goals}</div>
                        </CardContent>
                    </Card>

                    {/* Assists */}
                    <Card className="bg-surface-1 border-border shadow-sm overflow-hidden">
                        <CardHeader className="pb-1 pt-3.5 px-4">
                            <div className="text-[11px] uppercase tracking-wider font-bold text-sky-600 dark:text-sky-400">
                                Assists
                            </div>
                        </CardHeader>
                        <CardContent className="pb-3.5 px-4">
                            <div className="text-2xl sm:text-3xl font-extrabold text-foreground">{calculatedStats.assists}</div>
                        </CardContent>
                    </Card>

                    {/* Position-Aware 4th Card: Clean Sheets for GK/DEF, Goal Contributions for MID/FWD */}
                    {isDefensivePlayer ? (
                        <Card className="bg-surface-1 border-border shadow-sm overflow-hidden">
                            <CardHeader className="pb-1 pt-3.5 px-4">
                                <div className="text-[11px] uppercase tracking-wider font-bold text-teal-600 dark:text-teal-400 flex justify-between items-center">
                                    <span className="inline-flex items-center gap-1">
                                        <ShieldCheck className="w-3.5 h-3.5" /> Clean Sheets
                                    </span>
                                    {calculatedStats.apps > 0 && (
                                        <span className="text-[10px] text-muted-foreground normal-case font-medium">
                                            {cleanSheetRate}% of apps
                                        </span>
                                    )}
                                </div>
                            </CardHeader>
                            <CardContent className="pb-3.5 px-4">
                                <div className="text-2xl sm:text-3xl font-extrabold text-foreground">
                                    {calculatedStats.cleanSheets}
                                </div>
                            </CardContent>
                        </Card>
                    ) : (
                        <Card className="bg-surface-1 border-border shadow-sm overflow-hidden">
                            <CardHeader className="pb-1 pt-3.5 px-4">
                                <div className="text-[11px] uppercase tracking-wider font-bold text-purple-600 dark:text-purple-400 flex justify-between items-center">
                                    <span>Goal Contributions</span>
                                    {contributionsPer90 && (
                                        <span className="text-[10px] text-muted-foreground normal-case font-medium">
                                            {contributionsPer90} / 90
                                        </span>
                                    )}
                                </div>
                            </CardHeader>
                            <CardContent className="pb-3.5 px-4">
                                <div className="text-2xl sm:text-3xl font-extrabold text-foreground">
                                    {calculatedStats.goals + calculatedStats.assists}
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Mins Played */}
                    <Card className="bg-surface-1 border-border shadow-sm overflow-hidden">
                        <CardHeader className="pb-1 pt-3.5 px-4">
                            <div className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground flex justify-between items-center">
                                <span>Minutes Played</span>
                                {avgMinsPerApp > 0 && (
                                    <span className="text-[10px] text-muted-foreground normal-case font-medium">
                                        {avgMinsPerApp} mins/app
                                    </span>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent className="pb-3.5 px-4">
                            <div className="text-2xl sm:text-3xl font-extrabold text-foreground">{calculatedStats.minutes}</div>
                        </CardContent>
                    </Card>

                    {/* Win Rate */}
                    <Card className="bg-surface-1 border-border shadow-sm overflow-hidden">
                        <CardHeader className="pb-1 pt-3.5 px-4">
                            <div className="text-[11px] uppercase tracking-wider font-bold text-amber-600 dark:text-amber-400 flex justify-between items-center">
                                <span>Win Rate</span>
                                <span className="text-[10px] text-muted-foreground normal-case font-medium">
                                    {calculatedStats.wins}W - {calculatedStats.draws}D - {calculatedStats.losses}L
                                    {!isDefensivePlayer && calculatedStats.cleanSheets > 0
                                        ? ` • ${calculatedStats.cleanSheets} CS`
                                        : ""}
                                </span>
                            </div>
                        </CardHeader>
                        <CardContent className="pb-3.5 px-4">
                            <div className="text-2xl sm:text-3xl font-extrabold text-foreground">{calculatedStats.winRate}%</div>
                            <div className="w-full bg-surface-2 h-1.5 rounded-full mt-2 overflow-hidden">
                                <div className="bg-amber-500 h-1.5 rounded-full transition-all" style={{ width: `${calculatedStats.winRate}%` }}></div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Yellow Cards */}
                    <Card className="bg-surface-1 border-border shadow-sm overflow-hidden">
                        <CardHeader className="pb-1 pt-3.5 px-4">
                            <div className="text-[11px] uppercase tracking-wider font-bold text-yellow-600 dark:text-yellow-400">
                                Yellow Cards
                            </div>
                        </CardHeader>
                        <CardContent className="pb-3.5 px-4">
                            <div className="text-2xl sm:text-3xl font-extrabold text-foreground">{calculatedStats.yellow}</div>
                        </CardContent>
                    </Card>

                    {/* Red Cards */}
                    <Card className="bg-surface-1 border-border shadow-sm overflow-hidden">
                        <CardHeader className="pb-1 pt-3.5 px-4">
                            <div className="text-[11px] uppercase tracking-wider font-bold text-rose-600 dark:text-rose-400">
                                Red Cards
                            </div>
                        </CardHeader>
                        <CardContent className="pb-3.5 px-4">
                            <div className="text-2xl sm:text-3xl font-extrabold text-foreground">{calculatedStats.red}</div>
                        </CardContent>
                    </Card>
                </div>

                {/* Match Log & Training Attendance Section */}
                <Card className="bg-surface-1 border-border shadow-sm">
                    <CardHeader className="pb-3 border-b border-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-2 bg-surface-2 p-1 rounded-lg border border-border w-fit">
                            <button
                                type="button"
                                onClick={() => setActivityTab("matches")}
                                className={cn(
                                    "px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5",
                                    activityTab === "matches"
                                        ? "bg-background text-foreground shadow-sm"
                                        : "text-muted-foreground hover:text-foreground"
                                )}
                            >
                                <Trophy className="w-3.5 h-3.5 text-amber-500" />
                                Match Log ({matchLog.length})
                            </button>
                            <button
                                type="button"
                                onClick={() => setActivityTab("training")}
                                className={cn(
                                    "px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5",
                                    activityTab === "training"
                                        ? "bg-background text-foreground shadow-sm"
                                        : "text-muted-foreground hover:text-foreground"
                                )}
                            >
                                <Activity className="w-3.5 h-3.5 text-emerald-500" />
                                Training Attendance ({recentActivity.length})
                            </button>
                        </div>

                        {trainingAttendanceRate !== null && (
                            <div className="text-xs text-muted-foreground font-medium">
                                Recent Training Attendance:{" "}
                                <span className="font-bold text-foreground">
                                    {trainingAttendanceRate}% ({attendedTrainingCount}/{recordedTrainingCount})
                                </span>
                            </div>
                        )}
                    </CardHeader>
                    <CardContent className="pt-4">
                        {activityTab === "matches" ? (
                            matchLog.length === 0 ? (
                                <p className="text-sm text-muted-foreground italic py-4 text-center">
                                    No match appearances recorded for this period.
                                </p>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-xs text-left border-collapse">
                                        <thead>
                                            <tr className="border-b border-border text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                                <th className="py-2.5 pr-3">Date</th>
                                                <th className="py-2.5 px-3">Fixture</th>
                                                <th className="py-2.5 px-3 hidden sm:table-cell">Competition</th>
                                                <th className="py-2.5 px-2 text-center">Result</th>
                                                <th className="py-2.5 px-2 text-center">Role</th>
                                                <th className="py-2.5 px-2 text-center">Mins</th>
                                                <th className="py-2.5 px-2 text-center">G</th>
                                                <th className="py-2.5 px-2 text-center">A</th>
                                                <th className="py-2.5 pl-2 text-center">Cards</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border/60">
                                            {matchLog.map((m, idx) => {
                                                const dObj = m.date ? new Date(m.date) : null;
                                                const dateLabel =
                                                    dObj && !isNaN(dObj.getTime())
                                                        ? dObj.toLocaleDateString("en-GB", {
                                                              day: "numeric",
                                                              month: "short",
                                                              year: "2-digit",
                                                          })
                                                        : m.date || "—";
                                                const resBadge =
                                                    m.result === "Win"
                                                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25"
                                                        : m.result === "Loss"
                                                        ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/25"
                                                        : m.result === "Draw"
                                                        ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25"
                                                        : "bg-surface-2 text-muted-foreground border-border";

                                                return (
                                                    <tr
                                                        key={`${m.matchId}-${idx}`}
                                                        onClick={() => router.push(`/analysis?matchId=${m.matchId}`)}
                                                        title={`Open match analysis vs ${m.opponent}`}
                                                        className="group hover:bg-surface-2/60 transition-colors cursor-pointer"
                                                    >
                                                        <td className="py-2.5 pr-3 font-medium text-muted-foreground whitespace-nowrap">
                                                            {dateLabel}
                                                        </td>
                                                        <td className="py-2.5 px-3 font-bold text-foreground">
                                                            <div className="inline-flex items-center gap-1.5">
                                                                <span className="group-hover:text-brand transition-colors">{m.opponent}</span>
                                                                <span className="text-[10px] font-semibold text-muted-foreground">
                                                                    ({m.isHome ? "H" : "A"})
                                                                </span>
                                                                <ExternalLink className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                                                            </div>
                                                        </td>
                                                        <td className="py-2.5 px-3 text-muted-foreground hidden sm:table-cell">
                                                            {m.competition}
                                                        </td>
                                                        <td className="py-2.5 px-2 text-center whitespace-nowrap">
                                                            <div className="inline-flex items-center gap-1">
                                                                <span className={cn("inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-bold", resBadge)}>
                                                                    {m.result === "Win" ? "W" : m.result === "Loss" ? "L" : m.result === "Draw" ? "D" : "—"}
                                                                    {m.scoreline && <span className="font-mono">{m.scoreline}</span>}
                                                                </span>
                                                                {m.cleanSheet && (
                                                                    <span
                                                                        title="Clean Sheet"
                                                                        className="px-1 py-0.5 rounded bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/25 text-[9px] font-extrabold"
                                                                    >
                                                                        CS
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="py-2.5 px-2 text-center">
                                                            <span
                                                                className={cn(
                                                                    "px-1.5 py-0.5 rounded text-[10px] font-semibold",
                                                                    m.role === "Starter"
                                                                        ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
                                                                        : m.role === "Sub"
                                                                        ? "bg-sky-500/10 text-sky-600 dark:text-sky-400"
                                                                        : "bg-surface-2 text-muted-foreground"
                                                                )}
                                                            >
                                                                {m.role}
                                                            </span>
                                                        </td>
                                                        <td className="py-2.5 px-2 text-center font-mono text-muted-foreground">
                                                            {m.minutes}&apos;
                                                        </td>
                                                        <td className="py-2.5 px-2 text-center font-bold">
                                                            {m.goals > 0 ? (
                                                                <span className="text-emerald-600 dark:text-emerald-400">{m.goals}</span>
                                                            ) : (
                                                                <span className="text-muted-foreground/40">—</span>
                                                            )}
                                                        </td>
                                                        <td className="py-2.5 px-2 text-center font-bold">
                                                            {m.assists > 0 ? (
                                                                <span className="text-sky-600 dark:text-sky-400">{m.assists}</span>
                                                            ) : (
                                                                <span className="text-muted-foreground/40">—</span>
                                                            )}
                                                        </td>
                                                        <td className="py-2.5 pl-2 text-center">
                                                            <div className="inline-flex items-center justify-center gap-1">
                                                                {m.yellow > 0 && (
                                                                    <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-foreground">
                                                                        <span className="w-2 h-2.5 bg-yellow-400 rounded-[1px] inline-block" />
                                                                        {m.yellow > 1 ? m.yellow : ""}
                                                                    </span>
                                                                )}
                                                                {m.red > 0 && (
                                                                    <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-foreground">
                                                                        <span className="w-2 h-2.5 bg-red-500 rounded-[1px] inline-block" />
                                                                        {m.red > 1 ? m.red : ""}
                                                                    </span>
                                                                )}
                                                                {m.yellow === 0 && m.red === 0 && (
                                                                    <span className="text-muted-foreground/40">—</span>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                        <tfoot>
                                            <tr className="border-t-2 border-border bg-surface-2/50 font-bold text-foreground text-xs">
                                                <td className="py-2.5 pr-3 text-[10px] uppercase tracking-wider text-muted-foreground">
                                                    Totals
                                                </td>
                                                <td className="py-2.5 px-3">
                                                    {calculatedStats.apps} {calculatedStats.apps === 1 ? "Appearance" : "Appearances"}
                                                    <span className="ml-1.5 text-[10px] font-normal text-muted-foreground">
                                                        ({calculatedStats.starts} Starts, {calculatedStats.subApps} Subs)
                                                    </span>
                                                </td>
                                                <td className="py-2.5 px-3 hidden sm:table-cell text-[10px] text-muted-foreground font-medium">
                                                    {calculatedStats.wins}W • {calculatedStats.draws}D • {calculatedStats.losses}L
                                                </td>
                                                <td className="py-2.5 px-2 text-center text-[10px] text-teal-600 dark:text-teal-400">
                                                    {calculatedStats.cleanSheets > 0 ? `${calculatedStats.cleanSheets} CS` : "—"}
                                                </td>
                                                <td className="py-2.5 px-2 text-center text-[10px] text-muted-foreground">
                                                    {avgMinsPerApp > 0 ? `${avgMinsPerApp}m avg` : "—"}
                                                </td>
                                                <td className="py-2.5 px-2 text-center font-mono">
                                                    {calculatedStats.minutes}&apos;
                                                </td>
                                                <td className="py-2.5 px-2 text-center text-emerald-600 dark:text-emerald-400">
                                                    {calculatedStats.goals}
                                                </td>
                                                <td className="py-2.5 px-2 text-center text-sky-600 dark:text-sky-400">
                                                    {calculatedStats.assists}
                                                </td>
                                                <td className="py-2.5 pl-2 text-center">
                                                    <div className="inline-flex items-center justify-center gap-1.5">
                                                        {calculatedStats.yellow > 0 && (
                                                            <span className="inline-flex items-center gap-0.5 text-[10px] font-bold">
                                                                <span className="w-2 h-2.5 bg-yellow-400 rounded-[1px] inline-block" />
                                                                {calculatedStats.yellow}
                                                            </span>
                                                        )}
                                                        {calculatedStats.red > 0 && (
                                                            <span className="inline-flex items-center gap-0.5 text-[10px] font-bold">
                                                                <span className="w-2 h-2.5 bg-red-500 rounded-[1px] inline-block" />
                                                                {calculatedStats.red}
                                                            </span>
                                                        )}
                                                        {calculatedStats.yellow === 0 && calculatedStats.red === 0 && (
                                                            <span className="text-muted-foreground/40">—</span>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            )
                        ) : (
                            <div className="space-y-3">
                                {recentActivity.length === 0 ? (
                                    <p className="text-sm text-muted-foreground italic py-4 text-center">
                                        No recent training sessions recorded.
                                    </p>
                                ) : (
                                    recentActivity.map((activity, i) => {
                                        const dateFormatted = new Date(activity.date).toLocaleDateString("en-GB", {
                                            day: "numeric",
                                            month: "short",
                                            year: "numeric"
                                        });
                                        return (
                                            <div key={i} className="flex items-center gap-3.5 border-b border-border/60 pb-3 last:border-0 last:pb-0">
                                                <div className={`h-2.5 w-2.5 rounded-full shrink-0 ${
                                                    activity.status === "Present" ? "bg-emerald-500" : activity.status === "Late" ? "bg-amber-500" : activity.status === "Absent" ? "bg-rose-500" : "bg-muted-foreground/50"
                                                }`} />
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-xs sm:text-sm font-semibold text-foreground">
                                                        Training Session — {dateFormatted}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground">
                                                        Topic: {activity.topic} •{" "}
                                                        <span className={`font-bold ${
                                                            activity.status === "Present"
                                                                ? "text-emerald-600 dark:text-emerald-400"
                                                                : activity.status === "Late"
                                                                ? "text-amber-600 dark:text-amber-400"
                                                                : activity.status === "Absent"
                                                                ? "text-rose-600 dark:text-rose-400"
                                                                : "text-muted-foreground"
                                                        }`}>
                                                            {activity.status}
                                                        </span>{" "}
                                                        {activity.notes && `(${activity.notes})`}
                                                    </p>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            <Dialog open={isDepartureOpen} onOpenChange={setIsDepartureOpen}>
                <DialogContent className="sm:max-w-[460px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <UserMinus className="w-5 h-5 text-amber-500" />
                            Mark {formatPlayerName(player)} as Left Club
                        </DialogTitle>
                        <DialogDescription>
                            This will move the player out of your active squad into <strong>Former Players</strong>. All historical appearances, goals, assists, and training attendance records will be preserved.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                        {(player.registrationType === "Loan" || player.registrationType === "Dual") && (
                            <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/25 text-xs text-purple-700 dark:text-purple-300">
                                <strong>{player.registrationType === "Loan" ? "Loan Player" : "Dual-Registered Player"}:</strong> &ldquo;Returned to parent club&rdquo; is recommended when a loan or dual spell concludes.
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
                                        (player.registrationType === "Loan" || player.registrationType === "Dual");
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

                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button
                            variant="outline"
                            onClick={() => setIsDepartureOpen(false)}
                            disabled={isSavingDeparture}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleMarkLeft}
                            disabled={isSavingDeparture}
                            className="bg-amber-600 hover:bg-amber-700 text-white"
                        >
                            {isSavingDeparture ? "Archiving..." : "Mark as Left Club"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

