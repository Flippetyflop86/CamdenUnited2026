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
            <div className="hidden md:flex md:w-[65%] lg:w-[72%] xl:w-[75%] flex-col justify-between p-12 lg:p-16 relative z-10 bg-gradient-to-br from-slate-950 via-slate-950 to-slate-900/40">

                {/* Top spacer / top-left wordmark (text only — logo image carries the brand) */}
                <div className="flex items-center gap-2">
                    <span className="text-sm font-extrabold tracking-widest text-red-500 uppercase">Club<span className="text-white">Flow</span></span>
                    <span className="h-1 w-1 rounded-full bg-red-500" />
                    <span className="text-xs text-slate-500 tracking-wide">Club Management Platform</span>
                </div>

                {/* HERO: Interactive Product Tour */}
                <div className="my-auto flex flex-col items-start text-left space-y-8 w-full max-w-5xl mx-auto">
                    
                    <div className="space-y-3">
                        <span className="text-[9px] font-bold tracking-widest text-red-500 uppercase bg-red-500/10 px-2.5 py-1 rounded-full border border-red-500/20">
                            01 Product Tour
                        </span>
                        <h2 className="text-3xl lg:text-4xl font-black tracking-tight text-white leading-tight">
                            Take a Tour of ClubFlow
                        </h2>
                        <p className="text-slate-400 text-sm leading-relaxed max-w-xl">
                            ClubFlow is the complete digital headquarters for football clubs. Explore the five core workspaces built to manage players, matches, statistics, and club finances in one place. Click a tab to preview.
                        </p>
                    </div>

                    {/* Pill Switcher */}
                    <div className="flex flex-wrap gap-3 w-full">
                        {tourTabs.map((tab, idx) => (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => setActiveTab(idx)}
                                className={`px-5 py-2.5 rounded-full text-xs font-semibold tracking-wide transition-all duration-200 border ${
                                    activeTab === idx
                                        ? "bg-white text-slate-950 border-white shadow-lg font-bold scale-[1.02]"
                                        : "bg-slate-900/60 text-slate-450 border-slate-800 hover:border-slate-700 hover:text-white hover:bg-slate-800/40"
                                }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Tab description text */}
                    <p className="text-slate-350 text-xs leading-relaxed max-w-xl min-h-[36px]">
                        {tourTabs[activeTab].description}
                    </p>                    <div className="w-full relative rounded-xl overflow-hidden border border-[#1f293d]/55 bg-[#0b0f19] backdrop-blur-sm transition-all duration-300 shadow-2xl shadow-black/90">
                        {/* Subtle Browser Header Bar */}
                        <div className="h-8 bg-[#121824] border-b border-[#1f293d]/40 px-4 flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                                <span className="h-2 w-2 rounded-full bg-[#ff5f56]/80 inline-block" />
                                <span className="h-2 w-2 rounded-full bg-[#ffbd2e]/80 inline-block" />
                                <span className="h-2 w-2 rounded-full bg-[#27c93f]/80 inline-block" />
                            </div>
                            <div className="bg-[#0b0f19] border border-[#1f293d]/70 px-3.5 py-0.5 rounded text-[9px] text-slate-400 font-mono tracking-wide w-48 text-center truncate select-all">
                                app.clubflow.com/{tourTabs[activeTab].id}
                            </div>
                            <div className="w-10" /> {/* Spacer */}
                        </div>

                        {/* Browser Viewport Content Area */}
                        <div className={`bg-[#0b0f19] text-slate-100 min-h-[460px] overflow-hidden flex flex-col justify-start text-left relative ${(activeTab === 3 || activeTab === 0) ? 'p-6' : 'p-0'}`}>
                            {activeTab === 0 && (
                                <div className="space-y-4 animate-in fade-in duration-200 text-gray-200 text-left text-[9px] bg-[#030712] p-5 rounded-xl border border-gray-900 w-full">
                                    {/* Mockup Header */}
                                    <div className="flex justify-between items-center border-b border-gray-800 pb-2.5">
                                        <div className="flex items-center gap-2">
                                            <div className="h-6 w-6 rounded-lg bg-slate-950 border border-gray-850 flex items-center justify-center font-bold text-red-500 text-[10px]">
                                                CU
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-1.5">
                                                    <h3 className="text-[10px] font-black text-white leading-none">ClubFlow United</h3>
                                                    <span className="bg-red-550/15 text-red-400 border border-red-500/20 text-[7px] uppercase tracking-wider font-extrabold px-1.5 py-0.5 rounded">
                                                        Operations Command Centre
                                                    </span>
                                                </div>
                                                <p className="text-gray-405 text-[8px] mt-0.5">Squad Management &amp; Operational Analytics</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Three Mini Cards */}
                                    <div className="grid gap-2 grid-cols-3">
                                        <div className="bg-[#0b0f19] border border-gray-850 p-2 rounded-lg space-y-1">
                                            <span className="text-[7px] font-bold uppercase text-gray-400">Squad Availability</span>
                                            <div className="text-[9px] font-black text-white">33 / 36 Available (92%)</div>
                                        </div>
                                        <div className="bg-[#0b0f19] border border-gray-850 p-2 rounded-lg space-y-1">
                                            <span className="text-[7px] font-bold uppercase text-gray-400">Registration Alerts</span>
                                            <div className="text-[9px] font-black text-amber-400">2 Outstanding</div>
                                        </div>
                                        <div className="bg-[#0b0f19] border border-gray-850 p-2 rounded-lg space-y-1">
                                            <span className="text-[7px] font-bold uppercase text-gray-400">Unpaid Invoices</span>
                                            <div className="text-[9px] font-black text-red-405">£450.00</div>
                                        </div>
                                    </div>

                                    {/* Core Layout Grid */}
                                    <div className="grid gap-3 grid-cols-7">
                                        {/* Left Side: Next Fixture & Starting XI (4 spans) */}
                                        <div className="col-span-4 space-y-3">
                                            <div className="bg-[#0b0f19] border border-gray-850 p-2 rounded-lg space-y-2">
                                                <span className="text-[8px] font-bold uppercase text-white">Next Fixture</span>
                                                <div className="bg-slate-950 p-2 rounded-lg border border-gray-850 flex justify-between items-center text-[8px]">
                                                    <div>
                                                        <span className="font-bold text-white">vs Western Athletic</span>
                                                        <div className="text-[7px] text-gray-400 mt-0.5">Isthmian League • 🌱 Natural Grass</div>
                                                    </div>
                                                    <span className="text-white font-bold">16 Jul • 14:00</span>
                                                </div>
                                            </div>

                                            <div className="bg-[#0b0f19] border border-gray-850 p-2 rounded-lg space-y-2">
                                                <span className="text-[8px] font-bold uppercase text-white font-semibold">Starting Selection XI</span>
                                                
                                                {/* Pitch mock map */}
                                                <div className="relative bg-emerald-950/80 rounded-lg h-[160px] border border-emerald-900/60 overflow-hidden p-1">
                                                    {/* GK */}
                                                    <div className="absolute top-1 left-1/2 -translate-x-1/2 flex flex-col items-center">
                                                        <div className="w-3.5 h-3.5 rounded-full bg-orange-600 border border-white/20 flex items-center justify-center text-[6px] text-white">1</div>
                                                        <span className="text-[5px] text-white bg-slate-950/85 px-1 rounded mt-0.5">David</span>
                                                    </div>
                                                    {/* DEF */}
                                                    <div className="absolute top-[35%] left-0 right-0 flex justify-around px-4">
                                                        <div className="flex flex-col items-center">
                                                            <div className="w-3.5 h-3.5 rounded-full bg-red-600 border border-white/20 flex items-center justify-center text-[6px] text-white">2</div>
                                                            <span className="text-[5px] text-white bg-slate-950/85 px-1 rounded mt-0.5">Fidel</span>
                                                        </div>
                                                        <div className="flex flex-col items-center">
                                                            <div className="w-3.5 h-3.5 rounded-full bg-red-600 border border-white/20 flex items-center justify-center text-[6px] text-white">5</div>
                                                            <span className="text-[5px] text-white bg-slate-950/85 px-1 rounded mt-0.5">Ahmad</span>
                                                        </div>
                                                        <div className="flex flex-col items-center">
                                                            <div className="w-3.5 h-3.5 rounded-full bg-red-600 border border-white/20 flex items-center justify-center text-[6px] text-white">3</div>
                                                            <span className="text-[5px] text-white bg-slate-950/85 px-1 rounded mt-0.5">John</span>
                                                        </div>
                                                    </div>
                                                    {/* MID */}
                                                    <div className="absolute top-[60%] left-0 right-0 flex justify-around px-6">
                                                        <div className="flex flex-col items-center">
                                                            <div className="w-3.5 h-3.5 rounded-full bg-red-650 border border-white/20 flex items-center justify-center text-[6px] text-white">8</div>
                                                            <span className="text-[5px] text-white bg-slate-950/85 px-1 rounded mt-0.5">Chris</span>
                                                        </div>
                                                        <div className="flex flex-col items-center">
                                                            <div className="w-3.5 h-3.5 rounded-full bg-red-650 border border-white/20 flex items-center justify-center text-[6px] text-white">7</div>
                                                            <span className="text-[5px] text-white bg-slate-950/85 px-1 rounded mt-0.5">Oliver</span>
                                                        </div>
                                                    </div>
                                                    {/* FWD */}
                                                    <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex flex-col items-center">
                                                        <div className="w-3.5 h-3.5 rounded-full bg-red-650 border border-white/20 flex items-center justify-center text-[6px] text-white">9</div>
                                                        <span className="text-[5px] text-white bg-slate-950/85 px-1 rounded mt-0.5">Shoaib</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Right Side: Performance Metrics & Contributors (3 spans) */}
                                        <div className="col-span-3 space-y-3">
                                            <div className="bg-[#0b0f19] border border-gray-850 p-2 rounded-lg space-y-2">
                                                <span className="text-[8px] font-bold uppercase text-white">Performance Metrics</span>
                                                <div className="bg-slate-950 p-2 rounded-lg border border-gray-850 space-y-1">
                                                    <span className="text-[8px] text-gray-400 block uppercase font-bold">Training Attendance Tracking</span>
                                                    <div className="text-[11px] font-black text-white leading-none">92%</div>
                                                    <span className="text-[7px] text-gray-400 block mt-0.5">Last session: 15 Jul • Tactical Drills</span>
                                                </div>
                                            </div>

                                            <div className="bg-[#0b0f19] border border-gray-850 p-2 rounded-lg space-y-2">
                                                <span className="text-[8px] font-bold uppercase text-white font-semibold">Squad Contributors</span>
                                                <div className="space-y-1">
                                                    <span className="text-[7px] font-bold text-gray-400 block">⚽ Top Goalscorers</span>
                                                    <div className="bg-slate-950 px-2 py-1 rounded border border-gray-850 flex justify-between text-[7px] font-semibold text-gray-200">
                                                        <span>Liam Johnson</span>
                                                        <span className="text-red-500 font-bold">12 Goals</span>
                                                    </div>
                                                    <div className="bg-slate-950 px-2 py-1 rounded border border-gray-850 flex justify-between text-[7px] font-semibold text-gray-200">
                                                        <span>Harry Norling</span>
                                                        <span className="text-red-500 font-bold">8 Goals</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                            {activeTab === 1 && (
                                <img 
                                    src="/matchday-xi-screenshot.png" 
                                    alt="Matchday XI & Tactics" 
                                    className="w-full h-auto select-none object-contain animate-in fade-in duration-200"
                                    style={{ imageRendering: "-webkit-optimize-contrast" }}
                                />
                            )}
                            {activeTab === 2 && (
                                <img 
                                    src="/squad-management-screenshot.png" 
                                    alt="Squad Management" 
                                    className="w-full h-auto select-none object-contain animate-in fade-in duration-200"
                                    style={{ imageRendering: "-webkit-optimize-contrast" }}
                                />
                            )}
                            {activeTab === 3 && (
                                <div className="space-y-4 animate-in fade-in duration-200 text-slate-200 text-left text-[10px]">
                                    <div className="flex justify-between items-center border-b border-[#1f293d] pb-2">
                                        <div>
                                            <h3 className="text-xs font-black text-white tracking-tight flex items-center gap-1.5">
                                                <Wallet className="h-4 w-4 text-red-500" />
                                                Player Payments
                                            </h3>
                                            <p className="text-[9px] text-slate-450 leading-none mt-0.5">Manage subscriptions, match fees, and collect card payments.</p>
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
                                        <div className="bg-slate-900 px-3 py-2 font-bold text-slate-500 border-b border-[#1f293d] flex justify-between uppercase tracking-wider text-[8px]">
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
                                <img 
                                    src="/training-tracking-screenshot.png" 
                                    alt="Training Tracker" 
                                    className="w-full h-auto select-none object-contain animate-in fade-in duration-200"
                                    style={{ imageRendering: "-webkit-optimize-contrast" }}
                                />
                            )}
                        </div>
                    </div>                 </div>

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
