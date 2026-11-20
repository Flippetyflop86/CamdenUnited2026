"use client";

import React, { Suspense, useEffect, useState, use } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, Shield, AlertTriangle } from "lucide-react";

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

function SquadRegistrationFormInner({ clubId }: { clubId: string }) {
    const searchParams = useSearchParams();
    const squadFromUrl = (searchParams?.get("squad") || "").trim();

    const [loading, setLoading] = useState(true);
    const [club, setClub] = useState<{
        id: string;
        name: string;
        logo: string | null;
        primary_color: string | null;
        squads: string[];
        defaultSquad: string;
    } | null>(null);

    const [selectedSquad, setSelectedSquad] = useState("");
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [email, setEmail] = useState("");
    const [phone, setPhone] = useState("");
    const [position, setPosition] = useState("CM");
    const [secondaryPosition, setSecondaryPosition] = useState("");
    const [squadNumber, setSquadNumber] = useState("");
    const [preferredFoot, setPreferredFoot] = useState<"Right" | "Left" | "Both">("Right");
    const [submitting, setSubmitting] = useState(false);
    const [submittedInfo, setSubmittedInfo] = useState<{ name: string; squad: string } | null>(null);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const storageKey = `clubflow_new_player_reg_${clubId}`;

    useEffect(() => {
        if (typeof window !== "undefined") {
            try {
                const existing = localStorage.getItem(storageKey);
                if (existing) {
                    const parsed = JSON.parse(existing);
                    if (parsed?.name) {
                        setSubmittedInfo({
                            name: parsed.name,
                            squad: parsed.squad || squadFromUrl || "Squad",
                        });
                    }
                }
            } catch {}
        }

        async function loadClubForm() {
            try {
                const res = await fetch(`/api/public/squad-onboarding/${encodeURIComponent(clubId)}`);
                if (!res.ok) throw new Error("Club not found");
                const data = await res.json();
                const loadedClub = data.club || null;
                setClub(loadedClub);
                if (loadedClub) {
                    const squads: string[] = Array.isArray(loadedClub.squads) && loadedClub.squads.length > 0
                        ? loadedClub.squads
                        : ["First Team"];
                    const matchedUrlSquad = squads.find(
                        (s) => s.toLowerCase() === squadFromUrl.toLowerCase()
                    );
                    setSelectedSquad(matchedUrlSquad || squads[0]);
                }
            } catch {
                setClub(null);
            } finally {
                setLoading(false);
            }
        }
        loadClubForm();
    }, [clubId, squadFromUrl, storageKey]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg(null);
        setSubmitting(true);
        try {
            const res = await fetch(`/api/public/squad-onboarding/${encodeURIComponent(clubId)}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    firstName,
                    lastName,
                    email,
                    phone: phone || undefined,
                    position,
                    secondaryPosition: secondaryPosition || undefined,
                    squadNumber: squadNumber || null,
                    preferredFoot,
                    squad: selectedSquad || undefined,
                }),
            });
            const data = await res.json();
            if (!res.ok) {
                setErrorMsg(data.error || "Could not submit your details.");
                return;
            }

            const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
            const finalSquad = data.squad || selectedSquad || club?.defaultSquad || "First Team";
            const info = { name: fullName, squad: finalSquad };
            setSubmittedInfo(info);
            if (typeof window !== "undefined") {
                try {
                    localStorage.setItem(storageKey, JSON.stringify(info));
                } catch {}
            }
        } catch {
            setErrorMsg("Network error submitting your registration. Please try again.");
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
                        <h1 className="text-lg font-black text-white">Invalid Registration Link</h1>
                        <p className="text-slate-400 text-xs mt-1">
                            Please ask your coach or manager to re-copy the registration link from ClubFlow.
                        </p>
                    </CardHeader>
                </Card>
            </div>
        );
    }

    const brandColor = club.primary_color || "#dc2626";
    const hasLockedUrlSquad = Boolean(
        squadFromUrl &&
            club.squads.some((s) => s.toLowerCase() === squadFromUrl.toLowerCase())
    );

    if (submittedInfo) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
                <Card className="max-w-md w-full bg-slate-900 border-slate-800 text-white shadow-2xl overflow-hidden relative">
                    <div className="absolute top-0 left-0 right-0 h-1.5 bg-emerald-500" />
                    <CardHeader className="text-center pt-8 pb-7 px-6">
                        <CheckCircle2 className="h-14 w-14 text-emerald-500 mx-auto mb-3" />
                        <h1 className="text-xl font-black text-white">
                            Registration Sent, {submittedInfo.name}!
                        </h1>
                        <p className="text-slate-300 text-xs mt-2 leading-relaxed">
                            Your player details have been sent to{" "}
                            <strong className="text-white">{club.name}</strong> ({submittedInfo.squad}) for
                            manager approval. You don&apos;t need to submit this form again.
                        </p>
                    </CardHeader>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 py-8">
            <Card className="max-w-md w-full bg-slate-900/95 border-slate-800 text-white shadow-2xl overflow-hidden relative">
                <div
                    className="absolute top-0 left-0 right-0 h-1.5"
                    style={{ backgroundColor: brandColor }}
                />

                <CardHeader className="text-center pt-7 pb-4 px-6">
                    {club.logo ? (
                        <img
                            src={club.logo}
                            alt={club.name}
                            className="h-14 w-14 mx-auto object-contain mb-2 rounded-full border border-slate-800 p-1 bg-slate-950"
                        />
                    ) : (
                        <Shield className="h-11 w-11 text-slate-400 mx-auto mb-2" />
                    )}
                    <div className="inline-flex items-center justify-center mx-auto mb-1.5 px-2.5 py-0.5 rounded-full bg-white/10 border border-white/20 text-[10px] font-bold uppercase tracking-wider text-white">
                        {hasLockedUrlSquad
                            ? `${selectedSquad} • New Player Registration`
                            : "New Player Registration"}
                    </div>
                    <h1 className="text-2xl font-black text-white tracking-tight">{club.name}</h1>
                    <p className="text-slate-400 text-xs mt-1 leading-relaxed">
                        Enter your details below so the coaching staff can add you to the squad for training,
                        matchdays &amp; club updates.
                    </p>
                </CardHeader>

                <CardContent className="px-5 pb-7">
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {!hasLockedUrlSquad && club.squads.length > 1 && (
                            <div className="space-y-1.5">
                                <Label className="text-xs font-bold text-slate-300">Squad</Label>
                                <div className="flex flex-wrap gap-1.5">
                                    {club.squads.map((sq) => (
                                        <button
                                            key={sq}
                                            type="button"
                                            onClick={() => setSelectedSquad(sq)}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                                                selectedSquad === sq
                                                    ? "text-white border-white/40 shadow-sm"
                                                    : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
                                            }`}
                                            style={
                                                selectedSquad === sq
                                                    ? { backgroundColor: brandColor }
                                                    : undefined
                                            }
                                        >
                                            {sq}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-2.5">
                            <div className="space-y-1.5">
                                <Label className="text-xs font-bold text-slate-300">First Name *</Label>
                                <Input
                                    required
                                    value={firstName}
                                    onChange={(e) => setFirstName(e.target.value)}
                                    placeholder="Marcus"
                                    className="h-10 bg-slate-950 border-slate-800 text-white placeholder:text-slate-500 text-xs"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs font-bold text-slate-300">Surname *</Label>
                                <Input
                                    required
                                    value={lastName}
                                    onChange={(e) => setLastName(e.target.value)}
                                    placeholder="Vance"
                                    className="h-10 bg-slate-950 border-slate-800 text-white placeholder:text-slate-500 text-xs"
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold text-slate-300">Main Position *</Label>
                            <div className="grid grid-cols-5 gap-1.5">
                                {POSITION_CHOICES.map((pos) => (
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
                                    onChange={(e) => setSecondaryPosition(e.target.value)}
                                    className="w-full h-9 rounded-lg bg-slate-950 border border-slate-800 px-2 text-xs text-white"
                                >
                                    <option value="">Optional</option>
                                    {POSITION_CHOICES.filter((p) => p !== position).map((pos) => (
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
                                    onChange={(e) => setSquadNumber(e.target.value)}
                                    className="h-9 bg-slate-950 border-slate-800 text-white placeholder:text-slate-500 text-xs text-center font-bold"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-[11px] font-bold text-slate-300">Foot</Label>
                                <select
                                    value={preferredFoot}
                                    onChange={(e) => setPreferredFoot(e.target.value as any)}
                                    className="w-full h-9 rounded-lg bg-slate-950 border border-slate-800 px-2 text-xs text-white"
                                >
                                    <option value="Right">Right</option>
                                    <option value="Left">Left</option>
                                    <option value="Both">Both</option>
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            <div className="space-y-1.5">
                                <Label className="text-xs font-bold text-slate-300">Email Address *</Label>
                                <Input
                                    type="email"
                                    required
                                    placeholder="you@example.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="h-10 bg-slate-950 border-slate-800 text-white placeholder:text-slate-500 text-xs"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs font-bold text-slate-300">Mobile (Optional)</Label>
                                <Input
                                    type="tel"
                                    placeholder="07700 900000"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    className="h-10 bg-slate-950 border-slate-800 text-white placeholder:text-slate-500 text-xs"
                                />
                            </div>
                        </div>

                        {errorMsg && (
                            <div className="p-2.5 rounded-lg bg-rose-500/15 border border-rose-500/30 text-xs text-rose-300">
                                {errorMsg}
                            </div>
                        )}

                        <Button
                            type="submit"
                            disabled={submitting || !firstName.trim() || !lastName.trim() || !email.trim()}
                            className="w-full h-11 font-extrabold text-sm text-white shadow-lg cursor-pointer"
                            style={{ backgroundColor: brandColor }}
                        >
                            {submitting ? "Submitting..." : "Submit Player Registration"}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}

export default function SquadSelfOnboardingPage({
    params,
}: {
    params: Promise<{ clubId: string }>;
}) {
    const { clubId } = use(params);
    return (
        <Suspense
            fallback={
                <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
                    <div className="h-8 w-8 rounded-full border-4 border-red-600 border-t-transparent animate-spin" />
                </div>
            }
        >
            <SquadRegistrationFormInner clubId={clubId} />
        </Suspense>
    );
}
