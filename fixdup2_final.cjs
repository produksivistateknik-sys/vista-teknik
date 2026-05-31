const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

const appIdx = content.indexOf('export default function App()');
const sub = content.slice(appIdx);

// Cari semua posisi SIDEBAR_MENUS
let i = 0, positions = [];
while((i = sub.indexOf('const SIDEBAR_MENUS', i)) !== -1){
  positions.push(i); i++;
}
console.log('SIDEBAR_MENUS count:', positions.length, 'at:', positions);

if(positions.length >= 2){
  const first = positions[0];
  const second = positions[1];
  // Hapus dari first sampai tepat sebelum second
  const cutStart = appIdx + first;
  const cutEnd = appIdx + second;
  console.log('Cutting chars', cutStart, 'to', cutEnd);
  content = content.slice(0, cutStart) + content.slice(cutEnd);
  fs.writeFileSync('src/App.tsx', content, 'utf8');

  // Verifikasi
  const v = fs.readFileSync('src/App.tsx', 'utf8');
  const count = (v.match(/const SIDEBAR_MENUS/g)||[]).length;
  console.log('SIDEBAR_MENUS setelah fix:', count);
  console.log(count===1?'✅ OK!':'❌ Masih duplikat!');
} else {
  console.log('Tidak ada duplikat');
}