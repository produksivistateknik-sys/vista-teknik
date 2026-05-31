const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

const appIdx = content.indexOf('export default function App()');
const sub = content.slice(appIdx);

// Cari semua posisi SIDEBAR_MENUS
let i = 0, positions = [];
while((i = sub.indexOf('const SIDEBAR_MENUS', i)) !== -1){
  positions.push(i); i++;
}
console.log('SIDEBAR_MENUS positions:', positions);

if(positions.length >= 2){
  // Hapus yang PERTAMA, pertahankan yang KEDUA (hasil patch terbaru)
  const first = positions[0];
  const second = positions[1];
  // Cari return( sebelum second sebagai batas akhir first block
  const retPos = sub.indexOf('\n  return(', first);
  const cutStart = appIdx + first;
  const cutEnd = appIdx + retPos;
  console.log('Cutting from', cutStart, 'to', cutEnd);
  content = content.slice(0, cutStart) + content.slice(cutEnd);
  fs.writeFileSync('src/App.tsx', content, 'utf8');
  console.log('✅ Duplikat dihapus!');
} else {
  console.log('Tidak ada duplikat atau tidak ditemukan');
}