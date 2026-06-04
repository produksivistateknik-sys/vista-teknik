from pathlib import Path

APP_PATH = Path(r"C:\Users\User\vista-teknik\src\App.tsx")
content = APP_PATH.read_text(encoding="utf-8")

old = 'const TODAY="2026-05-18";'
new = 'const TODAY=new Date().toISOString().slice(0,10);'

if old in content:
    content = content.replace(old, new)
    APP_PATH.write_text(content, encoding="utf-8")
    print("✅ TODAY fixed - tidak lagi hardcoded!")
else:
    # cari pattern lain
    import re
    match = re.search(r'const TODAY="20\d\d-\d\d-\d\d";', content)
    if match:
        content = content.replace(match.group(), new)
        APP_PATH.write_text(content, encoding="utf-8")
        print(f"✅ TODAY fixed dari: {match.group()}")
    else:
        print("❌ TODAY tidak ditemukan!")
