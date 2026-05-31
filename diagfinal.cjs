const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

const appIdx = content.indexOf('export default function App()');
const sub = content.slice(appIdx);

// Cari semua SIDEBAR_MENUS
let i = 0, positions = [];
while((i = sub.indexOf('const SIDEBAR_MENUS', i)) !== -1){
  positions.push(i); i++;
}
console.log('Jumlah SIDEBAR_MENUS:', positions.length);
positions.forEach((p,idx)=>{
  console.log('\n--- #'+idx+' at pos '+p+' ---');
  console.log(sub.slice(p, p+100));
});

// Cari return(
const retPositions = [];
let j = 0;
while((j = sub.indexOf('\n  return(', j)) !== -1){
  retPositions.push(j); j++;
}
console.log('\nJumlah return(:', retPositions.length);
retPositions.forEach((p,idx)=>console.log('return #'+idx+' at:', p));