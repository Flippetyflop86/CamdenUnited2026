"use client";

import { useState, useRef, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Upload, CheckCircle2, ChevronRight, Image as ImageIcon, Users, Palette, Trophy, ShieldCheck, MapPin, Twitter, Instagram, Banknote, ShieldAlert, Award, Plus, Trash2, Shield, FileText, Target, TrendingUp, Briefcase, ClipboardList } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useClub } from "@/context/club-context";
import { useAuth } from "@/context/auth-context";
import { motion, AnimatePresence } from "framer-motion";
import { ALL_PAGE_PERMISSIONS } from "@/lib/permissions";


const ROLE_TABS: Record<string, string[]> = {
    "manager/coach": ["squad", "training", "matches", "matchday-xi", "analysis", "opposition", "league", "staff", "documents"],
    "secretary": ["squad", "matches", "league", "sponsors", "finance", "staff", "documents", "inventory"],
    "analyst": ["squad", "matches", "matchday-xi", "analysis", "opposition", "league"],
    "chairperson": ["squad", "matches", "league", "sponsors", "finance", "budgets", "staff", "documents"]
};

const presetColors = [
    { name: "White", value: "#ffffff" },
    { name: "Dark Slate", value: "#1e293b" },
    { name: "Classic Red", value: "#ef4444" },
    { name: "Royal Blue", value: "#3b82f6" },
    { name: "Emerald Green", value: "#10b981" },
    { name: "Gold Yellow", value: "#eab308" },
    { name: "Club Orange", value: "#f97316" },
    { name: "Deep Purple", value: "#8b5cf6" },
    { name: "Navy Blue", value: "#1e3a8a" },
    { name: "Burgundy", value: "#7f1d1d" }
];

