const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

// Cari semua state yang ada di RawSchedule sekarang
const startIdx = content.indexOf('function RawSchedule(');
const endIdx = content.indexOf('\nfunction ManajemenWO(', startIdx);
const rawFn = content.slice(startIdx, endIdx);

// Cari semua useState
const states = rawFn.match(/useState\([^)]*\)/g);
console.log('States:', states);

// Cari cara add WP - apakah ada popup/modal
console.log('\nAdd WP logic:');
const addIdx = rawFn.indexOf('handleAddWP');
if(addIdx !== -1) console.log(rawFn.slice(addIdx-50, addIdx+400));

// Cari WP selector
const wpSelIdx = rawFn.indexOf('WP1');
if(wpSelIdx !== -1) console.log('\nWP1 context:', rawFn.slice(wpSelIdx-100, wpSelIdx+200));