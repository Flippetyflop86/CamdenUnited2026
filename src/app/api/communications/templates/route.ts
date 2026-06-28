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

// GET: Fetch templates for a club
export async function GET(request: Request) {
    const supabaseAdmin = getAdminClient();
    try {
        const { searchParams } = new URL(request.url);
        const clubId = searchParams.get("clubId");

        if (!clubId) {
            return NextResponse.json({ success: false, error: "Club ID is required" }, { status: 400 });
        }

        const { data: templates, error } = await supabaseAdmin
            .from("email_templates")
            .select("*")
            .eq("club_id", clubId)
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

        if (id) {
            // Update
            const { data: template, error } = await supabaseAdmin
                .from("email_templates")
                .update({
                    name,
                    subject,
                    body_content: bodyContent,
                    updated_at: new Date().toISOString()
                })
                .eq("id", id)
                .select()
                .single();

            if (error) throw error;
            return NextResponse.json({ success: true, template });
        } else {
            // Create
            const { data: template, error } = await supabaseAdmin
                .from("email_templates")
                .insert({
                    club_id: clubId,
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

        if (!id) {
            return NextResponse.json({ success: false, error: "Template ID is required" }, { status: 400 });
        }

        const { error } = await supabaseAdmin
            .from("email_templates")
            .delete()
            .eq("id", id);

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (err: any) {
        console.error("Delete template error:", err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
