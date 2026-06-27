"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { TrainingSession, Player, AttendanceStatus } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { 
    CalendarDays, 
    MapPin, 
    Clock, 
    Shield, 
    AlertCircle, 
    ThumbsUp, 
    ThumbsDown,
    Lock,
    KeyRound,
    UserCheck,
    HelpCircle
} from "lucide-react";

// Position order helper
const positionOrder: Record<string, number> = {
    "GK": 1, "RB": 2, "LB": 2, "CB": 2, "RWB": 2, "LWB": 2, "DEF": 2,
    "CDM": 3, "CM": 3, "CAM": 3, "RM": 3, "LM": 3, "MID": 3,
    "RW": 4, "LW": 4, "CF": 4, "ST": 4, "FWD": 4
};

// PIN Helper utilities
function extractPin(notes: string | undefined | null): string | null {
    if (!notes) return null;
    const match = notes.match(/\[PIN:(\d{4})\]/);
    return match ? match[1] : null;
}

function cleanNotes(notes: string | undefined | null): string {
    if (!notes) return "";
    return notes.replace(/\[PIN:\d{4}\]/, "").trim();
}

function formatFriendlyDate(dateStr: string) {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;

    const weekday = new Intl.DateTimeFormat("en-GB", { weekday: 'long' }).format(d);
    const day = d.getDate();
    const month = new Intl.DateTimeFormat("en-GB", { month: 'long' }).format(d);

    // Add ordinal suffix (st, nd, rd, th)
    let suffix = "th";
    if (day === 1 || day === 21 || day === 31) suffix = "st";
    else if (day === 2 || day === 22) suffix = "nd";
    else if (day === 3 || day === 23) suffix = "rd";

    return `${weekday} ${day}${suffix} of ${month}`;
}

