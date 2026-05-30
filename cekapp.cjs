const fs = require('fs');
const c = fs.readFileSync('src/App.tsx', 'utf8');
const appIdx = c.indexOf('export default function App()');
const sub = c.slice(appIdx);
const retIdx = sub.lastIndexOf('return(');
console.log(sub.slice(retIdx, retIdx+600));