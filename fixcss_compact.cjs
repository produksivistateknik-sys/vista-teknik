const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

// Replace ERP CSS yang lama dengan yang baru lebih compact
const oldCssStart = content.indexOf('\n.erp-wrap{');
const oldCssEnd = content.indexOf('.erp-tooltip-el{') + content.slice(content.indexOf('.erp-tooltip-el{')).indexOf('}') + 1;

const newCss = `
.erp-wrap{display:flex;height:100vh;overflow:hidden;background:#f8fafc}
.erp-sb{width:216px;min-width:216px;height:100vh;background:#fff;border-right:1px solid #eaecf0;display:flex;flex-direction:column;transition:width .2s ease,min-width .2s ease;overflow:hidden;flex-shrink:0}
.erp-sb.col{width:48px;min-width:48px}
.erp-sb-head{height:52px;display:flex;align-items:center;padding:0 12px;border-bottom:1px solid #f0f2f5;gap:8px;overflow:hidden;flex-shrink:0}
.erp-sb.col .erp-sb-head{padding:0;justify-content:center}
.erp-logo{width:28px;height:28px;min-width:28px;background:#2563eb;border-radius:6px;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:900;font-size:13px;flex-shrink:0}
.erp-brand{overflow:hidden;white-space:nowrap;opacity:1;transition:opacity .15s;min-width:0}
.erp-sb.col .erp-brand{opacity:0;pointer-events:none;width:0}
.erp-brand-name{font-weight:700;font-size:11.5px;color:#0f172a;line-height:1.2}
.erp-brand-sub{font-size:8px;color:#94a3b8;margin-top:1px;line-height:1.3}
.erp-nav{flex:1;overflow-y:auto;overflow-x:hidden;padding:4px 0}
.erp-nav::-webkit-scrollbar{width:3px}
.erp-nav::-webkit-scrollbar-thumb{background:#e2e8f0;border-radius:3px}
.erp-nav-grp{font-size:8.5px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.7px;padding:10px 12px 2px;white-space:nowrap;overflow:hidden;opacity:1;transition:opacity .12s,height .12s}
.erp-sb.col .erp-nav-grp{opacity:0;height:0;padding:0;min-height:0;overflow:hidden}
.erp-nav-item{display:flex;align-items:center;gap:8px;padding:5px 8px;margin:1px 5px;border-radius:5px;cursor:pointer;color:#64748b;font-size:11.5px;font-weight:400;white-space:nowrap;overflow:hidden;transition:all .12s;border:none;background:transparent;width:calc(100% - 10px);text-align:left;font-family:inherit;line-height:1.4}
.erp-nav-item:hover{background:#f5f6f8;color:#1e293b}
.erp-nav-item.active{background:#eff6ff;color:#2563eb;font-weight:600}
.erp-sb.col .erp-nav-item{padding:7px 0;margin:1px 0;border-radius:0;justify-content:center;width:100%;gap:0}
.erp-nav-item i{font-size:15px;flex-shrink:0;width:16px;text-align:center;color:inherit}
.erp-nav-label{overflow:hidden;flex:1;opacity:1;transition:opacity .12s;font-size:11.5px}
.erp-sb.col .erp-nav-label{opacity:0;width:0}
.erp-nav-badge{background:#fde8e8;color:#dc2626;border-radius:9px;padding:1px 5px;font-size:9px;font-weight:700;flex-shrink:0;transition:opacity .12s;line-height:1.4}
.erp-sb.col .erp-nav-badge{opacity:0}
.erp-sb-foot{padding:8px 10px;border-top:1px solid #f0f2f5;display:flex;align-items:center;gap:8px;overflow:hidden;flex-shrink:0}
.erp-sb.col .erp-sb-foot{justify-content:center;padding:8px 0;gap:0}
.erp-foot-av{width:26px;height:26px;min-width:26px;border-radius:50%;background:#eff6ff;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:800;color:#2563eb;flex-shrink:0;border:1.5px solid #bfdbfe}
.erp-foot-info{flex:1;min-width:0;overflow:hidden;opacity:1;transition:opacity .15s}
.erp-sb.col .erp-foot-info{opacity:0;width:0;pointer-events:none}
.erp-foot-name{font-size:11px;font-weight:700;color:#1e293b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-transform:uppercase;letter-spacing:.2px}
.erp-foot-role{font-size:9px;color:#94a3b8;margin-top:1px}
.erp-main{flex:1;display:flex;flex-direction:column;overflow:hidden;min-width:0}
.erp-topbar{height:44px;background:#fff;border-bottom:1px solid #eaecf0;display:flex;align-items:center;padding:0 14px;gap:8px;flex-shrink:0}
.erp-toggle{width:28px;height:28px;border-radius:5px;border:1px solid #e2e8f0;background:#f8fafc;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#64748b;flex-shrink:0;transition:all .12s}
.erp-toggle:hover{background:#eff6ff;color:#2563eb;border-color:#bfdbfe}
.erp-toggle i{font-size:15px}
.erp-search{flex:1;max-width:220px;height:28px;border:1px solid #e2e8f0;border-radius:5px;padding:0 9px 0 28px;font-size:11.5px;color:#1e293b;background:#f8fafc url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2'%3E%3Ccircle cx='11' cy='11' r='8'/%3E%3Cpath d='m21 21-4.35-4.35'/%3E%3C/svg%3E") no-repeat 8px center;outline:none;font-family:inherit}
.erp-search:focus{border-color:#2563eb;background:#fff}
.erp-topbar-right{display:flex;align-items:center;gap:6px;margin-left:auto}
.erp-bell{width:28px;height:28px;border:1px solid #e2e8f0;border-radius:5px;background:#f8fafc;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#64748b;position:relative;flex-shrink:0}
.erp-bell i{font-size:14px}
.erp-bell-dot{position:absolute;top:4px;right:4px;width:6px;height:6px;border-radius:50%;background:#dc2626;border:1.5px solid #fff}
.erp-body{flex:1;overflow-y:auto;overflow-x:hidden;padding:14px 16px;background:#f8fafc}
.erp-body::-webkit-scrollbar{width:4px}
.erp-body::-webkit-scrollbar-thumb{background:#e2e8f0;border-radius:3px}
.erp-tooltip-el{position:fixed;background:#1e293b;color:#fff;font-size:11px;font-weight:600;padding:4px 9px;border-radius:5px;white-space:nowrap;pointer-events:none;z-index:9999;display:none;box-shadow:0 4px 12px rgba(0,0,0,.2);transform:translateY(-50%)}`;

if(oldCssStart !== -1 && oldCssEnd !== -1){
  content = content.slice(0, oldCssStart) + newCss + content.slice(oldCssEnd);
  console.log('✅ CSS updated');
} else {
  console.log('❌ CSS markers not found, oldCssStart:', oldCssStart, 'oldCssEnd:', oldCssEnd);
  process.exit(1);
}

// Fix font size global di GCss - body font lebih kecil
content = content.replace(
  "body{background:#f1f5f9;color:#1e293b;font-family:'Plus Jakarta Sans',sans-serif}",
  "body{background:#f1f5f9;color:#1e293b;font-family:'Plus Jakarta Sans',sans-serif;font-size:13px}"
);

fs.writeFileSync('src/App.tsx', content, 'utf8');
console.log('✅ Done!');