const fs = require('fs');
const content = fs.readFileSync('src/App.tsx', 'utf8');
const appIdx = content.indexOf('export default function App()');
const sub = content.slice(appIdx);
let returns = [], i = 0;
while((i = sub.indexOf('return(', i)) !== -1){ returns.push(i); i++; }
returns.forEach((pos, idx) => {
  console.log('\n=== return #'+(idx+1)+' di posisi', pos, '===');
  console.log(JSON.stringify(sub.slice(pos, pos+120)));
});