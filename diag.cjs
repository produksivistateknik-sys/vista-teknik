const fs = require('fs');
const content = fs.readFileSync('src/App.tsx', 'utf8');
console.log('monitorTabs:', content.includes('monitorTabs='));
console.log('SIDEBAR_MENUS:', content.includes('SIDEBAR_MENUS'));
console.log('erp-wrap render:', content.includes('"erp-wrap"'));
console.log('Total chars:', content.length);
// Cari return terakhir di App function
const appIdx = content.indexOf('export default function App()');
const sub = content.slice(appIdx);
const returns = [];
let i = 0;
while((i = sub.indexOf('return(', i)) !== -1){ returns.push(appIdx+i); i++; }
console.log('return( positions:', returns);