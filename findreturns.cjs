const fs = require('fs');
const lines = fs.readFileSync('src/App.tsx', 'utf8').split('\n');
// Cari semua return( setelah baris 3800
const returns = [];
for(let i = 3800; i < lines.length; i++){
  if(lines[i] && lines[i].includes('return(')) returns.push({line: i+1, content: lines[i].trim()});
}
console.log('Semua return(:');
returns.forEach(r => console.log(r.line, ':', r.content.substring(0,60)));