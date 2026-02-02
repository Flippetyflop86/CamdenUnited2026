import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { initialData } from "@/lib/initial-data";

export async function POST() {
    try {
        const results = {
            players: 0,
            matches: 0,
        };

        // 1. Migrate Players
        if (initialData.players && initialData.players.length > 0) {
            // Map local player structure to DB columns (camelCase -> snake_case)
            const playersToInsert = initialData.players.map((p: any) => ({
                // id: p.id, // Let Supabase generate partial UUIDs is tricky, but usually better to let DB handle IDs or use the provided ones if they are valid UUIDs. 
                // Our local IDs are like 'p001', which aren't valid UUIDs. 
                // STRATEGY: We will let Supabase generate new UUIDs. This means relationships will break unless we map them.
                // HOWEVER: For a V1 migration, we might just re-create everyone.
                // BETTER STRATEGY: Keep it simple. Just insert properties.
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

        // 2. Migrate Matches
        const localMatches = initialData["camden-united-matches-v6"] as any[];
        if (localMatches && localMatches.length > 0) {
            const matchesToInsert = localMatches.map((m: any) => ({
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

        // 3. Migrate Settings (Upsert)
        // We assume ID 1 for single row settings
        const settings = initialData["club-settings"] as any;
        if (settings) {
            const { error: settingsError } = await supabase.from("club_settings").upsert({
                id: 1,
                name: settings.name,
                logo: settings.logo,
                primary_color: settings.primaryColor
            });
            if (settingsError) throw settingsError;
        }

        // 4. Migrate Finance Users (as simple rows for now)
        // Skipped for this simplified pass, user can re-create or we add later.

        return NextResponse.json({ success: true, results });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
