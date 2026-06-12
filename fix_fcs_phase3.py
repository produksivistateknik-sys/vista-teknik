file_path = r"C:\Users\User\vista-teknik\src\App.tsx"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

with open(file_path + ".bak_fcs_phase3", "w", encoding="utf-8") as f:
    f.write(content)
print("[OK] Backup dibuat")

# Fix 1: Tambah FCS Schedule di sidebar PRODUKSI
OLD_SIDEBAR = """    {group:"PRODUKSI",items:[
      ...(canRaw?[{id:"raw",label:"Raw Schedule",icon:"ti ti-calendar-event"}]:[]),
      ...(canRencana?[{id:"rencana",label:"Rencana Harian",icon:"ti ti-clipboard-list"}]:[]),
      ...(canWO?[{id:"wo",label:"Manajemen WO",icon:"ti ti-file-description"}]:[]),
    ]},"""

NEW_SIDEBAR = """    {group:"PRODUKSI",items:[
      ...(canRaw?[{id:"raw",label:"Raw Schedule",icon:"ti ti-calendar-event"}]:[]),
      ...(canRencana?[{id:"rencana",label:"Rencana Harian",icon:"ti ti-clipboard-list"}]:[]),
      ...(canWO?[{id:"wo",label:"Manajemen WO",icon:"ti ti-file-description"}]:[]),
      ...(canWO?[{id:"fcs",label:"FCS Schedule",icon:"ti ti-timeline"}]:[]),
    ]},"""

# Fix 2: Tambah render tab FCS
OLD_RENDER = """              {tab==="dashboard"&&<Dashboard woData={woData}/>}"""
NEW_RENDER = """              {tab==="dashboard"&&<Dashboard woData={woData}/>}
              {tab==="fcs"&&<FCSScheduleTab woData={woData} user={user}/>}"""

# Fix 3: Tambah komponen FCSScheduleTab sebelum export default App
INSERT_BEFORE = "export default function App(){"

