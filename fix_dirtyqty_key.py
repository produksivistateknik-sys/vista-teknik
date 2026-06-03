from pathlib import Path

APP_PATH = Path(r"C:\Users\User\vista-teknik\src\App.tsx")
content = APP_PATH.read_text(encoding="utf-8")

# Fix: gunakan String(panelId) dan String(p.id) agar key konsisten
old1 = "return{...prev,[panelId]:JSON.parse(JSON.stringify(panel?.checklist||{}))}"
new1 = "return{...prev,[String(panelId)]:JSON.parse(JSON.stringify(panel?.checklist||{}))}"

old2 = "return{...prev,[panelId]:{...prev[panelId],[kode]:{newQty:nq,oldQty}}};"
new2 = "return{...prev,[String(panelId)]:{...prev[String(panelId)],[kode]:{newQty:nq,oldQty}}};"

old3 = "setWoData(prev=>prev.map(wo=>({...wo,panels:wo.panels.map(p=>p.id!==panelId?p:{...p,checklist:orig})})));\n    setDirtyQty(prev=>{const n={...prev};delete n[panelId];return n;});\n    setOrigChecklist(prev=>{const n={...prev};delete n[panelId];return n;});"
new3 = "setWoData(prev=>prev.map(wo=>({...wo,panels:wo.panels.map(p=>p.id!==panelId?p:{...p,checklist:orig})})));\n    setDirtyQty(prev=>{const n={...prev};delete n[String(panelId)];return n;});\n    setOrigChecklist(prev=>{const n={...prev};delete n[String(panelId)];return n;});"

old4 = "{dirtyQty[p.id]&&Object.keys(dirtyQty[p.id]).length>0&&("
new4 = "{dirtyQty[String(p.id)]&&Object.keys(dirtyQty[String(p.id)]).length>0&&("

old5 = "<button onClick={()=>cancelQtyEdit(p.id)}"
new5 = "<button onClick={()=>cancelQtyEdit(String(p.id))}"

old6 = "<button onClick={()=>saveQtyEdit(wo,p.id)}"
new6 = "<button onClick={()=>saveQtyEdit(wo,String(p.id))}"

old7 = "if(prev[panelId])return prev;"
new7 = "if(prev[String(panelId)])return prev;"

fixes = [
    (old1, new1, "origChecklist key"),
    (old2, new2, "dirtyQty key"),
    (old3, new3, "cancel delete key"),
    (old4, new4, "button condition key"),
    (old5, new5, "cancel button key"),
    (old6, new6, "save button key"),
    (old7, new7, "orig check key"),
]

count = 0
for old, new, label in fixes:
    if old in content:
        content = content.replace(old, new)
        count += 1
        print(f"✅ {label}")
    else:
        print(f"⚠️  Not found: {label}")

# Fix saveQtyEdit juga
old_save = "const dirty=dirtyQty[panelId]||{};"
new_save = "const dirty=dirtyQty[String(panelId)]||{};"
old_save2 = "setDirtyQty(prev=>{const n={...prev};delete n[panelId];return n;});\n    setOrigChecklist(prev=>{const n={...prev};delete n[panelId];return n;});"
new_save2 = "setDirtyQty(prev=>{const n={...prev};delete n[String(panelId)];return n;});\n    setOrigChecklist(prev=>{const n={...prev};delete n[String(panelId)];return n;});"

for old, new, label in [(old_save, new_save, "dirty key in save"), (old_save2, new_save2, "save delete key")]:
    if old in content:
        content = content.replace(old, new)
        count += 1
        print(f"✅ {label}")
    else:
        print(f"⚠️  Not found: {label}")

APP_PATH.write_text(content, encoding="utf-8")
print(f"\n✅ Selesai! {count} fix diterapkan.")
