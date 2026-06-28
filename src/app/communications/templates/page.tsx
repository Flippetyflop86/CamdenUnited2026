"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Trash2, Edit3, Plus, FileText, Sparkles, RefreshCw, AlertCircle } from "lucide-react";
import { useAuth } from "@/context/auth-context";

export default function TemplatesPage() {
    const { clubId } = useAuth();

    const [templates, setTemplates] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Form states
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState<any | null>(null);
    const [name, setName] = useState("");
    const [subject, setSubject] = useState("");
    const [bodyContent, setBodyContent] = useState("");
    const [formError, setFormError] = useState("");
    const [isSaving, setIsSaving] = useState(false);

    const loadTemplates = async () => {
        if (!clubId) return;
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/communications/templates?clubId=${clubId}`);
            const data = await res.json();
            if (!res.ok || !data.success) {
                setError(data.error || "Failed to load templates.");
                return;
            }
            setTemplates(data.templates);
        } catch (err: any) {
            setError("Connection error. Could not retrieve templates.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (clubId) {
            loadTemplates();
        }
    }, [clubId]);

    const handleCreateNew = () => {
        setEditingTemplate(null);
        setName("");
        setSubject("");
        setBodyContent("");
        setFormError("");
        setIsFormOpen(true);
    };

    const handleEdit = (tmpl: any) => {
        setEditingTemplate(tmpl);
        setName(tmpl.name);
        setSubject(tmpl.subject);
        setBodyContent(tmpl.body_content);
        setFormError("");
        setIsFormOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this template?")) return;
        try {
            const res = await fetch(`/api/communications/templates?id=${id}`, { method: "DELETE" });
            const data = await res.json();
            if (res.ok && data.success) {
                setTemplates(prev => prev.filter(t => t.id !== id));
            } else {
                alert(data.error || "Failed to delete template");
            }
        } catch (err) {
            alert("Connection error deleting template");
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name || !subject || !bodyContent) {
            setFormError("All fields are required.");
            return;
        }

        setIsSaving(true);
        setFormError("");

        try {
            const res = await fetch("/api/communications/templates", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    id: editingTemplate?.id,
                    clubId,
                    name,
                    subject,
                    bodyContent
                })
            });

            const data = await res.json();
            if (!res.ok || !data.success) {
                setFormError(data.error || "Failed to save template.");
                return;
            }

            setIsFormOpen(false);
            loadTemplates();
        } catch (err) {
            setFormError("Connection error. Please try again.");
        } finally {
            setIsSaving(false);
        }
    };

    const seedDefaultTemplates = async () => {
        const defaults = [
            {
                name: "Training Cancelled",
                subject: "🚨 TRAINING CANCELLED - {{TrainingDate}}",
                bodyContent: "Hi {{FirstName}},\n\nPlease note that training scheduled for {{TrainingDate}} has been CANCELLED due to pitch waterlogging.\n\nWe apologize for the short notice. Enjoy your evening off and see you next week!\n\nCheers,\nClub Management"
            },
            {
                name: "Outstanding RSVP Reminder",
                subject: "⚠️ Availability Check-in: {{TrainingDate}}",
                bodyContent: "Hi {{FirstName}},\n\nYou haven't updated your availability for our next session yet!\n\n📅 Date: {{TrainingDate}}\n📍 Location: {{Location}}\n\nClick the link below to verify with code {{SessionCode}} and confirm your slot:\n🔗 {{RsvpLink}}\n\nThank you,\nClub Management"
            },
            {
                name: "Player Invite Link",
                subject: "⚽ Welcome to {{Location}}!",
                bodyContent: "Hi {{FirstName}},\n\nYou've been added to our squad list on ClubFlow!\n\nPlease register your email and secure your availability check-in link using the link below:\n\n🔗 {{JoinLink}}\n\nOnce registered, you can mark your attendance for matches and training sessions in seconds.\n\nBest regards,\nClub Management"
            }
        ];

        try {
            setLoading(true);
            for (const item of defaults) {
                await fetch("/api/communications/templates", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        clubId,
                        name: item.name,
                        subject: item.subject,
                        bodyContent: item.bodyContent
                    })
                });
            }
            await loadTemplates();
        } catch (err) {
            alert("Failed to seed default templates");
        } finally {
            setLoading(false);
        }
    };

    const insertMergeTag = (tag: string) => {
        setBodyContent(prev => prev + ` ${tag} `);
    };

    if (loading && templates.length === 0) {
        return (
            <div className="flex h-96 items-center justify-center">
                <RefreshCw className="h-8 w-8 text-red-500 animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">Email Templates</h1>
                    <p className="text-slate-500 text-sm">Save and reuse professional communications templates for your club.</p>
                </div>
                <div className="flex gap-2">
                    {templates.length === 0 && (
                        <Button variant="outline" onClick={seedDefaultTemplates} className="border-slate-200">
                            <Sparkles className="h-4 w-4 mr-2 text-red-500" />
                            Seed Default Templates
                        </Button>
                    )}
                    <Button onClick={handleCreateNew} className="bg-slate-900 hover:bg-slate-800 text-white font-semibold">
                        <Plus className="h-4 w-4 mr-2" />
                        Create Template
                    </Button>
                </div>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3 text-red-800 text-sm">
                    <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
                    <span>{error}</span>
                </div>
            )}

            {isFormOpen ? (
                <Card className="bg-white border-slate-200 shadow-sm max-w-2xl">
                    <CardHeader>
                        <CardTitle className="text-lg font-bold">
                            {editingTemplate ? "Edit Template" : "New Template"}
                        </CardTitle>
                        <CardDescription>
                            Configure email merge tags and template messaging context.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSave} className="space-y-4">
                            {formError && (
                                <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-800 text-xs">
                                    {formError}
                                </div>
                            )}

                            <div className="space-y-1">
                                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Template Name</label>
                                <Input 
                                    value={name} 
                                    onChange={e => setName(e.target.value)} 
                                    placeholder="e.g. Training Cancelled"
                                    required
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Email Subject Line</label>
                                <Input 
                                    value={subject} 
                                    onChange={e => setSubject(e.target.value)} 
                                    placeholder="e.g. 🚨 TRAINING CANCELLED - {{TrainingDate}}"
                                    required
                                />
                            </div>

                            <div className="space-y-1.5">
                                <div className="flex justify-between items-center">
                                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Message Body</label>
                                    <div className="flex flex-wrap gap-1">
                                        <Badge 
                                            variant="secondary" 
                                            className="cursor-pointer hover:bg-slate-200 text-[10px]"
                                            onClick={() => insertMergeTag("{{FirstName}}")}
                                        >
                                            + Player Name
                                        </Badge>
                                        <Badge 
                                            variant="secondary" 
                                            className="cursor-pointer hover:bg-slate-200 text-[10px]"
                                            onClick={() => insertMergeTag("{{TrainingDate}}")}
                                        >
                                            + Event Date
                                        </Badge>
                                        <Badge 
                                            variant="secondary" 
                                            className="cursor-pointer hover:bg-slate-200 text-[10px]"
                                            onClick={() => insertMergeTag("{{Location}}")}
                                        >
                                            + Location
                                        </Badge>
                                        <Badge 
                                            variant="secondary" 
                                            className="cursor-pointer hover:bg-slate-200 text-[10px]"
                                            onClick={() => insertMergeTag("{{RsvpLink}}")}
                                        >
                                            + RSVP Button
                                        </Badge>
                                    </div>
                                </div>
                                <Textarea 
                                    rows={8}
                                    value={bodyContent} 
                                    onChange={e => setBodyContent(e.target.value)} 
                                    placeholder="Write your email template message here. Use merge tags to personalize the content."
                                    className="font-sans leading-relaxed"
                                    required
                                />
                            </div>

                            <div className="flex justify-end gap-3 pt-2">
                                <Button 
                                    type="button" 
                                    variant="outline" 
                                    onClick={() => setIsFormOpen(false)}
                                    className="border-slate-200"
                                >
                                    Cancel
                                </Button>
                                <Button 
                                    type="submit" 
                                    disabled={isSaving}
                                    className="bg-slate-900 hover:bg-slate-800 text-white font-semibold"
                                >
                                    {isSaving ? "Saving..." : "Save Template"}
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {templates.map(tmpl => (
                        <Card key={tmpl.id} className="bg-white border-slate-200 shadow-sm relative group overflow-hidden">
                            <CardHeader className="pb-3">
                                <div className="flex justify-between items-start gap-4">
                                    <div className="flex items-center gap-2.5">
                                        <div className="h-9 w-9 rounded-lg bg-red-50 border border-red-100 flex items-center justify-center text-red-500">
                                            <FileText className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-slate-900 leading-none">{tmpl.name}</h3>
                                            <span className="text-[10px] text-slate-400 mt-1 block">Subject: {tmpl.subject}</span>
                                        </div>
                                    </div>
                                    <div className="flex gap-1.5">
                                        <button 
                                            onClick={() => handleEdit(tmpl)}
                                            className="p-1.5 hover:bg-slate-100 rounded text-slate-500 hover:text-slate-900 transition-colors"
                                            title="Edit template"
                                        >
                                            <Edit3 className="h-4 w-4" />
                                        </button>
                                        <button 
                                            onClick={() => handleDelete(tmpl.id)}
                                            className="p-1.5 hover:bg-red-50 rounded text-slate-400 hover:text-red-650 transition-colors"
                                            title="Delete template"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="pt-0 border-t border-slate-50 mt-1">
                                <p className="text-xs text-slate-500 line-clamp-3 leading-relaxed whitespace-pre-wrap pt-3 font-sans">
                                    {tmpl.body_content}
                                </p>
                            </CardContent>
                        </Card>
                    ))}

                    {templates.length === 0 && (
                        <div className="col-span-full border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center text-slate-400 space-y-3 bg-slate-50/50">
                            <FileText className="h-10 w-10 text-slate-300 mx-auto" />
                            <p className="text-sm font-semibold">No Templates Saved</p>
                            <p className="text-xs text-slate-550 max-w-sm mx-auto">Create reusable email templates to notify players about cancelled trainings, matchday rosters, and registration details in under 15 seconds.</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
