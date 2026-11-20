"use client";

import { useState, useEffect } from "react";
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
    X,
    Plus,
    CreditCard,
    Activity,
    Copy,
    Check,
    Home,
    Plane,
    AlertCircle,
    AlertTriangle,
    Settings,
    Coins,
    Target,
    UserPlus,
    CheckCircle2,
    ChevronDown,
    Share2,
    RefreshCw,
    Flame,
    FileText,
    Swords,
    Zap,
    MessageCircle,
    Palette,
    Image as ImageIcon,
} from "lucide-react";

type ShowcaseTabId =
    | "dashboard"
    | "squad"
    | "matchday-xi"
    | "training"
    | "fixtures"
    | "recruitment"
    | "opposition";

const SHOWCASE_TABS: {
    id: ShowcaseTabId;
    label: string;
    shortLabel: string;
    url: string;
    badge: string;
    headline: string;
    description: string;
}[] = [
    {
        id: "dashboard",
        label: "Club Dashboard",
        shortLabel: "Dashboard",
        url: "app.clubflow.org.uk/dashboard",
        badge: "Club Command Centre",
        headline: "Your entire week at a glance — form, home/away splits, next fixture, training & leaderboards.",
        description:
            "Log in whenever suits you and immediately see what needs attention, who is attending training, how your last match went, and who leads the squad in goals, assists, MOTM awards, and training commitment.",
    },
    {
        id: "squad",
        label: "Player Squad",
        shortLabel: "Squad",
        url: "app.clubflow.org.uk/squad",
        badge: "Squad & Player Stats",
        headline: "Every player’s appearances, sub minutes, goals, assists & yellow-card suspension risks in one table.",
        description:
            "Synced automatically from your Matchday Planner and logged results — see starts vs sub cameos, playing minutes, assists, medical availability, and who is one yellow card away from a ban.",
    },
    {
        id: "matchday-xi",
        label: "Matchday Planner",
        shortLabel: "Matchday Planner",
        url: "app.clubflow.org.uk/matchday-xi",
        badge: "Selection & Tactics",
        headline: "Pick your starting XI from available players, assign set pieces & export your matchday graphic.",
        description:
            "Filter available players by position, see who started the previous game, toggle between 1–11 or fixed squad numbers, customise kit colours, and keep your bench and set-piece roles synchronised.",
    },
    {
        id: "training",
        label: "Training & Attendance",
        shortLabel: "Training",
        url: "app.clubflow.org.uk/training",
        badge: "Mid-Week Planning",
        headline: "Plan your weekly schedule and see exactly who has been turning up before you pick the team.",
        description:
            "Schedule mid-week sessions on the 7-day football calendar, record attendance and late arrivals, track active streaks, and review every player's last 5 sessions and seasonal commitment percentage.",
    },
    {
        id: "fixtures",
        label: "Fixtures & Results",
        shortLabel: "Fixtures",
        url: "app.clubflow.org.uk/matches",
        badge: "Season Schedule",
        headline: "Every league and cup fixture, result, goalscorer, assist, and saved lineup in one timeline.",
        description:
            "Log match results in seconds, record goals, assists, cards, and Man of the Match awards, and jump straight into the saved Matchday Planner or opposition report for any fixture.",
    },
    {
        id: "recruitment",
        label: "Player Recruitment",
        shortLabel: "Recruitment",
        url: "app.clubflow.org.uk/recruitment",
        badge: "Player Recruitment",
        headline: "Track players you’ve watched, manage trialists in training, and convert signings to your squad.",
        description:
            "Move targets through Scouted, Contacted, Invited to Training, On Trial, and Signed stages. Keep scouting notes, star ratings, and positions organised and exportable to Excel or PDF.",
    },
    {
        id: "opposition",
        label: "Opposition Reports",
        shortLabel: "Opposition",
        url: "app.clubflow.org.uk/opposition",
        badge: "Match Preparation",
        headline: "Build structured opposition reports on every team in your division and flag their danger men.",
        description:
            "Document how your next opponents build up in possession, defend out of possession, and set up on corners — and send standout opposition players straight to your recruitment shortlist.",
    },
];

