const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

// Hapus deklarasi alerts yang PERTAMA (lama), pertahankan yang baru
const old = `  const alerts=woData.filter(w=>woOverall(w)<100&&(isDelayed(w.target)||isUrgent(w.target))).length;`;

// Hitung berapa kali muncul
const count = content.split(old).length - 1;
console.log('alerts muncul:', count, 'kali');

if(count >= 2) {
  // Hapus hanya yang PERTAMA
  const idx = content.indexOf(old);
  content = content.slice(0, idx) + content.slice(idx + old.length);
  fs.writeFileSync('src/App.tsx', content, 'utf8');
  console.log('✅ Duplikat alerts dihapus!');
} else {
  console.log('ℹ️ Hanya ada 1, cek format berbeda');
  // Cari format lain
  const idx = content.indexOf('const alerts =');
  console.log(JSON.stringify(content.slice(idx, idx+100)));
}