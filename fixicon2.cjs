const fs = require('fs');
let content = fs.readFileSync('index.html', 'utf8');
console.log('Sebelum:', content);

// Hapus semua link tabler CDN
content = content.replace(/<link[^>]*tabler[^>]*>/g, '');

// Tambah link lokal setelah <head>
content = content.replace('<head>', '<head>\n    <link rel="stylesheet" href="/node_modules/@tabler/icons-webfont/dist/tabler-icons.min.css">');

fs.writeFileSync('index.html', content, 'utf8');
console.log('✅ CDN dihapus, pakai lokal!');
console.log('Sesudah:', content);