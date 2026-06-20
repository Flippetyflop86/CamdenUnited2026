"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useAuth } from "./auth-context";

interface ClubSettings {
    name: string;
    logo: string | null;
    primaryColor: string;
    secondaryColor: string;
    financeStartingBalance?: number;
    isOnboarded: boolean;
    leagueUrl: string | null;
    leaguePosition: number | null;
    squads: string[];
    homeKitShirt: string;
    homeKitShorts: string;
    homeKitSocks: string;
    awayKitShirt: string;
    awayKitShorts: string;
    awayKitSocks: string;
    sponsorLogo: string | null;
    monthlySubs: number;
    finesEnabled: boolean;
    homeGround: string | null;
    foundingYear: number | null;
    twitterUrl: string | null;
    instagramUrl: string | null;
    whatsappPollMessage: string | null;
    fineCategories: { name: string, amount: number }[];
    notificationsEnabled: boolean;
    notificationEmail: string | null;
}

interface ClubContextType {
    settings: ClubSettings;
    isLoaded: boolean;
    updateSettings: (newSettings: Partial<ClubSettings>) => void;
}

const defaultSettings: ClubSettings = {
    name: "My Club",
    logo: null,
    primaryColor: "#ef4444", // red-500
    secondaryColor: "#0f172a", // slate-900
    isOnboarded: false,
    leagueUrl: null,
    leaguePosition: null,
    squads: ["First Team", "Academy"],
    homeKitShirt: "#ffffff",
    homeKitShorts: "#ffffff",
    homeKitSocks: "#ffffff",
    awayKitShirt: "#000000",
    awayKitShorts: "#000000",
    awayKitSocks: "#000000",
    sponsorLogo: null,
    monthlySubs: 0,
    finesEnabled: false,
    homeGround: null,
    foundingYear: null,
    twitterUrl: null,
    instagramUrl: null,
    whatsappPollMessage: null,
    fineCategories: [
        { name: "Yellow Card", amount: 10 },
        { name: "Red Card", amount: 25 },
        { name: "Late to Match", amount: 5 }
    ],
    notificationsEnabled: false,
    notificationEmail: null
};

const ClubContext = createContext<ClubContextType | undefined>(undefined);

import { supabase } from "@/lib/supabase";

function getDarkerColor(hex: string, percent = 15): string {
    let r = parseInt(hex.slice(1, 3), 16);
    let g = parseInt(hex.slice(3, 5), 16);
    let b = parseInt(hex.slice(5, 7), 16);
    
    r = Math.max(0, Math.floor(r * (1 - percent / 100)));
    g = Math.max(0, Math.floor(g * (1 - percent / 100)));
    b = Math.max(0, Math.floor(b * (1 - percent / 100)));
    
    const toHex = (c: number) => {
        const hexVal = c.toString(16);
        return hexVal.length === 1 ? "0" + hexVal : hexVal;
    };
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function generateSecondaryColor(hex: string): string {
    // Simple hue shift + saturation/lightness adjust for secondary complementary color
    let r = parseInt(hex.slice(1, 3), 16);
    let g = parseInt(hex.slice(3, 5), 16);
    let b = parseInt(hex.slice(5, 7), 16);
    
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;

    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }

    h = (h + 0.5) % 1; // 180 degrees shift
    l = l > 0.5 ? 0.2 : 0.8;
    
    const hue2rgb = (p: number, q: number, t: number) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;

    const r2 = Math.round(hue2rgb(p, q, h + 1/3) * 255);
    const g2 = Math.round(hue2rgb(p, q, h) * 255);
    const b2 = Math.round(hue2rgb(p, q, h - 1/3) * 255);

    const toHex = (c: number) => {
        const hexVal = c.toString(16);
        return hexVal.length === 1 ? "0" + hexVal : hexVal;
    };

    return `#${toHex(r2)}${toHex(g2)}${toHex(b2)}`;
}

