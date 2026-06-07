from pathlib import Path

APP_PATH = Path(r"C:\Users\User\vista-teknik\src\App.tsx")
content = APP_PATH.read_text(encoding="utf-8")

# Cek exact baris
lines = content.splitlines()
for i, l in enumerate(lines[2726:2736], 2727):
    print(f"{i}: {l}")

APP_PATH = Path(r"C:\Users\User\vista-teknik\src\App.tsx")
content = APP_PATH.read_text(encoding="utf-8")

old1 = '<div key={wo.id} style={{background:"#fff",border:"1px solid #eaecf0",'
new1 = '<div key={wo.id} style={{background:"var(--card-bg,#fff)",border:"1px solid var(--border-color,#eaecf0)",'

old2 = 'display:"flex",alignItems:"center",gap:10,flexWrap:"wrap" as const,background:"#fafbfc"}}>'
new2 = 'display:"flex",alignItems:"center",gap:10,flexWrap:"wrap" as const,background:"var(--bg-secondary,#fafbfc)"}}>'

count = 0
for old, new in [(old1,new1),(old2,new2)]:
    c = content.count(old)
    if c > 0:
        content = content.replace(old, new)
        print(f"✅ Fixed {c}x: {old[:50]}")
        count += c
    else:
        print(f"⚠️  Not found: {old[:50]}")

APP_PATH.write_text(content, encoding="utf-8")
print(f"\n✅ {count} fixes!")
