"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
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
        <div className="min-h-screen bg-[#030712] flex flex-col justify-center items-center p-6 relative overflow-hidden font-sans select-none">
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
                        <span className="h-7 w-7 rounded bg-emerald-500 flex items-center justify-center font-black text-slate-955 text-sm">CF</span>
                        <span className="font-black text-xl tracking-tight text-white">ClubFlow</span>
                    </Link>
                    <h1 className="text-xl font-bold tracking-tight text-white">Welcome back.</h1>
                    <p className="text-slate-500 text-xs">Access your football operations workspace.</p>
                </div>

                {/* Login Form Panel */}
                <Card className="border-slate-900 bg-slate-950/40 backdrop-blur-md shadow-2xl rounded-2xl p-6">
                    <form onSubmit={handleLogin} className="space-y-4">
                        {error && (
                            <Alert variant="destructive" className="bg-red-955 border-red-900 text-red-405 rounded-xl py-2 px-3 text-xs flex gap-2 items-center">
                                <AlertCircle className="h-4 w-4 shrink-0" />
                                <AlertDescription>{error}</AlertDescription>
                            </Alert>
                        )}
                        
                        <div className="space-y-1.5">
                            <Label htmlFor="email" className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Email address</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="you@clubflow.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                className="bg-slate-955 border-slate-900 text-white placeholder:text-slate-700 focus-visible:ring-red-650 rounded-xl h-10 text-xs transition-all"
                            />
                        </div>
                        
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="password" className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Password</Label>
                                <Link href="/reset-password" className="text-[10px] font-bold text-slate-400 hover:text-red-500 transition-colors">
                                    Forgot?
                                </Link>
                            </div>
                            <Input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                className="bg-slate-955 border-slate-900 text-white focus-visible:ring-red-650 rounded-xl h-10 text-xs transition-all"
                            />
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
