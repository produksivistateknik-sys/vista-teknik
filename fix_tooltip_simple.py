from pathlib import Path

APP_PATH = Path(r"C:\Users\User\vista-teknik\src\App.tsx")
content = APP_PATH.read_text(encoding="utf-8")

# Hapus header tooltip (nama proses + komponen)
old = """              <div style={{fontWeight:700,fontSize:11,marginBottom:6,color:color,borderBottom:"1px solid #334155",paddingBottom:4}}>
                {proses}{nama?" — "+nama:""}
              </div>"""
new = ""

if old in content:
    content = content.replace(old, new)
    APP_PATH.write_text(content, encoding="utf-8")
    print("✅ Tooltip header removed!")
else:
    print("❌ Not found!")
