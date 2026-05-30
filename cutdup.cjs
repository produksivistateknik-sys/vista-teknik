const fs = require('fs');
const content = fs.readFileSync('src/App.tsx', 'utf8');

// Potong di posisi return kedua (237505), simpan hanya sampai situ + tutup }
const cutAt = 237505;
const before = content.slice(0, cutAt);

// Tambah closing } untuk function App
const result = before.trimEnd() + '\n}\n';

fs.writeFileSync('src/App.tsx', result, 'utf8');
console.log('Total chars:', result.length);
console.log('Last 50:', JSON.stringify(result.slice(-50)));
console.log('✅ Done!');