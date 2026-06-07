from pathlib import Path

APP_PATH = Path(r"C:\Users\User\vista-teknik\src\App.tsx")
lines = APP_PATH.read_text(encoding="utf-8").splitlines(keepends=True)

# Replace baris 3309-3348 (pasteToCell function)
new_paste = """  const pasteToCell=async(targetRawId:number,targetDate:string)=>{
    if(!copiedCells.length)return;
    const allDays=days;
    const targetDayIdx=allDays.indexOf(targetDate);
    if(targetDayIdx===-1)return;
    const targetRowIdx=rawData.findIndex(r=>r.id===targetRawId);
    const srcRowIds=[...new Set(copiedCells.map((c:any)=>c.rawId))];
    const minSrcDayIdx=Math.min(...copiedCells.map((c:any)=>allDays.indexOf(c.date)));
    const minSrcRowIdx=Math.min(...srcRowIds.map((id:any)=>rawData.findIndex(r=>r.id===id)));
    const batchUpdates:Record<number,any>={};
    for(const cell of copiedCells){
      const srcDayIdx=allDays.indexOf(cell.date);
      const srcRowIdx=rawData.findIndex(r=>r.id===cell.rawId);
      const dayOffset=srcDayIdx-minSrcDayIdx;
      const rowOffset=srcRowIdx-minSrcRowIdx;
      const destDayIdx=targetDayIdx+dayOffset;
      const destRowIdx=targetRowIdx+rowOffset;
      if(destDayIdx<0||destDayIdx>=allDays.length)continue;
      if(destRowIdx<0||destRowIdx>=rawData.length)continue;
      const destDate=allDays[destDayIdx];
      const destRow=rawData[destRowIdx];
      if(!destRow)continue;
      if(!batchUpdates[destRow.id]){
        batchUpdates[destRow.id]={schedule:{...destRow.schedule},busbar_schedule:{...(destRow.busbar_schedule||{})}};
      }
      if(cell.entries.length>0) batchUpdates[destRow.id].schedule[destDate]=cell.entries;
      if(cell.busbar.length>0) batchUpdates[destRow.id].busbar_schedule[destDate]=cell.busbar;
    }
    for(const[rowId,data] of Object.entries(batchUpdates)){
      const id=Number(rowId);
      setRawData((prev:any[])=>prev.map(r=>r.id===id?{...r,...data}:r));
      await updateRaw(id,data);
    }
    setSelectedCells([]);
    setCopiedCells([]);
  };\n"""

# Cari baris start dan end pasteToCell
start_line = None
end_line = None
for i, l in enumerate(lines):
    if 'const pasteToCell=async' in l:
        start_line = i
    if start_line and i > start_line and l.strip() == '};':
        end_line = i
        break

if start_line and end_line:
    lines[start_line:end_line+1] = [new_paste]
    APP_PATH.write_text(''.join(lines), encoding="utf-8")
    print(f"✅ pasteToCell replaced (baris {start_line+1}-{end_line+1})!")
else:
    print(f"❌ Not found! start={start_line} end={end_line}")
