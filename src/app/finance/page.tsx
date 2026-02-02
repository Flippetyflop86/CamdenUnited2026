"use client";

import { useState, useEffect } from "react";
import { Sponsor, Subscription, Transaction } from "@/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useClub } from "@/context/club-context";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import {
    Plus,
    Trash2,
    TrendingUp,
    TrendingDown,
    Wallet,
    ArrowRightLeft,
    CheckCircle2,
    Landmark,
    Pencil,
} from "lucide-react";

import { FinanceGate } from "@/components/auth/finance-gate";
import { supabase } from "@/lib/supabase";


export default function FinancePage() {
    const { settings, updateSettings } = useClub();


    // State
    const [sponsors, setSponsors] = useState<Sponsor[]>([]);
    const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]); // Contains both Ledger (History) and Commitments (Templates)
    const [activeTab, setActiveTab] = useState<'overview' | 'planning'>('overview');

    // Derived State
    const ledger = transactions.filter(t => !t.isRecurring);
    const commitments = transactions.filter(t => t.isRecurring);

    // Forms
    const [startBalanceInput, setStartBalanceInput] = useState(settings.financeStartingBalance?.toString() || "0");
    const [isEditingBalance, setIsEditingBalance] = useState(false);

    // Edit Tracking
    const [editingId, setEditingId] = useState<string | null>(null);

    // SPONSOR STATE
    const [isAddSponsorOpen, setIsAddSponsorOpen] = useState(false);
    const [newSponsor, setNewSponsor] = useState<Partial<Sponsor>>({ name: '', amount: 0, frequency: 'Yearly' });

    // SUBSCRIPTION STATE
    const [isAddSubOpen, setIsAddSubOpen] = useState(false);
    const [newSub, setNewSub] = useState<Partial<Subscription>>({ name: '', cost: 0, frequency: 'Monthly', category: 'Other' });

    // RECURRING TX STATE
    const [isAddTxOpen, setIsAddTxOpen] = useState(false);
    const [newTx, setNewTx] = useState<Partial<Transaction>>({
        description: '', amount: 0, type: 'Expense', category: 'Other', isRecurring: true, frequency: 'Weekly'
    });

    // ONE-OFF TX STATE
    const [isAddLedgerItemOpen, setIsAddLedgerItemOpen] = useState(false);
    const [newLedgerItem, setNewLedgerItem] = useState<Partial<Transaction>>({
        description: '', amount: 0, type: 'Expense', category: 'Other', isRecurring: false, date: new Date().toISOString().split('T')[0]
    });

    // ... (keep state) ...

    // Load Data
    useEffect(() => {
        fetchFinanceData();

        // Subscriptions
        const channels = [
            supabase.channel('public:finance_transactions').on('postgres_changes', { event: '*', schema: 'public', table: 'finance_transactions' }, fetchTransactions).subscribe(),
            supabase.channel('public:sponsors').on('postgres_changes', { event: '*', schema: 'public', table: 'sponsors' }, fetchSponsors).subscribe(),
            supabase.channel('public:subscriptions').on('postgres_changes', { event: '*', schema: 'public', table: 'subscriptions' }, fetchSubs).subscribe()
        ];

        return () => {
            channels.forEach(c => supabase.removeChannel(c));
        };
    }, []);

    const fetchFinanceData = async () => {
        setIsEditingBalance(false); // just to reset ui
        await Promise.all([fetchSponsors(), fetchSubs(), fetchTransactions()]);

        // Also sync starting balance from settings if changed remotely
        // (Handled by club-context mainly, but we can respect it here)
        if (settings.financeStartingBalance) {
            setStartBalanceInput(settings.financeStartingBalance.toString());
        }
    }

    const fetchSponsors = async () => {
        const { data } = await supabase.from('sponsors').select('*');
        if (data) setSponsors(data);
    };

    const fetchSubs = async () => {
        const { data } = await supabase.from('subscriptions').select('*');
        if (data) setSubscriptions(data);
    };

    const fetchTransactions = async () => {
        const { data } = await supabase.from('finance_transactions').select('*');
        if (data) {
            const mapped = data.map((t: any) => ({
                id: t.id,
                date: t.date,
                description: t.description,
                amount: t.amount,
                type: t.type,
                category: t.category,
                isRecurring: t.is_recurring,
                frequency: t.frequency
            }));
            setTransactions(mapped);
        }
    };

    // Note: Removed local storage "save" helpers. 
    // We will now write directly to Supabase in the action handlers.

    const handleUpdateBalance = () => {
        updateSettings({ financeStartingBalance: parseFloat(startBalanceInput) });
        setIsEditingBalance(false);
    };

    // Actions - CREATE OR UPDATE
    const saveSponsorForm = async () => {
        if (!newSponsor.name || !newSponsor.amount) return;

        const payload = {
            name: newSponsor.name,
            amount: newSponsor.amount,
            frequency: newSponsor.frequency,
            description: newSponsor.description
        };

        if (editingId) {
            await supabase.from('sponsors').update(payload).eq('id', editingId);
        } else {
            await supabase.from('sponsors').insert([payload]);
        }

        setIsAddSponsorOpen(false);
        setEditingId(null);
        setNewSponsor({ name: '', amount: 0, frequency: 'Yearly' });
    };

    const saveSubscriptionForm = async () => {
        if (!newSub.name || !newSub.cost) return;

        const payload = {
            name: newSub.name,
            cost: newSub.cost,
            frequency: newSub.frequency,
            category: newSub.category
        };

        if (editingId) {
            await supabase.from('subscriptions').update(payload).eq('id', editingId);
        } else {
            await supabase.from('subscriptions').insert([payload]);
        }

        setIsAddSubOpen(false);
        setEditingId(null);
        setNewSub({ name: '', cost: 0, frequency: 'Monthly', category: 'Other' });
    };

    const saveRecurringTransaction = async () => {
        if (!newTx.description || !newTx.amount) return;

        const payload = {
            description: newTx.description,
            amount: newTx.amount,
            type: newTx.type,
            category: newTx.category,
            is_recurring: true,
            frequency: newTx.frequency,
            date: new Date().toISOString() // Required by schema even if recurring template? Schema says not null.
        };

        if (editingId) {
            await supabase.from('finance_transactions').update(payload).eq('id', editingId);
        } else {
            await supabase.from('finance_transactions').insert([payload]);
        }

        setIsAddTxOpen(false);
        setEditingId(null);
        setNewTx({ description: '', amount: 0, type: 'Expense', category: 'Other', isRecurring: true, frequency: 'Weekly' });
    };

    const saveLedgerItem = async () => {
        if (!newLedgerItem.description || !newLedgerItem.amount || !newLedgerItem.date) return;

        const payload = {
            date: newLedgerItem.date,
            description: newLedgerItem.description,
            amount: newLedgerItem.amount,
            type: newLedgerItem.type,
            category: newLedgerItem.category,
            is_recurring: false
        };

        if (editingId) {
            await supabase.from('finance_transactions').update(payload).eq('id', editingId);
        } else {
            await supabase.from('finance_transactions').insert([payload]);
        }

        setIsAddLedgerItemOpen(false);
        setEditingId(null);
        setNewLedgerItem({ description: '', amount: 0, type: 'Expense', category: 'Other', isRecurring: false, date: new Date().toISOString().split('T')[0] });
    };

    // Prepare Edit State
    const editSponsor = (s: Sponsor) => {
        setNewSponsor(s);
        setEditingId(s.id);
        setIsAddSponsorOpen(true);
    };

    const editSubscription = (s: Subscription) => {
        setNewSub(s);
        setEditingId(s.id);
        setIsAddSubOpen(true);
    };

    const editTransaction = (t: Transaction) => {
        if (t.isRecurring) {
            setNewTx(t);
            setEditingId(t.id);
            setIsAddTxOpen(true);
        } else {
            setNewLedgerItem(t);
            setEditingId(t.id);
            setIsAddLedgerItemOpen(true);
        }
    };

    // "Log Payment" - instantiate a recurring item into the ledger
    const logPayment = async (item: Transaction | Sponsor | Subscription, type: 'tx' | 'sponsor' | 'sub') => {
        const date = new Date().toISOString().split('T')[0];
        let payload: any;

        if (type === 'tx') {
            const tx = item as Transaction;
            payload = {
                date,
                description: `${tx.description} (Logged)`,
                amount: tx.amount,
                type: tx.type,
                category: tx.category,
                is_recurring: false
            };
        } else if (type === 'sponsor') {
            const sp = item as Sponsor;
            payload = {
                date,
                description: `Sponsorship: ${sp.name}`,
                amount: sp.amount,
                type: 'Income',
                category: 'Sponsorship',
                is_recurring: false
            };
        } else {
            const sub = item as Subscription;
            payload = {
                date,
                description: `Subscription: ${sub.name}`,
                amount: sub.cost,
                type: 'Expense',
                category: sub.category,
                is_recurring: false
            };
        }

        const { error } = await supabase.from('finance_transactions').insert([payload]);
        if (error) {
            alert("Error logging payment: " + error.message);
        } else {
            alert("Payment logged to Ledger!");
        }
    };

    const deleteItem = async (id: string, type: 'sponsor' | 'sub' | 'tx') => {
        if (!confirm("Delete this item?")) return;

        if (type === 'sponsor') await supabase.from('sponsors').delete().eq('id', id);
        if (type === 'sub') await supabase.from('subscriptions').delete().eq('id', id);
        if (type === 'tx') await supabase.from('finance_transactions').delete().eq('id', id);
    };

    // Calculations
    const calculateMonthly = () => {
        let monthlyIncome = 0;
        let monthlyExpense = 0;

        // Sponsors (amortized)
        sponsors.forEach(s => {
            if (s.frequency === 'Monthly') monthlyIncome += s.amount;
            if (s.frequency === 'Yearly') monthlyIncome += (s.amount / 12);
        });

        // Subs
        subscriptions.forEach(s => {
            if (s.frequency === 'Monthly') monthlyExpense += s.cost;
            if (s.frequency === 'Yearly') monthlyExpense += (s.cost / 12);
        });

        // Recurring Transactions
        commitments.forEach(t => {
            let amount = t.amount;
            if (t.frequency === 'Weekly') amount = t.amount * 4.33; // Avg weeks in month
            if (t.frequency === 'Yearly') amount = t.amount / 12;

            if (t.type === 'Income') monthlyIncome += amount;
            else monthlyExpense += amount;
        });

        return { income: monthlyIncome, expense: monthlyExpense, profit: monthlyIncome - monthlyExpense };
    };

    const calculateBalance = () => {
        let balance = settings.financeStartingBalance || 0;
        ledger.forEach(t => {
            if (t.type === 'Income') balance += t.amount;
            else balance -= t.amount;
        });
        return balance;
    };

    const monthlyTotals = calculateMonthly();
    const currentBalance = calculateBalance();



    return (
        <FinanceGate>
            <div className="space-y-6 pb-12">

                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h2 className="text-3xl font-bold tracking-tight text-slate-900">Finance Hub</h2>
                        <p className="text-slate-500">Manage club finances, cash flow, and forecast.</p>
                    </div>
                    <div className="flex gap-2">

                        <Button onClick={() => {
                            setEditingId(null);
                            setNewLedgerItem({ description: '', amount: 0, type: 'Expense', category: 'Other', isRecurring: false, date: new Date().toISOString().split('T')[0] });
                            setIsAddLedgerItemOpen(true);
                        }}
                            className="bg-blue-600 hover:bg-blue-700 text-white">
                            <ArrowRightLeft className="h-4 w-4 mr-2" /> One-off Transaction
                        </Button>
                    </div>
                </div>

                {/* LIVE BALANCE SECTION */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Card className="bg-slate-900 text-white border-slate-800 md:col-span-1">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-slate-400">Current Bank Balance</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-baseline gap-2">
                                <span className="text-3xl font-bold">£{currentBalance.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</span>
                            </div>
                            <div className="mt-4 flex items-center justify-between text-xs text-slate-500 border-t border-slate-800 pt-3">
                                {isEditingBalance ? (
                                    <div className="flex items-center gap-2">
                                        <span className="whitespace-nowrap">Start Bal: £</span>
                                        <Input
                                            type="number"
                                            className="h-6 w-24 bg-slate-800 border-slate-700 text-white"
                                            value={startBalanceInput}
                                            onChange={(e) => setStartBalanceInput(e.target.value)}
                                        />
                                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0 hover:text-green-400" onClick={handleUpdateBalance}>
                                            <CheckCircle2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-1 cursor-pointer hover:text-slate-300 transition-colors" onClick={() => setIsEditingBalance(true)}>
                                        <Landmark className="h-3 w-3" />
                                        <span>Starting Balance: £{settings.financeStartingBalance?.toLocaleString() || 0}</span>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="md:col-span-2">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-slate-500">Projected Monthly Cash Flow (Recurring)</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <div className="text-sm font-medium text-green-600 mb-1 flex items-center gap-1">
                                        <TrendingUp className="h-3 w-3" /> Income
                                    </div>
                                    <div className="text-xl font-bold">£{monthlyTotals.income.toFixed(2)}</div>
                                </div>
                                <div>
                                    <div className="text-sm font-medium text-red-600 mb-1 flex items-center gap-1">
                                        <TrendingDown className="h-3 w-3" /> Expenses
                                    </div>
                                    <div className="text-xl font-bold">£{monthlyTotals.expense.toFixed(2)}</div>
                                </div>
                                <div>
                                    <div className="text-sm font-medium text-slate-500 mb-1 flex items-center gap-1">
                                        <Wallet className="h-3 w-3" /> Net
                                    </div>
                                    <div className={`text-xl font-bold ${monthlyTotals.profit >= 0 ? "text-green-700" : "text-red-700"}`}>
                                        {monthlyTotals.profit >= 0 ? "+" : ""}£{monthlyTotals.profit.toFixed(2)}
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
                    <TabsList className="grid w-full grid-cols-2 lg:w-[400px]">
                        <TabsTrigger value="overview">Ledger (History)</TabsTrigger>
                        <TabsTrigger value="planning">Commitments (Regular)</TabsTrigger>
                    </TabsList>

                    {/* TRANSACTION LEDGER */}
                    <TabsContent value="overview" className="mt-6 space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Transaction Ledger</CardTitle>
                                <CardDescription>History of all actual income and expenditure.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="rounded-md border">
                                    <table className="w-full text-sm">
                                        <thead className="bg-slate-50 border-b">
                                            <tr className="text-left text-xs font-medium text-slate-500 uppercase">
                                                <th className="px-4 py-3">Date</th>
                                                <th className="px-4 py-3">Description</th>
                                                <th className="px-4 py-3">Category</th>
                                                <th className="px-4 py-3 text-right">Amount</th>
                                                <th className="px-4 py-3 text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {ledger.length === 0 && (
                                                <tr>
                                                    <td colSpan={5} className="px-4 py-8 text-center text-slate-400 italic">No transactions recorded yet.</td>
                                                </tr>
                                            )}
                                            {ledger
                                                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                                                .map(t => (
                                                    <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                                                        <td className="px-4 py-3 font-mono text-xs">{t.date}</td>
                                                        <td className="px-4 py-3 font-medium">{t.description}</td>
                                                        <td className="px-4 py-3">
                                                            <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-slate-100 text-slate-700 hover:bg-slate-200/80">
                                                                {t.category}
                                                            </span>
                                                        </td>
                                                        <td className={`px-4 py-3 text-right font-bold ${t.type === 'Income' ? 'text-green-600' : 'text-red-600'}`}>
                                                            {t.type === 'Income' ? '+' : '-'}£{t.amount}
                                                        </td>
                                                        <td className="px-4 py-3 text-right flex justify-end gap-1">
                                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-blue-500" onClick={() => editTransaction(t)}>
                                                                <Pencil className="h-3 w-3" />
                                                            </Button>
                                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-500" onClick={() => deleteItem(t.id, 'tx')}>
                                                                <Trash2 className="h-3 w-3" />
                                                            </Button>
                                                        </td>
                                                    </tr>
                                                ))}
                                        </tbody>
                                    </table>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* PLANNING & COMMITMENTS */}
                    <TabsContent value="planning" className="mt-6">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Recurring Income/Expenses */}
                            <Card className="lg:col-span-2">
                                <CardHeader className="flex flex-row items-center justify-between">
                                    <div>
                                        <CardTitle>Regular Commitments</CardTitle>
                                        <CardDescription>Recurring income and expenses (e.g. pitch hire, match fees)</CardDescription>
                                    </div>
                                    <Button variant="outline" size="sm" onClick={() => {
                                        setEditingId(null);
                                        setNewTx({ description: '', amount: 0, type: 'Expense', category: 'Other', isRecurring: true, frequency: 'Weekly' });
                                        setIsAddTxOpen(true);
                                    }}>
                                        <Plus className="h-4 w-4 mr-2" /> Add Regular Item
                                    </Button>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-1">
                                        {commitments.length === 0 && <p className="text-sm text-slate-400 italic p-4">No regular commitments.</p>}
                                        {commitments.map(t => (
                                            <div key={t.id} className="group flex items-center justify-between p-3 hover:bg-slate-50 rounded-lg border border-transparent hover:border-slate-100 transition-all">
                                                <div className="flex items-center gap-3">
                                                    <div className={`h-8 w-8 rounded-full flex items-center justify-center ${t.type === 'Income' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                                                        {t.type === 'Income' ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                                                    </div>
                                                    <div>
                                                        <p className="font-medium text-sm text-slate-900">{t.description}</p>
                                                        <p className="text-xs text-slate-500">{t.frequency} • {t.category}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className={`font-bold text-sm ${t.type === 'Income' ? 'text-green-600' : 'text-red-600'}`}>
                                                        £{t.amount}
                                                    </span>
                                                    <div className="flex gap-1 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => logPayment(t, 'tx')}>
                                                            Log Payment
                                                        </Button>
                                                        <Button size="icon" variant="ghost" className="h-7 w-7 text-slate-400 hover:text-blue-500" onClick={() => editTransaction(t)}>
                                                            <Pencil className="h-3 w-3" />
                                                        </Button>
                                                        <Button size="icon" variant="ghost" className="h-7 w-7 text-red-400" onClick={() => deleteItem(t.id, 'tx')}>
                                                            <Trash2 className="h-3 w-3" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>

                            {/* SPONSORS */}
                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between">
                                    <div>
                                        <CardTitle>Sponsors</CardTitle>
                                        <CardDescription>Active sponsorships</CardDescription>
                                    </div>
                                    <Button variant="outline" size="sm" onClick={() => {
                                        setEditingId(null);
                                        setNewSponsor({ name: '', amount: 0, frequency: 'Yearly' });
                                        setIsAddSponsorOpen(true);
                                    }}>
                                        <Plus className="h-4 w-4" />
                                    </Button>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-2">
                                        {sponsors.map(s => (
                                            <div key={s.id} className="group flex justify-between items-center text-sm p-2 hover:bg-slate-50 rounded">
                                                <div>
                                                    <p className="font-medium">{s.name}</p>
                                                    <p className="text-xs text-slate-500">{s.frequency}</p>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-green-600">£{s.amount}</span>
                                                    <Button size="sm" variant="outline" className="h-6 text-[10px] px-2 opacity-0 group-hover:opacity-100" onClick={() => logPayment(s, 'sponsor')}>
                                                        Log Paid
                                                    </Button>
                                                    <Button size="icon" variant="ghost" className="h-6 w-6 text-slate-400 hover:text-blue-500 opacity-0 group-hover:opacity-100" onClick={() => editSponsor(s)}>
                                                        <Pencil className="h-3 w-3" />
                                                    </Button>
                                                    <Button size="icon" variant="ghost" className="h-6 w-6 text-red-400 opacity-0 group-hover:opacity-100" onClick={() => deleteItem(s.id, 'sponsor')}>
                                                        <Trash2 className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>

                            {/* SUBSCRIPTIONS */}
                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between">
                                    <div>
                                        <CardTitle>Subscriptions</CardTitle>
                                        <CardDescription>Recurring fees</CardDescription>
                                    </div>
                                    <Button variant="outline" size="sm" onClick={() => {
                                        setEditingId(null);
                                        setNewSub({ name: '', cost: 0, frequency: 'Monthly', category: 'Other' });
                                        setIsAddSubOpen(true);
                                    }}>
                                        <Plus className="h-4 w-4" />
                                    </Button>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-2">
                                        {subscriptions.map(s => (
                                            <div key={s.id} className="group flex justify-between items-center text-sm p-2 hover:bg-slate-50 rounded">
                                                <div>
                                                    <p className="font-medium">{s.name}</p>
                                                    <p className="text-xs text-slate-500">{s.frequency}</p>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-slate-700">£{s.cost}</span>
                                                    <Button size="sm" variant="outline" className="h-6 text-[10px] px-2 opacity-0 group-hover:opacity-100" onClick={() => logPayment(s, 'sub')}>
                                                        Log Paid
                                                    </Button>
                                                    <Button size="icon" variant="ghost" className="h-6 w-6 text-slate-400 hover:text-blue-500 opacity-0 group-hover:opacity-100" onClick={() => editSubscription(s)}>
                                                        <Pencil className="h-3 w-3" />
                                                    </Button>
                                                    <Button size="icon" variant="ghost" className="h-6 w-6 text-red-400 opacity-0 group-hover:opacity-100" onClick={() => deleteItem(s.id, 'sub')}>
                                                        <Trash2 className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </TabsContent>
                </Tabs>

                {/* MODALS - Simplified Overlays */}

                {/* RECURRING ITEM MODAL */}
                {isAddTxOpen && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                        <Card className="w-full max-w-md animate-in fade-in zoom-in-95 duration-200">
                            <CardHeader><CardTitle>{editingId ? 'Edit' : 'Add'} Regular Commitment</CardTitle></CardHeader>
                            <CardContent className="space-y-3">
                                <Input placeholder="Description (e.g. Pitch Hire)" value={newTx.description} onChange={e => setNewTx({ ...newTx, description: e.target.value })} />
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-bold">£</span>
                                    <Input type="number" placeholder="Amount" value={newTx.amount || ''} onChange={e => setNewTx({ ...newTx, amount: parseFloat(e.target.value) })} />
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                        value={newTx.type} onChange={e => setNewTx({ ...newTx, type: e.target.value as any, category: 'Other' })}>
                                        <option value="Income">Income</option>
                                        <option value="Expense">Expense</option>
                                    </select>
                                    <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                        value={newTx.frequency} onChange={e => setNewTx({ ...newTx, frequency: e.target.value as any })}>
                                        <option value="Weekly">Weekly</option>
                                        <option value="Monthly">Monthly</option>
                                        <option value="Yearly">Yearly</option>
                                    </select>
                                </div>
                                <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                    value={newTx.category} onChange={e => setNewTx({ ...newTx, category: e.target.value as any })}>
                                    {newTx.type === 'Income' ? (
                                        <>
                                            <option value="Sponsorship">Sponsorship</option>
                                            <option value="Loans">Loans</option>
                                            <option value="Government Grants">Government Grants</option>
                                            <option value="College Programme">College Programme</option>
                                            <option value="Other">Other</option>
                                        </>
                                    ) : (
                                        <>
                                            <option value="Market Road Pitch Hire">Market Road Pitch Hire</option>
                                            <option value="MCFL Pitch Hire">MCFL Pitch Hire</option>
                                            <option value="Training Pitch Fees">Training Pitch Fees</option>
                                            <option value="Officials">Officials</option>
                                            <option value="Public Liability Insurance">Public Liability Insurance</option>
                                            <option value="Food">Food</option>
                                            <option value="Yellow Card Fine">Yellow Card Fine</option>
                                            <option value="Red Card Fine">Red Card Fine</option>
                                            <option value="Misconduct Fine">Misconduct Fine</option>
                                            <option value="Admin Fine">Admin Fine</option>
                                            <option value="Match Fee">Match Fee</option>
                                            <option value="Other">Other</option>
                                        </>
                                    )}
                                </select>
                                <div className="flex justify-end gap-2 mt-4">
                                    <Button variant="outline" onClick={() => setIsAddTxOpen(false)}>Cancel</Button>
                                    <Button onClick={saveRecurringTransaction}>{editingId ? 'Update' : 'Save'} Commitment</Button>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}

                {/* ONE-OFF LEDGER ITEM MODAL */}
                {isAddLedgerItemOpen && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                        <Card className="w-full max-w-md animate-in fade-in zoom-in-95 duration-200">
                            <CardHeader><CardTitle>{editingId ? 'Edit' : 'Add'} One-off Transaction</CardTitle></CardHeader>
                            <CardContent className="space-y-3">
                                <Input placeholder="Description (e.g. New Balls)" value={newLedgerItem.description} onChange={e => setNewLedgerItem({ ...newLedgerItem, description: e.target.value })} />
                                <div className="grid grid-cols-2 gap-2">
                                    <Input type="date" value={newLedgerItem.date} onChange={e => setNewLedgerItem({ ...newLedgerItem, date: e.target.value })} />
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-bold">£</span>
                                        <Input type="number" placeholder="Amount" value={newLedgerItem.amount || ''} onChange={e => setNewLedgerItem({ ...newLedgerItem, amount: parseFloat(e.target.value) })} />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                        value={newLedgerItem.type} onChange={e => setNewLedgerItem({ ...newLedgerItem, type: e.target.value as any, category: 'Other' })}>
                                        <option value="Expense">Expense</option>
                                        <option value="Income">Income</option>
                                    </select>
                                    <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                        value={newLedgerItem.category} onChange={e => setNewLedgerItem({ ...newLedgerItem, category: e.target.value as any })}>
                                        {newLedgerItem.type === 'Income' ? (
                                            <>
                                                <option value="Sponsorship">Sponsorship</option>
                                                <option value="Loans">Loans</option>
                                                <option value="Government Grants">Government Grants</option>
                                                <option value="College Programme">College Programme</option>
                                                <option value="Other">Other</option>
                                            </>
                                        ) : (
                                            <>
                                                <option value="Market Road Pitch Hire">Market Road Pitch Hire</option>
                                                <option value="MCFL Pitch Hire">MCFL Pitch Hire</option>
                                                <option value="Training Pitch Fees">Training Pitch Fees</option>
                                                <option value="Officials">Officials</option>
                                                <option value="Public Liability Insurance">Public Liability Insurance</option>
                                                <option value="Food">Food</option>
                                                <option value="Kit">Kit / Equipment</option>
                                                <option value="Yellow Card Fine">Yellow Card Fine</option>
                                                <option value="Red Card Fine">Red Card Fine</option>
                                                <option value="Misconduct Fine">Misconduct Fine</option>
                                                <option value="Admin Fine">Admin Fine</option>
                                                <option value="Match Fee">Match Fee</option>
                                                <option value="Other">Other</option>
                                            </>
                                        )}
                                    </select>
                                </div>
                                <div className="flex justify-end gap-2 mt-4">
                                    <Button variant="outline" onClick={() => setIsAddLedgerItemOpen(false)}>Cancel</Button>
                                    <Button onClick={saveLedgerItem}>{editingId ? 'Update' : 'Add'} Transaction</Button>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}

                {isAddSponsorOpen && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                        <Card className="w-full max-w-md animate-in fade-in zoom-in-95 duration-200">
                            <CardHeader><CardTitle>{editingId ? 'Edit' : 'Add'} Sponsor</CardTitle></CardHeader>
                            <CardContent className="space-y-3">
                                <Input placeholder="Sponsor Name" value={newSponsor.name} onChange={e => setNewSponsor({ ...newSponsor, name: e.target.value })} />
                                <Input type="number" placeholder="Amount (£)" value={newSponsor.amount || ''} onChange={e => setNewSponsor({ ...newSponsor, amount: parseFloat(e.target.value) })} />
                                <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                    value={newSponsor.frequency} onChange={e => setNewSponsor({ ...newSponsor, frequency: e.target.value as any })}>
                                    <option value="One-off">One-off Payment</option>
                                    <option value="Monthly">Monthly</option>
                                    <option value="Yearly">Yearly</option>
                                </select>
                                <div className="flex justify-end gap-2 mt-4">
                                    <Button variant="outline" onClick={() => setIsAddSponsorOpen(false)}>Cancel</Button>
                                    <Button onClick={saveSponsorForm}>{editingId ? 'Update' : 'Save'} Sponsor</Button>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}

                {isAddSubOpen && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                        <Card className="w-full max-w-md animate-in fade-in zoom-in-95 duration-200">
                            <CardHeader><CardTitle>{editingId ? 'Edit' : 'Add'} Subscription</CardTitle></CardHeader>
                            <CardContent className="space-y-3">
                                <Input placeholder="Subscription Name" value={newSub.name} onChange={e => setNewSub({ ...newSub, name: e.target.value })} />
                                <Input type="number" placeholder="Cost (£)" value={newSub.cost || ''} onChange={e => setNewSub({ ...newSub, cost: parseFloat(e.target.value) })} />
                                <div className="grid grid-cols-2 gap-2">
                                    <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                        value={newSub.frequency} onChange={e => setNewSub({ ...newSub, frequency: e.target.value as any })}>
                                        <option value="Monthly">Monthly</option>
                                        <option value="Yearly">Yearly</option>
                                    </select>
                                    <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                        value={newSub.category} onChange={e => setNewSub({ ...newSub, category: e.target.value as any })}>
                                        <option value="Software">Software</option>
                                        <option value="League">League</option>
                                        <option value="Insurance">Insurance</option>
                                        <option value="Other">Other</option>
                                    </select>
                                </div>
                                <div className="flex justify-end gap-2 mt-4">
                                    <Button variant="outline" onClick={() => setIsAddSubOpen(false)}>Cancel</Button>
                                    <Button onClick={saveSubscriptionForm}>{editingId ? 'Update' : 'Save'} Subscription</Button>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}

            </div>
        </FinanceGate>
    );
}
