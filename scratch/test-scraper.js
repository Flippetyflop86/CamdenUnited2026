const cheerio = require('cheerio');
const fs = require('fs');

async function run() {
    const html = fs.readFileSync('scratch/fa-fulltime.html', 'utf-8');
    const $ = cheerio.load(html);
    
    const rows = $('table tr, tbody tr');
    const teamCounts = {};
    
    rows.each((i, row) => {
        const rowText = $(row).text().replace(/\s+/g, ' ').trim();
        const cells = $(row).find('td');
        if (cells.length >= 3) {
            const cellTexts = cells.map((i, cell) => $(cell).text().trim().replace(/\s+/g, ' ')).get();
            const potentialTeams = cellTexts.filter(t => t.length > 3 && !t.match(/^[0-9:\/ -]+$/) && !['vs', 'v', 'postponed', 'cancelled', 'p-p', 'tbc'].includes(t.toLowerCase()));
            
            potentialTeams.forEach(t => {
                teamCounts[t] = (teamCounts[t] || 0) + 1;
            });
        }
    });
    
    console.log("Team frequencies:", teamCounts);
    
    // The most frequent team is the host team!
    let maxTeam = '';
    let maxCount = 0;
    for (const [team, count] of Object.entries(teamCounts)) {
        if (count > maxCount) {
            maxCount = count;
            maxTeam = team;
        }
    }
    
    console.log("Auto-detected host team:", maxTeam);
}

run();
