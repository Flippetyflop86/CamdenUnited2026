"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Match, Player } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    Users,
    Trophy,
    CalendarDays,
    RefreshCw,
    Check,
    Clock,
    ShieldAlert,
    MapPin,
    Award,
    AlertCircle,
    CheckCircle2,
    Calendar,
    Copy,
    ArrowRight,
    Sparkles,
    Zap,
    Flame,
    Home,
    Plane,
    HeartPulse
} from "lucide-react";
import { useClub } from "@/context/club-context";
import { useAuth } from "@/context/auth-context";
import { supabase } from "@/lib/supabase";
import { formatPlayerName, isFormerPlayer } from "@/lib/utils";
import { parseStatTextString } from "@/lib/match-stats-sync";
import { resolveFixtureKickoffTime } from "@/lib/whatsapp-utils";

type StandingsRow = {
    position: number;
    team_name: string;
    played: number;
    won: number;
    drawn: number;
    lost: number;
    goals_for?: number;
    goals_against?: number;
    goal_difference: number;
    points: number;
    is_our_club?: boolean;
};

export default function DashboardPage() {
    const { settings, updateSettings } = useClub();
    const { clubId } = useAuth();

    const [matches, setMatches] = useState<(Match & { rawNotes?: string; motm?: string })[]>([]);
    const [players, setPlayers] = useState<Player[]>([]);
    const [matchPlayerStats, setMatchPlayerStats] = useState<any[]>([]);
    const [nextMatch, setNextMatch] = useState<(Match & { rawNotes?: string }) | null>(null);
    const [isSyncing, setIsSyncing] = useState(false);
    const [timeLeft, setTimeLeft] = useState<{ days: number; hours: number; minutes: number } | null>(null);

    const [trainingSessions, setTrainingSessions] = useState<any[]>([]);
    const [paymentRequests, setPaymentRequests] = useState<any[]>([]);
    const [dismissedPriorities, setDismissedPriorities] = useState<string[]>([]);
    const [standingsTable, setStandingsTable] = useState<StandingsRow[]>([]);
    const [hasLeagueTeamsInDb, setHasLeagueTeamsInDb] = useState<boolean>(false);
    const [isInitialLoaded, setIsInitialLoaded] = useState<boolean>(false);
    const [copiedWhatsApp, setCopiedWhatsApp] = useState<"match" | "training" | null>(null);
    const [hideSetupChecklist, setHideSetupChecklist] = useState<boolean>(false);

    useEffect(() => {
        if (typeof window === "undefined") return;
        const key = clubId ? `clubflow_setup_checklist_dismissed_${clubId}` : "clubflow_setup_checklist_dismissed";
        if (localStorage.getItem(key) === "true") {
            setHideSetupChecklist(true);
        }
    }, [clubId]);

    const handleDismissSetupChecklist = () => {
        setHideSetupChecklist(true);
        if (typeof window !== "undefined") {
            const key = clubId ? `clubflow_setup_checklist_dismissed_${clubId}` : "clubflow_setup_checklist_dismissed";
            localStorage.setItem(key, "true");
        }
    };

    // Load standings table from localStorage, settings, or Supabase LEAGUE_TABLE_CACHE
    useEffect(() => {
        if (typeof window === "undefined") return;
        const normalizeRows = (rows: any[]): StandingsRow[] =>
            rows
                .filter((r) => r && (r.team_name || r.team))
                .map((r, idx) => ({
                    position: Number(r.position ?? r.pos ?? idx + 1),
                    team_name: String(r.team_name || r.team || "Club"),
                    played: Number(r.played ?? 0),
                    won: Number(r.won ?? 0),
                    drawn: Number(r.drawn ?? 0),
                    lost: Number(r.lost ?? 0),
                    goals_for: Number(r.goals_for ?? r.gf ?? 0),
                    goals_against: Number(r.goals_against ?? r.ga ?? 0),
                    goal_difference: Number(r.goal_difference ?? r.gd ?? 0),
                    points: Number(r.points ?? r.pts ?? 0),
                    is_our_club: Boolean(r.is_our_club),
                }));

        const loadStandings = async () => {
            if (!clubId) {
                setStandingsTable([]);
                return;
            }
            try {
                const scopedKey = `clubflow_league_table_${clubId}`;
                const raw = localStorage.getItem(scopedKey);
                if (raw) {
                    const parsed = JSON.parse(raw);
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        const normalized = normalizeRows(parsed);
                        if (normalized.length > 0) {
                            setStandingsTable(normalized);
                            return;
                        }
                    }
                }
                if (
                    settings.lastImportHistory?.leagueTable &&
                    Array.isArray(settings.lastImportHistory.leagueTable) &&
                    settings.lastImportHistory.leagueTable.length > 0
                ) {
                    const normalized = normalizeRows(settings.lastImportHistory.leagueTable);
                    if (normalized.length > 0) {
                        setStandingsTable(normalized);
                        localStorage.setItem(scopedKey, JSON.stringify(normalized));
                        return;
                    }
                }

                // Fallback 1: Check Supabase documents for LEAGUE_TABLE_CACHE
                let docQuery = supabase
                    .from("documents")
                    .select("url")
                    .eq("category", "LEAGUE_TABLE_CACHE");
                if (clubId) {
                    docQuery = docQuery.eq("club_id", clubId);
                }
                const { data: docData } = await docQuery.maybeSingle();
                if (docData?.url) {
                    const parsedDoc = JSON.parse(docData.url);
                    const rows = Array.isArray(parsedDoc)
                        ? parsedDoc
                        : Array.isArray(parsedDoc?.standings)
                        ? parsedDoc.standings
                        : [];
                    if (rows.length > 0) {
                        const normalized = normalizeRows(rows);
                        if (normalized.length > 0) {
                            setStandingsTable(normalized);
                            localStorage.setItem(scopedKey, JSON.stringify(normalized));
                            return;
                        }
                    }
                }

                // Fallback 2: Check if league_teams have already been populated in Supabase
                let teamsQuery = supabase
                    .from("league_teams")
                    .select("id", { count: "exact", head: true });
                if (clubId) {
                    teamsQuery = teamsQuery.eq("club_id", clubId);
                }
                const { count } = await teamsQuery;
                if ((count || 0) > 0) {
                    setHasLeagueTeamsInDb(true);
                }
            } catch (e) {
                // Ignore parse error
            }
        };
        loadStandings();
    }, [clubId, settings.lastImportHistory]);

    useEffect(() => {
        fetchData();

        if (typeof window !== "undefined") {
            const today = new Date().toISOString().split("T")[0];
            const priorityKey = clubId
                ? `clubflow_dismissed_priorities_${clubId}_${today}`
                : `clubflow_dismissed_priorities_${today}`;
            const saved = localStorage.getItem(priorityKey);
            if (saved) {
                try {
                    setDismissedPriorities(JSON.parse(saved));
                } catch (e) {}
            } else {
                setDismissedPriorities([]);
            }
        }

        const channels = [
            supabase.channel('dashboard:matches').on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, fetchMatches),
            supabase.channel('dashboard:players').on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, fetchSquad),
            supabase.channel('dashboard:match_stats').on('postgres_changes', { event: '*', schema: 'public', table: 'match_player_stats' }, fetchMatchPlayerStats),
            supabase.channel('dashboard:training').on('postgres_changes', { event: '*', schema: 'public', table: 'training_sessions' }, fetchTrainingSessions)
        ];

        channels.forEach(channel => channel.subscribe());

        return () => {
            channels.forEach(channel => supabase.removeChannel(channel));
        };
    }, []);

    useEffect(() => {
        if (!nextMatch) return;
        const calculateTimeLeft = () => {
            const ko = resolveFixtureKickoffTime(nextMatch.date, nextMatch.time);
            const matchDateTime = new Date(`${nextMatch.date}T${ko}:00`);
            const difference = matchDateTime.getTime() - new Date().getTime();
            if (difference <= 0) {
                setTimeLeft(null);
                return;
            }
            setTimeLeft({
                days: Math.floor(difference / (1000 * 60 * 60 * 24)),
                hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
                minutes: Math.floor((difference / 1000 / 60) % 60)
            });
        };
        calculateTimeLeft();
        const timer = setInterval(calculateTimeLeft, 30000);
        return () => clearInterval(timer);
    }, [nextMatch]);

    const fetchData = async () => {
        await Promise.allSettled([
            fetchMatches(),
            fetchSquad(),
            fetchMatchPlayerStats(),
            fetchTrainingSessions(),
            fetchPaymentRequests(),
        ]);
        setIsInitialLoaded(true);
    };

    const fetchMatchPlayerStats = async () => {
        const { data } = await supabase.from('match_player_stats').select('*');
        if (data) setMatchPlayerStats(data);
    };

    const fetchTrainingSessions = async () => {
        const { data } = await supabase.from('training_sessions').select('*');
        if (data) setTrainingSessions(data);
    };

    const fetchPaymentRequests = async () => {
        const { data } = await supabase.from('player_payment_requests').select('*');
        if (data) setPaymentRequests(data);
    };

    const fetchMatches = async () => {
        const { data } = await supabase.from('matches').select('*');
        if (data) {
            const loadedMatches = data.map((m: any) => {
                const rawNotes = m.notes || "";
                const locationMatch = rawNotes.match(/\[Location: (.*?)\]/);
                const location = locationMatch ? locationMatch[1] : "";

                const surfaceMatch = rawNotes.match(/\[Surface: (.*?)\]/);
                const surface = surfaceMatch ? surfaceMatch[1] : "4G";

                const motmMatch = rawNotes.match(/\[MOTM:\s*(.*?)\]/i);
                const motm = motmMatch ? motmMatch[1].trim() : undefined;

                let cleanNotes = rawNotes;
                if (cleanNotes.includes("[Lineup: ")) {
                    const endIdx = cleanNotes.indexOf("}]");
                    if (endIdx !== -1) {
                        cleanNotes = cleanNotes.substring(endIdx + 2);
                    }
                }
                cleanNotes = cleanNotes
                    .replace(/\[Location: .*?\]\n?/g, "")
                    .replace(/\[Surface: .*?\]\n?/g, "")
                    .replace(/\[MOTM:.*?\]\n?/gi, "")
                    .trim();

                const normalizedTime = resolveFixtureKickoffTime(m.date, m.time);
                if (normalizedTime !== (m.time || "").trim().slice(0, 5)) {
                    supabase.from('matches').update({ time: normalizedTime }).eq('id', m.id).then(() => {});
                }

                return {
                    id: m.id,
                    date: m.date,
                    time: normalizedTime,
                    opponent: m.opponent,
                    isHome: m.is_home,
                    competition: m.competition,
                    scoreline: m.scoreline,
                    result: m.result,
                    goalscorers: m.goalscorers,
                    assists: m.assists,
                    notes: cleanNotes,
                    rawNotes,
                    motm,
                    surface,
                    location
                };
            });
            setMatches(loadedMatches);

            const todayStr = new Date().toISOString().split("T")[0];
            const upcoming = loadedMatches
                .filter(m => m.result === "Pending" && m.date >= todayStr)
                .sort((a, b) => a.date.localeCompare(b.date));

            setNextMatch(upcoming[0] || null);
        }
    };

    const fetchSquad = async () => {
        const { data } = await supabase
            .from('players')
            .select('id, first_name, last_name, position, squad, image_url, date_of_birth, appearances, goals, assists, nickname, use_nickname, medical_status, is_contracted, contract_end_date, weight, height, notes');

        if (data) {
            const filteredPlayers = data.filter((p: any) => !isFormerPlayer(p));

            const mapped: Player[] = filteredPlayers.map((p: any) => {
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
                    availability: (p.medical_status || "Available") === "Available",
                    appearances: p.appearances || 0,
                    goals: p.goals || 0,
                    assists: p.assists || 0,
                    nickname: p.nickname || "",
                    useNickname: p.use_nickname || false,
                    imageUrl: p.image_url,
                    injuryType,
                    injuryDuration,
                    suspensionReason,
                    suspensionDuration
                };
            });
            setPlayers(mapped);
        }
    };

    const syncLeague = async () => {
        if (!settings.leagueUrl) return;
        setIsSyncing(true);
        try {
            const res = await fetch('/api/sync-league', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: settings.leagueUrl, clubName: settings.name })
            });
            const data = await res.json();
            if (data.success) {
                if (Array.isArray(data.standings) && data.standings.length > 0) {
                    setStandingsTable(data.standings);
                    const tableJson = JSON.stringify(data.standings);
                    if (clubId) {
                        localStorage.setItem(`clubflow_league_table_${clubId}`, tableJson);
                    }
                    await updateSettings({
                        leaguePosition: data.position || settings.leaguePosition,
                        lastImportHistory: {
                            ...(settings.lastImportHistory || {}),
                            leagueTable: data.standings,
                            leagueTableSyncedAt: new Date().toISOString()
                        }
                    });
                } else if (data.position) {
                    await updateSettings({ leaguePosition: data.position });
                }
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsSyncing(false);
        }
    };

    // Helper: Fuzzy match team name against league standings to get #position
    const getTeamLeaguePos = (teamName?: string): number | null => {
        if (!teamName || standingsTable.length === 0) return null;
        const clean = (s: string) =>
            (s || "")
                .toLowerCase()
                .replace(/\b(fc|afc|united|utd|city|town|athletic|ath|rovers|wanderers|albion|sc|1st|first|xi|reserves|res)\b/gi, "")
                .replace(/[^a-z0-9]/g, "")
                .trim();
        const target = clean(teamName);
        if (!target) return null;
        const exact = standingsTable.find(r => (r.team_name || "").toLowerCase().trim() === teamName.toLowerCase().trim());
        if (exact) return exact.position;
        const fuzzy = standingsTable.find(r => {
            const c = clean(r.team_name || "");
            return c && (c === target || c.includes(target) || target.includes(c));
        });
        return fuzzy ? fuzzy.position : null;
    };

    const formatDate = (dateStr?: string) => {
        if (!dateStr) return "";
        return new Date(dateStr + "T12:00:00").toLocaleDateString("en-GB", {
            weekday: "short",
            day: "numeric",
            month: "short"
        });
    };

    const ordinal = (pos: number) => {
        const j = pos % 10, k = pos % 100;
        if (j === 1 && k !== 11) return `${pos}st`;
        if (j === 2 && k !== 12) return `${pos}nd`;
        if (j === 3 && k !== 13) return `${pos}rd`;
        return `${pos}th`;
    };

    const ourStandingsRow = useMemo(() => {
        return standingsTable.find(r => r.is_our_club) ||
            (settings.name ? standingsTable.find(r => (r.team_name || "").toLowerCase().includes(settings.name.toLowerCase())) : undefined);
    }, [standingsTable, settings.name]);

    const currentPosNumber = ourStandingsRow?.position || settings.leaguePosition || null;
    const displayLeaguePosition = currentPosNumber ? ordinal(currentPosNumber) : "Unranked";

    // 3-Row Mini League Table Slice around our club
    const miniTableRows = useMemo(() => {
        if (standingsTable.length === 0) return [];
        const sorted = [...standingsTable].sort((a, b) => a.position - b.position);
        const ourIdx = sorted.findIndex(r => r.is_our_club || (settings.name && (r.team_name || "").toLowerCase().includes(settings.name.toLowerCase())));
        if (ourIdx <= 0) return sorted.slice(0, 3);
        if (ourIdx >= sorted.length - 1) return sorted.slice(Math.max(0, sorted.length - 3));
        return sorted.slice(ourIdx - 1, ourIdx + 2);
    }, [standingsTable, settings.name]);

    // Availability & Unavailable Players (#2)
    const availablePlayers = players.filter(p => (p.medicalStatus || "Available") === "Available");
    const injuredPlayers = players.filter(p => p.medicalStatus === "Injured" || p.medicalStatus === "Doubtful");
    const suspendedPlayers = players.filter(p => p.medicalStatus === "Suspended");
    const holidayPlayers = players.filter(p => p.medicalStatus === "Holiday");
    const unavailablePlayers = [...injuredPlayers, ...suspendedPlayers, ...holidayPlayers];

    // Completed competitive matches + Home/Away Split (#4 + Addition #4)
    const completedMatches = useMemo(() => {
        return matches
            .filter(m => {
                if (!m.result || m.result === "Pending") return false;
                const comp = (m.competition || "").toLowerCase();
                return !comp.includes("friendly") && !comp.includes("pre-season") && !comp.includes("trial");
            })
            .sort((a, b) => b.date.localeCompare(a.date));
    }, [matches]);

    const lastMatch = useMemo(() => {
        const allCompleted = matches
            .filter(m => m.result && m.result !== "Pending")
            .sort((a, b) => b.date.localeCompare(a.date));
        return allCompleted[0] || null;
    }, [matches]);

    const homeAwayStats = useMemo(() => {
        const calc = (list: typeof completedMatches) => {
            const p = list.length;
            const w = list.filter(m => m.result === "Win").length;
            const d = list.filter(m => m.result === "Draw").length;
            const l = p - w - d;
            const pts = w * 3 + d;
            const ppg = p > 0 ? (pts / p).toFixed(2) : "0.00";
            return { p, w, d, l, pts, ppg };
        };
        return {
            overall: calc(completedMatches),
            home: calc(completedMatches.filter(m => m.isHome)),
            away: calc(completedMatches.filter(m => !m.isHome))
        };
    }, [completedMatches]);

    // Recent 5 Form (chronological left-to-right)
    const recentForm = useMemo(() => {
        return [...completedMatches].slice(0, 5).reverse();
    }, [completedMatches]);

    // Next Training Session
    const nextTrainingSession = useMemo(() => {
        const todayStr = new Date().toISOString().split('T')[0];
        const upcoming = trainingSessions
            .filter(s => s.date >= todayStr)
            .sort((a, b) => a.date.localeCompare(b.date));
        return upcoming[0] || null;
    }, [trainingSessions]);

    // Season Leaderboards (#3): Top Scorer, Top Assists, Most MOTM (or G+A), Top Training Attendance %
    const leaderboards = useMemo(() => {
        // Build match lookup map (exclude friendlies/trials unless no competitive matches exist)
        const competitiveMatchIds = new Set<string>();
        const allMatchIds = new Set<string>();
        matches.forEach(m => {
            allMatchIds.add(m.id);
            const comp = (m.competition || "").toLowerCase();
            if (!comp.includes("friendly") && !comp.includes("pre-season") && !comp.includes("trial")) {
                competitiveMatchIds.add(m.id);
            }
        });
        const validMatchIds = competitiveMatchIds.size > 0 ? competitiveMatchIds : allMatchIds;

        // Track per-player stats aggregated across valid matches
        const statTotals = new Map<string, { goals: number; assists: number; apps: number }>();
        const matchesWithDbGoals = new Set<string>();
        const matchesWithDbAssists = new Set<string>();

        matchPlayerStats.forEach((s: any) => {
            if (!validMatchIds.has(s.match_id)) return;
            const cur = statTotals.get(s.player_id) || { goals: 0, assists: 0, apps: 0 };
            if (s.participation_type !== "UNUSED_SUB") {
                cur.apps += 1;
            }
            const g = Number(s.goals || 0);
            const a = Number(s.assists || 0);
            if (g > 0) matchesWithDbGoals.add(s.match_id);
            if (a > 0) matchesWithDbAssists.add(s.match_id);
            cur.goals += g;
            cur.assists += a;
            statTotals.set(s.player_id, cur);
        });

        // Also parse m.goalscorers and m.assists text strings for any match where match_player_stats didn't record them
        const simpleRefs = players.map(p => ({
            id: p.id,
            firstName: p.firstName,
            lastName: p.lastName,
            nickname: p.nickname,
            useNickname: p.useNickname
        }));

        matches.forEach(m => {
            if (!validMatchIds.has(m.id)) return;
            if (m.goalscorers && !matchesWithDbGoals.has(m.id)) {
                const parsedGoals = parseStatTextString(m.goalscorers, simpleRefs);
                parsedGoals.forEach(token => {
                    if (token.playerId) {
                        const cur = statTotals.get(token.playerId) || { goals: 0, assists: 0, apps: 0 };
                        cur.goals += token.count;
                        statTotals.set(token.playerId, cur);
                    }
                });
            }
            if (m.assists && !matchesWithDbAssists.has(m.id)) {
                const parsedAssists = parseStatTextString(m.assists, simpleRefs);
                parsedAssists.forEach(token => {
                    if (token.playerId) {
                        const cur = statTotals.get(token.playerId) || { goals: 0, assists: 0, apps: 0 };
                        cur.assists += token.count;
                        statTotals.set(token.playerId, cur);
                    }
                });
            }
        });

        const enrichedPlayers = players.map(p => {
            const st = statTotals.get(p.id);
            return {
                ...p,
                goals: st ? st.goals : (p.goals || 0),
                assists: st ? st.assists : (p.assists || 0),
                appearances: st ? st.apps : (p.appearances || 0)
            };
        });

        const topScorers = [...enrichedPlayers]
            .filter(p => (p.goals || 0) > 0)
            .sort((a, b) => (b.goals || 0) - (a.goals || 0) || (a.appearances || 0) - (b.appearances || 0));

        const topAssisters = [...enrichedPlayers]
            .filter(p => (p.assists || 0) > 0)
            .sort((a, b) => (b.assists || 0) - (a.assists || 0) || (a.appearances || 0) - (b.appearances || 0));

        const topContributors = [...enrichedPlayers]
            .map(p => ({ ...p, totalGA: (p.goals || 0) + (p.assists || 0) }))
            .filter(p => p.totalGA > 0)
            .sort((a, b) => b.totalGA - a.totalGA || (b.goals || 0) - (a.goals || 0));

        // Count MOTM from match notes [MOTM: ...]
        const motmCounts: Record<string, number> = {};
        matches.forEach(m => {
            if (m.motm) {
                motmCounts[m.motm] = (motmCounts[m.motm] || 0) + 1;
            }
        });
        const motmSorted = Object.entries(motmCounts).sort((a, b) => b[1] - a[1]);

        // Calculate per-player training attendance %
        const playerTrainingStats: { name: string; present: number; total: number; rate: number }[] = [];
        const sessionsWithAttendance = trainingSessions.filter(s => Array.isArray(s.attendance) && s.attendance.length > 0);
        if (sessionsWithAttendance.length > 0) {
            players.forEach(p => {
                let present = 0;
                let total = 0;
                sessionsWithAttendance.forEach(s => {
                    const rec = s.attendance.find((a: any) => a.player_id === p.id || a.playerId === p.id);
                    if (rec) {
                        total++;
                        if (rec.status === "Present" || rec.status === "Late") present++;
                    }
                });
                if (total > 0) {
                    playerTrainingStats.push({
                        name: formatPlayerName(p),
                        present,
                        total,
                        rate: Math.round((present / total) * 100)
                    });
                }
            });
            playerTrainingStats.sort((a, b) => b.rate - a.rate || b.present - a.present);
        }

        // Team average training attendance
        let teamTotalRates = 0;
        let teamSessionCount = 0;
        sessionsWithAttendance.forEach(s => {
            const pres = s.attendance.filter((a: any) => a.status === "Present" || a.status === "Late").length;
            teamTotalRates += (pres / s.attendance.length) * 100;
            teamSessionCount++;
        });
        const teamAvgAttendance = teamSessionCount > 0 ? Math.round(teamTotalRates / teamSessionCount) : 0;

        return {
            topScorer: topScorers[0] || null,
            secondScorer: topScorers[1] || null,
            topAssister: topAssisters[0] || null,
            secondAssister: topAssisters[1] || null,
            topContributor: topContributors[0] || null,
            secondContributor: topContributors[1] || null,
            topMotm: motmSorted[0] ? { name: motmSorted[0][0], count: motmSorted[0][1] } : null,
            secondMotm: motmSorted[1] ? { name: motmSorted[1][0], count: motmSorted[1][1] } : null,
            topTrainingPlayer: playerTrainingStats[0] || null,
            teamAvgAttendance
        };
    }, [players, matches, matchPlayerStats, trainingSessions]);

    // Needs Attention / Action Items (#1)
    const todayStr = new Date().toISOString().split("T")[0];
    const overduePendingMatches = matches.filter(m => m.result === "Pending" && m.date < todayStr);
    const outstandingInvoices = paymentRequests.filter(r => r.status === "Unpaid" || r.status === "unpaid" || r.status === "Overdue");
    const totalOutstandingAmount = outstandingInvoices.reduce((sum, r) => sum + (r.amount || 0), 0);

    const handleDismissPriority = (id: string) => {
        const updated = [...dismissedPriorities, id];
        setDismissedPriorities(updated);
        const priorityKey = clubId
            ? `clubflow_dismissed_priorities_${clubId}_${todayStr}`
            : `clubflow_dismissed_priorities_${todayStr}`;
        localStorage.setItem(priorityKey, JSON.stringify(updated));
    };

    const isLeagueConnected =
        standingsTable.length > 0 ||
        hasLeagueTeamsInDb ||
        Boolean(settings.leagueUrl) ||
        Boolean(settings.leaguePosition && String(settings.leaguePosition) !== "N/A");

    const actionItems = useMemo(() => {
        const items: { id: string; label: string; sub: string; href: string; tone: "amber" | "rose" | "brand" }[] = [];

        if (overduePendingMatches.length > 0) {
            const latestOverdue = overduePendingMatches[0];
            items.push({
                id: `overdue_${latestOverdue.id}`,
                label: `Log result vs ${latestOverdue.opponent}`,
                sub: `Played ${formatDate(latestOverdue.date)} • Result still marked Pending`,
                href: "/matches",
                tone: "amber"
            });
        }

        if (nextMatch) {
            const hasSavedLineup = nextMatch.rawNotes?.includes("[Lineup: ");
            if (!hasSavedLineup) {
                items.push({
                    id: `xi_${nextMatch.id}`,
                    label: `Open Matchday Planner vs ${nextMatch.opponent}`,
                    sub: `${formatDate(nextMatch.date)} (${nextMatch.isHome ? "Home" : "Away"})`,
                    href: "/matchday-xi",
                    tone: "brand"
                });
            }
        }

        if (unavailablePlayers.length > 0) {
            items.push({
                id: "unavailable_players",
                label: `${unavailablePlayers.length} player${unavailablePlayers.length === 1 ? "" : "s"} unavailable for selection`,
                sub: `${injuredPlayers.length} injured/doubtful • ${suspendedPlayers.length} suspended • ${holidayPlayers.length} away`,
                href: "/squad",
                tone: "rose"
            });
        }

        if (totalOutstandingAmount > 0) {
            items.push({
                id: "unpaid_subs",
                label: `£${totalOutstandingAmount} in unpaid player subs`,
                sub: `${outstandingInvoices.length} open payment request${outstandingInvoices.length === 1 ? "" : "s"}`,
                href: "/payments",
                tone: "amber"
            });
        }

        if (isInitialLoaded && !isLeagueConnected) {
            items.push({
                id: "connect_league",
                label: "Connect your League Table",
                sub: "Sync live standings & opposition league positions",
                href: "/league",
                tone: "brand"
            });
        }

        return items.filter(item => !dismissedPriorities.includes(item.id));
    }, [overduePendingMatches, nextMatch, unavailablePlayers.length, injuredPlayers.length, suspendedPlayers.length, holidayPlayers.length, totalOutstandingAmount, outstandingInvoices.length, isInitialLoaded, isLeagueConnected, dismissedPriorities]);

    // 1-Tap WhatsApp Copy Helpers (Addition #6)
    const copyMatchForWhatsApp = async () => {
        if (!nextMatch) return;
        const oppPos = getTeamLeaguePos(nextMatch.opponent);
        const text = [
            `⚽ *NEXT MATCH — ${(settings.name || "CAMDEN UNITED").toUpperCase()}*`,
            `🆚 *Opposition:* ${nextMatch.opponent}${oppPos ? ` (#${oppPos})` : ""} (${nextMatch.isHome ? "HOME" : "AWAY"})`,
            `🏆 *Competition:* ${nextMatch.competition || "League"}`,
            `📅 *Date:* ${formatDate(nextMatch.date)}`,
            `⏰ *Kick-Off:* ${nextMatch.time || "TBC"}`,
            nextMatch.location ? `📍 *Venue:* ${nextMatch.location} (${nextMatch.surface || "4G"})` : `📍 *Surface:* ${nextMatch.surface || "4G"}`,
            ``,
            `Please confirm your availability asap! 💪`
        ].join("\n");

        try {
            await navigator.clipboard.writeText(text);
            setCopiedWhatsApp("match");
            setTimeout(() => setCopiedWhatsApp(null), 2500);
        } catch (e) {}
    };

    const copyTrainingForWhatsApp = async () => {
        if (!nextTrainingSession) return;
        const text = [
            `🏃 *NEXT TRAINING — ${(settings.name || "CAMDEN UNITED").toUpperCase()}*`,
            `🎯 *Focus:* ${nextTrainingSession.focus || nextTrainingSession.topic || "Team Training Session"}`,
            `📅 *Date:* ${formatDate(nextTrainingSession.date)}`,
            `⏰ *Time:* ${nextTrainingSession.time || "TBC"}`,
            `📍 *Location:* ${nextTrainingSession.location || "Training Ground"}${nextTrainingSession.surface ? ` (${nextTrainingSession.surface})` : ""}`,
            ``,
            `Please make sure you arrive 15 mins early! 🔥`
        ].join("\n");

        try {
            await navigator.clipboard.writeText(text);
            setCopiedWhatsApp("training");
            setTimeout(() => setCopiedWhatsApp(null), 2500);
        } catch (e) {}
    };

    const nextOppPos = getTeamLeaguePos(nextMatch?.opponent);
    const lastOppPos = getTeamLeaguePos(lastMatch?.opponent);

    const setupChecklistSteps = [
        {
            id: "identity",
            label: "Club Badge & Kits",
            done: Boolean(settings.name && settings.name !== "My Club" && settings.logo),
            href: "/onboarding?rerun=1",
        },
        {
            id: "squad",
            label: "Build Squad (11+ Players)",
            done: players.length >= 11,
            href: "/squad",
        },
        {
            id: "fixtures",
            label: "Add Season Fixtures",
            done: matches.length > 0,
            href: "/matches",
        },
        {
            id: "league",
            label: "Sync League Table",
            done: isLeagueConnected,
            href: "/league",
        },
    ];
    const completedSetupCount = setupChecklistSteps.filter((s) => s.done).length;

    return (
        <div className="w-full max-w-full overflow-x-hidden min-w-0 pb-24 md:pb-12">
            <div className="max-w-7xl mx-auto flex flex-col gap-4 md:gap-6">

                {/* ========================================================= */}
                {/* POST-ONBOARDING CLUB SETUP CHECKLIST BANNER               */}
                {/* ========================================================= */}
                {isInitialLoaded && !hideSetupChecklist && completedSetupCount < 4 && (
                    <div className="bg-surface-1 border border-brand/30 rounded-2xl p-4 md:p-5 shadow-xs">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                            <div className="flex items-center gap-2.5">
                                <div className="h-9 w-9 rounded-xl bg-brand/15 border border-brand/30 flex items-center justify-center text-brand shrink-0">
                                    <Sparkles className="h-4 w-4" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h2 className="text-sm font-black text-foreground">
                                            Club Setup Checklist
                                        </h2>
                                        <Badge className="bg-brand/15 text-brand border-brand/30 text-[10px]">
                                            {completedSetupCount}/4 Complete
                                        </Badge>
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        Finish setting up your club data or launch the Onboarding Studio to bulk-paste your squad, fixtures & table.
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                <Link href="/onboarding?rerun=1">
                                    <Button size="sm" variant="outline" className="h-8 text-xs font-bold">
                                        Open Onboarding Studio
                                    </Button>
                                </Link>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={handleDismissSetupChecklist}
                                    className="h-8 text-xs text-muted-foreground hover:text-foreground"
                                >
                                    Dismiss
                                </Button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                            {setupChecklistSteps.map((step) => (
                                <Link
                                    key={step.id}
                                    href={step.href}
                                    className={`flex items-center justify-between p-2.5 rounded-xl border text-xs font-bold transition-all ${
                                        step.done
                                            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                                            : "bg-surface-2 border-border text-foreground hover:border-brand/40"
                                    }`}
                                >
                                    <span className="flex items-center gap-2 truncate">
                                        {step.done ? (
                                            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                                        ) : (
                                            <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                                        )}
                                        <span className="truncate">{step.label}</span>
                                    </span>
                                    <ArrowRight className="h-3.5 w-3.5 opacity-60 shrink-0" />
                                </Link>
                            ))}
                        </div>
                    </div>
                )}

                {/* ========================================================= */}
                {/* TOP HEADER: CLUB PULSE & HOME/AWAY SPLIT PILL             */}
                {/* ========================================================= */}
                <div className="bg-surface-1 border border-border rounded-2xl p-4 md:p-6 shadow-xs">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        {/* Club Identity + Standing + Recent Form */}
                        <div className="flex items-center gap-3.5 min-w-0">
                            {settings.logo ? (
                                <img src={settings.logo} alt={settings.name} className="h-12 w-12 md:h-14 md:w-14 object-contain shrink-0 rounded-xl bg-surface-2 p-1 border border-border" />
                            ) : (
                                <div className="h-12 w-12 md:h-14 md:w-14 rounded-xl bg-brand/10 border border-brand/20 flex items-center justify-center shrink-0">
                                    <Trophy className="h-6 w-6 text-brand" />
                                </div>
                            )}
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <h1 className="text-lg md:text-2xl font-black text-foreground tracking-tight truncate">
                                        {settings.name || "Camden United"}
                                    </h1>
                                    <Link
                                        href="/league"
                                        className="inline-flex items-center gap-1 rounded-full bg-brand/15 text-brand border border-brand/30 px-2.5 py-0.5 text-xs font-extrabold shrink-0 hover:bg-brand/20 transition-colors"
                                    >
                                        <Trophy className="h-3 w-3" />
                                        {displayLeaguePosition}
                                    </Link>
                                </div>

                                {/* Recent 5 Form Pills */}
                                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                        Form:
                                    </span>
                                    <div className="inline-flex items-center gap-1">
                                        {recentForm.length > 0 ? (
                                            recentForm.map(m => {
                                                const badgeStyle =
                                                    m.result === "Win"
                                                        ? "bg-emerald-500 text-white"
                                                        : m.result === "Draw"
                                                            ? "bg-amber-500 text-white"
                                                            : "bg-rose-500 text-white";
                                                return (
                                                    <span
                                                        key={m.id}
                                                        title={`${m.result} (${m.scoreline || ""}) vs ${m.opponent}`}
                                                        className={`inline-flex items-center justify-center w-5 h-5 rounded text-[10px] font-black ${badgeStyle}`}
                                                    >
                                                        {m.result?.[0]}
                                                    </span>
                                                );
                                            })
                                        ) : (
                                            <span className="text-xs text-muted-foreground">No competitive results yet</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Home vs Away Split Pill (Addition #4) */}
                        <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 pt-3 lg:pt-0 border-t lg:border-t-0 border-border">
                            <div className="flex items-center gap-2 bg-surface-2/80 border border-border rounded-xl px-3 py-2 min-w-0">
                                <div className="h-7 w-7 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
                                    <Home className="h-3.5 w-3.5" />
                                </div>
                                <div className="min-w-0">
                                    <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                        Home Split
                                    </div>
                                    <div className="text-xs font-extrabold text-foreground truncate">
                                        {homeAwayStats.home.w}W-{homeAwayStats.home.d}D-{homeAwayStats.home.l}L{" "}
                                        <span className="text-emerald-500 font-bold">({homeAwayStats.home.ppg} PPG)</span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 bg-surface-2/80 border border-border rounded-xl px-3 py-2 min-w-0">
                                <div className="h-7 w-7 rounded-lg bg-sky-500/10 text-sky-500 flex items-center justify-center shrink-0">
                                    <Plane className="h-3.5 w-3.5" />
                                </div>
                                <div className="min-w-0">
                                    <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                        Away Split
                                    </div>
                                    <div className="text-xs font-extrabold text-foreground truncate">
                                        {homeAwayStats.away.w}W-{homeAwayStats.away.d}D-{homeAwayStats.away.l}L{" "}
                                        <span className="text-sky-500 font-bold">({homeAwayStats.away.ppg} PPG)</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ========================================================= */}
                {/* #1: NEEDS ATTENTION / MANAGER'S TO-DO STRIP               */}
                {/* ========================================================= */}
                {actionItems.length > 0 && (
                    <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between px-0.5">
                            <span className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                                Needs Attention ({actionItems.length})
                            </span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                            {actionItems.map(item => {
                                const toneClasses =
                                    item.tone === "rose"
                                        ? "border-rose-500/30 bg-rose-500/5"
                                        : item.tone === "amber"
                                            ? "border-amber-500/30 bg-amber-500/5"
                                            : "border-brand/30 bg-brand/5";
                                return (
                                    <div
                                        key={item.id}
                                        className={`flex items-center justify-between gap-2.5 rounded-xl border p-3 transition-colors ${toneClasses}`}
                                    >
                                        <Link href={item.href} className="min-w-0 flex-1 group">
                                            <p className="text-xs font-bold text-foreground truncate group-hover:text-brand transition-colors">
                                                {item.label}
                                            </p>
                                            <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                                                {item.sub}
                                            </p>
                                        </Link>
                                        <div className="flex items-center gap-1 shrink-0">
                                            <Link
                                                href={item.href}
                                                className="h-7 px-2.5 rounded-lg bg-surface-1 border border-border text-[11px] font-bold text-foreground hover:border-brand/40 flex items-center gap-1"
                                            >
                                                Open <ArrowRight className="h-3 w-3" />
                                            </Link>
                                            <button
                                                type="button"
                                                onClick={() => handleDismissPriority(item.id)}
                                                title="Dismiss for today"
                                                className="h-7 w-7 rounded-lg bg-surface-1 border border-border text-muted-foreground hover:text-emerald-500 flex items-center justify-center"
                                            >
                                                <Check className="h-3.5 w-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* ========================================================= */}
                {/* MATCHDAY & TRAINING BRIEFING ROW (3 CARDS)                */}
                {/* Next Match + Next Training + Last Match Quick Recap       */}
                {/* ========================================================= */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

                    {/* CARD A: NEXT MATCH + WHATSAPP COPY */}
                    <Card className="border-border bg-surface-1 shadow-xs flex flex-col justify-between overflow-hidden">
                        <CardContent className="p-4 md:p-5 flex flex-col justify-between h-full gap-4">
                            <div>
                                <div className="flex items-center justify-between gap-2 mb-3">
                                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-brand flex items-center gap-1.5">
                                        <Zap className="h-3.5 w-3.5 fill-brand text-brand" />
                                        Next Match
                                    </span>
                                    {nextMatch && (
                                        <div className="flex items-center gap-1.5">
                                            {timeLeft && (
                                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand/10 text-brand border border-brand/20">
                                                    {timeLeft.days > 0 ? `${timeLeft.days}d ${timeLeft.hours}h` : `${timeLeft.hours}h ${timeLeft.minutes}m`}
                                                </span>
                                            )}
                                            <Badge variant="outline" className="text-[10px] font-bold px-2 py-0">
                                                {nextMatch.competition || "League"}
                                            </Badge>
                                        </div>
                                    )}
                                </div>

                                {nextMatch ? (
                                    <div className="space-y-2.5">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="text-xl md:text-2xl font-black text-foreground tracking-tight truncate">
                                                vs {nextMatch.opponent}
                                            </span>
                                            {nextOppPos && (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-extrabold bg-surface-2 border border-border text-muted-foreground">
                                                    #{nextOppPos}
                                                </span>
                                            )}
                                            <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md ${
                                                nextMatch.isHome
                                                    ? "bg-emerald-500/15 text-emerald-500 border border-emerald-500/30"
                                                    : "bg-sky-500/15 text-sky-500 border border-sky-500/30"
                                            }`}>
                                                {nextMatch.isHome ? "Home" : "Away"}
                                            </span>
                                        </div>

                                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground font-medium">
                                            <span className="inline-flex items-center gap-1.5">
                                                <Calendar className="h-3.5 w-3.5 text-brand" />
                                                {formatDate(nextMatch.date)}
                                            </span>
                                            <span className="inline-flex items-center gap-1.5">
                                                <Clock className="h-3.5 w-3.5 text-brand" />
                                                KO {nextMatch.time || "TBC"}
                                            </span>
                                            {nextMatch.location && (
                                                <span className="inline-flex items-center gap-1.5 truncate max-w-full">
                                                    <MapPin className="h-3.5 w-3.5 text-brand shrink-0" />
                                                    <span className="truncate">{nextMatch.location}</span>
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="py-6 text-center">
                                        <p className="text-sm font-semibold text-muted-foreground">No upcoming fixture scheduled</p>
                                        <Link href="/matches" className="text-xs font-bold text-brand hover:underline mt-1 inline-block">
                                            + Add Fixture
                                        </Link>
                                    </div>
                                )}
                            </div>

                            {nextMatch && (
                                <div className="space-y-2 pt-3 border-t border-border">
                                    <div className="grid grid-cols-2 gap-2">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={copyMatchForWhatsApp}
                                            className="h-8 text-xs font-semibold w-full truncate"
                                        >
                                            <Copy className="h-3.5 w-3.5 mr-1.5 shrink-0 text-emerald-500" />
                                            <span className="truncate">
                                                {copiedWhatsApp === "match" ? "Copied for WhatsApp!" : "WhatsApp Copy"}
                                            </span>
                                        </Button>
                                        <Link
                                            href="/matchday-xi"
                                            className="h-8 px-3 rounded-md bg-brand hover:bg-brand/90 text-white text-xs font-bold inline-flex items-center justify-center gap-1 transition-colors"
                                        >
                                            Matchday Planner <ArrowRight className="h-3.5 w-3.5" />
                                        </Link>
                                    </div>
                                    <Link
                                        href={`/opposition?team=${encodeURIComponent(nextMatch.opponent)}`}
                                        className="h-7 w-full px-3 rounded-md bg-surface-2 hover:bg-accent border border-border text-foreground text-[11px] font-bold inline-flex items-center justify-center gap-1.5 transition-colors"
                                    >
                                        📋 Opposition Scouting Report: {nextMatch.opponent}
                                    </Link>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* CARD B: NEXT TRAINING + WHATSAPP COPY */}
                    <Card className="border-border bg-surface-1 shadow-xs flex flex-col justify-between overflow-hidden">
                        <CardContent className="p-4 md:p-5 flex flex-col justify-between h-full gap-4">
                            <div>
                                <div className="flex items-center justify-between gap-2 mb-3">
                                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-500 flex items-center gap-1.5">
                                        <CalendarDays className="h-3.5 w-3.5" />
                                        Next Training
                                    </span>
                                    {nextTrainingSession && (
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                                            {nextTrainingSession.attendance?.filter((a: any) => a.status === "Present" || a.status === "Late").length || 0} Attending
                                        </span>
                                    )}
                                </div>

                                {nextTrainingSession ? (
                                    <div className="space-y-2.5">
                                        <div className="text-xl md:text-2xl font-black text-foreground tracking-tight truncate">
                                            {nextTrainingSession.focus || nextTrainingSession.topic || "Team Training"}
                                        </div>
                                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground font-medium">
                                            <span className="inline-flex items-center gap-1.5">
                                                <Calendar className="h-3.5 w-3.5 text-emerald-500" />
                                                {formatDate(nextTrainingSession.date)}
                                            </span>
                                            <span className="inline-flex items-center gap-1.5">
                                                <Clock className="h-3.5 w-3.5 text-emerald-500" />
                                                {nextTrainingSession.time || "TBC"}
                                            </span>
                                            <span className="inline-flex items-center gap-1.5 truncate max-w-full">
                                                <MapPin className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                                                <span className="truncate">{nextTrainingSession.location || "Training Ground"}</span>
                                            </span>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="py-6 text-center">
                                        <p className="text-sm font-semibold text-muted-foreground">No upcoming session scheduled</p>
                                        <Link href="/training" className="text-xs font-bold text-emerald-500 hover:underline mt-1 inline-block">
                                            + Schedule Training
                                        </Link>
                                    </div>
                                )}
                            </div>

                            {nextTrainingSession && (
                                <div className="grid grid-cols-2 gap-2 pt-3 border-t border-border">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={copyTrainingForWhatsApp}
                                        className="h-8 text-xs font-semibold w-full truncate"
                                    >
                                        <Copy className="h-3.5 w-3.5 mr-1.5 shrink-0 text-emerald-500" />
                                        <span className="truncate">
                                            {copiedWhatsApp === "training" ? "Copied for WhatsApp!" : "WhatsApp Copy"}
                                        </span>
                                    </Button>
                                    <Link
                                        href={`/training/${nextTrainingSession.id}`}
                                        className="h-8 px-3 rounded-md bg-surface-2 hover:bg-accent border border-border text-foreground text-xs font-bold inline-flex items-center justify-center gap-1 transition-colors"
                                    >
                                        Register <ArrowRight className="h-3.5 w-3.5" />
                                    </Link>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* CARD C: LAST MATCH QUICK RECAP (Addition #1) */}
                    <Card className="border-border bg-surface-1 shadow-xs flex flex-col justify-between overflow-hidden">
                        <CardContent className="p-4 md:p-5 flex flex-col justify-between h-full gap-4">
                            <div>
                                <div className="flex items-center justify-between gap-2 mb-3">
                                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                        <Award className="h-3.5 w-3.5 text-amber-500" />
                                        Last Match Recap
                                    </span>
                                    {lastMatch && (
                                        <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${
                                            lastMatch.result === "Win"
                                                ? "bg-emerald-500/15 text-emerald-500 border-emerald-500/30"
                                                : lastMatch.result === "Draw"
                                                    ? "bg-amber-500/15 text-amber-500 border-amber-500/30"
                                                    : "bg-rose-500/15 text-rose-500 border-rose-500/30"
                                        }`}>
                                            {lastMatch.result}
                                        </span>
                                    )}
                                </div>

                                {lastMatch ? (
                                    <div className="space-y-2">
                                        <div className="flex items-baseline justify-between gap-2">
                                            <div className="flex items-center gap-1.5 min-w-0">
                                                <span className="text-lg md:text-xl font-black text-foreground truncate">
                                                    vs {lastMatch.opponent}
                                                </span>
                                                {lastOppPos && (
                                                    <span className="text-[11px] font-extrabold px-1.5 py-0.5 rounded bg-surface-2 border border-border text-muted-foreground shrink-0">
                                                        #{lastOppPos}
                                                    </span>
                                                )}
                                            </div>
                                            <span className="text-xl md:text-2xl font-black text-foreground font-mono shrink-0">
                                                {lastMatch.scoreline || "—"}
                                            </span>
                                        </div>

                                        <div className="space-y-1 pt-1 text-xs">
                                            {lastMatch.goalscorers ? (
                                                <p className="text-muted-foreground truncate" title={lastMatch.goalscorers}>
                                                    ⚽ <strong className="text-foreground">Goals:</strong> {lastMatch.goalscorers}
                                                </p>
                                            ) : (
                                                <p className="text-muted-foreground text-[11px]">No goalscorers logged</p>
                                            )}
                                            {lastMatch.assists && (
                                                <p className="text-muted-foreground truncate" title={lastMatch.assists}>
                                                    👟 <strong className="text-foreground">Assists:</strong> {lastMatch.assists}
                                                </p>
                                            )}
                                            {lastMatch.motm && (
                                                <p className="text-amber-500 font-bold truncate">
                                                    ⭐ MOTM: {lastMatch.motm}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="py-6 text-center">
                                        <p className="text-sm font-semibold text-muted-foreground">No completed matches yet</p>
                                    </div>
                                )}
                            </div>

                            <div className="flex items-center justify-between pt-3 border-t border-border text-xs">
                                <span className="text-muted-foreground font-medium">
                                    {lastMatch ? formatDate(lastMatch.date) : ""}
                                </span>
                                <Link href="/matches" className="font-bold text-brand hover:underline inline-flex items-center gap-1">
                                    All Fixtures & Results <ArrowRight className="h-3.5 w-3.5" />
                                </Link>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* ========================================================= */}
                {/* #3: SEASON LEADERBOARDS AT A GLANCE                       */}
                {/* ========================================================= */}
                <div className="flex flex-col gap-2.5">
                    <div className="flex items-center justify-between px-0.5">
                        <h2 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                            <Flame className="h-3.5 w-3.5 text-brand" />
                            Season Leaderboards
                        </h2>
                        <Link href="/squad" className="text-xs font-bold text-brand hover:underline">
                            Full Squad Stats &rarr;
                        </Link>
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 md:gap-4">
                        {/* Top Goalscorer */}
                        <div className="min-w-0 overflow-hidden rounded-2xl border border-border bg-surface-1 p-3.5 md:p-4">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-brand truncate">
                                Top Goalscorer
                            </p>
                            {leaderboards.topScorer ? (
                                <>
                                    <div className="flex items-baseline justify-between gap-2 mt-1">
                                        <span className="text-sm md:text-base font-extrabold text-foreground truncate">
                                            {formatPlayerName(leaderboards.topScorer)}
                                        </span>
                                        <span className="text-xl md:text-2xl font-black text-brand shrink-0">
                                            {leaderboards.topScorer.goals}
                                        </span>
                                    </div>
                                    <p className="text-[11px] text-muted-foreground mt-1 truncate">
                                        {leaderboards.secondScorer
                                            ? `2nd: ${formatPlayerName(leaderboards.secondScorer)} (${leaderboards.secondScorer.goals})`
                                            : `${leaderboards.topScorer.appearances || 0} apps`}
                                    </p>
                                </>
                            ) : (
                                <p className="text-xs text-muted-foreground mt-2">No goals logged yet</p>
                            )}
                        </div>

                        {/* Most Assists */}
                        <div className="min-w-0 overflow-hidden rounded-2xl border border-border bg-surface-1 p-3.5 md:p-4">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-sky-500 truncate">
                                Most Assists
                            </p>
                            {leaderboards.topAssister ? (
                                <>
                                    <div className="flex items-baseline justify-between gap-2 mt-1">
                                        <span className="text-sm md:text-base font-extrabold text-foreground truncate">
                                            {formatPlayerName(leaderboards.topAssister)}
                                        </span>
                                        <span className="text-xl md:text-2xl font-black text-sky-500 shrink-0">
                                            {leaderboards.topAssister.assists}
                                        </span>
                                    </div>
                                    <p className="text-[11px] text-muted-foreground mt-1 truncate">
                                        {leaderboards.secondAssister
                                            ? `2nd: ${formatPlayerName(leaderboards.secondAssister)} (${leaderboards.secondAssister.assists})`
                                            : `${leaderboards.topAssister.appearances || 0} apps`}
                                    </p>
                                </>
                            ) : (
                                <p className="text-xs text-muted-foreground mt-2">No assists logged yet</p>
                            )}
                        </div>

                        {/* Most MOTMs or Most Goal Contributions (G+A) */}
                        <div className="min-w-0 overflow-hidden rounded-2xl border border-border bg-surface-1 p-3.5 md:p-4">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-amber-500 truncate">
                                {leaderboards.topMotm ? "Man of the Match" : "Goal Contributions (G+A)"}
                            </p>
                            {leaderboards.topMotm ? (
                                <>
                                    <div className="flex items-baseline justify-between gap-2 mt-1">
                                        <span className="text-sm md:text-base font-extrabold text-foreground truncate">
                                            {leaderboards.topMotm.name}
                                        </span>
                                        <span className="text-xl md:text-2xl font-black text-amber-500 shrink-0">
                                            {leaderboards.topMotm.count}
                                        </span>
                                    </div>
                                    <p className="text-[11px] text-muted-foreground mt-1 truncate">
                                        {leaderboards.secondMotm
                                            ? `2nd: ${leaderboards.secondMotm.name} (${leaderboards.secondMotm.count})`
                                            : "Season MOTM Leader"}
                                    </p>
                                </>
                            ) : leaderboards.topContributor ? (
                                <>
                                    <div className="flex items-baseline justify-between gap-2 mt-1">
                                        <span className="text-sm md:text-base font-extrabold text-foreground truncate">
                                            {formatPlayerName(leaderboards.topContributor)}
                                        </span>
                                        <span className="text-xl md:text-2xl font-black text-amber-500 shrink-0">
                                            {leaderboards.topContributor.totalGA}
                                        </span>
                                    </div>
                                    <p className="text-[11px] text-muted-foreground mt-1 truncate">
                                        {leaderboards.topContributor.goals}G + {leaderboards.topContributor.assists}A
                                        {leaderboards.secondContributor
                                            ? ` • 2nd: ${formatPlayerName(leaderboards.secondContributor)} (${leaderboards.secondContributor.totalGA})`
                                            : ""}
                                    </p>
                                </>
                            ) : (
                                <p className="text-xs text-muted-foreground mt-2">No contributions logged yet</p>
                            )}
                        </div>

                        {/* Highest Training Commitment */}
                        <div className="min-w-0 overflow-hidden rounded-2xl border border-border bg-surface-1 p-3.5 md:p-4">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-500 truncate">
                                Training Commitment
                            </p>
                            {leaderboards.topTrainingPlayer ? (
                                <>
                                    <div className="flex items-baseline justify-between gap-2 mt-1">
                                        <span className="text-sm md:text-base font-extrabold text-foreground truncate">
                                            {leaderboards.topTrainingPlayer.name}
                                        </span>
                                        <span className="text-xl md:text-2xl font-black text-emerald-500 shrink-0">
                                            {leaderboards.topTrainingPlayer.rate}%
                                        </span>
                                    </div>
                                    <p className="text-[11px] text-muted-foreground mt-1 truncate">
                                        Squad avg: <strong className="text-foreground">{leaderboards.teamAvgAttendance}%</strong> attendance
                                    </p>
                                </>
                            ) : (
                                <p className="text-xs text-muted-foreground mt-2">Take register in Training</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* ========================================================= */}
                {/* BOTTOM SPLIT: #4 (3-ROW MINI TABLE) & #2 (UNAVAILABLE)    */}
                {/* ========================================================= */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

                    {/* #4: 3-ROW MINI LEAGUE TABLE CONTEXT */}
                    <Card className="border-border bg-surface-1 shadow-xs overflow-hidden">
                        <CardContent className="p-4 md:p-5 flex flex-col justify-between h-full gap-3">
                            <div className="flex items-center justify-between gap-2">
                                <div>
                                    <h3 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                        <Trophy className="h-3.5 w-3.5 text-brand" />
                                        League Table Context
                                    </h3>
                                    <p className="text-[11px] text-muted-foreground mt-0.5">
                                        Immediate rivals around your current position
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    {settings.leagueUrl && (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            disabled={isSyncing}
                                            onClick={syncLeague}
                                            className="h-7 px-2 text-[11px]"
                                        >
                                            <RefreshCw className={`h-3 w-3 mr-1 ${isSyncing ? "animate-spin" : ""}`} />
                                            {isSyncing ? "Syncing" : "Sync"}
                                        </Button>
                                    )}
                                    <Link href="/league" className="text-xs font-bold text-brand hover:underline">
                                        Full Table &rarr;
                                    </Link>
                                </div>
                            </div>

                            {miniTableRows.length > 0 ? (
                                <div className="rounded-xl border border-border overflow-hidden">
                                    <table className="w-full text-xs text-left table-fixed">
                                        <thead className="bg-surface-2 text-[10px] uppercase text-muted-foreground border-b border-border">
                                            <tr>
                                                <th className="w-9 pl-3 py-2 font-bold">#</th>
                                                <th className="py-2 px-2 font-bold">Club</th>
                                                <th className="w-9 py-2 text-center font-bold">P</th>
                                                <th className="w-11 py-2 text-center font-bold">GD</th>
                                                <th className="w-11 pr-3 py-2 text-center font-bold text-foreground">Pts</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {miniTableRows.map((r, i) => {
                                                const isOurs = r.is_our_club || (settings.name && r.team_name.toLowerCase().includes(settings.name.toLowerCase()));
                                                return (
                                                    <tr
                                                        key={i}
                                                        className={`border-b last:border-b-0 border-border ${
                                                            isOurs ? "bg-brand/10 border-l-4 border-l-brand font-bold" : ""
                                                        }`}
                                                    >
                                                        <td className="pl-3 py-2.5 font-bold">{r.position}</td>
                                                        <td className={`py-2.5 px-2 truncate ${isOurs ? "text-brand font-extrabold" : "text-foreground font-medium"}`}>
                                                            {r.team_name}
                                                        </td>
                                                        <td className="py-2.5 text-center text-muted-foreground">{r.played}</td>
                                                        <td className={`py-2.5 text-center font-mono text-[11px] ${
                                                            r.goal_difference > 0 ? "text-emerald-500" : r.goal_difference < 0 ? "text-rose-500" : "text-muted-foreground"
                                                        }`}>
                                                            {r.goal_difference > 0 ? `+${r.goal_difference}` : r.goal_difference}
                                                        </td>
                                                        <td className="pr-3 py-2.5 text-center font-black text-foreground">{r.points}</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="rounded-xl border border-dashed border-border p-6 text-center">
                                    <p className="text-xs text-muted-foreground">No league standings connected yet.</p>
                                    <Link href="/league" className="text-xs font-bold text-brand hover:underline mt-1 inline-block">
                                        Connect League Table &rarr;
                                    </Link>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* #2: WHO'S UNAVAILABLE FOR NEXT MATCH */}
                    <Card className="border-border bg-surface-1 shadow-xs overflow-hidden">
                        <CardContent className="p-4 md:p-5 flex flex-col justify-between h-full gap-3">
                            <div className="flex items-center justify-between gap-2">
                                <div>
                                    <h3 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                        <HeartPulse className="h-3.5 w-3.5 text-rose-500" />
                                        Squad Availability & Absences
                                    </h3>
                                    <p className="text-[11px] text-muted-foreground mt-0.5">
                                        <strong className="text-emerald-500">{availablePlayers.length} Available</strong> • {injuredPlayers.length} Injured/Doubtful • {suspendedPlayers.length} Suspended • {holidayPlayers.length} Away
                                    </p>
                                </div>
                                <Link href="/squad" className="text-xs font-bold text-brand hover:underline shrink-0">
                                    Manage Squad &rarr;
                                </Link>
                            </div>

                            {unavailablePlayers.length > 0 ? (
                                <div className="flex flex-col gap-2 max-h-[190px] overflow-y-auto pr-0.5">
                                    {unavailablePlayers.map(p => {
                                        const statusTone =
                                            p.medicalStatus === "Suspended"
                                                ? "bg-amber-500/15 text-amber-500 border-amber-500/30"
                                                : p.medicalStatus === "Holiday"
                                                    ? "bg-sky-500/15 text-sky-500 border-sky-500/30"
                                                    : "bg-rose-500/15 text-rose-500 border-rose-500/30";
                                        const detail =
                                            p.medicalStatus === "Suspended"
                                                ? [p.suspensionReason, p.suspensionDuration].filter(Boolean).join(" • ")
                                                : [p.injuryType, p.injuryDuration].filter(Boolean).join(" • ");

                                        return (
                                            <Link
                                                key={p.id}
                                                href={`/squad/${p.id}`}
                                                className="flex items-center justify-between gap-2 rounded-xl border border-border bg-surface-2/50 hover:bg-surface-2 px-3 py-2 transition-colors min-w-0"
                                            >
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-surface-1 border border-border text-muted-foreground shrink-0">
                                                        {p.position}
                                                    </span>
                                                    <div className="min-w-0">
                                                        <p className="text-xs font-bold text-foreground truncate">
                                                            {formatPlayerName(p)}
                                                        </p>
                                                        {detail && (
                                                            <p className="text-[10px] text-muted-foreground truncate">
                                                                {detail}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${statusTone}`}>
                                                    {p.medicalStatus}
                                                </span>
                                            </Link>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5 flex items-center justify-center gap-2.5 text-center">
                                    <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                                    <span className="text-xs font-bold text-emerald-500">
                                        Full Squad Available — 0 Injuries, Suspensions, or Absences
                                    </span>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                </div>
            </div>
        </div>
    );
}
