import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase";
import { sendEmail, isEmailConfigured } from "@/lib/email-service";
import { canAccessSubsPayments } from "@/lib/feature-flags";
import {
    buildPaymentNotificationEmail,
    calculateClubFlowFee,
    parsePaymentDescription,
    updatePaymentDescriptionTags,
} from "@/lib/clubflow-pay";

export async function POST(request: Request) {
    const supabase = getServerSupabase();
    try {
        const authHeader = request.headers.get("Authorization");
        const token = authHeader?.split(" ")[1];
        if (!token) {
            return NextResponse.json(
                { error: "Unauthorized: Missing authentication token" },
                { status: 401 }
            );
        }

        const {
            data: { user },
            error: authErr,
        } = await supabase.auth.getUser(token);
        if (authErr || !user) {
            return NextResponse.json(
                { error: "Unauthorized: Invalid session token" },
                { status: 401 }
            );
        }

        if (!canAccessSubsPayments(user.email)) {
            return NextResponse.json(
                { error: "Subs & Payments is coming soon and currently in private preview." },
                { status: 403 }
            );
        }

        const { data: member } = await supabase
            .from("club_members")
            .select("club_id, role, page_permissions")
            .eq("user_id", user.id)
            .maybeSingle();

        if (!member?.club_id) {
            return NextResponse.json(
                { error: "Forbidden: Club membership not found" },
                { status: 403 }
            );
        }

        const roleClean = (member.role || "").toLowerCase();
        const perms = Array.isArray(member.page_permissions) ? member.page_permissions : [];
        const canSendPaymentAlerts =
            roleClean === "manager" ||
            roleClean === "super admin" ||
            roleClean === "treasurer" ||
            roleClean === "secretary" ||
            perms.includes("player-payments") ||
            perms.includes("fines") ||
            perms.includes("admin");

        if (!canSendPaymentAlerts) {
            return NextResponse.json(
                { error: "Forbidden: Subs & Payments permission required" },
                { status: 403 }
            );
        }

        const body = await request.json();
        const { paymentIds, mode = "initial" } = body as {
            paymentIds?: string[];
            mode?: "initial" | "reminder";
        };

        if (!Array.isArray(paymentIds) || paymentIds.length === 0) {
            return NextResponse.json({ error: "No paymentIds provided" }, { status: 400 });
        }

        const smtpConfigured = isEmailConfigured();
        if (!smtpConfigured) {
            return NextResponse.json({
                sentCount: 0,
                skippedNoEmailCount: 0,
                totalUnpaid: paymentIds.length,
                smtpConfigured: false,
            });
        }

        const origin =
            request.headers.get("origin") ||
            process.env.NEXT_PUBLIC_SITE_URL ||
            "https://www.clubflow.org.uk";

        const { data: payments, error: payErr } = await supabase
            .from("player_payment_requests")
            .select("*")
            .eq("club_id", member.club_id)
            .in("id", paymentIds);

        if (payErr || !payments || payments.length === 0) {
            return NextResponse.json({ error: "Payment requests not found" }, { status: 404 });
        }

        const unpaidPayments = payments.filter((p: any) => p.status === "Unpaid");
        if (unpaidPayments.length === 0) {
            return NextResponse.json({
                sentCount: 0,
                skippedNoEmailCount: 0,
                totalUnpaid: 0,
            });
        }

        const clubIds = Array.from(new Set(unpaidPayments.map((p: any) => p.club_id).filter(Boolean)));
        const playerIds = Array.from(new Set(unpaidPayments.map((p: any) => p.player_id).filter(Boolean)));

        const [{ data: clubs }, { data: players }] = await Promise.all([
            supabase.from("clubs").select("id, name, primary_color").in("id", clubIds),
            supabase.from("players").select("id, first_name, last_name, email").in("id", playerIds),
        ]);

        const clubMap = new Map((clubs || []).map((c: any) => [c.id, c]));
        const playerMap = new Map((players || []).map((p: any) => [p.id, p]));

        const todayStr = new Date().toISOString().split("T")[0];
        const nowIso = new Date().toISOString();

        let sentCount = 0;
        let skippedNoEmailCount = 0;
        const updatedRows: Array<{ id: string; description: string }> = [];

        for (const pay of unpaidPayments) {
            const meta = parsePaymentDescription(pay.description);
            if (meta.declined) continue;

            const player: any = playerMap.get(pay.player_id);
            const club: any = clubMap.get(pay.club_id);
            const email = (player?.email || "").trim();

            if (!email) {
                skippedNoEmailCount += 1;
                continue;
            }

            const breakdown = calculateClubFlowFee(Number(pay.amount || 0), meta.feeCoverage);
            const isOverdue = Boolean(meta.dueDate && meta.dueDate < todayStr);
            const effectiveMode =
                mode === "initial" ? "initial" : isOverdue ? "overdue" : "reminder";

            const emailContent = buildPaymentNotificationEmail({
                clubName: club?.name || "Your Football Club",
                primaryColor: club?.primary_color,
                playerFirstName: player?.first_name || "Player",
                cleanDescription: meta.cleanDescription,
                basePrice: breakdown.basePrice,
                playerTotalPayable: breakdown.playerTotalPayable,
                feeCoverage: meta.feeCoverage,
                dueDate: meta.dueDate,
                payoutAccountLabel: meta.payoutAccountLabel,
                requirement: meta.requirement,
                payUrl: `${origin}/pay/${pay.id}`,
                mode: effectiveMode,
            });

            const sent = await sendEmail({
                to: email,
                subject: emailContent.subject,
                text: emailContent.text,
                html: emailContent.html,
            });

            if (sent) {
                sentCount += 1;
                const nextCount = mode === "reminder" ? meta.reminderCount + 1 : Math.max(1, meta.reminderCount);
                const nextDescription = updatePaymentDescriptionTags(pay.description, {
                    lastReminderAt: nowIso,
                    reminderCount: nextCount,
                });
                await supabase
                    .from("player_payment_requests")
                    .update({ description: nextDescription })
                    .eq("id", pay.id);
                updatedRows.push({ id: pay.id, description: nextDescription });
            }
        }

        return NextResponse.json({
            sentCount,
            skippedNoEmailCount,
            totalUnpaid: unpaidPayments.length,
            updatedRows,
        });
    } catch (err: any) {
        console.error("Failed to send payment notifications:", err);
        return NextResponse.json(
            { error: err.message || "Failed to send notifications" },
            { status: 500 }
        );
    }
}
