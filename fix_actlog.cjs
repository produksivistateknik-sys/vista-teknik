const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

const startIdx = content.indexOf('function ActivityLogView(');
const endIdx = content.indexOf('\nfunction KendalaInbox(', startIdx);

const newFn = `function ActivityLogView({activityLog}:any){
  const [filterAdmin,setFilterAdmin]=useState("ALL");
  const [filterModule,setFilterModule]=useState("ALL");
  const [filterAction,setFilterAction]=useState("ALL");
  const [filterTgl,setFilterTgl]=useState("");
  const [search,setSearch]=useState("");

  const MODULE_CONFIG:any={
    auth:    {label:"Auth",        color:"#64748b",bg:"#f8fafc",icon:"🔐"},
    wo:      {label:"Work Order",  color:"#2563eb",bg:"#eff6ff",icon:"📋"},
    raw:     {label:"Raw Schedule",color:"#f59e0b",bg:"#fffbeb",icon:"📅"},
    rencana: {label:"Rencana",     color:"#10b981",bg:"#f0fdf4",icon:"📊"},
    progress:{label:"Progress",    color:"#8b5cf6",bg:"#f5f3ff",icon:"📈"},
    kendala: {label:"Kendala",     color:"#ef4444",bg:"#fef2f2",icon:"⚠️"},
    pekerja: {label:"Pekerja",     color:"#0891b2",bg:"#ecfeff",icon:"👥"},
    general: {label:"General",     color:"#94a3b8",bg:"#f8fafc",icon:"⚙️"},
    update:  {label:"Update",      color:"#2563eb",bg:"#eff6ff",icon:"✏️"},
    create:  {label:"Create",      color:"#10b981",bg:"#f0fdf4",icon:"➕"},
    delete:  {label:"Delete",      color:"#ef4444",bg:"#fef2f2",icon:"🗑"},
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
  const todayStr=new Date().toISOString().slice(0,10);

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
      if(!desc.toLowerCase().includes(q)&&!adminName.toLowerCase().includes(q)&&!woNo.toLowerCase().includes(q))return false;
    }
    return true;
  });

  const fmtTime=(ts:string)=>{
    if(!ts)return"—";
    const d=new Date(ts);
    return d.toLocaleDateString("id-ID",{day:"numeric",month:"short",year:"numeric"})+" "+
      d.toLocaleTimeString("id-ID",{hour:"2-digit",minute:"2-digit"})+" WIB";
  };

  const stats=[
    {l:"Total Log",v:activityLog.length,c:"#2563eb"},
    {l:"Hari Ini",v:activityLog.filter((a:any)=>a.created_at?.startsWith(todayStr)).length,c:"#10b981"},
    {l:"Admin Aktif",v:new Set(activityLog.map((a:any)=>a.admin_nama||a.user_name).filter(Boolean)).size,c:"#f59e0b"},
    {l:"WO Terlibat",v:new Set(activityLog.map((a:any)=>a.wo_number||a.wo_no).filter(Boolean)).size,c:"#8b5cf6"},
  ];

  const isReset=filterAdmin!=="ALL"||filterModule!=="ALL"||filterAction!=="ALL"||filterTgl||search;

  return(
    <div className="fi">
      {/* Stat cards */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:12}}>
        {stats.map((s,i)=>(
          <div key={i} style={{background:"#fff",border:"1px solid #eaecf0",borderRadius:7,padding:"10px 12px",borderLeft:\`3px solid \${s.c}\`}}>
            <div style={{fontSize:20,fontWeight:700,color:s.c,lineHeight:1}}>{s.v}</div>
            <div style={{fontSize:9.5,color:"#94a3b8",marginTop:3,fontWeight:600,textTransform:"uppercase" as const,letterSpacing:.3}}>{s.l}</div>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div style={{background:"#fff",border:"1px solid #eaecf0",borderRadius:7,padding:"8px 12px",marginBottom:10,display:"flex",gap:7,flexWrap:"wrap" as const,alignItems:"center"}}>
        <input value={search} onChange={e=>setSearch(e.target.value)}
          placeholder="🔍 Cari aktivitas, admin, WO..."
          style={{height:28,padding:"0 10px 0 28px",border:"1px solid #e2e8f0",borderRadius:5,fontSize:11.5,background:"#f8fafc url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2'%3E%3Ccircle cx='11' cy='11' r='8'/%3E%3Cpath d='m21 21-4.35-4.35'/%3E%3C/svg%3E\") no-repeat 8px center",color:"#1e293b",outline:"none",width:220,fontFamily:"inherit"}}/>
        <select value={filterAdmin} onChange={(e:any)=>setFilterAdmin(e.target.value)}
          style={{height:28,padding:"0 8px",border:"1px solid #e2e8f0",borderRadius:5,fontSize:11.5,background:"#f8fafc",color:"#475569",outline:"none",cursor:"pointer",fontFamily:"inherit"}}>
          <option value="ALL">Semua Admin</option>
          {adminList.map((a:any)=><option key={a} value={a}>{a}</option>)}
        </select>
        <select value={filterModule} onChange={(e:any)=>setFilterModule(e.target.value)}
          style={{height:28,padding:"0 8px",border:"1px solid #e2e8f0",borderRadius:5,fontSize:11.5,background:"#f8fafc",color:"#475569",outline:"none",cursor:"pointer",fontFamily:"inherit"}}>
          <option value="ALL">Semua Module</option>
          {moduleList.map((m:any)=><option key={m} value={m}>{MODULE_CONFIG[m]?.label||m}</option>)}
        </select>
        <select value={filterAction} onChange={(e:any)=>setFilterAction(e.target.value)}
          style={{height:28,padding:"0 8px",border:"1px solid #e2e8f0",borderRadius:5,fontSize:11.5,background:"#f8fafc",color:"#475569",outline:"none",cursor:"pointer",fontFamily:"inherit"}}>
          <option value="ALL">Semua Action</option>
          {actionList.map((a:any)=><option key={a} value={a}>{ACTION_CONFIG[a]?.label||a}</option>)}
        </select>
        <input type="date" value={filterTgl} onChange={(e:any)=>setFilterTgl(e.target.value)}
          style={{height:28,padding:"0 8px",border:"1px solid #e2e8f0",borderRadius:5,fontSize:11.5,background:"#f8fafc",color:"#475569",outline:"none",fontFamily:"inherit"}}/>
        {isReset&&(
          <button onClick={()=>{setFilterAdmin("ALL");setFilterModule("ALL");setFilterAction("ALL");setFilterTgl("");setSearch("");}}
            style={{height:28,padding:"0 10px",border:"1px solid #fecaca",background:"#fef2f2",color:"#dc2626",borderRadius:5,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
            Reset
          </button>
        )}
        <span style={{fontSize:11,color:"#94a3b8",marginLeft:"auto"}}>{filtered.length} aktivitas</span>
      </div>

      {/* Log list */}
      {filtered.length===0?(
        <div style={{textAlign:"center",padding:"40px",color:"#94a3b8",background:"#fff",borderRadius:7,border:"1px solid #eaecf0"}}>
          <div style={{fontSize:28,marginBottom:8}}>📋</div>
          <div style={{fontSize:13,fontWeight:600}}>Tidak ada aktivitas</div>
        </div>
      ):(
        <div style={{background:"#fff",border:"1px solid #eaecf0",borderRadius:7,overflow:"hidden"}}>
          {filtered.map((a:any,i:number)=>{
            const module=a.module||a.jenis||"general";
            const actionType=a.action_type||"update";
            const mc=MODULE_CONFIG[module]||MODULE_CONFIG.general;
            const ac=ACTION_CONFIG[actionType]||{label:actionType,color:"#64748b",bg:"#f8fafc"};
            const adminName=a.admin_nama||a.user_name||"—";
            const desc=a.description||a.aktivitas||a.action||"—";
            const woNo=a.wo_number||a.wo_no||"";
            return(
              <div key={a.id||i} style={{display:"flex",gap:10,alignItems:"center",padding:"8px 12px",borderBottom:i<filtered.length-1?"1px solid #f5f7fa":"none",transition:"background .1s"}}
                onMouseEnter={(e:any)=>e.currentTarget.style.background="#fafbfc"}
                onMouseLeave={(e:any)=>e.currentTarget.style.background="transparent"}>
                {/* Icon */}
                <div style={{width:30,height:30,borderRadius:7,background:mc.bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,flexShrink:0}}>
                  {mc.icon}
                </div>
                {/* Desc */}
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:12,fontWeight:600,color:"#1e293b",marginBottom:2,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{desc}</div>
                  <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap" as const}}>
                    <span style={{fontSize:10.5,color:"#475569",fontWeight:500}}>👤 {adminName}</span>
                    {woNo&&<span style={{fontSize:10,color:"#2563eb",fontWeight:700,fontFamily:"monospace",background:"#eff6ff",borderRadius:3,padding:"1px 5px"}}>WO {woNo}</span>}
                    <span style={{fontSize:10,color:"#94a3b8"}}>📍 {a.halaman||mc.label}</span>
                  </div>
                </div>
                {/* Badges */}
                <div style={{display:"flex",gap:4,alignItems:"center",flexShrink:0}}>
                  <span style={{background:mc.bg,color:mc.color,borderRadius:4,padding:"2px 7px",fontSize:10,fontWeight:600}}>{mc.label}</span>
                  <span style={{background:ac.bg,color:ac.color,borderRadius:4,padding:"2px 7px",fontSize:10,fontWeight:600}}>{ac.label}</span>
                </div>
                {/* Time */}
                <span style={{fontSize:10.5,color:"#94a3b8",flexShrink:0,minWidth:130,textAlign:"right" as const}}>{fmtTime(a.created_at)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
`;

if(startIdx === -1 || endIdx === -1){
  console.log('❌ ActivityLogView not found! start:', startIdx, 'end:', endIdx);
  process.exit(1);
}

content = content.slice(0, startIdx) + newFn + '\n' + content.slice(endIdx);
fs.writeFileSync('src/App.tsx', content, 'utf8');
console.log('✅ ActivityLogView updated!');