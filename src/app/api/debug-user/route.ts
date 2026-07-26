import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getAdminClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const targetEmail = searchParams.get("email");
        
        const supabase = getAdminClient();
        
        if (targetEmail) {
            const { data: member } = await supabase
                .from("club_members")
                .select("*")
                .ilike("email", targetEmail);
            return NextResponse.json({
                queryEmail: targetEmail,
                member
            });
        }
            
        // Let's search all members to see what emails exist
        const { data: allMembers } = await supabase
            .from("club_members")
            .select("*");
            
        return NextResponse.json({
            allMembersCount: allMembers?.length || 0,
            allMembers: allMembers || []
        });
    } catch (e: any) {
        return NextResponse.json({ error: e.message });
    }
}
