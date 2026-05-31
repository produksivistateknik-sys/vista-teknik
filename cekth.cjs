const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

const rawStart = content.indexOf('function RawSchedule(');
const rawEnd = content.indexOf('\nfunction ManajemenWO(', rawStart);
const rawFn = content.slice(rawStart, rawEnd);

// Cari style yang dipakai untuk th/header
const idx1 = rawFn.indexOf('thStyle');
const idx2 = rawFn.indexOf('headerStyle');
const idx3 = rawFn.indexOf('colStyle');
const idx4 = rawFn.indexOf('"#1e3a8a"');

console.log('thStyle at:', idx1);
console.log('headerStyle at:', idx2);
console.log('colStyle at:', idx3);
console.log('#1e3a8a at:', idx4);

if(idx1 !== -1) console.log('\nthStyle:\n', rawFn.slice(idx1-10, idx1+300));
if(idx4 !== -1) console.log('\n#1e3a8a context:\n', rawFn.slice(idx4-100, idx4+200));

// Cari semua style object yang ada #1e3a8a
let i = 0;
let count = 0;
while((i = rawFn.indexOf('#1e3a8a', i)) !== -1 && count < 5){
  console.log('\n--- match', count, 'at', i, '---');
  console.log(rawFn.slice(i-80, i+80));
  i++; count++;
}