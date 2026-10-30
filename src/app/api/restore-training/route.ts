import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
    try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

        if (!supabaseUrl || !serviceKey) {
            return NextResponse.json({
                success: false,
                error: 'Server credentials missing.'
            }, { status: 500 });
        }

        const authHeader = request.headers.get("Authorization");
        const token = authHeader?.split(" ")[1];
        if (!token) {
            return NextResponse.json({ success: false, error: "Unauthorized: Missing authentication token" }, { status: 401 });
        }

        const supabase = createClient(supabaseUrl, serviceKey, {
            auth: {
                persistSession: false,
                autoRefreshToken: false
            }
        });

        const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
        if (authErr || !user) {
            return NextResponse.json({ success: false, error: "Unauthorized: Invalid token" }, { status: 401 });
        }

        const { data: member } = await supabase
            .from("club_members")
            .select("club_id, role")
            .eq("user_id", user.id)
            .maybeSingle();

        const roleClean = (member?.role || "").toLowerCase();
        if (!member?.club_id || (roleClean !== "manager" && roleClean !== "coach" && roleClean !== "super admin")) {
            return NextResponse.json({ success: false, error: "Forbidden: Manager or Coach role required" }, { status: 403 });
        }

        const clubId = member.club_id;
        const { data: clubPlayers } = await supabase
            .from("players")
            .select("id")
            .eq("club_id", clubId);

        if (!clubPlayers || clubPlayers.length === 0) {
            return NextResponse.json({ success: true, log: ["No players in club yet. Skipped."] });
        }

        const { data: sessions } = await supabase
            .from("training_sessions")
            .select("id")
            .eq("club_id", clubId);

        if (sessions && sessions.length > 0) {
            return NextResponse.json({ success: true, log: [`Club already has ${sessions.length} sessions. Skipped.`] });
        }

        const today = new Date();
        const topics = ["Passing & Possession", "Defending Transitions", "Shooting & Finishing"];
        const sessionsToInsert = [];

        for (let i = 0; i < 3; i++) {
            const date = new Date();
            date.setDate(today.getDate() + ((i - 1) * 7));
            const attendance = clubPlayers.map(p => ({
                playerId: p.id,
                status: "Present",
                notes: ""
            }));

            sessionsToInsert.push({
                club_id: clubId,
                date: date.toISOString().split('T')[0],
                time: "20:00",
                location: "Training Ground",
                squad: "All",
                topic: topics[i],
                lock_type: "Never",
                lock_time: null,
                event_token: Math.random().toString(36).substring(2, 15),
                attendance,
                notes: `Training session ${i + 1}`
            });
        }

        const { error: insErr } = await supabase.from("training_sessions").insert(sessionsToInsert);
        if (insErr) {
            return NextResponse.json({ success: false, error: insErr.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, log: [`Restored 3 training sessions for club ${clubId}`] });
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}
