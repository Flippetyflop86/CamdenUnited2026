"use client";

import { useState } from "react";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Lock, CheckCircle2, LayoutDashboard, Users, Calendar, CreditCard, Activity, Trophy, Clock, Check, AlertTriangle, ArrowRight, DollarSign, Sparkles, TrendingUp } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import Link from "next/link";

export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [activeTab, setActiveTab] = useState(0);
    const [loading, setLoading] = useState(false);
    const router = useRouter();

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
                
                <svg className="absolute w-full h-full text-slate-700 stroke-current opacity-[0.04]" fill="none" strokeWidth="1.5">
                    {/* Center circle */}
                    <circle cx="50%" cy="50%" r="150" strokeDasharray="6 6" />
                    <circle cx="50%" cy="50%" r="5" fill="currentColor" />
                    
                    {/* Halfway line */}
                    <line x1="0" y1="50%" x2="100%" y2="50%" />
                    
                    {/* Penalty box at top */}
                    <rect x="calc(50% - 250px)" y="0" width="500" height="200" />
                    <rect x="calc(50% - 100px)" y="0" width="200" height="70" />
                    <path d="M calc(50% - 80px) 200 A 80 80 0 0 0 calc(50% + 80px) 200" strokeDasharray="4 4" />
                    
                    {/* Penalty box at bottom */}
                    <rect x="calc(50% - 250px)" y="calc(100% - 200px)" width="500" height="200" />
                    <rect x="calc(50% - 100px)" y="calc(100% - 70px)" width="200" height="70" />
                    <path d="M calc(50% - 80px) calc(100% - 200px) A 80 80 0 0 1 calc(50% + 80px) calc(100% - 200px)" strokeDasharray="4 4" />
                    
                    {/* Tactical arrows / paths with animating classes */}
                    <path d="M 20% 30% Q 30% 20% 45% 35%" className="tactical-flow-1" markerEnd="url(#arrow)" />
                    <path d="M 80% 40% Q 65% 30% 55% 45%" className="tactical-flow-2" markerEnd="url(#arrow)" />
                    <path d="M 30% 70% Q 40% 60% 50% 52%" className="tactical-flow-3" markerEnd="url(#arrow)" stroke="#ef4444" strokeWidth="2" />
                    <path d="M 60% 80% Q 75% 75% 85% 60%" className="tactical-flow-1" markerEnd="url(#arrow)" />

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
            <div className="hidden md:flex md:w-[50%] lg:w-[55%] flex-col justify-between p-10 lg:p-14 relative z-10 border-r border-slate-900/60 bg-gradient-to-br from-slate-950 via-slate-950 to-slate-900/40">

                {/* Top spacer / top-left wordmark (text only — logo image carries the brand) */}
                <div className="flex items-center gap-2">
                    <span className="text-sm font-extrabold tracking-widest text-red-500 uppercase">Club<span className="text-white">Flow</span></span>
                    <span className="h-1 w-1 rounded-full bg-red-500" />
                    <span className="text-xs text-slate-500 tracking-wide">Club Management Platform</span>
                </div>

                {/* HERO: Interactive Product Tour */}
                <div className="my-auto flex flex-col items-start text-left space-y-6 w-full max-w-2xl mx-auto">
                    
                    <div className="space-y-2">
                        <span className="text-[10px] font-bold tracking-widest text-red-500 uppercase">
                            01 PRODUCT TOUR
                        </span>
                        <h2 className="text-2xl lg:text-3xl font-black tracking-tight text-white">
                            This is what it looks like.
                        </h2>
                        <p className="text-slate-400 text-sm leading-relaxed max-w-xl">
                            Five key screens that cover the daily running of a successful football club. Click a tab to preview.
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

                    {/* Web Browser Frame Container */}
                    <div className="w-full relative rounded-2xl overflow-hidden border border-slate-800/80 shadow-2xl shadow-red-950/20 bg-slate-950/60 backdrop-blur-sm transition-all duration-300">
                        {/* Browser Header Bar */}
                        <div className="h-10 bg-slate-900/80 border-b border-slate-800/80 px-4 flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                                <span className="h-3 w-3 rounded-full bg-red-500/80 inline-block" />
                                <span className="h-3 w-3 rounded-full bg-yellow-500/80 inline-block" />
                                <span className="h-3 w-3 rounded-full bg-green-500/80 inline-block" />
                            </div>
                            <div className="bg-slate-950/60 px-3 py-1 rounded-md text-[10px] text-slate-500 font-mono tracking-wide w-48 text-center truncate">
                                app.clubflow.org.uk/{tourTabs[activeTab].id}
                            </div>
                            <div className="w-10" /> {/* Spacer */}
                        </div>

                        {/* Browser Viewport Content Area */}
                        <div className="p-4 bg-slate-950/80 min-h-[280px] text-white overflow-hidden flex flex-col justify-start">
                            {activeTab === 0 && (
                                <div className="space-y-4 animate-in fade-in duration-200">
                                    {/* Dashboard Preview */}
                                    <div className="flex items-center justify-between border-b border-slate-800/60 pb-3">
                                        <div className="flex items-center gap-2">
                                            <LayoutDashboard className="h-4 w-4 text-red-500" />
                                            <span className="text-xs font-bold text-slate-200">Dashboard Hub</span>
                                        </div>
                                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-950/50 text-red-400 border border-red-900/30">First Team</span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="bg-slate-900/60 border border-slate-800/50 p-3 rounded-xl space-y-1">
                                            <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider block">Squad Roster</span>
                                            <div className="flex items-baseline gap-2">
                                                <span className="text-xl font-extrabold text-white">28</span>
                                                <span className="text-[10px] text-green-500">24 Fit</span>
                                            </div>
                                            <span className="text-[9px] text-slate-500 block">4 on medical / holidays</span>
                                        </div>
                                        <div className="bg-slate-900/60 border border-slate-800/50 p-3 rounded-xl space-y-1">
                                            <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider block">Avg Attendance</span>
                                            <div className="flex items-baseline gap-2">
                                                <span className="text-xl font-extrabold text-white">88%</span>
                                                <span className="text-[10px] text-slate-400">Monthly</span>
                                            </div>
                                            <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                                                <div className="bg-red-500 h-full rounded-full" style={{ width: "88%" }} />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="bg-slate-900/60 border border-slate-800/50 p-3 rounded-xl space-y-2">
                                        <div className="flex justify-between items-center text-[10px]">
                                            <span className="text-slate-400 font-bold uppercase tracking-wider">Next Match</span>
                                            <span className="text-red-400 font-semibold flex items-center gap-1"><Clock className="h-3 w-3" /> Meet: 18:30</span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <div className="h-6 w-6 rounded-full bg-red-700 flex items-center justify-center text-[10px] font-bold text-white border border-red-500">CU</div>
                                                <span className="text-xs font-bold text-slate-200">Camden Utd</span>
                                            </div>
                                            <span className="text-[10px] font-bold text-slate-500">VS</span>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-bold text-slate-200">Hackney FC</span>
                                                <div className="h-6 w-6 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-400">HF</div>
                                            </div>
                                        </div>
                                        <div className="text-[9px] text-slate-400 text-center border-t border-slate-800/80 pt-2">
                                            Saturday, 19:30 • Regent's Park Pitch 3 • League Match
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 1 && (
                                <div className="space-y-3 animate-in fade-in duration-200 flex-1 flex flex-col">
                                    {/* Matchday XI Tactics Preview */}
                                    <div className="flex items-center justify-between border-b border-slate-800/60 pb-2">
                                        <div className="flex items-center gap-2">
                                            <Trophy className="h-4 w-4 text-red-500" />
                                            <span className="text-xs font-bold text-slate-200">Matchday XI Tactics</span>
                                        </div>
                                        <span className="text-[9px] px-2 py-0.5 rounded-full bg-slate-900 text-slate-300 border border-slate-800">Formation: 4-3-3</span>
                                    </div>
                                    
                                    {/* Pitch representation */}
                                    <div className="relative bg-emerald-950/70 border border-emerald-800/50 rounded-xl flex-1 min-h-[190px] overflow-hidden flex flex-col justify-between p-2">
                                        {/* Field markings */}
                                        <div className="absolute inset-0 pointer-events-none opacity-20 flex flex-col justify-between border border-white">
                                            <div className="h-8 border-b border-white w-24 mx-auto" />
                                            <div className="w-full border-b border-white" />
                                            <div className="h-8 border-t border-white w-24 mx-auto" />
                                        </div>
                                        
                                        {/* Forwards (3) */}
                                        <div className="flex justify-around w-full relative z-10 pt-2">
                                            <div className="flex flex-col items-center">
                                                <div className="h-6 w-6 rounded-full bg-slate-950 border border-red-500 flex items-center justify-center text-[9px] font-bold text-white shadow-md shadow-slate-950/50">11</div>
                                                <span className="text-[8px] bg-slate-900/90 text-white px-1 py-0.5 rounded mt-1 font-bold">M. Lindholm</span>
                                            </div>
                                            <div className="flex flex-col items-center">
                                                <div className="h-6 w-6 rounded-full bg-red-600 border border-white flex items-center justify-center text-[9px] font-bold text-white shadow-md shadow-slate-950/50">9</div>
                                                <span className="text-[8px] bg-slate-900/90 text-white px-1 py-0.5 rounded mt-1 font-bold">M. Abdalla</span>
                                            </div>
                                            <div className="flex flex-col items-center">
                                                <div className="h-6 w-6 rounded-full bg-slate-950 border border-red-500 flex items-center justify-center text-[9px] font-bold text-white shadow-md shadow-slate-950/50">7</div>
                                                <span className="text-[8px] bg-slate-900/90 text-white px-1 py-0.5 rounded mt-1 font-bold">E. Sandell</span>
                                            </div>
                                        </div>

                                        {/* Midfielders (3) */}
                                        <div className="flex justify-around w-full relative z-10 py-1">
                                            <div className="flex flex-col items-center">
                                                <div className="h-6 w-6 rounded-full bg-slate-950 border border-red-500 flex items-center justify-center text-[9px] font-bold text-white shadow-md shadow-slate-950/50">8</div>
                                                <span className="text-[8px] bg-slate-900/90 text-white px-1 py-0.5 rounded mt-1 font-bold">D. Forsberg</span>
                                            </div>
                                            <div className="flex flex-col items-center">
                                                <div className="h-6 w-6 rounded-full bg-slate-950 border border-red-500 flex items-center justify-center text-[9px] font-bold text-white shadow-md shadow-slate-950/50">6</div>
                                                <span className="text-[8px] bg-slate-900/90 text-white px-1 py-0.5 rounded mt-1 font-bold">S. Tahir</span>
                                            </div>
                                            <div className="flex flex-col items-center">
                                                <div className="h-6 w-6 rounded-full bg-slate-950 border border-red-500 flex items-center justify-center text-[9px] font-bold text-white shadow-md shadow-slate-950/50">10</div>
                                                <span className="text-[8px] bg-slate-900/90 text-white px-1 py-0.5 rounded mt-1 font-bold">H. Norling</span>
                                            </div>
                                        </div>

                                        {/* Defenders (4) */}
                                        <div className="flex justify-between w-full px-4 relative z-10 py-1">
                                            <div className="flex flex-col items-center">
                                                <div className="h-6 w-6 rounded-full bg-slate-950 border border-red-500 flex items-center justify-center text-[9px] font-bold text-white shadow-md shadow-slate-950/50">3</div>
                                                <span className="text-[8px] bg-slate-900/90 text-white px-1 py-0.5 rounded mt-1 font-bold">L. Johnson</span>
                                            </div>
                                            <div className="flex justify-around w-1/2">
                                                <div className="flex flex-col items-center">
                                                    <div className="h-6 w-6 rounded-full bg-slate-950 border border-red-500 flex items-center justify-center text-[9px] font-bold text-white shadow-md shadow-slate-950/50">4</div>
                                                    <span className="text-[8px] bg-slate-900/90 text-white px-1 py-0.5 rounded mt-1 font-bold">A. Bergström</span>
                                                </div>
                                                <div className="flex flex-col items-center">
                                                    <div className="h-6 w-6 rounded-full bg-slate-950 border border-red-500 flex items-center justify-center text-[9px] font-bold text-white shadow-md shadow-slate-950/50">5</div>
                                                    <span className="text-[8px] bg-slate-900/90 text-white px-1 py-0.5 rounded mt-1 font-bold">M. Evans</span>
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-center">
                                                <div className="h-6 w-6 rounded-full bg-slate-950 border border-red-500 flex items-center justify-center text-[9px] font-bold text-white shadow-md shadow-slate-950/50">2</div>
                                                <span className="text-[8px] bg-slate-900/90 text-white px-1 py-0.5 rounded mt-1 font-bold">J. Lindgren</span>
                                            </div>
                                        </div>

                                        {/* Goalkeeper (1) */}
                                        <div className="flex justify-center w-full relative z-10 pb-1">
                                            <div className="flex flex-col items-center">
                                                <div className="h-6 w-6 rounded-full bg-yellow-500 border border-white flex items-center justify-center text-[9px] font-bold text-slate-950 shadow-md shadow-slate-950/50">1</div>
                                                <span className="text-[8px] bg-slate-900/90 text-white px-1 py-0.5 rounded mt-1 font-bold">K. Nilsson</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 2 && (
                                <div className="space-y-3 animate-in fade-in duration-200">
                                    {/* Squad Registry Preview */}
                                    <div className="flex items-center justify-between border-b border-slate-800/60 pb-2">
                                        <div className="flex items-center gap-2">
                                            <Users className="h-4 w-4 text-red-500" />
                                            <span className="text-xs font-bold text-slate-200">Squad Registry</span>
                                        </div>
                                        <span className="text-[9px] px-2 py-0.5 rounded-full bg-red-950/50 text-red-400 border border-red-900/30 font-mono">28 Rostered</span>
                                    </div>
                                    
                                    <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                                        {/* Player Rows */}
                                        <div className="flex items-center justify-between bg-slate-900/60 border border-slate-800/50 p-2 rounded-xl text-xs">
                                            <div className="flex items-center gap-2">
                                                <div className="h-6 w-6 rounded-full bg-red-650 flex items-center justify-center text-[10px] font-bold text-white">MA</div>
                                                <div>
                                                    <p className="font-bold text-slate-200">Mohamed Abdalla</p>
                                                    <span className="text-[9px] text-slate-400">Striker (ST)</span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <div className="text-right">
                                                    <span className="text-[9px] text-slate-500 block uppercase font-mono">Goals</span>
                                                    <span className="font-extrabold text-white">14</span>
                                                </div>
                                                <span className="text-[9px] px-2 py-0.5 rounded-full bg-green-950/50 text-green-400 border border-green-900/30">Available</span>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between bg-slate-900/60 border border-slate-800/50 p-2 rounded-xl text-xs">
                                            <div className="flex items-center gap-2">
                                                <div className="h-6 w-6 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-400">ST</div>
                                                <div>
                                                    <p className="font-bold text-slate-200">Said Tahir</p>
                                                    <span className="text-[9px] text-slate-400">Midfield (CM)</span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <div className="text-right">
                                                    <span className="text-[9px] text-slate-500 block uppercase font-mono">Assists</span>
                                                    <span className="font-extrabold text-white">11</span>
                                                </div>
                                                <span className="text-[9px] px-2 py-0.5 rounded-full bg-green-950/50 text-green-400 border border-green-900/30">Available</span>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between bg-slate-900/60 border border-slate-800/50 p-2 rounded-xl text-xs">
                                            <div className="flex items-center gap-2">
                                                <div className="h-6 w-6 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-400">AB</div>
                                                <div>
                                                    <p className="font-bold text-slate-200">Alex Bergström</p>
                                                    <span className="text-[9px] text-slate-400">Defender (CB)</span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <div className="text-right">
                                                    <span className="text-[9px] text-slate-500 block uppercase font-mono">Matches</span>
                                                    <span className="font-extrabold text-white">18</span>
                                                </div>
                                                <span className="text-[9px] px-2 py-0.5 rounded-full bg-red-950/50 text-red-400 border border-red-900/30">Injured</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 3 && (
                                <div className="space-y-4 animate-in fade-in duration-200">
                                    {/* Club Finances Preview */}
                                    <div className="flex items-center justify-between border-b border-slate-800/60 pb-3">
                                        <div className="flex items-center gap-2">
                                            <CreditCard className="h-4 w-4 text-red-500" />
                                            <span className="text-xs font-bold text-slate-200">Club Finances &amp; Subscriptions</span>
                                        </div>
                                        <span className="text-[10px] text-emerald-400 font-bold font-mono">Active Season</span>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3 text-xs">
                                        <div className="bg-slate-900/60 border border-slate-800/50 p-3 rounded-xl">
                                            <span className="text-[9px] text-slate-500 uppercase block font-mono">Dues Collected</span>
                                            <p className="text-lg font-black text-white">£4,820</p>
                                            <span className="text-[8px] text-emerald-400">92% Target Reached</span>
                                        </div>
                                        <div className="bg-slate-900/60 border border-slate-800/50 p-3 rounded-xl">
                                            <span className="text-[9px] text-slate-500 uppercase block font-mono">Outstanding Fees</span>
                                            <p className="text-lg font-black text-red-400">£340</p>
                                            <span className="text-[8px] text-slate-400">From 4 members</span>
                                        </div>
                                    </div>

                                    <div className="bg-slate-900/60 border border-slate-800/50 rounded-xl overflow-hidden text-[10px]">
                                        <div className="bg-slate-900 px-3 py-1.5 font-bold text-slate-400 border-b border-slate-800/50 flex justify-between">
                                            <span>Player Name</span>
                                            <span>Amount</span>
                                            <span>Status</span>
                                        </div>
                                        <div className="divide-y divide-slate-800/50">
                                            <div className="px-3 py-2 flex justify-between items-center">
                                                <span className="font-medium text-slate-300">Liam Johnson</span>
                                                <span className="text-slate-400">£150</span>
                                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-900/30">Paid</span>
                                            </div>
                                            <div className="px-3 py-2 flex justify-between items-center">
                                                <span className="font-medium text-slate-300">Harry Norling</span>
                                                <span className="text-slate-400">£150</span>
                                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-950/60 text-red-400 border border-red-900/30">Overdue</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 4 && (
                                <div className="space-y-3 animate-in fade-in duration-200">
                                    {/* Training Tracker Preview */}
                                    <div className="flex items-center justify-between border-b border-slate-800/60 pb-2">
                                        <div className="flex items-center gap-2">
                                            <Activity className="h-4 w-4 text-red-500" />
                                            <span className="text-xs font-bold text-slate-200">Training Attendance &amp; Log</span>
                                        </div>
                                        <span className="text-[9px] px-2 py-0.5 rounded-full bg-slate-900 text-slate-300 border border-slate-800">Weekly Drills</span>
                                    </div>

                                    <div className="bg-slate-900/60 border border-slate-800/50 p-3 rounded-xl space-y-2">
                                        <div className="flex justify-between items-center text-xs">
                                            <div>
                                                <p className="font-bold text-slate-200">Tuesday Night Tactical Drills</p>
                                                <span className="text-[9px] text-slate-400">July 15 • Regent's Park Astro</span>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-lg font-black text-white">92%</span>
                                                <span className="text-[8px] text-slate-500 block">Attendance</span>
                                            </div>
                                        </div>
                                        <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                                            <div className="bg-red-500 h-full rounded-full" style={{ width: "92%" }} />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                                        <div className="bg-slate-900/40 border border-slate-800/50 p-2.5 rounded-lg flex items-center justify-between">
                                            <span className="text-slate-300">Mohamed Abdalla</span>
                                            <div className="h-4 w-4 rounded-full bg-emerald-950/60 text-emerald-400 flex items-center justify-center font-bold text-[9px] border border-emerald-900/30">✔</div>
                                        </div>
                                        <div className="bg-slate-900/40 border border-slate-850 p-2.5 rounded-lg flex items-center justify-between">
                                            <span className="text-slate-300">Said Tahir</span>
                                            <div className="h-4 w-4 rounded-full bg-emerald-950/60 text-emerald-400 flex items-center justify-center font-bold text-[9px] border border-emerald-900/30">✔</div>
                                        </div>
                                        <div className="bg-slate-900/40 border border-slate-850 p-2.5 rounded-lg flex items-center justify-between">
                                            <span className="text-slate-300">Alex Bergström</span>
                                            <div className="h-4 w-4 rounded-full bg-amber-950/60 text-amber-400 flex items-center justify-center font-bold text-[9px] border border-amber-900/30">Exc</div>
                                        </div>
                                        <div className="bg-slate-900/40 border border-slate-850 p-2.5 rounded-lg flex items-center justify-between">
                                            <span className="text-slate-300">E. Sandell</span>
                                            <div className="h-4 w-4 rounded-full bg-emerald-950/60 text-emerald-400 flex items-center justify-center font-bold text-[9px] border border-emerald-900/30">✔</div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center gap-4 text-xs text-slate-500 border-t border-slate-900 pt-6">
                    <span className="flex items-center gap-1.5">
                        <CheckCircle2 className="h-4 w-4 text-red-500/80" /> Used by coaches, treasurers &amp; club committees
                    </span>
                </div>
            </div>

            {/* Right Column (Auth Panel) */}
            <div className="flex-1 flex flex-col justify-center items-center p-6 md:p-12 relative z-10 bg-slate-950/20">
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
