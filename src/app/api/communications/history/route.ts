import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getAdminClient() {
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!key) {
        return createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );
    }
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        key
    );
}

async function verifyClubAccess(request: Request, supabaseAdmin: any, targetClubId: string): Promise<boolean> {
    const authHeader = request.headers.get("Authorization");
    const token = authHeader?.split(" ")[1];
    if (!token) return false;

    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) return false;

    const { data: member } = await supabaseAdmin
        .from("club_members")
        .select("club_id")
        .eq("user_id", user.id)
        .eq("club_id", targetClubId)
        .maybeSingle();

    return Boolean(member);
}

export async function GET(request: Request) {
    const supabaseAdmin = getAdminClient();
    try {
        const { searchParams } = new URL(request.url);
        const clubId = searchParams.get("clubId");

        if (!clubId) {
            return NextResponse.json({ success: false, error: "Club ID is required" }, { status: 400 });
        }

        const hasAccess = await verifyClubAccess(request, supabaseAdmin, clubId);
        if (!hasAccess) {
            return NextResponse.json({ success: false, error: "Unauthorized access to club communications" }, { status: 403 });
        }

        const { data: history, error } = await supabaseAdmin
            .from("email_history")
            .select("*")
            .eq("club_id", clubId)
            .order("created_at", { ascending: false });

        if (error) {
            if (error.code === "P0001" || error.message.includes("does not exist")) {
                return NextResponse.json({
                    success: false,
                    error: "Email system tables are not set up. Please run the SQL migration script in your Supabase Editor first.",
                    needsSetup: true
                }, { status: 200 });
            }
            throw error;
        }

        let totalSent = 0;
        let totalDelivered = 0;
        let totalFailed = 0;

        (history || []).forEach((item: any) => {
            totalSent += item.recipients_count;
            if (item.status === "Delivered") {
                totalDelivered += item.recipients_count;
            } else if (item.status === "Failed") {
                totalFailed += item.recipients_count;
            }
        });

        return NextResponse.json({
            success: true,
            history,
            analytics: {
                sent: totalSent,
                delivered: totalDelivered,
                failed: totalFailed,
                bounceRate: totalSent > 0 ? ((totalFailed / totalSent) * 100).toFixed(1) + "%" : "0.0%"
            }
        });
    } catch (err: any) {
        console.error("Fetch email history error:", err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
