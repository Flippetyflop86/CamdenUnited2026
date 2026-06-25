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
    Briefcase,
    UploadCloud,
    FileText,
    Printer,
    TrendingUp,
    Paperclip,
    Download,
    Square,
    CheckSquare
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/auth-context";
import { useClub } from "@/context/club-context";

export default function SponsorsPage() {
    const { settings } = useClub();
    const [sponsors, setSponsors] = useState<Sponsor[]>([]);

    const [isAddOpen, setIsAddOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [selectedReportSponsor, setSelectedReportSponsor] = useState<Sponsor | null>(null);
    const [draftEmailSponsor, setDraftEmailSponsor] = useState<Sponsor | null>(null);
    const [isEmailOpen, setIsEmailOpen] = useState(false);

    const getDaysLeft = (endDateStr?: string) => {
        if (!endDateStr) return null;
        const end = new Date(endDateStr);
        const now = new Date();
        end.setHours(0,0,0,0);
        now.setHours(0,0,0,0);
        return Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    };

    // Form State
    const [formData, setFormData] = useState<Partial<Sponsor>>({
        name: '',
        amount: 0,
        frequency: 'Yearly',
        description: '',
        website: '',
        startDate: '',
        endDate: '',
        responsibilities: '',
        status: 'Secured',
        contractUrl: '',
        contractName: '',
        exposureStats: { impressions: 0, matches: 0, clicks: 0 }
    });

    const securedSponsors = sponsors.filter(s => s.status === 'Secured');
    const potentialSponsors = sponsors.filter(s => s.status !== 'Secured');

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
                responsibilities: s.responsibilities,
                status: s.status || 'Secured',
                contractUrl: s.contract_url,
                contractName: s.contract_name,
                exposureStats: s.exposure_stats || { impressions: 0, matches: 0, clicks: 0 }
            })));
        }
    };

    // Removed saveSponsors helper

    const handleSave = async () => {
        if (!formData.name || !formData.amount) return;

        let finalResponsibilities = formData.responsibilities || '';
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

        const payload = {
            name: formData.name,
            amount: formData.amount,
            frequency: formData.frequency,
            description: formData.description || null,
            website: formData.website || null,
            start_date: formData.startDate ? formData.startDate : null,
            end_date: formData.endDate ? formData.endDate : null,
            responsibilities: finalResponsibilities || null,
            status: formData.status || 'Secured',
            contract_url: formData.contractUrl || null,
            contract_name: formData.contractName || null,
            exposure_stats: formData.exposureStats || { impressions: 0, matches: 0, clicks: 0 }
        };

        if (editingId) {
            await supabase.from('sponsors').update(payload).eq('id', editingId);
        } else {
            await supabase.from('sponsors').insert([payload]);
        }
        await fetchSponsors();
        closeModal();
    };

    const handleDelete = async (id: string) => {
        if (confirm("Are you sure you want to remove this sponsor? This will also remove them from the Finance dashboard.")) {
            await supabase.from('sponsors').delete().eq('id', id);
            await fetchSponsors();
        }
    };

    const toggleDeliverable = async (sponsorId: string, index: number) => {
        const sponsor = sponsors.find(s => s.id === sponsorId);
        if (!sponsor) return;

        let deliverables = [];
        if (sponsor.responsibilities) {
            try {
                deliverables = JSON.parse(sponsor.responsibilities);
                if (!Array.isArray(deliverables)) throw new Error("Not array");
            } catch (e) {
                // Parse legacy newline text
                deliverables = sponsor.responsibilities.split('\n').filter(Boolean).map(item => ({
                    text: item.replace(/^•\s*/, '').trim(),
                    completed: false
                }));
            }
        }

        if (deliverables[index]) {
            deliverables[index].completed = !deliverables[index].completed;
        }

        const updatedJson = JSON.stringify(deliverables);

        // Optimistically update state to avoid lag
        setSponsors(prev => prev.map(s => s.id === sponsorId ? { ...s, responsibilities: updatedJson } : s));

        await supabase.from('sponsors').update({ responsibilities: updatedJson }).eq('id', sponsorId);
        await fetchSponsors();
    };

    const openEdit = (sponsor: Sponsor) => {
        let editingResponsibilities = sponsor.responsibilities || '';
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
        setFormData({
            ...sponsor,
            responsibilities: editingResponsibilities
        });
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
            responsibilities: '',
            status: 'Secured',
            contractUrl: '',
            contractName: '',
            exposureStats: { impressions: 0, matches: 0, clicks: 0 }
        });
    };

    const getDeliverables = (responsibilities?: string) => {
        if (!responsibilities) return [];
        try {
            const parsed = JSON.parse(responsibilities);
            if (Array.isArray(parsed)) return parsed;
        } catch (e) {
            // Not JSON
        }
        return responsibilities.split('\n').filter(Boolean).map(item => ({
            text: item.replace(/^•\s*/, '').trim(),
            completed: false
        }));
    };

    const getStatusBadge = (sponsor: Sponsor) => {
        if (sponsor.status !== 'Secured') {
            switch (sponsor.status) {
                case 'Lead':
                    return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Lead</Badge>;
                case 'Contacted':
                    return <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">Contacted</Badge>;
                case 'Proposal':
                    return <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 font-medium">Proposal Sent</Badge>;
                case 'Review':
                    return <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 font-medium animate-pulse">Contract Review</Badge>;
                default:
                    return <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-200">{sponsor.status}</Badge>;
            }
        }

        const endDate = sponsor.endDate;
        if (!endDate) {
            return (
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                    Active (Ongoing)
                </Badge>
            );
        }
        const end = new Date(endDate);
        const now = new Date();
        end.setHours(0,0,0,0);
        now.setHours(0,0,0,0);
        const daysLeft = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        if (daysLeft < 0) {
            return (
                <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 flex items-center gap-1">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" /> Expired ({Math.abs(daysLeft)}d ago)
                </Badge>
            );
        }
        if (daysLeft === 0) {
            return (
                <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 animate-pulse flex items-center gap-1">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" /> Expires Today
                </Badge>
            );
        }
        if (daysLeft <= 30) {
            return (
                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 animate-pulse flex items-center gap-1">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {daysLeft} days left
                </Badge>
            );
        }
        return (
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                Active ({daysLeft}d left)
            </Badge>
        );
    };

    const renderSponsorsGrid = (list: Sponsor[], type: 'secured' | 'potential') => {
        if (list.length === 0) {
            return (
                <div className="col-span-full text-center py-12 bg-slate-50 rounded-lg border border-dashed border-slate-300">
                    <Briefcase className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                    <h3 className="text-lg font-medium text-slate-900">
                        {type === 'secured' ? 'No Secured Sponsors' : 'No Potential Sponsors'}
                    </h3>
                    <p className="text-slate-500 mb-4">
                        {type === 'secured' 
                            ? 'Add a new secured partner to start tracking agreements.' 
                            : 'Add a potential partner to track progress during negotiations.'}
                    </p>
                    <Button variant="outline" onClick={() => {
                        setFormData({
                            name: '',
                            amount: 0,
                            frequency: 'Yearly',
                            description: '',
                            website: '',
                            startDate: '',
                            endDate: '',
                            responsibilities: '',
                            status: type === 'secured' ? 'Secured' : 'Lead',
                            contractUrl: '',
                            contractName: '',
                            exposureStats: { impressions: 0, matches: 0, clicks: 0 }
                        });
                        setIsAddOpen(true);
                    }}>Add Sponsor</Button>
                </div>
            );
        }

        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {list.map((sponsor) => {
                    const deliverables = getDeliverables(sponsor.responsibilities);
                    return (
                        <Card key={sponsor.id} className="hover:shadow-md transition-shadow flex flex-col justify-between">
                            <div>
                                <CardHeader className="flex flex-row items-start justify-between pb-2">
                                    <div className="space-y-1.5 max-w-[65%]">
                                        <div className="flex gap-1.5 flex-wrap items-center">
                                            {getStatusBadge(sponsor)}
                                        </div>
                                        <CardTitle className="text-xl truncate" title={sponsor.name}>{sponsor.name}</CardTitle>
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
                                            <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" />
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

                                    {/* Interactive checklist */}
                                    {deliverables.length > 0 && (
                                        <div className="border-t pt-3 mt-3">
                                            <h4 className="text-xs font-semibold text-slate-500 uppercase mb-2">Deliverables</h4>
                                            <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
                                                {deliverables.map((item: any, i: number) => (
                                                    <button
                                                        key={i}
                                                        onClick={() => toggleDeliverable(sponsor.id, i)}
                                                        className="flex items-start gap-2 w-full text-left hover:bg-slate-50 p-1 rounded transition-colors text-xs"
                                                    >
                                                        {item.completed ? (
                                                            <CheckSquare className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
                                                        ) : (
                                                            <Square className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                                                        )}
                                                        <span className={`text-slate-700 ${item.completed ? 'line-through text-slate-400' : ''}`}>
                                                            {item.text}
                                                        </span>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Document attachment links */}
                                    {sponsor.contractUrl && (
                                        <div className="border-t pt-3 mt-3">
                                            <h4 className="text-xs font-semibold text-slate-500 uppercase mb-2 flex items-center gap-1">
                                                <Paperclip className="h-3.5 w-3.5 text-slate-400" /> Agreement / Contract
                                            </h4>
                                            <a 
                                                href={sponsor.contractUrl} 
                                                download={sponsor.contractName || 'contract'} 
                                                target="_blank" 
                                                rel="noopener noreferrer"
                                                className="flex items-center gap-2 text-xs font-medium text-indigo-600 hover:text-indigo-700 hover:underline bg-indigo-50/50 p-2 rounded border border-indigo-100"
                                            >
                                                <FileText className="h-4 w-4 text-indigo-500 shrink-0" />
                                                <span className="truncate flex-1">{sponsor.contractName || 'View Agreement'}</span>
                                                <Download className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                                            </a>
                                        </div>
                                    )}

                                    {/* ROI Stats section on card */}
                                    {sponsor.status === 'Secured' && sponsor.exposureStats && (
                                        <div className="border-t pt-3 mt-3">
                                            <h4 className="text-xs font-semibold text-slate-500 uppercase mb-2 flex items-center gap-1">
                                                <TrendingUp className="h-3.5 w-3.5 text-slate-400" /> Exposure & ROI
                                            </h4>
                                            <div className="grid grid-cols-3 gap-2 text-center text-[10px] bg-slate-50 p-2 rounded">
                                                <div>
                                                    <div className="text-slate-500 font-medium">Impressions</div>
                                                    <div className="font-semibold text-slate-800">{sponsor.exposureStats.impressions?.toLocaleString() ?? 0}</div>
                                                </div>
                                                <div>
                                                    <div className="text-slate-500 font-medium">Matches</div>
                                                    <div className="font-semibold text-slate-800">{sponsor.exposureStats.matches ?? 0}</div>
                                                </div>
                                                <div>
                                                    <div className="text-slate-500 font-medium">Clicks</div>
                                                    <div className="font-semibold text-slate-800">{sponsor.exposureStats.clicks?.toLocaleString() ?? 0}</div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </CardContent>
                            </div>
                            <CardContent className="pt-0 pb-4">
                                <div className="flex justify-between items-center pt-2 border-t mt-2">
                                    {sponsor.status === 'Secured' ? (
                                        <Button variant="outline" size="sm" className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 border-indigo-200 h-8" onClick={() => setSelectedReportSponsor(sponsor)}>
                                            <FileText className="h-3.5 w-3.5 mr-1" /> ROI Report
                                        </Button>
                                    ) : (
                                        <div />
                                    )}
                                    <div className="flex gap-2">
                                        <Button variant="ghost" size="sm" className="h-8" onClick={() => openEdit(sponsor)}>
                                            <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                                        </Button>
                                        <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-600 hover:bg-red-50 h-8" onClick={() => handleDelete(sponsor.id)}>
                                            <Trash2 className="h-3.5 w-3.5 mr-1" /> Remove
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>
        );
    };

    return (
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

                {/* Expiring Sponsors Alert Box */}
                {(() => {
                    const expiringSponsors = securedSponsors.filter(s => {
                        const days = getDaysLeft(s.endDate);
                        return days !== null && days <= 30;
                    });
                    if (expiringSponsors.length === 0) return null;
                    return (
                        <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl space-y-3">
                            <div className="flex items-center gap-2 text-amber-800 font-bold text-sm">
                                <AlertCircle className="h-5 w-5 text-amber-600 animate-pulse" />
                                <span>Sponsorship Contracts Requiring Attention ({expiringSponsors.length})</span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                                {expiringSponsors.map(sponsor => {
                                    const days = getDaysLeft(sponsor.endDate);
                                    let notice = "";
                                    if (days !== null) {
                                        if (days < 0) notice = `Expired ${Math.abs(days)} days ago`;
                                        else if (days === 0) notice = "Expires Today!";
                                        else notice = `Expires in ${days} days`;
                                    }
                                    return (
                                        <div key={sponsor.id} className="flex justify-between items-center bg-white p-3 rounded-lg border border-amber-200/60 shadow-sm gap-2">
                                            <div className="overflow-hidden">
                                                <p className="font-bold text-slate-900 truncate">{sponsor.name}</p>
                                                <p className="text-slate-500 font-medium">{notice} ({sponsor.endDate ? new Date(sponsor.endDate).toLocaleDateString() : ''})</p>
                                            </div>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => {
                                                    setDraftEmailSponsor(sponsor);
                                                    setIsEmailOpen(true);
                                                }}
                                                className="bg-amber-100 hover:bg-amber-200 text-amber-900 border-amber-300 font-semibold h-8 shrink-0 text-[11px]"
                                            >
                                                Draft Renewal
                                            </Button>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })()}

                <Tabs defaultValue="secured" className="w-full">
                    <TabsList className="flex gap-1 bg-slate-100 p-1 rounded-lg w-fit mb-6">
                        <TabsTrigger value="secured" className="px-4 py-1.5 text-sm font-medium">Secured ({securedSponsors.length})</TabsTrigger>
                        <TabsTrigger value="potential" className="px-4 py-1.5 text-sm font-medium">In Negotiation ({potentialSponsors.length})</TabsTrigger>
                    </TabsList>

                    <TabsContent value="secured" className="mt-0">
                        {renderSponsorsGrid(securedSponsors, 'secured')}
                    </TabsContent>
                    <TabsContent value="potential" className="mt-0">
                        {renderSponsorsGrid(potentialSponsors, 'potential')}
                    </TabsContent>
                </Tabs>

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
                                    <label className="text-sm font-medium">Status</label>
                                    <select
                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                                        value={formData.status || 'Secured'}
                                        onChange={e => setFormData({ ...formData, status: e.target.value as any })}
                                    >
                                        <option value="Secured">Secured Partner</option>
                                        <option value="Lead">Potential: Targeted Lead</option>
                                        <option value="Contacted">Potential: Contacted</option>
                                        <option value="Proposal">Potential: Proposal Sent</option>
                                        <option value="Review">Potential: Contract Review</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Website</label>
                                    <Input
                                        placeholder="https://"
                                        value={formData.website}
                                        onChange={e => setFormData({ ...formData, website: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Agreement Value (£)</label>
                                    <Input
                                        type="number"
                                        placeholder="0.00"
                                        value={formData.amount || ''}
                                        onChange={e => setFormData({ ...formData, amount: parseFloat(e.target.value) })}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
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
                                <div className="space-y-2">
                                    {/* Empty Column */}
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

                            <div className="border-t pt-4 space-y-4">
                                <h4 className="text-sm font-semibold text-slate-700">Contract / Agreement</h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Agreement Link (URL)</label>
                                        <Input
                                            placeholder="https://drive.google.com/..."
                                            value={formData.contractUrl || ''}
                                            onChange={e => setFormData({ ...formData, contractUrl: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Agreement Display Name</label>
                                        <Input
                                            placeholder="e.g. Contract_2026.pdf"
                                            value={formData.contractName || ''}
                                            onChange={e => setFormData({ ...formData, contractName: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-2 col-span-2">
                                        <label className="text-sm font-medium block">Or Upload Local Document (Max 2MB)</label>
                                        <label className="cursor-pointer block mt-1">
                                            <div className="flex items-center justify-center w-full h-10 px-3 py-2 text-sm border rounded-md hover:bg-slate-50 bg-white border-dashed text-slate-500">
                                                <UploadCloud className="w-4 h-4 mr-2" />
                                                {formData.contractName && formData.contractUrl?.startsWith('data:') 
                                                    ? `Selected: ${formData.contractName}` 
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
                                                            setFormData(prev => ({
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
                            </div>

                            <div className="border-t pt-4 space-y-4">
                                <h4 className="text-sm font-semibold text-slate-700">Exposure Statistics (ROI)</h4>
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Impressions</label>
                                        <Input
                                            type="number"
                                            placeholder="0"
                                            value={formData.exposureStats?.impressions ?? 0}
                                            onChange={e => setFormData(prev => ({
                                                ...prev,
                                                exposureStats: {
                                                    ...prev.exposureStats,
                                                    impressions: parseInt(e.target.value) || 0
                                                } as any
                                            }))}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Matches Displayed</label>
                                        <Input
                                            type="number"
                                            placeholder="0"
                                            value={formData.exposureStats?.matches ?? 0}
                                            onChange={e => setFormData(prev => ({
                                                ...prev,
                                                exposureStats: {
                                                    ...prev.exposureStats,
                                                    matches: parseInt(e.target.value) || 0
                                                } as any
                                            }))}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Website Clicks</label>
                                        <Input
                                            type="number"
                                            placeholder="0"
                                            value={formData.exposureStats?.clicks ?? 0}
                                            onChange={e => setFormData(prev => ({
                                                ...prev,
                                                exposureStats: {
                                                    ...prev.exposureStats,
                                                    clicks: parseInt(e.target.value) || 0
                                                } as any
                                            }))}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={closeModal}>Cancel</Button>
                            <Button onClick={handleSave}>{editingId ? 'Update Sponsor' : 'Add Sponsor'}</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                <Dialog open={!!selectedReportSponsor} onOpenChange={() => setSelectedReportSponsor(null)}>
                    <DialogContent className="sm:max-w-[700px] print-area max-h-[90vh] overflow-y-auto">
                        <DialogHeader className="no-print">
                            <DialogTitle className="flex items-center gap-2">
                                <TrendingUp className="h-5 w-5 text-indigo-600" /> Sponsorship ROI & Performance Report
                            </DialogTitle>
                            <DialogDescription>
                                Review and print a performance breakdown for {selectedReportSponsor?.name}.
                            </DialogDescription>
                        </DialogHeader>

                        {selectedReportSponsor && (
                            <div className="space-y-6 py-4">
                                <style>{`
                                    @media print {
                                        body {
                                            background-color: white !important;
                                            color: black !important;
                                        }
                                        .no-print {
                                            display: none !important;
                                        }
                                        .print-area {
                                            position: absolute !important;
                                            left: 0 !important;
                                            top: 0 !important;
                                            width: 100% !important;
                                            height: auto !important;
                                            margin: 0 !important;
                                            padding: 0 !important;
                                            box-shadow: none !important;
                                            border: none !important;
                                            visibility: visible !important;
                                        }
                                        [data-state="open"] {
                                            background-color: white !important;
                                        }
                                    }
                                `}</style>

                                <div className="border border-slate-200 rounded-lg p-6 space-y-6 bg-white">
                                    <div className="flex justify-between items-start border-b pb-4">
                                        <div>
                                            <h1 className="text-2xl font-bold text-slate-900">{settings.name}</h1>
                                            <p className="text-xs text-slate-500">Sponsorship Performance & ROI Report</p>
                                        </div>
                                        <div className="text-right">
                                            <h2 className="text-xl font-bold text-indigo-600">{selectedReportSponsor.name}</h2>
                                            <p className="text-xs text-slate-500">
                                                Generated: {new Date().toLocaleDateString()}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-3 gap-4 text-sm bg-slate-50 p-4 rounded-lg">
                                        <div>
                                            <div className="text-slate-500 text-xs uppercase font-semibold">Agreement Value</div>
                                            <div className="text-lg font-bold text-slate-800">
                                                £{selectedReportSponsor.amount.toLocaleString()} ({selectedReportSponsor.frequency})
                                            </div>
                                        </div>
                                        <div>
                                            <div className="text-slate-500 text-xs uppercase font-semibold">Start Date</div>
                                            <div className="text-slate-800 font-medium">
                                                {selectedReportSponsor.startDate ? new Date(selectedReportSponsor.startDate).toLocaleDateString() : 'N/A'}
                                            </div>
                                        </div>
                                        <div>
                                            <div className="text-slate-500 text-xs uppercase font-semibold">End Date</div>
                                            <div className="text-slate-800 font-medium">
                                                {selectedReportSponsor.endDate ? new Date(selectedReportSponsor.endDate).toLocaleDateString() : 'Ongoing'}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">Exposure & Reach Metrics</h3>
                                        <div className="grid grid-cols-3 gap-4 text-center">
                                            <div className="border border-slate-100 rounded-lg p-4 bg-slate-50/50">
                                                <div className="text-2xl font-extrabold text-indigo-600">
                                                    {selectedReportSponsor.exposureStats?.impressions?.toLocaleString() ?? 0}
                                                </div>
                                                <div className="text-xs text-slate-500 font-medium mt-1">Total Impressions</div>
                                            </div>
                                            <div className="border border-slate-100 rounded-lg p-4 bg-slate-50/50">
                                                <div className="text-2xl font-extrabold text-indigo-600">
                                                    {selectedReportSponsor.exposureStats?.matches ?? 0}
                                                </div>
                                                <div className="text-xs text-slate-500 font-medium mt-1">Matches Played</div>
                                            </div>
                                            <div className="border border-slate-100 rounded-lg p-4 bg-slate-50/50">
                                                <div className="text-2xl font-extrabold text-indigo-600">
                                                    {selectedReportSponsor.exposureStats?.clicks?.toLocaleString() ?? 0}
                                                </div>
                                                <div className="text-xs text-slate-500 font-medium mt-1">Website Clicks</div>
                                            </div>
                                        </div>
                                    </div>

                                    {(() => {
                                        const deliverables = getDeliverables(selectedReportSponsor.responsibilities);
                                        const completedCount = deliverables.filter(d => d.completed).length;
                                        const totalCount = deliverables.length;
                                        const percentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

                                        return (
                                            <div className="space-y-4">
                                                <div className="flex justify-between items-baseline">
                                                    <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">Agreement Deliverables</h3>
                                                    <span className="text-xs font-semibold text-indigo-600">
                                                        {completedCount} / {totalCount} Completed ({percentage}%)
                                                    </span>
                                                </div>

                                                {totalCount > 0 ? (
                                                    <div className="border border-slate-100 rounded-lg divide-y divide-slate-100">
                                                        {deliverables.map((item, idx) => (
                                                            <div key={idx} className="flex items-center justify-between p-3 text-sm">
                                                                <span className="text-slate-700 font-medium">{item.text}</span>
                                                                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                                                                    item.completed 
                                                                        ? 'bg-green-50 text-green-700 border border-green-200' 
                                                                        : 'bg-slate-100 text-slate-500 border border-slate-200'
                                                                }`}>
                                                                    {item.completed ? 'Delivered' : 'Pending'}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <p className="text-sm text-slate-400 italic">No specific deliverables defined for this sponsorship.</p>
                                                )}
                                            </div>
                                        );
                                    })()}

                                    <div className="border-t pt-4 text-center text-xs text-slate-400">
                                        <p>This report has been compiled and verified by the club administration for {settings.name}.</p>
                                        <p className="mt-1">© {new Date().getFullYear()} {settings.name}. All rights reserved.</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        <DialogFooter className="no-print">
                            <Button variant="outline" onClick={() => setSelectedReportSponsor(null)}>Close</Button>
                            <Button onClick={() => window.print()} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                                <Printer className="h-4 w-4 mr-2" /> Print / Save PDF
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Contract Renewal Draft Email Dialog */}
                <Dialog open={isEmailOpen} onOpenChange={setIsEmailOpen}>
                    <DialogContent className="sm:max-w-[550px] bg-white text-slate-900">
                        <DialogHeader>
                            <DialogTitle className="text-lg font-bold flex items-center gap-2">
                                <FileText className="h-5 w-5 text-indigo-600" />
                                Sponsor Contract Renewal Draft
                            </DialogTitle>
                            <DialogDescription>
                                Copy this draft to email {draftEmailSponsor?.name} regarding their renewal.
                            </DialogDescription>
                        </DialogHeader>
                        {draftEmailSponsor && (
                            <div className="space-y-4 py-3">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-400 uppercase">Subject</label>
                                    <Input
                                        readOnly
                                        value={`Sponsorship Renewal - ${settings.name} & ${draftEmailSponsor.name}`}
                                        className="bg-slate-50 text-xs font-semibold text-slate-900 border-slate-200"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-400 uppercase">Message Body</label>
                                    <Textarea
                                        readOnly
                                        rows={12}
                                        value={`Dear ${draftEmailSponsor.name} Team,

I hope you are well.

We want to express our sincere thanks for your partnership as a Secured Sponsor of ${settings.name}. Your support has been vital to our success.

We wanted to note that your current sponsorship contract (£${draftEmailSponsor.amount.toLocaleString()} / ${draftEmailSponsor.frequency.toLowerCase()}) is scheduled for renewal on ${draftEmailSponsor.endDate ? new Date(draftEmailSponsor.endDate).toLocaleDateString() : 'N/A'}. 

We would love to extend this partnership for the upcoming season and discuss how we can continue to maximize exposure and return on investment for your brand.

Please let us know if you're available for a brief call next week to discuss renewal packages.

Best regards,

[Your Name]
${settings.name}`}
                                        className="bg-slate-50 text-xs leading-relaxed text-slate-900 border-slate-200"
                                    />
                                </div>
                                <div className="flex gap-2 justify-end pt-2">
                                    <Button
                                        variant="outline"
                                        onClick={() => setIsEmailOpen(false)}
                                    >
                                        Close
                                    </Button>
                                    <Button
                                        onClick={() => {
                                            const subject = encodeURIComponent(`Sponsorship Renewal - ${settings.name} & ${draftEmailSponsor.name}`);
                                            const body = encodeURIComponent(`Dear ${draftEmailSponsor.name} Team,\n\nI hope you are well.\n\nWe want to express our sincere thanks for your partnership as a Secured Sponsor of ${settings.name}.\n\nYour support has been vital to our success.\n\nWe wanted to note that your current sponsorship contract (£${draftEmailSponsor.amount.toLocaleString()} / ${draftEmailSponsor.frequency.toLowerCase()}) is scheduled for renewal on ${draftEmailSponsor.endDate ? new Date(draftEmailSponsor.endDate).toLocaleDateString() : 'N/A'}.\n\nWe would love to extend this partnership for the upcoming season and discuss how we can continue to maximize exposure and return on investment for your brand.\n\nPlease let us know if you're available for a brief call next week to discuss renewal packages.\n\nBest regards,\n\n[Your Name]\n${settings.name}`);
                                            window.open(`mailto:?subject=${subject}&body=${body}`, '_blank');
                                        }}
                                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
                                    >
                                        Open in Mail App
                                    </Button>
                                    <Button
                                        onClick={() => {
                                            const text = `Subject: Sponsorship Renewal - ${settings.name} & ${draftEmailSponsor.name}\n\nDear ${draftEmailSponsor.name} Team,\n\nI hope you are well.\n\nWe want to express our sincere thanks for your partnership as a Secured Sponsor of ${settings.name}.\n\nYour support has been vital to our success.\n\nWe wanted to note that your current sponsorship contract (£${draftEmailSponsor.amount.toLocaleString()} / ${draftEmailSponsor.frequency.toLowerCase()}) is scheduled for renewal on ${draftEmailSponsor.endDate ? new Date(draftEmailSponsor.endDate).toLocaleDateString() : 'N/A'}.\n\nWe would love to extend this partnership for the upcoming season and discuss how we can continue to maximize exposure and return on investment for your brand.\n\nPlease let us know if you're available for a brief call next week to discuss renewal packages.\n\nBest regards,\n\n[Your Name]\n${settings.name}`;
                                            navigator.clipboard.writeText(text);
                                            alert("Copied to clipboard!");
                                        }}
                                        className="bg-slate-900 hover:bg-slate-800 text-white font-semibold"
                                    >
                                        Copy Draft
                                    </Button>
                                </div>
                            </div>
                        )}
                    </DialogContent>
                </Dialog>
            </div>
    );
}
