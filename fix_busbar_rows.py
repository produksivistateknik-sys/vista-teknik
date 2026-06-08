from pathlib import Path

APP_PATH = Path(r"C:\Users\User\vista-teknik\src\App.tsx")
content = APP_PATH.read_text(encoding="utf-8")

old = """                  {/* Busbar rows */}
                  {p.busbar_progress&&Object.keys(p.busbar_progress).length>0&&("""

new = """                  {/* Busbar rows */}
                  {hasBusbar&&(()=>{
                    const busbarKomps=getBusbarKomponen(p.tipe);
                    const busbarData={...Object.fromEntries(busbarKomps.map((k:string)=>[k,0])),...(p.busbar_progress||{})};
                    return Object.keys(busbarData).length>0;
                  })()&&("""

if old in content:
    content = content.replace(old, new)
    print("✅ Busbar rows condition updated!")
else:
    print("❌ Not found!")
    lines = content.splitlines()
    for i, l in enumerate(lines):
        if 'Busbar rows' in l:
            print(f"  {i+1}: {l.strip()[:80]}")
            for j in range(i, min(i+3, len(lines))):
                print(f"  {j+1}: {repr(lines[j])}")

# Fix juga bagian render baris busbar
old_render = """                      {Object.entries(p.busbar_progress).map(([nama,pct]:any)=>("""
new_render = """                      {Object.entries({...Object.fromEntries(getBusbarKomponen(p.tipe).map((k:string)=>[k,0])),...(p.busbar_progress||{})}).map(([nama,pct]:any)=>("""

if old_render in content:
    content = content.replace(old_render, new_render)
    print("✅ Busbar rows render updated!")
else:
    print("❌ Render not found!")

APP_PATH.write_text(content, encoding="utf-8")
