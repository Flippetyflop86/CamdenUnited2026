import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase";

export const preferredRegion = ["lhr1"];

function isOurClubName(candidate: string, clubName: string): boolean {
    const c = (candidate || "").toLowerCase().trim();
    const target = (clubName || "").toLowerCase().trim();
    const core = target.replace(/\bfc\b/g, "").trim();
    if (!c || !target) return false;
    if (c === target) return true;
    if (core.length >= 4 && c === core) return true;
    return c.includes(target);
}

export async function GET(request: Request) {
    return handleScheduledLeagueAndSquadSync(request);
}

export async function POST(request: Request) {
    return handleScheduledLeagueAndSquadSync(request);
}

async function handleScheduledLeagueAndSquadSync(request: Request) {
    const supabase = getServerSupabase();
    const authHeader = request.headers.get("authorization");
    const isVercelCron = request.headers.get("x-vercel-cron") === "1";
    const isCronAuthorized = Boolean(
        isVercelCron ||
            (process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`) ||
            (process.env.NODE_ENV !== "production" && !authHeader)
    );

    let scopedClubId: string | null = null;

    if (!isCronAuthorized) {
        // Allow an authenticated club staff member to trigger a background refresh for their own club
        const token = authHeader?.split(" ")[1];
        if (!token) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        const {
            data: { user },
            error: authErr,
        } = await supabase.auth.getUser(token);
        if (authErr || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        const { data: member } = await supabase
            .from("club_members")
            .select("club_id")
            .eq("user_id", user.id)
            .maybeSingle();
        if (!member?.club_id) {
            return NextResponse.json({ error: "Club membership not found" }, { status: 404 });
        }
        scopedClubId = member.club_id;
    }

    try {
        const todayIso = new Date().toISOString().split("T")[0];
        const nowIso = new Date().toISOString();
        const origin =
            request.headers.get("origin") ||
            process.env.NEXT_PUBLIC_SITE_URL ||
            "https://www.clubflow.org.uk";

        // 1. Auto-clear expired player injury return dates & expired holidays (#33)
        let playersQuery = supabase
            .from("players")
            .select("id, medical_status, holiday_end, notes")
            .in("medical_status", ["Injured", "Doubtful", "Holiday"]);
        if (scopedClubId) {
            playersQuery = playersQuery.eq("club_id", scopedClubId);
        }
        const { data: candidatePlayers } = await playersQuery;
        let clearedInjuriesCount = 0;

        for (const pl of candidatePlayers || []) {
            const notesStr = pl.notes || "";
            if (/\[LEFT_STATUS:[^\]]+\]/.test(notesStr)) continue;
            const retMatch = notesStr.match(/\[RETURN_DATE:([^\]]+)\]/);
            const retDate = retMatch ? retMatch[1].trim() : "";

            const injuryReady =
                (pl.medical_status === "Injured" || pl.medical_status === "Doubtful") &&
                Boolean(retDate && retDate <= todayIso);
            const holidayReady =
                pl.medical_status === "Holiday" &&
                Boolean(pl.holiday_end && String(pl.holiday_end).slice(0, 10) < todayIso);

            if (injuryReady || holidayReady) {
                const cleanedNotes = notesStr
                    .replace(/\[RETURN_DATE:[^\]]*\]\s*/g, "")
                    .replace(/\[INJURY:[^\]]*\]\s*/g, "")
                    .replace(/\[OUT_DURATION:[^\]]*\]\s*/g, "")
                    .trim();
                await supabase
                    .from("players")
                    .update({
                        medical_status: "Available",
                        availability: true,
                        notes: cleanedNotes,
                        holiday_start: null,
                        holiday_end: null,
                    })
                    .eq("id", pl.id);
                clearedInjuriesCount++;
            }
        }

        // 2. Sync League Table & Fixtures for clubs with a configured league_url (#22)
        let clubsQuery = supabase
            .from("clubs")
            .select("id, name, league_url, league_position, last_import_history");
        if (scopedClubId) {
            clubsQuery = clubsQuery.eq("id", scopedClubId);
        } else {
            clubsQuery = clubsQuery.not("league_url", "is", null);
        }

        const { data: clubs } = await clubsQuery;
        let syncedClubsCount = 0;
        let syncedFixturesCount = 0;

        for (const club of clubs || []) {
            const leagueUrl = (club.league_url || "").trim();
            if (!leagueUrl || !/^https?:\/\//i.test(leagueUrl)) continue;

            try {
                // A. Sync League Standings
                const syncRes = await fetch(`${origin}/api/sync-league`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        url: leagueUrl,
                        clubName: club.name || "Club",
                    }),
                });
                const syncData = await syncRes.json().catch(() => null);
                const rawRows: any[] = Array.isArray(syncData?.standings)
                    ? syncData.standings
                    : Array.isArray(syncData?.table)
                    ? syncData.table
                    : [];

                if (rawRows.length > 0) {
                    const prevRows: any[] = Array.isArray(club.last_import_history?.leagueTable)
                        ? club.last_import_history.leagueTable
                        : [];
                    const prevPosByTeam = new Map<string, number>();
                    for (const pr of prevRows) {
                        if (pr?.team_name && typeof pr.position === "number") {
                            prevPosByTeam.set(String(pr.team_name).toLowerCase().trim(), pr.position);
                        }
                    }

                    const normalizedRows = rawRows.map((r: any, idx: number) => {
                        const teamName = String(r.team_name || r.team || "Club").trim();
                        const pos = Number(r.position ?? idx + 1);
                        const prevPos = prevPosByTeam.get(teamName.toLowerCase()) ?? pos;
                        return {
                            position: pos,
                            previous_position: prevPos,
                            team_name: teamName,
                            played: Number(r.played ?? 0),
                            won: Number(r.won ?? 0),
                            drawn: Number(r.drawn ?? 0),
                            lost: Number(r.lost ?? 0),
                            goals_for: Number(r.goals_for ?? r.gf ?? 0),
                            goals_against: Number(r.goals_against ?? r.ga ?? 0),
                            goal_difference: Number(
                                r.goal_difference ?? (Number(r.goals_for ?? 0) - Number(r.goals_against ?? 0))
                            ),
                            points: Number(r.points ?? r.pts ?? 0),
                            form: Array.isArray(r.form) ? r.form : undefined,
                            is_our_club: Boolean(r.is_our_club || isOurClubName(teamName, club.name || "")),
                        };
                    });

                    const ourRow = normalizedRows.find((r) => r.is_our_club);
                    const nextHistory = {
                        ...(club.last_import_history || {}),
                        leagueTable: normalizedRows,
                        updatedAt: nowIso,
                    };

                    await supabase
                        .from("clubs")
                        .update({
                            league_position: ourRow ? ourRow.position : club.league_position,
                            last_import_history: nextHistory,
                        })
                        .eq("id", club.id);

                    const tablePayload = JSON.stringify(normalizedRows);
                    const { data: existingCache } = await supabase
                        .from("documents")
                        .select("id")
                        .eq("club_id", club.id)
                        .eq("category", "LEAGUE_TABLE_CACHE")
                        .maybeSingle();

                    if (existingCache?.id) {
                        await supabase
                            .from("documents")
                            .update({ url: tablePayload, name: "League Standings Cache" })
                            .eq("id", existingCache.id);
                    } else {
                        await supabase.from("documents").insert({
                            club_id: club.id,
                            name: "League Standings Cache",
                            type: "JSON",
                            category: "LEAGUE_TABLE_CACHE",
                            url: tablePayload,
                        });
                    }

                    syncedClubsCount++;
                }

                // B. Sync Fixtures & Full-Time Scores (non-destructive: never overwrites manual lineups or scorers)
                const fixRes = await fetch(`${origin}/api/sync-fixtures`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        url: leagueUrl,
                        clubName: club.name || "Club",
                    }),
                });
                const fixData = await fixRes.json().catch(() => null);
                const incomingFixtures: any[] = Array.isArray(fixData?.matches) ? fixData.matches : [];

                if (incomingFixtures.length > 0) {
                    const { data: existingMatches } = await supabase
                        .from("matches")
                        .select("id, date, opponent, scoreline, result")
                        .eq("club_id", club.id);

                    const existingList = existingMatches || [];
                    for (const inc of incomingFixtures) {
                        if (!inc.date || !inc.opponent) continue;
                        const matchExisting = existingList.find(
                            (e: any) =>
                                e.date === inc.date &&
                                String(e.opponent || "").toLowerCase().trim() ===
                                    String(inc.opponent).toLowerCase().trim()
                        );

                        if (!matchExisting) {
                            await supabase.from("matches").insert([
                                {
                                    club_id: club.id,
                                    date: inc.date,
                                    time: inc.time || "15:00",
                                    opponent: inc.opponent,
                                    is_home: Boolean(inc.is_home),
                                    competition: inc.competition || "League",
                                    scoreline: inc.scoreline || "",
                                    result: inc.result || "Pending",
                                    notes: inc.notes || "",
                                    event_token:
                                        Math.random().toString(36).substring(2, 15) +
                                        Math.random().toString(36).substring(2, 15),
                                },
                            ]);
                            syncedFixturesCount++;
                        } else if (
                            inc.scoreline &&
                            inc.result &&
                            inc.result !== "Pending" &&
                            (!matchExisting.scoreline || matchExisting.result === "Pending")
                        ) {
                            await supabase
                                .from("matches")
                                .update({
                                    scoreline: inc.scoreline,
                                    result: inc.result,
                                })
                                .eq("id", matchExisting.id);
                            syncedFixturesCount++;
                        }
                    }
                }
            } catch (clubSyncErr) {
                console.warn(`Scheduled league sync warning for club ${club.id}:`, clubSyncErr);
            }
        }

        return NextResponse.json({
            success: true,
            syncedClubsCount,
            syncedFixturesCount,
            clearedInjuriesCount,
            syncedAt: nowIso,
        });
    } catch (err: any) {
        console.error("Scheduled league-sync error:", err);
        return NextResponse.json(
            { error: err.message || "Internal Server Error" },
            { status: 500 }
        );
    }
}
