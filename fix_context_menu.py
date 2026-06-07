from pathlib import Path

APP_PATH = Path(r"C:\Users\User\vista-teknik\src\App.tsx")
content = APP_PATH.read_text(encoding="utf-8")

# ── 1. Tambah state context menu ──
old_states = """  const [weekStart,setWeekStart]=useState(TODAY);
  const [selectedCells,setSelectedCells]=useState<{rawId:number,date:string}[]>([]);
  const [copiedCells,setCopiedCells]=useState<{rawId:number,date:string,entries:any[],busbar:string[]}[]>([]);
  const [lastSelected,setLastSelected]=useState<{rawId:number,date:string}|null>(null);"""

new_states = """  const [weekStart,setWeekStart]=useState(TODAY);
  const [selectedCells,setSelectedCells]=useState<{rawId:number,date:string}[]>([]);
  const [copiedCells,setCopiedCells]=useState<{rawId:number,date:string,entries:any[],busbar:string[]}[]>([]);
  const [lastSelected,setLastSelected]=useState<{rawId:number,date:string}|null>(null);
  const [ctxMenu,setCtxMenu]=useState<{x:number,y:number,rawId:number,date:string}|null>(null);"""

if old_states in content:
    content = content.replace(old_states, new_states)
    print("✅ ctxMenu state added")
else:
    print("❌ States not found")

# ── 2. Update handleCellClick untuk klik biasa = select ──
old_handle = """  const handleCellClick=(rawId:number,date:string,e:React.MouseEvent)=>{
    // Jika ada copied cells dan Ctrl+klik → paste
    if((e.ctrlKey||e.metaKey)&&!e.shiftKey&&copiedCells.length>0){
      pasteToCell(rawId,date);
      return;
    }
    if(e.shiftKey&&lastSelected){"""

new_handle = """  const handleCellClick=(rawId:number,date:string,e:React.MouseEvent)=>{
    setCtxMenu(null);
    if(e.shiftKey&&lastSelected){"""

if old_handle in content:
    content = content.replace(old_handle, new_handle)
    print("✅ handleCellClick updated")
else:
    print("❌ handleCellClick not found")

# ── 3. Tambah handleContextMenu ──
old_copy = """  const copySelected=()=>{"""
new_copy = """  const handleContextMenu=(rawId:number,date:string,e:React.MouseEvent)=>{
    e.preventDefault();
    setCtxMenu({x:e.clientX,y:e.clientY,rawId,date});
    // Jika cell belum ter-select, select dulu
    if(!selectedCells.some(c=>c.rawId===rawId&&c.date===date)){
      setSelectedCells([{rawId,date}]);
      setLastSelected({rawId,date});
    }
  };

  const copySelected=()=>{"""

if old_copy in content:
    content = content.replace(old_copy, new_copy)
    print("✅ handleContextMenu added")
else:
    print("❌ copySelected not found")

# ── 4. Update cell onClick - klik biasa = select, tidak buka modal jika ada selection ──
old_cell = '                              onClick={(e:any)=>{if(e.shiftKey||e.ctrlKey||e.metaKey){handleCellClick(row.id,d,e);return;}openCellModal(row.id,d);}}\n'
new_cell = '                              onClick={(e:any)=>handleCellClick(row.id,d,e)}\n                              onContextMenu={(e:any)=>handleContextMenu(row.id,d,e)}\n'

if old_cell in content:
    content = content.replace(old_cell, new_cell)
    print("✅ Cell onClick/onContextMenu updated")
else:
    print("❌ Cell onClick not found")

# Update handleCellClick untuk buka modal saat tidak shift
old_handle2 = """  const handleCellClick=(rawId:number,date:string,e:React.MouseEvent)=>{
    setCtxMenu(null);
    if(e.shiftKey&&lastSelected){"""

new_handle2 = """  const handleCellClick=(rawId:number,date:string,e:React.MouseEvent)=>{
    setCtxMenu(null);
    if(e.shiftKey&&lastSelected){
      // Shift+klik = select range"""

# Cari closing dari single select untuk tambah openModal
old_single = """    } else {
      // Single select
      setSelectedCells([{rawId,date}]);
      setLastSelected({rawId,date});
    }
  };"""

new_single = """    } else {
      // Single select - jika tidak ada selection sebelumnya, buka modal
      if(selectedCells.length===0&&copiedCells.length===0){
        openCellModal(rawId,date);
        return;
      }
      setSelectedCells([{rawId,date}]);
      setLastSelected({rawId,date});
    }
  };"""

if old_single in content:
    content = content.replace(old_single, new_single)
    print("✅ Single click open modal logic added")
else:
    print("❌ Single select not found")

# ── 5. Tambah Context Menu JSX ──
old_return = """    </div>
  );
}

function RencanaHarian("""

new_return = """    {/* Context Menu */}
    {ctxMenu&&(
      <>
        <div style={{position:"fixed",inset:0,zIndex:9998}} onClick={()=>setCtxMenu(null)}/>
        <div style={{position:"fixed",left:ctxMenu.x,top:ctxMenu.y,zIndex:9999,
          background:"#fff",border:"1px solid #e2e8f0",borderRadius:8,
          boxShadow:"0 4px 16px #00000020",padding:"4px 0",minWidth:180}}>
          {selectedCells.length>0&&copiedCells.length===0&&(
            <button onClick={()=>{copySelected();setCtxMenu(null);}}
              style={{display:"flex",alignItems:"center",gap:8,width:"100%",padding:"8px 14px",
                border:"none",background:"none",cursor:"pointer",fontSize:12,color:"#1e293b",textAlign:"left" as const}}
              onMouseEnter={(e:any)=>e.currentTarget.style.background="#f8fafc"}
              onMouseLeave={(e:any)=>e.currentTarget.style.background="none"}>
              📋 Copy ({selectedCells.length} cell)
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
                border:"none",background:"none",cursor:"pointer",fontSize:12,color:"#1e293b",textAlign:"left" as const}}
              onMouseEnter={(e:any)=>e.currentTarget.style.background="#f8fafc"}
              onMouseLeave={(e:any)=>e.currentTarget.style.background="none"}>
              ✏️ Edit Jadwal
            </button>
          )}
          <div style={{borderTop:"1px solid #f1f5f9",margin:"4px 0"}}/>
          <button onClick={()=>{setSelectedCells([]);setCopiedCells([]);setCtxMenu(null);}}
            style={{display:"flex",alignItems:"center",gap:8,width:"100%",padding:"8px 14px",
              border:"none",background:"none",cursor:"pointer",fontSize:12,color:"#94a3b8",textAlign:"left" as const}}
            onMouseEnter={(e:any)=>e.currentTarget.style.background="#f8fafc"}
            onMouseLeave={(e:any)=>e.currentTarget.style.background="none"}>
            ✕ Tutup
          </button>
        </div>
      </>
    )}
    </div>
  );
}

function RencanaHarian("""

if old_return in content:
    content = content.replace(old_return, new_return)
    print("✅ Context menu JSX added")
else:
    print("❌ Return not found")

APP_PATH.write_text(content, encoding="utf-8")
print("\n✅ Selesai!")
