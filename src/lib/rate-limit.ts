// Shared rate-limiting utility (10 requests per user/club/IP per 24-hour window)

interface RateLimitEntry {
    count: number;
    resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

const WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours
const DEFAULT_MAX_REQUESTS = 10;

export function getClientIdentifier(request: Request, bodyClubOrUserId?: string | null): string {
    const forwarded = request.headers.get('x-forwarded-for');
    const realIp = request.headers.get('x-real-ip');
    const ip = forwarded ? forwarded.split(',')[0].trim() : (realIp || 'unknown-ip');
    if (bodyClubOrUserId && String(bodyClubOrUserId).trim()) {
        return `user:${String(bodyClubOrUserId).trim()}`;
    }
    return `ip:${ip}`;
}

export function checkRateLimit(
    routeKey: string,
    identifier: string,
    maxRequests: number = DEFAULT_MAX_REQUESTS
): { allowed: boolean; remaining: number; resetAt: number; errorMessage?: string } {
    const now = Date.now();
    const key = `${routeKey}:${identifier}`;

    // Periodic cleanup of expired entries
    if (rateLimitStore.size > 2000) {
        for (const [k, v] of rateLimitStore.entries()) {
            if (now > v.resetAt) rateLimitStore.delete(k);
        }
    }

    const existing = rateLimitStore.get(key);
    if (!existing || now > existing.resetAt) {
        const entry: RateLimitEntry = {
            count: 1,
            resetAt: now + WINDOW_MS,
        };
        rateLimitStore.set(key, entry);
        return {
            allowed: true,
            remaining: maxRequests - 1,
            resetAt: entry.resetAt,
        };
    }

    if (existing.count >= maxRequests) {
        const hoursLeft = Math.max(1, Math.ceil((existing.resetAt - now) / (60 * 60 * 1000)));
        return {
            allowed: false,
            remaining: 0,
            resetAt: existing.resetAt,
            errorMessage: `Daily sync limit reached (${maxRequests} per 24 hours). Please try again in ~${hoursLeft}h or use Paste Text.`,
        };
    }

    existing.count += 1;
    rateLimitStore.set(key, existing);

    return {
        allowed: true,
        remaining: maxRequests - existing.count,
        resetAt: existing.resetAt,
    };
}
