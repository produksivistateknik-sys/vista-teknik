from pathlib import Path

APP_PATH = Path(r"C:\Users\User\vista-teknik\src\App.tsx")
content = APP_PATH.read_text(encoding="utf-8")

# Fix 1: Tambah busbar section sebelum tombol Selesai
old_selesai = """          <div style={{marginTop:16,display:"flex",justifyContent:"flex-end"}}>
            <Btn color="#16a34a" onClick={()=>setCellModal(null)}>Selesai</Btn>
          </div>
        </Modal>
      )}"""

new_selesai = """          {/* Busbar Komponen Section */}
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
                      <button key={b} onClick={()=>setBusbarSel((p:string[])=>isSel?p.filter((x:string)=>x!==b):[...p,b])}
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

          <div style={{marginTop:16,display:"flex",justifyContent:"flex-end"}}>
            <Btn color="#16a34a" onClick={()=>setCellModal(null)}>Selesai</Btn>
          </div>
        </Modal>
      )}"""

if old_selesai in content:
    content = content.replace(old_selesai, new_selesai)
    print("✅ Busbar section added to modal")
else:
    print("❌ Selesai button not found")

# Fix 2: Tambah busbar badges di cell - cari plus icon
old_plus = """                        <div onClick={()=>openCellModal(row.id,d)}
                          style={{display:"flex",flexDirection:"column" as const,alignItems:"center",gap:1,cursor:"pointer",padding:"2px",borderRadius:4,minHeight:20,justifyContent:"center"}}>"""

new_plus = """                        <div onClick={()=>openCellModal(row.id,d)}
                          style={{display:"flex",flexDirection:"column" as const,alignItems:"center",gap:1,cursor:"pointer",padding:"2px",borderRadius:4,minHeight:20,justifyContent:"center"}}>
                          {row.proses==="BUSBAR"&&busbarEntries.length>0&&entries.length===0&&(
                            <div style={{display:"flex",gap:2,flexWrap:"wrap" as const,justifyContent:"center",marginBottom:2}}>
                              {busbarEntries.map((b:string)=>(
                                <span key={b} style={{background:(BUSBAR_COLORS[b]||"#64748b")+"22",
                                  color:BUSBAR_COLORS[b]||"#64748b",
                                  border:`1px solid ${BUSBAR_COLORS[b]||"#64748b"}44`,
                                  borderRadius:4,padding:"1px 4px",fontSize:8,fontWeight:700}}>
                                  {b}
                                </span>
                              ))}
                            </div>
                          )}"""

if old_plus in content:
    content = content.replace(old_plus, new_plus)
    print("✅ Busbar badges in cell added")
else:
    print("⚠️  Cell plus div not found - trying alternate")
    lines = content.splitlines()
    for i, l in enumerate(lines[3260:3285], 3261):
        if 'openCellModal' in l or 'flexDirection' in l:
            print(f"  {i}: {l.strip()[:80]}")

APP_PATH.write_text(content, encoding="utf-8")
print("\n✅ Selesai!")
