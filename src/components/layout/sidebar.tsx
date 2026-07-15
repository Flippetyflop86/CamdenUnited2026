"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getSubscription } from "@/lib/subscription-utils";
import {
    Copy,
    Check,
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
    CreditCard,
    Search,
    Mail,
    History
} from "lucide-react";

import { useClub } from "@/context/club-context";
import { useAuth } from "@/context/auth-context";
import { canAccess } from "@/lib/permissions";
import { Button } from "@/components/ui/button";

const navSections = [
    {
        title: "On the Pitch",
        items: [
            { href: "/squad",       label: "Squad",      icon: Users },
            { href: "/training",    label: "Training",   icon: CalendarDays },
            { href: "/matches",     label: "Fixtures",   icon: Activity },
            { href: "/matchday-xi", label: "Matchday XI", icon: Shield },
            { href: "/squad-depth", label: "Squad Depth", icon: Shield },
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
            { href: "/player-payments", label: "Player Payments", icon: Wallet },
            { href: "/budgets",       label: "Player Budgets", icon: Wallet },
            { href: "/inventory",     label: "Inventory",      icon: Clipboard },
            { href: "/staff",         label: "Staff",          icon: Users },
            { href: "/documents",     label: "Documents",      icon: FileText },
        ]
    },
    {
        title: "App",
        items: [
            { href: "/dashboard/billing", label: "Billing & Subs", icon: CreditCard, isComingSoon: true },
            { href: "/admin",         label: "Admin",          icon: Settings },
        ]
    }
];

