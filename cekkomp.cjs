const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

// Cari calcPanelProgress untuk lihat struktur
const idx = content.indexOf('function calcPanelProgress');
if(idx !== -1) console.log('calcPanelProgress:\n', content.slice(idx, idx+600));

// Cari struktur komponen
const idx2 = content.indexOf('komponen');
if(idx2 !== -1) console.log('\nkomponen sample:\n', content.slice(idx2-50, idx2+300));

// Cari WP_COLOR untuk konfirmasi struktur WP
const idx3 = content.indexOf('p.komponen');
if(idx3 !== -1) console.log('\np.komponen:\n', content.slice(idx3-50, idx3+200));

// Cari struktur panel lengkap
const idx4 = content.indexOf('.items');
if(idx4 !== -1) console.log('\n.items:\n', content.slice(idx4-50, idx4+200));