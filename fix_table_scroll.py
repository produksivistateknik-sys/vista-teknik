from pathlib import Path

APP_PATH = Path(r"C:\Users\User\vista-teknik\src\App.tsx")
content = APP_PATH.read_text(encoding="utf-8")

# Wrap tabel dalam container dengan height constraint
# sehingga thead sticky bekerja di dalam container ini
old = '<div style={{overflowX:"auto",borderRadius:12,border:"1px solid #e2e8f0",boxShadow:"0 1px 4px #00000008"}}>'
new = '<div style={{overflowX:"auto",overflowY:"auto",maxHeight:"calc(100vh - 220px)",borderRadius:12,border:"1px solid #e2e8f0",boxShadow:"0 1px 4px #00000008"}}>'

if old in content:
    content = content.replace(old, new)
    APP_PATH.write_text(content, encoding="utf-8")
    print("✅ Done! Table container height set.")
else:
    print("❌ Not found!")
    lines = content.splitlines()
    for i, l in enumerate(lines[3110:3116], 3111):
        print(f"{i}: {l}")