FCS_TAB_COMPONENT = """function FCSScheduleTab({woData,user}:any){
  const [scheduleList,setScheduleList]=useState<any[]>([]);
  const [kapasitasList,setKapasitasList]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);
  const [filterWO,setFilterWO]=useState("ALL");
  const [filterPekerjaan,setFilterPekerjaan]=useState("POTONG");
  const [filterStatus,setFilterStatus]=useState("ALL");
  const [weekStart,setWeekStart]=useState(new Date().toISOString().slice(0,10));
  const [approveId,setApproveId]=useState<any>(null);

  const ALL_STATUS=["planning","released","in_progress","completed","cancelled"];
  const STATUS_COLOR:any={
    planning:{bg:"#f1f5f9",color:"#64748b",label:"Planning"},
    released:{bg:"#eff6ff",color:"#1d4ed8",label:"Released"},
    in_progress:{bg:"#fffbeb",color:"#d97706",label:"In Progress"},
    completed:{bg:"#f0fdf4",color:"#16a34a",label:"Completed"},
    cancelled:{bg:"#fef2f2",color:"#dc2626",label:"Cancelled"},
  };

  useEffect(()=>{fetchAll();},[filterPekerjaan]);

  const fetchAll=async()=>{
    setLoading(true);
    const [{data:s},{data:k}]=await Promise.all([
      supabase.from("fcs_schedule").select("*")
        .eq("jenis_pekerjaan",filterPekerjaan)
        .order("tanggal",{ascending:true})
        .order("wp",{ascending:true}),
      supabase.from("fcs_kapasitas_pekerjaan").select("*")
        .eq("jenis_pekerjaan",filterPekerjaan)
        .single(),
    ]);
    setScheduleList(s??[]);
    setKapasitasList(k?[k]:[]);
    setLoading(false);
  };

  const kapasitasHarian=kapasitasList[0]?.kapasitas_menit_hari||420;

  // Hitung kapasitas per tanggal
  const kapPerTanggal=useMemo(()=>{
    const map:Record<string,number>={};
    scheduleList.filter(s=>s.status!=="cancelled").forEach(s=>{
      if(!map[s.tanggal])map[s.tanggal]=0;
      map[s.tanggal]+=Number(s.total_menit);
    });
    return map;
  },[scheduleList]);

  // Tanggal unik
  const tanggalList=useMemo(()=>{
    return [...new Set(scheduleList.map(s=>s.tanggal))].sort();
  },[scheduleList]);

  // Filter schedule
  const filtered=useMemo(()=>{
    return scheduleList.filter(s=>{
      const matchWO=filterWO==="ALL"||s.wo_number===filterWO;
      const matchStatus=filterStatus==="ALL"||s.status===filterStatus;
      return matchWO&&matchStatus;
    });
  },[scheduleList,filterWO,filterStatus]);

  const updateStatus=async(id:number,status:string)=>{
    const sess=JSON.parse(localStorage.getItem("vista_admin_session")||"{}");
    const uname=user?.name||user?.nama||sess?.nama||"Admin";
    await supabase.from("fcs_schedule").update({
      status,
      ...(status==="released"?{approved_by:uname,approved_at:new Date().toISOString()}:{})
    }).eq("id",id);
    setScheduleList(prev=>prev.map(s=>s.id===id?{...s,status}:s));
    setApproveId(null);
  };

  const fmtDate=(d:string)=>new Date(d).toLocaleDateString("id-ID",{weekday:"short",day:"numeric",month:"short"});

  const thS:any={background:"#1e2330",color:"#c8d0e8",padding:"7px 10px",fontWeight:600,
    fontSize:10,textAlign:"left" as const,whiteSpace:"nowrap" as const,
    borderRight:"1px solid #ffffff10",textTransform:"uppercase" as const,letterSpacing:.4};

  if(loading)return <div style={{textAlign:"center",padding:40,color:"#94a3b8"}}>Memuat jadwal FCS...</div>;

  return(
    <div className="fi">
      {/* Header stats */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:14}}>
        {[
          {l:"Total Jadwal",v:scheduleList.length,c:"#2563eb"},
          {l:"Planning",v:scheduleList.filter(s=>s.status==="planning").length,c:"#64748b"},
          {l:"Released",v:scheduleList.filter(s=>s.status==="released").length,c:"#1d4ed8"},
          {l:"Completed",v:scheduleList.filter(s=>s.status==="completed").length,c:"#16a34a"},
        ].map((s,i)=>(
          <div key={i} style={{background:"var(--card-bg,#fff)",border:"1px solid var(--border-color,#e2e8f0)",borderRadius:8,padding:"10px 14px",borderTop:`3px solid ${s.c}`}}>
            <div style={{fontSize:22,fontWeight:700,color:s.c}}>{s.v}</div>
            <div style={{fontSize:9,color:"#94a3b8",marginTop:3,fontWeight:600,textTransform:"uppercase" as const,letterSpacing:.3}}>{s.l}</div>
          </div>
        ))}
      </div>

      {/* Capacity utilization per tanggal */}
      {tanggalList.length>0&&(
        <div style={{background:"var(--card-bg,#fff)",border:"1px solid var(--border-color,#e2e8f0)",borderRadius:8,padding:"12px 14px",marginBottom:14}}>
          <div style={{fontSize:11,fontWeight:700,color:"#64748b",textTransform:"uppercase" as const,letterSpacing:.4,marginBottom:10}}>
            \u26a1 Capacity Utilization — {filterPekerjaan} ({kapasitasHarian} mnt/hari)
          </div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap" as const}}>
            {tanggalList.slice(0,14).map(tgl=>{
              const terpakai=kapPerTanggal[tgl]||0;
              const pct=Math.min(Math.round((terpakai/kapasitasHarian)*100),100);
              const color=pct>=95?"#dc2626":pct>=80?"#f59e0b":"#16a34a";
              const bg=pct>=95?"#fef2f2":pct>=80?"#fffbeb":"#f0fdf4";
              return(
                <div key={tgl} style={{background:bg,border:`1px solid ${color}30`,borderRadius:8,padding:"8px 12px",minWidth:100,textAlign:"center" as const}}>
                  <div style={{fontSize:10,color:"#64748b",marginBottom:4}}>{fmtDate(tgl)}</div>
                  <div style={{width:"100%",height:6,background:"#e2e8f0",borderRadius:99,overflow:"hidden",marginBottom:4}}>
                    <div style={{width:pct+"%",height:"100%",background:color,borderRadius:99}}/>
                  </div>
                  <div style={{fontSize:11,fontWeight:700,color}}>{pct}%</div>
                  <div style={{fontSize:9,color:"#94a3b8"}}>{terpakai}/{kapasitasHarian} mnt</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Filter bar */}
      <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap" as const,alignItems:"center",background:"var(--card-bg,#fff)",borderRadius:8,padding:"10px 12px",border:"1px solid var(--border-color,#e2e8f0)"}}>
        <select value={filterPekerjaan} onChange={e=>{setFilterPekerjaan(e.target.value);}}
          style={{height:28,padding:"0 8px",border:"1px solid #e2e8f0",borderRadius:6,fontSize:11,background:"#f8fafc",outline:"none",fontFamily:"inherit",fontWeight:700,color:"#1d4ed8"}}>
          {["POTONG","BENDING","STEL","PAINTING","RAKIT","PASANG KOMPONEN","BUSBAR","WIRING CONTROL","WIRING POWER","QC TEST","PACKING"].map(p=>(
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        <select value={filterWO} onChange={e=>setFilterWO(e.target.value)}
          style={{height:28,padding:"0 8px",border:"1px solid #e2e8f0",borderRadius:6,fontSize:11,background:"#f8fafc",outline:"none",fontFamily:"inherit"}}>
          <option value="ALL">Semua WO</option>
          {[...new Set(scheduleList.map(s=>s.wo_number))].map(wo=>(
            <option key={wo} value={wo}>WO {wo}</option>
          ))}
        </select>
        <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}
          style={{height:28,padding:"0 8px",border:"1px solid #e2e8f0",borderRadius:6,fontSize:11,background:"#f8fafc",outline:"none",fontFamily:"inherit"}}>
          <option value="ALL">Semua Status</option>
          {ALL_STATUS.map(s=><option key={s} value={s}>{STATUS_COLOR[s]?.label||s}</option>)}
        </select>
        <span style={{fontSize:11,color:"#94a3b8",marginLeft:"auto"}}>{filtered.length} jadwal</span>
        <button onClick={fetchAll}
          style={{height:28,padding:"0 12px",borderRadius:6,border:"1px solid #e2e8f0",background:"#f8fafc",color:"#475569",fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>
          \u21bb Refresh
        </button>
      </div>

      {/* Tabel jadwal */}
      {filtered.length===0?(
        <div style={{background:"var(--card-bg,#fff)",border:"1px solid var(--border-color,#e2e8f0)",borderRadius:8,padding:"40px",textAlign:"center" as const,color:"#94a3b8"}}>
          <div style={{fontSize:32,marginBottom:8}}>\u23f1</div>
          <div style={{fontSize:13,fontWeight:600}}>Belum ada jadwal FCS</div>
          <div style={{fontSize:12,marginTop:4}}>Generate schedule dari Manajemen WO terlebih dahulu</div>
        </div>
      ):(
        <div style={{overflowX:"auto" as const,borderRadius:10,border:"1px solid #e2e8f0"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
            <thead><tr>
              <th style={thS}>Tanggal</th>
              <th style={thS}>WO</th>
              <th style={thS}>Proyek</th>
              <th style={thS}>Panel</th>
              <th style={{...thS,textAlign:"center" as const}}>WP</th>
              <th style={thS}>Komponen</th>
              <th style={{...thS,textAlign:"center" as const}}>Qty</th>
              <th style={{...thS,textAlign:"center" as const}}>Mnt/Pcs</th>
              <th style={{...thS,textAlign:"center" as const}}>Total Mnt</th>
              <th style={{...thS,textAlign:"center" as const}}>Status</th>
              <th style={{...thS,textAlign:"center" as const}}>Aksi</th>
            </tr></thead>
            <tbody>
              {filtered.map((s:any,i:number)=>{
                const sc=STATUS_COLOR[s.status]||STATUS_COLOR.planning;
                const rBg=i%2===0?"var(--card-bg,#fff)":"var(--bg-secondary,#f8fafc)";
                const td:any={padding:"7px 10px",borderBottom:"1px solid #f1f5f9",borderRight:"1px solid #f1f5f9",background:rBg,verticalAlign:"middle"};
                return(
                  <tr key={s.id}>
                    <td style={{...td,fontWeight:600,color:"#1e293b",whiteSpace:"nowrap" as const}}>{fmtDate(s.tanggal)}</td>
                    <td style={{...td,fontFamily:"monospace",fontWeight:700,color:"#1d4ed8"}}>WO {s.wo_number}</td>
                    <td style={{...td,color:"#475569"}}>{s.proyek}</td>
                    <td style={{...td,fontWeight:600,color:"#1e293b"}}>{s.panel_nama}</td>
                    <td style={{...td,textAlign:"center" as const}}>
                      <span style={{background:"#f1f5f9",color:"#475569",borderRadius:20,padding:"1px 8px",fontSize:10,fontWeight:700}}>{s.wp}</span>
                    </td>
                    <td style={td}>{s.nama_komponen}<span style={{fontSize:9,color:"#94a3b8",marginLeft:4}}>({s.kode_komponen})</span></td>
                    <td style={{...td,textAlign:"center" as const,fontWeight:700,color:"#1e293b"}}>{s.qty_hari}</td>
                    <td style={{...td,textAlign:"center" as const,color:"#64748b"}}>{s.menit_per_pcs}</td>
                    <td style={{...td,textAlign:"center" as const}}>
                      <span style={{fontWeight:700,color:"#1d4ed8"}}>{Number(s.total_menit).toFixed(1)}</span>
                    </td>
                    <td style={{...td,textAlign:"center" as const}}>
                      <span style={{background:sc.bg,color:sc.color,borderRadius:20,padding:"2px 9px",fontSize:10,fontWeight:700,border:`1px solid ${sc.color}30`}}>{sc.label}</span>
                    </td>
                    <td style={{...td,textAlign:"center" as const}}>
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
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Approve/Release */}
      {approveId&&(
        <Modal title="Release Schedule?" onClose={()=>setApproveId(null)} width={400}>
          <div style={{fontSize:13,color:"#475569",marginBottom:8}}>
            <strong>{approveId.nama_komponen}</strong> \u2014 {approveId.panel_nama}
          </div>
          <div style={{fontSize:12,color:"#64748b",marginBottom:16}}>
            Tanggal: <strong>{fmtDate(approveId.tanggal)}</strong> \u00b7 {approveId.qty_hari} pcs \u00b7 {approveId.total_menit} menit
          </div>
          <div style={{background:"#eff6ff",border:"1px solid #bfdbfe",borderRadius:8,padding:"10px 14px",marginBottom:16,fontSize:12,color:"#1d4ed8"}}>
            Status akan berubah dari <strong>Planning</strong> ke <strong>Released</strong>. Jadwal ini tidak dapat diubah setelah di-release.
          </div>
          <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
            <button onClick={()=>setApproveId(null)}
              style={{padding:"8px 16px",borderRadius:8,border:"1px solid #e2e8f0",background:"#f8fafc",color:"#64748b",fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>Batal</button>
            <button onClick={()=>updateStatus(approveId.id,"released")}
              style={{padding:"8px 20px",borderRadius:8,border:"none",background:"#1d4ed8",color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Release</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

"""

ok1 = OLD_SIDEBAR in content
ok2 = OLD_RENDER in content
ok3 = INSERT_BEFORE in content

print(f"  SIDEBAR: {'FOUND' if ok1 else 'MISSING'}")
print(f"  RENDER:  {'FOUND' if ok2 else 'MISSING'}")
print(f"  INSERT:  {'FOUND' if ok3 else 'MISSING'}")

if ok1 and ok2 and ok3:
    content = content.replace(OLD_SIDEBAR, NEW_SIDEBAR)
    content = content.replace(OLD_RENDER, NEW_RENDER)
    content = content.replace(INSERT_BEFORE, FCS_TAB_COMPONENT + INSERT_BEFORE, 1)
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)
    print("[OK] FCS Schedule Tab berhasil ditambah")
    print("[INFO] Jalankan: npm run build")
else:
    lines = content.split("\n")
    if not ok1:
        for i,l in enumerate(lines):
            if 'PRODUKSI' in l and 'items' in l:
                print(f"\nSIDEBAR baris {i+1}:")
                for j in range(i,min(i+6,len(lines))):
                    print(repr(lines[j]))
                break
