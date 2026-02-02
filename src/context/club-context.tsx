"use client";

import { createContext, useContext, useEffect, useState } from "react";

interface ClubSettings {
    name: string;
    logo: string | null;
    primaryColor: string;
    financeStartingBalance?: number;
}

interface ClubContextType {
    settings: ClubSettings;
    updateSettings: (newSettings: Partial<ClubSettings>) => void;
}

const defaultSettings: ClubSettings = {
    name: "The CAM-DEN",
    logo: "/logo-2.jpeg",
    primaryColor: "#ef4444" // red-500
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
                const { data, error } = await supabase
                    .from("club_settings")
                    .select("*")
                    .eq("id", 1)
                    .single();

                if (data) {
                    setSettings({
                        name: data.name,
                        logo: data.logo || "/logo-2.jpeg",
                        primaryColor: data.primary_color, // Map snake_case to camelCase
                        financeStartingBalance: 0 // Not yet in schema, keeping default
                    });
                }
            } catch (err) {
                console.error("Error loading settings:", err);
            } finally {
                setIsLoaded(true);
            }
        }

        fetchSettings();

        // Real-time Subscription
        const channel = supabase
            .channel("club_settings_changes")
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "club_settings",
                    filter: "id=eq.1"
                },
                (payload) => {
                    // Update local state when DB changes
                    const newData = payload.new as any;
                    if (newData) {
                        setSettings(prev => ({
                            ...prev,
                            name: newData.name,
                            logo: newData.logo,
                            primaryColor: newData.primary_color
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
        const { error } = await supabase
            .from("club_settings")
            .upsert({
                id: 1,
                name: updated.name,
                logo: updated.logo,
                primary_color: updated.primaryColor
            });

        if (error) {
            console.error("Failed to save settings:", error);
            // Revert on error? For now, we trust optimism.
        }
    };

    if (!isLoaded) {
        return null; // Or a loading spinner
    }

    return (
        <ClubContext.Provider value={{ settings, updateSettings }}>
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
