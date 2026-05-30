const fs = require('fs');
const lines = fs.readFileSync('src/App.tsx', 'utf8').split('\n');

// Lihat konteks baris 4130-4145
console.log('=== Sekitar baris 4137 ===');
for(let i = 4128; i < 4145; i++){
  console.log(i+1, ':', JSON.stringify(lines[i]));
}

// Lihat konteks baris 4270-4280
console.log('\n=== Sekitar baris 3935-3945 ===');
for(let i = 3933; i < 3945; i++){
  console.log(i+1, ':', JSON.stringify(lines[i]));
}