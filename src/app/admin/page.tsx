"use client";

import { useState } from "react";
import { useClub } from "@/context/club-context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Upload, Save, Shield, Plus, Trash2 } from "lucide-react";
import { DataExport } from "@/components/admin/data-export";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/lib/supabase";
import { Textarea } from "@/components/ui/textarea";

export default function AdminPage() {
    const { settings, updateSettings } = useClub();
    
    // Identity
    const [name, setName] = useState(settings.name);
    const [logo, setLogo] = useState<string | null>(settings.logo);
    const [squads, setSquads] = useState<string[]>(settings.squads || []);
    const [homeGround, setHomeGround] = useState(settings.homeGround || "");
    const [foundingYear, setFoundingYear] = useState(settings.foundingYear?.toString() || "");
    const [twitterUrl, setTwitterUrl] = useState(settings.twitterUrl || "");
    const [instagramUrl, setInstagramUrl] = useState(settings.instagramUrl || "");
    const [whatsappPollMessage, setWhatsAppPollMessage] = useState(settings.whatsappPollMessage || "");
    
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
    const [fineCategories, setFineCategories] = useState<{name: string, amount: number}[]>(settings.fineCategories || []);
    const [sponsorLogo, setSponsorLogo] = useState<string | null>(settings.sponsorLogo);

    // Notifications
    const [notificationsEnabled, setNotificationsEnabled] = useState(settings.notificationsEnabled || false);
    const [notificationEmail, setNotificationEmail] = useState(settings.notificationEmail || "");

    const [isMigrating, setIsMigrating] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const [logoFile, setLogoFile] = useState<File | null>(null);
    const [sponsorFile, setSponsorFile] = useState<File | null>(null);
    const [csvFile, setCsvFile] = useState<File | null>(null);
    const [isImporting, setIsImporting] = useState(false);
    const [isArchiving, setIsArchiving] = useState(false);

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, setPreview: (v: string) => void, setFile: (f: File) => void) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 2 * 1024 * 1024) {
                alert("File is too large. Maximum size allowed is 2MB.");
                return;
            }
            const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/svg+xml', 'image/webp'];
            if (!allowedTypes.includes(file.type)) {
                alert("Invalid file type. Only JPEG, PNG, WEBP, GIF, and SVG images are allowed.");
                return;
            }
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
                squads,
                homeGround,
                foundingYear: foundingYear ? parseInt(foundingYear) : null,
                twitterUrl,
                instagramUrl,
                whatsappPollMessage,
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
                fineCategories,
                notificationsEnabled,
                notificationEmail,
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

    const handleImportCsv = async () => {
        if (!csvFile) return alert("Please select a CSV file first.");
        setIsImporting(true);
        try {
            const Papa = (await import('papaparse')).default;
            Papa.parse(csvFile, {
                header: true,
                skipEmptyLines: true,
                complete: async (results) => {
                    if (results.errors.length > 0) {
                        alert("Error parsing CSV: " + results.errors[0].message);
                        setIsImporting(false);
                        return;
                    }
                    
                    const players = results.data.map((row: any) => ({
                        first_name: row.first_name || row.firstName || row.Name?.split(' ')[0] || 'Unknown',
                        last_name: row.last_name || row.lastName || row.Name?.split(' ').slice(1).join(' ') || 'Player',
                        position: row.position || row.Position || 'GK',
                        squad: row.squad || row.Squad || (squads.length > 0 ? squads[0] : 'First Team'),
                        age: parseInt(row.age || row.Age) || null
                    }));

                    const { error } = await supabase.from('players').insert(players);
                    if (error) throw error;
                    
                    alert(`Successfully imported ${players.length} players!`);
                    setCsvFile(null);
                }
            });
        } catch (err: any) {
            alert("Error importing: " + err.message);
        } finally {
            setIsImporting(false);
        }
    };

    const handleArchiveSeason = async () => {
        if (!confirm("Are you sure? This will reset all current player contract statuses and clear training squads to prepare for a new season. Match history is kept safe!")) return;
        setIsArchiving(true);
        try {
            // Un-contract everyone and clear training squads
            const { error } = await supabase.from('players').update({
                is_contracted: false,
                is_in_training_squad: false,
                contract_amount: null
            }).neq('id', '00000000-0000-0000-0000-000000000000'); // update all
            
            if (error) throw error;
            alert("Season successfully archived! You can now assign new contracts and training squads.");
        } catch (err: any) {
            alert("Error archiving: " + err.message);
        } finally {
            setIsArchiving(false);
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
                <TabsList className="grid w-full max-w-4xl grid-cols-6">
                    <TabsTrigger value="identity">Identity</TabsTrigger>
                    <TabsTrigger value="squads">Squads</TabsTrigger>
                    <TabsTrigger value="kits">Kits & Colors</TabsTrigger>
                    <TabsTrigger value="finance">Finance</TabsTrigger>
                    <TabsTrigger value="staff">Staff</TabsTrigger>
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

                            <div className="space-y-4 pt-4 border-t border-slate-100">
                                <h4 className="font-semibold text-slate-700">Details & History</h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label className="text-xs">Home Ground</Label>
                                        <Input value={homeGround} onChange={e => setHomeGround(e.target.value)} placeholder="e.g. Highbury" className="text-sm" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs">Founding Year</Label>
                                        <Input type="number" value={foundingYear} onChange={e => setFoundingYear(e.target.value)} placeholder="e.g. 1886" className="text-sm" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs">Twitter (X)</Label>
                                        <Input value={twitterUrl} onChange={e => setTwitterUrl(e.target.value)} placeholder="https://twitter.com/..." className="text-sm" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs">Instagram</Label>
                                        <Input value={instagramUrl} onChange={e => setInstagramUrl(e.target.value)} placeholder="https://instagram.com/..." className="text-sm" />
                                    </div>
                                    <div className="space-y-2 col-span-2">
                                        <Label className="text-xs">WhatsApp Poll Message</Label>
                                        <Textarea value={whatsappPollMessage} onChange={e => setWhatsAppPollMessage(e.target.value)} placeholder="e.g. Hi team, please vote for availability for this weekend's match..." className="text-sm min-h-[80px]" />
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* SQUADS TAB */}
                <TabsContent value="squads" className="space-y-6 mt-6">
                    <Card className="max-w-2xl">
                        <CardHeader>
                            <CardTitle>Squads Setup</CardTitle>
                            <CardDescription>
                                Define the squads for your club. These will be available when assigning players.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {squads.map((squad, index) => (
                                <div key={index} className="flex gap-2">
                                    <Input
                                        value={squad}
                                        onChange={(e) => {
                                            const newSquads = [...squads];
                                            newSquads[index] = e.target.value;
                                            setSquads(newSquads);
                                        }}
                                        placeholder="Squad Name"
                                    />
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        onClick={() => {
                                            setSquads(squads.filter((_, i) => i !== index));
                                        }}
                                    >
                                        <Trash2 className="w-4 h-4 text-slate-500 hover:text-red-600" />
                                    </Button>
                                </div>
                            ))}
                            <Button
                                variant="outline"
                                className="w-full border-dashed"
                                onClick={() => setSquads([...squads, "New Squad"])}
                            >
                                <Plus className="w-4 h-4 mr-2" /> Add Squad
                            </Button>
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

                            {finesEnabled && (
                                <div className="space-y-4 pt-4 border-t border-slate-100">
                                    <h4 className="font-semibold text-slate-700 text-sm">Fine Categories</h4>
                                    <div className="space-y-2">
                                        {fineCategories.map((cat, idx) => (
                                            <div key={idx} className="flex gap-2">
                                                <Input value={cat.name} onChange={e => {
                                                    const newCats = [...fineCategories];
                                                    newCats[idx].name = e.target.value;
                                                    setFineCategories(newCats);
                                                }} placeholder="e.g. Yellow Card" className="text-sm flex-1" />
                                                <Input type="number" value={cat.amount} onChange={e => {
                                                    const newCats = [...fineCategories];
                                                    newCats[idx].amount = parseFloat(e.target.value);
                                                    setFineCategories(newCats);
                                                }} placeholder="£" className="text-sm w-24" />
                                                <Button variant="outline" size="icon" onClick={() => {
                                                    setFineCategories(fineCategories.filter((_, i) => i !== idx));
                                                }}>
                                                    <Trash2 className="w-4 h-4 text-slate-500 hover:text-red-600" />
                                                </Button>
                                            </div>
                                        ))}
                                        <Button variant="outline" className="w-full border-dashed text-xs" onClick={() => setFineCategories([...fineCategories, { name: "New Fine", amount: 0 }])}>
                                            <Plus className="w-4 h-4 mr-2" /> Add Category
                                        </Button>
                                    </div>
                                </div>
                            )}

                            <div className="space-y-4 pt-4 border-t border-slate-100">
                                <h4 className="font-semibold text-slate-700 text-sm">Automated Notifications</h4>
                                <div className="flex items-center justify-between p-3 bg-slate-50 rounded border">
                                    <div>
                                        <p className="text-sm font-medium">Enable Email Reminders</p>
                                        <p className="text-xs text-slate-500">Send notifications for matches, subs, and fines.</p>
                                    </div>
                                    <Switch checked={notificationsEnabled} onCheckedChange={setNotificationsEnabled} />
                                </div>
                                {notificationsEnabled && (
                                    <div className="space-y-2">
                                        <Label className="text-xs">Notification Email</Label>
                                        <Input value={notificationEmail} onChange={e => setNotificationEmail(e.target.value)} placeholder="hello@club.com" className="text-sm" />
                                    </div>
                                )}
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

                {/* STAFF TAB */}
                <TabsContent value="staff" className="space-y-6 mt-6">
                    <Card className="max-w-2xl">
                        <CardHeader>
                            <CardTitle>Staff & Committee Management</CardTitle>
                            <CardDescription>
                                Add or remove coaching staff and committee members.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <p className="text-sm text-slate-500 mb-4">
                                Head over to the dedicated Staff page to view and edit your committee members, coaches, and physios.
                            </p>
                            <Button variant="outline" onClick={() => window.location.href = '/staff'}>
                                Go to Staff Page
                            </Button>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ADVANCED TAB */}
                <TabsContent value="advanced" className="space-y-6 mt-6">
                    <Card className="max-w-2xl">
                        <CardHeader>
                            <CardTitle>Data Import & Archiving</CardTitle>
                            <CardDescription>
                                Bulk import players from a CSV file or archive the current season.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="space-y-2">
                                <Label>Import Players (CSV)</Label>
                                <div className="flex gap-2">
                                    <Input type="file" accept=".csv" onChange={(e) => setCsvFile(e.target.files?.[0] || null)} className="flex-1" />
                                    <Button onClick={handleImportCsv} disabled={isImporting || !csvFile}>
                                        {isImporting ? "Importing..." : "Import CSV"}
                                    </Button>
                                </div>
                                <p className="text-xs text-slate-500">CSV should have headers like: first_name, last_name, position, squad, age.</p>
                            </div>

                            <div className="pt-4 border-t border-slate-100">
                                <Label className="text-red-600 font-semibold mb-2 block">End of Season Archive</Label>
                                <p className="text-xs text-slate-500 mb-4">
                                    This will reset all current player contract statuses and clear training squads. 
                                    Your match history and stats are safely kept per season automatically.
                                </p>
                                <Button onClick={handleArchiveSeason} disabled={isArchiving} variant="destructive">
                                    {isArchiving ? "Archiving..." : "Archive Season & Start Fresh"}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

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
