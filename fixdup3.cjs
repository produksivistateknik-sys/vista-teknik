const fs = require('fs');
const lines = fs.readFileSync('src/App.tsx', 'utf8').split('\n');
// Potong di baris 4136 (index 4135), buang semua setelahnya
const clean = lines.slice(0, 4136);
// Pastikan diakhiri dengan }
clean.push('}');
fs.writeFileSync('src/App.tsx', clean.join('\n'), 'utf8');
console.log('Total baris:', clean.length);
console.log('Last 5:');
clean.slice(-5).forEach((l,i)=>console.log(clean.length-5+i,':', JSON.stringify(l)));