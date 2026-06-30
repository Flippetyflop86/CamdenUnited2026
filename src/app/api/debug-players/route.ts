import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET() {
    try {
        const { data: players, error: pErr } = await supabase.from("players").select("*");
        const { data: recruits, error: rErr } = await supabase.from("recruits").select("*");

        console.log("=== DEBUG PLAYERS ===");
        const matchingPlayers = players?.filter(p => 
            (p.last_name || "").toLowerCase().includes("thorpe") || 
            (p.first_name || "").toLowerCase().includes("ralford")
        ) || [];

        console.log("=== DEBUG RECRUITS ===");
        const matchingRecruits = recruits?.filter(r => 
            (r.name || "").toLowerCase().includes("thorpe") || 
            (r.name || "").toLowerCase().includes("ralford")
        ) || [];

        return NextResponse.json({
            success: true,
            matchingPlayers,
            matchingRecruits,
            allPlayersCount: players?.length || 0,
            allRecruitsCount: recruits?.length || 0,
            errors: { pErr, rErr }
        });
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message });
    }
}
