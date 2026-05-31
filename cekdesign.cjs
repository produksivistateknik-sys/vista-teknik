const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

// Cari struktur jadwal yang ada komponen
const idx = content.indexOf('komponen');
let count = 0;
let i = idx;
while(i !== -1 && count < 5){
  console.log('\n---', count, '---');
  console.log(content.slice(i-100, i+200));
  i = content.indexOf('komponen', i+1);
  count++;
}

// Cari PANEL_TYPES wps items
const idx2 = content.indexOf('wps:[');
if(idx2 !== -1) console.log('\nwps structure:\n', content.slice(idx2, idx2+400));