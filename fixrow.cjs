const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

const old = '<div style={{minHeight:"100vh",background:"#f1f5f9",display:"flex",flexDirection:"column"}}>';
const fix = '<div style={{minHeight:"100vh",background:"#f1f5f9",display:"block"}}>';

if(content.includes(old)){
  content = content.replace(old, fix);
  fs.writeFileSync('src/App.tsx', content, 'utf8');
  console.log("✅ Fixed!");
} else {
  console.log("❌ Pattern tidak cocok");
  const idx = content.indexOf('minHeight:"100vh",background:"#f1f5f9"');
  console.log(JSON.stringify(content.slice(idx-5, idx+80)));
}