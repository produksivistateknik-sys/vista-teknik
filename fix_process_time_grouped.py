file_path = r"C:\Users\User\vista-teknik\src\App.tsx"

with open(file_path, "r", encoding="utf-8", errors="replace") as f:
    content = f.read()

with open(file_path + ".bak_proctime_grouped", "w", encoding="utf-8", errors="replace") as f:
    f.write(content)
print("[OK] Backup dibuat")

# Ganti dropdown filterPekerjaan + tabel tunggal jadi grouped section per pekerjaan
OLD_BLOCK = """            <select value={filterPekerjaan} onChange={e=>setFilterPekerjaan(e.target.value)}
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

NEW_BLOCK = """            <select value={filterPekerjaan} onChange={e=>setFilterPekerjaan(e.target.value)}
              style={{height:30,padding:"0 8px",border:"1px solid #e2e8f0",borderRadius:8,fontSize:11,background:"#fff",outline:"none",fontFamily:"inherit"}}>
              <option value="ALL">Semua Pekerjaan</option>
              {ALL_PROSES.map(p=><option key={p} value={p}>{p}</option>)}
            </select>
            <span style={{fontSize:11,color:"#94a3b8",marginLeft:"auto"}}>{filteredProcess.length} komponen</span>
            <button onClick={()=>{setShowAddProc(true);setEditProc(null);setProcForm({kode_komponen:"",nama_komponen:"",tipe_panel:filterTipe==="ALL"?"FS":filterTipe,wp:"WP1",jenis_pekerjaan:"POTONG",menit_per_pcs:0});}}
              style={{height:30,padding:"0 14px",borderRadius:8,border:"none",background:"#1d4ed8",color:"#fff",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
              + Tambah
            </button>
          </div>

          {/* Grouped by Jenis Pekerjaan */}
          {(filterPekerjaan==="ALL"?ALL_PROSES:[filterPekerjaan]).map((proses:string)=>{
            const groupItems=filteredProcess.filter((p:any)=>p.jenis_pekerjaan===proses);
            if(groupItems.length===0)return null;
            const procColors:any={
              POTONG:"#f59e0b",BENDING:"#8b5cf6",STEL:"#06b6d4",PAINTING:"#ec4899",
              RAKIT:"#10b981","PASANG KOMPONEN":"#3b82f6",BUSBAR:"#f43f5e",
              "WIRING CONTROL":"#6366f1","WIRING POWER":"#0ea5e9","QC TEST":"#84cc16",PACKING:"#64748b"
            };
            const pc=procColors[proses]||"#64748b";
            return(
              <div key={proses} style={{marginBottom:18}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                  <span style={{width:8,height:8,borderRadius:99,background:pc,display:"inline-block"}}/>
                  <span style={{fontWeight:800,fontSize:13,color:"#1e293b"}}>{proses}</span>
                  <span style={{background:pc+"15",color:pc,borderRadius:20,padding:"1px 9px",fontSize:10,fontWeight:700}}>{groupItems.length} komponen</span>
                  <div style={{flex:1,height:1,background:"#f1f5f9"}}/>
                </div>"""

with open(file_path, "r", encoding="utf-8", errors="replace") as f2:
    pass

ok = OLD_BLOCK in content
print(f"  BLOCK: {'FOUND' if ok else 'MISSING'}")

if ok:
    content = content.replace(OLD_BLOCK, NEW_BLOCK)
    with open(file_path, "w", encoding="utf-8", errors="replace") as f:
        f.write(content)
    print("[OK] Grouped header berhasil ditambah - lanjut ke step 2 (wrap table + closing)")
else:
    lines = content.split("\n")
    for i,l in enumerate(lines):
        if 'filterPekerjaan' in l and 'Semua Pekerjaan' in lines[i+1] if i+1<len(lines) else False:
            print(f"baris {i+1}: {repr(l[:80])}")
