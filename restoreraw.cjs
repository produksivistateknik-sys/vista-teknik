const {execSync} = require('child_process');
const fs = require('fs');

// Ambil App.tsx dari commit lama
const old = execSync('git show 1a4fe92:src/App.tsx').toString();
const current = fs.readFileSync('src/App.tsx', 'utf8');

// Ambil RawSchedule asli dari commit lama
const startOld = old.indexOf('function RawSchedule(');
const endOld = old.indexOf('\nfunction ManajemenWO(', startOld);
const oldRaw = old.slice(startOld, endOld);
console.log('RawSchedule asli panjang:', oldRaw.length, 'chars');
console.log('Preview 200 char pertama:\n', oldRaw.slice(0, 200));

// Replace RawSchedule di current dengan yang asli
const startCur = current.indexOf('function RawSchedule(');
const endCur = current.indexOf('\nfunction ManajemenWO(', startCur);
if(startCur !== -1 && endCur !== -1){
  const newContent = current.slice(0, startCur) + oldRaw + current.slice(endCur);
  fs.writeFileSync('src/App.tsx', newContent, 'utf8');
  console.log('✅ RawSchedule asli berhasil di-restore!');
} else {
  console.log('❌ Tidak ditemukan! start:',startCur,'end:',endCur);
}