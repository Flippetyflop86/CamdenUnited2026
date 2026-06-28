import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

// Lazily initialize server-side supabase admin client to prevent build-time evaluation errors
function getAdminClient() {
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!key) {
        throw new Error("SUPABASE_SERVICE_ROLE_KEY environment variable is missing on the server. Please add it to your Vercel Project Settings.");
    }
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        key
    );
}

// Position order helper
const positionOrder: Record<string, number> = {
    "GK": 1, "RB": 2, "LB": 2, "CB": 2, "RWB": 2, "LWB": 2, "DEF": 2,
    "CDM": 3, "CM": 3, "CAM": 3, "RM": 3, "LM": 3, "MID": 3,
    "RW": 4, "LW": 4, "CF": 4, "ST": 4, "FWD": 4
};

// SHA-256 hashing helper
function hashPin(pin: string): string {
    return crypto.createHash("sha256").update(pin).digest("hex");
}

// GET handler: Fetch event details and safe squad player list
export async function GET(request: Request) {
    const supabaseAdmin = getAdminClient();
    try {
        const { searchParams } = new URL(request.url);
        const token = searchParams.get("token");

        if (!token) {
            return NextResponse.json({ success: false, error: "Missing token parameter" }, { status: 400 });
        }

        // 1. Query match by event_token or id
        let { data: match } = await supabaseAdmin
            .from("matches")
            .select("*")
            .eq("event_token", token)
            .single();

        if (!match && token.length === 36) {
            const { data: matchById } = await supabaseAdmin
                .from("matches")
                .select("*")
                .eq("id", token)
                .single();
            if (matchById) match = matchById;
        }

        let event = null;
        let eventType: "match" | "training" | null = null;

        if (match) {
            event = match;
            eventType = "match";
        } else {
            // Query training sessions by event_token or id
            let { data: session } = await supabaseAdmin
                .from("training_sessions")
                .select("*")
                .eq("event_token", token)
                .single();

            if (!session && token.length === 36) {
                const { data: sessionById } = await supabaseAdmin
                    .from("training_sessions")
                    .select("*")
                    .eq("id", token)
                    .single();
                if (sessionById) session = sessionById;
            }

            if (session) {
                event = session;
                eventType = "training";
            }
        }

        if (!event || !eventType) {
            return NextResponse.json({ success: false, error: "Invalid or expired availability link." }, { status: 404 });
        }

        // 2. Fetch squad players for this club
        const { data: squadData, error: squadErr } = await supabaseAdmin
            .from("players")
            .select("id, first_name, last_name, position, squad, pin_hash, is_in_training_squad")
            .eq("club_id", event.club_id);

        if (squadErr || !squadData) {
            return NextResponse.json({ success: false, error: "Unable to load squad details." }, { status: 500 });
        }

        // Filter squad matching if training
        let eligible = [...squadData];
        if (eventType === "training") {
            const isFirstTeamSession = event.squad === "All" || event.squad === "firstTeam" || event.squad === "First Team";
            const checkSquadMatch = (playerSquadsStr: string | undefined | null, targetSquad: string) => {
                if (!playerSquadsStr) return false;
                const squads = playerSquadsStr.split(",").map(s => s.trim().toLowerCase());
                const cleanTarget = targetSquad.toLowerCase();
                if (cleanTarget === "firstteam" || cleanTarget === "first team") {
                    return squads.includes("first team") || squads.includes("firstteam");
                }
                return squads.includes(cleanTarget);
            };
            const isFirstTeam = (squad: string | undefined | null) => {
                if (!squad) return false;
                const squads = squad.split(",").map(s => s.trim().toLowerCase());
                return squads.includes("first team") || squads.includes("firstteam");
            };

            eligible = squadData.filter(p => {
                if (isFirstTeamSession) {
                    return isFirstTeam(p.squad) || p.is_in_training_squad;
                }
                return checkSquadMatch(p.squad, event.squad);
            });
        }

        // Sort by position order
        eligible.sort((a, b) => (positionOrder[a.position] || 99) - (positionOrder[b.position] || 99));

        // Clean players array to be completely safe for public consumption (returns boolean for pin_hash presence)
        const cleanPlayers = eligible.map(p => ({
            id: p.id,
            first_name: p.first_name,
            last_name: p.last_name,
            position: p.position,
            has_pin: !!p.pin_hash
        }));

        return NextResponse.json({
            success: true,
            event,
            eventType,
            players: cleanPlayers
        });

    } catch (err: any) {
        console.error("GET respond error:", err);
        return NextResponse.json({ success: false, error: err.message || "Internal server error" }, { status: 500 });
    }
}

