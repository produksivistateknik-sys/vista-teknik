const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

// Cari PROSES_COLOR
const idx = content.indexOf('PROSES_COLOR');
if(idx !== -1) console.log('PROSES_COLOR:\n', content.slice(idx, idx+500));

// Cari panelOverall
const idx2 = content.indexOf('function panelOverall');
if(idx2 !== -1) console.log('\npanelOverall:\n', content.slice(idx2, idx2+400));

// Cari struktur proses dalam panel
const idx3 = content.indexOf('p.proses');
if(idx3 !== -1) console.log('\np.proses sample:\n', content.slice(idx3-50, idx3+200));

// Cari PROSES_LIST
const idx4 = content.indexOf('PROSES_LIST');
if(idx4 !== -1) console.log('\nPROSES_LIST:\n', content.slice(idx4, idx4+400));