const fs = require('fs');
const lines = fs.readFileSync('src/App.tsx', 'utf8').split('\n');
for(let i = 3980; i < 4032; i++){
  console.log(i+1, ':', JSON.stringify(lines[i]));
}