export default function PublicCheckinPage() {
    const params = useParams();
    const sessionId = Array.isArray(params?.sessionId) ? params.sessionId[0] : params?.sessionId;

    const [session, setSession] = useState<TrainingSession | null>(null);
    const [players, setPlayers] = useState<Player[]>([]);
    const [clubSettings, setClubSettings] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Selected player for update/verification
    const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
    const [isVerificationModalOpen, setIsVerificationModalOpen] = useState(false);
    
    // PIN states
    const [pinMode, setPinMode] = useState<"set" | "enter">("enter");
    const [enteredPin, setEnteredPin] = useState("");
    const [pinError, setPinError] = useState("");
    const [isPinSubmitting, setIsPinSubmitting] = useState(false);

    // Status update states
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    // Load session and players
    useEffect(() => {
        if (!sessionId) return;
        
        async function fetchSessionData() {
            try {
                // Fetch the training session (Public select)
                const { data: sessionData, error: sessionErr } = await supabase
                    .from("training_sessions")
                    .select("*")
                    .eq("id", sessionId)
                    .single();

                if (sessionErr || !sessionData) {
                    setError("Training session not found or link has expired.");
                    setLoading(false);
                    return;
                }

                setSession(sessionData);

                // Fetch club settings to render logo and colors
                if (sessionData.club_id) {
                    const { data: clubData } = await supabase
                        .from("clubs")
                        .select("name, logo, primary_color")
                        .eq("id", sessionData.club_id)
                        .single();
                    if (clubData) {
                        setClubSettings(clubData);
                    }
                }

                // Fetch players for the squad
                const { data: playersData, error: playersErr } = await supabase
                    .from("players")
                    .select("*")
                    .eq("club_id", sessionData.club_id);

                if (playersErr || !playersData) {
                    setError("Unable to load squad details.");
                    setLoading(false);
                    return;
                }

                // Filter by squad match
                const isFirstTeamSession = sessionData.squad === "All" || sessionData.squad === "firstTeam" || sessionData.squad === "First Team";
                
                const checkSquadMatch = (playerSquadsStr: string | undefined | null, targetSquad: string) => {
                    if (!playerSquadsStr) return false;
                    const squads = playerSquadsStr.split(',').map(s => s.trim().toLowerCase());
                    const cleanTarget = targetSquad.toLowerCase();
                    if (cleanTarget === 'firstteam' || cleanTarget === 'first team') {
                        return squads.includes('first team') || squads.includes('firstteam');
                    }
                    return squads.includes(cleanTarget);
                };

                const isFirstTeam = (squad: string | undefined | null) => {
                    if (!squad) return false;
                    const squads = squad.split(',').map(s => s.trim().toLowerCase());
                    return squads.includes('first team') || squads.includes('firstteam');
                };

                const eligible = playersData.map((p: any) => ({
                    id: p.id,
                    firstName: p.first_name,
                    lastName: p.last_name,
                    position: p.position,
                    squad: p.squad,
                    isInTrainingSquad: p.is_in_training_squad,
                    imageUrl: p.image_url,
                    notes: p.notes,
                } as Player)).filter(p => {
                    if (isFirstTeamSession) {
                        return isFirstTeam(p.squad) || p.isInTrainingSquad;
                    }
                    return checkSquadMatch(p.squad, sessionData.squad);
                }).sort((a, b) => (positionOrder[a.position] || 99) - (positionOrder[b.position] || 99));

                setPlayers(eligible);
            } catch (err) {
                console.error(err);
                setError("An error occurred while loading check-in details.");
            } finally {
                setLoading(false);
            }
        }

        fetchSessionData();
    }, [sessionId]);

    const isVerified = (playerId: string) => {
        if (typeof window === "undefined") return false;
        return localStorage.getItem(`cf_verified_player_${playerId}`) === "true";
    };

    const handlePlayerClick = (player: Player) => {
        setSelectedPlayer(player);
        setSuccessMessage(null);
        setEnteredPin("");
        setPinError("");

        const existingPin = extractPin(player.notes);

        if (existingPin) {
            // Player has a PIN set in the DB
            if (isVerified(player.id)) {
                // Device is already verified, toggle status directly
                toggleAttendanceStatus(player);
            } else {
                // Device not verified, prompt to enter PIN
                setPinMode("enter");
                setIsVerificationModalOpen(true);
            }
        } else {
            // Player has no PIN, prompt to set one
            setPinMode("set");
            setIsVerificationModalOpen(true);
        }
    };

    const toggleAttendanceStatus = async (player: Player, pinToSave?: string) => {
        setIsSubmitting(true);
        try {
            // Fetch latest session attendance list first to prevent overwrite
            const { data: latestSession } = await supabase
                .from("training_sessions")
                .select("attendance")
                .eq("id", sessionId)
                .single();

            const existingAttendance = latestSession?.attendance || [];
            
            // Toggle logic: If Present or Late -> Absent. Otherwise -> Present.
            const record = existingAttendance.find((a: any) => a.playerId === player.id);
            const currentStatus = record?.status ?? "Absent";
            const newStatus: AttendanceStatus = (currentStatus === "Present" || currentStatus === "Late") ? "Absent" : "Present";

            const updatedAttendance = [...existingAttendance];
            const playerIndex = updatedAttendance.findIndex((a: any) => a.playerId === player.id);

            if (playerIndex >= 0) {
                updatedAttendance[playerIndex] = { 
                    ...updatedAttendance[playerIndex], 
                    status: newStatus 
                };
            } else {
                updatedAttendance.push({ 
                    playerId: player.id, 
                    status: newStatus,
                    notes: "Checked in via public link" 
                });
            }

            // If we are setting a new PIN, write it to player notes in the database
            if (pinToSave) {
                const currentNotes = player.notes || "";
                const stripped = cleanNotes(currentNotes);
                const newNotes = `${stripped} [PIN:${pinToSave}]`.trim();

                const { error: playerErr } = await supabase
                    .from("players")
                    .update({ notes: newNotes })
                    .eq("id", player.id);

                if (playerErr) throw playerErr;
                
                // Sync notes locally
                player.notes = newNotes;
                setPlayers(players.map(p => p.id === player.id ? { ...p, notes: newNotes } : p));
            }

            // Update training session in Supabase
            const { error: updateErr } = await supabase
                .from("training_sessions")
                .update({ attendance: updatedAttendance })
                .eq("id", sessionId);

            if (updateErr) throw updateErr;

            // Success state update
            setSession({ ...session!, attendance: updatedAttendance });
            setSuccessMessage(`${player.firstName} marked as ${newStatus}!`);
            
            // Clean selected player after a short delay
            setTimeout(() => {
                setSelectedPlayer(null);
                setSuccessMessage(null);
            }, 2500);

        } catch (err) {
            console.error(err);
            alert("Failed to update status. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handlePinSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedPlayer) return;

        if (enteredPin.length !== 4 || !/^\d+$/.test(enteredPin)) {
            setPinError("PIN must be exactly 4 digits.");
            return;
        }

        setIsPinSubmitting(true);
        setPinError("");

        try {
            if (pinMode === "set") {
                // Save verification state locally
                localStorage.setItem(`cf_verified_player_${selectedPlayer.id}`, "true");
                setIsVerificationModalOpen(false);
                
                // Toggle status and save PIN
                await toggleAttendanceStatus(selectedPlayer, enteredPin);
            } else {
                // Verify existing PIN
                const actualPin = extractPin(selectedPlayer.notes);

                if (enteredPin === actualPin) {
                    // PIN is correct! Save verification state locally
                    localStorage.setItem(`cf_verified_player_${selectedPlayer.id}`, "true");
                    setIsVerificationModalOpen(false);
                    
                    // Toggle status immediately
                    await toggleAttendanceStatus(selectedPlayer);
                } else {
                    setPinError("Incorrect PIN. Please try again or ask your coach to reset it.");
                }
            }
        } catch (err) {
            console.error(err);
            setPinError("An error occurred. Please try again.");
        } finally {
            setIsPinSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
                <div className="flex flex-col items-center gap-3">
                    <div className="h-10 w-10 rounded-full border-4 border-red-600 border-t-transparent animate-spin" />
                    <p className="text-slate-400 text-sm font-medium">Loading session info...</p>
                </div>
            </div>
        );
    }

    if (error || !session) {
        return (
            <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
                <div className="w-full max-w-md text-center bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
                    <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                    <h2 className="text-xl font-bold text-white mb-2">Check-in Unavailable</h2>
                    <p className="text-slate-400 text-sm mb-6">{error || "This training session is not available."}</p>
                    <Button variant="outline" className="border-slate-700 text-slate-300 hover:bg-slate-800" onClick={() => window.location.reload()}>
                        Try Again
                    </Button>
                </div>
            </div>
        );
    }

    const clubName = clubSettings?.name || "Camden United";
    const clubLogo = clubSettings?.logo;

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-12">
            {/* Header Branding */}
            <div className="bg-slate-900 border-b border-slate-800 py-4 px-6 mb-6">
                <div className="max-w-4xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        {clubLogo ? (
                            <img src={clubLogo} alt={clubName} className="h-10 w-10 object-contain rounded-lg" />
                        ) : (
                            <div className="h-10 w-10 bg-red-600 rounded-xl flex items-center justify-center shadow-lg shadow-red-600/30">
                                <Shield className="h-5 w-5 text-white" />
                            </div>
                        )}
                        <div>
                            <h1 className="font-bold text-white tracking-tight">{clubName}</h1>
                            <p className="text-xs text-slate-400">Secure check-in link</p>
                        </div>
                    </div>
                    <Badge variant="outline" className="border-red-500/30 text-red-400 bg-red-950/20 px-2.5 py-1">
                        Attendance Portal
                    </Badge>
                </div>
            </div>

            <div className="max-w-4xl mx-auto px-4 space-y-6">
                {/* Training Session Details */}
                <Card className="bg-slate-900 border-slate-800 shadow-xl overflow-hidden relative border-l-4 border-l-red-600">
                    <div className="absolute right-0 top-0 w-32 h-32 bg-red-600/5 blur-3xl rounded-full" />
                    <CardHeader className="pb-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <Badge className="bg-red-950/50 text-red-400 border border-red-900/50 uppercase tracking-wider text-[10px]">
                                {session.squad} Training
                            </Badge>
                            <span className="text-xs text-slate-400 flex items-center gap-1">
                                <Clock className="h-3 w-3" /> {session.time}
                            </span>
                        </div>
                        <h2 className="text-xl font-bold text-white mt-2.5 mb-1">{session.topic || "General Session"}</h2>
                        <CardDescription className="text-slate-400 leading-relaxed">
                            {(() => {
                                const sessionDate = new Date(session.date);
                                const today = new Date();
                                const isToday = sessionDate.getDate() === today.getDate() &&
                                                sessionDate.getMonth() === today.getMonth() &&
                                                sessionDate.getFullYear() === today.getFullYear();
                                return isToday ? (
                                    `Please confirm whether you are attending tonight's session on ${formatFriendlyDate(session.date)} at ${session.time} at ${session.location}.`
                                ) : (
                                    `Please confirm whether you are attending the session on ${formatFriendlyDate(session.date)} at ${session.time} at ${session.location}.`
                                );
                            })()}
                            <span className="block mt-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
                                💡 Select your name below to instantly toggle your attendance status.
                            </span>
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-0 border-t border-slate-800/50 mt-2 text-sm text-slate-300">
                        <div className="flex items-center gap-3 pt-3">
                            <CalendarDays className="h-5 w-5 text-red-500" />
                            <div>
                                <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Date</p>
                                <p className="font-medium text-white">{formatFriendlyDate(session.date)}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 pt-3">
                            <MapPin className="h-5 w-5 text-red-500" />
                            <div>
                                <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Location</p>
                                <p className="font-medium text-white">{session.location}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Instant Success Toast (Displays once name is clicked & verified) */}
                {selectedPlayer && successMessage && (
                    <Card className="bg-slate-900 border-red-500/50 shadow-xl border-t-2 animate-in fade-in slide-in-from-top-4 duration-300">
                        <CardContent className="p-4 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <Avatar className="h-10 w-10 border border-slate-700">
                                    <AvatarImage src={selectedPlayer.imageUrl} />
                                    <AvatarFallback className="bg-slate-800 text-white font-bold">
                                        {selectedPlayer.firstName[0]}{selectedPlayer.lastName[0]}
                                    </AvatarFallback>
                                </Avatar>
                                <div>
                                    <h3 className="text-base font-bold text-white">{selectedPlayer.firstName} {selectedPlayer.lastName}</h3>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <span className="text-xs text-slate-400 font-semibold uppercase">{selectedPlayer.position} • Verified Device ✓</span>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                localStorage.removeItem(`cf_verified_player_${selectedPlayer.id}`);
                                                setSelectedPlayer(null);
                                                setPlayers([...players]);
                                            }}
                                            className="text-[10px] text-red-400 hover:text-red-355 underline hover:no-underline font-medium"
                                        >
                                            Reset Verification
                                        </button>
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

                {/* Player Selection Grid */}
                <Card className="bg-slate-900 border-slate-800 shadow-xl">
                    <CardHeader className="pb-4">
                        <CardTitle className="text-lg text-white">Squad List</CardTitle>
                        <CardDescription className="text-slate-400">
                            Find your name and click it. Secured slots require your 4-digit PIN.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                            {players.map((player) => {
                                const record = session.attendance?.find(a => a.playerId === player.id);
                                const status = record?.status ?? "Absent";
                                const isUserVerified = isVerified(player.id);
                                const hasPin = extractPin(player.notes) !== null;
                                const isPresent = status === 'Present' || status === 'Late';
                                
                                return (
                                    <div
                                        key={player.id}
                                        onClick={() => !isSubmitting && handlePlayerClick(player)}
                                        className={`
                                            relative flex flex-col items-center p-4 rounded-xl border cursor-pointer select-none text-center gap-1.5 transition-all duration-150 min-h-[110px]
                                            ${isPresent
                                                ? 'bg-emerald-950/30 border-emerald-500 shadow-md shadow-emerald-500/10 scale-[1.02]'
                                                : 'bg-slate-800/50 border-slate-800 hover:border-slate-700 hover:bg-slate-800'
                                            }
                                        `}
                                    >
                                        {/* Security / Verification badge */}
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
                                            {player.firstName}
                                        </span>
                                        <span className="text-xs text-slate-400 leading-tight">
                                            {player.lastName}
                                        </span>

                                        {/* Status Badge */}
                                        <div className={`mt-1.5 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full
                                            ${status === 'Present' 
                                                ? 'bg-emerald-950/50 text-emerald-400 border border-emerald-900/50' 
                                                : status === 'Late'
                                                    ? 'bg-amber-950/50 text-amber-400 border border-amber-900/50'
                                                    : status === 'Injured'
                                                        ? 'bg-red-950/50 text-red-400 border border-red-900/50'
                                                        : 'bg-slate-900 text-slate-500 border border-slate-800'
                                            }`}
                                        >
                                            {status}
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
                                    <p className="text-xs text-slate-400 font-semibold">For {selectedPlayer.firstName} {selectedPlayer.lastName}</p>
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
                                <div className="bg-red-950/40 border border-red-500/30 rounded-xl p-3 flex items-center gap-2.5 text-red-400 text-xs animate-in shake duration-200">
                                    <AlertCircle className="h-4.5 w-4.5 shrink-0" />
                                    <span>{pinError}</span>
                                </div>
                            )}

                            {pinMode === "set" ? (
                                <div className="space-y-3">
                                    <p className="text-xs text-slate-300 leading-relaxed">
                                        Choose a personal **4-digit PIN** to lock your name slot on this squad. Teammates won't be able to edit your status, and your phone will remember it automatically.
                                    </p>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Choose 4-Digit PIN</label>
                                        <Input
                                            type="password"
                                            pattern="\d*"
                                            inputMode="numeric"
                                            maxLength={4}
                                            required
                                            value={enteredPin}
                                            onChange={(e) => setEnteredPin(e.target.value.replace(/\D/g, "").substring(0, 4))}
                                            placeholder="e.g. 2580"
                                            className="bg-slate-950 border-slate-800 text-white font-mono text-center tracking-widest text-lg h-11 focus-visible:ring-red-500"
                                        />
                                    </div>
                                    <Button 
                                        type="submit"
                                        disabled={isPinSubmitting || enteredPin.length !== 4}
                                        className="w-full bg-red-600 hover:bg-red-700 text-white font-bold h-11"
                                    >
                                        {isPinSubmitting ? "Securing Name..." : "Lock Name & Check-in"}
                                    </Button>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <p className="text-xs text-slate-300 leading-relaxed">
                                        Your name slot is locked. Please enter your 4-digit PIN to check in.
                                    </p>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Enter PIN</label>
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
                                    <Button 
                                        type="submit"
                                        disabled={isPinSubmitting || enteredPin.length !== 4}
                                        className="w-full bg-red-600 hover:bg-red-700 text-white font-bold h-11"
                                    >
                                        {isPinSubmitting ? "Verifying..." : "Unlock Device"}
                                    </Button>
                                    <div className="text-center pt-1.5">
                                        <p className="text-[10px] text-slate-500 flex items-center justify-center gap-1">
                                            <HelpCircle className="h-3 w-3" />
                                            <span>Forgot PIN? Ask your coach to reset it from their end.</span>
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
