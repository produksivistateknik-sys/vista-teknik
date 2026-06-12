file_path = r"C:\Users\User\vista-teknik\src\App.tsx"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

with open(file_path + ".bak_fcs_kapasitas", "w", encoding="utf-8") as f:
    f.write(content)
print("[OK] Backup dibuat")

# Fix 1: Tambah subtab Kapasitas Pekerjaan
OLD_SUBTABS = """  const subTabs=[
    {id:"masteruser",label:"\U0001f464 Master User"},
    {id:"mesin",label:"\u2699\ufe0f Master Mesin"},
    {id:"pekerja",label:"\U0001f465 Master Pekerja"},
    {id:"stok",label:"\U0001f4e6 Inventaris"},
    {id:"recycle",label:"\U0001f5d1 Recycle Bin"},
  ];"""

NEW_SUBTABS = """  const subTabs=[
    {id:"masteruser",label:"\U0001f464 Master User"},
    {id:"mesin",label:"\u2699\ufe0f Master Mesin"},
    {id:"pekerja",label:"\U0001f465 Master Pekerja"},
    {id:"stok",label:"\U0001f4e6 Inventaris"},
    {id:"kapasitas",label:"\u23f1 Kapasitas Pekerjaan"},
    {id:"recycle",label:"\U0001f5d1 Recycle Bin"},
  ];"""

# Fix 2: Tambah render subtab kapasitas
OLD_RENDER = """          {subTab==="stok"&&<InventarisWrapper user={user} activityLog={activityLog}/>}
          {subTab==="recycle"&&<RecycleBinTab user={user}/>}"""

NEW_RENDER = """          {subTab==="stok"&&<InventarisWrapper user={user} activityLog={activityLog}/>}
          {subTab==="kapasitas"&&<KapasitasPekerjaanTab/>}
          {subTab==="recycle"&&<RecycleBinTab user={user}/>}"""

