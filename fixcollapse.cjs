const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

// Fix 1: sb-head center saat collapsed
content = content.replace(
  '.erp-sb-head{height:54px;display:flex;align-items:center;padding:0 14px;border-bottom:1px solid #f0f2f5;gap:9px;overflow:hidden;flex-shrink:0}',
  '.erp-sb-head{height:54px;display:flex;align-items:center;padding:0 14px;border-bottom:1px solid #f0f2f5;gap:9px;overflow:hidden;flex-shrink:0;transition:padding .22s}.erp-sb.col .erp-sb-head{padding:0;justify-content:center}'
);

// Fix 2: nav-item center saat collapsed
content = content.replace(
  '.erp-sb.col .erp-nav-item{padding:8px 0;margin:1px 0;border-radius:0;justify-content:center;width:100%}',
  '.erp-sb.col .erp-nav-item{padding:8px 0;margin:1px 0;border-radius:6px;justify-content:center;width:calc(100% - 8px);margin-left:4px;margin-right:4px}'
);

// Fix 3: nav-grp collapse rapi
content = content.replace(
  '.erp-sb.col .erp-nav-grp{opacity:0}',
  '.erp-sb.col .erp-nav-grp{opacity:0;height:4px;padding:0;min-height:0}'
);

// Fix 4: foot center saat collapsed
content = content.replace(
  '.erp-sb.col .erp-sb-foot{justify-content:center;padding:10px 0}',
  '.erp-sb.col .erp-sb-foot{justify-content:center;padding:10px 0;gap:0}'
);

fs.writeFileSync('src/App.tsx', content, 'utf8');
console.log('✅ Done! Semua icon center saat collapsed.');