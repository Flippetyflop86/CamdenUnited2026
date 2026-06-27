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

        // 2. Fetch coach club membership role
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
            return NextResponse.json({ success: false, error: "Forbidden: Only coaches/managers can send invites" }, { status: 403 });
        }

        const body = await request.json();
        const { playerId, email, mobileNumber } = body;

        if (!playerId || !email) {
            return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
        }

        // 3. Confirm player belongs to the same club
        const { data: player, error: playerFetchError } = await supabase
            .from("players")
            .select("*")
            .eq("id", playerId)
            .single();

        if (playerFetchError || !player) {
            return NextResponse.json({ success: false, error: "Player not found" }, { status: 404 });
        }

        if (player.club_id !== member.club_id) {
            return NextResponse.json({ success: false, error: "Forbidden: Player is in a different club" }, { status: 403 });
        }

        // 4. Generate token and expiry (48 hours)
        const activationToken = crypto.randomBytes(32).toString("hex");
        const activationExpiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

        // 5. Update player entry
        const { error: updateError } = await supabase
            .from("players")
            .update({
                email,
                mobile_number: mobileNumber || null,
                activation_token: activationToken,
                activation_expires_at: activationExpiresAt,
                status: "Pending Activation"
            })
            .eq("id", playerId);

        if (updateError) {
            return NextResponse.json({ success: false, error: updateError.message }, { status: 500 });
        }

        // 6. Send Invitation Email
        const origin = request.headers.get("origin") || "http://localhost:3000";
        const activationUrl = `${origin}/activate/${activationToken}`;

        const emailText = `Welcome to ClubFlow!\n\nYour club has invited you to activate your secure Player Portal for ${player.first_name} ${player.last_name}.\n\nThe Player Portal allows you to check availability, view fixtures, and manage your profile in seconds.\n\nClick the link below to get started and create your secure 4-digit PIN:\n${activationUrl}\n\nNote: This link will expire in 48 hours.`;

        await sendEmail({
            to: email,
            subject: `Activate Your ClubFlow Player Portal`,
            text: emailText
        });

        return NextResponse.json({ success: true, message: "Invite sent successfully" });
    } catch (err: any) {
        console.error("Invite route error:", err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
