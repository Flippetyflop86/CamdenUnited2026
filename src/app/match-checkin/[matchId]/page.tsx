"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

export default function RedirectLegacyMatchCheckinPage() {
    const params = useParams();
    const router = useRouter();
    const matchId = Array.isArray(params?.matchId) ? params.matchId[0] : params?.matchId;

    useEffect(() => {
        if (matchId) {
            router.replace(`/respond/${matchId}`);
        }
    }, [matchId, router]);

    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
                <div className="h-8 w-8 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin" />
                <p className="text-slate-400 text-sm font-medium">Upgrading to secure responder...</p>
            </div>
        </div>
    );
}