// POST handler: Verify PIN and save RSVP
export async function POST(request: Request) {
    const supabaseAdmin = getAdminClient();
    try {
        const body = await request.json();
        const { playerId, eventId, eventType, status, pin } = body;

        if (!playerId || !eventId || !eventType || !status || !pin) {
            return NextResponse.json({ success: false, error: "Missing required parameters." }, { status: 400 });
        }

        if (pin.length !== 6 || !/^\d+$/.test(pin)) {
            return NextResponse.json({ success: false, error: "PIN must be exactly 6 digits." }, { status: 400 });
        }

        // 1. Fetch player
        const { data: player, error: playerError } = await supabaseAdmin
            .from("players")
            .select("*")
            .eq("id", playerId)
            .single();

        if (playerError || !player) {
            return NextResponse.json({ success: false, error: "Player not found." }, { status: 404 });
        }

        const hashedInput = hashPin(pin);

        // 2. Handle PIN registration (if not set yet) or PIN verification
        if (!player.pin_hash) {
            // Save new PIN
            const { error: pinUpdateErr } = await supabaseAdmin
                .from("players")
                .update({
                    pin_hash: hashedInput,
                    status: "Registered"
                })
                .eq("id", playerId);

            if (pinUpdateErr) {
                return NextResponse.json({ success: false, error: "Failed to set PIN." }, { status: 500 });
            }
        } else {
            // Verify existing PIN
            if (hashedInput !== player.pin_hash) {
                return NextResponse.json({ success: false, error: "Incorrect PIN." }, { status: 401 });
            }
        }

        // 3. Update attendance
        if (eventType === "match") {
            const { data: match, error: fetchMatchErr } = await supabaseAdmin
                .from("matches")
                .select("notes")
                .eq("id", eventId)
                .single();

            if (fetchMatchErr || !match) {
                return NextResponse.json({ success: false, error: "Match event not found." }, { status: 404 });
            }

            const currentNotes = match.notes || "";
            let currentList: any[] = [];
            const matchRaw = currentNotes.match(/\[AVAILABILITY:\s*(.*?)\s*\]/);
            if (matchRaw && matchRaw[1]) {
                try {
                    currentList = JSON.parse(matchRaw[1]);
                } catch (e) {
                    currentList = [];
                }
            }

            const updatedList = [...currentList];
            const playerIndex = updatedList.findIndex(a => a.playerId === playerId);

            if (playerIndex >= 0) {
                updatedList[playerIndex] = { playerId, status };
            } else {
                updatedList.push({ playerId, status });
            }

            const cleanBaseNotes = currentNotes.replace(/\[AVAILABILITY:.*?\]\n?/, "").trim();
            const finalNotes = `${cleanBaseNotes}\n[AVAILABILITY: ${JSON.stringify(updatedList)} ]`.trim();

            const { error: updateMatchErr } = await supabaseAdmin
                .from("matches")
                .update({ notes: finalNotes })
                .eq("id", eventId);

            if (updateMatchErr) throw updateMatchErr;

        } else if (eventType === "training") {
            const { data: session, error: fetchSessionErr } = await supabaseAdmin
                .from("training_sessions")
                .select("attendance")
                .eq("id", eventId)
                .single();

            if (fetchSessionErr || !session) {
                return NextResponse.json({ success: false, error: "Training session not found." }, { status: 404 });
            }

            const existingAttendance = session.attendance || [];
            const updatedAttendance = [...existingAttendance];
            const playerIndex = updatedAttendance.findIndex(a => a.playerId === playerId);

            // Map UI status to DB status
            const mappedStatus = status === "Available" ? "Present" : "Absent";

            if (playerIndex >= 0) {
                updatedAttendance[playerIndex] = { 
                    ...updatedAttendance[playerIndex], 
                    status: mappedStatus,
                    notes: "RSVP: Self Managed"
                };
            } else {
                updatedAttendance.push({ 
                    playerId, 
                    status: mappedStatus, 
                    notes: "RSVP: Self Managed" 
                });
            }

            const { error: updateSessionErr } = await supabaseAdmin
                .from("training_sessions")
                .update({ attendance: updatedAttendance })
                .eq("id", eventId);

            if (updateSessionErr) throw updateSessionErr;
        }

        return NextResponse.json({ success: true, message: "Response saved successfully." });

    } catch (err: any) {
        console.error("POST respond error:", err);
        return NextResponse.json({ success: false, error: "Internal server error." }, { status: 500 });
    }
}
