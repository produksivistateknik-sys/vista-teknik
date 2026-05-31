const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

// Fix backtick template literal jadi string concatenation
content = content.replace(
  'borderLeft:`3px solid ${s.c}`',
  'borderLeft:"3px solid "+s.c'
);

fs.writeFileSync('src/App.tsx', content, 'utf8');

// Verifikasi tidak ada backtick lagi di ActivityLogView
const startAct = content.indexOf('function ActivityLogView(');
const endAct = content.indexOf('\nfunction KendalaInbox(', startAct);
const actFn = content.slice(startAct, endAct);
let bt = 0;
for(let i=0;i<actFn.length;i++){
  if(actFn.charCodeAt(i)===96) bt++;
}
console.log('Backticks remaining:', bt);
console.log(bt===0?'✅ Fixed!':'❌ Masih ada backtick!');