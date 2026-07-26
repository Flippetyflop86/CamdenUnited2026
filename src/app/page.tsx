"use client";

import { useState } from "react";
import Link from "next/link";
import { Sparkles, ArrowRight, Shield, Activity, Users, FileText, Database, CreditCard, LayoutDashboard, Calendar, CalendarDays, CheckCircle2, DollarSign, Trophy } from "lucide-react";

export default function LandingPage() {
    const [activeTab, setActiveTab] = useState<"dashboard" | "matchday" | "squad" | "attendance">("dashboard");

    const tabs = [
        { 
            id: "dashboard", 
            label: "Dashboard Overview", 
            desc: "Your club's mission control. Real-time availability rates, dynamic priorities, and league standings consolidated into one clean dashboard.",
            img: "/dashboard-screenshot-cropped.png"
        },
        { 
            id: "matchday", 
            label: "Matchday XI & Tactics", 
            desc: "Drag, drop, and define. Lock in formations, manage the substitutes bench, and generate automated matchday squad notifications.",
            img: "/matchday-xi-screenshot.png"
        },
        { 
            id: "squad", 
            label: "Squad Depth & Registry", 
            desc: "Long-term roster planning. Map primary and secondary roles, side-specific defensive positions, and track medical status updates.",
            img: "/squad-management-screenshot.png"
        },
        { 
            id: "attendance", 
            label: "Training Attendance", 
            desc: "Track attendance rates across matches and sessions to get data-backed insights on player dedication.",
            img: "/training-tracking-screenshot.png"
        },
    ] as const;

    return (
        <div className="bg-[#030712] text-slate-100 min-h-screen font-sans selection:bg-red-500/30 selection:text-red-400 overflow-x-hidden antialiased">
            {/* Global navigation */}
            <nav className="fixed top-0 left-0 right-0 z-50 bg-[#030712]/80 backdrop-blur-md border-b border-slate-900/40 px-8 py-5">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-12">
                        <Link href="/" className="flex items-center gap-3">
                            <span className="h-7 w-7 rounded bg-red-600 flex items-center justify-center font-black text-white text-sm">CF</span>
                            <span className="font-black text-xl tracking-tight text-white">ClubFlow</span>
                        </Link>
                        
                        <div className="hidden md:flex items-center gap-8 text-sm font-semibold text-slate-400">
                            <a href="#tour" className="hover:text-white transition-colors">Product Tour</a>
                            <a href="#features" className="hover:text-white transition-colors">Workspaces</a>
                        </div>
                    </div>

                    <div className="flex items-center gap-6 text-sm font-semibold">
                        <Link href="/login" className="text-slate-400 hover:text-white transition-colors">Sign In</Link>
                        <a href="mailto:demo@clubflow.com" className="bg-red-600 hover:bg-red-500 text-white px-4.5 py-2 rounded-lg transition-colors font-bold shadow-md shadow-red-650/10">
                            Request Demo
                        </a>
                    </div>
                </div>
            </nav>

            {/* Hero Section */}
            <header className="relative pt-40 pb-32 md:pt-48 md:pb-44 flex flex-col items-center text-center px-6 overflow-hidden">
                {/* Stadium background with premium dark overlay */}
                <div 
                    className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat opacity-65 scale-105"
                    style={{ backgroundImage: "url('/stadium_hero_bg.png')" }}
                />
                <div className="absolute inset-0 bg-gradient-to-b from-[#030712]/10 via-[#030712]/75 to-[#030712] z-0" />

                <div className="relative z-10 max-w-5xl mx-auto space-y-8 flex flex-col items-center">
                    <span className="inline-flex items-center gap-2 bg-red-500/10 border border-red-500/20 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest text-red-400">
                        <Sparkles className="h-3.5 w-3.5" /> Football Operations Platform
                    </span>
                    
                    <h1 className="text-5xl md:text-7.5xl font-black tracking-tight text-white max-w-4xl leading-[1.05]">
                        The operating system for ambitious football clubs.
                    </h1>

                    <p className="text-lg md:text-xl text-slate-400 max-w-3xl leading-relaxed">
                        ClubFlow brings your squad, matchday operations, recruitment, player development and football administration into one connected workspace. Built for elite academies and semi-professional clubs.
                    </p>

                    <div className="flex items-center gap-4 pt-6">
                        <a href="mailto:demo@clubflow.com" className="bg-red-600 hover:bg-red-500 text-white px-7 py-3.5 rounded-lg font-bold text-sm transition-all shadow-xl shadow-red-650/10">
                            Request Demo
                        </a>
                        <a href="#tour" className="bg-slate-900/80 hover:bg-slate-800 text-slate-200 px-7 py-3.5 rounded-lg font-bold text-sm transition-all border border-slate-800">
                            Take Product Tour
                        </a>
                    </div>
                </div>

                {/* Main Product Screenshot (Lengthy original Dashboard view) */}
                <div className="relative z-10 w-full max-w-5xl mt-24 px-4 md:px-0">
                    <div className="rounded-2xl overflow-hidden border border-slate-800 shadow-[0_0_80px_-10px_rgba(239,68,68,0.1)] bg-[#0c101b] p-1">
                        {/* Minimalist Browser Header Bar */}
                        <div className="h-7 bg-[#0c101b] px-4 flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                                <span className="h-2 w-2 rounded-full bg-[#ff5f56] inline-block" />
                                <span className="h-2 w-2 rounded-full bg-[#ffbd2e] inline-block" />
                                <span className="h-2 w-2 rounded-full bg-[#27c93f] inline-block" />
                            </div>
                            <div className="text-[9px] text-slate-500 font-mono tracking-wider uppercase font-bold select-none">
                                app.clubflow.org.uk/dashboard
                            </div>
                            <div className="w-8" />
                        </div>

                        {/* Lengthy full site view */}
                        <div className="bg-[#030712] overflow-hidden rounded-xl">
                            <img 
                                src="/dashboard-screenshot.png" 
                                alt="ClubFlow Dashboard Overview" 
                                className="w-full h-auto object-cover select-none"
                            />
                        </div>
                    </div>
                </div>
            </header>

            {/* Interactive Product Tour Section */}
            <section id="tour" className="py-32 max-w-5xl mx-auto px-6 space-y-16">
                <div className="text-center space-y-4 max-w-2xl mx-auto">
                    <span className="text-xs font-black uppercase text-red-500 tracking-wider">Product Tour</span>
                    <h2 className="text-3xl md:text-5xl font-black text-white leading-tight">Explore the platform.</h2>
                    <p className="text-lg text-slate-400 leading-relaxed">
                        View high-fidelity screenshots of the actual workspaces and tactical setups.
                    </p>
                </div>

                {/* Tour Tabs & Active Description */}
                <div className="space-y-8">
                    <div className="flex flex-wrap justify-center gap-3 border-b border-slate-900/60 pb-6">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`px-5 py-3 text-xs md:text-sm font-black transition-all rounded-lg ${
                                    activeTab === tab.id 
                                        ? "bg-red-500/10 text-red-400 border border-red-500/20" 
                                        : "text-slate-400 hover:text-white"
                                }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    <div className="max-w-3xl mx-auto text-center">
                        <p className="text-base text-slate-300 leading-relaxed">
                            {tabs.find(t => t.id === activeTab)?.desc}
                        </p>
                    </div>
                </div>

                {/* High-Fidelity App Screenshot Frame */}
                <div className="rounded-2xl overflow-hidden border border-slate-800 shadow-2xl bg-[#0c101b] p-1">
                    
                    {/* Minimalist Browser Header Bar */}
                    <div className="h-7 bg-[#0c101b] px-4 flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                            <span className="h-2 w-2 rounded-full bg-[#ff5f56] inline-block" />
                            <span className="h-2 w-2 rounded-full bg-[#ffbd2e] inline-block" />
                            <span className="h-2 w-2 rounded-full bg-[#27c93f] inline-block" />
                        </div>
                        <div className="text-[9px] text-slate-500 font-mono tracking-wider uppercase font-bold select-none">
                            app.clubflow.org.uk/{activeTab}
                        </div>
                        <div className="w-8" />
                    </div>

                    {/* Clean screenshot presentation */}
                    <div className="bg-[#030712] overflow-hidden rounded-xl">
                        <img 
                            src={tabs.find(t => t.id === activeTab)?.img} 
                            alt={`ClubFlow ${activeTab}`} 
                            className="w-full h-auto object-cover select-none animate-in fade-in duration-200"
                        />
                    </div>
                </div>
            </section>

            {/* Core Capabilities Section */}
            <section id="features" className="py-32 bg-slate-950/20 border-t border-b border-slate-900">
                <div className="max-w-7xl mx-auto px-6 space-y-24">
                    <div className="text-center space-y-4 max-w-2xl mx-auto">
                        <span className="text-xs font-black uppercase text-red-500 tracking-wider">Capabilities</span>
                        <h2 className="text-3xl md:text-5xl font-black text-white leading-tight">Everything in one workflow.</h2>
                        <p className="text-lg text-slate-400 leading-relaxed">
                            Replace fragmented messages and spreadsheets with a single connected data hub.
                        </p>
                    </div>

                    <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-4">
                        {/* Matchday */}
                        <div className="bg-[#0b0f19] p-8 rounded-2xl border border-slate-900 space-y-4 shadow-lg">
                            <Activity className="h-8 w-8 text-red-500" />
                            <h3 className="font-black text-white text-lg">Matchday Tactics</h3>
                            <p className="text-sm text-slate-400 leading-relaxed">
                                Know who is selectable. Plan formations, select the starting XI, and generate automated matchday squad notifications.
                            </p>
                        </div>

                        {/* Squad Planning */}
                        <div className="bg-[#0b0f19] p-8 rounded-2xl border border-slate-900 space-y-4 shadow-lg">
                            <Users className="h-8 w-8 text-red-500" />
                            <h3 className="font-black text-white text-lg">Squad Depth</h3>
                            <p className="text-sm text-slate-400 leading-relaxed">
                                Track availability, injuries, and contract expiries. Rank choices for every position side-by-side.
                            </p>
                        </div>

                        {/* Recruitment */}
                        <div className="bg-[#0b0f19] p-8 rounded-2xl border border-slate-900 space-y-4 shadow-lg">
                            <FileText className="h-8 w-8 text-red-500" />
                            <h3 className="font-black text-white text-lg">Scout Reports</h3>
                            <p className="text-sm text-slate-400 leading-relaxed">
                                Log trial performance, coordinate candidate pipelines, and store team gap analysis on one platform.
                            </p>
                        </div>

                        {/* Player Development */}
                        <div className="bg-[#0b0f19] p-8 rounded-2xl border border-slate-900 space-y-4 shadow-lg">
                            <Database className="h-8 w-8 text-red-500" />
                            <h3 className="font-black text-white text-lg">Performance Logs</h3>
                            <p className="text-sm text-slate-400 leading-relaxed">
                                Monitor training attendance rates, register shot locations on the pitch, and calculate match dominance metrics using our point-system calculator.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Waitlist / CTA banner */}
            <section className="py-32 bg-gradient-to-t from-slate-950 to-transparent border-t border-slate-900 text-center px-6">
                <div className="max-w-4xl mx-auto space-y-8">
                    <span className="text-xs font-black uppercase text-red-500 tracking-widest inline-block">Join ClubFlow</span>
                    <h2 className="text-4xl md:text-6xl font-black text-white tracking-tight leading-tight">
                        One platform. One workflow. <br />One source of truth.
                    </h2>
                    <p className="text-lg text-slate-400 max-w-xl mx-auto leading-relaxed">
                        Unify your football department operations, matches, training sessions, and player profiles today.
                    </p>
                    <div className="flex items-center justify-center gap-4 pt-4">
                        <a href="mailto:demo@clubflow.com" className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white px-6 py-3 rounded-lg font-bold text-sm transition-all shadow-lg shadow-red-650/10">
                            Request Demo <ArrowRight className="h-4 w-4" />
                        </a>
                        <a href="#tour" className="bg-slate-905 border border-slate-800 text-slate-300 px-6 py-3 rounded-lg font-bold text-sm transition-all hover:bg-slate-850">
                            Take Product Tour
                        </a>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="border-t border-slate-900/60 py-16 px-8 bg-[#030712] relative z-10 text-xs">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
                    <div className="flex items-center gap-3">
                        <span className="h-6 w-6 rounded bg-red-600 flex items-center justify-center font-black text-white text-xs">CF</span>
                        <span className="font-extrabold tracking-tight text-white text-base">ClubFlow</span>
                    </div>
                    <p className="text-slate-500 font-medium">
                        &copy; 2026 ClubFlow. Built for ambitious football operations.
                    </p>
                </div>
            </footer>
        </div>
    );
}