"use client";

import React, { useEffect, useState, useMemo, useRef } from "react";
import { useAuth } from "@/context/auth-context";
import { useClub } from "@/context/club-context";
import { supabase, fetchScopedMatchPlayerStats } from "@/lib/supabase";
import { extractLineupFromRawNotes, parseStatTextString } from "@/lib/match-stats-sync";
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
    ShieldCheck,
    AlertCircle,
    RefreshCw,
    Landmark,
    Coins,
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
    Bell,
    ChevronDown,
    ChevronUp,
    Mail,
    Users,
    UserPlus,
    Loader2,
    X,
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
    email?: string | null;
    status?: string | null;
}

export interface StandardFineRule {
    id: string;
    title: string;
    category: "Subs & Fees" | "Discipline" | "Punctuality" | "Kit & Gear" | "Matchday" | "Custom";
    amount: number;
    emoji: string;
}

interface NamedClubAccount {
    id: string;
    label: string;
    sortCode?: string;
    accountNumber?: string;
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
    namedAccounts?: NamedClubAccount[];
    paymentsSkippedInOnboarding?: boolean;
}

interface EventQuickSelectOption {
    id: string;
    label: string;
    playerIds: string[];
    suggestedTitle: string;
}

const DEFAULT_STANDARD_FINES: StandardFineRule[] = [
    { id: "sub-match", title: "Saturday Match Sub", category: "Subs & Fees", amount: 5, emoji: "⚽" },
    { id: "sub-monthly", title: "Monthly Club Subs", category: "Subs & Fees", amount: 25, emoji: "📅" },
    { id: "sub-training", title: "Training Session Sub", category: "Subs & Fees", amount: 4, emoji: "🏃" },
    { id: "sub-signing", title: "Season Signing-On Fee", category: "Subs & Fees", amount: 30, emoji: "✍️" },
    { id: "sub-social", title: "Club Social / Training Kit", category: "Subs & Fees", amount: 15, emoji: "👕" },
    { id: "fine-yellow-dissent", title: "Yellow Card (Dissent / Sin Bin)", category: "Discipline", amount: 10, emoji: "🟨" },
    { id: "fine-yellow-foul", title: "Yellow Card (Foul)", category: "Discipline", amount: 5, emoji: "🟨" },
    { id: "fine-red-card", title: "Red Card", category: "Discipline", amount: 20, emoji: "🟥" },
    { id: "fine-late-matchday", title: "Late on Matchday", category: "Punctuality", amount: 10, emoji: "⏰" },
    { id: "fine-late-training", title: "Late to Training", category: "Punctuality", amount: 5, emoji: "🕒" },
    { id: "fine-no-show", title: "No Show Without Notice", category: "Punctuality", amount: 15, emoji: "👻" },
    { id: "fine-wrong-kit", title: "Forgotten Kit / Wrong Socks", category: "Kit & Gear", amount: 3, emoji: "🧦" },
];

