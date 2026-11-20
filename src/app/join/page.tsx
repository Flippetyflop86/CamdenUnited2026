"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Shield, Eye, EyeOff, CheckCircle2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

function JoinPageInner() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const token = searchParams.get("token");

    const [invite, setInvite] = useState<any>(null);
    const [isLoadingInvite, setIsLoadingInvite] = useState(true);
    const [inviteError, setInviteError] = useState("");

    const [mode, setMode] = useState<"signup" | "signin">("signup");
    const [name, setName] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [coachFormat, setCoachFormat] = useState<"11v11" | "9v9" | "7v7" | "5v5">("11v11");
    const [coachMatchDuration, setCoachMatchDuration] = useState<number>(90);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        const isValidUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token || "");
        if (!token || !isValidUuid) {
            setInviteError("Invalid invite link. Please ask your manager for a new one.");
            setIsLoadingInvite(false);
            return;
        }
        supabase
            .rpc("get_invitation_by_token", { token_val: token })
            .then(({ data, error }) => {
                if (error || !data || data.length === 0) {
                    setInviteError("This invite link is invalid or has already been used.");
                } else {
                    const inviteData = data[0] as any;
                    setInvite({
                        id: inviteData.id,
                        club_id: inviteData.club_id,
                        email: inviteData.email,
                        role: inviteData.role,
                        display_name: inviteData.display_name,
                        page_permissions: inviteData.page_permissions,
                        clubs: {
                            name: inviteData.club_name,
                            logo: inviteData.club_logo,
                        },
                    });
                    setName(inviteData.display_name || "");
                }
                setIsLoadingInvite(false);
            });
    }, [token]);

    const acceptMembershipWithToken = async (accessToken: string) => {
        if (!token) return;
        const res = await fetch("/api/staff/invite", {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
                token,
                displayName: name.trim() || invite?.display_name || undefined,
            }),
        });
        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            // Ignore 404 if DB trigger already consumed the invitation on signUp
            if (res.status !== 404) {
                throw new Error(errData.error || "Could not attach club membership.");
            }
        }
    };

    const handleJoin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!invite) return;
        if (mode === "signup") {
            if (password !== confirmPassword) {
                setError("Passwords do not match.");
                return;
            }
            if (password.length < 6) {
                setError("Password must be at least 6 characters.");
                return;
            }
            if (!name.trim()) {
                setError("Please enter your name.");
                return;
            }
        }

        setIsLoading(true);
        setError("");

        try {
            let activeSessionToken: string | null = null;

            if (mode === "signin") {
                const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
                    email: invite.email,
                    password,
                });
                if (signInErr) throw signInErr;
                activeSessionToken = signInData.session?.access_token || null;
            } else {
                const { data: authData, error: signupError } = await supabase.auth.signUp({
                    email: invite.email,
                    password,
                    options: {
                        data: {
                            full_name: name.trim(),
                            coach_match_format: coachFormat,
                            coach_match_duration: coachMatchDuration,
                        },
                    },
                });

                if (signupError) {
                    if (/already registered/i.test(signupError.message || "")) {
                        const { data: fallbackSignIn, error: fallbackErr } =
                            await supabase.auth.signInWithPassword({
                                email: invite.email,
                                password,
                            });
                        if (fallbackErr) {
                            setMode("signin");
                            throw new Error(
                                "An account with this email already exists — enter your existing ClubFlow password below to join this club."
                            );
                        }
                        activeSessionToken = fallbackSignIn.session?.access_token || null;
                    } else {
                        throw signupError;
                    }
                } else {
                    if (!authData.user) throw new Error("Signup failed — no user returned.");
                    activeSessionToken = authData.session?.access_token || null;
                }
            }

            if (activeSessionToken) {
                await acceptMembershipWithToken(activeSessionToken);
            }

            if (typeof window !== "undefined") {
                try {
                    const cachedRaw = localStorage.getItem("clubflow_cache_clubSettings");
                    const cached = cachedRaw ? JSON.parse(cachedRaw) : {};
                    const existingFormats: string[] = Array.isArray(cached.enabledMatchFormats)
                        ? cached.enabledMatchFormats
                        : ["11v11"];
                    const mergedFormats = Array.from(new Set([...existingFormats, "11v11", coachFormat]));
                    localStorage.setItem(
                        "clubflow_cache_clubSettings",
                        JSON.stringify({
                            ...cached,
                            enabledMatchFormats: mergedFormats,
                            defaultMatchDuration: coachMatchDuration,
                        })
                    );
                } catch {}
            }

            const redirectParam = searchParams.get("redirect");
            const safeRedirect =
                redirectParam && redirectParam.startsWith("/") ? redirectParam : "/dashboard";
            if (activeSessionToken) {
                window.location.href = safeRedirect;
            } else {
                router.push(`/login?joined=1&redirect=${encodeURIComponent(safeRedirect)}`);
            }
        } catch (err: any) {
            setError(err.message || "Failed to join club. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    if (isLoadingInvite) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center">
                <div className="h-8 w-8 rounded-full border-4 border-red-600 border-t-transparent animate-spin" />
            </div>
        );
    }

    if (inviteError) {
        return (
            <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
                <div className="h-16 w-16 bg-red-900/50 rounded-2xl flex items-center justify-center mb-6">
                    <AlertCircle className="h-8 w-8 text-red-400" />
                </div>
                <h1 className="text-2xl font-bold text-white mb-2">Invalid Invite</h1>
                <p className="text-slate-400 text-center max-w-sm">{inviteError}</p>
            </div>
        );
    }

    const clubName = invite?.clubs?.name || "Your Club";
    const clubLogo = invite?.clubs?.logo;

    return (
        <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-md space-y-8">
                <div className="flex flex-col items-center text-center">
                    {clubLogo ? (
                        <img src={clubLogo} alt={clubName} className="h-16 w-16 object-contain mb-4" />
                    ) : (
                        <div className="h-16 w-16 bg-red-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-red-600/20">
                            <Shield className="h-8 w-8 text-white" />
                        </div>
                    )}
                    <h1 className="text-3xl font-bold text-white tracking-tight">Join {clubName}</h1>
                    <p className="text-slate-400 mt-2">
                        You&apos;ve been invited as{" "}
                        <span className="text-white font-medium">{invite?.role || "Staff"}</span>
                    </p>
                </div>

                {invite?.page_permissions?.length > 0 && (
                    <div className="bg-slate-800/60 rounded-lg p-4 border border-slate-700">
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                            Your access includes
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {invite.page_permissions.map((key: string) => (
                                <span
                                    key={key}
                                    className="inline-flex items-center gap-1 text-xs bg-slate-700 text-slate-300 px-2 py-1 rounded-full capitalize"
                                >
                                    <CheckCircle2 className="h-3 w-3 text-green-400" />
                                    {key.replace(/-/g, " ")}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                <Card className="border-slate-800 bg-slate-900 shadow-xl">
                    <CardHeader className="space-y-3">
                        <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-slate-950 border border-slate-800">
                            <button
                                type="button"
                                onClick={() => {
                                    setMode("signup");
                                    setError("");
                                }}
                                className={`py-2 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                    mode === "signup"
                                        ? "bg-white text-slate-950 shadow-xs"
                                        : "text-slate-400 hover:text-white"
                                }`}
                            >
                                New Account
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setMode("signin");
                                    setError("");
                                }}
                                className={`py-2 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                    mode === "signin"
                                        ? "bg-white text-slate-950 shadow-xs"
                                        : "text-slate-400 hover:text-white"
                                }`}
                            >
                                Existing Account
                            </button>
                        </div>
                        <div>
                            <CardTitle className="text-white">
                                {mode === "signup" ? "Create Your Account" : "Sign In & Join Club"}
                            </CardTitle>
                            <CardDescription className="text-slate-400">
                                Joining as <span className="text-slate-300">{invite?.email}</span>
                            </CardDescription>
                        </div>
                    </CardHeader>
                    <form onSubmit={handleJoin}>
                        <CardContent className="space-y-4">
                            {error && (
                                <Alert variant="destructive" className="bg-red-950/50 border-red-900 text-red-400">
                                    <AlertCircle className="h-4 w-4" />
                                    <AlertDescription>{error}</AlertDescription>
                                </Alert>
                            )}
                            {mode === "signup" && (
                                <div className="space-y-2">
                                    <Label htmlFor="name" className="text-slate-300">
                                        Your Name
                                    </Label>
                                    <Input
                                        id="name"
                                        placeholder="e.g. James Smith"
                                        required
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus-visible:ring-red-500"
                                    />
                                </div>
                            )}
                            <div className="space-y-2">
                                <Label htmlFor="password" className="text-slate-300">
                                    Password
                                </Label>
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
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-300"
                                    >
                                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                </div>
                            </div>
                            {mode === "signup" && (
                                <>
                                    <div className="space-y-2">
                                        <Label htmlFor="confirmPassword" className="text-slate-300">
                                            Confirm Password
                                        </Label>
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
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-300"
                                            >
                                                {showPassword ? (
                                                    <EyeOff className="h-4 w-4" />
                                                ) : (
                                                    <Eye className="h-4 w-4" />
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                    <div className="space-y-2.5 pt-2 border-t border-slate-800">
                                        <Label className="text-slate-300 text-xs font-semibold">
                                            Your Team&apos;s Match Format &amp; Game Length
                                        </Label>
                                        <div className="grid grid-cols-4 gap-1.5">
                                            {(
                                                [
                                                    { id: "11v11", mins: 90 },
                                                    { id: "9v9", mins: 60 },
                                                    { id: "7v7", mins: 50 },
                                                    { id: "5v5", mins: 40 },
                                                ] as const
                                            ).map((fmt) => (
                                                <button
                                                    key={fmt.id}
                                                    type="button"
                                                    onClick={() => {
                                                        setCoachFormat(fmt.id);
                                                        setCoachMatchDuration(fmt.mins);
                                                    }}
                                                    className={`py-1.5 rounded-lg text-xs font-bold border transition-all ${
                                                        coachFormat === fmt.id
                                                            ? "bg-red-600 text-white border-red-500"
                                                            : "bg-slate-800 text-slate-400 border-slate-700 hover:text-white"
                                                    }`}
                                                >
                                                    {fmt.id}
                                                </button>
                                            ))}
                                        </div>
                                        <div className="flex items-center justify-between gap-2 pt-1">
                                            <span className="text-xs text-slate-400">
                                                How many minutes are your games?
                                            </span>
                                            <div className="flex items-center gap-1.5">
                                                <Input
                                                    type="number"
                                                    min={10}
                                                    max={120}
                                                    value={coachMatchDuration}
                                                    onChange={(e) =>
                                                        setCoachMatchDuration(
                                                            Math.max(10, Math.min(120, Number(e.target.value) || 90))
                                                        )
                                                    }
                                                    className="h-8 w-16 bg-slate-800 border-slate-700 text-white text-xs font-bold text-center px-1.5"
                                                />
                                                <span className="text-xs text-slate-400">mins</span>
                                            </div>
                                        </div>
                                    </div>
                                </>
                            )}
                        </CardContent>
                        <CardFooter>
                            <Button
                                type="submit"
                                className="w-full bg-red-600 hover:bg-red-700 text-white font-medium h-11"
                                disabled={isLoading}
                            >
                                {isLoading
                                    ? "Joining Club..."
                                    : mode === "signup"
                                      ? "Create Account & Join Club"
                                      : "Sign In & Join Club"}
                            </Button>
                        </CardFooter>
                    </form>
                </Card>
            </div>
        </div>
    );
}

export default function JoinPage() {
    return (
        <Suspense
            fallback={
                <div className="min-h-screen bg-slate-900 flex items-center justify-center">
                    <div className="h-8 w-8 rounded-full border-4 border-red-600 border-t-transparent animate-spin" />
                </div>
            }
        >
            <JoinPageInner />
        </Suspense>
    );
}
