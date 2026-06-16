"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, Edit2, Users, Mail, Phone, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";

type StaffMember = {
    id: string;
    name: string;
    role: string;
    email?: string;
    phone?: string;
    notes?: string;
    isContracted?: boolean;
    contractAmount?: number;
    contractFrequency?: string;
    contractStartDate?: string;
    contractEndDate?: string;
};

export default function StaffPage() {
    const [staff, setStaff] = useState<StaffMember[]>([]);
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formData, setFormData] = useState<Omit<StaffMember, "id">>({
        name: "",
        role: "Coach",
        email: "",
        phone: "",
        notes: "",
        isContracted: false,
        contractAmount: 0,
        contractFrequency: "Monthly",
        contractStartDate: "",
        contractEndDate: ""
    });

    useEffect(() => {
        fetchStaff();
    }, []);

    async function fetchStaff() {
        try {
            const { data, error } = await supabase.from("staff").select("*");
            if (error) throw error;
            const formatted = (data || []).map((s: any) => ({
                id: s.id,
                name: s.name,
                role: s.role,
                email: s.email,
                phone: s.phone,
                notes: s.notes,
                isContracted: s.is_contracted,
                contractAmount: s.contract_amount,
                contractFrequency: s.contract_frequency || "Monthly",
                contractStartDate: s.contract_start_date,
                contractEndDate: s.contract_end_date
            }));
            setStaff(formatted);
        } catch (e: any) {
            console.error("Error fetching staff:", e.message || e);
        }
    }

    const handleSave = async () => {
        if (!formData.name || !formData.role) return;

        const isNew = !editingId;
        const payload = {
            name: formData.name,
            role: formData.role,
            email: formData.email,
            phone: formData.phone,
            notes: formData.notes,
            is_contracted: formData.isContracted,
            contract_amount: formData.contractAmount,
            contract_frequency: formData.contractFrequency,
            contract_start_date: formData.contractStartDate ? formData.contractStartDate : null,
            contract_end_date: formData.contractEndDate ? formData.contractEndDate : null
        };

        try {
            if (isNew) {
                const { error } = await supabase.from("staff").insert([payload]);
                if (error) throw error;
            } else {
                const { error } = await supabase.from("staff").update(payload).eq("id", editingId);
                if (error) throw error;
            }
            await fetchStaff();
            setIsAddOpen(false);
            setEditingId(null);
            setFormData({ name: "", role: "Coach", email: "", phone: "", notes: "", isContracted: false, contractAmount: 0, contractFrequency: "Monthly" });
        } catch (e: any) {
            console.error("Supabase save failed:", e.message);
            alert("Failed to save staff member. Ensure you have run the SQL script to create the staff table.");
        }
    };

    const handleEdit = (member: StaffMember) => {
        setFormData({
            name: member.name,
            role: member.role,
            email: member.email || "",
            phone: member.phone || "",
            notes: member.notes || "",
            isContracted: member.isContracted || false,
            contractAmount: member.contractAmount || 0,
            contractFrequency: member.contractFrequency || "Monthly",
            contractStartDate: member.contractStartDate || "",
            contractEndDate: member.contractEndDate || ""
        });
        setEditingId(member.id);
        setIsAddOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to remove this staff member?")) return;
        
        try {
            const { error } = await supabase.from("staff").delete().eq("id", id);
            if (error) throw error;
            await fetchStaff();
        } catch (e: any) {
            console.error("Delete failed:", e.message);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-slate-900">Staff Management</h2>
                    <p className="text-slate-500">Manage coaches, physios, and club administration personnel.</p>
                </div>
                <Button className="bg-slate-900 hover:bg-slate-800" onClick={() => {
                    setEditingId(null);
                    setFormData({ name: "", role: "Coach", email: "", phone: "", notes: "", isContracted: false, contractAmount: 0, contractFrequency: "Monthly" });
                    setIsAddOpen(true);
                }}>
                    <Plus className="h-4 w-4 mr-2" /> Add Staff Member
                </Button>
            </div>

            {staff.length === 0 ? (
                <div className="text-center py-16 text-slate-400 border-2 border-dashed rounded-lg bg-slate-50">
                    <Users className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                    <p>No staff members added yet.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {staff.map((member) => (
                        <Card key={member.id} className="overflow-hidden hover:shadow-md transition-all border-slate-200">
                            <CardHeader className="bg-slate-50 border-b pb-4 pt-5">
                                <div className="flex justify-between items-start">
                                    <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 bg-slate-200 rounded-full flex items-center justify-center shrink-0">
                                            <span className="font-bold text-slate-500 text-sm">
                                                {member.name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase()}
                                            </span>
                                        </div>
                                        <div>
                                            <CardTitle className="text-lg">{member.name}</CardTitle>
                                            <div className="flex items-center gap-1.5 text-xs font-medium text-blue-600 mt-1 bg-blue-50 w-fit px-2 py-0.5 rounded">
                                                <ShieldCheck className="h-3 w-3" />
                                                {member.role}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex gap-1">
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-blue-600" onClick={() => handleEdit(member)}>
                                            <Edit2 className="h-4 w-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-600" onClick={() => handleDelete(member.id)}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="pt-4 space-y-3">
                                {member.email && (
                                    <div className="flex items-center gap-2 text-sm text-slate-600">
                                        <Mail className="h-4 w-4 text-slate-400 shrink-0" />
                                        <a href={`mailto:${member.email}`} className="hover:text-blue-600 truncate">{member.email}</a>
                                    </div>
                                )}
                                {member.phone && (
                                    <div className="flex items-center gap-2 text-sm text-slate-600">
                                        <Phone className="h-4 w-4 text-slate-400 shrink-0" />
                                        <a href={`tel:${member.phone}`} className="hover:text-blue-600">{member.phone}</a>
                                    </div>
                                )}
                                {member.notes && (
                                    <div className="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-500 italic">
                                        {member.notes}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingId ? "Edit Staff Member" : "Add Staff Member"}</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="space-y-2">
                            <Label>Full Name</Label>
                            <Input placeholder="e.g. John Doe" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                            <Label>Role</Label>
                            <Input placeholder="e.g. Head Coach, Physio, Admin" value={formData.role} onChange={e => setFormData({ ...formData, role: e.target.value })} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Email</Label>
                                <Input type="email" placeholder="john@example.com" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
                            </div>
                            <div className="space-y-2">
                                <Label>Phone</Label>
                                <Input type="tel" placeholder="07123 456 789" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Notes / Qualifications</Label>
                            <Input placeholder="e.g. UEFA B License..." value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} />
                        </div>
                        
                        <div className="pt-4 border-t border-slate-100 mt-2">
                            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 cursor-pointer mb-3">
                                <input
                                    type="checkbox"
                                    checked={formData.isContracted || false}
                                    onChange={(e) => setFormData({ ...formData, isContracted: e.target.checked })}
                                    className="h-4 w-4 text-slate-900 focus:ring-slate-900 border-gray-300 rounded"
                                />
                                Staff is Contracted / Paid
                            </label>

                            {formData.isContracted && (
                                <div className="grid grid-cols-2 gap-3 mb-2 p-3 bg-slate-50 rounded border border-slate-200">
                                    <div className="space-y-1">
                                        <label className="text-xs font-medium text-slate-500">Contract Amount (£)</label>
                                        <Input
                                            type="number"
                                            value={formData.contractAmount || ''}
                                            onChange={(e) => setFormData({ ...formData, contractAmount: parseFloat(e.target.value) })}
                                            className="h-8 text-xs bg-white"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-medium text-slate-500">Frequency</label>
                                        <select
                                            value={formData.contractFrequency || 'Monthly'}
                                            onChange={(e) => setFormData({ ...formData, contractFrequency: e.target.value as any })}
                                            className="w-full h-8 px-2 border rounded-md text-xs bg-white"
                                        >
                                            <option value="Weekly">Weekly</option>
                                            <option value="Monthly">Monthly</option>
                                        </select>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-medium text-slate-500">Start Date</label>
                                        <Input
                                            type="date"
                                            value={formData.contractStartDate || ''}
                                            onChange={(e) => setFormData({ ...formData, contractStartDate: e.target.value })}
                                            className="h-8 text-xs bg-white"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-medium text-slate-500">End Date</label>
                                        <Input
                                            type="date"
                                            value={formData.contractEndDate || ''}
                                            onChange={(e) => setFormData({ ...formData, contractEndDate: e.target.value })}
                                            className="h-8 text-xs bg-white"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
                        <Button onClick={handleSave} className="bg-slate-900 hover:bg-slate-800">Save</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
