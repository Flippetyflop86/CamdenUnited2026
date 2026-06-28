import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { sendEmail } from "@/lib/email-service";
import crypto from "crypto";

export async function POST(request: Request) {
    try {
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

        // 2. Verify role
        const { data: member, error: memberError } = await supabase
            .from("club_members")
            .select("club_id, role")
            .eq("user_id", user.id)
            .single();

        if (memberError || !member) {
            return NextResponse.json({ success: false, error: "Forbidden: Could not verify club membership" }, { status: 403 });
        }

        const roleClean = (member.role || "").toLowerCase();
        if (roleClean !== "manager" && roleClean !== "super admin" && roleClean !== "coach") {
            return NextResponse.json({ success: false, error: "Forbidden: Action restricted to coaches/managers" }, { status: 403 });
        }

        const body = await request.json();
        const { clubId } = body;

        if (!clubId || clubId !== member.club_id) {
            return NextResponse.json({ success: false, error: "Invalid club context" }, { status: 400 });
        }

        // 3. Fetch all players with status 'Pending Invitation' or null, who have emails
        const { data: players, error: fetchError } = await supabase
            .from("players")
            .select("*")
            .eq("club_id", clubId)
            .or("status.eq.Pending Invitation,status.is.null");

        if (fetchError) throw fetchError;

        const invitees = (players || []).filter(p => p.email);
        if (invitees.length === 0) {
            return NextResponse.json({ success: true, message: "No pending players with valid email addresses found." });
        }

        const origin = request.headers.get("origin") || "http://localhost:3000";

        // 4. Loop & send invitations
        for (const player of invitees) {
            const activationToken = crypto.randomBytes(32).toString("hex");
            const activationExpiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

            // Update database
            await supabase
                .from("players")
                .update({
                    activation_token: activationToken,
                    activation_expires_at: activationExpiresAt,
                    status: "Pending Invitation"
                })
                .eq("id", player.id);

            const activationUrl = `${origin}/signup/player?token=${activationToken}`;

            const emailText = `${player.first_name || "Hi"},\n\nYour club has invited you to join ClubFlow to confirm training/match availability and receive club updates.\n\nClick the link below to create your lightweight player account:\n${activationUrl}\n\nJoin ClubFlow`;

            await sendEmail({
                to: player.email,
                subject: "Invitation to Join ClubFlow",
                text: emailText
            });
        }

        return NextResponse.json({ success: true, message: `Invitations sent to ${invitees.length} players.` });

    } catch (err: any) {
        console.error("Bulk invite error:", err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
