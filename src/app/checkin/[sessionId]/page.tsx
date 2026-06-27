"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { TrainingSession, Player, AttendanceStatus } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
    CalendarDays, 
    MapPin, 
    Clock, 
    MessageCircle, 
    Check, 
    Shield, 
    AlertCircle, 
    Sparkles, 
    ThumbsUp, 
    ThumbsDown,
    Activity,
    UserCheck
} from "lucide-react";

// Position order helper
const positionOrder: Record<string, number> = {
    "GK": 1, "RB": 2, "LB": 2, "CB": 2, "RWB": 2, "LWB": 2, "DEF": 2,
    "CDM": 3, "CM": 3, "CAM": 3, "RM": 3, "LM": 3, "MID": 3,
    "RW": 4, "LW": 4, "CF": 4, "ST": 4, "FWD": 4
};

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
    const [isVerifying, setIsVerifying] = useState(false);
    const [verificationStep, setVerificationStep] = useState<1 | 2>(1);
    
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
        if (isVerified(player.id)) {
            // Already verified, can update status directly
            // No verification modal needed
        } else {
            // Needs verification
            setVerificationStep(1);
            setIsVerificationModalOpen(true);
        }
    };

    const handleVerifyViaWhatsApp = () => {
        if (!selectedPlayer || !session) return;
        
        // Generate prefilled text
        const text = `Verify me as ${selectedPlayer.firstName} ${selectedPlayer.lastName} for Camden United training session on ${formatFriendlyDate(session.date)} (Code: CF-${selectedPlayer.id.substring(0, 4)})`;
        const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
        
        // Open WhatsApp
        window.open(whatsappUrl, "_blank");
        
        // Move to step 2 (Waiting state)
        setVerificationStep(2);
    };

    const handleSimulateWebhookSuccess = () => {
        if (!selectedPlayer) return;
        setIsVerifying(true);
        
        // Simulate a 1.5s delay to represent backend receiving the webhook
        setTimeout(() => {
            localStorage.setItem(`cf_verified_player_${selectedPlayer.id}`, "true");
            setIsVerifying(false);
            setIsVerificationModalOpen(false);
            // Re-render UI
            setPlayers([...players]);
        }, 1500);
    };

    const handleUpdateStatus = async (status: AttendanceStatus) => {
        if (!selectedPlayer || !session || !sessionId) return;
        setIsSubmitting(true);

        try {
            // Fetch latest session attendance list first to prevent overwrite
            const { data: latestSession } = await supabase
                .from("training_sessions")
                .select("attendance")
                .eq("id", sessionId)
                .single();

            const existingAttendance = latestSession?.attendance || [];
            
            // Map or update player status
            const updatedAttendance = [...existingAttendance];
            const playerIndex = updatedAttendance.findIndex(a => a.playerId === selectedPlayer.id);

            if (playerIndex >= 0) {
                updatedAttendance[playerIndex] = { 
                    ...updatedAttendance[playerIndex], 
                    status 
                };
            } else {
                updatedAttendance.push({ 
                    playerId: selectedPlayer.id, 
                    status,
                    notes: "Checked in via public WhatsApp Link" 
                });
            }

            // Update training session in Supabase
            const { error: updateErr } = await supabase
                .from("training_sessions")
                .update({ attendance: updatedAttendance })
                .eq("id", sessionId);

            if (updateErr) throw updateErr;

            // Success state update
            setSession({ ...session, attendance: updatedAttendance });
            setSuccessMessage(`${selectedPlayer.firstName} marked as ${status}!`);
            
            // Clean selected player after a short delay
            setTimeout(() => {
                setSelectedPlayer(null);
                setSuccessMessage(null);
            }, 3000);

        } catch (err) {
            console.error(err);
            alert("Failed to submit attendance. Please try again.");
        } finally {
            setIsSubmitting(false);
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
                            <p className="text-xs text-slate-400">ClubFlow Check-in</p>
                        </div>
                    </div>
                    <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 bg-emerald-950/20 px-2.5 py-1">
                        Active Public Check-In
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
                        <CardTitle className="text-xl text-white mt-1.5">{session.topic || "General Session"}</CardTitle>
                        <CardDescription className="text-slate-400">
                            Please select your name below to confirm whether you are attending tonight's session.
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

                {/* Selected Player Update Card (Displays once name is clicked & verified) */}
                {selectedPlayer && isVerified(selectedPlayer.id) && (
                    <Card className="bg-slate-900 border-red-500/50 shadow-xl border-t-2 animate-in fade-in slide-in-from-top-4 duration-300">
                        <CardHeader className="pb-3 flex flex-row items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Avatar className="h-10 w-10 border border-slate-700">
                                    <AvatarImage src={selectedPlayer.imageUrl} />
                                    <AvatarFallback className="bg-slate-800 text-white font-bold">
                                        {selectedPlayer.firstName[0]}{selectedPlayer.lastName[0]}
                                    </AvatarFallback>
                                </Avatar>
                                <div>
                                    <h3 className="text-base font-bold text-white">{selectedPlayer.firstName} {selectedPlayer.lastName}</h3>
                                    <p className="text-xs text-slate-400 font-semibold uppercase">{selectedPlayer.position} • Verified Device ✓</p>
                                </div>
                            </div>
                            <Button 
                                variant="ghost" 
                                size="sm" 
                                className="text-slate-400 hover:text-white"
                                onClick={() => setSelectedPlayer(null)}
                            >
                                Cancel
                            </Button>
                        </CardHeader>
                        <CardContent className="pt-2">
                            {successMessage ? (
                                <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-xl p-4 flex items-center gap-3 text-emerald-400 animate-in zoom-in-95 duration-200">
                                    <UserCheck className="h-5 w-5" />
                                    <span className="font-semibold text-sm">{successMessage}</span>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <p className="text-xs text-slate-400 font-medium">Select your attendance status for this session:</p>
                                    <div className="grid grid-cols-3 gap-3">
                                        <button
                                            disabled={isSubmitting}
                                            onClick={() => handleUpdateStatus("Present")}
                                            className="flex flex-col items-center justify-center p-3 rounded-xl border border-emerald-500/30 bg-emerald-950/20 text-emerald-400 hover:bg-emerald-900/40 transition-colors font-bold text-sm gap-1 disabled:opacity-50"
                                        >
                                            <ThumbsUp className="h-5 w-5" />
                                            <span>Present</span>
                                        </button>
                                        <button
                                            disabled={isSubmitting}
                                            onClick={() => handleUpdateStatus("Late")}
                                            className="flex flex-col items-center justify-center p-3 rounded-xl border border-amber-500/30 bg-amber-950/20 text-amber-400 hover:bg-amber-900/40 transition-colors font-bold text-sm gap-1 disabled:opacity-50"
                                        >
                                            <Clock className="h-5 w-5" />
                                            <span>Late</span>
                                        </button>
                                        <button
                                            disabled={isSubmitting}
                                            onClick={() => handleUpdateStatus("Absent")}
                                            className="flex flex-col items-center justify-center p-3 rounded-xl border border-red-500/30 bg-red-950/20 text-red-400 hover:bg-red-900/40 transition-colors font-bold text-sm gap-1 disabled:opacity-50"
                                        >
                                            <ThumbsDown className="h-5 w-5" />
                                            <span>Absent</span>
                                        </button>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}

                {/* Player Selection Grid */}
                <Card className="bg-slate-900 border-slate-800 shadow-xl">
                    <CardHeader className="pb-4">
                        <CardTitle className="text-lg text-white">Squad Roster</CardTitle>
                        <CardDescription className="text-slate-400">
                            Find your name and click it. Verified names have a green badge.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                            {players.map((player) => {
                                const record = session.attendance?.find(a => a.playerId === player.id);
                                const status = record?.status ?? "Absent";
                                const isPresent = status === "Present" || status === "Late";
                                const isUserVerified = isVerified(player.id);
                                
                                return (
                                    <div
                                        key={player.id}
                                        onClick={() => handlePlayerClick(player)}
                                        className={`
                                            relative flex flex-col items-center p-4 rounded-xl border cursor-pointer select-none text-center gap-1.5 transition-all duration-150 min-h-[110px]
                                            ${selectedPlayer?.id === player.id
                                                ? 'bg-red-950/30 border-red-500 shadow-md shadow-red-500/10 scale-[1.02]'
                                                : 'bg-slate-800/50 border-slate-800 hover:border-slate-700 hover:bg-slate-800'
                                            }
                                        `}
                                    >
                                        {/* Verification indicator */}
                                        {isUserVerified && (
                                            <div className="absolute top-2 right-2 flex items-center justify-center h-4 w-4 rounded-full bg-emerald-500/20 border border-emerald-400 text-emerald-400 text-[8px] font-bold">
                                                ✓
                                            </div>
                                        )}

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

            {/* Verification Dialog Modal */}
            {isVerificationModalOpen && selectedPlayer && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                        {/* Modal Header */}
                        <div className="p-5 border-b border-slate-800 bg-slate-900/80 flex justify-between items-start">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-xl bg-red-600/10 border border-red-500/20 flex items-center justify-center text-red-500">
                                    <Shield className="h-5 w-5" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-lg text-white">Device Verification</h3>
                                    <p className="text-xs text-slate-400">Verifying {selectedPlayer.firstName} {selectedPlayer.lastName}</p>
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
                        <div className="p-5 space-y-4 text-slate-300">
                            {verificationStep === 1 ? (
                                <div className="space-y-3">
                                    <p className="text-sm leading-relaxed">
                                        To prevent others from marking attendance on your behalf, we need to verify your phone/device. 
                                    </p>
                                    <div className="bg-slate-950 rounded-xl p-3 border border-slate-800 space-y-2 text-xs">
                                        <div className="flex gap-2">
                                            <span className="text-red-500 font-bold">1.</span>
                                            <span>Clicking below opens WhatsApp with a prefilled, unique confirmation message.</span>
                                        </div>
                                        <div className="flex gap-2">
                                            <span className="text-red-500 font-bold">2.</span>
                                            <span>Send the message. Our system instantly registers the sender's phone to verify this device.</span>
                                        </div>
                                    </div>
                                    
                                    <Button 
                                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-11"
                                        onClick={handleVerifyViaWhatsApp}
                                    >
                                        <MessageCircle className="h-4 w-4 mr-2" /> Verify via WhatsApp
                                    </Button>
                                </div>
                            ) : (
                                <div className="space-y-4 text-center py-2">
                                    <div className="relative w-16 h-16 mx-auto flex items-center justify-center">
                                        <div className="absolute inset-0 rounded-full border-4 border-emerald-500/20 animate-ping duration-1000" />
                                        <div className="h-12 w-12 rounded-full bg-emerald-950 border border-emerald-500 flex items-center justify-center text-emerald-400">
                                            <Activity className="h-5 w-5 animate-pulse" />
                                        </div>
                                    </div>
                                    
                                    <div>
                                        <h4 className="font-bold text-white text-sm">Awaiting WhatsApp Message...</h4>
                                        <p className="text-xs text-slate-400 mt-1">Please send the prefilled WhatsApp chat message from your phone.</p>
                                    </div>

                                    {/* Simulation Box */}
                                    <div className="border border-slate-800 bg-slate-950 p-4 rounded-xl space-y-2 mt-4">
                                        <div className="flex items-center gap-1.5 justify-center text-xs text-slate-400 font-bold uppercase tracking-wider">
                                            <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                                            <span>ClubFlow Sandbox</span>
                                        </div>
                                        <p className="text-[11px] text-slate-500">
                                            Since this is a simulated workspace environment, click below to trigger a successful mock webhook.
                                        </p>
                                        <Button 
                                            size="sm"
                                            className="bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs py-1 h-8 w-full"
                                            onClick={handleSimulateWebhookSuccess}
                                            disabled={isVerifying}
                                        >
                                            {isVerifying ? "Verifying..." : "Simulate Verification Received"}
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
