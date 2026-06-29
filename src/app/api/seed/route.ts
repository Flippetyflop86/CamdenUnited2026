import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { initialData } from "@/lib/initial-data";

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
    try {
        const supabase = getAdminClient();
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
        let member: any = null;
        const { data: existingMember } = await supabase
            .from("club_members")
            .select("club_id, role")
            .eq("user_id", user.id)
            .maybeSingle();

        if (!existingMember) {
            // Auto-create a club first
            const { data: newClub, error: clubErr } = await supabase
                .from("clubs")
                .insert([{
                    name: "ClubFlow United",
                    primary_color: "#ef4444"
                }])
                .select()
                .single();

            if (clubErr || !newClub) {
                return NextResponse.json({ success: false, error: "Failed to auto-create club during seed: " + (clubErr?.message || "Unknown error") }, { status: 500 });
            }

            // Create membership
            const { data: newMember, error: memberErr } = await supabase
                .from("club_members")
                .insert([{
                    club_id: newClub.id,
                    user_id: user.id,
                    role: "Manager",
                    display_name: user.user_metadata?.full_name || "Leon"
                }])
                .select()
                .single();

            if (memberErr || !newMember) {
                return NextResponse.json({ success: false, error: "Failed to auto-create club membership: " + (memberErr?.message || "Unknown error") }, { status: 500 });
            }

            member = newMember;
        } else {
            member = existingMember;
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

        // Wipe existing data for this club first to remove real Camden United data
        await supabase.from("players").delete().eq("club_id", clubId);
        await supabase.from("matches").delete().eq("club_id", clubId);
        await supabase.from("training_sessions").delete().eq("club_id", clubId);

        const FIRST_NAMES = ["David", "James", "Robert", "John", "Michael", "William", "Kieran", "Thomas", "Daniel", "Matthew", "Steven", "Chris", "Andrew", "Ryan", "Luke", "Alex", "Sam", "Harry", "Jack", "Oliver"];
        const LAST_NAMES = ["Smith", "Jones", "Taylor", "Brown", "Wilson", "Johnson", "Davis", "Walker", "Green", "Wood", "Harris", "Clark", "Lewis", "Robinson", "Hall", "Wright", "King", "Baker", "Carter", "Ward"];
        const OPPONENTS = ["Rangers FC", "City Athletic", "Rovers FC", "Wanderers FC", "Town FC", "Albion FC", "United FC", "County FC", "Real FC", "Athletic Club"];

        // 3. Seed Players with randomized generic names
        if (initialData.players && initialData.players.length > 0) {
            const playersToInsert = initialData.players.map((p: any, index: number) => {
                const randomFirstName = FIRST_NAMES[index % FIRST_NAMES.length];
                const randomLastName = LAST_NAMES[(index + 3) % LAST_NAMES.length];
                return {
                    club_id: clubId,
                    first_name: randomFirstName,
                    last_name: randomLastName,
                    position: p.position,
                    squad_number: p.squadNumber || (index + 1),
                    age: p.age,
                    date_of_birth: p.dateOfBirth,
                    nationality: p.nationality || "English",
                    squad: p.squad, 
                    medical_status: p.medicalStatus || "Available",
                    availability: p.availability || false,
                    contract_expiry: p.contractExpiry,
                    image_url: "/placeholder-player.png", 
                    appearances: p.appearances || 0,
                    goals: p.goals || 0,
                    assists: p.assists || 0,
                    is_in_training_squad: p.isInTrainingSquad || true
                };
            });

            const { error: playerError } = await supabase.from("players").insert(playersToInsert);
            if (playerError) throw playerError;
            results.players = playersToInsert.length;
        }

        // 4. Seed Matches with randomized generic opponents
        const localMatches = initialData["camden-united-matches-v6"] as any[];
        if (localMatches && localMatches.length > 0) {
            const matchesToInsert = localMatches.map((m: any, index: number) => {
                const randomOpponent = OPPONENTS[index % OPPONENTS.length];
                return {
                    club_id: clubId,
                    date: m.date,
                    time: m.time,
                    opponent: randomOpponent,
                    is_home: m.isHome,
                    competition: m.competition || "League",
                    scoreline: m.scoreline,
                    result: m.result,
                    goalscorers: null, 
                    assists: null,
                    notes: "Pre-season friendly demo"
                };
            });

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
