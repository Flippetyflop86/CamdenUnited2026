"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Papa from "papaparse";
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
    UserPlus,
    MapPin,
    Clock,
    Compass,
    Layers,
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
    CreditCard,
    Building2,
    Mail,
    Camera,
    Link2,
    X,
} from "lucide-react";

type WizardMode = "express" | "full";
type StageId = 0 | 1 | 2 | 3 | 4;

interface ParsedSquadDraft {
    squadNumber: number | null;
    firstName: string;
    lastName: string;
    position: string;
    email?: string;
    dateOfBirth?: string;
    age?: number | null;
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
        desc: "Focus on Squad, Matchday Planner, Training, Fixtures, Opposition & Recruitment",
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
        desc: "Pure pitch focus: Squad, Training, Matchday Planner, Matches, League & Opposition",
        tabs: ["squad", "training", "matches", "matchday-xi", "opposition", "league", "recruitment"],
    },
];

const COMPETITION_PRESETS = [
    { id: "step1_8", label: "Saturday Step 1–8", ko: "15:00", comp: "Premier Division", meetOffset: 75 },
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
            { x: 36, y: 16, role: "ST" },
            { x: 64, y: 16, role: "ST" },
        ],
    },
    "4-1-4-1": {
        label: "4-1-4-1 Balanced",
        coords: [
            { x: 50, y: 88, role: "GK" },
            { x: 18, y: 68, role: "LB" },
            { x: 38, y: 72, role: "CB" },
            { x: 62, y: 72, role: "CB" },
            { x: 82, y: 68, role: "RB" },
            { x: 50, y: 55, role: "CDM" },
            { x: 16, y: 36, role: "LM" },
            { x: 38, y: 38, role: "CM" },
            { x: 62, y: 38, role: "CM" },
            { x: 84, y: 36, role: "RM" },
            { x: 50, y: 15, role: "ST" },
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
            { x: 36, y: 16, role: "ST" },
            { x: 64, y: 16, role: "ST" },
        ],
    },
    "3-4-3": {
        label: "3-4-3 High Press",
        coords: [
            { x: 50, y: 88, role: "GK" },
            { x: 26, y: 72, role: "CB" },
            { x: 50, y: 74, role: "CB" },
            { x: 74, y: 72, role: "CB" },
            { x: 15, y: 46, role: "LWB" },
            { x: 38, y: 48, role: "CM" },
            { x: 62, y: 48, role: "CM" },
            { x: 85, y: 46, role: "RWB" },
            { x: 22, y: 20, role: "LW" },
            { x: 50, y: 15, role: "ST" },
            { x: 78, y: 20, role: "RW" },
        ],
    },
};

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

function getHexLuminance(hex: string): number {
    const clean = (hex || "").replace("#", "").trim();
    const full =
        clean.length === 3
            ? clean
                  .split("")
                  .map((c) => c + c)
                  .join("")
            : clean;
    if (full.length !== 6) return 0;
    const r = parseInt(full.slice(0, 2), 16);
    const g = parseInt(full.slice(2, 4), 16);
    const b = parseInt(full.slice(4, 6), 16);
    if (isNaN(r) || isNaN(g) || isNaN(b)) return 0;
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

function isLightHex(hex: string): boolean {
    return getHexLuminance(hex) > 0.65;
}

function isVeryLightHex(hex: string): boolean {
    return getHexLuminance(hex) > 0.84;
}

function calculateMeetTime(koTime: string, offsetMinutes: number): string {
    const parts = koTime.split(":").map(Number);
    if (parts.length !== 2 || isNaN(parts[0]) || isNaN(parts[1])) return "13:45";
    const totalMins = parts[0] * 60 + parts[1] - offsetMinutes;
    const clamped = ((totalMins % 1440) + 1440) % 1440;
    const hh = String(Math.floor(clamped / 60)).padStart(2, "0");
    const mm = String(clamped % 60).padStart(2, "0");
    return `${hh}:${mm}`;
}

function normalizePositionString(raw?: string): string {
    const up = (raw || "").trim().toUpperCase();
    if (!up) return "CM";
    if (up === "GK" || up.includes("GOALKEEPER") || up.includes("KEEPER")) return "GK";
    if (up === "RWB" || up.includes("RIGHT WING BACK") || up.includes("RIGHT WING-BACK")) return "RWB";
    if (up === "LWB" || up.includes("LEFT WING BACK") || up.includes("LEFT WING-BACK")) return "LWB";
    if (up === "RB" || up.includes("RIGHT BACK") || up.includes("RIGHT-BACK")) return "RB";
    if (up === "LB" || up.includes("LEFT BACK") || up.includes("LEFT-BACK")) return "LB";
    if (up === "CB" || up === "DEF" || up.includes("CENTRE BACK") || up.includes("CENTER BACK") || up.includes("DEFENDER")) return "CB";
    if (up === "CDM" || up === "DM" || up.includes("DEFENSIVE MID") || up.includes("HOLDING")) return "CDM";
    if (up === "CAM" || up === "AM" || up.includes("ATTACKING MID")) return "CAM";
    if (up === "RW" || up === "RM" || up.includes("RIGHT WING")) return "RW";
    if (up === "LW" || up === "LM" || up.includes("LEFT WING") || up === "WINGER") return "LW";
    if (up === "ST" || up === "CF" || up === "FWD" || up.includes("STRIKER") || up.includes("FORWARD")) return "ST";
    if (["CM", "MID", "MIDFIELDER"].includes(up) || up.includes("MID")) return "CM";
    return "CM";
}

function computeAgeFromDobStr(dobRaw?: string): { iso?: string; age?: number } {
    if (!dobRaw) return {};
    const trimmed = dobRaw.trim();
    let iso = "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
        iso = trimmed;
    } else {
        const ukMatch = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
        if (ukMatch) {
            const d = ukMatch[1].padStart(2, "0");
            const m = ukMatch[2].padStart(2, "0");
            const y = ukMatch[3].length === 2 ? (Number(ukMatch[3]) > 35 ? `19${ukMatch[3]}` : `20${ukMatch[3]}`) : ukMatch[3];
            iso = `${y}-${m}-${d}`;
        }
    }
    if (!iso) return {};
    const [y, m, d] = iso.split("-").map(Number);
    if (!y || !m || !d) return {};
    const today = new Date();
    let age = today.getFullYear() - y;
    const md = today.getMonth() + 1 - m;
    if (md < 0 || (md === 0 && today.getDate() < d)) age--;
    if (age < 4 || age > 99) return {};
    return { iso, age };
}

