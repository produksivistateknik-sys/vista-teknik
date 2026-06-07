from pathlib import Path

APP_PATH = Path(r"C:\Users\User\vista-teknik\src\App.tsx")
content = APP_PATH.read_text(encoding="utf-8")

old = '"WM.10": ["POTONG","BENDING","STEL","PAINTING","RAKIT"],'
new = '"WM.10": ["POTONG","BENDING","STEL","PAINTING","RAKIT","WIRING CONTROL","WIRING POWER"],'

if old in content:
    content = content.replace(old, new)
    APP_PATH.write_text(content, encoding="utf-8")
    print("✅ WM.10 Pintu Dalam updated!")
else:
    print("❌ Not found!")
