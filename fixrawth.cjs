const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

const rawStart = content.indexOf('function RawSchedule(');
const rawEnd = content.indexOf('\nfunction ManajemenWO(', rawStart);
let rawFn = content.slice(rawStart, rawEnd);

// Fix header kolom hari
const fixes = [
  // Background header hari
  [`background:d===TODAY?"#1e40af":selDate===d?"#1d4ed8":"#1e3a8a"`,
   `background:d===TODAY?"#1d4ed8":selDate===d?"#eff6ff":"#f8fafc"`],
  // Border bottom header hari
  [`borderBottom:d===TODAY?"2px solid #60a5fa":selDate===d?"2px solid #93c5fd":"none"`,
   `borderBottom:d===TODAY?"2px solid #2563eb":selDate===d?"2px solid #2563eb":"none"`],
  // Text color header hari - putih jadi gelap untuk non-today
  [`color:"#fff"`, `color:"#64748b"`],
];

let changed = 0;
for(const [old, fix] of fixes){
  if(rawFn.includes(old)){
    rawFn = rawFn.split(old).join(fix);
    changed++;
    console.log('✅', old.slice(0,50));
  } else {
    console.log('⚠️ Not found:', old.slice(0,50));
  }
}

// Fix text TODAY tetap putih karena background biru
rawFn = rawFn.replace(
  `background:d===TODAY?"#1d4ed8":selDate===d?"#eff6ff":"#f8fafc",color:"#64748b"`,
  `background:d===TODAY?"#1d4ed8":selDate===d?"#eff6ff":"#f8fafc"`
);

// Tambah color conditional setelah background fix
rawFn = rawFn.replace(
  `background:d===TODAY?"#1d4ed8":selDate===d?"#eff6ff":"#f8fafc",borderBottom`,
  `background:d===TODAY?"#1d4ed8":selDate===d?"#eff6ff":"#f8fafc",color:d===TODAY?"#fff":selDate===d?"#2563eb":"#64748b",borderBottom`
);

// Fix juga thS style jika ada
const thSIdx = rawFn.indexOf('const thS=');
if(thSIdx !== -1){
  console.log('\nthS found:', rawFn.slice(thSIdx, thSIdx+200));
}

console.log('\nChanged:', changed);
content = content.slice(0, rawStart) + rawFn + content.slice(rawEnd);
fs.writeFileSync('src/App.tsx', content, 'utf8');
console.log('Done!');