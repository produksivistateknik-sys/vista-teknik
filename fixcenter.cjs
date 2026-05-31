const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

// Fix CSS collapsed - lebih kuat dengan !important
const fixes = [
  ['.erp-sb.col .erp-sb-head{padding:0;justify-content:center}', '.erp-sb.col .erp-sb-head{padding:0!important;justify-content:center!important}'],
  ['.erp-sb.col .erp-nav-item{padding:8px 0;margin:1px 0;border-radius:6px;justify-content:center;width:calc(100% - 8px);margin-left:4px;margin-right:4px}', '.erp-sb.col .erp-nav-item{padding:8px 0!important;margin:1px 4px!important;width:calc(100% - 8px)!important;justify-content:center!important;display:flex!important}'],
  ['.erp-sb.col .erp-nav-grp{opacity:0;height:4px;padding:0;min-height:0}', '.erp-sb.col .erp-nav-grp{opacity:0!important;height:4px!important;padding:0!important;min-height:0!important}'],
];

let changed = 0;
for(const [old, fix] of fixes){
  if(content.includes(old)){ content = content.replace(old, fix); changed++; }
}
console.log('Changed:', changed, 'patterns');

// Juga fix di render - pastikan icon tidak punya margin
content = content.replace(
  'className={"erp-nav-item"+(tab===item.id?" active":"")}',
  'className={"erp-nav-item"+(tab===item.id?" active":"")} style={{justifyContent:sidebarCollapsed?"center":"flex-start"}}'
);

fs.writeFileSync('src/App.tsx', content, 'utf8');
console.log('✅ Done!');