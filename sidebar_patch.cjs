const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

// ═══ STEP 1: Inject CSS Sidebar + Topbar ═══
const histMarker = '.hist-cell:hover .hist-tooltip{opacity:1!important;visibility:visible!important}';

const newCss = `
.erp-wrap{display:flex;height:100vh;overflow:hidden;background:#f8fafc}
.erp-sb{width:220px;min-width:220px;height:100vh;background:#fff;border-right:1px solid #eaecf0;display:flex;flex-direction:column;transition:width .22s ease,min-width .22s ease;overflow:hidden;flex-shrink:0}
.erp-sb.col{width:52px;min-width:52px}
.erp-sb-head{height:54px;display:flex;align-items:center;padding:0 14px;border-bottom:1px solid #f0f2f5;gap:9px;overflow:hidden;flex-shrink:0}
.erp-logo{width:30px;height:30px;min-width:30px;background:#2563eb;border-radius:7px;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:900;font-size:14px;flex-shrink:0}
.erp-brand{overflow:hidden;white-space:nowrap;opacity:1;transition:opacity .18s;min-width:0}
.erp-sb.col .erp-brand{opacity:0;pointer-events:none}
.erp-brand-name{font-weight:700;font-size:12px;color:#0f172a;line-height:1.2}
.erp-brand-sub{font-size:8.5px;color:#94a3b8;margin-top:2px;line-height:1.3}
.erp-nav{flex:1;overflow-y:auto;overflow-x:hidden;padding:6px 0}
.erp-nav-grp{font-size:9px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.8px;padding:11px 14px 3px;white-space:nowrap;overflow:hidden;opacity:1;transition:opacity .15s}
.erp-sb.col .erp-nav-grp{opacity:0}
.erp-nav-item{display:flex;align-items:center;gap:9px;padding:6px 10px;margin:1px 6px;border-radius:6px;cursor:pointer;color:#64748b;font-size:12px;font-weight:400;white-space:nowrap;overflow:hidden;transition:all .13s;border:none;background:transparent;width:calc(100% - 12px);text-align:left;font-family:inherit}
.erp-nav-item:hover{background:#f5f6f8;color:#1e293b}
.erp-nav-item.active{background:#eff6ff;color:#2563eb;font-weight:600}
.erp-sb.col .erp-nav-item{padding:8px 0;margin:1px 0;border-radius:0;justify-content:center;width:100%}
.erp-nav-item i{font-size:16px;flex-shrink:0;width:17px;text-align:center;color:inherit}
.erp-nav-label{overflow:hidden;flex:1;opacity:1;transition:opacity .15s}
.erp-sb.col .erp-nav-label{opacity:0;width:0}
.erp-nav-badge{background:#fde8e8;color:#dc2626;border-radius:10px;padding:1px 6px;font-size:9px;font-weight:700;flex-shrink:0;transition:opacity .15s}
.erp-sb.col .erp-nav-badge{opacity:0}
.erp-sb-foot{padding:10px 12px;border-top:1px solid #f0f2f5;display:flex;align-items:center;gap:9px;overflow:hidden;flex-shrink:0}
.erp-sb.col .erp-sb-foot{justify-content:center;padding:10px 0}
.erp-foot-av{width:28px;height:28px;min-width:28px;border-radius:50%;background:#eff6ff;display:flex;align-items:center;justify-content:center;font-size:9.5px;font-weight:800;color:#2563eb;flex-shrink:0;border:1.5px solid #bfdbfe}
.erp-foot-info{flex:1;min-width:0;overflow:hidden;opacity:1;transition:opacity .18s}
.erp-sb.col .erp-foot-info{opacity:0;width:0;pointer-events:none}
.erp-foot-name{font-size:11px;font-weight:600;color:#1e293b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.erp-foot-role{font-size:9px;color:#94a3b8}
.erp-main{flex:1;display:flex;flex-direction:column;overflow:hidden;min-width:0}
.erp-topbar{height:46px;background:#fff;border-bottom:1px solid #eaecf0;display:flex;align-items:center;padding:0 18px;gap:10px;flex-shrink:0;box-shadow:0 1px 2px rgba(0,0,0,.04)}
.erp-toggle{width:30px;height:30px;border-radius:6px;border:1px solid #e2e8f0;background:#f8fafc;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#64748b;flex-shrink:0;transition:all .13s}
.erp-toggle:hover{background:#eff6ff;color:#2563eb;border-color:#bfdbfe}
.erp-search{flex:1;max-width:240px;height:30px;border:1px solid #e2e8f0;border-radius:6px;padding:0 10px 0 30px;font-size:12px;color:#1e293b;background:#f8fafc url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='13' height='13' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2'%3E%3Ccircle cx='11' cy='11' r='8'/%3E%3Cpath d='m21 21-4.35-4.35'/%3E%3C/svg%3E") no-repeat 9px center;outline:none;font-family:inherit}
.erp-search:focus{border-color:#2563eb;background:#fff}
.erp-topbar-right{display:flex;align-items:center;gap:7px;margin-left:auto}
.erp-bell{width:30px;height:30px;border:1px solid #e2e8f0;border-radius:6px;background:#f8fafc;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#64748b;position:relative;flex-shrink:0}
.erp-bell-dot{position:absolute;top:5px;right:5px;width:6px;height:6px;border-radius:50%;background:#dc2626;border:1.5px solid #fff}
.erp-body{flex:1;overflow-y:auto;overflow-x:hidden;padding:14px 16px;background:#f8fafc}
.erp-badge{border-radius:4px;padding:2px 7px;font-size:10px;font-weight:600;display:inline-block;white-space:nowrap}
.erp-b-orange{background:#fffbeb;color:#d97706}
.erp-tooltip-el{position:fixed;background:#1e293b;color:#fff;font-size:11px;font-weight:600;padding:5px 10px;border-radius:6px;white-space:nowrap;pointer-events:none;z-index:9999;display:none;box-shadow:0 4px 12px rgba(0,0,0,.2)}`;

