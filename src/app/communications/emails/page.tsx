"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Mail, Send, Eye, FileText, RefreshCw, AlertCircle, FileWarning, HelpCircle } from "lucide-react";
import { useAuth } from "@/context/auth-context";

export default function ComposeEmailsPage() {
    const { clubId } = useAuth();

    // Data lists
    const [templates, setTemplates] = useState<any[]>([]);
    const [events, setEvents] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [needsSetup, setNeedsSetup] = useState(false);

    // Form inputs
    const [recipientGroup, setRecipientGroup] = useState("Entire Club");
    const [subject, setSubject] = useState("");
    const [message, setMessage] = useState("");
    const [selectedTemplateId, setSelectedTemplateId] = useState("");
    const [selectedEventId, setSelectedEventId] = useState("");
    const [selectedEventType, setSelectedEventType] = useState("training");

    // Modal / Submitting states
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [formError, setFormError] = useState<string | null>(null);

    const loadPageData = async () => {
        if (!clubId) return;
        setLoading(true);
        setError(null);
        setNeedsSetup(false);
        try {
            // 1. Fetch templates
            const tmplRes = await fetch(`/api/communications/templates?clubId=${clubId}`);
            const tmplData = await tmplRes.json();
            
            // Catch lack of tables
            if (tmplData.error && (tmplData.error.includes("does not exist") || tmplData.needsSetup)) {
                setNeedsSetup(true);
                return;
            }

            if (tmplRes.ok && tmplData.success) {
                setTemplates(tmplData.templates || []);
            }

            // To keep things simple and avoid extra endpoint calls, we can fetch training sessions & matches list directly using client supabase:
            // Let's mock a simple list of recent events or get them from our context settings if needed
            // Actually, we can fetch live training sessions directly using client supabase:
            // Since this page runs in the manager dashboard (where user is logged in), they have read privileges!
            // That means we can query Supabase directly for training sessions and matches!
            const { createClient } = await import("@supabase/supabase-js");
            const supabase = createClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
            );

            const [tRes, mRes] = await Promise.all([
                supabase.from("training_sessions").select("id, date, topic, location").order("date", { ascending: false }).limit(10),
                supabase.from("matches").select("id, date, opponent").order("date", { ascending: false }).limit(10)
            ]);

            const list: any[] = [];
            (tRes.data || []).forEach(t => {
                list.push({ id: t.id, type: "training", label: `Training: ${t.topic || "Squad Practice"} (${t.date})` });
            });
            (mRes.data || []).forEach(m => {
                list.push({ id: m.id, type: "match", label: `Match vs ${m.opponent} (${m.date})` });
            });

            setEvents(list);
            if (list.length > 0) {
                setSelectedEventId(list[0].id);
                setSelectedEventType(list[0].type);
            }

        } catch (err: any) {
            console.error("Load compose page data error:", err);
            // Don't crash if event fetch fails, templates are more important
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (clubId) {
            loadPageData();
        }
    }, [clubId]);

    const handleTemplateChange = (id: string) => {
        setSelectedTemplateId(id);
        if (!id) return;
        const selected = templates.find(t => t.id === id);
        if (selected) {
            setSubject(selected.subject);
            setMessage(selected.body_content);
        }
    };

    const handleEventChange = (value: string) => {
        setSelectedEventId(value);
        const selected = events.find(e => e.id === value);
        if (selected) {
            setSelectedEventType(selected.type);
        }
    };

    const insertMergeTag = (tag: string) => {
        setMessage(prev => prev + ` ${tag} `);
    };

    const handleSendEmail = async () => {
        if (!subject || !message) {
            setFormError("Subject and Message body are required.");
            return;
        }

        setIsSending(true);
        setFormError(null);
        setSuccessMessage(null);

        try {
            const res = await fetch("/api/communications/email", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    clubId,
                    recipientGroup,
                    subject,
                    message,
                    eventId: selectedEventId || undefined,
                    eventType: selectedEventType || undefined
                })
            });

            const data = await res.json();
            if (!res.ok || !data.success) {
                setFormError(data.error || "Failed to send communications email.");
                return;
            }

            setSuccessMessage(data.message || "Emails sent successfully!");
            // Clear inputs
            setSubject("");
            setMessage("");
            setSelectedTemplateId("");
            setIsPreviewOpen(false);
        } catch (err) {
            setFormError("Connection error sending email.");
        } finally {
            setIsSending(false);
        }
    };

    if (loading && !needsSetup) {
        return (
            <div className="flex h-96 items-center justify-center">
                <RefreshCw className="h-8 w-8 text-red-500 animate-spin" />
            </div>
        );
    }

    if (needsSetup) {
        return (
            <div className="max-w-xl mx-auto space-y-6 pt-12">
                <Card className="border-red-200 bg-red-50/50 shadow-md">
                    <CardHeader className="text-center pb-4">
                        <FileWarning className="h-12 w-12 text-red-650 mx-auto mb-3" />
                        <CardTitle className="text-red-900 font-bold text-xl">Database Setup Required</CardTitle>
                        <CardDescription className="text-red-700">
                            The communications email tables need to be created in your Supabase database before you can proceed.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4 text-sm text-slate-700 leading-relaxed pt-0">
                        <p>
                            We have generated the database schema setup script for you in your local project workspace.
                        </p>
                        <div className="bg-slate-900 text-slate-100 rounded-xl p-4 font-mono text-xs overflow-x-auto select-all">
                            c:\Users\leon_\OneDrive\Desktop\camdenuniteddatahub\src\lib\create_emails.sql
                        </div>
                        <h4 className="font-bold text-slate-900 mt-4">Instructions:</h4>
                        <ol className="list-decimal list-inside space-y-1.5 text-slate-650">
                            <li>Open your **Supabase Dashboard** &rarr; **SQL Editor**.</li>
                            <li>Create a new query and paste the contents of `src/lib/create_emails.sql`.</li>
                            <li>Click **Run** to execute the table creations.</li>
                            <li>Once run, refresh this page!</li>
                        </ol>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-4xl">
            <div>
                <h1 className="text-3xl font-black text-slate-900 tracking-tight">Compose Communication</h1>
                <p className="text-slate-500 text-sm">Send professional announcements and automatic updates to players and staff.</p>
            </div>

            {successMessage && (
                <div className="bg-emerald-50 border border-emerald-250 rounded-xl p-4 flex items-center gap-3 text-emerald-800 text-sm">
                    <Mail className="h-5 w-5 text-emerald-600 shrink-0 animate-bounce" />
                    <span className="font-semibold">{successMessage}</span>
                </div>
            )}

            {formError && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3 text-red-800 text-sm">
                    <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
                    <span>{formError}</span>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Form parameters */}
                <Card className="lg:col-span-2 bg-white border-slate-200 shadow-sm">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base font-bold text-slate-900">Compose Email Message</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {/* Recipient Group Selector */}
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Recipients Group</label>
                            <select
                                value={recipientGroup}
                                onChange={e => setRecipientGroup(e.target.value)}
                                className="w-full h-10 px-3 bg-white border border-slate-200 rounded-md text-sm font-medium focus:outline-none focus:ring-2 focus:ring-red-500"
                            >
                                <option value="Entire Club">Entire Club</option>
                                <option value="First Team">First Team</option>
                                <option value="Reserves">Reserves</option>
                                <option value="Pending Invitations">Pending Invitations</option>
                                <option value="Registered Players">Registered Players</option>
                                <option value="Managers">Managers</option>
                            </select>
                        </div>

                        {/* Subject */}
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Subject Line</label>
                            <Input 
                                value={subject}
                                onChange={e => setSubject(e.target.value)}
                                placeholder="Enter email subject line..."
                                className="border-slate-200"
                                required
                            />
                        </div>

                        {/* Message body */}
                        <div className="space-y-1.5">
                            <div className="flex justify-between items-center">
                                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Message Body</label>
                                <div className="flex flex-wrap gap-1">
                                    <Badge 
                                        variant="secondary" 
                                        className="cursor-pointer hover:bg-slate-200 text-[9px]"
                                        onClick={() => insertMergeTag("{{FirstName}}")}
                                    >
                                        + Name
                                    </Badge>
                                    <Badge 
                                        variant="secondary" 
                                        className="cursor-pointer hover:bg-slate-200 text-[9px]"
                                        onClick={() => insertMergeTag("{{TrainingDate}}")}
                                    >
                                        + Date
                                    </Badge>
                                    <Badge 
                                        variant="secondary" 
                                        className="cursor-pointer hover:bg-slate-200 text-[9px]"
                                        onClick={() => insertMergeTag("{{Location}}")}
                                    >
                                        + Location
                                    </Badge>
                                    <Badge 
                                        variant="secondary" 
                                        className="cursor-pointer hover:bg-slate-200 text-[9px]"
                                        onClick={() => insertMergeTag("{{RsvpLink}}")}
                                    >
                                        + RSVP Link
                                    </Badge>
                                    <Badge 
                                        variant="secondary" 
                                        className="cursor-pointer hover:bg-slate-200 text-[9px]"
                                        onClick={() => insertMergeTag("{{SessionCode}}")}
                                    >
                                        + Code
                                    </Badge>
                                </div>
                            </div>
                            <Textarea 
                                rows={10}
                                value={message}
                                onChange={e => setMessage(e.target.value)}
                                placeholder="Type your email body. Use merge tags for personalized text templates."
                                className="border-slate-200 font-sans leading-relaxed"
                                required
                            />
                        </div>

                        {/* Actions */}
                        <div className="flex justify-end gap-3 pt-2">
                            <Button 
                                type="button" 
                                variant="outline" 
                                onClick={() => setIsPreviewOpen(true)}
                                disabled={!subject || !message}
                                className="border-slate-200"
                            >
                                <Eye className="h-4 w-4 mr-2" />
                                Preview Message
                            </Button>
                            <Button 
                                onClick={handleSendEmail} 
                                disabled={isSending || !subject || !message}
                                className="bg-slate-900 hover:bg-slate-800 text-white font-semibold"
                            >
                                <Send className="h-4 w-4 mr-2" />
                                {isSending ? "Sending..." : "Send Email"}
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Templates & Variables Helpers panel */}
                <div className="space-y-6">
                    {/* Load Template Card */}
                    <Card className="bg-white border-slate-200 shadow-sm">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-bold text-slate-900">Load Email Template</CardTitle>
                            <CardDescription className="text-xs">Quickly load a pre-saved message.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <select
                                value={selectedTemplateId}
                                onChange={e => handleTemplateChange(e.target.value)}
                                className="w-full h-9 px-3 bg-white border border-slate-200 rounded-md text-xs font-medium focus:outline-none focus:ring-2 focus:ring-red-500"
                            >
                                <option value="">-- Choose Template --</option>
                                {templates.map(t => (
                                    <option key={t.id} value={t.id}>{t.name}</option>
                                ))}
                            </select>
                            {templates.length === 0 && (
                                <p className="text-[10px] text-slate-400 mt-2">No custom templates found. Go to the Templates page to add some!</p>
                            )}
                        </CardContent>
                    </Card>

                    {/* Merge Variables Context Card */}
                    <Card className="bg-white border-slate-200 shadow-sm">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-bold text-slate-900">Event Context variables</CardTitle>
                            <CardDescription className="text-xs">Select session date/location merge values.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <select
                                value={selectedEventId}
                                onChange={e => handleEventChange(e.target.value)}
                                className="w-full h-9 px-3 bg-white border border-slate-200 rounded-md text-xs font-medium focus:outline-none focus:ring-2 focus:ring-red-500"
                            >
                                <option value="">-- Choose Training/Match --</option>
                                {events.map(e => (
                                    <option key={e.id} value={e.id}>{e.label}</option>
                                ))}
                            </select>

                            <div className="bg-slate-50 border p-3 rounded-lg text-[10px] font-sans text-slate-500 space-y-1">
                                <p className="font-bold text-slate-700">Merge tags explanation:</p>
                                <p><strong>`{"{{FirstName}}"}`</strong>: Player's first name (e.g. Coren)</p>
                                <p><strong>`{"{{TrainingDate}}"}`</strong>: Selected event date (e.g. Monday, 29 June)</p>
                                <p><strong>`{"{{Location}}"}`</strong>: Session location / Opponent name</p>
                                <p><strong>`{"{{RsvpLink}}"}`</strong>: Auto-generated responder link</p>
                                <p><strong>`{"{{SessionCode}}"}`</strong>: Alphanumeric code (e.g. CUA5DC)</p>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Email Preview Modal */}
            <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
                <DialogContent className="max-w-xl bg-white rounded-2xl p-6 text-slate-900">
                    <DialogHeader className="border-b pb-3">
                        <DialogTitle className="text-lg font-bold text-slate-900">
                            Compose Email Preview
                        </DialogTitle>
                        <span className="text-[10px] text-slate-400 mt-1 block">
                            Target Group: {recipientGroup} (Personalized merge tags values populated using dummy content)
                        </span>
                    </DialogHeader>
                    <div className="space-y-4 mt-4 text-sm leading-relaxed">
                        <div>
                            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Subject</label>
                            <p className="font-bold text-slate-900 text-base">
                                {subject.replace(/{{FirstName}}/g, "John").replace(/{{TrainingDate}}/g, "Tuesday, 30 June").replace(/{{Location}}/g, "Harris Lowe Academy")}
                            </p>
                        </div>
                        <div>
                            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Message Body Preview</label>
                            <div className="bg-slate-950 text-slate-200 p-4 rounded-xl font-sans text-xs whitespace-pre-wrap max-h-72 overflow-y-auto leading-relaxed mt-1">
                                {message
                                    .replace(/{{FirstName}}/g, "John")
                                    .replace(/{{TrainingDate}}/g, "Tuesday, 30 June")
                                    .replace(/{{Location}}/g, "Harris Lowe Academy")
                                    .replace(/{{SessionCode}}/g, "CU38A2")
                                    .replace(/{{RsvpLink}}/g, "https://www.clubflow.org.uk/respond/dummy-uuid-token")
                                    .replace(/{{JoinLink}}/g, "https://www.clubflow.org.uk/join")
                                }
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 pt-2">
                            <Button 
                                type="button" 
                                variant="outline" 
                                onClick={() => setIsPreviewOpen(false)}
                                className="border-slate-200"
                            >
                                Back to Editor
                            </Button>
                            <Button 
                                onClick={handleSendEmail} 
                                disabled={isSending}
                                className="bg-slate-900 hover:bg-slate-800 text-white font-semibold"
                            >
                                <Send className="h-4 w-4 mr-2" />
                                {isSending ? "Sending..." : "Confirm & Send"}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
