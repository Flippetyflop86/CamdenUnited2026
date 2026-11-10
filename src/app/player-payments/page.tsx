"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/context/auth-context";
import { useClub } from "@/context/club-context";
import { supabase, fetchScopedMatchPlayerStats } from "@/lib/supabase";
import { parseStatTextString } from "@/lib/match-stats-sync";
import { isFormerPlayer } from "@/lib/utils";
import {
    calculateClubFlowFee,
    encodePaymentDescription,
    parsePaymentDescription,
} from "@/lib/clubflow-pay";
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
    Sparkles,
    Search,
    Receipt,
    RotateCcw,
    Calendar,
    Clock,
    Smartphone,
    Building2,
    Share2,
} from "lucide-react";

interface PaymentRequest {
    id: string;
    player_id: string;
    amount: number;
    description: string;
    status: "Unpaid" | "Paid" | "Void";
    created_at: string;
    paid_at?: string | null;
    stripe_checkout_session_id?: string | null;
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

interface ClubPayoutAccountConfig {
    accountName: string;
    sortCode: string;
    accountNumber: string;
    defaultFeeCoverage: "player" | "club";
    accountHolderType: "individual" | "company" | "non_profit";
    treasurerFirstName: string;
    treasurerLastName: string;
    treasurerEmail: string;
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

function getDefaultDueDateStr(daysAhead = 7): string {
    const d = new Date();
    d.setDate(d.getDate() + daysAhead);
    return d.toISOString().split("T")[0];
}

export default function PlayerPaymentsPage() {
    const { clubId, isManager } = useAuth();
    const { settings } = useClub();
    const [loading, setLoading] = useState(true);
    const [connectAccount, setConnectAccount] = useState<string | null>(null);
    const [onboardingComplete, setOnboardingComplete] = useState(false);
    const [connectBanner, setConnectBanner] = useState<"success" | "refresh" | null>(null);
    const [players, setPlayers] = useState<Player[]>([]);
    const [payments, setPayments] = useState<PaymentRequest[]>([]);

    // Tabs & Filters
    const [activeView, setActiveView] = useState<"issue" | "tariff" | "leaderboard" | "account">("issue");
    const [statusFilter, setStatusFilter] = useState<"ALL" | "Unpaid" | "Paid">("ALL");
    const [ledgerSearch, setLedgerSearch] = useState("");
    const [playerPickerSearch, setPlayerPickerSearch] = useState("");
    const [activeSquadOnly, setActiveSquadOnly] = useState(true);

    // Club Payout Account Configuration
    const [payoutAccount, setPayoutAccount] = useState<ClubPayoutAccountConfig>({
        accountName: "",
        sortCode: "",
        accountNumber: "",
        defaultFeeCoverage: "player",
        accountHolderType: "individual",
        treasurerFirstName: "",
        treasurerLastName: "",
        treasurerEmail: "",
    });
    const [isEditingAccountModal, setIsEditingAccountModal] = useState(false);
    const [copiedBankDetails, setCopiedBankDetails] = useState(false);

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

    // Payment Request Creation State
    const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
    const [selectedRuleId, setSelectedRuleId] = useState<string>(DEFAULT_STANDARD_FINES[0].id);
    const [basePrice, setBasePrice] = useState<string>(String(DEFAULT_STANDARD_FINES[0].amount));
    const [description, setDescription] = useState<string>(`${DEFAULT_STANDARD_FINES[0].emoji} ${DEFAULT_STANDARD_FINES[0].title}`);
    const [dueDate, setDueDate] = useState<string>(() => getDefaultDueDateStr(7));
    const [feeCoverage, setFeeCoverage] = useState<"player" | "club">("player");
    const [customContextNote, setCustomContextNote] = useState<string>("");
    const [creating, setCreating] = useState(false);

    // Copy & Onboarding UI state
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [copiedPlayerLinkId, setCopiedPlayerLinkId] = useState<string | null>(null);
    const [copiedPortalLink, setCopiedPortalLink] = useState(false);
    const [copiedGroupSheet, setCopiedGroupSheet] = useState(false);
    const [onboardingLoading, setOnboardingLoading] = useState(false);
    const [syncingStripe, setSyncingStripe] = useState(false);
    const [syncingCardFines, setSyncingCardFines] = useState(false);
    const [cardFineBanner, setCardFineBanner] = useState<string | null>(null);

    const storageKey = clubId ? `clubflow-standard-fines-${clubId}` : "clubflow-standard-fines-default";
    const accountStorageKey = clubId ? `clubflow-payout-account-${clubId}` : "clubflow-payout-account-default";

    // Sync Fine Tariff & Payout Account Config to Supabase so all devices stay in sync
    const persistConfigToSupabase = async (
        nextRules: StandardFineRule[],
        nextAcct: ClubPayoutAccountConfig
    ) => {
        if (!clubId) return;
        try {
            const payload = JSON.stringify({
                fineRules: nextRules,
                payoutAccount: nextAcct,
                updatedAt: new Date().toISOString(),
            });
            const { data: existingDoc } = await supabase
                .from("documents")
                .select("id")
                .eq("club_id", clubId)
                .eq("category", "CLUB_FINES_CONFIG")
                .maybeSingle();

            if (existingDoc?.id) {
                await supabase
                    .from("documents")
                    .update({ url: payload, name: "ClubFlow Pay Config" })
                    .eq("id", existingDoc.id);
            } else {
                await supabase.from("documents").insert({
                    club_id: clubId,
                    name: "ClubFlow Pay Config",
                    type: "JSON",
                    category: "CLUB_FINES_CONFIG",
                    url: payload,
                });
            }
        } catch {}
    };

    useEffect(() => {
        try {
            const raw = localStorage.getItem(storageKey);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    setFineRules(parsed);
                    setSelectedRuleId(parsed[0].id);
                    setBasePrice(String(parsed[0].amount));
                    setDescription(`${parsed[0].emoji} ${parsed[0].title}`);
                }
            }
        } catch (err) {
            console.error("Failed to load fine tariff:", err);
        }

        try {
            const rawAcct = localStorage.getItem(accountStorageKey);
            if (rawAcct) {
                const parsedAcct = JSON.parse(rawAcct);
                setPayoutAccount({
                    accountName: parsedAcct.accountName || `${settings.name || "Club"} Main Account`,
                    sortCode: parsedAcct.sortCode || "",
                    accountNumber: parsedAcct.accountNumber || parsedAcct.accountNumberLast4 || "",
                    defaultFeeCoverage: parsedAcct.defaultFeeCoverage === "club" ? "club" : "player",
                    accountHolderType: parsedAcct.accountHolderType || "individual",
                    treasurerFirstName: parsedAcct.treasurerFirstName || "",
                    treasurerLastName: parsedAcct.treasurerLastName || "",
                    treasurerEmail: parsedAcct.treasurerEmail || "",
                });
                setFeeCoverage(parsedAcct.defaultFeeCoverage === "club" ? "club" : "player");
            } else {
                setPayoutAccount(prev => ({
                    ...prev,
                    accountName: `${settings.name || "ClubFlow"} Club Account`,
                }));
            }
        } catch (err) {
            console.error("Failed to load payout account config:", err);
        }
    }, [storageKey, accountStorageKey, settings.name]);

    const saveFineRules = (nextRules: StandardFineRule[]) => {
        setFineRules(nextRules);
        try {
            localStorage.setItem(storageKey, JSON.stringify(nextRules));
        } catch (err) {
            console.error("Failed to save fine tariff:", err);
        }
        persistConfigToSupabase(nextRules, payoutAccount);
    };

