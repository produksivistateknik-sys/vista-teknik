file_path = r"C:\Users\User\vista-teknik\src\App.tsx"

with open(file_path, "r", encoding="utf-8", errors="replace") as f:
    content = f.read()

with open(file_path + ".bak_override_rentang_ui3", "w", encoding="utf-8", errors="replace") as f:
    f.write(content)
print("[OK] Backup dibuat")

OLD_MARKER = '          <div style={{background:"#f0f8ff",borderRadius:10,border:"1.5px solid #bfdbfe",padding:"14px 16px",marginBottom:16}}>\n            <div style={{fontWeight:700,fontSize:13,color:"#1e293b",marginBottom:12}}>{editOverride?'

count_before = content.count(OLD_MARKER)
print(f"  Marker occurrences before: {count_before}")

TOGGLE_AND_RENTANG = '''          <div style={{display:"flex",gap:2,marginBottom:14,background:"#f1f5f9",borderRadius:8,padding:3,width:"fit-content"}}>
            {[{id:"single",l:"Satu Tanggal"},{id:"rentang",l:"\U0001f4c5 Rentang Tanggal"}].map(m=>(
              <button key={m.id} onClick={()=>{setOverrideMode(m.id as any);setEditOverride(null);setRentangResult(null);}}
                style={{padding:"6px 14px",borderRadius:6,border:"none",cursor:"pointer",fontSize:11,
                  fontWeight:overrideMode===m.id?700:500,
                  background:overrideMode===m.id?"#fff":"transparent",
                  color:overrideMode===m.id?"#1d4ed8":"#64748b",
                  boxShadow:overrideMode===m.id?"0 1px 3px #00000015":"none",fontFamily:"inherit"}}>
                {m.l}
              </button>
            ))}
          </div>

          {overrideMode==="rentang"&&(
            <div style={{background:"#fdf4ff",borderRadius:10,border:"1.5px solid #e9d5ff",padding:"14px 16px",marginBottom:16}}>
              <div style={{fontWeight:700,fontSize:13,color:"#1e293b",marginBottom:12}}>\U0001f4c5 Tambah Override untuk Rentang Tanggal</div>
              <div style={{display:"grid",gridTemplateColumns:"140px 140px 1fr",gap:10,marginBottom:10}}>
                <div>
                  <div style={{fontSize:10,fontWeight:700,color:"#64748b",textTransform:"uppercase" as const,letterSpacing:.4,marginBottom:4}}>Tanggal Mulai</div>
                  <input type="date" value={rentangForm.tanggalMulai}
                    onChange={e=>setRentangForm({...rentangForm,tanggalMulai:e.target.value})}
                    style={{width:"100%",padding:"7px 10px",borderRadius:7,border:"1.5px solid #e2e8f0",fontSize:12}}/>
                </div>
                <div>
                  <div style={{fontSize:10,fontWeight:700,color:"#64748b",textTransform:"uppercase" as const,letterSpacing:.4,marginBottom:4}}>Tanggal Akhir</div>
                  <input type="date" value={rentangForm.tanggalAkhir}
                    onChange={e=>setRentangForm({...rentangForm,tanggalAkhir:e.target.value})}
                    style={{width:"100%",padding:"7px 10px",borderRadius:7,border:"1.5px solid #e2e8f0",fontSize:12}}/>
                </div>
                <div>
                  <div style={{fontSize:10,fontWeight:700,color:"#64748b",textTransform:"uppercase" as const,letterSpacing:.4,marginBottom:4}}>Hari Aktif</div>
                  <div style={{display:"flex",gap:4}}>
                    {[1,2,3,4,5,6,7].map(h=>{
                      const active=rentangForm.hariAktif.includes(h);
                      return(
                        <button key={h} onClick={()=>toggleHariRentang(h)}
                          style={{width:32,height:30,borderRadius:6,border:`1.5px solid ${active?"#9333ea":"#e2e8f0"}`,
                            background:active?"#9333ea":"#f8fafc",color:active?"#fff":"#94a3b8",
                            fontSize:10,fontWeight:700,cursor:"pointer"}}>
                          {HARI_LABEL_OV[h]}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"160px 100px 100px 1fr",gap:10,alignItems:"flex-end"}}>
                <div>
                  <div style={{fontSize:10,fontWeight:700,color:"#64748b",textTransform:"uppercase" as const,letterSpacing:.4,marginBottom:4}}>Jenis Pekerjaan</div>
                  <select value={rentangForm.jenis_pekerjaan} onChange={e=>setRentangForm({...rentangForm,jenis_pekerjaan:e.target.value})}
                    style={{width:"100%",padding:"7px 10px",borderRadius:7,border:"1.5px solid #e2e8f0",fontSize:12}}>
                    {["POTONG","BENDING","STEL","PAINTING","RAKIT","PASANG KOMPONEN","BUSBAR","WIRING CONTROL","WIRING POWER","QC TEST","PACKING"].map(p=>(
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <div style={{fontSize:10,fontWeight:700,color:"#64748b",textTransform:"uppercase" as const,letterSpacing:.4,marginBottom:4}}>Jam Kerja</div>
                  <input type="number" min="0" step="0.5" value={rentangForm.jam_kerja}
                    onChange={e=>setRentangForm({...rentangForm,jam_kerja:parseFloat(e.target.value)||0})}
                    style={{width:"100%",padding:"7px 10px",borderRadius:7,border:"1.5px solid #e2e8f0",fontSize:12,textAlign:"center" as const}}/>
                </div>
                <div>
                  <div style={{fontSize:10,fontWeight:700,color:"#64748b",textTransform:"uppercase" as const,letterSpacing:.4,marginBottom:4}}>Efekt. %</div>
                  <input type="number" min="0" max="100" step="1" value={rentangForm.efektivitas_pct}
                    onChange={e=>setRentangForm({...rentangForm,efektivitas_pct:parseFloat(e.target.value)||0})}
                    style={{width:"100%",padding:"7px 10px",borderRadius:7,border:"1.5px solid #e2e8f0",fontSize:12,textAlign:"center" as const}}/>
                </div>
                <div>
                  <div style={{fontSize:10,fontWeight:700,color:"#64748b",textTransform:"uppercase" as const,letterSpacing:.4,marginBottom:4}}>Keterangan</div>
                  <input value={rentangForm.keterangan} onChange={e=>setRentangForm({...rentangForm,keterangan:e.target.value})}
                    placeholder="opsional..."
                    style={{width:"100%",padding:"7px 10px",borderRadius:7,border:"1.5px solid #e2e8f0",fontSize:12}}/>
                </div>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:12}}>
                <div style={{background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:7,padding:"6px 12px",fontSize:12,color:"#16a34a",fontWeight:600}}>
                  {rentangForm.jam_kerja} jam \u00d7 60 \u00d7 {rentangForm.efektivitas_pct}% = <strong>{Math.round(rentangForm.jam_kerja*60*rentangForm.efektivitas_pct/100)} menit</strong>/hari
                </div>
                <button disabled={rentangSaving} onClick={saveRentangOverride}
                  style={{padding:"7px 18px",borderRadius:7,border:"none",background:rentangSaving?"#94a3b8":"#9333ea",color:"#fff",fontSize:12,fontWeight:700,cursor:rentangSaving?"not-allowed":"pointer",fontFamily:"inherit"}}>
                  {rentangSaving?"\u23f3 Menyimpan...":"\U0001f4c5 Generate Rentang"}
                </button>
              </div>
              {rentangResult&&(
                <div style={{marginTop:10,background:rentangResult.skip>0?"#fffbeb":"#f0fdf4",border:`1px solid ${rentangResult.skip>0?"#fde68a":"#bbf7d0"}`,borderRadius:7,padding:"8px 12px",fontSize:12,color:rentangResult.skip>0?"#92400e":"#16a34a"}}>
                  \u2705 {rentangResult.sukses} tanggal berhasil diatur{rentangResult.skip>0?`, ${rentangResult.skip} dilewati (sudah ada override sebelumnya)`:""}.
                </div>
              )}
            </div>
          )}

          {overrideMode==="single"&&(
'''

