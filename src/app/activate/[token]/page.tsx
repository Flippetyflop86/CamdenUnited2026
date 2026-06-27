"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { KeyRound, CheckCircle2, AlertCircle } from "lucide-react";

export default function PlayerActivationPage() {
    const params = useParams();
    const router = useRouter();
    const token = Array.isArray(params?.token) ? params.token[0] : params?.token;

    const [pin, setPin] = useState("");
    const [confirmPin, setConfirmPin] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (pin.length !== 4 || !/^\d+$/.test(pin)) {
            setError("PIN must be exactly 4 digits.");
            return;
        }

        if (pin !== confirmPin) {
            setError("PINs do not match. Please re-enter.");
            return;
        }

        setLoading(true);

        try {
            const res = await fetch("/api/player/activate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token, pin }),
            });

            const data = await res.json();

            if (!res.ok || !data.success) {
                throw new Error(data.error || "Activation failed.");
            }

            // Save details in localStorage for future auto-logins / responses
            localStorage.setItem("cf_player_id", data.playerId);
            localStorage.setItem("cf_player_device_token", data.deviceToken);
            localStorage.setItem("cf_player_name", data.playerName);

            setSuccess(true);
            setTimeout(() => {
                router.push("/player");
            }, 2500);

        } catch (err: any) {
            setError(err.message || "An error occurred during activation.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
            <Card className="w-full max-w-sm border-slate-800 bg-slate-900 shadow-2xl overflow-hidden">
                <CardHeader className="p-6 text-center border-b border-slate-800 bg-slate-900/50">
                    <div className="mx-auto h-12 w-12 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500 mb-3">
                        <KeyRound className="h-6 w-6" />
                    </div>
                    <CardTitle className="text-xl font-bold text-white">Activate Player Portal</CardTitle>
                    <CardDescription className="text-xs text-slate-400">
                        Create a secure 4-digit PIN to lock your profile and register this device.
                    </CardDescription>
                </CardHeader>

                <CardContent className="p-6">
                    {success ? (
                        <div className="flex flex-col items-center justify-center py-6 text-center space-y-3">
                            <div className="h-12 w-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500">
                                <CheckCircle2 className="h-6 w-6 animate-bounce" />
                            </div>
                            <h3 className="font-bold text-lg text-white">Activation Complete!</h3>
                            <p className="text-xs text-slate-400">Your device is now trusted. Redirecting you to the portal home...</p>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {error && (
                                <div className="bg-red-950/40 border border-red-500/30 rounded-xl p-3 flex items-center gap-2.5 text-red-400 text-xs">
                                    <AlertCircle className="h-4.5 w-4.5 shrink-0" />
                                    <span>{error}</span>
                                </div>
                            )}

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Choose 4-Digit PIN</label>
                                <Input
                                    type="password"
                                    pattern="\d*"
                                    inputMode="numeric"
                                    maxLength={4}
                                    required
                                    value={pin}
                                    onChange={(e) => setPin(e.target.value.replace(/\D/g, "").substring(0, 4))}
                                    placeholder="••••"
                                    className="bg-slate-950 border-slate-800 text-white font-mono text-center tracking-widest text-lg h-11 focus-visible:ring-red-500"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Confirm 4-Digit PIN</label>
                                <Input
                                    type="password"
                                    pattern="\d*"
                                    inputMode="numeric"
                                    maxLength={4}
                                    required
                                    value={confirmPin}
                                    onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, "").substring(0, 4))}
                                    placeholder="••••"
                                    className="bg-slate-950 border-slate-800 text-white font-mono text-center tracking-widest text-lg h-11 focus-visible:ring-red-500"
                                />
                            </div>

                            <Button
                                type="submit"
                                disabled={loading || pin.length !== 4 || confirmPin.length !== 4}
                                className="w-full bg-red-600 hover:bg-red-700 text-white font-bold h-11 transition-all"
                            >
                                {loading ? "Registering PIN..." : "Activate & Trust Device"}
                            </Button>
                        </form>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
