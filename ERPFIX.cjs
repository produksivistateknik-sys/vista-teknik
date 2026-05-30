const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

// ═══════════════════════════════════════════════════
// STEP 1: INJECT ERP CSS (replace jika sudah ada)
// ═══════════════════════════════════════════════════
const histMarker = '.hist-cell:hover .hist-tooltip{opacity:1!important;visibility:visible!important}';
const erpCss = `
.erp-layout{display:flex;height:100vh;overflow:hidden;background:#f1f5f9}
.erp-sidebar{width:240px;min-width:240px;height:100vh;background:#fff;border-right:1px solid #e2e8f0;display:flex;flex-direction:column;transition:width .25s ease,min-width .25s ease;overflow:hidden;flex-shrink:0;position:relative;z-index:50}
.erp-sidebar.collapsed{width:56px;min-width:56px}
.erp-logo-area{height:60px;display:flex;align-items:center;padding:0 14px;border-bottom:1px solid #e2e8f0;gap:10px;overflow:hidden;flex-shrink:0}
.erp-logo-box{width:32px;height:32px;min-width:32px;background:#1d4ed8;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:900;font-size:15px;flex-shrink:0;letter-spacing:-1px}
.erp-logo-text{overflow:hidden;white-space:nowrap;opacity:1;transition:opacity .2s}
.erp-sidebar.collapsed .erp-logo-text{opacity:0;pointer-events:none}
.erp-nav-section{padding:8px 0}
.erp-nav-label{font-size:9px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;padding:10px 16px 4px;white-space:nowrap;overflow:hidden;opacity:1;transition:opacity .15s}
.erp-sidebar.collapsed .erp-nav-label{opacity:0}
.erp-nav-item{display:flex;align-items:center;gap:12px;padding:9px 14px;cursor:pointer;color:#64748b;font-size:13px;font-weight:500;border-left:3px solid transparent;margin:1px 8px;border-radius:8px;transition:all .15s;white-space:nowrap;overflow:hidden;position:relative}
.erp-nav-item:hover{background:#f8fafc;color:#1e293b}
.erp-nav-item.active{background:#eff6ff;color:#1d4ed8;font-weight:700;border-left-color:#1d4ed8}
.erp-nav-item i{font-size:18px;flex-shrink:0;min-width:20px;text-align:center}
.erp-nav-text{overflow:hidden;opacity:1;transition:opacity .15s .05s;white-space:nowrap;flex:1}
.erp-sidebar.collapsed .erp-nav-text{opacity:0;pointer-events:none}
.erp-nav-badge{background:#fef2f2;color:#dc2626;border-radius:20px;padding:1px 7px;font-size:10px;font-weight:700;flex-shrink:0;transition:opacity .15s}
.erp-sidebar.collapsed .erp-nav-badge{opacity:0}
.erp-user-area{margin-top:auto;padding:12px 14px;border-top:1px solid #e2e8f0;display:flex;align-items:center;gap:10px;overflow:hidden;flex-shrink:0}
.erp-user-info{overflow:hidden;white-space:nowrap;opacity:1;transition:opacity .2s;flex:1;min-width:0}
.erp-sidebar.collapsed .erp-user-info{opacity:0;pointer-events:none}
.erp-main{flex:1;display:flex;flex-direction:column;overflow:hidden;min-width:0}
.erp-topbar{height:56px;background:#fff;border-bottom:1px solid #e2e8f0;display:flex;align-items:center;padding:0 24px;gap:12px;flex-shrink:0;box-shadow:0 1px 3px #00000008}
.erp-toggle-btn{width:34px;height:34px;border-radius:8px;border:1px solid #e2e8f0;background:#f8fafc;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#64748b;transition:all .15s;flex-shrink:0}
.erp-toggle-btn:hover{background:#eff6ff;color:#1d4ed8;border-color:#bfdbfe}
.erp-body{flex:1;overflow-y:auto;overflow-x:hidden;padding:24px;background:#f1f5f9}
.erp-tooltip-el{position:fixed;background:#1e293b;color:#fff;font-size:11px;font-weight:600;padding:6px 12px;border-radius:8px;white-space:nowrap;pointer-events:none;z-index:9999;display:none;box-shadow:0 4px 12px #00000025}`;

