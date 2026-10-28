export interface PaymentRequestMetadata {
    cleanDescription: string;
    dueDate?: string;
    feeCoverage: "player" | "club";
    payoutAccountLabel?: string;
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

/**
 * Encodes Due Date, Fee Coverage ("player" | "club"), and Payout Account Label
 * alongside the payment request description so it persists cleanly in Supabase.
 */
export function encodePaymentDescription(
    cleanDescription: string,
    opts?: {
        dueDate?: string;
        feeCoverage?: "player" | "club";
        payoutAccountLabel?: string;
    }
): string {
    const tags: string[] = [];
    if (opts?.dueDate) tags.push(`[DUE:${opts.dueDate}]`);
    if (opts?.feeCoverage) tags.push(`[FEE:${opts.feeCoverage}]`);
    if (opts?.payoutAccountLabel) tags.push(`[ACCT:${opts.payoutAccountLabel}]`);
    return `${tags.join("")}${tags.length > 0 ? " " : ""}${cleanDescription.trim()}`;
}

export function parsePaymentDescription(rawDescription?: string | null): PaymentRequestMetadata {
    const raw = (rawDescription || "").trim();
    const dueMatch = raw.match(/\[DUE:([^\]]+)\]/i);
    const feeMatch = raw.match(/\[FEE:(player|club)\]/i);
    const acctMatch = raw.match(/\[ACCT:([^\]]+)\]/i);

    const cleanDescription = raw
        .replace(/\[DUE:[^\]]+\]/gi, "")
        .replace(/\[FEE:[^\]]+\]/gi, "")
        .replace(/\[ACCT:[^\]]+\]/gi, "")
        .trim();

    return {
        cleanDescription: cleanDescription || "Club Fine / Payment Request",
        dueDate: dueMatch ? dueMatch[1].trim() : undefined,
        feeCoverage: feeMatch && feeMatch[1].toLowerCase() === "club" ? "club" : "player",
        payoutAccountLabel: acctMatch ? acctMatch[1].trim() : undefined,
    };
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
