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
    Shield,
    BarChart,
    Briefcase,
    X,
    Target,
    ShieldAlert,
    Twitter,
    Instagram,
    Coins,
    Wallet,
    Lock,
    CreditCard
} from "lucide-react";

import { useClub } from "@/context/club-context";
import { useAuth } from "@/context/auth-context";
import { canAccess } from "@/lib/permissions";

const navSections = [
    {
        title: "On the Pitch",
        items: [
            { href: "/squad",       label: "Squad",      icon: Users },
            { href: "/training",    label: "Training",   icon: CalendarDays },
            { href: "/matches",     label: "Fixtures",   icon: Activity },
            { href: "/matchday-xi", label: "Matchday XI", icon: Shield },
        ]
    },
    {
        title: "Analysis",
        items: [
            { href: "/analysis",   label: "Match Analysis",     icon: Target },
            { href: "/opposition", label: "Opposition Reports", icon: ShieldHalf },
            { href: "/league",     label: "League Table",        icon: Trophy },
            { href: "/stats",      label: "Stats",               icon: BarChart },
        ]
    },
    {
        title: "Off the Pitch",
        items: [
            { href: "/sponsors",      label: "Sponsorships",   icon: Briefcase },
            { href: "/recruitment",   label: "Recruitment",    icon: UserPlus },
            { href: "/finance",       label: "Finance",        icon: Coins },
            { href: "/budgets",       label: "Player Budgets", icon: Wallet },
            { href: "/inventory",     label: "Inventory",      icon: Clipboard },
            { href: "/staff",         label: "Staff",          icon: Users },
            { href: "/documents",     label: "Documents",      icon: FileText },
            { href: "/admin",         label: "Admin",          icon: Settings },
        ]
    }
];

export function Sidebar({ onClose }: { onClose?: () => void }) {
    const pathname = usePathname();
    const { settings } = useClub();
    const { user, role, pagePermissions, displayName, signOut, isManager } = useAuth();

    // The display name shown at the bottom of the sidebar
    const shownName = displayName
        || user?.user_metadata?.full_name
        || user?.email?.split("@")[0]
        || "Club Member";

    const avatarLetter = shownName.charAt(0).toUpperCase();

    return (
        <div className="flex h-full w-64 flex-col bg-slate-900 text-white">
            <div className="flex h-16 items-center px-5 border-b border-slate-800 gap-2 shrink-0">
                <div className="relative h-9 w-9 shrink-0 flex items-center justify-center">
                    {/* Brand circular arc motif wrapping the club logo/letter */}
                    <div className="absolute inset-0 rounded-full border border-dashed border-red-500/20 animate-[spin_30s_linear_infinite]" />
                    <svg className="absolute inset-[-2px] h-[40px] w-[40px]" viewBox="0 0 100 100" fill="none">
                        <path d="M 20 50 A 30 30 0 0 1 80 50" stroke="#dc2626" strokeWidth="6" strokeLinecap="round" />
                        <path d="M 20 50 A 30 30 0 0 0 50 80" stroke="#ffffff" strokeWidth="6" strokeLinecap="round" />
                        <path d="M 50 80 A 30 30 0 0 0 80 50" stroke="#dc2626" strokeWidth="6" strokeLinecap="round" />
                    </svg>
                    {settings.logo ? (
                        <img src={settings.logo} alt={settings.name} className="h-6 w-6 rounded-full object-contain relative z-10" />
                    ) : (
                        <span className="text-xs font-black text-white relative z-10">{settings.name.charAt(0).toUpperCase()}</span>
                    )}
                </div>
                <div className="flex-1 min-w-0 ml-1.5">
                    <h1 className="text-sm font-black text-white truncate leading-tight" title={settings.name}>{settings.name}</h1>
                    <span className="text-[9px] font-bold tracking-widest text-red-500 uppercase leading-none block mt-0.5">ClubFlow Space</span>
                </div>
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

            <nav className="flex-1 overflow-y-auto py-4 scrollbar-thin scrollbar-thumb-slate-700">
                <div className="px-3 space-y-6">
                    {/* Dashboard — always visible */}
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
                            <li>
                                <Link
                                    href="/dashboard/billing"
                                    onClick={onClose}
                                    aria-current={pathname === "/dashboard/billing" ? "page" : undefined}
                                    className={cn(
                                        "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-red-500",
                                        pathname === "/dashboard/billing"
                                            ? "bg-red-600 text-white"
                                            : "text-slate-400 hover:bg-slate-800 hover:text-white"
                                    )}
                                >
                                    <CreditCard className="h-4 w-4 shrink-0" aria-hidden="true" />
                                    <span className="truncate">Billing & Subs</span>
                                </Link>
                            </li>
                        </ul>
                    </div>

                    {navSections.map((section) => {
                        // Filter items the current user can access
                        const visibleItems = section.items.filter(item =>
                            canAccess(item.href, role, pagePermissions)
                        );

                        // Don't render the section header if all items are hidden
                        if (visibleItems.length === 0) return null;

                        return (
                            <div key={section.title}>
                                <h3 className="px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                                    {section.title}
                                </h3>
                                <ul className="space-y-1" role="list">
                                    {visibleItems.map((item) => {
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
                                                    <span className="truncate flex-1">{item.label}</span>
                                                    {(item as any).isLocked && <Lock className="h-3.5 w-3.5 text-slate-500 shrink-0" />}
                                                </Link>
                                            </li>
                                        );
                                    })}
                                </ul>
                            </div>
                        );
                    })}
                </div>
            </nav>

            <div className="border-t border-slate-800 p-4">
                {(settings.twitterUrl || settings.instagramUrl) && (
                    <div className="flex flex-col gap-2 mb-4">
                        {settings.instagramUrl && (
                            <a href={settings.instagramUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-3 py-2 rounded-md bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 text-white hover:opacity-90 transition-opacity font-medium text-xs w-full shadow-md border border-white/10 group">
                                <Instagram className="h-4 w-4 shrink-0 group-hover:scale-110 transition-transform" />
                                <span className="truncate">Club Instagram</span>
                            </a>
                        )}
                        {settings.twitterUrl && (
                            <a href={settings.twitterUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-3 py-2 rounded-md bg-[#1DA1F2] text-white hover:opacity-90 transition-opacity font-medium text-xs w-full shadow-md border border-white/10 group">
                                <Twitter className="h-4 w-4 shrink-0 group-hover:scale-110 transition-transform" />
                                <span className="truncate">Club Twitter (X)</span>
                            </a>
                        )}
                    </div>
                )}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 overflow-hidden">
                        <div className="h-8 w-8 rounded-full bg-slate-700 flex items-center justify-center shrink-0">
                            <span className="text-xs font-bold">{avatarLetter}</span>
                        </div>
                        <div className="text-sm overflow-hidden">
                            <p className="font-medium text-white truncate max-w-[110px]" title={shownName}>
                                {shownName}
                            </p>
                            <p className="text-xs text-slate-500 capitalize">{role || "Club Member"}</p>
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
