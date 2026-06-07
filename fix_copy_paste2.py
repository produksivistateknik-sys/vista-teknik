from pathlib import Path

APP_PATH = Path(r"C:\Users\User\vista-teknik\src\App.tsx")
content = APP_PATH.read_text(encoding="utf-8")

# Cari openCellModal call di cell click
old_cell_open = """                        <div onClick={()=>openCellModal(row.id,d)}"""
new_cell_open = """                        <div onClick={(e:any)=>{if(e.shiftKey||e.ctrlKey||e.metaKey){handleCellClick(row.id,d,e);return;}openCellModal(row.id,d);}}"""

count = content.count(old_cell_open)
if count > 0:
    content = content.replace(old_cell_open, new_cell_open)
    print(f"✅ Cell open modal fixed ({count}x)")
else:
    print("❌ Not found")
    # cari alternatif
    lines = content.splitlines()
    for i, l in enumerate(lines[3600:3640], 3601):
        if 'openCellModal' in l:
            print(f"  {i}: {l.strip()[:80]}")

# Fix paste - saat Ctrl+klik pada cell yang sudah ada entries
# Jika ada copiedCells, Ctrl+klik = paste
old_handle = """  const handleCellClick=(rawId:number,date:string,e:React.MouseEvent)=>{
    if(e.shiftKey&&lastSelected){"""

new_handle = """  const handleCellClick=(rawId:number,date:string,e:React.MouseEvent)=>{
    // Jika ada copied cells dan Ctrl+klik → paste
    if((e.ctrlKey||e.metaKey)&&!e.shiftKey&&copiedCells.length>0){
      pasteToCell(rawId,date);
      return;
    }
    if(e.shiftKey&&lastSelected){"""

if old_handle in content:
    content = content.replace(old_handle, new_handle)
    print("✅ Ctrl+click paste added")
else:
    print("❌ handleCellClick not found")

APP_PATH.write_text(content, encoding="utf-8")
print("\n✅ Selesai!")
