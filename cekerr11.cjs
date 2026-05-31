const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');
console.log('Char 63100-63400:');
console.log(JSON.stringify(content.slice(63100, 63400)));