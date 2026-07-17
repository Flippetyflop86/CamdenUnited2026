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

    useEffect(() => {
        fetchData();

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
                cleanNotes = cleanNotes.replace(/\[Location: .*?\]\n?/, "");
                cleanNotes = cleanNotes.replace(/\[Surface: .*?\]\n?/, "");
                cleanNotes = cleanNotes.replace(/\[Lineup: \{.*\}\]\n?/, "").trim();
                
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
                    injuryDuration: injuryDuration
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
        return list.slice(0, 5);
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
            <div className="relative w-full max-w-[380px] h-[360px] bg-emerald-950/90 rounded-xl overflow-hidden shadow-lg border border-emerald-900/60 flex-shrink-0 mx-auto">
                <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-5">
                    {Array.from({ length: 6 }).map((_, idx) => (
                        <div key={idx} className={`h-[60px] w-full ${idx % 2 === 0 ? 'bg-black' : 'bg-transparent'}`} />
                    ))}
                </div>

                <div className="absolute inset-0 border border-white/10 m-2 pointer-events-none">
                    <div className="absolute top-1/2 left-2 right-2 border-t border-white/10" />
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 border border-white/10 rounded-full" />
                </div>

                {formation.map((pos, idx) => {
                    const playerId = lineup.starters?.[idx];
                    const player = playerId ? players.find(p => p.id === playerId) : null;
                    const name = player ? (player.useNickname && player.nickname ? player.nickname : `${player.firstName.charAt(0)}. ${player.lastName}`) : pos.label;
                    
                    return (
                        <div 
                            key={idx}
                            className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center"
                            style={{
                                left: `${pos.x}%`,
                                top: `${pos.y}%`,
                            }}
                        >
                            <div 
                                className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-black text-white border border-black/50 shadow-md"
                                style={{ backgroundColor: pos.label === "GK" ? "#ea580c" : kitColor }}
                            >
                                {pos.number}
                            </div>
                            <span className="text-[8px] font-extrabold text-white bg-slate-950/90 px-1.5 py-0.5 rounded shadow mt-0.5 max-w-[55px] truncate leading-none border border-slate-800">
                                {name}
                            </span>
                        </div>
                    );
                })}
            </div>
        );
    };

    return (
        <div className="space-y-6 relative pb-12 bg-[#030712] min-h-screen text-gray-100 p-6 md:p-8">
            {/* Ambient background glows */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden z-0 opacity-20">
                <div className="absolute top-[5%] left-[10%] w-[380px] h-[380px] rounded-full bg-red-500/10 blur-[80px]" />
                <div className="absolute bottom-[20%] right-[10%] w-[420px] h-[420px] rounded-full bg-red-600/5 blur-[90px]" />
            </div>

            {/* Club Operations Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-gray-800/80 pb-5 relative z-10">
                <div>
                    <div className="flex items-center gap-2">
                        <h2 className="text-2xl font-black tracking-tight text-white">{settings.name}</h2>
                        <Badge className="bg-red-500/10 hover:bg-red-500/15 text-red-400 border border-red-500/20 text-[9px] uppercase tracking-wider font-extrabold px-2 py-0.5">
                            Football Operations Command Centre
                        </Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-300 mt-1.5 font-medium">
                        <span className="flex items-center gap-1">
                            League:{" "}
                            {isEditingLeagueName ? (
                                <span className="flex items-center gap-1.5">
                                    <input
                                        type="text"
                                        value={tempLeagueName}
                                        onChange={(e) => setTempLeagueName(e.target.value)}
                                        className="bg-slate-900 text-white border border-gray-700 px-2 py-0.5 rounded text-xs w-48 font-semibold focus:outline-none focus:border-red-500"
                                        placeholder="Enter league name..."
                                        autoFocus
                                    />
                                    <button
                                        onClick={() => {
                                            localStorage.setItem("clubflow_league_name", tempLeagueName);
                                            setLeagueNameState(tempLeagueName);
                                            setIsEditingLeagueName(false);
                                        }}
                                        className="text-emerald-400 hover:text-emerald-300 text-[10px] font-bold uppercase bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20"
                                    >
                                        Save
                                    </button>
                                    <button
                                        onClick={() => setIsEditingLeagueName(false)}
                                        className="text-gray-400 hover:text-white text-[10px] font-bold uppercase bg-slate-800 px-1.5 py-0.5 rounded"
                                    >
                                        Cancel
                                    </button>
                                </span>
                            ) : (
                                <span className="flex items-center gap-1">
                                    <span className="text-white font-bold">{leagueNameState || "No League Configured"}</span>
                                    <button
                                        onClick={() => {
                                            setTempLeagueName(leagueNameState);
                                            setIsEditingLeagueName(true);
                                        }}
                                        className="text-red-450 hover:text-red-400 text-[9px] uppercase tracking-wider font-extrabold ml-1 hover:underline bg-red-500/10 px-1 py-0.5 rounded border border-red-500/20"
                                    >
                                        Edit
                                    </button>
                                </span>
                            )}
                        </span>
                        <span>•</span>
                        <span>Season: <span className="text-white">2026/27</span></span>
                        <span>•</span>
                        <span>Standings: <span className="text-amber-500 font-bold">{displayLeaguePosition}</span></span>
                        <span>•</span>
                        <span>Squad Availability: <span className="text-emerald-400 font-bold">{squadAvailabilityRate}%</span></span>
                    </div>
                </div>

                {/* Operations Toolbar */}
                <div className="flex flex-wrap gap-2">
                    <a href="/matches" className="px-3 py-1.5 rounded-lg border border-gray-850 bg-slate-950 text-gray-200 text-xs font-bold hover:border-gray-700 hover:text-white transition-all">
                        + New Fixture
                    </a>
                    <a href="/training" className="px-3 py-1.5 rounded-lg border border-gray-855 bg-slate-950 text-gray-200 text-xs font-bold hover:border-gray-700 hover:text-white transition-all">
                        + New Session
                    </a>
                    <a href="/squad" className="px-3 py-1.5 rounded-lg border border-gray-855 bg-slate-955 text-gray-200 text-xs font-bold hover:border-gray-700 hover:text-white transition-all">
                        + Add Player
                    </a>
                    <a href="/recruitment" className="px-3 py-1.5 rounded-lg border border-gray-855 bg-slate-955 text-gray-200 text-xs font-bold hover:border-gray-700 hover:text-white transition-all">
                        + Create Scout Report
                    </a>
                    <button onClick={syncLeague} className="px-3 py-1.5 rounded-lg bg-red-650 text-white text-xs font-bold hover:bg-red-700 transition-all shadow-md">
                        Sync Standings
                    </button>
                </div>
            </div>

            {/* V3 High Priority Operational Alerts Banner */}
            <div className="grid gap-4 md:grid-cols-2 relative z-10">
                {/* Football Department Alerts (Registration / Compliance Issues) */}
                <Card className="bg-[#0b0f19] border-gray-800/80 shadow-md">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-bold uppercase tracking-wider text-gray-300 flex items-center gap-1.5">
                            <ShieldAlert className="h-4 w-4 text-red-500" />
                            Football Department Alerts
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        {registrationIssues.length > 0 || totalOutstandingAmount > 0 ? (
                            <div className="space-y-1.5 text-xs text-gray-200">
                                {registrationIssues.length > 0 && (
                                    <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1.5 rounded-lg text-amber-450">
                                        <AlertCircle className="h-4 w-4 shrink-0" />
                                        <span>{registrationIssues.length} squad member(s) awaiting registration profile completion.</span>
                                    </div>
                                )}
                                {totalOutstandingAmount > 0 && (
                                    <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 px-2.5 py-1.5 rounded-lg text-red-400 font-bold">
                                        <AlertCircle className="h-4 w-4 shrink-0" />
                                        <span>Outstanding payment requests found: £{totalOutstandingAmount.toFixed(2)} unpaid.</span>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <p className="text-xs text-gray-400 italic">No football department alerts.</p>
                        )}
                    </CardContent>
                </Card>

                {/* Squad Availability Analytics Card */}
                <Card className="bg-[#0b0f19] border-gray-800/80 shadow-md">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-bold uppercase tracking-wider text-gray-300">Squad Availability</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="flex justify-between items-center text-xs font-bold">
                            <span className="text-gray-200">Available Squad Ratio</span>
                            <span className="text-emerald-400">{squadAvailabilityRate}% Available</span>
                        </div>
                        <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${squadAvailabilityRate}%` }} />
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[10px] text-gray-300">
                            <div className="flex justify-between"><span>Players Available:</span> <span className="font-semibold text-white">{availablePlayers.length}</span></div>
                            <div className="flex justify-between"><span>Players Unavailable:</span> <span className="font-semibold text-red-400">{injuredPlayers.length}</span></div>
                            <div className="flex justify-between"><span>Players Suspended:</span> <span className="font-semibold text-red-400">{suspendedPlayers.length}</span></div>
                            <div className="flex justify-between"><span>Upcoming Trainings:</span> <span className="font-semibold text-white">2 remaining</span></div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Priorities & Next Fixture Layout Row */}
            <div className="grid gap-6 lg:grid-cols-7 relative z-10">
                {/* Left Side: Priorities & Next Match (4 spans) */}
                <div className="lg:col-span-4 space-y-6">
                    {/* Today's Priorities list */}
                    <Card className="bg-[#0b0f19] border-gray-800/80 shadow-md">
                        <CardHeader className="pb-3 border-b border-gray-800/80">
                            <CardTitle className="text-sm font-bold text-white uppercase tracking-wider">Today's Priorities</CardTitle>
                            <CardDescription className="text-xs text-gray-300">Generated workflow priorities requiring action</CardDescription>
                        </CardHeader>
                        <CardContent className="pt-4">
                            <div className="space-y-2">
                                {priorities.map((task, i) => (
                                    <div key={i} className="flex items-center justify-between p-2.5 bg-slate-950 border border-gray-800 rounded-xl text-xs">
                                        <span className="font-semibold text-gray-100">{task.label}</span>
                                        <Badge className="bg-red-500/10 text-red-400 border border-red-500/20 text-[8px] uppercase tracking-wide">
                                            {task.category}
                                        </Badge>
                                    </div>
                                ))}
                                {priorities.length === 0 && (
                                    <p className="text-xs text-gray-400 italic text-center py-4">All operations priorities completed.</p>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Next Fixture Details */}
                    <Card className="bg-[#0b0f19] border-gray-800/80 shadow-md">
                        <CardHeader className="pb-3 border-b border-gray-800/80">
                            <CardTitle className="text-sm font-bold text-white uppercase tracking-wider">Fixture Details</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-4 space-y-4">
                            {nextMatch ? (
                                <div className="space-y-3 text-xs">
                                    <div className="bg-slate-950 p-3 rounded-xl border border-gray-800 flex justify-between items-center">
                                        <div>
                                            <div className="text-[10px] text-gray-350 uppercase font-bold">Opponent</div>
                                            <div className="text-base font-black text-white mt-0.5">{nextMatch.opponent}</div>
                                            <div className="text-[9px] text-gray-300 mt-1 flex items-center gap-1.5">
                                                <span className="text-white font-bold">{nextMatch.competition}</span>
                                                <span>•</span>
                                                <span>{nextMatch.isHome ? "🏠 Home Venue" : "🚌 Away Venue"}</span>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-[10px] text-gray-350 uppercase font-bold">Date &amp; Kickoff</div>
                                            <div className="font-black text-white mt-0.5">{formatDate(nextMatch.date)} • {nextMatch.time || "TBC"}</div>
                                            {nextMatch.location && <div className="text-[9px] text-gray-300 mt-1 max-w-[140px] truncate">{nextMatch.location}</div>}
                                        </div>
                                    </div>

                                    {timeLeft && (
                                        <div className="bg-red-500/5 border border-red-500/10 rounded-xl p-3 flex justify-between items-center">
                                            <span className="font-bold text-gray-200">Days to Kickoff:</span>
                                            <div className="flex gap-2 text-white font-black">
                                                <div className="bg-slate-950 px-2.5 py-1 rounded-lg border border-gray-800">{timeLeft.days}d</div>
                                                <div className="bg-slate-950 px-2.5 py-1 rounded-lg border border-gray-800">{timeLeft.hours}h</div>
                                                <div className="bg-slate-950 px-2.5 py-1 rounded-lg border border-gray-800">{timeLeft.minutes}m</div>
                                            </div>
                                        </div>
                                    )}

                                    <div className="grid grid-cols-2 gap-3 text-[10px] text-gray-300 bg-slate-950 p-3 rounded-xl border border-gray-800">
                                        <div className="flex justify-between"><span>Pitch surface:</span> <span className="font-bold text-white">{nextMatch.surface || "4G"}</span></div>
                                        <div className="flex justify-between"><span>Expected Squad Size:</span> <span className="font-bold text-white">{availablePlayers.length} Selectable</span></div>
                                        <div className="flex justify-between"><span>Formations Analyzed:</span> <span className="font-bold text-white">4-2-3-1</span></div>
                                        <div className="flex justify-between"><span>Lead Physio Reports:</span> <span className="font-bold text-emerald-400">Fit</span></div>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-6 text-gray-400">
                                    <p className="mb-3">No fixture currently scheduled.</p>
                                    <a href="/matches" className="px-3 py-1.5 rounded-lg bg-red-650 text-white font-bold hover:bg-red-755 transition-all text-xs">
                                        Schedule Fixture
                                    </a>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Right Side: Squad Health & Season Performance (3 spans) */}
                <div className="lg:col-span-3 space-y-6">
                    {/* Squad Health overview */}
                    <Card className="bg-[#0b0f19] border-gray-800/80 shadow-md">
                        <CardHeader className="pb-3 border-b border-gray-800/80">
                            <CardTitle className="text-sm font-bold text-white uppercase tracking-wider">Squad Health</CardTitle>
                            <CardDescription className="text-xs text-gray-300">Operational demographic summaries</CardDescription>
                        </CardHeader>
                        <CardContent className="pt-4 text-xs space-y-2">
                            <div className="flex justify-between items-center bg-slate-950 p-2.5 rounded-xl border border-gray-800">
                                <span className="text-gray-300 font-bold">Registered Players</span>
                                <span className="font-black text-white">{players.length}</span>
                            </div>
                            <div className="flex justify-between items-center bg-slate-950 p-2.5 rounded-xl border border-gray-800">
                                <span className="text-gray-300 font-bold">Average Squad Age</span>
                                <span className="font-black text-white">{avgSquadAge} years</span>
                            </div>
                            <div className="flex justify-between items-center bg-slate-950 p-2.5 rounded-xl border border-gray-800">
                                <span className="text-gray-300 font-bold">Homegrown Squad Members</span>
                                <span className="font-black text-white">{homegrownCount}</span>
                            </div>
                            <div className="flex justify-between items-center bg-slate-950 p-2.5 rounded-xl border border-gray-800">
                                <span className="text-gray-300 font-bold">U23 Players</span>
                                <span className="font-black text-white">{u23Count}</span>
                            </div>
                            <div className="flex justify-between items-center bg-slate-950 p-2.5 rounded-xl border border-gray-800">
                                <span className="text-gray-300 font-bold">Footedness Breakdown</span>
                                <span className="font-black text-white">
                                    {leftFootedCount === 0 && rightFootedCount === 0 && bothFootedCount === 0
                                        ? "Unspecified" 
                                        : `Left ${leftFootedCount} • Right ${rightFootedCount} • Both ${bothFootedCount}`}
                                </span>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Season Performance */}
                    <Card className="bg-[#0b0f19] border-gray-800/80 shadow-md">
                        <CardHeader className="pb-3 border-b border-gray-800/80">
                            <CardTitle className="text-sm font-bold text-white uppercase tracking-wider">Season Performance</CardTitle>
                            <CardDescription className="text-xs text-gray-300">KPI summaries</CardDescription>
                        </CardHeader>
                        <CardContent className="pt-4 text-xs space-y-3">
                            <div className="grid grid-cols-2 gap-3 text-center">
                                <div className="bg-slate-955 p-2.5 rounded-xl border border-gray-800">
                                    <div className="text-[10px] text-gray-300 font-bold uppercase">Points Per Game</div>
                                    <div className="text-base font-black text-white mt-0.5">{ppg}</div>
                                </div>
                                <div className="bg-slate-955 p-2.5 rounded-xl border border-gray-800">
                                    <div className="text-[10px] text-gray-300 font-bold uppercase">Win Percentage</div>
                                    <div className="text-base font-black text-white mt-0.5">{winRate}%</div>
                                </div>
                            </div>

                            <div className="bg-slate-955 p-2.5 rounded-xl border border-gray-800 space-y-2">
                                <div className="flex justify-between text-gray-300 font-bold">
                                    <span>Goals Scored / Conceded</span>
                                    <span className="text-white font-black">{goalsScored} / {goalsConceded} (GD: {goalDifference})</span>
                                </div>
                            </div>

                            <div className="bg-slate-955 p-2.5 rounded-xl border border-gray-800 flex justify-between items-center">
                                <div>
                                    <span className="text-[10px] text-gray-200 uppercase font-bold">Training Attendance Tracking</span>
                                    <div className="text-sm font-black text-white mt-0.5">{lastSessionAttendanceRate}%</div>
                                    <p className="text-[8px] text-gray-400 mt-1 leading-none">
                                        {lastSession ? `Last session: ${formatDate(lastSession.date)} ${lastSession.topic ? `• ${lastSession.topic}` : ''}` : 'No sessions logged'}
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* V3 Advanced Injury & Suspension medical dashboard */}
            <Card className="bg-[#0b0f19] border-gray-800/80 shadow-md relative z-10">
                <CardHeader className="pb-3 border-b border-gray-800/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <CardTitle className="text-sm font-bold text-white uppercase tracking-wider">Injury &amp; Suspension Log</CardTitle>
                        <CardDescription className="text-xs text-gray-300">Squad health and physical therapy recovery parameters</CardDescription>
                    </div>
                    {/* Log Filter Header */}
                    <div className="flex flex-wrap bg-slate-950 p-0.5 rounded-lg border border-gray-800">
                        {(['All', 'Injured', 'Suspended', 'On Holiday'] as const).map(tab => (
                            <button
                                key={tab}
                                onClick={() => setInjuryFilter(tab)}
                                className={`px-2.5 py-1 text-[10px] font-extrabold rounded transition-all ${injuryFilter === tab ? 'bg-slate-800 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>
                </CardHeader>
                <CardContent className="pt-4 max-h-[300px] overflow-y-auto">
                    <div className="space-y-2">
                        {filteredInjuryList.length === 0 ? (
                            <p className="text-xs text-gray-405 italic text-center py-4">No records found matching filter criteria.</p>
                        ) : (
                            filteredInjuryList.map(p => (
                                <div key={p.id} className="flex justify-between items-center text-xs bg-slate-955 p-2.5 rounded-xl border border-gray-800/85">
                                    <div>
                                        <span className="font-semibold text-white">{formatPlayerName(p)}</span>
                                        <span className="text-[10px] text-gray-300 ml-2">({p.position})</span>
                                        <p className="text-[9px] text-gray-400 mt-1">
                                            {p.medicalStatus === "Suspended" ? "Disciplinary Suspension" : 
                                             p.medicalStatus === "Holiday" ? "Away on Holiday" :
                                             p.injuryType ? `Injury: ${p.injuryType} ${p.injuryDuration ? `• Est. Return: ${p.injuryDuration}` : ""}` : 
                                             "Injured - notes pending"}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <Badge className={`text-[8px] uppercase tracking-wide ${
                                            p.medicalStatus === "Holiday" ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" :
                                            p.medicalStatus === "Suspended" ? "bg-red-500/10 text-red-400 border border-red-500/20" :
                                            "bg-red-650/10 text-red-400 border border-red-650/20"
                                        }`}>
                                            {p.medicalStatus === "Holiday" ? "Holiday" : p.medicalStatus}
                                        </Badge>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Squad Depth Overview & Recruitment Row */}
            <div className="grid gap-6 md:grid-cols-2 relative z-10">
                {/* Squad Depth Analysis */}
                <Card className="bg-[#0b0f19] border-gray-800/80 shadow-md">
                    <CardHeader className="pb-3 border-b border-gray-800/80">
                        <CardTitle className="text-sm font-bold text-white uppercase tracking-wider">Squad Depth Overview</CardTitle>
                        <CardDescription className="text-xs text-gray-300">Position coverage review</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-4 text-xs space-y-3">
                        <div className="flex justify-between items-center bg-slate-955 p-2.5 rounded-xl border border-gray-800">
                            <span className="text-gray-200">Goalkeepers ({depth.gks})</span>
                            <Badge className={`text-[8px] uppercase ${depth.gks < 2 ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}`}>
                                {depth.gks < 2 ? 'Needs Reinforcement' : 'Strong'}
                            </Badge>
                        </div>
                        <div className="flex justify-between items-center bg-slate-955 p-2.5 rounded-xl border border-gray-800">
                            <span className="text-gray-200">Centre Backs ({depth.cbs})</span>
                            <Badge className={`text-[8px] uppercase ${depth.cbs < 3 ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}`}>
                                {depth.cbs < 3 ? 'Monitor' : 'Strong'}
                            </Badge>
                        </div>
                        <div className="flex justify-between items-center bg-slate-955 p-2.5 rounded-xl border border-gray-800">
                            <span className="text-gray-200">Full Backs ({depth.fbs})</span>
                            <Badge className={`text-[8px] uppercase ${depth.fbs < 2 ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}`}>
                                {depth.fbs < 2 ? 'Needs Reinforcement' : 'Strong'}
                            </Badge>
                        </div>
                        <div className="flex justify-between items-center bg-slate-955 p-2.5 rounded-xl border border-gray-800">
                            <span className="text-gray-200">Midfielders ({depth.mids})</span>
                            <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[8px] uppercase">Strong</Badge>
                        </div>
                        <div className="flex justify-between items-center bg-slate-955 p-2.5 rounded-xl border border-gray-800">
                            <span className="text-gray-200">Wingers ({depth.wingers})</span>
                            <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[8px] uppercase">Strong</Badge>
                        </div>
                        <div className="flex justify-between items-center bg-slate-955 p-2.5 rounded-xl border border-gray-800">
                            <span className="text-gray-200">Forwards ({depth.strikers})</span>
                            <Badge className={`text-[8px] uppercase ${depth.strikers < 2 ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}`}>
                                {depth.strikers < 2 ? 'Monitor' : 'Strong'}
                            </Badge>
                        </div>
                    </CardContent>
                </Card>

                {/* Recruitment Pipeline */}
                <Card className="bg-[#0b0f19] border-gray-800/80 shadow-md">
                    <CardHeader className="pb-3 border-b border-gray-800/80">
                        <CardTitle className="text-sm font-bold text-white uppercase tracking-wider">Recruitment Pipeline</CardTitle>
                        <CardDescription className="text-xs text-gray-300">Squad acquisition pipeline progress indicators</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-4 text-xs space-y-3.5">
                        <div className="space-y-1">
                            <div className="flex justify-between text-gray-200 font-bold">
                                <span>Applications Awaiting Review</span>
                                <span>3</span>
                            </div>
                            <div className="h-1.5 w-full bg-slate-950 rounded-full overflow-hidden">
                                <div className="h-full bg-red-500 rounded-full" style={{ width: '45%' }} />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <div className="flex justify-between text-gray-200 font-bold">
                                <span>Active Trialists</span>
                                <span>{activeTrialistsCount}</span>
                            </div>
                            <div className="h-1.5 w-full bg-slate-950 rounded-full overflow-hidden">
                                <div className="h-full bg-blue-500 rounded-full" style={{ width: `${(activeTrialistsCount / 6) * 100}%` }} />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <div className="flex justify-between text-gray-200 font-bold">
                                <span>Shortlisted Recruits</span>
                                <span>{recruits.length}</span>
                            </div>
                            <div className="h-1.5 w-full bg-slate-950 rounded-full overflow-hidden">
                                <div className="h-full bg-yellow-500 rounded-full" style={{ width: `${(recruits.length / 10) * 100}%` }} />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <div className="flex justify-between text-gray-200 font-bold">
                                <span>Contract Negotiations</span>
                                <span>2</span>
                            </div>
                            <div className="h-1.5 w-full bg-slate-950 rounded-full overflow-hidden">
                                <div className="h-full bg-emerald-500 rounded-full" style={{ width: '25%' }} />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Lineup & Contributors (Bottom Row) */}
            <div className="grid gap-6 md:grid-cols-5 relative z-10">
                {/* Starting Selection (3 spans) */}
                <Card className="bg-[#0b0f19] border-gray-800/80 shadow-md md:col-span-3">
                    <CardHeader className="pb-3 border-b border-gray-800/80">
                        <CardTitle className="text-sm font-bold text-white uppercase tracking-wider">Starting selection</CardTitle>
                        <CardDescription className="text-xs text-gray-300">Selection variables</CardDescription>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-center pt-4">
                        <div className="space-y-3.5 text-xs text-gray-200">
                            <div className="bg-slate-955 p-2.5 rounded-xl border border-gray-800 flex justify-between">
                                <span>Expected Formation</span>
                                <span className="font-bold text-white">{lineup?.formation || "4-2-3-1"}</span>
                            </div>
                            <div className="bg-slate-955 p-2.5 rounded-xl border border-gray-800 flex justify-between">
                                <span>Squad Average Age</span>
                                <span className="font-bold text-white">{avgSquadAge} yrs</span>
                            </div>
                        </div>
                        <div className="flex justify-center">
                            {renderMiniPitch()}
                        </div>
                    </CardContent>
                </Card>

                {/* Squad Contributors (2 spans) */}
                <Card className="bg-[#0b0f19] border-gray-800/80 shadow-md md:col-span-2">
                    <CardHeader className="pb-3 border-b border-gray-800/80">
                        <CardTitle className="text-sm font-bold text-white uppercase tracking-wider">Squad Contributors</CardTitle>
                        <CardDescription className="text-xs text-gray-300">Leading contributors</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-4 space-y-4">
                        <div>
                            <h4 className="text-[10px] font-bold text-gray-300 uppercase tracking-widest mb-2.5">⚽ Top Goalscorers</h4>
                            <div className="space-y-2">
                                {players
                                    .filter(p => p.goals > 0)
                                    .sort((a, b) => b.goals - a.goals)
                                    .slice(0, 2)
                                    .map((p, idx) => (
                                        <div key={p.id} className="flex justify-between text-xs bg-slate-955 p-2.5 rounded-xl border border-gray-800">
                                            <span className="text-gray-250 font-semibold">{idx + 1}. {formatPlayerName(p)}</span>
                                            <span className="font-black text-red-500">{p.goals} Goals</span>
                                        </div>
                                    ))}
                                {players.filter(p => p.goals > 0).length === 0 && (
                                    <p className="text-[10px] text-gray-400 italic">No goals registered.</p>
                                )}
                            </div>
                        </div>

                        <div className="border-t border-slate-900 pt-3">
                            <h4 className="text-[10px] font-bold text-gray-300 uppercase tracking-widest mb-2.5">🅰️ Assist Leaders</h4>
                            <div className="space-y-2">
                                {players
                                    .filter(p => p.assists > 0)
                                    .sort((a, b) => b.assists - a.assists)
                                    .slice(0, 2)
                                    .map((p, idx) => (
                                        <div key={p.id} className="flex justify-between text-xs bg-slate-955 p-2.5 rounded-xl border border-gray-800">
                                            <span className="text-gray-250 font-semibold">{idx + 1}. {formatPlayerName(p)}</span>
                                            <span className="font-black text-blue-500">{p.assists} Assists</span>
                                        </div>
                                    ))}
                                {players.filter(p => p.assists > 0).length === 0 && (
                                    <p className="text-[10px] text-gray-400 italic">No assists registered.</p>
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
