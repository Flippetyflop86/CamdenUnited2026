import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(request: Request) {
    try {
        const authHeader = request.headers.get("Authorization");
        const token = authHeader?.split(" ")[1];
        if (!token) {
            return NextResponse.json({ success: false, error: "Unauthorized: Missing token" }, { status: 401 });
        }

        // 1. Verify coach session
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) {
            return NextResponse.json({ success: false, error: "Unauthorized: Invalid token" }, { status: 401 });
        }

        // 2. Verify role
        const { data: member, error: memberError } = await supabase
            .from("club_members")
            .select("club_id, role")
            .eq("user_id", user.id)
            .single();

        if (memberError || !member) {
            return NextResponse.json({ success: false, error: "Forbidden: Verification failed" }, { status: 403 });
        }

        const roleClean = (member.role || "").toLowerCase();
        if (roleClean !== "manager" && roleClean !== "super admin" && roleClean !== "coach") {
            return NextResponse.json({ success: false, error: "Forbidden: Restricted to manager/coach" }, { status: 403 });
        }

        const body = await request.json();
        const { clubId } = body;

        if (!clubId || clubId !== member.club_id) {
            return NextResponse.json({ success: false, error: "Invalid club context" }, { status: 400 });
        }

        // 3. Get all player auth user IDs in this club
        const { data: players, error: fetchErr } = await supabase
            .from("players")
            .select("id, user_id")
            .eq("club_id", clubId);

        if (fetchErr) throw fetchErr;

        const userIdsToUnlink = (players || [])
            .map(p => p.user_id)
            .filter((uid): uid is string => !!uid);

        // 4. Update squad profiles to reset status to Pending Invitation and unlink user_id
        const { error: unlinkErr } = await supabase
            .from("players")
            .update({
                user_id: null,
                status: "Pending Invitation"
            })
            .eq("club_id", clubId);

        if (unlinkErr) throw unlinkErr;

        // 5. Delete corresponding club_members entries for player roles
        if (userIdsToUnlink.length > 0) {
            await supabase
                .from("club_members")
                .delete()
                .eq("club_id", clubId)
                .eq("role", "Player")
                .in("user_id", userIdsToUnlink);
        }

        return NextResponse.json({ success: true, message: `Successfully reset player accounts for the entire club.` });

    } catch (err: any) {
        console.error("Reset players error:", err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