    const savePayoutAccountConfig = (nextConfig: ClubPayoutAccountConfig) => {
        setPayoutAccount(nextConfig);
        setFeeCoverage(nextConfig.defaultFeeCoverage);
        try {
            localStorage.setItem(accountStorageKey, JSON.stringify(nextConfig));
        } catch (err) {
            console.error("Failed to save payout account config:", err);
        }
        persistConfigToSupabase(fineRules, nextConfig);
        setIsEditingAccountModal(false);
    };

    useEffect(() => {
        if (!clubId) {
            setLoading(false);
            return;
        }
        const searchParams = new URLSearchParams(window.location.search);
        const connectParam = searchParams.get("connect");
        if (connectParam === "success") {
            setConnectBanner("success");
        } else if (connectParam === "refresh") {
            setConnectBanner("refresh");
        }
        loadData(connectParam === "success" || connectParam === "refresh");
    }, [clubId]);

    const loadData = async (forceVerifyConnect = false) => {
        setLoading(true);
        try {
            // Load remote fine tariff & payout config from Supabase if available
            const { data: remoteCfg } = await supabase
                .from("documents")
                .select("url")
                .eq("club_id", clubId)
                .eq("category", "CLUB_FINES_CONFIG")
                .maybeSingle();

            if (remoteCfg?.url) {
                try {
                    const parsedRemote = JSON.parse(remoteCfg.url);
                    if (Array.isArray(parsedRemote.fineRules) && parsedRemote.fineRules.length > 0) {
                        setFineRules(parsedRemote.fineRules);
                        localStorage.setItem(storageKey, JSON.stringify(parsedRemote.fineRules));
                    }
                    if (parsedRemote.payoutAccount) {
                        setPayoutAccount(prev => ({
                            ...prev,
                            ...parsedRemote.payoutAccount,
                        }));
                        localStorage.setItem(
                            accountStorageKey,
                            JSON.stringify(parsedRemote.payoutAccount)
                        );
                    }
                } catch {}
            }

            const { data: clubData } = await supabase
                .from("clubs")
                .select("stripe_connect_account_id, stripe_connect_onboarding_completed")
                .eq("id", clubId)
                .single();

            if (clubData) {
                setConnectAccount(clubData.stripe_connect_account_id);
                setOnboardingComplete(clubData.stripe_connect_onboarding_completed || false);

                if (
                    clubData.stripe_connect_account_id &&
                    (!clubData.stripe_connect_onboarding_completed || forceVerifyConnect)
                ) {
                    fetch("/api/checkout/verify-payment", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ clubId }),
                    })
                        .then(r => r.json())
                        .then(res => {
                            if (res.onboardingComplete) setOnboardingComplete(true);
                        })
                        .catch(() => {});
                }
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
            console.error("Error loading ClubFlow Pay:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSyncMatchdayCardFines = async () => {
        if (!clubId) return;
        setSyncingCardFines(true);
        try {
            const [{ data: matchesData }, statsRows] = await Promise.all([
                supabase
                    .from("matches")
                    .select("id, date, opponent, yellow_cards, red_cards")
                    .eq("club_id", clubId)
                    .order("date", { ascending: false }),
                fetchScopedMatchPlayerStats({ playerIds: players.map(p => p.id) }),
            ]);

            const yellowRule =
                fineRules.find(r => r.id === "fine-yellow-foul") ||
                fineRules.find(r => r.title.toLowerCase().includes("yellow")) ||
                { amount: 5, emoji: "🟨", title: "Yellow Card" };
            const redRule =
                fineRules.find(r => r.id === "fine-red-card") ||
                fineRules.find(r => r.title.toLowerCase().includes("red")) ||
                { amount: 20, emoji: "🟥", title: "Red Card" };

            const newFinePayloads: any[] = [];
            const existingDescriptions = new Set(
                payments.map(p => `${p.player_id}::${parsePaymentDescription(p.description).cleanDescription.toLowerCase()}`)
            );

            for (const m of matchesData || []) {
                const matchLabel = `vs ${m.opponent} (${m.date})`;
                const ycMap = new Map<string, number>();
                const rcMap = new Map<string, number>();

                // 1. From match_player_stats
                for (const st of statsRows || []) {
                    if (st.match_id === m.id) {
                        if (Number(st.yellow_cards) > 0) ycMap.set(st.player_id, Number(st.yellow_cards));
                        if (Number(st.red_cards) > 0) rcMap.set(st.player_id, Number(st.red_cards));
                    }
                }

                // 2. Fallback from text strings on match row
                if (ycMap.size === 0 && m.yellow_cards) {
                    const tokens = parseStatTextString(m.yellow_cards, players as any);
                    tokens.forEach(t => {
                        if (t.playerId) ycMap.set(t.playerId, (ycMap.get(t.playerId) || 0) + (t.count || 1));
                    });
                }
                if (rcMap.size === 0 && m.red_cards) {
                    const tokens = parseStatTextString(m.red_cards, players as any);
                    tokens.forEach(t => {
                        if (t.playerId) rcMap.set(t.playerId, (rcMap.get(t.playerId) || 0) + (t.count || 1));
                    });
                }

                ycMap.forEach((count, pid) => {
                    const cleanReason = `${yellowRule.emoji} ${yellowRule.title} (${matchLabel})`;
                    const key = `${pid}::${cleanReason.toLowerCase()}`;
                    if (!existingDescriptions.has(key)) {
                        existingDescriptions.add(key);
                        newFinePayloads.push({
                            club_id: clubId,
                            player_id: pid,
                            amount: Number(yellowRule.amount) * count,
                            description: encodePaymentDescription(cleanReason, {
                                dueDate: getDefaultDueDateStr(7),
                                feeCoverage,
                                payoutAccountLabel: formattedPayoutAccountLabel,
                            }),
                            status: "Unpaid",
                        });
                    }
                });

                rcMap.forEach((count, pid) => {
                    const cleanReason = `${redRule.emoji} ${redRule.title} (${matchLabel})`;
                    const key = `${pid}::${cleanReason.toLowerCase()}`;
                    if (!existingDescriptions.has(key)) {
                        existingDescriptions.add(key);
                        newFinePayloads.push({
                            club_id: clubId,
                            player_id: pid,
                            amount: Number(redRule.amount) * count,
                            description: encodePaymentDescription(cleanReason, {
                                dueDate: getDefaultDueDateStr(7),
                                feeCoverage,
                                payoutAccountLabel: formattedPayoutAccountLabel,
                            }),
                            status: "Unpaid",
                        });
                    }
                });
            }

            if (newFinePayloads.length === 0) {
                setCardFineBanner("All matchday Yellow & Red cards are already synced to Fines!");
                setTimeout(() => setCardFineBanner(null), 4000);
                return;
            }

            const { data, error } = await supabase
                .from("player_payment_requests")
                .insert(newFinePayloads)
                .select();
            if (error) throw error;
            if (data) {
                setPayments(prev => [...(data as PaymentRequest[]), ...prev]);
            }
            setCardFineBanner(`Synced ${newFinePayloads.length} new matchday card fine(s) from your fixtures!`);
            setTimeout(() => setCardFineBanner(null), 5000);
        } catch (err: any) {
            setCardFineBanner(`Error syncing matchday cards: ${err.message}`);
            setTimeout(() => setCardFineBanner(null), 4000);
        } finally {
            setSyncingCardFines(false);
        }
    };

