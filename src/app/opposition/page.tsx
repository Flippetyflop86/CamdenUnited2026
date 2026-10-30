"use client";

import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
    FORMATIONS,
    FORMATION_NAMES,
    FORMATIONS_BY_FORMAT,
    DEFAULT_FORMATION_BY_FORMAT,
    FORMAT_ROMAN_LABEL,
    getFormatFromFormation,
    getDisplayPosition,
    MatchFormat
} from "@/lib/formations";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    Plus,
    Trash2,
    Edit2,
    Save,
    X,
    FileDown,
    Share2,
    History,
    ChevronRight,
    ChevronDown,
    ChevronUp,
    Target,
    ShieldAlert,
    Zap,
    Sparkles,
    Trophy,
    Swords,
    Flag,
    Users,
    Calendar,
    Clock,
    CheckCircle2,
    AlertTriangle,
    Search,
    Eye,
    EyeOff,
    ClipboardCheck,
    UserPlus
} from "lucide-react";
import { useClub } from "@/context/club-context";
import { useAuth } from "@/context/auth-context";
import { supabase } from "@/lib/supabase";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { resolveFixtureKickoffTime } from "@/lib/whatsapp-utils";
import { serializeRecruitForDb, normalizeRecruitPosition } from "@/lib/recruitment-utils";

interface DangerManItem {
    id: string;
    number: string;
    name: string;
    position: string;
    foot: string;
    strengths?: string;
    weaknesses?: string;
    notes: string;
}

interface PlayerProfileItem {
    positionIndex: number;
    role: string;
    foot: string;
    strengths?: string;
    weaknesses?: string;
    traits: string;
}

interface ScoutingReport {
    id: string;
    name: string;
    competition?: string;
    formation: string;
    inPossession: string;
    outOfPossession: string;
    transition: string;
    setPieces: string;
    strengths: string;
    weaknesses: string;
    dangerMen: string;
    dangerMenList: DangerManItem[];
    postMatchReview: string;
    generalNotes: string;
    playerProfiles: PlayerProfileItem[];
    lineup: string[];
    showPitch: boolean;
    createdAt: string;
    updatedAt: string;
}

