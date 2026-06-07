from pathlib import Path

APP_PATH = Path(r"C:\Users\User\vista-teknik\src\App.tsx")
content = APP_PATH.read_text(encoding="utf-8")

# ── 1. Tambah state untuk copy-paste di RawSchedule ──
old_states = """  const [weekStart,setWeekStart]=useState(TODAY);"""
new_states = """  const [weekStart,setWeekStart]=useState(TODAY);
  const [selectedCells,setSelectedCells]=useState<{rawId:number,date:string}[]>([]);
  const [copiedCells,setCopiedCells]=useState<{rawId:number,date:string,entries:any[],busbar:string[]}[]>([]);
  const [lastSelected,setLastSelected]=useState<{rawId:number,date:string}|null>(null);"""

if old_states in content:
    content = content.replace(old_states, new_states)
    print("✅ Copy-paste states added")
else:
    print("❌ States not found")

# ── 2. Tambah helper functions untuk copy-paste ──
old_open_cell = """  const openCellModal=(rawId,date)=>{"""
new_open_cell = """  // ── COPY PASTE FUNCTIONS ──
  const handleCellClick=(rawId:number,date:string,e:React.MouseEvent)=>{
    if(e.shiftKey&&lastSelected){
      // Select range
      const rows=rawData;
      const allDays=days;
      const startRowIdx=rows.findIndex(r=>r.id===lastSelected.rawId);
      const endRowIdx=rows.findIndex(r=>r.id===rawId);
      const startDayIdx=allDays.indexOf(lastSelected.date);
      const endDayIdx=allDays.indexOf(date);
      const minRow=Math.min(startRowIdx,endRowIdx);
      const maxRow=Math.max(startRowIdx,endRowIdx);
      const minDay=Math.min(startDayIdx,endDayIdx);
      const maxDay=Math.max(startDayIdx,endDayIdx);
      const newSelected:any[]=[];
      for(let r=minRow;r<=maxRow;r++){
        for(let d=minDay;d<=maxDay;d++){
          newSelected.push({rawId:rows[r].id,date:allDays[d]});
        }
      }
      setSelectedCells(newSelected);
    } else if(e.ctrlKey||e.metaKey){
      // Toggle individual cell
      setSelectedCells(prev=>{
        const exists=prev.some(c=>c.rawId===rawId&&c.date===date);
        return exists?prev.filter(c=>!(c.rawId===rawId&&c.date===date)):[...prev,{rawId,date}];
      });
      setLastSelected({rawId,date});
    } else {
      // Single select
      setSelectedCells([{rawId,date}]);
      setLastSelected({rawId,date});
    }
  };

  const copySelected=()=>{
    if(!selectedCells.length)return;
    const copied=selectedCells.map(c=>{
      const row=rawData.find(r=>r.id===c.rawId);
      return{
        rawId:c.rawId,date:c.date,
        entries:row?.schedule?.[c.date]||[],
        busbar:row?.busbar_schedule?.[c.date]||[],
      };
    });
    setCopiedCells(copied);
  };

  const pasteToCell=async(targetRawId:number,targetDate:string)=>{
    if(!copiedCells.length)return;
    const targetRow=rawData.find(r=>r.id===targetRawId);
    if(!targetRow)return;
    // Cek tipe panel
    const targetPanel=woData.flatMap(w=>w.panels||[]).find((p:any)=>Number(p.id)===Number(targetRow.panel_id||targetRow.panelId));
    const allDays=days;
    const targetDayIdx=allDays.indexOf(targetDate);
    if(targetDayIdx===-1)return;
    // Paste setiap cell sesuai posisi relatif
    const minSrcDay=Math.min(...copiedCells.map(c=>allDays.indexOf(c.date)));
    const updates:any[]=[];
    for(const cell of copiedCells){
      const srcDayIdx=allDays.indexOf(cell.date);
      const offset=srcDayIdx-minSrcDay;
      const destDayIdx=targetDayIdx+offset;
      if(destDayIdx<0||destDayIdx>=allDays.length)continue;
      const destDate=allDays[destDayIdx];
      // Cek apakah ada row dengan proses yang sama di target panel
      const srcRow=rawData.find(r=>r.id===cell.rawId);
      if(!srcRow)continue;
      // Cari target row dengan proses yang sama dan panel tipe yang sama
      const targetRows=rawData.filter(r=>{
        const p=woData.flatMap(w=>w.panels||[]).find((p:any)=>Number(p.id)===Number(r.panel_id||r.panelId));
        return r.proses===srcRow.proses&&p?.tipe===targetPanel?.tipe&&r.id!==cell.rawId;
      });
      const destRow=targetRows.find(r=>r.id===targetRawId)||targetRows[0];
      if(!destRow)continue;
      updates.push({destRow,destDate,entries:cell.entries,busbar:cell.busbar});
    }
    // Apply updates
    for(const upd of updates){
      const newSch={...upd.destRow.schedule,[upd.destDate]:upd.entries};
      const newBusbar={...upd.destRow.busbar_schedule,[upd.destDate]:upd.busbar};
      setRawData(prev=>prev.map(r=>r.id===upd.destRow.id?{...r,schedule:newSch,busbar_schedule:newBusbar}:r));
      await updateRaw(upd.destRow.id,{schedule:newSch,busbar_schedule:newBusbar});
    }
    setSelectedCells([]);
    setCopiedCells([]);
  };

  const openCellModal=(rawId,date)=>{"""

