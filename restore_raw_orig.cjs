const fs = require('fs');
const {execSync} = require('child_process');

// Ambil RawSchedule dari commit sebelum diubah (1a4fe92)
const old = execSync('git show 1a4fe92:src/App.tsx').toString();
const current = fs.readFileSync('src/App.tsx', 'utf8');

// Ekstrak RawSchedule dari commit lama
const startOld = old.indexOf('function RawSchedule(');
const endOld = old.indexOf('\nfunction ManajemenWO(', startOld);
const oldRaw = old.slice(startOld, endOld);

console.log('RawSchedule lama panjang:', oldRaw.length, 'chars');
console.log('Preview:\n', oldRaw.slice(0, 150));

// Replace RawSchedule di current
const startCur = current.indexOf('function RawSchedule(');
const endCur = current.indexOf('\nfunction ManajemenWO(', startCur);

if(startCur === -1 || endCur === -1){
  console.log('❌ Tidak ditemukan! start:', startCur, 'end:', endCur);
  process.exit(1);
}

const newContent = current.slice(0, startCur) + oldRaw + current.slice(endCur);
fs.writeFileSync('src/App.tsx', newContent, 'utf8');

// Verifikasi
const v = fs.readFileSync('src/App.tsx', 'utf8');
console.log('\nVerifikasi:');
console.log('weekStart:', v.includes('const [weekStart,setWeekStart]=useState(TODAY)'));
console.log('cellModal:', v.includes('const [cellModal,setCellModal]=useState(null)'));
console.log('dragInfo:', v.includes('const [dragInfo,setDragInfo]=useState(null)'));
console.log('✅ Restore selesai!');