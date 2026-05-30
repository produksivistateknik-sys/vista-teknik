const fs = require('fs');
let content = fs.readFileSync('index.html', 'utf8');

const old = 'https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.11.0/dist/tabler-icons.min.css';
const newUrl = 'https://unpkg.com/@tabler/icons-webfont@3.11.0/dist/tabler-icons.min.css';

if(content.includes(old)){
  content = content.replace(old, newUrl);
  fs.writeFileSync('index.html', content, 'utf8');
  console.log('✅ CDN diganti ke unpkg!');
} else {
  console.log('❌ URL lama tidak ditemukan');
  console.log(content.slice(content.indexOf('tabler')-20, content.indexOf('tabler')+80));
}