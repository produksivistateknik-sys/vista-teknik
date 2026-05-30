const fs = require('fs');
const lines = fs.readFileSync('src/App.tsx', 'utf8').split('\n');
for(let i = 4030; i < 4060; i++){
  console.log(i+1, ':', JSON.stringify(lines[i]));
}