export function ClubProvider({ children }: { children: React.ReactNode }) {
    const { user, clubId } = useAuth();
    const [settings, setSettings] = useState<ClubSettings>(defaultSettings);
    const [isLoaded, setIsLoaded] = useState(false);

    // Initial Fetch
    useEffect(() => {
        if (!user) {
            setSettings(defaultSettings);
            setIsLoaded(true);
            return;
        }

        async function fetchSettings() {
            try {
                // RLS automatically filters this to ONLY the current user's club
                const { data, error } = await supabase
                    .from("clubs")
                    .select("*")
                    .limit(1)
                    .single();

                if (data) {
                    setSettings({
                        name: data.name || "My Club",
                        logo: data.logo || null,
                        primaryColor: data.primary_color || "#ef4444",
                        secondaryColor: data.secondary_color || "#0f172a",
                        isOnboarded: data.is_onboarded || false,
                        leagueUrl: data.league_url || null,
                        leaguePosition: data.league_position || null,
                        squads: data.squads || ["First Team", "Academy"],
                        homeKitShirt: data.home_kit_shirt || "#ffffff",
                        homeKitShorts: data.home_kit_shorts || "#ffffff",
                        homeKitSocks: data.home_kit_socks || "#ffffff",
                        awayKitShirt: data.away_kit_shirt || "#000000",
                        awayKitShorts: data.away_kit_shorts || "#000000",
                        awayKitSocks: data.away_kit_socks || "#000000",
                        sponsorLogo: data.sponsor_logo || null,
                        monthlySubs: data.monthly_subs || 0,
                        finesEnabled: data.fines_enabled || false,
                        homeGround: data.home_ground || null,
                        foundingYear: data.founding_year || null,
                        twitterUrl: data.twitter_url || null,
                        instagramUrl: data.instagram_url || null,
                        whatsappPollMessage: data.whatsapp_poll_message || null,
                        fineCategories: data.fine_categories || defaultSettings.fineCategories,
                        notificationsEnabled: data.notifications_enabled || false,
                        notificationEmail: data.notification_email || null
                    });
                }
            } catch (err) {
                console.error("Error loading settings:", err);
            } finally {
                setIsLoaded(true);
            }
        }

        fetchSettings();
    }, [user, clubId]);

    const updateSettings = async (newSettings: Partial<ClubSettings>) => {
        let finalSecondaryColor = newSettings.secondaryColor ?? settings.secondaryColor;
        if (newSettings.primaryColor && !newSettings.secondaryColor) {
            finalSecondaryColor = generateSecondaryColor(newSettings.primaryColor);
        }

        // Update DB first
        const updates: any = {
            name: newSettings.name ?? settings.name,
            logo: newSettings.logo ?? settings.logo,
            primary_color: newSettings.primaryColor ?? settings.primaryColor,
            secondary_color: finalSecondaryColor,
            is_onboarded: newSettings.isOnboarded ?? settings.isOnboarded,
            league_url: newSettings.leagueUrl ?? settings.leagueUrl,
            league_position: newSettings.leaguePosition ?? settings.leaguePosition,
            home_kit_shirt: newSettings.homeKitShirt ?? settings.homeKitShirt,
            home_kit_shorts: newSettings.homeKitShorts ?? settings.homeKitShorts,
            home_kit_socks: newSettings.homeKitSocks ?? settings.homeKitSocks,
            away_kit_shirt: newSettings.awayKitShirt ?? settings.awayKitShirt,
            away_kit_shorts: newSettings.awayKitShorts ?? settings.awayKitShorts,
            away_kit_socks: newSettings.awayKitSocks ?? settings.awayKitSocks,
            sponsor_logo: newSettings.sponsorLogo ?? settings.sponsorLogo,
            monthly_subs: newSettings.monthlySubs ?? settings.monthlySubs,
            fines_enabled: newSettings.finesEnabled ?? settings.finesEnabled,
            home_ground: newSettings.homeGround ?? settings.homeGround,
            founding_year: newSettings.foundingYear ?? settings.foundingYear,
            twitter_url: newSettings.twitterUrl ?? settings.twitterUrl,
            instagram_url: newSettings.instagramUrl ?? settings.instagramUrl,
            whatsapp_poll_message: newSettings.whatsappPollMessage ?? settings.whatsappPollMessage,
            fine_categories: newSettings.fineCategories ?? settings.fineCategories,
            notifications_enabled: newSettings.notificationsEnabled ?? settings.notificationsEnabled,
            notification_email: newSettings.notificationEmail ?? settings.notificationEmail
        };
        if ('squads' in newSettings) updates.squads = newSettings.squads;

        // Check if row exists
        const { data: existing } = await supabase.from("clubs").select("id").limit(1).maybeSingle();

        let error;
        if (existing) {
            const { error: updateErr } = await supabase
                .from("clubs")
                .update(updates)
                .eq("id", existing.id);
            error = updateErr;
        } else {
            const { error: insertErr } = await supabase
                .from("clubs")
                .insert([updates]);
            error = insertErr;
        }

        if (error) {
            const errorObj = error as any;
            const errorMsg = errorObj.message || errorObj.details || JSON.stringify(errorObj);
            console.error("Failed to save settings:", errorMsg, errorObj);
            throw new Error(errorMsg);
        }

        // Apply Update to State after DB succeeds
        const updated = { ...settings, ...newSettings, secondaryColor: finalSecondaryColor };
        setSettings(updated);
    };

    if (!isLoaded) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                    <div className="h-8 w-8 rounded-full border-4 border-red-600 border-t-transparent animate-spin" />
                    <p className="text-slate-500 text-sm font-medium">Loading...</p>
                </div>
            </div>
        );
    }

    return (
        <ClubContext.Provider value={{ settings, isLoaded, updateSettings }}>
            {settings.primaryColor && (
                <style dangerouslySetInnerHTML={{ __html: `
                    .bg-red-600 { background-color: ${settings.primaryColor} !important; }
                    .hover\\:bg-red-700:hover { background-color: ${getDarkerColor(settings.primaryColor)} !important; }
                    .text-red-600, .text-red-500 { color: ${settings.primaryColor} !important; }
                    .border-red-500, .border-red-600 { border-color: ${settings.primaryColor} !important; }
                    .focus\\:ring-red-500:focus, .focus-visible\\:ring-red-500:focus-visible { --tw-ring-color: ${settings.primaryColor} !important; }
                    .shadow-red-900\\/50 { --tw-shadow-color: ${settings.primaryColor}40 !important; }
                `}} />
            )}
            {children}
        </ClubContext.Provider>
    );
}

export function useClub() {
    const context = useContext(ClubContext);
    if (context === undefined) {
        throw new Error("useClub must be used within a ClubProvider");
    }
    return context;
}

