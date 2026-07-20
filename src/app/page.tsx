"use client";

import { useState } from "react";
import Link from "next/link";
import { Sparkles, ArrowRight, Shield, Activity, Users, FileText, Database, CreditCard, LayoutDashboard, Calendar, CalendarDays, CheckCircle2, DollarSign, Trophy, UserCheck, Search, Plus, Trash2 } from "lucide-react";

// SVG Jersey Icon matching the exact shape in the screenshot
function JerseyIcon({ className, color = "#1e40af" }: { className?: string; color?: string }) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill={color} stroke="#0f172a" strokeWidth="1.5">
            {/* T-Shirt jersey path */}
            <path d="M 6 3 L 18 3 L 21 6 L 19 8 L 17 6.5 L 17 21 L 7 21 L 7 6.5 L 5 8 L 3 6 Z" />
        </svg>
    );
}

export default function LandingPage() {
    const [activeTab, setActiveTab] = useState<"dashboard" | "matchday" | "squad" | "finances" | "attendance">("dashboard");

    const tabs = [
        { id: "dashboard", label: "Dashboard Overview", desc: "Your club's mission control. Real-time availability rates, dynamic priorities, and league standings consolidated into one clean dashboard." },
        { id: "matchday", label: "Matchday XI & Tactics", desc: "Drag, drop, and define. Lock in formations, manage the substitutes bench, and generate automated matchday squad notifications." },
        { id: "squad", label: "Squad Depth & Registry", desc: "Long-term roster planning. Map primary and secondary roles, side-specific defensive positions, and track medical status updates." },
        { id: "finances", label: "Finances & Billing", desc: "Keep your club out of the red. Track monthly subscriptions, match fees, and sponsorships. Check who has paid and send reminders." },
        { id: "attendance", label: "Training Attendance", desc: "Track attendance rates across matches and sessions to get data-backed insights on player dedication." },
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
                            <a href="#workflow" className="hover:text-white transition-colors">Workflow</a>
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
                    className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat opacity-15 filter grayscale scale-105"
                    style={{ backgroundImage: "url('/stadium_hero_bg.png')" }}
                />
                <div className="absolute inset-0 bg-gradient-to-b from-[#030712]/20 via-[#030712]/90 to-[#030712] z-0" />

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

                {/* Main Product Interactive Vector Preview (Dashboard preview) */}
                <div className="relative z-10 w-full max-w-5xl mt-24 px-4 md:px-0">
                    <div className="rounded-2xl overflow-hidden border border-slate-900 shadow-[0_0_80px_-10px_rgba(239,68,68,0.06)] bg-[#070a13] p-1">
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

                        {/* Interactive Screen Preview: App Layout (Dark Sidebar, Light Panel) */}
                        <div className="flex h-[520px] bg-[#f8fafc] text-slate-950 font-sans text-left overflow-hidden">
                            {/* App Sidebar */}
                            <div className="w-48 bg-[#0b0f19] text-slate-100 p-4 flex flex-col justify-between text-xs font-semibold select-none border-r border-[#1f293d]/45 shrink-0">
                                <div className="space-y-5">
                                    <div className="flex items-center gap-2 px-1 pb-2 border-b border-[#1f293d]/30">
                                        <div className="h-6 w-6 rounded bg-red-600 flex items-center justify-center font-bold text-white text-xs">CF</div>
                                        <div>
                                            <span className="font-extrabold text-[12px] text-white block">ClubFlow</span>
                                            <span className="text-[8px] text-slate-500 block leading-none font-bold uppercase">Workspace</span>
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest block px-2 pb-1">Football Operations</span>
                                        {[
                                            { label: "Dashboard Overview", icon: <LayoutDashboard className="h-3.5 w-3.5 text-red-500" /> },
                                            { label: "Matchday Tactics", icon: <Calendar className="h-3.5 w-3.5" /> },
                                            { label: "Squad Registry", icon: <Users className="h-3.5 w-3.5" /> },
                                            { label: "Club Finances", icon: <CreditCard className="h-3.5 w-3.5" /> },
                                            { label: "Training Attendance", icon: <Activity className="h-3.5 w-3.5" /> }
                                        ].map((item, idx) => (
                                            <div key={idx} className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg font-bold transition-all text-[11px] ${idx === 0 ? "bg-red-500/10 text-red-400 border border-red-500/20" : "text-slate-400"}`}>
                                                {item.icon}
                                                <span>{item.label}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Main Content Area (Light Theme matching actual app) */}
                            <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-[#f8fafc]">
                                <div className="flex justify-between items-center border-b border-slate-200 pb-3">
                                    <div>
                                        <div className="flex items-center gap-2.5">
                                            <h3 className="text-lg font-black text-slate-900">Camden United</h3>
                                            <span className="bg-red-500/10 text-red-600 border border-red-500/20 text-[9px] uppercase tracking-wider font-black px-2 py-0.5 rounded">
                                                Operations Command Centre
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Mini stats Grid */}
                                <div className="grid gap-4 grid-cols-3">
                                    <div className="bg-white border border-slate-200/80 p-4 rounded-xl space-y-1 shadow-sm">
                                        <span className="text-[9px] font-black uppercase text-slate-400 block">Squad Availability</span>
                                        <div className="text-base font-black text-slate-900">33 / 36 (92%)</div>
                                    </div>
                                    <div className="bg-white border border-slate-200/80 p-4 rounded-xl space-y-1 shadow-sm">
                                        <span className="text-[9px] font-black uppercase text-slate-400 block">Registration Alerts</span>
                                        <div className="text-base font-black text-amber-600">2 Outstanding</div>
                                    </div>
                                    <div className="bg-white border border-slate-200/80 p-4 rounded-xl space-y-1 shadow-sm">
                                        <span className="text-[9px] font-black uppercase text-slate-400 block">Unpaid Invoices</span>
                                        <div className="text-base font-black text-red-600">£450.00</div>
                                    </div>
                                </div>

                                {/* Layout Grid */}
                                <div className="grid gap-4 grid-cols-5">
                                    <div className="col-span-3 bg-white border border-slate-200/80 p-4 rounded-xl shadow-sm space-y-3">
                                        <span className="text-[10px] font-black uppercase text-slate-900 tracking-wider block">Next Fixture</span>
                                        <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 flex justify-between items-center text-xs">
                                            <div>
                                                <span className="font-extrabold text-slate-900">vs Western Athletic</span>
                                                <div className="text-[10px] text-slate-400 mt-0.5">Isthmian League • 🌱 Natural Grass</div>
                                            </div>
                                            <span className="text-slate-900 font-bold bg-white border border-slate-200 px-2.5 py-1.5 rounded-lg">16 Jul • 14:00</span>
                                        </div>
                                    </div>
                                    <div className="col-span-2 bg-white border border-slate-200/80 p-4 rounded-xl shadow-sm space-y-3">
                                        <span className="text-[10px] font-black uppercase text-slate-900 tracking-wider block">Training Attendance</span>
                                        <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 text-center">
                                            <div className="text-2xl font-black text-slate-900">92%</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            {/* Interactive Vector Product Tour Section */}
            <section id="tour" className="py-32 max-w-[94%] mx-auto px-6 space-y-16">
                <div className="text-center space-y-4 max-w-2xl mx-auto">
                    <span className="text-xs font-black uppercase text-red-500 tracking-wider">Interactive Preview</span>
                    <h2 className="text-3xl md:text-5xl font-black text-white leading-tight">Explore the platform.</h2>
                    <p className="text-lg text-slate-400 leading-relaxed">
                        Interact with high-fidelity React layouts mapped precisely to the actual design patterns of ClubFlow.
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

                {/* Live Vector Application Shell Interface (Matching screenshots exactly!) */}
                <div className="rounded-2xl overflow-hidden border border-slate-900 shadow-2xl">
                    
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

                    {/* App viewport wrapper (Dark sidebar, Light main screen) */}
                    <div className="flex min-h-[520px] bg-[#f8fafc] text-slate-900 font-sans text-left overflow-hidden">
                        
                        {/* Sidebar (Dark) */}
                        <div className="w-48 bg-[#0b0f19] text-slate-100 p-4 flex flex-col justify-between text-xs font-semibold select-none border-r border-[#1f293d]/45 shrink-0">
                            <div className="space-y-5">
                                <div className="flex items-center gap-2 px-1 pb-2 border-b border-[#1f293d]/30">
                                    <div className="h-6 w-6 rounded bg-red-600 flex items-center justify-center font-bold text-white text-xs">CF</div>
                                    <div>
                                        <span className="font-extrabold text-[12px] text-white block">ClubFlow</span>
                                        <span className="text-[8px] text-slate-500 block leading-none font-bold uppercase">Workspace</span>
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest block px-2 pb-1">Football Operations</span>
                                    {[
                                        { id: "dashboard", label: "Dashboard Overview", icon: <LayoutDashboard className="h-3.5 w-3.5" /> },
                                        { id: "matchday", label: "Matchday Tactics", icon: <Calendar className="h-3.5 w-3.5" /> },
                                        { id: "squad", label: "Squad Registry", icon: <Users className="h-3.5 w-3.5" /> },
                                        { id: "finances", label: "Club Finances", icon: <CreditCard className="h-3.5 w-3.5" /> },
                                        { id: "attendance", label: "Training Attendance", icon: <Activity className="h-3.5 w-3.5" /> }
                                    ].map((item) => (
                                        <div 
                                            key={item.id} 
                                            className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg font-bold transition-all text-[11px] ${
                                                activeTab === item.id 
                                                    ? "bg-red-500/10 text-red-400 border border-red-500/20" 
                                                    : "text-slate-400"
                                            }`}
                                        >
                                            {item.icon}
                                            <span>{item.label}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Viewport Content Area (Light Theme) */}
                        <div className="flex-1 p-6 overflow-y-auto space-y-6">
                            
                            {/* Tab: Dashboard */}
                            {activeTab === "dashboard" && (
                                <div className="space-y-6 animate-in fade-in duration-200">
                                    <div className="flex justify-between items-center border-b border-slate-200 pb-3">
                                        <div>
                                            <h3 className="text-lg font-black text-slate-900">Operations Command Centre</h3>
                                            <p className="text-slate-500 text-xs mt-0.5">Squad Management &amp; Analytics</p>
                                        </div>
                                    </div>
                                    
                                    <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
                                        <div className="bg-white border border-slate-200 p-5 rounded-xl space-y-1.5 shadow-sm">
                                            <span className="text-[10px] font-black uppercase text-slate-400 block">Squad Availability</span>
                                            <div className="text-lg font-black text-slate-900">33 / 36 (92%)</div>
                                        </div>
                                        <div className="bg-white border border-slate-200 p-5 rounded-xl space-y-1.5 shadow-sm">
                                            <span className="text-[10px] font-black uppercase text-slate-400 block">Pending Alerts</span>
                                            <div className="text-lg font-black text-amber-600">2 Actions Required</div>
                                        </div>
                                        <div className="bg-white border border-slate-200 p-5 rounded-xl space-y-1.5 shadow-sm">
                                            <span className="text-[10px] font-black uppercase text-slate-400 block">Unpaid Invoices</span>
                                            <div className="text-lg font-black text-red-650">£450.00</div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Tab: Matchday XI (MATCHING SCREENSHOTS EXACTLY!) */}
                            {activeTab === "matchday" && (
                                <div className="grid gap-6 grid-cols-1 xl:grid-cols-6 animate-in fade-in duration-200 text-slate-900">
                                    
                                    {/* Left Panel: Available Squad */}
                                    <div className="xl:col-span-1.5 bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-3 shrink-0 min-w-[160px]">
                                        <div className="flex justify-between items-center text-xs font-bold text-slate-900">
                                            <span>AVAILABLE SQUAD</span>
                                            <span className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded text-[10px]">18</span>
                                        </div>
                                        <div className="flex gap-1 text-[9px] font-black border-b pb-2 text-slate-400">
                                            <span className="bg-slate-900 text-white px-1.5 py-0.5 rounded">All</span>
                                            <span>GK</span>
                                            <span>DEF</span>
                                            <span>MID</span>
                                        </div>
                                        <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
                                            {["Mohammed Khan", "Bobby Eden", "Ryan King", "Steven Robinson", "Thomas Harris"].map((p, i) => (
                                                <div key={i} className="bg-white border border-slate-200/80 px-2 py-1.5 rounded-lg text-[10px] font-bold text-slate-700 shadow-sm">
                                                    {p}
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Centre Panel: Visual Pitch layout */}
                                    <div className="xl:col-span-3 bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col justify-between space-y-4">
                                        <div className="flex justify-between items-center">
                                            <span className="text-sm font-black text-slate-900">Starting XI</span>
                                            <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold">
                                                <span>FORMATION</span>
                                                <span className="bg-slate-100 border border-slate-200 px-2 py-1 rounded text-slate-900 font-bold">4-2-3-1</span>
                                            </div>
                                        </div>

                                        {/* Grass pitch graphic matching second screenshot */}
                                        <div className="relative w-full h-[320px] bg-gradient-to-b from-[#10b981] to-[#047857] rounded-xl overflow-hidden shadow-inner border border-emerald-600/40 p-2">
                                            {/* Pitch line markings */}
                                            <div className="absolute inset-0 pointer-events-none opacity-25 border border-white m-1.5">
                                                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-10 border-x border-b border-white" />
                                                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-32 h-10 border-x border-t border-white" />
                                                <div className="absolute top-1/2 left-0 right-0 border-t border-white" />
                                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 border border-white rounded-full" />
                                            </div>

                                            {/* Pinned Players Jerseys */}
                                            {/* GK */}
                                            <div className="absolute top-3 left-1/2 -translate-x-1/2 flex flex-col items-center">
                                                <JerseyIcon className="w-7 h-7" color="#f97316" />
                                                <span className="text-[8px] font-black text-white bg-slate-950 px-1.5 py-0.5 rounded shadow mt-1">David</span>
                                            </div>
                                            {/* DEF */}
                                            <div className="absolute top-[28%] left-0 right-0 flex justify-around px-4">
                                                {[{ name: "Fidel" }, { name: "Ahmad" }, { name: "Junior" }, { name: "John" }].map((p, i) => (
                                                    <div key={i} className="flex flex-col items-center">
                                                        <JerseyIcon className="w-7 h-7" color="#2563eb" />
                                                        <span className="text-[8px] font-black text-white bg-slate-950 px-1.5 py-0.5 rounded shadow mt-1">{p.name}</span>
                                                    </div>
                                                ))}
                                            </div>
                                            {/* MID */}
                                            <div className="absolute top-[52%] left-0 right-0 flex justify-around px-12">
                                                {[{ name: "Chris" }, { name: "Matthew" }].map((p, i) => (
                                                    <div key={i} className="flex flex-col items-center">
                                                        <JerseyIcon className="w-7 h-7" color="#2563eb" />
                                                        <span className="text-[8px] font-black text-white bg-slate-950 px-1.5 py-0.5 rounded shadow mt-1">{p.name}</span>
                                                    </div>
                                                ))}
                                            </div>
                                            {/* AM */}
                                            <div className="absolute top-[72%] left-0 right-0 flex justify-around px-6">
                                                {[{ name: "Oliver" }, { name: "William" }, { name: "Delano" }].map((p, i) => (
                                                    <div key={i} className="flex flex-col items-center">
                                                        <JerseyIcon className="w-7 h-7" color="#2563eb" />
                                                        <span className="text-[8px] font-black text-white bg-slate-950 px-1.5 py-0.5 rounded shadow mt-1">{p.name}</span>
                                                    </div>
                                                ))}
                                            </div>
                                            {/* ST */}
                                            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex flex-col items-center">
                                                <JerseyIcon className="w-7 h-7" color="#2563eb" />
                                                <span className="text-[8px] font-black text-white bg-slate-950 px-1.5 py-0.5 rounded shadow mt-1">Shoaib</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Right Panel: Bench (5) */}
                                    <div className="xl:col-span-1.5 bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col justify-between min-h-[360px] min-w-[160px]">
                                        <div className="space-y-3">
                                            <div className="flex justify-between items-center text-xs font-bold text-slate-950">
                                                <span>BENCH (5)</span>
                                                <span className="text-red-500 font-extrabold text-[10px] uppercase hover:underline">+ ADD SLOT</span>
                                            </div>
                                            <div className="space-y-1.5">
                                                {["Sebastian Senna", "Lloyd Hucknall", "Chris Hall", "Sam Ward"].map((name, i) => (
                                                    <div key={i} className="bg-slate-50 border border-slate-200/80 px-2 py-1.5 rounded-lg flex items-center justify-between text-[10px] font-bold text-slate-700">
                                                        <span>{name}</span>
                                                        <span className="text-[9px] text-slate-400 font-black uppercase">Unused</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                        <button className="w-full bg-red-600 hover:bg-red-500 text-white font-extrabold py-2 rounded-lg text-xs mt-3 shadow-md shadow-red-650/10">
                                            Save Lineup for Game
                                        </button>
                                    </div>
                                    
                                </div>
                            )}

                            {/* Tab: Squad registry */}
                            {activeTab === "squad" && (
                                <div className="space-y-4 animate-in fade-in duration-200 text-xs">
                                    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                                        <div className="bg-slate-50 px-4 py-3 font-bold text-slate-450 border-b border-slate-200 flex justify-between uppercase tracking-wider text-[10px]">
                                            <span className="w-1/3">Player Name</span>
                                            <span className="w-1/4 text-center">Primary Position</span>
                                            <span className="w-1/4 text-center">Footedness</span>
                                            <span className="w-1/4 text-right">Status</span>
                                        </div>
                                        <div className="divide-y divide-slate-100 font-bold">
                                            {[
                                                { name: "Liam Johnson", pos: "Striker (ST)", foot: "Right", status: "Available", color: "text-green-600" },
                                                { name: "Sufi Ali", pos: "Left Back (LB)", foot: "Left", status: "Injured", color: "text-red-500" },
                                                { name: "Morgan Whittick", pos: "Winger (LW)", foot: "Both", status: "On Holiday", color: "text-amber-600" },
                                            ].map((player, i) => (
                                                <div key={i} className="px-4 py-3.5 flex justify-between items-center text-slate-600">
                                                    <span className="w-1/3 text-slate-900">{player.name}</span>
                                                    <span className="w-1/4 text-center">{player.pos}</span>
                                                    <span className="w-1/4 text-center text-slate-450">{player.foot}</span>
                                                    <span className={`w-1/4 text-right ${player.color}`}>{player.status}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Tab: Finances */}
                            {activeTab === "finances" && (
                                <div className="space-y-6 animate-in fade-in duration-200">
                                    <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
                                        <div className="bg-white border border-slate-200 p-5 rounded-xl space-y-1 shadow-sm">
                                            <span className="text-[10px] font-black uppercase text-slate-450 block">Monthly Subs Collected</span>
                                            <div className="text-2xl font-black text-slate-900">£1,250.00</div>
                                        </div>
                                        <div className="bg-white border border-slate-200 p-5 rounded-xl space-y-1 shadow-sm">
                                            <span className="text-[10px] font-black uppercase text-slate-455 block">Outstanding Arrears</span>
                                            <div className="text-2xl font-black text-red-650">£320.00</div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Tab: Training Attendance */}
                            {activeTab === "attendance" && (
                                <div className="space-y-4 animate-in fade-in duration-200 text-xs">
                                    <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3 shadow-sm">
                                        <span className="text-xs font-black uppercase text-slate-900 tracking-wider block">Recent Attendance Logs</span>
                                        <div className="space-y-2">
                                            {["First Team Training - 15 Jul", "Tactical Pre-Match Setup - 12 Jul"].map((session, i) => (
                                                <div key={i} className="flex justify-between items-center bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                                                    <span className="font-bold text-slate-900 text-xs">{session}</span>
                                                    <span className="bg-red-500/10 text-red-600 border border-red-500/20 px-3 py-1 rounded-full font-black text-[10px]">94% ATTENDANCE</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}

                        </div>
                    </div>
                </div>
            </section>

            {/* Core Workspaces Section */}
            <section id="features" className="py-32 bg-slate-950/20 border-t border-b border-slate-900">
                <div className="max-w-7xl mx-auto px-6 space-y-24">
                    <div className="text-center space-y-4 max-w-2xl mx-auto">
                        <span className="text-xs font-black uppercase text-red-500 tracking-wider">Modular Features</span>
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
                                Know who is selectable. Plan formations, select the starting XI, and generate instant RSVP updates for players.
                            </p>
                        </div>

                        {/* Squad Planning */}
                        <div className="bg-[#0b0f19] p-8 rounded-2xl border border-slate-900 space-y-4 shadow-lg">
                            <Users className="h-8 w-8 text-red-500" />
                            <h3 className="font-black text-white text-lg">Roster Depth</h3>
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
                        <span className="text-xs font-black uppercase text-red-500 tracking-wider">01 Matchday Operations</span>
                        <h2 className="text-3xl md:text-5.5xl font-black text-white leading-tight">Run matchdays with absolute confidence.</h2>
                        <p className="text-lg text-slate-400 leading-relaxed">
                            Organize your lineup with an interactive visual pitch selector, synchronize bench options, and export professional PDF team sheets directly for league match officials.
                        </p>
                    </div>
                    {/* Visual Team Sheet */}
                    <div className="rounded-xl overflow-hidden border border-slate-900 shadow-2xl p-6 bg-[#030712] space-y-4">
                        <span className="text-xs font-black uppercase text-slate-400 block tracking-wider">Visual Team Sheet</span>
                        <div className="bg-slate-950 p-4 rounded-xl border border-slate-900 space-y-3">
                            <div className="flex justify-between items-center text-xs font-bold text-slate-400">
                                <span>vs London Albion</span>
                                <span className="text-red-400 font-extrabold uppercase">Formation: 4-3-3</span>
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
                        <span className="text-xs font-black uppercase text-red-500 tracking-wider">02 Roster Depth & Health</span>
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