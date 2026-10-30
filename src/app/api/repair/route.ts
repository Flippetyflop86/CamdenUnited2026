import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getAdminClient() {
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!key) {
        throw new Error("Supabase credentials missing on the server.");
    }
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        key
    );
}

export async function POST(request: Request) {
    try {
        const authHeader = request.headers.get("Authorization");
        const token = authHeader?.split(" ")[1];
        if (!token) {
            return NextResponse.json({ error: "Unauthorized: Missing authentication token" }, { status: 401 });
        }

        const supabase = getAdminClient();
        const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
        if (authErr || !user) {
            return NextResponse.json({ error: "Unauthorized: Invalid token" }, { status: 401 });
        }

        const { data: member } = await supabase
            .from("club_members")
            .select("club_id, role")
            .eq("user_id", user.id)
            .maybeSingle();

        const roleClean = (member?.role || "").toLowerCase();
        if (!member?.club_id || (roleClean !== "manager" && roleClean !== "super admin")) {
            return NextResponse.json({ error: "Forbidden: Manager role required" }, { status: 403 });
        }

        const clubId = member.club_id;
        const { searchParams } = new URL(request.url);
        const action = searchParams.get("action");
        const playerName = searchParams.get("player");

        if (action === "inspect" && playerName) {
            const { data: players } = await supabase
                .from("players")
                .select("id, first_name, last_name")
                .eq("club_id", clubId)
                .ilike("last_name", `%${playerName}%`);

            if (!players || players.length === 0) {
                return NextResponse.json({ error: `Player matching ${playerName} not found in your club` });
            }

            const player = players[0];
            const { data: stats } = await supabase
                .from("match_player_stats")
                .select("*")
                .eq("player_id", player.id);

            const { data: matches } = await supabase
                .from("matches")
                .select("id, opponent, date, competition")
                .eq("club_id", clubId);

            const matchMap = new Map();
            matches?.forEach((m) => matchMap.set(m.id, m));

            const details =
                stats?.map((s) => {
                    const m = matchMap.get(s.match_id);
                    return {
                        matchId: s.match_id,
                        opponent: m ? m.opponent : "Unknown",
                        date: m ? m.date : "Unknown",
                        competition: m ? m.competition : "Unknown",
                        goals: s.goals,
                        assists: s.assists,
                        minutes: s.minutes_played
                    };
                }) || [];

            return NextResponse.json({
                player: `${player.first_name} ${player.last_name}`,
                playerId: player.id,
                totalAppearances: details.length,
                details
            });
        }

        // Scoped strictly to the authenticated manager's club_id
        const { data: matches, error: matchesErr } = await supabase
            .from("matches")
            .select("id, opponent, date, result, notes")
            .eq("club_id", clubId);

        if (matchesErr) {
            return NextResponse.json({ error: matchesErr.message }, { status: 500 });
        }

        const pendingMatches = (matches || []).filter((m) => m.result === "Pending" || !m.result);
        const pendingMatchIds = pendingMatches.map((m) => m.id);

        let cleanedLineupsCount = 0;
        const cleanedLineupsList = [];

        for (const m of pendingMatches) {
            if (m.notes && m.notes.includes("[Lineup: ")) {
                let cleanNotes = m.notes;
                const startIdx = cleanNotes.indexOf("[Lineup: ");
                const endIdx = cleanNotes.indexOf("}]", startIdx);
                if (endIdx !== -1) {
                    cleanNotes = (cleanNotes.substring(0, startIdx) + cleanNotes.substring(endIdx + 2)).trim();
                } else {
                    const singleEndIdx = cleanNotes.indexOf("]", startIdx);
                    if (singleEndIdx !== -1) {
                        cleanNotes = (cleanNotes.substring(0, startIdx) + cleanNotes.substring(singleEndIdx + 1)).trim();
                    }
                }

                await supabase
                    .from("matches")
                    .update({ notes: cleanNotes })
                    .eq("id", m.id)
                    .eq("club_id", clubId);

                cleanedLineupsCount++;
                cleanedLineupsList.push(`${m.opponent} on ${m.date}`);
            }
        }

        if (pendingMatchIds.length === 0) {
            return NextResponse.json({ success: true, message: "No pending matches found for your club." });
        }

        const { data: deletedStats, error: deleteErr } = await supabase
            .from("match_player_stats")
            .delete()
            .in("match_id", pendingMatchIds)
            .select();

        if (deleteErr) {
            return NextResponse.json({ error: deleteErr.message }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            message: "Successfully purged stats and reset lineups for pending matches in your club.",
            purgedCount: deletedStats?.length || 0,
            cleanedLineupsCount,
            cleanedLineupsList,
            pendingMatchesDeletedFrom: pendingMatches.map((m) => `${m.opponent} on ${m.date}`)
        });
    } catch (err: any) {
        return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
    }
}

