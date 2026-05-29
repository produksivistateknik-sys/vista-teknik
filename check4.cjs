const fs = require('fs');
const lines = fs.readFileSync('src/App.tsx', 'utf8').split('\n');
for(let i = 3930; i < 3980; i++){
  console.log(i+1, ':', lines[i]);
}