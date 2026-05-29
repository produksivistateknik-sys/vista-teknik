const fs = require('fs');
const lines = fs.readFileSync('src/App.tsx', 'utf8').split('\n');
console.log('Total:', lines.length);
lines.slice(-10).forEach((l,i)=>console.log(lines.length-10+i,':', JSON.stringify(l)));