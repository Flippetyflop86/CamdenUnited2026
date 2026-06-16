const fs = require('fs');
const cheerio = require('cheerio');
const $ = cheerio.load(fs.readFileSync('scratch/fa-fulltime.html'));
$('table tr, tbody tr').each((i, row) => {
    const cells = $(row).find('td');
    if (cells.length >= 3) {
        const cellTexts = cells.map((j, cell) => $(cell).text().trim().replace(/\s+/g, ' ')).get();
        const dateStr = cellTexts.find(t => t.match(/\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/) || t.match(/\d{1,2}(st|nd|rd|th)? [a-zA-Z]{3,9}/));
        if (dateStr) {
            console.log('Valid Date Row:', cellTexts.join(' | '));
        }
    }
});
