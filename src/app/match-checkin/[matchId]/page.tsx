"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Match, Player } from "@/types";
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
    HelpCircle,
    Layers
} from "lucide-react";

// Position order helper
const positionOrder: Record<string, number> = {
    "GK": 1, "RB": 2, "LB": 2, "CB": 2, "RWB": 2, "LWB": 2, "DEF": 2,
    "CDM": 3, "CM": 3, "CAM": 3, "RM": 3, "LM": 3, "MID": 3,
    "RW": 4, "LW": 4, "CF": 4, "ST": 4, "FWD": 4
};

// Metadata parsing helpers
function extractPin(notes: string | undefined | null): string | null {
    if (!notes) return null;
    const match = notes.match(/\[PIN:(\d{4})\]/);
    return match ? match[1] : null;
}

function cleanNotes(notes: string | undefined | null): string {
    if (!notes) return "";
    return notes.replace(/\[PIN:\d{4}\]/, "").trim();
}

function extractAvailability(notes: string | undefined | null): { playerId: string; status: "Available" | "Unavailable" }[] {
    if (!notes) return [];
    const match = notes.match(/\[AVAILABILITY:\s*(\[.*?\])\s*\]/);
    if (!match) return [];
    try {
        return JSON.parse(match[1]);
    } catch (e) {
        return [];
    }
}

function formatFriendlyDate(dateStr: string) {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;

    const weekday = new Intl.DateTimeFormat("en-GB", { weekday: 'long' }).format(d);
    const day = d.getDate();
    const month = new Intl.DateTimeFormat("en-GB", { month: 'long' }).format(d);

    let suffix = "th";
    if (day === 1 || day === 21 || day === 31) suffix = "st";
    else if (day === 2 || day === 22) suffix = "nd";
    else if (day === 3 || day === 23) suffix = "rd";

    return `${weekday} ${day}${suffix} of ${month}`;
}

