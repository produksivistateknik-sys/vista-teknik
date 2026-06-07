from pathlib import Path

APP_PATH = Path(r"C:\Users\User\vista-teknik\src\App.tsx")
content = APP_PATH.read_text(encoding="utf-8")

fixes = [
    ('<span style={{fontWeight:700,color:"#1e293b",fontSize:13}}>{p.proyek}</span>',
     '<span style={{fontWeight:700,color:"var(--text-primary,#1e293b)",fontSize:13}}>{p.proyek}</span>'),
    ('<span style={{fontWeight:600,color:"#1e293b",fontSize:12}}>{p.nama||"Panel "+(pi+1)}</span>',
     '<span style={{fontWeight:600,color:"var(--text-primary,#1e293b)",fontSize:12}}>{p.nama||"Panel "+(pi+1)}</span>'),
]

count = 0
for old, new in fixes:
    if old in content:
        content = content.replace(old, new)
        print(f"✅ Fixed!")
        count += 1
    else:
        print(f"⚠️  Not found: {old[:60]}")

APP_PATH.write_text(content, encoding="utf-8")
print(f"\n✅ {count} fixes applied!")
