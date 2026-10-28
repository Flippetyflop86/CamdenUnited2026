"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/context/auth-context";
import { useClub } from "@/context/club-context";
import { supabase } from "@/lib/supabase";
import { isFormerPlayer } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    CreditCard,
    Send,
    Plus,
    Copy,
    Check,
    ExternalLink,
    ShieldCheck,
    AlertCircle,
    RefreshCw,
    Landmark,
    Coins,
    Trophy,
    CheckCircle2,
    Trash2,
    Pencil,
    Users,
    Sparkles,
    Search,
    Receipt,
    RotateCcw,
} from "lucide-react";

interface PaymentRequest {
    id: string;
    player_id: string;
    amount: number;
    description: string;
    status: "Unpaid" | "Paid" | "Void";
    created_at: string;
    paid_at?: string | null;
}

interface Player {
    id: string;
    first_name: string;
    last_name: string;
    position?: string;
    notes?: string;
}

export interface StandardFineRule {
    id: string;
    title: string;
    category: "Discipline" | "Punctuality" | "Kit & Gear" | "Matchday" | "Custom";
    amount: number;
    emoji: string;
}

const DEFAULT_STANDARD_FINES: StandardFineRule[] = [
    { id: "fine-yellow-dissent", title: "Yellow Card (Dissent / Sin Bin)", category: "Discipline", amount: 10, emoji: "🟨" },
    { id: "fine-yellow-foul", title: "Yellow Card (Foul)", category: "Discipline", amount: 5, emoji: "🟨" },
    { id: "fine-red-card", title: "Red Card", category: "Discipline", amount: 20, emoji: "🟥" },
    { id: "fine-late-matchday", title: "Late on Matchday", category: "Punctuality", amount: 10, emoji: "⏰" },
    { id: "fine-late-training", title: "Late to Training", category: "Punctuality", amount: 5, emoji: "🕒" },
    { id: "fine-no-show", title: "No Show Without Notice", category: "Punctuality", amount: 15, emoji: "👻" },
    { id: "fine-wrong-kit", title: "Forgotten Kit / Wrong Socks", category: "Kit & Gear", amount: 3, emoji: "🧦" },
    { id: "fine-dirty-boots", title: "Dirty Boots on Matchday", category: "Kit & Gear", amount: 2, emoji: "👟" },
    { id: "fine-missed-sitter", title: "Missed Open Goal / Sitter", category: "Matchday", amount: 2, emoji: "🥅" },
    { id: "fine-dod", title: "Donkey of the Day (DoD)", category: "Matchday", amount: 5, emoji: "🫏" },
];

export function calculatePlatformMarkup(baseAmount: number) {
    const base = Math.max(0, Number(baseAmount) || 0);
    // Spond-style slight markup: 3.9% + £0.25 (minimum £0.35)
    // Player pays base + fee; Club receives 100% of base; ClubFlow collects fee.
    const rawFee = base * 0.039 + 0.25;
    const serviceFee = Math.round(Math.max(0.35, rawFee) * 100) / 100;
    const totalPayable = Math.round((base + serviceFee) * 100) / 100;
    return {
        baseAmount: base,
        serviceFee,
        totalPayable,
    };
}

