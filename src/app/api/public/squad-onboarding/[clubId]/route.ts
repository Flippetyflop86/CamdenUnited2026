import { NextResponse } from "next/server";
import crypto from "crypto";
import { getServerSupabase } from "@/lib/supabase";
import { parsePlayerDeparture } from "@/lib/utils";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NONCE_RE = /^[0-9a-f]{16,32}$/i;

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

function getSigningSecret(): string {
    const serverSecret =
        process.env.PLAYER_INVITE_SECRET ||
        process.env.CRON_SECRET ||
        process.env.SUPABASE_SERVICE_ROLE_KEY ||
        process.env.STRIPE_SECRET_KEY;
    if (serverSecret) {
        return serverSecret;
    }
    if (process.env.NODE_ENV !== "production") {
        return "clubflow-local-dev-secret";
    }
    throw new Error("Server signing secret (SUPABASE_SERVICE_ROLE_KEY or PLAYER_INVITE_SECRET) is not configured.");
}

function signInviteToken(clubId: string, nonce: string, expUnix: number): string {
    return crypto
        .createHmac("sha256", getSigningSecret())
        .update(`player-reg:${clubId}:${nonce}:${expUnix}`)
        .digest("hex")
        .slice(0, 28);
}

function verifyInviteTokenFormat(
    clubId: string,
    rawToken: string | null | undefined
):
    | { valid: true; nonce: string; expUnix: number }
    | { valid: false; status: number; code: string; error: string } {
    if (!rawToken || typeof rawToken !== "string") {
        return {
            valid: false,
            status: 403,
            code: "MISSING_TOKEN",
            error: "This page requires a unique one-time registration link from your manager.",
        };
    }

    const parts = rawToken.trim().split(".");
    if (parts.length !== 3) {
        return {
            valid: false,
            status: 403,
            code: "INVALID_TOKEN",
            error: "Invalid registration link. Please ask your coach or manager for a fresh link.",
        };
    }

    const [nonce, expStr, providedSig] = parts;
    const expUnix = parseInt(expStr, 10);
    if (!NONCE_RE.test(nonce) || !expUnix || isNaN(expUnix) || !providedSig) {
        return {
            valid: false,
            status: 403,
            code: "INVALID_TOKEN",
            error: "Invalid registration link. Please ask your coach or manager for a fresh link.",
        };
    }

    const expectedSig = signInviteToken(clubId, nonce, expUnix);
    const sigBufA = Buffer.from(providedSig);
    const sigBufB = Buffer.from(expectedSig);
    if (sigBufA.length !== sigBufB.length || !crypto.timingSafeEqual(sigBufA, sigBufB)) {
        return {
            valid: false,
            status: 403,
            code: "INVALID_TOKEN",
            error: "Invalid registration link. Please ask your coach or manager for a fresh link.",
        };
    }

    const nowUnix = Math.floor(Date.now() / 1000);
    if (nowUnix > expUnix) {
        return {
            valid: false,
            status: 410,
            code: "EXPIRED_TOKEN",
            error: "This registration link has expired (links are valid for 72 hours). Ask your manager for a new link.",
        };
    }

    return { valid: true, nonce, expUnix };
}

async function isNonceAlreadyUsed(
    supabase: ReturnType<typeof getServerSupabase>,
    clubId: string,
    nonce: string
): Promise<boolean> {
    const tag = `[REG_NONCE:${nonce}]`;
    const [{ data: playerHit }, { data: logHit }] = await Promise.all([
        supabase
            .from("players")
            .select("id")
            .eq("club_id", clubId)
            .ilike("notes", `%${tag}%`)
            .limit(1)
            .maybeSingle(),
        supabase
            .from("activity_logs")
            .select("id")
            .eq("club_id", clubId)
            .ilike("details", `%${tag}%`)
            .limit(1)
            .maybeSingle(),
    ]);
    return Boolean(playerHit || logHit);
}

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

