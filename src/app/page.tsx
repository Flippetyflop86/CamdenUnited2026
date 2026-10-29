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
    X,
    Plus,
    CreditCard,
    Activity,
    Copy,
    Home,
    Plane,
    AlertCircle,
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
    Eye,
} from "lucide-react";

type ShowcaseTabId =
    | "dashboard"
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
        badge: "Weekly Command Centre",
        headline: "Your entire week at a glance — form, home/away splits, next fixture, training & leaderboards.",
        description:
            "Open ClubFlow on Monday morning and immediately see what needs attention, who is attending Thursday training, how your last match went, and who leads the squad in goals, assists, MOTM awards, and training commitment.",
    },
    {
        id: "matchday-xi",
        label: "Matchday XI",
        shortLabel: "Matchday XI",
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
            "Log match results in seconds, record goals, assists, cards, and Man of the Match awards, and jump straight into the saved Matchday XI or opposition dossier for any fixture.",
    },
    {
        id: "recruitment",
        label: "Recruitment & Trialists",
        shortLabel: "Recruitment",
        url: "app.clubflow.org.uk/recruitment",
        badge: "Scouting Pipeline",
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
        headline: "Build structured scouting dossiers on every team in your division and flag their danger men.",
        description:
            "Document how your next opponents build up in possession, defend out of possession, and set up on corners — and send standout opposition players straight to your recruitment shortlist.",
    },
];

