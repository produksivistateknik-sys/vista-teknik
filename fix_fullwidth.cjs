const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

// Hapus maxWidth dan padding di erp-body wrapper
content = content.replace(
  `<div style={{padding:"20px",maxWidth:1440,margin:"0 auto"}}>`,
  `<div style={{padding:"0"}}>` 
);

// Pindahkan padding ke erp-body langsung via CSS
// Cari .erp-body CSS dan pastikan sudah ada padding
if(content.includes('.erp-body{flex:1;overflow-y:auto;overflow-x:hidden;padding:14px 16px')){
  console.log('✅ erp-body padding sudah ada');
} else {
  content = content.replace(
    '.erp-body{flex:1;overflow-y:auto;overflow-x:hidden;padding:',
    '.erp-body{flex:1;overflow-y:auto;overflow-x:hidden;padding:'
  );
}

fs.writeFileSync('src/App.tsx', content, 'utf8');

// Verifikasi
const v = fs.readFileSync('src/App.tsx', 'utf8');
console.log('maxWidth removed:', !v.includes('maxWidth:1440'));
console.log('✅ Done!');