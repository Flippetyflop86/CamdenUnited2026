"use client";

import React, { useEffect, useState, use, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { isFormerPlayer } from "@/lib/utils";
import { calculateClubFlowFee, parsePaymentDescription } from "@/lib/clubflow-pay";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    ShieldCheck,
    Landmark,
    CheckCircle2,
    Clock,
    Receipt,
    CreditCard,
    User,
    Calendar,
    Coins,
    Sparkles,
    RefreshCw,
} from "lucide-react";

interface ClubPayPortalProps {
    params: Promise<{ clubId: string }>;
}

const QUICK_PAY_PRESETS = [
    { label: "⚽ Matchday Sub", amount: 5 },
    { label: "🏃 Training Sub", amount: 3 },
    { label: "🍻 Social / Fines Pot", amount: 10 },
    { label: "👕 Kit / Signing-On Fee", amount: 25 },
];

export default function ClubPlayerPayPortalPage({ params }: ClubPayPortalProps) {
    const { clubId } = use(params);
    const [club, setClub] = useState<any>(null);
    const [players, setPlayers] = useState<any[]>([]);
    const [payments, setPayments] = useState<any[]>([]);
    const [selectedPlayerId, setSelectedPlayerId] = useState<string>("");
    const [loading, setLoading] = useState(true);
    const [payingId, setPayingId] = useState<string | null>(null);
    const [payingAll, setPayingAll] = useState(false);
    const [portalTab, setPortalTab] = useState<"fines" | "quickpay">("fines");
    const [paymentBanner, setPaymentBanner] = useState<"success" | "cancelled" | null>(null);

    // Quick-Pay into club state
    const [quickAmount, setQuickAmount] = useState<string>("5");
    const [quickReason, setQuickReason] = useState<string>("⚽ Matchday Sub");
    const [submittingQuickPay, setSubmittingQuickPay] = useState(false);

    const rememberKey = `clubflow_remembered_player_${clubId}`;

    const handleSelectPlayer = (pid: string) => {
        setSelectedPlayerId(pid);
        try {
            if (pid) localStorage.setItem(rememberKey, pid);
            else localStorage.removeItem(rememberKey);
        } catch {}
    };

    useEffect(() => {
        const searchParams = new URLSearchParams(window.location.search);
        const preselectedPlayer = searchParams.get("player");
        const paymentResult = searchParams.get("payment");
        const paidIdsParam = searchParams.get("ids");

        if (preselectedPlayer) {
            setSelectedPlayerId(preselectedPlayer);
            try {
                localStorage.setItem(rememberKey, preselectedPlayer);
            } catch {}
        } else {
            try {
                const remembered = localStorage.getItem(rememberKey);
                if (remembered) setSelectedPlayerId(remembered);
            } catch {}
        }

        async function loadClubPortal() {
            try {
                if (paymentResult === "success" && paidIdsParam) {
                    setPaymentBanner("success");
                    const ids = paidIdsParam.split(",").map(s => s.trim()).filter(Boolean);
                    if (ids.length > 0) {
                        await fetch("/api/checkout/verify-payment", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ paymentIds: ids }),
                        }).catch(() => {});

                        await supabase
                            .from("player_payment_requests")
                            .update({ status: "Paid", paid_at: new Date().toISOString() })
                            .in("id", ids);
                    }
                } else if (paymentResult === "cancelled") {
                    setPaymentBanner("cancelled");
                }

                const { data: clubData } = await supabase
                    .from("clubs")
                    .select("id, name, logo, primary_color")
                    .eq("id", clubId)
                    .single();
                setClub(clubData);

                const { data: playersData } = await supabase
                    .from("players")
                    .select("id, first_name, last_name, position, notes")
                    .eq("club_id", clubId)
                    .order("first_name", { ascending: true });

                if (playersData) {
                    setPlayers(playersData.filter(p => !isFormerPlayer(p.notes)));
                }

                const { data: paymentsData } = await supabase
                    .from("player_payment_requests")
                    .select("*")
                    .eq("club_id", clubId)
                    .order("created_at", { ascending: false });

                if (paymentsData) {
                    setPayments(paymentsData);
                }
            } catch (err) {
                console.error("Failed to load ClubFlow Pay portal:", err);
            } finally {
                setLoading(false);
            }
        }

        loadClubPortal();
    }, [clubId, rememberKey]);

    const playerPayments = useMemo(() => {
        if (!selectedPlayerId) return [];
        return payments.filter(p => p.player_id === selectedPlayerId);
    }, [payments, selectedPlayerId]);

    const unpaidPayments = useMemo(() => {
        return playerPayments.filter(p => p.status === "Unpaid");
    }, [playerPayments]);

    const paidPayments = useMemo(() => {
        return playerPayments.filter(p => p.status === "Paid");
    }, [playerPayments]);

    const payAllSummary = useMemo(() => {
        let baseTotal = 0;
        let payableTotal = 0;
        let feeTotal = 0;
        for (const p of unpaidPayments) {
            const meta = parsePaymentDescription(p.description);
            const fb = calculateClubFlowFee(Number(p.amount || 0), meta.feeCoverage);
            baseTotal += fb.basePrice;
            payableTotal += fb.playerTotalPayable;
            if (meta.feeCoverage === "player") {
                feeTotal += fb.transactionFee;
            }
        }
        return { baseTotal, payableTotal, feeTotal };
    }, [unpaidPayments]);

    const quickPayBreakdown = useMemo(() => {
        return calculateClubFlowFee(Number(quickAmount || 0), "player");
    }, [quickAmount]);

    const handlePayNow = async (paymentId: string) => {
        setPayingId(paymentId);
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
                alert(
                    data.error ||
                        "Unable to open Stripe checkout. Please ask your club manager to verify their Stripe payout account."
                );
            }
        } catch (err) {
            console.error("Error launching Stripe checkout:", err);
            alert("An error occurred starting checkout.");
        } finally {
            setPayingId(null);
        }
    };

    const handlePayAllFines = async () => {
        if (unpaidPayments.length === 0) return;
        if (unpaidPayments.length === 1) {
            await handlePayNow(unpaidPayments[0].id);
            return;
        }
        setPayingAll(true);
        try {
            const res = await fetch("/api/checkout/connect-session", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ paymentIds: unpaidPayments.map(p => p.id) }),
            });
            const data = await res.json();
            if (data.url) {
                window.location.href = data.url;
            } else {
                alert(
                    data.error ||
                        "Unable to open Stripe checkout. Please ask your club manager to verify their Stripe payout account."
                );
            }
        } catch (err) {
            console.error("Error launching bundled Stripe checkout:", err);
            alert("An error occurred starting checkout.");
        } finally {
            setPayingAll(false);
        }
    };

    const handleQuickPaySubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedPlayerId) {
            alert("Please select your name first.");
            return;
        }
        if (!quickAmount || Number(quickAmount) <= 0 || !quickReason.trim()) {
            alert("Please enter an amount and what the payment is for.");
            return;
        }
        setSubmittingQuickPay(true);
        try {
            const res = await fetch("/api/checkout/connect-session", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    quickPay: {
                        clubId,
                        playerId: selectedPlayerId,
                        amount: parseFloat(quickAmount),
                        description: quickReason.trim(),
                        feeCoverage: "player",
                    },
                }),
            });
            const data = await res.json();
            if (data.url) {
                window.location.href = data.url;
            } else {
                alert(
                    data.error ||
                        "Unable to open Stripe checkout. Please ask your club manager to verify their Stripe payout account."
                );
            }
        } catch (err) {
            console.error("Error launching quick pay:", err);
            alert("An error occurred starting checkout.");
        } finally {
            setSubmittingQuickPay(false);
        }
    };

    const primaryColor = club?.primary_color || "#dc2626";
    const selectedPlayer = players.find(p => p.id === selectedPlayerId);

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
                <div className="flex flex-col items-center gap-3">
                    <div className="h-8 w-8 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin" />
                    <p className="text-slate-400 text-sm font-medium">Loading ClubFlow Pay Hub...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-950 text-white py-6 sm:py-8 px-4">
            <div className="max-w-lg mx-auto space-y-4">
                {/* Payment Confirmation Banner */}
                {paymentBanner === "success" && (
                    <div className="rounded-2xl bg-emerald-500/15 border border-emerald-500/40 p-4 flex items-start gap-3">
                        <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
                        <div>
                            <h4 className="text-sm font-bold text-emerald-300">Payment Settled via Stripe!</h4>
                            <p className="text-xs text-slate-300 mt-0.5">
                                Thank you — your club ledger has been automatically marked as Paid.
                            </p>
                        </div>
                    </div>
                )}

                {/* Club Header */}
                <Card className="border-slate-800 bg-slate-900/90 text-white shadow-2xl overflow-hidden relative">
                    <div className="absolute top-0 left-0 right-0 h-1.5" style={{ backgroundColor: primaryColor }} />
                    <CardHeader className="text-center pt-6 pb-4">
                        {club?.logo ? (
                            <img
                                src={club.logo}
                                alt={club.name}
                                className="h-15 w-15 mx-auto object-contain mb-2 rounded-full border border-slate-800 p-1 bg-slate-950"
                            />
                        ) : (
                            <Landmark className="h-12 w-12 text-slate-400 mx-auto mb-2" />
                        )}
                        <Badge className="mx-auto mb-1 bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold">
                            ClubFlow Pay • Instant Apple Pay, Google Pay &amp; Card
                        </Badge>
                        <CardTitle className="text-xl font-bold">{club?.name || "Football Club"}</CardTitle>
                        <CardDescription className="text-slate-400 text-xs">
                            Select your name once — your phone remembers you next time you open this link.
                        </CardDescription>
                    </CardHeader>

                    <CardContent className="px-5 pb-5 space-y-3">
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                                    <User className="h-3.5 w-3.5" /> Your Player Profile
                                </label>
                                {selectedPlayer && (
                                    <span className="text-[11px] text-emerald-400 font-semibold">
                                        ✓ Remembered on this device
                                    </span>
                                )}
                            </div>
                            <select
                                value={selectedPlayerId}
                                onChange={e => handleSelectPlayer(e.target.value)}
                                className="w-full h-11 rounded-xl border border-slate-700 bg-slate-950 px-3.5 text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            >
                                <option value="">— Tap to choose your name —</option>
                                {players.map(p => {
                                    const unpaidCount = payments.filter(
                                        x => x.player_id === p.id && x.status === "Unpaid"
                                    ).length;
                                    return (
                                        <option key={p.id} value={p.id}>
                                            {p.first_name} {p.last_name}
                                            {unpaidCount > 0 ? ` (${unpaidCount} due)` : ""}
                                        </option>
                                    );
                                })}
                            </select>
                        </div>

                        {/* Mode Switcher Tabs once Player is Selected */}
                        {selectedPlayer && (
                            <div className="grid grid-cols-2 gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
                                <button
                                    type="button"
                                    onClick={() => setPortalTab("fines")}
                                    className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                                        portalTab === "fines"
                                            ? "bg-emerald-600 text-white shadow-xs"
                                            : "text-slate-400 hover:text-white"
                                    }`}
                                >
                                    <Receipt className="h-3.5 w-3.5" />
                                    My Fines ({unpaidPayments.length})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setPortalTab("quickpay")}
                                    className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                                        portalTab === "quickpay"
                                            ? "bg-emerald-600 text-white shadow-xs"
                                            : "text-slate-400 hover:text-white"
                                    }`}
                                >
                                    <Coins className="h-3.5 w-3.5" />
                                    Pay Into Club
                                </button>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* TAB 1: SELECTED PLAYER'S FINES & REQUESTS */}
                {selectedPlayer && portalTab === "fines" && (
                    <div className="space-y-4">
                        <Card className="border-slate-800 bg-slate-900/90 text-white">
                            <CardHeader className="pb-3 border-b border-slate-800">
                                <div className="flex items-center justify-between gap-2">
                                    <CardTitle className="text-base font-bold">
                                        Outstanding Fines &amp; Requests ({unpaidPayments.length})
                                    </CardTitle>
                                    {unpaidPayments.length > 0 && (
                                        <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-xs font-bold">
                                            £{payAllSummary.baseTotal.toFixed(2)} Base Total
                                        </Badge>
                                    )}
                                </div>
                            </CardHeader>
                            <CardContent className="pt-4 space-y-3">
                                {/* 1-Tap Pay All Banner when player has 2+ unpaid fines */}
                                {unpaidPayments.length > 1 && (
                                    <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 space-y-2.5">
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="font-bold text-emerald-300 flex items-center gap-1.5">
                                                <Sparkles className="h-3.5 w-3.5" /> Settle All {unpaidPayments.length} Fines in One Go
                                            </span>
                                            <span className="font-black text-white text-sm">
                                                £{payAllSummary.payableTotal.toFixed(2)}
                                            </span>
                                        </div>
                                        <Button
                                            onClick={handlePayAllFines}
                                            disabled={payingAll}
                                            className="w-full h-10 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md"
                                        >
                                            <CreditCard className="h-4 w-4 mr-1.5" />
                                            {payingAll
                                                ? "Opening Stripe Checkout..."
                                                : `Pay All ${unpaidPayments.length} Fines (£${payAllSummary.payableTotal.toFixed(2)})`}
                                        </Button>
                                    </div>
                                )}

                                {unpaidPayments.length === 0 ? (
                                    <div className="text-center py-8 text-slate-400 space-y-2">
                                        <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto" />
                                        <p className="text-sm font-bold text-white">You&apos;re all settled!</p>
                                        <p className="text-xs text-slate-400">
                                            No unpaid fines for {selectedPlayer.first_name}. Need to pay match subs or another fee?
                                        </p>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setPortalTab("quickpay")}
                                            className="mt-1 border-slate-700 bg-slate-950 text-emerald-400 hover:bg-slate-800 text-xs font-bold"
                                        >
                                            <Coins className="h-3.5 w-3.5 mr-1.5" /> Pay Match Sub / Custom Amount →
                                        </Button>
                                    </div>
                                ) : (
                                    unpaidPayments.map(pay => {
                                        const meta = parsePaymentDescription(pay.description);
                                        const breakdown = calculateClubFlowFee(Number(pay.amount), meta.feeCoverage);

                                        return (
                                            <div
                                                key={pay.id}
                                                className="p-4 rounded-xl border border-slate-800 bg-slate-950/80 space-y-3"
                                            >
                                                <div className="flex items-start justify-between gap-2">
                                                    <div>
                                                        <h4 className="font-bold text-sm text-white">
                                                            {meta.cleanDescription}
                                                        </h4>
                                                        <p className="text-[11px] text-slate-400 mt-0.5">
                                                            Direct to:{" "}
                                                            <span className="text-slate-300 font-medium">
                                                                {meta.payoutAccountLabel || `${club?.name} Bank Account`}
                                                            </span>
                                                        </p>
                                                    </div>
                                                    <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 text-[10px]">
                                                        Unpaid
                                                    </Badge>
                                                </div>

                                                <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
                                                    <span className="flex items-center gap-1">
                                                        <Calendar className="h-3 w-3" /> Issued{" "}
                                                        {new Date(pay.created_at).toLocaleDateString("en-GB")}
                                                    </span>
                                                    {meta.dueDate && (
                                                        <span className="flex items-center gap-1 text-amber-400 font-semibold">
                                                            <Clock className="h-3 w-3" /> Due{" "}
                                                            {new Date(meta.dueDate).toLocaleDateString("en-GB")}
                                                        </span>
                                                    )}
                                                </div>

                                                <div className="border-t border-slate-800/80 pt-2.5 space-y-1 text-xs">
                                                    <div className="flex justify-between text-slate-300">
                                                        <span>Base Amount:</span>
                                                        <span className="font-semibold">
                                                            £{breakdown.basePrice.toFixed(2)}
                                                        </span>
                                                    </div>
                                                    {meta.feeCoverage === "player" && (
                                                        <div className="flex justify-between text-slate-400">
                                                            <span className="flex items-center gap-1">
                                                                <Receipt className="h-3 w-3" /> Processing Fee:
                                                            </span>
                                                            <span>£{breakdown.transactionFee.toFixed(2)}</span>
                                                        </div>
                                                    )}
                                                    <div className="flex justify-between text-sm font-bold pt-1 border-t border-slate-900">
                                                        <span className="text-white">Total Payable:</span>
                                                        <span className="text-emerald-400">
                                                            £{breakdown.playerTotalPayable.toFixed(2)}
                                                        </span>
                                                    </div>
                                                </div>

                                                <Button
                                                    onClick={() => handlePayNow(pay.id)}
                                                    disabled={payingId === pay.id}
                                                    className="w-full h-10 text-xs font-bold text-white"
                                                    style={{ backgroundColor: primaryColor }}
                                                >
                                                    <CreditCard className="h-3.5 w-3.5 mr-1.5" />
                                                    {payingId === pay.id
                                                        ? "Opening Stripe..."
                                                        : `Pay £${breakdown.playerTotalPayable.toFixed(2)} Now`}
                                                </Button>
                                            </div>
                                        );
                                    })
                                )}
                            </CardContent>
                        </Card>

                        {/* Paid History */}
                        {paidPayments.length > 0 && (
                            <Card className="border-slate-800 bg-slate-900/60 text-white">
                                <CardHeader className="pb-2 border-b border-slate-800">
                                    <CardTitle className="text-sm font-bold text-slate-300">
                                        Your Settled Payments ({paidPayments.length})
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="pt-3 space-y-2">
                                    {paidPayments.map(pay => {
                                        const meta = parsePaymentDescription(pay.description);
                                        return (
                                            <div
                                                key={pay.id}
                                                className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/70 text-xs"
                                            >
                                                <div>
                                                    <p className="font-semibold text-slate-200">
                                                        {meta.cleanDescription}
                                                    </p>
                                                    <p className="text-[10px] text-slate-500">
                                                        Paid{" "}
                                                        {pay.paid_at
                                                            ? new Date(pay.paid_at).toLocaleDateString("en-GB")
                                                            : new Date(pay.created_at).toLocaleDateString("en-GB")}
                                                    </p>
                                                </div>
                                                <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[10px]">
                                                    ✓ £{Number(pay.amount).toFixed(2)} Paid
                                                </Badge>
                                            </div>
                                        );
                                    })}
                                </CardContent>
                            </Card>
                        )}
                    </div>
                )}

                {/* TAB 2: QUICK PAY INTO CLUB (Match Subs / Social Pot / Any Amount) */}
                {selectedPlayer && portalTab === "quickpay" && (
                    <Card className="border-slate-800 bg-slate-900/90 text-white">
                        <CardHeader className="pb-3 border-b border-slate-800">
                            <CardTitle className="text-base font-bold flex items-center gap-2">
                                <Coins className="h-4 w-4 text-emerald-400" /> Pay Directly Into {club?.name || "Club"}
                            </CardTitle>
                            <CardDescription className="text-slate-400 text-xs">
                                Pick a quick preset or enter any amount to pay straight into the club bank account via Apple Pay, Google Pay, or Card.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="pt-4">
                            <form onSubmit={handleQuickPaySubmit} className="space-y-4">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                                        1. Quick Presets
                                    </label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {QUICK_PAY_PRESETS.map(preset => {
                                            const active =
                                                quickReason === preset.label &&
                                                Number(quickAmount) === preset.amount;
                                            return (
                                                <button
                                                    key={preset.label}
                                                    type="button"
                                                    onClick={() => {
                                                        setQuickReason(preset.label);
                                                        setQuickAmount(String(preset.amount));
                                                    }}
                                                    className={`p-2.5 rounded-xl border text-left text-xs transition-all cursor-pointer flex items-center justify-between ${
                                                        active
                                                            ? "bg-emerald-500/20 border-emerald-500 text-white font-bold"
                                                            : "bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700"
                                                    }`}
                                                >
                                                    <span className="truncate">{preset.label}</span>
                                                    <span className="font-black text-emerald-400 ml-1">
                                                        £{preset.amount}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className="grid grid-cols-3 gap-3">
                                    <div className="col-span-1 space-y-1.5">
                                        <label className="text-xs font-semibold text-slate-300">Amount (£)</label>
                                        <Input
                                            type="number"
                                            step="0.50"
                                            min="1"
                                            value={quickAmount}
                                            onChange={e => setQuickAmount(e.target.value)}
                                            className="h-10 bg-slate-950 border-slate-700 text-white font-bold text-sm"
                                            required
                                        />
                                    </div>
                                    <div className="col-span-2 space-y-1.5">
                                        <label className="text-xs font-semibold text-slate-300">What is this for?</label>
                                        <Input
                                            type="text"
                                            value={quickReason}
                                            onChange={e => setQuickReason(e.target.value)}
                                            placeholder="e.g. Match Sub / Fines Pot"
                                            className="h-10 bg-slate-950 border-slate-700 text-white text-xs"
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="rounded-xl bg-slate-950/90 border border-slate-800 p-3 space-y-1.5 text-xs">
                                    <div className="flex justify-between text-slate-300">
                                        <span>Club Receives:</span>
                                        <span className="font-bold text-white">
                                            £{quickPayBreakdown.basePrice.toFixed(2)}
                                        </span>
                                    </div>
                                    <div className="flex justify-between text-slate-400">
                                        <span>Processing Fee:</span>
                                        <span>£{quickPayBreakdown.transactionFee.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between text-sm font-bold pt-1.5 border-t border-slate-800">
                                        <span className="text-white">Total Payable Today:</span>
                                        <span className="text-emerald-400">
                                            £{quickPayBreakdown.playerTotalPayable.toFixed(2)}
                                        </span>
                                    </div>
                                </div>

                                <Button
                                    type="submit"
                                    disabled={submittingQuickPay || Number(quickAmount) <= 0}
                                    className="w-full h-11 text-xs font-bold text-white shadow-lg"
                                    style={{ backgroundColor: primaryColor }}
                                >
                                    <CreditCard className="h-4 w-4 mr-1.5" />
                                    {submittingQuickPay
                                        ? "Opening Stripe Checkout..."
                                        : `Pay £${quickPayBreakdown.playerTotalPayable.toFixed(2)} to ${club?.name || "Club"}`}
                                </Button>
                            </form>
                        </CardContent>
                    </Card>
                )}

                <div className="flex items-center justify-center gap-2 text-[11px] text-slate-500 pt-2">
                    <ShieldCheck className="h-4 w-4 text-emerald-500" />
                    <span>Powered by ClubFlow Pay &amp; Stripe • Direct Club Bank Payouts</span>
                </div>
            </div>
        </div>
    );
}
