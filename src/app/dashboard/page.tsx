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
            {/* LEVEL 1: Club Overview (Hero) */}
            <div className="bg-card border-b border-border px-6 py-10 mb-8 shadow-sm">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row gap-8 justify-between items-start md:items-end">
                    <div className="space-y-4">
                        <div className="flex items-center gap-3">
                            {settings.logo && (
                                <img src={settings.logo} alt={settings.name} className="h-12 w-12 object-contain" />
                            )}
                            <div>
                                <h1 className="cf-page-title text-3xl">{settings.name || "Club Dashboard"}</h1>
                                <p className="text-sm font-medium text-muted-foreground mt-1">{leagueNameState} • {displayLeaguePosition}</p>
                            </div>
                        </div>
                        
                        <div className="flex flex-wrap items-center gap-6 mt-6 pt-4 border-t border-border">
                            {/* Recent Form */}
                            <div className="flex flex-col gap-1">
                                <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">Recent Form</span>
                                <div className="flex gap-1.5">
                                    {recentForm.map(m => (
                                        <div key={m.id} className={`w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold ${m.result === "Win" ? "bg-status-success text-white" : m.result === "Loss" ? "bg-status-error text-white" : "bg-muted text-muted-foreground"}`} title={`vs ${m.opponent} (${m.result})`}>
                                            {m.result?.[0] || "-"}
                                        </div>
                                    ))}
                                    {recentForm.length === 0 && <span className="text-sm text-muted-foreground">N/A</span>}
                                </div>
                            </div>

                            {/* Training Attendance */}
                            <div className="flex flex-col gap-1">
                                <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">Avg Attendance</span>
                                <span className="text-sm font-bold text-foreground">{averageTrainingAttendance}%</span>
                            </div>

                            {/* Next Fixture Quick Status */}
                            {nextMatch && (
                                <div className="flex flex-col gap-1">
                                    <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">Next Fixture</span>
                                    <span className="text-sm font-medium text-foreground">
                                        vs {nextMatch.opponent} ({nextMatch.isHome ? "H" : "A"})
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex flex-col gap-3">
                        {priorities.length > 0 && (
                            <div className="bg-status-warning/10 border border-status-warning/20 text-status-warning-foreground px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2">
                                <AlertCircle className="h-4 w-4 text-status-warning" />
                                {priorities.length} Action{priorities.length !== 1 && "s"} Required
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-6 space-y-12">
                {/* LEVEL 2: Quick Actions */}
                <div className="flex flex-wrap gap-3">
                    <a href="/matches" className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-all shadow-sm">
                        + New Fixture
                    </a>
                    <a href="/training" className="px-4 py-2 rounded-lg bg-secondary text-secondary-foreground text-sm font-medium hover:bg-accent transition-all border border-border shadow-sm">
                        + New Session
                    </a>
                    <a href="/squad" className="px-4 py-2 rounded-lg bg-secondary text-secondary-foreground text-sm font-medium hover:bg-accent transition-all border border-border shadow-sm">
                        + Add Player
                    </a>
                    <button onClick={syncLeague} className="px-4 py-2 rounded-lg bg-secondary text-secondary-foreground text-sm font-medium hover:bg-accent transition-all border border-border shadow-sm">
                        Sync Standings
                    </button>
                </div>

                {/* LEVEL 3: This Week (Timeline) */}
                <section>
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="cf-section-title">This Week</h2>
                        <a href="/calendar" className="text-sm font-medium text-primary hover:underline">Open Calendar &rarr;</a>
                    </div>
                    <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
                        <WeeklyFootballCalendar />
                    </div>
                </section>

                {/* LEVEL 4: Next Match & Next Training */}
                <section className="grid gap-6 md:grid-cols-2">
                    {/* Next Match */}
                    <div className="bg-card border border-border p-6 rounded-2xl shadow-sm flex flex-col justify-between">
                        <div>
                            <div className="flex justify-between items-start mb-6">
                                <h3 className="text-sm uppercase font-semibold text-muted-foreground tracking-wider">Next Match</h3>
                                <Badge className="bg-secondary text-secondary-foreground hover:bg-secondary font-medium px-2.5 py-0.5 rounded-md border-transparent">
                                    {nextMatch?.competition || "Friendly"}
                                </Badge>
                            </div>
                            
                            <div className="mb-8">
                                <div className="text-3xl md:text-4xl font-bold text-foreground tracking-tight flex items-center gap-3">
                                    {nextMatch ? (
                                        <>
                                            {leagueTeams.find(t => t.name.toLowerCase() === nextMatch.opponent.toLowerCase())?.badge_url && (
                                                <img src={leagueTeams.find(t => t.name.toLowerCase() === nextMatch.opponent.toLowerCase())?.badge_url} alt="Badge" className="h-8 w-8 object-contain" />
                                            )}
                                            {nextMatch.opponent}
                                        </>
                                    ) : "TBC"}
                                </div>
                                <div className="text-sm font-medium text-muted-foreground mt-2">
                                    {nextMatch?.isHome ? "Home" : "Away"}
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-5 border-t border-border mt-auto">
                            {nextMatch ? (
                                <div className="flex flex-wrap items-center gap-4 text-sm text-foreground">
                                    <div className="flex items-center gap-1.5 font-medium">
                                        <Calendar className="h-4 w-4 text-muted-foreground" />
                                        {formatDate(nextMatch.date)}
                                    </div>
                                    <div className="flex items-center gap-1.5 font-medium">
                                        <Clock className="h-4 w-4 text-muted-foreground" />
                                        {nextMatch.time || "TBC"}
                                    </div>
                                </div>
                            ) : (
                                <div className="text-sm text-muted-foreground">No upcoming fixtures.</div>
                            )}
                            
                            <a href="/matchday-xi" className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors shadow-sm">
                                Matchday Hub
                            </a>
                        </div>
                    </div>

                    {/* Next Training */}
                    <div className="bg-card border border-border p-6 rounded-2xl shadow-sm flex flex-col justify-between">
                        <div>
                            <div className="flex justify-between items-start mb-6">
                                <h3 className="text-sm uppercase font-semibold text-muted-foreground tracking-wider">Next Training</h3>
                            </div>
                            <div className="mb-8">
                                <div className="text-2xl font-bold text-foreground leading-tight">
                                    {nextTrainingSession ? nextTrainingSession.focus || "Team Session" : "No Session Scheduled"}
                                </div>
                                {nextTrainingSession && (
                                    <div className="space-y-2 mt-4 text-sm text-foreground font-medium">
                                        <div className="flex items-center gap-2">
                                            <Calendar className="h-4 w-4 text-muted-foreground" />
                                            <span>{formatDate(nextTrainingSession.date)} - {nextTrainingSession.time || "TBC"}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <MapPin className="h-4 w-4 text-muted-foreground" />
                                            <span>{nextTrainingSession.location || "Training Ground"}</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                        
                        <div className="pt-5 border-t border-border mt-auto">
                            {nextTrainingSession ? (
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                                        <Users className="h-4 w-4 text-muted-foreground" />
                                        {nextTrainingSession.attendance?.filter((a: any) => a.status === 'Present' || a.status === 'Late').length || 0} Confirmed
                                    </div>
                                    <a href="/training" className="text-sm font-medium text-primary hover:underline">Manage</a>
                                </div>
                            ) : (
                                <a href="/training" className="text-sm font-medium text-muted-foreground hover:text-foreground">Schedule Session</a>
                            )}
                        </div>
                    </div>
                </section>

                {/* LEVEL 5: Operational Alerts */}
                {priorities.length > 0 && (
                    <section>
                        <h2 className="cf-section-title mb-4">Operational Alerts</h2>
                        <div className="space-y-2">
                            {priorities.map((task, idx) => (
                                <div key={idx} className="flex items-center justify-between p-4 bg-card border border-border rounded-xl text-sm transition-colors hover:bg-accent shadow-sm">
                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={() => handleDismissPriority(task.label)}
                                            className="p-1.5 rounded-md bg-secondary hover:bg-status-success/10 text-muted-foreground hover:text-status-success transition-colors border border-border"
                                            title="Mark as Resolved"
                                        >
                                            <Check className="h-4 w-4" />
                                        </button>
                                        <span className="font-medium text-foreground">{task.label}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* LEVEL 6: League Snapshot */}
                <section>
                    <h2 className="cf-section-title mb-4">League Snapshot</h2>
                    <div className="bg-card border border-border p-6 rounded-2xl shadow-sm flex flex-col justify-center max-w-sm">
                        <div className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider mb-2">Current Position</div>
                        <div className="flex items-baseline gap-3">
                            <span className="text-5xl font-bold text-foreground tracking-tight">{displayLeaguePosition}</span>
                            <span className="text-sm font-medium text-muted-foreground truncate">{leagueNameState || "No League"}</span>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
}
