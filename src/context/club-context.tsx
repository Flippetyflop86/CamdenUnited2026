"use client";

import { createContext, useContext, useEffect, useState } from "react";

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
    finesEnabled: false
};

const ClubContext = createContext<ClubContextType | undefined>(undefined);

import { supabase } from "@/lib/supabase";

export function ClubProvider({ children }: { children: React.ReactNode }) {
    const [settings, setSettings] = useState<ClubSettings>(defaultSettings);
    const [isLoaded, setIsLoaded] = useState(false);

    // Initial Fetch
    useEffect(() => {
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
                        finesEnabled: data.fines_enabled || false
                    });
                }
            } catch (err) {
                console.error("Error loading settings:", err);
            } finally {
                setIsLoaded(true);
            }
        }

        fetchSettings();

        // Real-time Subscription to clubs table
        /*
        const channel = supabase
            .channel("club_changes")
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "clubs"
                },
                (payload) => {
                    const newData = payload.new as any;
                    if (newData) {
                        setSettings(prev => ({
                            ...prev,
                            name: newData.name || prev.name,
                            logo: newData.logo || null,
                            primaryColor: newData.primary_color || prev.primaryColor,
                            secondaryColor: newData.secondary_color || prev.secondaryColor,
                            isOnboarded: newData.is_onboarded ?? prev.isOnboarded,
                            leagueUrl: newData.league_url ?? prev.leagueUrl,
                            leaguePosition: newData.league_position ?? prev.leaguePosition,
                            squads: newData.squads || prev.squads,
                            homeKitShirt: newData.home_kit_shirt || prev.homeKitShirt,
                            homeKitShorts: newData.home_kit_shorts || prev.homeKitShorts,
                            homeKitSocks: newData.home_kit_socks || prev.homeKitSocks,
                            awayKitShirt: newData.away_kit_shirt || prev.awayKitShirt,
                            awayKitShorts: newData.away_kit_shorts || prev.awayKitShorts,
                            awayKitSocks: newData.away_kit_socks || prev.awayKitSocks,
                            sponsorLogo: newData.sponsor_logo || null,
                            monthlySubs: newData.monthly_subs ?? prev.monthlySubs,
                            finesEnabled: newData.fines_enabled ?? prev.finesEnabled
                        }));
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
        */
    }, []);

    const updateSettings = async (newSettings: Partial<ClubSettings>) => {
        // Update DB first
        const updates: any = {
            name: newSettings.name ?? settings.name,
            logo: newSettings.logo ?? settings.logo,
            primary_color: newSettings.primaryColor ?? settings.primaryColor,
            secondary_color: newSettings.secondaryColor ?? settings.secondaryColor,
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
            fines_enabled: newSettings.finesEnabled ?? settings.finesEnabled
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
        const updated = { ...settings, ...newSettings };
        setSettings(updated);
    };

    if (!isLoaded) {
        return null; // Or a loading spinner
    }

    return (
        <ClubContext.Provider value={{ settings, isLoaded, updateSettings }}>
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
