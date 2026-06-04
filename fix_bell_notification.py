from pathlib import Path

APP_PATH = Path(r"C:\Users\User\vista-teknik\src\App.tsx")
content = APP_PATH.read_text(encoding="utf-8")

# ── 1. Tambah state showNotif setelah alerts ──
old_alerts = "  const alerts=woData.filter(w=>woOverall(w)<100&&(isDelayed(w.target)||isUrgent(w.target))).length;"
new_alerts = """  const alerts=woData.filter(w=>woOverall(w)<100&&(isDelayed(w.target)||isUrgent(w.target))).length;
  const [showNotif,setShowNotif]=useState(false);

  // Data notifikasi lengkap
  const notifItems=woData.filter(w=>woOverall(w)<100&&(isDelayed(w.target)||isUrgent(w.target)))
    .map(w=>({
      id:w.id,
      wo:w.wo,
      proyek:w.proyek,
      target:w.target,
      pct:woOverall(w),
      isDelayed:isDelayed(w.target),
      isUrgent:isUrgent(w.target),
      daysLeft:daysUntil(w.target),
    }))
    .sort((a,b)=>a.daysLeft-b.daysLeft);

  // Kendala belum selesai
  const kendalaNotif=kendalaLog.filter((k:any)=>k.status!=="selesai").slice(0,5);"""

if old_alerts in content:
    content = content.replace(old_alerts, new_alerts)
    print("✅ notifItems state added")
else:
    print("❌ alerts line not found")

# ── 2. Replace bell icon dengan versi interaktif ──
old_bell = """                <div className="erp-bell">
                  🔔
                  {alerts>0&&<div className="erp-bell-dot"/>}
                </div>
                {alerts>0&&<span style={{background:"#fffbeb",color:"#d97706",borderRadius:5,padding:"2px 9px",fontSize:10,fontWeight:600}}>{alerts} mendesak</span>}"""

