import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { initialData } from "@/lib/initial-data";

export async function POST(request: Request) {
    try {
        const authHeader = request.headers.get("Authorization");
        const token = authHeader?.split(" ")[1];
        if (!token) {
            return NextResponse.json({ success: false, error: "Unauthorized: Missing authentication token" }, { status: 401 });
        }

        // 1. Verify user token
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) {
            return NextResponse.json({ success: false, error: "Unauthorized: Invalid token" }, { status: 401 });
        }

        // 2. Fetch club membership and verify role is Manager
        const { data: member, error: memberError } = await supabase
            .from("club_members")
            .select("club_id, role")
            .eq("user_id", user.id)
            .single();

        if (memberError || !member) {
            return NextResponse.json({ success: false, error: "Forbidden: Could not verify club membership" }, { status: 403 });
        }

        const roleClean = (member.role || "").toLowerCase();
        if (roleClean !== "manager" && roleClean !== "super admin") {
            return NextResponse.json({ success: false, error: "Forbidden: Only Managers can seed club data" }, { status: 403 });
        }

        const clubId = member.club_id;
        const results = {
            players: 0,
            matches: 0,
        };

        // 3. Migrate Players (explicitly inject clubId)
        if (initialData.players && initialData.players.length > 0) {
            const playersToInsert = initialData.players.map((p: any) => ({
                club_id: clubId,
                first_name: p.firstName,
                last_name: p.lastName,
                position: p.position,
                squad_number: p.squadNumber,
                age: p.age,
                date_of_birth: p.dateOfBirth,
                nationality: p.nationality,
                squad: p.squad, // 'firstTeam', etc.
                medical_status: p.medicalStatus,
                availability: p.availability,
                contract_expiry: p.contractExpiry,
                image_url: p.imageUrl,
                appearances: p.appearances || 0,
                goals: p.goals || 0,
                assists: p.assists || 0,
                is_in_training_squad: p.isInTrainingSquad
            }));

            const { error: playerError } = await supabase.from("players").insert(playersToInsert);
            if (playerError) throw playerError;
            results.players = playersToInsert.length;
        }

        // 4. Migrate Matches (explicitly inject clubId)
        const localMatches = initialData["camden-united-matches-v6"] as any[];
        if (localMatches && localMatches.length > 0) {
            const matchesToInsert = localMatches.map((m: any) => ({
                club_id: clubId,
                date: m.date,
                time: m.time,
                opponent: m.opponent,
                is_home: m.isHome,
                competition: m.competition,
                scoreline: m.scoreline,
                result: m.result,
                goalscorers: m.goalscorers,
                assists: m.assists,
                notes: m.notes
            }));

            const { error: matchError } = await supabase.from("matches").insert(matchesToInsert);
            if (matchError) throw matchError;
            results.matches = matchesToInsert.length;
        }

        // 5. Migrate Settings to correct clubs table
        const settings = initialData["club-settings"] as any;
        if (settings) {
            const { error: settingsError } = await supabase
                .from("clubs")
                .update({
                    name: settings.name,
                    logo: settings.logo,
                    primary_color: settings.primaryColor
                })
                .eq("id", clubId);
            if (settingsError) throw settingsError;
        }

        // 6. Seed mock training sessions with attendance
        const { data: dbPlayers } = await supabase
            .from("players")
            .select("id")
            .eq("club_id", clubId);

        if (dbPlayers && dbPlayers.length > 0) {
            // Delete existing sessions first to avoid clutter
            await supabase.from("training_sessions").delete().neq("id", "00000000-0000-0000-0000-000000000000");

            const today = new Date();
            const topics = ["Passing & Possession", "Defending Transitions", "Shooting & Finishing"];
            const sessionsToInsert = [];

            for (let i = 0; i < 3; i++) {
                const date = new Date();
                date.setDate(today.getDate() + ((i - 1) * 7)); // -7 days, today, +7 days
                const dateStr = date.toISOString().split("T")[0];

                const attendance = dbPlayers.map(p => ({
                    playerId: p.id,
                    status: Math.random() > 0.3 ? "Present" : Math.random() > 0.5 ? "Absent" : "Late",
                    notes: ""
                }));

                sessionsToInsert.push({
                    date: dateStr,
                    time: "20:00",
                    location: "Market Road Pitches",
                    squad: "All",
                    topic: topics[i],
                    lock_type: "Never",
                    lock_time: null,
                    event_token: Math.random().toString(36).substring(2, 15),
                    attendance,
                    notes: `Promotional drill session ${i+1}`
                });
            }

            const { error: trError } = await supabase.from("training_sessions").insert(sessionsToInsert);
            if (trError) console.warn("Failed to seed training sessions:", trError);
        }

        return NextResponse.json({ success: true, results });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
