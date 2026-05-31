const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

const appIdx = content.indexOf('export default function App()');
const sub = content.slice(appIdx);
const retPos = sub.indexOf('\n  return(');
const insertAt = appIdx + retPos;

const newBlock = `
  const SIDEBAR_MENUS=[
    {group:"MONITORING",items:[
      {id:"dashboard",label:"Dashboard",icon:"📊"},
      {id:"summary",label:"Summary Progress",icon:"📋"},
      {id:"detail",label:"Detail Progress",icon:"🔍"},
    ]},
    {group:"PRODUKSI",items:[
      ...(canRaw?[{id:"raw",label:"Raw Schedule",icon:"📅"}]:[]),
      ...(canRencana?[{id:"rencana",label:"Rencana Harian",icon:"📋"}]:[]),
      ...(canWO?[{id:"wo",label:"Manajemen WO",icon:"📝"}]:[]),
    ]},
    {group:"SYSTEM",items:[
      ...(["admin"].includes(user?.divisi)?[
        {id:"pekerja",label:"Master Pekerja",icon:"👥"},
        {id:"tracking",label:"Tracking Pekerja",icon:"📈"},
        {id:"activity",label:"Activity Log",icon:"📊"},
        {id:"kendala",label:"Kendala",icon:"📝",badge:kendalaLog.length>0?kendalaLog.length:null},
        {id:"maintenance",label:"Maintenance",icon:"🔧"},
        {id:"masteruser",label:"System",icon:"⚙️"},
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
    tip.style.top=(r.top+r.height/2)+"px";tip.style.left="58px";
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
                      <span style={{fontSize:14,flexShrink:0,width:18,textAlign:"center" as const}}>{item.icon}</span>
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
              {!sidebarCollapsed&&<button onClick={()=>{setUser(null);setPage("landing");localStorage.removeItem("vista_admin_session");}} style={{background:"none",border:"none",cursor:"pointer",color:"#94a3b8",fontSize:16,flexShrink:0,padding:2}} title="Keluar">✕</button>}
            </div>
          </div>
          <div className="erp-main">
            <div className="erp-topbar">
              <button className="erp-toggle" onClick={()=>setSidebarCollapsed((p:boolean)=>!p)}>
                {sidebarCollapsed?"▶":"◀"}
              </button>
              <input className="erp-search" placeholder="Cari work order, panel..."/>
              <div className="erp-topbar-right">
                <div className="erp-bell">
                  🔔
                  {alerts>0&&<div className="erp-bell-dot"/>}
                </div>
                {alerts>0&&<span style={{background:"#fffbeb",color:"#d97706",borderRadius:5,padding:"2px 9px",fontSize:10,fontWeight:600}}>{alerts} mendesak</span>}
                <span style={{background:"#f1f5f9",color:"#475569",borderRadius:5,padding:"2px 9px",fontSize:10,fontWeight:600}}>{cfg?.label||"Admin"}</span>
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

// Hapus return lama, ganti dengan yang baru
content = content.slice(0, insertAt) + newBlock;
fs.writeFileSync('src/App.tsx', content, 'utf8');

const v = fs.readFileSync('src/App.tsx', 'utf8');
const sidebarCount = (v.match(/const SIDEBAR_MENUS/g)||[]).length;
const hasReturn = v.includes('erp-wrap');
console.log('SIDEBAR_MENUS count:', sidebarCount);
console.log('erp-wrap:', hasReturn);
console.log(sidebarCount===1&&hasReturn?'✅ SIAP BUILD!':'❌ ADA MASALAH!');