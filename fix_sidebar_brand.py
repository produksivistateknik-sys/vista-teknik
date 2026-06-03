from pathlib import Path

APP_PATH = Path(r"C:\Users\User\vista-teknik\src\App.tsx")
content = APP_PATH.read_text(encoding="utf-8")

fixes = [
    # Brand name - lebih besar, huruf besar semua
    (
        '.erp-brand-name{font-weight:600;font-size:12px;color:#fff;line-height:1.2;letter-spacing:.2px}',
        '.erp-brand-name{font-weight:800;font-size:14px;color:#fff;line-height:1.2;letter-spacing:1px;text-transform:uppercase}'
    ),
    # Hapus brand sub (subtitle)
    (
        '.erp-brand-sub{font-size:9px;color:#93c5fd;',
        '.erp-brand-sub{font-size:9px;color:#93c5fd;display:none;'
    ),
]

count = 0
for old, new in fixes:
    if old in content:
        content = content.replace(old, new)
        count += 1
        print(f"✅ Fixed: {old[:60]}...")
    else:
        print(f"⚠️  Not found: {old[:60]}...")

APP_PATH.write_text(content, encoding="utf-8")
print(f"\n✅ Selesai! {count}/2 fix.")
