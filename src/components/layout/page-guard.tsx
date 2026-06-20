"use client";

import { useAuth } from "@/context/auth-context";
import { canAccess } from "@/lib/permissions";
import { usePathname } from "next/navigation";
import { Lock } from "lucide-react";

interface PageGuardProps {
    children: React.ReactNode;
}

/**
 * Wrap any page with this component to enforce permission checks.
 * Managers always pass through. Staff only see pages they've been granted.
 */
export function PageGuard({ children }: PageGuardProps) {
    const { role, pagePermissions, isLoading } = useAuth();
    const pathname = usePathname();

    // While auth is loading, render nothing (prevents flash)
    if (isLoading) return null;

    // Check access
    if (!canAccess(pathname, role, pagePermissions)) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
                <div className="h-16 w-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                    <Lock className="h-8 w-8 text-slate-400" />
                </div>
                <h2 className="text-xl font-bold text-slate-800 mb-2">Access Restricted</h2>
                <p className="text-slate-500 max-w-sm">
                    You don't have permission to view this section. Contact your club manager to request access.
                </p>
            </div>
        );
    }

    return <>{children}</>;
}
