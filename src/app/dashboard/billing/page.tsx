"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { CheckCircle2, AlertCircle, Calendar, ArrowUpRight, History, Shield, Sparkles, Check } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getSubscription, saveSubscription, SubscriptionTier, UserSubscription } from "@/lib/subscription-utils";

interface PaymentLog {
    id: string;
    amount: number;
    status: string;
    created_at: string;
    tier: SubscriptionTier;
}

export default function BillingPage() {
    const [sub, setSub] = useState<UserSubscription>(() => getSubscription());
    const [selectedTier, setSelectedTier] = useState<SubscriptionTier>("Medium");
    const [isConfiguring, setIsConfiguring] = useState(false);
    const [isCancelling, setIsCancelling] = useState(false);
    const [successMessage, setSuccessMessage] = useState("");
    const [errorMessage, setErrorMessage] = useState("");
    const [paymentHistory, setPaymentHistory] = useState<PaymentLog[]>([]);

    const loadBillingState = useCallback(async (sessionIdParam?: string | null) => {
        try {
            const {
                data: { session },
            } = await supabase.auth.getSession();
            if (!session?.access_token) return;

            const query = sessionIdParam ? `?session_id=${encodeURIComponent(sessionIdParam)}` : "";
            const res = await fetch(`/api/checkout${query}`, {
                headers: {
                    Authorization: `Bearer ${session.access_token}`,
                },
            });
            if (!res.ok) return;
            const data = await res.json();

            const trialEndsAt = data.trialEndsAt || sub.trialEndsAt;
            const isTrialActive = new Date() < new Date(trialEndsAt);
            const isPaymentConfigured = Boolean(data.isPaymentConfigured);
            const resolvedTier: SubscriptionTier = data.tier || "Medium";

            const syncedSub: UserSubscription = {
                tier: resolvedTier,
                trialEndsAt,
                isActive: isPaymentConfigured || isTrialActive,
                isPaymentConfigured,
            };

            saveSubscription(syncedSub);
            setSub(syncedSub);
            if (isPaymentConfigured) {
                setSelectedTier(resolvedTier);
            }
            if (Array.isArray(data.history)) {
                setPaymentHistory(data.history);
            }

            if (sessionIdParam && isPaymentConfigured) {
                setSuccessMessage(
                    `Stripe subscription confirmed! Your club is now active on the ${resolvedTier} Plan.`
                );
            }
        } catch (err) {
            console.error("Failed to fetch billing status:", err);
        }
    }, [sub.trialEndsAt]);

    useEffect(() => {
        const searchParams = new URLSearchParams(window.location.search);
        const paymentParam = searchParams.get("payment");
        const sessionIdParam = searchParams.get("session_id");

        if (paymentParam === "cancelled") {
            setErrorMessage("Stripe checkout was cancelled. No charges were made.");
        }

        loadBillingState(paymentParam === "success" ? sessionIdParam : null);
    }, [loadBillingState]);

    const now = new Date();
    const trialEnds = new Date(sub.trialEndsAt);
    const daysLeft = Math.max(0, Math.ceil((trialEnds.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
    const isTrialExpired = !sub.isPaymentConfigured && now > trialEnds;

    const startStripeSubscription = async (tierToPurchase: SubscriptionTier) => {
        setIsConfiguring(true);
        setErrorMessage("");
        setSuccessMessage("");
        try {
            const {
                data: { session },
            } = await supabase.auth.getSession();
            if (!session?.access_token) {
                setErrorMessage("Please sign in again to manage club billing.");
                return;
            }

            const res = await fetch("/api/checkout", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({ tier: tierToPurchase }),
            });
            const data = await res.json();

            if (!res.ok || !data.url) {
                setErrorMessage(
                    data.error || "Unable to open Stripe Checkout right now. Please try again."
                );
                return;
            }

            window.location.href = data.url;
        } catch (err: any) {
            setErrorMessage(err.message || "Error connecting to Stripe Checkout.");
        } finally {
            setIsConfiguring(false);
        }
    };

    const handleCancel = async () => {
        if (
            !confirm(
                "Are you sure you want to cancel your club's Stripe subscription? Paid modules will lock once your trial/billing period ends."
            )
        ) {
            return;
        }

        setIsCancelling(true);
        setErrorMessage("");
        try {
            const {
                data: { session },
            } = await supabase.auth.getSession();
            if (!session?.access_token) return;

            const res = await fetch("/api/checkout", {
                method: "DELETE",
                headers: {
                    Authorization: `Bearer ${session.access_token}`,
                },
            });
            const data = await res.json();
            if (!res.ok) {
                setErrorMessage(data.error || "Could not cancel subscription.");
                return;
            }

            const updatedSub: UserSubscription = {
                tier: sub.tier,
                trialEndsAt: sub.trialEndsAt,
                isActive: now < trialEnds,
                isPaymentConfigured: false,
            };

            saveSubscription(updatedSub);
            setSub(updatedSub);
            await loadBillingState(null);
        } catch (err: any) {
            setErrorMessage(err.message || "Error cancelling subscription.");
        } finally {
            setIsCancelling(false);
        }
    };

    const plans = [
        {
            id: "Low" as SubscriptionTier,
            name: "Grassroots Plan",
            price: "4.99",
            description: "Core administration tools for starting clubs.",
            features: [
                "Squad Management",
                "Training Attendance Log",
                "Basic Fixtures & Score logging",
                "Matchday Planner & Team Builder",
                "League Table Syncing",
            ],
            color: "border-slate-200 bg-white",
        },
        {
            id: "Medium" as SubscriptionTier,
            name: "Pro Club Plan",
            price: "9.99",
            description: "Advanced analytics, financial ledger, and player subs & fines.",
            features: [
                "Everything in Grassroots",
                "General Finance Ledger",
                "Subs & Payments (Apple Pay / Card + Auto-Reminders)",
                "Match Dominance Tracker & Real-Time Scoring",
                "Recruitment Scouting Ledger",
                "Sponsorship Leads Manager",
            ],
            color: "border-indigo-600 bg-indigo-50/10 ring-2 ring-indigo-500/20",
            badge: "Default & Most Popular",
            isDefault: true,
        },
        {
            id: "High" as SubscriptionTier,
            name: "Elite Academy Plan",
            price: "19.99",
            description: "Total control with opposition reports and premium scouting.",
            features: [
                "Everything in Pro Club",
                "Opposition Scouting Reports",
                "Opposition Player Profiling & Roles",
                "Advanced Match Analytics (xG coordinate mappings)",
                "Full PDF Report Exports",
                "Priority Support",
            ],
            color: "border-purple-600 bg-purple-50/10 ring-2 ring-purple-500/20",
            badge: "Full Access",
        },
    ];

    return (
        <div className="space-y-8 max-w-5xl pb-16 animate-in fade-in duration-300">
            <div>
                <h2 className="text-3xl font-bold tracking-tight text-foreground">Membership &amp; Billing</h2>
                <p className="text-muted-foreground">
                    Manage your club workspace plan and verified Stripe billing records across all devices.
                </p>
            </div>

            {successMessage && (
                <Alert className="border-emerald-200 bg-emerald-50 text-emerald-800">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    <AlertTitle className="font-semibold">Subscription Active</AlertTitle>
                    <AlertDescription>{successMessage}</AlertDescription>
                </Alert>
            )}

            {errorMessage && (
                <Alert className="border-rose-200 bg-rose-50 text-rose-800">
                    <AlertCircle className="h-5 w-5 text-rose-600" />
                    <AlertTitle className="font-semibold">Billing Notice</AlertTitle>
                    <AlertDescription>{errorMessage}</AlertDescription>
                </Alert>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="md:col-span-2 border-slate-200 shadow-sm relative overflow-hidden bg-slate-900 text-white">
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-900/60 via-slate-950/80 to-slate-950 pointer-events-none" />
                    <CardHeader className="relative z-10">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Sparkles className="h-5 w-5 text-indigo-400" />
                            Club Subscription Status
                        </CardTitle>
                        <CardDescription className="text-slate-400">
                            Synced across your club workspace via Stripe Checkout.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="relative z-10 space-y-6">
                        <div className="flex items-center gap-4 p-4 rounded-xl border border-white/10 bg-white/5">
                            <div
                                className={`h-12 w-12 rounded-full flex items-center justify-center shrink-0 ${
                                    sub.isPaymentConfigured
                                        ? "bg-emerald-500/20 text-emerald-400"
                                        : isTrialExpired
                                        ? "bg-red-500/20 text-red-400"
                                        : "bg-amber-500/20 text-amber-400"
                                }`}
                            >
                                {sub.isPaymentConfigured ? (
                                    <CheckCircle2 className="h-6 w-6" />
                                ) : isTrialExpired ? (
                                    <AlertCircle className="h-6 w-6" />
                                ) : (
                                    <Calendar className="h-6 w-6" />
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold">
                                    {sub.isPaymentConfigured
                                        ? "Active Stripe Subscription"
                                        : isTrialExpired
                                        ? "Free Trial Ended"
                                        : `${daysLeft} Days Remaining on 30-Day Free Trial`}
                                </p>
                                <p className="text-xs text-slate-400 mt-0.5">
                                    {sub.isPaymentConfigured
                                        ? `Subscribed to the ${sub.tier} Plan via Stripe.`
                                        : isTrialExpired
                                        ? "Your 30-day free trial has ended. Choose a Stripe plan below to continue."
                                        : "Full access to every ClubFlow feature during your 30-day trial — no card required upfront."}
                                </p>
                            </div>
                        </div>

                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-2 border-t border-white/10">
                            <div>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                                    Active Billing Tier
                                </p>
                                <p className="text-2xl font-black mt-0.5">
                                    {sub.isPaymentConfigured
                                        ? `${sub.tier} Plan`
                                        : `${selectedTier} Plan (Selected)`}
                                </p>
                            </div>

                            {sub.isPaymentConfigured ? (
                                <Button
                                    onClick={handleCancel}
                                    disabled={isCancelling}
                                    variant="outline"
                                    className="border-red-900/60 bg-red-950/20 text-red-400 hover:bg-red-950/40 hover:text-red-300 font-medium"
                                >
                                    {isCancelling ? "Cancelling..." : "Cancel Subscription"}
                                </Button>
                            ) : (
                                <Button
                                    onClick={() => startStripeSubscription(selectedTier)}
                                    disabled={isConfiguring}
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-lg shadow-indigo-600/20 h-11 px-6 rounded-xl transition-all duration-300 flex items-center gap-2"
                                >
                                    {isConfiguring ? (
                                        <>
                                            <div className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                                            Redirecting to Stripe...
                                        </>
                                    ) : (
                                        <>
                                            Subscribe via Stripe <ArrowUpRight className="h-4 w-4" />
                                        </>
                                    )}
                                </Button>
                            )}
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-slate-200 shadow-sm bg-slate-50 flex flex-col justify-between">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-bold uppercase text-slate-500 tracking-wider flex items-center gap-1.5">
                            <Shield className="h-4 w-4 text-slate-400" />
                            PCI-DSS Level 1 Security
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="text-xs text-slate-600 leading-relaxed">
                        <p>
                            All club subscriptions are processed directly on hosted Stripe Checkout. ClubFlow never touches or stores card numbers.
                        </p>
                        <p className="mt-2 text-indigo-700 font-semibold">
                            ★ Cancel anytime in 1 click with zero hidden exit fees.
                        </p>
                    </CardContent>
                    <CardFooter className="pt-2 border-t border-slate-200/50 text-[10px] text-slate-400">
                        Verified Stripe Subscription Ledger
                    </CardFooter>
                </Card>
            </div>

            <div>
                <h3 className="text-xl font-bold text-foreground mb-6 text-center">
                    Select Your Subscription Plan
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {plans.map((plan) => {
                        const isCurrent = sub.tier === plan.id && sub.isPaymentConfigured;
                        const isSelected = selectedTier === plan.id && !sub.isPaymentConfigured;
                        return (
                            <Card
                                key={plan.id}
                                onClick={() => !sub.isPaymentConfigured && setSelectedTier(plan.id)}
                                className={`flex flex-col border shadow-sm transition-all duration-300 relative ${plan.color} ${
                                    !sub.isPaymentConfigured
                                        ? "cursor-pointer hover:border-slate-400 hover:scale-[1.02]"
                                        : ""
                                } ${isSelected ? "ring-2 ring-indigo-600 border-indigo-600 bg-indigo-50/5" : ""}`}
                            >
                                {plan.badge && (
                                    <span className="absolute -top-3 left-6 bg-indigo-600 text-white font-bold text-[10px] px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow-sm">
                                        {plan.badge}
                                    </span>
                                )}
                                <CardHeader className="pb-4 pt-6">
                                    <CardTitle className="text-lg text-slate-900 font-bold">{plan.name}</CardTitle>
                                    <CardDescription className="text-xs text-slate-500 mt-1 min-h-[32px]">
                                        {plan.description}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="flex-1 space-y-6">
                                    <div>
                                        <span className="text-3xl font-black text-slate-900">£{plan.price}</span>
                                        <span className="text-xs text-slate-500 font-medium"> / month</span>
                                    </div>
                                    <ul className="space-y-2.5 text-xs text-slate-600">
                                        {plan.features.map((feature, i) => (
                                            <li key={i} className="flex items-start gap-2">
                                                <Check className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                                                <span>{feature}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </CardContent>
                                <CardFooter className="pt-4 border-t border-slate-100 bg-slate-50/50 rounded-b-xl">
                                    {isCurrent ? (
                                        <span className="w-full text-center text-xs font-bold text-emerald-700 bg-emerald-100 border border-emerald-200 py-2 rounded-lg flex items-center justify-center gap-1.5">
                                            ✓ Active Subscription
                                        </span>
                                    ) : isSelected ? (
                                        <span className="w-full text-center text-xs font-bold text-indigo-700 bg-indigo-100 border border-indigo-200 py-2 rounded-lg">
                                            ✓ Selected for Billing
                                        </span>
                                    ) : sub.isPaymentConfigured ? (
                                        <Button
                                            onClick={() => startStripeSubscription(plan.id)}
                                            disabled={isConfiguring}
                                            className="w-full bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold py-2 rounded-lg"
                                        >
                                            Upgrade / Switch via Stripe
                                        </Button>
                                    ) : (
                                        <span className="w-full text-center text-xs font-medium text-slate-400 py-2">
                                            Click card to choose
                                        </span>
                                    )}
                                </CardFooter>
                            </Card>
                        );
                    })}
                </div>
            </div>

            <Card className="border-slate-200 shadow-sm">
                <CardHeader className="border-b bg-slate-50/50">
                    <CardTitle className="text-md flex items-center gap-2 text-slate-900">
                        <History className="h-4 w-4 text-slate-500" />
                        Billing Logs (Verified Stripe Audits)
                    </CardTitle>
                    <CardDescription>
                        Server-verified records of your club&apos;s Stripe subscription payments.
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    {paymentHistory.length === 0 ? (
                        <div className="p-8 text-center text-slate-400 italic">
                            No verified Stripe subscription payments recorded yet.
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-white border-b text-xs text-slate-500 uppercase font-semibold">
                                    <tr>
                                        <th className="px-6 py-4">Transaction ID</th>
                                        <th className="px-6 py-4">Date</th>
                                        <th className="px-6 py-4">Tier Plan</th>
                                        <th className="px-6 py-4 text-right">Amount</th>
                                        <th className="px-6 py-4 text-right">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 bg-white">
                                    {paymentHistory.map((p) => (
                                        <tr key={`${p.id}-${p.created_at}`} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="px-6 py-4 font-mono text-xs text-slate-500">#{p.id}</td>
                                            <td className="px-6 py-4 text-slate-600">
                                                <span className="flex items-center gap-1">
                                                    <Calendar className="h-3.5 w-3.5 text-slate-400" />
                                                    {new Date(p.created_at).toLocaleDateString("en-GB")}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 font-semibold text-slate-700">{p.tier} Tier</td>
                                            <td className="px-6 py-4 text-right font-semibold text-slate-900">
                                                £{p.amount.toFixed(2)}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <span
                                                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase ${
                                                        p.status === "paid"
                                                            ? "bg-green-100 text-green-800"
                                                            : "bg-slate-100 text-slate-600"
                                                    }`}
                                                >
                                                    {p.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
