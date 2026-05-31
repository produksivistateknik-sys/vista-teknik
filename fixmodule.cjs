const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

// Fix: ganti "const module=" jadi "const modKey=" di ActivityLogView
const startAct = content.indexOf('function ActivityLogView(');
const endAct = content.indexOf('\nfunction KendalaInbox(', startAct);
let actFn = content.slice(startAct, endAct);

actFn = actFn
  .split('const module=a.module||a.jenis||"general";').join('const modKey=a.module||a.jenis||"general";')
  .split('const mc=MODULE_CONFIG[module]').join('const mc=MODULE_CONFIG[modKey]')
  .split('a.halaman||mc.label').join('a.halaman||mc.label');

content = content.slice(0, startAct) + actFn + content.slice(endAct);
fs.writeFileSync('src/App.tsx', content, 'utf8');
console.log('✅ Fixed reserved keyword "module"!');