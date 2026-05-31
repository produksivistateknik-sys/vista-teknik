const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');
console.log('Char 61950-62200:');
console.log(JSON.stringify(content.slice(61950, 62200)));