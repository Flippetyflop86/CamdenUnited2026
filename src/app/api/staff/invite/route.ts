import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase";
import { sendEmail } from "@/lib/email-service";

// Send an automatic invitation email to an invited coach/staff member
export async function POST(request: Request) {
    const supabase = getServerSupabase();
    try {
        const authHeader = request.headers.get("authorization");
        const bearerToken = authHeader?.split(" ")[1];
        if (!bearerToken) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const {
            data: { user },
            error: authErr,
        } = await supabase.auth.getUser(bearerToken);
        if (authErr || !user) {
            return NextResponse.json({ error: "Invalid session" }, { status: 401 });
        }

        const body = await request.json();
        const { clubId, email, displayName, role, inviteUrl } = body as {
            clubId?: string;
            email?: string;
            displayName?: string;
            role?: string;
            inviteUrl?: string;
        };

        if (!clubId || !email || !inviteUrl) {
            return NextResponse.json({ error: "Missing required invite fields" }, { status: 400 });
        }

        const { data: member } = await supabase
            .from("club_members")
            .select("club_id, display_name")
            .eq("user_id", user.id)
            .eq("club_id", clubId)
            .maybeSingle();

        if (!member) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const { data: club } = await supabase
            .from("clubs")
            .select("name")
            .eq("id", clubId)
            .maybeSingle();

        const clubName = club?.name || "Your Football Club";
        const inviterName = member.display_name || user.user_metadata?.full_name || "Your club manager";
        const recipientLabel = displayName?.trim() || "Coach";
        const roleLabel = role || "Staff";

        const sent = await sendEmail({
            to: email.trim().toLowerCase(),
            subject: `You've been invited to join ${clubName} on ClubFlow`,
            text: `Hi ${recipientLabel},\n\n${inviterName} has invited you to join ${clubName} on ClubFlow as ${roleLabel}.\n\nClick the link below to accept your invitation and access the club hub:\n${inviteUrl}\n\n— ${clubName} via ClubFlow`,
        });

        return NextResponse.json({ success: true, emailSent: sent });
    } catch (err: any) {
        console.error("Staff invite email error:", err);
        return NextResponse.json({ error: err.message || "Could not send invite email" }, { status: 500 });
    }
}

// Accept a staff invitation for an authenticated user (including coaches who already have a ClubFlow account)
export async function PUT(request: Request) {
    const supabase = getServerSupabase();
    try {
        const authHeader = request.headers.get("authorization");
        const bearerToken = authHeader?.split(" ")[1];
        if (!bearerToken) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const {
            data: { user },
            error: authErr,
        } = await supabase.auth.getUser(bearerToken);
        if (authErr || !user) {
            return NextResponse.json({ error: "Invalid session" }, { status: 401 });
        }

        const body = await request.json();
        const { token, displayName } = body as { token?: string; displayName?: string };
        if (!token) {
            return NextResponse.json({ error: "Missing invite token" }, { status: 400 });
        }

        const { data: invite } = await supabase
            .from("club_invitations")
            .select("*")
            .eq("token", token)
            .is("accepted_at", null)
            .maybeSingle();

        if (!invite) {
            return NextResponse.json({ error: "Invitation not found or already accepted." }, { status: 404 });
        }

        if (
            invite.email &&
            user.email &&
            invite.email.trim().toLowerCase() !== user.email.trim().toLowerCase()
        ) {
            return NextResponse.json(
                { error: `Please sign in with the invited email address (${invite.email}).` },
                { status: 403 }
            );
        }

        const { data: existingMember } = await supabase
            .from("club_members")
            .select("id")
            .eq("club_id", invite.club_id)
            .eq("user_id", user.id)
            .maybeSingle();

        const finalName = displayName?.trim() || invite.display_name || user.user_metadata?.full_name || "Staff";

        if (existingMember) {
            await supabase
                .from("club_members")
                .update({
                    role: invite.role || "coach",
                    display_name: finalName,
                    page_permissions: invite.page_permissions || [],
                })
                .eq("id", existingMember.id);
        } else {
            const { error: insErr } = await supabase.from("club_members").insert({
                club_id: invite.club_id,
                user_id: user.id,
                email: user.email,
                role: invite.role || "coach",
                display_name: finalName,
                page_permissions: invite.page_permissions || [],
            });
            if (insErr) throw insErr;
        }

        await supabase
            .from("club_invitations")
            .update({ accepted_at: new Date().toISOString() })
            .eq("id", invite.id);

        return NextResponse.json({ success: true, clubId: invite.club_id });
    } catch (err: any) {
        console.error("Staff accept invite error:", err);
        return NextResponse.json({ error: err.message || "Could not accept invitation" }, { status: 500 });
    }
}
