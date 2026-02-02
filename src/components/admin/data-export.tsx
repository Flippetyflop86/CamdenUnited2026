"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Download, Copy, Check } from "lucide-react";
import { supabase } from "@/lib/supabase";

export function DataExport() {
    const [exportData, setExportData] = useState<string>("");
    const [copied, setCopied] = useState(false);

    const handleExport = async () => {
        const tables = [
            'players', 'matches', 'training_sessions', 'finance_transactions',
            'sponsors', 'subscriptions', 'inventory_items', 'documents',
            'watcher_stats', 'matchday_xis', 'recruits', 'opposition_teams',
            'app_users', 'club_settings'
        ];

        const data: Record<string, any> = {};

        await Promise.all(tables.map(async (table) => {
            const { data: rows } = await supabase.from(table).select('*');
            if (rows) {
                data[table] = rows;
            }
        }));

        // Add timestamp
        data["_exportTimestamp"] = new Date().toISOString();
        data["_source"] = "Supabase Backup";

        const jsonString = JSON.stringify(data, null, 2);
        setExportData(jsonString);
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(exportData);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <Card className="max-w-2xl border-amber-200 bg-amber-50/50">
            <CardHeader>
                <CardTitle className="text-amber-900">🚀 Deployment Pre-Flight: Export Data</CardTitle>
                <CardDescription className="text-amber-700">
                    Your data is safely stored in the cloud database. Use this tool to generate a full JSON backup of all your club data for safekeeping.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {!exportData ? (
                    <Button onClick={handleExport} className="w-full bg-amber-600 hover:bg-amber-700 text-white">
                        <Download className="mr-2 h-4 w-4" />
                        Generate Export Data
                    </Button>
                ) : (
                    <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                        <div className="relative">
                            <pre className="bg-slate-900 text-slate-50 p-4 rounded-lg text-xs overflow-auto max-h-[300px] whitespace-pre-wrap border border-slate-700">
                                {exportData}
                            </pre>
                            <Button
                                size="sm"
                                variant="secondary"
                                className="absolute top-2 right-2 h-8"
                                onClick={handleCopy}
                            >
                                {copied ? <Check className="h-3 w-3 mr-1 text-green-600" /> : <Copy className="h-3 w-3 mr-1" />}
                                {copied ? "Copied!" : "Copy Code"}
                            </Button>
                        </div>
                        <p className="text-sm text-slate-600">
                            <strong>Next Step:</strong> Click "Copy Code" above and paste it into the chat. I will bake this into the app so it's there when you publish!
                        </p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
