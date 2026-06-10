file_path = r"C:\Users\User\vista-teknik\src\App.tsx"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

with open(file_path + ".bak_stok_monitor", "w", encoding="utf-8") as f:
    f.write(content)
print("[OK] Backup dibuat")

# ============================================================
# 1. Tambah komponen StokMonitoringTab sebelum function SystemTab
# ============================================================

NEW_COMPONENT = """
function StokMonitoringTab({user,activityLog}:any){
  const [stokList,setStokList]=useState<any[]>([]);
  const [masukList,setMasukList]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);
  const [search,setSearch]=useState("");
  const [filterKode,setFilterKode]=useState<string[]>([]);
  const [showKodeDD,setShowKodeDD]=useState(false);
  const [modalTipe,setModalTipe]=useState<"masuk"|"keluar"|null>(null);

  useEffect(()=>{
    fetchAll();
    const ch=supabase.channel("realtime-stok-monitor")
      .on("postgres_changes",{event:"*",schema:"public",table:"komponen_stok"},
        ()=>{fetchAll();})
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"komponen_stok_masuk"},
        (payload)=>{setMasukList(prev=>prev.some(m=>m.id===payload.new.id)?prev:[payload.new,...prev]);})
      .subscribe();
    return()=>{supabase.removeChannel(ch);};
  },[]);

  const fetchAll=async()=>{
    const[{data:s},{data:m}]=await Promise.all([
      supabase.from("komponen_stok").select("*").order("nama",{ascending:true}),
      supabase.from("komponen_stok_masuk").select("*").order("tanggal",{ascending:false})
    ]);
    setStokList(s??[]);
    setMasukList(m??[]);
    setLoading(false);
  };

  const fmtDate=(d:string)=>d?new Date(d).toLocaleDateString("id-ID",{day:"numeric",month:"short",year:"numeric"}):"-";

  // Hitung total masuk bulan ini
  const now=new Date();
  const bulanIni=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
  const masukBulanIni=masukList.filter(m=>m.tanggal?.startsWith(bulanIni));
  const totalMasukBulan=masukBulanIni.reduce((a:number,m:any)=>a+m.jumlah,0);

  // Hitung keluar dari activity log bulan ini
  const riwayatKeluar=(activityLog||[]).filter((l:any)=>l.action==="KELUAR KOMPONEN");
  const keluarBulanIni=riwayatKeluar.filter((l:any)=>l.created_at?.startsWith(bulanIni));
  const totalKeluarBulan=keluarBulanIni.reduce((a:number,l:any)=>{
    const m=l.description?.match(/x(\d+)\s*pcs/);
    return a+(m?Number(m[1]):0);
  },0);

  // Terakhir update per komponen
  const getMasukTerakhir=(id:number)=>{
    const m=masukList.filter(x=>x.komponen_id===id)[0];
    return m?{tanggal:m.tanggal,jumlah:m.jumlah}:null;
  };
  const getKeluarTerakhir=(id:number)=>{
    const kode=stokList.find(s=>s.id===id)?.kode;
    const log=(activityLog||[]).find((l:any)=>l.action==="KELUAR KOMPONEN"&&l.description?.includes("("+kode+")"));
    if(!log)return null;
    const m=log.description?.match(/x(\d+)\s*pcs/);
    return{tanggal:log.created_at?.slice(0,10),jumlah:m?Number(m[1]):0};
  };

  const kodeList=[...Array.from(new Set(stokList.map((s:any)=>s.kode).filter(Boolean))) as string[]];

  const filtered=stokList.filter(s=>{
    const matchKode=filterKode.length===0||filterKode.includes(s.kode);
    const matchSearch=!search||s.nama.toLowerCase().includes(search.toLowerCase())||s.kode?.toLowerCase().includes(search.toLowerCase());
    return matchKode&&matchSearch;
  });

  const thS:any={background:"#1e2330",color:"#c8d0e8",padding:"7px 12px",fontWeight:600,
    fontSize:10,textAlign:"left" as const,whiteSpace:"nowrap" as const,
    borderRight:"1px solid #ffffff10",textTransform:"uppercase" as const,letterSpacing:.4};

  // Modal transaksi masuk bulan ini
  const MasukModal=()=>(
    <Modal title={"📥 Transaksi Masuk — "+new Date().toLocaleDateString("id-ID",{month:"long",year:"numeric"})} onClose={()=>setModalTipe(null)} width={640}>
      <div style={{overflowX:"auto" as const}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
          <thead><tr>
            {["Tanggal","Kode","Komponen","Jumlah","Keterangan","Oleh"].map(h=>(
              <th key={h} style={thS}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {masukBulanIni.length===0?(
              <tr><td colSpan={6} style={{textAlign:"center",padding:24,color:"#94a3b8"}}>Belum ada transaksi masuk bulan ini</td></tr>
            ):masukBulanIni.map((m:any,i:number)=>{
              const td:any={padding:"7px 12px",borderBottom:"1px solid #f1f5f9",fontSize:11,verticalAlign:"middle" as const};
              const kode=stokList.find(s=>s.id===m.komponen_id)?.kode;
              return(
                <tr key={i}>
                  <td style={{...td,color:"#64748b"}}>{fmtDate(m.tanggal)}</td>
                  <td style={td}>{kode?<span style={{background:"#eff6ff",color:"#1d4ed8",border:"1px solid #bfdbfe",borderRadius:4,padding:"1px 7px",fontSize:10,fontWeight:700}}>{kode}</span>:<span style={{color:"#cbd5e1"}}>—</span>}</td>
                  <td style={{...td,fontWeight:600,color:"#1e293b"}}>{m.nama}</td>
                  <td style={{...td,textAlign:"center" as const,fontWeight:700,color:"#16a34a"}}>+{m.jumlah} pcs</td>
                  <td style={{...td,color:"#94a3b8",maxWidth:160}}>{m.keterangan||"—"}</td>
                  <td style={{...td,color:"#64748b"}}>{m.created_by||"—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Modal>
  );

  const KeluarModal=()=>(
    <Modal title={"📤 Transaksi Keluar — "+new Date().toLocaleDateString("id-ID",{month:"long",year:"numeric"})} onClose={()=>setModalTipe(null)} width={680}>
      <div style={{overflowX:"auto" as const}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
          <thead><tr>
            {["Tanggal","Kode","Komponen","Jumlah","Proyek","Panel","Oleh"].map(h=>(
              <th key={h} style={thS}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {keluarBulanIni.length===0?(
              <tr><td colSpan={7} style={{textAlign:"center",padding:24,color:"#94a3b8"}}>Belum ada transaksi keluar bulan ini</td></tr>
            ):keluarBulanIni.map((l:any,i:number)=>{
              const mJml=l.description?.match(/x(\d+)\s*pcs/);
              const mKode=l.description?.match(/\(([^)]+)\)/);
              const jml=mJml?Number(mJml[1]):0;
              const kode=mKode?mKode[1]:"-";
              const nama=l.description?.split(" x")?.[0]?.replace("Keluar: ","");
              const td:any={padding:"7px 12px",borderBottom:"1px solid #f1f5f9",fontSize:11,verticalAlign:"middle" as const};
              return(
                <tr key={i}>
                  <td style={{...td,color:"#64748b"}}>{fmtDate(l.created_at?.slice(0,10))}</td>
                  <td style={td}>{kode&&kode!=="-"?<span style={{background:"#eff6ff",color:"#1d4ed8",border:"1px solid #bfdbfe",borderRadius:4,padding:"1px 7px",fontSize:10,fontWeight:700}}>{kode}</span>:<span style={{color:"#cbd5e1"}}>—</span>}</td>
                  <td style={{...td,fontWeight:600,color:"#1e293b"}}>{nama}</td>
                  <td style={{...td,textAlign:"center" as const,fontWeight:700,color:"#dc2626"}}>-{jml} pcs</td>
                  <td style={{...td,color:"#475569"}}>{l.proyek||"—"}</td>
                  <td style={{...td,color:"#475569"}}>{l.panel||"—"}</td>
                  <td style={{...td,color:"#64748b"}}>{l.user_name||"—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Modal>
  );

  if(loading)return <div style={{textAlign:"center",padding:40,color:"#94a3b8"}}>Memuat data stok...</div>;

  return(
    <div className="fi">
      {/* Stat Cards */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:8,marginBottom:14}}>
        <div style={{background:"var(--card-bg,#fff)",borderRadius:8,border:"1px solid var(--border-color,#e2e8f0)",padding:"10px 14px"}}>
          <div style={{fontSize:10,color:"#94a3b8",fontWeight:600,textTransform:"uppercase" as const,letterSpacing:.3}}>Total Komponen</div>
          <div style={{fontSize:22,fontWeight:700,color:"#2563eb",marginTop:4}}>{stokList.length}</div>
          <div style={{fontSize:10,color:"#94a3b8",marginTop:2}}>jenis komponen</div>
        </div>
        <div onClick={()=>setModalTipe("masuk")}
          style={{background:"var(--card-bg,#fff)",borderRadius:8,border:"1px solid var(--border-color,#e2e8f0)",padding:"10px 14px",cursor:"pointer",transition:"box-shadow .15s"}}
          onMouseEnter={(e:any)=>e.currentTarget.style.border="1px solid #bbf7d0"}
          onMouseLeave={(e:any)=>e.currentTarget.style.border="1px solid var(--border-color,#e2e8f0)"}>
          <div style={{fontSize:10,color:"#94a3b8",fontWeight:600,textTransform:"uppercase" as const,letterSpacing:.3,display:"flex",alignItems:"center",gap:4}}>
            <i className="ti ti-arrow-down" style={{fontSize:11,color:"#16a34a"}}/>Masuk Bulan Ini
          </div>
          <div style={{fontSize:22,fontWeight:700,color:"#16a34a",marginTop:4}}>+{totalMasukBulan}</div>
          <div style={{fontSize:10,color:"#16a34a",marginTop:2}}>pcs · {masukBulanIni.length} transaksi · klik untuk detail</div>
        </div>
        <div onClick={()=>setModalTipe("keluar")}
          style={{background:"var(--card-bg,#fff)",borderRadius:8,border:"1px solid var(--border-color,#e2e8f0)",padding:"10px 14px",cursor:"pointer",transition:"box-shadow .15s"}}
          onMouseEnter={(e:any)=>e.currentTarget.style.border="1px solid #fecaca"}
          onMouseLeave={(e:any)=>e.currentTarget.style.border="1px solid var(--border-color,#e2e8f0)"}>
          <div style={{fontSize:10,color:"#94a3b8",fontWeight:600,textTransform:"uppercase" as const,letterSpacing:.3,display:"flex",alignItems:"center",gap:4}}>
            <i className="ti ti-arrow-up" style={{fontSize:11,color:"#dc2626"}}/>Keluar Bulan Ini
          </div>
          <div style={{fontSize:22,fontWeight:700,color:"#dc2626",marginTop:4}}>-{totalKeluarBulan}</div>
          <div style={{fontSize:10,color:"#dc2626",marginTop:2}}>pcs · {keluarBulanIni.length} transaksi · klik untuk detail</div>
        </div>
      </div>

      {/* Filter + Search */}
      <div style={{display:"flex",gap:8,marginBottom:10,flexWrap:"wrap" as const,alignItems:"center",position:"relative" as const}}>
        {/* Multi-select dropdown kode */}
        <div style={{position:"relative" as const}}>
          <button onClick={()=>setShowKodeDD(p=>!p)}
            style={{height:30,padding:"0 12px",border:"1px solid #e2e8f0",borderRadius:8,
              fontSize:11,background:"var(--input-bg,#fff)",color:"var(--text-secondary,#475569)",
              cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:6,minWidth:140}}>
            <i className="ti ti-filter" style={{fontSize:12}}/>
            {filterKode.length===0?"Semua Kode":filterKode.length+" kode dipilih"}
            <i className="ti ti-chevron-down" style={{fontSize:11,marginLeft:"auto"}}/>
          </button>
          {showKodeDD&&(
            <div style={{position:"absolute" as const,top:34,left:0,zIndex:100,
              background:"var(--card-bg,#fff)",border:"1px solid #e2e8f0",
              borderRadius:8,boxShadow:"0 4px 16px #00000015",minWidth:180,padding:6}}>
              <div style={{padding:"4px 8px",fontSize:10,color:"#94a3b8",fontWeight:600,textTransform:"uppercase" as const,letterSpacing:.3}}>Filter Kode</div>
              {filterKode.length>0&&(
                <button onClick={()=>setFilterKode([])}
                  style={{width:"100%",padding:"5px 8px",background:"#fef2f2",border:"none",
                    borderRadius:6,color:"#dc2626",fontSize:11,cursor:"pointer",fontFamily:"inherit",textAlign:"left" as const,marginBottom:4}}>
                  ✕ Reset filter
                </button>
              )}
              {kodeList.map((k:string)=>{
                const isSel=filterKode.includes(k);
                return(
                  <div key={k} onClick={()=>setFilterKode(prev=>isSel?prev.filter(x=>x!==k):[...prev,k])}
                    style={{padding:"6px 8px",borderRadius:6,cursor:"pointer",fontSize:11,
                      display:"flex",alignItems:"center",gap:8,
                      background:isSel?"#eff6ff":"transparent",color:isSel?"#1d4ed8":"var(--text-primary,#1e293b)"}}>
                    <span style={{width:14,height:14,borderRadius:3,border:`1.5px solid ${isSel?"#1d4ed8":"#cbd5e1"}`,
                      background:isSel?"#1d4ed8":"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                      {isSel&&<i className="ti ti-check" style={{fontSize:10,color:"#fff"}}/>}
                    </span>
                    {k}
                  </div>
                );
              })}
            </div>
          )}
        </div>
        {showKodeDD&&<div style={{position:"fixed" as const,inset:0,zIndex:99}} onClick={()=>setShowKodeDD(false)}/>}
        <input value={search} onChange={e=>setSearch(e.target.value)}
          placeholder="🔍 Cari nama / kode komponen..."
          style={{height:30,padding:"0 12px",border:"1px solid #e2e8f0",borderRadius:8,
            fontSize:12,background:"var(--input-bg,#fff)",outline:"none",
            color:"var(--text-primary,#1e293b)",fontFamily:"inherit",flex:1,minWidth:180}}/>
        <span style={{fontSize:11,color:"#94a3b8",marginLeft:"auto"}}>{filtered.length} komponen</span>
        <span style={{fontSize:10,color:"#94a3b8",padding:"2px 8px",background:"var(--bg-tertiary,#f1f5f9)",borderRadius:5}}>👁 Read-only</span>
      </div>

      {/* Tabel */}
      <div style={{overflowX:"auto" as const,borderRadius:10,border:"1px solid #e2e8f0"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
          <thead><tr>
            <th style={{...thS,width:36,textAlign:"center" as const}}>No</th>
            <th style={thS}>Kode</th>
            <th style={thS}>Nama Komponen</th>
            <th style={{...thS,textAlign:"center" as const}}>Stok</th>
            <th style={{...thS,textAlign:"center" as const}}>Tgl Masuk Terakhir</th>
            <th style={{...thS,textAlign:"center" as const}}>Jml Masuk</th>
            <th style={{...thS,textAlign:"center" as const}}>Tgl Keluar Terakhir</th>
            <th style={{...thS,textAlign:"center" as const}}>Jml Keluar</th>
          </tr></thead>
          <tbody>
            {filtered.length===0?(
              <tr><td colSpan={8} style={{textAlign:"center",padding:32,color:"#94a3b8"}}>Tidak ada data</td></tr>
            ):filtered.map((s:any,i:number)=>{
              const rBg=i%2===0?"var(--card-bg,#fff)":"var(--bg-secondary,#f8fafc)";
              const masukT=getMasukTerakhir(s.id);
              const keluarT=getKeluarTerakhir(s.id);
              const stokColor=s.stok===0?"#dc2626":s.stok<=5?"#f59e0b":"#16a34a";
              const td:any={padding:"8px 12px",borderBottom:"1px solid #f1f5f9",
                borderRight:"1px solid #f1f5f9",background:rBg,verticalAlign:"middle" as const};
              return(
                <tr key={s.id}>
                  <td style={{...td,textAlign:"center" as const,color:"#94a3b8",fontWeight:600}}>{i+1}</td>
                  <td style={td}>
                    {s.kode?<span style={{background:"#eff6ff",color:"#1d4ed8",border:"1px solid #bfdbfe",
                      borderRadius:4,padding:"1px 7px",fontSize:10,fontWeight:700}}>{s.kode}</span>
                      :<span style={{color:"#cbd5e1",fontSize:10}}>—</span>}
                  </td>
                  <td style={{...td,fontWeight:600,color:"var(--text-primary,#1e293b)"}}>{s.nama}</td>
                  <td style={{...td,textAlign:"center" as const}}>
                    <span style={{background:stokColor+"18",color:stokColor,
                      border:`1px solid ${stokColor}33`,borderRadius:20,
                      padding:"2px 10px",fontSize:11,fontWeight:800}}>
                      {s.stok} pcs
                    </span>
                  </td>
                  <td style={{...td,textAlign:"center" as const,fontSize:11,color:"#64748b"}}>{masukT?fmtDate(masukT.tanggal):"—"}</td>
                  <td style={{...td,textAlign:"center" as const,color:"#16a34a",fontWeight:700}}>{masukT?"+"+masukT.jumlah+" pcs":"—"}</td>
                  <td style={{...td,textAlign:"center" as const,fontSize:11,color:"#64748b"}}>{keluarT?fmtDate(keluarT.tanggal):"—"}</td>
                  <td style={{...td,textAlign:"center" as const,color:"#dc2626",fontWeight:700}}>{keluarT?"-"+keluarT.jumlah+" pcs":"—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {modalTipe==="masuk"&&<MasukModal/>}
      {modalTipe==="keluar"&&<KeluarModal/>}
    </div>
  );
}

"""

# Insert sebelum function SystemTab
INSERT_BEFORE = """function SystemTab({user,activityLog,pekerja,setPekerja,createPekerja,updatePekerja,removePekerja,logActivity,woData}){"""

if INSERT_BEFORE in content:
    content = content.replace(INSERT_BEFORE, NEW_COMPONENT + INSERT_BEFORE)
    print("[OK] StokMonitoringTab berhasil ditambah")
else:
    print("[FAIL] INSERT_BEFORE tidak ditemukan")
    import sys; sys.exit(1)

# ============================================================
# 2. Update render tab stok di main app - pakai StokMonitoringTab
# ============================================================
OLD_RENDER = """              {tab==="stok"&&<KomponenStokTab user={user} activityLog={activityLog}/>}"""
NEW_RENDER = """              {tab==="stok"&&<StokMonitoringTab user={user} activityLog={activityLog}/>}"""

if OLD_RENDER in content:
    content = content.replace(OLD_RENDER, NEW_RENDER)
    print("[OK] Render tab stok diupdate ke StokMonitoringTab")
else:
    print("[FAIL] Render tab stok tidak ditemukan")
    import sys; sys.exit(1)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("[OK] App.tsx berhasil diupdate")
print("[INFO] Jalankan: npm run build")
