from pathlib import Path

APP_PATH = Path(r"C:\Users\User\vista-teknik\src\App.tsx")
content = APP_PATH.read_text(encoding="utf-8")

fixes = [
    # Fix 1: icon tidak center saat collapse - nav item collapsed
    (
        '.erp-sb.col .erp-nav-item{padding:9px 0;margin:1px 0;border-radius:0;justify-content:center;width:100%;gap:0;display:flex;align-items:center}',
        '.erp-sb.col .erp-nav-item{padding:9px 0;margin:0;border-radius:0;justify-content:center;align-items:center;width:52px;gap:0;display:flex}'
    ),
    # Fix 2: icon size di nav item
    (
        '.erp-nav-item i{font-size:15px;flex-shrink:0;width:17px;text-align:center;color:inherit}',
        '.erp-nav-item i{font-size:15px;flex-shrink:0;width:20px;text-align:center;color:inherit}'
    ),
    # Fix 3: prevent horizontal scroll di body
    (
        'body{background:#f0f2f5;color:#1a1d23;font-family:Inter,sans-serif;font-size:12px;font-weight:400;text-align:left}',
        'body{background:#f0f2f5;color:#1a1d23;font-family:Inter,sans-serif;font-size:12px;font-weight:400;text-align:left;overflow-x:hidden}'
    ),
    # Fix 4: erp-wrap tidak overflow
    (
        '.erp-wrap{display:flex;height:100vh;width:100vw;overflow:hidden;background:#f0f2f5}',
        '.erp-wrap{display:flex;height:100vh;width:100%;max-width:100vw;overflow:hidden;background:#f0f2f5}'
    ),
]

count = 0
for old, new in fixes:
    if old in content:
        content = content.replace(old, new)
        count += 1
        print(f"✅ {old[:60]}...")
    else:
        print(f"⚠️  Not found: {old[:60]}...")

APP_PATH.write_text(content, encoding="utf-8")
print(f"\n✅ Selesai! {count}/{len(fixes)} fix.")
