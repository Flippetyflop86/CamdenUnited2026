import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getAdminClient() {
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!key) {
        throw new Error("SUPABASE_SERVICE_ROLE_KEY environment variable is missing on the server.");
    }
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        key
    );
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const secret = searchParams.get("secret");
        const action = searchParams.get("action");
        const playerName = searchParams.get("player");
        
        if (secret !== "clubflow_cleanup_2026") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const supabase = getAdminClient();
        
        if (action === "inspect" && playerName) {
            const { data: players } = await supabase
                .from('players')
                .select('id, first_name, last_name')
                .ilike('last_name', `%${playerName}%`);
            
            if (!players || players.length === 0) {
                return NextResponse.json({ error: `Player matching ${playerName} not found` });
            }
            
            const player = players[0];
            const { data: stats } = await supabase
                .from('match_player_stats')
                .select('*')
                .eq('player_id', player.id);
            
            const { data: matches } = await supabase
                .from('matches')
                .select('id, opponent, date, competition');
            
            const matchMap = new Map();
            matches?.forEach(m => matchMap.set(m.id, m));
            
            const details = stats?.map(s => {
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
        
        // Default action: purge pending match stats
        const { data: matches, error: matchesErr } = await supabase
            .from('matches')
            .select('id, opponent, date, result');
        
        if (matchesErr) {
            return NextResponse.json({ error: matchesErr.message }, { status: 500 });
        }

        const pendingMatches = (matches || []).filter(m => m.result === 'Pending' || !m.result);
        const pendingMatchIds = pendingMatches.map(m => m.id);

        if (pendingMatchIds.length === 0) {
            return NextResponse.json({ success: true, message: "No pending matches found." });
        }

        const { data: deletedStats, error: deleteErr } = await supabase
            .from('match_player_stats')
            .delete()
            .in('match_id', pendingMatchIds)
            .select();

        if (deleteErr) {
            return NextResponse.json({ error: deleteErr.message }, { status: 500 });
        }

        return NextResponse.json({ 
            success: true, 
            message: `Successfully purged stats for pending matches.`, 
            purgedCount: deletedStats?.length || 0,
            pendingMatchesDeletedFrom: pendingMatches.map(m => `${m.opponent} on ${m.date}`)
        });
    } catch (err: any) {
        return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
    }
}
