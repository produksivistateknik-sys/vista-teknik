const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');
console.log('Char 61140-61280:');
console.log(JSON.stringify(content.slice(61140, 61280)));