"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { useClub } from "@/context/club-context";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CreditCard, CheckCircle2, AlertCircle, Calendar, ArrowUpRight, History } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface PaymentLog {
    id: string;
    amount: number;
    status: string;
    created_at: string;
    stripe_subscription_id: string | null;
}

export default function BillingPage() {
    const searchParams = useSearchParams();
    const paymentStatus = searchParams.get("payment");

    const { user, session } = useAuth();
    const { settings } = useClub();

    const [payments, setPayments] = useState<PaymentLog[]>([]);
    const [isLoadingPayments, setIsLoadingPayments] = useState(true);
    const [isCheckingOut, setIsCheckingOut] = useState(false);
    const [checkoutError, setCheckoutError] = useState("");

    // Active subscription status
    const hasActiveSubscription = payments.some(p => p.status === 'paid' && p.stripe_subscription_id !== null);

    useEffect(() => {
        if (user) {
            fetchPayments();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user]);

    const fetchPayments = async () => {
        setIsLoadingPayments(true);
        try {
            const { data, error } = await supabase
                .from('club_payments')
                .select('id, amount, status, created_at, stripe_subscription_id')
                .order('created_at', { ascending: false });

            if (error) throw error;
            if (data) setPayments(data);
        } catch (err: any) {
            console.error("Error fetching payment history:", err.message);
        } finally {
            setIsLoadingPayments(false);
        }
    };

    const handleStartCheckout = async () => {
        if (!session) return;
        setIsCheckingOut(true);
        setCheckoutError("");
        try {
            const res = await fetch("/api/checkout", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${session.access_token}`
                }
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to initiate payment");

            if (data.url) {
                // Redirect user to Stripe Checkout
                window.location.href = data.url;
            } else {
                throw new Error("No checkout URL returned from server.");
            }
        } catch (err: any) {
            setCheckoutError(err.message || "An unexpected error occurred. Please try again.");
            setIsCheckingOut(false);
        }
    };

    return (
        <div className="space-y-6 max-w-4xl pb-12">
            <div>
                <h2 className="text-3xl font-bold tracking-tight text-slate-900">Membership & Billing</h2>
                <p className="text-slate-500">Manage your club fees and subscription payments securely with Stripe.</p>
            </div>

            {/* Banners from checkout redirect */}
            {paymentStatus === "success" && (
                <Alert className="border-green-200 bg-green-50 text-green-800">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    <AlertTitle className="font-semibold">Payment Successful!</AlertTitle>
                    <AlertDescription>
                        Thank you! Your monthly membership subscription has been successfully activated.
                    </AlertDescription>
                </Alert>
            )}

            {paymentStatus === "cancelled" && (
                <Alert className="border-amber-200 bg-amber-50 text-amber-800">
                    <AlertCircle className="h-5 w-5 text-amber-600" />
                    <AlertTitle className="font-semibold">Checkout Cancelled</AlertTitle>
                    <AlertDescription>
                        The subscription checkout was cancelled. No charges were made.
                    </AlertDescription>
                </Alert>
            )}

            {checkoutError && (
                <Alert variant="destructive" className="bg-red-50 border-red-200 text-red-800">
                    <AlertCircle className="h-5 w-5 text-red-600" />
                    <AlertTitle className="font-semibold">Checkout Failed</AlertTitle>
                    <AlertDescription>{checkoutError}</AlertDescription>
                </Alert>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Subscription Status Card */}
                <Card className="md:col-span-2 border-slate-200 shadow-sm relative overflow-hidden">
                    <CardHeader className="pb-4">
                        <CardTitle className="text-lg text-slate-900 flex items-center gap-2">
                            <CreditCard className="h-5 w-5 text-slate-500" />
                            Current Subscription Status
                        </CardTitle>
                        <CardDescription>Your membership access details.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="flex items-center gap-4 p-4 rounded-xl border bg-slate-50/50">
                            <div className={`h-12 w-12 rounded-full flex items-center justify-center shrink-0 ${
                                hasActiveSubscription ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600"
                            }`}>
                                {hasActiveSubscription ? <CheckCircle2 className="h-6 w-6" /> : <AlertCircle className="h-6 w-6" />}
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-slate-900">
                                    {hasActiveSubscription ? "Active Membership Subscription" : "Subscription Required"}
                                </p>
                                <p className="text-xs text-slate-500">
                                    {hasActiveSubscription 
                                        ? "Your account has active billing and full access privileges." 
                                        : "Please set up your monthly payment to retain access to all club pages."
                                    }
                                </p>
                            </div>
                        </div>

                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-2">
                            <div>
                                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Monthly Membership Fee</p>
                                <p className="text-2xl font-extrabold text-slate-900 mt-0.5">
                                    £{(settings?.monthlySubs || 0).toFixed(2)} <span className="text-xs font-normal text-slate-500">/ month</span>
                                </p>
                            </div>

                            {!hasActiveSubscription && (
                                <Button 
                                    onClick={handleStartCheckout} 
                                    disabled={isCheckingOut || (settings?.monthlySubs || 0) <= 0}
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium shadow-md flex items-center gap-2 h-11 px-6 rounded-lg"
                                >
                                    {isCheckingOut ? (
                                        <>
                                            <div className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                                            Redirecting to Stripe...
                                        </>
                                    ) : (
                                        <>
                                            Pay Membership Fee <ArrowUpRight className="h-4 w-4" />
                                        </>
                                    )}
                                </Button>
                            )}
                            
                            {hasActiveSubscription && (
                                <span className="text-xs text-slate-500 border border-slate-200 px-3 py-1.5 rounded-full font-medium bg-slate-100">
                                    ✓ Managed via Stripe
                                </span>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Quick Info Card */}
                <Card className="border-slate-200 shadow-sm bg-indigo-50/20 border-indigo-100/50">
                    <CardHeader>
                        <CardTitle className="text-md font-semibold text-slate-800">Secure Payments</CardTitle>
                    </CardHeader>
                    <CardContent className="text-xs text-slate-600 space-y-3 leading-relaxed">
                        <p>We partner with <strong>Stripe</strong> for secure billing. Your payment information is encrypted and never stored on our servers.</p>
                        <p>If you need to change your card details or cancel your subscription, it can be managed directly on Stripe's billing portal.</p>
                        <div className="pt-2 border-t border-slate-200/50 text-[10px] text-slate-400">
                            By paying, you agree to Camden United's code of conduct.
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Payment History */}
            <Card className="border-slate-200 shadow-sm">
                <CardHeader className="border-b bg-slate-50/50">
                    <CardTitle className="text-md flex items-center gap-2">
                        <History className="h-4 w-4 text-slate-500" />
                        Billing History
                    </CardTitle>
                    <CardDescription>View your past payment logs.</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    {isLoadingPayments ? (
                        <div className="p-8 text-center text-slate-500">
                            <div className="h-6 w-6 mx-auto rounded-full border-2 border-indigo-600 border-t-transparent animate-spin mb-2" />
                            Loading billing history...
                        </div>
                    ) : payments.length === 0 ? (
                        <div className="p-8 text-center text-slate-500 italic">No payments recorded yet.</div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-white border-b text-xs text-slate-500 uppercase font-semibold">
                                    <tr>
                                        <th className="px-6 py-4">Transaction ID</th>
                                        <th className="px-6 py-4">Date</th>
                                        <th className="px-6 py-4 text-right">Amount</th>
                                        <th className="px-6 py-4 text-right">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 bg-white">
                                    {payments.map((p) => (
                                        <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="px-6 py-4 font-mono text-xs text-slate-500">
                                                #{p.id.substring(0, 8)}...
                                            </td>
                                            <td className="px-6 py-4 text-slate-600">
                                                <span className="flex items-center gap-1">
                                                    <Calendar className="h-3.5 w-3.5 text-slate-400" />
                                                    {new Date(p.created_at).toLocaleDateString()}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right font-semibold text-slate-900">
                                                £{p.amount.toFixed(2)}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase ${
                                                    p.status === 'paid' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                                }`}>
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
