const fs = require('fs');
const lines = fs.readFileSync('src/App.tsx', 'utf8').split('\n');
const clean = [...lines.slice(0, 4039), ...lines.slice(4045)];
fs.writeFileSync('src/App.tsx', clean.join('\n'), 'utf8');
console.log('✅ Duplikat dihapus! Total:', clean.length);
console.log('Last 5:');
clean.slice(-5).forEach((l,i)=>console.log(clean.length-5+i,':', JSON.stringify(l)));