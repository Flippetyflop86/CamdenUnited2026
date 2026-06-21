"use client";

import { useState, useEffect } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Menu, LayoutDashboard, Users, Activity, CreditCard } from "lucide-react";
import Link from "next/link";
import { useClub } from "@/context/club-context";
import { cn } from "@/lib/utils";
import { usePathname } from "next/navigation";
import { PageGuard } from "@/components/layout/page-guard";

export default function AppShell({ children }: { children: React.ReactNode }) {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const { settings, isLoaded } = useClub();
    const pathname = usePathname();

    const isAuthPage = ["/login", "/signup", "/reset-password", "/update-password", "/join"].includes(pathname);
    const isOnboardingPage = pathname === "/onboarding";

    useEffect(() => {
        if (isLoaded && !settings.isOnboarded && !isAuthPage && !isOnboardingPage) {
            if (typeof window !== 'undefined') {
                window.location.href = '/onboarding';
            }
        }
    }, [isLoaded, settings.isOnboarded, isAuthPage, isOnboardingPage]);

    if (isAuthPage || isOnboardingPage) {
        return <main className="min-h-screen bg-slate-950">{children}</main>;
    }

    if (isLoaded && !settings.isOnboarded && !isAuthPage && !isOnboardingPage) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="relative h-12 w-12 flex items-center justify-center">
                        <svg className="animate-spin h-12 w-12" viewBox="0 0 100 100" fill="none">
                            <path d="M 15 50 A 35 35 0 0 1 85 50" stroke="#dc2626" strokeWidth="8" strokeLinecap="round" />
                            <path d="M 15 50 A 35 35 0 0 0 50 85" stroke="#ffffff" strokeWidth="8" strokeLinecap="round" />
                            <path d="M 50 85 A 35 35 0 0 0 85 50" stroke="#dc2626" strokeWidth="8" strokeLinecap="round" />
                        </svg>
                    </div>
                    <p className="text-slate-400 font-medium">Redirecting to setup...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-screen w-full bg-slate-950 overflow-hidden text-white">
            {/* Mobile Header */}
            <header className="fixed top-0 left-0 right-0 h-16 bg-slate-900 flex items-center px-4 justify-between z-40 md:hidden">
                <div className="flex items-center gap-2 overflow-hidden">
                    <div className="relative h-8 w-8 shrink-0 flex items-center justify-center">
                        <div className="absolute inset-0 rounded-full border border-dashed border-red-500/20 animate-[spin_30s_linear_infinite]" />
                        <svg className="absolute inset-[-2px] h-[36px] w-[36px]" viewBox="0 0 100 100" fill="none">
                            <path d="M 20 50 A 30 30 0 0 1 80 50" stroke="#dc2626" strokeWidth="6" strokeLinecap="round" />
                            <path d="M 20 50 A 30 30 0 0 0 50 80" stroke="#ffffff" strokeWidth="6" strokeLinecap="round" />
                            <path d="M 50 80 A 30 30 0 0 0 80 50" stroke="#dc2626" strokeWidth="6" strokeLinecap="round" />
                        </svg>
                        {settings.logo ? (
                            <img src={settings.logo} alt={settings.name} className="h-5.5 w-5.5 rounded-full object-contain relative z-10" />
                        ) : (
                            <span className="text-[10px] font-black text-white relative z-10">{settings.name.charAt(0).toUpperCase()}</span>
                        )}
                    </div>
                    <div className="ml-1 text-left">
                        <span className="font-bold text-white text-sm block leading-tight truncate max-w-[150px]">{settings.name}</span>
                        <span className="text-[8px] font-bold tracking-widest text-red-500 uppercase leading-none block">ClubFlow Space</span>
                    </div>
                </div>
                <button
                    onClick={() => setIsMobileMenuOpen(true)}
                    className="p-2 text-slate-400 hover:text-white"
                    aria-label="Open menu"
                >
                    <Menu className="h-6 w-6" />
                </button>
            </header>

            {/* Sidebar Desktop */}
            <aside className="hidden h-full w-64 flex-shrink-0 md:block">
                <Sidebar />
            </aside>

            {/* Mobile Sidebar Overlay */}
            <div
                className={cn(
                    "fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm md:hidden transition-opacity duration-300",
                    isMobileMenuOpen ? "opacity-100" : "opacity-0 pointer-events-none"
                )}
                onClick={() => setIsMobileMenuOpen(false)}
            />

            {/* Mobile Sidebar Content */}
            <aside
                className={cn(
                    "fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 transform transition-transform duration-300 ease-in-out md:hidden",
                    isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
                )}
            >
                <Sidebar onClose={() => setIsMobileMenuOpen(false)} />
            </aside>

            <main className="flex-1 overflow-y-auto p-4 md:p-8 mt-16 md:mt-0 pb-20 md:pb-8">
                <PageGuard>
                    {children}
                </PageGuard>
            </main>

            {/* Mobile Bottom Navigation Bar */}
            <nav className="fixed bottom-0 left-0 right-0 h-16 bg-slate-900 border-t border-slate-800 flex items-center justify-around z-40 md:hidden pb-safe">
                <Link
                    href="/dashboard"
                    className={cn(
                        "flex flex-col items-center justify-center gap-1 text-[10px] font-medium w-16 h-full transition-colors",
                        pathname === "/dashboard" ? "text-red-500 font-semibold" : "text-slate-400 hover:text-white"
                    )}
                >
                    <LayoutDashboard className="h-5 w-5" />
                    <span>Dashboard</span>
                </Link>
                <Link
                    href="/squad"
                    className={cn(
                        "flex flex-col items-center justify-center gap-1 text-[10px] font-medium w-16 h-full transition-colors",
                        pathname === "/squad" || pathname?.startsWith("/squad/") ? "text-red-500 font-semibold" : "text-slate-400 hover:text-white"
                    )}
                >
                    <Users className="h-5 w-5" />
                    <span>Squad</span>
                </Link>
                <Link
                    href="/matches"
                    className={cn(
                        "flex flex-col items-center justify-center gap-1 text-[10px] font-medium w-16 h-full transition-colors",
                        pathname === "/matches" || pathname?.startsWith("/matches/") ? "text-red-500 font-semibold" : "text-slate-400 hover:text-white"
                    )}
                >
                    <Activity className="h-5 w-5" />
                    <span>Fixtures</span>
                </Link>
                <Link
                    href="/dashboard/billing"
                    className={cn(
                        "flex flex-col items-center justify-center gap-1 text-[10px] font-medium w-16 h-full transition-colors",
                        pathname === "/dashboard/billing" ? "text-red-500 font-semibold" : "text-slate-400 hover:text-white"
                    )}
                >
                    <CreditCard className="h-5 w-5" />
                    <span>Billing</span>
                </Link>
            </nav>
        </div>
    );
}
