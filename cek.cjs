const fs = require('fs');
const c = fs.readFileSync('src/App.tsx', 'utf8');
const idx = c.indexOf('.erp-wrap{');
if(idx!==-1){
  console.log('erp-wrap CSS:', c.slice(idx, idx+60));
} else {
  console.log('erp-wrap tidak ada!');
  const idx2 = c.indexOf('.erp-layout{');
  if(idx2!==-1) console.log('erp-layout CSS:', c.slice(idx2, idx2+60));
  else console.log('TIDAK ADA CSS ERP SAMA SEKALI!');
}
const wrapRender = c.indexOf('"erp-wrap"');
const layoutRender = c.indexOf('"erp-layout"');
console.log('render erp-wrap:', wrapRender !== -1);
console.log('render erp-layout:', layoutRender !== -1);