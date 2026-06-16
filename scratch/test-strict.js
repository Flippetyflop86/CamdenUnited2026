const fs = require('fs');
const cheerio = require('cheerio');
const $ = cheerio.load(fs.readFileSync('scratch/fa-fulltime.html'));

let matchesFound = 0;
const clubName = "camden united"; // Not used directly if auto-detect kicks in
const autoDetectedClubName = "broadfields united";

$('table tr, tbody tr').each((i, row) => {
    const cells = $(row).find('td');
    if (cells.length >= 3) {
        const cellTexts = cells.map((j, cell) => $(cell).text().trim().replace(/\s+/g, ' ')).get();
        const potentialTeams = cellTexts.filter(t => t.length > 3 && !t.match(/^[0-9:\/ -]+$/) && !['vs', 'v', 'postponed', 'cancelled', 'p-p', 'tbc', 'home', 'away', 'overall'].includes(t.toLowerCase()));
        
        const pureNumberCells = cellTexts.filter(t => t.match(/^\d+$/));
        if (pureNumberCells.length > 3) return; // Skip stats row
        
        if (potentialTeams.length < 2) return; // A match must have at least 2 teams

        const isHome = potentialTeams[0]?.toLowerCase().includes(clubName.toLowerCase()) || potentialTeams[0]?.toLowerCase().includes(autoDetectedClubName.toLowerCase());
        const isAway = potentialTeams.length > 1 && (potentialTeams[1]?.toLowerCase().includes(clubName.toLowerCase()) || potentialTeams[1]?.toLowerCase().includes(autoDetectedClubName.toLowerCase()));
        
        let opponent = "Unknown";
        if (isHome && potentialTeams.length > 1) opponent = potentialTeams[1];
        else if (isAway) opponent = potentialTeams[0];
        else return;

        let dateStr = cellTexts.find(t => t.match(/\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/) || t.match(/\d{1,2}(st|nd|rd|th)? (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{2,4}/i));
        
        if (!dateStr) return; // Skip this row

        matchesFound++;
        console.log("MATCH FOUND:", cellTexts.join(" | "));
    }
});

console.log("Total Matches Found:", matchesFound);
