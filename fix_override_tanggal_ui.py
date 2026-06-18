file_path = r"C:\Users\User\vista-teknik\src\App.tsx"

with open(file_path, "r", encoding="utf-8", errors="replace") as f:
    content = f.read()

with open(file_path + ".bak_override_ui", "w", encoding="utf-8", errors="replace") as f:
    f.write(content)
print("[OK] Backup dibuat")

# Cari penutup KapasitasPekerjaanTab yang unik: pattern filteredProcess.length===0 closing + )}+</div>+);+}
OLD_CLOSE = """          {filteredProcess.length===0&&(
            <div style={{textAlign:"center",padding:40,color:"#94a3b8",background:"#fff",borderRadius:10,border:"1px solid #e2e8f0"}}>
              <div style={{fontSize:28,marginBottom:8}}>\U0001f4cb</div>
              <div style={{fontWeight:600,fontSize:13,marginBottom:4}}>Belum ada data process time untuk {filterTipe}</div>
              <div style={{fontSize:11}}>Klik tombol + Tambah untuk input data manual</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}"""

NEW_CLOSE = """          {filteredProcess.length===0&&(
            <div style={{textAlign:"center",padding:40,color:"#94a3b8",background:"#fff",borderRadius:10,border:"1px solid #e2e8f0"}}>
              <div style={{fontSize:28,marginBottom:8}}>\U0001f4cb</div>
              <div style={{fontWeight:600,fontSize:13,marginBottom:4}}>Belum ada data process time untuk {filterTipe}</div>
              <div style={{fontSize:11}}>Klik tombol + Tambah untuk input data manual</div>
            </div>
          )}
        </div>
      )}

      {/* TAB: Override Tanggal */}
      {activeTab==="override"&&(
        <div>
          <div style={{fontSize:12,color:"#64748b",marginBottom:14}}>
            Atur jam kerja khusus per tanggal per jenis pekerjaan. Tanggal tanpa override dianggap tidak ada kapasitas (0 menit).
          </div>

          <div style={{background:"#f0f8ff",borderRadius:10,border:"1.5px solid #bfdbfe",padding:"14px 16px",marginBottom:16}}>
            <div style={{fontWeight:700,fontSize:13,color:"#1e293b",marginBottom:12}}>{editOverride?"\u270f\ufe0f Edit Override":"\u2795 Tambah Override"}</div>
            <div style={{display:"grid",gridTemplateColumns:"140px 160px 100px 100px 1fr",gap:10,alignItems:"flex-end"}}>
              <div>
                <div style={{fontSize:10,fontWeight:700,color:"#64748b",textTransform:"uppercase" as const,letterSpacing:.4,marginBottom:4}}>Tanggal</div>
                <input type="date" value={overrideForm.tanggal} disabled={!!editOverride}
                  onChange={e=>setOverrideForm({...overrideForm,tanggal:e.target.value})}
                  style={{width:"100%",padding:"7px 10px",borderRadius:7,border:"1.5px solid #e2e8f0",fontSize:12,background:editOverride?"#f1f5f9":"#fff"}}/>
              </div>
              <div>
                <div style={{fontSize:10,fontWeight:700,color:"#64748b",textTransform:"uppercase" as const,letterSpacing:.4,marginBottom:4}}>Jenis Pekerjaan</div>
                <select value={overrideForm.jenis_pekerjaan} disabled={!!editOverride}
                  onChange={e=>setOverrideForm({...overrideForm,jenis_pekerjaan:e.target.value})}
                  style={{width:"100%",padding:"7px 10px",borderRadius:7,border:"1.5px solid #e2e8f0",fontSize:12,background:editOverride?"#f1f5f9":"#fff"}}>
                  {["POTONG","BENDING","STEL","PAINTING","RAKIT","PASANG KOMPONEN","BUSBAR","WIRING CONTROL","WIRING POWER","QC TEST","PACKING"].map(p=>(
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
              <div>
                <div style={{fontSize:10,fontWeight:700,color:"#64748b",textTransform:"uppercase" as const,letterSpacing:.4,marginBottom:4}}>Jam Kerja</div>
                <input type="number" min="0" step="0.5" value={overrideForm.jam_kerja}
                  onChange={e=>setOverrideForm({...overrideForm,jam_kerja:parseFloat(e.target.value)||0})}
                  style={{width:"100%",padding:"7px 10px",borderRadius:7,border:"1.5px solid #e2e8f0",fontSize:12,textAlign:"center" as const}}/>
              </div>
              <div>
                <div style={{fontSize:10,fontWeight:700,color:"#64748b",textTransform:"uppercase" as const,letterSpacing:.4,marginBottom:4}}>Efekt. %</div>
                <input type="number" min="0" max="100" step="1" value={overrideForm.efektivitas_pct}
                  onChange={e=>setOverrideForm({...overrideForm,efektivitas_pct:parseFloat(e.target.value)||0})}
                  style={{width:"100%",padding:"7px 10px",borderRadius:7,border:"1.5px solid #e2e8f0",fontSize:12,textAlign:"center" as const}}/>
              </div>
              <div>
                <div style={{fontSize:10,fontWeight:700,color:"#64748b",textTransform:"uppercase" as const,letterSpacing:.4,marginBottom:4}}>Keterangan</div>
                <input value={overrideForm.keterangan} onChange={e=>setOverrideForm({...overrideForm,keterangan:e.target.value})}
                  placeholder="opsional..."
                  style={{width:"100%",padding:"7px 10px",borderRadius:7,border:"1.5px solid #e2e8f0",fontSize:12}}/>
              </div>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:12}}>
              <div style={{background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:7,padding:"6px 12px",fontSize:12,color:"#16a34a",fontWeight:600}}>
                {overrideForm.jam_kerja} jam \u00d7 60 \u00d7 {overrideForm.efektivitas_pct}% = <strong>{Math.round(overrideForm.jam_kerja*60*overrideForm.efektivitas_pct/100)} menit</strong>
              </div>
              <div style={{display:"flex",gap:8}}>
                {editOverride&&(
                  <button onClick={()=>{setEditOverride(null);setOverrideForm({tanggal:new Date().toISOString().slice(0,10),jenis_pekerjaan:"POTONG",jam_kerja:8,efektivitas_pct:80,keterangan:""});}}
                    style={{padding:"7px 14px",borderRadius:7,border:"1px solid #e2e8f0",background:"#f8fafc",color:"#64748b",fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>Batal</button>
                )}
                <button onClick={saveOverride}
                  style={{padding:"7px 18px",borderRadius:7,border:"none",background:"#1d4ed8",color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>{editOverride?"Simpan":"+ Tambah"}</button>
              </div>
            </div>
          </div>

          <div style={{overflowX:"auto" as const,borderRadius:10,border:"1px solid #e2e8f0"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
              <thead><tr>
                <th style={thS}>Tanggal</th>
                <th style={thS}>Jenis Pekerjaan</th>
                <th style={{...thS,textAlign:"center" as const}}>Jam</th>
                <th style={{...thS,textAlign:"center" as const}}>Efekt.</th>
                <th style={{...thS,textAlign:"right" as const}}>Kapasitas</th>
                <th style={thS}>Keterangan</th>
                <th style={{...thS,textAlign:"center" as const}}>Aksi</th>
              </tr></thead>
              <tbody>
                {overrideList.length===0?(
                  <tr><td colSpan={7} style={{textAlign:"center",padding:32,color:"#94a3b8"}}>Belum ada override. Tanggal tanpa override = 0 kapasitas.</td></tr>
                ):overrideList.map((o:any,i:number)=>{
                  const rBg=i%2===0?"#fff":"#f8fafc";
                  const td:any={padding:"7px 12px",borderBottom:"1px solid #f1f5f9",borderRight:"1px solid #f1f5f9",background:rBg,verticalAlign:"middle"};
                  return(
                    <tr key={o.id}>
                      <td style={{...td,fontWeight:700,color:"#1e293b"}}>{new Date(o.tanggal).toLocaleDateString("id-ID",{day:"numeric",month:"short",year:"numeric"})}</td>
                      <td style={td}><span style={{background:"#f1f5f9",borderRadius:6,padding:"2px 10px",fontSize:11,fontWeight:700,color:"#475569"}}>{o.jenis_pekerjaan}</span></td>
                      <td style={{...td,textAlign:"center" as const}}>{o.jam_kerja}</td>
                      <td style={{...td,textAlign:"center" as const,color:"#64748b"}}>{o.efektivitas_pct}%</td>
                      <td style={{...td,textAlign:"right" as const,fontWeight:800,color:"#1d4ed8"}}>{Math.round(o.kapasitas_menit)} mnt</td>
                      <td style={{...td,fontSize:11,color:"#64748b"}}>{o.keterangan||"\u2014"}</td>
                      <td style={{...td,textAlign:"center" as const}}>
                        <div style={{display:"flex",gap:5,justifyContent:"center"}}>
                          <button onClick={()=>{setEditOverride(o);setOverrideForm({tanggal:o.tanggal,jenis_pekerjaan:o.jenis_pekerjaan,jam_kerja:o.jam_kerja,efektivitas_pct:o.efektivitas_pct,keterangan:o.keterangan||""});}}
                            style={{background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:6,padding:"3px 8px",cursor:"pointer",fontSize:11,color:"#475569"}}>\u270f\ufe0f</button>
                          <button onClick={()=>deleteOverride(o.id)}
                            style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:6,padding:"3px 8px",cursor:"pointer",fontSize:11,color:"#dc2626"}}>\U0001f5d1</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}"""

ok = OLD_CLOSE in content
print(f"  PATTERN: {'FOUND' if ok else 'MISSING'}")

if ok:
    content = content.replace(OLD_CLOSE, NEW_CLOSE)
    with open(file_path, "w", encoding="utf-8", errors="replace") as f:
        f.write(content)
    print("[OK] UI tab Override Tanggal berhasil ditambah")
    print("[INFO] Jalankan: npm run build")
