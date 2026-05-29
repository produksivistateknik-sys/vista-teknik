const fs = require('fs');
const content = fs.readFileSync('src/App.tsx', 'utf8');

const oldCss = `.hist-cell:hover .hist-tooltip{opacity:1!important;visibility:visible!important}
\``;

const newCss = `.hist-cell:hover .hist-tooltip{opacity:1!important;visibility:visible!important}
.erp-sidebar{width:220px;min-width:220px;background:#fff;border-right:1px solid #e2e8f0;display:flex;flex-direction:column;height:100vh;position:sticky;top:0;transition:width .25s cubic-bezier(.4,0,.2,1),min-width .25s cubic-bezier(.4,0,.2,1);overflow:hidden;flex-shrink:0}
.erp-sidebar.collapsed{width:52px;min-width:52px}
.erp-sidebar .logo-area{height:56px;display:flex;align-items:center;padding:0 12px;border-bottom:1px solid #e2e8f0;gap:10px;overflow:hidden;flex-shrink:0}
.erp-sidebar .logo-box{width:30px;height:30px;min-width:30px;background:#1d4ed8;border-radius:7px;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:14px;flex-shrink:0}
.erp-sidebar .logo-text{overflow:hidden;white-space:nowrap;transition:opacity .2s;min-width:0}
.erp-sidebar.collapsed .logo-text{opacity:0;width:0}
.erp-sidebar .nav-group-label{font-size:9px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.8px;padding:12px 14px 4px;white-space:nowrap;overflow:hidden;transition:opacity .15s}
.erp-sidebar.collapsed .nav-group-label{opacity:0}
.erp-sidebar .nav-item{display:flex;align-items:center;gap:10px;padding:8px 12px;cursor:pointer;color:#64748b;font-size:12px;font-weight:500;border-left:2px solid transparent;transition:all .15s;position:relative;white-space:nowrap;overflow:hidden}
.erp-sidebar .nav-item:hover{background:#f8fafc;color:#1e293b}
.erp-sidebar .nav-item.active{background:#eff6ff;color:#1d4ed8;border-left:2px solid #1d4ed8}
.erp-sidebar .nav-item i{font-size:17px;flex-shrink:0;min-width:17px}
.erp-sidebar .nav-item .nav-text{overflow:hidden;transition:opacity .15s .05s;white-space:nowrap}
.erp-sidebar.collapsed .nav-item .nav-text{opacity:0;width:0;transition:opacity .1s,width .25s}
.erp-tooltip{display:none;position:fixed;left:58px;background:#1e293b;color:#fff;font-size:11px;font-weight:600;padding:5px 10px;border-radius:7px;white-space:nowrap;pointer-events:none;z-index:9999;transform:translateY(-50%)}
.erp-tooltip::before{content:'';position:absolute;right:100%;top:50%;transform:translateY(-50%);border:5px solid transparent;border-right-color:#1e293b}
.erp-sidebar .user-area{margin-top:auto;padding:10px 12px;border-top:1px solid #e2e8f0;display:flex;align-items:center;gap:10px;overflow:hidden;flex-shrink:0}
.erp-sidebar .user-info{overflow:hidden;white-space:nowrap;transition:opacity .2s;flex:1;min-width:0}
.erp-sidebar.collapsed .user-info{opacity:0;width:0}
.erp-main{flex:1;min-width:0;display:flex;flex-direction:column;min-height:100vh;overflow:auto}
.erp-topbar{height:52px;background:#fff;border-bottom:1px solid #e2e8f0;display:flex;align-items:center;padding:0 20px;gap:12px;position:sticky;top:0;z-index:100;flex-shrink:0}
.erp-toggle-btn{width:32px;height:32px;border-radius:8px;border:1px solid #e2e8f0;background:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#64748b;transition:all .15s;flex-shrink:0}
.erp-toggle-btn:hover{background:#f1f5f9;color:#1e293b}
.erp-content{padding:20px;max-width:1440px;margin:0 auto;width:100%}
\``;

const fixed = content.replace(oldCss, newCss);
if(fixed === content) {
  console.log('❌ Pattern tidak ditemukan!');
  const idx = content.indexOf('.hist-cell:hover .hist-tooltip');
  console.log('hist-cell index:', idx);
  console.log('Context:', JSON.stringify(content.substring(idx, idx+80)));
} else {
  fs.writeFileSync('src/App.tsx', fixed, 'utf8');
  console.log('✅ CSS ERP berhasil ditambahkan!');
}