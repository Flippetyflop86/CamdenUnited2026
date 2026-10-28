"use client";

import React, { useEffect, useState, use } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck, Calendar, Info, Landmark, CheckCircle, AlertTriangle, Receipt } from "lucide-react";

interface PaymentPageProps {
    params: Promise<{ paymentId: string }>;
}

function getPlatformFeeBreakdown(baseAmount: number) {
    const base = Math.max(0, Number(baseAmount) || 0);
    const rawFee = base * 0.039 + 0.25;
    const serviceFee = Math.round(Math.max(0.35, rawFee) * 100) / 100;
    const totalPayable = Math.round((base + serviceFee) * 100) / 100;
    return { baseAmount: base, serviceFee, totalPayable };
}

export default function PayPage({ params }: PaymentPageProps) {
    const { paymentId } = use(params);
    const [payment, setPayment] = useState<any>(null);
    const [player, setPlayer] = useState<any>(null);
    const [club, setClub] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [status, setStatus] = useState<"idle" | "success" | "cancelled">("idle");

    useEffect(() => {
        const searchParams = new URLSearchParams(window.location.search);
        const paymentResult = searchParams.get("payment");
        if (paymentResult === "success") {
            setStatus("success");
            // Mark payment request as Paid in Supabase when returning from successful Stripe checkout
            supabase
                .from("player_payment_requests")
                .update({ status: "Paid", paid_at: new Date().toISOString() })
                .eq("id", paymentId)
                .then(() => {});
        } else if (paymentResult === "cancelled") {
            setStatus("cancelled");
        }

        async function loadPaymentDetails() {
            try {
                const { data: payData, error: payErr } = await supabase
                    .from("player_payment_requests")
                    .select("*")
                    .eq("id", paymentId)
                    .single();

                if (payErr || !payData) throw new Error("Payment request not found.");

                setPayment(payData);

                const { data: playerData } = await supabase
                    .from("players")
                    .select("first_name, last_name")
                    .eq("id", payData.player_id)
                    .single();
                
                setPlayer(playerData);

                const { data: clubData } = await supabase
                    .from("clubs")
                    .select("name, logo, primary_color")
                    .eq("id", payData.club_id)
                    .single();
                
                setClub(clubData);
            } catch (err) {
                console.error("Error loading payment data:", err);
            } finally {
                setLoading(false);
            }
        }

        loadPaymentDetails();
    }, [paymentId]);

    const handlePay = async () => {
        setSubmitting(true);
        try {
            const res = await fetch("/api/checkout/connect-session", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ paymentId })
            });
            const data = await res.json();
            if (data.url) {
                window.location.href = data.url;
            } else {
                alert(data.error || "Failed to generate Stripe checkout session.");
            }
        } catch (err) {
            console.error("Payment error:", err);
            alert("An error occurred. Please try again.");
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
                <div className="flex flex-col items-center gap-3">
                    <div className="h-8 w-8 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin" />
                    <p className="text-slate-400 text-sm font-medium">Securing connection...</p>
                </div>
            </div>
        );
    }

    if (!payment) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
                <Card className="max-w-md w-full border-slate-800 bg-slate-950/80 backdrop-blur-md text-white shadow-xl">
                    <CardHeader className="text-center">
                        <AlertTriangle className="h-12 w-12 text-rose-500 mx-auto mb-2" />
                        <CardTitle className="text-lg">Invalid Payment Request</CardTitle>
                        <CardDescription className="text-slate-400 text-xs">
                            This link appears to be invalid or expired. Please contact your club administrator.
                        </CardDescription>
                    </CardHeader>
                </Card>
            </div>
        );
    }

    const primaryColor = club?.primary_color || "#10b981";
    const breakdown = getPlatformFeeBreakdown(Number(payment.amount));

    if (status === "success" || payment.status === "Paid") {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
                <Card className="max-w-md w-full border-slate-800 bg-slate-950/80 backdrop-blur-md text-white shadow-2xl overflow-hidden relative">
                    <div className="absolute top-0 left-0 right-0 h-1.5 bg-emerald-500" />
                    <CardHeader className="text-center pt-8">
                        <CheckCircle className="h-16 w-16 text-emerald-500 mx-auto mb-3 animate-bounce" />
                        <CardTitle className="text-xl font-bold">Fine / Payment Settled</CardTitle>
                        <CardDescription className="text-emerald-400/80 font-medium text-xs mt-1">
                            Thank you! Your transaction was processed and your club record is now marked as Paid.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4 px-6 pb-8">
                        <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800/80 space-y-2 text-xs">
                            <div className="flex justify-between">
                                <span className="text-slate-400">Club:</span>
                                <span className="font-semibold">{club?.name}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-400">Player:</span>
                                <span className="font-semibold">{player?.first_name} {player?.last_name}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-400">Fine / Reason:</span>
                                <span className="font-semibold text-slate-300">{payment.description}</span>
                            </div>
                            <div className="flex justify-between border-t border-slate-800 pt-2">
                                <span className="text-slate-400">Club Fine Amount:</span>
                                <span className="font-semibold text-slate-200">£{breakdown.baseAmount.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-400">Service &amp; Processing Fee:</span>
                                <span className="font-medium text-slate-400">£{breakdown.serviceFee.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between border-t border-slate-800 pt-2 text-sm">
                                <span className="text-slate-300 font-semibold">Total Paid:</span>
                                <span className="font-bold text-emerald-400">£{breakdown.totalPayable.toFixed(2)}</span>
                            </div>
                        </div>
                        <p className="text-[10px] text-slate-500 text-center">
                            A receipt has been sent to your email. Your team record has been marked as settled.
                        </p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
            <Card className="max-w-md w-full border-slate-800 bg-slate-950/80 backdrop-blur-md text-white shadow-2xl overflow-hidden relative">
                <div className="absolute top-0 left-0 right-0 h-1.5" style={{ backgroundColor: primaryColor }} />
                
                <CardHeader className="text-center pt-8">
                    {club?.logo ? (
                        <img src={club.logo} alt={club.name} className="h-16 w-16 mx-auto object-contain mb-3 rounded-full border border-slate-800 p-1 bg-slate-900" />
                    ) : (
                        <Landmark className="h-12 w-12 text-slate-400 mx-auto mb-3" />
                    )}
                    <CardTitle className="text-xl font-bold">{club?.name || "Club Fine Request"}</CardTitle>
                    <CardDescription className="text-slate-400 text-xs">
                        Instant Player Fine &amp; Fee Checkout
                    </CardDescription>
                </CardHeader>

                <CardContent className="space-y-6 px-6 pb-8">
                    {status === "cancelled" && (
                        <div className="bg-amber-500/10 border border-amber-500/30 text-amber-400 p-3 rounded-lg flex items-start gap-2 text-xs">
                            <Info className="h-4 w-4 shrink-0 mt-0.5" />
                            <p>Payment was cancelled. You can complete checkout below when ready.</p>
                        </div>
                    )}

                    <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800/80 space-y-3">
                        <div className="flex justify-between text-xs">
                            <span className="text-slate-400">Player:</span>
                            <span className="font-semibold text-slate-200">{player ? `${player.first_name} ${player.last_name}` : "Squad Member"}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                            <span className="text-slate-400 flex items-center gap-1"><Calendar className="h-3 w-3" /> Issued:</span>
                            <span className="font-semibold text-slate-200">{new Date(payment.created_at).toLocaleDateString("en-GB")}</span>
                        </div>
                        <div className="flex justify-between text-xs border-t border-slate-800 pt-2">
                            <span className="text-slate-400">Offence / Description:</span>
                            <span className="font-semibold text-slate-200 text-right max-w-[210px]">{payment.description}</span>
                        </div>

                        <div className="border-t border-slate-800/90 pt-3 space-y-1.5 text-xs">
                            <div className="flex justify-between text-slate-300">
                                <span>Club Fine Amount (100% to {club?.name || "Club"}):</span>
                                <span className="font-semibold">£{breakdown.baseAmount.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-slate-400">
                                <span className="flex items-center gap-1">
                                    <Receipt className="h-3 w-3 text-slate-500" />
                                    Service &amp; Processing Fee:
                                </span>
                                <span>£{breakdown.serviceFee.toFixed(2)}</span>
                            </div>
                        </div>

                        <div className="flex justify-between items-baseline border-t border-slate-800 pt-3">
                            <span className="text-slate-300 text-sm font-semibold">Total Payable:</span>
                            <span className="text-2xl font-black text-emerald-400">£{breakdown.totalPayable.toFixed(2)}</span>
                        </div>
                    </div>

                    <Button 
                        onClick={handlePay}
                        disabled={submitting}
                        className="w-full h-11 text-sm font-bold text-white shadow-lg shadow-emerald-950/20 hover:opacity-90 transition-opacity"
                        style={{ backgroundColor: primaryColor }}
                    >
                        {submitting ? (
                            <span className="flex items-center gap-2">
                                <span className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                                Connecting to Stripe...
                            </span>
                        ) : (
                            `Pay £${breakdown.totalPayable.toFixed(2)} with Apple Pay / Card`
                        )}
                    </Button>

                    <div className="flex items-center justify-center gap-2 text-[10px] text-slate-500 border-t border-slate-900 pt-4">
                        <ShieldCheck className="h-4 w-4 text-emerald-500" />
                        <span>Powered by ClubFlow &amp; Stripe • Club receives 100% of fine</span>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
