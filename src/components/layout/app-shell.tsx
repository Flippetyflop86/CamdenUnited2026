"use client";

import { useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Menu } from "lucide-react";
import { useClub } from "@/context/club-context";
import { cn } from "@/lib/utils";

export default function AppShell({ children }: { children: React.ReactNode }) {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const { settings } = useClub();

    return (
        <div className="flex h-screen w-full bg-slate-50 overflow-hidden">
            {/* Mobile Header */}
            <header className="fixed top-0 left-0 right-0 h-16 bg-slate-900 flex items-center px-4 justify-between z-40 md:hidden">
                <div className="flex items-center gap-3 overflow-hidden">
                    {settings.logo ? (
                        <img src={settings.logo} alt={settings.name} className="h-8 w-8 object-contain" />
                    ) : (
                        <img src="/logo-2.jpeg" alt={settings.name} className="h-8 w-8 object-contain" />
                    )}
                    <span className="font-bold text-white truncate">{settings.name}</span>
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

            <main className="flex-1 overflow-y-auto p-4 md:p-8 mt-16 md:mt-0">
                {children}
            </main>
        </div>
    );
}