// Hapus ERP CSS lama jika ada
const erpCssStart = content.indexOf('\n.erp-layout{');
const erpCssEnd = content.indexOf('\n.erp-tooltip-el{');
if(erpCssStart !== -1 && erpCssEnd !== -1) {
  const afterEnd = content.indexOf('}', erpCssEnd) + 1;
  content = content.slice(0, erpCssStart) + erpCss + content.slice(afterEnd);
  console.log('✅ Step 1: ERP CSS diupdate');
} else if(content.includes(histMarker)) {
  const idx = content.indexOf(histMarker);
  content = content.slice(0, idx + histMarker.length) + erpCss + content.slice(idx + histMarker.length);
  console.log('✅ Step 1: ERP CSS diinjeksi');
} else {
  console.log('❌ Step 1: marker tidak ditemukan!');
  process.exit(1);
}

// ═══════════════════════════════════════════════════
// STEP 2: Tambah sidebarCollapsed state jika belum ada
// ═══════════════════════════════════════════════════
if(!content.includes('sidebarCollapsed')) {
  const tabLine = 'const [tab,setTab]=useState("dashboard");';
  content = content.replace(tabLine, tabLine + '\n  const [sidebarCollapsed,setSidebarCollapsed]=useState(false);');
  console.log('✅ Step 2: sidebarCollapsed ditambah');
} else {
  console.log('ℹ️  Step 2: sidebarCollapsed sudah ada');
}

// ═══════════════════════════════════════════════════
// STEP 3: Replace seluruh App return dengan ERP layout
// ═══════════════════════════════════════════════════
const appStart = content.indexOf('export default function App()');
const sub = content.slice(appStart);

// Cari posisi tepat sebelum SIDEBAR_MENUS atau monitorTabs atau alerts=
let cutMarkers = ['  const SIDEBAR_MENUS=[', '  const monitorTabs=[', '  const alerts=woData'];
let cutPos = -1;
for(const m of cutMarkers) {
  const p = sub.indexOf(m);
  if(p !== -1) { cutPos = p; break; }
}

if(cutPos === -1) {
  console.log('❌ Step 3: marker potong tidak ditemukan!');
  process.exit(1);
}

const beforeCut = content.slice(0, appStart + cutPos);

