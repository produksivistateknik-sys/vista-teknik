from pathlib import Path

APP_PATH = Path(r"C:\Users\User\vista-teknik\src\App.tsx")
content = APP_PATH.read_text(encoding="utf-8")

fixes = [
    # Landing page - minHeight 100vh + width 100%
    (
        '<div style={{minHeight:"100vh",background:"#f8fafc",fontFamily:"\'Plus Jakarta Sans\',sans-serif"}}>',
        '<div style={{minHeight:"100vh",width:"100%",background:"#f8fafc",fontFamily:"\'Plus Jakarta Sans\',sans-serif"}}>'
    ),
    # Login page - minHeight 100vh + width 100%
    (
        '<div style={{minHeight:"100vh",display:"flex",background:"#f1f5f9"}}>',
        '<div style={{minHeight:"100vh",width:"100%",display:"flex",background:"#f1f5f9"}}>'
    ),
    # Root html/body fix di GCss
    (
        '*{box-sizing:border-box;margin:0;padding:0}',
        '*{box-sizing:border-box;margin:0;padding:0}html,body,#root{width:100%;height:100%;overflow-x:hidden}'
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
print(f"\n✅ Selesai! {count}/{len(fixes)} fix.")
