const fs = require('fs');
const lines = fs.readFileSync('src/App.tsx', 'utf8').split('\n');
const before = lines.slice(0, 4006);
const after = lines.slice(4013);
const result = [...before, ...after];
fs.writeFileSync('src/App.tsx', result.join('\n'), 'utf8');
console.log('Total baris:', result.length);
console.log('✅ Fix selesai!');
