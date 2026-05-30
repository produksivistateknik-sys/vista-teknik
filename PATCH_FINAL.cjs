const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

// ═══ STEP 1: Inject/replace ERP CSS ═══
const histMarker = '.hist-cell:hover .hist-tooltip{opacity:1!important;visibility:visible!important}';
const erpCssStart = content.indexOf('\n.erp-');
const erpCss = `
.erp-tooltip-el{position:fixed;background:#1e293b;color:#fff;font-size:11px;font-weight:600;padding:6px 12px;border-radius:8px;white-space:nowrap;pointer-events:none;z-index:9999;display:none}`;

// Remove old ERP CSS if exists
if(erpCssStart !== -1) {
  const nextSection = content.indexOf('\n// ─', erpCssStart);
  if(nextSection !== -1) {
    content = content.slice(0, erpCssStart) + erpCss + content.slice(nextSection);
    console.log('✅ Step 1: ERP CSS diganti');
  }
} else {
  const idx = content.indexOf(histMarker);
  if(idx !== -1) {
    content = content.slice(0, idx + histMarker.length) + erpCss + content.slice(idx + histMarker.length);
    console.log('✅ Step 1: ERP CSS diinjeksi');
  } else {
    console.log('❌ histMarker tidak ditemukan');
    process.exit(1);
  }
}

// ═══ STEP 2: Tambah sidebarCollapsed state ═══
if(!content.includes('sidebarCollapsed')) {
  content = content.replace(
    'const [tab,setTab]=useState("dashboard");',
    'const [tab,setTab]=useState("dashboard");\n  const [sidebarCollapsed,setSidebarCollapsed]=useState(false);'
  );
  console.log('✅ Step 2: sidebarCollapsed ditambah');
} else {
  console.log('ℹ️  Step 2: sidebarCollapsed sudah ada');
}

// ═══ STEP 3: Replace App return ═══
const appIdx = content.indexOf('export default function App()');
const sub = content.slice(appIdx);

// Find cut position - setelah canRencana declaration
const cutMarkers = ['  const monitorTabs=[', '  const SIDEBAR_MENUS=['];
let cutPos = -1;
for(const m of cutMarkers) {
  const p = sub.indexOf(m);
  if(p !== -1) { cutPos = p; break; }
}

if(cutPos === -1) {
  console.log('❌ Cut marker tidak ditemukan!');
  process.exit(1);
}

const before = content.slice(0, appIdx + cutPos);

