"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CalendarDays, Clock, MapPin, CheckCircle, AlertCircle, RefreshCw, Lock, KeyRound, UserCheck, HelpCircle } from "lucide-react";

// Position order helper
const positionOrder: Record<string, number> = {
    "GK": 1, "RB": 2, "LB": 2, "CB": 2, "RWB": 2, "LWB": 2, "DEF": 2,
    "CDM": 3, "CM": 3, "CAM": 3, "RM": 3, "LM": 3, "MID": 3,
    "RW": 4, "LW": 4, "CF": 4, "ST": 4, "FWD": 4
};

// Web Crypto SHA-256 helper
async function hashPin(pin: string): Promise<string> {
    const msgBuffer = new TextEncoder().encode(pin);
    const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

export default function PinDeviceResponderPage() {
    const params = useParams();
    const router = useRouter();
    const token = Array.isArray(params?.token) ? params.token[0] : params?.token;

    // Load states
    const [loading, setLoading] = useState(true);
    const [event, setEvent] = useState<any | null>(null);
    const [eventType, setEventType] = useState<"match" | "training" | null>(null);
    const [players, setPlayers] = useState<any[]>([]);
    const [error, setError] = useState<string | null>(null);

    // Selected player for verification
    const [selectedPlayer, setSelectedPlayer] = useState<any | null>(null);
    const [isVerificationModalOpen, setIsVerificationModalOpen] = useState(false);

    // PIN & OTP states
    const [pinMode, setPinMode] = useState<"set" | "enter">("enter");
    const [enteredPin, setEnteredPin] = useState("");
    const [otpCode, setOtpCode] = useState("");
    const [enteredOtp, setEnteredOtp] = useState("");
    const [pinError, setPinError] = useState("");
    const [isPinSubmitting, setIsPinSubmitting] = useState(false);

    // RSVP states
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    useEffect(() => {
        if (!token) return;

        async function loadEventAndSquad() {
            try {
                // 1. Fetch event by token
                // Check matches by event_token or id
                let { data: matchData } = await supabase
                    .from("matches")
                    .select("*")
                    .eq("event_token", token)
                    .single();

                if (!matchData && token && token.length === 36) {
                    const { data: matchById } = await supabase
                        .from("matches")
                        .select("*")
                        .eq("id", token)
                        .single();
                    if (matchById) matchData = matchById;
                }

                let resolvedEvent = null;
                let resolvedType: "match" | "training" | null = null;

                if (matchData) {
                    resolvedEvent = matchData;
                    resolvedType = "match";
                } else {
                    let { data: sessionData } = await supabase
                        .from("training_sessions")
                        .select("*")
                        .eq("event_token", token)
                        .single();

                    if (!sessionData && token && token.length === 36) {
                        const { data: sessionById } = await supabase
                            .from("training_sessions")
                            .select("*")
                            .eq("id", token)
                            .single();
                        if (sessionById) sessionData = sessionById;
                    }

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

                // 2. Fetch players for this club
                const { data: squadData, error: squadErr } = await supabase
                    .from("players")
                    .select("*")
                    .eq("club_id", resolvedEvent.club_id);

                if (squadErr || !squadData) {
                    setError("Unable to load squad details.");
                    setLoading(false);
                    return;
                }

                // Filter squad matching if training
                let eligible = [...squadData];
                if (resolvedType === "training") {
                    const isFirstTeamSession = resolvedEvent.squad === "All" || resolvedEvent.squad === "firstTeam" || resolvedEvent.squad === "First Team";
                    const checkSquadMatch = (playerSquadsStr: string | undefined | null, targetSquad: string) => {
                        if (!playerSquadsStr) return false;
                        const squads = playerSquadsStr.split(",").map(s => s.trim().toLowerCase());
                        const cleanTarget = targetSquad.toLowerCase();
                        if (cleanTarget === "firstteam" || cleanTarget === "first team") {
                            return squads.includes("first team") || squads.includes("firstteam");
                        }
                        return squads.includes(cleanTarget);
                    };
                    const isFirstTeam = (squad: string | undefined | null) => {
                        if (!squad) return false;
                        const squads = squad.split(",").map(s => s.trim().toLowerCase());
                        return squads.includes("first team") || squads.includes("firstteam");
                    };

                    eligible = squadData.filter(p => {
                        if (isFirstTeamSession) {
                            return isFirstTeam(p.squad) || p.is_in_training_squad;
                        }
                        return checkSquadMatch(p.squad, resolvedEvent.squad);
                    });
                }

                // Sort by position order
                eligible.sort((a, b) => (positionOrder[a.position] || 99) - (positionOrder[b.position] || 99));
                setPlayers(eligible);

            } catch (err: any) {
                console.error(err);
                setError("An error occurred loading the availability responder.");
            } finally {
                setLoading(false);
            }
        }

        loadEventAndSquad();
    }, [token]);

    const isVerified = (playerId: string) => {
        if (typeof window === "undefined") return false;
        return localStorage.getItem(`cf_verified_player_${playerId}`) === "true";
    };

    const handlePlayerClick = (player: any) => {
        setSelectedPlayer(player);
        setSuccessMessage(null);
        setEnteredPin("");
        setEnteredOtp("");
        setPinError("");

        const code = Math.floor(1000 + Math.random() * 9000).toString();
        setOtpCode(code);

        if (player.pin_hash) {
            if (isVerified(player.id)) {
                toggleAvailability(player);
            } else {
                setPinMode("enter");
                setIsVerificationModalOpen(true);
            }
        } else {
            setPinMode("set");
            setIsVerificationModalOpen(true);
        }
    };

    const toggleAvailability = async (player: any, pinHashToSave?: string) => {
        if (!event || !eventType) return;
        setIsSubmitting(true);

        try {
            if (eventType === "match") {
                // Fetch fresh match details to prevent overrides
                const { data: freshMatch } = await supabase
                    .from("matches")
                    .select("notes")
                    .eq("id", event.id)
                    .single();

                const currentNotes = freshMatch?.notes || "";
                let currentList: any[] = [];
                const matchRaw = currentNotes.match(/\[AVAILABILITY:\s*(.*?)\s*\]/);
                if (matchRaw && matchRaw[1]) {
                    try {
                        currentList = JSON.parse(matchRaw[1]);
                    } catch (e) {
                        currentList = [];
                    }
                }

                // Toggle: Available -> Unavailable -> Available
                const record = currentList.find(a => a.playerId === player.id);
                const nextStatus = record?.status === "Available" ? "Unavailable" : "Available";

                const updatedList = [...currentList];
                const playerIndex = updatedList.findIndex(a => a.playerId === player.id);

                if (playerIndex >= 0) {
                    updatedList[playerIndex] = { playerId: player.id, status: nextStatus };
                } else {
                    updatedList.push({ playerId: player.id, status: nextStatus });
                }

                let cleanBaseNotes = currentNotes.replace(/\[AVAILABILITY:.*?\]\n?/, "").trim();
                const finalNotes = `${cleanBaseNotes}\n[AVAILABILITY: ${JSON.stringify(updatedList)} ]`.trim();

                const { error: updateMatchErr } = await supabase
                    .from("matches")
                    .update({ notes: finalNotes })
                    .eq("id", event.id);

                if (updateMatchErr) throw updateMatchErr;
                setEvent({ ...event, notes: finalNotes });
                setSuccessMessage(`${player.first_name} marked as ${nextStatus}!`);

            } else {
                // Fetch fresh training details
                const { data: freshSession } = await supabase
                    .from("training_sessions")
                    .select("attendance")
                    .eq("id", event.id)
                    .single();

                const existingAttendance = freshSession?.attendance || [];
                const record = existingAttendance.find((a: any) => a.playerId === player.id);
                const currentStatus = record?.status ?? "Absent";
                const newStatus = (currentStatus === "Present" || currentStatus === "Late") ? "Absent" : "Present";

                const updatedAttendance = [...existingAttendance];
                const playerIndex = updatedAttendance.findIndex((a: any) => a.playerId === player.id);

                if (playerIndex >= 0) {
                    updatedAttendance[playerIndex] = { ...updatedAttendance[playerIndex], status: newStatus };
                } else {
                    updatedAttendance.push({ playerId: player.id, status: newStatus, notes: "RSVP: Self Managed" });
                }

                const { error: updateSessionErr } = await supabase
                    .from("training_sessions")
                    .update({ attendance: updatedAttendance })
                    .eq("id", event.id);

                if (updateSessionErr) throw updateSessionErr;
                setEvent({ ...event, attendance: updatedAttendance });
                setSuccessMessage(`${player.first_name} marked as ${newStatus === "Present" ? "Available" : "Unavailable"}!`);
            }

            // Save new PIN if set
            if (pinHashToSave) {
                const { error: playerUpdateErr } = await supabase
                    .from("players")
                    .update({
                        pin_hash: pinHashToSave,
                        status: "Registered"
                    })
                    .eq("id", player.id);

                if (playerUpdateErr) throw playerUpdateErr;

                // Sync UI state
                setPlayers(players.map(p => p.id === player.id ? { ...p, pin_hash: pinHashToSave, status: "Registered" } : p));
            }

            setTimeout(() => {
                setSelectedPlayer(null);
                setSuccessMessage(null);
            }, 2500);

        } catch (err: any) {
            alert("Error saving response: " + err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handlePinSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedPlayer) return;

        if (enteredPin.length !== 6 || !/^\d+$/.test(enteredPin)) {
            setPinError("PIN must be exactly 6 digits.");
            return;
        }

        setIsPinSubmitting(true);
        setPinError("");

        try {
            const hashed = await hashPin(enteredPin);

            if (pinMode === "set") {
                localStorage.setItem(`cf_verified_player_${selectedPlayer.id}`, "true");
                setIsVerificationModalOpen(false);
                await toggleAvailability(selectedPlayer, hashed);
            } else {
                if (hashed === selectedPlayer.pin_hash) {
                    localStorage.setItem(`cf_verified_player_${selectedPlayer.id}`, "true");
                    setIsVerificationModalOpen(false);
                    await toggleAvailability(selectedPlayer);
                } else {
                    setPinError("Incorrect PIN. Please try again.");
                }
            }
        } catch (err: any) {
            setPinError("An error occurred during verification.");
        } finally {
            setIsPinSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
                <div className="flex flex-col items-center gap-3">
                    <RefreshCw className="h-10 w-10 text-red-650 animate-spin" />
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
                    <p className="text-xs text-slate-450 leading-relaxed">{error}</p>
                </Card>
            </div>
        );
    }

    const eventName = eventType === "match" ? `Match vs ${event.opponent}` : `Training: ${event.topic || "Squad Practice"}`;
    const formattedDate = new Date(event.date).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-12">
            {/* Header Branding */}
            <div className="bg-slate-900 border-b border-slate-800 py-4 px-6 mb-6">
                <div className="max-w-4xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 bg-red-600 rounded-xl flex items-center justify-center shadow-lg">
                            <span className="font-black text-white text-xs">⚽</span>
                        </div>
                        <div>
                            <h1 className="font-bold text-white tracking-tight">Camden United</h1>
                            <p className="text-xs text-slate-400">RSVP availability portal</p>
                        </div>
                    </div>
                    <Badge variant="outline" className="border-red-500/30 text-red-400 bg-red-950/20 px-2.5 py-1">
                        1-Tap Check-In
                    </Badge>
                </div>
            </div>

            <div className="max-w-4xl mx-auto px-4 space-y-6">
                {/* Event Details Card */}
                <Card className="bg-slate-900 border-slate-800 shadow-xl overflow-hidden relative border-l-4 border-l-red-650">
                    <CardHeader className="pb-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <Badge className="bg-red-950/50 text-red-450 border border-red-900/50 uppercase tracking-wider text-[10px]">
                                {event.squad || "Squad"} Event
                            </Badge>
                            <span className="text-xs text-slate-450 flex items-center gap-1 font-semibold">
                                <Clock className="h-3.5 w-3.5" /> Kick Off: {event.time}
                            </span>
                        </div>
                        <h2 className="text-xl font-black text-white mt-3">{eventName}</h2>
                        <CardDescription className="text-slate-400 leading-relaxed mt-1">
                            Please confirm whether you are attending the session on {formattedDate} at {event.time} at {event.location || "TBD"}.
                            <span className="block mt-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
                                💡 Select your name below to instantly toggle your availability.
                            </span>
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-0 border-t border-slate-800/50 mt-2 text-sm text-slate-350">
                        <div className="flex items-center gap-3 pt-3">
                            <CalendarDays className="h-5 w-5 text-red-500" />
                            <div>
                                <p className="text-xs text-slate-550 uppercase tracking-wider font-semibold">Date</p>
                                <p className="font-medium text-white">{formattedDate}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 pt-3">
                            <MapPin className="h-5 w-5 text-red-500" />
                            <div>
                                <p className="text-xs text-slate-550 uppercase tracking-wider font-semibold">Location</p>
                                <p className="font-medium text-white">{event.location || "TBD"}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Success Toast */}
                {selectedPlayer && successMessage && (
                    <Card className="bg-slate-900 border-red-500/50 shadow-xl border-t-2 animate-in fade-in slide-in-from-top-4 duration-300">
                        <CardContent className="p-4 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <Avatar className="h-10 w-10 border border-slate-700">
                                    <AvatarImage src={selectedPlayer.image_url} />
                                    <AvatarFallback className="bg-slate-800 text-white font-bold">
                                        {selectedPlayer.first_name[0]}{selectedPlayer.last_name[0]}
                                    </AvatarFallback>
                                </Avatar>
                                <div>
                                    <h3 className="text-base font-bold text-white">{selectedPlayer.first_name} {selectedPlayer.last_name}</h3>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <span className="text-xs text-slate-400 font-semibold uppercase">{selectedPlayer.position} • Verified Device ✓</span>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-xl px-4 py-2 flex items-center gap-2 text-emerald-400 font-semibold text-sm">
                                <UserCheck className="h-4.5 w-4.5 animate-pulse" />
                                <span>{successMessage}</span>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Player List Grid */}
                <Card className="bg-slate-900 border-slate-800 shadow-xl">
                    <CardHeader className="pb-4">
                        <CardTitle className="text-lg text-white font-bold">Squad List</CardTitle>
                        <CardDescription className="text-slate-400">
                            Select your name to toggle your availability. Secured slots require your 6-digit PIN.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                            {players.map((player) => {
                                let isAvailable = false;
                                if (eventType === "match") {
                                    const currentNotes = event.notes || "";
                                    const matchRaw = currentNotes.match(/\[AVAILABILITY:\s*(.*?)\s*\]/);
                                    if (matchRaw && matchRaw[1]) {
                                        try {
                                            const list = JSON.parse(matchRaw[1]);
                                            const record = list.find((a: any) => a.playerId === player.id);
                                            isAvailable = record?.status === "Available";
                                        } catch (e) {
                                            isAvailable = false;
                                        }
                                    }
                                } else {
                                    const attendance = event.attendance || [];
                                    const record = attendance.find((a: any) => a.playerId === player.id);
                                    isAvailable = record?.status === "Present" || record?.status === "Late";
                                }

                                const isUserVerified = isVerified(player.id);
                                const hasPin = !!player.pin_hash;

                                return (
                                    <div
                                        key={player.id}
                                        onClick={() => !isSubmitting && handlePlayerClick(player)}
                                        className={`
                                            relative flex flex-col items-center p-4 rounded-xl border cursor-pointer select-none text-center gap-1.5 transition-all duration-155 min-h-[110px]
                                            ${isAvailable
                                                ? "bg-emerald-950/30 border-emerald-500 shadow-md shadow-emerald-500/10 scale-[1.02]"
                                                : "bg-slate-800/50 border-slate-800 hover:border-slate-700 hover:bg-slate-800"
                                            }
                                        `}
                                    >
                                        {/* Verification indicator */}
                                        {isUserVerified ? (
                                            <div className="absolute top-2 right-2 flex items-center justify-center h-4.5 w-4.5 rounded-full bg-emerald-500/20 border border-emerald-400 text-emerald-400 text-[8px] font-bold">
                                                ✓
                                            </div>
                                        ) : hasPin ? (
                                            <div className="absolute top-2 right-2 text-slate-500" title="Secured with PIN">
                                                <Lock className="h-3 w-3" />
                                            </div>
                                        ) : null}

                                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                                            {player.position}
                                        </span>
                                        <span className="text-sm font-bold text-white leading-tight">
                                            {player.first_name}
                                        </span>
                                        <span className="text-xs text-slate-400 leading-tight">
                                            {player.last_name}
                                        </span>

                                        <div className={`mt-1.5 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full
                                            ${isAvailable 
                                                ? "bg-emerald-950/50 text-emerald-400 border border-emerald-900/50" 
                                                : "bg-slate-900 text-slate-500 border border-slate-800"
                                            }`}
                                        >
                                            {isAvailable ? "Available" : "Unavailable"}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* PIN Verification Modal */}
            {isVerificationModalOpen && selectedPlayer && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
                        {/* Modal Header */}
                        <div className="p-5 border-b border-slate-800 bg-slate-900/80 flex justify-between items-start">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-xl bg-red-600/10 border border-red-500/20 flex items-center justify-center text-red-500">
                                    {pinMode === "set" ? <KeyRound className="h-5 w-5" /> : <Lock className="h-5 w-5" />}
                                </div>
                                <div>
                                    <h3 className="font-bold text-lg text-white">
                                        {pinMode === "set" ? "Secure Your Slot" : "Enter Check-in PIN"}
                                    </h3>
                                    <p className="text-xs text-slate-450 font-semibold">For {selectedPlayer.first_name} {selectedPlayer.last_name}</p>
                                </div>
                            </div>
                            <button 
                                onClick={() => setIsVerificationModalOpen(false)} 
                                className="text-slate-500 hover:text-slate-200 text-lg transition-colors p-1"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Modal Content */}
                        <form onSubmit={handlePinSubmit} className="p-5 space-y-4">
                            {pinError && (
                                <div className="bg-red-950/40 border border-red-500/30 rounded-xl p-3 flex items-center gap-2.5 text-red-400 text-xs">
                                    <AlertCircle className="h-4.5 w-4.5 shrink-0" />
                                    <span>{pinError}</span>
                                </div>
                            )}

                            {pinMode === "set" ? (
                                <div className="space-y-3">
                                    <p className="text-xs text-slate-355 leading-relaxed font-semibold">
                                        To prevent others from checking in under your name, choose a 6-digit PIN to lock your slot on this device.
                                    </p>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Choose 6-Digit PIN</label>
                                        <Input
                                            type="password"
                                            pattern="\d*"
                                            inputMode="numeric"
                                            maxLength={6}
                                            required
                                            value={enteredPin}
                                            onChange={(e) => setEnteredPin(e.target.value.replace(/\D/g, "").substring(0, 6))}
                                            placeholder="••••••"
                                            className="bg-slate-950 border-slate-800 text-white font-mono text-center tracking-widest text-lg h-11 focus-visible:ring-red-500"
                                        />
                                    </div>
                                    <Button 
                                        type="submit"
                                        disabled={isPinSubmitting || enteredPin.length !== 6}
                                        className="w-full bg-red-600 hover:bg-red-700 text-white font-bold h-11"
                                    >
                                        {isPinSubmitting ? "Securing Name..." : "Lock Name & Check-in"}
                                    </Button>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <p className="text-xs text-slate-300 leading-relaxed font-semibold">
                                        Your name slot is locked. Please enter your 6-digit PIN to check in.
                                    </p>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Enter PIN</label>
                                        <Input
                                            type="password"
                                            pattern="\d*"
                                            inputMode="numeric"
                                            maxLength={6}
                                            required
                                            value={enteredPin}
                                            onChange={(e) => setEnteredPin(e.target.value.replace(/\D/g, "").substring(0, 6))}
                                            placeholder="••••••"
                                            className="bg-slate-950 border-slate-800 text-white font-mono text-center tracking-widest text-lg h-11 focus-visible:ring-red-500"
                                        />
                                    </div>
                                    <Button 
                                        type="submit"
                                        disabled={isPinSubmitting || enteredPin.length !== 6}
                                        className="w-full bg-red-600 hover:bg-red-700 text-white font-bold h-11"
                                    >
                                        {isPinSubmitting ? "Verifying..." : "Verify & Check-in"}
                                    </Button>
                                    <div className="text-center pt-1.5">
                                        <p className="text-[10px] text-slate-500 flex items-center justify-center gap-1 font-semibold">
                                            <HelpCircle className="h-3 w-3" />
                                            <span>Forgot PIN? Ask your coach to reset it.</span>
                                        </p>
                                    </div>
                                </div>
                            )}
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
