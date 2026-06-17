file_path = r"C:\Users\User\vista-teknik\src\App.tsx"

with open(file_path, "r", encoding="utf-8", errors="replace") as f:
    content = f.read()

with open(file_path + ".bak_fcs_readonly", "w", encoding="utf-8", errors="replace") as f:
    f.write(content)
print("[OK] Backup dibuat")

# Ganti button jadi span non-clickable dengan style sama
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
                      {s.status==="planning"&&(
                        <span style={{background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:6,padding:"3px 8px",fontSize:10,color:"#94a3b8",fontWeight:700,display:"inline-block",cursor:"default"}}>
                          Release
                        </span>
                      )}
                      {s.status==="released"&&(
                        <span style={{background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:6,padding:"3px 8px",fontSize:10,color:"#94a3b8",fontWeight:700,display:"inline-block",cursor:"default"}}>
                          Mulai
                        </span>
                      )}
                      {s.status==="in_progress"&&(
                        <span style={{background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:6,padding:"3px 8px",fontSize:10,color:"#94a3b8",fontWeight:700,display:"inline-block",cursor:"default"}}>
                          Selesai
                        </span>
                      )}
                      {s.status==="completed"&&(
                        <span style={{fontSize:10,color:"#16a34a",fontWeight:700}}>
                          \u2713 Otomatis
                        </span>
                      )}
                    </td>"""

ok = OLD_ACTION_CELL in content
print(f"  ACTION_CELL: {'FOUND' if ok else 'MISSING'}")

if ok:
    content = content.replace(OLD_ACTION_CELL, NEW_ACTION_CELL)
    with open(file_path, "w", encoding="utf-8", errors="replace") as f:
        f.write(content)
    print("[OK] Badge non-clickable berhasil diterapkan, tampilan sama tapi disabled")
    print("[INFO] Jalankan: npm run build")