const newEnd = `  const SIDEBAR_MENUS=[
    {group:"MONITORING",items:[
      {id:"dashboard",label:"Dashboard",icon:"ti-layout-dashboard"},
      {id:"summary",label:"Summary Progress",icon:"ti-table"},
      {id:"detail",label:"Detail Progress",icon:"ti-zoom-in"},
    ]},
    {group:"PRODUKSI",items:[
      ...(canRaw?[{id:"raw",label:"Raw Schedule",icon:"ti-calendar-event"}]:[]),
      ...(canRencana?[{id:"rencana",label:"Rencana Harian",icon:"ti-clipboard-list"}]:[]),
      ...(canWO?[{id:"wo",label:"Manajemen WO",icon:"ti-file-text"}]:[]),
    ]},
    {group:"SYSTEM",items:[
      ...(["admin"].includes(user?.divisi)?[
        {id:"pekerja",label:"Master Pekerja",icon:"ti-users"},
        {id:"tracking",label:"Tracking Pekerja",icon:"ti-chart-bar"},
        {id:"activity",label:"Activity Log",icon:"ti-activity"},
        {id:"kendala",label:"Kendala",icon:"ti-message-report",badge:kendalaLog.length>0?kendalaLog.length:null},
        {id:"maintenance",label:"Maintenance",icon:"ti-tool"},
        {id:"masteruser",label:"System",icon:"ti-settings"},
      ]:[]),
    ]},
  ];

  const alerts=woData.filter(w=>woOverall(w)<100&&(isDelayed(w.target)||isUrgent(w.target))).length;
  const activeLabel=SIDEBAR_MENUS.flatMap(g=>g.items).find(i=>i.id===tab)?.label||"Dashboard";

  const showTooltip=(e:any,label:string)=>{
    if(!sidebarCollapsed)return;
    let tip=document.getElementById("erp-tip") as HTMLElement;
    if(!tip){tip=document.createElement("div");tip.id="erp-tip";tip.className="erp-tooltip-el";document.body.appendChild(tip);}
    const r=e.currentTarget.getBoundingClientRect();
    tip.textContent=label;tip.style.display="block";
    tip.style.top=(r.top+r.height/2-14)+"px";tip.style.left="72px";
  };
  const hideTooltip=()=>{
    const tip=document.getElementById("erp-tip");
    if(tip)(tip as HTMLElement).style.display="none";
  };

  return(
    <>
      <style>{GCss}</style>
      {isOp?(
        <div style={{display:"flex",flexDirection:"column",minHeight:"100vh",background:"#f1f5f9"}}>
          <div style={{background:"#fff",borderBottom:"1px solid #e2e8f0",padding:"0 16px",height:52,display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:100}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <div style={{width:28,height:28,background:"#1d4ed8",borderRadius:7,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:900,fontSize:14}}>V</div>
              <span style={{fontWeight:700,fontSize:14,color:"#1e293b"}}>Vista Teknik</span>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <span style={{background:cfg.bg,color:cfg.color,border:"1px solid "+cfg.color+"30",borderRadius:20,padding:"3px 12px",fontSize:11,fontWeight:700}}>{cfg.icon} {cfg.label}</span>
              <button onClick={()=>{setUser(null);setPage("landing");localStorage.removeItem("vista_admin_session");}} style={{background:"#f8fafc",border:"1px solid #e2e8f0",color:"#64748b",borderRadius:8,padding:"5px 12px",cursor:"pointer",fontSize:12,fontWeight:600}}>Keluar</button>
            </div>
          </div>
          <div style={{flex:1,overflowY:"auto"}}>
            <OperatorView woData={woData} setWoData={setWoData} user={user} renhar={renhar} setRenhar={setRenhar} pekerja={pekerja} createKendala={createKendala}/>
          </div>
          <div style={{position:"sticky",bottom:0,background:"#fff",borderTop:"1px solid #e2e8f0",display:"flex",height:52,zIndex:100}}>
            <button style={{flex:1,border:"none",background:"none",cursor:"pointer",fontFamily:"inherit",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:2,color:cfg.color}}>
              <span style={{fontSize:18}}>📋</span>
              <span style={{fontSize:9,fontWeight:700,letterSpacing:.3}}>Tugas Saya</span>
            </button>
          </div>
        </div>
      ):(
        <div style={{display:"flex",height:"100vh",overflow:"hidden",background:"#f1f5f9"}}>
          <div style={{width:sidebarCollapsed?56:240,minWidth:sidebarCollapsed?56:240,height:"100vh",background:"#fff",borderRight:"1px solid #e2e8f0",display:"flex",flexDirection:"column",transition:"width .25s ease,min-width .25s ease",overflow:"hidden",flexShrink:0}}>
            <div style={{height:60,display:"flex",alignItems:"center",padding:"0 14px",borderBottom:"1px solid #e2e8f0",gap:10,overflow:"hidden",flexShrink:0}}>
              <div style={{width:32,height:32,minWidth:32,background:"#1d4ed8",borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:900,fontSize:15,flexShrink:0}}>V</div>
              {!sidebarCollapsed&&<div style={{overflow:"hidden",whiteSpace:"nowrap"}}>
                <div style={{fontWeight:800,fontSize:13,color:"#0f172a",lineHeight:1.2}}>Vista Teknik</div>
                <div style={{fontSize:9,color:"#94a3b8",marginTop:2,lineHeight:1.3}}>Electrical Switchboard Manufacturing</div>
              </div>}
            </div>
            <div style={{flex:1,overflowY:"auto",overflowX:"hidden",paddingBottom:8}}>
              {SIDEBAR_MENUS.map(group=>(
                <div key={group.group}>
                  {!sidebarCollapsed&&<div style={{fontSize:9,fontWeight:700,color:"#94a3b8",textTransform:"uppercase" as const,letterSpacing:1,padding:"10px 16px 4px",whiteSpace:"nowrap" as const}}>{group.group}</div>}
                  {sidebarCollapsed&&<div style={{height:8}}/>}
                  {group.items.map((item:any)=>(
                    <div key={item.id}
                      onClick={()=>setTab(item.id)}
                      onMouseEnter={(e:any)=>showTooltip(e,item.label)}
                      onMouseLeave={hideTooltip}
                      style={{display:"flex",alignItems:"center",gap:10,padding:sidebarCollapsed?"10px 0":"8px 14px",justifyContent:sidebarCollapsed?"center":"flex-start",cursor:"pointer",color:tab===item.id?"#1d4ed8":"#64748b",background:tab===item.id?"#eff6ff":"transparent",borderLeft:tab===item.id?"3px solid #1d4ed8":"3px solid transparent",margin:"1px 0",transition:"all .15s",fontWeight:tab===item.id?700:500,fontSize:13,whiteSpace:"nowrap" as const,overflow:"hidden",position:"relative" as const}}>
                      <i className={"ti "+item.icon} style={{fontSize:18,flexShrink:0,minWidth:20,textAlign:"center" as const}}/>
                      {!sidebarCollapsed&&<span style={{overflow:"hidden",flex:1}}>{item.label}</span>}
                      {!sidebarCollapsed&&item.badge&&<span style={{background:"#fef2f2",color:"#dc2626",borderRadius:20,padding:"1px 7px",fontSize:10,fontWeight:700}}>{item.badge}</span>}
                    </div>
                  ))}
                </div>
              ))}
            </div>
            <div style={{padding:"10px 14px",borderTop:"1px solid #e2e8f0",display:"flex",alignItems:"center",gap:10,overflow:"hidden",flexShrink:0,justifyContent:sidebarCollapsed?"center":"flex-start"}}>
              <div style={{width:32,height:32,minWidth:32,borderRadius:"50%",background:"#eff6ff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:800,color:"#1d4ed8",flexShrink:0,border:"2px solid #bfdbfe"}}>
                {(user?.name||user?.nama||"A").slice(0,2).toUpperCase()}
              </div>
              {!sidebarCollapsed&&<>
                <div style={{flex:1,minWidth:0,overflow:"hidden"}}>
                  <div style={{fontWeight:700,fontSize:12,color:"#1e293b",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" as const}}>{user?.name||user?.nama}</div>
                  <div style={{fontSize:10,color:"#94a3b8"}}>{cfg?.label||"Admin"}</div>
                </div>
                <button onClick={()=>{setUser(null);setPage("landing");localStorage.removeItem("vista_admin_session");}} style={{background:"none",border:"none",cursor:"pointer",color:"#94a3b8",fontSize:18,flexShrink:0,padding:2,display:"flex",alignItems:"center"}} title="Keluar">
                  <i className="ti ti-logout"/>
                </button>
              </>}
            </div>
          </div>
          <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",minWidth:0}}>
            <div style={{height:56,background:"#fff",borderBottom:"1px solid #e2e8f0",display:"flex",alignItems:"center",padding:"0 24px",gap:12,flexShrink:0,boxShadow:"0 1px 3px #00000008"}}>
              <button onClick={()=>setSidebarCollapsed((p:boolean)=>!p)} style={{width:34,height:34,borderRadius:8,border:"1px solid #e2e8f0",background:"#f8fafc",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",color:"#64748b",flexShrink:0,transition:"all .15s"}}>
                <i className={"ti "+(sidebarCollapsed?"ti-layout-sidebar-left-expand":"ti-layout-sidebar-left-collapse")} style={{fontSize:18}}/>
              </button>
              <div style={{display:"flex",alignItems:"center",gap:6,flex:1}}>
                <span style={{fontSize:14,fontWeight:700,color:"#1e293b"}}>{activeLabel}</span>
                <span style={{color:"#cbd5e1",fontSize:12}}>/</span>
                <span style={{color:"#94a3b8",fontSize:12}}>Vista Teknik</span>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                {alerts>0&&<span style={{background:"#fef2f2",border:"1px solid #fecaca",color:"#dc2626",borderRadius:20,padding:"4px 14px",fontSize:11,fontWeight:700}}>🔔 {alerts} peringatan</span>}
                <span style={{background:cfg.bg,color:cfg.color,border:"1px solid "+cfg.color+"30",borderRadius:20,padding:"3px 12px",fontSize:11,fontWeight:700}}>{cfg.icon} {cfg.label}</span>
                <span style={{fontSize:12,color:"#475569",fontWeight:600}}>{user?.name||user?.nama}</span>
              </div>
            </div>
            <div style={{flex:1,overflowY:"auto",overflowX:"hidden",padding:24,background:"#f1f5f9"}}>
              {tab==="dashboard"&&<Dashboard woData={woData}/>}
              {tab==="summary"&&<SummaryProgress woData={woData}/>}
              {tab==="detail"&&<DetailProgress woData={woData}/>}
              {tab==="raw"&&<RawSchedule woData={woData} rawData={rawData} setRawData={setRawData} renhar={renhar} setRenhar={setRenhar} pekerja={pekerja} createRaw={createRaw} updateRaw={updateRaw} removeRaw={removeRaw} refetchRaw={refetchRaw} createRenhar={createRenhar} updateRenhar={updateRenhar} removeRenhar={removeRenhar} logActivity={logActivity} user={user}/>}
              {tab==="rencana"&&<RencanaHarian rawData={rawData} woData={woData} renhar={renhar} setRenhar={setRenhar} pekerja={pekerja} createRenhar={createRenhar} updateRenhar={updateRenhar} removeRenhar={removeRenhar} logActivity={logActivity} user={user}/>}
              {tab==="wo"&&<ManajemenWO woData={woData} setWoData={setWoData} createWO={createWO} updateWO={updateWO} removeWO={removeWO} logActivity={logActivity} user={user}/>}
              {tab==="pekerja"&&<MasterPekerja pekerja={pekerja} setPekerja={setPekerja} createPekerja={createPekerja} updatePekerja={updatePekerja} removePekerja={removePekerja} logActivity={logActivity} user={user}/>}
              {tab==="tracking"&&<TrackingPekerja pekerja={pekerja} renhar={renhar}/>}
              {tab==="maintenance"&&<MaintenanceTab user={user} logActivity={logActivity}/>}
              {tab==="kendala"&&<KendalaInbox kendalaLog={kendalaLog} removeKendala={removeKendala}/>}
              {tab==="activity"&&<ActivityLogView activityLog={activityLog} user={user}/>}
              {tab==="masteruser"&&<SystemTab user={user} logActivity={logActivity} activityLog={activityLog} pekerja={pekerja} setPekerja={setPekerja} createPekerja={createPekerja} updatePekerja={updatePekerja} removePekerja={removePekerja}/>}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
`;

content = before + newEnd;
fs.writeFileSync('src/App.tsx', content, 'utf8');

const v = fs.readFileSync('src/App.tsx', 'utf8');
console.log('\n=== VERIFIKASI ===');
console.log('SIDEBAR_MENUS:', v.includes('SIDEBAR_MENUS=['));
console.log('display:flex height:100vh:', v.includes('height:"100vh",overflow:"hidden"'));
console.log('sidebarCollapsed inline:', v.includes('sidebarCollapsed?56:240'));
console.log('monitorTabs LAMA:', v.includes('monitorTabs='));
console.log('tab bar lama:', v.includes('borderBottom:`2.5px solid'));
const ok = v.includes('SIDEBAR_MENUS=[') && v.includes('sidebarCollapsed?56:240') && !v.includes('monitorTabs=');
console.log(ok ? '\n✅ SIAP BUILD!' : '\n❌ ADA MASALAH!');
