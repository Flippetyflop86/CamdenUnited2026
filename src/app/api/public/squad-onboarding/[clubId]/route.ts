import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase";
import { isFormerPlayer } from "@/lib/utils";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const VALID_POSITIONS = new Set([
    "GK",
    "CB",
    "RB",
    "LB",
    "RWB",
    "LWB",
    "CDM",
    "CM",
    "CAM",
    "RM",
    "LM",
    "RW",
    "LW",
    "CF",
    "ST",
    "DEF",
    "MID",
    "FWD",
]);

export async function GET(
    _request: Request,
    context: { params: Promise<{ clubId: string }> }
) {
    try {
        const { clubId } = await context.params;
        if (!clubId || !UUID_RE.test(clubId)) {
            return NextResponse.json({ error: "Invalid club link" }, { status: 400 });
        }

        const supabase = getServerSupabase();
        const [{ data: clubData, error: clubErr }, { data: playersData }] = await Promise.all([
            supabase
                .from("clubs")
                .select("id, name, logo, primary_color, squads")
                .eq("id", clubId)
                .single(),
            supabase
                .from("players")
                .select("id, first_name, last_name, position, squad_number, email, notes")
                .eq("club_id", clubId)
                .order("first_name", { ascending: true }),
        ]);

        if (clubErr || !clubData) {
            return NextResponse.json({ error: "Club not found" }, { status: 404 });
        }

        const activePlayers = (playersData || [])
            .filter((p: any) => !isFormerPlayer(p))
            .map((p: any) => ({
                id: p.id,
                first_name: p.first_name,
                last_name: p.last_name,
                position: p.position || "CM",
                squad_number: p.squad_number || null,
                completed: Boolean(
                    p.notes && /\[SELF_PROFILE:1\]/.test(p.notes)
                ),
            }));

        return NextResponse.json({
            club: {
                id: clubData.id,
                name: clubData.name,
                logo: clubData.logo,
                primary_color: clubData.primary_color,
                defaultSquad: Array.isArray(clubData.squads) && clubData.squads.length > 0
                    ? clubData.squads[0]
                    : "First Team",
            },
            players: activePlayers,
        });
    } catch (err: any) {
        console.error("Squad onboarding GET error:", err);
        return NextResponse.json(
            { error: "Unable to load squad form" },
            { status: 500 }
        );
    }
}

export async function POST(
    request: Request,
    context: { params: Promise<{ clubId: string }> }
) {
    try {
        const { clubId } = await context.params;
        if (!clubId || !UUID_RE.test(clubId)) {
            return NextResponse.json({ error: "Invalid club link" }, { status: 400 });
        }

        const body = await request.json();
        const {
            mode = "claim",
            playerId,
            firstName,
            lastName,
            email,
            position,
            secondaryPosition,
            squadNumber,
            preferredFoot,
        } = body as {
            mode?: "claim" | "create";
            playerId?: string;
            firstName?: string;
            lastName?: string;
            email?: string;
            position?: string;
            secondaryPosition?: string;
            squadNumber?: number | string | null;
            preferredFoot?: "Right" | "Left" | "Both";
        };

        const cleanPos = String(position || "CM").toUpperCase().trim();
        if (!VALID_POSITIONS.has(cleanPos)) {
            return NextResponse.json({ error: "Please select a valid position" }, { status: 400 });
        }

        const cleanSecPos = secondaryPosition ? String(secondaryPosition).toUpperCase().trim() : "";
        const validSecPos = cleanSecPos && VALID_POSITIONS.has(cleanSecPos) ? cleanSecPos : null;
        const cleanEmail = (email || "").trim().toLowerCase();
        if (cleanEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
            return NextResponse.json({ error: "Please enter a valid email address" }, { status: 400 });
        }

        const parsedNum =
            squadNumber !== undefined && squadNumber !== null && String(squadNumber).trim() !== ""
                ? Math.max(1, Math.min(99, parseInt(String(squadNumber), 10) || 0))
                : null;
        const footTag =
            preferredFoot === "Left" || preferredFoot === "Right" || preferredFoot === "Both"
                ? `[FOOT:${preferredFoot}]`
                : "";

        const supabase = getServerSupabase();
        const { data: club } = await supabase
            .from("clubs")
            .select("id, squads")
            .eq("id", clubId)
            .single();

        if (!club) {
            return NextResponse.json({ error: "Club not found" }, { status: 404 });
        }

        if (mode === "claim") {
            if (!playerId || !UUID_RE.test(playerId)) {
                return NextResponse.json({ error: "Please select your name from the squad list" }, { status: 400 });
            }

            const { data: existingPlayer } = await supabase
                .from("players")
                .select("id, club_id, notes")
                .eq("id", playerId)
                .eq("club_id", clubId)
                .single();

            if (!existingPlayer) {
                return NextResponse.json({ error: "Player not found in this club" }, { status: 404 });
            }

            if (existingPlayer.notes && /\[SELF_PROFILE:1\]/.test(existingPlayer.notes)) {
                return NextResponse.json(
                    {
                        error: "This player's profile has already been submitted. Ask your manager if you need to update it.",
                    },
                    { status: 409 }
                );
            }

            let nextNotes = (existingPlayer.notes || "")
                .replace(/\[FOOT:(Left|Right|Both)\]/g, "")
                .replace(/\[SELF_PROFILE:1\]/g, "")
                .trim();
            if (footTag) nextNotes = `${nextNotes} ${footTag}`.trim();
            nextNotes = `${nextNotes} [SELF_PROFILE:1]`.trim();

            const updatePayload: Record<string, any> = {
                position: cleanPos,
                notes: nextNotes,
            };
            if (cleanEmail) updatePayload.email = cleanEmail;
            if (validSecPos) updatePayload.secondary_position = validSecPos;
            if (parsedNum && parsedNum > 0) updatePayload.squad_number = parsedNum;

            const { error: updErr } = await supabase
                .from("players")
                .update(updatePayload)
                .eq("id", playerId)
                .eq("club_id", clubId);

            if (updErr) throw updErr;
            return NextResponse.json({ success: true });
        }

        // mode === "create"
        const cleanFirst = (firstName || "").trim().slice(0, 40);
        const cleanLast = (lastName || "").trim().slice(0, 40);
        if (!cleanFirst) {
            return NextResponse.json({ error: "Please enter your first name" }, { status: 400 });
        }

        const defaultSquad =
            Array.isArray(club.squads) && club.squads.length > 0 ? club.squads[0] : "First Team";
        const notesStr = `${footTag} [REG:Standard] [SELF_PROFILE:1]`.trim();

        const { error: insErr } = await supabase.from("players").insert([
            {
                club_id: clubId,
                first_name: cleanFirst,
                last_name: cleanLast,
                email: cleanEmail || null,
                position: cleanPos,
                secondary_position: validSecPos,
                squad_number: parsedNum && parsedNum > 0 ? parsedNum : null,
                squad: defaultSquad,
                status: "Active",
                medical_status: "Available",
                availability: true,
                is_in_training_squad: true,
                is_in_matchday_tracker: true,
                notes: notesStr,
            },
        ]);

        if (insErr) throw insErr;
        return NextResponse.json({ success: true });
    } catch (err: any) {
        console.error("Squad onboarding POST error:", err);
        return NextResponse.json(
            { error: err.message || "Could not save player profile" },
            { status: 500 }
        );
    }
}
