const fs = require('fs');
const content = fs.readFileSync('src/App.tsx', 'utf8');
const lines = content.split('\n');
console.log('Total baris:', lines.length);

// Cari semua function components
const components = [];
lines.forEach((l, i) => {
  if(l.match(/^function [A-Z]/) || l.match(/^export default function/)){
    components.push({line: i+1, name: l.trim().substring(0,60)});
  }
});
console.log('\nComponents:');
components.forEach(c => console.log(c.line, ':', c.name));