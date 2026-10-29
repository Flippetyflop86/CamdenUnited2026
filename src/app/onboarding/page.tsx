"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useClub } from "@/context/club-context";
import { useAuth } from "@/context/auth-context";
import { supabase } from "@/lib/supabase";
import { ALL_PAGE_PERMISSIONS } from "@/lib/permissions";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Trophy,
    Upload,
    ArrowRight,
    ArrowLeft,
    Check,
    Sparkles,
    Shield,
    Shirt,
    PoundSterling,
    Users,
    Calendar,
    Plus,
    Trash2,
    UserPlus,
    Gavel,
    MapPin,
    Clock,
    Compass,
    Layers,
    Hash,
    MessageSquare,
    Copy,
    Share2,
    Zap,
    Wrench,
    ClipboardPaste,
    FileSpreadsheet,
    CheckCircle2,
    Loader2,
    Eye,
    Palette,
    Sliders,
    Rocket,
    LayoutDashboard,
} from "lucide-react";

type WizardMode = "express" | "full";
type StageId = 0 | 1 | 2 | 3 | 4; // 0 = Welcome, 1 = Identity & Kits, 2 = Matchday & Finance, 3 = Instant Import Hub, 4 = Staff & Launch

interface ParsedSquadDraft {
    squadNumber: number | null;
    firstName: string;
    lastName: string;
    position: string;
}

interface ParsedStandingsRow {
    pos: number;
    team: string;
    played: number;
    won: number;
    drawn: number;
    lost: number;
    gf: number;
    ga: number;
    gd: number;
    pts: number;
}

interface GeneratedStaffInvite {
    id: string;
    name: string;
    email: string;
    roleTitle: string;
    accessLevel: "admin" | "coach" | "viewer";
    inviteUrl: string;
}

const ROLE_PRESETS = [
    {
        id: "manager",
        label: "First-Team Manager / Head Coach",
        desc: "Focus on Squad, Matchday XI, Training, Fixtures, Opposition & Recruitment",
        tabs: ["squad", "training", "matches", "matchday-xi", "opposition", "league", "recruitment", "staff", "documents"],
    },
    {
        id: "chairman",
        label: "Chairman / Club Secretary",
        desc: "Full 360° club oversight including Finances, Sponsors, Inventory & Football",
        tabs: ALL_PAGE_PERMISSIONS.filter((p) => p.key !== "admin").map((p) => p.key),
    },
    {
        id: "treasurer",
        label: "Treasurer / Finance Officer",
        desc: "Streamlined workspace for Subs, Payments, Budgets, Sponsors & Squad",
        tabs: ["squad", "matches", "finance", "payments", "budgets", "sponsors", "inventory", "documents"],
    },
    {
        id: "coach",
        label: "Coach / Tactical Analyst",
        desc: "Pure pitch focus: Squad, Training, Matchday XI, Matches, League & Opposition",
        tabs: ["squad", "training", "matches", "matchday-xi", "opposition", "league", "recruitment"],
    },
];

const COMPETITION_PRESETS = [
    { id: "step5_7", label: "Saturday Step 5–7", ko: "15:00", comp: "Premier Division", meetOffset: 75 },
    { id: "regional", label: "Saturday Regional / County", ko: "14:00", comp: "Senior Division", meetOffset: 60 },
    { id: "sunday", label: "Sunday League", ko: "10:30", comp: "Sunday Premier", meetOffset: 45 },
    { id: "midweek", label: "Midweek Floodlit / Vets", ko: "19:45", comp: "Midweek Floodlit League", meetOffset: 60 },
    { id: "youth", label: "Youth / Academy", ko: "10:00", comp: "Youth Development League", meetOffset: 45 },
];

const FORMATIONS: Record<string, { label: string; coords: { x: number; y: number; role: string }[] }> = {
    "4-3-3": {
        label: "4-3-3 Attack",
        coords: [
            { x: 50, y: 88, role: "GK" },
            { x: 18, y: 68, role: "LB" },
            { x: 38, y: 72, role: "CB" },
            { x: 62, y: 72, role: "CB" },
            { x: 82, y: 68, role: "RB" },
            { x: 50, y: 52, role: "CDM" },
            { x: 32, y: 42, role: "CM" },
            { x: 68, y: 42, role: "CM" },
            { x: 20, y: 20, role: "LW" },
            { x: 50, y: 15, role: "ST" },
            { x: 80, y: 20, role: "RW" },
        ],
    },
    "4-2-3-1": {
        label: "4-2-3-1 Modern",
        coords: [
            { x: 50, y: 88, role: "GK" },
            { x: 18, y: 68, role: "LB" },
            { x: 38, y: 72, role: "CB" },
            { x: 62, y: 72, role: "CB" },
            { x: 82, y: 68, role: "RB" },
            { x: 36, y: 54, role: "CDM" },
            { x: 64, y: 54, role: "CDM" },
            { x: 20, y: 32, role: "LAM" },
            { x: 50, y: 34, role: "CAM" },
            { x: 80, y: 32, role: "RAM" },
            { x: 50, y: 15, role: "ST" },
        ],
    },
    "4-4-2": {
        label: "4-4-2 Classic",
        coords: [
            { x: 50, y: 88, role: "GK" },
            { x: 18, y: 68, role: "LB" },
            { x: 38, y: 72, role: "CB" },
            { x: 62, y: 72, role: "CB" },
            { x: 82, y: 68, role: "RB" },
            { x: 18, y: 44, role: "LM" },
            { x: 38, y: 48, role: "CM" },
            { x: 62, y: 48, role: "CM" },
            { x: 82, y: 44, role: "RM" },
            { x: 36, y: 18, role: "ST" },
            { x: 64, y: 18, role: "ST" },
        ],
    },
    "3-5-2": {
        label: "3-5-2 Wingbacks",
        coords: [
            { x: 50, y: 88, role: "GK" },
            { x: 26, y: 72, role: "CB" },
            { x: 50, y: 74, role: "CB" },
            { x: 74, y: 72, role: "CB" },
            { x: 14, y: 46, role: "LWB" },
            { x: 50, y: 56, role: "CDM" },
            { x: 34, y: 42, role: "CM" },
            { x: 66, y: 42, role: "CM" },
            { x: 86, y: 46, role: "RWB" },
            { x: 36, y: 18, role: "ST" },
            { x: 64, y: 18, role: "ST" },
        ],
    },
};

const FINES_PRESET_PACK = [
    { id: "fine-late", name: "Late for Matchday Meet", amount: 5 },
    { id: "fine-yellow", name: "Yellow Card (Dissent)", amount: 10 },
    { id: "fine-red", name: "Red Card", amount: 25 },
    { id: "fine-boots", name: "Dirty Boots on Matchday", amount: 3 },
    { id: "fine-kit", name: "Forgot Kit Item", amount: 5 },
    { id: "fine-noshow", name: "No-Show Without Notice", amount: 15 },
];

const COLOR_SWATCHES = [
    "#dc2626",
    "#2563eb",
    "#16a34a",
    "#eab308",
    "#9333ea",
    "#ea580c",
    "#0d9488",
    "#db2777",
    "#ffffff",
    "#0f172a",
];

function calculateMeetTime(koTime: string, offsetMinutes: number): string {
    const parts = koTime.split(":").map(Number);
    if (parts.length !== 2 || isNaN(parts[0]) || isNaN(parts[1])) return "13:45";
    const totalMins = parts[0] * 60 + parts[1] - offsetMinutes;
    const clamped = ((totalMins % 1440) + 1440) % 1440;
    const hh = String(Math.floor(clamped / 60)).padStart(2, "0");
    const mm = String(clamped % 60).padStart(2, "0");
    return `${hh}:${mm}`;
}

function parseSquadPasteText(raw: string): ParsedSquadDraft[] {
    if (!raw.trim()) return [];
    const lines = raw
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);

    const parsed: ParsedSquadDraft[] = [];
    const posRegex = /\b(GK|GOALKEEPER|CB|RB|LB|RWB|LWB|DEF|DEFENDER|CDM|CM|CAM|RM|LM|MID|MIDFIELDER|RW|LW|ST|CF|FWD|FORWARD|WINGER|STRIKER)\b/i;

    for (const line of lines) {
        let cleaned = line.replace(/^[•\-*]\s*/, "").trim();
        let squadNumber: number | null = null;

        const numMatch = cleaned.match(/^#?(\d{1,2})[\s.\-:)]+(.*)$/);
        if (numMatch) {
            squadNumber = parseInt(numMatch[1], 10);
            cleaned = numMatch[2].trim();
        }

        let position = "MID";
        const posMatch = cleaned.match(posRegex);
        if (posMatch) {
            const rawPos = posMatch[1].toUpperCase();
            if (rawPos === "GOALKEEPER" || rawPos === "GK") position = "GK";
            else if (["CB", "RB", "LB", "RWB", "LWB", "DEF", "DEFENDER"].includes(rawPos)) position = rawPos === "DEFENDER" ? "DEF" : rawPos;
            else if (["CDM", "CM", "CAM", "RM", "LM", "MID", "MIDFIELDER"].includes(rawPos)) position = rawPos === "MIDFIELDER" ? "CM" : rawPos;
            else position = ["STRIKER", "FORWARD"].includes(rawPos) ? "ST" : rawPos === "WINGER" ? "RW" : rawPos;

            cleaned = cleaned
                .replace(/\(\s*(GK|GOALKEEPER|CB|RB|LB|RWB|LWB|DEF|DEFENDER|CDM|CM|CAM|RM|LM|MID|MIDFIELDER|RW|LW|ST|CF|FWD|FORWARD|WINGER|STRIKER)\s*\)/i, "")
                .replace(/[-–—|,:]\s*(GK|GOALKEEPER|CB|RB|LB|RWB|LWB|DEF|DEFENDER|CDM|CM|CAM|RM|LM|MID|MIDFIELDER|RW|LW|ST|CF|FWD|FORWARD|WINGER|STRIKER)\b/i, "")
                .replace(posRegex, "")
                .trim();
        }

        cleaned = cleaned.replace(/[-–—|,:()]+$/g, "").trim();
        if (!cleaned) continue;

        const nameParts = cleaned.split(/\s+/);
        const firstName = nameParts[0] || "Player";
        const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : "";

        parsed.push({
            squadNumber,
            firstName,
            lastName: lastName || "—",
            position,
        });
    }

    return parsed;
}

function parseLeagueStandingsText(raw: string): ParsedStandingsRow[] {
    const lines = raw
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);

    const parsed: ParsedStandingsRow[] = [];

    for (const line of lines) {
        if (/^(pos|position|#)\b/i.test(line)) continue;
        let tokens = line.split(/\t+/).map((t) => t.trim()).filter(Boolean);
        if (tokens.length < 6) {
            tokens = line.split(/\s{2,}/).map((t) => t.trim()).filter(Boolean);
        }
        if (tokens.length < 6) {
            const match = line.match(/^(\d+)\s+(.+?)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)(?:\s+(.*))?$/);
            if (match) {
                const pos = parseInt(match[1], 10);
                const team = match[2].trim();
                const played = parseInt(match[3], 10);
                const won = parseInt(match[4], 10);
                const drawn = parseInt(match[5], 10);
                const lost = parseInt(match[6], 10);
                const restNums = (match[7] || "")
                    .trim()
                    .split(/\s+/)
                    .filter(Boolean)
                    .map((n) => parseInt(n.replace(/^\+/, ""), 10))
                    .filter((n) => !isNaN(n));

                let gf = 0,
                    ga = 0,
                    gd = 0,
                    pts = won * 3 + drawn;
                if (restNums.length >= 4) {
                    gf = restNums[0];
                    ga = restNums[1];
                    gd = restNums[restNums.length - 2];
                    pts = restNums[restNums.length - 1];
                } else if (restNums.length === 3) {
                    gf = restNums[0];
                    ga = restNums[1];
                    gd = gf - ga;
                    pts = restNums[2];
                } else if (restNums.length === 2) {
                    gd = restNums[0];
                    pts = restNums[1];
                } else if (restNums.length === 1) {
                    pts = restNums[0];
                }
                parsed.push({ pos, team, played, won, drawn, lost, gf, ga, gd, pts });
                continue;
            }
        }

        if (tokens.length >= 6 && /^\d+$/.test(tokens[0])) {
            const pos = parseInt(tokens[0], 10);
            const team = tokens[1];
            const nums = tokens
                .slice(2)
                .map((n) => parseInt(n.replace(/^\+/, ""), 10))
                .filter((n) => !isNaN(n));
            if (nums.length >= 4) {
                const played = nums[0];
                const won = nums[1];
                const drawn = nums[2];
                const lost = nums[3];
                let gf = 0,
                    ga = 0,
                    gd = 0,
                    pts = won * 3 + drawn;
                if (nums.length >= 8) {
                    gf = nums[4];
                    ga = nums[5];
                    gd = nums[nums.length - 2];
                    pts = nums[nums.length - 1];
                } else if (nums.length === 7) {
                    gf = nums[4];
                    ga = nums[5];
                    gd = gf - ga;
                    pts = nums[6];
                } else if (nums.length === 6) {
                    gd = nums[4];
                    pts = nums[5];
                } else if (nums.length === 5) {
                    pts = nums[4];
                }
                parsed.push({ pos, team, played, won, drawn, lost, gf, ga, gd, pts });
            }
        }
    }

    return parsed.sort((a, b) => a.pos - b.pos);
}

function OnboardingContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const isRerun = searchParams.get("rerun") === "1";

    const { settings, updateSettings } = useClub();
    const { user, clubId } = useAuth();

    const [wizardMode, setWizardMode] = useState<WizardMode>("full");
    const [stage, setStage] = useState<StageId>(isRerun ? 1 : 0);
    const [previewTab, setPreviewTab] = useState<"dashboard" | "pitch" | "whatsapp">("pitch");
    const [showMobilePreview, setShowMobilePreview] = useState(false);

    // Stage 1: Identity, Role & Kits
    const [clubName, setClubName] = useState(settings.name === "My Club" ? "" : settings.name);
    const [managerName, setManagerName] = useState((user?.user_metadata?.name as string) || "");
    const [selectedRolePreset, setSelectedRolePreset] = useState<string>("chairman");
    const [selectedTabs, setSelectedTabs] = useState<string[]>(
        ALL_PAGE_PERMISSIONS.filter((p) => p.key !== "admin").map((p) => p.key)
    );
    const [logoPreview, setLogoPreview] = useState<string | null>(settings.logo);
    const [extractedSwatches, setExtractedSwatches] = useState<string[]>([]);
    const [primaryColor, setPrimaryColor] = useState(settings.primaryColor || "#dc2626");

    // Kits
    const [activeKitPreview, setActiveKitPreview] = useState<"home" | "away">("home");
    const [homeKitShirt, setHomeKitShirt] = useState(settings.homeKitShirt || "#dc2626");
    const [homeKitShorts, setHomeKitShorts] = useState(settings.homeKitShorts || "#0f172a");
    const [homeKitSocks, setHomeKitSocks] = useState(settings.homeKitSocks || "#dc2626");
    const [awayKitShirt, setAwayKitShirt] = useState(settings.awayKitShirt || "#eab308");
    const [awayKitShorts, setAwayKitShorts] = useState(settings.awayKitShorts || "#0f172a");
    const [awayKitSocks, setAwayKitSocks] = useState(settings.awayKitSocks || "#eab308");
    const [gkKitColor, setGkKitColor] = useState("#16a34a");
    const [sponsorLogo, setSponsorLogo] = useState<string | null>(settings.sponsorLogo);

    // Stage 2: Matchday, Tactical & Finances
    const [competitionPreset, setCompetitionPreset] = useState("step5_7");
    const [preferredFormation, setPreferredFormation] = useState<string>("4-3-3");
    const [useMatchdayNumbering, setUseMatchdayNumbering] = useState(settings.useMatchdayNumbering ?? true);
    const [homeGround, setHomeGround] = useState(settings.homeGround || "");
    const [trainingLocation, setTrainingLocation] = useState(settings.trainingLocation || "");
    const [defaultHomeKickOff, setDefaultHomeKickOff] = useState(settings.defaultHomeKickOff || "15:00");
    const [defaultCompetition, setDefaultCompetition] = useState(settings.defaultCompetition || "Premier Division");
    const [meetOffsetMins, setMeetOffsetMins] = useState<number>(75);
    const [squads, setSquads] = useState<string[]>(settings.squads?.length ? settings.squads : ["First Team"]);
    const [customSquadInput, setCustomSquadInput] = useState("");
    const [whatsappPollMessage, setWhatsappPollMessage] = useState(
        settings.whatsappPollMessage ||
            "📋 *MATCHDAY AVAILABILITY POLL*\nPlease vote on the poll below for this week's fixture so the gaffer can finalise the squad!"
    );

    // Finance Model: "per_game" | "monthly" | "skip"
    const [financeModel, setFinanceModel] = useState<"per_game" | "monthly" | "skip">("monthly");
    const [monthlySubs, setMonthlySubs] = useState(settings.monthlySubs ?? 25);
    const [registrationFee, setRegistrationFee] = useState(settings.registrationFee ?? 50);
    const [trainingFeePerSession, setTrainingFeePerSession] = useState(settings.trainingFeePerSession ?? 5);
    const [contractsEnabled, setContractsEnabled] = useState(settings.contractsEnabled ?? false);
    const [finesEnabled, setFinesEnabled] = useState(settings.finesEnabled ?? true);
    const [fineCategories, setFineCategories] = useState<{ id: string; name: string; amount: number }[]>(
        (settings.fineCategories || []).map((f: any, idx: number) => ({
            id: f.id || `fine-init-${idx}`,
            name: f.name,
            amount: f.amount,
        }))
    );
    const [newFineName, setNewFineName] = useState("");
    const [newFineAmount, setNewFineAmount] = useState(5);

    // Stage 3: Instant Data Import Hub
    const [importTab, setImportTab] = useState<"squad" | "table" | "fixtures" | "demo">("squad");
    const [rawSquadPaste, setRawSquadPaste] = useState("");
    const [importedPlayersCount, setImportedPlayersCount] = useState(0);
    const [isImportingSquad, setIsImportingSquad] = useState(false);

    const [rawTablePaste, setRawTablePaste] = useState("");
    const [importedTeamsCount, setImportedTeamsCount] = useState(0);
    const [isImportingTable, setIsImportingTable] = useState(false);

    const [rawFixturesPaste, setRawFixturesPaste] = useState("");
    const [parsedFixturesPreview, setParsedFixturesPreview] = useState<any[]>([]);
    const [isParsingFixtures, setIsParsingFixtures] = useState(false);
    const [isImportingFixtures, setIsImportingFixtures] = useState(false);
    const [importedFixturesCount, setImportedFixturesCount] = useState(0);

    const [isSeedingDemo, setIsSeedingDemo] = useState(false);
    const [demoSeeded, setDemoSeeded] = useState(false);

    // Stage 4: Staff Invites & Launch
    const [staffName, setStaffName] = useState("");
    const [staffEmail, setStaffEmail] = useState("");
    const [staffRoleTitle, setStaffRoleTitle] = useState("Assistant Manager");
    const [staffAccessLevel, setStaffAccessLevel] = useState<"admin" | "coach" | "viewer">("coach");
    const [isCreatingInvite, setIsCreatingInvite] = useState(false);
    const [generatedInvites, setGeneratedInvites] = useState<GeneratedStaffInvite[]>([]);
    const [copiedLinkKey, setCopiedLinkKey] = useState<string | null>(null);
    const [isCompleting, setIsCompleting] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const sponsorInputRef = useRef<HTMLInputElement>(null);

    // Redirect away only if already onboarded AND not in rerun mode AND still on welcome stage
    useEffect(() => {
        if (settings.isOnboarded && !isRerun && stage === 0) {
            router.replace("/dashboard");
        }
    }, [settings.isOnboarded, isRerun, stage, router]);

    // Sync initial settings when loaded
    useEffect(() => {
        if (settings.name && settings.name !== "My Club" && !clubName) {
            setClubName(settings.name);
        }
        if (settings.logo && !logoPreview) {
            setLogoPreview(settings.logo);
        }
    }, [settings.name, settings.logo]);

    // Extract dominant colors from uploaded badge using HTML5 Canvas
    const extractColorsFromImage = (dataUrl: string) => {
        if (typeof window === "undefined") return;
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.onload = () => {
            try {
                const canvas = document.createElement("canvas");
                const ctx = canvas.getContext("2d");
                if (!ctx) return;
                canvas.width = 48;
                canvas.height = 48;
                ctx.drawImage(img, 0, 0, 48, 48);
                const data = ctx.getImageData(0, 0, 48, 48).data;
                const buckets: Record<string, { count: number; hex: string }> = {};

                for (let i = 0; i < data.length; i += 16) {
                    const r = data[i];
                    const g = data[i + 1];
                    const b = data[i + 2];
                    const a = data[i + 3];
                    if (a < 128) continue;
                    // Skip near-white or near-black background pixels
                    const brightness = (r + g + b) / 3;
                    if (brightness > 240 || brightness < 20) continue;

                    const qr = Math.round(r / 32) * 32;
                    const qg = Math.round(g / 32) * 32;
                    const qb = Math.round(b / 32) * 32;
                    const key = `${qr},${qg},${qb}`;
                    const hex = `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
                    if (!buckets[key]) {
                        buckets[key] = { count: 0, hex };
                    }
                    buckets[key].count += 1;
                }

                const topColors = Object.values(buckets)
                    .sort((a, b) => b.count - a.count)
                    .slice(0, 5)
                    .map((b) => b.hex);

                if (topColors.length > 0) {
                    setExtractedSwatches(topColors);
                    setPrimaryColor(topColors[0]);
                    setHomeKitShirt(topColors[0]);
                    setHomeKitSocks(topColors[0]);
                    if (topColors[1]) {
                        setAwayKitShirt(topColors[1]);
                        setAwayKitSocks(topColors[1]);
                    }
                }
            } catch {
                // Ignore canvas taint errors
            }
        };
        img.src = dataUrl;
    };

    const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onloadend = () => {
            const res = reader.result as string;
            setLogoPreview(res);
            extractColorsFromImage(res);
        };
        reader.readAsDataURL(file);
    };

    const handleSponsorUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onloadend = () => {
            setSponsorLogo(reader.result as string);
        };
        reader.readAsDataURL(file);
    };

    const handleSelectRolePreset = (presetId: string) => {
        setSelectedRolePreset(presetId);
        const found = ROLE_PRESETS.find((r) => r.id === presetId);
        if (found) {
            setSelectedTabs(found.tabs);
        }
    };

    const toggleTabPermission = (key: string) => {
        setSelectedTabs((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
    };

    const handleSelectCompetitionPreset = (presetId: string) => {
        setCompetitionPreset(presetId);
        const found = COMPETITION_PRESETS.find((c) => c.id === presetId);
        if (found) {
            setDefaultHomeKickOff(found.ko);
            setDefaultCompetition(found.comp);
            setMeetOffsetMins(found.meetOffset);
        }
    };

    const toggleSquadChip = (sq: string) => {
        setSquads((prev) => {
            if (prev.includes(sq)) {
                return prev.length > 1 ? prev.filter((s) => s !== sq) : prev;
            }
            return [...prev, sq];
        });
    };

    const handleAddCustomSquad = () => {
        const trimmed = customSquadInput.trim();
        if (!trimmed) return;
        if (!squads.includes(trimmed)) {
            setSquads((prev) => [...prev, trimmed]);
        }
        setCustomSquadInput("");
    };

    const handleLoadFinesPresetPack = () => {
        setFinesEnabled(true);
        setFineCategories((prev) => {
            const existingNames = new Set(prev.map((f) => f.name.toLowerCase()));
            const merged = [...prev];
            for (const preset of FINES_PRESET_PACK) {
                if (!existingNames.has(preset.name.toLowerCase())) {
                    merged.push({ ...preset, id: `${preset.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` });
                }
            }
            return merged;
        });
    };

    const handleAddCustomFine = () => {
        if (!newFineName.trim()) return;
        setFineCategories((prev) => [
            ...prev,
            { id: `fine-${Date.now()}`, name: newFineName.trim(), amount: Number(newFineAmount) || 5 },
        ]);
        setNewFineName("");
        setNewFineAmount(5);
    };

    // Stage 3 Handlers: Bulk Squad Paste Import
    const parsedSquadDrafts = parseSquadPasteText(rawSquadPaste);

    const handleImportSquadDrafts = async () => {
        if (parsedSquadDrafts.length === 0 || !clubId) return;
        setIsImportingSquad(true);
        try {
            const defaultSquadName = squads[0] || "First Team";
            const rowsToInsert = parsedSquadDrafts.map((p) => ({
                club_id: clubId,
                first_name: p.firstName,
                last_name: p.lastName === "—" ? "" : p.lastName,
                position: p.position,
                squad_number: p.squadNumber,
                squad: defaultSquadName,
                status: "Active",
                medical_status: "Available",
                availability: true,
                is_in_training_squad: true,
                is_in_matchday_tracker: true,
            }));

            const { error } = await supabase.from("players").insert(rowsToInsert);
            if (error) throw error;

            setImportedPlayersCount((prev) => prev + rowsToInsert.length);
            setRawSquadPaste("");
        } catch (err: any) {
            alert("Could not import squad players: " + (err.message || "Unknown error"));
        } finally {
            setIsImportingSquad(false);
        }
    };

    // Stage 3 Handlers: League Table Paste Import
    const parsedStandingsRows = parseLeagueStandingsText(rawTablePaste);

    const handleImportLeagueTable = async () => {
        if (parsedStandingsRows.length === 0 || !clubId) return;
        setIsImportingTable(true);
        try {
            const storageKey = `clubflow_league_table_${clubId}`;
            localStorage.setItem(storageKey, JSON.stringify(parsedStandingsRows));

            // Find our club's position if present
            const ourNameLower = (clubName || settings.name || "").toLowerCase().trim();
            const ourRow = parsedStandingsRows.find(
                (r) =>
                    ourNameLower &&
                    (r.team.toLowerCase().includes(ourNameLower) || ourNameLower.includes(r.team.toLowerCase()))
            );

            // Sync opponent clubs to league_teams
            const existingRes = await supabase.from("league_teams").select("name").eq("club_id", clubId);
            const existingSet = new Set((existingRes.data || []).map((t: any) => (t.name || "").toLowerCase().trim()));

            const newTeamRows = parsedStandingsRows
                .filter((r) => !existingSet.has(r.team.toLowerCase().trim()))
                .map((r) => ({
                    club_id: clubId,
                    name: r.team.trim(),
                }));

            if (newTeamRows.length > 0) {
                await supabase.from("league_teams").insert(newTeamRows);
            }

            await updateSettings({
                leaguePosition: ourRow ? ourRow.pos : settings.leaguePosition,
                lastImportHistory: {
                    ...settings.lastImportHistory,
                    table: {
                        timestamp: new Date().toISOString(),
                        summary: `Imported ${parsedStandingsRows.length} teams during onboarding`,
                        count: parsedStandingsRows.length,
                    },
                },
            });

            setImportedTeamsCount(parsedStandingsRows.length);
            setRawTablePaste("");
        } catch (err: any) {
            alert("Failed to save league standings: " + (err.message || "Unknown error"));
        } finally {
            setIsImportingTable(false);
        }
    };

    // Stage 3 Handlers: Fixtures Paste Parse & Import
    const handleParseFixturesPaste = async () => {
        if (!rawFixturesPaste.trim()) return;
        setIsParsingFixtures(true);
        try {
            const res = await fetch("/api/parse-schedule", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    rawText: rawFixturesPaste,
                    clubName: clubName || settings.name || "Camden United",
                    defaultHomeGround: homeGround || settings.homeGround || "Home Ground",
                    defaultKickOff: defaultHomeKickOff || "15:00",
                    defaultCompetition: defaultCompetition || "League",
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to parse schedule");
            setParsedFixturesPreview(data.fixtures || []);
        } catch (err: any) {
            alert("Could not parse fixtures text: " + (err.message || "Unknown error"));
        } finally {
            setIsParsingFixtures(false);
        }
    };

    const handleConfirmImportFixtures = async () => {
        if (parsedFixturesPreview.length === 0 || !clubId) return;
        setIsImportingFixtures(true);
        try {
            const rows = parsedFixturesPreview.map((f: any) => ({
                club_id: clubId,
                opponent: f.opponent,
                date: f.date,
                kick_off: f.kickOff || defaultHomeKickOff || "15:00",
                home_away: f.homeAway || "Home",
                venue: f.venue || (f.homeAway === "Home" ? homeGround || "Home Ground" : "Away Venue"),
                competition: f.competition || defaultCompetition || "League",
                result: f.result || "Pending",
                scoreline: f.scoreline || null,
                squad: squads[0] || "First Team",
            }));

            const { error } = await supabase.from("matches").insert(rows);
            if (error) throw error;

            setImportedFixturesCount((prev) => prev + rows.length);
            setParsedFixturesPreview([]);
            setRawFixturesPaste("");
        } catch (err: any) {
            alert("Error importing fixtures: " + (err.message || "Unknown error"));
        } finally {
            setIsImportingFixtures(false);
        }
    };

    // Stage 3 Handler: Seed Demo Sandbox Data
    const handleSeedDemoData = async () => {
        if (!clubId || demoSeeded) return;
        setIsSeedingDemo(true);
        try {
            const defaultSquad = squads[0] || "First Team";
            const samplePlayers = [
                { first_name: "Aaron", last_name: "Ramsdale", position: "GK", squad_number: 1 },
                { first_name: "Kyle", last_name: "Walker-Peters", position: "RB", squad_number: 2 },
                { first_name: "Tyrick", last_name: "Mitchell", position: "LB", squad_number: 3 },
                { first_name: "Marc", last_name: "Guehi", position: "CB", squad_number: 4 },
                { first_name: "Ezri", last_name: "Konsa", position: "CB", squad_number: 5 },
                { first_name: "Declan", last_name: "Rice", position: "CDM", squad_number: 6 },
                { first_name: "Bukayo", last_name: "Saka", position: "RW", squad_number: 7 },
                { first_name: "Conor", last_name: "Gallagher", position: "CM", squad_number: 8 },
                { first_name: "Ollie", last_name: "Watkins", position: "ST", squad_number: 9 },
                { first_name: "Eberechi", last_name: "Eze", position: "CAM", squad_number: 10 },
                { first_name: "Anthony", last_name: "Gordon", position: "LW", squad_number: 11 },
                { first_name: "Levi", last_name: "Colwill", position: "CB", squad_number: 12 },
                { first_name: "Curtis", last_name: "Jones", position: "CM", squad_number: 14 },
                { first_name: "Jarrod", last_name: "Bowen", position: "RW", squad_number: 17 },
                { first_name: "Ivan", last_name: "Toney", position: "ST", squad_number: 19 },
                { first_name: "Dean", last_name: "Henderson", position: "GK", squad_number: 22 },
            ].map((p) => ({
                ...p,
                club_id: clubId,
                squad: defaultSquad,
                status: "Active",
                medical_status: "Available",
                availability: true,
                is_in_training_squad: true,
                is_in_matchday_tracker: true,
            }));

            await supabase.from("players").insert(samplePlayers);

            const today = new Date();
            const offsetDate = (days: number) => {
                const d = new Date(today);
                d.setDate(d.getDate() + days);
                return d.toISOString().split("T")[0];
            };

            const sampleMatches = [
                {
                    club_id: clubId,
                    opponent: "Highgate Albion FC",
                    date: offsetDate(-14),
                    kick_off: defaultHomeKickOff,
                    home_away: "Home",
                    venue: homeGround || "Home Ground",
                    competition: defaultCompetition,
                    result: "W",
                    scoreline: "3-1",
                    squad: defaultSquad,
                },
                {
                    club_id: clubId,
                    opponent: "Islington Borough",
                    date: offsetDate(-7),
                    kick_off: defaultHomeKickOff,
                    home_away: "Away",
                    venue: "Market Road Pitches",
                    competition: defaultCompetition,
                    result: "D",
                    scoreline: "2-2",
                    squad: defaultSquad,
                },
                {
                    club_id: clubId,
                    opponent: "Hackney Wick Athletic",
                    date: offsetDate(4),
                    kick_off: defaultHomeKickOff,
                    home_away: "Home",
                    venue: homeGround || "Home Ground",
                    competition: defaultCompetition,
                    result: "Pending",
                    scoreline: null,
                    squad: defaultSquad,
                },
                {
                    club_id: clubId,
                    opponent: "Finsbury Park Rovers",
                    date: offsetDate(11),
                    kick_off: defaultHomeKickOff,
                    home_away: "Away",
                    venue: "Downhills Park",
                    competition: defaultCompetition,
                    result: "Pending",
                    scoreline: null,
                    squad: defaultSquad,
                },
            ];

            await supabase.from("matches").insert(sampleMatches);

            const ourTeamName = clubName || settings.name || "Our Club FC";
            const sampleTable: ParsedStandingsRow[] = [
                { pos: 1, team: "Hackney Wick Athletic", played: 10, won: 8, drawn: 1, lost: 1, gf: 26, ga: 9, gd: 17, pts: 25 },
                { pos: 2, team: ourTeamName, played: 10, won: 7, drawn: 2, lost: 1, gf: 24, ga: 11, gd: 13, pts: 23 },
                { pos: 3, team: "Islington Borough", played: 10, won: 6, drawn: 3, lost: 1, gf: 19, ga: 10, gd: 9, pts: 21 },
                { pos: 4, team: "Highgate Albion FC", played: 10, won: 5, drawn: 2, lost: 3, gf: 17, ga: 14, gd: 3, pts: 17 },
                { pos: 5, team: "Finsbury Park Rovers", played: 10, won: 4, drawn: 2, lost: 4, gf: 15, ga: 16, gd: -1, pts: 14 },
                { pos: 6, team: "Hampstead Town", played: 10, won: 2, drawn: 1, lost: 7, gf: 10, ga: 22, gd: -12, pts: 7 },
            ];
            localStorage.setItem(`clubflow_league_table_${clubId}`, JSON.stringify(sampleTable));

            setImportedPlayersCount((prev) => prev + samplePlayers.length);
            setImportedFixturesCount((prev) => prev + sampleMatches.length);
            setImportedTeamsCount(sampleTable.length);
            setDemoSeeded(true);
        } catch (err: any) {
            alert("Could not seed sample data: " + (err.message || "Unknown error"));
        } finally {
            setIsSeedingDemo(false);
        }
    };

    // Stage 4 Handler: Create Real Staff Invite Link
    const handleCreateStaffInvite = async () => {
        if (!staffName.trim() || !clubId) return;
        setIsCreatingInvite(true);
        try {
            const token = crypto.randomUUID();
            const origin = typeof window !== "undefined" ? window.location.origin : "https://camdenuniteddatahub.vercel.app";
            const inviteUrl = `${origin}/join?token=${token}`;

            const permsForRole =
                staffAccessLevel === "admin"
                    ? ALL_PAGE_PERMISSIONS.map((p) => p.key)
                    : staffAccessLevel === "coach"
                    ? ["squad", "training", "matches", "matchday-xi", "opposition", "league", "recruitment"]
                    : ["squad", "matches", "league"];

            await supabase.from("club_invitations").insert({
                club_id: clubId,
                email: staffEmail.trim() || `${staffName.toLowerCase().replace(/\s+/g, ".")}@club.local`,
                role: staffAccessLevel,
                token,
                permissions: permsForRole,
            });

            await supabase.from("staff").insert({
                club_id: clubId,
                name: staffName.trim(),
                email: staffEmail.trim() || null,
                role: staffRoleTitle,
                access_level: staffAccessLevel === "admin" ? "Full Admin" : staffAccessLevel === "coach" ? "Coach View" : "View Only",
                permissions: permsForRole,
            });

            setGeneratedInvites((prev) => [
                ...prev,
                {
                    id: token,
                    name: staffName.trim(),
                    email: staffEmail.trim(),
                    roleTitle: staffRoleTitle,
                    accessLevel: staffAccessLevel,
                    inviteUrl,
                },
            ]);
            setStaffName("");
            setStaffEmail("");
        } catch (err: any) {
            alert("Could not create invite: " + (err.message || "Unknown error"));
        } finally {
            setIsCreatingInvite(false);
        }
    };

    const copyToClipboard = (text: string, key: string) => {
        navigator.clipboard.writeText(text);
        setCopiedLinkKey(key);
        setTimeout(() => setCopiedLinkKey(null), 2000);
    };

    // Finalize Onboarding & Navigate
    const handleCompleteOnboarding = async (destination: string = "/dashboard") => {
        setIsCompleting(true);
        try {
            if (user) {
                if (managerName.trim()) {
                    await supabase.auth.updateUser({
                        data: { name: managerName.trim() },
                    });
                }
                await supabase
                    .from("profiles")
                    .update({
                        permissions: Array.from(new Set([...selectedTabs, "admin"])),
                    })
                    .eq("id", user.id);
            }

            if (typeof window !== "undefined" && clubId) {
                localStorage.setItem(`clubflow_gk_kit_${clubId}`, gkKitColor);
                localStorage.setItem(`clubflow_default_formation_${clubId}`, preferredFormation);
                localStorage.setItem(`clubflow_meet_offset_${clubId}`, String(meetOffsetMins));
            }

            const subsEnabledVal = financeModel !== "skip";
            const effectiveMonthlySubs = financeModel === "per_game" ? 0 : Number(monthlySubs) || 0;
            const effectiveRegFee = financeModel === "per_game" ? 0 : Number(registrationFee) || 0;

            await updateSettings({
                name: clubName.trim() || "My Football Club",
                logo: logoPreview,
                primaryColor,
                secondaryColor: "#0f172a",
                homeKitShirt,
                homeKitShorts,
                homeKitSocks,
                awayKitShirt,
                awayKitShorts,
                awayKitSocks,
                sponsorLogo,
                homeGround: homeGround.trim() || "Home Ground",
                trainingLocation: trainingLocation.trim() || "Training Centre",
                defaultHomeKickOff: defaultHomeKickOff || "15:00",
                defaultCompetition: defaultCompetition.trim() || "Premier Division",
                useMatchdayNumbering,
                squads: squads.length > 0 ? squads : ["First Team"],
                whatsappPollMessage,
                subsEnabled: subsEnabledVal,
                monthlySubs: effectiveMonthlySubs,
                registrationFee: effectiveRegFee,
                trainingFeePerSession: subsEnabledVal ? Number(trainingFeePerSession) || 0 : 0,
                contractsEnabled: subsEnabledVal ? contractsEnabled : false,
                finesEnabled,
                fineCategories,
                isOnboarded: true,
            });

            router.push(destination);
        } catch (err: any) {
            alert("Error saving club setup: " + (err.message || "Unknown error"));
        } finally {
            setIsCompleting(false);
        }
    };

    const activeFormation = FORMATIONS[preferredFormation] || FORMATIONS["4-3-3"];
    const activeShirt = activeKitPreview === "home" ? homeKitShirt : awayKitShirt;
    const activeShorts = activeKitPreview === "home" ? homeKitShorts : awayKitShorts;
    const activeSocks = activeKitPreview === "home" ? homeKitSocks : awayKitSocks;
    const computedMeetTime = calculateMeetTime(defaultHomeKickOff, meetOffsetMins);

    const visibleStages: { id: StageId; title: string; subtitle: string }[] =
        wizardMode === "express"
            ? [
                  { id: 1, title: "Club & Kits", subtitle: "Badge, colors & strip" },
                  { id: 4, title: "Launchpad", subtitle: "Ready for kick-off" },
              ]
            : [
                  { id: 1, title: "Identity & Kits", subtitle: "Badge, colors & strip" },
                  { id: 2, title: "Matchday & Club", subtitle: "Formation, ground & subs" },
                  { id: 3, title: "Instant Import", subtitle: "Squad, table & fixtures" },
                  { id: 4, title: "Staff & Launch", subtitle: "Invites & kick-off" },
              ];

    const goNextStage = () => {
        if (wizardMode === "express") {
            if (stage === 0) setStage(1);
            else if (stage === 1) setStage(4);
            return;
        }
        if (stage < 4) setStage((stage + 1) as StageId);
    };

    const goPrevStage = () => {
        if (wizardMode === "express" && stage === 4) {
            setStage(1);
            return;
        }
        if (stage > 0) setStage((stage - 1) as StageId);
    };

    return (
        <div className="min-h-screen bg-[#070A10] text-white relative overflow-x-hidden flex flex-col">
            {/* Ambient Club Glow */}
            <div
                className="pointer-events-none fixed -top-40 -left-40 w-[520px] h-[520px] rounded-full blur-[160px] opacity-20 transition-colors duration-700"
                style={{ backgroundColor: primaryColor }}
            />
            <div
                className="pointer-events-none fixed bottom-0 right-0 w-[460px] h-[460px] rounded-full blur-[160px] opacity-15 transition-colors duration-700"
                style={{ backgroundColor: awayKitShirt }}
            />

            {/* Top Navigation Bar */}
            <header className="sticky top-0 z-30 border-b border-white/10 bg-[#070A10]/85 backdrop-blur-xl px-4 sm:px-8 py-3.5">
                <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center border border-white/15 shadow-lg overflow-hidden shrink-0"
                            style={{ backgroundColor: `${primaryColor}22` }}
                        >
                            {logoPreview ? (
                                <img src={logoPreview} alt="Badge" className="w-8 h-8 object-contain" />
                            ) : (
                                <Shield className="w-5 h-5" style={{ color: primaryColor }} />
                            )}
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="font-extrabold tracking-tight text-white text-sm sm:text-base">
                                    {clubName || "Club Onboarding Studio"}
                                </span>
                                {isRerun && (
                                    <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30 text-[10px]">
                                        Setup Re-Run
                                    </Badge>
                                )}
                            </div>
                            <p className="text-[11px] text-slate-400 hidden sm:block">
                                Configure your club identity, matchday defaults, data imports & coaching staff
                            </p>
                        </div>
                    </div>

                    {/* Express vs Full Setup Mode Toggle */}
                    <div className="flex items-center gap-2">
                        <div className="inline-flex rounded-xl bg-slate-900/90 p-1 border border-white/10">
                            <button
                                type="button"
                                onClick={() => {
                                    setWizardMode("express");
                                    if (stage === 2 || stage === 3) setStage(1);
                                }}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                    wizardMode === "express"
                                        ? "bg-emerald-500 text-slate-950 shadow"
                                        : "text-slate-400 hover:text-white"
                                }`}
                            >
                                <Zap className="w-3.5 h-3.5" />
                                60s Express
                            </button>
                            <button
                                type="button"
                                onClick={() => setWizardMode("full")}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                    wizardMode === "full"
                                        ? "bg-white text-slate-950 shadow"
                                        : "text-slate-400 hover:text-white"
                                }`}
                            >
                                <Wrench className="w-3.5 h-3.5" />
                                Full Club Setup
                            </button>
                        </div>

                        {isRerun && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => router.push("/dashboard")}
                                className="text-xs text-slate-400 hover:text-white"
                            >
                                Exit to Dashboard
                            </Button>
                        )}
                    </div>
                </div>

                {/* Stage Stepper Bar (shown when stage > 0) */}
                {stage > 0 && (
                    <div className="max-w-7xl mx-auto mt-3 pt-3 border-t border-white/5 flex items-center justify-between gap-2 overflow-x-auto no-scrollbar">
                        <div className="flex items-center gap-2 sm:gap-4">
                            {visibleStages.map((s, idx) => {
                                const isActive = stage === s.id;
                                const isDone = stage > s.id;
                                return (
                                    <button
                                        key={s.id}
                                        type="button"
                                        onClick={() => setStage(s.id)}
                                        className={`flex items-center gap-2.5 px-3 py-1.5 rounded-xl border text-left transition-all shrink-0 ${
                                            isActive
                                                ? "border-white/30 bg-white/10 text-white shadow-sm"
                                                : isDone
                                                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                                                : "border-white/5 bg-slate-900/40 text-slate-500 hover:text-slate-300"
                                        }`}
                                    >
                                        <span
                                            className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black ${
                                                isDone
                                                    ? "bg-emerald-500 text-slate-950"
                                                    : isActive
                                                    ? "text-white"
                                                    : "bg-slate-800 text-slate-400"
                                            }`}
                                            style={isActive ? { backgroundColor: primaryColor } : undefined}
                                        >
                                            {isDone ? <Check className="w-3.5 h-3.5" /> : idx + 1}
                                        </span>
                                        <div>
                                            <div className="text-xs font-bold leading-tight">{s.title}</div>
                                            <div className="text-[10px] opacity-75 hidden md:block">{s.subtitle}</div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>

                        <button
                            type="button"
                            onClick={() => setShowMobilePreview((v) => !v)}
                            className="lg:hidden flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-white/15 text-xs font-bold text-slate-200 shrink-0"
                        >
                            <Eye className="w-3.5 h-3.5 text-emerald-400" />
                            {showMobilePreview ? "Hide Preview" : "Live Preview"}
                        </button>
                    </div>
                )}
            </header>

            {/* STAGE 0: WELCOME SPLASH */}
            {stage === 0 && (
                <main className="flex-1 flex items-center justify-center p-4 sm:p-8 z-10">
                    <div className="max-w-4xl w-full grid grid-cols-1 lg:grid-cols-12 gap-6 items-center bg-slate-900/70 border border-white/10 rounded-3xl p-6 sm:p-10 backdrop-blur-xl shadow-2xl">
                        <div className="lg:col-span-7 space-y-6">
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-bold">
                                <Sparkles className="w-3.5 h-3.5" /> Next-Gen Football Club Operating System
                            </div>
                            <h1 className="text-3xl sm:text-5xl font-black tracking-tight leading-[1.1]">
                                Build Your Digital{" "}
                                <span
                                    className="bg-clip-text text-transparent"
                                    style={{
                                        backgroundImage: `linear-gradient(135deg, #ffffff 0%, ${primaryColor} 100%)`,
                                    }}
                                >
                                    Dugout & Data Hub
                                </span>
                            </h1>
                            <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
                                Whether you want to jump straight onto the tactics board in{" "}
                                <strong className="text-white">60 seconds</strong> or import your entire{" "}
                                <strong className="text-white">FA Full-Time fixtures, league table, squad & fines</strong> in
                                one go, choose how you’d like to set up your club:
                            </p>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setWizardMode("full");
                                        setStage(1);
                                    }}
                                    className="group text-left p-4 rounded-2xl border-2 border-white/20 bg-white/5 hover:bg-white/10 hover:border-white/40 transition-all"
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="p-2 rounded-xl bg-white/10 text-white">
                                            <Wrench className="w-5 h-5" />
                                        </span>
                                        <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[10px]">
                                            Recommended (~3 mins)
                                        </Badge>
                                    </div>
                                    <div className="font-bold text-base text-white group-hover:translate-x-0.5 transition-transform">
                                        Full Club Setup
                                    </div>
                                    <p className="text-xs text-slate-400 mt-1">
                                        Badge & kits, formation, matchday rules, FA Full-Time paste import & staff invite links.
                                    </p>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => {
                                        setWizardMode("express");
                                        setStage(1);
                                    }}
                                    className="group text-left p-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10 transition-all"
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="p-2 rounded-xl bg-emerald-500/20 text-emerald-300">
                                            <Zap className="w-5 h-5" />
                                        </span>
                                        <Badge className="bg-slate-800 text-slate-300 border-white/10 text-[10px]">
                                            Fast Track (~60 secs)
                                        </Badge>
                                    </div>
                                    <div className="font-bold text-base text-white group-hover:translate-x-0.5 transition-transform">
                                        60-Second Express
                                    </div>
                                    <p className="text-xs text-slate-400 mt-1">
                                        Set your club name, badge & kit colors and jump straight into your workspace.
                                    </p>
                                </button>
                            </div>
                        </div>

                        {/* Welcome Visual Feature Stack */}
                        <div className="lg:col-span-5 bg-slate-950/80 border border-white/10 rounded-2xl p-5 space-y-3.5">
                            <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                                What you can set up today
                            </div>
                            {[
                                {
                                    icon: Palette,
                                    title: "Auto-Badge Color Extraction & 3 Kits",
                                    desc: "Upload your crest to auto-detect Home, Away & GK colors.",
                                },
                                {
                                    icon: ClipboardPaste,
                                    title: "Instant Squad & FA Full-Time Paste",
                                    desc: "Paste your WhatsApp squad list, fixtures & league table.",
                                },
                                {
                                    icon: Shirt,
                                    title: "Formation & 1–11 Shirt Numbering",
                                    desc: "Pre-configure your default Matchday XI pitch layout.",
                                },
                                {
                                    icon: Share2,
                                    title: "1-Click WhatsApp Staff Invites",
                                    desc: "Generate live join links for your Assistant & Coaches.",
                                },
                            ].map((item, i) => (
                                <div
                                    key={i}
                                    className="flex items-start gap-3 p-3 rounded-xl bg-slate-900/70 border border-white/5"
                                >
                                    <div
                                        className="p-2 rounded-lg shrink-0 mt-0.5"
                                        style={{ backgroundColor: `${primaryColor}20`, color: primaryColor }}
                                    >
                                        <item.icon className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <div className="text-xs font-bold text-white">{item.title}</div>
                                        <div className="text-[11px] text-slate-400">{item.desc}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </main>
            )}

            {/* STAGES 1–4: SPLIT-SCREEN WORKSPACE + LIVE PREVIEW */}
            {stage > 0 && (
                <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-8 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6 z-10">
                    {/* Left Column: Active Stage Controls */}
                    <div className="lg:col-span-7 space-y-6">
                        {/* STAGE 1: IDENTITY, ROLE & KITS */}
                        {stage === 1 && (
                            <Card className="bg-slate-900/75 border-white/10 backdrop-blur-xl rounded-3xl overflow-hidden">
                                <CardContent className="p-5 sm:p-7 space-y-7">
                                    <div>
                                        <Badge className="bg-white/10 text-white border-white/15 text-[10px] mb-2">
                                            STAGE 1 • CLUB IDENTITY & KIT STUDIO
                                        </Badge>
                                        <h2 className="text-2xl font-black text-white">
                                            Club Identity, Crest & Match Kits
                                        </h2>
                                        <p className="text-xs sm:text-sm text-slate-400 mt-1">
                                            Upload your club badge to automatically sample your club colors, and customize your
                                            Home, Away and Goalkeeper strips.
                                        </p>
                                    </div>

                                    {/* Club Name & Manager Name */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-bold uppercase tracking-wider text-slate-300">
                                                Football Club Name *
                                            </label>
                                            <Input
                                                value={clubName}
                                                onChange={(e) => setClubName(e.target.value)}
                                                placeholder="e.g. Camden United FC"
                                                className="h-11 bg-slate-950/90 border-white/15 text-white font-semibold"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-bold uppercase tracking-wider text-slate-300">
                                                Your Name (Manager / Admin)
                                            </label>
                                            <Input
                                                value={managerName}
                                                onChange={(e) => setManagerName(e.target.value)}
                                                placeholder="e.g. Leon"
                                                className="h-11 bg-slate-950/90 border-white/15 text-white"
                                            />
                                        </div>
                                    </div>

                                    {/* Badge Upload + Auto-Extracted Swatches */}
                                    <div className="p-4 rounded-2xl bg-slate-950/70 border border-white/10 flex flex-col sm:flex-row items-center gap-4">
                                        <div
                                            onClick={() => fileInputRef.current?.click()}
                                            className="w-20 h-20 rounded-2xl border-2 border-dashed border-white/20 hover:border-white/50 bg-slate-900 flex items-center justify-center cursor-pointer overflow-hidden shrink-0 transition-all"
                                        >
                                            {logoPreview ? (
                                                <img
                                                    src={logoPreview}
                                                    alt="Club Crest"
                                                    className="w-16 h-16 object-contain"
                                                />
                                            ) : (
                                                <Upload className="w-6 h-6 text-slate-400" />
                                            )}
                                        </div>
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            accept="image/*"
                                            onChange={handleLogoUpload}
                                            className="hidden"
                                        />
                                        <div className="flex-1 space-y-2 text-center sm:text-left">
                                            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => fileInputRef.current?.click()}
                                                    className="h-8 text-xs border-white/15 bg-white/5 hover:bg-white/10 text-white"
                                                >
                                                    <Upload className="w-3.5 h-3.5 mr-1.5" />
                                                    {logoPreview ? "Change Badge" : "Upload Club Badge"}
                                                </Button>
                                                <span className="text-[11px] text-slate-400">
                                                    PNG or SVG recommended
                                                </span>
                                            </div>

                                            {extractedSwatches.length > 0 && (
                                                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1">
                                                    <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1">
                                                        <Sparkles className="w-3 h-3" /> Colors detected from badge:
                                                    </span>
                                                    {extractedSwatches.map((hex, i) => (
                                                        <button
                                                            key={i}
                                                            type="button"
                                                            onClick={() => {
                                                                setPrimaryColor(hex);
                                                                setHomeKitShirt(hex);
                                                                setHomeKitSocks(hex);
                                                            }}
                                                            title={`Use ${hex} as Primary & Home color`}
                                                            className="w-6 h-6 rounded-full border-2 border-white/40 shadow hover:scale-110 transition-transform"
                                                            style={{ backgroundColor: hex }}
                                                        />
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Primary Theme Color */}
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold uppercase tracking-wider text-slate-300">
                                            Club Primary Brand Color
                                        </label>
                                        <div className="flex flex-wrap items-center gap-2">
                                            {COLOR_SWATCHES.map((hex) => (
                                                <button
                                                    key={hex}
                                                    type="button"
                                                    onClick={() => setPrimaryColor(hex)}
                                                    className={`w-8 h-8 rounded-xl border-2 transition-all ${
                                                        primaryColor.toLowerCase() === hex.toLowerCase()
                                                            ? "border-white scale-110 shadow-lg"
                                                            : "border-white/15 opacity-75 hover:opacity-100"
                                                    }`}
                                                    style={{ backgroundColor: hex }}
                                                />
                                            ))}
                                            <input
                                                type="color"
                                                value={primaryColor}
                                                onChange={(e) => setPrimaryColor(e.target.value)}
                                                className="w-9 h-8 rounded-lg bg-transparent border border-white/20 cursor-pointer"
                                                title="Custom Hex Color"
                                            />
                                        </div>
                                    </div>

                                    {/* Home, Away & GK Kit Studio */}
                                    <div className="p-4 rounded-2xl bg-slate-950/70 border border-white/10 space-y-4">
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <div className="flex items-center gap-2">
                                                <Shirt className="w-4 h-4 text-emerald-400" />
                                                <span className="text-xs font-bold uppercase tracking-wider text-white">
                                                    Matchday Kit Colors (Home, Away & GK)
                                                </span>
                                            </div>
                                            <div className="inline-flex rounded-lg bg-slate-900 p-0.5 border border-white/10">
                                                <button
                                                    type="button"
                                                    onClick={() => setActiveKitPreview("home")}
                                                    className={`px-2.5 py-1 rounded-md text-[11px] font-bold ${
                                                        activeKitPreview === "home"
                                                            ? "bg-white text-slate-950"
                                                            : "text-slate-400"
                                                    }`}
                                                >
                                                    Home Strip
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setActiveKitPreview("away")}
                                                    className={`px-2.5 py-1 rounded-md text-[11px] font-bold ${
                                                        activeKitPreview === "away"
                                                            ? "bg-white text-slate-950"
                                                            : "text-slate-400"
                                                    }`}
                                                >
                                                    Away Strip
                                                </button>
                                            </div>
                                        </div>

                                        {activeKitPreview === "home" ? (
                                            <div className="grid grid-cols-3 gap-3">
                                                <div className="p-3 rounded-xl bg-slate-900/90 border border-white/10 flex items-center justify-between">
                                                    <span className="text-xs font-semibold text-slate-300">Home Shirt</span>
                                                    <input
                                                        type="color"
                                                        value={homeKitShirt}
                                                        onChange={(e) => setHomeKitShirt(e.target.value)}
                                                        className="w-8 h-8 rounded cursor-pointer bg-transparent"
                                                    />
                                                </div>
                                                <div className="p-3 rounded-xl bg-slate-900/90 border border-white/10 flex items-center justify-between">
                                                    <span className="text-xs font-semibold text-slate-300">Home Shorts</span>
                                                    <input
                                                        type="color"
                                                        value={homeKitShorts}
                                                        onChange={(e) => setHomeKitShorts(e.target.value)}
                                                        className="w-8 h-8 rounded cursor-pointer bg-transparent"
                                                    />
                                                </div>
                                                <div className="p-3 rounded-xl bg-slate-900/90 border border-white/10 flex items-center justify-between">
                                                    <span className="text-xs font-semibold text-slate-300">Home Socks</span>
                                                    <input
                                                        type="color"
                                                        value={homeKitSocks}
                                                        onChange={(e) => setHomeKitSocks(e.target.value)}
                                                        className="w-8 h-8 rounded cursor-pointer bg-transparent"
                                                    />
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-3 gap-3">
                                                <div className="p-3 rounded-xl bg-slate-900/90 border border-white/10 flex items-center justify-between">
                                                    <span className="text-xs font-semibold text-slate-300">Away Shirt</span>
                                                    <input
                                                        type="color"
                                                        value={awayKitShirt}
                                                        onChange={(e) => setAwayKitShirt(e.target.value)}
                                                        className="w-8 h-8 rounded cursor-pointer bg-transparent"
                                                    />
                                                </div>
                                                <div className="p-3 rounded-xl bg-slate-900/90 border border-white/10 flex items-center justify-between">
                                                    <span className="text-xs font-semibold text-slate-300">Away Shorts</span>
                                                    <input
                                                        type="color"
                                                        value={awayKitShorts}
                                                        onChange={(e) => setAwayKitShorts(e.target.value)}
                                                        className="w-8 h-8 rounded cursor-pointer bg-transparent"
                                                    />
                                                </div>
                                                <div className="p-3 rounded-xl bg-slate-900/90 border border-white/10 flex items-center justify-between">
                                                    <span className="text-xs font-semibold text-slate-300">Away Socks</span>
                                                    <input
                                                        type="color"
                                                        value={awayKitSocks}
                                                        onChange={(e) => setAwayKitSocks(e.target.value)}
                                                        className="w-8 h-8 rounded cursor-pointer bg-transparent"
                                                    />
                                                </div>
                                            </div>
                                        )}

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                                            <div className="p-3 rounded-xl bg-slate-900/90 border border-white/10 flex items-center justify-between">
                                                <div>
                                                    <div className="text-xs font-bold text-white">Goalkeeper Jersey</div>
                                                    <div className="text-[10px] text-slate-400">Used on Matchday XI graphic</div>
                                                </div>
                                                <input
                                                    type="color"
                                                    value={gkKitColor}
                                                    onChange={(e) => setGkKitColor(e.target.value)}
                                                    className="w-8 h-8 rounded cursor-pointer bg-transparent"
                                                />
                                            </div>

                                            <div className="p-3 rounded-xl bg-slate-900/90 border border-white/10 flex items-center justify-between">
                                                <div>
                                                    <div className="text-xs font-bold text-white">Front-of-Shirt Sponsor</div>
                                                    <div className="text-[10px] text-slate-400">
                                                        {sponsorLogo ? "Sponsor uploaded" : "Optional logo on graphics"}
                                                    </div>
                                                </div>
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => sponsorInputRef.current?.click()}
                                                    className="h-8 text-xs border-white/15 bg-white/5 text-white"
                                                >
                                                    {sponsorLogo ? "Change" : "Upload"}
                                                </Button>
                                                <input
                                                    ref={sponsorInputRef}
                                                    type="file"
                                                    accept="image/*"
                                                    onChange={handleSponsorUpload}
                                                    className="hidden"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Your Role & Workspace Navigation Tabs */}
                                    <div className="space-y-3">
                                        <label className="text-xs font-bold uppercase tracking-wider text-slate-300">
                                            Your Role & Active Sidebar Modules
                                        </label>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                            {ROLE_PRESETS.map((role) => {
                                                const active = selectedRolePreset === role.id;
                                                return (
                                                    <button
                                                        key={role.id}
                                                        type="button"
                                                        onClick={() => handleSelectRolePreset(role.id)}
                                                        className={`p-3.5 rounded-2xl border text-left transition-all ${
                                                            active
                                                                ? "border-emerald-500/60 bg-emerald-500/10"
                                                                : "border-white/10 bg-slate-950/60 hover:border-white/25"
                                                        }`}
                                                    >
                                                        <div className="text-xs font-bold text-white flex items-center justify-between">
                                                            {role.label}
                                                            {active && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                                                        </div>
                                                        <div className="text-[11px] text-slate-400 mt-1">{role.desc}</div>
                                                    </button>
                                                );
                                            })}
                                        </div>

                                        <div className="pt-2">
                                            <div className="text-[11px] text-slate-400 mb-2">
                                                Toggle which tabs appear in your sidebar (you can change this anytime in Admin):
                                            </div>
                                            <div className="flex flex-wrap gap-1.5">
                                                {ALL_PAGE_PERMISSIONS.filter((p) => p.key !== "admin").map((perm) => {
                                                    const on = selectedTabs.includes(perm.key);
                                                    return (
                                                        <button
                                                            key={perm.key}
                                                            type="button"
                                                            onClick={() => toggleTabPermission(perm.key)}
                                                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all ${
                                                                on
                                                                    ? "bg-white/15 border-white/30 text-white"
                                                                    : "bg-slate-950/50 border-white/5 text-slate-500"
                                                            }`}
                                                        >
                                                            {on ? "✓ " : ""}
                                                            {perm.label}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* STAGE 2: MATCHDAY, TACTICAL & FINANCE DEFAULTS */}
                        {stage === 2 && (
                            <Card className="bg-slate-900/75 border-white/10 backdrop-blur-xl rounded-3xl overflow-hidden">
                                <CardContent className="p-5 sm:p-7 space-y-7">
                                    <div>
                                        <Badge className="bg-white/10 text-white border-white/15 text-[10px] mb-2">
                                            STAGE 2 • MATCHDAY, TACTICS & FINANCES
                                        </Badge>
                                        <h2 className="text-2xl font-black text-white">
                                            Tactical Setup, Ground & Club Finances
                                        </h2>
                                        <p className="text-xs sm:text-sm text-slate-400 mt-1">
                                            Set your default formation, shirt numbering mode, kick-off times and optional match
                                            subs or fine rules.
                                        </p>
                                    </div>

                                    {/* Competition Format Presets */}
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold uppercase tracking-wider text-slate-300">
                                            1. Competition Format Preset
                                        </label>
                                        <div className="flex flex-wrap gap-2">
                                            {COMPETITION_PRESETS.map((cp) => (
                                                <button
                                                    key={cp.id}
                                                    type="button"
                                                    onClick={() => handleSelectCompetitionPreset(cp.id)}
                                                    className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
                                                        competitionPreset === cp.id
                                                            ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300"
                                                            : "bg-slate-950/70 border-white/10 text-slate-300 hover:border-white/25"
                                                    }`}
                                                >
                                                    {cp.label} ({cp.ko})
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Preferred Formation & Shirt Numbering Mode */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold uppercase tracking-wider text-slate-300">
                                                Preferred Tactical Formation
                                            </label>
                                            <div className="grid grid-cols-2 gap-2">
                                                {Object.keys(FORMATIONS).map((fKey) => (
                                                    <button
                                                        key={fKey}
                                                        type="button"
                                                        onClick={() => {
                                                            setPreferredFormation(fKey);
                                                            setPreviewTab("pitch");
                                                        }}
                                                        className={`p-2.5 rounded-xl border text-xs font-bold transition-all ${
                                                            preferredFormation === fKey
                                                                ? "bg-white text-slate-950 border-white"
                                                                : "bg-slate-950/70 border-white/10 text-slate-300 hover:border-white/25"
                                                        }`}
                                                    >
                                                        {fKey}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-xs font-bold uppercase tracking-wider text-slate-300">
                                                Matchday Shirt Numbering
                                            </label>
                                            <div className="space-y-2">
                                                <button
                                                    type="button"
                                                    onClick={() => setUseMatchdayNumbering(true)}
                                                    className={`w-full p-2.5 rounded-xl border text-left transition-all ${
                                                        useMatchdayNumbering
                                                            ? "border-emerald-500/60 bg-emerald-500/10"
                                                            : "border-white/10 bg-slate-950/70"
                                                    }`}
                                                >
                                                    <div className="text-xs font-bold text-white">
                                                        1–11 Traditional Matchday Numbers
                                                    </div>
                                                    <div className="text-[10px] text-slate-400">
                                                        Starters wear 1–11, subs wear 12–18 automatically
                                                    </div>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setUseMatchdayNumbering(false)}
                                                    className={`w-full p-2.5 rounded-xl border text-left transition-all ${
                                                        !useMatchdayNumbering
                                                            ? "border-emerald-500/60 bg-emerald-500/10"
                                                            : "border-white/10 bg-slate-950/70"
                                                    }`}
                                                >
                                                    <div className="text-xs font-bold text-white">
                                                        Fixed Season Squad Numbers
                                                    </div>
                                                    <div className="text-[10px] text-slate-400">
                                                        Players keep their assigned squad number all season
                                                    </div>
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Venues & Kick-Off Defaults */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                                                <MapPin className="w-3.5 h-3.5 text-emerald-400" /> Home Ground Venue
                                            </label>
                                            <Input
                                                value={homeGround}
                                                onChange={(e) => setHomeGround(e.target.value)}
                                                placeholder="e.g. Hackney Marshes Pitch 1"
                                                className="h-10 bg-slate-950/90 border-white/15 text-white"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                                                <Compass className="w-3.5 h-3.5 text-sky-400" /> Training Venue
                                            </label>
                                            <Input
                                                value={trainingLocation}
                                                onChange={(e) => setTrainingLocation(e.target.value)}
                                                placeholder="e.g. Market Road 3G (Wed 8pm)"
                                                className="h-10 bg-slate-950/90 border-white/15 text-white"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                                                <Trophy className="w-3.5 h-3.5 text-amber-400" /> Primary League Name
                                            </label>
                                            <Input
                                                value={defaultCompetition}
                                                onChange={(e) => setDefaultCompetition(e.target.value)}
                                                placeholder="e.g. Middlesex County Premier"
                                                className="h-10 bg-slate-950/90 border-white/15 text-white"
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1">
                                                    <Clock className="w-3.5 h-3.5 text-emerald-400" /> Home KO
                                                </label>
                                                <Input
                                                    type="time"
                                                    value={defaultHomeKickOff}
                                                    onChange={(e) => setDefaultHomeKickOff(e.target.value)}
                                                    className="h-10 bg-slate-950/90 border-white/15 text-white"
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-bold uppercase tracking-wider text-slate-300">
                                                    Meet Offset
                                                </label>
                                                <select
                                                    value={meetOffsetMins}
                                                    onChange={(e) => setMeetOffsetMins(Number(e.target.value))}
                                                    className="w-full h-10 rounded-md bg-slate-950/90 border border-white/15 px-2.5 text-xs text-white"
                                                >
                                                    <option value={45}>45m before ({calculateMeetTime(defaultHomeKickOff, 45)})</option>
                                                    <option value={60}>60m before ({calculateMeetTime(defaultHomeKickOff, 60)})</option>
                                                    <option value={75}>75m before ({calculateMeetTime(defaultHomeKickOff, 75)})</option>
                                                    <option value={90}>90m before ({calculateMeetTime(defaultHomeKickOff, 90)})</option>
                                                </select>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Club Squads Multi-Select */}
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                                            <Layers className="w-3.5 h-3.5 text-purple-400" /> Active Club Squads
                                        </label>
                                        <div className="flex flex-wrap gap-2">
                                            {["First Team", "Reserves", "Development / U23s", "U18s", "Midweek", "Vets"].map(
                                                (sq) => {
                                                    const active = squads.includes(sq);
                                                    return (
                                                        <button
                                                            key={sq}
                                                            type="button"
                                                            onClick={() => toggleSquadChip(sq)}
                                                            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                                                                active
                                                                    ? "bg-purple-500/20 border-purple-500/50 text-purple-200"
                                                                    : "bg-slate-950/60 border-white/10 text-slate-400"
                                                            }`}
                                                        >
                                                            {active ? "✓ " : "+ "}
                                                            {sq}
                                                        </button>
                                                    );
                                                }
                                            )}
                                            <div className="flex items-center gap-1.5">
                                                <Input
                                                    value={customSquadInput}
                                                    onChange={(e) => setCustomSquadInput(e.target.value)}
                                                    placeholder="Custom squad..."
                                                    className="h-8 w-36 bg-slate-950/90 border-white/15 text-xs text-white"
                                                />
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={handleAddCustomSquad}
                                                    className="h-8 text-xs border-white/15 bg-white/5 text-white"
                                                >
                                                    Add
                                                </Button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Simplified 3-Card Finance Setup */}
                                    <div className="space-y-3 pt-2 border-t border-white/10">
                                        <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                                            <PoundSterling className="w-3.5 h-3.5 text-emerald-400" /> Player Subs & Finance Model
                                        </label>
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                                            {[
                                                {
                                                    id: "monthly",
                                                    title: "Monthly Standing Order",
                                                    desc: "Monthly subs + annual signing-on fee",
                                                },
                                                {
                                                    id: "per_game",
                                                    title: "Pay-As-You-Play",
                                                    desc: "Matchday & training session fees",
                                                },
                                                {
                                                    id: "skip",
                                                    title: "Pure Football Mode",
                                                    desc: "Skip subs & contracts for now",
                                                },
                                            ].map((m) => (
                                                <button
                                                    key={m.id}
                                                    type="button"
                                                    onClick={() => setFinanceModel(m.id as any)}
                                                    className={`p-3 rounded-2xl border text-left transition-all ${
                                                        financeModel === m.id
                                                            ? "border-emerald-500/60 bg-emerald-500/10"
                                                            : "border-white/10 bg-slate-950/60"
                                                    }`}
                                                >
                                                    <div className="text-xs font-bold text-white">{m.title}</div>
                                                    <div className="text-[10px] text-slate-400 mt-0.5">{m.desc}</div>
                                                </button>
                                            ))}
                                        </div>

                                        {financeModel !== "skip" && (
                                            <div className="grid grid-cols-3 gap-3 pt-2">
                                                {financeModel === "monthly" && (
                                                    <>
                                                        <div className="space-y-1">
                                                            <label className="text-[11px] text-slate-400">Monthly Subs (£)</label>
                                                            <Input
                                                                type="number"
                                                                value={monthlySubs}
                                                                onChange={(e) => setMonthlySubs(Number(e.target.value))}
                                                                className="h-9 bg-slate-950 border-white/15 text-white"
                                                            />
                                                        </div>
                                                        <div className="space-y-1">
                                                            <label className="text-[11px] text-slate-400">Signing Fee (£)</label>
                                                            <Input
                                                                type="number"
                                                                value={registrationFee}
                                                                onChange={(e) => setRegistrationFee(Number(e.target.value))}
                                                                className="h-9 bg-slate-950 border-white/15 text-white"
                                                            />
                                                        </div>
                                                    </>
                                                )}
                                                <div className="space-y-1">
                                                    <label className="text-[11px] text-slate-400">Training Fee (£)</label>
                                                    <Input
                                                        type="number"
                                                        value={trainingFeePerSession}
                                                        onChange={(e) => setTrainingFeePerSession(Number(e.target.value))}
                                                        className="h-9 bg-slate-950 border-white/15 text-white"
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* 1-Click Fines Master Pack */}
                                    <div className="p-4 rounded-2xl bg-slate-950/70 border border-white/10 space-y-3">
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <div className="flex items-center gap-2">
                                                <Gavel className="w-4 h-4 text-amber-400" />
                                                <span className="text-xs font-bold uppercase tracking-wider text-white">
                                                    Squad Fines Master ({fineCategories.length} rules)
                                                </span>
                                            </div>
                                            <Button
                                                type="button"
                                                size="sm"
                                                onClick={handleLoadFinesPresetPack}
                                                className="h-7 text-[11px] font-bold bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30"
                                            >
                                                <Sparkles className="w-3 h-3 mr-1" /> Load Grassroots Fines Pack
                                            </Button>
                                        </div>

                                        {fineCategories.length > 0 && (
                                            <div className="flex flex-wrap gap-1.5">
                                                {fineCategories.map((f) => (
                                                    <span
                                                        key={f.id}
                                                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900 border border-white/10 text-xs text-slate-200"
                                                    >
                                                        {f.name} <strong className="text-amber-400">£{f.amount}</strong>
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                setFineCategories((prev) => prev.filter((x) => x.id !== f.id))
                                                            }
                                                            className="text-slate-500 hover:text-rose-400"
                                                        >
                                                            ×
                                                        </button>
                                                    </span>
                                                ))}
                                            </div>
                                        )}

                                        <div className="flex items-center gap-2">
                                            <Input
                                                value={newFineName}
                                                onChange={(e) => setNewFineName(e.target.value)}
                                                placeholder="Add custom fine (e.g. Nutmegged in Rondo)"
                                                className="h-8 text-xs bg-slate-900 border-white/10 text-white"
                                            />
                                            <Input
                                                type="number"
                                                value={newFineAmount}
                                                onChange={(e) => setNewFineAmount(Number(e.target.value))}
                                                className="h-8 w-20 text-xs bg-slate-900 border-white/10 text-white"
                                            />
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant="outline"
                                                onClick={handleAddCustomFine}
                                                className="h-8 text-xs border-white/15 bg-white/5 text-white shrink-0"
                                            >
                                                + Add
                                            </Button>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* STAGE 3: INSTANT DATA IMPORT HUB (ZERO-EMPTY-STATE) */}
                        {stage === 3 && (
                            <Card className="bg-slate-900/75 border-white/10 backdrop-blur-xl rounded-3xl overflow-hidden">
                                <CardContent className="p-5 sm:p-7 space-y-6">
                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                        <div>
                                            <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[10px] mb-2">
                                                STAGE 3 • ZERO-EMPTY-STATE DATA IMPORT HUB
                                            </Badge>
                                            <h2 className="text-2xl font-black text-white">
                                                Populate Your Club in Seconds (Optional)
                                            </h2>
                                            <p className="text-xs sm:text-sm text-slate-400 mt-1">
                                                Paste your squad list from WhatsApp or your FA Full-Time table and fixtures so your
                                                dashboard is alive from minute one.
                                            </p>
                                        </div>

                                        {/* Live Imported Tally */}
                                        <div className="flex items-center gap-2">
                                            <Badge className="bg-slate-950 border-white/10 text-slate-200 text-xs">
                                                👥 {importedPlayersCount} Players
                                            </Badge>
                                            <Badge className="bg-slate-950 border-white/10 text-slate-200 text-xs">
                                                📅 {importedFixturesCount} Fixtures
                                            </Badge>
                                            <Badge className="bg-slate-950 border-white/10 text-slate-200 text-xs">
                                                🏆 {importedTeamsCount} Teams
                                            </Badge>
                                        </div>
                                    </div>

                                    {/* 4 Import Sub-Tabs */}
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                        {[
                                            { id: "squad", label: "1. Paste Squad", icon: Users },
                                            { id: "table", label: "2. League Table", icon: Trophy },
                                            { id: "fixtures", label: "3. FA Fixtures", icon: Calendar },
                                            { id: "demo", label: "4. Sample Data", icon: Sparkles },
                                        ].map((t) => (
                                            <button
                                                key={t.id}
                                                type="button"
                                                onClick={() => setImportTab(t.id as any)}
                                                className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-bold border transition-all ${
                                                    importTab === t.id
                                                        ? "bg-white text-slate-950 border-white shadow"
                                                        : "bg-slate-950/60 border-white/10 text-slate-300 hover:border-white/25"
                                                }`}
                                            >
                                                <t.icon className="w-3.5 h-3.5" />
                                                {t.label}
                                            </button>
                                        ))}
                                    </div>

                                    {/* TAB 1: PASTE SQUAD LIST */}
                                    {importTab === "squad" && (
                                        <div className="space-y-4 p-4 rounded-2xl bg-slate-950/70 border border-white/10">
                                            <div>
                                                <div className="text-sm font-bold text-white">
                                                    Smart Squad List Parser (WhatsApp / Notes / Excel)
                                                </div>
                                                <p className="text-xs text-slate-400">
                                                    Paste one player per line. Include optional shirt numbers or positions (e.g.{" "}
                                                    <code className="text-emerald-300">1. Jack Smith (GK)</code>,{" "}
                                                    <code className="text-emerald-300">4. Marc Guehi - CB</code>, or just{" "}
                                                    <code className="text-emerald-300">Bukayo Saka RW</code>).
                                                </p>
                                            </div>

                                            <textarea
                                                value={rawSquadPaste}
                                                onChange={(e) => setRawSquadPaste(e.target.value)}
                                                rows={6}
                                                placeholder={`1. Aaron Ramsdale (GK)\n2. Kyle Walker-Peters - RB\n4. Marc Guehi CB\n6. Declan Rice CDM\n7. Bukayo Saka RW\n9. Ollie Watkins ST`}
                                                className="w-full rounded-xl bg-slate-900 border border-white/15 p-3 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                                            />

                                            {parsedSquadDrafts.length > 0 && (
                                                <div className="space-y-2">
                                                    <div className="text-xs font-bold text-emerald-400">
                                                        Preview: {parsedSquadDrafts.length} players ready to import into{" "}
                                                        {squads[0] || "First Team"}
                                                    </div>
                                                    <div className="max-h-40 overflow-y-auto flex flex-wrap gap-1.5 p-2 rounded-xl bg-slate-900/90 border border-white/10">
                                                        {parsedSquadDrafts.map((p, i) => (
                                                            <span
                                                                key={i}
                                                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950 border border-white/10 text-xs"
                                                            >
                                                                {p.squadNumber && (
                                                                    <strong className="text-slate-400">#{p.squadNumber}</strong>
                                                                )}
                                                                <span className="font-semibold text-white">
                                                                    {p.firstName} {p.lastName !== "—" ? p.lastName : ""}
                                                                </span>
                                                                <Badge className="bg-emerald-500/20 text-emerald-300 border-0 text-[10px]">
                                                                    {p.position}
                                                                </Badge>
                                                            </span>
                                                        ))}
                                                    </div>
                                                    <Button
                                                        type="button"
                                                        disabled={isImportingSquad}
                                                        onClick={handleImportSquadDrafts}
                                                        className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black"
                                                    >
                                                        {isImportingSquad ? (
                                                            <>
                                                                <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Importing Squad...
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Check className="w-4 h-4 mr-2" /> Import {parsedSquadDrafts.length}{" "}
                                                                Players Now
                                                            </>
                                                        )}
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* TAB 2: PASTE FA FULL-TIME LEAGUE TABLE */}
                                    {importTab === "table" && (
                                        <div className="space-y-4 p-4 rounded-2xl bg-slate-950/70 border border-white/10">
                                            <div>
                                                <div className="text-sm font-bold text-white">
                                                    Paste FA Full-Time League Standings
                                                </div>
                                                <p className="text-xs text-slate-400">
                                                    Copy & paste the league table rows from FA Full-Time. We’ll save your league
                                                    standings AND automatically add every opponent club to your database.
                                                </p>
                                            </div>

                                            <textarea
                                                value={rawTablePaste}
                                                onChange={(e) => setRawTablePaste(e.target.value)}
                                                rows={6}
                                                placeholder={`1\tCamden United FC\t10\t8\t1\t1\t26\t9\t17\t25\n2\tHighgate Albion\t10\t7\t2\t1\t22\t11\t11\t23`}
                                                className="w-full rounded-xl bg-slate-900 border border-white/15 p-3 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                                            />

                                            {parsedStandingsRows.length > 0 && (
                                                <div className="space-y-3">
                                                    <div className="text-xs font-bold text-emerald-400">
                                                        Detected {parsedStandingsRows.length} League Table rows:
                                                    </div>
                                                    <div className="max-h-40 overflow-y-auto rounded-xl border border-white/10 bg-slate-900/90 p-2 text-xs space-y-1">
                                                        {parsedStandingsRows.map((r) => (
                                                            <div
                                                                key={r.pos}
                                                                className="flex items-center justify-between px-2 py-1 rounded bg-slate-950/60"
                                                            >
                                                                <span>
                                                                    <strong className="text-slate-400 mr-2">{r.pos}.</strong>
                                                                    <span className="font-semibold text-white">{r.team}</span>
                                                                </span>
                                                                <span className="text-slate-400 font-mono">
                                                                    P{r.played} • GD {r.gd >= 0 ? `+${r.gd}` : r.gd} •{" "}
                                                                    <strong className="text-emerald-400">{r.pts} pts</strong>
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    <Button
                                                        type="button"
                                                        disabled={isImportingTable}
                                                        onClick={handleImportLeagueTable}
                                                        className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black"
                                                    >
                                                        {isImportingTable ? (
                                                            <>
                                                                <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Syncing Table &
                                                                Opponents...
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Check className="w-4 h-4 mr-2" /> Save Table & Sync{" "}
                                                                {parsedStandingsRows.length} Clubs
                                                            </>
                                                        )}
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* TAB 3: PASTE FA FULL-TIME FIXTURES */}
                                    {importTab === "fixtures" && (
                                        <div className="space-y-4 p-4 rounded-2xl bg-slate-950/70 border border-white/10">
                                            <div>
                                                <div className="text-sm font-bold text-white">
                                                    Paste FA Full-Time Fixtures or Results
                                                </div>
                                                <p className="text-xs text-slate-400">
                                                    Copy & paste your upcoming fixtures or past results from FA Full-Time and click
                                                    Preview to auto-detect Home/Away, dates, and opponents.
                                                </p>
                                            </div>

                                            <textarea
                                                value={rawFixturesPaste}
                                                onChange={(e) => setRawFixturesPaste(e.target.value)}
                                                rows={5}
                                                placeholder="Paste FA Full-Time fixture list text here..."
                                                className="w-full rounded-xl bg-slate-900 border border-white/15 p-3 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                                            />

                                            <div className="flex items-center gap-2">
                                                <Button
                                                    type="button"
                                                    disabled={isParsingFixtures || !rawFixturesPaste.trim()}
                                                    onClick={handleParseFixturesPaste}
                                                    variant="outline"
                                                    className="border-white/15 bg-white/5 text-white text-xs"
                                                >
                                                    {isParsingFixtures ? (
                                                        <>
                                                            <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Parsing...
                                                        </>
                                                    ) : (
                                                        "Parse Fixtures Text"
                                                    )}
                                                </Button>

                                                {parsedFixturesPreview.length > 0 && (
                                                    <Button
                                                        type="button"
                                                        disabled={isImportingFixtures}
                                                        onClick={handleConfirmImportFixtures}
                                                        className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs"
                                                    >
                                                        {isImportingFixtures ? (
                                                            <>
                                                                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Importing...
                                                            </>
                                                        ) : (
                                                            `Import ${parsedFixturesPreview.length} Fixtures`
                                                        )}
                                                    </Button>
                                                )}
                                            </div>

                                            {parsedFixturesPreview.length > 0 && (
                                                <div className="max-h-40 overflow-y-auto rounded-xl border border-white/10 bg-slate-900/90 p-2 text-xs space-y-1">
                                                    {parsedFixturesPreview.map((f, idx) => (
                                                        <div
                                                            key={idx}
                                                            className="flex items-center justify-between px-2 py-1 rounded bg-slate-950/60"
                                                        >
                                                            <span>
                                                                <Badge className="mr-2 bg-white/10 text-white text-[10px]">
                                                                    {f.homeAway}
                                                                </Badge>
                                                                <strong className="text-white">vs {f.opponent}</strong>
                                                            </span>
                                                            <span className="text-slate-400">
                                                                {f.date} {f.scoreline ? `(${f.scoreline})` : ""}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* TAB 4: DEMO DATA SEEDER */}
                                    {importTab === "demo" && (
                                        <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-sky-500/10 border border-emerald-500/30 space-y-3">
                                            <div className="flex items-center gap-2 text-emerald-300 font-bold text-sm">
                                                <Sparkles className="w-4 h-4" /> Test-Drive Mode: Seed Sample Club Data
                                            </div>
                                            <p className="text-xs text-slate-300 leading-relaxed">
                                                Don’t have your squad list handy right now? Load a sample 16-man squad, 4 fixtures,
                                                and a 6-team league table so you can immediately explore the Matchday XI pitch
                                                builder and stats hub.
                                            </p>
                                            <Button
                                                type="button"
                                                disabled={isSeedingDemo || demoSeeded}
                                                onClick={handleSeedDemoData}
                                                className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs"
                                            >
                                                {demoSeeded ? (
                                                    <>
                                                        <Check className="w-4 h-4 mr-1.5" /> Sample Squad, Fixtures & Table Loaded!
                                                    </>
                                                ) : isSeedingDemo ? (
                                                    <>
                                                        <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Loading Sample Data...
                                                    </>
                                                ) : (
                                                    "⚡ Load Sample Club Data (16 Players + 4 Fixtures)"
                                                )}
                                            </Button>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        )}

                        {/* STAGE 4: STAFF INVITES, PLAYER PORTAL LINK & CELEBRATORY LAUNCHPAD */}
                        {stage === 4 && (
                            <Card className="bg-slate-900/75 border-white/10 backdrop-blur-xl rounded-3xl overflow-hidden">
                                <CardContent className="p-5 sm:p-7 space-y-7">
                                    <div>
                                        <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[10px] mb-2">
                                            FINAL STAGE • STAFF ACCESS & LAUNCHPAD
                                        </Badge>
                                        <h2 className="text-2xl font-black text-white">
                                            Invite Your Backroom Staff & Kick Off
                                        </h2>
                                        <p className="text-xs sm:text-sm text-slate-400 mt-1">
                                            Generate instant <code className="text-emerald-300">/join</code> invite links to share on
                                            WhatsApp with your Assistant Manager, Coaches or Secretary.
                                        </p>
                                    </div>

                                    {/* Create Real Staff Invite Link */}
                                    <div className="p-4 rounded-2xl bg-slate-950/75 border border-white/10 space-y-3">
                                        <div className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                                            <UserPlus className="w-3.5 h-3.5 text-emerald-400" /> Generate Backroom Staff Invite Link
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                            <Input
                                                value={staffName}
                                                onChange={(e) => setStaffName(e.target.value)}
                                                placeholder="Staff Name (e.g. Kieran Ali)"
                                                className="h-9 text-xs bg-slate-900 border-white/15 text-white"
                                            />
                                            <Input
                                                value={staffEmail}
                                                onChange={(e) => setStaffEmail(e.target.value)}
                                                placeholder="Email (optional)"
                                                className="h-9 text-xs bg-slate-900 border-white/15 text-white"
                                            />
                                            <select
                                                value={staffRoleTitle}
                                                onChange={(e) => setStaffRoleTitle(e.target.value)}
                                                className="h-9 rounded-md bg-slate-900 border border-white/15 px-2.5 text-xs text-white"
                                            >
                                                <option value="Assistant Manager">Assistant Manager</option>
                                                <option value="First-Team Coach">First-Team Coach</option>
                                                <option value="Club Secretary">Club Secretary</option>
                                                <option value="Treasurer">Treasurer</option>
                                                <option value="Opposition Analyst">Opposition Analyst</option>
                                            </select>
                                            <div className="flex items-center gap-2">
                                                <select
                                                    value={staffAccessLevel}
                                                    onChange={(e) => setStaffAccessLevel(e.target.value as any)}
                                                    className="flex-1 h-9 rounded-md bg-slate-900 border border-white/15 px-2.5 text-xs text-white"
                                                >
                                                    <option value="coach">Coach Access (Pitch Tabs)</option>
                                                    <option value="admin">Full Club Admin</option>
                                                    <option value="viewer">Read-Only Viewer</option>
                                                </select>
                                                <Button
                                                    type="button"
                                                    disabled={isCreatingInvite || !staffName.trim()}
                                                    onClick={handleCreateStaffInvite}
                                                    className="h-9 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shrink-0"
                                                >
                                                    {isCreatingInvite ? (
                                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                    ) : (
                                                        "+ Create Link"
                                                    )}
                                                </Button>
                                            </div>
                                        </div>

                                        {generatedInvites.length > 0 && (
                                            <div className="space-y-2 pt-2">
                                                {generatedInvites.map((inv) => {
                                                    const waText = `Hey ${inv.name}! Join ${
                                                        clubName || "our club"
                                                    } on ClubFlow as ${inv.roleTitle}: ${inv.inviteUrl}`;
                                                    return (
                                                        <div
                                                            key={inv.id}
                                                            className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-900 border border-emerald-500/30"
                                                        >
                                                            <div>
                                                                <div className="text-xs font-bold text-white">
                                                                    {inv.name}{" "}
                                                                    <span className="text-emerald-400 font-normal">
                                                                        ({inv.roleTitle})
                                                                    </span>
                                                                </div>
                                                                <div className="text-[10px] text-slate-400 truncate max-w-xs">
                                                                    {inv.inviteUrl}
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-1.5">
                                                                <Button
                                                                    type="button"
                                                                    size="sm"
                                                                    variant="outline"
                                                                    onClick={() => copyToClipboard(inv.inviteUrl, inv.id)}
                                                                    className="h-7 text-[11px] border-white/15 bg-white/5 text-white"
                                                                >
                                                                    <Copy className="w-3 h-3 mr-1" />
                                                                    {copiedLinkKey === inv.id ? "Copied!" : "Copy Link"}
                                                                </Button>
                                                                <a
                                                                    href={`https://wa.me/?text=${encodeURIComponent(waText)}`}
                                                                    target="_blank"
                                                                    rel="noreferrer"
                                                                    className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 text-[11px] font-bold"
                                                                >
                                                                    <Share2 className="w-3 h-3" /> WhatsApp
                                                                </a>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>

                                    {/* Celebratory Summary Card */}
                                    <div
                                        className="p-5 rounded-2xl border border-white/15 space-y-4"
                                        style={{
                                            background: `linear-gradient(135deg, ${primaryColor}22 0%, rgba(15,23,42,0.9) 100%)`,
                                        }}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <div className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                                                    ✓ Club Hub Configured
                                                </div>
                                                <div className="text-xl font-black text-white">
                                                    {clubName || "Your Football Club"} is Matchday Ready
                                                </div>
                                            </div>
                                            {logoPreview && (
                                                <img
                                                    src={logoPreview}
                                                    alt="Badge"
                                                    className="w-12 h-12 object-contain rounded-xl bg-slate-950/60 p-1.5 border border-white/10"
                                                />
                                            )}
                                        </div>

                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center">
                                            <div className="p-2.5 rounded-xl bg-slate-950/70 border border-white/10">
                                                <div className="text-lg font-black text-white">{preferredFormation}</div>
                                                <div className="text-[10px] text-slate-400">Default System</div>
                                            </div>
                                            <div className="p-2.5 rounded-xl bg-slate-950/70 border border-white/10">
                                                <div className="text-lg font-black text-emerald-400">{importedPlayersCount}</div>
                                                <div className="text-[10px] text-slate-400">Players Added</div>
                                            </div>
                                            <div className="p-2.5 rounded-xl bg-slate-950/70 border border-white/10">
                                                <div className="text-lg font-black text-sky-400">{importedFixturesCount}</div>
                                                <div className="text-[10px] text-slate-400">Fixtures Scheduled</div>
                                            </div>
                                            <div className="p-2.5 rounded-xl bg-slate-950/70 border border-white/10">
                                                <div className="text-lg font-black text-amber-400">{generatedInvites.length}</div>
                                                <div className="text-[10px] text-slate-400">Staff Invites</div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2">
                                            <Button
                                                type="button"
                                                disabled={isCompleting}
                                                onClick={() => handleCompleteOnboarding("/dashboard")}
                                                className="h-11 bg-white hover:bg-slate-200 text-slate-950 font-black"
                                            >
                                                <LayoutDashboard className="w-4 h-4 mr-2" />
                                                Launch Dashboard
                                            </Button>
                                            <Button
                                                type="button"
                                                disabled={isCompleting}
                                                onClick={() => handleCompleteOnboarding("/matchday-xi")}
                                                variant="outline"
                                                className="h-11 border-white/20 bg-white/5 hover:bg-white/10 text-white font-bold"
                                            >
                                                <Shirt className="w-4 h-4 mr-2 text-emerald-400" />
                                                Open Matchday XI
                                            </Button>
                                            <Button
                                                type="button"
                                                disabled={isCompleting}
                                                onClick={() => handleCompleteOnboarding("/squad")}
                                                variant="outline"
                                                className="h-11 border-white/20 bg-white/5 hover:bg-white/10 text-white font-bold"
                                            >
                                                <Users className="w-4 h-4 mr-2 text-sky-400" />
                                                Go to Squad Hub
                                            </Button>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* Bottom Back / Continue Action Bar */}
                        <div className="flex items-center justify-between gap-3 pt-1">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={goPrevStage}
                                className="h-11 px-5 rounded-xl border-white/15 bg-slate-900/80 text-slate-200 hover:text-white"
                            >
                                <ArrowLeft className="w-4 h-4 mr-2" /> Back
                            </Button>

                            {stage < 4 ? (
                                <Button
                                    type="button"
                                    onClick={goNextStage}
                                    className="h-11 px-6 rounded-xl font-black text-white shadow-lg"
                                    style={{ backgroundColor: primaryColor }}
                                >
                                    Continue <ArrowRight className="w-4 h-4 ml-2" />
                                </Button>
                            ) : (
                                <Button
                                    type="button"
                                    disabled={isCompleting}
                                    onClick={() => handleCompleteOnboarding("/dashboard")}
                                    className="h-11 px-7 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black shadow-lg"
                                >
                                    {isCompleting ? (
                                        <>
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving Club...
                                        </>
                                    ) : (
                                        <>
                                            <Rocket className="w-4 h-4 mr-2" /> Complete Setup & Enter Club
                                        </>
                                    )}
                                </Button>
                            )}
                        </div>
                    </div>

                    {/* Right Column: Live Split-Screen Interactive Preview */}
                    <div
                        className={`lg:col-span-5 space-y-4 ${
                            showMobilePreview ? "block" : "hidden lg:block"
                        }`}
                    >
                        <div className="sticky top-28 bg-slate-900/80 border border-white/10 rounded-3xl p-5 backdrop-blur-xl shadow-2xl space-y-4">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                                    <Eye className="w-3.5 h-3.5 text-emerald-400" /> Live Matchday Preview
                                </span>
                                <div className="inline-flex rounded-xl bg-slate-950 p-1 border border-white/10">
                                    {[
                                        { id: "pitch", label: "Pitch & Kits" },
                                        { id: "dashboard", label: "Next Match" },
                                        { id: "whatsapp", label: "WhatsApp Poll" },
                                    ].map((t) => (
                                        <button
                                            key={t.id}
                                            type="button"
                                            onClick={() => setPreviewTab(t.id as any)}
                                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                                                previewTab === t.id
                                                    ? "bg-white text-slate-950"
                                                    : "text-slate-400 hover:text-white"
                                            }`}
                                        >
                                            {t.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* PREVIEW 1: INTERACTIVE PITCH & KIT BUILDER */}
                            {previewTab === "pitch" && (
                                <div className="space-y-3">
                                    <div className="relative rounded-2xl overflow-hidden border border-emerald-500/30 bg-gradient-to-b from-emerald-950 via-emerald-900/90 to-emerald-950 aspect-[4/5] p-4 shadow-inner">
                                        {/* Pitch Markings */}
                                        <div className="absolute inset-3 border border-white/20 rounded-xl pointer-events-none" />
                                        <div className="absolute left-3 right-3 top-1/2 border-t border-white/20 pointer-events-none" />
                                        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 rounded-full border border-white/20 pointer-events-none" />

                                        {/* Header Banner inside Pitch */}
                                        <div className="relative z-10 flex items-center justify-between bg-slate-950/80 backdrop-blur-md px-3 py-2 rounded-xl border border-white/15">
                                            <div className="flex items-center gap-2">
                                                {logoPreview ? (
                                                    <img
                                                        src={logoPreview}
                                                        alt="Crest"
                                                        className="w-6 h-6 object-contain"
                                                    />
                                                ) : (
                                                    <Shield className="w-5 h-5" style={{ color: primaryColor }} />
                                                )}
                                                <div>
                                                    <div className="text-xs font-black text-white leading-none">
                                                        {clubName || "Your Football Club"}
                                                    </div>
                                                    <div className="text-[10px] text-emerald-300 mt-0.5">
                                                        {activeFormation.label} •{" "}
                                                        {useMatchdayNumbering ? "1–11 Numbers" : "Squad Numbers"}
                                                    </div>
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setActiveKitPreview((k) => (k === "home" ? "away" : "home"))
                                                }
                                                className="px-2 py-0.5 rounded bg-white/10 text-[10px] font-bold text-white border border-white/15"
                                            >
                                                {activeKitPreview === "home" ? "Home Kit" : "Away Kit"}
                                            </button>
                                        </div>

                                        {/* 11 Formation Nodes */}
                                        {activeFormation.coords.map((node, i) => {
                                            const isGK = node.role === "GK";
                                            const shirtFill = isGK ? gkKitColor : activeShirt;
                                            const num = useMatchdayNumbering ? i + 1 : [1, 2, 5, 6, 3, 4, 8, 10, 11, 9, 7][i] || i + 1;
                                            return (
                                                <div
                                                    key={i}
                                                    className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center"
                                                    style={{ left: `${node.x}%`, top: `${node.y}%` }}
                                                >
                                                    <div
                                                        className="w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-black shadow-lg border-2 border-white/80 transition-colors"
                                                        style={{
                                                            backgroundColor: shirtFill,
                                                            color:
                                                                shirtFill.toLowerCase() === "#ffffff" ||
                                                                shirtFill.toLowerCase() === "#eab308"
                                                                    ? "#0f172a"
                                                                    : "#ffffff",
                                                        }}
                                                    >
                                                        {num}
                                                    </div>
                                                    <span className="mt-0.5 px-1.5 py-0.2 rounded bg-slate-950/85 text-[9px] font-bold text-white border border-white/10">
                                                        {node.role}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* Mini Kit Strip Legend */}
                                    <div className="grid grid-cols-3 gap-2 text-center">
                                        <div className="p-2 rounded-xl bg-slate-950/70 border border-white/10">
                                            <div className="flex justify-center gap-1 mb-1">
                                                <span
                                                    className="w-3.5 h-3.5 rounded-full border border-white/30"
                                                    style={{ backgroundColor: activeShirt }}
                                                />
                                                <span
                                                    className="w-3.5 h-3.5 rounded-full border border-white/30"
                                                    style={{ backgroundColor: activeShorts }}
                                                />
                                                <span
                                                    className="w-3.5 h-3.5 rounded-full border border-white/30"
                                                    style={{ backgroundColor: activeSocks }}
                                                />
                                            </div>
                                            <div className="text-[10px] font-bold text-slate-300">
                                                {activeKitPreview === "home" ? "Home Strip" : "Away Strip"}
                                            </div>
                                        </div>
                                        <div className="p-2 rounded-xl bg-slate-950/70 border border-white/10">
                                            <div className="flex justify-center mb-1">
                                                <span
                                                    className="w-3.5 h-3.5 rounded-full border border-white/30"
                                                    style={{ backgroundColor: gkKitColor }}
                                                />
                                            </div>
                                            <div className="text-[10px] font-bold text-slate-300">GK Jersey</div>
                                        </div>
                                        <div className="p-2 rounded-xl bg-slate-950/70 border border-white/10">
                                            <div className="text-xs font-black text-emerald-400">
                                                {defaultHomeKickOff}
                                            </div>
                                            <div className="text-[10px] font-bold text-slate-300">
                                                Meet {computedMeetTime}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* PREVIEW 2: LIVE DASHBOARD NEXT MATCH CARD */}
                            {previewTab === "dashboard" && (
                                <div className="space-y-3">
                                    <div
                                        className="p-5 rounded-2xl border border-white/15 space-y-4"
                                        style={{
                                            background: `linear-gradient(135deg, ${primaryColor}30 0%, rgba(9,13,22,0.95) 100%)`,
                                        }}
                                    >
                                        <div className="flex items-center justify-between">
                                            <Badge className="bg-white/10 text-white border-white/20 text-[10px]">
                                                {defaultCompetition || "Premier Division"}
                                            </Badge>
                                            <span className="text-xs font-bold text-emerald-400">
                                                KO {defaultHomeKickOff} (Meet {computedMeetTime})
                                            </span>
                                        </div>

                                        <div className="flex items-center justify-between gap-3 py-2">
                                            <div className="flex items-center gap-3">
                                                <div className="w-12 h-12 rounded-2xl bg-slate-950/80 border border-white/15 flex items-center justify-center overflow-hidden">
                                                    {logoPreview ? (
                                                        <img
                                                            src={logoPreview}
                                                            alt="Crest"
                                                            className="w-9 h-9 object-contain"
                                                        />
                                                    ) : (
                                                        <Shield
                                                            className="w-6 h-6"
                                                            style={{ color: primaryColor }}
                                                        />
                                                    )}
                                                </div>
                                                <div>
                                                    <div className="text-sm font-black text-white">
                                                        {clubName || "Your Football Club"}
                                                    </div>
                                                    <div className="text-[11px] text-slate-400">
                                                        {squads[0] || "First Team"} (Home)
                                                    </div>
                                                </div>
                                            </div>
                                            <span className="text-xs font-black text-slate-500">VS</span>
                                            <div className="text-right">
                                                <div className="text-sm font-black text-white">Opposition FC</div>
                                                <div className="text-[11px] text-slate-400">Saturday Fixture</div>
                                            </div>
                                        </div>

                                        <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[11px] text-slate-300">
                                            <span className="flex items-center gap-1">
                                                <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                                                {homeGround || "Home Ground"}
                                            </span>
                                            <span>{selectedTabs.length} Modules Enabled</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* PREVIEW 3: WHATSAPP POLL MESSAGE */}
                            {previewTab === "whatsapp" && (
                                <div className="space-y-3">
                                    <div className="p-4 rounded-2xl bg-[#0b141a] border border-emerald-500/30 space-y-2">
                                        <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                                            WhatsApp Group Availability Poll Preview
                                        </div>
                                        <div className="p-3 rounded-xl bg-[#005c4b] text-white text-xs whitespace-pre-line leading-relaxed shadow">
                                            {whatsappPollMessage}
                                            {"\n\n"}⚽ *{clubName || "Club"} vs Opposition FC*
                                            {"\n"}🏆 {defaultCompetition || "League"}
                                            {"\n"}📍 {homeGround || "Home Ground"}
                                            {"\n"}🕜 Meet: {computedMeetTime} | Kick-Off: {defaultHomeKickOff}
                                        </div>
                                        <textarea
                                            value={whatsappPollMessage}
                                            onChange={(e) => setWhatsappPollMessage(e.target.value)}
                                            rows={3}
                                            className="w-full rounded-xl bg-slate-950 border border-white/15 p-2.5 text-xs text-white"
                                            placeholder="Customize your WhatsApp poll header message..."
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </main>
            )}
        </div>
    );
}

export default function OnboardingPage() {
    return (
        <Suspense
            fallback={
                <div className="min-h-screen bg-[#070A10] text-white flex items-center justify-center">
                    <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
                </div>
            }
        >
            <OnboardingContent />
        </Suspense>
    );
}
