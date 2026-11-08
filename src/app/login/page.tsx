"use client";

import { useState, useEffect } from "react";
import { supabase, unproxiedSupabase, setGlobalClubId } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { AlertCircle, Eye, EyeOff } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import Link from "next/link";

export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(true);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    useEffect(() => {
        try {
            const savedRemember = localStorage.getItem("clubflow_remember_me");
            if (savedRemember === "false") {
                setRememberMe(false);
            } else {
                setRememberMe(true);
                const savedEmail = localStorage.getItem("clubflow_remembered_email");
                if (savedEmail) {
                    setEmail(savedEmail);
                }
            }
        } catch {}
    }, []);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email: email.trim(),
                password,
            });

            if (error) {
                throw error;
            }

            try {
                sessionStorage.setItem("clubflow_active_tab_session", "true");
                if (rememberMe) {
                    localStorage.setItem("clubflow_remember_me", "true");
                    localStorage.setItem("clubflow_remembered_email", email.trim());
                } else {
                    localStorage.setItem("clubflow_remember_me", "false");
                    localStorage.removeItem("clubflow_remembered_email");
                }
            } catch {}

            if (data.session) {
                const userId = data.session.user.id;
                const userEmail = data.session.user.email;
                const { data: members } = await unproxiedSupabase
                    .from("club_members")
                    .select("id, club_id, role, page_permissions, display_name, user_id")
                    .or(userEmail ? `user_id.eq.${userId},email.ilike.${userEmail}` : `user_id.eq.${userId}`);

                const member = members && members.length > 0
                    ? (members.find((m: any) => m.user_id === userId) || members[0])
                    : null;

                if (member) {
                    setGlobalClubId(member.club_id);
                    try {
                        localStorage.setItem("clubflow_cache_user", JSON.stringify(data.session.user));
                        localStorage.setItem(`clubflow_cache_${userId}_clubId`, JSON.stringify(member.club_id));
                        localStorage.setItem(`clubflow_cache_${userId}_role`, JSON.stringify(member.role));
                        localStorage.setItem(`clubflow_cache_${userId}_pagePermissions`, JSON.stringify(member.page_permissions || null));
                        localStorage.setItem(`clubflow_cache_${userId}_displayName`, JSON.stringify(member.display_name || null));
                        localStorage.setItem("clubflow_cache_clubId", JSON.stringify(member.club_id));
                        localStorage.setItem("clubflow_cache_role", JSON.stringify(member.role));
                        localStorage.setItem("clubflow_cache_pagePermissions", JSON.stringify(member.page_permissions || null));
                        localStorage.setItem("clubflow_cache_displayName", JSON.stringify(member.display_name || null));
                    } catch {}
                }

                if ((member as any)?.role === "Player") {
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
        <div className="min-h-screen bg-[#030712] flex flex-col justify-center items-center p-6 relative overflow-hidden font-sans">
            {/* Ambient background glows */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden z-0 opacity-10">
                <div className="absolute top-[10%] left-[20%] w-[380px] h-[380px] rounded-full bg-emerald-500/5 blur-[80px]" />
                <div className="absolute bottom-[20%] right-[20%] w-[420px] h-[420px] rounded-full bg-slate-500/5 blur-[90px]" />
            </div>

            {/* Centered Auth Card */}
            <div className="relative z-10 w-full max-w-sm space-y-6">
                
                {/* Logo and title */}
                <div className="flex flex-col items-center text-center space-y-2">
                    <Link href="/" className="flex items-center gap-2.5 mb-2">
                        <span className="h-7 w-7 rounded bg-emerald-500 flex items-center justify-center font-black text-slate-900 text-sm">CF</span>
                        <span className="font-black text-xl tracking-tight text-white">ClubFlow</span>
                    </Link>
                    <h1 className="text-xl font-bold tracking-tight text-white">Welcome back.</h1>
                    <p className="text-slate-500 text-xs">Access your football operations workspace.</p>
                </div>

                {/* Login Form Panel */}
                <Card className="border-slate-900 bg-slate-950/40 backdrop-blur-md shadow-2xl rounded-2xl p-6">
                    <form onSubmit={handleLogin} className="space-y-4">
                        {error && (
                            <Alert variant="destructive" className="bg-red-950 border-red-900 text-red-400 rounded-xl py-2 px-3 text-xs flex gap-2 items-center">
                                <AlertCircle className="h-4 w-4 shrink-0" />
                                <AlertDescription>{error}</AlertDescription>
                            </Alert>
                        )}
                        
                        <div className="space-y-1.5">
                            <Label htmlFor="email" className="text-slate-300 text-[11px] uppercase tracking-wider font-bold">Email address</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="you@clubflow.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                autoComplete="email"
                                className="bg-slate-900 border-slate-800 text-white placeholder:text-slate-500 focus-visible:ring-red-500 rounded-xl h-10 text-xs transition-all"
                            />
                        </div>
                        
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="password" className="text-slate-300 text-[11px] uppercase tracking-wider font-bold">Password</Label>
                                <Link href="/reset-password" className="text-[10px] font-bold text-slate-400 hover:text-red-400 transition-colors">
                                    Forgot?
                                </Link>
                            </div>
                            <div className="relative">
                                <Input
                                    id="password"
                                    type={showPassword ? "text" : "password"}
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    autoComplete="current-password"
                                    style={!showPassword ? ({ WebkitTextSecurity: "disc" } as React.CSSProperties) : undefined}
                                    className="bg-slate-900 border-slate-800 text-white placeholder:text-slate-500 focus-visible:ring-red-500 rounded-xl h-10 text-xs transition-all pr-16"
                                />
                                <button
                                    type="button"
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => setShowPassword((prev) => !prev)}
                                    aria-label={showPassword ? "Hide password" : "Show password"}
                                    title={showPassword ? "Hide password" : "Show password"}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 z-10 inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold text-slate-300 hover:text-white hover:bg-slate-800 transition-colors focus:outline-none"
                                >
                                    {showPassword ? (
                                        <>
                                            <EyeOff className="h-3.5 w-3.5 text-red-400" />
                                            <span>Hide</span>
                                        </>
                                    ) : (
                                        <>
                                            <Eye className="h-3.5 w-3.5 text-slate-400" />
                                            <span>Show</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>

                        <div className="flex items-center justify-between pt-0.5">
                            <label htmlFor="rememberMe" className="inline-flex items-center gap-2 cursor-pointer select-none">
                                <input
                                    id="rememberMe"
                                    type="checkbox"
                                    checked={rememberMe}
                                    onChange={(e) => setRememberMe(e.target.checked)}
                                    className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-red-600 focus:ring-red-500 accent-red-600 cursor-pointer"
                                />
                                <span className="text-xs font-medium text-slate-300">Remember me</span>
                            </label>
                        </div>
                        
                        <Button 
                            type="submit" 
                            className="w-full bg-red-600 hover:bg-red-500 text-white font-bold h-10 rounded-xl transition-all mt-2 text-xs" 
                            disabled={loading}
                        >
                            {loading ? "Signing in..." : "Sign In"}
                        </Button>
                        
                        <div className="text-center pt-2">
                            <span className="text-[10px] text-slate-500">
                                Don't have an account?{" "}
                                <Link href="/signup" className="text-red-400 hover:text-red-300 font-bold transition-colors">
                                    Sign Up
                                </Link>
                            </span>
                        </div>
                    </form>
                </Card>
            </div>
        </div>
    );
}
