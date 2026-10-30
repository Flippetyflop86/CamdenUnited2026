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
    notes: string;
}

interface PlayerProfileItem {
    positionIndex: number;
    role: string;
    foot: string;
    traits: string;
}

interface ScoutingReport {
    id: string;
    name: string;
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
    const [showPitchSection, setShowPitchSection] = useState(false);
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
        showPitch: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    });

    // Parse raw DB row into structured ScoutingReport (preserving any legacy notes)
    const parseDbReport = (row: any): ScoutingReport => {
        const rawNotes = row.notes;
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
        let showPitch = false;

        if (rawNotes) {
            if (typeof rawNotes === "string") {
                generalNotes = rawNotes;
            } else if (typeof rawNotes === "object") {
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
                showPitch = Boolean(rawNotes.showPitch);
            }
        }

        const lineup = Array.isArray(row.lineup) ? row.lineup : [];
        const hasLineupNames = lineup.some((n: string) => n && n.trim().length > 0);

        return {
            id: row.id,
            name: row.name || "",
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
            showPitch: showPitch || hasLineupNames,
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
            setShowPitchSection(mapped[0].showPitch);
            setIsEditing(false);
        } else if (mapped.length === 0 && !editedReport) {
            const blank = createBlankReport();
            setEditedReport(blank);
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

        // 2. Load League Table rows (localStorage -> settings.lastImportHistory -> Supabase cache)
        let rows: any[] = [];
        try {
            const storageKey = clubId ? `clubflow_league_table_${clubId}` : "clubflow_league_table";
            const localRaw = localStorage.getItem(storageKey) || localStorage.getItem("clubflow_league_table");
            if (localRaw) {
                const parsed = JSON.parse(localRaw);
                if (Array.isArray(parsed) && parsed.length > 0) rows = parsed;
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
        const ourName = settings.name || "Camden United";

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

    // Open or Start Report for any team name in 1 tap (#1 & #2)
    const handleOpenOrStartForTeam = (teamName: string) => {
        const existing = reports.find((r) => isMatchingTeam(r.name, teamName));
        if (existing) {
            setSelectedReport(existing);
            setEditedReport(null);
            setShowPitchSection(existing.showPitch);
            setIsEditing(false);
        } else {
            const blank = createBlankReport(teamName);
            setSelectedReport(null);
            setEditedReport(blank);
            setShowPitchSection(false);
            setIsEditing(true);
        }
    };

    const handleStartNewReport = () => {
        const blank = createBlankReport("");
        setSelectedReport(null);
        setEditedReport(blank);
        setShowPitchSection(false);
        setIsEditing(true);
    };

    const handleSelectReport = (report: ScoutingReport) => {
        setSelectedReport(report);
        setEditedReport(null);
        setShowPitchSection(report.showPitch);
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
            setShowPitchSection(selectedReport.showPitch);
        } else if (reports.length > 0) {
            setSelectedReport(reports[0]);
            setEditedReport(null);
            setShowPitchSection(reports[0].showPitch);
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

    // #12: Ultra-HD 2x Retina (2160px wide) Shareable Scouting Graphic Generator
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
            const H = 2500;
            canvas.width = W;
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
            const roundRect = (x: number, y: number, w: number, h: number, r: number, fill: string, stroke?: string) => {
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
                    ctx.lineWidth = 3;
                    ctx.stroke();
                }
            };

            // Wrap text helper
            const drawWrappedText = (
                text: string,
                x: number,
                y: number,
                maxWidth: number,
                lineHeight: number,
                maxLines = 6,
                color = "#e2e8f0",
                font = "500 32px Inter, system-ui, sans-serif"
            ) => {
                ctx.font = font;
                ctx.fillStyle = color;
                const rawLines = (text || "—").split(/\r?\n/);
                let drawnLines = 0;
                let curY = y;

                for (const rawLine of rawLines) {
                    const words = rawLine.split(" ");
                    let line = "";
                    for (let n = 0; n < words.length; n++) {
                        const testLine = line + words[n] + " ";
                        const metrics = ctx.measureText(testLine);
                        if (metrics.width > maxWidth && n > 0) {
                            if (drawnLines < maxLines - 1) {
                                ctx.fillText(line.trim(), x, curY);
                                line = words[n] + " ";
                                curY += lineHeight;
                                drawnLines++;
                            } else {
                                ctx.fillText(line.trim() + "…", x, curY);
                                return curY + lineHeight;
                            }
                        } else {
                            line = testLine;
                        }
                    }
                    if (drawnLines < maxLines) {
                        ctx.fillText(line.trim(), x, curY);
                        curY += lineHeight;
                        drawnLines++;
                    }
                }
                return curY;
            };

            // Header Block
            roundRect(80, 70, W - 160, 290, 28, "#131c2e", "#1e293b");
            ctx.fillStyle = brandColor;
            ctx.font = "800 30px Inter, system-ui, sans-serif";
            ctx.fillText(`${(settings.name || "CAMDEN UNITED").toUpperCase()} • OPPOSITION SCOUTING DOSSIER`, 130, 140);

            ctx.fillStyle = "#ffffff";
            ctx.font = "900 84px Inter, system-ui, sans-serif";
            ctx.fillText(report.name.toUpperCase(), 130, 240);

            // Sub-header pills: Formation + League Pos + H2H
            const formationText = `SHAPE: ${report.formation || "4-2-3-1"}`;
            const leagueSummary = activeLeagueStats
                ? `LEAGUE: #${activeLeagueStats.position} • ${activeLeagueStats.points} PTS • ${activeLeagueStats.won}W-${activeLeagueStats.drawn}D-${activeLeagueStats.lost}L • GD ${activeLeagueStats.goal_difference > 0 ? `+${activeLeagueStats.goal_difference}` : activeLeagueStats.goal_difference}`
                : "NON-LEAGUE / CUP OPPONENT";
            const h2hSummary =
                h2hData.past.length > 0
                    ? `H2H: ${h2hData.wins}W - ${h2hData.draws}D - ${h2hData.losses}L (${h2hData.gf}:${h2hData.ga})`
                    : "FIRST MEETING";

            ctx.fillStyle = "#94a3b8";
            ctx.font = "700 32px Inter, system-ui, sans-serif";
            ctx.fillText(`${formationText}    |    ${leagueSummary}    |    ${h2hSummary}`, 130, 315);

            // Section 1: DANGER MEN (Full Width Card)
            roundRect(80, 400, W - 160, 340, 24, "#1a1423", "#f59e0b");
            ctx.fillStyle = "#fbbf24";
            ctx.font = "900 36px Inter, system-ui, sans-serif";
            ctx.fillText("⚠️ DANGER MEN & KEY THREATS", 130, 465);

            const dangerLines: string[] = [];
            if (report.dangerMenList && report.dangerMenList.length > 0) {
                report.dangerMenList.forEach((dm) => {
                    const tag = [dm.number ? `#${dm.number}` : "", dm.position, dm.name].filter(Boolean).join(" ");
                    const footStr = dm.foot ? ` (${dm.foot} foot)` : "";
                    dangerLines.push(`• ${tag}${footStr}: ${dm.notes || "Key threat"}`);
                });
            }
            if (report.dangerMen && report.dangerMen.trim()) {
                dangerLines.push(report.dangerMen.trim());
            }
            const combinedDangerText = dangerLines.length > 0 ? dangerLines.join("\n") : "No specific individual threats logged yet.";
            drawWrappedText(combinedDangerText, 130, 525, W - 260, 48, 4, "#fef3c7", "600 34px Inter, system-ui, sans-serif");

            // 2x3 Grid for the 6 Tactical Sections
            const colW = (W - 200) / 2;
            const rowH = 440;
            const gridCards = [
                { title: "💪 THEIR STRENGTHS", text: report.strengths, accent: "#10b981", bg: "#0f221d" },
                { title: "🎯 THEIR WEAKNESSES (AREAS TO EXPLOIT)", text: report.weaknesses, accent: "#f43f5e", bg: "#23121b" },
                { title: "⚽ IN POSSESSION (BUILD-UP & SHAPE)", text: report.inPossession, accent: "#3b82f6", bg: "#111b2e" },
                { title: "🛡️ OUT OF POSSESSION (PRESS & BLOCK)", text: report.outOfPossession, accent: "#a855f7", bg: "#1c152c" },
                { title: "⚡ TRANSITION (COUNTER & RECOVERY)", text: report.transition, accent: "#f97316", bg: "#231812" },
                { title: "🚩 SET PIECES (CORNERS, FREE KICKS, THROWS)", text: report.setPieces, accent: "#06b6d4", bg: "#0e2028" }
            ];

            gridCards.forEach((card, idx) => {
                const col = idx % 2;
                const row = Math.floor(idx / 2);
                const x = 80 + col * (colW + 40);
                const y = 780 + row * (rowH + 35);

                roundRect(x, y, colW, rowH, 24, card.bg, card.accent);
                ctx.fillStyle = card.accent;
                ctx.font = "900 32px Inter, system-ui, sans-serif";
                ctx.fillText(card.title, x + 45, y + 65);

                drawWrappedText(
                    card.text || "Not logged yet.",
                    x + 45,
                    y + 130,
                    colW - 90,
                    46,
                    6,
                    "#f1f5f9",
                    "500 32px Inter, system-ui, sans-serif"
                );
            });

            // Footer / Post-Match Review Strip
            roundRect(80, 2220, W - 160, 200, 22, "#131c2e", "#334155");
            ctx.fillStyle = "#94a3b8";
            ctx.font = "800 28px Inter, system-ui, sans-serif";
            ctx.fillText("📋 POST-MATCH REVIEW / NOTES FOR NEXT TIME", 130, 2275);
            drawWrappedText(
                report.postMatchReview || report.generalNotes || "Prepared via Camden United Data Hub",
                130,
                2330,
                W - 260,
                44,
                2,
                "#e2e8f0",
                "500 30px Inter, system-ui, sans-serif"
            );

            const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, "image/png", 1.0));
            if (!blob) return;

            const safeName = report.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
            const fileName = `scouting-report-${safeName}.png`;
            const file = new File([blob], fileName, { type: "image/png" });

            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({
                    title: `${report.name} - Scouting Report`,
                    text: `Opposition Scouting Report for ${report.name}`,
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

    // Updated PDF Export with all 7 sections + League & H2H context
    const handleExportPDF = () => {
        const report = activeReport;
        if (!report.name.trim()) return;

        const printWindow = window.open("", "_blank");
        if (!printWindow) return;

        const dangerHtml = [
            ...(report.dangerMenList || []).map(
                (d) =>
                    `<div><strong>${d.number ? `#${d.number} ` : ""}${d.name || "Player"} (${d.position} • ${d.foot} foot):</strong> ${d.notes || ""}</div>`
            ),
            report.dangerMen ? `<div style="margin-top:6px;">${report.dangerMen}</div>` : ""
        ]
            .filter(Boolean)
            .join("");

        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>${report.name} - Opposition Scouting Report</title>
                <style>
                    body { font-family: 'Segoe UI', system-ui, sans-serif; padding: 32px; max-width: 920px; margin: 0 auto; color: #0f172a; }
                    .header { border-bottom: 3px solid #dc2626; padding-bottom: 16px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-end; }
                    h1 { margin: 4px 0 0 0; font-size: 28px; }
                    .sub { font-size: 12px; font-weight: 700; color: #dc2626; text-transform: uppercase; letter-spacing: 0.06em; }
                    .stats-bar { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px; font-size: 13px; display: flex; justify-content: space-between; flex-wrap: wrap; gap: 12px; }
                    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
                    .box { border: 1px solid #e2e8f0; border-left: 4px solid #dc2626; border-radius: 8px; padding: 14px; background: #ffffff; break-inside: avoid; }
                    .box-full { grid-column: 1 / -1; }
                    .box-title { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: #475569; margin-bottom: 6px; }
                    .box-body { font-size: 13px; line-height: 1.5; white-space: pre-wrap; color: #1e293b; }
                </style>
            </head>
            <body>
                <div class="header">
                    <div>
                        <div class="sub">${settings.name || "Camden United"} • Opposition Scouting Report</div>
                        <h1>${report.name}</h1>
                    </div>
                    <div style="text-align:right; font-size:12px; color:#64748b;">
                        <div><strong>Formation:</strong> ${report.formation}</div>
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
                <div class="grid">
                    <div class="box box-full" style="border-left-color:#f59e0b; background:#fffbeb;">
                        <div class="box-title" style="color:#b45309;">⚠️ Danger Men & Key Threats</div>
                        <div class="box-body">${dangerHtml || "No specific danger men recorded."}</div>
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

    const formationPositions = FORMATIONS[activeReport.formation] || FORMATIONS["4-2-3-1"] || [];
    const activeOppFormat: MatchFormat = getFormatFromFormation(activeReport.formation);
    const activeOppRomanLabel = FORMAT_ROMAN_LABEL[activeOppFormat] || "XI";
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
                                    className="pl-8 h-8 text-xs bg-surface-2 border-border"
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
                                    className="h-10 text-sm font-black bg-surface-2 border-border"
                                />
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
                                        className="w-full h-9 px-2.5 rounded-lg border border-border bg-surface-2 text-xs font-bold text-foreground"
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
                                        <span className="text-[9px] font-black uppercase tracking-wider text-brand bg-brand/10 px-1.5 py-0.5 rounded border border-brand/20">
                                            Scouting Dossier
                                        </span>
                                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-surface-2 border border-border text-foreground">
                                            {activeReport.formation}
                                        </span>
                                        <span className="text-[10px] text-muted-foreground">
                                            {formatDateShort(activeReport.updatedAt)}
                                        </span>
                                    </div>
                                    <h2 className="text-xl font-black text-foreground tracking-tight truncate mt-1">
                                        {activeReport.name || "Select an Opponent"}
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
                                        <div className="text-[10px] text-muted-foreground truncate">
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
                                                            className="h-8 text-xs font-bold text-center bg-surface-1 px-1"
                                                        />
                                                        <Input
                                                            placeholder="ST/LW"
                                                            value={dm.position}
                                                            onChange={(e) =>
                                                                handleUpdateDangerMan(dm.id, "position", e.target.value)
                                                            }
                                                            className="h-8 text-xs font-bold bg-surface-1 px-2"
                                                        />
                                                        <select
                                                            value={dm.foot || "Right"}
                                                            onChange={(e) =>
                                                                handleUpdateDangerMan(dm.id, "foot", e.target.value)
                                                            }
                                                            className="h-8 rounded-md border border-border bg-surface-1 px-2 text-xs font-semibold text-foreground"
                                                        >
                                                            <option value="Right">Right Foot</option>
                                                            <option value="Left">Left Foot</option>
                                                            <option value="Both">Both Feet</option>
                                                        </select>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemoveDangerMan(dm.id)}
                                                            className="h-8 w-8 rounded-md flex items-center justify-center text-rose-500 hover:bg-rose-500/10"
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </button>
                                                    </div>
                                                    <Input
                                                        placeholder="Player name or nickname..."
                                                        value={dm.name}
                                                        onChange={(e) =>
                                                            handleUpdateDangerMan(dm.id, "name", e.target.value)
                                                        }
                                                        className="h-8 text-xs font-semibold bg-surface-1"
                                                    />
                                                    <Input
                                                        placeholder="Threat notes (e.g. Cuts inside onto right foot, rapid in behind)..."
                                                        value={dm.notes}
                                                        onChange={(e) =>
                                                            handleUpdateDangerMan(dm.id, "notes", e.target.value)
                                                        }
                                                        className="h-8 text-xs bg-surface-1"
                                                    />
                                                </>
                                            ) : (
                                                <div
                                                    onClick={handleEditReport}
                                                    className="space-y-1 cursor-pointer"
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
                                                            <span className="text-xs font-extrabold text-foreground">
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
                                                    {dm.notes && (
                                                        <p className="text-xs text-muted-foreground leading-relaxed">
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
                                    placeholder="General danger men notes (e.g. #10 dictates play, #7 takes all set pieces)..."
                                    className="w-full min-h-[75px] rounded-xl border border-border bg-surface-2 p-2.5 text-xs text-foreground placeholder:text-muted-foreground outline-none"
                                />
                            ) : activeReport.dangerMen ? (
                                <p
                                    onClick={handleEditReport}
                                    className="text-xs text-foreground whitespace-pre-wrap leading-relaxed cursor-text"
                                >
                                    {activeReport.dangerMen}
                                </p>
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
                                    className="w-full min-h-[90px] rounded-xl border border-border bg-surface-2 p-2.5 text-xs text-foreground outline-none"
                                />
                            ) : (
                                <p
                                    onClick={handleEditReport}
                                    className="text-xs text-foreground whitespace-pre-wrap leading-relaxed cursor-text py-1"
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
                                    className="w-full min-h-[90px] rounded-xl border border-border bg-surface-2 p-2.5 text-xs text-foreground outline-none"
                                />
                            ) : (
                                <p
                                    onClick={handleEditReport}
                                    className="text-xs text-foreground whitespace-pre-wrap leading-relaxed cursor-text py-1"
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
                                    className="w-full min-h-[90px] rounded-xl border border-border bg-surface-2 p-2.5 text-xs text-foreground outline-none"
                                />
                            ) : (
                                <p
                                    onClick={handleEditReport}
                                    className="text-xs text-foreground whitespace-pre-wrap leading-relaxed cursor-text py-1"
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
                                    className="w-full min-h-[90px] rounded-xl border border-border bg-surface-2 p-2.5 text-xs text-foreground outline-none"
                                />
                            ) : (
                                <p
                                    onClick={handleEditReport}
                                    className="text-xs text-foreground whitespace-pre-wrap leading-relaxed cursor-text py-1"
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
                                    className="w-full min-h-[90px] rounded-xl border border-border bg-surface-2 p-2.5 text-xs text-foreground outline-none"
                                />
                            ) : (
                                <p
                                    onClick={handleEditReport}
                                    className="text-xs text-foreground whitespace-pre-wrap leading-relaxed cursor-text py-1"
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
                                    className="w-full min-h-[90px] rounded-xl border border-border bg-surface-2 p-2.5 text-xs text-foreground outline-none"
                                />
                            ) : (
                                <p
                                    onClick={handleEditReport}
                                    className="text-xs text-foreground whitespace-pre-wrap leading-relaxed cursor-text py-1"
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
                                    Tactical Pitch ({activeReport.formation} • {activeOppFormat})
                                </h3>
                                <p className="text-[10px] text-muted-foreground">
                                    Tap any shirt number on the pitch to edit their role &amp; traits
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
                        <div className="relative w-full bg-emerald-700" style={{ paddingBottom: "82%" }}>
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
                                const isTopHalf = pos.y < 50 && pos.label !== "GK";
                                const profile = (activeReport.playerProfiles || []).find(
                                    (p) => p.positionIndex === idx
                                );
                                const playerName = activeReport.lineup?.[idx] || "";
                                return (
                                    <div
                                        key={idx}
                                        className="absolute z-20 cursor-pointer"
                                        style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
                                        onClick={() => handleOpenPositionProfile(idx)}
                                    >
                                        <div
                                            className={`absolute -translate-x-1/2 -translate-y-1/2 w-7 h-7 bg-white border-2 rounded-full flex items-center justify-center shadow-lg ${
                                                profile?.role ? "border-amber-500" : "border-red-600"
                                            }`}
                                        >
                                            <span className="text-[9px] font-black text-slate-900">
                                                {pos.number}
                                            </span>
                                        </div>
                                        <div
                                            className={`absolute -translate-x-1/2 z-30 flex flex-col items-center ${
                                                isTopHalf ? "bottom-4" : "top-4"
                                            }`}
                                        >
                                            <span className="text-[8px] font-bold text-white bg-slate-900/80 px-1 py-0.5 rounded whitespace-nowrap truncate max-w-[62px]">
                                                {playerName || getDisplayPosition(pos.label)}
                                            </span>
                                        </div>
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
                                        className="flex items-center gap-2 p-2 rounded-xl bg-surface-2/70 border border-border cursor-pointer"
                                    >
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
                                            className="flex-1 text-xs bg-surface-1 border border-border rounded-lg px-2 py-1 text-foreground outline-none focus:border-brand"
                                        />
                                        {profile?.role && (
                                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-500 shrink-0">
                                                {profile.role}
                                            </span>
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
                                    className="w-full min-h-[85px] rounded-xl border border-border bg-surface-2 p-2.5 text-xs text-foreground outline-none"
                                />
                            ) : (
                                <p
                                    onClick={handleEditReport}
                                    className="text-xs text-foreground whitespace-pre-wrap leading-relaxed cursor-text py-1"
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
                    <div className="fixed bottom-16 left-3 right-3 z-40 rounded-2xl bg-surface-1/95 backdrop-blur-md border border-brand/40 p-2.5 shadow-2xl flex items-center justify-between gap-2">
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
                                        <div className="grid grid-cols-1 sm:grid-cols-[1fr_160px] gap-3">
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
                                                <span className="text-[10px] font-extrabold uppercase tracking-wider text-brand bg-brand/10 px-2 py-0.5 rounded border border-brand/20">
                                                    Opposition Dossier
                                                </span>
                                                <Badge variant="outline" className="text-[11px] font-extrabold">
                                                    Shape: {activeReport.formation} ({activeOppFormat})
                                                </Badge>
                                                <span className="text-[11px] text-muted-foreground">
                                                    Updated {formatDateShort(activeReport.updatedAt)}
                                                </span>
                                            </div>
                                            <h1 className="text-2xl md:text-3xl font-black text-foreground tracking-tight truncate">
                                                {activeReport.name || "Select an Opponent"}
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
                                                            <span className="text-[10px] text-muted-foreground truncate max-w-[160px]">
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
                                                    <Input
                                                        placeholder="Threat notes (e.g. Rapid in behind, cuts inside onto left foot)..."
                                                        value={dm.notes}
                                                        onChange={(e) =>
                                                            handleUpdateDangerMan(dm.id, "notes", e.target.value)
                                                        }
                                                        className="h-8 text-xs bg-surface-1"
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
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex items-center gap-1.5 flex-wrap">
                                                            <span className="text-xs font-extrabold text-foreground">
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
                                                        <p className="text-xs text-muted-foreground mt-0.5">
                                                            {dm.notes || "Key threat"}
                                                        </p>
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
                                    placeholder="General notes on their key threats (e.g. #9 and #11 swap wings constantly, #6 dictates tempo if given time)..."
                                    className="w-full min-h-[72px] rounded-xl border border-border bg-surface-2 p-3 text-xs text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-amber-500 outline-none resize-y"
                                />
                            ) : activeReport.dangerMen ? (
                                <p
                                    onClick={handleEditReport}
                                    className="text-xs md:text-sm text-foreground whitespace-pre-wrap bg-surface-2/60 hover:bg-surface-2 rounded-xl p-3 border border-border cursor-text transition-colors"
                                >
                                    {activeReport.dangerMen}
                                </p>
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
                                        className="text-xs md:text-sm text-foreground whitespace-pre-wrap min-h-[60px] cursor-text rounded-xl p-2 -m-2 hover:bg-surface-2/60 transition-colors"
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
                                        className="text-xs md:text-sm text-foreground whitespace-pre-wrap min-h-[60px] cursor-text rounded-xl p-2 -m-2 hover:bg-surface-2/60 transition-colors"
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
                                        className="text-xs md:text-sm text-foreground whitespace-pre-wrap min-h-[60px] cursor-text rounded-xl p-2 -m-2 hover:bg-surface-2/60 transition-colors"
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
                                        className="text-xs md:text-sm text-foreground whitespace-pre-wrap min-h-[60px] cursor-text rounded-xl p-2 -m-2 hover:bg-surface-2/60 transition-colors"
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
                                        className="text-xs md:text-sm text-foreground whitespace-pre-wrap min-h-[60px] cursor-text rounded-xl p-2 -m-2 hover:bg-surface-2/60 transition-colors"
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
                                        className="text-xs md:text-sm text-foreground whitespace-pre-wrap min-h-[60px] cursor-text rounded-xl p-2 -m-2 hover:bg-surface-2/60 transition-colors"
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
                                    className="text-xs md:text-sm text-foreground whitespace-pre-wrap min-h-[48px] cursor-text rounded-xl p-2.5 -m-2.5 hover:bg-surface-2/60 transition-colors"
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
                                    <span>Tactical Pitch Visualizer ({activeReport.formation} • {activeOppFormat})</span>
                                    <span className="text-[10px] font-semibold text-muted-foreground normal-case">
                                        (Optional)
                                    </span>
                                </h3>
                                <p className="text-[11px] text-muted-foreground">
                                    Expand to map out their {activeOppFormat} lineup and individual position roles on the pitch
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
                                <div className="relative w-full bg-emerald-700" style={{ paddingBottom: "75%" }}>
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
                                        const isTopHalf = pos.y < 50 && pos.label !== "GK";
                                        const profile = (activeReport.playerProfiles || []).find(
                                            (p) => p.positionIndex === idx
                                        );
                                        const playerName = activeReport.lineup?.[idx] || "";
                                        return (
                                            <div
                                                key={idx}
                                                className="absolute z-20 cursor-pointer group"
                                                style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
                                                onClick={() => handleOpenPositionProfile(idx)}
                                            >
                                                <div
                                                    className={`absolute -translate-x-1/2 -translate-y-1/2 w-7 h-7 sm:w-8 sm:h-8 bg-white border-2 rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform ${
                                                        profile?.role ? "border-amber-500" : "border-red-600"
                                                    }`}
                                                >
                                                    <span className="text-[9px] sm:text-[10px] font-black text-slate-900">
                                                        {pos.number}
                                                    </span>
                                                </div>
                                                <div
                                                    className={`absolute -translate-x-1/2 z-30 flex flex-col items-center ${
                                                        isTopHalf ? "bottom-4" : "top-4"
                                                    }`}
                                                >
                                                    <span className="text-[8px] font-bold text-white bg-slate-900/75 px-1.5 py-0.5 rounded whitespace-nowrap">
                                                        {playerName || getDisplayPosition(pos.label)}
                                                    </span>
                                                </div>
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
                                                    className="flex items-center gap-2.5 p-2 rounded-lg bg-surface-2/60 border border-border hover:border-brand/40 cursor-pointer"
                                                >
                                                    <div className="w-6 h-6 rounded-full bg-brand text-brand-foreground flex items-center justify-center shrink-0 text-[10px] font-black">
                                                        {pos.number}
                                                    </div>
                                                    <span className="text-xs font-bold text-muted-foreground w-10 shrink-0">
                                                        {getDisplayPosition(pos.label)}
                                                    </span>
                                                    <input
                                                        type="text"
                                                        value={activeReport.lineup?.[idx] || ""}
                                                        onChange={(e) => handleUpdateLineupName(idx, e.target.value)}
                                                        onClick={(e) => e.stopPropagation()}
                                                        placeholder="Add player name..."
                                                        className="flex-1 text-xs bg-surface-1 border border-border rounded px-2 py-1 text-foreground outline-none focus:border-brand"
                                                    />
                                                    {profile?.role && (
                                                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-500 shrink-0">
                                                            {profile.role}
                                                        </span>
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
                <DialogContent className="max-w-md bg-surface-1 border-border text-foreground rounded-2xl p-6">
                    <DialogHeader>
                        <DialogTitle className="text-base font-bold">
                            Position Profile: {formationPositions[selectedProfileIndex || 0]?.label} (#
                            {formationPositions[selectedProfileIndex || 0]?.number})
                        </DialogTitle>
                    </DialogHeader>
                    {selectedProfileIndex !== null &&
                        (() => {
                            const name = activeReport.lineup?.[selectedProfileIndex] || "";
                            const currentProfile = (activeReport.playerProfiles || []).find(
                                (p) => p.positionIndex === selectedProfileIndex
                            ) || {
                                positionIndex: selectedProfileIndex,
                                role: "",
                                foot: "Right",
                                traits: ""
                            };

                            return (
                                <div className="space-y-4 mt-2">
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
                                            placeholder="e.g. Opposition #9"
                                            className="mt-1 bg-surface-2 border-border"
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <Label className="text-xs font-bold text-muted-foreground uppercase">
                                                Tactical Role
                                            </Label>
                                            <select
                                                value={currentProfile.role}
                                                onChange={(e) =>
                                                    handleUpdatePositionProfile(selectedProfileIndex, {
                                                        role: e.target.value
                                                    })
                                                }
                                                className="w-full mt-1 px-3 py-2 border border-border rounded-md text-xs bg-surface-2 text-foreground"
                                            >
                                                <option value="">Select Role...</option>
                                                <option value="Sweeper Keeper">Sweeper Keeper</option>
                                                <option value="Ball Playing Defender">Ball Playing Defender</option>
                                                <option value="No-Nonsense CB">No-Nonsense CB</option>
                                                <option value="Wing-Back">Wing-Back</option>
                                                <option value="Deep Lying Playmaker">Deep Lying Playmaker</option>
                                                <option value="Box-to-Box Midfielder">Box-to-Box Midfielder</option>
                                                <option value="Advanced Playmaker">Advanced Playmaker</option>
                                                <option value="Inverted Winger">Inverted Winger</option>
                                                <option value="Target Man">Target Man</option>
                                                <option value="Poacher">Poacher</option>
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
                                                className="w-full mt-1 px-3 py-2 border border-border rounded-md text-xs bg-surface-2 text-foreground"
                                            >
                                                <option value="Right">Right</option>
                                                <option value="Left">Left</option>
                                                <option value="Both">Both</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div>
                                        <Label className="text-xs font-bold text-muted-foreground uppercase">
                                            Player Traits / Notes
                                        </Label>
                                        <textarea
                                            value={currentProfile.traits}
                                            onChange={(e) =>
                                                handleUpdatePositionProfile(selectedProfileIndex, {
                                                    traits: e.target.value
                                                })
                                            }
                                            placeholder="e.g. Fast in behind, weak left foot..."
                                            className="w-full mt-1 h-20 p-2 text-xs border border-border bg-surface-2 text-foreground rounded-md resize-none"
                                        />
                                    </div>

                                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setSelectedProfileIndex(null)}
                                            className="h-8 px-3 rounded-xl border-border bg-surface-2 text-xs font-bold"
                                        >
                                            Close
                                        </Button>
                                        <Button
                                            type="button"
                                            size="sm"
                                            onClick={handleSavePositionProfileModal}
                                            className="h-8 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold shadow-xs"
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
