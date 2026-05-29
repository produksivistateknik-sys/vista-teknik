const fs = require('fs');
const lines = fs.readFileSync('src/App.tsx', 'utf8').split('\n');
const before = lines.slice(0, 4024);
const after = lines.slice(4031);
const result = [...before, ...after];
fs.writeFileSync('src/App.tsx', result.join('\n'), 'utf8');
console.log('✅ Duplikat closing tags dihapus!');
