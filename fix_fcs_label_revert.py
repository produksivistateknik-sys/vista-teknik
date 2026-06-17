file_path = r"C:\Users\User\vista-teknik\src\App.tsx"

with open(file_path, "r", encoding="utf-8", errors="replace") as f:
    content = f.read()

with open(file_path + ".bak_fcs_label_revert", "w", encoding="utf-8", errors="replace") as f:
    f.write(content)
print("[OK] Backup dibuat")

OLD = """                    <td style={{...td,textAlign:"center" as const}}>
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

NEW = """                    <td style={{...td,textAlign:"center" as const}}>
                      {s.status==="planning"&&(
                        <span style={{background:"#eff6ff",border:"1px solid #bfdbfe",borderRadius:6,padding:"3px 10px",fontSize:10,color:"#1d4ed8",fontWeight:700,display:"inline-block"}}>
                          Release
                        </span>
                      )}
                      {s.status==="released"&&(
                        <span style={{background:"#fffbeb",border:"1px solid #fde68a",borderRadius:6,padding:"3px 10px",fontSize:10,color:"#d97706",fontWeight:700,display:"inline-block"}}>
                          Mulai
                        </span>
                      )}
                      {s.status==="in_progress"&&(
                        <span style={{background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:6,padding:"3px 10px",fontSize:10,color:"#16a34a",fontWeight:700,display:"inline-block"}}>
                          Selesai
                        </span>
                      )}
                      {s.status==="completed"&&(
                        <span style={{fontSize:10,color:"#16a34a",fontWeight:700}}>
                          \u2713 Completed
                        </span>
                      )}
                    </td>"""

ok = OLD in content
print(f"  PATTERN: {'FOUND' if ok else 'MISSING'}")

if ok:
    content = content.replace(OLD, NEW)
    with open(file_path, "w", encoding="utf-8", errors="replace") as f:
        f.write(content)
    print("[OK] Label diganti jadi Release/Mulai/Selesai (non-clickable, berurutan)")
    print("[INFO] Jalankan: npm run build")
