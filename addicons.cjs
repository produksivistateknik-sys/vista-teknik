const fs = require('fs');
const content = fs.readFileSync('src/App.tsx', 'utf8');

// Fix 1: Tambah Tabler Icons import ke GCss
const oldImport = "@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap');";
const newImport = "@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap');\n@import url('https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/dist/tabler-icons.min.css');";
let fixed = content.replace(oldImport, newImport);

fs.writeFileSync('src/App.tsx', fixed, 'utf8');
console.log('✅ Tabler Icons ditambahkan!');