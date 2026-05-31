const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');
// Cek area error
const lines = content.split('\n');
console.log('Lines around 61266:');
for(let i=61240;i<61280;i++){
  if(lines[i]) console.log(i+1+':', lines[i].slice(0,120));
}