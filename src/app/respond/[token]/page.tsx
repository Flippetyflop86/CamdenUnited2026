"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CalendarDays, Clock, MapPin, CheckCircle2, AlertCircle, RefreshCw, Lock, LockOpen } from "lucide-react";

export default function SecureEventResponderPage() {
    const params = useParams();
    const router = useRouter();
    const token = Array.isArray(params?.token) ? params.token[0] : params?.token;

    // Load states
    const [loading, setLoading] = useState(true);
    const [event, setEvent] = useState<any | null>(null);
    const [eventType, setEventType] = useState<"match" | "training" | null>(null);
    const [player, setPlayer] = useState<any | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Auth states
    const [sessionUser, setSessionUser] = useState<any | null>(null);
    const [loginEmail, setLoginEmail] = useState("");
    const [loginPassword, setLoginPassword] = useState("");
    const [loginError, setLoginError] = useState("");
    const [loginLoading, setLoginLoading] = useState(false);

    // Event lock state
    const [isLocked, setIsLocked] = useState(false);
    const [lockMessage, setLockMessage] = useState("");

    // RSVP states
    const [currentRsvp, setCurrentRsvp] = useState<string>("Unanswered");
    const [submitting, setSubmitting] = useState(false);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    useEffect(() => {
        if (!token) return;

        async function verifyAndLoad() {
            try {
                // 1. Fetch current auth session
                const { data: { session } } = await supabase.auth.getSession();
                setSessionUser(session?.user || null);

                // 2. Fetch event by token
                // Check matches
                const { data: matchData } = await supabase
                    .from("matches")
                    .select("*")
                    .eq("event_token", token)
                    .single();

                let resolvedEvent = null;
                let resolvedType: "match" | "training" | null = null;

                if (matchData) {
                    resolvedEvent = matchData;
                    resolvedType = "match";
                } else {
                    const { data: sessionData } = await supabase
                        .from("training_sessions")
                        .select("*")
                        .eq("event_token", token)
                        .single();

                    if (sessionData) {
                        resolvedEvent = sessionData;
                        resolvedType = "training";
                    }
                }

                if (!resolvedEvent || !resolvedType) {
                    setError("Invalid or expired availability link.");
                    setLoading(false);
                    return;
                }

                setEvent(resolvedEvent);
                setEventType(resolvedType);

                // 3. Check Event Lock Type
                checkLockState(resolvedEvent);

                // 4. If logged in, fetch linked player profile
                if (session?.user) {
                    const { data: playerData, error: playerErr } = await supabase
                        .from("players")
                        .select("*")
                        .eq("user_id", session.user.id)
                        .single();

                    if (playerErr || !playerData) {
                        setError("You are not registered as a member of this club's squad. Please contact your coach.");
                        setLoading(false);
                        return;
                    }

                    setPlayer(playerData);

                    // 5. Get current RSVP response
                    if (resolvedType === "match") {
                        const currentNotes = resolvedEvent.notes || "";
                        const matchRaw = currentNotes.match(/\[AVAILABILITY:\s*(.*?)\s*\]/);
                        if (matchRaw && matchRaw[1]) {
                            try {
                                const list = JSON.parse(matchRaw[1]);
                                const record = list.find((a: any) => a.playerId === playerData.id);
                                setCurrentRsvp(record?.status || "Unanswered");
                            } catch (e) {
                                setCurrentRsvp("Unanswered");
                            }
                        }
                    } else {
                        const attendance = resolvedEvent.attendance || [];
                        const record = attendance.find((a: any) => a.playerId === playerData.id);
                        if (record) {
                            if (record.status === "Present") setCurrentRsvp("Available");
                            else if (record.status === "Late") setCurrentRsvp("Maybe");
                            else setCurrentRsvp("Unavailable");
                        }
                    }
                }

            } catch (err: any) {
                console.error(err);
                setError("An error occurred loading the availability responder.");
            } finally {
                setLoading(false);
            }
        }

        verifyAndLoad();
    }, [token]);

    const checkLockState = (evt: any) => {
        if (!evt.lock_type || evt.lock_type === "Never") {
            setIsLocked(false);
            return;
        }

        // Get match date and time
        const eventDateStr = evt.date; // YYYY-MM-DD
        const eventTimeStr = evt.time || "00:00";
        const eventDateTime = new Date(`${eventDateStr}T${eventTimeStr}`);

        if (isNaN(eventDateTime.getTime())) {
            setIsLocked(false);
            return;
        }

        let lockTime = eventDateTime.getTime();

        if (evt.lock_type === "30m") {
            lockTime = eventDateTime.getTime() - 30 * 60 * 1000;
        } else if (evt.lock_type === "1h") {
            lockTime = eventDateTime.getTime() - 60 * 60 * 1000;
        } else if (evt.lock_type === "Custom" && evt.lock_time) {
            lockTime = new Date(evt.lock_time).getTime();
        }

        const now = Date.now();
        if (now > lockTime) {
            setIsLocked(true);
            setLockMessage(`Locked on ${new Date(lockTime).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`);
        }
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoginError("");
        setLoginLoading(true);

        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email: loginEmail,
                password: loginPassword,
            });

            if (error) throw error;
            if (data.session) {
                window.location.reload();
            }
        } catch (err: any) {
            setLoginError(err.message || "Failed to sign in. Please verify credentials.");
        } finally {
            setLoginLoading(false);
        }
    };

    const handleRsvp = async (status: "Available" | "Maybe" | "Unavailable") => {
        if (isLocked) return;
        if (!player || !event || !eventType) return;

        setSubmitting(true);
        try {
            if (eventType === "match") {
                const currentNotes = event.notes || "";
                let currentList: any[] = [];
                const matchRaw = currentNotes.match(/\[AVAILABILITY:\s*(.*?)\s*\]/);
                if (matchRaw && matchRaw[1]) {
                    try {
                        currentList = JSON.parse(matchRaw[1]);
                    } catch (e) {
                        currentList = [];
                    }
                }

                const updatedList = [...currentList];
                const playerIndex = updatedList.findIndex((a: any) => a.playerId === player.id);

                if (playerIndex >= 0) {
                    updatedList[playerIndex] = { playerId: player.id, status };
                } else {
                    updatedList.push({ playerId: player.id, status });
                }

                let cleanBaseNotes = currentNotes.replace(/\[AVAILABILITY:.*?\]\n?/, "").trim();
                const finalNotes = `${cleanBaseNotes}\n[AVAILABILITY: ${JSON.stringify(updatedList)} ]`.trim();

                const { error: updateMatchErr } = await supabase
                    .from("matches")
                    .update({ notes: finalNotes })
                    .eq("id", event.id);

                if (updateMatchErr) throw updateMatchErr;
                setEvent({ ...event, notes: finalNotes });

            } else {
                const existingAttendance = event.attendance || [];
                const updatedAttendance = [...existingAttendance];
                const playerIndex = updatedAttendance.findIndex((a: any) => a.playerId === player.id);

                let mappedStatus = "Absent";
                if (status === "Available") mappedStatus = "Present";
                if (status === "Maybe") mappedStatus = "Late";

                if (playerIndex >= 0) {
                    updatedAttendance[playerIndex] = {
                        ...updatedAttendance[playerIndex],
                        status: mappedStatus,
                        notes: "RSVP: Self Managed"
                    };
                } else {
                    updatedAttendance.push({
                        playerId: player.id,
                        status: mappedStatus,
                        notes: "RSVP: Self Managed"
                    });
                }

                const { error: updateSessionErr } = await supabase
                    .from("training_sessions")
                    .update({ attendance: updatedAttendance })
                    .eq("id", event.id);

                if (updateSessionErr) throw updateSessionErr;
                setEvent({ ...event, attendance: updatedAttendance });
            }

            setCurrentRsvp(status);
            setSuccessMessage("Your availability has been updated.");
            setTimeout(() => {
                setSuccessMessage(null);
                router.push("/player");
            }, 2500);

        } catch (err: any) {
            alert("Error logging response: " + err.message);
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
                <div className="flex flex-col items-center gap-3">
                    <RefreshCw className="h-10 w-10 text-red-600 animate-spin" />
                    <p className="text-slate-400 text-sm font-medium">Resolving secure access...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
                <Card className="w-full max-w-sm border-slate-800 bg-slate-900 shadow-2xl p-6 text-center space-y-4">
                    <div className="h-12 w-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500 mx-auto">
                        <AlertCircle className="h-6 w-6" />
                    </div>
                    <h3 className="font-bold text-white text-lg">Secure Link Expired</h3>
                    <p className="text-xs text-slate-400 leading-relaxed">{error}</p>
                </Card>
            </div>
        );
    }

    const eventName = eventType === "match" ? `Match vs ${event.opponent}` : `Training: ${event.topic || "Squad Practice"}`;
    const formattedDate = new Date(event.date).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
            <Card className="w-full max-w-md border-slate-800 bg-slate-900 shadow-2xl overflow-hidden">
                <CardHeader className="p-6 border-b border-slate-800 bg-slate-900/60 text-center">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-red-500">ClubFlow RSVP Portal</span>
                    <CardTitle className="text-lg font-bold text-white mt-1.5">{eventName}</CardTitle>
                    <div className="flex flex-col items-center gap-1.5 mt-3 text-xs text-slate-400">
                        <div className="flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" /> {formattedDate}</div>
                        <div className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> {event.time}</div>
                        <div className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> {event.location}</div>
                    </div>
                </CardHeader>

                <CardContent className="p-6 space-y-5">
                    {/* User Auth Login/Signup required */}
                    {!sessionUser && (
                        <form onSubmit={handleLogin} className="space-y-4">
                            <div className="text-center space-y-1">
                                <h4 className="font-bold text-white text-sm">Lightweight Account Sign In</h4>
                                <p className="text-xs text-slate-400">Sign in to confirm availability. Haven't registered yet? Check your invite email.</p>
                            </div>

                            {loginError && (
                                <div className="bg-red-950/40 border border-red-500/30 rounded-xl p-3 flex items-center gap-2 text-red-400 text-xs">
                                    <AlertCircle className="h-4 w-4 shrink-0" />
                                    <span>{loginError}</span>
                                </div>
                            )}

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Email Address</label>
                                <Input
                                    type="email"
                                    required
                                    value={loginEmail}
                                    onChange={(e) => setLoginEmail(e.target.value)}
                                    className="bg-slate-950 border-slate-800 text-white text-xs h-10"
                                    placeholder="you@example.com"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Password</label>
                                <Input
                                    type="password"
                                    required
                                    value={loginPassword}
                                    onChange={(e) => setLoginPassword(e.target.value)}
                                    className="bg-slate-950 border-slate-800 text-white text-xs h-10"
                                    placeholder="••••••••"
                                />
                            </div>

                            <Button type="submit" disabled={loginLoading} className="w-full bg-red-600 hover:bg-red-700 text-white font-bold h-10">
                                {loginLoading ? "Signing in..." : "Log In & Continue"}
                            </Button>
                        </form>
                    )}

                    {/* Authenticated Player view */}
                    {sessionUser && player && (
                        <div className="space-y-4 text-center">
                            {successMessage ? (
                                <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-xl p-4 flex flex-col items-center justify-center text-center gap-2 text-emerald-400 text-xs">
                                    <CheckCircle2 className="h-6 w-6 animate-bounce" />
                                    <span className="font-bold">{successMessage}</span>
                                </div>
                            ) : (
                                <>
                                    <div className="flex items-center justify-center gap-2 border-b border-slate-800 pb-3 text-xs text-slate-400">
                                        <span>Logged in as: <strong className="text-white">{player.first_name} {player.last_name}</strong></span>
                                        {isLocked ? (
                                            <span className="flex items-center gap-1 text-red-400 font-bold bg-red-950/20 border border-red-900/30 px-2 py-0.5 rounded">
                                                <Lock className="h-3 w-3" /> Locked
                                            </span>
                                        ) : (
                                            <span className="flex items-center gap-1 text-emerald-400 font-bold bg-emerald-950/20 border border-emerald-900/30 px-2 py-0.5 rounded">
                                                <LockOpen className="h-3 w-3" /> Open
                                            </span>
                                        )}
                                    </div>

                                    {isLocked && (
                                        <div className="bg-red-950/30 border border-red-900/30 rounded-xl p-3 flex items-center justify-center gap-2 text-red-400 text-xs">
                                            <AlertCircle className="h-4.5 w-4.5 shrink-0" />
                                            <span>Responses locked ({lockMessage})</span>
                                        </div>
                                    )}

                                    {!isLocked && (
                                        <div className="grid grid-cols-3 gap-2.5 pt-2">
                                            <Button
                                                onClick={() => handleRsvp("Available")}
                                                disabled={submitting}
                                                className={`h-12 text-xs font-bold rounded-xl transition-all ${
                                                    currentRsvp === "Available"
                                                        ? "bg-emerald-600 text-white font-black scale-105"
                                                        : "bg-slate-800 hover:bg-slate-700 text-slate-300"
                                                }`}
                                            >
                                                Available
                                            </Button>
                                            <Button
                                                onClick={() => handleRsvp("Maybe")}
                                                disabled={submitting}
                                                className={`h-12 text-xs font-bold rounded-xl transition-all ${
                                                    currentRsvp === "Maybe"
                                                        ? "bg-amber-600 text-white font-black scale-105"
                                                        : "bg-slate-800 hover:bg-slate-700 text-slate-300"
                                                }`}
                                            >
                                                Maybe
                                            </Button>
                                            <Button
                                                onClick={() => handleRsvp("Unavailable")}
                                                disabled={submitting}
                                                className={`h-12 text-xs font-bold rounded-xl transition-all ${
                                                    currentRsvp === "Unavailable"
                                                        ? "bg-red-600 text-white font-black scale-105"
                                                        : "bg-slate-800 hover:bg-slate-700 text-slate-300"
                                                }`}
                                            >
                                                Unavailable
                                            </Button>
                                        </div>
                                    )}

                                    {isLocked && (
                                        <div className="py-2 text-slate-300 text-xs">
                                            Your logged response: <strong className="text-white uppercase">{currentRsvp}</strong>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
