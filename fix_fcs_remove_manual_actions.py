file_path = r"C:\Users\User\vista-teknik\src\App.tsx"

with open(file_path, "r", encoding="utf-8", errors="replace") as f:
    content = f.read()

with open(file_path + ".bak_fcs_remove_actions", "w", encoding="utf-8", errors="replace") as f:
    f.write(content)
print("[OK] Backup dibuat")

# Fix 1: Ganti kolom Aksi jadi indikator timestamp otomatis
OLD_ACTION_CELL = """                    <td style={{...td,textAlign:"center" as const}}>
                      {s.status==="planning"&&(
                        <button onClick={()=>setApproveId(s)}
                          style={{background:"#eff6ff",border:"1px solid #bfdbfe",borderRadius:6,padding:"3px 8px",cursor:"pointer",fontSize:10,color:"#1d4ed8",fontWeight:700}}>
                          Release
                        </button>
                      )}
                      {s.status==="released"&&(
                        <button onClick={()=>updateStatus(s.id,"in_progress")}
                          style={{background:"#fffbeb",border:"1px solid #fde68a",borderRadius:6,padding:"3px 8px",cursor:"pointer",fontSize:10,color:"#d97706",fontWeight:700}}>
                          Mulai
                        </button>
                      )}
                      {s.status==="in_progress"&&(
                        <button onClick={()=>updateStatus(s.id,"completed")}
                          style={{background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:6,padding:"3px 8px",cursor:"pointer",fontSize:10,color:"#16a34a",fontWeight:700}}>
                          Selesai
                        </button>
                      )}
                    </td>"""

NEW_ACTION_CELL = """                    <td style={{...td,textAlign:"center" as const}}>
                      <span style={{fontSize:9,color:"#94a3b8"}}>
                        {s.status==="planning"&&"Menunggu Renhar"}
                        {s.status==="released"&&"Menunggu Mulai"}
                        {s.status==="in_progress"&&"Sedang Dikerjakan"}
                        {s.status==="completed"&&"\u2713 Otomatis"}
                      </span>
                    </td>"""

# Fix 2: Hapus modal Approve/Release
OLD_MODAL = """      {/* Modal Approve/Release */}
      {approveId&&(
        <Modal title="Release Schedule?" onClose={()=>setApproveId(null)} width={400}>
          <div style={{fontSize:13,color:"#475569",marginBottom:8}}>
            <strong>{approveId.nama_komponen}</strong> \u2014 {approveId.panel_nama}
          </div>
          <div style={{fontSize:12,color:"#64748b",marginBottom:16}}>
            Tanggal: <strong>{fmtDate(approveId.tanggal)}</strong> \u00b7 {approveId.qty_hari} pcs \u00b7 {approveId.total_menit} menit
          </div>
          <div style={{background:"#eff6ff",border:"1px solid #bfdbfe",borderRadius:8,padding:"10px 14px",marginBottom:16,fontSize:12,color:"#1d4ed8"}}>
            Status akan berubah dari <strong>Planning</strong> ke <strong>Released</strong>. Jadwal ini tidak dapat diubah setelah di-release.
          </div>
          <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
            <button onClick={()=>setApproveId(null)}
              style={{padding:"8px 16px",borderRadius:8,border:"1px solid #e2e8f0",background:"#f8fafc",color:"#64748b",fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>Batal</button>
            <button onClick={()=>updateStatus(approveId.id,"released")}
              style={{padding:"8px 20px",borderRadius:8,border:"none",background:"#1d4ed8",color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Release</button>
          </div>
        </Modal>
      )}
"""

NEW_MODAL = ""

# Fix 3: Update header kolom Aksi jadi "Status Proses"
OLD_HEADER = """              <th style={{...thS,textAlign:"center" as const}}>Aksi</th>
            </tr></thead>"""

NEW_HEADER = """              <th style={{...thS,textAlign:"center" as const}}>Progress</th>
            </tr></thead>"""

ok1 = OLD_ACTION_CELL in content
ok2 = OLD_MODAL in content
ok3 = OLD_HEADER in content

print(f"  ACTION_CELL: {'FOUND' if ok1 else 'MISSING'}")
print(f"  MODAL:       {'FOUND' if ok2 else 'MISSING'}")
print(f"  HEADER:      {'FOUND' if ok3 else 'MISSING'}")

if ok1 and ok2:
    content = content.replace(OLD_ACTION_CELL, NEW_ACTION_CELL)
    content = content.replace(OLD_MODAL, NEW_MODAL)
    if ok3:
        content = content.replace(OLD_HEADER, NEW_HEADER)
    with open(file_path, "w", encoding="utf-8", errors="replace") as f:
        f.write(content)
    print("[OK] Tombol manual dihapus, sekarang full otomatis")
    print("[INFO] Jalankan: npm run build")
