const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

// Ganti SEMUA CSS nav-item dengan versi yang benar
const fixes = [
[`.erp-nav-item{display:flex;align-items:center;gap:9px;padding:6px 10px;margin:1px 6px;border-radius:6px;cursor:pointer;color:#64748b;font-size:12px;font-weight:400;white-space:nowrap;overflow:hidden;transition:all .13s;border:none;background:transparent;width:calc(100% - 12px);text-align:left;font-family:inherit}`,
`.erp-nav-item{display:flex;align-items:center;gap:9px;padding:6px 10px;margin:1px 6px;border-radius:6px;cursor:pointer;color:#64748b;font-size:12px;font-weight:400;white-space:nowrap;overflow:hidden;transition:all .13s;border:none;background:transparent;width:calc(100% - 12px);text-align:left;font-family:inherit;box-sizing:border-box}`],

[`.erp-sb.col .erp-nav-item{padding:8px 0!important;margin:1px 4px!important;width:calc(100% - 8px)!important;justify-content:center!important;display:flex!important}`,
`.erp-sb.col .erp-nav-item{width:44px!important;height:36px!important;padding:0!important;margin:2px auto!important;justify-content:center!important;align-items:center!important;display:flex!important;border-radius:6px!important;gap:0!important}`],

[`.erp-sb.col .erp-sb-head{padding:0!important;justify-content:center!important}`,
`.erp-sb.col .erp-sb-head{padding:0!important;justify-content:center!important;gap:0!important}`],

[`.erp-sb.col .erp-sb-foot{justify-content:center;padding:10px 0;gap:0}`,
`.erp-sb.col .erp-sb-foot{justify-content:center!important;padding:10px 0!important;gap:0!important}`],
];

let changed = 0;
for(const [old, fix] of fixes){
  if(content.includes(old)){ content = content.replace(old, fix); changed++; console.log('✅ Fixed:', old.slice(0,40)+'...'); }
  else { console.log('⚠️ Not found:', old.slice(0,40)+'...'); }
}

// Fix render - hapus style justifyContent inline, ganti dengan class saja
content = content.replace(
  `className={"erp-nav-item"+(tab===item.id?" active":"")} style={{justifyContent:sidebarCollapsed?"center":"flex-start"}}`,
  `className={"erp-nav-item"+(tab===item.id?" active":"")}`
);

// Pastikan erp-nav juga tidak ada padding saat collapsed
content = content.replace(
  `.erp-sb.col .erp-nav-grp{opacity:0!important;height:4px!important;padding:0!important;min-height:0!important}`,
  `.erp-sb.col .erp-nav-grp{opacity:0!important;height:6px!important;padding:0!important;min-height:0!important;overflow:hidden!important}`
);

fs.writeFileSync('src/App.tsx', content, 'utf8');
console.log('\nChanged:', changed, 'patterns');
console.log('✅ Done!');