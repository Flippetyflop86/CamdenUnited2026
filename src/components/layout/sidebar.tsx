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
    Shield, // Added Shield icon import
    PoundSterling,
    BarChart,
    Search,
    Briefcase,
} from "lucide-react";


const links = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/squad", label: "Squad Management", icon: Users },
    { href: "/training", label: "Training", icon: CalendarDays },
    { href: "/matches", label: "Matches", icon: Activity },
    { href: "/matchday-xi", label: "Matchday XI", icon: Shield },
    { href: "/watcher", label: "Watcher System", icon: Eye },
    { href: "/league", label: "League Table", icon: Trophy },
    { href: "/stats", label: "Stats", icon: BarChart },
    { href: "/opposition", label: "Opposition Reports", icon: ShieldHalf },
    { href: "/recruitment", label: "Recruitment", icon: UserPlus },
    { href: "/sponsors", label: "Sponsorships", icon: Briefcase },
    { href: "/finance", label: "Finance", icon: PoundSterling },
    { href: "/documents", label: "Documents", icon: FileText },
    { href: "/inventory", label: "Inventory", icon: Clipboard },
    { href: "/admin", label: "Admin", icon: Settings },
];

import { useClub } from "@/context/club-context";


// ... (keep navigation)

export function Sidebar() {
    const pathname = usePathname();
    const { settings } = useClub();

    const openSearch = () => {

        document.dispatchEvent(new Event("open-global-search"));
    };

    return (
        <div className="flex h-full w-64 flex-col bg-slate-900 text-white">
            <div className="flex h-16 items-center px-6 border-b border-slate-800 gap-3">
                {settings.logo ? (
                    <img src={settings.logo} alt={settings.name} className="h-8 w-8 object-contain" />
                ) : (
                    <div className="h-8 w-8 rounded bg-red-600 flex items-center justify-center font-bold">
                        {settings.name.substring(0, 1)}
                    </div>
                )}
                <h1 className="text-lg font-bold text-white truncate text-ellipsis">{settings.name}</h1>
            </div>

            <div className="px-4 pt-4">
                <button
                    onClick={openSearch}
                    aria-label="Search the entire site (Press Ctrl+K)"
                    className="flex w-full items-center gap-2 rounded-md bg-slate-800 px-3 py-2 text-sm text-slate-400 hover:bg-slate-700 hover:text-white transition-colors border border-slate-700 outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                >
                    <Search className="h-4 w-4" aria-hidden="true" />
                    <span>Search...</span>
                    <kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border border-slate-600 bg-slate-900 px-1.5 font-mono text-[10px] font-medium text-slate-400 opacity-100" aria-hidden="true">
                        <span className="text-xs">⌘</span>K
                    </kbd>
                </button>
            </div>
            <nav className="flex-1 overflow-y-auto py-4">
                <ul className="space-y-1 px-2" role="list">
                    {links.map((item) => {
                        const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`);
                        return (
                            <li key={item.label}>
                                <Link
                                    href={item.href}
                                    aria-current={isActive ? "page" : undefined}
                                    className={cn(
                                        "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-red-500",
                                        isActive
                                            ? "bg-red-600 text-white"
                                            : "text-slate-400 hover:bg-slate-800 hover:text-white"
                                    )}
                                >
                                    <item.icon className="h-5 w-5" aria-hidden="true" />
                                    {item.label}
                                </Link>
                            </li>
                        );
                    })}
                </ul>
            </nav>
            <div className="border-t border-slate-800 p-4">
                <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-slate-700" />
                    <div className="text-sm">
                        <p className="font-medium text-white">Camden Admin</p>
                        <p className="text-xs text-slate-500">Admin Role</p>
                    </div>
                </div>
            </div>
            <div className="px-4 pb-4">
            </div>
        </div>
    );
}
