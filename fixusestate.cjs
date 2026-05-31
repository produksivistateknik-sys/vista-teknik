const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

const startAct = content.indexOf('function ActivityLogView(');
const endAct = content.indexOf('\nfunction KendalaInbox(', startAct);
let actFn = content.slice(startAct, endAct);

// Ganti React.useState jadi useState
actFn = actFn.split('React.useState').join('useState');

content = content.slice(0, startAct) + actFn + content.slice(endAct);
fs.writeFileSync('src/App.tsx', content, 'utf8');
console.log('✅ Fixed React.useState -> useState!');