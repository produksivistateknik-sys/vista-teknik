const fs = require('fs');
const content = fs.readFileSync('src/App.tsx', 'utf8');
console.log('erp-wrap render:', content.includes('"erp-wrap"'));
console.log('erp-main render:', content.includes('"erp-main"'));
console.log('erp-content render:', content.includes('"erp-content"'));
console.log('SIDEBAR_MENUS.map:', content.includes('SIDEBAR_MENUS.map'));

// Cari posisi return utama App
const appIdx = content.indexOf('export default function App()');
const sub = content.slice(appIdx);
let returns = [], i = 0;
while((i = sub.indexOf('return(', i)) !== -1){ returns.push(appIdx+i); i++; }
console.log('Jumlah return(:', returns.length);

// Lihat 50 char sebelum erp-wrap
const erpWrapIdx = content.indexOf('"erp-wrap"');
console.log('Sebelum erp-wrap:', JSON.stringify(content.slice(erpWrapIdx-100, erpWrapIdx+20)));