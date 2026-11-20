import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase";
import { parsePlayerDeparture } from "@/lib/utils";

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

function computeAgeFromDob(dobIso: string): number | null {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dobIso)) return null;
    const [y, m, d] = dobIso.split("-").map(Number);
    if (!y || !m || !d) return null;
    const today = new Date();
    let age = today.getFullYear() - y;
    const monthDiff = today.getMonth() + 1 - m;
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < d)) {
        age--;
    }
    if (age < 4 || age > 99) return null;
    return age;
}

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
        const { data: clubData, error: clubErr } = await supabase
            .from("clubs")
            .select("id, name, logo, primary_color, squads")
            .eq("id", clubId)
            .single();

        if (clubErr || !clubData) {
            return NextResponse.json({ error: "Club not found" }, { status: 404 });
        }

        const squads =
            Array.isArray(clubData.squads) && clubData.squads.length > 0
                ? clubData.squads
                : ["First Team"];

        return NextResponse.json({
            club: {
                id: clubData.id,
                name: clubData.name,
                logo: clubData.logo,
                primary_color: clubData.primary_color,
                squads,
                defaultSquad: squads[0],
            },
        });
    } catch (err: any) {
        console.error("Squad onboarding GET error:", err);
        return NextResponse.json(
            { error: "Unable to load registration form" },
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
            firstName,
            lastName,
            dateOfBirth,
            email,
            phone,
            position,
            secondaryPosition,
            squadNumber,
            preferredFoot,
            squad,
        } = body as {
            firstName?: string;
            lastName?: string;
            dateOfBirth?: string;
            email?: string;
            phone?: string;
            position?: string;
            secondaryPosition?: string;
            squadNumber?: number | string | null;
            preferredFoot?: "Right" | "Left" | "Both";
            squad?: string;
        };

        const cleanFirst = (firstName || "").trim().replace(/\s+/g, " ").slice(0, 40);
        const cleanLast = (lastName || "").trim().replace(/\s+/g, " ").slice(0, 40);
        if (!cleanFirst || !cleanLast) {
            return NextResponse.json(
                { error: "Please enter both your first name and surname." },
                { status: 400 }
            );
        }

        const cleanPos = String(position || "CM").toUpperCase().trim();
        if (!VALID_POSITIONS.has(cleanPos)) {
            return NextResponse.json({ error: "Please select a valid main position." }, { status: 400 });
        }

        const cleanSecPos = secondaryPosition ? String(secondaryPosition).toUpperCase().trim() : "";
        const validSecPos = cleanSecPos && VALID_POSITIONS.has(cleanSecPos) ? cleanSecPos : null;

        const cleanDob = (dateOfBirth || "").trim();
        let computedAge: number | null = null;
        if (cleanDob) {
            computedAge = computeAgeFromDob(cleanDob);
            if (computedAge === null) {
                return NextResponse.json(
                    { error: "Please enter a valid Date of Birth." },
                    { status: 400 }
                );
            }
        }

        const cleanEmail = (email || "").trim().toLowerCase();
        if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
            return NextResponse.json(
                { error: "Please enter a valid email address." },
                { status: 400 }
            );
        }

        const cleanPhone = (phone || "").replace(/[^\d+\s()-]/g, "").trim().slice(0, 24);
        const parsedNum =
            squadNumber !== undefined && squadNumber !== null && String(squadNumber).trim() !== ""
                ? Math.max(1, Math.min(99, parseInt(String(squadNumber), 10) || 0))
                : null;

        const supabase = getServerSupabase();
        const [{ data: club }, { data: existingPlayers }] = await Promise.all([
            supabase
                .from("clubs")
                .select("id, name, squads")
                .eq("id", clubId)
                .single(),
            supabase
                .from("players")
                .select("id, first_name, last_name, email, notes, club_status")
                .eq("club_id", clubId),
        ]);

        if (!club) {
            return NextResponse.json({ error: "Club not found" }, { status: 404 });
        }

        // Prevent duplicate submissions by email or full name among current & pending players
        const normalizedFullName = `${cleanFirst} ${cleanLast}`.toLowerCase();
        for (const p of existingPlayers || []) {
            if (parsePlayerDeparture(p).isFormer) continue;
            const existingEmail = (p.email || "").trim().toLowerCase();
            if (existingEmail && existingEmail === cleanEmail) {
                return NextResponse.json(
                    {
                        error: `A player with this email is already registered at ${club.name} — no need to submit again.`,
                    },
                    { status: 409 }
                );
            }
            const existingName = `${p.first_name || ""} ${p.last_name || ""}`
                .trim()
                .replace(/\s+/g, " ")
                .toLowerCase();
            if (existingName && existingName === normalizedFullName) {
                return NextResponse.json(
                    {
                        error: `${cleanFirst} ${cleanLast} is already on ${club.name}'s registration list — no need to submit again.`,
                    },
                    { status: 409 }
                );
            }
        }

        const clubSquads: string[] =
            Array.isArray(club.squads) && club.squads.length > 0 ? club.squads : ["First Team"];
        const requestedSquad = (squad || "").trim();
        const resolvedSquad =
            clubSquads.find((s) => s.toLowerCase() === requestedSquad.toLowerCase()) ||
            clubSquads[0];

        const noteParts = ["[PENDING_REG:1]", "[REG:Standard]"];
        if (preferredFoot === "Left" || preferredFoot === "Right" || preferredFoot === "Both") {
            noteParts.push(`[FOOT:${preferredFoot}]`);
        }
        if (cleanPhone) {
            noteParts.push(`[PHONE:${cleanPhone}]`);
        }

        const { error: insErr } = await supabase.from("players").insert([
            {
                club_id: clubId,
                first_name: cleanFirst,
                last_name: cleanLast,
                date_of_birth: cleanDob || null,
                ...(computedAge !== null ? { age: computedAge } : {}),
                email: cleanEmail,
                position: cleanPos,
                secondary_position: validSecPos,
                squad_number: parsedNum && parsedNum > 0 ? parsedNum : null,
                squad: resolvedSquad,
                status: "Pending Approval",
                medical_status: "Available",
                availability: false,
                is_in_training_squad: false,
                is_in_matchday_tracker: false,
                notes: noteParts.join(" "),
            },
        ]);

        if (insErr) throw insErr;
        return NextResponse.json({ success: true, squad: resolvedSquad });
    } catch (err: any) {
        console.error("Squad onboarding POST error:", err);
        return NextResponse.json(
            { error: err.message || "Could not submit player registration" },
            { status: 500 }
        );
    }
}
