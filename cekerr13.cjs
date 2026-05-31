const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');
console.log('Char 63700-64000:');
console.log(JSON.stringify(content.slice(63700, 64000)));