"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useClub } from "@/context/club-context";
import { useAuth } from "@/context/auth-context";
import { supabase } from "@/lib/supabase";
import { 
    Plus, 
    Trash2, 
    Landmark, 
    CheckCircle2, 
    Copy, 
    X,
    Loader2,
    Wallet
} from "lucide-react";

export default function PlayerPaymentsPage() {
    const { settings } = useClub();
    const { clubId, isLoading: isAuthLoading } = useAuth();

    // Data lists
    const [players, setPlayers] = useState<any[]>([]);
    const [paymentRequests, setPaymentRequests] = useState<any[]>([]);
    const [clubDetails, setClubDetails] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    // Modal and form states
    const [isAddPaymentRequestOpen, setIsAddPaymentRequestOpen] = useState(false);
    const [paymentRequestForm, setPaymentRequestForm] = useState({
        playerId: "all",
        amount: "",
        description: ""
    });
    const [isConnectingStripe, setIsConnectingStripe] = useState(false);
    const [toastMessage, setToastMessage] = useState<string | null>(null);

    const triggerToast = (msg: string) => {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(null), 3000);
    };

    const fetchPlayers = async () => {
        const { data } = await supabase
            .from("players")
            .select("id, first_name, last_name")
            .order("first_name");
        if (data) setPlayers(data);
    };

    const fetchPaymentRequests = async () => {
        const { data } = await supabase
            .from('player_payment_requests')
            .select(`
                *,
                players (
                    first_name,
                    last_name
                )
            `)
            .order('created_at', { ascending: false });
        if (data) setPaymentRequests(data);
    };

    const fetchClubDetails = async () => {
        const { data } = await supabase
            .from('clubs')
            .select('*')
            .maybeSingle();
        if (data) setClubDetails(data);
    };

    const loadAllData = async () => {
        setLoading(true);
        await Promise.all([
            fetchPlayers(),
            fetchPaymentRequests(),
            fetchClubDetails()
        ]);
        setLoading(false);
    };

    useEffect(() => {
        if (!isAuthLoading && clubId) {
            loadAllData();
        }
    }, [clubId, isAuthLoading]);

    const handleConnectStripe = async () => {
        setIsConnectingStripe(true);
        try {
            const tokenObj = localStorage.getItem("sb-token");
            const token = tokenObj ? JSON.parse(tokenObj) : null;
            const sessionToken = (await supabase.auth.getSession()).data.session?.access_token;
            const authToken = token || sessionToken;

            const res = await fetch("/api/checkout/connect-onboarding", {
                method: "POST",
                headers: { 
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${authToken}`
                }
            });
            const data = await res.json();
            if (data.url) {
                window.location.href = data.url;
            } else {
                alert(data.error || "Failed to initiate Stripe Connect onboarding.");
            }
        } catch (err: any) {
            console.error("Connect Stripe error:", err);
            alert("Error: " + err.message);
        } finally {
            setIsConnectingStripe(false);
        }
    };

    const handleCreatePaymentRequest = async (e: React.FormEvent) => {
        e.preventDefault();
        const { playerId, amount, description } = paymentRequestForm;

        if (!amount || !description) {
            alert("Please fill in all fields");
            return;
        }

        try {
            const targetClubId = clubId || (supabase as any).activeClubId;

            if (playerId === "all") {
                const payloads = players.map(p => ({
                    club_id: targetClubId,
                    player_id: p.id,
                    amount: Number(amount),
                    description: description,
                    status: "Unpaid"
                }));

                const { error } = await supabase
                    .from("player_payment_requests")
                    .insert(payloads);

                if (error) throw error;
                triggerToast(`Payment requests sent to all ${players.length} players.`);
            } else {
                const payload = {
                    club_id: targetClubId,
                    player_id: playerId,
                    amount: Number(amount),
                    description: description,
                    status: "Unpaid"
                };

                const { error } = await supabase
                    .from("player_payment_requests")
                    .insert([payload]);

                if (error) throw error;
                const playerObj = players.find(p => p.id === playerId);
                triggerToast(`Payment request sent to ${playerObj ? `${playerObj.first_name} ${playerObj.last_name}` : "Player"}.`);
            }

            setIsAddPaymentRequestOpen(false);
            setPaymentRequestForm({ playerId: "all", amount: "", description: "" });
            fetchPaymentRequests();
        } catch (err: any) {
            console.error("Failed to create payment request:", err);
            alert("Error creating payment request: " + err.message);
        }
    };

    const handleDeletePaymentRequest = async (id: string) => {
        if (!confirm("Are you sure you want to cancel this payment request?")) return;
        
        try {
            const { error } = await supabase
                .from("player_payment_requests")
                .delete()
                .eq("id", id);
            
            if (error) throw error;
            triggerToast("Payment request cancelled successfully.");
            fetchPaymentRequests();
        } catch (err: any) {
            console.error("Failed to delete payment request:", err);
            alert("Error deleting payment request: " + err.message);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center p-12 min-h-[400px]">
                <Loader2 className="h-8 w-8 text-indigo-600 animate-spin mb-4" />
                <p className="text-slate-500 text-sm font-semibold">Loading player payments...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 p-6 max-w-6xl mx-auto">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                        <Wallet className="h-6 w-6 text-indigo-600" />
                        Player Payments
                    </h1>
                    <p className="text-xs text-slate-500 mt-1">Manage subs, fees, and collect secure card payments from players.</p>
                </div>
            </div>

            {/* Connect Stripe Banner */}
            {(!clubDetails || !clubDetails.stripe_connect_onboarding_completed) ? (
                <Card className="border-indigo-100 bg-indigo-50/50 shadow-md">
                    <CardContent className="p-6 flex flex-col md:flex-row items-center justify-between gap-6">
                        <div className="space-y-2 text-center md:text-left max-w-xl">
                            <div className="flex items-center gap-2 justify-center md:justify-start">
                                <Landmark className="h-5 w-5 text-indigo-600" />
                                <h3 className="text-base font-bold text-indigo-950">Collect Secure Player Payments</h3>
                            </div>
                            <p className="text-xs text-indigo-900/80 leading-normal">
                                Connect your Stripe account to start requesting and collecting match fees, seasonal subs, and club kit dues. Players pay safely via Stripe Checkout (supporting Apple Pay & Cards) and payments transfer directly to your bank.
                            </p>
                        </div>
                        <Button 
                            onClick={handleConnectStripe}
                            disabled={isConnectingStripe}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-6 py-5 rounded-xl h-11 shrink-0 w-full md:w-auto"
                        >
                            {isConnectingStripe ? (
                                <span className="flex items-center gap-2">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Connecting...
                                </span>
                            ) : (
                                "Connect Stripe Account"
                            )}
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <Card className="border-emerald-100 bg-emerald-50/40 shadow-sm">
                    <CardContent className="p-4 flex items-center justify-between gap-4 text-xs">
                        <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                            <div>
                                <p className="font-bold text-emerald-950">Stripe Connect Connected</p>
                                <p className="text-[10px] text-emerald-800/80">Your club is active to collect secure credit card and mobile wallet payments.</p>
                            </div>
                        </div>
                        <Button 
                            variant="outline" 
                            onClick={handleConnectStripe} 
                            className="h-8 text-[10px] text-slate-700 border-slate-200"
                        >
                            Configure Dashboard
                        </Button>
                    </CardContent>
                </Card>
            )}

            {/* Active Invoices Table */}
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="text-base font-bold text-slate-900">Active Invoices & Requests</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Send secure digital checkouts directly to player mobile wallets.</p>
                </div>
                <Button 
                    disabled={!clubDetails || !clubDetails.stripe_connect_onboarding_completed}
                    onClick={() => setIsAddPaymentRequestOpen(true)}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-2 rounded-xl h-10"
                >
                    <Plus className="h-4 w-4" /> Request Payment
                </Button>
            </div>

            <Card className="border-slate-200 shadow-md">
                <CardContent className="p-0 overflow-x-auto">
                    <table className="w-full text-xs">
                        <thead className="bg-slate-50 border-b text-[10px] font-bold text-slate-400 uppercase">
                            <tr>
                                <th className="text-left p-3">Player</th>
                                <th className="text-left p-3">Description</th>
                                <th className="text-right p-3">Amount</th>
                                <th className="text-center p-3">Status</th>
                                <th className="text-left p-3">Date Requested</th>
                                <th className="text-right p-3">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {paymentRequests.map((req) => (
                                <tr key={req.id} className="hover:bg-slate-50/50">
                                    <td className="p-3 font-semibold text-slate-700">
                                        {req.players ? `${req.players.first_name} ${req.players.last_name}` : "Squad Member"}
                                    </td>
                                    <td className="p-3 text-slate-500">{req.description}</td>
                                    <td className="p-3 text-right font-bold text-slate-900">£{Number(req.amount).toFixed(2)}</td>
                                    <td className="p-3 text-center">
                                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                                            req.status === 'Paid' 
                                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                                                : 'bg-amber-50 text-amber-700 border border-amber-200'
                                        }`}>
                                            {req.status}
                                        </span>
                                    </td>
                                    <td className="p-3 text-slate-400">{new Date(req.created_at).toLocaleDateString()}</td>
                                    <td className="p-3 text-right space-x-1">
                                        {req.status === 'Unpaid' && (
                                            <Button 
                                                size="sm" 
                                                variant="outline"
                                                onClick={() => {
                                                    const payUrl = `${window.location.origin}/pay/${req.id}`;
                                                    navigator.clipboard.writeText(payUrl);
                                                    triggerToast("Copied payment link to clipboard!");
                                                }}
                                                className="h-7 text-[10px] font-bold border-slate-200 text-slate-600"
                                            >
                                                <Copy className="h-3 w-3 mr-1" /> Link
                                            </Button>
                                        )}
                                        {req.status === 'Paid' && req.paid_at && (
                                            <span className="text-[10px] text-slate-400 pr-2">Paid {new Date(req.paid_at).toLocaleDateString()}</span>
                                        )}
                                        <Button 
                                            size="icon" 
                                            variant="ghost" 
                                            onClick={() => handleDeletePaymentRequest(req.id)} 
                                            className="h-7 w-7 text-slate-400 hover:text-red-500"
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                            {paymentRequests.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="text-center p-8 text-slate-400 italic">
                                        No payment requests found. Click "Request Payment" above to create one.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </CardContent>
            </Card>

            {/* Add Payment Request Dialog Modal */}
            {isAddPaymentRequestOpen && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
                    <Card className="w-full max-w-sm border-slate-200 bg-white text-slate-800 shadow-xl overflow-hidden rounded-2xl">
                        <CardHeader className="bg-slate-50 border-b border-slate-100 p-4">
                            <div className="flex justify-between items-center">
                                <CardTitle className="text-sm font-bold">New Payment Request</CardTitle>
                                <Button size="icon" variant="ghost" onClick={() => setIsAddPaymentRequestOpen(false)} className="h-7 w-7"><X className="h-4 w-4" /></Button>
                            </div>
                        </CardHeader>
                        <form onSubmit={handleCreatePaymentRequest}>
                            <CardContent className="p-4 space-y-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold uppercase text-slate-400">Target Player</label>
                                    <select
                                        value={paymentRequestForm.playerId}
                                        onChange={e => setPaymentRequestForm({ ...paymentRequestForm, playerId: e.target.value })}
                                        className="w-full px-3 py-2 border rounded-xl bg-slate-50 h-10 text-xs focus:ring-indigo-500 focus:outline-none"
                                    >
                                        <option value="all">All Players (Bulk Invoice)</option>
                                        {players.map(p => (
                                            <option key={p.id} value={p.id}>
                                                {p.first_name} {p.last_name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold uppercase text-slate-400">Description</label>
                                    <Input 
                                        required
                                        placeholder="e.g. October Match Dues"
                                        value={paymentRequestForm.description}
                                        onChange={e => setPaymentRequestForm({ ...paymentRequestForm, description: e.target.value })}
                                        className="bg-slate-50 border-slate-200 h-10 rounded-xl text-xs"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold uppercase text-slate-400">Amount (£)</label>
                                    <Input 
                                        required
                                        type="number"
                                        step="0.01"
                                        min="1.00"
                                        placeholder="10.00"
                                        value={paymentRequestForm.amount}
                                        onChange={e => setPaymentRequestForm({ ...paymentRequestForm, amount: e.target.value })}
                                        className="bg-slate-50 border-slate-200 h-10 rounded-xl text-xs"
                                    />
                                </div>
                                <Button 
                                    type="submit"
                                    className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold h-11 rounded-xl shadow-md mt-2"
                                >
                                    Send Payment Request
                                </Button>
                            </CardContent>
                        </form>
                    </Card>
                </div>
            )}

            {/* Custom Toast Message alert banner */}
            {toastMessage && (
                <div className="fixed bottom-4 right-4 bg-slate-900 text-white text-xs font-semibold px-4 py-3 rounded-xl shadow-lg z-50 border border-slate-800 animate-slide-in">
                    {toastMessage}
                </div>
            )}
        </div>
    );
}
