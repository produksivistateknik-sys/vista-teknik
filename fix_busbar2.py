from pathlib import Path

APP_PATH = Path(r"C:\Users\User\vista-teknik\src\App.tsx")
content = APP_PATH.read_text(encoding="utf-8")

# ── Fix 1: Tambah busbarSel state di openCellModal ──
old_open = "  const openCellModal=(rawId,date)=>{setCellModal({rawId,date});setModalWp(\"\");setModalKomponen([]);};"
new_open = """  const [busbarSel,setBusbarSel]=useState<string[]>([]);
  const openCellModal=(rawId,date)=>{
    setCellModal({rawId,date});
    setModalWp("");
    setModalKomponen([]);
    // Load existing busbar selections
    const row=rawData.find(r=>r.id===rawId);
    setBusbarSel(row?.busbarSchedule?.[date]||[]);
  };"""

if old_open in content:
    content = content.replace(old_open, new_open)
    print("✅ busbarSel state added")
else:
    print("❌ openCellModal not found")

# ── Fix 2: Update addEntry untuk save busbarSchedule juga ──
old_save = "    if(updatedRow) await updateRaw(cellModal.rawId,{schedule:updatedRow.schedule,updated_by:user?.name||user?.nama||'Admin'});"
new_save = """    const isBusbarRow=rawRow?.proses==="BUSBAR";
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

if old_save in content:
    content = content.replace(old_save, new_save)
    print("✅ addEntry save busbarSchedule added")
else:
    print("❌ addEntry save not found")

# ── Fix 3: Tambah busbar section di modal ──
old_modal_end = """            <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:16}}>
              <Btn outline color="#64748b" onClick={()=>setCellModal(null)}>Batal</Btn>"""

new_modal_end = """            {/* Busbar Komponen Section */}
            {rawRow?.proses==="BUSBAR"&&(()=>{
              const busbarItems=getBusbarKomponen(livePanelForCell?.tipe||"FS");
              return(
                <div style={{marginTop:12,padding:"12px",background:"#f8fafc",borderRadius:8,border:"1px solid #e2e8f0"}}>
                  <div style={{fontWeight:700,fontSize:12,color:"#1e293b",marginBottom:8}}>
                    🔌 Pilih Komponen Busbar:
                  </div>
                  <div style={{display:"flex",gap:6,flexWrap:"wrap" as const}}>
                    {busbarItems.map((b:string)=>{
                      const isSel=busbarSel.includes(b);
                      const bc=BUSBAR_COLORS[b]||"#64748b";
                      return(
                        <button key={b} onClick={()=>setBusbarSel(p=>isSel?p.filter(x=>x!==b):[...p,b])}
                          style={{padding:"5px 12px",borderRadius:6,cursor:"pointer",fontSize:11,fontWeight:700,
                            border:`1.5px solid ${isSel?bc:"#e2e8f0"}`,
                            background:isSel?bc+"18":"#fff",color:isSel?bc:"#64748b"}}>
                          {b}
                        </button>
                      );
                    })}
                  </div>
                  {busbarSel.length>0&&(
                    <div style={{marginTop:8,fontSize:11,color:"#64748b"}}>
                      Dipilih: <strong>{busbarSel.join(", ")}</strong>
                    </div>
                  )}
                </div>
              );
            })()}

            <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:16}}>
              <Btn outline color="#64748b" onClick={()=>setCellModal(null)}>Batal</Btn>"""

if old_modal_end in content:
    content = content.replace(old_modal_end, new_modal_end)
    print("✅ Busbar modal section added")
else:
    print("❌ Modal end not found")
    # debug
    lines = content.splitlines()
    for i, l in enumerate(lines):
        if 'Batal' in l and 'setCellModal' in l:
            print(f"  Found at {i+1}: {l.strip()[:80]}")

# ── Fix 4: Update cell display badges untuk busbar ──
old_cell = "                      const entries=row.schedule?.[d]||[];\n                      const busbarEntries:string[]=row.busbarSchedule?.[d]||[];"
# sudah ada dari script sebelumnya, sekarang update display
# Cari bagian render entries + tambah busbar display
old_plus_btn = """                          {entries.length===0&&<span style={{fontSize:16,color:"#d1d5db"}}>+</span>}"""
new_plus_btn = """                          {row.proses==="BUSBAR"&&busbarEntries.length>0&&entries.length===0&&(
                            <div style={{display:"flex",gap:2,flexWrap:"wrap" as const,justifyContent:"center"}}>
                              {busbarEntries.map((b:string)=>(
                                <span key={b} style={{background:(BUSBAR_COLORS[b]||"#64748b")+"22",
                                  color:BUSBAR_COLORS[b]||"#64748b",
                                  border:`1px solid ${BUSBAR_COLORS[b]||"#64748b"}44`,
                                  borderRadius:4,padding:"1px 4px",fontSize:8,fontWeight:700}}>
                                  {b}
                                </span>
                              ))}
                            </div>
                          )}
                          {entries.length===0&&busbarEntries.length===0&&<span style={{fontSize:16,color:"#d1d5db"}}>+</span>}"""

if old_plus_btn in content:
    content = content.replace(old_plus_btn, new_plus_btn)
    print("✅ Cell busbar badges display added")
else:
    print("⚠️  Plus button not found")
    lines = content.splitlines()
    for i, l in enumerate(lines):
        if 'fontSize:16,color:"#d1d5db"' in l and '+' in l:
            print(f"  Found at {i+1}: {l.strip()[:80]}")

APP_PATH.write_text(content, encoding="utf-8")
print("\n✅ Selesai!")