export default function MatchCheckinPage() {
    const params = useParams();
    const matchId = Array.isArray(params?.matchId) ? params.matchId[0] : params?.matchId;

    const [match, setMatch] = useState<Match | null>(null);
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

    // Load match and players
    useEffect(() => {
        if (!matchId) return;
        
        async function fetchMatchData() {
            try {
                // Fetch match
                const { data: matchData, error: matchErr } = await supabase
                    .from("matches")
                    .select("*")
                    .eq("id", matchId)
                    .single();

                if (matchErr || !matchData) {
                    setError("Match details not found or link has expired.");
                    setLoading(false);
                    return;
                }

                // Parse Location, Surface and clean match notes
                const locationMatch = matchData.notes ? matchData.notes.match(/\[Location: (.*?)\]/) : null;
                const location = locationMatch ? locationMatch[1] : "";

                const surfaceMatch = matchData.notes ? matchData.notes.match(/\[Surface: (.*?)\]/) : null;
                const surface = surfaceMatch ? surfaceMatch[1] : "4G";

                let cleanMatchNotes = matchData.notes || "";
                cleanMatchNotes = cleanMatchNotes.replace(/\[Location: .*?\]\n?/, "");
                cleanMatchNotes = cleanMatchNotes.replace(/\[Surface: .*?\]\n?/, "");
                cleanMatchNotes = cleanMatchNotes.replace(/\[AVAILABILITY:.*?\]\n?/, "").trim();

                const parsedMatch: Match = {
                    id: matchData.id,
                    date: matchData.date,
                    time: matchData.time,
                    opponent: matchData.opponent,
                    isHome: matchData.is_home,
                    competition: matchData.competition,
                    notes: cleanMatchNotes,
                    surface: surface,
                    location: location,
                    scoreline: matchData.scoreline,
                    result: matchData.result
                };

                setMatch(parsedMatch);

                // Fetch club settings
                const { data: clubData } = await supabase
                    .from("clubs")
                    .select("name, logo, primary_color")
                    .single();
                if (clubData) {
                    setClubSettings(clubData);
                }

                // Fetch players for the squad
                const { data: playersData, error: playersErr } = await supabase
                    .from("players")
                    .select("*");

                if (playersErr || !playersData) {
                    setError("Unable to load squad details.");
                    setLoading(false);
                    return;
                }

                const eligible = playersData.map((p: any) => ({
                    id: p.id,
                    firstName: p.first_name,
                    lastName: p.last_name,
                    position: p.position,
                    squad: p.squad,
                    isInTrainingSquad: p.is_in_training_squad,
                    imageUrl: p.image_url,
                    notes: p.notes,
                } as Player)).sort((a, b) => (positionOrder[a.position] || 99) - (positionOrder[b.position] || 99));

                setPlayers(eligible);
            } catch (err) {
                console.error(err);
                setError("An error occurred while loading match details.");
            } finally {
                setLoading(false);
            }
        }

        fetchMatchData();
    }, [matchId]);

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
            if (isVerified(player.id)) {
                toggleMatchAvailability(player);
            } else {
                setPinMode("enter");
                setIsVerificationModalOpen(true);
            }
        } else {
            setPinMode("set");
            setIsVerificationModalOpen(true);
        }
    };

    const toggleMatchAvailability = async (player: Player, pinToSave?: string) => {
        if (!match || !matchId) return;
        setIsSubmitting(true);

        try {
            // Fetch fresh match details to get current notes (avoid overwrite)
            const { data: freshMatch } = await supabase
                .from("matches")
                .select("notes")
                .eq("id", matchId)
                .single();

            const currentNotes = freshMatch?.notes || "";
            const currentList = extractAvailability(currentNotes);
            
            // Toggle logic: If currently Available -> mark Unavailable, otherwise mark Available
            const record = currentList.find(a => a.playerId === player.id);
            const nextStatus = (record?.status === "Available") ? "Unavailable" : "Available";

            const updatedList = [...currentList];
            const playerIndex = updatedList.findIndex(a => a.playerId === player.id);

            if (playerIndex >= 0) {
                updatedList[playerIndex] = { playerId: player.id, status: nextStatus };
            } else {
                updatedList.push({ playerId: player.id, status: nextStatus });
            }

            // Construct new notes payload preserving other metadata
            let cleanBaseNotes = currentNotes;
            cleanBaseNotes = cleanBaseNotes.replace(/\[AVAILABILITY:.*?\]\n?/, "").trim();
            const finalNotes = `${cleanBaseNotes}\n[AVAILABILITY: ${JSON.stringify(updatedList)} ]`.trim();

            // Save new PIN if setting up first-time
            if (pinToSave) {
                const playerNotes = player.notes || "";
                const playerCleaned = cleanNotes(playerNotes);
                const updatedPlayerNotes = `${playerCleaned} [PIN:${pinToSave}]`.trim();

                const { error: playerErr } = await supabase
                    .from("players")
                    .update({ notes: updatedPlayerNotes })
                    .eq("id", player.id);

                if (playerErr) throw playerErr;
                
                // Sync player state locally
                player.notes = updatedPlayerNotes;
                setPlayers(players.map(p => p.id === player.id ? { ...p, notes: updatedPlayerNotes } : p));
            }

            // Save match notes back to database
            const { error: updateErr } = await supabase
                .from("matches")
                .update({ notes: finalNotes })
                .eq("id", matchId);

            if (updateErr) throw updateErr;

            // Success state update
            setMatch({ ...match, notes: finalNotes });
            setSuccessMessage(`${player.firstName} marked as ${nextStatus === 'Available' ? 'Available ✅' : 'Unavailable ❌'}!`);
            
            setTimeout(() => {
                setSelectedPlayer(null);
                setSuccessMessage(null);
            }, 2500);

        } catch (err) {
            console.error(err);
            alert("Failed to submit availability. Please try again.");
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
                localStorage.setItem(`cf_verified_player_${selectedPlayer.id}`, "true");
                setIsVerificationModalOpen(false);
                await toggleMatchAvailability(selectedPlayer, enteredPin);
            } else {
                const actualPin = extractPin(selectedPlayer.notes);

                if (enteredPin === actualPin) {
                    localStorage.setItem(`cf_verified_player_${selectedPlayer.id}`, "true");
                    setIsVerificationModalOpen(false);
                    await toggleMatchAvailability(selectedPlayer);
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
                    <p className="text-slate-400 text-sm font-medium">Loading match details...</p>
                </div>
            </div>
        );
    }

    if (error || !match) {
        return (
            <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
                <div className="w-full max-w-md text-center bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
                    <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                    <h2 className="text-xl font-bold text-white mb-2">Check-in Unavailable</h2>
                    <p className="text-slate-400 text-sm mb-6">{error || "This match is not available for check-in."}</p>
                    <Button variant="outline" className="border-slate-700 text-slate-300 hover:bg-slate-800" onClick={() => window.location.reload()}>
                        Try Again
                    </Button>
                </div>
            </div>
        );
    }

    const clubName = clubSettings?.name || "Camden United";
    const clubLogo = clubSettings?.logo;
    const availabilityList = extractAvailability(match.notes);

    // Compute display text
    const sessionDate = new Date(match.date);
    const today = new Date();
    const isToday = sessionDate.getDate() === today.getDate() &&
                    sessionDate.getMonth() === today.getMonth() &&
                    sessionDate.getFullYear() === today.getFullYear();

    const homeTeamName = match.isHome ? clubName : match.opponent;
    const awayTeamName = match.isHome ? match.opponent : clubName;

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
                            <p className="text-xs text-slate-400">Matchday availability portal</p>
                        </div>
                    </div>
                    <Badge variant="outline" className="border-red-500/30 text-red-400 bg-red-950/20 px-2.5 py-1">
                        Matchday Portal
                    </Badge>
                </div>
            </div>

            <div className="max-w-4xl mx-auto px-4 space-y-6">
                {/* Match Details Card */}
                <Card className="bg-slate-900 border-slate-800 shadow-xl overflow-hidden relative border-l-4 border-l-indigo-650">
                    <div className="absolute right-0 top-0 w-32 h-32 bg-indigo-600/5 blur-3xl rounded-full" />
                    <CardHeader className="pb-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <Badge className="bg-indigo-950/50 text-indigo-400 border border-indigo-900/50 uppercase tracking-wider text-[10px]">
                                {match.competition}
                            </Badge>
                            <span className="text-xs text-slate-400 flex items-center gap-1 font-semibold">
                                <Clock className="h-3.5 w-3.5 text-indigo-400" /> Kick Off: {match.time}
                            </span>
                        </div>
                        <h2 className="text-xl font-black text-white mt-3">
                            {homeTeamName} <span className="text-slate-500 font-normal">vs</span> {awayTeamName}
                        </h2>
                        <CardDescription className="text-slate-400 leading-relaxed mt-1">
                            {isToday ? (
                                `Please confirm whether you are available for tonight's match on ${formatFriendlyDate(match.date)} at ${match.time} at ${match.location || "TBD"} (${match.surface || "4G"}).`
                            ) : (
                                `Please confirm whether you are available for the match on ${formatFriendlyDate(match.date)} at ${match.time} at ${match.location || "TBD"} (${match.surface || "4G"}).`
                            )}
                            <span className="block mt-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
                                💡 Select your name below to instantly toggle your availability.
                            </span>
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-0 border-t border-slate-800/50 mt-2 text-sm text-slate-300">
                        <div className="flex items-center gap-3 pt-3">
                            <CalendarDays className="h-5 w-5 text-indigo-500" />
                            <div>
                                <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Date</p>
                                <p className="font-medium text-white">{formatFriendlyDate(match.date)}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 pt-3">
                            <MapPin className="h-5 w-5 text-indigo-500" />
                            <div>
                                <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Location & Pitch</p>
                                <p className="font-medium text-white">{match.location || "TBD"} • {match.surface || "4G"}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Success Toast */}
                {selectedPlayer && successMessage && (
                    <Card className="bg-slate-900 border-indigo-500/50 shadow-xl border-t-2 animate-in fade-in slide-in-from-top-4 duration-300">
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
                            <div className="bg-indigo-950/40 border border-indigo-500/30 rounded-xl px-4 py-2 flex items-center gap-2 text-indigo-400 font-semibold text-sm">
                                <UserCheck className="h-4.5 w-4.5 animate-pulse" />
                                <span>{successMessage}</span>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Player List Card */}
                <Card className="bg-slate-900 border-slate-800 shadow-xl">
                    <CardHeader className="pb-4">
                        <CardTitle className="text-lg text-white font-bold">Squad List</CardTitle>
                        <CardDescription className="text-slate-400">
                            Select your name to toggle your availability. Secured slots require your 4-digit PIN.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                            {players.map((player) => {
                                const record = availabilityList.find(a => a.playerId === player.id);
                                const isAvailable = record?.status === "Available";
                                const isUserVerified = isVerified(player.id);
                                const hasPin = extractPin(player.notes) !== null;
                                
                                return (
                                    <div
                                        key={player.id}
                                        onClick={() => !isSubmitting && handlePlayerClick(player)}
                                        className={`
                                            relative flex flex-col items-center p-4 rounded-xl border cursor-pointer select-none text-center gap-1.5 transition-all duration-150 min-h-[110px]
                                            ${isAvailable
                                                ? 'bg-emerald-950/30 border-emerald-500 shadow-md shadow-emerald-500/10 scale-[1.02]'
                                                : 'bg-slate-800/50 border-slate-800 hover:border-slate-700 hover:bg-slate-800'
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
                                            {player.firstName}
                                        </span>
                                        <span className="text-xs text-slate-400 leading-tight">
                                            {player.lastName}
                                        </span>

                                        {/* Status Badge */}
                                        <div className={`mt-1.5 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full
                                            ${isAvailable 
                                                ? 'bg-emerald-950/50 text-emerald-400 border border-emerald-900/50' 
                                                : 'bg-slate-900 text-slate-500 border border-slate-800'
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
