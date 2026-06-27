import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import crypto from "crypto";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { token, pin } = body;

        if (!token || !pin) {
            return NextResponse.json({ success: false, error: "Token and PIN are required" }, { status: 400 });
        }

        if (pin.length !== 4 || !/^\d+$/.test(pin)) {
            return NextResponse.json({ success: false, error: "PIN must be exactly 4 digits" }, { status: 400 });
        }

        // 1. Fetch player by activation token
        const { data: player, error: fetchError } = await supabase
            .from("players")
            .select("*")
            .eq("activation_token", token)
            .single();

        if (fetchError || !player) {
            return NextResponse.json({ success: false, error: "Invalid or expired activation link" }, { status: 400 });
        }

        // 2. Validate expiration date
        if (player.activation_expires_at && new Date() > new Date(player.activation_expires_at)) {
            return NextResponse.json({ success: false, error: "Activation link has expired (48h limit)" }, { status: 400 });
        }

        // 3. Hash PIN securely
        const pinHash = crypto.createHash("sha256").update(pin).digest("hex");

        // 4. Generate trusted device token
        const deviceToken = crypto.randomBytes(32).toString("hex");
        const newDevice = {
            token: deviceToken,
            name: "Initial Activated Device",
            trustedAt: new Date().toISOString()
        };

        const trustedDevices = Array.isArray(player.trusted_devices) ? player.trusted_devices : [];
        trustedDevices.push(newDevice);

        // 5. Update database player entry
        const { error: updateError } = await supabase
            .from("players")
            .update({
                pin_hash: pinHash,
                status: "Active",
                activation_token: null,
                activation_expires_at: null,
                trusted_devices: trustedDevices,
                pin_attempts: 0,
                last_login: new Date().toISOString()
            })
            .eq("id", player.id);

        if (updateError) {
            return NextResponse.json({ success: false, error: updateError.message }, { status: 500 });
        }

        // 6. Return device token to store in localStorage
        return NextResponse.json({
            success: true,
            playerId: player.id,
            deviceToken,
            playerName: `${player.first_name} ${player.last_name}`
        });

    } catch (err: any) {
        console.error("Activation route error:", err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
