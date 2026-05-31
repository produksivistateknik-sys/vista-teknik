const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');
console.log('Char 62200-62500:');
console.log(JSON.stringify(content.slice(62200, 62500)));