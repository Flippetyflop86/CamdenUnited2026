import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { playerId, eventId, eventType, status, deviceToken } = body;

        if (!playerId || !eventId || !eventType || !status) {
            return NextResponse.json({ success: false, error: "Missing required response parameters" }, { status: 400 });
        }

        // 1. Authenticate Player device token
        const { data: player, error: playerError } = await supabase
            .from("players")
            .select("*")
            .eq("id", playerId)
            .single();

        if (playerError || !player) {
            return NextResponse.json({ success: false, error: "Player not found" }, { status: 404 });
        }

        const trustedDevices = Array.isArray(player.trusted_devices) ? player.trusted_devices : [];
        const isDeviceTrusted = trustedDevices.some((d: any) => d.token === deviceToken);

        if (!isDeviceTrusted) {
            return NextResponse.json({ success: false, error: "Device is not trusted. Verification required." }, { status: 401 });
        }

        if (eventType === "match") {
            // Fetch match
            const { data: match, error: fetchMatchErr } = await supabase
                .from("matches")
                .select("notes")
                .eq("id", eventId)
                .single();

            if (fetchMatchErr || !match) {
                return NextResponse.json({ success: false, error: "Match not found" }, { status: 404 });
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
            const playerIndex = updatedList.findIndex((a: any) => a.playerId === player.id);

            // Spond mapping: Available -> Available, Maybe -> Maybe, Unavailable -> Unavailable
            if (playerIndex >= 0) {
                updatedList[playerIndex] = { playerId: player.id, status };
            } else {
                updatedList.push({ playerId: player.id, status });
            }

            let cleanBaseNotes = currentNotes.replace(/\[AVAILABILITY:.*?\]\n?/, "").trim();
            const finalNotes = `${cleanBaseNotes}\n[AVAILABILITY: ${JSON.stringify(updatedList)} ]`.trim();

            const { error: updateMatchErr } = await supabase
                .from("matches")
                .update({ notes: finalNotes })
                .eq("id", eventId);

            if (updateMatchErr) throw updateMatchErr;

        } else if (eventType === "training") {
            // Fetch session
            const { data: session, error: fetchSessionErr } = await supabase
                .from("training_sessions")
                .select("attendance")
                .eq("id", eventId)
                .single();

            if (fetchSessionErr || !session) {
                return NextResponse.json({ success: false, error: "Training session not found" }, { status: 404 });
            }

            const existingAttendance = session.attendance || [];
            const updatedAttendance = [...existingAttendance];
            const playerIndex = updatedAttendance.findIndex((a: any) => a.playerId === player.id);

            // Spond status mapping: Available -> Present, Unavailable -> Absent, Maybe -> Late/Injured
            let mappedStatus = "Absent";
            if (status === "Available") mappedStatus = "Present";
            if (status === "Maybe") mappedStatus = "Late";

            if (playerIndex >= 0) {
                updatedAttendance[playerIndex] = { 
                    ...updatedAttendance[playerIndex],
                    status: mappedStatus,
                    notes: `RSVP: ${status}`
                };
            } else {
                updatedAttendance.push({ 
                    playerId: player.id, 
                    status: mappedStatus,
                    notes: `RSVP: ${status}`
                });
            }

            const { error: updateSessionErr } = await supabase
                .from("training_sessions")
                .update({ attendance: updatedAttendance })
                .eq("id", eventId);

            if (updateSessionErr) throw updateSessionErr;
        }

        return NextResponse.json({ success: true, message: "Response submitted successfully" });

    } catch (err: any) {
        console.error("Respond API error:", err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
