const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

// Hapus duplikat - ambil hanya PERTAMA dari setiap identifier
const dups = ['  const SIDEBAR_MENUS=[', '  const alerts=', '  const activeLabel=', '  const showTooltip=', '  const hideTooltip='];

for(const dup of dups) {
  const first = content.indexOf(dup);
  if(first === -1) continue;
  const second = content.indexOf(dup, first + 1);
  if(second === -1) continue;
  // Hapus dari second sampai return(
  const retAfter = content.indexOf('\n  return(', second);
  if(retAfter === -1) continue;
  content = content.slice(0, second) + content.slice(retAfter);
  console.log('✅ Hapus duplikat:', dup.trim());
}

fs.writeFileSync('src/App.tsx', content, 'utf8');
console.log('Total chars:', content.length);
console.log('Done!');