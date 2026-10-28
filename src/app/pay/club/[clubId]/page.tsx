"use client";

import React, { useEffect, useState, use, useMemo } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { isFormerPlayer } from "@/lib/utils";
import { calculateClubFlowFee, parsePaymentDescription } from "@/lib/clubflow-pay";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    ShieldCheck,
    Landmark,
    CheckCircle2,
    Clock,
    Receipt,
    CreditCard,
    ChevronRight,
    User,
    Calendar,
} from "lucide-react";

interface ClubPayPortalProps {
    params: Promise<{ clubId: string }>;
}

export default function ClubPlayerPayPortalPage({ params }: ClubPayPortalProps) {
    const { clubId } = use(params);
    const [club, setClub] = useState<any>(null);
    const [players, setPlayers] = useState<any[]>([]);
    const [payments, setPayments] = useState<any[]>([]);
    const [selectedPlayerId, setSelectedPlayerId] = useState<string>("");
    const [loading, setLoading] = useState(true);
    const [payingId, setPayingId] = useState<string | null>(null);

    useEffect(() => {
        const searchParams = new URLSearchParams(window.location.search);
        const preselectedPlayer = searchParams.get("player");
        if (preselectedPlayer) {
            setSelectedPlayerId(preselectedPlayer);
        }

        async function loadClubPortal() {
            try {
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
    }, [clubId]);

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
                alert(data.error || "Unable to open Stripe checkout. Please ask your club manager to verify their Stripe payout account.");
            }
        } catch (err) {
            console.error("Error launching Stripe checkout:", err);
            alert("An error occurred starting checkout.");
        } finally {
            setPayingId(null);
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
        <div className="min-h-screen bg-slate-950 text-white py-8 px-4">
            <div className="max-w-lg mx-auto space-y-5">
                {/* Club Header */}
                <Card className="border-slate-800 bg-slate-900/90 text-white shadow-2xl overflow-hidden relative">
                    <div className="absolute top-0 left-0 right-0 h-1.5" style={{ backgroundColor: primaryColor }} />
                    <CardHeader className="text-center pt-7 pb-5">
                        {club?.logo ? (
                            <img
                                src={club.logo}
                                alt={club.name}
                                className="h-16 w-16 mx-auto object-contain mb-2.5 rounded-full border border-slate-800 p-1 bg-slate-950"
                            />
                        ) : (
                            <Landmark className="h-12 w-12 text-slate-400 mx-auto mb-2" />
                        )}
                        <Badge className="mx-auto mb-1.5 bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold">
                            ClubFlow Pay • Player Portal
                        </Badge>
                        <CardTitle className="text-xl font-bold">{club?.name || "Football Club"}</CardTitle>
                        <CardDescription className="text-slate-400 text-xs">
                            Select your name below to view and pay your club fines &amp; payment requests directly via Stripe.
                        </CardDescription>
                    </CardHeader>

                    <CardContent className="px-6 pb-6 space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                                <User className="h-3.5 w-3.5" /> Select Your Player Profile
                            </label>
                            <select
                                value={selectedPlayerId}
                                onChange={e => setSelectedPlayerId(e.target.value)}
                                className="w-full h-11 rounded-xl border border-slate-700 bg-slate-950 px-3.5 text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            >
                                <option value="">— Choose your name —</option>
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
                    </CardContent>
                </Card>

                {/* Selected Player's Fines & Payment Requests */}
                {selectedPlayer && (
                    <div className="space-y-4">
                        {/* Unpaid Payment Requests */}
                        <Card className="border-slate-800 bg-slate-900/90 text-white">
                            <CardHeader className="pb-3 border-b border-slate-800">
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-base font-bold">
                                        Outstanding Payment Requests ({unpaidPayments.length})
                                    </CardTitle>
                                    {unpaidPayments.length > 0 && (
                                        <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-xs font-bold">
                                            £
                                            {unpaidPayments
                                                .reduce((sum, p) => sum + Number(p.amount || 0), 0)
                                                .toFixed(2)}{" "}
                                            Base Total
                                        </Badge>
                                    )}
                                </div>
                            </CardHeader>
                            <CardContent className="pt-4 space-y-3">
                                {unpaidPayments.length === 0 ? (
                                    <div className="text-center py-8 text-slate-400 space-y-1.5">
                                        <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto" />
                                        <p className="text-sm font-bold text-white">You&apos;re all settled!</p>
                                        <p className="text-xs text-slate-400">
                                            No unpaid fines or payment requests for {selectedPlayer.first_name}.
                                        </p>
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
                                                            Payment Account:{" "}
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
                                                        <span>Base Price (Fine Amount):</span>
                                                        <span className="font-semibold">
                                                            £{breakdown.basePrice.toFixed(2)}
                                                        </span>
                                                    </div>
                                                    {meta.feeCoverage === "player" && (
                                                        <div className="flex justify-between text-slate-400">
                                                            <span className="flex items-center gap-1">
                                                                <Receipt className="h-3 w-3" /> Transaction Fee:
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
                                        Settled Payments ({paidPayments.length})
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

                <div className="flex items-center justify-center gap-2 text-[11px] text-slate-500 pt-2">
                    <ShieldCheck className="h-4 w-4 text-emerald-500" />
                    <span>Powered by ClubFlow Pay &amp; Stripe • Direct Club Payouts</span>
                </div>
            </div>
        </div>
    );
}
