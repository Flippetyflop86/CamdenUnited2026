import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const targetUrl = searchParams.get('url');

    if (!targetUrl) {
        return new NextResponse('Missing URL parameter', { status: 400 });
    }

    try {
        // Fetch the target URL
        const response = await fetch(targetUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });

        if (!response.ok) {
            return new NextResponse(`Failed to fetch: ${response.statusText}`, { status: response.status });
        }

        let html = await response.text();

        // Inject <base> tag so relative links (like CSS and Images) resolve correctly
        const urlObj = new URL(targetUrl);
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
