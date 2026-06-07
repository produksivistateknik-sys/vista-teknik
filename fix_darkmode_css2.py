from pathlib import Path

APP_PATH = Path(r"C:\Users\User\vista-teknik\src\App.tsx")
content = APP_PATH.read_text(encoding="utf-8")

old = """/* Scrollbar */
[data-theme="dark"] ::-webkit-scrollbar-track{background:var(--bg-secondary)}
[data-theme="dark"] ::-webkit-scrollbar-thumb{background:#3d4468}"""

new = """/* Scrollbar */
[data-theme="dark"] ::-webkit-scrollbar-track{background:var(--bg-secondary)}
[data-theme="dark"] ::-webkit-scrollbar-thumb{background:#3d4468}

/* Force all white/light backgrounds to dark */
[data-theme="dark"] *[style*="background:#fff"]{background:#1a1d27!important}
[data-theme="dark"] *[style*="background: #fff"]{background:#1a1d27!important}
[data-theme="dark"] *[style*="background:#ffffff"]{background:#1a1d27!important}
[data-theme="dark"] *[style*="background:#f8fafc"]{background:#1e2130!important}
[data-theme="dark"] *[style*="background:#f1f5f9"]{background:#222536!important}
[data-theme="dark"] *[style*="background:#f9fafb"]{background:#1e2130!important}
[data-theme="dark"] *[style*="background:#fafafa"]{background:#1e2130!important}
[data-theme="dark"] *[style*="background:#f0f2f5"]{background:#16181f!important}
[data-theme="dark"] *[style*="background:white"]{background:#1a1d27!important}
[data-theme="dark"] *[style*="background:rgb(255"]{background:#1a1d27!important}

/* Force text colors */
[data-theme="dark"] *[style*="color:#1e293b"]{color:#e2e8f0!important}
[data-theme="dark"] *[style*="color:#0f172a"]{color:#e2e8f0!important}
[data-theme="dark"] *[style*="color:#1a202c"]{color:#e2e8f0!important}
[data-theme="dark"] *[style*="color:#334155"]{color:#cbd5e1!important}
[data-theme="dark"] *[style*="color:#374151"]{color:#cbd5e1!important}
[data-theme="dark"] *[style*="color:#111827"]{color:#e2e8f0!important}

/* Force border colors */
[data-theme="dark"] *[style*="border:1px solid #e2e8f0"]{border-color:#2d3148!important}
[data-theme="dark"] *[style*="border-bottom:1px solid #e2e8f0"]{border-bottom-color:#2d3148!important}
[data-theme="dark"] *[style*="border-top:1px solid #e2e8f0"]{border-top-color:#2d3148!important}
[data-theme="dark"] *[style*="border:0.5px solid #e2e8f0"]{border-color:#2d3148!important}
[data-theme="dark"] *[style*="borderColor:#e2e8f0"]{border-color:#2d3148!important}
[data-theme="dark"] *[style*="border:1px solid #f1f5f9"]{border-color:#1e2130!important}
[data-theme="dark"] *[style*="borderBottom:1px solid #f1f5f9"]{border-bottom-color:#1e2130!important}

/* Modal overlay */
[data-theme="dark"] *[style*="position:fixed"][style*="background:rgba(0"]{background:rgba(0,0,0,0.7)!important}
[data-theme="dark"] *[style*="background:#fff"][style*="borderRadius"]{background:#1a1d27!important}

/* Notification panel */
[data-theme="dark"] *[data-notif-panel]{background:#1a1d27!important;border-color:#2d3148!important}

/* Box shadows */
[data-theme="dark"] *[style*="boxShadow"]{box-shadow:0 4px 24px #00000040!important}"""

if old in content:
    content = content.replace(old, new)
    APP_PATH.write_text(content, encoding="utf-8")
    print("✅ Dark mode CSS v2 added!")
else:
    print("❌ Not found!")
