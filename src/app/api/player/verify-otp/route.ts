import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

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
    const supabaseAdmin = getAdminClient();
    try {
        const body = await request.json();
        const { playerId, otpCode, purpose, newPin } = body;

        if (!playerId || !otpCode || !purpose) {
            return NextResponse.json({ success: false, error: "Player ID, OTP code, and purpose are required" }, { status: 400 });
        }

        // 1. Fetch player
        const { data: player, error: fetchError } = await supabaseAdmin
            .from("players")
            .select("*")
            .eq("id", playerId)
            .single();

        if (fetchError || !player) {
            return NextResponse.json({ success: false, error: "Player not found" }, { status: 404 });
        }

        // 2. Validate OTP value, expiration, and attempt limits (max 5 tries per code)
        if (!player.verification_code) {
            return NextResponse.json({ success: false, error: "No active verification code. Please request a new code." }, { status: 400 });
        }

        if (player.verification_expires_at && new Date() > new Date(player.verification_expires_at)) {
            await supabaseAdmin
                .from("players")
                .update({ verification_code: null, verification_expires_at: null, pin_attempts: 0 })
                .eq("id", playerId);
            return NextResponse.json({ success: false, error: "Verification code has expired (10m limit). Please request a new code." }, { status: 400 });
        }

        const currentAttempts = Number(player.pin_attempts || 0);
        if (currentAttempts >= 5) {
            await supabaseAdmin
                .from("players")
                .update({ verification_code: null, verification_expires_at: null, pin_attempts: 0 })
                .eq("id", playerId);
            return NextResponse.json({ success: false, error: "Too many failed attempts. Please request a new verification code." }, { status: 429 });
        }

        if (player.verification_code !== String(otpCode).trim()) {
            const nextAttempts = currentAttempts + 1;
            const shouldInvalidate = nextAttempts >= 5;
            await supabaseAdmin
                .from("players")
                .update(
                    shouldInvalidate
                        ? { verification_code: null, verification_expires_at: null, pin_attempts: 0 }
                        : { pin_attempts: nextAttempts }
                )
                .eq("id", playerId);

            return NextResponse.json(
                {
                    success: false,
                    error: shouldInvalidate
                        ? "Too many incorrect attempts. Code has been invalidated — please request a new code."
                        : `Incorrect verification code (${5 - nextAttempts} attempt${5 - nextAttempts === 1 ? "" : "s"} remaining)`
                },
                { status: shouldInvalidate ? 429 : 400 }
            );
        }

        // 3. Process verification action
        const deviceToken = crypto.randomBytes(32).toString("hex");
        const newDevice = {
            token: deviceToken,
            name: `Device Added ${new Date().toLocaleDateString()}`,
            trustedAt: new Date().toISOString()
        };

        const trustedDevices = Array.isArray(player.trusted_devices) ? player.trusted_devices : [];
        trustedDevices.push(newDevice);

        const updatePayload: any = {
            verification_code: null,
            verification_expires_at: null,
            pin_attempts: 0,
            trusted_devices: trustedDevices
        };

        if (purpose === "reset_pin") {
            if (!newPin || newPin.length !== 6 || !/^\d+$/.test(newPin)) {
                return NextResponse.json({ success: false, error: "New 6-digit PIN is required" }, { status: 400 });
            }
            updatePayload.pin_hash = crypto.createHash("sha256").update(newPin).digest("hex");
        }

        const { error: updateError } = await supabaseAdmin
            .from("players")
            .update(updatePayload)
            .eq("id", playerId);

        if (updateError) {
            return NextResponse.json({ success: false, error: updateError.message }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            deviceToken,
            message: purpose === "reset_pin" ? "PIN reset successfully" : "Device verified successfully"
        });

    } catch (err: any) {
        console.error("Verify OTP error:", err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
