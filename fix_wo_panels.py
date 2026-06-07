from pathlib import Path

APP_PATH = Path(r"C:\Users\User\vista-teknik\src\App.tsx")
content = APP_PATH.read_text(encoding="utf-8")

old = '{isExp&&wo.panels.map(p=>{'
new = '{isExp&&(wo.panels||[]).map(p=>{'

count = content.count(old)
if count > 0:
    content = content.replace(old, new)
    APP_PATH.write_text(content, encoding="utf-8")
    print(f"✅ Fixed {count}x!")
else:
    print("❌ Not found!")
