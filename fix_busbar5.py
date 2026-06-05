from pathlib import Path

APP_PATH = Path(r"C:\Users\User\vista-teknik\src\App.tsx")
content = APP_PATH.read_text(encoding="utf-8")

# Fix 1: Sembunyikan WP selector saat proses BUSBAR
# Cari render WP buttons di modal
old_wp_section = """          <div style={{marginBottom:12}}>
            <Lbl>Tambah WP</Lbl>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
              {panelCfg?.wps.map((wp:any)=>{"""

new_wp_section = """          {rawRow?.proses!=="BUSBAR"&&(
          <div style={{marginBottom:12}}>
            <Lbl>Tambah WP</Lbl>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
              {panelCfg?.wps.map((wp:any)=>{"""

if old_wp_section in content:
    content = content.replace(old_wp_section, new_wp_section)
    print("✅ WP section hidden for BUSBAR")
else:
    print("❌ WP section not found")
    lines = content.splitlines()
    for i, l in enumerate(lines[3368:3400], 3369):
        if 'Tambah WP' in l or 'wps.map' in l:
            print(f"  {i}: {l.strip()[:80]}")

# Cari closing div dari WP section untuk tambah closing parenthesis
old_wp_close = """            </div>
          </div>
          {modalWp&&wpItems.length>0&&("""

new_wp_close = """            </div>
          </div>
          )}
          {rawRow?.proses!=="BUSBAR"&&modalWp&&wpItems.length>0&&("""

if old_wp_close in content:
    content = content.replace(old_wp_close, new_wp_close)
    print("✅ WP section closing fixed")
else:
    print("❌ WP closing not found")
    lines = content.splitlines()
    for i, l in enumerate(lines[3388:3410], 3389):
        if 'modalWp' in l or 'wpItems' in l:
            print(f"  {i}: {l.strip()[:80]}")

# Fix 2: Load busbarEntries dari busbarSchedule saat render
# Pastikan busbarEntries ter-load dari rawData
old_entries_line = """                      const entries=row.schedule?.[d]||[];
                      const busbarEntries:string[]=row.busbarSchedule?.[d]||[];"""

# Sudah ada, tapi perlu pastikan busbarSchedule ter-save ke rawData
# Update addEntry untuk save busbar ke local state juga
old_add_save = """    const isBusbarRow=rawRow?.proses==="BUSBAR";
    if(updatedRow){
      const updatePayload:any={schedule:updatedRow.schedule,updated_by:user?.name||user?.nama||'Admin'};
      if(isBusbarRow){
        const newBusbarSch={...(updatedRow.busbarSchedule||{}),[cellModal.date]:busbarSel};
        updatedRow={...updatedRow,busbarSchedule:newBusbarSch};
        updatePayload.busbarSchedule=newBusbarSch;
        setRawData(prev=>prev.map(r=>r.id===updatedRow.id?updatedRow:r));
      }
      await updateRaw(cellModal.rawId,updatePayload);
    }"""

new_add_save = """    const isBusbarRow=rawRow?.proses==="BUSBAR";
    if(updatedRow){
      const updatePayload:any={schedule:updatedRow.schedule,updated_by:user?.name||user?.nama||'Admin'};
      if(isBusbarRow&&busbarSel!==undefined){
        const newBusbarSch={...(rawRow?.busbarSchedule||{}),[cellModal.date]:busbarSel};
        updatePayload.busbarSchedule=newBusbarSch;
        // Update local state dengan busbarSchedule
        setRawData(prev=>prev.map(r=>{
          if(r.id!==cellModal.rawId)return r;
          return{...r,schedule:updatedRow.schedule,busbarSchedule:newBusbarSch};
        }));
      }
      await updateRaw(cellModal.rawId,updatePayload);
    }"""

if old_add_save in content:
    content = content.replace(old_add_save, new_add_save)
    print("✅ busbarSchedule save to local state fixed")
else:
    print("❌ addEntry save not found")

APP_PATH.write_text(content, encoding="utf-8")
print("\n✅ Selesai!")
