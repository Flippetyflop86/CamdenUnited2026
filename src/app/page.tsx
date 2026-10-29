"use client";

import { useState } from "react";
import Link from "next/link";
import {
    ArrowRight,
    Shield,
    Users,
    FileSpreadsheet,
    LayoutDashboard,
    Calendar,
    Trophy,
    Shirt,
    Search,
    Clock,
    MapPin,
    Star,
    Smartphone,
    Gavel,
    ClipboardCheck,
    Menu,
    Plus,
    CreditCard,
    Activity,
    Copy,
    Home,
    Plane,
    Zap,
    AlertCircle,
    Settings,
    Coins,
    Target,
    UserPlus,
} from "lucide-react";

type ClubShowcasePreset = {
    id: string;
    clubLabel: string;
    division: string;
    rank: string;
    pageLabel: string;
    urlPath: string;
    kitPrimary: string;
    kitGk: string;
};

const CLUB_SHOWCASES: ClubShowcasePreset[] = [
    {
        id: "northbrook",
        clubLabel: "Northbrook United",
        division: "Premier Division",
        rank: "#1st",
        pageLabel: "Dashboard & Form",
        urlPath: "dashboard",
        kitPrimary: "#e11d48",
        kitGk: "#10b981",
    },
    {
        id: "oakwood",
        clubLabel: "Oakwood Albion",
        division: "Senior County League",
        rank: "#2nd",
        pageLabel: "Matchday XI",
        urlPath: "matchday-xi",
        kitPrimary: "#2563eb",
        kitGk: "#f59e0b",
    },
    {
        id: "riverside",
        clubLabel: "Riverside Athletic",
        division: "Division One North",
        rank: "#3rd",
        pageLabel: "Training & Attendance",
        urlPath: "training",
        kitPrimary: "#10b981",
        kitGk: "#eab308",
    },
    {
        id: "westbourne",
        clubLabel: "Westbourne Town",
        division: "Middlesex Premier",
        rank: "#4th",
        pageLabel: "Recruitment & Trialists",
        urlPath: "recruitment",
        kitPrimary: "#f59e0b",
        kitGk: "#06b6d4",
    },
    {
        id: "ashford",
        clubLabel: "Ashford Park FC",
        division: "Olympian League",
        rank: "#1st",
        pageLabel: "Opposition Reports",
        urlPath: "opposition",
        kitPrimary: "#9f1239",
        kitGk: "#22c55e",
    },
];

type WorkspaceTabId = "matchday-xi" | "dashboard" | "league" | "training" | "recruitment" | "squad";

const WORKSPACE_TABS: {
    id: WorkspaceTabId;
    label: string;
    url: string;
    headline: string;
    desc: string;
}[] = [
    {
        id: "matchday-xi",
        label: "Matchday XI",
        url: "clubflow.org.uk/matchday-xi",
        headline: "Pick your starting XI from available players, set roles & export your team sheet.",
        desc: "Filter available players by position, see who started last match, switch between 1–11 or fixed squad numbers, and export your pitch graphic.",
    },
    {
        id: "dashboard",
        label: "Club Dashboard",
        url: "clubflow.org.uk/dashboard",
        headline: "Plan your week, check recent form & see your home and away splits.",
        desc: "Your league standing, recent 5-match form pills, home/away PPG splits, manager to-do items, and next match WhatsApp copy in one place.",
    },
    {
        id: "league",
        label: "League Table & Form Guide",
        url: "clubflow.org.uk/league",
        headline: "Standings, Points Per Game (PPG) & Last 5 Form Guide.",
        desc: "Track your division table alongside points-per-game (PPG) and recent 5-match form guides for every team in your league.",
    },
    {
        id: "training",
        label: "Training Attendance",
        url: "clubflow.org.uk/training",
        headline: "Plan the week & monitor who is turning up to training.",
        desc: "Schedule mid-week sessions, track player attendance percentages over the season, and see who has been training before selecting your squad.",
    },
    {
        id: "recruitment",
        label: "Recruitment",
        url: "clubflow.org.uk/recruitment",
        headline: "Track scouting targets, manage your trialist pipeline & export to Excel.",
        desc: "Keep a database of players you’ve watched, monitor trialists in training, and download your recruitment list to Excel anytime.",
    },
    {
        id: "squad",
        label: "Squad & Appearances",
        url: "clubflow.org.uk/squad",
        headline: "Starts, sub appearances, goals, loans & availability.",
        desc: "Track starts, sub appearances, goals, cards, medical status, and loan or dual-registration players across the season.",
    },
];

/**
 * Exact SVG Jersey & Name Pill matching src/app/matchday-xi/page.tsx
 */
function PitchJerseyNode({
    x,
    y,
    number,
    name,
    kitColor = "#e11d48",
    textColor = "#ffffff",
    isCaptain = false,
    badge,
    compact = false,
}: {
    x: number;
    y: number;
    number: number | string;
    name: string;
    kitColor?: string;
    textColor?: string;
    isCaptain?: boolean;
    badge?: string;
    compact?: boolean;
}) {
    return (
        <div
            className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center select-none"
            style={{ left: `${x}%`, top: `${y}%` }}
        >
            <div className="relative flex flex-col items-center">
                <svg
                    className={`${
                        compact ? "w-7 h-7" : "w-8 h-8 sm:w-10 sm:h-10"
                    } drop-shadow-[0_2px_4px_rgba(0,0,0,0.45)] mb-0.5 z-10`}
                    viewBox="0 0 100 100"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                >
                    <path
                        d="M 30,20 L 70,20 L 85,35 L 75,45 L 68,38 L 68,85 L 32,85 L 32,38 L 25,45 L 15,35 Z"
                        fill={kitColor}
                        stroke="#000"
                        strokeWidth="3.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                    <path d="M 40,20 Q 50,28 60,20" stroke="#000" strokeWidth="3.5" fill="none" />
                    <text
                        x="50"
                        y="57"
                        textAnchor="middle"
                        fill={textColor}
                        fontSize="28"
                        fontWeight="900"
                        dy=".3em"
                    >
                        {number}
                    </text>
                </svg>

                {isCaptain && (
                    <span className="absolute -top-1 -left-1.5 z-20 px-1 min-w-[14px] h-3.5 rounded-full text-[8px] font-black flex items-center justify-center shadow border bg-amber-400 text-black border-white">
                        C
                    </span>
                )}

                {badge && (
                    <div className="absolute -bottom-1 -right-2.5 z-20 flex items-center gap-0.5 bg-slate-950/90 text-white px-1 py-0.2 rounded-full text-[7px] font-black border border-white/30 shadow whitespace-nowrap">
                        <span>{badge}</span>
                    </div>
                )}
            </div>

            <div
                className={`${
                    compact ? "px-1.5 py-0.2 min-w-[38px]" : "px-1.5 sm:px-2 py-0.5 min-w-[44px] sm:min-w-[58px]"
                } rounded-full shadow-md text-center bg-white/95 border border-[#eaeaea] flex items-center justify-center`}
            >
                <span
                    className={`${
                        compact ? "text-[8px]" : "text-[9px] sm:text-[10px]"
                    } font-bold tracking-tight whitespace-nowrap truncate text-[#171717]`}
                >
                    {name}
                </span>
            </div>
        </div>
    );
}

/**
 * Exact Desktop Left Sidebar matching src/components/layout/sidebar.tsx (#171717)
 */
