"use client";

import { useState, useEffect, useRef } from "react";
import { Recruit } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
    Search,
    Plus,
    Trash2,
    Edit2,
    MapPin,
    Building2,
    Calendar,
    Briefcase,
    AlertCircle,
    UserCheck,
    Check,
    Star,
    ChevronDown,
    ChevronRight,
    Trophy,
    FileDown,
    UserPlus,
    UserMinus,
    ArrowUpRight
} from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";

export default function RecruitmentPage() {
    const [recruits, setRecruits] = useState<Recruit[]>([]);
    const hasLoaded = useRef(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingRecruit, setEditingRecruit] = useState<Recruit | null>(null);
    const [expandedPositions, setExpandedPositions] = useState<string[]>(["GK", "DEF", "MID", "FWD"]);

    const roles = ["Star Player", "1st Team Player", "Rotation Player", "Midweek Player", "Has Potential"];

    // Form state
    const [formData, setFormData] = useState({
        name: "",
        primaryPosition: "MID",
        secondaryPosition: "",
        age: "",
        location: "",
        status: "Attached" as "Attached" | "Unattached",
        currentClub: "",
        onTrial: false,
        scoutedRole: "1st Team Player" as Recruit['scoutedRole'],
        notes: "",
        clubConnection: ""
    });




    // ... (keep state) ...

    // Load Data
    useEffect(() => {
        fetchRecruits();
        const channel = supabase.channel('public:recruits')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'recruits' }, fetchRecruits)
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, []);

    const fetchRecruits = async () => {
        const { data, error } = await supabase.from('recruits').select('*');
        if (data) {
            setRecruits(data.map((r: any) => ({
                id: r.id,
                name: r.name,
                primaryPosition: r.primary_position,
                secondaryPosition: r.secondary_position,
                age: r.age,
                location: r.location,
                status: r.status,
                currentClub: r.current_club,
                onTrial: r.on_trial,
                scoutedRole: r.scouted_role,
                notes: r.notes,
                clubConnection: r.club_connection,
                createdAt: r.created_at,
                updatedAt: r.updated_at
            })));
        }
    };

    const handleAddOrEdit = async () => {
        if (!formData.name) return;

        const payload = {
            name: formData.name,
            primary_position: formData.primaryPosition,
            secondary_position: formData.secondaryPosition,
            age: parseInt(formData.age) || 0,
            location: formData.location,
            status: formData.status,
            current_club: formData.currentClub,
            on_trial: formData.onTrial,
            scouted_role: formData.scoutedRole,
            notes: formData.notes,
            club_connection: formData.clubConnection,
            updated_at: new Date().toISOString()
        };

        try {
            if (editingRecruit) {
                await supabase.from('recruits').update(payload).eq('id', editingRecruit.id);
            } else {
                await supabase.from('recruits').insert([payload]);
            }
            handleCloseDialog();
        } catch (e: any) {
            alert("Error saving recruit: " + e.message);
        }
    };

    const handleEdit = (recruit: Recruit) => {
        setEditingRecruit(recruit);
        setFormData({
            name: recruit.name,
            primaryPosition: recruit.primaryPosition,
            secondaryPosition: recruit.secondaryPosition || "",
            age: recruit.age.toString(),
            location: recruit.location,
            status: recruit.status,
            currentClub: recruit.currentClub || "",
            onTrial: recruit.onTrial,
            scoutedRole: recruit.scoutedRole,
            notes: recruit.notes || "",
            clubConnection: recruit.clubConnection || ""
        });
        setIsDialogOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (window.confirm("Are you sure you want to delete this player from recruitment?")) {
            await supabase.from('recruits').delete().eq('id', id);
        }
    };

    const handleCloseDialog = () => {
        setIsDialogOpen(false);
        setEditingRecruit(null);
        setFormData({
            name: "",
            primaryPosition: "MID",
            secondaryPosition: "",
            age: "",
            location: "",
            status: "Attached",
            currentClub: "",
            onTrial: false,
            scoutedRole: "1st Team Player",
            notes: "",
            clubConnection: ""
        });
    };

    const handleSignPlayer = async (recruit: Recruit) => {
        if (!window.confirm(`Are you sure you want to sign ${recruit.name} to the First Team squad?`)) return;

        // 1. Split name
        const nameParts = recruit.name.trim().split(/\s+/);
        const firstName = nameParts[0] || "Unknown";
        const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : "";

        // 2. Insert into Players table
        const { error: insertError } = await supabase.from('players').insert([{
            first_name: firstName,
            last_name: lastName,
            position: recruit.primaryPosition,
            age: recruit.age,
            squad: "firstTeam",
            medical_status: "Available",
            availability: true,
            notes: `Signed from recruitment hub. ${recruit.notes || ''}`
        }]);

        if (insertError) {
            alert("Error signing player: " + insertError.message);
            return;
        }

        // 3. Delete from Recruits
        await supabase.from('recruits').delete().eq('id', recruit.id);

        alert(`${recruit.name} has been signed and moved to the Squad page!`);
    };

    const handleExportPDF = () => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        const content = `
            <html>
            <head>
                <title>Scouting Report - Camden United</title>
                <style>
                    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px; color: #1e293b; line-height: 1.5; }
                    .header { text-align: center; border-bottom: 3px solid #ef4444; padding-bottom: 20px; margin-bottom: 30px; }
                    .logo { font-size: 24px; font-weight: bold; color: #ef4444; text-transform: uppercase; letter-spacing: 2px; }
                    h1 { margin: 5px 0; font-size: 28px; }
                    .date { color: #64748b; font-size: 0.9em; margin-top: 5px; }
                    
                    .section { margin-bottom: 40px; page-break-inside: avoid; }
                    .section-title { font-size: 1.4em; font-weight: bold; background: #f1f5f9; padding: 10px 15px; border-left: 6px solid #ef4444; margin-bottom: 15px; color: #0f172a; }
                    
                    table { width: 100%; border-collapse: collapse; margin-bottom: 10px; table-layout: fixed; }
                    th { text-align: left; padding: 12px 10px; border-bottom: 2px solid #e2e8f0; font-size: 0.75em; color: #475569; text-transform: uppercase; letter-spacing: 1px; }
                    td { padding: 12px 10px; border-bottom: 1px solid #f1f5f9; font-size: 0.85em; vertical-align: top; word-wrap: break-word; }
                    
                    .player-name { font-weight: bold; color: #0f172a; font-size: 1em; }
                    .pos-badge { font-weight: bold; color: #ef4444; }
                    .sec-pos { color: #64748b; font-size: 0.8em; }
                    
                    .role-badge { display: inline-block; padding: 3px 8px; border-radius: 4px; font-size: 0.75em; font-weight: bold; white-space: nowrap; }
                    .star { background: #fef3c7; color: #92400e; border: 1px solid #fde68a; }
                    .team { background: #dcfce7; color: #166534; border: 1px solid #bbf7d0; }
                    
                    .connection { color: #dc2626; font-style: italic; font-size: 0.8em; margin-top: 4px; font-weight: 500; }
                    .notes { color: #475569; font-size: 0.8em; margin-top: 6px; background: #f8fafc; padding: 6px; border-radius: 4px; border: 1px solid #edf2f7; }
                    .status-tag { font-weight: 600; }
                    .unattached { color: #059669; }
                    
                    @media print {
                        body { padding: 20px; }
                        .section { page-break-inside: avoid; }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <div class="logo">Camden United Hub</div>
                    <h1>DETAILED SCOUTING REPORT</h1>
                    <div class="date">Generated on ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
                </div>

                ${sections.map(section => {
            const sectionRecruits = getRecruitsForSection(section.positions);
            if (sectionRecruits.length === 0) return '';

            return `
                        <div class="section">
                            <div class="section-title">${section.title.toUpperCase()}</div>
                            <table>
                                <thead>
                                    <tr>
                                        <th style="width: 25%;">Player Details</th>
                                        <th style="width: 10%;">Age</th>
                                        <th style="width: 15%;">Role / Rating</th>
                                        <th style="width: 15%;">Status/Club</th>
                                        <th style="width: 35%;">Scouting Notes & Connections</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${sectionRecruits.map(r => `
                                        <tr>
                                            <td>
                                                <div class="player-name">${r.scoutedRole === 'Star Player' ? '⭐ ' : ''}${r.name}</div>
                                                <div class="pos-badge">${r.primaryPosition}${r.secondaryPosition ? `<span class="sec-pos"> (${r.secondaryPosition})</span>` : ''}</div>
                                                <div style="font-size: 0.75em; color: #94a3b8;">${r.location}</div>
                                            </td>
                                            <td>${r.age}</td>
                                            <td><span class="role-badge ${r.scoutedRole === 'Star Player' ? 'star' : 'team'}">${r.scoutedRole}</span></td>
                                            <td>
                                                <div class="status-tag ${r.status === 'Unattached' ? 'unattached' : ''}">${r.status}</div>
                                                <div style="font-size: 0.8em; color: #64748b;">${r.status === 'Unattached' ? 'Free Agent' : (r.currentClub || 'Unknown')}</div>
                                            </td>
                                            <td>
                                                ${r.clubConnection ? `<div class="connection">🔗 Connection: ${r.clubConnection}</div>` : ''}
                                                <div class="notes">${r.notes || 'No specific notes recorded.'}</div>
                                            </td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    `;
        }).join('')}

                <div style="margin-top: 50px; text-align: center; color: #94a3b8; font-size: 0.8em; border-top: 1px solid #f1f5f9; padding-top: 20px;">
                    Confidential Report - Recruitment Department - Camden United FC
                </div>
            </body>
            </html>
        `;

        printWindow.document.write(content);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
            printWindow.print();
            printWindow.close();
        }, 500);
    };

    const togglePosition = (pos: string) => {
        setExpandedPositions(prev =>
            prev.includes(pos) ? prev.filter(p => p !== pos) : [...prev, pos]
        );
    };

    const filteredRecruits = recruits.filter(r =>
        r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.primaryPosition.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.currentClub?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Grouping logic
    const sections = [
        { id: "GK", title: "Goalkeepers", positions: ["GK"] },
        { id: "DEF", title: "Defenders", positions: ["DEF", "CB", "RB", "LB"] },
        { id: "MID", title: "Midfielders", positions: ["MID", "CDM", "CM", "CAM"] },
        { id: "FWD", title: "Forwards", positions: ["FWD", "RW", "LW", "CF", "ST"] },
    ];

    const getRecruitsForSection = (posList: string[]) => {
        return filteredRecruits.filter(r => posList.includes(r.primaryPosition.toUpperCase()));
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-slate-900">Recruitment Hub</h2>
                    <p className="text-slate-500">Track and group potential signings</p>
                </div>
                <div className="flex items-center gap-3">
                    <Button variant="outline" onClick={handleExportPDF} className="border-red-200 text-red-700 hover:bg-red-50">
                        <FileDown className="h-4 w-4 mr-2" />
                        Export Report
                    </Button>
                    <Dialog open={isDialogOpen} onOpenChange={(open) => !open && handleCloseDialog()}>
                        <DialogTrigger asChild>
                            <Button onClick={() => setIsDialogOpen(true)} className="bg-red-600 hover:bg-red-700">
                                <Plus className="h-4 w-4 mr-2" />
                                Add New Player
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[450px] max-h-[90vh] flex flex-col p-0 overflow-hidden">
                            <DialogHeader className="p-6 pb-2">
                                <DialogTitle>{editingRecruit ? "Edit Player" : "Add New Recruitment Target"}</DialogTitle>
                            </DialogHeader>
                            <div className="flex-1 overflow-y-auto p-6 pt-2">
                                <div className="grid gap-4 py-4">
                                    <div className="grid grid-cols-4 items-center gap-4">
                                        <Label htmlFor="name" className="text-right">Name</Label>
                                        <Input
                                            id="name"
                                            value={formData.name}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                            className="col-span-3"
                                        />
                                    </div>
                                    <div className="grid grid-cols-4 items-center gap-4">
                                        <Label htmlFor="primaryPos" className="text-right">Primary Position</Label>
                                        <select
                                            id="primaryPos"
                                            className="col-span-3 text-sm border rounded p-2"
                                            value={formData.primaryPosition}
                                            onChange={(e) => setFormData({ ...formData, primaryPosition: e.target.value })}
                                        >
                                            <option value="GK">GK</option>
                                            <option value="DEF">DEF</option>
                                            <option value="CB">CB</option>
                                            <option value="RB">RB</option>
                                            <option value="LB">LB</option>
                                            <option value="MID">MID</option>
                                            <option value="CDM">CDM</option>
                                            <option value="CM">CM</option>
                                            <option value="CAM">CAM</option>
                                            <option value="FWD">FWD</option>
                                            <option value="RW">RW</option>
                                            <option value="LW">LW</option>
                                            <option value="ST">ST</option>
                                        </select>
                                    </div>
                                    <div className="grid grid-cols-4 items-center gap-4">
                                        <Label htmlFor="secondaryPos" className="text-right">Secondary Position</Label>
                                        <Input
                                            id="secondaryPos"
                                            value={formData.secondaryPosition}
                                            onChange={(e) => setFormData({ ...formData, secondaryPosition: e.target.value })}
                                            className="col-span-3"
                                        />
                                    </div>
                                    <div className="grid grid-cols-4 items-center gap-4">
                                        <Label htmlFor="role" className="text-right">Potential Role</Label>
                                        <select
                                            id="role"
                                            className="col-span-3 text-sm border rounded p-2"
                                            value={formData.scoutedRole}
                                            onChange={(e) => setFormData({ ...formData, scoutedRole: e.target.value as Recruit['scoutedRole'] })}
                                        >
                                            {roles.map(role => (
                                                <option key={role} value={role}>
                                                    {role === "Star Player" ? "⭐ " : ""}{role}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="grid grid-cols-2 items-center gap-4">
                                            <Label htmlFor="age" className="text-right">Age</Label>
                                            <Input
                                                id="age"
                                                type="number"
                                                value={formData.age}
                                                onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 items-center gap-4">
                                            <Label htmlFor="location" className="text-right">Location</Label>
                                            <Input
                                                id="location"
                                                value={formData.location}
                                                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                    <div className="flex flex-col gap-4">
                                        <div className="flex items-center justify-between p-3 border rounded-lg bg-slate-50">
                                            <div className="space-y-0.5">
                                                <Label htmlFor="status-toggle">Player Status</Label>
                                                <div className="text-[10px] text-slate-500">Currently attached to a club or free agent</div>
                                            </div>
                                            <select
                                                className="text-sm border rounded p-1"
                                                value={formData.status}
                                                onChange={(e) => setFormData({ ...formData, status: e.target.value as "Attached" | "Unattached" })}
                                            >
                                                <option value="Attached">Attached</option>
                                                <option value="Unattached">Unattached</option>
                                            </select>
                                        </div>
                                        <div className="flex items-center justify-between p-3 border rounded-lg bg-slate-50">
                                            <div className="space-y-0.5">
                                                <Label htmlFor="trial-toggle">Trial Status</Label>
                                                <div className="text-[10px] text-slate-500">Is the player currently on trial with us?</div>
                                            </div>
                                            <input
                                                type="checkbox"
                                                id="trial-toggle"
                                                className="h-5 w-5 rounded border-slate-300 text-red-600 focus:ring-red-600"
                                                checked={formData.onTrial}
                                                onChange={(e) => setFormData({ ...formData, onTrial: e.target.checked })}
                                            />
                                        </div>
                                    </div>
                                    {formData.status === "Attached" && (
                                        <div className="grid grid-cols-4 items-center gap-4">
                                            <Label htmlFor="club" className="text-right">Current Club</Label>
                                            <Input
                                                id="club"
                                                value={formData.currentClub}
                                                onChange={(e) => setFormData({ ...formData, currentClub: e.target.value })}
                                                className="col-span-3"
                                            />
                                        </div>
                                    )}
                                    <div className="grid grid-cols-4 items-start gap-4">
                                        <Label htmlFor="connection" className="text-right pt-2 text-xs leading-tight">Connection to Club</Label>
                                        <Input
                                            id="connection"
                                            value={formData.clubConnection}
                                            onChange={(e) => setFormData({ ...formData, clubConnection: e.target.value })}
                                            className="col-span-3"
                                            placeholder="Family, former player, friend of..."
                                        />
                                    </div>
                                    <div className="grid grid-cols-4 items-start gap-4">
                                        <Label htmlFor="notes" className="text-right pt-2">Notes</Label>
                                        <Textarea
                                            id="notes"
                                            value={formData.notes}
                                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                            className="col-span-3 h-24"
                                            placeholder="Scouting report, contact details, strengths/weaknesses..."
                                        />
                                    </div>
                                </div>
                            </div>
                            <DialogFooter className="p-6 pt-2 border-t">
                                <Button type="button" variant="outline" onClick={handleCloseDialog}>Cancel</Button>
                                <Button type="button" onClick={handleAddOrEdit} className="bg-red-600 hover:bg-red-700">
                                    {editingRecruit ? "Save Changes" : "Save Player"}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            <Card>
                <CardHeader className="pb-3 text-red-600 border-b">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                            placeholder="Search by name, position, location, or club..."
                            className="pl-10"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="divide-y">
                        {sections.map((section) => {
                            const sectionRecruits = getRecruitsForSection(section.positions);
                            const isExpanded = expandedPositions.includes(section.id);

                            return (
                                <div key={section.id} className="w-full">
                                    <button
                                        onClick={() => togglePosition(section.id)}
                                        className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors"
                                    >
                                        <div className="flex items-center gap-3">
                                            {isExpanded ? <ChevronDown className="h-5 w-5 text-slate-400" /> : <ChevronRight className="h-5 w-5 text-slate-400" />}
                                            <h3 className="font-bold text-slate-900">{section.title}</h3>
                                            <Badge variant="outline" className="ml-2 bg-slate-100">{sectionRecruits.length}</Badge>
                                        </div>
                                    </button>

                                    {isExpanded && (
                                        <div className="p-4 bg-slate-50/30">
                                            {sectionRecruits.length === 0 ? (
                                                <div className="py-8 text-center text-slate-400 text-sm">
                                                    No {section.title.toLowerCase()} tracked yet.
                                                </div>
                                            ) : (
                                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                                    {sectionRecruits.map((recruit) => (
                                                        <Card key={recruit.id} className="relative group overflow-hidden bg-white border-slate-200 hover:border-red-200 hover:shadow-md transition-all">
                                                            <CardHeader className="pb-2">
                                                                <div className="flex justify-between items-start">
                                                                    <div>
                                                                        <div className="flex items-center gap-2">
                                                                            <CardTitle className="inline-flex items-center gap-1.5 text-lg font-bold">
                                                                                {recruit.scoutedRole === "Star Player" && <Star className="h-4 w-4 fill-amber-400 text-amber-400" />}
                                                                                {recruit.name}
                                                                            </CardTitle>
                                                                            {recruit.onTrial && (
                                                                                <Badge variant="secondary" className="bg-amber-100 text-amber-700 hover:bg-amber-100 flex gap-1 items-center scale-90">
                                                                                    <UserCheck className="h-3 w-3" />
                                                                                    Trialist
                                                                                </Badge>
                                                                            )}
                                                                        </div>
                                                                        <div className="flex items-center gap-2 mt-1">
                                                                            <span className="text-red-600 font-bold text-sm">{recruit.primaryPosition}</span>
                                                                            <Badge variant="outline" className="text-[10px] py-0 px-1.5 bg-slate-50 flex items-center gap-1">
                                                                                <Trophy className="h-2.5 w-2.5" />
                                                                                {recruit.scoutedRole}
                                                                            </Badge>
                                                                        </div>
                                                                    </div>
                                                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                        <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400 hover:text-blue-600" onClick={() => handleEdit(recruit)}>
                                                                            <Edit2 className="h-4 w-4" />
                                                                        </Button>
                                                                        <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400 hover:text-red-600" onClick={() => handleDelete(recruit.id)}>
                                                                            <Trash2 className="h-4 w-4" />
                                                                        </Button>
                                                                    </div>
                                                                </div>
                                                            </CardHeader>
                                                            <CardContent className="space-y-4">
                                                                <div className="grid grid-cols-2 gap-y-2 text-sm">
                                                                    <div className="flex items-center text-slate-500">
                                                                        <Calendar className="h-4 w-4 mr-2" />
                                                                        <span>{recruit.age}y</span>
                                                                    </div>
                                                                    <div className="flex items-center text-slate-500">
                                                                        <MapPin className="h-4 w-4 mr-2" />
                                                                        <span className="truncate">{recruit.location}</span>
                                                                    </div>
                                                                    <div className="flex items-center text-slate-500 col-span-2 overflow-hidden">
                                                                        <Building2 className="h-4 w-4 mr-2 shrink-0" />
                                                                        {recruit.status === "Unattached" ? (
                                                                            <span className="text-emerald-600 font-medium flex items-center">
                                                                                Free Agent
                                                                            </span>
                                                                        ) : (
                                                                            <span className="truncate">At: <span className="text-slate-900 font-medium">{recruit.currentClub}</span></span>
                                                                        )}
                                                                    </div>
                                                                </div>

                                                                {recruit.notes && (
                                                                    <div className="bg-slate-50 p-3 rounded-lg text-[11px] text-slate-600 border border-slate-100">
                                                                        <p className="whitespace-pre-wrap line-clamp-2">{recruit.notes}</p>
                                                                    </div>
                                                                )}

                                                                {recruit.clubConnection && (
                                                                    <div className="mt-2 text-[10px] text-red-600 font-medium flex items-center bg-red-50 p-1.5 rounded border border-red-100 italic">
                                                                        <UserPlus className="h-3 w-3 mr-1.5" />
                                                                        Connection: {recruit.clubConnection}
                                                                    </div>
                                                                )}

                                                                <Button
                                                                    onClick={() => handleSignPlayer(recruit)}
                                                                    className="w-full mt-2 bg-slate-900 hover:bg-red-600 text-[11px] h-8 group-hover:shadow-lg transition-all"
                                                                >
                                                                    <ArrowUpRight className="h-3.5 w-3.5 mr-1.5" />
                                                                    Sign to First Team
                                                                </Button>
                                                            </CardContent>
                                                            <div className={`h-1 w-full absolute bottom-0 ${recruit.scoutedRole === 'Star Player' ? 'bg-amber-400' : 'bg-slate-200'}`} />
                                                        </Card>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
