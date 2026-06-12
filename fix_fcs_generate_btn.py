file_path = r"C:\Users\User\vista-teknik\src\App.tsx"

with open(file_path, "r", encoding="utf-8") as f:
    lines = f.readlines()

with open(file_path + ".bak_fcs_btn", "w", encoding="utf-8") as f:
    f.writelines(lines)
print("[OK] Backup dibuat")

# Fix 1: Import
OLD_IMPORT = "import { activityLogService } from './services/activityLogService'\n"
NEW_IMPORT = "import { activityLogService } from './services/activityLogService'\nimport { generateFCSSchedule } from './services/fcsService'\n"

# Fix 2: State
OLD_STATE = "  const blank={wo:\"\",proyek:\"\",target:\"\"};\n  const blankPanel={noPnl:\"\",nama:\"\",tipe:\"FS\",qty:1};\n"
NEW_STATE = "  const blank={wo:\"\",proyek:\"\",target:\"\"};\n  const blankPanel={noPnl:\"\",nama:\"\",tipe:\"FS\",qty:1};\n  const [fcsModal,setFcsModal]=useState<any>(null);\n  const [fcsLoading,setFcsLoading]=useState(false);\n  const [fcsResult,setFcsResult]=useState<any>(null);\n  const [fcsForm,setFcsForm]=useState({tanggalMulai:new Date().toISOString().slice(0,10),jenisPekerjaan:\"POTONG\"});\n"

# Cari baris OPERATOR VIEW untuk insert modal sebelumnya
op_view_idx = None
for i, l in enumerate(lines):
    if 'OPERATOR VIEW' in l and i > 4400:
        op_view_idx = i
        break

print(f"  OPERATOR VIEW di baris: {op_view_idx+1 if op_view_idx else 'NOT FOUND'}")

# Fix 3: Cari dan replace tombol
content = "".join(lines)

OLD_BTNS = """                <button onClick={()=>{setForm({wo:wo.wo,proyek:wo.proyek,target:wo.target});setPanels(wo.panels.map(p=>({noPnl:p.noPnl,nama:p.nama,tipe:p.tipe,qty:p.qty})));setEditId(wo.id);setOpen(true);}}
                  style={{padding:"5px 14px",borderRadius:7,border:"1px solid #e2e8f0",background:"#f8fafc",color:"#475569",cursor:"pointer",fontSize:12,fontWeight:600}}>\u270f\ufe0f Edit</button>
                <button onClick={()=>setDelId(wo.id)}
                  style={{padding:"5px 14px",borderRadius:7,border:"1px solid #fecaca",background:"#fef2f2",color:"#dc2626",cursor:"pointer",fontSize:12,fontWeight:600}}>\U0001f5d1</button>"""

NEW_BTNS = """                <button onClick={()=>{setForm({wo:wo.wo,proyek:wo.proyek,target:wo.target});setPanels(wo.panels.map(p=>({noPnl:p.noPnl,nama:p.nama,tipe:p.tipe,qty:p.qty})));setEditId(wo.id);setOpen(true);}}
                  style={{padding:"5px 14px",borderRadius:7,border:"1px solid #e2e8f0",background:"#f8fafc",color:"#475569",cursor:"pointer",fontSize:12,fontWeight:600}}>\u270f\ufe0f Edit</button>
                <button onClick={()=>{setFcsModal(wo);setFcsResult(null);setFcsForm({tanggalMulai:new Date().toISOString().slice(0,10),jenisPekerjaan:"POTONG"});}}
                  style={{padding:"5px 14px",borderRadius:7,border:"1px solid #bbf7d0",background:"#f0fdf4",color:"#16a34a",cursor:"pointer",fontSize:12,fontWeight:600}}>\u23f1 FCS</button>
                <button onClick={()=>setDelId(wo.id)}
                  style={{padding:"5px 14px",borderRadius:7,border:"1px solid #fecaca",background:"#fef2f2",color:"#dc2626",cursor:"pointer",fontSize:12,fontWeight:600}}>\U0001f5d1</button>"""

