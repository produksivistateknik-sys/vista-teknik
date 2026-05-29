const fs = require('fs');
const lines = fs.readFileSync('src/App.tsx', 'utf8').split('\n');
const trimmed = lines.filter((l,i) => i < lines.length-5 || l.trim() !== '');
trimmed.push('}');
fs.writeFileSync('src/App.tsx', trimmed.join('\n'), 'utf8');
console.log('Total:', trimmed.length);
console.log('Last 5:');
trimmed.slice(-5).forEach((l,i)=>console.log(trimmed.length-5+i,':', JSON.stringify(l)));