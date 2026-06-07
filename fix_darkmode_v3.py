from pathlib import Path

APP_PATH = Path(r"C:\Users\User\vista-teknik\src\App.tsx")
content = APP_PATH.read_text(encoding="utf-8")

fixes = 0

# Fix 1: Dashboard stat cards - cari semua variasi
replacements = [
    # Stats card background
    ('background:"#fff",border:"1px solid #eaecf0",borderRadius:8,padding:"12px 14px"',
     'background:"var(--card-bg,#fff)",border:"1px solid var(--border-color,#eaecf0)",borderRadius:8,padding:"12px 14px"'),
    # Table/container backgrounds  
    ('background:"#fff",border:"1px solid #eaecf0",borderRadius:8,overflow:"hidden"',
     'background:"var(--card-bg,#fff)",border:"1px solid var(--border-color,#eaecf0)",borderRadius:8,overflow:"hidden"'),
    ('background:"#fff",borderRadius:8,border:"1px solid #eaecf0"',
     'background:"var(--card-bg,#fff)",borderRadius:8,border:"1px solid var(--border-color,#eaecf0)"'),
    ('background:"#fff",borderRadius:10,border:"1px solid #e2e8f0"',
     'background:"var(--card-bg,#fff)",borderRadius:10,border:"1px solid var(--border-color,#e2e8f0)"'),
    ('background:"#fff",borderRadius:12,border:"1px solid #e2e8f0"',
     'background:"var(--card-bg,#fff)",borderRadius:12,border:"1px solid var(--border-color,#e2e8f0)"'),
    # Separator/divider backgrounds
    ('background:"#f8fafc",borderBottom:"1px solid #e2e8f0"',
     'background:"var(--bg-secondary,#f8fafc)",borderBottom:"1px solid var(--border-color,#e2e8f0)"'),
    ('background:"#f8fafc",borderTop:"1px solid #e2e8f0"',
     'background:"var(--bg-secondary,#f8fafc)",borderTop:"1px solid var(--border-color,#e2e8f0)"'),
]

for old, new in replacements:
    count = content.count(old)
    if count > 0:
        content = content.replace(old, new)
        print(f"✅ Fixed {count}x: {old[:50]}...")
        fixes += count

# Fix 2: Activity Log text colors
old_act = 'color:"#1e293b"}}>{l.user_name}'
new_act = 'color:"var(--text-primary,#1e293b)"}}>{l.user_name}'
if old_act in content:
    content = content.replace(old_act, new_act)
    print("✅ Activity log username color fixed")

# Fix activity log row backgrounds
old_act2 = 'background:i%2===0?"#fff":"#f8fafc"'
new_act2 = 'background:i%2===0?"var(--card-bg,#fff)":"var(--bg-secondary,#f8fafc)"'
count2 = content.count(old_act2)
if count2 > 0:
    content = content.replace(old_act2, new_act2)
    print(f"✅ Activity log row bg fixed ({count2}x)")

# Fix 3: Tambah CSS untuk text di dark mode
old_css = '[data-theme="dark"] .erp-card{background:#1a1d27!important;border-color:#2d3148!important;color:#e2e8f0!important}'
new_css = '[data-theme="dark"] .erp-card{background:#1a1d27!important;border-color:#2d3148!important;color:#e2e8f0!important}\n[data-theme="dark"] *{color:inherit}'

if old_css in content:
    content = content.replace(old_css, new_css)
    print("✅ Global color inherit added")

print(f"\nTotal fixes: {fixes}")
APP_PATH.write_text(content, encoding="utf-8")
print("✅ Selesai!")
