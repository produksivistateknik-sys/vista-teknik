from pathlib import Path

APP_PATH = Path(r"C:\Users\User\vista-teknik\src\App.tsx")
content = APP_PATH.read_text(encoding="utf-8")

# Ganti ctrlKey/metaKey dengan altKey untuk multi-select
fixes = [
    # TD onClick
    ('onClick={(e:any)=>{e.stopPropagation();handleCellClick(row.id,d,e);}}',
     'onClick={(e:any)=>{e.stopPropagation();handleCellClick(row.id,d,e);}}'),
    
    # handleCellClick - ganti ctrlKey dengan altKey
    ('} else if(e.ctrlKey||e.metaKey){\n      // Ctrl+klik = toggle individual cell (multi select tidak berurutan)\n      setSelectedCells(prev=>{\n        const exists=prev.some((c:any)=>c.rawId===rawId&&c.date===date);\n        return exists?prev.filter((c:any)=>!(c.rawId===rawId&&c.date===date)):[...prev,{rawId,date}];\n      });\n      setLastSelected({rawId,date});',
     '} else if(e.altKey){\n      // Alt+klik = toggle individual cell (multi select tidak berurutan)\n      setSelectedCells(prev=>{\n        const exists=prev.some((c:any)=>c.rawId===rawId&&c.date===date);\n        return exists?prev.filter((c:any)=>!(c.rawId===rawId&&c.date===date)):[...prev,{rawId,date}];\n      });\n      setLastSelected({rawId,date});'),
]

count = 0
for old, new in fixes:
    if old != new and old in content:
        content = content.replace(old, new)
        print(f"✅ Fixed: {old[:50]}")
        count += 1

# Update TD onClick untuk include altKey
old_td = 'onClick={(e:any)=>{e.stopPropagation();handleCellClick(row.id,d,e);}}'
# Sudah benar - semua event diforward ke handleCellClick

# Update info bar text
old_info = 'tekan <kbd style={{background:"#dbeafe",borderRadius:3,padding:"1px 5px"}}>Ctrl+C</kbd> untuk copy'
new_info = 'tekan <kbd style={{background:"#dbeafe",borderRadius:3,padding:"1px 5px"}}>Ctrl+C</kbd> untuk copy — Alt+klik untuk pilih loncat'

if old_info in content:
    content = content.replace(old_info, new_info)
    print("✅ Info bar updated")
    count += 1

APP_PATH.write_text(content, encoding="utf-8")
print(f"\n✅ {count} fixes! Sekarang pakai Alt+klik untuk multi-select")
