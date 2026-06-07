from pathlib import Path

APP_PATH = Path(r"C:\Users\User\vista-teknik\src\App.tsx")
content = APP_PATH.read_text(encoding="utf-8")

# ── 1. Tambah darkMode state di App ──
old_states = """  const [showNotif,setShowNotif]=useState(false);
  const [showSearch,setShowSearch]=useState(false);
  const [searchQuery,setSearchQuery]=useState("");"""

new_states = """  const [showNotif,setShowNotif]=useState(false);
  const [showSearch,setShowSearch]=useState(false);
  const [searchQuery,setSearchQuery]=useState("");
  const [darkMode,setDarkMode]=useState(()=>{
    return localStorage.getItem("vista_dark_mode")==="true";
  });"""

if old_states in content:
    content = content.replace(old_states, new_states)
    print("✅ darkMode state added")
else:
    print("❌ States not found")

# ── 2. Tambah useEffect untuk apply dark mode ke body ──
old_isop = """  const isOp=OPERATOR_ROLES.includes(user?.divisi);"""
new_isop = """  const isOp=OPERATOR_ROLES.includes(user?.divisi);

  useEffect(()=>{
    localStorage.setItem("vista_dark_mode", String(darkMode));
    document.documentElement.setAttribute("data-theme", darkMode?"dark":"light");
  },[darkMode]);"""

if old_isop in content:
    content = content.replace(old_isop, new_isop)
    print("✅ Dark mode useEffect added")
else:
    print("❌ isOp not found")

# ── 3. Tambah toggle button di topbar sebelah bell ──
old_bell_area = """                <div style={{position:"relative"}}>
                  <div className="erp-bell" onClick={()=>setShowNotif(p=>!p)}"""

new_bell_area = """                {/* Dark mode toggle */}
                <button onClick={()=>setDarkMode(p=>!p)}
                  title={darkMode?"Light Mode":"Dark Mode"}
                  style={{width:26,height:26,border:"1px solid var(--border-color,#e5e8ed)",
                    borderRadius:5,background:"var(--bg-secondary,#f8f9fb)",
                    display:"flex",alignItems:"center",justifyContent:"center",
                    cursor:"pointer",color:"var(--text-secondary,#64748b)"}}>
                  <i className={darkMode?"ti ti-sun":"ti ti-moon"} style={{fontSize:13}}/>
                </button>

                <div style={{position:"relative"}}>
                  <div className="erp-bell" onClick={()=>setShowNotif(p=>!p)}"""

if old_bell_area in content:
    content = content.replace(old_bell_area, new_bell_area)
    print("✅ Dark mode toggle button added to topbar")
else:
    print("❌ Bell area not found")

# ── 4. Tambah CSS dark mode variables ──
old_gcss_end = """*{box-sizing:border-box;margin:0;padding:0}html,body,#root{width:100%;height:100%;overflow-x:hidden}"""
new_gcss_end = """*{box-sizing:border-box;margin:0;padding:0}html,body,#root{width:100%;height:100%;overflow-x:hidden}

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
[data-theme="dark"] .erp-topbar-right span{background:var(--bg-tertiary)!important;color:var(--text-secondary)!important}"""

if old_gcss_end in content:
    content = content.replace(old_gcss_end, new_gcss_end)
    print("✅ Dark mode CSS variables added")
else:
    print("❌ GCss end not found")

APP_PATH.write_text(content, encoding="utf-8")
print("\n✅ Selesai!")
