const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

// ═══ FIX 1: Wrapper div luar - tambah display flex ═══
// Cari return utama App dan fix wrapper
const patterns = [
  // Pattern dengan \n
  ['<div style={{minHeight:"100vh",background:"#f1f5f9"}}>\n<style>{GCss}</style>',
   '<div style={{minHeight:"100vh",background:"#f1f5f9",display:"flex",flexDirection:"column"}}>\n<style>{GCss}</style>'],
  // Pattern dengan \n dan spasi
  ['<div style={{minHeight:"100vh",background:"#f1f5f9"}}>\n      <style>{GCss}</style>',
   '<div style={{minHeight:"100vh",background:"#f1f5f9",display:"flex",flexDirection:"column"}}>\n      <style>{GCss}</style>'],
  // Pattern dengan display flex sudah ada tapi belum betul
  ['display:"flex",flexDirection:"column"}}>\n<style>',
   'display:"flex",flexDirection:"column"}}>\n<style>'],
];

let fixed = false;
for(const [old, fix] of patterns) {
  if(content.includes(old)) {
    content = content.split(old).join(fix);
    console.log('✅ Fix wrapper:', JSON.stringify(old.slice(0,60)));
    fixed = true;
    break;
  }
}
if(!fixed) console.log('ℹ️ Wrapper pattern tidak cocok, cek manual');

// ═══ FIX 2: erp-wrap harus height:100vh ═══
const oldWrap = '.erp-wrap{display:flex;min-height:100vh}';
const newWrap = '.erp-wrap{display:flex;min-height:100vh;width:100%;overflow:hidden}';
if(content.includes(oldWrap)) {
  content = content.replace(oldWrap, newWrap);
  console.log('✅ Fix erp-wrap CSS');
} else {
  console.log('ℹ️ erp-wrap sudah diupdate sebelumnya');
}

// ═══ FIX 3: erp-content max-width dihapus agar full ═══
const oldContent = '.erp-content{padding:20px;flex:1;overflow-y:auto;max-width:1440px;width:100%;margin:0 auto}';
const newContent = '.erp-content{padding:20px;flex:1;overflow-y:auto;width:100%;box-sizing:border-box}';
if(content.includes(oldContent)) {
  content = content.replace(oldContent, newContent);
  console.log('✅ Fix erp-content CSS');
} else {
  console.log('ℹ️ erp-content sudah diupdate');
}

// ═══ FIX 4: erp-main harus overflow scroll ═══
const oldMain = '.erp-main{flex:1;min-width:0;display:flex;flex-direction:column;overflow:hidden}';
const newMain = '.erp-main{flex:1;min-width:0;display:flex;flex-direction:column;overflow-y:auto;overflow-x:hidden}';
if(content.includes(oldMain)) {
  content = content.replace(oldMain, newMain);
  console.log('✅ Fix erp-main CSS');
} else {
  console.log('ℹ️ erp-main sudah diupdate');
}

fs.writeFileSync('src/App.tsx', content, 'utf8');

// Verifikasi
console.log('\n=== VERIFIKASI ===');
const re = fs.readFileSync('src/App.tsx', 'utf8');
console.log('erp-wrap width:100%:', re.includes('erp-wrap{display:flex;min-height:100vh;width:100%'));
console.log('erp-main overflow-y:', re.includes('overflow-y:auto;overflow-x:hidden'));
console.log('erp-content no max-width:', !re.includes('max-width:1440px;width:100%;margin:0 auto}'));
console.log('✅ SELESAI - jalankan: npm run build && git add . && git commit -m "fix: erp full width layout" && git push');
