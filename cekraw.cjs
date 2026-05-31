const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

// Cari boundary RawSchedule
const startIdx = content.indexOf('function RawSchedule(');
const endIdx = content.indexOf('\nfunction RencanaHarian(', startIdx);
console.log('start:', startIdx, 'end:', endIdx);
if(startIdx !== -1 && endIdx !== -1){
  console.log('Boundary OK');
  console.log('Current props:', content.slice(startIdx, startIdx+150));
}