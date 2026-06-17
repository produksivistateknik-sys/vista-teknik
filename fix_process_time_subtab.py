file_path = r"C:\Users\User\vista-teknik\src\App.tsx"

with open(file_path, "r", encoding="utf-8", errors="replace") as f:
    content = f.read()

with open(file_path + ".bak_proctime_subtab", "w", encoding="utf-8", errors="replace") as f:
    f.write(content)
print("[OK] Backup dibuat")

# Fix 1: Tambah state filterTipePanel khusus subtab (gunakan filterTipe yang sudah ada, ubah default + tambah sub-nav)
OLD_TOOLBAR = """          {/* Toolbar */}
          <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap" as const,alignItems:"center"}}>
            <input value={search} onChange={e=>setSearch(e.target.value)}
              placeholder="\U0001f50d Cari komponen..."
              style={{height:30,padding:"0 10px",border:"1px solid #e2e8f0",borderRadius:8,fontSize:11,background:"#fff",outline:"none",color:"#1e293b",fontFamily:"inherit",width:200}}/>
            <select value={filterTipe} onChange={e=>setFilterTipe(e.target.value)}
              style={{height:30,padding:"0 8px",border:"1px solid #e2e8f0",borderRadius:8,fontSize:11,background:"#fff",outline:"none",fontFamily:"inherit"}}>
              <option value="ALL">Semua Tipe</option>
              {ALL_TIPE.map(t=><option key={t} value={t}>{t}</option>)}
            </select>
            <select value={filterPekerjaan} onChange={e=>setFilterPekerjaan(e.target.value)}
              style={{height:30,padding:"0 8px",border:"1px solid #e2e8f0",borderRadius:8,fontSize:11,background:"#fff",outline:"none",fontFamily:"inherit"}}>
              <option value="ALL">Semua Pekerjaan</option>
              {ALL_PROSES.map(p=><option key={p} value={p}>{p}</option>)}
            </select>
            <span style={{fontSize:11,color:"#94a3b8",marginLeft:"auto"}}>{filteredProcess.length} komponen</span>
            <button onClick={()=>{setShowAddProc(true);setEditProc(null);setProcForm({kode_komponen:"",nama_komponen:"",tipe_panel:"FS",wp:"WP1",jenis_pekerjaan:"POTONG",menit_per_pcs:0});}}
              style={{height:30,padding:"0 14px",borderRadius:8,border:"none",background:"#1d4ed8",color:"#fff",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
              + Tambah
            </button>
          </div>"""

NEW_TOOLBAR = """          {/* Sub-tab tipe panel */}
          <div style={{display:"flex",gap:2,marginBottom:14,background:"#f1f5f9",borderRadius:8,padding:3,width:"fit-content"}}>
            {ALL_TIPE.map(t=>{
              const cnt=processList.filter((p:any)=>p.tipe_panel===t).length;
              return(
                <button key={t} onClick={()=>setFilterTipe(t)}
                  style={{padding:"7px 16px",borderRadius:6,border:"none",cursor:"pointer",fontSize:12,
                    fontWeight:filterTipe===t?700:500,
                    background:filterTipe===t?"#fff":"transparent",
                    color:filterTipe===t?"#1d4ed8":"#64748b",
                    boxShadow:filterTipe===t?"0 1px 3px #00000015":"none",
                    fontFamily:"inherit",display:"flex",alignItems:"center",gap:6}}>
                  {t}
                  <span style={{background:filterTipe===t?"#eff6ff":"#e2e8f0",color:filterTipe===t?"#1d4ed8":"#94a3b8",
                    borderRadius:20,padding:"1px 7px",fontSize:10,fontWeight:700}}>{cnt}</span>
                </button>
              );
            })}
          </div>

          {/* Toolbar */}
          <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap" as const,alignItems:"center"}}>
            <input value={search} onChange={e=>setSearch(e.target.value)}
              placeholder="\U0001f50d Cari komponen..."
              style={{height:30,padding:"0 10px",border:"1px solid #e2e8f0",borderRadius:8,fontSize:11,background:"#fff",outline:"none",color:"#1e293b",fontFamily:"inherit",width:200}}/>
            <select value={filterPekerjaan} onChange={e=>setFilterPekerjaan(e.target.value)}
              style={{height:30,padding:"0 8px",border:"1px solid #e2e8f0",borderRadius:8,fontSize:11,background:"#fff",outline:"none",fontFamily:"inherit"}}>
              <option value="ALL">Semua Pekerjaan</option>
              {ALL_PROSES.map(p=><option key={p} value={p}>{p}</option>)}
            </select>
            <span style={{fontSize:11,color:"#94a3b8",marginLeft:"auto"}}>{filteredProcess.length} komponen</span>
            <button onClick={()=>{setShowAddProc(true);setEditProc(null);setProcForm({kode_komponen:"",nama_komponen:"",tipe_panel:filterTipe==="ALL"?"FS":filterTipe,wp:"WP1",jenis_pekerjaan:"POTONG",menit_per_pcs:0});}}
              style={{height:30,padding:"0 14px",borderRadius:8,border:"none",background:"#1d4ed8",color:"#fff",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
              + Tambah
            </button>
          </div>"""

# Fix 2: Ganti default filterTipe dari "ALL" jadi "FS"
OLD_FILTER_STATE = """  const [filterTipe,setFilterTipe]=useState("ALL");"""
NEW_FILTER_STATE = """  const [filterTipe,setFilterTipe]=useState("FS");"""

# Fix 3: Update empty state message untuk tipe tanpa data
OLD_EMPTY = """                {filteredProcess.length===0?(
                  <tr><td colSpan={7} style={{textAlign:"center",padding:32,color:"#94a3b8"}}>Tidak ada data</td></tr>
                ):filteredProcess.map((p:any,i:number)=>{"""

NEW_EMPTY = """                {filteredProcess.length===0?(
                  <tr><td colSpan={7} style={{textAlign:"center",padding:40,color:"#94a3b8"}}>
                    <div style={{fontSize:28,marginBottom:8}}>\U0001f4cb</div>
                    <div style={{fontWeight:600,fontSize:13,marginBottom:4}}>Belum ada data process time untuk {filterTipe}</div>
                    <div style={{fontSize:11}}>Klik tombol + Tambah untuk input data manual</div>
                  </td></tr>
                ):filteredProcess.map((p:any,i:number)=>{"""

ok1 = OLD_TOOLBAR in content
ok2 = OLD_FILTER_STATE in content
ok3 = OLD_EMPTY in content

print(f"  TOOLBAR: {'FOUND' if ok1 else 'MISSING'}")
print(f"  FILTER:  {'FOUND' if ok2 else 'MISSING'}")
print(f"  EMPTY:   {'FOUND' if ok3 else 'MISSING'}")

if ok1 and ok2 and ok3:
    content = content.replace(OLD_TOOLBAR, NEW_TOOLBAR)
    content = content.replace(OLD_FILTER_STATE, NEW_FILTER_STATE)
    content = content.replace(OLD_EMPTY, NEW_EMPTY)
    with open(file_path, "w", encoding="utf-8", errors="replace") as f:
        f.write(content)
    print("[OK] Subtab tipe panel berhasil ditambah ke Process Time")
    print("[INFO] Jalankan: npm run build")
else:
    lines = content.split("\n")
    if not ok1:
        for i,l in enumerate(lines):
            if 'Toolbar' in l and 'Process Time' not in l:
                print(f"TOOLBAR baris {i+1}: {repr(l[:80])}")
