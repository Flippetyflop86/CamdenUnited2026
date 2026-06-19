"use client";

import { useState } from "react";
import { useClub } from "@/context/club-context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Upload, Save, Shield } from "lucide-react";
import { DataExport } from "@/components/admin/data-export";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/lib/supabase";

export default function AdminPage() {
    const { settings, updateSettings } = useClub();
    
    // Identity
    const [name, setName] = useState(settings.name);
    const [logo, setLogo] = useState<string | null>(settings.logo);
    
    // Colors & Kits
    const [primaryColor, setPrimaryColor] = useState(settings.primaryColor);
    const [secondaryColor, setSecondaryColor] = useState(settings.secondaryColor);
    const [homeKitShirt, setHomeKitShirt] = useState(settings.homeKitShirt);
    const [homeKitShorts, setHomeKitShorts] = useState(settings.homeKitShorts);
    const [homeKitSocks, setHomeKitSocks] = useState(settings.homeKitSocks);
    const [awayKitShirt, setAwayKitShirt] = useState(settings.awayKitShirt);
    const [awayKitShorts, setAwayKitShorts] = useState(settings.awayKitShorts);
    const [awayKitSocks, setAwayKitSocks] = useState(settings.awayKitSocks);

    // League
    const [leagueUrl, setLeagueUrl] = useState(settings.leagueUrl || "");
    const [leaguePosition, setLeaguePosition] = useState(settings.leaguePosition?.toString() || "");

    // Finance & Sponsors
    const [monthlySubs, setMonthlySubs] = useState(settings.monthlySubs?.toString() || "0");
    const [finesEnabled, setFinesEnabled] = useState(settings.finesEnabled);
    const [sponsorLogo, setSponsorLogo] = useState<string | null>(settings.sponsorLogo);

    const [isMigrating, setIsMigrating] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const [logoFile, setLogoFile] = useState<File | null>(null);
    const [sponsorFile, setSponsorFile] = useState<File | null>(null);

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, setPreview: (v: string) => void, setFile: (f: File) => void) => {
        const file = e.target.files?.[0];
        if (file) {
            setFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setPreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const uploadFileIfAny = async (file: File | null, existingUrl: string | null, bucket: string) => {
        if (!file) return existingUrl;
        
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${Math.random()}.${fileExt}`;
            const filePath = `${bucket}/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from(bucket)
                .upload(filePath, file, { upsert: true });

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from(bucket)
                .getPublicUrl(filePath);
                
            return publicUrl;
        } catch (error) {
            console.error(`Error uploading to ${bucket}:`, error);
            return existingUrl;
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const finalLogo = await uploadFileIfAny(logoFile, logo, 'club_logos');
            const finalSponsor = await uploadFileIfAny(sponsorFile, sponsorLogo, 'club_logos');

            await updateSettings({ 
                name, 
                logo: finalLogo,
                primaryColor,
                secondaryColor,
                homeKitShirt,
                homeKitShorts,
                homeKitSocks,
                awayKitShirt,
                awayKitShorts,
                awayKitSocks,
                leagueUrl,
                leaguePosition: leaguePosition ? parseInt(leaguePosition) : null,
                monthlySubs: parseFloat(monthlySubs) || 0,
                finesEnabled,
                sponsorLogo: finalSponsor
            });
            alert("Settings saved successfully!");
        } catch (error) {
            console.error(error);
            alert("Failed to save settings.");
        } finally {
            setIsSaving(false);
        }
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
            <div className="flex justify-between items-end">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-slate-900">Admin Settings</h2>
                    <p className="text-slate-500">Manage club details, kits, and financial configurations.</p>
                </div>
                <Button onClick={handleSave} disabled={isSaving} className="bg-slate-900 hover:bg-slate-800 h-10 px-6">
                    <Save className="mr-2 h-4 w-4" />
                    {isSaving ? "Saving..." : "Save Changes"}
                </Button>
            </div>

            <Tabs defaultValue="identity" className="w-full">
                <TabsList className="grid w-full max-w-2xl grid-cols-4">
                    <TabsTrigger value="identity">Identity</TabsTrigger>
                    <TabsTrigger value="kits">Kits & Colors</TabsTrigger>
                    <TabsTrigger value="finance">Finance</TabsTrigger>
                    <TabsTrigger value="advanced">Advanced</TabsTrigger>
                </TabsList>

                {/* IDENTITY TAB */}
                <TabsContent value="identity" className="space-y-6 mt-6">
                    <Card className="max-w-2xl">
                        <CardHeader>
                            <CardTitle>Club Identity</CardTitle>
                            <CardDescription>
                                Customize how your club appears across the platform.
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
                                            <div className="flex w-fit items-center gap-2 px-4 py-2 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors shadow-sm text-sm font-medium text-slate-700">
                                                <Upload className="h-4 w-4" />
                                                Upload Logo
                                            </div>
                                            <input
                                                id="logo-upload"
                                                type="file"
                                                accept="image/*"
                                                className="hidden"
                                                onChange={(e) => handleFileUpload(e, setLogo, setLogoFile)}
                                            />
                                        </Label>
                                        <p className="text-xs text-slate-500 mt-2">Recommended format: PNG. Max 2MB.</p>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="space-y-2 pt-4 border-t border-slate-100">
                                <Label>League Full-Time Link</Label>
                                <Input
                                    value={leagueUrl}
                                    onChange={(e) => setLeagueUrl(e.target.value)}
                                    placeholder="https://fulltime.thefa.com/..."
                                />
                                <p className="text-xs text-slate-500 mt-1">If available, paste the FA Full-Time link for live table syncing.</p>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* KITS TAB */}
                <TabsContent value="kits" className="space-y-6 mt-6">
                    <Card className="max-w-2xl">
                        <CardHeader>
                            <CardTitle>Kit Colors</CardTitle>
                            <CardDescription>
                                Set the exact colors for your home and away kits for line-up graphics.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-8">
                            <div className="space-y-4">
                                <h4 className="font-semibold text-slate-700 flex items-center gap-2">
                                    <Shield className="h-4 w-4 text-slate-400" />
                                    Home Kit
                                </h4>
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="space-y-2">
                                        <Label className="text-xs">Shirt</Label>
                                        <div className="flex gap-2">
                                            <input type="color" value={homeKitShirt} onChange={e => setHomeKitShirt(e.target.value)} className="h-10 w-10 cursor-pointer rounded border border-slate-200" />
                                            <Input value={homeKitShirt} onChange={e => setHomeKitShirt(e.target.value)} className="font-mono text-xs" />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs">Shorts</Label>
                                        <div className="flex gap-2">
                                            <input type="color" value={homeKitShorts} onChange={e => setHomeKitShorts(e.target.value)} className="h-10 w-10 cursor-pointer rounded border border-slate-200" />
                                            <Input value={homeKitShorts} onChange={e => setHomeKitShorts(e.target.value)} className="font-mono text-xs" />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs">Socks</Label>
                                        <div className="flex gap-2">
                                            <input type="color" value={homeKitSocks} onChange={e => setHomeKitSocks(e.target.value)} className="h-10 w-10 cursor-pointer rounded border border-slate-200" />
                                            <Input value={homeKitSocks} onChange={e => setHomeKitSocks(e.target.value)} className="font-mono text-xs" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="space-y-4 pt-4 border-t border-slate-100">
                                <h4 className="font-semibold text-slate-700 flex items-center gap-2">
                                    <Shield className="h-4 w-4 text-slate-400" />
                                    Away Kit
                                </h4>
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="space-y-2">
                                        <Label className="text-xs">Shirt</Label>
                                        <div className="flex gap-2">
                                            <input type="color" value={awayKitShirt} onChange={e => setAwayKitShirt(e.target.value)} className="h-10 w-10 cursor-pointer rounded border border-slate-200" />
                                            <Input value={awayKitShirt} onChange={e => setAwayKitShirt(e.target.value)} className="font-mono text-xs" />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs">Shorts</Label>
                                        <div className="flex gap-2">
                                            <input type="color" value={awayKitShorts} onChange={e => setAwayKitShorts(e.target.value)} className="h-10 w-10 cursor-pointer rounded border border-slate-200" />
                                            <Input value={awayKitShorts} onChange={e => setAwayKitShorts(e.target.value)} className="font-mono text-xs" />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs">Socks</Label>
                                        <div className="flex gap-2">
                                            <input type="color" value={awayKitSocks} onChange={e => setAwayKitSocks(e.target.value)} className="h-10 w-10 cursor-pointer rounded border border-slate-200" />
                                            <Input value={awayKitSocks} onChange={e => setAwayKitSocks(e.target.value)} className="font-mono text-xs" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="space-y-4 pt-4 border-t border-slate-100">
                                <h4 className="font-semibold text-slate-700">App Theme Colors</h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label className="text-xs">Primary Brand Color</Label>
                                        <div className="flex gap-2">
                                            <input type="color" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} className="h-10 w-10 cursor-pointer rounded border border-slate-200" />
                                            <Input value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} className="font-mono text-xs" />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs">Secondary Brand Color</Label>
                                        <div className="flex gap-2">
                                            <input type="color" value={secondaryColor} onChange={e => setSecondaryColor(e.target.value)} className="h-10 w-10 cursor-pointer rounded border border-slate-200" />
                                            <Input value={secondaryColor} onChange={e => setSecondaryColor(e.target.value)} className="font-mono text-xs" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* FINANCE TAB */}
                <TabsContent value="finance" className="space-y-6 mt-6">
                    <Card className="max-w-2xl">
                        <CardHeader>
                            <CardTitle>Financial Settings</CardTitle>
                            <CardDescription>
                                Set baselines for player subscriptions and sponsorship integrations.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label>Monthly Subs Baseline (£)</Label>
                                    <Input
                                        type="number"
                                        value={monthlySubs}
                                        onChange={(e) => setMonthlySubs(e.target.value)}
                                        placeholder="35"
                                    />
                                    <p className="text-xs text-slate-500">Default tracking amount.</p>
                                </div>
                                <div className="space-y-4 pt-2">
                                    <div className="flex items-center justify-between">
                                        <div className="space-y-0.5">
                                            <Label>Fine System</Label>
                                            <p className="text-xs text-slate-500">Track and manage squad fines.</p>
                                        </div>
                                        <Switch
                                            checked={finesEnabled}
                                            onCheckedChange={setFinesEnabled}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2 pt-4 border-t border-slate-100">
                                <Label>Main Sponsor Logo</Label>
                                <div className="flex items-center gap-4">
                                    <div className="h-20 w-32 rounded border-2 border-dashed border-slate-300 flex items-center justify-center bg-slate-50 overflow-hidden relative">
                                        {sponsorLogo ? (
                                            <img src={sponsorLogo} alt="Sponsor Preview" className="h-full w-full object-contain p-2" />
                                        ) : (
                                            <span className="text-slate-400 text-xs text-center p-2">No Sponsor</span>
                                        )}
                                    </div>
                                    <div className="flex-1">
                                        <Label htmlFor="sponsor-upload" className="cursor-pointer">
                                            <div className="flex w-fit items-center gap-2 px-4 py-2 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors shadow-sm text-sm font-medium text-slate-700">
                                                <Upload className="h-4 w-4" />
                                                Upload Sponsor
                                            </div>
                                            <input
                                                id="sponsor-upload"
                                                type="file"
                                                accept="image/*"
                                                className="hidden"
                                                onChange={(e) => handleFileUpload(e, setSponsorLogo, setSponsorFile)}
                                            />
                                        </Label>
                                        <p className="text-xs text-slate-500 mt-2">Appears on matchday graphics.</p>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ADVANCED TAB */}
                <TabsContent value="advanced" className="space-y-6 mt-6">
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

                    <DataExport />
                </TabsContent>
            </Tabs>
        </div>
    );
}
