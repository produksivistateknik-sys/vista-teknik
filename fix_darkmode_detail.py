from pathlib import Path

APP_PATH = Path(r"C:\Users\User\vista-teknik\src\App.tsx")
content = APP_PATH.read_text(encoding="utf-8")

fixes = [
    # WO card container
    ('background:"#fff",border:"1px solid #eaecf0",borderTop:"3px solid "+s',
     'background:"var(--card-bg,#fff)",border:"1px solid var(--border-color,#eaecf0)",borderTop:"3px solid "+s'),
    # Filter area
    ('background:"#fff",border:"1px solid #eaecf0",borderRadius:8,padding:"10px 13p',
     'background:"var(--card-bg,#fff)",border:"1px solid var(--border-color,#eaecf0)",borderRadius:8,padding:"10px 13p'),
    # Input styles
    ('fontSize:11,background:"#f8fafc",outline:"none",color:"#1e293b"',
     'fontSize:11,background:"var(--input-bg,#f8fafc)",outline:"none",color:"var(--text-primary,#1e293b)"'),
    ('fontSize:11,background:"#f8fafc",outline:"none",color:"#475569",cursor:"pointer",fontFamil',
     'fontSize:11,background:"var(--input-bg,#f8fafc)",outline:"none",color:"var(--text-secondary,#475569)",cursor:"pointer",fontFamil'),
    # Empty state
    ('background:"#fff",border:"1px solid #eaecf0",borderRadius:8,padding:"40px",te',
     'background:"var(--card-bg,#fff)",border:"1px solid var(--border-color,#eaecf0)",borderRadius:8,padding:"40px",te'),
    # Panel card
    ('background:"#fff",border:"1px solid #eaecf0",\n        borderRadius',
     'background:"var(--card-bg,#fff)",border:"1px solid var(--border-color,#eaecf0)",\n        borderRadius'),
    # Badge f1f5f9
    ('padding:"2px 8px",background:"#f1f5f9",borderRad',
     'padding:"2px 8px",background:"var(--bg-tertiary,#f1f5f9)",borderRad'),
]

count = 0
for old, new in fixes:
    if old in content:
        content = content.replace(old, new)
        print(f"✅ {old[:50]}...")
        count += 1
    else:
        print(f"⚠️  {old[:50]}...")

# Fix WP row backgrounds
old_wp = 'const rowBg=wp.wp==="WP1"?"#fffbeb":wp.wp==="WP2"?"#f0fdf4":wp.wp==="WP3"?"#eff6ff":wp.wp='
new_wp = 'const rowBg=wp.wp==="WP1"?"var(--wp1-bg,#fffbeb)":wp.wp==="WP2"?"var(--wp2-bg,#f0fdf4)":wp.wp==="WP3"?"var(--wp3-bg,#eff6ff)":wp.wp='
if old_wp in content:
    content = content.replace(old_wp, new_wp)
    print("✅ WP row backgrounds fixed")
    count += 1

APP_PATH.write_text(content, encoding="utf-8")
print(f"\n✅ {count} fixes applied!")