const FAQ_ITEMS = [
    {
        q: "Who is ClubFlow built for?",
        a: "ClubFlow is designed specifically for grassroots, Sunday League, Saturday amateur, and semi-professional (Step 5–7 & county league) football managers, coaches, and club secretaries who want a proper operational setup without enterprise complexity.",
    },
    {
        q: "Does ClubFlow work on mobile as well as laptop and desktop?",
        a: "Yes. Every screen in ClubFlow is built to work on both desktop and mobile browsers. You can plan your Matchday XI and opposition reports on a laptop mid-week, then check attendance, log match stats, or copy your WhatsApp briefing pitchside from your phone.",
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
        a: "Yes. You can export Matchday XI pitch graphics, training attendance leaderboards, one-click WhatsApp fixture and training briefings, and Excel/PDF reports for recruitment and squad records.",
    },
    {
        q: "Is our club data private to our staff?",
        a: "Yes. Your squad availability, tactical lineups, opposition scouting dossiers, recruitment targets, and financial ledgers are strictly private to your authenticated club workspace.",
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
                { name: "Squad", icon: Users },
                { name: "Training", id: "training", icon: ClipboardCheck },
                { name: "Fixtures", id: "fixtures", icon: Calendar },
                { name: "Matchday XI", id: "matchday-xi", icon: Shirt },
                { name: "League Table", icon: Trophy },
                { name: "Opposition Reports", id: "opposition", icon: Shield },
                { name: "Recruitment", id: "recruitment", icon: UserPlus },
            ],
        },
        {
            group: "Financials",
            items: [
                { name: "Payments", icon: CreditCard },
                { name: "Club Subs", icon: Coins },
                { name: "Fines", icon: Gavel },
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
 * SCREEN 1: FULL-SCALE REAL DASHBOARD (matching src/app/dashboard/page.tsx lines 808-1515)
 */
function FullDashboardPreview({
    onNavigate,
}: {
    onNavigate: (tab: ShowcaseTabId) => void;
}) {
    return (
        <div className="p-4 sm:p-6 space-y-4 bg-[#FCFCFD] text-neutral-900 select-none">
            {/* 1. Club Identity Header + Form + Home/Away Splits */}
            <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-sm p-4 sm:p-5 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-red-600 flex items-center justify-center font-black text-white text-base shadow-sm shrink-0">
                        NU
                    </div>
                    <div>
                        <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-lg sm:text-xl font-black text-neutral-900 tracking-tight">
                                Northbrook United
                            </h3>
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200/80">
                                <Trophy className="w-3 h-3 text-amber-500" /> #1st in League
                            </span>
                            <span className="text-[11px] font-semibold text-neutral-400">
                                Premier Division • 2025/26
                            </span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-2">
                            <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mr-1">
                                Form:
                            </span>
                            {["W", "W", "D", "W", "W"].map((res, idx) => (
                                <span
                                    key={idx}
                                    className={`w-5 h-5 rounded text-[10px] font-black flex items-center justify-center text-white shadow-xs ${
                                        res === "W" ? "bg-emerald-500" : "bg-amber-400"
                                    }`}
                                >
                                    {res}
                                </span>
                            ))}
                            <span className="ml-2 text-[11px] font-bold text-neutral-500">
                                11W – 2D – 1L (35 Pts • 2.50 PPG)
                            </span>
                        </div>
                    </div>
                </div>

                {/* Home & Away Splits */}
                <div className="grid grid-cols-2 gap-2.5 sm:w-auto shrink-0">
                    <div className="bg-neutral-50 rounded-xl p-2.5 border border-neutral-200/80 flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                            <Home className="w-4 h-4" />
                        </div>
                        <div>
                            <div className="text-[9px] font-bold uppercase tracking-wider text-neutral-400">
                                Home Split
                            </div>
                            <div className="text-xs font-black text-neutral-900">6W-1D-0L</div>
                            <div className="text-[10px] font-bold text-emerald-600">2.71 PPG</div>
                        </div>
                    </div>
                    <div className="bg-neutral-50 rounded-xl p-2.5 border border-neutral-200/80 flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                            <Plane className="w-4 h-4" />
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

            {/* 2. Needs Attention Manager Action Strip */}
            <div className="bg-white rounded-xl border border-neutral-200/80 shadow-xs px-4 py-2.5 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                    <span className="text-xs font-bold text-neutral-900">Needs Attention</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        onClick={() => onNavigate("training")}
                        className="text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200/70 px-2.5 py-1 rounded-lg hover:bg-amber-100/70 transition-colors cursor-pointer"
                    >
                        3 players pending Thursday training RSVP →
                    </button>
                    <button
                        type="button"
                        onClick={() => onNavigate("opposition")}
                        className="text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200/70 px-2.5 py-1 rounded-lg hover:bg-indigo-100/70 transition-colors cursor-pointer"
                    >
                        Kingswood Rovers scouting dossier updated →
                    </button>
                    <span className="text-[11px] font-semibold bg-neutral-100 text-neutral-700 px-2.5 py-1 rounded-lg">
                        2 outstanding match subs (£10)
                    </span>
                </div>
            </div>

            {/* 3. Three-Column Briefing Row: Next Match | Next Training | Last Match Recap */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Card 1: Next Match */}
                <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-sm p-4 flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between mb-2.5">
                            <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                                <Calendar className="w-3.5 h-3.5 text-red-600" /> Next Match
                            </span>
                            <div className="flex items-center gap-1.5">
                                <span className="px-2 py-0.5 text-[10px] font-black uppercase rounded-md bg-red-50 text-red-700 border border-red-200">
                                    3 DAYS
                                </span>
                                <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    HOME
                                </span>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="text-base font-black text-neutral-900">
                                vs Kingswood Rovers
                            </div>
                            <span className="px-1.5 py-0.5 text-[10px] font-black rounded bg-neutral-100 text-neutral-700 border border-neutral-200">
                                #2nd
                            </span>
                        </div>
                        <div className="text-[11px] text-neutral-500 mt-1.5 space-y-1 font-medium">
                            <div className="flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5 text-neutral-400" /> Sat 14 Nov • 14:00 KO
                            </div>
                            <div className="flex items-center gap-1.5">
                                <MapPin className="w-3.5 h-3.5 text-neutral-400" /> Northbrook Community Ground
                            </div>
                        </div>
                    </div>

                    <div className="mt-3.5 pt-3 border-t border-neutral-100 space-y-2">
                        <div className="flex items-center gap-2">
                            <span className="flex-1 py-1.5 px-2.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200/60 font-bold text-[11px] flex items-center justify-center gap-1">
                                <Copy className="w-3 h-3" /> WhatsApp Copy
                            </span>
                            <button
                                type="button"
                                onClick={() => onNavigate("matchday-xi")}
                                className="flex-1 py-1.5 px-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold text-[11px] text-center transition-colors cursor-pointer"
                            >
                                Matchday XI →
                            </button>
                        </div>
                        <button
                            type="button"
                            onClick={() => onNavigate("opposition")}
                            className="w-full py-1.5 px-2.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/60 font-bold text-[11px] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                        >
                            <Shield className="w-3.5 h-3.5" /> Opposition Scouting Report
                        </button>
                    </div>
                </div>

                {/* Card 2: Next Training */}
                <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-sm p-4 flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between mb-2.5">
                            <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                                <ClipboardCheck className="w-3.5 h-3.5 text-emerald-600" /> Next Training
                            </span>
                            <span className="px-2 py-0.5 text-[10px] font-extrabold rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                                18 Attending
                            </span>
                        </div>
                        <div className="text-base font-black text-neutral-900">
                            Thursday Night Session
                        </div>
                        <div className="text-[11px] text-neutral-500 mt-1.5 space-y-1 font-medium">
                            <div className="flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5 text-neutral-400" /> Thu 12 Nov • 19:30 – 21:00
                            </div>
                            <div className="flex items-center gap-1.5">
                                <MapPin className="w-3.5 h-3.5 text-neutral-400" /> 3G Pitch 1 (Floodlit)
                            </div>
                        </div>
                        <div className="mt-2.5 px-2.5 py-1.5 rounded-lg bg-neutral-50 border border-neutral-200/70 text-[11px] text-neutral-700 font-semibold">
                            <span className="text-neutral-400 font-bold uppercase text-[9px] mr-1.5">
                                Focus:
                            </span>
                            Out of possession shape & attacking set pieces
                        </div>
                    </div>

                    <div className="mt-3.5 pt-3 border-t border-neutral-100 flex items-center gap-2">
                        <span className="flex-1 py-1.5 px-2.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200/60 font-bold text-[11px] flex items-center justify-center gap-1">
                            <Copy className="w-3 h-3" /> WhatsApp Copy
                        </span>
                        <button
                            type="button"
                            onClick={() => onNavigate("training")}
                            className="flex-1 py-1.5 px-2.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-white font-bold text-[11px] text-center transition-colors cursor-pointer"
                        >
                            Attendance →
                        </button>
                    </div>
                </div>

                {/* Card 3: Last Match Recap */}
                <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-sm p-4 flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between mb-2.5">
                            <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                                <Activity className="w-3.5 h-3.5 text-blue-600" /> Last Match Recap
                            </span>
                            <div className="flex items-center gap-1.5">
                                <span className="text-[10px] font-bold text-neutral-400">Sat 7 Nov</span>
                                <span className="px-2 py-0.5 text-[10px] font-black uppercase rounded-md bg-emerald-500 text-white">
                                    WIN
                                </span>
                            </div>
                        </div>

                        <div className="bg-neutral-50 rounded-xl p-2.5 border border-neutral-200/80 flex items-center justify-between">
                            <div>
                                <div className="text-xs font-black text-neutral-900">
                                    Northbrook United
                                </div>
                                <div className="text-xs font-semibold text-neutral-500 mt-0.5">
                                    Millbrook Town
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="text-sm font-black text-emerald-600">3</div>
                                <div className="text-sm font-bold text-neutral-400 mt-0.5">1</div>
                            </div>
                        </div>

                        {/* Goals / Assists / MOTM breakdown */}
                        <div className="grid grid-cols-3 gap-1.5 mt-2.5">
                            <div className="bg-neutral-900 text-white rounded-lg p-2">
                                <div className="text-[9px] font-bold text-neutral-400 uppercase">
                                    ⚽ Goals
                                </div>
                                <div className="text-[10px] font-bold text-white mt-0.5 leading-tight">
                                    M. Vance (2)
                                    <br />
                                    C. Gallagher
                                </div>
                            </div>
                            <div className="bg-neutral-900 text-white rounded-lg p-2">
                                <div className="text-[9px] font-bold text-neutral-400 uppercase">
                                    👟 Assists
                                </div>
                                <div className="text-[10px] font-bold text-white mt-0.5 leading-tight">
                                    D. Sterling (2)
                                    <br />
                                    T. Vance
                                </div>
                            </div>
                            <div className="bg-neutral-900 text-white rounded-lg p-2">
                                <div className="text-[9px] font-bold text-amber-400 uppercase">
                                    ⭐ MOTM
                                </div>
                                <div className="text-[10px] font-black text-amber-300 mt-0.5 leading-tight">
                                    Marcus Vance
                                </div>
                                <div className="text-[9px] text-neutral-400 mt-0.5">9.2 Rating</div>
                            </div>
                        </div>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-neutral-100 flex items-center justify-between text-[11px]">
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

            {/* 4. Season Leaderboards 4-Card Strip */}
            <div>
                <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-black uppercase tracking-wider text-neutral-500">
                        Season Leaderboards (All Competitions)
                    </span>
                    <span className="text-[11px] font-bold text-neutral-400">
                        14 Matches Played
                    </span>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="bg-white rounded-xl border border-neutral-200/80 p-3.5 shadow-xs">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                                Top Goalscorer
                            </span>
                            <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-red-50 text-red-600">
                                FWD
                            </span>
                        </div>
                        <div className="text-2xl font-black text-neutral-900 mt-1">14</div>
                        <div className="text-xs font-extrabold text-neutral-800 mt-0.5">
                            Marcus Vance
                        </div>
                        <div className="text-[10px] font-semibold text-neutral-400 mt-0.5">
                            0.88 Goals / Game • 2 Pens
                        </div>
                    </div>

                    <div className="bg-white rounded-xl border border-neutral-200/80 p-3.5 shadow-xs">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                                Most Assists
                            </span>
                            <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-blue-50 text-blue-600">
                                MID
                            </span>
                        </div>
                        <div className="text-2xl font-black text-neutral-900 mt-1">11</div>
                        <div className="text-xs font-extrabold text-neutral-800 mt-0.5">
                            Declan Sterling
                        </div>
                        <div className="text-[10px] font-semibold text-neutral-400 mt-0.5">
                            18 Goal Contributions (7G, 11A)
                        </div>
                    </div>

                    <div className="bg-white rounded-xl border border-neutral-200/80 p-3.5 shadow-xs">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                                Man of the Match
                            </span>
                            <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-amber-50 text-amber-700">
                                ⭐ MOTM
                            </span>
                        </div>
                        <div className="text-2xl font-black text-neutral-900 mt-1">4</div>
                        <div className="text-xs font-extrabold text-neutral-800 mt-0.5">
                            Callum Gallagher
                        </div>
                        <div className="text-[10px] font-semibold text-neutral-400 mt-0.5">
                            14 Starts • CM
                        </div>
                    </div>

                    <div className="bg-white rounded-xl border border-neutral-200/80 p-3.5 shadow-xs">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                                Training Commitment
                            </span>
                            <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700">
                                🔥 9 Streak
                            </span>
                        </div>
                        <div className="text-2xl font-black text-emerald-600 mt-1">94%</div>
                        <div className="text-xs font-extrabold text-neutral-800 mt-0.5">
                            Harrison Cole
                        </div>
                        <div className="text-[10px] font-semibold text-neutral-400 mt-0.5">
                            17/18 Sessions • Squad Avg: 86%
                        </div>
                    </div>
                </div>
            </div>

            {/* 5. Bottom Split: League Table Context (Left) + Squad Availability & Absences (Right) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                {/* League Table Context (7 cols) */}
                <div className="lg:col-span-7 bg-white rounded-2xl border border-neutral-200/80 shadow-sm p-4">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <Trophy className="w-4 h-4 text-amber-500" />
                            <span className="text-xs font-black text-neutral-900">
                                League Table Context
                            </span>
                            <span className="text-[10px] font-semibold text-neutral-400">
                                Premier Division
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-neutral-100 text-neutral-700 text-[10px] font-bold">
                                <RefreshCw className="w-3 h-3" /> Sync Table
                            </span>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-neutral-100 text-[9px] font-bold uppercase text-neutral-400">
                                    <th className="py-1.5 px-2">Pos</th>
                                    <th className="py-1.5 px-2">Club</th>
                                    <th className="py-1.5 px-2 text-center">P</th>
                                    <th className="py-1.5 px-2 text-center">W-D-L</th>
                                    <th className="py-1.5 px-2 text-center">GD</th>
                                    <th className="py-1.5 px-2 text-center">PPG</th>
                                    <th className="py-1.5 px-2 text-center">Pts</th>
                                    <th className="py-1.5 px-2 text-right">Form</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-100 text-[11px]">
                                {[
                                    {
                                        pos: 1,
                                        team: "Northbrook United",
                                        p: 14,
                                        wdl: "11-2-1",
                                        gd: "+24",
                                        ppg: "2.50",
                                        pts: 35,
                                        form: ["W", "W", "D", "W", "W"],
                                        isUs: true,
                                    },
                                    {
                                        pos: 2,
                                        team: "Kingswood Rovers",
                                        p: 14,
                                        wdl: "10-2-2",
                                        gd: "+18",
                                        ppg: "2.29",
                                        pts: 32,
                                        form: ["W", "L", "W", "W", "D"],
                                        isUs: false,
                                    },
                                    {
                                        pos: 3,
                                        team: "Highgate Rangers",
                                        p: 14,
                                        wdl: "9-2-3",
                                        gd: "+14",
                                        ppg: "2.07",
                                        pts: 29,
                                        form: ["W", "W", "L", "W", "W"],
                                        isUs: false,
                                    },
                                ].map((row) => (
                                    <tr
                                        key={row.pos}
                                        className={
                                            row.isUs
                                                ? "bg-red-50/70 font-bold text-neutral-900"
                                                : "text-neutral-700"
                                        }
                                    >
                                        <td className="py-2 px-2 font-black">{row.pos}</td>
                                        <td className="py-2 px-2 font-extrabold flex items-center gap-1.5">
                                            {row.team}
                                            {row.pos === 2 && (
                                                <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-amber-100 text-amber-800">
                                                    NEXT OPP
                                                </span>
                                            )}
                                        </td>
                                        <td className="py-2 px-2 text-center">{row.p}</td>
                                        <td className="py-2 px-2 text-center text-neutral-500">
                                            {row.wdl}
                                        </td>
                                        <td className="py-2 px-2 text-center font-semibold text-emerald-700">
                                            {row.gd}
                                        </td>
                                        <td className="py-2 px-2 text-center font-bold">
                                            {row.ppg}
                                        </td>
                                        <td className="py-2 px-2 text-center font-black text-neutral-900">
                                            {row.pts}
                                        </td>
                                        <td className="py-2 px-2">
                                            <div className="flex items-center justify-end gap-0.5">
                                                {row.form.map((f, i) => (
                                                    <span
                                                        key={i}
                                                        className={`w-3.5 h-3.5 rounded-[3px] text-[8px] font-black text-white flex items-center justify-center ${
                                                            f === "W"
                                                                ? "bg-emerald-500"
                                                                : f === "D"
                                                                ? "bg-amber-400"
                                                                : "bg-red-500"
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

                {/* Squad Availability & Absences (5 cols) */}
                <div className="lg:col-span-5 bg-white rounded-2xl border border-neutral-200/80 shadow-sm p-4 flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-black text-neutral-900">
                                Squad Availability & Absences
                            </span>
                            <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                21 Available
                            </span>
                        </div>
                        <div className="text-[10px] font-semibold text-neutral-500 mb-3">
                            21 Fit • 1 Injured • 1 Suspended • 1 Unavailable
                        </div>

                        <div className="space-y-2">
                            {[
                                {
                                    name: "Kieran Byrne",
                                    pos: "CB",
                                    note: "Hamstring strain (Est. return 21 Nov)",
                                    badge: "INJURED",
                                    badgeStyle: "bg-red-50 text-red-700 border-red-200",
                                },
                                {
                                    name: "Toby Alford",
                                    pos: "CM",
                                    note: "1-Match FA Suspension (5 Yellow Cards)",
                                    badge: "SUSPENDED",
                                    badgeStyle: "bg-amber-50 text-amber-800 border-amber-200",
                                },
                                {
                                    name: "Liam O'Connor",
                                    pos: "RB",
                                    note: "Away with work this weekend",
                                    badge: "AWAY",
                                    badgeStyle: "bg-neutral-100 text-neutral-700 border-neutral-200",
                                },
                            ].map((item) => (
                                <div
                                    key={item.name}
                                    className="flex items-center justify-between p-2 rounded-xl bg-neutral-50 border border-neutral-200/70"
                                >
                                    <div className="min-w-0">
                                        <div className="text-[11px] font-bold text-neutral-900 flex items-center gap-1.5">
                                            <span>{item.name}</span>
                                            <span className="text-[9px] font-black text-neutral-400">
                                                {item.pos}
                                            </span>
                                        </div>
                                        <div className="text-[10px] text-neutral-500 truncate">
                                            {item.note}
                                        </div>
                                    </div>
                                    <span
                                        className={`px-2 py-0.5 rounded text-[9px] font-black border shrink-0 ${item.badgeStyle}`}
                                    >
                                        {item.badge}
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
 * SCREEN 2: FULL-SCALE REAL MATCHDAY XI (matching src/app/matchday-xi/page.tsx)
 */
function FullMatchdayXiPreview() {
    return (
        <div className="p-4 sm:p-6 bg-[#FCFCFD] text-neutral-900 select-none">
            {/* Top Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 mb-4 border-b border-neutral-200">
                <div>
                    <div className="flex items-center gap-2">
                        <h3 className="text-lg font-black text-neutral-900">Matchday XI</h3>
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-red-50 text-red-700 border border-red-200">
                            Sat 14 Nov vs Kingswood Rovers (H)
                        </span>
                    </div>
                    <p className="text-xs text-neutral-500 mt-0.5">
                        Drag or tap players onto the pitch, assign set-piece roles, and export your team sheet graphic.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <span className="px-3 py-1.5 rounded-lg bg-white border border-neutral-200 text-neutral-700 text-xs font-bold shadow-2xs">
                        Saved Lineup ✓
                    </span>
                    <span className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-bold shadow-xs flex items-center gap-1.5">
                        <Share2 className="w-3.5 h-3.5" /> Export Pitch Graphic
                    </span>
                </div>
            </div>

            {/* 3-Column Matchday XI Interface */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                {/* Left Column: Available Squad Pool */}
                <div className="lg:col-span-3 bg-white rounded-xl border border-neutral-200 shadow-xs p-3.5">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-neutral-900 flex items-center gap-1.5">
                            <Users className="w-3.5 h-3.5 text-neutral-500" /> Available Squad
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-700">
                            21 Fit
                        </span>
                    </div>

                    <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-neutral-50 border border-neutral-200 text-neutral-400 text-[11px] mb-2">
                        <Search className="w-3 h-3" />
                        <span>Search players...</span>
                    </div>

                    <div className="flex flex-wrap gap-1 mb-2.5">
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
                        Remaining Unselected (5)
                    </div>
                    <div className="space-y-1.5">
                        {[
                            { name: "B. Holloway", pos: "GK", startedLast: false, att: "94%" },
                            { name: "C. Doyle", pos: "DEF", startedLast: true, att: "89%" },
                            { name: "M. Richards", pos: "DEF", startedLast: false, att: "83%" },
                            { name: "L. Jennings", pos: "MID", startedLast: false, att: "94%" },
                            { name: "T. Chambers", pos: "FWD", startedLast: false, att: "78%" },
                        ].map((p) => (
                            <div
                                key={p.name}
                                className="flex items-center justify-between p-2 rounded-lg border border-neutral-200/80 bg-white hover:border-neutral-300 text-xs"
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
                                            <span className="text-[8px] font-bold px-1 py-0.2 rounded bg-blue-50 text-blue-600 border border-blue-200">
                                                STARTED LAST
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <Plus className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                            </div>
                        ))}
                    </div>
                </div>

                {/* Center Column: Controls + Green Pitch */}
                <div className="lg:col-span-6 space-y-2.5">
                    <div className="bg-white p-2.5 rounded-xl border border-neutral-200 shadow-xs flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center bg-neutral-100 p-0.5 rounded-lg border border-neutral-200/60 text-[10px] font-bold">
                            <span className="px-2 py-1 rounded-md bg-white text-neutral-900 shadow-2xs">
                                1–11 Numbers
                            </span>
                            <span className="px-2 py-1 text-neutral-500">Squad Numbers</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-neutral-500">Kit:</span>
                            <span className="w-4 h-4 rounded-full bg-[#e11d48] ring-2 ring-offset-1 ring-neutral-900" />
                            <span className="w-4 h-4 rounded-full bg-[#2563eb]" />
                            <span className="w-4 h-4 rounded-full bg-[#10b981]" />
                            <span className="px-2.5 py-1 rounded-lg bg-neutral-100 border border-neutral-200 text-[11px] font-bold text-neutral-800">
                                4-3-3
                            </span>
                        </div>
                    </div>

                    <div className="h-[430px] w-full">
                        <RealisticPitchMarkings>
                            <PitchJerseyNode
                                x={50}
                                y={89}
                                number={1}
                                name="J. Mercer"
                                kitColor="#10b981"
                            />
                            <PitchJerseyNode x={16} y={71} number={3} name="A. Clarke" />
                            <PitchJerseyNode
                                x={38}
                                y={74}
                                number={5}
                                name="D. Foster"
                                isCaptain
                            />
                            <PitchJerseyNode x={62} y={74} number={6} name="R. Bennett" />
                            <PitchJerseyNode x={84} y={71} number={2} name="L. Vance" />
                            <PitchJerseyNode x={50} y={54} number={4} name="T. Vance" />
                            <PitchJerseyNode x={29} y={43} number={8} name="C. Gallagher" />
                            <PitchJerseyNode x={71} y={43} number={10} name="D. Sterling" />
                            <PitchJerseyNode x={20} y={20} number={11} name="E. Brooks" />
                            <PitchJerseyNode x={50} y={15} number={9} name="M. Vance" />
                            <PitchJerseyNode x={80} y={20} number={7} name="O. Grant" />
                        </RealisticPitchMarkings>
                    </div>
                </div>

                {/* Right Column: Substitutes Bench & Synchronized Roles & Set Pieces */}
                <div className="lg:col-span-3 space-y-3">
                    <div className="bg-white rounded-xl border border-neutral-200 shadow-xs p-3.5">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-bold text-neutral-900">
                                Substitutes Bench
                            </span>
                            <span className="text-[10px] font-bold text-neutral-400">5 / 5</span>
                        </div>
                        <div className="space-y-1.5">
                            {[
                                { num: 12, name: "S. Henderson", pos: "DEF" },
                                { num: 14, name: "H. Cole", pos: "MID" },
                                { num: 15, name: "N. Palmer", pos: "FWD" },
                                { num: 16, name: "K. Reid", pos: "DEF" },
                                { num: 17, name: "J. Maddox", pos: "GK" },
                            ].map((sub) => (
                                <div
                                    key={sub.num}
                                    className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-neutral-50 border border-neutral-200/80 text-[11px]"
                                >
                                    <div className="flex items-center gap-2">
                                        <span className="w-5 h-5 rounded bg-neutral-900 text-white font-black text-[10px] flex items-center justify-center">
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

                    <div className="bg-white rounded-xl border border-neutral-200 shadow-xs p-3.5">
                        <div className="text-xs font-bold text-neutral-900 mb-2">
                            Roles & Set Pieces
                        </div>
                        <div className="space-y-2 text-[11px]">
                            {[
                                { role: "Captain (C)", player: "5. D. Foster" },
                                { role: "Vice Captain", player: "8. C. Gallagher" },
                                { role: "Penalties", player: "9. M. Vance" },
                                { role: "Direct Free Kicks", player: "10. D. Sterling" },
                                { role: "Left Corners", player: "10. D. Sterling" },
                                { role: "Right Corners", player: "7. O. Grant" },
                            ].map((r) => (
                                <div key={r.role} className="flex items-center justify-between">
                                    <span className="text-neutral-500 font-medium">{r.role}</span>
                                    <span className="font-bold text-neutral-900 bg-neutral-100 px-2 py-0.5 rounded border border-neutral-200">
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
        {
            rank: 5,
            name: "Declan Sterling",
            streak: 3,
            pos: "MID",
            attended: "15 / 18",
            late: 0,
            last5: ["✓", "×", "✓", "✓", "✓"],
            pct: 83,
        },
        {
            rank: 6,
            name: "Callum Gallagher",
            streak: 0,
            pos: "MID",
            attended: "14 / 18",
            late: 2,
            last5: ["✓", "L", "✓", "✓", "×"],
            pct: 78,
        },
    ];

    return (
        <div className="p-4 sm:p-6 space-y-4 bg-[#FCFCFD] text-neutral-900 select-none">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                    <h3 className="text-lg font-black text-neutral-900">
                        Training Schedule & Attendance
                    </h3>
                    <p className="text-xs text-neutral-500">
                        Manage weekly training sessions, coaching topics, and seasonal player commitment.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex items-center bg-neutral-200/70 p-0.5 rounded-lg text-[11px] font-bold">
                        <span className="px-2.5 py-1 text-neutral-600">Schedule</span>
                        <span className="px-2.5 py-1 rounded-md bg-white text-neutral-900 shadow-2xs">
                            Schedule + Attendance
                        </span>
                    </div>
                    <span className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-bold flex items-center gap-1">
                        <Plus className="w-3.5 h-3.5" /> Add Session
                    </span>
                </div>
            </div>

            {/* 7-Day Weekly Football Calendar Strip */}
            <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-xs p-3.5">
                <div className="flex items-center justify-between mb-2.5">
                    <span className="text-xs font-black text-neutral-900 uppercase tracking-wider">
                        Training Week • 9 Nov – 15 Nov
                    </span>
                    <span className="text-[11px] font-semibold text-neutral-400">
                        2 Sessions • 1 Matchday
                    </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-7 gap-2">
                    {trainingDays.map((d) => (
                        <div
                            key={d.day}
                            className={`rounded-xl p-2.5 border text-left transition-all ${
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
                                <div className="mt-2">
                                    <span className="inline-block px-1.5 py-0.2 rounded text-[8px] font-black uppercase bg-emerald-600 text-white">
                                        TRAINING • {d.time}
                                    </span>
                                    <div className="text-[10px] font-bold text-neutral-900 mt-1 leading-tight">
                                        {d.title}
                                    </div>
                                    <div className="text-[9px] font-semibold text-emerald-700 mt-1">
                                        {d.attending} Attending
                                    </div>
                                </div>
                            )}
                            {d.type === "match" && (
                                <div className="mt-2">
                                    <span className="inline-block px-1.5 py-0.2 rounded text-[8px] font-black uppercase bg-red-600 text-white">
                                        MATCH • {d.time}
                                    </span>
                                    <div className="text-[10px] font-black text-neutral-900 mt-1 leading-tight">
                                        {d.title}
                                    </div>
                                    <div className="text-[9px] font-semibold text-red-700 mt-1">
                                        {d.pitch}
                                    </div>
                                </div>
                            )}
                            {d.type === "rest" && (
                                <div className="mt-4 text-[10px] font-semibold text-neutral-400">
                                    No session
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Training Attendance Table Card */}
            <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-sm p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                    <div>
                        <div className="text-sm font-black text-neutral-900">
                            Training Attendance Leaderboard
                        </div>
                        <div className="text-[11px] text-neutral-500">
                            18 Sessions Recorded • 86% Squad Average Commitment
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="flex items-center gap-1">
                            {["All Positions", "GK", "DEF", "MID", "FWD"].map((p, idx) => (
                                <span
                                    key={p}
                                    className={`px-2 py-1 rounded-md text-[10px] font-bold ${
                                        idx === 0
                                            ? "bg-neutral-900 text-white"
                                            : "bg-neutral-100 text-neutral-600"
                                    }`}
                                >
                                    {p}
                                </span>
                            ))}
                        </div>
                        <span className="px-2.5 py-1 rounded-md bg-neutral-100 text-neutral-700 text-[10px] font-bold flex items-center gap-1">
                            <Share2 className="w-3 h-3" /> Share Graphic
                        </span>
                        <span className="px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold flex items-center gap-1">
                            <FileSpreadsheet className="w-3 h-3" /> Export Excel
                        </span>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-neutral-200 text-[9px] font-bold uppercase text-neutral-400">
                                <th className="py-2 px-2">Player</th>
                                <th className="py-2 px-2">Pos</th>
                                <th className="py-2 px-2 text-center">Attended</th>
                                <th className="py-2 px-2 text-center">Late</th>
                                <th className="py-2 px-2 text-center">Last 5 Sessions</th>
                                <th className="py-2 px-2 text-right">Attendance %</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-100 text-xs">
                            {attendanceRows.map((row) => (
                                <tr key={row.name} className="hover:bg-neutral-50/80">
                                    <td className="py-2.5 px-2">
                                        <div className="flex items-center gap-2">
                                            <span className="w-5 h-5 rounded-full bg-neutral-100 text-neutral-600 font-bold text-[10px] flex items-center justify-center">
                                                {row.rank}
                                            </span>
                                            <span className="font-bold text-neutral-900">
                                                {row.name}
                                            </span>
                                            {row.streak >= 4 && (
                                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-full text-[9px] font-black bg-orange-50 text-orange-700 border border-orange-200">
                                                    <Flame className="w-2.5 h-2.5 text-orange-500" />
                                                    {row.streak} Streak
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="py-2.5 px-2">
                                        <span className="px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-700 font-black text-[10px]">
                                            {row.pos}
                                        </span>
                                    </td>
                                    <td className="py-2.5 px-2 text-center font-bold text-neutral-800">
                                        {row.attended}
                                    </td>
                                    <td className="py-2.5 px-2 text-center">
                                        {row.late > 0 ? (
                                            <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold">
                                                {row.late} Late
                                            </span>
                                        ) : (
                                            <span className="text-neutral-300">-</span>
                                        )}
                                    </td>
                                    <td className="py-2.5 px-2">
                                        <div className="flex items-center justify-center gap-1">
                                            {row.last5.map((s, i) => (
                                                <span
                                                    key={i}
                                                    className={`w-5 h-5 rounded text-[10px] font-black flex items-center justify-center ${
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
                                    <td className="py-2.5 px-2 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <div className="w-20 h-2 bg-neutral-100 rounded-full overflow-hidden hidden sm:block">
                                                <div
                                                    className="h-full bg-emerald-500 rounded-full"
                                                    style={{ width: `${row.pct}%` }}
                                                />
                                            </div>
                                            <span className="font-black text-neutral-900 w-9">
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
 * SCREEN 4: FULL-SCALE REAL FIXTURES & RESULTS (matching src/app/matches/page.tsx)
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
            assists: "👟 D. Sterling (2), T. Vance",
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
        {
            date: "Sat 24 Oct",
            comp: "Premier Division",
            home: "Northbrook United",
            away: "Oakwood Albion",
            score: "2 - 2",
            outcome: "D",
            scorers: "⚽ D. Sterling (14'), R. Bennett (76')",
            assists: "👟 C. Gallagher, D. Sterling",
            motm: "⭐ MOTM: D. Sterling",
        },
        {
            date: "Sat 17 Oct",
            comp: "County Senior Cup R2",
            home: "Northbrook United",
            away: "Stanmore Athletic",
            score: "4 - 0",
            outcome: "W",
            scorers: "⚽ M. Vance (12', 44'), O. Grant (59'), N. Palmer (84')",
            assists: "👟 E. Brooks (2), L. Vance",
            motm: "⭐ MOTM: M. Vance",
        },
    ];

    return (
        <div className="p-4 sm:p-6 space-y-4 bg-[#FCFCFD] text-neutral-900 select-none">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                    <h3 className="text-lg font-black text-neutral-900">Fixtures & Results</h3>
                    <p className="text-xs text-neutral-500">
                        Manage your season schedule, log match events, and review saved lineups.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {["All Competitions", "League (14)", "Cup (3)"].map((tab, idx) => (
                        <span
                            key={tab}
                            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold ${
                                idx === 0
                                    ? "bg-neutral-900 text-white"
                                    : "bg-white border border-neutral-200 text-neutral-600"
                            }`}
                        >
                            {tab}
                        </span>
                    ))}
                    <span className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-bold flex items-center gap-1">
                        <Plus className="w-3.5 h-3.5" /> Add Fixture
                    </span>
                </div>
            </div>

            {/* Upcoming Next Fixture Highlight Banner */}
            <div className="bg-white rounded-2xl border-2 border-red-600/20 shadow-sm p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-red-600 text-white text-[10px] font-black uppercase">
                            NEXT FIXTURE • SAT 14 NOV • 14:00
                        </span>
                        <span className="text-xs font-bold text-neutral-500">
                            Premier Division • Matchweek 15
                        </span>
                    </div>
                    <div className="text-lg font-black text-neutral-900">
                        Northbrook United vs Kingswood Rovers (#2nd)
                    </div>
                    <div className="text-xs text-neutral-500 font-medium">
                        Venue: Northbrook Community Ground (Home) • Kit: Crimson / White
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        onClick={() => onNavigate("matchday-xi")}
                        className="px-3 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold cursor-pointer"
                    >
                        Open Matchday XI →
                    </button>
                    <button
                        type="button"
                        onClick={() => onNavigate("opposition")}
                        className="px-3 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold cursor-pointer"
                    >
                        Opposition Report →
                    </button>
                </div>
            </div>

            {/* Completed Results Timeline */}
            <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-sm divide-y divide-neutral-100">
                <div className="px-4 py-3 flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-wider text-neutral-500">
                        Recent Completed Matches
                    </span>
                    <span className="text-[11px] font-bold text-emerald-600">
                        42 Goals Scored • 18 Conceded
                    </span>
                </div>
                {completedMatches.map((m) => (
                    <div
                        key={m.date}
                        className="p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3 hover:bg-neutral-50/70"
                    >
                        <div className="flex items-start sm:items-center gap-3">
                            <span
                                className={`w-8 h-8 rounded-xl font-black text-xs text-white flex items-center justify-center shrink-0 ${
                                    m.outcome === "W" ? "bg-emerald-500" : "bg-amber-400"
                                }`}
                            >
                                {m.outcome}
                            </span>
                            <div>
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-xs font-black text-neutral-900">
                                        {m.home}
                                    </span>
                                    <span className="px-2 py-0.5 rounded bg-neutral-900 text-white font-black text-xs">
                                        {m.score}
                                    </span>
                                    <span className="text-xs font-black text-neutral-900">
                                        {m.away}
                                    </span>
                                    <span className="text-[10px] font-semibold text-neutral-400">
                                        • {m.date} ({m.comp})
                                    </span>
                                </div>
                                <div className="flex flex-wrap items-center gap-3 mt-1.5 text-[11px] text-neutral-600 font-medium">
                                    <span>{m.scorers}</span>
                                    <span className="text-neutral-400">|</span>
                                    <span>{m.assists}</span>
                                    <span className="px-2 py-0.2 rounded bg-amber-50 text-amber-800 border border-amber-200 font-bold text-[10px]">
                                        {m.motm}
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            <span className="px-2.5 py-1 rounded-lg bg-neutral-100 text-neutral-700 text-[10px] font-bold">
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
 * SCREEN 5: FULL-SCALE REAL RECRUITMENT & TRIALISTS (matching src/app/recruitment/page.tsx)
 */
function FullRecruitmentPreview() {
    const stages = [
        { label: "Scouted", count: 8, color: "bg-neutral-100 text-neutral-800" },
        { label: "Contacted", count: 5, color: "bg-blue-50 text-blue-700" },
        { label: "Invited to Training", count: 4, color: "bg-indigo-50 text-indigo-700" },
        { label: "On Trial", count: 3, color: "bg-amber-50 text-amber-800" },
        { label: "Signed", count: 2, color: "bg-emerald-50 text-emerald-700" },
    ];

    const targets = [
        {
            name: "Jayden Clarke",
            age: 23,
            pos: "CB / LB",
            foot: "Left",
            currentClub: "Harrow Athletic",
            stage: "On Trial",
            stageBadge: "bg-amber-50 text-amber-800 border-amber-200",
            rating: "4.5",
            notes: "Attended 2 Thursday sessions. Dominant aerially, calm left-footed distribution out from the back.",
        },
        {
            name: "Reece Campbell",
            age: 21,
            pos: "ST / RW",
            foot: "Right",
            currentClub: "Millbrook Reserves",
            stage: "Invited to Training",
            stageBadge: "bg-indigo-50 text-indigo-700 border-indigo-200",
            rating: "4.0",
            notes: "12 goals in 14 games this season. Explosive pace in behind; attending next Tuesday session.",
        },
        {
            name: "Ethan Walters",
            age: 25,
            pos: "CM / CDM",
            foot: "Right",
            currentClub: "Stanmore Athletic",
            stage: "Contacted",
            stageBadge: "bg-blue-50 text-blue-700 border-blue-200",
            rating: "4.0",
            notes: "Watched twice vs Highgate. High work-rate box-to-box #8, strong ball winner in midfield.",
        },
        {
            name: "Zac Henderson",
            age: 24,
            pos: "GK",
            foot: "Right",
            currentClub: "Signed to First Team",
            stage: "Signed",
            stageBadge: "bg-emerald-50 text-emerald-700 border-emerald-200",
            rating: "4.5",
            notes: "Completed 3-week trial. Converted to full First Team squad member with one click.",
        },
    ];

    return (
        <div className="p-4 sm:p-6 space-y-4 bg-[#FCFCFD] text-neutral-900 select-none">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                    <h3 className="text-lg font-black text-neutral-900">
                        Recruitment & Trialist Pipeline
                    </h3>
                    <p className="text-xs text-neutral-500">
                        Track opposition standouts, manage trialists in training, and convert signings to your squad.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1.5 rounded-lg bg-white border border-neutral-200 text-neutral-700 text-xs font-bold flex items-center gap-1">
                        <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" /> Export Excel
                    </span>
                    <span className="px-2.5 py-1.5 rounded-lg bg-white border border-neutral-200 text-neutral-700 text-xs font-bold flex items-center gap-1">
                        <FileText className="w-3.5 h-3.5 text-red-600" /> Export PDF
                    </span>
                    <span className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-bold flex items-center gap-1">
                        <Plus className="w-3.5 h-3.5" /> Add Scouting Target
                    </span>
                </div>
            </div>

            {/* 5 Pipeline Stage Pills */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                {stages.map((s) => (
                    <div
                        key={s.label}
                        className="bg-white rounded-xl border border-neutral-200/80 p-3 shadow-2xs flex items-center justify-between"
                    >
                        <span className="text-xs font-bold text-neutral-700">{s.label}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-black ${s.color}`}>
                            {s.count}
                        </span>
                    </div>
                ))}
            </div>

            {/* Scouting Target Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {targets.map((t) => (
                    <div
                        key={t.name}
                        className="bg-white rounded-2xl border border-neutral-200/80 shadow-xs p-4 flex flex-col justify-between"
                    >
                        <div>
                            <div className="flex items-start justify-between gap-2">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-black text-neutral-900">
                                            {t.name}
                                        </span>
                                        <span className="px-1.5 py-0.5 rounded bg-neutral-900 text-white text-[10px] font-black">
                                            {t.pos}
                                        </span>
                                        <span className="text-[11px] font-semibold text-neutral-400">
                                            Age {t.age} • {t.foot} Foot
                                        </span>
                                    </div>
                                    <div className="text-[11px] font-semibold text-neutral-500 mt-0.5">
                                        Current Club: {t.currentClub}
                                    </div>
                                </div>
                                <span
                                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border ${t.stageBadge}`}
                                >
                                    {t.stage}
                                </span>
                            </div>

                            <p className="mt-2.5 text-xs text-neutral-600 bg-neutral-50 p-2.5 rounded-xl border border-neutral-200/60 leading-relaxed">
                                “{t.notes}”
                            </p>
                        </div>

                        <div className="mt-3 pt-2.5 border-t border-neutral-100 flex items-center justify-between text-[11px]">
                            <span className="inline-flex items-center gap-1 font-bold text-amber-600">
                                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                                {t.rating} / 5.0 Scout Rating
                            </span>
                            <span className="font-bold text-neutral-700 hover:text-red-600">
                                Convert to Squad →
                            </span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

/**
 * SCREEN 6: FULL-SCALE REAL OPPOSITION REPORTS (matching src/app/opposition/page.tsx)
 */
function FullOppositionPreview() {
    return (
        <div className="p-4 sm:p-6 space-y-4 bg-[#FCFCFD] text-neutral-900 select-none">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                    <div className="flex items-center gap-2">
                        <h3 className="text-lg font-black text-neutral-900">
                            Opposition Scouting Dossier
                        </h3>
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-amber-50 text-amber-800 border border-amber-200">
                            vs Kingswood Rovers (Sat 14 Nov)
                        </span>
                    </div>
                    <p className="text-xs text-neutral-500">
                        Tactical breakdown, set-piece routines, key threats, and expected opposition starting shape.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <span className="px-3 py-1.5 rounded-lg bg-white border border-neutral-200 text-neutral-700 text-xs font-bold">
                        Preferred Shape: 4-2-3-1
                    </span>
                    <span className="px-3 py-1.5 rounded-lg bg-neutral-900 text-white text-xs font-bold flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5" /> Export PDF Dossier
                    </span>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                {/* Left 7 Cols: 4 Tactical Analysis Cards + Danger Men */}
                <div className="lg:col-span-7 space-y-3.5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="bg-white rounded-xl border border-neutral-200 p-3.5 shadow-2xs">
                            <div className="text-[10px] font-black uppercase tracking-wider text-emerald-700 mb-1">
                                1. In Possession & Build-Up
                            </div>
                            <p className="text-xs text-neutral-600 leading-relaxed">
                                Look to play early diagonals into #9 Callum Bradshaw, with #10 Luke Pennant collecting second balls in the half-spaces. Right-back overlaps aggressively on every transition.
                            </p>
                        </div>

                        <div className="bg-white rounded-xl border border-neutral-200 p-3.5 shadow-2xs">
                            <div className="text-[10px] font-black uppercase tracking-wider text-blue-700 mb-1">
                                2. Out of Possession Shape
                            </div>
                            <p className="text-xs text-neutral-600 leading-relaxed">
                                Settle into a compact 4-4-2 mid-block. They leave wide channels open behind their advancing full-backs when possession turns over quickly.
                            </p>
                        </div>

                        <div className="bg-white rounded-xl border border-neutral-200 p-3.5 shadow-2xs">
                            <div className="text-[10px] font-black uppercase tracking-wider text-amber-700 mb-1">
                                3. Set-Piece Routines
                            </div>
                            <p className="text-xs text-neutral-600 leading-relaxed">
                                Inswinging corners target #5 Mark Dawson at the near post for flick-ons. Defensively, they use zonal marking and struggle against back-post runners.
                            </p>
                        </div>

                        <div className="bg-white rounded-xl border border-neutral-200 p-3.5 shadow-2xs">
                            <div className="text-[10px] font-black uppercase tracking-wider text-red-700 mb-1">
                                4. Key Weaknesses to Exploit
                            </div>
                            <p className="text-xs text-neutral-600 leading-relaxed">
                                Left centre-back turns slowly when isolated 1v1 against pace. Press their #4 pivot early when receiving facing his own goal.
                            </p>
                        </div>
                    </div>

                    {/* Danger Men Card */}
                    <div className="bg-white rounded-xl border border-neutral-200 p-4 shadow-2xs">
                        <div className="flex items-center justify-between mb-2.5">
                            <span className="text-xs font-black text-neutral-900 flex items-center gap-1.5">
                                <Swords className="w-4 h-4 text-red-600" /> Opposition Key Threats (Danger Men)
                            </span>
                            <span className="text-[10px] font-semibold text-neutral-400">
                                One-click send to Recruitment
                            </span>
                        </div>
                        <div className="space-y-2">
                            {[
                                {
                                    num: 9,
                                    name: "Callum Bradshaw",
                                    pos: "ST",
                                    notes: "11 Goals in 14 games. Physical target man, lethal inside the 6-yard box.",
                                },
                                {
                                    num: 10,
                                    name: "Luke Pennant",
                                    pos: "CAM",
                                    notes: "8 Assists. Takes all corners and direct free kicks; left-footed playmaker.",
                                },
                            ].map((d) => (
                                <div
                                    key={d.num}
                                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-xl bg-neutral-50 border border-neutral-200/80"
                                >
                                    <div>
                                        <div className="text-xs font-black text-neutral-900 flex items-center gap-1.5">
                                            <span className="px-1.5 py-0.2 rounded bg-red-600 text-white text-[10px]">
                                                #{d.num}
                                            </span>
                                            <span>{d.name}</span>
                                            <span className="text-[10px] font-bold text-neutral-400">
                                                ({d.pos})
                                            </span>
                                        </div>
                                        <div className="text-[11px] text-neutral-600 mt-0.5">
                                            {d.notes}
                                        </div>
                                    </div>
                                    <span className="px-2.5 py-1 rounded-lg bg-white border border-neutral-200 text-[10px] font-bold text-neutral-800 shrink-0">
                                        + Send to Recruitment
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Right 5 Cols: Expected Opposition Pitch Shape */}
                <div className="lg:col-span-5 bg-white rounded-xl border border-neutral-200 p-3.5 shadow-2xs">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-neutral-900">
                            Expected Opposition XI (4-2-3-1)
                        </span>
                        <span className="text-[10px] font-bold text-red-600">
                            ★ Key Threats Marked
                        </span>
                    </div>
                    <div className="h-[340px] w-full">
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

export default function LandingPage() {
    const [activeTab, setActiveTab] = useState<ShowcaseTabId>("dashboard");
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

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
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-neutral-800 to-neutral-950 p-1.5 border border-white/10 shadow-lg flex items-center justify-center">
                            <img
                                src="/logo.png"
                                alt="ClubFlow Logo"
                                className="w-full h-full object-contain"
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
                            <span>Built for Grassroots & Semi-Pro Football Clubs</span>
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

                        {/* Primary & Secondary CTAs */}
                        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3.5">
                            <Link
                                href="/signup"
                                className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-7 py-4 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-base shadow-xl shadow-red-600/25 transition-all hover:-translate-y-0.5"
                            >
                                <span>Start Your Club</span>
                                <ArrowRight className="w-4 h-4" />
                            </Link>
                            <a
                                href="#preview"
                                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-4 rounded-xl bg-white/[0.05] hover:bg-white/[0.09] text-white font-semibold text-base border border-white/10 transition-all"
                            >
                                <Eye className="w-4 h-4 text-neutral-300" />
                                <span>See ClubFlow in Action</span>
                            </a>
                        </div>
                    </div>

                    {/* =============================================================
                        INTERACTIVE FULL-SCALE PRODUCT SHOWCASE (#preview)
                    ============================================================= */}
                    <div id="preview" className="mt-12 sm:mt-14 scroll-mt-24">
                        {/* Screen Selector Tabs */}
                        <div className="flex flex-col items-center">
                            <div className="text-[11px] font-bold uppercase tracking-widest text-neutral-400 mb-3">
                                Click any module below — or use the sidebar inside the app — to explore the real interface
                            </div>
                            <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 p-1.5 rounded-2xl bg-[#0d1322] border border-white/10 shadow-xl">
                                {SHOWCASE_TABS.map((tab) => {
                                    const isSelected = tab.id === activeTab;
                                    return (
                                        <button
                                            key={tab.id}
                                            type="button"
                                            onClick={() => setActiveTab(tab.id)}
                                            className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                                                isSelected
                                                    ? "bg-red-600 text-white shadow-md shadow-red-600/30"
                                                    : "text-neutral-400 hover:text-white hover:bg-white/5"
                                            }`}
                                        >
                                            <span className="hidden sm:inline">{tab.label}</span>
                                            <span className="sm:hidden">{tab.shortLabel}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Active Screen Context Banner */}
                        <div className="mt-5 mb-4 flex flex-col md:flex-row md:items-center justify-between gap-2 px-2">
                            <div className="flex items-center gap-2.5">
                                <span className="px-2.5 py-1 rounded-md bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold">
                                    {currentShowcase.badge}
                                </span>
                                <h2 className="text-sm sm:text-base font-bold text-white">
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
                                <div className="px-4 py-1 rounded-md bg-[#1f1f1f] border border-neutral-700/70 text-[11px] font-mono text-neutral-300 flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                    <span>{currentShowcase.url}</span>
                                </div>
                                <div className="hidden sm:flex items-center gap-2 text-[11px] font-semibold text-neutral-400">
                                    <span>Live Interactive Preview</span>
                                </div>
                            </div>

                            {/* Real Application Shell: Dark #171717 Left Sidebar + Light #FCFCFD Main Canvas */}
                            <div className="flex min-h-[620px] bg-[#FCFCFD]">
                                <RealAppSidebar
                                    activeNav={activeTab}
                                    onSelectTab={(tab) => setActiveTab(tab)}
                                />

                                <div className="flex-1 min-w-0 overflow-x-hidden">
                                    {activeTab === "dashboard" && (
                                        <FullDashboardPreview onNavigate={setActiveTab} />
                                    )}
                                    {activeTab === "matchday-xi" && <FullMatchdayXiPreview />}
                                    {activeTab === "training" && <FullTrainingPreview />}
                                    {activeTab === "fixtures" && (
                                        <FullFixturesPreview onNavigate={setActiveTab} />
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
                                Run your club with clarity from Monday night to Saturday kick-off.
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
                                    <span>Matchday XI • Opposition Dossiers</span>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setActiveTab("matchday-xi");
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
                                    <span>Training Attendance • Season Stats</span>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setActiveTab("training");
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
                                        Manage your recruitment pipeline, trialists, league table form guide, match subs, and club fines in one clean workspace that works on both laptop and phone.
                                    </p>
                                </div>
                                <div className="mt-6 pt-4 border-t border-white/[0.06] flex items-center justify-between text-xs font-bold text-neutral-300">
                                    <span>Dashboard • Recruitment • Subs</span>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setActiveTab("recruitment");
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
                                                Matchday XI
                                            </span>
                                        </div>
                                    </div>

                                    {/* Last Match Recap Mobile Card */}
                                    <div className="bg-white rounded-xl p-3 border border-neutral-200 shadow-2xs">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-[9px] font-black uppercase text-neutral-400">
                                                Last Result
                                            </span>
                                            <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-emerald-500 text-white">
                                                WIN 3 - 1
                                            </span>
                                        </div>
                                        <div className="text-xs font-bold text-neutral-900">
                                            Northbrook 3 – 1 Millbrook Town
                                        </div>
                                        <div className="text-[10px] text-neutral-500 mt-1">
                                            ⚽ M. Vance (2), C. Gallagher • ⭐ MOTM: M. Vance
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

                        {/* PHONE 2: Mobile Matchday XI */}
                        <div className="w-full max-w-[330px] rounded-[36px] p-3 bg-[#161922] border-2 border-white/15 shadow-2xl">
                            <div className="rounded-[26px] overflow-hidden bg-[#FCFCFD] text-neutral-900 border border-neutral-200">
                                <div className="h-12 bg-[#171717] text-white px-3.5 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Shirt className="w-4 h-4 text-red-500" />
                                        <span className="font-bold text-xs">Matchday XI</span>
                                    </div>
                                    <span className="px-2 py-0.5 rounded bg-red-600 text-[10px] font-bold">
                                        4-3-3
                                    </span>
                                </div>

                                <div className="p-3 space-y-2.5">
                                    <div className="h-[270px] w-full">
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
                                                name="L. Vance"
                                                compact
                                            />
                                            <PitchJerseyNode
                                                x={50}
                                                y={53}
                                                number={4}
                                                name="T. Vance"
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
                                            Subs: 12 S. Henderson, 14 H. Cole, 15 N. Palmer, 16 K. Reid
                                        </div>
                                        <div className="flex items-center justify-between pt-1 border-t border-neutral-100 text-neutral-800 font-bold">
                                            <span>Capt: D. Foster</span>
                                            <span>Pens: M. Vance</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="mt-3 text-center">
                                <div className="text-xs font-bold text-white">Mobile Matchday XI</div>
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
                                            {
                                                name: "Marcus Vance",
                                                pos: "FWD",
                                                streak: "🔥 4",
                                                last5: ["×", "✓", "✓", "L", "✓"],
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

                    {/* Additional Capabilities Grid */}
                    <div className="mt-20">
                        <div className="text-center max-w-2xl mx-auto mb-10">
                            <h3 className="text-2xl sm:text-3xl font-black text-white">
                                Every module your club needs included as standard
                            </h3>
                            <p className="mt-2 text-sm text-neutral-400">
                                No bloated add-ons — just the practical tools football managers use every week.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {[
                                {
                                    icon: Users,
                                    title: "Squad & Appearances",
                                    desc: "Track starts, sub appearances, goals, assists, yellow/red cards, medical statuses, and loan or dual-registration players.",
                                },
                                {
                                    icon: ClipboardCheck,
                                    title: "Training & Attendance",
                                    desc: "Plan sessions on a 7-day football calendar, monitor active streaks, log late arrivals, and share attendance graphics.",
                                },
                                {
                                    icon: Trophy,
                                    title: "League Table & Form Guide",
                                    desc: "View division standings alongside Points Per Game (PPG), home and away splits, and recent 5-match form guides.",
                                },
                                {
                                    icon: Shield,
                                    title: "Opposition Scouting Reports",
                                    desc: "Record tactical notes in and out of possession, set-piece routines, expected lineups, and key opposition threats.",
                                },
                                {
                                    icon: Target,
                                    title: "Recruitment & Trialist Pipeline",
                                    desc: "Manage scouting targets across 5 pipeline stages, rate trialists in training, and export your shortlist to Excel or PDF.",
                                },
                                {
                                    icon: Coins,
                                    title: "Match Subs, Payments & Fines",
                                    desc: "Keep a clear ledger of weekly match subs, annual membership fees, club expenses, and dressing-room fines.",
                                },
                            ].map((item) => {
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
                            Set up your club workspace in minutes and bring your squad, training attendance, Matchday XI, and opposition prep into one place.
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
                    <div className="flex items-center gap-2.5">
                        <img src="/logo.png" alt="ClubFlow" className="w-5 h-5 object-contain" />
                        <span className="font-bold text-neutral-300">ClubFlow</span>
                        <span>• Grassroots & Semi-Pro Football Operations Platform</span>
                    </div>
                    <div className="flex items-center gap-6">
                        <a href="#preview" className="hover:text-neutral-300">
                            Inside the App
                        </a>
                        <a href="#features" className="hover:text-neutral-300">
                            Features
                        </a>
                        <a href="#faq" className="hover:text-neutral-300">
                            FAQ
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