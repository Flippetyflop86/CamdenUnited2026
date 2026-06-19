"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Upload, CheckCircle2, ChevronRight, Image as ImageIcon, Users, Palette, Trophy, ShieldCheck, MapPin, Twitter, Instagram, Banknote, ShieldAlert, Award, Plus, Trash2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useClub } from "@/context/club-context";
import { useAuth } from "@/context/auth-context";
import { motion, AnimatePresence } from "framer-motion";

export default function OnboardingWizard() {
    const { settings, updateSettings } = useClub();
    const { user } = useAuth();
    const router = useRouter();

    const [step, setStep] = useState(1);
    
    // Step 1: Identity & Sponsors
    const [clubName, setClubName] = useState(settings.name);
    const [logoFile, setLogoFile] = useState<File | null>(null);
    const [logoPreview, setLogoPreview] = useState<string | null>(settings.logo);
    const [sponsorLogoFile, setSponsorLogoFile] = useState<File | null>(null);
    const [sponsorLogoPreview, setSponsorLogoPreview] = useState<string | null>(settings.sponsorLogo);

    // Step 2: Colors & Kits
    const [primaryColor, setPrimaryColor] = useState(settings.primaryColor || "#ef4444");
    const [secondaryColor, setSecondaryColor] = useState(settings.secondaryColor || "#0f172a");
    const [homeKitShirt, setHomeKitShirt] = useState(settings.homeKitShirt || "#ffffff");
    const [homeKitShorts, setHomeKitShorts] = useState(settings.homeKitShorts || "#ffffff");
    const [homeKitSocks, setHomeKitSocks] = useState(settings.homeKitSocks || "#ffffff");
    const [awayKitShirt, setAwayKitShirt] = useState(settings.awayKitShirt || "#000000");
    const [awayKitShorts, setAwayKitShorts] = useState(settings.awayKitShorts || "#000000");
    const [awayKitSocks, setAwayKitSocks] = useState(settings.awayKitSocks || "#000000");

    // Step 3: Details & History
    const [homeGroundName, setHomeGroundName] = useState("");
    const [postcode, setPostcode] = useState("");
    const [twitterHandle, setTwitterHandle] = useState("");
    const [instagramHandle, setInstagramHandle] = useState("");

    // Step 4: Finance & Operations
    const [monthlySubs, setMonthlySubs] = useState(settings.monthlySubs?.toString() || "35");
    const [finesEnabled, setFinesEnabled] = useState(settings.finesEnabled || false);

    // Step 5: Squads
    const availableSquads = ["First Team", "Reserves", "Under-18s", "Under-16s", "Women's Team", "Academy", "Pan-Disability"];
    const [selectedSquads, setSelectedSquads] = useState<string[]>(["First Team"]);
    const [customSquadInput, setCustomSquadInput] = useState("");

    // Step 6: Committee & Staff
    const [staffInvites, setStaffInvites] = useState([
        { name: "", email: "", role: "Chairman" },
        { name: "", email: "", role: "Secretary" },
        { name: "", email: "", role: "Treasurer" }
    ]);

    // Step 7: League
    const [leagueUrl, setLeagueUrl] = useState(settings.leagueUrl || "");

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");

    const presetColors = ["#FFFFFF", "#000000", "#EF4444", "#3B82F6", "#10B981", "#F59E0B", "#1E40AF", "#0F172A"];

    const totalSteps = 7;

    const handleNext = () => setStep(prev => prev + 1);
    const handleBack = () => setStep(prev => prev - 1);
    const handleSkip = () => handleNext();

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, type: 'logo' | 'sponsor') => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            if (type === 'logo') {
                setLogoFile(file);
                setLogoPreview(URL.createObjectURL(file));
            } else {
                setSponsorLogoFile(file);
                setSponsorLogoPreview(URL.createObjectURL(file));
            }
        }
    };

    const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>, type: 'logo' | 'sponsor') => {
        const items = e.clipboardData?.items;
        if (!items) return;

        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf("image") !== -1) {
                const file = items[i].getAsFile();
                if (file) {
                    if (type === 'logo') {
                        setLogoFile(file);
                        setLogoPreview(URL.createObjectURL(file));
                    } else {
                        setSponsorLogoFile(file);
                        setSponsorLogoPreview(URL.createObjectURL(file));
                    }
                    e.preventDefault();
                    break;
                }
            }
        }
    };

    const uploadFileIfAny = async (file: File | null, existingUrl: string | null, bucket: string) => {
        if (file && user) {
            const fileExt = file.name.split('.').pop() || 'png';
            const fileName = `${user.id}-${Math.random()}.${fileExt}`;
            const filePath = `${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from(bucket)
                .upload(filePath, file, { upsert: true });

            if (uploadError) throw uploadError;

            const { data: publicUrlData } = supabase.storage
                .from(bucket)
                .getPublicUrl(filePath);

            return publicUrlData.publicUrl;
        }
        return existingUrl;
    };

    const handleSaveAndNext = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        
        if (step === 1 && !clubName.trim()) {
            setError("Club name cannot be empty.");
            return;
        }

        if (step === 5 && selectedSquads.length === 0) {
            setError("Please select at least one squad.");
            return;
        }

        if (step === totalSteps) {
            return finalizeOnboarding();
        }

        handleNext();
    };

    const finalizeOnboarding = async () => {
        setIsLoading(true);
        setError("");
        try {
            const finalLogoUrl = await uploadFileIfAny(logoFile, logoPreview, 'club_logos');
            const finalSponsorUrl = await uploadFileIfAny(sponsorLogoFile, sponsorLogoPreview, 'club_logos');

            // Handle Staff Invites (Mocking it by saving to staff table without auth for now)
            const validStaff = staffInvites.filter(s => s.name.trim() && s.email.trim());
            if (validStaff.length > 0) {
                const staffInserts = validStaff.map(s => ({
                    name: s.name,
                    email: s.email,
                    role: s.role
                }));
                // Try inserting, ignore errors if table doesn't exist yet
                const { error: insertError } = await supabase.from('staff').insert(staffInserts);
                if (insertError) console.warn("Failed to insert staff (expected if table missing):", insertError);
            }

            await updateSettings({ 
                name: clubName,
                logo: finalLogoUrl,
                primaryColor,
                secondaryColor,
                squads: selectedSquads,
                leagueUrl: leagueUrl || null,
                homeKitShirt,
                homeKitShorts,
                homeKitSocks,
                awayKitShirt,
                awayKitShorts,
                awayKitSocks,
                sponsorLogo: finalSponsorUrl,
                monthlySubs: parseFloat(monthlySubs) || 0,
                finesEnabled,
                isOnboarded: true 
            });

            setStep(8); // Success screen
        } catch (err: any) {
            console.error(err);
            setError(err.message || "Failed to save settings.");
        } finally {
            setIsLoading(false);
        }
    };

    const toggleSquad = (squad: string) => {
        setSelectedSquads(prev => 
            prev.includes(squad) ? prev.filter(s => s !== squad) : [...prev, squad]
        );
    };

    const addCustomSquad = () => {
        if (customSquadInput.trim() && !selectedSquads.includes(customSquadInput.trim())) {
            setSelectedSquads(prev => [...prev, customSquadInput.trim()]);
        }
        setCustomSquadInput("");
    };

    const addStaffField = () => {
        setStaffInvites([...staffInvites, { name: "", email: "", role: "Coach" }]);
    };

    const updateStaffField = (index: number, field: keyof typeof staffInvites[0], value: string) => {
        const newStaff = [...staffInvites];
        newStaff[index][field] = value;
        setStaffInvites(newStaff);
    };

    const animations = {
        initial: { opacity: 0, x: 20 },
        animate: { opacity: 1, x: 0 },
        exit: { opacity: 0, x: -20 },
        transition: { duration: 0.3 }
    };

    return (
        <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center py-10">
            {/* Wizard Container */}
            <div className="w-full max-w-2xl flex flex-col items-center justify-center p-4 md:p-8">
                <div className="w-full space-y-8 relative z-10">
                    
                    {/* Progress Indicator */}
                    {step <= totalSteps && (
                        <div className="flex justify-between items-center px-4 mb-8 relative">
                            <div className="absolute left-6 right-6 top-1/2 h-0.5 bg-slate-800 -z-10" />
                            {[1, 2, 3, 4, 5, 6, 7].map((num) => (
                                <div key={num} className={`h-8 w-8 rounded-full flex items-center justify-center font-bold text-xs transition-colors duration-300 ${step >= num ? 'bg-red-600 text-white shadow-lg shadow-red-900/50' : 'bg-slate-800 text-slate-500'}`}>
                                    {num}
                                </div>
                            ))}
                        </div>
                    )}

                    <Card className="border-slate-800 bg-slate-900/80 backdrop-blur-md shadow-2xl overflow-hidden relative">
                        {error && (
                            <div className="p-4 bg-red-950/50 border-b border-red-900 text-red-400 flex items-center gap-2">
                                <AlertCircle className="h-4 w-4" />
                                <span className="text-sm font-medium">{error}</span>
                            </div>
                        )}
                        
                        <div className="w-full">
                            <AnimatePresence mode="wait">
                                
                                {/* STEP 1: Identity & Sponsors */}
                                {step === 1 && (
                                    <motion.div key="step1" {...animations} className="flex flex-col h-full">
                                        <CardHeader>
                                            <CardTitle className="text-2xl text-white text-center">Welcome to ClubCore!</CardTitle>
                                            <CardDescription className="text-slate-400 text-center text-lg">
                                                Let's start by establishing your club's identity.
                                            </CardDescription>
                                        </CardHeader>
                                        <CardContent className="space-y-6 pt-4">
                                            <div className="space-y-3">
                                                <Label htmlFor="clubName" className="text-slate-300 text-base">Club Name</Label>
                                                <Input
                                                    id="clubName"
                                                    placeholder="e.g. AFC Richmond"
                                                    required
                                                    value={clubName}
                                                    onChange={(e) => setClubName(e.target.value)}
                                                    className="bg-slate-800 border-slate-700 text-white text-lg h-14 px-4 placeholder:text-slate-500 focus-visible:ring-red-500"
                                                />
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                <div className="space-y-3">
                                                    <Label className="text-slate-300 text-base">Club Badge</Label>
                                                    <div 
                                                        className="relative group cursor-pointer w-full h-32 rounded-xl bg-slate-800 border-2 border-dashed border-slate-600 hover:border-red-500 transition-colors flex items-center justify-center overflow-hidden"
                                                        onPaste={(e) => handlePaste(e, 'logo')}
                                                        tabIndex={0}
                                                    >
                                                        <input 
                                                            type="file" 
                                                            accept="image/*" 
                                                            onChange={(e) => handleFileSelect(e, 'logo')} 
                                                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                                        />
                                                        {logoPreview ? (
                                                            <img src={logoPreview} alt="Preview" className="w-full h-full object-contain p-2" />
                                                        ) : (
                                                            <div className="flex flex-col items-center text-slate-500 group-hover:text-red-400 transition-colors">
                                                                <ImageIcon className="h-8 w-8 mb-2" />
                                                                <span className="font-medium text-xs text-center px-4">Upload Badge</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="space-y-3">
                                                    <Label className="text-slate-300 text-base">Main Sponsor Logo (Optional)</Label>
                                                    <div 
                                                        className="relative group cursor-pointer w-full h-32 rounded-xl bg-slate-800 border-2 border-dashed border-slate-600 hover:border-blue-500 transition-colors flex items-center justify-center overflow-hidden"
                                                        onPaste={(e) => handlePaste(e, 'sponsor')}
                                                        tabIndex={0}
                                                    >
                                                        <input 
                                                            type="file" 
                                                            accept="image/*" 
                                                            onChange={(e) => handleFileSelect(e, 'sponsor')} 
                                                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                                        />
                                                        {sponsorLogoPreview ? (
                                                            <img src={sponsorLogoPreview} alt="Preview" className="w-full h-full object-contain p-2" />
                                                        ) : (
                                                            <div className="flex flex-col items-center text-slate-500 group-hover:text-blue-400 transition-colors">
                                                                <Upload className="h-8 w-8 mb-2" />
                                                                <span className="font-medium text-xs text-center px-4">Upload Sponsor Logo</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </motion.div>
                                )}

                                {/* STEP 2: Colors & Kits */}
                                {step === 2 && (
                                    <motion.div key="step2" {...animations}>
                                        <CardHeader>
                                            <CardTitle className="text-2xl text-white flex items-center gap-2"><Palette className="text-red-500"/> Theme & Kits</CardTitle>
                                            <CardDescription className="text-slate-400 text-lg">
                                                Set your digital app theme and your physical kit colors.
                                            </CardDescription>
                                        </CardHeader>
                                        <CardContent className="space-y-6 pt-4">
                                            <div className="space-y-4">
                                                <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">App Theme Colors</h3>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="space-y-3">
                                                        <Label className="text-slate-300">Primary Color</Label>
                                                        <div className="flex gap-3">
                                                            <Input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="w-14 h-14 p-1 cursor-pointer bg-slate-800 border-slate-700 rounded-lg"/>
                                                        </div>
                                                        <div className="flex flex-wrap gap-2 pt-2">
                                                            {presetColors.map(color => (
                                                                <button key={color} type="button" onClick={() => setPrimaryColor(color)} className={`w-6 h-6 rounded-full border-2 transition-all ${primaryColor.toUpperCase() === color ? 'border-white scale-110' : 'border-slate-700 hover:scale-110'}`} style={{ backgroundColor: color }} title={color}/>
                                                            ))}
                                                        </div>
                                                    </div>
                                                    <div className="space-y-3">
                                                        <Label className="text-slate-300">Secondary Color</Label>
                                                        <div className="flex gap-3">
                                                            <Input type="color" value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} className="w-14 h-14 p-1 cursor-pointer bg-slate-800 border-slate-700 rounded-lg"/>
                                                        </div>
                                                        <div className="flex flex-wrap gap-2 pt-2">
                                                            {presetColors.map(color => (
                                                                <button key={color} type="button" onClick={() => setSecondaryColor(color)} className={`w-6 h-6 rounded-full border-2 transition-all ${secondaryColor.toUpperCase() === color ? 'border-white scale-110' : 'border-slate-700 hover:scale-110'}`} style={{ backgroundColor: color }} title={color}/>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="space-y-4 pt-2 border-t border-slate-800/50">
                                                <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Physical Kit Colors</h3>
                                                <div className="grid grid-cols-2 gap-8">
                                                    <div className="space-y-3">
                                                        <Label className="text-slate-300">Home Kit</Label>
                                                        <div className="flex gap-2">
                                                            <div className="flex flex-col items-center gap-1">
                                                                <Input type="color" value={homeKitShirt} onChange={(e) => setHomeKitShirt(e.target.value)} className="w-10 h-10 p-1 cursor-pointer bg-slate-800 border-slate-700 rounded-lg"/>
                                                                <span className="text-[10px] text-slate-500 uppercase">Shirt</span>
                                                            </div>
                                                            <div className="flex flex-col items-center gap-1">
                                                                <Input type="color" value={homeKitShorts} onChange={(e) => setHomeKitShorts(e.target.value)} className="w-10 h-10 p-1 cursor-pointer bg-slate-800 border-slate-700 rounded-lg"/>
                                                                <span className="text-[10px] text-slate-500 uppercase">Shorts</span>
                                                            </div>
                                                            <div className="flex flex-col items-center gap-1">
                                                                <Input type="color" value={homeKitSocks} onChange={(e) => setHomeKitSocks(e.target.value)} className="w-10 h-10 p-1 cursor-pointer bg-slate-800 border-slate-700 rounded-lg"/>
                                                                <span className="text-[10px] text-slate-500 uppercase">Socks</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="space-y-3">
                                                        <Label className="text-slate-300">Away Kit</Label>
                                                        <div className="flex gap-2">
                                                            <div className="flex flex-col items-center gap-1">
                                                                <Input type="color" value={awayKitShirt} onChange={(e) => setAwayKitShirt(e.target.value)} className="w-10 h-10 p-1 cursor-pointer bg-slate-800 border-slate-700 rounded-lg"/>
                                                                <span className="text-[10px] text-slate-500 uppercase">Shirt</span>
                                                            </div>
                                                            <div className="flex flex-col items-center gap-1">
                                                                <Input type="color" value={awayKitShorts} onChange={(e) => setAwayKitShorts(e.target.value)} className="w-10 h-10 p-1 cursor-pointer bg-slate-800 border-slate-700 rounded-lg"/>
                                                                <span className="text-[10px] text-slate-500 uppercase">Shorts</span>
                                                            </div>
                                                            <div className="flex flex-col items-center gap-1">
                                                                <Input type="color" value={awayKitSocks} onChange={(e) => setAwayKitSocks(e.target.value)} className="w-10 h-10 p-1 cursor-pointer bg-slate-800 border-slate-700 rounded-lg"/>
                                                                <span className="text-[10px] text-slate-500 uppercase">Socks</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </motion.div>
                                )}

                                {/* STEP 3: Details & History */}
                                {step === 3 && (
                                    <motion.div key="step3" {...animations}>
                                        <CardHeader>
                                            <CardTitle className="text-2xl text-white flex items-center gap-2"><MapPin className="text-red-500"/> Details & History</CardTitle>
                                            <CardDescription className="text-slate-400 text-lg">
                                                Where do you play? And what have you won?
                                            </CardDescription>
                                        </CardHeader>
                                        <CardContent className="space-y-6 pt-4 max-h-[400px] overflow-y-auto custom-scrollbar">
                                            <div className="space-y-4">
                                                <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Home Ground</h3>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="space-y-2">
                                                        <Label className="text-slate-400">Ground Name</Label>
                                                        <Input placeholder="e.g. The Emirates" value={homeGroundName} onChange={(e) => setHomeGroundName(e.target.value)} className="bg-slate-800 border-slate-700 text-white" />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label className="text-slate-400">Postcode</Label>
                                                        <Input placeholder="e.g. N5 1BU" value={postcode} onChange={(e) => setPostcode(e.target.value)} className="bg-slate-800 border-slate-700 text-white" />
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            <div className="space-y-4 pt-4 border-t border-slate-800/50">
                                                <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Social Media (Optional)</h3>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="space-y-2">
                                                        <Label className="text-slate-400 flex items-center gap-2"><Twitter className="w-4 h-4 text-sky-500"/> Twitter (X)</Label>
                                                        <Input placeholder="@clubname" value={twitterHandle} onChange={(e) => setTwitterHandle(e.target.value)} className="bg-slate-800 border-slate-700 text-white" />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label className="text-slate-400 flex items-center gap-2"><Instagram className="w-4 h-4 text-pink-500"/> Instagram</Label>
                                                        <Input placeholder="@clubname" value={instagramHandle} onChange={(e) => setInstagramHandle(e.target.value)} className="bg-slate-800 border-slate-700 text-white" />
                                                    </div>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </motion.div>
                                )}

                                {/* STEP 4: Finance & Operations */}
                                {step === 4 && (
                                    <motion.div key="step4" {...animations}>
                                        <CardHeader>
                                            <CardTitle className="text-2xl text-white flex items-center gap-2"><Banknote className="text-green-500"/> Finance & Operations</CardTitle>
                                            <CardDescription className="text-slate-400 text-lg">
                                                Set your baseline subs and club rules.
                                            </CardDescription>
                                        </CardHeader>
                                        <CardContent className="space-y-8 pt-4">
                                            <div className="space-y-3">
                                                <Label className="text-slate-300 text-base">Standard Monthly Player Subs (£)</Label>
                                                <div className="relative">
                                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-lg font-medium">£</span>
                                                    <Input 
                                                        type="number"
                                                        value={monthlySubs}
                                                        onChange={(e) => setMonthlySubs(e.target.value)}
                                                        className="bg-slate-800 border-slate-700 text-white text-lg h-14 pl-10 placeholder:text-slate-500 focus-visible:ring-green-500"
                                                    />
                                                </div>
                                                <p className="text-slate-500 text-sm">We use this to auto-populate your finance dashboard expectations.</p>
                                            </div>

                                            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 flex items-start justify-between gap-4">
                                                <div className="space-y-1.5">
                                                    <Label className="text-white text-base flex items-center gap-2"><ShieldAlert className="w-5 h-5 text-yellow-500"/> Fines System Module</Label>
                                                    <p className="text-slate-400 text-sm leading-relaxed">
                                                        Enable the Fines Tracker module on your dashboard? This allows you to track and collect fines for yellow cards, red cards, lateness, or dirty boots.
                                                    </p>
                                                </div>
                                                <Switch 
                                                    checked={finesEnabled} 
                                                    onCheckedChange={setFinesEnabled}
                                                    className="data-[state=checked]:bg-green-500"
                                                />
                                            </div>
                                        </CardContent>
                                    </motion.div>
                                )}

                                {/* STEP 5: Squads */}
                                {step === 5 && (
                                    <motion.div key="step5" {...animations}>
                                        <CardHeader>
                                            <CardTitle className="text-2xl text-white flex items-center gap-2"><ShieldCheck className="text-red-500"/> Squad Setup</CardTitle>
                                            <CardDescription className="text-slate-400 text-lg">
                                                Which squads do you run? This makes organizing players a breeze.
                                            </CardDescription>
                                        </CardHeader>
                                        <CardContent className="pt-4 space-y-4">
                                            <div className="grid grid-cols-2 gap-3">
                                                {Array.from(new Set([...availableSquads, ...selectedSquads])).map(squad => {
                                                    const isSelected = selectedSquads.includes(squad);
                                                    return (
                                                        <div 
                                                            key={squad}
                                                            onClick={() => toggleSquad(squad)}
                                                            className={`p-4 rounded-xl cursor-pointer border-2 transition-all flex items-center gap-3 ${isSelected ? 'border-red-500 bg-red-500/10' : 'border-slate-700 bg-slate-800/50 hover:border-slate-500'}`}
                                                        >
                                                            <div className={`w-5 h-5 rounded border flex items-center justify-center ${isSelected ? 'bg-red-500 border-red-500' : 'border-slate-500'}`}>
                                                                {isSelected && <CheckCircle2 className="w-4 h-4 text-white" />}
                                                            </div>
                                                            <span className={`font-medium ${isSelected ? 'text-white' : 'text-slate-400'}`}>{squad}</span>
                                                        </div>
                                                    )
                                                })}
                                            </div>

                                            <div className="flex gap-2 pt-2 border-t border-slate-800/50">
                                                <Input 
                                                    placeholder="Add a custom squad (e.g. Under-12s)"
                                                    value={customSquadInput}
                                                    onChange={(e) => setCustomSquadInput(e.target.value)}
                                                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomSquad(); } }}
                                                    className="bg-slate-800 border-slate-700 text-white"
                                                />
                                                <Button 
                                                    type="button" 
                                                    onClick={addCustomSquad}
                                                    className="bg-slate-700 hover:bg-slate-600 text-white"
                                                >
                                                    Add
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </motion.div>
                                )}

                                {/* STEP 6: Committee & Staff */}
                                {step === 6 && (
                                    <motion.div key="step6" {...animations}>
                                        <CardHeader>
                                            <CardTitle className="text-2xl text-white flex items-center gap-2"><Users className="text-red-500"/> Committee & Staff</CardTitle>
                                            <CardDescription className="text-slate-400 text-lg">
                                                Teamwork makes the dream work. Add your committee members, coaches, or admins.
                                            </CardDescription>
                                        </CardHeader>
                                        <CardContent className="space-y-4 pt-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                                            {staffInvites.map((staff, idx) => (
                                                <div key={idx} className="bg-slate-800 p-4 rounded-xl border border-slate-700 space-y-3 relative group">
                                                    <div className="flex gap-3">
                                                        <div className="flex-1 space-y-1.5">
                                                            <Label className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Name</Label>
                                                            <Input 
                                                                placeholder="e.g. Roy Kent" 
                                                                value={staff.name}
                                                                onChange={(e) => updateStaffField(idx, 'name', e.target.value)}
                                                                className="bg-slate-900 border-slate-700 text-white" 
                                                            />
                                                        </div>
                                                        <div className="w-1/3 space-y-1.5">
                                                            <Label className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Role</Label>
                                                            <Input 
                                                                placeholder="Role" 
                                                                value={staff.role}
                                                                onChange={(e) => updateStaffField(idx, 'role', e.target.value)}
                                                                className="bg-slate-900 border-slate-700 text-white" 
                                                            />
                                                        </div>
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <Label className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Email Address</Label>
                                                        <Input 
                                                            type="email"
                                                            placeholder="coach@example.com" 
                                                            value={staff.email}
                                                            onChange={(e) => updateStaffField(idx, 'email', e.target.value)}
                                                            className="bg-slate-900 border-slate-700 text-white" 
                                                        />
                                                    </div>
                                                </div>
                                            ))}
                                            <Button 
                                                type="button" 
                                                variant="outline" 
                                                onClick={addStaffField}
                                                className="w-full border-dashed border-2 border-slate-700 bg-transparent text-slate-400 hover:text-white hover:bg-slate-800 h-12"
                                            >
                                                + Add Another
                                            </Button>
                                        </CardContent>
                                    </motion.div>
                                )}

                                {/* STEP 7: League Table */}
                                {step === 7 && (
                                    <motion.div key="step7" {...animations}>
                                        <CardHeader>
                                            <CardTitle className="text-2xl text-white flex items-center gap-2"><Trophy className="text-red-500"/> League Standings</CardTitle>
                                            <CardDescription className="text-slate-400 text-lg">
                                                Paste the public URL to your league's official standings page so we can pull it directly into your dashboard.
                                            </CardDescription>
                                        </CardHeader>
                                        <CardContent className="space-y-6 pt-4">
                                            <div className="space-y-3">
                                                <Label htmlFor="leagueUrl" className="text-slate-300 text-base">League Table URL (Optional)</Label>
                                                <Input
                                                    id="leagueUrl"
                                                    placeholder="e.g. https://fulltime.thefa.com/... or any league website"
                                                    value={leagueUrl}
                                                    onChange={(e) => setLeagueUrl(e.target.value)}
                                                    className="bg-slate-800 border-slate-700 text-white text-lg h-14 px-4 placeholder:text-slate-500 focus-visible:ring-red-500"
                                                />
                                            </div>
                                        </CardContent>
                                    </motion.div>
                                )}

                                {/* STEP 8: Complete */}
                                {step === 8 && (
                                    <motion.div key="step8" {...animations} className="text-center">
                                        <CardHeader className="pt-12 pb-6">
                                            <div className="mx-auto w-24 h-24 bg-green-500/20 rounded-full flex items-center justify-center mb-6">
                                                <CheckCircle2 className="h-12 w-12 text-green-500" />
                                            </div>
                                            <CardTitle className="text-3xl text-white">You're all set!</CardTitle>
                                            <CardDescription className="text-slate-400 text-lg mt-2">
                                                Your secure ClubCore is ready for action.
                                            </CardDescription>
                                        </CardHeader>
                                        <CardFooter className="bg-slate-950/50 p-8 border-t border-slate-800 mt-4">
                                            <Button 
                                                type="button"
                                                onClick={() => router.push('/dashboard')}
                                                className="w-full bg-red-600 hover:bg-red-700 text-white font-medium h-14 text-xl shadow-lg shadow-red-900/50"
                                            >
                                                Enter Dashboard
                                            </Button>
                                        </CardFooter>
                                    </motion.div>
                                )}

                            </AnimatePresence>

                            {/* Global Footer Navigation */}
                            {step < 8 && (
                                <CardFooter className="bg-slate-950/50 p-6 border-t border-slate-800 flex justify-between gap-4 relative z-20">
                                    {step > 1 ? (
                                        <Button 
                                            type="button" 
                                            variant="ghost" 
                                            onClick={handleBack}
                                            className="text-slate-400 hover:text-white"
                                            disabled={isLoading}
                                        >
                                            Back
                                        </Button>
                                    ) : (
                                        <div></div>
                                    )}
                                    <div className="flex gap-3">
                                        {step > 1 && step < totalSteps && (
                                            <Button 
                                                type="button" 
                                                variant="outline"
                                                onClick={handleSkip}
                                                className="border-slate-600 bg-slate-800 text-white hover:bg-slate-700 font-medium shadow-md h-12"
                                                disabled={isLoading}
                                            >
                                                Skip for now
                                            </Button>
                                        )}
                                        <Button 
                                            type="button" 
                                            onClick={handleSaveAndNext}
                                            className="bg-red-600 hover:bg-red-700 text-white font-medium px-8 h-12"
                                            disabled={isLoading}
                                        >
                                            {isLoading ? "Saving..." : step === totalSteps ? "Finish Setup" : "Next"} <ChevronRight className="ml-2 w-4 h-4" />
                                        </Button>
                                    </div>
                                </CardFooter>
                            )}
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
}
