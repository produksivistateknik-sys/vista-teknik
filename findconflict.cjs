const fs = require('fs');
const content = fs.readFileSync('src/App.tsx', 'utf8');
const lines = content.split('\n');

// Cari semua return( di dalam App function
const appStart = lines.findIndex(l => l.includes('export default function App()'));
console.log('App starts at line:', appStart);

const returns = [];
for(let i = appStart; i < lines.length; i++){
  if(lines[i].includes('return(')) returns.push({line: i+1, content: lines[i].trim()});
}
console.log('Semua return( setelah App():');
returns.forEach(r => console.log(r.line, ':', r.content.substring(0,80)));

// Cek apakah masih ada tab bar lama
const tabBar = lines.findIndex(l => l.includes('borderBottom:`2.5px solid'));
console.log('\ntab bar lama di baris:', tabBar > 0 ? tabBar+1 : 'tidak ada');

// Cek struktur render
const erpSidebarLine = lines.findIndex(l => l.includes('className={`erp-sidebar'));
console.log('erp-sidebar render di baris:', erpSidebarLine+1);
console.log('Content:', lines[erpSidebarLine]?.trim().substring(0,80));