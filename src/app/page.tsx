"use client";

import { useState } from "react";
import Link from "next/link";
import {
    Sparkles,
    ArrowRight,
    Shield,
    Users,
    FileSpreadsheet,
    LayoutDashboard,
    Calendar,
    CheckCircle2,
    Trophy,
    Shirt,
    Search,
    Download,
    Share2,
    Clock,
    MapPin,
    Star,
    Smartphone,
    Monitor,
    Zap,
    ClipboardPaste,
    UserPlus,
    Gavel,
    Eye,
    Layers,
    Check,
    Flame,
    Compass,
} from "lucide-react";

type ClubThemePreset = {
    id: string;
    name: string;
    clubLabel: string;
    primary: string;
    secondary: string;
    gk: string;
    badgeBg: string;
};

const CLUB_THEMES: ClubThemePreset[] = [
    {
        id: "camden",
        name: "Camden Crimson",
        clubLabel: "Camden United",
        primary: "#e11d48",
        secondary: "#0f172a",
        gk: "#10b981",
        badgeBg: "rgba(225,29,72,0.14)",
    },
    {
        id: "royal",
        name: "Royal Blue",
        clubLabel: "Highgate Albion",
        primary: "#2563eb",
        secondary: "#ffffff",
        gk: "#f59e0b",
        badgeBg: "rgba(37,99,235,0.14)",
    },
    {
        id: "emerald",
        name: "Emerald Athletic",
        clubLabel: "Hackney Wick FC",
        primary: "#10b981",
        secondary: "#064e3b",
        gk: "#eab308",
        badgeBg: "rgba(16,185,129,0.14)",
    },
    {
        id: "amber",
        name: "Gold & Obsidian",
        clubLabel: "Islington Borough",
        primary: "#f59e0b",
        secondary: "#0f172a",
        gk: "#06b6d4",
        badgeBg: "rgba(245,158,11,0.14)",
    },
    {
        id: "claret",
        name: "Claret & Sky",
        clubLabel: "Sporting Duet XI",
        primary: "#9f1239",
        secondary: "#38bdf8",
        gk: "#22c55e",
        badgeBg: "rgba(159,18,57,0.18)",
    },
];

type WorkspaceTabId = "dashboard" | "matches" | "matchday-xi" | "squad" | "recruitment" | "fulltime";

interface HotspotPin {
    id: string;
    x: number;
    y: number;
    title: string;
    detail: string;
}

const WORKSPACE_TABS: {
    id: WorkspaceTabId;
    label: string;
    badge: string;
    url: string;
    headline: string;
    desc: string;
    hotspots: HotspotPin[];
}[] = [
    {
        id: "dashboard",
        label: "Club Pulse Dashboard",
        badge: "Mission Control",
        url: "clubflow.org.uk/dashboard",
        headline: "Every matchday priority, form guide & leaderboard in one glance.",
        desc: "See your live league standing, recent 5-match form, next fixture countdown with meet-time calculator, top goalscorers, and automated action priorities.",
        hotspots: [
            {
                id: "h1",
                x: 24,
                y: 22,
                title: "Live League Standing & Form Guide",
                detail: "Automatically links your current table rank (#1st) and last 5 competitive results (W-W-W-D-W).",
            },
            {
                id: "h2",
                x: 68,
                y: 42,
                title: "Next Match Hub & WhatsApp Copy",
                detail: "Displays opponent rank (#8 Stonewall), automatic meet time (13:30 for 15:00 KO), and 1-tap WhatsApp poll copy.",
            },
            {
                id: "h3",
                x: 35,
                y: 78,
                title: "Season Leaderboards",
                detail: "Tracks Top Goalscorer (M. Santana — 22G), Assists, Starts, and Sub Appearances across League and Cups.",
            },
        ],
    },
    {
        id: "matches",
        label: "Fixtures & Results",
        badge: "Real Screenshot",
        url: "clubflow.org.uk/matches",
        headline: "Clean fixture management with opponent search, weather & saved lineups.",
        desc: "Search any historical or upcoming opponent instantly, expand saved 4-3-3 lineups inline, log scorers and cards, and keep Quick-Add neatly tucked away until needed.",
        hotspots: [
            {
                id: "m1",
                x: 60,
                y: 18,
                title: "1-Click Matchday Actions",
                detail: "Jump straight to Matchday XI, Opposition Scouting Report, or Log Result / Scorers from the Next Match banner.",
            },
            {
                id: "m2",
                x: 74,
                y: 44,
                title: "Dedicated Opponent Search",
                detail: "Filter all 29+ season fixtures and results by opponent, competition (League, Cups, Friendlies), or season.",
            },
            {
                id: "m3",
                x: 49,
                y: 88,
                title: "Inline Saved Lineup Preview",
                detail: "View the exact starting XI and formation used in any match without leaving the fixtures page.",
            },
        ],
    },
    {
        id: "matchday-xi",
        label: "Matchday XI & Pitch Export",
        badge: "Tactics Studio",
        url: "clubflow.org.uk/matchday-xi",
        headline: "Build your starting XI and export opponent-named PDF & PNG matchsheets.",
        desc: "Switch between 1–11 traditional matchday shirt numbering or fixed squad numbers, drag players onto the pitch, manage your subs bench, and export branded graphics.",
        hotspots: [
            {
                id: "x1",
                x: 50,
                y: 35,
                title: "1–11 vs Squad Numbering Toggle",
                detail: "Automatically numbers your starting XI 1–11 for non-league matchsheets or preserves season squad numbers.",
            },
            {
                id: "x2",
                x: 82,
                y: 25,
                title: "Smart File Naming on Export",
                detail: "Exports automatically as Matchsheet-vs-Stonewall-31-10-2026.pdf or .png ready for WhatsApp & social media.",
            },
        ],
    },
    {
        id: "squad",
        label: "Squad & Appearances",
        badge: "Roster & Stats",
        url: "clubflow.org.uk/squad",
        headline: "Full appearance breakdowns, loan tracking & former player archive.",
        desc: "Track Starts, Sub Appearances, Unused Sub logs, Goals, Cards, Medical Status, Loan/Dual-Registration expiry alerts, and preserve history when players leave.",
        hotspots: [
            {
                id: "s1",
                x: 62,
                y: 30,
                title: "Starts vs Sub Appearances Sync",
                detail: "Syncs directly with FA Full-Time / Mitoo player appearance tables and saved Matchday XI lineups.",
            },
            {
                id: "s2",
                x: 28,
                y: 68,
                title: "Loan, Dual-Reg & Former Players",
                detail: "Tag parent/subordinate loan clubs with expiry reminders, and archive departed players without losing stats.",
            },
        ],
    },
    {
        id: "recruitment",
        label: "Recruitment Black Book",
        badge: "Scouting & Excel",
        url: "clubflow.org.uk/recruitment",
        headline: "Your permanent manager’s Black Book with positional matrix & Excel export.",
        desc: "Build a year-round scouting database across clubs you manage. Track trialists, star ratings, positional depth gaps, and export a 3-tab formatted Excel workbook.",
        hotspots: [
            {
                id: "r1",
                x: 30,
                y: 24,
                title: "Positional Needs Matrix",
                detail: "Highlights where your current squad is thin (e.g. LB, CDM) and filters your Black Book targets to match.",
            },
            {
                id: "r2",
                x: 80,
                y: 20,
                title: "3-Tab Formatted Excel (.xlsx) Export",
                detail: "Downloads All Targets, Positional Matrix, and Priority Shortlist with auto-sized columns for committee meetings.",
            },
        ],
    },
    {
        id: "fulltime",
        label: "FA Full-Time & Mitoo Sync",
        badge: "Zero Manual Entry",
        url: "clubflow.org.uk/league",
        headline: "Copy-paste from FA Full-Time or Football Mitoo in under 10 seconds.",
        desc: "No more typing out fixtures or league tables by hand. Paste your division table, fixture schedule, or player appearances once and let ClubFlow sync the rest.",
        hotspots: [
            {
                id: "f1",
                x: 45,
                y: 45,
                title: "Universal League & Appearances Parser",
                detail: "Works with FA Full-Time, Football Mitoo, and Pitchero—syncing standings, opponent clubs, and player starts.",
            },
        ],
    },
];

