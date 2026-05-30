const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');
const lines = content.split('\n');

// Cari baris duplikat SIDEBAR_MENUS
let first = -1, second = -1;
for(let i = 0; i < lines.length; i++) {
  if(lines[i].includes('const SIDEBAR_MENUS') || lines[i].includes('const SIDEBAR_MENUS=[')) {
    if(first === -1) first = i;
    else { second = i; break; }
  }
}
console.log('SIDEBAR_MENUS baris:', first+1, 'dan', second+1);

// Cari return( setelah second
let retLine = -1;
for(let i = second; i < lines.length; i++) {
  if(lines[i].trim() === 'return(') { retLine = i; break; }
}
console.log('return( baris:', retLine+1);

// Hapus baris second sampai retLine (tidak termasuk retLine)
if(second !== -1 && retLine !== -1) {
  lines.splice(second, retLine - second);
  console.log('✅ Baris', second+1, 'sampai', retLine, 'dihapus!');
}

const result = lines.join('\n');
fs.writeFileSync('src/App.tsx', result, 'utf8');
console.log('Total baris:', lines.length);