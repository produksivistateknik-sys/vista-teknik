const fs = require('fs');
const content = fs.readFileSync('src/App.tsx', 'utf8');
const lines = content.split('\n');

console.log('Total baris:', lines.length);
console.log('Last 5 lines:');
lines.slice(-5).forEach((l,i) => console.log(lines.length-5+i, ':', l));
