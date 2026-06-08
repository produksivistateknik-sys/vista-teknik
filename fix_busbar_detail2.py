from pathlib import Path

APP_PATH = Path(r"C:\Users\User\vista-teknik\src\App.tsx")
content = APP_PATH.read_text(encoding="utf-8")

old = """        const hasBusbar=PANEL_TYPES[p.tipe]?.wps?.some((w:any)=>
          w.items?.some((it:any)=>KOMPONEN_PROSES_MAP[it.kode]?.includes("BUSBAR"))
        )||Object.keys(p.busbar_progress||{}).length>0;
        const prosesPanel=PROSES_LIST.filter(pr=>{
          if(pr==="BUSBAR") return hasBusbar||p.pd[pr]>=0;
          return p.pd[pr]!==undefined&&p.pd[pr]>=0;
        });"""

new = """        // Tampilkan BUSBAR jika tipe panel punya komponen busbar (WM) atau ada progress
        const BUSBAR_TIPE=["WM_MS","WM_POLY","FS","F3B"];
        const hasBusbar=BUSBAR_TIPE.includes(p.tipe)||Object.keys(p.busbar_progress||{}).length>0;
        const prosesPanel=PROSES_LIST.filter(pr=>{
          if(pr==="BUSBAR") return hasBusbar;
          return p.pd[pr]!==undefined&&p.pd[pr]>=0;
        });"""

if old in content:
    content = content.replace(old, new)
    APP_PATH.write_text(content, encoding="utf-8")
    print("✅ Fixed!")
else:
    print("❌ Not found!")
    # debug
    lines = content.splitlines()
    for i, l in enumerate(lines[2990:3000], 2991):
        print(f"  {i}: {l}")
