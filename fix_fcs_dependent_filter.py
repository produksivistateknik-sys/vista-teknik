file_path = r"C:\Users\User\vista-teknik\src\App.tsx"

with open(file_path, "r", encoding="utf-8", errors="replace") as f:
    content = f.read()

with open(file_path + ".bak_fcs_dep_filter", "w", encoding="utf-8", errors="replace") as f:
    f.write(content)
print("[OK] Backup dibuat")

OLD = """        <select value={filterWO} onChange={e=>setFilterWO(e.target.value)}
          style={{height:28,padding:"0 8px",border:"1px solid #e2e8f0",borderRadius:6,fontSize:11,background:"#f8fafc",outline:"none",fontFamily:"inherit"}}>
          <option value="ALL">Semua WO</option>
          {[...new Set(scheduleList.map(s=>s.wo_number))].map(wo=>(
            <option key={wo} value={wo}>WO {wo}</option>
          ))}
        </select>
        <select value={filterProyek} onChange={e=>setFilterProyek(e.target.value)}
          style={{height:28,padding:"0 8px",border:"1px solid #e2e8f0",borderRadius:6,fontSize:11,background:"#f8fafc",outline:"none",fontFamily:"inherit"}}>
          <option value="ALL">Semua Proyek</option>
          {[...new Set(scheduleList.map(s=>s.proyek))].map(p=>(
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        <select value={filterPanel} onChange={e=>setFilterPanel(e.target.value)}
          style={{height:28,padding:"0 8px",border:"1px solid #e2e8f0",borderRadius:6,fontSize:11,background:"#f8fafc",outline:"none",fontFamily:"inherit"}}>
          <option value="ALL">Semua Panel</option>
          {[...new Set(scheduleList.map(s=>s.panel_nama))].map(p=>(
            <option key={p} value={p}>{p}</option>
          ))}
        </select>"""

NEW = """        <select value={filterWO} onChange={e=>{setFilterWO(e.target.value);setFilterProyek("ALL");setFilterPanel("ALL");}}
          style={{height:28,padding:"0 8px",border:"1px solid #e2e8f0",borderRadius:6,fontSize:11,background:"#f8fafc",outline:"none",fontFamily:"inherit"}}>
          <option value="ALL">Semua WO</option>
          {[...new Set(scheduleList.map(s=>s.wo_number))].map(wo=>(
            <option key={wo} value={wo}>WO {wo}</option>
          ))}
        </select>
        <select value={filterProyek} onChange={e=>{setFilterProyek(e.target.value);setFilterPanel("ALL");}}
          style={{height:28,padding:"0 8px",border:"1px solid #e2e8f0",borderRadius:6,fontSize:11,background:"#f8fafc",outline:"none",fontFamily:"inherit"}}>
          <option value="ALL">Semua Proyek</option>
          {[...new Set(scheduleList.filter(s=>filterWO==="ALL"||s.wo_number===filterWO).map(s=>s.proyek))].map(p=>(
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        <select value={filterPanel} onChange={e=>setFilterPanel(e.target.value)}
          style={{height:28,padding:"0 8px",border:"1px solid #e2e8f0",borderRadius:6,fontSize:11,background:"#f8fafc",outline:"none",fontFamily:"inherit"}}>
          <option value="ALL">Semua Panel</option>
          {[...new Set(scheduleList.filter(s=>(filterWO==="ALL"||s.wo_number===filterWO)&&(filterProyek==="ALL"||s.proyek===filterProyek)).map(s=>s.panel_nama))].map(p=>(
            <option key={p} value={p}>{p}</option>
          ))}
        </select>"""

ok = OLD in content
print(f"  PATTERN: {'FOUND' if ok else 'MISSING'}")

if ok:
    content = content.replace(OLD, NEW)
    with open(file_path, "w", encoding="utf-8", errors="replace") as f:
        f.write(content)
    print("[OK] Filter dependent (WO->Proyek->Panel) berhasil diterapkan")
    print("[INFO] Jalankan: npm run build")
