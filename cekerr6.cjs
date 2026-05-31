const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');
console.log('Char 61700-61950:');
console.log(JSON.stringify(content.slice(61700, 61950)));