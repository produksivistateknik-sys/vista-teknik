const fs = require('fs');
const content = fs.readFileSync('src/App.tsx', 'utf8');
const appIdx = content.indexOf('export default function App()');
const sub = content.slice(appIdx);
// Cari return KEDUA (return utama)
let i = 0, count = 0, pos = -1;
while((i = sub.indexOf('return(', i)) !== -1){
  count++;
  if(count === 2){ pos = i; break; }
  i++;
}
console.log('=== RETURN UTAMA (ke-2) ===');
console.log(content.slice(appIdx+pos, appIdx+pos+300));