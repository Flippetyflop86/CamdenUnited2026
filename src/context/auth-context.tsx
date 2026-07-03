"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { supabase, setGlobalClubId } from "@/lib/supabase";
import { Session, User } from "@supabase/supabase-js";
import { useRouter, usePathname } from "next/navigation";

interface AuthContextType {
    user: User | null;
    session: Session | null;
    clubId: string | null;
    role: string | null;
    pagePermissions: string[]; // Array of permission keys the user can access
    isManager: boolean;        // Shorthand: true if role === 'manager'
    displayName: string | null;
    isLoading: boolean;
    signOut: () => Promise<void>;
    refreshPermissions: () => Promise<void>; // Call after admin changes permissions
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [clubId, setClubId] = useState<string | null>(null);
    const [role, setRole] = useState<string | null>(null);
    const [pagePermissions, setPagePermissions] = useState<string[]>([]);
    const [displayName, setDisplayName] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const router = useRouter();
    const pathname = usePathname();
    const pathnameRef = useRef(pathname);
    useEffect(() => { pathnameRef.current = pathname; }, [pathname]);

    const isPublicPage = (path: string) => {
        const AUTH_PAGES = ["/login", "/signup", "/reset-password", "/update-password", "/join", "/signup/player"];
        if (!path) return false;
        return AUTH_PAGES.includes(path) || 
               path.startsWith("/checkin") || 
               path.startsWith("/match-checkin") || 
               path.startsWith("/respond");
    };

    const fetchClubMembership = async (userId: string) => {
        setGlobalClubId(null);
        try {
            const { data, error } = await supabase
                .from("club_members")
                .select("club_id, role, page_permissions, display_name")
                .eq("user_id", userId)
                .single();

            const isAbortError = 
                error && (
                    (error as any).name === 'AbortError' || 
                    error.message?.includes('AbortError') || 
                    error.message?.includes('signal is aborted')
                );

            if (error && error.code !== 'PGRST116' && !isAbortError) {
                console.error("Error fetching club membership:", error.message, error.details, error.hint, error.code);
            }

            if (data) {
                setClubId(data.club_id);
                setGlobalClubId(data.club_id);
                setRole(data.role ? data.role.toLowerCase() : null);
                setPagePermissions(data.page_permissions || []);
                setDisplayName(data.display_name || null);
            }
        } catch (error) {
            console.error("Failed to load club membership:", error);
        } finally {
            setIsLoading(false);
        }
    };

    // Exposed so the admin panel can trigger a re-fetch after changing permissions
    const refreshPermissions = async () => {
        if (user) await fetchClubMembership(user.id);
    };

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setUser(session?.user ?? null);
            if (session?.user) {
                fetchClubMembership(session.user.id);
            } else {
                setIsLoading(false);
                if (!isPublicPage(pathnameRef.current)) {
                    router.push("/login");
                }
            }
        }).catch(err => {
            const isAbort = err?.name === 'AbortError' || err?.message?.includes('signal is aborted');
            if (!isAbort) {
                console.error("Failed to get auth session on mount:", err);
            }
            setIsLoading(false);
            if (!isPublicPage(pathnameRef.current)) {
                router.push("/login");
            }
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            setUser(session?.user ?? null);
            if (session?.user) {
                // Clear any stored browser settings/states when switching user accounts to prevent leaks
                if (typeof window !== 'undefined') {
                    sessionStorage.clear();
                    for (let i = localStorage.length - 1; i >= 0; i--) {
                        const key = localStorage.key(i);
                        if (key && key.startsWith('clubflow_')) {
                            localStorage.removeItem(key);
                        }
                    }
                }
                fetchClubMembership(session.user.id);
            } else {
                setClubId(null);
                setGlobalClubId(null);
                setRole(null);
                setPagePermissions([]);
                setDisplayName(null);
                setIsLoading(false);
                if (!isPublicPage(pathnameRef.current)) {
                    router.push("/login");
                }
            }
        });

        return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const signOut = async () => {
        await supabase.auth.signOut();
        if (typeof window !== 'undefined') {
            sessionStorage.clear();
            for (let i = localStorage.length - 1; i >= 0; i--) {
                const key = localStorage.key(i);
                if (key && key.startsWith('clubflow_')) {
                    localStorage.removeItem(key);
                }
            }
        }
        router.push("/login");
    };

    const isManager = role === "manager";

    return (
        <AuthContext.Provider value={{
            user, session, clubId, role, pagePermissions, isManager,
            displayName, isLoading, signOut, refreshPermissions
        }}>
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
