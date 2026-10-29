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
    Gavel,
    Eye,
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
        id: "crimson",
        name: "Crimson Red",
        clubLabel: "Northbrook United",
        primary: "#e11d48",
        secondary: "#0f172a",
        gk: "#10b981",
        badgeBg: "rgba(225,29,72,0.14)",
    },
    {
        id: "royal",
        name: "Royal Blue",
        clubLabel: "Oakwood Albion",
        primary: "#2563eb",
        secondary: "#ffffff",
        gk: "#f59e0b",
        badgeBg: "rgba(37,99,235,0.14)",
    },
    {
        id: "emerald",
        name: "Emerald Athletic",
        clubLabel: "Riverside Athletic",
        primary: "#10b981",
        secondary: "#064e3b",
        gk: "#eab308",
        badgeBg: "rgba(16,185,129,0.14)",
    },
    {
        id: "amber",
        name: "Gold & Black",
        clubLabel: "Westbourne Town",
        primary: "#f59e0b",
        secondary: "#0f172a",
        gk: "#06b6d4",
        badgeBg: "rgba(245,158,11,0.14)",
    },
    {
        id: "claret",
        name: "Claret & Sky",
        clubLabel: "Ashford Park FC",
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
        label: "Club Dashboard",
        badge: "Overview",
        url: "clubflow.org.uk/dashboard",
        headline: "Your league position, recent form & next game in one place.",
        desc: "See where you sit in the table, your last 5 results, next kick-off and meet time, and your top goalscorers.",
        hotspots: [
            {
                id: "h1",
                x: 24,
                y: 22,
                title: "League Position & Form Guide",
                detail: "Shows your current league rank (#1st) and last 5 competitive results (W-W-W-D-W).",
            },
            {
                id: "h2",
                x: 68,
                y: 42,
                title: "Home & Away Split",
                detail: "Quickly compare your home record against your away form across the season.",
            },
            {
                id: "h3",
                x: 35,
                y: 78,
                title: "Season Leaderboards",
                detail: "Tracks your top goalscorer, most appearances, and next fixture countdown.",
            },
        ],
    },
    {
        id: "matches",
        label: "Fixtures & Results",
        badge: "Match Log",
        url: "clubflow.org.uk/matches",
        headline: "Manage your fixture list, log results & check saved lineups.",
        desc: "Search any opponent, view saved starting XIs from previous games, and log scorelines, goalscorers, and cards.",
        hotspots: [
            {
                id: "m1",
                x: 68,
                y: 20,
                title: "Next Match Actions",
                detail: "Jump straight to your Matchday XI, Opposition Report, or Log Result from the top banner.",
            },
            {
                id: "m2",
                x: 72,
                y: 46,
                title: "Opponent Search",
                detail: "Filter your fixtures and results by opponent or competition (League, Cups, Friendlies).",
            },
            {
                id: "m3",
                x: 50,
                y: 86,
                title: "Saved Lineup Preview",
                detail: "Check the exact starting XI and formation you used in any fixture.",
            },
        ],
    },
    {
        id: "matchday-xi",
        label: "Matchday XI",
        badge: "Team Sheet",
        url: "clubflow.org.uk/matchday-xi",
        headline: "Pick your starting XI, set your bench & export your team sheet.",
        desc: "Switch between 1–11 matchday shirt numbers or fixed squad numbers, and download a clean PDF or image named after your opponent.",
        hotspots: [
            {
                id: "x1",
                x: 50,
                y: 35,
                title: "1–11 or Squad Numbers",
                detail: "Number your starting XI 1–11 for matchday team sheets or keep fixed season squad numbers.",
            },
            {
                id: "x2",
                x: 82,
                y: 25,
                title: "Ready-to-Share Team Sheet",
                detail: "Exports as Matchsheet-vs-Kingswood-Rovers-31-10-2026.pdf or .png for your group chat.",
            },
        ],
    },
    {
        id: "squad",
        label: "Squad & Appearances",
        badge: "Player Stats",
        url: "clubflow.org.uk/squad",
        headline: "Starts, sub appearances, goals, loans & player availability.",
        desc: "Track starts, sub appearances, goals, cards, injuries, and loan/dual-registration players across the season.",
        hotspots: [
            {
                id: "s1",
                x: 62,
                y: 30,
                title: "Starts & Sub Appearances",
                detail: "Automatically tracks who started, who came off the bench, and who scored.",
            },
            {
                id: "s2",
                x: 28,
                y: 68,
                title: "Loans, Dual-Reg & Former Players",
                detail: "Keep track of loan deals and archive players who leave the club without losing their stats.",
            },
        ],
    },
    {
        id: "recruitment",
        label: "Recruitment",
        badge: "Scouting & Trialists",
        url: "clubflow.org.uk/recruitment",
        headline: "Track scouting targets, manage your trialist pipeline & export to Excel.",
        desc: "Keep a list of players you’ve watched, track trialists through training, rate targets, and export your list to Excel.",
        hotspots: [
            {
                id: "r1",
                x: 30,
                y: 45,
                title: "Trialist Pipeline",
                detail: "Move players from Watched to Invited to Trial, On Trial, and Sign to Squad.",
            },
            {
                id: "r2",
                x: 80,
                y: 20,
                title: "1-Click Excel Export",
                detail: "Download your scouting and trialist list as a clean Excel (.xlsx) spreadsheet anytime.",
            },
        ],
    },
    {
        id: "fulltime",
        label: "FA Full-Time Sync",
        badge: "Quick Import",
        url: "clubflow.org.uk/league",
        headline: "Copy-paste your table, fixtures & appearances from FA Full-Time or Mitoo.",
        desc: "No manual typing. Paste your division table, fixture list, or player appearances in seconds.",
        hotspots: [
            {
                id: "f1",
                x: 45,
                y: 45,
                title: "FA Full-Time & Mitoo Paste",
                detail: "Works with FA Full-Time and Football Mitoo to update your table, fixtures, and appearances.",
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

    const currentTabObj = WORKSPACE_TABS.find((t) => t.id === activeWorkspace) || WORKSPACE_TABS[0];

    return (
        <div className="bg-[#060911] text-slate-100 min-h-screen font-sans selection:bg-rose-500/30 selection:text-rose-300 overflow-x-hidden antialiased relative">
            {/* ================================================================= */}
            {/* ARCHITECTURAL PITCH-GRID & AMBIENT MESH BACKGROUND                */}
            {/* ================================================================= */}
            <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
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
            {/* NAVBAR                                                            */}
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
                            <span className="font-black text-lg tracking-tight text-white">
                                ClubFlow
                            </span>
                        </Link>

                        <div className="hidden md:flex items-center gap-7 text-xs font-bold uppercase tracking-wider text-slate-400">
                            <a href="#workspaces" className="hover:text-white transition-colors">
                                Inside the Hub
                            </a>
                            <a href="#features" className="hover:text-white transition-colors">
                                Features
                            </a>
                            <a href="#desktop-mobile" className="hover:text-white transition-colors">
                                Desktop & Touchline
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
            {/* HERO SECTION                                                      */}
            {/* ================================================================= */}
            <header className="relative z-10 pt-28 pb-20 md:pt-36 md:pb-24 px-4 sm:px-6">
                <div className="max-w-6xl mx-auto text-center space-y-6 flex flex-col items-center">
                    <div className="inline-flex flex-wrap items-center justify-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.05] border border-white/10 text-xs font-bold text-slate-200 backdrop-blur-md">
                        <span
                            className="w-2 h-2 rounded-full animate-pulse"
                            style={{ backgroundColor: selectedTheme.primary }}
                        />
                        <span>Built for Non-League, Grassroots, Sunday League & Academy Football</span>
                    </div>

                    <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight text-white max-w-4xl leading-[1.04]">
                        Everything your football club needs,{" "}
                        <span
                            className="bg-clip-text text-transparent transition-all duration-500"
                            style={{
                                backgroundImage: `linear-gradient(135deg, #ffffff 15%, ${selectedTheme.primary} 100%)`,
                            }}
                        >
                            all in one dugout.
                        </span>
                    </h1>

                    <p className="text-base sm:text-lg md:text-xl text-slate-400 max-w-3xl leading-relaxed">
                        Manage your <strong className="text-slate-200">Squad</strong>,{" "}
                        <strong className="text-slate-200">Matchday XI team sheets</strong>,{" "}
                        <strong className="text-slate-200">FA Full-Time fixtures & tables</strong>,{" "}
                        <strong className="text-slate-200">Recruitment & trialists</strong>, and{" "}
                        <strong className="text-slate-200">player subs</strong> in one clean place.
                    </p>

                    <div className="flex flex-wrap items-center justify-center gap-3.5 pt-2">
                        <Link
                            href="/signup"
                            className="px-7 py-3.5 rounded-xl font-black text-sm text-white shadow-xl transition-all hover:scale-[1.02] flex items-center gap-2"
                            style={{ backgroundColor: selectedTheme.primary }}
                        >
                            Create Your Club <ArrowRight className="w-4 h-4" />
                        </Link>
                        <a
                            href="#workspaces"
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

                    {/* Club Color Switcher */}
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
                                    {theme.clubLabel}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* ============================================================= */}
                {/* HERO SHOWCASE: DESKTOP APP WINDOW + FLOATING MOBILE DUGOUT    */}
                {/* ============================================================= */}
                <div className="max-w-6xl mx-auto mt-12 relative">
                    <div className="rounded-2xl sm:rounded-3xl overflow-hidden border border-white/15 shadow-[0_25px_100px_-15px_rgba(0,0,0,0.85)] bg-[#0b0f19]">
                        <div className="h-9 bg-[#0b0f19] border-b border-white/10 px-4 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f56]" />
                                <span className="h-2.5 w-2.5 rounded-full bg-[#ffbd2e]" />
                                <span className="h-2.5 w-2.5 rounded-full bg-[#27c93f]" />
                                <span className="ml-2 text-[11px] text-slate-400 font-semibold hidden sm:inline">
                                    {selectedTheme.clubLabel}
                                </span>
                            </div>
                            <div className="px-3 py-0.5 rounded-md bg-white/[0.05] border border-white/10 text-[10px] text-slate-300 font-mono">
                                www.clubflow.org.uk/matches
                            </div>
                            <div className="flex items-center gap-1.5">
                                <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded">
                                    ● 26/27 Season
                                </span>
                            </div>
                        </div>

                        <div className="grid grid-cols-12 min-h-[450px] bg-[#f8fafc] text-slate-900">
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
                                            { label: "Squad", icon: Users, active: false, count: "27" },
                                            { label: "Fixtures & Results", icon: Calendar, active: true, count: "29" },
                                            { label: "Matchday XI", icon: Shirt, active: false },
                                            { label: "Opposition", icon: Shield, active: false },
                                            { label: "League Table", icon: Trophy, active: false },
                                            { label: "Recruitment", icon: Star, active: false },
                                        ].map((nav, i) => (
                                            <div
                                                key={i}
                                                className={`flex items-center justify-between px-2.5 py-2 rounded-xl transition-colors ${
                                                    nav.active ? "text-white font-bold shadow-sm" : "text-slate-400"
                                                }`}
                                                style={nav.active ? { backgroundColor: selectedTheme.primary } : undefined}
                                            >
                                                <span className="flex items-center gap-2 truncate">
                                                    <nav.icon className="w-3.5 h-3.5 shrink-0" />
                                                    <span className="truncate">{nav.label}</span>
                                                </span>
                                                {nav.count && <span className="text-[10px] opacity-80">{nav.count}</span>}
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="p-2.5 rounded-xl bg-slate-900/90 border border-white/10 text-[10px] text-slate-400 space-y-1">
                                    <div className="font-bold text-white flex items-center justify-between">
                                        <span>FA Full-Time</span>
                                        <span className="text-emerald-400">Synced</span>
                                    </div>
                                    <div>27 Players • 19 Results</div>
                                </div>
                            </div>

                            {/* Main Content */}
                            <div className="col-span-12 md:col-span-9 lg:col-span-10 p-4 sm:p-6 space-y-4 bg-[#f8fafc] text-left">
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
                                                    Kingswood Rovers
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
                                                Opposition Report
                                            </span>
                                            <span className="px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold">
                                                ⚽ Log Result / Scorers
                                            </span>
                                        </div>
                                    </div>
                                </div>

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
                                            Results (19)
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

                                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                                    <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 p-3.5 space-y-2.5">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">
                                                Recent Results & Saved Lineups
                                            </span>
                                            <span className="text-[11px] font-bold text-emerald-600">
                                                Form: W • W • D • W • W
                                            </span>
                                        </div>
                                        {[
                                            {
                                                opp: "Kingswood Rovers",
                                                ha: "Away",
                                                score: "4 - 0",
                                                res: "W",
                                                scorers: "Mercer (2), Sterling, Vance",
                                                lineup: "4-3-3 Saved",
                                            },
                                            {
                                                opp: "Meadowbank Town",
                                                ha: "Home",
                                                score: "3 - 1",
                                                res: "W",
                                                scorers: "Maddox (2), Mercer",
                                                lineup: "4-2-3-1 Saved",
                                            },
                                            {
                                                opp: "Silverdale Athletic",
                                                ha: "Away",
                                                score: "2 - 2",
                                                res: "D",
                                                scorers: "Mercer, Cole",
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
                                                        <div className="text-[10px] text-slate-500">⚽ {m.scorers}</div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="px-2 py-0.5 rounded bg-white border border-slate-200 text-[10px] font-semibold text-slate-600">
                                                        📋 {m.lineup}
                                                    </span>
                                                    <span className="font-black text-slate-900 text-sm">{m.score}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 p-3.5 space-y-2.5">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">
                                                Starts, Sub Apps & Goals
                                            </span>
                                            <span className="text-[10px] font-bold text-rose-600">26/27 Season</span>
                                        </div>
                                        {[
                                            { name: "J. Mercer", pos: "ST", apps: "12 (0)", goals: 22 },
                                            { name: "L. Sterling", pos: "RW", apps: "5 (6)", goals: 8 },
                                            { name: "T. Vance", pos: "CAM", apps: "5 (2)", goals: 6 },
                                            { name: "C. Maddox", pos: "LW", apps: "8 (1)", goals: 5 },
                                            { name: "R. Brooks", pos: "CM", apps: "11 (0)", goals: 1 },
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

                    {/* Floating Mobile Pitchside View */}
                    <div className="hidden xl:block absolute -bottom-10 -right-6 w-[285px] rounded-[32px] bg-[#0b0f19] border-4 border-slate-800 shadow-[0_25px_70px_rgba(0,0,0,0.9)] p-3 text-left z-20">
                        <div className="w-20 h-1.5 bg-slate-800 rounded-full mx-auto mb-2.5" />
                        <div className="rounded-2xl bg-[#111827] border border-white/10 p-3 space-y-2.5">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1">
                                    <Smartphone className="w-3 h-3" /> Touchline Mobile View
                                </span>
                                <span className="text-[10px] text-slate-400">Sat 13:30</span>
                            </div>

                            <div
                                className="p-2.5 rounded-xl text-white space-y-1"
                                style={{ backgroundColor: selectedTheme.primary }}
                            >
                                <div className="text-[10px] font-bold uppercase opacity-90">
                                    Starting XI • 4-3-3
                                </div>
                                <div className="text-xs font-black">
                                    {selectedTheme.clubLabel} vs Kingswood Rovers
                                </div>
                                <div className="text-[10px] opacity-90">
                                    11 Starters • 5 Subs • 1–11 Shirts
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <div className="p-2 rounded-lg bg-slate-900 border border-white/10 flex items-center justify-between text-[11px]">
                                    <span className="text-slate-200 font-semibold">📋 Copy WhatsApp Poll</span>
                                    <span className="text-emerald-400 font-bold">Copied ✓</span>
                                </div>
                                <div className="p-2 rounded-lg bg-slate-900 border border-white/10 flex items-center justify-between text-[11px]">
                                    <span className="text-slate-200 font-semibold">⚡ Quick-Log Trialist</span>
                                    <span className="text-sky-400 font-bold">+ Recruitment</span>
                                </div>
                                <div className="p-2 rounded-lg bg-slate-900 border border-white/10 flex items-center justify-between text-[11px]">
                                    <span className="text-slate-200 font-semibold">📥 Export Team Sheet</span>
                                    <span className="text-amber-400 font-bold">PDF / PNG</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            {/* ================================================================= */}
            {/* 6-TAB INTERACTIVE APP PREVIEW                                     */}
            {/* ================================================================= */}
            <section id="workspaces" className="relative z-10 py-20 max-w-7xl mx-auto px-4 sm:px-6 space-y-8">
                <div className="text-center space-y-2 max-w-2xl mx-auto">
                    <span
                        className="text-xs font-black uppercase tracking-widest"
                        style={{ color: selectedTheme.primary }}
                    >
                        Inside ClubFlow
                    </span>
                    <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
                        Built around how your club actually runs.
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
                            </button>
                        );
                    })}
                </div>

                {/* Active Tab Summary Bar */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/60 border border-white/10 rounded-2xl p-4 sm:p-5">
                    <div className="space-y-0.5">
                        <h3 className="text-base sm:text-lg font-black text-white">{currentTabObj.headline}</h3>
                        <p className="text-xs sm:text-sm text-slate-400">{currentTabObj.desc}</p>
                    </div>
                    <button
                        type="button"
                        onClick={() => setShowHotspots((v) => !v)}
                        className="self-start md:self-center shrink-0 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-xs font-bold text-white flex items-center gap-1.5"
                    >
                        <Eye className="w-3.5 h-3.5 text-emerald-400" />
                        {showHotspots ? "Hide Highlights" : "Show Highlights"}
                    </button>
                </div>

                {/* Interactive Screen Frame */}
                <div className="relative rounded-2xl sm:rounded-3xl overflow-hidden border border-white/15 bg-[#0c101b] shadow-2xl">
                    <div className="h-9 bg-[#0c101b] border-b border-white/10 px-4 flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                            <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f56]" />
                            <span className="h-2.5 w-2.5 rounded-full bg-[#ffbd2e]" />
                            <span className="h-2.5 w-2.5 rounded-full bg-[#27c93f]" />
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono">{currentTabObj.url}</div>
                        <div className="w-12" />
                    </div>

                    {/* TAB 1: CLUB DASHBOARD */}
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
                                            <div className="text-base font-black text-slate-900">J. Mercer</div>
                                            <div className="text-xs text-slate-500">12 Starts</div>
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
                                                D. Fletcher & H. Gallagher
                                            </div>
                                            <div className="text-xs text-slate-500">12 Starts</div>
                                        </div>
                                        <div className="text-2xl font-black text-sky-600">12</div>
                                    </div>
                                </div>
                                <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-2">
                                    <div className="text-[10px] font-black uppercase text-emerald-600">
                                        NEXT FIXTURE
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <div className="text-base font-black text-slate-900">
                                                vs Kingswood Rovers (#8)
                                            </div>
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

                    {/* TAB 2: FIXTURES & RESULTS */}
                    {activeWorkspace === "matches" && (
                        <div className="p-5 sm:p-8 bg-[#f8fafc] text-slate-900 space-y-4 text-left">
                            <div
                                className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs border-l-4"
                                style={{ borderLeftColor: selectedTheme.primary }}
                            >
                                <div className="flex flex-wrap items-center justify-between gap-4">
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2">
                                            <span className="px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase bg-rose-100 text-rose-700">
                                                NEXT MATCH
                                            </span>
                                            <span className="text-xs font-bold uppercase text-rose-600">• LEAGUE</span>
                                            <span className="px-2 py-0.5 rounded border border-slate-200 text-[10px] font-bold text-slate-600">
                                                HOME
                                            </span>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2.5">
                                            <span className="text-2xl font-black text-slate-900">
                                                {selectedTheme.clubLabel}
                                            </span>
                                            <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-200 text-xs font-black">
                                                #1
                                            </span>
                                            <span className="text-sm font-bold text-slate-400">VS</span>
                                            <span className="text-2xl font-black text-slate-500">
                                                Kingswood Rovers
                                            </span>
                                            <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-200 text-xs font-black">
                                                #8
                                            </span>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                                            <span>📅 Sat 31 Oct</span>
                                            <span>🕒 KO 15:00</span>
                                            <span className="font-bold text-amber-600">• Meet 13:30</span>
                                            <span>📍 Northbrook Park</span>
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-2">
                                        <span
                                            className="px-3.5 py-2 rounded-lg text-white text-xs font-bold"
                                            style={{ backgroundColor: selectedTheme.primary }}
                                        >
                                            Matchday XI
                                        </span>
                                        <span className="px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-700 text-xs font-bold">
                                            Opposition Report
                                        </span>
                                        <span className="px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold">
                                            Log Result / Scorers
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center justify-between gap-2 bg-white p-3 rounded-xl border border-slate-200">
                                <div className="flex items-center gap-2">
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
                                        Results (19)
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

                            <div
                                className="bg-white rounded-2xl p-4 border border-slate-200 space-y-3 border-l-4"
                                style={{ borderLeftColor: selectedTheme.primary }}
                            >
                                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span
                                            className="px-2.5 py-0.5 rounded-full text-white text-[10px] font-black"
                                            style={{ backgroundColor: selectedTheme.primary }}
                                        >
                                            NEXT UP
                                        </span>
                                        <span className="px-2.5 py-0.5 rounded-full border border-slate-200 text-slate-700 font-bold">
                                            League
                                        </span>
                                        <span className="text-slate-500">
                                            📅 Sat, 31 Oct 2026 • KO 15:00 • Meet 13:30
                                        </span>
                                    </div>
                                    <span className="px-3 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold">
                                        ⚽ Log Result
                                    </span>
                                </div>

                                <div className="flex items-center justify-center gap-4 py-2 text-sm sm:text-base">
                                    <span className="font-black text-slate-900">
                                        {selectedTheme.clubLabel}{" "}
                                        <span className="px-1.5 py-0.5 rounded bg-rose-50 text-rose-600 text-xs">
                                            #1
                                        </span>
                                    </span>
                                    <span className="font-black text-slate-400">v</span>
                                    <span className="font-bold text-slate-600">
                                        Kingswood Rovers{" "}
                                        <span className="px-1.5 py-0.5 rounded bg-rose-50 text-rose-600 text-xs">
                                            #8
                                        </span>
                                    </span>
                                </div>

                                <div className="pt-2 border-t border-slate-100 flex justify-center">
                                    <span className="px-3 py-1 rounded-lg border border-slate-200 text-xs font-bold text-slate-700 bg-slate-50">
                                        📋 Show Saved Lineup (4-3-3)
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TAB 3: MATCHDAY XI */}
                    {activeWorkspace === "matchday-xi" && (
                        <div className="p-5 sm:p-8 bg-[#0b0f19] text-white grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                            <div className="lg:col-span-5 space-y-4 text-left">
                                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold">
                                    <Shirt className="w-3.5 h-3.5" /> Matchday XI Team Sheet
                                </div>
                                <h4 className="text-2xl font-black text-white">
                                    1–11 Shirt Numbers & Instant Team Sheet Export
                                </h4>
                                <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                                    Switch between 1–11 matchday shirt numbers or fixed squad numbers, and export your
                                    team sheet named automatically after your opposition and date:
                                </p>
                                <div className="p-3 rounded-xl bg-slate-900 border border-white/10 font-mono text-xs text-emerald-300">
                                    📄 Matchsheet-vs-Kingswood-Rovers-31-10-2026.pdf
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
                                        { x: 50, y: 88, name: "Fletcher", num11: 1, sq: 1, gk: true },
                                        { x: 18, y: 68, name: "Brooks", num11: 3, sq: 18 },
                                        { x: 38, y: 72, name: "Gallagher", num11: 5, sq: 4 },
                                        { x: 62, y: 72, name: "Ward", num11: 6, sq: 5 },
                                        { x: 82, y: 68, name: "Palmer", num11: 2, sq: 22 },
                                        { x: 50, y: 52, name: "Cole", num11: 4, sq: 6 },
                                        { x: 32, y: 42, name: "Barker", num11: 8, sq: 14 },
                                        { x: 68, y: 42, name: "Vance", num11: 10, sq: 10 },
                                        { x: 22, y: 20, name: "Maddox", num11: 11, sq: 11 },
                                        { x: 50, y: 15, name: "Mercer", num11: 9, sq: 9 },
                                        { x: 78, y: 20, name: "Sterling", num11: 7, sq: 7 },
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

                    {/* TAB 4: SQUAD & APPEARANCES */}
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
                                        Former Players (4)
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
                                            { name: "Jack Mercer", pos: "ST", reg: "League Reg", starts: 12, sub: 0, goals: 22, status: "Available" },
                                            { name: "Ryan Brooks", pos: "CM", reg: "League Reg", starts: 11, sub: 0, goals: 1, status: "Available" },
                                            { name: "Liam Sterling", pos: "RW", reg: "Dual-Reg", starts: 5, sub: 6, goals: 8, status: "Available" },
                                            { name: "Alex Cole", pos: "CM", reg: "League Reg", starts: 4, sub: 1, goals: 1, status: "Available" },
                                            { name: "Sam Ward", pos: "CB", reg: "Loan (28d)", starts: 0, sub: 2, goals: 0, status: "Available" },
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

                    {/* TAB 5: RECRUITMENT */}
                    {activeWorkspace === "recruitment" && (
                        <div className="p-5 sm:p-8 bg-[#0b0f19] text-white space-y-5">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <div className="space-y-1 text-left">
                                    <div className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                                        Player Recruitment & Scouting
                                    </div>
                                    <div className="text-lg font-black text-white">
                                        Trialist Pipeline, Scouting Notes & Excel Export
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="px-3.5 py-2 rounded-xl bg-emerald-500 text-slate-950 font-black text-xs flex items-center gap-1.5">
                                        <FileSpreadsheet className="w-4 h-4" /> Export to Excel (.xlsx)
                                    </span>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
                                {[
                                    {
                                        name: "Jayden Vance",
                                        pos: "LB / LWB",
                                        club: "Hillside Athletic U23",
                                        foot: "Left",
                                        rating: 5,
                                        stage: "Invite to Trial",
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
                                                Sign to Squad →
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* TAB 6: FA FULL-TIME & MITOO PASTE SYNC */}
                    {activeWorkspace === "fulltime" && (
                        <div className="p-5 sm:p-8 bg-[#0b0f19] text-white grid grid-cols-1 lg:grid-cols-2 gap-6 text-left">
                            <div className="space-y-3">
                                <div className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                                    Step 1 • Copy & Paste from FA Full-Time or Mitoo
                                </div>
                                <div className="p-4 rounded-2xl bg-slate-950 border border-white/10 font-mono text-[11px] text-slate-300 space-y-1.5">
                                    <div className="text-slate-500">// Paste straight from Mitoo / FA Full-Time:</div>
                                    <div>1  {selectedTheme.clubLabel.padEnd(18, " ")} 12  10  1  1  34  11  +23  31</div>
                                    <div>2  Silverdale Athletic 12   8  3  1  26  12  +14  27</div>
                                    <div>3  Oakwood Albion      12   7  2  3  22  15   +7  23</div>
                                    <div>8  Kingswood Rovers    11   4  2  5  16  17   -1  14</div>
                                </div>
                            </div>
                            <div className="space-y-3">
                                <div className="text-xs font-bold uppercase tracking-wider text-sky-400">
                                    Step 2 • Table, Fixtures & Appearances Updated
                                </div>
                                <div className="p-4 rounded-2xl bg-slate-900 border border-emerald-500/30 space-y-2 text-xs">
                                    <div className="flex items-center justify-between text-emerald-300 font-bold">
                                        <span>✓ Division Standings Saved</span>
                                        <span>✓ Next Opponent Rank Linked (#8)</span>
                                    </div>
                                    <div className="text-slate-300">
                                        Your fixtures, league table, and player appearances stay up to date without typing
                                        results out by hand.
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Hotspot Pins */}
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
                                        onClick={() => setActiveHotspotId(isSelected ? null : pin.id)}
                                        className="w-7 h-7 rounded-full text-xs font-black text-white shadow-xl border-2 border-white flex items-center justify-center transition-transform hover:scale-110 animate-bounce"
                                        style={{ backgroundColor: selectedTheme.primary }}
                                    >
                                        {idx + 1}
                                    </button>
                                    {isSelected && (
                                        <div className="mt-2 w-64 p-3 rounded-xl bg-slate-950/95 border border-white/20 text-left shadow-2xl backdrop-blur-md">
                                            <div className="text-xs font-black text-white">{pin.title}</div>
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
            {/* CONCISE FEATURES GRID                                             */}
            {/* ================================================================= */}
            <section
                id="features"
                className="relative z-10 py-20 border-t border-white/[0.08] bg-slate-950/50 px-4 sm:px-6"
            >
                <div className="max-w-7xl mx-auto space-y-10">
                    <div className="text-center space-y-2 max-w-2xl mx-auto">
                        <span
                            className="text-xs font-black uppercase tracking-widest"
                            style={{ color: selectedTheme.primary }}
                        >
                            Features
                        </span>
                        <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                            Built for managers, coaches & club secretaries.
                        </h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {[
                            {
                                icon: Shirt,
                                title: "Matchday XI & Team Sheets",
                                desc: "Pick your starting XI and subs, toggle 1–11 matchday shirt numbers, and export a PDF or PNG named after your opponent.",
                            },
                            {
                                icon: ClipboardPaste,
                                title: "FA Full-Time & Mitoo Import",
                                desc: "Copy-paste your league table, fixtures, and player appearances straight from FA Full-Time or Football Mitoo.",
                            },
                            {
                                icon: Star,
                                title: "Recruitment & Trialist Pipeline",
                                desc: "Keep a scouting list of players you’ve watched, track trialists in training, and export your targets to Excel.",
                            },
                            {
                                icon: Users,
                                title: "Squad, Loans & Appearances",
                                desc: "Track starts, sub appearances, goals, injuries, loan/dual-registration deals, and former player stats.",
                            },
                            {
                                icon: Share2,
                                title: "1-Tap WhatsApp Polls & Lineups",
                                desc: "Copy formatted match availability polls, meet times, training reminders, and starting XIs straight to your squad chat.",
                            },
                            {
                                icon: Gavel,
                                title: "Player Subs & Fines",
                                desc: "Track monthly subs, match fees, club expenses, and squad fines without chasing spreadsheets.",
                            },
                        ].map((card, i) => (
                            <div
                                key={i}
                                className="p-6 rounded-3xl border bg-slate-900/80 border-white/10 space-y-2.5"
                            >
                                <div
                                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                                    style={{
                                        backgroundColor: selectedTheme.badgeBg,
                                        color: selectedTheme.primary,
                                    }}
                                >
                                    <card.icon className="w-5 h-5" />
                                </div>
                                <h3 className="text-base sm:text-lg font-black text-white">{card.title}</h3>
                                <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">{card.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ================================================================= */}
            {/* DESKTOP IN THE WEEK vs MOBILE ON THE TOUCHLINE                    */}
            {/* ================================================================= */}
            <section
                id="desktop-mobile"
                className="relative z-10 py-20 border-t border-white/[0.08] px-4 sm:px-6"
            >
                <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="p-6 sm:p-8 rounded-3xl bg-slate-900/70 border border-white/10 space-y-4">
                        <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/15 text-sky-300 border border-sky-500/30 text-xs font-bold">
                            <Monitor className="w-3.5 h-3.5" /> Mid-Week on Laptop
                        </span>
                        <h3 className="text-xl sm:text-2xl font-black text-white">
                            Plan your XI, update from FA Full-Time & manage recruitment
                        </h3>
                        <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                            Full squad tables, opposition scouting notes, FA Full-Time bulk paste, and 1-click Excel &
                            PDF exports when you’re planning in the week.
                        </p>
                    </div>

                    <div className="p-6 sm:p-8 rounded-3xl bg-slate-900/70 border border-white/10 space-y-4">
                        <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-xs font-bold">
                            <Smartphone className="w-3.5 h-3.5" /> Matchday on Your Phone
                        </span>
                        <h3 className="text-xl sm:text-2xl font-black text-white">
                            Share WhatsApp polls, log trialists & record results pitchside
                        </h3>
                        <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                            Built for one-handed use on the touchline—check availability, add a trialist in 5 seconds,
                            and log your result and goalscorers right after full-time.
                        </p>
                    </div>
                </div>
            </section>

            {/* ================================================================= */}
            {/* FINAL CTA                                                         */}
            {/* ================================================================= */}
            <section className="relative z-10 py-20 px-4 sm:px-6">
                <div
                    className="max-w-4xl mx-auto rounded-3xl border border-white/15 p-8 sm:p-12 text-center space-y-6 shadow-2xl"
                    style={{
                        background: `linear-gradient(135deg, ${selectedTheme.primary}26 0%, rgba(11,15,25,0.96) 65%)`,
                    }}
                >
                    <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight">
                        Ready to set up your club?
                    </h2>
                    <p className="text-sm sm:text-base text-slate-300 max-w-xl mx-auto">
                        Upload your club badge, set your kit colors, and paste your squad and FA Full-Time table in
                        minutes.
                    </p>
                    <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
                        <Link
                            href="/signup"
                            className="px-8 py-4 rounded-xl font-black text-sm text-white shadow-xl transition-all hover:scale-[1.02] flex items-center gap-2"
                            style={{ backgroundColor: selectedTheme.primary }}
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
                            Inside the Hub
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