"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Shield, Activity, Users, FileText, ArrowRight, Sparkles, Database } from "lucide-react";

export default function Home() {
    const [activeTab, setActiveTab] = useState<"dashboard" | "matchday" | "squad" | "recruitment" | "development" | "attendance">("dashboard");

    const tabs = [
        { id: "dashboard", label: "Dashboard", src: "/dashboard-screenshot.png" },
        { id: "matchday", label: "Matchday", src: "/matchday-xi-screenshot.png" },
        { id: "squad", label: "Squad", src: "/squad-management-screenshot.png" },
        { id: "recruitment", label: "Recruitment", src: "/squad-management-screenshot.png" },
        { id: "development", label: "Development", src: "/training-tracking-screenshot.png" },
        { id: "attendance", label: "Attendance", src: "/training-tracking-screenshot.png" },
    ] as const;

    return (
        <div className="bg-[#030712] text-slate-100 min-h-screen font-sans selection:bg-emerald-500/30 selection:text-emerald-400 overflow-x-hidden">
            {/* Global navigation */}
            <nav className="fixed top-0 left-0 right-0 z-50 bg-[#030712]/80 backdrop-blur-md border-b border-slate-900/60 px-6 py-4">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-8">
                        <Link href="/dashboard" className="flex items-center gap-2.5">
                            <span className="h-6 w-6 rounded bg-emerald-500 flex items-center justify-center font-black text-slate-950 text-xs">CF</span>
                            <span className="font-black text-lg tracking-tight text-white">ClubFlow</span>
                        </Link>
                        
                        <div className="hidden md:flex items-center gap-6 text-xs font-semibold text-slate-400">
                            <a href="#features" className="hover:text-white transition-colors">Features</a>
                            <a href="#product" className="hover:text-white transition-colors">Product</a>
                            <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
                            <a href="#about" className="hover:text-white transition-colors">About</a>
                        </div>
                    </div>

                    <div className="flex items-center gap-4 text-xs font-semibold">
                        <Link href="/login" className="text-slate-400 hover:text-white transition-colors">Sign In</Link>
                        <a href="mailto:demo@clubflow.com" className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-3.5 py-1.5 rounded-lg transition-colors font-bold">
                            Request Demo
                        </a>
                    </div>
                </div>
            </nav>

            {/* Hero Section */}
            <header className="relative pt-32 pb-24 md:pt-40 md:pb-36 flex flex-col items-center text-center px-6 overflow-hidden">
                {/* Stadium background with premium dark overlay */}
                <div 
                    className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat opacity-25 filter grayscale"
                    style={{ backgroundImage: "url('/stadium_hero_bg.png')" }}
                />
                <div className="absolute inset-0 bg-gradient-to-b from-[#030712]/40 via-[#030712]/90 to-[#030712] z-0" />

                <div className="relative z-10 max-w-4xl mx-auto space-y-6 flex flex-col items-center">
                    <span className="inline-flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/25 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest text-emerald-400">
                        <Sparkles className="h-3 w-3" /> Football Operations Platform
                    </span>
                    
                    <h1 className="text-4xl md:text-6xl font-black tracking-tight text-white max-w-3xl leading-[1.1]">
                        The operating system for ambitious football clubs.
                    </h1>

                    <p className="text-sm md:text-base text-slate-400 max-w-2xl leading-relaxed">
                        ClubFlow brings your squad, matchday operations, recruitment, player development and football administration into one connected workspace.
                    </p>

                    <div className="flex items-center gap-3 pt-4">
                        <a href="mailto:demo@clubflow.com" className="bg-emerald-500 hover:bg-emerald-400 text-slate-955 px-5 py-2.5 rounded-lg font-bold text-xs transition-all shadow-lg shadow-emerald-500/10">
                            Request Demo
                        </a>
                        <a href="#tour" className="bg-slate-900/80 hover:bg-slate-800 text-slate-200 px-5 py-2.5 rounded-lg font-bold text-xs transition-all border border-slate-800">
                            Take Product Tour
                        </a>
                    </div>
                </div>

                {/* Main Product Screenshot Preview */}
                <div className="relative z-10 w-full max-w-5xl mt-16 px-4 md:px-0">
                    <div className="rounded-xl overflow-hidden border border-slate-900 shadow-2xl bg-slate-950/80 p-1">
                        <img 
                            src="/dashboard-screenshot.png" 
                            alt="ClubFlow Dashboard Overview" 
                            className="w-full h-auto rounded-lg object-cover"
                        />
                    </div>
                </div>
            </header>

            {/* Trusted By Placeholder */}
            <section className="py-12 border-t border-slate-900/60 bg-slate-950/20 text-center">
                <p className="text-[10px] uppercase tracking-widest font-black text-slate-500">Trusted by ambitious football clubs</p>
                <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 pt-6 opacity-30 grayscale filter text-slate-400 font-bold text-xs tracking-wider">
                    <div>CAMDEN UNITED FC</div>
                    <div>ELITE PRO ACADEMY</div>
                    <div>APEX FOOTBALL LAB</div>
                    <div>METRO ATHLETIC</div>
                </div>
            </section>

            {/* Product Tour Section */}
            <section id="tour" className="py-24 max-w-6xl mx-auto px-6 space-y-12">
                <div className="text-center space-y-2">
                    <h2 className="text-2xl font-black text-white uppercase tracking-wider">Product Tour</h2>
                    <p className="text-xs text-slate-400">Explore the workspace built for football operations</p>
                </div>

                {/* Tour Tabs */}
                <div className="flex flex-wrap justify-center gap-2 border-b border-slate-900 pb-3">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`px-4 py-2 text-xs font-bold transition-all rounded-lg ${
                                activeTab === tab.id 
                                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/25" 
                                    : "text-slate-400 hover:text-white"
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Screenshot Display */}
                <div className="rounded-xl overflow-hidden border border-slate-900/60 bg-slate-950/40 p-1">
                    <img 
                        src={tabs.find(t => t.id === activeTab)?.src || "/dashboard-screenshot.png"} 
                        alt={`${activeTab} workspace view`} 
                        className="w-full h-auto rounded-lg object-cover"
                    />
                </div>
            </section>

            {/* Core Workspaces Section */}
            <section id="features" className="py-24 bg-slate-950/20 border-t border-b border-slate-900/60">
                <div className="max-w-6xl mx-auto px-6 space-y-16">
                    <div className="text-center space-y-2">
                        <h2 className="text-2xl font-black text-white uppercase tracking-wider">Core Workspaces</h2>
                        <p className="text-xs text-slate-400">Designed outcomes for elite operations management</p>
                    </div>

                    <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
                        {/* Matchday */}
                        <div className="bg-[#0b0f19] p-6 rounded-xl border border-slate-900 space-y-3">
                            <Activity className="h-6 w-6 text-emerald-400" />
                            <h3 className="font-bold text-white text-sm">Matchday</h3>
                            <p className="text-xs text-slate-400 leading-relaxed">
                                Know who is available before every match. Plan coordinate alignments and squad lists dynamically.
                            </p>
                        </div>

                        {/* Squad Planning */}
                        <div className="bg-[#0b0f19] p-6 rounded-xl border border-slate-900 space-y-3">
                            <Users className="h-6 w-6 text-emerald-400" />
                            <h3 className="font-bold text-white text-sm">Squad Depth</h3>
                            <p className="text-xs text-slate-400 leading-relaxed">
                                Build better rosters. View depth ratios and rank options without manual configuration calculations.
                            </p>
                        </div>

                        {/* Recruitment */}
                        <div className="bg-[#0b0f19] p-6 rounded-xl border border-slate-900 space-y-3">
                            <FileText className="h-6 w-6 text-emerald-400" />
                            <h3 className="font-bold text-white text-sm">Recruitment</h3>
                            <p className="text-xs text-slate-400 leading-relaxed">
                                Streamline scout reports, assess potential candidates, and organize target queues in one workspace.
                            </p>
                        </div>

                        {/* Player Development */}
                        <div className="bg-[#0b0f19] p-6 rounded-xl border border-slate-900 space-y-3">
                            <Database className="h-6 w-6 text-emerald-400" />
                            <h3 className="font-bold text-white text-sm">Development</h3>
                            <p className="text-xs text-slate-400 leading-relaxed">
                                Manage development plans and track attendance histories to drive performance.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* One Integrated Workflow banner */}
            <section className="py-24 max-w-4xl mx-auto px-6 text-center space-y-6">
                <h2 className="text-3xl font-black text-white tracking-tight">One platform. One workflow. One source of truth.</h2>
                <p className="text-xs text-slate-400 max-w-lg mx-auto">
                    Stop fragmentation. Unify matches, schedules, attendance metrics, recruitment, and department alerts into a single system.
                </p>
                <div className="pt-4">
                    <a href="mailto:demo@clubflow.com" className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-405 text-slate-950 px-6 py-3 rounded-lg font-bold text-xs transition-all">
                        Request Demo <ArrowRight className="h-4 w-4" />
                    </a>
                </div>
            </section>

            {/* Footer */}
            <footer className="border-t border-slate-900 py-12 px-6 bg-[#030712]">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="flex items-center gap-2.5">
                        <span className="h-5 w-5 rounded bg-emerald-500 flex items-center justify-center font-black text-slate-955 text-[10px]">CF</span>
                        <span className="font-bold tracking-tight text-white text-sm">ClubFlow</span>
                    </div>
                    <p className="text-[10px] text-slate-500">
                        &copy; 2026 ClubFlow. Built for ambitious football operations.
                    </p>
                </div>
            </footer>
        </div>
    );
}