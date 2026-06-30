import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
    try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!supabaseUrl || !serviceKey) {
            return NextResponse.json({ 
                success: false, 
                error: 'Server credentials missing. Ensure SUPABASE_SERVICE_ROLE_KEY is set.' 
            }, { status: 500 });
        }

        // Initialize admin client to bypass RLS policies
        const supabase = createClient(supabaseUrl, serviceKey, {
            auth: {
                persistSession: false,
                autoRefreshToken: false
            }
        });

        // 1. Fetch all clubs
        const { data: clubs, error: clubsErr } = await supabase.from("clubs").select("id, name");
        if (clubsErr) throw clubsErr;

        const log: string[] = [];

        for (const club of clubs) {
            // 2. Fetch players to check if club is active
            const { data: clubPlayers, error: playErr } = await supabase
                .from("players")
                .select("id")
                .eq("club_id", club.id);

            if (playErr) {
                log.push(`Failed to fetch players for ${club.name}: ${playErr.message}`);
                continue;
            }

            if (!clubPlayers || clubPlayers.length === 0) {
                continue; // Skip inactive/empty clubs
            }

            // 3. Check if training sessions exist
            const { data: sessions, error: sessErr } = await supabase
                .from("training_sessions")
                .select("id")
                .eq("club_id", club.id);

            if (sessErr) {
                log.push(`Failed to fetch sessions for ${club.name}: ${sessErr.message}`);
                continue;
            }

            // 4. Recreate if missing
            if (sessions.length === 0) {
                const today = new Date();
                const topics = ["Passing & Possession", "Defending Transitions", "Shooting & Finishing"];
                const sessionsToInsert = [];

                for (let i = 0; i < 3; i++) {
                    const date = new Date();
                    date.setDate(today.getDate() + ((i - 1) * 7)); // -7 days, today, +7 days
                    
                    const attendance = clubPlayers.map(p => ({
                        playerId: p.id,
                        status: Math.random() > 0.3 ? "Present" : Math.random() > 0.5 ? "Absent" : "Late",
                        notes: ""
                    }));

                    sessionsToInsert.push({
                        club_id: club.id,
                        date: date.toISOString().split('T')[0],
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

                const { error: insErr } = await supabase.from("training_sessions").insert(sessionsToInsert);
                if (insErr) {
                    log.push(`Failed to insert sessions for ${club.name}: ${insErr.message}`);
                } else {
                    log.push(`Restored 3 training sessions for ${club.name} (${club.id})`);
                }
            } else {
                log.push(`Club ${club.name} already has ${sessions.length} sessions. Skipped.`);
            }
        }

        return NextResponse.json({ success: true, log });
    } catch (e: any) {
        console.error("Restore training error:", e);
        return NextResponse.json({ success: false, error: e.message || 'Unknown error' }, { status: 500 });
    }
}
