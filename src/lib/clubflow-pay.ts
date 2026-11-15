export interface PaymentRequestMetadata {
    cleanDescription: string;
    dueDate?: string;
    feeCoverage: "player" | "club";
    payoutAccountLabel?: string;
    requirement: "required" | "optional";
    batchId?: string;
    lastReminderAt?: string;
    reminderCount: number;
    declined: boolean;
}

export interface ClubFlowFeeBreakdown {
    basePrice: number;
    transactionFee: number;
    feeCoverage: "player" | "club";
    playerTotalPayable: number;
    clubNetReceived: number;
    basePricePence: number;
    transactionFeePence: number;
    playerTotalPayablePence: number;
    applicationFeePence: number;
}

export interface EncodePaymentOptions {
    dueDate?: string;
    feeCoverage?: "player" | "club";
    payoutAccountLabel?: string;
    requirement?: "required" | "optional";
    batchId?: string;
    lastReminderAt?: string;
    reminderCount?: number;
    declined?: boolean;
}

/**
 * Encodes Due Date, Fee Coverage ("player" | "club"), Payout Account Label,
 * Requirement ("required" | "optional"), Batch ID, and Reminder tracking tags
 * alongside the payment request description so it persists cleanly in Supabase.
 */
export function encodePaymentDescription(
    cleanDescription: string,
    opts?: EncodePaymentOptions
): string {
    const tags: string[] = [];
    if (opts?.dueDate) tags.push(`[DUE:${opts.dueDate}]`);
    if (opts?.feeCoverage) tags.push(`[FEE:${opts.feeCoverage}]`);
    if (opts?.payoutAccountLabel) {
        const safeAcct = opts.payoutAccountLabel.replace(/[\[\]]/g, "").trim();
        if (safeAcct) tags.push(`[ACCT:${safeAcct}]`);
    }
    if (opts?.requirement) tags.push(`[REQ:${opts.requirement}]`);
    if (opts?.batchId) tags.push(`[BATCH:${opts.batchId}]`);
    if (opts?.lastReminderAt) tags.push(`[REMIND:${opts.lastReminderAt}]`);
    if (typeof opts?.reminderCount === "number" && opts.reminderCount > 0) {
        tags.push(`[RCNT:${Math.floor(opts.reminderCount)}]`);
    }
    if (opts?.declined) tags.push(`[DECLINED:1]`);
    return `${tags.join("")}${tags.length > 0 ? " " : ""}${cleanDescription.trim()}`;
}

export function parsePaymentDescription(rawDescription?: string | null): PaymentRequestMetadata {
    const raw = (rawDescription || "").trim();
    const dueMatch = raw.match(/\[DUE:([^\]]+)\]/i);
    const feeMatch = raw.match(/\[FEE:(player|club)\]/i);
    const acctMatch = raw.match(/\[ACCT:([^\]]+)\]/i);
    const reqMatch = raw.match(/\[REQ:(required|optional)\]/i);
    const batchMatch = raw.match(/\[BATCH:([^\]]+)\]/i);
    const remindMatch = raw.match(/\[REMIND:([^\]]+)\]/i);
    const rcntMatch = raw.match(/\[RCNT:(\d+)\]/i);
    const declinedMatch = raw.match(/\[DECLINED:1\]/i);

    const cleanDescription = raw
        .replace(/\[DUE:[^\]]+\]/gi, "")
        .replace(/\[FEE:[^\]]+\]/gi, "")
        .replace(/\[ACCT:[^\]]+\]/gi, "")
        .replace(/\[REQ:[^\]]+\]/gi, "")
        .replace(/\[BATCH:[^\]]+\]/gi, "")
        .replace(/\[REMIND:[^\]]+\]/gi, "")
        .replace(/\[RCNT:[^\]]+\]/gi, "")
        .replace(/\[DECLINED:[^\]]+\]/gi, "")
        .trim();

    return {
        cleanDescription: cleanDescription || "Club Payment Request",
        dueDate: dueMatch ? dueMatch[1].trim() : undefined,
        feeCoverage: feeMatch && feeMatch[1].toLowerCase() === "club" ? "club" : "player",
        payoutAccountLabel: acctMatch ? acctMatch[1].trim() : undefined,
        requirement: reqMatch && reqMatch[1].toLowerCase() === "optional" ? "optional" : "required",
        batchId: batchMatch ? batchMatch[1].trim() : undefined,
        lastReminderAt: remindMatch ? remindMatch[1].trim() : undefined,
        reminderCount: rcntMatch ? parseInt(rcntMatch[1], 10) || 0 : 0,
        declined: Boolean(declinedMatch),
    };
}

