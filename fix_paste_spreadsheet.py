from pathlib import Path

APP_PATH = Path(r"C:\Users\User\vista-teknik\src\App.tsx")
content = APP_PATH.read_text(encoding="utf-8")

# Replace seluruh pasteToCell function
old_paste = """  const pasteToCell=async(targetRawId:number,targetDate:string)=>{
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
    // Group copied cells by rawId
    const byRow:Record<number,{date:string,entries:any[],busbar:string[]}[]>={};
    for(const cell of copiedCells){
      if(!byRow[cell.rawId]) byRow[cell.rawId]=[];
      byRow[cell.rawId].push(cell);
    }
    const srcRowIds=Object.keys(byRow).map(Number);
    // Map src rows → dest rows berdasarkan urutan
    const destRows=rawData.filter(r=>{
      const p=woData.flatMap((w:any)=>w.panels||[]).find((p:any)=>Number(p.id)===Number(r.panel_id||r.panelId));
      return p?.tipe===targetPanel?.tipe;
    });
    for(let ri=0;ri<srcRowIds.length;ri++){
      const srcRowId=srcRowIds[ri];
      const srcRow=rawData.find(r=>r.id===srcRowId);
      if(!srcRow)continue;
      // Cari dest row dengan proses sama, mulai dari targetRawId
      const destRow=destRows.find(r=>r.id===targetRawId&&r.proses===srcRow.proses)
        ||destRows.find(r=>r.proses===srcRow.proses&&r.id!==srcRowId);
      if(!destRow)continue;
      const cells=byRow[srcRowId];
      const newSch={...destRow.schedule};
      const newBusbar={...(destRow.busbar_schedule||{})};
      for(const cell of cells){
        const srcDayIdx=allDays.indexOf(cell.date);
        const offset=srcDayIdx-minSrcDay;
        const destDayIdx=targetDayIdx+offset;
        if(destDayIdx<0||destDayIdx>=allDays.length)continue;
        const destDate=allDays[destDayIdx];
        if(cell.entries.length>0) newSch[destDate]=cell.entries;
        if(cell.busbar.length>0) newBusbar[destDate]=cell.busbar;
      }
      setRawData(prev=>prev.map(r=>r.id===destRow.id?{...r,schedule:newSch,busbar_schedule:newBusbar}:r));
      await updateRaw(destRow.id,{schedule:newSch,busbar_schedule:newBusbar});
    }
    setSelectedCells([]);
    setCopiedCells([]);
  };"""

new_paste = """  const pasteToCell=async(targetRawId:number,targetDate:string)=>{
    if(!copiedCells.length)return;
    const allDays=days;
    const targetDayIdx=allDays.indexOf(targetDate);
    if(targetDayIdx===-1)return;

    // ── Spreadsheet-like paste logic ──
    // 1. Hitung bounding box dari selection
    const srcRowIds=[...new Set(copiedCells.map(c=>c.rawId))];
    const srcDays=[...new Set(copiedCells.map(c=>c.date))].sort();
    const minSrcDayIdx=Math.min(...srcDays.map(d=>allDays.indexOf(d)));
    const minSrcRowIdx=Math.min(...srcRowIds.map(id=>rawData.findIndex(r=>r.id===id)));

    // 2. Anchor = target cell = top-left dari paste area
    const targetRowIdx=rawData.findIndex(r=>r.id===targetRawId);

    // 3. Batch updates
    const batchUpdates:Record<number,{schedule:any,busbar_schedule:any}>={};

    for(const cell of copiedCells){
      const srcDayIdx=allDays.indexOf(cell.date);
      const srcRowIdx=rawData.findIndex(r=>r.id===cell.rawId);
      // Hitung offset relatif dari top-left selection
      const dayOffset=srcDayIdx-minSrcDayIdx;
      const rowOffset=srcRowIdx-minSrcRowIdx;
      // Terapkan ke target
      const destDayIdx=targetDayIdx+dayOffset;
      const destRowIdx=targetRowIdx+rowOffset;
      if(destDayIdx<0||destDayIdx>=allDays.length)continue;
      if(destRowIdx<0||destRowIdx>=rawData.length)continue;
      const destDate=allDays[destDayIdx];
      const destRow=rawData[destRowIdx];
      if(!destRow)continue;
      // Init batch untuk row ini
      if(!batchUpdates[destRow.id]){
        batchUpdates[destRow.id]={
          schedule:{...destRow.schedule},
          busbar_schedule:{...(destRow.busbar_schedule||{})}
        };
      }
      // Set data
      if(cell.entries.length>0){
        batchUpdates[destRow.id].schedule[destDate]=cell.entries;
      }
      if(cell.busbar.length>0){
        batchUpdates[destRow.id].busbar_schedule[destDate]=cell.busbar;
      }
    }

    // 4. Apply semua updates
    for(const[rowId,data] of Object.entries(batchUpdates)){
      const id=Number(rowId);
      setRawData(prev=>prev.map(r=>r.id===id?{...r,...data}:r));
      await updateRaw(id,data);
    }
    setSelectedCells([]);
    setCopiedCells([]);
  };"""

if old_paste in content:
    content = content.replace(old_paste, new_paste)
    APP_PATH.write_text(content, encoding="utf-8")
    print("✅ Paste logic rewritten (spreadsheet-like)!")
else:
    print("❌ Not found!")
