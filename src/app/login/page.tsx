"use client";

import { useState } from "react";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Lock, CheckCircle2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import Link from "next/link";

export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const router = useRouter();


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

                {/* HERO: Logo image centred, large, glowing */}
                <div className="my-auto flex flex-col items-center text-center space-y-8">
                    {/* Glow container */}
                    <div className="relative">
                        <div className="absolute inset-0 rounded-3xl bg-red-500/10 blur-3xl scale-110 pointer-events-none" />
                        <div className="relative rounded-2xl overflow-hidden border border-slate-800/60 shadow-2xl shadow-red-950/30 bg-slate-950/60 backdrop-blur-sm">
                            <Image
                                src="/clubflow-logo.png"
                                alt="ClubFlow — From Stadium to Spreadsheet"
                                width={480}
                                height={320}
                                priority
                                className="object-contain"
                            />
                        </div>
                    </div>

                    {/* Supporting copy below the logo */}
                    <div className="space-y-3 max-w-md">
                        <p className="text-red-500 text-xs font-bold tracking-widest uppercase">
                            from stadium to spreadsheet
                        </p>
                        <h1 className="text-2xl lg:text-3xl font-black tracking-tight text-white leading-snug">
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-red-400">Run Your Club.</span>{" "}
                            In One Place.
                        </h1>
                        <p className="text-slate-400 text-sm leading-relaxed">
                            Manage players, squad availability, matchday lineups, statistics, club finances, and equipment inventory from a single platform — built specifically for grassroots, amateur and semi-professional football clubs.
                        </p>
                    </div>

                    {/* Feature pills */}
                    <div className="flex flex-wrap justify-center gap-2">
                        {["⚽ Squad Management", "📅 Fixtures & Training", "👥 Availability", "🤝 Recruitment", "💷 Club Finances", "💬 Team Comms"].map((f) => (
                            <span key={f} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900/60 border border-slate-800/80 text-xs font-semibold text-slate-300 hover:border-red-500/40 hover:text-white transition-all cursor-default">
                                {f}
                            </span>
                        ))}
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
