"use client";

import React, { useEffect, useState, use } from "react";
import Link from "next/link";
import { calculateClubFlowFee, parsePaymentDescription } from "@/lib/clubflow-pay";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
    CreditCard,
    XCircle,
    RotateCcw,
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
    const [declining, setDeclining] = useState(false);
    const [status, setStatus] = useState<"idle" | "success" | "cancelled" | "unverified">("idle");

    useEffect(() => {
        const searchParams = new URLSearchParams(window.location.search);
        const paymentResult = searchParams.get("payment");
        if (paymentResult === "cancelled") {
            setStatus("cancelled");
        }

        async function loadPaymentDetails() {
            try {
                // Only server-side Stripe session verification can mark a payment Paid
                if (paymentResult === "success") {
                    const verifyRes = await fetch("/api/checkout/verify-payment", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ paymentId }),
                    })
                        .then(r => r.json())
                        .catch(() => null);

                    if (verifyRes?.status === "Paid") {
                        setStatus("success");
                    } else {
                        setStatus("unverified");
                    }
                }

                const res = await fetch(`/api/public/pay/${encodeURIComponent(paymentId)}`);
                if (!res.ok) throw new Error("Payment request not found.");
                const data = await res.json();

                setPayment(data.payment);
                setPlayer(data.player);
                setClub(data.club);
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

    const handleOptionalResponse = async (action: "decline" | "reopen") => {
        setDeclining(true);
        try {
            const res = await fetch("/api/payments/respond", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ paymentId, action }),
            });
            const data = await res.json();
            if (data.payment) {
                setPayment(data.payment);
            } else {
                alert(data.error || "Could not update payment status.");
            }
        } catch (err) {
            console.error("Failed to respond to optional payment:", err);
            alert("An error occurred updating your response.");
        } finally {
            setDeclining(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
                <div className="flex flex-col items-center gap-3">
                    <div className="h-8 w-8 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin" />
                    <p className="text-slate-400 text-sm font-medium">Loading payment request...</p>
                </div>
            </div>
        );
    }

    if (!payment) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
                <Card className="max-w-md w-full border-slate-800 bg-slate-900/90 backdrop-blur-md text-white shadow-xl">
                    <CardHeader className="text-center">
                        <AlertTriangle className="h-12 w-12 text-rose-500 mx-auto mb-2" />
                        <CardTitle className="text-lg">Invalid Payment Request</CardTitle>
                        <CardDescription className="text-slate-400 text-xs">
                            This payment link is no longer active. Please contact your club manager if you need assistance.
                        </CardDescription>
                    </CardHeader>
                </Card>
            </div>
        );
    }

    const primaryColor = club?.primary_color || "#10b981";
    const meta = parsePaymentDescription(payment.description);
    const breakdown = calculateClubFlowFee(Number(payment.amount), meta.feeCoverage);
    const todayStr = new Date().toISOString().split("T")[0];
    const isOverdue = Boolean(meta.dueDate && meta.dueDate < todayStr && payment.status === "Unpaid");
    const isDeclined = payment.status === "Void" && meta.declined;

    if (status === "success" || payment.status === "Paid") {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
                <Card className="max-w-md w-full border-slate-800 bg-slate-900/90 backdrop-blur-md text-white shadow-2xl overflow-hidden relative">
                    <div className="absolute top-0 left-0 right-0 h-1.5 bg-emerald-500" />
                    <CardHeader className="text-center pt-8">
                        <CheckCircle className="h-16 w-16 text-emerald-500 mx-auto mb-3" />
                        <CardTitle className="text-xl font-bold">Payment Complete</CardTitle>
                        <CardDescription className="text-emerald-400/90 font-medium text-xs mt-1">
                            Thank you! Your payment has been settled and recorded for {club?.name || "your club"}.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4 px-6 pb-8">
                        <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 space-y-2 text-xs">
                            <div className="flex justify-between">
                                <span className="text-slate-400">Payment For:</span>
                                <span className="font-bold text-white">{meta.cleanDescription}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-400">Player:</span>
                                <span className="font-semibold">
                                    {player?.first_name} {player?.last_name}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-400">Account:</span>
                                <span className="font-semibold">
                                    {meta.payoutAccountLabel || `${club?.name || "Club"} Account`}
                                </span>
                            </div>
                            <div className="flex justify-between border-t border-slate-800 pt-2">
                                <span className="text-slate-400">Price:</span>
                                <span className="font-semibold text-slate-200">£{breakdown.basePrice.toFixed(2)}</span>
                            </div>
                            {meta.feeCoverage === "player" && (
                                <div className="flex justify-between">
                                    <span className="text-slate-400">Processing Fee:</span>
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
                            <Button asChild variant="outline" className="w-full border-slate-800 bg-slate-950 text-slate-200 hover:bg-slate-800 text-xs">
                                <Link href={`/pay/club/${club.id}?player=${player?.id || ""}`}>
                                    <ArrowLeft className="h-3.5 w-3.5 mr-1.5" /> View All My Club Payments
                                </Link>
                            </Button>
                        )}
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
            <Card className="max-w-md w-full border-slate-800 bg-slate-900/95 backdrop-blur-md text-white shadow-2xl overflow-hidden relative">
                <div className="absolute top-0 left-0 right-0 h-1.5" style={{ backgroundColor: primaryColor }} />

                <CardHeader className="text-center pt-7 pb-3">
                    {club?.logo ? (
                        <img
                            src={club.logo}
                            alt={club.name}
                            className="h-14 w-14 mx-auto object-contain mb-2 rounded-full border border-slate-800 p-1 bg-slate-950"
                        />
                    ) : (
                        <Landmark className="h-11 w-11 text-slate-400 mx-auto mb-2" />
                    )}

                    <div className="flex items-center justify-center gap-1.5 mb-1.5">
                        {isDeclined ? (
                            <Badge className="bg-slate-800 text-slate-300 border-slate-700 text-[10px] font-bold">
                                Declined (Optional)
                            </Badge>
                        ) : isOverdue ? (
                            <Badge className="bg-rose-500/20 text-rose-300 border-rose-500/40 text-[10px] font-bold">
                                Overdue • Unanswered Payment
                            </Badge>
                        ) : (
                            <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-[10px] font-bold">
                                Unanswered Payment
                            </Badge>
                        )}
                        <Badge
                            className={`text-[10px] font-bold ${
                                meta.requirement === "optional"
                                    ? "bg-sky-500/15 text-sky-300 border-sky-500/30"
                                    : "bg-slate-800 text-slate-200 border-slate-700"
                            }`}
                        >
                            {meta.requirement === "optional" ? "Optional" : "Required"}
                        </Badge>
                    </div>

                    <CardTitle className="text-xl font-bold">{meta.cleanDescription}</CardTitle>
                    <CardDescription className="text-slate-400 text-xs">
                        {club?.name || "Football Club"} • {player ? `${player.first_name} ${player.last_name}` : "Player"}
                    </CardDescription>
                </CardHeader>

                <CardContent className="space-y-5 px-6 pb-8">
                    {status === "cancelled" && (
                        <div className="bg-amber-500/10 border border-amber-500/30 text-amber-300 p-3 rounded-lg flex items-start gap-2 text-xs">
                            <Info className="h-4 w-4 shrink-0 mt-0.5" />
                            <p>Checkout cancelled. You can pay below whenever you&apos;re ready.</p>
                        </div>
                    )}

                    {status === "unverified" && (
                        <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 p-3 rounded-lg flex items-start gap-2 text-xs">
                            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                            <p>
                                Payment has not been confirmed by Stripe yet. Please complete checkout below to settle this request.
                            </p>
                        </div>
                    )}

                    <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 space-y-2.5">
                        {meta.dueDate && (
                            <div className="flex justify-between text-xs">
                                <span
                                    className={`flex items-center gap-1 font-medium ${
                                        isOverdue ? "text-rose-400" : "text-amber-400"
                                    }`}
                                >
                                    <Clock className="h-3.5 w-3.5" /> Due Date:
                                </span>
                                <span className={`font-bold ${isOverdue ? "text-rose-400" : "text-amber-300"}`}>
                                    {new Date(meta.dueDate + "T12:00:00Z").toLocaleDateString("en-GB", {
                                        weekday: "short",
                                        day: "numeric",
                                        month: "short",
                                        year: "numeric",
                                    })}
                                </span>
                            </div>
                        )}

                        <div className="flex justify-between text-xs">
                            <span className="text-slate-400">Account:</span>
                            <span className="font-semibold text-slate-200 text-right">
                                {meta.payoutAccountLabel || `${club?.name || "Club"} Account`}
                            </span>
                        </div>

                        <div className="flex justify-between text-xs">
                            <span className="text-slate-400 flex items-center gap-1">
                                <Calendar className="h-3 w-3" /> Requested:
                            </span>
                            <span className="font-semibold text-slate-300">
                                {new Date(payment.created_at).toLocaleDateString("en-GB")}
                            </span>
                        </div>

                        <div className="border-t border-slate-800 pt-2.5 space-y-1.5 text-xs">
                            <div className="flex justify-between text-slate-300">
                                <span>Price:</span>
                                <span className="font-semibold">£{breakdown.basePrice.toFixed(2)}</span>
                            </div>
                            {meta.feeCoverage === "player" ? (
                                <div className="flex justify-between text-slate-400">
                                    <span className="flex items-center gap-1">
                                        <Receipt className="h-3 w-3 text-slate-500" />
                                        Processing Fee:
                                    </span>
                                    <span>£{breakdown.transactionFee.toFixed(2)}</span>
                                </div>
                            ) : (
                                <div className="flex justify-between text-slate-400">
                                    <span>Processing Fee:</span>
                                    <span className="text-emerald-400">Covered by Club</span>
                                </div>
                            )}
                        </div>

                        <div className="flex justify-between items-baseline border-t border-slate-800 pt-3">
                            <span className="text-slate-200 text-sm font-semibold">Total to Pay:</span>
                            <span className="text-2xl font-black text-emerald-400">
                                £{breakdown.playerTotalPayable.toFixed(2)}
                            </span>
                        </div>
                    </div>

                    {isDeclined ? (
                        <div className="space-y-2.5">
                            <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700 text-center text-xs text-slate-300">
                                You marked this optional payment as <strong>Not Taking / Declined</strong>. You won&apos;t receive any reminders for it.
                            </div>
                            <Button
                                variant="outline"
                                onClick={() => handleOptionalResponse("reopen")}
                                disabled={declining}
                                className="w-full h-10 border-slate-700 bg-slate-950 text-slate-200 hover:bg-slate-800 text-xs font-semibold"
                            >
                                <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                                {declining ? "Updating..." : "Changed your mind? Re-open & Pay"}
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-2.5">
                            <Button
                                onClick={handlePay}
                                disabled={submitting}
                                className="w-full h-12 text-sm font-bold text-white shadow-lg hover:opacity-95 transition-opacity"
                                style={{ backgroundColor: primaryColor }}
                            >
                                {submitting ? (
                                    <span className="flex items-center gap-2">
                                        <span className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                                        Opening Checkout...
                                    </span>
                                ) : (
                                    <span className="flex items-center gap-2">
                                        <CreditCard className="h-4 w-4" />
                                        Pay £{breakdown.playerTotalPayable.toFixed(2)} (Link / Apple Pay / Card)
                                    </span>
                                )}
                            </Button>
                            <p className="text-[11px] text-center text-slate-400">
                                Fast 1-tap checkout with saved Link details, Apple Pay, Google Pay, or Card.
                            </p>

                            {meta.requirement === "optional" && (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={() => handleOptionalResponse("decline")}
                                    disabled={declining}
                                    className="w-full h-9 text-xs text-slate-400 hover:text-white hover:bg-slate-800/70"
                                >
                                    <XCircle className="h-3.5 w-3.5 mr-1.5" />
                                    {declining ? "Updating..." : "Decline Optional Payment (Not Taking Part)"}
                                </Button>
                            )}
                        </div>
                    )}

                    {club?.id && (
                        <div className="text-center pt-1">
                            <Link
                                href={`/pay/club/${club.id}?player=${player?.id || ""}`}
                                className="text-xs text-slate-400 hover:text-white underline"
                            >
                                View all my payments at {club.name}
                            </Link>
                        </div>
                    )}

                    <div className="flex items-center justify-center gap-2 text-[10px] text-slate-500 border-t border-slate-800/80 pt-4">
                        <ShieldCheck className="h-4 w-4 text-emerald-500" />
                        <span>Powered by ClubFlow &amp; Stripe • Direct Club Bank Payout</span>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
