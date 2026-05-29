const fs = require('fs');
const content = fs.readFileSync('src/App.tsx', 'utf8');

const idx = content.indexOf('.hist-cell:hover .hist-tooltip{opacity:1!important;visibility:visible!important}');
console.log('Found at:', idx);
console.log('Next 10 chars:', JSON.stringify(content.substring(idx+83, idx+93)));