const NOISE_LINE_REGEX =
    /^(players?|squad|team\s*sheet|appearances|goals|assists|position|status|active|registered|search|filter|total|name|first\s*name|last\s*name|surname|no\.?|#|date\s*of\s*birth|dob|actions|edit|select|page\s+\d+|\d{1,2}:\d{2})$/i;

function parseSquadPasteText(raw: string): ParsedSquadDraft[] {
    if (!raw.trim()) return [];
    const lines = raw
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);

    const parsed: ParsedSquadDraft[] = [];
    const posRegex =
        /\b(GK|GOALKEEPER|CB|RB|LB|RWB|LWB|DEF|DEFENDER|CDM|CM|CAM|RM|LM|MID|MIDFIELDER|RW|LW|ST|CF|FWD|FORWARD|WINGER|STRIKER)\b/i;

    for (const line of lines) {
        let cleaned = line
            .replace(/^[•\-*✓✔☑️]+\s*/, "")
            .replace(/\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/g, "")
            .trim();
        if (!cleaned || NOISE_LINE_REGEX.test(cleaned)) continue;

        let squadNumber: number | null = null;
        const numMatch = cleaned.match(/^#?(\d{1,2})[\s.\-:)]+(.*)$/);
        if (numMatch) {
            squadNumber = parseInt(numMatch[1], 10);
            cleaned = numMatch[2].trim();
        }

        let position = "CM";
        const posMatch = cleaned.match(posRegex);
        if (posMatch) {
            position = normalizePositionString(posMatch[1]);
            cleaned = cleaned
                .replace(
                    /\(\s*(GK|GOALKEEPER|CB|RB|LB|RWB|LWB|DEF|DEFENDER|CDM|CM|CAM|RM|LM|MID|MIDFIELDER|RW|LW|ST|CF|FWD|FORWARD|WINGER|STRIKER)\s*\)/i,
                    ""
                )
                .replace(
                    /[-–—|,:]\s*(GK|GOALKEEPER|CB|RB|LB|RWB|LWB|DEF|DEFENDER|CDM|CM|CAM|RM|LM|MID|MIDFIELDER|RW|LW|ST|CF|FWD|FORWARD|WINGER|STRIKER)\b/i,
                    ""
                )
                .replace(posRegex, "")
                .trim();
        }

        // Clean trailing stat numbers or punctuation from OCR / table copy
        cleaned = cleaned
            .replace(/\s+\d+(\s+\d+)*$/, "")
            .replace(/[-–—|,:()]+$/g, "")
            .replace(/\s+/g, " ")
            .trim();

        if (!cleaned || cleaned.length < 2 || NOISE_LINE_REGEX.test(cleaned)) continue;
        if (!/[a-zA-Z]{2,}/.test(cleaned)) continue;

        // Support "Surname, Firstname" format from FA Full-Time / Mitoo exports
        let firstName = "";
        let lastName = "";
        if (cleaned.includes(",")) {
            const [left, right] = cleaned.split(",").map((s) => s.trim());
            if (left && right) {
                firstName = right;
                lastName = left;
            }
        }
        if (!firstName) {
            const nameParts = cleaned.split(/\s+/);
            firstName = nameParts[0] || "Player";
            lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : "";
        }

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

async function runBrowserOcrFallback(file: File): Promise<string> {
    if (typeof window === "undefined") return "";
    const w = window as any;
    if (!w.Tesseract) {
        await new Promise<void>((resolve, reject) => {
            const existing = document.querySelector('script[data-tesseract="1"]') as HTMLScriptElement | null;
            if (existing) {
                if (w.Tesseract) return resolve();
                existing.addEventListener("load", () => resolve());
                existing.addEventListener("error", () => reject(new Error("Could not load image scanner")));
                return;
            }
            const script = document.createElement("script");
            script.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
            script.async = true;
            script.dataset.tesseract = "1";
            script.onload = () => resolve();
            script.onerror = () => reject(new Error("Could not load image scanner"));
            document.head.appendChild(script);
        });
    }
    const result = await w.Tesseract.recognize(file, "eng");
    return result?.data?.text || "";
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
    const [competitionPreset, setCompetitionPreset] = useState("step1_8");
    const [preferredFormation, setPreferredFormation] = useState<string>("4-3-3");
    const [useMatchdayNumbering, setUseMatchdayNumbering] = useState<boolean>(
        isRerun ? (settings.useMatchdayNumbering ?? true) : true
    );
    const [homeGround, setHomeGround] = useState(settings.homeGround || "");
    const [trainingLocation, setTrainingLocation] = useState(settings.trainingLocation || "");
    const [defaultHomeKickOff, setDefaultHomeKickOff] = useState(settings.defaultHomeKickOff || "15:00");
    const [defaultCompetition, setDefaultCompetition] = useState(settings.defaultCompetition || "Premier Division");
    const [meetOffsetMins, setMeetOffsetMins] = useState<number>(75);
    const [squads, setSquads] = useState<string[]>(
        isRerun && settings.squads?.length ? settings.squads : ["First Team"]
    );
    const [enabledMatchFormats, setEnabledMatchFormats] = useState<("5v5" | "7v7" | "9v9" | "11v11")[]>(
        isRerun && settings.enabledMatchFormats?.length ? settings.enabledMatchFormats : ["11v11"]
    );
    const [equalPlayTimeEnabled, setEqualPlayTimeEnabled] = useState<boolean>(
        isRerun ? (settings.equalPlayTimeEnabled ?? false) : false
    );
    const [defaultMatchDuration, setDefaultMatchDuration] = useState<number>(
        isRerun ? (settings.defaultMatchDuration ?? 90) : 90
    );
    const [customSquadInput, setCustomSquadInput] = useState("");
    const [whatsappPollMessage, setWhatsappPollMessage] = useState(
        settings.whatsappPollMessage ||
            "📋 *MATCHDAY AVAILABILITY POLL*\nPlease vote on the poll below for this week's fixture so the gaffer can finalise the squad!"
    );

    // Finance Model & ClubFlow Pay Setup
    const [financeModel, setFinanceModel] = useState<"per_game" | "monthly" | "both" | "skip">(
        isRerun && settings.subsEnabled === false ? "skip" : "per_game"
    );
    const [matchSubAmount, setMatchSubAmount] = useState(5);
    const [monthlySubs, setMonthlySubs] = useState(settings.monthlySubs ?? 25);
    const [registrationFee, setRegistrationFee] = useState(settings.registrationFee ?? 30);
    const [trainingFeePerSession, setTrainingFeePerSession] = useState(settings.trainingFeePerSession ?? 4);
    const [includeSocialPot, setIncludeSocialPot] = useState(true);
    const [onboardingFeeCoverage, setOnboardingFeeCoverage] = useState<"player" | "club">("player");
    const [bankHandler, setBankHandler] = useState<"self" | "treasurer">("self");
    const [onboardingAccountHolderType, setOnboardingAccountHolderType] = useState<
        "individual" | "non_profit" | "company"
    >("individual");
    const [treasurerInviteName, setTreasurerInviteName] = useState("");
    const [treasurerInviteEmail, setTreasurerInviteEmail] = useState("");
    const [contractsEnabled] = useState(settings.contractsEnabled ?? false);
    const [finesEnabled] = useState(settings.finesEnabled ?? true);
    const [fineCategories] = useState<{ id: string; name: string; amount: number }[]>(
        (settings.fineCategories || []).map((f: any, idx: number) => ({
            id: f.id || `fine-init-${idx}`,
            name: f.name,
            amount: f.amount,
        }))
    );

    // Stage 3: Squad, CSV, Photo Scanner, Player Link & League Imports
    const [importTab, setImportTab] = useState<"squad" | "table" | "fixtures" | "demo">("squad");
    const [rawSquadPaste, setRawSquadPaste] = useState("");
    const [extraStagedPlayers, setExtraStagedPlayers] = useState<ParsedSquadDraft[]>([]);
    const [importedPlayersCount, setImportedPlayersCount] = useState(0);
    const [isImportingSquad, setIsImportingSquad] = useState(false);
    const [isScanningImage, setIsScanningImage] = useState(false);
    const [squadImportNotice, setSquadImportNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);
    const [mintingPlayerLink, setMintingPlayerLink] = useState(false);
    const [copiedPlayerLink, setCopiedPlayerLink] = useState(false);

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
    const csvSquadInputRef = useRef<HTMLInputElement>(null);
    const squadPhotoInputRef = useRef<HTMLInputElement>(null);

    const brandIsLight = isLightHex(primaryColor);
    const brandIsVeryLight = isVeryLightHex(primaryColor);
    const brandTextColor = brandIsLight ? "#0f172a" : "#ffffff";
    const safeBrandAccent = brandIsVeryLight ? "#0f172a" : primaryColor;
    const brandButtonStyle: React.CSSProperties = {
        backgroundColor: primaryColor,
        color: brandTextColor,
        border: brandIsLight ? "1px solid #94a3b8" : "1px solid transparent",
    };

    useEffect(() => {
        if (settings.isOnboarded && !isRerun && stage === 0) {
            router.replace("/dashboard");
        }
    }, [settings.isOnboarded, isRerun, stage, router]);

    useEffect(() => {
        if (settings.name && settings.name !== "My Club" && !clubName) {
            setClubName(settings.name);
        }
        if (settings.logo && !logoPreview) {
            setLogoPreview(settings.logo);
        }
    }, [settings.name, settings.logo]);

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
                    const brightness = (r + g + b) / 3;
                    if (brightness < 18) continue;

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
                }
            } catch {}
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

    // Combined squad drafts from text paste + CSV / Photo imports
    const textSquadDrafts = parseSquadPasteText(rawSquadPaste);
    const parsedSquadDrafts = [...extraStagedPlayers, ...textSquadDrafts];

    // CSV Squad Upload Handler
    const handleSquadCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setSquadImportNotice(null);

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                const rows = (results.data || []) as Record<string, any>[];
                const parsedCsvPlayers: ParsedSquadDraft[] = [];

                for (const rawRow of rows) {
                    const lowerMap: Record<string, string> = {};
                    Object.entries(rawRow || {}).forEach(([k, v]) => {
                        if (k && v !== undefined && v !== null) {
                            lowerMap[k.trim().toLowerCase().replace(/[\s_-]+/g, "")] = String(v).trim();
                        }
                    });

                    const fullName =
                        lowerMap["fullname"] ||
                        lowerMap["playername"] ||
                        lowerMap["player"] ||
                        lowerMap["name"] ||
                        "";
                    let firstName = lowerMap["firstname"] || lowerMap["forename"] || "";
                    let lastName = lowerMap["lastname"] || lowerMap["surname"] || lowerMap["familyname"] || "";

                    if (!firstName && fullName) {
                        if (fullName.includes(",")) {
                            const [s, f] = fullName.split(",").map((x) => x.trim());
                            firstName = f || s;
                            lastName = f ? s : "";
                        } else {
                            const parts = fullName.split(/\s+/);
                            firstName = parts[0] || "";
                            lastName = parts.slice(1).join(" ");
                        }
                    } else if (firstName && !lastName && firstName.includes(" ")) {
                        const parts = firstName.split(/\s+/);
                        firstName = parts[0] || "";
                        lastName = parts.slice(1).join(" ");
                    }

                    if (!firstName && !lastName) continue;

                    const posRaw =
                        lowerMap["position"] ||
                        lowerMap["pos"] ||
                        lowerMap["role"] ||
                        lowerMap["primaryposition"] ||
                        "CM";
                    const numRaw =
                        lowerMap["squadnumber"] ||
                        lowerMap["number"] ||
                        lowerMap["shirt"] ||
                        lowerMap["shirtnumber"] ||
                        lowerMap["no"] ||
                        "";
                    const parsedNum = parseInt(numRaw, 10);
                    const emailRaw = lowerMap["email"] || lowerMap["emailaddress"] || "";
                    const dobRaw = lowerMap["dateofbirth"] || lowerMap["dob"] || lowerMap["birthdate"] || "";
                    const { iso: dobIso, age } = computeAgeFromDobStr(dobRaw);

                    parsedCsvPlayers.push({
                        squadNumber: !isNaN(parsedNum) && parsedNum > 0 ? parsedNum : null,
                        firstName: firstName || "Player",
                        lastName: lastName || "—",
                        position: normalizePositionString(posRaw),
                        email: emailRaw || undefined,
                        dateOfBirth: dobIso,
                        age: age ?? null,
                    });
                }

                if (parsedCsvPlayers.length === 0) {
                    setSquadImportNotice({
                        type: "error",
                        text: "No player rows found in that CSV. Include columns like Name (or First Name & Surname) and Position.",
                    });
                } else {
                    setExtraStagedPlayers((prev) => [...prev, ...parsedCsvPlayers]);
                    setSquadImportNotice({
                        type: "success",
                        text: `Loaded ${parsedCsvPlayers.length} players from CSV — review below and click Import.`,
                    });
                }
                e.target.value = "";
            },
            error: () => {
                setSquadImportNotice({ type: "error", text: "Could not read CSV file." });
                e.target.value = "";
            },
        });
    };

    // AI / OCR Photo or Screenshot Squad List Scanner
    const processSquadImageFile = async (file: File) => {
        if (!file.type.startsWith("image/")) return;
        setIsScanningImage(true);
        setSquadImportNotice(null);
        try {
            let extractedText = "";
            const fd = new FormData();
            fd.append("image", file);
            const res = await fetch("/api/parse-squad-image", {
                method: "POST",
                body: fd,
            }).catch(() => null);

            if (res && res.ok) {
                const data = await res.json().catch(() => ({}));
                if (data?.available && data?.text) {
                    extractedText = String(data.text);
                }
            }

            if (!extractedText) {
                extractedText = await runBrowserOcrFallback(file);
            }

            const extractedDrafts = parseSquadPasteText(extractedText);
            if (extractedDrafts.length === 0) {
                if (extractedText.trim()) {
                    setRawSquadPaste((prev) => (prev ? `${prev}\n${extractedText.trim()}` : extractedText.trim()));
                }
                setSquadImportNotice({
                    type: "error",
                    text: "Couldn't clearly detect player names from that image — try cropping closer to the player names column.",
                });
            } else {
                const formattedLines = extractedDrafts
                    .map(
                        (p) =>
                            `${p.squadNumber ? `${p.squadNumber}. ` : ""}${p.firstName}${
                                p.lastName && p.lastName !== "—" ? ` ${p.lastName}` : ""
                            } (${p.position})`
                    )
                    .join("\n");
                setRawSquadPaste((prev) => (prev ? `${prev}\n${formattedLines}` : formattedLines));
                setSquadImportNotice({
                    type: "success",
                    text: `Extracted ${extractedDrafts.length} players from your squad image! Edit any line below or click Import.`,
                });
            }
        } catch (err: any) {
            setSquadImportNotice({
                type: "error",
                text: err?.message || "Could not scan squad image.",
            });
        } finally {
            setIsScanningImage(false);
        }
    };

    const handleSquadPhotoInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            processSquadImageFile(file);
        }
        e.target.value = "";
    };

    const handleSquadPasteEvent = (e: React.ClipboardEvent) => {
        const items = e.clipboardData?.items;
        if (!items) return;
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (item.type.startsWith("image/")) {
                const file = item.getAsFile();
                if (file) {
                    e.preventDefault();
                    processSquadImageFile(file);
                    return;
                }
            }
        }
    };

    // Generate a 1-time individual player registration link right during Stage 3
    const handleCopyOneTimePlayerLink = async () => {
        if (!clubId || typeof window === "undefined" || mintingPlayerLink) return;
        setMintingPlayerLink(true);
        setSquadImportNotice(null);
        try {
            // Ensure current club name, badge & primary color are saved on the club row so the link shows the right crest/name
            if (clubName.trim()) {
                await supabase
                    .from("clubs")
                    .update({
                        name: clubName.trim(),
                        logo: logoPreview,
                        primary_color: primaryColor,
                        squads: squads.length > 0 ? squads : ["First Team"],
                    })
                    .eq("id", clubId);
            }

            const buildMsg = async (): Promise<string> => {
                const {
                    data: { session },
                } = await supabase.auth.getSession();
                const accessToken = session?.access_token;
                if (!accessToken) throw new Error("Session expired — please sign in again.");

                const res = await fetch(`/api/public/squad-onboarding/${encodeURIComponent(clubId)}`, {
                    method: "PUT",
                    headers: { Authorization: `Bearer ${accessToken}` },
                });
                const data = await res.json().catch(() => ({}));
                if (!res.ok || !data?.token) {
                    throw new Error(data?.error || "Could not generate 1-time player link.");
                }
                const targetSquad = squads[0] || "First Team";
                const params = new URLSearchParams({ token: data.token, squad: targetSquad });
                const url = `${window.location.origin}/squad-onboarding/${clubId}?${params.toString()}`;
                const displayClub = clubName.trim() || settings.name || "Club";
                return `📋 *${displayClub} — 1-Time Player Registration*\nWelcome aboard! Tap your unique link below to enter your position, DOB & contact details (valid for 1 submission):\n${url}`;
            };

            if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
                const p = buildMsg();
                await navigator.clipboard.write([
                    new ClipboardItem({
                        "text/plain": p.then((t) => new Blob([t], { type: "text/plain" })),
                    }),
                ]);
                await p;
            } else {
                const msg = await buildMsg();
                await navigator.clipboard.writeText(msg);
            }

            setCopiedPlayerLink(true);
            setSquadImportNotice({
                type: "success",
                text: "Copied 1-time player link! Send it to a player on WhatsApp (click again anytime for another player, or from Squad -> New Player Link).",
            });
            setTimeout(() => setCopiedPlayerLink(false), 3500);
        } catch (err: any) {
            setSquadImportNotice({
                type: "error",
                text: err?.message || "Could not copy player link.",
            });
        } finally {
            setMintingPlayerLink(false);
        }
    };

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
                ...(p.email ? { email: p.email } : {}),
                ...(p.dateOfBirth ? { date_of_birth: p.dateOfBirth } : {}),
                ...(p.age ? { age: p.age } : {}),
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
            setExtraStagedPlayers([]);
            setSquadImportNotice({
                type: "success",
                text: `Imported ${rowsToInsert.length} players into ${defaultSquadName}!`,
            });
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
            const ourNameLower = (clubName || settings.name || "").toLowerCase().trim();
            const normalizedStandings = parsedStandingsRows.map((r) => {
                const isOurs =
                    Boolean(ourNameLower) &&
                    (r.team.toLowerCase().includes(ourNameLower) || ourNameLower.includes(r.team.toLowerCase()));
                return {
                    position: r.pos,
                    pos: r.pos,
                    team_name: r.team,
                    team: r.team,
                    played: r.played,
                    won: r.won,
                    drawn: r.drawn,
                    lost: r.lost,
                    goals_for: r.gf,
                    gf: r.gf,
                    goals_against: r.ga,
                    ga: r.ga,
                    goal_difference: r.gd,
                    gd: r.gd,
                    points: r.pts,
                    pts: r.pts,
                    is_our_club: isOurs,
                };
            });

            const nowIso = new Date().toISOString();
            const storageKey = `clubflow_league_table_${clubId}`;
            localStorage.setItem(storageKey, JSON.stringify(normalizedStandings));
            localStorage.setItem(`${storageKey}_synced_at`, nowIso);

            const ourRow = normalizedStandings.find((r) => r.is_our_club);

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

            const tablePayload = JSON.stringify({
                teams: normalizedStandings,
                updatedAt: nowIso,
            });
            const { data: existingCache } = await supabase
                .from("documents")
                .select("id")
                .eq("club_id", clubId)
                .eq("category", "LEAGUE_TABLE_CACHE")
                .maybeSingle();

            if (existingCache?.id) {
                await supabase
                    .from("documents")
                    .update({ url: tablePayload, name: "League Standings Cache" })
                    .eq("id", existingCache.id);
            } else {
                await supabase.from("documents").insert({
                    club_id: clubId,
                    name: "League Standings Cache",
                    type: "JSON",
                    category: "LEAGUE_TABLE_CACHE",
                    url: tablePayload,
                });
            }

            await updateSettings({
                leaguePosition: ourRow ? ourRow.position : settings.leaguePosition,
                lastImportHistory: {
                    ...settings.lastImportHistory,
                    leagueTable: normalizedStandings,
                    updatedAt: nowIso,
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

    const handleParseFixturesPaste = async () => {
        if (!rawFixturesPaste.trim()) return;
        setIsParsingFixtures(true);
        try {
            const res = await fetch("/api/parse-schedule", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    rawText: rawFixturesPaste,
                    clubName: clubName || settings.name || "Our Club FC",
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
            const rows = parsedFixturesPreview.map((f: any) => {
                const isHome = (f.homeAway || "Home").toLowerCase() !== "away";
                const venueStr = f.venue || (isHome ? homeGround || "Home Ground" : "Away Venue");
                const rawRes = (f.result || "Pending").toUpperCase();
                const normResult =
                    rawRes === "W" || rawRes === "WIN"
                        ? "Win"
                        : rawRes === "D" || rawRes === "DRAW"
                          ? "Draw"
                          : rawRes === "L" || rawRes === "LOSS"
                            ? "Loss"
                            : "Pending";
                return {
                    club_id: clubId,
                    opponent: f.opponent,
                    date: f.date,
                    time: f.kickOff || defaultHomeKickOff || "15:00",
                    is_home: isHome,
                    competition: f.competition || defaultCompetition || "League",
                    result: normResult,
                    scoreline: f.scoreline || null,
                    notes: `[Location: ${venueStr}]\n[Surface: 4G]`,
                };
            });

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

    const handleSeedDemoData = async () => {
        if (!clubId || demoSeeded) return;
        setIsSeedingDemo(true);
        try {
            const defaultSquad = squads[0] || "First Team";
            const samplePlayers = [
                { first_name: "Callum", last_name: "Mercer", position: "GK", squad_number: 1 },
                { first_name: "Liam", last_name: "Sterling", position: "RB", squad_number: 2 },
                { first_name: "Theo", last_name: "Kavanagh", position: "LB", squad_number: 3 },
                { first_name: "Marcus", last_name: "Vance", position: "CB", squad_number: 4 },
                { first_name: "Devon", last_name: "Richards", position: "CB", squad_number: 5 },
                { first_name: "Harrison", last_name: "Cole", position: "CDM", squad_number: 6 },
                { first_name: "Jayden", last_name: "Okafor", position: "RW", squad_number: 7 },
                { first_name: "Finley", last_name: "Maddox", position: "CM", squad_number: 8 },
                { first_name: "Nathan", last_name: "Cross", position: "ST", squad_number: 9 },
                { first_name: "Zac", last_name: "Bellinger", position: "CAM", squad_number: 10 },
                { first_name: "Kian", last_name: "Mensah", position: "LW", squad_number: 11 },
                { first_name: "Rory", last_name: "Gallagher-Reid", position: "CB", squad_number: 12 },
                { first_name: "Elliot", last_name: "Thorne", position: "CM", squad_number: 14 },
                { first_name: "Toby", last_name: "Ashford", position: "RW", squad_number: 17 },
                { first_name: "Dante", last_name: "Sinclair", position: "ST", squad_number: 19 },
                { first_name: "Sam", last_name: "Hargreaves", position: "GK", squad_number: 22 },
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

            const { error: pErr } = await supabase.from("players").insert(samplePlayers);
            if (pErr) throw pErr;

            const today = new Date();
            const offsetDate = (days: number) => {
                const d = new Date(today);
                d.setDate(d.getDate() + days);
                return d.toISOString().split("T")[0];
            };

            const homeVenue = homeGround || "Home Ground";
            const sampleMatches = [
                {
                    club_id: clubId,
                    opponent: "Highgate Albion FC",
                    date: offsetDate(-14),
                    time: defaultHomeKickOff || "15:00",
                    is_home: true,
                    competition: defaultCompetition || "League",
                    result: "Win",
                    scoreline: "3-1",
                    goalscorers: "Nathan Cross (2), Jayden Okafor",
                    assists: "Zac Bellinger (2), Liam Sterling",
                    notes: `[Location: ${homeVenue}]\n[Surface: 4G]\n[MOTM: Nathan Cross]`,
                },
                {
                    club_id: clubId,
                    opponent: "Islington Borough",
                    date: offsetDate(-7),
                    time: defaultHomeKickOff || "15:00",
                    is_home: false,
                    competition: defaultCompetition || "League",
                    result: "Draw",
                    scoreline: "2-2",
                    goalscorers: "Kian Mensah, Harrison Cole",
                    assists: "Finley Maddox",
                    notes: `[Location: Market Road Pitches]\n[Surface: 4G]\n[MOTM: Harrison Cole]`,
                },
                {
                    club_id: clubId,
                    opponent: "Hackney Wick Athletic",
                    date: offsetDate(4),
                    time: defaultHomeKickOff || "15:00",
                    is_home: true,
                    competition: defaultCompetition || "League",
                    result: "Pending",
                    scoreline: null,
                    notes: `[Location: ${homeVenue}]\n[Surface: 4G]`,
                },
                {
                    club_id: clubId,
                    opponent: "Finsbury Park Rovers",
                    date: offsetDate(11),
                    time: defaultHomeKickOff || "15:00",
                    is_home: false,
                    competition: defaultCompetition || "League",
                    result: "Pending",
                    scoreline: null,
                    notes: `[Location: Downhills Park]\n[Surface: Grass]`,
                },
            ];

            const { error: mErr } = await supabase.from("matches").insert(sampleMatches);
            if (mErr) throw mErr;

            const ourTeamName = clubName || settings.name || "Our Club FC";
            const sampleTable = [
                { position: 1, pos: 1, team_name: "Hackney Wick Athletic", team: "Hackney Wick Athletic", played: 10, won: 8, drawn: 1, lost: 1, goals_for: 26, gf: 26, goals_against: 9, ga: 9, goal_difference: 17, gd: 17, points: 25, pts: 25, is_our_club: false },
                { position: 2, pos: 2, team_name: ourTeamName, team: ourTeamName, played: 10, won: 7, drawn: 2, lost: 1, goals_for: 24, gf: 24, goals_against: 11, ga: 11, goal_difference: 13, gd: 13, points: 23, pts: 23, is_our_club: true },
                { position: 3, pos: 3, team_name: "Islington Borough", team: "Islington Borough", played: 10, won: 6, drawn: 3, lost: 1, goals_for: 19, gf: 19, goals_against: 10, ga: 10, goal_difference: 9, gd: 9, points: 21, pts: 21, is_our_club: false },
                { position: 4, pos: 4, team_name: "Highgate Albion FC", team: "Highgate Albion FC", played: 10, won: 5, drawn: 2, lost: 3, goals_for: 17, gf: 17, goals_against: 14, ga: 14, goal_difference: 3, gd: 3, points: 17, pts: 17, is_our_club: false },
                { position: 5, pos: 5, team_name: "Finsbury Park Rovers", team: "Finsbury Park Rovers", played: 10, won: 4, drawn: 2, lost: 4, goals_for: 15, gf: 15, goals_against: 16, ga: 16, goal_difference: -1, gd: -1, points: 14, pts: 14, is_our_club: false },
                { position: 6, pos: 6, team_name: "Hampstead Town", team: "Hampstead Town", played: 10, won: 2, drawn: 1, lost: 7, goals_for: 10, gf: 10, goals_against: 22, ga: 22, goal_difference: -12, gd: -12, points: 7, pts: 7, is_our_club: false },
            ];
            const nowIso = new Date().toISOString();
            localStorage.setItem(`clubflow_league_table_${clubId}`, JSON.stringify(sampleTable));
            localStorage.setItem(`clubflow_league_table_${clubId}_synced_at`, nowIso);

            await supabase.from("documents").insert({
                club_id: clubId,
                name: "League Standings Cache",
                type: "JSON",
                category: "LEAGUE_TABLE_CACHE",
                url: JSON.stringify({ teams: sampleTable, updatedAt: nowIso }),
            });

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

    const handleCreateStaffInvite = async () => {
        if (!staffName.trim() || !clubId) return;
        setIsCreatingInvite(true);
        try {
            const token = crypto.randomUUID();
            const origin = typeof window !== "undefined" ? window.location.origin : "https://www.clubflow.org.uk";
            const inviteUrl = `${origin}/join?token=${token}`;

            const permsForRole =
                staffAccessLevel === "admin"
                    ? ALL_PAGE_PERMISSIONS.map((p) => p.key)
                    : staffAccessLevel === "coach"
                      ? ["squad", "training", "matches", "matchday-xi", "opposition", "league", "recruitment"]
                      : ["squad", "matches", "league"];

            const cleanInviteEmail = (
                staffEmail.trim() || `${staffName.toLowerCase().replace(/\s+/g, ".")}@club.local`
            ).toLowerCase();

            await supabase.from("club_invitations").insert({
                club_id: clubId,
                email: cleanInviteEmail,
                display_name: staffName.trim(),
                role: staffAccessLevel === "admin" ? "manager" : "staff",
                token,
                page_permissions: permsForRole,
            });

            await supabase.from("staff").insert({
                club_id: clubId,
                name: staffName.trim(),
                email: staffEmail.trim() || null,
                role: staffRoleTitle,
                notes: `Access Level: ${
                    staffAccessLevel === "admin"
                        ? "Full Admin"
                        : staffAccessLevel === "coach"
                          ? "Coach View"
                          : "View Only"
                }`,
            });

            if (staffEmail.trim()) {
                supabase.auth.getSession().then(({ data: { session } }) => {
                    if (!session?.access_token) return;
                    fetch("/api/staff/invite", {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            Authorization: `Bearer ${session.access_token}`,
                        },
                        body: JSON.stringify({
                            clubId,
                            email: staffEmail.trim().toLowerCase(),
                            displayName: staffName.trim(),
                            role: staffRoleTitle,
                            inviteUrl,
                        }),
                    }).catch(() => {});
                });
            }

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

    const handleCompleteOnboarding = async (destination: string = "/dashboard") => {
        setIsCompleting(true);
        try {
            const finalPermissions = Array.from(new Set([...selectedTabs, "admin"]));

            if (user && managerName.trim()) {
                await supabase.auth.updateUser({
                    data: { name: managerName.trim(), full_name: managerName.trim() },
                });
                if (clubId) {
                    await supabase
                        .from("club_members")
                        .update({ display_name: managerName.trim() })
                        .eq("club_id", clubId)
                        .eq("user_id", user.id);
                }
            }

            if (typeof window !== "undefined" && clubId) {
                localStorage.setItem(`clubflow_gk_kit_${clubId}`, gkKitColor);
                localStorage.setItem(`clubflow_default_formation_${clubId}`, preferredFormation);
                localStorage.setItem(`clubflow_meet_offset_${clubId}`, String(meetOffsetMins));
            }

            const effectiveClubName = clubName.trim() || "My Football Club";
            const subsEnabledVal = financeModel !== "skip";
            const hasMonthly = financeModel === "monthly" || financeModel === "both";
            const hasPerGame = financeModel === "per_game" || financeModel === "both";
            const effectiveMonthlySubs = subsEnabledVal && hasMonthly ? Number(monthlySubs) || 0 : 0;
            const effectiveRegFee = subsEnabledVal ? Number(registrationFee) || 0 : 0;
            const effectiveMatchSub = subsEnabledVal && hasPerGame ? Number(matchSubAmount) || 5 : 5;
            const effectiveTrainingFee = subsEnabledVal ? Number(trainingFeePerSession) || 0 : 0;

            await updateSettings(
                {
                    name: effectiveClubName,
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
                    enabledMatchFormats: enabledMatchFormats.length > 0 ? enabledMatchFormats : ["11v11"],
                    equalPlayTimeEnabled,
                    defaultMatchDuration: Number(defaultMatchDuration) || 90,
                    squads: squads.length > 0 ? squads : ["First Team"],
                    whatsappPollMessage,
                    subsEnabled: subsEnabledVal,
                    monthlySubs: effectiveMonthlySubs,
                    registrationFee: effectiveRegFee,
                    trainingFeePerSession: effectiveTrainingFee,
                    contractsEnabled: subsEnabledVal ? contractsEnabled : false,
                    finesEnabled,
                    fineCategories,
                    isOnboarded: true,
                },
                finalPermissions
            );

            if (clubId) {
                const subPresetRules: {
                    id: string;
                    title: string;
                    category: "Subs & Fees" | "Discipline" | "Punctuality" | "Kit & Gear" | "Matchday" | "Custom";
                    amount: number;
                    emoji: string;
                }[] = [];

                if (subsEnabledVal) {
                    if (hasPerGame && effectiveMatchSub > 0) {
                        subPresetRules.push({
                            id: "sub-match",
                            title: "Saturday Match Sub",
                            category: "Subs & Fees",
                            amount: effectiveMatchSub,
                            emoji: "⚽",
                        });
                    }
                    if (hasMonthly && effectiveMonthlySubs > 0) {
                        subPresetRules.push({
                            id: "sub-monthly",
                            title: "Monthly Player Subs",
                            category: "Subs & Fees",
                            amount: effectiveMonthlySubs,
                            emoji: "📅",
                        });
                    }
                    if (effectiveTrainingFee > 0) {
                        subPresetRules.push({
                            id: "sub-training",
                            title: "Training Session Sub",
                            category: "Subs & Fees",
                            amount: effectiveTrainingFee,
                            emoji: "🏃",
                        });
                    }
                    if (effectiveRegFee > 0) {
                        subPresetRules.push({
                            id: "sub-signing",
                            title: "Annual Signing-On Fee",
                            category: "Subs & Fees",
                            amount: effectiveRegFee,
                            emoji: "✍️",
                        });
                    }
                }

                const fallbackPresets = [
                    ...(subPresetRules.length === 0
                        ? [
                              {
                                  id: "sub-match",
                                  title: "Saturday Match Sub",
                                  category: "Subs & Fees" as const,
                                  amount: 5,
                                  emoji: "⚽",
                              },
                              {
                                  id: "sub-monthly",
                                  title: "Monthly Player Subs",
                                  category: "Subs & Fees" as const,
                                  amount: 25,
                                  emoji: "📅",
                              },
                          ]
                        : []),
                    {
                        id: "sub-kit",
                        title: "Club Social / Kit Contribution",
                        category: "Subs & Fees" as const,
                        amount: 15,
                        emoji: "👕",
                    },
                    {
                        id: "disc-yc-dissent",
                        title: "Yellow Card (Dissent)",
                        category: "Discipline" as const,
                        amount: 10,
                        emoji: "🟨",
                    },
                    {
                        id: "punc-late-md",
                        title: "Late to Matchday Meet",
                        category: "Punctuality" as const,
                        amount: 5,
                        emoji: "⏰",
                    },
                ];

                const finalRules = [...subPresetRules, ...fallbackPresets];
                const managerParts = managerName.trim().split(/\s+/);
                const payoutAccountConfig = {
                    accountName: `${effectiveClubName} Main Account`,
                    sortCode: "",
                    accountNumber: "",
                    defaultFeeCoverage: onboardingFeeCoverage,
                    accountHolderType: onboardingAccountHolderType,
                    treasurerFirstName:
                        bankHandler === "treasurer"
                            ? treasurerInviteName.trim()
                            : managerParts[0] || "",
                    treasurerLastName:
                        bankHandler === "treasurer"
                            ? ""
                            : managerParts.slice(1).join(" ") || "",
                    treasurerEmail:
                        bankHandler === "treasurer"
                            ? treasurerInviteEmail.trim()
                            : user?.email || "",
                    namedAccounts: includeSocialPot
                        ? [{ id: "acct_social", label: `${effectiveClubName} Social & Fines Pot` }]
                        : [],
                    paymentsSkippedInOnboarding: financeModel === "skip",
                };

                if (typeof window !== "undefined") {
                    try {
                        localStorage.setItem(`clubflow-standard-fines-${clubId}`, JSON.stringify(finalRules));
                        localStorage.setItem(`clubflow-payout-account-${clubId}`, JSON.stringify(payoutAccountConfig));
                    } catch {}
                }

                try {
                    const configPayload = JSON.stringify({
                        fineRules: finalRules,
                        payoutAccount: payoutAccountConfig,
                        updatedAt: new Date().toISOString(),
                    });
                    const { data: existingPayDoc } = await supabase
                        .from("documents")
                        .select("id")
                        .eq("club_id", clubId)
                        .eq("category", "CLUB_FINES_CONFIG")
                        .maybeSingle();

                    if (existingPayDoc?.id) {
                        await supabase
                            .from("documents")
                            .update({ url: configPayload, name: "ClubFlow Pay Config" })
                            .eq("id", existingPayDoc.id);
                    } else {
                        await supabase.from("documents").insert({
                            club_id: clubId,
                            name: "ClubFlow Pay Config",
                            type: "JSON",
                            category: "CLUB_FINES_CONFIG",
                            url: configPayload,
                        });
                    }
                } catch {}

                if (subsEnabledVal && bankHandler === "treasurer" && treasurerInviteEmail.trim()) {
                    try {
                        const {
                            data: { session },
                        } = await supabase.auth.getSession();
                        const headers: Record<string, string> = {
                            "Content-Type": "application/json",
                        };
                        if (session?.access_token) {
                            headers["Authorization"] = `Bearer ${session.access_token}`;
                        }
                        await fetch("/api/payments/invite-treasurer", {
                            method: "POST",
                            headers,
                            body: JSON.stringify({
                                clubId,
                                clubName: effectiveClubName,
                                treasurerName: treasurerInviteName.trim() || "Club Treasurer",
                                treasurerEmail: treasurerInviteEmail.trim(),
                            }),
                        });
                    } catch {}
                }
            }

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
                  { id: 1, title: "Club & Kits", subtitle: "Badge, colours & strip" },
                  { id: 4, title: "Finish Setup", subtitle: "Ready for kick-off" },
              ]
            : [
                  { id: 1, title: "Club & Kits", subtitle: "Badge, colours & strip" },
                  { id: 2, title: "Matchday & Subs", subtitle: "Formation, venue & fees" },
                  { id: 3, title: "Squad & Fixtures", subtitle: "CSV, photo or 1-time links" },
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
        <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex flex-col antialiased">
            {/* Crisp Workspace Top Header (matches real ClubFlow shell) */}
            <header className="sticky top-0 z-30 border-b border-slate-200 bg-white px-4 sm:px-8 py-3">
                <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center border border-slate-200 bg-slate-50 overflow-hidden shrink-0">
                            {logoPreview ? (
                                <img src={logoPreview} alt="Badge" className="w-8 h-8 object-contain" />
                            ) : (
                                <Shield className="w-5 h-5" style={{ color: safeBrandAccent }} />
                            )}
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="font-extrabold tracking-tight text-slate-900 text-sm sm:text-base">
                                    {clubName || "Club Setup"}
                                </span>
                                {isRerun && (
                                    <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-[10px]">
                                        Setup Re-Run
                                    </Badge>
                                )}
                            </div>
                            <p className="text-[11px] text-slate-500 hidden sm:block">
                                Set up your club badge, kits, squad &amp; matchday defaults
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200">
                            <button
                                type="button"
                                onClick={() => {
                                    setWizardMode("express");
                                    if (stage === 2 || stage === 3) setStage(1);
                                }}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                    wizardMode === "express"
                                        ? "bg-white text-slate-900 shadow-2xs border border-slate-200/80"
                                        : "text-slate-600 hover:text-slate-900"
                                }`}
                            >
                                <Zap className="w-3.5 h-3.5 text-amber-500" />
                                60s Express
                            </button>
                            <button
                                type="button"
                                onClick={() => setWizardMode("full")}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                    wizardMode === "full"
                                        ? "bg-slate-900 text-white shadow-2xs"
                                        : "text-slate-600 hover:text-slate-900"
                                }`}
                            >
                                <Wrench className="w-3.5 h-3.5" />
                                Full Club Setup
                            </button>
                        </div>

                        {isRerun && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => router.push("/dashboard")}
                                className="text-xs border-slate-200 text-slate-700 hover:bg-slate-100"
                            >
                                Back to Dashboard
                            </Button>
                        )}
                    </div>
                </div>

                {stage > 0 && (
                    <div className="max-w-7xl mx-auto mt-3 pt-3 border-t border-slate-100 flex items-center justify-between gap-2 overflow-x-auto no-scrollbar">
                        <div className="flex items-center gap-2 sm:gap-3">
                            {visibleStages.map((s, idx) => {
                                const isActive = stage === s.id;
                                const isDone = stage > s.id;
                                return (
                                    <button
                                        key={s.id}
                                        type="button"
                                        onClick={() => setStage(s.id)}
                                        className={`flex items-center gap-2.5 px-3 py-1.5 rounded-xl border text-left transition-all shrink-0 cursor-pointer ${
                                            isActive
                                                ? "border-slate-900 bg-slate-900 text-white shadow-2xs"
                                                : isDone
                                                  ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                                                  : "border-slate-200 bg-white text-slate-500 hover:text-slate-800 hover:border-slate-300"
                                        }`}
                                    >
                                        <span
                                            className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-black ${
                                                isDone
                                                    ? "bg-emerald-600 text-white"
                                                    : isActive
                                                      ? "font-black"
                                                      : "bg-slate-100 text-slate-600"
                                            }`}
                                            style={
                                                isActive
                                                    ? {
                                                          backgroundColor: primaryColor,
                                                          color: brandTextColor,
                                                          border: brandIsLight ? "1px solid #cbd5e1" : undefined,
                                                      }
                                                    : undefined
                                            }
                                        >
                                            {isDone ? <Check className="w-3 h-3" /> : idx + 1}
                                        </span>
                                        <div>
                                            <div className="text-xs font-bold leading-tight">{s.title}</div>
                                            <div
                                                className={`text-[10px] hidden md:block ${
                                                    isActive ? "text-slate-300" : "text-slate-500"
                                                }`}
                                            >
                                                {s.subtitle}
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>

                        {(stage === 1 || stage === 2) && (
                            <button
                                type="button"
                                onClick={() => setShowMobilePreview((v) => !v)}
                                className="lg:hidden flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-xs font-bold text-slate-800 shrink-0"
                            >
                                <Eye className="w-3.5 h-3.5 text-emerald-600" />
                                {showMobilePreview ? "Hide Preview" : "Live Preview"}
                            </button>
                        )}
                    </div>
                )}
            </header>

            {/* STAGE 0: CRISP WELCOME SCREEN */}
            {stage === 0 && (
                <main className="flex-1 flex items-center justify-center p-4 sm:p-8">
                    <div className="max-w-4xl w-full grid grid-cols-1 lg:grid-cols-12 gap-6 items-center bg-white border border-slate-200 rounded-2xl p-6 sm:p-10 shadow-sm">
                        <div className="lg:col-span-7 space-y-5">
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold">
                                <CheckCircle2 className="w-3.5 h-3.5" /> 30-Day Free Trial • No Card Needed
                            </div>
                            <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900 leading-tight">
                                Set Up Your Football Club
                            </h1>
                            <p className="text-slate-600 text-sm sm:text-base leading-relaxed">
                                Get onto your tactics board in <strong className="text-slate-900">60 seconds</strong>,
                                or bring across your <strong className="text-slate-900">squad, fixtures, league table &amp; subs</strong> in one go:
                            </p>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setWizardMode("full");
                                        setStage(1);
                                    }}
                                    className="group text-left p-4 rounded-xl border-2 border-slate-900 bg-slate-900 text-white hover:bg-slate-800 transition-all cursor-pointer shadow-xs"
                                >
                                    <div className="flex items-center justify-between gap-2 mb-2.5">
                                        <span className="p-2 rounded-lg bg-white/10 text-white">
                                            <Wrench className="w-4 h-4" />
                                        </span>
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-emerald-400 text-slate-950 font-extrabold text-[11px]">
                                            Recommended (~3 mins)
                                        </span>
                                    </div>
                                    <div className="font-bold text-base text-white">Full Club Setup</div>
                                    <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                                        Badge &amp; kits, formation, squad CSV / photo import, league sync &amp; coach invites.
                                    </p>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => {
                                        setWizardMode("express");
                                        setStage(1);
                                    }}
                                    className="group text-left p-4 rounded-xl border border-slate-200 bg-slate-50 hover:bg-white hover:border-slate-300 transition-all cursor-pointer"
                                >
                                    <div className="flex items-center justify-between gap-2 mb-2.5">
                                        <span className="p-2 rounded-lg bg-amber-100 text-amber-700">
                                            <Zap className="w-4 h-4" />
                                        </span>
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200 font-bold text-[11px]">
                                            Fast Track (~60 secs)
                                        </span>
                                    </div>
                                    <div className="font-bold text-base text-slate-900">60-Second Express</div>
                                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                                        Set your club name, badge &amp; kit colours and jump straight into your hub.
                                    </p>
                                </button>
                            </div>
                        </div>

                        <div className="lg:col-span-5 bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-3">
                            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                                Included in your club hub
                            </div>
                            {[
                                {
                                    icon: Palette,
                                    title: "Club Crest & Match Kits",
                                    desc: "Upload your badge and set Home, Away & Goalkeeper strips.",
                                },
                                {
                                    icon: Users,
                                    title: "CSV, Photo or 1-Time Player Links",
                                    desc: "Upload a CSV, paste a squad screenshot, or send 1-time player links.",
                                },
                                {
                                    icon: Shirt,
                                    title: "Matchday Planner & Kit Clash Check",
                                    desc: "Set your formation, game length, home ground & auto-subs.",
                                },
                                {
                                    icon: Share2,
                                    title: "WhatsApp Coach & Treasurer Invites",
                                    desc: "Share instant join links with your Assistant & Treasurer.",
                                },
                            ].map((item, i) => (
                                <div
                                    key={i}
                                    className="flex items-start gap-3 p-3 rounded-lg bg-white border border-slate-200/80"
                                >
                                    <div
                                        className="p-2 rounded-lg shrink-0 mt-0.5 bg-slate-100"
                                        style={{ color: safeBrandAccent }}
                                    >
                                        <item.icon className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <div className="text-xs font-bold text-slate-900">{item.title}</div>
                                        <div className="text-[11px] text-slate-500 mt-0.5">{item.desc}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </main>
            )}

            {/* STAGES 1–4 */}
            {stage > 0 && (
                <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-8 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
                    <div
                        className={
                            stage <= 2
                                ? "lg:col-span-7 space-y-5"
                                : "lg:col-span-12 max-w-4xl mx-auto w-full space-y-5"
                        }
                    >
                        {/* STAGE 1: CLUB IDENTITY & KITS */}
                        {stage === 1 && (
                            <Card className="bg-white border-slate-200 rounded-2xl shadow-xs overflow-hidden">
                                <CardContent className="p-5 sm:p-7 space-y-6">
                                    <div>
                                        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-700 text-[11px] font-bold uppercase tracking-wider mb-2">
                                            Step 1 • Club Identity &amp; Kits
                                        </div>
                                        <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                                            Club Crest, Colours &amp; Match Kits
                                        </h2>
                                        <p className="text-xs sm:text-sm text-slate-500 mt-1">
                                            Upload your club badge, choose your brand colour, and set your Home, Away and Goalkeeper strips.
                                        </p>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                                                Football Club Name *
                                            </label>
                                            <Input
                                                value={clubName}
                                                onChange={(e) => setClubName(e.target.value)}
                                                placeholder="e.g. Rangers FC"
                                                className="h-10 bg-white border-slate-300 text-slate-900 font-semibold"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                                                Your Name (Manager / Admin)
                                            </label>
                                            <Input
                                                value={managerName}
                                                onChange={(e) => setManagerName(e.target.value)}
                                                placeholder="e.g. Alex"
                                                className="h-10 bg-white border-slate-300 text-slate-900"
                                            />
                                        </div>
                                    </div>

                                    {/* Badge Upload */}
                                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-center gap-4">
                                        <div
                                            onClick={() => fileInputRef.current?.click()}
                                            className="w-18 h-18 rounded-xl border-2 border-dashed border-slate-300 hover:border-slate-500 bg-white flex items-center justify-center cursor-pointer overflow-hidden shrink-0 transition-all p-2"
                                        >
                                            {logoPreview ? (
                                                <img
                                                    src={logoPreview}
                                                    alt="Club Crest"
                                                    className="w-14 h-14 object-contain"
                                                />
                                            ) : (
                                                <Upload className="w-5 h-5 text-slate-400" />
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
                                                    className="h-8 text-xs border-slate-300 bg-white text-slate-800 hover:bg-slate-100"
                                                >
                                                    <Upload className="w-3.5 h-3.5 mr-1.5" />
                                                    {logoPreview ? "Change Badge" : "Upload Club Badge"}
                                                </Button>
                                                <span className="text-[11px] text-slate-500">
                                                    PNG or SVG recommended
                                                </span>
                                            </div>

                                            {extractedSwatches.length > 0 && (
                                                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1">
                                                    <span className="text-[11px] font-semibold text-slate-600">
                                                        Colours from your badge:
                                                    </span>
                                                    {extractedSwatches.map((hex, i) => (
                                                        <button
                                                            key={i}
                                                            type="button"
                                                            onClick={() => setPrimaryColor(hex)}
                                                            title={`Set ${hex} as Club Brand Colour`}
                                                            className={`w-6 h-6 rounded-full border transition-transform hover:scale-110 cursor-pointer ${
                                                                primaryColor.toLowerCase() === hex.toLowerCase()
                                                                    ? "ring-2 ring-slate-900 ring-offset-1 border-slate-400"
                                                                    : "border-slate-300"
                                                            }`}
                                                            style={{ backgroundColor: hex }}
                                                        />
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Club Primary Brand Colour */}
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                                                Club Primary Brand Colour
                                            </label>
                                            {brandIsLight && (
                                                <span className="text-[11px] font-medium text-slate-500">
                                                    Light colour selected — dark text enabled automatically for visibility
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2">
                                            {COLOR_SWATCHES.map((hex) => {
                                                const isSelected = primaryColor.toLowerCase() === hex.toLowerCase();
                                                return (
                                                    <button
                                                        key={hex}
                                                        type="button"
                                                        onClick={() => setPrimaryColor(hex)}
                                                        className={`w-8 h-8 rounded-lg border transition-all cursor-pointer ${
                                                            isSelected
                                                                ? "ring-2 ring-slate-900 ring-offset-2 border-slate-400 scale-105"
                                                                : "border-slate-300 hover:scale-105"
                                                        }`}
                                                        style={{ backgroundColor: hex }}
                                                    />
                                                );
                                            })}
                                            <input
                                                type="color"
                                                value={primaryColor}
                                                onChange={(e) => setPrimaryColor(e.target.value)}
                                                className="w-9 h-8 rounded-lg bg-white border border-slate-300 cursor-pointer p-0.5"
                                                title="Custom Brand Colour"
                                            />
                                        </div>
                                    </div>

                                    {/* Home, Away & GK Kit Colours */}
                                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-4">
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <div className="flex items-center gap-2">
                                                <Shirt className="w-4 h-4 text-slate-700" />
                                                <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
                                                    Matchday Kit Colours (Home, Away &amp; GK)
                                                </span>
                                            </div>
                                            <div className="inline-flex rounded-lg bg-white p-0.5 border border-slate-200">
                                                <button
                                                    type="button"
                                                    onClick={() => setActiveKitPreview("home")}
                                                    className={`px-2.5 py-1 rounded-md text-[11px] font-bold cursor-pointer ${
                                                        activeKitPreview === "home"
                                                            ? "bg-slate-900 text-white"
                                                            : "text-slate-600 hover:text-slate-900"
                                                    }`}
                                                >
                                                    Home Strip
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setActiveKitPreview("away")}
                                                    className={`px-2.5 py-1 rounded-md text-[11px] font-bold cursor-pointer ${
                                                        activeKitPreview === "away"
                                                            ? "bg-slate-900 text-white"
                                                            : "text-slate-600 hover:text-slate-900"
                                                    }`}
                                                >
                                                    Away Strip
                                                </button>
                                            </div>
                                        </div>

                                        {activeKitPreview === "home" ? (
                                            <div className="grid grid-cols-3 gap-3">
                                                <div className="p-2.5 rounded-lg bg-white border border-slate-200 flex items-center justify-between">
                                                    <span className="text-xs font-semibold text-slate-700">Home Shirt</span>
                                                    <input
                                                        type="color"
                                                        value={homeKitShirt}
                                                        onChange={(e) => setHomeKitShirt(e.target.value)}
                                                        className="w-8 h-8 rounded border border-slate-200 cursor-pointer bg-white p-0.5"
                                                    />
                                                </div>
                                                <div className="p-2.5 rounded-lg bg-white border border-slate-200 flex items-center justify-between">
                                                    <span className="text-xs font-semibold text-slate-700">Home Shorts</span>
                                                    <input
                                                        type="color"
                                                        value={homeKitShorts}
                                                        onChange={(e) => setHomeKitShorts(e.target.value)}
                                                        className="w-8 h-8 rounded border border-slate-200 cursor-pointer bg-white p-0.5"
                                                    />
                                                </div>
                                                <div className="p-2.5 rounded-lg bg-white border border-slate-200 flex items-center justify-between">
                                                    <span className="text-xs font-semibold text-slate-700">Home Socks</span>
                                                    <input
                                                        type="color"
                                                        value={homeKitSocks}
                                                        onChange={(e) => setHomeKitSocks(e.target.value)}
                                                        className="w-8 h-8 rounded border border-slate-200 cursor-pointer bg-white p-0.5"
                                                    />
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-3 gap-3">
                                                <div className="p-2.5 rounded-lg bg-white border border-slate-200 flex items-center justify-between">
                                                    <span className="text-xs font-semibold text-slate-700">Away Shirt</span>
                                                    <input
                                                        type="color"
                                                        value={awayKitShirt}
                                                        onChange={(e) => setAwayKitShirt(e.target.value)}
                                                        className="w-8 h-8 rounded border border-slate-200 cursor-pointer bg-white p-0.5"
                                                    />
                                                </div>
                                                <div className="p-2.5 rounded-lg bg-white border border-slate-200 flex items-center justify-between">
                                                    <span className="text-xs font-semibold text-slate-700">Away Shorts</span>
                                                    <input
                                                        type="color"
                                                        value={awayKitShorts}
                                                        onChange={(e) => setAwayKitShorts(e.target.value)}
                                                        className="w-8 h-8 rounded border border-slate-200 cursor-pointer bg-white p-0.5"
                                                    />
                                                </div>
                                                <div className="p-2.5 rounded-lg bg-white border border-slate-200 flex items-center justify-between">
                                                    <span className="text-xs font-semibold text-slate-700">Away Socks</span>
                                                    <input
                                                        type="color"
                                                        value={awayKitSocks}
                                                        onChange={(e) => setAwayKitSocks(e.target.value)}
                                                        className="w-8 h-8 rounded border border-slate-200 cursor-pointer bg-white p-0.5"
                                                    />
                                                </div>
                                            </div>
                                        )}

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            <div className="p-2.5 rounded-lg bg-white border border-slate-200 flex items-center justify-between">
                                                <div>
                                                    <div className="text-xs font-bold text-slate-800">Goalkeeper Jersey</div>
                                                    <div className="text-[10px] text-slate-500">Used on Matchday Planner</div>
                                                </div>
                                                <input
                                                    type="color"
                                                    value={gkKitColor}
                                                    onChange={(e) => setGkKitColor(e.target.value)}
                                                    className="w-8 h-8 rounded border border-slate-200 cursor-pointer bg-white p-0.5"
                                                />
                                            </div>

                                            <div className="p-2.5 rounded-lg bg-white border border-slate-200 flex items-center justify-between">
                                                <div>
                                                    <div className="text-xs font-bold text-slate-800">Front-of-Shirt Sponsor</div>
                                                    <div className="text-[10px] text-slate-500">
                                                        {sponsorLogo ? "Sponsor uploaded" : "Optional logo on graphics"}
                                                    </div>
                                                </div>
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => sponsorInputRef.current?.click()}
                                                    className="h-8 text-xs border-slate-300 bg-white text-slate-800"
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

                                    {/* Match Format & Game Length */}
                                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                                        <div>
                                            <div className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                                                <Sliders className="w-3.5 h-3.5 text-slate-700" /> Match Format &amp; Game Length
                                            </div>
                                            <p className="text-[11px] text-slate-500 mt-0.5">
                                                11v11 is default. Enable small-sided youth formats if needed and set your standard match length.
                                            </p>
                                        </div>

                                        <div className="flex flex-wrap gap-2">
                                            {(
                                                [
                                                    { id: "11v11", label: "11v11 (Default)", defaultMins: 90 },
                                                    { id: "9v9", label: "9v9 (U11–U12)", defaultMins: 60 },
                                                    { id: "7v7", label: "7v7 (U9–U10)", defaultMins: 50 },
                                                    { id: "5v5", label: "5v5 (U7–U8)", defaultMins: 40 },
                                                ] as const
                                            ).map((fmt) => {
                                                const active = enabledMatchFormats.includes(fmt.id);
                                                return (
                                                    <button
                                                        key={fmt.id}
                                                        type="button"
                                                        onClick={() => {
                                                            if (fmt.id === "11v11") return;
                                                            setEnabledMatchFormats((prev) => {
                                                                const isAdding = !prev.includes(fmt.id);
                                                                if (isAdding && defaultMatchDuration === 90) {
                                                                    setDefaultMatchDuration(fmt.defaultMins);
                                                                }
                                                                return isAdding
                                                                    ? [...prev, fmt.id]
                                                                    : prev.filter((f) => f !== fmt.id);
                                                            });
                                                        }}
                                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                                                            active
                                                                ? "bg-slate-900 border-slate-900 text-white"
                                                                : "bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-900"
                                                        }`}
                                                    >
                                                        {active ? "✓ " : "+ "}
                                                        {fmt.label}
                                                    </button>
                                                );
                                            })}
                                        </div>

                                        <div className="pt-2 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
                                            <span className="text-xs font-semibold text-slate-700">
                                                How many minutes are your matches?
                                            </span>
                                            <div className="flex flex-wrap items-center gap-1.5">
                                                {[40, 50, 60, 70, 80, 90].map((mins) => (
                                                    <button
                                                        key={mins}
                                                        type="button"
                                                        onClick={() => setDefaultMatchDuration(mins)}
                                                        className={`px-2.5 py-1 rounded-md text-xs font-bold border transition-all cursor-pointer ${
                                                            defaultMatchDuration === mins
                                                                ? "bg-slate-900 text-white border-slate-900"
                                                                : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                                                        }`}
                                                    >
                                                        {mins}m
                                                    </button>
                                                ))}
                                                <div className="flex items-center gap-1 ml-1">
                                                    <Input
                                                        type="number"
                                                        min={10}
                                                        max={120}
                                                        value={defaultMatchDuration}
                                                        onChange={(e) =>
                                                            setDefaultMatchDuration(
                                                                Math.max(10, Math.min(120, Number(e.target.value) || 90))
                                                            )
                                                        }
                                                        className="h-7 w-14 bg-white border-slate-300 text-xs font-bold text-slate-900 text-center px-1"
                                                    />
                                                    <span className="text-[11px] text-slate-500">mins</span>
                                                </div>
                                            </div>
                                        </div>

                                        {enabledMatchFormats.some((f) => f !== "11v11") && (
                                            <div className="pt-2 border-t border-slate-200 flex items-center justify-between gap-3">
                                                <div>
                                                    <div className="text-xs font-bold text-slate-800">
                                                        Youth Equal Play-Time Target (5v5 / 7v7 / 9v9)
                                                    </div>
                                                    <div className="text-[11px] text-slate-500">
                                                        Show equal game-time calculator on the bench for small-sided youth games.
                                                    </div>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => setEqualPlayTimeEnabled((v) => !v)}
                                                    className={`px-3 py-1 rounded-lg text-xs font-bold border transition-all shrink-0 cursor-pointer ${
                                                        equalPlayTimeEnabled
                                                            ? "bg-emerald-600 text-white border-emerald-600"
                                                            : "bg-white text-slate-600 border-slate-300"
                                                    }`}
                                                >
                                                    {equalPlayTimeEnabled ? "ON" : "OFF"}
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    {/* Your Role & Sidebar Tabs */}
                                    <div className="space-y-3">
                                        <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                                            Your Role &amp; Sidebar Pages
                                        </label>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                            {ROLE_PRESETS.map((role) => {
                                                const active = selectedRolePreset === role.id;
                                                return (
                                                    <button
                                                        key={role.id}
                                                        type="button"
                                                        onClick={() => handleSelectRolePreset(role.id)}
                                                        className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                                                            active
                                                                ? "border-slate-900 bg-slate-50 ring-1 ring-slate-900"
                                                                : "border-slate-200 bg-white hover:border-slate-300"
                                                        }`}
                                                    >
                                                        <div className="text-xs font-bold text-slate-900 flex items-center justify-between">
                                                            {role.label}
                                                            {active && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                                                        </div>
                                                        <div className="text-[11px] text-slate-500 mt-1">{role.desc}</div>
                                                    </button>
                                                );
                                            })}
                                        </div>

                                        <div className="pt-1">
                                            <div className="text-[11px] text-slate-500 mb-2">
                                                Choose which pages appear in your sidebar (changeable anytime in Settings):
                                            </div>
                                            <div className="flex flex-wrap gap-1.5">
                                                {ALL_PAGE_PERMISSIONS.filter((p) => p.key !== "admin").map((perm) => {
                                                    const on = selectedTabs.includes(perm.key);
                                                    return (
                                                        <button
                                                            key={perm.key}
                                                            type="button"
                                                            onClick={() => toggleTabPermission(perm.key)}
                                                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
                                                                on
                                                                    ? "bg-slate-900 border-slate-900 text-white"
                                                                    : "bg-slate-50 border-slate-200 text-slate-500 hover:text-slate-800"
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

                        {/* STAGE 2: MATCHDAY, VENUES & SUBS */}
                        {stage === 2 && (
                            <Card className="bg-white border-slate-200 rounded-2xl shadow-xs overflow-hidden">
                                <CardContent className="p-5 sm:p-7 space-y-6">
                                    <div>
                                        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-700 text-[11px] font-bold uppercase tracking-wider mb-2">
                                            Step 2 • Matchday, Venues &amp; Subs
                                        </div>
                                        <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                                            Formation, Home Ground &amp; Player Subs
                                        </h2>
                                        <p className="text-xs sm:text-sm text-slate-500 mt-1">
                                            Set your default formation, shirt numbering style, kick-off times and optional subs setup.
                                        </p>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                                            Competition Kick-Off Preset
                                        </label>
                                        <div className="flex flex-wrap gap-2">
                                            {COMPETITION_PRESETS.map((cp) => (
                                                <button
                                                    key={cp.id}
                                                    type="button"
                                                    onClick={() => handleSelectCompetitionPreset(cp.id)}
                                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                                                        competitionPreset === cp.id
                                                            ? "bg-slate-900 border-slate-900 text-white"
                                                            : "bg-white border-slate-200 text-slate-700 hover:border-slate-300"
                                                    }`}
                                                >
                                                    {cp.label} ({cp.ko})
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                                                Preferred Formation
                                            </label>
                                            <div className="grid grid-cols-3 gap-2">
                                                {Object.keys(FORMATIONS).map((fKey) => (
                                                    <button
                                                        key={fKey}
                                                        type="button"
                                                        onClick={() => {
                                                            setPreferredFormation(fKey);
                                                            setPreviewTab("pitch");
                                                        }}
                                                        className={`p-2.5 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
                                                            preferredFormation === fKey
                                                                ? "bg-slate-900 text-white border-slate-900"
                                                                : "bg-white border-slate-200 text-slate-700 hover:border-slate-300"
                                                        }`}
                                                    >
                                                        {fKey}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                                                Matchday Shirt Numbering
                                            </label>
                                            <div className="space-y-2">
                                                <button
                                                    type="button"
                                                    onClick={() => setUseMatchdayNumbering(true)}
                                                    className={`w-full p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                                                        useMatchdayNumbering
                                                            ? "border-slate-900 bg-slate-50 ring-1 ring-slate-900"
                                                            : "border-slate-200 bg-white hover:border-slate-300"
                                                    }`}
                                                >
                                                    <div className="text-xs font-bold text-slate-900">
                                                        1–11 Matchday Numbers
                                                    </div>
                                                    <div className="text-[10px] text-slate-500">
                                                        Starters wear 1–11, subs wear 12–18
                                                    </div>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setUseMatchdayNumbering(false)}
                                                    className={`w-full p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                                                        !useMatchdayNumbering
                                                            ? "border-slate-900 bg-slate-50 ring-1 ring-slate-900"
                                                            : "border-slate-200 bg-white hover:border-slate-300"
                                                    }`}
                                                >
                                                    <div className="text-xs font-bold text-slate-900">
                                                        Fixed Squad Numbers
                                                    </div>
                                                    <div className="text-[10px] text-slate-500">
                                                        Players keep their squad number all season
                                                    </div>
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                                                <MapPin className="w-3.5 h-3.5 text-emerald-600" /> Home Ground Venue
                                            </label>
                                            <Input
                                                value={homeGround}
                                                onChange={(e) => setHomeGround(e.target.value)}
                                                placeholder="e.g. Hackney Marshes Pitch 1"
                                                className="h-10 bg-white border-slate-300 text-slate-900"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                                                <Compass className="w-3.5 h-3.5 text-sky-600" /> Training Venue
                                            </label>
                                            <Input
                                                value={trainingLocation}
                                                onChange={(e) => setTrainingLocation(e.target.value)}
                                                placeholder="e.g. Market Road 3G (Wed 8pm)"
                                                className="h-10 bg-white border-slate-300 text-slate-900"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                                                <Trophy className="w-3.5 h-3.5 text-amber-600" /> Primary League Name
                                            </label>
                                            <Input
                                                value={defaultCompetition}
                                                onChange={(e) => setDefaultCompetition(e.target.value)}
                                                placeholder="e.g. Middlesex County Premier"
                                                className="h-10 bg-white border-slate-300 text-slate-900"
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1">
                                                    <Clock className="w-3.5 h-3.5 text-slate-600" /> Home KO
                                                </label>
                                                <Input
                                                    type="time"
                                                    value={defaultHomeKickOff}
                                                    onChange={(e) => setDefaultHomeKickOff(e.target.value)}
                                                    className="h-10 bg-white border-slate-300 text-slate-900"
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                                                    Meet Time
                                                </label>
                                                <select
                                                    value={meetOffsetMins}
                                                    onChange={(e) => setMeetOffsetMins(Number(e.target.value))}
                                                    className="w-full h-10 rounded-md bg-white border border-slate-300 px-2.5 text-xs text-slate-900"
                                                >
                                                    <option value={45}>45m before ({calculateMeetTime(defaultHomeKickOff, 45)})</option>
                                                    <option value={60}>60m before ({calculateMeetTime(defaultHomeKickOff, 60)})</option>
                                                    <option value={75}>75m before ({calculateMeetTime(defaultHomeKickOff, 75)})</option>
                                                    <option value={90}>90m before ({calculateMeetTime(defaultHomeKickOff, 90)})</option>
                                                </select>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Club Squads */}
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                                            <Layers className="w-3.5 h-3.5 text-slate-700" /> Club Squads
                                        </label>
                                        <div className="flex flex-wrap gap-2">
                                            {[
                                                "First Team",
                                                "Reserves",
                                                "Women",
                                                "Development / U23s",
                                                "U18s",
                                                "Pan-Disability",
                                                "Midweek",
                                                "Vets",
                                            ].map((sq) => {
                                                const active = squads.includes(sq);
                                                return (
                                                    <button
                                                        key={sq}
                                                        type="button"
                                                        onClick={() => toggleSquadChip(sq)}
                                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                                                            active
                                                                ? "bg-slate-900 border-slate-900 text-white"
                                                                : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                                                        }`}
                                                    >
                                                        {active ? "✓ " : "+ "}
                                                        {sq}
                                                    </button>
                                                );
                                            })}
                                            <div className="flex items-center gap-1.5">
                                                <Input
                                                    value={customSquadInput}
                                                    onChange={(e) => setCustomSquadInput(e.target.value)}
                                                    placeholder="Add squad..."
                                                    className="h-8 w-36 bg-white border-slate-300 text-xs text-slate-900"
                                                />
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={handleAddCustomSquad}
                                                    className="h-8 text-xs border-slate-300 bg-white text-slate-800"
                                                >
                                                    Add
                                                </Button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Subs & Payments Setup */}
                                    <div className="space-y-4 pt-3 border-t border-slate-200">
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <label className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                                                <PoundSterling className="w-3.5 h-3.5 text-emerald-600" /> Subs &amp; Club Payments Setup
                                            </label>
                                            <span className="text-[11px] text-slate-500">
                                                Pre-fills your 1-tap payment presets
                                            </span>
                                        </div>

                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                            {[
                                                { id: "per_game", title: "Matchday / Weekly", desc: "Match & training subs" },
                                                { id: "monthly", title: "Monthly Subs", desc: "Standing monthly fee" },
                                                { id: "both", title: "Both", desc: "Monthly + matchday fees" },
                                                { id: "skip", title: "Skip for Now", desc: "Set up payments later" },
                                            ].map((m) => (
                                                <button
                                                    key={m.id}
                                                    type="button"
                                                    onClick={() => setFinanceModel(m.id as any)}
                                                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                                                        financeModel === m.id
                                                            ? "border-slate-900 bg-slate-50 ring-1 ring-slate-900"
                                                            : "border-slate-200 bg-white hover:border-slate-300"
                                                    }`}
                                                >
                                                    <div className="text-xs font-bold text-slate-900">{m.title}</div>
                                                    <div className="text-[10px] text-slate-500 mt-0.5">{m.desc}</div>
                                                </button>
                                            ))}
                                        </div>

                                        {financeModel !== "skip" && (
                                            <div className="space-y-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
                                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                                    {(financeModel === "per_game" || financeModel === "both") && (
                                                        <div className="space-y-1">
                                                            <label className="text-[11px] font-semibold text-slate-600">Match Sub (£)</label>
                                                            <Input
                                                                type="number"
                                                                min="0"
                                                                step="0.5"
                                                                value={matchSubAmount}
                                                                onChange={(e) => setMatchSubAmount(Number(e.target.value))}
                                                                className="h-9 bg-white border-slate-300 text-slate-900 font-bold"
                                                            />
                                                        </div>
                                                    )}
                                                    {(financeModel === "monthly" || financeModel === "both") && (
                                                        <div className="space-y-1">
                                                            <label className="text-[11px] font-semibold text-slate-600">Monthly Subs (£)</label>
                                                            <Input
                                                                type="number"
                                                                min="0"
                                                                step="1"
                                                                value={monthlySubs}
                                                                onChange={(e) => setMonthlySubs(Number(e.target.value))}
                                                                className="h-9 bg-white border-slate-300 text-slate-900 font-bold"
                                                            />
                                                        </div>
                                                    )}
                                                    <div className="space-y-1">
                                                        <label className="text-[11px] font-semibold text-slate-600">Training Sub (£)</label>
                                                        <Input
                                                            type="number"
                                                            min="0"
                                                            step="0.5"
                                                            value={trainingFeePerSession}
                                                            onChange={(e) => setTrainingFeePerSession(Number(e.target.value))}
                                                            className="h-9 bg-white border-slate-300 text-slate-900 font-bold"
                                                        />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <label className="text-[11px] font-semibold text-slate-600">Signing-On (£)</label>
                                                        <Input
                                                            type="number"
                                                            min="0"
                                                            step="1"
                                                            value={registrationFee}
                                                            onChange={(e) => setRegistrationFee(Number(e.target.value))}
                                                            className="h-9 bg-white border-slate-300 text-slate-900 font-bold"
                                                        />
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200">
                                                    <div className="space-y-1.5">
                                                        <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                                                            <Building2 className="w-3.5 h-3.5 text-slate-600" /> Payment Pots
                                                        </label>
                                                        <div className="flex flex-wrap gap-1.5">
                                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-[11px] font-semibold text-emerald-800">
                                                                ✓ {(clubName.trim() || "Club")} Main Account
                                                            </span>
                                                            <button
                                                                type="button"
                                                                onClick={() => setIncludeSocialPot((v) => !v)}
                                                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition-all cursor-pointer ${
                                                                    includeSocialPot
                                                                        ? "bg-sky-50 border-sky-200 text-sky-800"
                                                                        : "bg-white border-slate-200 text-slate-500"
                                                                }`}
                                                            >
                                                                {includeSocialPot ? "✓" : "+"} Social &amp; Fines Pot
                                                            </button>
                                                        </div>
                                                    </div>

                                                    <div className="space-y-1.5">
                                                        <label className="text-[11px] font-bold text-slate-700">
                                                            Card / Apple Pay Processing Fee
                                                        </label>
                                                        <div className="grid grid-cols-2 gap-1.5">
                                                            <button
                                                                type="button"
                                                                onClick={() => setOnboardingFeeCoverage("player")}
                                                                className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-bold transition-all cursor-pointer ${
                                                                    onboardingFeeCoverage === "player"
                                                                        ? "bg-slate-900 border-slate-900 text-white"
                                                                        : "bg-white border-slate-200 text-slate-600"
                                                                }`}
                                                            >
                                                                Player pays (Club 100%)
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => setOnboardingFeeCoverage("club")}
                                                                className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-bold transition-all cursor-pointer ${
                                                                    onboardingFeeCoverage === "club"
                                                                        ? "bg-slate-900 border-slate-900 text-white"
                                                                        : "bg-white border-slate-200 text-slate-600"
                                                                }`}
                                                            >
                                                                Club absorbs fee
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="space-y-3 pt-2 border-t border-slate-200">
                                                    <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                                                        <CreditCard className="w-3.5 h-3.5 text-slate-600" /> Who manages the club bank account?
                                                    </label>
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => setBankHandler("self")}
                                                            className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                                                                bankHandler === "self"
                                                                    ? "border-slate-900 bg-white ring-1 ring-slate-900"
                                                                    : "border-slate-200 bg-white"
                                                            }`}
                                                        >
                                                            <div className="text-xs font-bold text-slate-900">I manage the bank account</div>
                                                            <div className="text-[10px] text-slate-500 mt-0.5">
                                                                Link in 90s at launch — no Sort Code needed right now
                                                            </div>
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => setBankHandler("treasurer")}
                                                            className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                                                                bankHandler === "treasurer"
                                                                    ? "border-slate-900 bg-white ring-1 ring-slate-900"
                                                                    : "border-slate-200 bg-white"
                                                            }`}
                                                        >
                                                            <div className="text-xs font-bold text-slate-900">
                                                                Our Treasurer / Secretary handles it
                                                            </div>
                                                            <div className="text-[10px] text-slate-500 mt-0.5">
                                                                Auto-email them a direct invite to link the club bank
                                                            </div>
                                                        </button>
                                                    </div>

                                                    {bankHandler === "self" ? (
                                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                                            {[
                                                                { id: "individual", label: "Grassroots / Treasurer" },
                                                                { id: "non_profit", label: "Non-Profit / CASC" },
                                                                { id: "company", label: "Registered Ltd" },
                                                            ].map((opt) => (
                                                                <button
                                                                    key={opt.id}
                                                                    type="button"
                                                                    onClick={() =>
                                                                        setOnboardingAccountHolderType(opt.id as any)
                                                                    }
                                                                    className={`px-3 py-2 rounded-lg border text-xs font-semibold text-left transition-all cursor-pointer ${
                                                                        onboardingAccountHolderType === opt.id
                                                                            ? "border-slate-900 bg-slate-900 text-white"
                                                                            : "border-slate-200 bg-white text-slate-700"
                                                                    }`}
                                                                >
                                                                    {opt.label}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <div className="space-y-2">
                                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                                                <Input
                                                                    placeholder="Treasurer Name (e.g. Sarah Jenkins)"
                                                                    value={treasurerInviteName}
                                                                    onChange={(e) => setTreasurerInviteName(e.target.value)}
                                                                    className="h-9 text-xs bg-white border-slate-300 text-slate-900"
                                                                />
                                                                <Input
                                                                    type="email"
                                                                    placeholder="Treasurer Email (e.g. treasurer@club.co.uk)"
                                                                    value={treasurerInviteEmail}
                                                                    onChange={(e) => setTreasurerInviteEmail(e.target.value)}
                                                                    className="h-9 text-xs bg-white border-slate-300 text-slate-900"
                                                                />
                                                            </div>
                                                            <p className="text-[11px] text-slate-600 flex items-center gap-1.5">
                                                                <Mail className="w-3.5 h-3.5 shrink-0 text-slate-500" />
                                                                When you finish setup, ClubFlow will email them a direct link to connect the club bank account.
                                                            </p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* STAGE 3: POPULATE YOUR CLUB (CSV, AI PHOTO PASTE, TEXT PASTE, 1-TIME PLAYER LINKS, LEAGUE & FIXTURES) */}
                        {stage === 3 && (
                            <Card
                                onPaste={importTab === "squad" ? handleSquadPasteEvent : undefined}
                                className="bg-white border-slate-200 rounded-2xl shadow-xs overflow-hidden"
                            >
                                <CardContent className="p-5 sm:p-7 space-y-6">
                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                        <div>
                                            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-700 text-[11px] font-bold uppercase tracking-wider mb-2">
                                                Step 3 • Populate Your Club (Optional)
                                            </div>
                                            <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                                                Add Your Squad, League Table &amp; Fixtures
                                            </h2>
                                            <p className="text-xs sm:text-sm text-slate-500 mt-1">
                                                Upload a CSV, drop in a photo/screenshot of your squad list, paste text, or send individual 1-time links to players.
                                            </p>
                                        </div>

                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-slate-900 font-bold text-xs">
                                                👥 <span className="text-emerald-700">{importedPlayersCount}</span> Players
                                            </span>
                                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-50 border border-sky-200 text-slate-900 font-bold text-xs">
                                                📅 <span className="text-sky-700">{importedFixturesCount}</span> Fixtures
                                            </span>
                                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-slate-900 font-bold text-xs">
                                                🏆 <span className="text-amber-700">{importedTeamsCount}</span> Teams
                                            </span>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                        {[
                                            { id: "squad", label: "1. Squad Players", shortLabel: "1. Squad", icon: Users },
                                            { id: "table", label: "2. League Table", shortLabel: "2. Table", icon: Trophy },
                                            { id: "fixtures", label: "3. Fixtures", shortLabel: "3. Fixtures", icon: Calendar },
                                            { id: "demo", label: "4. Sample Data", shortLabel: "4. Sample", icon: Sparkles },
                                        ].map((t) => (
                                            <button
                                                key={t.id}
                                                type="button"
                                                onClick={() => setImportTab(t.id as any)}
                                                className={`flex items-center justify-center gap-1.5 py-2.5 px-2.5 sm:px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                                                    importTab === t.id
                                                        ? "bg-slate-900 text-white border-slate-900 shadow-2xs"
                                                        : "bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-900"
                                                }`}
                                            >
                                                <t.icon className="w-3.5 h-3.5 shrink-0" />
                                                <span className="hidden sm:inline truncate">{t.label}</span>
                                                <span className="sm:hidden truncate">{t.shortLabel}</span>
                                            </button>
                                        ))}
                                    </div>

                                    {/* TAB 1: SQUAD IMPORT (CSV + PHOTO/SCREENSHOT AI + TEXT PASTE + INDIVIDUAL 1-TIME PLAYER LINKS) */}
                                    {importTab === "squad" && (
                                        <div className="space-y-4">
                                            {/* Quick Import Toolbar: CSV + Photo/Screenshot */}
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                <button
                                                    type="button"
                                                    onClick={() => csvSquadInputRef.current?.click()}
                                                    className="flex items-start gap-3 p-3.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-white hover:border-slate-400 text-left transition-all cursor-pointer"
                                                >
                                                    <div className="p-2 rounded-lg bg-emerald-100 text-emerald-700 shrink-0">
                                                        <FileSpreadsheet className="w-4 h-4" />
                                                    </div>
                                                    <div>
                                                        <div className="text-xs font-bold text-slate-900">
                                                            Import Squad CSV File
                                                        </div>
                                                        <div className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                                                            Upload a `.csv` with player names, positions, shirt numbers, DOB or emails.
                                                        </div>
                                                    </div>
                                                </button>
                                                <input
                                                    ref={csvSquadInputRef}
                                                    type="file"
                                                    accept=".csv,text/csv"
                                                    onChange={handleSquadCsvUpload}
                                                    className="hidden"
                                                />

                                                <button
                                                    type="button"
                                                    disabled={isScanningImage}
                                                    onClick={() => squadPhotoInputRef.current?.click()}
                                                    className="flex items-start gap-3 p-3.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-white hover:border-slate-400 text-left transition-all cursor-pointer disabled:opacity-60"
                                                >
                                                    <div className="p-2 rounded-lg bg-indigo-100 text-indigo-700 shrink-0">
                                                        {isScanningImage ? (
                                                            <Loader2 className="w-4 h-4 animate-spin" />
                                                        ) : (
                                                            <Camera className="w-4 h-4" />
                                                        )}
                                                    </div>
                                                    <div>
                                                        <div className="text-xs font-bold text-slate-900">
                                                            {isScanningImage
                                                                ? "Scanning Squad Image..."
                                                                : "Upload or Paste Photo of Squad List"}
                                                        </div>
                                                        <div className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                                                            Upload a screenshot/photo (or press <strong>Ctrl+V</strong>) and we&apos;ll extract the names &amp; positions automatically.
                                                        </div>
                                                    </div>
                                                </button>
                                                <input
                                                    ref={squadPhotoInputRef}
                                                    type="file"
                                                    accept="image/*"
                                                    onChange={handleSquadPhotoInput}
                                                    className="hidden"
                                                />
                                            </div>

                                            {squadImportNotice && (
                                                <div
                                                    className={`px-3.5 py-2.5 rounded-xl border text-xs font-semibold flex items-center justify-between gap-2 ${
                                                        squadImportNotice.type === "error"
                                                            ? "bg-rose-50 border-rose-200 text-rose-700"
                                                            : "bg-emerald-50 border-emerald-200 text-emerald-800"
                                                    }`}
                                                >
                                                    <span>{squadImportNotice.text}</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => setSquadImportNotice(null)}
                                                        className="text-slate-400 hover:text-slate-700"
                                                    >
                                                        <X className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            )}

                                            {/* Paste Squad List Box */}
                                            <div className="space-y-3 p-4 rounded-xl bg-slate-50 border border-slate-200">
                                                <div>
                                                    <div className="text-xs font-bold text-slate-900">
                                                        Or Paste Squad List (WhatsApp / Notes / Excel)
                                                    </div>
                                                    <p className="text-[11px] text-slate-500 mt-0.5">
                                                        One player per line with optional number &amp; position — e.g.{" "}
                                                        <code className="text-slate-800 font-semibold">1. Callum Mercer (GK)</code>,{" "}
                                                        <code className="text-slate-800 font-semibold">2. Liam Sterling - RWB</code>, or{" "}
                                                        <code className="text-slate-800 font-semibold">Nathan Cross ST</code>. You can also press{" "}
                                                        <strong>Ctrl+V</strong> here to paste a screenshot.
                                                    </p>
                                                </div>

                                                <textarea
                                                    value={rawSquadPaste}
                                                    onChange={(e) => setRawSquadPaste(e.target.value)}
                                                    onPaste={handleSquadPasteEvent}
                                                    rows={5}
                                                    placeholder={`1. Callum Mercer (GK)\n2. Liam Sterling - RWB\n4. Marcus Vance CB\n6. Harrison Cole CDM\n7. Jayden Okafor RW\n9. Nathan Cross ST`}
                                                    className="w-full rounded-xl bg-white border border-slate-300 p-3 text-xs text-slate-900 placeholder:text-slate-400 font-mono focus:outline-none focus:ring-2 focus:ring-slate-900/15 focus:border-slate-500"
                                                />

                                                {parsedSquadDrafts.length > 0 && (
                                                    <div className="space-y-2.5">
                                                        <div className="flex items-center justify-between">
                                                            <div className="text-xs font-bold text-emerald-700">
                                                                Ready to import: {parsedSquadDrafts.length} players into{" "}
                                                                {squads[0] || "First Team"}
                                                            </div>
                                                            {extraStagedPlayers.length > 0 && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setExtraStagedPlayers([])}
                                                                    className="text-[11px] font-semibold text-slate-500 hover:text-rose-600"
                                                                >
                                                                    Clear CSV rows
                                                                </button>
                                                            )}
                                                        </div>
                                                        <div className="max-h-40 overflow-y-auto flex flex-wrap gap-1.5 p-2.5 rounded-xl bg-white border border-slate-200">
                                                            {parsedSquadDrafts.map((p, i) => (
                                                                <span
                                                                    key={i}
                                                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-xs"
                                                                >
                                                                    {p.squadNumber && (
                                                                        <strong className="text-slate-500">#{p.squadNumber}</strong>
                                                                    )}
                                                                    <span className="font-semibold text-slate-900">
                                                                        {p.firstName} {p.lastName !== "—" ? p.lastName : ""}
                                                                    </span>
                                                                    <span className="px-1.5 py-0.2 rounded bg-slate-900 text-white font-bold text-[10px]">
                                                                        {p.position}
                                                                    </span>
                                                                    {p.age ? (
                                                                        <span className="text-[10px] text-slate-500">
                                                                            {p.age}y
                                                                        </span>
                                                                    ) : null}
                                                                </span>
                                                            ))}
                                                        </div>
                                                        <Button
                                                            type="button"
                                                            disabled={isImportingSquad}
                                                            onClick={handleImportSquadDrafts}
                                                            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                                                        >
                                                            {isImportingSquad ? (
                                                                <>
                                                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Importing Squad...
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <Check className="w-4 h-4 mr-2" /> Add {parsedSquadDrafts.length}{" "}
                                                                    Players to Squad
                                                                </>
                                                            )}
                                                        </Button>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Individual Player Self-Fill Link Option */}
                                            <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                                <div className="space-y-1">
                                                    <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                                                        <Link2 className="w-4 h-4 text-emerald-700 shrink-0" />
                                                        Prefer individual players to enter their own details?
                                                    </div>
                                                    <p className="text-[11px] text-slate-600 leading-relaxed">
                                                        You can generate <strong>1-time registration links</strong> for individual players to upload their own{" "}
                                                        <strong>Name, Date of Birth (auto-fills age), Position, Wing-Back/2nd Position, Foot, Shirt # &amp; Email</strong>. Each link works once and waits for your approval on the <strong>Squad</strong> page.
                                                    </p>
                                                </div>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    disabled={mintingPlayerLink || !clubId}
                                                    onClick={handleCopyOneTimePlayerLink}
                                                    className="shrink-0 h-9 text-xs font-bold border-emerald-300 bg-white text-emerald-800 hover:bg-emerald-100"
                                                >
                                                    {copiedPlayerLink ? (
                                                        <>
                                                            <Check className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
                                                            Copied 1-Time Link ✓
                                                        </>
                                                    ) : mintingPlayerLink ? (
                                                        <>
                                                            <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                                                            Generating...
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Share2 className="w-3.5 h-3.5 mr-1.5" />
                                                            Copy 1-Time Player Link
                                                        </>
                                                    )}
                                                </Button>
                                            </div>
                                        </div>
                                    )}

                                    {/* TAB 2: LEAGUE TABLE */}
                                    {importTab === "table" && (
                                        <div className="space-y-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
                                            <div>
                                                <div className="text-sm font-bold text-slate-900">
                                                    League Standings Table
                                                </div>
                                                <p className="text-xs text-slate-500 mt-0.5">
                                                    Copy &amp; paste your league table rows — we&apos;ll save your standings and add every opponent club automatically.
                                                </p>
                                            </div>

                                            <textarea
                                                value={rawTablePaste}
                                                onChange={(e) => setRawTablePaste(e.target.value)}
                                                rows={6}
                                                placeholder={`1\tHighgate Albion FC\t10\t8\t1\t1\t26\t9\t17\t25\n2\tHackney Wick Athletic\t10\t7\t2\t1\t22\t11\t11\t23`}
                                                className="w-full rounded-xl bg-white border border-slate-300 p-3 text-xs text-slate-900 placeholder:text-slate-400 font-mono focus:outline-none focus:border-slate-500"
                                            />

                                            {parsedStandingsRows.length > 0 && (
                                                <div className="space-y-3">
                                                    <div className="text-xs font-bold text-emerald-700">
                                                        Detected {parsedStandingsRows.length} league rows:
                                                    </div>
                                                    <div className="max-h-40 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 text-xs space-y-1">
                                                        {parsedStandingsRows.map((r) => (
                                                            <div
                                                                key={r.pos}
                                                                className="flex items-center justify-between px-2.5 py-1.5 rounded bg-slate-50"
                                                            >
                                                                <span>
                                                                    <strong className="text-slate-500 mr-2">{r.pos}.</strong>
                                                                    <span className="font-semibold text-slate-900">{r.team}</span>
                                                                </span>
                                                                <span className="text-slate-600 font-mono">
                                                                    P{r.played} • GD {r.gd >= 0 ? `+${r.gd}` : r.gd} •{" "}
                                                                    <strong className="text-emerald-700">{r.pts} pts</strong>
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    <Button
                                                        type="button"
                                                        disabled={isImportingTable}
                                                        onClick={handleImportLeagueTable}
                                                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                                                    >
                                                        {isImportingTable ? (
                                                            <>
                                                                <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving Table...
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Check className="w-4 h-4 mr-2" /> Save Table &amp; Sync{" "}
                                                                {parsedStandingsRows.length} Clubs
                                                            </>
                                                        )}
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* TAB 3: FIXTURES */}
                                    {importTab === "fixtures" && (
                                        <div className="space-y-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
                                            <div>
                                                <div className="text-sm font-bold text-slate-900">
                                                    Fixtures &amp; Results
                                                </div>
                                                <p className="text-xs text-slate-500 mt-0.5">
                                                    Paste your upcoming fixtures or past results and click Parse to detect Home/Away, dates, and opponents.
                                                </p>
                                            </div>

                                            <textarea
                                                value={rawFixturesPaste}
                                                onChange={(e) => setRawFixturesPaste(e.target.value)}
                                                rows={5}
                                                placeholder="Paste your league fixture list text here..."
                                                className="w-full rounded-xl bg-white border border-slate-300 p-3 text-xs text-slate-900 placeholder:text-slate-400 font-mono focus:outline-none focus:border-slate-500"
                                            />

                                            <div className="flex items-center gap-2">
                                                <Button
                                                    type="button"
                                                    disabled={isParsingFixtures || !rawFixturesPaste.trim()}
                                                    onClick={handleParseFixturesPaste}
                                                    variant="outline"
                                                    className="border-slate-300 bg-white text-slate-800 text-xs font-semibold"
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
                                                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs"
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
                                                <div className="max-h-40 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 text-xs space-y-1">
                                                    {parsedFixturesPreview.map((f, idx) => (
                                                        <div
                                                            key={idx}
                                                            className="flex items-center justify-between px-2.5 py-1.5 rounded bg-slate-50"
                                                        >
                                                            <span>
                                                                <span className="mr-2 px-1.5 py-0.5 rounded bg-slate-200 text-slate-800 font-bold text-[10px]">
                                                                    {f.homeAway}
                                                                </span>
                                                                <strong className="text-slate-900">vs {f.opponent}</strong>
                                                            </span>
                                                            <span className="text-slate-500">
                                                                {f.date} {f.scoreline ? `(${f.scoreline})` : ""}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* TAB 4: SAMPLE DATA */}
                                    {importTab === "demo" && (
                                        <div className="p-5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                                            <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                                                <Sparkles className="w-4 h-4 text-emerald-600" /> Try With Sample Club Data
                                            </div>
                                            <p className="text-xs text-slate-600 leading-relaxed">
                                                Don&apos;t have your squad list handy right now? Load a sample 16-man squad, 4 fixtures, and a 6-team league table so you can explore the Matchday Planner pitch straight away.
                                            </p>
                                            <Button
                                                type="button"
                                                disabled={isSeedingDemo || demoSeeded}
                                                onClick={handleSeedDemoData}
                                                className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs"
                                            >
                                                {demoSeeded ? (
                                                    <>
                                                        <Check className="w-4 h-4 mr-1.5 text-emerald-400" /> Sample Squad, Fixtures &amp; Table Loaded!
                                                    </>
                                                ) : isSeedingDemo ? (
                                                    <>
                                                        <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Loading Sample Data...
                                                    </>
                                                ) : (
                                                    "Load Sample Club Data (16 Players + 4 Fixtures)"
                                                )}
                                            </Button>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        )}

                        {/* STAGE 4: STAFF INVITES & LAUNCH */}
                        {stage === 4 && (
                            <Card className="bg-white border-slate-200 rounded-2xl shadow-xs overflow-hidden">
                                <CardContent className="p-5 sm:p-7 space-y-6">
                                    <div>
                                        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-700 text-[11px] font-bold uppercase tracking-wider mb-2">
                                            Final Step • Coaching Staff &amp; Kick-Off
                                        </div>
                                        <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                                            Invite Your Coaching Staff &amp; Enter Club
                                        </h2>
                                        <p className="text-xs sm:text-sm text-slate-500 mt-1">
                                            Optional: generate instant join links to share on WhatsApp (or email) with your Assistant Manager, Coaches or Secretary.
                                        </p>
                                    </div>

                                    <div className="p-4 sm:p-5 rounded-xl bg-slate-50 border border-slate-200 space-y-3.5">
                                        <div className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                                            <UserPlus className="w-3.5 h-3.5 text-slate-700" /> Invite Backroom Staff
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            <Input
                                                value={staffName}
                                                onChange={(e) => setStaffName(e.target.value)}
                                                placeholder="Staff Name (e.g. Jordan Cole)"
                                                className="h-10 text-xs bg-white border-slate-300 text-slate-900"
                                            />
                                            <Input
                                                value={staffEmail}
                                                onChange={(e) => setStaffEmail(e.target.value)}
                                                placeholder="Email (optional)"
                                                className="h-10 text-xs bg-white border-slate-300 text-slate-900"
                                            />
                                            <select
                                                value={staffRoleTitle}
                                                onChange={(e) => setStaffRoleTitle(e.target.value)}
                                                className="h-10 rounded-md bg-white border border-slate-300 px-3 text-xs text-slate-900"
                                            >
                                                <option value="Assistant Manager">Assistant Manager</option>
                                                <option value="First-Team Coach">First-Team Coach</option>
                                                <option value="Club Secretary">Club Secretary</option>
                                                <option value="Treasurer">Treasurer</option>
                                                <option value="Opposition Analyst">Opposition Analyst</option>
                                            </select>
                                            <select
                                                value={staffAccessLevel}
                                                onChange={(e) => setStaffAccessLevel(e.target.value as any)}
                                                className="h-10 rounded-md bg-white border border-slate-300 px-3 text-xs text-slate-900"
                                            >
                                                <option value="coach">Coach Access (Pitch Pages)</option>
                                                <option value="admin">Full Club Admin</option>
                                                <option value="viewer">Read-Only Viewer</option>
                                            </select>
                                        </div>
                                        <Button
                                            type="button"
                                            disabled={isCreatingInvite || !staffName.trim()}
                                            onClick={handleCreateStaffInvite}
                                            variant="outline"
                                            className="w-full h-10 border-slate-300 bg-white hover:bg-slate-100 text-slate-900 font-bold text-xs"
                                        >
                                            {isCreatingInvite ? (
                                                <>
                                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creating Invite Link...
                                                </>
                                            ) : (
                                                <>
                                                    <UserPlus className="w-4 h-4 mr-2" /> + Create Staff Invite Link
                                                </>
                                            )}
                                        </Button>

                                        {generatedInvites.length > 0 && (
                                            <div className="space-y-2 pt-1">
                                                {generatedInvites.map((inv) => {
                                                    const waText = `Hey ${inv.name}! Join ${
                                                        clubName || "our club"
                                                    } on ClubFlow as ${inv.roleTitle}: ${inv.inviteUrl}`;
                                                    return (
                                                        <div
                                                            key={inv.id}
                                                            className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-lg bg-white border border-slate-200"
                                                        >
                                                            <div>
                                                                <div className="text-xs font-bold text-slate-900">
                                                                    {inv.name}{" "}
                                                                    <span className="text-slate-500 font-normal">
                                                                        ({inv.roleTitle})
                                                                    </span>
                                                                </div>
                                                                <div className="text-[10px] text-slate-500 truncate max-w-xs">
                                                                    {inv.inviteUrl}
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-1.5">
                                                                <Button
                                                                    type="button"
                                                                    size="sm"
                                                                    variant="outline"
                                                                    onClick={() => copyToClipboard(inv.inviteUrl, inv.id)}
                                                                    className="h-7 text-[11px] border-slate-300 bg-white text-slate-800"
                                                                >
                                                                    <Copy className="w-3 h-3 mr-1" />
                                                                    {copiedLinkKey === inv.id ? "Copied!" : "Copy Link"}
                                                                </Button>
                                                                <a
                                                                    href={`https://wa.me/?text=${encodeURIComponent(waText)}`}
                                                                    target="_blank"
                                                                    rel="noreferrer"
                                                                    className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold"
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

                                    {/* Summary Card */}
                                    <div className="p-5 rounded-xl border border-slate-200 bg-slate-50 space-y-4">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <div className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                                                    ✓ Ready to Kick Off
                                                </div>
                                                <div className="text-xl font-black text-slate-900">
                                                    {clubName || "Your Football Club"}
                                                </div>
                                            </div>
                                            {logoPreview && (
                                                <img
                                                    src={logoPreview}
                                                    alt="Badge"
                                                    className="w-12 h-12 object-contain rounded-xl bg-white p-1.5 border border-slate-200"
                                                />
                                            )}
                                        </div>

                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center">
                                            <div className="p-2.5 rounded-lg bg-white border border-slate-200">
                                                <div className="text-lg font-black text-slate-900">{preferredFormation}</div>
                                                <div className="text-[10px] text-slate-500">Default System</div>
                                            </div>
                                            <div className="p-2.5 rounded-lg bg-white border border-slate-200">
                                                <div className="text-lg font-black text-emerald-700">{importedPlayersCount}</div>
                                                <div className="text-[10px] text-slate-500">Players Added</div>
                                            </div>
                                            <div className="p-2.5 rounded-lg bg-white border border-slate-200">
                                                <div className="text-lg font-black text-sky-700">{importedFixturesCount}</div>
                                                <div className="text-[10px] text-slate-500">Fixtures Scheduled</div>
                                            </div>
                                            <div className="p-2.5 rounded-lg bg-white border border-slate-200">
                                                <div className="text-lg font-black text-amber-700">{generatedInvites.length}</div>
                                                <div className="text-[10px] text-slate-500">Staff Invites</div>
                                            </div>
                                        </div>

                                        {financeModel !== "skip" && bankHandler === "self" && (
                                            <div className="p-3.5 rounded-xl bg-white border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                                <div>
                                                    <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                                                        <CreditCard className="w-4 h-4 text-indigo-600" />
                                                        Ready to collect subs by Apple Pay / Card?
                                                    </div>
                                                    <p className="text-[11px] text-slate-500 mt-0.5">
                                                        Link your club bank account now in 90 seconds, or do it later inside Subs &amp; Payments.
                                                    </p>
                                                </div>
                                                <Button
                                                    type="button"
                                                    disabled={isCompleting}
                                                    onClick={() =>
                                                        handleCompleteOnboarding("/player-payments?openBankSetup=1")
                                                    }
                                                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs h-9 shrink-0"
                                                >
                                                    <CreditCard className="w-3.5 h-3.5 mr-1.5" />
                                                    Link Bank Account (90s)
                                                </Button>
                                            </div>
                                        )}

                                        {financeModel !== "skip" &&
                                            bankHandler === "treasurer" &&
                                            treasurerInviteEmail.trim() && (
                                                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-2.5 text-xs text-emerald-800">
                                                    <Mail className="w-4 h-4 text-emerald-600 shrink-0" />
                                                    <span>
                                                        Treasurer bank-setup invite will be emailed to{" "}
                                                        <strong>{treasurerInviteEmail.trim()}</strong> when you launch.
                                                    </span>
                                                </div>
                                            )}

                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                                            <Button
                                                type="button"
                                                disabled={isCompleting}
                                                onClick={() => handleCompleteOnboarding("/dashboard")}
                                                className="h-11 bg-slate-900 hover:bg-slate-800 text-white font-bold"
                                            >
                                                <LayoutDashboard className="w-4 h-4 mr-2" />
                                                Open Dashboard
                                            </Button>
                                            <Button
                                                type="button"
                                                disabled={isCompleting}
                                                onClick={() => handleCompleteOnboarding("/matchday-xi")}
                                                variant="outline"
                                                className="h-11 border-slate-300 bg-white hover:bg-slate-100 text-slate-900 font-bold"
                                            >
                                                <Shirt className="w-4 h-4 mr-2 text-emerald-600" />
                                                Matchday Planner
                                            </Button>
                                            <Button
                                                type="button"
                                                disabled={isCompleting}
                                                onClick={() => handleCompleteOnboarding("/squad")}
                                                variant="outline"
                                                className="h-11 border-slate-300 bg-white hover:bg-slate-100 text-slate-900 font-bold"
                                            >
                                                <Users className="w-4 h-4 mr-2 text-sky-600" />
                                                Squad Page
                                            </Button>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* Bottom Back / Continue Bar — 100% Contrast-Safe Even When Brand Colour Is White */}
                        <div className="flex items-center justify-between gap-3 pt-1">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={goPrevStage}
                                className="h-11 px-5 rounded-xl border-slate-300 bg-white text-slate-800 hover:bg-slate-100 font-semibold"
                            >
                                <ArrowLeft className="w-4 h-4 mr-2" /> Back
                            </Button>

                            {stage < 4 ? (
                                <Button
                                    type="button"
                                    onClick={goNextStage}
                                    className="h-11 px-6 rounded-xl font-bold shadow-xs hover:opacity-90 transition-opacity"
                                    style={brandButtonStyle}
                                >
                                    Continue <ArrowRight className="w-4 h-4 ml-2" />
                                </Button>
                            ) : (
                                <Button
                                    type="button"
                                    disabled={isCompleting}
                                    onClick={() => handleCompleteOnboarding("/dashboard")}
                                    className="h-11 px-7 rounded-xl font-bold shadow-xs hover:opacity-90 transition-opacity"
                                    style={brandButtonStyle}
                                >
                                    {isCompleting ? (
                                        <>
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving Club...
                                        </>
                                    ) : (
                                        <>
                                            <Rocket className="w-4 h-4 mr-2" /> Complete Setup &amp; Enter Club
                                        </>
                                    )}
                                </Button>
                            )}
                        </div>
                    </div>

                    {/* Right Column: Crisp Live Preview (Matches Real ClubFlow Matchday Planner & Cards) */}
                    {(stage === 1 || stage === 2) && (
                        <div
                            className={`lg:col-span-5 space-y-4 ${
                                showMobilePreview ? "block" : "hidden lg:block"
                            }`}
                        >
                            <div className="sticky top-28 bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                                    <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                                        <Eye className="w-3.5 h-3.5 text-emerald-600" /> Live Matchday Preview
                                    </span>
                                    <div className="inline-flex self-start sm:self-auto rounded-lg bg-slate-100 p-0.5 border border-slate-200">
                                        {[
                                            { id: "pitch", label: "Pitch & Kits" },
                                            { id: "dashboard", label: "Next Match" },
                                            { id: "whatsapp", label: "WhatsApp Poll" },
                                        ].map((t) => (
                                            <button
                                                key={t.id}
                                                type="button"
                                                onClick={() => setPreviewTab(t.id as any)}
                                                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                                                    previewTab === t.id
                                                        ? "bg-white text-slate-900 shadow-2xs"
                                                        : "text-slate-600 hover:text-slate-900"
                                                }`}
                                            >
                                                {t.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {previewTab === "pitch" && (
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between bg-slate-50 px-3.5 py-2.5 rounded-xl border border-slate-200">
                                            <div className="flex items-center gap-2.5">
                                                {logoPreview ? (
                                                    <img
                                                        src={logoPreview}
                                                        alt="Crest"
                                                        className="w-7 h-7 object-contain"
                                                    />
                                                ) : (
                                                    <Shield className="w-5 h-5" style={{ color: safeBrandAccent }} />
                                                )}
                                                <div>
                                                    <div className="text-xs font-extrabold text-slate-900 leading-none">
                                                        {clubName || "Your Football Club"}
                                                    </div>
                                                    <div className="text-[10px] text-slate-500 mt-0.5 font-semibold">
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
                                                className="px-2.5 py-1 rounded-md bg-white hover:bg-slate-100 text-[10px] font-bold text-slate-800 border border-slate-200 transition-colors cursor-pointer"
                                            >
                                                {activeKitPreview === "home" ? "Home Kit" : "Away Kit"}
                                            </button>
                                        </div>

                                        <div className="relative rounded-xl overflow-hidden border border-emerald-700/30 bg-[#1e6b38] aspect-[4/5] p-4">
                                            <div
                                                className="absolute inset-0 opacity-15 pointer-events-none"
                                                style={{
                                                    backgroundImage:
                                                        "repeating-linear-gradient(to bottom, #ffffff 0px, #ffffff 28px, transparent 28px, transparent 56px)",
                                                }}
                                            />
                                            <div className="absolute inset-3 border border-white/45 rounded-lg pointer-events-none" />
                                            <div className="absolute left-3 right-3 top-1/2 border-t border-white/45 pointer-events-none" />
                                            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 rounded-full border border-white/45 pointer-events-none" />

                                            {activeFormation.coords.map((node, i) => {
                                                const isGK = node.role === "GK";
                                                const shirtFill = isGK ? gkKitColor : activeShirt;
                                                const shirtText = isLightHex(shirtFill) ? "#0f172a" : "#ffffff";
                                                const num = useMatchdayNumbering
                                                    ? i + 1
                                                    : [1, 2, 5, 6, 3, 4, 8, 10, 11, 9, 7][i] || i + 1;
                                                return (
                                                    <div
                                                        key={i}
                                                        className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center"
                                                        style={{ left: `${node.x}%`, top: `${node.y}%` }}
                                                    >
                                                        <div
                                                            className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-black shadow-md border-2 border-white transition-colors"
                                                            style={{
                                                                backgroundColor: shirtFill,
                                                                color: shirtText,
                                                            }}
                                                        >
                                                            {num}
                                                        </div>
                                                        <span className="mt-0.5 px-1.5 py-0.2 rounded bg-slate-900/90 text-[9px] font-bold text-white">
                                                            {node.role}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        <div className="grid grid-cols-3 gap-2 text-center">
                                            <div className="p-2 rounded-lg bg-slate-50 border border-slate-200">
                                                <div className="flex justify-center gap-1 mb-1">
                                                    <span
                                                        className="w-3.5 h-3.5 rounded-full border border-slate-300"
                                                        style={{ backgroundColor: activeShirt }}
                                                    />
                                                    <span
                                                        className="w-3.5 h-3.5 rounded-full border border-slate-300"
                                                        style={{ backgroundColor: activeShorts }}
                                                    />
                                                    <span
                                                        className="w-3.5 h-3.5 rounded-full border border-slate-300"
                                                        style={{ backgroundColor: activeSocks }}
                                                    />
                                                </div>
                                                <div className="text-[10px] font-bold text-slate-600">
                                                    {activeKitPreview === "home" ? "Home Strip" : "Away Strip"}
                                                </div>
                                            </div>
                                            <div className="p-2 rounded-lg bg-slate-50 border border-slate-200">
                                                <div className="flex justify-center mb-1">
                                                    <span
                                                        className="w-3.5 h-3.5 rounded-full border border-slate-300"
                                                        style={{ backgroundColor: gkKitColor }}
                                                    />
                                                </div>
                                                <div className="text-[10px] font-bold text-slate-600">GK Jersey</div>
                                            </div>
                                            <div className="p-2 rounded-lg bg-slate-50 border border-slate-200">
                                                <div className="text-xs font-black text-slate-900">
                                                    {defaultHomeKickOff}
                                                </div>
                                                <div className="text-[10px] font-semibold text-slate-500">
                                                    Meet {computedMeetTime}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {previewTab === "dashboard" && (
                                    <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-4">
                                        <div className="flex items-center justify-between">
                                            <span className="px-2.5 py-0.5 rounded-full bg-white text-slate-800 border border-slate-200 font-bold text-[10px]">
                                                {defaultCompetition || "Premier Division"}
                                            </span>
                                            <span className="text-xs font-bold text-emerald-700">
                                                KO {defaultHomeKickOff} (Meet {computedMeetTime})
                                            </span>
                                        </div>

                                        <div className="flex items-center justify-between gap-3 py-2">
                                            <div className="flex items-center gap-2.5">
                                                <div className="w-11 h-11 rounded-xl bg-white border border-slate-200 flex items-center justify-center overflow-hidden p-1">
                                                    {logoPreview ? (
                                                        <img
                                                            src={logoPreview}
                                                            alt="Crest"
                                                            className="w-8 h-8 object-contain"
                                                        />
                                                    ) : (
                                                        <Shield
                                                            className="w-5 h-5"
                                                            style={{ color: safeBrandAccent }}
                                                        />
                                                    )}
                                                </div>
                                                <div>
                                                    <div className="text-sm font-black text-slate-900">
                                                        {clubName || "Your Football Club"}
                                                    </div>
                                                    <div className="text-[11px] text-slate-500">
                                                        {squads[0] || "First Team"} (Home)
                                                    </div>
                                                </div>
                                            </div>
                                            <span className="text-xs font-black text-slate-400">VS</span>
                                            <div className="text-right">
                                                <div className="text-sm font-black text-slate-900">Opposition FC</div>
                                                <div className="text-[11px] text-slate-500">Saturday Fixture</div>
                                            </div>
                                        </div>

                                        <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-600">
                                            <span className="flex items-center gap-1">
                                                <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                                                {homeGround || "Home Ground"}
                                            </span>
                                            <span>{selectedTabs.length} Pages Active</span>
                                        </div>
                                    </div>
                                )}

                                {previewTab === "whatsapp" && (
                                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
                                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-600">
                                            WhatsApp Group Availability Poll Preview
                                        </div>
                                        <div className="p-3 rounded-xl bg-[#d9fdd3] border border-emerald-200 text-slate-900 text-xs whitespace-pre-line leading-relaxed">
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
                                            className="w-full rounded-xl bg-white border border-slate-300 p-2.5 text-xs text-slate-900"
                                            placeholder="Customize your WhatsApp poll header message..."
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </main>
            )}
        </div>
    );
}

export default function OnboardingPage() {
    return (
        <Suspense
            fallback={
                <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex items-center justify-center">
                    <Loader2 className="w-6 h-6 animate-spin text-slate-600" />
                </div>
            }
        >
            <OnboardingContent />
        </Suspense>
    );
}
