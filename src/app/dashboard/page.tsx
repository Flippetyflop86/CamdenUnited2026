"use client";
import { useState, useEffect } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { PageSection } from "@/components/layout/page-section";
import { SectionHeader } from "@/components/ui/section-header";
import { EmptyState } from "@/components/ui/empty-state";
import { MetricCard } from "@/components/ui/metric-card";
import { Button } from "@/components/ui/button";
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
import { WeeklyFootballCalendar } from "@/components/calendar/WeeklyFootballCalendar";
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
    const [leagueTeams, setLeagueTeams] = useState<any[]>([]);

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
        fetchLeagueTeams();
    };

    const fetchLeagueTeams = async () => {
        const { data } = await supabase.from('league_teams').select('*');
        if (data) {
            setLeagueTeams(data);
        }
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
        
        if (injuredPlayers.length > 0) list.push({ label: `Review recovery timeline for ${injuredPlayers.length} injured player(s)`, category: "Medical" });
        if (suspendedPlayers.length > 0) list.push({ label: `${suspendedPlayers.length} player(s) currently serving suspensions`, category: "Discipline" });
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
    const totalPlayed = completedMatches.length;
    const wins = winsCount;
    const draws = drawsCount;
    const losses = totalPlayed - wins - draws;
    const points = wins * 3 + draws;

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

    return (
        <div className="pb-16 bg-background min-h-screen">
            <PageHeader 
                title="Dashboard" 
                description="Operations Command Centre"
            >
                <a href="/matches" className="px-3.5 py-2 rounded-lg bg-secondary text-secondary-foreground text-xs font-bold hover:bg-accent transition-all border border-border">
                    + New Fixture
                </a>
                <a href="/training" className="px-3.5 py-2 rounded-lg bg-secondary text-secondary-foreground text-xs font-bold hover:bg-accent transition-all border border-border">
                    + New Session
                </a>
                <a href="/squad" className="px-3.5 py-2 rounded-lg bg-secondary text-secondary-foreground text-xs font-bold hover:bg-accent transition-all border border-border">
                    + Add Player
                </a>
                <button onClick={syncLeague} className="px-4 py-2 rounded-lg bg-brand text-brand-foreground text-xs font-bold hover:bg-brand/90 transition-all shadow">
                    Sync Standings
                </button>
            </PageHeader>

            {/* LEVEL 0: Football Week */}
            <PageSection>
                <WeeklyFootballCalendar />
            </PageSection>

            {/* LEVEL 1: The Next Event (Football First) */}
            <PageSection>
                <SectionHeader title="Next Match" className="border-l-4 border-brand pl-3 mb-4" />
                <div className="grid gap-4 md:grid-cols-3">
                    {/* Next Fixture (Primary) */}
                    <div className="md:col-span-2 bg-surface-2 border border-border/80 p-8 rounded-xl shadow-sm flex flex-col justify-between">
                        <div className="flex justify-between items-start mb-6">
                            <Badge className="bg-background text-muted-foreground border-border uppercase tracking-widest text-[10px] font-bold px-3 py-1">
                                {nextMatch?.competition || "Friendly"}
                            </Badge>
                            {nextMatch && timeLeft && (
                                <div className="text-xs font-medium text-muted-foreground bg-background px-3 py-1.5 rounded border border-border flex items-center gap-1.5">
                                    <Clock className="w-3.5 h-3.5" />
                                    {timeLeft.days > 0 ? `In ${timeLeft.days} days` : 'Today'}
                                </div>
                            )}
                        </div>
                        
                        <div className="mb-8">
                            <div className="text-sm font-semibold text-muted-foreground mb-1">
                                {nextMatch?.isHome ? "Home vs" : "Away vs"}
                            </div>
                            <div className="text-4xl md:text-5xl font-black text-foreground tracking-tight leading-none flex items-center gap-3">
                                {nextMatch ? (
                                    <>
                                        {leagueTeams.find(t => t.name.toLowerCase() === nextMatch.opponent.toLowerCase())?.badge_url && (
                                            <img src={leagueTeams.find(t => t.name.toLowerCase() === nextMatch.opponent.toLowerCase())?.badge_url} alt="Badge" className="h-10 w-10 md:h-12 md:w-12 object-contain" />
                                        )}
                                        {nextMatch.opponent}
                                    </>
                                ) : "TBC"}
                            </div>
                        </div>

                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-border/50 pt-5 mt-auto">
                            {nextMatch ? (
                                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
                                    <div className="flex items-center gap-2">
                                        <Calendar className="h-4 w-4" />
                                        <span className="font-medium text-foreground">{formatDate(nextMatch.date)}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Clock className="h-4 w-4" />
                                        <span className="font-medium text-foreground">{nextMatch.time || "TBC"}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <MapPin className="h-4 w-4" />
                                        <span className="font-medium text-foreground">{nextMatch.location || (nextMatch.isHome ? "Home" : "Away")}</span>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-sm text-muted-foreground">No upcoming fixtures scheduled.</div>
                            )}
                            
                            <a href="/matchday-xi" className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg bg-brand text-brand-foreground text-sm font-bold hover:bg-brand/90 transition-colors shadow">
                                Matchday Hub
                            </a>
                        </div>
                    </div>

                    {/* Next Training (Secondary) */}
                    <div className="bg-card border-border p-6 rounded-xl flex flex-col justify-between shadow-sm">
                        <div>
                            <div className="cf-label text-muted-foreground uppercase tracking-wider mb-2">Next Training</div>
                            <div className="text-xl font-bold text-foreground leading-tight">
                                {nextTrainingSession ? nextTrainingSession.focus || "Team Session" : "No Session Scheduled"}
                            </div>
                            
                            {nextTrainingSession && (
                                <div className="space-y-2 mt-4 text-sm text-muted-foreground">
                                    <div className="flex items-center gap-2">
                                        <Calendar className="h-4 w-4" />
                                        <span>{formatDate(nextTrainingSession.date)} - {nextTrainingSession.time || "TBC"}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <MapPin className="h-4 w-4" />
                                        <span>{nextTrainingSession.location || "Training Ground"}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                        
                        <div className="mt-6 pt-4 border-t border-border">
                            {nextTrainingSession ? (
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                                        <Users className="h-4 w-4 text-muted-foreground" />
                                        {nextTrainingSession.attendance?.filter((a: any) => a.status === 'Present' || a.status === 'Late').length || 0} Confirmed
                                    </div>
                                    <a href="/training" className="text-xs font-bold text-brand hover:underline">Manage</a>
                                </div>
                            ) : (
                                <a href="/training" className="text-xs font-bold text-muted-foreground hover:text-foreground">Schedule Session</a>
                            )}
                        </div>
                    </div>
                </div>
            </PageSection>

            {/* LEVEL 2: Action Required (Operational Strips) */}
            <PageSection>
                <SectionHeader title="Action Required" />
                
                {priorities.length > 0 || injuredPlayers.length > 0 || suspendedPlayers.length > 0 ? (
                    <div className="space-y-2">
                        {priorities.map((task, idx) => (
                            <div key={idx} className="flex items-center justify-between p-3.5 bg-status-warning/5 border border-status-warning/20 rounded-lg text-sm transition-colors hover:bg-status-warning/10 shadow-sm">
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={() => handleDismissPriority(task.label)}
                                        className="p-1.5 rounded-full bg-background hover:bg-status-success/20 text-muted-foreground hover:text-status-success transition-colors shadow-sm"
                                        title="Mark as Resolved"
                                    >
                                        <Check className="h-4 w-4" />
                                    </button>
                                    <span className="font-medium text-foreground">{task.label}</span>
                                </div>
                                <span className="text-[10px] font-bold uppercase tracking-widest text-status-warning px-2 py-1 bg-background rounded border border-border">Priority</span>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="bg-card border border-border rounded-lg p-6 flex flex-col items-center justify-center text-center shadow-sm">
                        <CheckCircle2 className="h-8 w-8 text-status-success mb-2 opacity-50" />
                        <h4 className="text-sm font-bold text-foreground">All clear</h4>
                        <p className="text-xs text-muted-foreground mt-1">No immediate operational tasks.</p>
                    </div>
                )}
            </PageSection>

            {/* LEVEL 3: Core Readiness & Club Status */}
            <PageSection>
                <SectionHeader title="Club Status" />
                <div className="grid gap-4 md:grid-cols-4">
                    {/* Anchor Metric */}
                    <div className="md:col-span-2 bg-surface-2 border border-border/80 p-6 rounded-xl shadow-sm flex flex-col justify-center relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-5">
                            <Trophy className="w-24 h-24" />
                        </div>
                        <div className="cf-label text-muted-foreground mb-2 uppercase tracking-wider relative z-10">League Position</div>
                        <div className="flex items-baseline gap-3 relative z-10">
                            <span className="text-5xl font-black text-foreground tracking-tight">{displayLeaguePosition}</span>
                            <span className="text-sm font-medium text-muted-foreground">{leagueNameState || "No League Configured"}</span>
                        </div>
                    </div>
                    
                    {/* Authentic Form Guide */}
                    <div className="bg-card border border-border p-6 rounded-xl shadow-sm flex flex-col justify-center">
                        <div className="cf-label text-muted-foreground mb-3 uppercase tracking-wider">Recent Form</div>
                        <div className="flex gap-1.5">
                            {recentForm.map(m => (
                                <div 
                                    key={m.id}
                                    className={`w-7 h-7 rounded flex items-center justify-center text-[11px] font-bold ${
                                        m.result === "Win" ? "bg-status-success text-status-success-foreground" :
                                        m.result === "Loss" ? "bg-status-error text-status-error-foreground" :
                                        "bg-muted text-muted-foreground"
                                    }`}
                                    title={`vs ${m.opponent} (${m.result})`}
                                >
                                    {m.result?.[0] || "-"}
                                </div>
                            ))}
                            {recentForm.length === 0 && (
                                <span className="text-sm text-muted-foreground italic">No matches played</span>
                            )}
                        </div>
                    </div>

                    {/* Operational Availability */}
                    <div className="bg-card border border-border p-6 rounded-xl shadow-sm flex flex-col justify-center">
                        <div className="cf-label text-muted-foreground mb-3 uppercase tracking-wider">Squad Status</div>
                        <div className="flex items-baseline gap-2">
                            <span className="text-3xl font-bold text-foreground">{availablePlayers.length}</span>
                            <span className="text-xs font-medium text-muted-foreground">/ {players.length} ready</span>
                        </div>
                    </div>
                </div>
            </PageSection>

            {/* LEVEL 4: Performance Statistics */}
            <PageSection>
                <SectionHeader title="Performance Overview" />
                <div className="grid gap-4 md:grid-cols-4">
                    <MetricCard 
                        title="Points"
                        value={points.toString()}
                        description={`${wins}W ${draws}D ${losses}L`}
                    />
                    <MetricCard 
                        title="Goal Difference"
                        value={goalDifference > 0 ? `+${goalDifference}` : goalDifference.toString()}
                        description={`${goalsScored} For, ${goalsConceded} Against`}
                    />
                    <MetricCard 
                        title="Win Rate"
                        value={`${winRate}%`}
                        trend={winRate > 50 ? { value: 5, direction: "up" } : undefined}
                    />
                    <MetricCard 
                        title="Goals Scored"
                        value={goalsScored.toString()}
                        description={`${(goalsScored / (wins + draws + losses || 1)).toFixed(1)} per game`}
                    />
                </div>
            </PageSection>

            {/* LEVEL 5: Everything Else (Department Summaries) */}
            <PageSection>
                <SectionHeader title="Department Summaries" />
                <div className="grid gap-4 md:grid-cols-2">
                    {/* Medical Department */}
                    <Card className="bg-card border-border shadow-sm">
                        <CardHeader className="pb-3 border-b border-border">
                            <CardTitle className="text-sm font-bold flex items-center gap-2">
                                <Thermometer className="h-4 w-4 text-muted-foreground" />
                                Medical Update
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-4">
                            <div className="space-y-3">
                                {injuredPlayers.length > 0 ? (
                                    injuredPlayers.map((player) => (
                                        <div key={player.id} className="flex justify-between items-center text-sm">
                                            <span className="font-medium text-foreground">{player.firstName} {player.lastName}</span>
                                            <span className="text-xs font-medium text-status-warning bg-status-warning/10 px-2 py-0.5 rounded">{player.medicalStatus}</span>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-sm text-muted-foreground text-center py-4">Squad is fully fit</div>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Squad Readiness */}
                    <Card className="bg-card border-border shadow-sm">
                        <CardHeader className="pb-3 border-b border-border">
                            <CardTitle className="text-sm font-bold flex items-center gap-2">
                                <Footprints className="h-4 w-4 text-muted-foreground" />
                                Physical Availability
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-4">
                            <div className="space-y-4">
                                <div>
                                    <div className="flex justify-between text-xs mb-1.5">
                                        <span className="text-muted-foreground font-medium">Match Fit</span>
                                        <span className="font-bold text-foreground">{availablePlayers.length}</span>
                                    </div>
                                    <div className="h-2 w-full bg-surface-2 rounded-full overflow-hidden">
                                        <div className="h-full bg-status-success rounded-full" style={{ width: `${(availablePlayers.length / (players.length || 1)) * 100}%` }}></div>
                                    </div>
                                </div>
                                <div>
                                    <div className="flex justify-between text-xs mb-1.5">
                                        <span className="text-muted-foreground font-medium">Injured / Unavailable</span>
                                        <span className="font-bold text-foreground">{injuredPlayers.length}</span>
                                    </div>
                                    <div className="h-2 w-full bg-surface-2 rounded-full overflow-hidden">
                                        <div className="h-full bg-status-error rounded-full" style={{ width: `${(injuredPlayers.length / (players.length || 1)) * 100}%` }}></div>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </PageSection>
        </div>
    );
}
