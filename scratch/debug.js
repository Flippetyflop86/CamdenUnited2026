const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf-8');
const SUPABASE_URL = env.split('\n').find(l => l.startsWith('NEXT_PUBLIC_SUPABASE_URL=')).split('=')[1].trim();
const SUPABASE_KEY = env.split('\n').find(l => l.startsWith('NEXT_PUBLIC_SUPABASE_ANON_KEY=')).split('=')[1].trim();

async function run() {
    const res = await fetch(SUPABASE_URL + '/rest/v1/clubs?select=name,league_url', {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY }
    });
    const data = await res.json();
    console.log('DB Data:', data);
    
    if (data && data.length > 0 && data[0].league_url) {
        console.log('Fetching:', data[0].league_url);
        const htmlRes = await fetch(data[0].league_url, {
             headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' }
        });
        const html = await htmlRes.text();
        console.log('HTML Length:', html.length);
        
        // Let's try to extract tables
        const cheerio = require('cheerio');
        const $ = cheerio.load(html);
        const rows = $('table tr, tbody tr');
        console.log('Found table rows:', rows.length);
        
        const clubName = data[0].name.toLowerCase();
        let foundClub = false;
        rows.each((i, row) => {
            const rowText = $(row).text().replace(/\s+/g, ' ').trim().toLowerCase();
            if (rowText.includes(clubName)) {
                foundClub = true;
                console.log('MATCH:', rowText);
            } else if (rowText.includes('camden') || rowText.includes('united')) {
                console.log('PARTIAL MATCH:', rowText);
            }
        });
        if (!foundClub) {
            console.log('Could not find exact clubName:', clubName);
            console.log('Maybe try looking for divs?');
            const divs = $('div').filter((i, el) => $(el).text().toLowerCase().includes(clubName));
            console.log('Divs found with exact name:', divs.length);
            const partialDivs = $('div').filter((i, el) => $(el).text().toLowerCase().includes('camden'));
            console.log('Divs found with Camden:', partialDivs.length);
        }
    }
}
run();
