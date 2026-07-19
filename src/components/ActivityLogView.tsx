import { useState } from 'react'
import { getLocalDateStr } from '../lib/dateHelpers'

export function ActivityLogView({activityLog}){
  const [filterAdmin,setFilterAdmin]=useState("ALL");
  const [filterModule,setFilterModule]=useState("ALL");
  const [filterAction,setFilterAction]=useState("ALL");
  const [filterTgl,setFilterTgl]=useState("");
  const [search,setSearch]=useState("");

  const MODULE_CONFIG={
    auth:    {label:"Auth",        color:"#5F5E5A",bg:"#f1f5f9",icon:"🔐"},
    wo:      {label:"Work Order",  color:"#0c447c",bg:"#e6f1fb",icon:"📋"},
    raw:     {label:"Raw Schedule",color:"#633806",bg:"#FAEEDA",icon:"📅"},
    rencana: {label:"Rencana",     color:"#27500A",bg:"#eaf3de",icon:"📊"},
    progress:{label:"Progress",    color:"#3C3489",bg:"#EEEDFE",icon:"📈"},
    kendala: {label:"Kendala",     color:"#791F1F",bg:"#FCEBEB",icon:"⚠️"},
    pekerja: {label:"Pekerja",     color:"#085041",bg:"#E1F5EE",icon:"👥"},
    general: {label:"General",     color:"#5F5E5A",bg:"#f1f5f9",icon:"⚙️"},
    maintenance:{label:"Maintenance",color:"#27500A",bg:"#eaf3de",icon:"🔧"},
  };
  const ACTION_CONFIG={
    create:    {label:"Buat",      color:"#27500A",bg:"#eaf3de"},
    update:    {label:"Edit",      color:"#0c447c",bg:"#e6f1fb"},
    delete:    {label:"Hapus",     color:"#791F1F",bg:"#FCEBEB"},
    login:     {label:"Login",     color:"#3C3489",bg:"#EEEDFE"},
    logout:    {label:"Logout",    color:"#5F5E5A",bg:"#f1f5f9"},
    distribute:{label:"Distribusi",color:"#085041",bg:"#E1F5EE"},
  };
  const todayStr=getLocalDateStr();
  const adminList=[...new Set(activityLog.map(a=>a.admin_nama||a.user_name).filter(Boolean))];
  const moduleList=[...new Set(activityLog.map(a=>a.module||a.jenis).filter(Boolean))];
  const actionList=[...new Set(activityLog.map(a=>a.action_type).filter(Boolean))];
  const filtered=activityLog.filter(a=>{
    const adminName=a.admin_nama||a.user_name||"";
    const modKey=a.module||a.jenis||"";
    const actionType=a.action_type||"";
    const desc=a.description||a.aktivitas||a.action||"";
    const woNo=a.wo_number||a.wo_no||"";
    if(filterAdmin!=="ALL"&&adminName!==filterAdmin)return false;
    if(filterModule!=="ALL"&&modKey!==filterModule)return false;
    if(filterAction!=="ALL"&&actionType!==filterAction)return false;
    if(filterTgl&&!a.created_at?.startsWith(filterTgl))return false;
    if(search){const q=search.toLowerCase();if(!desc.toLowerCase().includes(q)&&!adminName.toLowerCase().includes(q)&&!woNo.toLowerCase().includes(q))return false;}
    return true;
  });
  const fmtDateTime=(ts)=>{
    if(!ts)return"—";
    const d=new Date(ts);
    return d.toLocaleDateString("id-ID",{day:"numeric",month:"short",year:"numeric"})+" · "+d.toLocaleTimeString("id-ID",{hour:"2-digit",minute:"2-digit"})+" WIB";
  };
  const stats=[
    {l:"Total Log",v:activityLog.length,c:"#185FA5"},
    {l:"Hari Ini",v:activityLog.filter(a=>a.created_at?.startsWith(todayStr)).length,c:"#3B6D11"},
    {l:"Admin Aktif",v:new Set(activityLog.map(a=>a.admin_nama||a.user_name).filter(Boolean)).size,c:"#BA7517"},
    {l:"WO Terlibat",v:new Set(activityLog.map(a=>a.wo_number||a.wo_no).filter(Boolean)).size,c:"#534AB7"},
  ];
  const isReset=filterAdmin!=="ALL"||filterModule!=="ALL"||filterAction!=="ALL"||filterTgl||search;
  const selSt={height:26,padding:"0 8px",border:"0.5px solid #d1d5db",borderRadius:5,fontSize:11,background:"#fff",color:"#374151",outline:"none",cursor:"pointer",fontFamily:"inherit"};
  const thS={background:"var(--bg-secondary,#f8f9fb)",color:"var(--text-muted,#6b7280)",fontWeight:600,padding:"7px 12px",textAlign:"left",fontSize:9.5,textTransform:"uppercase",letterSpacing:.5,borderBottom:"0.5px solid #e5e8ed",whiteSpace:"nowrap"};
  return(
    <div className="fi">
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:12}}>
        {stats.map((s,i)=>(
          <div key={i} style={{background:"var(--card-bg,#fff)",border:"0.5px solid var(--border-color,#e5e8ed)",borderRadius:8,padding:"10px 12px",borderLeft:"3px solid "+s.c}}>
            <div style={{fontSize:20,fontWeight:500,color:s.c,lineHeight:1}}>{s.v}</div>
            <div style={{fontSize:9.5,color:"#9ca3af",marginTop:3,fontWeight:600,textTransform:"uppercase",letterSpacing:.4}}>{s.l}</div>
          </div>
        ))}
      </div>
      <div style={{background:"var(--card-bg,#fff)",border:"0.5px solid var(--border-color,#e5e8ed)",borderRadius:8,marginBottom:10,overflow:"hidden"}}>
        <div style={{padding:"8px 12px",borderBottom:"0.5px solid #e5e8ed",display:"flex",gap:6,flexWrap:"wrap",alignItems:"center",background:"#f8f9fb"}}>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Cari aktivitas, admin, WO..."
            style={{height:26,padding:"0 10px 0 26px",border:"0.5px solid #d1d5db",borderRadius:5,fontSize:11,background:"#fff",color:"#1a1d23",outline:"none",width:200,fontFamily:"inherit",backgroundImage:"url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='11' height='11' viewBox='0 0 24 24' fill='none' stroke='%23a0aec0' stroke-width='2'%3E%3Ccircle cx='11' cy='11' r='8'/%3E%3Cpath d='m21 21-4.35-4.35'/%3E%3C/svg%3E\")",backgroundRepeat:"no-repeat",backgroundPosition:"7px center"}}/>
          <select value={filterAdmin} onChange={e=>setFilterAdmin(e.target.value)} style={selSt}>
            <option value="ALL">Semua Admin</option>
            {adminList.map(a=><option key={a} value={a}>{a}</option>)}
          </select>
          <select value={filterModule} onChange={e=>setFilterModule(e.target.value)} style={selSt}>
            <option value="ALL">Semua Module</option>
            {moduleList.map(m=><option key={m} value={m}>{MODULE_CONFIG[m]?.label||m}</option>)}
          </select>
          <select value={filterAction} onChange={e=>setFilterAction(e.target.value)} style={selSt}>
            <option value="ALL">Semua Action</option>
            {actionList.map(a=><option key={a} value={a}>{ACTION_CONFIG[a]?.label||a}</option>)}
          </select>
          <input type="date" value={filterTgl} onChange={e=>setFilterTgl(e.target.value)} style={selSt}/>
          {isReset&&(
            <button onClick={()=>{setFilterAdmin("ALL");setFilterModule("ALL");setFilterAction("ALL");setFilterTgl("");setSearch("");}}
              style={{height:26,padding:"0 10px",border:"0.5px solid #fecaca",background:"#fef2f2",color:"#dc2626",borderRadius:5,fontSize:11,fontWeight:500,cursor:"pointer",fontFamily:"inherit"}}>Reset</button>
          )}
          <span style={{fontSize:11,color:"#9ca3af",marginLeft:"auto"}}>{filtered.length} aktivitas</span>
        </div>
        <table style={{width:"100%",borderCollapse:"collapse"}}>
          <thead>
            <tr>
              <th style={{...thS,width:36}}></th>
              <th style={thS}>Deskripsi</th>
              <th style={{...thS,width:100}}>Module</th>
              <th style={{...thS,width:80}}>Action</th>
              <th style={{...thS,width:140,textAlign:"right"}}>Waktu</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length===0?(
              <tr><td colSpan={5} style={{textAlign:"center",padding:"32px",color:"#9ca3af"}}>
                <div style={{fontSize:13,fontWeight:500}}>Tidak ada aktivitas</div>
              </td></tr>
            ):(
              filtered.map((a,i)=>{
                const modKey=a.module||a.jenis||"general";
                const actionType=a.action_type||"update";
                const mc=MODULE_CONFIG[modKey]||MODULE_CONFIG.general;
                const ac=ACTION_CONFIG[actionType]||{label:actionType,color:"#5F5E5A",bg:"#f1f5f9"};
                const adminName=a.admin_nama||a.user_name||"—";
                const desc=a.description||a.aktivitas||a.action||"—";
                const woNo=a.wo_number||a.wo_no||"";
                const panelNo=a.panel||"";
                const proyekNo=a.proyek||"";
                return(
                  <tr key={a.id||i} style={{borderBottom:i<filtered.length-1?"0.5px solid var(--border-light,#f0f2f5)":"none",cursor:"default"}}
                    onMouseEnter={e=>e.currentTarget.style.background="var(--bg-secondary,#f8f9fb)"}
                    onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                    <td style={{padding:"8px 12px",verticalAlign:"middle"}}>
                      <div style={{width:30,height:30,borderRadius:6,background:mc.bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,flexShrink:0}}>{mc.icon}</div>
                    </td>
                    <td style={{padding:"8px 12px",verticalAlign:"middle"}}>
                      <div style={{fontSize:12,fontWeight:500,color:"var(--text-primary,#1a1d23)",marginBottom:3}}>{desc}</div>
                      <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                        <span style={{fontSize:10.5,color:"#6b7280"}}>{adminName}</span>
                        {woNo&&<span style={{fontSize:10,color:"#0c447c",fontWeight:500,background:"#e6f1fb",borderRadius:3,padding:"1px 5px",fontFamily:"monospace"}}>WO-{woNo}</span>}
                        {proyekNo&&<span style={{fontSize:10,color:"#6b7280",background:"#f1f5f9",borderRadius:3,padding:"1px 5px"}}>{proyekNo}</span>}
                        {panelNo&&<span style={{fontSize:10,color:"#6b7280",background:"#f1f5f9",borderRadius:3,padding:"1px 5px"}}>{panelNo}</span>}
                        <span style={{fontSize:10,color:"#9ca3af"}}>{a.halaman||mc.label}</span>
                      </div>
                    </td>
                    <td style={{padding:"8px 12px",verticalAlign:"middle"}}>
                      <span style={{background:mc.bg,color:mc.color,borderRadius:4,padding:"2px 7px",fontSize:10,fontWeight:500}}>{mc.label}</span>
                    </td>
                    <td style={{padding:"8px 12px",verticalAlign:"middle"}}>
                      <span style={{background:ac.bg,color:ac.color,borderRadius:4,padding:"2px 7px",fontSize:10,fontWeight:500}}>{ac.label}</span>
                    </td>
                    <td style={{padding:"8px 12px",verticalAlign:"middle",fontSize:10.5,color:"#9ca3af",textAlign:"right",whiteSpace:"nowrap"}}>{fmtDateTime(a.created_at)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
