const fs = require('fs');

// Fix 1: Tambah ke index.html
const html = fs.readFileSync('index.html', 'utf8');
if(!html.includes('tabler')){
  const fixed = html.replace(
    '</head>',
    '  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.11.0/dist/tabler-icons.min.css">\n</head>'
  );
  fs.writeFileSync('index.html', fixed, 'utf8');
  console.log('✅ Tabler Icons ditambah ke index.html');
} else {
  console.log('ℹ️ Tabler sudah ada di index.html');
}

// Fix 2: Hapus @import tabler dari GCss
const app = fs.readFileSync('src/App.tsx', 'utf8');
const fixed = app.replace(
  "\n@import url('https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/dist/tabler-icons.min.css');",
  ''
);
fs.writeFileSync('src/App.tsx', fixed, 'utf8');
console.log('✅ @import tabler dihapus dari GCss');
console.log('Verifikasi:', !fixed.includes('tabler-icons.min.css'));