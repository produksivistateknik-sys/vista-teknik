const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');
console.log('Char 61450-61700:');
console.log(JSON.stringify(content.slice(61450, 61700)));