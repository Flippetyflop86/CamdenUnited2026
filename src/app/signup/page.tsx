"use client";

import { useState } from "react";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, UserPlus, Eye, EyeOff } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import Link from "next/link";

export default function SignupPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [clubName, setClubName] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const router = useRouter();

    /**
     * If an email still exists in Supabase `auth.users` after its club/membership row was deleted,
     * sign in and re-provision a brand new club workspace for that account.
     */
    const tryReprovisionDeletedAccount = async (): Promise<boolean> => {
        const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
            email: email.trim(),
            password,
        });

        if (signInErr || !signInData.session) {
            return false;
        }

        // Update user metadata with the new club name
        await supabase.auth.updateUser({
            data: { club_name: clubName.trim() },
        });

        // Call /api/auth/sync to check or provision the club workspace
        const syncRes = await fetch("/api/auth/sync", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${signInData.session.access_token}`,
            },
            body: JSON.stringify({
                clubName: clubName.trim(),
                provisionIfOrphaned: true,
            }),
        });

        if (syncRes.ok) {
            const syncData = await syncRes.json();
            if (syncData.membership?.club_id) {
                // Clear any stale cached clubId and redirect to dashboard/onboarding
                try {
                    localStorage.setItem(
                        "clubflow_cache_clubId",
                        JSON.stringify(syncData.membership.club_id)
                    );
                } catch {}
                window.location.href = "/dashboard";
                return true;
            }
        }

        return false;
    };

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError("");

        if (!clubName.trim()) {
            setError("Please enter a name for your Club.");
            setIsLoading(false);
            return;
        }

        if (password !== confirmPassword) {
            setError("Passwords do not match.");
            setIsLoading(false);
            return;
        }

        try {
            // 1. Sign up the user and pass the club_name in the raw_user_meta_data
            const { data, error: signupError } = await supabase.auth.signUp({
                email: email.trim(),
                password,
                options: {
                    data: {
                        club_name: clubName.trim(),
                    },
                },
            });

            if (signupError) {
                if (signupError.message?.toLowerCase().includes("already registered")) {
                    const recovered = await tryReprovisionDeletedAccount();
                    if (recovered) return;
                }
                throw signupError;
            }

            // Check if the user already exists in auth.users (identities array is empty when email already exists)
            if (data.user && data.user.identities && data.user.identities.length === 0) {
                const recovered = await tryReprovisionDeletedAccount();
                if (recovered) return;

                setError(
                    "This email still exists in Supabase Auth. If you previously deleted its club, enter your previous password for this email (or delete the user under Supabase Dashboard → Authentication → Users) to recreate the workspace."
                );
                setIsLoading(false);
                return;
            }

            if (data.session) {
                // Ensure club membership is synced/provisioned before redirecting
                await fetch("/api/auth/sync", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${data.session.access_token}`,
                    },
                    body: JSON.stringify({
                        clubName: clubName.trim(),
                        provisionIfOrphaned: true,
                    }),
                });
                window.location.href = "/dashboard";
            } else {
                alert("Success! Please check your email to confirm your account, then log in.");
                router.push("/login");
            }
        } catch (err: any) {
            setError(err.message || "Failed to create account");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#060911] flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-md space-y-6">
                <div className="flex flex-col items-center justify-center text-center">
                    <Link href="/" className="mb-3">
                        <div className="w-20 h-20 rounded-full overflow-hidden border border-white/15 shadow-xl bg-[#060911] flex items-center justify-center">
                            <Image
                                src="/clubflow-logo.png"
                                alt="ClubFlow"
                                width={80}
                                height={80}
                                priority
                                className="w-full h-full object-cover"
                            />
                        </div>
                    </Link>
                    <h1 className="text-3xl font-black text-white tracking-tight">Create your Club</h1>
                    <p className="text-slate-400 mt-1.5 text-sm">
                        Start managing your team with a dedicated workspace
                    </p>
                </div>

                <Card className="border-slate-800 bg-slate-900/90 shadow-2xl">
                    <CardHeader>
                        <CardTitle className="!text-white text-xl font-bold">Sign Up</CardTitle>
                        <CardDescription className="text-slate-400">
                            Enter your details to provision a new isolated club workspace.
                        </CardDescription>
                    </CardHeader>
                    <form onSubmit={handleSignup}>
                        <CardContent className="space-y-4">
                            {error && (
                                <Alert variant="destructive" className="bg-red-950/50 border-red-900 text-red-400">
                                    <AlertCircle className="h-4 w-4" />
                                    <AlertDescription>{error}</AlertDescription>
                                </Alert>
                            )}

                            <div className="space-y-2">
                                <Label htmlFor="clubName" className="text-slate-300">Club Name</Label>
                                <Input
                                    id="clubName"
                                    placeholder="e.g. Northbrook United FC"
                                    required
                                    value={clubName}
                                    onChange={(e) => setClubName(e.target.value)}
                                    className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus-visible:ring-red-500"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="email" className="text-slate-300">Manager Email</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="manager@club.com"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus-visible:ring-red-500"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="password" className="text-slate-300">Password</Label>
                                <div className="relative">
                                    <Input
                                        id="password"
                                        type={showPassword ? "text" : "password"}
                                        required
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="bg-slate-800 border-slate-700 text-white focus-visible:ring-red-500 pr-10"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-300 focus:outline-none"
                                    >
                                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="confirmPassword" className="text-slate-300">Confirm Password</Label>
                                <div className="relative">
                                    <Input
                                        id="confirmPassword"
                                        type={showPassword ? "text" : "password"}
                                        required
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        className="bg-slate-800 border-slate-700 text-white focus-visible:ring-red-500 pr-10"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-300 focus:outline-none"
                                    >
                                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                </div>
                            </div>
                        </CardContent>
                        <CardFooter className="flex flex-col space-y-4">
                            <Button
                                type="submit"
                                className="w-full bg-red-600 hover:bg-red-700 text-white font-bold h-11"
                                disabled={isLoading}
                            >
                                {isLoading ? (
                                    "Provisioning Workspace..."
                                ) : (
                                    <>
                                        <UserPlus className="mr-2 h-4 w-4" /> Sign Up
                                    </>
                                )}
                            </Button>

                            <div className="text-sm text-slate-400 text-center">
                                Already have an account?{" "}
                                <Link href="/login" className="text-red-400 hover:text-red-300 font-medium transition-colors">
                                    Sign In
                                </Link>
                            </div>
                        </CardFooter>
                    </form>
                </Card>
            </div>
        </div>
    );
}
