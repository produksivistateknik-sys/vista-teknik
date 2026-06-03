from pathlib import Path

APP_PATH = Path(r"C:\Users\User\vista-teknik\src\App.tsx")
content = APP_PATH.read_text(encoding="utf-8")

old = 'maxHeight:"calc(100vh - 220px)"'
new = 'maxHeight:"calc(100vh - 160px)"'

if old in content:
    content = content.replace(old, new)
    APP_PATH.write_text(content, encoding="utf-8")
    print("✅ Done! Height adjusted.")
else:
    print("❌ Not found!")
