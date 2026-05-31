const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

// Cari semua backtick di seluruh file
let positions = [];
for(let i=0;i<content.length;i++){
  if(content.charCodeAt(i)===96) positions.push(i);
}
console.log('Total backticks di seluruh file:', positions.length);
positions.slice(0,20).forEach(p=>{
  console.log('at', p, ':', JSON.stringify(content.slice(Math.max(0,p-30),p+30)));
});