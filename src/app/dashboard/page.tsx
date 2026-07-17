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
    ArrowUpRight,
    ArrowDownRight,
    RefreshCw,
    Check,
    Clock,
    LayoutDashboard,
    ShieldAlert,
    DollarSign,
    AlertCircle,
    Calendar,
    MapPin,
    Plus,
    Search,
    Award,
    TrendingUp
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
    const [lastResult, setLastResult] = useState<Match | null>(null);
    const [upcomingFixtures, setUpcomingFixtures] = useState<Match[]>([]);
    const [squadCounts, setSquadCounts] = useState<Record<string, number>>({});
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncSuccess, setSyncSuccess] = useState(false);
    const [timeLeft, setTimeLeft] = useState<{ days: number; hours: number; minutes: number; seconds: number } | null>(null);
    const [activities, setActivities] = useState<any[]>([]);
    const [auditLogs, setAuditLogs] = useState<any[]>([]);
    const [activityTab, setActivityTab] = useState<'rsvp' | 'audit'>('rsvp');
    
    // Advanced Operations & Performance States
    const [recruits, setRecruits] = useState<any[]>([]);
    const [trainingSessions, setTrainingSessions] = useState<any[]>([]);
    const [paymentRequests, setPaymentRequests] = useState<any[]>([]);

    useEffect(() => {
        fetchData();

        // Subscriptions
        const channels = [
            supabase.channel('public:matches').on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, fetchMatches),
            supabase.channel('public:players').on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, fetchSquad),
            supabase.channel('public:matchday_xis').on('postgres_changes', { event: '*', schema: 'public', table: 'matchday_xis' }, fetchLineup),
            supabase.channel('public:activity_logs').on('postgres_changes', { event: '*', schema: 'public', table: 'activity_logs' }, fetchActivities),
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
        fetchActivities();
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

    const fetchActivities = async () => {
        // Fetch RSVPs
        const { data: rsvpData } = await supabase
            .from('activity_logs')
            .select('*')
            .eq('action', 'Player RSVP Check-in')
            .order('created_at', { ascending: false })
            .limit(10);
        if (rsvpData) setActivities(rsvpData);

        // Fetch Audit Logs (everything except RSVPs)
        const { data: auditData } = await supabase
            .from('activity_logs')
            .select('*')
            .neq('action', 'Player RSVP Check-in')
            .order('created_at', { ascending: false })
            .limit(10);
        if (auditData) setAuditLogs(auditData);
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

            const completed = loadedMatches
                .filter(m => m.result !== "Pending")
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

            setLastResult(completed[0] || null);
        }
    };

    const fetchSquad = async () => {
        const { data } = await supabase
            .from('players')
            .select('id, first_name, last_name, position, squad, image_url, date_of_birth, appearances, goals, assists, nickname, use_nickname, medical_status, is_contracted, contract_end_date');
        
        if (data) {
            const mainSquad = settings.squads?.[0] || "First Team";
            const mainSquadClean = mainSquad.toLowerCase().replace(/[\s-_]+/g, '');
            
            // Filter loaded players to the main squad (First Team) only
            const filteredPlayers = data.filter((p: any) => {
                const sClean = (p.squad || "").toLowerCase().replace(/[\s-_]+/g, '');
                if ((sClean === 'firstteam' || sClean === 'first team') && (mainSquadClean === 'firstteam' || mainSquadClean === 'first team')) return true;
                return sClean === mainSquadClean;
            });

            const mapped: Player[] = filteredPlayers.map((p: any) => ({
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
                contractEndDate: p.contract_end_date
            }));
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

    const formatDateTime = (dateStr: string, timeStr: string) => {
        if (!dateStr) return "";
        const d = new Date(dateStr).toLocaleDateString("en-GB", {
            weekday: "short",
            day: "numeric",
            month: "short"
        });
        return `${d} • ${timeStr || "TBD"}`;
    };

    const getResultColor = (result: string) => {
        switch (result) {
            case "Win": return "text-emerald-600 font-extrabold";
            case "Draw": return "text-amber-500 font-extrabold";
            case "Loss": return "text-red-600 font-extrabold";
            default: return "text-slate-500";
        }
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

    const currentSquads = settings.squads || ["First Team"];
    const mainSquad = currentSquads[0];
    const mainSquadCount = squadCounts[mainSquad] || 0;

    // Advanced Calculated Operations Metrics
    const totalSquadCount = players.length || 1;
    const availablePlayers = players.filter(p => p.medicalStatus === "Available");
    const squadAvailabilityRate = Math.round((availablePlayers.length / totalSquadCount) * 100);
    const injuredPlayers = players.filter(p => p.medicalStatus === "Injured" || p.medicalStatus === "Doubtful");
    const suspendedPlayers = players.filter(p => p.medicalStatus === "Suspended");

    // Registration Issues
    const registrationIssues = players.filter(p => !p.dateOfBirth || (p.isContracted && !p.contractEndDate));

    // Training Attendance Rate
    const totalTrainingSessions = trainingSessions.length;
    const calculateTrainingAttendance = () => {
        if (!totalTrainingSessions) return 0;
        let totalCount = 0;
        let presentCount = 0;
        trainingSessions.forEach(s => {
            if (s.attendance && Array.isArray(s.attendance)) {
                s.attendance.forEach((att: any) => {
                    totalCount++;
                    if (att.status === "Present" || att.status === "Late") presentCount++;
                });
            }
        });
        return totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0;
    };
    const avgTrainingAttendance = calculateTrainingAttendance();

    // Recruitment Metrics
    const activeTrialistsCount = recruits.filter(r => r.on_trial).length;
    const pendingScoutReports = recruits.filter(r => !r.notes || r.notes.length < 20).length;

    // Outstanding Payments
    const outstandingInvoices = paymentRequests.filter(r => r.status === "Unpaid" || r.status === "unpaid" || r.status === "Overdue");
    const totalOutstandingAmount = outstandingInvoices.reduce((sum, r) => sum + (r.amount || 0), 0);

    const getPositionCounts = () => {
        const counts = { GK: 0, DEF: 0, MID: 0, FWD: 0 };
        players.forEach(p => {
            const pos = (p.position || "").trim().toUpperCase();
            if (pos === 'GK' || pos.includes('GK') || pos.includes('KEEPER') || pos.includes('GOAL')) {
                counts.GK++;
            } else if (['CB', 'RB', 'LB', 'DEF', 'RWB', 'LWB'].includes(pos) || pos.includes('DEF') || pos.includes('BACK')) {
                counts.DEF++;
            } else if (['CM', 'CDM', 'CAM', 'MID', 'RM', 'LM'].includes(pos) || pos.includes('MID') || pos.includes('CENT') || pos.includes('RM') || pos.includes('LM')) {
                counts.MID++;
            } else if (['ST', 'CF', 'RW', 'LW', 'FWD', 'ATT'].includes(pos) || pos.includes('STRIKER') || pos.includes('WING') || pos.includes('FWD') || pos.includes('FORWARD') || pos.includes('ST') || pos.includes('CF') || pos.includes('RW') || pos.includes('LW')) {
                counts.FWD++;
            } else {
                if (pos.includes('M')) counts.MID++;
                else if (pos.includes('D') || pos.includes('B')) counts.DEF++;
                else if (pos.includes('F') || pos.includes('S') || pos.includes('W') || pos.includes('A')) counts.FWD++;
                else counts.MID++;
            }
        });
        return counts;
    };

    const positionCounts = getPositionCounts();
    const totalPosCount = Object.values(positionCounts).reduce((a, b) => a + b, 0) || 1;
    const positionConfigs = [
        { label: "Goalkeepers", count: positionCounts.GK, color: "bg-orange-500", track: "bg-orange-500/10" },
        { label: "Defenders", count: positionCounts.DEF, color: "bg-blue-500", track: "bg-blue-500/10" },
        { label: "Midfielders", count: positionCounts.MID, color: "bg-yellow-500", track: "bg-yellow-500/10" },
        { label: "Forwards", count: positionCounts.FWD, color: "bg-red-500", track: "bg-red-500/10" },
    ];

    const renderMiniPitch = () => {
        if (!lineup || !players.length || Object.keys(lineup.starters || {}).length === 0) return (
            <div className="h-[260px] flex flex-col items-center justify-center border border-slate-800 rounded-xl border-dashed text-slate-500 text-xs p-4 text-center bg-slate-950/20">
                <span className="text-2xl mb-2">📋</span>
                <p className="font-bold text-slate-300">No starting XI pinned</p>
                <p className="text-[10px] text-slate-500 mt-1 leading-tight">Design and save tactical lineups inside Matchday XI.</p>
                <a href="/matchday-xi" className="mt-3 px-3 py-1 bg-red-950/40 border border-red-500/30 hover:bg-red-900/40 text-red-400 font-bold text-[9px] rounded-lg transition-colors uppercase tracking-wider">
                    Go to Lineups
                </a>
            </div>
        );

        const formation = FORMATIONS[lineup.formation] || FORMATIONS["4-2-3-1"];
        const kitColor = settings.homeKitShirt || "#ffffff";

        return (
            <div className="relative w-full max-w-[280px] h-[260px] bg-emerald-950/80 rounded-xl overflow-hidden shadow-lg border border-emerald-900/60 flex-shrink-0 mx-auto">
                <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-5">
                    {Array.from({ length: 6 }).map((_, idx) => (
                        <div key={idx} className={`h-[44px] w-full ${idx % 2 === 0 ? 'bg-black' : 'bg-transparent'}`} />
                    ))}
                </div>

                <div className="absolute inset-0 border border-white/10 m-2 pointer-events-none">
                    <div className="absolute top-1/2 left-2 right-2 border-t border-white/10" />
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 border border-white/10 rounded-full" />
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
                                className="w-4 h-4 rounded-full flex items-center justify-center text-[7px] font-black text-white border border-black/50 shadow-md"
                                style={{ backgroundColor: pos.label === "GK" ? "#ea580c" : kitColor }}
                            >
                                {pos.number}
                            </div>
                            <span className="text-[6px] font-extrabold text-white bg-slate-950/90 px-1 py-0.5 rounded shadow mt-0.5 max-w-[40px] truncate leading-none">
                                {name}
                            </span>
                        </div>
                    );
                })}
            </div>
        );
    };

    const hasPlayers = players.length > 0;
    const hasMatches = matches.length > 0;
    const hasLineup = lineup && Object.keys(lineup.starters || {}).length > 0;
    const hasLeagueUrl = !!settings.leagueUrl;

    const checklistSteps = [
        { label: "Add Players", completed: hasPlayers, link: "/squad" },
        { label: "Schedule Match", completed: hasMatches, link: "/matches" },
        { label: "Pick Lineup", completed: hasLineup, link: "/matchday-xi" },
        { label: "Link League Url", completed: hasLeagueUrl, link: "/admin" }
    ];
    const completedStepsCount = checklistSteps.filter(s => s.completed).length;
    const showSetupChecklist = completedStepsCount < 4;

    const getUpcomingBirthdays = (squadPlayers: Player[]) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const upcoming = [];
        for (const player of squadPlayers) {
            if (!player.dateOfBirth) continue;
            const dob = new Date(player.dateOfBirth);
            if (isNaN(dob.getTime())) continue;
            const nextBirthday = new Date(today.getFullYear(), dob.getMonth(), dob.getDate());
            if (nextBirthday.getTime() < today.getTime()) {
                nextBirthday.setFullYear(today.getFullYear() + 1);
            }
            const diffTime = nextBirthday.getTime() - today.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            if (diffDays >= 0 && diffDays <= 7) {
                upcoming.push({ player, daysLeft: diffDays, nextBirthday });
            }
        }
        return upcoming.sort((a, b) => a.daysLeft - b.daysLeft);
    };

    const birthdays = getUpcomingBirthdays(players);

    return (
        <div className="space-y-6 relative pb-12">
            {/* Ambient Control Glows */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden z-0 opacity-15">
                <div className="absolute top-[5%] left-[10%] w-[380px] h-[380px] rounded-full bg-red-500/10 blur-[80px]" />
                <div className="absolute bottom-[20%] right-[10%] w-[420px] h-[420px] rounded-full bg-slate-500/10 blur-[90px]" />
            </div>

            {/* Dashboard Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-900 pb-5 relative z-10">
                <div className="flex items-center gap-4">
                    {settings.logo ? (
                        <div className="h-14 w-14 relative flex-shrink-0 bg-slate-900 border border-slate-800 p-1 rounded-xl">
                            <img src={settings.logo} alt={settings.name} className="h-full w-full object-contain" />
                        </div>
                    ) : (
                        <div className="h-14 w-14 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center font-bold text-red-500 text-lg">
                            CF
                        </div>
                    )}
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-2xl font-black tracking-tight text-white">{settings.name}</h2>
                            <Badge className="bg-red-550/15 hover:bg-red-550/15 text-red-400 border border-red-500/20 text-[9px] uppercase tracking-wider font-extrabold px-2 py-0.5">
                                Operations Command Centre
                            </Badge>
                        </div>
                        <p className="text-slate-400 text-xs mt-0.5">Squad Management, Tactical Planning &amp; Operational Analytics</p>
                    </div>
                </div>

                <div className="flex gap-2">
                    <button
                        onClick={syncLeague}
                        disabled={isSyncing || !settings.leagueUrl}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-950 text-slate-300 text-xs font-semibold hover:border-slate-700 hover:text-white transition-all ${isSyncing ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                        <span>Sync League Table</span>
                    </button>
                    <a href="/matches" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-bold hover:bg-red-700 transition-all shadow-md shadow-red-950/20">
                        <Plus className="h-3.5 w-3.5" />
                        <span>Schedule Fixture</span>
                    </a>
                </div>
            </div>

            {/* Critical Operations Warning Panel */}
            <div className="grid gap-4 md:grid-cols-3 relative z-10">
                {/* Availability Alert */}
                <Card className="bg-[#0b0f19]/60 border-slate-900/80 shadow-md">
                    <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                        <CardTitle className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Squad Availability</CardTitle>
                        <Badge className={`${squadAvailabilityRate > 85 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'} border text-[8px]`}>
                            {squadAvailabilityRate}% Ready
                        </Badge>
                    </CardHeader>
                    <CardContent className="space-y-1.5">
                        <div className="text-xl font-black text-white">{availablePlayers.length} / {totalSquadCount} Available</div>
                        <p className="text-[10px] text-slate-400 leading-tight">
                            {injuredPlayers.length > 0 
                                ? `${injuredPlayers.length} player(s) flagged on injury list. Return details in panel below.`
                                : "All primary roster players are currently fit and selectable."}
                        </p>
                    </CardContent>
                </Card>

                {/* Registration Alerts */}
                <Card className="bg-[#0b0f19]/60 border-slate-900/80 shadow-md">
                    <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                        <CardTitle className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Registration Alerts</CardTitle>
                        <ShieldAlert className={`h-4 w-4 ${registrationIssues.length > 0 ? 'text-amber-500' : 'text-slate-650'}`} />
                    </CardHeader>
                    <CardContent className="space-y-1.5">
                        <div className="text-xl font-black text-white">{registrationIssues.length} Outstanding</div>
                        <p className="text-[10px] text-slate-400 leading-tight">
                            {registrationIssues.length > 0
                                ? `${registrationIssues.length} squad member(s) missing birthdates or active contracts.`
                                : "All player registration profiles are complete and compliant."}
                        </p>
                    </CardContent>
                </Card>

                {/* Payment Alerts */}
                <Card className="bg-[#0b0f19]/60 border-slate-900/80 shadow-md">
                    <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                        <CardTitle className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Unpaid Invoices</CardTitle>
                        <DollarSign className={`h-4 w-4 ${totalOutstandingAmount > 0 ? 'text-red-500' : 'text-slate-650'}`} />
                    </CardHeader>
                    <CardContent className="space-y-1.5">
                        <div className="text-xl font-black text-white">£{totalOutstandingAmount.toFixed(2)}</div>
                        <p className="text-[10px] text-slate-400 leading-tight">
                            {outstandingInvoices.length > 0
                                ? `${outstandingInvoices.length} outstanding fee payments awaiting collection.`
                                : "All player subscriptions and match fees are fully up to date."}
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Quick Start Checklist */}
            {showSetupChecklist && (
                <Card className="bg-[#121824] border-slate-900 shadow-xl relative overflow-hidden z-10">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-red-650/5 rounded-full blur-2xl pointer-events-none" />
                    <CardContent className="p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                        <div className="space-y-1 flex-1">
                            <div className="flex items-center gap-2">
                                <Badge className="bg-red-500/10 text-red-400 border border-red-500/20 text-[9px] uppercase tracking-wider">Quick Start</Badge>
                                <span className="text-[10px] font-bold text-slate-400">Operations Checklist: {completedStepsCount}/4 Complete</span>
                            </div>
                            <h3 className="text-sm font-bold text-white mt-1">Initialize Football Department Operations</h3>
                            <p className="text-slate-400 text-xs">Set up the platform variables to unlock tactical, recruitment and match reports.</p>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2 w-full md:w-auto shrink-0 text-xs">
                            {checklistSteps.map(step => (
                                <a 
                                    key={step.label} 
                                    href={step.link}
                                    className={`flex items-center gap-2 p-2 rounded-lg border transition-all ${
                                        step.completed 
                                            ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400' 
                                            : 'bg-slate-950 border-slate-900 text-slate-400 hover:border-slate-800 hover:text-white'
                                    }`}
                                >
                                    <div className={`h-3 w-3 rounded-full flex items-center justify-center shrink-0 border text-[8px] ${
                                        step.completed ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-600 text-transparent'
                                    }`}>
                                        ✓
                                    </div>
                                    <span className="font-semibold">{step.label}</span>
                                </a>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Core Columns Section */}
            <div className="grid gap-6 lg:grid-cols-7 relative z-10">
                
                {/* Football Operations & Matchday Column (4 spans) */}
                <div className="lg:col-span-4 space-y-6">
                    {/* Next Match Widget */}
                    <Card className="bg-[#121824] border-slate-900 shadow-md">
                        <CardHeader className="pb-3 border-b border-slate-900">
                            <div className="flex justify-between items-center">
                                <div>
                                    <CardTitle className="text-sm font-bold text-white uppercase tracking-wider">Next Fixture</CardTitle>
                                    <CardDescription className="text-xs text-slate-400">Matchday Readiness &amp; Opponent</CardDescription>
                                </div>
                                {nextMatch && (
                                    <Badge className="bg-red-500/10 text-red-400 border border-red-500/20">
                                        {nextMatch.isHome ? "Home Venue" : "Away Venue"}
                                    </Badge>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent className="pt-4 space-y-4">
                            {nextMatch ? (
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center bg-slate-950 p-3 rounded-xl border border-slate-900">
                                        <div>
                                            <div className="text-xs text-slate-550 uppercase tracking-wider font-bold">Opponent</div>
                                            <div className="text-base font-black text-white mt-0.5">{nextMatch.opponent}</div>
                                            <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-1.5">
                                                <Badge variant="outline" className="text-[8px] border-slate-800 text-slate-400">{nextMatch.competition}</Badge>
                                                <span>•</span>
                                                <span>{nextMatch.surface === "Grass" ? "🌱 Natural Grass" : "👟 4G Synthetic"}</span>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-xs text-slate-555 uppercase tracking-wider font-bold">Kick-off</div>
                                            <div className="text-xs font-bold text-white mt-1">{formatDate(nextMatch.date)} • {nextMatch.time || "TBC"}</div>
                                            {nextMatch.location && <div className="text-[9px] text-slate-400 mt-1 max-w-[140px] truncate">{nextMatch.location}</div>}
                                        </div>
                                    </div>

                                    {timeLeft && (
                                        <div className="bg-red-500/5 border border-red-500/10 rounded-xl p-3 flex justify-between items-center text-xs">
                                            <span className="font-bold text-slate-350">Days until Kick-off:</span>
                                            <div className="flex gap-2 text-white font-black">
                                                <div className="bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-900">{timeLeft.days}d</div>
                                                <div className="bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-900">{timeLeft.hours}h</div>
                                                <div className="bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-900">{timeLeft.minutes}m</div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="text-center py-6 text-slate-500 text-xs">
                                    No upcoming matches on record.
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Injury, Doubtful & Suspended List */}
                    <Card className="bg-[#121824] border-slate-900 shadow-md">
                        <CardHeader className="pb-3 border-b border-slate-900">
                            <CardTitle className="text-sm font-bold text-white uppercase tracking-wider">Injury &amp; Suspension Log</CardTitle>
                            <CardDescription className="text-xs text-slate-400">Unavailable players requiring physical therapy or disciplinary status checks</CardDescription>
                        </CardHeader>
                        <CardContent className="pt-4">
                            <div className="space-y-2.5">
                                {injuredPlayers.length === 0 && suspendedPlayers.length === 0 ? (
                                    <div className="text-center py-6 text-slate-500 text-xs">
                                        No injuries or disciplinary suspensions logged.
                                    </div>
                                ) : (
                                    <>
                                        {injuredPlayers.map(p => (
                                            <div key={p.id} className="flex justify-between items-center bg-slate-950 p-2.5 rounded-xl border border-slate-900 text-xs">
                                                <div>
                                                    <span className="font-semibold text-white">{formatPlayerName(p)}</span>
                                                    <span className="text-[10px] text-slate-400 ml-2">({p.position})</span>
                                                </div>
                                                <Badge className="bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[8px] uppercase tracking-wide">
                                                    {p.medicalStatus === "Doubtful" ? "Doubtful" : "Injured"}
                                                </Badge>
                                            </div>
                                        ))}
                                        {suspendedPlayers.map(p => (
                                            <div key={p.id} className="flex justify-between items-center bg-slate-950 p-2.5 rounded-xl border border-slate-900 text-xs">
                                                <div>
                                                    <span className="font-semibold text-white">{formatPlayerName(p)}</span>
                                                    <span className="text-[10px] text-slate-400 ml-2">({p.position})</span>
                                                </div>
                                                <Badge className="bg-red-500/10 text-red-400 border border-red-500/20 text-[8px] uppercase tracking-wide">
                                                    Suspended
                                                </Badge>
                                            </div>
                                        ))}
                                    </>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Team Starting XI & Form */}
                    <Card className="bg-[#121824] border-slate-900 shadow-md">
                        <CardHeader className="pb-3 border-b border-slate-900">
                            <CardTitle className="text-sm font-bold text-white uppercase tracking-wider">Starting Selection &amp; Form</CardTitle>
                            <CardDescription className="text-xs text-slate-400">Pinned starting lineup and recent 5-match results</CardDescription>
                        </CardHeader>
                        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-center pt-4">
                            <div className="space-y-4">
                                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Recent Form</h4>
                                {matches.filter(m => m.result !== "Pending").length > 0 ? (
                                    <div className="flex gap-2.5 items-center">
                                        {matches
                                            .filter(m => m.result !== "Pending")
                                            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                                            .slice(0, 5)
                                            .reverse()
                                            .map((match, i) => {
                                                const isWin = match.result === "Win";
                                                const isLoss = match.result === "Loss";
                                                const colorClass = isWin 
                                                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                                                    : isLoss 
                                                        ? "bg-red-500/10 text-red-400 border-red-500/20" 
                                                        : "bg-amber-500/10 text-amber-400 border-amber-500/20";
                                                return (
                                                    <div key={i} className={`h-8 w-8 rounded-lg flex items-center justify-center font-bold text-xs border ${colorClass}`} title={`${match.result} vs ${match.opponent}`}>
                                                        {match.result?.[0]}
                                                    </div>
                                                );
                                            })}
                                    </div>
                                ) : (
                                    <p className="text-slate-500 text-xs">No match history logged yet.</p>
                                )}
                            </div>
                            <div className="flex justify-center">
                                {renderMiniPitch()}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Performance & Squad Balance Column (3 spans) */}
                <div className="lg:col-span-3 space-y-6">
                    {/* Standings & Training Stats */}
                    <Card className="bg-[#121824] border-slate-900 shadow-md">
                        <CardHeader className="pb-3 border-b border-slate-900">
                            <CardTitle className="text-sm font-bold text-white uppercase tracking-wider">Performance Metrics</CardTitle>
                            <CardDescription className="text-xs text-slate-400">Position standings and attendance tracking</CardDescription>
                        </CardHeader>
                        <CardContent className="pt-4 space-y-4">
                            <div className="flex justify-between items-center bg-slate-950 p-3 rounded-xl border border-slate-900">
                                <div>
                                    <span className="text-[10px] text-slate-450 uppercase tracking-wider font-bold">League Table</span>
                                    <div className="text-lg font-black text-white mt-1">{displayLeaguePosition}</div>
                                </div>
                                <Trophy className="h-6 w-6 text-amber-500" />
                            </div>

                            <div className="flex justify-between items-center bg-slate-950 p-3 rounded-xl border border-slate-900">
                                <div>
                                    <span className="text-[10px] text-slate-450 uppercase tracking-wider font-bold">Avg Training Attendance</span>
                                    <div className="text-lg font-black text-white mt-1">{avgTrainingAttendance}%</div>
                                </div>
                                <Activity className="h-6 w-6 text-red-500" />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Squad Balance Card */}
                    <Card className="bg-[#121824] border-slate-900 shadow-md">
                        <CardHeader className="pb-3 border-b border-slate-900">
                            <CardTitle className="text-sm font-bold text-white uppercase tracking-wider">Position Depth</CardTitle>
                            <CardDescription className="text-xs text-slate-400">Breakdown of roster roles</CardDescription>
                        </CardHeader>
                        <CardContent className="pt-4 space-y-3.5">
                            {positionConfigs.map(cfg => {
                                const percent = Math.round((cfg.count / totalPosCount) * 100) || 0;
                                return (
                                    <div key={cfg.label} className="space-y-1">
                                        <div className="flex justify-between text-xs text-slate-300">
                                            <span className="font-semibold">{cfg.label}</span>
                                            <span className="text-slate-400">{cfg.count} player(s)</span>
                                        </div>
                                        <div className="h-1.5 w-full bg-slate-950 rounded-full overflow-hidden">
                                            <div className={`h-full ${cfg.color} rounded-full`} style={{ width: `${percent}%` }} />
                                        </div>
                                    </div>
                                );
                            })}
                        </CardContent>
                    </Card>

                    {/* Recruitment Pipeline */}
                    <Card className="bg-[#121824] border-slate-900 shadow-md">
                        <CardHeader className="pb-3 border-b border-slate-900">
                            <CardTitle className="text-sm font-bold text-white uppercase tracking-wider">Recruitment Pipeline</CardTitle>
                            <CardDescription className="text-xs text-slate-400">Shortlisted players and trial tracking</CardDescription>
                        </CardHeader>
                        <CardContent className="pt-4 space-y-3">
                            <div className="flex justify-between items-center text-xs bg-slate-950 p-2.5 rounded-xl border border-slate-900">
                                <span className="font-medium text-slate-350">Active Trialists</span>
                                <Badge className="bg-blue-500/10 text-blue-400 border border-blue-500/20">{activeTrialistsCount}</Badge>
                            </div>
                            <div className="flex justify-between items-center text-xs bg-slate-950 p-2.5 rounded-xl border border-slate-900">
                                <span className="font-medium text-slate-350">Shortlisted Recruits</span>
                                <Badge className="bg-slate-800 text-slate-300 border border-slate-700">{recruits.length}</Badge>
                            </div>
                            <div className="flex justify-between items-center text-xs bg-slate-950 p-2.5 rounded-xl border border-slate-900">
                                <span className="font-medium text-slate-350">Pending Scout Reviews</span>
                                <Badge className="bg-amber-500/10 text-amber-400 border border-amber-500/20">{pendingScoutReports}</Badge>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Bottom Row: Leaderboards & Audit Feed */}
            <div className="grid gap-6 md:grid-cols-2 relative z-10">
                {/* Stats Leaders */}
                <Card className="bg-[#121824] border-slate-900 shadow-md">
                    <CardHeader className="pb-3 border-b border-slate-900">
                        <CardTitle className="text-sm font-bold text-white uppercase tracking-wider">Squad Contributors</CardTitle>
                        <CardDescription className="text-xs text-slate-400">Leading scorers and playmakers</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-4 space-y-4">
                        <div>
                            <h4 className="text-[10px] font-bold text-slate-450 uppercase tracking-wider mb-2">⚽ Top Goalscorers</h4>
                            <div className="space-y-2">
                                {players
                                    .filter(p => p.goals > 0)
                                    .sort((a, b) => b.goals - a.goals)
                                    .slice(0, 3)
                                    .map((p, idx) => (
                                        <div key={p.id} className="flex justify-between text-xs bg-slate-950/60 p-2 rounded-lg border border-slate-900">
                                            <span className="text-slate-300 font-semibold">{idx + 1}. {formatPlayerName(p)}</span>
                                            <span className="font-black text-red-400">{p.goals} Goals</span>
                                        </div>
                                    ))}
                                {players.filter(p => p.goals > 0).length === 0 && (
                                    <p className="text-[10px] text-slate-500 italic">No goals registered.</p>
                                )}
                            </div>
                        </div>

                        <div className="border-t border-slate-900 pt-3">
                            <h4 className="text-[10px] font-bold text-slate-450 uppercase tracking-wider mb-2">🅰️ Assist Leaders</h4>
                            <div className="space-y-2">
                                {players
                                    .filter(p => p.assists > 0)
                                    .sort((a, b) => b.assists - a.assists)
                                    .slice(0, 3)
                                    .map((p, idx) => (
                                        <div key={p.id} className="flex justify-between text-xs bg-slate-950/60 p-2 rounded-lg border border-slate-900">
                                            <span className="text-slate-300 font-semibold">{idx + 1}. {formatPlayerName(p)}</span>
                                            <span className="font-black text-blue-400">{p.assists} Assists</span>
                                        </div>
                                    ))}
                                {players.filter(p => p.assists > 0).length === 0 && (
                                    <p className="text-[10px] text-slate-500 italic">No assists registered.</p>
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Combined Log Feed */}
                <Card className="bg-[#121824] border-slate-900 shadow-md">
                    <CardHeader className="pb-3 border-b border-slate-900 flex justify-between items-center flex-row space-y-0">
                        <div>
                            <CardTitle className="text-sm font-bold text-white uppercase tracking-wider">Operations Log</CardTitle>
                            <CardDescription className="text-xs text-slate-400">Live check-ins and admin metrics</CardDescription>
                        </div>
                        <div className="flex bg-slate-950 p-0.5 rounded-lg border border-slate-900">
                            <button 
                                onClick={() => setActivityTab('rsvp')} 
                                className={`px-2.5 py-1 text-[10px] font-extrabold rounded-md transition-all ${activityTab === 'rsvp' ? 'bg-slate-800 text-white' : 'text-slate-500'}`}
                            >
                                RSVPs
                            </button>
                            <button 
                                onClick={() => setActivityTab('audit')} 
                                className={`px-2.5 py-1 text-[10px] font-extrabold rounded-md transition-all ${activityTab === 'audit' ? 'bg-slate-800 text-white' : 'text-slate-500'}`}
                            >
                                Audit
                            </button>
                        </div>
                    </CardHeader>
                    <CardContent className="pt-4 max-h-[290px] overflow-y-auto">
                        <div className="space-y-3">
                            {activityTab === 'rsvp' ? (
                                activities.length === 0 ? (
                                    <p className="text-xs text-slate-500 italic">No check-in operations logged.</p>
                                ) : (
                                    activities.map((act, i) => (
                                        <div key={i} className="flex justify-between items-start text-xs bg-slate-950/60 p-2.5 rounded-xl border border-slate-900">
                                            <div>
                                                <span className="font-semibold text-slate-300">{act.user_name}</span>
                                                <p className="text-[10px] text-slate-450 mt-0.5">{act.details}</p>
                                            </div>
                                            <span className="text-[8px] text-slate-500 font-mono">{formatDate(act.created_at)}</span>
                                        </div>
                                    ))
                                )
                            ) : (
                                auditLogs.length === 0 ? (
                                    <p className="text-xs text-slate-500 italic">No logs recorded.</p>
                                ) : (
                                    auditLogs.map((log, i) => (
                                        <div key={i} className="flex justify-between items-start text-xs bg-slate-950/60 p-2.5 rounded-xl border border-slate-900">
                                            <div>
                                                <span className="font-semibold text-slate-300">{log.action}</span>
                                                <p className="text-[10px] text-slate-450 mt-0.5">{log.details}</p>
                                            </div>
                                            <span className="text-[8px] text-slate-500 font-mono">{formatDate(log.created_at)}</span>
                                        </div>
                                    ))
                                )
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
