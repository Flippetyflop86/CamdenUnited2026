import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase";
import crypto from "crypto";

// Verify an invitation token for /signup/player without exposing full player table via client RLS
export async function GET(request: Request) {
    const supabase = getServerSupabase();
    try {
        const { searchParams } = new URL(request.url);
        const token = (searchParams.get("token") || "").trim();
        if (!token) {
            return NextResponse.json({ success: false, error: "Missing activation token." }, { status: 400 });
        }

        const { data: player, error: fetchError } = await supabase
            .from("players")
            .select("id, club_id, first_name, last_name, email, activation_expires_at")
            .eq("activation_token", token)
            .maybeSingle();

        if (fetchError || !player) {
            return NextResponse.json({ success: false, error: "Invalid or expired activation link." }, { status: 404 });
        }

        if (player.activation_expires_at && new Date() > new Date(player.activation_expires_at)) {
            return NextResponse.json({ success: false, error: "Invitation link has expired." }, { status: 410 });
        }

        return NextResponse.json({
            success: true,
            player: {
                id: player.id,
                club_id: player.club_id,
                first_name: player.first_name,
                last_name: player.last_name,
                email: player.email,
            },
        });
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message || "Activation lookup failed." }, { status: 500 });
    }
}

// Complete /signup/player account linking server-side so RLS never blocks unauthenticated/new players
export async function PUT(request: Request) {
    const supabase = getServerSupabase();
    try {
        const body = await request.json();
        const { token, userId, email } = body as { token?: string; userId?: string; email?: string };

        if (!token || !userId) {
            return NextResponse.json({ success: false, error: "Missing token or user ID." }, { status: 400 });
        }

        const { data: player, error: fetchError } = await supabase
            .from("players")
            .select("id, club_id, email, activation_expires_at")
            .eq("activation_token", token)
            .maybeSingle();

        if (fetchError || !player) {
            return NextResponse.json({ success: false, error: "Invalid or already used invitation link." }, { status: 404 });
        }

        if (player.activation_expires_at && new Date() > new Date(player.activation_expires_at)) {
            return NextResponse.json({ success: false, error: "Invitation link has expired." }, { status: 410 });
        }

        if (player.email && email && player.email.trim().toLowerCase() !== email.trim().toLowerCase()) {
            return NextResponse.json(
                { success: false, error: "Email address does not match this player invitation." },
                { status: 403 }
            );
        }

        if (player.club_id) {
            const { data: existingMember } = await supabase
                .from("club_members")
                .select("id")
                .eq("club_id", player.club_id)
                .eq("user_id", userId)
                .maybeSingle();

            if (!existingMember) {
                const { error: memberErr } = await supabase.from("club_members").insert({
                    club_id: player.club_id,
                    user_id: userId,
                    role: "Player",
                });
                if (memberErr) throw memberErr;
            }

            const { error: playerUpdateErr } = await supabase
                .from("players")
                .update({
                    user_id: userId,
                    status: "Registered",
                    activation_token: null,
                    activation_expires_at: null,
                })
                .eq("id", player.id);

            if (playerUpdateErr) throw playerUpdateErr;
        }

        return NextResponse.json({ success: true });
    } catch (err: any) {
        console.error("Player signup link error:", err);
        return NextResponse.json({ success: false, error: err.message || "Could not link player account." }, { status: 500 });
    }
}

export async function POST(request: Request) {
    const supabase = getServerSupabase();
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
            trustedAt: new Date().toISOString(),
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
                last_login: new Date().toISOString(),
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
            playerName: `${player.first_name} ${player.last_name}`,
        });
    } catch (err: any) {
        console.error("Activation route error:", err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
