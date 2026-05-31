const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

// Cek karakter satu per satu di area 61150-61270
const area = content.slice(61140, 61280);
for(let i=0;i<area.length;i++){
  const code = area.charCodeAt(i);
  if(code===96) console.log('BACKTICK at offset', 61140+i, ':', JSON.stringify(area.slice(Math.max(0,i-20),i+20)));
  if(code===92) console.log('BACKSLASH at offset', 61140+i, ':', JSON.stringify(area.slice(Math.max(0,i-20),i+20)));
}

// Juga cari semua backtick di seluruh ActivityLogView
const startAct = content.indexOf('function ActivityLogView(');
const endAct = content.indexOf('\nfunction KendalaInbox(', startAct);
const actFn = content.slice(startAct, endAct);
let bt = 0;
for(let i=0;i<actFn.length;i++){
  if(actFn.charCodeAt(i)===96){
    bt++;
    console.log('BACKTICK in ActivityLog at', startAct+i, ':', JSON.stringify(actFn.slice(Math.max(0,i-30),i+30)));
  }
}
console.log('Total backticks in ActivityLogView:', bt);