new_bell = """                <div style={{position:"relative"}}>
                  <div className="erp-bell" onClick={()=>setShowNotif(p=>!p)}
                    style={{cursor:"pointer",position:"relative"}}>
                    <i className="ti ti-bell" style={{fontSize:14}}/>
                    {(alerts>0||kendalaNotif.length>0)&&(
                      <div className="erp-bell-dot" style={{top:2,right:2}}/>
                    )}
                  </div>
                  {showNotif&&(
                    <div style={{position:"absolute",top:34,right:0,width:320,background:"#fff",
                      borderRadius:12,boxShadow:"0 8px 32px #00000018",border:"1px solid #e2e8f0",
                      zIndex:999,overflow:"hidden"}}>
                      {/* Header */}
                      <div style={{padding:"12px 16px",borderBottom:"1px solid #f1f5f9",display:"flex",
                        justifyContent:"space-between",alignItems:"center"}}>
                        <span style={{fontWeight:700,fontSize:13,color:"#1e293b"}}>Notifikasi</span>
                        <div style={{display:"flex",gap:8,alignItems:"center"}}>
                          {(alerts+kendalaNotif.length)>0&&(
                            <span style={{background:"#dc2626",color:"#fff",borderRadius:20,
                              padding:"1px 8px",fontSize:10,fontWeight:700}}>
                              {alerts+kendalaNotif.length}
                            </span>
                          )}
                          <button onClick={()=>setShowNotif(false)}
                            style={{background:"none",border:"none",cursor:"pointer",color:"#94a3b8",fontSize:14}}>✕</button>
                        </div>
                      </div>
                      {/* Notif list */}
                      <div style={{maxHeight:360,overflowY:"auto" as const}}>
                        {notifItems.length===0&&kendalaNotif.length===0?(
                          <div style={{padding:"32px",textAlign:"center",color:"#94a3b8",fontSize:12}}>
                            <div style={{fontSize:24,marginBottom:8}}>✅</div>
                            Semua WO on track!
                          </div>
                        ):(
                          <>
                            {notifItems.map((n:any)=>(
                              <div key={n.id} onClick={()=>{setTab("wo");setShowNotif(false);}}
                                style={{padding:"10px 16px",borderBottom:"1px solid #f8fafc",cursor:"pointer",
                                  background:"#fff",transition:"background .1s"}}
                                onMouseEnter={e=>(e.currentTarget.style.background="#f8fafc")}
                                onMouseLeave={e=>(e.currentTarget.style.background="#fff")}>
                                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}>
                                  <div style={{flex:1}}>
                                    <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:3}}>
                                      <span style={{fontSize:12,fontWeight:700,color:"#1e293b"}}>WO {n.wo}</span>
                                      <span style={{background:n.isDelayed?"#fef2f2":"#fffbeb",
                                        color:n.isDelayed?"#dc2626":"#d97706",
                                        borderRadius:20,padding:"1px 7px",fontSize:9,fontWeight:700}}>
                                        {n.isDelayed?"TERLAMBAT":"MENDESAK"}
                                      </span>
                                    </div>
                                    <div style={{fontSize:11,color:"#475569"}}>{n.proyek}</div>
                                    <div style={{display:"flex",alignItems:"center",gap:8,marginTop:4}}>
                                      <div style={{flex:1,height:3,background:"#e2e8f0",borderRadius:99,overflow:"hidden"}}>
                                        <div style={{width:n.pct+"%",height:"100%",
                                          background:n.pct>=75?"#16a34a":n.pct>=50?"#f59e0b":"#ef4444",
                                          borderRadius:99}}/>
                                      </div>
                                      <span style={{fontSize:10,fontWeight:700,color:"#64748b"}}>{n.pct}%</span>
                                    </div>
                                  </div>
                                  <div style={{textAlign:"right" as const,flexShrink:0}}>
                                    <div style={{fontSize:11,fontWeight:700,
                                      color:n.isDelayed?"#dc2626":n.daysLeft<=3?"#ef4444":"#d97706"}}>
                                      {n.isDelayed?`H+${Math.abs(n.daysLeft)}`:`H-${n.daysLeft}`}
                                    </div>
                                    <div style={{fontSize:9,color:"#94a3b8",marginTop:2}}>{n.target}</div>
                                  </div>
                                </div>
                              </div>
                            ))}
                            {kendalaNotif.map((k:any)=>(
                              <div key={k.id} onClick={()=>{setTab("kendala");setShowNotif(false);}}
                                style={{padding:"10px 16px",borderBottom:"1px solid #f8fafc",cursor:"pointer",
                                  background:"#fff"}}
                                onMouseEnter={e=>(e.currentTarget.style.background="#f8fafc")}
                                onMouseLeave={e=>(e.currentTarget.style.background="#fff")}>
                                <div style={{display:"flex",alignItems:"center",gap:8}}>
                                  <span style={{background:"#fef2f2",color:"#dc2626",borderRadius:20,
                                    padding:"1px 7px",fontSize:9,fontWeight:700}}>KENDALA</span>
                                  <span style={{fontSize:11,color:"#475569",flex:1}}>{k.deskripsi||k.kendala||"Kendala baru"}</span>
                                </div>
                              </div>
                            ))}
                          </>
                        )}
                      </div>
                      {/* Footer */}
                      {(notifItems.length>0||kendalaNotif.length>0)&&(
                        <div style={{padding:"8px 16px",borderTop:"1px solid #f1f5f9",textAlign:"center" as const}}>
                          <button onClick={()=>{setTab("wo");setShowNotif(false);}}
                            style={{background:"none",border:"none",cursor:"pointer",
                              fontSize:11,color:"#2563eb",fontWeight:600}}>
                            Lihat semua WO →
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>"""

if old_bell in content:
    content = content.replace(old_bell, new_bell)
    print("✅ Bell notification dropdown added")
else:
    print("❌ Bell not found")

# ── 3. Tutup notif saat klik di luar ──
old_body_click = "  const isOp=OPERATOR_ROLES.includes(user.divisi);"
new_body_click = """  const isOp=OPERATOR_ROLES.includes(user.divisi);

  // Tutup notif saat klik di luar
  useEffect(()=>{
    const handler=(e:MouseEvent)=>{
      const target=e.target as HTMLElement;
      if(!target.closest('.erp-bell')&&!target.closest('[data-notif-panel]')){
        setShowNotif(false);
      }
    };
    if(showNotif) document.addEventListener("mousedown",handler);
    return()=>document.removeEventListener("mousedown",handler);
  },[showNotif]);"""

if old_body_click in content:
    content = content.replace(old_body_click, new_body_click)
    print("✅ Click outside handler added")
else:
    print("⚠️  Click outside anchor not found")

APP_PATH.write_text(content, encoding="utf-8")
print("\n✅ Task 2 (Bell) Selesai!")
