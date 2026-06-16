"use client";

import { createContext, useContext, useEffect, useState } from "react";

interface ClubSettings {
    name: string;
    logo: string | null;
    primaryColor: string;
    financeStartingBalance?: number;
    isOnboarded: boolean;
    leagueUrl: string | null;
    leaguePosition: number | null;
    squads: string[];
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
    isOnboarded: false,
    leagueUrl: null,
    leaguePosition: null,
    squads: ["First Team", "Academy"]
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
                        isOnboarded: data.is_onboarded || false,
                        leagueUrl: data.league_url || null,
                        leaguePosition: data.league_position || null,
                        squads: data.squads || ["First Team", "Academy"]
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
                            isOnboarded: newData.is_onboarded ?? prev.isOnboarded,
                            leagueUrl: newData.league_url ?? prev.leagueUrl,
                            leaguePosition: newData.league_position ?? prev.leaguePosition,
                            squads: newData.squads || prev.squads
                        }));
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const updateSettings = async (newSettings: Partial<ClubSettings>) => {
        // Optimistic Update
        const updated = { ...settings, ...newSettings };
        setSettings(updated);

        // Update DB
        const updates: any = {
            name: updated.name,
            logo: updated.logo,
            primary_color: updated.primaryColor,
            is_onboarded: updated.isOnboarded,
            league_url: updated.leagueUrl,
            league_position: updated.leaguePosition
        };
        if ('squads' in newSettings) updates.squads = newSettings.squads;

        const { error } = await supabase
            .from("clubs")
            .update(updates)
            // A simple trick to update our own row without knowing its UUID
            .neq("name", "FORCE_UPDATE_EVERYTHING");

        if (error) {
            console.error("Failed to save settings:", error);
            throw error;
        }
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
