const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');
console.log('Char 62800-63100:');
console.log(JSON.stringify(content.slice(62800, 63100)));