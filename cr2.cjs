const fs = require('fs');
const content = fs.readFileSync('src/App.tsx', 'utf8');
const idx = content.indexOf('return(', content.indexOf('export default function App()'));
console.log('=== RETURN BLOCK ===');
console.log(content.slice(idx, idx+400));