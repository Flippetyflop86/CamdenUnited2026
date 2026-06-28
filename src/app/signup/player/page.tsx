"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AlertCircle, UserPlus, CheckCircle2, RefreshCw } from "lucide-react";

function PlayerSignupForm() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const token = searchParams?.get("token") || "";

    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [verifying, setVerifying] = useState(!!token);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState(false);
    const [invitedPlayer, setInvitedPlayer] = useState<any | null>(null);

    useEffect(() => {
        if (!token) return;

        async function verifyToken() {
            try {
                const { data: player, error: fetchErr } = await supabase
                    .from("players")
                    .select("*")
                    .eq("activation_token", token)
                    .single();

                if (fetchErr || !player) {
                    throw new Error("Invalid or expired activation link.");
                }

                if (player.activation_expires_at && new Date() > new Date(player.activation_expires_at)) {
                    throw new Error("Invitation link has expired.");
                }

                setInvitedPlayer(player);
                setFirstName(player.first_name || "");
                setLastName(player.last_name || "");
                setEmail(player.email || "");
            } catch (err: any) {
                setError(err.message || "Invalid activation token.");
            } finally {
                setVerifying(false);
            }
        }

        verifyToken();
    }, [token]);

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            // 1. Sign up user via Supabase Auth
            const { data: authData, error: signupErr } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        first_name: firstName,
                        last_name: lastName
                    }
                }
            });

            if (signupErr) throw signupErr;
            if (!authData.user) throw new Error("Signup failed. Please try again.");

            const userId = authData.user.id;
            const clubId = invitedPlayer ? invitedPlayer.club_id : null;

            // 2. Insert into club_members as Player role
            if (clubId) {
                const { error: memberErr } = await supabase
                    .from("club_members")
                    .insert({
                        club_id: clubId,
                        user_id: userId,
                        role: "Player"
                    });
                if (memberErr) throw memberErr;

                // 3. Link squad player profile to auth user
                const { error: playerUpdateErr } = await supabase
                    .from("players")
                    .update({
                        user_id: userId,
                        status: "Registered",
                        activation_token: null,
                        activation_expires_at: null
                    })
                    .eq("id", invitedPlayer.id);

                if (playerUpdateErr) throw playerUpdateErr;
            }

            setSuccess(true);
            setTimeout(() => {
                router.push("/login");
            }, 2500);

        } catch (err: any) {
            setError(err.message || "An error occurred during registration.");
        } finally {
            setLoading(false);
        }
    };

    if (verifying) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
                <div className="flex flex-col items-center gap-3">
                    <RefreshCw className="h-8 w-8 text-red-600 animate-spin" />
                    <p className="text-slate-400 text-xs font-semibold">Verifying invitation link...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
            <Card className="w-full max-w-md border-slate-800 bg-slate-900 shadow-2xl overflow-hidden">
                <CardHeader className="p-6 text-center border-b border-slate-800 bg-slate-900/50">
                    <div className="mx-auto h-12 w-12 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500 mb-3">
                        <UserPlus className="h-6 w-6" />
                    </div>
                    <CardTitle className="text-xl font-bold text-white">Join ClubFlow</CardTitle>
                    <CardDescription className="text-xs text-slate-400">
                        {invitedPlayer 
                            ? `Accept invitation to join ${invitedPlayer.first_name}'s squad portal.`
                            : "Create your lightweight Player Portal account."}
                    </CardDescription>
                </CardHeader>

                <CardContent className="p-6">
                    {success ? (
                        <div className="flex flex-col items-center justify-center py-6 text-center space-y-3">
                            <div className="h-12 w-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500">
                                <CheckCircle2 className="h-6 w-6 animate-bounce" />
                            </div>
                            <h3 className="font-bold text-lg text-white">Account Created!</h3>
                            <p className="text-xs text-slate-400">Please sign in with your email and password.</p>
                        </div>
                    ) : (
                        <form onSubmit={handleSignup} className="space-y-4">
                            {error && (
                                <div className="bg-red-950/40 border border-red-500/30 rounded-xl p-3 flex items-center gap-2.5 text-red-400 text-xs">
                                    <AlertCircle className="h-4.5 w-4.5 shrink-0" />
                                    <span>{error}</span>
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">First Name</label>
                                    <Input
                                        value={firstName}
                                        onChange={(e) => setFirstName(e.target.value)}
                                        required
                                        className="bg-slate-950 border-slate-800 text-white text-xs h-10"
                                        placeholder="First Name"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Last Name</label>
                                    <Input
                                        value={lastName}
                                        onChange={(e) => setLastName(e.target.value)}
                                        required
                                        className="bg-slate-950 border-slate-800 text-white text-xs h-10"
                                        placeholder="Last Name"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Email Address</label>
                                <Input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    className="bg-slate-950 border-slate-800 text-white text-xs h-10"
                                    placeholder="you@example.com"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Password</label>
                                <Input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    className="bg-slate-950 border-slate-800 text-white text-xs h-10"
                                    placeholder="••••••••"
                                />
                            </div>

                            <Button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-red-600 hover:bg-red-700 text-white font-bold h-10 transition-all mt-2"
                            >
                                {loading ? "Creating account..." : "Join ClubFlow"}
                            </Button>
                        </form>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

export default function PlayerSignupPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
                <div className="flex flex-col items-center gap-3">
                    <RefreshCw className="h-8 w-8 text-red-600 animate-spin" />
                    <p className="text-slate-400 text-xs font-semibold">Loading signup form...</p>
                </div>
            </div>
        }>
            <PlayerSignupForm />
        </Suspense>
    );
}
