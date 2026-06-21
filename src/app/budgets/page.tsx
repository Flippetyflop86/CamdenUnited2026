"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";
import { Player } from "@/types";
import { PoundSterling, TrendingDown, TrendingUp, Users, Calendar, Settings, Plus, Trash2, Edit2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

export default function PlayerBudgetsPage() {
    const [players, setPlayers] = useState<Player[]>([]);
    const [budgetAllowance, setBudgetAllowance] = useState<number>(1000);
    const [isEditingBudget, setIsEditingBudget] = useState(false);
    const [tempBudget, setTempBudget] = useState<number>(0);
    
    // Quick Edit State
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingPlayer, setEditingPlayer] = useState<Partial<Player> | null>(null);
    const [uncontractedPlayers, setUncontractedPlayers] = useState<Player[]>([]);

    useEffect(() => {
        fetchData();
        const playersChannel = supabase.channel('public:players')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, fetchData)
            .subscribe();
            
        const settingsChannel = supabase.channel('public:clubs')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'clubs' }, fetchSettings)
            .subscribe();

        return () => {
            supabase.removeChannel(playersChannel);
            supabase.removeChannel(settingsChannel);
        };
    }, []);

    const fetchData = async () => {
        fetchSettings();
        const { data } = await supabase.from('players').select('*').eq('is_contracted', true);
        if (data) {
            setPlayers(data.map((p: any) => ({
                id: p.id,
                firstName: p.first_name,
                lastName: p.last_name,
                position: p.position,
                squadNumber: p.squad_number,
                age: p.age,
                nationality: p.nationality,
                squad: p.squad,
                medicalStatus: p.medical_status,
                availability: p.availability,
                appearances: 0, goals: 0, assists: 0,
                contractExpiry: p.contract_expiry,
                isContracted: p.is_contracted,
                contractAmount: p.contract_amount,
                contractFrequency: p.contract_frequency || 'Weekly',
                contractStartDate: p.contract_start_date,
                contractEndDate: p.contract_end_date
            })));
        }
    };

    const fetchSettings = async () => {
        const { data } = await supabase.from('clubs').select('weekly_budget_allowance').limit(1).maybeSingle();
        if (data && data.weekly_budget_allowance !== null) {
            setBudgetAllowance(Number(data.weekly_budget_allowance));
        }
    };

    const saveBudget = async () => {
        const { data: existing } = await supabase.from('clubs').select('id').limit(1).maybeSingle();
        if (existing) {
            await supabase.from('clubs').update({ weekly_budget_allowance: tempBudget }).eq('id', existing.id);
        }
        setBudgetAllowance(tempBudget);
        setIsEditingBudget(false);
    };

    const openAddModal = async () => {
        const { data } = await supabase.from('players').select('*').or('is_contracted.eq.false,is_contracted.is.null');
        if (data) {
            setUncontractedPlayers(data.map((p: any) => ({
                id: p.id,
                firstName: p.first_name,
                lastName: p.last_name,
                squad: p.squad
            } as Player)));
        }
        setEditingPlayer({
            id: "", // will be selected from dropdown
            contractAmount: 0,
            contractFrequency: "Weekly",
            contractStartDate: "",
            contractEndDate: ""
        });
        setIsEditModalOpen(true);
    };

    const openEditModal = (player: Player) => {
        setUncontractedPlayers([]); // Not needed for edit
        setEditingPlayer({
            id: player.id,
            contractAmount: player.contractAmount || 0,
            contractFrequency: player.contractFrequency || "Weekly",
            contractStartDate: player.contractStartDate || "",
            contractEndDate: player.contractEndDate || ""
        });
        setIsEditModalOpen(true);
    };

    const handleRemoveContract = async (id: string) => {
        if (!confirm("Are you sure you want to remove this player's contract? They will remain in the squad but their wage will be deleted.")) return;
        await supabase.from('players').update({ 
            is_contracted: false, 
            contract_amount: null, 
            contract_frequency: null, 
            contract_start_date: null, 
            contract_end_date: null 
        }).eq('id', id);
        await fetchData();
    };

    const handleSaveContract = async () => {
        if (!editingPlayer || !editingPlayer.id) return;
        await supabase.from('players').update({
            is_contracted: true,
            contract_amount: editingPlayer.contractAmount,
            contract_frequency: editingPlayer.contractFrequency,
            contract_start_date: editingPlayer.contractStartDate ? editingPlayer.contractStartDate : null,
            contract_end_date: editingPlayer.contractEndDate ? editingPlayer.contractEndDate : null
        }).eq('id', editingPlayer.id);
        await fetchData();
        setIsEditModalOpen(false);
        setEditingPlayer(null);
    };

    const calculateWeeklyWage = (amount: number = 0, frequency: string = 'Weekly') => {
        if (frequency === 'Monthly') {
            return (amount * 12) / 52;
        }
        return amount;
    };

    const totalWeeklyExpenditure = players.reduce((sum, p) => sum + calculateWeeklyWage(p.contractAmount, p.contractFrequency), 0);
    const remainingBudget = budgetAllowance - totalWeeklyExpenditure;
    const isOverBudget = remainingBudget < 0;

    return (
        <div className="space-y-6 pb-12">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h2 className="text-3xl font-bold tracking-tight text-slate-900">Player Budgets</h2>
                        <p className="text-slate-500">Track player contracts against the club's wage structure.</p>
                    </div>
                </div>

                {/* KPI Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Card className="border-indigo-100 shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                            <PoundSterling className="h-16 w-16 text-indigo-900" />
                        </div>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-slate-500 flex justify-between items-center">
                                Weekly Budget Allowance
                                <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-indigo-600" onClick={() => { setTempBudget(budgetAllowance); setIsEditingBudget(true); }}>
                                    <Settings className="h-3.5 w-3.5" />
                                </Button>
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {isEditingBudget ? (
                                <div className="flex items-center gap-2 mt-1">
                                    <div className="relative">
                                        <span className="absolute left-2.5 top-2 text-slate-500">£</span>
                                        <Input
                                            type="number"
                                            className="w-32 pl-7 h-9 font-bold"
                                            value={tempBudget}
                                            onChange={(e) => setTempBudget(Number(e.target.value))}
                                            autoFocus
                                        />
                                    </div>
                                    <Button size="sm" onClick={saveBudget} className="h-9 bg-indigo-600 hover:bg-indigo-700">Save</Button>
                                    <Button size="sm" variant="ghost" onClick={() => setIsEditingBudget(false)}>Cancel</Button>
                                </div>
                            ) : (
                                <div className="text-3xl font-bold text-slate-900">£{budgetAllowance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                            )}
                            <p className="text-xs text-slate-500 mt-1">Set master allowance</p>
                        </CardContent>
                    </Card>

                    <Card className="border-slate-200 shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                            <Users className="h-16 w-16 text-slate-900" />
                        </div>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-slate-500">Current Weekly Spend</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold text-slate-900">
                                £{totalWeeklyExpenditure.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                            <p className="text-xs text-slate-500 mt-1">From {players.length} contracted players</p>
                        </CardContent>
                    </Card>

                    <Card className={`shadow-sm relative overflow-hidden ${isOverBudget ? 'border-red-200 bg-red-50/30' : 'border-green-200 bg-green-50/30'}`}>
                        <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                            {isOverBudget ? <TrendingDown className="h-16 w-16 text-red-900" /> : <TrendingUp className="h-16 w-16 text-green-900" />}
                        </div>
                        <CardHeader className="pb-2">
                            <CardTitle className={`text-sm font-medium ${isOverBudget ? 'text-red-700' : 'text-green-700'}`}>Remaining Budget</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className={`text-3xl font-bold ${isOverBudget ? 'text-red-700' : 'text-green-700'}`}>
                                {isOverBudget ? '-' : ''}£{Math.abs(remainingBudget).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                            <p className={`text-xs mt-1 ${isOverBudget ? 'text-red-500' : 'text-green-600'}`}>
                                {isOverBudget ? 'Currently over budget!' : 'Available to spend'}
                            </p>
                        </CardContent>
                    </Card>
                </div>

                <Card>
                    <CardHeader className="border-b bg-slate-50/50 flex flex-row items-center justify-between">
                        <div>
                            <CardTitle>Contracted Players</CardTitle>
                            <CardDescription>All players currently registered with an active contract.</CardDescription>
                        </div>
                        <Button size="sm" onClick={openAddModal} className="bg-indigo-600 hover:bg-indigo-700">
                            <Plus className="h-4 w-4 mr-2" /> Add Contract
                        </Button>
                    </CardHeader>
                    <CardContent className="p-0">
                        {players.length === 0 ? (
                            <div className="p-8 text-center text-slate-500 italic">No players are currently contracted. Add contracts via the Squad page.</div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-white border-b text-xs text-slate-500 uppercase font-semibold">
                                        <tr>
                                            <th className="px-6 py-4">Player Name</th>
                                            <th className="px-6 py-4">Squad</th>
                                            <th className="px-6 py-4 text-right">Contract Terms</th>
                                            <th className="px-6 py-4 text-right">Weekly Impact</th>
                                            <th className="px-6 py-4 text-right">Contract Length</th>
                                            <th className="px-6 py-4 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 bg-white">
                                        {players.map((player) => {
                                            const weeklyWage = calculateWeeklyWage(player.contractAmount, player.contractFrequency);
                                            return (
                                                <tr key={player.id} className="group hover:bg-slate-50 transition-colors">
                                                    <td className="px-6 py-4 font-medium text-slate-900">
                                                        {player.firstName} {player.lastName}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-800">
                                                            {player.squad}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <div className="font-semibold text-slate-900">£{player.contractAmount?.toLocaleString()} {player.contractFrequency}</div>
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <div className="font-bold text-red-600">£{weeklyWage.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                                                    </td>
                                                    <td className="px-6 py-4 text-right text-xs text-slate-500">
                                                        <div className="flex items-center justify-end gap-1">
                                                            <Calendar className="h-3 w-3" />
                                                            {player.contractStartDate ? new Date(player.contractStartDate).toLocaleDateString() : 'N/A'} - {player.contractEndDate ? new Date(player.contractEndDate).toLocaleDateString() : 'Ongoing'}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <div className="flex items-center justify-end gap-1">
                                                            <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-blue-600" onClick={() => openEditModal(player)}>
                                                                <Edit2 className="h-3 w-3" />
                                                            </Button>
                                                            <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-red-600" onClick={() => handleRemoveContract(player.id)}>
                                                                <Trash2 className="h-3 w-3" />
                                                            </Button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </CardContent>
                </Card>

            {/* QUICK EDIT MODAL */}
            <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{uncontractedPlayers.length > 0 ? "Add Contract to Player" : "Quick Edit Contract"}</DialogTitle>
                    </DialogHeader>
                    {editingPlayer && (
                        <div className="grid gap-4 py-4">
                            {uncontractedPlayers.length > 0 && (
                                <div className="space-y-2">
                                    <Label>Select Player</Label>
                                    <select 
                                        className="w-full h-10 px-3 border rounded-md"
                                        value={editingPlayer.id}
                                        onChange={e => setEditingPlayer({...editingPlayer, id: e.target.value})}
                                    >
                                        <option value="" disabled>Select a player...</option>
                                        {uncontractedPlayers.map(p => (
                                            <option key={p.id} value={p.id}>{p.firstName} {p.lastName} ({p.squad})</option>
                                        ))}
                                    </select>
                                </div>
                            )}
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Amount (£)</Label>
                                    <Input 
                                        type="number" 
                                        value={editingPlayer.contractAmount || ''} 
                                        onChange={e => setEditingPlayer({...editingPlayer, contractAmount: parseFloat(e.target.value)})} 
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Frequency</Label>
                                    <select 
                                        className="w-full h-10 px-3 border rounded-md"
                                        value={editingPlayer.contractFrequency || 'Weekly'}
                                        onChange={e => setEditingPlayer({...editingPlayer, contractFrequency: e.target.value as any})}
                                    >
                                        <option value="Weekly">Weekly</option>
                                        <option value="Monthly">Monthly</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Start Date</Label>
                                    <Input 
                                        type="date" 
                                        value={editingPlayer.contractStartDate || ''} 
                                        onChange={e => setEditingPlayer({...editingPlayer, contractStartDate: e.target.value})} 
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>End Date</Label>
                                    <Input 
                                        type="date" 
                                        value={editingPlayer.contractEndDate || ''} 
                                        onChange={e => setEditingPlayer({...editingPlayer, contractEndDate: e.target.value})} 
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>Cancel</Button>
                        <Button onClick={handleSaveContract} className="bg-indigo-600 hover:bg-indigo-700" disabled={!editingPlayer?.id}>Save Contract</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
