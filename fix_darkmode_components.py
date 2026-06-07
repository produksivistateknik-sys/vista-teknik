from pathlib import Path

APP_PATH = Path(r"C:\Users\User\vista-teknik\src\App.tsx")
content = APP_PATH.read_text(encoding="utf-8")

# Fix Card component
old_card = """function Card({children,style={}}){
  return <div style={{background:"#fff",borderRadius:12,border:"1px solid #e2e8f0",
    padding:16,boxShadow:"0 1px 3px #00000008",...style}}>{children}</div>; 
}"""

new_card = """function Card({children,style={}}){
  return <div className="erp-card" style={{background:"var(--card-bg,#fff)",borderRadius:12,
    border:"1px solid var(--border-color,#e2e8f0)",
    padding:16,boxShadow:"0 1px 3px #00000008",...style}}>{children}</div>; 
}"""

if old_card in content:
    content = content.replace(old_card, new_card)
    print("✅ Card component fixed")
else:
    print("❌ Card not found")

# Fix Inp component
old_inp = "function Inp({style={},...p}){return <input style={{width:\"100%\",height:28,padding:\"0 8px\",border:\"1px solid #e2e8f0\",borderRadius:6,fontSize:12,background:\"#f8fafc\",outline:\"none\",color:\"#1e293b\",fontFamily:\"inherit\",...style}} {...p}/>;}"

new_inp = "function Inp({style={},...p}){return <input style={{width:\"100%\",height:28,padding:\"0 8px\",border:\"1px solid var(--border-color,#e2e8f0)\",borderRadius:6,fontSize:12,background:\"var(--input-bg,#f8fafc)\",outline:\"none\",color:\"var(--text-primary,#1e293b)\",fontFamily:\"inherit\",...style}} {...p}/>;}"

if old_inp in content:
    content = content.replace(old_inp, new_inp)
    print("✅ Inp component fixed")
else:
    print("❌ Inp not found")

# Tambah CSS untuk erp-card
old_css_end = """[data-theme="dark"] .erp-main{background:#0f1117!important}
[data-theme="dark"] .erp-main > *{background:transparent!important}"""

new_css_end = """[data-theme="dark"] .erp-main{background:#0f1117!important}
[data-theme="dark"] .erp-main > *{background:transparent!important}
[data-theme="dark"] .erp-card{background:#1a1d27!important;border-color:#2d3148!important;color:#e2e8f0!important}"""

if old_css_end in content:
    content = content.replace(old_css_end, new_css_end)
    print("✅ erp-card CSS added")
else:
    print("❌ CSS end not found")

APP_PATH.write_text(content, encoding="utf-8")
print("\n✅ Selesai!")
