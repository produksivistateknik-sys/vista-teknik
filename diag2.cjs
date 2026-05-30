const fs = require('fs');
const content = fs.readFileSync('src/App.tsx', 'utf8');

// Cek apa yang hilang - cari return( pertama setelah hideTooltip
console.log('hideTooltip:', content.includes('hideTooltip'));
console.log('return( ada:', content.includes('return('));
console.log('erp-content:', content.includes('erp-content'));
console.log('SIDEBAR_MENUS render:', content.includes('SIDEBAR_MENUS.map'));
console.log('Last 100:', JSON.stringify(content.slice(-100)));