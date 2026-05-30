const fs = require('fs');
const content = fs.readFileSync('src/App.tsx', 'utf8');

// Ambil CSS erp-wrap dan erp-main dari file
const cssStart = content.indexOf('.erp-wrap{');
const cssEnd = content.indexOf('.erp-tooltip-el{') + 200;
console.log('=== ERP CSS ===');
console.log(content.slice(cssStart, cssEnd));

// Cek render erp-wrap
const wrapIdx = content.indexOf('"erp-wrap"');
console.log('\n=== RENDER erp-wrap (context) ===');
console.log(content.slice(wrapIdx-50, wrapIdx+200));