FCS_MODAL = """      {fcsModal&&(
        <Modal title={"\u23f1 Generate FCS \u2014 WO "+fcsModal.wo} onClose={()=>{setFcsModal(null);setFcsResult(null);}} width={520}>
          <div style={{fontSize:12,color:"#64748b",marginBottom:16}}>
            <strong>{fcsModal.proyek}</strong> \u00b7 {(fcsModal.panels||[]).length} panel \u00b7 Target: {fcsModal.target}
          </div>
          {!fcsResult?(
            <div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
                <div>
                  <div style={{fontSize:11,fontWeight:700,color:"#64748b",textTransform:"uppercase" as const,letterSpacing:.4,marginBottom:6}}>Tanggal Mulai</div>
                  <input type="date" value={fcsForm.tanggalMulai}
                    onChange={e=>setFcsForm({...fcsForm,tanggalMulai:e.target.value})}
                    style={{width:"100%",padding:"8px 12px",borderRadius:8,border:"1.5px solid #e2e8f0",fontSize:13,fontFamily:"inherit"}}/>
                </div>
                <div>
                  <div style={{fontSize:11,fontWeight:700,color:"#64748b",textTransform:"uppercase" as const,letterSpacing:.4,marginBottom:6}}>Jenis Pekerjaan</div>
                  <select value={fcsForm.jenisPekerjaan} onChange={e=>setFcsForm({...fcsForm,jenisPekerjaan:e.target.value})}
                    style={{width:"100%",padding:"8px 12px",borderRadius:8,border:"1.5px solid #e2e8f0",fontSize:13,fontFamily:"inherit"}}>
                    {["POTONG","BENDING","STEL","PAINTING","RAKIT","PASANG KOMPONEN","BUSBAR","WIRING CONTROL","WIRING POWER","QC TEST","PACKING"].map(p=>(
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div style={{background:"#fffbeb",border:"1px solid #fde68a",borderRadius:8,padding:"10px 14px",marginBottom:16,fontSize:12,color:"#92400e"}}>
                \u26a0\ufe0f Schedule lama status Planning untuk WO ini akan digantikan jadwal baru.
              </div>
              <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
                <button onClick={()=>setFcsModal(null)}
                  style={{padding:"8px 16px",borderRadius:8,border:"1px solid #e2e8f0",background:"#f8fafc",color:"#64748b",fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>Batal</button>
                <button disabled={fcsLoading} onClick={async()=>{
                  setFcsLoading(true);
                  const sess=JSON.parse(localStorage.getItem("vista_admin_session")||"{}");
                  const uname=user?.name||user?.nama||sess?.nama||"Admin";
                  const panels=fcsModal.panels||[];
                  let totalCount=0;const errors:string[]=[];
                  for(const panel of panels){
                    const res=await generateFCSSchedule({
                      woId:fcsModal.id,woNumber:fcsModal.wo,proyek:fcsModal.proyek,
                      panelId:panel.id,panelNama:panel.nama,tipePanel:panel.tipe,
                      checklist:panel.checklist||{},
                      jenisPekerjaan:fcsForm.jenisPekerjaan,
                      tanggalMulai:fcsForm.tanggalMulai,
                      generatedBy:uname,
                    });
                    if(res.success)totalCount+=res.count;
                    else errors.push(panel.nama+": "+(res.error||"Error"));
                  }
                  setFcsResult({totalCount,errors,panels:panels.length});
                  setFcsLoading(false);
                }}
                  style={{padding:"8px 20px",borderRadius:8,border:"none",background:fcsLoading?"#94a3b8":"#16a34a",color:"#fff",fontSize:12,fontWeight:700,cursor:fcsLoading?"not-allowed":"pointer",fontFamily:"inherit"}}>
                  {fcsLoading?"Generating...":"\u23f1 Generate Schedule"}
                </button>
              </div>
            </div>
          ):(
            <div>
              {fcsResult.errors.length===0?(
                <div style={{textAlign:"center",padding:"20px 0"}}>
                  <div style={{fontSize:40,marginBottom:12}}>\u2705</div>
                  <div style={{fontSize:16,fontWeight:700,color:"#16a34a",marginBottom:8}}>Schedule Berhasil!</div>
                  <div style={{fontSize:13,color:"#64748b",marginBottom:4}}>{fcsResult.panels} panel \u00b7 {fcsResult.totalCount} baris jadwal</div>
                  <div style={{fontSize:12,color:"#94a3b8"}}>Pekerjaan: <strong>{fcsForm.jenisPekerjaan}</strong> \u00b7 Mulai: <strong>{fcsForm.tanggalMulai}</strong></div>
                </div>
              ):(
                <div>
                  <div style={{fontSize:13,fontWeight:600,color:"#1e293b",marginBottom:8}}>{fcsResult.totalCount} jadwal berhasil, {fcsResult.errors.length} error:</div>
                  {fcsResult.errors.map((e:string,i:number)=>(
                    <div key={i} style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:6,padding:"8px 12px",marginBottom:6,fontSize:12,color:"#dc2626"}}>{e}</div>
                  ))}
                </div>
              )}
              <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:16}}>
                <button onClick={()=>{setFcsModal(null);setFcsResult(null);}}
                  style={{padding:"8px 16px",borderRadius:8,border:"none",background:"#1d4ed8",color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Tutup</button>
              </div>
            </div>
          )}
        </Modal>
      )}
"""

ok_import = OLD_IMPORT in content
ok_state = OLD_STATE in content
ok_btns = OLD_BTNS in content
print(f"  IMPORT: {'FOUND' if ok_import else 'MISSING'}")
print(f"  STATE:  {'FOUND' if ok_state else 'MISSING'}")
print(f"  BTNS:   {'FOUND' if ok_btns else 'MISSING'}")

if ok_import and ok_state and ok_btns and op_view_idx:
    content = content.replace(OLD_IMPORT, NEW_IMPORT)
    content = content.replace(OLD_STATE, NEW_STATE)
    content = content.replace(OLD_BTNS, NEW_BTNS)

    # Insert modal sebelum baris OPERATOR VIEW
    new_lines = content.split("\n")
    # Cari ulang operator view di content baru
    insert_idx = None
    for i, l in enumerate(new_lines):
        if 'OPERATOR VIEW' in l and i > 4400:
            insert_idx = i - 2  # insert sebelum closing brace + comment
            break

    if insert_idx:
        new_lines.insert(insert_idx, FCS_MODAL)
        content = "\n".join(new_lines)
        print(f"[OK] Modal FCS disisipkan di baris ~{insert_idx}")

    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)
    print("[OK] Semua perubahan berhasil diterapkan")
    print("[INFO] Jalankan: npm run build")
else:
    if not ok_state:
        lines2 = content.split("\n")
        for i,l in enumerate(lines2):
            if 'const blank={wo:' in l and i > 4188:
                print(f"STATE baris {i+1}: {repr(l[:80])}")
                print(f"STATE baris {i+2}: {repr(lines2[i+1][:80])}")
                break