function MockAppSidebar({ clubName, activePath }: { clubName: string; activePath: string }) {
    const items = [
        { label: "Dashboard", icon: LayoutDashboard, path: "dashboard" },
        { label: "Players", icon: Users, path: "squad" },
        { label: "Matchday XI", icon: Shirt, path: "matchday-xi" },
        { label: "Training", icon: Activity, path: "training" },
        { label: "Fixtures", icon: Calendar, path: "matches" },
        { label: "League Table", icon: Trophy, path: "league" },
        { label: "Opposition Reports", icon: Target, path: "opposition" },
        { label: "Recruitment", icon: UserPlus, path: "recruitment" },
        { label: "Fines & Payments", icon: Coins, path: "player-payments" },
        { label: "Administration", icon: Settings, path: "admin" },
    ];

    return (
        <div className="hidden md:flex md:col-span-3 lg:col-span-2 bg-[#171717] text-zinc-300 flex-col justify-between border-r border-[#171717] select-none">
            <div>
                <div className="flex h-14 items-center px-4 border-b border-white/5 gap-2.5">
                    <div className="h-7 w-7 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                        <span className="text-xs font-bold text-zinc-100">{clubName.charAt(0)}</span>
                    </div>
                    <span className="text-xs font-bold text-zinc-100 truncate">{clubName}</span>
                </div>

                <div className="p-3 space-y-3">
                    <div className="flex items-center gap-2 rounded border border-white/5 bg-white/5 px-2.5 py-1.5 text-[10px] text-zinc-400">
                        <Search className="h-3 w-3 text-zinc-500 shrink-0" />
                        <span className="truncate">Search club...</span>
                    </div>

                    <div className="space-y-0.5 text-[11px]">
                        {items.map((item) => {
                            const isActive = item.path === activePath;
                            return (
                                <div
                                    key={item.label}
                                    className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg transition-colors ${
                                        isActive
                                            ? "bg-white/10 text-white font-bold border-l-2 border-[#e11d48]"
                                            : "text-zinc-400 font-medium"
                                    }`}
                                >
                                    <item.icon
                                        className={`h-3.5 w-3.5 shrink-0 ${
                                            isActive ? "text-[#e11d48]" : "text-zinc-500"
                                        }`}
                                    />
                                    <span className="truncate">{item.label}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            <div className="p-3 border-t border-white/5 flex items-center gap-2 text-left">
                <div className="h-6 w-6 rounded-full bg-[#e11d48] text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                    M
                </div>
                <div className="min-w-0">
                    <div className="text-[10px] font-bold text-zinc-200 truncate">First Team Manager</div>
                    <div className="text-[9px] text-zinc-500 truncate">{clubName}</div>
                </div>
            </div>
        </div>
    );
}

/**
 * Exact 3-Column Matchday XI View matching src/app/matchday-xi/page.tsx
 */
function RealisticMatchdayXIView({
    kitColor = "#e11d48",
    gkColor = "#10b981",
    numberingMode = "1-11",
    playersOnPitch,
}: {
    kitColor?: string;
    gkColor?: string;
    numberingMode?: "1-11" | "squad";
    playersOnPitch?: {
        x: number;
        y: number;
        name: string;
        num11: number;
        sq: number;
        gk?: boolean;
        capt?: boolean;
        badge?: string;
    }[];
}) {
    const pitchPlayers = playersOnPitch || [
        { x: 50, y: 88, name: "B. Fletcher", num11: 1, sq: 1, gk: true },
        { x: 16, y: 68, name: "R. Brooks", num11: 3, sq: 18 },
        { x: 38, y: 72, name: "H. Gallagher", num11: 5, sq: 4, capt: true },
        { x: 62, y: 72, name: "S. Ward", num11: 6, sq: 5 },
        { x: 84, y: 68, name: "D. Palmer", num11: 2, sq: 22 },
        { x: 50, y: 53, name: "A. Cole", num11: 4, sq: 6 },
        { x: 30, y: 40, name: "M. Barker", num11: 8, sq: 14 },
        { x: 70, y: 40, name: "T. Vance", num11: 10, sq: 10, badge: "👟1" },
        { x: 20, y: 20, name: "C. Maddox", num11: 11, sq: 11 },
        { x: 50, y: 14, name: "J. Mercer", num11: 9, sq: 9, badge: "⭐ ⚽2" },
        { x: 80, y: 20, name: "L. Sterling", num11: 7, sq: 7 },
    ];

    const captainPlayer = pitchPlayers.find((p) => p.capt) || pitchPlayers[2];
    const penaltyPlayer = pitchPlayers.find((p) => p.num11 === 9) || pitchPlayers[9];
    const cornerLeftPlayer = pitchPlayers.find((p) => p.num11 === 10) || pitchPlayers[7];
    const cornerRightPlayer = pitchPlayers.find((p) => p.num11 === 7) || pitchPlayers[10];

    const availableList = [
        { name: "J. Harper", pos: "CB", stats: "9 Apps • 1G", tag: "Last XI", num: "#19" },
        { name: "C. Ellis", pos: "RB", stats: "8 Apps • 0G", tag: "Sub Last", num: "#20" },
        { name: "A. Morgan", pos: "CM", stats: "10 Apps • 2G", tag: "Sub Last", num: "#21" },
        { name: "R. Patel", pos: "CDM", stats: "7 Apps • 0G", tag: "Available", num: "#23" },
        { name: "L. Davies", pos: "RW", stats: "6 Apps • 3G", tag: "Sub Last", num: "#24" },
        { name: "T. Hughes", pos: "LB", stats: "5 Apps • 0G", tag: "Available", num: "#25" },
        { name: "B. Spencer", pos: "ST", stats: "4 Apps • 2G", tag: "Available", num: "#26" },
    ];

    const benchList = [
        { num: 12, name: "K. O'Connor", pos: "GK", mins: "" },
        { num: 14, name: "M. Richards", pos: "CB / RB", mins: "25'" },
        { num: 15, name: "D. Alston", pos: "CM", mins: "30'" },
        { num: 16, name: "E. Boateng", pos: "LW / RW", mins: "15'" },
        { num: 17, name: "S. Callaghan", pos: "ST", mins: "" },
    ];

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 text-left text-[#171717]">
            {/* Left Column: Available Squad Pool (Matches src/app/matchday-xi/page.tsx lines 3687-3825) */}
            <div className="lg:col-span-3 bg-white rounded-2xl border border-[#eaeaea] shadow-xs flex flex-col overflow-hidden">
                <div className="p-2.5 border-b border-[#eaeaea] flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                        <span className="text-xs font-extrabold text-[#171717]">Available</span>
                        <span className="text-[10px] font-bold text-zinc-500 bg-[#f4f4f5] px-1.5 py-0.5 rounded-md border border-[#eaeaea]">
                            7
                        </span>
                    </div>
                    <span className="text-[10px] font-bold text-zinc-600 bg-[#f4f4f5] px-2 py-0.5 rounded-lg border border-[#eaeaea]">
                        First Team
                    </span>
                </div>

                {/* Position Filter Pills */}
                <div className="px-2.5 pt-2 pb-1.5 bg-[#f4f4f5]/60 flex gap-1">
                    {["All", "GK", "DEF", "MID", "FWD"].map((f, idx) => (
                        <span
                            key={f}
                            className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                                idx === 0 ? "bg-[#171717] text-white" : "text-zinc-500"
                            }`}
                        >
                            {f}
                        </span>
                    ))}
                </div>

                {/* Search Squad Input */}
                <div className="px-2.5 pb-2 pt-1 border-b border-[#eaeaea] bg-[#f4f4f5]/60">
                    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white border border-[#eaeaea] rounded-lg text-[10px] text-zinc-400">
                        <Search className="h-3 w-3" />
                        <span>Search squad...</span>
                    </div>
                </div>

                {/* Compact 2-Line Player Cards */}
                <div className="p-2 space-y-1.5">
                    {availableList.map((p, i) => (
                        <div
                            key={i}
                            className="p-2 border border-[#eaeaea] rounded-xl bg-white shadow-2xs space-y-0.5"
                        >
                            <div className="flex items-center justify-between gap-1">
                                <span className="text-[11px] font-bold text-[#171717] truncate">{p.name}</span>
                                <div className="flex items-center gap-1 shrink-0">
                                    <span
                                        className={`text-[8px] font-extrabold px-1.5 py-0.2 rounded border ${
                                            p.tag === "Last XI"
                                                ? "bg-emerald-500/15 text-emerald-600 border-emerald-500/30"
                                                : p.tag === "Sub Last"
                                                ? "bg-blue-500/15 text-blue-600 border-blue-500/30"
                                                : "bg-zinc-100 text-zinc-600 border-zinc-200"
                                        }`}
                                    >
                                        {p.tag}
                                    </span>
                                    <span className="text-[8px] font-bold text-zinc-500 bg-[#f4f4f5] px-1 rounded">
                                        {p.num}
                                    </span>
                                </div>
                            </div>
                            <div className="text-[9px] font-semibold text-zinc-500">
                                <span className="font-bold text-[#171717]/80">{p.pos}</span> • {p.stats}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Center Column: Toolbar + #2b7c3d Grass Pitch with SVG Collared Shirts */}
            <div className="lg:col-span-6 flex flex-col">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2">
                    <div>
                        <div className="text-xs font-extrabold text-[#171717]">Starting XI</div>
                        <div className="text-[10px] text-zinc-500 font-medium">11 / 11 Selected</div>
                    </div>

                    <div className="flex items-center gap-1.5">
                        <div className="flex items-center gap-1.5 bg-white border border-[#eaeaea] rounded-xl px-2.5 py-1 shadow-2xs text-[10px] font-bold text-[#171717]">
                            <span
                                className="w-3 h-3 rounded-sm border border-black/20"
                                style={{ backgroundColor: kitColor }}
                            />
                            <span>Auto (Home Kit)</span>
                            <span className="text-zinc-400 border-l border-[#eaeaea] pl-1.5">GK:</span>
                            <span
                                className="w-3 h-3 rounded-sm border border-black/20"
                                style={{ backgroundColor: gkColor }}
                            />
                        </div>

                        <div className="px-2.5 py-1 border border-[#eaeaea] rounded-xl text-[10px] font-bold bg-white text-[#171717] shadow-2xs">
                            4-3-3 ▾
                        </div>
                    </div>
                </div>

                {/* Exact #2b7c3d Pitch from src/app/matchday-xi/page.tsx line 4008 */}
                <div className="relative w-full h-[380px] sm:h-[410px] bg-[#2b7c3d] rounded-2xl shadow-lg overflow-hidden">
                    <div className="absolute inset-2 border-2 border-white/40 pointer-events-none" />
                    <div className="absolute left-2 right-2 top-1/2 border-t-2 border-white/40 pointer-events-none" />
                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-14 h-14 border-2 border-white/40 rounded-full pointer-events-none" />
                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-white/60 rounded-full pointer-events-none" />
                    <div className="absolute left-1/2 -translate-x-1/2 top-2 w-24 h-11 border-2 border-white/40 border-t-0 pointer-events-none" />
                    <div className="absolute left-1/2 -translate-x-1/2 bottom-2 w-24 h-11 border-2 border-white/40 border-b-0 pointer-events-none" />
                    <div className="absolute left-1/2 -translate-x-1/2 top-2 w-12 h-5 border-2 border-white/40 border-t-0 pointer-events-none" />
                    <div className="absolute left-1/2 -translate-x-1/2 bottom-2 w-12 h-5 border-2 border-white/40 border-b-0 pointer-events-none" />

                    {pitchPlayers.map((p, idx) => (
                        <PitchJerseyNode
                            key={idx}
                            x={p.x}
                            y={p.y}
                            number={numberingMode === "1-11" ? p.num11 : p.sq}
                            name={p.name}
                            kitColor={p.gk ? gkColor : kitColor}
                            isCaptain={p.capt}
                            badge={p.badge}
                        />
                    ))}
                </div>
            </div>

            {/* Right Column: Substitutes Bench & Matchday Roles */}
            <div className="lg:col-span-3 space-y-3">
                <div className="bg-white rounded-2xl border border-[#eaeaea] p-3 shadow-xs space-y-2">
                    <div className="flex items-center justify-between border-b border-[#eaeaea] pb-2">
                        <span className="text-xs font-extrabold text-[#171717]">Substitutes Bench</span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#f4f4f5] text-zinc-600 border border-[#eaeaea]">
                            5 / 5
                        </span>
                    </div>
                    <div className="space-y-1.5">
                        {benchList.map((sub) => (
                            <div
                                key={sub.num}
                                className="flex items-center justify-between p-1.5 rounded-xl border border-[#eaeaea] bg-[#fcfcfd] text-[11px]"
                            >
                                <div className="flex items-center gap-2 min-w-0">
                                    <span className="w-5 h-5 rounded-md bg-[#171717] text-white text-[10px] font-black flex items-center justify-center shrink-0">
                                        {sub.num}
                                    </span>
                                    <div className="truncate">
                                        <div className="font-bold text-[#171717] truncate">{sub.name}</div>
                                        <div className="text-[9px] text-zinc-500">{sub.pos}</div>
                                    </div>
                                </div>
                                {sub.mins ? (
                                    <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-700 font-bold text-[9px] shrink-0">
                                        Sub {sub.mins}
                                    </span>
                                ) : (
                                    <span className="text-[9px] text-zinc-400 font-semibold shrink-0">Bench</span>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                <div className="bg-white rounded-2xl border border-[#eaeaea] p-3 shadow-xs space-y-1.5 text-[11px]">
                    <div className="text-xs font-extrabold text-[#171717] border-b border-[#eaeaea] pb-1.5">
                        Roles & Set Pieces
                    </div>
                    <div className="flex justify-between py-0.5">
                        <span className="text-zinc-500">Captain (C)</span>
                        <span className="font-bold text-[#171717]">{captainPlayer.name}</span>
                    </div>
                    <div className="flex justify-between py-0.5">
                        <span className="text-zinc-500">Penalties</span>
                        <span className="font-bold text-[#171717]">{penaltyPlayer.name}</span>
                    </div>
                    <div className="flex justify-between py-0.5">
                        <span className="text-zinc-500">Corners (L / R)</span>
                        <span className="font-bold text-[#171717]">
                            {cornerLeftPlayer.name} / {cornerRightPlayer.name}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function LandingPage() {
    const [selectedClub, setSelectedClub] = useState<ClubShowcasePreset>(CLUB_SHOWCASES[0]);
    const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceTabId>("matchday-xi");
    const [numberingMode, setNumberingMode] = useState<"1-11" | "squad">("1-11");

    const currentTabObj = WORKSPACE_TABS.find((t) => t.id === activeWorkspace) || WORKSPACE_TABS[0];

    return (
        <div className="bg-[#060911] text-slate-100 min-h-screen font-sans overflow-x-hidden antialiased relative select-none">
            {/* ================================================================= */}
            {/* ARCHITECTURAL PITCH-GRID & AMBIENT MESH BACKGROUND                */}
            {/* ================================================================= */}
            <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
                <div className="absolute -top-48 left-1/2 -translate-x-1/2 w-[980px] h-[540px] rounded-full blur-[160px] opacity-20 bg-[#e11d48]" />
                <div className="absolute top-[38%] -left-48 w-[520px] h-[520px] rounded-full blur-[170px] opacity-10 bg-emerald-500" />
                <div className="absolute bottom-0 right-0 w-[600px] h-[600px] rounded-full blur-[180px] opacity-15 bg-[#e11d48]" />

                <div
                    className="absolute inset-0 opacity-[0.16]"
                    style={{
                        backgroundImage:
                            "radial-gradient(rgba(255,255,255,0.18) 1px, transparent 1px)",
                        backgroundSize: "28px 28px",
                    }}
                />

                <svg
                    className="absolute top-20 left-1/2 -translate-x-1/2 w-[1280px] h-[760px] opacity-[0.045]"
                    viewBox="0 0 1200 700"
                    fill="none"
                >
                    <rect x="60" y="40" width="1080" height="620" rx="16" stroke="white" strokeWidth="2" />
                    <line x1="600" y1="40" x2="600" y2="660" stroke="white" strokeWidth="2" />
                    <circle cx="600" cy="350" r="95" stroke="white" strokeWidth="2" />
                    <circle cx="600" cy="350" r="4" fill="white" />
                    <rect x="60" y="170" width="170" height="360" stroke="white" strokeWidth="2" />
                    <rect x="970" y="170" width="170" height="360" stroke="white" strokeWidth="2" />
                </svg>
            </div>

            {/* ================================================================= */}
            {/* CLEAN NAVBAR (INSIDE THE APP & FEATURES)                          */}
            {/* ================================================================= */}
            <nav className="fixed top-0 left-0 right-0 z-50 bg-[#060911]/85 backdrop-blur-xl border-b border-white/[0.08] px-4 sm:px-8 py-3.5">
                <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
                    <div className="flex items-center gap-8">
                        <Link href="/" className="flex items-center gap-2.5 group">
                            <div className="h-9 w-9 rounded-xl flex items-center justify-center font-black text-white text-sm shadow-lg bg-[#e11d48] border border-white/20">
                                CF
                            </div>
                            <span className="font-black text-lg tracking-tight text-white">
                                ClubFlow
                            </span>
                        </Link>

                        <div className="hidden md:flex items-center gap-7 text-xs font-bold uppercase tracking-wider text-slate-400">
                            <a href="#preview" className="hover:text-white transition-colors">
                                Inside the App
                            </a>
                            <a href="#features" className="hover:text-white transition-colors">
                                Features
                            </a>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 text-xs sm:text-sm font-bold">
                        <Link
                            href="/login"
                            className="px-3.5 py-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/5 transition-colors"
                        >
                            Sign In
                        </Link>
                        <Link
                            href="/signup"
                            className="px-4 py-2.5 rounded-xl text-white font-black shadow-lg bg-[#e11d48] hover:bg-[#be123c] transition-all flex items-center gap-1.5"
                        >
                            Start Your Club <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                    </div>
                </div>
            </nav>

            {/* ================================================================= */}
            {/* HERO SECTION                                                      */}
            {/* ================================================================= */}
            <header className="relative z-10 pt-28 pb-16 md:pt-36 md:pb-20 px-4 sm:px-6">
                <div className="max-w-6xl mx-auto text-center space-y-6 flex flex-col items-center">
                    <div className="inline-flex flex-wrap items-center justify-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.05] border border-white/10 text-xs font-bold text-slate-200 backdrop-blur-md">
                        <span className="w-2 h-2 rounded-full bg-[#e11d48] animate-pulse" />
                        <span>Built for Non-League, Grassroots, Sunday League & Academy Football</span>
                    </div>

                    <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight text-white max-w-4xl leading-[1.04]">
                        Plan the week. Know your opposition.{" "}
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-white via-rose-200 to-[#e11d48]">
                            Win on Saturday.
                        </span>
                    </h1>

                    <p className="text-base sm:text-lg md:text-xl text-slate-400 max-w-3xl leading-relaxed">
                        Monitor <strong className="text-slate-200">training attendance</strong>, build your{" "}
                        <strong className="text-slate-200">Matchday XI</strong>, prepare{" "}
                        <strong className="text-slate-200">opposition reports</strong>, manage{" "}
                        <strong className="text-slate-200">recruitment & trialists</strong>, and track your{" "}
                        <strong className="text-slate-200">league table, form guide & PPG</strong> in one hub.
                    </p>

                    <div className="flex flex-wrap items-center justify-center gap-3.5 pt-2">
                        <Link
                            href="/signup"
                            className="px-7 py-3.5 rounded-xl font-black text-sm text-white bg-[#e11d48] hover:bg-[#be123c] shadow-xl transition-all hover:scale-[1.02] flex items-center gap-2"
                        >
                            Create Your Club <ArrowRight className="w-4 h-4" />
                        </Link>
                        <a
                            href="#preview"
                            className="px-6 py-3.5 rounded-xl font-bold text-sm bg-white/[0.06] hover:bg-white/[0.1] text-white border border-white/10 transition-all"
                        >
                            See Inside the App
                        </a>
                        <Link
                            href="/login"
                            className="px-5 py-3.5 rounded-xl font-bold text-sm text-slate-400 hover:text-white transition-colors"
                        >
                            Sign In →
                        </Link>
                    </div>

                    {/* Club Switcher -> Shows Different Pages in the Real ClubFlow Light UI */}
                    <div className="pt-4 space-y-2">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                            Click a club below to preview different pages inside ClubFlow:
                        </div>
                        <div className="flex flex-wrap items-center justify-center gap-2">
                            {CLUB_SHOWCASES.map((club) => {
                                const active = selectedClub.id === club.id;
                                return (
                                    <button
                                        key={club.id}
                                        type="button"
                                        onClick={() => setSelectedClub(club)}
                                        className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold border transition-all ${
                                            active
                                                ? "bg-white text-slate-950 border-white shadow-md scale-[1.03]"
                                                : "bg-slate-900/80 text-slate-300 border-white/10 hover:border-white/30"
                                        }`}
                                    >
                                        <span
                                            className="w-3 h-3 rounded-full border border-black/20 shrink-0"
                                            style={{ backgroundColor: club.kitPrimary }}
                                        />
                                        <span>{club.clubLabel}</span>
                                        <span
                                            className={`text-[10px] px-1.5 py-0.5 rounded font-extrabold ${
                                                active
                                                    ? "bg-[#e11d48] text-white"
                                                    : "bg-white/10 text-slate-400"
                                            }`}
                                        >
                                            {club.pageLabel}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* ============================================================= */}
                {/* HERO APP WINDOW: EXACT REAL CLUBFLOW LIGHT-MODE UI + SIDEBAR  */}
                {/* ============================================================= */}
                <div className="max-w-6xl mx-auto mt-8">
                    <div className="rounded-2xl sm:rounded-3xl overflow-hidden border border-white/15 shadow-[0_25px_100px_-15px_rgba(0,0,0,0.85)] bg-[#171717]">
                        {/* Browser Top Bar */}
                        <div className="h-9 bg-[#111111] border-b border-white/10 px-4 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f56]" />
                                <span className="h-2.5 w-2.5 rounded-full bg-[#ffbd2e]" />
                                <span className="h-2.5 w-2.5 rounded-full bg-[#27c93f]" />
                                <span className="ml-2 text-[11px] text-zinc-400 font-semibold hidden sm:inline">
                                    {selectedClub.clubLabel} — {selectedClub.pageLabel}
                                </span>
                            </div>
                            <div className="px-3 py-0.5 rounded-md bg-white/[0.05] border border-white/10 text-[10px] text-zinc-300 font-mono">
                                www.clubflow.org.uk/{selectedClub.urlPath}
                            </div>
                            <div className="flex items-center gap-1.5">
                                <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded">
                                    ● {selectedClub.rank} • {selectedClub.division}
                                </span>
                            </div>
                        </div>

                        {/* Real App Shell: #171717 Left Sidebar + #FCFCFD Light Canvas */}
                        <div className="grid grid-cols-12 min-h-[460px] bg-[#fcfcfd] text-[#171717]">
                            <MockAppSidebar
                                clubName={selectedClub.clubLabel}
                                activePath={selectedClub.urlPath}
                            />

                            {/* CLUB 1: NORTHBROOK UNITED -> REAL DASHBOARD VIEW */}
                            {selectedClub.id === "northbrook" && (
                                <div className="col-span-12 md:col-span-9 lg:col-span-10 p-4 sm:p-6 space-y-4 bg-[#fcfcfd] text-left">
                                    {/* Top Header Card matching src/app/dashboard/page.tsx lines 811-901 */}
                                    <div className="bg-white border border-[#eaeaea] rounded-2xl p-4 shadow-2xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                                        <div className="flex items-center gap-3.5">
                                            <div className="h-12 w-12 rounded-xl bg-[#e11d48]/10 border border-[#e11d48]/20 flex items-center justify-center shrink-0">
                                                <Trophy className="h-6 w-6 text-[#e11d48]" />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <h2 className="text-lg sm:text-xl font-black text-[#171717] tracking-tight">
                                                        Northbrook United
                                                    </h2>
                                                    <span className="inline-flex items-center gap-1 rounded-full bg-[#e11d48]/15 text-[#e11d48] border border-[#e11d48]/30 px-2.5 py-0.5 text-xs font-extrabold">
                                                        <Trophy className="h-3 w-3" /> #1st in League
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2 mt-1.5">
                                                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                                                        Form:
                                                    </span>
                                                    <div className="inline-flex items-center gap-1">
                                                        {["W", "W", "D", "W", "W"].map((r, i) => (
                                                            <span
                                                                key={i}
                                                                className={`inline-flex items-center justify-center w-5 h-5 rounded text-[10px] font-black text-white ${
                                                                    r === "W" ? "bg-emerald-500" : "bg-amber-500"
                                                                }`}
                                                            >
                                                                {r}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Home Split & Away Split Pills matching src/app/dashboard/page.tsx lines 869-899 */}
                                        <div className="grid grid-cols-2 sm:flex items-center gap-2">
                                            <div className="flex items-center gap-2 bg-[#f4f4f5] border border-[#eaeaea] rounded-xl px-3 py-2">
                                                <div className="h-7 w-7 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
                                                    <Home className="h-3.5 w-3.5" />
                                                </div>
                                                <div>
                                                    <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                                                        Home Split
                                                    </div>
                                                    <div className="text-xs font-extrabold text-[#171717]">
                                                        6W-0D-0L <span className="text-emerald-600">(3.00 PPG)</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2 bg-[#f4f4f5] border border-[#eaeaea] rounded-xl px-3 py-2">
                                                <div className="h-7 w-7 rounded-lg bg-sky-500/10 text-sky-600 flex items-center justify-center shrink-0">
                                                    <Plane className="h-3.5 w-3.5" />
                                                </div>
                                                <div>
                                                    <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                                                        Away Split
                                                    </div>
                                                    <div className="text-xs font-extrabold text-[#171717]">
                                                        4W-1D-1L <span className="text-sky-600">(2.17 PPG)</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Briefing Row + Goalscorers */}
                                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                                        {/* Next Match Card matching Dashboard Card A */}
                                        <div className="lg:col-span-5 bg-white border border-[#eaeaea] rounded-2xl p-4 shadow-2xs flex flex-col justify-between gap-3">
                                            <div>
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#e11d48] flex items-center gap-1.5">
                                                        <Zap className="h-3.5 w-3.5 fill-[#e11d48] text-[#e11d48]" />
                                                        Next Match
                                                    </span>
                                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#e11d48]/10 text-[#e11d48] border border-[#e11d48]/20">
                                                        Premier Division
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="text-xl font-black text-[#171717]">
                                                        vs Kingswood Athletic
                                                    </span>
                                                    <span className="px-2 py-0.5 rounded-md text-xs font-extrabold bg-[#f4f4f5] border border-[#eaeaea] text-zinc-600">
                                                        #8
                                                    </span>
                                                    <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-600 border border-emerald-500/30">
                                                        Home
                                                    </span>
                                                </div>
                                                <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-500 font-medium mt-2">
                                                    <span className="inline-flex items-center gap-1">
                                                        <Calendar className="h-3.5 w-3.5 text-[#e11d48]" /> Sat 31 Oct
                                                    </span>
                                                    <span className="inline-flex items-center gap-1">
                                                        <Clock className="h-3.5 w-3.5 text-[#e11d48]" /> KO 15:00
                                                    </span>
                                                    <span className="inline-flex items-center gap-1">
                                                        <MapPin className="h-3.5 w-3.5 text-[#e11d48]" /> Northbrook Park
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-2 pt-3 border-t border-[#eaeaea]">
                                                <div className="h-8 rounded-lg border border-[#eaeaea] bg-white text-xs font-semibold text-[#171717] flex items-center justify-center gap-1.5">
                                                    <Copy className="h-3.5 w-3.5 text-emerald-500" /> WhatsApp Copy
                                                </div>
                                                <div className="h-8 rounded-lg bg-[#e11d48] text-white text-xs font-bold flex items-center justify-center gap-1.5">
                                                    <Shirt className="h-3.5 w-3.5" /> Matchday XI
                                                </div>
                                            </div>
                                        </div>

                                        {/* Northbrook Results & Scorers */}
                                        <div className="lg:col-span-7 bg-white border border-[#eaeaea] rounded-2xl p-4 shadow-2xs space-y-2.5">
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs font-extrabold text-[#171717]">
                                                    Recent Results & Goalscorers
                                                </span>
                                                <span className="text-[11px] font-bold text-[#e11d48]">
                                                    Top Scorer: J. Mercer (22G)
                                                </span>
                                            </div>
                                            {[
                                                {
                                                    opp: "Kingswood Athletic",
                                                    ha: "Away",
                                                    score: "4 - 0",
                                                    res: "W",
                                                    scorers: "J. Mercer (2), L. Sterling, T. Vance",
                                                },
                                                {
                                                    opp: "Meadowbank Town",
                                                    ha: "Home",
                                                    score: "3 - 1",
                                                    res: "W",
                                                    scorers: "C. Maddox (2), J. Mercer",
                                                },
                                                {
                                                    opp: "Silverdale Rovers",
                                                    ha: "Away",
                                                    score: "2 - 2",
                                                    res: "D",
                                                    scorers: "J. Mercer, A. Cole",
                                                },
                                            ].map((m, idx) => (
                                                <div
                                                    key={idx}
                                                    className="flex items-center justify-between p-2.5 rounded-xl bg-[#fcfcfd] border border-[#eaeaea] text-xs"
                                                >
                                                    <div className="flex items-center gap-2.5">
                                                        <span
                                                            className={`w-6 h-6 rounded-md flex items-center justify-center font-black text-white text-[11px] ${
                                                                m.res === "W" ? "bg-emerald-500" : "bg-amber-500"
                                                            }`}
                                                        >
                                                            {m.res}
                                                        </span>
                                                        <div>
                                                            <div className="font-bold text-[#171717]">
                                                                vs {m.opp}{" "}
                                                                <span className="text-[10px] text-zinc-400 font-normal">
                                                                    ({m.ha})
                                                                </span>
                                                            </div>
                                                            <div className="text-[10px] text-zinc-500">⚽ {m.scorers}</div>
                                                        </div>
                                                    </div>
                                                    <span className="font-black text-[#171717] text-sm">{m.score}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* CLUB 2: OAKWOOD ALBION -> EXACT 3-COLUMN MATCHDAY XI VIEW (NO REAL NAMES) */}
                            {selectedClub.id === "oakwood" && (
                                <div className="col-span-12 md:col-span-9 lg:col-span-10 p-4 sm:p-5 bg-[#fcfcfd]">
                                    <RealisticMatchdayXIView
                                        kitColor={selectedClub.kitPrimary}
                                        gkColor={selectedClub.kitGk}
                                        numberingMode="1-11"
                                        playersOnPitch={[
                                            { x: 50, y: 88, name: "T. Reed", num11: 1, sq: 1, gk: true },
                                            { x: 16, y: 68, name: "M. Collins", num11: 3, sq: 3 },
                                            { x: 38, y: 72, name: "D. Walsh", num11: 5, sq: 5, capt: true },
                                            { x: 62, y: 72, name: "K. Doyle", num11: 6, sq: 6 },
                                            { x: 84, y: 68, name: "B. Turner", num11: 2, sq: 2 },
                                            { x: 36, y: 52, name: "L. Hayes", num11: 4, sq: 4 },
                                            { x: 64, y: 52, name: "S. Miller", num11: 8, sq: 8 },
                                            { x: 20, y: 30, name: "C. Grant", num11: 11, sq: 11 },
                                            { x: 50, y: 32, name: "O. Foster", num11: 10, sq: 10, badge: "👟1" },
                                            { x: 80, y: 30, name: "N. Bennett", num11: 7, sq: 7 },
                                            { x: 50, y: 14, name: "E. Price", num11: 9, sq: 9, badge: "⭐ ⚽2" },
                                        ]}
                                    />
                                </div>
                            )}

                            {/* CLUB 3: RIVERSIDE ATHLETIC -> TRAINING ATTENDANCE & WEEKLY PLAN */}
                            {selectedClub.id === "riverside" && (
                                <div className="col-span-12 md:col-span-9 lg:col-span-10 p-4 sm:p-6 bg-[#fcfcfd] space-y-4 text-left">
                                    <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-[#eaeaea] shadow-2xs">
                                        <div>
                                            <span className="text-[10px] font-black uppercase text-[#e11d48]">
                                                WEEKLY PLANNING & TRAINING ATTENDANCE
                                            </span>
                                            <h3 className="text-lg sm:text-xl font-black text-[#171717]">
                                                Wednesday 3G Session — Transition & Set Pieces
                                            </h3>
                                            <p className="text-xs text-zinc-500">
                                                📍 Riverbank 3G Pitch 2 • 20:00 – 21:30 • 21 Players Confirmed
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-xl font-black text-emerald-600">88%</div>
                                            <div className="text-[10px] font-bold text-zinc-400 uppercase">
                                                Season Attendance
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="bg-white rounded-2xl border border-[#eaeaea] p-4 space-y-2 shadow-2xs">
                                            <div className="text-xs font-extrabold text-[#171717]">
                                                Attendance Leaders (Riverside Athletic)
                                            </div>
                                            {[
                                                { name: "J. Dawson (CM)", rate: "18 / 18 (100%)", status: "Confirmed" },
                                                { name: "K. Clarke (ST — 16 Goals)", rate: "17 / 18 (94%)", status: "Confirmed" },
                                                { name: "R. Patel (RB)", rate: "17 / 18 (94%)", status: "Confirmed" },
                                                { name: "T. Hughes (CB)", rate: "16 / 18 (89%)", status: "Confirmed" },
                                            ].map((p, i) => (
                                                <div
                                                    key={i}
                                                    className="flex items-center justify-between py-1.5 border-b border-[#eaeaea] last:border-0 text-xs"
                                                >
                                                    <span className="font-bold text-[#171717]">{p.name}</span>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-zinc-500 font-semibold">{p.rate}</span>
                                                        <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold text-[10px]">
                                                            {p.status}
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        <div className="bg-white rounded-2xl border border-[#eaeaea] p-4 space-y-2 shadow-2xs">
                                            <div className="text-xs font-extrabold text-[#171717]">
                                                Riverside Recent Results & Scorers
                                            </div>
                                            {[
                                                { match: "Riverside 2 - 0 Vale United", scorers: "K. Clarke, J. Dawson" },
                                                { match: "Ashby Town 1 - 3 Riverside", scorers: "K. Clarke (2), L. Davies" },
                                                { match: "Riverside 1 - 1 Eastbrook", scorers: "A. Morgan" },
                                            ].map((r, i) => (
                                                <div
                                                    key={i}
                                                    className="p-2.5 rounded-xl bg-[#fcfcfd] border border-[#eaeaea] text-xs"
                                                >
                                                    <div className="font-bold text-[#171717]">{r.match}</div>
                                                    <div className="text-[11px] text-zinc-500">⚽ {r.scorers}</div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* CLUB 4: WESTBOURNE TOWN -> RECRUITMENT & TRIALISTS */}
                            {selectedClub.id === "westbourne" && (
                                <div className="col-span-12 md:col-span-9 lg:col-span-10 p-4 sm:p-6 bg-[#fcfcfd] space-y-4 text-left">
                                    <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-[#eaeaea] shadow-2xs">
                                        <div>
                                            <span className="text-[10px] font-black uppercase text-[#e11d48]">
                                                RECRUITMENT & TRIALIST PIPELINE
                                            </span>
                                            <h3 className="text-lg sm:text-xl font-black text-[#171717]">
                                                Westbourne Town — Active Scouting Targets & Trialists
                                            </h3>
                                        </div>
                                        <span className="px-3 py-1.5 rounded-xl bg-[#171717] text-white text-xs font-bold flex items-center gap-1.5">
                                            <FileSpreadsheet className="w-3.5 h-3.5" /> Export to Excel
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                                        {[
                                            {
                                                name: "Jayden Vance",
                                                pos: "LB / LWB",
                                                club: "Hillside Athletic U23",
                                                stage: "Invited to Training",
                                                stars: 5,
                                                note: "Quick overlapping fullback, played Step 5 last season.",
                                            },
                                            {
                                                name: "Marcus Osei",
                                                pos: "CDM / CM",
                                                club: "Brookside Wanderers",
                                                stage: "On Trial",
                                                stars: 4,
                                                note: "Strong ball-winner, trained Wednesday night — impressed.",
                                            },
                                            {
                                                name: "Daniel Knight",
                                                pos: "ST / RW",
                                                club: "Unattached",
                                                stage: "Scouted",
                                                stars: 5,
                                                note: "18 goals in County Premier last year. Available immediately.",
                                            },
                                        ].map((t, i) => (
                                            <div
                                                key={i}
                                                className="p-4 rounded-2xl bg-white border border-[#eaeaea] shadow-2xs space-y-2"
                                            >
                                                <div className="flex items-center justify-between">
                                                    <span className="px-2 py-0.5 rounded bg-[#f4f4f5] text-[#171717] font-bold text-[10px]">
                                                        {t.pos}
                                                    </span>
                                                    <span className="text-amber-500 text-xs font-black">
                                                        {"★".repeat(t.stars)}
                                                    </span>
                                                </div>
                                                <div>
                                                    <div className="font-black text-[#171717] text-sm">{t.name}</div>
                                                    <div className="text-[11px] text-zinc-500">{t.club}</div>
                                                </div>
                                                <p className="text-xs text-zinc-600">{t.note}</p>
                                                <div className="pt-1 flex items-center justify-between">
                                                    <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold">
                                                        {t.stage}
                                                    </span>
                                                    <span className="text-[11px] font-bold text-[#e11d48]">
                                                        Sign to Squad →
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* CLUB 5: ASHFORD PARK FC -> OPPOSITION REPORTS (NO REAL NAMES) */}
                            {selectedClub.id === "ashford" && (
                                <div className="col-span-12 md:col-span-9 lg:col-span-10 p-4 sm:p-6 bg-[#fcfcfd] space-y-4 text-left">
                                    <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-[#eaeaea] shadow-2xs">
                                        <div>
                                            <span className="text-[10px] font-black uppercase text-[#e11d48]">
                                                OPPOSITION SCOUTING REPORT
                                            </span>
                                            <h3 className="text-lg sm:text-xl font-black text-[#171717]">
                                                Upcoming Opponent: Silverdale Athletic (#2nd • 2.25 PPG)
                                            </h3>
                                            <p className="text-xs text-zinc-500">
                                                Expected System: 3-5-2 Wingbacks • Key Threat: #9 L. Griffiths (15 Goals)
                                            </p>
                                        </div>
                                        <span className="px-3 py-1.5 rounded-xl bg-rose-50 text-[#e11d48] border border-rose-200 text-xs font-bold">
                                            Head-to-Head: 2W - 1D - 0L
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="bg-white rounded-2xl border border-[#eaeaea] p-4 space-y-2 shadow-2xs">
                                            <div className="text-xs font-extrabold text-[#171717]">
                                                Tactical Notes on Silverdale Athletic
                                            </div>
                                            <ul className="text-xs text-zinc-600 space-y-1.5 list-disc pl-4">
                                                <li>Concede 68% of their goals in the final 25 minutes of matches.</li>
                                                <li>High wingbacks leave space in behind for our wide forwards on the counter.</li>
                                                <li>Strong on in-swinging corners to the front post — assign zonal marker.</li>
                                            </ul>
                                        </div>
                                        <div className="bg-white rounded-2xl border border-[#eaeaea] p-4 space-y-2 shadow-2xs">
                                            <div className="text-xs font-extrabold text-[#171717]">
                                                Ashford Park FC Top Goalscorers
                                            </div>
                                            <div className="space-y-1.5 text-xs">
                                                <div className="flex justify-between py-1 border-b border-[#eaeaea]">
                                                    <span className="font-bold text-[#171717]">1. D. Walker (ST)</span>
                                                    <span className="font-black text-[#e11d48]">19 Goals (11 Starts)</span>
                                                </div>
                                                <div className="flex justify-between py-1 border-b border-[#eaeaea]">
                                                    <span className="font-bold text-[#171717]">2. M. Bennett (LW)</span>
                                                    <span className="font-black text-[#e11d48]">11 Goals (12 Starts)</span>
                                                </div>
                                                <div className="flex justify-between py-1">
                                                    <span className="font-bold text-[#171717]">3. J. Foster (CM)</span>
                                                    <span className="font-black text-[#e11d48]">6 Goals (10 Starts)</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </header>

            {/* ================================================================= */}
            {/* INSIDE THE APP: ALL TABS USE REAL LIGHT-MODE CLUBFLOW UI          */}
            {/* ================================================================= */}
            <section id="preview" className="relative z-10 py-20 max-w-7xl mx-auto px-4 sm:px-6 space-y-8">
                <div className="text-center space-y-2 max-w-2xl mx-auto">
                    <span className="text-xs font-black uppercase tracking-widest text-[#e11d48]">
                        Inside the App
                    </span>
                    <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
                        Explore the core pages.
                    </h2>
                </div>

                {/* 6 Tab Selector Pills */}
                <div className="flex flex-wrap items-center justify-center gap-2">
                    {WORKSPACE_TABS.map((t) => {
                        const isActive = activeWorkspace === t.id;
                        return (
                            <button
                                key={t.id}
                                type="button"
                                onClick={() => setActiveWorkspace(t.id)}
                                className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold border transition-all ${
                                    isActive
                                        ? "bg-[#e11d48] text-white border-[#e11d48] shadow-lg"
                                        : "bg-slate-900/70 text-slate-300 border-white/10 hover:border-white/25 hover:text-white"
                                }`}
                            >
                                {t.label}
                            </button>
                        );
                    })}
                </div>

                {/* Active Tab Summary */}
                <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-4 sm:p-5 text-center max-w-3xl mx-auto space-y-1">
                    <h3 className="text-base sm:text-lg font-black text-white">{currentTabObj.headline}</h3>
                    <p className="text-xs sm:text-sm text-slate-400">{currentTabObj.desc}</p>
                </div>

                {/* Real App Window Frame (#171717 Sidebar + #FCFCFD Light Canvas) */}
                <div className="rounded-2xl sm:rounded-3xl overflow-hidden border border-white/15 bg-[#171717] shadow-2xl">
                    <div className="h-9 bg-[#111111] border-b border-white/10 px-4 flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                            <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f56]" />
                            <span className="h-2.5 w-2.5 rounded-full bg-[#ffbd2e]" />
                            <span className="h-2.5 w-2.5 rounded-full bg-[#27c93f]" />
                        </div>
                        <div className="text-[11px] text-zinc-400 font-mono">{currentTabObj.url}</div>
                        <div className="w-12" />
                    </div>

                    <div className="grid grid-cols-12 bg-[#fcfcfd] text-[#171717]">
                        <MockAppSidebar
                            clubName={selectedClub.clubLabel}
                            activePath={activeWorkspace}
                        />

                        <div className="col-span-12 md:col-span-9 lg:col-span-10 p-4 sm:p-6 bg-[#fcfcfd]">
                            {/* TAB 1: MATCHDAY XI (EXACT 3-COLUMN REPLICA WITH SVG SHIRTS) */}
                            {activeWorkspace === "matchday-xi" && (
                                <div className="space-y-3">
                                    <div className="flex flex-wrap items-center justify-between gap-2 bg-white p-3 rounded-2xl border border-[#eaeaea] shadow-2xs">
                                        <div className="text-left">
                                            <div className="text-sm font-black text-[#171717]">
                                                Matchday XI — vs Kingswood Athletic (Home)
                                            </div>
                                            <div className="text-[11px] text-zinc-500">
                                                Sat 31 Oct • KO 15:00 • Meet 13:30
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={() => setNumberingMode("1-11")}
                                                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${
                                                    numberingMode === "1-11"
                                                        ? "bg-[#171717] text-white border-[#171717]"
                                                        : "bg-white text-zinc-600 border-[#eaeaea]"
                                                }`}
                                            >
                                                1–11 Numbers
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setNumberingMode("squad")}
                                                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${
                                                    numberingMode === "squad"
                                                        ? "bg-[#171717] text-white border-[#171717]"
                                                        : "bg-white text-zinc-600 border-[#eaeaea]"
                                                }`}
                                            >
                                                Squad Numbers
                                            </button>
                                        </div>
                                    </div>

                                    <RealisticMatchdayXIView
                                        kitColor={selectedClub.kitPrimary}
                                        gkColor={selectedClub.kitGk}
                                        numberingMode={numberingMode}
                                    />
                                </div>
                            )}

                            {/* TAB 2: CLUB DASHBOARD */}
                            {activeWorkspace === "dashboard" && (
                                <div className="space-y-4 text-left">
                                    <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-[#eaeaea] shadow-2xs">
                                        <div className="flex items-center gap-3.5">
                                            <div className="w-12 h-12 rounded-2xl bg-[#e11d48]/10 border border-[#e11d48]/20 flex items-center justify-center font-black text-[#e11d48] text-lg">
                                                <Trophy className="w-6 h-6" />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xl font-black text-[#171717]">
                                                        {selectedClub.clubLabel}
                                                    </span>
                                                    <span className="px-2.5 py-0.5 rounded-full bg-[#e11d48]/15 text-[#e11d48] border border-[#e11d48]/30 text-xs font-extrabold">
                                                        🏆 {selectedClub.rank}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-1.5 mt-1">
                                                    <span className="text-[10px] font-bold uppercase text-zinc-400">
                                                        Form:
                                                    </span>
                                                    {["W", "W", "W", "D", "W"].map((r, i) => (
                                                        <span
                                                            key={i}
                                                            className={`w-5 h-5 rounded text-[10px] font-black text-white flex items-center justify-center ${
                                                                r === "W" ? "bg-emerald-500" : "bg-amber-500"
                                                            }`}
                                                        >
                                                            {r}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2.5">
                                            <div className="px-3.5 py-2 rounded-xl bg-[#f4f4f5] border border-[#eaeaea] text-xs">
                                                <span className="text-zinc-500 font-bold mr-1.5">HOME SPLIT:</span>
                                                <strong className="text-[#171717]">6W-0D-0L (3.00 PPG)</strong>
                                            </div>
                                            <div className="px-3.5 py-2 rounded-xl bg-[#f4f4f5] border border-[#eaeaea] text-xs">
                                                <span className="text-zinc-500 font-bold mr-1.5">AWAY SPLIT:</span>
                                                <strong className="text-[#171717]">4W-1D-1L (2.17 PPG)</strong>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div className="p-4 rounded-2xl bg-white border border-[#eaeaea] shadow-2xs space-y-2">
                                            <div className="text-[10px] font-black uppercase text-[#e11d48]">
                                                NEXT MATCH
                                            </div>
                                            <div className="text-base font-black text-[#171717]">
                                                vs Kingswood Athletic (#8)
                                            </div>
                                            <div className="text-xs text-zinc-500">Sat 15:00 • Meet 13:30 • Home</div>
                                        </div>
                                        <div className="p-4 rounded-2xl bg-white border border-[#eaeaea] shadow-2xs space-y-2">
                                            <div className="text-[10px] font-black uppercase text-emerald-600">
                                                NEXT TRAINING
                                            </div>
                                            <div className="text-base font-black text-[#171717]">Wed Night 3G</div>
                                            <div className="text-xs text-zinc-500">21 Confirmed • 88% Season Avg</div>
                                        </div>
                                        <div className="p-4 rounded-2xl bg-white border border-[#eaeaea] shadow-2xs space-y-2">
                                            <div className="text-[10px] font-black uppercase text-[#e11d48]">
                                                TOP GOALSCORER
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <div className="text-base font-black text-[#171717]">J. Mercer</div>
                                                    <div className="text-xs text-zinc-500">12 Starts</div>
                                                </div>
                                                <div className="text-2xl font-black text-[#e11d48]">22G</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* TAB 3: LEAGUE TABLE, PPG & FORM GUIDE */}
                            {activeWorkspace === "league" && (
                                <div className="space-y-4 text-left">
                                    <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-[#eaeaea] shadow-2xs">
                                        <div>
                                            <span className="text-[10px] font-black uppercase text-[#e11d48]">
                                                PREMIER DIVISION STANDINGS
                                            </span>
                                            <h4 className="text-lg font-black text-[#171717]">
                                                League Table, Points Per Game (PPG) & Last 5 Form Guide
                                            </h4>
                                        </div>
                                        <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-black">
                                            2.58 PPG • #1st Place
                                        </span>
                                    </div>

                                    <div className="bg-white rounded-2xl border border-[#eaeaea] shadow-2xs overflow-x-auto">
                                        <table className="w-full text-left text-xs">
                                            <thead className="bg-[#f4f4f5] border-b border-[#eaeaea] text-zinc-500 uppercase text-[10px] font-black">
                                                <tr>
                                                    <th className="py-3 px-4">#</th>
                                                    <th className="py-3 px-4">Club</th>
                                                    <th className="py-3 px-3 text-center">P</th>
                                                    <th className="py-3 px-3 text-center">W</th>
                                                    <th className="py-3 px-3 text-center">D</th>
                                                    <th className="py-3 px-3 text-center">L</th>
                                                    <th className="py-3 px-3 text-center">GD</th>
                                                    <th className="py-3 px-3 text-center">PPG</th>
                                                    <th className="py-3 px-3 text-center">Pts</th>
                                                    <th className="py-3 px-4 text-right">Form Guide</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-[#eaeaea] font-medium">
                                                {[
                                                    { pos: 1, team: selectedClub.clubLabel, p: 12, w: 10, d: 1, l: 1, gd: "+23", ppg: "2.58", pts: 31, form: ["W", "W", "W", "D", "W"], ours: true },
                                                    { pos: 2, team: "Silverdale Athletic", p: 12, w: 8, d: 3, l: 1, gd: "+14", ppg: "2.25", pts: 27, form: ["W", "D", "W", "W", "L"], ours: false },
                                                    { pos: 3, team: "Oakwood Albion", p: 12, w: 7, d: 2, l: 3, gd: "+7", ppg: "1.92", pts: 23, form: ["L", "W", "W", "D", "W"], ours: false },
                                                    { pos: 4, team: "Meadowbank Town", p: 12, w: 6, d: 3, l: 3, gd: "+5", ppg: "1.75", pts: 21, form: ["D", "W", "L", "W", "D"], ours: false },
                                                    { pos: 8, team: "Kingswood Athletic (Next Opp)", p: 11, w: 4, d: 2, l: 5, gd: "-1", ppg: "1.27", pts: 14, form: ["L", "W", "L", "D", "W"], ours: false },
                                                ].map((r) => (
                                                    <tr
                                                        key={r.pos}
                                                        className={r.ours ? "bg-rose-50/70 font-bold" : "hover:bg-zinc-50"}
                                                    >
                                                        <td className="py-3 px-4 font-black text-[#171717]">{r.pos}</td>
                                                        <td className="py-3 px-4 font-black text-[#171717]">{r.team}</td>
                                                        <td className="py-3 px-3 text-center">{r.p}</td>
                                                        <td className="py-3 px-3 text-center">{r.w}</td>
                                                        <td className="py-3 px-3 text-center">{r.d}</td>
                                                        <td className="py-3 px-3 text-center">{r.l}</td>
                                                        <td className="py-3 px-3 text-center font-bold text-emerald-700">{r.gd}</td>
                                                        <td className="py-3 px-3 text-center font-bold text-[#171717]">{r.ppg}</td>
                                                        <td className="py-3 px-3 text-center font-black text-[#171717]">{r.pts}</td>
                                                        <td className="py-3 px-4">
                                                            <div className="flex items-center justify-end gap-1">
                                                                {r.form.map((f, idx) => (
                                                                    <span
                                                                        key={idx}
                                                                        className={`w-5 h-5 rounded text-[10px] font-black text-white flex items-center justify-center ${
                                                                            f === "W"
                                                                                ? "bg-emerald-500"
                                                                                : f === "D"
                                                                                ? "bg-amber-500"
                                                                                : "bg-rose-500"
                                                                        }`}
                                                                    >
                                                                        {f}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* TAB 4: TRAINING ATTENDANCE */}
                            {activeWorkspace === "training" && (
                                <div className="space-y-4 text-left">
                                    <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-[#eaeaea] shadow-2xs">
                                        <div>
                                            <span className="text-[10px] font-black uppercase text-[#e11d48]">
                                                WEEKLY TRAINING & ATTENDANCE TRACKER
                                            </span>
                                            <h4 className="text-lg font-black text-[#171717]">
                                                Wednesday Evening Session • High Press & Finishing
                                            </h4>
                                        </div>
                                        <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-black">
                                            21 / 24 Players Present
                                        </span>
                                    </div>

                                    <div className="bg-white rounded-2xl border border-[#eaeaea] shadow-2xs overflow-hidden">
                                        <table className="w-full text-left text-xs">
                                            <thead className="bg-[#f4f4f5] border-b border-[#eaeaea] text-zinc-500 uppercase text-[10px] font-black">
                                                <tr>
                                                    <th className="py-3 px-4">Player</th>
                                                    <th className="py-3 px-3">Pos</th>
                                                    <th className="py-3 px-3 text-center">Sessions Attended</th>
                                                    <th className="py-3 px-3 text-center">Attendance %</th>
                                                    <th className="py-3 px-4 text-right">This Week</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-[#eaeaea] font-medium">
                                                {[
                                                    { name: "Jack Mercer", pos: "ST", attended: "14 / 14", pct: "100%", status: "Present" },
                                                    { name: "Ryan Brooks", pos: "LB", attended: "13 / 14", pct: "93%", status: "Present" },
                                                    { name: "Harry Gallagher", pos: "CB", attended: "13 / 14", pct: "93%", status: "Present" },
                                                    { name: "Liam Sterling", pos: "RW", attended: "12 / 14", pct: "86%", status: "Present" },
                                                ].map((row, i) => (
                                                    <tr key={i}>
                                                        <td className="py-3 px-4 font-black text-[#171717]">{row.name}</td>
                                                        <td className="py-3 px-3">{row.pos}</td>
                                                        <td className="py-3 px-3 text-center">{row.attended}</td>
                                                        <td className="py-3 px-3 text-center font-bold text-emerald-700">{row.pct}</td>
                                                        <td className="py-3 px-4 text-right">
                                                            <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                                                                ✓ {row.status}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* TAB 5: RECRUITMENT (LIGHT MODE REPLICA MATCHING ACTUAL SITE) */}
                            {activeWorkspace === "recruitment" && (
                                <div className="space-y-4 text-left">
                                    <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-[#eaeaea] shadow-2xs">
                                        <div>
                                            <div className="text-[10px] font-black uppercase tracking-wider text-[#e11d48]">
                                                PLAYER RECRUITMENT & TRIALISTS
                                            </div>
                                            <div className="text-lg font-black text-[#171717]">
                                                Scouting Targets, Trialist Pipeline & Excel Export
                                            </div>
                                        </div>
                                        <span className="px-3.5 py-2 rounded-xl bg-[#171717] text-white font-bold text-xs flex items-center gap-1.5">
                                            <FileSpreadsheet className="w-4 h-4 text-emerald-400" /> Export to Excel (.xlsx)
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        {[
                                            {
                                                name: "Jayden Vance",
                                                pos: "LB / LWB",
                                                club: "Hillside Athletic U23",
                                                foot: "Left",
                                                rating: 5,
                                                stage: "Invited to Training",
                                                note: "Quick overlapping fullback, played Step 5 last season.",
                                            },
                                            {
                                                name: "Marcus Osei",
                                                pos: "CDM / CM",
                                                club: "Brookside Wanderers Res",
                                                foot: "Right",
                                                rating: 4,
                                                stage: "On Trial",
                                                note: "Strong ball-winner, trained Wednesday night — impressed.",
                                            },
                                            {
                                                name: "Daniel Knight",
                                                pos: "ST / RW",
                                                club: "Unattached",
                                                foot: "Right",
                                                rating: 5,
                                                stage: "Scouted",
                                                note: "18 goals in County Premier last year. Available immediately.",
                                            },
                                        ].map((t, i) => (
                                            <div
                                                key={i}
                                                className="p-4 rounded-2xl bg-white border border-[#eaeaea] shadow-2xs space-y-2.5"
                                            >
                                                <div className="flex items-center justify-between">
                                                    <span className="px-2 py-0.5 rounded bg-[#f4f4f5] text-[#171717] font-bold text-[10px]">
                                                        {t.pos}
                                                    </span>
                                                    <span className="text-amber-500 text-xs font-black">
                                                        {"★".repeat(t.rating)}
                                                    </span>
                                                </div>
                                                <div>
                                                    <div className="text-sm font-black text-[#171717]">{t.name}</div>
                                                    <div className="text-[11px] text-zinc-500">
                                                        {t.club} • {t.foot} Foot
                                                    </div>
                                                </div>
                                                <p className="text-xs text-zinc-600 leading-relaxed">{t.note}</p>
                                                <div className="pt-1 flex items-center justify-between">
                                                    <span className="px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold">
                                                        {t.stage}
                                                    </span>
                                                    <span className="text-[11px] font-bold text-[#e11d48]">
                                                        Sign to Squad →
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* TAB 6: SQUAD & APPEARANCES */}
                            {activeWorkspace === "squad" && (
                                <div className="space-y-4 text-left">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <div className="flex items-center gap-2">
                                            <span className="px-3 py-1.5 rounded-xl bg-[#171717] text-white text-xs font-bold">
                                                Active Squad (27)
                                            </span>
                                            <span className="px-3 py-1.5 rounded-xl bg-white border border-[#eaeaea] text-zinc-600 text-xs font-bold">
                                                Loan / Dual-Reg (3)
                                            </span>
                                            <span className="px-3 py-1.5 rounded-xl bg-white border border-[#eaeaea] text-zinc-600 text-xs font-bold">
                                                Former Players (4)
                                            </span>
                                        </div>
                                    </div>

                                    <div className="bg-white rounded-2xl border border-[#eaeaea] shadow-2xs overflow-hidden">
                                        <table className="w-full text-left text-xs">
                                            <thead className="bg-[#f4f4f5] border-b border-[#eaeaea] text-zinc-500 uppercase text-[10px] font-black">
                                                <tr>
                                                    <th className="py-3 px-4">Player</th>
                                                    <th className="py-3 px-3">Pos</th>
                                                    <th className="py-3 px-3">Registration</th>
                                                    <th className="py-3 px-3 text-center">Starts</th>
                                                    <th className="py-3 px-3 text-center">Sub Used</th>
                                                    <th className="py-3 px-3 text-center">Goals</th>
                                                    <th className="py-3 px-4 text-right">Status</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-[#eaeaea] font-medium">
                                                {[
                                                    { name: "Jack Mercer", pos: "ST", reg: "League Reg", starts: 12, sub: 0, goals: 22, status: "Available" },
                                                    { name: "Ryan Brooks", pos: "LB", reg: "League Reg", starts: 11, sub: 0, goals: 1, status: "Available" },
                                                    { name: "Liam Sterling", pos: "RW", reg: "Dual-Reg", starts: 5, sub: 6, goals: 8, status: "Available" },
                                                    { name: "Alex Cole", pos: "CM", reg: "League Reg", starts: 4, sub: 1, goals: 1, status: "Available" },
                                                    { name: "Sam Ward", pos: "CB", reg: "Loan (28d)", starts: 0, sub: 2, goals: 0, status: "Available" },
                                                ].map((row, i) => (
                                                    <tr key={i} className="hover:bg-zinc-50/80">
                                                        <td className="py-3 px-4 font-black text-[#171717]">{row.name}</td>
                                                        <td className="py-3 px-3">
                                                            <span className="px-2 py-0.5 rounded bg-[#f4f4f5] text-zinc-700 font-bold text-[10px]">
                                                                {row.pos}
                                                            </span>
                                                        </td>
                                                        <td className="py-3 px-3 text-zinc-600">{row.reg}</td>
                                                        <td className="py-3 px-3 text-center font-bold text-[#171717]">{row.starts}</td>
                                                        <td className="py-3 px-3 text-center text-zinc-600">{row.sub}</td>
                                                        <td className="py-3 px-3 text-center font-black text-[#e11d48]">{row.goals}</td>
                                                        <td className="py-3 px-4 text-right">
                                                            <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                                                                {row.status}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </section>

            {/* ================================================================= */}
            {/* FEATURES + REAL MOBILE SCREENSHOTS (MATCHING APPSHELL MOBILE)     */}
            {/* ================================================================= */}
            <section id="features" className="relative z-10 py-16 border-t border-white/[0.08]">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-12">
                    <div className="text-center space-y-2 max-w-2xl mx-auto">
                        <span className="text-xs font-black uppercase tracking-widest text-[#e11d48]">
                            Built for Football Managers
                        </span>
                        <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                            Everything your club needs across the week.
                        </h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 text-left">
                        {[
                            {
                                icon: Trophy,
                                title: "League Table, Form Guide & PPG",
                                desc: "Keep track of your league table alongside points-per-game (PPG), home and away splits, and a visual 5-match form guide for every team.",
                            },
                            {
                                icon: ClipboardCheck,
                                title: "Plan the Week & Training Attendance",
                                desc: "Schedule training sessions, monitor player attendance rates across the season, and see who has been putting the work in before picking your XI.",
                            },
                            {
                                icon: Shield,
                                title: "Opposition Reports",
                                desc: "Build scouting reports on every team in your division—record their formation, key threats, set-piece habits, and head-to-head history.",
                            },
                            {
                                icon: Star,
                                title: "Recruitment & Trialist Pipeline",
                                desc: "Keep track of players you’ve watched across the season, manage trialists coming into training, and export your target list to Excel.",
                            },
                            {
                                icon: Shirt,
                                title: "Matchday XI & Squad Stats",
                                desc: "Build your starting XI and bench from available players, track starts, sub appearances, and goals, and export your team sheet graphic.",
                            },
                            {
                                icon: Gavel,
                                title: "Never Lose Track of Subs & Fines",
                                desc: "Most clubs lose hundreds of pounds a season in forgotten fines and unpaid match subs. Log every fine, monthly sub, and payment in seconds.",
                            },
                        ].map((card, i) => (
                            <div
                                key={i}
                                className="p-6 rounded-3xl border bg-slate-900/80 border-white/10 space-y-2.5"
                            >
                                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#e11d48]/15 text-[#e11d48]">
                                    <card.icon className="w-5 h-5" />
                                </div>
                                <h3 className="text-base sm:text-lg font-black text-white">{card.title}</h3>
                                <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">{card.desc}</p>
                            </div>
                        ))}
                    </div>

                    {/* ============================================================= */}
                    {/* REAL MOBILE VIEW SHOWCASE (EXACT APPSHELL LIGHT MOBILE UI)    */}
                    {/* ============================================================= */}
                    <div className="pt-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center bg-slate-900/60 border border-white/10 rounded-3xl p-6 sm:p-10">
                        <div className="lg:col-span-4 space-y-4 text-left">
                            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#e11d48]/15 text-rose-300 border border-[#e11d48]/30 text-xs font-bold">
                                <Smartphone className="w-3.5 h-3.5" /> Built for Mobile & Desktop
                            </span>
                            <h3 className="text-2xl sm:text-3xl font-black text-white leading-tight">
                                Exactly how ClubFlow looks on your phone.
                            </h3>
                            <p className="text-sm text-slate-400 leading-relaxed">
                                Switch between the Pitch, Bench, Squad, and Roles on Saturday afternoon, copy your
                                matchday details to WhatsApp in one tap, or use the quick <strong className="text-white">+</strong> button
                                to schedule matches, training, or new players on the go.
                            </p>
                        </div>

                        {/* Two Authentic Mobile Phone Screens Matching AppShell + Matchday XI + Dashboard */}
                        <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-6">
                            {/* PHONE 1: REAL MOBILE MATCHDAY XI SCREEN */}
                            <div className="rounded-[34px] bg-[#111111] border-[6px] border-zinc-800 shadow-2xl overflow-hidden flex flex-col text-left">
                                {/* Mobile AppShell Top Header (src/components/layout/app-shell.tsx lines 83-111) */}
                                <div className="h-12 bg-slate-900 px-3.5 flex items-center justify-between shrink-0">
                                    <div className="flex items-center gap-2.5">
                                        <div className="h-7 w-7 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold text-white">
                                            N
                                        </div>
                                        <span className="text-xs font-bold text-white truncate">
                                            Northbrook United
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2 text-slate-400">
                                        <Search className="h-4 w-4" />
                                        <Menu className="h-5 w-5" />
                                    </div>
                                </div>

                                {/* Light Canvas Body (#FCFCFD) */}
                                <div className="bg-[#fcfcfd] p-3 space-y-2.5 flex-1 relative text-[#171717]">
                                    {/* Mobile 4-Tab Bar (Pitch | Bench | Squad | Roles) from src/app/matchday-xi/page.tsx line 3616 */}
                                    <div className="grid grid-cols-4 gap-1 bg-white p-1 rounded-xl border border-[#eaeaea] text-[10px] font-extrabold text-center">
                                        <div className="py-1.5 rounded-lg bg-[#e11d48] text-white shadow-2xs">
                                            Pitch
                                        </div>
                                        <div className="py-1.5 text-zinc-500">Bench 5</div>
                                        <div className="py-1.5 text-zinc-500">Squad 18</div>
                                        <div className="py-1.5 text-zinc-500">Roles 3</div>
                                    </div>

                                    <div className="flex items-center justify-between">
                                        <div>
                                            <div className="text-[11px] font-extrabold text-[#171717]">Starting XI</div>
                                            <div className="text-[9px] text-zinc-500">11 / 11 Selected</div>
                                        </div>
                                        <div className="px-2 py-0.5 rounded-lg bg-white border border-[#eaeaea] text-[10px] font-bold text-[#171717]">
                                            4-3-3 ▾
                                        </div>
                                    </div>

                                    {/* Mobile Green Pitch (#2b7c3d) with SVG Collared Shirts */}
                                    <div className="relative w-full h-[230px] bg-[#2b7c3d] rounded-xl shadow-md overflow-hidden">
                                        <div className="absolute inset-1.5 border border-white/40 pointer-events-none" />
                                        <div className="absolute left-1.5 right-1.5 top-1/2 border-t border-white/40 pointer-events-none" />
                                        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 border border-white/40 rounded-full pointer-events-none" />
                                        {[
                                            { x: 50, y: 88, name: "Fletcher", num: 1, gk: true },
                                            { x: 16, y: 68, name: "Brooks", num: 3 },
                                            { x: 38, y: 72, name: "Gallagher", num: 5, capt: true },
                                            { x: 62, y: 72, name: "Ward", num: 6 },
                                            { x: 84, y: 68, name: "Palmer", num: 2 },
                                            { x: 50, y: 52, name: "Cole", num: 4 },
                                            { x: 30, y: 39, name: "Barker", num: 8 },
                                            { x: 70, y: 39, name: "Vance", num: 10 },
                                            { x: 20, y: 18, name: "Maddox", num: 11 },
                                            { x: 50, y: 14, name: "Mercer", num: 9 },
                                            { x: 80, y: 18, name: "Sterling", num: 7 },
                                        ].map((p, i) => (
                                            <PitchJerseyNode
                                                key={i}
                                                x={p.x}
                                                y={p.y}
                                                number={p.num}
                                                name={p.name}
                                                kitColor={p.gk ? "#10b981" : "#e11d48"}
                                                isCaptain={p.capt}
                                                compact
                                            />
                                        ))}
                                    </div>

                                    {/* Mobile Quick Bench Strip under Pitch */}
                                    <div className="bg-white rounded-xl border border-[#eaeaea] p-2 flex items-center justify-between text-[10px]">
                                        <span className="font-extrabold text-[#171717]">Substitutes Bench (5/5)</span>
                                        <span className="text-[#e11d48] font-bold">Sub Mins & Details →</span>
                                    </div>

                                    {/* Floating Universal Add FAB Button (src/components/layout/app-shell.tsx line 178) */}
                                    <div className="absolute bottom-3 right-3 h-9 w-9 rounded-full bg-[#e11d48] text-white flex items-center justify-center shadow-lg">
                                        <Plus className="h-4 w-4" />
                                    </div>
                                </div>

                                {/* Mobile Bottom Navigation Bar (src/components/layout/app-shell.tsx lines 189-230) */}
                                <div className="h-12 bg-slate-900 border-t border-slate-800 flex items-center justify-around text-[9px] font-medium shrink-0">
                                    <div className="flex flex-col items-center gap-0.5 text-slate-400">
                                        <LayoutDashboard className="h-4 w-4" />
                                        <span>Dashboard</span>
                                    </div>
                                    <div className="flex flex-col items-center gap-0.5 text-red-500 font-semibold">
                                        <Users className="h-4 w-4" />
                                        <span>Squad</span>
                                    </div>
                                    <div className="flex flex-col items-center gap-0.5 text-slate-400">
                                        <Activity className="h-4 w-4" />
                                        <span>Fixtures</span>
                                    </div>
                                    <div className="flex flex-col items-center gap-0.5 text-slate-400">
                                        <CreditCard className="h-4 w-4" />
                                        <span>Billing</span>
                                    </div>
                                </div>
                            </div>

                            {/* PHONE 2: REAL MOBILE DASHBOARD SCREEN */}
                            <div className="rounded-[34px] bg-[#111111] border-[6px] border-zinc-800 shadow-2xl overflow-hidden flex flex-col text-left">
                                {/* Mobile AppShell Top Header */}
                                <div className="h-12 bg-slate-900 px-3.5 flex items-center justify-between shrink-0">
                                    <div className="flex items-center gap-2.5">
                                        <div className="h-7 w-7 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold text-white">
                                            N
                                        </div>
                                        <span className="text-xs font-bold text-white truncate">
                                            Northbrook United
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2 text-slate-400">
                                        <Search className="h-4 w-4" />
                                        <Menu className="h-5 w-5" />
                                    </div>
                                </div>

                                {/* Light Canvas Body (#FCFCFD) */}
                                <div className="bg-[#fcfcfd] p-3 space-y-2.5 flex-1 relative text-[#171717]">
                                    {/* Club Header Card (src/app/dashboard/page.tsx line 811) */}
                                    <div className="bg-white border border-[#eaeaea] rounded-xl p-3 space-y-2.5 shadow-2xs">
                                        <div className="flex items-center gap-2.5">
                                            <div className="h-9 w-9 rounded-lg bg-[#e11d48]/10 border border-[#e11d48]/20 flex items-center justify-center shrink-0">
                                                <Trophy className="h-4 w-4 text-[#e11d48]" />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-xs font-black text-[#171717]">
                                                        Northbrook United
                                                    </span>
                                                    <span className="px-1.5 py-0.2 rounded-full bg-[#e11d48]/15 text-[#e11d48] text-[9px] font-extrabold">
                                                        #1st
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-1 mt-1">
                                                    <span className="text-[8px] font-bold uppercase text-zinc-400">
                                                        Form:
                                                    </span>
                                                    {["W", "W", "D", "W", "W"].map((r, i) => (
                                                        <span
                                                            key={i}
                                                            className={`w-3.5 h-3.5 rounded text-[8px] font-black text-white flex items-center justify-center ${
                                                                r === "W" ? "bg-emerald-500" : "bg-amber-500"
                                                            }`}
                                                        >
                                                            {r}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-1.5 pt-2 border-t border-[#eaeaea] text-[9px]">
                                            <div className="bg-[#f4f4f5] border border-[#eaeaea] rounded-lg p-1.5">
                                                <div className="text-zinc-500 font-bold uppercase">Home Split</div>
                                                <div className="font-extrabold text-[#171717]">
                                                    6W-0D-0L <span className="text-emerald-600">(3.0 PPG)</span>
                                                </div>
                                            </div>
                                            <div className="bg-[#f4f4f5] border border-[#eaeaea] rounded-lg p-1.5">
                                                <div className="text-zinc-500 font-bold uppercase">Away Split</div>
                                                <div className="font-extrabold text-[#171717]">
                                                    4W-1D-1L <span className="text-sky-600">(2.1 PPG)</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Needs Attention Item (src/app/dashboard/page.tsx line 906) */}
                                    <div className="bg-amber-500/5 border border-amber-500/30 rounded-xl p-2.5 flex items-center justify-between">
                                        <div className="min-w-0">
                                            <div className="text-[10px] font-bold text-[#171717] flex items-center gap-1">
                                                <AlertCircle className="h-3 w-3 text-amber-500 shrink-0" />
                                                <span>3 Unpaid Match Subs (£15)</span>
                                            </div>
                                            <div className="text-[9px] text-zinc-500">From Saturday vs Meadowbank</div>
                                        </div>
                                        <span className="px-2 py-1 rounded-md bg-white border border-[#eaeaea] text-[9px] font-bold text-[#171717]">
                                            Open →
                                        </span>
                                    </div>

                                    {/* Next Match Card (src/app/dashboard/page.tsx line 965) */}
                                    <div className="bg-white border border-[#eaeaea] rounded-xl p-3 space-y-2 shadow-2xs">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[9px] font-extrabold uppercase text-[#e11d48] flex items-center gap-1">
                                                <Zap className="h-3 w-3 fill-[#e11d48]" /> Next Match
                                            </span>
                                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-700">
                                                HOME
                                            </span>
                                        </div>
                                        <div className="text-sm font-black text-[#171717]">
                                            vs Kingswood Athletic (#8)
                                        </div>
                                        <div className="text-[10px] text-zinc-500">
                                            Sat 31 Oct • KO 15:00 • Northbrook Park
                                        </div>
                                        <div className="grid grid-cols-2 gap-1.5 pt-1.5 border-t border-[#eaeaea]">
                                            <div className="py-1.5 rounded-lg border border-[#eaeaea] text-center text-[9px] font-bold text-[#171717]">
                                                📋 WhatsApp Copy
                                            </div>
                                            <div className="py-1.5 rounded-lg bg-[#e11d48] text-center text-[9px] font-bold text-white">
                                                👕 Matchday XI
                                            </div>
                                        </div>
                                    </div>

                                    {/* Floating Universal Add FAB Button */}
                                    <div className="absolute bottom-3 right-3 h-9 w-9 rounded-full bg-[#e11d48] text-white flex items-center justify-center shadow-lg">
                                        <Plus className="h-4 w-4" />
                                    </div>
                                </div>

                                {/* Mobile Bottom Navigation Bar */}
                                <div className="h-12 bg-slate-900 border-t border-slate-800 flex items-center justify-around text-[9px] font-medium shrink-0">
                                    <div className="flex flex-col items-center gap-0.5 text-red-500 font-semibold">
                                        <LayoutDashboard className="h-4 w-4" />
                                        <span>Dashboard</span>
                                    </div>
                                    <div className="flex flex-col items-center gap-0.5 text-slate-400">
                                        <Users className="h-4 w-4" />
                                        <span>Squad</span>
                                    </div>
                                    <div className="flex flex-col items-center gap-0.5 text-slate-400">
                                        <Activity className="h-4 w-4" />
                                        <span>Fixtures</span>
                                    </div>
                                    <div className="flex flex-col items-center gap-0.5 text-slate-400">
                                        <CreditCard className="h-4 w-4" />
                                        <span>Billing</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ================================================================= */}
            {/* FINAL CTA                                                         */}
            {/* ================================================================= */}
            <section className="relative z-10 py-20 px-4 sm:px-6">
                <div className="max-w-4xl mx-auto rounded-3xl border border-white/15 p-8 sm:p-12 text-center space-y-6 shadow-2xl bg-gradient-to-br from-[#e11d48]/20 via-[#0b0f19] to-[#0b0f19]">
                    <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight">
                        Ready to set up your club?
                    </h2>
                    <p className="text-sm sm:text-base text-slate-300 max-w-xl mx-auto">
                        Create your club hub, upload your badge, and get your squad and season organised in minutes.
                    </p>
                    <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
                        <Link
                            href="/signup"
                            className="px-8 py-4 rounded-xl font-black text-sm text-white bg-[#e11d48] hover:bg-[#be123c] shadow-xl transition-all hover:scale-[1.02] flex items-center gap-2"
                        >
                            Create Your Club <ArrowRight className="w-4 h-4" />
                        </Link>
                        <Link
                            href="/login"
                            className="px-7 py-4 rounded-xl font-bold text-sm bg-slate-900/90 hover:bg-slate-800 text-slate-200 border border-white/15 transition-all"
                        >
                            Sign In
                        </Link>
                    </div>
                </div>
            </section>

            {/* ================================================================= */}
            {/* FOOTER                                                            */}
            {/* ================================================================= */}
            <footer className="relative z-10 border-t border-white/[0.08] py-10 px-6 bg-[#060911] text-xs">
                <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-6">
                    <div className="flex items-center gap-3">
                        <span className="h-7 w-7 rounded-lg flex items-center justify-center font-black text-white text-xs bg-[#e11d48]">
                            CF
                        </span>
                        <span className="font-black tracking-tight text-white text-base">ClubFlow</span>
                        <span className="text-slate-500">•</span>
                        <span className="text-slate-400">www.clubflow.org.uk</span>
                    </div>

                    <div className="flex items-center gap-6 text-slate-400 font-semibold">
                        <a href="#preview" className="hover:text-white transition-colors">
                            Inside the App
                        </a>
                        <a href="#features" className="hover:text-white transition-colors">
                            Features
                        </a>
                        <Link href="/login" className="hover:text-white transition-colors">
                            Sign In
                        </Link>
                        <Link href="/signup" className="text-white hover:underline">
                            Sign Up
                        </Link>
                    </div>
                </div>
            </footer>
        </div>
    );
}