const FAQ_ITEMS = [
    {
        q: "Who is ClubFlow built for?",
        a: "ClubFlow is designed specifically for Grassroots, Semi-Pro, and Academies — built for football managers, coaches, and club secretaries who want a proper operational setup without enterprise complexity.",
    },
    {
        q: "Does ClubFlow work on mobile as well as laptop and desktop?",
        a: "Yes. Every screen in ClubFlow is built to work on both desktop and mobile browsers. You can plan your Matchday Planner and opposition reports on a laptop mid-week, then check attendance, log match stats, or copy your WhatsApp briefing pitchside from your phone.",
    },
    {
        q: "How long does it take to set up my club?",
        a: "You can create your club workspace in under two minutes. Once inside, you can add or import your squad, set your club colours and division, and immediately begin scheduling training and fixtures.",
    },
    {
        q: "Can I bring in my existing league table, fixtures, and squad list?",
        a: "Yes. ClubFlow supports syncing league standings and fixtures as well as importing and exporting player, attendance, and recruitment data via Excel/CSV so you don't have to type everything from scratch.",
    },
    {
        q: "Can I export graphics and spreadsheets for my coaching staff and players?",
        a: "Yes. You can export Matchday Planner pitch graphics, training attendance leaderboards, one-click WhatsApp fixture and training briefings, and Excel/PDF reports for recruitment and squad records.",
    },
    {
        q: "Is our club data private to our staff?",
        a: "Yes. Your squad availability, tactical lineups, opposition scouting reports, recruitment targets, and financial ledgers are strictly private to your authenticated club workspace.",
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
            className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center select-none transition-all duration-500 ease-out"
            style={{ left: `${x}%`, top: `${y}%` }}
        >
            <div className="relative flex flex-col items-center">
                <svg
                    className={`${
                        compact ? "w-6 h-6" : "w-8 h-8 sm:w-9 sm:h-9"
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
                        y="64"
                         fontFamily="Arial, sans-serif"
                        fontSize="28"
                        fontWeight="900"
                        fill={textColor}
                        textAnchor="middle"
                    >
                        {number}
                    </text>
                </svg>

                {isCaptain && (
                    <div
                        className={`absolute -top-0.5 -right-1.5 ${
                            compact ? "w-3.5 h-3.5 text-[7px]" : "w-4 h-4 text-[8px]"
                        } rounded-full bg-amber-400 text-neutral-950 font-black flex items-center justify-center border border-black z-20 shadow`}
                    >
                        C
                    </div>
                )}

                {badge && (
                    <div className="absolute -top-1 -left-2 px-1 py-0.2 rounded bg-red-600 text-white font-black text-[7px] border border-white/40 z-20 shadow">
                        {badge}
                    </div>
                )}

                <div
                    className={`bg-neutral-900/95 text-white ${
                        compact ? "text-[7px] px-1.5 py-0.5" : "text-[9px] sm:text-[10px] px-2 py-0.5"
                    } font-bold rounded shadow-md whitespace-nowrap border border-white/20 flex items-center gap-1 z-20 -mt-1`}
                >
                    <span>{name}</span>
                </div>
            </div>
        </div>
    );
}

/**
 * Standard Pitch Markings matching src/app/matchday-xi/page.tsx
 */
function RealisticPitchMarkings({ children }: { children: React.ReactNode }) {
    return (
        <div className="relative w-full h-full bg-[#2b7c3d] rounded-xl overflow-hidden border-[3px] border-white/90 shadow-inner select-none">
            <div
                className="absolute inset-0 opacity-15 pointer-events-none"
                style={{
                    backgroundImage:
                        "repeating-linear-gradient(0deg, transparent, transparent 10%, rgba(255,255,255,0.18) 10%, rgba(255,255,255,0.18) 20%)",
                }}
            />
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-1/2 left-0 right-0 h-[2px] bg-white/60 -translate-y-1/2" />
                <div className="absolute top-1/2 left-1/2 w-20 h-20 border-[2px] border-white/60 rounded-full -translate-x-1/2 -translate-y-1/2" />
                <div className="absolute top-1/2 left-1/2 w-1.5 h-1.5 bg-white/60 rounded-full -translate-x-1/2 -translate-y-1/2" />
                <div className="absolute top-0 left-1/2 w-36 h-14 border-b-[2px] border-x-[2px] border-white/60 -translate-x-1/2" />
                <div className="absolute top-0 left-1/2 w-16 h-6 border-b-[2px] border-x-[2px] border-white/60 -translate-x-1/2" />
                <div className="absolute bottom-0 left-1/2 w-36 h-14 border-t-[2px] border-x-[2px] border-white/60 -translate-x-1/2" />
                <div className="absolute bottom-0 left-1/2 w-16 h-6 border-t-[2px] border-x-[2px] border-white/60 -translate-x-1/2" />
            </div>
            {children}
        </div>
    );
}

/**
 * Interactive Sidebar matching src/components/layout/app-shell.tsx (#171717)
 */
function RealAppSidebar({
    activeNav,
    onSelectTab,
}: {
    activeNav: ShowcaseTabId;
    onSelectTab?: (tab: ShowcaseTabId) => void;
}) {
    const navGroups: {
        group: string;
        items: { name: string; id?: ShowcaseTabId; icon: any }[];
    }[] = [
        {
            group: "Overview",
            items: [{ name: "Dashboard", id: "dashboard", icon: LayoutDashboard }],
        },
        {
            group: "Football",
            items: [
                { name: "Squad", id: "squad", icon: Users },
                { name: "Training", id: "training", icon: ClipboardCheck },
                { name: "Fixtures", id: "fixtures", icon: Calendar },
                { name: "Matchday Planner", id: "matchday-xi", icon: Shirt },
                { name: "League Table", icon: Trophy },
                { name: "Opposition Reports", id: "opposition", icon: Shield },
                { name: "Recruitment", id: "recruitment", icon: UserPlus },
            ],
        },
    ];

    return (
        <div className="hidden lg:flex w-52 shrink-0 bg-[#171717] text-white flex-col justify-between border-r border-neutral-800 select-none">
            <div>
                {/* Top Brand Header */}
                <div className="h-14 flex items-center gap-2.5 px-4 border-b border-neutral-800/80">
                    <div className="w-7 h-7 rounded-lg bg-red-600 flex items-center justify-center font-black text-white text-xs shadow-sm">
                        NU
                    </div>
                    <div className="min-w-0">
                        <div className="text-xs font-black tracking-tight text-white truncate">
                            Northbrook United
                        </div>
                        <div className="text-[9px] font-bold uppercase tracking-widest text-red-500 truncate">
                            ClubFlow Hub
                        </div>
                    </div>
                </div>

                {/* Grouped Navigation */}
                <div className="px-2.5 py-3 space-y-3.5">
                    {navGroups.map((group) => (
                        <div key={group.group}>
                            <div className="px-2.5 mb-1 text-[9px] font-semibold uppercase tracking-wider text-neutral-500">
                                {group.group}
                            </div>
                            <div className="space-y-0.5">
                                {group.items.map((item) => {
                                    const Icon = item.icon;
                                    const isActive = item.id === activeNav;
                                    const isInteractive = Boolean(item.id && onSelectTab);
                                    return (
                                        <button
                                            key={item.name}
                                            type="button"
                                            onClick={() =>
                                                item.id && onSelectTab ? onSelectTab(item.id) : undefined
                                            }
                                            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-colors text-left ${
                                                isActive
                                                    ? "bg-red-600 text-white shadow-sm shadow-red-900/30 font-semibold"
                                                    : isInteractive
                                                    ? "text-neutral-300 hover:bg-neutral-800/80 hover:text-white cursor-pointer"
                                                    : "text-neutral-500 cursor-default"
                                            }`}
                                        >
                                            <span className="flex items-center gap-2 truncate">
                                                <Icon
                                                    className={`w-3.5 h-3.5 shrink-0 ${
                                                        isActive ? "text-white" : "text-neutral-400"
                                                    }`}
                                                />
                                                <span className="truncate">{item.name}</span>
                                            </span>
                                            {isInteractive && !isActive && (
                                                <span className="w-1.5 h-1.5 rounded-full bg-neutral-700" />
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Footer Settings */}
            <div className="p-2.5 border-t border-neutral-800/80 bg-[#121212]">
                <div className="flex items-center gap-2 px-2.5 py-1.5 text-[11px] text-neutral-400 font-medium">
                    <Settings className="w-3.5 h-3.5 text-neutral-500" />
                    <span>Club Settings</span>
                </div>
            </div>
        </div>
    );
}

/**
 * SCREEN 1: STREAMLINED REAL DASHBOARD (~65% content focus: Club Header + Splits, 3-Card Briefing Row, Season Leaderboards)
 */
function FullDashboardPreview({
    onNavigate,
}: {
    onNavigate: (tab: ShowcaseTabId) => void;
}) {
    return (
        <div className="p-4 sm:p-5 space-y-3.5 bg-[#FCFCFD] text-neutral-900 select-none">
            {/* 1. Club Identity Header + Form + Home/Away Splits */}
            <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-sm p-3.5 sm:p-4 flex flex-col xl:flex-row xl:items-center justify-between gap-3.5">
                <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-red-600 flex items-center justify-center font-black text-white text-sm shadow-sm shrink-0">
                        NU
                    </div>
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-base sm:text-lg font-black text-neutral-900 tracking-tight">
                                Northbrook United
                            </h3>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200/80">
                                <Trophy className="w-3 h-3 text-amber-500" /> #1st in League
                            </span>
                            <span className="text-[11px] font-semibold text-neutral-400">
                                Premier Division • 2025/26
                            </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                            <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mr-0.5">
                                Form:
                            </span>
                            {["W", "W", "D", "W", "W"].map((res, idx) => (
                                <span
                                    key={idx}
                                    className={`w-4 h-4 rounded text-[9px] font-black flex items-center justify-center text-white shadow-xs ${
                                        res === "W" ? "bg-emerald-500" : "bg-amber-400"
                                    }`}
                                >
                                    {res}
                                </span>
                            ))}
                            <span className="ml-1 text-[10px] sm:text-[11px] font-bold text-neutral-500">
                                11W – 2D – 1L (35 Pts • 2.50 PPG)
                            </span>
                        </div>
                    </div>
                </div>

                {/* Home & Away Splits */}
                <div className="grid grid-cols-2 gap-2 sm:w-auto shrink-0">
                    <div className="bg-neutral-50 rounded-xl p-2 border border-neutral-200/80 flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                            <Home className="w-3.5 h-3.5" />
                        </div>
                        <div>
                            <div className="text-[9px] font-bold uppercase tracking-wider text-neutral-400">
                                Home Split
                            </div>
                            <div className="text-xs font-black text-neutral-900">6W-1D-0L</div>
                            <div className="text-[10px] font-bold text-emerald-600">2.71 PPG</div>
                        </div>
                    </div>
                    <div className="bg-neutral-50 rounded-xl p-2 border border-neutral-200/80 flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                            <Plane className="w-3.5 h-3.5" />
                        </div>
                        <div>
                            <div className="text-[9px] font-bold uppercase tracking-wider text-neutral-400">
                                Away Split
                            </div>
                            <div className="text-xs font-black text-neutral-900">5W-1D-1L</div>
                            <div className="text-[10px] font-bold text-blue-600">2.29 PPG</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 2. Three-Column Briefing Row: Next Match | Next Training | Last Match Recap */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5">
                {/* Card 1: Next Match */}
                <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-sm p-3.5 flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                                <Calendar className="w-3.5 h-3.5 text-red-600" /> Next Match
                            </span>
                            <div className="flex items-center gap-1">
                                <span className="px-1.5 py-0.5 text-[9px] font-black uppercase rounded-md bg-red-50 text-red-700 border border-red-200">
                                    3 DAYS
                                </span>
                                <span className="px-1.5 py-0.5 text-[9px] font-extrabold uppercase rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    HOME
                                </span>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="text-sm sm:text-base font-black text-neutral-900">
                                vs Kingswood Rovers
                            </div>
                            <span className="px-1.5 py-0.5 text-[10px] font-black rounded bg-neutral-100 text-neutral-700 border border-neutral-200">
                                #2nd
                            </span>
                        </div>
                        <div className="text-[11px] text-neutral-500 mt-1 space-y-0.5 font-medium">
                            <div className="flex items-center gap-1.5">
                                <Clock className="w-3 h-3 text-neutral-400" /> Sat 14 Nov • 14:00 KO
                            </div>
                            <div className="flex items-center gap-1.5">
                                <MapPin className="w-3 h-3 text-neutral-400" /> Northbrook Community Ground
                            </div>
                        </div>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-neutral-100 flex items-center gap-2">
                        <span className="flex-1 py-1.5 px-2 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200/60 font-bold text-[10px] flex items-center justify-center gap-1">
                            <Copy className="w-3 h-3" /> WhatsApp
                        </span>
                        <button
                            type="button"
                            onClick={() => onNavigate("matchday-xi")}
                            className="flex-1 py-1.5 px-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold text-[10px] text-center transition-colors cursor-pointer"
                        >
                            Matchday Planner →
                        </button>
                    </div>
                </div>

                {/* Card 2: Next Training */}
                <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-sm p-3.5 flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                                <ClipboardCheck className="w-3.5 h-3.5 text-emerald-600" /> Next Training
                            </span>
                            <span className="px-2 py-0.5 text-[9px] font-extrabold rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                                18 Attending
                            </span>
                        </div>
                        <div className="text-sm sm:text-base font-black text-neutral-900">
                            Thursday Night Session
                        </div>
                        <div className="text-[11px] text-neutral-500 mt-1 space-y-0.5 font-medium">
                            <div className="flex items-center gap-1.5">
                                <Clock className="w-3 h-3 text-neutral-400" /> Thu 12 Nov • 19:30 – 21:00
                            </div>
                            <div className="flex items-center gap-1.5">
                                <MapPin className="w-3 h-3 text-neutral-400" /> 3G Pitch 1 (Floodlit)
                            </div>
                        </div>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-neutral-100 flex items-center gap-2">
                        <span className="flex-1 py-1.5 px-2 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200/60 font-bold text-[10px] flex items-center justify-center gap-1">
                            <Copy className="w-3 h-3" /> WhatsApp
                        </span>
                        <button
                            type="button"
                            onClick={() => onNavigate("training")}
                            className="flex-1 py-1.5 px-2 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-white font-bold text-[10px] text-center transition-colors cursor-pointer"
                        >
                            Attendance →
                        </button>
                    </div>
                </div>

                {/* Card 3: Last Match Recap */}
                <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-sm p-3.5 flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                                <Activity className="w-3.5 h-3.5 text-blue-600" /> Last Match Recap
                            </span>
                            <div className="flex items-center gap-1.5">
                                <span className="text-[10px] font-bold text-neutral-400">Sat 7 Nov</span>
                                <span className="px-1.5 py-0.5 text-[9px] font-black uppercase rounded-md bg-emerald-500 text-white">
                                    WIN
                                </span>
                            </div>
                        </div>

                        <div className="bg-neutral-50 rounded-xl p-2 border border-neutral-200/80 flex items-center justify-between">
                            <div>
                                <div className="text-xs font-black text-neutral-900">
                                    Northbrook United
                                </div>
                                <div className="text-xs font-semibold text-neutral-500">
                                    Millbrook Town
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="text-xs font-black text-emerald-600">3</div>
                                <div className="text-xs font-bold text-neutral-400">1</div>
                            </div>
                        </div>

                        <div className="mt-2 flex items-center justify-between text-[10px] text-neutral-600 font-semibold px-1">
                            <span>⚽ M. Vance (2), C. Gallagher</span>
                            <span className="text-amber-700 font-bold">⭐ M. Vance</span>
                        </div>
                    </div>

                    <div className="mt-2.5 pt-2 border-t border-neutral-100 flex items-center justify-between text-[10px]">
                        <span className="text-neutral-400 font-semibold">Premier Division</span>
                        <button
                            type="button"
                            onClick={() => onNavigate("fixtures")}
                            className="font-bold text-red-600 hover:text-red-700 cursor-pointer"
                        >
                            All Results & Stats →
                        </button>
                    </div>
                </div>
            </div>

            {/* 3. Season Leaderboards 4-Card Strip */}
            <div>
                <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500">
                        Season Leaderboards (All Competitions)
                    </span>
                    <span className="text-[10px] font-bold text-neutral-400">
                        14 Matches Played
                    </span>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
                    <div className="bg-white rounded-xl border border-neutral-200/80 p-3 shadow-xs">
                        <div className="flex items-center justify-between">
                            <span className="text-[9px] font-bold uppercase tracking-wider text-neutral-400">
                                Top Goalscorer
                            </span>
                            <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-red-50 text-red-600">
                                FWD
                            </span>
                        </div>
                        <div className="text-xl font-black text-neutral-900 mt-0.5">14</div>
                        <div className="text-xs font-extrabold text-neutral-800">
                            Marcus Vance
                        </div>
                        <div className="text-[10px] font-semibold text-neutral-400">
                            0.88 GPG • 2 Pens
                        </div>
                    </div>

                    <div className="bg-white rounded-xl border border-neutral-200/80 p-3 shadow-xs">
                        <div className="flex items-center justify-between">
                            <span className="text-[9px] font-bold uppercase tracking-wider text-neutral-400">
                                Most Assists
                            </span>
                            <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-blue-50 text-blue-600">
                                MID
                            </span>
                        </div>
                        <div className="text-xl font-black text-neutral-900 mt-0.5">11</div>
                        <div className="text-xs font-extrabold text-neutral-800">
                            Declan Sterling
                        </div>
                        <div className="text-[10px] font-semibold text-neutral-400">
                            18 G/A (7G, 11A)
                        </div>
                    </div>

                    <div className="bg-white rounded-xl border border-neutral-200/80 p-3 shadow-xs">
                        <div className="flex items-center justify-between">
                            <span className="text-[9px] font-bold uppercase tracking-wider text-neutral-400">
                                Man of the Match
                            </span>
                            <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-amber-50 text-amber-700">
                                ⭐ MOTM
                            </span>
                        </div>
                        <div className="text-xl font-black text-neutral-900 mt-0.5">4</div>
                        <div className="text-xs font-extrabold text-neutral-800">
                            Callum Gallagher
                        </div>
                        <div className="text-[10px] font-semibold text-neutral-400">
                            14 Starts • CM
                        </div>
                    </div>

                    <div className="bg-white rounded-xl border border-neutral-200/80 p-3 shadow-xs">
                        <div className="flex items-center justify-between">
                            <span className="text-[9px] font-bold uppercase tracking-wider text-neutral-400">
                                Training Commitment
                            </span>
                            <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700">
                                🔥 9 Streak
                            </span>
                        </div>
                        <div className="text-xl font-black text-emerald-600 mt-0.5">94%</div>
                        <div className="text-xs font-extrabold text-neutral-800">
                            Harrison Cole
                        </div>
                        <div className="text-[10px] font-semibold text-neutral-400">
                            17/18 Sessions
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

/**
 * SCREEN 1B: PLAYER SQUAD — APPEARANCES, MINUTES, ASSISTS & DISCIPLINE
 */
function FullSquadPreview() {
    const [squadFilter, setSquadFilter] = useState<"all" | "caution" | "unavailable">("all");

    const squadRows = [
        {
            num: 9,
            name: "Marcus Vance",
            pos: "ST",
            status: "Available",
            apps: "14",
            subs: "0",
            mins: "1,215'",
            goals: 14,
            assists: 4,
            yc: 1,
        },
        {
            num: 10,
            name: "Declan Sterling",
            pos: "CAM",
            status: "Available",
            apps: "14",
            subs: "0",
            mins: "1,190'",
            goals: 7,
            assists: 11,
            yc: 2,
        },
        {
            num: 8,
            name: "Callum Gallagher",
            pos: "CM",
            status: "Available",
            apps: "13",
            subs: "1",
            mins: "1,145'",
            goals: 5,
            assists: 6,
            yc: 2,
        },
        {
            num: 4,
            name: "Tom Hughes",
            pos: "CDM",
            status: "Available",
            apps: "12",
            subs: "2",
            mins: "1,060'",
            goals: 1,
            assists: 3,
            yc: 4,
            cautionAlert: true,
        },
        {
            num: 5,
            name: "Dan Foster (C)",
            pos: "CB",
            status: "Available",
            apps: "14",
            subs: "0",
            mins: "1,260'",
            goals: 2,
            assists: 1,
            yc: 1,
        },
        {
            num: 14,
            name: "Harrison Cole",
            pos: "MID",
            status: "Available",
            apps: "6",
            subs: "8",
            mins: "685'",
            goals: 3,
            assists: 5,
            yc: 0,
        },
        {
            num: 19,
            name: "Kieran Walsh",
            pos: "LB",
            status: "Injured • Hamstring",
            apps: "9",
            subs: "1",
            mins: "780'",
            goals: 0,
            assists: 3,
            yc: 2,
        },
    ];

    const visibleRows = squadRows.filter((p) => {
        if (squadFilter === "caution") return Boolean(p.cautionAlert);
        if (squadFilter === "unavailable") return p.status !== "Available";
        return true;
    });

    return (
        <div className="p-4 sm:p-5 space-y-3.5 bg-[#FCFCFD] text-neutral-900 select-none">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base sm:text-lg font-black text-neutral-900">
                        Player Squad & Season Stats
                    </h3>
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                        Synced from Matchday Planner • 14 Games
                    </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2.5 py-1 rounded-lg bg-white border border-neutral-200 text-neutral-700 text-[11px] font-bold flex items-center gap-1 shadow-2xs">
                        <FileSpreadsheet className="w-3 h-3 text-emerald-600" /> Export Squad Stats
                    </span>
                    <span className="px-2.5 py-1 rounded-lg bg-red-600 text-white text-[11px] font-bold flex items-center gap-1">
                        <Plus className="w-3 h-3" /> Add Player
                    </span>
                </div>
            </div>

            {/* Interactive Filter Strip */}
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold">
                    <button
                        type="button"
                        onClick={() => setSquadFilter("all")}
                        className={`px-2.5 py-1 rounded-full text-[10px] transition-colors cursor-pointer ${
                            squadFilter === "all"
                                ? "bg-neutral-900 text-white"
                                : "bg-white border border-neutral-200 text-neutral-600 hover:bg-neutral-100"
                        }`}
                    >
                        All Squad (26)
                    </button>
                    <button
                        type="button"
                        onClick={() => setSquadFilter("caution")}
                        className={`px-2.5 py-1 rounded-full text-[10px] border flex items-center gap-1 transition-colors cursor-pointer ${
                            squadFilter === "caution"
                                ? "bg-amber-500 text-white border-amber-600"
                                : "bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100"
                        }`}
                    >
                        <AlertTriangle className="w-3 h-3" />
                        1 Suspension Risk (4 YC)
                    </button>
                    <button
                        type="button"
                        onClick={() => setSquadFilter("unavailable")}
                        className={`px-2.5 py-1 rounded-full text-[10px] border transition-colors cursor-pointer ${
                            squadFilter === "unavailable"
                                ? "bg-rose-600 text-white border-rose-600"
                                : "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100"
                        }`}
                    >
                        3 Unavailable / Injured
                    </button>
                </div>
                <span className="text-[10px] font-semibold text-neutral-400">
                    23 Fit for Saturday
                </span>
            </div>

            {/* Squad Appearances, Minutes, Goals, Assists & Cards Table */}
            <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-neutral-200 bg-neutral-50/70 text-[9px] font-black uppercase tracking-wider text-neutral-400">
                                <th className="py-2.5 px-3">Player</th>
                                <th className="py-2.5 px-2">Status</th>
                                <th className="py-2.5 px-2 text-center">Apps (Sub)</th>
                                <th className="py-2.5 px-2 text-center">Minutes</th>
                                <th className="py-2.5 px-2 text-center">Goals</th>
                                <th className="py-2.5 px-2 text-center">Assists</th>
                                <th className="py-2.5 px-3 text-right">Cards</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-100 text-xs">
                            {visibleRows.map((p) => (
                                <tr key={p.num} className="hover:bg-neutral-50/80">
                                    <td className="py-2.5 px-3">
                                        <div className="flex items-center gap-2">
                                            <span className="w-5 h-5 rounded bg-neutral-900 text-white font-black text-[9px] flex items-center justify-center shrink-0">
                                                {p.num}
                                            </span>
                                            <div>
                                                <div className="font-bold text-neutral-900 leading-tight">
                                                    {p.name}
                                                </div>
                                                <div className="text-[9px] font-extrabold text-neutral-400">
                                                    {p.pos}
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="py-2.5 px-2">
                                        <span
                                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold border ${
                                                p.status === "Available"
                                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                                    : "bg-rose-50 text-rose-700 border-rose-200"
                                            }`}
                                        >
                                            {p.status}
                                        </span>
                                    </td>
                                    <td className="py-2.5 px-2 text-center font-bold text-neutral-800 tabular-nums">
                                        {p.apps}{" "}
                                        <span className="text-neutral-400 font-semibold text-[10px]">
                                            ({p.subs})
                                        </span>
                                    </td>
                                    <td className="py-2.5 px-2 text-center">
                                        <span className="px-2 py-0.5 rounded bg-neutral-100 text-neutral-800 font-bold text-[11px] tabular-nums">
                                            {p.mins}
                                        </span>
                                    </td>
                                    <td className="py-2.5 px-2 text-center font-black text-emerald-700 tabular-nums">
                                        {p.goals}
                                    </td>
                                    <td className="py-2.5 px-2 text-center font-black text-sky-700 tabular-nums">
                                        {p.assists}
                                    </td>
                                    <td className="py-2.5 px-3 text-right">
                                        {p.yc > 0 ? (
                                            <span
                                                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-black border ${
                                                    p.cautionAlert
                                                        ? "bg-amber-100 text-amber-900 border-amber-400"
                                                        : "bg-yellow-50 text-yellow-800 border-yellow-300"
                                                }`}
                                            >
                                                <span className="w-2 h-2.5 rounded-[1px] bg-amber-400 border border-amber-600 inline-block" />
                                                <span>
                                                    {p.yc}
                                                    {p.cautionAlert ? " • 1 off ban" : ""}
                                                </span>
                                            </span>
                                        ) : (
                                            <span className="text-[10px] text-neutral-300 font-bold">
                                                0
                                            </span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

/**
 * SCREEN 2: STREAMLINED MATCHDAY XI (~65% content height)
 */
function getContrastText(hex: string): string {
    const clean = hex.replace("#", "");
    if (clean.length !== 6) return "#ffffff";
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    const yiq = (r * 299 + g * 587 + b * 114) / 1000;
    return yiq >= 155 ? "#0f172a" : "#ffffff";
}

function FullMatchdayXiPreview() {
    const [kitChoice, setKitChoice] = useState<"home" | "away" | "third" | "custom">("home");
    const [customKitHex, setCustomKitHex] = useState("#f59e0b");
    const [tacticalShape, setTacticalShape] = useState<"base" | "inPossession">("base");

    const kitConfig =
        kitChoice === "home"
            ? { fill: "#e11d48", text: "#ffffff", label: "Home Kit" }
            : kitChoice === "away"
            ? { fill: "#f8fafc", text: "#0f172a", label: "Away Kit" }
            : kitChoice === "third"
            ? { fill: "#2563eb", text: "#ffffff", label: "3rd Kit" }
            : { fill: customKitHex, text: getContrastText(customKitHex), label: "Custom Kit" };

    const isInPoss = tacticalShape === "inPossession";

    return (
        <div className="p-4 sm:p-5 bg-[#FCFCFD] text-neutral-900 select-none">
            {/* Top Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3.5 mb-3.5 border-b border-neutral-200">
                <div>
                    <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base sm:text-lg font-black text-neutral-900">Matchday Planner</h3>
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-700 border border-red-200">
                            Sat 14 Nov vs Kingswood Rovers (H)
                        </span>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-lg bg-white border border-neutral-200 text-neutral-700 text-[11px] font-bold shadow-2xs">
                        Saved Lineup ✓
                    </span>
                    <span className="px-2.5 py-1 rounded-lg bg-red-600 text-white text-[11px] font-bold shadow-xs flex items-center gap-1.5">
                        <Share2 className="w-3 h-3" /> Export Pitch Graphic
                    </span>
                </div>
            </div>

            {/* 3-Column Matchday Planner Interface */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-start">
                {/* Left Column: Available Squad Pool */}
                <div className="lg:col-span-3 bg-white rounded-xl border border-neutral-200 shadow-xs p-3">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-neutral-900 flex items-center gap-1.5">
                            <Users className="w-3.5 h-3.5 text-neutral-500" /> Available Squad
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                            23 Fit
                        </span>
                    </div>

                    <div className="flex flex-wrap gap-1 mb-2">
                        {["All", "GK", "DEF", "MID", "FWD"].map((f, i) => (
                            <span
                                key={f}
                                className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                                    i === 0
                                        ? "bg-neutral-900 text-white"
                                        : "bg-neutral-100 text-neutral-600"
                                }`}
                            >
                                {f}
                            </span>
                        ))}
                    </div>

                    <div className="text-[9px] font-bold uppercase tracking-wider text-neutral-400 mb-1.5">
                        Remaining Pool (7)
                    </div>
                    <div className="space-y-1 max-h-[290px] overflow-y-auto pr-0.5">
                        {[
                            { name: "B. Holloway", pos: "GK", startedLast: false, att: "94%" },
                            { name: "C. Doyle", pos: "DEF", startedLast: true, att: "89%" },
                            { name: "L. Jennings", pos: "MID", startedLast: false, att: "94%" },
                            { name: "M. Richards", pos: "DEF", startedLast: false, att: "89%" },
                            { name: "J. Abbott", pos: "MID", startedLast: false, att: "83%" },
                            { name: "F. Spencer", pos: "FWD", startedLast: false, att: "83%" },
                            { name: "R. Patel", pos: "DEF", startedLast: false, att: "78%" },
                        ].map((p) => (
                            <div
                                key={p.name}
                                className="flex items-center justify-between px-2 py-1.5 rounded-lg border border-neutral-200/80 bg-white hover:border-neutral-300 text-xs"
                            >
                                <div className="min-w-0">
                                    <div className="font-bold text-neutral-900 text-[11px] truncate">
                                        {p.name}
                                    </div>
                                    <div className="flex items-center gap-1 mt-0.5">
                                        <span className="text-[8px] font-black px-1 py-0.2 rounded bg-neutral-100 text-neutral-600">
                                            {p.pos}
                                        </span>
                                        <span className="text-[8px] font-semibold text-neutral-400">
                                            Train: {p.att}
                                        </span>
                                        {p.startedLast && (
                                            <span className="text-[8px] font-black px-1 py-0.2 rounded bg-emerald-50 text-emerald-700">
                                                Started Last
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <Plus className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                            </div>
                        ))}
                    </div>
                </div>

                {/* Center Column: Interactive Kit & Tactical Controls + Green Pitch */}
                <div className="lg:col-span-6 space-y-2">
                    <div className="bg-white p-2 rounded-xl border border-neutral-200 shadow-xs space-y-1.5">
                        <div className="flex flex-wrap items-center justify-between gap-1.5">
                            {/* Tactical Shape Toggle */}
                            <div className="flex items-center bg-neutral-100 p-0.5 rounded-lg border border-neutral-200/60 text-[10px] font-bold">
                                <button
                                    type="button"
                                    onClick={() => setTacticalShape("base")}
                                    className={`px-2 py-1 rounded-md transition-all cursor-pointer ${
                                        !isInPoss
                                            ? "bg-white text-neutral-900 shadow-2xs"
                                            : "text-neutral-500 hover:text-neutral-800"
                                    }`}
                                >
                                    Base XI (4-3-3)
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setTacticalShape("inPossession")}
                                    className={`px-2 py-1 rounded-md transition-all cursor-pointer ${
                                        isInPoss
                                            ? "bg-emerald-600 text-white shadow-2xs"
                                            : "text-neutral-500 hover:text-neutral-800"
                                    }`}
                                >
                                    In-Possession (3-2-5)
                                </button>
                            </div>

                            <span className="px-2 py-0.5 rounded-lg bg-neutral-100 border border-neutral-200 text-[10px] font-bold text-neutral-800">
                                {isInPoss ? "RB Jumps → 3-2-5" : "4-3-3"}
                            </span>
                        </div>

                        {/* Interactive Home / Away / 3rd + Any Club Colour Switcher */}
                        <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1 border-t border-neutral-100">
                            <div className="flex flex-wrap items-center gap-1">
                                <span className="text-[9px] font-extrabold uppercase tracking-wider text-neutral-500 mr-0.5">
                                    Match Kit:
                                </span>
                                {[
                                    { id: "home" as const, label: "Home", dot: "#e11d48", border: "border-rose-700" },
                                    { id: "away" as const, label: "Away", dot: "#f8fafc", border: "border-neutral-400" },
                                    { id: "third" as const, label: "3rd", dot: "#2563eb", border: "border-blue-700" },
                                ].map((k) => {
                                    const active = kitChoice === k.id;
                                    return (
                                        <button
                                            key={k.id}
                                            type="button"
                                            onClick={() => setKitChoice(k.id)}
                                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border transition-all cursor-pointer ${
                                                active
                                                    ? "bg-neutral-900 text-white border-neutral-900 shadow-2xs"
                                                    : "bg-neutral-50 text-neutral-700 border-neutral-200 hover:bg-neutral-100"
                                            }`}
                                        >
                                            <span
                                                className={`w-2.5 h-2.5 rounded-full border ${k.border}`}
                                                style={{ backgroundColor: k.dot }}
                                            />
                                            <span>{k.label}</span>
                                        </button>
                                    );
                                })}

                                {/* Custom Any-Colour Picker so visitors see any hex is supported */}
                                <label
                                    title="Pick any custom club kit colour"
                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border transition-all cursor-pointer ${
                                        kitChoice === "custom"
                                            ? "bg-neutral-900 text-white border-neutral-900 shadow-2xs"
                                            : "bg-neutral-50 text-neutral-700 border-neutral-200 hover:bg-neutral-100"
                                    }`}
                                >
                                    <span
                                        className="w-2.5 h-2.5 rounded-full border border-black/20"
                                        style={{
                                            background:
                                                kitChoice === "custom"
                                                    ? customKitHex
                                                    : "conic-gradient(#ef4444, #eab308, #22c55e, #3b82f6, #a855f7, #ef4444)",
                                        }}
                                    />
                                    <span>Custom Colour</span>
                                    <input
                                        type="color"
                                        value={customKitHex}
                                        onChange={(e) => {
                                            setCustomKitHex(e.target.value);
                                            setKitChoice("custom");
                                        }}
                                        className="sr-only"
                                    />
                                </label>
                            </div>
                            <span className="text-[9px] font-semibold text-neutral-400 hidden sm:inline">
                                Any club colours supported
                            </span>
                        </div>
                    </div>

                    <div className="h-[340px] w-full">
                        <RealisticPitchMarkings>
                            {/* Attacking Half 5-Corridor & Rest-Defence Overlay when In-Possession (3-2-5) is active */}
                            {isInPoss && (
                                <div className="absolute inset-0 pointer-events-none z-0 animate-in fade-in duration-300">
                                    {/* Attacking Half Lanes (Top 50% towards opponent goal) */}
                                    <div className="absolute top-0 left-0 right-0 h-1/2">
                                        <div className="absolute top-0 bottom-0 left-[20%] border-l border-dashed border-amber-200/65" />
                                        <div className="absolute top-0 bottom-0 left-[40%] border-l border-dashed border-amber-200/65" />
                                        <div className="absolute top-0 bottom-0 left-[60%] border-l border-dashed border-amber-200/65" />
                                        <div className="absolute top-0 bottom-0 left-[80%] border-l border-dashed border-amber-200/65" />
                                        {[
                                            { lbl: "WIDE L", left: "10%" },
                                            { lbl: "HALF-SPACE L", left: "30%" },
                                            { lbl: "CENTRAL", left: "50%" },
                                            { lbl: "HALF-SPACE R", left: "70%" },
                                            { lbl: "WIDE R", left: "90%" },
                                        ].map((c) => (
                                            <span
                                                key={c.lbl}
                                                style={{ left: c.left }}
                                                className="absolute top-1.5 -translate-x-1/2 px-1 py-0.2 rounded bg-black/55 text-[7px] font-black tracking-wider text-amber-200 whitespace-nowrap"
                                            >
                                                {c.lbl}
                                            </span>
                                        ))}
                                    </div>

                                    {/* 3-2 Rest-Defence Structural Shield */}
                                    <div
                                        className="absolute rounded-xl border border-dashed border-emerald-300/80 bg-emerald-950/25 flex items-end justify-center pb-0.5"
                                        style={{ left: "16%", right: "16%", top: "48%", bottom: "18%" }}
                                    >
                                        <span className="px-1.5 py-0.2 rounded bg-emerald-950/85 text-[7px] font-black uppercase tracking-wider text-emerald-300 border border-emerald-400/30">
                                            🛡️ 3-2 Rest Defence Unit
                                        </span>
                                    </div>
                                </div>
                            )}

                            <PitchJerseyNode
                                x={50}
                                y={89}
                                number={1}
                                name="J. Mercer"
                                kitColor="#10b981"
                            />
                            <PitchJerseyNode
                                x={isInPoss ? 26 : 16}
                                y={isInPoss ? 69 : 71}
                                number={3}
                                name="A. Clarke"
                                kitColor={kitConfig.fill}
                                textColor={kitConfig.text}
                            />
                            <PitchJerseyNode
                                x={isInPoss ? 50 : 38}
                                y={isInPoss ? 71 : 74}
                                number={5}
                                name="D. Foster"
                                kitColor={kitConfig.fill}
                                textColor={kitConfig.text}
                                isCaptain
                            />
                            <PitchJerseyNode
                                x={isInPoss ? 74 : 62}
                                y={isInPoss ? 69 : 74}
                                number={6}
                                name="R. Bennett"
                                kitColor={kitConfig.fill}
                                textColor={kitConfig.text}
                            />
                            <PitchJerseyNode
                                x={isInPoss ? 90 : 84}
                                y={isInPoss ? 22 : 71}
                                number={2}
                                name="L. Reid"
                                kitColor={kitConfig.fill}
                                textColor={kitConfig.text}
                                badge={isInPoss ? "JUMP" : undefined}
                            />
                            <PitchJerseyNode
                                x={isInPoss ? 61 : 50}
                                y={isInPoss ? 55 : 54}
                                number={4}
                                name="T. Hughes"
                                kitColor={kitConfig.fill}
                                textColor={kitConfig.text}
                            />
                            <PitchJerseyNode
                                x={isInPoss ? 39 : 29}
                                y={isInPoss ? 55 : 43}
                                number={8}
                                name="C. Gallagher"
                                kitColor={kitConfig.fill}
                                textColor={kitConfig.text}
                            />
                            <PitchJerseyNode
                                x={isInPoss ? 30 : 71}
                                y={isInPoss ? 26 : 43}
                                number={10}
                                name="D. Sterling"
                                kitColor={kitConfig.fill}
                                textColor={kitConfig.text}
                            />
                            <PitchJerseyNode
                                x={isInPoss ? 10 : 20}
                                y={isInPoss ? 22 : 20}
                                number={11}
                                name="E. Brooks"
                                kitColor={kitConfig.fill}
                                textColor={kitConfig.text}
                            />
                            <PitchJerseyNode
                                x={50}
                                y={15}
                                number={9}
                                name="M. Vance"
                                kitColor={kitConfig.fill}
                                textColor={kitConfig.text}
                            />
                            <PitchJerseyNode
                                x={isInPoss ? 70 : 80}
                                y={isInPoss ? 25 : 20}
                                number={7}
                                name="O. Grant"
                                kitColor={kitConfig.fill}
                                textColor={kitConfig.text}
                            />
                        </RealisticPitchMarkings>
                    </div>
                </div>

                {/* Right Column: Substitutes Bench & Synchronized Roles & Set Pieces */}
                <div className="lg:col-span-3 space-y-2.5">
                    <div className="bg-white rounded-xl border border-neutral-200 shadow-xs p-3">
                        <div className="flex items-center justify-between mb-1.5">
                            <span className="text-xs font-bold text-neutral-900">
                                Substitutes Bench
                            </span>
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded">
                                5 / 5
                            </span>
                        </div>
                        <div className="space-y-1">
                            {[
                                { num: 12, name: "S. Henderson", pos: "DEF" },
                                { num: 14, name: "H. Cole", pos: "MID" },
                                { num: 15, name: "N. Palmer", pos: "FWD" },
                                { num: 16, name: "K. Murray", pos: "DEF" },
                                { num: 17, name: "Z. Bello", pos: "FWD" },
                            ].map((sub) => (
                                <div
                                    key={sub.num}
                                    className="flex items-center justify-between px-2 py-1 rounded-lg bg-neutral-50 border border-neutral-200/80 text-[11px]"
                                >
                                    <div className="flex items-center gap-1.5">
                                        <span className="w-4 h-4 rounded bg-neutral-900 text-white font-black text-[9px] flex items-center justify-center">
                                            {sub.num}
                                        </span>
                                        <span className="font-bold text-neutral-800">
                                            {sub.name}
                                        </span>
                                    </div>
                                    <span className="text-[9px] font-black text-neutral-400">
                                        {sub.pos}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-white rounded-xl border border-neutral-200 shadow-xs p-3">
                        <div className="text-xs font-bold text-neutral-900 mb-1.5">
                            Roles & Set Pieces
                        </div>
                        <div className="space-y-1.5 text-[10px]">
                            {[
                                { role: "Captain (C)", player: "5. D. Foster" },
                                { role: "Penalties", player: "9. M. Vance" },
                                { role: "Free Kicks", player: "10. D. Sterling" },
                                { role: "Corners", player: "7. O. Grant" },
                            ].map((r) => (
                                <div key={r.role} className="flex items-center justify-between">
                                    <span className="text-neutral-500 font-medium">{r.role}</span>
                                    <span className="font-bold text-neutral-900 bg-neutral-100 px-1.5 py-0.5 rounded border border-neutral-200">
                                        {r.player}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

/**
 * SCREEN 3: FULL-SCALE REAL TRAINING & ATTENDANCE (matching src/app/training/page.tsx + WeeklyFootballCalendar)
 */
function FullTrainingPreview() {
    const trainingDays = [
        { day: "MON", date: "9", type: "rest" },
        {
            day: "TUE",
            date: "10",
            type: "training",
            time: "19:30",
            title: "High Press & Transitions",
            pitch: "3G Pitch 1",
            attending: 19,
        },
        { day: "WED", date: "11", type: "rest" },
        {
            day: "THU",
            date: "12",
            type: "training",
            time: "19:30",
            title: "Set Pieces & Defensive Shape",
            pitch: "3G Pitch 1",
            attending: 18,
            isNext: true,
        },
        { day: "FRI", date: "13", type: "rest" },
        {
            day: "SAT",
            date: "14",
            type: "match",
            time: "14:00",
            title: "vs Kingswood Rovers (H)",
            pitch: "Premier Division",
        },
        { day: "SUN", date: "15", type: "rest" },
    ];

    const attendanceRows = [
        {
            rank: 1,
            name: "Harrison Cole",
            streak: 9,
            pos: "MID",
            attended: "17 / 18",
            late: 0,
            last5: ["✓", "✓", "✓", "✓", "✓"],
            pct: 94,
        },
        {
            rank: 2,
            name: "Dan Foster",
            streak: 6,
            pos: "DEF",
            attended: "17 / 18",
            late: 1,
            last5: ["✓", "✓", "L", "✓", "✓"],
            pct: 94,
        },
        {
            rank: 3,
            name: "Jordan Mercer",
            streak: 5,
            pos: "GK",
            attended: "16 / 18",
            late: 0,
            last5: ["✓", "✓", "✓", "✓", "✓"],
            pct: 89,
        },
        {
            rank: 4,
            name: "Marcus Vance",
            streak: 4,
            pos: "FWD",
            attended: "16 / 18",
            late: 1,
            last5: ["×", "✓", "✓", "L", "✓"],
            pct: 89,
        },
    ];

    return (
        <div className="p-4 sm:p-5 space-y-3.5 bg-[#FCFCFD] text-neutral-900 select-none">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div>
                    <h3 className="text-base sm:text-lg font-black text-neutral-900">
                        Training Schedule & Attendance
                    </h3>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center bg-neutral-200/70 p-0.5 rounded-lg text-[10px] font-bold">
                        <span className="px-2 py-1 text-neutral-600">Schedule</span>
                        <span className="px-2 py-1 rounded-md bg-white text-neutral-900 shadow-2xs">
                            Schedule + Attendance
                        </span>
                    </div>
                    <span className="px-2.5 py-1 rounded-lg bg-red-600 text-white text-[11px] font-bold flex items-center gap-1">
                        <Plus className="w-3 h-3" /> Add Session
                    </span>
                </div>
            </div>

            {/* 7-Day Weekly Football Calendar Strip */}
            <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-xs p-3">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-black text-neutral-900 uppercase tracking-wider">
                        Training Week • 9 Nov – 15 Nov
                    </span>
                    <span className="text-[10px] font-semibold text-neutral-400">
                        2 Sessions • 1 Matchday
                    </span>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-7 gap-2">
                    {trainingDays.map((d) => (
                        <div
                            key={d.day}
                            className={`rounded-xl p-2 border text-left transition-all ${
                                d.type === "rest" ? "hidden sm:block " : ""
                            }${
                                d.type === "training"
                                    ? d.isNext
                                        ? "bg-emerald-50/70 border-emerald-300 ring-1 ring-emerald-200"
                                        : "bg-white border-neutral-200"
                                    : d.type === "match"
                                    ? "bg-red-50/70 border-red-200"
                                    : "bg-neutral-50/70 border-neutral-200/60 opacity-65"
                            }`}
                        >
                            <div className="flex items-center justify-between text-[10px] font-black">
                                <span className="text-neutral-500">{d.day}</span>
                                <span className="text-neutral-900">{d.date}</span>
                            </div>
                            {d.type === "training" && (
                                <div className="mt-1.5">
                                    <span className="inline-block px-1.5 py-0.2 rounded text-[8px] font-black uppercase bg-emerald-600 text-white">
                                        {d.time}
                                    </span>
                                    <div className="text-[10px] font-bold text-neutral-900 mt-1 leading-tight line-clamp-1">
                                        {d.title}
                                    </div>
                                    <div className="text-[9px] font-semibold text-emerald-700 mt-0.5">
                                        {d.attending} Going
                                    </div>
                                </div>
                            )}
                            {d.type === "match" && (
                                <div className="mt-1.5">
                                    <span className="inline-block px-1.5 py-0.2 rounded text-[8px] font-black uppercase bg-red-600 text-white">
                                        {d.time}
                                    </span>
                                    <div className="text-[10px] font-black text-neutral-900 mt-1 leading-tight line-clamp-1">
                                        {d.title}
                                    </div>
                                    <div className="text-[9px] font-semibold text-red-700 mt-0.5">
                                        {d.pitch}
                                    </div>
                                </div>
                            )}
                            {d.type === "rest" && (
                                <div className="mt-3 text-[9px] font-semibold text-neutral-400">
                                    Rest
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Training Attendance Table Card */}
            <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-sm p-3.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2.5">
                    <div>
                        <div className="text-xs sm:text-sm font-black text-neutral-900">
                            Training Attendance Leaderboard
                        </div>
                        <div className="text-[10px] text-neutral-500">
                            18 Sessions Recorded • 86% Squad Average Commitment
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                        <span className="px-2 py-1 rounded-md bg-neutral-100 text-neutral-700 text-[10px] font-bold flex items-center gap-1">
                            <Share2 className="w-3 h-3" /> Share Graphic
                        </span>
                        <span className="px-2 py-1 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold flex items-center gap-1">
                            <FileSpreadsheet className="w-3 h-3" /> Export Excel
                        </span>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-neutral-200 text-[9px] font-bold uppercase text-neutral-400">
                                <th className="py-1.5 px-2">Player</th>
                                <th className="py-1.5 px-2">Pos</th>
                                <th className="py-1.5 px-2 text-center">Attended</th>
                                <th className="py-1.5 px-2 text-center hidden sm:table-cell">Last 5</th>
                                <th className="py-1.5 px-2 text-right">Attendance %</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-100 text-xs">
                            {attendanceRows.map((row) => (
                                <tr key={row.name} className="hover:bg-neutral-50/80">
                                    <td className="py-2 px-2">
                                        <div className="flex items-center gap-1.5">
                                            <span className="w-4 h-4 rounded-full bg-neutral-100 text-neutral-600 font-bold text-[9px] flex items-center justify-center shrink-0">
                                                {row.rank}
                                            </span>
                                            <span className="font-bold text-neutral-900 truncate">
                                                {row.name}
                                            </span>
                                            {row.streak >= 4 && (
                                                <span className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-full text-[8px] font-black bg-orange-50 text-orange-700 border border-orange-200">
                                                    <Flame className="w-2.5 h-2.5 text-orange-500" />
                                                    {row.streak}
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="py-2 px-2">
                                        <span className="px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-700 font-black text-[9px]">
                                            {row.pos}
                                        </span>
                                    </td>
                                    <td className="py-2 px-2 text-center font-bold text-neutral-800 text-[11px]">
                                        {row.attended}
                                    </td>
                                    <td className="py-2 px-2 hidden sm:table-cell">
                                        <div className="flex items-center justify-center gap-1">
                                            {row.last5.map((s, i) => (
                                                <span
                                                    key={i}
                                                    className={`w-4 h-4 rounded text-[9px] font-black flex items-center justify-center ${
                                                        s === "✓"
                                                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                                            : s === "L"
                                                            ? "bg-amber-50 text-amber-700 border border-amber-200"
                                                            : "bg-red-50 text-red-600 border border-red-200"
                                                    }`}
                                                >
                                                    {s}
                                                </span>
                                            ))}
                                        </div>
                                    </td>
                                    <td className="py-2 px-2 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <div className="w-16 h-1.5 bg-neutral-100 rounded-full overflow-hidden hidden sm:block">
                                                <div
                                                    className="h-full bg-emerald-500 rounded-full"
                                                    style={{ width: `${row.pct}%` }}
                                                />
                                            </div>
                                            <span className="font-black text-neutral-900 text-[11px]">
                                                {row.pct}%
                                            </span>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

/**
 * SCREEN 4: STREAMLINED FIXTURES & RESULTS (~65% content height)
 */
function FullFixturesPreview({
    onNavigate,
}: {
    onNavigate: (tab: ShowcaseTabId) => void;
}) {
    const completedMatches = [
        {
            date: "Sat 7 Nov",
            comp: "Premier Division",
            home: "Northbrook United",
            away: "Millbrook Town",
            score: "3 - 1",
            outcome: "W",
            scorers: "⚽ M. Vance (23', 67'), C. Gallagher (81')",
            assists: "👟 D. Sterling (2), T. Hughes",
            motm: "⭐ MOTM: M. Vance",
        },
        {
            date: "Sat 31 Oct",
            comp: "Premier Division",
            home: "Highgate Rangers",
            away: "Northbrook United",
            score: "1 - 2",
            outcome: "W",
            scorers: "⚽ E. Brooks (34'), M. Vance (88')",
            assists: "👟 O. Grant, A. Clarke",
            motm: "⭐ MOTM: D. Foster",
        },
    ];

    return (
        <div className="p-4 sm:p-5 space-y-3.5 bg-[#FCFCFD] text-neutral-900 select-none">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div>
                    <h3 className="text-base sm:text-lg font-black text-neutral-900">Fixtures & Results</h3>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                    {["All Competitions", "League (14)", "Cup (3)"].map((tab, idx) => (
                        <span
                            key={tab}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold ${
                                idx === 0
                                    ? "bg-neutral-900 text-white"
                                    : "bg-white border border-neutral-200 text-neutral-600"
                            }`}
                        >
                            {tab}
                        </span>
                    ))}
                    <span className="px-2.5 py-1 rounded-lg bg-red-600 text-white text-[11px] font-bold flex items-center gap-1">
                        <Plus className="w-3 h-3" /> Add Fixture
                    </span>
                </div>
            </div>

            {/* Upcoming Next Fixture Highlight Banner */}
            <div className="bg-white rounded-2xl border-2 border-red-600/20 shadow-sm p-3.5 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-red-600 text-white text-[9px] font-black uppercase">
                            NEXT FIXTURE • SAT 14 NOV • 14:00
                        </span>
                        <span className="text-[11px] font-bold text-neutral-500">
                            Premier Division • Matchweek 15
                        </span>
                    </div>
                    <div className="text-base font-black text-neutral-900">
                        Northbrook United vs Kingswood Rovers (#2nd)
                    </div>
                    <div className="text-[11px] text-neutral-500 font-medium">
                        Venue: Northbrook Community Ground (Home) • Kit: Crimson / White
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        onClick={() => onNavigate("matchday-xi")}
                        className="px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-[11px] font-bold cursor-pointer"
                    >
                        Open Matchday Planner →
                    </button>
                    <button
                        type="button"
                        onClick={() => onNavigate("opposition")}
                        className="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-[11px] font-bold cursor-pointer"
                    >
                        Opposition Report →
                    </button>
                </div>
            </div>

            {/* Completed Results Timeline */}
            <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-sm divide-y divide-neutral-100">
                <div className="px-3.5 py-2.5 flex items-center justify-between">
                    <span className="text-[11px] font-black uppercase tracking-wider text-neutral-500">
                        Recent Completed Matches
                    </span>
                    <span className="text-[10px] font-bold text-emerald-600">
                        42 Goals Scored • 18 Conceded
                    </span>
                </div>
                {completedMatches.map((m) => (
                    <div
                        key={m.date}
                        className="p-3.5 flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 hover:bg-neutral-50/70"
                    >
                        <div className="flex items-start sm:items-center gap-2.5">
                            <span
                                className={`w-7 h-7 rounded-xl font-black text-xs text-white flex items-center justify-center shrink-0 ${
                                    m.outcome === "W" ? "bg-emerald-500" : "bg-amber-400"
                                }`}
                            >
                                {m.outcome}
                            </span>
                            <div>
                                <div className="flex flex-wrap items-center gap-1.5">
                                    <span className="text-xs font-black text-neutral-900">
                                        {m.home}
                                    </span>
                                    <span className="px-1.5 py-0.5 rounded bg-neutral-900 text-white font-black text-[11px]">
                                        {m.score}
                                    </span>
                                    <span className="text-xs font-black text-neutral-900">
                                        {m.away}
                                    </span>
                                    <span className="text-[10px] font-semibold text-neutral-400">
                                        • {m.date} ({m.comp})
                                    </span>
                                </div>
                                <div className="flex flex-wrap items-center gap-2 mt-1 text-[10px] text-neutral-600 font-medium">
                                    <span>{m.scorers}</span>
                                    <span className="px-1.5 py-0.2 rounded bg-amber-50 text-amber-800 border border-amber-200 font-bold text-[9px]">
                                        {m.motm}
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            <span className="px-2 py-1 rounded-lg bg-neutral-100 text-neutral-700 text-[10px] font-bold">
                                XI & Stats Logged ✓
                            </span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

/**
 * SCREEN 5: STREAMLINED RECRUITMENT & TRIALISTS (~65% content height)
 */
function FullRecruitmentPreview() {
    const stages = [
        { label: "Scouted", count: 2, color: "bg-neutral-100 text-neutral-800" },
        { label: "Contacted", count: 1, color: "bg-blue-50 text-blue-700" },
        { label: "Invited", count: 1, color: "bg-indigo-50 text-indigo-700" },
        { label: "On Trial", count: 1, color: "bg-amber-50 text-amber-800" },
        { label: "Signed", count: 1, color: "bg-emerald-50 text-emerald-700" },
    ];

    const targets = [
        {
            name: "Jayden Osei",
            age: 23,
            pos: "CB / LB",
            foot: "Left",
            currentClub: "Harrow Athletic",
            stage: "On Trial",
            stageBadge: "bg-amber-50 text-amber-800 border-amber-200",
            rating: "4.5",
            notes: "Attended 2 Thursday sessions. Dominant aerially, calm left-footed distribution.",
        },
        {
            name: "Reece Campbell",
            age: 21,
            pos: "ST / RW",
            foot: "Right",
            currentClub: "Millbrook Reserves",
            stage: "Invited",
            stageBadge: "bg-indigo-50 text-indigo-700 border-indigo-200",
            rating: "4.0",
            notes: "12 goals in 14 games. Explosive pace in behind; attending Tuesday training.",
        },
        {
            name: "Theo Saunders",
            age: 24,
            pos: "GK",
            foot: "Right",
            currentClub: "Oakwood FC",
            stage: "Contacted",
            stageBadge: "bg-blue-50 text-blue-700 border-blue-200",
            rating: "4.0",
            notes: "Commanding shot-stopper, strong kicking range. Spoke after Saturday's fixture.",
        },
        {
            name: "Malik Boateng",
            age: 22,
            pos: "CM / CDM",
            foot: "Right",
            currentClub: "Westbourne Town",
            stage: "Scouted",
            stageBadge: "bg-neutral-100 text-neutral-700 border-neutral-300",
            rating: "4.5",
            notes: "Press-resistant #6 who breaks lines cleanly and wins second balls.",
        },
        {
            name: "Kieran Norris",
            age: 20,
            pos: "LW",
            foot: "Left",
            currentClub: "Brookside U23",
            stage: "Scouted",
            stageBadge: "bg-neutral-100 text-neutral-700 border-neutral-300",
            rating: "3.5",
            notes: "Direct 1v1 winger with sharp delivery from wide left. Watching again next week.",
        },
        {
            name: "Ellis Hayward",
            age: 25,
            pos: "RB",
            foot: "Right",
            currentClub: "Northbrook United",
            stage: "Signed",
            stageBadge: "bg-emerald-50 text-emerald-700 border-emerald-200",
            rating: "4.5",
            notes: "Impressed across 3 trial sessions. Registered and added to First Team squad.",
        },
    ];

    return (
        <div className="p-4 sm:p-5 space-y-3 bg-[#FCFCFD] text-neutral-900 select-none">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="flex items-center gap-2">
                    <h3 className="text-base sm:text-lg font-black text-neutral-900">
                        Player Recruitment
                    </h3>
                    <span className="px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-600 text-[10px] font-bold">
                        6 Active Targets
                    </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2.5 py-1 rounded-lg bg-white border border-neutral-200 text-neutral-700 text-[11px] font-bold flex items-center gap-1">
                        <FileSpreadsheet className="w-3 h-3 text-emerald-600" /> Export Excel
                    </span>
                    <span className="px-2.5 py-1 rounded-lg bg-red-600 text-white text-[11px] font-bold flex items-center gap-1">
                        <Plus className="w-3 h-3" /> Add Target
                    </span>
                </div>
            </div>

            {/* 5 Pipeline Stage Pills (2 + 1 + 1 + 1 + 1 = 6 Shown Below) */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {stages.map((s) => (
                    <div
                        key={s.label}
                        className="bg-white rounded-xl border border-neutral-200/80 px-2.5 py-2 shadow-2xs flex items-center justify-between"
                    >
                        <span className="text-[11px] font-bold text-neutral-700">{s.label}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-black ${s.color}`}>
                            {s.count}
                        </span>
                    </div>
                ))}
            </div>

            {/* All 6 Scouting Target Cards Matching Top Stage Counts */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {targets.map((t) => (
                    <div
                        key={t.name}
                        className="bg-white rounded-xl border border-neutral-200/80 shadow-2xs p-3 flex flex-col justify-between"
                    >
                        <div>
                            <div className="flex items-start justify-between gap-1.5">
                                <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-1">
                                        <span className="text-xs font-black text-neutral-900 truncate">
                                            {t.name}
                                        </span>
                                        <span className="px-1.5 py-0.2 rounded bg-neutral-900 text-white text-[8px] font-black">
                                            {t.pos}
                                        </span>
                                    </div>
                                    <div className="text-[10px] font-semibold text-neutral-400 mt-0.5 truncate">
                                        Age {t.age} • {t.foot} • {t.currentClub}
                                    </div>
                                </div>
                                <span
                                    className={`px-2 py-0.5 rounded-full text-[8px] font-black border shrink-0 ${t.stageBadge}`}
                                >
                                    {t.stage}
                                </span>
                            </div>

                            <p className="mt-2 text-[10px] text-neutral-600 bg-neutral-50 p-2 rounded-lg border border-neutral-200/60 leading-snug">
                                “{t.notes}”
                            </p>
                        </div>

                        <div className="mt-2 pt-1.5 border-t border-neutral-100 flex items-center justify-between text-[9px]">
                            <span className="inline-flex items-center gap-1 font-bold text-amber-600">
                                <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
                                {t.rating} / 5.0
                            </span>
                            <span className="font-bold text-neutral-700">
                                {t.stage === "Signed" ? "In Squad ✓" : "Convert to Squad →"}
                            </span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

/**
 * SCREEN 6: STREAMLINED OPPOSITION REPORTS (~65% content height)
 */
function FullOppositionPreview() {
    return (
        <div className="p-4 sm:p-5 space-y-3.5 bg-[#FCFCFD] text-neutral-900 select-none">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base sm:text-lg font-black text-neutral-900">
                        Opposition Scouting Report
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-50 text-amber-800 border border-amber-200">
                        vs Kingswood Rovers (Sat 14 Nov)
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-lg bg-white border border-neutral-200 text-neutral-700 text-[11px] font-bold">
                        Shape: 4-2-3-1
                    </span>
                    <span className="px-2.5 py-1 rounded-lg bg-neutral-900 text-white text-[11px] font-bold flex items-center gap-1.5">
                        <FileText className="w-3 h-3" /> Export PDF
                    </span>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-start">
                {/* Left 7 Cols: 2 Key Tactical Cards + Danger Men */}
                <div className="lg:col-span-7 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div className="bg-white rounded-xl border border-neutral-200 p-3 shadow-2xs">
                            <div className="text-[10px] font-black uppercase tracking-wider text-emerald-700 mb-1">
                                1. In Possession & Build-Up
                            </div>
                            <p className="text-[11px] text-neutral-600 leading-relaxed">
                                Early diagonals into #9 Callum Bradshaw, with #10 Luke Pennant collecting second balls in the half-spaces.
                            </p>
                        </div>

                        <div className="bg-white rounded-xl border border-neutral-200 p-3 shadow-2xs">
                            <div className="text-[10px] font-black uppercase tracking-wider text-red-700 mb-1">
                                2. Key Weaknesses to Exploit
                            </div>
                            <p className="text-[11px] text-neutral-600 leading-relaxed">
                                Left centre-back turns slowly when isolated 1v1 against pace. Wide channels open behind their advancing full-backs.
                            </p>
                        </div>
                    </div>

                    {/* Danger Men Card */}
                    <div className="bg-white rounded-xl border border-neutral-200 p-3.5 shadow-2xs">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-black text-neutral-900 flex items-center gap-1.5">
                                <Swords className="w-3.5 h-3.5 text-red-600" /> Key Threats (Danger Men)
                            </span>
                            <span className="text-[10px] font-semibold text-neutral-400">
                                Send to Recruitment
                            </span>
                        </div>
                        <div className="space-y-2">
                            {[
                                {
                                    num: 9,
                                    name: "Callum Bradshaw",
                                    pos: "ST",
                                    notes: "11 Goals in 14 games. Physical target man, lethal in the box.",
                                },
                                {
                                    num: 10,
                                    name: "Luke Pennant",
                                    pos: "CAM",
                                    notes: "8 Assists. Takes all corners and direct free kicks.",
                                },
                            ].map((d) => (
                                <div
                                    key={d.num}
                                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2 rounded-xl bg-neutral-50 border border-neutral-200/80"
                                >
                                    <div>
                                        <div className="text-xs font-black text-neutral-900 flex items-center gap-1.5">
                                            <span className="px-1.5 py-0.2 rounded bg-red-600 text-white text-[9px]">
                                                #{d.num}
                                            </span>
                                            <span>{d.name}</span>
                                            <span className="text-[10px] font-bold text-neutral-400">
                                                ({d.pos})
                                            </span>
                                        </div>
                                        <div className="text-[10px] text-neutral-600 mt-0.5">
                                            {d.notes}
                                        </div>
                                    </div>
                                    <span className="px-2 py-1 rounded-lg bg-white border border-neutral-200 text-[10px] font-bold text-neutral-800 shrink-0 self-start sm:self-center">
                                        + Recruit
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Right 5 Cols: Expected Opposition Pitch Shape */}
                <div className="lg:col-span-5 bg-white rounded-xl border border-neutral-200 p-3 shadow-2xs">
                    <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-bold text-neutral-900">
                            Expected Opposition XI (4-2-3-1)
                        </span>
                        <span className="text-[10px] font-bold text-red-600">
                            ★ Key Threats
                        </span>
                    </div>
                    <div className="h-[275px] w-full">
                        <RealisticPitchMarkings>
                            <PitchJerseyNode
                                x={50}
                                y={88}
                                number={1}
                                name="G. Turner"
                                kitColor="#eab308"
                                textColor="#000"
                                compact
                            />
                            <PitchJerseyNode
                                x={18}
                                y={70}
                                number={3}
                                name="S. Moore"
                                kitColor="#2563eb"
                                compact
                            />
                            <PitchJerseyNode
                                x={38}
                                y={73}
                                number={5}
                                name="M. Dawson"
                                kitColor="#2563eb"
                                badge="AERIAL"
                                compact
                            />
                            <PitchJerseyNode
                                x={62}
                                y={73}
                                number={6}
                                name="P. Walsh"
                                kitColor="#2563eb"
                                compact
                            />
                            <PitchJerseyNode
                                x={82}
                                y={70}
                                number={2}
                                name="R. Yates"
                                kitColor="#2563eb"
                                compact
                            />
                            <PitchJerseyNode
                                x={38}
                                y={54}
                                number={4}
                                name="T. Barker"
                                kitColor="#2563eb"
                                compact
                            />
                            <PitchJerseyNode
                                x={62}
                                y={54}
                                number={8}
                                name="J. Finch"
                                kitColor="#2563eb"
                                compact
                            />
                            <PitchJerseyNode
                                x={20}
                                y={34}
                                number={11}
                                name="D. Cross"
                                kitColor="#2563eb"
                                compact
                            />
                            <PitchJerseyNode
                                x={50}
                                y={36}
                                number={10}
                                name="L. Pennant"
                                kitColor="#2563eb"
                                badge="THREAT"
                                compact
                            />
                            <PitchJerseyNode
                                x={80}
                                y={34}
                                number={7}
                                name="K. Frost"
                                kitColor="#2563eb"
                                compact
                            />
                            <PitchJerseyNode
                                x={50}
                                y={15}
                                number={9}
                                name="C. Bradshaw"
                                kitColor="#2563eb"
                                badge="11 GOALS"
                                compact
                            />
                        </RealisticPitchMarkings>
                    </div>
                </div>
            </div>
        </div>
    );
}

const WHATSAPP_SAMPLES: Record<
    "matchday" | "training" | "result",
    { label: string; title: string; timestamp: string; body: string }
> = {
    matchday: {
        label: "Matchday Squad Briefing",
        title: "Northbrook First Team • Players Chat",
        timestamp: "Fri 19:15",
        body: `🔴⚪ *NORTHBROOK UNITED — MATCHDAY SQUAD*
🏆 Premier Division vs Kingswood Rovers (H)
📅 Sat 14 Nov • 🕑 KO: 14:00 • ⏱ Meet: 12:45 Sharp
📍 Northbrook Community Ground, Mill Lane, NW4 2AA
👕 Kit: Home Crimson / White (GK: Emerald)

*STARTING XI (4-3-3):*
1 J. Mercer | 2 L. Reid, 5 D. Foster (C), 6 R. Bennett, 3 A. Clarke | 4 T. Hughes, 8 C. Gallagher, 10 D. Sterling | 7 O. Grant, 9 M. Vance, 11 E. Brooks

*BENCH (5):* 12 S. Henderson, 14 H. Cole, 15 N. Palmer, 16 K. Murray, 17 Z. Bello
🎯 Pens: M. Vance • FK: D. Sterling • Corners: O. Grant

React ✅ once seen. £5 match subs via ClubFlow link.`,
    },
    training: {
        label: "Mid-Week Training Poll",
        title: "Northbrook First Team • Players Chat",
        timestamp: "Tue 10:30",
        body: `⚽ *THURSDAY TRAINING — AVAILABILITY POLL*
📅 Thu 12 Nov • 🕢 19:30 – 21:00 (Arrive 19:15)
📍 Northbrook 3G Pitch 1 (Moulded / Astro boots only)
📋 Focus: Set Pieces & Out-of-Possession Rest Defence

✅ Currently Going (18): H. Cole, D. Foster, J. Mercer, M. Vance, D. Sterling, C. Gallagher +12 others.

Tap your availability link to confirm IN or OUT before Wed 20:00.`,
    },
    result: {
        label: "Full-Time Result Recap",
        title: "Northbrook First Team • Players Chat",
        timestamp: "Sat 16:12",
        body: `✅ *FULL TIME: Northbrook United 3 – 1 Millbrook Town*
🏆 Premier Division • #1st in Table (35 Pts • 2.50 PPG)

⚽ *Goals:* M. Vance (23', 67'), C. Gallagher (81')
👟 *Assists:* D. Sterling (2), T. Hughes
⭐ *Man of the Match:* Marcus Vance

Appearances, minutes & season leaderboards updated on ClubFlow.`,
    },
};

export default function LandingPage() {
    const [activeTab, setActiveTab] = useState<ShowcaseTabId>("dashboard");
    const [autoCyclePaused, setAutoCyclePaused] = useState(false);
    const [isHoveringShowcase, setIsHoveringShowcase] = useState(false);
    const [cycleProgress, setCycleProgress] = useState(0);
    const [whatsappTab, setWhatsappTab] = useState<"matchday" | "training" | "result">("matchday");
    const [copiedWhatsapp, setCopiedWhatsapp] = useState(false);
    const [activeRoleView, setActiveRoleView] = useState<"coaches" | "secretaries">("coaches");
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

    useEffect(() => {
        if (autoCyclePaused || isHoveringShowcase) return;
        const interval = setInterval(() => {
            setCycleProgress((prev) => {
                if (prev >= 100) {
                    setActiveTab((current) => {
                        const idx = SHOWCASE_TABS.findIndex((t) => t.id === current);
                        const nextIdx = (idx + 1) % SHOWCASE_TABS.length;
                        return SHOWCASE_TABS[nextIdx].id;
                    });
                    return 0;
                }
                return prev + 1.5;
            });
        }, 95);
        return () => clearInterval(interval);
    }, [autoCyclePaused, isHoveringShowcase]);

    const handleManualTabSelect = (tab: ShowcaseTabId) => {
        setActiveTab(tab);
        setAutoCyclePaused(true);
        setCycleProgress(0);
    };

    const handleCopySampleWhatsapp = () => {
        if (typeof navigator !== "undefined" && navigator.clipboard) {
            navigator.clipboard.writeText(WHATSAPP_SAMPLES[whatsappTab].body).catch(() => {});
        }
        setCopiedWhatsapp(true);
        setTimeout(() => setCopiedWhatsapp(false), 2200);
    };

    const currentShowcase =
        SHOWCASE_TABS.find((t) => t.id === activeTab) || SHOWCASE_TABS[0];

    return (
        <div className="min-h-screen bg-[#060911] text-white selection:bg-red-600 selection:text-white overflow-x-hidden">
            {/* Subtle Atmospheric Background */}
            <div className="fixed inset-0 pointer-events-none z-0">
                <div className="absolute -top-48 left-1/2 -translate-x-1/2 w-[1100px] h-[540px] bg-gradient-to-b from-red-600/14 via-rose-950/6 to-transparent blur-[130px] rounded-full" />
                <div
                    className="absolute inset-0 opacity-[0.025]"
                    style={{
                        backgroundImage:
                            "linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)",
                        backgroundSize: "56px 56px",
                    }}
                />
            </div>

            {/* =================================================================
                NAVIGATION BAR
            ================================================================= */}
            <header className="sticky top-0 z-50 border-b border-white/[0.08] bg-[#060911]/85 backdrop-blur-xl">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between">
                    <Link href="/" className="flex items-center gap-3 group">
                        <div className="w-10 h-10 rounded-full overflow-hidden border border-white/15 shadow-lg flex items-center justify-center bg-[#060911]">
                            <img
                                src="/clubflow-logo.png"
                                alt="ClubFlow Logo"
                                className="w-full h-full object-cover"
                            />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-lg sm:text-xl font-black tracking-tight text-white leading-none">
                                ClubFlow
                            </span>
                            <span className="text-[10px] font-bold uppercase tracking-widest text-red-500 mt-1">
                                Football Operations
                            </span>
                        </div>
                    </Link>

                    {/* Desktop Links */}
                    <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-neutral-300">
                        <a href="#preview" className="hover:text-white transition-colors">
                            Inside the App
                        </a>
                        <a href="#benefits" className="hover:text-white transition-colors">
                            Why ClubFlow
                        </a>
                        <a href="#features" className="hover:text-white transition-colors">
                            Features
                        </a>
                        <a href="#faq" className="hover:text-white transition-colors">
                            FAQ
                        </a>
                    </nav>

                    {/* Desktop Actions */}
                    <div className="hidden sm:flex items-center gap-3">
                        <Link
                            href="/login"
                            className="px-4 py-2 text-sm font-semibold text-neutral-300 hover:text-white transition-colors"
                        >
                            Sign In
                        </Link>
                        <Link
                            href="/signup"
                            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-sm shadow-lg shadow-red-600/25 transition-all hover:-translate-y-0.5"
                        >
                            <span>Start Your Club</span>
                            <ArrowRight className="w-4 h-4" />
                        </Link>
                    </div>

                    {/* Mobile Hamburger Button */}
                    <button
                        type="button"
                        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                        className="sm:hidden p-2 rounded-lg text-neutral-300 hover:text-white hover:bg-white/5"
                        aria-label="Toggle Menu"
                    >
                        {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                    </button>
                </div>

                {/* Mobile Dropdown Menu */}
                {mobileMenuOpen && (
                    <div className="sm:hidden border-t border-white/10 bg-[#0b101d] px-4 py-4 space-y-3">
                        <div className="flex flex-col space-y-2 text-sm font-semibold text-neutral-200">
                            <a
                                href="#preview"
                                onClick={() => setMobileMenuOpen(false)}
                                className="py-1.5"
                            >
                                Inside the App
                            </a>
                            <a
                                href="#benefits"
                                onClick={() => setMobileMenuOpen(false)}
                                className="py-1.5"
                            >
                                Why ClubFlow
                            </a>
                            <a
                                href="#features"
                                onClick={() => setMobileMenuOpen(false)}
                                className="py-1.5"
                            >
                                Features
                            </a>
                            <a
                                href="#faq"
                                onClick={() => setMobileMenuOpen(false)}
                                className="py-1.5"
                            >
                                FAQ
                            </a>
                        </div>
                        <div className="pt-2 border-t border-white/10 flex flex-col gap-2">
                            <Link
                                href="/login"
                                className="w-full py-2.5 text-center rounded-xl border border-white/15 text-sm font-bold text-white"
                            >
                                Sign In
                            </Link>
                            <Link
                                href="/signup"
                                className="w-full py-2.5 text-center rounded-xl bg-red-600 text-sm font-bold text-white"
                            >
                                Start Your Club
                            </Link>
                        </div>
                    </div>
                )}
            </header>

            <main className="relative z-10">
                {/* =================================================================
                    SECTION 1: HERO & FULL-SIZED INTERACTIVE APPLICATION SHOWCASE
                ================================================================= */}
                <section className="pt-10 pb-16 sm:pt-16 sm:pb-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
                    <div className="text-center max-w-4xl mx-auto">
                        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.04] border border-white/10 text-xs font-semibold text-neutral-300 mb-6">
                            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                            <span>Built for Grassroots, Semi-Pro & Academy Football Clubs</span>
                        </div>

                        <h1 className="text-4xl sm:text-6xl lg:text-[64px] font-black tracking-tight leading-[1.06] text-white">
                            Plan the week.{" "}
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-neutral-100 to-neutral-400">
                                Know your opposition.
                            </span>{" "}
                            <span className="text-red-500">Win on Saturday.</span>
                        </h1>

                        <p className="mt-5 text-base sm:text-xl text-neutral-400 max-w-2xl mx-auto leading-relaxed font-normal">
                            Everything your football club needs to organise the squad, plan training
                            and prepare for matchday — in one place.
                        </p>

                        {/* Primary CTA */}
                        <div className="mt-7 flex flex-col items-center justify-center gap-3.5">
                            <Link
                                href="/signup"
                                className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-8 py-4 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-base shadow-xl shadow-red-600/25 transition-all hover:-translate-y-0.5"
                            >
                                <span>Start Your Club</span>
                                <ArrowRight className="w-4 h-4" />
                            </Link>

                            {/* #6 Instant League & Fixture Auto-Sync Friction-Killer Strip */}
                            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-xs text-neutral-400 font-medium">
                                <span className="inline-flex items-center gap-1.5">
                                    <Zap className="w-3.5 h-3.5 text-amber-400" />
                                    <span>Set up in under 2 minutes</span>
                                </span>
                                <span className="hidden sm:inline text-white/20">•</span>
                                <span className="inline-flex items-center gap-1.5">
                                    <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
                                    <span>Auto-sync league table & fixtures</span>
                                </span>
                                <span className="hidden sm:inline text-white/20">•</span>
                                <span className="inline-flex items-center gap-1.5">
                                    <FileSpreadsheet className="w-3.5 h-3.5 text-sky-400" />
                                    <span>1-click Excel / CSV squad import</span>
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* =============================================================
                        INTERACTIVE FULL-SCALE PRODUCT SHOWCASE (#preview)
                    ============================================================= */}
                    <div
                        id="preview"
                        className="mt-9 sm:mt-11 scroll-mt-24"
                        onMouseEnter={() => setIsHoveringShowcase(true)}
                        onMouseLeave={() => setIsHoveringShowcase(false)}
                    >
                        {/* Screen Selector Tabs with #8 Auto-Cycle Progress Bar */}
                        <div className="flex flex-col items-center">
                            <div className="text-[11px] font-bold uppercase tracking-widest text-neutral-400 mb-3 flex items-center gap-2">
                                <span>Click any module below — or use the sidebar inside the app — to explore</span>
                                {!autoCyclePaused && (
                                    <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-[9px] text-neutral-300">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                        {isHoveringShowcase ? "Paused on hover" : "Auto-touring"}
                                    </span>
                                )}
                            </div>
                            <div className="flex flex-wrap items-center justify-center gap-1 sm:gap-1.5 p-1.5 rounded-2xl bg-[#0d1322] border border-white/10 shadow-xl">
                                {SHOWCASE_TABS.map((tab) => {
                                    const isSelected = tab.id === activeTab;
                                    return (
                                        <button
                                            key={tab.id}
                                            type="button"
                                            onClick={() => handleManualTabSelect(tab.id)}
                                            className={`relative overflow-hidden px-3 py-2 rounded-xl text-xs sm:text-[13px] font-bold transition-all cursor-pointer whitespace-nowrap ${
                                                isSelected
                                                    ? "bg-red-600 text-white shadow-md shadow-red-600/30"
                                                    : "text-neutral-400 hover:text-white hover:bg-white/5"
                                            }`}
                                        >
                                            <span className="hidden sm:inline">{tab.label}</span>
                                            <span className="sm:hidden">{tab.shortLabel}</span>
                                            {isSelected && !autoCyclePaused && (
                                                <span
                                                    className="absolute bottom-0 left-0 h-[3px] bg-white/80 transition-all duration-100 ease-linear"
                                                    style={{ width: `${cycleProgress}%` }}
                                                />
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Active Screen Context Banner */}
                        <div className="mt-5 mb-4 flex flex-col md:flex-row md:items-center justify-between gap-2.5 px-1 sm:px-2">
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                                <span className="self-start inline-flex items-center px-3 py-1 rounded-full bg-red-500/15 border border-red-500/30 text-red-400 text-[11px] font-semibold tracking-wide whitespace-nowrap">
                                    {currentShowcase.badge}
                                </span>
                                <h2 className="text-sm sm:text-base font-semibold text-white leading-snug tracking-tight">
                                    {currentShowcase.headline}
                                </h2>
                            </div>
                            <span className="text-xs text-neutral-400 shrink-0">
                                Showing demo club: <strong className="text-neutral-200">Northbrook United</strong>
                            </span>
                        </div>

                        {/* Restrained Browser Window Frame containing the Real Light-Mode App */}
                        <div className="rounded-2xl sm:rounded-3xl border border-white/15 bg-[#111111] shadow-[0_30px_100px_-20px_rgba(0,0,0,0.95)] overflow-hidden">
                            {/* Browser Chrome Top Bar */}
                            <div className="h-10 sm:h-11 bg-[#141414] border-b border-neutral-800 px-4 flex items-center justify-between select-none">
                                <div className="flex items-center gap-2">
                                    <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f56]" />
                                    <span className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]" />
                                    <span className="w-2.5 h-2.5 rounded-full bg-[#27c93f]" />
                                </div>
                                <div className="px-3 sm:px-4 py-1 rounded-md bg-[#1f1f1f] border border-neutral-700/70 text-[10px] sm:text-[11px] font-mono text-neutral-300 flex items-center gap-2 truncate max-w-[220px] sm:max-w-none">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                                    <span className="truncate">{currentShowcase.url}</span>
                                </div>
                                <div className="hidden sm:flex items-center gap-2 text-[11px] font-semibold text-neutral-400">
                                    <span>Live Interactive Preview</span>
                                </div>
                            </div>

                            {/* Real Application Shell: Dark #171717 Left Sidebar + Light #FCFCFD Main Canvas */}
                            <div className="flex min-h-[410px] bg-[#FCFCFD]">
                                <RealAppSidebar
                                    activeNav={activeTab}
                                    onSelectTab={handleManualTabSelect}
                                />

                                <div className="flex-1 min-w-0 overflow-x-hidden">
                                    {activeTab === "dashboard" && (
                                        <FullDashboardPreview onNavigate={handleManualTabSelect} />
                                    )}
                                    {activeTab === "squad" && <FullSquadPreview />}
                                    {activeTab === "matchday-xi" && <FullMatchdayXiPreview />}
                                    {activeTab === "training" && <FullTrainingPreview />}
                                    {activeTab === "fixtures" && (
                                        <FullFixturesPreview onNavigate={handleManualTabSelect} />
                                    )}
                                    {activeTab === "recruitment" && <FullRecruitmentPreview />}
                                    {activeTab === "opposition" && <FullOppositionPreview />}
                                </div>
                            </div>
                        </div>

                        {/* Supporting description under the frame */}
                        <p className="mt-4 text-center text-xs sm:text-sm text-neutral-400 max-w-3xl mx-auto">
                            {currentShowcase.description}
                        </p>

                        {/* #10 Credibility Strip */}
                        <div className="mt-10 grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                            {[
                                {
                                    badge: "BUILT BY COACHES",
                                    title: "Made for Football Managers",
                                    desc: "Created by active grassroots & semi-pro coaches who run teams every week.",
                                    accent: "text-red-400",
                                },
                                {
                                    badge: "EVERY PITCH FORMAT",
                                    title: "11v11 • 9v9 • 7v7 • 5v5",
                                    desc: "Full formation libraries, custom kit colours, and support from Youth to First Team.",
                                    accent: "text-emerald-400",
                                },
                                {
                                    badge: "AUTOMATIC STATS",
                                    title: "Stats Update Automatically",
                                    desc: "Log a result once and appearances, minutes, goals, assists & cards update everywhere.",
                                    accent: "text-amber-400",
                                },
                                {
                                    badge: "QUICK SETUP",
                                    title: "League Table & Fixture Sync",
                                    desc: "Pull in division standings, PPG splits, and squad lists without typing everything by hand.",
                                    accent: "text-sky-400",
                                },
                            ].map((item) => (
                                <div
                                    key={item.title}
                                    className="rounded-2xl bg-[#0b101d]/90 border border-white/10 p-4 text-left"
                                >
                                    <div className={`text-[9px] font-black uppercase tracking-widest ${item.accent}`}>
                                        {item.badge}
                                    </div>
                                    <div className="text-sm font-black text-white mt-1">
                                        {item.title}
                                    </div>
                                    <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
                                        {item.desc}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* =================================================================
                    SECTION 2: THREE KEY BENEFITS (#benefits)
                ================================================================= */}
                <section
                    id="benefits"
                    className="py-16 sm:py-24 border-t border-white/[0.07] bg-[#080c17]/70"
                >
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="text-center max-w-3xl mx-auto mb-12 sm:mb-16">
                            <div className="text-xs font-bold uppercase tracking-widest text-red-500 mb-2">
                                Built Around the Football Week
                            </div>
                            <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
                                Run your club with clarity all week through to matchday.
                            </h2>
                            <p className="mt-3 text-base text-neutral-400">
                                Designed for managers and coaches who want everything in one structured system instead of scattered spreadsheets, notes apps, and group chats.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="rounded-2xl bg-[#0d1323] border border-white/10 p-6 sm:p-7 flex flex-col justify-between">
                                <div>
                                    <div className="w-11 h-11 rounded-xl bg-red-600/15 border border-red-500/30 flex items-center justify-center text-red-400 mb-5">
                                        <Shirt className="w-5 h-5" />
                                    </div>
                                    <h3 className="text-xl font-black text-white">
                                        1. Prepare for matchday
                                    </h3>
                                    <p className="mt-2.5 text-sm text-neutral-400 leading-relaxed">
                                        Select your starting XI from available players, assign your captain and set-piece takers, prepare your opposition scouting report, and share your matchday graphic in seconds.
                                    </p>
                                </div>
                                <div className="mt-6 pt-4 border-t border-white/[0.06] flex items-center justify-between text-xs font-bold text-neutral-300">
                                    <span>Matchday Planner • Opposition Report</span>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            handleManualTabSelect("matchday-xi");
                                            document
                                                .getElementById("preview")
                                                ?.scrollIntoView({ behavior: "smooth" });
                                        }}
                                        className="text-red-400 hover:text-red-300 cursor-pointer"
                                    >
                                        Preview →
                                    </button>
                                </div>
                            </div>

                            <div className="rounded-2xl bg-[#0d1323] border border-white/10 p-6 sm:p-7 flex flex-col justify-between">
                                <div>
                                    <div className="w-11 h-11 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-5">
                                        <ClipboardCheck className="w-5 h-5" />
                                    </div>
                                    <h3 className="text-xl font-black text-white">
                                        2. Understand your squad
                                    </h3>
                                    <p className="mt-2.5 text-sm text-neutral-400 leading-relaxed">
                                        Know exactly who has been turning up to training, who is injured or suspended, and who leads the team in appearances, goals, assists, and Man of the Match awards.
                                    </p>
                                </div>
                                <div className="mt-6 pt-4 border-t border-white/[0.06] flex items-center justify-between text-xs font-bold text-neutral-300">
                                    <span>Player Squad • Training Attendance</span>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            handleManualTabSelect("squad");
                                            document
                                                .getElementById("preview")
                                                ?.scrollIntoView({ behavior: "smooth" });
                                        }}
                                        className="text-emerald-400 hover:text-emerald-300 cursor-pointer"
                                    >
                                        Preview →
                                    </button>
                                </div>
                            </div>

                            <div className="rounded-2xl bg-[#0d1323] border border-white/10 p-6 sm:p-7 flex flex-col justify-between">
                                <div>
                                    <div className="w-11 h-11 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400 mb-5">
                                        <LayoutDashboard className="w-5 h-5" />
                                    </div>
                                    <h3 className="text-xl font-black text-white">
                                        3. Keep everything organised
                                    </h3>
                                    <p className="mt-2.5 text-sm text-neutral-400 leading-relaxed">
                                        Manage your recruitment, trialists, league table form guide, match subs, and club fines in one clean workspace that works on both laptop and phone.
                                    </p>
                                </div>
                                <div className="mt-6 pt-4 border-t border-white/[0.06] flex items-center justify-between text-xs font-bold text-neutral-300">
                                    <span>Dashboard • Recruitment • Subs</span>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            handleManualTabSelect("recruitment");
                                            document
                                                .getElementById("preview")
                                                ?.scrollIntoView({ behavior: "smooth" });
                                        }}
                                        className="text-blue-400 hover:text-blue-300 cursor-pointer"
                                    >
                                        Preview →
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* =================================================================
                    #3 & #4 WHATSAPP BRIEFING + EXPORTABLE MATCHDAY GRAPHICS & SCOUTING PDFS
                ================================================================= */}
                <section className="py-16 sm:py-24 border-t border-white/[0.07]">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="text-center max-w-3xl mx-auto mb-12 sm:mb-14">
                            <div className="text-xs font-bold uppercase tracking-widest text-emerald-400 mb-2">
                                Ready for the Players’ Group Chat
                            </div>
                            <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
                                One-click WhatsApp briefings, Matchday XI graphics & Scouting PDFs.
                            </h2>
                            <p className="mt-3 text-base text-neutral-400">
                                Every club runs communication on WhatsApp — ClubFlow generates formatted briefings, starting lineup graphics, and opposition dossiers you can drop straight into your players’ or staff chat.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
                            {/* #3 Left 5 Cols: Live 1-Click WhatsApp Briefing Generator */}
                            <div className="lg:col-span-5 rounded-2xl bg-[#0d1323] border border-white/10 p-5 sm:p-6 flex flex-col justify-between">
                                <div>
                                    <div className="flex items-center justify-between gap-2 mb-3">
                                        <span className="inline-flex items-center gap-1.5 text-xs font-black text-emerald-400 uppercase tracking-wider">
                                            <MessageCircle className="w-4 h-4" />
                                            1-Click WhatsApp Generator
                                        </span>
                                        <button
                                            type="button"
                                            onClick={handleCopySampleWhatsapp}
                                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-[11px] font-bold transition-colors cursor-pointer"
                                        >
                                            {copiedWhatsapp ? (
                                                <>
                                                    <Check className="w-3 h-3" />
                                                    <span>Copied ✓</span>
                                                </>
                                            ) : (
                                                <>
                                                    <Copy className="w-3 h-3" />
                                                    <span>Copy Sample</span>
                                                </>
                                            )}
                                        </button>
                                    </div>

                                    {/* Template Switcher */}
                                    <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-[#070b14] border border-white/10 mb-3.5 text-[10px] font-bold">
                                        {(
                                            [
                                                { id: "matchday", label: "Matchday XI" },
                                                { id: "training", label: "Training Poll" },
                                                { id: "result", label: "FT Result" },
                                            ] as const
                                        ).map((t) => (
                                            <button
                                                key={t.id}
                                                type="button"
                                                onClick={() => setWhatsappTab(t.id)}
                                                className={`py-1.5 px-2 rounded-lg transition-all cursor-pointer ${
                                                    whatsappTab === t.id
                                                        ? "bg-emerald-600 text-white shadow-xs"
                                                        : "text-neutral-400 hover:text-white"
                                                }`}
                                            >
                                                {t.label}
                                            </button>
                                        ))}
                                    </div>

                                    {/* Authentic WhatsApp Chat Card */}
                                    <div className="rounded-2xl bg-[#0b141a] border border-emerald-500/20 p-3.5 shadow-inner">
                                        <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-white/10 text-[10px]">
                                            <span className="font-bold text-emerald-400">
                                                {WHATSAPP_SAMPLES[whatsappTab].title}
                                            </span>
                                            <span className="text-neutral-400">
                                                {WHATSAPP_SAMPLES[whatsappTab].timestamp}
                                            </span>
                                        </div>
                                        <div className="rounded-xl bg-[#005c4b]/35 border border-emerald-500/25 p-3 text-[11px] text-neutral-100 whitespace-pre-line leading-relaxed font-sans">
                                            {WHATSAPP_SAMPLES[whatsappTab].body}
                                        </div>
                                    </div>
                                </div>

                                <p className="mt-3 text-[11px] text-neutral-400">
                                    Automatically pulls kick-off, meet time, full venue postcode, kit colours, lineup & set-piece takers.
                                </p>
                            </div>

                            {/* #4 Right 7 Cols: Exported Matchday XI PNG Graphic + Opposition Scouting PDF */}
                            <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {/* Card A: Exported Matchday XI Pitch Graphic */}
                                <div className="rounded-2xl bg-gradient-to-b from-[#131926] to-[#0b0f18] border border-white/15 p-4 shadow-2xl flex flex-col justify-between select-none">
                                    <div>
                                        <div className="flex items-center justify-between mb-2.5">
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/15 border border-red-500/30 text-red-400 text-[9px] font-black uppercase">
                                                <ImageIcon className="w-3 h-3" /> PNG Pitch Graphic
                                            </span>
                                            <span className="text-[9px] font-bold text-neutral-400">
                                                1-Click Download
                                            </span>
                                        </div>

                                        {/* Stadium Graphic Poster Frame */}
                                        <div className="rounded-xl bg-[#090d16] border border-white/10 p-3 text-center">
                                            <div className="text-[8px] font-black uppercase tracking-widest text-red-400">
                                                Premier Division • Starting XI
                                            </div>
                                            <div className="text-xs font-black text-white mt-0.5 tracking-tight">
                                                NORTHBROOK UTD vs KINGSWOOD
                                            </div>
                                            <div className="text-[8px] font-bold text-neutral-400 mt-0.5 mb-2">
                                                KO 14:00 • MEET 12:45 • HOME (4-3-3)
                                            </div>

                                            <div className="h-[195px] w-full">
                                                <RealisticPitchMarkings>
                                                    <PitchJerseyNode x={50} y={88} number={1} name="Mercer" kitColor="#10b981" compact />
                                                    <PitchJerseyNode x={16} y={70} number={3} name="Clarke" compact />
                                                    <PitchJerseyNode x={38} y={73} number={5} name="Foster" isCaptain compact />
                                                    <PitchJerseyNode x={62} y={73} number={6} name="Bennett" compact />
                                                    <PitchJerseyNode x={84} y={70} number={2} name="Reid" compact />
                                                    <PitchJerseyNode x={50} y={53} number={4} name="Hughes" compact />
                                                    <PitchJerseyNode x={28} y={40} number={8} name="Gallagher" compact />
                                                    <PitchJerseyNode x={72} y={40} number={10} name="Sterling" compact />
                                                    <PitchJerseyNode x={20} y={18} number={11} name="Brooks" compact />
                                                    <PitchJerseyNode x={50} y={14} number={9} name="Vance" compact />
                                                    <PitchJerseyNode x={80} y={18} name="Grant" number={7} compact />
                                                </RealisticPitchMarkings>
                                            </div>

                                            <div className="mt-2 pt-1.5 border-t border-white/10 flex items-center justify-between text-[8px] text-neutral-300 font-bold">
                                                <span>BENCH: 12 Henderson • 14 Cole • 15 Palmer • 16 Murray • 17 Bello</span>
                                                <span className="text-amber-400">C: Foster</span>
                                            </div>
                                        </div>
                                    </div>

                                    <p className="mt-2.5 text-[11px] text-neutral-400">
                                        Export crisp Base XI or In-Possession tactical graphics for your changing room or social feed.
                                    </p>
                                </div>

                                {/* Card B: Exported Opposition Scouting Dossier PDF */}
                                <div className="rounded-2xl bg-[#0d1323] border border-white/15 p-4 shadow-2xl flex flex-col justify-between select-none">
                                    <div>
                                        <div className="flex items-center justify-between mb-2.5">
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-[9px] font-black uppercase">
                                                <FileText className="w-3 h-3" /> Scouting Report PDF
                                            </span>
                                            <span className="text-[9px] font-bold text-neutral-400">
                                                Staff & Players Brief
                                            </span>
                                        </div>

                                        {/* Crisp White PDF Sheet Mockup */}
                                        <div className="rounded-xl bg-white text-neutral-900 p-3.5 shadow-md border border-neutral-200 space-y-2.5">
                                            <div className="flex items-start justify-between border-b border-neutral-200 pb-2">
                                                <div>
                                                    <div className="text-[8px] font-black uppercase tracking-widest text-red-600">
                                                        Opposition Dossier • Matchweek 15
                                                    </div>
                                                    <div className="text-xs font-black text-neutral-900">
                                                        Kingswood Rovers (#2nd)
                                                    </div>
                                                </div>
                                                <span className="px-1.5 py-0.5 rounded bg-neutral-900 text-white text-[8px] font-black">
                                                    4-2-3-1
                                                </span>
                                            </div>

                                            <div className="grid grid-cols-2 gap-1.5 text-[9px]">
                                                <div className="p-2 rounded-lg bg-emerald-50/70 border border-emerald-200">
                                                    <div className="font-black text-emerald-800 uppercase text-[8px]">
                                                        Build-Up Pattern
                                                    </div>
                                                    <p className="text-neutral-700 mt-0.5 leading-snug">
                                                        Direct diagonals to #9 Bradshaw; #10 Pennant attacks second balls.
                                                    </p>
                                                </div>
                                                <div className="p-2 rounded-lg bg-rose-50/70 border border-rose-200">
                                                    <div className="font-black text-rose-800 uppercase text-[8px]">
                                                        Key Area to Exploit
                                                    </div>
                                                    <p className="text-neutral-700 mt-0.5 leading-snug">
                                                        Space in behind advancing full-backs on quick wide transitions.
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="rounded-lg bg-neutral-50 border border-neutral-200 p-2 space-y-1">
                                                <div className="text-[8px] font-black uppercase tracking-wider text-neutral-500">
                                                    Flagged Danger Men
                                                </div>
                                                <div className="flex items-center justify-between text-[9px] font-bold">
                                                    <span className="text-neutral-900">#9 C. Bradshaw (ST)</span>
                                                    <span className="text-red-600 font-black">11 Goals • Aerial</span>
                                                </div>
                                                <div className="flex items-center justify-between text-[9px] font-bold">
                                                    <span className="text-neutral-900">#10 L. Pennant (CAM)</span>
                                                    <span className="text-amber-700 font-black">8 Assists • Set Pieces</span>
                                                </div>
                                            </div>

                                            <div className="pt-1 border-t border-neutral-100 flex items-center justify-between text-[8px] font-bold text-neutral-400">
                                                <span>H2H: 2W - 1D - 0L</span>
                                                <span>Generated by ClubFlow</span>
                                            </div>
                                        </div>
                                    </div>

                                    <p className="mt-2.5 text-[11px] text-neutral-400">
                                        Share structured 1-page PDF scouting dossiers with your coaching staff ahead of training.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* =================================================================
                    SECTION 3: FULL-SCALE MOBILE SHOWCASE & CAPABILITIES (#features)
                ================================================================= */}
                <section
                    id="features"
                    className="py-16 sm:py-24 border-t border-white/[0.07] max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"
                >
                    <div className="text-center max-w-3xl mx-auto mb-14">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-bold text-neutral-300 mb-3">
                            <Smartphone className="w-3.5 h-3.5 text-red-500" />
                            <span>Pitchside & On Your Phone</span>
                        </div>
                        <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
                            The exact same club hub in your pocket on matchday.
                        </h2>
                        <p className="mt-3 text-base text-neutral-400">
                            Check your starting XI in the changing room, copy your fixture details to WhatsApp, or tick off Thursday night training attendance straight from your phone.
                        </p>
                    </div>

                    {/* 3 Full-Scale Mobile Screens Matching AppShell */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start justify-items-center">
                        {/* PHONE 1: Mobile Dashboard */}
                        <div className="w-full max-w-[330px] rounded-[36px] p-3 bg-[#161922] border-2 border-white/15 shadow-2xl">
                            <div className="rounded-[26px] overflow-hidden bg-[#FCFCFD] text-neutral-900 border border-neutral-200">
                                {/* Mobile AppShell Top Bar (#171717) */}
                                <div className="h-12 bg-[#171717] text-white px-3.5 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="w-6 h-6 rounded bg-red-600 font-black text-[10px] flex items-center justify-center">
                                            NU
                                        </div>
                                        <span className="font-bold text-xs">Northbrook United</span>
                                    </div>
                                    <Menu className="w-4 h-4 text-neutral-400" />
                                </div>

                                <div className="p-3.5 space-y-3">
                                    {/* Rank & Form */}
                                    <div className="bg-white rounded-xl p-3 border border-neutral-200 shadow-2xs">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-black text-neutral-900">
                                                Premier Division
                                            </span>
                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-50 text-amber-800 border border-amber-200">
                                                #1st (35 Pts)
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1 mt-2">
                                            <span className="text-[9px] font-bold text-neutral-400 uppercase mr-1">
                                                Form:
                                            </span>
                                            {["W", "W", "D", "W", "W"].map((r, i) => (
                                                <span
                                                    key={i}
                                                    className={`w-4 h-4 rounded text-[8px] font-black text-white flex items-center justify-center ${
                                                        r === "W" ? "bg-emerald-500" : "bg-amber-400"
                                                    }`}
                                                >
                                                    {r}
                                                </span>
                                            ))}
                                        </div>
                                        <div className="grid grid-cols-2 gap-1.5 mt-2.5 pt-2 border-t border-neutral-100 text-[10px]">
                                            <div className="bg-neutral-50 p-1.5 rounded border border-neutral-200/70">
                                                <div className="text-neutral-400 font-bold text-[8px] uppercase">
                                                    Home Split
                                                </div>
                                                <div className="font-black text-neutral-900">
                                                    6W-1D-0L • 2.71 PPG
                                                </div>
                                            </div>
                                            <div className="bg-neutral-50 p-1.5 rounded border border-neutral-200/70">
                                                <div className="text-neutral-400 font-bold text-[8px] uppercase">
                                                    Away Split
                                                </div>
                                                <div className="font-black text-neutral-900">
                                                    5W-1D-1L • 2.29 PPG
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Next Match Mobile Card */}
                                    <div className="bg-white rounded-xl p-3 border border-neutral-200 shadow-2xs">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-[9px] font-black uppercase text-neutral-400">
                                                Next Match • 3 Days
                                            </span>
                                            <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-emerald-50 text-emerald-700">
                                                HOME
                                            </span>
                                        </div>
                                        <div className="text-xs font-black text-neutral-900">
                                            vs Kingswood Rovers (#2nd)
                                        </div>
                                        <div className="text-[10px] text-neutral-500 mt-0.5">
                                            Sat 14 Nov • 14:00 • Northbrook Ground
                                        </div>
                                        <div className="grid grid-cols-2 gap-1.5 mt-2.5">
                                            <span className="py-1.5 rounded-lg bg-emerald-50 text-emerald-700 font-bold text-[10px] text-center border border-emerald-200">
                                                WhatsApp Copy
                                            </span>
                                            <span className="py-1.5 rounded-lg bg-red-600 text-white font-bold text-[10px] text-center">
                                                Matchday Planner
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="mt-3 text-center">
                                <div className="text-xs font-bold text-white">Mobile Club Dashboard</div>
                                <div className="text-[11px] text-neutral-400">
                                    Form, splits, next fixture & WhatsApp copy
                                </div>
                            </div>
                        </div>

                        {/* PHONE 2: Mobile Matchday Planner */}
                        <div className="w-full max-w-[330px] rounded-[36px] p-3 bg-[#161922] border-2 border-white/15 shadow-2xl">
                            <div className="rounded-[26px] overflow-hidden bg-[#FCFCFD] text-neutral-900 border border-neutral-200">
                                <div className="h-12 bg-[#171717] text-white px-3.5 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Shirt className="w-4 h-4 text-red-500" />
                                        <span className="font-bold text-xs">Matchday Planner</span>
                                    </div>
                                    <span className="px-2 py-0.5 rounded bg-red-600 text-[10px] font-bold">
                                        4-3-3
                                    </span>
                                </div>

                                <div className="p-3 space-y-2.5">
                                    <div className="h-[225px] w-full">
                                        <RealisticPitchMarkings>
                                            <PitchJerseyNode
                                                x={50}
                                                y={88}
                                                number={1}
                                                name="J. Mercer"
                                                kitColor="#10b981"
                                                compact
                                            />
                                            <PitchJerseyNode
                                                x={17}
                                                y={70}
                                                number={3}
                                                name="A. Clarke"
                                                compact
                                            />
                                            <PitchJerseyNode
                                                x={38}
                                                y={73}
                                                number={5}
                                                name="D. Foster"
                                                isCaptain
                                                compact
                                            />
                                            <PitchJerseyNode
                                                x={62}
                                                y={73}
                                                number={6}
                                                name="R. Bennett"
                                                compact
                                            />
                                            <PitchJerseyNode
                                                x={83}
                                                y={70}
                                                number={2}
                                                name="L. Reid"
                                                compact
                                            />
                                            <PitchJerseyNode
                                                x={50}
                                                y={53}
                                                number={4}
                                                name="T. Hughes"
                                                compact
                                            />
                                            <PitchJerseyNode
                                                x={28}
                                                y={42}
                                                number={8}
                                                name="C. Gallagher"
                                                compact
                                            />
                                            <PitchJerseyNode
                                                x={72}
                                                y={42}
                                                number={10}
                                                name="D. Sterling"
                                                compact
                                            />
                                            <PitchJerseyNode
                                                x={20}
                                                y={19}
                                                number={11}
                                                name="E. Brooks"
                                                compact
                                            />
                                            <PitchJerseyNode
                                                x={50}
                                                y={14}
                                                number={9}
                                                name="M. Vance"
                                                compact
                                            />
                                            <PitchJerseyNode
                                                x={80}
                                                y={19}
                                                number={7}
                                                name="O. Grant"
                                                compact
                                            />
                                        </RealisticPitchMarkings>
                                    </div>

                                    <div className="bg-white rounded-xl p-2.5 border border-neutral-200 text-[10px] space-y-1">
                                        <div className="font-black text-neutral-900 uppercase text-[9px]">
                                            Bench & Set Pieces
                                        </div>
                                        <div className="text-neutral-600 font-semibold truncate">
                                            Subs (5/5): 12 Henderson, 14 Cole, 15 Palmer, 16 Murray, 17 Bello
                                        </div>
                                        <div className="flex items-center justify-between pt-1 border-t border-neutral-100 text-neutral-800 font-bold">
                                            <span>Capt: D. Foster</span>
                                            <span>Pens: M. Vance</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="mt-3 text-center">
                                <div className="text-xs font-bold text-white">Mobile Matchday Planner</div>
                                <div className="text-[11px] text-neutral-400">
                                    Starting lineup, bench & set-piece takers
                                </div>
                            </div>
                        </div>

                        {/* PHONE 3: Mobile Training & Attendance */}
                        <div className="w-full max-w-[330px] rounded-[36px] p-3 bg-[#161922] border-2 border-white/15 shadow-2xl">
                            <div className="rounded-[26px] overflow-hidden bg-[#FCFCFD] text-neutral-900 border border-neutral-200">
                                <div className="h-12 bg-[#171717] text-white px-3.5 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <ClipboardCheck className="w-4 h-4 text-emerald-400" />
                                        <span className="font-bold text-xs">Training Attendance</span>
                                    </div>
                                    <span className="px-2 py-0.5 rounded bg-emerald-600 text-[10px] font-bold">
                                        86% Avg
                                    </span>
                                </div>

                                <div className="p-3.5 space-y-2.5">
                                    <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl p-2.5">
                                        <div className="flex items-center justify-between text-[10px] font-black text-emerald-800">
                                            <span>THU 12 NOV • 19:30</span>
                                            <span>18 ATTENDING</span>
                                        </div>
                                        <div className="text-xs font-black text-neutral-900 mt-0.5">
                                            Set Pieces & Out-of-Possession Shape
                                        </div>
                                    </div>

                                    <div className="bg-white rounded-xl border border-neutral-200 divide-y divide-neutral-100">
                                        {[
                                            {
                                                name: "Harrison Cole",
                                                pos: "MID",
                                                streak: "🔥 9",
                                                last5: ["✓", "✓", "✓", "✓", "✓"],
                                                pct: "94%",
                                            },
                                            {
                                                name: "Dan Foster",
                                                pos: "DEF",
                                                streak: "🔥 6",
                                                last5: ["✓", "✓", "L", "✓", "✓"],
                                                pct: "94%",
                                            },
                                            {
                                                name: "Jordan Mercer",
                                                pos: "GK",
                                                streak: "🔥 5",
                                                last5: ["✓", "✓", "✓", "✓", "✓"],
                                                pct: "89%",
                                            },
                                        ].map((p) => (
                                            <div
                                                key={p.name}
                                                className="p-2.5 flex items-center justify-between text-[11px]"
                                            >
                                                <div>
                                                    <div className="font-bold text-neutral-900 flex items-center gap-1">
                                                        <span>{p.name}</span>
                                                        <span className="text-[9px] px-1 rounded bg-orange-50 text-orange-700 font-black">
                                                            {p.streak}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-0.5 mt-1">
                                                        {p.last5.map((s, idx) => (
                                                            <span
                                                                key={idx}
                                                                className={`w-4 h-4 rounded text-[8px] font-black flex items-center justify-center ${
                                                                    s === "✓"
                                                                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                                                        : s === "L"
                                                                        ? "bg-amber-50 text-amber-700 border border-amber-200"
                                                                        : "bg-red-50 text-red-600 border border-red-200"
                                                                }`}
                                                            >
                                                                {s}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                                <span className="font-black text-emerald-700 text-xs">
                                                    {p.pct}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <div className="mt-3 text-center">
                                <div className="text-xs font-bold text-white">
                                    Mobile Training & Attendance
                                </div>
                                <div className="text-[11px] text-neutral-400">
                                    Streaks, last 5 sessions & commitment %
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* #9 Role-Based Capabilities Switcher: Managers & Coaches vs Secretaries & Treasurers */}
                    <div className="mt-20">
                        <div className="text-center max-w-2xl mx-auto mb-8">
                            <h3 className="text-2xl sm:text-3xl font-black text-white">
                                Built for the dugout and the clubhouse
                            </h3>
                            <p className="mt-2 text-sm text-neutral-400">
                                Switch roles below to see how ClubFlow supports both your coaching staff and your club operations team.
                            </p>

                            {/* Role Pill Switcher */}
                            <div className="mt-5 inline-flex flex-wrap items-center justify-center gap-1.5 p-1.5 rounded-2xl bg-[#0d1322] border border-white/10">
                                <button
                                    type="button"
                                    onClick={() => setActiveRoleView("coaches")}
                                    className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                                        activeRoleView === "coaches"
                                            ? "bg-red-600 text-white shadow-md shadow-red-600/30"
                                            : "text-neutral-400 hover:text-white"
                                    }`}
                                >
                                    For Managers & Coaches
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setActiveRoleView("secretaries")}
                                    className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                                        activeRoleView === "secretaries"
                                            ? "bg-red-600 text-white shadow-md shadow-red-600/30"
                                            : "text-neutral-400 hover:text-white"
                                    }`}
                                >
                                    For Secretaries & Treasurers
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {(activeRoleView === "coaches"
                                ? [
                                      {
                                          icon: Shirt,
                                          title: "Tactical Matchday XI & Rest Defence",
                                          desc: "Pick your starting XI from fit players, map In-Possession 3-2-5 shapes & attacking lanes, and assign set-piece roles.",
                                      },
                                      {
                                          icon: Activity,
                                          title: "Minutes, Assists & Card Tracking",
                                          desc: "Automatically track starts, sub minutes, goals, assists, MOTM awards, and yellow-card suspension thresholds.",
                                      },
                                      {
                                          icon: ClipboardCheck,
                                          title: "Training Streaks & Commitment %",
                                          desc: "See every player's seasonal attendance percentage, active streaks, and last 5 sessions before naming the squad.",
                                      },
                                      {
                                          icon: Shield,
                                          title: "Opposition Reports & Danger Men",
                                          desc: "Break down how opponents build up, where they are vulnerable, and flag standout threats for your players.",
                                      },
                                      {
                                          icon: Target,
                                          title: "Trialists & Recruitment Pipeline",
                                          desc: "Move watched players from Scouted to On Trial and Signed, with star ratings and coach notes in one place.",
                                      },
                                      {
                                          icon: MessageCircle,
                                          title: "1-Click WhatsApp & Pitch Graphics",
                                          desc: "Copy formatted matchday briefings and export crisp lineup PNGs and scouting PDFs straight to your group chat.",
                                      },
                                  ]
                                : [
                                      {
                                          icon: RefreshCw,
                                          title: "League Table & Fixture Auto-Sync",
                                          desc: "Sync division standings, Points Per Game (PPG) splits, and upcoming league & cup schedules in seconds.",
                                      },
                                      {
                                          icon: Coins,
                                          title: "Match Subs & Membership Ledgers",
                                          desc: "Track weekly matchday subs, annual signing-on fees, and outstanding player balances without chasing spreadsheets.",
                                      },
                                      {
                                          icon: Gavel,
                                          title: "Dressing-Room Fines & Club Expenses",
                                          desc: "Log referee fees, pitch hire, equipment costs, and player fines with clear paid/unpaid status tracking.",
                                      },
                                      {
                                          icon: Users,
                                          title: "Registrations, Loans & Medical Status",
                                          desc: "Maintain clean squad records across First Team, Reserves, dual-registration players, and injury return dates.",
                                      },
                                      {
                                          icon: FileSpreadsheet,
                                          title: "Instant Excel, CSV & PDF Exports",
                                          desc: "Import existing player lists in one click and export attendance, squad stats, or financial ledgers whenever needed.",
                                      },
                                      {
                                          icon: Settings,
                                          title: "Multi-Staff Roles & Custom Branding",
                                          desc: "Configure your club crest, custom Home/Away/3rd kit colours, home ground postcode, and staff access.",
                                      },
                                  ]
                            ).map((item) => {
                                const Icon = item.icon;
                                return (
                                    <div
                                        key={item.title}
                                        className="rounded-2xl bg-[#0d1323]/90 border border-white/10 p-5 hover:border-white/20 transition-colors"
                                    >
                                        <div className="flex items-center gap-3 mb-2.5">
                                            <div className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-red-400">
                                                <Icon className="w-4 h-4" />
                                            </div>
                                            <h4 className="text-base font-bold text-white">
                                                {item.title}
                                            </h4>
                                        </div>
                                        <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed">
                                            {item.desc}
                                        </p>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </section>

                {/* =================================================================
                    SECTION 4: FREQUENTLY ASKED QUESTIONS (#faq)
                ================================================================= */}
                <section
                    id="faq"
                    className="py-16 sm:py-24 border-t border-white/[0.07] bg-[#080c17]/60"
                >
                    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="text-center mb-12">
                            <div className="text-xs font-bold uppercase tracking-widest text-red-500 mb-2">
                                Frequently Asked Questions
                            </div>
                            <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
                                Everything you need to know before getting started
                            </h2>
                        </div>

                        <div className="space-y-3">
                            {FAQ_ITEMS.map((item, index) => {
                                const isOpen = openFaqIndex === index;
                                return (
                                    <div
                                        key={item.q}
                                        className="rounded-2xl bg-[#0d1323] border border-white/10 overflow-hidden"
                                    >
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setOpenFaqIndex(isOpen ? null : index)
                                            }
                                            className="w-full px-6 py-4 text-left flex items-center justify-between gap-4 cursor-pointer"
                                        >
                                            <span className="text-sm sm:text-base font-bold text-white">
                                                {item.q}
                                            </span>
                                            <ChevronDown
                                                className={`w-4 h-4 text-neutral-400 shrink-0 transition-transform ${
                                                    isOpen ? "rotate-180 text-white" : ""
                                                }`}
                                            />
                                        </button>
                                        {isOpen && (
                                            <div className="px-6 pb-5 text-sm text-neutral-400 leading-relaxed border-t border-white/[0.06] pt-3">
                                                {item.a}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </section>

                {/* =================================================================
                    SECTION 5: FINAL CALL TO ACTION
                ================================================================= */}
                <section className="py-16 sm:py-24 border-t border-white/[0.07] px-4 sm:px-6 lg:px-8">
                    <div className="max-w-5xl mx-auto rounded-3xl bg-gradient-to-br from-[#131b31] via-[#0e1425] to-[#1a0c14] border border-white/15 p-8 sm:p-14 text-center shadow-2xl">
                        <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-white">
                            Ready to organise your club properly?
                        </h2>
                        <p className="mt-4 text-base sm:text-lg text-neutral-300 max-w-2xl mx-auto">
                            Set up your club workspace in minutes and bring your squad, training attendance, Matchday Planner, and opposition prep into one place.
                        </p>
                        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3.5">
                            <Link
                                href="/signup"
                                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-base shadow-xl shadow-red-600/25 transition-all"
                            >
                                <span>Start Your Club</span>
                                <ArrowRight className="w-4 h-4" />
                            </Link>
                            <Link
                                href="/login"
                                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-white/5 hover:bg-white/10 text-white font-semibold text-base border border-white/10 transition-all"
                            >
                                <span>Sign In to Existing Club</span>
                            </Link>
                        </div>
                    </div>
                </section>
            </main>

            {/* Footer */}
            <footer className="border-t border-white/[0.08] py-10 px-4 sm:px-6 lg:px-8 bg-[#05070e]">
                <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-neutral-500">
                    <div className="flex flex-wrap items-center justify-center gap-2 text-center sm:text-left">
                        <img
                            src="/clubflow-logo.png"
                            alt="ClubFlow"
                            className="w-6 h-6 rounded-full object-cover"
                        />
                        <span className="font-bold text-neutral-300">ClubFlow</span>
                        <span>• Grassroots, Semi-Pro & Academy Football Operations</span>
                    </div>
                    <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6">
                        <a href="#preview" className="hover:text-neutral-300">
                            Inside the App
                        </a>
                        <a href="#features" className="hover:text-neutral-300">
                            Features
                        </a>
                        <a href="#faq" className="hover:text-neutral-300">
                            FAQ
                        </a>
                        <Link href="/privacy" className="hover:text-neutral-300">
                            Privacy Policy
                        </Link>
                        <Link href="/terms" className="hover:text-neutral-300">
                            Terms &amp; Refunds
                        </Link>
                        <a href="mailto:support@clubflow.org.uk" className="hover:text-neutral-300">
                            Support
                        </a>
                        <Link href="/login" className="hover:text-neutral-300">
                            Sign In
                        </Link>
                        <Link href="/signup" className="text-red-400 font-bold hover:text-red-300">
                            Start Your Club
                        </Link>
                    </div>
                </div>
            </footer>
        </div>
    );
}