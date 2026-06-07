from pathlib import Path

APP_PATH = Path(r"C:\Users\User\vista-teknik\src\App.tsx")
content = APP_PATH.read_text(encoding="utf-8")

fixes = [
    ('<div style={{fontWeight:800,fontSize:14,color:"#1e293b",marginBottom:12}}>{editId?"✏️ Edit',
     '<div style={{fontWeight:800,fontSize:14,color:"var(--text-primary,#1e293b)",marginBottom:12}}>{editId?"✏️ Edit'),
    ('<div key={m.id} style={{background:"#fff",border:`0.5px solid ${sc.border}`,borderRadius:1',
     '<div key={m.id} style={{background:"var(--card-bg,#fff)",border:`0.5px solid ${sc.border}`,borderRadius:1'),
    ('<div><div style={{fontWeight:700,fontSize:13,color:"#1e293b"}}>{m.mesin?.nama||"—"}</div><',
     '<div><div style={{fontWeight:700,fontSize:13,color:"var(--text-primary,#1e293b)"}}>{m.mesin?.nama||"—"}</div><'),
    ('<div style={{color:"#1e293b"}}>{m.mesin?.nama||"—"}</di',
     '<div style={{color:"var(--text-primary,#1e293b)"}}>{m.mesin?.nama||"—"}</di'),
    ('{m.perbaikan&&<div style={{fontSize:11,color:"#16a34a",background:"#f0fdf4",borderRadius:6',
     '{m.perbaikan&&<div style={{fontSize:11,color:"#16a34a",background:"var(--wp2-bg,#f0fdf4)",borderRadius:6'),
]

count = 0
for old, new in fixes:
    if old in content:
        content = content.replace(old, new)
        print(f"✅ Fixed: {old[:50]}")
        count += 1
    else:
        print(f"⚠️  Not found: {old[:50]}")

APP_PATH.write_text(content, encoding="utf-8")
print(f"\n✅ {count} fixes applied!")