const newAppEnd = `  const SIDEBAR_MENUS=[
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
    tip.textContent=label;
    tip.style.display="block";
    tip.style.top=(r.top+r.height/2-14)+"px";
    tip.style.left="72px";
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
          <div style={{background:"#fff",borderBottom:"1px solid #e2e8f0",padding:"0 16px",height:52,display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:100,boxShadow:"0 1px 3px #00000008"}}>
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
        <div className="erp-layout">
          {/* ── SIDEBAR ── */}
          <div className={"erp-sidebar"+(sidebarCollapsed?" collapsed":"")}>
            <div className="erp-logo-area">
              <div className="erp-logo-box">V</div>
              <div className="erp-logo-text">
                <div style={{fontWeight:800,fontSize:13,color:"#0f172a",lineHeight:1.2}}>Vista Teknik</div>
                <div style={{fontSize:9,color:"#94a3b8",marginTop:2,lineHeight:1.3,fontWeight:500}}>Electrical Switchboard Manufacturing</div>
              </div>
            </div>
            <div style={{flex:1,overflowY:"auto",overflowX:"hidden",paddingBottom:8}}>
              {SIDEBAR_MENUS.map(group=>(
                <div key={group.group} className="erp-nav-section">
                  <div className="erp-nav-label">{group.group}</div>
                  {group.items.map((item:any)=>(
                    <div key={item.id}
                      className={"erp-nav-item"+(tab===item.id?" active":"")}
                      onClick={()=>setTab(item.id)}
                      onMouseEnter={(e:any)=>showTooltip(e,item.label)}
                      onMouseLeave={hideTooltip}>
                      <i className={"ti "+item.icon}/>
                      <span className="erp-nav-text">{item.label}</span>
                      {item.badge&&<span className="erp-nav-badge">{item.badge}</span>}
                    </div>
                  ))}
                </div>
              ))}
            </div>
            <div className="erp-user-area">
              <div style={{width:32,height:32,minWidth:32,borderRadius:"50%",background:"#eff6ff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:800,color:"#1d4ed8",flexShrink:0,border:"2px solid #bfdbfe"}}>
                {(user?.name||user?.nama||"A").slice(0,2).toUpperCase()}
              </div>
              <div className="erp-user-info">
                <div style={{fontWeight:700,fontSize:12,color:"#1e293b",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{user?.name||user?.nama}</div>
                <div style={{fontSize:10,color:"#94a3b8",marginTop:1}}>{cfg?.label||"Admin"}</div>
              </div>
              <button onClick={()=>{setUser(null);setPage("landing");localStorage.removeItem("vista_admin_session");}} style={{background:"none",border:"none",cursor:"pointer",color:"#94a3b8",fontSize:18,flexShrink:0,padding:2,display:"flex",alignItems:"center"}} title="Keluar">
                <i className="ti ti-logout"/>
              </button>
            </div>
          </div>

          {/* ── MAIN ── */}
          <div className="erp-main">
            <div className="erp-topbar">
              <button className="erp-toggle-btn" onClick={()=>setSidebarCollapsed((p:boolean)=>!p)} title="Toggle sidebar">
                <i className={"ti "+(sidebarCollapsed?"ti-layout-sidebar-left-expand":"ti-layout-sidebar-left-collapse")} style={{fontSize:18}}/>
              </button>
              <div style={{display:"flex",alignItems:"center",gap:6,flex:1}}>
                <span style={{fontSize:14,fontWeight:700,color:"#1e293b"}}>{activeLabel}</span>
                <span style={{color:"#cbd5e1",fontSize:12}}>/</span>
                <span style={{color:"#94a3b8",fontSize:12}}>Vista Teknik</span>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                {alerts>0&&<span style={{background:"#fef2f2",border:"1px solid #fecaca",color:"#dc2626",borderRadius:20,padding:"4px 14px",fontSize:11,fontWeight:700}}>🔔 {alerts} peringatan</span>}
                <div style={{display:"flex",alignItems:"center",gap:8,padding:"6px 12px",background:"#f8fafc",borderRadius:10,border:"1px solid #e2e8f0"}}>
                  <div style={{width:26,height:26,borderRadius:"50%",background:"#eff6ff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:800,color:"#1d4ed8"}}>
                    {(user?.name||user?.nama||"A").slice(0,2).toUpperCase()}
                  </div>
                  <div>
                    <div style={{fontSize:12,fontWeight:700,color:"#1e293b",lineHeight:1.2}}>{user?.name||user?.nama}</div>
                    <div style={{fontSize:10,color:"#94a3b8"}}>{cfg?.label}</div>
                  </div>
                  <span style={{background:cfg.bg,color:cfg.color,border:"1px solid "+cfg.color+"30",borderRadius:20,padding:"2px 10px",fontSize:10,fontWeight:700,marginLeft:4}}>{cfg.icon} {cfg.label}</span>
                </div>
              </div>
            </div>
            <div className="erp-body">
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
}`;

content = beforeCut + newAppEnd;
fs.writeFileSync('src/App.tsx', content, 'utf8');

// ═══ VERIFIKASI ═══
const verify = fs.readFileSync('src/App.tsx', 'utf8');
console.log('\n=== VERIFIKASI ===');
console.log('erp-layout CSS:', verify.includes('erp-layout{'));
console.log('erp-sidebar CSS:', verify.includes('erp-sidebar{'));
console.log('erp-body CSS:', verify.includes('erp-body{'));
console.log('SIDEBAR_MENUS:', verify.includes('SIDEBAR_MENUS=['));
console.log('erp-layout render:', verify.includes('"erp-layout"'));
console.log('erp-body render:', verify.includes('"erp-body"'));
console.log('monitorTabs LAMA:', verify.includes('monitorTabs='));
console.log('Last 30:', JSON.stringify(verify.slice(-60)));

const appI = verify.indexOf('export default function App()');
const s = verify.slice(appI);
let ri = 0, rc = 0;
while((ri = s.indexOf('return(', ri)) !== -1){ rc++; ri++; }
console.log('Jumlah return(:', rc);

const ok = verify.includes('erp-layout{') && verify.includes('"erp-layout"') &&
           verify.includes('SIDEBAR_MENUS=[') && !verify.includes('monitorTabs=');
console.log(ok?'\n✅ SIAP BUILD!':'\n❌ ADA MASALAH!');
