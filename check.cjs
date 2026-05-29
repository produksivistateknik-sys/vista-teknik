const fs = require('fs');
const content = fs.readFileSync('src/App.tsx', 'utf8');
const lines = content.split('\n');

console.log('Total baris:', lines.length);
console.log('Baris 3868:', lines[3868]);
console.log('Baris 3960:', lines[3960]);
console.log('Baris 3961:', lines[3961]);
console.log('Baris 4065:', lines[4065]);
console.log('Baris 4066:', lines[4066]);
console.log('Baris 4067:', lines[4067]);
