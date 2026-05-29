const fs = require('fs');
const content = fs.readFileSync('src/App.tsx', 'utf8');

console.log('=== CEK LAYOUT ===');
console.log('monitorTabs array:', content.includes('const monitorTabs=['));
console.log('tab bar lama:', content.includes('monitorTabs.map'));
console.log('borderBottom 1.5px lama:', content.includes('borderBottom:"1.5px solid #e2e8f0"'));
console.log('PROSES PRODUKSI lama:', content.includes('PROSES PRODUKSI'));
console.log('erp-sidebar render:', content.includes('className={`erp-sidebar'));
console.log('erp-main render:', content.includes("className='erp-main'"));
console.log('erp-content render:', content.includes("className='erp-content'"));
console.log('sidebarCollapsed toggle:', content.includes('setSidebarCollapsed(p=>!p)'));
console.log('display flex minHeight:', content.includes("display:'flex',minHeight:'100vh'"));

console.log('\n=== CEK RETURN STATEMENT ===');
const returnIdx = content.lastIndexOf('return(');
console.log('Last return( at line:', content.substring(0, returnIdx).split('\n').length);
console.log('Context:', JSON.stringify(content.substring(returnIdx, returnIdx+100)));