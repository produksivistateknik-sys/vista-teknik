const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

// Cek apakah useState dipakai langsung (bukan React.useState) di ActivityLogView
const startAct = content.indexOf('function ActivityLogView(');
const endAct = content.indexOf('\nfunction KendalaInbox(', startAct);
const actFn = content.slice(startAct, endAct);

console.log('useState calls:', (actFn.match(/React\.useState/g)||[]).length);
console.log('useState direct:', (actFn.match(/(?<!React\.)useState/g)||[]).length);
console.log('\nFirst 300 chars:');
console.log(actFn.slice(0, 300));