from pathlib import Path

APP_PATH = Path(r"C:\Users\User\vista-teknik\src\App.tsx")
content = APP_PATH.read_text(encoding="utf-8")

old = """        const prosesPanel=PROSES_LIST.filter(pr=>{
          if(pr==="BUSBAR") return p.pd[pr]>=0||(p.busbar_progress&&Object.keys(p.busbar_progress).length>0);
          return p.pd[pr]!==undefined&&p.pd[pr]>=0;
        });"""

new = """        const hasBusbar=PANEL_TYPES[p.tipe]?.wps?.some((w:any)=>
          w.items?.some((it:any)=>KOMPONEN_PROSES_MAP[it.kode]?.includes("BUSBAR"))
        )||Object.keys(p.busbar_progress||{}).length>0;
        const prosesPanel=PROSES_LIST.filter(pr=>{
          if(pr==="BUSBAR") return hasBusbar||p.pd[pr]>=0;
          return p.pd[pr]!==undefined&&p.pd[pr]>=0;
        });"""

if old in content:
    content = content.replace(old, new)
    APP_PATH.write_text(content, encoding="utf-8")
    print("✅ BUSBAR always shown for panels with busbar komponen!")
else:
    print("❌ Not found!")
