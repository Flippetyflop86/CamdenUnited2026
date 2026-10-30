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

async function resolveAuthenticatedClubId(request: Request, supabaseAdmin: any, requestedClubId?: string | null): Promise<string | null> {
    const authHeader = request.headers.get("Authorization");
    const token = authHeader?.split(" ")[1];
    if (!token) return null;

    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) return null;

    let query = supabaseAdmin
        .from("club_members")
        .select("club_id")
        .eq("user_id", user.id);

    if (requestedClubId) {
        query = query.eq("club_id", requestedClubId);
    }

    const { data: member } = await query.limit(1).maybeSingle();
    return member?.club_id || null;
}

// GET: Fetch templates for a club
export async function GET(request: Request) {
    const supabaseAdmin = getAdminClient();
    try {
        const { searchParams } = new URL(request.url);
        const clubId = searchParams.get("clubId");

        if (!clubId) {
            return NextResponse.json({ success: false, error: "Club ID is required" }, { status: 400 });
        }

        const verifiedClubId = await resolveAuthenticatedClubId(request, supabaseAdmin, clubId);
        if (!verifiedClubId) {
            return NextResponse.json({ success: false, error: "Unauthorized access to club templates" }, { status: 403 });
        }

        const { data: templates, error } = await supabaseAdmin
            .from("email_templates")
            .select("*")
            .eq("club_id", verifiedClubId)
            .order("created_at", { ascending: false });

        if (error) throw error;

        return NextResponse.json({ success: true, templates });
    } catch (err: any) {
        console.error("Fetch templates error:", err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}

// POST: Create or Update a template
export async function POST(request: Request) {
    const supabaseAdmin = getAdminClient();
    try {
        const body = await request.json();
        const { id, clubId, name, subject, bodyContent } = body;

        if (!clubId || !name || !subject || !bodyContent) {
            return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
        }

        const verifiedClubId = await resolveAuthenticatedClubId(request, supabaseAdmin, clubId);
        if (!verifiedClubId) {
            return NextResponse.json({ success: false, error: "Unauthorized access to club templates" }, { status: 403 });
        }

        if (id) {
            const { data: template, error } = await supabaseAdmin
                .from("email_templates")
                .update({
                    name,
                    subject,
                    body_content: bodyContent,
                    updated_at: new Date().toISOString()
                })
                .eq("id", id)
                .eq("club_id", verifiedClubId)
                .select()
                .single();

            if (error) throw error;
            return NextResponse.json({ success: true, template });
        } else {
            const { data: template, error } = await supabaseAdmin
                .from("email_templates")
                .insert({
                    club_id: verifiedClubId,
                    name,
                    subject,
                    body_content: bodyContent
                })
                .select()
                .single();

            if (error) throw error;
            return NextResponse.json({ success: true, template });
        }
    } catch (err: any) {
        console.error("Save template error:", err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}

// DELETE: Remove a template
export async function DELETE(request: Request) {
    const supabaseAdmin = getAdminClient();
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get("id");
        const clubId = searchParams.get("clubId");

        if (!id) {
            return NextResponse.json({ success: false, error: "Template ID is required" }, { status: 400 });
        }

        const verifiedClubId = await resolveAuthenticatedClubId(request, supabaseAdmin, clubId);
        if (!verifiedClubId) {
            return NextResponse.json({ success: false, error: "Unauthorized access to club templates" }, { status: 403 });
        }

        const { error } = await supabaseAdmin
            .from("email_templates")
            .delete()
            .eq("id", id)
            .eq("club_id", verifiedClubId);

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (err: any) {
        console.error("Delete template error:", err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
