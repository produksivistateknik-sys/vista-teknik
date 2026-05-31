const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');
console.log('Char 63400-63700:');
console.log(JSON.stringify(content.slice(63400, 63700)));