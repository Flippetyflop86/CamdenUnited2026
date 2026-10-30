"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { supabase, unproxiedSupabase, setGlobalClubId } from "@/lib/supabase";
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

const DEVICE_UI_PREF_KEYS = new Set([
    "clubflow-sidebar-expanded",
    "clubflow_squad_display_layout",
    "clubflow_calendar_collapsed"
]);

export function purgeUserAndClubStorage() {
    if (typeof window === "undefined") return;
    try {
        sessionStorage.clear();
        for (let i = localStorage.length - 1; i >= 0; i--) {
            const key = localStorage.key(i);
            if (
                key &&
                !DEVICE_UI_PREF_KEYS.has(key) &&
                (key.startsWith("clubflow_") || key.startsWith("clubflow-") || key.startsWith("clubflow_cache_"))
            ) {
                localStorage.removeItem(key);
            }
        }
    } catch (e) {
        console.warn("Storage cleanup failed:", e);
    }
}

const getCachedVal = (key: string, fallback: any, userId?: string | null) => {
    if (typeof window === 'undefined') return fallback;
    try {
        if (userId) {
            const scopedItem = localStorage.getItem(`clubflow_cache_${userId}_${key}`);
            if (scopedItem) return JSON.parse(scopedItem);
        }
        const item = localStorage.getItem(`clubflow_cache_${key}`);
        return item ? JSON.parse(item) : fallback;
    } catch (e) {
        return fallback;
    }
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUserState] = useState<User | null>(null);
    const userRef = useRef<User | null>(null);
    const setUser = (u: User | null) => {
        userRef.current = u;
        setUserState(u);
    };
    const [session, setSession] = useState<Session | null>(null);
    const [clubId, setClubId] = useState<string | null>(null);
    const [role, setRole] = useState<string | null>(null);
    const [pagePermissions, setPagePermissions] = useState<string[]>([]);
    const [displayName, setDisplayName] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
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

    const fetchClubMembership = async (userId: string, userEmail?: string, providedToken?: string) => {
        // Only set loading to true if we don't already have a cached club ID
        if (!clubId) {
            setIsLoading(true);
        }
        
        try {
            let token = providedToken;
            if (!token) {
                const { data: { session: currentSession } } = await supabase.auth.getSession();
                token = currentSession?.access_token;
            }

            if (!token) {
                console.warn("No access token found for membership fetch");
                setIsLoading(false);
                return;
            }

            let finalMember = null;
            try {
                const res = await fetch("/api/auth/sync", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${token}`
                    }
                });

                if (res.ok) {
                    const result = await res.json();
                    console.warn("fetchClubMembership API resolved:", { userId, userEmail, result });
                    finalMember = result.success ? result.membership : null;
                } else {
                    console.warn(`Sync API returned status ${res.status}`);
                }
            } catch (syncErr) {
                console.error("Sync API request failed, falling back to client query:", syncErr);
            }

            // Client-side fallback if backend API didn't resolve a membership (e.g. Service Role Key not set on host)
            if (!finalMember) {
                console.warn("Sync API did not return membership, attempting client-side fallback query...");
                const { data: fallbackData, error: fallbackError } = await unproxiedSupabase
                    .from("club_members")
                    .select("id, club_id, role, page_permissions, display_name, user_id")
                    .or(`user_id.eq.${userId},email.ilike.${userEmail}`)
                    .limit(1)
                    .maybeSingle();

                if (fallbackError) {
                    console.error("Client-side fallback query failed:", fallbackError);
                }

                if (fallbackData) {
                    console.warn("Client-side fallback query succeeded:", fallbackData);
                    
                    // Client-side auto-heal update (allowed if RLS email policy is active)
                    if (fallbackData.user_id !== userId) {
                        console.warn("Auto-healing user_id on client for email:", userEmail);
                        await unproxiedSupabase
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
                        // Scoped by userId + active pointer for synchronous supabase client proxy
                        localStorage.setItem(`clubflow_cache_${userId}_clubId`, JSON.stringify(data.club_id));
                        localStorage.setItem(`clubflow_cache_${userId}_role`, JSON.stringify(finalRole));
                        localStorage.setItem(`clubflow_cache_${userId}_pagePermissions`, JSON.stringify(finalPerms));
                        localStorage.setItem(`clubflow_cache_${userId}_displayName`, JSON.stringify(finalDisplayName));
                        localStorage.setItem("clubflow_cache_clubId", JSON.stringify(data.club_id));
                        localStorage.setItem("clubflow_cache_role", JSON.stringify(finalRole));
                        localStorage.setItem("clubflow_cache_pagePermissions", JSON.stringify(finalPerms));
                        localStorage.setItem("clubflow_cache_displayName", JSON.stringify(finalDisplayName));
                    } catch (e) {}
                }
            } else {
                console.warn("No membership found in club_members table for user_id:", userId, "email:", userEmail);
                setClubId(null);
                setGlobalClubId(null);
                setRole(null);
                setPagePermissions([]);
                setDisplayName(null);
                if (typeof window !== 'undefined') {
                    try {
                        localStorage.removeItem(`clubflow_cache_${userId}_clubId`);
                        localStorage.removeItem(`clubflow_cache_${userId}_role`);
                        localStorage.removeItem(`clubflow_cache_${userId}_pagePermissions`);
                        localStorage.removeItem(`clubflow_cache_${userId}_displayName`);
                        localStorage.removeItem("clubflow_cache_clubId");
                        localStorage.removeItem("clubflow_cache_role");
                        localStorage.removeItem("clubflow_cache_pagePermissions");
                        localStorage.removeItem("clubflow_cache_displayName");
                    } catch (e) {}
                }
            }
            setIsLoading(false);
        } catch (error: any) {
            console.error("Failed to load club membership:", error);
            setIsLoading(false);
        }
    };

    // Exposed so the admin panel can trigger a re-fetch after changing permissions
    const refreshPermissions = async () => {
        if (user) await fetchClubMembership(user.id, user.email, session?.access_token);
    };

    useEffect(() => {
        // Hydrate cached auth state on client mount (avoids SSR hydration mismatch)
        const cachedUser = getCachedVal('user', null);
        const cachedUserId: string | null = cachedUser?.id ?? null;
        const cachedClubId = getCachedVal('clubId', null, cachedUserId);
        const cachedRole = getCachedVal('role', null, cachedUserId);
        const cachedPerms = getCachedVal('pagePermissions', [], cachedUserId);
        const cachedDisplayName = getCachedVal('displayName', null, cachedUserId);

        if (cachedUser) setUser(cachedUser);
        if (cachedClubId) {
            setClubId(cachedClubId);
            setGlobalClubId(cachedClubId);
        }
        if (cachedRole) setRole(cachedRole);
        if (Array.isArray(cachedPerms)) setPagePermissions(cachedPerms);
        if (cachedDisplayName) setDisplayName(cachedDisplayName);
        if (cachedUser && cachedClubId) {
            setIsLoading(false);
        }

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
            const activeUser = session?.user ?? null;

            // If session belongs to a different user than what was cached in localStorage, purge stale cache first
            if (activeUser && cachedUserId && activeUser.id !== cachedUserId) {
                purgeUserAndClubStorage();
                setClubId(null);
                setGlobalClubId(null);
                setRole(null);
                setPagePermissions([]);
                setDisplayName(null);
            }

            setUser(activeUser);
            if (activeUser) {
                if (typeof window !== 'undefined') {
                    try {
                        localStorage.setItem("clubflow_cache_user", JSON.stringify(activeUser));
                    } catch (e) {}
                }
                fetchClubMembership(activeUser.id, activeUser.email, session?.access_token);
            } else {
                // Session expired or logged out — purge any leftover cached user/club state
                setClubId(null);
                setGlobalClubId(null);
                setRole(null);
                setPagePermissions([]);
                setDisplayName(null);
                purgeUserAndClubStorage();
                setIsLoading(false);
                if (!isPublicPage(pathnameRef.current)) {
                    router.push("/login");
                }
            }
        }).catch(err => {
            const isAbort = err?.name === 'AbortError' || err?.message?.includes('signal is aborted');
            if (isAbort) {
                return;
            }
            console.error("Failed to get auth session on mount:", err);
            setIsLoading(false);
            if (!isPublicPage(pathnameRef.current)) {
                router.push("/login");
            }
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            const nextUser = session?.user ?? null;
            const previousUser = userRef.current;
            const accountSwitched = Boolean(previousUser && nextUser && previousUser.id !== nextUser.id);
            const isFirstSessionResolve = !previousUser && Boolean(nextUser);
            
            setUser(nextUser);
            
            if (nextUser) {
                setIsLoggingOut(false);
                
                // Clear any stored browser settings/states ONLY when switching between two different user accounts
                if (accountSwitched) {
                    purgeUserAndClubStorage();
                    setClubId(null);
                    setGlobalClubId(null);
                    setRole(null);
                    setPagePermissions([]);
                    setDisplayName(null);
                }

                if (typeof window !== 'undefined') {
                    try {
                        localStorage.setItem("clubflow_cache_user", JSON.stringify(nextUser));
                    } catch (e) {}
                }

                // Fetch membership outside GoTrueClient's synchronous lock
                if (accountSwitched || isFirstSessionResolve || _event === 'SIGNED_IN') {
                    const token = session?.access_token;
                    setTimeout(() => {
                        fetchClubMembership(nextUser.id, nextUser.email, token);
                    }, 0);
                }
            } else {
                setClubId(null);
                setGlobalClubId(null);
                setRole(null);
                setPagePermissions([]);
                setDisplayName(null);
                setIsLoading(false);
                purgeUserAndClubStorage();
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
        setClubId(null);
        setGlobalClubId(null);
        setRole(null);
        setPagePermissions([]);
        setDisplayName(null);
        try {
            await supabase.auth.signOut();
        } catch (e) {
            console.error("Supabase signOut error:", e);
        }
        purgeUserAndClubStorage();
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
