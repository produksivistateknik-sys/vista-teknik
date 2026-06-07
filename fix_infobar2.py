from pathlib import Path

APP_PATH = Path(r"C:\Users\User\vista-teknik\src\App.tsx")
content = APP_PATH.read_text(encoding="utf-8")

# Hapus info bar yang salah posisi (di App level)
old = """      {(selectedCells.length>0||copiedCells.length>0)&&(
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
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",m"""

new = """      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",m"""

if old in content:
    content = content.replace(old, new)
    APP_PATH.write_text(content, encoding="utf-8")
    print("✅ Wrong info bar removed!")
else:
    print("❌ Not found!")
