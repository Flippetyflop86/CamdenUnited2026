"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Upload, CheckCircle2, ChevronRight, Image as ImageIcon } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useClub } from "@/context/club-context";
import { useAuth } from "@/context/auth-context";

export default function OnboardingWizard() {
    const { settings, updateSettings } = useClub();
    const { user } = useAuth();
    const router = useRouter();

    const [step, setStep] = useState(1);
    const [clubName, setClubName] = useState(settings.name);
    const [logoFile, setLogoFile] = useState<File | null>(null);
    const [logoPreview, setLogoPreview] = useState<string | null>(null);
    const [leagueUrl, setLeagueUrl] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");

    const handleNameSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!clubName.trim()) {
            setError("Club name cannot be empty.");
            return;
        }
        setError("");
        setIsLoading(true);
        try {
            await updateSettings({ name: clubName });
            setStep(2);
        } catch (err: any) {
            setError("Failed to update club name.");
        } finally {
            setIsLoading(false);
        }
    };

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

    const handleLogoSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setIsLoading(true);

        try {
            if (logoFile && user) {
                // Upload to Supabase Storage
                const fileExt = logoFile.name.split('.').pop() || 'png';
                const fileName = `${user.id}-${Math.random()}.${fileExt}`;
                const filePath = `${fileName}`;

                const { error: uploadError, data } = await supabase.storage
                    .from('club_logos')
                    .upload(filePath, logoFile, { upsert: true });

                if (uploadError) throw uploadError;

                // Get public URL
                const { data: publicUrlData } = supabase.storage
                    .from('club_logos')
                    .getPublicUrl(filePath);

                await updateSettings({ logo: publicUrlData.publicUrl });
            }
            
            // Move to league step
            setStep(3);
        } catch (err: any) {
            console.error(err);
            setError(err.message || "Failed to upload logo.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleLeagueSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setIsLoading(true);

        try {
            let scrapedPosition = null;

            if (leagueUrl) {
                // Try to scrape the position
                const res = await fetch('/api/sync-league', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url: leagueUrl, clubName: settings.name })
                });

                const data = await res.json();
                
                if (data.success && data.position) {
                    scrapedPosition = data.position;
                } else if (!data.success && data.error) {
                    setError(data.error);
                    setIsLoading(false);
                    return; // Stop and let them fix it
                }
            }

            await updateSettings({ 
                leagueUrl: leagueUrl || null, 
                leaguePosition: scrapedPosition 
            });
            setStep(4);
        } catch (err: any) {
            setError("Failed to save league settings.");
        } finally {
            setIsLoading(false);
        }
    };

    const finishOnboarding = async () => {
        setIsLoading(true);
        try {
            await updateSettings({ isOnboarded: true });
            router.push("/dashboard");
        } catch (err) {
            setError("Failed to finalize onboarding.");
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-xl space-y-8">
                
                {/* Progress Indicator */}
                <div className="flex justify-between items-center px-8 mb-8 relative">
                    <div className="absolute left-10 right-10 top-1/2 h-0.5 bg-slate-800 -z-10" />
                    {[1, 2, 3, 4].map((num) => (
                        <div key={num} className={`h-10 w-10 rounded-full flex items-center justify-center font-bold text-sm transition-colors ${step >= num ? 'bg-red-600 text-white' : 'bg-slate-800 text-slate-500'}`}>
                            {num}
                        </div>
                    ))}
                </div>

                <Card className="border-slate-800 bg-slate-900 shadow-xl overflow-hidden">
                    {/* STEP 1: Name */}
                    {step === 1 && (
                        <form onSubmit={handleNameSubmit}>
                            <CardHeader>
                                <CardTitle className="text-2xl text-white text-center">Welcome to your workspace!</CardTitle>
                                <CardDescription className="text-slate-400 text-center text-lg">
                                    Let's start by confirming your club's name.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6 pt-4">
                                {error && (
                                    <Alert variant="destructive" className="bg-red-950/50 border-red-900 text-red-400">
                                        <AlertCircle className="h-4 w-4" />
                                        <AlertDescription>{error}</AlertDescription>
                                    </Alert>
                                )}
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
                            </CardContent>
                            <CardFooter className="bg-slate-950/50 p-6 border-t border-slate-800">
                                <Button 
                                    type="submit" 
                                    className="w-full bg-red-600 hover:bg-red-700 text-white font-medium h-12 text-lg"
                                    disabled={isLoading}
                                >
                                    Continue <ChevronRight className="ml-2 h-5 w-5" />
                                </Button>
                            </CardFooter>
                        </form>
                    )}

                    {/* STEP 2: Logo */}
                    {step === 2 && (
                        <form onSubmit={handleLogoSubmit}>
                            <CardHeader>
                                <CardTitle className="text-2xl text-white text-center">Upload your Badge</CardTitle>
                                <CardDescription className="text-slate-400 text-center text-lg">
                                    Click, tap, or paste a screenshot directly here.
                                </CardDescription>
                            </CardHeader>
                            <CardContent 
                                className="space-y-6 pt-4 flex flex-col items-center outline-none focus:outline-none" 
                                onPaste={handlePaste}
                                tabIndex={0}
                            >
                                {error && (
                                    <Alert variant="destructive" className="w-full bg-red-950/50 border-red-900 text-red-400">
                                        <AlertCircle className="h-4 w-4" />
                                        <AlertDescription>{error}</AlertDescription>
                                    </Alert>
                                )}
                                
                                <div className="relative group cursor-pointer w-48 h-48 rounded-2xl bg-slate-800 border-2 border-dashed border-slate-600 hover:border-red-500 transition-colors flex items-center justify-center overflow-hidden">
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
                                            <ImageIcon className="h-12 w-12 mb-2" />
                                            <span className="font-medium text-center px-4">Choose File or Paste Screenshot</span>
                                        </div>
                                    )}
                                </div>
                                {logoFile && <p className="text-slate-300 text-sm font-medium">{logoFile.name}</p>}

                            </CardContent>
                            <CardFooter className="bg-slate-950/50 p-6 border-t border-slate-800 flex gap-4">
                                <Button 
                                    type="button" 
                                    variant="outline"
                                    onClick={() => setStep(3)} // Skip
                                    className="w-1/3 border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white h-12"
                                    disabled={isLoading}
                                >
                                    Skip
                                </Button>
                                <Button 
                                    type="submit" 
                                    className="w-2/3 bg-red-600 hover:bg-red-700 text-white font-medium h-12 text-lg"
                                    disabled={isLoading}
                                >
                                    {isLoading ? "Uploading..." : "Save Badge"} <ChevronRight className="ml-2 h-5 w-5" />
                                </Button>
                            </CardFooter>
                        </form>
                    )}

                    {/* STEP 3: League Table */}
                    {step === 3 && (
                        <form onSubmit={handleLeagueSubmit}>
                            <CardHeader>
                                <CardTitle className="text-2xl text-white text-center">League Standings</CardTitle>
                                <CardDescription className="text-slate-400 text-center text-lg">
                                    Track your progress right from the dashboard.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6 pt-4">
                                {error && (
                                    <Alert variant="destructive" className="bg-red-950/50 border-red-900 text-red-400">
                                        <AlertCircle className="h-4 w-4" />
                                        <AlertDescription>{error}</AlertDescription>
                                    </Alert>
                                )}
                                
                                <div className="space-y-3">
                                    <Label htmlFor="leagueUrl" className="text-slate-300 text-base">League Table URL</Label>
                                    <Input
                                        id="leagueUrl"
                                        placeholder="e.g. https://fulltime.thefa.com/..."
                                        value={leagueUrl}
                                        onChange={(e) => setLeagueUrl(e.target.value)}
                                        className="bg-slate-800 border-slate-700 text-white text-lg h-14 px-4 placeholder:text-slate-500 focus-visible:ring-red-500"
                                    />
                                    <p className="text-sm text-slate-500">Paste the link to your FA Full-Time or Mitoo league table.</p>
                                </div>
                            </CardContent>
                            <CardFooter className="bg-slate-950/50 p-6 border-t border-slate-800 flex gap-4">
                                <Button 
                                    type="button" 
                                    variant="outline"
                                    onClick={() => setStep(4)} // Skip
                                    className="w-1/3 border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white h-12"
                                    disabled={isLoading}
                                >
                                    Skip
                                </Button>
                                <Button 
                                    type="submit" 
                                    className="w-2/3 bg-red-600 hover:bg-red-700 text-white font-medium h-12 text-lg"
                                    disabled={isLoading}
                                >
                                    {isLoading ? "Saving..." : "Continue"} <ChevronRight className="ml-2 h-5 w-5" />
                                </Button>
                            </CardFooter>
                        </form>
                    )}

                    {/* STEP 4: Complete */}
                    {step === 4 && (
                        <div className="text-center">
                            <CardHeader className="pt-12 pb-6">
                                <div className="mx-auto w-24 h-24 bg-green-500/20 rounded-full flex items-center justify-center mb-6">
                                    <CheckCircle2 className="h-12 w-12 text-green-500" />
                                </div>
                                <CardTitle className="text-3xl text-white">You're all set!</CardTitle>
                                <CardDescription className="text-slate-400 text-lg mt-2">
                                    Your secure, isolated workspace is ready for action.
                                </CardDescription>
                            </CardHeader>
                            <CardFooter className="bg-slate-950/50 p-8 border-t border-slate-800 mt-4">
                                <Button 
                                    onClick={finishOnboarding}
                                    className="w-full bg-red-600 hover:bg-red-700 text-white font-medium h-14 text-xl shadow-lg shadow-red-900/50"
                                    disabled={isLoading}
                                >
                                    Enter Dashboard
                                </Button>
                            </CardFooter>
                        </div>
                    )}
                </Card>
            </div>
        </div>
    );
}
