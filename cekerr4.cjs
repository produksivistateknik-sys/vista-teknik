const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');
console.log('Char 61270-61400:');
console.log(JSON.stringify(content.slice(61270, 61450)));