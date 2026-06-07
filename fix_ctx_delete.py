from pathlib import Path

APP_PATH = Path(r"C:\Users\User\vista-teknik\src\App.tsx")
content = APP_PATH.read_text(encoding="utf-8")

# Tambah fungsi deleteSelected
old_copy_fn = """  const copySelected=()=>{"""
new_copy_fn = """  const deleteSelected=async()=>{
    if(!selectedCells.length)return;
    const batchUpdates:Record<number,any>={};
    for(const cell of selectedCells){
      const row=rawData.find(r=>r.id===cell.rawId);
      if(!row)continue;
      if(!batchUpdates[row.id]){
        batchUpdates[row.id]={schedule:{...row.schedule},busbar_schedule:{...(row.busbar_schedule||{})}};
      }
      delete batchUpdates[row.id].schedule[cell.date];
      delete batchUpdates[row.id].busbar_schedule[cell.date];
    }
    for(const[rowId,data] of Object.entries(batchUpdates)){
      const id=Number(rowId);
      setRawData((prev:any[])=>prev.map(r=>r.id===id?{...r,...data}:r));
      await updateRaw(id,data);
    }
    setSelectedCells([]);
  };

  const copySelected=()=>{"""

if old_copy_fn in content:
    content = content.replace(old_copy_fn, new_copy_fn)
    print("✅ deleteSelected function added")
else:
    print("❌ copySelected not found")

# Tambah Delete button di context menu
old_ctx_close = """          <div style={{borderTop:"1px solid var(--border-light,#f1f5f9)",margin:"4px 0"}}/>
          <button onClick={()=>{setSelectedCells([]);setCopiedCells([]);setCtxMenu(null);}}"""

new_ctx_close = """          {selectedCells.length>0&&(
            <button onClick={()=>{deleteSelected();setCtxMenu(null);}}
              style={{display:"flex",alignItems:"center",gap:8,width:"100%",padding:"8px 14px",
                border:"none",background:"none",cursor:"pointer",fontSize:12,color:"#dc2626",textAlign:"left" as const}}
              onMouseEnter={(e:any)=>e.currentTarget.style.background="#fef2f2"}
              onMouseLeave={(e:any)=>e.currentTarget.style.background="none"}>
              🗑 Hapus ({selectedCells.length} cell)
            </button>
          )}
          <div style={{borderTop:"1px solid var(--border-light,#f1f5f9)",margin:"4px 0"}}/>
          <button onClick={()=>{setSelectedCells([]);setCopiedCells([]);setCtxMenu(null);}}"""

if old_ctx_close in content:
    content = content.replace(old_ctx_close, new_ctx_close)
    APP_PATH.write_text(content, encoding="utf-8")
    print("✅ Delete button added to context menu!")
else:
    print("❌ Context menu close not found")
