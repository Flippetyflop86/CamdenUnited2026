/**
 * Feature flags for staged / private-preview features.
 * Flip SUBS_PAYMENTS_COMING_SOON to `false` when ready to launch Subs & Payments to all users.
 */
export const SUBS_PAYMENTS_COMING_SOON = true;

const DEFAULT_SUBS_PAYMENTS_PREVIEW_EMAILS = [
    "flippetyflopuk@gmail.com",
    "leon_louis@hotmail.co.uk",
];

function getPreviewEmailSet(): Set<string> {
    const extra = [
        process.env.NEXT_PUBLIC_SUBS_PAYMENTS_PREVIEW_EMAILS || "",
        process.env.SUBS_PAYMENTS_PREVIEW_EMAILS || "",
    ]
        .join(",")
        .split(",")
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean);

    return new Set([
        ...DEFAULT_SUBS_PAYMENTS_PREVIEW_EMAILS.map((email) => email.toLowerCase()),
        ...extra,
    ]);
}

export function canAccessSubsPayments(userEmail?: string | null): boolean {
    if (!SUBS_PAYMENTS_COMING_SOON) return true;
    const clean = (userEmail || "").trim().toLowerCase();
    if (!clean) return false;
    return getPreviewEmailSet().has(clean);
}