export default function OppositionReportsPage() {
    const { settings } = useClub();
    const { clubId } = useAuth();
    const searchParams = useSearchParams();
    const queryTeamName = searchParams?.get("team") || "";

    const [reports, setReports] = useState<ScoutingReport[]>([]);
    const [selectedReport, setSelectedReport] = useState<ScoutingReport | null>(null);
    const [isEditing, setIsEditing] = useState<boolean>(false);
    const [editedReport, setEditedReport] = useState<ScoutingReport | null>(null);
    const [selectedProfileIndex, setSelectedProfileIndex] = useState<number | null>(null);

    const [matches, setMatches] = useState<any[]>([]);
    const [leagueRows, setLeagueRows] = useState<any[]>([]);
    const [teamSearch, setTeamSearch] = useState("");
    const [isGeneratingGraphic, setIsGeneratingGraphic] = useState(false);
    const [showPitchSection, setShowPitchSection] = useState(true);
    const [hasHandledQueryTeam, setHasHandledQueryTeam] = useState(false);
    const [mobileTab, setMobileTab] = useState<"all" | "threats" | "tactics" | "pitch" | "review">("all");
    const [showMobileDirectory, setShowMobileDirectory] = useState(false);

    // Helper: normalize team names so "Stonewall FC" matches "Stonewall"
    const normalizeTeamKey = (name: string): string =>
        (name || "")
            .toLowerCase()
            .replace(/\b(fc|afc|first|1st|reserves|united|utd)\b/g, (m) =>
                m === "utd" ? "united" : m === "fc" || m === "afc" || m === "first" || m === "1st" || m === "reserves" ? "" : m
            )
            .replace(/[^a-z0-9]/g, "")
            .trim();

    const isMatchingTeam = (a: string, b: string): boolean => {
        if (!a || !b) return false;
        const cleanA = a.toLowerCase().trim();
        const cleanB = b.toLowerCase().trim();
        if (cleanA === cleanB) return true;
        const normA = normalizeTeamKey(a);
        const normB = normalizeTeamKey(b);
        return normA.length >= 3 && normB.length >= 3 && (normA === normB || normA.includes(normB) || normB.includes(normA));
    };

    const createBlankReport = (prefillName = ""): ScoutingReport => ({
        id: "new",
        name: prefillName,
        competition: "",
        formation: "4-2-3-1",
        inPossession: "",
        outOfPossession: "",
        transition: "",
        setPieces: "",
        strengths: "",
        weaknesses: "",
        dangerMen: "",
        dangerMenList: [],
        postMatchReview: "",
        generalNotes: "",
        playerProfiles: [],
        lineup: [],
        showPitch: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    });

    // Parse raw DB row into structured ScoutingReport (preserving any legacy notes)
    const parseDbReport = (row: any): ScoutingReport => {
        const rawNotes = row.notes;
        let competition = "";
        let inPossession = "";
        let outOfPossession = "";
        let transition = "";
        let setPieces = "";
        let strengths = "";
        let weaknesses = "";
        let dangerMen = "";
        let dangerMenList: DangerManItem[] = [];
        let postMatchReview = "";
        let generalNotes = "";
        let playerProfiles: PlayerProfileItem[] = [];
        let showPitch = true;

        if (rawNotes) {
            if (typeof rawNotes === "string") {
                generalNotes = rawNotes;
            } else if (typeof rawNotes === "object") {
                competition = rawNotes.competition || "";
                inPossession = rawNotes.inPossession || rawNotes.buildUp || "";
                outOfPossession = rawNotes.outOfPossession || "";
                transition = rawNotes.transition || "";
                setPieces = rawNotes.setPieces || "";
                strengths = rawNotes.strengths || "";
                weaknesses = rawNotes.weaknesses || "";
                dangerMen = rawNotes.dangerMen || rawNotes.keyPersonnel || "";
                dangerMenList = Array.isArray(rawNotes.dangerMenList) ? rawNotes.dangerMenList : [];
                postMatchReview = rawNotes.postMatchReview || "";
                generalNotes = rawNotes.generalNotes || rawNotes.text || "";
                playerProfiles = Array.isArray(rawNotes.playerProfiles) ? rawNotes.playerProfiles : [];
                showPitch = rawNotes.showPitch !== undefined ? Boolean(rawNotes.showPitch) : true;
            }
        }

        const lineup = Array.isArray(row.lineup) ? row.lineup : [];

        return {
            id: row.id,
            name: row.name || "",
            competition,
            formation: row.formation || "4-2-3-1",
            inPossession,
            outOfPossession,
            transition,
            setPieces,
            strengths,
            weaknesses,
            dangerMen,
            dangerMenList,
            postMatchReview,
            generalNotes,
            playerProfiles,
            lineup,
            showPitch: true,
            createdAt: row.created_at || new Date().toISOString(),
            updatedAt: row.updated_at || new Date().toISOString()
        };
    };

    const fetchReports = async () => {
        const { data, error } = await supabase
            .from("opposition_teams")
            .select("*")
            .order("updated_at", { ascending: false });
        if (error) {
            console.error("Error fetching opposition reports:", error);
            return;
        }
        const mapped = (data || []).map(parseDbReport);
        setReports(mapped);

        if (mapped.length > 0 && !selectedReport && !editedReport) {
            setSelectedReport(mapped[0]);
            setShowPitchSection(true);
            setIsEditing(false);
        } else if (mapped.length === 0 && !editedReport) {
            const blank = createBlankReport();
            setEditedReport(blank);
            setShowPitchSection(true);
            setIsEditing(true);
        }
    };

    const fetchMatchesAndStandings = async () => {
        // 1. Fetch matches for H2H, Next Match banner, and Opponent directory
        let mQuery = supabase.from("matches").select("*").order("date", { ascending: false });
        if (clubId) mQuery = mQuery.eq("club_id", clubId);
        const { data: mData } = await mQuery;
        if (mData) {
            setMatches(
                mData.map((m: any) => ({
                    ...m,
                    isHome: m.is_home,
                    time: resolveFixtureKickoffTime(m.date, m.time)
                }))
            );
        }

        // 2. Load League Table rows (strictly scoped by clubId -> settings.lastImportHistory -> Supabase cache)
        let rows: any[] = [];
        try {
            if (clubId) {
                const localRaw = localStorage.getItem(`clubflow_league_table_${clubId}`);
                if (localRaw) {
                    const parsed = JSON.parse(localRaw);
                    if (Array.isArray(parsed) && parsed.length > 0) rows = parsed;
                }
            }
        } catch (e) {}

        if (rows.length === 0 && Array.isArray(settings.lastImportHistory?.leagueTable)) {
            rows = settings.lastImportHistory.leagueTable;
        }

        if (rows.length === 0) {
            try {
                let docQuery = supabase.from("documents").select("url").eq("category", "LEAGUE_TABLE_CACHE");
                if (clubId) docQuery = docQuery.eq("club_id", clubId);
                const { data: remoteDoc } = await docQuery.maybeSingle();
                if (remoteDoc?.url) {
                    const parsedPayload = JSON.parse(remoteDoc.url);
                    if (Array.isArray(parsedPayload?.teams)) rows = parsedPayload.teams;
                }
            } catch (e) {}
        }

        setLeagueRows(rows);
    };

    useEffect(() => {
        fetchReports();
        fetchMatchesAndStandings();

        const channel = supabase
            .channel("public:opposition_teams")
            .on("postgres_changes", { event: "*", schema: "public", table: "opposition_teams" }, () => fetchReports())
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [clubId]);

    // Handle ?team=OpponentName deep-link from Dashboard or Fixtures Next Match card (#5)
    useEffect(() => {
        if (!queryTeamName || hasHandledQueryTeam) return;
        // Wait until reports have been loaded or initialized
        const existing = reports.find((r) => isMatchingTeam(r.name, queryTeamName));
        if (existing) {
            setSelectedReport(existing);
            setEditedReport(null);
            setShowPitchSection(existing.showPitch);
            setIsEditing(false);
            setHasHandledQueryTeam(true);
        } else if (reports.length > 0 || isEditing) {
            const blank = createBlankReport(queryTeamName);
            setSelectedReport(null);
            setEditedReport(blank);
            setShowPitchSection(false);
            setIsEditing(true);
            setHasHandledQueryTeam(true);
        }
    }, [queryTeamName, reports, hasHandledQueryTeam]);

    // Next Scheduled Match (#1)
    const nextMatch = useMemo(() => {
        const todayStr = new Date().toISOString().split("T")[0];
        const upcoming = matches
            .filter((m) => m.result === "Pending" && m.date >= todayStr)
            .sort((a, b) => a.date.localeCompare(b.date));
        return upcoming[0] || null;
    }, [matches]);

    // Combined Directory of Known Opponents from League Table + Fixtures (#2)
    const knownOpponentsDirectory = useMemo(() => {
        const map = new Map<string, { name: string; position?: number; points?: number; form?: string }>();
        const ourName = settings.name || "ClubFlow";

        leagueRows.forEach((r: any) => {
            const tName = (r.team_name || r.name || "").trim();
            if (!tName || r.is_our_club || isMatchingTeam(tName, ourName)) return;
            const key = normalizeTeamKey(tName) || tName.toLowerCase();
            map.set(key, {
                name: tName,
                position: r.position,
                points: r.points,
                form: r.form
            });
        });

        matches.forEach((m: any) => {
            const opp = (m.opponent || "").trim();
            if (!opp || isMatchingTeam(opp, ourName)) return;
            const key = normalizeTeamKey(opp) || opp.toLowerCase();
            if (!map.has(key)) {
                // Check if fuzzy match exists
                let found = false;
                for (const existing of map.values()) {
                    if (isMatchingTeam(existing.name, opp)) {
                        found = true;
                        break;
                    }
                }
                if (!found) {
                    map.set(key, { name: opp });
                }
            }
        });

        return Array.from(map.values()).sort((a, b) => {
            if (a.position && b.position) return a.position - b.position;
            if (a.position) return -1;
            if (b.position) return 1;
            return a.name.localeCompare(b.name);
        });
    }, [leagueRows, matches, settings.name]);

    const activeReport: ScoutingReport = useMemo(() => {
        if (isEditing && editedReport) return editedReport;
        if (selectedReport) return selectedReport;
        return createBlankReport();
    }, [isEditing, editedReport, selectedReport]);

    // Find matching League Table stats for the currently viewed/edited opponent (#3)
    const activeLeagueStats = useMemo(() => {
        if (!activeReport.name.trim()) return null;
        return (
            leagueRows.find((r: any) =>
                isMatchingTeam(r.team_name || r.name || "", activeReport.name)
            ) || null
        );
    }, [activeReport.name, leagueRows]);

    // Find Head-to-Head (H2H) matches against the currently viewed/edited opponent (#4)
    const h2hData = useMemo(() => {
        if (!activeReport.name.trim()) {
            return { past: [], upcoming: [], wins: 0, draws: 0, losses: 0, gf: 0, ga: 0 };
        }
        const matched = matches.filter((m) => isMatchingTeam(m.opponent || "", activeReport.name));
        const past = matched
            .filter((m) => m.result && m.result !== "Pending")
            .sort((a, b) => b.date.localeCompare(a.date));
        const upcoming = matched
            .filter((m) => m.result === "Pending")
            .sort((a, b) => a.date.localeCompare(b.date));

        let wins = 0;
        let draws = 0;
        let losses = 0;
        let gf = 0;
        let ga = 0;

        past.forEach((m) => {
            if (m.result === "Win") wins++;
            else if (m.result === "Draw") draws++;
            else if (m.result === "Loss") losses++;

            if (m.scoreline && m.scoreline.includes("-")) {
                const [hStr, aStr] = m.scoreline.split("-");
                const h = parseInt(hStr.trim(), 10);
                const a = parseInt(aStr.trim(), 10);
                if (!isNaN(h) && !isNaN(a)) {
                    gf += m.isHome ? h : a;
                    ga += m.isHome ? a : h;
                }
            }
        });

        return { past, upcoming, wins, draws, losses, gf, ga };
    }, [activeReport.name, matches]);

    const activeFixture = useMemo(() => {
        return h2hData.upcoming[0] || h2hData.past[0] || null;
    }, [h2hData]);

    const ourClubName = (settings.name || "ClubFlow").trim();
    const oppClubName = (activeReport.name || "Opposition").trim();

    const activeFixtureTitle = useMemo(() => {
        if (!activeReport.name.trim()) return "Select an Opponent";
        if (activeFixture) {
            return activeFixture.isHome
                ? `${ourClubName} vs ${oppClubName}`
                : `${oppClubName} vs ${ourClubName}`;
        }
        return `${ourClubName} vs ${oppClubName}`;
    }, [activeFixture, ourClubName, oppClubName, activeReport.name]);

    const activeCompetitionLabel = useMemo(() => {
        const customComp = (activeReport.competition || "").trim();
        if (customComp) return customComp;
        const matchComp = (activeFixture?.competition || "").trim();
        if (matchComp) return matchComp;
        return "League Fixture";
    }, [activeReport.competition, activeFixture]);

    // Open or Start Report for any team name in 1 tap (#1 & #2)
    const handleOpenOrStartForTeam = (teamName: string) => {
        const existing = reports.find((r) => isMatchingTeam(r.name, teamName));
        if (existing) {
            setSelectedReport(existing);
            setEditedReport(null);
            setShowPitchSection(true);
            setIsEditing(false);
        } else {
            const blank = createBlankReport(teamName);
            setSelectedReport(null);
            setEditedReport(blank);
            setShowPitchSection(true);
            setIsEditing(true);
        }
    };

    const handleStartNewReport = () => {
        const blank = createBlankReport("");
        setSelectedReport(null);
        setEditedReport(blank);
        setShowPitchSection(true);
        setIsEditing(true);
    };

    const handleSelectReport = (report: ScoutingReport) => {
        setSelectedReport(report);
        setEditedReport(null);
        setShowPitchSection(true);
        setIsEditing(false);
    };

    const handleEditReport = () => {
        const base = (isEditing && editedReport) ? editedReport : (selectedReport || editedReport || createBlankReport());
        setEditedReport({
            ...base,
            dangerMenList: [...(base.dangerMenList || [])],
            playerProfiles: [...(base.playerProfiles || [])],
            lineup: [...(base.lineup || [])]
        });
        setIsEditing(true);
    };

    const handleOpenPositionProfile = (idx: number) => {
        if (!isEditing || !editedReport) {
            const base = selectedReport || editedReport || createBlankReport();
            setEditedReport({
                ...base,
                dangerMenList: [...(base.dangerMenList || [])],
                playerProfiles: [...(base.playerProfiles || [])],
                lineup: [...(base.lineup || [])]
            });
            setIsEditing(true);
        }
        setSelectedProfileIndex(idx);
    };

    const handleUpdateLineupName = (idx: number, value: string) => {
        const base = (isEditing && editedReport) ? editedReport : (selectedReport || editedReport || createBlankReport());
        const nextLineup = [...(base.lineup || [])];
        while (nextLineup.length <= idx) nextLineup.push("");
        nextLineup[idx] = value;
        setEditedReport({
            ...base,
            dangerMenList: [...(base.dangerMenList || [])],
            playerProfiles: [...(base.playerProfiles || [])],
            lineup: nextLineup
        });
        if (!isEditing) setIsEditing(true);
    };

    const handleUpdatePositionProfile = (idx: number, updates: Partial<PlayerProfileItem>) => {
        const base = (isEditing && editedReport) ? editedReport : (selectedReport || editedReport || createBlankReport());
        const profiles = [...(base.playerProfiles || [])];
        const existingIdx = profiles.findIndex((p) => p.positionIndex === idx);
        const currentProfile: PlayerProfileItem = existingIdx > -1
            ? profiles[existingIdx]
            : { positionIndex: idx, role: "", foot: "Right", traits: "" };
        const updatedProfile: PlayerProfileItem = { ...currentProfile, ...updates, positionIndex: idx };
        if (existingIdx > -1) profiles[existingIdx] = updatedProfile;
        else profiles.push(updatedProfile);
        setEditedReport({
            ...base,
            dangerMenList: [...(base.dangerMenList || [])],
            playerProfiles: profiles,
            lineup: [...(base.lineup || [])]
        });
        if (!isEditing) setIsEditing(true);
    };

    const handleSavePositionProfileModal = async () => {
        const current = editedReport || selectedReport;
        setSelectedProfileIndex(null);
        if (current && current.name && current.name.trim()) {
            await handleSaveReport();
        }
    };

    const handleCancelEdit = () => {
        if (selectedReport) {
            setIsEditing(false);
            setEditedReport(null);
            setShowPitchSection(true);
        } else if (reports.length > 0) {
            setSelectedReport(reports[0]);
            setEditedReport(null);
            setShowPitchSection(true);
            setIsEditing(false);
        } else {
            handleStartNewReport();
        }
    };

    const handleDeleteReport = async (id: string, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        if (!confirm("Delete this opposition scouting report?")) return;

        const remaining = reports.filter((r) => r.id !== id);
        setReports(remaining);
        if (selectedReport?.id === id) {
            if (remaining.length > 0) {
                setSelectedReport(remaining[0]);
                setIsEditing(false);
            } else {
                handleStartNewReport();
            }
        }

        const { error } = await supabase.from("opposition_teams").delete().eq("id", id);
        if (error) {
            alert("Failed to delete report: " + error.message);
            fetchReports();
        }
    };

    const handleSaveReport = async () => {
        if (!editedReport) return;
        if (!editedReport.name.trim()) {
            alert("Please enter the opposition team name.");
            return;
        }

        const isNew = editedReport.id === "new" || !editedReport.id.includes("-");
        const payload = {
            name: editedReport.name.trim(),
            formation: editedReport.formation || "4-2-3-1",
            notes: {
                competition: editedReport.competition || "",
                inPossession: editedReport.inPossession,
                outOfPossession: editedReport.outOfPossession,
                transition: editedReport.transition,
                setPieces: editedReport.setPieces,
                strengths: editedReport.strengths,
                weaknesses: editedReport.weaknesses,
                dangerMen: editedReport.dangerMen,
                dangerMenList: editedReport.dangerMenList || [],
                postMatchReview: editedReport.postMatchReview,
                generalNotes: editedReport.generalNotes,
                playerProfiles: editedReport.playerProfiles || [],
                showPitch: showPitchSection
            },
            lineup: editedReport.lineup || [],
            updated_at: new Date().toISOString()
        };

        try {
            if (isNew) {
                const { data, error } = await supabase
                    .from("opposition_teams")
                    .insert([payload])
                    .select()
                    .single();
                if (error) throw error;
                if (data) {
                    const saved = parseDbReport(data);
                    setSelectedReport(saved);
                    setReports((prev) => [saved, ...prev]);
                }
            } else {
                const { data, error } = await supabase
                    .from("opposition_teams")
                    .update(payload)
                    .eq("id", editedReport.id)
                    .select()
                    .single();
                if (error) throw error;
                const saved = data
                    ? parseDbReport(data)
                    : { ...editedReport, showPitch: showPitchSection, updatedAt: new Date().toISOString() };
                setSelectedReport(saved);
                setReports((prev) => prev.map((r) => (r.id === saved.id ? saved : r)));
            }

            setIsEditing(false);
            setEditedReport(null);
        } catch (err: any) {
            alert("Error saving scouting report: " + err.message);
        }
    };

    // Danger Men structured list helpers
    const handleAddDangerMan = () => {
        const base = isEditing && editedReport ? editedReport : selectedReport || createBlankReport();
        const newItem: DangerManItem = {
            id: Math.random().toString(36).substring(2, 9),
            number: "",
            name: "",
            position: "ST",
            foot: "Right",
            notes: ""
        };
        setEditedReport({
            ...base,
            dangerMenList: [...(base.dangerMenList || []), newItem],
            playerProfiles: [...(base.playerProfiles || [])],
            lineup: [...(base.lineup || [])]
        });
        setIsEditing(true);
    };

    const handleUpdateDangerMan = (id: string, field: keyof DangerManItem, value: string) => {
        if (!isEditing || !editedReport) return;
        setEditedReport({
            ...editedReport,
            dangerMenList: (editedReport.dangerMenList || []).map((item) =>
                item.id === id ? { ...item, [field]: value } : item
            )
        });
    };

    const handleRemoveDangerMan = (id: string) => {
        if (!isEditing || !editedReport) return;
        setEditedReport({
            ...editedReport,
            dangerMenList: (editedReport.dangerMenList || []).filter((item) => item.id !== id)
        });
    };

    const [sentDangerManIds, setSentDangerManIds] = useState<Set<string>>(new Set());

    const handleSendDangerManToBlackBook = async (dm: DangerManItem, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        const teamName = (activeReport.name || "Opposition").trim();
        const rawPos = (dm.position || "ST").trim();
        const parts = rawPos.split(/[\/,\s]+/).filter(Boolean);
        const primaryPos = normalizeRecruitPosition(parts[0] || "ST");
        const secondaryPos = parts.slice(1).join("/").toUpperCase();
        const displayName = dm.name?.trim()
            ? dm.name.trim()
            : `${teamName} #${(dm.number || "?").replace(/^#/, "")} (${primaryPos})`;
        const footVal: "Right" | "Left" | "Both" =
            dm.foot === "Left" ? "Left" : dm.foot === "Both" ? "Both" : "Right";

        const payload = serializeRecruitForDb({
            name: displayName,
            primaryPosition: primaryPos,
            secondaryPosition: secondaryPos,
            age: 22,
            location: "London",
            status: "Attached",
            currentClub: teamName,
            onTrial: false,
            scoutedRole: "1st Team Player",
            preferredFoot: footVal,
            starRating: 4,
            pipelineStage: "Scouted",
            commutePracticality: "Easy / Local",
            clubConnection: `Scouted vs ${teamName}${dm.number ? ` (#${dm.number.replace(/^#/, "")})` : ""}`,
            notes: dm.notes
                ? `Opposition Danger Man vs ${teamName}${dm.number ? ` (Shirt #${dm.number.replace(/^#/, "")})` : ""}: ${dm.notes}`
                : `Standout player scouted from ${teamName} dossier.`,
        });

        const { error } = await supabase.from("recruits").insert([payload]);
        if (error) {
            alert("Could not send player to Recruitment Black Book: " + error.message);
            return;
        }
        setSentDangerManIds((prev) => {
            const next = new Set(prev);
            next.add(dm.id);
            return next;
        });
    };

    const formatDateShort = (dateStr: string) => {
        const d = new Date(dateStr.includes("T") ? dateStr : `${dateStr}T12:00:00`);
        if (isNaN(d.getTime())) return dateStr;
        return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "2-digit" }).format(d);
    };

    const activeFixtureDateStr = useMemo(() => {
        if (!activeFixture?.date) return "";
        return formatDateShort(activeFixture.date);
    }, [activeFixture]);

    const formationPositions = FORMATIONS[activeReport.formation] || FORMATIONS["4-2-3-1"] || [];
    const activeOppFormat: MatchFormat = getFormatFromFormation(activeReport.formation);
    const activeOppRomanLabel = FORMAT_ROMAN_LABEL[activeOppFormat] || "XI";

    // Logically shorten player names for pitch badges ("Denis Aware" -> "D. Aware", "Matthew Panford (Unlikely to start)" -> "M. Panford", "Max Oaxton/Billett" -> "Oaxton/Bill.")
    // Full names & notes remain intact in the side Players & Roles list.
    const formatPitchPlayerName = (rawName: string): string => {
        if (!rawName || !rawName.trim()) return "";
        // 1. Strip parenthetical or bracketed annotations from the pitch badge
        let cleaned = rawName
            .replace(/\([^)]*\)/g, "")
            .replace(/\[[^\]]*\]/g, "")
            .trim();
        if (!cleaned) cleaned = rawName.trim();

        const shortenSingle = (namePart: string): string => {
            const words = namePart.trim().split(/\s+/).filter(Boolean);
            if (words.length === 0) return "";
            if (words.length === 1) {
                const w = words[0];
                if (w.includes("-") && w.length > 12) {
                    const hParts = w.split("-").filter(Boolean);
                    if (hParts.length >= 2) {
                        const cand = `${hParts[0]}-${hParts[1][0].toUpperCase()}.`;
                        return cand.length <= 12 ? cand : w.slice(0, 11) + ".";
                    }
                }
                return w.length > 12 ? w.slice(0, 11) + "." : w;
            }
            const firstInitial = words[0][0].toUpperCase();
            const surname = words[words.length - 1];
            const withInitial = `${firstInitial}. ${surname}`;
            if (withInitial.length <= 12) return withInitial;
            if (surname.length <= 12) return surname;
            return surname.slice(0, 11) + ".";
        };

        // 2. Handle slash-separated alternatives (e.g. "Max Oaxton/Billett" or "Tyche/Macron")
        if (cleaned.includes("/")) {
            const opts = cleaned.split("/").map((s) => s.trim()).filter(Boolean);
            if (opts.length >= 2) {
                const getSurname = (s: string) => {
                    const w = s.split(/\s+/).filter(Boolean);
                    return w[w.length - 1] || s;
                };
                const s1 = getSurname(opts[0]);
                const s2 = getSurname(opts[1]);
                const combined = `${s1}/${s2}`;
                if (combined.length <= 12) return combined;
                return `${s1.slice(0, 6)}/${s2.slice(0, 4)}.`;
            }
        }

        return shortenSingle(cleaned);
    };

    // Parse multi-line scouting notes (e.g. "Lemonious- technically good..." or "Tyche-CM- Likes to get on the ball...") into structured items instead of a wall of text
    const parseScoutingNotesIntoItems = (rawText: string): { subject?: string; detail: string }[] => {
        if (!rawText || !rawText.trim()) return [];
        return rawText
            .split(/\r?\n/)
            .map((l) => l.trim().replace(/^[•\-*]\s*/, ""))
            .filter(Boolean)
            .map((line) => {
                // Match "Player Name - Position - Note" or "Player Name - Note" or "Player Name: Note"
                const multiDash = line.match(/^([A-Za-z0-9#\/()' .]{2,26}?)\s*-\s*([A-Za-z0-9\/]{1,8})\s*[-:]\s*(.+)$/);
                if (multiDash) {
                    return {
                        subject: `${multiDash[1].trim()} (${multiDash[2].trim()})`,
                        detail: multiDash[3].trim()
                    };
                }
                const singleSep = line.match(/^([A-Za-z0-9#\/()' .-]{2,30}?)\s*[-–—:]\s+(.+)$/) ||
                    line.match(/^([A-Za-z0-9#\/()'.]{2,24}?)\s*[-–—:]\s*(.+)$/);
                if (singleSep && singleSep[1].split(/\s+/).length <= 4) {
                    return {
                        subject: singleSep[1].trim(),
                        detail: singleSep[2].trim()
                    };
                }
                return { detail: line };
            });
    };

    // #12: Ultra-HD 2x Retina (2160px wide) Shareable Scouting Graphic Generator (Dynamic Height — Never Cuts Off Sentences)
    const handleShareGraphic = async () => {
        const report = activeReport;
        if (!report.name.trim()) {
            alert("Please select or enter an opposition team first.");
            return;
        }
        setIsGeneratingGraphic(true);
        try {
            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d");
            if (!ctx) return;

            const W = 2160;
            canvas.width = W;

            // Helper: wrap text into full lines without ever truncating with "…"
            const wrapTextToLines = (
                text: string,
                maxWidth: number,
                font = "500 32px Inter, system-ui, sans-serif"
            ): string[] => {
                ctx.font = font;
                const rawParagraphs = (text || "—").split(/\r?\n/);
                const wrapped: string[] = [];

                for (const rawLine of rawParagraphs) {
                    const trimmed = rawLine.trim();
                    if (!trimmed) {
                        wrapped.push("");
                        continue;
                    }
                    const words = trimmed.split(/\s+/);
                    let line = "";
                    for (let n = 0; n < words.length; n++) {
                        const word = words[n];
                        const testLine = line ? `${line} ${word}` : word;
                        if (ctx.measureText(testLine).width > maxWidth && line) {
                            wrapped.push(line);
                            if (ctx.measureText(word).width > maxWidth) {
                                let chunk = "";
                                for (const ch of word) {
                                    if (ctx.measureText(chunk + ch).width > maxWidth && chunk) {
                                        wrapped.push(chunk);
                                        chunk = ch;
                                    } else {
                                        chunk += ch;
                                    }
                                }
                                line = chunk;
                            } else {
                                line = word;
                            }
                        } else {
                            line = testLine;
                        }
                    }
                    if (line) wrapped.push(line);
                }
                return wrapped.length > 0 ? wrapped : ["—"];
            };

            const drawLines = (
                lines: string[],
                x: number,
                startY: number,
                lineHeight: number,
                color = "#e2e8f0",
                font = "500 32px Inter, system-ui, sans-serif"
            ) => {
                ctx.font = font;
                ctx.fillStyle = color;
                let curY = startY;
                for (const ln of lines) {
                    if (ln) {
                        ctx.fillText(ln, x, curY);
                    }
                    curY += lineHeight;
                }
                return curY;
            };

            // 1. Pre-build Danger Men + Profiled Pitch Players text and measure wrapped lines
            const dangerCardX = 1265;
            const dangerCardW = W - dangerCardX - 80;
            const dangerLines: string[] = [];
            if (report.dangerMenList && report.dangerMenList.length > 0) {
                report.dangerMenList.forEach((dm) => {
                    const tag = [dm.number ? `#${dm.number}` : "", dm.position, dm.name].filter(Boolean).join(" ");
                    const footStr = dm.foot ? ` (${dm.foot})` : "";
                    const details = [
                        dm.strengths ? `✅ Strengths: ${dm.strengths}` : "",
                        dm.weaknesses ? `🎯 Exploit: ${dm.weaknesses}` : "",
                        dm.notes || ""
                    ]
                        .filter(Boolean)
                        .join(" | ");
                    dangerLines.push(`• ${tag}${footStr}: ${details || "Key threat"}`);
                });
            }
            if (report.dangerMen && report.dangerMen.trim()) {
                const parsedItems = parseScoutingNotesIntoItems(report.dangerMen);
                parsedItems.forEach((it) => {
                    dangerLines.push(it.subject ? `• ${it.subject}: ${it.detail}` : `• ${it.detail}`);
                });
            }
            formationPositions.forEach((pos, idx) => {
                const pName = (report.lineup?.[idx] || "").trim();
                const prof = (report.playerProfiles || []).find((p) => p.positionIndex === idx);
                if (pName || prof?.role || prof?.strengths || prof?.weaknesses || prof?.traits) {
                    const dispPos = getDisplayPosition(pos.label);
                    const rolePart = prof?.role ? ` [${prof.role}]` : "";
                    const strPart = prof?.strengths ? ` | ✅ ${prof.strengths}` : "";
                    const wkPart = prof?.weaknesses ? ` | 🎯 ${prof.weaknesses}` : "";
                    const traitsPart = prof?.traits ? ` — ${prof.traits}` : "";
                    dangerLines.push(`• #${pos.number} ${dispPos} ${pName || ""}${rolePart}${strPart}${wkPart}${traitsPart}`.trim());
                }
            });

            const combinedDangerText =
                dangerLines.length > 0
                    ? dangerLines.join("\n")
                    : "No specific individual player threats logged yet.";
            const dangerFont = "600 28px Inter, system-ui, sans-serif";
            const dangerLineH = 42;
            const dangerWrappedLines = wrapTextToLines(combinedDangerText, dangerCardW - 80, dangerFont);
            const row1H = Math.max(870, 145 + dangerWrappedLines.length * dangerLineH);

            // 2. Pre-build 6 Tactical Cards and measure dynamic row heights so no sentence ever cuts off
            const colW = (W - 200) / 2;
            const cardFont = "500 30px Inter, system-ui, sans-serif";
            const cardLineH = 44;
            const gridCards = [
                { title: "💪 THEIR STRENGTHS", text: report.strengths, accent: "#10b981", bg: "#0f221d" },
                { title: "🎯 THEIR WEAKNESSES (AREAS TO EXPLOIT)", text: report.weaknesses, accent: "#f43f5e", bg: "#23121b" },
                { title: "⚽ IN POSSESSION (BUILD-UP & SHAPE)", text: report.inPossession, accent: "#3b82f6", bg: "#111b2e" },
                { title: "🛡️ OUT OF POSSESSION (PRESS & BLOCK)", text: report.outOfPossession, accent: "#a855f7", bg: "#1c152c" },
                { title: "⚡ TRANSITION (COUNTER & RECOVERY)", text: report.transition, accent: "#f97316", bg: "#231812" },
                { title: "🚩 SET PIECES (CORNERS, FREE KICKS, THROWS)", text: report.setPieces, accent: "#06b6d4", bg: "#0e2028" }
            ].map((c) => ({
                ...c,
                lines: wrapTextToLines(c.text || "Not logged yet.", colW - 90, cardFont)
            }));

            const gridRowHeights = [0, 1, 2].map((r) => {
                const leftLines = gridCards[r * 2].lines.length;
                const rightLines = gridCards[r * 2 + 1].lines.length;
                const maxLinesInRow = Math.max(leftLines, rightLines);
                return Math.max(380, 155 + maxLinesInRow * cardLineH);
            });

            // 3. Pre-build Post-Match Review footer lines & height
            const reviewFont = "500 30px Inter, system-ui, sans-serif";
            const reviewLineH = 44;
            const reviewWrappedLines = wrapTextToLines(
                report.postMatchReview || report.generalNotes || "Prepared via ClubFlow",
                W - 260,
                reviewFont
            );
            const footerH = Math.max(200, 140 + reviewWrappedLines.length * reviewLineH);

            // 4. Compute total dynamic canvas height
            const gridStartY = 395 + row1H + 40;
            const totalGridH =
                gridRowHeights[0] + 35 + gridRowHeights[1] + 35 + gridRowHeights[2];
            const footerY = gridStartY + totalGridH + 40;
            const H = footerY + footerH + 70;
            canvas.height = H;

            // Background Gradient
            const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
            bgGrad.addColorStop(0, "#090d16");
            bgGrad.addColorStop(0.5, "#0f172a");
            bgGrad.addColorStop(1, "#090d16");
            ctx.fillStyle = bgGrad;
            ctx.fillRect(0, 0, W, H);

            // Top Brand Accent Bar
            const brandColor = settings.primaryColor || "#dc2626";
            ctx.fillStyle = brandColor;
            ctx.fillRect(0, 0, W, 18);

            // Helper for rounded rectangles
            const roundRect = (x: number, y: number, w: number, h: number, r: number, fill: string, stroke?: string, lineWidth = 3) => {
                ctx.beginPath();
                ctx.moveTo(x + r, y);
                ctx.arcTo(x + w, y, x + w, y + h, r);
                ctx.arcTo(x + w, y + h, x, y + h, r);
                ctx.arcTo(x, y + h, x, y, r);
                ctx.arcTo(x, y, x + w, y, r);
                ctx.closePath();
                ctx.fillStyle = fill;
                ctx.fill();
                if (stroke) {
                    ctx.strokeStyle = stroke;
                    ctx.lineWidth = lineWidth;
                    ctx.stroke();
                }
            };

            // Header Block: Competition + Fixture Name
            roundRect(80, 70, W - 160, 290, 28, "#131c2e", "#1e293b");
            const compTopLine = [
                activeCompetitionLabel.toUpperCase(),
                activeFixtureDateStr ? activeFixtureDateStr.toUpperCase() : "",
                activeFixture ? (activeFixture.isHome ? "HOME FIXTURE" : "AWAY FIXTURE") : ""
            ]
                .filter(Boolean)
                .join("  •  ");
            let compFontSize = 30;
            ctx.font = `800 ${compFontSize}px Inter, system-ui, sans-serif`;
            while (ctx.measureText(compTopLine).width > W - 260 && compFontSize > 20) {
                compFontSize -= 2;
                ctx.font = `800 ${compFontSize}px Inter, system-ui, sans-serif`;
            }
            ctx.fillStyle = brandColor;
            ctx.fillText(compTopLine, 130, 140);

            // Dynamic font sizing for Fixture Title so long club names fit cleanly
            const fixtureHeading = activeFixtureTitle.toUpperCase();
            let titleFontSize = 74;
            ctx.font = `900 ${titleFontSize}px Inter, system-ui, sans-serif`;
            while (ctx.measureText(fixtureHeading).width > W - 260 && titleFontSize > 36) {
                titleFontSize -= 2;
                ctx.font = `900 ${titleFontSize}px Inter, system-ui, sans-serif`;
            }
            ctx.fillStyle = "#ffffff";
            ctx.fillText(fixtureHeading, 130, 238);

            // Sub-header pills: Opponent Shape + League Pos + H2H (auto-sized so it never cuts off)
            const formationText = `OPPONENT SHAPE: ${report.formation || "4-2-3-1"} (${activeOppFormat})`;
            const leagueSummary = activeLeagueStats
                ? `LEAGUE: #${activeLeagueStats.position} • ${activeLeagueStats.points} PTS • ${activeLeagueStats.won}W-${activeLeagueStats.drawn}D-${activeLeagueStats.lost}L • GD ${activeLeagueStats.goal_difference > 0 ? `+${activeLeagueStats.goal_difference}` : activeLeagueStats.goal_difference}`
                : "NON-LEAGUE / CUP OPPONENT";
            const h2hSummary =
                h2hData.past.length > 0
                    ? `H2H: ${h2hData.wins}W - ${h2hData.draws}D - ${h2hData.losses}L (${h2hData.gf}:${h2hData.ga})`
                    : "FIRST MEETING";

            const subHeaderLine = `${formationText}    |    ${leagueSummary}    |    ${h2hSummary}`;
            let subFontSize = 30;
            ctx.font = `700 ${subFontSize}px Inter, system-ui, sans-serif`;
            while (ctx.measureText(subHeaderLine).width > W - 260 && subFontSize > 20) {
                subFontSize -= 2;
                ctx.font = `700 ${subFontSize}px Inter, system-ui, sans-serif`;
            }
            ctx.fillStyle = "#94a3b8";
            ctx.fillText(subHeaderLine, 130, 315);

            // =========================================================================
            // ROW 1 (Y=395, H=row1H): TACTICAL PITCH IMAGE (LEFT) + DANGER MEN (RIGHT)
            // =========================================================================
            const pitchCardX = 80;
            const pitchCardY = 395;
            const pitchCardW = 1150;
            const pitchCardH = row1H;
            roundRect(pitchCardX, pitchCardY, pitchCardW, pitchCardH, 24, "#0c241b", "#10b981");

            ctx.fillStyle = "#34d399";
            ctx.font = "900 32px Inter, system-ui, sans-serif";
            ctx.fillText(
                `⚽ ${(report.name || "OPPOSITION").toUpperCase()} (${report.formation || "4-2-3-1"})`,
                pitchCardX + 40,
                pitchCardY + 58
            );

            // Pitch Canvas Area
            const pX = pitchCardX + 36;
            const pY = pitchCardY + 82;
            const pW = pitchCardW - 72;
            const pH = pitchCardH - 114;
            roundRect(pX, pY, pW, pH, 18, "#047857", "#059669", 2);

            // Alternating turf stripes inside pitch
            ctx.save();
            ctx.beginPath();
            ctx.rect(pX + 4, pY + 4, pW - 8, pH - 8);
            ctx.clip();
            const stripeCount = 8;
            const stripeH = pH / stripeCount;
            for (let s = 0; s < stripeCount; s++) {
                if (s % 2 === 1) {
                    ctx.fillStyle = "rgba(6, 95, 70, 0.45)";
                    ctx.fillRect(pX, pY + s * stripeH, pW, stripeH);
                }
            }
            ctx.restore();

            // Pitch White Lines
            const linePad = 24;
            const inX = pX + linePad;
            const inY = pY + linePad;
            const inW = pW - linePad * 2;
            const inH = pH - linePad * 2;
            ctx.strokeStyle = "rgba(255, 255, 255, 0.55)";
            ctx.lineWidth = 3;
            ctx.strokeRect(inX, inY, inW, inH);

            // Halfway line
            ctx.beginPath();
            ctx.moveTo(inX, inY + inH / 2);
            ctx.lineTo(inX + inW, inY + inH / 2);
            ctx.stroke();

            // Center circle
            ctx.beginPath();
            ctx.arc(inX + inW / 2, inY + inH / 2, 68, 0, Math.PI * 2);
            ctx.stroke();

            // Top & Bottom Penalty Boxes
            const boxW = 320;
            const boxH = 110;
            ctx.strokeRect(inX + (inW - boxW) / 2, inY, boxW, boxH);
            ctx.strokeRect(inX + (inW - boxW) / 2, inY + inH - boxH, boxW, boxH);

            // Draw Opposition Players on the Pitch (shortened names, placed cleanly below shirt circle — zero overhang, zero overlap)
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            formationPositions.forEach((pos, idx) => {
                const cx = inX + (inW * pos.x) / 100;
                const cy = inY + (inH * pos.y) / 100 - 10;
                const profile = (report.playerProfiles || []).find((p) => p.positionIndex === idx);
                const rawPlayerName = (report.lineup?.[idx] || "").trim();
                const shortName = formatPitchPlayerName(rawPlayerName);
                const displayPos = getDisplayPosition(pos.label);

                // Player Shirt Token Circle
                const radius = 24;
                ctx.beginPath();
                ctx.arc(cx, cy, radius, 0, Math.PI * 2);
                ctx.fillStyle = "#ffffff";
                ctx.fill();
                ctx.lineWidth = 4;
                ctx.strokeStyle = profile?.role ? "#f59e0b" : "#dc2626";
                ctx.stroke();

                ctx.fillStyle = "#0f172a";
                ctx.font = "900 21px Inter, system-ui, sans-serif";
                ctx.fillText(String(pos.number), cx, cy + 1);

                // Player Name / Position Pill always placed cleanly BELOW the shirt circle
                const labelText = shortName || displayPos;
                ctx.font = shortName
                    ? "800 19px Inter, system-ui, sans-serif"
                    : "800 18px Inter, system-ui, sans-serif";
                const textW = ctx.measureText(labelText).width;
                const pillW = Math.min(Math.max(textW + 20, 52), 185);
                const pillH = 30;
                const pillX = Math.max(pX + 8, Math.min(pX + pW - pillW - 8, cx - pillW / 2));
                const pillY = cy + radius + 6;

                roundRect(
                    pillX,
                    pillY,
                    pillW,
                    pillH,
                    7,
                    shortName ? "rgba(2, 6, 23, 0.94)" : "rgba(15, 23, 42, 0.82)",
                    shortName ? "rgba(255, 255, 255, 0.35)" : "rgba(255, 255, 255, 0.18)",
                    2
                );
                ctx.fillStyle = "#ffffff";
                ctx.fillText(labelText, pillX + pillW / 2, pillY + pillH / 2 + 1);
            });
            ctx.textAlign = "left";
            ctx.textBaseline = "alphabetic";

            // Right Column: DANGER MEN & PLAYER PROFILES
            const dangerCardY = 395;
            const dangerCardH = row1H;
            roundRect(dangerCardX, dangerCardY, dangerCardW, dangerCardH, 24, "#1a1423", "#f59e0b");
            ctx.fillStyle = "#fbbf24";
            ctx.font = "900 34px Inter, system-ui, sans-serif";
            ctx.fillText("⚠️ DANGER MEN & KEY PLAYERS", dangerCardX + 40, dangerCardY + 60);

            drawLines(
                dangerWrappedLines,
                dangerCardX + 40,
                dangerCardY + 120,
                dangerLineH,
                "#fef3c7",
                dangerFont
            );

            // 2x3 Grid for the 6 Tactical Sections (dynamically sized rows so nothing cuts off)
            let currentRowY = gridStartY;
            for (let row = 0; row < 3; row++) {
                const rowH = gridRowHeights[row];
                for (let col = 0; col < 2; col++) {
                    const card = gridCards[row * 2 + col];
                    const x = 80 + col * (colW + 40);
                    const y = currentRowY;

                    roundRect(x, y, colW, rowH, 24, card.bg, card.accent);
                    ctx.fillStyle = card.accent;
                    ctx.font = "900 32px Inter, system-ui, sans-serif";
                    ctx.fillText(card.title, x + 45, y + 65);

                    drawLines(
                        card.lines,
                        x + 45,
                        y + 130,
                        cardLineH,
                        "#f1f5f9",
                        cardFont
                    );
                }
                currentRowY += rowH + 35;
            }

            // Footer / Post-Match Review Strip (dynamically sized)
            roundRect(80, footerY, W - 160, footerH, 22, "#131c2e", "#334155");
            ctx.fillStyle = "#94a3b8";
            ctx.font = "800 28px Inter, system-ui, sans-serif";
            ctx.fillText("📋 POST-MATCH REVIEW / NOTES FOR NEXT TIME", 130, footerY + 55);
            drawLines(
                reviewWrappedLines,
                130,
                footerY + 110,
                reviewLineH,
                "#e2e8f0",
                reviewFont
            );

            const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, "image/png", 1.0));
            if (!blob) return;

            const safeName = report.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
            const fileName = `opposition-report-${safeName}.png`;
            const file = new File([blob], fileName, { type: "image/png" });

            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({
                    title: `${activeFixtureTitle} - ${activeCompetitionLabel}`,
                    text: `${activeFixtureTitle} (${activeCompetitionLabel})`,
                    files: [file]
                });
            } else {
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = fileName;
                a.click();
                URL.revokeObjectURL(url);
            }
        } catch (err) {
            console.error("Failed to generate scouting graphic:", err);
        } finally {
            setIsGeneratingGraphic(false);
        }
    };

    // Updated PDF Export with Fixture & Competition Header + Visual Tactical Pitch of Opposition Players
    const handleExportPDF = () => {
        const report = activeReport;
        if (!report.name.trim()) return;

        const printWindow = window.open("", "_blank");
        if (!printWindow) return;

        // Build structured player cards for Danger Men & Key Threats (instead of walls of text)
        const structuredDangerCardsHtml = [
            ...(report.dangerMenList || []).map((d) => {
                const badge = d.number ? `#${d.number.replace(/^#/, "")}` : d.position || "!";
                return `
                    <div style="padding:8px 10px; border:1px solid #fde68a; border-radius:8px; background:#ffffff; margin-bottom:6px;">
                        <div style="display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:4px;">
                            <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                                <span style="background:#f59e0b; color:#0f172a; font-weight:900; font-size:10.5px; padding:1px 6px; border-radius:4px;">${badge}</span>
                                <span style="font-weight:900; font-size:12.5px; color:#0f172a;">${d.name || "Key Threat"}</span>
                                ${d.position ? `<span style="font-size:10px; font-weight:800; color:#475569; background:#f1f5f9; padding:1px 6px; border-radius:4px;">${d.position}</span>` : ""}
                            </div>
                            ${d.foot ? `<span style="font-size:10.5px; font-weight:700; color:#b45309;">${d.foot} Foot</span>` : ""}
                        </div>
                        <div style="display:flex; flex-wrap:wrap; gap:6px; margin-top:4px;">
                            ${d.strengths ? `<span style="font-size:11px; background:#ecfdf5; color:#065f46; border:1px solid #a7f3d0; padding:2px 7px; border-radius:5px;"><strong>💪 Strengths:</strong> ${d.strengths}</span>` : ""}
                            ${d.weaknesses ? `<span style="font-size:11px; background:#fff1f2; color:#9f1239; border:1px solid #fecdd3; padding:2px 7px; border-radius:5px;"><strong>🎯 Exploit:</strong> ${d.weaknesses}</span>` : ""}
                        </div>
                        ${d.notes ? `<div style="font-size:12px; color:#334155; margin-top:4px;">${d.notes}</div>` : ""}
                    </div>
                `;
            }),
            ...parseScoutingNotesIntoItems(report.dangerMen || "").map((item) =>
                item.subject
                    ? `
                        <div style="display:flex; align-items:flex-start; gap:8px; padding:6px 10px; border:1px solid #fde68a; border-radius:7px; background:#ffffff; margin-bottom:5px;">
                            <span style="background:#fef3c7; color:#92400e; border:1px solid #fcd34d; font-weight:800; font-size:11px; padding:2px 8px; border-radius:5px; white-space:nowrap; flex-shrink:0;">${item.subject}</span>
                            <span style="font-size:12px; color:#1e293b; line-height:1.4;">${item.detail}</span>
                        </div>
                    `
                    : `
                        <div style="display:flex; align-items:flex-start; gap:6px; padding:5px 8px; border-left:3px solid #f59e0b; background:#ffffff; border-radius:4px; margin-bottom:4px; font-size:12px; color:#1e293b;">
                            <span>•</span>
                            <span>${item.detail}</span>
                        </div>
                    `
            )
        ]
            .filter(Boolean)
            .join("");

        // Pitch tokens: centered vertical flex stack (Circle on top, 3px gap, shortened Name Pill below — never overhangs numbers or overlaps)
        const pitchTokensHtml = formationPositions
            .map((pos, idx) => {
                const profile = (report.playerProfiles || []).find((p) => p.positionIndex === idx);
                const rawPlayerName = (report.lineup?.[idx] || "").trim();
                const shortName = formatPitchPlayerName(rawPlayerName);
                const displayPos = getDisplayPosition(pos.label);
                const borderColor = profile?.role ? "#f59e0b" : "#dc2626";
                return `
                    <div style="position:absolute; left:${pos.x}%; top:${pos.y}%; transform:translate(-50%, -50%); z-index:10; display:flex; flex-direction:column; align-items:center; gap:3px; pointer-events:none;">
                        <div style="width:28px; height:28px; border-radius:9999px; background:#ffffff; border:2.5px solid ${borderColor}; display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:900; color:#0f172a; box-shadow:0 2px 5px rgba(0,0,0,0.35); flex-shrink:0;">
                            ${pos.number}
                        </div>
                        <div style="white-space:nowrap; max-width:96px; overflow:hidden; text-overflow:ellipsis; background:#020617; color:#ffffff; border:1px solid rgba(255,255,255,0.35); border-radius:5px; padding:1.5px 6px; font-size:9.5px; font-weight:800; line-height:1.2; box-shadow:0 2px 5px rgba(0,0,0,0.4);">
                            ${shortName || displayPos}
                        </div>
                    </div>
                `;
            })
            .join("");

        const lineupRowsHtml = formationPositions
            .map((pos, idx) => {
                const profile = (report.playerProfiles || []).find((p) => p.positionIndex === idx);
                const playerName = (report.lineup?.[idx] || "").trim() || "—";
                const displayPos = getDisplayPosition(pos.label);
                const hasDetails = Boolean(profile?.strengths || profile?.weaknesses || profile?.traits);
                return `
                    <div style="padding:5px 8px; border:1px solid #e2e8f0; border-radius:6px; background:#f8fafc; font-size:11.5px;">
                        <div style="display:flex; align-items:center; gap:7px;">
                            <span style="width:21px; height:21px; border-radius:9999px; background:#dc2626; color:#ffffff; display:inline-flex; align-items:center; justify-content:center; font-size:10px; font-weight:900; flex-shrink:0;">${pos.number}</span>
                            <span style="font-weight:800; color:#475569; width:30px; flex-shrink:0;">${displayPos}</span>
                            <span style="font-weight:800; color:#0f172a; flex:1; word-break:break-word;">${playerName}</span>
                            ${profile?.foot && profile.foot !== "Right" ? `<span style="font-size:9.5px; font-weight:700; color:#64748b;">${profile.foot}</span>` : ""}
                            ${profile?.role ? `<span style="font-size:9.5px; font-weight:700; color:#b45309; background:#fef3c7; padding:1px 6px; border-radius:4px;">${profile.role}</span>` : ""}
                        </div>
                        ${
                            hasDetails
                                ? `<div style="margin-top:4px; padding-left:28px; display:flex; flex-wrap:wrap; gap:4px; font-size:10.5px;">
                                    ${profile?.strengths ? `<span style="background:#ecfdf5; color:#065f46; border:1px solid #a7f3d0; padding:1px 5px; border-radius:4px;"><strong>💪</strong> ${profile.strengths}</span>` : ""}
                                    ${profile?.weaknesses ? `<span style="background:#fff1f2; color:#9f1239; border:1px solid #fecdd3; padding:1px 5px; border-radius:4px;"><strong>🎯</strong> ${profile.weaknesses}</span>` : ""}
                                    ${profile?.traits ? `<span style="color:#475569;">${profile.traits}</span>` : ""}
                                   </div>`
                                : ""
                        }
                    </div>
                `;
            })
            .join("");

        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                <title>${activeFixtureTitle} - ${activeCompetitionLabel}</title>
                <style>
                    body { font-family: 'Segoe UI', system-ui, sans-serif; padding: 28px; max-width: 960px; margin: 0 auto; color: #0f172a; -webkit-print-color-adjust: exact; print-color-adjust: exact; box-sizing: border-box; }
                    .header { border-bottom: 3px solid #dc2626; padding-bottom: 14px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-end; flex-wrap: wrap; gap: 12px; }
                    h1 { margin: 4px 0 0 0; font-size: 26px; font-weight: 900; word-break: break-word; }
                    .sub { font-size: 12px; font-weight: 800; color: #dc2626; text-transform: uppercase; letter-spacing: 0.06em; }
                    .stats-bar { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 14px; margin-bottom: 16px; font-size: 12px; display: flex; justify-content: space-between; flex-wrap: wrap; gap: 12px; }
                    .pitch-row { display: grid; grid-template-columns: 1.12fr 0.88fr; gap: 14px; margin-bottom: 16px; break-inside: avoid; }
                    .pitch-canvas { position: relative; width: 100%; height: 410px; background: #047857; border-radius: 10px; overflow: hidden; border: 2px solid #065f46; }
                    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
                    .box { border: 1px solid #e2e8f0; border-left: 4px solid #dc2626; border-radius: 8px; padding: 12px; background: #ffffff; break-inside: avoid; }
                    .box-full { grid-column: 1 / -1; }
                    .box-title { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: #475569; margin-bottom: 6px; }
                    .box-body { font-size: 12.5px; line-height: 1.45; white-space: pre-wrap; word-break: break-word; overflow-wrap: anywhere; color: #1e293b; }
                    @media screen and (max-width: 680px) {
                        body { padding: 14px; }
                        h1 { font-size: 20px; }
                        .pitch-row { grid-template-columns: 1fr; }
                        .pitch-canvas { height: 350px; }
                        .grid { grid-template-columns: 1fr; }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <div>
                        <div class="sub">${activeCompetitionLabel}${activeFixtureDateStr ? ` • ${activeFixtureDateStr}` : ""}${activeFixture ? (activeFixture.isHome ? " • Home" : " • Away") : ""}</div>
                        <h1>${activeFixtureTitle}</h1>
                    </div>
                    <div style="text-align:right; font-size:12px; color:#64748b; flex-shrink:0;">
                        <div><strong>Opponent Shape:</strong> ${report.formation} (${activeOppFormat})</div>
                        <div><strong>Updated:</strong> ${new Date(report.updatedAt).toLocaleDateString("en-GB")}</div>
                    </div>
                </div>
                <div class="stats-bar">
                    <div><strong>League Standing:</strong> ${
                        activeLeagueStats
                            ? `#${activeLeagueStats.position} (${activeLeagueStats.points} pts • ${activeLeagueStats.won}W-${activeLeagueStats.drawn}D-${activeLeagueStats.lost}L • GD ${activeLeagueStats.goal_difference})`
                            : "N/A"
                    }</div>
                    <div><strong>Head-to-Head:</strong> ${
                        h2hData.past.length > 0
                            ? `${h2hData.wins}W - ${h2hData.draws}D - ${h2hData.losses}L (Goals ${h2hData.gf}:${h2hData.ga})`
                            : "No previous meetings logged"
                    }</div>
                </div>
                <div class="pitch-row">
                    <div>
                        <div class="box-title" style="color:#047857; margin-bottom:6px;">⚽ ${report.name} (${report.formation})</div>
                        <div class="pitch-canvas">
                            <div style="position:absolute; inset:12px; border:2px solid rgba(255,255,255,0.55); border-radius:4px;"></div>
                            <div style="position:absolute; left:12px; right:12px; top:50%; border-top:2px solid rgba(255,255,255,0.55);"></div>
                            <div style="position:absolute; left:50%; top:50%; width:64px; height:64px; transform:translate(-50%, -50%); border:2px solid rgba(255,255,255,0.55); border-radius:9999px;"></div>
                            <div style="position:absolute; left:50%; top:12px; width:130px; height:52px; transform:translateX(-50%); border:2px solid rgba(255,255,255,0.55); border-top:0;"></div>
                            <div style="position:absolute; left:50%; bottom:12px; width:130px; height:52px; transform:translateX(-50%); border:2px solid rgba(255,255,255,0.55); border-bottom:0;"></div>
                            ${pitchTokensHtml}
                        </div>
                    </div>
                    <div>
                        <div class="box-title" style="color:#0f172a; margin-bottom:6px;">👥 ${report.name} Players & Roles</div>
                        <div style="display:grid; grid-template-columns:1fr; gap:4px;">
                            ${lineupRowsHtml}
                        </div>
                    </div>
                </div>
                <div class="grid">
                    <div class="box box-full" style="border-left-color:#f59e0b; background:#fffbeb;">
                        <div class="box-title" style="color:#b45309;">⚠️ Danger Men & Key Threats</div>
                        <div class="box-body" style="white-space:normal;">${structuredDangerCardsHtml || "No specific danger men recorded."}</div>
                    </div>
                    <div class="box" style="border-left-color:#10b981;">
                        <div class="box-title" style="color:#047857;">💪 Strengths</div>
                        <div class="box-body">${report.strengths || "—"}</div>
                    </div>
                    <div class="box" style="border-left-color:#f43f5e;">
                        <div class="box-title" style="color:#be123c;">🎯 Weaknesses (Areas to Exploit)</div>
                        <div class="box-body">${report.weaknesses || "—"}</div>
                    </div>
                    <div class="box" style="border-left-color:#3b82f6;">
                        <div class="box-title" style="color:#1d4ed8;">⚽ In Possession</div>
                        <div class="box-body">${report.inPossession || "—"}</div>
                    </div>
                    <div class="box" style="border-left-color:#a855f7;">
                        <div class="box-title" style="color:#7e22ce;">🛡️ Out of Possession</div>
                        <div class="box-body">${report.outOfPossession || "—"}</div>
                    </div>
                    <div class="box" style="border-left-color:#f97316;">
                        <div class="box-title" style="color:#c2410c;">⚡ Transition</div>
                        <div class="box-body">${report.transition || "—"}</div>
                    </div>
                    <div class="box" style="border-left-color:#06b6d4;">
                        <div class="box-title" style="color:#0e7490;">🚩 Set Pieces</div>
                        <div class="box-body">${report.setPieces || "—"}</div>
                    </div>
                    <div class="box box-full" style="border-left-color:#64748b;">
                        <div class="box-title">📋 Post-Match Review / For Next Time</div>
                        <div class="box-body">${report.postMatchReview || report.generalNotes || "—"}</div>
                    </div>
                </div>
                <script>window.print();</script>
            </body>
            </html>
        `);
        printWindow.document.close();
    };
    const enabledFormats: MatchFormat[] =
        Array.isArray(settings.enabledMatchFormats) && settings.enabledMatchFormats.length > 0
            ? (settings.enabledMatchFormats as MatchFormat[])
            : ["11v11"];

    const handleOppFormatChange = (fmt: MatchFormat) => {
        const defaultForm = DEFAULT_FORMATION_BY_FORMAT[fmt] || "4-2-3-1";
        if (isEditing && editedReport) {
            setEditedReport({ ...editedReport, formation: defaultForm });
        } else {
            const base = selectedReport || editedReport || createBlankReport();
            setEditedReport({
                ...base,
                formation: defaultForm,
                dangerMenList: [...(base.dangerMenList || [])],
                playerProfiles: [...(base.playerProfiles || [])],
                lineup: [...(base.lineup || [])]
            });
            setIsEditing(true);
        }
    };

    const filteredSavedReports = useMemo(() => {
        if (!teamSearch.trim()) return reports;
        const q = teamSearch.toLowerCase().trim();
        return reports.filter((r) => r.name.toLowerCase().includes(q));
    }, [reports, teamSearch]);

    const filteredDirectoryTeams = useMemo(() => {
        return knownOpponentsDirectory.filter((dirTeam) => {
            const matchesSearch = !teamSearch.trim() || dirTeam.name.toLowerCase().includes(teamSearch.toLowerCase().trim());
            return matchesSearch;
        });
    }, [knownOpponentsDirectory, teamSearch]);

    const nextMatchHasReport = useMemo(() => {
        if (!nextMatch) return null;
        return reports.find((r) => isMatchingTeam(r.name, nextMatch.opponent)) || null;
    }, [nextMatch, reports]);

    const nextMatchLeagueRow = useMemo(() => {
        if (!nextMatch) return null;
        return leagueRows.find((r: any) => isMatchingTeam(r.team_name || r.name || "", nextMatch.opponent)) || null;
    }, [nextMatch, leagueRows]);

    return (
        <div className="space-y-4 md:space-y-6 pb-8">
            {/* Shared Opponent Autocomplete Datalist (#2) */}
            <datalist id="opposition-known-teams">
                {knownOpponentsDirectory.map((t) => (
                    <option key={t.name} value={t.name} />
                ))}
            </datalist>

            {/* ================================================================= */}
            {/* DEDICATED MOBILE OPPOSITION REPORTS (< 768px)                     */}
            {/* ================================================================= */}
            <div className="md:hidden space-y-3.5 pb-20">
                {/* 1. MOBILE HEADER & QUICK ACTION */}
                <div className="flex items-center justify-between gap-2">
                    <div>
                        <h1 className="text-xl font-black tracking-tight text-foreground leading-none">
                            Opposition Hub
                        </h1>
                        <p className="text-[11px] text-muted-foreground font-medium mt-1">
                            Tactical dossiers, danger men &amp; H2H history
                        </p>
                    </div>
                    <Button
                        size="sm"
                        onClick={handleStartNewReport}
                        className="h-9 px-3 rounded-xl bg-brand hover:bg-brand/90 text-brand-foreground font-extrabold text-xs shadow-xs"
                    >
                        <Plus className="h-3.5 w-3.5 mr-1" />
                        New Report
                    </Button>
                </div>

                {/* 2. MOBILE 4-STAT SCOUTING PULSE BENTO STRIP */}
                <div className="grid grid-cols-4 gap-1.5">
                    <button
                        type="button"
                        onClick={() => nextMatch && handleOpenOrStartForTeam(nextMatch.opponent)}
                        className="rounded-xl bg-surface-1 border border-border p-2.5 text-left transition-colors active:bg-surface-2"
                    >
                        <div className="text-[9px] font-extrabold uppercase tracking-wider text-brand truncate">
                            Up Next
                        </div>
                        <div className="text-xs font-black text-foreground truncate mt-0.5">
                            {nextMatch ? nextMatch.opponent : "TBC"}
                        </div>
                        <div className="text-[9px] font-bold text-muted-foreground truncate mt-0.5">
                            {nextMatch
                                ? nextMatchHasReport
                                    ? "✓ Scouted"
                                    : "+ Scout now"
                                : "No fixture"}
                        </div>
                    </button>

                    <div className="rounded-xl bg-surface-1 border border-border p-2.5">
                        <div className="text-[9px] font-extrabold uppercase tracking-wider text-muted-foreground truncate">
                            Dossiers
                        </div>
                        <div className="text-sm font-black text-foreground tabular-nums mt-0.5">
                            {reports.length}
                        </div>
                        <div className="text-[9px] font-semibold text-muted-foreground truncate mt-0.5">
                            Saved teams
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={() => setShowMobileDirectory((prev) => !prev)}
                        className="rounded-xl bg-surface-1 border border-border p-2.5 text-left transition-colors active:bg-surface-2"
                    >
                        <div className="text-[9px] font-extrabold uppercase tracking-wider text-muted-foreground truncate">
                            Division
                        </div>
                        <div className="text-sm font-black text-foreground tabular-nums mt-0.5">
                            {knownOpponentsDirectory.length}
                        </div>
                        <div className="text-[9px] font-bold text-brand truncate mt-0.5">
                            {showMobileDirectory ? "Hide list" : "Browse all"}
                        </div>
                    </button>

                    <div className="rounded-xl bg-surface-1 border border-border p-2.5">
                        <div className="text-[9px] font-extrabold uppercase tracking-wider text-muted-foreground truncate">
                            Shape
                        </div>
                        <div className="text-xs font-black text-foreground truncate mt-0.5">
                            {activeReport.formation}
                        </div>
                        <div className="text-[9px] font-semibold text-muted-foreground truncate mt-0.5">
                            {(activeReport.dangerMenList || []).length} threats
                        </div>
                    </div>
                </div>

                {/* 3. MOBILE "UP NEXT" MATCHDAY SCOUTING BANNER */}
                {nextMatch && (
                    <div className="rounded-2xl border border-brand/35 bg-surface-1 p-3 shadow-xs border-l-4 border-l-brand space-y-2">
                        <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 min-w-0">
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-brand/15 text-brand text-[9px] font-black uppercase tracking-wider shrink-0">
                                    <Zap className="h-2.5 w-2.5 fill-brand" /> Up Next
                                </span>
                                <span className="text-[11px] font-bold text-muted-foreground truncate">
                                    {formatDateShort(nextMatch.date)} • {nextMatch.time} ({nextMatch.isHome ? "H" : "A"})
                                </span>
                            </div>
                            {nextMatchLeagueRow && (
                                <span className="px-1.5 py-0.5 rounded bg-surface-2 border border-border text-[9px] font-black text-foreground shrink-0">
                                    #{nextMatchLeagueRow.position} • {nextMatchLeagueRow.points} pts
                                </span>
                            )}
                        </div>

                        <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                                <div className="text-sm font-black text-foreground truncate">
                                    vs {nextMatch.opponent}
                                </div>
                                {nextMatchHasReport ? (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-500">
                                        <CheckCircle2 className="h-3 w-3" /> Scouting Report Ready
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-500">
                                        <AlertTriangle className="h-3 w-3" /> Not Scouted Yet
                                    </span>
                                )}
                            </div>
                            <Button
                                size="sm"
                                onClick={() => handleOpenOrStartForTeam(nextMatch.opponent)}
                                className="h-8 px-3 rounded-xl bg-brand hover:bg-brand/90 text-brand-foreground font-extrabold text-[11px] shrink-0"
                            >
                                <Target className="h-3 w-3 mr-1" />
                                {nextMatchHasReport ? "Open Dossier" : "Scout Team"}
                            </Button>
                        </div>
                    </div>
                )}

                {/* 4. MOBILE TEAM SWITCHER PILL BAR + EXPANDABLE DIRECTORY */}
                <div className="rounded-2xl bg-surface-1 border border-border p-3 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
                            Switch Opponent ({reports.length} Saved)
                        </span>
                        <button
                            type="button"
                            onClick={() => setShowMobileDirectory((prev) => !prev)}
                            className="text-[11px] font-extrabold text-brand flex items-center gap-1"
                        >
                            <Search className="h-3 w-3" />
                            {showMobileDirectory ? "Close Directory" : "Search All Teams"}
                        </button>
                    </div>

                    {/* Horizontal Pill Strip */}
                    <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
                        {reports.map((rep) => {
                            const isSelected = activeReport.id === rep.id || isMatchingTeam(activeReport.name, rep.name);
                            const lRow = leagueRows.find((r: any) => isMatchingTeam(r.team_name || r.name || "", rep.name));
                            return (
                                <button
                                    key={rep.id}
                                    type="button"
                                    onClick={() => handleSelectReport(rep)}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-extrabold whitespace-nowrap border transition-colors flex items-center gap-1.5 shrink-0 ${
                                        isSelected
                                            ? "bg-brand text-brand-foreground border-brand shadow-xs"
                                            : "bg-surface-2 text-foreground border-border"
                                    }`}
                                >
                                    <span>{rep.name}</span>
                                    {lRow?.position && (
                                        <span className="text-[10px] opacity-85 font-black">#{lRow.position}</span>
                                    )}
                                </button>
                            );
                        })}

                        {knownOpponentsDirectory
                            .filter((dir) => !reports.some((r) => isMatchingTeam(r.name, dir.name)))
                            .map((dir) => (
                                <button
                                    key={dir.name}
                                    type="button"
                                    onClick={() => handleOpenOrStartForTeam(dir.name)}
                                    className="px-2.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap border border-dashed border-border bg-surface-1 text-muted-foreground flex items-center gap-1 shrink-0"
                                >
                                    <Plus className="h-3 w-3 text-brand" />
                                    <span>{dir.name}</span>
                                    {dir.position && <span className="text-[10px] font-bold">#{dir.position}</span>}
                                </button>
                            ))}
                    </div>

                    {/* Expandable Full League & Schedule Team Picker */}
                    {showMobileDirectory && (
                        <div className="pt-2 border-t border-border space-y-2">
                            <div className="relative">
                                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                                <Input
                                    placeholder="Filter saved reports or league teams..."
                                    value={teamSearch}
                                    onChange={(e) => setTeamSearch(e.target.value)}
                                    className="pl-8 h-9 text-base sm:text-xs bg-surface-2 border-border"
                                />
                            </div>
                            <div className="grid grid-cols-1 gap-1 max-h-52 overflow-y-auto pr-1">
                                {filteredDirectoryTeams.map((dir) => {
                                    const savedRep = reports.find((r) => isMatchingTeam(r.name, dir.name));
                                    return (
                                        <div
                                            key={dir.name}
                                            onClick={() => {
                                                handleOpenOrStartForTeam(dir.name);
                                                setShowMobileDirectory(false);
                                            }}
                                            className="flex items-center justify-between px-2.5 py-2 rounded-xl bg-surface-2/70 border border-border active:bg-surface-2 cursor-pointer"
                                        >
                                            <div className="flex items-center gap-2 min-w-0">
                                                {dir.position && (
                                                    <span className="text-[10px] font-black text-brand w-5 tabular-nums">
                                                        #{dir.position}
                                                    </span>
                                                )}
                                                <span className="text-xs font-bold text-foreground truncate">
                                                    {dir.name}
                                                </span>
                                            </div>
                                            <span
                                                className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md ${
                                                    savedRep
                                                        ? "bg-emerald-500/15 text-emerald-500"
                                                        : "bg-brand/15 text-brand"
                                                }`}
                                            >
                                                {savedRep ? "Open Saved" : "+ Start Report"}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {/* 5. MOBILE ACTIVE OPPONENT HERO CARD */}
                <div className="rounded-2xl bg-surface-1 border border-border p-3.5 shadow-xs space-y-3">
                    {isEditing ? (
                        <div className="space-y-2.5">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <div className="space-y-1">
                                    <Label className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
                                        Opposition Team Name
                                    </Label>
                                    <Input
                                        list="opposition-known-teams"
                                        value={editedReport?.name || ""}
                                        onChange={(e) =>
                                            setEditedReport((prev) =>
                                                prev ? { ...prev, name: e.target.value } : null
                                            )
                                        }
                                        placeholder="Type or pick opponent..."
                                        className="h-10 text-base sm:text-sm font-black bg-surface-2 border-border"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
                                        Competition
                                    </Label>
                                    <Input
                                        value={editedReport?.competition || ""}
                                        onChange={(e) =>
                                            setEditedReport((prev) =>
                                                prev ? { ...prev, competition: e.target.value } : null
                                            )
                                        }
                                        placeholder={activeFixture?.competition || "e.g. League, Cup..."}
                                        className="h-10 text-base sm:text-xs font-bold bg-surface-2 border-border"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-1">
                                    <Label className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
                                        Expected Formation ({activeOppFormat})
                                    </Label>
                                    <select
                                        value={editedReport?.formation || "4-2-3-1"}
                                        onChange={(e) =>
                                            setEditedReport((prev) =>
                                                prev ? { ...prev, formation: e.target.value } : null
                                            )
                                        }
                                        className="w-full h-9 px-2.5 rounded-lg border border-border bg-surface-2 text-base sm:text-xs font-bold text-foreground"
                                    >
                                        {(["11v11", "9v9", "7v7", "5v5"] as const)
                                            .filter((fmt) => enabledFormats.includes(fmt) || fmt === activeOppFormat)
                                            .map((fmt) => (
                                                <optgroup key={fmt} label={`${fmt} Formations`}>
                                                    {FORMATIONS_BY_FORMAT[fmt].map((name) => (
                                                        <option key={name} value={name}>
                                                            {enabledFormats.length > 1 ? `${name} (${fmt})` : name}
                                                        </option>
                                                    ))}
                                                </optgroup>
                                            ))}
                                    </select>
                                </div>
                                <div className="flex items-end gap-1.5">
                                    <Button
                                        size="sm"
                                        onClick={handleSaveReport}
                                        className="h-9 flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-lg"
                                    >
                                        <Save className="h-3.5 w-3.5 mr-1" />
                                        Save
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={handleCancelEdit}
                                        className="h-9 px-2.5 border-border bg-surface-2 text-foreground font-bold text-xs rounded-lg"
                                    >
                                        <X className="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-2.5">
                            <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="text-[10px] font-black uppercase tracking-wider text-brand bg-brand/10 px-2 py-0.5 rounded border border-brand/20">
                                            {activeCompetitionLabel}
                                            {activeFixtureDateStr ? ` • ${activeFixtureDateStr}` : ""}
                                        </span>
                                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-surface-2 border border-border text-foreground">
                                            {activeReport.formation}
                                        </span>
                                        <span className="text-[10px] text-muted-foreground">
                                            {formatDateShort(activeReport.updatedAt)}
                                        </span>
                                    </div>
                                    <h2 className="text-xl font-black text-foreground tracking-tight break-words leading-tight mt-1">
                                        {activeFixtureTitle}
                                    </h2>
                                </div>
                                {selectedReport && (
                                    <button
                                        type="button"
                                        onClick={() => handleDeleteReport(selectedReport.id)}
                                        className="h-8 w-8 rounded-lg flex items-center justify-center text-rose-500 hover:bg-rose-500/10 shrink-0"
                                        title="Delete Report"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                )}
                            </div>

                            {/* Mobile Action Bar */}
                            <div className="grid grid-cols-3 gap-1.5">
                                <Button
                                    size="sm"
                                    onClick={handleEditReport}
                                    className="h-9 rounded-xl bg-brand hover:bg-brand/90 text-brand-foreground font-extrabold text-xs"
                                >
                                    <Edit2 className="h-3.5 w-3.5 mr-1.5" />
                                    Edit
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={isGeneratingGraphic}
                                    onClick={handleShareGraphic}
                                    className="h-9 rounded-xl border-border bg-surface-2 text-foreground font-extrabold text-xs"
                                >
                                    <Share2 className="h-3.5 w-3.5 mr-1.5 text-brand" />
                                    {isGeneratingGraphic ? "..." : "Share PNG"}
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={handleExportPDF}
                                    className="h-9 rounded-xl border-border bg-surface-2 text-foreground font-bold text-xs"
                                >
                                    <FileDown className="h-3.5 w-3.5 mr-1.5" />
                                    PDF
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Compact 2-Col League Standing + H2H Strip on Mobile */}
                    {activeReport.name.trim() && (
                        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border">
                            {/* League Box */}
                            <div className="rounded-xl bg-surface-2/80 border border-border p-2.5 space-y-1">
                                <div className="flex items-center justify-between">
                                    <span className="text-[9px] font-extrabold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                                        <Trophy className="h-3 w-3 text-amber-500" /> League
                                    </span>
                                    {activeLeagueStats && (
                                        <span className="text-[10px] font-black text-brand">
                                            #{activeLeagueStats.position} ({activeLeagueStats.points} pts)
                                        </span>
                                    )}
                                </div>
                                {activeLeagueStats ? (
                                    <>
                                        <div className="text-[11px] font-bold text-foreground tabular-nums">
                                            {activeLeagueStats.played}P •{" "}
                                            <span className="text-emerald-500">{activeLeagueStats.won}W</span>-
                                            <span className="text-amber-500">{activeLeagueStats.drawn}D</span>-
                                            <span className="text-rose-500">{activeLeagueStats.lost}L</span> • GD{" "}
                                            {activeLeagueStats.goal_difference > 0
                                                ? `+${activeLeagueStats.goal_difference}`
                                                : activeLeagueStats.goal_difference}
                                        </div>
                                        {activeLeagueStats.form && (
                                            <div className="flex items-center gap-1 pt-0.5">
                                                {String(activeLeagueStats.form)
                                                    .replace(/[^WDL]/gi, "")
                                                    .slice(-5)
                                                    .split("")
                                                    .map((ch: string, idx: number) => {
                                                        const u = ch.toUpperCase();
                                                        const cls =
                                                            u === "W"
                                                                ? "bg-emerald-500 text-white"
                                                                : u === "D"
                                                                    ? "bg-amber-500 text-white"
                                                                    : "bg-rose-500 text-white";
                                                        return (
                                                            <span
                                                                key={idx}
                                                                className={`w-4 h-4 rounded text-[9px] font-black flex items-center justify-center ${cls}`}
                                                            >
                                                                {u}
                                                            </span>
                                                        );
                                                    })}
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <div className="text-[10px] text-muted-foreground">Non-league / Cup</div>
                                )}
                            </div>

                            {/* H2H Box */}
                            <div className="rounded-xl bg-surface-2/80 border border-border p-2.5 space-y-1">
                                <div className="flex items-center justify-between">
                                    <span className="text-[9px] font-extrabold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                                        <Swords className="h-3 w-3 text-brand" /> H2H Record
                                    </span>
                                    {h2hData.past.length > 0 && (
                                        <span className="text-[10px] font-black text-foreground tabular-nums">
                                            {h2hData.gf}:{h2hData.ga}
                                        </span>
                                    )}
                                </div>
                                {h2hData.past.length > 0 ? (
                                    <>
                                        <div className="text-[11px] font-extrabold tabular-nums">
                                            <span className="text-emerald-500">{h2hData.wins}W</span> -{" "}
                                            <span className="text-amber-500">{h2hData.draws}D</span> -{" "}
                                            <span className="text-rose-500">{h2hData.losses}L</span>
                                        </div>
                                        <div className="text-[10px] text-muted-foreground break-words">
                                            Last: {h2hData.past[0].result?.[0]} {h2hData.past[0].scoreline} (
                                            {formatDateShort(h2hData.past[0].date)})
                                        </div>
                                    </>
                                ) : (
                                    <div className="text-[10px] text-muted-foreground">
                                        {h2hData.upcoming.length > 0
                                            ? `Next: ${formatDateShort(h2hData.upcoming[0].date)}`
                                            : "First meeting"}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* 6. MOBILE SEGMENTED SUB-TAB BAR */}
                <div className="grid grid-cols-5 gap-1 p-1 rounded-xl bg-surface-1 border border-border">
                    {(
                        [
                            { id: "all", label: "All" },
                            { id: "threats", label: "Threats" },
                            { id: "tactics", label: "Tactics" },
                            { id: "pitch", label: "Pitch XI" },
                            { id: "review", label: "Review" }
                        ] as const
                    ).map((t) => (
                        <button
                            key={t.id}
                            type="button"
                            onClick={() => setMobileTab(t.id)}
                            className={`py-1.5 px-1 rounded-lg text-[11px] font-extrabold transition-colors text-center truncate ${
                                mobileTab === t.id
                                    ? "bg-brand text-brand-foreground shadow-xs"
                                    : "text-muted-foreground hover:text-foreground"
                            }`}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>

                {/* 7. MOBILE TAB CONTENT: THREATS (DANGER MEN, STRENGTHS, WEAKNESSES) */}
                {(mobileTab === "all" || mobileTab === "threats") && (
                    <div className="space-y-3">
                        {/* Danger Men Card (Mobile Optimized Stacked Inputs) */}
                        <div className="rounded-2xl bg-surface-1 border border-amber-500/35 border-l-4 border-l-amber-500 p-3.5 space-y-2.5 shadow-xs">
                            <div className="flex items-center justify-between gap-2">
                                <div>
                                    <h3 className="text-xs font-black uppercase tracking-wider text-amber-500 flex items-center gap-1.5">
                                        <ShieldAlert className="h-3.5 w-3.5" />
                                        Danger Men &amp; Key Players
                                    </h3>
                                    <p className="text-[10px] text-muted-foreground">
                                        Shirt #, position, foot &amp; how to stop them
                                    </p>
                                </div>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={handleAddDangerMan}
                                    className="h-7 px-2.5 text-[11px] font-extrabold border-amber-500/40 text-amber-500"
                                >
                                    <Plus className="h-3 w-3 mr-1" />
                                    Player
                                </Button>
                            </div>

                            {(activeReport.dangerMenList || []).length > 0 && (
                                <div className="space-y-2">
                                    {(activeReport.dangerMenList || []).map((dm) => (
                                        <div
                                            key={dm.id}
                                            className="rounded-xl bg-surface-2 border border-border p-2.5 space-y-2"
                                        >
                                            {isEditing ? (
                                                <>
                                                    <div className="grid grid-cols-[54px_68px_1fr_auto] gap-1.5 items-center">
                                                        <Input
                                                            placeholder="#9"
                                                            value={dm.number}
                                                            onChange={(e) =>
                                                                handleUpdateDangerMan(dm.id, "number", e.target.value)
                                                            }
                                                            className="h-9 text-base sm:text-xs font-bold text-center bg-surface-1 px-1"
                                                        />
                                                        <Input
                                                            placeholder="ST/LW"
                                                            value={dm.position}
                                                            onChange={(e) =>
                                                                handleUpdateDangerMan(dm.id, "position", e.target.value)
                                                            }
                                                            className="h-9 text-base sm:text-xs font-bold bg-surface-1 px-2"
                                                        />
                                                        <select
                                                            value={dm.foot || "Right"}
                                                            onChange={(e) =>
                                                                handleUpdateDangerMan(dm.id, "foot", e.target.value)
                                                            }
                                                            className="h-9 rounded-md border border-border bg-surface-1 px-2 text-base sm:text-xs font-semibold text-foreground"
                                                        >
                                                            <option value="Right">Right Foot</option>
                                                            <option value="Left">Left Foot</option>
                                                            <option value="Both">Both Feet</option>
                                                        </select>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemoveDangerMan(dm.id)}
                                                            className="h-9 w-9 rounded-md flex items-center justify-center text-rose-500 hover:bg-rose-500/10"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </button>
                                                    </div>
                                                    <Input
                                                        placeholder="Player name or nickname..."
                                                        value={dm.name}
                                                        onChange={(e) =>
                                                            handleUpdateDangerMan(dm.id, "name", e.target.value)
                                                        }
                                                        className="h-9 text-base sm:text-xs font-semibold bg-surface-1"
                                                    />
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                                        <Input
                                                            placeholder="💪 Strengths (e.g. Pace, 1v1, aerial)..."
                                                            value={dm.strengths || ""}
                                                            onChange={(e) =>
                                                                handleUpdateDangerMan(dm.id, "strengths", e.target.value)
                                                            }
                                                            className="h-9 text-base sm:text-xs bg-emerald-500/5 border-emerald-500/30"
                                                        />
                                                        <Input
                                                            placeholder="🎯 Weaknesses / Exploit (e.g. Press 1st touch)..."
                                                            value={dm.weaknesses || ""}
                                                            onChange={(e) =>
                                                                handleUpdateDangerMan(dm.id, "weaknesses", e.target.value)
                                                            }
                                                            className="h-9 text-base sm:text-xs bg-rose-500/5 border-rose-500/30"
                                                        />
                                                    </div>
                                                    <textarea
                                                        rows={2}
                                                        placeholder="Additional tactical notes..."
                                                        value={dm.notes}
                                                        onChange={(e) =>
                                                            handleUpdateDangerMan(dm.id, "notes", e.target.value)
                                                        }
                                                        className="w-full rounded-md border border-border bg-surface-1 px-2.5 py-1.5 text-base sm:text-xs text-foreground placeholder:text-muted-foreground outline-none resize-y"
                                                    />
                                                </>
                                            ) : (
                                                <div
                                                    onClick={handleEditReport}
                                                    className="space-y-1.5 cursor-pointer"
                                                >
                                                    <div className="flex items-center justify-between gap-2">
                                                        <div className="flex items-center gap-1.5 flex-wrap">
                                                            {dm.number && (
                                                                <span className="px-1.5 py-0.5 rounded bg-amber-500 text-slate-950 text-[10px] font-black">
                                                                    #{dm.number}
                                                                </span>
                                                            )}
                                                            {dm.position && (
                                                                <span className="px-1.5 py-0.5 rounded bg-surface-1 border border-border text-[10px] font-extrabold text-foreground">
                                                                    {dm.position}
                                                                </span>
                                                            )}
                                                            <span className="text-xs font-extrabold text-foreground break-words">
                                                                {dm.name || "Key Threat"}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="text-[10px] font-bold text-muted-foreground">
                                                                {dm.foot} foot
                                                            </span>
                                                            <button
                                                                type="button"
                                                                onClick={(e) => handleSendDangerManToBlackBook(dm, e)}
                                                                disabled={sentDangerManIds.has(dm.id)}
                                                                className={`px-2 py-0.5 rounded-md text-[10px] font-bold border transition-colors flex items-center gap-1 ${
                                                                    sentDangerManIds.has(dm.id)
                                                                        ? "bg-emerald-500/15 text-emerald-500 border-emerald-500/30"
                                                                        : "bg-surface-1 hover:bg-brand/10 text-brand border-brand/30"
                                                                }`}
                                                                title="Add this opposition player to your Recruitment Black Book"
                                                            >
                                                                <UserPlus className="h-2.5 w-2.5" />
                                                                {sentDangerManIds.has(dm.id) ? "In Black Book ✓" : "+ Black Book"}
                                                            </button>
                                                        </div>
                                                    </div>
                                                    {(dm.strengths || dm.weaknesses) && (
                                                        <div className="flex flex-wrap gap-1.5 pt-0.5">
                                                            {dm.strengths && (
                                                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                                                                    💪 {dm.strengths}
                                                                </span>
                                                            )}
                                                            {dm.weaknesses && (
                                                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-500/10 border border-rose-500/30 text-rose-400">
                                                                    🎯 {dm.weaknesses}
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}
                                                    {dm.notes && (
                                                        <p className="text-xs text-muted-foreground whitespace-pre-wrap break-words leading-relaxed">
                                                            {dm.notes}
                                                        </p>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}

                            {isEditing ? (
                                <textarea
                                    value={editedReport?.dangerMen || ""}
                                    onChange={(e) =>
                                        setEditedReport((prev) =>
                                            prev ? { ...prev, dangerMen: e.target.value } : null
                                        )
                                    }
                                    placeholder="Quick player notes — write 'Player Name - note' on each line to auto-format into player callout cards..."
                                    className="w-full min-h-[75px] rounded-xl border border-border bg-surface-2 p-2.5 text-base sm:text-xs text-foreground placeholder:text-muted-foreground outline-none"
                                />
                            ) : activeReport.dangerMen ? (
                                <div
                                    onClick={handleEditReport}
                                    className="space-y-1.5 cursor-text"
                                >
                                    {parseScoutingNotesIntoItems(activeReport.dangerMen).map((item, idx) =>
                                        item.subject ? (
                                            <div
                                                key={idx}
                                                className="flex items-start gap-2 rounded-lg bg-surface-2/80 border border-border p-2"
                                            >
                                                <span className="px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-500/35 text-amber-400 text-[10px] font-extrabold shrink-0">
                                                    {item.subject}
                                                </span>
                                                <span className="text-xs text-foreground leading-snug break-words">
                                                    {item.detail}
                                                </span>
                                            </div>
                                        ) : (
                                            <p
                                                key={idx}
                                                className="text-xs text-foreground whitespace-pre-wrap break-words leading-relaxed"
                                            >
                                                {item.detail}
                                            </p>
                                        )
                                    )}
                                </div>
                            ) : (activeReport.dangerMenList || []).length === 0 ? (
                                <p
                                    onClick={handleEditReport}
                                    className="text-xs text-muted-foreground italic cursor-text py-1"
                                >
                                    No danger men logged yet. Tap here or + Player to add key threats...
                                </p>
                            ) : null}
                        </div>

                        {/* Strengths Card (Mobile) */}
                        <div className="rounded-2xl bg-surface-1 border border-border border-l-4 border-l-emerald-500 p-3.5 space-y-2 shadow-xs">
                            <h3 className="text-xs font-black uppercase tracking-wider text-emerald-500 flex items-center gap-1.5">
                                <Sparkles className="h-3.5 w-3.5" />
                                Their Strengths
                            </h3>
                            {isEditing ? (
                                <textarea
                                    value={editedReport?.strengths || ""}
                                    onChange={(e) =>
                                        setEditedReport((prev) =>
                                            prev ? { ...prev, strengths: e.target.value } : null
                                        )
                                    }
                                    placeholder="What are they good at? (e.g. Physical midfield, fast wingers, dangerous on corners)..."
                                    className="w-full min-h-[90px] rounded-xl border border-border bg-surface-2 p-2.5 text-base sm:text-xs text-foreground outline-none"
                                />
                            ) : (
                                <p
                                    onClick={handleEditReport}
                                    className="text-xs text-foreground whitespace-pre-wrap break-words leading-relaxed cursor-text py-1"
                                >
                                    {activeReport.strengths || (
                                        <span className="text-muted-foreground italic">
                                            No strengths logged yet. Tap here to type...
                                        </span>
                                    )}
                                </p>
                            )}
                        </div>

                        {/* Weaknesses Card (Mobile) */}
                        <div className="rounded-2xl bg-surface-1 border border-border border-l-4 border-l-rose-500 p-3.5 space-y-2 shadow-xs">
                            <h3 className="text-xs font-black uppercase tracking-wider text-rose-500 flex items-center gap-1.5">
                                <Target className="h-3.5 w-3.5" />
                                Their Weaknesses (How We Hurt Them)
                            </h3>
                            {isEditing ? (
                                <textarea
                                    value={editedReport?.weaknesses || ""}
                                    onChange={(e) =>
                                        setEditedReport((prev) =>
                                            prev ? { ...prev, weaknesses: e.target.value } : null
                                        )
                                    }
                                    placeholder="Where can we exploit them? (e.g. Slow CBs against balls in behind, GK struggles under high crosses)..."
                                    className="w-full min-h-[90px] rounded-xl border border-border bg-surface-2 p-2.5 text-base sm:text-xs text-foreground outline-none"
                                />
                            ) : (
                                <p
                                    onClick={handleEditReport}
                                    className="text-xs text-foreground whitespace-pre-wrap break-words leading-relaxed cursor-text py-1"
                                >
                                    {activeReport.weaknesses || (
                                        <span className="text-muted-foreground italic">
                                            No weaknesses logged yet. Tap here to type...
                                        </span>
                                    )}
                                </p>
                            )}
                        </div>
                    </div>
                )}

                {/* 8. MOBILE TAB CONTENT: TACTICS (IN POSSESSION, OUT OF POSSESSION, TRANSITION, SET PIECES) */}
                {(mobileTab === "all" || mobileTab === "tactics") && (
                    <div className="space-y-3">
                        {/* In Possession */}
                        <div className="rounded-2xl bg-surface-1 border border-border border-l-4 border-l-blue-500 p-3.5 space-y-2 shadow-xs">
                            <h3 className="text-xs font-black uppercase tracking-wider text-blue-500 flex items-center gap-1.5">
                                <Users className="h-3.5 w-3.5" />
                                In Possession (Build-Up &amp; Shape)
                            </h3>
                            {isEditing ? (
                                <textarea
                                    value={editedReport?.inPossession || ""}
                                    onChange={(e) =>
                                        setEditedReport((prev) =>
                                            prev ? { ...prev, inPossession: e.target.value } : null
                                        )
                                    }
                                    placeholder="How do they build up and attack? (e.g. Play short to #6 or go direct to #9?)..."
                                    className="w-full min-h-[90px] rounded-xl border border-border bg-surface-2 p-2.5 text-base sm:text-xs text-foreground outline-none"
                                />
                            ) : (
                                <p
                                    onClick={handleEditReport}
                                    className="text-xs text-foreground whitespace-pre-wrap break-words leading-relaxed cursor-text py-1"
                                >
                                    {activeReport.inPossession || (
                                        <span className="text-muted-foreground italic">
                                            No in-possession notes logged yet. Tap here to type...
                                        </span>
                                    )}
                                </p>
                            )}
                        </div>

                        {/* Out of Possession */}
                        <div className="rounded-2xl bg-surface-1 border border-border border-l-4 border-l-purple-500 p-3.5 space-y-2 shadow-xs">
                            <h3 className="text-xs font-black uppercase tracking-wider text-purple-500 flex items-center gap-1.5">
                                <Swords className="h-3.5 w-3.5" />
                                Out of Possession (Defensive Shape &amp; Press)
                            </h3>
                            {isEditing ? (
                                <textarea
                                    value={editedReport?.outOfPossession || ""}
                                    onChange={(e) =>
                                        setEditedReport((prev) =>
                                            prev ? { ...prev, outOfPossession: e.target.value } : null
                                        )
                                    }
                                    placeholder="How do they defend? (e.g. High line with aggressive press, or compact mid/low block?)..."
                                    className="w-full min-h-[90px] rounded-xl border border-border bg-surface-2 p-2.5 text-base sm:text-xs text-foreground outline-none"
                                />
                            ) : (
                                <p
                                    onClick={handleEditReport}
                                    className="text-xs text-foreground whitespace-pre-wrap break-words leading-relaxed cursor-text py-1"
                                >
                                    {activeReport.outOfPossession || (
                                        <span className="text-muted-foreground italic">
                                            No out-of-possession notes logged yet. Tap here to type...
                                        </span>
                                    )}
                                </p>
                            )}
                        </div>

                        {/* Transition */}
                        <div className="rounded-2xl bg-surface-1 border border-border border-l-4 border-l-orange-500 p-3.5 space-y-2 shadow-xs">
                            <h3 className="text-xs font-black uppercase tracking-wider text-orange-500 flex items-center gap-1.5">
                                <Zap className="h-3.5 w-3.5" />
                                Transition (Attacking &amp; Defensive)
                            </h3>
                            {isEditing ? (
                                <textarea
                                    value={editedReport?.transition || ""}
                                    onChange={(e) =>
                                        setEditedReport((prev) =>
                                            prev ? { ...prev, transition: e.target.value } : null
                                        )
                                    }
                                    placeholder="What happens when the ball turns over? (e.g. Early ball over the top to wingers; slow to track back)..."
                                    className="w-full min-h-[90px] rounded-xl border border-border bg-surface-2 p-2.5 text-base sm:text-xs text-foreground outline-none"
                                />
                            ) : (
                                <p
                                    onClick={handleEditReport}
                                    className="text-xs text-foreground whitespace-pre-wrap break-words leading-relaxed cursor-text py-1"
                                >
                                    {activeReport.transition || (
                                        <span className="text-muted-foreground italic">
                                            No transition notes logged yet. Tap here to type...
                                        </span>
                                    )}
                                </p>
                            )}
                        </div>

                        {/* Set Pieces */}
                        <div className="rounded-2xl bg-surface-1 border border-border border-l-4 border-l-cyan-500 p-3.5 space-y-2 shadow-xs">
                            <h3 className="text-xs font-black uppercase tracking-wider text-cyan-500 flex items-center gap-1.5">
                                <Flag className="h-3.5 w-3.5" />
                                Set Pieces (Corners, Free Kicks &amp; Throws)
                            </h3>
                            {isEditing ? (
                                <textarea
                                    value={editedReport?.setPieces || ""}
                                    onChange={(e) =>
                                        setEditedReport((prev) =>
                                            prev ? { ...prev, setPieces: e.target.value } : null
                                        )
                                    }
                                    placeholder="Inswinging corners to near post? Long throw specialist? Zonal or man-marking?..."
                                    className="w-full min-h-[90px] rounded-xl border border-border bg-surface-2 p-2.5 text-base sm:text-xs text-foreground outline-none"
                                />
                            ) : (
                                <p
                                    onClick={handleEditReport}
                                    className="text-xs text-foreground whitespace-pre-wrap break-words leading-relaxed cursor-text py-1"
                                >
                                    {activeReport.setPieces || (
                                        <span className="text-muted-foreground italic">
                                            No set-piece notes logged yet. Tap here to type...
                                        </span>
                                    )}
                                </p>
                            )}
                        </div>
                    </div>
                )}

                {/* 9. MOBILE TAB CONTENT: PITCH & XI */}
                {(mobileTab === "pitch" || (mobileTab === "all" && showPitchSection)) && (
                    <div className="rounded-2xl bg-surface-1 border border-border overflow-hidden shadow-xs">
                        <div className="p-3.5 flex flex-wrap items-center justify-between gap-2 border-b border-border">
                            <div>
                                <h3 className="text-xs font-black uppercase tracking-wider text-foreground">
                                    {activeReport.name || "Opposition"} ({activeReport.formation} • {activeOppFormat})
                                </h3>
                                <p className="text-[10px] text-muted-foreground">
                                    Tap any shirt number on the pitch to log player strengths, weaknesses &amp; role
                                </p>
                            </div>
                            <div className="flex items-center gap-1.5">
                                {enabledFormats.length > 1 && (
                                    <div className="inline-flex items-center p-0.5 rounded-lg bg-surface-2 border border-border">
                                        {enabledFormats.map((fmt) => (
                                            <button
                                                key={fmt}
                                                type="button"
                                                onClick={() => handleOppFormatChange(fmt)}
                                                className={`px-1.5 py-0.5 rounded text-[9px] font-black transition-all ${
                                                    activeOppFormat === fmt
                                                        ? "bg-brand text-brand-foreground"
                                                        : "text-muted-foreground hover:text-foreground"
                                                }`}
                                            >
                                                {fmt}
                                            </button>
                                        ))}
                                    </div>
                                )}
                                {mobileTab === "all" && (
                                    <button
                                        type="button"
                                        onClick={() => setShowPitchSection(false)}
                                        className="text-[11px] font-bold text-muted-foreground ml-1"
                                    >
                                        Hide
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Pitch Canvas */}
                        <div className="relative w-full bg-emerald-700" style={{ paddingBottom: "88%" }}>
                            <div className="absolute inset-0 opacity-40">
                                <div className="absolute inset-3 border-2 border-white/60 rounded-sm"></div>
                                <div className="absolute left-3 right-3 top-1/2 border-t-2 border-white/60"></div>
                                {(activeOppFormat === "5v5" || activeOppFormat === "7v7") && (
                                    <>
                                        <div className="absolute left-3 right-3 top-[34%] border-t border-dashed border-white/45"></div>
                                        <div className="absolute left-3 right-3 top-[66%] border-t border-dashed border-white/45"></div>
                                    </>
                                )}
                                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 border-2 border-white/60 rounded-full"></div>
                                <div className="absolute left-1/2 -translate-x-1/2 top-3 w-28 h-12 border-2 border-white/60 border-t-0"></div>
                                <div className="absolute left-1/2 -translate-x-1/2 bottom-3 w-28 h-12 border-2 border-white/60 border-b-0"></div>
                            </div>

                            {formationPositions.map((pos, idx) => {
                                const profile = (activeReport.playerProfiles || []).find(
                                    (p) => p.positionIndex === idx
                                );
                                const playerName = (activeReport.lineup?.[idx] || "").trim();
                                const shortPitchName = playerName ? formatPitchPlayerName(playerName) : "";
                                const hasProfileData = Boolean(
                                    profile?.role || profile?.strengths || profile?.weaknesses || profile?.traits
                                );
                                // Clamp wide x positions slightly inward on narrow mobile screens so name pills stay cleanly inside the touchlines
                                const mobileClampedX = Math.min(82, Math.max(18, pos.x));
                                return (
                                    <div
                                        key={idx}
                                        className="absolute z-20 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-0.5 cursor-pointer"
                                        style={{ left: `${mobileClampedX}%`, top: `${pos.y}%` }}
                                        onClick={() => handleOpenPositionProfile(idx)}
                                    >
                                        <div
                                            className={`w-7 h-7 bg-white border-2 rounded-full flex items-center justify-center shadow-lg ${
                                                hasProfileData ? "border-amber-500" : "border-red-600"
                                            }`}
                                        >
                                            <span className="text-[11px] font-black text-slate-900 leading-none">
                                                {pos.number}
                                            </span>
                                        </div>
                                        {shortPitchName ? (
                                            <span
                                                title={playerName}
                                                className="text-[10px] font-black tracking-tight text-white bg-slate-950/95 border border-white/30 px-1.5 py-0.5 rounded shadow-md whitespace-nowrap leading-none"
                                            >
                                                {shortPitchName}
                                            </span>
                                        ) : (
                                            <span className="text-[9px] font-extrabold text-white/85 bg-slate-900/80 border border-white/15 px-1.5 py-0.5 rounded shadow-xs whitespace-nowrap leading-none">
                                                {getDisplayPosition(pos.label)}
                                            </span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        {/* Mobile Lineup List */}
                        <div className="p-3 space-y-1.5">
                            {formationPositions.map((pos, idx) => {
                                const profile = (activeReport.playerProfiles || []).find(
                                    (p) => p.positionIndex === idx
                                );
                                return (
                                    <div
                                        key={idx}
                                        onClick={() => handleOpenPositionProfile(idx)}
                                        className="p-2 rounded-xl bg-surface-2/70 border border-border cursor-pointer space-y-1.5"
                                    >
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 rounded-full bg-brand text-brand-foreground flex items-center justify-center shrink-0 text-[10px] font-black">
                                                {pos.number}
                                            </div>
                                            <span className="text-[11px] font-extrabold text-muted-foreground w-9 shrink-0">
                                                {getDisplayPosition(pos.label)}
                                            </span>
                                            <input
                                                type="text"
                                                value={activeReport.lineup?.[idx] || ""}
                                                onChange={(e) => handleUpdateLineupName(idx, e.target.value)}
                                                onClick={(e) => e.stopPropagation()}
                                                placeholder="Add player name..."
                                                className="flex-1 text-base sm:text-xs font-bold bg-surface-1 border border-border rounded-lg px-2.5 py-1.5 text-foreground outline-none focus:border-brand"
                                            />
                                            {profile?.role && (
                                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-500 shrink-0">
                                                    {profile.role}
                                                </span>
                                            )}
                                        </div>
                                        {(profile?.strengths || profile?.weaknesses || profile?.traits) && (
                                            <div className="flex flex-wrap gap-1 pl-8">
                                                {profile?.strengths && (
                                                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                                                        💪 {profile.strengths}
                                                    </span>
                                                )}
                                                {profile?.weaknesses && (
                                                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-500/10 border border-rose-500/30 text-rose-400">
                                                        🎯 {profile.weaknesses}
                                                    </span>
                                                )}
                                                {profile?.traits && (
                                                    <span className="text-[9px] text-muted-foreground">
                                                        {profile.traits}
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {mobileTab === "all" && !showPitchSection && (
                    <button
                        type="button"
                        onClick={() => setShowPitchSection(true)}
                        className="w-full py-2.5 px-3 rounded-xl bg-surface-1 border border-border text-xs font-extrabold text-foreground flex items-center justify-center gap-1.5"
                    >
                        <Eye className="h-3.5 w-3.5 text-brand" />
                        Show Optional Tactical Pitch &amp; {activeOppFormat} Lineup ({activeReport.formation})
                    </button>
                )}

                {/* 10. MOBILE TAB CONTENT: POST-MATCH REVIEW & FULL H2H LOG */}
                {(mobileTab === "all" || mobileTab === "review") && (
                    <div className="space-y-3">
                        <div className="rounded-2xl bg-surface-1 border border-border p-3.5 space-y-2 shadow-xs">
                            <div className="flex items-center justify-between gap-2">
                                <h3 className="text-xs font-black uppercase tracking-wider text-foreground flex items-center gap-1.5">
                                    <ClipboardCheck className="h-4 w-4 text-brand" />
                                    Post-Match Review &amp; Notes for Next Time
                                </h3>
                                {!isEditing && (
                                    <button
                                        type="button"
                                        onClick={handleEditReport}
                                        className="text-[11px] font-bold text-brand"
                                    >
                                        + Add Note
                                    </button>
                                )}
                            </div>
                            {isEditing ? (
                                <textarea
                                    value={editedReport?.postMatchReview || ""}
                                    onChange={(e) =>
                                        setEditedReport((prev) =>
                                            prev ? { ...prev, postMatchReview: e.target.value } : null
                                        )
                                    }
                                    placeholder="Log what worked after full-time so you have it ready for the reverse fixture..."
                                    className="w-full min-h-[85px] rounded-xl border border-border bg-surface-2 p-2.5 text-base sm:text-xs text-foreground outline-none"
                                />
                            ) : (
                                <p
                                    onClick={handleEditReport}
                                    className="text-xs text-foreground whitespace-pre-wrap break-words leading-relaxed cursor-text py-1"
                                >
                                    {activeReport.postMatchReview || activeReport.generalNotes || (
                                        <span className="text-muted-foreground italic">
                                            No post-match notes recorded yet. Tap here to type...
                                        </span>
                                    )}
                                </p>
                            )}
                        </div>

                        {mobileTab === "review" && h2hData.past.length > 0 && (
                            <div className="rounded-2xl bg-surface-1 border border-border p-3.5 space-y-2 shadow-xs">
                                <h3 className="text-xs font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                    <History className="h-3.5 w-3.5 text-brand" />
                                    Previous Meetings vs {activeReport.name}
                                </h3>
                                <div className="space-y-1.5">
                                    {h2hData.past.map((m: any) => (
                                        <div
                                            key={m.id}
                                            className="p-2.5 rounded-xl bg-surface-2/70 border border-border flex items-center justify-between gap-2"
                                        >
                                            <div className="flex items-center gap-2 min-w-0">
                                                <span
                                                    className={`w-5 h-5 rounded text-[10px] font-black flex items-center justify-center shrink-0 ${
                                                        m.result === "Win"
                                                            ? "bg-emerald-500 text-white"
                                                            : m.result === "Draw"
                                                                ? "bg-amber-500 text-white"
                                                                : "bg-rose-500 text-white"
                                                    }`}
                                                >
                                                    {m.result?.[0]}
                                                </span>
                                                <div className="min-w-0">
                                                    <div className="text-xs font-black text-foreground">
                                                        {m.scoreline} ({m.isHome ? "Home" : "Away"})
                                                    </div>
                                                    {m.goalscorers && (
                                                        <div className="text-[10px] text-muted-foreground truncate">
                                                            ⚽ {m.goalscorers}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            <span className="text-[10px] font-bold text-muted-foreground shrink-0">
                                                {formatDateShort(m.date)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* 11. FLOATING MOBILE SAVE BAR WHEN EDITING */}
                {isEditing && (
                    <div className="fixed bottom-[4.25rem] left-3 right-3 z-50 rounded-2xl bg-surface-1/95 backdrop-blur-md border border-brand/40 p-2.5 shadow-2xl flex items-center justify-between gap-2">
                        <span className="text-[11px] font-extrabold text-foreground truncate pl-1">
                            Editing: {editedReport?.name || "New Report"}
                        </span>
                        <div className="flex items-center gap-1.5 shrink-0">
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={handleCancelEdit}
                                className="h-8 px-3 rounded-xl border-border bg-surface-2 text-xs font-bold"
                            >
                                Cancel
                            </Button>
                            <Button
                                size="sm"
                                onClick={handleSaveReport}
                                className="h-8 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold"
                            >
                                <Save className="h-3.5 w-3.5 mr-1" />
                                Save Report
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            {/* ================================================================= */}
            {/* DESKTOP OPPOSITION REPORTS (>= 768px — UNTOUCHED)                 */}
            {/* ================================================================= */}
            <div className="hidden md:block space-y-6">
            {/* ================================================================= */}
            {/* PAGE HEADER (Responsive Mobile & Desktop)                         */}
            {/* ================================================================= */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                    <h2 className="text-2xl md:text-3xl font-black tracking-tight text-foreground">
                        Opposition Reports
                    </h2>
                    <p className="text-xs md:text-sm text-muted-foreground">
                        Tactical dossiers, danger men, league form &amp; head-to-head history
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        size="sm"
                        onClick={handleStartNewReport}
                        className="bg-brand hover:bg-brand/90 text-brand-foreground font-bold shadow-xs"
                    >
                        <Plus className="h-4 w-4 mr-1.5" />
                        New Scouting Report
                    </Button>
                </div>
            </div>

            {/* ================================================================= */}
            {/* #1: "UP NEXT" MATCHWEEK SCOUTING BANNER                           */}
            {/* ================================================================= */}
            {nextMatch && (
                <div className="rounded-2xl border border-brand/30 bg-surface-1 p-3.5 md:p-4 shadow-xs border-l-4 border-l-brand flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-brand/15 text-brand text-[10px] font-black uppercase tracking-wider">
                                <Zap className="h-3 w-3 fill-brand" /> Up Next Opponent
                            </span>
                            <span className="text-xs font-bold text-muted-foreground">
                                {formatDateShort(nextMatch.date)} • KO {nextMatch.time} ({nextMatch.isHome ? "HOME" : "AWAY"})
                            </span>
                            {nextMatchLeagueRow && (
                                <span className="px-2 py-0.5 rounded bg-surface-2 border border-border text-[10px] font-extrabold text-foreground">
                                    League #{nextMatchLeagueRow.position} • {nextMatchLeagueRow.points} pts
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-base md:text-lg font-black text-foreground truncate">
                                vs {nextMatch.opponent}
                            </span>
                            {nextMatchHasReport ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-500">
                                    <CheckCircle2 className="h-3.5 w-3.5" /> Report Ready
                                </span>
                            ) : (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-500">
                                    <AlertTriangle className="h-3.5 w-3.5" /> No Scouting Report Yet
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                        <Button
                            size="sm"
                            variant={nextMatchHasReport ? "secondary" : "default"}
                            onClick={() => handleOpenOrStartForTeam(nextMatch.opponent)}
                            className={
                                nextMatchHasReport
                                    ? "bg-surface-2 hover:bg-surface-2/80 text-foreground border border-border font-bold text-xs"
                                    : "bg-brand hover:bg-brand/90 text-brand-foreground font-bold text-xs"
                            }
                        >
                            <Target className="h-3.5 w-3.5 mr-1.5" />
                            {nextMatchHasReport
                                ? `Open ${nextMatch.opponent} Report`
                                : `Start Report for ${nextMatch.opponent}`}
                        </Button>
                    </div>
                </div>
            )}

            {/* ================================================================= */}
            {/* #14: MOBILE TEAM SELECTOR & DIRECTORY BAR (< 1024px)              */}
            {/* ================================================================= */}
            <div className="lg:hidden space-y-2.5 bg-surface-1 border border-border rounded-2xl p-3">
                <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground">
                        Select Saved Report or League Team
                    </span>
                    <span className="text-[11px] font-bold text-brand">
                        {reports.length} Saved
                    </span>
                </div>

                {/* Horizontal scrollable pill strip of Saved Reports + Known League Teams */}
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
                    {reports.map((rep) => {
                        const isSelected = activeReport.id === rep.id || isMatchingTeam(activeReport.name, rep.name);
                        const lRow = leagueRows.find((r: any) => isMatchingTeam(r.team_name || r.name || "", rep.name));
                        return (
                            <button
                                key={rep.id}
                                type="button"
                                onClick={() => handleSelectReport(rep)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap border transition-colors flex items-center gap-1.5 shrink-0 ${
                                    isSelected
                                        ? "bg-brand text-brand-foreground border-brand shadow-xs"
                                        : "bg-surface-2 text-foreground border-border hover:border-brand/40"
                                }`}
                            >
                                <span>{rep.name}</span>
                                {lRow?.position && (
                                    <span className="text-[10px] opacity-80 font-black">#{lRow.position}</span>
                                )}
                            </button>
                        );
                    })}

                    {knownOpponentsDirectory
                        .filter((dir) => !reports.some((r) => isMatchingTeam(r.name, dir.name)))
                        .map((dir) => (
                            <button
                                key={dir.name}
                                type="button"
                                onClick={() => handleOpenOrStartForTeam(dir.name)}
                                className="px-2.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap border border-dashed border-border bg-surface-1 text-muted-foreground hover:text-foreground flex items-center gap-1 shrink-0"
                            >
                                <Plus className="h-3 w-3 text-brand" />
                                <span>{dir.name}</span>
                                {dir.position && <span className="text-[10px] font-bold">#{dir.position}</span>}
                            </button>
                        ))}
                </div>
            </div>

            {/* ================================================================= */}
            {/* MAIN 12-COLUMN WORKSPACE (Desktop Sidebar + Report Dossier)       */}
            {/* ================================================================= */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* LEFT PANEL: Desktop Team Directory & Saved Reports (Span 3) */}
                <Card className="hidden lg:block lg:col-span-3 h-fit sticky top-6 bg-surface-1 border-border">
                    <CardHeader className="p-4 pb-3 space-y-2.5 border-b border-border">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                            <Input
                                placeholder="Search opponent..."
                                value={teamSearch}
                                onChange={(e) => setTeamSearch(e.target.value)}
                                className="pl-8 h-8 text-xs bg-surface-2 border-border"
                            />
                        </div>
                    </CardHeader>

                    <CardContent className="p-3 space-y-4 max-h-[75vh] overflow-y-auto">
                        {/* Saved Scouting Reports */}
                        <div>
                            <div className="flex items-center justify-between px-1.5 mb-1.5">
                                <span className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider">
                                    Saved Reports ({filteredSavedReports.length})
                                </span>
                            </div>
                            {filteredSavedReports.length === 0 ? (
                                <p className="px-2 py-3 text-xs text-muted-foreground italic">
                                    No saved reports matching search.
                                </p>
                            ) : (
                                <div className="space-y-1">
                                    {filteredSavedReports.map((rep) => {
                                        const isSelected = selectedReport?.id === rep.id && !isEditing;
                                        const lRow = leagueRows.find((r: any) =>
                                            isMatchingTeam(r.team_name || r.name || "", rep.name)
                                        );
                                        return (
                                            <div
                                                key={rep.id}
                                                onClick={() => handleSelectReport(rep)}
                                                className={`group flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all border ${
                                                    isSelected
                                                        ? "bg-brand/10 border-brand/40 text-foreground shadow-xs"
                                                        : "border-transparent hover:bg-surface-2 text-muted-foreground hover:text-foreground"
                                                }`}
                                            >
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="text-xs font-extrabold text-foreground truncate">
                                                            {rep.name}
                                                        </span>
                                                        {lRow?.position && (
                                                            <span className="px-1.5 py-0.2 rounded bg-surface-2 border border-border text-[9px] font-black text-brand shrink-0">
                                                                #{lRow.position}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="text-[10px] text-muted-foreground flex items-center gap-2 mt-0.5">
                                                        <span>{rep.formation}</span>
                                                        <span>•</span>
                                                        <span>{formatDateShort(rep.updatedAt)}</span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <button
                                                        type="button"
                                                        onClick={(e) => handleDeleteReport(rep.id, e)}
                                                        className="opacity-0 group-hover:opacity-100 h-6 w-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition-opacity"
                                                        title="Delete Report"
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </button>
                                                    <ChevronRight className={`h-4 w-4 ${isSelected ? "text-brand" : "text-muted-foreground/40"}`} />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* #2: League & Fixture Opponents Quick-Start List */}
                        {filteredDirectoryTeams.length > 0 && (
                            <div className="pt-2 border-t border-border">
                                <div className="flex items-center justify-between px-1.5 mb-1.5">
                                    <span className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider">
                                        League &amp; Schedule Teams
                                    </span>
                                </div>
                                <div className="space-y-1">
                                    {filteredDirectoryTeams.map((dir) => {
                                        const existingReport = reports.find((r) => isMatchingTeam(r.name, dir.name));
                                        return (
                                            <button
                                                key={dir.name}
                                                type="button"
                                                onClick={() => handleOpenOrStartForTeam(dir.name)}
                                                className="w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-left hover:bg-surface-2 transition-colors group"
                                            >
                                                <div className="min-w-0 flex-1 flex items-center gap-1.5">
                                                    {dir.position && (
                                                        <span className="w-5 text-[10px] font-black text-muted-foreground tabular-nums">
                                                            #{dir.position}
                                                        </span>
                                                    )}
                                                    <span className="text-xs font-semibold text-foreground truncate">
                                                        {dir.name}
                                                    </span>
                                                </div>
                                                {existingReport ? (
                                                    <span className="text-[10px] font-bold text-emerald-500 shrink-0">
                                                        Saved
                                                    </span>
                                                ) : (
                                                    <span className="text-[10px] font-bold text-brand opacity-75 group-hover:opacity-100 shrink-0">
                                                        + Scout
                                                    </span>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* RIGHT PANEL: Main Scouting Dossier (Span 9) */}
                <div className="lg:col-span-9 space-y-4 md:space-y-5">
                    {/* 1. REPORT HEADER & FORMATION / ACTION BAR */}
                    <Card className="bg-surface-1 border-border shadow-xs">
                        <CardContent className="p-4 md:p-5 space-y-4">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                    {isEditing ? (
                                        <div className="grid grid-cols-1 sm:grid-cols-[1fr_200px_160px] gap-3">
                                            <div className="space-y-1">
                                                <Label className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
                                                    Opposition Team Name
                                                </Label>
                                                <Input
                                                    list="opposition-known-teams"
                                                    value={editedReport?.name || ""}
                                                    onChange={(e) =>
                                                        setEditedReport((prev) =>
                                                            prev ? { ...prev, name: e.target.value } : null
                                                        )
                                                    }
                                                    placeholder="Select or type opponent (e.g. Stonewall, Hackney Wick)..."
                                                    className="h-10 text-base font-black bg-surface-2 border-border"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
                                                    Competition
                                                </Label>
                                                <Input
                                                    value={editedReport?.competition || ""}
                                                    onChange={(e) =>
                                                        setEditedReport((prev) =>
                                                            prev ? { ...prev, competition: e.target.value } : null
                                                        )
                                                    }
                                                    placeholder={activeFixture?.competition || "e.g. League, Cup..."}
                                                    className="h-10 text-xs font-bold bg-surface-2 border-border"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
                                                    Expected Shape ({activeOppFormat})
                                                </Label>
                                                <select
                                                    value={editedReport?.formation || "4-2-3-1"}
                                                    onChange={(e) =>
                                                        setEditedReport((prev) =>
                                                            prev ? { ...prev, formation: e.target.value } : null
                                                        )
                                                    }
                                                    className="w-full h-10 px-3 rounded-md border border-border bg-surface-2 text-xs font-bold text-foreground outline-none"
                                                >
                                                    {(["11v11", "9v9", "7v7", "5v5"] as const)
                                                        .filter((fmt) => enabledFormats.includes(fmt) || fmt === activeOppFormat)
                                                        .map((fmt) => (
                                                            <optgroup key={fmt} label={`${fmt} Formations`}>
                                                                {FORMATIONS_BY_FORMAT[fmt].map((name) => (
                                                                    <option key={name} value={name}>
                                                                        {enabledFormats.length > 1 ? `${name} (${fmt})` : name}
                                                                    </option>
                                                                ))}
                                                            </optgroup>
                                                        ))}
                                                </select>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="text-[11px] font-extrabold uppercase tracking-wider text-brand bg-brand/10 px-2.5 py-0.5 rounded border border-brand/20">
                                                    {activeCompetitionLabel}
                                                    {activeFixtureDateStr ? ` • ${activeFixtureDateStr}` : ""}
                                                </span>
                                                <Badge variant="outline" className="text-[11px] font-extrabold">
                                                    Shape: {activeReport.formation} ({activeOppFormat})
                                                </Badge>
                                                <span className="text-[11px] text-muted-foreground">
                                                    Updated {formatDateShort(activeReport.updatedAt)}
                                                </span>
                                            </div>
                                            <h1 className="text-2xl md:text-3xl font-black text-foreground tracking-tight break-words leading-tight">
                                                {activeFixtureTitle}
                                            </h1>
                                        </div>
                                    )}
                                </div>

                                {/* Action Buttons */}
                                <div className="flex flex-wrap items-center gap-2 shrink-0">
                                    {isEditing ? (
                                        <>
                                            <Button
                                                size="sm"
                                                onClick={handleSaveReport}
                                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex-1 sm:flex-none"
                                            >
                                                <Save className="h-4 w-4 mr-1.5" />
                                                Save Report
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={handleCancelEdit}
                                                className="border-border bg-surface-2 text-foreground font-semibold flex-1 sm:flex-none"
                                            >
                                                <X className="h-4 w-4 mr-1.5" />
                                                Cancel
                                            </Button>
                                        </>
                                    ) : (
                                        <>
                                            <Button
                                                size="sm"
                                                onClick={handleEditReport}
                                                className="bg-brand hover:bg-brand/90 text-brand-foreground font-bold"
                                            >
                                                <Edit2 className="h-3.5 w-3.5 mr-1.5" />
                                                Edit Report
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                disabled={isGeneratingGraphic}
                                                onClick={handleShareGraphic}
                                                className="border-border bg-surface-2 hover:bg-surface-2/80 text-foreground font-bold"
                                            >
                                                <Share2 className="h-3.5 w-3.5 mr-1.5 text-brand" />
                                                {isGeneratingGraphic ? "Creating..." : "Share"}
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={handleExportPDF}
                                                className="border-border bg-surface-2 hover:bg-surface-2/80 text-foreground font-semibold"
                                            >
                                                <FileDown className="h-3.5 w-3.5 mr-1.5" />
                                                PDF
                                            </Button>
                                            {selectedReport && (
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => handleDeleteReport(selectedReport.id)}
                                                    className="text-rose-500 hover:text-rose-400 hover:bg-rose-500/10 px-2"
                                                    title="Delete Report"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* ========================================================= */}
                            {/* #3 & #4: LIVE LEAGUE STANDINGS + HEAD-TO-HEAD STRIP       */}
                            {/* ========================================================= */}
                            {activeReport.name.trim() && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-3 border-t border-border">
                                    {/* #3: Live League Standings Box */}
                                    <div className="rounded-xl bg-surface-2/70 border border-border p-3 flex flex-col justify-between gap-2">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                                <Trophy className="h-3.5 w-3.5 text-amber-500" />
                                                Live League Standing
                                            </span>
                                            {activeLeagueStats && (
                                                <span className="px-2 py-0.5 rounded-md bg-brand/15 text-brand border border-brand/30 text-xs font-black">
                                                    Position #{activeLeagueStats.position}
                                                </span>
                                            )}
                                        </div>

                                        {activeLeagueStats ? (
                                            <div className="flex flex-wrap items-center justify-between gap-2">
                                                <div className="flex items-center gap-3 text-xs font-bold text-foreground tabular-nums">
                                                    <span>{activeLeagueStats.played}P</span>
                                                    <span className="text-emerald-500">{activeLeagueStats.won}W</span>
                                                    <span className="text-amber-500">{activeLeagueStats.drawn}D</span>
                                                    <span className="text-rose-500">{activeLeagueStats.lost}L</span>
                                                    <span>
                                                        GD{" "}
                                                        {activeLeagueStats.goal_difference > 0
                                                            ? `+${activeLeagueStats.goal_difference}`
                                                            : activeLeagueStats.goal_difference}
                                                    </span>
                                                    <span className="text-brand font-black">{activeLeagueStats.points} PTS</span>
                                                </div>

                                                {activeLeagueStats.form && (
                                                    <div className="flex items-center gap-1">
                                                        {String(activeLeagueStats.form)
                                                            .replace(/[^WDL]/gi, "")
                                                            .slice(-5)
                                                            .split("")
                                                            .map((ch: string, idx: number) => {
                                                                const u = ch.toUpperCase();
                                                                const badgeCls =
                                                                    u === "W"
                                                                        ? "bg-emerald-500 text-white"
                                                                        : u === "D"
                                                                            ? "bg-amber-500 text-white"
                                                                            : "bg-rose-500 text-white";
                                                                return (
                                                                    <span
                                                                        key={idx}
                                                                        className={`w-5 h-5 rounded text-[10px] font-black flex items-center justify-center ${badgeCls}`}
                                                                    >
                                                                        {u}
                                                                    </span>
                                                                );
                                                            })}
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <p className="text-xs text-muted-foreground">
                                                Not in current division table (or Cup / Friendly opponent)
                                            </p>
                                        )}
                                    </div>

                                    {/* #4: Head-to-Head (H2H) History Box */}
                                    <div className="rounded-xl bg-surface-2/70 border border-border p-3 flex flex-col justify-between gap-2">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                                <Swords className="h-3.5 w-3.5 text-brand" />
                                                Head-to-Head vs {activeReport.name}
                                            </span>
                                            {h2hData.past.length > 0 && (
                                                <span className="text-xs font-extrabold text-foreground tabular-nums">
                                                    <span className="text-emerald-500">{h2hData.wins}W</span> -{" "}
                                                    <span className="text-amber-500">{h2hData.draws}D</span> -{" "}
                                                    <span className="text-rose-500">{h2hData.losses}L</span>{" "}
                                                    <span className="text-muted-foreground text-[11px]">
                                                        ({h2hData.gf}:{h2hData.ga})
                                                    </span>
                                                </span>
                                            )}
                                        </div>

                                        {h2hData.past.length > 0 || h2hData.upcoming.length > 0 ? (
                                            <div className="space-y-1">
                                                {h2hData.past.slice(0, 2).map((m: any) => (
                                                    <div
                                                        key={m.id}
                                                        className="flex items-center justify-between text-xs gap-2"
                                                    >
                                                        <div className="flex items-center gap-1.5 min-w-0">
                                                            <span
                                                                className={`w-4 h-4 rounded text-[9px] font-black flex items-center justify-center shrink-0 ${
                                                                    m.result === "Win"
                                                                        ? "bg-emerald-500 text-white"
                                                                        : m.result === "Draw"
                                                                            ? "bg-amber-500 text-white"
                                                                            : "bg-rose-500 text-white"
                                                                }`}
                                                            >
                                                                {m.result?.[0]}
                                                            </span>
                                                            <span className="font-bold text-foreground font-mono">
                                                                {m.scoreline || "—"}
                                                            </span>
                                                            <span className="text-[10px] text-muted-foreground">
                                                                ({m.isHome ? "H" : "A"}) • {formatDateShort(m.date)}
                                                            </span>
                                                        </div>
                                                        {m.goalscorers && (
                                                            <span className="text-[10px] text-muted-foreground break-words">
                                                                ⚽ {m.goalscorers}
                                                            </span>
                                                        )}
                                                    </div>
                                                ))}
                                                {h2hData.upcoming.length > 0 && (
                                                    <div className="text-[11px] font-bold text-brand flex items-center gap-1.5 pt-0.5">
                                                        <Calendar className="h-3 w-3" />
                                                        Next Meeting: {formatDateShort(h2hData.upcoming[0].date)} (
                                                        {h2hData.upcoming[0].isHome ? "Home" : "Away"} • KO{" "}
                                                        {h2hData.upcoming[0].time})
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <p className="text-xs text-muted-foreground">
                                                No previous fixtures recorded against {activeReport.name} yet.
                                            </p>
                                        )}
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* ========================================================= */}
                    {/* SECTION 1: DANGER MEN & KEY THREATS                       */}
                    {/* ========================================================= */}
                    <Card className="bg-surface-1 border-amber-500/30 shadow-xs overflow-hidden border-l-4 border-l-amber-500">
                        <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
                            <div>
                                <CardTitle className="text-sm font-black uppercase tracking-wider text-amber-500 flex items-center gap-1.5">
                                    <ShieldAlert className="h-4 w-4" />
                                    Danger Men &amp; Key Players to Watch
                                </CardTitle>
                                <p className="text-[11px] text-muted-foreground">
                                    Log their standout players by shirt number, position, preferred foot &amp; how to stop them
                                </p>
                            </div>
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={handleAddDangerMan}
                                className="h-8 text-xs font-bold border-amber-500/40 text-amber-500 hover:bg-amber-500/10"
                            >
                                <Plus className="h-3.5 w-3.5 mr-1" />
                                Add Player
                            </Button>
                        </CardHeader>
                        <CardContent className="p-4 pt-2 space-y-3">
                            {/* Structured Danger Men Cards */}
                            {(activeReport.dangerMenList || []).length > 0 && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                                    {(activeReport.dangerMenList || []).map((dm) => (
                                        <div
                                            key={dm.id}
                                            className="rounded-xl bg-surface-2 border border-border p-3 space-y-2"
                                        >
                                            {isEditing ? (
                                                <>
                                                    <div className="grid grid-cols-[52px_72px_1fr_82px_auto] gap-1.5 items-center">
                                                        <Input
                                                            placeholder="#9"
                                                            value={dm.number}
                                                            onChange={(e) =>
                                                                handleUpdateDangerMan(dm.id, "number", e.target.value)
                                                            }
                                                            className="h-8 text-xs font-bold text-center bg-surface-1 px-1.5"
                                                        />
                                                        <Input
                                                            placeholder="Pos (ST)"
                                                            value={dm.position}
                                                            onChange={(e) =>
                                                                handleUpdateDangerMan(dm.id, "position", e.target.value)
                                                            }
                                                            className="h-8 text-xs font-bold bg-surface-1 px-2"
                                                        />
                                                        <Input
                                                            placeholder="Player name / nickname..."
                                                            value={dm.name}
                                                            onChange={(e) =>
                                                                handleUpdateDangerMan(dm.id, "name", e.target.value)
                                                            }
                                                            className="h-8 text-xs font-semibold bg-surface-1 px-2"
                                                        />
                                                        <select
                                                            value={dm.foot || "Right"}
                                                            onChange={(e) =>
                                                                handleUpdateDangerMan(dm.id, "foot", e.target.value)
                                                            }
                                                            className="h-8 rounded-md border border-border bg-surface-1 px-1.5 text-[11px] font-semibold text-foreground"
                                                        >
                                                            <option value="Right">Right</option>
                                                            <option value="Left">Left</option>
                                                            <option value="Both">Both</option>
                                                        </select>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemoveDangerMan(dm.id)}
                                                            className="h-8 w-8 rounded-md flex items-center justify-center text-rose-500 hover:bg-rose-500/10"
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </button>
                                                    </div>
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                                        <Input
                                                            placeholder="💪 Strengths (e.g. Pace, 1v1, aerial)..."
                                                            value={dm.strengths || ""}
                                                            onChange={(e) =>
                                                                handleUpdateDangerMan(dm.id, "strengths", e.target.value)
                                                            }
                                                            className="h-8 text-xs bg-emerald-500/5 border-emerald-500/30"
                                                        />
                                                        <Input
                                                            placeholder="🎯 Weaknesses / Exploit (e.g. Press 1st touch)..."
                                                            value={dm.weaknesses || ""}
                                                            onChange={(e) =>
                                                                handleUpdateDangerMan(dm.id, "weaknesses", e.target.value)
                                                            }
                                                            className="h-8 text-xs bg-rose-500/5 border-rose-500/30"
                                                        />
                                                    </div>
                                                    <textarea
                                                        rows={2}
                                                        placeholder="Additional tactical notes (e.g. Cuts inside onto left foot)..."
                                                        value={dm.notes}
                                                        onChange={(e) =>
                                                            handleUpdateDangerMan(dm.id, "notes", e.target.value)
                                                        }
                                                        className="w-full rounded-md border border-border bg-surface-1 px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground outline-none resize-y"
                                                    />
                                                </>
                                            ) : (
                                                <div
                                                    onClick={handleEditReport}
                                                    className="flex items-start gap-2.5 cursor-pointer"
                                                >
                                                    <div className="h-8 min-w-8 px-2 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-500 font-black text-xs flex items-center justify-center shrink-0">
                                                        {dm.number ? `#${dm.number.replace(/^#/, "")}` : dm.position || "!"}
                                                    </div>
                                                    <div className="min-w-0 flex-1 space-y-1">
                                                        <div className="flex items-center gap-1.5 flex-wrap">
                                                            <span className="text-xs font-extrabold text-foreground break-words">
                                                                {dm.name || `Opposition ${dm.position || "Player"}`}
                                                            </span>
                                                            {dm.position && (
                                                                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-surface-1 border border-border text-muted-foreground">
                                                                    {dm.position}
                                                                </span>
                                                            )}
                                                            {dm.foot && (
                                                                <span className="text-[10px] font-semibold text-amber-500">
                                                                    • {dm.foot} Foot
                                                                </span>
                                                            )}
                                                        </div>
                                                        {(dm.strengths || dm.weaknesses) && (
                                                            <div className="flex flex-wrap gap-1.5">
                                                                {dm.strengths && (
                                                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                                                                        💪 {dm.strengths}
                                                                    </span>
                                                                )}
                                                                {dm.weaknesses && (
                                                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-500/10 border border-rose-500/30 text-rose-400">
                                                                        🎯 {dm.weaknesses}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        )}
                                                        {dm.notes && (
                                                            <p className="text-xs text-muted-foreground whitespace-pre-wrap break-words leading-relaxed">
                                                                {dm.notes}
                                                            </p>
                                                        )}
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={(e) => handleSendDangerManToBlackBook(dm, e)}
                                                        disabled={sentDangerManIds.has(dm.id)}
                                                        className={`px-2 py-1 rounded-lg text-[10px] font-extrabold border transition-colors flex items-center gap-1 shrink-0 ${
                                                            sentDangerManIds.has(dm.id)
                                                                ? "bg-emerald-500/15 text-emerald-500 border-emerald-500/30"
                                                                : "bg-surface-1 hover:bg-brand/10 text-brand border-brand/30"
                                                        }`}
                                                        title="Send this opposition standout to your Recruitment Black Book"
                                                    >
                                                        <UserPlus className="h-3 w-3" />
                                                        {sentDangerManIds.has(dm.id) ? "In Black Book ✓" : "+ Black Book"}
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Freehand Danger Men Summary Note */}
                            {isEditing ? (
                                <textarea
                                    value={editedReport?.dangerMen || ""}
                                    onChange={(e) =>
                                        setEditedReport((prev) =>
                                            prev ? { ...prev, dangerMen: e.target.value } : null
                                        )
                                    }
                                    placeholder="Quick player notes — write 'Player Name - note' on each line to auto-format into individual player callout cards..."
                                    className="w-full min-h-[72px] rounded-xl border border-border bg-surface-2 p-3 text-xs text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-amber-500 outline-none resize-y"
                                />
                            ) : activeReport.dangerMen ? (
                                <div
                                    onClick={handleEditReport}
                                    className="space-y-1.5 cursor-text"
                                >
                                    {parseScoutingNotesIntoItems(activeReport.dangerMen).map((item, idx) =>
                                        item.subject ? (
                                            <div
                                                key={idx}
                                                className="flex items-start gap-2.5 rounded-xl bg-surface-2/70 hover:bg-surface-2 border border-border p-2.5 transition-colors"
                                            >
                                                <span className="px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/35 text-amber-400 text-[11px] font-extrabold shrink-0">
                                                    {item.subject}
                                                </span>
                                                <span className="text-xs md:text-sm text-foreground leading-snug break-words">
                                                    {item.detail}
                                                </span>
                                            </div>
                                        ) : (
                                            <p
                                                key={idx}
                                                className="text-xs md:text-sm text-foreground whitespace-pre-wrap break-words leading-relaxed bg-surface-2/60 hover:bg-surface-2 rounded-xl p-3 border border-border transition-colors"
                                            >
                                                {item.detail}
                                            </p>
                                        )
                                    )}
                                </div>
                            ) : (activeReport.dangerMenList || []).length === 0 ? (
                                <p
                                    onClick={handleEditReport}
                                    className="text-xs text-muted-foreground italic cursor-text rounded-xl p-2 -m-2 hover:bg-surface-2/60 transition-colors"
                                >
                                    No danger men logged yet. Click here or &ldquo;Add Player&rdquo; to enter key threats...
                                </p>
                            ) : null}
                        </CardContent>
                    </Card>

                    {/* ========================================================= */}
                    {/* SECTION 2: 6-CARD TACTICAL BREAKDOWN GRID                 */}
                    {/* Strengths • Weaknesses • In Possession • Out of Poss •    */}
                    {/* Transition • Set Pieces                                   */}
                    {/* ========================================================= */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* 1. STRENGTHS */}
                        <Card className="bg-surface-1 border-border border-l-4 border-l-emerald-500 shadow-xs">
                            <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
                                <CardTitle className="text-xs font-black uppercase tracking-wider text-emerald-500 flex items-center gap-1.5">
                                    <Sparkles className="h-3.5 w-3.5" />
                                    Their Strengths
                                </CardTitle>
                                {!isEditing && (
                                    <button
                                        type="button"
                                        onClick={handleEditReport}
                                        className="text-[11px] font-bold text-muted-foreground hover:text-emerald-500 transition-colors"
                                    >
                                        + Edit
                                    </button>
                                )}
                            </CardHeader>
                            <CardContent className="p-4 pt-1">
                                {isEditing ? (
                                    <textarea
                                        value={editedReport?.strengths || ""}
                                        onChange={(e) =>
                                            setEditedReport((prev) =>
                                                prev ? { ...prev, strengths: e.target.value } : null
                                            )
                                        }
                                        placeholder="What are they good at? (e.g. Physical midfield, fast wingers, strong aerial presence)..."
                                        className="w-full min-h-[110px] rounded-xl border border-border bg-surface-2 p-3 text-xs text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-emerald-500 outline-none resize-y"
                                    />
                                ) : (
                                    <p
                                        onClick={handleEditReport}
                                        className="text-xs md:text-sm text-foreground whitespace-pre-wrap break-words leading-relaxed min-h-[60px] cursor-text rounded-xl p-2 -m-2 hover:bg-surface-2/60 transition-colors"
                                    >
                                        {activeReport.strengths || (
                                            <span className="text-muted-foreground italic">
                                                No strengths logged yet. Click here to type...
                                            </span>
                                        )}
                                    </p>
                                )}
                            </CardContent>
                        </Card>

                        {/* 2. WEAKNESSES */}
                        <Card className="bg-surface-1 border-border border-l-4 border-l-rose-500 shadow-xs">
                            <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
                                <CardTitle className="text-xs font-black uppercase tracking-wider text-rose-500 flex items-center gap-1.5">
                                    <Target className="h-3.5 w-3.5" />
                                    Their Weaknesses (How We Hurt Them)
                                </CardTitle>
                                {!isEditing && (
                                    <button
                                        type="button"
                                        onClick={handleEditReport}
                                        className="text-[11px] font-bold text-muted-foreground hover:text-rose-500 transition-colors"
                                    >
                                        + Edit
                                    </button>
                                )}
                            </CardHeader>
                            <CardContent className="p-4 pt-1">
                                {isEditing ? (
                                    <textarea
                                        value={editedReport?.weaknesses || ""}
                                        onChange={(e) =>
                                            setEditedReport((prev) =>
                                                prev ? { ...prev, weaknesses: e.target.value } : null
                                            )
                                        }
                                        placeholder="Where can we exploit them? (e.g. Slow CBs against balls in behind, keeper struggles under high crosses, fitness drops after 65 mins)..."
                                        className="w-full min-h-[110px] rounded-xl border border-border bg-surface-2 p-3 text-xs text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-rose-500 outline-none resize-y"
                                    />
                                ) : (
                                    <p
                                        onClick={handleEditReport}
                                        className="text-xs md:text-sm text-foreground whitespace-pre-wrap break-words leading-relaxed min-h-[60px] cursor-text rounded-xl p-2 -m-2 hover:bg-surface-2/60 transition-colors"
                                    >
                                        {activeReport.weaknesses || (
                                            <span className="text-muted-foreground italic">
                                                No weaknesses logged yet. Click here to type...
                                            </span>
                                        )}
                                    </p>
                                )}
                            </CardContent>
                        </Card>

                        {/* 3. IN POSSESSION */}
                        <Card className="bg-surface-1 border-border border-l-4 border-l-blue-500 shadow-xs">
                            <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
                                <CardTitle className="text-xs font-black uppercase tracking-wider text-blue-500 flex items-center gap-1.5">
                                    <Users className="h-3.5 w-3.5" />
                                    In Possession (Build-Up &amp; Shape)
                                </CardTitle>
                                {!isEditing && (
                                    <button
                                        type="button"
                                        onClick={handleEditReport}
                                        className="text-[11px] font-bold text-muted-foreground hover:text-blue-500 transition-colors"
                                    >
                                        + Edit
                                    </button>
                                )}
                            </CardHeader>
                            <CardContent className="p-4 pt-1">
                                {isEditing ? (
                                    <textarea
                                        value={editedReport?.inPossession || ""}
                                        onChange={(e) =>
                                            setEditedReport((prev) =>
                                                prev ? { ...prev, inPossession: e.target.value } : null
                                            )
                                        }
                                        placeholder="How do they build up and attack? (e.g. Play short to #6 or go direct to #9? Full-backs overlap high?)..."
                                        className="w-full min-h-[110px] rounded-xl border border-border bg-surface-2 p-3 text-xs text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-blue-500 outline-none resize-y"
                                    />
                                ) : (
                                    <p
                                        onClick={handleEditReport}
                                        className="text-xs md:text-sm text-foreground whitespace-pre-wrap break-words leading-relaxed min-h-[60px] cursor-text rounded-xl p-2 -m-2 hover:bg-surface-2/60 transition-colors"
                                    >
                                        {activeReport.inPossession || (
                                            <span className="text-muted-foreground italic">
                                                No in-possession notes logged yet. Click here to type...
                                            </span>
                                        )}
                                    </p>
                                )}
                            </CardContent>
                        </Card>

                        {/* 4. OUT OF POSSESSION */}
                        <Card className="bg-surface-1 border-border border-l-4 border-l-purple-500 shadow-xs">
                            <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
                                <CardTitle className="text-xs font-black uppercase tracking-wider text-purple-500 flex items-center gap-1.5">
                                    <Swords className="h-3.5 w-3.5" />
                                    Out of Possession (Defensive Shape &amp; Press)
                                </CardTitle>
                                {!isEditing && (
                                    <button
                                        type="button"
                                        onClick={handleEditReport}
                                        className="text-[11px] font-bold text-muted-foreground hover:text-purple-500 transition-colors"
                                    >
                                        + Edit
                                    </button>
                                )}
                            </CardHeader>
                            <CardContent className="p-4 pt-1">
                                {isEditing ? (
                                    <textarea
                                        value={editedReport?.outOfPossession || ""}
                                        onChange={(e) =>
                                            setEditedReport((prev) =>
                                                prev ? { ...prev, outOfPossession: e.target.value } : null
                                            )
                                        }
                                        placeholder="How do they defend? (e.g. High line with aggressive press, or compact mid/low block? Spaces left in wide channels?)..."
                                        className="w-full min-h-[110px] rounded-xl border border-border bg-surface-2 p-3 text-xs text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-purple-500 outline-none resize-y"
                                    />
                                ) : (
                                    <p
                                        onClick={handleEditReport}
                                        className="text-xs md:text-sm text-foreground whitespace-pre-wrap break-words leading-relaxed min-h-[60px] cursor-text rounded-xl p-2 -m-2 hover:bg-surface-2/60 transition-colors"
                                    >
                                        {activeReport.outOfPossession || (
                                            <span className="text-muted-foreground italic">
                                                No out-of-possession notes logged yet. Click here to type...
                                            </span>
                                        )}
                                    </p>
                                )}
                            </CardContent>
                        </Card>

                        {/* 5. TRANSITION */}
                        <Card className="bg-surface-1 border-border border-l-4 border-l-orange-500 shadow-xs">
                            <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
                                <CardTitle className="text-xs font-black uppercase tracking-wider text-orange-500 flex items-center gap-1.5">
                                    <Zap className="h-3.5 w-3.5" />
                                    Transition (Attacking &amp; Defensive)
                                </CardTitle>
                                {!isEditing && (
                                    <button
                                        type="button"
                                        onClick={handleEditReport}
                                        className="text-[11px] font-bold text-muted-foreground hover:text-orange-500 transition-colors"
                                    >
                                        + Edit
                                    </button>
                                )}
                            </CardHeader>
                            <CardContent className="p-4 pt-1">
                                {isEditing ? (
                                    <textarea
                                        value={editedReport?.transition || ""}
                                        onChange={(e) =>
                                            setEditedReport((prev) =>
                                                prev ? { ...prev, transition: e.target.value } : null
                                            )
                                        }
                                        placeholder="What happens when the ball turns over? (e.g. Look for early ball over the top to wingers; slow to track back when they lose it)..."
                                        className="w-full min-h-[110px] rounded-xl border border-border bg-surface-2 p-3 text-xs text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-orange-500 outline-none resize-y"
                                    />
                                ) : (
                                    <p
                                        onClick={handleEditReport}
                                        className="text-xs md:text-sm text-foreground whitespace-pre-wrap break-words leading-relaxed min-h-[60px] cursor-text rounded-xl p-2 -m-2 hover:bg-surface-2/60 transition-colors"
                                    >
                                        {activeReport.transition || (
                                            <span className="text-muted-foreground italic">
                                                No transition notes logged yet. Click here to type...
                                            </span>
                                        )}
                                    </p>
                                )}
                            </CardContent>
                        </Card>

                        {/* 6. SET PIECES */}
                        <Card className="bg-surface-1 border-border border-l-4 border-l-cyan-500 shadow-xs">
                            <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
                                <CardTitle className="text-xs font-black uppercase tracking-wider text-cyan-500 flex items-center gap-1.5">
                                    <Flag className="h-3.5 w-3.5" />
                                    Set Pieces (Corners, Free Kicks &amp; Throws)
                                </CardTitle>
                                {!isEditing && (
                                    <button
                                        type="button"
                                        onClick={handleEditReport}
                                        className="text-[11px] font-bold text-muted-foreground hover:text-cyan-500 transition-colors"
                                    >
                                        + Edit
                                    </button>
                                )}
                            </CardHeader>
                            <CardContent className="p-4 pt-1">
                                {isEditing ? (
                                    <textarea
                                        value={editedReport?.setPieces || ""}
                                        onChange={(e) =>
                                            setEditedReport((prev) =>
                                                prev ? { ...prev, setPieces: e.target.value } : null
                                            )
                                        }
                                        placeholder="Inswinging corners to near post? Long throw specialist? Zonal or man-marking when defending corners?..."
                                        className="w-full min-h-[110px] rounded-xl border border-border bg-surface-2 p-3 text-xs text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-cyan-500 outline-none resize-y"
                                    />
                                ) : (
                                    <p
                                        onClick={handleEditReport}
                                        className="text-xs md:text-sm text-foreground whitespace-pre-wrap break-words leading-relaxed min-h-[60px] cursor-text rounded-xl p-2 -m-2 hover:bg-surface-2/60 transition-colors"
                                    >
                                        {activeReport.setPieces || (
                                            <span className="text-muted-foreground italic">
                                                No set-piece notes logged yet. Click here to type...
                                            </span>
                                        )}
                                    </p>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {/* ========================================================= */}
                    {/* #15: POST-MATCH REVIEW / NOTES FOR NEXT TIME              */}
                    {/* ========================================================= */}
                    <Card className="bg-surface-1 border-border shadow-xs">
                        <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
                            <div>
                                <CardTitle className="text-xs font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                    <ClipboardCheck className="h-4 w-4 text-brand" />
                                    Post-Match Review &amp; Notes for Next Meeting
                                </CardTitle>
                                <p className="text-[11px] text-muted-foreground">
                                    Log what worked after full-time so you have it ready for the reverse fixture
                                </p>
                            </div>
                            {isEditing ? (
                                <Button
                                    type="button"
                                    size="sm"
                                    onClick={handleSaveReport}
                                    className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
                                >
                                    <Save className="h-3.5 w-3.5 mr-1.5" />
                                    Save Notes
                                </Button>
                            ) : (
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={handleEditReport}
                                    className="h-8 text-xs font-bold border-border bg-surface-2 text-foreground"
                                >
                                    <Edit2 className="h-3.5 w-3.5 mr-1.5 text-brand" />
                                    Add / Edit Notes
                                </Button>
                            )}
                        </CardHeader>
                        <CardContent className="p-4 pt-1 space-y-2">
                            {isEditing ? (
                                <textarea
                                    value={editedReport?.postMatchReview || ""}
                                    onChange={(e) =>
                                        setEditedReport((prev) =>
                                            prev ? { ...prev, postMatchReview: e.target.value } : null
                                        )
                                    }
                                    placeholder="e.g. Their LB #3 struggled badly against pace in the 2nd half — target him early in the return game..."
                                    className="w-full min-h-[85px] rounded-xl border border-border bg-surface-2 p-3 text-xs text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-brand outline-none resize-y"
                                />
                            ) : (
                                <p
                                    onClick={handleEditReport}
                                    className="text-xs md:text-sm text-foreground whitespace-pre-wrap break-words leading-relaxed min-h-[48px] cursor-text rounded-xl p-2.5 -m-2.5 hover:bg-surface-2/60 transition-colors"
                                >
                                    {activeReport.postMatchReview || activeReport.generalNotes || (
                                        <span className="text-muted-foreground italic">
                                            No post-match notes recorded yet. Click here to type...
                                        </span>
                                    )}
                                </p>
                            )}
                        </CardContent>
                    </Card>

                    {/* ========================================================= */}
                    {/* #10: OPTIONAL / COLLAPSIBLE PITCH VISUALIZER & LINEUP     */}
                    {/* ========================================================= */}
                    <Card className="bg-surface-1 border-border shadow-xs overflow-hidden">
                        <div className="p-4 flex flex-wrap items-center justify-between gap-3">
                            <div>
                                <h3 className="text-xs font-black uppercase tracking-wider text-foreground flex items-center gap-2">
                                    <span>
                                        {activeReport.name || "Opposition"} ({activeReport.formation} • {activeOppFormat})
                                    </span>
                                </h3>
                                <p className="text-[11px] text-muted-foreground">
                                    Click any shirt number on the pitch or row below to log player strengths, weaknesses &amp; tactical role
                                </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 shrink-0">
                                {enabledFormats.length > 1 && (
                                    <div className="inline-flex items-center p-0.5 rounded-xl bg-surface-2 border border-border">
                                        {enabledFormats.map((fmt) => (
                                            <button
                                                key={fmt}
                                                type="button"
                                                onClick={() => handleOppFormatChange(fmt)}
                                                className={`px-2 py-1 rounded-lg text-[10px] font-black transition-all ${
                                                    activeOppFormat === fmt
                                                        ? "bg-brand text-brand-foreground shadow-xs"
                                                        : "text-muted-foreground hover:text-foreground"
                                                }`}
                                            >
                                                {fmt}
                                            </button>
                                        ))}
                                    </div>
                                )}
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setShowPitchSection((prev) => !prev)}
                                    className="h-8 text-xs font-bold border-border bg-surface-2 text-foreground shrink-0"
                                >
                                    {showPitchSection ? (
                                        <>
                                            <EyeOff className="h-3.5 w-3.5 mr-1.5" />
                                            Hide Pitch
                                            <ChevronUp className="h-3.5 w-3.5 ml-1" />
                                        </>
                                    ) : (
                                        <>
                                            <Eye className="h-3.5 w-3.5 mr-1.5 text-brand" />
                                            Show Pitch &amp; {activeOppRomanLabel}
                                            <ChevronDown className="h-3.5 w-3.5 ml-1" />
                                        </>
                                    )}
                                </Button>
                            </div>
                        </div>

                        {showPitchSection && (
                            <CardContent className="p-0 border-t border-border">
                                {/* Pitch Canvas */}
                                <div className="relative w-full bg-emerald-700" style={{ paddingBottom: "78%" }}>
                                    <div className="absolute inset-0 opacity-40">
                                        <div className="absolute inset-4 border-2 border-white/60 rounded-sm"></div>
                                        <div className="absolute left-4 right-4 top-1/2 border-t-2 border-white/60"></div>
                                        {(activeOppFormat === "5v5" || activeOppFormat === "7v7") && (
                                            <>
                                                <div className="absolute left-4 right-4 top-[34%] border-t border-dashed border-white/45"></div>
                                                <div className="absolute left-4 right-4 top-[66%] border-t border-dashed border-white/45"></div>
                                            </>
                                        )}
                                        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 border-2 border-white/60 rounded-full"></div>
                                        <div className="absolute left-1/2 -translate-x-1/2 top-4 w-32 h-16 border-2 border-white/60 border-t-0"></div>
                                        <div className="absolute left-1/2 -translate-x-1/2 bottom-4 w-32 h-16 border-2 border-white/60 border-b-0"></div>
                                    </div>

                                    {formationPositions.map((pos, idx) => {
                                        const profile = (activeReport.playerProfiles || []).find(
                                            (p) => p.positionIndex === idx
                                        );
                                        const playerName = (activeReport.lineup?.[idx] || "").trim();
                                        const shortPitchName = playerName ? formatPitchPlayerName(playerName) : "";
                                        const hasProfileData = Boolean(
                                            profile?.role || profile?.strengths || profile?.weaknesses || profile?.traits
                                        );
                                        return (
                                            <div
                                                key={idx}
                                                className="absolute z-20 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-1 cursor-pointer group"
                                                style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
                                                onClick={() => handleOpenPositionProfile(idx)}
                                            >
                                                <div
                                                    className={`w-8 h-8 sm:w-9 sm:h-9 bg-white border-[2.5px] rounded-full flex items-center justify-center shadow-xl group-hover:scale-110 transition-transform ${
                                                        hasProfileData ? "border-amber-500" : "border-red-600"
                                                    }`}
                                                >
                                                    <span className="text-xs sm:text-sm font-black text-slate-900 leading-none">
                                                        {pos.number}
                                                    </span>
                                                </div>
                                                {shortPitchName ? (
                                                    <span
                                                        title={playerName}
                                                        className="text-[11px] sm:text-xs font-black tracking-tight text-white bg-slate-950/95 border border-white/30 px-2 py-0.5 rounded-md shadow-lg whitespace-nowrap leading-tight"
                                                    >
                                                        {shortPitchName}
                                                    </span>
                                                ) : (
                                                    <span className="text-[10px] sm:text-[11px] font-extrabold text-white/85 bg-slate-900/80 border border-white/15 px-1.5 py-0.5 rounded shadow-md whitespace-nowrap leading-tight">
                                                        {getDisplayPosition(pos.label)}
                                                    </span>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* 11-Position List */}
                                <div className="bg-surface-1 border-t border-border p-3">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {formationPositions.map((pos, idx) => {
                                            const profile = (activeReport.playerProfiles || []).find(
                                                (p) => p.positionIndex === idx
                                            );
                                            return (
                                                <div
                                                    key={idx}
                                                    onClick={() => handleOpenPositionProfile(idx)}
                                                    className="p-2 rounded-lg bg-surface-2/60 border border-border hover:border-brand/40 cursor-pointer space-y-1.5"
                                                >
                                                    <div className="flex items-center gap-2.5">
                                                        <div className="w-7 h-7 rounded-full bg-brand text-brand-foreground flex items-center justify-center shrink-0 text-xs font-black">
                                                            {pos.number}
                                                        </div>
                                                        <span className="text-xs font-extrabold text-muted-foreground w-10 shrink-0">
                                                            {getDisplayPosition(pos.label)}
                                                        </span>
                                                        <input
                                                            type="text"
                                                            value={activeReport.lineup?.[idx] || ""}
                                                            onChange={(e) => handleUpdateLineupName(idx, e.target.value)}
                                                            onClick={(e) => e.stopPropagation()}
                                                            placeholder="Add player name..."
                                                            className="flex-1 text-xs sm:text-sm font-bold bg-surface-1 border border-border rounded-md px-2.5 py-1.5 text-foreground outline-none focus:border-brand"
                                                        />
                                                        {profile?.role && (
                                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/15 text-amber-500 shrink-0">
                                                                {profile.role}
                                                            </span>
                                                        )}
                                                    </div>
                                                    {(profile?.strengths || profile?.weaknesses || profile?.traits) && (
                                                        <div className="flex flex-wrap gap-1.5 pl-9">
                                                            {profile?.strengths && (
                                                                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                                                                    💪 {profile.strengths}
                                                                </span>
                                                            )}
                                                            {profile?.weaknesses && (
                                                                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/30 text-rose-400">
                                                                    🎯 {profile.weaknesses}
                                                                </span>
                                                            )}
                                                            {profile?.traits && (
                                                                <span className="text-[10px] text-muted-foreground">
                                                                    {profile.traits}
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </CardContent>
                        )}
                    </Card>
                </div>
            </div>

            {isEditing && (
                <div className="fixed bottom-6 right-6 z-40 rounded-2xl bg-surface-1/95 backdrop-blur-md border border-brand/40 px-4 py-3 shadow-2xl flex items-center gap-3">
                    <span className="text-xs font-extrabold text-foreground">
                        Editing: <span className="text-brand">{editedReport?.name || "New Report"}</span>
                    </span>
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={handleCancelEdit}
                        className="h-8 px-3 rounded-xl border-border bg-surface-2 text-xs font-bold"
                    >
                        Cancel
                    </Button>
                    <Button
                        size="sm"
                        onClick={handleSaveReport}
                        className="h-8 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold shadow-xs"
                    >
                        <Save className="h-3.5 w-3.5 mr-1.5" />
                        Save Report
                    </Button>
                </div>
            )}
            </div>

            {/* Position Profile Modal (for Pitch Visualizer) */}
            <Dialog
                open={selectedProfileIndex !== null}
                onOpenChange={(open) => !open && setSelectedProfileIndex(null)}
            >
                <DialogContent className="max-w-md w-[calc(100vw-1.5rem)] bg-surface-1 border-border text-foreground rounded-2xl p-4 sm:p-6 max-h-[85dvh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="text-base font-bold">
                            {activeReport.name || "Opposition"} #{formationPositions[selectedProfileIndex || 0]?.number} ({formationPositions[selectedProfileIndex || 0]?.label})
                        </DialogTitle>
                    </DialogHeader>
                    {selectedProfileIndex !== null &&
                        (() => {
                            const selectedPos = formationPositions[selectedProfileIndex];
                            const rawLabel = (selectedPos?.label || "").toUpperCase();
                            const displayPos = getDisplayPosition(rawLabel);

                            const positionRolesMap: Record<string, string[]> = {
                                GK: [
                                    "Shot-Stopper (Traditional GK)",
                                    "Sweeper Keeper",
                                    "Ball-Playing Keeper (Builds Short)",
                                    "Commanding GK (Cross Claimer)",
                                    "Direct / Long-Distribution GK"
                                ],
                                CB: [
                                    "Ball-Playing Defender",
                                    "No-Nonsense CB",
                                    "Aggressive Stopper (Steps In)",
                                    "Covering / Sweeper CB",
                                    "Aerial / Physical CB",
                                    "Wide Centre-Back"
                                ],
                                RB: [
                                    "Overlapping Full-Back",
                                    "Defensive / Stay-Back Full-Back",
                                    "Attacking Wing-Back",
                                    "Inverted Full-Back",
                                    "Direct Crossing Full-Back"
                                ],
                                LB: [
                                    "Overlapping Full-Back",
                                    "Defensive / Stay-Back Full-Back",
                                    "Attacking Wing-Back",
                                    "Inverted Full-Back",
                                    "Direct Crossing Full-Back"
                                ],
                                RWB: [
                                    "Attacking Wing-Back",
                                    "Overlapping Wing-Back",
                                    "Two-Way / Balanced Wing-Back",
                                    "Inverted Wing-Back",
                                    "Defensive Wing-Back"
                                ],
                                LWB: [
                                    "Attacking Wing-Back",
                                    "Overlapping Wing-Back",
                                    "Two-Way / Balanced Wing-Back",
                                    "Inverted Wing-Back",
                                    "Defensive Wing-Back"
                                ],
                                DM: [
                                    "Holding Pivot / Anchor Man",
                                    "Deep-Lying Playmaker",
                                    "Ball-Winning Destroyer",
                                    "Half-Back (Drops into Defence)",
                                    "Box-to-Box Pivot"
                                ],
                                CM: [
                                    "Box-to-Box Midfielder",
                                    "Deep-Lying Playmaker",
                                    "Ball-Winning Midfielder",
                                    "Attacking #8 (Late Box Runner)",
                                    "Half-Space Runner (Mezzala)",
                                    "Sitting / Controlling CM"
                                ],
                                CAM: [
                                    "Advanced Playmaker (#10)",
                                    "Shadow Striker (Box Crasher)",
                                    "Free Role / Roaming Playmaker",
                                    "Second Striker",
                                    "High-Pressing #10"
                                ],
                                RM: [
                                    "Touchline Winger (Crosses Early)",
                                    "Inverted Winger / Inside Forward",
                                    "Direct 1v1 Dribbler",
                                    "Wide Playmaker",
                                    "Defensive / Track-Back Wide Mid"
                                ],
                                LM: [
                                    "Touchline Winger (Crosses Early)",
                                    "Inverted Winger / Inside Forward",
                                    "Direct 1v1 Dribbler",
                                    "Wide Playmaker",
                                    "Defensive / Track-Back Wide Mid"
                                ],
                                RW: [
                                    "Inverted Winger / Inside Forward",
                                    "Touchline Winger",
                                    "Direct 1v1 Dribbler",
                                    "Pace in Behind / Channel Threat",
                                    "Wide Playmaker"
                                ],
                                LW: [
                                    "Inverted Winger / Inside Forward",
                                    "Touchline Winger",
                                    "Direct 1v1 Dribbler",
                                    "Pace in Behind / Channel Threat",
                                    "Wide Playmaker"
                                ],
                                ST: [
                                    "Target Man (Hold-Up #9)",
                                    "Poacher (Box Finisher)",
                                    "Pace in Behind / Channel Runner",
                                    "Pressing Forward",
                                    "False 9 (Drops Deep)",
                                    "Complete Forward"
                                ]
                            };

                            const traitsPlaceholderMap: Record<string, string> = {
                                GK: "e.g. Kicks long off right foot, slow getting down to low shots...",
                                CB: "e.g. Steps out aggressively, leaves space in behind...",
                                RB: "e.g. Pushes high to overlap, leaves space in behind on transition...",
                                LB: "e.g. Pushes high to overlap, leaves space in behind on transition...",
                                RWB: "e.g. Provides main width, vulnerable when caught high upfield...",
                                LWB: "e.g. Provides main width, vulnerable when caught high upfield...",
                                DM: "e.g. Dictates tempo if given time, press early on first touch...",
                                CM: "e.g. Makes late runs into the box, strong engine...",
                                CAM: "e.g. Finds pockets between the lines, dangerous on the half-turn...",
                                RM: "e.g. Looks to deliver early crosses into the box...",
                                LM: "e.g. Looks to deliver early crosses into the box...",
                                RW: "e.g. Cuts inside onto stronger foot, dangerous 1v1...",
                                LW: "e.g. Cuts inside onto stronger foot, dangerous 1v1...",
                                ST: "e.g. Fast in behind, spins into channels, strong hold-up play..."
                            };

                            const quickStrengthPresets = [
                                "Pace in behind",
                                "Strong 1v1",
                                "Dictates tempo",
                                "Physical / Aerial",
                                "Cuts inside",
                                "Set-piece threat"
                            ];

                            const quickWeaknessPresets = [
                                "Press 1st touch",
                                "Show onto weak foot",
                                "Slow turning",
                                "Space in behind",
                                "Doesn't track back",
                                "Struggles under high balls"
                            ];

                            const roleOptions =
                                positionRolesMap[rawLabel] ||
                                positionRolesMap[displayPos] ||
                                positionRolesMap.CM;
                            const traitsPlaceholder =
                                traitsPlaceholderMap[rawLabel] ||
                                traitsPlaceholderMap[displayPos] ||
                                "e.g. Additional tactical tendencies or matchup notes...";

                            const name = activeReport.lineup?.[selectedProfileIndex] || "";
                            const currentProfile = (activeReport.playerProfiles || []).find(
                                (p) => p.positionIndex === selectedProfileIndex
                            ) || {
                                positionIndex: selectedProfileIndex,
                                role: "",
                                foot: "Right",
                                strengths: "",
                                weaknesses: "",
                                traits: ""
                            };

                            const togglePresetPhrase = (
                                field: "strengths" | "weaknesses",
                                phrase: string
                            ) => {
                                const existing = (currentProfile[field] || "").trim();
                                const parts = existing
                                    ? existing
                                          .split(",")
                                          .map((s) => s.trim())
                                          .filter(Boolean)
                                    : [];
                                const nextParts = parts.includes(phrase)
                                    ? parts.filter((p) => p !== phrase)
                                    : [...parts, phrase];
                                handleUpdatePositionProfile(selectedProfileIndex, {
                                    [field]: nextParts.join(", ")
                                });
                            };

                            return (
                                <div className="space-y-3 mt-1">
                                    <div>
                                        <Label className="text-xs font-bold text-muted-foreground uppercase">
                                            Player Name
                                        </Label>
                                        <Input
                                            autoFocus
                                            value={name}
                                            onChange={(e) =>
                                                handleUpdateLineupName(selectedProfileIndex, e.target.value)
                                            }
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter") {
                                                    e.preventDefault();
                                                    handleSavePositionProfileModal();
                                                }
                                            }}
                                            placeholder={`e.g. Opposition #${selectedPos?.number || 1} (${displayPos || "Player"})`}
                                            className="mt-1 bg-surface-2 border-border text-base sm:text-sm"
                                        />
                                        {name && formatPitchPlayerName(name) !== name && (
                                            <p className="text-[10px] text-muted-foreground mt-1">
                                                Pitch display name: <span className="font-bold text-foreground">{formatPitchPlayerName(name)}</span> (full name shown in player list)
                                            </p>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                        <div>
                                            <Label className="text-xs font-bold text-muted-foreground uppercase">
                                                {displayPos} Tactical Role
                                            </Label>
                                            <select
                                                value={currentProfile.role}
                                                onChange={(e) =>
                                                    handleUpdatePositionProfile(selectedProfileIndex, {
                                                        role: e.target.value
                                                    })
                                                }
                                                className="w-full mt-1 px-3 py-2 border border-border rounded-md text-base sm:text-xs bg-surface-2 text-foreground"
                                            >
                                                <option value="">Select {displayPos} Role...</option>
                                                {currentProfile.role &&
                                                    !roleOptions.includes(currentProfile.role) && (
                                                        <option value={currentProfile.role}>
                                                            {currentProfile.role}
                                                        </option>
                                                    )}
                                                {roleOptions.map((roleOpt) => (
                                                    <option key={roleOpt} value={roleOpt}>
                                                        {roleOpt}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <Label className="text-xs font-bold text-muted-foreground uppercase">
                                                Preferred Foot
                                            </Label>
                                            <select
                                                value={currentProfile.foot}
                                                onChange={(e) =>
                                                    handleUpdatePositionProfile(selectedProfileIndex, {
                                                        foot: e.target.value
                                                    })
                                                }
                                                className="w-full mt-1 px-3 py-2 border border-border rounded-md text-base sm:text-xs bg-surface-2 text-foreground"
                                            >
                                                <option value="Right">Right</option>
                                                <option value="Left">Left</option>
                                                <option value="Both">Both</option>
                                            </select>
                                        </div>
                                    </div>

                                    {/* Structured Player Strengths */}
                                    <div className="rounded-xl bg-emerald-500/5 border border-emerald-500/25 p-2.5 space-y-1.5">
                                        <Label className="text-[11px] font-black text-emerald-500 uppercase flex items-center gap-1">
                                            💪 Player Strengths (What They Do Well)
                                        </Label>
                                        <Input
                                            value={currentProfile.strengths || ""}
                                            onChange={(e) =>
                                                handleUpdatePositionProfile(selectedProfileIndex, {
                                                    strengths: e.target.value
                                                })
                                            }
                                            placeholder="e.g. Rapid in behind, strong 1v1, good range of passing..."
                                            className="h-9 text-base sm:text-xs bg-surface-1 border-emerald-500/30"
                                        />
                                        <div className="flex flex-wrap gap-1 pt-0.5">
                                            {quickStrengthPresets.map((preset) => {
                                                const active = (currentProfile.strengths || "")
                                                    .toLowerCase()
                                                    .includes(preset.toLowerCase());
                                                return (
                                                    <button
                                                        key={preset}
                                                        type="button"
                                                        onClick={() => togglePresetPhrase("strengths", preset)}
                                                        className={`px-2 py-1 rounded-md text-[10px] font-bold border transition-colors ${
                                                            active
                                                                ? "bg-emerald-500 text-slate-950 border-emerald-500"
                                                                : "bg-surface-2 text-emerald-400 border-emerald-500/25 hover:bg-emerald-500/15"
                                                        }`}
                                                    >
                                                        + {preset}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Structured Player Weaknesses / How to Exploit */}
                                    <div className="rounded-xl bg-rose-500/5 border border-rose-500/25 p-2.5 space-y-1.5">
                                        <Label className="text-[11px] font-black text-rose-500 uppercase flex items-center gap-1">
                                            🎯 Player Weaknesses (How We Exploit Them)
                                        </Label>
                                        <Input
                                            value={currentProfile.weaknesses || ""}
                                            onChange={(e) =>
                                                handleUpdatePositionProfile(selectedProfileIndex, {
                                                    weaknesses: e.target.value
                                                })
                                            }
                                            placeholder="e.g. Press 1st touch, show onto weak foot, slow turning..."
                                            className="h-9 text-base sm:text-xs bg-surface-1 border-rose-500/30"
                                        />
                                        <div className="flex flex-wrap gap-1 pt-0.5">
                                            {quickWeaknessPresets.map((preset) => {
                                                const active = (currentProfile.weaknesses || "")
                                                    .toLowerCase()
                                                    .includes(preset.toLowerCase());
                                                return (
                                                    <button
                                                        key={preset}
                                                        type="button"
                                                        onClick={() => togglePresetPhrase("weaknesses", preset)}
                                                        className={`px-2 py-1 rounded-md text-[10px] font-bold border transition-colors ${
                                                            active
                                                                ? "bg-rose-500 text-white border-rose-500"
                                                                : "bg-surface-2 text-rose-400 border-rose-500/25 hover:bg-rose-500/15"
                                                        }`}
                                                    >
                                                        + {preset}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    <div>
                                        <Label className="text-xs font-bold text-muted-foreground uppercase">
                                            Additional Notes
                                        </Label>
                                        <textarea
                                            value={currentProfile.traits}
                                            onChange={(e) =>
                                                handleUpdatePositionProfile(selectedProfileIndex, {
                                                    traits: e.target.value
                                                })
                                            }
                                            placeholder={traitsPlaceholder}
                                            className="w-full mt-1 h-16 p-2 text-base sm:text-xs border border-border bg-surface-2 text-foreground rounded-md resize-none"
                                        />
                                    </div>

                                    <div className="sticky bottom-0 bg-surface-1 flex items-center justify-end gap-2 pt-2.5 pb-0.5 border-t border-border">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setSelectedProfileIndex(null)}
                                            className="h-9 px-3.5 rounded-xl border-border bg-surface-2 text-xs font-bold"
                                        >
                                            Close
                                        </Button>
                                        <Button
                                            type="button"
                                            size="sm"
                                            onClick={handleSavePositionProfileModal}
                                            className="h-9 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold shadow-xs"
                                        >
                                            <Save className="h-3.5 w-3.5 mr-1.5" />
                                            Save Player
                                        </Button>
                                    </div>
                                </div>
                            );
                        })()}
                </DialogContent>
            </Dialog>
        </div>
    );
}