new_marker = TOGGLE_AND_RENTANG + OLD_MARKER

if count_before == 1:
    content = content.replace(OLD_MARKER, new_marker, 1)
    
    # Sekarang bungkus closing form lama dengan )}
    OLD_FORM_END = '''              </div>
            </div>
          </div>

          <div style={{overflowX:"auto" as const,borderRadius:10,border:"1px solid #e2e8f0"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>'''
    NEW_FORM_END = '''              </div>
            </div>
          </div>
          )}

          <div style={{overflowX:"auto" as const,borderRadius:10,border:"1px solid #e2e8f0"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>'''
    
    count_end = content.count(OLD_FORM_END)
    print(f"  FORM_END occurrences: {count_end}")
    
    if count_end == 1:
        content = content.replace(OLD_FORM_END, NEW_FORM_END, 1)
        with open(file_path, "w", encoding="utf-8", errors="replace") as f:
            f.write(content)
        print("[OK] Toggle mode + form rentang berhasil ditambah, form single dibungkus kondisi")
        print("[INFO] Jalankan: npm run build")
    else:
        print(f"[FAIL] FORM_END occurrences = {count_end}, bukan 1. TIDAK menyimpan apapun")
else:
    print(f"[FAIL] Marker occurrences = {count_before}, bukan 1. TIDAK menyimpan apapun")
