import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email-service";

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

// Generate a deterministic 6-character session code based on ID
function getSessionCode(id: string): string {
    const cleanId = id.replace(/-/g, "");
    return ("CU" + cleanId.substring(0, 4)).toUpperCase();
}

export async function POST(request: Request) {
    const supabaseAdmin = getAdminClient();
    try {
        const body = await request.json();
        const { clubId, recipientGroup, subject, message, eventId, eventType } = body;

        if (!clubId || !recipientGroup || !subject || !message) {
            return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
        }

        // 1. Fetch targeted player/member records
        let recipients: any[] = [];

        // Query all players in the club first
        const { data: players, error: playersErr } = await supabaseAdmin
            .from("players")
            .select("*")
            .eq("club_id", clubId);

        if (playersErr) throw playersErr;

        // Query all users/staff in the club members table
        const { data: staff, error: staffErr } = await supabaseAdmin
            .from("club_members")
            .select("*, app_users:user_id(username, name)")
            .eq("club_id", clubId);

        // Filter based on recipientGroup
        if (recipientGroup === "Entire Club") {
            recipients = [...(players || [])];
        } else if (recipientGroup === "First Team") {
            recipients = (players || []).filter(p => p.squad === "firstTeam" || p.squad === "First Team");
        } else if (recipientGroup === "Reserves") {
            recipients = (players || []).filter(p => p.squad === "reserves" || p.squad === "Reserves");
        } else if (recipientGroup === "Specific Squad") {
            recipients = [...(players || [])]; // fallback
        } else if (recipientGroup === "Pending Invitations") {
            recipients = (players || []).filter(p => p.status === "Pending Invitation" || p.status === "Pending Activation" || !p.email);
        } else if (recipientGroup === "Outstanding Players") {
            if (eventId) {
                if (eventType === "match") {
                    const { data: match } = await supabaseAdmin.from("matches").select("notes").eq("id", eventId).single();
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
                    const { data: session } = await supabaseAdmin.from("training_sessions").select("attendance").eq("id", eventId).single();
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

        // Remove recipients who do not have an email address
        const validRecipients = recipients.filter(r => !!r.email);

        if (validRecipients.length === 0) {
            return NextResponse.json({ success: false, error: "No players in this group have a registered email address." }, { status: 400 });
        }

        // 2. Fetch event context if provided for merge tags
        let eventContext: any = null;
        if (eventId) {
            if (eventType === "match") {
                const { data: match } = await supabaseAdmin.from("matches").select("*").eq("id", eventId).single();
                eventContext = match;
            } else {
                const { data: session } = await supabaseAdmin.from("training_sessions").select("*").eq("id", eventId).single();
                eventContext = session;
            }
        }

        // 3. Loop and deliver emails
        let sentCount = 0;
        let failedCount = 0;
        const origin = request.headers.get("origin") || "https://www.clubflow.org.uk";

        for (const recipient of validRecipients) {
            // Build merge fields replacements
            let personalSubject = subject;
            let personalMessage = message;

            const name = recipient.first_name || "Player";
            const dateStr = eventContext?.date ? new Date(eventContext.date).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" }) : "Upcoming Session";
            const location = eventContext?.location || eventContext?.opponent || "TBD";
            const code = eventContext ? getSessionCode(eventContext.id) : "";
            const tokenVal = eventContext?.event_token || eventContext?.id || "";
            const respondUrl = `${origin}/respond/${tokenVal}`;

            // Replace standard merge tags
            personalSubject = personalSubject
                .replace(/{{FirstName}}/g, name)
                .replace(/{{TrainingDate}}/g, dateStr)
                .replace(/{{Location}}/g, location);

            personalMessage = personalMessage
                .replace(/{{FirstName}}/g, name)
                .replace(/{{TrainingDate}}/g, dateStr)
                .replace(/{{Location}}/g, location)
                .replace(/{{SessionCode}}/g, code)
                .replace(/{{RsvpLink}}/g, respondUrl)
                .replace(/{{JoinLink}}/g, `${origin}/join`);

            // Send actual email
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

        // 4. Log transaction to History
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
