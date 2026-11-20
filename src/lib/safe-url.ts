/**
 * Validates user-supplied external league/fixture URLs to prevent SSRF
 * against localhost, private networks, or cloud instance metadata endpoints.
 */
export function validateExternalLeagueUrl(
    rawUrl: string
): { ok: true; url: string } | { ok: false; error: string } {
    if (!rawUrl || typeof rawUrl !== "string") {
        return { ok: false, error: "Invalid URL" };
    }

    let parsed: URL;
    try {
        parsed = new URL(rawUrl.trim());
    } catch {
        return { ok: false, error: "Please provide a valid http:// or https:// URL." };
    }

    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
        return { ok: false, error: "Only HTTP and HTTPS league URLs are permitted." };
    }

    if (parsed.username || parsed.password) {
        return { ok: false, error: "Credentials in URLs are not permitted." };
    }

    const host = parsed.hostname.toLowerCase().trim();
    if (
        !host ||
        host === "localhost" ||
        host.endsWith(".localhost") ||
        host.endsWith(".local") ||
        host.endsWith(".internal") ||
        host.includes(":") || // Block IPv6 literals such as [::1] or [fd00::]
        !host.includes(".")
    ) {
        return { ok: false, error: "Internal or local network addresses are not permitted." };
    }

    // Check raw IPv4 literals against private, loopback, link-local, CGNAT, and cloud metadata ranges
    const ipv4Match = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (ipv4Match) {
        const octets = ipv4Match.slice(1).map(Number);
        if (octets.some((o) => o < 0 || o > 255)) {
            return { ok: false, error: "Invalid IPv4 address." };
        }
        const [a, b] = octets;
        const isPrivateOrReserved =
            a === 0 ||
            a === 10 ||
            a === 127 ||
            (a === 169 && b === 254) || // Cloud metadata (169.254.169.254)
            (a === 172 && b >= 16 && b <= 31) ||
            (a === 192 && b === 168) ||
            (a === 100 && b >= 64 && b <= 127) ||
            a >= 224;
        if (isPrivateOrReserved) {
            return { ok: false, error: "Private or reserved IP addresses are not permitted." };
        }
    }

    return { ok: true, url: parsed.toString() };
}
