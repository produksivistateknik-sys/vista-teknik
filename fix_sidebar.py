from pathlib import Path

APP_PATH = Path(r"C:\Users\User\vista-teknik\src\App.tsx")
content = APP_PATH.read_text(encoding="utf-8")

fixes = [
    # Sidebar background - lebih terang
    ('.erp-sb{width:220px;min-width:220px;height:100vh;background:#1e2330;',
     '.erp-sb{width:220px;min-width:220px;height:100vh;background:#1e3a8a;'),
    # Sidebar header background
    ('.erp-sb-head{height:56px;display:flex;align-items:center;padding:0 16px;gap:10px;overflow:hidden;flex-shrink:0;background:#171b27;border-bottom:1px solid #2d3348}',
     '.erp-sb-head{height:56px;display:flex;align-items:center;padding:0 16px;gap:10px;overflow:hidden;flex-shrink:0;background:#1a3278;border-bottom:1px solid #2d4ba0}'),
    # Sidebar footer background
    ('.erp-sb-foot{padding:10px 12px;border-top:1px solid #2d3348;display:flex;align-items:center;gap:10px;overflow:hidden;flex-shrink:0;background:#171b27}',
     '.erp-sb-foot{padding:10px 12px;border-top:1px solid #2d4ba0;display:flex;align-items:center;gap:10px;overflow:hidden;flex-shrink:0;background:#1a3278}'),
    # Nav item hover
    ('.erp-nav-item:hover{background:#252b3d;color:#c8d0e8}',
     '.erp-nav-item:hover{background:#2d4ba0;color:#fff}'),
    # Nav item active
    ('.erp-nav-item.active{background:#2d3a6b;color:#7b9cff;font-weight:500}',
     '.erp-nav-item.active{background:#1d4ed8;color:#fff;font-weight:500}'),
    # Nav group text color
    ('.erp-nav-grp{font-size:9px;font-weight:600;color:#4a5270;',
     '.erp-nav-grp{font-size:9px;font-weight:600;color:#93c5fd;'),
    # Nav item default color
    ('.erp-nav-item{display:flex;align-items:center;gap:9px;padding:7px 10px;margin:1px 6px;border-radius:6px;cursor:pointer;color:#8892b0;',
     '.erp-nav-item{display:flex;align-items:center;gap:9px;padding:7px 10px;margin:1px 6px;border-radius:6px;cursor:pointer;color:#bfdbfe;'),
    # Collapsed icon center - fix padding
    ('.erp-sb.col .erp-nav-item{padding:9px 0;margin:1px 0;border-radius:0;justify-content:center;width:100%;gap:0}',
     '.erp-sb.col .erp-nav-item{padding:9px 0;margin:1px 0;border-radius:0;justify-content:center;width:100%;gap:0;display:flex;align-items:center}'),
    # Logo background
    ('.erp-logo{width:30px;height:30px;min-width:30px;background:#3b5bdb;border-radius:6px;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:13px;flex-shrink:0}',
     '.erp-logo{width:30px;height:30px;min-width:30px;background:#1d4ed8;border-radius:6px;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:13px;flex-shrink:0}'),
    # Nav scroll background
    ('.erp-nav::-webkit-scrollbar-thumb{background:#2d3348;border-radius:2px}',
     '.erp-nav::-webkit-scrollbar-thumb{background:#2d4ba0;border-radius:2px}'),
    # Brand name color
    ('.erp-brand-name{font-weight:600;font-size:12px;color:#f1f3f9;line-height:1.2;letter-spacing:.2px}',
     '.erp-brand-name{font-weight:600;font-size:12px;color:#fff;line-height:1.2;letter-spacing:.2px}'),
    # Brand sub color
    ('.erp-brand-sub{font-size:9px;color:#6b7694;',
     '.erp-brand-sub{font-size:9px;color:#93c5fd;'),
    # Footer name color
    ('.erp-foot-name{font-size:11.5px;font-weight:600;color:#c8d0e8;',
     '.erp-foot-name{font-size:11.5px;font-weight:600;color:#fff;'),
    # Footer role color
    ('.erp-foot-role{font-size:9.5px;color:#4a5270;',
     '.erp-foot-role{font-size:9.5px;color:#93c5fd;'),
    # Footer avatar
    ('.erp-foot-av{width:28px;height:28px;min-width:28px;border-radius:6px;background:#2d3a6b;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:600;color:#7b9cff;flex-shrink:0;border:1px solid #3d4f8a}',
     '.erp-foot-av{width:28px;height:28px;min-width:28px;border-radius:6px;background:#1d4ed8;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:600;color:#fff;flex-shrink:0;border:1px solid #3b82f6}'),
]

count = 0
for old, new in fixes:
    if old in content:
        content = content.replace(old, new)
        count += 1
        print(f"✅ {old[:55]}...")
    else:
        print(f"⚠️  Not found: {old[:55]}...")

APP_PATH.write_text(content, encoding="utf-8")
print(f"\n✅ Selesai! {count}/{len(fixes)} fix.")
