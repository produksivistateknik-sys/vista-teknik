from pathlib import Path

APP_PATH = Path(r"C:\Users\User\vista-teknik\src\App.tsx")
content = APP_PATH.read_text(encoding="utf-8")

# ── 1. Tambah BUSBAR_KOMPONEN konstanta ──
old_anchor = "const isKomponenRelevant=(kode:string, proses:string):boolean=>{"
new_anchor = """// ─────────────────────────────────────────────────────────────────────────────
// BUSBAR KOMPONEN per tipe panel
// ─────────────────────────────────────────────────────────────────────────────
const BUSBAR_KOMPONEN:Record<string,string[]> = {
  FS:      ["H-BUS","INCOMING","OUTGOING","NETRAL","GROUND","COUPLER"],
  F3B:     ["H-BUS","INCOMING","OUTGOING","NETRAL","GROUND","COUPLER"],
  WM_MS:   ["LINE","INCOMING","OUTGOING","NETRAL","GROUND"],
  WM_POLY: ["LINE","INCOMING","OUTGOING","NETRAL","GROUND"],
};

const getBusbarKomponen=(tipe:string):string[]=>{
  return BUSBAR_KOMPONEN[tipe]||BUSBAR_KOMPONEN["FS"];
};

const BUSBAR_COLORS:Record<string,string>={
  "H-BUS":"#f59e0b","LINE":"#f59e0b",
  "INCOMING":"#ef4444","OUTGOING":"#3b82f6",
  "NETRAL":"#8b5cf6","GROUND":"#16a34a",
  "COUPLER":"#f97316",
};

const isKomponenRelevant=(kode:string, proses:string):boolean=>{"""

if old_anchor in content:
    content = content.replace(old_anchor, new_anchor)
    print("✅ BUSBAR_KOMPONEN konstanta added")
else:
    print("❌ Anchor not found")

# ── 2. Cari modal cell Raw Schedule untuk tambah busbar section ──
# Cari bagian modal yang render WP items
old_modal_wp = """              <div style={{display:"flex",gap:6,flexWrap:"wrap" as const}}>
                {wpItemsAll.filter(it=>isKomponenRelevant(it.kode,rawRow?.proses||"")).map((it:any)=>("""

# Cek dulu exact pattern
lines = content.splitlines()
for i, l in enumerate(lines):
    if 'wpItemsAll' in l and 'isKomponenRelevant' in l:
        print(f"Found wpItemsAll at line {i+1}: {l.strip()[:80]}")
        break

# Cari modal WP section untuk tambah busbar pilihan
old_modal_header = """              <div style={{fontWeight:700,fontSize:12,color:"#1e293b",marginBottom:8}}>
                {modalWp} — Pilih Komponen:
              </div>"""

new_modal_header = """              <div style={{fontWeight:700,fontSize:12,color:"#1e293b",marginBottom:8}}>
                {modalWp} — Pilih Komponen:
              </div>"""

# Cari section render cell BUSBAR di tbody
# Saat proses BUSBAR, tampilkan badge komponen busbar
old_cell_render = """                      return(
                        <td key={d} style={{{...td,textAlign:"center",padding:"2px",background:isOver?"#eff6ff":d===TODAY?"#eff6ff":isSunday(d)?"#fff1f2":isSelDate&&entries.length?"#f0f9ff":rBg,outline:isOver?"2px dashed #2563eb":"none",borderLeft:d===TODAY?"2px solid #3b82f6":isSunday(d)?"2px solid #fda4af":"none"}}}"""

# Tambah busbar modal di cellModal
# Cari dimana modal komponen dirender
old_modal_section = """          {cellModal&&(()=>{
            const rawRow=rawData.find(r=>r.id===cellModal.rawId);"""

new_modal_section = """          {cellModal&&(()=>{
            const rawRow=rawData.find(r=>r.id===cellModal.rawId);"""

# Cari bagian render entries di cell tanggal
old_entries = """                      const entries=row.schedule?.[d]||[];"""
new_entries = """                      const entries=row.schedule?.[d]||[];
                      const busbarEntries:string[]=row.busbarSchedule?.[d]||[];"""

if old_entries in content:
    content = content.replace(old_entries, new_entries)
    print("✅ busbarEntries added to cell render")
else:
    print("❌ entries line not found")

# Tambah display busbar badges di cell
old_cell_content = """                          {entries.length>0?(
                            <div style={{display:"flex",gap:3,flexWrap:"wrap" as const,justifyContent:"center"}}>"""

new_cell_content = """                          {row.proses==="BUSBAR"&&busbarEntries.length>0&&(
                            <div style={{display:"flex",gap:2,flexWrap:"wrap" as const,justifyContent:"center",marginBottom:2}}>
                              {busbarEntries.map((b:string)=>(
                                <span key={b} style={{background:(BUSBAR_COLORS[b]||"#64748b")+"22",
                                  color:BUSBAR_COLORS[b]||"#64748b",
                                  border:`1px solid ${BUSBAR_COLORS[b]||"#64748b"}44`,
                                  borderRadius:4,padding:"0px 4px",fontSize:8,fontWeight:700,
                                  whiteSpace:"nowrap" as const}}>
                                  {b}
                                </span>
                              ))}
                            </div>
                          )}
                          {entries.length>0?(
                            <div style={{display:"flex",gap:3,flexWrap:"wrap" as const,justifyContent:"center"}}>"""

