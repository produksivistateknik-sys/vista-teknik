const fs = require('fs');
const lines = fs.readFileSync('src/App.tsx', 'utf8').split('\n');
for(let i = 4088; i < 4108; i++){
  console.log(i+1, ':', JSON.stringify(lines[i]));
}