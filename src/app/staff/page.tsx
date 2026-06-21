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
            const { data: staffData, error: staffError } = await supabase.from("staff").select("*");
            if (staffError) throw staffError;

            const { data: membersData, error: membersError } = await supabase.from("club_members").select("*");
            if (membersError) throw membersError;

            const formattedStaff = (staffData || []).map((s: any) => ({
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

            const merged: StaffMember[] = [];
            const processedStaffIds = new Set<string>();
            const processedEmails = new Set<string>();
            const processedNames = new Set<string>();

            // 1. Process all registered members
            (membersData || []).forEach((m: any) => {
                const memberEmail = m.email?.toLowerCase().trim();
                const memberName = m.display_name?.toLowerCase().trim();

                // Find matching manual staff member
                const matchingStaff = formattedStaff.find(s => {
                    const staffEmail = s.email?.toLowerCase().trim();
                    const staffName = s.name?.toLowerCase().trim();
                    return (memberEmail && staffEmail && memberEmail === staffEmail) ||
                           (memberName && staffName && memberName === staffName);
                });

                if (matchingStaff) {
                    processedStaffIds.add(matchingStaff.id);
                    if (matchingStaff.email) processedEmails.add(matchingStaff.email.toLowerCase().trim());
                    processedNames.add(matchingStaff.name.toLowerCase().trim());

                    merged.push({
                        id: `member-${m.user_id}`,
                        name: m.display_name || matchingStaff.name || m.email || "Registered User",
                        role: matchingStaff.role || (m.role === "manager" ? "Manager" : m.role ? m.role.charAt(0).toUpperCase() + m.role.slice(1) : "Staff"),
                        email: m.email || matchingStaff.email,
                        phone: matchingStaff.phone,
                        notes: matchingStaff.notes,
                        isContracted: matchingStaff.isContracted,
                        contractAmount: matchingStaff.contractAmount,
                        contractFrequency: matchingStaff.contractFrequency,
                        contractStartDate: matchingStaff.contractStartDate,
                        contractEndDate: matchingStaff.contractEndDate
                    });
                } else {
                    merged.push({
                        id: `member-${m.user_id}`,
                        name: m.display_name || m.email || "Registered User",
                        role: m.role === "manager" ? "Manager" : (m.role ? m.role.charAt(0).toUpperCase() + m.role.slice(1) : "Staff"),
                        email: m.email,
                        phone: "",
                        notes: "Registered Account",
                        isContracted: false,
                        contractAmount: 0,
                        contractFrequency: "Monthly"
                    });
                }
                
                if (memberEmail) processedEmails.add(memberEmail);
                if (memberName) processedNames.add(memberName);
            });

            // 2. Add remaining manual staff members who did not match any registered member
            formattedStaff.forEach((s: any) => {
                if (processedStaffIds.has(s.id)) return;
                
                const staffEmail = s.email?.toLowerCase().trim();
                const staffName = s.name?.toLowerCase().trim();
                
                if ((staffEmail && processedEmails.has(staffEmail)) || (staffName && processedNames.has(staffName))) {
                    return; // duplicate check
                }

                merged.push(s);
            });

            setStaff(merged);
        } catch (e: any) {
            console.error("Error fetching staff:", e.message || e);
        }
    }

    const handleSave = async () => {
        if (!formData.name || !formData.role) return;

        const isNew = !editingId;
        
        try {
            if (isNew) {
                // Check if this new staff member matches an existing club_member by email/name
                const { data: members } = await supabase.from("club_members").select("*");
                const emailMatch = formData.email ? members?.find(m => m.email?.toLowerCase().trim() === formData.email?.toLowerCase().trim()) : null;
                const nameMatch = members?.find(m => m.display_name?.toLowerCase().trim() === formData.name?.toLowerCase().trim());
                const matchingMember = emailMatch || nameMatch;

                if (matchingMember) {
                    // Update the existing member's role and name in club_members
                    const roleToSave = formData.role.toLowerCase() === "manager" ? "manager" : formData.role.toLowerCase();
                    await supabase.from("club_members").update({
                        display_name: formData.name,
                        role: roleToSave
                    }).eq("user_id", matchingMember.user_id);

                    // Insert or update staff details in staff table using the email
                    const staffPayload = {
                        name: formData.name,
                        role: formData.role,
                        email: formData.email || matchingMember.email,
                        phone: formData.phone,
                        notes: formData.notes,
                        is_contracted: formData.isContracted,
                        contract_amount: formData.contractAmount,
                        contract_frequency: formData.contractFrequency,
                        contract_start_date: formData.contractStartDate ? formData.contractStartDate : null,
                        contract_end_date: formData.contractEndDate ? formData.contractEndDate : null
                    };

                    const { data: existingStaff } = await supabase.from("staff").select("id").eq("email", formData.email || matchingMember.email);
                    if (existingStaff && existingStaff.length > 0) {
                        await supabase.from("staff").update(staffPayload).eq("id", existingStaff[0].id);
                    } else {
                        await supabase.from("staff").insert([staffPayload]);
                    }
                } else {
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
                    const { error } = await supabase.from("staff").insert([payload]);
                    if (error) throw error;
                }
            } else {
                if (editingId.startsWith("member-")) {
                    const userId = editingId.replace("member-", "");
                    const roleToSave = formData.role.toLowerCase() === "manager" ? "manager" : formData.role.toLowerCase();
                    
                    // Update club_members table
                    await supabase.from("club_members").update({
                        display_name: formData.name,
                        role: roleToSave
                    }).eq("user_id", userId);

                    // Update or insert staff details table
                    const staffPayload = {
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

                    const { data: existingStaffByEmail } = formData.email 
                        ? await supabase.from("staff").select("id").eq("email", formData.email) 
                        : { data: null };
                    
                    const { data: existingStaffByName } = await supabase.from("staff").select("id").eq("name", formData.name);
                    
                    const existingStaff = (existingStaffByEmail && existingStaffByEmail.length > 0) 
                        ? existingStaffByEmail 
                        : existingStaffByName;

                    if (existingStaff && existingStaff.length > 0) {
                        await supabase.from("staff").update(staffPayload).eq("id", existingStaff[0].id);
                    } else {
                        await supabase.from("staff").insert([staffPayload]);
                    }
                } else {
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
                    const { error } = await supabase.from("staff").update(payload).eq("id", editingId);
                    if (error) throw error;
                }
            }
            await fetchStaff();
            setIsAddOpen(false);
            setEditingId(null);
            setFormData({ name: "", role: "Coach", email: "", phone: "", notes: "", isContracted: false, contractAmount: 0, contractFrequency: "Monthly" });
        } catch (e: any) {
            console.error("Supabase save failed:", e.message);
            alert("Failed to save staff member.");
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
            if (id.startsWith("member-")) {
                const userId = id.replace("member-", "");
                
                const { data: memberData } = await supabase.from("club_members").select("email, display_name").eq("user_id", userId).single();
                
                const { error: memberError } = await supabase.from("club_members").delete().eq("user_id", userId);
                if (memberError) throw memberError;

                if (memberData) {
                    if (memberData.email) {
                        await supabase.from("staff").delete().eq("email", memberData.email);
                    }
                    if (memberData.display_name) {
                        await supabase.from("staff").delete().eq("name", memberData.display_name);
                    }
                }
            } else {
                const { error } = await supabase.from("staff").delete().eq("id", id);
                if (error) throw error;
            }
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
