const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

// ═══════════════════════════════════════════════════
// STEP 1: Tambah ERP CSS ke GCss
// ═══════════════════════════════════════════════════
const erpCss = `
.erp-wrap{display:flex;min-height:100vh}
.erp-sidebar{width:220px;min-width:220px;background:#fff;border-right:1px solid #e2e8f0;display:flex;flex-direction:column;height:100vh;position:sticky;top:0;transition:width .25s cubic-bezier(.4,0,.2,1),min-width .25s cubic-bezier(.4,0,.2,1);overflow:hidden;flex-shrink:0;z-index:200}
.erp-sidebar.collapsed{width:52px;min-width:52px}
.erp-logo-area{height:56px;display:flex;align-items:center;padding:0 12px;border-bottom:1px solid #e2e8f0;gap:10px;overflow:hidden;flex-shrink:0}
.erp-logo-box{width:30px;height:30px;min-width:30px;background:#1d4ed8;border-radius:7px;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:14px;flex-shrink:0}
.erp-logo-text{overflow:hidden;white-space:nowrap;transition:opacity .2s;min-width:0}
.erp-sidebar.collapsed .erp-logo-text{opacity:0;width:0}
.erp-nav-group-label{font-size:9px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.8px;padding:12px 14px 4px;white-space:nowrap;overflow:hidden;transition:opacity .15s}
.erp-sidebar.collapsed .erp-nav-group-label{opacity:0}
.erp-nav-item{display:flex;align-items:center;gap:10px;padding:8px 12px;cursor:pointer;color:#64748b;font-size:12px;font-weight:500;border-left:2px solid transparent;transition:all .15s;white-space:nowrap;overflow:hidden}
.erp-nav-item:hover{background:#f8fafc;color:#1e293b}
.erp-nav-item.active{background:#eff6ff;color:#1d4ed8;border-left-color:#1d4ed8;font-weight:600}
.erp-nav-item i{font-size:17px;flex-shrink:0;min-width:17px}
.erp-nav-text{overflow:hidden;transition:opacity .15s .05s;white-space:nowrap;flex:1}
.erp-sidebar.collapsed .erp-nav-text{opacity:0;width:0}
.erp-nav-badge{background:#fef2f2;color:#dc2626;border-radius:10px;padding:1px 6px;font-size:10px;font-weight:700;flex-shrink:0}
.erp-sidebar.collapsed .erp-nav-badge{opacity:0;overflow:hidden}
.erp-user-area{margin-top:auto;padding:10px 12px;border-top:1px solid #e2e8f0;display:flex;align-items:center;gap:10px;overflow:hidden;flex-shrink:0}
.erp-user-info{overflow:hidden;white-space:nowrap;transition:opacity .2s;flex:1;min-width:0}
.erp-sidebar.collapsed .erp-user-info{opacity:0;width:0}
.erp-main{flex:1;min-width:0;display:flex;flex-direction:column;overflow:hidden}
.erp-topbar{height:52px;background:#fff;border-bottom:1px solid #e2e8f0;display:flex;align-items:center;padding:0 20px;gap:12px;position:sticky;top:0;z-index:100;flex-shrink:0}
.erp-toggle-btn{width:32px;height:32px;border-radius:8px;border:1px solid #e2e8f0;background:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#64748b;transition:all .15s;flex-shrink:0}
.erp-toggle-btn:hover{background:#f1f5f9;color:#1e293b}
.erp-content{padding:20px;flex:1;overflow-y:auto;max-width:1440px;width:100%;margin:0 auto}
.erp-tooltip-el{position:fixed;background:#1e293b;color:#fff;font-size:11px;font-weight:600;padding:5px 10px;border-radius:7px;white-space:nowrap;pointer-events:none;z-index:9999;display:none}
.erp-tooltip-el::before{content:'';position:absolute;right:100%;top:50%;transform:translateY(-50%);border:5px solid transparent;border-right-color:#1e293b}`;

const marker = '.hist-cell:hover .hist-tooltip{opacity:1!important;visibility:visible!important}';
const markerIdx = content.indexOf(marker);
if (markerIdx === -1) { console.log('❌ CSS marker tidak ditemukan!'); process.exit(1); }
content = content.slice(0, markerIdx + marker.length) + erpCss + content.slice(markerIdx + marker.length);
console.log('✅ Step 1: ERP CSS ditambahkan');

// ═══════════════════════════════════════════════════
// STEP 2: Tambah useState sidebarCollapsed setelah tab state
// ═══════════════════════════════════════════════════
const tabState = 'const [tab,setTab]=useState("dashboard");';
if (!content.includes('sidebarCollapsed')) {
  content = content.replace(tabState, tabState + '\n  const [sidebarCollapsed,setSidebarCollapsed]=useState(false);');
  console.log('✅ Step 2: useState sidebarCollapsed ditambahkan');
} else {
  console.log('ℹ️ Step 2: sidebarCollapsed sudah ada');
}

// ═══════════════════════════════════════════════════
// STEP 3: Replace seluruh layout lama dengan ERP layout
// ═══════════════════════════════════════════════════
const startMarker = 'const monitorTabs=[';
const endMarker = `    </div>
  );
}`;

const startIdx = content.indexOf(startMarker);
if (startIdx === -1) { console.log('❌ monitorTabs tidak ditemukan!'); process.exit(1); }

// Cari closing } terakhir file
const lastBrace = content.lastIndexOf('\n}');
const before = content.slice(0, startIdx);

