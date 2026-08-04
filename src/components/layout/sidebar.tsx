"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getSubscription } from "@/lib/subscription-utils";
import {
    ChevronDown,
    ChevronRight,
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
    History,
    Sun,
    Moon,
    Layers
} from "lucide-react";

import { useClub } from "@/context/club-context";
import { useAuth } from "@/context/auth-context";
import { canAccess } from "@/lib/permissions";
import { Button } from "@/components/ui/button";


type NavItem = {
    label: string;
    href?: string;
    icon?: any;
    isComingSoon?: boolean;
    subItems?: {
        label: string;
        href: string;
        isComingSoon?: boolean;
    }[];
};

const navItems: NavItem[] = [
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { label: "Calendar", href: "/calendar", icon: CalendarDays },
    {
        label: "Squad",
        icon: Users,
        href: "/squad",
        subItems: [
            { label: "Players", href: "/squad" },
            { label: "Matchday XI", href: "/matchday-xi" },
            { label: "Squad Planner", href: "/squad-planner" },
        ]
    },
    { label: "Training", href: "/training", icon: Activity },
    { label: "Fixtures", href: "/matches", icon: CalendarDays },
    { label: "League Table", href: "/league", icon: Trophy },
    {
        label: "Analysis",
        icon: Target,
        href: "/analysis",
        subItems: [
            { label: "Match Analysis", href: "/analysis" },
            { label: "Opposition Reports", href: "/opposition" },
            { label: "Statistics", href: "/stats" },
        ]
    },
    { label: "Recruitment", href: "/recruitment", icon: UserPlus },
    {
        label: "Club",
        icon: Briefcase,
        href: "/finance",
        subItems: [
            { label: "Finance", href: "/finance" },
            { label: "Player Budgets", href: "/budgets" },
            { label: "Player Payments", href: "/player-payments" },
            { label: "Sponsorships", href: "/sponsors" },
            { label: "Inventory", href: "/inventory" },
        ]
    },
    {
        label: "Administration",
        icon: Settings,
        href: "/admin",
        subItems: [
            { label: "Documents", href: "/documents" },
            { label: "Staff", href: "/staff" },
            { label: "Settings", href: "/admin" },
            { label: "Billing & Subscriptions", href: "/dashboard/billing" },
        ]
    }
];

