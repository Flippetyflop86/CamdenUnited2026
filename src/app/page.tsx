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
    Share2,
    Clock,
    MapPin,
    Star,
    Smartphone,
    Monitor,
    Gavel,
    ClipboardCheck,
    TrendingUp,
} from "lucide-react";

type ClubShowcasePreset = {
    id: string;
    clubLabel: string;
    division: string;
    rank: string;
    pageLabel: string;
    urlPath: string;
    primary: string;
    gk: string;
    badgeBg: string;
};

const CLUB_SHOWCASES: ClubShowcasePreset[] = [
    {
        id: "northbrook",
        clubLabel: "Northbrook United",
        division: "Premier Division",
        rank: "#1st",
        pageLabel: "Fixtures & Results",
        urlPath: "matches",
        primary: "#e11d48",
        gk: "#10b981",
        badgeBg: "rgba(225,29,72,0.14)",
    },
    {
        id: "oakwood",
        clubLabel: "Oakwood Albion",
        division: "Senior County League",
        rank: "#2nd",
        pageLabel: "Matchday XI & Tactics",
        urlPath: "matchday-xi",
        primary: "#2563eb",
        gk: "#f59e0b",
        badgeBg: "rgba(37,99,235,0.14)",
    },
    {
        id: "riverside",
        clubLabel: "Riverside Athletic",
        division: "Division One North",
        rank: "#3rd",
        pageLabel: "Training & Weekly Plan",
        urlPath: "training",
        primary: "#10b981",
        gk: "#eab308",
        badgeBg: "rgba(16,185,129,0.14)",
    },
    {
        id: "westbourne",
        clubLabel: "Westbourne Town",
        division: "Middlesex Premier",
        rank: "#4th",
        pageLabel: "Recruitment & Trialists",
        urlPath: "recruitment",
        primary: "#f59e0b",
        gk: "#06b6d4",
        badgeBg: "rgba(245,158,11,0.14)",
    },
    {
        id: "ashford",
        clubLabel: "Ashford Park FC",
        division: "Olympian League",
        rank: "#1st",
        pageLabel: "Opposition & League Insights",
        urlPath: "opposition",
        primary: "#9f1239",
        gk: "#22c55e",
        badgeBg: "rgba(159,18,57,0.18)",
    },
];

type WorkspaceTabId = "dashboard" | "league" | "matchday-xi" | "training" | "recruitment" | "squad";

const WORKSPACE_TABS: {
    id: WorkspaceTabId;
    label: string;
    url: string;
    headline: string;
    desc: string;
}[] = [
    {
        id: "dashboard",
        label: "Club Dashboard",
        url: "clubflow.org.uk/dashboard",
        headline: "Plan your week, check form & see your season leaderboards.",
        desc: "Your league position, home and away splits, upcoming match countdown, and top goalscorers in one view.",
    },
    {
        id: "league",
        label: "League Table & Insights",
        url: "clubflow.org.uk/league",
        headline: "Insights that standard league tables don’t give you.",
        desc: "Go beyond basic points—track points-per-game (PPG), recent 5-match form guides, goal trends, and how your upcoming opponents are performing.",
    },
    {
        id: "matchday-xi",
        label: "Matchday XI",
        url: "clubflow.org.uk/matchday-xi",
        headline: "Build your starting XI, manage your bench & share your lineup.",
        desc: "Lock in your formation, switch between 1–11 matchday numbers or fixed squad numbers, and export your pitch graphic.",
    },
    {
        id: "training",
        label: "Training Attendance",
        url: "clubflow.org.uk/training",
        headline: "Plan the week & monitor who is actually turning up to training.",
        desc: "Log mid-week sessions, track player attendance rates over the season, and see who deserves a starting shirt on Saturday.",
    },
    {
        id: "recruitment",
        label: "Recruitment",
        url: "clubflow.org.uk/recruitment",
        headline: "Track scouting targets, manage your trialist pipeline & export to Excel.",
        desc: "Keep a database of players you’ve watched, monitor trialists in training, and download your list to Excel anytime.",
    },
    {
        id: "squad",
        label: "Squad & Appearances",
        url: "clubflow.org.uk/squad",
        headline: "Starts, sub appearances, goals, loans & availability.",
        desc: "Track starts, sub appearances, goals, cards, injuries, and loan or dual-registration players across the season.",
    },
];

