import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getAdminClient() {
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!key) {
        console.warn("SUPABASE_SERVICE_ROLE_KEY environment variable is missing on the server. Falling back to Anon Key.");
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

export async function POST(request: Request) {
    try {
        const supabase = getAdminClient();
        const authHeader = request.headers.get("Authorization");
        const token = authHeader?.split(" ")[1];
        if (!token) {
            return NextResponse.json({ success: false, error: "Unauthorized: Missing token" }, { status: 401 });
        }

        // 1. Verify user token
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) {
            return NextResponse.json({ success: false, error: "Unauthorized: Invalid token" }, { status: 401 });
        }

        // 2. Query club_members (bypassing RLS with service role key)
        const { data: member, error: memberError } = await supabase
            .from("club_members")
            .select("id, club_id, role, page_permissions, display_name, user_id")
            .or(`user_id.eq.${user.id},email.eq.${user.email}`)
            .maybeSingle();

        if (memberError) {
            console.error("Database query error in sync API:", memberError);
            return NextResponse.json({ success: false, error: memberError.message }, { status: 500 });
        }

        if (member) {
            // 3. Auto-heal/sync user_id if it mismatches
            if (member.user_id !== user.id) {
                console.log(`Syncing user_id in club_members for email ${user.email} from ${member.user_id} to ${user.id}`);
                const { error: updateError } = await supabase
                    .from("club_members")
                    .update({ user_id: user.id })
                    .eq("id", member.id);

                if (updateError) {
                    console.error("Failed to update user_id in sync API:", updateError);
                }
            }

            return NextResponse.json({
                success: true,
                membership: {
                    club_id: member.club_id,
                    role: member.role,
                    page_permissions: member.page_permissions || [],
                    display_name: member.display_name || null
                }
            });
        }

        return NextResponse.json({ success: true, membership: null });
    } catch (err: any) {
        console.error("Unhandled error in auth sync API:", err);
        return NextResponse.json({ success: false, error: err.message || "Server error" }, { status: 500 });
    }
}
