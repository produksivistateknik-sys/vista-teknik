const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

const startIdx = content.indexOf('function RawSchedule(');
const sub = content.slice(startIdx + 100);

// Cari function berikutnya
const nextFuncs = ['function Rencana', 'function ManajemenWO', 'function MasterPekerja', 'function Tracking', 'function Activity', 'function Maintenance', 'function Kendala'];
for(const f of nextFuncs){
  const idx = content.indexOf('\n'+f, startIdx);
  if(idx !== -1) console.log('Found:', f, 'at:', idx);
}

// Cari semua function declarations setelah RawSchedule
let i = startIdx + 100;
const matches = [];
while(i < content.length){
  const ni = content.indexOf('\nfunction ', i);
  if(ni === -1) break;
  matches.push(content.slice(ni+1, ni+50));
  i = ni + 10;
  if(matches.length > 8) break;
}
console.log('\nFunctions after RawSchedule:');
matches.forEach(m=>console.log(' -', m.split('\n')[0]));