/**
 * Updates specific metadata tags on an existing payment description string without losing any fields.
 */
export function updatePaymentDescriptionTags(
    rawDescription: string | null | undefined,
    patch: Partial<EncodePaymentOptions>
): string {
    const existing = parsePaymentDescription(rawDescription);
    return encodePaymentDescription(existing.cleanDescription, {
        dueDate: patch.dueDate !== undefined ? patch.dueDate : existing.dueDate,
        feeCoverage: patch.feeCoverage !== undefined ? patch.feeCoverage : existing.feeCoverage,
        payoutAccountLabel:
            patch.payoutAccountLabel !== undefined
                ? patch.payoutAccountLabel
                : existing.payoutAccountLabel,
        requirement: patch.requirement !== undefined ? patch.requirement : existing.requirement,
        batchId: patch.batchId !== undefined ? patch.batchId : existing.batchId,
        lastReminderAt:
            patch.lastReminderAt !== undefined ? patch.lastReminderAt : existing.lastReminderAt,
        reminderCount:
            patch.reminderCount !== undefined ? patch.reminderCount : existing.reminderCount,
        declined: patch.declined !== undefined ? patch.declined : existing.declined,
    });
}

/**
 * Calculates the ClubFlow Pay transaction fee (3.9% + £0.25, minimum £0.35).
 * - When feeCoverage === "player" (default):
 *   The player pays Base Price + Transaction Fee; Club receives 100% of Base Price; ClubFlow receives Transaction Fee.
 * - When feeCoverage === "club":
 *   The player pays Base Price; Club receives Base Price - Transaction Fee; ClubFlow receives Transaction Fee.
 */
export function calculateClubFlowFee(
    basePricePounds: number,
    feeCoverage: "player" | "club" = "player"
): ClubFlowFeeBreakdown {
    const basePrice = Math.max(0, Number(basePricePounds) || 0);
    const rawFee = basePrice * 0.039 + 0.25;
    const transactionFee = Math.round(Math.max(0.35, rawFee) * 100) / 100;

    const playerTotalPayable =
        feeCoverage === "player"
            ? Math.round((basePrice + transactionFee) * 100) / 100
            : Math.round(basePrice * 100) / 100;

    const clubNetReceived =
        feeCoverage === "player"
            ? Math.round(basePrice * 100) / 100
            : Math.round(Math.max(0, basePrice - transactionFee) * 100) / 100;

    return {
        basePrice,
        transactionFee,
        feeCoverage,
        playerTotalPayable,
        clubNetReceived,
        basePricePence: Math.round(basePrice * 100),
        transactionFeePence: Math.round(transactionFee * 100),
        playerTotalPayablePence: Math.round(playerTotalPayable * 100),
        applicationFeePence: Math.round(transactionFee * 100),
    };
}

