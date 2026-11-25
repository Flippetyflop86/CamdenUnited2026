import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase";
import { sendEmail } from "@/lib/email-service";
import { canAccessSubsPayments } from "@/lib/feature-flags";
import crypto from "crypto";

export async function POST(request: Request) {
    const supabase = getServerSupabase();
    try {
        const authHeader = request.headers.get("Authorization");
        const token = authHeader?.split(" ")[1];
        if (!token) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const {
            data: { user },
            error: authErr,
        } = await supabase.auth.getUser(token);
        if (authErr || !user) {
            return NextResponse.json({ error: "Invalid session" }, { status: 401 });
        }

        if (!canAccessSubsPayments(user.email)) {
            return NextResponse.json(
                { error: "Subs & Payments is coming soon and currently in private preview." },
                { status: 403 }
            );
        }

        const body = await request.json();
        const {
            clubId,
            clubName: bodyClubName,
            treasurerName,
            treasurerEmail,
            inviterName,
        } = body as {
            clubId?: string;
            clubName?: string;
            treasurerName?: string;
            treasurerEmail?: string;
            inviterName?: string;
        };

        const cleanName = (treasurerName || "Club Treasurer").trim();
        const cleanEmail = (treasurerEmail || "").trim().toLowerCase();

        if (!clubId || !cleanEmail) {
            return NextResponse.json(
                { error: "Club ID and Treasurer email are required" },
                { status: 400 }
            );
        }

        const { data: member } = await supabase
            .from("club_members")
            .select("club_id")
            .eq("user_id", user.id)
            .eq("club_id", clubId)
            .maybeSingle();

        if (!member) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const { data: clubRow } = await supabase
            .from("clubs")
            .select("name, primary_color")
            .eq("id", clubId)
            .maybeSingle();

        const effectiveClubName = bodyClubName?.trim() || clubRow?.name || "Your Football Club";
        const brandColor = clubRow?.primary_color || "#dc2626";
        const inviteToken = crypto.randomUUID();

        const origin =
            request.headers.get("origin") ||
            process.env.NEXT_PUBLIC_SITE_URL ||
            "https://www.clubflow.org.uk";

        const redirectParam = encodeURIComponent("/player-payments?openBankSetup=1");
        const inviteUrl = `${origin}/join?token=${inviteToken}&redirect=${redirectParam}`;

        const treasurerPermissions = [
            "payments",
            "finance",
            "budgets",
            "sponsors",
            "squad",
            "matches",
            "documents",
            "admin",
        ];

        await supabase.from("club_invitations").insert({
            club_id: clubId,
            email: cleanEmail,
            display_name: cleanName,
            role: "manager",
            token: inviteToken,
            page_permissions: treasurerPermissions,
        });

        await supabase.from("staff").insert({
            club_id: clubId,
            name: cleanName,
            email: cleanEmail,
            role: "Treasurer",
            notes: "Invited to manage Club Subs, Payments & Bank Payout Account",
        });

        const senderLabel = inviterName?.trim() || "Your club manager";
        const subject = `Action Needed: Connect ${effectiveClubName}'s Bank Account on ClubFlow`;
        const text = `Hi ${cleanName},

${senderLabel} has set up ${effectiveClubName} on ClubFlow and invited you as Treasurer / Finance Officer to connect the club's payout bank account for player subs and payments.

Once connected, players can pay match subs, monthly subs, and club fees in 1 tap (Link, Apple Pay, Google Pay, or Card), and funds are deposited straight into the club bank account automatically.

Click below to join ${effectiveClubName} and link the club bank account (takes ~90 seconds):
${inviteUrl}

— ${effectiveClubName} via ClubFlow`;

        const html = `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#f8fafc;">
  <div style="max-width:500px;margin:0 auto;padding:28px 16px;">
    <div style="background:#1e293b;border:1px solid #334155;border-radius:16px;overflow:hidden;">
      <div style="height:6px;background:${brandColor};"></div>
      <div style="padding:24px;">
        <div style="display:inline-block;padding:4px 10px;border-radius:999px;background:rgba(16,185,129,0.15);color:#34d399;font-size:11px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;margin-bottom:12px;">
          Treasurer Invite • Club Payments
        </div>
        <h2 style="margin:0 0 8px;font-size:20px;color:#ffffff;">Connect ${effectiveClubName}&apos;s Bank Account</h2>
        <p style="margin:0 0 18px;font-size:13px;color:#cbd5e1;line-height:1.55;">
          Hi ${cleanName}, <strong>${senderLabel}</strong> has set up <strong>${effectiveClubName}</strong> on ClubFlow and invited you to link the club&apos;s payout bank account for player subs &amp; payments.
        </p>
        <div style="background:#0f172a;border:1px solid #334155;border-radius:12px;padding:14px;margin-bottom:20px;font-size:12px;color:#94a3b8;line-height:1.5;">
          ✓ Takes ~90 seconds with the club Sort Code &amp; Account Number<br/>
          ✓ Players pay in 1 tap via Link, Apple Pay, Google Pay, or Card<br/>
          ✓ ClubFlow automatically tracks Paid vs Unanswered &amp; sends due-date reminders
        </div>
        <a href="${inviteUrl}" style="display:block;text-align:center;background:${brandColor};color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:14px 20px;border-radius:12px;">
          Accept Invite &amp; Link Bank Account →
        </a>
      </div>
      <div style="padding:12px 24px;background:#0f172a;border-top:1px solid #334155;text-align:center;font-size:11px;color:#64748b;">
        ${effectiveClubName} • Powered by ClubFlow &amp; Stripe
      </div>
    </div>
  </div>
</body>
</html>`.trim();

        const emailSent = await sendEmail({
            to: cleanEmail,
            subject,
            text,
            html,
        });

        return NextResponse.json({
            success: true,
            inviteUrl,
            emailSent,
            token: inviteToken,
        });
    } catch (err: any) {
        console.error("Failed to invite treasurer:", err);
        return NextResponse.json(
            { error: err.message || "Could not create treasurer invite" },
            { status: 500 }
        );
    }
}
