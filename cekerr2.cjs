const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');
// Cek area error di char 61150-61300
const area = content.slice(61100, 61350);
console.log('Area 61100-61350:');
console.log(area);