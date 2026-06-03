from pathlib import Path

APP_PATH = Path(r"C:\Users\User\vista-teknik\src\App.tsx")
content = APP_PATH.read_text(encoding="utf-8")

old = '{...td,textAlign:"center",padding:"2px",background:isOver?"#eff6ff":isSelDate&&entries.length?"#f0f9ff":rBg,outline:isOver?"2px dashed #2563eb":"none"}}'
new = '{...td,textAlign:"center",padding:"2px",background:isOver?"#eff6ff":d===TODAY?"#eff6ff":isSunday(d)?"#fff1f2":isSelDate&&entries.length?"#f0f9ff":rBg,outline:isOver?"2px dashed #2563eb":"none",borderLeft:d===TODAY?"2px solid #3b82f6":isSunday(d)?"2px solid #fda4af":"none"}}'

if old in content:
    content = content.replace(old, new)
    APP_PATH.write_text(content, encoding="utf-8")
    print("✅ Done! Today + Sunday highlight added.")
else:
    print("❌ Not found!")
