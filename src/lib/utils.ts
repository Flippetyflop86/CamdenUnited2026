import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

export function formatPlayerName(player: any): string {
    if (!player) return "";
    const useNickname = player.useNickname ?? player.use_nickname ?? false;
    const nickname = player.nickname ?? player.nickname ?? "";
    if (useNickname && nickname.trim().length > 0) {
        return nickname.trim();
    }
    const first = player.firstName ?? player.first_name ?? "";
    const last = player.lastName ?? player.last_name ?? "";
    return `${first} ${last}`.trim() || "Unknown Player";
}

export const DEPARTURE_REASONS = [
    "Returned to parent club",
    "Transferred to another club",
    "Released",
    "Left club",
    "Retired",
    "Other",
] as const;

export type DepartureReasonOption = (typeof DEPARTURE_REASONS)[number];

export interface ParsedPlayerDeparture {
    isFormer: boolean;
    departureStatus: "Active" | DepartureReasonOption;
    departureReason?: string;
    departureDate?: string;
    departureNotes?: string;
}

export function parsePlayerDeparture(player: any): ParsedPlayerDeparture {
    if (!player) {
        return { isFormer: false, departureStatus: "Active" };
    }

    // 1. Check already-parsed camelCase fields on mapped Player object
    if (player.departureStatus && player.departureStatus !== "Active") {
        return {
            isFormer: true,
            departureStatus: player.departureStatus,
            departureReason: player.departureReason || player.departureStatus,
            departureDate: player.departureDate,
            departureNotes: player.departureNotes,
        };
    }

    // 2. Check direct database columns (if migration is applied)
    const dbStatus = player.club_status;
    if (dbStatus && dbStatus !== "Active") {
        const reason = player.departure_reason || dbStatus;
        return {
            isFormer: true,
            departureStatus: (DEPARTURE_REASONS.includes(reason as any) ? reason : "Left club") as DepartureReasonOption,
            departureReason: reason,
            departureDate: player.departure_date || undefined,
            departureNotes: player.departure_notes || undefined,
        };
    }

    // 3. Check structured tags in notes column
    const rawNotes: string = player.notes || "";
    const statusMatch = rawNotes.match(/\[LEFT_STATUS:([^\]]+)\]/);
    if (statusMatch && statusMatch[1] && statusMatch[1] !== "Active") {
        const rawReason = statusMatch[1].trim();
        const dateMatch = rawNotes.match(/\[LEFT_DATE:([^\]]+)\]/);
        const noteMatch = rawNotes.match(/\[LEFT_NOTE:([^\]]+)\]/);
        return {
            isFormer: true,
            departureStatus: (DEPARTURE_REASONS.includes(rawReason as any) ? rawReason : "Left club") as DepartureReasonOption,
            departureReason: rawReason,
            departureDate: dateMatch?.[1]?.trim() || undefined,
            departureNotes: noteMatch?.[1]?.trim() || undefined,
        };
    }

    return { isFormer: false, departureStatus: "Active" };
}

export function isFormerPlayer(player: any): boolean {
    return parsePlayerDeparture(player).isFormer;
}

export function stripDepartureTags(notes?: string): string {
    if (!notes) return "";
    return notes
        .replace(/\[LEFT_STATUS:[^\]]*\]\s*/g, "")
        .replace(/\[LEFT_DATE:[^\]]*\]\s*/g, "")
        .replace(/\[LEFT_NOTE:[^\]]*\]\s*/g, "")
        .trim();
}

export function serializeDepartureToNotes(
    existingNotes: string | undefined,
    departure: { reason: string; date?: string; notes?: string } | null
): string {
    const cleaned = stripDepartureTags(existingNotes);
    if (!departure || !departure.reason || departure.reason === "Active") {
        return cleaned;
    }
    const safeReason = departure.reason.replace(/[\[\]]/g, "").trim();
    const safeDate = (departure.date || "").replace(/[\[\]]/g, "").trim();
    const safeNote = (departure.notes || "").replace(/[\[\]]/g, "").trim();

    let tags = `[LEFT_STATUS:${safeReason}]`;
    if (safeDate) tags += ` [LEFT_DATE:${safeDate}]`;
    if (safeNote) tags += ` [LEFT_NOTE:${safeNote}]`;

    return `${tags} ${cleaned}`.trim();
}

export function getLoanExpiryStatus(loanEndDate?: string): {
    status: "none" | "active" | "expiring_soon" | "expired";
    daysRemaining: number | null;
    label: string;
} {
    if (!loanEndDate) {
        return { status: "none", daysRemaining: null, label: "" };
    }
    const end = new Date(loanEndDate + "T23:59:59");
    if (isNaN(end.getTime())) {
        return { status: "none", daysRemaining: null, label: loanEndDate };
    }
    const now = new Date();
    const diffMs = end.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    const formattedDate = end.toLocaleDateString("en-GB", { day: "numeric", month: "short" });

    if (diffDays < 0) {
        return {
            status: "expired",
            daysRemaining: diffDays,
            label: `Loan expired (${formattedDate})`,
        };
    }
    if (diffDays <= 14) {
        return {
            status: "expiring_soon",
            daysRemaining: diffDays,
            label: diffDays === 0 ? `Ends today (${formattedDate})` : `Ends in ${diffDays}d (${formattedDate})`,
        };
    }
    return {
        status: "active",
        daysRemaining: diffDays,
        label: `Until ${formattedDate}`,
    };
}