export default function OnboardingWizard() {
    const { settings, updateSettings, isLoaded } = useClub();
    const { user, signOut, clubId } = useAuth();
    const router = useRouter();

    const [step, setStep] = useState(0);

    const getCached = (key: string) => {
        if (typeof window !== 'undefined') {
            return sessionStorage.getItem(`clubflow_onboarding_${key}`);
        }
        return null;
    };
    
    // Step 1: Branding
    const [clubName, setClubName] = useState(() => getCached("clubName") ?? settings.name ?? "");
    const [managerName, setManagerName] = useState(() => getCached("managerName") ?? user?.user_metadata?.full_name ?? "");
    const [logoFile, setLogoFile] = useState<File | null>(null);
    const [logoPreview, setLogoPreview] = useState<string | null>(() => settings.logo ?? null);
    const [sponsorLogoFile, setSponsorLogoFile] = useState<File | null>(null);
    const [sponsorLogoPreview, setSponsorLogoPreview] = useState<string | null>(() => settings.sponsorLogo ?? null);
    const [primaryColor, setPrimaryColor] = useState(() => getCached("primaryColor") ?? settings.primaryColor ?? "#ef4444");

    // Step 2 & 3: Role and Tabs
    const [selectedRole, setSelectedRole] = useState(() => getCached("selectedRole") ?? "");
    const [selectedTabs, setSelectedTabs] = useState<string[]>(() => {
        const cached = getCached("selectedTabs");
        return cached ? JSON.parse(cached) : [];
    });

    // Step 2: Kits
    const [homeKitShirt, setHomeKitShirt] = useState(() => getCached("homeKitShirt") ?? settings.homeKitShirt ?? "#ffffff");
    const [homeKitShorts, setHomeKitShorts] = useState(() => getCached("homeKitShorts") ?? settings.homeKitShorts ?? "#ffffff");
    const [homeKitSocks, setHomeKitSocks] = useState(() => getCached("homeKitSocks") ?? settings.homeKitSocks ?? "#ffffff");
    const [awayKitShirt, setAwayKitShirt] = useState(() => getCached("awayKitShirt") ?? settings.awayKitShirt ?? "#1e293b");
    const [awayKitShorts, setAwayKitShorts] = useState(() => getCached("awayKitShorts") ?? settings.awayKitShorts ?? "#1e293b");
    const [awayKitSocks, setAwayKitSocks] = useState(() => getCached("awayKitSocks") ?? settings.awayKitSocks ?? "#1e293b");

    // Step 3: Details & History
    const [homeGroundName, setHomeGroundName] = useState(() => getCached("homeGroundName") ?? settings.homeGround ?? "");
    const [postcode, setPostcode] = useState("");
    const [twitterHandle, setTwitterHandle] = useState(() => getCached("twitterHandle") ?? settings.twitterUrl ?? "");
    const [instagramHandle, setInstagramHandle] = useState(() => getCached("instagramHandle") ?? settings.instagramUrl ?? "");
    const [whatsappPollMessage, setWhatsAppPollMessage] = useState(() => getCached("whatsappPollMessage") ?? settings.whatsappPollMessage ?? "");
    const [trainingLocation, setTrainingLocation] = useState(() => getCached("trainingLocation") ?? settings.trainingLocation ?? "");

    // Step 4: Finance & Operations
    const [monthlySubs, setMonthlySubs] = useState(() => getCached("monthlySubs") ?? settings.monthlySubs?.toString() ?? "35");
    const [subsEnabled, setSubsEnabled] = useState(() => {
        const cached = getCached("subsEnabled");
        if (cached !== null) return cached === "true";
        return settings.subsEnabled !== undefined ? settings.subsEnabled : (parseFloat(settings.monthlySubs?.toString() || "0") > 0);
    });
    const [contractsEnabled, setContractsEnabled] = useState(() => {
        const cached = getCached("contractsEnabled");
        if (cached !== null) return cached === "true";
        return settings.contractsEnabled !== undefined ? settings.contractsEnabled : false;
    });
    const [registrationFee, setRegistrationFee] = useState(() => getCached("registrationFee") ?? settings.registrationFee?.toString() ?? "0");
    const [trainingFeePerSession, setTrainingFeePerSession] = useState(() => getCached("trainingFeePerSession") ?? settings.trainingFeePerSession?.toString() ?? "5");
    const [matchdayFee, setMatchdayFee] = useState(() => getCached("matchdayFee") ?? "10");
    const [subsStructure, setSubsStructure] = useState<"Monthly" | "Training" | "Matchday" | "Both">((getCached("subsStructure") as any) ?? "Monthly");
    const [finesEnabled, setFinesEnabled] = useState(() => {
        const cached = getCached("finesEnabled");
        if (cached !== null) return cached === "true";
        return settings.finesEnabled || false;
    });

    // Step 5: Squads
    const availableSquads = ["First Team", "Reserves", "Under-18s", "Under-16s", "Women's Team", "Academy", "Pan-Disability", "Midweek", "Youth"];
    const [selectedSquads, setSelectedSquads] = useState<string[]>(() => {
        const cached = getCached("selectedSquads");
        if (cached) return JSON.parse(cached);
        return settings.isOnboarded ? (settings.squads || ["First Team"]) : ["First Team"];
    });
    const [customSquadInput, setCustomSquadInput] = useState("");

    // Step 6: Committee & Staff
    const [staffInvites, setStaffInvites] = useState([
        { name: "", email: "", role: "Chairman" },
        { name: "", email: "", role: "Secretary" },
        { name: "", email: "", role: "Treasurer" }
    ]);

    // Step 7: League
    const [leagueUrl, setLeagueUrl] = useState(() => getCached("leagueUrl") ?? settings.leagueUrl ?? "");

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const [isDragOver, setIsDragOver] = useState(false);
    const [isSponsorDragOver, setIsSponsorDragOver] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const sponsorInputRef = useRef<HTMLInputElement>(null);

    const totalSteps = 9;
    const hasInitialized = useRef(false);

    useEffect(() => {
        if (isLoaded && settings && !hasInitialized.current) {
            const getCached = (key: string) => sessionStorage.getItem(`clubflow_onboarding_${key}`);
            
            setClubName(getCached("clubName") ?? settings.name ?? "");
            setManagerName(getCached("managerName") ?? user?.user_metadata?.full_name ?? "");
            setLogoPreview(settings.logo);
            setSponsorLogoPreview(settings.sponsorLogo);
            setPrimaryColor(getCached("primaryColor") ?? settings.primaryColor ?? "#ef4444");
            setHomeKitShirt(getCached("homeKitShirt") ?? settings.homeKitShirt ?? "#ffffff");
            setHomeKitShorts(getCached("homeKitShorts") ?? settings.homeKitShorts ?? "#ffffff");
            setHomeKitSocks(getCached("homeKitSocks") ?? settings.homeKitSocks ?? "#ffffff");
            setAwayKitShirt(getCached("awayKitShirt") ?? settings.awayKitShirt ?? "#1e293b");
            setAwayKitShorts(getCached("awayKitShorts") ?? settings.awayKitShorts ?? "#1e293b");
            setAwayKitSocks(getCached("awayKitSocks") ?? settings.awayKitSocks ?? "#1e293b");
            setHomeGroundName(getCached("homeGroundName") ?? settings.homeGround ?? "");
            setTwitterHandle(getCached("twitterHandle") ?? settings.twitterUrl ?? "");
            setInstagramHandle(getCached("instagramHandle") ?? settings.instagramUrl ?? "");
            setWhatsAppPollMessage(getCached("whatsappPollMessage") ?? settings.whatsappPollMessage ?? "");
            setTrainingLocation(getCached("trainingLocation") ?? settings.trainingLocation ?? "");
            setMonthlySubs(getCached("monthlySubs") ?? settings.monthlySubs?.toString() ?? "35");
            
            const cachedSubsEnabled = getCached("subsEnabled");
            setSubsEnabled(cachedSubsEnabled !== null ? cachedSubsEnabled === "true" : (settings.subsEnabled !== undefined ? settings.subsEnabled : (parseFloat(settings.monthlySubs?.toString() || "0") > 0)));
            
            // Load matchday fee & structure overrides if any
            if (settings.name) {
                const savedMatchdayFee = getCached("matchdayFee") ?? localStorage.getItem(`clubflow_matchday_fee_${settings.name}`);
                if (savedMatchdayFee) setMatchdayFee(savedMatchdayFee);
                
                const savedStructure = getCached("subsStructure") ?? localStorage.getItem(`clubflow_subs_structure_${settings.name}`);
                if (savedStructure) setSubsStructure(savedStructure as any);
            }

            const cachedContracts = getCached("contractsEnabled");
            setContractsEnabled(cachedContracts !== null ? cachedContracts === "true" : (settings.contractsEnabled !== undefined ? settings.contractsEnabled : false));
            
            const cachedFines = getCached("finesEnabled");
            setFinesEnabled(cachedFines !== null ? cachedFines === "true" : (settings.finesEnabled || false));
            
            setRegistrationFee(getCached("registrationFee") ?? settings.registrationFee?.toString() ?? "0");
            setTrainingFeePerSession(getCached("trainingFeePerSession") ?? settings.trainingFeePerSession?.toString() ?? "5");

            const cachedSquads = getCached("selectedSquads");
            setSelectedSquads(cachedSquads ? JSON.parse(cachedSquads) : (settings.isOnboarded ? (settings.squads || ["First Team"]) : ["First Team"]));
            
            const cachedRole = getCached("selectedRole");
            if (cachedRole) setSelectedRole(cachedRole);

            const cachedTabs = getCached("selectedTabs");
            if (cachedTabs) setSelectedTabs(JSON.parse(cachedTabs));

            setLeagueUrl(getCached("leagueUrl") ?? settings.leagueUrl ?? "");
            
            hasInitialized.current = true;
        }
    }, [isLoaded, settings, user]);

    // Save onboarding fields to sessionStorage whenever they change
    useEffect(() => {
        if (!hasInitialized.current) return;
        
        const cache = {
            clubName,
            managerName,
            primaryColor,
            homeKitShirt,
            homeKitShorts,
            homeKitSocks,
            awayKitShirt,
            awayKitShorts,
            awayKitSocks,
            homeGroundName,
            twitterHandle,
            instagramHandle,
            whatsappPollMessage,
            trainingLocation,
            monthlySubs,
            subsEnabled: String(subsEnabled),
            contractsEnabled: String(contractsEnabled),
            registrationFee,
            trainingFeePerSession,
            matchdayFee,
            subsStructure,
            finesEnabled: String(finesEnabled),
            selectedSquads: JSON.stringify(selectedSquads),
            leagueUrl,
            selectedRole,
            selectedTabs: JSON.stringify(selectedTabs),
        };

        Object.entries(cache).forEach(([key, val]) => {
            sessionStorage.setItem(`clubflow_onboarding_${key}`, String(val));
        });
    }, [
        clubName, managerName, primaryColor, homeKitShirt, homeKitShorts, homeKitSocks,
        awayKitShirt, awayKitShorts, awayKitSocks, homeGroundName, twitterHandle,
        instagramHandle, whatsappPollMessage, trainingLocation, monthlySubs, subsEnabled,
        contractsEnabled, registrationFee, trainingFeePerSession, matchdayFee, subsStructure,
        finesEnabled, selectedSquads, leagueUrl, selectedRole, selectedTabs
    ]);

    useEffect(() => {
        if (isLoaded && settings?.isOnboarded && step !== 8) {
            router.push('/dashboard');
        }
    }, [isLoaded, settings, step, router]);

    const handleNext = () => setStep(prev => prev + 1);
    const handleBack = () => setStep(prev => prev - 1);
    const handleSkip = () => handleNext();

    if (!isLoaded) {
        return (
            <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center font-sans">
                <div className="flex flex-col items-center gap-3">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-500 border-t-transparent" />
                    <p className="text-slate-400 text-sm">Loading club configuration...</p>
                </div>
            </div>
        );
    }

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            validateAndSetLogo(e.target.files[0]);
        }
    };

    const validateAndSetLogo = (file: File) => {
        if (file.size > 5 * 1024 * 1024) {
            setError("Logo file is too large. Maximum size allowed is 5MB.");
            return;
        }

        const allowedTypes = ['image/jpeg', 'image/png', 'image/svg+xml', 'image/webp'];
        const fileExt = file.name.split('.').pop()?.toLowerCase();
        const allowedExtensions = ['jpg', 'jpeg', 'png', 'svg', 'webp'];
        
        if (!allowedTypes.includes(file.type) && (!fileExt || !allowedExtensions.includes(fileExt))) {
            setError("Invalid file type. Only JPEG, PNG, WEBP, and SVG images are allowed.");
            return;
        }

        setError("");
        setLogoFile(file);
        setLogoPreview(URL.createObjectURL(file));
    };

    const handleSponsorFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            validateAndSetSponsor(e.target.files[0]);
        }
    };

    const validateAndSetSponsor = (file: File) => {
        if (file.size > 5 * 1024 * 1024) {
            setError("Sponsor logo file is too large. Maximum size allowed is 5MB.");
            return;
        }

        const allowedTypes = ['image/jpeg', 'image/png', 'image/svg+xml', 'image/webp'];
        const fileExt = file.name.split('.').pop()?.toLowerCase();
        const allowedExtensions = ['jpg', 'jpeg', 'png', 'svg', 'webp'];

        if (!allowedTypes.includes(file.type) && (!fileExt || !allowedExtensions.includes(fileExt))) {
            setError("Invalid file type for sponsor logo. Only JPEG, PNG, WEBP, and SVG images are allowed.");
            return;
        }

        setError("");
        setSponsorLogoFile(file);
        setSponsorLogoPreview(URL.createObjectURL(file));
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(true);
    };

    const handleDragLeave = () => {
        setIsDragOver(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            validateAndSetLogo(e.dataTransfer.files[0]);
        }
    };

    const uploadFileIfAny = async (file: File | null, existingUrl: string | null, bucket: string) => {
        if (file && user) {
            const fileExt = file.name.split('.').pop() || 'png';
            const fileName = `${user.id}-${Math.random()}.${fileExt}`;
            const filePath = clubId ? `${clubId}/${fileName}` : fileName;

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
        
        if (step === 1) {
            if (!clubName.trim()) {
                setError("Club name cannot be empty.");
                return;
            }
            if (!managerName.trim()) {
                setError("Manager name cannot be empty.");
                return;
            }
        }

        if (step === 2) {
            if (!selectedRole) {
                setError("Please select a role to continue.");
                return;
            }
        }

        if (step === 7 && selectedSquads.length === 0) {
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

            // Handle Staff Invites (Save to staff table)
            const staffInserts = staffInvites
                .filter(s => s.name.trim() && s.email.trim())
                .map(s => ({
                    name: s.name.trim(),
                    email: s.email.trim(),
                    role: s.role
                }));

            // Auto-insert Manager as a staff member
            if (managerName.trim()) {
                const hasManager = staffInserts.some(s => s.role === 'Manager');
                if (!hasManager) {
                    staffInserts.push({
                        name: managerName.trim(),
                        email: user?.email || '',
                        role: 'Manager'
                    });
                }
            }

            if (staffInserts.length > 0) {
                const { error: insertError } = await supabase.from('staff').insert(staffInserts);
                if (insertError) console.warn("Failed to insert staff:", insertError);
            }

            if (managerName.trim()) {
                const { error: userUpdateErr } = await supabase.auth.updateUser({
                    data: { full_name: managerName }
                });
                if (userUpdateErr) console.warn("Failed to update manager name metadata:", userUpdateErr);
            }

            // Always make sure 'admin' and 'dashboard' are in page permissions for manager/owner
            const permissionsToSave = Array.from(new Set(["admin", "dashboard", ...selectedTabs]));

            await updateSettings({ 
                name: clubName,
                logo: finalLogoUrl,
                sponsorLogo: finalSponsorUrl,
                primaryColor,
                squads: selectedSquads,
                leagueUrl: leagueUrl || null,
                homeKitShirt,
                homeKitShorts,
                homeKitSocks,
                awayKitShirt,
                awayKitShorts,
                monthlySubs: subsEnabled ? (parseFloat(monthlySubs) || 0) : 0,
                subsEnabled,
                contractsEnabled,
                finesEnabled,
                registrationFee: subsEnabled ? (parseFloat(registrationFee) || 0) : 0,
                trainingFeePerSession: subsEnabled ? (parseFloat(trainingFeePerSession) || 0) : 0,
                homeGround: homeGroundName || null,
                twitterUrl: twitterHandle || null,
                instagramUrl: instagramHandle || null,
                whatsappPollMessage: whatsappPollMessage || null,
                trainingLocation: trainingLocation || null,
                isOnboarded: true 
            }, permissionsToSave);

            if (subsEnabled) {
                localStorage.setItem(`clubflow_matchday_fee_${clubName}`, matchdayFee);
                localStorage.setItem(`clubflow_subs_structure_${clubName}`, subsStructure);
            }

            // Clear onboarding cache keys from sessionStorage
            const ONBOARDING_CACHE_KEYS = [
                "clubName", "managerName", "primaryColor", "homeKitShirt", "homeKitShorts", "homeKitSocks",
                "awayKitShirt", "awayKitShorts", "awayKitSocks", "homeGroundName", "twitterHandle",
                "instagramHandle", "whatsappPollMessage", "trainingLocation", "monthlySubs", "subsEnabled",
                "contractsEnabled", "registrationFee", "trainingFeePerSession", "matchdayFee", "subsStructure",
                "finesEnabled", "selectedSquads", "leagueUrl", "selectedRole", "selectedTabs"
            ];
            ONBOARDING_CACHE_KEYS.forEach(key => sessionStorage.removeItem(`clubflow_onboarding_${key}`));

            setStep(10); // Success screen (step 10 now)
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

    const removeStaffField = (index: number) => {
        setStaffInvites(staffInvites.filter((_, i) => i !== index));
    };

    const animations = {
        initial: { opacity: 0, x: 20 },
        animate: { opacity: 1, x: 0 },
        exit: { opacity: 0, x: -20 },
        transition: { duration: 0.3 }
    };

    return (
        <div className="min-h-screen bg-slate-950 text-white flex flex-col font-sans">
            {/* Header */}
            <header className="w-full max-w-7xl mx-auto px-6 py-4 flex items-center justify-between z-20 shrink-0">
                <div className="flex items-center gap-3">
                    <img src="/clubflow-logo.png" alt="ClubFlow Logo" className="h-9 w-auto object-contain" />
                    <span className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
                        ClubFlow
                    </span>
                </div>
                <Button variant="ghost" onClick={signOut} className="text-slate-400 hover:text-white hover:bg-slate-900 text-sm font-medium">
                    Sign Out
                </Button>
            </header>

            {/* Main Content */}
            <div className="flex-1 flex items-center justify-center p-4 md:p-8">
                <div className="w-full max-w-2xl flex flex-col justify-center">
                    <div className="w-full space-y-4">
                            
                            {/* Progress Dots */}
                            {step > 0 && step <= totalSteps && (
                                <div className="flex justify-between items-center px-4 mb-4 relative max-w-md mx-auto">
                                    <div className="absolute left-6 right-6 top-1/2 h-0.5 bg-slate-800 -z-10" />
                                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                                        <div 
                                            key={num} 
                                            className={`h-7 w-7 rounded-full flex items-center justify-center font-bold text-xs transition-colors duration-300 ${
                                                step >= num 
                                                    ? 'bg-white text-slate-950 shadow-lg shadow-white/10' 
                                                    : 'bg-slate-900 text-slate-600 border border-slate-800'
                                            }`}
                                        >
                                            {num}
                                        </div>
                                    ))}
                                </div>
                            )}

                            <Card className="border-slate-800 bg-slate-900/40 backdrop-blur-md shadow-2xl overflow-hidden">
                                {error && (
                                    <div className="p-4 bg-red-950/40 border-b border-red-900 text-red-400 flex items-center gap-2">
                                        <AlertCircle className="h-4 w-4 shrink-0" />
                                        <span className="text-sm font-medium">{error}</span>
                                    </div>
                                )}

                                <AnimatePresence mode="wait">
                                    
                                    {/* STEP 0: Welcome Intro */}
                                    {step === 0 && (
                                        <motion.div key="step0" {...animations}>
                                            <CardHeader className="space-y-4 pb-6 border-b border-slate-900 text-center">
                                                <div className="mx-auto w-16 h-16 bg-slate-900/30 rounded-2xl flex items-center justify-center border border-slate-800">
                                                    <img src="/clubflow-logo.png" alt="ClubFlow Logo" className="h-10 w-auto object-contain" />
                                                </div>
                                                <div className="space-y-2">
                                                    <CardTitle className="text-3xl font-extrabold text-white bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">Welcome to ClubFlow</CardTitle>
                                                    <CardDescription className="text-slate-400 text-sm max-w-md mx-auto">
                                                        Let's set up your club's digital workspace. In a few quick steps, you'll customize branding, kits, ground details, financial modules, and invite staff.
                                                    </CardDescription>
                                                </div>
                                            </CardHeader>
                                            <CardContent className="space-y-6 pt-6">
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    <div className="p-4 bg-slate-900/30 border border-slate-800 rounded-xl space-y-2">
                                                        <div className="flex items-center gap-2">
                                                            <Palette className="w-4 h-4 text-pink-400" />
                                                            <h4 className="text-sm font-semibold text-white">Brand & Kits</h4>
                                                        </div>
                                                        <p className="text-xs text-slate-400 leading-relaxed">
                                                            Define your club name, colors, sponsor logo, and home/away kit details to theme your entire dashboard.
                                                        </p>
                                                    </div>

                                                    <div className="p-4 bg-slate-900/30 border border-slate-800 rounded-xl space-y-2">
                                                        <div className="flex items-center gap-2">
                                                            <Banknote className="w-4 h-4 text-emerald-400" />
                                                            <h4 className="text-sm font-semibold text-white">Club Finance</h4>
                                                        </div>
                                                        <p className="text-xs text-slate-400 leading-relaxed">
                                                            Track player subs, match fees, player contracts, and squad fines to manage your budget efficiently.
                                                        </p>
                                                    </div>

                                                    <div className="p-4 bg-slate-900/30 border border-slate-800 rounded-xl space-y-2">
                                                        <div className="flex items-center gap-2">
                                                            <Users className="w-4 h-4 text-indigo-400" />
                                                            <h4 className="text-sm font-semibold text-white">Squads & Staff</h4>
                                                        </div>
                                                        <p className="text-xs text-slate-400 leading-relaxed">
                                                            Configure multiple matchday squads (e.g. First Team, Midweek) and invite coaches, treasurers, or secretaries.
                                                        </p>
                                                    </div>

                                                    <div className="p-4 bg-slate-900/30 border border-slate-800 rounded-xl space-y-2">
                                                        <div className="flex items-center gap-2">
                                                            <Trophy className="w-4 h-4 text-yellow-400" />
                                                            <h4 className="text-sm font-semibold text-white">League Sync</h4>
                                                            <span className="text-[9px] bg-teal-500/25 text-teal-300 font-bold px-1.5 py-0.5 rounded-full uppercase">Live</span>
                                                        </div>
                                                        <p className="text-xs text-slate-400 leading-relaxed">
                                                            Paste your FA Full-Time standings page to automatically feed live table data straight to your dashboard.
                                                        </p>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </motion.div>
                                    )}

                                    {/* STEP 1: Club Branding */}
                                    {step === 1 && (
                                        <motion.div key="step1" {...animations}>
                                            <CardHeader className="space-y-2 pb-6 border-b border-slate-900">
                                                <CardTitle className="text-2xl font-extrabold text-white">Club Branding</CardTitle>
                                                <CardDescription className="text-slate-400 text-sm">
                                                    Set up your club's identity. These details will be used throughout ClubFlow.
                                                </CardDescription>
                                            </CardHeader>
                                            <CardContent className="space-y-6 pt-6">
                                                <div className="p-3.5 bg-slate-900/30 border border-slate-800 rounded-xl flex items-start gap-2.5">
                                                    <Palette className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
                                                    <p className="text-xs text-slate-400 leading-relaxed">
                                                        Your club logo and primary color will automatically style the main layout, team statistics cards, and the mini tactics board.
                                                    </p>
                                                </div>
                                                <div className="space-y-2">
                                                    <Label htmlFor="clubName" className="text-slate-300 font-semibold">Club Name <span className="text-teal-400">*</span></Label>
                                                    <Input
                                                        id="clubName"
                                                        placeholder="e.g. Camden United"
                                                        required
                                                        value={clubName}
                                                        onChange={(e) => setClubName(e.target.value)}
                                                        className="bg-slate-900/60 border-slate-800 text-white text-base h-12 px-4 placeholder:text-slate-600 focus-visible:ring-teal-400"
                                                    />
                                                </div>

                                                <div className="space-y-2">
                                                    <Label htmlFor="managerName" className="text-slate-300 font-semibold">Manager Name <span className="text-teal-400">*</span></Label>
                                                    <Input
                                                        id="managerName"
                                                        placeholder="e.g. Ted Lasso"
                                                        required
                                                        value={managerName}
                                                        onChange={(e) => setManagerName(e.target.value)}
                                                        className="bg-slate-900/60 border-slate-800 text-white text-base h-12 px-4 placeholder:text-slate-600 focus-visible:ring-teal-400"
                                                    />
                                                </div>

                                                <div className="space-y-2">
                                                    <Label className="text-slate-300 font-semibold">Club Logo</Label>
                                                    <div
                                                        onDragOver={handleDragOver}
                                                        onDragLeave={handleDragLeave}
                                                        onDrop={handleDrop}
                                                        onClick={() => fileInputRef.current?.click()}
                                                        className={`relative group cursor-pointer w-full h-32 rounded-xl bg-slate-900/30 border-2 border-dashed transition-all flex flex-col items-center justify-center overflow-hidden ${
                                                            isDragOver ? "border-teal-400 bg-teal-950/10" : "border-slate-800 hover:border-slate-700"
                                                        }`}
                                                    >
                                                        <input
                                                            type="file"
                                                            ref={fileInputRef}
                                                            accept="image/png, image/jpeg, image/svg+xml, image/webp"
                                                            onChange={handleFileSelect}
                                                            className="hidden"
                                                        />
                                                        {logoPreview ? (
                                                            <div className="flex items-center gap-4 p-4 w-full h-full justify-center">
                                                                <img src={logoPreview} alt="Logo preview" className="h-20 w-20 object-contain drop-shadow-lg" />
                                                                <div className="text-left">
                                                                    <p className="text-xs text-slate-400 font-medium">Badge Uploaded</p>
                                                                    <p className="text-[11px] text-teal-400 hover:underline">Click or drag to change</p>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className="flex flex-col items-center text-slate-500 group-hover:text-slate-400 transition-colors">
                                                                <Upload className="h-8 w-8 mb-2 text-slate-500" />
                                                                <span className="font-semibold text-xs mb-1">Drag & drop logo, or click to browse</span>
                                                                <span className="text-[10px] text-slate-600">Supports PNG, JPG, WEBP, SVG up to 5MB</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="space-y-2">
                                                    <Label className="text-slate-300 font-semibold">Sponsor Logo <span className="text-xs text-slate-500 font-normal">(Optional)</span></Label>
                                                    <div
                                                        onDragOver={(e) => { e.preventDefault(); setIsSponsorDragOver(true); }}
                                                        onDragLeave={() => setIsSponsorDragOver(false)}
                                                        onDrop={(e) => {
                                                            e.preventDefault();
                                                            setIsSponsorDragOver(false);
                                                            if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                                                                validateAndSetSponsor(e.dataTransfer.files[0]);
                                                            }
                                                        }}
                                                        onClick={() => sponsorInputRef.current?.click()}
                                                        className={`relative group cursor-pointer w-full h-32 rounded-xl bg-slate-900/30 border-2 border-dashed transition-all flex flex-col items-center justify-center overflow-hidden ${
                                                            isSponsorDragOver ? "border-teal-400 bg-teal-950/10" : "border-slate-800 hover:border-slate-700"
                                                        }`}
                                                    >
                                                        <input
                                                            type="file"
                                                            ref={sponsorInputRef}
                                                            accept="image/png, image/jpeg, image/svg+xml, image/webp"
                                                            onChange={handleSponsorFileSelect}
                                                            className="hidden"
                                                        />
                                                        {sponsorLogoPreview ? (
                                                            <div className="flex items-center gap-4 p-4 w-full h-full justify-center">
                                                                <img src={sponsorLogoPreview} alt="Sponsor logo preview" className="h-20 w-20 object-contain drop-shadow-lg" />
                                                                <div className="text-left">
                                                                    <p className="text-xs text-slate-400 font-medium">Sponsor Logo Uploaded</p>
                                                                    <p className="text-[11px] text-teal-400 hover:underline">Click or drag to change</p>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className="flex flex-col items-center text-slate-500 group-hover:text-slate-400 transition-colors">
                                                                <Upload className="h-8 w-8 mb-2 text-slate-500" />
                                                                <span className="font-semibold text-xs mb-1">Drag & drop sponsor logo, or click to browse</span>
                                                                <span className="text-[10px] text-slate-600">Supports PNG, JPG, WEBP, SVG up to 5MB</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="space-y-2">
                                                    <Label className="text-slate-300 font-semibold">Primary Club Colour</Label>
                                                    <div className="flex items-center gap-4 bg-slate-900/30 border border-slate-900 p-3 rounded-xl">
                                                        <input
                                                            type="color"
                                                            value={primaryColor}
                                                            onChange={(e) => setPrimaryColor(e.target.value)}
                                                            className="w-12 h-12 p-1 cursor-pointer bg-slate-950 border border-slate-800 rounded-lg shrink-0"
                                                        />
                                                        <div>
                                                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Accent Colour</span>
                                                            <p className="text-sm font-mono font-bold text-white">{primaryColor.toUpperCase()}</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-wrap gap-2 pt-1">
                                                        {presetColors.map(color => (
                                                            <button
                                                                key={color.value}
                                                                type="button"
                                                                onClick={() => setPrimaryColor(color.value)}
                                                                className={`w-7 h-7 rounded-lg border-2 transition-all ${
                                                                    primaryColor.toLowerCase() === color.value.toLowerCase() ? 'border-white scale-110 shadow-lg shadow-white/10' : 'border-transparent'
                                                                }`}
                                                                style={{ backgroundColor: color.value }}
                                                                title={color.name}
                                                            />
                                                        ))}
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </motion.div>
                                    )}

                                    {/* STEP 2: Role Selection */}
                                    {step === 2 && (
                                        <motion.div key="step2" {...animations} className="relative">
                                            {/* Ambient backdrop glows */}
                                            <div className="absolute -top-16 -left-16 w-60 h-60 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
                                            <div className="absolute -bottom-16 -right-16 w-60 h-60 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />
                                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

                                            <CardHeader className="space-y-2 pb-6 border-b border-slate-900 text-center relative z-10">
                                                <CardTitle className="text-3xl font-extrabold text-white bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">Select Your Role</CardTitle>
                                                <CardDescription className="text-slate-400 text-sm">
                                                    Choose your primary role to tailormake your workspace tabs.
                                                </CardDescription>
                                            </CardHeader>
                                            <CardContent className="space-y-6 pt-6 relative z-10">
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    {[
                                                        { 
                                                            role: "manager/coach", 
                                                            label: "Manager / Coach", 
                                                            desc: "The tactician running team squads, training sessions, matchday lineups, and masterminding tactics.", 
                                                            icon: ClipboardList,
                                                            colorClass: "border-emerald-500 bg-gradient-to-br from-emerald-950/40 via-emerald-900/10 to-slate-900/10 shadow-lg shadow-emerald-500/10 text-emerald-400",
                                                            defaultClass: "border-emerald-950/40 bg-gradient-to-br from-emerald-950/10 to-slate-950/50 hover:border-emerald-800/60 hover:shadow-[0_0_20px_rgba(16,185,129,0.08)]",
                                                            iconClass: "bg-emerald-500 text-slate-950",
                                                            iconDefaultClass: "bg-emerald-950/65 text-emerald-400 border border-emerald-900/40",
                                                            textClass: "text-emerald-400"
                                                        },
                                                        { 
                                                            role: "secretary", 
                                                            label: "Secretary", 
                                                            desc: "The coordinator handling fixtures, sponsorships, player databases, documents, and overall club admin.", 
                                                            icon: FileText,
                                                            colorClass: "border-blue-500 bg-gradient-to-br from-blue-950/40 via-blue-900/10 to-slate-900/10 shadow-lg shadow-blue-500/10 text-blue-400",
                                                            defaultClass: "border-blue-950/40 bg-gradient-to-br from-blue-950/10 to-slate-950/50 hover:border-blue-800/60 hover:shadow-[0_0_20px_rgba(59,130,246,0.08)]",
                                                            iconClass: "bg-blue-500 text-slate-950",
                                                            iconDefaultClass: "bg-blue-950/65 text-blue-400 border border-blue-900/40",
                                                            textClass: "text-blue-400"
                                                        },
                                                        { 
                                                            role: "analyst", 
                                                            label: "Analyst", 
                                                            desc: "The performance guru dissecting stats, compiling opposition reports, and mapping weaknesses.", 
                                                            icon: TrendingUp,
                                                            colorClass: "border-rose-500 bg-gradient-to-br from-rose-950/40 via-rose-900/10 to-slate-900/10 shadow-lg shadow-rose-500/10 text-rose-400",
                                                            defaultClass: "border-rose-950/40 bg-gradient-to-br from-rose-950/10 to-slate-950/50 hover:border-rose-800/60 hover:shadow-[0_0_20px_rgba(244,63,94,0.08)]",
                                                            iconClass: "bg-rose-500 text-slate-950",
                                                            iconDefaultClass: "bg-rose-950/65 text-rose-400 border border-rose-900/40",
                                                            textClass: "text-rose-400"
                                                        },
                                                        { 
                                                            role: "chairperson", 
                                                            label: "Chairperson", 
                                                            desc: "The lead overseer managing player budgets, sponsorships, financial audits, and contracts.", 
                                                            icon: Briefcase,
                                                            colorClass: "border-amber-500 bg-gradient-to-br from-amber-950/40 via-amber-900/10 to-slate-900/10 shadow-lg shadow-amber-500/10 text-amber-400",
                                                            defaultClass: "border-amber-950/40 bg-gradient-to-br from-amber-950/10 to-slate-950/50 hover:border-amber-800/60 hover:shadow-[0_0_20px_rgba(245,158,11,0.08)]",
                                                            iconClass: "bg-amber-500 text-slate-950",
                                                            iconDefaultClass: "bg-amber-950/65 text-amber-400 border border-amber-900/40",
                                                            textClass: "text-amber-400"
                                                        }
                                                    ].map((item) => {
                                                        const IconComponent = item.icon;
                                                        const isSelected = selectedRole === item.role;
                                                        return (
                                                            <button
                                                                key={item.role}
                                                                type="button"
                                                                onClick={() => {
                                                                    setSelectedRole(item.role);
                                                                    setSelectedTabs(ROLE_TABS[item.role] || []);
                                                                }}
                                                                className={`p-5 rounded-2xl cursor-pointer border-2 text-left transition-all duration-300 flex flex-col justify-between h-44 hover:scale-[1.02] ${
                                                                    isSelected ? item.colorClass : item.defaultClass
                                                                }`}
                                                            >
                                                                <div className="flex items-center justify-between w-full">
                                                                    <div className={`p-2.5 rounded-xl transition-all ${isSelected ? item.iconClass : item.iconDefaultClass}`}>
                                                                        <IconComponent className="w-5 h-5" />
                                                                    </div>
                                                                    {isSelected && (
                                                                        <CheckCircle2 className="w-5 h-5 text-white fill-white/10" />
                                                                    )}
                                                                </div>
                                                                <div className="mt-4">
                                                                    <h4 className={`font-bold text-base transition-colors ${isSelected ? 'text-white' : item.textClass}`}>{item.label}</h4>
                                                                    <p className="text-slate-300 text-xs mt-1.5 leading-relaxed">{item.desc}</p>
                                                                </div>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </CardContent>
                                        </motion.div>
                                    )}

                                    {/* STEP 3: Workspace Tab Selection */}
                                    {step === 3 && (
                                        <motion.div key="step3" {...animations}>
                                            <CardHeader className="space-y-2 pb-6 border-b border-slate-900">
                                                <CardTitle className="text-2xl font-extrabold text-white flex items-center gap-2">
                                                    <Palette className="text-slate-400 w-5 h-5" /> Tailor Your Workspace
                                                </CardTitle>
                                                <CardDescription className="text-slate-400 text-sm">
                                                    Choose which tabs should show up in your main dashboard sidebar. You can easily add or remove them later via the Admin page.
                                                </CardDescription>
                                            </CardHeader>
                                            <CardContent className="space-y-6 pt-6">
                                                {/* Select All Checkbox */}
                                                <div 
                                                    onClick={() => {
                                                        const selectablePermissions = ALL_PAGE_PERMISSIONS.filter(p => p.key !== "admin" && p.key !== "dashboard");
                                                        const allSelected = selectablePermissions.every(p => selectedTabs.includes(p.key));
                                                        if (allSelected) {
                                                            setSelectedTabs([]);
                                                        } else {
                                                            setSelectedTabs(selectablePermissions.map(p => p.key));
                                                        }
                                                    }}
                                                    className="p-4 rounded-xl border border-slate-800 bg-slate-900/30 hover:border-slate-700 cursor-pointer flex items-center justify-between transition-all"
                                                >
                                                    <div className="space-y-0.5">
                                                        <span className="text-sm font-bold text-white">Select all tabs</span>
                                                        <p className="text-xs text-slate-400">Enable every tab in the workspace regardless of your role</p>
                                                    </div>
                                                    {(() => {
                                                        const selectablePermissions = ALL_PAGE_PERMISSIONS.filter(p => p.key !== "admin" && p.key !== "dashboard");
                                                        const allSelected = selectablePermissions.length > 0 && selectablePermissions.every(p => selectedTabs.includes(p.key));
                                                        return (
                                                            <div className={`w-6 h-6 rounded-md border flex items-center justify-center transition-all ${
                                                                allSelected ? 'bg-teal-500 border-teal-500 text-slate-950 font-bold' : 'border-slate-700 bg-slate-900/50'
                                                            }`}>
                                                                {allSelected && <CheckCircle2 className="w-4 h-4 text-slate-950" />}
                                                            </div>
                                                        );
                                                    })()}
                                                </div>

                                                <div className="max-h-[350px] overflow-y-auto pr-2 custom-scrollbar space-y-4">
                                                    {[
                                                        { 
                                                            name: "On the Pitch", 
                                                            colorTheme: "emerald",
                                                            borderClass: "border-emerald-500/40 bg-emerald-950/20 text-emerald-300",
                                                            checkboxClass: "bg-emerald-500 border-emerald-500 text-slate-950",
                                                            labelClass: "text-emerald-400"
                                                        },
                                                        { 
                                                            name: "Analysis", 
                                                            colorTheme: "rose",
                                                            borderClass: "border-rose-500/40 bg-rose-950/20 text-rose-300",
                                                            checkboxClass: "bg-rose-500 border-rose-500 text-slate-950",
                                                            labelClass: "text-rose-400"
                                                        },
                                                        { 
                                                            name: "Off the Pitch", 
                                                            colorTheme: "blue",
                                                            borderClass: "border-blue-500/40 bg-blue-950/20 text-blue-300",
                                                            checkboxClass: "bg-blue-500 border-blue-500 text-slate-950",
                                                            labelClass: "text-blue-400"
                                                        }
                                                    ].map(group => {
                                                        const groupPermissions = ALL_PAGE_PERMISSIONS.filter(p => p.group === group.name && p.key !== "admin" && p.key !== "dashboard");
                                                        if (groupPermissions.length === 0) return null;
                                                        return (
                                                            <div key={group.name} className="space-y-2">
                                                                <h4 className={`text-xs font-black uppercase tracking-wider ${group.labelClass}`}>{group.name}</h4>
                                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                                    {groupPermissions.map(perm => {
                                                                        const isSelected = selectedTabs.includes(perm.key);
                                                                        return (
                                                                            <div
                                                                                key={perm.key}
                                                                                onClick={() => {
                                                                                    setSelectedTabs(prev =>
                                                                                        prev.includes(perm.key)
                                                                                            ? prev.filter(t => t !== perm.key)
                                                                                            : [...prev, perm.key]
                                                                                    );
                                                                                }}
                                                                                className={`p-3.5 rounded-xl cursor-pointer border-2 transition-all flex items-start gap-3 text-left ${
                                                                                    isSelected ? group.borderClass : 'border-slate-800 bg-slate-900/10 hover:border-slate-700'
                                                                                }`}
                                                                            >
                                                                                <div className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                                                                                    isSelected ? group.checkboxClass : 'border-slate-700 bg-slate-900/30'
                                                                                }`}>
                                                                                    {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-slate-950" />}
                                                                                </div>
                                                                                <div>
                                                                                    <span className="text-sm font-semibold text-white block">{perm.label}</span>
                                                                                    <span className="text-slate-400 text-[11px] leading-relaxed mt-0.5 block">{perm.description}</span>
                                                                                </div>
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </CardContent>
                                        </motion.div>
                                    )}

                                    {/* STEP 4: Kit Colors */}
                                    {step === 4 && (
                                        <motion.div key="step2" {...animations}>
                                            <CardHeader className="space-y-2 pb-6 border-b border-slate-900">
                                                <CardTitle className="text-2xl font-extrabold text-white flex items-center gap-2">
                                                    <Palette className="text-slate-400 w-5 h-5" /> Kit Colors
                                                </CardTitle>
                                                <CardDescription className="text-slate-400 text-sm">
                                                    Customize your home and away kits.
                                                </CardDescription>
                                            </CardHeader>
                                            <CardContent className="space-y-6 pt-6">
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                    {/* Home Kit */}
                                                    <div className="space-y-3">
                                                        <Label className="text-slate-300 font-semibold flex items-center gap-1.5">
                                                            <div className="w-2 h-2 rounded-full bg-teal-400" /> Home Kit
                                                        </Label>
                                                        <div className="grid grid-cols-3 gap-2 bg-slate-900/30 p-3 rounded-xl border border-slate-800">
                                                            <div className="flex flex-col items-center gap-1">
                                                                <input type="color" value={homeKitShirt} onChange={(e) => setHomeKitShirt(e.target.value)} className="w-9 h-9 p-0.5 cursor-pointer bg-slate-950 border border-slate-800 rounded-lg"/>
                                                                <span className="text-[10px] text-slate-500 uppercase">Shirt</span>
                                                            </div>
                                                            <div className="flex flex-col items-center gap-1">
                                                                <input type="color" value={homeKitShorts} onChange={(e) => setHomeKitShorts(e.target.value)} className="w-9 h-9 p-0.5 cursor-pointer bg-slate-950 border border-slate-800 rounded-lg"/>
                                                                <span className="text-[10px] text-slate-500 uppercase">Shorts</span>
                                                            </div>
                                                            <div className="flex flex-col items-center gap-1">
                                                                <input type="color" value={homeKitSocks} onChange={(e) => setHomeKitSocks(e.target.value)} className="w-9 h-9 p-0.5 cursor-pointer bg-slate-950 border border-slate-800 rounded-lg"/>
                                                                <span className="text-[10px] text-slate-500 uppercase">Socks</span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Away Kit */}
                                                    <div className="space-y-3">
                                                        <Label className="text-slate-300 font-semibold flex items-center gap-1.5">
                                                            <div className="w-2 h-2 rounded-full bg-slate-500" /> Away Kit
                                                        </Label>
                                                        <div className="grid grid-cols-3 gap-2 bg-slate-900/30 p-3 rounded-xl border border-slate-800">
                                                            <div className="flex flex-col items-center gap-1">
                                                                <input type="color" value={awayKitShirt} onChange={(e) => setAwayKitShirt(e.target.value)} className="w-9 h-9 p-0.5 cursor-pointer bg-slate-950 border border-slate-800 rounded-lg"/>
                                                                <span className="text-[10px] text-slate-500 uppercase">Shirt</span>
                                                            </div>
                                                            <div className="flex flex-col items-center gap-1">
                                                                <input type="color" value={awayKitShorts} onChange={(e) => setAwayKitShorts(e.target.value)} className="w-9 h-9 p-0.5 cursor-pointer bg-slate-950 border border-slate-800 rounded-lg"/>
                                                                <span className="text-[10px] text-slate-500 uppercase">Shorts</span>
                                                            </div>
                                                            <div className="flex flex-col items-center gap-1">
                                                                <input type="color" value={awayKitSocks} onChange={(e) => setAwayKitSocks(e.target.value)} className="w-9 h-9 p-0.5 cursor-pointer bg-slate-950 border border-slate-800 rounded-lg"/>
                                                                <span className="text-[10px] text-slate-500 uppercase">Socks</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </motion.div>
                                    )}

                                    {/* STEP 5: Details & History */}
                                    {step === 5 && (
                                        <motion.div key="step3" {...animations}>
                                            <CardHeader className="space-y-2 pb-6 border-b border-slate-900">
                                                <CardTitle className="text-2xl font-extrabold text-white flex items-center gap-2">
                                                    <MapPin className="text-slate-400 w-5 h-5" /> Ground & Socials
                                                </CardTitle>
                                                <CardDescription className="text-slate-400 text-sm">
                                                    Share details about your ground and social media links.
                                                </CardDescription>
                                            </CardHeader>
                                            <CardContent className="space-y-6 pt-6">
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    <div className="space-y-2">
                                                        <Label className="text-slate-300">Ground Name</Label>
                                                        <Input placeholder="e.g. Camden Sports Hub" value={homeGroundName} onChange={(e) => setHomeGroundName(e.target.value)} className="bg-slate-900/60 border-slate-800 text-white" />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label className="text-slate-300">Postcode</Label>
                                                        <Input placeholder="e.g. NW1 8PP" value={postcode} onChange={(e) => setPostcode(e.target.value)} className="bg-slate-900/60 border-slate-800 text-white" />
                                                    </div>
                                                </div>
                                                <div className="space-y-2">
                                                    <Label className="text-slate-300">Training Location</Label>
                                                    <Input placeholder="e.g. Market Road, N7" value={trainingLocation} onChange={(e) => setTrainingLocation(e.target.value)} className="bg-slate-900/60 border-slate-800 text-white" />
                                                </div>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-slate-900 pt-6">
                                                    <div className="space-y-2">
                                                        <Label className="text-slate-300 flex items-center gap-1.5"><Twitter className="w-3.5 h-3.5 text-sky-400"/> Twitter (X)</Label>
                                                        <Input placeholder="@clubname" value={twitterHandle} onChange={(e) => setTwitterHandle(e.target.value)} className="bg-slate-900/60 border-slate-800 text-white" />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label className="text-slate-300 flex items-center gap-1.5"><Instagram className="w-3.5 h-3.5 text-pink-400"/> Instagram</Label>
                                                        <Input placeholder="@clubname" value={instagramHandle} onChange={(e) => setInstagramHandle(e.target.value)} className="bg-slate-900/60 border-slate-800 text-white" />
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </motion.div>
                                    )}

                                    {/* STEP 6: Finance & Operations */}
                                    {step === 6 && (
                                        <motion.div key="step4" {...animations}>
                                            <CardHeader className="space-y-2 pb-6 border-b border-slate-900">
                                                <CardTitle className="text-2xl font-extrabold text-white flex items-center gap-2">
                                                    <Banknote className="text-slate-400 w-5 h-5" /> Finance Setup
                                                </CardTitle>
                                                <CardDescription className="text-slate-400 text-sm">
                                                    Set standard subs and configure your fines module.
                                                </CardDescription>
                                            </CardHeader>
                                            <CardContent className="space-y-6 pt-6">
                                                {!selectedTabs.includes("finance") && (
                                                    <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3">
                                                        <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                                                        <div className="space-y-1">
                                                            <h5 className="text-sm font-bold text-amber-300">Suggestion: Skip Finance Setup</h5>
                                                            <p className="text-xs text-slate-300 leading-relaxed">
                                                                You did not select <strong>Finance</strong> or <strong>Player Budgets</strong> when tailoring your workspace. If you don't need financial tracking, feel free to click <strong className="text-white">"Skip for now"</strong> below to proceed!
                                                            </p>
                                                        </div>
                                                    </div>
                                                )}
                                                <div className="p-3.5 bg-slate-900/30 border border-slate-800 rounded-xl flex items-start gap-2.5">
                                                    <Banknote className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
                                                    <p className="text-xs text-slate-400 leading-relaxed">
                                                        These options enable finance tracking tools in your workspace (such as player billing, contracts, and player fine sheets). You can toggle these modules on or off anytime.
                                                    </p>
                                                </div>
                                                <div className="bg-slate-900/30 border border-slate-800 rounded-xl p-5 flex items-start justify-between gap-4">
                                                    <div className="space-y-1">
                                                        <Label className="text-white font-semibold flex items-center gap-1.5">
                                                            <Banknote className="w-4 h-4 text-indigo-400" /> Player Subscriptions
                                                        </Label>
                                                        <p className="text-slate-400 text-xs leading-relaxed">
                                                            Do players pay monthly subscription fees or session fees to the club?
                                                        </p>
                                                    </div>
                                                    <Switch 
                                                        checked={subsEnabled} 
                                                        onCheckedChange={setSubsEnabled}
                                                        className="data-[state=checked]:bg-emerald-500 data-[state=unchecked]:bg-red-500"
                                                    />
                                                </div>

                                                {subsEnabled && (
                                                    <>
                                                        <div className="space-y-2">
                                                            <Label className="text-slate-300">Club Subs Structure</Label>
                                                            <select
                                                                value={subsStructure}
                                                                onChange={(e) => setSubsStructure(e.target.value as any)}
                                                                className="w-full bg-slate-900/60 border border-slate-800 text-white rounded-xl h-12 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-semibold"
                                                            >
                                                                <option value="Monthly">Monthly charge in total</option>
                                                                <option value="Training">Just training fee subs (Pay-As-You-Go)</option>
                                                                <option value="Matchday">Just matchday subs (Pay-As-You-Go)</option>
                                                                <option value="Both">Both training & matchday subs (Pay-As-You-Go)</option>
                                                            </select>
                                                            <p className="text-slate-500 text-xs">Choose how your club collects subscriptions from players.</p>
                                                        </div>

                                                        {subsStructure === "Monthly" && (
                                                            <div className="space-y-2">
                                                                <Label className="text-slate-300">Standard Monthly Player Subs (£)</Label>
                                                                <div className="relative">
                                                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold">£</span>
                                                                    <Input 
                                                                        type="number"
                                                                        value={monthlySubs}
                                                                        onChange={(e) => setMonthlySubs(e.target.value)}
                                                                        className="bg-slate-900/60 border-slate-800 text-white pl-8 h-12"
                                                                        placeholder="e.g. 35"
                                                                    />
                                                                </div>
                                                                <p className="text-slate-400 text-[11px] leading-normal mt-1 bg-slate-900/40 p-2.5 rounded-lg border border-slate-800">
                                                                    <strong>Note:</strong> You can mark specific players as <strong>Exempt</strong> (e.g. coaches, sponsored players) or customize their fees individually later in the Squad and Finance tabs.
                                                                </p>
                                                                <p className="text-slate-500 text-xs">Used to calculate target collection goals in the Finance panel.</p>
                                                            </div>
                                                        )}

                                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                            <div className="space-y-2">
                                                                <Label className="text-slate-300">Club Registration Fee (£)</Label>
                                                                <div className="relative">
                                                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold">£</span>
                                                                    <Input 
                                                                        type="number"
                                                                        value={registrationFee}
                                                                        onChange={(e) => setRegistrationFee(e.target.value)}
                                                                        className="bg-slate-900/60 border-slate-800 text-white pl-8 h-12"
                                                                        placeholder="e.g. 50"
                                                                    />
                                                                </div>
                                                                <p className="text-slate-500 text-xs">One-off seasonal registration fee.</p>
                                                            </div>

                                                            {(subsStructure === "Training" || subsStructure === "Both") && (
                                                                <div className="space-y-2">
                                                                    <Label className="text-slate-300">Training Session Fee (£)</Label>
                                                                    <div className="relative">
                                                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold">£</span>
                                                                        <Input 
                                                                            type="number"
                                                                            value={trainingFeePerSession}
                                                                            onChange={(e) => setTrainingFeePerSession(e.target.value)}
                                                                            className="bg-slate-900/60 border-slate-800 text-white pl-8 h-12"
                                                                            placeholder="e.g. 5"
                                                                        />
                                                                    </div>
                                                                    <p className="text-slate-500 text-xs">Default fee for pay-as-you-go training.</p>
                                                                </div>
                                                            )}

                                                            {(subsStructure === "Matchday" || subsStructure === "Both") && (
                                                                <div className="space-y-2">
                                                                    <Label className="text-slate-300">Matchday Fee (£)</Label>
                                                                    <div className="relative">
                                                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold">£</span>
                                                                        <Input 
                                                                            type="number"
                                                                            value={matchdayFee}
                                                                            onChange={(e) => setMatchdayFee(e.target.value)}
                                                                            className="bg-slate-900/60 border-slate-800 text-white pl-8 h-12"
                                                                            placeholder="e.g. 10"
                                                                        />
                                                                    </div>
                                                                    <p className="text-slate-500 text-xs">Default fee for pay-as-you-go matches.</p>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </>
                                                )}

                                                <div className="bg-slate-900/30 border border-slate-800 rounded-xl p-5 flex items-start justify-between gap-4">
                                                    <div className="space-y-1">
                                                        <Label className="text-white font-semibold flex items-center gap-1.5">
                                                            <Users className="w-4 h-4 text-rose-400" /> Player Contracts (Paid by Club)
                                                        </Label>
                                                        <p className="text-slate-400 text-xs leading-relaxed">
                                                            Does the club contract and pay any players (e.g. wages or expenses)?
                                                        </p>
                                                    </div>
                                                    <Switch 
                                                        checked={contractsEnabled} 
                                                        onCheckedChange={setContractsEnabled}
                                                        className="data-[state=checked]:bg-emerald-500 data-[state=unchecked]:bg-red-500"
                                                    />
                                                </div>

                                                <div className="bg-slate-900/30 border border-slate-800 rounded-xl p-5 flex items-start justify-between gap-4">
                                                    <div className="space-y-1">
                                                        <Label className="text-white font-semibold flex items-center gap-1.5">
                                                            <ShieldAlert className="w-4 h-4 text-amber-500" /> Fines Tracker Module
                                                        </Label>
                                                        <p className="text-slate-400 text-xs leading-relaxed">
                                                            Enable the squad fines board to track yellow cards, dirty boots, or late attendance penalties.
                                                        </p>
                                                    </div>
                                                    <Switch 
                                                        checked={finesEnabled} 
                                                        onCheckedChange={setFinesEnabled}
                                                        className="data-[state=checked]:bg-emerald-500 data-[state=unchecked]:bg-red-500"
                                                    />
                                                </div>
                                            </CardContent>
                                        </motion.div>
                                    )}

                                    {/* STEP 7: Squads */}
                                    {step === 7 && (
                                        <motion.div key="step5" {...animations}>
                                            <CardHeader className="space-y-2 pb-6 border-b border-slate-900">
                                                <CardTitle className="text-2xl font-extrabold text-white flex items-center gap-2">
                                                    <ShieldCheck className="text-slate-400 w-5 h-5" /> Squad Setup
                                                </CardTitle>
                                                <CardDescription className="text-slate-400 text-sm">
                                                    Select the squads you run to categorize players.
                                                </CardDescription>
                                            </CardHeader>
                                            <CardContent className="space-y-4 pt-6 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
                                                <div className="p-3.5 bg-slate-900/30 border border-slate-800 rounded-xl flex items-start gap-2.5 mb-2">
                                                    <Shield className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
                                                    <p className="text-xs text-slate-400 leading-relaxed">
                                                        <strong>Multi-Squad Selection:</strong> Players can belong to multiple squads (e.g. Saturday First Team & Midweek League) and will automatically filter across your matchday tactics sheets and squad lists.
                                                    </p>
                                                </div>
                                                <div className="grid grid-cols-2 gap-3">
                                                    {Array.from(new Set([...availableSquads, ...selectedSquads])).map(squad => {
                                                        const isSelected = selectedSquads.includes(squad);
                                                        return (
                                                            <div 
                                                                key={squad}
                                                                onClick={() => toggleSquad(squad)}
                                                                className={`p-3.5 rounded-xl cursor-pointer border-2 transition-all flex items-center gap-3 ${
                                                                    isSelected ? 'border-white bg-white/5' : 'border-slate-800 bg-slate-900/10 hover:border-slate-700'
                                                                }`}
                                                            >
                                                                <div className={`w-4 h-4 rounded border flex items-center justify-center ${isSelected ? 'bg-white border-white' : 'border-slate-700'}`}>
                                                                    {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-slate-950" />}
                                                                </div>
                                                                <span className={`text-sm font-semibold ${isSelected ? 'text-white' : 'text-slate-400'}`}>{squad}</span>
                                                            </div>
                                                        )
                                                    })}
                                                </div>

                                                <div className="flex gap-2 pt-2 border-t border-slate-900">
                                                    <Input 
                                                        placeholder="e.g. Under-12s, Veterans"
                                                        value={customSquadInput}
                                                        onChange={(e) => setCustomSquadInput(e.target.value)}
                                                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomSquad(); } }}
                                                        className="bg-slate-900/60 border-slate-800 text-white"
                                                    />
                                                    <Button 
                                                        type="button" 
                                                        onClick={addCustomSquad}
                                                        className="bg-slate-800 hover:bg-slate-700 text-white shrink-0"
                                                    >
                                                        Add
                                                    </Button>
                                                </div>
                                            </CardContent>
                                        </motion.div>
                                    )}

                                    {/* STEP 8: Staff & Committee */}
                                    {step === 8 && (
                                        <motion.div key="step6" {...animations}>
                                            <CardHeader className="space-y-2 pb-6 border-b border-slate-900">
                                                <CardTitle className="text-2xl font-extrabold text-white flex items-center gap-2">
                                                    <Users className="text-slate-400 w-5 h-5" /> Committee & Staff
                                                </CardTitle>
                                                <CardDescription className="text-slate-400 text-sm">
                                                    Add committee members or coaches (these can be updated later).
                                                </CardDescription>
                                            </CardHeader>
                                            <CardContent className="space-y-4 pt-6 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                                                {staffInvites.map((staff, idx) => (
                                                    <div key={idx} className="bg-slate-900/30 p-4 rounded-xl border border-slate-800 space-y-3 relative group">
                                                        <button 
                                                            type="button" 
                                                            onClick={() => removeStaffField(idx)} 
                                                            className="absolute top-2 right-2 text-slate-500 hover:text-red-400 transition-colors p-1"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                        <div className="grid grid-cols-2 gap-3">
                                                            <div className="space-y-1">
                                                                <Label className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Name</Label>
                                                                <Input 
                                                                    placeholder="Name" 
                                                                    value={staff.name}
                                                                    onChange={(e) => updateStaffField(idx, 'name', e.target.value)}
                                                                    className="bg-slate-900/60 border-slate-800 text-white" 
                                                                />
                                                            </div>
                                                            <div className="space-y-1">
                                                                <Label className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Role</Label>
                                                                <Input 
                                                                    placeholder="e.g. Secretary" 
                                                                    value={staff.role}
                                                                    onChange={(e) => updateStaffField(idx, 'role', e.target.value)}
                                                                    className="bg-slate-900/60 border-slate-800 text-white" 
                                                                />
                                                            </div>
                                                        </div>
                                                        <div className="space-y-1">
                                                            <Label className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Email</Label>
                                                            <Input 
                                                                type="email"
                                                                placeholder="Email" 
                                                                value={staff.email}
                                                                onChange={(e) => updateStaffField(idx, 'email', e.target.value)}
                                                                className="bg-slate-900/60 border-slate-800 text-white" 
                                                            />
                                                        </div>
                                                    </div>
                                                ))}
                                                <Button 
                                                    type="button" 
                                                    variant="outline" 
                                                    onClick={addStaffField}
                                                    className="w-full border-dashed border-2 border-slate-800 bg-transparent text-slate-400 hover:text-white hover:bg-slate-900 h-10 text-xs"
                                                >
                                                    + Add Another Staff
                                                </Button>
                                            </CardContent>
                                        </motion.div>
                                    )}

                                    {/* STEP 9: League Integration */}
                                    {step === 9 && (
                                        <motion.div key="step7" {...animations}>
                                            <CardHeader className="space-y-2 pb-6 border-b border-slate-900">
                                                <CardTitle className="text-2xl font-extrabold text-white flex items-center gap-2">
                                                    <Trophy className="text-slate-400 w-5 h-5" /> League Standings
                                                </CardTitle>
                                                <CardDescription className="text-slate-400 text-sm">
                                                    Connect your official FA standings page.
                                                </CardDescription>
                                            </CardHeader>
                                            <CardContent className="space-y-4 pt-6">
                                                <div className="space-y-2">
                                                    <Label htmlFor="leagueUrl" className="text-slate-300">League standings URL (Optional)</Label>
                                                    <Input
                                                        id="leagueUrl"
                                                        placeholder="e.g. https://fulltime.thefa.com/..."
                                                        value={leagueUrl}
                                                        onChange={(e) => setLeagueUrl(e.target.value)}
                                                        className="bg-slate-900/60 border-slate-800 text-white h-12"
                                                    />
                                                </div>
                                                <p className="text-slate-500 text-xs leading-relaxed">
                                                    Provide a public link to your division table so ClubFlow can sync and display live standings on your dashboard.
                                                </p>
                                            </CardContent>
                                        </motion.div>
                                    )}

                                    {/* STEP 10: Onboarding Success */}
                                    {step === 10 && (
                                        <motion.div
                                            key="step8"
                                            initial={{ opacity: 0, scale: 0.95 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            className="text-center"
                                        >
                                            <CardHeader className="pt-12 pb-6 flex flex-col items-center">
                                                <div className="mx-auto w-20 h-20 bg-teal-500/10 rounded-2xl flex items-center justify-center mb-6 border border-teal-500/30">
                                                    <CheckCircle2 className="h-10 w-10 text-teal-400" />
                                                </div>
                                                <CardTitle className="text-3xl font-extrabold text-white">Workspace Ready!</CardTitle>
                                                <CardDescription className="text-slate-400 text-base mt-2 max-w-sm mx-auto">
                                                    All settings are synchronized. You are ready to explore your new ClubFlow layout.
                                                </CardDescription>
                                            </CardHeader>
                                            <CardFooter className="p-8 border-t border-slate-900 mt-4 flex justify-center">
                                                <Button 
                                                    type="button"
                                                    onClick={() => router.push('/dashboard')}
                                                    className="w-full max-w-sm bg-white hover:bg-slate-100 text-slate-950 font-extrabold h-14 text-base shadow-lg transition-transform active:scale-[0.99]"
                                                >
                                                    Enter Dashboard
                                                </Button>
                                            </CardFooter>
                                        </motion.div>
                                    )}

                                </AnimatePresence>

                                {/* Footer navigation for steps 1-9 */}
                                {step < 10 && (
                                    <CardFooter className="bg-slate-950/40 p-4 border-t border-slate-900 flex justify-between gap-4">
                                        {step > 0 ? (
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
                                            <div />
                                        )}
                                        <div className="flex gap-2">
                                            {step > 1 && (
                                                <Button 
                                                    type="button" 
                                                    variant="outline"
                                                    onClick={step === totalSteps ? finalizeOnboarding : handleSkip}
                                                    className="border-slate-800 bg-slate-900/60 text-slate-300 hover:bg-slate-800 text-xs font-semibold"
                                                    disabled={isLoading}
                                                >
                                                    {step === totalSteps ? "I'll add this later" : "Skip for now"}
                                                </Button>
                                            )}
                                            <Button 
                                                type="button" 
                                                onClick={step === 0 ? handleNext : handleSaveAndNext}
                                                className="bg-white hover:bg-slate-100 text-slate-950 font-bold px-6 h-10 text-xs"
                                                disabled={isLoading}
                                            >
                                                {isLoading ? "Saving..." : step === 0 ? "Get Started" : step === totalSteps ? "Finish Setup" : "Next"}
                                            </Button>
                                        </div>
                                    </CardFooter>
                                )}
                            </Card>
                        </div>
                    </div>
                </div>
            </div>
        );
    }
