"use client";

import { useState } from "react";
import Link from "next/link";
import { Sparkles, ArrowRight, Shield, Activity, Users, FileText, Database, CreditCard, LayoutDashboard, Calendar, CalendarDays, CheckCircle2, DollarSign, Trophy } from "lucide-react";

export default function LandingPage() {
    const [activeTab, setActiveTab] = useState<"dashboard" | "matchday" | "squad" | "finances" | "attendance">("dashboard");

    const tabs = [
        { id: "dashboard", label: "Dashboard Overview", desc: "Your club's mission control. Real-time availability rates, dynamic priorities, and league standings consolidated into one clean dashboard." },
        { id: "matchday", label: "Matchday XI & Tactics", desc: "Drag, drop, and define. Lock in formations, manage the substitutes bench, and generate automated matchday squad notifications." },
        { id: "squad", label: "Squad Depth & Registry", desc: "Long-term roster planning. Map primary and secondary roles, side-specific defensive positions, and track medical status updates." },
        { id: "finances", label: "Finances & Billing", desc: "Keep your club out of the red. Track monthly subscriptions, match fees, and sponsorships. Check who has paid and send reminders." },
        { id: "attendance", label: "Training Attendance", desc: "Track attendance rates across matches and sessions to get real data on player dedication." },
    ] as const;

    return (
        <div className="bg-[#030712] text-slate-100 min-h-screen font-sans selection:bg-emerald-500/30 selection:text-emerald-400 overflow-x-hidden antialiased">
            {/* Global navigation */}
            <nav className="fixed top-0 left-0 right-0 z-50 bg-[#030712]/80 backdrop-blur-md border-b border-slate-900/40 px-8 py-5">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-12">
                        <Link href="/" className="flex items-center gap-3">
                            <span className="h-7 w-7 rounded bg-emerald-500 flex items-center justify-center font-black text-slate-955 text-sm">CF</span>
                            <span className="font-black text-xl tracking-tight text-white">ClubFlow</span>
                        </Link>
                        
                        <div className="hidden md:flex items-center gap-8 text-sm font-semibold text-slate-400">
                            <a href="#tour" className="hover:text-white transition-colors">Product Tour</a>
                            <a href="#features" className="hover:text-white transition-colors">Workspaces</a>
                            <a href="#workflow" className="hover:text-white transition-colors">Workflow</a>
                        </div>
                    </div>

                    <div className="flex items-center gap-6 text-sm font-semibold">
                        <Link href="/login" className="text-slate-400 hover:text-white transition-colors">Sign In</Link>
                        <a href="mailto:demo@clubflow.com" className="bg-emerald-500 hover:bg-emerald-400 text-slate-955 px-4.5 py-2 rounded-lg transition-colors font-bold shadow-md shadow-emerald-500/10">
                            Request Demo
                        </a>
                    </div>
                </div>
            </nav>

            {/* Hero Section */}
            <header className="relative pt-40 pb-32 md:pt-48 md:pb-44 flex flex-col items-center text-center px-6 overflow-hidden">
                {/* Stadium background with premium dark overlay */}
                <div 
                    className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat opacity-15 filter grayscale scale-105"
                    style={{ backgroundImage: "url('/stadium_hero_bg.png')" }}
                />
                <div className="absolute inset-0 bg-gradient-to-b from-[#030712]/20 via-[#030712]/90 to-[#030712] z-0" />

                <div className="relative z-10 max-w-5xl mx-auto space-y-8 flex flex-col items-center">
                    <span className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest text-emerald-400">
                        <Sparkles className="h-3.5 w-3.5" /> Football Operations Platform
                    </span>
                    
                    <h1 className="text-5xl md:text-7.5xl font-black tracking-tight text-white max-w-4xl leading-[1.05]">
                        The operating system for ambitious football clubs.
                    </h1>

                    <p className="text-lg md:text-xl text-slate-400 max-w-3xl leading-relaxed">
                        ClubFlow brings your squad, matchday operations, recruitment, player development and football administration into one connected workspace. Built for elite academies and semi-professional clubs.
                    </p>

                    <div className="flex items-center gap-4 pt-6">
                        <a href="mailto:demo@clubflow.com" className="bg-emerald-500 hover:bg-emerald-400 text-slate-955 px-7 py-3.5 rounded-lg font-bold text-sm transition-all shadow-xl shadow-emerald-500/10">
                            Request Demo
                        </a>
                        <a href="#tour" className="bg-slate-900/80 hover:bg-slate-800 text-slate-200 px-7 py-3.5 rounded-lg font-bold text-sm transition-all border border-slate-800">
                            Take Product Tour
                        </a>
                    </div>
                </div>

                {/* Main Product Interactive Vector Preview (Dashboard preview) */}
                <div className="relative z-10 w-full max-w-5xl mt-24 px-4 md:px-0">
                    <div className="rounded-2xl overflow-hidden border border-slate-900 shadow-[0_0_80px_-10px_rgba(16,185,129,0.08)] bg-[#070a13] p-1">
                        {/* Minimalist Browser Header Bar */}
                        <div className="h-7 bg-[#0c101b] border-b border-[#1f293d]/30 px-4 flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                                <span className="h-2 w-2 rounded-full bg-[#ff5f56] inline-block" />
                                <span className="h-2 w-2 rounded-full bg-[#ffbd2e] inline-block" />
                                <span className="h-2 w-2 rounded-full bg-[#27c93f] inline-block" />
                            </div>
                            <div className="text-[9px] text-slate-500 font-mono tracking-wider uppercase font-bold select-none">
                                app.clubflow.com/dashboard
                            </div>
                            <div className="w-8" />
                        </div>

                        {/* Interactive Screen Preview container */}
                        <div className="bg-[#030712] p-8 text-left space-y-6">
                            {/* Dashboard Live Component */}
                            <div className="flex justify-between items-center border-b border-slate-900 pb-4">
                                <div>
                                    <div className="flex items-center gap-2.5">
                                        <h3 className="text-xl font-black text-white">Camden United</h3>
                                        <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] uppercase tracking-wider font-black px-2.5 py-0.5 rounded">
                                            Operations Command Centre
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Operational Stats Grid */}
                            <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
                                <div className="bg-[#0b0f19] border border-slate-900 p-5 rounded-xl space-y-2">
                                    <span className="text-[10px] font-black uppercase text-slate-400 block tracking-wider">Squad Availability</span>
                                    <div className="text-xl font-black text-white">33 / 36 Available (92%)</div>
                                </div>
                                <div className="bg-[#0b0f19] border border-slate-900 p-5 rounded-xl space-y-2">
                                    <span className="text-[10px] font-black uppercase text-slate-400 block tracking-wider">Registration Alerts</span>
                                    <div className="text-xl font-black text-amber-400">2 Outstanding</div>
                                </div>
                                <div className="bg-[#0b0f19] border border-slate-900 p-5 rounded-xl space-y-2">
                                    <span className="text-[10px] font-black uppercase text-slate-400 block tracking-wider">Unpaid Invoices</span>
                                    <div className="text-xl font-black text-red-400">£450.00</div>
                                </div>
                            </div>

                            {/* Dashboard Layout Grid */}
                            <div className="grid gap-6 grid-cols-1 lg:grid-cols-5">
                                <div className="lg:col-span-3 space-y-6">
                                    <div className="bg-[#0b0f19] border border-slate-900 p-5 rounded-xl space-y-4">
                                        <span className="text-xs font-black uppercase text-white tracking-wider block">Next Fixture</span>
                                        <div className="bg-slate-950 p-4 rounded-xl border border-slate-900 flex justify-between items-center text-sm">
                                            <div>
                                                <span className="font-black text-white text-base">vs Western Athletic</span>
                                                <div className="text-xs text-slate-450 mt-1">Isthmian League • 🌱 Natural Grass</div>
                                            </div>
                                            <span className="text-white font-bold bg-slate-900 border border-slate-800 px-4 py-2 rounded-lg">16 Jul • 14:00</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="lg:col-span-2 space-y-6">
                                    <div className="bg-[#0b0f19] border border-slate-900 p-5 rounded-xl space-y-4">
                                        <span className="text-xs font-black uppercase text-white tracking-wider block">Performance Metrics</span>
                                        <div className="bg-slate-950 p-4 rounded-xl border border-slate-900 space-y-1">
                                            <span className="text-[10px] text-slate-450 block uppercase font-bold">Training Attendance</span>
                                            <div className="text-xl font-black text-white leading-none">92%</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            {/* Trusted By Roster */}
            <section className="py-16 border-t border-slate-900 bg-slate-950/10 text-center">
                <p className="text-xs uppercase tracking-widest font-black text-slate-500">Trusted by ambitious football departments</p>
                <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-12 pt-8 opacity-25 grayscale filter text-slate-400 font-extrabold text-sm tracking-wider">
                    <div>CAMDEN UNITED FC</div>
                    <div>ELITE PRO ACADEMY</div>
                    <div>APEX FOOTBALL LAB</div>
                    <div>METRO ATHLETIC</div>
                </div>
            </section>

            {/* Interactive Vector Product Tour Section */}
            <section id="tour" className="py-32 max-w-6xl mx-auto px-6 space-y-16">
                <div className="text-center space-y-4 max-w-2xl mx-auto">
                    <span className="text-xs font-black uppercase text-emerald-400 tracking-wider">Interactive Preview</span>
                    <h2 className="text-3xl md:text-5xl font-black text-white leading-tight">Explore the platform.</h2>
                    <p className="text-lg text-slate-400 leading-relaxed">
                        Click the tabs below to interact with the exact vector-sharp interfaces of our modules.
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
                                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" 
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

                {/* High-Fidelity Interactive Preview Interface */}
                <div className="rounded-2xl overflow-hidden border border-slate-900 bg-slate-950/40 shadow-2xl">
                    
                    {/* Minimalist Browser Header Bar */}
                    <div className="h-7 bg-[#0c101b] border-b border-[#1f293d]/30 px-4 flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                            <span className="h-2 w-2 rounded-full bg-[#ff5f56] inline-block" />
                            <span className="h-2 w-2 rounded-full bg-[#ffbd2e] inline-block" />
                            <span className="h-2 w-2 rounded-full bg-[#27c93f] inline-block" />
                        </div>
                        <div className="text-[9px] text-slate-500 font-mono tracking-wider uppercase font-bold select-none">
                            app.clubflow.com/{activeTab}
                        </div>
                        <div className="w-8" />
                    </div>

                    {/* Content area simulating real screen */}
                    <div className="bg-[#030712] p-8 text-left min-h-[480px]">
                        
                        {/* Tab 1: Dashboard Preview */}
                        {activeTab === "dashboard" && (
                            <div className="space-y-6 animate-in fade-in duration-200">
                                <div className="flex justify-between items-center border-b border-slate-900 pb-3">
                                    <div>
                                        <h3 className="text-lg font-black text-white">Operations Command Centre</h3>
                                        <p className="text-slate-450 text-xs mt-1">Squad Management &amp; Analytics</p>
                                    </div>
                                </div>
                                <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
                                    <div className="bg-[#0b0f19] border border-slate-900 p-5 rounded-xl space-y-1.5">
                                        <span className="text-[10px] font-black uppercase text-slate-450 block">Squad Availability</span>
                                        <div className="text-lg font-black text-white">33 / 36 (92%)</div>
                                    </div>
                                    <div className="bg-[#0b0f19] border border-slate-900 p-5 rounded-xl space-y-1.5">
                                        <span className="text-[10px] font-black uppercase text-slate-450 block">Pending Alerts</span>
                                        <div className="text-lg font-black text-amber-400">2 Actions Required</div>
                                    </div>
                                    <div className="bg-[#0b0f19] border border-slate-900 p-5 rounded-xl space-y-1.5">
                                        <span className="text-[10px] font-black uppercase text-slate-450 block">Unpaid Invoices</span>
                                        <div className="text-lg font-black text-red-400">£450.00</div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Tab 2: Matchday Preview */}
                        {activeTab === "matchday" && (
                            <div className="grid gap-6 md:grid-cols-5 animate-in fade-in duration-200">
                                <div className="md:col-span-3 bg-[#0a2315]/40 rounded-xl p-5 border border-emerald-950 relative h-[340px] flex flex-col justify-between overflow-hidden shadow-inner">
                                    <div className="absolute inset-0 pointer-events-none opacity-10">
                                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 border-2 border-white rounded-full" />
                                        <div className="absolute top-1/2 left-0 right-0 border-t-2 border-white" />
                                    </div>
                                    
                                    <div className="flex justify-around items-center z-10">
                                        <div className="flex flex-col items-center">
                                            <div className="w-8 h-8 rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center font-bold text-xs text-slate-950">9</div>
                                            <span className="text-[10px] font-black text-white bg-slate-950/80 px-2 py-0.5 rounded mt-1">Liam Johnson</span>
                                        </div>
                                    </div>

                                    <div className="flex justify-around items-center z-10">
                                        <div className="flex flex-col items-center">
                                            <div className="w-8 h-8 rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center font-bold text-xs text-slate-950">8</div>
                                            <span className="text-[10px] font-black text-white bg-slate-950/80 px-2 py-0.5 rounded mt-1">Chris</span>
                                        </div>
                                        <div className="flex flex-col items-center">
                                            <div className="w-8 h-8 rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center font-bold text-xs text-slate-950">10</div>
                                            <span className="text-[10px] font-black text-white bg-slate-950/80 px-2 py-0.5 rounded mt-1">Matheus</span>
                                        </div>
                                    </div>

                                    <div className="flex flex-col items-center z-10 pb-2">
                                        <div className="w-8 h-8 rounded-full bg-yellow-600 border-2 border-white flex items-center justify-center font-bold text-xs text-white">1</div>
                                        <span className="text-[10px] font-black text-white bg-slate-950/80 px-2 py-0.5 rounded mt-1">David</span>
                                    </div>
                                </div>

                                <div className="md:col-span-2 space-y-3">
                                    <span className="text-xs font-black uppercase text-slate-400 block tracking-wider">Substitutes Bench</span>
                                    <div className="space-y-2">
                                        {["Harry Norling (ST)", "James Cooper (CM)", "Mohamed Abdalla (CB)"].map((sub, i) => (
                                            <div key={i} className="bg-[#0b0f19] border border-slate-900 px-4 py-2.5 rounded-xl flex items-center justify-between text-xs font-bold text-slate-200">
                                                <span>{sub}</span>
                                                <span className="w-2 h-2 rounded-full bg-green-500" />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Tab 3: Squad Depth Preview */}
                        {activeTab === "squad" && (
                            <div className="space-y-4 animate-in fade-in duration-200 text-xs">
                                <div className="bg-[#0b0f19] border border-slate-900 rounded-xl overflow-hidden">
                                    <div className="bg-slate-950 px-4 py-3 font-bold text-slate-400 border-b border-slate-900 flex justify-between uppercase tracking-wider text-[10px]">
                                        <span className="w-1/3">Player Name</span>
                                        <span className="w-1/4 text-center">Primary Position</span>
                                        <span className="w-1/4 text-center">Footedness</span>
                                        <span className="w-1/4 text-right">Status</span>
                                    </div>
                                    <div className="divide-y divide-slate-900 font-bold">
                                        {[
                                            { name: "Liam Johnson", pos: "Striker (ST)", foot: "Right", status: "Available", color: "text-green-400" },
                                            { name: "Sufi Ali", pos: "Left Back (LB)", foot: "Left", status: "Injured", color: "text-red-400" },
                                            { name: "Morgan Whittick", pos: "Winger (LW)", foot: "Both", status: "On Holiday", color: "text-amber-400" },
                                        ].map((player, i) => (
                                            <div key={i} className="px-4 py-3 flex justify-between items-center text-slate-300">
                                                <span className="w-1/3 text-white">{player.name}</span>
                                                <span className="w-1/4 text-center">{player.pos}</span>
                                                <span className="w-1/4 text-center text-slate-500">{player.foot}</span>
                                                <span className={`w-1/4 text-right ${player.color}`}>{player.status}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Tab 4: Finances Preview */}
                        {activeTab === "finances" && (
                            <div className="space-y-6 animate-in fade-in duration-200">
                                <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
                                    <div className="bg-[#0b0f19] border border-slate-900 p-5 rounded-xl space-y-1">
                                        <span className="text-[10px] font-black uppercase text-slate-450 block">Monthly Subs Collected</span>
                                        <div className="text-2xl font-black text-emerald-400">£1,250.00</div>
                                    </div>
                                    <div className="bg-[#0b0f19] border border-slate-900 p-5 rounded-xl space-y-1">
                                        <span className="text-[10px] font-black uppercase text-slate-450 block">Outstanding Arrears</span>
                                        <div className="text-2xl font-black text-red-400">£320.00</div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Tab 5: Training Attendance Preview */}
                        {activeTab === "attendance" && (
                            <div className="space-y-4 animate-in fade-in duration-200 text-xs">
                                <div className="bg-[#0b0f19] border border-slate-900 rounded-xl p-5 space-y-3">
                                    <span className="text-xs font-black uppercase text-white tracking-wider block">Recent Squad Attendance</span>
                                    <div className="space-y-2">
                                        {["First Team Training - 15 Jul", "Tactical Pre-Match Setup - 12 Jul"].map((session, i) => (
                                            <div key={i} className="flex justify-between items-center bg-slate-950 p-3.5 rounded-xl border border-slate-900">
                                                <span className="font-bold text-white text-xs">{session}</span>
                                                <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1 rounded-full font-black text-[10px]">94% ATTENDANCE</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                    </div>
                </div>
            </section>

            {/* Core Workspaces Section */}
            <section id="features" className="py-32 bg-slate-950/20 border-t border-b border-slate-900">
                <div className="max-w-7xl mx-auto px-6 space-y-24">
                    <div className="text-center space-y-4 max-w-2xl mx-auto">
                        <span className="text-xs font-black uppercase text-emerald-400 tracking-wider">Modular Features</span>
                        <h2 className="text-3xl md:text-5xl font-black text-white leading-tight">Everything in one workflow.</h2>
                        <p className="text-lg text-slate-400 leading-relaxed">
                            Replace fragmented messages and spreadsheets with a single connected data hub.
                        </p>
                    </div>

                    <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-4">
                        {/* Matchday */}
                        <div className="bg-[#0b0f19] p-8 rounded-2xl border border-slate-900 space-y-4 shadow-lg">
                            <Activity className="h-8 w-8 text-emerald-400" />
                            <h3 className="font-black text-white text-lg">Matchday Tactics</h3>
                            <p className="text-sm text-slate-400 leading-relaxed">
                                Know who is selectable. Plan formations, select the starting XI, and generate instant RSVP updates for players.
                            </p>
                        </div>

                        {/* Squad Planning */}
                        <div className="bg-[#0b0f19] p-8 rounded-2xl border border-slate-900 space-y-4 shadow-lg">
                            <Users className="h-8 w-8 text-emerald-400" />
                            <h3 className="font-black text-white text-lg">Roster Depth</h3>
                            <p className="text-sm text-slate-400 leading-relaxed">
                                Track availability, injuries, and contract expiries. Rank choices for every position side-by-side.
                            </p>
                        </div>

                        {/* Recruitment */}
                        <div className="bg-[#0b0f19] p-8 rounded-2xl border border-slate-900 space-y-4 shadow-lg">
                            <FileText className="h-8 w-8 text-emerald-400" />
                            <h3 className="font-black text-white text-lg">Scout Reports</h3>
                            <p className="text-sm text-slate-400 leading-relaxed">
                                Log trial performance, coordinate candidate pipelines, and store team gap analysis on one platform.
                            </p>
                        </div>

                        {/* Player Development */}
                        <div className="bg-[#0b0f19] p-8 rounded-2xl border border-slate-900 space-y-4 shadow-lg">
                            <Database className="h-8 w-8 text-emerald-400" />
                            <h3 className="font-black text-white text-lg">Performance Logs</h3>
                            <p className="text-sm text-slate-400 leading-relaxed">
                                Monitor training attendance rates, register individual physical parameters, and review historical logs.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Deep Feature Redesign sections */}
            <section id="workflow" className="py-32 max-w-6xl mx-auto px-6 space-y-36">
                
                {/* Visual Focus: Matchday */}
                <div className="grid gap-12 lg:grid-cols-2 items-center">
                    <div className="space-y-6">
                        <span className="text-xs font-black uppercase text-emerald-400 tracking-wider">01 Matchday Operations</span>
                        <h2 className="text-3xl md:text-5.5xl font-black text-white leading-tight">Run matchdays with absolute confidence.</h2>
                        <p className="text-lg text-slate-400 leading-relaxed">
                            Organize your lineup with an interactive visual pitch selector, synchronize bench options, and export professional PDF team sheets directly for league match officials.
                        </p>
                    </div>
                    {/* Live vector Matchday board inside marketing grid */}
                    <div className="rounded-xl overflow-hidden border border-slate-900 shadow-2xl p-6 bg-[#030712] space-y-4">
                        <span className="text-xs font-black uppercase text-slate-400 block tracking-wider">Visual Team Sheet</span>
                        <div className="bg-slate-950 p-4 rounded-xl border border-slate-900 space-y-3">
                            <div className="flex justify-between items-center text-xs font-bold text-slate-400">
                                <span>vs London Albion</span>
                                <span className="text-emerald-400 font-extrabold uppercase">Formation: 4-3-3</span>
                            </div>
                            <div className="h-0.5 bg-slate-900" />
                            <div className="space-y-2">
                                <div className="flex justify-between text-xs font-bold">
                                    <span className="text-white">Liam Johnson</span>
                                    <span className="text-slate-500">Striker (ST)</span>
                                </div>
                                <div className="flex justify-between text-xs font-bold">
                                    <span className="text-white">Matheus Santana</span>
                                    <span className="text-slate-500">Midfielder (AM)</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Visual Focus: Squad Planning */}
                <div className="grid gap-12 lg:grid-cols-2 items-center">
                    <div className="rounded-xl overflow-hidden border border-slate-900 shadow-2xl lg:order-first order-last p-6 bg-[#030712] space-y-4">
                        <span className="text-xs font-black uppercase text-slate-400 block tracking-wider">Positional Coverage</span>
                        <div className="bg-slate-950 p-4 rounded-xl border border-slate-900 space-y-3">
                            <div className="flex justify-between text-xs font-bold text-slate-400">
                                <span>Left Centre Back (LCB)</span>
                                <span className="text-red-400">Critical (0 backups)</span>
                            </div>
                            <div className="flex justify-between text-xs font-bold text-slate-400">
                                <span>Advanced Right 8 (R8)</span>
                                <span className="text-green-400">Healthy (2 backups)</span>
                            </div>
                        </div>
                    </div>
                    <div className="space-y-6">
                        <span className="text-xs font-black uppercase text-emerald-400 tracking-wider">02 Roster Depth & Health</span>
                        <h2 className="text-3xl md:text-5.5xl font-black text-white leading-tight">Identify positional gaps instantly.</h2>
                        <p className="text-lg text-slate-400 leading-relaxed">
                            Log secondary coverage positions and side-specific options (LCB vs RCB). Maintain real-time roster health rates and get automatically estimated timelines for recoveries.
                        </p>
                    </div>
                </div>

            </section>

            {/* Waitlist / CTA banner */}
            <section className="py-32 bg-gradient-to-t from-slate-950 to-transparent border-t border-slate-900 text-center px-6">
                <div className="max-w-4xl mx-auto space-y-8">
                    <span className="text-xs font-black uppercase text-emerald-400 tracking-widest inline-block">Join ClubFlow</span>
                    <h2 className="text-4xl md:text-6xl font-black text-white tracking-tight leading-tight">
                        One platform. One workflow. <br />One source of truth.
                    </h2>
                    <p className="text-lg text-slate-400 max-w-xl mx-auto leading-relaxed">
                        Unify your football department operations, matches, training sessions, and player profiles today.
                    </p>
                    <div className="flex items-center justify-center gap-4 pt-4">
                        <a href="mailto:demo@clubflow.com" className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-slate-955 px-6 py-3 rounded-lg font-bold text-sm transition-all shadow-lg shadow-emerald-500/10">
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
                        <span className="h-6 w-6 rounded bg-emerald-500 flex items-center justify-center font-black text-slate-955 text-xs">CF</span>
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