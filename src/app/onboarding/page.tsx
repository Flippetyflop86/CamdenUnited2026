"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Upload, CheckCircle2, ChevronRight, Image as ImageIcon, Users, Palette, Trophy, ShieldCheck } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useClub } from "@/context/club-context";
import { useAuth } from "@/context/auth-context";
import { motion, AnimatePresence } from "framer-motion";

export default function OnboardingWizard() {
    const { settings, updateSettings } = useClub();
    const { user } = useAuth();
    const router = useRouter();

    const [step, setStep] = useState(1);
    const [clubName, setClubName] = useState(settings.name);
    const [logoFile, setLogoFile] = useState<File | null>(null);
    const [logoPreview, setLogoPreview] = useState<string | null>(settings.logo);
    
    const [primaryColor, setPrimaryColor] = useState(settings.primaryColor || "#ef4444");
    const [secondaryColor, setSecondaryColor] = useState(settings.secondaryColor || "#0f172a");

    const availableSquads = ["First Team", "Reserves", "Under-18s", "Under-16s", "Women's Team", "Academy"];
    const [selectedSquads, setSelectedSquads] = useState<string[]>(settings.squads || ["First Team", "Reserves"]);
    
    const [staffInvites, setStaffInvites] = useState([{ name: "", email: "", role: "Assistant Manager" }]);
    const [leagueUrl, setLeagueUrl] = useState(settings.leagueUrl || "");
    
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");

    const totalSteps = 5;

    const handleNext = () => setStep(prev => prev + 1);
    const handleBack = () => setStep(prev => prev - 1);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setLogoFile(file);
            setLogoPreview(URL.createObjectURL(file));
        }
    };

    const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
        const items = e.clipboardData?.items;
        if (!items) return;

        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf("image") !== -1) {
                const file = items[i].getAsFile();
                if (file) {
                    setLogoFile(file);
                    setLogoPreview(URL.createObjectURL(file));
                    e.preventDefault();
                    break;
                }
            }
        }
    };

    const uploadLogoIfAny = async () => {
        if (logoFile && user) {
            const fileExt = logoFile.name.split('.').pop() || 'png';
            const fileName = `${user.id}-${Math.random()}.${fileExt}`;
            const filePath = `${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('club_logos')
                .upload(filePath, logoFile, { upsert: true });

            if (uploadError) throw uploadError;

            const { data: publicUrlData } = supabase.storage
                .from('club_logos')
                .getPublicUrl(filePath);

            return publicUrlData.publicUrl;
        }
        return logoPreview;
    };

    const handleSaveAndNext = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        
        if (step === 1 && !clubName.trim()) {
            setError("Club name cannot be empty.");
            return;
        }

        if (step === 3 && selectedSquads.length === 0) {
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
            const finalLogoUrl = await uploadLogoIfAny();

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
                isOnboarded: true 
            });

            setStep(6); // Success screen
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
        <div className="min-h-screen bg-slate-900 flex flex-col md:flex-row">
            {/* Left side: Wizard */}
            <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-8 overflow-y-auto">
                <div className="w-full max-w-xl space-y-8 relative z-10">
                    
                    {/* Progress Indicator */}
                    {step <= totalSteps && (
                        <div className="flex justify-between items-center px-4 mb-8 relative">
                            <div className="absolute left-6 right-6 top-1/2 h-0.5 bg-slate-800 -z-10" />
                            {[1, 2, 3, 4, 5].map((num) => (
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
                        
                        <form onSubmit={handleSaveAndNext}>
                            <AnimatePresence mode="wait">
                                
                                {/* STEP 1: Identity */}
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
                                            <div className="space-y-3">
                                                <Label className="text-slate-300 text-base">Club Badge</Label>
                                                <div 
                                                    className="relative group cursor-pointer w-full h-40 rounded-xl bg-slate-800 border-2 border-dashed border-slate-600 hover:border-red-500 transition-colors flex items-center justify-center overflow-hidden"
                                                    onPaste={handlePaste}
                                                    tabIndex={0}
                                                >
                                                    <input 
                                                        type="file" 
                                                        accept="image/*" 
                                                        onChange={handleFileSelect} 
                                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                                    />
                                                    {logoPreview ? (
                                                        <img src={logoPreview} alt="Preview" className="w-full h-full object-contain p-2" />
                                                    ) : (
                                                        <div className="flex flex-col items-center text-slate-500 group-hover:text-red-400 transition-colors">
                                                            <ImageIcon className="h-10 w-10 mb-2" />
                                                            <span className="font-medium text-center px-4">Click to upload or Paste screenshot</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </CardContent>
                                    </motion.div>
                                )}

                                {/* STEP 2: Colors */}
                                {step === 2 && (
                                    <motion.div key="step2" {...animations}>
                                        <CardHeader>
                                            <CardTitle className="text-2xl text-white flex items-center gap-2"><Palette className="text-red-500"/> Theme & Colors</CardTitle>
                                            <CardDescription className="text-slate-400 text-lg">
                                                Make the platform feel like home. These colors will be used across your dashboard.
                                            </CardDescription>
                                        </CardHeader>
                                        <CardContent className="space-y-6 pt-4">
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-3">
                                                    <Label className="text-slate-300">Primary Color</Label>
                                                    <div className="flex gap-3">
                                                        <Input
                                                            type="color"
                                                            value={primaryColor}
                                                            onChange={(e) => setPrimaryColor(e.target.value)}
                                                            className="w-14 h-14 p-1 cursor-pointer bg-slate-800 border-slate-700 rounded-lg"
                                                        />
                                                        <Input 
                                                            type="text" 
                                                            value={primaryColor}
                                                            onChange={(e) => setPrimaryColor(e.target.value)}
                                                            className="flex-1 bg-slate-800 border-slate-700 text-white h-14 font-mono uppercase"
                                                        />
                                                    </div>
                                                </div>
                                                <div className="space-y-3">
                                                    <Label className="text-slate-300">Secondary Color</Label>
                                                    <div className="flex gap-3">
                                                        <Input
                                                            type="color"
                                                            value={secondaryColor}
                                                            onChange={(e) => setSecondaryColor(e.target.value)}
                                                            className="w-14 h-14 p-1 cursor-pointer bg-slate-800 border-slate-700 rounded-lg"
                                                        />
                                                        <Input 
                                                            type="text" 
                                                            value={secondaryColor}
                                                            onChange={(e) => setSecondaryColor(e.target.value)}
                                                            className="flex-1 bg-slate-800 border-slate-700 text-white h-14 font-mono uppercase"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </motion.div>
                                )}

                                {/* STEP 3: Squads */}
                                {step === 3 && (
                                    <motion.div key="step3" {...animations}>
                                        <CardHeader>
                                            <CardTitle className="text-2xl text-white flex items-center gap-2"><ShieldCheck className="text-red-500"/> Squad Setup</CardTitle>
                                            <CardDescription className="text-slate-400 text-lg">
                                                Which squads do you run? This makes organizing players a breeze.
                                            </CardDescription>
                                        </CardHeader>
                                        <CardContent className="pt-4">
                                            <div className="grid grid-cols-2 gap-3">
                                                {availableSquads.map(squad => {
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
                                        </CardContent>
                                    </motion.div>
                                )}

                                {/* STEP 4: Staff Invites */}
                                {step === 4 && (
                                    <motion.div key="step4" {...animations}>
                                        <CardHeader>
                                            <CardTitle className="text-2xl text-white flex items-center gap-2"><Users className="text-red-500"/> Invite Coaching Staff</CardTitle>
                                            <CardDescription className="text-slate-400 text-lg">
                                                Teamwork makes the dream work. Add your assistants, physios, or admins.
                                            </CardDescription>
                                        </CardHeader>
                                        <CardContent className="space-y-4 pt-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                                            {staffInvites.map((staff, idx) => (
                                                <div key={idx} className="bg-slate-800 p-4 rounded-xl border border-slate-700 space-y-3">
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

                                {/* STEP 5: League Table */}
                                {step === 5 && (
                                    <motion.div key="step5" {...animations}>
                                        <CardHeader>
                                            <CardTitle className="text-2xl text-white flex items-center gap-2"><Trophy className="text-red-500"/> League Standings</CardTitle>
                                            <CardDescription className="text-slate-400 text-lg">
                                                Paste your FA Full-Time link so we can pull your standings directly into your dashboard.
                                            </CardDescription>
                                        </CardHeader>
                                        <CardContent className="space-y-6 pt-4">
                                            <div className="space-y-3">
                                                <Label htmlFor="leagueUrl" className="text-slate-300 text-base">League Table URL (Optional)</Label>
                                                <Input
                                                    id="leagueUrl"
                                                    placeholder="https://fulltime.thefa.com/..."
                                                    value={leagueUrl}
                                                    onChange={(e) => setLeagueUrl(e.target.value)}
                                                    className="bg-slate-800 border-slate-700 text-white text-lg h-14 px-4 placeholder:text-slate-500 focus-visible:ring-red-500"
                                                />
                                            </div>
                                        </CardContent>
                                    </motion.div>
                                )}

                                {/* STEP 6: Complete */}
                                {step === 6 && (
                                    <motion.div key="step6" {...animations} className="text-center">
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
                            {step < 6 && (
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
                                    <Button 
                                        type="submit" 
                                        className="bg-red-600 hover:bg-red-700 text-white font-medium px-8 h-12"
                                        disabled={isLoading}
                                    >
                                        {isLoading ? "Saving..." : step === totalSteps ? "Finish Setup" : "Next"} <ChevronRight className="ml-2 w-4 h-4" />
                                    </Button>
                                </CardFooter>
                            )}
                        </form>
                    </Card>
                </div>
            </div>

            {/* Right side: Live Preview (Hidden on mobile) */}
            <div className="hidden md:flex md:w-1/2 lg:w-[45%] bg-slate-950 items-center justify-center p-8 border-l border-slate-800 relative overflow-hidden">
                {/* Background decorative elements based on selected colors */}
                <div className="absolute inset-0 opacity-20 pointer-events-none transition-colors duration-700" style={{ backgroundImage: `radial-gradient(circle at top right, ${primaryColor}, transparent 50%), radial-gradient(circle at bottom left, ${secondaryColor}, transparent 50%)`}}></div>
                
                <div className="w-full max-w-sm space-y-6 relative z-10">
                    <div className="text-center mb-8">
                        <span className="text-slate-500 font-medium tracking-widest uppercase text-sm border border-slate-800 px-4 py-1.5 rounded-full bg-slate-900/50 backdrop-blur-sm">Live Preview</span>
                    </div>

                    {/* Preview Dashboard Card */}
                    <div className="bg-slate-900 rounded-2xl shadow-2xl border border-slate-800 overflow-hidden transform hover:scale-[1.02] transition-transform duration-300">
                        {/* Header preview themed with colors */}
                        <div className="h-24 transition-colors duration-500" style={{ backgroundColor: secondaryColor }}>
                            <div className="h-full w-full opacity-20" style={{ backgroundImage: `linear-gradient(45deg, ${primaryColor} 25%, transparent 25%, transparent 75%, ${primaryColor} 75%, ${primaryColor}), linear-gradient(45deg, ${primaryColor} 25%, transparent 25%, transparent 75%, ${primaryColor} 75%, ${primaryColor})`, backgroundSize: '20px 20px', backgroundPosition: '0 0, 10px 10px' }}></div>
                        </div>
                        
                        <div className="px-6 pb-6 pt-0 relative">
                            {/* Logo */}
                            <div className="absolute -top-12 left-6 w-24 h-24 rounded-2xl bg-slate-800 border-4 border-slate-900 shadow-xl overflow-hidden flex items-center justify-center">
                                {logoPreview ? (
                                    <img src={logoPreview} alt="Preview" className="w-full h-full object-contain bg-white" />
                                ) : (
                                    <ShieldCheck className="w-10 h-10 text-slate-500" />
                                )}
                            </div>
                            
                            <div className="mt-14 space-y-4">
                                <div>
                                    <h3 className="text-xl font-bold text-white transition-all">{clubName || "Your Club Name"}</h3>
                                    <p className="text-sm text-slate-400 mt-1">Dashboard Ready</p>
                                </div>

                                <div className="space-y-2 pt-2 border-t border-slate-800/50">
                                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active Squads</p>
                                    <div className="flex flex-wrap gap-2">
                                        {selectedSquads.length > 0 ? selectedSquads.map(sq => (
                                            <span key={sq} className="text-xs px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700">{sq}</span>
                                        )) : (
                                            <span className="text-xs px-2.5 py-1 rounded-full border border-dashed border-slate-700 text-slate-500">None selected</span>
                                        )}
                                    </div>
                                </div>

                                <div className="pt-4">
                                    <div className="h-10 rounded-lg w-full transition-colors duration-500 flex items-center justify-center" style={{ backgroundColor: primaryColor }}>
                                        <span className="text-white font-medium text-sm">Main Action Button</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
