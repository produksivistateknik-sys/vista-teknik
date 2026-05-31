const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

const rawStart = content.indexOf('function RawSchedule(');
const rawEnd = content.indexOf('\nfunction ManajemenWO(', rawStart);
const rawFn = content.slice(rawStart, rawEnd);

// Cari semua background color yang dipakai
const bgMatches = rawFn.match(/background:["'][^"']+["']/g)||[];
const uniqueBg = [...new Set(bgMatches)];
console.log('Background colors:');
uniqueBg.forEach(b=>console.log(' ', b));

// Cari semua color
const colMatches = rawFn.match(/(?<![a-z])color:["'][^"']+["']/g)||[];
const uniqueCol = [...new Set(colMatches)];
console.log('\nColors:');
uniqueCol.slice(0,20).forEach(c=>console.log(' ', c));

// Cari table header style
const thIdx = rawFn.indexOf('thStyle');
if(thIdx !== -1) console.log('\nthStyle:', rawFn.slice(thIdx, thIdx+200));

const thIdx2 = rawFn.indexOf('"th"');
if(thIdx2 !== -1) console.log('\nth element:', rawFn.slice(thIdx2-50, thIdx2+200));