function getDefaultDueDateStr(daysAhead = 5): string {
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
    const [eventOptions, setEventOptions] = useState<EventQuickSelectOption[]>([]);

    // Top-level Views
    const [activeView, setActiveView] = useState<"requests" | "players" | "presets">("requests");
    const [groupStatusFilter, setGroupStatusFilter] = useState<"ALL" | "OPEN" | "SETTLED">("ALL");
    const [ledgerSearch, setLedgerSearch] = useState("");
    const [playerPickerSearch, setPlayerPickerSearch] = useState("");
    const [activeSquadOnly, setActiveSquadOnly] = useState(true);
    const [expandedGroupKeys, setExpandedGroupKeys] = useState<Record<string, boolean>>({});
    const [groupMemberFilter, setGroupMemberFilter] = useState<Record<string, "ALL" | "Unanswered" | "Paid" | "Declined">>({});

    // Club Payout Account Configuration (supports multiple named accounts/pots)
    const [payoutAccount, setPayoutAccount] = useState<ClubPayoutAccountConfig>({
        accountName: "",
        sortCode: "",
        accountNumber: "",
        defaultFeeCoverage: "player",
        accountHolderType: "individual",
        treasurerFirstName: "",
        treasurerLastName: "",
        treasurerEmail: "",
        namedAccounts: [],
    });
    const [selectedAccountLabel, setSelectedAccountLabel] = useState<string>("");
    const [newExtraAccountName, setNewExtraAccountName] = useState<string>("");
    const [isEditingAccountModal, setIsEditingAccountModal] = useState(false);
    const [copiedBankDetails, setCopiedBankDetails] = useState(false);

    // Presets / Fine Rules
    const [fineRules, setFineRules] = useState<StandardFineRule[]>(DEFAULT_STANDARD_FINES);
    const [showFinePresetsDrawer, setShowFinePresetsDrawer] = useState(false);
    const [isAddRuleOpen, setIsAddRuleOpen] = useState(false);
    const [editingRule, setEditingRule] = useState<StandardFineRule | null>(null);
    const [ruleForm, setRuleForm] = useState<{
        title: string;
        category: StandardFineRule["category"];
        amount: string;
        emoji: string;
    }>({
        title: "",
        category: "Subs & Fees",
        amount: "5",
        emoji: "⚽",
    });

    // Spond-Style Payment Request Creation State
    const [description, setDescription] = useState<string>("");
    const [requirement, setRequirement] = useState<"required" | "optional">("required");
    const [basePrice, setBasePrice] = useState<string>("5");
    const [dueDate, setDueDate] = useState<string>(() => getDefaultDueDateStr(5));
    const [feeCoverage, setFeeCoverage] = useState<"player" | "club">("player");
    const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
    const [autoNotifyPlayers, setAutoNotifyPlayers] = useState<boolean>(true);
    const [creating, setCreating] = useState(false);

    // Feedback & Action states
    const [feedbackBanner, setFeedbackBanner] = useState<string | null>(null);
    const [remindingGroupKey, setRemindingGroupKey] = useState<string | null>(null);
    const [remindingPaymentId, setRemindingPaymentId] = useState<string | null>(null);
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [copiedGroupKey, setCopiedGroupKey] = useState<string | null>(null);
    const [copiedPlayerLinkId, setCopiedPlayerLinkId] = useState<string | null>(null);
    const [copiedPortalLink, setCopiedPortalLink] = useState(false);
    const [onboardingLoading, setOnboardingLoading] = useState(false);
    const [syncingStripe, setSyncingStripe] = useState(false);
    const [syncingCardFines, setSyncingCardFines] = useState(false);

    // Embedded Stripe Connect Onboarding Modal & Treasurer Handoff state
    const [isEmbeddedStripeOpen, setIsEmbeddedStripeOpen] = useState(false);
    const [embeddedStripeLoading, setEmbeddedStripeLoading] = useState(false);
    const embeddedContainerRef = useRef<HTMLDivElement>(null);
    const [invitingTreasurer, setInvitingTreasurer] = useState(false);
    const [treasurerInviteLink, setTreasurerInviteLink] = useState<string | null>(null);
    const [copiedTreasurerLink, setCopiedTreasurerLink] = useState(false);

    const storageKey = clubId ? `clubflow-standard-fines-${clubId}` : "clubflow-standard-fines-default";
    const accountStorageKey = clubId ? `clubflow-payout-account-${clubId}` : "clubflow-payout-account-default";

    const showFeedback = (msg: string) => {
        setFeedbackBanner(msg);
        setTimeout(() => setFeedbackBanner(null), 5500);
    };

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
                if (Array.isArray(parsed)) {
                    setFineRules(parsed);
                }
            }
        } catch {}

        try {
            const rawAcct = localStorage.getItem(accountStorageKey);
            if (rawAcct) {
                const parsedAcct = JSON.parse(rawAcct);
                const loadedName = parsedAcct.accountName || `${settings.name || "Club"} Main Account`;
                setPayoutAccount({
                    accountName: loadedName,
                    sortCode: parsedAcct.sortCode || "",
                    accountNumber: parsedAcct.accountNumber || parsedAcct.accountNumberLast4 || "",
                    defaultFeeCoverage: parsedAcct.defaultFeeCoverage === "club" ? "club" : "player",
                    accountHolderType: parsedAcct.accountHolderType || "individual",
                    treasurerFirstName: parsedAcct.treasurerFirstName || "",
                    treasurerLastName: parsedAcct.treasurerLastName || "",
                    treasurerEmail: parsedAcct.treasurerEmail || "",
                    namedAccounts: Array.isArray(parsedAcct.namedAccounts) ? parsedAcct.namedAccounts : [],
                });
                setFeeCoverage(parsedAcct.defaultFeeCoverage === "club" ? "club" : "player");
            } else {
                setPayoutAccount(prev => ({
                    ...prev,
                    accountName: `${settings.name || "Club"} Main Account`,
                }));
            }
        } catch {}
    }, [storageKey, accountStorageKey, settings.name]);

    const formattedPrimaryAccountLabel = useMemo(() => {
        const baseName = payoutAccount.accountName || `${settings.name || "Club"} Main Account`;
        const details: string[] = [];
        if (payoutAccount.sortCode) details.push(`SC: ${payoutAccount.sortCode}`);
        if (payoutAccount.accountNumber) details.push(`Acc: ${payoutAccount.accountNumber}`);
        if (details.length > 0) {
            return `${baseName} (${details.join(" • ")})`;
        }
        return baseName;
    }, [payoutAccount, settings.name]);

    const availableAccounts = useMemo(() => {
        const list: string[] = [formattedPrimaryAccountLabel];
        for (const extra of payoutAccount.namedAccounts || []) {
            const extraDetails: string[] = [];
            if (extra.sortCode) extraDetails.push(`SC: ${extra.sortCode}`);
            if (extra.accountNumber) extraDetails.push(`Acc: ${extra.accountNumber}`);
            const formatted =
                extraDetails.length > 0 ? `${extra.label} (${extraDetails.join(" • ")})` : extra.label;
            if (formatted && !list.includes(formatted)) {
                list.push(formatted);
            }
        }
        if (list.length === 1) {
            list.push(`${settings.name || "Club"} Social & Fines Pot`);
        }
        return list;
    }, [formattedPrimaryAccountLabel, payoutAccount.namedAccounts, settings.name]);

    useEffect(() => {
        if (!selectedAccountLabel || !availableAccounts.includes(selectedAccountLabel)) {
            setSelectedAccountLabel(availableAccounts[0] || formattedPrimaryAccountLabel);
        }
    }, [availableAccounts, selectedAccountLabel, formattedPrimaryAccountLabel]);

    const saveFineRules = (nextRules: StandardFineRule[]) => {
        setFineRules(nextRules);
        try {
            localStorage.setItem(storageKey, JSON.stringify(nextRules));
        } catch {}
        persistConfigToSupabase(nextRules, payoutAccount);
    };

    const savePayoutAccountConfig = (nextConfig: ClubPayoutAccountConfig) => {
        setPayoutAccount(nextConfig);
        setFeeCoverage(nextConfig.defaultFeeCoverage);
        try {
            localStorage.setItem(accountStorageKey, JSON.stringify(nextConfig));
        } catch {}
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
        const openBankParam = searchParams.get("openBankSetup");
        if (connectParam === "success") {
            setConnectBanner("success");
        } else if (connectParam === "refresh") {
            setConnectBanner("refresh");
        }
        if (openBankParam === "1") {
            setIsEditingAccountModal(true);
        }
        loadData(connectParam === "success" || connectParam === "refresh");
    }, [clubId]);

    const loadData = async (forceVerifyConnect = false) => {
        setLoading(true);
        try {
            const { data: remoteCfg } = await supabase
                .from("documents")
                .select("url")
                .eq("club_id", clubId)
                .eq("category", "CLUB_FINES_CONFIG")
                .maybeSingle();

            if (remoteCfg?.url) {
                try {
                    const parsedRemote = JSON.parse(remoteCfg.url);
                    if (Array.isArray(parsedRemote.fineRules)) {
                        setFineRules(parsedRemote.fineRules);
                        localStorage.setItem(storageKey, JSON.stringify(parsedRemote.fineRules));
                    }
                    if (parsedRemote.payoutAccount) {
                        setPayoutAccount(prev => ({
                            ...prev,
                            ...parsedRemote.payoutAccount,
                        }));
                        localStorage.setItem(accountStorageKey, JSON.stringify(parsedRemote.payoutAccount));
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

            const [{ data: playersData }, { data: paymentsData }, { data: recentMatches }, { data: recentTraining }] =
                await Promise.all([
                    supabase
                        .from("players")
                        .select("*")
                        .eq("club_id", clubId)
                        .order("first_name", { ascending: true }),
                    supabase
                        .from("player_payment_requests")
                        .select("*")
                        .eq("club_id", clubId)
                        .order("created_at", { ascending: false }),
                    supabase
                        .from("matches")
                        .select("id, date, opponent, notes")
                        .eq("club_id", clubId)
                        .order("date", { ascending: false })
                        .limit(8),
                    supabase
                        .from("training_sessions")
                        .select("id, date, topic, attendance")
                        .eq("club_id", clubId)
                        .order("date", { ascending: false })
                        .limit(6),
                ]);

            if (playersData) {
                setPlayers(playersData as Player[]);
            }
            if (paymentsData) {
                setPayments(paymentsData as PaymentRequest[]);
            }

            // Build 1-click "Pick Players from Match / Training" options
            const quickEvents: EventQuickSelectOption[] = [];
            for (const m of recentMatches || []) {
                const ids = new Set<string>();
                const lineup = extractLineupFromRawNotes(m.notes || "");
                if (lineup?.parsedLineup) {
                    Object.values(lineup.parsedLineup.startingXI || {}).forEach((pid: any) => {
                        if (pid && typeof pid === "string") ids.add(pid);
                    });
                    Object.values(lineup.parsedLineup.substitutes || {}).forEach((pid: any) => {
                        if (pid && typeof pid === "string") ids.add(pid);
                    });
                }
                if (ids.size === 0 && m.notes) {
                    const availMatch = m.notes.match(/\[AVAILABILITY:\s*(.*?)\s*\]/);
                    if (availMatch && availMatch[1]) {
                        try {
                            const parsedAvail = JSON.parse(availMatch[1]);
                            parsedAvail
                                .filter((a: any) => a.status === "Available")
                                .forEach((a: any) => {
                                    if (a.playerId) ids.add(a.playerId);
                                });
                        } catch {}
                    }
                }
                if (ids.size > 0) {
                    const dateStr = new Date(m.date).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                    });
                    quickEvents.push({
                        id: `match-${m.id}`,
                        label: `Match vs ${m.opponent} (${dateStr}) — ${ids.size} players`,
                        playerIds: Array.from(ids),
                        suggestedTitle: `Match Sub vs ${m.opponent} (${dateStr})`,
                    });
                }
            }

            for (const t of recentTraining || []) {
                const att = Array.isArray(t.attendance) ? t.attendance : [];
                const presentIds = att
                    .filter((a: any) => a.status === "Present" || a.status === "Late")
                    .map((a: any) => a.playerId)
                    .filter(Boolean);
                if (presentIds.length > 0) {
                    const dateStr = new Date(t.date).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                    });
                    quickEvents.push({
                        id: `train-${t.id}`,
                        label: `Training: ${t.topic || "Session"} (${dateStr}) — ${presentIds.length} attended`,
                        playerIds: presentIds,
                        suggestedTitle: `Training Sub (${dateStr})`,
                    });
                }
            }
            setEventOptions(quickEvents);
        } catch (error) {
            console.error("Error loading Payments:", error);
        } finally {
            setLoading(false);
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

    const handleSelectFromEvent = (eventOptionId: string) => {
        if (!eventOptionId) return;
        const opt = eventOptions.find(e => e.id === eventOptionId);
        if (!opt) return;
        const validSet = new Set(eligiblePlayers.map(p => p.id));
        const matched = opt.playerIds.filter(id => validSet.has(id));
        setSelectedPlayerIds(matched);
        if (!description.trim()) {
            setDescription(opt.suggestedTitle);
        }
    };

    // Create Spond-Style Payment Batch + Send Instant Automatic Notifications
    const handleCreatePaymentRequests = async (e: React.FormEvent) => {
        e.preventDefault();
        if (selectedPlayerIds.length === 0) {
            alert("Please select at least one player.");
            return;
        }
        if (!basePrice || Number(basePrice) <= 0 || !description.trim()) {
            alert("Please enter what the payment is for and a valid price.");
            return;
        }

        setCreating(true);
        try {
            const batchId = `b_${Date.now().toString(36)}`;
            const cleanTitle = description.trim();
            const activeAccount = selectedAccountLabel || formattedPrimaryAccountLabel;

            const encodedDescription = encodePaymentDescription(cleanTitle, {
                dueDate: dueDate || undefined,
                feeCoverage,
                payoutAccountLabel: activeAccount,
                requirement,
                batchId,
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

            let createdRows = (data || []) as PaymentRequest[];
            let notifNote = "";

            if (createdRows.length > 0 && autoNotifyPlayers) {
                try {
                    const notifyRes = await fetch("/api/payments/notify", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            paymentIds: createdRows.map(r => r.id),
                            mode: "initial",
                        }),
                    }).then(r => r.json());

                    if (Array.isArray(notifyRes?.updatedRows)) {
                        const updatedMap = new Map<string, string>(
                            notifyRes.updatedRows.map((u: any) => [u.id, u.description])
                        );
                        createdRows = createdRows.map(row =>
                            updatedMap.has(row.id)
                                ? { ...row, description: updatedMap.get(row.id)! }
                                : row
                        );
                    }

                    if (typeof notifyRes?.sentCount === "number") {
                        notifNote =
                            notifyRes.sentCount > 0
                                ? ` • ${notifyRes.sentCount} player${
                                      notifyRes.sentCount === 1 ? "" : "s"
                                  } notified automatically`
                                : " • Ready to share via 1-tap link";
                    }
                } catch {}
            }

            if (createdRows.length > 0) {
                setPayments(prev => [...createdRows, ...prev]);
                setExpandedGroupKeys(prev => ({ ...prev, [batchId]: true }));
                setSelectedPlayerIds([]);
                setDescription("");
                showFeedback(
                    `Created "${cleanTitle}" (£${Number(basePrice).toFixed(2)}) for ${
                        createdRows.length
                    } player${createdRows.length === 1 ? "" : "s"}${notifNote}.`
                );
            }
        } catch (err: any) {
            console.error("Failed to create payment request:", err);
            alert("Error creating payment request: " + err.message);
        } finally {
            setCreating(false);
        }
    };

    const handleRemindPayments = async (paymentIds: string[], groupKey?: string) => {
        if (paymentIds.length === 0) return;
        if (groupKey) setRemindingGroupKey(groupKey);
        else setRemindingPaymentId(paymentIds[0]);

        try {
            const res = await fetch("/api/payments/notify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ paymentIds, mode: "reminder" }),
            }).then(r => r.json());

            if (Array.isArray(res?.updatedRows)) {
                const map = new Map<string, string>(res.updatedRows.map((u: any) => [u.id, u.description]));
                setPayments(prev =>
                    prev.map(p => (map.has(p.id) ? { ...p, description: map.get(p.id)! } : p))
                );
            }

            const sent = res?.sentCount || 0;
            const noEmail = res?.skippedNoEmailCount || 0;
            if (sent > 0) {
                showFeedback(
                    `Sent "Unanswered Payment" reminder to ${sent} player${sent === 1 ? "" : "s"}${
                        noEmail > 0 ? ` (${noEmail} without email — use WhatsApp/Link)` : ""
                    }.`
                );
            } else {
                showFeedback(
                    "Selected unanswered player(s) do not have an email on file yet — use Copy WhatsApp List or Link to send directly."
                );
            }
        } catch {
            showFeedback("Could not send email reminders right now.");
        } finally {
            setRemindingGroupKey(null);
            setRemindingPaymentId(null);
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

    const handleDeletePayment = async (id: string) => {
        if (!confirm("Remove this player from the payment request?")) return;
        setPayments(prev => prev.filter(p => p.id !== id));
        try {
            const { error } = await supabase.from("player_payment_requests").delete().eq("id", id);
            if (error) throw error;
        } catch {
            loadData();
        }
    };

    const handleDeleteEntireGroup = async (ids: string[], title: string) => {
        if (!confirm(`Delete the entire "${title}" payment request (${ids.length} players)?`)) return;
        setPayments(prev => prev.filter(p => !ids.includes(p.id)));
        try {
            const { error } = await supabase.from("player_payment_requests").delete().in("id", ids);
            if (error) throw error;
        } catch {
            loadData();
        }
    };

    const loadConnectJsSdk = (): Promise<any> => {
        return new Promise((resolve, reject) => {
            if (typeof window === "undefined") return reject(new Error("Browser required"));
            if ((window as any).StripeConnect) {
                return resolve((window as any).StripeConnect);
            }
            const existing = document.querySelector('script[src="https://connect-js.stripe.com/v1.0/connect.js"]');
            if (existing) {
                existing.addEventListener("load", () => resolve((window as any).StripeConnect));
                existing.addEventListener("error", () => reject(new Error("Failed to load Stripe Connect SDK")));
                return;
            }
            const script = document.createElement("script");
            script.src = "https://connect-js.stripe.com/v1.0/connect.js";
            script.async = true;
            script.onload = () => resolve((window as any).StripeConnect);
            script.onerror = () => reject(new Error("Failed to load Stripe Connect SDK"));
            document.head.appendChild(script);
        });
    };

    const handleConnectStripe = async (opts?: { resetAccount?: boolean; action?: "onboarding" | "dashboard" }) => {
        setOnboardingLoading(true);
        try {
            const updatedAcct = { ...payoutAccount, paymentsSkippedInOnboarding: false };
            setPayoutAccount(updatedAcct);
            try {
                localStorage.setItem(accountStorageKey, JSON.stringify(updatedAcct));
            } catch {}

            const { data: { session } } = await supabase.auth.getSession();
            const headers: Record<string, string> = { "Content-Type": "application/json" };
            if (session?.access_token) {
                headers["Authorization"] = `Bearer ${session.access_token}`;
            }

            const action = opts?.action || "onboarding";
            const res = await fetch("/api/checkout/connect-onboarding", {
                method: "POST",
                headers,
                body: JSON.stringify({
                    clubId,
                    accountHolderType: updatedAcct.accountHolderType,
                    treasurerFirstName: updatedAcct.treasurerFirstName,
                    treasurerLastName: updatedAcct.treasurerLastName,
                    treasurerEmail: updatedAcct.treasurerEmail,
                    resetAccount: opts?.resetAccount,
                    action,
                    preferEmbedded: action === "onboarding",
                }),
            });
            const data = await res.json();

            if (data.embedded && data.clientSecret && data.publishableKey) {
                setIsEditingAccountModal(false);
                setIsEmbeddedStripeOpen(true);
                setEmbeddedStripeLoading(true);
                try {
                    const StripeConnect = await loadConnectJsSdk();
                    const instance = StripeConnect.init({
                        publishableKey: data.publishableKey,
                        fetchClientSecret: async () => data.clientSecret,
                    });
                    const onboardingEl = instance.create("account-onboarding");
                    if (typeof onboardingEl.setOnExit === "function") {
                        onboardingEl.setOnExit(async () => {
                            setIsEmbeddedStripeOpen(false);
                            const verifyRes = await fetch("/api/checkout/verify-payment", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ clubId }),
                            })
                                .then(r => r.json())
                                .catch(() => null);
                            if (verifyRes?.onboardingComplete) {
                                setOnboardingComplete(true);
                                setConnectBanner("success");
                            }
                            loadData(true);
                        });
                    }
                    setTimeout(() => {
                        if (embeddedContainerRef.current) {
                            embeddedContainerRef.current.innerHTML = "";
                            embeddedContainerRef.current.appendChild(onboardingEl);
                        }
                        setEmbeddedStripeLoading(false);
                    }, 60);
                    return;
                } catch {
                    setIsEmbeddedStripeOpen(false);
                    setEmbeddedStripeLoading(false);
                    // Fall back to hosted redirect if SDK failed to mount
                    const fallbackRes = await fetch("/api/checkout/connect-onboarding", {
                        method: "POST",
                        headers,
                        body: JSON.stringify({
                            clubId,
                            accountHolderType: updatedAcct.accountHolderType,
                            action,
                            preferEmbedded: false,
                        }),
                    }).then(r => r.json());
                    if (fallbackRes?.url) {
                        window.location.href = fallbackRes.url;
                        return;
                    }
                }
            }

            if (data.url) {
                window.location.href = data.url;
            } else {
                alert(data.error || "Failed to start Stripe payout account onboarding.");
            }
        } catch {
            alert("An error occurred starting Stripe onboarding.");
        } finally {
            setOnboardingLoading(false);
        }
    };

    const handleInviteTreasurer = async () => {
        const email = payoutAccount.treasurerEmail.trim();
        const fullName = `${payoutAccount.treasurerFirstName} ${payoutAccount.treasurerLastName}`.trim() || "Club Treasurer";
        if (!email) {
            alert("Please enter your Treasurer or Secretary's email address.");
            return;
        }
        setInvitingTreasurer(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const headers: Record<string, string> = { "Content-Type": "application/json" };
            if (session?.access_token) {
                headers["Authorization"] = `Bearer ${session.access_token}`;
            }
            const res = await fetch("/api/payments/invite-treasurer", {
                method: "POST",
                headers,
                body: JSON.stringify({
                    clubId,
                    clubName: settings.name,
                    treasurerName: fullName,
                    treasurerEmail: email,
                }),
            }).then(r => r.json());

            if (res?.inviteUrl) {
                setTreasurerInviteLink(res.inviteUrl);
                savePayoutAccountConfig(payoutAccount);
                showFeedback(
                    res.emailSent
                        ? `Sent Treasurer bank-setup invite to ${email}!`
                        : `Created Treasurer invite link for ${fullName} — ready to copy or share on WhatsApp.`
                );
            } else {
                alert(res?.error || "Could not send Treasurer invite.");
            }
        } catch {
            alert("Could not send Treasurer invite right now.");
        } finally {
            setInvitingTreasurer(false);
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
                })
                    .then(r => r.json())
                    .catch(() => null);
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

            const newPayloads: any[] = [];
            const existingKeys = new Set(
                payments.map(
                    p => `${p.player_id}::${parsePaymentDescription(p.description).cleanDescription.toLowerCase()}`
                )
            );

            for (const m of matchesData || []) {
                const matchLabel = `vs ${m.opponent} (${m.date})`;
                const ycMap = new Map<string, number>();
                const rcMap = new Map<string, number>();

                for (const st of statsRows || []) {
                    if (st.match_id === m.id) {
                        if (Number(st.yellow_cards) > 0) ycMap.set(st.player_id, Number(st.yellow_cards));
                        if (Number(st.red_cards) > 0) rcMap.set(st.player_id, Number(st.red_cards));
                    }
                }
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
                    if (!existingKeys.has(key)) {
                        existingKeys.add(key);
                        newPayloads.push({
                            club_id: clubId,
                            player_id: pid,
                            amount: Number(yellowRule.amount) * count,
                            description: encodePaymentDescription(cleanReason, {
                                dueDate: getDefaultDueDateStr(7),
                                feeCoverage,
                                payoutAccountLabel: selectedAccountLabel || formattedPrimaryAccountLabel,
                                requirement: "required",
                                batchId: `yc_${m.id}`,
                            }),
                            status: "Unpaid",
                        });
                    }
                });

                rcMap.forEach((count, pid) => {
                    const cleanReason = `${redRule.emoji} ${redRule.title} (${matchLabel})`;
                    const key = `${pid}::${cleanReason.toLowerCase()}`;
                    if (!existingKeys.has(key)) {
                        existingKeys.add(key);
                        newPayloads.push({
                            club_id: clubId,
                            player_id: pid,
                            amount: Number(redRule.amount) * count,
                            description: encodePaymentDescription(cleanReason, {
                                dueDate: getDefaultDueDateStr(7),
                                feeCoverage,
                                payoutAccountLabel: selectedAccountLabel || formattedPrimaryAccountLabel,
                                requirement: "required",
                                batchId: `rc_${m.id}`,
                            }),
                            status: "Unpaid",
                        });
                    }
                });
            }

            if (newPayloads.length === 0) {
                showFeedback("All matchday Yellow & Red cards are already synced!");
                return;
            }

            const { data, error } = await supabase
                .from("player_payment_requests")
                .insert(newPayloads)
                .select();
            if (error) throw error;
            if (data) {
                setPayments(prev => [...(data as PaymentRequest[]), ...prev]);
                await fetch("/api/payments/notify", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        paymentIds: (data as PaymentRequest[]).map(r => r.id),
                        mode: "initial",
                    }),
                }).catch(() => {});
            }
            showFeedback(`Synced ${newPayloads.length} matchday card payment(s) & notified players!`);
        } catch (err: any) {
            showFeedback(`Error syncing cards: ${err.message}`);
        } finally {
            setSyncingCardFines(false);
        }
    };

    const getPaymentLink = (paymentId: string) => {
        const origin = typeof window !== "undefined" ? window.location.origin : "https://www.clubflow.org.uk";
        return `${origin}/pay/${paymentId}`;
    };

    const getClubPlayerPortalLink = (playerId?: string) => {
        const origin = typeof window !== "undefined" ? window.location.origin : "https://www.clubflow.org.uk";
        return playerId
            ? `${origin}/pay/club/${clubId}?player=${playerId}`
            : `${origin}/pay/club/${clubId}`;
    };

    const handleCopyLink = (paymentId: string) => {
        navigator.clipboard.writeText(getPaymentLink(paymentId));
        setCopiedId(paymentId);
        setTimeout(() => setCopiedId(null), 2000);
    };

    const handleCopyPortalLink = () => {
        navigator.clipboard.writeText(getClubPlayerPortalLink());
        setCopiedPortalLink(true);
        setTimeout(() => setCopiedPortalLink(false), 2000);
    };

    const handleCopyPlayerPortalLink = (playerId: string) => {
        navigator.clipboard.writeText(getClubPlayerPortalLink(playerId));
        setCopiedPlayerLinkId(playerId);
        setTimeout(() => setCopiedPlayerLinkId(null), 2000);
    };

    const handleSendWhatsApp = (payment: PaymentRequest) => {
        const player = players.find(p => p.id === payment.player_id);
        const playerName = player ? player.first_name : "there";
        const url = getPaymentLink(payment.id);
        const meta = parsePaymentDescription(payment.description);
        const breakdown = calculateClubFlowFee(Number(payment.amount), meta.feeCoverage);
        const dueStr = meta.dueDate
            ? `\n📅 *Due:* ${new Date(meta.dueDate + "T12:00:00Z").toLocaleDateString("en-GB")}`
            : "";

        const text = `⚽ *${settings.name || "Club"} — Unanswered Payment*\n\nHi ${playerName}, you have an unanswered ${meta.requirement} payment:\n📌 *For:* ${meta.cleanDescription}\n💷 *Amount:* £${breakdown.basePrice.toFixed(2)}${dueStr}\n\nPay in 1 tap (Link, Apple Pay, Google Pay, or Card):\n🔗 ${url}`;
        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
    };

    // Group payments cleanly into Spond-style Payment Request Batches
    const paymentGroups = useMemo(() => {
        const map = new Map<
            string,
            {
                groupKey: string;
                title: string;
                unitPrice: number;
                dueDate?: string;
                accountLabel: string;
                requirement: "required" | "optional";
                feeCoverage: "player" | "club";
                createdAt: string;
                lastReminderAt?: string;
                items: PaymentRequest[];
            }
        >();

        for (const pay of payments) {
            const meta = parsePaymentDescription(pay.description);
            // Ignore voided rows that were NOT optional declines
            if (pay.status === "Void" && !meta.declined) continue;

            const createdDay = (pay.created_at || "").split("T")[0];
            const groupKey =
                meta.batchId ||
                `legacy_${meta.cleanDescription.toLowerCase()}_${Number(pay.amount).toFixed(2)}_${
                    meta.dueDate || createdDay
                }`;

            const existing = map.get(groupKey);
            if (!existing) {
                map.set(groupKey, {
                    groupKey,
                    title: meta.cleanDescription,
                    unitPrice: Number(pay.amount || 0),
                    dueDate: meta.dueDate,
                    accountLabel: meta.payoutAccountLabel || formattedPrimaryAccountLabel,
                    requirement: meta.requirement,
                    feeCoverage: meta.feeCoverage,
                    createdAt: pay.created_at,
                    lastReminderAt: meta.lastReminderAt,
                    items: [pay],
                });
            } else {
                existing.items.push(pay);
                if (
                    meta.lastReminderAt &&
                    (!existing.lastReminderAt || meta.lastReminderAt > existing.lastReminderAt)
                ) {
                    existing.lastReminderAt = meta.lastReminderAt;
                }
            }
        }

        const todayStr = new Date().toISOString().split("T")[0];

        return Array.from(map.values())
            .map(group => {
                const paidItems = group.items.filter(i => i.status === "Paid");
                const unansweredItems = group.items.filter(i => i.status === "Unpaid");
                const declinedItems = group.items.filter(
                    i => i.status === "Void" && parsePaymentDescription(i.description).declined
                );

                const collectedAmount = paidItems.reduce((s, p) => {
                    const m = parsePaymentDescription(p.description);
                    return s + calculateClubFlowFee(Number(p.amount || 0), m.feeCoverage).clubNetReceived;
                }, 0);

                const expectedAmount = [...paidItems, ...unansweredItems].reduce((s, p) => {
                    const m = parsePaymentDescription(p.description);
                    return s + calculateClubFlowFee(Number(p.amount || 0), m.feeCoverage).clubNetReceived;
                }, 0);

                const activeTargetCount = paidItems.length + unansweredItems.length;
                const progressPct =
                    activeTargetCount > 0 ? Math.round((paidItems.length / activeTargetCount) * 100) : 100;
                const isOverdue = Boolean(
                    group.dueDate && group.dueDate < todayStr && unansweredItems.length > 0
                );

                return {
                    ...group,
                    paidItems,
                    unansweredItems,
                    declinedItems,
                    collectedAmount,
                    expectedAmount,
                    progressPct,
                    isOverdue,
                };
            })
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }, [payments, formattedPrimaryAccountLabel]);

    const filteredPaymentGroups = useMemo(() => {
        return paymentGroups.filter(g => {
            if (groupStatusFilter === "OPEN" && g.unansweredItems.length === 0) return false;
            if (groupStatusFilter === "SETTLED" && g.unansweredItems.length > 0) return false;

            if (ledgerSearch.trim()) {
                const q = ledgerSearch.toLowerCase();
                if (g.title.toLowerCase().includes(q) || g.accountLabel.toLowerCase().includes(q)) {
                    return true;
                }
                return g.items.some(item => {
                    const pl = players.find(x => x.id === item.player_id);
                    const name = pl ? `${pl.first_name} ${pl.last_name}`.toLowerCase() : "";
                    return name.includes(q);
                });
            }
            return true;
        });
    }, [paymentGroups, groupStatusFilter, ledgerSearch, players]);

    const handleCopyGroupWhatsApp = (group: (typeof paymentGroups)[number]) => {
        const portalUrl = getClubPlayerPortalLink();
        const unansweredNames = group.unansweredItems.map((item, idx) => {
            const pl = players.find(x => x.id === item.player_id);
            const name = pl ? `${pl.first_name} ${pl.last_name}` : "Player";
            return `${idx + 1}. ${name}`;
        });
        const dueText = group.dueDate
            ? ` • Due ${new Date(group.dueDate + "T12:00:00Z").toLocaleDateString("en-GB", {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
              })}`
            : "";

        const msg =
            unansweredNames.length > 0
                ? `⚽ *${settings.name || "Club"} — ${group.title} (£${group.unitPrice.toFixed(2)})*\n${
                      group.requirement === "optional" ? "Optional" : "Required"
                  }${dueText}\n\n⏳ *Unanswered (${unansweredNames.length}):*\n${unansweredNames.join(
                      "\n"
                  )}\n\n👇 *Pay in 1 tap (Link, Apple Pay, Google Pay, or Card):*\n🔗 ${portalUrl}`
                : `⚽ *${settings.name || "Club"} — ${group.title}*\nAll ${group.paidItems.length} players settled! ✅`;

        navigator.clipboard.writeText(msg);
        setCopiedGroupKey(group.groupKey);
        setTimeout(() => setCopiedGroupKey(null), 2500);
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

        const overdueCount = unpaidList.filter(p => {
            const meta = parsePaymentDescription(p.description);
            return meta.dueDate && meta.dueDate < todayStr;
        }).length;

        return {
            unpaidCount: unpaidList.length,
            paidCount: paidList.length,
            unpaidClubTotal,
            paidClubTotal,
            overdueCount,
        };
    }, [payments]);

    // By-Player Balance Summary
    const playerBalances = useMemo(() => {
        const map = new Map<
            string,
            {
                player: Player;
                unpaidCount: number;
                paidAmount: number;
                unpaidAmount: number;
                unpaidIds: string[];
            }
        >();

        payments.forEach(pay => {
            if (pay.status === "Void") return;
            const p = players.find(x => x.id === pay.player_id);
            if (!p) return;
            if (activeSquadOnly && isFormerPlayer(p.notes)) return;

            const entry = map.get(p.id) || {
                player: p,
                unpaidCount: 0,
                paidAmount: 0,
                unpaidAmount: 0,
                unpaidIds: [],
            };
            const amt = Number(pay.amount || 0);
            if (pay.status === "Paid") {
                entry.paidAmount += amt;
            } else if (pay.status === "Unpaid") {
                entry.unpaidCount += 1;
                entry.unpaidAmount += amt;
                entry.unpaidIds.push(pay.id);
            }
            map.set(p.id, entry);
        });

        return Array.from(map.values()).sort((a, b) => {
            if (b.unpaidAmount !== a.unpaidAmount) return b.unpaidAmount - a.unpaidAmount;
            return b.paidAmount - a.paidAmount;
        });
    }, [players, payments, activeSquadOnly]);

    const handleOpenNewRule = () => {
        setEditingRule(null);
        setRuleForm({ title: "", category: "Subs & Fees", amount: "5", emoji: "⚽" });
        setIsAddRuleOpen(true);
    };

    const handleOpenEditRule = (rule: StandardFineRule) => {
        setEditingRule(rule);
        setRuleForm({
            title: rule.title,
            category: rule.category,
            amount: String(rule.amount),
            emoji: rule.emoji || "⚽",
        });
        setIsAddRuleOpen(true);
    };

    const handleSaveRule = () => {
        if (!ruleForm.title.trim() || !ruleForm.amount || Number(ruleForm.amount) <= 0) return;
        if (editingRule) {
            saveFineRules(
                fineRules.map(r =>
                    r.id === editingRule.id
                        ? {
                              ...r,
                              title: ruleForm.title.trim(),
                              category: ruleForm.category,
                              amount: parseFloat(ruleForm.amount),
                              emoji: ruleForm.emoji || "⚽",
                          }
                        : r
                )
            );
        } else {
            saveFineRules([
                ...fineRules,
                {
                    id: `preset-${Date.now()}`,
                    title: ruleForm.title.trim(),
                    category: ruleForm.category,
                    amount: parseFloat(ruleForm.amount),
                    emoji: ruleForm.emoji || "⚽",
                },
            ]);
        }
        setIsAddRuleOpen(false);
    };

    const handleAddNamedAccount = () => {
        const trimmed = newExtraAccountName.trim();
        if (!trimmed) return;
        const nextAccounts = [
            ...(payoutAccount.namedAccounts || []),
            { id: `acct_${Date.now()}`, label: trimmed },
        ];
        setPayoutAccount({ ...payoutAccount, namedAccounts: nextAccounts });
        setNewExtraAccountName("");
    };

    const handleRemoveNamedAccount = (id: string) => {
        setPayoutAccount({
            ...payoutAccount,
            namedAccounts: (payoutAccount.namedAccounts || []).filter(a => a.id !== id),
        });
    };

    const handleDeleteRule = (id: string) => {
        saveFineRules(fineRules.filter(r => r.id !== id));
    };

    const dynamicQuickPresets = useMemo(() => {
        const subRules = fineRules.filter(r => r.category === "Subs & Fees");
        return subRules.slice(0, 6).map(r => ({
            id: r.id,
            label: r.title
                .replace(/^Saturday\s+/i, "")
                .replace(/^Club\s+/i, "")
                .replace(/\s+Club\s+/i, " ")
                .replace(/\s+Session/i, "")
                .replace(/^Annual\s+/i, "")
                .replace(/^Season\s+/i, ""),
            title: r.title,
            amount: r.amount,
            req: (r.title.toLowerCase().includes("social") ? "optional" : "required") as
                | "required"
                | "optional",
        }));
    }, [fineRules]);

    const currentPreviewBreakdown = calculateClubFlowFee(Number(basePrice || 0), feeCoverage);
    const selectedWithEmailCount = selectedPlayerIds.filter(id => {
        const pl = players.find(p => p.id === id);
        return Boolean(pl?.email?.trim());
    }).length;

    if (loading) {
        return <div className="p-8 text-center text-muted-foreground">Loading Subs &amp; Payments...</div>;
    }

    return (
        <div className="space-y-6 max-w-6xl mx-auto">
            {/* Stripe Connect Return Banner */}
            {connectBanner === "success" && (
                <div className="rounded-xl bg-emerald-500/15 border border-emerald-500/40 p-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                        <div>
                            <h4 className="text-sm font-bold text-foreground">Club Bank Account Connected!</h4>
                            <p className="text-xs text-muted-foreground">
                                Players can now pay in 1 tap via Link, Apple Pay, Google Pay, or Card directly into your bank account.
                            </p>
                        </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setConnectBanner(null)} className="text-xs">
                        Dismiss
                    </Button>
                </div>
            )}

            {/* Action Feedback Banner */}
            {feedbackBanner && (
                <div className="rounded-xl bg-emerald-500/15 border border-emerald-500/40 px-4 py-3 text-xs font-semibold text-emerald-700 dark:text-emerald-300 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 shrink-0" />
                        <span>{feedbackBanner}</span>
                    </div>
                    <button
                        type="button"
                        onClick={() => setFeedbackBanner(null)}
                        className="text-muted-foreground hover:text-foreground"
                    >
                        ✕
                    </button>
                </div>
            )}

            {/* Clean Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2.5 flex-wrap">
                        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                            Subs &amp; Payments
                        </h1>
                        <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 text-[11px] font-bold gap-1">
                            <Bell className="h-3 w-3" /> Auto-Reminders On
                        </Badge>
                    </div>
                    <p className="text-muted-foreground text-sm mt-1">
                        Set what a payment is for, pick signed-up players, and let ClubFlow notify &amp; chase unanswered payments automatically.
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCopyPortalLink}
                        className="text-xs font-semibold gap-1.5 border-brand/40 text-brand hover:bg-brand/10"
                    >
                        <Smartphone className="h-3.5 w-3.5" />
                        {copiedPortalLink ? "✓ Squad Pay Link Copied" : "Copy Squad Pay Link"}
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsEditingAccountModal(true)}
                        className="text-xs font-semibold gap-1.5"
                    >
                        <Building2 className="h-3.5 w-3.5" />
                        {onboardingComplete ? "Accounts & Bank ✓" : "Link Bank Account"}
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleSyncWithStripe}
                        disabled={syncingStripe}
                        className="gap-1.5 text-xs font-semibold"
                    >
                        <RefreshCw className={`h-3.5 w-3.5 ${syncingStripe ? "animate-spin" : ""}`} />
                        {syncingStripe ? "Syncing..." : "Sync"}
                    </Button>
                </div>
            </div>

            {/* 1-Time Bank Setup Strip (only prominent if Stripe not yet connected and not skipped in onboarding) */}
            {!onboardingComplete && !payoutAccount.paymentsSkippedInOnboarding && (
                <Card className="border-amber-500/35 bg-amber-500/5">
                    <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0">
                                <Landmark className="h-5 w-5" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-foreground">
                                    Connect Your Club Bank Account Once to Enable 1-Tap Card &amp; Apple Pay
                                </h3>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    Link your Sort Code &amp; Account Number in ~90 seconds — or invite your Club Treasurer to link it on their phone.
                                </p>
                            </div>
                        </div>
                        {isManager && (
                            <div className="flex flex-wrap items-center gap-2 shrink-0">
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setIsEditingAccountModal(true)}
                                    className="text-xs font-semibold"
                                >
                                    <UserPlus className="h-3.5 w-3.5 mr-1.5" />
                                    Invite Treasurer
                                </Button>
                                <Button
                                    size="sm"
                                    onClick={() => handleConnectStripe({ action: "onboarding" })}
                                    disabled={onboardingLoading}
                                    className="bg-brand hover:bg-brand/90 text-white text-xs font-bold"
                                >
                                    <CreditCard className="h-3.5 w-3.5 mr-1.5" />
                                    {onboardingLoading ? "Opening Setup..." : "Link Bank Account"}
                                </Button>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Compact 3-Stat Overview Strip */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card className="border-border bg-card shadow-xs">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                Unanswered Payments
                            </p>
                            <p className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">
                                {kpis.unpaidCount}{" "}
                                <span className="text-sm font-bold text-muted-foreground">
                                    (£{kpis.unpaidClubTotal.toFixed(2)})
                                </span>
                            </p>
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                                {kpis.overdueCount > 0
                                    ? `${kpis.overdueCount} past due date • auto-reminding`
                                    : "Monitored automatically by due date"}
                            </p>
                        </div>
                        <div className="h-10 w-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
                            <Clock className="h-5 w-5" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-border bg-card shadow-xs">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                Collected
                            </p>
                            <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                                £{kpis.paidClubTotal.toFixed(2)}
                            </p>
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                                {kpis.paidCount} payment{kpis.paidCount === 1 ? "" : "s"} settled
                            </p>
                        </div>
                        <div className="h-10 w-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                            <Coins className="h-5 w-5" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-border bg-card shadow-xs">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div className="min-w-0">
                            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                Receiving Account
                            </p>
                            <p className="text-sm font-bold text-foreground mt-1 truncate">
                                {selectedAccountLabel || formattedPrimaryAccountLabel}
                            </p>
                            <button
                                type="button"
                                onClick={() => setIsEditingAccountModal(true)}
                                className="text-[11px] text-brand font-semibold hover:underline mt-0.5"
                            >
                                {onboardingComplete
                                    ? `✓ Stripe Active • ${availableAccounts.length} Account(s)`
                                    : "Configure Club Accounts →"}
                            </button>
                        </div>
                        <div className="h-10 w-10 rounded-xl bg-brand/15 border border-brand/30 flex items-center justify-center text-brand shrink-0">
                            <Building2 className="h-5 w-5" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Clean View Switcher */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setActiveView("requests")}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                            activeView === "requests"
                                ? "bg-brand text-white shadow-xs"
                                : "bg-surface-1 text-muted-foreground hover:text-foreground border border-border"
                        }`}
                    >
                        <CreditCard className="h-4 w-4" />
                        Payment Requests ({paymentGroups.length})
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveView("players")}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                            activeView === "players"
                                ? "bg-brand text-white shadow-xs"
                                : "bg-surface-1 text-muted-foreground hover:text-foreground border border-border"
                        }`}
                    >
                        <Users className="h-4 w-4" />
                        By Player ({playerBalances.filter(b => b.unpaidCount > 0).length} owing)
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveView("presets")}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                            activeView === "presets"
                                ? "bg-brand text-white shadow-xs"
                                : "bg-surface-1 text-muted-foreground hover:text-foreground border border-border"
                        }`}
                    >
                        <Receipt className="h-4 w-4" />
                        Saved Presets &amp; Card Sync
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

            {/* ===================================================================== */}
            {/* VIEW 1: SPOND-STYLE CREATE PAYMENT + GROUPED REQUESTS TRACKER         */}
            {/* ===================================================================== */}
            {activeView === "requests" && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* Left Column: Dead-Simple Spond-Style Payment Creator */}
                    <Card className="lg:col-span-5 border-border h-fit">
                        <CardHeader className="pb-3 border-b border-border bg-surface-1/50">
                            <CardTitle className="text-base font-bold flex items-center gap-2">
                                <Plus className="h-4 w-4 text-brand" /> New Payment Request
                            </CardTitle>
                            <CardDescription className="text-xs">
                                Set what it&apos;s for, required or optional, due date, account, price, and players.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="pt-4">
                            <form onSubmit={handleCreatePaymentRequests} className="space-y-4">
                                {/* 1. Required vs Optional Toggle */}
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                        1. Payment Type
                                    </Label>
                                    <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-surface-1 border border-border">
                                        <button
                                            type="button"
                                            onClick={() => setRequirement("required")}
                                            className={`py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                                requirement === "required"
                                                    ? "bg-brand text-white shadow-xs"
                                                    : "text-muted-foreground hover:text-foreground"
                                            }`}
                                        >
                                            Required
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setRequirement("optional")}
                                            className={`py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                                requirement === "optional"
                                                    ? "bg-sky-600 text-white shadow-xs"
                                                    : "text-muted-foreground hover:text-foreground"
                                            }`}
                                        >
                                            Optional
                                        </button>
                                    </div>
                                    <p className="text-[11px] text-muted-foreground">
                                        {requirement === "required"
                                            ? "Players must pay — unanswered players get automatic reminders."
                                            : "Players can either pay or tap Decline (ideal for kit orders or socials)."}
                                    </p>
                                </div>

                                {/* 2. What the payment is for + Quick Chips */}
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                        2. What is the payment for?
                                    </Label>
                                    <Input
                                        type="text"
                                        value={description}
                                        onChange={e => setDescription(e.target.value)}
                                        placeholder="e.g. Saturday Match Sub, November Subs, Training Top..."
                                        className="h-10 text-xs font-medium"
                                        required
                                    />
                                    <div className="flex flex-wrap items-center gap-1.5">
                                        {dynamicQuickPresets.map(p => (
                                            <span
                                                key={p.id}
                                                className="inline-flex items-center rounded-full border border-border bg-surface-1/70 text-[11px] font-semibold text-muted-foreground hover:border-brand/50 transition-colors"
                                            >
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setDescription(p.title);
                                                        setBasePrice(String(p.amount));
                                                        setRequirement(p.req);
                                                    }}
                                                    className="pl-2.5 pr-1.5 py-1 hover:text-foreground cursor-pointer"
                                                >
                                                    {p.label} (£{p.amount})
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={e => {
                                                        e.stopPropagation();
                                                        handleDeleteRule(p.id);
                                                    }}
                                                    title={`Delete "${p.label}" preset`}
                                                    aria-label={`Delete ${p.label} preset`}
                                                    className="pr-2 pl-0.5 py-1 text-muted-foreground/70 hover:text-rose-500 transition-colors cursor-pointer"
                                                >
                                                    <X className="h-3 w-3" />
                                                </button>
                                            </span>
                                        ))}
                                        <button
                                            type="button"
                                            onClick={() => setShowFinePresetsDrawer(prev => !prev)}
                                            className="px-2.5 py-1 rounded-full text-[11px] font-semibold text-brand hover:underline cursor-pointer"
                                        >
                                            {showFinePresetsDrawer ? "Hide Presets" : "+ Saved Presets"}
                                        </button>
                                    </div>

                                    {showFinePresetsDrawer && (
                                        <div className="space-y-2 p-2.5 rounded-xl bg-surface-1/60 border border-border">
                                            <div className="flex items-center justify-between gap-2 px-0.5">
                                                <span className="text-[11px] font-bold text-muted-foreground">
                                                    Saved Presets ({fineRules.length})
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={handleOpenNewRule}
                                                    className="text-[11px] font-bold text-brand hover:underline cursor-pointer"
                                                >
                                                    + New Preset
                                                </button>
                                            </div>
                                            {fineRules.length === 0 ? (
                                                <p className="text-[11px] text-muted-foreground text-center py-3">
                                                    No saved presets yet. Click <strong>+ New Preset</strong> to create one.
                                                </p>
                                            ) : (
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-44 overflow-y-auto">
                                                    {fineRules.map(rule => (
                                                        <div
                                                            key={rule.id}
                                                            className="flex items-center justify-between gap-1.5 px-2 py-1.5 rounded-lg border border-border bg-background hover:border-brand/60 text-[11px]"
                                                        >
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setDescription(`${rule.emoji} ${rule.title}`);
                                                                    setBasePrice(String(rule.amount));
                                                                    setShowFinePresetsDrawer(false);
                                                                }}
                                                                className="flex items-center justify-between gap-1.5 flex-1 min-w-0 text-left cursor-pointer"
                                                            >
                                                                <span className="truncate">
                                                                    {rule.emoji} {rule.title}
                                                                </span>
                                                                <span className="font-bold text-emerald-600 dark:text-emerald-400 shrink-0">
                                                                    £{rule.amount}
                                                                </span>
                                                            </button>
                                                            <div className="flex items-center gap-0.5 shrink-0 border-l border-border pl-1">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleOpenEditRule(rule)}
                                                                    title="Edit preset"
                                                                    className="p-1 text-muted-foreground hover:text-foreground cursor-pointer"
                                                                >
                                                                    <Pencil className="h-3 w-3" />
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleDeleteRule(rule.id)}
                                                                    title="Delete preset"
                                                                    className="p-1 text-muted-foreground hover:text-rose-500 cursor-pointer"
                                                                >
                                                                    <Trash2 className="h-3 w-3" />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* 3. Price, Due Date & Account */}
                                <div className="space-y-3">
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1.5">
                                            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                                3. Price (£)
                                            </Label>
                                            <Input
                                                type="number"
                                                step="0.50"
                                                min="0.50"
                                                value={basePrice}
                                                onChange={e => setBasePrice(e.target.value)}
                                                className="h-10 text-sm font-black"
                                                required
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                                                <Calendar className="h-3 w-3" /> Due Date
                                            </Label>
                                            <Input
                                                type="date"
                                                value={dueDate}
                                                onChange={e => setDueDate(e.target.value)}
                                                className="h-10 text-xs"
                                                required
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-1.5">
                                        <div className="flex items-center justify-between">
                                            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                                4. Account Receiving Payment
                                            </Label>
                                            <button
                                                type="button"
                                                onClick={() => setIsEditingAccountModal(true)}
                                                className="text-[11px] font-semibold text-brand hover:underline"
                                            >
                                                + Manage Accounts
                                            </button>
                                        </div>
                                        <select
                                            value={selectedAccountLabel}
                                            onChange={e => setSelectedAccountLabel(e.target.value)}
                                            className="flex h-10 w-full rounded-lg border border-border bg-background px-3 text-xs font-semibold text-foreground"
                                        >
                                            {availableAccounts.map(acct => (
                                                <option key={acct} value={acct}>
                                                    {acct}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                {/* 5. Select Signed-Up Players */}
                                <div className="space-y-2 pt-1">
                                    <div className="flex items-center justify-between gap-2">
                                        <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                            5. Players ({selectedPlayerIds.length} selected)
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
                                                    : `Select All (${filteredPickerPlayers.length})`}
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

                                    {eventOptions.length > 0 && (
                                        <select
                                            defaultValue=""
                                            onChange={e => {
                                                handleSelectFromEvent(e.target.value);
                                                e.target.value = "";
                                            }}
                                            className="flex h-8 w-full rounded-lg border border-border bg-surface-1/70 px-2.5 text-[11px] font-medium text-muted-foreground hover:text-foreground"
                                        >
                                            <option value="">
                                                ⚡ Quick-select players from a Match or Training session...
                                            </option>
                                            {eventOptions.map(ev => (
                                                <option key={ev.id} value={ev.id}>
                                                    {ev.label}
                                                </option>
                                            ))}
                                        </select>
                                    )}

                                    <div className="relative">
                                        <Search className="h-3.5 w-3.5 text-muted-foreground absolute left-2.5 top-2.5" />
                                        <Input
                                            type="text"
                                            placeholder="Search signed-up players..."
                                            value={playerPickerSearch}
                                            onChange={e => setPlayerPickerSearch(e.target.value)}
                                            className="h-8 pl-8 text-xs"
                                        />
                                    </div>

                                    <div className="divide-y divide-border max-h-52 overflow-y-auto rounded-xl border border-border bg-surface-1/30">
                                        {filteredPickerPlayers.length === 0 ? (
                                            <p className="p-4 text-center text-xs text-muted-foreground">
                                                No players found.
                                            </p>
                                        ) : (
                                            filteredPickerPlayers.map(p => {
                                                const checked = selectedPlayerIds.includes(p.id);
                                                const hasEmail = Boolean(p.email?.trim());
                                                return (
                                                    <button
                                                        key={p.id}
                                                        type="button"
                                                        onClick={() => togglePlayerSelection(p.id)}
                                                        className={`w-full px-3 py-2 text-xs text-left transition-colors cursor-pointer flex items-center justify-between gap-2 ${
                                                            checked
                                                                ? "bg-brand/10 text-foreground font-bold"
                                                                : "hover:bg-surface-1 text-foreground"
                                                        }`}
                                                    >
                                                        <div className="flex items-center gap-2 min-w-0">
                                                            <div
                                                                className={`h-4 w-4 rounded flex items-center justify-center border shrink-0 ${
                                                                    checked
                                                                        ? "bg-brand border-brand text-white"
                                                                        : "border-muted-foreground/40 bg-background"
                                                                }`}
                                                            >
                                                                {checked && <Check className="h-3 w-3" />}
                                                            </div>
                                                            <span className="truncate">
                                                                {p.first_name} {p.last_name}
                                                            </span>
                                                            {p.position && (
                                                                <span className="text-[10px] text-muted-foreground font-normal shrink-0">
                                                                    {p.position}
                                                                </span>
                                                            )}
                                                        </div>
                                                        {hasEmail && (
                                                            <span
                                                                title="Email connected — receives automatic notification & reminders"
                                                                className="text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5 shrink-0"
                                                            >
                                                                <Mail className="h-3 w-3" />
                                                            </span>
                                                        )}
                                                    </button>
                                                );
                                            })
                                        )}
                                    </div>
                                </div>

                                {/* Compact Fee & Auto-Reminder Controls */}
                                <div className="rounded-xl border border-border bg-surface-1/60 p-3 space-y-2.5 text-xs">
                                    <label className="flex items-start gap-2.5 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={autoNotifyPlayers}
                                            onChange={e => setAutoNotifyPlayers(e.target.checked)}
                                            className="mt-0.5 rounded border-border accent-emerald-600"
                                        />
                                        <span className="leading-snug">
                                            <strong className="text-foreground block">
                                                Send &ldquo;Unanswered Payment&rdquo; alert &amp; auto-reminders
                                            </strong>
                                            <span className="text-[11px] text-muted-foreground">
                                                Notifies players immediately and auto-nudges unpaid players around the due date.
                                            </span>
                                        </span>
                                    </label>

                                    <div className="border-t border-border pt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                                        <span>
                                            Club gets{" "}
                                            <strong className="text-emerald-600 dark:text-emerald-400">
                                                £{currentPreviewBreakdown.clubNetReceived.toFixed(2)}
                                            </strong>{" "}
                                            • Player pays{" "}
                                            <strong className="text-foreground">
                                                £{currentPreviewBreakdown.playerTotalPayable.toFixed(2)}
                                            </strong>
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setFeeCoverage(prev => (prev === "player" ? "club" : "player"))
                                            }
                                            className="text-brand font-semibold hover:underline"
                                        >
                                            {feeCoverage === "player" ? "Player pays fee" : "Club absorbs fee"}
                                        </button>
                                    </div>
                                </div>

                                <Button
                                    type="submit"
                                    disabled={creating || selectedPlayerIds.length === 0}
                                    className="w-full h-11 bg-brand hover:bg-brand/90 text-white font-bold text-xs shadow-sm"
                                >
                                    {creating
                                        ? "Sending Payment Request..."
                                        : selectedPlayerIds.length > 0
                                        ? `Send ${
                                              requirement === "optional" ? "Optional" : "Required"
                                          } Payment to ${selectedPlayerIds.length} Player${
                                              selectedPlayerIds.length === 1 ? "" : "s"
                                          }${
                                              autoNotifyPlayers && selectedWithEmailCount > 0
                                                  ? ` (${selectedWithEmailCount} auto-emailed)`
                                                  : ""
                                          }`
                                        : "Select Players to Send Request"}
                                </Button>
                            </form>
                        </CardContent>
                    </Card>

                    {/* Right Column: Spond-Style Grouped Payment Cards */}
                    <div className="lg:col-span-7 space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5">
                                {(["ALL", "OPEN", "SETTLED"] as const).map(st => (
                                    <button
                                        key={st}
                                        type="button"
                                        onClick={() => setGroupStatusFilter(st)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                                            groupStatusFilter === st
                                                ? "bg-foreground text-background"
                                                : "bg-surface-1 text-muted-foreground hover:text-foreground border border-border"
                                        }`}
                                    >
                                        {st === "ALL"
                                            ? `All (${paymentGroups.length})`
                                            : st === "OPEN"
                                            ? `Has Unanswered (${
                                                  paymentGroups.filter(g => g.unansweredItems.length > 0).length
                                              })`
                                            : `All Paid (${
                                                  paymentGroups.filter(g => g.unansweredItems.length === 0).length
                                              })`}
                                    </button>
                                ))}
                            </div>

                            <div className="relative sm:w-56">
                                <Search className="h-3.5 w-3.5 text-muted-foreground absolute left-2.5 top-2.5" />
                                <Input
                                    type="text"
                                    placeholder="Search payment or player..."
                                    value={ledgerSearch}
                                    onChange={e => setLedgerSearch(e.target.value)}
                                    className="h-8 pl-8 text-xs"
                                />
                            </div>
                        </div>

                        {filteredPaymentGroups.length === 0 ? (
                            <Card className="border-border">
                                <CardContent className="py-14 text-center space-y-2">
                                    <CreditCard className="h-10 w-10 text-muted-foreground/50 mx-auto" />
                                    <p className="text-sm font-bold text-foreground">No payment requests yet</p>
                                    <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                                        Create a payment request on the left — selected players will get an instant 1-tap link to pay by saved card, Apple Pay, or Google Pay.
                                    </p>
                                </CardContent>
                            </Card>
                        ) : (
                            filteredPaymentGroups.map(group => {
                                const isExpanded = Boolean(expandedGroupKeys[group.groupKey]);
                                const subFilter = groupMemberFilter[group.groupKey] || "ALL";
                                const visibleMembers = group.items.filter(item => {
                                    const m = parsePaymentDescription(item.description);
                                    if (subFilter === "Unanswered") return item.status === "Unpaid";
                                    if (subFilter === "Paid") return item.status === "Paid";
                                    if (subFilter === "Declined") return item.status === "Void" && m.declined;
                                    return true;
                                });

                                return (
                                    <Card
                                        key={group.groupKey}
                                        className="border-border bg-card overflow-hidden shadow-2xs"
                                    >
                                        <div className="p-4 space-y-3">
                                            {/* Top Row: Title, Badges & Price */}
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="space-y-1 min-w-0">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <h3 className="font-bold text-base text-foreground">
                                                            {group.title}
                                                        </h3>
                                                        <Badge
                                                            variant="outline"
                                                            className={
                                                                group.requirement === "optional"
                                                                    ? "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/35 text-[10px] font-bold"
                                                                    : "bg-surface-1 text-foreground border-border text-[10px] font-bold"
                                                            }
                                                        >
                                                            {group.requirement === "optional"
                                                                ? "Optional"
                                                                : "Required"}
                                                        </Badge>
                                                        {group.unansweredItems.length === 0 ? (
                                                            <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/35 text-[10px] font-bold">
                                                                ✓ All Settled
                                                            </Badge>
                                                        ) : group.isOverdue ? (
                                                            <Badge className="bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/35 text-[10px] font-bold">
                                                                Overdue ({group.unansweredItems.length} Unanswered)
                                                            </Badge>
                                                        ) : (
                                                            <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/35 text-[10px] font-bold">
                                                                {group.unansweredItems.length} Unanswered
                                                            </Badge>
                                                        )}
                                                    </div>

                                                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                                        {group.dueDate && (
                                                            <span
                                                                className={
                                                                    group.isOverdue
                                                                        ? "text-rose-500 font-bold"
                                                                        : "font-medium text-foreground/80"
                                                                }
                                                            >
                                                                Due{" "}
                                                                {new Date(
                                                                    group.dueDate + "T12:00:00Z"
                                                                ).toLocaleDateString("en-GB", {
                                                                    day: "numeric",
                                                                    month: "short",
                                                                    year: "numeric",
                                                                })}
                                                            </span>
                                                        )}
                                                        <span>•</span>
                                                        <span className="truncate max-w-[230px]">
                                                            {group.accountLabel}
                                                        </span>
                                                        {group.lastReminderAt && group.unansweredItems.length > 0 && (
                                                            <>
                                                                <span>•</span>
                                                                <span className="text-[11px]">
                                                                    Last notified{" "}
                                                                    {new Date(group.lastReminderAt).toLocaleDateString(
                                                                        "en-GB",
                                                                        { day: "numeric", month: "short" }
                                                                    )}
                                                                </span>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="text-right shrink-0">
                                                    <span className="text-lg font-black text-foreground block">
                                                        £{group.unitPrice.toFixed(2)}
                                                    </span>
                                                    <span className="text-[10px] text-muted-foreground block">
                                                        per player
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Progress Bar + Paid vs Unanswered Counts */}
                                            <div className="space-y-1.5">
                                                <div className="flex items-center justify-between text-xs">
                                                    <div className="flex items-center gap-3 font-semibold">
                                                        <span className="text-emerald-600 dark:text-emerald-400">
                                                            {group.paidItems.length} Paid
                                                        </span>
                                                        <span className="text-amber-600 dark:text-amber-400">
                                                            {group.unansweredItems.length} Unanswered
                                                        </span>
                                                        {group.declinedItems.length > 0 && (
                                                            <span className="text-muted-foreground">
                                                                {group.declinedItems.length} Declined
                                                            </span>
                                                        )}
                                                    </div>
                                                    <span className="text-xs font-bold text-foreground">
                                                        £{group.collectedAmount.toFixed(2)} / £
                                                        {group.expectedAmount.toFixed(2)}
                                                    </span>
                                                </div>
                                                <div className="h-2 w-full rounded-full bg-surface-1 overflow-hidden border border-border/60">
                                                    <div
                                                        className="h-full bg-emerald-500 transition-all duration-300"
                                                        style={{ width: `${group.progressPct}%` }}
                                                    />
                                                </div>
                                            </div>

                                            {/* Action Bar */}
                                            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                                                <div className="flex flex-wrap items-center gap-1.5">
                                                    {group.unansweredItems.length > 0 && (
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            disabled={remindingGroupKey === group.groupKey}
                                                            onClick={() =>
                                                                handleRemindPayments(
                                                                    group.unansweredItems.map(i => i.id),
                                                                    group.groupKey
                                                                )
                                                            }
                                                            className="h-8 text-xs font-bold gap-1.5 border-amber-500/40 text-amber-700 dark:text-amber-300 hover:bg-amber-500/10"
                                                        >
                                                            <Bell className="h-3.5 w-3.5" />
                                                            {remindingGroupKey === group.groupKey
                                                                ? "Sending..."
                                                                : `Remind Unanswered (${group.unansweredItems.length})`}
                                                        </Button>
                                                    )}
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => handleCopyGroupWhatsApp(group)}
                                                        className="h-8 text-xs font-semibold gap-1.5"
                                                    >
                                                        <Share2 className="h-3.5 w-3.5" />
                                                        {copiedGroupKey === group.groupKey
                                                            ? "✓ Copied"
                                                            : "WhatsApp Summary"}
                                                    </Button>
                                                </div>

                                                <div className="flex items-center gap-1">
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() =>
                                                            setExpandedGroupKeys(prev => ({
                                                                ...prev,
                                                                [group.groupKey]: !prev[group.groupKey],
                                                            }))
                                                        }
                                                        className="h-8 text-xs font-bold gap-1"
                                                    >
                                                        {isExpanded ? (
                                                            <>
                                                                Hide Players <ChevronUp className="h-3.5 w-3.5" />
                                                            </>
                                                        ) : (
                                                            <>
                                                                View Players ({group.items.length}){" "}
                                                                <ChevronDown className="h-3.5 w-3.5" />
                                                            </>
                                                        )}
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() =>
                                                            handleDeleteEntireGroup(
                                                                group.items.map(i => i.id),
                                                                group.title
                                                            )
                                                        }
                                                        className="h-8 w-8 p-0 text-muted-foreground hover:text-rose-500"
                                                        title="Delete entire payment request"
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Expanded Player Roster inside Payment Card */}
                                        {isExpanded && (
                                            <div className="border-t border-border bg-surface-1/40 p-3 space-y-2.5">
                                                <div className="flex flex-wrap items-center gap-1.5">
                                                    {(
                                                        [
                                                            {
                                                                key: "ALL",
                                                                label: `All (${group.items.length})`,
                                                            },
                                                            {
                                                                key: "Unanswered",
                                                                label: `Unanswered (${group.unansweredItems.length})`,
                                                            },
                                                            {
                                                                key: "Paid",
                                                                label: `Paid (${group.paidItems.length})`,
                                                            },
                                                            ...(group.requirement === "optional" ||
                                                            group.declinedItems.length > 0
                                                                ? [
                                                                      {
                                                                          key: "Declined" as const,
                                                                          label: `Declined (${group.declinedItems.length})`,
                                                                      },
                                                                  ]
                                                                : []),
                                                        ] as const
                                                    ).map(tab => (
                                                        <button
                                                            key={tab.key}
                                                            type="button"
                                                            onClick={() =>
                                                                setGroupMemberFilter(prev => ({
                                                                    ...prev,
                                                                    [group.groupKey]: tab.key,
                                                                }))
                                                            }
                                                            className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors ${
                                                                subFilter === tab.key
                                                                    ? "bg-brand text-white"
                                                                    : "bg-background text-muted-foreground hover:text-foreground border border-border"
                                                            }`}
                                                        >
                                                            {tab.label}
                                                        </button>
                                                    ))}
                                                </div>

                                                <div className="divide-y divide-border rounded-xl border border-border bg-card overflow-hidden">
                                                    {visibleMembers.map(pay => {
                                                        const pl = players.find(x => x.id === pay.player_id);
                                                        const meta = parsePaymentDescription(pay.description);
                                                        const isPaid = pay.status === "Paid";
                                                        const isDeclined =
                                                            pay.status === "Void" && meta.declined;

                                                        return (
                                                            <div
                                                                key={pay.id}
                                                                className="px-3 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                                                            >
                                                                <div className="flex items-center gap-2 flex-wrap min-w-0">
                                                                    <span className="font-bold text-foreground">
                                                                        {pl
                                                                            ? `${pl.first_name} ${pl.last_name}`
                                                                            : "Squad Member"}
                                                                    </span>
                                                                    {isPaid ? (
                                                                        <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/35 text-[10px]">
                                                                            ✓ Paid
                                                                            {pay.paid_at
                                                                                ? ` • ${new Date(
                                                                                      pay.paid_at
                                                                                  ).toLocaleDateString("en-GB", {
                                                                                      day: "numeric",
                                                                                      month: "short",
                                                                                  })}`
                                                                                : ""}
                                                                        </Badge>
                                                                    ) : isDeclined ? (
                                                                        <Badge variant="outline" className="text-[10px]">
                                                                            Declined
                                                                        </Badge>
                                                                    ) : (
                                                                        <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/35 text-[10px]">
                                                                            Unanswered
                                                                        </Badge>
                                                                    )}
                                                                </div>

                                                                <div className="flex items-center gap-1.5 justify-end shrink-0">
                                                                    {!isPaid && !isDeclined && (
                                                                        <>
                                                                            <Button
                                                                                size="sm"
                                                                                variant="outline"
                                                                                onClick={() => handleMarkAsPaidManual(pay)}
                                                                                className="h-7 px-2 text-[11px] font-semibold border-emerald-500/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 gap-1"
                                                                                title="Mark settled offline (Cash / Bank Transfer)"
                                                                            >
                                                                                <CheckCircle2 className="h-3 w-3" /> Mark Paid
                                                                            </Button>
                                                                            {pl?.email ? (
                                                                                <Button
                                                                                    size="sm"
                                                                                    variant="outline"
                                                                                    disabled={remindingPaymentId === pay.id}
                                                                                    onClick={() =>
                                                                                        handleRemindPayments([pay.id])
                                                                                    }
                                                                                    className="h-7 px-2 text-[11px] gap-1"
                                                                                    title="Send email reminder"
                                                                                >
                                                                                    <Mail className="h-3 w-3" />
                                                                                    {remindingPaymentId === pay.id
                                                                                        ? "..."
                                                                                        : "Remind"}
                                                                                </Button>
                                                                            ) : (
                                                                                <Button
                                                                                    size="sm"
                                                                                    variant="outline"
                                                                                    onClick={() => handleSendWhatsApp(pay)}
                                                                                    className="h-7 px-2 text-[11px] gap-1"
                                                                                    title="Send via WhatsApp"
                                                                                >
                                                                                    <Send className="h-3 w-3" /> WhatsApp
                                                                                </Button>
                                                                            )}
                                                                            <Button
                                                                                size="sm"
                                                                                variant="ghost"
                                                                                onClick={() => handleCopyLink(pay.id)}
                                                                                className="h-7 px-2 text-[11px]"
                                                                                title="Copy direct 1-tap pay link"
                                                                            >
                                                                                {copiedId === pay.id ? (
                                                                                    <Check className="h-3 w-3 text-emerald-500" />
                                                                                ) : (
                                                                                    <Copy className="h-3 w-3" />
                                                                                )}
                                                                            </Button>
                                                                        </>
                                                                    )}
                                                                    <Button
                                                                        size="sm"
                                                                        variant="ghost"
                                                                        onClick={() => handleDeletePayment(pay.id)}
                                                                        className="h-7 w-7 p-0 text-muted-foreground hover:text-rose-500"
                                                                        title="Remove player from request"
                                                                    >
                                                                        <Trash2 className="h-3 w-3" />
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                    </Card>
                                );
                            })
                        )}
                    </div>
                </div>
            )}

            {/* ===================================================================== */}
            {/* VIEW 2: BY PLAYER BALANCES                                            */}
            {/* ===================================================================== */}
            {activeView === "players" && (
                <Card className="border-border overflow-hidden">
                    <CardHeader className="border-b border-border bg-surface-1/50">
                        <CardTitle className="text-base font-bold">Player Payment Balances</CardTitle>
                        <CardDescription className="text-xs">
                            Overview of total paid vs unanswered payments per player across all requests.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                        {playerBalances.length === 0 ? (
                            <div className="p-12 text-center text-muted-foreground text-sm">
                                No payments recorded yet.
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-surface-1 text-muted-foreground uppercase text-xs font-bold border-b border-border">
                                        <tr>
                                            <th className="px-4 py-3">Player</th>
                                            <th className="px-3 py-3 text-center">Paid</th>
                                            <th className="px-3 py-3 text-center">Unanswered</th>
                                            <th className="px-4 py-3 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border">
                                        {playerBalances.map(row => (
                                            <tr key={row.player.id} className="hover:bg-surface-1/50 transition-colors">
                                                <td className="px-4 py-3 font-bold text-foreground">
                                                    {row.player.first_name} {row.player.last_name}
                                                    {row.player.email && (
                                                        <span className="ml-2 text-[10px] font-normal text-muted-foreground">
                                                            ✉ auto-remind
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-3 py-3 text-center font-bold text-emerald-600 dark:text-emerald-400">
                                                    £{row.paidAmount.toFixed(2)}
                                                </td>
                                                <td className="px-3 py-3 text-center">
                                                    {row.unpaidCount > 0 ? (
                                                        <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/35 font-bold">
                                                            £{row.unpaidAmount.toFixed(2)} ({row.unpaidCount} unanswered)
                                                        </Badge>
                                                    ) : (
                                                        <span className="text-xs text-muted-foreground">Up to date ✓</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <div className="inline-flex items-center gap-1.5">
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="h-7 px-2.5 text-xs gap-1"
                                                            onClick={() => handleCopyPlayerPortalLink(row.player.id)}
                                                        >
                                                            {copiedPlayerLinkId === row.player.id ? (
                                                                <Check className="h-3 w-3 text-emerald-500" />
                                                            ) : (
                                                                <Copy className="h-3 w-3" />
                                                            )}
                                                            {copiedPlayerLinkId === row.player.id ? "Copied" : "Pay Link"}
                                                        </Button>
                                                        {row.unpaidCount > 0 && row.player.email && (
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() => handleRemindPayments(row.unpaidIds)}
                                                                className="h-7 px-2.5 text-xs gap-1 border-amber-500/40 text-amber-700 dark:text-amber-300"
                                                            >
                                                                <Bell className="h-3 w-3" /> Remind
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

            {/* ===================================================================== */}
            {/* VIEW 3: SAVED SUB & FINE PRESETS + MATCHDAY CARD SYNC                 */}
            {/* ===================================================================== */}
            {activeView === "presets" && (
                <Card className="border-border">
                    <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border bg-surface-1/50">
                        <div>
                            <CardTitle className="text-base font-bold">Saved Payment &amp; Fine Presets</CardTitle>
                            <CardDescription className="text-xs">
                                Optional shortcuts for regular match subs, monthly fees, or yellow/red card fines.
                            </CardDescription>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleSyncMatchdayCardFines}
                                disabled={syncingCardFines}
                                className="text-xs font-bold gap-1.5"
                            >
                                <Sparkles className={`h-3.5 w-3.5 ${syncingCardFines ? "animate-spin" : ""}`} />
                                {syncingCardFines ? "Scanning..." : "Auto-Create Matchday Card Fines"}
                            </Button>
                            <Button
                                size="sm"
                                onClick={handleOpenNewRule}
                                className="bg-brand hover:bg-brand/90 text-white text-xs font-bold gap-1.5"
                            >
                                <Plus className="h-3.5 w-3.5" /> Add Preset
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="pt-5">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {fineRules.map(rule => (
                                <div
                                    key={rule.id}
                                    className="p-4 rounded-xl border border-border bg-card flex flex-col justify-between gap-3"
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
                                        <span className="text-lg font-black text-emerald-600 dark:text-emerald-400 shrink-0">
                                            £{rule.amount.toFixed(2)}
                                        </span>
                                    </div>

                                    <div className="flex items-center justify-between border-t border-border pt-2.5">
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="h-7 text-xs font-semibold"
                                            onClick={() => {
                                                setDescription(`${rule.emoji} ${rule.title}`);
                                                setBasePrice(String(rule.amount));
                                                setActiveView("requests");
                                            }}
                                        >
                                            Use Preset →
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
                                                onClick={() =>
                                                    saveFineRules(fineRules.filter(r => r.id !== rule.id))
                                                }
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* ===================================================================== */}
            {/* CLUB PAYMENT ACCOUNTS & STRIPE EXPRESS SETUP MODAL                    */}
            {/* ===================================================================== */}
            <Dialog open={isEditingAccountModal} onOpenChange={setIsEditingAccountModal}>
                <DialogContent className="sm:max-w-[540px] max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Building2 className="h-5 w-5 text-brand" /> Club Payment Accounts &amp; Bank Setup
                        </DialogTitle>
                        <DialogDescription className="text-xs">
                            Configure your primary club account, add separate named accounts/pots (e.g. Subs vs Social), and link Stripe Express for direct payouts.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold">Primary Account Name</Label>
                            <Input
                                placeholder="e.g. Camden United Main Subs Account"
                                value={payoutAccount.accountName}
                                onChange={e =>
                                    setPayoutAccount({ ...payoutAccount, accountName: e.target.value })
                                }
                                className="h-9 text-xs"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label className="text-xs font-semibold">Sort Code (Optional)</Label>
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
                                <Label className="text-xs font-semibold">Account Number (Optional)</Label>
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

                        {/* Additional Named Accounts / Pots */}
                        <div className="space-y-2 p-3 rounded-xl bg-surface-1 border border-border">
                            <Label className="text-xs font-semibold">
                                Additional Payment Accounts / Pots (Selectable per Request)
                            </Label>
                            <div className="flex gap-2">
                                <Input
                                    placeholder="e.g. First Team Subs, Social & Fines Pot..."
                                    value={newExtraAccountName}
                                    onChange={e => setNewExtraAccountName(e.target.value)}
                                    className="h-8 text-xs"
                                />
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={handleAddNamedAccount}
                                    className="h-8 text-xs font-bold shrink-0"
                                >
                                    + Add
                                </Button>
                            </div>
                            {(payoutAccount.namedAccounts || []).length > 0 && (
                                <div className="flex flex-wrap gap-1.5 pt-1">
                                    {(payoutAccount.namedAccounts || []).map(acct => (
                                        <span
                                            key={acct.id}
                                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-background border border-border text-xs font-medium"
                                        >
                                            {acct.label}
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveNamedAccount(acct.id)}
                                                className="text-muted-foreground hover:text-rose-500"
                                            >
                                                ✕
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Stripe Express Payout Connection */}
                        <div className="p-3.5 rounded-xl bg-surface-1 border border-border space-y-2.5">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-foreground">
                                    Direct Bank Payouts via Stripe Express
                                </span>
                                {onboardingComplete ? (
                                    <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-[10px]">
                                        ✓ Connected
                                    </Badge>
                                ) : (
                                    <Badge className="bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30 text-[10px]">
                                        2-Min Guided Setup
                                    </Badge>
                                )}
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                {(["individual", "non_profit", "company"] as const).map(type => (
                                    <button
                                        key={type}
                                        type="button"
                                        onClick={() =>
                                            setPayoutAccount({ ...payoutAccount, accountHolderType: type })
                                        }
                                        className={`p-2 rounded-lg border text-left text-xs cursor-pointer ${
                                            payoutAccount.accountHolderType === type
                                                ? "bg-brand/15 border-brand text-foreground font-bold"
                                                : "bg-background border-border text-muted-foreground"
                                        }`}
                                    >
                                        {type === "individual"
                                            ? "Grassroots / Treasurer"
                                            : type === "non_profit"
                                            ? "Non-Profit / CASC"
                                            : "Registered Ltd"}
                                    </button>
                                ))}
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
                                            Copy Sort Code &amp; Account Number for Stripe
                                        </>
                                    )}
                                </Button>
                            )}

                            <div className="flex flex-col sm:flex-row gap-2">
                                <Button
                                    type="button"
                                    size="sm"
                                    onClick={() =>
                                        handleConnectStripe({
                                            action: onboardingComplete ? "dashboard" : "onboarding",
                                        })
                                    }
                                    disabled={onboardingLoading}
                                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold"
                                >
                                    <CreditCard className="h-3.5 w-3.5 mr-1.5" />
                                    {onboardingLoading
                                        ? "Opening Stripe..."
                                        : onboardingComplete
                                        ? "Open Stripe Payouts Dashboard"
                                        : "Connect Bank Account in Stripe"}
                                </Button>
                                {connectAccount && !onboardingComplete && (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() =>
                                            handleConnectStripe({ resetAccount: true, action: "onboarding" })
                                        }
                                        disabled={onboardingLoading}
                                        className="text-xs font-semibold"
                                    >
                                        Reset Setup
                                    </Button>
                                )}
                            </div>
                        </div>

                        {/* Delegate Bank Setup to Club Treasurer / Secretary */}
                        <div className="p-3.5 rounded-xl bg-surface-1 border border-border space-y-2.5">
                            <div className="flex items-center justify-between gap-2">
                                <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                                    <UserPlus className="h-3.5 w-3.5 text-brand" />
                                    Don&apos;t have the club bank details? Invite your Treasurer
                                </span>
                            </div>
                            <p className="text-[11px] text-muted-foreground leading-relaxed">
                                Send your Club Treasurer or Secretary a 1-click invite with <strong className="text-foreground">Subs &amp; Payments</strong> access so they can connect the club bank account directly.
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <Input
                                    placeholder="Treasurer Name (e.g. Sarah Jenkins)"
                                    value={payoutAccount.treasurerFirstName}
                                    onChange={e =>
                                        setPayoutAccount({
                                            ...payoutAccount,
                                            treasurerFirstName: e.target.value,
                                        })
                                    }
                                    className="h-8 text-xs"
                                />
                                <Input
                                    type="email"
                                    placeholder="Treasurer Email (e.g. treasurer@club.co.uk)"
                                    value={payoutAccount.treasurerEmail}
                                    onChange={e =>
                                        setPayoutAccount({
                                            ...payoutAccount,
                                            treasurerEmail: e.target.value,
                                        })
                                    }
                                    className="h-8 text-xs"
                                />
                            </div>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={invitingTreasurer || !payoutAccount.treasurerEmail.trim()}
                                onClick={handleInviteTreasurer}
                                className="w-full h-8 text-xs font-semibold"
                            >
                                {invitingTreasurer ? (
                                    <>
                                        <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                                        Sending Treasurer Invite...
                                    </>
                                ) : (
                                    <>
                                        <Mail className="h-3.5 w-3.5 mr-1.5" />
                                        Send Treasurer Bank-Setup Invite
                                    </>
                                )}
                            </Button>
                            {treasurerInviteLink && (
                                <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/25">
                                    <span className="text-[11px] text-emerald-700 dark:text-emerald-300 truncate">
                                        ✓ Invite ready: {treasurerInviteLink}
                                    </span>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                            navigator.clipboard.writeText(treasurerInviteLink);
                                            setCopiedTreasurerLink(true);
                                            setTimeout(() => setCopiedTreasurerLink(false), 2000);
                                        }}
                                        className="h-7 px-2.5 text-[11px] font-semibold shrink-0"
                                    >
                                        {copiedTreasurerLink ? "Copied!" : "Copy Link"}
                                    </Button>
                                </div>
                            )}
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
                            Save Accounts
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ===================================================================== */}
            {/* EMBEDDED STRIPE CONNECT ONBOARDING MODAL                              */}
            {/* ===================================================================== */}
            <Dialog open={isEmbeddedStripeOpen} onOpenChange={setIsEmbeddedStripeOpen}>
                <DialogContent className="sm:max-w-[640px] max-h-[92vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <CreditCard className="h-5 w-5 text-indigo-500" /> Connect Club Bank Account
                        </DialogTitle>
                        <DialogDescription className="text-xs">
                            Complete secure verification below so player payments go straight into your club bank account.
                        </DialogDescription>
                    </DialogHeader>
                    {embeddedStripeLoading && (
                        <div className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground">
                            <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
                            <span className="text-xs font-medium">Loading secure Stripe Connect form...</span>
                        </div>
                    )}
                    <div ref={embeddedContainerRef} className="min-h-[420px] w-full py-1" />
                </DialogContent>
            </Dialog>

            {/* Add / Edit Preset Modal */}
            <Dialog open={isAddRuleOpen} onOpenChange={setIsAddRuleOpen}>
                <DialogContent className="sm:max-w-[420px]">
                    <DialogHeader>
                        <DialogTitle>{editingRule ? "Edit Preset" : "Add Payment Preset"}</DialogTitle>
                        <DialogDescription className="text-xs">
                            Save a reusable sub, fee, or fine shortcut.
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
                                <Label className="text-xs font-semibold">Title</Label>
                                <Input
                                    placeholder="e.g. Saturday Match Sub"
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
                                    <option value="Subs & Fees">Subs &amp; Fees</option>
                                    <option value="Discipline">Discipline</option>
                                    <option value="Punctuality">Punctuality</option>
                                    <option value="Kit & Gear">Kit &amp; Gear</option>
                                    <option value="Matchday">Matchday</option>
                                    <option value="Custom">Custom</option>
                                </select>
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs font-semibold">Price (£)</Label>
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
                        <Button
                            size="sm"
                            onClick={handleSaveRule}
                            className="bg-brand hover:bg-brand/90 text-white font-semibold"
                        >
                            Save Preset
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