const newLayout = `const SIDEBAR_MENUS=[
    {group:"Monitoring",items:[
      {id:"dashboard",label:"Dashboard",icon:"ti-layout-dashboard"},
      {id:"summary",label:"Summary Progress",icon:"ti-table"},
      {id:"detail",label:"Detail Progress",icon:"ti-zoom-in"},
    ]},
    {group:"Produksi",items:[
      ...(canRaw?[{id:"raw",label:"Raw Schedule",icon:"ti-calendar-event"}]:[]),
      ...(canRencana?[{id:"rencana",label:"Rencana Harian",icon:"ti-clipboard-list"}]:[]),
      ...(canWO?[{id:"wo",label:"Manajemen WO",icon:"ti-file-text"}]:[]),
    ]},
    {group:"System",items:[
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
    tip.style.top=(r.top+r.height/2)+"px";tip.style.left="60px";tip.style.transform="translateY(-50%)";
  };
  const hideTooltip=()=>{const tip=document.getElementById("erp-tip");if(tip)(tip as HTMLElement).style.display="none";};

  return(
    <div style={{minHeight:"100vh",background:"#f1f5f9"}}>
      <style>{GCss}</style>
      {isOp?(
        <div style={{display:"flex",flexDirection:"column",minHeight:"100vh"}}>
          <div style={{background:"#fff",borderBottom:"1px solid #e2e8f0",padding:"0 16px",height:52,display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:100}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <div style={{width:28,height:28,background:"#1d4ed8",borderRadius:7,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:800,fontSize:13}}>V</div>
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
        <div className="erp-wrap">
          <div className={"erp-sidebar"+(sidebarCollapsed?" collapsed":"")}>
            <div className="erp-logo-area">
              <div className="erp-logo-box">V</div>
              <div className="erp-logo-text">
                <div style={{fontWeight:800,fontSize:13,color:"#1e293b",lineHeight:1.2}}>Vista Teknik</div>
                <div style={{fontSize:9,color:"#94a3b8",marginTop:2,lineHeight:1.3}}>Electrical Switchboard Manufacturing</div>
              </div>
            </div>
            <div style={{flex:1,overflowY:"auto",overflowX:"hidden"}}>
              {SIDEBAR_MENUS.map(group=>(
                <div key={group.group}>
                  <div className="erp-nav-group-label">{group.group}</div>
                  {group.items.map((item:any)=>(
                    <div key={item.id}
                      className={"erp-nav-item"+(tab===item.id?" active":"")}
                      onClick={()=>setTab(item.id)}
                      onMouseEnter={(e)=>showTooltip(e,item.label)}
                      onMouseLeave={hideTooltip}>
                      <i className={"ti "+item.icon} aria-hidden="true"/>
                      <span className="erp-nav-text">{item.label}</span>
                      {item.badge&&<span className="erp-nav-badge">{item.badge}</span>}
                    </div>
                  ))}
                </div>
              ))}
            </div>
            <div className="erp-user-area">
              <div style={{width:28,height:28,minWidth:28,borderRadius:"50%",background:"#eff6ff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:800,color:"#1d4ed8",flexShrink:0}}>
                {(user?.name||user?.nama||"A").slice(0,2).toUpperCase()}
              </div>
              <div className="erp-user-info">
                <div style={{fontWeight:700,fontSize:12,color:"#1e293b",overflow:"hidden",textOverflow:"ellipsis"}}>{user?.name||user?.nama}</div>
                <div style={{fontSize:10,color:"#94a3b8"}}>{cfg?.label||"Admin"}</div>
              </div>
              <button onClick={()=>{setUser(null);setPage("landing");localStorage.removeItem("vista_admin_session");}} style={{background:"none",border:"none",cursor:"pointer",color:"#94a3b8",fontSize:16,flexShrink:0,padding:2}} title="Keluar">
                <i className="ti ti-logout" aria-hidden="true"/>
              </button>
            </div>
          </div>
          <div className="erp-main">
            <div className="erp-topbar">
              <button className="erp-toggle-btn" onClick={()=>setSidebarCollapsed((p:boolean)=>!p)} title="Toggle sidebar">
                <i className={"ti "+(sidebarCollapsed?"ti-layout-sidebar-left-expand":"ti-layout-sidebar-left-collapse")} style={{fontSize:18}} aria-hidden="true"/>
              </button>
              <div style={{display:"flex",alignItems:"center",gap:6}}>
                <span style={{fontSize:13,fontWeight:700,color:"#1e293b"}}>{activeLabel}</span>
                <span style={{color:"#94a3b8",fontSize:12}}> / Vista Teknik</span>
              </div>
              <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:10}}>
                {alerts>0&&<span style={{background:"#fef2f2",border:"1px solid #fecaca",color:"#dc2626",borderRadius:20,padding:"3px 12px",fontSize:11,fontWeight:700}}>🔔 {alerts} peringatan</span>}
                <span style={{fontSize:12,color:"#475569",fontWeight:500}}>{user?.name||user?.nama}</span>
                <span style={{background:cfg.bg,color:cfg.color,border:"1px solid "+cfg.color+"30",borderRadius:20,padding:"3px 12px",fontSize:11,fontWeight:700}}>{cfg.icon} {cfg.label}</span>
              </div>
            </div>
            <div className="erp-content">
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
    </div>
  );
}`;

content = before + newLayout;
fs.writeFileSync('src/App.tsx', content, 'utf8');
console.log('✅ Step 3: ERP layout replaced!');
console.log('Total chars:', content.length);
console.log('erp-wrap:', content.includes('erp-wrap'));
console.log('erp-sidebar CSS:', content.includes('erp-sidebar{'));
console.log('SIDEBAR_MENUS:', content.includes('SIDEBAR_MENUS'));
console.log('monitorTabs lama:', content.includes('monitorTabs='));
console.log('Last 30 chars:', JSON.stringify(content.slice(-30)));
