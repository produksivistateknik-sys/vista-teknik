from pathlib import Path

APP_PATH = Path(r"C:\Users\User\vista-teknik\src\App.tsx")
content = APP_PATH.read_text(encoding="utf-8")

fixes = [
    ('<span style={{color:"#1e293b",fontWeight:700}}>{wo.proyek}</span>',
     '<span style={{color:"var(--text-primary,#1e293b)",fontWeight:700}}>{wo.proyek}</span>'),
    ('<span style={{fontWeight:700,color:"#1e293b",fontSize:13}}>{p.nama}</span>',
     '<span style={{fontWeight:700,color:"var(--text-primary,#1e293b)",fontSize:13}}>{p.nama}</span>'),
    ('<span style={{fontSize:12,fontWeight:600,color:"#374151",flex:1}}>',
     '<span style={{fontSize:12,fontWeight:600,color:"var(--text-primary,#374151)",flex:1}}>'),
    ('fontWeight:700,fontFamily:"\'DM Mono\',monospace",color:isLocked?"#fca5a5":"#1e293b"}}/>',
     'fontWeight:700,fontFamily:"\'DM Mono\',monospace",color:isLocked?"#fca5a5":"var(--text-primary,#1e293b)"}}/>'),
    ('<div style={{fontWeight:800,fontSize:16,color:"#1e293b"}}>{editId?"✏️ Edit WO":"📝 Tambah W',
     '<div style={{fontWeight:800,fontSize:16,color:"var(--text-primary,#1e293b)"}}>{editId?"✏️ Edit WO":"📝 Tambah W'),
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
