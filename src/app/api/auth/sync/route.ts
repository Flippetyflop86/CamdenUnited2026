import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getAdminClient(token?: string) {
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!key) {
        return createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            token
                ? {
                      global: {
                          headers: {
                              Authorization: `Bearer ${token}`,
                          },
                      },
                  }
                : undefined
        );
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
            return NextResponse.json({ success: false, error: "Unauthorized: Missing token" }, { status: 401 });
        }

        let body: { clubName?: string; provisionIfOrphaned?: boolean } = {};
        try {
            body = await request.json();
        } catch {
            // Optional JSON body
        }

        const supabase = getAdminClient(token);

        // 1. Verify user token
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) {
            return NextResponse.json({ success: false, error: "Unauthorized: Invalid token" }, { status: 401 });
        }

        // 2. Query club_members (bypassing RLS with service role key if present)
        const { data: member, error: memberError } = await supabase
            .from("club_members")
            .select("id, club_id, role, page_permissions, display_name, user_id")
            .or(`user_id.eq.${user.id},email.ilike.${user.email}`)
            .limit(1)
            .maybeSingle();

        if (memberError) {
            console.error("Database query error in sync API:", memberError);
            return NextResponse.json({ success: false, error: memberError.message }, { status: 500 });
        }

        if (member) {
            // Verify that the linked club actually still exists in public.clubs
            const { data: existingClub } = await supabase
                .from("clubs")
                .select("id")
                .eq("id", member.club_id)
                .maybeSingle();

            if (existingClub) {
                // 3. Auto-heal/sync user_id if it mismatches
                if (member.user_id !== user.id) {
                    console.log(`Syncing user_id in club_members for email ${user.email} from ${member.user_id} to ${user.id}`);
                    const { error: updateError } = await supabase
                        .from("club_members")
                        .update({ user_id: user.id })
                        .eq("id", member.id);

                    if (updateError) {
                        console.error("Failed to update user_id in sync API:", updateError);
                    }
                }

                return NextResponse.json({
                    success: true,
                    alreadyExisted: true,
                    membership: {
                        club_id: member.club_id,
                        role: member.role,
                        page_permissions: member.page_permissions || [],
                        display_name: member.display_name || null
                    }
                });
            } else {
                // The club row was deleted, so clean up the dangling club_members row
                await supabase.from("club_members").delete().eq("id", member.id);
            }
        }

        // 4. If the user has no active club membership (e.g. previous club/member was deleted),
        // automatically provision a new club workspace if requested or if user_metadata has club_name.
        const desiredClubName =
            body.clubName?.trim() ||
            user.user_metadata?.club_name?.trim();

        if (desiredClubName && (body.provisionIfOrphaned !== false)) {
            const { data: newClub, error: clubCreateErr } = await supabase
                .from("clubs")
                .insert({ name: desiredClubName })
                .select("id")
                .single();

            if (clubCreateErr || !newClub) {
                console.error("Failed to auto-provision club for orphaned user:", clubCreateErr);
                return NextResponse.json(
                    { success: false, error: clubCreateErr?.message || "Failed to create club workspace" },
                    { status: 500 }
                );
            }

            const defaultDisplayName =
                user.user_metadata?.full_name ||
                (user.email ? user.email.split("@")[0] : "Manager");

            const { data: newMember, error: memberCreateErr } = await supabase
                .from("club_members")
                .insert({
                    user_id: user.id,
                    club_id: newClub.id,
                    role: "manager",
                    email: user.email,
                    display_name: defaultDisplayName,
                    page_permissions: [],
                })
                .select("id, club_id, role, page_permissions, display_name")
                .single();

            if (memberCreateErr || !newMember) {
                console.error("Failed to insert club_members for re-provisioned user:", memberCreateErr);
                return NextResponse.json(
                    { success: false, error: memberCreateErr?.message || "Failed to link club membership" },
                    { status: 500 }
                );
            }

            return NextResponse.json({
                success: true,
                provisionedNewClub: true,
                membership: {
                    club_id: newMember.club_id,
                    role: newMember.role,
                    page_permissions: newMember.page_permissions || [],
                    display_name: newMember.display_name || null,
                },
            });
        }

        return NextResponse.json({ success: true, membership: null });
    } catch (err: any) {
        console.error("Unhandled error in auth sync API:", err);
        return NextResponse.json({ success: false, error: err.message || "Server error" }, { status: 500 });
    }
}
