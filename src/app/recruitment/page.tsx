"use client";

import { useState, useEffect, useRef } from "react";
import { Recruit } from "@/types";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
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
    const [enlargedRecruit, setEnlargedRecruit] = useState<Recruit | null>(null);

    const getPositionBorder = (pos: string) => {
        const p = pos.toUpperCase();
        if (p === "GK") return "border-amber-500";
        if (["DEF", "CB", "RB", "LB"].includes(p)) return "border-sky-500";
        if (["MID", "CM", "CDM", "CAM", "RM", "LM"].includes(p)) return "border-emerald-500";
        return "border-rose-500"; // FWD, RW, LW, CF, ST
    };

    const roles = ["Star Player", "1st Team Player", "Rotation Player", "Back-up", "Prospect"];

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

        if (editingRecruit) {
            const { error } = await supabase.from('recruits').update(payload).eq('id', editingRecruit.id);
            if (error) {
                alert("Error updating recruit: " + error.message);
                return;
            }
        } else {
            const { error } = await supabase.from('recruits').insert([payload]);
            if (error) {
                alert("Error inserting recruit: " + error.message);
                return;
            }
        }
        
        await fetchRecruits();
        handleCloseDialog();
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
            const { error } = await supabase.from('recruits').delete().eq('id', id);
            if (error) {
                alert("Error deleting recruit: " + error.message);
                return;
            }
            await fetchRecruits();
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
                            <div className="overflow-x-auto w-full pb-2"><table>
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
                            </table></div>
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
                                            <option value="CF">CF</option>
                                            <option value="ST">ST</option>
                                        </select>
                                    </div>
                                    <div className="grid grid-cols-4 items-center gap-4">
                                        <Label htmlFor="secondaryPos" className="text-right">Secondary Position (s)</Label>
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
                                        <Label htmlFor="connection" className="text-right pt-2 text-xs leading-tight">Connection to club?</Label>
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
                                                <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-8">
                                                    {sectionRecruits.map((recruit) => (
                                                        <Card key={recruit.id} className={`overflow-hidden hover:shadow-lg transition-all duration-200 group relative border-2 bg-slate-950 ${getPositionBorder(recruit.primaryPosition)} flex flex-col h-full`}>
                                                            <CardHeader className="p-0 flex-1 flex flex-col">
                                                                <div className="bg-slate-900 p-3 sm:p-4 flex flex-col items-center justify-center flex-1 relative border-b border-slate-800">
                                                                    {/* Action Buttons overlay */}
                                                                    <div className="absolute top-2 left-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                                                                        <button
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                handleEdit(recruit);
                                                                            }}
                                                                            className="p-1.5 bg-slate-800 hover:bg-blue-900/50 rounded-full text-slate-400 hover:text-blue-500"
                                                                            title="Edit Recruit"
                                                                        >
                                                                            <Edit2 className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                                                                        </button>
                                                                        <button
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                handleDelete(recruit.id);
                                                                            }}
                                                                            className="p-1.5 bg-slate-800 hover:bg-red-900/50 rounded-full text-slate-400 hover:text-red-500"
                                                                            title="Delete Recruit"
                                                                        >
                                                                            <Trash2 className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                                                                        </button>
                                                                    </div>
                                                                    
                                                                    {/* Badges in Top Right */}
                                                                    <div className="absolute top-2 right-2 flex flex-col items-end gap-1 z-20">
                                                                        {recruit.onTrial && (
                                                                            <Badge variant="secondary" className="bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[9px] sm:text-[10px] px-1.5 py-0.5">
                                                                                Trialist
                                                                            </Badge>
                                                                        )}
                                                                        <Badge className={`text-[9px] sm:text-[10px] px-1.5 py-0.5 border ${
                                                                            recruit.status === 'Unattached' 
                                                                                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' 
                                                                                : 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30'
                                                                        }`}>
                                                                            {recruit.status === 'Unattached' ? 'Free Agent' : 'Contracted'}
                                                                        </Badge>
                                                                    </div>

                                                                    {/* Avatar Fallback Circle */}
                                                                    <div 
                                                                        onClick={() => setEnlargedRecruit(recruit)}
                                                                        className="cursor-pointer h-14 w-14 sm:h-20 sm:w-20 rounded-full bg-slate-800 flex items-center justify-center border-2 border-slate-700 shadow-xl mt-6 sm:mt-2 hover:border-red-500 transition-colors"
                                                                    >
                                                                        <span className="text-base sm:text-2xl font-bold bg-gradient-to-br from-red-400 to-red-650 bg-clip-text text-transparent">
                                                                            {recruit.name.split(/\s+/).map(n => n[0]).join("").toUpperCase().slice(0, 2)}
                                                                        </span>
                                                                    </div>

                                                                    {/* Title / Subtitle */}
                                                                    <div className="mt-3 text-center w-full px-1">
                                                                        <CardTitle 
                                                                            onClick={() => setEnlargedRecruit(recruit)}
                                                                            className="text-white text-xs sm:text-base font-bold truncate hover:text-red-400 cursor-pointer transition-colors"
                                                                        >
                                                                            {recruit.name}
                                                                        </CardTitle>
                                                                        <p className="text-slate-400 text-[9px] sm:text-xs font-medium mt-0.5">
                                                                            {recruit.primaryPosition} {recruit.secondaryPosition ? `(${recruit.secondaryPosition})` : ''} • {recruit.age} yo
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                            </CardHeader>
                                                            
                                                            <CardContent className="p-2 sm:p-3 space-y-2 text-center text-xs flex-none">
                                                                <div className="grid grid-cols-2 gap-1.5 text-[9px] sm:text-xs">
                                                                    <div className="bg-slate-900/60 p-1 sm:p-1.5 rounded border border-slate-800/40">
                                                                        <div className="text-slate-500 text-[8px] sm:text-[9px] uppercase tracking-wider">Role</div>
                                                                        <div className="font-bold text-white truncate">{recruit.scoutedRole}</div>
                                                                    </div>
                                                                    <div className="bg-slate-900/60 p-1 sm:p-1.5 rounded border border-slate-800/40">
                                                                        <div className="text-slate-500 text-[8px] sm:text-[9px] uppercase tracking-wider">Club</div>
                                                                        <div className="font-bold text-white truncate">{recruit.status === 'Unattached' ? 'None' : (recruit.currentClub || 'Unknown')}</div>
                                                                    </div>
                                                                </div>
                                                                
                                                                {recruit.clubConnection && (
                                                                    <div className="text-[8px] sm:text-[9px] text-red-400 bg-red-950/20 border border-red-900/30 p-1 rounded text-left truncate flex items-center justify-center gap-1 italic">
                                                                        <span>🔗 {recruit.clubConnection}</span>
                                                                    </div>
                                                                )}
                                                            </CardContent>

                                                            <CardFooter className="p-1.5 sm:p-3 pt-0 sm:pt-0 mt-auto flex flex-col gap-1 sm:gap-1.5 shrink-0">
                                                                <Button 
                                                                    variant="outline" 
                                                                    onClick={() => setEnlargedRecruit(recruit)}
                                                                    className="w-full h-7 sm:h-8 text-[9px] sm:text-xs bg-slate-900 hover:bg-slate-800 text-white border-slate-800 hover:border-slate-700"
                                                                >
                                                                    Enlarge Card
                                                                </Button>
                                                                <Button
                                                                    onClick={() => handleSignPlayer(recruit)}
                                                                    className="w-full bg-red-600 hover:bg-red-700 text-[9px] sm:text-xs h-7 sm:h-8 font-bold"
                                                                >
                                                                    Sign Player
                                                                </Button>
                                                            </CardFooter>
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

            {/* Enlarged Card Dialog */}
            <Dialog open={enlargedRecruit !== null} onOpenChange={(open) => !open && setEnlargedRecruit(null)}>
                {enlargedRecruit && (
                    <DialogContent className="sm:max-w-[440px] max-h-[90vh] flex flex-col bg-slate-950 text-white border-2 border-red-600 p-0 overflow-hidden shadow-2xl">
                        <DialogHeader className="p-4 bg-slate-900 border-b border-slate-800 flex flex-row items-center justify-between shrink-0">
                            <DialogTitle className="text-white font-bold flex items-center gap-2 text-lg">
                                {enlargedRecruit.scoutedRole === "Star Player" && <Star className="h-5 w-5 fill-amber-400 text-amber-400" />}
                                Scouting Card: {enlargedRecruit.name}
                            </DialogTitle>
                        </DialogHeader>
                        
                        <div className="p-5 space-y-5 flex-1 overflow-y-auto">
                            {/* Card Display Container */}
                            <div className={`relative p-5 rounded-xl bg-slate-900 border-2 ${getPositionBorder(enlargedRecruit.primaryPosition)} shadow-lg flex flex-col items-center text-center space-y-4`}>
                                {/* Badges */}
                                <div className="absolute top-4 right-4 flex flex-col items-end gap-1.5">
                                    {enlargedRecruit.onTrial && (
                                        <Badge className="bg-amber-500/20 text-amber-400 border border-amber-500/40 text-xs py-0.5 px-2">
                                            Trialist
                                        </Badge>
                                    )}
                                    <Badge className={`text-xs py-0.5 px-2 border ${
                                        enlargedRecruit.status === 'Unattached'
                                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                                            : 'bg-indigo-500/20 text-indigo-400 border-indigo-500/40'
                                    }`}>
                                        {enlargedRecruit.status === 'Unattached' ? 'Free Agent' : 'Contracted'}
                                    </Badge>
                                </div>
                                
                                {/* Big Initials Avatar */}
                                <div className="h-20 w-20 rounded-full bg-slate-800 border-4 border-slate-700 shadow-2xl flex items-center justify-center">
                                    <span className="text-2xl font-extrabold bg-gradient-to-br from-red-400 to-red-650 bg-clip-text text-transparent">
                                        {enlargedRecruit.name.split(/\s+/).map(n => n[0]).join("").toUpperCase().slice(0, 2)}
                                    </span>
                                </div>
                                
                                {/* Name and Squad details */}
                                <div>
                                    <h3 className="text-xl font-extrabold tracking-tight text-white">{enlargedRecruit.name}</h3>
                                    <p className="text-red-400 font-bold text-sm mt-1">
                                        {enlargedRecruit.primaryPosition} {enlargedRecruit.secondaryPosition ? `(Secondary: ${enlargedRecruit.secondaryPosition})` : ''}
                                    </p>
                                    <p className="text-slate-400 text-xs mt-0.5">{enlargedRecruit.age} years old • Located in {enlargedRecruit.location || 'Unknown'}</p>
                                </div>

                                {/* Divider */}
                                <div className="w-full border-t border-slate-800 my-1" />

                                {/* Detailed Grid */}
                                <div className="w-full grid grid-cols-2 gap-3 text-left text-xs">
                                    <div className="bg-slate-950/80 p-2.5 rounded-lg border border-slate-800">
                                        <span className="text-slate-500 text-[10px] block">Scouted Role</span>
                                        <span className="text-white font-bold text-sm block mt-0.5">{enlargedRecruit.scoutedRole}</span>
                                    </div>
                                    <div className="bg-slate-950/80 p-2.5 rounded-lg border border-slate-800">
                                        <span className="text-slate-500 text-[10px] block">Current Club</span>
                                        <span className="text-white font-bold text-sm block mt-0.5 truncate">
                                            {enlargedRecruit.status === 'Unattached' ? 'Free Agent' : (enlargedRecruit.currentClub || 'Unknown')}
                                        </span>
                                    </div>
                                </div>
                                
                                {/* Club Connection */}
                                {enlargedRecruit.clubConnection && (
                                    <div className="w-full bg-red-950/20 border border-red-900/40 p-2.5 rounded-lg text-left text-xs italic text-red-300 flex items-start gap-2">
                                        <span className="text-sm shrink-0">🔗</span>
                                        <div>
                                            <span className="font-bold text-[9px] uppercase block tracking-wider not-italic text-red-400">Club Connection</span>
                                            {enlargedRecruit.clubConnection}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Scouting Notes Block */}
                            {enlargedRecruit.notes && (
                                <div className="space-y-1.5">
                                    <span className="text-slate-400 font-semibold text-[10px] uppercase tracking-wider block">Scouting Report & Notes</span>
                                    <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 text-slate-300 text-xs whitespace-pre-wrap max-h-[120px] overflow-y-auto">
                                        {enlargedRecruit.notes}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Footer Controls */}
                        <DialogFooter className="p-3 bg-slate-900 border-t border-slate-800 flex gap-2 shrink-0">
                            <Button 
                                variant="outline" 
                                onClick={() => {
                                    const r = enlargedRecruit;
                                    setEnlargedRecruit(null);
                                    handleEdit(r);
                                }}
                                className="bg-slate-800 hover:bg-slate-700 border-slate-700 text-white h-9 text-xs"
                            >
                                <Edit2 className="h-3.5 w-3.5 mr-2" />
                                Edit Details
                            </Button>
                            <Button
                                onClick={() => {
                                    const r = enlargedRecruit;
                                    setEnlargedRecruit(null);
                                    handleSignPlayer(r);
                                }}
                                className="bg-red-600 hover:bg-red-700 text-white font-bold h-9 text-xs"
                            >
                                <ArrowUpRight className="h-3.5 w-3.5 mr-2" />
                                Sign Player
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                )}
            </Dialog>
        </div>
    );
}
