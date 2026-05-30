const fs = require('fs');
let c = fs.readFileSync('src/App.tsx', 'utf8');
c = c.replace('.erp-wrap{display:flex;min-height:100vh}', '.erp-wrap{display:flex;height:100vh;width:100vw;overflow:hidden}');
c = c.replace('.erp-main{flex:1;min-width:0;display:flex;flex-direction:column;overflow:hidden}', '.erp-main{flex:1;min-width:0;display:flex;flex-direction:column;overflow-y:auto}');
c = c.replace('.erp-content{padding:20px;flex:1;overflow-y:auto;max-width:1440px;width:100%;margin:0 auto}', '.erp-content{padding:20px;flex:1;overflow-y:auto}');
fs.writeFileSync('src/App.tsx', c, 'utf8');
console.log('✅ Done!');