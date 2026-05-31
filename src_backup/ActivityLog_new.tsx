function ActivityLogView({activityLog,user}){
  const [filterAdmin,setFilterAdmin]=useState("ALL");
  const [filterJenis,setFilterJenis]=useState("ALL");
  const [filterTgl,setFilterTgl]=useState("");
  const [search,setSearch]=useState("");

  const adminList=[...new Set(activityLog.map(a=>a.admin_nama||a.user_name).filter(Boolean))];
  const jenisList=[...new Set(activityLog.map(a=>a.jenis).filter(Boolean))];

  const filtered=activityLog.filter(a=>
    (filterAdmin==="ALL"||(a.admin_nama||a.user_name)===filterAdmin)&&
    (filterJenis==="ALL"||a.jenis===filterJenis)&&
    (!filterTgl||a.created_at?.startsWith(filterTgl))&&
    (!search||(a.aktivitas||a.action||"").toLowerCase().includes(search.toLowerCase())||
      (a.admin_nama||a.user_name||"").toLowerCase().includes(search.toLowerCase())||
      (a.wo_no||"").toLowerCase().includes(search.toLowerCase()))
  );

  const JENIS_COLOR={
    "wo":"#2563eb","raw":"#f59e0b","rencana":"#10b981",
    "progress":"#8b5cf6","kendala":"#ef4444","auth":"#64748b","pekerja":"#0891b2",
  };

  const fmtTime=(ts)=>{
    if(!ts)return"—";
    const d=new Date(ts);
    return d.toLocaleDateString("id-ID",{day:"numeric",month:"short",year:"numeric"})+" "+
      d.toLocaleTimeString("id-ID",{hour:"2-digit",minute:"2-digit"});
  };

  return(
    <div className="fi">
      <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap",alignItems:"flex-end"}}>
        <div>
          <Lbl>Cari</Lbl>
          <input value={search} onChange={e=>setSearch(e.target.value)}
            placeholder="Cari aktivitas, admin, WO..."
            style={{padding:"8px 14px",borderRadius:9,border:"1.5px solid #e2e8f0",
              background:"#fff",fontSize:13,width:240,color:"#1e293b"}}/>
        </div>
        <div>
          <Lbl>Filter Admin</Lbl>
          <Sel value={filterAdmin} onChange={e=>setFilterAdmin(e.target.value)} style={{minWidth:160}}>
            <option value="ALL">Semua Admin</option>
            {adminList.map(a=><option key={a} value={a}>{a}</option>)}
          </Sel>
        </div>
        <div>
          <Lbl>Filter Jenis</Lbl>
          <Sel value={filterJenis} onChange={e=>setFilterJenis(e.target.value)} style={{minWidth:140}}>
            <option value="ALL">Semua Jenis</option>
            {jenisList.map(j=><option key={j} value={j}>{j}</option>)}
          </Sel>
        </div>
        <div>
          <Lbl>Filter Tanggal</Lbl>
          <Inp type="date" value={filterTgl} onChange={e=>setFilterTgl(e.target.value)} style={{minWidth:160}}/>
        </div>
        {(filterAdmin!=="ALL"||filterJenis!=="ALL"||filterTgl||search)&&(
          <Btn outline color="#64748b" style={{padding:"7px 14px",fontSize:12}}
            onClick={()=>{setFilterAdmin("ALL");setFilterJenis("ALL");setFilterTgl("");setSearch("");}}>
            Reset
          </Btn>
        )}
        <div style={{marginLeft:"auto",fontSize:12,color:"#64748b",alignSelf:"flex-end",paddingBottom:4}}>
          {filtered.length} aktivitas
        </div>
      </div>

      {/* Stats */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))",gap:10,marginBottom:16}}>
        {[
          {l:"Total Log",v:activityLog.length,c:"#2563eb"},
          {l:"Hari Ini",v:activityLog.filter(a=>a.created_at?.startsWith(new Date().toISOString().slice(0,10))).length,c:"#10b981"},
          {l:"Admin Aktif",v:new Set(activityLog.map(a=>a.admin_nama||a.user_name).filter(Boolean)).size,c:"#f59e0b"},
        ].map((s,i)=>(
          <Card key={i} style={{padding:"12px 16px",borderLeft:`3px solid ${s.c}`}}>
            <div style={{fontSize:20,fontWeight:800,color:s.c}}>{s.v}</div>
            <div style={{fontSize:10,color:"#94a3b8",marginTop:2,fontWeight:600,textTransform:"uppercase"}}>{s.l}</div>
          </Card>
        ))}
      </div>

      {filtered.length===0?(
        <div style={{textAlign:"center",padding:"60px 20px",color:"#94a3b8"}}>
          <div style={{fontSize:40,marginBottom:12}}>📋</div>
          <div style={{fontSize:14,fontWeight:600}}>Belum ada aktivitas</div>
        </div>
      ):(
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {filtered.map((a,i)=>{
            const jColor=JENIS_COLOR[a.jenis]||"#64748b";
            const adminName=a.admin_nama||a.user_name||"—";
            const aktivitas=a.aktivitas||a.action||"—";
            return(
              <div key={a.id||i} style={{background:"#fff",borderRadius:12,border:"1px solid #e2e8f0",
                padding:"12px 16px",borderLeft:`4px solid ${jColor}`,
                display:"flex",alignItems:"flex-start",gap:12,flexWrap:"wrap"}}>
                <div style={{width:36,height:36,borderRadius:10,background:jColor+"18",
                  display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>
                  {a.jenis==="wo"?"📋":a.jenis==="raw"?"📅":a.jenis==="rencana"?"📊":
                   a.jenis==="progress"?"📈":a.jenis==="kendala"?"⚠️":a.jenis==="auth"?"🔐":"⚙️"}
                </div>
                <div style={{flex:1,minWidth:200}}>
                  <div style={{fontWeight:700,fontSize:13,color:"#1e293b",marginBottom:3}}>{aktivitas}</div>
                  <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
                    <span style={{fontSize:11,color:"#475569",fontWeight:600}}>👤 {adminName}</span>
                    {a.wo_no&&<span style={{fontSize:11,color:"#2563eb",fontWeight:700,fontFamily:"'DM Mono',monospace"}}>WO {a.wo_no}</span>}
                    {a.halaman&&<span style={{fontSize:10,color:"#94a3b8"}}>📍 {a.halaman}</span>}
                  </div>
                </div>
                <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4}}>
                  <span style={{background:jColor+"18",color:jColor,border:`1px solid ${jColor}33`,
                    borderRadius:20,padding:"2px 9px",fontSize:10,fontWeight:700}}>{a.jenis||"—"}</span>
                  <span style={{fontSize:11,color:"#94a3b8"}}>{fmtTime(a.created_at)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
