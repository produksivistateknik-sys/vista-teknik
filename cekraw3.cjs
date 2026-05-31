const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

// Ambil RawSchedule asli dari commit lama
const {execSync} = require('child_process');
const old = execSync('git show 1a4fe92:src/App.tsx').toString();

// Cek apakah fungsi asli sudah ada
const hasOldFunc = content.includes('const [weekStart,setWeekStart]=useState(TODAY)') ||
                   content.includes('const [cellModal,setCellModal]=useState(null)');

if(!hasOldFunc){
  // Restore dulu
  const startOld = old.indexOf('function RawSchedule(');
  const endOld = old.indexOf('\nfunction ManajemenWO(', startOld);
  const oldRaw = old.slice(startOld, endOld);
  const startCur = content.indexOf('function RawSchedule(');
  const endCur = content.indexOf('\nfunction ManajemenWO(', startCur);
  content = content.slice(0, startCur) + oldRaw + content.slice(endCur);
  console.log('✅ Restored dari git');
} else {
  console.log('ℹ️ Fungsi asli sudah ada');
}

// Sekarang cek CSS yang ada untuk table header
// Ubah warna header tabel dari dark ke light ERP
// Cari style header tabel Raw Schedule di dalam fungsi
const rawStart = content.indexOf('function RawSchedule(');
const rawEnd = content.indexOf('\nfunction ManajemenWO(', rawStart);
let rawFn = content.slice(rawStart, rawEnd);

// Replace dark header dengan light header
const fixes = [
  // Header table dark blue -> light ERP
  [`background:"#1e3a5f"`, `background:"#f8fafc"`],
  [`background:'#1e3a5f'`, `background:'#f8fafc'`],
  [`background:"#243b55"`, `background:"#f8fafc"`],
  [`background:'#243b55'`, `background:'#f8fafc'`],
  // Header text white -> dark
  [`color:"#fff",fontWeight:600,padding:"7px 10px"`, `color:"#64748b",fontWeight:600,padding:"7px 10px"`],
  [`color:'#fff',fontWeight:600,padding:'7px 10px'`, `color:'#64748b',fontWeight:600,padding:'7px 10px'`],
  // Today header
  [`background:"#1d4ed8"`, `background:"#eff6ff"`],
  [`background:'#1d4ed8'`, `background:'#eff6ff'`],
  // Today header text
  [`color:"#fff",borderBottom:"2px solid #60a5fa"`, `color:"#2563eb",borderBottom:"2px solid #2563eb"`],
  [`color:'#fff',borderBottom:'2px solid #60a5fa'`, `color:'#2563eb',borderBottom:'2px solid #2563eb'`],
  // Row background dark
  [`background:"#0f172a"`, `background:"#fff"`],
  [`background:'#0f172a'`, `background:'#fff'`],
  // Table border dark
  [`borderBottom:"1px solid #1e293b"`, `borderBottom:"1px solid #f5f7fa"`],
  [`borderBottom:'1px solid #1e293b'`, `borderBottom:'1px solid #f5f7fa'`],
  // Container background
  [`background:"#0f172a",borderRadius`, `background:"#fff",borderRadius`],
];

let changed = 0;
for(const [old2, fix] of fixes){
  if(rawFn.includes(old2)){
    rawFn = rawFn.split(old2).join(fix);
    changed++;
    console.log('✅ Fixed:', old2.slice(0,40));
  }
}
console.log('Changed:', changed);

content = content.slice(0, rawStart) + rawFn + content.slice(rawEnd);
fs.writeFileSync('src/App.tsx', content, 'utf8');
console.log('Done!');