export function Sidebar({ onClose }: { onClose?: () => void }) {
    const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

    useEffect(() => {
        try {
            const saved = localStorage.getItem("clubflow-sidebar-expanded");
            if (saved) {
                setExpandedGroups(JSON.parse(saved));
            }
        } catch (e) {}
    }, []);

    // Automatically expand parent group if a child is active, but only if not already initialized
    useEffect(() => {
        setExpandedGroups(prev => {
            const next = { ...prev };
            let changed = false;
            navItems.forEach(item => {
                if (item.subItems) {
                    const hasActiveChild = item.subItems.some(sub => typeof window !== "undefined" && window.location.pathname.startsWith(sub.href));
                    if (hasActiveChild && next[item.label] === undefined) {
                        next[item.label] = true;
                        changed = true;
                    }
                }
            });
            if (changed) {
                localStorage.setItem("clubflow-sidebar-expanded", JSON.stringify(next));
                return next;
            }
            return prev;
        });
    }, []);

    const toggleGroup = (label: string) => {
        setExpandedGroups(prev => {
            const next = { ...prev, [label]: !prev[label] };
            localStorage.setItem("clubflow-sidebar-expanded", JSON.stringify(next));
            return next;
        });
    };

    const pathname = usePathname();
    const router = useRouter();
    const { settings } = useClub();
    const { user, role, pagePermissions, displayName, signOut, isManager } = useAuth();
    const [copiedEmail, setCopiedEmail] = useState(false);
    const [theme, setTheme] = useState<"light" | "dark">("dark");

    useEffect(() => {
        const storedTheme = (localStorage.getItem("theme") as "light" | "dark") || "dark";
        setTheme(storedTheme);
    }, []);

    const toggleTheme = () => {
        const newTheme = theme === "light" ? "dark" : "light";
        setTheme(newTheme);
        localStorage.setItem("theme", newTheme);
        if (newTheme === "dark") {
            document.documentElement.classList.add("dark");
        } else {
            document.documentElement.classList.remove("dark");
        }
        window.dispatchEvent(new CustomEvent("theme-changed", { detail: newTheme }));
    };

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

    const pathname = usePathname();
    const router = useRouter();
    const { settings } = useClub();
    const { user, role, pagePermissions, displayName, signOut, isManager } = useAuth();
    const [copiedEmail, setCopiedEmail] = useState(false);
    const [theme, setTheme] = useState<"light" | "dark">("dark");

    useEffect(() => {
        const storedTheme = (localStorage.getItem("theme") as "light" | "dark") || "dark";
        setTheme(storedTheme);
    }, []);

    const toggleTheme = () => {
        const newTheme = theme === "light" ? "dark" : "light";
        setTheme(newTheme);
        localStorage.setItem("theme", newTheme);
        if (newTheme === "dark") {
            document.documentElement.classList.add("dark");
        } else {
            document.documentElement.classList.remove("dark");
        }
        window.dispatchEvent(new CustomEvent("theme-changed", { detail: newTheme }));
    };

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
        <div className="flex h-full w-64 flex-col bg-[#171717] border-r border-[#171717] text-zinc-300">
            <div className="flex h-16 items-center px-6 border-b border-white/5 gap-3 shrink-0">
                {settings.logo ? (
                    <img src={settings.logo} alt={settings.name} className="h-8 w-8 object-contain" />
                ) : (
                    <div className="h-8 w-8 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                        <span className="text-sm font-medium text-zinc-200">{settings.name.charAt(0).toUpperCase()}</span>
                    </div>
                )}
                <h1 className="flex-1 text-lg font-medium text-zinc-100 truncate text-ellipsis">{settings.name}</h1>
                {onClose && (
                    <button
                        onClick={onClose}
                        className="p-2 text-zinc-500 hover:text-zinc-300 md:hidden"
                        aria-label="Close sidebar"
                    >
                        <X className="h-6 w-6" />
                    </button>
                )}
            </div>

            <nav className="flex-1 overflow-y-auto py-6 scrollbar-thin scrollbar-thumb-white/10">
                <div className="px-4 space-y-6">
                    {/* Global Search Button */}
                    <div className="px-2">
                        <button
                            onClick={() => window.dispatchEvent(new CustomEvent("open-global-search"))}
                            className="flex w-full items-center gap-2 rounded border border-white/5 bg-white/5 px-3 py-2 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-white/10 transition-all outline-none group"
                            title="Search club database (Ctrl+K)"
                        >
                            <Search className="h-3.5 w-3.5 shrink-0 text-zinc-500 group-hover:text-brand transition-colors" />
                            <span className="flex-1 text-left">Search database...</span>
                            <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded bg-black/20 px-1.5 font-mono text-[9px] font-medium text-zinc-400">
                                Ctrl+K
                            </kbd>
                        </button>
                    </div>

                    
                    <div className="space-y-1 mt-4">
                        {navItems.map((item) => {
                            // Determine if this entire group or item should be visible based on permissions
                            const canAccessTop = item.href ? canAccess(item.href, role, pagePermissions) : false;
                            
                            let visibleSubItems: typeof item.subItems = undefined;
                            let canAccessAnyChild = false;

                            if (item.subItems) {
                                visibleSubItems = item.subItems.filter(sub => canAccess(sub.href, role, pagePermissions));
                                canAccessAnyChild = visibleSubItems.length > 0;
                            }

                            // If we can't access the top link and we can't access any children, hide it
                            if (!canAccessTop && !canAccessAnyChild) return null;

                            const isGroup = !!item.subItems;
                            const isExpanded = !!expandedGroups[item.label];
                            const isActiveTop = item.href && (pathname === item.href || pathname?.startsWith(`${item.href}/`));
                            const hasActiveChild = visibleSubItems?.some(sub => pathname === sub.href || pathname?.startsWith(`${sub.href}/`));

                            const locked = item.href ? isRouteLocked(item.href) : false;
                            
                            return (
                                <div key={item.label} className="mb-0.5">
                                    <div className="flex items-center gap-1">
                                        <Link
                                            href={item.href || "#"}
                                            onClick={(e) => {
                                                if (!item.href) {
                                                    e.preventDefault();
                                                    toggleGroup(item.label);
                                                    return;
                                                }
                                                handleItemClick(e, item.href, !!item.isComingSoon);
                                            }}
                                            aria-current={isActiveTop || hasActiveChild ? "page" : undefined}
                                            className={cn(
                                                "flex flex-1 items-center gap-3 rounded-md px-4 py-2.5 text-sm font-normal transition-all outline-none group relative",
                                                (isActiveTop || hasActiveChild) && !isGroup
                                                    ? "bg-brand/10 text-brand font-medium border-l-2 border-brand rounded-l-none"
                                                    : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200",
                                                locked && "opacity-60 cursor-not-allowed"
                                            )}
                                        >
                                            {item.icon && <item.icon className="h-4 w-4 shrink-0 transition-transform group-hover:scale-110 group-hover:translate-x-0.5" aria-hidden="true" />}
                                            <span className={cn("truncate flex-1", (isActiveTop || hasActiveChild) && isGroup && "font-medium text-brand")}>{item.label}</span>
                                            {locked && <Lock className="h-3.5 w-3.5 text-slate-500 shrink-0" />}
                                        </Link>
                                        
                                        {isGroup && (
                                            <button
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    toggleGroup(item.label);
                                                }}
                                                className="p-1.5 rounded text-zinc-500 hover:text-zinc-300 hover:bg-white/5 transition-colors shrink-0"
                                            >
                                                {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                            </button>
                                        )}
                                    </div>
                                    
                                    {isGroup && isExpanded && visibleSubItems && visibleSubItems.length > 0 && (
                                        <div className="ml-6 mt-1 space-y-0.5 border-l border-white/5 pl-2">
                                            {visibleSubItems.map(sub => {
                                                const subLocked = isRouteLocked(sub.href);
                                                const isBilling = sub.href === "/dashboard/billing";
                                                const labelOverride = isBilling ? "Billing & Subs (Soon)" : sub.label;
                                                const linkHref = isBilling ? "/dashboard/billing" : sub.href;
                                                const subActive = pathname === linkHref || pathname?.startsWith(`${linkHref}/`);
                                                
                                                return (
                                                    <Link
                                                        key={sub.label}
                                                        href={linkHref}
                                                        onClick={(e) => handleItemClick(e, linkHref, !!sub.isComingSoon)}
                                                        className={cn(
                                                            "flex items-center gap-3 rounded-md px-4 py-2 text-xs font-normal transition-all outline-none group relative",
                                                            subActive
                                                                ? "text-brand font-medium"
                                                                : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5",
                                                            subLocked && "opacity-60 cursor-not-allowed"
                                                        )}
                                                    >
                                                        <span className="truncate flex-1">{labelOverride}</span>
                                                        {subLocked && <Lock className="h-3 w-3 text-slate-500 shrink-0" />}
                                                    </Link>
                                                )
                                            })}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
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
