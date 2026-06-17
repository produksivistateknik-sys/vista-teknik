file_path = r"C:\Users\User\vista-teknik\src\App.tsx"

with open(file_path, "r", encoding="utf-8", errors="replace") as f:
    content = f.read()

with open(file_path + ".bak_proctime_grouped2", "w", encoding="utf-8", errors="replace") as f:
    f.write(content)
print("[OK] Backup dibuat")

# Replace bagian table header sampai akhir tbody+table+div untuk pakai groupItems
OLD_TABLE = """          {/* Tabel process time */}
          <div style={{overflowX:"auto" as const,borderRadius:10,border:"1px solid #e2e8f0"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
              <thead><tr>
                <th style={thS}>Kode</th>
                <th style={thS}>Nama Komponen</th>
                <th style={{...thS,textAlign:"center" as const}}>Tipe Panel</th>
                <th style={{...thS,textAlign:"center" as const}}>WP</th>
                <th style={thS}>Jenis Pekerjaan</th>
                <th style={{...thS,textAlign:"center" as const}}>Menit/Pcs</th>
                <th style={{...thS,textAlign:"center" as const}}>Aksi</th>
              </tr></thead>
              <tbody>
                {filteredProcess.length===0?(
                  <tr><td colSpan={7} style={{textAlign:"center",padding:40,color:"#94a3b8"}}>
                    <div style={{fontSize:28,marginBottom:8}}>\U0001f4cb</div>
                    <div style={{fontWeight:600,fontSize:13,marginBottom:4}}>Belum ada data process time untuk {filterTipe}</div>
                    <div style={{fontSize:11}}>Klik tombol + Tambah untuk input data manual</div>
                  </td></tr>
                ):filteredProcess.map((p:any,i:number)=>{
                  const rBg=i%2===0?"#fff":"#f8fafc";
                  const td:any={padding:"7px 12px",borderBottom:"1px solid #f1f5f9",borderRight:"1px solid #f1f5f9",background:rBg,verticalAlign:"middle"};
                  return(
                    <tr key={p.id}>
                      <td style={{...td,fontFamily:"monospace",fontWeight:700,color:"#1d4ed8"}}>{p.kode_komponen}</td>
                      <td style={{...td,fontWeight:500,color:"#1e293b"}}>{p.nama_komponen}</td>
                      <td style={{...td,textAlign:"center" as const}}>
                        <span style={{background:"#eff6ff",color:"#1d4ed8",borderRadius:20,padding:"1px 8px",fontSize:10,fontWeight:700}}>{p.tipe_panel}</span>
                      </td>
                      <td style={{...td,textAlign:"center" as const}}>
                        <span style={{background:"#f1f5f9",color:"#475569",borderRadius:20,padding:"1px 8px",fontSize:10,fontWeight:700}}>{p.wp}</span>
                      </td>
                      <td style={td}>
                        <span style={{background:"#fafafa",color:"#475569",borderRadius:6,padding:"2px 8px",fontSize:10,fontWeight:600,border:"1px solid #e2e8f0"}}>{p.jenis_pekerjaan}</span>
                      </td>
                      <td style={{...td,textAlign:"center" as const}}>
                        <span style={{fontWeight:800,fontSize:13,color:p.menit_per_pcs>0?"#1d4ed8":"#94a3b8"}}>{p.menit_per_pcs}</span>
                        <span style={{fontSize:10,color:"#94a3b8",marginLeft:3}}>mnt</span>
                      </td>
                      <td style={{...td,textAlign:"center" as const}}>
                        <div style={{display:"flex",gap:5,justifyContent:"center"}}>
                          <button onClick={()=>{setEditProc(p);setShowAddProc(true);setProcForm({kode_komponen:p.kode_komponen,nama_komponen:p.nama_komponen,tipe_panel:p.tipe_panel,wp:p.wp,jenis_pekerjaan:p.jenis_pekerjaan,menit_per_pcs:p.menit_per_pcs});}}
                            style={{background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:6,padding:"3px 8px",cursor:"pointer",fontSize:11,color:"#475569"}}>\u270f\ufe0f</button>
                          <button onClick={()=>deleteProcess(p.id)}
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

NEW_TABLE = """                <div style={{overflowX:"auto" as const,borderRadius:10,border:"1px solid #e2e8f0"}}>
                  <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                    <thead><tr>
                      <th style={thS}>Kode</th>
                      <th style={thS}>Nama Komponen</th>
                      <th style={{...thS,textAlign:"center" as const}}>Tipe Panel</th>
                      <th style={{...thS,textAlign:"center" as const}}>WP</th>
                      <th style={{...thS,textAlign:"center" as const}}>Menit/Pcs</th>
                      <th style={{...thS,textAlign:"center" as const}}>Aksi</th>
                    </tr></thead>
                    <tbody>
                      {groupItems.map((p:any,i:number)=>{
                        const rBg=i%2===0?"#fff":"#f8fafc";
                        const td:any={padding:"7px 12px",borderBottom:"1px solid #f1f5f9",borderRight:"1px solid #f1f5f9",background:rBg,verticalAlign:"middle"};
                        return(
                          <tr key={p.id}>
                            <td style={{...td,fontFamily:"monospace",fontWeight:700,color:"#1d4ed8"}}>{p.kode_komponen}</td>
                            <td style={{...td,fontWeight:500,color:"#1e293b"}}>{p.nama_komponen}</td>
                            <td style={{...td,textAlign:"center" as const}}>
                              <span style={{background:"#eff6ff",color:"#1d4ed8",borderRadius:20,padding:"1px 8px",fontSize:10,fontWeight:700}}>{p.tipe_panel}</span>
                            </td>
                            <td style={{...td,textAlign:"center" as const}}>
                              <span style={{background:"#f1f5f9",color:"#475569",borderRadius:20,padding:"1px 8px",fontSize:10,fontWeight:700}}>{p.wp}</span>
                            </td>
                            <td style={{...td,textAlign:"center" as const}}>
                              <span style={{fontWeight:800,fontSize:13,color:p.menit_per_pcs>0?"#1d4ed8":"#94a3b8"}}>{p.menit_per_pcs}</span>
                              <span style={{fontSize:10,color:"#94a3b8",marginLeft:3}}>mnt</span>
                            </td>
                            <td style={{...td,textAlign:"center" as const}}>
                              <div style={{display:"flex",gap:5,justifyContent:"center"}}>
                                <button onClick={()=>{setEditProc(p);setShowAddProc(true);setProcForm({kode_komponen:p.kode_komponen,nama_komponen:p.nama_komponen,tipe_panel:p.tipe_panel,wp:p.wp,jenis_pekerjaan:p.jenis_pekerjaan,menit_per_pcs:p.menit_per_pcs});}}
                                  style={{background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:6,padding:"3px 8px",cursor:"pointer",fontSize:11,color:"#475569"}}>\u270f\ufe0f</button>
                                <button onClick={()=>deleteProcess(p.id)}
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
            );
          })}

          {filteredProcess.length===0&&(
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

ok = OLD_TABLE in content
print(f"  TABLE: {'FOUND' if ok else 'MISSING'}")

if ok:
    content = content.replace(OLD_TABLE, NEW_TABLE)
    with open(file_path, "w", encoding="utf-8", errors="replace") as f:
        f.write(content)
    print("[OK] Tabel berhasil diwrap per group jenis pekerjaan")
    print("[INFO] Jalankan: npm run build")
else:
    print("Pattern tidak exact match, perlu cek manual")
