const fs = require('fs');
const content = fs.readFileSync('src/App.tsx', 'utf8');

// Wrapper luar return utama masih ada background div
const old = `  return(
    <div style={{minHeight:"100vh",background:"#f1f5f9"}}>
      <style>{GCss}</style>
      {isOp?(`;

const fix = `  return(
    <div style={{minHeight:"100vh",background:"#f1f5f9",display:"flex",flexDirection:"column"}}>
      <style>{GCss}</style>
      {isOp?(`;

if(content.includes(old)){
  fs.writeFileSync('src/App.tsx', content.replace(old, fix), 'utf8');
  console.log('✅ Fixed!');
} else {
  // Cek apa yang ada
  const idx = content.indexOf('return(\n    <div style={{minHeight');
  console.log('❌ Pattern tidak cocok');
  console.log(JSON.stringify(content.slice(idx, idx+150)));
}