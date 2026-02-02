"use client";

import { useState, useEffect } from "react";
import { Sponsor } from "@/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea"; // Assuming you have this or will use standard textarea
import {
    Plus,
    Trash2,
    Pencil,
    Calendar,
    CheckCircle2,
    AlertCircle,
    ExternalLink,
    Briefcase
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { FinanceGate } from "@/components/auth/finance-gate";
import { supabase } from "@/lib/supabase";

export default function SponsorsPage() {
    const [sponsors, setSponsors] = useState<Sponsor[]>([]);
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    // Form State
    const [formData, setFormData] = useState<Partial<Sponsor>>({
        name: '',
        amount: 0,
        frequency: 'Yearly',
        description: '',
        website: '',
        startDate: '',
        endDate: '',
        responsibilities: ''
    });

    // ... (keep state) ...

    useEffect(() => {
        fetchSponsors();
        const channel = supabase.channel('public:sponsors')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'sponsors' }, fetchSponsors)
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, []);

    const fetchSponsors = async () => {
        const { data } = await supabase.from('sponsors').select('*');
        if (data) {
            setSponsors(data.map((s: any) => ({
                id: s.id,
                name: s.name,
                amount: s.amount,
                frequency: s.frequency,
                description: s.description,
                website: s.website,
                startDate: s.start_date,
                endDate: s.end_date,
                responsibilities: s.responsibilities
            })));
        }
    };

    // Removed saveSponsors helper

    const handleSave = async () => {
        if (!formData.name || !formData.amount) return;

        const payload = {
            name: formData.name,
            amount: formData.amount,
            frequency: formData.frequency,
            description: formData.description,
            website: formData.website,
            start_date: formData.startDate,
            end_date: formData.endDate,
            responsibilities: formData.responsibilities
        };

        if (editingId) {
            await supabase.from('sponsors').update(payload).eq('id', editingId);
        } else {
            await supabase.from('sponsors').insert([payload]);
        }
        closeModal();
    };

    const handleDelete = async (id: string) => {
        if (confirm("Are you sure you want to remove this sponsor? This will also remove them from the Finance dashboard.")) {
            await supabase.from('sponsors').delete().eq('id', id);
        }
    };

    const openEdit = (sponsor: Sponsor) => {
        setFormData(sponsor);
        setEditingId(sponsor.id);
        setIsAddOpen(true);
    };

    const closeModal = () => {
        setIsAddOpen(false);
        setEditingId(null);
        setFormData({
            name: '',
            amount: 0,
            frequency: 'Yearly',
            description: '',
            website: '',
            startDate: '',
            endDate: '',
            responsibilities: ''
        });
    };

    const getStatus = (endDate?: string) => {
        if (!endDate) return "Active";
        const end = new Date(endDate);
        const now = new Date();
        const daysLeft = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        if (daysLeft < 0) return "Expired";
        if (daysLeft < 30) return "Expiring Soon";
        return "Active";
    };

    return (
        <FinanceGate
            title="Sponsorship Access"
            description="Manage club partners and agreements."
        >
            <div className="space-y-6 pb-12">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h2 className="text-3xl font-bold tracking-tight text-slate-900">Sponsorships</h2>
                        <p className="text-slate-500">Manage partners, agreements, and deliverables.</p>
                    </div>
                    <Button onClick={() => setIsAddOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                        <Plus className="h-4 w-4 mr-2" /> Add Sponsor
                    </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {sponsors.length === 0 && (
                        <div className="col-span-full text-center py-12 bg-slate-50 rounded-lg border border-dashed border-slate-300">
                            <Briefcase className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                            <h3 className="text-lg font-medium text-slate-900">No Sponsors Yet</h3>
                            <p className="text-slate-500 mb-4">Add your first partner to start tracking agreements.</p>
                            <Button variant="outline" onClick={() => setIsAddOpen(true)}>Add Sponsor</Button>
                        </div>
                    )}

                    {sponsors.map((sponsor) => {
                        const status = getStatus(sponsor.endDate);
                        return (
                            <Card key={sponsor.id} className="hover:shadow-md transition-shadow">
                                <CardHeader className="flex flex-row items-start justify-between pb-2">
                                    <div>
                                        <Badge variant="outline" className={`mb-2 
                                        ${status === 'Active' ? 'bg-green-50 text-green-700 border-green-200' : ''}
                                        ${status === 'Expired' ? 'bg-slate-100 text-slate-500 border-slate-200' : ''}
                                        ${status === 'Expiring Soon' ? 'bg-amber-50 text-amber-700 border-amber-200' : ''}
                                    `}>
                                            {status}
                                        </Badge>
                                        <CardTitle className="text-xl">{sponsor.name}</CardTitle>
                                        {sponsor.website && (
                                            <a href={sponsor.website} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-600 hover:underline flex items-center gap-1 mt-1">
                                                Visit Website <ExternalLink className="h-3 w-3" />
                                            </a>
                                        )}
                                    </div>
                                    <div className="text-right">
                                        <div className="text-lg font-bold text-slate-900">£{sponsor.amount.toLocaleString()}</div>
                                        <div className="text-xs text-slate-500">{sponsor.frequency}</div>
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    {(sponsor.startDate || sponsor.endDate) && (
                                        <div className="flex items-center gap-2 text-xs text-slate-600 bg-slate-50 p-2 rounded">
                                            <Calendar className="h-3 w-3 text-slate-400" />
                                            <span>
                                                {sponsor.startDate ? new Date(sponsor.startDate).toLocaleDateString() : 'Start'}
                                                {' → '}
                                                {sponsor.endDate ? new Date(sponsor.endDate).toLocaleDateString() : 'Ongoing'}
                                            </span>
                                        </div>
                                    )}

                                    {sponsor.description && (
                                        <p className="text-sm text-slate-600 line-clamp-2" title={sponsor.description}>
                                            {sponsor.description}
                                        </p>
                                    )}

                                    {sponsor.responsibilities && (
                                        <div className="border-t pt-3 mt-3">
                                            <h4 className="text-xs font-semibold text-slate-500 uppercase mb-2">Deliverables</h4>
                                            <ul className="text-sm space-y-1">
                                                {sponsor.responsibilities.split('\n').map((item, i) => (
                                                    <li key={i} className="flex items-start gap-2">
                                                        <CheckCircle2 className="h-3.5 w-3.5 text-indigo-500 mt-0.5 shrink-0" />
                                                        <span className="text-slate-700">{item}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}

                                    <div className="flex justify-end gap-2 pt-2 border-t mt-2">
                                        <Button variant="ghost" size="sm" onClick={() => openEdit(sponsor)}>
                                            <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                                        </Button>
                                        <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => handleDelete(sponsor.id)}>
                                            <Trash2 className="h-3.5 w-3.5 mr-1" /> Remove
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>

                <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                    <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>{editingId ? 'Edit Sponsor' : 'Add New Sponsor'}</DialogTitle>
                            <DialogDescription>
                                Enter sponsorship details. This will automatically sync with your Finance Hub.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Sponsor Name</label>
                                    <Input
                                        placeholder="e.g. Local Briefs"
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Website</label>
                                    <Input
                                        placeholder="https://"
                                        value={formData.website}
                                        onChange={e => setFormData({ ...formData, website: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Agreement Value (£)</label>
                                    <Input
                                        type="number"
                                        placeholder="0.00"
                                        value={formData.amount || ''}
                                        onChange={e => setFormData({ ...formData, amount: parseFloat(e.target.value) })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Payment Frequency</label>
                                    <select
                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                        value={formData.frequency}
                                        onChange={e => setFormData({ ...formData, frequency: e.target.value as any })}
                                    >
                                        <option value="One-off">One-off Payment</option>
                                        <option value="Monthly">Monthly</option>
                                        <option value="Yearly">Yearly</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Start Date</label>
                                    <Input
                                        type="date"
                                        value={formData.startDate}
                                        onChange={e => setFormData({ ...formData, startDate: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">End Date</label>
                                    <Input
                                        type="date"
                                        value={formData.endDate}
                                        onChange={e => setFormData({ ...formData, endDate: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium">Description</label>
                                <Input
                                    placeholder="Brief description of the partnership..."
                                    value={formData.description}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium">Responsibilities & Deliverables</label>
                                <textarea
                                    className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-y"
                                    placeholder="• Logo on Kit&#10;• 3x Social Media Posts&#10;• Banner at Home Games"
                                    value={formData.responsibilities}
                                    onChange={e => setFormData({ ...formData, responsibilities: e.target.value })}
                                />
                                <p className="text-[10px] text-slate-500">Separate items with new lines.</p>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={closeModal}>Cancel</Button>
                            <Button onClick={handleSave}>{editingId ? 'Update Sponsor' : 'Add Sponsor'}</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </FinanceGate>
    );
}
