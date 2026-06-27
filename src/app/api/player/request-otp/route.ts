import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { sendEmail } from "@/lib/email-service";
import crypto from "crypto";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { playerId, purpose } = body; // 'new_device' or 'reset_pin'

        if (!playerId || !purpose) {
            return NextResponse.json({ success: false, error: "Player ID and purpose are required" }, { status: 400 });
        }

        // 1. Fetch player details
        const { data: player, error: fetchError } = await supabase
            .from("players")
            .select("*")
            .eq("id", playerId)
            .single();

        if (fetchError || !player) {
            return NextResponse.json({ success: false, error: "Player not found" }, { status: 404 });
        }

        if (!player.email) {
            return NextResponse.json({ success: false, error: "Player has no registered email. Please contact your coach." }, { status: 400 });
        }

        // 2. Generate 6-digit code
        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes

        // 3. Save OTP details to database
        const { error: updateError } = await supabase
            .from("players")
            .update({
                verification_code: otpCode,
                verification_expires_at: expiresAt
            })
            .eq("id", playerId);

        if (updateError) {
            return NextResponse.json({ success: false, error: updateError.message }, { status: 500 });
        }

        // 4. Send Email containing OTP
        let subject = "ClubFlow Verification Code";
        let bodyText = "";

        if (purpose === "new_device") {
            subject = "New Device Verification Code - ClubFlow";
            bodyText = `Hi ${player.first_name},\n\nWe detected a login attempt from an unknown device. Use the 6-digit code below to trust this device:\n\n👉 ${otpCode}\n\nThis code will expire in 10 minutes. If you did not request this, please contact your coach.`;
        } else {
            subject = "PIN Reset Request - ClubFlow";
            bodyText = `Hi ${player.first_name},\n\nYou have requested to reset your secure Player Portal PIN. Use the verification code below to authorize the change:\n\n👉 ${otpCode}\n\nThis code will expire in 10 minutes.`;
        }

        await sendEmail({
            to: player.email,
            subject,
            text: bodyText
        });

        return NextResponse.json({ success: true, message: "OTP sent successfully" });
    } catch (err: any) {
        console.error("Request OTP error:", err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
