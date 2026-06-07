from pathlib import Path

APP_PATH = Path(r"C:\Users\User\vista-teknik\src\App.tsx")
content = APP_PATH.read_text(encoding="utf-8")

old_td = '                        <td key={d} style={{...td,textAlign:"center",padding:"2px",background:isOver?"#eff6ff":d===TODAY?"#eff6ff":isSunday(d)?"#fff1f2":isSelDate&&entries.length?"#f0f9ff":rBg,outline:isOver?"2px dashed #2563eb":"none",borderLeft:d===TODAY?"2px solid #3b82f6":isSunday(d)?"2px solid #fda4af":"none"}}\n'

new_td = '                        <td key={d} onClick={(e:any)=>{if(e.ctrlKey||e.metaKey||e.shiftKey){handleCellClick(row.id,d,e);}}} style={{...td,textAlign:"center",padding:"2px",background:isOver?"#eff6ff":d===TODAY?"#eff6ff":isSunday(d)?"#fff1f2":isSelDate&&entries.length?"#f0f9ff":rBg,outline:isOver?"2px dashed #2563eb":copiedCells.some((c:any)=>c.rawId===row.id&&c.date===d)?"2px dashed #3b82f6":selectedCells.some((c:any)=>c.rawId===row.id&&c.date===d)?"2px solid #2563eb":"none",borderLeft:d===TODAY?"2px solid #3b82f6":isSunday(d)?"2px solid #fda4af":"none"}}\n'

if old_td in content:
    content = content.replace(old_td, new_td)
    print("✅ Cell TD updated!")
else:
    print("❌ Not found!")

# Fix topbar info bar
old_topbar = '      <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:8,flexWrap:"wrap" as const}}>'
new_topbar = """      {(selectedCells.length>0||copiedCells.length>0)&&(
        <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:8,padding:"6px 12px",
          background:"#eff6ff",borderRadius:8,border:"1px solid #bfdbfe",fontSize:11}}>
          {copiedCells.length>0?(
            <span style={{color:"#1d4ed8"}}>📋 {copiedCells.length} cell ter-copy — klik cell tujuan lalu <kbd style={{background:"#dbeafe",borderRadius:3,padding:"1px 5px"}}>Ctrl+V</kbd> untuk paste</span>
          ):(
            <span style={{color:"#1d4ed8"}}>✅ {selectedCells.length} cell dipilih — tekan <kbd style={{background:"#dbeafe",borderRadius:3,padding:"1px 5px"}}>Ctrl+C</kbd> untuk copy</span>
          )}
          <button onClick={()=>{setSelectedCells([]);setCopiedCells([]);}}
            style={{marginLeft:"auto",background:"none",border:"none",cursor:"pointer",color:"#64748b",fontSize:12}}>✕ Batal</button>
        </div>
      )}
      <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:8,flexWrap:"wrap" as const}}>"""

count = content.count(old_topbar)
if count > 0:
    # Ganti hanya yang pertama (di RawSchedule)
    content = content.replace(old_topbar, new_topbar, 1)
    print("✅ Info bar added!")
else:
    print("❌ Topbar not found")

APP_PATH.write_text(content, encoding="utf-8")
print("\n✅ Selesai!")
