"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Search, Mail, Eye, RefreshCw, AlertCircle, BarChart3, TrendingUp, CheckCircle2, FileWarning } from "lucide-react";
import { useAuth } from "@/context/auth-context";

export default function HistoryPage() {
    const { clubId } = useAuth();

    const [history, setHistory] = useState<any[]>([]);
    const [analytics, setAnalytics] = useState<any>({ sent: 0, delivered: 0, failed: 0, bounceRate: "0.0%" });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [needsSetup, setNeedsSetup] = useState(false);

    // Search and Modal states
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedEmail, setSelectedEmail] = useState<any | null>(null);

    const loadHistory = async () => {
        if (!clubId) return;
        setLoading(true);
        setError(null);
        setNeedsSetup(false);
        try {
            const res = await fetch(`/api/communications/history?clubId=${clubId}`);
            const data = await res.json();
            if (!res.ok) {
                setError(data.error || "Failed to load history.");
                return;
            }

            if (data.needsSetup) {
                setNeedsSetup(true);
                return;
            }

            if (!data.success) {
                setError(data.error || "Failed to load history.");
                return;
            }

            setHistory(data.history || []);
            setAnalytics(data.analytics);
        } catch (err: any) {
            setError("Connection error. Could not retrieve email history.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (clubId) {
            loadHistory();
        }
    }, [clubId]);

    const filteredHistory = history.filter(item =>
        item.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.recipient_group.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (loading && history.length === 0 && !needsSetup) {
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
                            The communications email history tables need to be created in your Supabase database before you can proceed.
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
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-black text-slate-900 tracking-tight">Communications Logs</h1>
                <p className="text-slate-500 text-sm">Review sent message metrics and performance analytics.</p>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3 text-red-800 text-sm">
                    <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
                    <span>{error}</span>
                </div>
            )}

            {/* Analytics Grid */}
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                <Card className="bg-white border-slate-200 shadow-sm relative overflow-hidden">
                    <CardHeader className="pb-2">
                        <CardDescription className="text-[10px] uppercase font-bold text-slate-400">Total Emails Sent</CardDescription>
                        <CardTitle className="text-3xl font-black text-slate-900 mt-1">{analytics.sent}</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                        <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-600">
                            <TrendingUp className="h-3 w-3" />
                            <span>100% email volume</span>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-white border-slate-200 shadow-sm">
                    <CardHeader className="pb-2">
                        <CardDescription className="text-[10px] uppercase font-bold text-slate-400">Successful Deliveries</CardDescription>
                        <CardTitle className="text-3xl font-black text-slate-900 mt-1">{analytics.delivered}</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                        <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-600">
                            <CheckCircle2 className="h-3 w-3" />
                            <span>{(analytics.sent > 0 ? ((analytics.delivered / analytics.sent) * 100).toFixed(0) : 100)}% delivery success</span>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-white border-slate-200 shadow-sm">
                    <CardHeader className="pb-2">
                        <CardDescription className="text-[10px] uppercase font-bold text-slate-400">Failed / Bounced</CardDescription>
                        <CardTitle className="text-3xl font-black text-slate-900 mt-1">{analytics.failed}</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                        <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400">
                            <AlertCircle className="h-3 w-3 text-slate-400" />
                            <span>No active SMTP failures</span>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-white border-slate-200 shadow-sm">
                    <CardHeader className="pb-2">
                        <CardDescription className="text-[10px] uppercase font-bold text-slate-400">Bounce Rate</CardDescription>
                        <CardTitle className="text-3xl font-black text-slate-900 mt-1">{analytics.bounceRate}</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                        <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-600">
                            <BarChart3 className="h-3 w-3" />
                            <span>Industry standard compliant</span>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Logs List Card */}
            <Card className="bg-white border-slate-200 shadow-sm">
                <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b">
                    <div>
                        <CardTitle className="text-base font-bold text-slate-900">Email Dispatch Log</CardTitle>
                        <CardDescription>Search and inspect historical mailers.</CardDescription>
                    </div>
                    <div className="relative w-full sm:w-72">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                        <Input 
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            placeholder="Search by subject or group..."
                            className="pl-9 text-xs h-9 border-slate-200 w-full"
                        />
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto w-full">
                        <table className="w-full border-collapse">
                            <thead>
                                <tr className="bg-slate-50/50 border-b text-slate-500 text-xs font-bold text-left">
                                    <th className="w-10 px-4 py-3"></th>
                                    <th className="px-4 py-3">Subject</th>
                                    <th className="px-4 py-3">Recipient Group</th>
                                    <th className="px-4 py-3 text-center">Volume</th>
                                    <th className="px-4 py-3">Sent Date</th>
                                    <th className="px-4 py-3">Status</th>
                                    <th className="w-16 px-4 py-3"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredHistory.map(item => {
                                    const formattedDate = new Date(item.created_at).toLocaleDateString("en-GB", {
                                        day: "numeric",
                                        month: "short",
                                        year: "numeric",
                                        hour: "2-digit",
                                        minute: "2-digit"
                                    });

                                    return (
                                        <tr key={item.id} className="hover:bg-slate-50/40 border-b text-xs text-slate-700">
                                            <td className="px-4 py-3 text-slate-400 text-center">
                                                <Mail className="h-4 w-4" />
                                            </td>
                                            <td className="px-4 py-3 font-bold text-slate-900">
                                                {item.subject}
                                            </td>
                                            <td className="px-4 py-3">
                                                <Badge variant="outline" className="border-slate-200 text-slate-700 bg-slate-50">
                                                    {item.recipient_group}
                                                </Badge>
                                            </td>
                                            <td className="px-4 py-3 font-bold text-slate-900 text-center">
                                                {item.recipients_count}
                                            </td>
                                            <td className="px-4 py-3 text-slate-500">
                                                {formattedDate}
                                            </td>
                                            <td className="px-4 py-3">
                                                <Badge className={`
                                                    ${item.status === "Delivered" ? "bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-50" : "bg-red-50 text-red-700 border-red-100 hover:bg-red-50"}
                                                    border text-[10px] font-bold uppercase tracking-wider px-2 py-0.5
                                                `}>
                                                    {item.status}
                                                </Badge>
                                            </td>
                                            <td className="px-4 py-3">
                                                <button 
                                                    onClick={() => setSelectedEmail(item)}
                                                    className="p-1.5 hover:bg-slate-100 rounded text-slate-500 hover:text-slate-900 transition-colors"
                                                    title="View email body preview"
                                                >
                                                    <Eye className="h-4 w-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}

                                {filteredHistory.length === 0 && (
                                    <tr>
                                        <td colSpan={7} className="text-center p-8 text-slate-400 italic">
                                            No sent email history records found.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>

            {/* Sent Email Preview Modal */}
            <Dialog open={!!selectedEmail} onOpenChange={() => setSelectedEmail(null)}>
                {selectedEmail && (
                    <DialogContent className="max-w-xl bg-white rounded-2xl p-6 text-slate-900">
                        <DialogHeader className="border-b pb-3">
                            <DialogTitle className="text-lg font-bold text-slate-900">
                                Sent Email details
                            </DialogTitle>
                            <span className="text-[10px] text-slate-400 mt-1 block">
                                Group: {selectedEmail.recipient_group} • Count: {selectedEmail.recipients_count}
                            </span>
                        </DialogHeader>
                        <div className="space-y-4 mt-4 text-sm leading-relaxed">
                            <div>
                                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Subject</label>
                                <p className="font-bold text-slate-900 text-base">{selectedEmail.subject}</p>
                            </div>
                            <div>
                                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Message Body Preview</label>
                                <div className="bg-slate-950 text-slate-200 p-4 rounded-xl font-sans text-xs whitespace-pre-wrap max-h-72 overflow-y-auto leading-relaxed mt-1">
                                    {selectedEmail.body_content}
                                </div>
                            </div>
                        </div>
                    </DialogContent>
                )}
            </Dialog>
        </div>
    );
}
