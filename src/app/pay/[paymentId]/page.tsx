"use client";

import React, { useEffect, useState, use } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { calculateClubFlowFee, parsePaymentDescription } from "@/lib/clubflow-pay";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
    ShieldCheck,
    Calendar,
    Info,
    Landmark,
    CheckCircle,
    AlertTriangle,
    Receipt,
    Clock,
    ArrowLeft,
} from "lucide-react";

interface PaymentPageProps {
    params: Promise<{ paymentId: string }>;
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
            // Verify & mark payment request as Paid in Supabase when returning from Stripe checkout
            fetch("/api/checkout/verify-payment", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ paymentId }),
            }).catch(() => {});

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
                    .select("id, first_name, last_name")
                    .eq("id", payData.player_id)
                    .single();

                setPlayer(playerData);

                const { data: clubData } = await supabase
                    .from("clubs")
                    .select("id, name, logo, primary_color")
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
                body: JSON.stringify({ paymentId }),
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
                    <p className="text-slate-400 text-sm font-medium">Loading ClubFlow Pay...</p>
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
    const meta = parsePaymentDescription(payment.description);
    const breakdown = calculateClubFlowFee(Number(payment.amount), meta.feeCoverage);

    if (status === "success" || payment.status === "Paid") {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
                <Card className="max-w-md w-full border-slate-800 bg-slate-950/80 backdrop-blur-md text-white shadow-2xl overflow-hidden relative">
                    <div className="absolute top-0 left-0 right-0 h-1.5 bg-emerald-500" />
                    <CardHeader className="text-center pt-8">
                        <CheckCircle className="h-16 w-16 text-emerald-500 mx-auto mb-3 animate-bounce" />
                        <CardTitle className="text-xl font-bold">Payment Settled</CardTitle>
                        <CardDescription className="text-emerald-400/80 font-medium text-xs mt-1">
                            Thank you! Your payment was processed via Stripe and your club record is now marked as Paid.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4 px-6 pb-8">
                        <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800/80 space-y-2 text-xs">
                            <div className="flex justify-between">
                                <span className="text-slate-400">Payment Account:</span>
                                <span className="font-semibold">
                                    {meta.payoutAccountLabel || `${club?.name || "Club"} Bank Account`}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-400">Player:</span>
                                <span className="font-semibold">
                                    {player?.first_name} {player?.last_name}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-400">What the fine is for:</span>
                                <span className="font-semibold text-slate-200">{meta.cleanDescription}</span>
                            </div>
                            <div className="flex justify-between border-t border-slate-800 pt-2">
                                <span className="text-slate-400">Base Price:</span>
                                <span className="font-semibold text-slate-200">£{breakdown.basePrice.toFixed(2)}</span>
                            </div>
                            {meta.feeCoverage === "player" && (
                                <div className="flex justify-between">
                                    <span className="text-slate-400">Transaction Fee:</span>
                                    <span className="font-medium text-slate-400">
                                        £{breakdown.transactionFee.toFixed(2)}
                                    </span>
                                </div>
                            )}
                            <div className="flex justify-between border-t border-slate-800 pt-2 text-sm">
                                <span className="text-slate-300 font-semibold">Total Paid:</span>
                                <span className="font-bold text-emerald-400">
                                    £{breakdown.playerTotalPayable.toFixed(2)}
                                </span>
                            </div>
                        </div>

                        {club?.id && (
                            <Button asChild variant="outline" className="w-full border-slate-800 bg-slate-900 text-slate-200 hover:bg-slate-800 text-xs">
                                <Link href={`/pay/club/${club.id}?player=${player?.id || ""}`}>
                                    <ArrowLeft className="h-3.5 w-3.5 mr-1.5" /> View All My Club Fines &amp; Payments
                                </Link>
                            </Button>
                        )}
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
                        <img
                            src={club.logo}
                            alt={club.name}
                            className="h-16 w-16 mx-auto object-contain mb-3 rounded-full border border-slate-800 p-1 bg-slate-900"
                        />
                    ) : (
                        <Landmark className="h-12 w-12 text-slate-400 mx-auto mb-3" />
                    )}
                    <CardTitle className="text-xl font-bold">{club?.name || "Club"} — ClubFlow Pay</CardTitle>
                    <CardDescription className="text-slate-400 text-xs">
                        Official Player Fine &amp; Payment Request
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
                            <span className="font-semibold text-slate-200">
                                {player ? `${player.first_name} ${player.last_name}` : "Squad Member"}
                            </span>
                        </div>

                        <div className="flex justify-between text-xs">
                            <span className="text-slate-400">Payment Account:</span>
                            <span className="font-semibold text-slate-200 text-right">
                                {meta.payoutAccountLabel || `${club?.name || "Club"} Verified Bank Account`}
                            </span>
                        </div>

                        <div className="flex justify-between text-xs">
                            <span className="text-slate-400 flex items-center gap-1">
                                <Calendar className="h-3 w-3" /> Date Requested:
                            </span>
                            <span className="font-semibold text-slate-200">
                                {new Date(payment.created_at).toLocaleDateString("en-GB")}
                            </span>
                        </div>

                        {meta.dueDate && (
                            <div className="flex justify-between text-xs">
                                <span className="text-amber-400 flex items-center gap-1 font-medium">
                                    <Clock className="h-3 w-3" /> Due Date:
                                </span>
                                <span className="font-bold text-amber-400">
                                    {new Date(meta.dueDate).toLocaleDateString("en-GB", {
                                        weekday: "short",
                                        day: "numeric",
                                        month: "short",
                                        year: "numeric",
                                    })}
                                </span>
                            </div>
                        )}

                        <div className="flex justify-between text-xs border-t border-slate-800 pt-2.5">
                            <span className="text-slate-400">Fine / Payment For:</span>
                            <span className="font-bold text-white text-right max-w-[220px]">
                                {meta.cleanDescription}
                            </span>
                        </div>

                        <div className="border-t border-slate-800/90 pt-3 space-y-1.5 text-xs">
                            <div className="flex justify-between text-slate-300">
                                <span>Base Price (Fine Amount):</span>
                                <span className="font-semibold">£{breakdown.basePrice.toFixed(2)}</span>
                            </div>
                            {meta.feeCoverage === "player" ? (
                                <div className="flex justify-between text-slate-400">
                                    <span className="flex items-center gap-1">
                                        <Receipt className="h-3 w-3 text-slate-500" />
                                        Transaction Fee (Covered by Player):
                                    </span>
                                    <span>£{breakdown.transactionFee.toFixed(2)}</span>
                                </div>
                            ) : (
                                <div className="flex justify-between text-slate-400">
                                    <span>Transaction Fee:</span>
                                    <span className="text-emerald-400">Covered by Club (£0.00)</span>
                                </div>
                            )}
                        </div>

                        <div className="flex justify-between items-baseline border-t border-slate-800 pt-3">
                            <span className="text-slate-300 text-sm font-semibold">Total Payable:</span>
                            <span className="text-2xl font-black text-emerald-400">
                                £{breakdown.playerTotalPayable.toFixed(2)}
                            </span>
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
                                Opening Stripe Checkout...
                            </span>
                        ) : (
                            `Pay £${breakdown.playerTotalPayable.toFixed(2)} via Stripe (Apple Pay / Card)`
                        )}
                    </Button>

                    {club?.id && (
                        <div className="text-center">
                            <Link
                                href={`/pay/club/${club.id}?player=${player?.id || ""}`}
                                className="text-xs text-slate-400 hover:text-white underline"
                            >
                                View all my fines &amp; payment history at {club.name}
                            </Link>
                        </div>
                    )}

                    <div className="flex items-center justify-center gap-2 text-[10px] text-slate-500 border-t border-slate-900 pt-4">
                        <ShieldCheck className="h-4 w-4 text-emerald-500" />
                        <span>Powered by ClubFlow Pay &amp; Stripe • Direct Club Bank Payout</span>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