// Mint a fresh single-use 72-hour registration link (authenticated club staff only)
export async function PUT(
    request: Request,
    context: { params: Promise<{ clubId: string }> }
) {
    try {
        const { clubId } = await context.params;
        if (!clubId || !UUID_RE.test(clubId)) {
            return NextResponse.json({ error: "Invalid club ID" }, { status: 400 });
        }

        const authHeader = request.headers.get("authorization");
        const bearerToken = authHeader?.split(" ")[1];
        if (!bearerToken) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const supabase = getServerSupabase();
        const {
            data: { user },
            error: authErr,
        } = await supabase.auth.getUser(bearerToken);
        if (authErr || !user) {
            return NextResponse.json({ error: "Invalid session" }, { status: 401 });
        }

        const { data: member } = await supabase
            .from("club_members")
            .select("club_id, role")
            .eq("user_id", user.id)
            .eq("club_id", clubId)
            .maybeSingle();

        const isSuperAdmin = user.email?.toLowerCase() === "leon_@outlook.com" || user.user_metadata?.is_super_admin;
        if (!member && !isSuperAdmin) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const nonce = crypto.randomBytes(10).toString("hex");
        const expUnix = Math.floor(Date.now() / 1000) + 72 * 60 * 60; // 72 hours
        const sig = signInviteToken(clubId, nonce, expUnix);
        const inviteToken = `${nonce}.${expUnix}.${sig}`;

        return NextResponse.json({
            success: true,
            token: inviteToken,
            expiresAt: new Date(expUnix * 1000).toISOString(),
        });
    } catch (err: any) {
        console.error("Mint squad registration token error:", err);
        return NextResponse.json(
            { error: err.message || "Could not generate registration link" },
            { status: 500 }
        );
    }
}

export async function GET(
    request: Request,
    context: { params: Promise<{ clubId: string }> }
) {
    try {
        const { clubId } = await context.params;
        if (!clubId || !UUID_RE.test(clubId)) {
            return NextResponse.json({ error: "Invalid club link" }, { status: 400 });
        }

        const { searchParams } = new URL(request.url);
        const rawToken = searchParams.get("token");
        const tokenCheck = verifyInviteTokenFormat(clubId, rawToken);
        if (!tokenCheck.valid) {
            return NextResponse.json(
                { error: tokenCheck.error, code: tokenCheck.code },
                { status: tokenCheck.status }
            );
        }

        const supabase = getServerSupabase();
        const [alreadyUsed, { data: clubData, error: clubErr }] = await Promise.all([
            isNonceAlreadyUsed(supabase, clubId, tokenCheck.nonce),
            supabase
                .from("clubs")
                .select("id, name, logo, primary_color, squads")
                .eq("id", clubId)
                .single(),
        ]);

        if (alreadyUsed) {
            return NextResponse.json(
                {
                    error: "This one-time registration link has already been used. Ask your coach or manager for a fresh link if needed.",
                    code: "USED_TOKEN",
                },
                { status: 410 }
            );
        }

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
            token: rawToken,
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
            token?: string;
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

        const tokenCheck = verifyInviteTokenFormat(clubId, rawToken);
        if (!tokenCheck.valid) {
            return NextResponse.json(
                { error: tokenCheck.error, code: tokenCheck.code },
                { status: tokenCheck.status }
            );
        }

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
        const [alreadyUsed, { data: club }, { data: existingPlayers }] = await Promise.all([
            isNonceAlreadyUsed(supabase, clubId, tokenCheck.nonce),
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

        if (alreadyUsed) {
            return NextResponse.json(
                {
                    error: "This one-time registration link has already been used.",
                    code: "USED_TOKEN",
                },
                { status: 410 }
            );
        }

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

        const nonceTag = `[REG_NONCE:${tokenCheck.nonce}]`;
        const noteParts = ["[PENDING_REG:1]", "[REG:Standard]", nonceTag];
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

        // Permanently burn the single-use nonce in activity_logs so even if the pending entry is dismissed/deleted, the link stays dead forever
        try {
            await supabase.from("activity_logs").insert([
                {
                    club_id: clubId,
                    user_email: cleanEmail,
                    user_name: `${cleanFirst} ${cleanLast}`,
                    action: "New Player Registration Submitted",
                    details: `Submitted 1-time registration for ${resolvedSquad} (${cleanPos}) ${nonceTag}`,
                },
            ]);
        } catch {}

        return NextResponse.json({ success: true, squad: resolvedSquad });
    } catch (err: any) {
        console.error("Squad onboarding POST error:", err);
        return NextResponse.json(
            { error: err.message || "Could not submit player registration" },
            { status: 500 }
        );
    }
}
