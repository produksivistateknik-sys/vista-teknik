file_path = r"C:\Users\User\vista-teknik\src\App.tsx"

with open(file_path, "r", encoding="utf-8", errors="replace") as f:
    content = f.read()

with open(file_path + ".bak_fcs_filter_pp", "w", encoding="utf-8", errors="replace") as f:
    f.write(content)
print("[OK] Backup dibuat")

# Fix 1: Tambah state filterPanel & filterProyek
OLD_STATE = "  const [filterWO,setFilterWO]=useState(\"ALL\");"
NEW_STATE = "  const [filterWO,setFilterWO]=useState(\"ALL\");\n  const [filterPanel,setFilterPanel]=useState(\"ALL\");\n  const [filterProyek,setFilterProyek]=useState(\"ALL\");"

# Fix 2: Update logic filtered untuk include panel & proyek
OLD_FILTERED = """  const filtered=useMemo(()=>{
    return scheduleList.filter(s=>{
      const matchWO=filterWO==="ALL"||s.wo_number===filterWO;
      const matchStatus=filterStatus==="ALL"||s.status===filterStatus;
      return matchWO&&matchStatus;
    });
  },[scheduleList,filterWO,filterStatus]);"""

NEW_FILTERED = """  const filtered=useMemo(()=>{
    return scheduleList.filter(s=>{
      const matchWO=filterWO==="ALL"||s.wo_number===filterWO;
      const matchStatus=filterStatus==="ALL"||s.status===filterStatus;
      const matchPanel=filterPanel==="ALL"||s.panel_nama===filterPanel;
      const matchProyek=filterProyek==="ALL"||s.proyek===filterProyek;
      return matchWO&&matchStatus&&matchPanel&&matchProyek;
    });
  },[scheduleList,filterWO,filterStatus,filterPanel,filterProyek]);"""

# Fix 3: Tambah dropdown Panel & Proyek di filter bar, setelah filterWO
OLD_FILTER_UI = """        <select value={filterWO} onChange={e=>setFilterWO(e.target.value)}
          style={{height:28,padding:"0 8px",border:"1px solid #e2e8f0",borderRadius:6,fontSize:11,background:"#f8fafc",outline:"none",fontFamily:"inherit"}}>
          <option value="ALL">Semua WO</option>
          {[...new Set(scheduleList.map(s=>s.wo_number))].map(wo=>(
            <option key={wo} value={wo}>WO {wo}</option>
          ))}
        </select>"""

NEW_FILTER_UI = """        <select value={filterWO} onChange={e=>setFilterWO(e.target.value)}
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

ok1 = OLD_STATE in content
ok2 = OLD_FILTERED in content
ok3 = OLD_FILTER_UI in content

print(f"  STATE:    {'FOUND' if ok1 else 'MISSING'}")
print(f"  FILTERED: {'FOUND' if ok2 else 'MISSING'}")
print(f"  UI:       {'FOUND' if ok3 else 'MISSING'}")

if ok1 and ok2 and ok3:
    content = content.replace(OLD_STATE, NEW_STATE)
    content = content.replace(OLD_FILTERED, NEW_FILTERED)
    content = content.replace(OLD_FILTER_UI, NEW_FILTER_UI)
    with open(file_path, "w", encoding="utf-8", errors="replace") as f:
        f.write(content)
    print("[OK] Filter Panel & Proyek berhasil ditambah di FCS Schedule")
    print("[INFO] Jalankan: npm run build")
