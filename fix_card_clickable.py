file_path = r"C:\Users\User\vista-teknik\src\App.tsx"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

with open(file_path + ".bak_card_click", "w", encoding="utf-8") as f:
    f.write(content)
print("[OK] Backup dibuat")

# 1. Outer div: tambah onClick + cursor pointer
OLD_DIV = """              <div key={gi} style={{padding:"10px 14px",borderRadius:10,marginBottom:8,background:"#fff",border:`1.5px solid ${stColor}40`}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>"""

NEW_DIV = """              <div key={gi} onClick={()=>setExpandedTasks(prev=>({...prev,[cardKey]:!prev[cardKey]}))} style={{padding:"10px 14px",borderRadius:10,marginBottom:8,background:"#fff",border:`1.5px solid ${stColor}40`,cursor:"pointer",userSelect:"none" as "none"}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>"""

# 2. Hapus tombol Detail (ganti dengan chevron icon kecil di ujung)
OLD_BTN = """                    <button onClick={()=>setExpandedTasks(prev=>({...prev,[cardKey]:!prev[cardKey]}))}
                      style={{background:"#f8fafc",border:"1px solid #e2e8f0",color:"#475569",borderRadius:7,padding:"4px 10px",cursor:"pointer",fontSize:11,fontWeight:600,display:"flex",alignItems:"center",gap:4,whiteSpace:"nowrap",flexShrink:0}}>
                      {isExpanded?"\u25b2 Tutup":"\u25bc Detail"}
                    </button>"""

NEW_BTN = """                    <span style={{color:"#94a3b8",fontSize:14,flexShrink:0,marginLeft:4}}>{isExpanded?"\u25b2":"\u25bc"}</span>"""

if OLD_DIV in content and OLD_BTN in content:
    content = content.replace(OLD_DIV, NEW_DIV)
    content = content.replace(OLD_BTN, NEW_BTN)
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)
    print("[OK] Card sekarang bisa diklik seluruhnya, tombol detail dihapus")
    print("[INFO] Jalankan: npm run build")
else:
    print("[FAIL] Pattern tidak cocok")
    print(f"  OLD_DIV: {'FOUND' if OLD_DIV in content else 'MISSING'}")
    print(f"  OLD_BTN: {'FOUND' if OLD_BTN in content else 'MISSING'}")
