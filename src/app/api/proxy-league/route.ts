import { NextResponse } from 'next/server';

const ALLOWED_HOSTNAMES = new Set([
    'fulltime.thefa.com',
    'www.fulltime.thefa.com',
    'football.mitoo.co.uk',
    'www.football.mitoo.co.uk',
    'mitoo.co.uk',
    'www.mitoo.co.uk',
    'pitchero.com',
    'www.pitchero.com'
]);

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const targetUrl = searchParams.get('url');

    if (!targetUrl) {
        return new NextResponse('Missing URL parameter', { status: 400 });
    }

    try {
        const urlObj = new URL(targetUrl);
        const hostname = urlObj.hostname.toLowerCase();
        const isAllowedHost =
            ALLOWED_HOSTNAMES.has(hostname) ||
            hostname.endsWith('.thefa.com') ||
            hostname.endsWith('.mitoo.co.uk') ||
            hostname.endsWith('.pitchero.com');

        if (urlObj.protocol !== 'https:' || !isAllowedHost) {
            return new NextResponse('Forbidden: Only official FA Full-Time, Mitoo, or Pitchero HTTPS URLs are permitted.', { status: 403 });
        }

        // Fetch the target URL
        const response = await fetch(urlObj.toString(), {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });

        if (!response.ok) {
            return new NextResponse(`Failed to fetch: ${response.statusText}`, { status: response.status });
        }

        let html = await response.text();

        // Inject <base> tag so relative links (like CSS and Images) resolve correctly
        const baseUrl = `${urlObj.protocol}//${urlObj.host}`;
        
        // Find the <head> tag and inject the base URL right after it
        html = html.replace(/<head[^>]*>/i, `$&<base href="${baseUrl}/">`);

        // Return the HTML with our own permissive headers
        return new NextResponse(html, {
            headers: {
                'Content-Type': 'text/html; charset=utf-8',
                // Explicitly allow iframing by NOT setting X-Frame-Options or CSP frame-ancestors
                'Access-Control-Allow-Origin': '*',
                'Cache-Control': 's-maxage=60, stale-while-revalidate=300'
            }
        });

    } catch (error: any) {
        console.error('Proxy Error:', error);
        return new NextResponse(`Proxy error: ${error.message}`, { status: 500 });
    }
}
