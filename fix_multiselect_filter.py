file_path = r"C:\Users\User\vista-teknik\src\App.tsx"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

with open(file_path + ".bak_multiselect", "w", encoding="utf-8") as f:
    f.write(content)
print("[OK] Backup dibuat")

OLD_STATE = """  const [statusFilter,setStatusFilter]=useState("semua");"""
NEW_STATE = """  const [statusFilter,setStatusFilter]=useState<string[]>([]);"""

OLD_FILTER = """  const filtered=allPanels.filter(p=>{
    const pct=panelOverall(p);
    const s=pct===100?"selesai":isDelayed(p.target)?"terlambat":isUrgent(p.target)?"mendesak":"ontrack";
    const matchS=statusFilter==="semua"||statusFilter===s;
    const matchWO=woFilter==="semua"||p.wo===woFilter;
    const matchQ=!search||
      (p.nama||"").toLowerCase().includes(search.toLowerCase())||
      (p.proyek||"").toLowerCase().includes(search.toLowerCase())||
      (p.wo||"").toLowerCase().includes(search.toLowerCase());
    return matchS&&matchWO&&matchQ;
  });"""

NEW_FILTER = """  const filtered=allPanels.filter(p=>{
    const pct=panelOverall(p);
    const s=pct===100?"selesai":isDelayed(p.target)?"terlambat":isUrgent(p.target)?"mendesak":"ontrack";
    const matchS=statusFilter.length===0||statusFilter.includes(s);
    const matchWO=woFilter==="semua"||p.wo===woFilter;
    const matchQ=!search||
      (p.nama||"").toLowerCase().includes(search.toLowerCase())||
      (p.proyek||"").toLowerCase().includes(search.toLowerCase())||
      (p.wo||"").toLowerCase().includes(search.toLowerCase());
    return matchS&&matchWO&&matchQ;
  });"""

OLD_SELECT = """        <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}
          style={{height:28,border:"1px solid #e2e8f0",borderRadius:5,padding:"0 7px",
            fontSize:11,background:"var(--input-bg,#f8fafc)",outline:"none",color:"var(--text-secondary,#475569)",cursor:"pointer",fontFamily:"inherit"}}>
          <option value="semua">Semua Status</option>
          <option value="ontrack">On Track</option>
          <option value="mendesak">Mendesak</option>
          <option value="terlambat">Terlambat</option>
          <option value="selesai">Selesai</option>
        </select>"""

NEW_SELECT = """        <div style={{display:"flex",gap:4,alignItems:"center",flexWrap:"wrap" as const}}>
          {[
            {v:"ontrack",l:"On Track",c:"#2563eb"},
            {v:"mendesak",l:"Mendesak H-7",c:"#d97706"},
            {v:"terlambat",l:"Terlambat",c:"#dc2626"},
            {v:"selesai",l:"Selesai",c:"#16a34a"},
          ].map(opt=>{
            const isSel=statusFilter.includes(opt.v);
            return(
              <button key={opt.v} onClick={()=>setStatusFilter(prev=>isSel?prev.filter(x=>x!==opt.v):[...prev,opt.v])}
                style={{height:28,padding:"0 10px",borderRadius:5,border:`1.5px solid ${isSel?opt.c:"#e2e8f0"}`,
                  background:isSel?opt.c+"18":"var(--input-bg,#f8fafc)",color:isSel?opt.c:"var(--text-secondary,#475569)",
                  fontSize:11,fontWeight:isSel?700:500,cursor:"pointer",fontFamily:"inherit",
                  display:"flex",alignItems:"center",gap:4,whiteSpace:"nowrap" as const}}>
                {isSel&&<span style={{width:6,height:6,borderRadius:"50%",background:opt.c}}/>}
                {opt.l}
              </button>
            );
          })}
          {statusFilter.length>0&&(
            <button onClick={()=>setStatusFilter([])}
              style={{height:28,padding:"0 8px",borderRadius:5,border:"1px solid #fecaca",
                background:"#fef2f2",color:"#dc2626",fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>
              \u2715 Reset
            </button>
          )}
        </div>"""

ok1 = OLD_STATE in content
ok2 = OLD_FILTER in content
ok3 = OLD_SELECT in content

print(f"  STATE:  {'FOUND' if ok1 else 'MISSING'}")
print(f"  FILTER: {'FOUND' if ok2 else 'MISSING'}")
print(f"  SELECT: {'FOUND' if ok3 else 'MISSING'}")

if ok1 and ok2 and ok3:
    content = content.replace(OLD_STATE, NEW_STATE)
    content = content.replace(OLD_FILTER, NEW_FILTER)
    content = content.replace(OLD_SELECT, NEW_SELECT)
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)
    print("[OK] Multi-select filter status berhasil diterapkan")
    print("[INFO] Jalankan: npm run build")
else:
    if not ok3:
        # Tulis exact bytes untuk debug
        lines = content.split("\n")
        for i, line in enumerate(lines):
            if "statusFilter" in line and "onChange" in line:
                print(f"\nExact bytes baris {i+1} s/d {i+10}:")
                for j in range(i, min(i+10, len(lines))):
                    print(repr(lines[j]))
                break
