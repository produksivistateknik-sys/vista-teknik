from pathlib import Path

APP_PATH = Path(r"C:\Users\User\vista-teknik\src\App.tsx")
content = APP_PATH.read_text(encoding="utf-8")

# Cari posisi yang tepat untuk tambah CSS
old = '[data-theme="dark"] .erp-nav-grp{color:#4a5270!important}\n[data-theme="dark"] .erp-topbar-right span{background:var(--bg-tertiary)!important;color:var(--text-secondary)!important}'

new = '[data-theme="dark"] .erp-nav-grp{color:#4a5270!important}\n[data-theme="dark"] .erp-topbar-right span{background:var(--bg-tertiary)!important;color:var(--text-secondary)!important}\n[data-theme="dark"] .erp-card{background:#1a1d27!important;border-color:#2d3148!important;color:#e2e8f0!important}\n[data-theme="dark"] .erp-main{background:#0f1117!important}'

if old in content:
    content = content.replace(old, new)
    APP_PATH.write_text(content, encoding="utf-8")
    print("✅ erp-card CSS added!")
else:
    print("❌ Not found")
    # debug
    lines = content.splitlines()
    for i, l in enumerate(lines[438:445], 439):
        print(f"{i}: {repr(l)}")
