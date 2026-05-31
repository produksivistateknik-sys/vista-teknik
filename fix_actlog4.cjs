const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');
const newFn = fs.readFileSync('actlog_v4.txt', 'utf8');
const startIdx = content.indexOf('function ActivityLogView(');
const endIdx = content.indexOf('\nfunction KendalaInbox(', startIdx);
if(startIdx===-1||endIdx===-1){console.log('NOT FOUND');process.exit(1);}
content = content.slice(0, startIdx) + newFn + '\n' + content.slice(endIdx);
let bt=0;
for(let i=startIdx;i<startIdx+newFn.length;i++){if(content.charCodeAt(i)===96)bt++;}
console.log('Backticks:', bt);
fs.writeFileSync('src/App.tsx', content, 'utf8');
console.log('Done!');