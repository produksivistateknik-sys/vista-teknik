const fs = require('fs');
const content = fs.readFileSync('src/App.tsx', 'utf8');
const idx = content.indexOf('tabler');
console.log('Tabler at:', idx);
console.log('Context:', JSON.stringify(content.substring(idx-20, idx+100)));