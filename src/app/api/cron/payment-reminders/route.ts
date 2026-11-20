import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase";
import { sendEmail } from "@/lib/email-service";
import {
    buildPaymentNotificationEmail,
    calculateClubFlowFee,
    parsePaymentDescription,
    updatePaymentDescriptionTags,
} from "@/lib/clubflow-pay";

const MAX_AUTO_REMINDERS = 6;
const OVERDUE_CADENCE_DAYS = 3;

function daysBetweenDateStrings(a: string, b: string): number {
    const tA = new Date(a + "T00:00:00Z").getTime();
    const tB = new Date(b + "T00:00:00Z").getTime();
    return Math.round((tB - tA) / (1000 * 60 * 60 * 24));
}

export async function GET(request: Request) {
    return runAutomatedPaymentReminders(request);
}

export async function POST(request: Request) {
    return runAutomatedPaymentReminders(request);
}

async function runAutomatedPaymentReminders(request: Request) {
    const authHeader = request.headers.get("authorization");
    const isVercelCron = request.headers.get("x-vercel-cron") === "1";
    if (process.env.CRON_SECRET) {
        if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && !isVercelCron) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
    } else if (process.env.NODE_ENV === "production" && !isVercelCron) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = getServerSupabase();
    try {
        const origin =
            process.env.NEXT_PUBLIC_SITE_URL || "https://www.clubflow.org.uk";

        const { data: unpaidPayments, error: fetchErr } = await supabase
            .from("player_payment_requests")
            .select("*")
            .eq("status", "Unpaid")
            .limit(1000);

        if (fetchErr) throw fetchErr;
        if (!unpaidPayments || unpaidPayments.length === 0) {
            return NextResponse.json({ checked: 0, remindersSent: 0 });
        }

        const now = new Date();
        const todayStr = now.toISOString().split("T")[0];
        const nowMs = now.getTime();

        const candidates = unpaidPayments.filter((pay: any) => {
            const meta = parsePaymentDescription(pay.description);
            if (meta.declined) return false;
            if (!meta.dueDate) return false;
            if (meta.reminderCount >= MAX_AUTO_REMINDERS) return false;

            const daysUntilDue = daysBetweenDateStrings(todayStr, meta.dueDate);
            const lastRemindedMs = meta.lastReminderAt
                ? new Date(meta.lastReminderAt).getTime()
                : 0;
            const hoursSinceLastReminder = lastRemindedMs
                ? (nowMs - lastRemindedMs) / (1000 * 60 * 60)
                : Infinity;

            // Never double-send within 20 hours
            if (hoursSinceLastReminder < 20) return false;

            // 1) Due tomorrow or due today
            if (daysUntilDue === 1 || daysUntilDue === 0) {
                return true;
            }

            // 2) Overdue: nudge every 3 days until settled (up to MAX_AUTO_REMINDERS)
            if (daysUntilDue < 0) {
                return hoursSinceLastReminder >= OVERDUE_CADENCE_DAYS * 24 - 4;
            }

            return false;
        });

        if (candidates.length === 0) {
            return NextResponse.json({
                checked: unpaidPayments.length,
                remindersSent: 0,
            });
        }

        const clubIds = Array.from(new Set(candidates.map((p: any) => p.club_id).filter(Boolean)));
        const playerIds = Array.from(new Set(candidates.map((p: any) => p.player_id).filter(Boolean)));

        const [{ data: clubs }, { data: players }] = await Promise.all([
            supabase.from("clubs").select("id, name, primary_color").in("id", clubIds),
            supabase.from("players").select("id, first_name, last_name, email").in("id", playerIds),
        ]);

        const clubMap = new Map((clubs || []).map((c: any) => [c.id, c]));
        const playerMap = new Map((players || []).map((p: any) => [p.id, p]));

        let remindersSent = 0;
        const nowIso = now.toISOString();

        for (const pay of candidates) {
            const player: any = playerMap.get(pay.player_id);
            const email = (player?.email || "").trim();
            if (!email) continue;

            const club: any = clubMap.get(pay.club_id);
            const meta = parsePaymentDescription(pay.description);
            const breakdown = calculateClubFlowFee(Number(pay.amount || 0), meta.feeCoverage);
            const isOverdue = Boolean(meta.dueDate && meta.dueDate < todayStr);

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
                mode: isOverdue ? "overdue" : "reminder",
            });

            const sent = await sendEmail({
                to: email,
                subject: emailContent.subject,
                text: emailContent.text,
                html: emailContent.html,
            });

            if (sent) {
                remindersSent += 1;
                const nextDescription = updatePaymentDescriptionTags(pay.description, {
                    lastReminderAt: nowIso,
                    reminderCount: meta.reminderCount + 1,
                });
                await supabase
                    .from("player_payment_requests")
                    .update({ description: nextDescription })
                    .eq("id", pay.id);
            }
        }

        return NextResponse.json({
            checked: unpaidPayments.length,
            eligibleToday: candidates.length,
            remindersSent,
        });
    } catch (err: any) {
        console.error("Automated payment reminder cron failed:", err);
        return NextResponse.json(
            { error: err.message || "Cron execution failed" },
            { status: 500 }
        );
    }
}