    const handleSyncWithStripe = async () => {
        setSyncingStripe(true);
        try {
            if (clubId) {
                const res = await fetch("/api/checkout/verify-payment", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ clubId }),
                }).then(r => r.json()).catch(() => null);
                if (res?.onboardingComplete) setOnboardingComplete(true);
            }

            const unpaidWithSession = payments.filter(
                p => p.status === "Unpaid" && p.stripe_checkout_session_id
            );
            for (const p of unpaidWithSession) {
                await fetch("/api/checkout/verify-payment", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ paymentId: p.id }),
                }).catch(() => {});
            }
            await loadData();
        } finally {
            setSyncingStripe(false);
        }
    };

    const eligiblePlayers = useMemo(() => {
        return players.filter(p => !activeSquadOnly || !isFormerPlayer(p.notes));
    }, [players, activeSquadOnly]);

    const filteredPickerPlayers = useMemo(() => {
        if (!playerPickerSearch.trim()) return eligiblePlayers;
        const q = playerPickerSearch.toLowerCase();
        return eligiblePlayers.filter(
            p =>
                `${p.first_name} ${p.last_name}`.toLowerCase().includes(q) ||
                (p.position || "").toLowerCase().includes(q)
        );
    }, [eligiblePlayers, playerPickerSearch]);

    const handleSelectRule = (rule: StandardFineRule) => {
        setSelectedRuleId(rule.id);
        setBasePrice(String(rule.amount));
        setDescription(`${rule.emoji} ${rule.title}`);
    };

    const togglePlayerSelection = (playerId: string) => {
        setSelectedPlayerIds(prev =>
            prev.includes(playerId) ? prev.filter(id => id !== playerId) : [...prev, playerId]
        );
    };

    const handleSelectAllFilteredPlayers = () => {
        const ids = filteredPickerPlayers.map(p => p.id);
        const allSelected = ids.length > 0 && ids.every(id => selectedPlayerIds.includes(id));
        if (allSelected) {
            setSelectedPlayerIds(prev => prev.filter(id => !ids.includes(id)));
        } else {
            setSelectedPlayerIds(prev => Array.from(new Set([...prev, ...ids])));
        }
    };

    const handleConnectStripe = async (opts?: { resetAccount?: boolean; action?: "onboarding" | "dashboard" }) => {
        setOnboardingLoading(true);
        try {
            try {
                localStorage.setItem(accountStorageKey, JSON.stringify(payoutAccount));
            } catch {}

            const { data: { session } } = await supabase.auth.getSession();
            const headers: Record<string, string> = { "Content-Type": "application/json" };
            if (session?.access_token) {
                headers["Authorization"] = `Bearer ${session.access_token}`;
            }

            const res = await fetch("/api/checkout/connect-onboarding", {
                method: "POST",
                headers,
                body: JSON.stringify({
                    clubId,
                    accountHolderType: payoutAccount.accountHolderType,
                    treasurerFirstName: payoutAccount.treasurerFirstName,
                    treasurerLastName: payoutAccount.treasurerLastName,
                    treasurerEmail: payoutAccount.treasurerEmail,
                    resetAccount: opts?.resetAccount,
                    action: opts?.action || "onboarding",
                }),
            });
            const data = await res.json();
            if (data.url) {
                window.location.href = data.url;
            } else {
                alert(data.error || "Failed to start Stripe payout account onboarding.");
            }
        } catch (err) {
            console.error("Onboarding error:", err);
            alert("An error occurred starting Stripe onboarding.");
        } finally {
            setOnboardingLoading(false);
        }
    };

    const formattedPayoutAccountLabel = useMemo(() => {
        const baseName = payoutAccount.accountName || `${settings.name || "Club"} Bank Account`;
        const details: string[] = [];
        if (payoutAccount.sortCode) details.push(`SC: ${payoutAccount.sortCode}`);
        if (payoutAccount.accountNumber) details.push(`Acc: ${payoutAccount.accountNumber}`);
        if (details.length > 0) {
            return `${baseName} (${details.join(" • ")})`;
        }
        return baseName;
    }, [payoutAccount, settings.name]);

    const handleCreatePaymentRequests = async (e: React.FormEvent) => {
        e.preventDefault();
        if (selectedPlayerIds.length === 0) {
            alert("Please select at least one player.");
            return;
        }
        if (!basePrice || Number(basePrice) <= 0 || !description.trim()) {
            alert("Please enter a valid Base Price and fine reason.");
            return;
        }

        setCreating(true);
        try {
            const cleanReason = customContextNote.trim()
                ? `${description.trim()} (${customContextNote.trim()})`
                : description.trim();

            const encodedDescription = encodePaymentDescription(cleanReason, {
                dueDate: dueDate || undefined,
                feeCoverage,
                payoutAccountLabel: formattedPayoutAccountLabel,
            });

            const rowsToInsert = selectedPlayerIds.map(pid => ({
                club_id: clubId,
                player_id: pid,
                amount: parseFloat(basePrice),
                description: encodedDescription,
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
            console.error("Failed to create payment request:", err);
            alert("Error creating payment request: " + err.message);
        } finally {
            setCreating(false);
        }
    };

    const handleMarkAsPaidManual = async (payment: PaymentRequest) => {
        const paidAt = new Date().toISOString();
        setPayments(prev =>
            prev.map(p => (p.id === payment.id ? { ...p, status: "Paid", paid_at: paidAt } : p))
        );
        try {
            const { error } = await supabase
                .from("player_payment_requests")
                .update({ status: "Paid", paid_at: paidAt })
                .eq("id", payment.id);
            if (error) throw error;

            const meta = parsePaymentDescription(payment.description);
            await supabase.from("finance_transactions").insert([
                {
                    club_id: clubId,
                    date: paidAt.split("T")[0],
                    description: `${meta.cleanDescription} (Marked Paid)`,
                    amount: Number(payment.amount),
                    type: "Income",
                    category: "Player Fees",
                },
            ]);
        } catch (err) {
            console.error("Failed to mark payment request as paid:", err);
            loadData();
        }
    };

    const handleDeleteFine = async (id: string) => {
        if (!confirm("Cancel and delete this payment request?")) return;
        setPayments(prev => prev.filter(p => p.id !== id));
        try {
            const { error } = await supabase.from("player_payment_requests").delete().eq("id", id);
            if (error) throw error;
        } catch (err) {
            console.error("Failed to delete payment request:", err);
            loadData();
        }
    };

    const getPaymentLink = (paymentId: string) => {
        const origin = typeof window !== "undefined" ? window.location.origin : "https://clubflow.org.uk";
        return `${origin}/pay/${paymentId}`;
    };

    const getClubPlayerPortalLink = (playerId?: string) => {
        const origin = typeof window !== "undefined" ? window.location.origin : "https://clubflow.org.uk";
        return playerId
            ? `${origin}/pay/club/${clubId}?player=${playerId}`
            : `${origin}/pay/club/${clubId}`;
    };

    const handleCopyLink = (paymentId: string) => {
        const url = getPaymentLink(paymentId);
        navigator.clipboard.writeText(url);
        setCopiedId(paymentId);
        setTimeout(() => setCopiedId(null), 2000);
    };

    const handleCopyPlayerPortalLink = (playerId: string) => {
        navigator.clipboard.writeText(getClubPlayerPortalLink(playerId));
        setCopiedPlayerLinkId(playerId);
        setTimeout(() => setCopiedPlayerLinkId(null), 2000);
    };

    const handleCopyPortalLink = () => {
        navigator.clipboard.writeText(getClubPlayerPortalLink());
        setCopiedPortalLink(true);
        setTimeout(() => setCopiedPortalLink(false), 2000);
    };

    const handleCopyWhatsAppGroupSheet = () => {
        const unpaidList = payments.filter(p => p.status === "Unpaid");
        const portalUrl = getClubPlayerPortalLink();
        const byPlayer = new Map<string, { name: string; items: string[]; total: number }>();

        for (const p of unpaidList) {
            const pl = players.find(x => x.id === p.player_id);
            const name = pl ? `${pl.first_name} ${pl.last_name}` : "Squad Member";
            const meta = parsePaymentDescription(p.description);
            const entry = byPlayer.get(p.player_id) || { name, items: [], total: 0 };
            entry.items.push(`${meta.cleanDescription} (£${Number(p.amount).toFixed(2)})`);
            entry.total += Number(p.amount || 0);
            byPlayer.set(p.player_id, entry);
        }

        const lines = Array.from(byPlayer.values())
            .sort((a, b) => b.total - a.total)
            .map((row, idx) => `${idx + 1}. *${row.name}* — *£${row.total.toFixed(2)}*\n   └ ${row.items.join(", ")}`);

        const totalPot = unpaidList.reduce((s, p) => s + Number(p.amount || 0), 0);
        const message =
            lines.length > 0
                ? `⚽ *${settings.name || "Club"} — Outstanding Fines & Payments*\n\n${lines.join(
                      "\n"
                  )}\n\n💰 *Total Outstanding:* £${totalPot.toFixed(
                      2
                  )}\n\n👇 *Tap below to pick your name & pay in 1 tap (Apple Pay / Google Pay / Card):*\n🔗 ${portalUrl}`
                : `⚽ *${settings.name || "Club"} — ClubFlow Pay Link*\n\n👇 *Tap below to pay match subs, fines, or club fees (Apple Pay / Google Pay / Card):*\n🔗 ${portalUrl}`;

        navigator.clipboard.writeText(message);
        setCopiedGroupSheet(true);
        setTimeout(() => setCopiedGroupSheet(false), 2500);
    };

    const handleSendWhatsApp = (payment: PaymentRequest) => {
        const player = players.find(p => p.id === payment.player_id);
        const playerName = player ? `${player.first_name} ${player.last_name}` : "Player";
        const url = getPaymentLink(payment.id);
        const meta = parsePaymentDescription(payment.description);
        const breakdown = calculateClubFlowFee(Number(payment.amount), meta.feeCoverage);
        const dueStr = meta.dueDate
            ? `\n📅 *Due Date:* ${new Date(meta.dueDate).toLocaleDateString("en-GB")}`
            : "";

        const text = `⚽ *${settings.name || "Club"} — ClubFlow Pay Request*\n\nHi ${playerName}, a payment request has been issued:\n📌 *For:* ${meta.cleanDescription}\n💷 *Base Price:* £${breakdown.basePrice.toFixed(2)}${
            meta.feeCoverage === "player"
                ? ` (+£${breakdown.transactionFee.toFixed(2)} transaction fee)`
                : ""
        }${dueStr}\n🏦 *Payment Account:* ${meta.payoutAccountLabel || formattedPayoutAccountLabel}\n\nPay directly via Apple Pay, Google Pay, or Card here:\n🔗 ${url}`;
        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
    };

    const handleChasePlayerOnWhatsApp = (player: Player, unpaidAmount: number, unpaidCount: number) => {
        const playerUrl = getClubPlayerPortalLink(player.id);
        const text = `⚽ *${settings.name || "Club"} — Fines & Payments Reminder*\n\nHi ${player.first_name}, you currently have *${unpaidCount} unpaid fine${
            unpaidCount === 1 ? "" : "s"
        }* totalling *£${unpaidAmount.toFixed(
            2
        )}*.\n\nPay all in 1 tap via Apple Pay, Google Pay, or Card here:\n🔗 ${playerUrl}`;
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
        if (!confirm("Reset the Club Standard Fine List back to the default 10 football fines?")) return;
        saveFineRules(DEFAULT_STANDARD_FINES);
    };

    // Summary KPIs
    const kpis = useMemo(() => {
        const unpaidList = payments.filter(p => p.status === "Unpaid");
        const paidList = payments.filter(p => p.status === "Paid");
        const todayStr = new Date().toISOString().split("T")[0];

        const unpaidClubTotal = unpaidList.reduce((sum, p) => {
            const meta = parsePaymentDescription(p.description);
            return sum + calculateClubFlowFee(Number(p.amount || 0), meta.feeCoverage).clubNetReceived;
        }, 0);

        const paidClubTotal = paidList.reduce((sum, p) => {
            const meta = parsePaymentDescription(p.description);
            return sum + calculateClubFlowFee(Number(p.amount || 0), meta.feeCoverage).clubNetReceived;
        }, 0);

        const overdueList = unpaidList.filter(p => {
            const meta = parsePaymentDescription(p.description);
            return meta.dueDate && meta.dueDate < todayStr;
        });

        const overdueTotal = overdueList.reduce((sum, p) => sum + Number(p.amount || 0), 0);
        const totalCount = unpaidList.length + paidList.length;
        const collectionRate = totalCount > 0 ? Math.round((paidList.length / totalCount) * 100) : 100;

        return {
            unpaidCount: unpaidList.length,
            paidCount: paidList.length,
            unpaidClubTotal,
            paidClubTotal,
            overdueCount: overdueList.length,
            overdueTotal,
            collectionRate,
        };
    }, [payments]);

    // Player Fines Leaderboard
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
                if (b.unpaidAmount !== a.unpaidAmount) return b.unpaidAmount - a.unpaidAmount;
                return b.totalAmount - a.totalAmount;
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

    const currentPreviewBreakdown = calculateClubFlowFee(Number(basePrice || 0), feeCoverage);

    if (loading) {
        return <div className="p-8 text-center text-muted-foreground">Loading ClubFlow Pay...</div>;
    }

    return (
        <div className="space-y-6 max-w-6xl mx-auto">
            {/* Stripe Connect Onboarding Return Banner */}
            {connectBanner === "success" && (
                <div className="rounded-xl bg-emerald-500/15 border border-emerald-500/40 p-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                        <div>
                            <h4 className="text-sm font-bold text-foreground">
                                Stripe Payout Account Connected!
                            </h4>
                            <p className="text-xs text-muted-foreground">
                                Your club bank account is linked. Player payments via Apple Pay, Google Pay, and Card will deposit directly into your bank account.
                            </p>
                        </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setConnectBanner(null)} className="text-xs">
                        Dismiss
                    </Button>
                </div>
            )}

            {/* Page Header */}
            {cardFineBanner && (
                <div className="rounded-xl bg-amber-500/15 border border-amber-500/40 px-4 py-3 text-xs font-bold text-amber-600 dark:text-amber-300 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 shrink-0" />
                        <span>{cardFineBanner}</span>
                    </div>
                    <button type="button" onClick={() => setCardFineBanner(null)} className="text-muted-foreground hover:text-foreground">
                        ✕
                    </button>
                </div>
            )}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2.5 flex-wrap">
                        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                            ClubFlow Pay — Fines &amp; Player Payments
                        </h1>
                        <Badge className="bg-brand/15 text-brand border border-brand/30 text-[11px] font-bold">
                            Direct to Club Bank Account
                        </Badge>
                    </div>
                    <p className="text-muted-foreground text-sm mt-1">
                        Issue fines in seconds, share your 1-tap Player Payment Link in WhatsApp, and receive funds directly into your club bank account.
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleSyncMatchdayCardFines}
                        disabled={syncingCardFines}
                        className="text-xs font-bold gap-1.5 bg-amber-500/10 border-amber-500/40 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20"
                        title="Automatically scan match results for Yellow & Red cards and create unpaid fines using your Fine Tariff"
                    >
                        <Sparkles className={`h-3.5 w-3.5 ${syncingCardFines ? "animate-spin" : ""}`} />
                        {syncingCardFines ? "Scanning Cards..." : "Sync Matchday Card Fines"}
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCopyWhatsAppGroupSheet}
                        className="text-xs font-bold gap-1.5 bg-emerald-500/10 border-emerald-500/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20"
                        title="Copy a ready-to-paste WhatsApp group message listing all unpaid fines + the 1-tap payment link"
                    >
                        <Share2 className="h-3.5 w-3.5" />
                        {copiedGroupSheet ? "✓ WhatsApp Fines Sheet Copied!" : "Copy WhatsApp Fines Sheet"}
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCopyPortalLink}
                        className="text-xs font-semibold gap-1.5 border-brand/40 text-brand hover:bg-brand/10"
                        title="Share this portal link with your squad so players can pick their name once and pay fines or match subs in 1 tap"
                    >
                        <Smartphone className="h-3.5 w-3.5" />
                        {copiedPortalLink ? "✓ Player Pay Link Copied" : "Copy Player Pay Link"}
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleSyncWithStripe}
                        disabled={syncingStripe}
                        className="gap-1.5 text-xs font-semibold"
                    >
                        <RefreshCw className={`h-3.5 w-3.5 ${syncingStripe ? "animate-spin" : ""}`} />
                        {syncingStripe ? "Syncing..." : "Sync Stripe"}
                    </Button>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="border-border bg-card shadow-xs">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                Collected for Club
                            </p>
                            <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                                £{kpis.paidClubTotal.toFixed(2)}
                            </p>
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                                {kpis.paidCount} settled payment{kpis.paidCount === 1 ? "" : "s"}
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
                                Awaiting Payment
                            </p>
                            <p className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">
                                £{kpis.unpaidClubTotal.toFixed(2)}
                            </p>
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                                {kpis.unpaidCount} open request{kpis.unpaidCount === 1 ? "" : "s"}
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
                                Overdue &amp; Collection Rate
                            </p>
                            <p className="text-2xl font-black text-foreground mt-1">
                                {kpis.collectionRate}%{" "}
                                <span className="text-xs font-semibold text-muted-foreground">settled</span>
                            </p>
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                                {kpis.overdueCount > 0
                                    ? `${kpis.overdueCount} overdue (£${kpis.overdueTotal.toFixed(2)})`
                                    : "0 overdue fines"}
                            </p>
                        </div>
                        <div className="h-11 w-11 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                            <Clock className="h-5 w-5" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-border bg-card shadow-xs">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                Club Bank Account
                            </p>
                            <p className="text-sm font-bold text-foreground mt-1 truncate max-w-[165px]">
                                {formattedPayoutAccountLabel}
                            </p>
                            <button
                                type="button"
                                onClick={() => setIsEditingAccountModal(true)}
                                className="text-[11px] text-brand font-semibold hover:underline mt-0.5"
                            >
                                {onboardingComplete ? "✓ Stripe Connected →" : "Setup Direct Payouts →"}
                            </button>
                        </div>
                        <div className="h-11 w-11 rounded-xl bg-brand/15 border border-brand/30 flex items-center justify-center text-brand">
                            <Building2 className="h-5 w-5" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Club Payout Account & Stripe Connect Banner */}
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
                                    Payment Account: {formattedPayoutAccountLabel}
                                </h3>
                                {onboardingComplete ? (
                                    <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-[10px]">
                                        ✓ Stripe Payouts Connected
                                    </Badge>
                                ) : (
                                    <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30 text-[10px]">
                                        1-Time Bank Link Needed for Direct Payouts
                                    </Badge>
                                )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                {onboardingComplete
                                    ? "Players pay in 1 tap via Apple Pay, Google Pay, or Card. Funds are deposited automatically into your UK club bank account."
                                    : "Link your club Sort Code & Account Number once via Stripe Express (pre-filled for grassroots clubs) so player payments go straight to your bank."}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setIsEditingAccountModal(true)}
                            className="text-xs font-semibold"
                        >
                            Bank &amp; Stripe Setup
                        </Button>
                        {isManager && (
                            <Button
                                size="sm"
                                onClick={() => handleConnectStripe({ action: onboardingComplete ? "dashboard" : "onboarding" })}
                                disabled={onboardingLoading}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold"
                            >
                                <CreditCard className="h-3.5 w-3.5 mr-1.5" />
                                {onboardingLoading
                                    ? "Opening Stripe..."
                                    : onboardingComplete
                                    ? "Open Stripe Payouts"
                                    : "Link Club Bank Account"}
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Sub-Navigation Pills */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
                <div className="flex flex-wrap items-center gap-2">
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
                        Issue Fines &amp; Payment Tracker ({payments.length})
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
                        Player Fines Leaderboard ({playerLeaderboard.length})
                    </button>
                </div>

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
            </div>

            {/* VIEW 1: CREATE PAYMENT REQUEST & STRIPE TRACKER */}
            {activeView === "issue" && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* Left Column: Create ClubFlow Payment Request */}
                    <Card className="lg:col-span-5 border-border h-fit">
                        <CardHeader className="pb-3 border-b border-border bg-surface-1/50">
                            <CardTitle className="text-base font-bold flex items-center gap-2">
                                <Plus className="h-4 w-4 text-brand" /> Issue Fine / Payment Request
                            </CardTitle>
                            <CardDescription className="text-xs">
                                Pick a standard club fine or custom fee, select one or more players, and issue instantly.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="pt-4">
                            <form onSubmit={handleCreatePaymentRequests} className="space-y-4">
                                {/* Step 1: Standard Fine Quick-Pick */}
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                            1. Select Fine from Club Standard List
                                        </Label>
                                        <button
                                            type="button"
                                            onClick={() => setActiveView("tariff")}
                                            className="text-[11px] font-semibold text-brand hover:underline"
                                        >
                                            Edit Standard List
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-48 overflow-y-auto pr-1">
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

                                {/* Step 2: Select Player(s) with Search & Select All */}
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between gap-2">
                                        <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                            2. Select Player(s) ({selectedPlayerIds.length} selected)
                                        </Label>
                                        <div className="flex items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={handleSelectAllFilteredPlayers}
                                                className="text-[11px] font-semibold text-brand hover:underline"
                                            >
                                                {filteredPickerPlayers.length > 0 &&
                                                filteredPickerPlayers.every(p => selectedPlayerIds.includes(p.id))
                                                    ? "Unselect All"
                                                    : "Select All Squad"}
                                            </button>
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
                                    </div>

                                    <div className="relative">
                                        <Search className="h-3.5 w-3.5 text-muted-foreground absolute left-2.5 top-2.5" />
                                        <Input
                                            type="text"
                                            placeholder="Filter players by name or position..."
                                            value={playerPickerSearch}
                                            onChange={e => setPlayerPickerSearch(e.target.value)}
                                            className="h-8 pl-8 text-xs"
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-44 overflow-y-auto p-2 rounded-xl border border-border bg-surface-1/40">
                                        {filteredPickerPlayers.map(p => {
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

                                {/* Step 3: What the fine is for, Base Price, and Due Date */}
                                <div className="space-y-3 pt-1">
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-semibold">What the fine / request is for</Label>
                                        <Input
                                            type="text"
                                            value={description}
                                            onChange={e => setDescription(e.target.value)}
                                            placeholder="e.g. 🟨 Yellow Card (Dissent)"
                                            className="h-9 text-xs"
                                            required
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1.5">
                                            <Label className="text-xs font-semibold">Base Price (£)</Label>
                                            <Input
                                                type="number"
                                                step="0.50"
                                                min="0.50"
                                                value={basePrice}
                                                onChange={e => setBasePrice(e.target.value)}
                                                className="h-9 text-xs font-bold"
                                                required
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-xs font-semibold flex items-center gap-1">
                                                <Calendar className="h-3 w-3 text-muted-foreground" /> Due Date
                                            </Label>
                                            <Input
                                                type="date"
                                                value={dueDate}
                                                onChange={e => setDueDate(e.target.value)}
                                                className="h-9 text-xs"
                                                required
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-semibold">Match / Context Note (Optional)</Label>
                                        <Input
                                            type="text"
                                            placeholder="e.g. Saturday League Match (20 mins late)"
                                            value={customContextNote}
                                            onChange={e => setCustomContextNote(e.target.value)}
                                            className="h-9 text-xs"
                                        />
                                    </div>

                                    {/* Payment Account & Transaction Fee Coverage Setting */}
                                    <div className="space-y-2 pt-1">
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="font-semibold text-muted-foreground">Payment Account:</span>
                                            <button
                                                type="button"
                                                onClick={() => setIsEditingAccountModal(true)}
                                                className="font-bold text-foreground hover:text-brand underline"
                                            >
                                                {formattedPayoutAccountLabel}
                                            </button>
                                        </div>

                                        <div className="space-y-1.5">
                                            <Label className="text-xs font-semibold">Transaction Fee Setting</Label>
                                            <div className="grid grid-cols-2 gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => setFeeCoverage("player")}
                                                    className={`p-2 rounded-lg border text-xs font-semibold text-left transition-all ${
                                                        feeCoverage === "player"
                                                            ? "bg-brand/15 border-brand text-foreground"
                                                            : "bg-surface-1 border-border text-muted-foreground"
                                                    }`}
                                                >
                                                    <span className="block font-bold">Player Covers Fee (Recommended)</span>
                                                    <span className="text-[10px] text-muted-foreground">
                                                        Club receives 100% of £{currentPreviewBreakdown.basePrice.toFixed(2)}
                                                    </span>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setFeeCoverage("club")}
                                                    className={`p-2 rounded-lg border text-xs font-semibold text-left transition-all ${
                                                        feeCoverage === "club"
                                                            ? "bg-brand/15 border-brand text-foreground"
                                                            : "bg-surface-1 border-border text-muted-foreground"
                                                    }`}
                                                >
                                                    <span className="block font-bold">Club Absorbs Fee</span>
                                                    <span className="text-[10px] text-muted-foreground">
                                                        Club receives £{currentPreviewBreakdown.clubNetReceived.toFixed(2)}
                                                    </span>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Transparent ClubFlow Pay Breakdown */}
                                <div className="rounded-xl border border-border bg-surface-1/80 p-3 space-y-1.5 text-xs">
                                    <div className="flex items-center justify-between text-muted-foreground">
                                        <span>Base Price (Fine Amount):</span>
                                        <span className="font-bold text-foreground">
                                            £{currentPreviewBreakdown.basePrice.toFixed(2)}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between text-muted-foreground">
                                        <span>
                                            Processing Fee (
                                            {feeCoverage === "player" ? "Covered by Player" : "Deducted from Base"}):
                                        </span>
                                        <span className="font-medium text-indigo-600 dark:text-indigo-400">
                                            £{currentPreviewBreakdown.transactionFee.toFixed(2)}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between text-muted-foreground">
                                        <span>Net Payout to {formattedPayoutAccountLabel}:</span>
                                        <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                            £{currentPreviewBreakdown.clubNetReceived.toFixed(2)}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between border-t border-border pt-1.5 font-bold">
                                        <span className="text-foreground">Player Total Payable via Stripe:</span>
                                        <span className="text-emerald-600 dark:text-emerald-400 text-sm">
                                            £{currentPreviewBreakdown.playerTotalPayable.toFixed(2)}
                                        </span>
                                    </div>
                                </div>

                                <Button
                                    type="submit"
                                    disabled={creating || selectedPlayerIds.length === 0}
                                    className="w-full bg-brand hover:bg-brand/90 text-white font-bold h-10"
                                >
                                    {creating
                                        ? "Creating Request..."
                                        : selectedPlayerIds.length > 1
                                        ? `Issue to ${selectedPlayerIds.length} Players (£${(Number(basePrice || 0) * selectedPlayerIds.length).toFixed(2)} Total)`
                                        : "Create Payment Request"}
                                </Button>
                            </form>
                        </CardContent>
                    </Card>

                    {/* Right Column: Stripe Payment Request Tracker */}
                    <Card className="lg:col-span-7 border-border">
                        <CardHeader className="pb-3 border-b border-border bg-surface-1/50">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div>
                                    <CardTitle className="text-base font-bold">
                                        Fines &amp; Payment Request Tracker
                                    </CardTitle>
                                    <CardDescription className="text-xs">
                                        Send individual links, share the WhatsApp Fines Sheet, or mark cash payments as Paid.
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
                                            {st === "ALL"
                                                ? `All (${payments.length})`
                                                : st === "Unpaid"
                                                ? `Unpaid (${kpis.unpaidCount})`
                                                : `Paid (${kpis.paidCount})`}
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
                                    <p className="text-sm font-semibold text-foreground">No payment requests found</p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Use the form on the left to issue a fine or payment request.
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-2.5 max-h-[640px] overflow-y-auto pr-1">
                                    {filteredPayments.map(pay => {
                                        const player = players.find(p => p.id === pay.player_id);
                                        const isPaid = pay.status === "Paid";
                                        const meta = parsePaymentDescription(pay.description);
                                        const breakdown = calculateClubFlowFee(Number(pay.amount), meta.feeCoverage);
                                        const isOverdue =
                                            !isPaid &&
                                            meta.dueDate &&
                                            new Date(meta.dueDate) < new Date(new Date().toISOString().split("T")[0]);

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
                                                                    : isOverdue
                                                                    ? "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/35 text-[10px] font-bold"
                                                                    : "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/35 text-[10px] font-bold"
                                                            }
                                                        >
                                                            {isPaid
                                                                ? "✓ Paid"
                                                                : isOverdue
                                                                ? "Overdue • Unpaid"
                                                                : "Awaiting Payment"}
                                                        </Badge>
                                                    </div>
                                                    <p className="text-xs font-semibold text-foreground/90">
                                                        {meta.cleanDescription}
                                                    </p>
                                                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                                                        <span>
                                                            Base Price: <strong className="text-foreground">£{breakdown.basePrice.toFixed(2)}</strong>
                                                        </span>
                                                        <span>•</span>
                                                        <span>
                                                            Player Pays:{" "}
                                                            <strong className="text-foreground">
                                                                £{breakdown.playerTotalPayable.toFixed(2)}
                                                            </strong>
                                                        </span>
                                                        {meta.dueDate && (
                                                            <>
                                                                <span>•</span>
                                                                <span className={isOverdue ? "text-rose-500 font-bold" : "text-amber-600 dark:text-amber-400 font-medium"}>
                                                                    Due {new Date(meta.dueDate).toLocaleDateString("en-GB")}
                                                                </span>
                                                            </>
                                                        )}
                                                    </div>
                                                    <p className="text-[10px] text-muted-foreground">
                                                        Account: {meta.payoutAccountLabel || formattedPayoutAccountLabel}
                                                        {pay.paid_at
                                                            ? ` • Settled ${new Date(pay.paid_at).toLocaleDateString("en-GB")}`
                                                            : ""}
                                                    </p>
                                                </div>

                                                <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0 flex-wrap justify-end">
                                                    <div className="text-right mr-1.5">
                                                        <span className="text-base font-black text-foreground block">
                                                            £{breakdown.clubNetReceived.toFixed(2)}
                                                        </span>
                                                        <span className="text-[10px] text-muted-foreground block">
                                                            Club Payout
                                                        </span>
                                                    </div>

                                                    {!isPaid && (
                                                        <>
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                className="h-8 px-2.5 text-xs gap-1"
                                                                onClick={() => handleCopyLink(pay.id)}
                                                                title="Copy direct Stripe payment link for this fine"
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
                                                                title="Send WhatsApp payment link to player"
                                                            >
                                                                <Send className="h-3 w-3" /> WhatsApp
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                className="h-8 px-2.5 text-xs gap-1 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 font-semibold"
                                                                onClick={() => handleMarkAsPaidManual(pay)}
                                                                title="Mark as Paid (Cash or Manual Bank Transfer)"
                                                            >
                                                                <CheckCircle2 className="h-3.5 w-3.5" /> Mark Paid
                                                            </Button>
                                                        </>
                                                    )}

                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() => handleDeleteFine(pay.id)}
                                                        className="h-8 w-8 p-0 text-muted-foreground hover:text-rose-500"
                                                        title="Cancel & delete payment request"
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
                            <CardTitle className="text-lg font-bold">Club Standard Fine List</CardTitle>
                            <CardDescription className="text-xs">
                                Configure your club&apos;s standard base prices for yellow cards, lateness, kit offences, and matchday rules. Saved automatically across all your devices.
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
                                const breakdown = calculateClubFlowFee(rule.amount, feeCoverage);
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
                                                    Base Price (+£{breakdown.transactionFee.toFixed(2)} fee)
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
                                                Request This Fine →
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
                    <CardHeader className="border-b border-border bg-surface-1/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                            <CardTitle className="text-lg font-bold flex items-center gap-2">
                                <Trophy className="h-5 w-5 text-amber-500" /> Player Fines Leaderboard
                            </CardTitle>
                            <CardDescription className="text-xs">
                                Copy any player&apos;s personal 1-tap payment link or chase their outstanding balance on WhatsApp.
                            </CardDescription>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleCopyWhatsAppGroupSheet}
                            className="text-xs font-bold gap-1.5"
                        >
                            <Share2 className="h-3.5 w-3.5" />
                            {copiedGroupSheet ? "✓ Copied Group Summary" : "Copy Group WhatsApp Summary"}
                        </Button>
                    </CardHeader>
                    <CardContent className="p-0">
                        {playerLeaderboard.length === 0 ? (
                            <div className="p-12 text-center text-muted-foreground text-sm">
                                No payment requests have been issued yet this season.
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-surface-1 text-muted-foreground uppercase text-xs font-bold border-b border-border">
                                        <tr>
                                            <th className="px-4 py-3.5">#</th>
                                            <th className="px-4 py-3.5">Player</th>
                                            <th className="px-3 py-3.5 text-center">Issued</th>
                                            <th className="px-3 py-3.5 text-center">Paid</th>
                                            <th className="px-3 py-3.5 text-center">Outstanding</th>
                                            <th className="px-4 py-3.5 text-right">Quick Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border">
                                        {playerLeaderboard.map((row, idx) => (
                                            <tr key={row.player.id} className="hover:bg-surface-1/50 transition-colors">
                                                <td className="px-4 py-3.5 font-black text-muted-foreground">
                                                    {idx + 1}
                                                </td>
                                                <td className="px-4 py-3.5 font-bold text-foreground">
                                                    {row.player.first_name} {row.player.last_name}
                                                    {row.player.position && (
                                                        <span className="ml-2 text-[11px] font-semibold text-muted-foreground">
                                                            ({row.player.position})
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-3 py-3.5 text-center font-semibold">
                                                    {row.totalFinesCount} (£{row.totalAmount.toFixed(2)})
                                                </td>
                                                <td className="px-3 py-3.5 text-center font-bold text-emerald-600 dark:text-emerald-400">
                                                    £{row.paidAmount.toFixed(2)}
                                                </td>
                                                <td className="px-3 py-3.5 text-center">
                                                    {row.unpaidAmount > 0 ? (
                                                        <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/35 font-bold">
                                                            £{row.unpaidAmount.toFixed(2)} ({row.unpaidCount} due)
                                                        </Badge>
                                                    ) : (
                                                        <span className="text-xs text-muted-foreground">All settled ✓</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3.5 text-right">
                                                    <div className="inline-flex items-center gap-1.5">
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="h-7 px-2.5 text-xs gap-1"
                                                            onClick={() => handleCopyPlayerPortalLink(row.player.id)}
                                                            title="Copy personal payment link pre-selected to this player"
                                                        >
                                                            {copiedPlayerLinkId === row.player.id ? (
                                                                <Check className="h-3 w-3 text-emerald-500" />
                                                            ) : (
                                                                <Copy className="h-3 w-3" />
                                                            )}
                                                            {copiedPlayerLinkId === row.player.id ? "Copied" : "Player Link"}
                                                        </Button>
                                                        {row.unpaidAmount > 0 && (
                                                            <Button
                                                                size="sm"
                                                                className="h-7 px-2.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1 font-semibold"
                                                                onClick={() =>
                                                                    handleChasePlayerOnWhatsApp(
                                                                        row.player,
                                                                        row.unpaidAmount,
                                                                        row.unpaidCount
                                                                    )
                                                                }
                                                            >
                                                                <Send className="h-3 w-3" /> Chase
                                                            </Button>
                                                        )}
                                                    </div>
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

            {/* Club Payment Account & Stripe Configuration Modal */}
            <Dialog open={isEditingAccountModal} onOpenChange={setIsEditingAccountModal}>
                <DialogContent className="sm:max-w-[540px] max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Building2 className="h-5 w-5 text-brand" /> Club Payment Account &amp; Guided Stripe Setup
                        </DialogTitle>
                        <DialogDescription className="text-xs">
                            ClubFlow pre-fills your club&apos;s Sports Club industry code, website, and description for Stripe Express so you can link your UK bank account in under 2 minutes.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                        {/* Account Holder Type Selector */}
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold">1. Club Structure / Account Holder Type</Label>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                <button
                                    type="button"
                                    onClick={() =>
                                        setPayoutAccount({ ...payoutAccount, accountHolderType: "individual" })
                                    }
                                    className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                                        payoutAccount.accountHolderType === "individual"
                                            ? "bg-brand/15 border-brand text-foreground"
                                            : "bg-surface-1 border-border text-muted-foreground hover:text-foreground"
                                    }`}
                                >
                                    <span className="block text-xs font-bold">Unincorporated / Treasurer</span>
                                    <span className="block text-[10px] text-muted-foreground mt-0.5">
                                        Best for grassroots clubs (No Companies House # needed)
                                    </span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() =>
                                        setPayoutAccount({ ...payoutAccount, accountHolderType: "non_profit" })
                                    }
                                    className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                                        payoutAccount.accountHolderType === "non_profit"
                                            ? "bg-brand/15 border-brand text-foreground"
                                            : "bg-surface-1 border-border text-muted-foreground hover:text-foreground"
                                    }`}
                                >
                                    <span className="block text-xs font-bold">Non-Profit / Charity</span>
                                    <span className="block text-[10px] text-muted-foreground mt-0.5">
                                        Registered CASC or charity club
                                    </span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() =>
                                        setPayoutAccount({ ...payoutAccount, accountHolderType: "company" })
                                    }
                                    className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                                        payoutAccount.accountHolderType === "company"
                                            ? "bg-brand/15 border-brand text-foreground"
                                            : "bg-surface-1 border-border text-muted-foreground hover:text-foreground"
                                    }`}
                                >
                                    <span className="block text-xs font-bold">Registered Ltd Company</span>
                                    <span className="block text-[10px] text-muted-foreground mt-0.5">
                                        Incorporated football club (Ltd)
                                    </span>
                                </button>
                            </div>
                        </div>

                        {/* Treasurer / Representative Pre-Fill (for Express) */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                            <div className="space-y-1">
                                <Label className="text-[11px] font-semibold">Treasurer First Name</Label>
                                <Input
                                    placeholder="e.g. Leon"
                                    value={payoutAccount.treasurerFirstName}
                                    onChange={e =>
                                        setPayoutAccount({ ...payoutAccount, treasurerFirstName: e.target.value })
                                    }
                                    className="h-8 text-xs"
                                />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-[11px] font-semibold">Treasurer Last Name</Label>
                                <Input
                                    placeholder="e.g. Smith"
                                    value={payoutAccount.treasurerLastName}
                                    onChange={e =>
                                        setPayoutAccount({ ...payoutAccount, treasurerLastName: e.target.value })
                                    }
                                    className="h-8 text-xs"
                                />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-[11px] font-semibold">Treasurer Email</Label>
                                <Input
                                    type="email"
                                    placeholder="club@email.com"
                                    value={payoutAccount.treasurerEmail}
                                    onChange={e =>
                                        setPayoutAccount({ ...payoutAccount, treasurerEmail: e.target.value })
                                    }
                                    className="h-8 text-xs"
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold">2. Payment Account Name (Shown on Player Requests)</Label>
                            <Input
                                placeholder="e.g. ClubFlow United Club Account"
                                value={payoutAccount.accountName}
                                onChange={e =>
                                    setPayoutAccount({ ...payoutAccount, accountName: e.target.value })
                                }
                                className="h-9 text-xs"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label className="text-xs font-semibold">Sort Code</Label>
                                <Input
                                    placeholder="e.g. 60-83-71"
                                    maxLength={8}
                                    value={payoutAccount.sortCode}
                                    onChange={e =>
                                        setPayoutAccount({ ...payoutAccount, sortCode: e.target.value })
                                    }
                                    className="h-9 text-xs font-mono"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs font-semibold">Club Account Number</Label>
                                <Input
                                    placeholder="e.g. 12345678"
                                    maxLength={12}
                                    value={payoutAccount.accountNumber}
                                    onChange={e =>
                                        setPayoutAccount({
                                            ...payoutAccount,
                                            accountNumber: e.target.value.replace(/\D/g, ""),
                                        })
                                    }
                                    className="h-9 text-xs font-mono"
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold">3. Default Transaction Fee Setting</Label>
                            <select
                                value={payoutAccount.defaultFeeCoverage}
                                onChange={e =>
                                    setPayoutAccount({
                                        ...payoutAccount,
                                        defaultFeeCoverage: e.target.value as "player" | "club",
                                    })
                                }
                                className="flex h-9 w-full rounded-md border border-border bg-background px-3 text-xs text-foreground"
                            >
                                <option value="player">
                                    Player Covers Transaction Fee (Club receives 100% of Base Price)
                                </option>
                                <option value="club">
                                    Club Absorbs Transaction Fee (Deducted from Base Price)
                                </option>
                            </select>
                        </div>

                        {/* Pre-Filled Express Setup Summary */}
                        <div className="p-3.5 rounded-xl bg-surface-1 border border-border space-y-2.5">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-foreground">
                                    Stripe Express Direct Payout Connection
                                </span>
                                {onboardingComplete ? (
                                    <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-[10px]">
                                        ✓ Connected
                                    </Badge>
                                ) : (
                                    <Badge className="bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30 text-[10px]">
                                        Pre-Filled by ClubFlow
                                    </Badge>
                                )}
                            </div>

                            <div className="text-[11px] text-muted-foreground space-y-1 bg-background/60 p-2.5 rounded-lg border border-border/60">
                                <p className="font-semibold text-foreground text-xs mb-1">
                                    What ClubFlow automatically fills in for you on Stripe:
                                </p>
                                <p>✓ <strong>Industry Code:</strong> Sports Clubs / Amateur Athletics (MCC 7941)</p>
                                <p>✓ <strong>Club Website:</strong> Your ClubFlow Pay Portal URL (no external site needed)</p>
                                <p>✓ <strong>Statement Descriptor:</strong> {(settings.name || "CLUBFLOW").toUpperCase().slice(0, 22)}</p>
                                <p>✓ <strong>Daily Auto-Payouts:</strong> Enabled to your UK Sort Code &amp; Account Number</p>
                            </div>

                            {(payoutAccount.sortCode || payoutAccount.accountNumber) && (
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        navigator.clipboard.writeText(
                                            `Sort Code: ${payoutAccount.sortCode} | Account Number: ${payoutAccount.accountNumber}`
                                        );
                                        setCopiedBankDetails(true);
                                        setTimeout(() => setCopiedBankDetails(false), 2000);
                                    }}
                                    className="w-full h-8 text-xs font-semibold"
                                >
                                    {copiedBankDetails ? (
                                        <>
                                            <Check className="h-3.5 w-3.5 mr-1.5 text-emerald-500" />
                                            Copied Sort Code &amp; Account Number!
                                        </>
                                    ) : (
                                        <>
                                            <Copy className="h-3.5 w-3.5 mr-1.5" />
                                            Copy Sort Code ({payoutAccount.sortCode}) &amp; Acc ({payoutAccount.accountNumber}) for Stripe
                                        </>
                                    )}
                                </Button>
                            )}

                            <div className="flex flex-col sm:flex-row gap-2">
                                <Button
                                    type="button"
                                    size="sm"
                                    onClick={() => handleConnectStripe({ action: "onboarding" })}
                                    disabled={onboardingLoading}
                                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold"
                                >
                                    <CreditCard className="h-3.5 w-3.5 mr-1.5" />
                                    {onboardingLoading
                                        ? "Launching Pre-Filled Stripe Express..."
                                        : onboardingComplete
                                        ? "Update Bank Account in Stripe Express"
                                        : "Launch Guided Stripe Express Setup"}
                                </Button>

                                {connectAccount && !onboardingComplete && (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleConnectStripe({ resetAccount: true, action: "onboarding" })}
                                        disabled={onboardingLoading}
                                        className="text-xs font-semibold"
                                        title="Start a fresh Stripe Express account with the pre-filled settings above"
                                    >
                                        Start Fresh Express Account
                                    </Button>
                                )}
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" size="sm" onClick={() => setIsEditingAccountModal(false)}>
                            Cancel
                        </Button>
                        <Button
                            size="sm"
                            onClick={() => savePayoutAccountConfig(payoutAccount)}
                            className="bg-brand hover:bg-brand/90 text-white font-semibold"
                        >
                            Save Account Settings
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Add / Edit Standard Fine Rule Modal */}
            <Dialog open={isAddRuleOpen} onOpenChange={setIsAddRuleOpen}>
                <DialogContent className="sm:max-w-[440px]">
                    <DialogHeader>
                        <DialogTitle>{editingRule ? "Edit Standard Fine" : "Add Standard Fine to Club List"}</DialogTitle>
                        <DialogDescription className="text-xs">
                            Set the offence title, category, and standard Base Price.
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
                                <Label className="text-xs font-semibold">What the fine is for</Label>
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
                                <Label className="text-xs font-semibold">Base Price (£)</Label>
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
                            Save Standard Fine
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
