from pathlib import Path

APP_PATH = Path(r"C:\Users\User\vista-teknik\src\App.tsx")
content = APP_PATH.read_text(encoding="utf-8")

old = """  const removeEntry=async(wp)=>{
    let updatedRow=null;
    setRawData(prev=>prev.map(r=>{
      if(r.id!==cellModal.rawId)return r;
      const newSch={...r.schedule};
      const updated=(newSch[cellModal.date]||[]).filter(e=>e.wp!==wp);
      if(!updated.length)delete newSch[cellModal.date]; else newSch[cellModal.date]=updated;
      updatedRow={...r,schedule:newSch};
      return updatedRow;
    }));
    syncRenharDel(cellModal.rawId,cellModal.date,wp);
    if(updatedRow) await updateRaw(cellModal.rawId,{schedule:updatedRow.schedule});"""

new = """  const removeEntry=async(wp)=>{
    // Hitung new schedule dulu sebelum update state
    const currentRow=rawData.find(r=>r.id===cellModal.rawId);
    if(!currentRow)return;
    const newSch={...currentRow.schedule};
    const updated=(newSch[cellModal.date]||[]).filter((e:any)=>e.wp!==wp);
    if(!updated.length) delete newSch[cellModal.date]; else newSch[cellModal.date]=updated;
    const updatedRow={...currentRow,schedule:newSch};
    // Update state dan Supabase
    setRawData(prev=>prev.map(r=>r.id===cellModal.rawId?updatedRow:r));
    await updateRaw(cellModal.rawId,{schedule:newSch});
    syncRenharDel(cellModal.rawId,cellModal.date,wp);"""

if old in content:
    content = content.replace(old, new)
    APP_PATH.write_text(content, encoding="utf-8")
    print("✅ removeEntry fixed!")
else:
    print("❌ Not found!")
