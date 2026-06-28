"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CalendarDays, Clock, MapPin, AlertCircle, RefreshCw, Lock, KeyRound, UserCheck, HelpCircle } from "lucide-react";

export default function PinDeviceResponderPage() {
    const params = useParams();
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

    // PIN states
    const [pinMode, setPinMode] = useState<"set" | "enter">("enter");
    const [enteredPin, setEnteredPin] = useState("");
    const [pinError, setPinError] = useState("");
    const [isPinSubmitting, setIsPinSubmitting] = useState(false);

    // RSVP states
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    const loadEventAndSquad = async () => {
        try {
            const res = await fetch(`/api/player/respond?token=${token}`);
            const data = await res.json();

            if (!res.ok || !data.success) {
                setError(data.error || "Invalid or expired availability link.");
                return;
            }

            setEvent(data.event);
            setEventType(data.eventType);
            setPlayers(data.players);
        } catch (err: any) {
            setError("An error occurred loading the availability responder.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (token) {
            loadEventAndSquad();
        }
    }, [token]);

    const isVerified = (playerId: string) => {
        if (typeof window === "undefined") return false;
        return localStorage.getItem(`cf_verified_player_${playerId}`) === "true";
    };

    const handlePlayerClick = (player: any) => {
        setSelectedPlayer(player);
        setSuccessMessage(null);
        setEnteredPin("");
        setPinError("");

        if (player.has_pin) {
            if (isVerified(player.id)) {
                // If device already verified, toggle RSVP directly
                // (We'll prompt for PIN if the backend rejects verification, but normally it's cached)
                setPinMode("enter");
                setIsVerificationModalOpen(true);
            } else {
                setPinMode("enter");
                setIsVerificationModalOpen(true);
            }
        } else {
            setPinMode("set");
            setIsVerificationModalOpen(true);
        }
    };

    const submitResponse = async (player: any, pinCode: string) => {
        setIsSubmitting(true);
        setPinError("");
        setIsPinSubmitting(true);

        try {
            // Find current status to toggle it
            let currentStatus = "Unavailable";
            if (eventType === "match") {
                const currentNotes = event.notes || "";
                const matchRaw = currentNotes.match(/\[AVAILABILITY:\s*(.*?)\s*\]/);
                if (matchRaw && matchRaw[1]) {
                    try {
                        const list = JSON.parse(matchRaw[1]);
                        const record = list.find((a: any) => a.playerId === player.id);
                        currentStatus = record?.status || "Unavailable";
                    } catch (e) {}
                }
            } else {
                const attendance = event.attendance || [];
                const record = attendance.find((a: any) => a.playerId === player.id);
                currentStatus = (record?.status === "Present" || record?.status === "Late") ? "Available" : "Unavailable";
            }

            const nextStatus = currentStatus === "Available" ? "Unavailable" : "Available";

            const res = await fetch("/api/player/respond", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    playerId: player.id,
                    eventId: event.id,
                    eventType,
                    status: nextStatus,
                    pin: pinCode
                })
            });

            const data = await res.json();

            if (!res.ok || !data.success) {
                setPinError(data.error || "Failed to submit response.");
                setIsPinSubmitting(false);
                setIsSubmitting(false);
                return;
            }

            // Successfully set/verified
            localStorage.setItem(`cf_verified_player_${player.id}`, "true");
            setIsVerificationModalOpen(false);
            setSuccessMessage(`${player.first_name} marked as ${nextStatus}!`);

            // Reload data in background
            await loadEventAndSquad();

            setTimeout(() => {
                setSelectedPlayer(null);
                setSuccessMessage(null);
            }, 2500);

        } catch (err: any) {
            setPinError("Connection error. Please try again.");
        } finally {
            setIsPinSubmitting(false);
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

        await submitResponse(selectedPlayer, enteredPin);
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
                <div className="flex flex-col items-center gap-3">
                    <RefreshCw className="h-10 w-10 text-red-655 animate-spin" />
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
                                const hasPin = player.has_pin;

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
