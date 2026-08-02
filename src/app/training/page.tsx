"use client";

import { useState, useEffect } from "react";
import { TrainingSession, Player } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, CalendarDays, MapPin, Users, Trash2, Pencil, BarChart3, List, Download, ClipboardList, MessageCircle, Copy, ExternalLink, Link2, Repeat, Clock } from "lucide-react";
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

export default function TrainingPage() {
    const { settings } = useClub();
    const searchParams = useSearchParams();
    const currentSquads = settings.squads || ["First Team"];

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

    // WhatsApp Generated Availability Poll State
    const [activeShareSession, setActiveShareSession] = useState<TrainingSession | null>(null);
    const [includeVenue, setIncludeVenue] = useState(true);
    const [includeTopic, setIncludeTopic] = useState(true);
    const [includeNotes, setIncludeNotes] = useState(true);
    const [additionalNotes, setAdditionalNotes] = useState("");
    const [copyStatus, setCopyStatus] = useState<"idle" | "copied">("idle");

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
            // Map simple fields needed for stats
            setPlayers(data.map((p: any) => {
                const pSquadClean = p.squad?.toLowerCase().replace(/[\s-_]+/g, '') || '';
                const activeSquadMatch = currentSquads.find(s => s.toLowerCase().replace(/[\s-_]+/g, '') === pSquadClean);
                return {
                    id: p.id,
                    firstName: p.first_name,
                    lastName: p.last_name,
                    squad: activeSquadMatch || currentSquads[0] || "First Team",
                    isInTrainingSquad: p.is_in_training_squad,
                    isInMatchdayTracker: p.is_in_matchday_tracker,
                    imageUrl: p.image_url,
                    position: p.position,
                    squadNumber: p.squad_number,
                    medicalStatus: p.medical_status
                } as any;
            }));
        }
    };

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

    const getSessionAttendanceStats = (session: TrainingSession) => {
        const regAttendedCount = session.attendance.filter(a => !a.playerId.startsWith('guest:') && (a.status === 'Present' || a.status === 'Late')).length;
        const trialistAttendedCount = session.attendance.filter(a => a.playerId.startsWith('guest:') && (a.status === 'Present' || a.status === 'Late')).length;

        const eligiblePlayers = players.filter(p => 
            session.squad === "All" 
                ? (isFirstTeamSquad(p.squad) || p.isInTrainingSquad) 
                : (p.squad === session.squad || (session.squad === "First Team" && isFirstTeamSquad(p.squad)))
        );
        const totalEligible = eligiblePlayers.length;
        const percentage = totalEligible > 0 ? Math.round((regAttendedCount / totalEligible) * 100) : 0;
        return { regAttendedCount, trialistAttendedCount, totalEligible, percentage };
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
        // Include any session in the season window that has attendance marked,
        // whether past or future (so pre-scheduled sessions with saved attendance count)
        const hasAttendance = s.attendance && s.attendance.length > 0;
        return d >= seasonStartDate && (d <= now || hasAttendance);
    });

    const leaderboardSessions = seasonSessions.filter(s => squadFilter === "All" || s.squad === squadFilter);

    const leaderboardPlayers = squadFilter === "All"
        ? players.filter(p => isFirstTeamSquad(p.squad) || p.isInTrainingSquad)
        : players.filter(p => p.squad === squadFilter || (squadFilter === "First Team" && isFirstTeamSquad(p.squad)));

    const playerStats = leaderboardPlayers
        .map(player => {
            const attended = leaderboardSessions.filter(s => {
                const record = s.attendance.find(a => a.playerId === player.id);
                return record?.status === 'Present' || record?.status === 'Late'; // Late counts as present? Let's say yes for attendance stats, or maybe distinguish. Usually "Attended" includes late.
            }).length;

            const total = leaderboardSessions.length;
            const percentage = total > 0 ? Math.round((attended / total) * 100) : 0;

            return { ...player, stats: { attended, total, percentage } };
        })
        .sort((a, b) => b.stats.percentage - a.stats.percentage); // Sort by %

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

    return (
        <div className="space-y-8 pb-12">
            <PageHeader 
                title="Training Schedule" 
                description="Plan the week and prepare your squad for the next football activity." 
            />

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
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
                </div>

                {activeTab === 'sessions' && (
                    <Button className="bg-brand hover:bg-brand/90 text-white" onClick={handleOpenNew}>
                        <Plus className="h-4 w-4 mr-2" /> Schedule Session
                    </Button>
                )}
            </div>

            {activeTab === 'sessions' ? (
                <div className="space-y-8">
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
                                                <Button variant="outline" className="border-border text-foreground" onClick={() => handleOpenShare(trueUpcomingSessions[0])}>
                                                    <MessageCircle className="h-4 w-4 mr-2" /> Share Poll
                                                </Button>
                                            </div>
                                        </div>

                                        {/* Right Col: Attendance Readiness */}
                                        <div className="md:w-72 bg-surface-1 rounded-xl p-6 flex flex-col justify-center border border-border/50">
                                            <h5 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-4">Squad Availability</h5>
                                            
                                            {(() => {
                                                const { regAttendedCount, totalEligible } = getSessionAttendanceStats(trueUpcomingSessions[0]);
                                                const responded = trueUpcomingSessions[0].attendance.filter((a: any) => !a.playerId.startsWith('guest:')).length;
                                                const unavailable = responded - regAttendedCount;
                                                const awaiting = totalEligible - responded;
                                                
                                                return (
                                                    <div className="space-y-4">
                                                        <div className="flex justify-between items-center">
                                                            <div className="flex items-center gap-2">
                                                                <span className="h-5 w-5 rounded-full bg-status-success/20 text-status-success flex items-center justify-center font-bold text-xs">✓</span>
                                                                <span className="font-medium text-foreground">Confirmed</span>
                                                            </div>
                                                            <span className="text-xl font-bold text-foreground">{regAttendedCount}</span>
                                                        </div>
                                                        <div className="flex justify-between items-center">
                                                            <div className="flex items-center gap-2">
                                                                <span className="h-5 w-5 rounded-full bg-status-error/20 text-status-error flex items-center justify-center font-bold text-xs">×</span>
                                                                <span className="font-medium text-muted-foreground">Unavailable</span>
                                                            </div>
                                                            <span className="text-lg font-semibold text-muted-foreground">{unavailable}</span>
                                                        </div>
                                                        <div className="flex justify-between items-center">
                                                            <div className="flex items-center gap-2">
                                                                <span className="h-5 w-5 rounded-full bg-status-warning/20 text-status-warning flex items-center justify-center font-bold text-xs">?</span>
                                                                <span className="font-medium text-muted-foreground">Awaiting</span>
                                                            </div>
                                                            <span className="text-lg font-semibold text-muted-foreground">{awaiting > 0 ? awaiting : 0}</span>
                                                        </div>
                                                    </div>
                                                )
                                            })()}
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
                    {displaySessions.filter(s => new Date(s.date).toISOString().split("T")[0] < new Date().toISOString().split("T")[0]).length > 0 && (
                        <PageSection>
                            <SectionHeader title="Historical Record" description="Past sessions and attendance records." />
                            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 opacity-75">
                                {displaySessions.filter(s => new Date(s.date).toISOString().split("T")[0] < new Date().toISOString().split("T")[0]).map((session) => (
                                    <Card 
                                        key={session.id} 
                                        onClick={() => window.location.href = `/training/${session.id}`}
                                        className="hover:shadow-sm cursor-pointer border-border bg-surface-1"
                                    >
                                        <CardHeader className="pb-2">
                                            <div className="flex justify-between items-start">
                                                <CardTitle className="text-base text-foreground">{session.topic || "General Preparation"}</CardTitle>
                                                <span className="text-xs font-semibold text-muted-foreground">{formatSquad(session.squad)}</span>
                                            </div>
                                            <CardDescription className="flex items-center gap-1">
                                                {formatDate(session.date)}
                                            </CardDescription>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                                <span className="h-4 w-4 rounded-full bg-status-success/20 text-status-success flex items-center justify-center font-bold text-[10px]">✓</span>
                                                {getSessionAttendanceStats(session).regAttendedCount} Attended
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
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
            ) : (
                <Card className="border-border shadow-sm overflow-hidden">
                    <CardHeader className="bg-surface-1 border-b border-border">
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle>Training Attendance</CardTitle>
                                <CardDescription>Tracking {displaySeasonLabel}</CardDescription>
                            </div>
                            <div className="flex items-center gap-4">
                                <Button variant="outline" size="sm" onClick={downloadStatsExcel} className="border-border">
                                    <Download className="h-4 w-4 mr-2" /> Export Excel
                                </Button>
                                <div className="text-right">
                                    <p className="text-sm font-medium text-muted-foreground">Total Sessions</p>
                                    <p className="text-2xl font-bold text-foreground">{leaderboardSessions.length}</p>
                                </div>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-surface-1 text-muted-foreground uppercase font-semibold text-xs border-b border-border">
                                    <tr>
                                        <th className="px-6 py-4">Player</th>
                                        <th className="px-6 py-4">Squad</th>
                                        <th className="px-6 py-4 text-center">Attended</th>
                                        <th className="px-6 py-4 text-center">Attendance %</th>
                                        <th className="px-6 py-4">Progress</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {playerStats.map((player) => (
                                        <tr key={player.id} className="hover:bg-surface-1/50 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <Avatar className="h-8 w-8 ring-1 ring-border">
                                                        <AvatarImage src={settings?.logo || player.imageUrl} />
                                                        <AvatarFallback className="bg-surface-1 text-muted-foreground">{player.firstName[0]}{player.lastName[0]}</AvatarFallback>
                                                    </Avatar>
                                                    <span className="font-bold text-foreground">{player.firstName} {player.lastName}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-muted-foreground font-medium">{formatSquad(player.squad)}</td>
                                            <td className="px-6 py-4 text-center">
                                                <div className="font-bold text-foreground">{player.stats.attended}<span className="text-muted-foreground font-normal">/{player.stats.total}</span></div>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <Badge variant="secondary" className={`${player.stats.percentage >= 80 ? 'bg-status-success/10 text-status-success' : player.stats.percentage >= 50 ? 'bg-status-warning/10 text-status-warning' : 'bg-status-error/10 text-status-error'}`}>
                                                    {player.stats.percentage}%
                                                </Badge>
                                            </td>
                                            <td className="px-6 py-4">
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
                                            <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground font-medium">
                                                No training stats available for this season yet.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            )}

            {isDialogOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
                    <div className="bg-background rounded-xl shadow-2xl border border-border w-full max-w-md overflow-hidden">
                        <div className="p-5 border-b border-border bg-surface-1 flex justify-between items-center">
                            <h3 className="font-bold text-lg text-foreground">{editingSessionId ? "Edit Session" : "Schedule Preparation"}</h3>
                            <button onClick={() => setIsDialogOpen(false)} className="text-muted-foreground hover:text-foreground transition-colors">×</button>
                        </div>
                        <div className="p-5 space-y-5">
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-foreground">Date</label>
                                <Input
                                    type="date"
                                    value={newSession.date}
                                    onChange={(e) => setNewSession({ ...newSession, date: e.target.value })}
                                    className="border-border bg-background text-foreground"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-foreground">Time</label>
                                <Input
                                    type="time"
                                    value={newSession.time}
                                    onChange={(e) => setNewSession({ ...newSession, time: e.target.value })}
                                    className="border-border bg-background text-foreground"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-foreground">Location</label>
                                <Input
                                    value={newSession.location}
                                    onChange={(e) => setNewSession({ ...newSession, location: e.target.value })}
                                    placeholder="Enter location"
                                    className="border-border bg-background text-foreground"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-foreground">Squad</label>
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
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-foreground">Coaching Objective</label>
                                <Input
                                    value={newSession.topic}
                                    onChange={(e) => setNewSession({ ...newSession, topic: e.target.value })}
                                    placeholder="e.g. Possession, Pressing, Match Prep"
                                    className="border-border bg-background text-foreground"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3 pb-2 border-b border-dashed border-border">
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-foreground">Availability Lock</label>
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
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-foreground">Custom Lock Time</label>
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
                                <div className="space-y-3 pt-2">
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
                        <div className="p-5 border-t border-border bg-surface-1 flex justify-end gap-3">
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
                                <div className="grid grid-cols-3 gap-2">
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
        </div>
    );
}