export default function LandingPage() {
    const [selectedClub, setSelectedClub] = useState<ClubShowcasePreset>(CLUB_SHOWCASES[0]);
    const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceTabId>("league");
    const [numberingMode, setNumberingMode] = useState<"1-11" | "squad">("1-11");

    const currentTabObj = WORKSPACE_TABS.find((t) => t.id === activeWorkspace) || WORKSPACE_TABS[0];

    return (
        <div className="bg-[#060911] text-slate-100 min-h-screen font-sans overflow-x-hidden antialiased relative select-none">
            {/* ================================================================= */}
            {/* ARCHITECTURAL PITCH-GRID & AMBIENT MESH BACKGROUND                */}
            {/* ================================================================= */}
            <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
                <div
                    className="absolute -top-48 left-1/2 -translate-x-1/2 w-[980px] h-[540px] rounded-full blur-[160px] opacity-20 transition-colors duration-700"
                    style={{ backgroundColor: selectedClub.primary }}
                />
                <div
                    className="absolute top-[38%] -left-48 w-[520px] h-[520px] rounded-full blur-[170px] opacity-10 transition-colors duration-700"
                    style={{ backgroundColor: selectedClub.gk }}
                />
                <div
                    className="absolute bottom-0 right-0 w-[600px] h-[600px] rounded-full blur-[180px] opacity-15 transition-colors duration-700"
                    style={{ backgroundColor: selectedClub.primary }}
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
            {/* CLEAN NAVBAR (JUST PREVIEW & FEATURES)                            */}
            {/* ================================================================= */}
            <nav className="fixed top-0 left-0 right-0 z-50 bg-[#060911]/80 backdrop-blur-xl border-b border-white/[0.08] px-4 sm:px-8 py-3.5">
                <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
                    <div className="flex items-center gap-8">
                        <Link href="/" className="flex items-center gap-2.5 group">
                            <div
                                className="h-9 w-9 rounded-xl flex items-center justify-center font-black text-white text-sm shadow-lg transition-colors duration-500 border border-white/20"
                                style={{ backgroundColor: selectedClub.primary }}
                            >
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
                            className="px-4 py-2.5 rounded-xl text-white font-black shadow-lg transition-all hover:opacity-95 flex items-center gap-1.5"
                            style={{ backgroundColor: selectedClub.primary }}
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
                            style={{ backgroundColor: selectedClub.primary }}
                        />
                        <span>Built for Non-League, Grassroots, Sunday League & Academy Football</span>
                    </div>

                    <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight text-white max-w-4xl leading-[1.04]">
                        Plan the week. Know your opposition.{" "}
                        <span
                            className="bg-clip-text text-transparent transition-all duration-500"
                            style={{
                                backgroundImage: `linear-gradient(135deg, #ffffff 15%, ${selectedClub.primary} 100%)`,
                            }}
                        >
                            Win on Saturday.
                        </span>
                    </h1>

                    <p className="text-base sm:text-lg md:text-xl text-slate-400 max-w-3xl leading-relaxed">
                        Monitor <strong className="text-slate-200">training attendance</strong>, build your{" "}
                        <strong className="text-slate-200">Matchday XI</strong>, prepare{" "}
                        <strong className="text-slate-200">opposition reports</strong>, manage{" "}
                        <strong className="text-slate-200">recruitment & trialists</strong>, and unlock{" "}
                        <strong className="text-slate-200">deeper insights from your league table</strong> that standard
                        tables don’t show.
                    </p>

                    <div className="flex flex-wrap items-center justify-center gap-3.5 pt-2">
                        <Link
                            href="/signup"
                            className="px-7 py-3.5 rounded-xl font-black text-sm text-white shadow-xl transition-all hover:scale-[1.02] flex items-center gap-2"
                            style={{ backgroundColor: selectedClub.primary }}
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

                    {/* Club Switcher -> Each Club Displays a Different Page Snippet & Unique Club Data */}
                    <div className="pt-4 space-y-2">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                            Click a club below to preview different pages of the hub:
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
                                            style={{ backgroundColor: club.primary }}
                                        />
                                        <span>{club.clubLabel}</span>
                                        <span
                                            className={`text-[10px] px-1.5 py-0.5 rounded font-extrabold ${
                                                active
                                                    ? "bg-slate-900 text-white"
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
                {/* HERO APP WINDOW: DYNAMICALLY SHOWS A DIFFERENT PAGE PER CLUB  */}
                {/* ============================================================= */}
                <div className="max-w-6xl mx-auto mt-8">
                    <div className="rounded-2xl sm:rounded-3xl overflow-hidden border border-white/15 shadow-[0_25px_100px_-15px_rgba(0,0,0,0.85)] bg-[#0b0f19]">
                        {/* Browser Bar */}
                        <div className="h-9 bg-[#0b0f19] border-b border-white/10 px-4 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f56]" />
                                <span className="h-2.5 w-2.5 rounded-full bg-[#ffbd2e]" />
                                <span className="h-2.5 w-2.5 rounded-full bg-[#27c93f]" />
                                <span className="ml-2 text-[11px] text-slate-400 font-semibold hidden sm:inline">
                                    {selectedClub.clubLabel} — {selectedClub.pageLabel}
                                </span>
                            </div>
                            <div className="px-3 py-0.5 rounded-md bg-white/[0.05] border border-white/10 text-[10px] text-slate-300 font-mono">
                                www.clubflow.org.uk/{selectedClub.urlPath}
                            </div>
                            <div className="flex items-center gap-1.5">
                                <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded">
                                    ● {selectedClub.rank} • {selectedClub.division}
                                </span>
                            </div>
                        </div>

                        {/* App Shell */}
                        <div className="grid grid-cols-12 min-h-[440px] bg-[#f8fafc] text-slate-900">
                            {/* Left Sidebar */}
                            <div className="hidden md:flex md:col-span-3 lg:col-span-2 bg-[#0b0f19] text-slate-300 p-3.5 flex-col justify-between border-r border-slate-800">
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2.5 px-2 py-1.5">
                                        <div
                                            className="w-7 h-7 rounded-lg flex items-center justify-center font-black text-white text-xs shrink-0"
                                            style={{ backgroundColor: selectedClub.primary }}
                                        >
                                            {selectedClub.clubLabel.slice(0, 2).toUpperCase()}
                                        </div>
                                        <div className="truncate text-left">
                                            <div className="text-xs font-black text-white truncate">
                                                {selectedClub.clubLabel}
                                            </div>
                                            <div className="text-[10px] text-emerald-400 font-bold">
                                                {selectedClub.rank} • {selectedClub.division}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-1 text-xs font-semibold">
                                        {[
                                            { label: "Club Dashboard", icon: LayoutDashboard, path: "dashboard" },
                                            { label: "Squad", icon: Users, path: "squad" },
                                            { label: "Training", icon: ClipboardCheck, path: "training" },
                                            { label: "Fixtures & Results", icon: Calendar, path: "matches" },
                                            { label: "Matchday XI", icon: Shirt, path: "matchday-xi" },
                                            { label: "Opposition Reports", icon: Shield, path: "opposition" },
                                            { label: "League Table", icon: Trophy, path: "league" },
                                            { label: "Recruitment", icon: Star, path: "recruitment" },
                                        ].map((nav, i) => {
                                            const isNavActive = selectedClub.urlPath === nav.path;
                                            return (
                                                <div
                                                    key={i}
                                                    className={`flex items-center justify-between px-2.5 py-2 rounded-xl transition-colors ${
                                                        isNavActive ? "text-white font-bold shadow-sm" : "text-slate-400"
                                                    }`}
                                                    style={
                                                        isNavActive ? { backgroundColor: selectedClub.primary } : undefined
                                                    }
                                                >
                                                    <span className="flex items-center gap-2 truncate">
                                                        <nav.icon className="w-3.5 h-3.5 shrink-0" />
                                                        <span className="truncate">{nav.label}</span>
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className="p-2.5 rounded-xl bg-slate-900/90 border border-white/10 text-[10px] text-slate-400 text-left space-y-0.5">
                                    <div className="font-bold text-white">{selectedClub.clubLabel}</div>
                                    <div>First Team Squad Active</div>
                                </div>
                            </div>

                            {/* CLUB 1: NORTHBROOK UNITED -> FIXTURES, RESULTS & GOALSCORERS */}
                            {selectedClub.id === "northbrook" && (
                                <div className="col-span-12 md:col-span-9 lg:col-span-10 p-4 sm:p-6 space-y-4 bg-[#f8fafc] text-left">
                                    <div
                                        className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs border-l-4"
                                        style={{ borderLeftColor: selectedClub.primary }}
                                    >
                                        <div className="flex flex-wrap items-center justify-between gap-4">
                                            <div className="space-y-2">
                                                <div className="flex items-center gap-2">
                                                    <span
                                                        className="px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider text-white"
                                                        style={{ backgroundColor: selectedClub.primary }}
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
                                                        Northbrook United
                                                    </span>
                                                    <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-200 text-xs font-black">
                                                        #1
                                                    </span>
                                                    <span className="text-sm font-bold text-slate-400">VS</span>
                                                    <span className="text-xl sm:text-2xl font-black text-slate-600">
                                                        Kingswood Athletic
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
                                                        <MapPin className="w-3.5 h-3.5" /> Northbrook Park
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="flex flex-wrap items-center gap-2">
                                                <span
                                                    className="px-3.5 py-2 rounded-lg text-white text-xs font-bold flex items-center gap-1.5 shadow-xs"
                                                    style={{ backgroundColor: selectedClub.primary }}
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

                                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                                        <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 p-3.5 space-y-2.5">
                                            <div className="flex items-center justify-between">
                                                <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">
                                                    Northbrook Recent Results
                                                </span>
                                                <span className="text-[11px] font-bold text-emerald-600">
                                                    Form: W • W • D • W • W
                                                </span>
                                            </div>
                                            {[
                                                {
                                                    opp: "Kingswood Athletic",
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
                                                    opp: "Silverdale Rovers",
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
                                                                m.res === "W" ? "bg-emerald-500" : "bg-amber-500"
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
                                                    Top Goalscorers & Appearances
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
                                                    className="flex items-center justify-between py-1.5 px-2 rounded-lg text-xs border-b border-slate-100 last:border-0"
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
                                                            style={{ backgroundColor: selectedClub.primary }}
                                                        >
                                                            {p.goals}G
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* CLUB 2: OAKWOOD ALBION -> MATCHDAY XI & TACTICS PITCH */}
                            {selectedClub.id === "oakwood" && (
                                <div className="col-span-12 md:col-span-9 lg:col-span-10 p-4 sm:p-6 bg-[#f8fafc] grid grid-cols-1 lg:grid-cols-12 gap-5 text-left items-center">
                                    <div className="lg:col-span-5 space-y-3">
                                        <span className="px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-[11px] font-black">
                                            Oakwood Albion • Matchday XI vs Redbridge Town
                                        </span>
                                        <h3 className="text-xl font-black text-slate-900">
                                            4-2-3-1 Starting Lineup & Substitutes
                                        </h3>
                                        <div className="bg-white rounded-xl border border-slate-200 p-3 space-y-2 text-xs">
                                            <div className="font-black text-slate-700 uppercase text-[10px]">
                                                Substitutes Bench (5)
                                            </div>
                                            {[
                                                "12. K. O'Connor (GK)",
                                                "14. M. Richards (CB / RB)",
                                                "15. D. Alston (CM)",
                                                "16. E. Boateng (LW / RW)",
                                                "17. S. Callaghan (ST)",
                                            ].map((sub, i) => (
                                                <div
                                                    key={i}
                                                    className="py-1.5 px-2.5 rounded bg-slate-50 border border-slate-100 font-semibold text-slate-800"
                                                >
                                                    {sub}
                                                </div>
                                            ))}
                                        </div>
                                        <div className="p-3 rounded-xl bg-white border border-slate-200 text-xs space-y-1">
                                            <div className="font-bold text-slate-900">Oakwood Top Scorers</div>
                                            <div className="text-slate-600">
                                                1. H. Kane-Smith (14G) • 2. O. Bowen (9G) • 3. J. Bellingham-Hall (7G)
                                            </div>
                                        </div>
                                    </div>

                                    <div className="lg:col-span-7">
                                        <div className="relative rounded-2xl overflow-hidden border border-emerald-500/30 bg-gradient-to-b from-emerald-950 via-emerald-900/90 to-emerald-950 aspect-[16/10] p-4 shadow-xl">
                                            <div className="absolute inset-3 border border-white/20 rounded-xl pointer-events-none" />
                                            <div className="absolute left-3 right-3 top-1/2 border-t border-white/20 pointer-events-none" />
                                            {[
                                                { x: 50, y: 88, name: "Pickford-Sims", num: 1, gk: true },
                                                { x: 18, y: 68, name: "Shaw", num: 3 },
                                                { x: 38, y: 72, name: "Tarkowski", num: 5 },
                                                { x: 62, y: 72, name: "Branthwaite", num: 6 },
                                                { x: 82, y: 68, name: "Trippier", num: 2 },
                                                { x: 36, y: 52, name: "Wharton", num: 4 },
                                                { x: 64, y: 52, name: "Mainoo", num: 8 },
                                                { x: 20, y: 30, name: "Eze", num: 11 },
                                                { x: 50, y: 32, name: "Bellingham-Hall", num: 10 },
                                                { x: 80, y: 30, name: "Bowen", num: 7 },
                                                { x: 50, y: 14, name: "Kane-Smith", num: 9 },
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
                                                                ? selectedClub.gk
                                                                : selectedClub.primary,
                                                        }}
                                                    >
                                                        {p.num}
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

                            {/* CLUB 3: RIVERSIDE ATHLETIC -> TRAINING ATTENDANCE & WEEKLY PLAN */}
                            {selectedClub.id === "riverside" && (
                                <div className="col-span-12 md:col-span-9 lg:col-span-10 p-4 sm:p-6 bg-[#f8fafc] space-y-4 text-left">
                                    <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200">
                                        <div>
                                            <span className="text-[10px] font-black uppercase text-emerald-600">
                                                WEEKLY PLANNING & TRAINING ATTENDANCE
                                            </span>
                                            <h3 className="text-xl font-black text-slate-900">
                                                Wednesday 3G Session — Transition & Set Pieces
                                            </h3>
                                            <p className="text-xs text-slate-500">
                                                📍 Riverbank 3G Pitch 2 • 20:00 – 21:30 • 21 Players Confirmed
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="text-right">
                                                <div className="text-xl font-black text-emerald-600">88%</div>
                                                <div className="text-[10px] font-bold text-slate-400 uppercase">
                                                    Season Attendance
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-2.5">
                                            <div className="text-xs font-black uppercase text-slate-500">
                                                Training Attendance Leaders (Riverside Athletic)
                                            </div>
                                            {[
                                                { name: "C. Gallagher-Reid", pos: "CM", rate: "100% (14/14)", status: "In Starting XI" },
                                                { name: "B. White-Simmonds", pos: "RB", rate: "93% (13/14)", status: "In Starting XI" },
                                                { name: "A. Wharton-Clarke", pos: "CDM", rate: "93% (13/14)", status: "In Starting XI" },
                                                { name: "D. Solanke-Grant", pos: "ST", rate: "86% (12/14)", status: "16 Season Goals" },
                                            ].map((t, i) => (
                                                <div
                                                    key={i}
                                                    className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-xs"
                                                >
                                                    <div>
                                                        <div className="font-bold text-slate-900">{t.name}</div>
                                                        <div className="text-[10px] text-slate-500">{t.pos} • {t.status}</div>
                                                    </div>
                                                    <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 font-black text-[11px]">
                                                        {t.rate}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>

                                        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-2.5">
                                            <div className="text-xs font-black uppercase text-slate-500">
                                                Riverside Recent Results & Scorers
                                            </div>
                                            {[
                                                { opp: "Waltham Forest XI", score: "3 - 0 W", scorers: "Solanke-Grant (2), Reid" },
                                                { opp: "woodford Town Res", score: "2 - 1 W", scorers: "Solanke-Grant, Bowen-Lee" },
                                                { opp: "Epping Athletic", score: "1 - 1 D", scorers: "Wharton-Clarke" },
                                            ].map((m, i) => (
                                                <div
                                                    key={i}
                                                    className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-xs flex items-center justify-between"
                                                >
                                                    <div>
                                                        <div className="font-bold text-slate-900">vs {m.opp}</div>
                                                        <div className="text-[10px] text-slate-500">⚽ {m.scorers}</div>
                                                    </div>
                                                    <span className="font-black text-emerald-700">{m.score}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* CLUB 4: WESTBOURNE TOWN -> RECRUITMENT & TRIALIST PIPELINE */}
                            {selectedClub.id === "westbourne" && (
                                <div className="col-span-12 md:col-span-9 lg:col-span-10 p-4 sm:p-6 bg-[#f8fafc] space-y-4 text-left">
                                    <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200">
                                        <div>
                                            <span className="text-[10px] font-black uppercase text-amber-600">
                                                WESTBOURNE TOWN • RECRUITMENT & TRIALIST PIPELINE
                                            </span>
                                            <h3 className="text-xl font-black text-slate-900">
                                                Active Scouting Targets & Trialists (14)
                                            </h3>
                                        </div>
                                        <span className="px-3.5 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold flex items-center gap-1.5">
                                            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" /> Export to Excel (.xlsx)
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                                        {[
                                            {
                                                name: "Jayden Vance",
                                                pos: "LB / LWB",
                                                club: "Hillside Athletic U23",
                                                stage: "Invited to Trial",
                                                stars: 5,
                                                note: "Quick overlapping left-back, played Step 5 last season.",
                                            },
                                            {
                                                name: "Marcus Osei",
                                                pos: "CDM / CM",
                                                club: "Brookside Wanderers",
                                                stage: "On Trial (2 Sessions)",
                                                stars: 4,
                                                note: "Strong ball-winner, trained Wednesday night — ready to sign.",
                                            },
                                            {
                                                name: "Daniel Knight",
                                                pos: "ST / RW",
                                                club: "Free Agent",
                                                stage: "Priority Target",
                                                stars: 5,
                                                note: "18 goals in County Premier last year. Available immediately.",
                                            },
                                        ].map((t, i) => (
                                            <div
                                                key={i}
                                                className="p-4 rounded-xl bg-white border border-slate-200 space-y-2"
                                            >
                                                <div className="flex items-center justify-between">
                                                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-bold text-[10px]">
                                                        {t.pos}
                                                    </span>
                                                    <span className="text-amber-500 text-xs font-black">
                                                        {"★".repeat(t.stars)}
                                                    </span>
                                                </div>
                                                <div>
                                                    <div className="font-black text-slate-900 text-sm">{t.name}</div>
                                                    <div className="text-[11px] text-slate-500">{t.club}</div>
                                                </div>
                                                <p className="text-xs text-slate-600">{t.note}</p>
                                                <div className="pt-1 flex items-center justify-between">
                                                    <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold">
                                                        {t.stage}
                                                    </span>
                                                    <span className="text-[11px] font-bold text-slate-900">
                                                        Sign to Squad →
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* CLUB 5: ASHFORD PARK FC -> OPPOSITION REPORTS & LEAGUE INSIGHTS */}
                            {selectedClub.id === "ashford" && (
                                <div className="col-span-12 md:col-span-9 lg:col-span-10 p-4 sm:p-6 bg-[#f8fafc] space-y-4 text-left">
                                    <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200">
                                        <div>
                                            <span className="text-[10px] font-black uppercase text-rose-700">
                                                OPPOSITION SCOUTING REPORT & TABLE INSIGHTS
                                            </span>
                                            <h3 className="text-xl font-black text-slate-900">
                                                Upcoming Opponent: Silverdale Athletic (#2nd • 2.25 PPG)
                                            </h3>
                                            <p className="text-xs text-slate-500">
                                                Expected System: 3-5-2 Wingbacks • Danger Man: #9 L. Griffiths (15 Goals)
                                            </p>
                                        </div>
                                        <span className="px-3 py-1.5 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 text-xs font-bold">
                                            Head-to-Head: 2W - 1D - 0L
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-2">
                                            <div className="text-xs font-black uppercase text-slate-500">
                                                Tactical Notes on Silverdale Athletic
                                            </div>
                                            <ul className="text-xs text-slate-700 space-y-1.5 list-disc pl-4">
                                                <li>Concede 68% of their goals in the final 25 minutes of matches.</li>
                                                <li>High wingbacks leave space in behind for our wide forwards on the counter.</li>
                                                <li>Strong on in-swinging corners to the front post — assign zonal marker.</li>
                                            </ul>
                                        </div>
                                        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-2">
                                            <div className="text-xs font-black uppercase text-slate-500">
                                                Ashford Park FC Top Goalscorers
                                            </div>
                                            <div className="space-y-1.5 text-xs">
                                                <div className="flex justify-between py-1 border-b border-slate-100">
                                                    <span className="font-bold text-slate-900">1. T. Abraham-Wells (ST)</span>
                                                    <span className="font-black text-rose-700">19 Goals (11 Starts)</span>
                                                </div>
                                                <div className="flex justify-between py-1 border-b border-slate-100">
                                                    <span className="font-bold text-slate-900">2. K. Mitoma-Clarke (LW)</span>
                                                    <span className="font-black text-rose-700">11 Goals (12 Starts)</span>
                                                </div>
                                                <div className="flex justify-between py-1">
                                                    <span className="font-bold text-slate-900">3. R. Loftus-Hall (CM)</span>
                                                    <span className="font-black text-rose-700">6 Goals (10 Starts)</span>
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
            {/* INSIDE THE APP: CLEAN 6-TAB PREVIEW (NO HOTSPOT PINS)             */}
            {/* ================================================================= */}
            <section id="preview" className="relative z-10 py-20 max-w-7xl mx-auto px-4 sm:px-6 space-y-8">
                <div className="text-center space-y-2 max-w-2xl mx-auto">
                    <span
                        className="text-xs font-black uppercase tracking-widest"
                        style={{ color: selectedClub.primary }}
                    >
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
                                        ? "bg-white text-slate-950 border-white shadow-lg"
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

                {/* Clean Screen Frame */}
                <div className="rounded-2xl sm:rounded-3xl overflow-hidden border border-white/15 bg-[#0c101b] shadow-2xl">
                    <div className="h-9 bg-[#0c101b] border-b border-white/10 px-4 flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                            <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f56]" />
                            <span className="h-2.5 w-2.5 rounded-full bg-[#ffbd2e]" />
                            <span className="h-2.5 w-2.5 rounded-full bg-[#27c93f]" />
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono">{currentTabObj.url}</div>
                        <div className="w-12" />
                    </div>

                    {/* TAB: LEAGUE TABLE & INSIGHTS (RICH MOCK TABLE WITH FORM & PPG) */}
                    {activeWorkspace === "league" && (
                        <div className="p-5 sm:p-8 bg-[#f8fafc] text-slate-900 space-y-5 text-left">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                                <div className="p-3.5 rounded-xl bg-white border border-slate-200">
                                    <div className="text-[10px] font-black uppercase text-slate-400">
                                        CURRENT POINTS PER GAME (PPG)
                                    </div>
                                    <div className="text-2xl font-black text-slate-900 mt-0.5">2.58 PPG</div>
                                    <div className="text-xs text-emerald-600 font-bold">
                                        On pace for 72 pts (Title Pace)
                                    </div>
                                </div>
                                <div className="p-3.5 rounded-xl bg-white border border-slate-200">
                                    <div className="text-[10px] font-black uppercase text-slate-400">
                                        GOALS SCORED / CONCEDED PER GAME
                                    </div>
                                    <div className="text-2xl font-black text-slate-900 mt-0.5">2.83 GF • 0.91 GA</div>
                                    <div className="text-xs text-slate-500">Best goal difference in division (+23)</div>
                                </div>
                                <div className="p-3.5 rounded-xl bg-white border border-slate-200">
                                    <div className="text-[10px] font-black uppercase text-slate-400">
                                        NEXT OPPONENT FORM (#8 KINGSWOOD)
                                    </div>
                                    <div className="text-2xl font-black text-amber-600 mt-0.5">1.27 PPG</div>
                                    <div className="text-xs text-slate-500">Last 5: L - W - L - D - W</div>
                                </div>
                            </div>

                            <div className="bg-white rounded-2xl border border-slate-200 overflow-x-auto">
                                <table className="w-full text-left text-xs">
                                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px] font-black">
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
                                            <th className="py-3 px-4 text-right">Last 5 Form</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 font-medium">
                                        {[
                                            { pos: 1, team: selectedClub.clubLabel, p: 12, w: 10, d: 1, l: 1, gd: "+23", ppg: "2.58", pts: 31, form: ["W", "W", "W", "D", "W"], ours: true },
                                            { pos: 2, team: "Silverdale Athletic", p: 12, w: 8, d: 3, l: 1, gd: "+14", ppg: "2.25", pts: 27, form: ["W", "D", "W", "W", "L"], ours: false },
                                            { pos: 3, team: "Oakwood Albion", p: 12, w: 7, d: 2, l: 3, gd: "+7", ppg: "1.92", pts: 23, form: ["L", "W", "W", "D", "W"], ours: false },
                                            { pos: 4, team: "Meadowbank Town", p: 12, w: 6, d: 3, l: 3, gd: "+5", ppg: "1.75", pts: 21, form: ["D", "W", "L", "W", "D"], ours: false },
                                            { pos: 8, team: "Kingswood Athletic (Next Opp)", p: 11, w: 4, d: 2, l: 5, gd: "-1", ppg: "1.27", pts: 14, form: ["L", "W", "L", "D", "W"], ours: false },
                                        ].map((r) => (
                                            <tr
                                                key={r.pos}
                                                className={r.ours ? "bg-rose-50/60 font-bold" : "hover:bg-slate-50"}
                                            >
                                                <td className="py-3 px-4 font-black text-slate-900">{r.pos}</td>
                                                <td className="py-3 px-4 font-black text-slate-900">{r.team}</td>
                                                <td className="py-3 px-3 text-center">{r.p}</td>
                                                <td className="py-3 px-3 text-center">{r.w}</td>
                                                <td className="py-3 px-3 text-center">{r.d}</td>
                                                <td className="py-3 px-3 text-center">{r.l}</td>
                                                <td className="py-3 px-3 text-center font-bold text-emerald-700">{r.gd}</td>
                                                <td className="py-3 px-3 text-center text-slate-600">{r.ppg}</td>
                                                <td className="py-3 px-3 text-center font-black text-slate-900">{r.pts}</td>
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

                    {/* TAB: CLUB DASHBOARD */}
                    {activeWorkspace === "dashboard" && (
                        <div className="p-5 sm:p-8 bg-[#f8fafc] text-slate-900 space-y-5">
                            <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                                <div className="flex items-center gap-3.5">
                                    <div
                                        className="w-12 h-12 rounded-2xl flex items-center justify-center font-black text-white text-lg"
                                        style={{ backgroundColor: selectedClub.primary }}
                                    >
                                        {selectedClub.clubLabel.slice(0, 2).toUpperCase()}
                                    </div>
                                    <div className="text-left">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xl font-black text-slate-900">
                                                {selectedClub.clubLabel}
                                            </span>
                                            <span className="px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-200 text-xs font-black">
                                                🏆 {selectedClub.rank} in League
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

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
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
                                        TRAINING ATTENDANCE
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <div className="text-base font-black text-slate-900">Wed Night 3G</div>
                                            <div className="text-xs text-slate-500">21 Players Confirmed</div>
                                        </div>
                                        <div className="text-2xl font-black text-sky-600">88%</div>
                                    </div>
                                </div>
                                <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-2">
                                    <div className="text-[10px] font-black uppercase text-emerald-600">
                                        NEXT FIXTURE
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <div className="text-base font-black text-slate-900">
                                                vs Kingswood Athletic (#8)
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

                    {/* TAB: MATCHDAY XI */}
                    {activeWorkspace === "matchday-xi" && (
                        <div className="p-5 sm:p-8 bg-[#0b0f19] text-white grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                            <div className="lg:col-span-5 space-y-4 text-left">
                                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold">
                                    <Shirt className="w-3.5 h-3.5" /> Matchday XI & Formations
                                </div>
                                <h4 className="text-2xl font-black text-white">
                                    Set your formation, manage your bench & export your graphic
                                </h4>
                                <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                                    Switch between 1–11 matchday shirt numbers or fixed squad numbers, and export your
                                    pitch graphic named automatically after your opposition and date.
                                </p>

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
                                                        ? selectedClub.gk
                                                        : selectedClub.primary,
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

                    {/* TAB: TRAINING ATTENDANCE */}
                    {activeWorkspace === "training" && (
                        <div className="p-5 sm:p-8 bg-[#f8fafc] text-slate-900 space-y-4 text-left">
                            <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200">
                                <div>
                                    <span className="text-[10px] font-black uppercase text-emerald-600">
                                        WEEKLY TRAINING & ATTENDANCE TRACKER
                                    </span>
                                    <h4 className="text-lg font-black text-slate-900">
                                        Wednesday Evening Session • High Press & Finishing
                                    </h4>
                                </div>
                                <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-black">
                                    21 / 24 Players Present
                                </span>
                            </div>

                            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                                <table className="w-full text-left text-xs">
                                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px] font-black">
                                        <tr>
                                            <th className="py-3 px-4">Player</th>
                                            <th className="py-3 px-3">Pos</th>
                                            <th className="py-3 px-3 text-center">Sessions Attended</th>
                                            <th className="py-3 px-3 text-center">Attendance %</th>
                                            <th className="py-3 px-4 text-right">This Week</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 font-medium">
                                        {[
                                            { name: "Jack Mercer", pos: "ST", attended: "14 / 14", pct: "100%", status: "Present" },
                                            { name: "Ryan Brooks", pos: "CM", attended: "13 / 14", pct: "93%", status: "Present" },
                                            { name: "Harry Gallagher", pos: "CB", attended: "13 / 14", pct: "93%", status: "Present" },
                                            { name: "Liam Sterling", pos: "RW", attended: "12 / 14", pct: "86%", status: "Present" },
                                        ].map((row, i) => (
                                            <tr key={i}>
                                                <td className="py-3 px-4 font-black text-slate-900">{row.name}</td>
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

                    {/* TAB: RECRUITMENT */}
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

                    {/* TAB: SQUAD & APPEARANCES */}
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
                </div>
            </section>

            {/* ================================================================= */}
            {/* FEATURES GRID + FULL-SIZE MOBILE VIEW                             */}
            {/* ================================================================= */}
            <section
                id="features"
                className="relative z-10 py-20 border-t border-white/[0.08] bg-slate-950/50 px-4 sm:px-6"
            >
                <div className="max-w-7xl mx-auto space-y-12">
                    <div className="text-center space-y-2 max-w-2xl mx-auto">
                        <span
                            className="text-xs font-black uppercase tracking-widest"
                            style={{ color: selectedClub.primary }}
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
                                icon: TrendingUp,
                                title: "Deeper League Table Insights",
                                desc: "Go beyond a basic table—see points-per-game (PPG), recent form guides, home vs away splits, and how your next opponent is trending.",
                            },
                            {
                                icon: ClipboardCheck,
                                title: "Plan the Week & Training Attendance",
                                desc: "Schedule training sessions, monitor player attendance rates across the season, and see who has been putting the work in before picking your XI.",
                            },
                            {
                                icon: Shield,
                                title: "Opposition Reports",
                                desc: "Build scouting reports on every team in your division—record their formation, danger men, set-piece habits, and head-to-head history.",
                            },
                            {
                                icon: Star,
                                title: "Recruitment & Trialist Pipeline",
                                desc: "Keep track of players you’ve watched across the season, manage trialists coming into training, and export your target list to Excel.",
                            },
                            {
                                icon: Shirt,
                                title: "Matchday XI & Squad Stats",
                                desc: "Build your starting XI and bench, track starts, sub appearances, goals, and loan deals, and share your lineup graphic on matchday.",
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
                                <div
                                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                                    style={{
                                        backgroundColor: selectedClub.badgeBg,
                                        color: selectedClub.primary,
                                    }}
                                >
                                    <card.icon className="w-5 h-5" />
                                </div>
                                <h3 className="text-base sm:text-lg font-black text-white">{card.title}</h3>
                                <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">{card.desc}</p>
                            </div>
                        ))}
                    </div>

                    {/* Full-Scale Mobile Interface Showcase */}
                    <div className="pt-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center bg-slate-900/60 border border-white/10 rounded-3xl p-6 sm:p-10">
                        <div className="lg:col-span-5 space-y-4 text-left">
                            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-xs font-bold">
                                <Smartphone className="w-3.5 h-3.5" /> Built for Mobile & Desktop
                            </span>
                            <h3 className="text-2xl sm:text-3xl font-black text-white leading-tight">
                                Designed to be used properly on your phone.
                            </h3>
                            <p className="text-sm text-slate-400 leading-relaxed">
                                Most managers live on their phone during the week and on Saturday afternoon. Every page
                                in ClubFlow has a dedicated mobile layout—with clean player cards, bottom navigation,
                                1-tap WhatsApp poll copying, and quick result logging.
                            </p>
                        </div>

                        {/* Large, Readable Dual Mobile Screens */}
                        <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-5">
                            {/* Phone 1: Mobile Squad & Appearances */}
                            <div className="rounded-[28px] bg-[#0b0f19] border-2 border-slate-800 p-4 shadow-2xl space-y-3 text-left">
                                <div className="w-16 h-1.5 bg-slate-800 rounded-full mx-auto" />
                                <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                                    <div>
                                        <div className="text-xs font-black text-white">Squad & Stats</div>
                                        <div className="text-[10px] text-slate-400">27 Active Players</div>
                                    </div>
                                    <span
                                        className="px-2.5 py-1 rounded-lg text-[10px] font-black text-white"
                                        style={{ backgroundColor: selectedClub.primary }}
                                    >
                                        + Add Player
                                    </span>
                                </div>

                                <div className="space-y-2">
                                    {[
                                        { name: "Jack Mercer", pos: "ST", starts: 12, sub: 0, goals: 22, status: "Available" },
                                        { name: "Liam Sterling", pos: "RW", starts: 5, sub: 6, goals: 8, status: "Dual-Reg" },
                                        { name: "Ryan Brooks", pos: "CM", starts: 11, sub: 0, goals: 1, status: "Available" },
                                    ].map((p, i) => (
                                        <div
                                            key={i}
                                            className="p-3 rounded-xl bg-slate-900 border border-white/10 space-y-1.5"
                                        >
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs font-black text-white">{p.name}</span>
                                                <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
                                                    {p.status}
                                                </span>
                                            </div>
                                            <div className="flex items-center justify-between text-[11px] text-slate-400">
                                                <span>{p.pos}</span>
                                                <span>
                                                    Starts: <strong className="text-white">{p.starts}</strong> ({p.sub} Sub)
                                                </span>
                                                <span className="font-black text-rose-400">{p.goals} Goals</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Phone 2: Mobile Matchday & Fines */}
                            <div className="rounded-[28px] bg-[#0b0f19] border-2 border-slate-800 p-4 shadow-2xl space-y-3 text-left">
                                <div className="w-16 h-1.5 bg-slate-800 rounded-full mx-auto" />
                                <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                                    <div>
                                        <div className="text-xs font-black text-white">Matchday & Fines</div>
                                        <div className="text-[10px] text-slate-400">Saturday Touchline</div>
                                    </div>
                                    <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
                                        KO 15:00
                                    </span>
                                </div>

                                <div
                                    className="p-3 rounded-xl text-white space-y-1"
                                    style={{ backgroundColor: selectedClub.primary }}
                                >
                                    <div className="text-[10px] font-bold uppercase opacity-90">
                                        Next Up • Home
                                    </div>
                                    <div className="text-sm font-black">
                                        {selectedClub.clubLabel} vs Kingswood
                                    </div>
                                    <div className="text-[11px] opacity-90">
                                        Meet 13:30 • 4-3-3 Lineup Saved
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <div className="p-2.5 rounded-xl bg-slate-900 border border-white/10 flex items-center justify-between text-xs">
                                        <span className="text-slate-200 font-semibold">📋 Copy WhatsApp Poll</span>
                                        <span className="text-emerald-400 font-bold">1-Tap Copy</span>
                                    </div>
                                    <div className="p-2.5 rounded-xl bg-slate-900 border border-white/10 flex items-center justify-between text-xs">
                                        <span className="text-slate-200 font-semibold">⚖️ Late for Meet Fine</span>
                                        <span className="text-amber-400 font-bold">+ £5 Logged</span>
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
                <div
                    className="max-w-4xl mx-auto rounded-3xl border border-white/15 p-8 sm:p-12 text-center space-y-6 shadow-2xl"
                    style={{
                        background: `linear-gradient(135deg, ${selectedClub.primary}26 0%, rgba(11,15,25,0.96) 65%)`,
                    }}
                >
                    <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight">
                        Ready to set up your club?
                    </h2>
                    <p className="text-sm sm:text-base text-slate-300 max-w-xl mx-auto">
                        Create your club hub, upload your badge, and get your squad and season organised in minutes.
                    </p>
                    <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
                        <Link
                            href="/signup"
                            className="px-8 py-4 rounded-xl font-black text-sm text-white shadow-xl transition-all hover:scale-[1.02] flex items-center gap-2"
                            style={{ backgroundColor: selectedClub.primary }}
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
                            style={{ backgroundColor: selectedClub.primary }}
                        >
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