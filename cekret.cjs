const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

const appIdx = content.indexOf('export default function App()');
const sub = content.slice(appIdx);

// Cari posisi return(
const retPos = sub.indexOf('\n  return(');
console.log('return( at:', retPos);
console.log('Context before return:\n', sub.slice(retPos-200, retPos+50));