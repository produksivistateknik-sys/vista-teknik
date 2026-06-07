from pathlib import Path

APP_PATH = Path(r"C:\Users\User\vista-teknik\src\App.tsx")
content = APP_PATH.read_text(encoding="utf-8")

old = """      )}\n    </div>\n  );\n}\n\n\nfunction ManajemenWO("""
new = """      )}
    {/* Context Menu */}
    {ctxMenu&&(
      <>
        <div style={{position:"fixed",inset:0,zIndex:9998}} onClick={()=>setCtxMenu(null)}/>
        <div style={{position:"fixed",left:ctxMenu.x,top:ctxMenu.y,zIndex:9999,
          background:"var(--card-bg,#fff)",border:"1px solid var(--border-color,#e2e8f0)",borderRadius:8,
          boxShadow:"0 4px 16px #00000020",padding:"4px 0",minWidth:180}}>
          {selectedCells.length>0&&copiedCells.length===0&&(
            <button onClick={()=>{copySelected();setCtxMenu(null);}}
              style={{display:"flex",alignItems:"center",gap:8,width:"100%",padding:"8px 14px",
                border:"none",background:"none",cursor:"pointer",fontSize:12,color:"var(--text-primary,#1e293b)",textAlign:"left" as const}}
              onMouseEnter={(e:any)=>e.currentTarget.style.background="var(--bg-secondary,#f8fafc)"}
              onMouseLeave={(e:any)=>e.currentTarget.style.background="none"}>
              📋 Copy ({selectedCells.length} cell dipilih)
            </button>
          )}
          {copiedCells.length>0&&(
            <button onClick={()=>{pasteToCell(ctxMenu.rawId,ctxMenu.date);setCtxMenu(null);}}
              style={{display:"flex",alignItems:"center",gap:8,width:"100%",padding:"8px 14px",
                border:"none",background:"none",cursor:"pointer",fontSize:12,color:"#1d4ed8",textAlign:"left" as const}}
              onMouseEnter={(e:any)=>e.currentTarget.style.background="#eff6ff"}
              onMouseLeave={(e:any)=>e.currentTarget.style.background="none"}>
              📌 Paste di sini ({copiedCells.length} cell)
            </button>
          )}
          {selectedCells.length===0&&copiedCells.length===0&&(
            <button onClick={()=>{openCellModal(ctxMenu.rawId,ctxMenu.date);setCtxMenu(null);}}
              style={{display:"flex",alignItems:"center",gap:8,width:"100%",padding:"8px 14px",
                border:"none",background:"none",cursor:"pointer",fontSize:12,color:"var(--text-primary,#1e293b)",textAlign:"left" as const}}
              onMouseEnter={(e:any)=>e.currentTarget.style.background="var(--bg-secondary,#f8fafc)"}
              onMouseLeave={(e:any)=>e.currentTarget.style.background="none"}>
              ✏️ Edit Jadwal
            </button>
          )}
          <div style={{borderTop:"1px solid var(--border-light,#f1f5f9)",margin:"4px 0"}}/>
          <button onClick={()=>{setSelectedCells([]);setCopiedCells([]);setCtxMenu(null);}}
            style={{display:"flex",alignItems:"center",gap:8,width:"100%",padding:"8px 14px",
              border:"none",background:"none",cursor:"pointer",fontSize:12,color:"#94a3b8",textAlign:"left" as const}}
            onMouseEnter={(e:any)=>e.currentTarget.style.background="var(--bg-secondary,#f8fafc)"}
            onMouseLeave={(e:any)=>e.currentTarget.style.background="none"}>
            ✕ Tutup
          </button>
        </div>
      </>
    )}
    </div>
  );
}


function ManajemenWO("""

if old in content:
    content = content.replace(old, new)
    APP_PATH.write_text(content, encoding="utf-8")
    print("✅ Context menu JSX added!")
else:
    print("❌ Not found!")
    # debug
    lines = content.splitlines()
    for i, l in enumerate(lines[4002:4010], 4003):
        print(f"  {i}: {repr(l)}")
