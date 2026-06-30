"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { CalendarDays, Clock, MapPin, AlertCircle, RefreshCw, KeyRound, CheckCircle, UserCheck } from "lucide-react";
import { formatPlayerName } from "@/lib/utils";

export default function SessionCodeResponderPage() {
    const params = useParams();
    const token = Array.isArray(params?.token) ? params.token[0] : params?.token;

    // Load states
    const [loading, setLoading] = useState(true);
    const [event, setEvent] = useState<any | null>(null);
    const [eventType, setEventType] = useState<"match" | "training" | null>(null);
    const [players, setPlayers] = useState<any[]>([]);
    const [error, setError] = useState<string | null>(null);

    // Verification modal states
    const [selectedPlayer, setSelectedPlayer] = useState<any | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [enteredCode, setEnteredCode] = useState("");
    const [codeError, setCodeError] = useState("");
    const [isVerifying, setIsVerifying] = useState(false);

    // RSVP success indicator
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [rsvpNote, setRsvpNote] = useState("");

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

    const isVerifiedForSession = () => {
        if (typeof window === "undefined" || !event) return false;
        return localStorage.getItem(`cf_session_verified_${event.id}`) === "true";
    };

    const getSavedCode = () => {
        if (typeof window === "undefined" || !event) return "";
        return localStorage.getItem(`cf_session_code_${event.id}`) || "";
    };

    const handlePlayerClick = (player: any) => {
        setSelectedPlayer(player);
        setSuccessMessage(null);
        setCodeError("");
        setRsvpNote(""); // Reset note input
 
        if (isVerifiedForSession()) {
            setEnteredCode(getSavedCode());
        } else {
            setEnteredCode("");
        }
        setIsModalOpen(true);
    };
 
    const submitResponse = async (player: any, codeVal: string, status: "Available" | "Maybe" | "Unavailable", noteVal: string) => {
        setIsVerifying(true);
        setCodeError("");
 
        try {
            const res = await fetch("/api/player/respond", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    playerId: player.id,
                    eventId: event.id,
                    eventType,
                    status,
                    code: codeVal,
                    notes: noteVal
                })
            });
 
            const data = await res.json();
 
            if (!res.ok || !data.success) {
                setCodeError(data.error || "Incorrect code. Please check the WhatsApp invite.");
                setIsVerifying(false);
                return;
            }
 
            // Save verification locally
            localStorage.setItem(`cf_session_verified_${event.id}`, "true");
            localStorage.setItem(`cf_session_code_${event.id}`, codeVal);
 
            setIsModalOpen(false);
            setSuccessMessage(`${formatPlayerName(player)} marked as ${status}!`);
 
            // Reload event rosters in background
            await loadEventAndSquad();
 
            setTimeout(() => {
                setSelectedPlayer(null);
                setSuccessMessage(null);
            }, 2500);
 
        } catch (err: any) {
            setCodeError("Connection error. Please try again.");
        } finally {
            setIsVerifying(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
                <div className="flex flex-col items-center gap-3">
                    <RefreshCw className="h-10 w-10 text-red-655 animate-spin" />
                    <p className="text-slate-400 text-sm font-medium">Resolving session details...</p>
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
                            <p className="text-xs text-slate-400 font-medium">RSVP Portal</p>
                        </div>
                    </div>
                    <Badge variant="outline" className="border-red-500/30 text-red-400 bg-red-950/20 px-2.5 py-1">
                        Session Code Mode
                    </Badge>
                </div>
            </div>

            <div className="max-w-4xl mx-auto px-4 space-y-6">
                {/* Event Details Card */}
                <Card className="bg-slate-900 border-slate-800 shadow-xl overflow-hidden border-l-4 border-l-red-650">
                    <CardHeader className="pb-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <Badge className="bg-red-950/50 text-red-450 border border-red-900/50 uppercase tracking-wider text-[10px]">
                                {event.squad || "Squad"} Event
                            </Badge>
                            <span className="text-xs text-slate-400 flex items-center gap-1 font-semibold">
                                <Clock className="h-3.5 w-3.5" /> Start: {event.time}
                            </span>
                        </div>
                        <h2 className="text-xl font-black text-white mt-3">{eventName}</h2>
                        <CardDescription className="text-slate-400 leading-relaxed mt-1">
                            Please confirm whether you are attending the session on {formattedDate}. 
                            <span className="block mt-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
                                💡 Select your name below and enter the session code shared in your WhatsApp message.
                            </span>
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-0 border-t border-slate-800/50 mt-2 text-sm text-slate-350">
                        <div className="flex items-center gap-3 pt-3">
                            <CalendarDays className="h-5 w-5 text-red-500" />
                            <div>
                                <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Date</p>
                                <p className="font-medium text-white">{formattedDate}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 pt-3">
                            <MapPin className="h-5 w-5 text-red-500" />
                            <div>
                                <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Location</p>
                                <p className="font-medium text-white">{event.location || event.opponent || "TBD"}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Coach's Instructions Banner */}
                {(() => {
                    const cleanNotes = event.notes ? event.notes.replace(/\[AVAILABILITY:.*?\]/g, "").trim() : "";
                    if (!cleanNotes) return null;
                    return (
                        <Card className="bg-slate-900 border-red-950 border overflow-hidden shadow-xl">
                            <div className="bg-red-950/20 border-l-4 border-l-red-650 p-4">
                                <div className="flex gap-3">
                                    <div className="text-red-500 font-bold shrink-0">📋</div>
                                    <div>
                                        <h4 className="text-xs font-bold text-red-400 uppercase tracking-wider mb-1">
                                            Coach's Instructions
                                        </h4>
                                        <p className="text-xs text-slate-350 leading-relaxed whitespace-pre-line font-medium">
                                            {cleanNotes}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </Card>
                    );
                })()}

                {/* Success Toast */}
                {selectedPlayer && successMessage && (
                    <Card className="bg-slate-900 border-red-500/50 shadow-xl border-t-2 animate-in fade-in slide-in-from-top-4 duration-300">
                        <CardContent className="p-4 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <Avatar className="h-10 w-10 border border-slate-700">
                                    <AvatarFallback className="bg-slate-855 text-white font-bold text-sm">
                                        {selectedPlayer.first_name[0]}{selectedPlayer.last_name[0]}
                                    </AvatarFallback>
                                </Avatar>
                                <div>
                                    <h3 className="text-base font-bold text-white">{formatPlayerName(selectedPlayer)}</h3>
                                    <span className="text-xs text-slate-400 font-semibold uppercase">{selectedPlayer.position}</span>
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
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div>
                                <CardTitle className="text-lg text-white font-bold">Squad List</CardTitle>
                                <CardDescription className="text-slate-400">
                                    Search for your name and select it to RSVP.
                                </CardDescription>
                            </div>
                            <div className="w-full sm:w-64">
                                <Input 
                                    placeholder="Search your name..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="bg-slate-950 border-slate-800 text-white h-9 text-xs focus-visible:ring-red-500"
                                />
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                            {players
                                .filter(player => {
                                    const fullName = `${player.first_name} ${player.last_name}`.toLowerCase();
                                    const nickname = (player.nickname || "").toLowerCase();
                                    const search = searchTerm.toLowerCase();
                                    return fullName.includes(search) || nickname.includes(search);
                                })
                                .map((player) => {
                                    let playerStatus: "Available" | "Maybe" | "Unavailable" = "Unavailable";
                                    if (eventType === "match") {
                                        const currentNotes = event.notes || "";
                                        const matchRaw = currentNotes.match(/\[AVAILABILITY:\s*(.*?)\s*\]/);
                                        if (matchRaw && matchRaw[1]) {
                                            try {
                                                const list = JSON.parse(matchRaw[1]);
                                                const record = list.find((a: any) => a.playerId === player.id);
                                                if (record?.status === "Available") playerStatus = "Available";
                                                else if (record?.status === "Maybe") playerStatus = "Maybe";
                                            } catch (e) {}
                                        }
                                    } else {
                                        const attendance = event.attendance || [];
                                        const record = attendance.find((a: any) => a.playerId === player.id);
                                        if (record?.status === "Present") playerStatus = "Available";
                                        else if (record?.status === "Late") playerStatus = "Maybe";
                                    }

                                    const isSessionVerified = isVerifiedForSession();

                                    return (
                                        <div
                                            key={player.id}
                                            onClick={() => !isVerifying && handlePlayerClick(player)}
                                            className={`
                                                relative flex flex-col items-center p-4 rounded-xl border cursor-pointer select-none text-center gap-1.5 transition-all duration-150 min-h-[110px]
                                                ${playerStatus === "Available"
                                                    ? "bg-emerald-950/20 border-emerald-500/50 shadow-md shadow-emerald-500/5 scale-[1.02]"
                                                    : playerStatus === "Maybe"
                                                    ? "bg-amber-950/20 border-amber-500/50 shadow-md shadow-amber-500/5 scale-[1.02]"
                                                    : "bg-slate-800/50 border-slate-800 hover:border-slate-750 hover:bg-slate-800"
                                                }
                                            `}
                                        >
                                            {isSessionVerified && (
                                                <div className="absolute top-2 right-2 flex items-center justify-center h-4.5 w-4.5 rounded-full bg-emerald-500/20 border border-emerald-450 text-emerald-400 text-[8px] font-bold">
                                                    ✓
                                                </div>
                                            )}

                                            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                                                {player.position}
                                            </span>
                                            {player.use_nickname && player.nickname ? (
                                                <span className="text-sm font-bold text-white leading-tight py-1.5">
                                                    {player.nickname}
                                                </span>
                                            ) : (
                                                <>
                                                    <span className="text-sm font-bold text-white leading-tight">
                                                        {player.first_name}
                                                    </span>
                                                    <span className="text-xs text-slate-400 leading-tight">
                                                        {player.last_name}
                                                    </span>
                                                </>
                                            )}

                                            <div className={`mt-1.5 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border
                                                ${playerStatus === "Available" 
                                                    ? "bg-emerald-950/50 text-emerald-400 border-emerald-900/50" 
                                                    : playerStatus === "Maybe"
                                                    ? "bg-amber-950/50 text-amber-400 border-amber-900/50"
                                                    : "bg-slate-900 text-slate-505 border-slate-800"
                                                }`}
                                            >
                                                {playerStatus === "Available" ? "Available" : playerStatus === "Maybe" ? "Maybe" : "Unavailable"}
                                            </div>
                                        </div>
                                    );
                                })}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Code Verification Modal */}
            {isModalOpen && selectedPlayer && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
                        {/* Modal Header */}
                        <div className="p-5 border-b border-slate-800 bg-slate-900/80 flex justify-between items-start">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-xl bg-red-650/10 border border-red-500/20 flex items-center justify-center text-red-500">
                                    <KeyRound className="h-5 w-5" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-lg text-white">
                                        Confirm RSVP
                                    </h3>
                                    <p className="text-xs text-slate-400 font-semibold">For {formatPlayerName(selectedPlayer)}</p>
                                </div>
                            </div>
                            <button 
                                onClick={() => setIsModalOpen(false)} 
                                className="text-slate-500 hover:text-slate-200 text-lg transition-colors p-1"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div className="p-5 space-y-4">
                            {codeError && (
                                <div className="bg-red-950/40 border border-red-500/30 rounded-xl p-3 flex items-center gap-2.5 text-red-400 text-xs">
                                    <AlertCircle className="h-4.5 w-4.5 shrink-0" />
                                    <span>{codeError}</span>
                                </div>
                            )}

                            <div className="space-y-4">
                                {!isVerifiedForSession() && (
                                    <div className="space-y-1.5">
                                        <p className="text-xs text-slate-350 leading-relaxed font-medium">
                                            Please enter the 6-character session code from the WhatsApp invite.
                                        </p>
                                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-450">Session Code</label>
                                        <Input
                                            type="text"
                                            required
                                            autoFocus
                                            value={enteredCode}
                                            onChange={(e) => setEnteredCode(e.target.value.toUpperCase().trim())}
                                            placeholder="e.g. CUA5DC"
                                            className="bg-slate-950 border-slate-800 text-white font-mono text-center tracking-widest text-lg h-11 focus-visible:ring-red-500 uppercase"
                                        />
                                    </div>
                                )}

                                <div className="space-y-1.5 pt-1">
                                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-450 font-mono">Notes / Reason (Optional)</label>
                                    <Input
                                        type="text"
                                        value={rsvpNote}
                                        onChange={(e) => setRsvpNote(e.target.value)}
                                        placeholder="e.g. Traffic, Injured, running late"
                                        className="bg-slate-950 border-slate-800 text-white text-xs h-9 focus-visible:ring-red-500"
                                    />
                                </div>

                                <div className="space-y-2 pt-2">
                                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-450">Select Availability</label>
                                    <div className="grid grid-cols-3 gap-2">
                                        <Button 
                                            type="button"
                                            disabled={isVerifying || (!isVerifiedForSession() && !enteredCode)}
                                            onClick={() => submitResponse(selectedPlayer, enteredCode, "Available", rsvpNote)}
                                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-10 transition-colors"
                                        >
                                            Available
                                        </Button>
                                        <Button 
                                            type="button"
                                            disabled={isVerifying || (!isVerifiedForSession() && !enteredCode)}
                                            onClick={() => submitResponse(selectedPlayer, enteredCode, "Maybe", rsvpNote)}
                                            className="bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs h-10 transition-colors"
                                        >
                                            Maybe
                                        </Button>
                                        <Button 
                                            type="button"
                                            disabled={isVerifying || (!isVerifiedForSession() && !enteredCode)}
                                            onClick={() => submitResponse(selectedPlayer, enteredCode, "Unavailable", rsvpNote)}
                                            className="bg-slate-700 hover:bg-slate-600 text-white font-bold text-xs h-10 transition-colors"
                                        >
                                            No
                                        </Button>
                                    </div>
                                    {isVerifying && <p className="text-[10px] text-slate-500 text-center animate-pulse mt-1">Verifying code & saving RSVP...</p>}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
