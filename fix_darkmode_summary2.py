from pathlib import Path

APP_PATH = Path(r"C:\Users\User\vista-teknik\src\App.tsx")
content = APP_PATH.read_text(encoding="utf-8")

old = '<span style={{fontWeight:700,color:"#1e293b",fontSize:13}}>{wo.proyek}</span>'
new = '<span style={{fontWeight:700,color:"var(--text-primary,#1e293b)",fontSize:13}}>{wo.proyek}</span>'

if old in content:
    content = content.replace(old, new)
    APP_PATH.write_text(content, encoding="utf-8")
    print("✅ Fixed!")
else:
    print("❌ Not found!")