# Fix 3: Tambah komponen KapasitasPekerjaanTab sebelum SystemTab
NEW_COMPONENT = """function KapasitasPekerjaanTab(){
  const [kapasitasList,setKapasitasList]=useState<any[]>([]);
  const [processList,setProcessList]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);
  const [activeTab,setActiveTab]=useState("kapasitas");
  const [editKap,setEditKap]=useState<any>(null);
  const [editProc,setEditProc]=useState<any>(null);
  const [showAddProc,setShowAddProc]=useState(false);
  const [procForm,setProcForm]=useState({kode_komponen:"",nama_komponen:"",tipe_panel:"FS",wp:"WP1",jenis_pekerjaan:"POTONG",menit_per_pcs:0});
  const [filterTipe,setFilterTipe]=useState("ALL");
  const [filterPekerjaan,setFilterPekerjaan]=useState("ALL");
  const [search,setSearch]=useState("");

  const HARI_LABEL:any={1:"Sen",2:"Sel",3:"Rab",4:"Kam",5:"Jum",6:"Sab",7:"Min"};
  const ALL_PROSES=["POTONG","BENDING","STEL","PAINTING","RAKIT","PASANG KOMPONEN","BUSBAR","WIRING CONTROL","WIRING POWER","QC TEST","PACKING"];
  const ALL_TIPE=["FS","F3B","WM_MS","WM_POLY"];
  const ALL_WP=["WP1","WP2","WP3","WP4","WP5","WP6"];

  useEffect(()=>{
    fetchAll();
  },[]);

  const fetchAll=async()=>{
    setLoading(true);
    const [{data:k},{data:p}]=await Promise.all([
      supabase.from("fcs_kapasitas_pekerjaan").select("*").order("id"),
      supabase.from("fcs_process_time").select("*").order("tipe_panel,wp,kode_komponen"),
    ]);
    setKapasitasList(k??[]);
    setProcessList(p??[]);
    setLoading(false);
  };

  const saveKapasitas=async(item:any)=>{
    const{error}=await supabase.from("fcs_kapasitas_pekerjaan").update({
      kapasitas_menit_hari:Number(item.kapasitas_menit_hari),
      hari_kerja:item.hari_kerja,
      keterangan:item.keterangan,
    }).eq("id",item.id);
    if(!error){
      setKapasitasList(prev=>prev.map(k=>k.id===item.id?{...k,...item}:k));
      setEditKap(null);
    }
  };

  const saveProcess=async()=>{
    if(!procForm.kode_komponen.trim()||!procForm.nama_komponen.trim())return;
    if(editProc){
      const{error}=await supabase.from("fcs_process_time").update({
        nama_komponen:procForm.nama_komponen,
        tipe_panel:procForm.tipe_panel,
        wp:procForm.wp,
        jenis_pekerjaan:procForm.jenis_pekerjaan,
        menit_per_pcs:Number(procForm.menit_per_pcs),
      }).eq("id",editProc.id);
      if(!error){
        setProcessList(prev=>prev.map(p=>p.id===editProc.id?{...p,...procForm}:p));
        setEditProc(null);setShowAddProc(false);
      }
    } else {
      const{data,error}=await supabase.from("fcs_process_time").insert({
        kode_komponen:procForm.kode_komponen.trim(),
        nama_komponen:procForm.nama_komponen.trim(),
        tipe_panel:procForm.tipe_panel,
        wp:procForm.wp,
        jenis_pekerjaan:procForm.jenis_pekerjaan,
        menit_per_pcs:Number(procForm.menit_per_pcs),
      }).select().single();
      if(!error&&data){
        setProcessList(prev=>[...prev,data]);
        setProcForm({kode_komponen:"",nama_komponen:"",tipe_panel:"FS",wp:"WP1",jenis_pekerjaan:"POTONG",menit_per_pcs:0});
        setShowAddProc(false);
      }
    }
  };

  const deleteProcess=async(id:number)=>{
    await supabase.from("fcs_process_time").delete().eq("id",id);
    setProcessList(prev=>prev.filter(p=>p.id!==id));
  };

  const toggleHari=(item:any,hari:number)=>{
    const curr=item.hari_kerja||[];
    const updated=curr.includes(hari)?curr.filter((h:number)=>h!==hari):[...curr,hari].sort();
    setEditKap({...item,hari_kerja:updated});
  };

  const filteredProcess=processList.filter(p=>{
    const matchTipe=filterTipe==="ALL"||p.tipe_panel===filterTipe;
    const matchPek=filterPekerjaan==="ALL"||p.jenis_pekerjaan===filterPekerjaan;
    const matchSearch=!search||p.nama_komponen.toLowerCase().includes(search.toLowerCase())||p.kode_komponen.toLowerCase().includes(search.toLowerCase());
    return matchTipe&&matchPek&&matchSearch;
  });

  const thS:any={background:"#1e2330",color:"#c8d0e8",padding:"7px 12px",fontWeight:600,fontSize:10,textAlign:"left" as const,whiteSpace:"nowrap" as const,borderRight:"1px solid #ffffff10",textTransform:"uppercase" as const,letterSpacing:.4};

  if(loading)return <div style={{textAlign:"center",padding:40,color:"#94a3b8"}}>Memuat data...</div>;

  return(
    <div className="fi">
      {/* Sub-tab switcher */}
      <div style={{display:"flex",gap:2,marginBottom:16,borderBottom:"1px solid #e2e8f0"}}>
        {[{id:"kapasitas",l:"\u23f1 Kapasitas Harian"},{id:"processtime",l:"\u26a1 Process Time"}].map(t=>(
          <button key={t.id} onClick={()=>setActiveTab(t.id)}
            style={{padding:"8px 18px",fontSize:12,fontWeight:activeTab===t.id?700:500,
              color:activeTab===t.id?"#1d4ed8":"#64748b",cursor:"pointer",
              background:activeTab===t.id?"#eff6ff":"transparent",
              border:"none",borderBottom:activeTab===t.id?"2px solid #1d4ed8":"2px solid transparent",
              fontFamily:"inherit",borderRadius:"6px 6px 0 0"}}>
            {t.l}
          </button>
        ))}
      </div>

      {/* TAB: Kapasitas Harian */}
      {activeTab==="kapasitas"&&(
        <div>
          <div style={{fontSize:12,color:"#64748b",marginBottom:14}}>
            Atur kapasitas menit/hari dan hari kerja untuk setiap jenis pekerjaan.
          </div>
          <div style={{overflowX:"auto" as const,borderRadius:10,border:"1px solid #e2e8f0"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
              <thead><tr>
                <th style={thS}>Jenis Pekerjaan</th>
                <th style={{...thS,textAlign:"center" as const}}>Kapasitas (menit/hari)</th>
                <th style={{...thS,textAlign:"center" as const}}>Jam/Hari</th>
                <th style={thS}>Hari Kerja</th>
                <th style={thS}>Keterangan</th>
                <th style={{...thS,textAlign:"center" as const}}>Aksi</th>
              </tr></thead>
              <tbody>
                {kapasitasList.map((k:any,i:number)=>{
                  const isEdit=editKap?.id===k.id;
                  const item=isEdit?editKap:k;
                  const rBg=i%2===0?"#fff":"#f8fafc";
                  const td:any={padding:"8px 12px",borderBottom:"1px solid #f1f5f9",borderRight:"1px solid #f1f5f9",background:isEdit?"#eff6ff":rBg,verticalAlign:"middle"};
                  return(
                    <tr key={k.id}>
                      <td style={{...td,fontWeight:700,color:"#1e293b"}}>
                        <span style={{background:"#f1f5f9",borderRadius:6,padding:"2px 10px",fontSize:11,fontWeight:700,color:"#475569"}}>{k.jenis_pekerjaan}</span>
                      </td>
                      <td style={{...td,textAlign:"center" as const}}>
                        {isEdit?(
                          <input type="number" min="1" max="1440" value={item.kapasitas_menit_hari}
                            onChange={e=>setEditKap({...editKap,kapasitas_menit_hari:e.target.value})}
                            style={{width:80,padding:"4px 8px",borderRadius:6,border:"1.5px solid #1d4ed8",textAlign:"center" as const,fontSize:12,fontWeight:700}}/>
                        ):(
                          <span style={{fontWeight:800,fontSize:14,color:"#1d4ed8"}}>{k.kapasitas_menit_hari}</span>
                        )}
                      </td>
                      <td style={{...td,textAlign:"center" as const,color:"#64748b",fontSize:11}}>
                        {(item.kapasitas_menit_hari/60).toFixed(1)} jam
                      </td>
                      <td style={td}>
                        <div style={{display:"flex",gap:4}}>
                          {[1,2,3,4,5,6,7].map(h=>{
                            const active=(item.hari_kerja||[]).includes(h);
                            return(
                              <button key={h} onClick={()=>isEdit&&toggleHari(editKap,h)}
                                style={{width:28,height:28,borderRadius:6,border:`1.5px solid ${active?"#1d4ed8":"#e2e8f0"}`,
                                  background:active?"#1d4ed8":"#f8fafc",color:active?"#fff":"#94a3b8",
                                  fontSize:10,fontWeight:700,cursor:isEdit?"pointer":"default"}}>
                                {HARI_LABEL[h]}
                              </button>
                            );
                          })}
                        </div>
                      </td>
                      <td style={td}>
                        {isEdit?(
                          <input value={item.keterangan||""} onChange={e=>setEditKap({...editKap,keterangan:e.target.value})}
                            style={{width:"100%",padding:"4px 8px",borderRadius:6,border:"1.5px solid #1d4ed8",fontSize:11}}/>
                        ):(
                          <span style={{fontSize:11,color:"#64748b"}}>{k.keterangan||"—"}</span>
                        )}
                      </td>
                      <td style={{...td,textAlign:"center" as const}}>
                        {isEdit?(
                          <div style={{display:"flex",gap:6,justifyContent:"center"}}>
                            <button onClick={()=>saveKapasitas(editKap)}
                              style={{background:"#1d4ed8",border:"none",borderRadius:6,padding:"4px 12px",cursor:"pointer",fontSize:11,color:"#fff",fontWeight:700}}>Simpan</button>
                            <button onClick={()=>setEditKap(null)}
                              style={{background:"#f1f5f9",border:"1px solid #e2e8f0",borderRadius:6,padding:"4px 10px",cursor:"pointer",fontSize:11,color:"#64748b"}}>Batal</button>
                          </div>
                        ):(
                          <button onClick={()=>setEditKap({...k})}
                            style={{background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:6,padding:"4px 10px",cursor:"pointer",fontSize:11,color:"#475569"}}>✏️ Edit</button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB: Process Time */}
      {activeTab==="processtime"&&(
        <div>
          {/* Toolbar */}
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
          </div>

          {/* Form tambah/edit */}
          {showAddProc&&(
            <div style={{background:"#f0f8ff",borderRadius:10,border:"1.5px solid #bfdbfe",padding:"14px 16px",marginBottom:14}}>
              <div style={{fontWeight:700,fontSize:13,color:"#1e293b",marginBottom:12}}>{editProc?"✏️ Edit Process Time":"➕ Tambah Process Time"}</div>
              <div style={{display:"grid",gridTemplateColumns:"120px 1fr 120px 100px 1fr 120px",gap:10,alignItems:"flex-end",flexWrap:"wrap" as const}}>
                <div>
                  <div style={{fontSize:10,fontWeight:700,color:"#64748b",textTransform:"uppercase" as const,letterSpacing:.4,marginBottom:4}}>Kode</div>
                  <input value={procForm.kode_komponen} onChange={e=>setProcForm({...procForm,kode_komponen:e.target.value})}
                    placeholder="FS.1..." disabled={!!editProc}
                    style={{width:"100%",padding:"7px 10px",borderRadius:7,border:"1.5px solid #e2e8f0",fontSize:12,background:editProc?"#f1f5f9":"#fff"}}/>
                </div>
                <div>
                  <div style={{fontSize:10,fontWeight:700,color:"#64748b",textTransform:"uppercase" as const,letterSpacing:.4,marginBottom:4}}>Nama Komponen</div>
                  <input value={procForm.nama_komponen} onChange={e=>setProcForm({...procForm,nama_komponen:e.target.value})}
                    placeholder="Nama komponen..."
                    style={{width:"100%",padding:"7px 10px",borderRadius:7,border:"1.5px solid #e2e8f0",fontSize:12}}/>
                </div>
                <div>
                  <div style={{fontSize:10,fontWeight:700,color:"#64748b",textTransform:"uppercase" as const,letterSpacing:.4,marginBottom:4}}>Tipe Panel</div>
                  <select value={procForm.tipe_panel} onChange={e=>setProcForm({...procForm,tipe_panel:e.target.value})}
                    style={{width:"100%",padding:"7px 10px",borderRadius:7,border:"1.5px solid #e2e8f0",fontSize:12}}>
                    {ALL_TIPE.map(t=><option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <div style={{fontSize:10,fontWeight:700,color:"#64748b",textTransform:"uppercase" as const,letterSpacing:.4,marginBottom:4}}>WP</div>
                  <select value={procForm.wp} onChange={e=>setProcForm({...procForm,wp:e.target.value})}
                    style={{width:"100%",padding:"7px 10px",borderRadius:7,border:"1.5px solid #e2e8f0",fontSize:12}}>
                    {ALL_WP.map(w=><option key={w} value={w}>{w}</option>)}
                  </select>
                </div>
                <div>
                  <div style={{fontSize:10,fontWeight:700,color:"#64748b",textTransform:"uppercase" as const,letterSpacing:.4,marginBottom:4}}>Jenis Pekerjaan</div>
                  <select value={procForm.jenis_pekerjaan} onChange={e=>setProcForm({...procForm,jenis_pekerjaan:e.target.value})}
                    style={{width:"100%",padding:"7px 10px",borderRadius:7,border:"1.5px solid #e2e8f0",fontSize:12}}>
                    {ALL_PROSES.map(p=><option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <div style={{fontSize:10,fontWeight:700,color:"#64748b",textTransform:"uppercase" as const,letterSpacing:.4,marginBottom:4}}>Menit/Pcs</div>
                  <input type="number" min="0" step="0.25" value={procForm.menit_per_pcs}
                    onChange={e=>setProcForm({...procForm,menit_per_pcs:parseFloat(e.target.value)||0})}
                    style={{width:"100%",padding:"7px 10px",borderRadius:7,border:"1.5px solid #e2e8f0",fontSize:12,textAlign:"center" as const}}/>
                </div>
              </div>
              <div style={{display:"flex",gap:8,marginTop:12,justifyContent:"flex-end"}}>
                <button onClick={()=>{setShowAddProc(false);setEditProc(null);}}
                  style={{padding:"6px 14px",borderRadius:7,border:"1px solid #e2e8f0",background:"#f8fafc",color:"#64748b",fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>Batal</button>
                <button onClick={saveProcess}
                  style={{padding:"6px 16px",borderRadius:7,border:"none",background:"#1d4ed8",color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>{editProc?"Simpan":"+ Tambah"}</button>
              </div>
            </div>
          )}

          {/* Tabel process time */}
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
                  <tr><td colSpan={7} style={{textAlign:"center",padding:32,color:"#94a3b8"}}>Tidak ada data</td></tr>
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
                            style={{background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:6,padding:"3px 8px",cursor:"pointer",fontSize:11,color:"#475569"}}>✏️</button>
                          <button onClick={()=>deleteProcess(p.id)}
                            style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:6,padding:"3px 8px",cursor:"pointer",fontSize:11,color:"#dc2626"}}>🗑</button>
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
}

"""