if old_open_cell in content:
    content = content.replace(old_open_cell, new_open_cell)
    print("✅ Copy-paste functions added")
else:
    print("❌ openCellModal not found")

# ── 3. Tambah keyboard handler ──
old_isop = """  const isOp=OPERATOR_ROLES.includes(user?.divisi);"""
new_isop = """  // Keyboard handler untuk Ctrl+C / Ctrl+V / Esc
  useEffect(()=>{
    const handler=(e:KeyboardEvent)=>{
      if((e.ctrlKey||e.metaKey)&&e.key==="c"){
        if(selectedCells.length>0){e.preventDefault();copySelected();}
      }
      if((e.ctrlKey||e.metaKey)&&e.key==="v"){
        if(copiedCells.length>0&&lastSelected){
          e.preventDefault();
          pasteToCell(lastSelected.rawId,lastSelected.date);
        }
      }
      if(e.key==="Escape"){setSelectedCells([]);setCopiedCells([]);}
    };
    window.addEventListener("keydown",handler);
    return()=>window.removeEventListener("keydown",handler);
  },[selectedCells,copiedCells,lastSelected,rawData,woData]);

  const isOp=OPERATOR_ROLES.includes(user?.divisi);"""

if old_isop in content:
    content = content.replace(old_isop, new_isop)
    print("✅ Keyboard handler added")
else:
    print("❌ isOp not found")

# ── 4. Update cell onClick untuk support selection ──
old_cell_click = """                      <td key={d} style={{{...td,textAlign:"center",padding:"2px",background:isOver?"#eff6ff":d===TODAY?"#eff6ff":isSunday(d)?"#fff1f2":isSelDate&&entries.length?"#f0f9ff":rBg,outline:isOver?"2px dashed #2563eb":"none",borderLeft:d===TODAY?"2px solid #3b82f6":isSunday(d)?"2px solid #fda4af":"none"}}}"""

new_cell_click = """                      {const isSelected=selectedCells.some(c=>c.rawId===row.id&&c.date===d);
                      const isCopied=copiedCells.some(c=>c.rawId===row.id&&c.date===d);}
                      <td key={d} onClick={(e)=>{if(e.ctrlKey||e.metaKey||e.shiftKey){handleCellClick(row.id,d,e);}}} style={{{...td,textAlign:"center",padding:"2px",background:isOver?"#eff6ff":d===TODAY?"#eff6ff":isSunday(d)?"#fff1f2":isSelDate&&entries.length?"#f0f9ff":rBg,outline:isOver?"2px dashed #2563eb":isCopied?"2px dashed #3b82f6":isSelected?"2px solid #2563eb":"none",borderLeft:d===TODAY?"2px solid #3b82f6":isSunday(d)?"2px solid #fda4af":"none"}}}"""

# Approach berbeda - tambah selection visual ke cell td
# Cari pattern yang lebih simple
old_td_style = """                      <td key={d} style={{{...td,textAlign:"center",padding:"2px",background:isOver?"#eff6ff":d===TODAY?"#eff6ff":isSunday(d)?"#fff1f2":isSelDate&&entries.length?"#f0f9ff":rBg,outline:isOver?"2px dashed #2563eb":"none",borderLeft:d===TODAY?"2px solid #3b82f6":isSunday(d)?"2px solid #fda4af":"none"}}}>"""

new_td_style = """                      <td key={d}
                        onClick={(e:any)=>{if(e.ctrlKey||e.metaKey||e.shiftKey){handleCellClick(row.id,d,e);}}}
                        style={{{...td,textAlign:"center",padding:"2px",
                          background:isOver?"#eff6ff":d===TODAY?"#eff6ff":isSunday(d)?"#fff1f2":isSelDate&&entries.length?"#f0f9ff":rBg,
                          outline:isOver?"2px dashed #2563eb":copiedCells.some(c=>c.rawId===row.id&&c.date===d)?"2px dashed #3b82f6":selectedCells.some(c=>c.rawId===row.id&&c.date===d)?"2px solid #2563eb":"none",
                          borderLeft:d===TODAY?"2px solid #3b82f6":isSunday(d)?"2px solid #fda4af":"none"}}}>"""

if old_td_style in content:
    content = content.replace(old_td_style, new_td_style)
    print("✅ Cell TD updated with selection visual")
else:
    print("❌ Cell TD not found")

# ── 5. Tambah info bar copy paste ──
old_topbar = """      <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:8,flexWrap:"wrap" as const}}>"""
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

if old_topbar in content:
    content = content.replace(old_topbar, new_topbar)
    print("✅ Copy-paste info bar added")
else:
    print("⚠️  Topbar not found")

APP_PATH.write_text(content, encoding="utf-8")
print("\n✅ Selesai!")
