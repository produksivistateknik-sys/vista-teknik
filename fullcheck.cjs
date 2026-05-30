const fs = require('fs');
const content = fs.readFileSync('src/App.tsx', 'utf8');
const lines = content.split('\n');

console.log('=== STRUKTUR ===');
console.log('Total baris:', lines.length);
console.log('Total chars:', content.length);

console.log('\n=== ERP LAYOUT ===');
console.log('erp-wrap CSS:', content.includes('erp-wrap{'));
console.log('erp-sidebar CSS:', content.includes('erp-sidebar{'));
console.log('erp-main CSS:', content.includes('erp-main{'));
console.log('erp-content CSS:', content.includes('erp-content{'));
console.log('erp-topbar CSS:', content.includes('erp-topbar{'));
console.log('erp-tooltip CSS:', content.includes('erp-tooltip-el{'));
console.log('Tabler Icons link:', require('fs').readFileSync('index.html','utf8').includes('tabler'));

console.log('\n=== SIDEBAR MENUS ===');
console.log('SIDEBAR_MENUS:', content.includes('SIDEBAR_MENUS=['));
console.log('SIDEBAR_MENUS.map:', content.includes('SIDEBAR_MENUS.map'));
console.log('sidebarCollapsed:', content.includes('sidebarCollapsed'));
console.log('showTooltip:', content.includes('showTooltip'));
console.log('hideTooltip:', content.includes('hideTooltip'));
console.log('erp-toggle-btn:', content.includes('erp-toggle-btn'));

console.log('\n=== NAV ITEMS ===');
['dashboard','summary','detail','raw','rencana','wo','pekerja','tracking','activity','kendala','maintenance','masteruser'].forEach(id => {
  console.log('tab '+id+':', content.includes('"'+id+'"&&'));
});

console.log('\n=== LAMA (harus false semua) ===');
console.log('monitorTabs:', content.includes('monitorTabs='));
console.log('tab bar lama:', content.includes('borderBottom:`2.5px solid'));
console.log('top:54 sticky:', content.includes('top:54'));

console.log('\n=== JSX BALANCE ===');
const appIdx = content.indexOf('export default function App()');
const sub = content.slice(appIdx);
let returns = [], i = 0;
while((i = sub.indexOf('return(', i)) !== -1){ returns.push(i); i++; }
console.log('Jumlah return( di App:', returns.length, '(harus 1)');

// Hitung div buka vs tutup di return block
const returnBlock = sub.slice(returns[0]);
const opens = (returnBlock.match(/<div/g)||[]).length;
const closes = (returnBlock.match(/<\/div>/g)||[]).length;
console.log('div buka:', opens, '| div tutup:', closes, '| selisih:', opens-closes, '(harus 0)');

console.log('\n=== LAST 100 CHARS ===');
console.log(JSON.stringify(content.slice(-100)));