export function Sidebar({ onClose }: { onClose?: () => void }) {
    const pathname = usePathname();
    const router = useRouter();
    const { settings } = useClub();
    const { user, role, pagePermissions, displayName, signOut, isManager } = useAuth();
    const [copiedEmail, setCopiedEmail] = useState(false);

    // Subscription & Gating State
    const [sub, setSub] = useState(() => getSubscription());
    const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
    const [comingSoonModalOpen, setComingSoonModalOpen] = useState(false);
    const [requiredTier, setRequiredTier] = useState<"Medium" | "High">("Medium");

    useEffect(() => {
        const handleSubChange = () => {
            setSub(getSubscription());
        };
        window.addEventListener("subscription-changed", handleSubChange);
        return () => window.removeEventListener("subscription-changed", handleSubChange);
    }, []);

    const now = new Date();
    const trialEnds = new Date(sub.trialEndsAt);
    const daysLeft = Math.max(0, Math.ceil((trialEnds.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
    const isTrialExpired = !sub.isPaymentConfigured && now > trialEnds;

    // Billing route is always dashboard billing
    const billingHref = "/dashboard/billing";

    const isRouteLocked = (href: string) => {
        return false;
    };

    const handleItemClick = (e: React.MouseEvent, href: string, isComingSoon?: boolean) => {
        if (isComingSoon) {
            e.preventDefault();
            setComingSoonModalOpen(true);
            return;
        }
        if (isRouteLocked(href)) {
            e.preventDefault();
            if (isTrialExpired) {
                router.push(billingHref);
                if (onClose) onClose();
            } else {
                if (["/opposition"].includes(href)) {
                    setRequiredTier("High");
                } else {
                    setRequiredTier("Medium");
                }
                setUpgradeModalOpen(true);
            }
        } else {
            if (onClose) onClose();
        }
    };

    // The display name shown at the bottom of the sidebar
    const shownName = displayName
        || user?.user_metadata?.full_name
        || user?.email?.split("@")[0]
        || "Club Member";

    const avatarLetter = shownName.charAt(0).toUpperCase();

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

            <nav className="flex-1 overflow-y-auto py-4 scrollbar-thin scrollbar-thumb-slate-700">
                <div className="px-3 space-y-6">
                    {/* Global Search Button */}
                    <div className="px-3">
                        <button
                            onClick={() => window.dispatchEvent(new CustomEvent("open-global-search"))}
                            className="flex w-full items-center gap-2 rounded-md bg-slate-800/60 border border-slate-700/60 px-3 py-2 text-xs text-slate-400 hover:text-white hover:bg-slate-800 hover:border-slate-600 transition-all outline-none focus-visible:ring-2 focus-visible:ring-red-500 shadow-inner group"
                            title="Search club database (Ctrl+K)"
                        >
                            <Search className="h-3.5 w-3.5 shrink-0 text-slate-500 group-hover:text-red-400 transition-colors" />
                            <span className="flex-1 text-left">Search database...</span>
                            <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded bg-slate-700 px-1.5 font-mono text-[9px] font-medium text-slate-300">
                                Ctrl+K
                            </kbd>
                        </button>
                    </div>

                    {/* Dashboard — always visible */}
                    <div>
                        <ul className="space-y-1" role="list">
                            <li>
                                <Link
                                    href="/dashboard"
                                    onClick={(e) => handleItemClick(e, "/dashboard")}
                                    aria-current={pathname === "/dashboard" ? "page" : undefined}
                                    title="Dashboard Overview"
                                    className={cn(
                                        "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-all outline-none focus-visible:ring-2 focus-visible:ring-red-500 group relative",
                                        pathname === "/dashboard"
                                            ? "bg-slate-800 text-white font-semibold border-l-2 border-red-500 rounded-l-none"
                                            : "text-slate-400 hover:bg-slate-800 hover:text-white",
                                        isRouteLocked("/dashboard") && "opacity-60"
                                    )}
                                >
                                    <LayoutDashboard className="h-4 w-4 shrink-0 transition-transform group-hover:scale-110 group-hover:translate-x-0.5" aria-hidden="true" />
                                    <span className="truncate flex-1">Dashboard</span>
                                    {isRouteLocked("/dashboard") && <Lock className="h-3.5 w-3.5 text-slate-500 shrink-0" />}
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
                                <h3 className="px-3 text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2.5 mt-2">
                                    {section.title}
                                </h3>
                                <ul className="space-y-1" role="list">
                                    {visibleItems.map((item) => {
                                        const locked = isRouteLocked(item.href);
                                        const isBillingItem = item.href === "/dashboard/billing";
                                        // The billing tab can use a specific link label depending on subscription status
                                        const labelOverride = isBillingItem ? "Billing & Subs (Coming Soon)" : item.label;
                                        const linkHref = isBillingItem ? billingHref : item.href;
                                         
                                        // We map the link to keep user active status
                                        const isActive = pathname === linkHref || pathname?.startsWith(`${linkHref}/`);
                                        return (
                                            <li key={item.label}>
                                                <Link
                                                    href={linkHref}
                                                    onClick={(e) => handleItemClick(e, linkHref, !!item.isComingSoon)}
                                                    aria-current={isActive ? "page" : undefined}
                                                    title={labelOverride}
                                                    className={cn(
                                                        "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-all outline-none focus-visible:ring-2 focus-visible:ring-red-500 group relative",
                                                        isActive
                                                            ? "bg-slate-800 text-white font-semibold border-l-2 border-red-500 rounded-l-none"
                                                            : "text-slate-400 hover:bg-slate-800 hover:text-white",
                                                        locked && "opacity-60 cursor-not-allowed"
                                                    )}
                                                >
                                                    <item.icon className="h-4 w-4 shrink-0 transition-transform group-hover:scale-110 group-hover:translate-x-0.5" aria-hidden="true" />
                                                    <span className="truncate flex-1">{labelOverride}</span>
                                                    {locked && <Lock className="h-3.5 w-3.5 text-slate-500 shrink-0" />}
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

                <div className="mb-4 p-3 bg-slate-800/40 rounded-lg border border-slate-800/60 text-xs text-slate-400 space-y-1">
                    <p className="font-bold text-slate-300">Need Support?</p>
                    <div className="flex items-center justify-between gap-1 mt-0.5">
                        <span className="text-[11px] truncate">
                            Email: <a href="mailto:info@clubflow.org.uk" className="text-red-400 hover:text-red-300 hover:underline font-bold">info@clubflow.org.uk</a>
                        </span>
                        <button 
                            onClick={() => {
                                navigator.clipboard.writeText("info@clubflow.org.uk");
                                setCopiedEmail(true);
                                setTimeout(() => setCopiedEmail(false), 2000);
                            }}
                            className="p-1 hover:bg-slate-800 rounded transition-colors text-slate-400 hover:text-white shrink-0"
                            title={copiedEmail ? "Copied to clipboard!" : "Copy email address"}
                        >
                            {copiedEmail ? (
                                <Check className="h-3 w-3 text-emerald-400" />
                            ) : (
                                <Copy className="h-3 w-3" />
                            )}
                        </button>
                    </div>
                </div>

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

            {/* Paywall Upgrade Dialog */}
            <Dialog open={upgradeModalOpen} onOpenChange={setUpgradeModalOpen}>
                <DialogContent className="max-w-md bg-white rounded-2xl p-6 text-slate-900">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold flex items-center gap-2 text-indigo-900">
                            <Lock className="h-5 w-5 text-indigo-600 animate-bounce" />
                            Feature Locked During Trial
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 mt-2">
                        <p className="text-sm text-slate-600 leading-relaxed">
                            To unlock advanced modules like **Opposition Scouting Reports**, **Sponsorships**, or **Recruitment** during your 7-day trial, you need to configure your Stripe auto-billing credentials.
                        </p>
                        <div className="bg-indigo-50 border border-indigo-100 p-3.5 rounded-xl text-xs text-indigo-950 space-y-1.5">
                            <p className="font-bold flex items-center gap-1">Default Subscription Plan:</p>
                            <ul className="list-disc list-inside space-y-1 text-slate-700">
                                <li><strong>Medium Tier</strong> Plan selected</li>
                                <li>£9.99 / month starting after your 7-day trial</li>
                                <li>No charge will be made before trial finishes</li>
                                <li>Cancel anytime inside the billing portal</li>
                            </ul>
                        </div>
                        <div className="flex gap-3 pt-2">
                            <Button 
                                onClick={() => {
                                    setUpgradeModalOpen(false);
                                    router.push(billingHref);
                                }}
                                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
                            >
                                Configure Stripe Auto-Billing
                            </Button>
                            <Button 
                                variant="outline" 
                                onClick={() => setUpgradeModalOpen(false)}
                                className="flex-1 border-slate-200"
                            >
                                Continue Trial
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Coming Soon Dialog */}
            <Dialog open={comingSoonModalOpen} onOpenChange={setComingSoonModalOpen}>
                <DialogContent className="max-w-md bg-white rounded-2xl p-6 text-slate-900">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold flex items-center gap-2 text-indigo-900">
                            <CreditCard className="h-5 w-5 text-indigo-600" />
                            Billing & Subscription
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 mt-2">
                        <p className="text-sm text-slate-600 leading-relaxed">
                            Subscription billing and membership tiers are currently under development and will be launching soon.
                        </p>
                        <div className="bg-slate-50 border border-slate-100 p-3.5 rounded-xl text-xs text-slate-500 text-center font-medium">
                            Thank you for testing the ClubFlow preview!
                        </div>
                        <div className="flex justify-end pt-2">
                            <Button 
                                onClick={() => setComingSoonModalOpen(false)}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-6"
                            >
                                Close
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
