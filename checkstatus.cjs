const fs = require('fs');
const content = fs.readFileSync('src/App.tsx', 'utf8');
console.log('erp-sidebar CSS:', content.includes('erp-sidebar{'));
console.log('erp-main CSS:', content.includes('erp-main{'));
console.log('Tabler Icons:', content.includes('tabler-icons'));
console.log('sidebarCollapsed state:', content.includes('sidebarCollapsed'));
console.log('SIDEBAR_MENUS:', content.includes('SIDEBAR_MENUS'));