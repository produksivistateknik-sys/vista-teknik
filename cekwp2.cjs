const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

// Cari semua yang berhubungan dengan WP di rawData
const idx1 = content.indexOf('setJadwal');
const idx2 = content.indexOf('wp:"WP');
const idx3 = content.indexOf('j.wp');
const idx4 = content.indexOf('selWp');
const idx5 = content.indexOf('pickWp');
const idx6 = content.indexOf('WP_COLOR');

console.log('setJadwal:', idx1);
console.log('wp:"WP:', idx2);
console.log('j.wp:', idx3);
console.log('selWp:', idx4);
console.log('pickWp:', idx5);

if(idx2 !== -1) console.log('\nwp context:\n', content.slice(idx2-200, idx2+300));
if(idx3 !== -1) console.log('\nj.wp context:\n', content.slice(idx3-200, idx3+200));

// Cari raw schedule original (sebelum kita ubah) - cari cara click cell
const idx7 = content.indexOf('onClick.*WP');
const idx8 = content.indexOf('tanggal');
if(idx8 !== -1) console.log('\ntanggal context:\n', content.slice(idx8-100, idx8+400));