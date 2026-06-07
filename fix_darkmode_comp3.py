from pathlib import Path

APP_PATH = Path(r"C:\Users\User\vista-teknik\src\App.tsx")
content = APP_PATH.read_text(encoding="utf-8")

# Fix Inp
old_inp = 'function Inp({style={},...p}){\n  return <input style={{width:"100%",padding:"9px 12px",borderRadius:8,border:"1.5px solid #e2e8f0",\n    background:"#f8fafc",color:"#1e293b",fontSize:13,...style}} {...p}/>;'
new_inp = 'function Inp({style={},...p}){\n  return <input style={{width:"100%",padding:"9px 12px",borderRadius:8,border:"1.5px solid var(--border-color,#e2e8f0)",\n    background:"var(--input-bg,#f8fafc)",color:"var(--text-primary,#1e293b)",fontSize:13,...style}} {...p}/>;'

if old_inp in content:
    content = content.replace(old_inp, new_inp)
    print("✅ Inp fixed")
else:
    print("❌ Inp not found")

# Fix Sel
old_sel = 'function Sel({style={},children,...p}){\n  return <select style={{width:"100%",padding:"9px 12px",borderRadius:8,border:"1.5px solid #e2e8f0",\n    background:"#f8fafc",color:"#1e293b",fontSize:13,...style}} {...p}>{children}</select>;'
new_sel = 'function Sel({style={},children,...p}){\n  return <select style={{width:"100%",padding:"9px 12px",borderRadius:8,border:"1.5px solid var(--border-color,#e2e8f0)",\n    background:"var(--input-bg,#f8fafc)",color:"var(--text-primary,#1e293b)",fontSize:13,...style}} {...p}>{children}</select>;'

if old_sel in content:
    content = content.replace(old_sel, new_sel)
    print("✅ Sel fixed")
else:
    print("❌ Sel not found")

# Tambah CSS erp-card
old_css = '[data-theme="dark"] .erp-main{background:#0f1117!important}\n[data-theme="dark"] .erp-main > *{background:transparent!important}'
new_css = '[data-theme="dark"] .erp-main{background:#0f1117!important}\n[data-theme="dark"] .erp-main > *{background:transparent!important}\n[data-theme="dark"] .erp-card{background:#1a1d27!important;border-color:#2d3148!important;color:#e2e8f0!important}'

if old_css in content:
    content = content.replace(old_css, new_css)
    print("✅ erp-card CSS added")
else:
    print("❌ CSS not found")

APP_PATH.write_text(content, encoding="utf-8")
print("\n✅ Selesai!")
