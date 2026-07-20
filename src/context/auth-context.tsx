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
    isLoggingOut: boolean;
    signOut: () => Promise<void>;
    refreshPermissions: () => Promise<void>; // Call after admin changes permissions
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const getCachedVal = (key: string, fallback: any) => {
    if (typeof window === 'undefined') return fallback;
    try {
        const item = localStorage.getItem(`clubflow_cache_${key}`);
        return item ? JSON.parse(item) : fallback;
    } catch (e) {
        return fallback;
    }
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUserState] = useState<User | null>(() => getCachedVal('user', null));
    const userRef = useRef<User | null>(user);
    const setUser = (u: User | null) => {
        userRef.current = u;
        setUserState(u);
    };
    const [session, setSession] = useState<Session | null>(null);
    const [clubId, setClubId] = useState<string | null>(() => getCachedVal('clubId', null));
    const [role, setRole] = useState<string | null>(() => getCachedVal('role', null));
    const [pagePermissions, setPagePermissions] = useState<string[]>(() => getCachedVal('pagePermissions', []));
    const [displayName, setDisplayName] = useState<string | null>(() => getCachedVal('displayName', null));
    const [isLoading, setIsLoading] = useState(() => {
        if (typeof window === 'undefined') return true;
        try {
            const cachedUser = localStorage.getItem(`clubflow_cache_user`);
            const cachedClub = localStorage.getItem(`clubflow_cache_clubId`);
            return !(cachedUser && cachedClub);
        } catch (e) {
            return true;
        }
    });
    const [isLoggingOut, setIsLoggingOut] = useState(false);

    const router = useRouter();
    const pathname = usePathname();
    const pathnameRef = useRef(pathname);
    useEffect(() => { pathnameRef.current = pathname; }, [pathname]);

    const isPublicPage = (path: string) => {
        const AUTH_PAGES = ["", "/", "/login", "/signup", "/reset-password", "/update-password", "/join", "/signup/player"];
        let currentPath = path;
        if (typeof window !== 'undefined') {
            currentPath = window.location.pathname;
        }
        if (!currentPath) return false;

        // If the URL has an auth-handling hash, treat it as a public page to avoid redirecting to /login
        if (typeof window !== 'undefined' && window.location.hash) {
            const hash = window.location.hash;
            if (hash.includes("type=recovery") || hash.includes("access_token=")) {
                return true;
            }
        }

        const cleanPath = currentPath.endsWith("/") && currentPath.length > 1 ? currentPath.slice(0, -1) : currentPath;
        return AUTH_PAGES.includes(cleanPath) || 
               cleanPath.startsWith("/checkin") || 
               cleanPath.startsWith("/match-checkin") || 
               cleanPath.startsWith("/respond");
    };

    const fetchClubMembership = async (userId: string, userEmail?: string) => {
        setIsLoading(true);
        setGlobalClubId(null);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;

            if (!token) {
                console.warn("No access token found for membership fetch");
                setIsLoading(false);
                return;
            }

            const res = await fetch("/api/auth/sync", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                }
            });

            if (!res.ok) {
                throw new Error(`Sync API failed with status ${res.status}`);
            }

            const result = await res.json();
            console.warn("fetchClubMembership API resolved:", { userId, userEmail, result });

            let finalMember = result.success ? result.membership : null;

            // Client-side fallback if backend API didn't resolve a membership (e.g. Service Role Key not set on host)
            if (!finalMember) {
                console.warn("Sync API did not return membership, attempting client-side fallback query...");
                const { data: fallbackData, error: fallbackError } = await supabase
                    .from("club_members")
                    .select("id, club_id, role, page_permissions, display_name, user_id")
                    .or(`user_id.eq.${userId},email.ilike.${userEmail}`)
                    .maybeSingle();

                if (fallbackError) {
                    console.error("Client-side fallback query failed:", fallbackError);
                }

                if (fallbackData) {
                    console.warn("Client-side fallback query succeeded:", fallbackData);
                    
                    // Client-side auto-heal update (allowed if RLS email policy is active)
                    if (fallbackData.user_id !== userId) {
                        console.warn("Auto-healing user_id on client for email:", userEmail);
                        await supabase
                            .from("club_members")
                            .update({ user_id: userId })
                            .eq("id", fallbackData.id);
                    }

                    finalMember = {
                        club_id: fallbackData.club_id,
                        role: fallbackData.role,
                        page_permissions: fallbackData.page_permissions || [],
                        display_name: fallbackData.display_name || null
                    };
                }
            }

            if (finalMember) {
                const data = finalMember;
                setClubId(data.club_id);
                setGlobalClubId(data.club_id);
                const finalRole = data.role ? data.role.toLowerCase() : null;
                setRole(finalRole);
                const finalPerms = data.page_permissions || [];
                setPagePermissions(finalPerms);
                const finalDisplayName = data.display_name || null;
                setDisplayName(finalDisplayName);

                if (typeof window !== 'undefined') {
                    try {
                        localStorage.setItem("clubflow_cache_clubId", JSON.stringify(data.club_id));
                        localStorage.setItem("clubflow_cache_role", JSON.stringify(finalRole));
                        localStorage.setItem("clubflow_cache_pagePermissions", JSON.stringify(finalPerms));
                        localStorage.setItem("clubflow_cache_displayName", JSON.stringify(finalDisplayName));
                    } catch (e) {}
                }
            } else {
                console.warn("No membership found in club_members table for user_id:", userId, "email:", userEmail);
            }
            setIsLoading(false);
        } catch (error: any) {
            console.error("Failed to load club membership:", error);
            setIsLoading(false);
        }
    };

    // Exposed so the admin panel can trigger a re-fetch after changing permissions
    const refreshPermissions = async () => {
        if (user) await fetchClubMembership(user.id, user.email);
    };

    useEffect(() => {
        // Intercept password recovery or access token fragments and route them immediately to /update-password
        if (typeof window !== 'undefined' && window.location.hash) {
            const hash = window.location.hash;
            if (hash.includes("type=recovery") || hash.includes("access_token=")) {
                if (window.location.pathname !== "/update-password") {
                    router.replace("/update-password" + hash);
                }
            }
        }

        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setUser(session?.user ?? null);
            if (session?.user) {
                fetchClubMembership(session.user.id, session.user.email);
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
            const nextUser = session?.user ?? null;
            const previousUser = userRef.current;
            const userChanged = (!previousUser && nextUser) || (previousUser && nextUser && previousUser.id !== nextUser.id);
            
            setUser(nextUser);
            
            if (nextUser) {
                setIsLoggingOut(false);
                if (typeof window !== 'undefined') {
                    try {
                        localStorage.setItem("clubflow_cache_user", JSON.stringify(nextUser));
                    } catch (e) {}
                }
                if (userChanged) {
                    // Clear any stored browser settings/states when switching user accounts to prevent leaks
                    if (typeof window !== 'undefined') {
                        try {
                            sessionStorage.clear();
                            for (let i = localStorage.length - 1; i >= 0; i--) {
                                const key = localStorage.key(i);
                                if (key && (key.startsWith('clubflow_') || key.startsWith('clubflow_cache_'))) {
                                    localStorage.removeItem(key);
                                }
                            }
                        } catch (e) {
                            console.warn("Storage cleanup failed:", e);
                        }
                    }
                    fetchClubMembership(nextUser.id, nextUser.email);
                }
            } else {
                setClubId(null);
                setGlobalClubId(null);
                setRole(null);
                setPagePermissions([]);
                setDisplayName(null);
                setIsLoading(false);
                if (typeof window !== 'undefined') {
                    try {
                        for (let i = localStorage.length - 1; i >= 0; i--) {
                            const key = localStorage.key(i);
                            if (key && (key.startsWith('clubflow_') || key.startsWith('clubflow_cache_'))) {
                                localStorage.removeItem(key);
                            }
                        }
                    } catch (e) {}
                }
                if (!isPublicPage(pathnameRef.current)) {
                    router.push("/login");
                }
            }
        });

        return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const signOut = async () => {
        setIsLoggingOut(true);
        try {
            await supabase.auth.signOut();
        } catch (e) {
            console.error("Supabase signOut error:", e);
        }
        if (typeof window !== 'undefined') {
            try {
                sessionStorage.clear();
                for (let i = localStorage.length - 1; i >= 0; i--) {
                    const key = localStorage.key(i);
                    if (key && (key.startsWith('clubflow_') || key.startsWith('clubflow_cache_'))) {
                        localStorage.removeItem(key);
                    }
                }
            } catch (e) {
                console.warn("Storage cleanup on sign out failed:", e);
            }
        }
        router.push("/login");
    };

    const isManager = role === "manager";

    return (
        <AuthContext.Provider value={{
            user, session, clubId, role, pagePermissions, isManager,
            displayName, isLoading, isLoggingOut, signOut, refreshPermissions
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
