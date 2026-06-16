"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Session, User } from "@supabase/supabase-js";
import { useRouter, usePathname } from "next/navigation";

interface AuthContextType {
    user: User | null;
    session: Session | null;
    clubId: string | null;
    role: string | null;
    isLoading: boolean;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [clubId, setClubId] = useState<string | null>(null);
    const [role, setRole] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        // Get initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setUser(session?.user ?? null);
            if (session?.user) {
                fetchClubMembership(session.user.id);
            } else {
                setIsLoading(false);
                if (!["/login", "/signup", "/reset-password", "/update-password"].includes(pathname)) {
                    router.push("/login");
                }
            }
        });

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            setUser(session?.user ?? null);
            if (session?.user) {
                fetchClubMembership(session.user.id);
            } else {
                setClubId(null);
                setRole(null);
                setIsLoading(false);
                if (!["/login", "/signup", "/reset-password", "/update-password"].includes(pathname)) {
                    router.push("/login");
                }
            }
        });

        return () => subscription.unsubscribe();
    }, [pathname, router]);

    const fetchClubMembership = async (userId: string) => {
        try {
            const { data, error } = await supabase
                .from("club_members")
                .select("club_id, role")
                .eq("user_id", userId)
                .single();
            
            if (error && error.code !== 'PGRST116') {
                console.error("Error fetching club membership:", error);
            }

            if (data) {
                setClubId(data.club_id);
                setRole(data.role);
            } else if (pathname !== "/signup") {
                // If they have an auth account but no club member record yet
                // we should probably redirect them to an onboarding/signup flow
                // router.push("/signup");
            }
        } catch (error) {
            console.error("Failed to load club membership:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const signOut = async () => {
        await supabase.auth.signOut();
        router.push("/login");
    };

    return (
        <AuthContext.Provider value={{ user, session, clubId, role, isLoading, signOut }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
}
