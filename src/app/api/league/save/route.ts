import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase";

export async function POST(request: Request) {
    try {
        const supabase = getServerSupabase();
        const authHeader = request.headers.get("authorization");
        const token = authHeader?.split(" ")[1];
        if (!token) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const {
            data: { user },
            error: authErr,
        } = await supabase.auth.getUser(token);
        if (authErr || !user) {
            return NextResponse.json({ success: false, error: "Invalid session" }, { status: 401 });
        }

        const { data: member } = await supabase
            .from("club_members")
            .select("club_id")
            .eq("user_id", user.id)
            .maybeSingle();

        if (!member?.club_id) {
            return NextResponse.json({ success: false, error: "Club membership not found" }, { status: 404 });
        }

        const clubId = member.club_id;
        const body = await request.json();
        const { teams, connectedUrl } = body as { teams?: any[]; connectedUrl?: string };

        if (!Array.isArray(teams) || teams.length === 0) {
            return NextResponse.json({ success: false, error: "No league rows provided." }, { status: 400 });
        }

        const nowIso = new Date().toISOString();
        const payloadStr = JSON.stringify({
            teams,
            connectedUrl: connectedUrl || undefined,
            updatedAt: nowIso,
        });

        const { data: existingCache } = await supabase
            .from("documents")
            .select("id")
            .eq("club_id", clubId)
            .eq("category", "LEAGUE_TABLE_CACHE")
            .maybeSingle();

        if (existingCache?.id) {
            await supabase
                .from("documents")
                .update({ url: payloadStr, name: "League Standings Cache" })
                .eq("id", existingCache.id);
        } else {
            await supabase.from("documents").insert({
                club_id: clubId,
                name: "League Standings Cache",
                type: "JSON",
                category: "LEAGUE_TABLE_CACHE",
                url: payloadStr,
            });
        }

        const ourRow = teams.find((r: any) => r?.is_our_club && r?.position);
        if (ourRow?.position) {
            await supabase
                .from("clubs")
                .update({
                    league_position: ourRow.position,
                    ...(connectedUrl ? { league_url: connectedUrl } : {}),
                })
                .eq("id", clubId);
        }

        return NextResponse.json({ success: true, updatedAt: nowIso });
    } catch (error: any) {
        console.error("League Save Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error.message || "Failed to save league table.",
            },
            { status: 500 }
        );
    }
}