export function buildPaymentNotificationEmail(params: {
    clubName: string;
    primaryColor?: string | null;
    playerFirstName: string;
    cleanDescription: string;
    basePrice: number;
    playerTotalPayable: number;
    feeCoverage: "player" | "club";
    dueDate?: string;
    payoutAccountLabel?: string;
    requirement: "required" | "optional";
    payUrl: string;
    mode: "initial" | "reminder" | "overdue";
}): { subject: string; text: string; html: string } {
    const brandColor = params.primaryColor || "#dc2626";
    const reqLabel = params.requirement === "optional" ? "Optional" : "Required";
    const dueFormatted = params.dueDate
        ? new Date(params.dueDate + "T12:00:00Z").toLocaleDateString("en-GB", {
              weekday: "short",
              day: "numeric",
              month: "short",
              year: "numeric",
          })
        : null;

    const prefix =
        params.mode === "overdue"
            ? "Overdue Payment"
            : params.mode === "reminder"
            ? "Reminder • Unanswered Payment"
            : "Unanswered Payment";

    const subject = `${prefix}: £${params.basePrice.toFixed(2)} — ${params.cleanDescription} (${params.clubName})`;

    const introLine =
        params.mode === "overdue"
            ? `Your ${reqLabel.toLowerCase()} payment for ${params.clubName} is now past its due date and remains unanswered.`
            : params.mode === "reminder"
            ? `Friendly reminder: you have an unanswered ${reqLabel.toLowerCase()} payment with ${params.clubName}.`
            : `${params.clubName} has sent you a ${reqLabel.toLowerCase()} payment request.`;

    const optionalNoteText =
        params.requirement === "optional"
            ? `\nThis payment is marked Optional — if you are not taking part, open the link above and tap "Decline Optional Payment" to stop reminders.\n`
            : "";

    const text = `Hi ${params.playerFirstName || "there"},

${introLine}

Payment For: ${params.cleanDescription} (${reqLabel})
Amount: £${params.basePrice.toFixed(2)}${
        params.feeCoverage === "player"
            ? ` (£${params.playerTotalPayable.toFixed(2)} total inc. processing fee)`
            : ""
    }${dueFormatted ? `\nDue Date: ${dueFormatted}` : ""}
Account: ${params.payoutAccountLabel || `${params.clubName} Account`}

Pay in seconds via One-Tap Link, Apple Pay, Google Pay, or Card:
${params.payUrl}
${optionalNoteText}
— ${params.clubName} via ClubFlow`;

    const html = `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#f8fafc;">
  <div style="max-width:500px;margin:0 auto;padding:28px 16px;">
    <div style="background:#1e293b;border:1px solid #334155;border-radius:16px;overflow:hidden;">
      <div style="height:6px;background:${brandColor};"></div>
      <div style="padding:24px;">
        <div style="display:inline-block;padding:4px 10px;border-radius:999px;background:rgba(245,158,11,0.15);color:#fbbf24;font-size:11px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;margin-bottom:12px;">
          ${prefix} • ${reqLabel}
        </div>
        <h2 style="margin:0 0 6px;font-size:20px;color:#ffffff;">${params.cleanDescription}</h2>
        <p style="margin:0 0 20px;font-size:13px;color:#94a3b8;line-height:1.5;">
          Hi ${params.playerFirstName || "there"}, ${introLine}
        </p>

        <div style="background:#0f172a;border:1px solid #334155;border-radius:12px;padding:16px;margin-bottom:20px;">
          <table style="width:100%;border-collapse:collapse;font-size:13px;">
            <tr>
              <td style="padding:5px 0;color:#94a3b8;">Amount</td>
              <td style="padding:5px 0;text-align:right;font-weight:800;color:#ffffff;font-size:16px;">£${params.basePrice.toFixed(2)}</td>
            </tr>
            ${
                dueFormatted
                    ? `<tr>
              <td style="padding:5px 0;color:#94a3b8;">Due Date</td>
              <td style="padding:5px 0;text-align:right;font-weight:700;color:#fbbf24;">${dueFormatted}</td>
            </tr>`
                    : ""
            }
            <tr>
              <td style="padding:5px 0;color:#94a3b8;">Type</td>
              <td style="padding:5px 0;text-align:right;font-weight:600;color:#e2e8f0;">${reqLabel}</td>
            </tr>
            <tr>
              <td style="padding:5px 0;color:#94a3b8;">Account</td>
              <td style="padding:5px 0;text-align:right;font-weight:600;color:#cbd5e1;">${
                  params.payoutAccountLabel || `${params.clubName} Account`
              }</td>
            </tr>
          </table>
        </div>

        <a href="${params.payUrl}" style="display:block;text-align:center;background:${brandColor};color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:14px 20px;border-radius:12px;">
          Pay £${params.playerTotalPayable.toFixed(2)} Now (Link / Apple Pay / Card) →
        </a>

        ${
            params.requirement === "optional"
                ? `<p style="margin:14px 0 0;text-align:center;font-size:12px;color:#94a3b8;">
                     Optional payment — not taking part? <a href="${params.payUrl}" style="color:#cbd5e1;text-decoration:underline;">Open &amp; tap Decline</a> to stop reminders.
                   </p>`
                : ""
        }
      </div>
      <div style="padding:12px 24px;background:#0f172a;border-top:1px solid #334155;text-align:center;font-size:11px;color:#64748b;">
        ${params.clubName} • Powered by ClubFlow &amp; Stripe
      </div>
    </div>
  </div>
</body>
</html>`.trim();

    return { subject, text, html };
}
