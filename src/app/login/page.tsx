"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Lock, CheckCircle2, LayoutDashboard, Users, Calendar, CreditCard, Activity, Trophy, Clock, Check, AlertTriangle, ArrowRight, DollarSign, Sparkles, TrendingUp, Wallet, MapPin, CalendarDays } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import Link from "next/link";

export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [activeTab, setActiveTab] = useState(0);
    const [loading, setLoading] = useState(false);
    const [isLightboxOpen, setIsLightboxOpen] = useState(false);
    const router = useRouter();

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                setIsLightboxOpen(false);
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, []);

    const tourTabs = [
        {
            id: "dashboard",
            label: "01 Dashboard",
            title: "Dashboard Overview",
            description: "Get a real-time health check of your club. Track active roster status, view the next match details, monitor monthly payments progress, and keep an eye on recent training attendance.",
        },
        {
            id: "matchday",
            label: "02 Matchday XI",
            title: "Matchday XI & Tactics",
            description: "Drag and drop your starting lineup, select from popular formations, and organize your substitutes bench. Automatically generate WhatsApp messages for squad availability polls and export professional matchday team sheets as PDF.",
        },
        {
            id: "squad",
            label: "03 Squad Management",
            title: "Squad Management",
            description: "Manage player registry, monitor individual statistics (appearances, goals, assists), track contract expiry dates, and update medical availability statuses so you always know who is match-fit.",
        },
        {
            id: "finances",
            label: "04 Club Finances",
            title: "Finances & Payments",
            description: "Keep your club out of the red. Track monthly membership subscriptions, match fees, and sponsorships. Check who has paid and send reminders in one tap.",
        },
        {
            id: "training",
            label: "05 Training Tracking",
            title: "Training Tracker",
            description: "Plan weekly training sessions, log player attendance, and track performance metrics. View detailed attendance heatmaps to see who's dedicated.",
        }
    ];




    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) {
                throw error;
            }

            if (data.session) {
                const { data: member } = await supabase
                    .from("club_members")
                    .select("role")
                    .eq("user_id", data.session.user.id)
                    .single();

                if (member?.role === "Player") {
                    router.push("/player");
                } else {
                    router.push("/dashboard");
                }
            }
        } catch (err: any) {
            setError(err.message || "Failed to sign in. Please check your credentials.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 flex flex-col md:flex-row relative overflow-hidden font-sans select-none">
            {/* Custom CSS Keyframe Animations for Tactical Flows */}
            <style dangerouslySetInnerHTML={{ __html: `
                @keyframes flow-dash {
                    to {
                        stroke-dashoffset: -40;
                    }
                }
                @keyframes pulse-glow {
                    0%, 100% {
                        transform: scale(1);
                        opacity: 0.35;
                    }
                    50% {
                        transform: scale(1.2);
                        opacity: 0.8;
                    }
                }
                @keyframes subtle-float {
                    0%, 100% {
                        transform: translateY(0) translateX(0);
                    }
                    50% {
                        transform: translateY(-6px) translateX(3px);
                    }
                }
                .tactical-flow-1 {
                    stroke-dasharray: 8 6;
                    animation: flow-dash 6s linear infinite;
                }
                .tactical-flow-2 {
                    stroke-dasharray: 6 4;
                    animation: flow-dash 5s linear infinite reverse;
                }
                .tactical-flow-3 {
                    stroke-dasharray: 7 5;
                    animation: flow-dash 7s linear infinite;
                }
                .node-pulse {
                    transform-origin: center;
                    animation: pulse-glow 3s ease-in-out infinite;
                }
                .float-node-1 {
                    transform-origin: center;
                    animation: subtle-float 8s ease-in-out infinite;
                }
                .float-node-2 {
                    transform-origin: center;
                    animation: subtle-float 10s ease-in-out infinite 1.5s;
                }
            `}} />

            {/* Tactical Pitch Background Pattern */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                {/* Grid pattern overlay */}
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:5rem_5rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-[0.12]" />
                
                <svg viewBox="0 0 1000 1000" className="absolute w-full h-full text-slate-700 stroke-current opacity-[0.04]" fill="none" strokeWidth="1.5">
                    {/* Center circle */}
                    <circle cx="500" cy="500" r="150" strokeDasharray="6 6" />
                    <circle cx="500" cy="500" r="5" fill="currentColor" />
                    
                    {/* Halfway line */}
                    <line x1="0" y1="500" x2="1000" y2="500" />
                    
                    {/* Penalty box at top */}
                    <rect x="250" y="0" width="500" height="200" />
                    <rect x="400" y="0" width="200" height="70" />
                    <path d="M 420 200 A 80 80 0 0 0 580 200" strokeDasharray="4 4" />
                    
                    {/* Penalty box at bottom */}
                    <rect x="250" y="800" width="500" height="200" />
                    <rect x="400" y="930" width="200" height="70" />
                    <path d="M 420 800 A 80 80 0 0 1 580 800" strokeDasharray="4 4" />
                    
                    {/* Tactical arrows / paths with animating classes */}
                    <path d="M 200 300 Q 300 200 450 355" className="tactical-flow-1" markerEnd="url(#arrow)" />
                    <path d="M 800 400 Q 650 300 550 455" className="tactical-flow-2" markerEnd="url(#arrow)" />
                    <path d="M 300 700 Q 400 600 500 520" className="tactical-flow-3" markerEnd="url(#arrow)" stroke="#ef4444" strokeWidth="2" />
                    <path d="M 600 800 Q 750 755 850 600" className="tactical-flow-1" markerEnd="url(#arrow)" />

                    {/* Tactical Player Nodes with floating and pulse animations */}
                    <g className="float-node-1">
                        <circle cx="20%" cy="30%" r="14" fill="#0f172a" strokeWidth="2" stroke="#ef4444" />
                        <circle cx="20%" cy="30%" r="20" fill="none" strokeWidth="1" stroke="#ef4444" className="node-pulse" />
                        <text x="20%" y="34%" textAnchor="middle" fill="#ef4444" fontSize="12" fontWeight="bold">8</text>
                    </g>
                    
                    <g className="float-node-2">
                        <circle cx="80%" cy="40%" r="14" fill="#0f172a" strokeWidth="2" stroke="#94a3b8" />
                        <text x="80%" y="44%" textAnchor="middle" fill="#94a3b8" fontSize="12" fontWeight="bold">2</text>
                    </g>
                    
                    <g className="float-node-1">
                        <circle cx="30%" cy="70%" r="14" fill="#0f172a" strokeWidth="2" stroke="#ef4444" />
                        <circle cx="30%" cy="70%" r="20" fill="none" strokeWidth="1" stroke="#ef4444" className="node-pulse" />
                        <text x="30%" y="74%" textAnchor="middle" fill="#ef4444" fontSize="12" fontWeight="bold">10</text>
                    </g>
                    
                    <g className="float-node-2">
                        <circle cx="45%" cy="35%" r="14" fill="#ef4444" strokeWidth="2" stroke="#ffffff" />
                        <text x="45%" y="39%" textAnchor="middle" fill="white" fontSize="12" fontWeight="bold">9</text>
                    </g>

                    {/* Marker definition for arrowheads */}
                    <defs>
                        <marker id="arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                            <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
                        </marker>
                    </defs>
                </svg>
            </div>

            {/* Left Column — Hero Logo + Supporting Copy */}
            <div className="hidden md:flex md:w-[65%] lg:w-[72%] xl:w-[75%] flex-col justify-between p-10 lg:p-14 relative z-10 bg-gradient-to-br from-slate-950 via-slate-950 to-slate-900/40">

                {/* Top spacer / top-left wordmark (text only — logo image carries the brand) */}
                <div className="flex items-center gap-2">
                    <span className="text-sm font-extrabold tracking-widest text-red-500 uppercase">Club<span className="text-white">Flow</span></span>
                    <span className="h-1 w-1 rounded-full bg-red-500" />
                    <span className="text-xs text-slate-500 tracking-wide">Club Management Platform</span>
                </div>

                {/* HERO: Interactive Product Tour */}
                <div className="my-auto flex flex-col items-start text-left space-y-6 w-full max-w-5xl mx-auto">
                    
                    <div className="space-y-2">
                        <span className="text-[10px] font-bold tracking-widest text-red-500 uppercase">
                            01 PRODUCT TOUR
                        </span>
                        <h2 className="text-2xl lg:text-3xl font-black tracking-tight text-white">
                            Take a Tour of ClubFlow
                        </h2>
                        <p className="text-slate-400 text-sm leading-relaxed max-w-xl">
                            ClubFlow is the complete digital headquarters for football clubs. Explore the five core workspaces built to manage players, matches, statistics, and club finances in one place. Click a tab to preview.
                        </p>
                    </div>

                    {/* Pill Switcher */}
                    <div className="flex flex-wrap gap-2 w-full">
                        {tourTabs.map((tab, idx) => (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => setActiveTab(idx)}
                                className={`px-4 py-2 rounded-full text-xs font-semibold tracking-wide transition-all border ${
                                    activeTab === idx
                                        ? "bg-white text-slate-950 border-white shadow-lg font-bold"
                                        : "bg-slate-900/60 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-white"
                                }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Tab description text */}
                    <p className="text-slate-300 text-xs leading-relaxed max-w-xl min-h-[36px]">
                        {tourTabs[activeTab].description}
                    </p>

                    <div className="w-full relative rounded-2xl overflow-hidden border border-slate-900 bg-[#0b0f19] backdrop-blur-sm transition-all duration-300 shadow-2xl shadow-black/80">
                        {/* Browser Header Bar */}
                        <div className="h-10 bg-[#121824] border-b border-[#1f293d] px-4 flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                                <span className="h-3 w-3 rounded-full bg-[#ff5f56] inline-block" />
                                <span className="h-3 w-3 rounded-full bg-[#ffbd2e] inline-block" />
                                <span className="h-3 w-3 rounded-full bg-[#27c93f] inline-block" />
                            </div>
                            <div className="bg-[#0b0f19] border border-[#1f293d] px-3 py-1 rounded-md text-[10px] text-slate-400 font-mono tracking-wide w-48 text-center truncate select-all">
                                app.clubflow.com/{tourTabs[activeTab].id}
                            </div>
                            <div className="w-10" /> {/* Spacer */}
                        </div>

                        {/* Browser Viewport Content Area (High-Contrast Dark Theme) */}
                        <div className="p-4 bg-[#0b0f19] text-slate-100 min-h-[480px] overflow-hidden flex flex-col justify-start text-left">
                            {activeTab === 0 && (
                                    <div className="space-y-4 animate-in fade-in duration-200 text-slate-200 text-left text-[10px]">
                                        {/* Dashboard Preview Header */}
                                        <div className="flex items-center gap-2 pb-2 border-b border-slate-850">
                                            <div className="h-7 w-7 relative flex-shrink-0 bg-red-950/40 border border-red-500/50 rounded-full flex items-center justify-center font-bold text-xs text-red-500">
                                                CU
                                            </div>
                                            <div>
                                                <h3 className="text-xs font-black tracking-tight text-white leading-none">ClubFlow United Dashboard</h3>
                                                <span className="text-[9px] text-slate-400 font-medium">Welcome back, Coach. Here's what's happening.</span>
                                            </div>
                                        </div>

                                        {/* Upcoming Birthdays */}
                                        <div className="bg-red-500/5 border border-red-500/20 text-red-200 rounded-lg px-2.5 py-1.5 flex items-center gap-1.5 text-[9px] font-semibold">
                                            🎉 <span className="text-slate-400 font-medium">Upcoming Birthdays:</span> Andrew Wright turns 29 in 7 days (24 Jul)
                                        </div>

                                        {/* Quick Start Checklist Banner */}
                                        <div className="bg-[#121824] text-white rounded-lg p-2.5 relative overflow-hidden border border-slate-850 shadow-sm flex flex-col gap-1.5">
                                            <div className="flex items-center justify-between w-full">
                                                <span className="bg-red-500 text-white text-[7px] uppercase font-black px-1.5 py-0.5 tracking-wider rounded">Quick Start</span>
                                                <span className="text-[8px] font-bold text-slate-400">Club Setup Progress: 3/4 steps</span>
                                            </div>
                                            <h4 className="text-[10px] font-black tracking-tight text-white leading-none">Get your Club Flowing</h4>
                                            <div className="grid grid-cols-4 gap-1.5 text-[8px] mt-0.5">
                                                <div className="flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-semibold p-1 rounded justify-center">
                                                    ✓ Add Players
                                                </div>
                                                <div className="flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-semibold p-1 rounded justify-center">
                                                    ✓ Schedule Match
                                                </div>
                                                <div className="flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-semibold p-1 rounded justify-center">
                                                    ✓ Pick Lineup
                                                </div>
                                                <div className="flex items-center gap-1 bg-white/5 border border-white/10 text-slate-450 p-1 rounded font-bold justify-center">
                                                    Link League Url
                                                </div>
                                            </div>
                                        </div>

                                        {/* Stats Grid */}
                                        <div className="grid grid-cols-4 gap-2">
                                            <div className="bg-[#121824] border border-slate-850 hover:border-red-500/30 p-2 rounded-lg border-l-2 border-l-red-500 transition-all">
                                                <span className="text-[8px] font-bold uppercase tracking-wider text-slate-550 block">First Team Squad</span>
                                                <span className="text-sm font-black text-white">36</span>
                                                <span className="text-[8px] text-red-400 font-semibold block cursor-pointer">View Squad →</span>
                                            </div>
                                            <div className="bg-[#121824] border border-slate-850 hover:border-amber-500/30 p-2 rounded-lg border-l-2 border-l-amber-500 transition-all">
                                                <span className="text-[8px] font-bold uppercase tracking-wider text-slate-550 block">League Position</span>
                                                <span className="text-sm font-black text-white">Unranked</span>
                                                <span className="text-[8px] text-slate-500 font-medium block">Configure table</span>
                                            </div>
                                            <div className="bg-[#121824] border border-slate-850 hover:border-slate-500/30 p-2 rounded-lg border-l-2 border-l-slate-500 transition-all">
                                                <span className="text-[8px] font-bold uppercase tracking-wider text-slate-550 block">Next Match</span>
                                                <span className="text-sm font-black text-white">No fixtures</span>
                                                <span className="text-[8px] text-slate-500 block">+ Schedule Match</span>
                                            </div>
                                            <div className="bg-[#121824] border border-slate-850 hover:border-emerald-500/30 p-2 rounded-lg border-l-2 border-l-emerald-500 transition-all">
                                                <span className="text-[8px] font-bold uppercase tracking-wider text-slate-550 block">Last Result</span>
                                                <span className="text-sm font-black text-emerald-400 block">2 - 0 Win</span>
                                                <span className="text-[8px] text-slate-500 block">vs Rangers FC</span>
                                            </div>
                                        </div>

                                        {/* Bottom row (Pitch layout + Squad position balance) */}
                                        <div className="grid grid-cols-12 gap-3 pt-1">
                                            {/* Left Panel: Pitch */}
                                            <div className="col-span-7 bg-[#121824] border border-slate-850 p-2 rounded-lg">
                                                <h4 className="font-extrabold text-[9px] text-slate-550 uppercase tracking-wider mb-2">Performance &amp; Lineup</h4>
                                                <div className="flex items-center justify-between mb-2">
                                                    <div className="flex gap-1">
                                                        <span className="h-4 w-4 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold text-[8px] border border-emerald-500/20">W</span>
                                                        <span className="h-4 w-4 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold text-[8px] border border-emerald-500/20">W</span>
                                                        <span className="h-4 w-4 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold text-[8px] border border-emerald-500/20">W</span>
                                                        <span className="h-4 w-4 rounded-full bg-rose-500/10 text-rose-400 flex items-center justify-center font-bold text-[8px] border border-rose-500/20">L</span>
                                                        <span className="h-4 w-4 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold text-[8px] border border-emerald-500/20">W</span>
                                                    </div>
                                                </div>
                                                {/* Mini green field */}
                                                <div className="relative bg-[#102d1f]/60 h-[100px] rounded border border-emerald-500/20 overflow-hidden flex flex-col justify-between p-1">
                                                    <div className="absolute inset-0 border border-white/5 m-0.5 pointer-events-none" />
                                                    <div className="absolute top-1/2 left-0 right-0 border-t border-white/5" />
                                                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 border border-white/5 rounded-full" />
                                                    {/* GK */}
                                                    <div className="flex justify-center shrink-0"><span className="h-1.5 w-1.5 rounded-full bg-amber-500 inline-block" /></div>
                                                    {/* DEF */}
                                                    <div className="flex justify-around px-2 shrink-0">
                                                        <span className="h-1.5 w-1.5 rounded-full bg-blue-500 inline-block" /><span className="h-1.5 w-1.5 rounded-full bg-blue-500 inline-block" /><span className="h-1.5 w-1.5 rounded-full bg-blue-500 inline-block" />
                                                    </div>
                                                    {/* MID */}
                                                    <div className="flex justify-around px-4 shrink-0">
                                                        <span className="h-1.5 w-1.5 rounded-full bg-blue-500 inline-block" /><span className="h-1.5 w-1.5 rounded-full bg-blue-500 inline-block" /><span className="h-1.5 w-1.5 rounded-full bg-blue-500 inline-block" />
                                                    </div>
                                                    {/* FWD */}
                                                    <div className="flex justify-center shrink-0"><span className="h-1.5 w-1.5 rounded-full bg-blue-500 inline-block" /></div>
                                                </div>
                                            </div>

                                            {/* Right Panel: Squad Balance */}
                                            <div className="col-span-5 bg-[#121824] border border-slate-850 p-2 rounded-lg flex flex-col justify-between">
                                                <h4 className="font-extrabold text-[9px] text-slate-555 uppercase tracking-wider mb-2">Squad Position Balance</h4>
                                                <div className="space-y-1.5 flex-grow flex flex-col justify-around">
                                                    <div>
                                                        <div className="flex justify-between text-[7px] text-slate-500 mb-0.5 leading-none">
                                                            <span>Goalkeepers</span>
                                                            <span className="font-bold text-white">3 (8%)</span>
                                                        </div>
                                                        <div className="w-full bg-slate-900 h-1 rounded-full"><div className="bg-red-500 h-full rounded-full w-[8%]" /></div>
                                                    </div>
                                                    <div>
                                                        <div className="flex justify-between text-[7px] text-slate-500 mb-0.5 leading-none">
                                                            <span>Defenders</span>
                                                            <span className="font-bold text-white">12 (33%)</span>
                                                        </div>
                                                        <div className="w-full bg-slate-900 h-1 rounded-full"><div className="bg-blue-500 h-full rounded-full w-[33%]" /></div>
                                                    </div>
                                                    <div>
                                                        <div className="flex justify-between text-[7px] text-slate-500 mb-0.5 leading-none">
                                                            <span>Midfielders</span>
                                                            <span className="font-bold text-white">10 (28%)</span>
                                                        </div>
                                                        <div className="w-full bg-slate-900 h-1 rounded-full"><div className="bg-amber-500 h-full rounded-full w-[28%]" /></div>
                                                    </div>
                                                    <div>
                                                        <div className="flex justify-between text-[7px] text-slate-500 mb-0.5 leading-none">
                                                            <span>Forwards</span>
                                                            <span className="font-bold text-white">11 (31%)</span>
                                                        </div>
                                                        <div className="w-full bg-slate-900 h-1 rounded-full"><div className="bg-rose-500 h-full rounded-full w-[31%]" /></div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {activeTab === 1 && (
                                    <div className="space-y-3 animate-in fade-in duration-200 flex-grow flex flex-col text-slate-200 text-left text-[9px]">
                                        {/* Match Info Bar */}
                                        <div className="bg-slate-900 border border-slate-800 text-white rounded-lg p-2 flex items-center justify-between font-bold text-[8px] tracking-wide shrink-0">
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-red-500 font-extrabold uppercase">Upcoming Match</span>
                                                <span className="text-slate-700">|</span>
                                                <span>ClubFlow United vs Western Athletic</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-slate-400">
                                                <span className="bg-[#0b0f19] border border-slate-800 px-1 py-0.5 rounded text-white text-[7px]">Friendly</span>
                                                <span>16/07/2026</span>
                                                <span>14:00</span>
                                                <span className="text-emerald-400 font-extrabold">Home</span>
                                            </div>
                                        </div>

                                        {/* Main Columns Container */}
                                        <div className="grid grid-cols-12 gap-3 flex-grow overflow-hidden min-h-[300px]">
                                            {/* Left Column: Available Squad */}
                                            <div className="col-span-3 bg-[#121824] border border-slate-800 rounded-xl p-2 flex flex-col overflow-hidden">
                                                <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 mb-1.5 shrink-0">
                                                    <span className="font-extrabold text-[8px] uppercase tracking-wider text-slate-400">Available Squad (16)</span>
                                                </div>
                                                <div className="flex gap-1 mb-1.5 text-[7px] font-bold shrink-0">
                                                    <span className="px-1.5 py-0.5 bg-red-650 text-white rounded">All</span>
                                                    <span className="px-1.5 py-0.5 bg-[#0b0f19] border border-slate-800 text-slate-400 rounded">GK</span>
                                                    <span className="px-1.5 py-0.5 bg-[#0b0f19] border border-slate-800 text-slate-400 rounded">DEF</span>
                                                    <span className="px-1.5 py-0.5 bg-[#0b0f19] border border-slate-800 text-slate-400 rounded">MID</span>
                                                </div>
                                                <div className="space-y-1 overflow-y-auto flex-grow pr-0.5">
                                                    {[
                                                        { name: "Mohammed Khan", pos: "GK" },
                                                        { name: "Bobby Eden-Cheltenham", pos: "CB" },
                                                        { name: "Ryan King", pos: "RB" },
                                                        { name: "Steven Robinson", pos: "RB" },
                                                        { name: "Thomas Harris", pos: "CDM" }
                                                    ].map((p, idx) => (
                                                        <div key={idx} className="flex flex-col p-1 border border-slate-800 rounded bg-[#0b0f19] leading-tight">
                                                            <span className="font-bold text-slate-200 truncate">{p.name}</span>
                                                            <span className="text-[7px] text-slate-500 font-semibold">{p.pos}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Center Column: Pitch View */}
                                            <div className="col-span-6 bg-[#121824] border border-slate-800 rounded-xl p-2 flex flex-col overflow-hidden">
                                                <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 mb-1.5 shrink-0">
                                                    <span className="font-extrabold text-[8px] uppercase tracking-wider text-slate-400">Starting XI</span>
                                                    <div className="flex items-center gap-1 text-[8px]">
                                                        <span className="text-slate-500">Formation</span>
                                                        <span className="border border-slate-800 rounded px-1.5 py-0.5 bg-[#0b0f19] text-white font-bold">4-2-3-1</span>
                                                    </div>
                                                </div>
                                                
                                                {/* Field Map */}
                                                <div className="relative bg-[#0d2a1d] rounded-lg flex-grow overflow-hidden shadow-inner border border-[#166534]/20 p-2 flex flex-col justify-between min-h-[250px]">
                                                    {/* Grass stripes overlay */}
                                                    <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-[0.03]">
                                                        {Array.from({ length: 8 }).map((_, idx) => (
                                                            <div key={idx} className={`h-[35px] w-full ${idx % 2 === 0 ? 'bg-white' : 'bg-transparent'}`} />
                                                        ))}
                                                    </div>

                                                    {/* Pitch markings */}
                                                    <div className="absolute inset-0 border border-white/10 m-1 pointer-events-none">
                                                        <div className="absolute top-1/2 left-0.5 right-0.5 border-t border-white/10" />
                                                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 border border-white/10 rounded-full" />
                                                        <div className="absolute top-0.5 left-1/2 -translate-x-1/2 w-16 h-6 border border-white/10 border-t-0" />
                                                        <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-16 h-6 border border-white/10 border-b-0" />
                                                    </div>

                                                    {/* Goalkeeper (at top) */}
                                                    <div className="flex justify-center w-full relative z-10 pt-1 shrink-0">
                                                        <div className="flex flex-col items-center">
                                                            <div className="w-5 h-5 rounded-full bg-blue-600 border border-white/25 shadow-md flex items-center justify-center text-[8px] font-bold text-white">1</div>
                                                            <span className="text-[7px] font-bold text-white bg-slate-950/80 px-1.5 rounded-full border border-slate-800/80 mt-1">David</span>
                                                        </div>
                                                    </div>

                                                    {/* Defenders */}
                                                    <div className="flex justify-around w-full relative z-10 px-1 shrink-0">
                                                        {[
                                                            { num: 2, name: "Fidel" },
                                                            { num: 5, name: "Ahmad" },
                                                            { num: 4, name: "Junior" },
                                                            { num: 3, name: "John" }
                                                        ].map((p, idx) => (
                                                            <div key={idx} className="flex flex-col items-center">
                                                                <div className="w-5 h-5 rounded-full bg-blue-600 border border-white/25 shadow-md flex items-center justify-center text-[8px] font-bold text-white">{p.num}</div>
                                                                <span className="text-[7px] font-bold text-white bg-slate-950/80 px-1.5 rounded-full border border-slate-800/80 mt-1">{p.name}</span>
                                                            </div>
                                                        ))}
                                                    </div>

                                                    {/* Defensive Midfielders */}
                                                    <div className="flex justify-center gap-10 w-full relative z-10 px-1 shrink-0">
                                                        {[
                                                            { num: 8, name: "Chris" },
                                                            { num: 6, name: "Matthew" }
                                                        ].map((p, idx) => (
                                                            <div key={idx} className="flex flex-col items-center">
                                                                <div className="w-5 h-5 rounded-full bg-blue-600 border border-white/25 shadow-md flex items-center justify-center text-[8px] font-bold text-white">{p.num}</div>
                                                                <span className="text-[7px] font-bold text-white bg-slate-950/80 px-1.5 rounded-full border border-slate-800/80 mt-1">{p.name}</span>
                                                            </div>
                                                        ))}
                                                    </div>

                                                    {/* Attacking Midfielders */}
                                                    <div className="flex justify-around w-full relative z-10 px-1 shrink-0">
                                                        {[
                                                            { num: 7, name: "Oliver" },
                                                            { num: 10, name: "John" },
                                                            { num: 11, name: "Delano" }
                                                        ].map((p, idx) => (
                                                            <div key={idx} className="flex flex-col items-center">
                                                                <div className="w-5 h-5 rounded-full bg-blue-600 border border-white/25 shadow-md flex items-center justify-center text-[8px] font-bold text-white">{p.num}</div>
                                                                <span className="text-[7px] font-bold text-white bg-slate-950/80 px-1.5 rounded-full border border-slate-800/80 mt-1">{p.name}</span>
                                                            </div>
                                                        ))}
                                                    </div>

                                                    {/* Forward (at bottom) */}
                                                    <div className="flex justify-center w-full relative z-10 pb-1 shrink-0">
                                                        <div className="flex flex-col items-center">
                                                            <div className="w-5 h-5 rounded-full bg-blue-600 border border-white/25 shadow-md flex items-center justify-center text-[8px] font-bold text-white">9</div>
                                                            <span className="text-[7px] font-bold text-white bg-slate-950/80 px-1.5 rounded-full border border-slate-800/80 mt-1">Shoaib</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Right Column: Bench */}
                                            <div className="col-span-3 bg-[#121824] border border-slate-800 rounded-xl p-2 flex flex-col overflow-hidden">
                                                <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 mb-1.5 shrink-0 font-extrabold text-[8px] uppercase tracking-wider text-slate-400">
                                                    <span>Bench (5)</span>
                                                    <span className="text-red-500 font-bold text-[7px] cursor-pointer">+ Add Slot</span>
                                                </div>
                                                <div className="space-y-1.5 overflow-y-auto flex-grow pr-0.5">
                                                    {[
                                                        "Sebastian Senna",
                                                        "Lloyd Hucknall",
                                                        "Chris Hall",
                                                        "Sam Ward",
                                                        "Kieran Wood"
                                                    ].map((name, idx) => (
                                                        <div key={idx} className="flex items-center justify-between p-1.5 border border-slate-800 rounded bg-[#0b0f19] leading-tight">
                                                            <div className="flex flex-col overflow-hidden min-w-0 flex-1 mr-1">
                                                                <span className="font-bold text-slate-200 truncate">{idx + 1}. {name}</span>
                                                            </div>
                                                            <span className="text-[6px] bg-slate-900 border border-slate-800 font-bold px-1 py-0.5 rounded text-slate-400 shrink-0">Unused</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {activeTab === 2 && (
                                    <div className="space-y-4 animate-in fade-in duration-200 text-slate-200 text-left text-[10px]">
                                        <div className="flex justify-between items-center border-b border-slate-850 pb-2">
                                            <div>
                                                <h3 className="text-xs font-bold text-white">Squad</h3>
                                                <p className="text-[9px] text-slate-400">View and manage player profiles and stats.</p>
                                            </div>
                                        </div>

                                        {/* Squad Roster Tabs Filter */}
                                        <div className="flex space-x-1 border-b border-slate-850 pb-1 text-[9px] font-semibold text-slate-550">
                                            <span className="px-2.5 py-0.5 bg-red-950/45 text-red-500 rounded border border-red-500/25 cursor-pointer">First Team</span>
                                            <span className="px-2.5 py-0.5 hover:text-slate-350 cursor-pointer">Midweek</span>
                                            <span className="px-2.5 py-0.5 hover:text-slate-350 cursor-pointer">Youth</span>
                                        </div>

                                        {/* Grid of styled Player Cards matching player-card.tsx without avatars! */}
                                        <div className="grid grid-cols-4 gap-3">
                                            {[
                                                { name: "David Brown", pos: "GK", age: 29, border: "border-red-500", status: "Available", badge: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
                                                { name: "Mohammed Khan", pos: "GK", age: 28, border: "border-red-500", status: "Available", badge: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
                                                { name: "Sebastian Senna", pos: "GK", age: 32, border: "border-amber-500", status: "Injured", badge: "bg-rose-500/20 text-rose-400 border-rose-500/30" },
                                                { name: "John Davis", pos: "LB", age: 22, border: "border-blue-500", status: "Holiday", badge: "bg-blue-500/20 text-blue-400 border-blue-500/30" }
                                            ].map((p, idx) => (
                                                <div key={idx} className={`rounded-xl overflow-hidden border-2 bg-slate-950 ${p.border} flex flex-col p-2.5 text-center text-white relative pt-8`}>
                                                    <span className={`absolute top-1.5 right-1.5 text-[7px] font-black px-1.5 py-0.5 border rounded ${p.badge}`}>{p.status}</span>
                                                    <h4 className="font-extrabold text-[10px] text-white mt-1.5 leading-none">{p.name}</h4>
                                                    <span className="text-[8px] text-slate-400 block mb-2">{p.pos} • First Team • {p.age} yo</span>
                                                    <div className="border-t border-slate-900 pt-2 flex justify-around text-[9px] mt-auto">
                                                        <div>
                                                            <span className="text-slate-550 text-[8px] block leading-none">Apps</span>
                                                            <span className="font-bold text-white">0</span>
                                                        </div>
                                                        <div>
                                                            <span className="text-slate-550 text-[8px] block leading-none">Goals</span>
                                                            <span className="font-bold text-white">0</span>
                                                        </div>
                                                        <div>
                                                            <span className="text-slate-550 text-[8px] block leading-none">Assists</span>
                                                            <span className="font-bold text-white">0</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {activeTab === 3 && (
                                    <div className="space-y-4 animate-in fade-in duration-200 text-slate-200 text-left text-[10px]">
                                        <div className="flex justify-between items-center border-b border-slate-850 pb-2">
                                            <div>
                                                <h3 className="text-xs font-black text-white tracking-tight flex items-center gap-1.5">
                                                    <Wallet className="h-4 w-4 text-red-500" />
                                                    Player Payments
                                                </h3>
                                                <p className="text-[9px] text-slate-400 leading-none mt-0.5">Manage subscriptions, match fees, and collect card payments.</p>
                                            </div>
                                        </div>

                                        {/* Stripe Connect Connected Banner */}
                                        <div className="border border-emerald-500/20 bg-emerald-500/5 rounded-xl p-2.5 flex justify-between items-center text-[9px] text-emerald-300">
                                            <div className="flex items-center gap-2">
                                                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                                                <div>
                                                    <p className="font-bold text-white leading-none">Stripe Connect Connected</p>
                                                    <p className="text-[8px] text-emerald-400/80 mt-1">Active to collect secure credit card and mobile wallet payments.</p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Invoices List Table */}
                                        <div className="bg-[#121824] border border-slate-850 rounded-xl overflow-hidden shadow-sm text-[9px]">
                                            <div className="bg-slate-900 px-3 py-2 font-bold text-slate-500 border-b border-slate-850 flex justify-between uppercase tracking-wider text-[8px]">
                                                <span className="w-1/3">Player</span>
                                                <span className="w-1/3 text-center">Amount</span>
                                                <span className="w-1/3 text-right">Status</span>
                                            </div>
                                            <div className="divide-y divide-slate-850">
                                                <div className="px-3 py-2 flex justify-between items-center bg-[#0b0f19]/30">
                                                    <span className="w-1/3 font-semibold text-slate-300">Liam Johnson</span>
                                                    <span className="w-1/3 text-center font-bold text-white">£150.00</span>
                                                    <span className="w-1/3 text-right"><span className="px-2 py-0.5 rounded-full text-[8px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Paid</span></span>
                                                </div>
                                                <div className="px-3 py-2 flex justify-between items-center bg-[#0b0f19]/30">
                                                    <span className="w-1/3 font-semibold text-slate-300">Harry Norling</span>
                                                    <span className="w-1/3 text-center font-bold text-white">£150.00</span>
                                                    <span className="w-1/3 text-right"><span className="px-2 py-0.5 rounded-full text-[8px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">Unpaid</span></span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {activeTab === 4 && (
                                    <div className="space-y-4 animate-in fade-in duration-200 text-slate-200 text-left text-[10px]">
                                        <div className="flex justify-between items-center border-b border-slate-850 pb-2">
                                            <div>
                                                <h3 className="text-xs font-bold text-white">Training</h3>
                                                <p className="text-[9px] text-slate-400">Manage sessions and track attendance.</p>
                                            </div>
                                        </div>

                                        {/* Tabs Selector preview */}
                                        <div className="flex bg-[#121824] p-0.5 rounded-lg text-[8px] w-max font-medium text-slate-500 border border-slate-850">
                                            <span className="px-2 py-0.5 bg-[#0b0f19] text-white rounded font-bold cursor-pointer border border-slate-800">Sessions</span>
                                            <span className="px-2 py-0.5 hover:text-white cursor-pointer">Training Attendance</span>
                                        </div>

                                        {/* Training Session Card matching training/page.tsx */}
                                        <div className="bg-[#121824] hover:shadow-md border border-slate-800 border-l-4 border-l-red-500 rounded-xl p-3 space-y-2">
                                            <div className="flex justify-between items-start">
                                                <span className="px-2 py-0.5 border border-slate-800 text-[8px] font-bold rounded bg-[#0b0f19] text-slate-400">First Team Squad</span>
                                            </div>
                                            <h4 className="font-extrabold text-xs text-white leading-none">Tuesday Night Tactical Drills</h4>
                                            <p className="text-[8px] text-slate-400 flex items-center gap-1">
                                                <CalendarDays className="h-3 w-3 text-slate-500" /> Tue 15 Jul • 20:15 - 22:00
                                            </p>
                                            <div className="space-y-1.5 pt-2 border-t border-slate-850 text-[8px] text-slate-400">
                                                <p className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-slate-500" /> Regent's Park Astro</p>
                                                <p className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5 text-slate-550" /> 26 / 28 (92%) squad players</p>
                                            </div>
                                            <button type="button" className="w-full bg-red-650 hover:bg-red-700 text-white font-bold text-[8px] py-1.5 rounded-lg mt-2 transition-all">
                                                Manage Session
                                            </button>
                                        </div>
                                    </div>
                                )}
                        </div>
                    </div>
                )}
                </div>

                {/* Footer */}
                <div className="flex items-center gap-4 text-xs text-slate-500 border-t border-slate-900 pt-6">
                    <span className="flex items-center gap-1.5">
                        <CheckCircle2 className="h-4 w-4 text-red-500/80" /> Used by coaches, treasurers &amp; club committees
                    </span>
                </div>
            </div>

            {/* Right Column (Auth Panel) */}
            <div className="w-full md:w-[35%] lg:w-[28%] xl:w-[25%] flex flex-col justify-center items-center p-6 md:p-12 relative z-10 bg-slate-950 border-l border-slate-900/60 shrink-0">
                {/* Mobile Header Branding */}
                <div className="flex flex-col items-center mb-8 text-center md:hidden">
                    <Image src="/clubflow-logo.png" alt="ClubFlow" width={240} height={160} className="object-contain mb-2" />
                    <p className="text-red-500 text-[10px] font-bold tracking-widest uppercase mb-2">
                        from stadium to spreadsheet
                    </p>
                    <h1 className="text-2xl font-bold tracking-tight text-white">
                        Welcome back.
                    </h1>
                    <p className="text-slate-400 text-sm mt-1">
                        Access your ClubFlow workspace.
                    </p>
                </div>

                {/* Desktop Microcopy Header */}
                <div className="hidden md:flex flex-col items-center text-center mb-6">
                    <h2 className="text-xl font-bold text-white tracking-tight">Welcome back.</h2>
                    <p className="text-slate-500 text-xs mt-1">Access your ClubFlow workspace.</p>
                </div>

                {/* Premium Glassmorphic Login Card */}
                <Card className="w-full max-w-md border-slate-800/80 bg-slate-900/40 backdrop-blur-md shadow-2xl rounded-2xl">
                    <CardHeader className="space-y-1 pb-4">
                        <CardTitle className="text-xl text-center text-white">Sign In</CardTitle>
                        <CardDescription className="text-center text-slate-400 text-xs">
                            Enter your credentials to manage your club
                        </CardDescription>
                    </CardHeader>
                    
                    <form onSubmit={handleLogin}>
                        <CardContent className="space-y-4">
                            {error && (
                                <Alert variant="destructive" className="bg-red-950/50 border-red-900 text-red-400 rounded-xl">
                                    <AlertCircle className="h-4 w-4" />
                                    <AlertDescription>{error}</AlertDescription>
                                </Alert>
                            )}
                            
                            <div className="space-y-2">
                                <Label htmlFor="email" className="text-slate-300 text-xs font-semibold">Account Email</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="you@clubflow.org.uk"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    className="bg-slate-950/80 border-slate-800 text-white placeholder:text-slate-600 focus-visible:ring-red-500 rounded-xl h-11 text-sm transition-all focus:border-red-500/50"
                                />
                            </div>
                            
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="password" className="text-slate-300 text-xs font-semibold">Password</Label>
                                    <Link href="/reset-password" className="text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors">
                                        Forgot password?
                                    </Link>
                                </div>
                                <Input
                                    id="password"
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    className="bg-slate-950/80 border-slate-800 text-white focus-visible:ring-red-500 rounded-xl h-11 text-sm transition-all focus:border-red-500/50"
                                />
                            </div>
                        </CardContent>
                        
                        <CardFooter className="flex flex-col space-y-4 pt-2">
                            <Button 
                                type="submit" 
                                className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold h-11 rounded-xl shadow-lg shadow-red-900/20 transition-all hover:translate-y-[-1px] active:translate-y-[0px]" 
                                disabled={loading}
                            >
                                {loading ? "Signing in..." : (
                                    <>
                                        <Lock className="mr-2 h-4 w-4" /> Sign In
                                    </>
                                )}
                            </Button>
                            
                            <div className="text-xs text-slate-400 text-center">
                                Don't have a club account?{" "}
                                <Link href="/signup" className="text-red-400 hover:text-red-300 font-semibold transition-colors">
                                    Sign Up
                                </Link>
                            </div>
                        </CardFooter>
                    </form>
                </Card>
            </div>
        </div>
    );
}