export default function LandingPage() {
    const [selectedTheme, setSelectedTheme] = useState<ClubThemePreset>(CLUB_THEMES[0]);
    const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceTabId>("dashboard");
    const [showHotspots, setShowHotspots] = useState<boolean>(true);
    const [activeHotspotId, setActiveHotspotId] = useState<string | null>("h1");
    const [numberingMode, setNumberingMode] = useState<"1-11" | "squad">("1-11");
    const [activeRoleTab, setActiveRoleTab] = useState<"manager" | "secretary" | "coach">("manager");
    const [pasteSimulated, setPasteSimulated] = useState<boolean>(true);

    const currentTabObj = WORKSPACE_TABS.find((t) => t.id === activeWorkspace) || WORKSPACE_TABS[0];

    return (
        <div className="bg-[#060911] text-slate-100 min-h-screen font-sans selection:bg-rose-500/30 selection:text-rose-300 overflow-x-hidden antialiased relative">
            {/* ================================================================= */}
            {/* ARCHITECTURAL PITCH-GRID & AMBIENT MESH BACKGROUND                */}
            {/* ================================================================= */}
            <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
                {/* Dynamic Club Color Ambient Orbs */}
                <div
                    className="absolute -top-48 left-1/2 -translate-x-1/2 w-[980px] h-[540px] rounded-full blur-[160px] opacity-20 transition-colors duration-700"
                    style={{ backgroundColor: selectedTheme.primary }}
                />
                <div
                    className="absolute top-[38%] -left-48 w-[520px] h-[520px] rounded-full blur-[170px] opacity-10 transition-colors duration-700"
                    style={{ backgroundColor: selectedTheme.gk }}
                />
                <div
                    className="absolute bottom-0 right-0 w-[600px] h-[600px] rounded-full blur-[180px] opacity-15 transition-colors duration-700"
                    style={{ backgroundColor: selectedTheme.primary }}
                />

                {/* Subtle Dot Matrix Texture */}
                <div
                    className="absolute inset-0 opacity-[0.16]"
                    style={{
                        backgroundImage:
                            "radial-gradient(rgba(255,255,255,0.18) 1px, transparent 1px)",
                        backgroundSize: "28px 28px",
                    }}
                />

                {/* Architectural SVG Football Pitch Geometry Lines */}
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
            {/* REFINED GLASSMORPHIC NAVBAR                                       */}
            {/* ================================================================= */}
            <nav className="fixed top-0 left-0 right-0 z-50 bg-[#060911]/80 backdrop-blur-xl border-b border-white/[0.08] px-4 sm:px-8 py-3.5">
                <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
                    <div className="flex items-center gap-8">
                        <Link href="/" className="flex items-center gap-2.5 group">
                            <div
                                className="h-9 w-9 rounded-xl flex items-center justify-center font-black text-white text-sm shadow-lg transition-colors duration-500 border border-white/20"
                                style={{ backgroundColor: selectedTheme.primary }}
                            >
                                CF
                            </div>
                            <div className="flex flex-col">
                                <span className="font-black text-lg tracking-tight text-white leading-none">
                                    ClubFlow
                                </span>
                                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                                    Football OS
                                </span>
                            </div>
                        </Link>

                        <div className="hidden lg:flex items-center gap-7 text-xs font-bold uppercase tracking-wider text-slate-400">
                            <a href="#workspaces" className="hover:text-white transition-colors">
                                Live Workspaces
                            </a>
                            <a href="#fulltime-sync" className="hover:text-white transition-colors">
                                FA Full-Time Sync
                            </a>
                            <a href="#desktop-mobile" className="hover:text-white transition-colors">
                                Desktop & Dugout
                            </a>
                            <a href="#exports" className="hover:text-white transition-colors">
                                Matchsheets & Excel
                            </a>
                            <a href="#features" className="hover:text-white transition-colors">
                                All Modules
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
                            className="px-4 py-2.5 rounded-xl text-white font-black shadow-lg transition-all hover:opacity-95 flex items-center gap-1.5"
                            style={{ backgroundColor: selectedTheme.primary }}
                        >
                            Start Your Club <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                    </div>
                </div>
            </nav>

            {/* ================================================================= */}
            {/* HERO SECTION WITH LIVE CLUB THEME SWITCHER & LAYERED FRAMES       */}
            {/* ================================================================= */}
            <header className="relative z-10 pt-28 pb-20 md:pt-36 md:pb-28 px-4 sm:px-6">
                <div className="max-w-6xl mx-auto text-center space-y-6 flex flex-col items-center">
                    {/* Top Pill */}
                    <div className="inline-flex flex-wrap items-center justify-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.05] border border-white/10 text-xs font-bold text-slate-200 backdrop-blur-md">
                        <span
                            className="w-2 h-2 rounded-full animate-pulse"
                            style={{ backgroundColor: selectedTheme.primary }}
                        />
                        <span>Built for Step 3–7, County, Sunday League & Academy Clubs</span>
                        <span className="text-slate-500">•</span>
                        <span className="text-emerald-400 font-extrabold">2026/27 Season Ready</span>
                    </div>

                    {/* Headline */}
                    <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight text-white max-w-4xl leading-[1.04]">
                        Run your football club like a{" "}
                        <span
                            className="bg-clip-text text-transparent transition-all duration-500"
                            style={{
                                backgroundImage: `linear-gradient(135deg, #ffffff 15%, ${selectedTheme.primary} 100%)`,
                            }}
                        >
                            modern dugout.
                        </span>
                    </h1>

                    {/* Subheadline */}
                    <p className="text-base sm:text-lg md:text-xl text-slate-400 max-w-3xl leading-relaxed">
                        From <strong className="text-slate-200">1-click FA Full-Time & Mitoo imports</strong> and{" "}
                        <strong className="text-slate-200">Matchday XI pitch graphics</strong> to your permanent{" "}
                        <strong className="text-slate-200">Manager’s Recruitment Black Book</strong> and{" "}
                        <strong className="text-slate-200">WhatsApp squad polls</strong>—everything in one clean hub.
                    </p>

                    {/* Primary CTAs */}
                    <div className="flex flex-wrap items-center justify-center gap-3.5 pt-2">
                        <Link
                            href="/signup"
                            className="px-7 py-3.5 rounded-xl font-black text-sm text-white shadow-xl transition-all hover:scale-[1.02] flex items-center gap-2"
                            style={{ backgroundColor: selectedTheme.primary }}
                        >
                            Create Your Club Hub <ArrowRight className="w-4 h-4" />
                        </Link>
                        <a
                            href="#workspaces"
                            className="px-6 py-3.5 rounded-xl font-bold text-sm bg-white/[0.06] hover:bg-white/[0.1] text-white border border-white/10 transition-all"
                        >
                            Explore Live Screenshots
                        </a>
                        <Link
                            href="/login"
                            className="px-5 py-3.5 rounded-xl font-bold text-sm text-slate-400 hover:text-white transition-colors"
                        >
                            Existing Club Sign In →
                        </Link>
                    </div>

                    {/* Interactive Club Color & Kit Theme Switcher */}
                    <div className="pt-3 flex flex-wrap items-center justify-center gap-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mr-1">
                            Preview in your club colors:
                        </span>
                        {CLUB_THEMES.map((theme) => {
                            const active = selectedTheme.id === theme.id;
                            return (
                                <button
                                    key={theme.id}
                                    type="button"
                                    onClick={() => setSelectedTheme(theme)}
                                    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
                                        active
                                            ? "bg-white text-slate-950 border-white shadow-md scale-105"
                                            : "bg-slate-900/80 text-slate-300 border-white/10 hover:border-white/30"
                                    }`}
                                >
                                    <span
                                        className="w-3 h-3 rounded-full border border-black/20"
                                        style={{ backgroundColor: theme.primary }}
                                    />
                                    {theme.name}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* ============================================================= */}
                {/* HERO SHOWCASE: DESKTOP APP WINDOW + FLOATING MOBILE DUGOUT    */}
                {/* ============================================================= */}
                <div className="max-w-6xl mx-auto mt-12 relative">
                    {/* Desktop Browser Window Frame (Mirrors Actual Light/Dark ClubFlow App) */}
                    <div className="rounded-2xl sm:rounded-3xl overflow-hidden border border-white/15 shadow-[0_25px_100px_-15px_rgba(0,0,0,0.85)] bg-[#0b0f19]">
                        {/* macOS Window Chrome */}
                        <div className="h-9 bg-[#0b0f19] border-b border-white/10 px-4 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f56]" />
                                <span className="h-2.5 w-2.5 rounded-full bg-[#ffbd2e]" />
                                <span className="h-2.5 w-2.5 rounded-full bg-[#27c93f]" />
                                <span className="ml-2 text-[11px] text-slate-400 font-semibold hidden sm:inline">
                                    {selectedTheme.clubLabel} — Data Hub
                                </span>
                            </div>
                            <div className="px-3 py-0.5 rounded-md bg-white/[0.05] border border-white/10 text-[10px] text-slate-300 font-mono">
                                www.clubflow.org.uk/matches
                            </div>
                            <div className="flex items-center gap-1.5">
                                <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded">
                                    ● Live Sync
                                </span>
                            </div>
                        </div>

                        {/* Authentic App Shell: Dark Left Sidebar + Crisp Light Workspace */}
                        <div className="grid grid-cols-12 min-h-[460px] bg-[#f8fafc] text-slate-900">
                            {/* Left Sidebar */}
                            <div className="hidden md:flex md:col-span-3 lg:col-span-2 bg-[#0b0f19] text-slate-300 p-3.5 flex-col justify-between border-r border-slate-800">
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2.5 px-2 py-1.5">
                                        <div
                                            className="w-7 h-7 rounded-lg flex items-center justify-center font-black text-white text-xs shrink-0"
                                            style={{ backgroundColor: selectedTheme.primary }}
                                        >
                                            {selectedTheme.clubLabel.slice(0, 2).toUpperCase()}
                                        </div>
                                        <div className="truncate">
                                            <div className="text-xs font-black text-white truncate">
                                                {selectedTheme.clubLabel}
                                            </div>
                                            <div className="text-[10px] text-emerald-400 font-bold">#1st • Premier Div</div>
                                        </div>
                                    </div>

                                    <div className="space-y-1 text-xs font-semibold">
                                        {[
                                            { label: "Dashboard", icon: LayoutDashboard, active: false },
                                            { label: "Squad Hub", icon: Users, active: false, count: "27" },
                                            { label: "Fixtures & Results", icon: Calendar, active: true, count: "29" },
                                            { label: "Matchday XI", icon: Shirt, active: false },
                                            { label: "Opposition", icon: Shield, active: false },
                                            { label: "League Table", icon: Trophy, active: false },
                                            { label: "Recruitment", icon: Star, active: false, badge: "New" },
                                        ].map((nav, i) => (
                                            <div
                                                key={i}
                                                className={`flex items-center justify-between px-2.5 py-2 rounded-xl transition-colors ${
                                                    nav.active
                                                        ? "text-white font-bold shadow-sm"
                                                        : "text-slate-400"
                                                }`}
                                                style={
                                                    nav.active
                                                        ? { backgroundColor: selectedTheme.primary }
                                                        : undefined
                                                }
                                            >
                                                <span className="flex items-center gap-2 truncate">
                                                    <nav.icon className="w-3.5 h-3.5 shrink-0" />
                                                    <span className="truncate">{nav.label}</span>
                                                </span>
                                                {nav.count && (
                                                    <span className="text-[10px] opacity-80">{nav.count}</span>
                                                )}
                                                {nav.badge && (
                                                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                                                        {nav.badge}
                                                    </span>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="p-2.5 rounded-xl bg-slate-900/90 border border-white/10 text-[10px] text-slate-400 space-y-1">
                                    <div className="font-bold text-white flex items-center justify-between">
                                        <span>FA Full-Time</span>
                                        <span className="text-emerald-400">Connected</span>
                                    </div>
                                    <div>27 Players • 19 Results Logged</div>
                                </div>
                            </div>

                            {/* Main Workspace Content (Mirrors Real Camden United vs Stonewall View) */}
                            <div className="col-span-12 md:col-span-9 lg:col-span-10 p-4 sm:p-6 space-y-4 bg-[#f8fafc] text-left">
                                {/* Next Match Hero Card inside App */}
                                <div
                                    className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs border-l-4"
                                    style={{ borderLeftColor: selectedTheme.primary }}
                                >
                                    <div className="flex flex-wrap items-center justify-between gap-4">
                                        <div className="space-y-2">
                                            <div className="flex items-center gap-2">
                                                <span
                                                    className="px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider text-white"
                                                    style={{ backgroundColor: selectedTheme.primary }}
                                                >
                                                    NEXT MATCH
                                                </span>
                                                <span className="text-xs font-bold uppercase text-rose-600">
                                                    • PREMIER DIVISION
                                                </span>
                                                <span className="px-2 py-0.5 rounded border border-slate-200 text-[10px] font-bold text-slate-600">
                                                    HOME
                                                </span>
                                            </div>

                                            <div className="flex flex-wrap items-center gap-2.5">
                                                <span className="text-xl sm:text-2xl font-black text-slate-900">
                                                    {selectedTheme.clubLabel}
                                                </span>
                                                <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-200 text-xs font-black">
                                                    #1
                                                </span>
                                                <span className="text-sm font-bold text-slate-400">VS</span>
                                                <span className="text-xl sm:text-2xl font-black text-slate-600">
                                                    Stonewall
                                                </span>
                                                <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-200 text-xs font-black">
                                                    #8
                                                </span>
                                            </div>

                                            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 font-medium">
                                                <span className="flex items-center gap-1">
                                                    <Calendar className="w-3.5 h-3.5" /> Sat 31 Oct
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <Clock className="w-3.5 h-3.5" /> KO 15:00
                                                </span>
                                                <span className="font-bold text-amber-600">• Meet 13:30</span>
                                                <span className="flex items-center gap-1">
                                                    <MapPin className="w-3.5 h-3.5" /> Home Ground
                                                </span>
                                                <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold text-[11px]">
                                                    Opposition Info: Pts: 14 • GD: -1
                                                </span>
                                            </div>
                                        </div>

                                        <div className="flex flex-wrap items-center gap-2">
                                            <span
                                                className="px-3.5 py-2 rounded-lg text-white text-xs font-bold flex items-center gap-1.5 shadow-xs"
                                                style={{ backgroundColor: selectedTheme.primary }}
                                            >
                                                <Shirt className="w-3.5 h-3.5" /> Matchday XI
                                            </span>
                                            <span className="px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-700 text-xs font-bold">
                                                Scouting Report
                                            </span>
                                            <span className="px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold">
                                                🏆 Log Result / Scorers
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Search & Filter Bar + Quick-Add Button */}
                                <div className="flex flex-wrap items-center justify-between gap-2 bg-white p-3 rounded-xl border border-slate-200">
                                    <div className="flex items-center gap-1.5">
                                        <span
                                            className="px-3 py-1 rounded-full text-white text-xs font-bold"
                                            style={{ backgroundColor: selectedTheme.primary }}
                                        >
                                            All (29)
                                        </span>
                                        <span className="px-3 py-1 rounded-full text-slate-600 text-xs font-bold">
                                            Upcoming (10)
                                        </span>
                                        <span className="px-3 py-1 rounded-full text-slate-600 text-xs font-bold">
                                            Results & Season Log (19)
                                        </span>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-500">
                                            <Search className="w-3.5 h-3.5" /> Search opponent...
                                        </div>
                                        <span className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-bold">
                                            + Quick-Add Fixture
                                        </span>
                                    </div>
                                </div>

                                {/* Bottom 2-Column Split inside App Preview: Recent Results & Top Scorers */}
                                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                                    <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 p-3.5 space-y-2.5">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">
                                                Recent Competitive Results & Lineups
                                            </span>
                                            <span className="text-[11px] font-bold text-emerald-600">
                                                Form: W • W • D • W • W
                                            </span>
                                        </div>
                                        {[
                                            {
                                                opp: "Stonewall",
                                                ha: "Away",
                                                score: "4 - 0",
                                                res: "W",
                                                scorers: "Santana (2), Abazi, Zeitoun",
                                                lineup: "4-3-3 Saved",
                                            },
                                            {
                                                opp: "Kodak (Harrow)",
                                                ha: "Home",
                                                score: "1 - 2",
                                                res: "L",
                                                scorers: "Hassan",
                                                lineup: "4-2-3-1 Saved",
                                            },
                                            {
                                                opp: "Sporting Duet M 1st XI",
                                                ha: "Away",
                                                score: "2 - 2",
                                                res: "D",
                                                scorers: "Santana, Moreno",
                                                lineup: "4-3-3 Saved",
                                            },
                                        ].map((m, idx) => (
                                            <div
                                                key={idx}
                                                className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-200/80 text-xs"
                                            >
                                                <div className="flex items-center gap-2.5">
                                                    <span
                                                        className={`w-6 h-6 rounded-md flex items-center justify-center font-black text-white text-[11px] ${
                                                            m.res === "W"
                                                                ? "bg-emerald-500"
                                                                : m.res === "D"
                                                                ? "bg-amber-500"
                                                                : "bg-rose-500"
                                                        }`}
                                                    >
                                                        {m.res}
                                                    </span>
                                                    <div>
                                                        <div className="font-bold text-slate-900">
                                                            vs {m.opp}{" "}
                                                            <span className="text-[10px] text-slate-400 font-normal">
                                                                ({m.ha})
                                                            </span>
                                                        </div>
                                                        <div className="text-[10px] text-slate-500">
                                                            ⚽ {m.scorers}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="px-2 py-0.5 rounded bg-white border border-slate-200 text-[10px] font-semibold text-slate-600">
                                                        📋 {m.lineup}
                                                    </span>
                                                    <span className="font-black text-slate-900 text-sm">
                                                        {m.score}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Squad Appearances & Goalscorers Mini Table */}
                                    <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 p-3.5 space-y-2.5">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">
                                                Squad Starts, Sub Apps & Goals
                                            </span>
                                            <span className="text-[10px] font-bold text-rose-600">26/27 Season</span>
                                        </div>
                                        {[
                                            { name: "M. Santana", pos: "ST", apps: "12 (0)", goals: 22 },
                                            { name: "R. Abazi", pos: "RW", apps: "5 (6)", goals: 8 },
                                            { name: "N. Zeitoun", pos: "CAM", apps: "5 (2)", goals: 6 },
                                            { name: "M. Hassan", pos: "LW", apps: "8 (1)", goals: 5 },
                                            { name: "K. Ali", pos: "CM", apps: "11 (0)", goals: 1 },
                                        ].map((p, idx) => (
                                            <div
                                                key={idx}
                                                className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-slate-50 text-xs border-b border-slate-100 last:border-0"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-bold text-[10px]">
                                                        {p.pos}
                                                    </span>
                                                    <span className="font-bold text-slate-900">{p.name}</span>
                                                </div>
                                                <div className="flex items-center gap-3 text-[11px]">
                                                    <span className="text-slate-500">
                                                        Apps: <strong className="text-slate-800">{p.apps}</strong>
                                                    </span>
                                                    <span
                                                        className="px-2 py-0.5 rounded-full font-black text-white"
                                                        style={{ backgroundColor: selectedTheme.primary }}
                                                    >
                                                        {p.goals}G
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Floating Mobile Pitchside Dugout Frame (Overlapping Bottom-Right on Desktop) */}
                    <div className="hidden xl:block absolute -bottom-10 -right-6 w-[290px] rounded-[32px] bg-[#0b0f19] border-4 border-slate-800 shadow-[0_25px_70px_rgba(0,0,0,0.9)] p-3 text-left z-20">
                        <div className="w-20 h-1.5 bg-slate-800 rounded-full mx-auto mb-2.5" />
                        <div className="rounded-2xl bg-[#111827] border border-white/10 p-3 space-y-2.5">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1">
                                    <Smartphone className="w-3 h-3" /> Pitchside Mobile View
                                </span>
                                <span className="text-[10px] text-slate-400">Sat 13:30</span>
                            </div>

                            <div
                                className="p-2.5 rounded-xl text-white space-y-1"
                                style={{ backgroundColor: selectedTheme.primary }}
                            >
                                <div className="text-[10px] font-bold uppercase opacity-90">
                                    Matchsheet Ready • 4-3-3
                                </div>
                                <div className="text-xs font-black">
                                    {selectedTheme.clubLabel} vs Stonewall
                                </div>
                                <div className="text-[10px] opacity-90">
                                    11 Starters • 5 Subs • 1–11 Numbered
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <div className="p-2 rounded-lg bg-slate-900 border border-white/10 flex items-center justify-between text-[11px]">
                                    <span className="text-slate-200 font-semibold">📋 Copy WhatsApp Poll</span>
                                    <span className="text-emerald-400 font-bold">Copied ✓</span>
                                </div>
                                <div className="p-2 rounded-lg bg-slate-900 border border-white/10 flex items-center justify-between text-[11px]">
                                    <span className="text-slate-200 font-semibold">⚡ Quick-Log Trialist</span>
                                    <span className="text-sky-400 font-bold">+ Black Book</span>
                                </div>
                                <div className="p-2 rounded-lg bg-slate-900 border border-white/10 flex items-center justify-between text-[11px]">
                                    <span className="text-slate-200 font-semibold">📥 Export Matchsheet</span>
                                    <span className="text-amber-400 font-bold">PDF / PNG</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            {/* ================================================================= */}
            {/* METRICS & PLATFORM PILLARS STRIP                                  */}
            {/* ================================================================= */}
            <section className="relative z-10 border-y border-white/[0.08] bg-slate-950/60 backdrop-blur-md py-8 px-6">
                <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
                    {[
                        {
                            stat: "15+ Modules",
                            label: "Squad, Matchday XI, Black Book, Opposition, League, Fines & Subs",
                        },
                        {
                            stat: "10-Second Sync",
                            label: "Paste fixtures, tables & appearances straight from FA Full-Time or Mitoo",
                        },
                        {
                            stat: "1-Click Exports",
                            label: "Opponent-named Matchsheet PDFs/PNGs & 3-tab Excel Recruitment sheets",
                        },
                        {
                            stat: "Multi-Staff Access",
                            label: "Share /join WhatsApp links with your Assistant, Coaches & Secretary",
                        },
                    ].map((item, i) => (
                        <div key={i} className="space-y-1">
                            <div className="text-xl sm:text-2xl font-black text-white">{item.stat}</div>
                            <p className="text-xs text-slate-400 leading-relaxed max-w-xs mx-auto">
                                {item.label}
                            </p>
                        </div>
                    ))}
                </div>
            </section>

            {/* ================================================================= */}
            {/* 6-TAB INTERACTIVE WORKSPACE TOUR + REAL SCREENSHOTS + HOTSPOTS    */}
            {/* ================================================================= */}
            <section id="workspaces" className="relative z-10 py-24 max-w-7xl mx-auto px-4 sm:px-6 space-y-10">
                <div className="text-center space-y-3 max-w-3xl mx-auto">
                    <span
                        className="text-xs font-black uppercase tracking-widest"
                        style={{ color: selectedTheme.primary }}
                    >
                        Interactive Workspace Tour
                    </span>
                    <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
                        See what’s actually inside ClubFlow.
                    </h2>
                    <p className="text-sm sm:text-base text-slate-400">
                        Click through the 6 core workspaces below and tap the pulsing hotspot pins to inspect how managers
                        run their week.
                    </p>
                </div>

                {/* 6 Workspace Selector Pills */}
                <div className="flex flex-wrap items-center justify-center gap-2">
                    {WORKSPACE_TABS.map((t) => {
                        const isActive = activeWorkspace === t.id;
                        return (
                            <button
                                key={t.id}
                                type="button"
                                onClick={() => {
                                    setActiveWorkspace(t.id);
                                    setActiveHotspotId(t.hotspots[0]?.id || null);
                                }}
                                className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold border transition-all flex items-center gap-2 ${
                                    isActive
                                        ? "bg-white text-slate-950 border-white shadow-lg"
                                        : "bg-slate-900/70 text-slate-300 border-white/10 hover:border-white/25 hover:text-white"
                                }`}
                            >
                                <span>{t.label}</span>
                                <span
                                    className={`text-[10px] px-2 py-0.5 rounded-full font-extrabold ${
                                        isActive
                                            ? "bg-slate-900 text-white"
                                            : "bg-white/10 text-slate-300"
                                    }`}
                                >
                                    {t.badge}
                                </span>
                            </button>
                        );
                    })}
                </div>

                {/* Active Workspace Header & Hotspot Toggle */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/60 border border-white/10 rounded-2xl p-5">
                    <div className="space-y-1">
                        <h3 className="text-lg sm:text-xl font-black text-white">{currentTabObj.headline}</h3>
                        <p className="text-xs sm:text-sm text-slate-400">{currentTabObj.desc}</p>
                    </div>
                    <button
                        type="button"
                        onClick={() => setShowHotspots((v) => !v)}
                        className="self-start md:self-center shrink-0 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-xs font-bold text-white flex items-center gap-2"
                    >
                        <Eye className="w-3.5 h-3.5 text-emerald-400" />
                        {showHotspots ? "Hide Feature Callouts" : "Show Feature Callouts"}
                    </button>
                </div>

                {/* Workspace Interactive Screen Frame */}
                <div className="relative rounded-2xl sm:rounded-3xl overflow-hidden border border-white/15 bg-[#0c101b] shadow-2xl">
                    {/* Browser Top Bar */}
                    <div className="h-9 bg-[#0c101b] border-b border-white/10 px-4 flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                            <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f56]" />
                            <span className="h-2.5 w-2.5 rounded-full bg-[#ffbd2e]" />
                            <span className="h-2.5 w-2.5 rounded-full bg-[#27c93f]" />
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono">{currentTabObj.url}</div>
                        <div className="text-[10px] text-slate-500 font-bold uppercase">Live Preview</div>
                    </div>

                    {/* WORKSPACE 1: DASHBOARD */}
                    {activeWorkspace === "dashboard" && (
                        <div className="p-5 sm:p-8 bg-[#f8fafc] text-slate-900 space-y-5">
                            <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                                <div className="flex items-center gap-3.5">
                                    <div
                                        className="w-12 h-12 rounded-2xl flex items-center justify-center font-black text-white text-lg"
                                        style={{ backgroundColor: selectedTheme.primary }}
                                    >
                                        {selectedTheme.clubLabel.slice(0, 2).toUpperCase()}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xl font-black text-slate-900">
                                                {selectedTheme.clubLabel}
                                            </span>
                                            <span className="px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-200 text-xs font-black">
                                                🏆 1st in League
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1.5 mt-1">
                                            <span className="text-[10px] font-bold uppercase text-slate-400">
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

                                <div className="flex items-center gap-3">
                                    <div className="px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                                        <span className="text-slate-400 font-bold mr-2">HOME:</span>
                                        <strong className="text-slate-800">9W - 1D - 1L</strong>
                                    </div>
                                    <div className="px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                                        <span className="text-slate-400 font-bold mr-2">AWAY:</span>
                                        <strong className="text-slate-800">6W - 2D - 0L</strong>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-2">
                                    <div className="text-[10px] font-black uppercase text-rose-600">
                                        TOP GOALSCORER
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <div className="text-base font-black text-slate-900">M. Santana</div>
                                            <div className="text-xs text-slate-500">12 Starts • 1.83 Goals/Game</div>
                                        </div>
                                        <div className="text-2xl font-black text-rose-600">22G</div>
                                    </div>
                                </div>
                                <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-2">
                                    <div className="text-[10px] font-black uppercase text-sky-600">
                                        MOST APPEARANCES
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <div className="text-base font-black text-slate-900">
                                                G. Montgomery & W. McCreeth
                                            </div>
                                            <div className="text-xs text-slate-500">100% Starting XI</div>
                                        </div>
                                        <div className="text-2xl font-black text-sky-600">12</div>
                                    </div>
                                </div>
                                <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-2">
                                    <div className="text-[10px] font-black uppercase text-emerald-600">
                                        NEXT FIXTURE COUNTDOWN
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <div className="text-base font-black text-slate-900">vs Stonewall (#8)</div>
                                            <div className="text-xs text-slate-500">Sat 15:00 • Meet 13:30</div>
                                        </div>
                                        <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-700 font-black text-xs">
                                            XI Ready
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* WORKSPACE 2: REAL SCREENSHOT OF MATCHES & FIXTURES */}
                    {activeWorkspace === "matches" && (
                        <div className="bg-[#f8fafc] overflow-hidden">
                            <img
                                src="/matches-live-screenshot.png"
                                alt="ClubFlow Fixtures & Results Live Screenshot"
                                className="w-full h-auto object-cover"
                            />
                        </div>
                    )}

                    {/* WORKSPACE 3: MATCHDAY XI & PITCH EXPORT */}
                    {activeWorkspace === "matchday-xi" && (
                        <div className="p-5 sm:p-8 bg-[#0b0f19] text-white grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                            <div className="lg:col-span-5 space-y-4 text-left">
                                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold">
                                    <Shirt className="w-3.5 h-3.5" /> Interactive Matchday XI Builder
                                </div>
                                <h4 className="text-2xl font-black text-white">
                                    Toggle 1–11 Matchday Numbers & Export Branded Team Sheets
                                </h4>
                                <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                                    Switch between traditional 1–11 matchday shirt numbers or season-long squad numbers.
                                    When you click export, ClubFlow automatically names your file after the opposition and
                                    match date:
                                </p>
                                <div className="p-3 rounded-xl bg-slate-900 border border-white/10 font-mono text-xs text-emerald-300">
                                    📄 Matchsheet-vs-Stonewall-31-10-2026.pdf
                                </div>

                                <div className="flex items-center gap-2 pt-2">
                                    <button
                                        type="button"
                                        onClick={() => setNumberingMode("1-11")}
                                        className={`px-3.5 py-2 rounded-xl text-xs font-bold border ${
                                            numberingMode === "1-11"
                                                ? "bg-white text-slate-950 border-white"
                                                : "bg-slate-900 text-slate-400 border-white/10"
                                        }`}
                                    >
                                        1–11 Matchday Numbers
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setNumberingMode("squad")}
                                        className={`px-3.5 py-2 rounded-xl text-xs font-bold border ${
                                            numberingMode === "squad"
                                                ? "bg-white text-slate-950 border-white"
                                                : "bg-slate-900 text-slate-400 border-white/10"
                                        }`}
                                    >
                                        Fixed Squad Numbers
                                    </button>
                                </div>
                            </div>

                            <div className="lg:col-span-7">
                                <div className="relative rounded-2xl overflow-hidden border border-emerald-500/30 bg-gradient-to-b from-emerald-950 via-emerald-900/90 to-emerald-950 aspect-[16/11] p-4 shadow-2xl">
                                    <div className="absolute inset-3 border border-white/20 rounded-xl pointer-events-none" />
                                    <div className="absolute left-3 right-3 top-1/2 border-t border-white/20 pointer-events-none" />

                                    {[
                                        { x: 50, y: 88, name: "Montgomery", num11: 1, sq: 1, gk: true },
                                        { x: 18, y: 68, name: "Amblin", num11: 3, sq: 18 },
                                        { x: 38, y: 72, name: "Clark", num11: 5, sq: 4 },
                                        { x: 62, y: 72, name: "McCreeth", num11: 6, sq: 5 },
                                        { x: 82, y: 68, name: "Murshid", num11: 2, sq: 22 },
                                        { x: 50, y: 52, name: "K. Ali", num11: 4, sq: 6 },
                                        { x: 32, y: 42, name: "Moreno", num11: 8, sq: 14 },
                                        { x: 68, y: 42, name: "Zeitoun", num11: 10, sq: 10 },
                                        { x: 22, y: 20, name: "Hassan", num11: 11, sq: 11 },
                                        { x: 50, y: 15, name: "Santana", num11: 9, sq: 9 },
                                        { x: 78, y: 20, name: "Abazi", num11: 7, sq: 7 },
                                    ].map((p, idx) => (
                                        <div
                                            key={idx}
                                            className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center"
                                            style={{ left: `${p.x}%`, top: `${p.y}%` }}
                                        >
                                            <div
                                                className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black text-white shadow-lg border-2 border-white"
                                                style={{
                                                    backgroundColor: p.gk
                                                        ? selectedTheme.gk
                                                        : selectedTheme.primary,
                                                }}
                                            >
                                                {numberingMode === "1-11" ? p.num11 : p.sq}
                                            </div>
                                            <span className="mt-0.5 px-2 py-0.2 rounded bg-slate-950/90 text-[10px] font-bold text-white border border-white/15">
                                                {p.name}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* WORKSPACE 4: SQUAD HUB & APPEARANCES */}
                    {activeWorkspace === "squad" && (
                        <div className="p-5 sm:p-8 bg-[#f8fafc] text-slate-900 space-y-4">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                    <span className="px-3 py-1 rounded-lg bg-slate-900 text-white text-xs font-bold">
                                        Active Squad (27)
                                    </span>
                                    <span className="px-3 py-1 rounded-lg bg-white border border-slate-200 text-slate-600 text-xs font-bold">
                                        Loan / Dual-Reg (3)
                                    </span>
                                    <span className="px-3 py-1 rounded-lg bg-white border border-slate-200 text-slate-600 text-xs font-bold">
                                        Former Players Archive (4)
                                    </span>
                                </div>
                                <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-lg">
                                    ✓ Synced with FA Full-Time Appearances
                                </span>
                            </div>

                            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                                <table className="w-full text-left text-xs">
                                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px] font-black">
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
                                    <tbody className="divide-y divide-slate-100 font-medium">
                                        {[
                                            { name: "M. Santana", pos: "ST", reg: "League Reg", starts: 12, sub: 0, goals: 22, status: "Available" },
                                            { name: "Kieran Ali", pos: "CM", reg: "League Reg", starts: 11, sub: 0, goals: 1, status: "Available" },
                                            { name: "R. Abazi", pos: "RW", reg: "Dual-Reg", starts: 5, sub: 6, goals: 8, status: "Available" },
                                            { name: "Sufi Yusuf Ali", pos: "CM", reg: "League Reg", starts: 4, sub: 1, goals: 1, status: "Available" },
                                            { name: "A. Elobeid", pos: "CB", reg: "Loan (28d)", starts: 0, sub: 2, goals: 0, status: "Available" },
                                        ].map((row, i) => (
                                            <tr key={i} className="hover:bg-slate-50/80">
                                                <td className="py-3 px-4 font-black text-slate-900">{row.name}</td>
                                                <td className="py-3 px-3">
                                                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-bold text-[10px]">
                                                        {row.pos}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-3 text-slate-600">{row.reg}</td>
                                                <td className="py-3 px-3 text-center font-bold text-slate-900">{row.starts}</td>
                                                <td className="py-3 px-3 text-center text-slate-600">{row.sub}</td>
                                                <td className="py-3 px-3 text-center font-black text-rose-600">{row.goals}</td>
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

                    {/* WORKSPACE 5: RECRUITMENT BLACK BOOK */}
                    {activeWorkspace === "recruitment" && (
                        <div className="p-5 sm:p-8 bg-[#0b0f19] text-white space-y-5">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <div className="space-y-1 text-left">
                                    <div className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                                        Manager’s Permanent Scouting Black Book
                                    </div>
                                    <div className="text-lg font-black text-white">
                                        Positional Depth Matrix, Trialist Pipeline & 3-Tab Excel Export
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="px-3.5 py-2 rounded-xl bg-emerald-500 text-slate-950 font-black text-xs flex items-center gap-1.5">
                                        <FileSpreadsheet className="w-4 h-4" /> Export Black Book (.xlsx)
                                    </span>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
                                {[
                                    {
                                        name: " Jayden Vance",
                                        pos: "LB / LWB",
                                        club: "Hendon U23",
                                        foot: "Left",
                                        rating: 5,
                                        stage: "Invite to Trial",
                                        note: "Rapid overlapping fullback, played Step 5 last season.",
                                    },
                                    {
                                        name: "Marcus Osei",
                                        pos: "CDM / CM",
                                        club: "Wingate & Finchley Res",
                                        foot: "Right",
                                        rating: 4,
                                        stage: "On Trial",
                                        note: "Strong ball-winner, trained Wednesday night — impressed.",
                                    },
                                    {
                                        name: "Tariq Lamptey-Smith",
                                        pos: "ST / RW",
                                        club: "Free Agent",
                                        foot: "Right",
                                        rating: 5,
                                        stage: "Priority Target",
                                        note: "18 goals in County Premier last year. Available immediately.",
                                    },
                                ].map((t, i) => (
                                    <div
                                        key={i}
                                        className="p-4 rounded-2xl bg-slate-900/90 border border-white/10 space-y-2.5"
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="px-2 py-0.5 rounded bg-white/10 text-white font-bold text-[10px]">
                                                {t.pos}
                                            </span>
                                            <span className="text-amber-400 text-xs font-black">
                                                {"★".repeat(t.rating)}
                                            </span>
                                        </div>
                                        <div>
                                            <div className="text-sm font-black text-white">{t.name}</div>
                                            <div className="text-[11px] text-slate-400">
                                                {t.club} • {t.foot} Foot
                                            </div>
                                        </div>
                                        <p className="text-xs text-slate-300 leading-relaxed">{t.note}</p>
                                        <div className="pt-1 flex items-center justify-between">
                                            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
                                                {t.stage}
                                            </span>
                                            <span className="text-[11px] font-bold text-sky-400">
                                                Promote to Squad →
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* WORKSPACE 6: FA FULL-TIME & MITOO PASTE SYNC */}
                    {activeWorkspace === "fulltime" && (
                        <div className="p-5 sm:p-8 bg-[#0b0f19] text-white grid grid-cols-1 lg:grid-cols-2 gap-6 text-left">
                            <div className="space-y-3">
                                <div className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                                    Step 1 • Copy & Paste from FA Full-Time or Mitoo
                                </div>
                                <div className="p-4 rounded-2xl bg-slate-950 border border-white/10 font-mono text-[11px] text-slate-300 space-y-1.5">
                                    <div className="text-slate-500">// Raw copy-paste from Mitoo / FA Full-Time:</div>
                                    <div>1  Camden United      12  10  1  1  34  11  +23  31</div>
                                    <div>2  Sporting Duet XI   12   8  3  1  26  12  +14  27</div>
                                    <div>3  Highgate Albion    12   7  2  3  22  15   +7  23</div>
                                    <div>8  Stonewall          11   4  2  5  16  17   -1  14</div>
                                </div>
                            </div>
                            <div className="space-y-3">
                                <div className="text-xs font-bold uppercase tracking-wider text-sky-400">
                                    Step 2 • Automatically Updates Standings & Opponents
                                </div>
                                <div className="p-4 rounded-2xl bg-slate-900 border border-emerald-500/30 space-y-2 text-xs">
                                    <div className="flex items-center justify-between text-emerald-300 font-bold">
                                        <span>✓ 12 Division Teams Synced</span>
                                        <span>✓ Next Opponent Rank Linked (#8)</span>
                                    </div>
                                    <div className="text-slate-300">
                                        Every fixture card on your Dashboard and Matches tab now automatically displays your
                                        opponent’s live league rank, points, and goal difference.
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Interactive Hotspot Overlay Pins */}
                    {showHotspots &&
                        currentTabObj.hotspots.map((pin, idx) => {
                            const isSelected = activeHotspotId === pin.id;
                            return (
                                <div
                                    key={pin.id}
                                    style={{ left: `${pin.x}%`, top: `${pin.y}%` }}
                                    className="hidden md:block absolute z-30 -translate-x-1/2 -translate-y-1/2"
                                >
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setActiveHotspotId(isSelected ? null : pin.id)
                                        }
                                        className="w-7 h-7 rounded-full text-xs font-black text-white shadow-xl border-2 border-white flex items-center justify-center transition-transform hover:scale-110 animate-bounce"
                                        style={{ backgroundColor: selectedTheme.primary }}
                                    >
                                        {idx + 1}
                                    </button>
                                    {isSelected && (
                                        <div className="mt-2 w-64 p-3 rounded-xl bg-slate-950/95 border border-white/20 text-left shadow-2xl backdrop-blur-md">
                                            <div className="text-xs font-black text-white">
                                                {pin.title}
                                            </div>
                                            <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">
                                                {pin.detail}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                </div>
            </section>

            {/* ================================================================= */}
            {/* DESKTOP IN THE WEEK vs MOBILE ON MATCHDAY SPLIT                   */}
            {/* ================================================================= */}
            <section
                id="desktop-mobile"
                className="relative z-10 py-24 border-t border-white/[0.08] bg-slate-950/40 px-4 sm:px-6"
            >
                <div className="max-w-7xl mx-auto space-y-12">
                    <div className="text-center space-y-3 max-w-3xl mx-auto">
                        <span
                            className="text-xs font-black uppercase tracking-widest"
                            style={{ color: selectedTheme.primary }}
                        >
                            Tailored for Both Environments
                        </span>
                        <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
                            Desktop in the week. Mobile on the touchline.
                        </h2>
                        <p className="text-sm sm:text-base text-slate-400">
                            Every tab in ClubFlow adapts its layout depending on whether you’re planning at your desk on
                            Wednesday night or standing pitchside on Saturday afternoon.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Desktop Card */}
                        <div className="p-6 sm:p-8 rounded-3xl bg-slate-900/70 border border-white/10 space-y-5">
                            <div className="flex items-center justify-between">
                                <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/15 text-sky-300 border border-sky-500/30 text-xs font-bold">
                                    <Monitor className="w-3.5 h-3.5" /> Mid-Week Desktop Command
                                </span>
                                <span className="text-xs text-slate-400 font-semibold">Wide Table & Analytics View</span>
                            </div>
                            <h3 className="text-2xl font-black text-white">
                                Deep squad tables, FA Full-Time bulk paste & Excel exports
                            </h3>
                            <ul className="space-y-2.5 text-xs sm:text-sm text-slate-300">
                                <li className="flex items-start gap-2.5">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                                    <span>
                                        <strong>Multi-Column Squad & Recruitment Tables:</strong> Sort by Starts, Sub Apps,
                                        Goals, Age, Medical Status, or Star Rating.
                                    </span>
                                </li>
                                <li className="flex items-start gap-2.5">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                                    <span>
                                        <strong>Side-by-Side Tactical Pitch & Bench:</strong> Drag players from your
                                        available pool onto the formation canvas and export high-res PDFs.
                                    </span>
                                </li>
                                <li className="flex items-start gap-2.5">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                                    <span>
                                        <strong>3-Tab Excel (.xlsx) Black Book Export:</strong> Download formatted scouting
                                        sheets for committee and coaching meetings.
                                    </span>
                                </li>
                            </ul>
                        </div>

                        {/* Mobile Card */}
                        <div className="p-6 sm:p-8 rounded-3xl bg-slate-900/70 border border-white/10 space-y-5">
                            <div className="flex items-center justify-between">
                                <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-xs font-bold">
                                    <Smartphone className="w-3.5 h-3.5" /> Matchday Pitchside Mobile
                                </span>
                                <span className="text-xs text-slate-400 font-semibold">Thumb-Friendly Dugout UI</span>
                            </div>
                            <h3 className="text-2xl font-black text-white">
                                1-tap WhatsApp polls, pitchside trialist logging & quick results
                            </h3>
                            <ul className="space-y-2.5 text-xs sm:text-sm text-slate-300">
                                <li className="flex items-start gap-2.5">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                                    <span>
                                        <strong>⚡ Pitchside Quick-Log Trialist:</strong> Log a trialist’s name, position,
                                        and rating in 5 seconds while watching warm-ups.
                                    </span>
                                </li>
                                <li className="flex items-start gap-2.5">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                                    <span>
                                        <strong>1-Tap WhatsApp Availability & Lineup Copy:</strong> Copy formatted match
                                        details, meet times, and starting XIs straight to your squad chat.
                                    </span>
                                </li>
                                <li className="flex items-start gap-2.5">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                                    <span>
                                        <strong>Swipeable Mobile Cards & Bottom Sheet Filters:</strong> Zero horizontal
                                        scrolling—built for one-handed use in the dugout.
                                    </span>
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>
            </section>

            {/* ================================================================= */}
            {/* REAL EXPORTS SHOWCASE (MATCHSHEET PDF/PNG, EXCEL, WHATSAPP)       */}
            {/* ================================================================= */}
            <section id="exports" className="relative z-10 py-24 max-w-7xl mx-auto px-4 sm:px-6 space-y-12">
                <div className="text-center space-y-3 max-w-3xl mx-auto">
                    <span
                        className="text-xs font-black uppercase tracking-widest"
                        style={{ color: selectedTheme.primary }}
                    >
                        Shareable Club Outputs
                    </span>
                    <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
                        Outputs your players and committee actually read.
                    </h2>
                    <p className="text-sm sm:text-base text-slate-400">
                        Export clean, branded assets in one click—automatically named and formatted for WhatsApp, social
                        media, or Excel.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Output 1: Matchsheet PDF / PNG */}
                    <div className="p-6 rounded-3xl bg-slate-900/75 border border-white/10 flex flex-col justify-between space-y-4">
                        <div className="space-y-2">
                            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-400">
                                <Download className="w-3.5 h-3.5" /> Auto-Named Matchsheet Graphic & PDF
                            </span>
                            <h3 className="text-lg font-black text-white">
                                Matchsheet-vs-Stonewall-31-10-2026.png
                            </h3>
                            <p className="text-xs text-slate-400 leading-relaxed">
                                High-resolution pitch graphic and printable PDF matchsheet complete with your club crest,
                                sponsor logo, kick-off time, and 1–11 or squad numbers.
                            </p>
                        </div>
                        <div className="p-3.5 rounded-2xl bg-slate-950 border border-white/10 text-xs space-y-2">
                            <div className="flex items-center justify-between text-slate-300 font-mono text-[11px]">
                                <span>📄 Matchsheet-vs-Stonewall-31-10-2026.pdf</span>
                                <span className="text-emerald-400 font-bold">Ready</span>
                            </div>
                            <div className="flex items-center justify-between text-slate-300 font-mono text-[11px]">
                                <span>🖼️ Matchsheet-vs-Stonewall-31-10-2026.png</span>
                                <span className="text-emerald-400 font-bold">Ready</span>
                            </div>
                        </div>
                    </div>

                    {/* Output 2: Multi-Tab Excel Black Book */}
                    <div className="p-6 rounded-3xl bg-slate-900/75 border border-white/10 flex flex-col justify-between space-y-4">
                        <div className="space-y-2">
                            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-400">
                                <FileSpreadsheet className="w-3.5 h-3.5" /> 3-Tab Excel Workbook (.xlsx)
                            </span>
                            <h3 className="text-lg font-black text-white">
                                Manager’s Recruitment Black Book Export
                            </h3>
                            <p className="text-xs text-slate-400 leading-relaxed">
                                Exports your entire scouting database into a structured 3-worksheet Excel file: All Targets,
                                Positional Needs Matrix, and Priority Trialist Shortlist.
                            </p>
                        </div>
                        <div className="p-3.5 rounded-2xl bg-slate-950 border border-white/10 text-xs space-y-1.5 font-mono">
                            <div className="text-emerald-400 font-bold">📊 Sheet 1: All Scouting Targets (42)</div>
                            <div className="text-sky-400 font-bold">📊 Sheet 2: Positional Depth Matrix</div>
                            <div className="text-amber-400 font-bold">📊 Sheet 3: Priority Trialists (8)</div>
                        </div>
                    </div>

                    {/* Output 3: WhatsApp Matchday & Training Polls */}
                    <div className="p-6 rounded-3xl bg-slate-900/75 border border-white/10 flex flex-col justify-between space-y-4">
                        <div className="space-y-2">
                            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-sky-400">
                                <Share2 className="w-3.5 h-3.5" /> 1-Tap WhatsApp Group Formatting
                            </span>
                            <h3 className="text-lg font-black text-white">
                                Instant Squad Polls, Briefings & Dossiers
                            </h3>
                            <p className="text-xs text-slate-400 leading-relaxed">
                                Copy pre-formatted WhatsApp messages for match availability, training times, starting lineups,
                                or scouting dossiers to send to your coaches.
                            </p>
                        </div>
                        <div className="p-3 rounded-2xl bg-[#005c4b] text-white text-[11px] font-sans leading-relaxed shadow-md">
                            ⚽ <strong>NEXT MATCH — {selectedTheme.clubLabel.toUpperCase()}</strong>
                            <br />🆚 <strong>Opposition:</strong> Stonewall (#8) (HOME)
                            <br />📅 <strong>Date:</strong> Sat 31 Oct • KO 15:00 (Meet 13:30)
                            <br />💪 Please confirm your availability below!
                        </div>
                    </div>
                </div>
            </section>

            {/* ================================================================= */}
            {/* BENTO GRID OF ALL 15+ CLUB MODULES                                */}
            {/* ================================================================= */}
            <section
                id="features"
                className="relative z-10 py-24 border-t border-white/[0.08] bg-slate-950/50 px-4 sm:px-6"
            >
                <div className="max-w-7xl mx-auto space-y-12">
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                        <div className="space-y-2">
                            <span
                                className="text-xs font-black uppercase tracking-widest"
                                style={{ color: selectedTheme.primary }}
                            >
                                Complete Football Operating System
                            </span>
                            <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
                                Built for every role in the club.
                            </h2>
                        </div>

                        {/* Role Filter Switcher */}
                        <div className="inline-flex rounded-xl bg-slate-900 p-1 border border-white/10 self-start">
                            {[
                                { id: "manager", label: "First-Team Manager" },
                                { id: "secretary", label: "Chairman / Secretary" },
                                { id: "coach", label: "Coach / Analyst" },
                            ].map((r) => (
                                <button
                                    key={r.id}
                                    type="button"
                                    onClick={() => setActiveRoleTab(r.id as any)}
                                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                        activeRoleTab === r.id
                                            ? "bg-white text-slate-950 shadow"
                                            : "text-slate-400 hover:text-white"
                                    }`}
                                >
                                    {r.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {[
                            {
                                icon: Shirt,
                                title: "Matchday XI & 1–11 Numbering",
                                roles: ["manager", "coach"],
                                tag: "Matchday",
                                desc: "Drag-and-drop formations, automatic 1–11 or squad shirt numbering, bench tracking, and one-click PDF/PNG export.",
                            },
                            {
                                icon: ClipboardPaste,
                                title: "FA Full-Time & Mitoo Paste Sync",
                                roles: ["manager", "secretary", "coach"],
                                tag: "Automation",
                                desc: "Paste raw text from FA Full-Time or Football Mitoo to import fixtures, league tables, and player appearances in seconds.",
                            },
                            {
                                icon: Star,
                                title: "Manager’s Recruitment Black Book",
                                roles: ["manager", "coach"],
                                tag: "Scouting",
                                desc: "Track transfer targets and trialists over time, spot positional squad gaps, and export a 3-tab Excel spreadsheet.",
                            },
                            {
                                icon: Users,
                                title: "Loan, Dual-Reg & Former Player History",
                                roles: ["manager", "secretary"],
                                tag: "Squad Registry",
                                desc: "Track parent/subordinate loan clubs with expiry alerts, and archive departed players while preserving all historical match stats.",
                            },
                            {
                                icon: Shield,
                                title: "Opposition Scouting Dossiers",
                                roles: ["manager", "coach"],
                                tag: "Analysis",
                                desc: "Log opponent formations, key threats, head-to-head records, and tactical notes linked directly to upcoming fixtures.",
                            },
                            {
                                icon: Gavel,
                                title: "Subs, Payments & Squad Fines Master",
                                roles: ["manager", "secretary"],
                                tag: "Club Finance",
                                desc: "Manage monthly standing orders, pay-as-you-play match fees, club budgets, and a customizable Squad Fines Master.",
                            },
                        ].map((card, i) => {
                            const highlighted = card.roles.includes(activeRoleTab);
                            return (
                                <div
                                    key={i}
                                    className={`p-6 rounded-3xl border transition-all space-y-3 ${
                                        highlighted
                                            ? "bg-slate-900/90 border-white/20 shadow-lg"
                                            : "bg-slate-950/40 border-white/5 opacity-60"
                                    }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <div
                                            className="w-10 h-10 rounded-xl flex items-center justify-center"
                                            style={{
                                                backgroundColor: selectedTheme.badgeBg,
                                                color: selectedTheme.primary,
                                            }}
                                        >
                                            <card.icon className="w-5 h-5" />
                                        </div>
                                        <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-white/5 text-slate-300 border border-white/10">
                                            {card.tag}
                                        </span>
                                    </div>
                                    <h3 className="text-lg font-black text-white">{card.title}</h3>
                                    <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">{card.desc}</p>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </section>

            {/* ================================================================= */}
            {/* 60-SECOND ONBOARDING STUDIO CALLOUT & FINAL CTA                   */}
            {/* ================================================================= */}
            <section className="relative z-10 py-24 px-4 sm:px-6">
                <div
                    className="max-w-5xl mx-auto rounded-3xl border border-white/15 p-8 sm:p-12 text-center space-y-8 shadow-2xl"
                    style={{
                        background: `linear-gradient(135deg, ${selectedTheme.primary}26 0%, rgba(11,15,25,0.96) 65%)`,
                    }}
                >
                    <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 border border-white/15 text-xs font-bold text-white">
                        <Zap className="w-3.5 h-3.5 text-emerald-400" /> New 60-Second Club Onboarding Studio
                    </div>

                    <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight max-w-2xl mx-auto leading-tight">
                        Set up your badge, kits, squad & fixtures in minutes.
                    </h2>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-left max-w-3xl mx-auto">
                        {[
                            {
                                step: "1. Upload Club Badge",
                                desc: "Auto-extracts your club colors and configures Home, Away & GK strips.",
                            },
                            {
                                step: "2. Paste Squad & Table",
                                desc: "Paste your WhatsApp squad list and FA Full-Time standings in one go.",
                            },
                            {
                                step: "3. Invite Your Staff",
                                desc: "Generate 1-click /join links to share on WhatsApp with coaches.",
                            },
                        ].map((s, i) => (
                            <div
                                key={i}
                                className="p-4 rounded-2xl bg-slate-950/70 border border-white/10 space-y-1"
                            >
                                <div className="text-xs font-black text-white">{s.step}</div>
                                <div className="text-[11px] text-slate-400 leading-relaxed">{s.desc}</div>
                            </div>
                        ))}
                    </div>

                    <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
                        <Link
                            href="/signup"
                            className="px-8 py-4 rounded-xl font-black text-sm text-white shadow-xl transition-all hover:scale-[1.02] flex items-center gap-2"
                            style={{ backgroundColor: selectedTheme.primary }}
                        >
                            Create Your Club Account <ArrowRight className="w-4 h-4" />
                        </Link>
                        <Link
                            href="/login"
                            className="px-7 py-4 rounded-xl font-bold text-sm bg-slate-900/90 hover:bg-slate-800 text-slate-200 border border-white/15 transition-all"
                        >
                            Sign In to Existing Club
                        </Link>
                    </div>
                </div>
            </section>

            {/* ================================================================= */}
            {/* CLEAN FOOTER                                                      */}
            {/* ================================================================= */}
            <footer className="relative z-10 border-t border-white/[0.08] py-12 px-6 bg-[#060911] text-xs">
                <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-6">
                    <div className="flex items-center gap-3">
                        <span
                            className="h-7 w-7 rounded-lg flex items-center justify-center font-black text-white text-xs"
                            style={{ backgroundColor: selectedTheme.primary }}
                        >
                            CF
                        </span>
                        <span className="font-black tracking-tight text-white text-base">ClubFlow</span>
                        <span className="text-slate-500">•</span>
                        <span className="text-slate-400">www.clubflow.org.uk</span>
                    </div>

                    <div className="flex items-center gap-6 text-slate-400 font-semibold">
                        <a href="#workspaces" className="hover:text-white transition-colors">
                            Workspaces
                        </a>
                        <a href="#desktop-mobile" className="hover:text-white transition-colors">
                            Mobile & Desktop
                        </a>
                        <a href="#exports" className="hover:text-white transition-colors">
                            Exports
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