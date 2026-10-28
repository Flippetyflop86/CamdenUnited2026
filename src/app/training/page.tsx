"use client";

import { useState, useEffect, useRef } from "react";
import { TrainingSession, Player } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, CalendarDays, MapPin, Users, Trash2, Pencil, BarChart3, List, Download, ClipboardList, MessageCircle, Copy, ExternalLink, Link2, Repeat, Clock, Share2, X } from "lucide-react";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/lib/supabase";
import { useClub } from "@/context/club-context";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useSearchParams } from "next/navigation";

import { PageHeader } from "@/components/ui/page-header";
import { PageSection } from "@/components/layout/page-section";
import { SectionHeader } from "@/components/ui/section-header";
import { WeeklyFootballCalendar } from "@/components/calendar/WeeklyFootballCalendar";
import {
    findMatchingActiveSquad,
    isFormerPlayer,
    isPlayerInDeletedSquad,
    parsePlayerDeparture,
    serializeDepartureToNotes,
} from "@/lib/utils";


// I'll stick to native date formatting for zero-dep speed unless complex.
function formatDate(dateStr: string) {
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat("en-GB", { weekday: 'short', day: 'numeric', month: 'short' }).format(date);
}

function getSeasonString(date: Date) {
    const year = date.getFullYear();
    const month = date.getMonth(); // 0-11
    // Season starts June 1st (Month index 5)
    // If before June, we are in the (Year-1)/Year season.
    // If after June, we are in the Year/(Year+1) season.
    const startYear = month < 5 ? year - 1 : year;
    return `${startYear}/${startYear + 1}`;
}

function formatSquad(squad: string) {
    if (squad === "firstTeam") return "First Team";
    if (squad === "midweek") return "Midweek";
    if (squad === "youth") return "Youth";
    return squad;
}

function getPositionGroup(pos?: string): "GK" | "DEF" | "MID" | "FWD" | "OTHER" {
    const p = (pos || "").toUpperCase().trim();
    if (["GK", "GOALKEEPER"].includes(p)) return "GK";
    if (["DEF", "CB", "LCB", "RCB", "RB", "LB", "RWB", "LWB", "DEFENDER"].includes(p)) return "DEF";
    if (["MID", "CM", "CDM", "CAM", "RM", "LM", "MIDFIELDER"].includes(p)) return "MID";
    if (["FWD", "ST", "CF", "RW", "LW", "FORWARD", "STRIKER", "WINGER"].includes(p)) return "FWD";
    return "OTHER";
}

