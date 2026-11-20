import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase";
import { isFormerPlayer } from "@/lib/utils";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
    _request: Request,
    context: { params: Promise<{ clubId: string }> }
) {
    try {
        const { clubId } = await context.params;
        if (!clubId || !UUID_RE.test(clubId)) {
            return NextResponse.json({ error: "Invalid club ID" }, { status: 400 });
        }

        const supabase = getServerSupabase();

        const [{ data: clubData, error: clubErr }, { data: playersData }, { data: paymentsData }] =
            await Promise.all([
                supabase
                    .from("clubs")
                    .select("id, name, logo, primary_color")
                    .eq("id", clubId)
                    .single(),
                supabase
                    .from("players")
                    .select("id, first_name, last_name, position, notes")
                    .eq("club_id", clubId)
                    .order("first_name", { ascending: true }),
                supabase
                    .from("player_payment_requests")
                    .select("id, player_id, amount, description, status, paid_at, created_at")
                    .eq("club_id", clubId)
                    .order("created_at", { ascending: false }),
            ]);

        if (clubErr || !clubData) {
            return NextResponse.json({ error: "Club not found" }, { status: 404 });
        }

        // Filter out former players server-side and strip internal coaching/medical `notes` before responding
        const safePlayers = (playersData || [])
            .filter((p: any) => !isFormerPlayer(p.notes))
            .map((p: any) => ({
                id: p.id,
                first_name: p.first_name,
                last_name: p.last_name,
                position: p.position || null,
            }));

        return NextResponse.json({
            club: clubData,
            players: safePlayers,
            payments: paymentsData || [],
        });
    } catch (err: any) {
        console.error("Public club pay portal fetch error:", err);
        return NextResponse.json(
            { error: "Unable to load club payment portal" },
            { status: 500 }
        );
    }
}
