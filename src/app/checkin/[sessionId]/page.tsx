"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

export default function RedirectLegacyCheckinPage() {
    const params = useParams();
    const router = useRouter();
    const sessionId = Array.isArray(params?.sessionId) ? params.sessionId[0] : params?.sessionId;

    useEffect(() => {
        if (sessionId) {
            router.replace(`/respond/${sessionId}`);
        }
    }, [sessionId, router]);

    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
                <div className="h-8 w-8 rounded-full border-4 border-red-600 border-t-transparent animate-spin" />
                <p className="text-slate-400 text-sm font-medium">Upgrading to secure responder...</p>
            </div>
        </div>
    );
}
