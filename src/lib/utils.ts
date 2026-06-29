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
