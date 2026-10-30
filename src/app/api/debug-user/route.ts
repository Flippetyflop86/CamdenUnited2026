import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getAnonClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
}

export async function GET(request: Request) {
    try {
        const authHeader = request.headers.get("Authorization");
        const token = authHeader?.split(" ")[1];
        if (!token) {
            return NextResponse.json({ error: "Unauthorized: Missing authentication token" }, { status: 401 });
        }

        const supabase = getAnonClient();
        const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
        if (authErr || !user) {
            return NextResponse.json({ error: "Unauthorized: Invalid session token" }, { status: 401 });
        }

        const { data: member } = await supabase
            .from("club_members")
            .select("id, club_id, role, page_permissions, display_name, user_id")
            .eq("user_id", user.id);

        return NextResponse.json({
            userId: user.id,
            email: user.email,
            member: member || []
        });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

