const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');
console.log('Char 62500-62800:');
console.log(JSON.stringify(content.slice(62500, 62800)));