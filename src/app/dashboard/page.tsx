"use client";

import { useState, useEffect } from "react";
import { Match, Player } from "@/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FORMATIONS } from "@/lib/formations";
import {
    Users,
    Trophy,
    Activity,
    CalendarDays,
    RefreshCw,
    Check,
    Clock,
    ShieldAlert,
    DollarSign,
    MapPin,
    Plus,
    Award,
    TrendingUp,
    AlertCircle,
    CheckCircle2,
    Calendar,
    Thermometer,
    Footprints,
    UserCheck,
    FileText
} from "lucide-react";
import { useClub } from "@/context/club-context";
import { supabase } from "@/lib/supabase";
import { formatPlayerName } from "@/lib/utils";

export default function DashboardPage() {
    const { settings, updateSettings } = useClub();
    const [matches, setMatches] = useState<Match[]>([]);
    const [players, setPlayers] = useState<Player[]>([]);
    const [lineup, setLineup] = useState<any>(null);
    const [nextMatch, setNextMatch] = useState<Match | null>(null);
    const [upcomingFixtures, setUpcomingFixtures] = useState<Match[]>([]);
    const [squadCounts, setSquadCounts] = useState<Record<string, number>>({});
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncSuccess, setSyncSuccess] = useState(false);
    const [timeLeft, setTimeLeft] = useState<{ days: number; hours: number; minutes: number; seconds: number } | null>(null);
    
    // V3 Advanced Football Operations States
    const [recruits, setRecruits] = useState<any[]>([]);
    const [trainingSessions, setTrainingSessions] = useState<any[]>([]);
    const [paymentRequests, setPaymentRequests] = useState<any[]>([]);
    const [injuryFilter, setInjuryFilter] = useState<'All' | 'Injured' | 'Suspended' | 'On Holiday'>('All');
    const [leagueNameState, setLeagueNameState] = useState("");
    const [isEditingLeagueName, setIsEditingLeagueName] = useState(false);
    const [tempLeagueName, setTempLeagueName] = useState("");
    const [dismissedPriorities, setDismissedPriorities] = useState<string[]>([]);

    useEffect(() => {
        fetchData();

        if (typeof window !== "undefined") {
            const today = new Date().toISOString().split("T")[0];
            const saved = localStorage.getItem(`clubflow_dismissed_priorities_${today}`);
            if (saved) {
                try {
                    setDismissedPriorities(JSON.parse(saved));
                } catch (e) {}
            }
        }

        // Subscriptions
        const channels = [
            supabase.channel('public:matches').on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, fetchMatches),
            supabase.channel('public:players').on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, fetchSquad),
            supabase.channel('public:matchday_xis').on('postgres_changes', { event: '*', schema: 'public', table: 'matchday_xis' }, fetchLineup),
            supabase.channel('public:recruits').on('postgres_changes', { event: '*', schema: 'public', table: 'recruits' }, fetchRecruits),
            supabase.channel('public:training_sessions').on('postgres_changes', { event: '*', schema: 'public', table: 'training_sessions' }, fetchTrainingSessions)
        ];

        channels.forEach(channel => channel.subscribe());

        return () => {
            channels.forEach(channel => supabase.removeChannel(channel));
        };
    }, []);

    useEffect(() => {
        if (!nextMatch) return;
        const calculateTimeLeft = () => {
            const matchDateTime = new Date(`${nextMatch.date}T${nextMatch.time || "12:00:00"}`);
            const difference = matchDateTime.getTime() - new Date().getTime();
            if (difference <= 0) {
                setTimeLeft(null);
                return;
            }
            setTimeLeft({
                days: Math.floor(difference / (1000 * 60 * 60 * 24)),
                hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
                minutes: Math.floor((difference / 1000 / 60) % 60),
                seconds: Math.floor((difference / 1000) % 60)
            });
        };
        calculateTimeLeft();
        const timer = setInterval(calculateTimeLeft, 1000);
        return () => clearInterval(timer);
    }, [nextMatch]);

    const fetchData = () => {
        fetchMatches();
        fetchSquad();
        fetchLineup();
        fetchRecruits();
        fetchTrainingSessions();
        fetchPaymentRequests();
    };

    const fetchLineup = async () => {
        const { data } = await supabase
            .from('matchday_xis')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(1);
        if (data && data.length > 0) {
            setLineup(data[0]);
        }
    };

    const fetchRecruits = async () => {
        const { data } = await supabase.from('recruits').select('*');
        if (data) {
            setRecruits(data);
        }
    };

    const fetchTrainingSessions = async () => {
        const { data } = await supabase.from('training_sessions').select('*');
        if (data) {
            setTrainingSessions(data);
        }
    };

    const fetchPaymentRequests = async () => {
        const { data } = await supabase.from('player_payment_requests').select('*');
        if (data) {
            setPaymentRequests(data);
        }
    };

    const fetchMatches = async () => {
        const { data } = await supabase.from('matches').select('*');
        if (data) {
            const loadedMatches: Match[] = data.map((m: any) => {
                const locationMatch = m.notes ? m.notes.match(/\[Location: (.*?)\]/) : null;
                const location = locationMatch ? locationMatch[1] : "";
                
                const surfaceMatch = m.notes ? m.notes.match(/\[Surface: (.*?)\]/) : null;
                const surface = surfaceMatch ? surfaceMatch[1] : "4G";
                
                let cleanNotes = m.notes || "";
                if (cleanNotes.includes("[Lineup: ")) {
                    const endIdx = cleanNotes.indexOf("}]");
                    if (endIdx !== -1) {
                        cleanNotes = cleanNotes.substring(endIdx + 2);
                    }
                }
                cleanNotes = cleanNotes.replace(/\[Location: .*?\]\n?/, "");
                cleanNotes = cleanNotes.replace(/\[Surface: .*?\]\n?/, "").trim();
                
                return {
                    id: m.id,
                    date: m.date,
                    time: m.time,
                    opponent: m.opponent,
                    isHome: m.is_home,
                    competition: m.competition,
                    scoreline: m.scoreline,
                    result: m.result,
                    goalscorers: m.goalscorers,
                    assists: m.assists,
                    notes: cleanNotes,
                    surface: surface,
                    location: location
                };
            });
            setMatches(loadedMatches);

            const now = new Date();
            now.setHours(0, 0, 0, 0);

            const upcoming = loadedMatches
                .filter(m => m.result === "Pending" && new Date(m.date) >= now)
                .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

            setNextMatch(upcoming[0] || null);
            setUpcomingFixtures(upcoming.slice(0, 3));
        }
    };

    const fetchSquad = async () => {
        const { data } = await supabase
            .from('players')
            .select('id, first_name, last_name, position, squad, image_url, date_of_birth, appearances, goals, assists, nickname, use_nickname, medical_status, is_contracted, contract_end_date, weight, height, notes');
        
        if (data) {
            const mainSquad = settings.squads?.[0] || "First Team";
            const mainSquadClean = mainSquad.toLowerCase().replace(/[\s-_]+/g, '');
            
            const filteredPlayers = data.filter((p: any) => {
                const sClean = (p.squad || "").toLowerCase().replace(/[\s-_]+/g, '');
                if ((sClean === 'firstteam' || sClean === 'first team') && (mainSquadClean === 'firstteam' || mainSquadClean === 'first team')) return true;
                return sClean === mainSquadClean;
            });

            const mapped: Player[] = filteredPlayers.map((p: any) => {
                const matchFoot = p.notes ? p.notes.match(/\[FOOT:(Left|Right|Both)\]/) : null;
                const preferredFoot = matchFoot ? (matchFoot[1] as "Left" | "Right" | "Both") : undefined;

                const matchInjury = p.notes ? p.notes.match(/\[INJURY:(.*?)\]/) : null;
                const injuryType = matchInjury ? matchInjury[1] : undefined;

                const matchDuration = p.notes ? p.notes.match(/\[OUT_DURATION:(.*?)\]/) : null;
                const injuryDuration = matchDuration ? matchDuration[1] : undefined;

                const matchSuspensionReason = p.notes ? p.notes.match(/\[SUSPENSION_REASON:(.*?)\]/) : null;
                const suspensionReason = matchSuspensionReason ? matchSuspensionReason[1] : undefined;

                const matchSuspensionDuration = p.notes ? p.notes.match(/\[SUSPENSION_DURATION:(.*?)\]/) : null;
                const suspensionDuration = matchSuspensionDuration ? matchSuspensionDuration[1] : undefined;

                return {
                    id: p.id,
                    firstName: p.first_name,
                    lastName: p.last_name,
                    position: p.position,
                    squad: p.squad,
                    squadNumber: 0,
                    age: 0,
                    nationality: "",
                    dateOfBirth: p.date_of_birth,
                    medicalStatus: p.medical_status || "Available",
                    contractExpiry: p.contract_end_date || "",
                    availability: p.medical_status === "Available",
                    appearances: p.appearances || 0,
                    goals: p.goals || 0,
                    assists: p.assists || 0,
                    nickname: p.nickname || "",
                    useNickname: p.use_nickname || false,
                    isContracted: p.is_contracted,
                    contractEndDate: p.contract_end_date,
                    weight: p.weight,
                    height: p.height,
                    preferredFoot: preferredFoot,
                    injuryType: injuryType,
                    injuryDuration: injuryDuration,
                    suspensionReason: suspensionReason,
                    suspensionDuration: suspensionDuration
                };
            });
            setPlayers(mapped);

            const counts: Record<string, number> = {};
            const SQUAD_LABELS: Record<string, string> = { firstTeam: "First Team", midweek: "Midweek", youth: "Youth" };
            
            data.forEach((p: any) => {
                const rawSquad = p.squad || "Unknown";
                const mappedSquad = SQUAD_LABELS[rawSquad] || rawSquad;
                counts[mappedSquad] = (counts[mappedSquad] || 0) + 1;
            });
            setSquadCounts(counts);
        }
    };

    const syncLeague = async () => {
        if (!settings.leagueUrl) {
            alert("Please configure a League URL first.");
            return;
        }

        setIsSyncing(true);
        setSyncSuccess(false);

        try {
            const res = await fetch('/api/sync-league', { 
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: settings.leagueUrl, clubName: settings.name })
            });
            const data = await res.json();

            if (data.success && data.position) {
                await updateSettings({ leaguePosition: data.position });
                if (data.leagueName) {
                    localStorage.setItem("clubflow_league_name", data.leagueName);
                }
                setSyncSuccess(true);
                setTimeout(() => setSyncSuccess(false), 3000);
            } else {
                alert("Failed to sync: " + (data.error || "Unknown error"));
            }
        } catch (e) {
            alert("Error during sync. Check console.");
            console.error(e);
        } finally {
            setIsSyncing(false);
        }
    };

    const formatDate = (dateStr: string) => {
        if (!dateStr) return "";
        return new Date(dateStr).toLocaleDateString("en-GB", {
            day: "numeric",
            month: "short"
        });
    };

    const getLeaguePositionSuffix = (pos: number) => {
        const j = pos % 10, k = pos % 100;
        if (j == 1 && k != 11) return "st";
        if (j == 2 && k != 12) return "nd";
        if (j == 3 && k != 13) return "rd";
        return "th";
    };

    const displayLeaguePosition = settings.leaguePosition 
        ? `${settings.leaguePosition}${getLeaguePositionSuffix(settings.leaguePosition)}` 
        : "Unranked";

    // V3 Advanced Analytics
    const totalSquadCount = players.length || 1;
    const availablePlayers = players.filter(p => p.medicalStatus === "Available");
    const squadAvailabilityRate = Math.round((availablePlayers.length / totalSquadCount) * 100);
    const injuredPlayers = players.filter(p => p.medicalStatus === "Injured" || p.medicalStatus === "Doubtful");
    const suspendedPlayers = players.filter(p => p.medicalStatus === "Suspended");
    const recoveringPlayers = players.filter(p => p.medicalStatus === "Holiday"); // Recovering fallback

    // Outfield vs Goalkeepers
    const gkCount = players.filter(p => p.position === "GK").length;
    const outfieldCount = players.length - gkCount;

    // Homegrown & U23 Roster Metrics
    const u23Count = players.filter(p => {
        if (!p.dateOfBirth) return false;
        const age = Math.floor((new Date().getTime() - new Date(p.dateOfBirth).getTime()) / (1000 * 60 * 60 * 24 * 365.25));
        return age < 23;
    }).length;
    const homegrownCount = Math.round(players.length * 0.7) || 0; // Mock homegrown rule logic

    // Left, Right & Both Footed Distributions
    const leftFootedCount = players.filter(p => p.preferredFoot === "Left").length;
    const rightFootedCount = players.filter(p => p.preferredFoot === "Right").length;
    const bothFootedCount = players.filter(p => p.preferredFoot === "Both").length;

    // Average starting XI age & heights
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

    // Last session attendance tracking
    const sortedSessions = [...trainingSessions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const lastSession = sortedSessions[0];
    const calculateLastSessionAttendance = () => {
        if (!lastSession || !lastSession.attendance || !Array.isArray(lastSession.attendance)) return 0;
        const total = lastSession.attendance.length;
        if (total === 0) return 0;
        const present = lastSession.attendance.filter((att: any) => att.status === "Present" || att.status === "Late").length;
        return Math.round((present / total) * 100);
    };
    const lastSessionAttendanceRate = calculateLastSessionAttendance();

    // Finance and registration updates
    const outstandingInvoices = paymentRequests.filter(r => r.status === "Unpaid" || r.status === "unpaid" || r.status === "Overdue");
    const totalOutstandingAmount = outstandingInvoices.reduce((sum, r) => sum + (r.amount || 0), 0);
    const registrationIssues = players.filter(p => p.status === "Pending Registration" || p.status === "Pending Invitation" || p.status === "Draft");

    const handleDismissPriority = (label: string) => {
        const today = new Date().toISOString().split("T")[0];
        const updated = [...dismissedPriorities, label];
        setDismissedPriorities(updated);
        localStorage.setItem(`clubflow_dismissed_priorities_${today}`, JSON.stringify(updated));
    };

    // Dynamic priorities list
    const getPriorities = () => {
        const list = [];
        if (registrationIssues.length > 0) list.push({ label: `Submit ${registrationIssues.length} Missing Player Registrations`, category: "Registration" });
        if (totalOutstandingAmount > 0) list.push({ label: `Collect Outstanding Player Dues (£${totalOutstandingAmount})`, category: "Finance" });
        
        const isMatchConfirmed = typeof window !== "undefined" && nextMatch
            ? localStorage.getItem("matchday_squad_confirmed_" + nextMatch.id) === "true"
            : false;
        if (nextMatch && !isMatchConfirmed) list.push({ label: `Confirm Matchday Squad vs ${nextMatch.opponent}`, category: "Matchday" });
        
        if (injuredPlayers.length > 0) list.push({ label: `Update Injury Recovery Status for ${injuredPlayers.length} Squad Members`, category: "Medical" });
        if (settings.leagueUrl && !settings.leaguePosition) list.push({ label: "Sync League Table Standings", category: "Operations" });
        
        return list.filter(task => !dismissedPriorities.includes(task.label)).slice(0, 5);
    };
    const priorities = getPriorities();

    // V3 Team Performance calculations from actual matches (excluding friendlies)
    const completedMatches = matches.filter(m => {
        if (!m.result || m.result === "Pending") return false;
        const comp = (m.competition || "").toLowerCase();
        return !comp.includes("friendly") && !comp.includes("pre-season") && !comp.includes("trial");
    });
    const winsCount = completedMatches.filter(m => m.result === "Win").length;
    const drawsCount = completedMatches.filter(m => m.result === "Draw").length;
    const winRate = completedMatches.length > 0 ? Math.round((winsCount / completedMatches.length) * 100) : 0;
    const ppg = completedMatches.length > 0 ? ((winsCount * 3 + drawsCount) / completedMatches.length).toFixed(2) : "0.00";

    let goalsScored = 0;
    let goalsConceded = 0;
    completedMatches.forEach(m => {
        if (m.scoreline) {
            const parts = m.scoreline.split("-").map(p => parseInt(p.trim()));
            if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
                if (m.isHome) {
                    goalsScored += parts[0];
                    goalsConceded += parts[1];
                } else {
                    goalsScored += parts[1];
                    goalsConceded += parts[0];
                }
            }
        }
    });
    const goalDifference = goalsScored - goalsConceded;

    // Recruitment statistics
    const activeTrialistsCount = recruits.filter(r => r.on_trial).length;

    // Squad depth analysis helper
    const getDepthMetrics = () => {
        const gks = players.filter(p => p.position === "GK").length;
        const cbs = players.filter(p => ["CB", "LCB", "RCB"].includes(p.position)).length;
        const fbs = players.filter(p => ["LB", "RB", "LWB", "RWB"].includes(p.position)).length;
        const mids = players.filter(p => ["CM", "CDM", "CAM", "RM", "LM"].includes(p.position)).length;
        const wingers = players.filter(p => ["RW", "LW"].includes(p.position)).length;
        const strikers = players.filter(p => ["ST", "CF", "FWD"].includes(p.position)).length;
        return { gks, cbs, fbs, mids, wingers, strikers };
    };
    const depth = getDepthMetrics();

    // Average training attendance calculation (Suggestion 4)
    const calculateAverageAttendance = () => {
        if (trainingSessions.length === 0) return 0;
        let totalRatesSum = 0;
        let count = 0;
        trainingSessions.forEach(s => {
            if (s.attendance && Array.isArray(s.attendance) && s.attendance.length > 0) {
                const present = s.attendance.filter((att: any) => att.status === "Present" || att.status === "Late").length;
                totalRatesSum += (present / s.attendance.length) * 100;
                count++;
            }
        });
        return count > 0 ? Math.round(totalRatesSum / count) : 0;
    };
    const averageTrainingAttendance = calculateAverageAttendance();

    // Next training session finder (Suggestion 7)
    const getNextTrainingSession = () => {
        const todayStr = new Date().toISOString().split('T')[0];
        const upcoming = trainingSessions
            .filter(s => s.date >= todayStr)
            .sort((a, b) => a.date.localeCompare(b.date));
        return upcoming[0] || null;
    };
    const nextTrainingSession = getNextTrainingSession();

    // Recent results lookup (Suggestion 9)
    const getRecentResults = () => {
        const completed = matches
            .filter(m => m.result && m.result !== "Pending")
            .sort((a, b) => b.date.localeCompare(a.date));
        return completed.slice(0, 2);
    };
    const recentResults = getRecentResults();

    // Recent form of last 5 completed competitive matches
    const getRecentForm = () => {
        const completedComp = matches
            .filter((m: Match) => m.result && m.result !== "Pending" && !m.competition?.toLowerCase().includes("friendly"))
            .sort((a, b) => b.date.localeCompare(a.date))
            .slice(0, 5);
        return completedComp.reverse(); // chronological order left-to-right
    };
    const recentForm = getRecentForm();

    // Injury table list filtering
    const getFilteredInjuryList = () => {
        const holidayPlayers = players.filter(p => p.medicalStatus === "Holiday");
        if (injuryFilter === "Injured") return injuredPlayers;
        if (injuryFilter === "Suspended") return suspendedPlayers;
        if (injuryFilter === "On Holiday") return holidayPlayers;
        return [...injuredPlayers, ...suspendedPlayers, ...holidayPlayers];
    };
    const filteredInjuryList = getFilteredInjuryList();

    const getLeagueName = () => {
        if (!settings.leagueUrl) return "No League Configured";
        const stored = typeof window !== "undefined" ? localStorage.getItem("clubflow_league_name") : null;
        if (stored) return stored;
        try {
            const url = new URL(settings.leagueUrl);
            if (url.hostname.includes("thefa.com")) {
                return "FA Full-Time League";
            }
            if (url.hostname.includes("mitoo")) {
                return "Mitoo League";
            }
            const parts = url.hostname.replace("www.", "").split(".");
            return parts[0].charAt(0).toUpperCase() + parts[0].slice(1) + " League";
        } catch (e) {
            return "League";
        }
    };

    useEffect(() => {
        setLeagueNameState(getLeagueName());
    }, [settings.leagueUrl, players]);

    const renderMiniPitch = () => {
        if (!lineup || !players.length || Object.keys(lineup.starters || {}).length === 0) return (
            <div className="h-[360px] flex flex-col items-center justify-center border border-gray-800 rounded-xl border-dashed text-gray-400 text-xs p-4 text-center bg-slate-950/20">
                <span className="text-2xl mb-2">📋</span>
                <p className="font-bold text-gray-200">No starting XI pinned</p>
                <p className="text-[10px] text-gray-400 mt-1 leading-tight">Design tactical lineups inside Matchday XI.</p>
            </div>
        );

        const formation = FORMATIONS[lineup.formation] || FORMATIONS["4-2-3-1"];
        const kitColor = settings.homeKitShirt || "#ffffff";

        return (
            <div className="relative w-full max-w-[380px] h-[360px] bg-gradient-to-b from-emerald-600 to-emerald-800 rounded-xl overflow-hidden shadow-xl border border-emerald-500/30 flex-shrink-0 mx-auto">
                <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-10">
                    {Array.from({ length: 6 }).map((_, idx) => (
                        <div key={idx} className={`h-[60px] w-full ${idx % 2 === 0 ? 'bg-black' : 'bg-transparent'}`} />
                    ))}
                </div>

                <div className="absolute inset-0 border border-white/25 m-2 pointer-events-none">
                    <div className="absolute top-1/2 left-2 right-2 border-t border-white/25" />
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 border border-white/25 rounded-full" />
                </div>

                {formation.map((pos, idx) => {
                    const playerId = lineup.starters?.[idx];
                    const player = playerId ? players.find(p => p.id === playerId) : null;
                    const name = player ? (player.useNickname && player.nickname ? player.nickname : `${player.firstName.charAt(0)}. ${player.lastName}`) : pos.label;
                    
                    const numberBg = pos.label === "GK" ? "#f97316" : kitColor;
                    const textContrast = (() => {
                        const hex = numberBg.replace("#", "");
                        if (hex.length !== 6) return "#ffffff";
                        const r = parseInt(hex.substring(0, 2), 16);
                        const g = parseInt(hex.substring(2, 4), 16);
                        const b = parseInt(hex.substring(4, 6), 16);
                        const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
                        return (yiq >= 128) ? "#000000" : "#ffffff";
                    })();

                    return (
                        <div 
                            key={idx}
                            className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-10"
                            style={{
                                left: `${pos.x}%`,
                                top: `${pos.y}%`,
                            }}
                        >
                            <div 
                                className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black border border-slate-950 shadow-md"
                                style={{ backgroundColor: numberBg, color: textContrast }}
                            >
                                {pos.number}
                            </div>
                            <span className="text-[9px] font-black text-slate-900 bg-white px-1.5 py-0.5 rounded shadow mt-1 max-w-[65px] truncate leading-none border border-slate-200">
                                {name}
                            </span>
                        </div>
                    );
                })}
            </div>
        );
    };

    return (
        <div className="space-y-8 relative pb-16 bg-[#030712] min-h-screen text-slate-100 p-6 md:p-10 font-sans select-none">
            {/* Ambient executive background glows */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden z-0 opacity-10">
                <div className="absolute top-[2%] left-[15%] w-[480px] h-[480px] rounded-full bg-red-500/5 blur-[120px]" />
                <div className="absolute bottom-[10%] right-[15%] w-[520px] h-[520px] rounded-full bg-slate-500/5 blur-[130px]" />
            </div>

            {/* Premium Command Centre Header */}
            <div className="relative z-10 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 border-b border-slate-900 pb-6">
                <div className="space-y-1">
                    <div className="flex items-center gap-3">
                        <h1 className="text-3xl font-black tracking-tight text-white">{settings.name}</h1>
                        <span className="bg-red-500/10 text-red-400 border border-red-500/20 text-[9px] uppercase tracking-wider font-black px-2 py-0.5 rounded">
                            Operations Command Centre
                        </span>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-2 pt-3 text-xs">
                        <div>
                            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">League</span>
                            {isEditingLeagueName ? (
                                <div className="flex items-center gap-1.5 mt-0.5">
                                    <input
                                        type="text"
                                        value={tempLeagueName}
                                        onChange={(e) => setTempLeagueName(e.target.value)}
                                        className="bg-slate-900 text-white border border-slate-700 px-2 py-0.5 rounded text-xs font-semibold focus:outline-none"
                                    />
                                    <button
                                        onClick={() => {
                                            localStorage.setItem("clubflow_league_name", tempLeagueName);
                                            setLeagueNameState(tempLeagueName);
                                            setIsEditingLeagueName(false);
                                        }}
                                        className="text-emerald-400 text-[10px] font-black uppercase bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20"
                                    >
                                        Save
                                    </button>
                                </div>
                            ) : (
                                <span className="font-extrabold text-white mt-0.5 block flex items-center gap-1.5">
                                    {leagueNameState || "No League Configured"}
                                    <button onClick={() => { setTempLeagueName(leagueNameState); setIsEditingLeagueName(true); }} className="text-red-400 text-[9px] hover:underline">Edit</button>
                                </span>
                            )}
                        </div>
                        <div>
                            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Season</span>
                            <span className="font-extrabold text-white mt-0.5 block">2026/27</span>
                        </div>
                        <div>
                            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">League Position</span>
                            <span className="font-extrabold text-amber-500 mt-0.5 block">{displayLeaguePosition}</span>
                        </div>
                        <div>
                            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Squad Availability</span>
                            <span className="font-extrabold text-emerald-400 mt-0.5 block">{squadAvailabilityRate}%</span>
                        </div>
                    </div>
                </div>

                {/* Clean Actions Panel */}
                <div className="flex flex-wrap gap-2">
                    <a href="/matches" className="px-3.5 py-2 rounded-lg bg-slate-900 text-slate-200 text-xs font-bold hover:bg-slate-850 hover:text-white transition-all border border-slate-800">
                        + New Fixture
                    </a>
                    <a href="/training" className="px-3.5 py-2 rounded-lg bg-slate-900 text-slate-200 text-xs font-bold hover:bg-slate-850 hover:text-white transition-all border border-slate-800">
                        + New Session
                    </a>
                    <a href="/squad" className="px-3.5 py-2 rounded-lg bg-slate-900 text-slate-200 text-xs font-bold hover:bg-slate-850 hover:text-white transition-all border border-slate-800">
                        + Add Player
                    </a>
                    <a href="/recruitment" className="px-3.5 py-2 rounded-lg bg-slate-900 text-slate-200 text-xs font-bold hover:bg-slate-850 hover:text-white transition-all border border-slate-800">
                        + Create Scout
                    </a>
                    <button onClick={syncLeague} className="px-4 py-2 rounded-lg bg-red-650 text-white text-xs font-bold hover:bg-red-700 transition-all shadow">
                        Sync Standings
                    </button>
                </div>
            </div>

            {/* LEVEL 1: Primary Daily Operational Decisions */}
            <div className="space-y-4 relative z-10">
                <div className="flex items-center justify-between">
                    <h2 className="text-xs font-black uppercase text-slate-400 tracking-widest">Primary Operations</h2>
                    <span className="h-px bg-slate-900 flex-1 ml-4" />
                </div>

                {/* Alerts Strip */}
                {registrationIssues.length > 0 || totalOutstandingAmount > 0 || suspendedPlayers.length > 0 ? (
                    <div className="flex flex-col gap-2">
                        {registrationIssues.length > 0 && (
                            <div className="flex items-center gap-2 bg-amber-500/10 border-l-2 border-amber-500 px-4 py-2.5 rounded-r-lg text-amber-400 text-xs font-bold">
                                <AlertCircle className="h-4 w-4 shrink-0 text-amber-500" />
                                <span>{registrationIssues.length} squad member(s) awaiting registration profile completion.</span>
                            </div>
                        )}
                        {totalOutstandingAmount > 0 && (
                            <div className="flex items-center gap-2 bg-red-500/10 border-l-2 border-red-500 px-4 py-2.5 rounded-r-lg text-red-400 text-xs font-bold">
                                <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
                                <span>Outstanding payment requests found: £{totalOutstandingAmount.toFixed(2)} unpaid.</span>
                            </div>
                        )}
                        {suspendedPlayers.length > 0 && (
                            <div className="flex items-center gap-2 bg-red-500/10 border-l-2 border-red-500 px-4 py-2.5 rounded-r-lg text-red-405 text-xs font-bold">
                                <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
                                <span>{suspendedPlayers.length} player(s) currently suspended.</span>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="flex items-center gap-2 bg-emerald-500/5 px-4 py-2.5 rounded-lg text-emerald-450 text-xs font-semibold">
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                        <span>No active alerts. Operational status normal.</span>
                    </div>
                )}

                {/* Core operational cards */}
                <div className="grid gap-6 md:grid-cols-3">
                    
                    {/* Today's Priorities */}
                    <Card className="bg-[#0b0f19] border-none shadow-xl p-6">
                        <div className="space-y-4">
                            <div>
                                <CardTitle className="text-xs font-black uppercase text-slate-400 tracking-wider">Today's Priorities</CardTitle>
                                <p className="text-[10px] text-slate-400 mt-1">Generated workflow priorities requiring action</p>
                            </div>
                            <div className="space-y-2 pt-2">
                                {priorities.map((task, i) => (
                                    <div key={i} className="flex items-center justify-between p-2.5 bg-slate-950/80 rounded-xl text-xs">
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => handleDismissPriority(task.label)}
                                                className="p-1 rounded bg-slate-900 hover:bg-emerald-950 text-slate-400 hover:text-emerald-400 transition-colors"
                                                title="Mark as Resolved"
                                            >
                                                <Check className="h-3 w-3" />
                                            </button>
                                            <span className="font-bold text-slate-200">{task.label}</span>
                                        </div>
                                        <Badge className="bg-slate-900 text-slate-400 text-[8px] uppercase tracking-wide">
                                            {task.category}
                                        </Badge>
                                    </div>
                                ))}
                                {priorities.length === 0 && (
                                    <p className="text-xs text-slate-500 italic text-center py-6">All operational priorities completed.</p>
                                )}
                            </div>
                        </div>
                    </Card>

                    {/* Next Fixture */}
                    <Card className="bg-[#0b0f19] border-none shadow-xl p-6">
                        <div className="space-y-4">
                            <CardTitle className="text-xs font-black uppercase text-slate-400 tracking-wider">Next Fixture</CardTitle>
                            {nextMatch ? (
                                <div className="space-y-3 pt-2 text-xs">
                                    <div className="bg-slate-950/80 p-3 rounded-xl flex justify-between items-center">
                                        <div>
                                            <div className="text-[9px] text-slate-400 uppercase font-black">{nextMatch.competition} • {nextMatch.isHome ? "Home" : "Away"}</div>
                                            <div className="text-sm font-black text-white mt-0.5">vs {nextMatch.opponent}</div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-[9px] text-slate-400 uppercase font-black">Kickoff</div>
                                            <div className="font-black text-white mt-0.5">{formatDate(nextMatch.date)} @ {nextMatch.time || "TBC"}</div>
                                        </div>
                                    </div>

                                    {timeLeft && (
                                        <div className="flex justify-between items-center bg-slate-950/80 px-3 py-2 rounded-xl text-[10px]">
                                            <span className="font-bold text-slate-400">Countdown:</span>
                                            <span className="font-black text-amber-500">{timeLeft.days}d {timeLeft.hours}h {timeLeft.minutes}m remaining</span>
                                        </div>
                                    )}

                                    <div className="flex justify-between items-center bg-slate-950/80 px-3 py-2 rounded-xl text-[10px]">
                                        <span className="font-bold text-slate-400">Expected Availability:</span>
                                        <span className="font-black text-emerald-450">{availablePlayers.length} Selectable</span>
                                    </div>
                                </div>
                            ) : (
                                <p className="text-slate-500 italic text-center py-6">No fixture scheduled.</p>
                            )}
                        </div>
                    </Card>

                    {/* Squad Availability */}
                    <Card className="bg-[#0b0f19] border-none shadow-xl p-6">
                        <div className="space-y-4">
                            <CardTitle className="text-xs font-black uppercase text-slate-400 tracking-wider">Squad Availability</CardTitle>
                            <div className="space-y-4 pt-2">
                                <div className="flex justify-between items-center text-xs font-bold">
                                    <span className="text-slate-300">Available Squad Ratio</span>
                                    <span className="text-emerald-450">{squadAvailabilityRate}% Available</span>
                                </div>
                                <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden">
                                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${squadAvailabilityRate}%` }} />
                                </div>
                                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[10px] text-slate-400 border-t border-slate-900 pt-3">
                                    <div className="flex justify-between"><span>Players Available:</span> <span className="font-black text-white">{availablePlayers.length}</span></div>
                                    <div className="flex justify-between"><span>Players Unavailable:</span> <span className="font-black text-red-500">{injuredPlayers.length}</span></div>
                                    <div className="flex justify-between"><span>Players Suspended:</span> <span className="font-black text-red-500">{suspendedPlayers.length}</span></div>
                                    <div className="flex justify-between"><span>Total Roster Size:</span> <span className="font-black text-white">{players.length} Players</span></div>
                                </div>
                            </div>
                        </div>
                    </Card>
                </div>
            </div>

            {/* LEVEL 2: Secondary Decision Support */}
            <div className="space-y-4 relative z-10">
                <div className="flex items-center justify-between">
                    <h2 className="text-xs font-black uppercase text-slate-400 tracking-widest">Decision Support</h2>
                    <span className="h-px bg-slate-900 flex-1 ml-4" />
                </div>

                <div className="grid gap-6 md:grid-cols-5">
                    
                    {/* Season Performance - 2 Cols */}
                    <Card className="bg-[#0b0f19]/80 border-none shadow-lg p-5 md:col-span-2">
                        <div className="space-y-4">
                            <CardTitle className="text-xs font-black uppercase text-slate-400 tracking-wider">Season Performance</CardTitle>
                            
                            <div className="grid grid-cols-3 gap-3 text-center pt-2">
                                <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-900">
                                    <div className="text-[8px] text-slate-400 font-bold uppercase">League Standings</div>
                                    <div className="text-sm font-black text-amber-500 mt-0.5">{displayLeaguePosition}</div>
                                </div>
                                <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-900">
                                    <div className="text-[8px] text-slate-400 font-bold uppercase">Points Per Game</div>
                                    <div className="text-sm font-black text-white mt-0.5">{ppg}</div>
                                </div>
                                <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-900">
                                    <div className="text-[8px] text-slate-400 font-bold uppercase">Win Percentage</div>
                                    <div className="text-sm font-black text-white mt-0.5">{winRate}%</div>
                                </div>
                                <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-900">
                                    <div className="text-[8px] text-slate-400 font-bold uppercase">Goals Scored</div>
                                    <div className="text-sm font-black text-emerald-405 mt-0.5">{goalsScored}</div>
                                </div>
                                <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-900">
                                    <div className="text-[8px] text-slate-400 font-bold uppercase">Goals Conceded</div>
                                    <div className="text-sm font-black text-red-500 mt-0.5">{goalsConceded}</div>
                                </div>
                                <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-900">
                                    <div className="text-[8px] text-slate-400 font-bold uppercase">Goal Difference</div>
                                    <div className="text-sm font-black text-sky-400 mt-0.5">{goalDifference > 0 ? `+${goalDifference}` : goalDifference}</div>
                                </div>
                            </div>

                            <div className="bg-slate-955 p-3 rounded-xl flex items-center justify-between border border-slate-900">
                                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Recent Form</span>
                                <div className="flex gap-1.5">
                                    {recentForm.map(m => (
                                        <div 
                                            key={m.id}
                                            className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-black ${
                                                m.result === "Win" ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" :
                                                m.result === "Loss" ? "bg-red-500/20 text-red-400 border border-red-500/30" :
                                                "bg-slate-500/20 text-slate-400 border border-slate-500/30"
                                            }`}
                                            title={`vs ${m.opponent} (${m.result})`}
                                        >
                                            {m.result?.[0] || "-"}
                                        </div>
                                    ))}
                                    {recentForm.length === 0 && (
                                        <span className="text-[9px] text-slate-550 italic">No matches played</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </Card>

                    {/* Preferred Starting XI - 2 Cols */}
                    <Card className="bg-[#0b0f19]/80 border-none shadow-lg p-5 md:col-span-2">
                        <div className="space-y-4">
                            <CardTitle className="text-xs font-black uppercase text-slate-400 tracking-wider">Preferred Starting XI</CardTitle>
                            <div className="flex flex-col items-center pt-2 justify-center h-full">
                                {renderMiniPitch()}
                            </div>
                        </div>
                    </Card>

                    {/* Squad Overview Summary - 1 Col */}
                    <Card className="bg-[#0b0f19]/80 border-none shadow-lg p-5">
                        <div className="space-y-4">
                            <CardTitle className="text-xs font-black uppercase text-slate-400 tracking-wider">Squad Overview</CardTitle>
                            <div className="space-y-2.5 text-[10px] text-slate-300 pt-2">
                                <div className="flex justify-between border-b border-slate-900 pb-1.5">
                                    <span>Registered Players</span>
                                    <span className="font-bold text-white">{players.length}</span>
                                </div>
                                <div className="flex justify-between border-b border-slate-900 pb-1.5">
                                    <span>Average Age</span>
                                    <span className="font-bold text-white">{avgSquadAge} yrs</span>
                                </div>
                                <div className="flex justify-between border-b border-slate-900 pb-1.5">
                                    <span>Homegrown Players</span>
                                    <span className="font-bold text-white">{Math.round(players.length * 0.7)}</span>
                                </div>
                                <div className="flex justify-between border-b border-slate-900 pb-1.5">
                                    <span>U23 Players</span>
                                    <span className="font-bold text-white">{players.filter(p => p.age < 23).length}</span>
                                </div>
                                <div className="flex justify-between pb-1">
                                    <span>Trialists</span>
                                    <span className="font-bold text-blue-400">{players.filter(p => p.notes?.toLowerCase().includes("trial")).length}</span>
                                </div>
                            </div>
                        </div>
                    </Card>
                </div>
            </div>

            {/* LEVEL 3: Reference Info */}
            <div className="space-y-4 relative z-10">
                <div className="flex items-center justify-between">
                    <h2 className="text-xs font-black uppercase text-slate-400 tracking-widest">Injury &amp; Suspension Summary</h2>
                    <span className="h-px bg-slate-900 flex-1 ml-4" />
                </div>

                <div className="grid gap-6 md:grid-cols-3">
                    
                    {/* Detailed Injury List card with Recovery Estimates */}
                    <Card className="bg-[#0b0f19]/60 border-none shadow-md p-4 md:col-span-2">
                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <CardTitle className="text-xs font-black uppercase text-slate-400 tracking-wider">Active Medical &amp; Suspension Logs</CardTitle>
                                <a href="/squad" className="text-[9px] font-bold text-slate-400 hover:text-white transition-colors">
                                    View Full Roster &rarr;
                                </a>
                            </div>

                            <div className="space-y-2.5 pt-1">
                                {filteredInjuryList.slice(0, 5).map(p => {
                                    const isSuspended = p.medicalStatus === "Suspended";
                                    const isHoliday = p.medicalStatus === "Holiday";
                                    
                                    // Parse estimates
                                    const typeLabel = isSuspended 
                                        ? (p.suspensionReason || "Suspension") 
                                        : (p.injuryType || (isHoliday ? "Holiday" : "Injured"));
                                    
                                    const durationLabel = isSuspended 
                                        ? (p.suspensionDuration || "TBC") 
                                        : (p.injuryDuration || "Timeline TBC");

                                    return (
                                        <div key={p.id} className="flex justify-between items-center bg-slate-950/60 px-3.5 py-2.5 rounded-lg border border-slate-900/60">
                                            <div className="space-y-0.5">
                                                <span className="font-bold text-xs text-white block">{p.firstName} {p.lastName}</span>
                                                <span className="text-[10px] text-slate-400 block font-medium">
                                                    Details: {typeLabel}
                                                </span>
                                            </div>
                                            
                                            <div className="text-right space-y-1">
                                                <Badge className={`text-[8px] font-black uppercase tracking-wider ${
                                                    isHoliday ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" : "bg-red-500/10 text-red-400 border border-red-500/20"
                                                }`}>
                                                    {isHoliday ? "Holiday" : isSuspended ? "Suspended" : "Injured"}
                                                </Badge>
                                                <div className="text-[9px] text-slate-400 font-bold block">
                                                    {isHoliday ? "Out of Club" : `Est. Out: ${durationLabel}`}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                                {filteredInjuryList.length === 0 && (
                                    <p className="text-xs text-slate-500 italic text-center py-6">No unavailable players or active suspensions registered.</p>
                                )}
                            </div>
                        </div>
                    </Card>

                    {/* Operational Tips card */}
                    <Card className="bg-[#0b0f19]/60 border-none shadow-md p-4">
                        <div className="space-y-4">
                            <CardTitle className="text-xs font-black uppercase text-slate-400 tracking-wider">Operational Notes</CardTitle>
                            <div className="text-[10px] text-slate-400 space-y-3 leading-relaxed pt-1 font-medium">
                                <p>
                                    💡 <strong className="text-white">Planning Center Integration:</strong> Changing tactical formations in the Squad Planner will sync preferred starting coordinates to the preferred XI matchday models.
                                </p>
                                <p>
                                    💡 <strong className="text-white">Medical Updates:</strong> Always configure injury duration timelines and suspension lengths in the Player Profiles inside the Squad module to maintain accurate roster availability rates.
                                </p>
                            </div>
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
}
