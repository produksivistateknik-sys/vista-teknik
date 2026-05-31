const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

// Cari fungsi createRaw dan updateRaw original
const idx = content.indexOf('createRaw');
if(idx !== -1) console.log('createRaw context:\n', content.slice(idx-100, idx+200));

// Cari cara asli add WP di jadwal
const idx2 = content.indexOf('jadwal');
if(idx2 !== -1) console.log('\njadwal context:\n', content.slice(idx2-50, idx2+300));

// Cari modal WP asli
const idx3 = content.indexOf('showWP');
const idx4 = content.indexOf('wpModal');
const idx5 = content.indexOf('addWp');
console.log('\nshowWP:', idx3, 'wpModal:', idx4, 'addWp:', idx5);
if(idx3 !== -1) console.log(content.slice(idx3-50, idx3+300));
if(idx4 !== -1) console.log(content.slice(idx4-50, idx4+300));
if(idx5 !== -1) console.log(content.slice(idx5-50, idx5+300));