// Remove old ERP CSS if exists
const oldStart = content.indexOf('\n.erp-wrap{');
const oldStart2 = content.indexOf('\n.erp-layout{');
const oldStart3 = content.indexOf('\n.erp-sidebar-wrap{');
const startIdx = Math.max(oldStart, oldStart2, oldStart3);

if(startIdx !== -1) {
  // Find next non-erp section
  let endIdx = content.indexOf('\n// ─', startIdx);
  if(endIdx === -1) endIdx = content.indexOf('\nfunction ', startIdx);
  if(endIdx !== -1) {
    content = content.slice(0, startIdx) + newCss + content.slice(endIdx);
    console.log('✅ Step 1: CSS replaced');
  }
} else {
  const idx = content.indexOf(histMarker);
  if(idx !== -1) {
    content = content.slice(0, idx + histMarker.length) + newCss + content.slice(idx + histMarker.length);
    console.log('✅ Step 1: CSS injected');
  } else {
    console.log('❌ histMarker not found');
    process.exit(1);
  }
}

// ═══ STEP 2: sidebarCollapsed state ═══
if(!content.includes('sidebarCollapsed')) {
  content = content.replace(
    'const [tab,setTab]=useState("dashboard");',
    'const [tab,setTab]=useState("dashboard");\n  const [sidebarCollapsed,setSidebarCollapsed]=useState(false);'
  );
  console.log('✅ Step 2: sidebarCollapsed added');
} else {
  console.log('ℹ️  Step 2: sidebarCollapsed exists');
}

// ═══ STEP 3: Replace App return ═══
const appIdx = content.indexOf('export default function App()');
const sub = content.slice(appIdx);
const cutMarkers = ['  const SIDEBAR_MENUS=[','  const monitorTabs=[','  const alerts=woData'];
let cutPos = -1;
for(const m of cutMarkers){const p=sub.indexOf(m);if(p!==-1){cutPos=p;break;}}
if(cutPos===-1){console.log('❌ cut marker not found');process.exit(1);}

const before = content.slice(0, appIdx + cutPos);