if old_cell_content in content:
    content = content.replace(old_cell_content, new_cell_content)
    print("✅ Busbar badges added to cell display")
else:
    print("⚠️  Cell content not found")

APP_PATH.write_text(content, encoding="utf-8")
print("\n✅ Step 1 done! Lanjut step 2...")

# ── Step 2: Tambah modal busbar di cellModal ──
APP_PATH = Path(r"C:\Users\User\vista-teknik\src\App.tsx")
content = APP_PATH.read_text(encoding="utf-8")

# Cari section modal WP untuk tambah busbar section
old_modal_wp_section = """              {panelCfg?.wps.map((wp:any)=>(
                <div key={wp.wp} style={{marginBottom:12}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                    <span style={{background:wp.color,color:"#fff",borderRadius:4,padding:"2px 8px",fontSize:10,fontWeight:700}}>{wp.wp}</span>
                    <span style={{fontSize:11,color:"#64748b"}}>{wp.range}</span>
                  </div>"""

# Tambah busbar section di modal
old_modal_close = """            <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:16}}>
              <Btn outline color="#64748b" onClick={()=>setCellModal(null)}>Batal</Btn>
              <Btn color="#1d4ed8" onClick={confirmCell}>Simpan</Btn>
            </div>"""

new_modal_close = """            {/* Busbar Komponen Section */}
            {rawRow?.proses==="BUSBAR"&&(()=>{
              const panelData=woData.flatMap((w:any)=>w.panels||[]).find((p:any)=>
                String(p.id)===String(rawRow.panel_id||rawRow.panelId));
              const busbarItems=getBusbarKomponen(panelData?.tipe||"FS");
              const selBusbar:string[]=cellModal?.busbarSel||[];
              return(
                <div style={{marginTop:12,padding:"12px",background:"#f8fafc",borderRadius:8,border:"1px solid #e2e8f0"}}>
                  <div style={{fontWeight:700,fontSize:12,color:"#1e293b",marginBottom:8}}>
                    🔌 Komponen Busbar — Pilih yang akan dikerjakan:
                  </div>
                  <div style={{display:"flex",gap:6,flexWrap:"wrap" as const}}>
                    {busbarItems.map((b:string)=>{
                      const isSel=selBusbar.includes(b);
                      const bc=BUSBAR_COLORS[b]||"#64748b";
                      return(
                        <button key={b} onClick={()=>{
                          const newSel=isSel?selBusbar.filter((x:string)=>x!==b):[...selBusbar,b];
                          setCellModal((p:any)=>({...p,busbarSel:newSel}));
                        }}
                          style={{padding:"5px 12px",borderRadius:6,cursor:"pointer",fontSize:11,fontWeight:700,
                            border:`1.5px solid ${isSel?bc:"#e2e8f0"}`,
                            background:isSel?bc+"18":"#fff",
                            color:isSel?bc:"#64748b"}}>
                          {b}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:16}}>
              <Btn outline color="#64748b" onClick={()=>setCellModal(null)}>Batal</Btn>
              <Btn color="#1d4ed8" onClick={confirmCell}>Simpan</Btn>
            </div>"""

if old_modal_close in content:
    content = content.replace(old_modal_close, new_modal_close)
    print("✅ Busbar modal section added")
else:
    print("⚠️  Modal close not found")

# ── Step 3: Update confirmCell untuk save busbarSchedule ──
old_confirm_cell = """  const confirmCell=async()=>{
    if(!cellModal)return;
    const{rawId,date,entries}=cellModal;"""

new_confirm_cell = """  const confirmCell=async()=>{
    if(!cellModal)return;
    const{rawId,date,entries,busbarSel}=cellModal;"""

if old_confirm_cell in content:
    content = content.replace(old_confirm_cell, new_confirm_cell)
    print("✅ confirmCell updated to handle busbarSel")
else:
    print("⚠️  confirmCell not found")

# Tambah busbar save di confirmCell
old_confirm_save = """    setRawData(prev=>prev.map(r=>{
      if(r.id!==rawId)return r;
      const newSch={...r.schedule,[date]:entries};
      updatedRow={...r,schedule:newSch};
      return updatedRow;
    }));
    if(updatedRow) await updateRaw(rawId,{schedule:updatedRow.schedule});"""

new_confirm_save = """    const rawRow2=rawData.find(r=>r.id===rawId);
    const isBusbar=rawRow2?.proses==="BUSBAR";
    setRawData(prev=>prev.map(r=>{
      if(r.id!==rawId)return r;
      const newSch={...r.schedule,[date]:entries};
      const newBusbarSch=isBusbar&&busbarSel!==undefined
        ?{...r.busbarSchedule,[date]:busbarSel}
        :(r.busbarSchedule||{});
      updatedRow={...r,schedule:newSch,busbarSchedule:newBusbarSch};
      return updatedRow;
    }));
    if(updatedRow) await updateRaw(rawId,{
      schedule:updatedRow.schedule,
      busbarSchedule:updatedRow.busbarSchedule
    });"""

if old_confirm_save in content:
    content = content.replace(old_confirm_save, new_confirm_save)
    print("✅ confirmCell save busbarSchedule added")
else:
    print("⚠️  confirmCell save not found")

APP_PATH.write_text(content, encoding="utf-8")
print("\n✅ Step 2 done!")
