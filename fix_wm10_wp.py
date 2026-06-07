from pathlib import Path

APP_PATH = Path(r"C:\Users\User\vista-teknik\src\App.tsx")
content = APP_PATH.read_text(encoding="utf-8")

# Fix 1: Tambah PASANG KOMPONEN ke WM.10
old = '"WM.10": ["POTONG","BENDING","STEL","PAINTING","RAKIT","WIRING CONTROL","WIRING POWER"],'
new = '"WM.10": ["POTONG","BENDING","STEL","PAINTING","RAKIT","PASANG KOMPONEN","WIRING CONTROL","WIRING POWER"],'

if old in content:
    content = content.replace(old, new)
    print("✅ WM.10 PASANG KOMPONEN added!")
else:
    print("❌ WM.10 not found")

# Fix 2: Hapus WP5 WP6 dari WP_LIST
old_wp = 'const WP_LIST    = ["WP1","WP2","WP3","WP4","WP5","WP6"];'
new_wp = 'const WP_LIST    = ["WP1","WP2","WP3","WP4"];'

if old_wp in content:
    content = content.replace(old_wp, new_wp)
    print("✅ WP5 WP6 removed from WP_LIST!")
else:
    print("❌ WP_LIST not found")

APP_PATH.write_text(content, encoding="utf-8")
print("\n✅ Selesai!")
