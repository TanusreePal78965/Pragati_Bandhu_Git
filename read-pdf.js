const { PdfReader } = require('pdfreader');
const path = '/Users/suvo/Developer/Pragati_Bandhu/📱 VyapariSathi – Detailed Day-Wise Development Breakdown (30 Days).pdf';

let rows = {};

new PdfReader().parseFileItems(path, (err, item) => {
    if (err) console.error('Error:', err);
    else if (!item) {
        // End of file - print all collected text
        Object.keys(rows).sort((a, b) => parseFloat(a) - parseFloat(b)).forEach(y => {
            console.log((rows[y] || []).join(' '));
        });
    } else if (item.text) {
        (rows[item.y] = rows[item.y] || []).push(item.text);
    } else if (item.page) {
        console.log(`\n--- Page ${item.page} ---\n`);
        rows = {};
    }
});
