const fs = require('fs');
const content = fs.readFileSync('src/App.tsx', 'utf8');

const marker = '.hist-cell:hover .hist-tooltip{opacity:1!important;visibility:visible!important}';
const idx = content.indexOf(marker);

if(idx === -1){ console.log('❌ marker tidak ditemukan'); process.exit(1); }

const insertAt = idx + marker.length;

const erpCss = `
.erp-wrap{display:flex;min-height:100vh}
.erp-sidebar{width:220px;min-width:220px;background:#fff;border-right:1px solid #e2e8f0;display:flex;flex-direction:column;height:100vh;position:sticky;top:0;transition:width .25s cubic-bezier(.4,0,.2,1),min-width .25s cubic-bezier(.4,0,.2,1);overflow:hidden;flex-shrink:0;z-index:200}
.erp-sidebar.collapsed{width:52px;min-width:52px}
.erp-logo-area{height:56px;display:flex;align-items:center;padding:0 12px;border-bottom:1px solid #e2e8f0;gap:10px;overflow:hidden;flex-shrink:0}
.erp-logo-box{width:30px;height:30px;min-width:30px;background:#1d4ed8;border-radius:7px;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:14px;flex-shrink:0}
.erp-logo-text{overflow:hidden;white-space:nowrap;transition:opacity .2s;min-width:0}
.erp-sidebar.collapsed .erp-logo-text{opacity:0;width:0}
.erp-nav-group-label{font-size:9px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.8px;padding:12px 14px 4px;white-space:nowrap;overflow:hidden;transition:opacity .15s}
.erp-sidebar.collapsed .erp-nav-group-label{opacity:0}
.erp-nav-item{display:flex;align-items:center;gap:10px;padding:8px 12px;cursor:pointer;color:#64748b;font-size:12px;font-weight:500;border-left:2px solid transparent;transition:all .15s;white-space:nowrap;overflow:hidden}
.erp-nav-item:hover{background:#f8fafc;color:#1e293b}
.erp-nav-item.active{background:#eff6ff;color:#1d4ed8;border-left-color:#1d4ed8;font-weight:600}
.erp-nav-item i{font-size:17px;flex-shrink:0;min-width:17px}
.erp-nav-text{overflow:hidden;transition:opacity .15s .05s;white-space:nowrap;flex:1}
.erp-sidebar.collapsed .erp-nav-text{opacity:0;width:0}
.erp-nav-badge{background:#fef2f2;color:#dc2626;border-radius:10px;padding:1px 6px;font-size:10px;font-weight:700;flex-shrink:0}
.erp-sidebar.collapsed .erp-nav-badge{opacity:0;overflow:hidden}
.erp-user-area{margin-top:auto;padding:10px 12px;border-top:1px solid #e2e8f0;display:flex;align-items:center;gap:10px;overflow:hidden;flex-shrink:0}
.erp-user-info{overflow:hidden;white-space:nowrap;transition:opacity .2s;flex:1;min-width:0}
.erp-sidebar.collapsed .erp-user-info{opacity:0;width:0}
.erp-main{flex:1;min-width:0;display:flex;flex-direction:column;overflow:hidden}
.erp-topbar{height:52px;background:#fff;border-bottom:1px solid #e2e8f0;display:flex;align-items:center;padding:0 20px;gap:12px;position:sticky;top:0;z-index:100;flex-shrink:0}
.erp-toggle-btn{width:32px;height:32px;border-radius:8px;border:1px solid #e2e8f0;background:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#64748b;transition:all .15s;flex-shrink:0}
.erp-toggle-btn:hover{background:#f1f5f9;color:#1e293b}
.erp-content{padding:20px;flex:1;overflow-y:auto;max-width:1440px;width:100%;margin:0 auto}
.erp-tooltip-el{position:fixed;background:#1e293b;color:#fff;font-size:11px;font-weight:600;padding:5px 10px;border-radius:7px;white-space:nowrap;pointer-events:none;z-index:9999;display:none}
.erp-tooltip-el::before{content:'';position:absolute;right:100%;top:50%;transform:translateY(-50%);border:5px solid transparent;border-right-color:#1e293b}`;

const fixed = content.slice(0, insertAt) + erpCss + content.slice(insertAt);
fs.writeFileSync('src/App.tsx', fixed, 'utf8');
console.log('✅ CSS injected!');
console.log('erp-sidebar:', fixed.includes('erp-sidebar{'));
console.log('erp-main:', fixed.includes('erp-main{'));