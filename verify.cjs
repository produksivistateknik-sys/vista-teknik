const fs = require('fs');
const content = fs.readFileSync('src/App.tsx', 'utf8');
console.log('=== VERIFIKASI FINAL ===');
console.log('1. ERP CSS erp-sidebar:', content.includes('erp-sidebar{'));
console.log('2. ERP CSS erp-main:', content.includes('erp-main{'));
console.log('3. erp-wrap render:', content.includes('"erp-wrap"'));
console.log('4. erp-sidebar render:', content.includes('"erp-sidebar"'));
console.log('5. erp-main render:', content.includes('"erp-main"'));
console.log('6. erp-content render:', content.includes('"erp-content"'));
console.log('7. SIDEBAR_MENUS.map:', content.includes('SIDEBAR_MENUS.map'));
console.log('8. sidebarCollapsed:', content.includes('sidebarCollapsed'));
console.log('9. monitorTabs LAMA:', content.includes('monitorTabs='));
console.log('10. tab bar lama:', content.includes('borderBottom:`2.5px solid'));
console.log('11. Tabler Icons index.html:', require('fs').readFileSync('index.html','utf8').includes('tabler'));

const appIdx = content.indexOf('export default function App()');
const sub = content.slice(appIdx);
let returns = [], i = 0;
while((i = sub.indexOf('return(', i)) !== -1){ returns.push(i); i++; }
console.log('12. Jumlah return( di App:', returns.length, '(harusnya 2: isOp + main)');

console.log('\n=== HASIL ===');
const ok = content.includes('erp-sidebar{') && content.includes('"erp-wrap"') && 
           content.includes('SIDEBAR_MENUS.map') && !content.includes('monitorTabs=') &&
           require('fs').readFileSync('index.html','utf8').includes('tabler');
console.log(ok ? '✅ SIAP PUSH!' : '❌ ADA MASALAH!');