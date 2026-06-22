"use client";

import { useState, useEffect } from "react";
import { Sponsor, Subscription, Transaction } from "@/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useClub } from "@/context/club-context";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';

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
    Users,
    Paperclip,
    Download,
    Printer,
    ArrowUpRight,
    AlertTriangle,
    FileText,
    Share2,
    UploadCloud
} from "lucide-react";

import { supabase } from "@/lib/supabase";

export default function FinancePage() {
    const { settings, updateSettings } = useClub();


    // State
    const [sponsors, setSponsors] = useState<Sponsor[]>([]);
    const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]); // Contains both Ledger (History) and Commitments (Templates)
    const [wages, setWages] = useState<{ id: string, name: string, amount: number, frequency: string, type: 'Player' | 'Staff' }[]>([]);
    const [activeTab, setActiveTab] = useState<'overview' | 'planning'>('planning');

    const [playersList, setPlayersList] = useState<{ id: string, name: string, subAmount: number }[]>([]);
    const [selectedInvoiceSponsor, setSelectedInvoiceSponsor] = useState<Sponsor | null>(null);
    
    // Sliders for Projection Simulation
    const [simSponsorsCount, setSimSponsorsCount] = useState<number>(0);
    const [simPlayersCount, setSimPlayersCount] = useState<number>(0);
    const [simInflationRate, setSimInflationRate] = useState<number>(0); 
    
    // Budget caps state
    const [budgetCaps, setBudgetCaps] = useState<Record<string, number>>({
        'Market Road Pitch Hire': 250,
        'MCFL Pitch Hire': 300,
        'Training Pitch Fees': 200,
        'Officials': 150,
        'Kit': 400,
        'Other': 200
    });
    const [editingBudgetCategory, setEditingBudgetCategory] = useState<string | null>(null);
    const [editingBudgetValue, setEditingBudgetValue] = useState<number>(0);

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
        description: '', amount: 0, type: 'Expense', category: 'Other', isRecurring: false, date: new Date().toISOString().split('T')[0], receiptUrl: '', receiptName: ''
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
        await Promise.all([fetchSponsors(), fetchSubs(), fetchTransactions(), fetchWages(), fetchPlayers()]);

        // Also sync starting balance from settings if changed remotely
        // (Handled by club-context mainly, but we can respect it here)
        if (settings.financeStartingBalance) {
            setStartBalanceInput(settings.financeStartingBalance.toString());
        }
    }

    const fetchPlayers = async () => {
        const { data } = await supabase.from('players').select('id, first_name, last_name, contract_amount, contract_frequency');
        if (data) {
            setPlayersList(data.map((p: any) => ({
                id: p.id,
                name: `${p.first_name} ${p.last_name}`,
                subAmount: p.contract_amount || 0
            })));
        }
    };

    const fetchSponsors = async () => {
        const { data } = await supabase.from('sponsors').select('*');
        if (data) setSponsors(data.map((s: any) => ({ ...s, status: s.status || 'Secured' })));
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
                frequency: t.frequency,
                receiptUrl: t.receipt_url,
                receiptName: t.receipt_name
            }));
            setTransactions(mapped);
        }
    };

    const fetchWages = async () => {
        try {
            const [{ data: players }, { data: staff }] = await Promise.all([
                supabase.from('players').select('id, first_name, last_name, contract_amount, contract_frequency').eq('is_contracted', true),
                supabase.from('staff').select('id, name, contract_amount, contract_frequency').eq('is_contracted', true)
            ]);

            const allWages: any[] = [];
            if (players) {
                players.forEach((p: any) => allWages.push({ id: `p_${p.id}`, name: `${p.first_name} ${p.last_name}`, amount: p.contract_amount, frequency: p.contract_frequency || 'Weekly', type: 'Player' }));
            }
            if (staff) {
                staff.forEach((s: any) => allWages.push({ id: `s_${s.id}`, name: s.name, amount: s.contract_amount, frequency: s.contract_frequency || 'Monthly', type: 'Staff' }));
            }
            setWages(allWages);
        } catch (e) {
            console.error("Error fetching wages:", e);
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
            description: newSponsor.description,
            status: newSponsor.status || 'Secured'
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
            is_recurring: false,
            receipt_url: newLedgerItem.receiptUrl || null,
            receipt_name: newLedgerItem.receiptName || null
        };

        if (editingId) {
            await supabase.from('finance_transactions').update(payload).eq('id', editingId);
        } else {
            await supabase.from('finance_transactions').insert([payload]);
        }

        setIsAddLedgerItemOpen(false);
        setEditingId(null);
        setNewLedgerItem({ description: '', amount: 0, type: 'Expense', category: 'Other', isRecurring: false, date: new Date().toISOString().split('T')[0], receiptUrl: '', receiptName: '' });
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
            if (s.status === 'Secured') {
                if (s.frequency === 'Monthly') monthlyIncome += s.amount;
                if (s.frequency === 'Yearly') monthlyIncome += (s.amount / 12);
            }
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

        // Wages
        wages.forEach(w => {
            let amount = w.amount || 0;
            if (w.frequency === 'Weekly') monthlyExpense += (amount * 52) / 12; // Precise monthly average
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

    const calculateSimulatedMonthly = () => {
        let monthlyIncome = 0;
        let monthlyExpense = 0;

        // Standard Secured Sponsors
        sponsors.forEach(s => {
            if (s.status === 'Secured') {
                if (s.frequency === 'Monthly') monthlyIncome += s.amount;
                if (s.frequency === 'Yearly') monthlyIncome += (s.amount / 12);
            }
        });

        // Extra Sponsors: +£1000/yr each
        monthlyIncome += simSponsorsCount * (1000 / 12);

        // Standard Subs
        subscriptions.forEach(s => {
            if (s.frequency === 'Monthly') monthlyExpense += s.cost;
            if (s.frequency === 'Yearly') monthlyExpense += (s.cost / 12);
        });

        // Extra Players: +£10/mo each
        monthlyIncome += simPlayersCount * 10;

        // Recurring Transactions (with inflation adjustment for Pitch Hire)
        commitments.forEach(t => {
            let amount = t.amount;
            if (t.frequency === 'Weekly') amount = t.amount * 4.33;
            if (t.frequency === 'Yearly') amount = t.amount / 12;

            const isPitchHire = t.category === 'Market Road Pitch Hire' || t.category === 'MCFL Pitch Hire' || t.category === 'Training Pitch Fees';
            if (isPitchHire && t.type === 'Expense') {
                amount = amount * (1 + (simInflationRate / 100));
            }

            if (t.type === 'Income') monthlyIncome += amount;
            else monthlyExpense += amount;
        });

        // Wages
        wages.forEach(w => {
            let amount = w.amount || 0;
            if (w.frequency === 'Weekly') monthlyExpense += (amount * 52) / 12;
            else monthlyExpense += amount;
        });

        return { income: monthlyIncome, expense: monthlyExpense, profit: monthlyIncome - monthlyExpense };
    };

    const getCategoryBreakdown = () => {
        const incomeMap: Record<string, number> = {};
        const expenseMap: Record<string, number> = {};
        let totalIncome = 0;
        let totalExpense = 0;

        ledger.forEach(t => {
            if (t.type === 'Income') {
                incomeMap[t.category] = (incomeMap[t.category] || 0) + t.amount;
                totalIncome += t.amount;
            } else {
                expenseMap[t.category] = (expenseMap[t.category] || 0) + t.amount;
                totalExpense += t.amount;
            }
        });

        const sortedIncome = Object.entries(incomeMap)
            .map(([category, amount]) => ({ category, amount, percentage: totalIncome > 0 ? (amount / totalIncome) * 100 : 0 }))
            .sort((a, b) => b.amount - a.amount);

        const sortedExpense = Object.entries(expenseMap)
            .map(([category, amount]) => ({ category, amount, percentage: totalExpense > 0 ? (amount / totalExpense) * 100 : 0 }))
            .sort((a, b) => b.amount - a.amount);

        return { income: sortedIncome, expense: sortedExpense, totalIncome, totalExpense };
    };

    const getPlayerDuesStatus = (playerName: string, subAmount: number) => {
        const playerTxs = ledger.filter(t => t.description.toLowerCase().includes(playerName.toLowerCase()));
        
        const paidSubs = playerTxs
            .filter(t => t.type === 'Income' && (t.category === 'Other' || t.description.toLowerCase().includes('sub') || t.description.toLowerCase().includes('fee')))
            .reduce((sum, t) => sum + t.amount, 0);

        let status: 'Paid' | 'Pending' | 'Overdue' = 'Overdue';
        if (subAmount === 0) {
            status = 'Paid';
        } else if (paidSubs >= subAmount) {
            status = 'Paid';
        } else if (paidSubs > 0) {
            status = 'Pending';
        }

        const fineExpenses = ledger.filter(t => t.type === 'Expense' && t.description.toLowerCase().includes(playerName.toLowerCase()) && t.description.toLowerCase().includes('fine'));
        const finePaid = playerTxs.filter(t => t.type === 'Income' && t.description.toLowerCase().includes('fine'));
        const unpaidFinesCount = Math.max(0, fineExpenses.length - finePaid.length);

        return {
            paidSubs,
            unpaidFinesCount,
            status,
            subAmount
        };
    };

    const copyWhatsAppReminder = (playerName: string, amount: number, type: 'sub' | 'fine') => {
        const text = type === 'sub'
            ? `Hi ${playerName}, just a friendly reminder from Camden United that your subscription of £${amount} is due. You can pay via bank transfer. Thanks!`
            : `Hi ${playerName}, just a reminder that you have an outstanding fine of £${amount} from Camden United. Please clear this as soon as possible. Thanks!`;
        navigator.clipboard.writeText(text);
        alert("WhatsApp reminder template copied to clipboard!");
    };

    const getCategoryCommitments = () => {
        const categorySum: Record<string, number> = {};
        
        commitments.forEach(t => {
            if (t.type === 'Expense') {
                let amount = t.amount;
                if (t.frequency === 'Weekly') amount = t.amount * 4.33;
                if (t.frequency === 'Yearly') amount = t.amount / 12;
                categorySum[t.category] = (categorySum[t.category] || 0) + amount;
            }
        });

        subscriptions.forEach(s => {
            let amount = s.cost;
            if (s.frequency === 'Yearly') amount = s.cost / 12;
            categorySum[s.category] = (categorySum[s.category] || 0) + amount;
        });

        return categorySum;
    };

    const startEditingBudget = (category: string, currentValue: number) => {
        setEditingBudgetCategory(category);
        setEditingBudgetValue(currentValue);
    };

    const saveBudgetCap = () => {
        if (!editingBudgetCategory) return;
        setBudgetCaps(prev => ({
            ...prev,
            [editingBudgetCategory]: editingBudgetValue
        }));
        setEditingBudgetCategory(null);
    };

    const monthlyTotals = calculateMonthly();
    const simulatedTotals = calculateSimulatedMonthly();
    const currentBalance = calculateBalance();

    const projectionData = Array.from({ length: 6 }).map((_, i) => {
        const d = new Date();
        d.setMonth(d.getMonth() + i);
        return {
            name: d.toLocaleString('default', { month: 'short' }),
            Balance: Math.round(currentBalance + (monthlyTotals.profit * i)),
            "Simulated Balance": Math.round(currentBalance + (simulatedTotals.profit * i))
        };
    });

    return (
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
                                    <div className="flex items-center justify-between w-full group">
                                        <div className="flex items-center gap-1">
                                            <Landmark className="h-3 w-3" />
                                            <span>Starting Balance: £{settings.financeStartingBalance?.toLocaleString() || 0}</span>
                                        </div>
                                        <Button size="sm" variant="ghost" className="h-6 px-2 py-0 text-slate-400 opacity-50 group-hover:opacity-100 hover:text-white" onClick={() => setIsEditingBalance(true)}>
                                            <Pencil className="h-3 w-3 mr-1" /> Edit
                                        </Button>
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

                <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="w-full">
                    <TabsList className="w-full justify-start border-b rounded-none h-12 bg-transparent p-0">
                        <TabsTrigger value="planning" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-600 rounded-none h-12 px-6">Commitments (Regular)</TabsTrigger>
                        <TabsTrigger value="overview" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-600 rounded-none h-12 px-6">Ledger (History)</TabsTrigger>
                    </TabsList>

                    {/* TRANSACTION LEDGER */}
                    <TabsContent value="overview" className="mt-6 space-y-6">

                        {/* 6-MONTH PROJECTION CHART & WHAT-IF SIMULATOR */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            <Card className="lg:col-span-2">
                                <CardHeader>
                                    <CardTitle>6-Month Bank Balance Projection</CardTitle>
                                    <CardDescription>Estimated bank balance based on your Current Balance and Projected Monthly Cash Flow.</CardDescription>
                                </CardHeader>
                                <CardContent className="h-72">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={projectionData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
                                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} tickFormatter={(val) => `£${val}`} dx={-10} />
                                            <RechartsTooltip formatter={(value: number, name: string) => [`£${value.toLocaleString()}`, name]} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                                            <Line type="monotone" dataKey="Balance" stroke="#2563eb" name="Current Projected" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                                            <Line type="monotone" dataKey="Simulated Balance" stroke="#ea580c" name="Simulated Projected" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle>What-If Simulation</CardTitle>
                                    <CardDescription>Simulate hypothetical sponsorship, players, and cost inflation on future balance.</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-slate-600 font-medium">Extra Sponsors (+£1k/yr each)</span>
                                            <span className="font-bold text-blue-600">+{simSponsorsCount}</span>
                                        </div>
                                        <input type="range" min="0" max="5" value={simSponsorsCount} onChange={e => setSimSponsorsCount(parseInt(e.target.value))} className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600" />
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-slate-600 font-medium">Registering Players (+£10/mo each)</span>
                                            <span className="font-bold text-blue-600">+{simPlayersCount}</span>
                                        </div>
                                        <input type="range" min="0" max="30" value={simPlayersCount} onChange={e => setSimPlayersCount(parseInt(e.target.value))} className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600" />
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-slate-600 font-medium">Pitch Hire Inflation</span>
                                            <span className={`font-bold ${simInflationRate >= 0 ? 'text-red-600' : 'text-green-600'}`}>{simInflationRate >= 0 ? '+' : ''}{simInflationRate}%</span>
                                        </div>
                                        <input type="range" min="-15" max="50" value={simInflationRate} onChange={e => setSimInflationRate(parseInt(e.target.value))} className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600" />
                                    </div>
                                    <Button variant="outline" size="sm" className="w-full mt-2" onClick={() => { setSimSponsorsCount(0); setSimPlayersCount(0); setSimInflationRate(0); }}>
                                        Reset Simulation
                                    </Button>
                                </CardContent>
                            </Card>
                        </div>

                        {/* CATEGORY BREAKDOWN CHARTS */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Income Category Breakdown</CardTitle>
                                    <CardDescription>Visual share of actual incoming revenue from Ledger.</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    {(() => {
                                        const breakdown = getCategoryBreakdown();
                                        return breakdown.income.length === 0 ? (
                                            <p className="text-sm text-slate-400 italic">No income transactions recorded.</p>
                                        ) : (
                                            breakdown.income.map(item => (
                                                <div key={item.category} className="space-y-1">
                                                    <div className="flex justify-between text-xs font-medium text-slate-700">
                                                        <span>{item.category}</span>
                                                        <span>£{item.amount.toLocaleString()} ({item.percentage.toFixed(0)}%)</span>
                                                    </div>
                                                    <div className="w-full bg-slate-100 rounded-full h-2">
                                                        <div className="bg-red-600 h-2 rounded-full" style={{ width: `${item.percentage}%` }}></div>
                                                    </div>
                                                </div>
                                            ))
                                        );
                                    })()}
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle>Expense Category Breakdown</CardTitle>
                                    <CardDescription>Visual share of actual expenses from Ledger.</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    {(() => {
                                        const breakdown = getCategoryBreakdown();
                                        return breakdown.expense.length === 0 ? (
                                            <p className="text-sm text-slate-400 italic">No expense transactions recorded.</p>
                                        ) : (
                                            breakdown.expense.map(item => (
                                                <div key={item.category} className="space-y-1">
                                                    <div className="flex justify-between text-xs font-medium text-slate-700">
                                                        <span>{item.category}</span>
                                                        <span>£{item.amount.toLocaleString()} ({item.percentage.toFixed(0)}%)</span>
                                                    </div>
                                                    <div className="w-full bg-slate-100 rounded-full h-2">
                                                        <div className="bg-red-600 h-2 rounded-full" style={{ width: `${item.percentage}%` }}></div>
                                                    </div>
                                                </div>
                                            ))
                                        );
                                    })()}
                                </CardContent>
                            </Card>
                        </div>

                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-medium text-slate-900">Ledger History</h3>
                        </div>     
                        <Card>
                            <CardHeader>
                                <CardTitle>Transaction Ledger</CardTitle>
                                <CardDescription>History of all actual income and expenditure.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="rounded-md border">
                                    <div className="overflow-x-auto w-full pb-2"><table className="w-full text-sm">
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
                                                            {t.receiptUrl && (
                                                                <a href={t.receiptUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center h-8 w-8 rounded-md hover:bg-slate-100 text-slate-500 hover:text-slate-900" title={`View Receipt: ${t.receiptName || 'receipt'}`}>
                                                                    <Paperclip className="h-4 w-4" />
                                                                </a>
                                                            )}
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
                                    </table></div>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* PLANNING & COMMITMENTS */}
                    <TabsContent value="planning" className="mt-6">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* BUDGET MILESTONES & CATEGORY CAPS */}
                            <Card className="lg:col-span-2">
                                <CardHeader>
                                    <CardTitle>Budget Milestones & Category Caps</CardTitle>
                                    <CardDescription>Track monthly recurring expenses against set budget limits. Categories exceeding 85% of caps trigger warnings.</CardDescription>
                                </CardHeader>
                                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {Object.entries(budgetCaps).map(([category, cap]) => {
                                        const actuals = getCategoryCommitments();
                                        const actual = actuals[category] || 0;
                                        const percentage = cap > 0 ? (actual / cap) * 100 : 0;
                                        const isOver85 = percentage >= 85;
                                        
                                        return (
                                            <div key={category} className="space-y-2 p-3 border rounded-lg hover:bg-slate-50 transition-colors">
                                                <div className="flex justify-between items-center text-sm">
                                                    <span className="font-semibold text-slate-800">{category}</span>
                                                    {editingBudgetCategory === category ? (
                                                        <div className="flex items-center gap-1">
                                                            <span className="text-xs text-slate-500">Cap: £</span>
                                                            <Input type="number" className="h-6 w-20 text-xs p-1 bg-white" value={editingBudgetValue} onChange={e => setEditingBudgetValue(parseFloat(e.target.value) || 0)} />
                                                            <Button size="sm" variant="ghost" className="h-6 px-1.5 hover:text-green-600" onClick={saveBudgetCap}>Save</Button>
                                                            <Button size="sm" variant="ghost" className="h-6 px-1.5 hover:text-red-600" onClick={() => setEditingBudgetCategory(null)}>Cancel</Button>
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xs text-slate-500">Cap: £{cap}</span>
                                                            <Button size="sm" variant="ghost" className="h-5 px-1.5 text-slate-400 hover:text-blue-500" onClick={() => startEditingBudget(category, cap)}>
                                                                <Pencil className="h-3 w-3" />
                                                            </Button>
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="flex justify-between text-xs text-slate-600">
                                                    <span>Actual: £{actual.toFixed(2)}/mo</span>
                                                    <span>{percentage.toFixed(0)}%</span>
                                                </div>

                                                <div className="w-full bg-slate-200 rounded-full h-2.5 relative overflow-hidden">
                                                    <div className={`h-full rounded-full transition-all duration-300 ${isOver85 ? 'bg-red-600 animate-pulse' : 'bg-green-600'}`} style={{ width: `${Math.min(100, percentage)}%` }}></div>
                                                </div>

                                                {isOver85 && (
                                                    <div className="flex items-center gap-1 text-[11px] font-medium text-red-600 animate-pulse">
                                                        <AlertTriangle className="h-3.5 w-3.5" />
                                                        <span>Spending exceeds 85% of monthly budget limit!</span>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </CardContent>
                            </Card>

                            {/* MEMBER SUBS & FINES PAYMENT TRACKER */}
                            <Card className="lg:col-span-2">
                                <CardHeader>
                                    <CardTitle>Member Subs & Fines Tracker</CardTitle>
                                    <CardDescription>Cross-reference player squad list against logged payments in ledger.</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="overflow-x-auto w-full pb-2">
                                        <table className="w-full text-sm">
                                            <thead className="bg-slate-50 border-b">
                                                <tr className="text-left text-xs font-medium text-slate-500 uppercase">
                                                    <th className="px-4 py-3">Player Name</th>
                                                    <th className="px-4 py-3">Expected Sub</th>
                                                    <th className="px-4 py-3">Paid Sub</th>
                                                    <th className="px-4 py-3">Unpaid Fines</th>
                                                    <th className="px-4 py-3">Status</th>
                                                    <th className="px-4 py-3 text-right">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {playersList.length === 0 && (
                                                    <tr>
                                                        <td colSpan={6} className="px-4 py-8 text-center text-slate-400 italic">No squad players found.</td>
                                                    </tr>
                                                )}
                                                {playersList.map(p => {
                                                    const dues = getPlayerDuesStatus(p.name, p.subAmount);
                                                    return (
                                                        <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                                                            <td className="px-4 py-3 font-medium">{p.name}</td>
                                                            <td className="px-4 py-3">£{p.subAmount}/mo</td>
                                                            <td className="px-4 py-3 text-green-600 font-medium">£{dues.paidSubs}</td>
                                                            <td className="px-4 py-3">
                                                                {dues.unpaidFinesCount > 0 ? (
                                                                    <span className="text-red-600 font-bold">{dues.unpaidFinesCount} outstanding</span>
                                                                ) : (
                                                                    <span className="text-slate-500">None</span>
                                                                )}
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                {dues.status === 'Paid' && (
                                                                    <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-800">Paid</span>
                                                                )}
                                                                {dues.status === 'Pending' && (
                                                                    <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">Pending</span>
                                                                )}
                                                                {dues.status === 'Overdue' && (
                                                                    <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-800">Overdue</span>
                                                                )}
                                                            </td>
                                                            <td className="px-4 py-3 text-right flex justify-end gap-2">
                                                                <Button size="sm" variant="outline" className="h-8 text-xs flex items-center gap-1 border-red-200 text-red-700 hover:bg-red-50" onClick={() => copyWhatsAppReminder(p.name, p.subAmount, 'sub')}>
                                                                    <Share2 className="h-3 w-3" /> Sub Reminder
                                                                </Button>
                                                                {dues.unpaidFinesCount > 0 && (
                                                                    <Button size="sm" variant="outline" className="h-8 text-xs flex items-center gap-1 border-amber-200 text-amber-700 hover:bg-amber-50" onClick={() => copyWhatsAppReminder(p.name, 10, 'fine')}>
                                                                        <AlertTriangle className="h-3 w-3" /> Fine Reminder
                                                                    </Button>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </CardContent>
                            </Card>

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
                                        {sponsors.filter(s => s.status === 'Secured').map(s => (
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
                                                    <Button size="icon" variant="ghost" className="h-6 w-6 text-slate-400 hover:text-blue-500 opacity-0 group-hover:opacity-100" onClick={() => setSelectedInvoiceSponsor(s)} title="Print Invoice">
                                                        <Printer className="h-3.5 w-3.5" />
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

                            {/* WAGES (READ-ONLY) */}
                            <Card className="lg:col-span-2">
                                <CardHeader>
                                    <CardTitle>Staff & Player Wages</CardTitle>
                                    <CardDescription>Automatically synced from Squad and Staff management pages.</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-1">
                                        {wages.length === 0 && <p className="text-sm text-slate-400 italic p-4">No contracted personnel.</p>}
                                        {wages.map(w => (
                                            <div key={w.id} className="flex items-center justify-between p-3 hover:bg-slate-50 rounded-lg border border-transparent transition-all">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-8 w-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center">
                                                        <Users className="h-4 w-4" />
                                                    </div>
                                                    <div>
                                                        <p className="font-medium text-sm text-slate-900">{w.name}</p>
                                                        <p className="text-xs text-slate-500">{w.type} Contract</p>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <span className="font-bold text-sm text-red-600">£{w.amount}</span>
                                                    <span className="text-xs text-slate-500 ml-1">/{w.frequency === 'Weekly' ? 'wk' : 'mo'}</span>
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
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold text-slate-500 block">Receipt Attachment (Optional)</label>
                                    <div className="flex items-center gap-2">
                                        {newLedgerItem.receiptUrl ? (
                                            <div className="flex items-center justify-between bg-slate-50 border rounded px-3 py-1.5 w-full text-xs text-slate-700">
                                                <span className="truncate max-w-[200px] font-mono">{newLedgerItem.receiptName || 'receipt.png'}</span>
                                                <Button size="sm" variant="ghost" className="h-6 text-red-600 hover:text-red-700 p-0" onClick={() => setNewLedgerItem({ ...newLedgerItem, receiptUrl: '', receiptName: '' })}>
                                                    Remove
                                                </Button>
                                            </div>
                                        ) : (
                                            <label className="flex items-center justify-center border-2 border-dashed border-slate-200 rounded-md p-4 hover:border-blue-500 cursor-pointer w-full text-center text-xs text-slate-500 transition-colors">
                                                <UploadCloud className="h-4 w-4 mr-2 text-slate-400" />
                                                <span>Click to upload receipt (max 2MB)</span>
                                                <input type="file" className="hidden" accept="image/*,application/pdf" onChange={async (e) => {
                                                    const file = e.target.files?.[0];
                                                    if (!file) return;
                                                    if (file.size > 2 * 1024 * 1024) {
                                                        alert("File must be under 2MB!");
                                                        return;
                                                    }
                                                    const reader = new FileReader();
                                                    reader.onloadend = () => {
                                                        setNewLedgerItem({
                                                            ...newLedgerItem,
                                                            receiptUrl: reader.result as string,
                                                            receiptName: file.name
                                                        });
                                                    };
                                                    reader.readAsDataURL(file);
                                                }} />
                                            </label>
                                        )}
                                    </div>
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

                {/* INVOICE EXPORTER MODAL */}
                {selectedInvoiceSponsor && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 print:p-0 print:bg-white print:static">
                        <Card className="w-full max-w-2xl bg-white text-slate-900 border-none print:shadow-none animate-in fade-in duration-200">
                            <CardHeader className="border-b pb-4 flex flex-row items-center justify-between print:hidden">
                                <div>
                                    <CardTitle className="text-slate-900">Sponsor Invoice Generator</CardTitle>
                                    <CardDescription className="text-slate-500">Preview and print invoice for {selectedInvoiceSponsor.name}.</CardDescription>
                                </div>
                                <div className="flex gap-2">
                                    <Button variant="outline" size="sm" onClick={() => setSelectedInvoiceSponsor(null)}>Cancel</Button>
                                    <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white" onClick={() => window.print()}>
                                        <Printer className="h-4 w-4 mr-2" /> Print Invoice
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent className="p-8 print:p-0 space-y-6">
                                <style dangerouslySetInnerHTML={{__html: `
                                    @media print {
                                        body * {
                                            visibility: hidden;
                                        }
                                        .print-container, .print-container * {
                                            visibility: visible;
                                        }
                                        .print-container {
                                            position: absolute;
                                            left: 0;
                                            top: 0;
                                            width: 100%;
                                            padding: 20px;
                                            color: #0f172a !important;
                                            background: #ffffff !important;
                                        }
                                    }
                                `}} />
                                <div className="print-container space-y-6">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h1 className="text-2xl font-bold tracking-tight text-slate-900">INVOICE</h1>
                                            <p className="text-xs text-slate-500 font-mono mt-1">INV-{new Date().getFullYear()}-{selectedInvoiceSponsor.id.substring(0, 4).toUpperCase()}</p>
                                        </div>
                                        <div className="text-right">
                                            <h2 className="text-lg font-bold text-slate-900">Camden United Football Club</h2>
                                            <p className="text-xs text-slate-500">Camden, London, UK</p>
                                            <p className="text-xs text-slate-500">finance@camdenunited.co.uk</p>
                                        </div>
                                    </div>
                                    <hr className="border-slate-200" />
                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                        <div>
                                            <span className="text-xs font-semibold text-slate-500 uppercase block mb-1">Billed To:</span>
                                            <p className="font-bold text-slate-800">{selectedInvoiceSponsor.name}</p>
                                            {selectedInvoiceSponsor.description && <p className="text-xs text-slate-500 max-w-xs">{selectedInvoiceSponsor.description}</p>}
                                        </div>
                                        <div className="text-right">
                                            <span className="text-xs font-semibold text-slate-500 uppercase block mb-1">Invoice Date:</span>
                                            <p className="text-slate-800 font-medium">{new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                                            <span className="text-xs font-semibold text-slate-500 uppercase block mt-3 mb-1">Payment Term:</span>
                                            <p className="text-slate-800 font-medium">{selectedInvoiceSponsor.frequency} Sponsorship</p>
                                        </div>
                                    </div>
                                    <div className="border rounded-lg overflow-hidden mt-6">
                                        <table className="w-full text-sm">
                                            <thead className="bg-slate-50 border-b">
                                                <tr className="text-left text-slate-500 font-medium">
                                                    <th className="px-4 py-3">Description</th>
                                                    <th className="px-4 py-3 text-right">Amount</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-200">
                                                <tr>
                                                    <td className="px-4 py-4">
                                                        <p className="font-semibold text-slate-800">Sponsorship Agreement - {selectedInvoiceSponsor.name}</p>
                                                        <p className="text-xs text-slate-500 mt-1">ClubFlow brand alignment exposure deliverables, training kit exposure and pitch banner ads.</p>
                                                    </td>
                                                    <td className="px-4 py-4 text-right font-bold text-slate-900">£{selectedInvoiceSponsor.amount.toLocaleString()}</td>
                                                </tr>
                                                <tr className="bg-slate-50 font-bold">
                                                    <td className="px-4 py-3 text-right">Total Owed</td>
                                                    <td className="px-4 py-3 text-right text-slate-900 text-base">£{selectedInvoiceSponsor.amount.toLocaleString()}</td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                    <div className="space-y-2 pt-4">
                                        <h3 className="text-xs font-semibold text-slate-500 uppercase">Bank Payment Details:</h3>
                                        <p className="text-xs text-slate-600 font-medium">Bank Name: Barclays Camden Branch</p>
                                        <p className="text-xs text-slate-600 font-medium">Account Name: Camden United Football Club</p>
                                        <p className="text-xs text-slate-600 font-medium">Account Number: 87654321</p>
                                        <p className="text-xs text-slate-600 font-medium">Sort Code: 20-45-78</p>
                                    </div>
                                    <hr className="border-slate-200" />
                                    <p className="text-[10px] text-center text-slate-400 italic">Thank you for your support of Camden United Football Club!</p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}

            </div>
    );
}
