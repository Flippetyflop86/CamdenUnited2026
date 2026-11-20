import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
    _request: Request,
    context: { params: Promise<{ paymentId: string }> }
) {
    try {
        const { paymentId } = await context.params;
        if (!paymentId || !UUID_RE.test(paymentId)) {
            return NextResponse.json({ error: "Invalid payment ID" }, { status: 400 });
        }

        const supabase = getServerSupabase();
        const { data: payData, error: payErr } = await supabase
            .from("player_payment_requests")
            .select("id, player_id, club_id, amount, description, status, paid_at, created_at")
            .eq("id", paymentId)
            .single();

        if (payErr || !payData) {
            return NextResponse.json({ error: "Payment request not found" }, { status: 404 });
        }

        const [{ data: playerData }, { data: clubData }] = await Promise.all([
            supabase
                .from("players")
                .select("id, first_name, last_name")
                .eq("id", payData.player_id)
                .single(),
            supabase
                .from("clubs")
                .select("id, name, logo, primary_color")
                .eq("id", payData.club_id)
                .single(),
        ]);

        return NextResponse.json({
            payment: payData,
            player: playerData || null,
            club: clubData || null,
        });
    } catch (err: any) {
        console.error("Public pay fetch error:", err);
        return NextResponse.json(
            { error: "Unable to load payment request" },
            { status: 500 }
        );
    }
}
