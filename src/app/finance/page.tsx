"use client";

import { useState, useEffect } from "react";
import { Sponsor, Subscription, Transaction, Player } from "@/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useClub } from "@/context/club-context";
import { supabase } from "@/lib/supabase";
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
    Calendar, 
    AlertTriangle, 
    Share2, 
    Search, 
    X,
    Sparkles,
    Check,
    MessageSquare,
    Copy,
    Settings,
    FileText,
    HelpCircle,
    Info,
    UploadCloud,
    RotateCcw,
    Download
} from "lucide-react";

// Default categories
const DEFAULT_INCOME_CATEGORIES = ["Player Subs", "Sponsorship", "Fundraising", "Donations", "Grants", "Matchday Income"];
const DEFAULT_EXPENSE_CATEGORIES = [
    "Pitch Hire", 
    "Training Facilities", 
    "Officials", 
    "League Fees", 
    "Cup Fees", 
    "Insurance", 
    "Kit & Equipment", 
    "Travel", 
    "Administration", 
    "Marketing", 
    "Miscellaneous"
];

export default function FinancePage() {
    const { settings, updateSettings } = useClub();

    // Data lists
    const [sponsors, setSponsors] = useState<Sponsor[]>([]);
    const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [players, setPlayers] = useState<Player[]>([]);
    const [customCategories, setCustomCategories] = useState<{ income: string[]; expense: string[] }>({ income: [], expense: [] });

    // Setup Wizard state
    const [showWizard, setShowWizard] = useState(false);
    const [wizardStep, setWizardStep] = useState(1);
    const [wizardIncome, setWizardIncome] = useState<string[]>(["Player Subs", "Sponsorship"]);
    const [wizardExpense, setWizardExpense] = useState<string[]>(["Pitch Hire", "Training Facilities", "Officials", "League Fees"]);

    // Balance editing state
    const [isEditingBalance, setIsEditingBalance] = useState(false);
    const [newStartingBalance, setNewStartingBalance] = useState("");
    const [isResetting, setIsResetting] = useState(false);

    // Active sub-view or tab
    const [activeSection, setActiveSection] = useState<"overview" | "subs" | "fines" | "commitments" | "ledger" | "sponsors" | "fundraising" | "categories">("overview");

    // Modal forms state
    const [isAddTxOpen, setIsAddTxOpen] = useState(false);
    const [isAddSponsorOpen, setIsAddSponsorOpen] = useState(false);
    const [isAddCommitmentOpen, setIsAddCommitmentOpen] = useState(false);
    const [isAddCategoryOpen, setIsAddCategoryOpen] = useState(false);

    // Edit modes
    const [editingId, setEditingId] = useState<string | null>(null);

    // Form inputs state
    const [txForm, setTxForm] = useState({
        description: "",
        amount: "",
        type: "Expense" as "Income" | "Expense",
        category: "Miscellaneous",
        date: new Date().toISOString().split("T")[0]
    });

    const [sponsorForm, setSponsorForm] = useState({
        name: "",
        amount: "",
        frequency: "Yearly" as "One-off" | "Monthly" | "Yearly",
        startDate: new Date().toISOString().split("T")[0],
        endDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split("T")[0],
        status: "Secured" as "Secured" | "Lead" | "Contacted" | "Proposal" | "Review",
        website: "",
        description: "",
        responsibilities: "",
        contractUrl: "",
        contractName: ""
    });

    const [commitmentForm, setCommitmentForm] = useState({
        name: "",
        cost: "",
        frequency: "Monthly" as "Monthly" | "Yearly",
        nextPaymentDate: new Date().toISOString().split("T")[0],
        category: "Pitch Hire"
    });

    const [newCategoryName, setNewCategoryName] = useState("");
    const [newCategoryType, setNewCategoryType] = useState<"Income" | "Expense">("Income");
    const [isEditingSubs, setIsEditingSubs] = useState(false);
    const [newSubsBaseline, setNewSubsBaseline] = useState("");
    const [newRegBaseline, setNewRegBaseline] = useState("");
    const [newSessionBaseline, setNewSessionBaseline] = useState("");
    const [newMatchdayBaseline, setNewMatchdayBaseline] = useState("");
    const [trainingSessions, setTrainingSessions] = useState<any[]>([]);
    const [matches, setMatches] = useState<any[]>([]);
    const [matchdayFee, setMatchdayFee] = useState<number>(10);
    const [subsStructure, setSubsStructure] = useState<"Monthly" | "Training" | "Matchday" | "Both">("Monthly");

    // Player subs modal state
    const [selectedPlayerForPayment, setSelectedPlayerForPayment] = useState<Player | null>(null);
    const [playerPaymentForm, setPlayerPaymentForm] = useState({
        amount: "",
        notes: "",
        date: new Date().toISOString().split("T")[0]
    });
    const [viewingHistoryPlayer, setViewingHistoryPlayer] = useState<Player | null>(null);

    // Player Fines state
    const [fines, setFines] = useState<any[]>([]);
    const [isAddFineOpen, setIsAddFineOpen] = useState(false);
    const [customCategoryName, setCustomCategoryName] = useState("");
    const [fineForm, setFineForm] = useState({
        playerId: "",
        category: "",
        amount: "",
        date: new Date().toISOString().split("T")[0]
    });

    // Player sub settings edit state
    const [editingSubPlayer, setEditingSubPlayer] = useState<Player | null>(null);
    const [subFormModel, setSubFormModel] = useState<"Monthly" | "Pay-As-You-Go" | "Matchday-PAYG" | "Both-PAYG" | "Exempt">("Monthly");
    const [subFormAmount, setSubFormAmount] = useState<string>("0");
    const [subFormMatchesOverride, setSubFormMatchesOverride] = useState<string>("0");
    const [subFormTrainingOverride, setSubFormTrainingOverride] = useState<string>("0");
    const [isSavingSub, setIsSavingSub] = useState(false);

    // Search and general filter state
    const [ledgerSearch, setLedgerSearch] = useState("");
    const [ledgerTypeFilter, setLedgerTypeFilter] = useState<"All" | "Income" | "Expense">("All");
    const [ledgerCategoryFilter, setLedgerCategoryFilter] = useState("All");

    const [subsSearch, setSubsSearch] = useState("");
    const [subsStatusFilter, setSubsStatusFilter] = useState<"All" | "Paid" | "Part Paid" | "Outstanding">("All");

    // Copy confirmation alerts
    const [alertMessage, setAlertMessage] = useState<string | null>(null);

    // Accounting method state (Accrual vs Cash basis)
    const [accountingMethod, setAccountingMethod] = useState<"accrual" | "cash">("accrual");

    // Setup categories dynamically
    const incomeCategories = [
        ...DEFAULT_INCOME_CATEGORIES, 
        ...(settings.finesEnabled ? ["Player Fines"] : []),
        ...customCategories.income
    ];
    const expenseCategories = [...DEFAULT_EXPENSE_CATEGORIES, ...customCategories.expense];

    // Load initial data
    useEffect(() => {
        fetchFinanceData();

        // Check if wizard completed
        const wizardCompleted = localStorage.getItem(`clubflow_wizard_completed_${settings.name}`);
        if (!wizardCompleted) {
            setShowWizard(true);
        }
        
        // Load matchday fee
        const savedMatchdayFee = localStorage.getItem(`clubflow_matchday_fee_${settings.name}`);
        if (savedMatchdayFee) {
            setMatchdayFee(parseFloat(savedMatchdayFee) || 10);
        }

        // Load subs structure
        const savedStructure = localStorage.getItem(`clubflow_subs_structure_${settings.name}`);
        if (savedStructure) {
            setSubsStructure(savedStructure as any);
        } else {
            // Default to training fee subs if no monthly sub baseline but session fee is set
            if (settings.trainingFeePerSession && settings.trainingFeePerSession > 0 && (!settings.monthlySubs || settings.monthlySubs === 0)) {
                setSubsStructure("Training");
            } else {
                setSubsStructure("Monthly");
            }
        }
        
        // Load custom categories from local storage if any
        const savedCustomCats = localStorage.getItem(`clubflow_custom_categories_${settings.name}`);
        if (savedCustomCats) {
            try {
                setCustomCategories(JSON.parse(savedCustomCats));
            } catch (e) {
                console.error("Failed to parse custom categories", e);
            }
        }

        // Load player fines from localStorage
        const savedFines = localStorage.getItem(`clubflow_player_fines_${settings.name}`);
        if (savedFines) {
            try {
                setFines(JSON.parse(savedFines));
            } catch (e) {
                console.error("Failed to parse player fines", e);
            }
        }
    }, [settings.name, settings.trainingFeePerSession, settings.monthlySubs]);

    const fetchFinanceData = async () => {
        await Promise.all([
            fetchTransactions(),
            fetchSponsors(),
            fetchSubscriptions(),
            fetchPlayers(),
            fetchTrainingSessions(),
            fetchMatches()
        ]);
        setNewStartingBalance((settings.financeStartingBalance || 0).toString());
    };

    const getMonthDateBounds = () => {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth();
        
        const start = new Date(year, month, 1);
        const end = new Date(year, month + 1, 0);
        
        const toIsoDate = (d: Date) => {
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${y}-${m}-${day}`;
        };
        
        return {
            start: toIsoDate(start),
            end: toIsoDate(end)
        };
    };

    const handleResetSubs = async () => {
        const { start, end } = getMonthDateBounds();
        const monthName = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });
        
        if (!confirm(`Are you sure you want to reset all player subscriptions for ${monthName}? This will delete all logged sub payments, set player custom sub overrides to £0, and reset the default club sub baseline to £0.`)) {
            return;
        }
        
        setIsResetting(true);
        try {
            // 1. Delete this month's player sub payment transactions
            const { error: txError } = await supabase
                .from("finance_transactions")
                .delete()
                .eq("type", "Income")
                .eq("category", "Player Subs")
                .gte("date", start)
                .lte("date", end);
                
            if (txError) throw txError;
            
            // 2. Reset all individual player custom sub overrides to 0
            const { error: playerError } = await supabase
                .from("players")
                .update({ subs_custom_amount: 0 })
                .neq("id", "00000000-0000-0000-0000-000000000000");
                
            if (playerError) throw playerError;

            // 3. Reset the default club baseline setting to 0
            await updateSettings({ monthlySubs: 0 });
            
            // 4. Refresh local state
            await Promise.all([
                fetchTransactions(),
                fetchPlayers()
            ]);
            
            alert("Player subscriptions reset successfully!");
        } catch (err: any) {
            console.error("Failed to reset subscriptions:", err);
            alert("Error: " + (err.message || "Failed to reset subscriptions."));
        } finally {
            setIsResetting(false);
        }
    };

    const fetchTransactions = async () => {
        const { data, error } = await supabase.from("finance_transactions").select("*").order("date", { ascending: false });
        if (error) console.error("Error fetching transactions", error);
        if (data) {
            setTransactions(data.map((t: any) => ({
                id: t.id,
                date: t.date,
                description: t.description,
                amount: Number(t.amount),
                type: t.type,
                category: t.category,
                isRecurring: t.is_recurring,
                frequency: t.frequency,
                receiptUrl: t.receipt_url,
                receiptName: t.receipt_name
            })));
        }
    };

    const fetchSponsors = async () => {
        const { data, error } = await supabase.from("sponsors").select("*");
        if (error) console.error("Error fetching sponsors", error);
        if (data) {
            setSponsors(data.map((s: any) => ({
                id: s.id,
                name: s.name,
                amount: Number(s.amount),
                frequency: s.frequency,
                startDate: s.start_date,
                endDate: s.end_date,
                status: s.status || "Secured",
                description: s.description,
                website: s.website
            })));
        }
    };

    const fetchSubscriptions = async () => {
        const { data, error } = await supabase.from("subscriptions").select("*");
        if (error) console.error("Error fetching subscriptions", error);
        if (data) {
            setSubscriptions(data.map((sub: any) => ({
                id: sub.id,
                name: sub.name,
                cost: Number(sub.cost),
                frequency: sub.frequency,
                nextPaymentDate: sub.next_payment_date,
                category: sub.category
            })));
        }
    };

    const fetchPlayers = async () => {
        const { data, error } = await supabase.from("players").select("*");
        if (error) console.error("Error fetching players", error);
        if (data) {
            setPlayers(data.map((p: any) => ({
                id: p.id,
                firstName: p.first_name,
                lastName: p.last_name,
                position: p.position,
                squadNumber: p.squad_number,
                age: p.age,
                nationality: p.nationality || "",
                contractExpiry: p.contract_expiry,
                availability: p.availability,
                imageUrl: p.image_url,
                appearances: p.appearances || 0,
                goals: p.goals || 0,
                assists: p.assists || 0,
                isContracted: p.is_contracted,
                contractAmount: p.contract_amount || 0,
                contractFrequency: p.contract_frequency || "Weekly",
                subsBillingModel: p.subs_billing_model || "Monthly",
                subsCustomAmount: p.subs_custom_amount !== undefined && p.subs_custom_amount !== null ? Number(p.subs_custom_amount) : 0,
                squad: p.squad,
                medicalStatus: p.medical_status
            })));
        }
    };
    const fetchTrainingSessions = async () => {
        const { data, error } = await supabase.from("training_sessions").select("*");
        if (error) console.error("Error fetching training sessions", error);
        if (data) setTrainingSessions(data);
    };

    const fetchMatches = async () => {
        const { data, error } = await supabase.from("matches").select("*");
        if (error) console.error("Error fetching matches", error);
        if (data) setMatches(data);
    };

    const getPlayerRegistrationStatus = (player: Player) => {
        const regFee = settings.registrationFee || 0;
        if (regFee <= 0) return { expected: 0, paid: 0, isPaid: true };

        const regPayments = transactions.filter(t => {
            if (t.type !== "Income" || t.category !== "Player Subs") return false;
            const desc = t.description.toLowerCase();
            const matchesPlayer = desc.includes(`${player.firstName.toLowerCase()} ${player.lastName.toLowerCase()}`) ||
                                  desc.includes(player.lastName.toLowerCase());
            const isReg = desc.includes("registration") || desc.includes("reg fee");
            return matchesPlayer && isReg;
        });

        const paid = regPayments.reduce((sum, p) => sum + p.amount, 0);
        return {
            expected: regFee,
            paid,
            isPaid: paid >= regFee
        };
    };

    const handleMarkRegPaid = async (player: Player) => {
        const regFee = settings.registrationFee || 0;
        if (regFee <= 0) return;

        const payload = {
            date: new Date().toISOString().split("T")[0],
            description: `Registration Fee - ${player.firstName} ${player.lastName}`,
            amount: regFee,
            type: "Income",
            category: "Player Subs",
            isRecurring: false
        };

        const { error } = await supabase.from("finance_transactions").insert([payload]);
        if (error) {
            console.error("Error saving registration payment", error);
            alert("Error saving payment");
        } else {
            triggerToast(`Registration fee marked paid for ${player.firstName}`);
            fetchFinanceData();
        }
    };

    const handleFineCategoryChange = (categoryName: string) => {
        const matchingCategory = (settings.fineCategories || []).find(cat => cat.name === categoryName);
        setFineForm(prev => ({
            ...prev,
            category: categoryName,
            amount: matchingCategory ? matchingCategory.amount.toString() : prev.amount
        }));
    };

    const handleIssueFine = (e: React.FormEvent) => {
        e.preventDefault();
        const { playerId, category, amount, date } = fineForm;
        const finalCategory = category === "Other" ? customCategoryName : category;
        
        if (!playerId || !finalCategory || !amount) {
            alert("Please fill in all fields");
            return;
        }

        const playerObj = players.find(p => p.id === playerId);
        if (!playerObj) {
            alert("Player not found");
            return;
        }

        const newFine = {
            id: typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15),
            playerId,
            playerName: `${playerObj.firstName} ${playerObj.lastName}`,
            category: finalCategory,
            amount: parseFloat(amount),
            date,
            status: "Unpaid" as "Paid" | "Unpaid"
        };

        const updatedFines = [newFine, ...fines];
        setFines(updatedFines);
        localStorage.setItem(`clubflow_player_fines_${settings.name}`, JSON.stringify(updatedFines));
        
        setFineForm({
            playerId: "",
            category: "",
            amount: "",
            date: new Date().toISOString().split("T")[0]
        });
        setCustomCategoryName("");
        setIsAddFineOpen(false);
        triggerToast(`Fine of £${amount} issued to ${playerObj.firstName} ${playerObj.lastName}`);
    };

    const handleMarkFinePaid = async (fineId: string) => {
        const fineIndex = fines.findIndex(f => f.id === fineId);
        if (fineIndex === -1) return;

        const fine = fines[fineIndex];
        
        const payload = {
            date: new Date().toISOString().split("T")[0],
            description: `Fine Paid - ${fine.category} - ${fine.playerName}`,
            amount: fine.amount,
            type: "Income",
            category: "Player Fines",
            is_recurring: false
        };

        try {
            const { error } = await supabase.from("finance_transactions").insert([payload]);
            if (error) throw error;

            const updatedFines = fines.map(f => f.id === fineId ? { ...f, status: "Paid" as const } : f);
            setFines(updatedFines);
            localStorage.setItem(`clubflow_player_fines_${settings.name}`, JSON.stringify(updatedFines));
            
            triggerToast(`Fine of £${fine.amount} marked as Paid for ${fine.playerName}`);
            fetchTransactions();
        } catch (err: any) {
            console.error("Failed to mark fine as paid in ledger:", err);
            alert("Failed to save transaction to ledger: " + (err.message || err));
        }
    };

    const handleDeleteFine = (fineId: string) => {
        if (!confirm("Are you sure you want to delete this fine record?")) return;
        const updatedFines = fines.filter(f => f.id !== fineId);
        setFines(updatedFines);
        localStorage.setItem(`clubflow_player_fines_${settings.name}`, JSON.stringify(updatedFines));
        triggerToast("Fine record deleted");
    };

    // Calculate dynamic values
    const currentMonthStr = new Date().toISOString().substring(0, 7); // e.g. "2026-06"

    // Bank balance calculation
    const bankBalance = (() => {
        const starting = settings.financeStartingBalance || 0;
        const totalIncome = transactions.filter(t => t.type === "Income").reduce((sum, t) => sum + t.amount, 0);
        const totalExpense = transactions.filter(t => t.type === "Expense").reduce((sum, t) => sum + t.amount, 0);
        return starting + totalIncome - totalExpense;
    })();

    const getPlayerAttendedSessionsCount = (player: Player) => {
        const override = localStorage.getItem(`clubflow_training_attended_${player.id}_${currentMonthStr}`);
        if (override !== null) {
            return parseInt(override) || 0;
        }
        let count = 0;
        trainingSessions.forEach(session => {
            if (session.date && session.date.startsWith(currentMonthStr)) {
                const record = session.attendance?.find((a: any) => a.playerId === player.id);
                if (record && (record.status === "Present" || record.status === "Late")) {
                    count++;
                }
            }
        });
        return count;
    };

    const getPlayerMatchesCount = (player: Player) => {
        const override = localStorage.getItem(`clubflow_matches_played_${player.id}_${currentMonthStr}`);
        if (override !== null) {
            return parseInt(override) || 0;
        }
        // Filter matches in current month
        const monthlyMatches = matches.filter(m => m.date && m.date.startsWith(currentMonthStr));
        return monthlyMatches.length;
    };

    // Monthly Player Subs expectations
    const getPlayerMonthlyFee = (p: Player) => {
        if (!settings.subsEnabled) return 0;
        if (p.subsBillingModel === "Exempt") return 0;
        
        let effectiveModel = p.subsBillingModel;
        if (!effectiveModel) {
            if (subsStructure === "Training") effectiveModel = "Pay-As-You-Go";
            else if (subsStructure === "Matchday") effectiveModel = "Matchday-PAYG";
            else if (subsStructure === "Both") effectiveModel = "Both-PAYG";
            else effectiveModel = "Monthly";
        }

        const trainingRate = p.subsCustomAmount !== undefined && p.subsCustomAmount !== null && p.subsCustomAmount > 0 && effectiveModel === "Pay-As-You-Go"
            ? p.subsCustomAmount 
            : (settings.trainingFeePerSession || 0);

        const matchdayRate = p.subsCustomAmount !== undefined && p.subsCustomAmount !== null && p.subsCustomAmount > 0 && effectiveModel === "Matchday-PAYG"
            ? p.subsCustomAmount
            : (matchdayFee || 10);

        if (effectiveModel === "Pay-As-You-Go") {
            const count = getPlayerAttendedSessionsCount(p);
            return count * trainingRate;
        }

        if (effectiveModel === "Matchday-PAYG") {
            const count = getPlayerMatchesCount(p);
            return count * matchdayRate;
        }

        if (effectiveModel === "Both-PAYG") {
            const trainingCount = getPlayerAttendedSessionsCount(p);
            const matchesCount = getPlayerMatchesCount(p);
            return trainingCount * trainingRate + matchesCount * matchdayRate;
        }

        if (p.subsCustomAmount !== undefined && p.subsCustomAmount !== null && p.subsCustomAmount > 0 && effectiveModel === "Monthly") {
            return p.subsCustomAmount;
        }
        return settings.monthlySubs || 0;
    };

    // Sum up player subs for the current month
    const getPlayerDuesForMonth = (player: Player) => {
        const expected = getPlayerMonthlyFee(player);
        
        // Find player sub payments in the current calendar month
        const payments = transactions.filter(t => {
            if (t.type !== "Income" || t.category !== "Player Subs") return false;
            // Check if transaction is in current month
            const isThisMonth = t.date.startsWith(currentMonthStr);
            const matchesPlayer = t.description.toLowerCase().includes(`${player.firstName.toLowerCase()} ${player.lastName.toLowerCase()}`) ||
                                  t.description.toLowerCase().includes(player.lastName.toLowerCase());
            return isThisMonth && matchesPlayer;
        });

        const paid = payments.reduce((sum, p) => sum + p.amount, 0);
        const outstanding = Math.max(0, expected - paid);
        
        let status: "Paid" | "Part Paid" | "Outstanding" | "Exempt" = "Outstanding";
        if (player.subsBillingModel === "Exempt") {
            status = "Exempt";
        } else if (paid >= expected) {
            status = "Paid";
        } else if (paid > 0) {
            status = "Part Paid";
        }

        return {
            expected,
            paid,
            outstanding,
            status,
            payments
        };
    };

    // Aggregate subs dashboard
    const subsOverview = (() => {
        let expected = 0;
        let received = 0;
        let outstanding = 0;

        players.forEach(p => {
            const dues = getPlayerDuesForMonth(p);
            expected += dues.expected;
            received += dues.paid;
            outstanding += dues.outstanding;
        });

        const rate = expected > 0 ? Math.round((received / expected) * 100) : 0;

        return { expected, received, outstanding, rate };
    })();

    // Copy friendly chaser reminder
    const copyReminderForPlayer = (player: Player) => {
        const dues = getPlayerDuesForMonth(player);
        const currentMonthName = new Date().toLocaleString("default", { month: "long" });
        const text = `Hi ${player.firstName}, hope you're well! Just a friendly reminder that you have £${dues.outstanding} outstanding for your ${currentMonthName} club subs. Could you please get this sorted when you can? Thanks!`;
        
        navigator.clipboard.writeText(text);
        triggerToast(`Copied payment reminder message for ${player.firstName}`);
    };

    // Monthly commitments (forecasted expenses)
    const monthlyExpensesCommitment = (() => {
        let cost = 0;

        // Subscriptions / commitments
        subscriptions.forEach(sub => {
            if (sub.frequency === "Monthly") cost += sub.cost;
            else if (sub.frequency === "Yearly") cost += sub.cost / 12;
        });

        // Add recurring transactions
        transactions.filter(t => t.isRecurring && t.type === "Expense").forEach(t => {
            let val = t.amount;
            if (t.frequency === "Weekly") val = t.amount * 4.33;
            else if (t.frequency === "Yearly") val = t.amount / 12;
            cost += val;
        });

        // Add player contracts (outgoing payments to contracted players)
        if (settings.contractsEnabled) {
            players.forEach(p => {
                if (p.isContracted && p.contractAmount) {
                    let val = p.contractAmount;
                    if (p.contractFrequency === "Weekly") val = p.contractAmount * 4.33;
                    cost += val;
                }
            });
        }

        return cost;
    })();

    // Monthly income (forecasted sponsors + commitments)
    const monthlyIncomeForecast = (() => {
        let income = 0;

        // Add sponsors
        sponsors.forEach(sp => {
            if (sp.status === "Secured") {
                if (sp.frequency === "Monthly") income += sp.amount;
                else if (sp.frequency === "Yearly") income += sp.amount / 12;
            }
        });

        // Add expected player subs
        income += subsOverview.expected;

        // Add recurring income transactions
        transactions.filter(t => t.isRecurring && t.type === "Income").forEach(t => {
            let val = t.amount;
            if (t.frequency === "Weekly") val = t.amount * 4.33;
            else if (t.frequency === "Yearly") val = t.amount / 12;
            income += val;
        });

        return income;
    })();

    // Cash-basis actuals for the current month
    const cashIncomeActual = (() => {
        const currentMonth = new Date().toISOString().substring(0, 7); // e.g., "2026-06"
        return transactions
            .filter(t => t.type === "Income" && t.date && t.date.startsWith(currentMonth))
            .reduce((sum, t) => sum + t.amount, 0);
    })();

    const cashExpenseActual = (() => {
        const currentMonth = new Date().toISOString().substring(0, 7); // e.g., "2026-06"
        return transactions
            .filter(t => t.type === "Expense" && t.date && t.date.startsWith(currentMonth))
            .reduce((sum, t) => sum + t.amount, 0);
    })();

    // Runway calculation
    const runwayMonths = monthlyExpensesCommitment > 0 ? (bankBalance / monthlyExpensesCommitment).toFixed(1) : "∞";

    // Setup Wizard Actions
    const handleWizardComplete = () => {
        localStorage.setItem(`clubflow_wizard_completed_${settings.name}`, "true");
        
        // Update starter categories based on selections
        const initialCustomCategories = {
            income: wizardIncome.filter(c => !DEFAULT_INCOME_CATEGORIES.includes(c)),
            expense: wizardExpense.filter(c => !DEFAULT_EXPENSE_CATEGORIES.includes(c))
        };
        setCustomCategories(initialCustomCategories);
        localStorage.setItem(`clubflow_custom_categories_${settings.name}`, JSON.stringify(initialCustomCategories));
        
        setShowWizard(false);
        triggerToast("Wizard setup completed! Initial categories created.");
    };

    // Starting Balance Update
    const saveStartingBalance = async () => {
        const val = parseFloat(newStartingBalance) || 0;
        updateSettings({ financeStartingBalance: val });
        setIsEditingBalance(false);
        triggerToast(`Starting bank balance set to £${val.toFixed(2)}`);
    };

    // Quick Add Payment for Player
    const handleQuickPay = async (player: Player, customAmount?: number) => {
        const dues = getPlayerDuesForMonth(player);
        const amountToPay = customAmount !== undefined ? customAmount : dues.outstanding;

        if (amountToPay <= 0) return;

        const payload = {
            date: new Date().toISOString().split("T")[0],
            description: `Player Subs: ${player.firstName} ${player.lastName} (${new Date().toLocaleString("default", { month: "long" })} ${new Date().getFullYear()})`,
            amount: amountToPay,
            type: "Income" as const,
            category: "Player Subs",
            is_recurring: false
        };

        const { error } = await supabase.from("finance_transactions").insert([payload]);
        if (error) {
            console.error(error);
            alert("Failed to log payment.");
        } else {
            triggerToast(`Logged payment of £${amountToPay} for ${player.firstName} ${player.lastName}`);
            fetchTransactions();
        }
    };

    // Handle Custom Payment Modal
    const handleOpenPaymentModal = (player: Player) => {
        setSelectedPlayerForPayment(player);
        const dues = getPlayerDuesForMonth(player);
        setPlayerPaymentForm({
            amount: dues.outstanding.toString(),
            notes: `Subs payment for ${new Date().toLocaleString("default", { month: "long" })}`,
            date: new Date().toISOString().split("T")[0]
        });
    };

    const handleSavePlayerPayment = async () => {
        if (!selectedPlayerForPayment) return;
        const amt = parseFloat(playerPaymentForm.amount) || 0;
        if (amt <= 0) return;

        const payload = {
            date: playerPaymentForm.date,
            description: `Player Subs: ${selectedPlayerForPayment.firstName} ${selectedPlayerForPayment.lastName} - ${playerPaymentForm.notes}`,
            amount: amt,
            type: "Income" as const,
            category: "Player Subs",
            is_recurring: false
        };

        const { error } = await supabase.from("finance_transactions").insert([payload]);
        if (error) {
            console.error(error);
            alert("Failed to save payment.");
        } else {
            triggerToast(`Logged custom payment of £${amt} for ${selectedPlayerForPayment.firstName}`);
            fetchTransactions();
            setSelectedPlayerForPayment(null);
        }
    };

    const handleOpenSubSettingsModal = (player: Player) => {
        setEditingSubPlayer(player);
        setSubFormModel(player.subsBillingModel || "Monthly");
        setSubFormAmount((player.subsCustomAmount || 0).toString());
        setSubFormMatchesOverride(localStorage.getItem(`clubflow_matches_played_${player.id}_${currentMonthStr}`) || getPlayerMatchesCount(player).toString());
        setSubFormTrainingOverride(localStorage.getItem(`clubflow_training_attended_${player.id}_${currentMonthStr}`) || getPlayerAttendedSessionsCount(player).toString());
    };

    const handleSaveSubSettings = async () => {
        if (!editingSubPlayer) return;
        setIsSavingSub(true);
        try {
            const amt = parseFloat(subFormAmount) || 0;
            
            // Save overrides to local storage
            if (subFormModel === "Matchday-PAYG" || subFormModel === "Both-PAYG") {
                localStorage.setItem(`clubflow_matches_played_${editingSubPlayer.id}_${currentMonthStr}`, subFormMatchesOverride);
            } else {
                localStorage.removeItem(`clubflow_matches_played_${editingSubPlayer.id}_${currentMonthStr}`);
            }

            if (subFormModel === "Pay-As-You-Go" || subFormModel === "Both-PAYG") {
                localStorage.setItem(`clubflow_training_attended_${editingSubPlayer.id}_${currentMonthStr}`, subFormTrainingOverride);
            } else {
                localStorage.removeItem(`clubflow_training_attended_${editingSubPlayer.id}_${currentMonthStr}`);
            }

            const { error } = await supabase
                .from("players")
                .update({
                    subs_billing_model: subFormModel,
                    subs_custom_amount: amt
                })
                .eq("id", editingSubPlayer.id);

            if (error) throw error;

            triggerToast(`Sub settings updated for ${editingSubPlayer.firstName} ${editingSubPlayer.lastName}`);
            await fetchPlayers();
            setEditingSubPlayer(null);
        } catch (err: any) {
            console.error("Failed to update sub settings:", err);
            alert("Error: " + (err.message || "Failed to save settings."));
        } finally {
            setIsSavingSub(false);
        }
    };

    // WhatsApp Reminders Copy
    const copyWhatsAppReminder = (player: Player) => {
        const dues = getPlayerDuesForMonth(player);
        const text = `Hi ${player.firstName},\n\nAccording to our records your player subs are currently outstanding.\n\nOutstanding Amount: £${dues.outstanding}\n\nPlease make payment when possible.\n\nThank you.`;
        navigator.clipboard.writeText(text);
        triggerToast(`WhatsApp reminder copied for ${player.firstName}`);
    };

    const copyBulkReminder = () => {
        const unpaid = players.map(p => ({ player: p, dues: getPlayerDuesForMonth(p) })).filter(item => item.dues.outstanding > 0);
        if (unpaid.length === 0) {
            triggerToast("All players are fully paid for this month!");
            return;
        }

        let text = "Outstanding Subs:\n\n";
        let total = 0;
        unpaid.forEach(item => {
            text += `${item.player.firstName} ${item.player.lastName} - £${item.dues.outstanding}\n`;
            total += item.dues.outstanding;
        });
        text += `\nTotal Outstanding: £${total}\n\nCopy to clipboard.`;
        
        navigator.clipboard.writeText(text);
        triggerToast("Bulk outstanding list copied to clipboard!");
    };

    // Generic Forms Submission
    const saveTransaction = async () => {
        if (!txForm.description || !txForm.amount) return;

        const payload: any = {
            description: txForm.description,
            amount: parseFloat(txForm.amount),
            type: txForm.type,
            category: txForm.category,
            date: txForm.date,
            is_recurring: false
        };

        let res;
        if (editingId) {
            res = await supabase.from("finance_transactions").update(payload).eq("id", editingId);
        } else {
            res = await supabase.from("finance_transactions").insert([payload]);
        }

        if (res.error) {
            console.error(res.error);
            alert("Error saving transaction");
        } else {
            triggerToast(editingId ? "Transaction updated" : "One-off transaction added");
            fetchTransactions();
            setIsAddTxOpen(false);
            resetTxForm();
        }
    };

    const saveSponsor = async () => {
        if (!sponsorForm.name || !sponsorForm.amount) return;

        let finalResponsibilities = sponsorForm.responsibilities || '';
        if (finalResponsibilities) {
            const lines = finalResponsibilities.split('\n').filter(Boolean);
            let existingDeliverables: any[] = [];
            if (editingId) {
                const oldSponsor = sponsors.find(s => s.id === editingId);
                if (oldSponsor && oldSponsor.responsibilities) {
                    try {
                        existingDeliverables = JSON.parse(oldSponsor.responsibilities);
                    } catch (e) {}
                }
            }
            const newDeliverables = lines.map(line => {
                const cleanText = line.replace(/^•\s*/, '').trim();
                const matched = existingDeliverables.find(item => item.text === cleanText);
                return {
                    text: cleanText,
                    completed: matched ? matched.completed : false
                };
            });
            finalResponsibilities = JSON.stringify(newDeliverables);
        }

        const payload: any = {
            name: sponsorForm.name,
            amount: parseFloat(sponsorForm.amount),
            frequency: sponsorForm.frequency,
            start_date: sponsorForm.startDate ? sponsorForm.startDate : null,
            end_date: sponsorForm.endDate ? sponsorForm.endDate : null,
            status: sponsorForm.status,
            description: sponsorForm.description || null,
            website: sponsorForm.website || null,
            responsibilities: finalResponsibilities || null,
            contract_url: sponsorForm.contractUrl || null,
            contract_name: sponsorForm.contractName || null
        };

        let res;
        if (editingId) {
            res = await supabase.from("sponsors").update(payload).eq("id", editingId);
        } else {
            res = await supabase.from("sponsors").insert([payload]);
        }

        if (res.error) {
            console.error(res.error);
            alert("Error saving sponsor");
        } else {
            triggerToast(editingId ? "Sponsor updated" : "Sponsor added");
            fetchSponsors();
            setIsAddSponsorOpen(false);
            resetSponsorForm();
        }
    };

    const saveSubsBaseline = async () => {
        const val = parseFloat(newSubsBaseline) || 0;
        const reg = parseFloat(newRegBaseline) || 0;
        const ses = parseFloat(newSessionBaseline) || 0;
        const mat = parseFloat(newMatchdayBaseline) || 0;
        
        localStorage.setItem(`clubflow_matchday_fee_${settings.name}`, mat.toString());
        setMatchdayFee(mat);

        await updateSettings({ 
            monthlySubs: val,
            registrationFee: reg,
            trainingFeePerSession: ses
        });
        setIsEditingSubs(false);
        triggerToast("Subscription baseline updated");
    };

    const saveCommitment = async () => {
        if (!commitmentForm.name || !commitmentForm.cost) return;

        const payload: any = {
            name: commitmentForm.name,
            cost: parseFloat(commitmentForm.cost),
            frequency: commitmentForm.frequency,
            next_payment_date: commitmentForm.nextPaymentDate,
            category: commitmentForm.category
        };

        let res;
        if (editingId) {
            res = await supabase.from("subscriptions").update(payload).eq("id", editingId);
        } else {
            res = await supabase.from("subscriptions").insert([payload]);
        }

        if (res.error) {
            console.error(res.error);
            alert("Error saving commitment");
        } else {
            triggerToast(editingId ? "Commitment updated" : "Commitment added");
            fetchSubscriptions();
            setIsAddCommitmentOpen(false);
            resetCommitmentForm();
        }
    };

    const saveCategory = () => {
        if (!newCategoryName.trim()) return;
        const name = newCategoryName.trim();
        const type = newCategoryType.toLowerCase() as "income" | "expense";
        
        const currentList = customCategories[type];
        if (currentList.includes(name) || (type === "income" ? DEFAULT_INCOME_CATEGORIES : DEFAULT_EXPENSE_CATEGORIES).includes(name)) {
            alert("Category already exists.");
            return;
        }

        const updated = {
            ...customCategories,
            [type]: [...currentList, name]
        };
        setCustomCategories(updated);
        localStorage.setItem(`clubflow_custom_categories_${settings.name}`, JSON.stringify(updated));
        setNewCategoryName("");
        setIsAddCategoryOpen(false);
        triggerToast(`Added custom category: ${name}`);
    };

    // Deletion handlers
    const deleteItem = async (id: string, type: "tx" | "sponsor" | "sub") => {
        if (!confirm(`Are you sure you want to delete this ${type === "tx" ? "transaction" : type === "sponsor" ? "sponsor" : "commitment"}?`)) return;

        let error;
        if (type === "tx") error = (await supabase.from("finance_transactions").delete().eq("id", id)).error;
        if (type === "sponsor") error = (await supabase.from("sponsors").delete().eq("id", id)).error;
        if (type === "sub") error = (await supabase.from("subscriptions").delete().eq("id", id)).error;

        if (error) {
            console.error(error);
            alert("Deletion failed.");
        } else {
            triggerToast("Successfully deleted");
            if (type === "tx") fetchTransactions();
            if (type === "sponsor") fetchSponsors();
            if (type === "sub") fetchSubscriptions();
        }
    };

    const deleteCategory = (name: string, type: "income" | "expense") => {
        if (!confirm(`Are you sure you want to delete the category "${name}"?`)) return;
        const updatedList = customCategories[type].filter(c => c !== name);
        const updated = {
            ...customCategories,
            [type]: updatedList
        };
        setCustomCategories(updated);
        localStorage.setItem(`clubflow_custom_categories_${settings.name}`, JSON.stringify(updated));
        triggerToast(`Removed custom category: ${name}`);
    };

    // Helper resets
    const resetTxForm = () => {
        setTxForm({ description: "", amount: "", type: "Expense", category: "Miscellaneous", date: new Date().toISOString().split("T")[0] });
        setEditingId(null);
    };

    const resetSponsorForm = () => {
        setSponsorForm({
            name: "",
            amount: "",
            frequency: "Yearly",
            startDate: new Date().toISOString().split("T")[0],
            endDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split("T")[0],
            status: "Secured",
            website: "",
            description: "",
            responsibilities: "",
            contractUrl: "",
            contractName: ""
        });
        setEditingId(null);
    };

    const resetCommitmentForm = () => {
        setCommitmentForm({
            name: "",
            cost: "",
            frequency: "Monthly",
            nextPaymentDate: new Date().toISOString().split("T")[0],
            category: "Pitch Hire"
        });
        setEditingId(null);
    };

    const triggerToast = (msg: string) => {
        setAlertMessage(msg);
        setTimeout(() => setAlertMessage(null), 3500);
    };

    const handleExportCSV = () => {
        if (filteredLedger.length === 0) {
            triggerToast("No transactions to export");
            return;
        }

        const headers = ["Date", "Description", "Category", "Type", "Amount (GBP)"];
        const rows = filteredLedger.map(t => [
            new Date(t.date).toLocaleDateString(),
            `"${t.description.replace(/"/g, '""')}"`,
            `"${t.category}"`,
            t.type,
            t.amount.toFixed(2)
        ]);

        const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `${settings.name.replace(/\s+/g, "_")}_transactions.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        triggerToast("Ledger data exported to CSV");
    };

    // Helpers to populate edit states
    const startEditTx = (t: Transaction) => {
        setTxForm({
            description: t.description,
            amount: t.amount.toString(),
            type: t.type,
            category: t.category,
            date: t.date
        });
        setEditingId(t.id);
        setIsAddTxOpen(true);
    };

    const startEditSponsor = (s: Sponsor) => {
        let editingResponsibilities = s.responsibilities || '';
        if (editingResponsibilities) {
            try {
                const parsed = JSON.parse(editingResponsibilities);
                if (Array.isArray(parsed)) {
                    editingResponsibilities = parsed.map(item => `• ${item.text}`).join('\n');
                }
            } catch (e) {
                // Keep as is
            }
        }

        setSponsorForm({
            name: s.name,
            amount: s.amount.toString(),
            frequency: s.frequency,
            startDate: s.startDate || "",
            endDate: s.endDate || "",
            status: s.status || "Secured",
            website: s.website || "",
            description: s.description || "",
            responsibilities: editingResponsibilities,
            contractUrl: s.contractUrl || "",
            contractName: s.contractName || ""
        });
        setEditingId(s.id);
        setIsAddSponsorOpen(true);
    };

    const startEditCommitment = (c: Subscription) => {
        setCommitmentForm({
            name: c.name,
            cost: c.cost.toString(),
            frequency: c.frequency,
            nextPaymentDate: c.nextPaymentDate || "",
            category: c.category
        });
        setEditingId(c.id);
        setIsAddCommitmentOpen(true);
    };

    // Filtered lists
    const filteredLedger = transactions.filter(t => {
        const matchesSearch = t.description.toLowerCase().includes(ledgerSearch.toLowerCase()) || 
                              t.category.toLowerCase().includes(ledgerSearch.toLowerCase());
        const matchesType = ledgerTypeFilter === "All" || t.type === ledgerTypeFilter;
        const matchesCategory = ledgerCategoryFilter === "All" || t.category === ledgerCategoryFilter;
        return matchesSearch && matchesType && matchesCategory;
    });

    const POSITION_ORDER: Record<string, number> = {
        "GK": 1,
        "LB": 2,
        "CB": 3,
        "RB": 4,
        "DEF": 5,
        "CDM": 6,
        "CM": 7,
        "CAM": 8,
        "MID": 9,
        "LW": 10,
        "RW": 11,
        "CF": 12,
        "FWD": 13
    };

    const filteredPlayers = players
        .filter(p => {
            const dues = getPlayerDuesForMonth(p);
            const name = `${p.firstName} ${p.lastName}`.toLowerCase();
            const matchesSearch = name.includes(subsSearch.toLowerCase());
            const matchesStatus = subsStatusFilter === "All" || dues.status === subsStatusFilter;
            return matchesSearch && matchesStatus;
        })
        .sort((a, b) => {
            const rankA = POSITION_ORDER[a.position] ?? 99;
            const rankB = POSITION_ORDER[b.position] ?? 99;
            if (rankA !== rankB) return rankA - rankB;
            return `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`);
        });

    return (
        <div className="space-y-6 max-w-7xl mx-auto pb-24 px-4 sm:px-6">
            
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 flex items-center gap-2">
                        <Landmark className="h-8 w-8 text-slate-800" />
                        Finance Hub
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">
                        Scalable treasury dashboard and player subscriptions manager for ClubFlow.
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button 
                        onClick={() => { resetTxForm(); setIsAddTxOpen(true); }}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium shadow flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm"
                    >
                        <Plus className="h-4 w-4" /> Add Transaction
                    </Button>
                    <Button 
                        onClick={() => { setWizardStep(1); setShowWizard(true); }}
                        variant="outline"
                        className="border-slate-200 hover:bg-slate-50 text-slate-700 font-medium flex items-center gap-2 px-3 py-2 rounded-xl text-sm"
                    >
                        <Settings className="h-4 w-4" /> Setup Wizard
                    </Button>
                </div>
            </div>

            {/* Global toast notification */}
            {alertMessage && (
                <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-5 py-3.5 rounded-2xl shadow-xl flex items-center gap-2 border border-slate-800 animate-in fade-in slide-in-from-bottom-4">
                    <Sparkles className="h-5 w-5 text-indigo-400 shrink-0" />
                    <span className="text-sm font-semibold">{alertMessage}</span>
                </div>
            )}

            {/* --- CLUB SETUP WIZARD OVERLAY --- */}
            {showWizard && (
                <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <Card className="w-full max-w-xl border-slate-800 bg-slate-950 text-white shadow-2xl overflow-hidden rounded-3xl">
                        <CardHeader className="bg-gradient-to-r from-slate-900 to-indigo-950 p-6 border-b border-slate-800/80">
                            <div className="flex items-center gap-2">
                                <Sparkles className="h-6 w-6 text-indigo-400" />
                                <CardTitle className="text-xl font-extrabold">Club Setup Wizard</CardTitle>
                            </div>
                            <CardDescription className="text-slate-400 mt-1">Set up your club's income and expense categories.</CardDescription>
                        </CardHeader>
                        <CardContent className="p-6 space-y-6">
                            
                            {/* Step Indicator */}
                            <div className="flex justify-between items-center text-xs font-semibold text-slate-500">
                                <span>Step {wizardStep} of 2</span>
                                <div className="flex gap-1">
                                    <div className={`h-1.5 w-6 rounded-full ${wizardStep >= 1 ? "bg-indigo-500" : "bg-slate-800"}`} />
                                    <div className={`h-1.5 w-6 rounded-full ${wizardStep >= 2 ? "bg-indigo-500" : "bg-slate-800"}`} />
                                </div>
                            </div>

                            {/* Step 1: Income Sources */}
                            {wizardStep === 1 && (
                                <div className="space-y-4">
                                    <div>
                                        <h3 className="text-md font-bold text-slate-200">What income sources does your club use?</h3>
                                        <p className="text-xs text-slate-400 mt-0.5">Select all that apply. We'll pre-populate your ledger categories.</p>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
                                        {DEFAULT_INCOME_CATEGORIES.map(cat => (
                                            <label 
                                                key={cat} 
                                                className={`flex items-center justify-between p-3.5 rounded-2xl border cursor-pointer transition-all ${
                                                    wizardIncome.includes(cat) 
                                                        ? "bg-indigo-950/40 border-indigo-500/80 text-white shadow-md shadow-indigo-950/20" 
                                                        : "border-slate-800 hover:border-slate-700 bg-slate-900/50 text-slate-300"
                                                }`}
                                            >
                                                <span className="text-sm font-semibold">{cat}</span>
                                                <input 
                                                    type="checkbox"
                                                    className="sr-only"
                                                    checked={wizardIncome.includes(cat)}
                                                    onChange={() => {
                                                        setWizardIncome(prev => 
                                                            prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
                                                        );
                                                    }}
                                                />
                                                <div className={`h-5 w-5 rounded-md border flex items-center justify-center transition-colors ${
                                                    wizardIncome.includes(cat) ? "bg-indigo-500 border-indigo-400 text-white" : "border-slate-700 bg-slate-950"
                                                }`}>
                                                    {wizardIncome.includes(cat) && <Check className="h-3.5 w-3.5 stroke-[3px]" />}
                                                </div>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Step 2: Expenses */}
                            {wizardStep === 2 && (
                                <div className="space-y-4">
                                    <div>
                                        <h3 className="text-md font-bold text-slate-200">What regular expenses do you pay?</h3>
                                        <p className="text-xs text-slate-400 mt-0.5">Select your primary costs to align your Commitments ledger.</p>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[300px] overflow-y-auto pr-1 no-scrollbar pt-2">
                                        {DEFAULT_EXPENSE_CATEGORIES.map(cat => (
                                            <label 
                                                key={cat} 
                                                className={`flex items-center justify-between p-3.5 rounded-2xl border cursor-pointer transition-all ${
                                                    wizardExpense.includes(cat) 
                                                        ? "bg-indigo-950/40 border-indigo-500/80 text-white shadow-md" 
                                                        : "border-slate-800 hover:border-slate-700 bg-slate-900/50 text-slate-300"
                                                }`}
                                            >
                                                <span className="text-sm font-semibold">{cat}</span>
                                                <input 
                                                    type="checkbox"
                                                    className="sr-only"
                                                    checked={wizardExpense.includes(cat)}
                                                    onChange={() => {
                                                        setWizardExpense(prev => 
                                                            prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
                                                        );
                                                    }}
                                                />
                                                <div className={`h-5 w-5 rounded-md border flex items-center justify-center transition-colors ${
                                                    wizardExpense.includes(cat) ? "bg-indigo-500 border-indigo-400 text-white" : "border-slate-700 bg-slate-950"
                                                }`}>
                                                    {wizardExpense.includes(cat) && <Check className="h-3.5 w-3.5 stroke-[3px]" />}
                                                </div>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Controls */}
                            <div className="flex items-center justify-between pt-4 border-t border-slate-900">
                                <Button 
                                    onClick={() => {
                                        if (wizardStep > 1) setWizardStep(1);
                                        else setShowWizard(false);
                                    }}
                                    variant="ghost"
                                    className="text-slate-400 hover:text-white rounded-xl"
                                >
                                    {wizardStep > 1 ? "Back" : "Skip Wizard"}
                                </Button>
                                <Button
                                    onClick={() => {
                                        if (wizardStep < 2) setWizardStep(2);
                                        else handleWizardComplete();
                                    }}
                                    className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl px-5 font-semibold"
                                >
                                    {wizardStep === 2 ? "Complete Setup" : "Next Step"}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* --- ACCOUNTING METHOD TOGGLE & TOOLTIP --- */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-50 border border-slate-200/80 p-4 rounded-2xl shadow-xs">
                <div>
                    <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-indigo-500" />
                        Club Accounting Engine
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                        {accountingMethod === "accrual" 
                            ? "Accrual Basis matches monthly forecasted/amortized revenues and commitments to show true operational run-rate." 
                            : "Cash Basis tracks actual money received and spent inside this current month's transactions."}
                    </p>
                </div>
                <div className="flex items-center gap-2 p-1 bg-slate-200/60 rounded-xl border border-slate-300/40">
                    <button
                        onClick={() => setAccountingMethod("accrual")}
                        className={`py-1.5 px-3.5 text-xs font-bold rounded-lg transition-all ${
                            accountingMethod === "accrual" 
                                ? "bg-slate-900 text-white shadow-xs" 
                                : "text-slate-600 hover:text-slate-900"
                        }`}
                    >
                        Accrual Basis
                    </button>
                    <button
                        onClick={() => setAccountingMethod("cash")}
                        className={`py-1.5 px-3.5 text-xs font-bold rounded-lg transition-all ${
                            accountingMethod === "cash" 
                                ? "bg-slate-900 text-white shadow-xs" 
                                : "text-slate-600 hover:text-slate-900"
                        }`}
                    >
                        Cash Basis
                    </button>
                </div>
            </div>

            {/* --- SECTION 1: FINANCIAL OVERVIEW METRICS (REDESIGNED) --- */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                
                {/* 1. BANK BALANCE / CASH RESERVES */}
                <Card className="border-slate-800 bg-gradient-to-br from-slate-900 via-indigo-950/20 to-slate-950 text-white shadow-xl overflow-hidden relative group hover:border-slate-700 transition-all">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/10 rounded-full blur-2xl group-hover:bg-indigo-500/20 transition-all" />
                    <CardHeader className="pb-2">
                        <div className="flex justify-between items-start">
                            <div>
                                <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-indigo-300">Bank Balance & Reserves</CardTitle>
                                <CardDescription className="text-[9px] text-slate-400">Total cleared funds</CardDescription>
                            </div>
                            <div className="p-2 bg-indigo-500/10 rounded-xl text-indigo-400">
                                <Wallet className="h-5 w-5" />
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            {isEditingBalance ? (
                                <div className="flex items-center gap-2">
                                    <span className="text-xl font-extrabold">£</span>
                                    <Input 
                                        type="number"
                                        value={newStartingBalance}
                                        onChange={e => setNewStartingBalance(e.target.value)}
                                        className="bg-slate-800 border-slate-700 text-white max-w-[140px] text-lg font-bold h-10 px-2 rounded-lg focus-visible:ring-indigo-500"
                                    />
                                    <Button size="sm" onClick={saveStartingBalance} className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs h-10 rounded-lg px-3">Save</Button>
                                    <Button size="icon" variant="ghost" onClick={() => setIsEditingBalance(false)} className="text-slate-400 hover:text-white h-10 w-10"><X className="h-4 w-4" /></Button>
                                </div>
                            ) : (
                                <div className="flex items-baseline gap-2">
                                    <span className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-100 to-indigo-200 bg-clip-text text-transparent">
                                        £{bankBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </span>
                                    <button 
                                        onClick={() => setIsEditingBalance(true)}
                                        className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold underline flex items-center gap-1 cursor-pointer"
                                    >
                                        <Pencil className="h-3 w-3" /> Edit
                                    </button>
                                </div>
                            )}
                            <p className="text-[9px] text-slate-400 mt-1.5 font-medium">Starting: £{(settings.financeStartingBalance || 0).toFixed(2)}</p>
                        </div>
                    </CardContent>
                </Card>

                {/* 2. RECURRING FORECASTS OR MONTHLY CASH FLOW */}
                <Card className="border-slate-200 shadow-md bg-white hover:shadow-lg transition-all relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-20 h-20 bg-slate-500/5 rounded-full blur-xl" />
                    <CardHeader className="pb-2">
                        <div className="flex justify-between items-start">
                            <div>
                                <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                                    {accountingMethod === "accrual" ? "Monthly Forecast (Accrual)" : "Cash Flow Actuals"}
                                </CardTitle>
                                <CardDescription className="text-[9px] text-slate-400">
                                    {accountingMethod === "accrual" ? "Monthly run-rate equivalent" : "Cleared this month"}
                                </CardDescription>
                            </div>
                            <div className="p-2 bg-slate-100 rounded-xl text-slate-600">
                                <ArrowRightLeft className="h-5 w-5" />
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex justify-between items-baseline">
                            <div>
                                <p className="text-[9px] uppercase font-bold text-slate-400">In / Out</p>
                                <div className="flex items-center gap-2 mt-0.5">
                                    <span className="text-md font-bold text-green-600">
                                        +£{Math.round(accountingMethod === "accrual" ? monthlyIncomeForecast : cashIncomeActual)}
                                    </span>
                                    <span className="text-slate-300">/</span>
                                    <span className="text-md font-bold text-red-500">
                                        -£{Math.round(accountingMethod === "accrual" ? monthlyExpensesCommitment : cashExpenseActual)}
                                    </span>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-[9px] uppercase font-bold text-slate-400">Net Profit</p>
                                <span className={`text-xl font-black ${
                                    (accountingMethod === "accrual" ? monthlyIncomeForecast - monthlyExpensesCommitment : cashIncomeActual - cashExpenseActual) >= 0 
                                        ? "text-green-600" 
                                        : "text-red-500"
                                }`}>
                                    {(accountingMethod === "accrual" ? monthlyIncomeForecast - monthlyExpensesCommitment : cashIncomeActual - cashExpenseActual) >= 0 ? "+" : ""}
                                    £{Math.round(accountingMethod === "accrual" ? monthlyIncomeForecast - monthlyExpensesCommitment : cashIncomeActual - cashExpenseActual)}
                                </span>
                            </div>
                        </div>
                        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                            <div 
                                className="h-full bg-green-500 transition-all duration-500" 
                                style={{ 
                                    width: `${
                                        (accountingMethod === "accrual" 
                                            ? monthlyIncomeForecast + monthlyExpensesCommitment 
                                            : cashIncomeActual + cashExpenseActual) > 0 
                                            ? ((accountingMethod === "accrual" ? monthlyIncomeForecast : cashIncomeActual) / 
                                               ((accountingMethod === "accrual" ? monthlyIncomeForecast : cashIncomeActual) + 
                                                (accountingMethod === "accrual" ? monthlyExpensesCommitment : cashExpenseActual))) * 100 
                                            : 50
                                    }%` 
                                }} 
                            />
                        </div>
                    </CardContent>
                </Card>

                {/* 3. CASH RUNWAY / HEALTH */}
                <Card className="border-slate-200 shadow-md bg-white hover:shadow-lg transition-all relative overflow-hidden group">
                    <CardHeader className="pb-2">
                        <div className="flex justify-between items-start">
                            <div>
                                <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Cash Runway & Subs Health</CardTitle>
                                <CardDescription className="text-[9px] text-slate-400">Safety net metrics</CardDescription>
                            </div>
                            <div className="p-2 bg-indigo-50 rounded-xl text-indigo-600">
                                <Calendar className="h-5 w-5" />
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div>
                            <div className="flex items-baseline justify-between">
                                <span className="text-2xl font-black text-slate-800">{runwayMonths} Months</span>
                                <span className="text-xs text-slate-500 font-semibold bg-slate-100 px-2 py-0.5 rounded-full">Runway</span>
                            </div>
                            <p className="text-[9px] text-slate-500 mt-1">Based on monthly fixed commitments of £{Math.round(monthlyExpensesCommitment)}</p>
                        </div>
                        
                        {settings.subsEnabled && (
                            <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                                <span className="text-[10px] text-slate-400 font-bold uppercase">Uncollected Subs:</span>
                                <span className="text-xs font-extrabold text-red-500 bg-red-50 px-2 py-0.5 rounded-lg">£{subsOverview.outstanding} Overdue</span>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* --- NAVIGATION TABS --- */}
            <div className="flex border-b border-slate-200 overflow-x-auto no-scrollbar py-1 gap-1">
                {[
                    { id: "overview", label: "Financial Overview", icon: Landmark },
                    { id: "subs", label: "Player Subs Tracker", icon: Users },
                    ...(settings.finesEnabled ? [{ id: "fines", label: "Fines Tracker", icon: AlertTriangle }] : []),
                    { id: "commitments", label: "Recurring Commitments", icon: Calendar },
                    { id: "ledger", label: "Transactions Ledger", icon: ArrowRightLeft },
                    { id: "sponsors", label: "Sponsors", icon: Sparkles },
                    { id: "fundraising", label: "Fundraising", icon: TrendingUp },
                    { id: "categories", label: "Categories", icon: Settings }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveSection(tab.id as any)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${
                            activeSection === tab.id 
                                ? "bg-slate-900 text-white shadow-sm" 
                                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                        }`}
                    >
                        <tab.icon className="h-4 w-4" />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* --- DETAILED VIEW DECIDER --- */}
            
            {/* VIEW 1: FINANCIAL OVERVIEW */}
            {activeSection === "overview" && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    
                    {/* Left: Quick overview cards */}
                    <div className="lg:col-span-2 space-y-6">
                        
                        {/* Core Questions panel */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Card className="border-indigo-100/50 bg-indigo-50/10 hover:shadow-md transition-shadow">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-xs font-bold text-indigo-900">How much money do we have?</CardTitle>
                                </CardHeader>
                                <CardContent className="text-xs text-indigo-950/80 leading-relaxed">
                                    We currently have <strong className="text-indigo-900 font-extrabold">£{bankBalance.toLocaleString()}</strong> in the club bank. This covers approximately <strong className="text-indigo-900 font-extrabold">{runwayMonths} months</strong> of normal operations.
                                </CardContent>
                            </Card>

                            <Card className="border-emerald-100 bg-emerald-50/10 hover:shadow-md transition-shadow">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-xs font-bold text-emerald-950">What money is coming in?</CardTitle>
                                </CardHeader>
                                <CardContent className="text-xs text-emerald-950/80 leading-relaxed">
                                    {accountingMethod === "accrual" ? (
                                        <>
                                            We project <strong className="text-emerald-950 font-extrabold">£{Math.round(monthlyIncomeForecast)}</strong> this month from player subscriptions, amortized sponsorship payouts, and recurring programs.
                                        </>
                                    ) : (
                                        <>
                                            We cleared <strong className="text-emerald-950 font-extrabold">£{Math.round(cashIncomeActual)}</strong> in real cash income this month.
                                        </>
                                    )}
                                </CardContent>
                            </Card>

                            <Card className="border-rose-100 bg-rose-50/10 hover:shadow-md transition-shadow">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-xs font-bold text-rose-950">What money is going out?</CardTitle>
                                </CardHeader>
                                <CardContent className="text-xs text-rose-950/80 leading-relaxed">
                                    {accountingMethod === "accrual" ? (
                                        <>
                                            Our regular recurring expenses and wage commitments total <strong className="text-rose-950 font-extrabold">£{Math.round(monthlyExpensesCommitment)}</strong> per month.
                                        </>
                                    ) : (
                                        <>
                                            We paid out <strong className="text-rose-950 font-extrabold">£{Math.round(cashExpenseActual)}</strong> in real cash expenses this month.
                                        </>
                                    )}
                                </CardContent>
                            </Card>

                            {settings.subsEnabled ? (
                                <Card className="border-amber-100 bg-amber-50/10 hover:shadow-md transition-shadow">
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-xs font-bold text-amber-950">Who still owes us money?</CardTitle>
                                    </CardHeader>
                                    <CardContent className="text-xs text-amber-950/80 leading-relaxed">
                                        There are currently <strong className="text-amber-950 font-extrabold">£{subsOverview.outstanding}</strong> in uncollected player subs this month. <button onClick={() => setActiveSection("subs")} className="text-amber-900 font-bold underline">Remind them now</button>.
                                    </CardContent>
                                </Card>
                            ) : (
                                <Card className="border-indigo-100 bg-indigo-50/10 hover:shadow-md transition-shadow">
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-xs font-bold text-indigo-950">Need sponsorships?</CardTitle>
                                    </CardHeader>
                                    <CardContent className="text-xs text-indigo-950/80 leading-relaxed">
                                        Check out the <button onClick={() => setActiveSection("sponsors")} className="text-indigo-950 font-bold underline">Sponsors tab</button> to track your club's sponsorship pipelines and deals.
                                    </CardContent>
                                </Card>
                            )}
                        </div>

                        {/* --- DETAILED ACCRUAL BASES BREAKDOWN PANEL --- */}
                        {accountingMethod === "accrual" && (
                            <Card className="border-indigo-100 shadow-md bg-indigo-50/5 overflow-hidden">
                                <CardHeader className="border-b bg-indigo-50/20 p-4">
                                    <div className="flex items-center gap-2">
                                        <Sparkles className="h-4 w-4 text-indigo-600" />
                                        <CardTitle className="text-sm font-bold text-indigo-950">Accrual Revenue & Expense Breakdowns</CardTitle>
                                    </div>
                                    <CardDescription className="text-[11px] text-indigo-900/60 mt-0.5">
                                        Amortization schedules and monthly-equivalent accounting logic
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="p-4 space-y-4">
                                    {/* Secured Sponsors Amortization Details */}
                                    <div className="space-y-2">
                                        <h4 className="text-xs font-bold text-indigo-900 flex justify-between">
                                            <span>1. Sponsor Contracts (Amortized Monthly)</span>
                                            <span className="text-[10px] text-indigo-700">Monthly recognized income</span>
                                        </h4>
                                        <div className="bg-white border border-indigo-100 rounded-xl overflow-hidden divide-y divide-slate-100">
                                            {sponsors.filter(s => s.status === "Secured").length === 0 ? (
                                                <div className="p-3 text-center text-slate-400 text-xs italic">No active secured sponsors.</div>
                                            ) : (
                                                sponsors.filter(s => s.status === "Secured").map(s => {
                                                    const monthlyRate = s.frequency === "Monthly" ? s.amount : s.frequency === "Yearly" ? s.amount / 12 : 0;
                                                    return (
                                                        <div key={s.id} className="p-3 flex justify-between items-center text-xs">
                                                            <div>
                                                                <span className="font-semibold text-slate-800">{s.name}</span>
                                                                <span className="text-[10px] text-slate-400 block mt-0.5">Contract: £{s.amount.toLocaleString()} ({s.frequency})</span>
                                                            </div>
                                                            <span className="font-bold text-emerald-600">+£{monthlyRate.toFixed(2)}/mo</span>
                                                        </div>
                                                    );
                                                })
                                            )}
                                        </div>
                                    </div>

                                    {/* Player Subs Dues */}
                                    {settings.subsEnabled && (
                                        <div className="space-y-2">
                                            <h4 className="text-xs font-bold text-indigo-900 flex justify-between">
                                                <span>2. Accrued Player Subscriptions</span>
                                                <span className="text-[10px] text-indigo-700">Dues expected this month</span>
                                            </h4>
                                            <div className="bg-white border border-indigo-100 rounded-xl p-3 text-xs space-y-2">
                                                <div className="flex justify-between">
                                                    <span className="text-slate-600">Expected Month Total:</span>
                                                    <span className="font-semibold text-slate-800">£{subsOverview.expected.toFixed(2)}</span>
                                                </div>
                                                <div className="flex justify-between text-[10px]">
                                                    <span className="text-slate-400">- Collected Cash:</span>
                                                    <span className="font-medium text-emerald-600">£{subsOverview.received.toFixed(2)}</span>
                                                </div>
                                                <div className="flex justify-between text-[10px]">
                                                    <span className="text-slate-400">- Accrued Outstanding:</span>
                                                    <span className="font-medium text-red-500">£{subsOverview.outstanding.toFixed(2)}</span>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Recurring commitments and bills */}
                                    <div className="space-y-2">
                                        <h4 className="text-xs font-bold text-indigo-900 flex justify-between">
                                            <span>3. Recurring Outgoing Commitments</span>
                                            <span className="text-[10px] text-indigo-700">Monthly amortized costs</span>
                                        </h4>
                                        <div className="bg-white border border-indigo-100 rounded-xl overflow-hidden divide-y divide-slate-100">
                                            {subscriptions.length === 0 && (!settings.contractsEnabled || players.filter(p => p.isContracted).length === 0) ? (
                                                <div className="p-3 text-center text-slate-400 text-xs italic">No recurring commitments.</div>
                                            ) : (
                                                <>
                                                    {subscriptions.map(sub => {
                                                        const monthlyRate = sub.frequency === "Monthly" ? sub.cost : sub.frequency === "Yearly" ? sub.cost / 12 : 0;
                                                        return (
                                                            <div key={sub.id} className="p-3 flex justify-between items-center text-xs">
                                                                <div>
                                                                    <span className="font-semibold text-slate-800">{sub.name}</span>
                                                                    <span className="text-[10px] text-slate-400 block mt-0.5">{sub.category} ({sub.frequency})</span>
                                                                </div>
                                                                <span className="font-bold text-red-500">-£{monthlyRate.toFixed(2)}/mo</span>
                                                            </div>
                                                        );
                                                    })}
                                                    {settings.contractsEnabled && players.filter(p => p.isContracted && p.contractAmount).map(p => {
                                                        const monthlyRate = p.contractFrequency === "Weekly" ? (p.contractAmount || 0) * 4.33 : (p.contractAmount || 0);
                                                        return (
                                                            <div key={p.id} className="p-3 flex justify-between items-center text-xs">
                                                                <div>
                                                                    <span className="font-semibold text-slate-800">Player wage: {p.firstName} {p.lastName}</span>
                                                                    <span className="text-[10px] text-slate-400 block mt-0.5">Contract: £{p.contractAmount} ({p.contractFrequency})</span>
                                                                </div>
                                                                <span className="font-bold text-red-500">-£{monthlyRate.toFixed(2)}/mo</span>
                                                            </div>
                                                        );
                                                    })}
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* Recent Transactions list */}
                        <Card className="border-slate-200/80 shadow-md">
                            <CardHeader className="border-b bg-slate-50/50 p-4">
                                <div className="flex justify-between items-center">
                                    <CardTitle className="text-xs font-bold">Recent Ledger Entries</CardTitle>
                                    <Button onClick={() => setActiveSection("ledger")} variant="link" className="text-xs font-bold text-indigo-600 h-auto p-0">View Ledger</Button>
                                </div>
                            </CardHeader>
                            <CardContent className="p-0">
                                {transactions.length === 0 ? (
                                    <div className="p-8 text-center text-slate-400 text-xs italic">No transactions recorded yet.</div>
                                ) : (
                                    <div className="divide-y divide-slate-100">
                                        {transactions.slice(0, 5).map(t => (
                                            <div key={t.id} className="p-3.5 flex items-center justify-between text-xs hover:bg-slate-50/50 transition-colors">
                                                <div className="flex items-center gap-3">
                                                    <div className={`p-2 rounded-xl shrink-0 ${t.type === "Income" ? "bg-green-50 text-green-600" : "bg-red-50 text-red-500"}`}>
                                                        {t.type === "Income" ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                                                    </div>
                                                    <div>
                                                        <p className="font-semibold text-slate-800">{t.description}</p>
                                                        <div className="flex gap-2 text-[10px] text-slate-400 font-medium mt-0.5">
                                                            <span>{new Date(t.date).toLocaleDateString()}</span>
                                                            <span>•</span>
                                                            <span>{t.category}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <span className={`font-bold ${t.type === "Income" ? "text-green-600" : "text-slate-800"}`}>
                                                    {t.type === "Income" ? "+" : "-"}£{t.amount.toFixed(2)}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {/* Right: Upcoming commitments list */}
                    <div className="lg:col-span-1 space-y-6">
                        <Card className="border-slate-200/80 shadow-md">
                            <CardHeader className="border-b bg-slate-50/50 p-4">
                                <CardTitle className="text-xs font-bold flex items-center gap-2">
                                    <Calendar className="h-4 w-4 text-indigo-500" />
                                    Upcoming Commitments
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-4 space-y-3">
                                {subscriptions.length === 0 ? (
                                    <div className="text-center py-6 text-slate-400 text-xs italic">No upcoming bills mapped.</div>
                                ) : (
                                    subscriptions.map(sub => {
                                        const nextDate = sub.nextPaymentDate ? new Date(sub.nextPaymentDate) : null;
                                        const isOverdue = nextDate && nextDate < new Date();
                                        
                                        return (
                                            <div key={sub.id} className="p-3.5 border border-slate-100 rounded-2xl flex justify-between items-start text-xs hover:border-slate-200 transition-all bg-white relative">
                                                <div>
                                                    <h4 className="font-bold text-slate-800">{sub.name}</h4>
                                                    <div className="flex gap-1.5 items-center mt-1">
                                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{sub.category}</span>
                                                        {nextDate && (
                                                            <>
                                                                <span className="text-slate-300">•</span>
                                                                <span className={`text-[10px] font-semibold ${isOverdue ? "text-red-500 font-bold" : "text-slate-500"}`}>
                                                                    Due {nextDate.toLocaleDateString()}
                                                                </span>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <span className="font-extrabold text-slate-800">£{sub.cost}</span>
                                                    {isOverdue && (
                                                        <span className="block text-[8px] bg-red-100 text-red-800 font-extrabold px-1 rounded-full uppercase mt-1">Overdue</span>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            )}

            {/* VIEW 2: PLAYER SUBS TRACKER */}
            {activeSection === "subs" && (
                !settings.subsEnabled ? (
                    <Card className="border-slate-200 shadow-md">
                        <CardContent className="p-8 text-center flex flex-col items-center justify-center max-w-md mx-auto space-y-4">
                            <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600">
                                <Users className="h-6 w-6" />
                            </div>
                            <h3 className="text-base font-bold text-slate-800">Player Subscriptions Disabled</h3>
                            <p className="text-xs text-slate-500 leading-relaxed">
                                Player subscriptions tracking is currently disabled for this club. You can enable it in the settings tab to configure monthly fees, registration fees, and training session billing.
                            </p>
                            <Button 
                                onClick={() => setActiveSection("categories")}
                                className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-4 py-2 rounded-xl"
                            >
                                Go to Settings
                            </Button>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="space-y-6">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 pb-4">
                        <div>
                            <h3 className="text-lg font-bold text-slate-900">Player Subs Tracker</h3>
                            <p className="text-xs text-slate-500 mt-0.5">Track monthly player fees, outstanding debts, and copy reminders.</p>
                        </div>
                        <div className="flex items-center gap-4 bg-slate-50 border border-slate-200/80 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-700 shadow-xs shrink-0">
                            {isEditingSubs ? (
                                <div className="flex flex-wrap items-center gap-3">
                                    <div className="flex items-center gap-1.5 mr-1">
                                        <span className="text-[10px] text-slate-400 uppercase font-bold">Structure:</span>
                                        <select
                                            value={subsStructure}
                                            onChange={e => {
                                                const struct = e.target.value as any;
                                                setSubsStructure(struct);
                                                localStorage.setItem(`clubflow_subs_structure_${settings.name}`, struct);
                                            }}
                                            className="h-7 bg-white border border-slate-200 text-slate-800 text-xs px-2 rounded-lg font-bold focus:outline-none"
                                        >
                                            <option value="Monthly">Monthly charge in total</option>
                                            <option value="Training">Just training fee subs</option>
                                            <option value="Matchday">Just matchday subs</option>
                                            <option value="Both">Both training & matchday subs</option>
                                        </select>
                                    </div>
                                    {(subsStructure === "Monthly") && (
                                        <div className="flex items-center gap-1">
                                            <span className="text-[10px] text-slate-400 uppercase font-bold">Monthly:</span>
                                            <span className="text-slate-500">£</span>
                                            <Input
                                                type="number"
                                                value={newSubsBaseline}
                                                onChange={e => setNewSubsBaseline(e.target.value)}
                                                className="h-7 w-14 bg-white border-slate-200 text-slate-800 text-xs px-1 text-center font-bold"
                                            />
                                        </div>
                                    )}
                                    <div className="flex items-center gap-1">
                                        <span className="text-[10px] text-slate-400 uppercase font-bold">Reg Fee:</span>
                                        <span className="text-slate-500">£</span>
                                        <Input
                                            type="number"
                                            value={newRegBaseline}
                                            onChange={e => setNewRegBaseline(e.target.value)}
                                            className="h-7 w-14 bg-white border-slate-200 text-slate-800 text-xs px-1 text-center font-bold"
                                        />
                                    </div>
                                    {(subsStructure === "Training" || subsStructure === "Both") && (
                                        <div className="flex items-center gap-1">
                                            <span className="text-[10px] text-slate-400 uppercase font-bold">Training:</span>
                                            <span className="text-slate-500">£</span>
                                            <Input
                                                type="number"
                                                value={newSessionBaseline}
                                                onChange={e => setNewSessionBaseline(e.target.value)}
                                                className="h-7 w-14 bg-white border-slate-200 text-slate-800 text-xs px-1 text-center font-bold"
                                            />
                                        </div>
                                    )}
                                    {(subsStructure === "Matchday" || subsStructure === "Both") && (
                                        <div className="flex items-center gap-1">
                                            <span className="text-[10px] text-slate-400 uppercase font-bold">Matchday:</span>
                                            <span className="text-slate-500">£</span>
                                            <Input
                                                type="number"
                                                value={newMatchdayBaseline}
                                                onChange={e => setNewMatchdayBaseline(e.target.value)}
                                                className="h-7 w-14 bg-white border-slate-200 text-slate-800 text-xs px-1 text-center font-bold"
                                            />
                                        </div>
                                    )}
                                    <Button size="sm" onClick={saveSubsBaseline} className="bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] px-2 h-7 font-bold">Save</Button>
                                    <Button size="icon" variant="ghost" onClick={() => setIsEditingSubs(false)} className="h-7 w-7"><X className="h-3 w-3" /></Button>
                                </div>
                            ) : (
                                <div className="flex flex-wrap items-center gap-4">
                                    <div className="flex items-center gap-1">
                                        <span className="text-[10px] text-slate-400 uppercase font-bold">Billing Model:</span>
                                        <span className="font-extrabold bg-indigo-50 border border-indigo-100 rounded-lg px-2 py-0.5 text-indigo-700 text-[10px]">
                                            {subsStructure === "Monthly" ? "Monthly Subs" :
                                             subsStructure === "Training" ? "Training Only" :
                                             subsStructure === "Matchday" ? "Matchday Only" :
                                             "Both Training & Matchday"}
                                        </span>
                                    </div>
                                    {subsStructure === "Monthly" && (
                                        <div className="flex items-center gap-1.5 border-l border-slate-200 pl-3">
                                            <span className="text-slate-500 font-medium">Monthly Subs:</span>
                                            <span className="font-extrabold bg-indigo-50 border border-indigo-100 rounded px-1.5 py-0.5 text-indigo-700">£{settings.monthlySubs || 0}</span>
                                        </div>
                                    )}
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-slate-500 font-medium">Reg Fee:</span>
                                        <span className="font-extrabold bg-emerald-50 border border-emerald-100 rounded px-1.5 py-0.5 text-emerald-700">£{settings.registrationFee || 0}</span>
                                    </div>
                                    {(subsStructure === "Training" || subsStructure === "Both") && (
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-slate-500 font-medium">Training Fee:</span>
                                            <span className="font-extrabold bg-amber-50 border border-amber-100 rounded px-1.5 py-0.5 text-amber-700">£{settings.trainingFeePerSession || 0}</span>
                                        </div>
                                    )}
                                    {(subsStructure === "Matchday" || subsStructure === "Both") && (
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-slate-500 font-medium">Matchday Fee:</span>
                                            <span className="font-extrabold bg-rose-50 border border-rose-100 rounded px-1.5 py-0.5 text-rose-700">£{matchdayFee || 0}</span>
                                        </div>
                                    )}
                                    <button 
                                        onClick={() => { 
                                            setNewSubsBaseline((settings.monthlySubs || 0).toString()); 
                                            setNewRegBaseline((settings.registrationFee || 0).toString());
                                            setNewSessionBaseline((settings.trainingFeePerSession || 0).toString());
                                            setNewMatchdayBaseline((matchdayFee || 0).toString());
                                            setIsEditingSubs(true); 
                                        }}
                                        className="text-[10px] text-indigo-600 hover:text-indigo-800 underline font-extrabold ml-1"
                                    >
                                        Edit Fees
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                    
                    {/* Player Subs Stats */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <Card className="p-4 border-slate-200/80 shadow">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Expected This Month</p>
                            <p className="text-2xl font-black text-slate-800 mt-1">£{subsOverview.expected}</p>
                        </Card>
                        <Card className="p-4 border-slate-200/80 shadow">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Received This Month</p>
                            <p className="text-2xl font-black text-green-600 mt-1">£{subsOverview.received}</p>
                        </Card>
                        <Card className="p-4 border-slate-200/80 shadow">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Outstanding Subs</p>
                            <p className="text-2xl font-black text-red-500 mt-1">£{subsOverview.outstanding}</p>
                        </Card>
                        <Card className="p-4 border-slate-200/80 shadow flex items-center justify-between">
                            <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Collection Rate</p>
                                <p className="text-2xl font-black text-indigo-600 mt-1">{subsOverview.rate}%</p>
                            </div>
                            <div className="w-10 h-10 rounded-full border-4 border-indigo-100 flex items-center justify-center font-bold text-[10px] text-indigo-600">
                                {subsOverview.rate}%
                            </div>
                        </Card>
                    </div>

                    {/* Filter and Bulk reminder tools */}
                    <Card className="p-4 border-slate-200/80 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex flex-1 items-center gap-3">
                            <div className="relative flex-1 max-w-sm">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
                                <Input 
                                    placeholder="Search player name..."
                                    value={subsSearch}
                                    onChange={e => setSubsSearch(e.target.value)}
                                    className="pl-9 bg-slate-50 border-slate-200 h-10 rounded-xl focus-visible:ring-indigo-500"
                                />
                            </div>
                            <select
                                value={subsStatusFilter}
                                onChange={e => setSubsStatusFilter(e.target.value as any)}
                                className="px-3 py-2 border rounded-xl bg-slate-50 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            >
                                <option value="All">All Statuses</option>
                                <option value="Paid">Paid</option>
                                <option value="Part Paid">Part Paid</option>
                                <option value="Outstanding">Outstanding</option>
                            </select>
                        </div>
                        <div className="flex gap-2">
                            <Button
                                onClick={handleResetSubs}
                                disabled={isResetting}
                                className="bg-red-50 hover:bg-red-100 text-red-700 font-bold border border-red-100 flex items-center gap-2 h-10 rounded-xl px-4 text-xs"
                            >
                                <RotateCcw className="h-4 w-4" /> {isResetting ? "Resetting..." : "Reset Subs"}
                            </Button>
                            <Button 
                                onClick={copyBulkReminder}
                                className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold border border-indigo-100 flex items-center gap-2 h-10 rounded-xl px-4 text-xs"
                            >
                                <Share2 className="h-4 w-4" /> Copy Outstanding List
                            </Button>
                        </div>
                    </Card>

                    {/* Player Tracker Table */}
                    <Card className="border-slate-200 shadow-md overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs text-left">
                                <thead className="bg-slate-50 border-b border-slate-100 text-[10px] text-slate-500 uppercase font-bold tracking-wider">
                                    <tr>
                                        <th className="px-6 py-4">Player</th>
                                        <th className="px-6 py-4">Monthly Fee</th>
                                        <th className="px-6 py-4 text-center">Current Paid</th>
                                        <th className="px-6 py-4 text-center">Outstanding</th>
                                        <th className="px-6 py-4 text-center">Status</th>
                                        <th className="px-6 py-4 text-center">Reg Fee</th>
                                        <th className="px-6 py-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 bg-white">
                                    {filteredPlayers.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="px-6 py-8 text-center text-slate-400 italic">No matching players found.</td>
                                        </tr>
                                    ) : (
                                        filteredPlayers.map(player => {
                                            const dues = getPlayerDuesForMonth(player);
                                            
                                            return (
                                                <tr key={player.id} className="hover:bg-slate-50/50 transition-colors">
                                                    <td className="px-6 py-4 font-semibold text-slate-900 flex items-center gap-3">
                                                        <div className="h-8 w-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs uppercase">
                                                            {player.firstName[0]}{player.lastName[0]}
                                                        </div>
                                                        <div>
                                                            <p className="font-semibold">{player.firstName} {player.lastName}</p>
                                                            <span className="text-[9px] uppercase tracking-wider text-slate-400">{player.position}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 font-bold text-slate-600">
                                                        <div className="flex flex-col">
                                                             <div className="flex items-center gap-1.5 group">
                                                                 <span>{player.subsBillingModel === "Exempt" ? "—" : `£${dues.expected}`}</span>
                                                                 {settings.subsEnabled && (
                                                                     <button 
                                                                         onClick={() => handleOpenSubSettingsModal(player)}
                                                                         className="text-slate-400 hover:text-indigo-600 p-0.5 rounded hover:bg-slate-100 transition-colors opacity-100 md:opacity-0 md:group-hover:opacity-100 focus:opacity-100"
                                                                         title="Adjust Player Subs Fee / Billing Model"
                                                                     >
                                                                         <Pencil className="h-3.5 w-3.5" />
                                                                     </button>
                                                                 )}
                                                             </div>
                                                             <div className="flex flex-wrap gap-1 mt-0.5">
                                                                 {settings.contractsEnabled && player.isContracted && (
                                                                     <span className="text-[8px] text-red-500 font-bold bg-red-50 border border-red-100 rounded px-1.5 py-0.2">
                                                                         Contract (£{player.contractAmount}/{player.contractFrequency === "Weekly" ? "wk" : "mo"})
                                                                     </span>
                                                                 )}
                                                                 {settings.subsEnabled && player.subsBillingModel === "Pay-As-You-Go" && (
                                                                     <span className="text-[8px] text-indigo-600 font-semibold bg-indigo-50 border border-indigo-100/55 rounded px-1.5 py-0.2">
                                                                         PAYG ({getPlayerAttendedSessionsCount(player)} sessions)
                                                                     </span>
                                                                 )}
                                                                 {settings.subsEnabled && player.subsBillingModel === "Matchday-PAYG" && (
                                                                     <span className="text-[8px] text-rose-600 font-semibold bg-rose-50 border border-rose-100/55 rounded px-1.5 py-0.2">
                                                                         Matchday PAYG ({getPlayerMatchesCount(player)} matches)
                                                                     </span>
                                                                 )}
                                                                 {settings.subsEnabled && player.subsBillingModel === "Both-PAYG" && (
                                                                     <span className="text-[8px] text-teal-600 font-semibold bg-teal-50 border border-teal-100/55 rounded px-1.5 py-0.2">
                                                                         Both PAYG ({getPlayerAttendedSessionsCount(player)}s / {getPlayerMatchesCount(player)}m)
                                                                     </span>
                                                                 )}
                                                                 {settings.subsEnabled && player.subsBillingModel === "Monthly" && player.subsCustomAmount !== undefined && player.subsCustomAmount !== null && player.subsCustomAmount > 0 && (
                                                                     <span className="text-[8px] text-amber-600 font-semibold bg-amber-50 border border-amber-100/55 rounded px-1.5 py-0.2">
                                                                         custom rate
                                                                     </span>
                                                                 )}
                                                                 {settings.subsEnabled && player.subsBillingModel === "Exempt" && (
                                                                     <span className="text-[8px] text-slate-500 font-semibold bg-slate-100 border border-slate-200 rounded px-1.5 py-0.2">
                                                                         exempt
                                                                     </span>
                                                                 )}
                                                             </div>
                                                         </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-center text-green-600 font-extrabold">{player.subsBillingModel === "Exempt" ? "—" : `£${dues.paid}`}</td>
                                                    <td className="px-6 py-4 text-center text-red-500 font-extrabold">{player.subsBillingModel === "Exempt" ? "—" : `£${dues.outstanding}`}</td>
                                                    <td className="px-6 py-4 text-center">
                                                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[9px] font-bold uppercase ${
                                                            dues.status === "Exempt" ? "bg-slate-100 text-slate-600 border border-slate-200" :
                                                            dues.status === "Paid" ? "bg-green-100 text-green-800" :
                                                            dues.status === "Part Paid" ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-800"
                                                        }`}>
                                                            {dues.status}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-center">
                                                        {player.subsBillingModel === "Exempt" ? (
                                                            <span className="text-[10px] text-slate-400">Exempt</span>
                                                        ) : settings.registrationFee && settings.registrationFee > 0 ? (
                                                            (() => {
                                                                const reg = getPlayerRegistrationStatus(player);
                                                                return reg.isPaid ? (
                                                                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-bold text-emerald-700 border border-emerald-100">
                                                                        <CheckCircle2 className="h-3 w-3" /> Paid
                                                                    </span>
                                                                ) : (
                                                                    <div className="flex flex-col items-center gap-1">
                                                                        <span className="text-[10px] font-bold text-red-500">£{reg.expected - reg.paid} Due</span>
                                                                        <Button
                                                                            size="sm"
                                                                            onClick={() => handleMarkRegPaid(player)}
                                                                            className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[9px] px-1.5 py-0 h-5 border border-indigo-100 rounded font-semibold"
                                                                        >
                                                                            Mark Paid
                                                                        </Button>
                                                                    </div>
                                                                );
                                                            })()
                                                        ) : (
                                                            <span className="text-[10px] text-slate-400">N/A</span>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <div className="flex justify-end gap-1.5">
                                                            <Button 
                                                                size="sm" 
                                                                onClick={() => handleQuickPay(player)} 
                                                                disabled={dues.outstanding <= 0 || player.subsBillingModel === "Exempt"}
                                                                className="bg-green-600 hover:bg-green-700 text-white font-bold text-[10px] px-2 py-1 h-7 rounded-lg disabled:opacity-50"
                                                            >
                                                                Mark Paid
                                                            </Button>
                                                            <Button 
                                                                size="sm" 
                                                                variant="outline" 
                                                                onClick={() => handleOpenPaymentModal(player)}
                                                                disabled={player.subsBillingModel === "Exempt"}
                                                                className="border-slate-200 text-slate-700 text-[10px] px-2 py-1 h-7 rounded-lg hover:bg-slate-50 disabled:opacity-50"
                                                            >
                                                                Add Custom
                                                            </Button>
                                                            {player.subsBillingModel !== "Exempt" && dues.outstanding > 0 && (
                                                                <Button 
                                                                    size="sm" 
                                                                    variant="outline" 
                                                                    onClick={() => copyReminderForPlayer(player)}
                                                                    title="Copy Friendly Reminder Message"
                                                                    className="border-indigo-100 text-indigo-700 hover:bg-indigo-50 text-[10px] px-2 py-1 h-7 rounded-lg flex items-center gap-1"
                                                                >
                                                                    <MessageSquare className="h-3.5 w-3.5" />
                                                                    <span>Remind</span>
                                                                </Button>
                                                            )}
                                                            <Button 
                                                                size="icon" 
                                                                variant="ghost" 
                                                                onClick={() => setViewingHistoryPlayer(viewingHistoryPlayer?.id === player.id ? null : player)}
                                                                className="h-7 w-7 text-slate-400 hover:text-slate-700"
                                                                title="View Payment History"
                                                            >
                                                                <FileText className="h-4 w-4" />
                                                            </Button>
                                                            <Button 
                                                                size="icon" 
                                                                variant="ghost" 
                                                                onClick={() => copyWhatsAppReminder(player)}
                                                                disabled={dues.outstanding <= 0}
                                                                className="h-7 w-7 text-slate-400 hover:text-indigo-600"
                                                                title="Copy WhatsApp Reminder"
                                                            >
                                                                <MessageSquare className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </Card>

                    {/* Expandable Player Dues History Panel */}
                    {viewingHistoryPlayer && (
                        <Card className="border-slate-200/80 shadow-md">
                            <CardHeader className="bg-slate-50/50 p-4 border-b flex flex-row justify-between items-center">
                                <div>
                                    <CardTitle className="text-sm font-bold">Payment History for {viewingHistoryPlayer.firstName} {viewingHistoryPlayer.lastName}</CardTitle>
                                    <p className="text-[10px] text-slate-400 mt-0.5">List of all logged payments mapped to this player.</p>
                                </div>
                                <Button size="icon" variant="ghost" onClick={() => setViewingHistoryPlayer(null)} className="h-7 w-7"><X className="h-4 w-4" /></Button>
                            </CardHeader>
                            <CardContent className="p-0">
                                {getPlayerDuesForMonth(viewingHistoryPlayer).payments.length === 0 ? (
                                    <div className="p-8 text-center text-slate-400 text-xs italic">No payments logged for this player in current period.</div>
                                ) : (
                                    <div className="divide-y divide-slate-100">
                                        {getPlayerDuesForMonth(viewingHistoryPlayer).payments.map(payment => (
                                            <div key={payment.id} className="p-3.5 flex justify-between items-center text-xs">
                                                <div>
                                                    <p className="font-semibold text-slate-800">{payment.description}</p>
                                                    <span className="text-[9px] text-slate-400">{new Date(payment.date).toLocaleDateString()}</span>
                                                </div>
                                                <span className="font-extrabold text-green-600">+£{payment.amount.toFixed(2)}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )}

                    {/* Custom Player Payment Dialog Popup */}
                    {selectedPlayerForPayment && (
                        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
                            <Card className="w-full max-w-sm border-slate-200 bg-white text-slate-800 shadow-xl overflow-hidden rounded-2xl">
                                <CardHeader className="bg-slate-50 border-b border-slate-100 p-4">
                                    <div className="flex justify-between items-center">
                                        <CardTitle className="text-sm font-bold">Add Payment: {selectedPlayerForPayment.firstName}</CardTitle>
                                        <Button size="icon" variant="ghost" onClick={() => setSelectedPlayerForPayment(null)} className="h-7 w-7"><X className="h-4 w-4" /></Button>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-4 space-y-4">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold uppercase text-slate-400">Amount Paid</label>
                                        <Input 
                                            type="number"
                                            value={playerPaymentForm.amount}
                                            onChange={e => setPlayerPaymentForm({ ...playerPaymentForm, amount: e.target.value })}
                                            className="bg-slate-50 border-slate-200 h-10 rounded-xl"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold uppercase text-slate-400">Payment Date</label>
                                        <Input 
                                            type="date"
                                            value={playerPaymentForm.date}
                                            onChange={e => setPlayerPaymentForm({ ...playerPaymentForm, date: e.target.value })}
                                            className="bg-slate-50 border-slate-200 h-10 rounded-xl"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold uppercase text-slate-400">Notes / Period</label>
                                        <Input 
                                            placeholder="e.g. Month of June"
                                            value={playerPaymentForm.notes}
                                            onChange={e => setPlayerPaymentForm({ ...playerPaymentForm, notes: e.target.value })}
                                            className="bg-slate-50 border-slate-200 h-10 rounded-xl"
                                        />
                                    </div>
                                    <Button 
                                        onClick={handleSavePlayerPayment}
                                        className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold h-11 rounded-xl shadow-md mt-2"
                                    >
                                        Submit Payment Log
                                    </Button>
                                </CardContent>
                            </Card>
                        </div>
                    )}

                    {/* Adjust Player Subscription Settings Popup */}
                    {editingSubPlayer && (
                        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
                            <Card className="w-full max-w-sm border-slate-200 bg-white text-slate-800 shadow-xl overflow-hidden rounded-2xl">
                                <CardHeader className="bg-slate-50 border-b border-slate-100 p-4">
                                    <div className="flex justify-between items-center">
                                        <CardTitle className="text-sm font-bold">Adjust Sub: {editingSubPlayer.firstName} {editingSubPlayer.lastName}</CardTitle>
                                        <Button size="icon" variant="ghost" onClick={() => setEditingSubPlayer(null)} className="h-7 w-7"><X className="h-4 w-4" /></Button>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-4 space-y-4">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold uppercase text-slate-400 font-medium">Billing Model</label>
                                        <select
                                            value={subFormModel}
                                            onChange={e => {
                                                const val = e.target.value as any;
                                                setSubFormModel(val);
                                                if (val === "Exempt") {
                                                    setSubFormAmount("0");
                                                }
                                            }}
                                            className="w-full h-10 px-3 border border-slate-200 rounded-xl text-xs bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        >
                                            <option value="Monthly">Flat Monthly Subs</option>
                                            <option value="Pay-As-You-Go">Pay-As-You-Go (Per Session)</option>
                                            <option value="Matchday-PAYG">Matchday-PAYG (Per Match)</option>
                                            <option value="Both-PAYG">Both PAYG (Sessions + Matches)</option>
                                            <option value="Exempt">Exempt (No Fee)</option>
                                        </select>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold uppercase text-slate-400 font-medium">
                                            {subFormModel === "Pay-As-You-Go" ? "Custom Session Fee (£)" :
                                             subFormModel === "Matchday-PAYG" ? "Custom Matchday Fee (£)" :
                                             subFormModel === "Both-PAYG" ? "Custom Matchday Fee (£) (Session fee uses default)" :
                                             "Custom Monthly Sub (£)"}
                                        </label>
                                        <Input 
                                            type="number"
                                            value={subFormAmount}
                                            onChange={e => setSubFormAmount(e.target.value)}
                                            placeholder={subFormModel === "Exempt" ? "0" : "e.g. 10.00"}
                                            disabled={subFormModel === "Exempt"}
                                            className="bg-slate-50 border-slate-200 h-10 rounded-xl disabled:opacity-50"
                                        />
                                        <p className="text-[10px] text-slate-400 leading-normal">
                                            {subFormModel === "Exempt" 
                                                ? "Player is exempt from all subscriptions."
                                                : subFormModel === "Pay-As-You-Go" ? `Set to 0 to use default (£${settings.trainingFeePerSession || 0}/session).`
                                                : subFormModel === "Matchday-PAYG" ? `Set to 0 to use default (£${matchdayFee || 10}/match).`
                                                : subFormModel === "Both-PAYG" ? `Set to 0 to use defaults (£${settings.trainingFeePerSession || 0}/session + £${matchdayFee || 10}/match).`
                                                : `Set to 0 to use default (£${settings.monthlySubs || 0}/month).`
                                            }
                                        </p>
                                    </div>

                                    {(subFormModel === "Pay-As-You-Go" || subFormModel === "Both-PAYG") && (
                                        <div className="space-y-1 bg-amber-50/50 p-2.5 rounded-xl border border-amber-100/50">
                                            <label className="text-[10px] font-bold uppercase text-amber-800">Training Sessions Attended (This Month)</label>
                                            <Input 
                                                type="number"
                                                value={subFormTrainingOverride}
                                                onChange={e => setSubFormTrainingOverride(e.target.value)}
                                                className="bg-white border-amber-200 h-9 rounded-lg text-xs"
                                            />
                                            <p className="text-[9px] text-amber-600 font-medium">Leave as default attendance or type custom count.</p>
                                        </div>
                                    )}

                                    {(subFormModel === "Matchday-PAYG" || subFormModel === "Both-PAYG") && (
                                        <div className="space-y-1 bg-rose-50/50 p-2.5 rounded-xl border border-rose-100/55">
                                            <label className="text-[10px] font-bold uppercase text-rose-800">Matches Played (This Month)</label>
                                            <Input 
                                                type="number"
                                                value={subFormMatchesOverride}
                                                onChange={e => setSubFormMatchesOverride(e.target.value)}
                                                className="bg-white border-rose-200 h-9 rounded-lg text-xs"
                                            />
                                            <p className="text-[9px] text-rose-600 font-medium">Leave as default match occurrences or type custom count.</p>
                                        </div>
                                    )}

                                    <Button 
                                        onClick={handleSaveSubSettings}
                                        disabled={isSavingSub}
                                        className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold h-11 rounded-xl shadow-md mt-2"
                                    >
                                        {isSavingSub ? "Saving..." : "Save Sub Settings"}
                                    </Button>
                                </CardContent>
                            </Card>
                        </div>
                    )}
                </div>
                )
            )}

            {/* VIEW 3: RECURRING COMMITMENTS */}
            {activeSection === "commitments" && (
                <div className="space-y-6">
                    <div className="flex justify-between items-center">
                        <div>
                            <h3 className="text-lg font-bold text-slate-900">Fixed Recurring Expense Commitments</h3>
                            <p className="text-xs text-slate-500 mt-0.5">Fixed costs like Pitch Hire, Training facilities, or Insurance templates.</p>
                        </div>
                        <Button 
                            onClick={() => { resetCommitmentForm(); setIsAddCommitmentOpen(true); }}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs flex items-center gap-2 rounded-xl"
                        >
                            <Plus className="h-4 w-4" /> Add Commitment
                        </Button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {subscriptions.length === 0 ? (
                            <div className="col-span-full py-12 text-center text-slate-400 text-xs italic">No commitments mapped. Click above to add some.</div>
                        ) : (
                            subscriptions.map(sub => (
                                <Card key={sub.id} className="border-slate-200 shadow-md hover:shadow-lg transition-all relative overflow-hidden group">
                                    <div className="h-1.5 w-full bg-rose-500" />
                                    <CardContent className="p-4 space-y-4">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <h4 className="font-extrabold text-slate-800 text-sm">{sub.name}</h4>
                                                <span className="inline-block text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-1">{sub.category}</span>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-lg font-black text-slate-900">£{sub.cost}</span>
                                                <p className="text-[9px] text-slate-400 font-semibold uppercase">{sub.frequency}</p>
                                            </div>
                                        </div>

                                        <div className="flex justify-between items-center text-xs pt-3 border-t border-slate-100">
                                            <span className="text-slate-500">Next Due:</span>
                                            <span className="font-bold text-slate-800">{sub.nextPaymentDate ? new Date(sub.nextPaymentDate).toLocaleDateString() : "N/A"}</span>
                                        </div>

                                        <div className="flex justify-end gap-2 pt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Button 
                                                size="sm" 
                                                variant="ghost" 
                                                onClick={() => startEditCommitment(sub)}
                                                className="h-8 text-indigo-600 hover:text-indigo-800 p-2"
                                            >
                                                <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                                            </Button>
                                            <Button 
                                                size="sm" 
                                                variant="ghost" 
                                                onClick={() => deleteItem(sub.id, "sub")}
                                                className="h-8 text-red-500 hover:text-red-700 p-2"
                                            >
                                                <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))
                        )}
                    </div>

                    {/* Add/Edit Commitment Overlay */}
                    {isAddCommitmentOpen && (
                        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
                            <Card className="w-full max-w-sm border-slate-200 bg-white text-slate-800 shadow-xl overflow-hidden rounded-2xl">
                                <CardHeader className="bg-slate-50 border-b border-slate-100 p-4">
                                    <div className="flex justify-between items-center">
                                        <CardTitle className="text-sm font-bold">{editingId ? "Edit" : "Add"} Commitment</CardTitle>
                                        <Button size="icon" variant="ghost" onClick={() => setIsAddCommitmentOpen(false)} className="h-7 w-7"><X className="h-4 w-4" /></Button>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-4 space-y-4">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold uppercase text-slate-400">Name / Description</label>
                                        <Input 
                                            placeholder="e.g. Training Pitch Hire"
                                            value={commitmentForm.name}
                                            onChange={e => setCommitmentForm({ ...commitmentForm, name: e.target.value })}
                                            className="bg-slate-50 border-slate-200 h-10 rounded-xl"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold uppercase text-slate-400">Cost (£)</label>
                                            <Input 
                                                type="number"
                                                value={commitmentForm.cost}
                                                onChange={e => setCommitmentForm({ ...commitmentForm, cost: e.target.value })}
                                                className="bg-slate-50 border-slate-200 h-10 rounded-xl"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold uppercase text-slate-400">Frequency</label>
                                            <select
                                                value={commitmentForm.frequency}
                                                onChange={e => setCommitmentForm({ ...commitmentForm, frequency: e.target.value as any })}
                                                className="w-full px-3 py-2 border rounded-xl bg-slate-50 h-10 text-xs focus:ring-indigo-500 focus:outline-none"
                                            >
                                                <option value="Monthly">Monthly</option>
                                                <option value="Yearly">Yearly</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold uppercase text-slate-400">Next Due Date</label>
                                        <Input 
                                            type="date"
                                            value={commitmentForm.nextPaymentDate}
                                            onChange={e => setCommitmentForm({ ...commitmentForm, nextPaymentDate: e.target.value })}
                                            className="bg-slate-50 border-slate-200 h-10 rounded-xl"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold uppercase text-slate-400">Expense Category</label>
                                        <select
                                            value={commitmentForm.category}
                                            onChange={e => setCommitmentForm({ ...commitmentForm, category: e.target.value })}
                                            className="w-full px-3 py-2 border rounded-xl bg-slate-50 h-10 text-xs focus:ring-indigo-500 focus:outline-none"
                                        >
                                            {expenseCategories.map(cat => (
                                                <option key={cat} value={cat}>{cat}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <Button 
                                        onClick={saveCommitment}
                                        className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold h-11 rounded-xl shadow-md mt-2"
                                    >
                                        {editingId ? "Update" : "Save"} Commitment
                                    </Button>
                                </CardContent>
                            </Card>
                        </div>
                    )}
                </div>
            )}

            {/* VIEW: FINES TRACKER */}
            {activeSection === "fines" && (
                <div className="space-y-6 animate-in fade-in-50 duration-200">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div>
                            <h3 className="text-xl font-extrabold text-slate-900">Player Fines Tracker</h3>
                            <p className="text-xs text-slate-500 mt-0.5">Issue, manage, and collect player disciplinary fines.</p>
                        </div>
                        <Button 
                            onClick={() => {
                                setFineForm({
                                    playerId: "",
                                    category: "",
                                    amount: "",
                                    date: new Date().toISOString().split("T")[0]
                                });
                                setCustomCategoryName("");
                                setIsAddFineOpen(true);
                            }}
                            className="bg-red-600 hover:bg-red-700 text-white font-bold text-sm flex items-center gap-2 rounded-xl px-4 py-2.5 shadow"
                        >
                            <Plus className="h-4 w-4" /> Issue Fine
                        </Button>
                    </div>

                    {/* Fines Stats Overview */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                        <Card className="border-slate-200 shadow-sm relative overflow-hidden bg-white">
                            <div className="absolute top-0 left-0 w-1.5 h-full bg-slate-400" />
                            <CardHeader className="pb-2">
                                <CardDescription className="text-slate-400 font-bold uppercase text-[10px] tracking-wider">Total Fines Issued</CardDescription>
                                <CardTitle className="text-3xl font-black text-slate-950">
                                    £{fines.reduce((sum, f) => sum + f.amount, 0).toFixed(2)}
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-xs text-slate-500 font-medium">{fines.length} total incident records</p>
                            </CardContent>
                        </Card>

                        <Card className="border-slate-200 shadow-sm relative overflow-hidden bg-white">
                            <div className="absolute top-0 left-0 w-1.5 h-full bg-emerald-500" />
                            <CardHeader className="pb-2">
                                <CardDescription className="text-slate-400 font-bold uppercase text-[10px] tracking-wider">Fines Collected</CardDescription>
                                <CardTitle className="text-3xl font-black text-emerald-600">
                                    £{fines.filter(f => f.status === "Paid").reduce((sum, f) => sum + f.amount, 0).toFixed(2)}
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-xs text-slate-500 font-medium">
                                    {fines.filter(f => f.status === "Paid").length} payments logged in ledger
                                </p>
                            </CardContent>
                        </Card>

                        <Card className="border-slate-200 shadow-sm relative overflow-hidden bg-white">
                            <div className="absolute top-0 left-0 w-1.5 h-full bg-red-500" />
                            <CardHeader className="pb-2">
                                <CardDescription className="text-slate-400 font-bold uppercase text-[10px] tracking-wider">Outstanding Fines</CardDescription>
                                <CardTitle className="text-3xl font-black text-red-600">
                                    £{fines.filter(f => f.status === "Unpaid").reduce((sum, f) => sum + f.amount, 0).toFixed(2)}
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-xs text-slate-500 font-medium">
                                    {fines.filter(f => f.status === "Unpaid").length} unpaid balances
                                </p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Fines Table */}
                    <Card className="border-slate-200 shadow-sm bg-white overflow-hidden">
                        <CardHeader className="pb-3 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                            <div>
                                <CardTitle className="text-base font-bold text-slate-900">Fine History Ledger</CardTitle>
                                <CardDescription className="text-xs text-slate-500">A log of all disciplinary fees issued to players.</CardDescription>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            {fines.length === 0 ? (
                                <div className="py-16 text-center text-slate-400 text-xs italic flex flex-col items-center justify-center gap-2">
                                    <AlertTriangle className="h-8 w-8 text-slate-300" />
                                    No fines issued yet. Click "Issue Fine" to get started.
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-slate-50/75 border-b border-slate-100 text-slate-500 text-[10px] font-extrabold uppercase tracking-wider">
                                                <th className="py-3 px-4">Date Issued</th>
                                                <th className="py-3 px-4">Player</th>
                                                <th className="py-3 px-4">Fine Category</th>
                                                <th className="py-3 px-4">Amount</th>
                                                <th className="py-3 px-4">Status</th>
                                                <th className="py-3 px-4 text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                                            {fines.map(fine => (
                                                <tr key={fine.id} className="hover:bg-slate-50/50 transition-colors">
                                                    <td className="py-3.5 px-4 font-semibold text-slate-500 whitespace-nowrap">
                                                        {new Date(fine.date).toLocaleDateString("en-GB", {
                                                            day: "2-digit",
                                                            month: "short",
                                                            year: "numeric"
                                                        })}
                                                    </td>
                                                    <td className="py-3.5 px-4 font-bold text-slate-900">{fine.playerName}</td>
                                                    <td className="py-3.5 px-4">
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200/50">
                                                            {fine.category}
                                                        </span>
                                                    </td>
                                                    <td className="py-3.5 px-4 font-black text-slate-900">£{fine.amount.toFixed(2)}</td>
                                                    <td className="py-3.5 px-4">
                                                        {fine.status === "Paid" ? (
                                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                                <Check className="h-3 w-3" /> Paid
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-rose-50 text-rose-700 border border-rose-200">
                                                                <AlertTriangle className="h-3 w-3" /> Unpaid
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                                                        <div className="flex justify-end gap-1.5">
                                                            {fine.status === "Unpaid" && (
                                                                <Button 
                                                                    onClick={() => handleMarkFinePaid(fine.id)}
                                                                    size="sm"
                                                                    variant="outline"
                                                                    className="h-7 border-emerald-200 hover:bg-emerald-50 text-emerald-700 text-[10px] font-extrabold px-2.5 rounded-lg flex items-center gap-1"
                                                                >
                                                                    <Check className="h-3 w-3" /> Mark Paid
                                                                </Button>
                                                            )}
                                                            <Button
                                                                onClick={() => handleDeleteFine(fine.id)}
                                                                size="icon"
                                                                variant="outline"
                                                                className="h-7 w-7 border-slate-200 text-slate-500 hover:text-rose-600 hover:border-rose-100 rounded-lg"
                                                            >
                                                                <Trash2 className="h-3.5 w-3.5" />
                                                            </Button>
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

                    {/* Issue Fine Overlay / Dialog */}
                    {isAddFineOpen && (
                        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
                            <Card className="w-full max-w-sm border-slate-200 bg-white text-slate-800 shadow-xl overflow-hidden rounded-2xl">
                                <CardHeader className="bg-slate-50 border-b border-slate-100 p-4">
                                    <div className="flex justify-between items-center">
                                        <CardTitle className="text-sm font-bold">Issue Player Fine</CardTitle>
                                        <Button size="icon" variant="ghost" onClick={() => setIsAddFineOpen(false)} className="h-7 w-7"><X className="h-4 w-4" /></Button>
                                    </div>
                                </CardHeader>
                                <form onSubmit={handleIssueFine}>
                                    <CardContent className="p-4 space-y-4">
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold uppercase text-slate-400">Player</label>
                                            <select
                                                value={fineForm.playerId}
                                                onChange={e => setFineForm({ ...fineForm, playerId: e.target.value })}
                                                className="w-full px-3 py-2 border rounded-xl bg-slate-50 h-10 text-xs focus:ring-indigo-500 focus:outline-none"
                                                required
                                            >
                                                <option value="">Select a player...</option>
                                                {players.map(p => (
                                                    <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold uppercase text-slate-400">Fine Category</label>
                                            <select
                                                value={fineForm.category}
                                                onChange={e => handleFineCategoryChange(e.target.value)}
                                                className="w-full px-3 py-2 border rounded-xl bg-slate-50 h-10 text-xs focus:ring-indigo-500 focus:outline-none"
                                                required
                                            >
                                                <option value="">Select a category...</option>
                                                {(settings.fineCategories || []).map((cat, idx) => (
                                                    <option key={idx} value={cat.name}>{cat.name} (£{cat.amount})</option>
                                                ))}
                                                {!(settings.fineCategories || []).some(c => c.name === "Yellow Card") && <option value="Yellow Card">Yellow Card</option>}
                                                {!(settings.fineCategories || []).some(c => c.name === "Red Card") && <option value="Red Card">Red Card</option>}
                                                {!(settings.fineCategories || []).some(c => c.name === "Dissent") && <option value="Dissent">Dissent</option>}
                                                <option value="Other">Other (Custom)</option>
                                            </select>
                                        </div>

                                        {fineForm.category === "Other" && (
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-bold uppercase text-slate-400">Custom Category Name</label>
                                                <Input
                                                    placeholder="e.g. Late for Bus"
                                                    value={customCategoryName}
                                                    onChange={e => setCustomCategoryName(e.target.value)}
                                                    className="bg-slate-50 border-slate-200 h-10 rounded-xl"
                                                    required
                                                />
                                            </div>
                                        )}

                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-bold uppercase text-slate-400">Fine Amount (£)</label>
                                                <Input 
                                                    type="number"
                                                    value={fineForm.amount}
                                                    onChange={e => setFineForm({ ...fineForm, amount: e.target.value })}
                                                    className="bg-slate-50 border-slate-200 h-10 rounded-xl"
                                                    required
                                                    min="0"
                                                    step="0.01"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-bold uppercase text-slate-400">Date Issued</label>
                                                <Input 
                                                    type="date"
                                                    value={fineForm.date}
                                                    onChange={e => setFineForm({ ...fineForm, date: e.target.value })}
                                                    className="bg-slate-50 border-slate-200 h-10 rounded-xl"
                                                    required
                                                />
                                            </div>
                                        </div>

                                        <Button 
                                            type="submit"
                                            className="w-full bg-red-600 hover:bg-red-500 text-white font-bold h-11 rounded-xl shadow-md mt-2"
                                        >
                                            Issue Fine Penalty
                                        </Button>
                                    </CardContent>
                                </form>
                            </Card>
                        </div>
                    )}
                </div>
            )}

            {/* VIEW 4: TRANSACTIONS LEDGER */}
            {activeSection === "ledger" && (
                <div className="space-y-6">
                    
                    {/* Ledger Summaries */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <Card className="border-slate-200/80 shadow-sm bg-white">
                            <CardContent className="p-4">
                                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Total Income (Ledger)</div>
                                <div className="text-xl font-black text-green-600 mt-1">
                                    +£{transactions.filter(t => t.type === "Income").reduce((sum, t) => sum + t.amount, 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="border-slate-200/80 shadow-sm bg-white">
                            <CardContent className="p-4">
                                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Total Expenses (Ledger)</div>
                                <div className="text-xl font-black text-red-500 mt-1">
                                    -£{transactions.filter(t => t.type === "Expense").reduce((sum, t) => sum + t.amount, 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="border-slate-200/80 shadow-sm bg-white">
                            <CardContent className="p-4">
                                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Net Ledger Cashflow</div>
                                {(() => {
                                    const inc = transactions.filter(t => t.type === "Income").reduce((sum, t) => sum + t.amount, 0);
                                    const exp = transactions.filter(t => t.type === "Expense").reduce((sum, t) => sum + t.amount, 0);
                                    const net = inc - exp;
                                    return (
                                        <div className={`text-xl font-black mt-1 ${net >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                            {net >= 0 ? '+' : '-'}£{Math.abs(net).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </div>
                                    );
                                })()}
                            </CardContent>
                        </Card>
                    </div>
                    
                    {/* Ledger Filters */}
                    <Card className="p-4 border-slate-200 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex flex-1 flex-wrap items-center gap-3">
                            <div className="relative flex-1 min-w-[200px] max-w-sm">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
                                <Input 
                                    placeholder="Search ledger details..."
                                    value={ledgerSearch}
                                    onChange={e => setLedgerSearch(e.target.value)}
                                    className="pl-9 bg-slate-50 border-slate-200 h-10 rounded-xl focus-visible:ring-indigo-500"
                                />
                            </div>
                            <select
                                value={ledgerTypeFilter}
                                onChange={e => setLedgerTypeFilter(e.target.value as any)}
                                className="px-3 py-2 border rounded-xl bg-slate-50 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 h-10"
                            >
                                <option value="All">All Types</option>
                                <option value="Income">Income only</option>
                                <option value="Expense">Expense only</option>
                            </select>
                            <select
                                value={ledgerCategoryFilter}
                                onChange={e => setLedgerCategoryFilter(e.target.value)}
                                className="px-3 py-2 border rounded-xl bg-slate-50 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 h-10"
                            >
                                <option value="All">All Categories</option>
                                {[...incomeCategories, ...expenseCategories].map(cat => (
                                    <option key={cat} value={cat}>{cat}</option>
                                ))}
                            </select>
                        </div>
                        <Button 
                            onClick={handleExportCSV}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs flex items-center gap-2 rounded-xl h-10 px-4 transition-colors"
                        >
                            <Download className="h-4 w-4" /> Export to Excel
                        </Button>
                    </Card>

                    {/* Transactions Table */}
                    <Card className="border-slate-200 shadow-md overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs text-left">
                                <thead className="bg-slate-50 border-b border-slate-100 text-[10px] text-slate-500 uppercase font-bold tracking-wider">
                                    <tr>
                                        <th className="px-6 py-4">Date</th>
                                        <th className="px-6 py-4">Description</th>
                                        <th className="px-6 py-4">Category</th>
                                        <th className="px-6 py-4 text-center">Type</th>
                                        <th className="px-6 py-4 text-right">Amount</th>
                                        <th className="px-6 py-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 bg-white">
                                    {filteredLedger.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-8 text-center text-slate-400 italic">No transactions mapped to current filters.</td>
                                        </tr>
                                    ) : (
                                        filteredLedger.map(t => (
                                            <tr key={t.id} className="hover:bg-slate-50/50 transition-colors">
                                                <td className="px-6 py-4 text-slate-600">{new Date(t.date).toLocaleDateString()}</td>
                                                <td className="px-6 py-4 font-semibold text-slate-900">{t.description}</td>
                                                <td className="px-6 py-4 text-slate-500">{t.category}</td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${
                                                        t.type === "Income" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                                                    }`}>
                                                        {t.type}
                                                    </span>
                                                </td>
                                                <td className={`px-6 py-4 text-right font-extrabold ${t.type === "Income" ? "text-green-600" : "text-slate-800"}`}>
                                                    {t.type === "Income" ? "+" : "-"}£{t.amount.toFixed(2)}
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex justify-end gap-1">
                                                        <Button size="icon" variant="ghost" onClick={() => startEditTx(t)} className="h-7 w-7 text-slate-400 hover:text-indigo-600">
                                                            <Pencil className="h-3.5 w-3.5" />
                                                        </Button>
                                                        <Button size="icon" variant="ghost" onClick={() => deleteItem(t.id, "tx")} className="h-7 w-7 text-slate-400 hover:text-red-500">
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </Card>


                </div>
            )}

            {/* VIEW 5: SPONSORSHIP TRACKER */}
            {activeSection === "sponsors" && (
                <div className="space-y-6">
                    <div className="flex justify-between items-center">
                        <div>
                            <h3 className="text-lg font-bold text-slate-900">Sponsorship Income Tracker</h3>
                            <p className="text-xs text-slate-500 mt-0.5">Manage and track active commercial club sponsors and values.</p>
                        </div>
                        <Button 
                            onClick={() => { resetSponsorForm(); setIsAddSponsorOpen(true); }}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs flex items-center gap-2 rounded-xl"
                        >
                            <Plus className="h-4 w-4" /> Add Sponsor
                        </Button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {sponsors.length === 0 ? (
                            <div className="col-span-full py-12 text-center text-slate-400 text-xs italic">No sponsors listed. Add your first sponsor details above.</div>
                        ) : (
                            sponsors.map(sponsor => {
                                const expiry = sponsor.endDate ? new Date(sponsor.endDate) : null;
                                const isExpired = expiry && expiry < new Date();
                                
                                return (
                                    <Card key={sponsor.id} className="border-slate-200 shadow-md hover:shadow-lg transition-all relative overflow-hidden group">
                                        <div className="h-1.5 w-full bg-emerald-500" />
                                        <CardContent className="p-4 space-y-4">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <h4 className="font-extrabold text-slate-800 text-sm">{sponsor.name}</h4>
                                                    <span className={`inline-block rounded-full px-2 py-0.5 text-[8px] font-bold uppercase mt-1.5 ${
                                                        sponsor.status === "Secured" ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"
                                                    }`}>{sponsor.status}</span>
                                                </div>
                                                <div className="text-right">
                                                    <span className="text-lg font-black text-slate-900">£{sponsor.amount}</span>
                                                    <p className="text-[9px] text-slate-400 font-semibold uppercase">{sponsor.frequency}</p>
                                                </div>
                                            </div>

                                            <div className="flex justify-between items-center text-xs pt-3 border-t border-slate-100">
                                                <span className="text-slate-500">Expires:</span>
                                                <span className={`font-bold ${isExpired ? "text-red-500" : "text-slate-800"}`}>
                                                    {sponsor.endDate ? new Date(sponsor.endDate).toLocaleDateString() : "N/A"}
                                                    {isExpired && " (Expired)"}
                                                </span>
                                            </div>

                                            <div className="flex justify-end gap-2 pt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button 
                                                    size="sm" 
                                                    variant="ghost" 
                                                    onClick={() => startEditSponsor(sponsor)}
                                                    className="h-8 text-indigo-600 hover:text-indigo-800 p-2"
                                                >
                                                    <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                                                </Button>
                                                <Button 
                                                    size="sm" 
                                                    variant="ghost" 
                                                    onClick={() => deleteItem(sponsor.id, "sponsor")}
                                                    className="h-8 text-red-500 hover:text-red-700 p-2"
                                                >
                                                    <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </Card>
                                );
                            })
                        )}
                    </div>

                    {/* Add/Edit Sponsor Modal Popup */}
                    {isAddSponsorOpen && (
                        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
                            <Card className="w-full max-w-lg border-slate-200 bg-white text-slate-800 shadow-xl overflow-hidden rounded-2xl">
                                <CardHeader className="bg-slate-50 border-b border-slate-100 p-4">
                                    <div className="flex justify-between items-center">
                                        <CardTitle className="text-sm font-bold">{editingId ? "Edit" : "Add"} Sponsor</CardTitle>
                                        <Button size="icon" variant="ghost" onClick={() => setIsAddSponsorOpen(false)} className="h-7 w-7"><X className="h-4 w-4" /></Button>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-4 space-y-4 max-h-[75vh] overflow-y-auto">
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold uppercase text-slate-400">Sponsor Name</label>
                                            <Input 
                                                placeholder="e.g. ABC Builders"
                                                value={sponsorForm.name}
                                                onChange={e => setSponsorForm({ ...sponsorForm, name: e.target.value })}
                                                className="bg-slate-50 border-slate-200 h-10 rounded-xl"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold uppercase text-slate-400">Status</label>
                                            <select
                                                value={sponsorForm.status}
                                                onChange={e => setSponsorForm({ ...sponsorForm, status: e.target.value as any })}
                                                className="w-full px-3 py-2 border rounded-xl bg-slate-50 h-10 text-xs focus:ring-indigo-500 focus:outline-none"
                                            >
                                                <option value="Secured">Secured Partner</option>
                                                <option value="Lead">Potential: Targeted Lead</option>
                                                <option value="Contacted">Potential: Contacted</option>
                                                <option value="Proposal">Potential: Proposal Sent</option>
                                                <option value="Review">Potential: Contract Review</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold uppercase text-slate-400">Website</label>
                                            <Input 
                                                placeholder="https://"
                                                value={sponsorForm.website}
                                                onChange={e => setSponsorForm({ ...sponsorForm, website: e.target.value })}
                                                className="bg-slate-50 border-slate-200 h-10 rounded-xl"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold uppercase text-slate-400">Agreement Value (£)</label>
                                            <Input 
                                                type="number"
                                                placeholder="0.00"
                                                value={sponsorForm.amount}
                                                onChange={e => setSponsorForm({ ...sponsorForm, amount: e.target.value })}
                                                className="bg-slate-50 border-slate-200 h-10 rounded-xl"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold uppercase text-slate-400">Frequency</label>
                                            <select
                                                value={sponsorForm.frequency}
                                                onChange={e => setSponsorForm({ ...sponsorForm, frequency: e.target.value as any })}
                                                className="w-full px-3 py-2 border rounded-xl bg-slate-50 h-10 text-xs focus:ring-indigo-500 focus:outline-none"
                                            >
                                                <option value="One-off">One-off Payment</option>
                                                <option value="Monthly">Monthly</option>
                                                <option value="Yearly">Yearly</option>
                                            </select>
                                        </div>
                                        <div className="space-y-1">
                                            {/* Empty space */}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold uppercase text-slate-400">Start Date</label>
                                            <Input 
                                                type="date"
                                                value={sponsorForm.startDate}
                                                onChange={e => setSponsorForm({ ...sponsorForm, startDate: e.target.value })}
                                                className="bg-slate-50 border-slate-200 h-10 rounded-xl"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold uppercase text-slate-400">End Date</label>
                                            <Input 
                                                type="date"
                                                value={sponsorForm.endDate}
                                                onChange={e => setSponsorForm({ ...sponsorForm, endDate: e.target.value })}
                                                className="bg-slate-50 border-slate-200 h-10 rounded-xl"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold uppercase text-slate-400">Description</label>
                                        <Input 
                                            placeholder="Brief description of the partnership..."
                                            value={sponsorForm.description}
                                            onChange={e => setSponsorForm({ ...sponsorForm, description: e.target.value })}
                                            className="bg-slate-50 border-slate-200 h-10 rounded-xl"
                                        />
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold uppercase text-slate-400">Responsibilities & Deliverables</label>
                                        <textarea
                                            placeholder="• Logo on Kit&#10;• 3x Social Media Posts&#10;• Banner at Home Games"
                                            value={sponsorForm.responsibilities}
                                            onChange={e => setSponsorForm({ ...sponsorForm, responsibilities: e.target.value })}
                                            className="flex min-h-[80px] w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-indigo-500 focus-visible:ring-2 resize-y"
                                        />
                                        <p className="text-[9px] text-slate-500">Separate items with new lines.</p>
                                    </div>

                                    <div className="border-t border-slate-100 pt-3 space-y-3">
                                        <h4 className="text-[11px] font-bold uppercase text-slate-500">Contract / Agreement</h4>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-bold uppercase text-slate-400">Agreement Link (URL)</label>
                                                <Input 
                                                    placeholder="https://drive.google.com/..."
                                                    value={sponsorForm.contractUrl}
                                                    onChange={e => setSponsorForm({ ...sponsorForm, contractUrl: e.target.value })}
                                                    className="bg-slate-50 border-slate-200 h-10 rounded-xl"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-bold uppercase text-slate-400">Display Name</label>
                                                <Input 
                                                    placeholder="e.g. Contract_2026.pdf"
                                                    value={sponsorForm.contractName}
                                                    onChange={e => setSponsorForm({ ...sponsorForm, contractName: e.target.value })}
                                                    className="bg-slate-50 border-slate-200 h-10 rounded-xl"
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold uppercase text-slate-400">Or Upload Document (Max 2MB)</label>
                                            <label className="cursor-pointer block mt-1">
                                                <div className="flex items-center justify-center w-full h-10 px-3 py-2 text-xs border rounded-xl hover:bg-slate-100 bg-slate-50 border-dashed text-slate-500">
                                                    <UploadCloud className="w-4 h-4 mr-2 text-slate-400" />
                                                    {sponsorForm.contractName && sponsorForm.contractUrl?.startsWith('data:') 
                                                        ? `Selected: ${sponsorForm.contractName}` 
                                                        : "Upload Local PDF/Word..."}
                                                </div>
                                                <input 
                                                    type="file" 
                                                    className="hidden" 
                                                    accept=".pdf,.doc,.docx" 
                                                    onChange={e => {
                                                        const file = e.target.files?.[0];
                                                        if (file) {
                                                            if (file.size > 2 * 1024 * 1024) {
                                                                alert("File is too large. Max 2MB.");
                                                                return;
                                                                }
                                                            const reader = new FileReader();
                                                            reader.onloadend = () => {
                                                                setSponsorForm(prev => ({
                                                                    ...prev,
                                                                    contractUrl: reader.result as string,
                                                                    contractName: file.name
                                                                }));
                                                            };
                                                            reader.readAsDataURL(file);
                                                        }
                                                    }} 
                                                />
                                            </label>
                                        </div>
                                    </div>

                                    <Button 
                                        onClick={saveSponsor}
                                        className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold h-11 rounded-xl shadow-md mt-2"
                                    >
                                        {editingId ? "Update" : "Save"} Sponsor
                                    </Button>
                                </CardContent>
                            </Card>
                        </div>
                    )}
                </div>
            )}

            {/* VIEW 6: FUNDRAISING TRACKER */}
            {activeSection === "fundraising" && (
                <div className="space-y-6">
                    <div className="flex justify-between items-center">
                        <div>
                            <h3 className="text-lg font-bold text-slate-900">Fundraising Events Tracker</h3>
                            <p className="text-xs text-slate-500 mt-0.5">Logs and track income generated through club events and initiatives.</p>
                        </div>
                        <Button 
                            onClick={() => {
                                setTxForm({
                                    description: "",
                                    amount: "",
                                    type: "Income",
                                    category: "Fundraising",
                                    date: new Date().toISOString().split("T")[0]
                                });
                                setIsAddTxOpen(true);
                            }}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs flex items-center gap-2 rounded-xl"
                        >
                            <Plus className="h-4 w-4" /> Add Fundraising Event
                        </Button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {transactions.filter(t => t.category === "Fundraising").length === 0 ? (
                            <div className="col-span-full py-12 text-center text-slate-400 text-xs italic">No fundraising transactions logged yet. Click above to log your first event profit.</div>
                        ) : (
                            transactions.filter(t => t.category === "Fundraising").map(event => (
                                <Card key={event.id} className="border-slate-200 shadow-md hover:shadow-lg transition-all relative overflow-hidden group bg-gradient-to-br from-indigo-50/10 to-indigo-100/5">
                                    <div className="h-1.5 w-full bg-indigo-500" />
                                    <CardContent className="p-4 space-y-4">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <h4 className="font-extrabold text-slate-800 text-sm">{event.description}</h4>
                                                <span className="inline-block text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-1">{new Date(event.date).toLocaleDateString()}</span>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-lg font-black text-indigo-600">+£{event.amount}</span>
                                                <p className="text-[9px] text-slate-400 font-semibold uppercase">Profit</p>
                                            </div>
                                        </div>

                                        <div className="flex justify-end gap-2 pt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Button 
                                                size="sm" 
                                                variant="ghost" 
                                                onClick={() => startEditTx(event)}
                                                className="h-8 text-indigo-600 hover:text-indigo-800 p-2"
                                            >
                                                <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                                            </Button>
                                            <Button 
                                                size="sm" 
                                                variant="ghost" 
                                                onClick={() => deleteItem(event.id, "tx")}
                                                className="h-8 text-red-500 hover:text-red-700 p-2"
                                            >
                                                <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))
                        )}
                    </div>
                </div>
            )}

            {/* VIEW 7: CATEGORIES EDITOR */}
            {activeSection === "categories" && (
                <div className="space-y-6">
                    {/* Finance Toggles & Baselines Settings */}
                    <Card className="border-slate-200 shadow-md">
                        <CardHeader className="bg-slate-50/50 border-b p-4">
                            <CardTitle className="text-sm font-bold text-slate-800">Finance Modules & Baseline Fees</CardTitle>
                        </CardHeader>
                        <CardContent className="p-5 space-y-5 bg-white rounded-b-2xl">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Player Subs Toggles */}
                                <div className="space-y-4">
                                    <div className="flex items-start justify-between gap-4 p-3 border border-slate-100 rounded-xl bg-slate-50/50">
                                        <div className="space-y-0.5">
                                            <label className="text-xs font-bold text-slate-800">Player Subscriptions</label>
                                            <p className="text-[10px] text-slate-500 leading-normal">
                                                Do players pay monthly subscription fees or session fees to play?
                                            </p>
                                        </div>
                                        <Switch 
                                            checked={settings.subsEnabled} 
                                            onCheckedChange={(val) => updateSettings({ subsEnabled: val })}
                                        />
                                    </div>

                                    {settings.subsEnabled && (
                                        <div className="space-y-3 p-3 border border-indigo-100/50 rounded-xl bg-indigo-50/10">
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-bold uppercase text-slate-400 font-medium">Club Subs Structure</label>
                                                <select
                                                    value={subsStructure}
                                                    onChange={e => {
                                                        const struct = e.target.value as any;
                                                        setSubsStructure(struct);
                                                        localStorage.setItem(`clubflow_subs_structure_${settings.name}`, struct);
                                                    }}
                                                    className="w-full h-9 px-2 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold text-slate-700"
                                                >
                                                    <option value="Monthly">Monthly charge in total</option>
                                                    <option value="Training">Just training fee subs</option>
                                                    <option value="Matchday">Just matchday subs</option>
                                                    <option value="Both">Both training & matchday subs</option>
                                                </select>
                                            </div>
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                                {(subsStructure === "Monthly") && (
                                                    <div className="space-y-1">
                                                        <label className="text-[9px] font-bold uppercase text-slate-400">Monthly Sub (£)</label>
                                                        <Input
                                                            type="number"
                                                            value={settings.monthlySubs || 0}
                                                            onChange={(e) => updateSettings({ monthlySubs: parseFloat(e.target.value) || 0 })}
                                                            className="h-8 text-xs bg-white border-slate-200"
                                                        />
                                                    </div>
                                                )}
                                                <div className="space-y-1">
                                                    <label className="text-[9px] font-bold uppercase text-slate-400">Reg Fee (£)</label>
                                                    <Input
                                                        type="number"
                                                        value={settings.registrationFee || 0}
                                                        onChange={(e) => updateSettings({ registrationFee: parseFloat(e.target.value) || 0 })}
                                                        className="h-8 text-xs bg-white border-slate-200"
                                                    />
                                                </div>
                                                {(subsStructure === "Training" || subsStructure === "Both") && (
                                                    <div className="space-y-1">
                                                        <label className="text-[9px] font-bold uppercase text-slate-400">Session Fee (£)</label>
                                                        <Input
                                                            type="number"
                                                            value={settings.trainingFeePerSession || 0}
                                                            onChange={(e) => updateSettings({ trainingFeePerSession: parseFloat(e.target.value) || 0 })}
                                                            className="h-8 text-xs bg-white border-slate-200"
                                                        />
                                                    </div>
                                                )}
                                                {(subsStructure === "Matchday" || subsStructure === "Both") && (
                                                    <div className="space-y-1">
                                                        <label className="text-[9px] font-bold uppercase text-slate-400">Matchday Fee (£)</label>
                                                        <Input
                                                            type="number"
                                                            value={matchdayFee || 0}
                                                            onChange={(e) => {
                                                                const mat = parseFloat(e.target.value) || 0;
                                                                setMatchdayFee(mat);
                                                                localStorage.setItem(`clubflow_matchday_fee_${settings.name}`, mat.toString());
                                                            }}
                                                            className="h-8 text-xs bg-white border-slate-200"
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Player Contracts Toggle */}
                                <div className="space-y-4">
                                    <div className="flex items-start justify-between gap-4 p-3 border border-slate-100 rounded-xl bg-slate-50/50">
                                        <div className="space-y-0.5">
                                            <label className="text-xs font-bold text-slate-800">Player Contracts (Paid Players)</label>
                                            <p className="text-[10px] text-slate-500 leading-normal">
                                                Does the club contract and pay any players (e.g. wages or appearance fees)?
                                            </p>
                                        </div>
                                        <Switch 
                                            checked={settings.contractsEnabled} 
                                            onCheckedChange={(val) => updateSettings({ contractsEnabled: val })}
                                        />
                                    </div>

                                    <div className="flex items-start justify-between gap-4 p-3 border border-slate-100 rounded-xl bg-slate-50/50">
                                        <div className="space-y-0.5">
                                            <label className="text-xs font-bold text-slate-800">Player Fines (Disciplinary System)</label>
                                            <p className="text-[10px] text-slate-500 leading-normal">
                                                Track and manage squad disciplinary fines and payments.
                                            </p>
                                        </div>
                                        <Switch 
                                            checked={settings.finesEnabled} 
                                            onCheckedChange={(val) => updateSettings({ finesEnabled: val })}
                                        />
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="flex justify-between items-center pt-4 border-t border-slate-100">
                        <div>
                            <h3 className="text-lg font-bold text-slate-900">Custom Transaction Categories</h3>
                            <p className="text-xs text-slate-500 mt-0.5">Customize the categories you use to classify ledger transactions.</p>
                        </div>
                        <Button 
                            onClick={() => { setNewCategoryName(""); setIsAddCategoryOpen(true); }}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs flex items-center gap-2 rounded-xl"
                        >
                            <Plus className="h-4 w-4" /> Add Category
                        </Button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        
                        {/* Income Categories */}
                        <Card className="border-slate-200 shadow-md">
                            <CardHeader className="bg-slate-50/50 border-b p-4">
                                <CardTitle className="text-sm font-bold text-green-700">Income Categories</CardTitle>
                            </CardHeader>
                            <CardContent className="p-4 space-y-2">
                                {/* Default categories */}
                                {DEFAULT_INCOME_CATEGORIES.map(cat => (
                                    <div key={cat} className="flex justify-between items-center p-3 border border-slate-100 rounded-2xl bg-white text-xs">
                                        <span className="font-semibold text-slate-700">{cat}</span>
                                        <span className="text-[8px] bg-slate-100 text-slate-400 font-bold px-1.5 py-0.5 rounded-full uppercase">Default</span>
                                    </div>
                                ))}
                                {/* Custom categories */}
                                {customCategories.income.map(cat => (
                                    <div key={cat} className="flex justify-between items-center p-3 border border-slate-100 rounded-2xl bg-white text-xs hover:border-slate-200 transition-all">
                                        <span className="font-semibold text-slate-700">{cat}</span>
                                        <Button size="icon" variant="ghost" onClick={() => deleteCategory(cat, "income")} className="h-6 w-6 text-slate-400 hover:text-red-500">
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>

                        {/* Expense Categories */}
                        <Card className="border-slate-200 shadow-md">
                            <CardHeader className="bg-slate-50/50 border-b p-4">
                                <CardTitle className="text-sm font-bold text-red-700">Expense Categories</CardTitle>
                            </CardHeader>
                            <CardContent className="p-4 space-y-2">
                                {/* Default categories */}
                                {DEFAULT_EXPENSE_CATEGORIES.map(cat => (
                                    <div key={cat} className="flex justify-between items-center p-3 border border-slate-100 rounded-2xl bg-white text-xs">
                                        <span className="font-semibold text-slate-700">{cat}</span>
                                        <span className="text-[8px] bg-slate-100 text-slate-400 font-bold px-1.5 py-0.5 rounded-full uppercase">Default</span>
                                    </div>
                                ))}
                                {/* Custom categories */}
                                {customCategories.expense.map(cat => (
                                    <div key={cat} className="flex justify-between items-center p-3 border border-slate-100 rounded-2xl bg-white text-xs hover:border-slate-200 transition-all">
                                        <span className="font-semibold text-slate-700">{cat}</span>
                                        <Button size="icon" variant="ghost" onClick={() => deleteCategory(cat, "expense")} className="h-6 w-6 text-slate-400 hover:text-red-500">
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                    </div>

                    {/* Add Category Dialog */}
                    {isAddCategoryOpen && (
                        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
                            <Card className="w-full max-w-sm border-slate-200 bg-white text-slate-800 shadow-xl overflow-hidden rounded-2xl">
                                <CardHeader className="bg-slate-50 border-b border-slate-100 p-4">
                                    <div className="flex justify-between items-center">
                                        <CardTitle className="text-sm font-bold">Add Category</CardTitle>
                                        <Button size="icon" variant="ghost" onClick={() => setIsAddCategoryOpen(false)} className="h-7 w-7"><X className="h-4 w-4" /></Button>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-4 space-y-4">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold uppercase text-slate-400">Category Name</label>
                                        <Input 
                                            placeholder="e.g. Referee Travel"
                                            value={newCategoryName}
                                            onChange={e => setNewCategoryName(e.target.value)}
                                            className="bg-slate-50 border-slate-200 h-10 rounded-xl"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold uppercase text-slate-400">Type</label>
                                        <select
                                            value={newCategoryType}
                                            onChange={e => setNewCategoryType(e.target.value as any)}
                                            className="w-full px-3 py-2 border rounded-xl bg-slate-50 h-10 text-xs focus:ring-indigo-500 focus:outline-none"
                                        >
                                            <option value="Income">Income Category</option>
                                            <option value="Expense">Expense Category</option>
                                        </select>
                                    </div>
                                    <Button 
                                        onClick={saveCategory}
                                        className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold h-11 rounded-xl shadow-md mt-2"
                                    >
                                        Add Custom Category
                                    </Button>
                                </CardContent>
                            </Card>
                        </div>
                    )}

                </div>
            )}

            {/* Add/Edit Transaction Modal Popup */}
            {isAddTxOpen && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
                    <Card className="w-full max-w-sm border-slate-200 bg-white text-slate-800 shadow-xl overflow-hidden rounded-2xl">
                        <CardHeader className="bg-slate-50 border-b border-slate-100 p-4">
                            <div className="flex justify-between items-center">
                                <CardTitle className="text-sm font-bold">{editingId ? "Edit" : "Add"} Ledger Transaction</CardTitle>
                                <Button size="icon" variant="ghost" onClick={() => setIsAddTxOpen(false)} className="h-7 w-7"><X className="h-4 w-4" /></Button>
                            </div>
                        </CardHeader>
                        <CardContent className="p-4 space-y-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold uppercase text-slate-400">Description</label>
                                <Input 
                                    placeholder="e.g. Referee Fees"
                                    value={txForm.description}
                                    onChange={e => setTxForm({ ...txForm, description: e.target.value })}
                                    className="bg-slate-50 border-slate-200 h-10 rounded-xl"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold uppercase text-slate-400">Amount (£)</label>
                                    <Input 
                                        type="number"
                                        value={txForm.amount}
                                        onChange={e => setTxForm({ ...txForm, amount: e.target.value })}
                                        className="bg-slate-50 border-slate-200 h-10 rounded-xl"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold uppercase text-slate-400">Type</label>
                                    <select
                                        value={txForm.type}
                                        onChange={e => setTxForm({ ...txForm, type: e.target.value as any })}
                                        className="w-full px-3 py-2 border rounded-xl bg-slate-50 h-10 text-xs focus:ring-indigo-500 focus:outline-none"
                                    >
                                        <option value="Expense">Expense</option>
                                        <option value="Income">Income</option>
                                    </select>
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold uppercase text-slate-400">Transaction Date</label>
                                <Input 
                                    type="date"
                                    value={txForm.date}
                                    onChange={e => setTxForm({ ...txForm, date: e.target.value })}
                                    className="bg-slate-50 border-slate-200 h-10 rounded-xl"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold uppercase text-slate-400">Category</label>
                                <select
                                    value={txForm.category}
                                    onChange={e => setTxForm({ ...txForm, category: e.target.value })}
                                    className="w-full px-3 py-2 border rounded-xl bg-slate-50 h-10 text-xs focus:ring-indigo-500 focus:outline-none"
                                >
                                    {(txForm.type === "Income" ? incomeCategories : expenseCategories).map(cat => (
                                        <option key={cat} value={cat}>{cat}</option>
                                    ))}
                                </select>
                            </div>
                            <Button 
                                onClick={saveTransaction}
                                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold h-11 rounded-xl shadow-md mt-2"
                            >
                                {editingId ? "Update" : "Save"} Transaction
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}
