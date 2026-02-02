"use client";

import { useState } from "react";
import { useClub } from "@/context/club-context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Upload, Save } from "lucide-react";
import { DataExport } from "@/components/admin/data-export";

export default function AdminPage() {
    const { settings, updateSettings } = useClub();
    const [name, setName] = useState(settings.name);
    const [logo, setLogo] = useState<string | null>(settings.logo);

    const [isMigrating, setIsMigrating] = useState(false);

    // Local state for feedback
    const [isSaving, setIsSaving] = useState(false);

    const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setLogo(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSave = () => {
        setIsSaving(true);
        updateSettings({ name, logo });

        // Fake delay for feedback
        setTimeout(() => {
            setIsSaving(false);
            alert("Settings saved successfully!");
        }, 500);
    };

    const handleMigrate = async () => {
        if (!confirm("This will overwrite Supabase data with your Seed Data. Continue?")) return;

        setIsMigrating(true);
        try {
            const res = await fetch("/api/seed", { method: "POST" });
            const data = await res.json();
            if (res.ok) {
                alert(`Migration Success!\nPlayers: ${data.results.players}\nMatches: ${data.results.matches}`);
            } else {
                alert(`Migration Failed: ${data.error}`);
            }
        } catch (err: any) {
            alert("Error migrating: " + err.message);
        } finally {
            setIsMigrating(false);
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-3xl font-bold tracking-tight text-slate-900">Admin Settings</h2>
                <p className="text-slate-500">Manage club details and white-label preferences.</p>
            </div>

            {/* Cloud Migration Card */}
            <Card className="max-w-2xl border-blue-200 bg-blue-50">
                <CardHeader>
                    <CardTitle className="text-blue-900">Cloud Migration</CardTitle>
                    <CardDescription className="text-blue-700">
                        Push your seeded local data to Supabase to enable live sync for all users.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Button
                        onClick={handleMigrate}
                        disabled={isMigrating}
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                        {isMigrating ? "Migrating..." : "Push Data to Cloud"}
                        <Upload className="ml-2 h-4 w-4" />
                    </Button>
                </CardContent>
            </Card>

            <Card className="max-w-2xl">
                {/* ... existing Card content ... */}
                <CardHeader>
                    <CardTitle>Club Identity</CardTitle>
                    <CardDescription>
                        Customize how your club appears in the dashboard and reports.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-2">
                        <Label htmlFor="clubName">Club Name</Label>
                        <Input
                            id="clubName"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. Camden United FC"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Club Logo</Label>
                        <div className="flex items-center gap-4">
                            <div className="h-24 w-24 rounded border-2 border-dashed border-slate-300 flex items-center justify-center bg-slate-50 overflow-hidden relative">
                                {logo ? (
                                    <img src={logo} alt="Preview" className="h-full w-full object-contain" />
                                ) : (
                                    <span className="text-slate-400 text-xs text-center p-2">No Logo</span>
                                )}
                            </div>
                            <div className="flex-1">
                                <Label htmlFor="logo-upload" className="cursor-pointer">
                                    <div className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors shadow-sm text-sm font-medium text-slate-700">
                                        <Upload className="h-4 w-4" />
                                        Upload Logo
                                    </div>
                                    <input
                                        id="logo-upload"
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={handleLogoUpload}
                                    />
                                </Label>
                                <p className="text-xs text-slate-500 mt-2">
                                    Recommended format: PNG or JPG. Max size 2MB.
                                    <br />
                                    This logo will appear in the sidebar and on exported reports.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="pt-4 flex justify-end">
                        <Button onClick={handleSave} disabled={isSaving} className="bg-slate-900 hover:bg-slate-800">
                            <Save className="mr-2 h-4 w-4" />
                            {isSaving ? "Saving..." : "Save Changes"}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <DataExport />
        </div>
    );
}
