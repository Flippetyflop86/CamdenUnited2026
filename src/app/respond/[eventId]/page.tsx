"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CalendarDays, Clock, MapPin, KeyRound, CheckCircle2, AlertCircle, RefreshCw, MailOpen } from "lucide-react";
import crypto from "crypto";

interface Player {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    notes?: string;
    pin_hash?: string;
    trusted_devices?: any[];
}

export default function EventResponderPage() {
    const params = useParams();
    const router = useRouter();
    const eventId = Array.isArray(params?.eventId) ? params.eventId[0] : params?.eventId;

    // Event & Club data
    const [event, setEvent] = useState<any | null>(null);
    const [eventType, setEventType] = useState<"match" | "training" | null>(null);
    const [players, setPlayers] = useState<Player[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Selected responder details
    const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
    const [selectedPlayerId, setSelectedPlayerId] = useState("");
    const [authState, setAuthState] = useState<"unauthenticated" | "verify_pin" | "verify_otp" | "otp_pin_reset" | "authenticated">("unauthenticated");

    // Form inputs
    const [enteredPin, setEnteredPin] = useState("");
    const [enteredOtp, setEnteredOtp] = useState("");
    const [pinAttempts, setPinAttempts] = useState(0);
    const [otpPurpose, setOtpPurpose] = useState<"new_device" | "reset_pin">("new_device");
    const [newPin, setNewPin] = useState("");
    const [confirmNewPin, setConfirmNewPin] = useState("");

    // Submit states
    const [submitting, setSubmitting] = useState(false);
    const [pinError, setPinError] = useState("");
    const [otpError, setOtpError] = useState("");
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    useEffect(() => {
        if (!eventId) return;

        async function loadData() {
            try {
                // 1. Resolve event details (check matches first, then training sessions)
                const { data: matchData } = await supabase
                    .from("matches")
                    .select("*")
                    .eq("id", eventId)
                    .single();

                let clubId = "";
                if (matchData) {
                    setEvent(matchData);
                    setEventType("match");
                    clubId = matchData.club_id;
                } else {
                    const { data: sessionData } = await supabase
                        .from("training_sessions")
                        .select("*")
                        .eq("id", eventId)
                        .single();

                    if (sessionData) {
                        setEvent(sessionData);
                        setEventType("training");
                        clubId = sessionData.club_id;
                    }
                }

                if (!clubId) {
                    setError("Event not found or link has expired.");
                    setLoading(false);
                    return;
                }

                // 2. Fetch list of active players in this club to select from
                const { data: playersData } = await supabase
                    .from("players")
                    .select("id, first_name, last_name, email, notes, pin_hash, trusted_devices")
                    .eq("club_id", clubId);

                if (playersData) {
                    setPlayers(playersData.map(p => ({
                        id: p.id,
                        first_name: p.first_name,
                        last_name: p.last_name,
                        email: p.email,
                        notes: p.notes,
                        pin_hash: p.pin_hash,
                        trusted_devices: p.trusted_devices
                    })));
                }

                // 3. Auto-detect if device has a saved player token
                const localPlayerId = localStorage.getItem("cf_player_id");
                const localDeviceToken = localStorage.getItem("cf_player_device_token");
                if (localPlayerId && localDeviceToken && playersData) {
                    const matched = playersData.find(p => p.id === localPlayerId);
                    if (matched) {
                        const devices = Array.isArray(matched.trusted_devices) ? matched.trusted_devices : [];
                        const isTrusted = devices.some((d: any) => d.token === localDeviceToken);
                        if (isTrusted) {
                            // Automatically skip selection, jump straight to PIN verification
                            setSelectedPlayer(matched as any);
                            setAuthState("verify_pin");
                        }
                    }
                }

            } catch (err: any) {
                console.error(err);
                setError("An error occurred loading event details.");
            } finally {
                setLoading(false);
            }
        }

        loadData();
    }, [eventId]);

    const handlePlayerSelect = async (val: string) => {
        const player = players.find(p => p.id === val);
        if (!player) return;

        setSelectedPlayer(player);
        setPinError("");
        setOtpError("");
        setPinAttempts(0);
        setEnteredPin("");
        setEnteredOtp("");

        // Check if device is trusted
        const localDeviceToken = localStorage.getItem("cf_player_device_token");
        const devices = Array.isArray(player.trusted_devices) ? player.trusted_devices : [];
        const isTrusted = devices.some((d: any) => d.token === localDeviceToken);

        if (isTrusted) {
            setAuthState("verify_pin");
        } else {
            // Unknown device -> trigger OTP request automatically
            setAuthState("verify_otp");
            setOtpPurpose("new_device");
            await requestOtpCode(player.id, "new_device");
        }
    };

    const requestOtpCode = async (pId: string, purpose: "new_device" | "reset_pin") => {
        try {
            await fetch("/api/player/request-otp", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ playerId: pId, purpose })
            });
        } catch (e) {
            console.error("Failed to request OTP:", e);
        }
    };

    const handlePinSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedPlayer) return;

        setPinError("");
        const hashed = crypto.createHash("sha256").update(enteredPin).digest("hex");

        if (hashed === selectedPlayer.pin_hash) {
            setAuthState("authenticated");
        } else {
            const nextAttempts = pinAttempts + 1;
            setPinAttempts(nextAttempts);
            setEnteredPin("");

            if (nextAttempts >= 3) {
                setPinError("Too many incorrect attempts. Verification code sent to email.");
                setAuthState("verify_otp");
                setOtpPurpose("reset_pin");
                await requestOtpCode(selectedPlayer.id, "reset_pin");
            } else {
                setPinError(`Incorrect PIN. ${3 - nextAttempts} attempts remaining.`);
            }
        }
    };

    const handleOtpSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedPlayer) return;

        setOtpError("");
        setSubmitting(true);

        try {
            const payload: any = {
                playerId: selectedPlayer.id,
                otpCode: enteredOtp,
                purpose: otpPurpose
            };

            if (otpPurpose === "reset_pin") {
                if (newPin !== confirmNewPin) {
                    setOtpError("PINs do not match");
                    setSubmitting(false);
                    return;
                }
                payload.newPin = newPin;
            }

            const res = await fetch("/api/player/verify-otp", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            const data = await res.json();
            if (!res.ok || !data.success) {
                throw new Error(data.error || "Verification failed");
            }

            // Trust the new device
            localStorage.setItem("cf_player_id", selectedPlayer.id);
            localStorage.setItem("cf_player_device_token", data.deviceToken);
            localStorage.setItem("cf_player_name", `${selectedPlayer.first_name} ${selectedPlayer.last_name}`);

            // Refresh player info dynamically
            selectedPlayer.trusted_devices = [...(selectedPlayer.trusted_devices || []), { token: data.deviceToken }];
            if (otpPurpose === "reset_pin") {
                selectedPlayer.pin_hash = crypto.createHash("sha256").update(newPin).digest("hex");
            }

            setSuccessMessage(otpPurpose === "reset_pin" ? "PIN Reset Successful! Entering portal..." : "Device Approved! Entering portal...");
            setEnteredOtp("");
            setNewPin("");
            setConfirmNewPin("");

            setTimeout(() => {
                setSuccessMessage(null);
                setAuthState("authenticated");
            }, 2000);

        } catch (err: any) {
            setOtpError(err.message || "Invalid or expired verification code.");
        } finally {
            setSubmitting(false);
        }
    };

    const handleRsvp = async (status: "Available" | "Maybe" | "Unavailable") => {
        if (!selectedPlayer || !eventId || !eventType) return;

        setSubmitting(true);
        const deviceToken = localStorage.getItem("cf_player_device_token");

        try {
            const res = await fetch("/api/player/respond", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    playerId: selectedPlayer.id,
                    eventId,
                    eventType,
                    status,
                    deviceToken
                })
            });

            const data = await res.json();
            if (!res.ok || !data.success) {
                throw new Error(data.error || "Failed to submit RSVP");
            }

            setSuccessMessage(`Thank you. Your availability has been updated to ${status}.`);
            setTimeout(() => {
                router.push("/player");
            }, 3000);

        } catch (err: any) {
            setError(err.message || "Failed to submit availability.");
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
                <div className="flex flex-col items-center gap-3">
                    <RefreshCw className="h-10 w-10 text-red-600 animate-spin" />
                    <p className="text-slate-400 text-sm font-medium">Loading details...</p>
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
                    <h3 className="font-bold text-white text-lg">Response Link Inactive</h3>
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
                    <span className="text-[10px] font-bold uppercase tracking-widest text-red-500">ClubFlow RSVP Link</span>
                    <CardTitle className="text-lg font-bold text-white mt-1.5">{eventName}</CardTitle>
                    <div className="flex flex-col items-center gap-1.5 mt-3 text-xs text-slate-400">
                        <div className="flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" /> {formattedDate}</div>
                        <div className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> {event.time}</div>
                        <div className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> {event.location}</div>
                    </div>
                </CardHeader>

                <CardContent className="p-6 space-y-5">
                    {successMessage && (
                        <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-xl p-4 flex flex-col items-center justify-center text-center gap-2 text-emerald-400 text-xs">
                            <CheckCircle2 className="h-6 w-6 animate-bounce" />
                            <span className="font-bold">{successMessage}</span>
                        </div>
                    )}

                    {!successMessage && authState === "unauthenticated" && (
                        <div className="space-y-4">
                            <div className="space-y-1.5">
                                <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Select Your Name</Label>
                                <Select value={selectedPlayerId} onValueChange={(val) => { setSelectedPlayerId(val); handlePlayerSelect(val); }}>
                                    <SelectTrigger className="bg-slate-950 border-slate-800 text-white h-11">
                                        <SelectValue placeholder="Choose profile..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {players.map(p => (
                                            <SelectItem key={p.id} value={p.id}>{p.first_name} {p.last_name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    )}

                    {!successMessage && authState === "verify_pin" && selectedPlayer && (
                        <form onSubmit={handlePinSubmit} className="space-y-4">
                            <div className="text-center pb-2">
                                <p className="text-xs text-slate-400">Hi {selectedPlayer.first_name}, please authenticate to confirm availability.</p>
                            </div>

                            {pinError && (
                                <div className="bg-red-950/40 border border-red-500/30 rounded-xl p-3 flex items-center gap-2.5 text-red-400 text-xs">
                                    <AlertCircle className="h-4.5 w-4.5 shrink-0" />
                                    <span>{pinError}</span>
                                </div>
                            )}

                            <div className="space-y-1.5">
                                <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Enter Your 4-Digit PIN</Label>
                                <Input
                                    type="password"
                                    pattern="\d*"
                                    inputMode="numeric"
                                    maxLength={4}
                                    required
                                    value={enteredPin}
                                    onChange={(e) => setEnteredPin(e.target.value.replace(/\D/g, "").substring(0, 4))}
                                    placeholder="••••"
                                    className="bg-slate-950 border-slate-800 text-white font-mono text-center tracking-widest text-lg h-11 focus-visible:ring-red-500"
                                />
                            </div>

                            <div className="flex gap-2">
                                <Button type="button" variant="ghost" className="text-xs text-slate-500 hover:text-slate-300" onClick={() => setAuthState("unauthenticated")}>
                                    Change User
                                </Button>
                                <Button type="submit" className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold h-11">
                                    Confirm PIN & RSVP
                                </Button>
                            </div>
                        </form>
                    )}

                    {!successMessage && authState === "verify_otp" && selectedPlayer && (
                        <form onSubmit={handleOtpSubmit} className="space-y-4">
                            <div className="text-center space-y-1 pb-1">
                                <div className="h-10 w-10 bg-blue-500/10 border border-blue-500/20 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-2">
                                    <MailOpen className="h-5 w-5" />
                                </div>
                                <h4 className="font-bold text-white text-sm">Security Verification</h4>
                                <p className="text-xs text-slate-400 leading-relaxed">
                                    We sent a 6-digit OTP code to <strong className="text-white">{selectedPlayer.email.substring(0, 3)}***@{selectedPlayer.email.split("@")[1]}</strong>
                                </p>
                            </div>

                            {otpError && (
                                <div className="bg-red-950/40 border border-red-500/30 rounded-xl p-3 flex items-center gap-2.5 text-red-400 text-xs">
                                    <AlertCircle className="h-4.5 w-4.5 shrink-0" />
                                    <span>{otpError}</span>
                                </div>
                            )}

                            <div className="space-y-1.5">
                                <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">6-Digit Verification Code</Label>
                                <Input
                                    type="text"
                                    pattern="\d*"
                                    inputMode="numeric"
                                    maxLength={6}
                                    required
                                    value={enteredOtp}
                                    onChange={(e) => setEnteredOtp(e.target.value.replace(/\D/g, "").substring(0, 6))}
                                    placeholder="e.g. 123456"
                                    className="bg-slate-950 border-slate-800 text-white font-mono text-center tracking-widest text-base h-11 focus-visible:ring-red-500"
                                />
                            </div>

                            {otpPurpose === "reset_pin" && (
                                <div className="space-y-3 border-t border-slate-800 pt-3">
                                    <div className="space-y-1.5">
                                        <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Choose New 4-Digit PIN</Label>
                                        <Input
                                            type="password"
                                            pattern="\d*"
                                            inputMode="numeric"
                                            maxLength={4}
                                            required
                                            value={newPin}
                                            onChange={(e) => setNewPin(e.target.value.replace(/\D/g, "").substring(0, 4))}
                                            placeholder="••••"
                                            className="bg-slate-950 border-slate-800 text-white font-mono text-center tracking-widest text-lg h-11 focus-visible:ring-red-500"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Confirm New PIN</Label>
                                        <Input
                                            type="password"
                                            pattern="\d*"
                                            inputMode="numeric"
                                            maxLength={4}
                                            required
                                            value={confirmNewPin}
                                            onChange={(e) => setConfirmNewPin(e.target.value.replace(/\D/g, "").substring(0, 4))}
                                            placeholder="••••"
                                            className="bg-slate-950 border-slate-800 text-white font-mono text-center tracking-widest text-lg h-11 focus-visible:ring-red-500"
                                        />
                                    </div>
                                </div>
                            )}

                            <div className="flex gap-2">
                                <Button type="button" variant="ghost" className="text-xs text-slate-500 hover:text-slate-300" onClick={() => setAuthState("unauthenticated")}>
                                    Cancel
                                </Button>
                                <Button type="submit" disabled={submitting} className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold h-11">
                                    {submitting ? "Verifying..." : "Verify Code"}
                                </Button>
                            </div>
                        </form>
                    )}

                    {!successMessage && authState === "authenticated" && selectedPlayer && (
                        <div className="space-y-4 text-center">
                            <p className="text-xs text-slate-400">Verify details and submit response as <strong className="text-white">{selectedPlayer.first_name} {selectedPlayer.last_name}</strong>.</p>
                            
                            <div className="grid grid-cols-3 gap-2.5 pt-2">
                                <Button 
                                    onClick={() => handleRsvp("Available")}
                                    disabled={submitting}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-14 flex flex-col gap-0.5 rounded-xl transition-all"
                                >
                                    <span className="text-sm font-black">Available</span>
                                </Button>
                                <Button 
                                    onClick={() => handleRsvp("Maybe")}
                                    disabled={submitting}
                                    className="bg-amber-600 hover:bg-amber-700 text-white font-bold h-14 flex flex-col gap-0.5 rounded-xl transition-all"
                                >
                                    <span className="text-sm font-black">Maybe</span>
                                </Button>
                                <Button 
                                    onClick={() => handleRsvp("Unavailable")}
                                    disabled={submitting}
                                    className="bg-red-600 hover:bg-red-700 text-white font-bold h-14 flex flex-col gap-0.5 rounded-xl transition-all"
                                >
                                    <span className="text-sm font-black">Declined</span>
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

// Simple label helper since it is used inside component
function Label({ children, className }: { children: React.ReactNode, className?: string }) {
    return <label className={`block text-xs font-bold text-slate-400 ${className}`}>{children}</label>;
}
