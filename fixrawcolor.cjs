const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

const rawStart = content.indexOf('function RawSchedule(');
const rawEnd = content.indexOf('\nfunction ManajemenWO(', rawStart);
let rawFn = content.slice(rawStart, rawEnd);

const fixes = [
  // Header table biru gelap -> light ERP
  [`background:"#1e3a8a"`, `background:"#f8fafc"`],
  // Header text white -> abu
  [`background:"#f0f8ff"`, `background:"#eff6ff"`],
  // Today highlight
  [`background:"#1e3a8a",color:"#93c5fd"`, `background:"#eff6ff",color:"#2563eb"`],
  [`color:"#93c5fd"`, `color:"#2563eb"`],
  // Border today
  [`borderBottom:"2px solid #3b82f6"`, `borderBottom:"2px solid #2563eb"`],
  [`borderBottom:"2px solid #60a5fa"`, `borderBottom:"2px solid #2563eb"`],
];

let changed = 0;
for(const [old, fix] of fixes){
  if(rawFn.includes(old)){
    rawFn = rawFn.split(old).join(fix);
    changed++;
    console.log('✅', old.slice(0,45));
  } else {
    console.log('⚠️ Not found:', old.slice(0,45));
  }
}

// Fix juga color:#fff di dalam th (header table)
// Cari thS atau style header
const thStyleIdx = rawFn.indexOf('background:"#1e3a8a"');
console.log('Header found at:', thStyleIdx);

// Fix header text color dari putih ke gelap
rawFn = rawFn.replace(
  /background:"#f8fafc",([^}]*?)color:"#fff"([^}]*?)fontSize:9/g,
  'background:"#f8fafc",$1color:"#64748b"$2fontSize:9'
);

console.log('\nChanged:', changed);
content = content.slice(0, rawStart) + rawFn + content.slice(rawEnd);
fs.writeFileSync('src/App.tsx', content, 'utf8');
console.log('Done!');