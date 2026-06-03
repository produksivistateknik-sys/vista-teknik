from pathlib import Path

APP_PATH = Path(r"C:\Users\User\vista-teknik\src\App.tsx")
content = APP_PATH.read_text(encoding="utf-8")

# Fix icon render - tambah display flex agar center
old = '<i className={item.icon} style={{fontSize:16,flexShrink:0,width:20,textAlign:"center",lineHeight:1}}/>'
new = '<i className={item.icon} style={{fontSize:18,flexShrink:0,width:20,display:"flex",alignItems:"center",justifyContent:"center",lineHeight:1}}/>'

if old in content:
    content = content.replace(old, new)
    print("✅ Icon render fixed")
else:
    print("❌ Not found")

# Fix layout gap - hapus width:100vw yang menyebabkan gap
old_wrap = '.erp-wrap{display:flex;height:100vh;width:100%;max-width:100vw;overflow:hidden;background:#f0f2f5}'
new_wrap = '.erp-wrap{display:flex;height:100vh;overflow:hidden;background:#f0f2f5;position:fixed;top:0;left:0;right:0;bottom:0}'

if old_wrap in content:
    content = content.replace(old_wrap, new_wrap)
    print("✅ Layout gap fixed")
else:
    # coba variant lain
    old_wrap2 = '.erp-wrap{display:flex;height:100vh;overflow:hidden;background:#f0f2f5}'
    new_wrap2 = '.erp-wrap{display:flex;height:100vh;overflow:hidden;background:#f0f2f5;position:fixed;top:0;left:0;right:0;bottom:0}'
    if old_wrap2 in content:
        content = content.replace(old_wrap2, new_wrap2)
        print("✅ Layout gap fixed (v2)")
    else:
        print("⚠️  Layout wrap not found")

APP_PATH.write_text(content, encoding="utf-8")
print("\n✅ Selesai!")
