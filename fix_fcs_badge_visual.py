file_path = r"C:\Users\User\vista-teknik\src\App.tsx"

with open(file_path, "r", encoding="utf-8", errors="replace") as f:
    content = f.read()

with open(file_path + ".bak_fcs_badge_visual", "w", encoding="utf-8", errors="replace") as f:
    f.write(content)
print("[OK] Backup dibuat")

OLD = """                    <td style={{...td,textAlign:"center" as const}}>
                      <span style={{fontSize:9,color:"#94a3b8"}}>
                        {s.status==="planning"&&"Menunggu Renhar"}
                        {s.status==="released"&&"Menunggu Mulai"}
                        {s.status==="in_progress"&&"Sedang Dikerjakan"}
                        {s.status==="completed"&&"\u2713 Otomatis"}
                      </span>
                    </td>"""

NEW = """                    <td style={{...td,textAlign:"center" as const}}>
                      {s.status==="planning"&&(
                        <span style={{background:"#f1f5f9",border:"1px solid #e2e8f0",borderRadius:6,padding:"3px 10px",fontSize:10,color:"#94a3b8",fontWeight:700,display:"inline-block"}}>
                          Menunggu Renhar
                        </span>
                      )}
                      {s.status==="released"&&(
                        <span style={{background:"#eff6ff",border:"1px solid #bfdbfe",borderRadius:6,padding:"3px 10px",fontSize:10,color:"#1d4ed8",fontWeight:700,display:"inline-block"}}>
                          Menunggu Mulai
                        </span>
                      )}
                      {s.status==="in_progress"&&(
                        <span style={{background:"#fffbeb",border:"1px solid #fde68a",borderRadius:6,padding:"3px 10px",fontSize:10,color:"#d97706",fontWeight:700,display:"inline-block"}}>
                          Sedang Dikerjakan
                        </span>
                      )}
                      {s.status==="completed"&&(
                        <span style={{background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:6,padding:"3px 10px",fontSize:10,color:"#16a34a",fontWeight:700,display:"inline-block"}}>
                          \u2713 Selesai
                        </span>
                      )}
                    </td>"""

ok = OLD in content
print(f"  PATTERN: {'FOUND' if ok else 'MISSING'}")

if ok:
    content = content.replace(OLD, NEW)
    with open(file_path, "w", encoding="utf-8", errors="replace") as f:
        f.write(content)
    print("[OK] Badge visual dengan warna per status berhasil diterapkan")
    print("[INFO] Jalankan: npm run build")
