function ActivityLogView({activityLog}:any){
  const [filterAdmin,setFilterAdmin]=useState("ALL");
  const [filterModule,setFilterModule]=useState("ALL");
  const [filterAction,setFilterAction]=useState("ALL");
  const [filterTgl,setFilterTgl]=useState("");
  const [search,setSearch]=useState("");

  const MODULE_CONFIG:any={
    auth:    {label:"Auth",     icon:"🔐",color:"#64748b"},
    wo:      {label:"Work Order",icon:"📋",color:"#2563eb"},
    raw:     {label:"Raw Schedule",icon:"📅",color:"#f59e0b"},
    rencana: {label:"Rencana Harian",icon:"📊",color:"#10b981"},
    progress:{label:"Progress", icon:"📈",color:"#8b5cf6"},
    kendala: {label:"Kendala",  icon:"⚠️",color:"#ef4444"},
    pekerja: {label:"Pekerja",  icon:"👥",color:"#0891b2"},
    general: {label:"General",  icon:"⚙️",color:"#94a3b8"},
  };

  const ACTION_CONFIG:any={
    create:    {label:"Buat",      color:"#16a34a",bg:"#f0fdf4"},
    update:    {label:"Edit",      color:"#2563eb",bg:"#eff6ff"},
    delete:    {label:"Hapus",     color:"#dc2626",bg:"#fef2f2"},
    login:     {label:"Login",     color:"#7c3aed",bg:"#f5f3ff"},
    logout:    {label:"Logout",    color:"#64748b",bg:"#f8fafc"},
    distribute:{label:"Distribusi",color:"#0891b2",bg:"#ecfeff"},
  };

  const adminList=[...new Set(activityLog.map((a:any)=>a.admin_nama||a.user_name).filter(Boolean))];
  const moduleList=[...new Set(activityLog.map((a:any)=>a.module||a.jenis).filter(Boolean))];
  const actionList=[...new Set(activityLog.map((a:any)=>a.action_type).filter(Boolean))];

  const filtered=activityLog.filter((a:any)=>{
    const adminName=a.admin_nama||a.user_name||"";
    const module=a.module||a.jenis||"";
    const actionType=a.action_type||"";
    const desc=a.description||a.aktivitas||a.action||"";
    const woNo=a.wo_number||a.wo_no||"";
    if(filterAdmin!=="ALL"&&adminName!==filterAdmin)return false;
    if(filterModule!=="ALL"&&module!==filterModule)return false;
    if(filterAction!=="ALL"&&actionType!==filterAction)return false;
    if(filterTgl&&!a.created_at?.startsWith(filterTgl))return false;
    if(search){
      const q=search.toLowerCase();
      if(!desc.toLowerCase().includes(q)&&
         !adminName.toLowerCase().includes(q)&&
         !woNo.toLowerCase().includes(q))return false;
    }
    return true;
  });

  const fmtTime=(ts:string)=>{
    if(!ts)return"—";
    const d=new Date(ts);
    return d.toLocaleDateString("id-ID",{day:"numeric",month:"short",year:"numeric"})+" "+
      d.toLocaleTimeString("id-ID",{hour:"2-digit",minute:"2-digit"})+" WIB";
  };

  const todayStr=new Date().toISOString().slice(0,10);

  return(
    <div className="fi">
      {/* Stats */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:10,marginBottom:16}}>
        {[
          {l:"Total Log",v:activityLog.length,c:"#2563eb",i:"📊"},
          {l:"Hari Ini",v:activityLog.filter((a:any)=>a.created_at?.startsWith(todayStr)).length,c:"#10b981",i:"📅"},
          {l:"Admin Aktif",v:new Set(activityLog.map((a:any)=>a.admin_nama||a.user_name).filter(Boolean)).size,c:"#f59e0b",i:"👤"},
          {l:"WO Terlibat",v:new Set(activityLog.map((a:any)=>a.wo_number||a.wo_no).filter(Boolean)).size,c:"#8b5cf6",i:"📋"},
        ].map((s,i)=>(
          <Card key={i} style={{padding:"12px 16px",borderLeft:`3px solid ${s.c}`}}>
            <div style={{fontSize:18,marginBottom:4}}>{s.i}</div>
            <div style={{fontSize:22,fontWeight:800,color:s.c}}>{s.v}</div>
            <div style={{fontSize:10,color:"#94a3b8",marginTop:2,fontWeight:600,textTransform:"uppercase" as const,letterSpacing:.3}}>{s.l}</div>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card style={{marginBottom:16,padding:"12px 16px"}}>
        <div style={{display:"flex",gap:10,flexWrap:"wrap" as const,alignItems:"flex-end"}}>
          <div style={{flex:1,minWidth:200}}>
            <Lbl>Cari Aktivitas / Admin / WO</Lbl>
            <input value={search} onChange={e=>setSearch(e.target.value)}
              placeholder="Ketik untuk mencari..."
              style={{width:"100%",padding:"8px 12px",borderRadius:8,border:"1.5px solid #e2e8f0",
                background:"#f8fafc",fontSize:13,color:"#1e293b"}}/>
          </div>
          <div style={{minWidth:140}}>
            <Lbl>Admin</Lbl>
            <Sel value={filterAdmin} onChange={(e:any)=>setFilterAdmin(e.target.value)}>
              <option value="ALL">Semua Admin</option>
              {adminList.map((a:any)=><option key={a} value={a}>{a}</option>)}
            </Sel>
          </div>
          <div style={{minWidth:140}}>
            <Lbl>Module</Lbl>
            <Sel value={filterModule} onChange={(e:any)=>setFilterModule(e.target.value)}>
              <option value="ALL">Semua Module</option>
              {moduleList.map((m:any)=><option key={m} value={m}>{MODULE_CONFIG[m]?.label||m}</option>)}
            </Sel>
          </div>
          <div style={{minWidth:130}}>
            <Lbl>Action</Lbl>
            <Sel value={filterAction} onChange={(e:any)=>setFilterAction(e.target.value)}>
              <option value="ALL">Semua Action</option>
              {actionList.map((a:any)=><option key={a} value={a}>{ACTION_CONFIG[a]?.label||a}</option>)}
            </Sel>
          </div>
          <div style={{minWidth:140}}>
            <Lbl>Tanggal</Lbl>
            <Inp type="date" value={filterTgl} onChange={(e:any)=>setFilterTgl(e.target.value)}/>
          </div>
          {(filterAdmin!=="ALL"||filterModule!=="ALL"||filterAction!=="ALL"||filterTgl||search)&&(
            <Btn outline color="#64748b" style={{padding:"7px 14px",fontSize:12}}
              onClick={()=>{setFilterAdmin("ALL");setFilterModule("ALL");setFilterAction("ALL");setFilterTgl("");setSearch("");}}>
              Reset
            </Btn>
          )}
          <div style={{fontSize:12,color:"#64748b",alignSelf:"flex-end",paddingBottom:4,marginLeft:"auto"}}>
            {filtered.length} aktivitas
          </div>
        </div>
      </Card>

      {/* Log List */}
      {filtered.length===0?(
        <div style={{textAlign:"center",padding:"60px 20px",color:"#94a3b8"}}>
          <div style={{fontSize:40,marginBottom:12}}>📋</div>
          <div style={{fontSize:14,fontWeight:600}}>Tidak ada aktivitas</div>
        </div>
      ):(
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {filtered.map((a:any,i:number)=>{
            const module=a.module||a.jenis||"general";
            const actionType=a.action_type||"update";
            const mc=MODULE_CONFIG[module]||MODULE_CONFIG.general;
            const ac=ACTION_CONFIG[actionType]||{label:actionType,color:"#64748b",bg:"#f8fafc"};
            const adminName=a.admin_nama||a.user_name||"—";
            const desc=a.description||a.aktivitas||a.action||"—";
            const woNo=a.wo_number||a.wo_no||"";
            return(
              <div key={a.id||i} style={{background:"#fff",borderRadius:12,border:"1px solid #e2e8f0",
                padding:"14px 16px",borderLeft:`4px solid ${mc.color}`,
                display:"flex",gap:12,alignItems:"flex-start",transition:"all .15s"}}>
                {/* Icon */}
                <div style={{width:40,height:40,borderRadius:10,background:mc.color+"18",
                  display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>
                  {mc.icon}
                </div>
                {/* Content */}
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:700,fontSize:13,color:"#1e293b",marginBottom:4}}>{desc}</div>
                  <div style={{display:"flex",gap:8,flexWrap:"wrap" as const,alignItems:"center"}}>
                    <span style={{fontSize:11,color:"#475569",fontWeight:600,display:"flex",alignItems:"center",gap:4}}>
                      <span>👤</span>{adminName}
                    </span>
                    {woNo&&(
                      <span style={{fontSize:11,color:"#2563eb",fontWeight:700,
                        fontFamily:"'DM Mono',monospace",background:"#eff6ff",
                        borderRadius:4,padding:"1px 6px"}}>
                        WO {woNo}
                      </span>
                    )}
                    <span style={{fontSize:10,color:"#94a3b8",display:"flex",alignItems:"center",gap:3}}>
                      <span>📍</span>{a.halaman||mc.label}
                    </span>
                  </div>
                </div>
                {/* Right side */}
                <div style={{display:"flex",flexDirection:"column" as const,alignItems:"flex-end",gap:6,flexShrink:0}}>
                  <div style={{display:"flex",gap:5}}>
                    <span style={{background:mc.color+"18",color:mc.color,border:`1px solid ${mc.color}33`,
                      borderRadius:20,padding:"2px 8px",fontSize:10,fontWeight:700}}>
                      {mc.label}
                    </span>
                    <span style={{background:ac.bg,color:ac.color,border:`1px solid ${ac.color}33`,
                      borderRadius:20,padding:"2px 8px",fontSize:10,fontWeight:700}}>
                      {ac.label}
                    </span>
                  </div>
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
