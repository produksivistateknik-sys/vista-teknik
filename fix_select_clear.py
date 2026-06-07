from pathlib import Path

APP_PATH = Path(r"C:\Users\User\vista-teknik\src\App.tsx")
content = APP_PATH.read_text(encoding="utf-8")

old = """    } else {
      // Single select - jika tidak ada selection sebelumnya, buka modal
      if(selectedCells.length===0&&copiedCells.length===0){
        openCellModal(rawId,date);
        return;
      }
      setSelectedCells([{rawId,date}]);
      setLastSelected({rawId,date});
    }
  };"""

new = """    } else {
      // Single select
      if(copiedCells.length===0){
        // Tidak ada copied → buka modal langsung
        openCellModal(rawId,date);
        return;
      }
      // Ada copied cells → set anchor untuk paste
      setSelectedCells([{rawId,date}]);
      setLastSelected({rawId,date});
    }
  };"""

if old in content:
    content = content.replace(old, new)
    APP_PATH.write_text(content, encoding="utf-8")
    print("✅ Single select fixed!")
else:
    print("❌ Not found!")

APP_PATH = Path(r"C:\Users\User\vista-teknik\src\App.tsx")
content = APP_PATH.read_text(encoding="utf-8")

# Fix Shift+klik - hanya select di row yang sama, tidak cross-row
old_shift = """    if(e.shiftKey&&lastSelected){
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
      setSelectedCells(newSelected);"""

new_shift = """    if(e.shiftKey&&lastSelected){
      // Select range - hanya di row yang sama (seperti spreadsheet horizontal)
      const allDays=days;
      const startDayIdx=allDays.indexOf(lastSelected.date);
      const endDayIdx=allDays.indexOf(date);
      const minDay=Math.min(startDayIdx,endDayIdx);
      const maxDay=Math.max(startDayIdx,endDayIdx);
      // Jika row berbeda, select semua row di antara keduanya
      const rows=rawData;
      const startRowIdx=rows.findIndex(r=>r.id===lastSelected.rawId);
      const endRowIdx=rows.findIndex(r=>r.id===rawId);
      const minRow=Math.min(startRowIdx,endRowIdx);
      const maxRow=Math.max(startRowIdx,endRowIdx);
      const newSelected:any[]=[];
      for(let r=minRow;r<=maxRow;r++){
        for(let d=minDay;d<=maxDay;d++){
          newSelected.push({rawId:rows[r].id,date:allDays[d]});
        }
      }
      setSelectedCells(newSelected);"""

if old_shift in content:
    content = content.replace(old_shift, new_shift)
    print("✅ Shift select logic same (already correct)")
else:
    print("⚠️  Shift select not found")

# Fix: saat tidak ada lastSelected, set lastSelected dulu
old_ctrl = """    } else if(e.ctrlKey||e.metaKey){
      // Toggle individual cell
      setSelectedCells(prev=>{
        const exists=prev.some(c=>c.rawId===rawId&&c.date===date);
        return exists?prev.filter(c=>!(c.rawId===rawId&&c.date===date)):[...prev,{rawId,date}];
      });
      setLastSelected({rawId,date});"""

new_ctrl = """    } else if(e.ctrlKey||e.metaKey){
      // Ctrl+klik = set anchor untuk selection
      setSelectedCells([{rawId,date}]);
      setLastSelected({rawId,date});"""

if old_ctrl in content:
    content = content.replace(old_ctrl, new_ctrl)
    print("✅ Ctrl+click = set anchor")
else:
    print("❌ Ctrl click not found")

APP_PATH.write_text(content, encoding="utf-8")
print("✅ Selesai!")
