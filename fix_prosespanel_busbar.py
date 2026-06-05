from pathlib import Path

APP_PATH = Path(r"C:\Users\User\vista-teknik\src\App.tsx")
content = APP_PATH.read_text(encoding="utf-8")

old = "        const prosesPanel=PROSES_LIST.filter(pr=>p.pd[pr]!==undefined&&p.pd[pr]>=0);"
new = """        const prosesPanel=PROSES_LIST.filter(pr=>{
          if(pr==="BUSBAR") return p.pd[pr]>=0||(p.busbar_progress&&Object.keys(p.busbar_progress).length>0);
          return p.pd[pr]!==undefined&&p.pd[pr]>=0;
        });"""

if old in content:
    content = content.replace(old, new)
    APP_PATH.write_text(content, encoding="utf-8")
    print("✅ prosesPanel updated to include BUSBAR!")
else:
    print("❌ Not found!")
