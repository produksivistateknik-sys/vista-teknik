import { useState } from 'react'
import { woOverall, panelOverall } from '../lib/panelHelpers'
import { isDelayed, isUrgent, daysUntil } from '../lib/dateHelpers'
import { Btn } from './ui/Primitives'
import { KalenderTab } from './KalenderTab'

export function Dashboard({woData}){
  const [activeTab,setActiveTab]=useState("wo");
  const [woSearch,setWoSearch]=useState("");
  const [woStatus,setWoStatus]=useState("semua");
  const [panelSearch,setPanelSearch]=useState("");
  const [panelWO,setPanelWO]=useState("semua");
  const [panelProgress,setPanelProgress]=useState("semua");
  const [alertType,setAlertType]=useState("semua");

  if(!woData.length) return(
    <div style={{textAlign:"center",padding:"60px 20px",color:"#94a3b8"}}>
      <div style={{fontSize:40,marginBottom:12}}>📋</div>
      <div style={{fontSize:14,fontWeight:600,color:"#1e293b"}}>Belum ada Work Order</div>
      <div style={{fontSize:12,marginTop:4}}>Tambahkan WO di Manajemen WO terlebih dahulu</div>
    </div>
  );

  const alerts=woData.filter(w=>woOverall(w)<100&&(isDelayed(w.target)||isUrgent(w.target)));
  const avgOverall=woData.length?Math.round(woData.reduce((a,w)=>a+woOverall(w),0)/woData.length):0;
  const totalPanel=woData.reduce((a,w)=>a+(w.panels||[]).length,0);

  const filteredWO=woData.filter(w=>{
    const pct=woOverall(w);
    const s=pct===100?"selesai":isDelayed(w.target)?"terlambat":isUrgent(w.target)?"mendesak":"ontrack";
    const matchS=woStatus==="semua"||(woStatus==="ontrack"&&s==="ontrack")||(woStatus==="mendesak"&&s==="mendesak")||(woStatus==="terlambat"&&s==="terlambat")||(woStatus==="selesai"&&s==="selesai");
    const matchQ=!woSearch||(w.wo||"").toLowerCase().includes(woSearch.toLowerCase())||(w.proyek||"").toLowerCase().includes(woSearch.toLowerCase());
    return matchS&&matchQ;
  });

  const allPanels=woData.flatMap(w=>(w.panels||[]).map(p=>({...p,wo:w.wo,proyek:w.proyek,woId:w.id,target:w.target})));
  const filteredPanels=allPanels.filter(p=>{
    const pct=panelOverall?.(p)??0;
    const matchWO=panelWO==="semua"||(p.wo||"")===panelWO;
    const matchQ=!panelSearch||(p.nama||"").toLowerCase().includes(panelSearch.toLowerCase())||(p.proyek||"").toLowerCase().includes(panelSearch.toLowerCase());
    const matchP=panelProgress==="semua"||(panelProgress==="0-25"&&pct<=25)||(panelProgress==="26-50"&&pct>25&&pct<=50)||(panelProgress==="51-75"&&pct>50&&pct<=75)||(panelProgress==="76-100"&&pct>75);
    return matchWO&&matchQ&&matchP;
  });

  const filteredAlerts=alerts.filter(w=>{
    if(alertType==="semua") return true;
    if(alertType==="terlambat") return isDelayed(w.target);
    if(alertType==="mendesak") return isUrgent(w.target)&&!isDelayed(w.target);
    return true;
  });

  const thS={background:"#f8fafc",color:"#64748b",fontWeight:600,padding:"7px 11px",
    textAlign:"left" as const,fontSize:9.5,textTransform:"uppercase" as const,
    letterSpacing:.4,borderBottom:"1px solid #eaecf0",whiteSpace:"nowrap" as const};
  const tdS={padding:"8px 11px",borderBottom:"1px solid #f5f7fa",
    color:"#374151",verticalAlign:"middle" as const,fontSize:11.5};

  const StatusBadge=({w}:{w:any})=>{
    const pct=woOverall(w);
    const s=pct===100?"Selesai":isDelayed(w.target)?"Terlambat":isUrgent(w.target)?"Mendesak":"On Track";
    const c=pct===100?"#16a34a":isDelayed(w.target)?"#dc2626":isUrgent(w.target)?"#d97706":"#16a34a";
    const bg=pct===100?"#f0fdf4":isDelayed(w.target)?"#fef2f2":isUrgent(w.target)?"#fffbeb":"#f0fdf4";
    return <span style={{background:bg,color:c,borderRadius:4,padding:"2px 7px",fontSize:9.5,fontWeight:600}}>{s}</span>;
  };

  const PBar=({pct,w=60}:{pct:number,w?:number})=>{
    const c=pct===100?"#16a34a":pct>=70?"#16a34a":pct>=40?"#d97706":"#dc2626";
    return(
      <div style={{display:"flex",alignItems:"center",gap:6}}>
        <div style={{width:w,height:4,background:"#e2e8f0",borderRadius:99,overflow:"hidden",flexShrink:0}}>
          <div style={{width:pct+"%",height:"100%",background:c,borderRadius:99}}/>
        </div>
        <span style={{fontSize:11,fontWeight:600,minWidth:28,color:c}}>{pct}%</span>
      </div>
    );
  };

  const inpS={height:28,border:"1px solid #e2e8f0",borderRadius:5,padding:"0 8px",
    fontSize:11,background:"var(--input-bg,#f8fafc)",outline:"none",color:"var(--text-primary,#1e293b)",fontFamily:"inherit"};
  const selS={height:28,border:"1px solid #e2e8f0",borderRadius:5,padding:"0 7px",
    fontSize:11,background:"var(--input-bg,#f8fafc)",outline:"none",color:"var(--text-secondary,#475569)",cursor:"pointer",fontFamily:"inherit"};

  return(
    <div style={{display:"flex",flexDirection:"column",gap:10}}>

      {/* Alerts */}
      {alerts.map(w=>{
        const d=daysUntil(w.target);
        const late=isDelayed(w.target);
        return(
          <div key={w.id} style={{display:"flex",alignItems:"center",gap:10,
            background:late?"#fef2f2":"#fffbeb",border:"1px solid "+(late?"#fecaca":"#fde68a"),
            borderRadius:7,padding:"8px 13px",fontSize:11.5}}>
            <span style={{color:late?"#dc2626":"#d97706",fontSize:14,flexShrink:0}}>●</span>
            <span style={{fontWeight:600,color:late?"#dc2626":"#d97706"}}>WO {w.wo} — {w.proyek}</span>
            <span style={{color:late?"#7f1d1d":"#78350f",fontSize:11}}>
              {late?"Terlambat "+Math.abs(d)+" hari":"H-"+d+" Mendesak"} · Target: {w.target}
            </span>
            <span style={{marginLeft:"auto",background:late?"#fef2f2":"#fffbeb",
              color:late?"#dc2626":"#d97706",border:"1px solid "+(late?"#fecaca":"#fde68a"),
              borderRadius:4,padding:"2px 7px",fontSize:9.5,fontWeight:600,flexShrink:0}}>
              {late?"Terlambat":"Mendesak"}
            </span>
          </div>
        );
      })}

      {/* Stat Cards */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8}}>
        {[
          {n:woData.length,l:"Total Work Order",c:"#2563eb",w:Math.min(woData.length*20,100)},
          {n:totalPanel,l:"Total Panel",c:"#10b981",w:60},
          {n:avgOverall+"%",l:"Avg Progress",c:avgOverall>=70?"#16a34a":avgOverall>=40?"#d97706":"#dc2626",w:avgOverall},
          {n:alerts.length,l:"Perlu Perhatian",c:"#dc2626",w:Math.min(alerts.length*25,100)},
        ].map((s,i)=>(
          <div key={i} style={{background:"var(--card-bg,#fff)",border:"1px solid var(--border-color,#eaecf0)",borderRadius:8,padding:"12px 14px"}}>
            <div style={{fontSize:22,fontWeight:700,color:s.c,lineHeight:1}}>{s.n}</div>
            <div style={{fontSize:9,color:"#94a3b8",marginTop:4,fontWeight:500,textTransform:"uppercase",letterSpacing:.4}}>{s.l}</div>
            <div style={{height:3,background:"#e2e8f0",borderRadius:99,marginTop:10,overflow:"hidden"}}>
              <div style={{width:s.w+"%",height:"100%",background:s.c,borderRadius:99}}/>
            </div>
          </div>
        ))}
      </div>

      {/* Table Card */}
      <div style={{background:"var(--card-bg,#fff)",border:"1px solid var(--border-color,#eaecf0)",borderRadius:8,overflow:"hidden"}}>

        {/* Tabs */}
        <div style={{display:"flex",borderBottom:"1px solid var(--border-color,#eaecf0)",padding:"0 5px",background:"var(--card-bg,#fff)"}}>
          {[
            {id:"wo",label:"Work Order"},
            {id:"panel",label:"Panel List"},
            {id:"alert",label:"Peringatan"+(alerts.length>0?" ("+alerts.length+")":"")},
            {id:"kalender",label:"Kalender"},
          ].map(t=>(
            <div key={t.id} onClick={()=>setActiveTab(t.id)}
              style={{padding:"9px 14px",fontSize:12,fontWeight:activeTab===t.id?600:500,
                color:activeTab===t.id?"#2563eb":"#64748b",cursor:"pointer",
                borderBottom:activeTab===t.id?"2px solid #2563eb":"2px solid transparent",
                marginBottom:-1,transition:"all .13s"}}>
              {t.label}
            </div>
          ))}
        </div>

        {/* ── TAB: WORK ORDER ── */}
        {activeTab==="wo"&&<>
          <div style={{padding:"9px 13px",borderBottom:"1px solid #f0f2f5",display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,flexWrap:"wrap" as const}}>
            <span style={{fontSize:13,fontWeight:600,color:"#0f172a"}}>Daftar Work Order</span>
            <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap" as const}}>
              <input style={{...inpS,width:180,paddingLeft:26,backgroundImage:"url('%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%2394a3b8%22 stroke-width=%222%22%3E%3Ccircle cx=%2211%22 cy=%2211%22 r=%228%22/%3E%3Cpath d=%22m21 21-4.35-4.35%22/%3E%3C/svg%3E')",backgroundRepeat:"no-repeat",backgroundPosition:"7px center"}}
                placeholder="Cari WO atau proyek..." value={woSearch} onChange={e=>setWoSearch(e.target.value)}/>
              <select style={selS} value={woStatus} onChange={e=>setWoStatus(e.target.value)}>
                <option value="semua">Semua Status</option>
                <option value="ontrack">On Track</option>
                <option value="mendesak">Mendesak</option>
                <option value="terlambat">Terlambat</option>
                <option value="selesai">Selesai</option>
              </select>
            </div>
          </div>
          <div style={{overflowX:"auto" as const}}>
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead><tr>
                {["No WO","Proyek","Target","Panel","Progress","Status","Aksi"].map(h=><th key={h} style={thS}>{h}</th>)}
              </tr></thead>
              <tbody>
                {filteredWO.length===0&&<tr><td colSpan={7} style={{...tdS,textAlign:"center",color:"#94a3b8",padding:"24px"}}>Tidak ada data</td></tr>}
                {filteredWO.map(wo=>{
                  const pct=woOverall(wo);
                  const d=daysUntil(wo.target);
                  const late=isDelayed(wo.target);
                  const urg=isUrgent(wo.target);
                  return(
                    <tr key={wo.id}>
                      <td style={tdS}><span style={{color:"#2563eb",fontWeight:700,fontFamily:"ui-monospace,monospace",fontSize:11}}>WO {wo.wo}</span></td>
                      <td style={{...tdS,fontWeight:500,color:"#1e293b"}}>{wo.proyek}</td>
                      <td style={tdS}>
                        <span style={{color:"#64748b"}}>{wo.target}</span>
                        {pct<100&&<span style={{marginLeft:6,fontSize:10.5,fontWeight:600,color:late?"#dc2626":urg?"#d97706":"#16a34a"}}>
                          {late?"−"+Math.abs(d)+"hr":"H-"+d}
                        </span>}
                      </td>
                      <td style={{...tdS,color:"#64748b"}}>{(wo.panels||[]).length} panel</td>
                      <td style={tdS}><PBar pct={pct}/></td>
                      <td style={tdS}><StatusBadge w={wo}/></td>
                      <td style={{...tdS,textAlign:"center" as const}}>
                        {pct===100?(
                          <Btn color="#16a34a" style={{fontSize:11,padding:"4px 10px"}} onClick={()=>setArsipModal(wo)}>
                            📦 Arsipkan
                          </Btn>
                        ):(
                          <span style={{fontSize:10,color:"#cbd5e1"}}>—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {filteredWO.length>0&&<tfoot>
                <tr style={{background:"#f8fafc"}}>
                  <td colSpan={4} style={{padding:"7px 11px",fontSize:10.5,color:"#94a3b8"}}>{filteredWO.length} work order · rata-rata</td>
                  <td style={{padding:"7px 11px"}}>
                    <PBar pct={filteredWO.length?Math.round(filteredWO.reduce((a,w)=>a+woOverall(w),0)/filteredWO.length):0}/>
                  </td>
                  <td/>
                </tr>
              </tfoot>}
            </table>
          </div>
        </>}

        {/* ── TAB: PANEL LIST ── */}
        {activeTab==="panel"&&<>
          <div style={{padding:"9px 13px",borderBottom:"1px solid #f0f2f5",display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,flexWrap:"wrap" as const}}>
            <span style={{fontSize:13,fontWeight:600,color:"#0f172a"}}>Daftar Panel</span>
            <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap" as const}}>
              <input style={{...inpS,width:160,paddingLeft:26,backgroundImage:"url('%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%2394a3b8%22 stroke-width=%222%22%3E%3Ccircle cx=%2211%22 cy=%2211%22 r=%228%22/%3E%3Cpath d=%22m21 21-4.35-4.35%22/%3E%3C/svg%3E')",backgroundRepeat:"no-repeat",backgroundPosition:"7px center"}}
                placeholder="Cari panel..." value={panelSearch} onChange={e=>setPanelSearch(e.target.value)}/>
              <select style={selS} value={panelWO} onChange={e=>setPanelWO(e.target.value)}>
                <option value="semua">Semua WO</option>
                {woData.map(w=><option key={w.id} value={w.wo}>WO {w.wo}</option>)}
              </select>
              <select style={selS} value={panelProgress} onChange={e=>setPanelProgress(e.target.value)}>
                <option value="semua">Semua Progress</option>
                <option value="0-25">0 - 25%</option>
                <option value="26-50">26 - 50%</option>
                <option value="51-75">51 - 75%</option>
                <option value="76-100">76 - 100%</option>
              </select>
            </div>
          </div>
          <div style={{overflowX:"auto" as const}}>
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead><tr>
                {["No WO","Proyek","Nama Panel","Progress","Status"].map(h=><th key={h} style={thS}>{h}</th>)}
              </tr></thead>
              <tbody>
                {filteredPanels.length===0&&<tr><td colSpan={5} style={{...tdS,textAlign:"center",color:"#94a3b8",padding:"24px"}}>Tidak ada data</td></tr>}
                {filteredPanels.map((p,i)=>{
                  const pct=panelOverall?.(p)??0;
                  const late=isDelayed(p.target);
                  const urg=isUrgent(p.target);
                  const s=pct===100?"Selesai":late?"Terlambat":urg?"Mendesak":"On Track";
                  const c=pct===100?"#16a34a":late?"#dc2626":urg?"#d97706":"#16a34a";
                  const bg=pct===100?"#f0fdf4":late?"#fef2f2":urg?"#fffbeb":"#f0fdf4";
                  return(
                    <tr key={i}>
                      <td style={tdS}><span style={{color:"#2563eb",fontWeight:700,fontFamily:"ui-monospace,monospace",fontSize:11}}>WO {p.wo}</span></td>
                      <td style={{...tdS,color:"#475569"}}>{p.proyek}</td>
                      <td style={{...tdS,fontWeight:500,color:"#1e293b"}}>{p.nama}</td>
                      <td style={tdS}><PBar pct={pct}/></td>
                      <td style={tdS}><span style={{background:bg,color:c,borderRadius:4,padding:"2px 7px",fontSize:9.5,fontWeight:600}}>{s}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>}

        {/* ── TAB: PERINGATAN ── */}
        {activeTab==="alert"&&<>
          <div style={{padding:"9px 13px",borderBottom:"1px solid #f0f2f5",display:"flex",alignItems:"center",justifyContent:"space-between",gap:8}}>
            <span style={{fontSize:13,fontWeight:600,color:"#0f172a"}}>Daftar Peringatan</span>
            <select style={selS} value={alertType} onChange={e=>setAlertType(e.target.value)}>
              <option value="semua">Semua Tipe</option>
              <option value="terlambat">Terlambat</option>
              <option value="mendesak">Mendesak</option>
            </select>
          </div>
          <div style={{overflowX:"auto" as const}}>
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead><tr>
                {["No WO","Proyek","Target","Progress","Keterangan","Status"].map(h=><th key={h} style={thS}>{h}</th>)}
              </tr></thead>
              <tbody>
                {filteredAlerts.length===0&&<tr><td colSpan={6} style={{...tdS,textAlign:"center",color:"#94a3b8",padding:"24px"}}>Tidak ada peringatan</td></tr>}
                {filteredAlerts.map(w=>{
                  const pct=woOverall(w);
                  const d=daysUntil(w.target);
                  const late=isDelayed(w.target);
                  return(
                    <tr key={w.id}>
                      <td style={tdS}><span style={{color:"#2563eb",fontWeight:700,fontFamily:"ui-monospace,monospace",fontSize:11}}>WO {w.wo}</span></td>
                      <td style={{...tdS,fontWeight:500,color:"#1e293b"}}>{w.proyek}</td>
                      <td style={{...tdS,color:"#64748b"}}>{w.target}</td>
                      <td style={tdS}><PBar pct={pct}/></td>
                      <td style={{...tdS,fontSize:11,color:late?"#7f1d1d":"#78350f"}}>
                        {late?"Terlambat "+Math.abs(d)+" hari dari target":"H-"+d+" mendekati deadline"}
                      </td>
                      <td style={tdS}>
                        <span style={{background:late?"#fef2f2":"#fffbeb",color:late?"#dc2626":"#d97706",
                          borderRadius:4,padding:"2px 7px",fontSize:9.5,fontWeight:600}}>
                          {late?"Terlambat":"Mendesak"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>}

        {/* TAB: KALENDER */}
        {activeTab==="kalender"&&<KalenderTab woData={woData}/>}
      </div>
    </div>
  );
}