export default function TrainingPage() {
    const { settings, isLoaded: isClubLoaded } = useClub();
    const searchParams = useSearchParams();
    const currentSquads = settings.squads || ["First Team"];
    const healedDeletedSquadIdsRef = useRef<Set<string>>(new Set());

    const [sessions, setSessions] = useState<TrainingSession[]>([]);
    const [players, setPlayers] = useState<Player[]>([]);
    const [activeTab, setActiveTab] = useState<'sessions' | 'stats'>('sessions');

    useEffect(() => {
        if (searchParams?.get("add") === "true") {
            setIsDialogOpen(true);
        }
    }, [searchParams]);

    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
    const [newSession, setNewSession] = useState<{
        date: string;
        time: string;
        location: string;
        squad: string;
        topic: string;
        lockType: string;
        lockTime: string;
        repeatWeekly?: boolean;
        repeatWeeks?: number;
    }>({
        date: "",
        time: "20:15",
        location: settings.trainingLocation || "",
        squad: currentSquads[0] || "First Team",
        topic: "",
        lockType: "Never",
        lockTime: "",
        repeatWeekly: false,
        repeatWeeks: 4
    });

    const [squadFilter, setSquadFilter] = useState<string>("All");
    const [timeFilter, setTimeFilter] = useState<"upcoming" | "past" | "all">("upcoming");
    const [positionFilter, setPositionFilter] = useState<"ALL" | "GK" | "DEF" | "MID" | "FWD">("ALL");
    const [attendanceSortBy, setAttendanceSortBy] = useState<"player" | "squad" | "attended" | "late" | "last5" | "percentage">("percentage");
    const [attendanceSortDir, setAttendanceSortDir] = useState<"asc" | "desc">("desc");

    const handleAttendanceSort = (col: "player" | "squad" | "attended" | "late" | "last5" | "percentage") => {
        if (attendanceSortBy === col) {
            setAttendanceSortDir(prev => (prev === "asc" ? "desc" : "asc"));
        } else {
            setAttendanceSortBy(col);
            setAttendanceSortDir(col === "player" || col === "squad" ? "asc" : "desc");
        }
    };

    // WhatsApp Generated Availability Poll State
    const [activeShareSession, setActiveShareSession] = useState<TrainingSession | null>(null);
    const [includeVenue, setIncludeVenue] = useState(true);
    const [includeTopic, setIncludeTopic] = useState(true);
    const [includeNotes, setIncludeNotes] = useState(true);
    const [additionalNotes, setAdditionalNotes] = useState("");
    const [copyStatus, setCopyStatus] = useState<"idle" | "copied">("idle");

    // Amend Player Start Date & Backfill Sessions State
    const [editingStartDatePlayer, setEditingStartDatePlayer] = useState<any | null>(null);
    const [customStartDateInput, setCustomStartDateInput] = useState<string>("");
    const [sessionStatusOverrides, setSessionStatusOverrides] = useState<Record<string, "Present" | "Late" | "Absent">>({});
    const [isSavingStartDate, setIsSavingStartDate] = useState(false);

    // Active Squad Only toggle & Shareable Training Graphic Studio state
    const [activeSquadOnly, setActiveSquadOnly] = useState<boolean>(false);
    const [showTrainingGraphicModal, setShowTrainingGraphicModal] = useState<boolean>(false);
    const [trainingGraphicFormat, setTrainingGraphicFormat] = useState<"post" | "story">("post");
    const [trainingGraphicScope, setTrainingGraphicScope] = useState<"top10" | "full">("top10");
    const [copiedTrainingGraphic, setCopiedTrainingGraphic] = useState<boolean>(false);
    const trainingShareCanvasRef = useRef<HTMLCanvasElement | null>(null);

    useEffect(() => {
        if (settings.trainingLocation && !newSession.location && !editingSessionId) {
            setNewSession(prev => ({ ...prev, location: settings.trainingLocation || "" }));
        }
    }, [settings.trainingLocation, editingSessionId]);


    useEffect(() => {
        fetchData();

        const channel = supabase
            .channel("public:training_sessions")
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "training_sessions" },
                () => fetchSessionsOnly()
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, []);

    const fetchData = async () => {
        await Promise.all([fetchSessionsOnly(), fetchPlayers()]);
    };

    const fetchSessionsOnly = async () => {
        const { data, error } = await supabase.from("training_sessions").select("*");
        if (!error && data) {
            setSessions(data.map((s: any) => ({
                id: s.id,
                date: s.date,
                time: s.time,
                location: s.location,
                squad: s.squad,
                topic: s.topic,
                attendance: s.attendance || [],
                notes: s.notes
            })));
        }
    };

    const fetchPlayers = async () => {
        const { data, error } = await supabase.from("players").select("*");
        if (!error && data) {
            setPlayers(data.map((p: any) => {
                const matchedActiveSquad = findMatchingActiveSquad(p.squad, currentSquads);
                const resolvedSquad = matchedActiveSquad || (p.squad ? formatSquad(p.squad) : (currentSquads[0] || "First Team"));
                const fullNameLower = `${p.first_name || ""} ${p.last_name || ""}`.trim().toLowerCase();
                const isExplicitJahazi = fullNameLower === "mohammed jahazi";
                const parsedDep = parsePlayerDeparture(p);
                const shouldMarkFormer = parsedDep.isFormer || isExplicitJahazi;

                return {
                    id: p.id,
                    firstName: p.first_name,
                    lastName: p.last_name,
                    squad: resolvedSquad,
                    rawSquad: p.squad,
                    isInTrainingSquad: p.is_in_training_squad,
                    isInMatchdayTracker: p.is_in_matchday_tracker,
                    imageUrl: p.image_url,
                    position: p.position,
                    squadNumber: p.squad_number,
                    medicalStatus: p.medical_status,
                    notes: p.notes,
                    ...parsedDep,
                    ...(shouldMarkFormer && !parsedDep.isFormer
                        ? {
                              isFormer: true,
                              departureStatus: "Left club",
                              departureReason: "Left club",
                          }
                        : {}),
                } as any;
            }));
        }
    };

    // Auto-heal players whose registered squad was deleted from the club's active squads (or Mohammed Jahazi)
    useEffect(() => {
        if (!isClubLoaded || players.length === 0) return;
        const activeSquadList = settings.squads && settings.squads.length > 0 ? settings.squads : ["First Team"];

        const playersToHeal = players.filter((p: any) => {
            if (healedDeletedSquadIdsRef.current.has(p.id)) return false;
            const fullNameLower = `${p.firstName || ""} ${p.lastName || ""}`.trim().toLowerCase();
            const isExplicitJahazi = fullNameLower === "mohammed jahazi";
            const rawSquadStr = p.rawSquad ?? p.squad;
            const inDeletedSquad = isPlayerInDeletedSquad(rawSquadStr, activeSquadList);
            if (!inDeletedSquad && !isExplicitJahazi) return false;
            const alreadyTaggedInNotes = (p.notes || "").includes("[LEFT_STATUS:");
            return !alreadyTaggedInNotes;
        });

        if (playersToHeal.length === 0) return;

        playersToHeal.forEach((p: any) => healedDeletedSquadIdsRef.current.add(p.id));
        const todayIso = new Date().toISOString().split("T")[0];

        setPlayers((prev) =>
            prev.map((p: any) => {
                if (!playersToHeal.some((target) => target.id === p.id)) return p;
                const updatedNotes = serializeDepartureToNotes(p.notes, {
                    reason: "Left club",
                    date: p.departureDate || todayIso,
                });
                return {
                    ...p,
                    notes: updatedNotes,
                    isInTrainingSquad: false,
                    isFormer: true,
                    departureStatus: "Left club",
                    departureReason: "Left club",
                    departureDate: p.departureDate || todayIso,
                };
            })
        );

        playersToHeal.forEach(async (p: any) => {
            const updatedNotes = serializeDepartureToNotes(p.notes, {
                reason: "Left club",
                date: p.departureDate || todayIso,
            });
            await supabase
                .from("players")
                .update({
                    notes: updatedNotes,
                    availability: false,
                    is_in_training_squad: false,
                })
                .eq("id", p.id);
        });
    }, [isClubLoaded, settings.squads, players]);

    // Note: Removed local storage save effect.

    const handleSchedule = async () => {
        const isNew = !editingSessionId;
        const payload: any = {
            date: newSession.date,
            time: newSession.time,
            location: newSession.location,
            squad: newSession.squad,
            topic: newSession.topic || "General Session",
            lock_type: newSession.lockType || "Never",
            lock_time: newSession.lockTime ? new Date(newSession.lockTime).toISOString() : null
        };

        if (isNew) {
            payload.event_token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        }

        try {
            if (editingSessionId) {
                const { error } = await supabase
                    .from("training_sessions")
                    .update(payload)
                    .eq("id", editingSessionId);
                if (error) throw error;
            } else {
                // New session(s)
                const sessionsToInsert = [];
                const numWeeks = newSession.repeatWeekly ? (newSession.repeatWeeks || 4) : 1;
                
                for (let i = 0; i < numWeeks; i++) {
                    const sessionDate = new Date(newSession.date);
                    sessionDate.setDate(sessionDate.getDate() + (i * 7));
                    const dateStr = sessionDate.toISOString().split('T')[0];
                    
                    const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
                    
                    let finalLockTime = null;
                    if (newSession.lockType === "Custom" && newSession.lockTime) {
                        const originalLock = new Date(newSession.lockTime);
                        originalLock.setDate(originalLock.getDate() + (i * 7));
                        finalLockTime = originalLock.toISOString();
                    }

                    sessionsToInsert.push({
                        ...payload,
                        date: dateStr,
                        event_token: token,
                        lock_time: finalLockTime,
                        attendance: [],
                        notes: ""
                    });
                }

                const { error } = await supabase
                    .from("training_sessions")
                    .insert(sessionsToInsert);
                if (error) throw error;
            }
            // Fetch/Subscribe will handle UI update
            setIsDialogOpen(false);
            // Reset form but keep location
            setNewSession({
                date: "",
                time: "20:15",
                location: settings.trainingLocation || "",
                squad: currentSquads[0] || "First Team",
                topic: "",
                lockType: "Never",
                lockTime: "",
                repeatWeekly: false,
                repeatWeeks: 4
            });
            setEditingSessionId(null);
        } catch (e: any) {
            alert("Error saving session: " + e.message);
        }
    };

    const handleRepeatNextWeek = async (session: TrainingSession, e: React.MouseEvent) => {
        e.stopPropagation();
        
        // Calculate date of next week (add 7 days)
        const d = new Date(session.date);
        d.setDate(d.getDate() + 7);
        const nextWeekDate = d.toISOString().split('T')[0];

        const payload = {
            date: nextWeekDate,
            time: session.time,
            location: session.location,
            squad: session.squad,
            topic: session.topic || "General Session"
        };

        try {
            const { error } = await supabase
                .from("training_sessions")
                .insert([{ ...payload, attendance: [], notes: "" }]);

            if (error) throw error;
            alert(`Session repeated successfully for next week (${nextWeekDate})!`);
            fetchSessionsOnly();
        } catch (err: any) {
            alert("Failed to repeat session: " + err.message);
        }
    };

    const handleEdit = (session: TrainingSession) => {
        setNewSession({
            date: session.date,
            time: session.time,
            location: session.location,
            squad: session.squad,
            topic: session.topic || "",
            lockType: (session as any).lock_type || "Never",
            lockTime: (session as any).lock_time ? new Date((session as any).lock_time).toISOString().slice(0, 16) : ""
        });
        setEditingSessionId(session.id);
        setIsDialogOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (window.confirm("Are you sure you want to delete this session?")) {
            const { error } = await supabase.from("training_sessions").delete().eq("id", id);
            if (error) {
                alert("Error deleting session");
            } else {
                // Optimistic or let subscription handle it? Subscription handles it but optimist is nicer
                setSessions(sessions.filter(s => s.id !== id));
            }
        }
    };

    const handleOpenNew = () => {
        setEditingSessionId(null);
        setNewSession({
            date: "",
            time: "20:15",
            location: settings.trainingLocation || "",
            squad: currentSquads[0] || "First Team",
            topic: "",
            lockType: "Never",
            lockTime: ""
        });
        setIsDialogOpen(true);
    };

    const isFirstTeamSquad = (squad: string) => {
        return squad === "firstTeam" || squad === "First Team" || squad === currentSquads[0];
    };

    const isPlayerFormerOrDeleted = (p: any) => {
        return isFormerPlayer(p) || isPlayerInDeletedSquad(p?.rawSquad ?? p?.squad, currentSquads);
    };

    const getSessionAttendanceStats = (session: TrainingSession) => {
        const regAttendedCount = session.attendance.filter(a => !a.playerId.startsWith('guest:') && (a.status === 'Present' || a.status === 'Late')).length;
        const lateCount = session.attendance.filter(a => !a.playerId.startsWith('guest:') && a.status === 'Late').length;
        const trialistAttendedCount = session.attendance.filter(a => a.playerId.startsWith('guest:') && (a.status === 'Present' || a.status === 'Late')).length;

        const eligiblePlayers = players.filter(p => {
            const attendedRecord = session.attendance.some(a => a.playerId === p.id && (a.status === 'Present' || a.status === 'Late'));
            if (isPlayerFormerOrDeleted(p) && !attendedRecord) return false;
            return session.squad === "All" 
                ? (isFirstTeamSquad(p.squad) || p.isInTrainingSquad) 
                : (p.squad === session.squad || (session.squad === "First Team" && isFirstTeamSquad(p.squad)));
        });
        const totalEligible = eligiblePlayers.length;
        const percentage = totalEligible > 0 ? Math.round((regAttendedCount / totalEligible) * 100) : 0;
        return { regAttendedCount, lateCount, trialistAttendedCount, totalEligible, percentage };
    };

    const filteredSessions = sessions.filter(s => squadFilter === "All" || s.squad === squadFilter);

    // Helper for finding upcoming sessions for WhatsApp poll
    const trueUpcomingSessions = [...filteredSessions]
        .filter(s => {
            const todayStr = new Date().toISOString().split("T")[0];
            return s.date >= todayStr;
        })
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Filter and sort display sessions based on selected time filter (upcoming vs past)
    const displaySessions = [...filteredSessions]
        .filter(s => {
            const todayStr = new Date().toISOString().split("T")[0];
            if (timeFilter === "upcoming") return s.date >= todayStr;
            if (timeFilter === "past") return s.date < todayStr;
            return true;
        })
        .sort((a, b) => {
            if (timeFilter === "past") {
                // Past sessions: show most recent first
                return new Date(b.date).getTime() - new Date(a.date).getTime();
            }
            // Upcoming sessions: show closest first
            return new Date(a.date).getTime() - new Date(b.date).getTime();
        });

    const formatTrainingDate = (dateStr: string) => {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        const weekday = new Intl.DateTimeFormat("en-GB", { weekday: 'long' }).format(d);
        const day = d.getDate();
        const month = new Intl.DateTimeFormat("en-GB", { month: 'long' }).format(d);
        const year = d.getFullYear();
        return `${weekday} ${day} ${month} ${year}`;
    };

    const formatTime12h = (timeStr: string) => {
        if (!timeStr || !timeStr.includes(':')) return { time: timeStr, emoji: "🕒" };
        const [hStr, mStr] = timeStr.split(':');
        let hours = parseInt(hStr, 10);
        const minutes = parseInt(mStr, 10);
        if (isNaN(hours) || isNaN(minutes)) return { time: timeStr, emoji: "🕒" };

        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12;
        hours = hours ? hours : 12;
        const minutesStr = minutes < 10 ? '0' + minutes : minutes;
        const formatted = `${hours}:${minutesStr} ${ampm}`;

        let emoji = "\ud83d\udd52";
        if (hours === 7) emoji = minutes >= 30 ? "\ud83d\udd62" : "\ud83d\udd56";
        else if (hours === 8) emoji = minutes >= 30 ? "\ud83d\udd63" : "\ud83d\udd57";
        else if (hours === 9) emoji = minutes >= 30 ? "\ud83d\udd64" : "\ud83d\udd58";
        else if (hours === 10) emoji = minutes >= 30 ? "\ud83d\udd59" : "\ud83d\udd59";
        else if (hours === 11) emoji = minutes >= 30 ? "\ud83d\udd66" : "\ud83d\udd5a";
        else if (hours === 12) emoji = minutes >= 30 ? "\ud83d\udd67" : "\ud83d\udd5b";
        else if (hours === 1) emoji = minutes >= 30 ? "\ud83d\udd5c" : "\ud83d\udd50";
        else if (hours === 2) emoji = minutes >= 30 ? "\ud83d\udd5d" : "\ud83d\udd51";
        else if (hours === 3) emoji = minutes >= 30 ? "\ud83d\udd5e" : "\ud83d\udd52";
        else if (hours === 4) emoji = minutes >= 30 ? "\ud83d\udd5f" : "\ud83d\udd53";
        else if (hours === 5) emoji = minutes >= 30 ? "\ud83d\udd60" : "\ud83d\udd54";
        else if (hours === 6) emoji = minutes >= 30 ? "\ud83d\udd61" : "\ud83d\udd55";

        return { time: formatted, emoji };
    };

    const handleOpenShare = (session: TrainingSession) => {
        setActiveShareSession(session);
        setIncludeVenue(true);
        setIncludeTopic(true);
        setIncludeNotes(true);
        setAdditionalNotes("");
        setCopyStatus("idle");
    };

    const getTrainingGeneratedPollText = () => {
        if (!activeShareSession) return "";

        let parts: string[] = [];
        parts.push("\u26BD TRAINING AVAILABILITY");

        let details: string[] = [];
        const dateFormatted = formatTrainingDate(activeShareSession.date);
        details.push(`\ud83d\udcc5 ${dateFormatted}`);

        const timeInfo = formatTime12h(activeShareSession.time);
        details.push(`${timeInfo.emoji} ${timeInfo.time}`);

        if (includeVenue && activeShareSession.location) {
            details.push(`\ud83d\udccd ${activeShareSession.location}`);
        }

        if (includeTopic && activeShareSession.topic) {
            details.push(`\ud83d\udccb Topic: ${activeShareSession.topic}`);
        }

        parts.push(details.join("\n"));

        if (includeNotes && additionalNotes.trim()) {
            parts.push(additionalNotes.trim());
        }

        const checkinLink = `${window.location.origin}/respond/${activeShareSession.event_token || activeShareSession.id}`;
        parts.push(`Please confirm your availability here:\n${checkinLink}`);

        return parts.join("\n\n");
    };

    const handleCopyTrainingShareText = () => {
        const text = getTrainingGeneratedPollText();
        if (!text) return;
        navigator.clipboard.writeText(text).then(() => {
            setCopyStatus("copied");
            setTimeout(() => setCopyStatus("idle"), 2000);
        }).catch(err => {
            console.error("Failed to copy text:", err);
            alert("Failed to copy to clipboard.");
        });
    };

    const handleSendTrainingWhatsApp = () => {
        const text = getTrainingGeneratedPollText();
        if (!text) return;
        window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, "_blank");
    };

    // Calculate Season Stats
    const now = new Date();

    // Determine Season Start Date (Standard Season Logic: Starts June 1st)
    const currentYear = now.getFullYear();
    const startYear = now.getMonth() < 5 ? currentYear - 1 : currentYear; // Month 5 is June
    
    let seasonStartDate = new Date(startYear, 5, 1);
    
    // Absolute minimum tracking date: June 1st 2026
    const absoluteMinimumDate = new Date(2026, 5, 1);
    if (seasonStartDate < absoluteMinimumDate) {
        seasonStartDate = absoluteMinimumDate;
    }

    const seasonLabelYear = seasonStartDate.getFullYear();
    const displaySeasonLabel = `Season ${seasonLabelYear.toString().slice(-2)}/${(seasonLabelYear + 1).toString().slice(-2)} (Tracking from June 1st)`;

    const seasonSessions = sessions.filter(s => {
        const d = new Date(s.date);
        // Only count sessions in the season window where attendance was actually recorded
        const hasAttendance = s.attendance && s.attendance.length > 0;
        return d >= seasonStartDate && hasAttendance;
    });

    const leaderboardSessions = seasonSessions
        .filter(s => squadFilter === "All" || s.squad === squadFilter)
        .slice()
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const leaderboardPlayers = (squadFilter === "All"
        ? players.filter(p => isFirstTeamSquad(p.squad) || p.isInTrainingSquad || isPlayerFormerOrDeleted(p))
        : players.filter(p => p.squad === squadFilter || (squadFilter === "First Team" && isFirstTeamSquad(p.squad)) || (currentSquads.length <= 1 && isPlayerFormerOrDeleted(p)))
    ).filter(p => {
        if (!isPlayerFormerOrDeleted(p)) return true;
        return leaderboardSessions.some(s => {
            const record = s.attendance.find(a => a.playerId === p.id);
            return record?.status === 'Present' || record?.status === 'Late' || Boolean(record);
        });
    });

    const firstSeasonSessionDate = leaderboardSessions[0]?.date;

    const allPlayerStats = leaderboardPlayers
        .map(player => {
            const playerIsFormer = isPlayerFormerOrDeleted(player);
            const depDate = player.departureDate;

            // Determine when the player joined / first became part of the training register
            const joinNoteMatch = (player.notes || "").match(/\[JOIN_DATE:([^\]]+)\]/);
            const explicitJoinDate = joinNoteMatch?.[1]?.trim() || player.contractStartDate || undefined;
            const firstRegisterSession = leaderboardSessions.find(s =>
                s.attendance.some(a => a.playerId === player.id)
            );
            const effectiveStartDate = explicitJoinDate || firstRegisterSession?.date;

            const relevantSessions = leaderboardSessions.filter(s => {
                const hasRec = s.attendance.some(a => a.playerId === player.id);
                const attendedRec = s.attendance.some(a => a.playerId === player.id && (a.status === 'Present' || a.status === 'Late'));

                // 1. Do not count sessions before the player joined the club
                if (explicitJoinDate) {
                    // When an explicit join date is set, strictly ignore any sessions prior to that date
                    if (s.date < explicitJoinDate) return false;
                } else if (effectiveStartDate) {
                    if (s.date < effectiveStartDate && !hasRec) return false;
                } else {
                    // Brand-new player who hasn't been on any session register yet
                    return false;
                }

                // 2. If the player left the club, do not count sessions after their departure date
                if (playerIsFormer) {
                    if (attendedRec) return true;
                    return depDate ? s.date <= depDate : hasRec;
                }

                return true;
            });

            const attended = relevantSessions.filter(s => {
                const record = s.attendance.find(a => a.playerId === player.id);
                return record?.status === 'Present' || record?.status === 'Late';
            }).length;

            const late = relevantSessions.filter(s => {
                const record = s.attendance.find(a => a.playerId === player.id);
                return record?.status === 'Late';
            }).length;

            const last5 = relevantSessions.slice(-5).map(s => {
                const record = s.attendance.find(a => a.playerId === player.id);
                const status: 'Present' | 'Late' | 'Absent' =
                    record?.status === 'Present'
                        ? 'Present'
                        : record?.status === 'Late'
                        ? 'Late'
                        : 'Absent';
                return {
                    id: s.id,
                    date: s.date,
                    topic: s.topic || 'General Preparation',
                    status
                };
            });

            const last5Attended = last5.filter(item => item.status === 'Present' || item.status === 'Late').length;

            let streak = 0;
            for (let i = relevantSessions.length - 1; i >= 0; i--) {
                const rec = relevantSessions[i].attendance.find(a => a.playerId === player.id);
                if (rec?.status === 'Present' || rec?.status === 'Late') {
                    streak++;
                } else {
                    break;
                }
            }

            const total = relevantSessions.length;
            const percentage = total > 0 ? Math.round((attended / total) * 100) : 0;
            const posGroup = getPositionGroup(player.position);
            const joinedMidSeason = Boolean(
                effectiveStartDate &&
                firstSeasonSessionDate &&
                effectiveStartDate > firstSeasonSessionDate
            );

            return {
                ...player,
                posGroup,
                playerIsFormer,
                joinedMidSeason,
                effectiveStartDate,
                explicitJoinDate,
                stats: { attended, late, total, percentage, last5, last5Attended, streak }
            };
        });

    const handleOpenAmendStartDate = (player: any) => {
        setEditingStartDatePlayer(player);
        const initialDate = player.explicitJoinDate || player.effectiveStartDate || firstSeasonSessionDate || "";
        setCustomStartDateInput(initialDate);

        const initialOverrides: Record<string, "Present" | "Late" | "Absent"> = {};
        leaderboardSessions.forEach(s => {
            const rec = s.attendance.find(a => a.playerId === player.id);
            initialOverrides[s.id] =
                rec?.status === "Present"
                    ? "Present"
                    : rec?.status === "Late"
                    ? "Late"
                    : "Absent";
        });
        setSessionStatusOverrides(initialOverrides);
    };

    const handleSaveAmendStartDate = async () => {
        if (!editingStartDatePlayer) return;
        setIsSavingStartDate(true);
        try {
            const pid = editingStartDatePlayer.id;
            const strippedNotes = (editingStartDatePlayer.notes || "")
                .replace(/\[JOIN_DATE:[^\]]*\]\s*/g, "")
                .trim();
            const updatedNotes = customStartDateInput
                ? `${strippedNotes ? strippedNotes + " " : ""}[JOIN_DATE:${customStartDateInput}]`
                : strippedNotes;

            const { error: playerError } = await supabase
                .from("players")
                .update({ notes: updatedNotes })
                .eq("id", pid);
            if (playerError) throw playerError;

            // Update any sessions on or after customStartDateInput where status was set/changed
            const updatedSessionsList = [...sessions];
            for (const s of leaderboardSessions) {
                if (customStartDateInput && s.date < customStartDateInput) continue;
                const desiredStatus = sessionStatusOverrides[s.id] || "Absent";
                const existingRec = s.attendance.find(a => a.playerId === pid);
                const currentStatus = existingRec?.status || null;

                if (currentStatus !== desiredStatus) {
                    const nextAttendance = existingRec
                        ? s.attendance.map(a => (a.playerId === pid ? { ...a, status: desiredStatus } : a))
                        : [...s.attendance, { playerId: pid, status: desiredStatus, notes: "" }];

                    const { error: sessErr } = await supabase
                        .from("training_sessions")
                        .update({ attendance: nextAttendance })
                        .eq("id", s.id);
                    if (!sessErr) {
                        const idx = updatedSessionsList.findIndex(item => item.id === s.id);
                        if (idx >= 0) {
                            updatedSessionsList[idx] = { ...updatedSessionsList[idx], attendance: nextAttendance };
                        }
                    }
                }
            }

            setPlayers(prev =>
                prev.map(p => (p.id === pid ? { ...p, notes: updatedNotes } : p))
            );
            setSessions(updatedSessionsList);
            setEditingStartDatePlayer(null);
        } catch (err: any) {
            console.error("Failed to save start date:", err);
            alert("Failed to save player start date: " + (err?.message || "Unknown error"));
        } finally {
            setIsSavingStartDate(false);
        }
    };

    const formerPlayersCount = allPlayerStats.filter(p => p.playerIsFormer).length;
    const scopedPlayerStats = allPlayerStats.filter(p => !activeSquadOnly || !p.playerIsFormer);

    const positionCounts = {
        ALL: scopedPlayerStats.length,
        GK: scopedPlayerStats.filter(p => p.posGroup === "GK").length,
        DEF: scopedPlayerStats.filter(p => p.posGroup === "DEF").length,
        MID: scopedPlayerStats.filter(p => p.posGroup === "MID").length,
        FWD: scopedPlayerStats.filter(p => p.posGroup === "FWD").length,
    };

    const playerStats = scopedPlayerStats
        .filter(p => positionFilter === "ALL" || p.posGroup === positionFilter)
        .sort((a, b) => {
            const mult = attendanceSortDir === "asc" ? 1 : -1;
            if (attendanceSortBy === "player") {
                return mult * (`${a.firstName} ${a.lastName}`).localeCompare(`${b.firstName} ${b.lastName}`);
            }
            if (attendanceSortBy === "squad") {
                return mult * formatSquad(a.squad).localeCompare(formatSquad(b.squad));
            }
            if (attendanceSortBy === "attended") {
                if (a.stats.attended !== b.stats.attended) return mult * (a.stats.attended - b.stats.attended);
                return b.stats.percentage - a.stats.percentage;
            }
            if (attendanceSortBy === "late") {
                if (a.stats.late !== b.stats.late) return mult * (a.stats.late - b.stats.late);
                return b.stats.attended - a.stats.attended;
            }
            if (attendanceSortBy === "last5") {
                if (a.stats.last5Attended !== b.stats.last5Attended) return mult * (a.stats.last5Attended - b.stats.last5Attended);
                return b.stats.percentage - a.stats.percentage;
            }
            // default: percentage
            if (a.stats.percentage !== b.stats.percentage) return mult * (a.stats.percentage - b.stats.percentage);
            return mult * (a.stats.attended - b.stats.attended);
        });

    useEffect(() => {
        if (!showTrainingGraphicModal || !trainingShareCanvasRef.current) return;
        const canvas = trainingShareCanvasRef.current;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        // Always rank by percentage descending -> attended descending for the shareable graphic
        const rankedList = [...scopedPlayerStats]
            .filter(p => p.stats.total > 0)
            .sort((a, b) => {
                if (b.stats.percentage !== a.stats.percentage) return b.stats.percentage - a.stats.percentage;
                return b.stats.attended - a.stats.attended;
            });

        const rowsToDraw = trainingGraphicScope === "top10" ? rankedList.slice(0, 10) : rankedList.slice(0, 22);
        const width = 1080;
        const rowHeight = trainingGraphicScope === "top10" ? 72 : Math.max(50, Math.min(64, Math.floor(960 / Math.max(rowsToDraw.length, 1))));
        const headerHeight = 340;
        const tableHeaderHeight = 58;
        const footerHeight = 110;
        const calculatedHeight = headerHeight + tableHeaderHeight + rowsToDraw.length * rowHeight + footerHeight;
        const height = trainingGraphicFormat === "story" ? Math.max(1920, calculatedHeight) : Math.max(1350, calculatedHeight);

        canvas.width = width;
        canvas.height = height;

        const brandHex = (settings.primaryColor || settings.homeKitShirt || "#dc2626").trim();
        const secondaryHex = (settings.secondaryColor || "#111827").trim();

        const parseHexToRgb = (hex: string, fallback = { r: 220, g: 38, b: 38 }) => {
            const clean = hex.replace("#", "").trim();
            if (clean.length === 3) {
                const r = parseInt(clean[0] + clean[0], 16);
                const g = parseInt(clean[1] + clean[1], 16);
                const b = parseInt(clean[2] + clean[2], 16);
                return isNaN(r) ? fallback : { r, g, b };
            }
            if (clean.length >= 6) {
                const r = parseInt(clean.slice(0, 2), 16);
                const g = parseInt(clean.slice(2, 4), 16);
                const b = parseInt(clean.slice(4, 6), 16);
                return isNaN(r) ? fallback : { r, g, b };
            }
            return fallback;
        };

        const pRgb = parseHexToRgb(brandHex);
        const sRgb = parseHexToRgb(secondaryHex, { r: 17, g: 24, b: 39 });
        const sLuminance = (0.299 * sRgb.r + 0.587 * sRgb.g + 0.114 * sRgb.b) / 255;
        const baseEndRgb = sLuminance > 0.6
            ? { r: Math.round(pRgb.r * 0.14), g: Math.round(pRgb.g * 0.14), b: Math.round(pRgb.b * 0.16) }
            : { r: Math.round(sRgb.r * 0.35), g: Math.round(sRgb.g * 0.35), b: Math.round(sRgb.b * 0.4) };

        const avgRate = rankedList.length > 0
            ? Math.round(rankedList.reduce((acc, p) => acc + p.stats.percentage, 0) / rankedList.length)
            : 0;
        const topRate = rankedList[0]?.stats.percentage || 0;
        const bestStreak = rankedList.reduce((max, p) => Math.max(max, p.stats.streak), 0);

        const drawGraphic = (logoImg?: HTMLImageElement) => {
            const bgGrad = ctx.createLinearGradient(0, 0, width, height);
            bgGrad.addColorStop(0, `rgb(${Math.round(pRgb.r * 0.36)}, ${Math.round(pRgb.g * 0.36)}, ${Math.round(pRgb.b * 0.38)})`);
            bgGrad.addColorStop(0.45, `rgb(${Math.round(pRgb.r * 0.16)}, ${Math.round(pRgb.g * 0.16)}, ${Math.round(pRgb.b * 0.20)})`);
            bgGrad.addColorStop(1, `rgb(${baseEndRgb.r}, ${baseEndRgb.g}, ${baseEndRgb.b})`);
            ctx.fillStyle = bgGrad;
            ctx.fillRect(0, 0, width, height);

            const glowGrad = ctx.createRadialGradient(width * 0.85, 110, 20, width * 0.85, 110, 560);
            glowGrad.addColorStop(0, `rgba(${pRgb.r}, ${pRgb.g}, ${pRgb.b}, 0.42)`);
            glowGrad.addColorStop(1, "transparent");
            ctx.fillStyle = glowGrad;
            ctx.fillRect(0, 0, width, 620);

            ctx.fillStyle = brandHex;
            ctx.fillRect(0, 0, width, 14);

            let textStartX = 64;
            if (logoImg) {
                const logoSize = 112;
                ctx.save();
                ctx.beginPath();
                ctx.arc(64 + logoSize / 2, 76 + logoSize / 2, logoSize / 2, 0, Math.PI * 2);
                ctx.closePath();
                ctx.clip();
                ctx.drawImage(logoImg, 64, 76, logoSize, logoSize);
                ctx.restore();
                textStartX = 200;
            }

            ctx.fillStyle = "rgba(255,255,255,0.85)";
            ctx.font = "800 24px Inter, system-ui, sans-serif";
            ctx.textAlign = "left";
            ctx.fillText((settings.name || "CAMDEN UNITED").toUpperCase(), textStartX, 116);

            ctx.fillStyle = "#ffffff";
            ctx.font = "900 58px Inter, system-ui, sans-serif";
            ctx.fillText("TRAINING COMMITMENT", textStartX, 180);

            const kpiY = 228;
            const kpis = [
                { label: "SESSIONS", value: `${leaderboardSessions.length}` },
                { label: "SQUAD AVG", value: `${avgRate}%` },
                { label: "TOP RATE", value: `${topRate}%` },
                { label: "BEST STREAK", value: `${bestStreak} IN A ROW` }
            ];
            const cardW = (width - 128 - 36) / 4;
            kpis.forEach((k, i) => {
                const x = 64 + i * (cardW + 12);
                ctx.fillStyle = i === 0 ? `rgba(${pRgb.r}, ${pRgb.g}, ${pRgb.b}, 0.35)` : "rgba(255,255,255,0.06)";
                ctx.strokeStyle = i === 0 ? brandHex : `rgba(${pRgb.r}, ${pRgb.g}, ${pRgb.b}, 0.25)`;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.roundRect(x, kpiY, cardW, 78, 14);
                ctx.fill();
                ctx.stroke();

                ctx.fillStyle = "rgba(255,255,255,0.65)";
                ctx.font = "bold 15px Inter, system-ui, sans-serif";
                ctx.fillText(k.label, x + 20, kpiY + 28);

                ctx.fillStyle = "#ffffff";
                ctx.font = "900 26px Inter, system-ui, sans-serif";
                ctx.fillText(k.value, x + 20, kpiY + 60);
            });

            const tableTop = headerHeight;
            ctx.fillStyle = `rgba(${pRgb.r}, ${pRgb.g}, ${pRgb.b}, 0.22)`;
            ctx.beginPath();
            ctx.roundRect(64, tableTop, width - 128, tableHeaderHeight, [14, 14, 0, 0]);
            ctx.fill();

            ctx.fillStyle = "rgba(255,255,255,0.75)";
            ctx.font = "bold 19px Inter, system-ui, sans-serif";
            ctx.textAlign = "center";
            ctx.fillText("#", 105, tableTop + 36);
            ctx.textAlign = "left";
            ctx.fillText("PLAYER", 150, tableTop + 36);
            ctx.textAlign = "center";
            ctx.fillText("POS", 520, tableTop + 36);
            ctx.fillText("LAST 5", 685, tableTop + 36);
            ctx.fillText("SESSIONS", 855, tableTop + 36);
            ctx.fillText("RATE", 965, tableTop + 36);

            rowsToDraw.forEach((player, idx) => {
                const y = tableTop + tableHeaderHeight + idx * rowHeight;
                const isTop3 = idx < 3;

                ctx.fillStyle = idx === 0
                    ? `rgba(${pRgb.r}, ${pRgb.g}, ${pRgb.b}, 0.34)`
                    : idx % 2 === 0
                    ? "rgba(255,255,255,0.045)"
                    : "rgba(255,255,255,0.015)";
                ctx.fillRect(64, y, width - 128, rowHeight);

                if (isTop3) {
                    ctx.fillStyle = idx === 0 ? brandHex : idx === 1 ? "#f59e0b" : "#10b981";
                    ctx.fillRect(64, y, 7, rowHeight);
                }

                ctx.fillStyle = "rgba(255,255,255,0.07)";
                ctx.fillRect(64, y + rowHeight - 1, width - 128, 1);

                const textY = y + rowHeight / 2 + 8;

                // Rank
                ctx.textAlign = "center";
                ctx.fillStyle = isTop3 ? "#ffffff" : "#cbd5e1";
                ctx.font = isTop3 ? "900 23px Inter, system-ui, sans-serif" : "bold 21px Inter, system-ui, sans-serif";
                ctx.fillText(String(idx + 1), 105, textY);

                // Player Name
                ctx.textAlign = "left";
                ctx.fillStyle = "#ffffff";
                ctx.font = isTop3 ? "800 23px Inter, system-ui, sans-serif" : "600 22px Inter, system-ui, sans-serif";
                const fullName = `${player.firstName} ${player.lastName}`.trim();
                const displayName = fullName.length > 20 ? fullName.slice(0, 19) + "…" : fullName;
                ctx.fillText(displayName, 150, textY);

                // Position pill
                ctx.textAlign = "center";
                ctx.fillStyle = "rgba(255,255,255,0.75)";
                ctx.font = "bold 18px Inter, system-ui, sans-serif";
                ctx.fillText(player.position || "—", 520, textY);

                // Last 5 badges
                const l5 = player.stats.last5;
                const badgeSize = 26;
                const gap = 6;
                const totalL5W = l5.length * badgeSize + Math.max(0, l5.length - 1) * gap;
                let startL5X = 685 - totalL5W / 2;
                l5.forEach((sItem) => {
                    const by = y + rowHeight / 2 - badgeSize / 2;
                    if (sItem.status === "Present") {
                        ctx.fillStyle = "rgba(16, 185, 129, 0.28)";
                        ctx.strokeStyle = "rgba(16, 185, 129, 0.7)";
                    } else if (sItem.status === "Late") {
                        ctx.fillStyle = "rgba(245, 158, 11, 0.28)";
                        ctx.strokeStyle = "rgba(245, 158, 11, 0.7)";
                    } else {
                        ctx.fillStyle = "rgba(244, 63, 94, 0.25)";
                        ctx.strokeStyle = "rgba(244, 63, 94, 0.65)";
                    }
                    ctx.lineWidth = 1.5;
                    ctx.beginPath();
                    ctx.roundRect(startL5X, by, badgeSize, badgeSize, 6);
                    ctx.fill();
                    ctx.stroke();

                    ctx.fillStyle = sItem.status === "Present" ? "#6ee7b7" : sItem.status === "Late" ? "#fcd34d" : "#fda4af";
                    ctx.font = "bold 15px Inter, system-ui, sans-serif";
                    ctx.textAlign = "center";
                    ctx.fillText(
                        sItem.status === "Present" ? "✓" : sItem.status === "Late" ? "L" : "×",
                        startL5X + badgeSize / 2,
                        by + badgeSize / 2 + 5
                    );
                    startL5X += badgeSize + gap;
                });

                // Attended / Total
                ctx.textAlign = "center";
                ctx.fillStyle = "#e2e8f0";
                ctx.font = "bold 21px Inter, system-ui, sans-serif";
                ctx.fillText(`${player.stats.attended}/${player.stats.total}`, 855, textY);

                // Percentage
                const pct = player.stats.percentage;
                ctx.fillStyle = pct >= 80 ? "#4ade80" : pct >= 50 ? "#fbbf24" : "#f87171";
                ctx.font = "900 23px Inter, system-ui, sans-serif";
                ctx.fillText(`${pct}%`, 965, textY);
            });

            // Footer
            ctx.fillStyle = brandHex;
            ctx.beginPath();
            ctx.arc(72, height - 49, 6, 0, Math.PI * 2);
            ctx.fill();

            ctx.textAlign = "left";
            ctx.fillStyle = "rgba(255,255,255,0.65)";
            ctx.font = "600 20px Inter, system-ui, sans-serif";
            ctx.fillText(`Powered by ClubFlow • ${settings.name || "Camden United"}`, 88, height - 42);
        };

        if (settings.logo) {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => drawGraphic(img);
            img.onerror = () => drawGraphic();
            img.src = settings.logo;
        } else {
            drawGraphic();
        }
    }, [
        showTrainingGraphicModal,
        trainingGraphicFormat,
        trainingGraphicScope,
        scopedPlayerStats,
        leaderboardSessions.length,
        settings.name,
        settings.primaryColor,
        settings.secondaryColor,
        settings.homeKitShirt,
        settings.logo
    ]);

    const handleDownloadTrainingGraphic = () => {
        if (!trainingShareCanvasRef.current) return;
        const link = document.createElement("a");
        const slug = (settings.name || "club").toLowerCase().replace(/[^a-z0-9]+/g, "-");
        link.download = `${slug}-training-commitment.png`;
        link.href = trainingShareCanvasRef.current.toDataURL("image/png");
        link.click();
    };

    const handleCopyTrainingGraphic = async () => {
        if (!trainingShareCanvasRef.current) return;
        try {
            const blob = await new Promise<Blob | null>(resolve => trainingShareCanvasRef.current?.toBlob(resolve, "image/png"));
            if (blob && navigator.clipboard && (window as any).ClipboardItem) {
                await navigator.clipboard.write([new (window as any).ClipboardItem({ "image/png": blob })]);
                setCopiedTrainingGraphic(true);
                setTimeout(() => setCopiedTrainingGraphic(false), 2500);
            } else {
                handleDownloadTrainingGraphic();
            }
        } catch {
            handleDownloadTrainingGraphic();
        }
    };

    const downloadStatsExcel = () => {
        // Calculate average attendance rate
        const avgAttendance = playerStats.length > 0
            ? Math.round(playerStats.reduce((sum, p) => sum + p.stats.percentage, 0) / playerStats.length)
            : 0;

        const htmlContent = `
            <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
            <head>
                <!--[if gte mso 9]>
                <xml>
                    <x:ExcelWorkbook>
                        <x:ExcelWorksheets>
                            <x:ExcelWorksheet>
                                <x:Name>Attendance Report</x:Name>
                                <x:WorksheetOptions>
                                    <x:DisplayGridlines/>
                                </x:WorksheetOptions>
                            </x:ExcelWorksheet>
                        </x:ExcelWorksheets>
                    </x:ExcelWorkbook>
                </xml>
                <![endif]-->
                <style>
                    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 20px; }
                    .header-title { font-size: 16pt; font-weight: bold; color: #dc2626; }
                    .header-subtitle { font-size: 12pt; font-weight: bold; color: #4b5563; }
                    .header-meta { font-size: 10pt; color: #6b7280; }
                    .summary-table { border-collapse: collapse; margin-top: 15px; margin-bottom: 20px; }
                    .summary-table td { border: 1px solid #e5e7eb; padding: 8px; font-size: 10pt; }
                    .summary-hdr { background-color: #f3f4f6; font-weight: bold; color: #1f2937; }
                    .data-table { border-collapse: collapse; width: 100%; margin-top: 10px; }
                    .data-table th { background-color: #dc2626; color: white; font-weight: bold; border: 1px solid #b91c1c; padding: 10px; text-align: left; font-size: 11pt; }
                    .data-table td { border: 1px solid #e5e7eb; padding: 8px; font-size: 10pt; }
                    .tier-elite { background-color: #4ade80; color: #064e3b; font-weight: bold; }
                    .tier-excellent { background-color: #fef08a; color: #713f12; font-weight: bold; }
                    .tier-active { background-color: #fed7aa; color: #7c2d12; font-weight: bold; }
                    .tier-critical { background-color: #fca5a5; color: #7f1d1d; font-weight: bold; }
                </style>
            </head>
            <body>
                <div class="header-title">CAMDEN UNITED FOOTBALL CLUB</div>
                <div class="header-subtitle">PLAYER DEVELOPMENT & ATTENDANCE REPORT</div>
                <div class="header-meta"><b>Season:</b> ${displaySeasonLabel}</div>
                <div class="header-meta"><b>Report Generated:</b> ${new Date().toLocaleDateString("en-GB")} at ${new Date().toLocaleTimeString("en-GB", { hour: '2-digit', minute: '2-digit' })}</div>
                <div class="header-meta"><b>Official Club Sponsor:</b> Supporting Grassroots Talent & Player Progression</div>
                <br/>
                <table class="summary-table">
                    <tr class="summary-hdr">
                        <td colspan="2">SQUAD PERFORMANCE SUMMARY</td>
                    </tr>
                    <tr>
                        <td>Total Tracked Players</td>
                        <td><b>${playerStats.length}</b></td>
                    </tr>
                    <tr>
                        <td>Total Training Sessions</td>
                        <td><b>${leaderboardSessions.length}</b></td>
                    </tr>
                    <tr>
                        <td>Average Squad Attendance</td>
                        <td style="color: #15803d; font-weight: bold;">${avgAttendance}%</td>
                    </tr>
                </table>
                <br/>
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Player Name</th>
                            <th>Squad Team</th>
                            <th>Attended Sessions</th>
                            <th>Total Sessions</th>
                            <th>Attendance Rate</th>
                            <th>Engagement Tier</th>
                            <th>Primary Position</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${playerStats.map(p => {
                            const pct = p.stats.percentage;
                            let tierClass = "tier-critical";
                            let engagementTier = "Action Required (<50%)";
                            if (pct >= 90) {
                                tierClass = "tier-elite";
                                engagementTier = "Elite (90%+)";
                            } else if (pct >= 75) {
                                tierClass = "tier-excellent";
                                engagementTier = "Excellent (75-89%)";
                            } else if (pct >= 50) {
                                tierClass = "tier-active";
                                engagementTier = "Active (50-74%)";
                            }

                            return `
                                <tr>
                                    <td><b>${p.firstName} ${p.lastName}</b></td>
                                    <td>${p.squad}</td>
                                    <td align="center">${p.stats.attended}</td>
                                    <td align="center">${p.stats.total}</td>
                                    <td align="center" class="${tierClass}">${pct}%</td>
                                    <td class="${tierClass}">${engagementTier}</td>
                                    <td>${p.position || 'N/A'}</td>
                                </tr>
                            `;
                        }).join("")}
                    </tbody>
                </table>
            </body>
            </html>
        `;

        const blob = new Blob([htmlContent], { type: "application/vnd.ms-excel;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `camden_united_training_report_${new Date().toISOString().split('T')[0]}.xls`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const trackedPlayersForKpi = scopedPlayerStats.filter(p => p.stats.total > 0);
    const mobileSquadAvgRate = trackedPlayersForKpi.length > 0
        ? Math.round(trackedPlayersForKpi.reduce((sum, p) => sum + p.stats.percentage, 0) / trackedPlayersForKpi.length)
        : 0;
    const mobileBestStreak = trackedPlayersForKpi.reduce((max, p) => Math.max(max, p.stats.streak), 0);

    return (
        <div className="space-y-4 md:space-y-8 pb-12">
            {/* =========================================================
                MOBILE TRAINING HEADER & 4-STAT BENTO STRIP (< 768px)
               ========================================================= */}
            <div className="md:hidden space-y-3">
                <div className="flex items-center justify-between gap-2">
                    <div>
                        <h1 className="text-xl font-black tracking-tight text-foreground leading-none">
                            Training Hub
                        </h1>
                        <p className="text-[11px] text-muted-foreground font-medium mt-1">
                            Sessions, registers &amp; commitment tracker
                        </p>
                    </div>
                    <Button
                        size="sm"
                        className="bg-brand hover:bg-brand/90 text-white font-bold h-9 px-3 rounded-xl shadow-sm shrink-0"
                        onClick={handleOpenNew}
                    >
                        <Plus className="h-4 w-4 mr-1" /> Schedule
                    </Button>
                </div>

                <div className="grid grid-cols-4 gap-2">
                    <div className="bg-surface-1 border border-border rounded-xl p-2.5 shadow-xs">
                        <span className="text-[9px] uppercase tracking-wider font-extrabold text-indigo-600 dark:text-indigo-400 block">
                            Upcoming
                        </span>
                        <span className="text-lg font-black text-foreground leading-tight block mt-0.5">
                            {trueUpcomingSessions.length}
                        </span>
                    </div>
                    <div className="bg-surface-1 border border-border rounded-xl p-2.5 shadow-xs">
                        <span className="text-[9px] uppercase tracking-wider font-extrabold text-muted-foreground block">
                            Tracked
                        </span>
                        <span className="text-lg font-black text-foreground leading-tight block mt-0.5">
                            {leaderboardSessions.length}
                        </span>
                    </div>
                    <div className="bg-surface-1 border border-border rounded-xl p-2.5 shadow-xs">
                        <span className="text-[9px] uppercase tracking-wider font-extrabold text-emerald-600 dark:text-emerald-400 block">
                            Squad Avg
                        </span>
                        <span className="text-lg font-black text-foreground leading-tight block mt-0.5">
                            {mobileSquadAvgRate}%
                        </span>
                    </div>
                    <div className="bg-surface-1 border border-border rounded-xl p-2.5 shadow-xs">
                        <span className="text-[9px] uppercase tracking-wider font-extrabold text-amber-600 dark:text-amber-400 block truncate">
                            Best Streak
                        </span>
                        <span className="text-lg font-black text-foreground leading-tight block mt-0.5">
                            🔥 {mobileBestStreak}
                        </span>
                    </div>
                </div>
            </div>

            {/* =========================================================
                DESKTOP PAGE HEADER (>= 768px) — UNTOUCHED
               ========================================================= */}
            <div className="hidden md:block">
                <PageHeader 
                    title="Training Schedule" 
                    description="Plan the week and prepare your squad for the next football activity." 
                />
            </div>

            {/* LEVEL 0: Football Week */}
            <WeeklyFootballCalendar title="Training Week" />

            {/* =========================================================
                MOBILE WORKSPACE SWITCHER & FILTER BAR (< 768px)
               ========================================================= */}
            <div className="md:hidden space-y-2.5">
                <div className="grid grid-cols-2 gap-1.5 bg-surface-1 p-1 rounded-xl border border-border shadow-xs">
                    <button
                        type="button"
                        onClick={() => setActiveTab('sessions')}
                        className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all ${
                            activeTab === 'sessions'
                                ? 'bg-background text-foreground shadow-sm'
                                : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        <CalendarDays className="h-3.5 w-3.5 text-brand" />
                        <span>Schedule ({displaySessions.length})</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('stats')}
                        className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all ${
                            activeTab === 'stats'
                                ? 'bg-background text-foreground shadow-sm'
                                : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        <BarChart3 className="h-3.5 w-3.5 text-emerald-500" />
                        <span>Attendance ({playerStats.length})</span>
                    </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                    <select
                        value={squadFilter}
                        onChange={(e) => setSquadFilter(e.target.value)}
                        className="h-9 w-full rounded-xl border border-border bg-surface-1 px-2.5 text-xs font-bold text-foreground shadow-xs focus:outline-none focus:ring-1 focus:ring-brand cursor-pointer"
                    >
                        <option value="All">All Squads</option>
                        {currentSquads.map((squad) => (
                            <option key={squad} value={squad}>
                                {squad}
                            </option>
                        ))}
                    </select>

                    {activeTab === 'sessions' ? (
                        <select
                            value={timeFilter}
                            onChange={(e: any) => setTimeFilter(e.target.value)}
                            className="h-9 w-full rounded-xl border border-border bg-surface-1 px-2.5 text-xs font-bold text-foreground shadow-xs focus:outline-none focus:ring-1 focus:ring-brand cursor-pointer"
                        >
                            <option value="upcoming">Upcoming Sessions</option>
                            <option value="past">Past Sessions</option>
                            <option value="all">All Sessions</option>
                        </select>
                    ) : (
                        <select
                            value={`${attendanceSortBy}:${attendanceSortDir}`}
                            onChange={(e) => {
                                const [col, dir] = e.target.value.split(":") as [any, "asc" | "desc"];
                                setAttendanceSortBy(col);
                                setAttendanceSortDir(dir);
                            }}
                            className="h-9 w-full rounded-xl border border-border bg-surface-1 px-2.5 text-xs font-bold text-foreground shadow-xs focus:outline-none focus:ring-1 focus:ring-brand cursor-pointer"
                        >
                            <option value="percentage:desc">Sort: Highest %</option>
                            <option value="percentage:asc">Sort: Lowest %</option>
                            <option value="attended:desc">Sort: Most Attended</option>
                            <option value="last5:desc">Sort: Best Last 5</option>
                            <option value="late:desc">Sort: Most Late</option>
                            <option value="player:asc">Sort: Name (A–Z)</option>
                        </select>
                    )}
                </div>
            </div>

            {/* =========================================================
                DESKTOP FILTER BAR (>= 768px) — UNTOUCHED
               ========================================================= */}
            <div className="hidden md:flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex bg-surface-1 p-1 rounded-lg border border-border">
                        <button
                            onClick={() => setActiveTab('sessions')}
                            className={`flex items-center px-3 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === 'sessions' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            <CalendarDays className="h-4 w-4 mr-2" /> Schedule
                        </button>
                        <button
                            onClick={() => setActiveTab('stats')}
                            className={`flex items-center px-3 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === 'stats' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            <BarChart3 className="h-4 w-4 mr-2" /> Attendance
                        </button>
                    </div>

                    <select
                        value={squadFilter}
                        onChange={(e) => setSquadFilter(e.target.value)}
                        className="flex h-9 rounded-md border border-border bg-surface-1 px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand cursor-pointer text-foreground font-medium"
                    >
                        <option value="All">All Squads</option>
                        {currentSquads.map((squad) => (
                            <option key={squad} value={squad}>
                                {squad}
                            </option>
                        ))}
                    </select>

                    <select
                        value={timeFilter}
                        onChange={(e: any) => setTimeFilter(e.target.value)}
                        className="flex h-9 rounded-md border border-border bg-surface-1 px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand cursor-pointer text-foreground font-medium"
                    >
                        <option value="upcoming">Upcoming Sessions</option>
                        <option value="past">Past Sessions</option>
                        <option value="all">All Sessions</option>
                    </select>
                </div>

                {activeTab === 'sessions' && (
                    <Button className="bg-brand hover:bg-brand/90 text-white" onClick={handleOpenNew}>
                        <Plus className="h-4 w-4 mr-2" /> Schedule Session
                    </Button>
                )}
            </div>

            {activeTab === 'sessions' ? (
                <>
                    {/* =========================================================
                        MOBILE SCHEDULE VIEW (< 768px)
                       ========================================================= */}
                    <div className="md:hidden space-y-5">
                        {/* Next Session Mobile Command Card */}
                        {trueUpcomingSessions.length > 0 && timeFilter !== "past" && (
                            <div className="space-y-2">
                                <div className="flex items-center justify-between px-0.5">
                                    <span className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
                                        Next Session
                                    </span>
                                    <span className="text-[11px] font-semibold text-brand">
                                        {formatSquad(trueUpcomingSessions[0].squad)}
                                    </span>
                                </div>

                                <div className="rounded-2xl border border-border bg-surface-1 p-4 shadow-sm space-y-3.5">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-1.5 mb-1">
                                                <Badge variant="secondary" className="bg-brand/10 text-brand text-[10px] font-bold px-2 py-0">
                                                    {formatSquad(trueUpcomingSessions[0].squad)}
                                                </Badge>
                                                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 px-1.5 py-0 rounded">
                                                    UPCOMING
                                                </span>
                                            </div>
                                            <h3 className="text-lg font-black text-foreground tracking-tight leading-snug">
                                                {trueUpcomingSessions[0].topic || "General Preparation"}
                                            </h3>
                                        </div>

                                        <div className="flex items-center gap-1 shrink-0">
                                            <button
                                                type="button"
                                                onClick={() => handleOpenShare(trueUpcomingSessions[0])}
                                                className="h-8 w-8 rounded-lg border border-border bg-surface-2 flex items-center justify-center text-muted-foreground hover:text-emerald-600 active:scale-95 transition-all"
                                                title="Share WhatsApp Poll"
                                            >
                                                <MessageCircle className="h-3.5 w-3.5" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={(e) => handleRepeatNextWeek(trueUpcomingSessions[0], e)}
                                                className="h-8 w-8 rounded-lg border border-border bg-surface-2 flex items-center justify-center text-muted-foreground hover:text-brand active:scale-95 transition-all"
                                                title="Repeat Next Week"
                                            >
                                                <Repeat className="h-3.5 w-3.5" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleEdit(trueUpcomingSessions[0])}
                                                className="h-8 w-8 rounded-lg border border-border bg-surface-2 flex items-center justify-center text-muted-foreground hover:text-foreground active:scale-95 transition-all"
                                                title="Edit Session"
                                            >
                                                <Pencil className="h-3.5 w-3.5" />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Compact Info Strip */}
                                    <div className="bg-surface-2/60 rounded-xl p-2.5 border border-border/60 space-y-1.5 text-xs">
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="inline-flex items-center gap-1.5 font-semibold text-foreground">
                                                <CalendarDays className="h-3.5 w-3.5 text-brand shrink-0" />
                                                {formatTrainingDate(trueUpcomingSessions[0].date)}
                                            </span>
                                            <span className="inline-flex items-center gap-1 font-bold text-foreground shrink-0">
                                                <Clock className="h-3.5 w-3.5 text-brand shrink-0" />
                                                {formatTime12h(trueUpcomingSessions[0].time).time}
                                            </span>
                                        </div>
                                        {trueUpcomingSessions[0].location && (
                                            <div className="flex items-center gap-1.5 text-muted-foreground font-medium pt-1 border-t border-border/50">
                                                <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                                <span className="truncate">{trueUpcomingSessions[0].location}</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Mobile Action Row */}
                                    <div className="grid grid-cols-2 gap-2">
                                        <Button className="w-full bg-brand hover:bg-brand/90 text-white font-bold h-9 rounded-xl text-xs shadow-xs" asChild>
                                            <Link href={`/training/${trueUpcomingSessions[0].id}`}>
                                                Manage Register
                                            </Link>
                                        </Button>
                                        <Button
                                            variant="outline"
                                            className="w-full border-border bg-surface-2/60 text-foreground font-bold h-9 rounded-xl text-xs"
                                            onClick={() => handleOpenShare(trueUpcomingSessions[0])}
                                        >
                                            <MessageCircle className="h-3.5 w-3.5 mr-1.5 text-emerald-500" />
                                            WhatsApp Poll
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Upcoming Journey (Mobile Cards with Always-Visible Action Buttons) */}
                        {trueUpcomingSessions.length > 1 && timeFilter !== "past" && (
                            <div className="space-y-2.5">
                                <span className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground block px-0.5">
                                    Upcoming Journey ({trueUpcomingSessions.slice(1).length})
                                </span>
                                <div className="space-y-2.5">
                                    {trueUpcomingSessions.slice(1).map((session) => (
                                        <div
                                            key={`mob-up-${session.id}`}
                                            onClick={() => window.location.href = `/training/${session.id}`}
                                            className="rounded-xl border border-border bg-surface-1 p-3.5 shadow-xs active:bg-surface-2/60 transition-colors cursor-pointer space-y-2"
                                        >
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-1.5 mb-1">
                                                        <Badge variant="secondary" className="bg-surface-2 text-muted-foreground border-border text-[10px] font-semibold px-1.5 py-0">
                                                            {formatSquad(session.squad)}
                                                        </Badge>
                                                    </div>
                                                    <h4 className="text-sm font-bold text-foreground truncate">
                                                        {session.topic || "General Preparation"}
                                                    </h4>
                                                </div>

                                                {/* Touch-Friendly Action Buttons (Always visible on mobile) */}
                                                <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                                                    <button
                                                        type="button"
                                                        onClick={(e) => handleRepeatNextWeek(session, e)}
                                                        className="h-7 w-7 rounded-lg border border-border bg-surface-2 flex items-center justify-center text-muted-foreground hover:text-brand"
                                                        title="Repeat Next Week"
                                                    >
                                                        <Repeat className="h-3.5 w-3.5" />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleEdit(session)}
                                                        className="h-7 w-7 rounded-lg border border-border bg-surface-2 flex items-center justify-center text-muted-foreground hover:text-blue-600"
                                                        title="Edit Session"
                                                    >
                                                        <Pencil className="h-3.5 w-3.5" />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDelete(session.id)}
                                                        className="h-7 w-7 rounded-lg border border-border bg-surface-2 flex items-center justify-center text-muted-foreground hover:text-status-error"
                                                        title="Delete Session"
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground font-medium pt-1 border-t border-border/50">
                                                <span className="inline-flex items-center gap-1">
                                                    <CalendarDays className="h-3 w-3 shrink-0" />
                                                    {formatDate(session.date)} • {formatTime12h(session.time).time}
                                                </span>
                                                {session.location && (
                                                    <span className="truncate max-w-[140px]">{session.location}</span>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Historical Record (Mobile Cards) */}
                        {displaySessions.filter(s => s.date < new Date().toISOString().split("T")[0]).length > 0 && (
                            <div className="space-y-2.5">
                                <span className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground block px-0.5">
                                    Historical Record ({displaySessions.filter(s => s.date < new Date().toISOString().split("T")[0]).length})
                                </span>
                                <div className="space-y-2.5">
                                    {displaySessions
                                        .filter(s => s.date < new Date().toISOString().split("T")[0])
                                        .map((session) => {
                                            const stats = getSessionAttendanceStats(session);
                                            const turnoutTier =
                                                stats.percentage >= 75
                                                    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/35"
                                                    : stats.percentage >= 50
                                                    ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/35"
                                                    : "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/35";
                                            const barColor =
                                                stats.percentage >= 75
                                                    ? "bg-emerald-500"
                                                    : stats.percentage >= 50
                                                    ? "bg-amber-500"
                                                    : "bg-rose-500";

                                            return (
                                                <div
                                                    key={`mob-hist-${session.id}`}
                                                    onClick={() => window.location.href = `/training/${session.id}`}
                                                    className="rounded-xl border border-border bg-surface-1 p-3.5 shadow-xs active:bg-surface-2/60 transition-colors cursor-pointer space-y-2.5"
                                                >
                                                    <div className="flex items-start justify-between gap-2">
                                                        <div className="min-w-0 flex-1">
                                                            <h4 className="text-sm font-bold text-foreground truncate">
                                                                {session.topic || "General Preparation"}
                                                            </h4>
                                                            <p className="text-[11px] text-muted-foreground font-medium flex items-center gap-1 mt-0.5">
                                                                <CalendarDays className="h-3 w-3 shrink-0" />
                                                                <span>{formatDate(session.date)} • {formatTime12h(session.time).time}</span>
                                                            </p>
                                                        </div>
                                                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-extrabold border shrink-0 ${turnoutTier}`}>
                                                            {stats.percentage}% Turnout
                                                        </span>
                                                    </div>

                                                    <div className="flex items-center justify-between gap-2 text-[11px]">
                                                        <div className="font-semibold text-foreground flex items-center gap-1.5">
                                                            <span className="h-4 w-4 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold text-[10px]">
                                                                ✓
                                                            </span>
                                                            <span>
                                                                {stats.regAttendedCount}
                                                                <span className="text-muted-foreground font-normal">/{stats.totalEligible} Attended</span>
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-1">
                                                            {stats.lateCount > 0 && (
                                                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/35">
                                                                    🕒 {stats.lateCount}L
                                                                </span>
                                                            )}
                                                            {stats.trialistAttendedCount > 0 && (
                                                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/35">
                                                                    +{stats.trialistAttendedCount} Trialist
                                                                </span>
                                                            )}
                                                            <Badge variant="secondary" className="bg-surface-2 text-muted-foreground border-border text-[10px] px-1.5 py-0">
                                                                {formatSquad(session.squad)}
                                                            </Badge>
                                                        </div>
                                                    </div>

                                                    <div className="w-full bg-surface-2 border border-border/60 rounded-full h-1.5 overflow-hidden">
                                                        <div
                                                            className={`h-full transition-all ${barColor}`}
                                                            style={{ width: `${Math.min(100, stats.percentage)}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                </div>
                            </div>
                        )}

                        {displaySessions.length === 0 && (
                            <div className="py-12 px-4 text-center border-2 border-dashed border-border rounded-2xl bg-surface-1">
                                <h3 className="text-base font-bold text-foreground">No sessions planned</h3>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Schedule your first training session to begin preparation.
                                </p>
                                <Button className="bg-brand hover:bg-brand/90 mt-3 text-white text-xs font-bold h-9 rounded-xl" onClick={handleOpenNew}>
                                    Schedule Session
                                </Button>
                            </div>
                        )}
                    </div>

                    {/* =========================================================
                        DESKTOP SCHEDULE VIEW (>= 768px) — UNTOUCHED
                       ========================================================= */}
                    <div className="hidden md:block space-y-8">
                        {/* The Next Session (Command Center) */}
                        {trueUpcomingSessions.length > 0 && (
                            <PageSection>
                                <div className="flex flex-col space-y-4">
                                    <div className="flex flex-col sm:flex-row sm:items-baseline gap-2">
                                        <h3 className="text-xl font-bold tracking-tight text-foreground">Next Session</h3>
                                        <span className="text-sm text-muted-foreground font-medium">Preparing for {trueUpcomingSessions[0].topic || "next match"}</span>
                                    </div>

                                    <Card className="overflow-hidden border-border bg-background shadow-md">
                                        <div className="p-6 md:p-8 flex flex-col md:flex-row gap-8">
                                            {/* Left Col: Coaching Objective & Session Info */}
                                            <div className="flex-1 space-y-6">
                                                <div>
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <Badge variant="secondary" className="bg-brand/10 text-brand hover:bg-brand/20">{formatSquad(trueUpcomingSessions[0].squad)}</Badge>
                                                    </div>
                                                    <h4 className="text-3xl font-bold tracking-tight text-foreground">
                                                        {trueUpcomingSessions[0].topic || "General Preparation"}
                                                    </h4>
                                                </div>

                                                <div className="flex flex-col gap-3 text-slate-600 font-medium">
                                                    <div className="flex items-center gap-3">
                                                        <CalendarDays className="h-5 w-5 text-muted-foreground" />
                                                        <span>{formatTrainingDate(trueUpcomingSessions[0].date)}</span>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <Clock className="h-5 w-5 text-muted-foreground" />
                                                        <span>{formatTime12h(trueUpcomingSessions[0].time).time}</span>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <MapPin className="h-5 w-5 text-muted-foreground" />
                                                        <span>{trueUpcomingSessions[0].location}</span>
                                                    </div>
                                                </div>
                                                
                                                <div className="flex gap-3 pt-2">
                                                    <Button className="bg-brand hover:bg-brand/90" asChild>
                                                        <Link href={`/training/${trueUpcomingSessions[0].id}`}>Manage Session</Link>
                                                    </Button>
                                                    <Button variant="outline" className="border-border text-foreground" onClick={() => handleEdit(trueUpcomingSessions[0])}>
                                                        <Pencil className="h-4 w-4 mr-2" /> Edit Session
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    </Card>
                                </div>
                            </PageSection>
                        )}

                        {/* Upcoming Journey */}
                        {trueUpcomingSessions.length > 1 && (
                            <PageSection>
                                <SectionHeader title="Upcoming Journey" description="Future sessions leading to the match." />
                                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                    {trueUpcomingSessions.slice(1).map((session) => (
                                        <Card 
                                            key={session.id} 
                                            onClick={() => window.location.href = `/training/${session.id}`}
                                            className="hover:shadow-md transition-shadow cursor-pointer border-border group relative bg-card"
                                        >
                                            <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-brand" onClick={(e) => handleRepeatNextWeek(session, e)} title="Repeat Next Week">
                                                    <Repeat className="h-4 w-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-blue-600" onClick={(e) => { e.stopPropagation(); handleEdit(session); }}>
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-status-error" onClick={(e) => { e.stopPropagation(); handleDelete(session.id); }}>
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                            <CardHeader className="pb-2">
                                                <div className="flex justify-between items-start pr-16">
                                                    <Badge variant="secondary" className="bg-surface-1 text-muted-foreground border-border">{formatSquad(session.squad)}</Badge>
                                                </div>
                                                <CardTitle className="text-lg mt-2 text-foreground">{session.topic || "General Preparation"}</CardTitle>
                                                <CardDescription className="flex items-center gap-1 font-medium">
                                                    <CalendarDays className="h-3 w-3" /> {formatDate(session.date)} • {formatTime12h(session.time).time}
                                                </CardDescription>
                                            </CardHeader>
                                        </Card>
                                    ))}
                                </div>
                            </PageSection>
                        )}

                        {/* Historical Record */}
                        {displaySessions.filter(s => s.date < new Date().toISOString().split("T")[0]).length > 0 && (
                            <PageSection>
                                <SectionHeader title="Historical Record" description="Past sessions, squad turnout %, punctuality, and trialist records." />
                                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                                    {displaySessions
                                        .filter(s => s.date < new Date().toISOString().split("T")[0])
                                        .map((session) => {
                                            const stats = getSessionAttendanceStats(session);
                                            const turnoutTier =
                                                stats.percentage >= 75
                                                    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/35"
                                                    : stats.percentage >= 50
                                                    ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/35"
                                                    : "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/35";
                                            const barColor =
                                                stats.percentage >= 75
                                                    ? "bg-emerald-500"
                                                    : stats.percentage >= 50
                                                    ? "bg-amber-500"
                                                    : "bg-rose-500";

                                            return (
                                                <Card 
                                                    key={session.id} 
                                                    onClick={() => window.location.href = `/training/${session.id}`}
                                                    className="hover:shadow-md transition-all cursor-pointer border-border bg-card hover:bg-surface-1/60 group"
                                                >
                                                    <CardHeader className="pb-2.5">
                                                        <div className="flex justify-between items-start gap-2">
                                                            <CardTitle className="text-base font-bold text-foreground group-hover:text-brand transition-colors line-clamp-1">
                                                                {session.topic || "General Preparation"}
                                                            </CardTitle>
                                                            <Badge variant="secondary" className="bg-surface-1 text-muted-foreground border-border text-[11px] shrink-0">
                                                                {formatSquad(session.squad)}
                                                            </Badge>
                                                        </div>
                                                        <CardDescription className="flex items-center gap-1.5 text-xs font-medium">
                                                            <CalendarDays className="h-3 w-3 text-muted-foreground shrink-0" />
                                                            <span>{formatDate(session.date)} • {formatTime12h(session.time).time}</span>
                                                            {session.location && (
                                                                <>
                                                                    <span>•</span>
                                                                    <span className="truncate max-w-[130px]">{session.location}</span>
                                                                </>
                                                            )}
                                                        </CardDescription>
                                                    </CardHeader>
                                                    <CardContent className="space-y-2.5 pt-0">
                                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                                            <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                                                                <span className="h-4 w-4 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold text-[10px]">✓</span>
                                                                <span>
                                                                    {stats.regAttendedCount}
                                                                    <span className="text-muted-foreground font-normal">/{stats.totalEligible} Attended</span>
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                                {stats.lateCount > 0 && (
                                                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/35">
                                                                        🕒 {stats.lateCount} Late
                                                                    </span>
                                                                )}
                                                                {stats.trialistAttendedCount > 0 && (
                                                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/35">
                                                                        +{stats.trialistAttendedCount} Trialist{stats.trialistAttendedCount > 1 ? 's' : ''}
                                                                    </span>
                                                                )}
                                                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold border ${turnoutTier}`}>
                                                                    {stats.percentage}% Turnout
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <div className="w-full bg-surface-1 border border-border rounded-full h-1.5 overflow-hidden">
                                                            <div
                                                                className={`h-full transition-all ${barColor}`}
                                                                style={{ width: `${Math.min(100, stats.percentage)}%` }}
                                                            />
                                                        </div>
                                                    </CardContent>
                                                </Card>
                                            );
                                        })}
                                </div>
                            </PageSection>
                        )}

                        {displaySessions.length === 0 && (
                            <div className="col-span-full py-16 text-center border-2 border-dashed border-border rounded-xl bg-surface-1">
                                <h3 className="text-lg font-semibold text-foreground">No sessions planned</h3>
                                <p className="text-muted-foreground mt-1">Schedule your first training session to begin preparation.</p>
                                <Button className="bg-brand hover:bg-brand/90 mt-4 text-white" onClick={handleOpenNew}>
                                    Schedule Session
                                </Button>
                            </div>
                        )}
                    </div>
                </>
            ) : (
                <>
                    {/* =========================================================
                        MOBILE ATTENDANCE LEADERBOARD (< 768px)
                       ========================================================= */}
                    <div className="md:hidden space-y-3">
                        {/* Mobile Action & Filter Card */}
                        <div className="bg-surface-1 border border-border rounded-xl p-3 space-y-2.5 shadow-xs">
                            <div className="flex items-center justify-between gap-2">
                                <div>
                                    <p className="text-xs font-extrabold text-foreground">Training Commitment</p>
                                    <p className="text-[10px] text-muted-foreground font-medium">
                                        {displaySeasonLabel} • {leaderboardSessions.length} {leaderboardSessions.length === 1 ? "session" : "sessions"}
                                    </p>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <Button
                                        size="sm"
                                        onClick={() => setShowTrainingGraphicModal(true)}
                                        className="h-8 px-2.5 text-[11px] bg-brand hover:bg-brand/90 text-white font-bold"
                                    >
                                        <Share2 className="h-3.5 w-3.5 mr-1" /> Graphic
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={downloadStatsExcel}
                                        className="h-8 px-2.5 text-[11px] border-border font-semibold"
                                    >
                                        <Download className="h-3.5 w-3.5 mr-1" /> Excel
                                    </Button>
                                </div>
                            </div>

                            {/* Scrollable Position Pills + Active Squad Only Toggle */}
                            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
                                {([
                                    { key: "ALL", label: "All", count: positionCounts.ALL },
                                    { key: "GK", label: "GK", count: positionCounts.GK },
                                    { key: "DEF", label: "DEF", count: positionCounts.DEF },
                                    { key: "MID", label: "MID", count: positionCounts.MID },
                                    { key: "FWD", label: "FWD", count: positionCounts.FWD },
                                ] as const).map((pos) => {
                                    const active = positionFilter === pos.key;
                                    return (
                                        <button
                                            key={pos.key}
                                            type="button"
                                            onClick={() => setPositionFilter(pos.key)}
                                            className={`shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold transition-all border ${
                                                active
                                                    ? "bg-brand text-white border-brand shadow-xs"
                                                    : "bg-background text-muted-foreground border-border"
                                            }`}
                                        >
                                            <span>{pos.label}</span>
                                            <span className={`px-1 rounded-full text-[9px] font-extrabold ${active ? "bg-white/20 text-white" : "bg-surface-1 text-muted-foreground"}`}>
                                                {pos.count}
                                            </span>
                                        </button>
                                    );
                                })}

                                <button
                                    type="button"
                                    onClick={() => setActiveSquadOnly(prev => !prev)}
                                    className={`shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold transition-all border ${
                                        activeSquadOnly
                                            ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40"
                                            : "bg-background text-muted-foreground border-border"
                                    }`}
                                >
                                    <span>{activeSquadOnly ? "✓ Active Only" : `+ Former (${formerPlayersCount})`}</span>
                                </button>
                            </div>
                        </div>

                        {/* Mobile Player Leaderboard Cards */}
                        <div className="bg-surface-1 border border-border rounded-xl divide-y divide-border overflow-hidden shadow-xs">
                            {playerStats.map((player, idx) => {
                                const pct = player.stats.percentage;
                                const pctColor =
                                    pct >= 80
                                        ? "bg-status-success/15 text-status-success border-status-success/30"
                                        : pct >= 50
                                        ? "bg-status-warning/15 text-status-warning border-status-warning/30"
                                        : "bg-status-error/15 text-status-error border-status-error/30";

                                return (
                                    <div key={player.id} className="p-3 flex items-center justify-between gap-2.5">
                                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                            <span className="text-[11px] font-extrabold text-muted-foreground w-4 text-center shrink-0 tabular-nums">
                                                {idx + 1}
                                            </span>
                                            <Avatar className="h-9 w-9 ring-1 ring-border shrink-0">
                                                <AvatarImage src={player.imageUrl || settings?.logo || undefined} />
                                                <AvatarFallback className="bg-background text-muted-foreground text-xs font-bold">
                                                    {player.firstName[0]}{player.lastName[0]}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div className="min-w-0 flex-1 space-y-1">
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    <span className="font-bold text-xs text-foreground truncate">
                                                        {player.firstName} {player.lastName}
                                                    </span>
                                                    {player.position && (
                                                        <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold uppercase bg-background text-muted-foreground border border-border shrink-0">
                                                            {player.position}
                                                        </span>
                                                    )}
                                                    {player.stats.streak >= 5 && (
                                                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/35 shrink-0">
                                                            🔥 {player.stats.streak}
                                                        </span>
                                                    )}
                                                    {player.playerIsFormer && (
                                                        <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/35 shrink-0">
                                                            Left
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Bottom Row: Last 5 Pills + Start Date / Late Chips */}
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    <div className="inline-flex items-center gap-0.5">
                                                        {player.stats.last5.length > 0 ? (
                                                            player.stats.last5.map((sessionItem) => {
                                                                const pillStyle =
                                                                    sessionItem.status === "Present"
                                                                        ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/45"
                                                                        : sessionItem.status === "Late"
                                                                        ? "bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/45"
                                                                        : "bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/45";
                                                                const symbol =
                                                                    sessionItem.status === "Present"
                                                                        ? "✓"
                                                                        : sessionItem.status === "Late"
                                                                        ? "L"
                                                                        : "×";
                                                                return (
                                                                    <span
                                                                        key={sessionItem.id}
                                                                        className={`w-4 h-4 rounded text-[9px] font-bold inline-flex items-center justify-center select-none ${pillStyle}`}
                                                                    >
                                                                        {symbol}
                                                                    </span>
                                                                );
                                                            })
                                                        ) : (
                                                            <span className="text-[10px] text-muted-foreground">No sessions</span>
                                                        )}
                                                    </div>

                                                    {player.stats.late > 0 && (
                                                        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/35">
                                                            {player.stats.late} Late
                                                        </span>
                                                    )}

                                                    <button
                                                        type="button"
                                                        onClick={() => handleOpenAmendStartDate(player)}
                                                        className={`inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-semibold border transition-colors ${
                                                            player.joinedMidSeason && player.effectiveStartDate
                                                                ? "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/25"
                                                                : "bg-background text-muted-foreground border-border"
                                                        }`}
                                                    >
                                                        <CalendarDays className="h-2.5 w-2.5" />
                                                        <span>
                                                            {player.joinedMidSeason && player.effectiveStartDate
                                                                ? `Joined ${new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(new Date(player.effectiveStartDate))}`
                                                                : "Start Date"}
                                                        </span>
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Right Side: Percentage + Attended/Total */}
                                        <div className="flex flex-col items-end shrink-0">
                                            <span className={`px-2 py-0.5 rounded-md text-xs font-extrabold border tabular-nums ${pctColor}`}>
                                                {pct}%
                                            </span>
                                            <span className="text-[10px] font-bold text-foreground mt-1 tabular-nums">
                                                {player.stats.attended}<span className="text-muted-foreground font-normal">/{player.stats.total}</span>
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}

                            {playerStats.length === 0 && (
                                <div className="p-8 text-center text-xs text-muted-foreground font-medium">
                                    No training stats available for this filter yet.
                                </div>
                            )}
                        </div>
                    </div>

                    {/* =========================================================
                        DESKTOP ATTENDANCE LEADERBOARD (>= 768px) — UNTOUCHED
                       ========================================================= */}
                    <div className="hidden md:block">
                <Card className="border-border shadow-sm overflow-hidden">
                    <CardHeader className="bg-surface-1 border-b border-border space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div>
                                <CardTitle>Training Attendance</CardTitle>
                                <CardDescription>Tracking {displaySeasonLabel} • Click any column header to sort</CardDescription>
                            </div>
                            <div className="flex flex-wrap items-center gap-3">
                                <Button
                                    size="sm"
                                    onClick={() => setShowTrainingGraphicModal(true)}
                                    className="bg-brand hover:bg-brand/90 text-white font-semibold"
                                >
                                    <Share2 className="h-4 w-4 mr-1.5" /> Share Graphic
                                </Button>
                                <Button variant="outline" size="sm" onClick={downloadStatsExcel} className="border-border">
                                    <Download className="h-4 w-4 mr-2" /> Export Excel
                                </Button>
                                <div className="text-right pl-2">
                                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Sessions</p>
                                    <p className="text-2xl font-bold text-foreground">{leaderboardSessions.length}</p>
                                </div>
                            </div>
                        </div>

                        {/* Position Filter Pills + Active Squad Only Toggle + Last 5 Legend */}
                        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                                {([
                                    { key: "ALL", label: "All Positions", count: positionCounts.ALL },
                                    { key: "GK", label: "GK", count: positionCounts.GK },
                                    { key: "DEF", label: "DEF", count: positionCounts.DEF },
                                    { key: "MID", label: "MID", count: positionCounts.MID },
                                    { key: "FWD", label: "FWD", count: positionCounts.FWD },
                                ] as const).map((pos) => {
                                    const active = positionFilter === pos.key;
                                    return (
                                        <button
                                            key={pos.key}
                                            type="button"
                                            onClick={() => setPositionFilter(pos.key)}
                                            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all border ${
                                                active
                                                    ? "bg-brand text-white border-brand shadow-xs"
                                                    : "bg-background text-muted-foreground border-border hover:text-foreground hover:bg-surface-1"
                                            }`}
                                        >
                                            <span>{pos.label}</span>
                                            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${active ? "bg-white/20 text-white" : "bg-surface-1 text-muted-foreground"}`}>
                                                {pos.count}
                                            </span>
                                        </button>
                                    );
                                })}

                                <div className="h-4 w-px bg-border mx-1 hidden sm:block" />

                                <button
                                    type="button"
                                    onClick={() => setActiveSquadOnly(prev => !prev)}
                                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all border cursor-pointer ${
                                        activeSquadOnly
                                            ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40"
                                            : "bg-background text-muted-foreground border-border hover:text-foreground"
                                    }`}
                                    title="Toggle whether departed players are hidden or shown in the attendance table"
                                >
                                    <span>{activeSquadOnly ? "✓ Active Squad Only" : `Including Former (${formerPlayersCount})`}</span>
                                </button>
                            </div>

                            <div className="flex items-center gap-3 text-[11px] font-medium text-muted-foreground">
                                <span className="inline-flex items-center gap-1">
                                    <span className="w-4 h-4 rounded text-[10px] font-bold inline-flex items-center justify-center bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/45">✓</span>
                                    Present
                                </span>
                                <span className="inline-flex items-center gap-1">
                                    <span className="w-4 h-4 rounded text-[10px] font-bold inline-flex items-center justify-center bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/45">L</span>
                                    Late
                                </span>
                                <span className="inline-flex items-center gap-1">
                                    <span className="w-4 h-4 rounded text-[10px] font-bold inline-flex items-center justify-center bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/45">×</span>
                                    Absent
                                </span>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-surface-1 text-muted-foreground uppercase font-semibold text-xs border-b border-border select-none">
                                    <tr>
                                        <th
                                            onClick={() => handleAttendanceSort("player")}
                                            className="px-6 py-3.5 cursor-pointer hover:text-foreground transition-colors"
                                        >
                                            <span className="inline-flex items-center gap-1">
                                                Player
                                                <span className="text-[10px] opacity-70">
                                                    {attendanceSortBy === "player" ? (attendanceSortDir === "asc" ? "▲" : "▼") : "↕"}
                                                </span>
                                            </span>
                                        </th>
                                        <th
                                            onClick={() => handleAttendanceSort("squad")}
                                            className="px-4 py-3.5 cursor-pointer hover:text-foreground transition-colors hidden md:table-cell"
                                        >
                                            <span className="inline-flex items-center gap-1">
                                                Squad
                                                <span className="text-[10px] opacity-70">
                                                    {attendanceSortBy === "squad" ? (attendanceSortDir === "asc" ? "▲" : "▼") : "↕"}
                                                </span>
                                            </span>
                                        </th>
                                        <th
                                            onClick={() => handleAttendanceSort("attended")}
                                            className="px-4 py-3.5 text-center cursor-pointer hover:text-foreground transition-colors"
                                        >
                                            <span className="inline-flex items-center justify-center gap-1">
                                                Attended
                                                <span className="text-[10px] opacity-70">
                                                    {attendanceSortBy === "attended" ? (attendanceSortDir === "asc" ? "▲" : "▼") : "↕"}
                                                </span>
                                            </span>
                                        </th>
                                        <th
                                            onClick={() => handleAttendanceSort("late")}
                                            className="px-4 py-3.5 text-center cursor-pointer hover:text-foreground transition-colors hidden sm:table-cell"
                                        >
                                            <span className="inline-flex items-center justify-center gap-1">
                                                Late
                                                <span className="text-[10px] opacity-70">
                                                    {attendanceSortBy === "late" ? (attendanceSortDir === "asc" ? "▲" : "▼") : "↕"}
                                                </span>
                                            </span>
                                        </th>
                                        <th
                                            onClick={() => handleAttendanceSort("last5")}
                                            className="px-4 py-3.5 text-center cursor-pointer hover:text-foreground transition-colors"
                                        >
                                            <span className="inline-flex items-center justify-center gap-1">
                                                Last 5 Sessions
                                                <span className="text-[10px] opacity-70">
                                                    {attendanceSortBy === "last5" ? (attendanceSortDir === "asc" ? "▲" : "▼") : "↕"}
                                                </span>
                                            </span>
                                        </th>
                                        <th
                                            onClick={() => handleAttendanceSort("percentage")}
                                            className="px-4 py-3.5 text-center cursor-pointer hover:text-foreground transition-colors"
                                        >
                                            <span className="inline-flex items-center justify-center gap-1">
                                                Attendance %
                                                <span className="text-[10px] opacity-70">
                                                    {attendanceSortBy === "percentage" ? (attendanceSortDir === "asc" ? "▲" : "▼") : "↕"}
                                                </span>
                                            </span>
                                        </th>
                                        <th className="px-6 py-3.5 hidden lg:table-cell">Progress</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {playerStats.map((player) => (
                                        <tr key={player.id} className="hover:bg-surface-1/50 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <Avatar className="h-8 w-8 ring-1 ring-border">
                                                        <AvatarImage src={player.imageUrl || settings?.logo || undefined} />
                                                        <AvatarFallback className="bg-surface-1 text-muted-foreground">{player.firstName[0]}{player.lastName[0]}</AvatarFallback>
                                                    </Avatar>
                                                    <div className="flex flex-wrap items-center gap-2 group/player">
                                                        <span className="font-bold text-foreground">{player.firstName} {player.lastName}</span>
                                                        {player.position && (
                                                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-surface-1 text-muted-foreground border border-border">
                                                                {player.position}
                                                            </span>
                                                        )}
                                                        {player.joinedMidSeason && player.effectiveStartDate ? (
                                                            <button
                                                                type="button"
                                                                onClick={() => handleOpenAmendStartDate(player)}
                                                                title={`Tracked from ${formatDate(player.effectiveStartDate)} • Click to amend start date or backfill attendance`}
                                                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-500/10 hover:bg-blue-500/20 text-blue-700 dark:text-blue-300 border border-blue-500/25 transition-colors cursor-pointer"
                                                            >
                                                                <span>Joined {new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(new Date(player.effectiveStartDate))}</span>
                                                                <Pencil className="h-2.5 w-2.5 opacity-75" />
                                                            </button>
                                                        ) : (
                                                            <button
                                                                type="button"
                                                                onClick={() => handleOpenAmendStartDate(player)}
                                                                title="Amend player start date or backfill session attendance"
                                                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-surface-1 hover:bg-brand/10 text-muted-foreground hover:text-brand border border-border transition-all opacity-0 group-hover/player:opacity-100 focus:opacity-100 cursor-pointer"
                                                            >
                                                                <CalendarDays className="h-2.5 w-2.5" />
                                                                <span>Start Date</span>
                                                            </button>
                                                        )}
                                                        {player.playerIsFormer && (
                                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/35">
                                                                Left Club
                                                            </span>
                                                        )}
                                                        {player.stats.streak >= 5 && (
                                                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/35">
                                                                🔥 {player.stats.streak} Streak
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-4 text-muted-foreground font-medium hidden md:table-cell">{formatSquad(player.squad)}</td>
                                            <td className="px-4 py-4 text-center">
                                                <div className="font-bold text-foreground">{player.stats.attended}<span className="text-muted-foreground font-normal">/{player.stats.total}</span></div>
                                            </td>
                                            <td className="px-4 py-4 text-center hidden sm:table-cell">
                                                {player.stats.late > 0 ? (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/35">
                                                        {player.stats.late}
                                                    </span>
                                                ) : (
                                                    <span className="text-xs text-muted-foreground font-medium">0</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-4 text-center">
                                                <div className="inline-flex items-center justify-center gap-1">
                                                    {player.stats.last5.length > 0 ? (
                                                        player.stats.last5.map((sessionItem) => {
                                                            const pillStyle =
                                                                sessionItem.status === "Present"
                                                                    ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/45"
                                                                    : sessionItem.status === "Late"
                                                                    ? "bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/45"
                                                                    : "bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/45";
                                                            const symbol =
                                                                sessionItem.status === "Present"
                                                                    ? "✓"
                                                                    : sessionItem.status === "Late"
                                                                    ? "L"
                                                                    : "×";
                                                            return (
                                                                <span
                                                                    key={sessionItem.id}
                                                                    title={`${formatDate(sessionItem.date)} • ${sessionItem.topic}: ${sessionItem.status}`}
                                                                    className={`w-5 h-5 rounded text-[11px] font-bold inline-flex items-center justify-center select-none ${pillStyle}`}
                                                                >
                                                                    {symbol}
                                                                </span>
                                                            );
                                                        })
                                                    ) : (
                                                        <span className="text-xs text-muted-foreground">—</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-4 text-center">
                                                <Badge variant="secondary" className={`${player.stats.percentage >= 80 ? 'bg-status-success/10 text-status-success' : player.stats.percentage >= 50 ? 'bg-status-warning/10 text-status-warning' : 'bg-status-error/10 text-status-error'}`}>
                                                    {player.stats.percentage}%
                                                </Badge>
                                            </td>
                                            <td className="px-6 py-4 hidden lg:table-cell">
                                                <div className="w-full bg-surface-1 border border-border rounded-full h-2 overflow-hidden">
                                                    <div
                                                        className={`h-full ${player.stats.percentage >= 80 ? 'bg-status-success' : player.stats.percentage >= 50 ? 'bg-status-warning' : 'bg-status-error'}`}
                                                        style={{ width: `${player.stats.percentage}%` }}
                                                    ></div>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {playerStats.length === 0 && (
                                        <tr>
                                            <td colSpan={7} className="px-6 py-12 text-center text-muted-foreground font-medium">
                                                No training stats available for this filter yet.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
                    </div>
                </>
            )}

            {isDialogOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-3 sm:p-4 backdrop-blur-sm">
                    <div className="bg-background rounded-xl shadow-2xl border border-border w-full max-w-md max-h-[90dvh] flex flex-col overflow-hidden">
                        <div className="p-4 sm:p-5 border-b border-border bg-surface-1 flex justify-between items-center shrink-0">
                            <h3 className="font-bold text-base sm:text-lg text-foreground">{editingSessionId ? "Edit Session" : "Schedule Preparation"}</h3>
                            <button onClick={() => setIsDialogOpen(false)} className="text-muted-foreground hover:text-foreground transition-colors text-xl leading-none p-1">×</button>
                        </div>
                        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <label className="text-xs sm:text-sm font-semibold text-foreground">Date</label>
                                    <Input
                                        type="date"
                                        value={newSession.date}
                                        onChange={(e) => setNewSession({ ...newSession, date: e.target.value })}
                                        className="border-border bg-background text-foreground"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs sm:text-sm font-semibold text-foreground">Time</label>
                                    <Input
                                        type="time"
                                        value={newSession.time}
                                        onChange={(e) => setNewSession({ ...newSession, time: e.target.value })}
                                        className="border-border bg-background text-foreground"
                                    />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs sm:text-sm font-semibold text-foreground">Location</label>
                                <Input
                                    value={newSession.location}
                                    onChange={(e) => setNewSession({ ...newSession, location: e.target.value })}
                                    placeholder="Enter location"
                                    className="border-border bg-background text-foreground"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs sm:text-sm font-semibold text-foreground">Squad</label>
                                <select
                                    className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand"
                                    value={newSession.squad}
                                    onChange={(e) => setNewSession({ ...newSession, squad: e.target.value as any })}
                                >
                                    <option value="All">All Squads</option>
                                    {currentSquads.map((squad: string) => (
                                        <option key={squad} value={squad}>{squad}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs sm:text-sm font-semibold text-foreground">Coaching Objective</label>
                                <Input
                                    value={newSession.topic}
                                    onChange={(e) => setNewSession({ ...newSession, topic: e.target.value })}
                                    placeholder="e.g. Possession, Pressing, Match Prep"
                                    className="border-border bg-background text-foreground"
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-2 border-b border-dashed border-border">
                                <div className="space-y-1.5">
                                    <label className="text-xs sm:text-sm font-semibold text-foreground">Availability Lock</label>
                                    <select
                                        className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand text-foreground"
                                        value={newSession.lockType || "Never"}
                                        onChange={(e) => setNewSession({ ...newSession, lockType: e.target.value })}
                                    >
                                        <option value="Never">Never Lock</option>
                                        <option value="Start">At Training Start</option>
                                        <option value="30m">30 Mins Before</option>
                                        <option value="1h">1 Hour Before</option>
                                        <option value="Custom">Custom Time</option>
                                    </select>
                                </div>
                                {newSession.lockType === "Custom" && (
                                    <div className="space-y-1.5">
                                        <label className="text-xs sm:text-sm font-semibold text-foreground">Custom Lock Time</label>
                                        <Input
                                            type="datetime-local"
                                            value={newSession.lockTime || ""}
                                            onChange={(e) => setNewSession({ ...newSession, lockTime: e.target.value })}
                                            className="h-10 text-sm border-border bg-background text-foreground"
                                        />
                                    </div>
                                )}
                            </div>

                            {!editingSessionId && (
                                <div className="space-y-3 pt-1">
                                    <div className="flex items-center gap-2">
                                        <input 
                                            type="checkbox" 
                                            id="repeatWeekly" 
                                            checked={newSession.repeatWeekly || false}
                                            onChange={(e) => setNewSession({ ...newSession, repeatWeekly: e.target.checked, repeatWeeks: e.target.checked ? 4 : 1 })}
                                            className="h-4 w-4 rounded border-border text-brand focus:ring-brand cursor-pointer"
                                        />
                                        <label htmlFor="repeatWeekly" className="text-sm font-semibold text-foreground cursor-pointer">Repeat Weekly</label>
                                    </div>
                                    {newSession.repeatWeekly && (
                                        <div className="space-y-1 pl-6">
                                            <label className="text-xs font-semibold text-muted-foreground">Number of weeks (1 to 12)</label>
                                            <Input
                                                type="number"
                                                min={1}
                                                max={12}
                                                value={newSession.repeatWeeks || 4}
                                                onChange={(e) => setNewSession({ ...newSession, repeatWeeks: Math.max(1, Math.min(12, parseInt(e.target.value) || 1)) })}
                                                className="w-24 h-9 text-xs border-border bg-background text-foreground"
                                            />
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                        <div className="p-4 sm:p-5 border-t border-border bg-surface-1 flex justify-end gap-2.5 shrink-0">
                            <Button variant="outline" className="border-border text-foreground" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                            <Button className="bg-brand hover:bg-brand/90 text-white" onClick={handleSchedule} disabled={!newSession.date}>
                                {editingSessionId ? "Save Changes" : "Schedule Preparation"}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Share WhatsApp Poll Modal */}
            <Dialog open={activeShareSession !== null} onOpenChange={(open) => { if (!open) setActiveShareSession(null); }}>
                <DialogContent className="sm:max-w-[620px] max-h-[85vh] overflow-y-auto bg-background border-border">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-brand">
                            Share Availability Poll
                        </DialogTitle>
                        <DialogDescription className="text-muted-foreground">
                            Send a check-in message to your squad via WhatsApp.
                        </DialogDescription>
                    </DialogHeader>

                    {activeShareSession && (
                        <div className="grid gap-4 py-2 text-foreground">
                            {/* Toggle switches/checkboxes */}
                            <div className="space-y-2 border-b border-border pb-3">
                                <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">Include Details:</Label>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                    <label className="flex items-center gap-2 text-sm font-medium text-foreground cursor-pointer p-1.5 hover:bg-surface-1 rounded transition-colors">
                                        <input
                                            type="checkbox"
                                            checked={includeVenue}
                                            onChange={(e) => setIncludeVenue(e.target.checked)}
                                            className="h-4 w-4 rounded border-border text-brand focus:ring-brand cursor-pointer"
                                        />
                                        <span>Venue</span>
                                    </label>
                                    <label className="flex items-center gap-2 text-sm font-medium text-foreground cursor-pointer p-1.5 hover:bg-surface-1 rounded transition-colors">
                                        <input
                                            type="checkbox"
                                            checked={includeTopic}
                                            onChange={(e) => setIncludeTopic(e.target.checked)}
                                            className="h-4 w-4 rounded border-border text-brand focus:ring-brand cursor-pointer"
                                        />
                                        <span>Coaching Objective</span>
                                    </label>
                                    <label className="flex items-center gap-2 text-sm font-medium text-foreground cursor-pointer p-1.5 hover:bg-surface-1 rounded transition-colors">
                                        <input
                                            type="checkbox"
                                            checked={includeNotes}
                                            onChange={(e) => setIncludeNotes(e.target.checked)}
                                            className="h-4 w-4 rounded border-border text-brand focus:ring-brand cursor-pointer"
                                        />
                                        <span>Notes</span>
                                    </label>
                                </div>
                            </div>

                            {/* Additional Notes Textarea */}
                            {includeNotes && (
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-semibold text-foreground">Additional Notes (Optional)</Label>
                                    <Textarea
                                        value={additionalNotes}
                                        onChange={(e) => setAdditionalNotes(e.target.value)}
                                        placeholder="e.g. ⚠ Bring running trainers."
                                        className="text-xs min-h-[60px] border-border bg-surface-1 text-foreground"
                                    />
                                </div>
                            )}

                            {/* Live Preview block */}
                            <div className="space-y-1.5 border-t border-border pt-3">
                                <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Message Preview</Label>
                                <div className="relative">
                                    <Textarea
                                        value={getTrainingGeneratedPollText()}
                                        readOnly
                                        className="text-xs min-h-[200px] font-mono bg-surface-1 border-border text-foreground focus-visible:ring-0 cursor-default"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    <DialogFooter className="gap-2 sm:gap-0 border-t border-border pt-4">
                        <Button variant="outline" className="border-border text-foreground" onClick={() => setActiveShareSession(null)}>
                            Cancel
                        </Button>
                        <Button
                            variant={copyStatus === "copied" ? "default" : "secondary"}
                            onClick={handleCopyTrainingShareText}
                            className={`font-semibold min-w-[160px] transition-all ${
                                copyStatus === "copied" 
                                    ? "bg-status-success hover:bg-status-success/90 text-white" 
                                    : "bg-surface-1 hover:bg-surface-1/80 border border-border text-foreground"
                            }`}
                        >
                            {copyStatus === "copied" ? "✓ Copied" : "Copy to Clipboard"}
                        </Button>
                        <Button
                            onClick={handleSendTrainingWhatsApp}
                            className="bg-brand hover:bg-brand/90 text-white font-medium"
                        >
                            <ExternalLink className="h-4 w-4 mr-2" /> Send via WhatsApp
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Amend Player Start Date & Backfill Attendance Modal */}
            <Dialog open={!!editingStartDatePlayer} onOpenChange={(open) => !open && setEditingStartDatePlayer(null)}>
                <DialogContent className="sm:max-w-[520px] max-h-[88dvh] overflow-y-auto bg-background border-border text-foreground">
                    <DialogHeader>
                        <DialogTitle className="text-base sm:text-xl font-bold flex items-center gap-2">
                            <CalendarDays className="h-5 w-5 text-brand shrink-0" />
                            <span>Amend Start Date — {editingStartDatePlayer?.firstName} {editingStartDatePlayer?.lastName}</span>
                        </DialogTitle>
                        <DialogDescription className="text-muted-foreground text-xs">
                            Set the exact date this player started training with the squad, and log or adjust their attendance for sessions since that date.
                        </DialogDescription>
                    </DialogHeader>

                    {editingStartDatePlayer && (
                        <div className="space-y-4 py-2">
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label className="text-xs font-semibold text-foreground">First Training / Join Date</Label>
                                    {customStartDateInput && (
                                        <button
                                            type="button"
                                            onClick={() => setCustomStartDateInput("")}
                                            className="text-[11px] font-medium text-muted-foreground hover:text-foreground underline"
                                        >
                                            Reset to Auto-Detect
                                        </button>
                                    )}
                                </div>
                                <Input
                                    type="date"
                                    value={customStartDateInput}
                                    onChange={(e) => setCustomStartDateInput(e.target.value)}
                                    className="border-border bg-surface-1 text-foreground"
                                />
                                <div className="space-y-1 pt-1">
                                    <p className="text-[11px] font-medium text-muted-foreground">Quick-pick from recent session dates:</p>
                                    <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                                        {leaderboardSessions.slice(-10).map((s) => {
                                            const isSelected = customStartDateInput === s.date;
                                            return (
                                                <button
                                                    key={s.id}
                                                    type="button"
                                                    onClick={() => setCustomStartDateInput(s.date)}
                                                    className={`px-2 py-1 rounded text-[11px] font-semibold border transition-all ${
                                                        isSelected
                                                            ? "bg-brand text-white border-brand"
                                                            : "bg-surface-1 text-muted-foreground border-border hover:text-foreground"
                                                    }`}
                                                >
                                                    {formatDate(s.date)}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>

                            {/* Backfill / Edit Sessions Since Start Date */}
                            <div className="space-y-2 border-t border-border pt-3">
                                <div className="flex items-center justify-between">
                                    <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                                        Sessions From Start Date ({leaderboardSessions.filter(s => !customStartDateInput || s.date >= customStartDateInput).length})
                                    </Label>
                                    <span className="text-[11px] text-muted-foreground">Tap to mark</span>
                                </div>
                                <div className="max-h-[240px] overflow-y-auto divide-y divide-border border border-border rounded-lg bg-surface-1/50">
                                    {leaderboardSessions
                                        .filter(s => !customStartDateInput || s.date >= customStartDateInput)
                                        .slice()
                                        .reverse()
                                        .map((s) => {
                                            const st = sessionStatusOverrides[s.id] || "Absent";
                                            return (
                                                <div key={s.id} className="flex items-center justify-between gap-2 px-3 py-2 text-xs">
                                                    <div className="min-w-0 flex-1">
                                                        <p className="font-semibold text-foreground truncate">{formatDate(s.date)}</p>
                                                        <p className="text-[11px] text-muted-foreground truncate">{s.topic || "General Preparation"}</p>
                                                    </div>
                                                    <div className="inline-flex items-center gap-1 shrink-0">
                                                        {(["Present", "Late", "Absent"] as const).map((opt) => {
                                                            const active = st === opt;
                                                            const activeClass =
                                                                opt === "Present"
                                                                    ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/50"
                                                                    : opt === "Late"
                                                                    ? "bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/50"
                                                                    : "bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-500/50";
                                                            return (
                                                                <button
                                                                    key={opt}
                                                                    type="button"
                                                                    onClick={() =>
                                                                        setSessionStatusOverrides(prev => ({
                                                                            ...prev,
                                                                            [s.id]: opt
                                                                        }))
                                                                    }
                                                                    className={`px-2 py-1 rounded text-[10px] sm:text-[11px] font-bold border transition-all ${
                                                                        active
                                                                            ? activeClass
                                                                            : "bg-background text-muted-foreground border-border hover:text-foreground"
                                                                    }`}
                                                                >
                                                                    {opt === "Present" ? "✓" : opt === "Late" ? "L" : "×"} <span className="hidden sm:inline">{opt}</span>
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                </div>
                            </div>
                        </div>
                    )}

                    <DialogFooter className="gap-2 sm:gap-0 border-t border-border pt-4">
                        <Button variant="outline" className="border-border text-foreground" onClick={() => setEditingStartDatePlayer(null)}>
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSaveAmendStartDate}
                            disabled={isSavingStartDate}
                            className="bg-brand hover:bg-brand/90 text-white font-semibold"
                        >
                            {isSavingStartDate ? "Saving..." : "Save Start Date & Attendance"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Shareable Training Commitment Graphic Studio Modal */}
            {showTrainingGraphicModal && (
                <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
                    <div className="bg-surface-1 border border-border rounded-2xl max-w-2xl w-full p-4 sm:p-6 space-y-3 sm:space-y-4 shadow-2xl my-auto max-h-[92dvh] flex flex-col overflow-hidden">
                        <div className="flex items-center justify-between border-b border-border pb-3 shrink-0">
                            <div>
                                <h3 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
                                    <Share2 className="h-4 w-4 sm:h-5 sm:w-5 text-brand shrink-0" />
                                    <span>Share Training Commitment Graphic</span>
                                </h3>
                                <p className="text-[11px] sm:text-xs text-muted-foreground">
                                    Club-branded leaderboard ready for your WhatsApp Squad Chat or Instagram Story.
                                </p>
                            </div>
                            <Button variant="ghost" size="sm" onClick={() => setShowTrainingGraphicModal(false)} className="h-8 w-8 p-0 shrink-0">
                                <X className="h-4 w-4" />
                            </Button>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 shrink-0">
                            <div className="flex items-center gap-1 bg-background p-1 rounded-lg border border-border w-full sm:w-auto">
                                <button
                                    type="button"
                                    onClick={() => setTrainingGraphicFormat("post")}
                                    className={`flex-1 sm:flex-initial px-2.5 py-1 rounded-md text-[11px] sm:text-xs font-semibold transition-colors ${trainingGraphicFormat === "post" ? "bg-brand text-white" : "text-muted-foreground hover:text-foreground"}`}
                                >
                                    Feed Post (4:5)
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setTrainingGraphicFormat("story")}
                                    className={`flex-1 sm:flex-initial px-2.5 py-1 rounded-md text-[11px] sm:text-xs font-semibold transition-colors ${trainingGraphicFormat === "story" ? "bg-brand text-white" : "text-muted-foreground hover:text-foreground"}`}
                                >
                                    Story (9:16)
                                </button>
                            </div>

                            <div className="flex items-center gap-1 bg-background p-1 rounded-lg border border-border w-full sm:w-auto">
                                <button
                                    type="button"
                                    onClick={() => setTrainingGraphicScope("top10")}
                                    className={`flex-1 sm:flex-initial px-2.5 py-1 rounded-md text-[11px] sm:text-xs font-semibold transition-colors ${trainingGraphicScope === "top10" ? "bg-brand text-white" : "text-muted-foreground hover:text-foreground"}`}
                                >
                                    Top 10 Spotlight
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setTrainingGraphicScope("full")}
                                    className={`flex-1 sm:flex-initial px-2.5 py-1 rounded-md text-[11px] sm:text-xs font-semibold transition-colors ${trainingGraphicScope === "full" ? "bg-brand text-white" : "text-muted-foreground hover:text-foreground"}`}
                                >
                                    Full Squad ({scopedPlayerStats.filter(p => p.stats.total > 0).length})
                                </button>
                            </div>
                        </div>

                        <div className="bg-black/50 border border-border rounded-xl p-2 sm:p-3 flex justify-center overflow-y-auto flex-1 min-h-0">
                            <canvas
                                ref={trainingShareCanvasRef}
                                className="max-w-full h-auto rounded-lg shadow-lg object-contain"
                                style={{ maxHeight: "46vh" }}
                            />
                        </div>

                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 pt-1 shrink-0">
                            <Button variant="outline" onClick={handleCopyTrainingGraphic} className="w-full sm:w-auto text-xs sm:text-sm">
                                <Copy className="h-4 w-4 mr-1.5" />
                                {copiedTrainingGraphic ? "Copied to Clipboard!" : "Copy for WhatsApp / Social"}
                            </Button>
                            <Button onClick={handleDownloadTrainingGraphic} className="w-full sm:w-auto bg-brand hover:bg-brand/90 text-white font-semibold text-xs sm:text-sm">
                                <Download className="h-4 w-4 mr-1.5" />
                                Download PNG
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
