from pathlib import Path

APP_PATH = Path(r"C:\Users\User\vista-teknik\src\App.tsx")
content = APP_PATH.read_text(encoding="utf-8")

# Fix 1: Hapus duplikat onClick di div entries (baris 3686)
old1 = '                             onClick={(e:any)=>handleCellClick(row.id,d,e)}\n                              onContextMenu={(e:any)=>handleContextMenu(row.id,d,e)}'
new1 = '                              onContextMenu={(e:any)=>handleContextMenu(row.id,d,e)}'

if old1 in content:
    content = content.replace(old1, new1)
    print("✅ Duplicate onClick removed from entries div")
else:
    # try alternate
    old1b = '                              onClick={(e:any)=>handleCellClick(row.id,d,e)}\n                              onContextMenu={(e:any)=>handleContextMenu(row.id,d,e)}'
    if old1b in content:
        content = content.replace(old1b, '                              onContextMenu={(e:any)=>handleContextMenu(row.id,d,e)}')
        print("✅ Fixed (variant b)")
    else:
        print("⚠️  Variant not found - trying line replace")
        lines = content.splitlines()
        for i, l in enumerate(lines):
            if 'onClick={(e:any)=>handleCellClick(row.id,d,e)}' in l and 'onContextMenu' not in l and 'draggable' not in lines[i-1]:
                lines[i] = lines[i].replace('onClick={(e:any)=>handleCellClick(row.id,d,e)}', '')
                print(f"✅ Removed onClick from line {i+1}")
                break
        content = '\n'.join(lines)

# Fix 2: Update empty cell div - hapus semua conditional, forward ke td
old2 = '                            <div onClick={(e:any)=>{if(e.shiftKey||e.ctrlKey||e.metaKey){handleCellClick(row.id,d,e);return;}openCellModal(row.id,d);}}'
new2 = '                            <div onContextMenu={(e:any)=>handleContextMenu(row.id,d,e)}'

if old2 in content:
    content = content.replace(old2, new2)
    print("✅ Empty cell div onClick removed")
else:
    print("⚠️  Empty cell div not found")
    lines = content.splitlines()
    for i, l in enumerate(lines):
        if 'onClick={(e:any)=>{if(e.shiftKey||e.ctrlKey' in l and 'openCellModal' in l:
            print(f"  Found at {i+1}: {l.strip()[:80]}")

APP_PATH.write_text(content, encoding="utf-8")
print("\n✅ Selesai!")
