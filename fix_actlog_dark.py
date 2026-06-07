from pathlib import Path

APP_PATH = Path(r"C:\Users\User\vista-teknik\src\App.tsx")
content = APP_PATH.read_text(encoding="utf-8")

# Fix text colors di activity log rows
fixes = [
    ('color:"#1a1d23",marginBottom:3', 'color:"var(--text-primary,#1a1d23)",marginBottom:3'),
    ('style={{background:"#fff",border:"0.5px solid #e5e8ed",borderRadius:8,padding:"10px 12p',
     'style={{background:"var(--card-bg,#fff)",border:"0.5px solid var(--border-color,#e5e8ed)",borderRadius:8,padding:"10px 12p'),
    ('style={{background:"#fff",border:"0.5px solid #e5e8ed",borderRadius:8,marginBottom:10,overflow:',
     'style={{background:"var(--card-bg,#fff)",border:"0.5px solid var(--border-color,#e5e8ed)",borderRadius:8,marginBottom:10,overflow:'),
    ('background:"#f8f9fb",color:"#6b7280"', 'background:"var(--bg-secondary,#f8f9fb)",color:"var(--text-muted,#6b7280)"'),
    ('onMouseEnter={e=>e.currentTarget.style.background="#f8f9fb"}', 'onMouseEnter={e=>e.currentTarget.style.background="var(--bg-secondary,#f8f9fb)"}'),
    ('borderBottom:i<filtered.length-1?"0.5px solid #f0f2f5":"none"', 'borderBottom:i<filtered.length-1?"0.5px solid var(--border-light,#f0f2f5)":"none"'),
]

count = 0
for old, new in fixes:
    if old in content:
        content = content.replace(old, new)
        print(f"✅ Fixed: {old[:50]}...")
        count += 1
    else:
        print(f"⚠️  Not found: {old[:50]}...")

APP_PATH.write_text(content, encoding="utf-8")
print(f"\n✅ {count} fixes applied!")
