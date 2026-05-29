const fs = require('fs');
const content = fs.readFileSync('src/App.tsx', 'utf8');
console.log('SIDEBAR_MENUS:', content.includes('SIDEBAR_MENUS'));
console.log('erp-content div:', content.includes("className='erp-content'"));
console.log('erp-main div:', content.includes("className='erp-main'"));
console.log('monitorTabs lama:', content.includes('monitorTabs.map'));