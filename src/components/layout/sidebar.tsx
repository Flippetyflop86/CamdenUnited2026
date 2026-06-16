"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
    LayoutDashboard,
    Users,
    CalendarDays,
    Activity,
    Trophy,
    Settings,
    ShieldHalf,
    FileText,
    UserPlus,
    Clipboard,
    Eye,
    Shield,
    PoundSterling,
    BarChart,
    Search,
    Briefcase,
    X,
    Target,
    ShieldAlert
} from "lucide-react";


const navSections = [
    {
        title: "On the Pitch",
        items: [
            { href: "/squad", label: "Squad", icon: Users },
            { href: "/training", label: "Training", icon: CalendarDays },
            { href: "/matches", label: "Fixtures", icon: Activity },
            { href: "/matchday-xi", label: "Matchday XI", icon: Shield },
            { href: "/recruitment", label: "Recruitment", icon: UserPlus },
        ]
    },
    {
        title: "Analysis",
        items: [
            { href: "/analysis", label: "Match Analysis", icon: Target },
            { href: "/opposition", label: "Opposition Reports", icon: ShieldHalf },
            { href: "/league", label: "League Table", icon: Trophy },
            { href: "/stats", label: "Stats", icon: BarChart },
        ]
    },
    {
        title: "Off the Pitch",
        items: [
            { href: "/league-setup", label: "League Setup", icon: ShieldAlert },
            { href: "/sponsors", label: "Sponsorships", icon: Briefcase },
            { href: "/finance", label: "Finance", icon: PoundSterling },
            { href: "/budgets", label: "Player Budgets", icon: PoundSterling },
            { href: "/inventory", label: "Inventory", icon: Clipboard },
            { href: "/staff", label: "Staff", icon: Users },
            { href: "/documents", label: "Documents", icon: FileText },
            { href: "/admin", label: "Admin", icon: Settings },
        ]
    }
];

import { useClub } from "@/context/club-context";


import { useAuth } from "@/context/auth-context";

export function Sidebar({ onClose }: { onClose?: () => void }) {
    const pathname = usePathname();
    const { settings } = useClub();
    const { user, role, signOut } = useAuth();

    const openSearch = () => {
        document.dispatchEvent(new Event("open-global-search"));
    };

    return (
        <div className="flex h-full w-64 flex-col bg-slate-900 text-white">
            <div className="flex h-16 items-center px-6 border-b border-slate-800 gap-3 shrink-0">
                {settings.logo ? (
                    <img src={settings.logo} alt={settings.name} className="h-8 w-8 object-contain" />
                ) : (
                    <div className="h-8 w-8 rounded-full bg-slate-700 flex items-center justify-center shrink-0">
                        <span className="text-sm font-bold text-white">{settings.name.charAt(0).toUpperCase()}</span>
                    </div>
                )}
                <h1 className="flex-1 text-lg font-bold text-white truncate text-ellipsis">{settings.name}</h1>
                {onClose && (
                    <button
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-white md:hidden"
                        aria-label="Close sidebar"
                    >
                        <X className="h-6 w-6" />
                    </button>
                )}
            </div>

            <div className="px-4 pt-4 shrink-0">
                <button
                    onClick={openSearch}
                    aria-label="Search the entire site (Press Ctrl+K)"
                    className="flex w-full items-center gap-2 rounded-md bg-slate-800 px-3 py-2 text-sm text-slate-400 hover:bg-slate-700 hover:text-white transition-colors border border-slate-700 outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                >
                    <Search className="h-4 w-4" aria-hidden="true" />
                    <span>Search...</span>
                    <kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border border-slate-600 bg-slate-900 px-1.5 font-mono text-[10px] font-medium text-slate-400 opacity-100" aria-hidden="true">
                        <span className="text-xs">Ctrl</span> K
                    </kbd>
                </button>
            </div>
            <nav className="flex-1 overflow-y-auto py-4 scrollbar-thin scrollbar-thumb-slate-700">
                <div className="px-3 space-y-6">
                    <div>
                        <ul className="space-y-1" role="list">
                            <li>
                                <Link
                                    href="/dashboard"
                                    onClick={onClose}
                                    aria-current={pathname === "/dashboard" ? "page" : undefined}
                                    className={cn(
                                        "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-red-500",
                                        pathname === "/dashboard"
                                            ? "bg-red-600 text-white"
                                            : "text-slate-400 hover:bg-slate-800 hover:text-white"
                                    )}
                                >
                                    <LayoutDashboard className="h-4 w-4 shrink-0" aria-hidden="true" />
                                    <span className="truncate">Dashboard</span>
                                </Link>
                            </li>
                        </ul>
                    </div>
                    {navSections.map((section) => (
                        <div key={section.title}>
                            <h3 className="px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                                {section.title}
                            </h3>
                            <ul className="space-y-1" role="list">
                                {section.items.map((item) => {
                                    const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`);
                                    return (
                                        <li key={item.label}>
                                            <Link
                                                href={item.href}
                                                onClick={onClose}
                                                aria-current={isActive ? "page" : undefined}
                                                className={cn(
                                                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-red-500",
                                                    isActive
                                                        ? "bg-red-600 text-white"
                                                        : "text-slate-400 hover:bg-slate-800 hover:text-white"
                                                )}
                                            >
                                                <item.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                                                <span className="truncate">{item.label}</span>
                                            </Link>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    ))}
                </div>
            </nav>
            <div className="border-t border-slate-800 p-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 overflow-hidden">
                        <div className="h-8 w-8 rounded-full bg-slate-700 flex items-center justify-center shrink-0">
                            <span className="text-xs font-bold">{user?.email?.charAt(0).toUpperCase() || "A"}</span>
                        </div>
                        <div className="text-sm overflow-hidden">
                            <p className="font-medium text-white truncate max-w-[120px]" title={user?.email || "Admin"}>
                                {user?.email?.split("@")[0] || "Admin"}
                            </p>
                            <p className="text-xs text-slate-500">{role || "Club Member"}</p>
                        </div>
                    </div>
                    <button onClick={signOut} className="text-xs text-red-400 hover:text-red-300 transition-colors p-1" title="Sign out">
                        Logout
                    </button>
                </div>
            </div>
        </div>
    );
}
