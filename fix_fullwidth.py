from pathlib import Path

APP_PATH = Path(r"C:\Users\User\vista-teknik\src\App.tsx")
content = APP_PATH.read_text(encoding="utf-8")

# Fix erp-body padding - kurangi padding kanan
old_css = '.erp-body{flex:1;overflow-y:auto;overflow-x:hidden;padding:10px 4px;background:#f0f2f5}'
new_css = '.erp-body{flex:1;overflow-y:auto;overflow-x:hidden;padding:10px;background:#f0f2f5}'

if old_css in content:
    content = content.replace(old_css, new_css)
    print("✅ erp-body padding fixed")
else:
    print("❌ erp-body not found")

# Fix erp-wrap - pastikan full width
old_wrap = '.erp-wrap{display:flex;height:100vh;overflow:hidden;background:#f0f2f5}'
new_wrap = '.erp-wrap{display:flex;height:100vh;width:100vw;overflow:hidden;background:#f0f2f5}'

if old_wrap in content:
    content = content.replace(old_wrap, new_wrap)
    print("✅ erp-wrap width fixed")
else:
    print("❌ erp-wrap not found")

APP_PATH.write_text(content, encoding="utf-8")
print("\n✅ Selesai!")
