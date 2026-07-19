export const GCss=`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
*{box-sizing:border-box;margin:0;padding:0}html,body,#root{width:100%;height:100%;overflow-x:hidden}

/* ── DARK MODE ── */
:root{
  --bg-primary:#fff;
  --bg-secondary:#f8fafc;
  --bg-tertiary:#f1f5f9;
  --text-primary:#0f172a;
  --text-secondary:#475569;
  --text-muted:#94a3b8;
  --border-color:#e2e8f0;
  --border-light:#f1f5f9;
  --card-bg:#fff;
  --input-bg:#f8fafc;
  --shadow:0 1px 4px #00000008;
}
[data-theme="dark"]{
  --bg-primary:#0f1117;
  --bg-secondary:#1a1d27;
  --bg-tertiary:#222536;
  --text-primary:#e2e8f0;
  --text-secondary:#94a3b8;
  --text-muted:#64748b;
  --border-color:#2d3148;
  --border-light:#1e2330;
  --card-bg:#1a1d27;
  --input-bg:#222536;
  --shadow:0 1px 4px #00000030;
}
[data-theme="dark"] body{background:var(--bg-primary);color:var(--text-primary)}
[data-theme="dark"] .erp-wrap{background:var(--bg-primary)}
[data-theme="dark"] .erp-body{background:var(--bg-primary)}
[data-theme="dark"] .erp-topbar{background:var(--bg-secondary);border-bottom:1px solid var(--border-color)}
[data-theme="dark"] .erp-main{background:var(--bg-primary)}
[data-theme="dark"] .erp-search{background:var(--bg-tertiary);border-color:var(--border-color);color:var(--text-primary)}
[data-theme="dark"] .erp-bell{background:var(--bg-tertiary);border-color:var(--border-color)}
[data-theme="dark"] .fi{background:var(--bg-primary)}

/* Cards & panels */
[data-theme="dark"] .Card,[data-theme="dark"] [class*="card"]{background:var(--card-bg)!important;border-color:var(--border-color)!important}
[data-theme="dark"] table thead tr{background:var(--bg-tertiary)!important}
[data-theme="dark"] table tbody tr:nth-child(even) td{background:var(--bg-secondary)!important}
[data-theme="dark"] table tbody tr:nth-child(odd) td{background:var(--card-bg)!important}
[data-theme="dark"] table th{background:#1e2330!important;color:#c8d0e8!important;border-color:var(--border-color)!important}
[data-theme="dark"] table td{border-color:var(--border-light)!important;color:var(--text-primary)!important}
[data-theme="dark"] input,[data-theme="dark"] select,[data-theme="dark"] textarea{
  background:var(--input-bg)!important;border-color:var(--border-color)!important;
  color:var(--text-primary)!important}
[data-theme="dark"] button:not([class*="Btn"]):not([style*="background:#"]):not([style*="background:linear"]){
  background:var(--bg-tertiary);color:var(--text-primary);border-color:var(--border-color)}

/* Modal */
[data-theme="dark"] .modal-overlay,[data-theme="dark"] [class*="modal"]{background:var(--card-bg)!important}

/* Landing & Login */
[data-theme="dark"] .landing-wrap{background:#0f1117!important}
[data-theme="dark"] .lg-card{background:var(--card-bg)!important;box-shadow:0 4px 24px #00000040!important}
[data-theme="dark"] .lg-inp{background:var(--input-bg)!important;border-color:var(--border-color)!important;color:var(--text-primary)!important}

/* Nav group text */
[data-theme="dark"] .erp-nav-grp{color:#4a5270!important}
[data-theme="dark"] .erp-topbar-right span{background:var(--bg-tertiary)!important;color:var(--text-secondary)!important}
[data-theme="dark"] .erp-card{background:#1a1d27!important;border-color:#2d3148!important;color:#e2e8f0!important}

/* ── DARK MODE FORCE OVERRIDE ── */
[data-theme="dark"] .erp-topbar{background:#16181f!important;border-color:#2d3148!important}
[data-theme="dark"] .erp-search{background:#222536!important;border-color:#2d3148!important;color:#e2e8f0!important}

/* Force semua div putih ke dark */
[data-theme="dark"] .erp-main div:not([class*="badge"]):not([class*="status"]):not([class*="tag"]) {
  --local-bg: var(--card-bg);
}

/* Target spesifik elemen berdasarkan posisi */
[data-theme="dark"] .fi > div,
[data-theme="dark"] .fi > div > div:not([style*="background:#"]):not([style*="background:linear"]):not([style*="background:rgb"]) {
  background-color: var(--card-bg, #1a1d27) !important;
  color: var(--text-primary, #e2e8f0) !important;
  border-color: var(--border-color, #2d3148) !important;
}

/* Modal */
[data-theme="dark"] div[style*="position:fixed"][style*="inset:0"] > div {
  background:#1a1d27!important;
  border-color:#2d3148!important;
}

/* Override inline background:#fff */
[data-theme="dark"] div[style*="background:#fff"],
[data-theme="dark"] div[style*="background: #fff"],
[data-theme="dark"] div[style*="background:white"] {
  background:#1a1d27!important;
}
[data-theme="dark"] div[style*="background:#f8fafc"] {
  background:#1e2130!important;
}
[data-theme="dark"] div[style*="background:#f1f5f9"] {
  background:#222536!important;
}
[data-theme="dark"] div[style*="background:#f9fafb"],
[data-theme="dark"] div[style*="background:#fafafa"] {
  background:#1e2130!important;
}

/* Force text colors */
[data-theme="dark"] div[style*="color:#1e293b"],
[data-theme="dark"] span[style*="color:#1e293b"],
[data-theme="dark"] td[style*="color:#1e293b"],
[data-theme="dark"] p[style*="color:#1e293b"] {
  color:#e2e8f0!important;
}
[data-theme="dark"] div[style*="color:#475569"],
[data-theme="dark"] span[style*="color:#475569"],
[data-theme="dark"] td[style*="color:#475569"] {
  color:#94a3b8!important;
}
[data-theme="dark"] div[style*="color:#64748b"],
[data-theme="dark"] span[style*="color:#64748b"],
[data-theme="dark"] td[style*="color:#64748b"] {
  color:#64748b!important;
}

/* Table */
[data-theme="dark"] table {
  background:#1a1d27!important;
}
[data-theme="dark"] td {
  background:#1a1d27!important;
  border-color:#2d3148!important;
  color:#e2e8f0!important;
}
[data-theme="dark"] tr:nth-child(even) td {
  background:#1e2130!important;
}
[data-theme="dark"] th {
  background:#0f1117!important;
  color:#94a3b8!important;
  border-color:#2d3148!important;
}

/* Input & Select */
[data-theme="dark"] input[style],
[data-theme="dark"] select[style],
[data-theme="dark"] textarea[style] {
  background:#222536!important;
  border-color:#2d3148!important;
  color:#e2e8f0!important;
}
[data-theme="dark"] *{color:inherit}
[data-theme="dark"] .erp-main{background:#0f1117!important}

/* ── DARK MODE COMPREHENSIVE ── */
[data-theme="dark"] body{background:#0f1117!important;color:#e2e8f0!important}
[data-theme="dark"] *[style*="background:#fff"]{background:#1a1d27!important}
[data-theme="dark"] *[style*="background: #fff"]{background:#1a1d27!important}
[data-theme="dark"] *[style*="background:#ffffff"]{background:#1a1d27!important}
[data-theme="dark"] *[style*="background:#f8fafc"]{background:#1e2130!important}
[data-theme="dark"] *[style*="background:#f1f5f9"]{background:#222536!important}
[data-theme="dark"] *[style*="background:#f9fafb"]{background:#1e2130!important}
[data-theme="dark"] *[style*="background:#fafafa"]{background:#1e2130!important}
[data-theme="dark"] *[style*="background:#f0f2f5"]{background:#16181f!important}
[data-theme="dark"] *[style*="background:white"]{background:#1a1d27!important}
[data-theme="dark"] *[style*="color:#1e293b"]{color:#e2e8f0!important}
[data-theme="dark"] *[style*="color:#0f172a"]{color:#e2e8f0!important}
[data-theme="dark"] *[style*="color:#334155"]{color:#cbd5e1!important}
[data-theme="dark"] *[style*="color:#374151"]{color:#cbd5e1!important}
[data-theme="dark"] *[style*="color:#111827"]{color:#e2e8f0!important}
[data-theme="dark"] *[style*="color:#1a1d23"]{color:#e2e8f0!important}
[data-theme="dark"] *[style*="border:1px solid #e2e8f0"]{border-color:#2d3148!important}
[data-theme="dark"] *[style*="border-bottom:1px solid #e2e8f0"]{border-bottom-color:#2d3148!important}
[data-theme="dark"] *[style*="border-top:1px solid #e2e8f0"]{border-top-color:#2d3148!important}
[data-theme="dark"] *[style*="border:1px solid #f1f5f9"]{border-color:#1e2130!important}
[data-theme="dark"] *[style*="borderBottom:1px solid #f1f5f9"]{border-bottom-color:#1e2130!important}
[data-theme="dark"] input:not([type="range"]){background:#222536!important;border-color:#2d3148!important;color:#e2e8f0!important}
[data-theme="dark"] select{background:#222536!important;border-color:#2d3148!important;color:#e2e8f0!important}
[data-theme="dark"] textarea{background:#222536!important;border-color:#2d3148!important;color:#e2e8f0!important}
[data-theme="dark"] *[style*="boxShadow"]{box-shadow:0 4px 24px rgba(0,0,0,0.4)!important}
[data-theme="dark"] ::-webkit-scrollbar-track{background:#1a1d27}
[data-theme="dark"] ::-webkit-scrollbar-thumb{background:#3d4468}

body{background:#f0f2f5;color:#1a1d23;font-family:Inter,sans-serif;font-size:12px;font-weight:400;text-align:left;overflow-x:hidden}
h1,h2,h3,h4,h5,h6{font-weight:500;text-align:left}
th,td{text-align:left;font-weight:400}
button{font-weight:500}
b,strong{font-weight:500}
::-webkit-scrollbar{width:4px;height:4px}
::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:#d1d5db;border-radius:2px}
input,select,textarea,button{font-family:inherit;outline:none}
input::placeholder,textarea::placeholder{color:#9ca3af}
.fi{animation:fadeIn .2s ease forwards}
.su{animation:slideUp .18s ease forwards}
.hist-cell:hover .hist-tooltip{opacity:1!important;visibility:visible!important}
.erp-wrap{display:flex;height:100vh;overflow:hidden;background:#f0f2f5;position:fixed;top:0;left:0;right:0;bottom:0}
.erp-sb{width:220px;min-width:220px;height:100vh;background:#1e3a8a;display:flex;flex-direction:column;transition:width .2s ease,min-width .2s ease;overflow:hidden;flex-shrink:0}
.erp-sb.col{width:52px;min-width:52px}
.erp-sb-head{height:56px;display:flex;align-items:center;padding:0 16px;gap:10px;overflow:hidden;flex-shrink:0;background:#1a3278;border-bottom:1px solid #2d4ba0}
.erp-sb.col .erp-sb-head{padding:0;justify-content:center}
.erp-logo{width:30px;height:30px;min-width:30px;background:#1d4ed8;border-radius:6px;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:13px;flex-shrink:0}
.erp-brand{overflow:hidden;white-space:nowrap;opacity:1;transition:opacity .15s;min-width:0}
.erp-sb.col .erp-brand{opacity:0;pointer-events:none;width:0}
.erp-brand-name{font-weight:800;font-size:14px;color:#fff;line-height:1.2;letter-spacing:1px;text-transform:uppercase}
.erp-brand-sub{font-size:9px;color:#93c5fd;display:none;margin-top:2px;line-height:1.3;letter-spacing:.3px;text-transform:uppercase}
.erp-nav{flex:1;overflow-y:auto;overflow-x:hidden;padding:8px 0}
.erp-nav::-webkit-scrollbar{width:2px}
.erp-nav::-webkit-scrollbar-thumb{background:#2d4ba0;border-radius:2px}
.erp-nav-grp{font-size:9px;font-weight:600;color:#93c5fd;text-transform:uppercase;letter-spacing:.9px;padding:12px 14px 4px;white-space:nowrap;overflow:hidden;opacity:1;transition:opacity .12s}
.erp-sb.col .erp-nav-grp{opacity:0;height:0;padding:0;min-height:0;overflow:hidden}
.erp-nav-item{display:flex;align-items:center;gap:9px;padding:7px 10px;margin:1px 6px;border-radius:6px;cursor:pointer;color:#bfdbfe;font-size:12px;font-weight:400;white-space:nowrap;overflow:hidden;transition:all .12s;border:none;background:transparent;width:calc(100% - 12px);text-align:left;font-family:inherit;line-height:1.4}
.erp-nav-item:hover{background:#2d4ba0;color:#fff}
.erp-nav-item.active{background:#1d4ed8;color:#fff;font-weight:500}
.erp-sb.col .erp-nav-item{padding:0;margin:0;height:38px;border-radius:0;justify-content:center;align-items:center;width:52px;gap:0;display:flex}
.erp-nav-item i{font-size:15px;flex-shrink:0;width:20px;text-align:center;color:inherit}
.erp-nav-label{overflow:hidden;flex:1;opacity:1;transition:opacity .12s;font-size:12px}
.erp-sb.col .erp-nav-label{opacity:0;width:0}
.erp-nav-badge{background:#e53e3e22;color:#fc8181;border-radius:4px;padding:1px 6px;font-size:9.5px;font-weight:600;flex-shrink:0;transition:opacity .12s;line-height:1.5}
.erp-sb.col .erp-nav-badge{opacity:0}
.erp-sb-foot{padding:10px 12px;border-top:1px solid #2d4ba0;display:flex;align-items:center;gap:10px;overflow:hidden;flex-shrink:0;background:#1a3278}
.erp-sb.col .erp-sb-foot{justify-content:center;padding:10px 0;gap:0}
.erp-foot-av{width:28px;height:28px;min-width:28px;border-radius:6px;background:#1d4ed8;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:600;color:#fff;flex-shrink:0;border:1px solid #3b82f6}
.erp-foot-info{flex:1;min-width:0;overflow:hidden;opacity:1;transition:opacity .15s}
.erp-sb.col .erp-foot-info{opacity:0;width:0;pointer-events:none}
.erp-foot-name{font-size:11.5px;font-weight:600;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-transform:uppercase;letter-spacing:.3px}
.erp-foot-role{font-size:9.5px;color:#93c5fd;margin-top:1px;letter-spacing:.2px}
.erp-main{flex:1;display:flex;flex-direction:column;overflow:hidden;min-width:0}
.erp-topbar{height:40px;background:#fff;border-bottom:1px solid #e5e8ed;display:flex;align-items:center;padding:0 14px;gap:8px;flex-shrink:0}
.erp-toggle{width:26px;height:26px;border-radius:5px;border:1px solid #e5e8ed;background:#f8f9fb;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#6b7280;flex-shrink:0;transition:all .12s}
.erp-toggle:hover{background:#eff3ff;color:#3b5bdb;border-color:#c5d0ff}
.erp-toggle i{font-size:14px}
.erp-search{flex:1;max-width:240px;height:26px;border:1px solid #e5e8ed;border-radius:5px;padding:0 9px 0 28px;font-size:11.5px;color:#1a1d23;background:#f8f9fb;outline:none;font-family:inherit}
.erp-search:focus{border-color:#3b5bdb;background:#fff}
.erp-topbar-right{display:flex;align-items:center;gap:5px;margin-left:auto}
.erp-bell{width:26px;height:26px;border:1px solid #e5e8ed;border-radius:5px;background:#f8f9fb;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#6b7280;position:relative;flex-shrink:0}
.erp-bell i{font-size:13px}
.erp-bell-dot{position:absolute;top:5px;right:5px;width:5px;height:5px;border-radius:50%;background:#e53e3e;border:1.5px solid #fff}
.erp-body{flex:1;overflow-y:auto;overflow-x:hidden;padding:10px;background:#f0f2f5}
.erp-body::-webkit-scrollbar{width:4px}
.erp-body::-webkit-scrollbar-thumb{background:#d1d5db;border-radius:2px}
.erp-tooltip-el{position:fixed;background:#1a1d23;color:#f1f3f9;font-size:11px;font-weight:500;padding:5px 10px;border-radius:5px;white-space:nowrap;pointer-events:none;z-index:9999;display:none}`;