INSERT_BEFORE = "function SystemTab({user,activityLog,pekerja,setPekerja,createPekerja,updatePekerja,removePekerja,logActivity,woData}){"

ok1 = OLD_SUBTABS in content
ok2 = OLD_RENDER in content
ok3 = INSERT_BEFORE in content

print(f"  SUBTABS: {'FOUND' if ok1 else 'MISSING'}")
print(f"  RENDER:  {'FOUND' if ok2 else 'MISSING'}")
print(f"  INSERT:  {'FOUND' if ok3 else 'MISSING'}")

if ok1 and ok2 and ok3:
    content = content.replace(OLD_SUBTABS, NEW_SUBTABS)
    content = content.replace(OLD_RENDER, NEW_RENDER)
    content = content.replace(INSERT_BEFORE, NEW_COMPONENT + INSERT_BEFORE, 1)
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)
    print("[OK] KapasitasPekerjaanTab berhasil ditambah")
    print("[INFO] Jalankan: npm run build")
else:
    lines = content.split("\n")
    if not ok1:
        for i,l in enumerate(lines):
            if 'subTabs=' in l and 'masteruser' in l:
                print(f"\nSUBTABS exact baris {i+1}:")
                for j in range(i, min(i+8,len(lines))):
                    print(repr(lines[j]))
                break
