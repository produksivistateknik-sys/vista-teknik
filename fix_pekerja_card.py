from pathlib import Path

APP_PATH = Path(r"C:\Users\User\vista-teknik\src\App.tsx")
content = APP_PATH.read_text(encoding="utf-8")

fixes = [
    # Grid card lebih kecil: 240px -> 160px
    (
        '"repeat(auto-fill,minmax(240px,1fr))"',
        '"repeat(auto-fill,minmax(160px,1fr))"'
    ),
    # Icon lebih kecil: 40x40 -> 28x28
    (
        '{width:40,height:40,borderRadius:10,background:dc.bg,display:"flex",\n                alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}',
        '{width:28,height:28,borderRadius:8,background:dc.bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,flexShrink:0}'
    ),
    # Padding card lebih kecil
    (
        'padding:"12px 14px",display:"flex",alignItems:"center",gap:12,',
        'padding:"8px 10px",display:"flex",alignItems:"center",gap:8,'
    ),
    # Font nama pekerja lebih kecil
    (
        '{fontWeight:700,fontSize:13,color:"#1e293b",marginBottom:3}',
        '{fontWeight:700,fontSize:12,color:"#1e293b",marginBottom:2}'
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
print(f"\n✅ Selesai! {count}/{len(fixes)} fix diterapkan.")