export default function PlayerPaymentsPage() {
    const { clubId, isManager } = useAuth();
    const { settings } = useClub();
    const [loading, setLoading] = useState(true);
    const [connectAccount, setConnectAccount] = useState<string | null>(null);
    const [onboardingComplete, setOnboardingComplete] = useState(false);
    const [players, setPlayers] = useState<Player[]>([]);
    const [payments, setPayments] = useState<PaymentRequest[]>([]);

    // Tabs & Filters
    const [activeView, setActiveView] = useState<"issue" | "tariff" | "leaderboard">("issue");
    const [statusFilter, setStatusFilter] = useState<"ALL" | "Unpaid" | "Paid">("ALL");
    const [ledgerSearch, setLedgerSearch] = useState("");
    const [activeSquadOnly, setActiveSquadOnly] = useState(true);

    // Standard Fine Master List (Tariff)
    const [fineRules, setFineRules] = useState<StandardFineRule[]>(DEFAULT_STANDARD_FINES);
    const [isAddRuleOpen, setIsAddRuleOpen] = useState(false);
    const [editingRule, setEditingRule] = useState<StandardFineRule | null>(null);
    const [ruleForm, setRuleForm] = useState<{
        title: string;
        category: StandardFineRule["category"];
        amount: string;
        emoji: string;
    }>({
        title: "",
        category: "Discipline",
        amount: "5",
        emoji: "🟨",
    });

    // Issue Fine State (supports 1 or multiple players at once!)
    const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
    const [selectedRuleId, setSelectedRuleId] = useState<string>(DEFAULT_STANDARD_FINES[0].id);
    const [amount, setAmount] = useState<string>(String(DEFAULT_STANDARD_FINES[0].amount));
    const [description, setDescription] = useState<string>(`${DEFAULT_STANDARD_FINES[0].emoji} ${DEFAULT_STANDARD_FINES[0].title}`);
    const [customContextNote, setCustomContextNote] = useState<string>("");
    const [creating, setCreating] = useState(false);

    // Copy & Onboarding UI state
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [onboardingLoading, setOnboardingLoading] = useState(false);

    const storageKey = clubId ? `clubflow-standard-fines-${clubId}` : "clubflow-standard-fines-default";

    useEffect(() => {
        try {
            const raw = localStorage.getItem(storageKey);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    setFineRules(parsed);
                    setSelectedRuleId(parsed[0].id);
                    setAmount(String(parsed[0].amount));
                    setDescription(`${parsed[0].emoji} ${parsed[0].title}`);
                }
            }
        } catch (err) {
            console.error("Failed to load fine tariff:", err);
        }
    }, [storageKey]);

    const saveFineRules = (nextRules: StandardFineRule[]) => {
        setFineRules(nextRules);
        try {
            localStorage.setItem(storageKey, JSON.stringify(nextRules));
        } catch (err) {
            console.error("Failed to save fine tariff:", err);
        }
    };

    useEffect(() => {
        if (!clubId) {
            setLoading(false);
            return;
        }
        loadData();
    }, [clubId]);

    const loadData = async () => {
        setLoading(true);
        try {
            const { data: clubData } = await supabase
                .from("clubs")
                .select("stripe_connect_account_id, stripe_connect_onboarding_completed")
                .eq("id", clubId)
                .single();

            if (clubData) {
                setConnectAccount(clubData.stripe_connect_account_id);
                setOnboardingComplete(clubData.stripe_connect_onboarding_completed || false);
            }

            const { data: playersData } = await supabase
                .from("players")
                .select("id, first_name, last_name, position, notes")
                .eq("club_id", clubId)
                .order("first_name", { ascending: true });

            if (playersData) {
                setPlayers(playersData);
            }

            const { data: paymentsData } = await supabase
                .from("player_payment_requests")
                .select("*")
                .eq("club_id", clubId)
                .order("created_at", { ascending: false });

            if (paymentsData) {
                setPayments(paymentsData as PaymentRequest[]);
            }
        } catch (error) {
            console.error("Error loading fines & payments:", error);
        } finally {
            setLoading(false);
        }
    };

    const eligiblePlayers = useMemo(() => {
        return players.filter(p => !activeSquadOnly || !isFormerPlayer(p.notes));
    }, [players, activeSquadOnly]);

    const handleSelectRule = (rule: StandardFineRule) => {
        setSelectedRuleId(rule.id);
        setAmount(String(rule.amount));
        setDescription(`${rule.emoji} ${rule.title}`);
    };

    const togglePlayerSelection = (playerId: string) => {
        setSelectedPlayerIds(prev =>
            prev.includes(playerId) ? prev.filter(id => id !== playerId) : [...prev, playerId]
        );
    };

    const handleConnectStripe = async () => {
        setOnboardingLoading(true);
        try {
            const res = await fetch("/api/checkout/connect-onboarding", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ clubId }),
            });
            const data = await res.json();
            if (data.url) {
                window.location.href = data.url;
            } else {
                alert(data.error || "Failed to start Stripe Connect onboarding.");
            }
        } catch (err) {
            console.error("Onboarding error:", err);
            alert("An error occurred starting onboarding.");
        } finally {
            setOnboardingLoading(false);
        }
    };

    const handleIssueFines = async (e: React.FormEvent) => {
        e.preventDefault();
        if (selectedPlayerIds.length === 0) {
            alert("Please select at least one player to fine.");
            return;
        }
        if (!amount || Number(amount) <= 0 || !description.trim()) {
            alert("Please enter a valid fine amount and description.");
            return;
        }

        setCreating(true);
        try {
            const finalDescription = customContextNote.trim()
                ? `${description.trim()} (${customContextNote.trim()})`
                : description.trim();

            const rowsToInsert = selectedPlayerIds.map(pid => ({
                club_id: clubId,
                player_id: pid,
                amount: parseFloat(amount),
                description: finalDescription,
                status: "Unpaid",
            }));

            const { data, error } = await supabase
                .from("player_payment_requests")
                .insert(rowsToInsert)
                .select();

            if (error) throw error;

            if (data) {
                setPayments(prev => [...(data as PaymentRequest[]), ...prev]);
                setSelectedPlayerIds([]);
                setCustomContextNote("");
            }
        } catch (err: any) {
            console.error("Failed to issue fine:", err);
            alert("Error issuing fine: " + err.message);
        } finally {
            setCreating(false);
        }
    };

    const handleTogglePaidStatus = async (payment: PaymentRequest) => {
        const nextStatus = payment.status === "Paid" ? "Unpaid" : "Paid";
        const nextPaidAt = nextStatus === "Paid" ? new Date().toISOString() : null;

        setPayments(prev =>
            prev.map(p => (p.id === payment.id ? { ...p, status: nextStatus, paid_at: nextPaidAt } : p))
        );

        try {
            const { error } = await supabase
                .from("player_payment_requests")
                .update({ status: nextStatus, paid_at: nextPaidAt })
                .eq("id", payment.id);
            if (error) throw error;
        } catch (err: any) {
            console.error("Failed to update fine status:", err);
            loadData();
        }
    };

    const handleDeleteFine = async (id: string) => {
        if (!confirm("Delete this fine record?")) return;
        setPayments(prev => prev.filter(p => p.id !== id));
        try {
            const { error } = await supabase.from("player_payment_requests").delete().eq("id", id);
            if (error) throw error;
        } catch (err) {
            console.error("Failed to delete fine:", err);
            loadData();
        }
    };

    const getPaymentLink = (paymentId: string) => {
        const origin = typeof window !== "undefined" ? window.location.origin : "https://clubflow.org.uk";
        return `${origin}/pay/${paymentId}`;
    };

    const handleCopyLink = (paymentId: string) => {
        const url = getPaymentLink(paymentId);
        navigator.clipboard.writeText(url);
        setCopiedId(paymentId);
        setTimeout(() => setCopiedId(null), 2000);
    };

    const handleSendWhatsApp = (payment: PaymentRequest) => {
        const player = players.find(p => p.id === payment.player_id);
        const playerName = player ? `${player.first_name} ${player.last_name}` : "Player";
        const url = getPaymentLink(payment.id);
        const breakdown = calculatePlatformMarkup(Number(payment.amount));
        const text = `⚖️ *${settings.name || "Club"} Fine Notice*\n\nHi ${playerName}, you have been issued a club fine:\n📌 *Offence:* ${payment.description}\n💷 *Fine Amount:* £${breakdown.baseAmount.toFixed(2)} (+£${breakdown.serviceFee.toFixed(2)} processing fee)\n\nPay securely in 1 tap here:\n🔗 ${url}`;
        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
    };

    const handleOpenNewRule = () => {
        setEditingRule(null);
        setRuleForm({
            title: "",
            category: "Discipline",
            amount: "5",
            emoji: "🟨",
        });
        setIsAddRuleOpen(true);
    };

    const handleOpenEditRule = (rule: StandardFineRule) => {
        setEditingRule(rule);
        setRuleForm({
            title: rule.title,
            category: rule.category,
            amount: String(rule.amount),
            emoji: rule.emoji || "🟨",
        });
        setIsAddRuleOpen(true);
    };

    const handleSaveRule = () => {
        if (!ruleForm.title.trim() || !ruleForm.amount || Number(ruleForm.amount) <= 0) return;

        if (editingRule) {
            const updated = fineRules.map(r =>
                r.id === editingRule.id
                    ? {
                          ...r,
                          title: ruleForm.title.trim(),
                          category: ruleForm.category,
                          amount: parseFloat(ruleForm.amount),
                          emoji: ruleForm.emoji || "⚖️",
                      }
                    : r
            );
            saveFineRules(updated);
        } else {
            const newRule: StandardFineRule = {
                id: `fine-${Date.now()}`,
                title: ruleForm.title.trim(),
                category: ruleForm.category,
                amount: parseFloat(ruleForm.amount),
                emoji: ruleForm.emoji || "⚖️",
            };
            saveFineRules([...fineRules, newRule]);
        }
        setIsAddRuleOpen(false);
    };

    const handleDeleteRule = (ruleId: string) => {
        const next = fineRules.filter(r => r.id !== ruleId);
        saveFineRules(next);
    };

    const handleResetDefaultTariff = () => {
        if (!confirm("Reset the Club Fine Tariff back to the standard 10 football fines?")) return;
        saveFineRules(DEFAULT_STANDARD_FINES);
    };

    // Summary KPIs
    const kpis = useMemo(() => {
        const unpaidList = payments.filter(p => p.status === "Unpaid");
        const paidList = payments.filter(p => p.status === "Paid");

        const unpaidClubTotal = unpaidList.reduce((sum, p) => sum + Number(p.amount || 0), 0);
        const paidClubTotal = paidList.reduce((sum, p) => sum + Number(p.amount || 0), 0);
        const platformMarkupEarned = paidList.reduce(
            (sum, p) => sum + calculatePlatformMarkup(Number(p.amount || 0)).serviceFee,
            0
        );
        const projectedPlatformMarkup = payments.reduce(
            (sum, p) => sum + calculatePlatformMarkup(Number(p.amount || 0)).serviceFee,
            0
        );

        return {
            unpaidCount: unpaidList.length,
            paidCount: paidList.length,
            unpaidClubTotal,
            paidClubTotal,
            platformMarkupEarned,
            projectedPlatformMarkup,
        };
    }, [payments]);

    // Player Fines Leaderboard ("Shame / Kitty Leaderboard")
    const playerLeaderboard = useMemo(() => {
        const map = new Map<
            string,
            {
                player: Player;
                totalFinesCount: number;
                unpaidCount: number;
                paidAmount: number;
                unpaidAmount: number;
                totalAmount: number;
            }
        >();

        players.forEach(p => {
            if (activeSquadOnly && isFormerPlayer(p.notes)) return;
            map.set(p.id, {
                player: p,
                totalFinesCount: 0,
                unpaidCount: 0,
                paidAmount: 0,
                unpaidAmount: 0,
                totalAmount: 0,
            });
        });

        payments.forEach(pay => {
            const p = players.find(x => x.id === pay.player_id);
            if (!p) return;
            if (activeSquadOnly && isFormerPlayer(p.notes)) return;

            const entry = map.get(p.id) || {
                player: p,
                totalFinesCount: 0,
                unpaidCount: 0,
                paidAmount: 0,
                unpaidAmount: 0,
                totalAmount: 0,
            };
            const amt = Number(pay.amount || 0);
            entry.totalFinesCount += 1;
            entry.totalAmount += amt;
            if (pay.status === "Paid") {
                entry.paidAmount += amt;
            } else if (pay.status === "Unpaid") {
                entry.unpaidCount += 1;
                entry.unpaidAmount += amt;
            }
            map.set(p.id, entry);
        });

        return Array.from(map.values())
            .filter(item => item.totalFinesCount > 0)
            .sort((a, b) => {
                if (b.totalAmount !== a.totalAmount) return b.totalAmount - a.totalAmount;
                return b.unpaidAmount - a.unpaidAmount;
            });
    }, [players, payments, activeSquadOnly]);

    const filteredPayments = useMemo(() => {
        return payments.filter(p => {
            if (statusFilter !== "ALL" && p.status !== statusFilter) return false;
            if (ledgerSearch.trim()) {
                const q = ledgerSearch.toLowerCase();
                const pl = players.find(x => x.id === p.player_id);
                const plName = pl ? `${pl.first_name} ${pl.last_name}`.toLowerCase() : "";
                const desc = (p.description || "").toLowerCase();
                return plName.includes(q) || desc.includes(q);
            }
            return true;
        });
    }, [payments, statusFilter, ledgerSearch, players]);

    const currentPreviewMarkup = calculatePlatformMarkup(Number(amount || 0));

    if (loading) {
        return <div className="p-8 text-center text-muted-foreground">Loading Fines &amp; Kitty System...</div>;
    }

    return (
        <div className="space-y-6 max-w-6xl mx-auto">
            {/* Page Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2">
                        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                            Fines &amp; Squad Kitty
                        </h1>
                        <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 text-[11px] font-bold">
                            Spond-Style Instant Checkout
                        </Badge>
                    </div>
                    <p className="text-muted-foreground text-sm mt-1">
                        Set your club&apos;s standard fine list, issue fines in one click, and collect 100% of every fine into the club kitty while players cover the small processing fee.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setActiveSquadOnly(prev => !prev)}
                        className={`text-xs font-semibold ${
                            activeSquadOnly
                                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/35"
                                : "border-border text-muted-foreground"
                        }`}
                    >
                        {activeSquadOnly ? "✓ Active Squad Only" : "Including Former Players"}
                    </Button>
                    <Button variant="outline" size="sm" onClick={loadData} className="gap-1.5 text-xs">
                        <RefreshCw className="h-3.5 w-3.5" /> Refresh
                    </Button>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="border-border bg-card shadow-xs">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                Club Kitty Collected
                            </p>
                            <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                                £{kpis.paidClubTotal.toFixed(2)}
                            </p>
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                                {kpis.paidCount} settled fine{kpis.paidCount === 1 ? "" : "s"} (100% to club)
                            </p>
                        </div>
                        <div className="h-11 w-11 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                            <Coins className="h-5 w-5" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-border bg-card shadow-xs">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                Outstanding Fines
                            </p>
                            <p className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">
                                £{kpis.unpaidClubTotal.toFixed(2)}
                            </p>
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                                {kpis.unpaidCount} awaiting player payment
                            </p>
                        </div>
                        <div className="h-11 w-11 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
                            <AlertCircle className="h-5 w-5" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-border bg-card shadow-xs">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                Standard Fine Rules
                            </p>
                            <p className="text-2xl font-black text-foreground mt-1">{fineRules.length}</p>
                            <button
                                type="button"
                                onClick={() => setActiveView("tariff")}
                                className="text-[11px] text-brand font-semibold hover:underline mt-0.5"
                            >
                                Customise Fine List →
                            </button>
                        </div>
                        <div className="h-11 w-11 rounded-xl bg-brand/15 border border-brand/30 flex items-center justify-center text-brand">
                            <Receipt className="h-5 w-5" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-border bg-card shadow-xs">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                Platform Fee Revenue
                            </p>
                            <p className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-1">
                                £{kpis.platformMarkupEarned.toFixed(2)}
                            </p>
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                                £{kpis.projectedPlatformMarkup.toFixed(2)} total across all issued fines
                            </p>
                        </div>
                        <div className="h-11 w-11 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                            <Sparkles className="h-5 w-5" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Stripe Connect Status Banner */}
            <Card className="border-border bg-surface-1/60">
                <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div
                            className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${
                                onboardingComplete
                                    ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                                    : "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30"
                            }`}
                        >
                            {onboardingComplete ? <ShieldCheck className="h-5 w-5" /> : <Landmark className="h-5 w-5" />}
                        </div>
                        <div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="text-sm font-bold text-foreground">
                                    {onboardingComplete
                                        ? "Stripe Connect Active — Instant Apple Pay / Card Fines Enabled"
                                        : "Connect Club Bank Account for Instant Apple Pay & Card Fine Payouts"}
                                </h3>
                                {onboardingComplete && (
                                    <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-[10px]">
                                        Verified
                                    </Badge>
                                )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                {onboardingComplete
                                    ? "Players pay the fine + small service fee via Apple Pay/Card. Your club receives 100% of the fine amount directly."
                                    : "You can issue fines and track cash/bank payments right away, or connect Stripe so players can pay in 1 tap via Apple Pay / Card."}
                            </p>
                        </div>
                    </div>
                    {isManager && (
                        <Button
                            size="sm"
                            variant={onboardingComplete ? "outline" : "default"}
                            onClick={handleConnectStripe}
                            disabled={onboardingLoading}
                            className={onboardingComplete ? "shrink-0 text-xs" : "bg-indigo-600 hover:bg-indigo-700 text-white shrink-0 text-xs font-semibold"}
                        >
                            {onboardingLoading
                                ? "Connecting..."
                                : onboardingComplete
                                ? "Update Payout Bank"
                                : "Connect Bank with Stripe"}
                        </Button>
                    )}
                </CardContent>
            </Card>

            {/* Sub-Navigation Pills */}
            <div className="flex flex-wrap items-center gap-2 border-b border-border pb-3">
                <button
                    type="button"
                    onClick={() => setActiveView("issue")}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                        activeView === "issue"
                            ? "bg-brand text-white shadow-xs"
                            : "bg-surface-1 text-muted-foreground hover:text-foreground border border-border"
                    }`}
                >
                    <Coins className="h-4 w-4" />
                    Issue Fines &amp; Ledger ({payments.length})
                </button>
                <button
                    type="button"
                    onClick={() => setActiveView("tariff")}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                        activeView === "tariff"
                            ? "bg-brand text-white shadow-xs"
                            : "bg-surface-1 text-muted-foreground hover:text-foreground border border-border"
                    }`}
                >
                    <Receipt className="h-4 w-4" />
                    Club Standard Fine List ({fineRules.length})
                </button>
                <button
                    type="button"
                    onClick={() => setActiveView("leaderboard")}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                        activeView === "leaderboard"
                            ? "bg-brand text-white shadow-xs"
                            : "bg-surface-1 text-muted-foreground hover:text-foreground border border-border"
                    }`}
                >
                    <Trophy className="h-4 w-4" />
                    Squad Fines Leaderboard ({playerLeaderboard.length})
                </button>
            </div>

            {/* VIEW 1: ISSUE FINES & LEDGER */}
            {activeView === "issue" && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* Left Column: Spond-Style Quick Fine Issuer */}
                    <Card className="lg:col-span-5 border-border h-fit">
                        <CardHeader className="pb-3 border-b border-border bg-surface-1/50">
                            <CardTitle className="text-base font-bold flex items-center gap-2">
                                <Plus className="h-4 w-4 text-brand" /> Issue Fine from Standard List
                            </CardTitle>
                            <CardDescription className="text-xs">
                                Tap a standard club offence, select one or more players, and issue the fine in seconds.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="pt-4">
                            <form onSubmit={handleIssueFines} className="space-y-4">
                                {/* Step 1: Pick Offence from Standard Fine Menu */}
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                            1. Tap Standard Fine
                                        </Label>
                                        <button
                                            type="button"
                                            onClick={() => setActiveView("tariff")}
                                            className="text-[11px] font-semibold text-brand hover:underline"
                                        >
                                            Edit Fine List
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-52 overflow-y-auto pr-1">
                                        {fineRules.map(rule => {
                                            const isSelected = selectedRuleId === rule.id;
                                            return (
                                                <button
                                                    key={rule.id}
                                                    type="button"
                                                    onClick={() => handleSelectRule(rule)}
                                                    className={`flex items-center justify-between gap-2 p-2 rounded-lg border text-left text-xs transition-all cursor-pointer ${
                                                        isSelected
                                                            ? "bg-brand/15 border-brand text-foreground font-bold shadow-2xs"
                                                            : "bg-surface-1/60 border-border text-muted-foreground hover:text-foreground hover:bg-surface-1"
                                                    }`}
                                                >
                                                    <span className="truncate flex items-center gap-1.5">
                                                        <span>{rule.emoji}</span>
                                                        <span className="truncate">{rule.title}</span>
                                                    </span>
                                                    <span className="font-black text-emerald-600 dark:text-emerald-400 shrink-0">
                                                        £{rule.amount}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Step 2: Select 1 or Multiple Players */}
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                            2. Select Player(s) ({selectedPlayerIds.length} selected)
                                        </Label>
                                        {selectedPlayerIds.length > 0 && (
                                            <button
                                                type="button"
                                                onClick={() => setSelectedPlayerIds([])}
                                                className="text-[11px] text-muted-foreground hover:text-foreground underline"
                                            >
                                                Clear
                                            </button>
                                        )}
                                    </div>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-48 overflow-y-auto p-2 rounded-xl border border-border bg-surface-1/40">
                                        {eligiblePlayers.map(p => {
                                            const checked = selectedPlayerIds.includes(p.id);
                                            return (
                                                <button
                                                    key={p.id}
                                                    type="button"
                                                    onClick={() => togglePlayerSelection(p.id)}
                                                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border text-left truncate transition-all cursor-pointer flex items-center justify-between gap-1 ${
                                                        checked
                                                            ? "bg-brand text-white border-brand shadow-2xs"
                                                            : "bg-background text-foreground border-border hover:bg-surface-1"
                                                    }`}
                                                >
                                                    <span className="truncate">
                                                        {p.first_name} {p.last_name}
                                                    </span>
                                                    {checked && <Check className="h-3 w-3 shrink-0" />}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Step 3: Fine Amount & Custom Note */}
                                <div className="grid grid-cols-3 gap-3">
                                    <div className="col-span-1 space-y-1.5">
                                        <Label className="text-xs font-semibold">Fine (£)</Label>
                                        <Input
                                            type="number"
                                            step="0.50"
                                            min="0.50"
                                            value={amount}
                                            onChange={e => setAmount(e.target.value)}
                                            className="h-9 text-xs font-bold"
                                            required
                                        />
                                    </div>
                                    <div className="col-span-2 space-y-1.5">
                                        <Label className="text-xs font-semibold">Offence Title</Label>
                                        <Input
                                            type="text"
                                            value={description}
                                            onChange={e => setDescription(e.target.value)}
                                            placeholder="e.g. 🟨 Yellow Card (Dissent)"
                                            className="h-9 text-xs"
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <Label className="text-xs font-semibold">Match / Context Note (Optional)</Label>
                                    <Input
                                        type="text"
                                        placeholder="e.g. vs Hackney Wick (18 mins late)"
                                        value={customContextNote}
                                        onChange={e => setCustomContextNote(e.target.value)}
                                        className="h-9 text-xs"
                                    />
                                </div>

                                {/* Spond-Style Transparent Fee Breakdown Preview */}
                                <div className="rounded-xl border border-border bg-surface-1/80 p-3 space-y-1.5 text-xs">
                                    <div className="flex items-center justify-between text-muted-foreground">
                                        <span>Club Fine (100% to {settings.name || "Club"} Kitty):</span>
                                        <span className="font-bold text-foreground">
                                            £{currentPreviewMarkup.baseAmount.toFixed(2)}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between text-muted-foreground">
                                        <span>Player Processing &amp; Platform Fee:</span>
                                        <span className="font-medium text-indigo-600 dark:text-indigo-400">
                                            +£{currentPreviewMarkup.serviceFee.toFixed(2)}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between border-t border-border pt-1.5 font-bold">
                                        <span className="text-foreground">Total Payable per Player:</span>
                                        <span className="text-emerald-600 dark:text-emerald-400 text-sm">
                                            £{currentPreviewMarkup.totalPayable.toFixed(2)}
                                        </span>
                                    </div>
                                </div>

                                <Button
                                    type="submit"
                                    disabled={creating || selectedPlayerIds.length === 0}
                                    className="w-full bg-brand hover:bg-brand/90 text-white font-bold h-10"
                                >
                                    {creating
                                        ? "Issuing Fine..."
                                        : selectedPlayerIds.length > 1
                                        ? `Issue Fine to ${selectedPlayerIds.length} Players (£${(Number(amount || 0) * selectedPlayerIds.length).toFixed(2)} total)`
                                        : "Issue Fine"}
                                </Button>
                            </form>
                        </CardContent>
                    </Card>

                    {/* Right Column: Active Fines Ledger */}
                    <Card className="lg:col-span-7 border-border">
                        <CardHeader className="pb-3 border-b border-border bg-surface-1/50">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div>
                                    <CardTitle className="text-base font-bold">Fines &amp; Payment Ledger</CardTitle>
                                    <CardDescription className="text-xs">
                                        Send 1-tap payment links to WhatsApp or mark fines as settled.
                                    </CardDescription>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    {(["ALL", "Unpaid", "Paid"] as const).map(st => (
                                        <button
                                            key={st}
                                            type="button"
                                            onClick={() => setStatusFilter(st)}
                                            className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all ${
                                                statusFilter === st
                                                    ? "bg-brand text-white border-brand"
                                                    : "bg-background text-muted-foreground border-border hover:text-foreground"
                                            }`}
                                        >
                                            {st === "ALL" ? `All (${payments.length})` : st}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="relative mt-2">
                                <Search className="h-3.5 w-3.5 text-muted-foreground absolute left-3 top-2.5" />
                                <Input
                                    placeholder="Search by player name or fine reason..."
                                    value={ledgerSearch}
                                    onChange={e => setLedgerSearch(e.target.value)}
                                    className="h-8 pl-8 text-xs"
                                />
                            </div>
                        </CardHeader>
                        <CardContent className="pt-4">
                            {filteredPayments.length === 0 ? (
                                <div className="text-center py-12 border-2 border-dashed border-border rounded-xl">
                                    <Coins className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-60" />
                                    <p className="text-sm font-semibold text-foreground">No fines match your filter</p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Select a standard fine on the left to issue your first squad fine.
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-2.5 max-h-[600px] overflow-y-auto pr-1">
                                    {filteredPayments.map(pay => {
                                        const player = players.find(p => p.id === pay.player_id);
                                        const isPaid = pay.status === "Paid";
                                        const breakdown = calculatePlatformMarkup(Number(pay.amount));

                                        return (
                                            <div
                                                key={pay.id}
                                                className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3.5 rounded-xl border border-border bg-card hover:bg-surface-1/50 transition-colors gap-3"
                                            >
                                                <div className="space-y-1 min-w-0">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span className="font-bold text-sm text-foreground">
                                                            {player
                                                                ? `${player.first_name} ${player.last_name}`
                                                                : "Squad Member"}
                                                        </span>
                                                        <Badge
                                                            variant="outline"
                                                            className={
                                                                isPaid
                                                                    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/35 text-[10px] font-bold"
                                                                    : "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/35 text-[10px] font-bold"
                                                            }
                                                        >
                                                            {isPaid ? "✓ Paid" : "Unpaid"}
                                                        </Badge>
                                                    </div>
                                                    <p className="text-xs font-medium text-foreground/90">{pay.description}</p>
                                                    <p className="text-[11px] text-muted-foreground">
                                                        Issued {new Date(pay.created_at).toLocaleDateString("en-GB")}
                                                        {pay.paid_at
                                                            ? ` • Paid ${new Date(pay.paid_at).toLocaleDateString("en-GB")}`
                                                            : ` • Player checkout: £${breakdown.totalPayable.toFixed(2)} (incl. £${breakdown.serviceFee.toFixed(2)} fee)`}
                                                    </p>
                                                </div>

                                                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                                                    <div className="text-right mr-1">
                                                        <span className="text-base font-black text-foreground block">
                                                            £{Number(pay.amount).toFixed(2)}
                                                        </span>
                                                        <span className="text-[10px] text-muted-foreground block">
                                                            Club Net
                                                        </span>
                                                    </div>

                                                    {!isPaid && (
                                                        <>
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                className="h-8 px-2.5 text-xs gap-1"
                                                                onClick={() => handleCopyLink(pay.id)}
                                                                title="Copy player payment link"
                                                            >
                                                                {copiedId === pay.id ? (
                                                                    <Check className="h-3.5 w-3.5 text-emerald-500" />
                                                                ) : (
                                                                    <Copy className="h-3.5 w-3.5" />
                                                                )}
                                                                {copiedId === pay.id ? "Copied" : "Link"}
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                className="h-8 px-2.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1 font-semibold"
                                                                onClick={() => handleSendWhatsApp(pay)}
                                                                title="Send fine checkout link via WhatsApp"
                                                            >
                                                                <Send className="h-3 w-3" /> WhatsApp
                                                            </Button>
                                                        </>
                                                    )}

                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => handleTogglePaidStatus(pay)}
                                                        className={`h-8 px-2.5 text-xs font-semibold ${
                                                            isPaid
                                                                ? "border-border text-muted-foreground hover:text-foreground"
                                                                : "border-emerald-500/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/15"
                                                        }`}
                                                        title={isPaid ? "Mark as Unpaid" : "Mark as Paid (Cash / Bank Transfer)"}
                                                    >
                                                        <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                                                        {isPaid ? "Undo" : "Mark Paid"}
                                                    </Button>

                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() => handleDeleteFine(pay.id)}
                                                        className="h-8 w-8 p-0 text-muted-foreground hover:text-rose-500"
                                                        title="Delete fine"
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </Button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* VIEW 2: CLUB STANDARD FINE LIST (TARIFF) */}
            {activeView === "tariff" && (
                <Card className="border-border">
                    <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border bg-surface-1/50">
                        <div>
                            <CardTitle className="text-lg font-bold">Club Standard Fine List (Tariff)</CardTitle>
                            <CardDescription className="text-xs">
                                Configure your club&apos;s official fine menu for yellows, lateness, kit offences, and matchday moments.
                            </CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" onClick={handleResetDefaultTariff} className="text-xs gap-1.5">
                                <RotateCcw className="h-3.5 w-3.5" /> Reset Defaults
                            </Button>
                            <Button size="sm" onClick={handleOpenNewRule} className="bg-brand hover:bg-brand/90 text-white text-xs font-bold gap-1.5">
                                <Plus className="h-3.5 w-3.5" /> Add Standard Fine
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="pt-5">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {fineRules.map(rule => {
                                const markup = calculatePlatformMarkup(rule.amount);
                                return (
                                    <div
                                        key={rule.id}
                                        className="p-4 rounded-xl border border-border bg-card hover:bg-surface-1/50 transition-all flex flex-col justify-between gap-3"
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex items-start gap-2.5">
                                                <span className="text-2xl leading-none mt-0.5">{rule.emoji}</span>
                                                <div>
                                                    <Badge variant="outline" className="text-[10px] mb-1">
                                                        {rule.category}
                                                    </Badge>
                                                    <h4 className="font-bold text-sm text-foreground">{rule.title}</h4>
                                                </div>
                                            </div>
                                            <div className="text-right shrink-0">
                                                <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                                                    £{rule.amount.toFixed(2)}
                                                </span>
                                                <span className="block text-[10px] text-muted-foreground">
                                                    Player pays £{markup.totalPayable.toFixed(2)}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between border-t border-border pt-2.5">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="h-7 text-xs font-semibold"
                                                onClick={() => {
                                                    handleSelectRule(rule);
                                                    setActiveView("issue");
                                                }}
                                            >
                                                Issue This Fine →
                                            </Button>
                                            <div className="flex items-center gap-1">
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                                                    onClick={() => handleOpenEditRule(rule)}
                                                >
                                                    <Pencil className="h-3.5 w-3.5" />
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="h-7 w-7 p-0 text-muted-foreground hover:text-rose-500"
                                                    onClick={() => handleDeleteRule(rule.id)}
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* VIEW 3: SQUAD FINES LEADERBOARD */}
            {activeView === "leaderboard" && (
                <Card className="border-border overflow-hidden">
                    <CardHeader className="border-b border-border bg-surface-1/50">
                        <CardTitle className="text-lg font-bold flex items-center gap-2">
                            <Trophy className="h-5 w-5 text-amber-500" /> Squad Fines Leaderboard
                        </CardTitle>
                        <CardDescription className="text-xs">
                            See who has contributed the most to the team kitty this season and who still owes unpaid fines.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                        {playerLeaderboard.length === 0 ? (
                            <div className="p-12 text-center text-muted-foreground text-sm">
                                No fines have been issued yet this season.
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-surface-1 text-muted-foreground uppercase text-xs font-bold border-b border-border">
                                        <tr>
                                            <th className="px-5 py-3.5">#</th>
                                            <th className="px-5 py-3.5">Player</th>
                                            <th className="px-4 py-3.5 text-center">Fines Issued</th>
                                            <th className="px-4 py-3.5 text-center">Paid to Kitty</th>
                                            <th className="px-4 py-3.5 text-center">Outstanding</th>
                                            <th className="px-5 py-3.5 text-right">Total Fined</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border">
                                        {playerLeaderboard.map((row, idx) => (
                                            <tr key={row.player.id} className="hover:bg-surface-1/50 transition-colors">
                                                <td className="px-5 py-3.5 font-black text-muted-foreground">
                                                    {idx + 1}
                                                </td>
                                                <td className="px-5 py-3.5 font-bold text-foreground">
                                                    {row.player.first_name} {row.player.last_name}
                                                    {row.player.position && (
                                                        <span className="ml-2 text-[11px] font-semibold text-muted-foreground">
                                                            ({row.player.position})
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3.5 text-center font-semibold">
                                                    {row.totalFinesCount}
                                                </td>
                                                <td className="px-4 py-3.5 text-center font-bold text-emerald-600 dark:text-emerald-400">
                                                    £{row.paidAmount.toFixed(2)}
                                                </td>
                                                <td className="px-4 py-3.5 text-center">
                                                    {row.unpaidAmount > 0 ? (
                                                        <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/35 font-bold">
                                                            £{row.unpaidAmount.toFixed(2)} ({row.unpaidCount} unpaid)
                                                        </Badge>
                                                    ) : (
                                                        <span className="text-xs text-muted-foreground">All settled ✓</span>
                                                    )}
                                                </td>
                                                <td className="px-5 py-3.5 text-right font-black text-foreground">
                                                    £{row.totalAmount.toFixed(2)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Add / Edit Standard Fine Rule Modal */}
            <Dialog open={isAddRuleOpen} onOpenChange={setIsAddRuleOpen}>
                <DialogContent className="sm:max-w-[440px]">
                    <DialogHeader>
                        <DialogTitle>{editingRule ? "Edit Standard Fine" : "Add Standard Fine to Club Tariff"}</DialogTitle>
                        <DialogDescription className="text-xs">
                            Set the offence title, category, and standard club fine amount.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="grid grid-cols-4 gap-3">
                            <div className="col-span-1 space-y-1.5">
                                <Label className="text-xs font-semibold">Icon</Label>
                                <Input
                                    value={ruleForm.emoji}
                                    onChange={e => setRuleForm({ ...ruleForm, emoji: e.target.value })}
                                    className="h-9 text-center text-base"
                                    maxLength={4}
                                />
                            </div>
                            <div className="col-span-3 space-y-1.5">
                                <Label className="text-xs font-semibold">Offence Title</Label>
                                <Input
                                    placeholder="e.g. Late on Matchday"
                                    value={ruleForm.title}
                                    onChange={e => setRuleForm({ ...ruleForm, title: e.target.value })}
                                    className="h-9 text-xs"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label className="text-xs font-semibold">Category</Label>
                                <select
                                    value={ruleForm.category}
                                    onChange={e =>
                                        setRuleForm({
                                            ...ruleForm,
                                            category: e.target.value as StandardFineRule["category"],
                                        })
                                    }
                                    className="flex h-9 w-full rounded-md border border-border bg-background px-3 text-xs text-foreground"
                                >
                                    <option value="Discipline">Discipline</option>
                                    <option value="Punctuality">Punctuality</option>
                                    <option value="Kit & Gear">Kit &amp; Gear</option>
                                    <option value="Matchday">Matchday</option>
                                    <option value="Custom">Custom</option>
                                </select>
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs font-semibold">Fine Amount (£)</Label>
                                <Input
                                    type="number"
                                    step="0.50"
                                    min="0.50"
                                    value={ruleForm.amount}
                                    onChange={e => setRuleForm({ ...ruleForm, amount: e.target.value })}
                                    className="h-9 text-xs font-bold"
                                />
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" size="sm" onClick={() => setIsAddRuleOpen(false)}>
                            Cancel
                        </Button>
                        <Button size="sm" onClick={handleSaveRule} className="bg-brand hover:bg-brand/90 text-white font-semibold">
                            Save Fine Rule
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
