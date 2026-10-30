import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email-service";

function getAdminClient() {
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!key) {
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
    const supabaseAdmin = getAdminClient();
    try {
        const authHeader = request.headers.get("Authorization");
        const token = authHeader?.split(" ")[1];
        if (!token) {
            return NextResponse.json({ success: false, error: "Unauthorized: Missing authentication token" }, { status: 401 });
        }

        const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token);
        if (authErr || !user) {
            return NextResponse.json({ success: false, error: "Unauthorized: Invalid session token" }, { status: 401 });
        }

        const body = await request.json();
        const { clubId, recipientGroup, subject, message, eventId, eventType } = body;

        if (!clubId || !recipientGroup || !subject || !message) {
            return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
        }

        // Verify caller belongs to the target clubId
        const { data: callerMember } = await supabaseAdmin
            .from("club_members")
            .select("club_id, role")
            .eq("user_id", user.id)
            .eq("club_id", clubId)
            .maybeSingle();

        if (!callerMember) {
            return NextResponse.json({ success: false, error: "Forbidden: You do not belong to this club" }, { status: 403 });
        }

        // 1. Fetch targeted player/member records
        let recipients: any[] = [];

        const { data: rawPlayers, error: playersErr } = await supabaseAdmin
            .from("players")
            .select("*")
            .eq("club_id", clubId);

        if (playersErr) throw playersErr;

        const players = (rawPlayers || []).filter((p: any) => {
            if (p.club_status && p.club_status !== "Active") return false;
            if (p.notes && /\[LEFT_STATUS:[^\]]+\]/.test(p.notes) && !p.notes.includes("[LEFT_STATUS:Active]")) return false;
            return true;
        });

        const { data: staff } = await supabaseAdmin
            .from("club_members")
            .select("*, app_users:user_id(username, name)")
            .eq("club_id", clubId);

        if (recipientGroup === "Entire Club") {
            recipients = [...(players || [])];
        } else if (recipientGroup === "First Team") {
            recipients = (players || []).filter(p => p.squad === "firstTeam" || p.squad === "First Team");
        } else if (recipientGroup === "Reserves") {
            recipients = (players || []).filter(p => p.squad === "reserves" || p.squad === "Reserves");
        } else if (recipientGroup === "Specific Squad") {
            recipients = [...(players || [])];
        } else if (recipientGroup === "Pending Invitations") {
            recipients = (players || []).filter(p => p.status === "Pending Invitation" || p.status === "Pending Activation" || !p.email);
        } else if (recipientGroup === "Outstanding Players") {
            if (eventId) {
                if (eventType === "match") {
                    const { data: match } = await supabaseAdmin.from("matches").select("notes").eq("id", eventId).eq("club_id", clubId).single();
                    const notes = match?.notes || "";
                    const matchRaw = notes.match(/\[AVAILABILITY:\s*(.*?)\s*\]/);
                    let respondedPlayerIds: string[] = [];
                    if (matchRaw && matchRaw[1]) {
                        try {
                            const list = JSON.parse(matchRaw[1]);
                            respondedPlayerIds = list.map((a: any) => a.playerId);
                        } catch (e) {}
                    }
                    recipients = (players || []).filter(p => !respondedPlayerIds.includes(p.id));
                } else {
                    const { data: session } = await supabaseAdmin.from("training_sessions").select("attendance").eq("id", eventId).eq("club_id", clubId).single();
                    const attendance = session?.attendance || [];
                    const respondedPlayerIds = attendance.map((a: any) => a.playerId);
                    recipients = (players || []).filter(p => !respondedPlayerIds.includes(p.id));
                }
            } else {
                recipients = [...(players || [])];
            }
        } else if (recipientGroup === "Registered Players") {
            recipients = (players || []).filter(p => p.status === "Registered");
        } else if (recipientGroup === "Managers") {
            recipients = (staff || []).map((s: any) => ({
                first_name: s.app_users?.name?.split(" ")[0] || "Coach",
                last_name: s.app_users?.name?.split(" ")[1] || "",
                email: s.app_users?.username
            })).filter(s => !!s.email);
        }

        const validRecipients = recipients.filter(r => !!r.email);

        if (validRecipients.length === 0) {
            return NextResponse.json({ success: false, error: "No players in this group have a registered email address." }, { status: 400 });
        }

        let eventContext: any = null;
        if (eventId) {
            if (eventType === "match") {
                const { data: match } = await supabaseAdmin.from("matches").select("*").eq("id", eventId).eq("club_id", clubId).single();
                eventContext = match;
            } else {
                const { data: session } = await supabaseAdmin.from("training_sessions").select("*").eq("id", eventId).eq("club_id", clubId).single();
                eventContext = session;
            }
        }

        let sentCount = 0;
        let failedCount = 0;
        const origin = request.headers.get("origin") || "https://www.clubflow.org.uk";

        for (const recipient of validRecipients) {
            let personalSubject = subject;
            let personalMessage = message;

            const name = recipient.first_name || "Player";
            const dateStr = eventContext?.date ? new Date(eventContext.date).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" }) : "Upcoming Session";
            const location = eventContext?.location || eventContext?.opponent || "TBD";
            const tokenVal = eventContext?.event_token || eventContext?.id || "";
            const respondUrl = `${origin}/respond/${tokenVal}`;

            personalSubject = personalSubject
                .replace(/{{FirstName}}/g, name)
                .replace(/{{TrainingDate}}/g, dateStr)
                .replace(/{{Location}}/g, location);

            personalMessage = personalMessage
                .replace(/{{FirstName}}/g, name)
                .replace(/{{TrainingDate}}/g, dateStr)
                .replace(/{{Location}}/g, location)
                .replace(/{{SessionCode}}/g, "")
                .replace(/{{RsvpLink}}/g, respondUrl)
                .replace(/{{JoinLink}}/g, `${origin}/join`);

            const success = await sendEmail({
                to: recipient.email,
                subject: personalSubject,
                text: personalMessage
            });

            if (success) {
                sentCount++;
            } else {
                failedCount++;
            }
        }

        const status = failedCount === 0 ? "Delivered" : sentCount > 0 ? "Delivered" : "Failed";
        await supabaseAdmin
            .from("email_history")
            .insert({
                club_id: clubId,
                subject,
                body_content: message,
                recipient_group: recipientGroup,
                recipients_count: validRecipients.length,
                status
            });

        return NextResponse.json({
            success: true,
            message: `Successfully processed communication. Sent: ${sentCount}, Failed: ${failedCount}.`
        });

    } catch (err: any) {
        console.error("Send communications email error:", err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
