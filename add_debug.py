from pathlib import Path

APP_PATH = Path(r"C:\Users\User\vista-teknik\src\App.tsx")
content = APP_PATH.read_text(encoding="utf-8")

old = "return{...prev,[String(panelId)]:{...prev[String(panelId)],[kode]:{newQty:nq,oldQty}}};"
new = "console.log('DIRTY',String(panelId),kode,nq,oldQty); return{...prev,[String(panelId)]:{...prev[String(panelId)],[kode]:{newQty:nq,oldQty}}};"

if old in content:
    content = content.replace(old, new)
    APP_PATH.write_text(content, encoding="utf-8")
    print("Done! Debug log added.")
else:
    print("Not found!")
    # cari konteks
    lines = content.splitlines()
    for i, l in enumerate(lines[3014:3022], 3015):
        print(f"{i}: {l}")
