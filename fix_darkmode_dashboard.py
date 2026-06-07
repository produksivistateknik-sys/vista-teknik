from pathlib import Path

APP_PATH = Path(r"C:\Users\User\vista-teknik\src\App.tsx")
content = APP_PATH.read_text(encoding="utf-8")

# Fix stat cards
old1 = '          <div key={i} style={{background:"#fff",border:"1px solid #eaecf0",borderRadius:8,padding:"12px 14px"}}>'
new1 = '          <div key={i} style={{background:"var(--card-bg,#fff)",border:"1px solid var(--border-color,#eaecf0)",borderRadius:8,padding:"12px 14px"}}>'

if old1 in content:
    content = content.replace(old1, new1)
    print("✅ Stat cards fixed")
else:
    print("❌ Stat cards not found")

# Fix table card
old2 = '      <div style={{background:"#fff",border:"1px solid #eaecf0",borderRadius:8,overflow:"hidden"}}>'
new2 = '      <div style={{background:"var(--card-bg,#fff)",border:"1px solid var(--border-color,#eaecf0)",borderRadius:8,overflow:"hidden"}}>'

count = content.count(old2)
if count > 0:
    content = content.replace(old2, new2)
    print(f"✅ Table cards fixed ({count} instances)")
else:
    print("❌ Table card not found")

# Fix border bottom tabs
old3 = 'style={{display:"flex",borderBottom:"1px solid #eaecf0",padding:"0 5px"}}'
new3 = 'style={{display:"flex",borderBottom:"1px solid var(--border-color,#eaecf0)",padding:"0 5px",background:"var(--card-bg,#fff)"}}'

count3 = content.count(old3)
if count3 > 0:
    content = content.replace(old3, new3)
    print(f"✅ Tab borders fixed ({count3} instances)")
else:
    print("❌ Tab border not found")

# Fix background:#f8fafc sections
old4 = 'style={{background:"#f8fafc",border:"1px solid #eaecf0"'
new4 = 'style={{background:"var(--bg-secondary,#f8fafc)",border:"1px solid var(--border-color,#eaecf0)"'
count4 = content.count(old4)
if count4 > 0:
    content = content.replace(old4, new4)
    print(f"✅ f8fafc backgrounds fixed ({count4} instances)")

APP_PATH.write_text(content, encoding="utf-8")
print("\n✅ Selesai!")
