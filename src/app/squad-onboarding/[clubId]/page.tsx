"use client";

import React, { useEffect, useState, use } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Shield, UserPlus, Users, AlertTriangle } from "lucide-react";

const POSITION_CHOICES = [
    "GK",
    "CB",
    "RB",
    "LB",
    "CDM",
    "CM",
    "CAM",
    "RW",
    "LW",
    "ST",
] as const;

interface SquadPlayerOption {
    id: string;
    first_name: string;
    last_name: string;
    position: string;
    squad_number: number | null;
    completed: boolean;
}

export default function SquadSelfOnboardingPage({
    params,
}: {
    params: Promise<{ clubId: string }>;
}) {
    const { clubId } = use(params);
    const [loading, setLoading] = useState(true);
    const [club, setClub] = useState<any>(null);
    const [players, setPlayers] = useState<SquadPlayerOption[]>([]);
    const [mode, setMode] = useState<"claim" | "create">("claim");
    const [selectedPlayerId, setSelectedPlayerId] = useState("");
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [email, setEmail] = useState("");
    const [position, setPosition] = useState("CM");
    const [secondaryPosition, setSecondaryPosition] = useState("");
    const [squadNumber, setSquadNumber] = useState("");
    const [preferredFoot, setPreferredFoot] = useState<"Right" | "Left" | "Both">("Right");
    const [submitting, setSubmitting] = useState(false);
    const [submittedName, setSubmittedName] = useState<string | null>(null);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    useEffect(() => {
        async function loadSquadForm() {
            try {
                const res = await fetch(`/api/public/squad-onboarding/${encodeURIComponent(clubId)}`);
                if (!res.ok) throw new Error("Club not found");
                const data = await res.json();
                setClub(data.club || null);
                const list: SquadPlayerOption[] = data.players || [];
                setPlayers(list);
                if (list.filter(p => !p.completed).length === 0) {
                    setMode("create");
                }
            } catch {
                setClub(null);
            } finally {
                setLoading(false);
            }
        }
        loadSquadForm();
    }, [clubId]);

    const handleSelectExisting = (pid: string) => {
        setSelectedPlayerId(pid);
        const found = players.find(p => p.id === pid);
        if (found) {
            if (found.position) setPosition(found.position);
            if (found.squad_number) setSquadNumber(String(found.squad_number));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg(null);
        setSubmitting(true);
        try {
            const res = await fetch(`/api/public/squad-onboarding/${encodeURIComponent(clubId)}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    mode,
                    playerId: mode === "claim" ? selectedPlayerId : undefined,
                    firstName: mode === "create" ? firstName : undefined,
                    lastName: mode === "create" ? lastName : undefined,
                    email,
                    position,
                    secondaryPosition: secondaryPosition || undefined,
                    squadNumber: squadNumber || null,
                    preferredFoot,
                }),
            });
            const data = await res.json();
            if (!res.ok) {
                setErrorMsg(data.error || "Could not save your details.");
                return;
            }

            if (mode === "claim") {
                const p = players.find(x => x.id === selectedPlayerId);
                setSubmittedName(p ? `${p.first_name} ${p.last_name}`.trim() : "Player");
            } else {
                setSubmittedName(`${firstName} ${lastName}`.trim());
            }
        } catch {
            setErrorMsg("Network error saving your profile. Please try again.");
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
                <div className="h-8 w-8 rounded-full border-4 border-red-600 border-t-transparent animate-spin" />
            </div>
        );
    }

    if (!club) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
                <Card className="max-w-md w-full bg-slate-900 border-slate-800 text-white">
                    <CardHeader className="text-center">
                        <AlertTriangle className="h-10 w-10 text-rose-500 mx-auto mb-2" />
                        <CardTitle className="text-lg">Invalid Squad Link</CardTitle>
                        <CardDescription className="text-slate-400 text-xs">
                            Please ask your manager to re-copy the squad link from ClubFlow.
                        </CardDescription>
                    </CardHeader>
                </Card>
            </div>
        );
    }

    const brandColor = club.primary_color || "#dc2626";

    if (submittedName) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
                <Card className="max-w-md w-full bg-slate-900 border-slate-800 text-white shadow-2xl overflow-hidden relative">
                    <div className="absolute top-0 left-0 right-0 h-1.5 bg-emerald-500" />
                    <CardHeader className="text-center pt-8 pb-6">
                        <CheckCircle2 className="h-14 w-14 text-emerald-500 mx-auto mb-3" />
                        <CardTitle className="text-xl font-black">You&apos;re All Set, {submittedName}!</CardTitle>
                        <CardDescription className="text-slate-300 text-xs mt-1.5 leading-relaxed">
                            Your position, shirt preference, and contact email have been saved straight into{" "}
                            <strong className="text-white">{club.name}</strong>&apos;s squad hub.
                        </CardDescription>
                    </CardHeader>
                </Card>
            </div>
        );
    }

    const uncompletedPlayers = players.filter(p => !p.completed);

    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 py-8">
            <Card className="max-w-md w-full bg-slate-900/95 border-slate-800 text-white shadow-2xl overflow-hidden relative">
                <div className="absolute top-0 left-0 right-0 h-1.5" style={{ backgroundColor: brandColor }} />

                <CardHeader className="text-center pt-7 pb-4">
                    {club.logo ? (
                        <img
                            src={club.logo}
                            alt={club.name}
                            className="h-14 w-14 mx-auto object-contain mb-2 rounded-full border border-slate-800 p-1 bg-slate-950"
                        />
                    ) : (
                        <Shield className="h-11 w-11 text-slate-400 mx-auto mb-2" />
                    )}
                    <Badge className="mx-auto mb-1.5 bg-white/10 text-slate-200 border-white/15 text-[10px]">
                        15-Second Player Setup
                    </Badge>
                    <CardTitle className="text-xl font-black">{club.name}</CardTitle>
                    <CardDescription className="text-slate-400 text-xs">
                        Confirm your position, shirt number &amp; email for matchday selection and club updates.
                    </CardDescription>
                </CardHeader>

                <CardContent className="px-5 pb-7">
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {players.length > 0 && (
                            <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-slate-950 border border-slate-800">
                                <button
                                    type="button"
                                    onClick={() => setMode("claim")}
                                    className={`py-2 px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                                        mode === "claim"
                                            ? "bg-white text-slate-950 shadow-xs"
                                            : "text-slate-400 hover:text-white"
                                    }`}
                                >
                                    <Users className="h-3.5 w-3.5" /> Pick My Name
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setMode("create")}
                                    className={`py-2 px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                                        mode === "create"
                                            ? "bg-white text-slate-950 shadow-xs"
                                            : "text-slate-400 hover:text-white"
                                    }`}
                                >
                                    <UserPlus className="h-3.5 w-3.5" /> Not Listed Yet
                                </button>
                            </div>
                        )}

                        {mode === "claim" ? (
                            <div className="space-y-1.5">
                                <Label className="text-xs font-bold text-slate-300">Select Your Name</Label>
                                <select
                                    required
                                    value={selectedPlayerId}
                                    onChange={e => handleSelectExisting(e.target.value)}
                                    className="w-full h-10 rounded-xl bg-slate-950 border border-slate-800 px-3 text-xs font-semibold text-white"
                                >
                                    <option value="">Choose your name...</option>
                                    {uncompletedPlayers.map(p => (
                                        <option key={p.id} value={p.id}>
                                            {p.first_name} {p.last_name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 gap-2.5">
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-bold text-slate-300">First Name</Label>
                                    <Input
                                        required
                                        value={firstName}
                                        onChange={e => setFirstName(e.target.value)}
                                        placeholder="Marcus"
                                        className="h-10 bg-slate-950 border-slate-800 text-white text-xs"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-bold text-slate-300">Surname</Label>
                                    <Input
                                        required
                                        value={lastName}
                                        onChange={e => setLastName(e.target.value)}
                                        placeholder="Vance"
                                        className="h-10 bg-slate-950 border-slate-800 text-white text-xs"
                                    />
                                </div>
                            </div>
                        )}

                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold text-slate-300">Main Position</Label>
                            <div className="grid grid-cols-5 gap-1.5">
                                {POSITION_CHOICES.map(pos => (
                                    <button
                                        key={pos}
                                        type="button"
                                        onClick={() => setPosition(pos)}
                                        className={`py-2 rounded-lg text-xs font-extrabold border transition-all cursor-pointer ${
                                            position === pos
                                                ? "text-white border-white/40 shadow-sm"
                                                : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
                                        }`}
                                        style={position === pos ? { backgroundColor: brandColor } : undefined}
                                    >
                                        {pos}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-2.5">
                            <div className="space-y-1.5">
                                <Label className="text-[11px] font-bold text-slate-300">2nd Position</Label>
                                <select
                                    value={secondaryPosition}
                                    onChange={e => setSecondaryPosition(e.target.value)}
                                    className="w-full h-9 rounded-lg bg-slate-950 border border-slate-800 px-2 text-xs text-white"
                                >
                                    <option value="">Optional</option>
                                    {POSITION_CHOICES.filter(p => p !== position).map(pos => (
                                        <option key={pos} value={pos}>
                                            {pos}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-[11px] font-bold text-slate-300">Shirt # (Opt)</Label>
                                <Input
                                    type="number"
                                    min="1"
                                    max="99"
                                    placeholder="e.g. 8"
                                    value={squadNumber}
                                    onChange={e => setSquadNumber(e.target.value)}
                                    className="h-9 bg-slate-950 border-slate-800 text-white text-xs text-center font-bold"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-[11px] font-bold text-slate-300">Foot</Label>
                                <select
                                    value={preferredFoot}
                                    onChange={e => setPreferredFoot(e.target.value as any)}
                                    className="w-full h-9 rounded-lg bg-slate-950 border border-slate-800 px-2 text-xs text-white"
                                >
                                    <option value="Right">Right</option>
                                    <option value="Left">Left</option>
                                    <option value="Both">Both</option>
                                </select>
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold text-slate-300">
                                Email Address (for matchday &amp; subs links)
                            </Label>
                            <Input
                                type="email"
                                required
                                placeholder="you@example.com"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                className="h-10 bg-slate-950 border-slate-800 text-white text-xs"
                            />
                        </div>

                        {errorMsg && (
                            <div className="p-2.5 rounded-lg bg-rose-500/15 border border-rose-500/30 text-xs text-rose-300">
                                {errorMsg}
                            </div>
                        )}

                        <Button
                            type="submit"
                            disabled={submitting || (mode === "claim" && !selectedPlayerId)}
                            className="w-full h-11 text-sm font-black text-white shadow-lg"
                            style={{ backgroundColor: brandColor }}
                        >
                            {submitting ? "Saving..." : "Save My Squad Profile"}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
