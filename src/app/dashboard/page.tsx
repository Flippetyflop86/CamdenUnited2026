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

            {/* Section 1: Immediate Actions */}
            <PageSection>
                <SectionHeader title="Action Required" />
                
                {priorities.length > 0 || injuredPlayers.length > 0 || suspendedPlayers.length > 0 ? (
                    <Card className="bg-card border-border shadow-md">
                        <div className="p-4 space-y-2">
                            {priorities.map((task, idx) => (
                                <div key={idx} className="flex items-center justify-between p-3 bg-surface-2 border border-border rounded-lg text-xs">
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => handleDismissPriority(task.label)}
                                            className="p-1 rounded hover:bg-status-success/10 text-muted-foreground hover:text-status-success transition-colors"
                                            title="Mark as Resolved"
                                        >
                                            <Check className="h-4 w-4" />
                                        </button>
                                        <span className="font-bold text-foreground">{task.label}</span>
                                    </div>
                                    <Badge className="bg-status-warning/10 text-status-warning border border-status-warning/20 hover:bg-status-warning/10">Priority</Badge>
                                </div>
                            ))}
                            {injuredPlayers.map((player, idx) => (
                                <div key={`inj-${idx}`} className="flex items-center justify-between p-3 bg-surface-2 border border-border rounded-lg text-xs">
                                    <div className="flex items-center gap-2">
                                        <AlertCircle className="h-4 w-4 shrink-0 text-status-error ml-1" />
                                        <span className="font-bold text-foreground">{player.firstName} {player.lastName} requires injury update.</span>
                                    </div>
                                    <Badge className="bg-status-error/10 text-status-error border border-status-error/20 hover:bg-status-error/10">Medical</Badge>
                                </div>
                            ))}
                            {suspendedPlayers.length > 0 && (
                                <div className="flex items-center justify-between p-3 bg-surface-2 border border-border rounded-lg text-xs">
                                    <div className="flex items-center gap-2">
                                        <ShieldAlert className="h-4 w-4 shrink-0 text-status-error ml-1" />
                                        <span className="font-bold text-foreground">{suspendedPlayers.length} player(s) currently suspended.</span>
                                    </div>
                                    <Badge className="bg-status-error/10 text-status-error border border-status-error/20 hover:bg-status-error/10">Discipline</Badge>
                                </div>
                            )}
                        </div>
                    </Card>
                ) : (
                    <Card className="bg-card border-border shadow-md p-6">
                        <EmptyState 
                            icon={CheckCircle2} 
                            title="All clear!" 
                            description="No immediate action items today." 
                        />
                    </Card>
                )}
            </PageSection>

            {/* Section 2: Club Status */}
            <PageSection>
                <SectionHeader title="Club Status" />
                <div className="grid gap-4 md:grid-cols-4">
                    <MetricCard 
                        title="League Position"
                        value={displayLeaguePosition}
                        description={leagueNameState || "No League Configured"}
                    />
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
                    <Card className="bg-card border-border p-6 shadow-sm">
                        <div className="cf-label text-muted-foreground mb-3">Recent Form</div>
                        <div className="flex gap-2">
                            {recentForm.map(m => (
                                <div 
                                    key={m.id}
                                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black ${
                                        m.result === "Win" ? "bg-status-success/20 text-status-success border border-status-success/30" :
                                        m.result === "Loss" ? "bg-status-error/20 text-status-error border border-status-error/30" :
                                        "bg-muted text-muted-foreground border border-border"
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
                    </Card>
                </div>
            </PageSection>

            {/* Section 3: Upcoming Activity */}
            <PageSection>
                <SectionHeader title="Upcoming Activity" />
                <div className="grid gap-4 md:grid-cols-2">
                    {/* Next Fixture */}
                    <Card className="bg-card border-border p-6 shadow-md">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h3 className="cf-label text-muted-foreground uppercase tracking-wider">Next Fixture</h3>
                                <div className="text-xl font-bold text-foreground mt-1">
                                    vs {nextMatch ? nextMatch.opponent : "TBC"}
                                </div>
                                {nextMatch && (
                                    <div className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
                                        <Calendar className="h-3.5 w-3.5" />
                                        {formatDate(nextMatch.date)} - {nextMatch.time || "TBC"}
                                        <span className="mx-1">•</span>
                                        <MapPin className="h-3.5 w-3.5" />
                                        {nextMatch.location || (nextMatch.isHome ? "Home" : "Away")}
                                    </div>
                                )}
                            </div>
                            <Badge className="bg-surface-2 text-foreground border-border">{nextMatch?.competition || "Friendly"}</Badge>
                        </div>
                        {nextMatch && (
                            <div className="bg-surface-2 p-3 rounded-lg border border-border flex justify-between items-center text-sm mb-4">
                                <div className="flex items-center gap-2">
                                    <ShieldAlert className="h-4 w-4 text-muted-foreground" />
                                    <span className="text-foreground font-medium">Formation: {lineup ? lineup.formation : "TBC"}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <CheckCircle2 className={`h-4 w-4 ${typeof window !== 'undefined' && localStorage.getItem("matchday_squad_confirmed_" + nextMatch.id) === "true" ? "text-status-success" : "text-muted-foreground"}`} />
                                    <span className="text-foreground font-medium">Squad Confirmed</span>
                                </div>
                            </div>
                        )}
                        <a href="/matchday-xi" className="flex items-center justify-center w-full p-2.5 rounded-lg bg-secondary hover:bg-accent text-secondary-foreground text-sm font-bold transition-colors border border-border">
                            Manage Matchday XI
                        </a>
                    </Card>

                    {/* Next Training */}
                    <Card className="bg-card border-border p-6 shadow-md">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h3 className="cf-label text-muted-foreground uppercase tracking-wider">Next Training</h3>
                                <div className="text-xl font-bold text-foreground mt-1">
                                    {nextTrainingSession ? nextTrainingSession.focus || "Team Session" : "No Session Scheduled"}
                                </div>
                                {nextTrainingSession && (
                                    <div className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
                                        <Calendar className="h-3.5 w-3.5" />
                                        {formatDate(nextTrainingSession.date)} - {nextTrainingSession.time || "TBC"}
                                        <span className="mx-1">•</span>
                                        <MapPin className="h-3.5 w-3.5" />
                                        {nextTrainingSession.location || "Training Ground"}
                                    </div>
                                )}
                            </div>
                        </div>
                        {nextTrainingSession && (
                            <div className="bg-surface-2 p-3 rounded-lg border border-border flex justify-between items-center text-sm mb-4">
                                <div className="flex items-center gap-2">
                                    <Users className="h-4 w-4 text-muted-foreground" />
                                    <span className="text-foreground font-medium">{availablePlayers.length} Available Players</span>
                                </div>
                            </div>
                        )}
                        <a href="/training" className="flex items-center justify-center w-full p-2.5 rounded-lg bg-secondary hover:bg-accent text-secondary-foreground text-sm font-bold transition-colors border border-border">
                            Manage Session
                        </a>
                    </Card>
                </div>
            </PageSection>

            {/* Section 4: Performance Overview */}
            <PageSection>
                <SectionHeader title="Performance Overview" />
                <div className="grid gap-4 md:grid-cols-4">
                    <MetricCard 
                        title="Win Rate"
                        value={`${winRate}%`}
                        trend={winRate > 50 ? { value: 5, direction: "up" } : undefined}
                    />
                    <MetricCard 
                        title="Goals Scored"
                        value={goalsScored.toString()}
                        description={`${(goalsScored / (totalPlayed || 1)).toFixed(1)} per game`}
                    />
                    <MetricCard 
                        title="Goals Conceded"
                        value={goalsConceded.toString()}
                        description={`${(goalsConceded / (totalPlayed || 1)).toFixed(1)} per game`}
                    />
                    <MetricCard 
                        title="Training Attendance"
                        value={`${averageTrainingAttendance}%`}
                        description="Average across all sessions"
                    />
                </div>
            </PageSection>

            {/* Section 5: Department Summaries */}
            <PageSection>
                <SectionHeader title="Department Summaries" />
                <div className="grid gap-4 md:grid-cols-2">
                    
                    {/* Medical Summary */}
                    <Card className="bg-card border-border shadow-md flex flex-col h-full">
                        <div className="p-4 border-b border-border flex justify-between items-center">
                            <h3 className="cf-card-title text-foreground flex items-center gap-2">
                                <Activity className="h-5 w-5 text-status-error" />
                                Medical
                            </h3>
                            <Badge className="bg-surface-2 text-foreground border-border">{filteredInjuryList.length} Unavailable</Badge>
                        </div>
                        <div className="p-4 flex-1 flex flex-col">
                            <div className="space-y-2 flex-1">
                                {filteredInjuryList.slice(0, 5).map(p => {
                                    const isSuspended = p.medicalStatus === "Suspended";
                                    const isHoliday = p.medicalStatus === "Holiday";
                                    const typeLabel = isSuspended ? (p.suspensionReason || "Suspension") : (p.injuryType || (isHoliday ? "Holiday" : "Injured"));
                                    const durationLabel = isSuspended ? (p.suspensionDuration || "TBC") : (p.injuryDuration || "Timeline TBC");

                                    return (
                                        <div key={p.id} className="flex justify-between items-center bg-surface-2 px-3 py-2 rounded-lg border border-border">
                                            <div className="space-y-0.5">
                                                <span className="font-bold text-xs text-foreground block">{p.firstName} {p.lastName}</span>
                                                <span className="text-[10px] text-muted-foreground block font-medium">
                                                    {typeLabel} - {isHoliday ? "Out of Club" : durationLabel}
                                                </span>
                                            </div>
                                            <Badge className={`text-[9px] font-black uppercase tracking-wider ${
                                                isHoliday ? "bg-status-warning/10 text-status-warning border border-status-warning/20" : "bg-status-error/10 text-status-error border border-status-error/20"
                                            }`}>
                                                {isHoliday ? "Holiday" : isSuspended ? "Suspended" : "Injured"}
                                            </Badge>
                                        </div>
                                    );
                                })}
                                {filteredInjuryList.length === 0 && (
                                    <div className="h-full flex items-center justify-center py-6">
                                        <EmptyState icon={CheckCircle2} title="Clean Bill of Health" description="No injuries or suspensions currently active." />
                                    </div>
                                )}
                            </div>
                            <div className="mt-4">
                                <a href="/squad" className="flex items-center justify-center w-full p-2.5 rounded-lg bg-secondary hover:bg-accent text-secondary-foreground text-xs font-bold transition-colors border border-border">
                                    View Full Squad
                                </a>
                            </div>
                        </div>
                    </Card>

                    {/* Squad Readiness Summary */}
                    <Card className="bg-card border-border shadow-md flex flex-col h-full">
                        <div className="p-4 border-b border-border flex justify-between items-center">
                            <h3 className="cf-card-title text-foreground flex items-center gap-2">
                                <Users className="h-5 w-5 text-brand" />
                                Squad Readiness
                            </h3>
                            <Badge className="bg-surface-2 text-foreground border-border">{players.length} Registered</Badge>
                        </div>
                        <div className="p-4 flex-1 flex flex-col">
                            <div className="space-y-3 flex-1 pt-1">
                                <div>
                                    <div className="flex justify-between text-xs font-bold text-foreground mb-1.5">
                                        <span>Squad Availability</span>
                                        <span className="text-status-success">{squadAvailabilityRate}%</span>
                                    </div>
                                    <div className="h-2.5 w-full bg-surface-2 rounded-full overflow-hidden">
                                        <div className="h-full bg-status-success rounded-full" style={{ width: `${squadAvailabilityRate}%` }} />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-xs pt-2">
                                    <div className="bg-surface-2 p-3 rounded-lg border border-border">
                                        <span className="cf-label text-muted-foreground block">Available</span>
                                        <span className="font-extrabold text-status-success mt-1 block text-lg">{availablePlayers.length}</span>
                                    </div>
                                    <div className="bg-surface-2 p-3 rounded-lg border border-border">
                                        <span className="cf-label text-muted-foreground block">Injured</span>
                                        <span className="font-extrabold text-status-error mt-1 block text-lg">{injuredPlayers.length}</span>
                                    </div>
                                    <div className="bg-surface-2 p-3 rounded-lg border border-border">
                                        <span className="cf-label text-muted-foreground block">Suspended</span>
                                        <span className="font-extrabold text-status-error mt-1 block text-lg">{suspendedPlayers.length}</span>
                                    </div>
                                    <div className="bg-surface-2 p-3 rounded-lg border border-border">
                                        <span className="cf-label text-muted-foreground block">Holiday / Out</span>
                                        <span className="font-extrabold text-status-warning mt-1 block text-lg">{players.filter(p => p.medicalStatus === "Holiday").length}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="mt-4">
                                <a href="/player/profile" className="flex items-center justify-center w-full p-2.5 rounded-lg bg-secondary hover:bg-accent text-secondary-foreground text-xs font-bold transition-colors border border-border">
                                    View Player Profiles
                                </a>
                            </div>
                        </div>
                    </Card>

                </div>
            </PageSection>
        </div>
    );
}
