const fs = require('fs');
const lines = fs.readFileSync('src/App.tsx', 'utf8').split('\n');
console.log('Total:', lines.length);
for(let i = 4265; i < 4285; i++){
  console.log(i+1, ':', JSON.stringify(lines[i]));
}