const newReturn = `  const SIDEBAR_MENUS=[
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
    tip.style.top=(r.top+r.height/2-14)+"px";tip.style.left="58px";
  };
  const hideTooltip=()=>{const tip=document.getElementById("erp-tip");if(tip)(tip as HTMLElement).style.display="none";};

  return(
    <>
      <style>{GCss}</style>
      {isOp?(
        <div style={{display:"flex",flexDirection:"column",minHeight:"100vh",background:"#f8fafc"}}>
          <div style={{background:"#fff",borderBottom:"1px solid #eaecf0",padding:"0 16px",height:46,display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:100}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <div className="erp-logo">V</div>
              <span style={{fontWeight:700,fontSize:13,color:"#0f172a"}}>Vista Teknik</span>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <span style={{background:cfg.bg,color:cfg.color,borderRadius:5,padding:"2px 10px",fontSize:10,fontWeight:600}}>{cfg.label}</span>
              <button onClick={()=>{setUser(null);setPage("landing");localStorage.removeItem("vista_admin_session");}} style={{background:"#f8fafc",border:"1px solid #e2e8f0",color:"#64748b",borderRadius:5,padding:"4px 10px",cursor:"pointer",fontSize:11,fontFamily:"inherit"}}>Keluar</button>
            </div>
          </div>
          <div style={{flex:1,overflowY:"auto"}}>
            <OperatorView woData={woData} setWoData={setWoData} user={user} renhar={renhar} setRenhar={setRenhar} pekerja={pekerja} createKendala={createKendala}/>
          </div>
        </div>
      ):(
        <div className="erp-wrap">
          <div className={"erp-sb"+(sidebarCollapsed?" col":"")}>
            <div className="erp-sb-head">
              <div className="erp-logo">V</div>
              <div className="erp-brand">
                <div className="erp-brand-name">Vista Teknik</div>
                <div className="erp-brand-sub">Electrical Switchboard Manufacturing</div>
              </div>
            </div>
            <div className="erp-nav">
              {SIDEBAR_MENUS.map(group=>(
                <div key={group.group}>
                  <div className="erp-nav-grp">{group.group}</div>
                  {group.items.map((item:any)=>(
                    <button key={item.id}
                      className={"erp-nav-item"+(tab===item.id?" active":"")}
                      onClick={()=>setTab(item.id)}
                      onMouseEnter={(e:any)=>showTooltip(e,item.label)}
                      onMouseLeave={hideTooltip}>
                      <i className={"ti "+item.icon} aria-hidden="true"/>
                      <span className="erp-nav-label">{item.label}</span>
                      {item.badge&&<span className="erp-nav-badge">{item.badge}</span>}
                    </button>
                  ))}
                </div>
              ))}
            </div>
            <div className="erp-sb-foot">
              <div className="erp-foot-av">{(user?.name||user?.nama||"A").slice(0,2).toUpperCase()}</div>
              <div className="erp-foot-info">
                <div className="erp-foot-name">{user?.name||user?.nama}</div>
                <div className="erp-foot-role">{cfg?.label||"Admin"}</div>
              </div>
              {!sidebarCollapsed&&<button onClick={()=>{setUser(null);setPage("landing");localStorage.removeItem("vista_admin_session");}} style={{background:"none",border:"none",cursor:"pointer",color:"#94a3b8",fontSize:16,flexShrink:0,padding:2,display:"flex",alignItems:"center"}} title="Keluar"><i className="ti ti-logout" aria-hidden="true"/></button>}
            </div>
          </div>
          <div className="erp-main">
            <div className="erp-topbar">
              <button className="erp-toggle" onClick={()=>setSidebarCollapsed((p:boolean)=>!p)}>
                <i className={"ti "+(sidebarCollapsed?"ti-layout-sidebar-left-expand":"ti-layout-sidebar-left-collapse")} style={{fontSize:17}} aria-hidden="true"/>
              </button>
              <input className="erp-search" placeholder="Cari work order, panel..."/>
              <div className="erp-topbar-right">
                <div className="erp-bell">
                  <i className="ti ti-bell" style={{fontSize:16}} aria-hidden="true"/>
                  {alerts>0&&<div className="erp-bell-dot"/>}
                </div>
                {alerts>0&&<span className="erp-badge erp-b-orange">{alerts} mendesak</span>}
                <span style={{background:"#f1f5f9",color:"#475569",borderRadius:5,padding:"2px 9px",fontSize:10,fontWeight:600}}>{cfg?.icon} {cfg?.label}</span>
                <div className="erp-foot-av">{(user?.name||user?.nama||"A").slice(0,2).toUpperCase()}</div>
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

content = before + newReturn;
fs.writeFileSync('src/App.tsx', content, 'utf8');

const v = fs.readFileSync('src/App.tsx', 'utf8');
console.log('\n=== VERIFIKASI ===');
console.log('erp-wrap CSS:', v.includes('erp-wrap{'));
console.log('erp-sb render:', v.includes('"erp-sb"'));
console.log('erp-body render:', v.includes('"erp-body"'));
console.log('erp-search:', v.includes('"erp-search"'));
console.log('SIDEBAR_MENUS:', v.includes('SIDEBAR_MENUS=['));
console.log('monitorTabs LAMA:', v.includes('monitorTabs='));
const ok = v.includes('erp-wrap{') && v.includes('"erp-sb"') && !v.includes('monitorTabs=');
console.log(ok?'\n✅ SIAP BUILD!':'\n❌ ADA MASALAH!');