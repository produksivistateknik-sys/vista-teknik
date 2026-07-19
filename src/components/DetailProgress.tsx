import { useState } from 'react'
import { PANEL_TYPES, PROSES_COLOR, WP_COLOR, ALL_PROSES } from '../constants/panelTypes'
import { calcPanelProgress, panelOverall, getBestProgress } from '../lib/panelHelpers'
import { isDelayed, isUrgent, daysUntil } from '../lib/dateHelpers'

export function DetailProgress({woData,rawData,livePanelTypes}:{woData:any[],rawData:any[],livePanelTypes?:any}){
  const getEffCfg=(tipe:string)=>(livePanelTypes?.[tipe]?.wps?.length>0)?livePanelTypes[tipe]:(PANEL_TYPES as any)[tipe];
  const [search,setSearch]=useState("");
  const [woFilter,setWoFilter]=useState("semua");
  const [panelFilter,setPanelFilter]=useState("semua");
  const [statusFilter,setStatusFilter]=useState<string[]>([]);

  const PROSES_LIST=ALL_PROSES;

  const allPanels=woData.flatMap(wo=>(wo.panels||[]).map((p:any)=>({
    ...p,
    wo:wo.wo,
    woId:wo.id,
    proyek:wo.proyek,
    target:wo.target,
    pd:calcPanelProgress(p),
  })));

  const filtered=allPanels.filter(p=>{
    const pct=panelOverall(p);
    const s=pct===100?"selesai":isDelayed(p.target)?"terlambat":isUrgent(p.target)?"mendesak":"ontrack";
    const matchS=statusFilter.length===0||statusFilter.includes(s);
    const matchWO=woFilter==="semua"||p.wo===woFilter;
    const matchPanel=panelFilter==="semua"||String(p.id)===panelFilter;
    const matchQ=!search||
      (p.nama||"").toLowerCase().includes(search.toLowerCase())||
      (p.proyek||"").toLowerCase().includes(search.toLowerCase())||
      (p.wo||"").toLowerCase().includes(search.toLowerCase());
    return matchS&&matchWO&&matchPanel&&matchQ;
  });

  const thS={background:"#1e3a5f",color:"#fff",fontWeight:600,padding:"7px 10px",
    textAlign:"center" as const,fontSize:9,textTransform:"uppercase" as const,
    letterSpacing:.3,borderBottom:"1px solid #1e3a5f",whiteSpace:"nowrap" as const,
    borderRight:"1px solid rgba(255,255,255,.1)"};
  const thSL={...thS,textAlign:"left" as const};
  const tdS={padding:"6px 10px",borderBottom:"1px solid #f5f7fa",
    color:"#374151",verticalAlign:"middle" as const,fontSize:11,
    borderRight:"1px solid #f5f7fa",textAlign:"center" as const};
  const tdSL={...tdS,textAlign:"left" as const};

  if(!woData.length) return(
    <div style={{textAlign:"center",padding:"60px 20px",color:"#94a3b8"}}>
      <div style={{fontSize:40,marginBottom:12}}>🔍</div>
      <div style={{fontSize:14,fontWeight:600,color:"#1e293b"}}>Belum ada data</div>
    </div>
  );

  const totalPanel=allPanels.length;
  const avgOverall=totalPanel?Math.round(allPanels.reduce((a,p)=>a+panelOverall(p),0)/totalPanel):0;
  const selesai=allPanels.filter(p=>panelOverall(p)===100).length;
  const terlambat=allPanels.filter(p=>isDelayed(p.target)&&panelOverall(p)<100).length;

  const ProsesPctCell=({pct,proses,cl,nama}:{pct:number|undefined,proses:string,cl?:any,nama?:string})=>{
    if(pct===undefined||pct===null) return <td style={{...tdS,color:"#e2e8f0",fontSize:9}}>—</td>;
    const color=(PROSES_COLOR as any)[proses]||"#94a3b8";
    const isDone=pct===100;
    const history=cl?.history?.[proses]||[];
    const pctFinal=pct!==undefined&&pct!==null?pct:getBestProgress(cl,proses);
    return(
      <td style={tdS} className="hist-cell">
        <div style={{display:"flex",flexDirection:"column" as const,alignItems:"center",gap:2,position:"relative" as const}}>
          <div style={{width:44,height:3,background:"#e2e8f0",borderRadius:99,overflow:"hidden"}}>
            <div style={{width:pct+"%",height:"100%",background:isDone?"#16a34a":color,borderRadius:99}}/>
          </div>
          <span style={{fontSize:9,fontWeight:700,color:isDone?"#16a34a":pct>0?color:"#94a3b8"}}>{pct}%</span>
          {history.length>0&&(
            <div className="hist-tooltip" style={{
              opacity:0,visibility:"hidden" as const,
              position:"absolute" as const,bottom:"100%",left:"50%",
              transform:"translateX(-50%)",
              background:"#1e293b",color:"#f1f5f9",
              borderRadius:8,padding:"8px 12px",
              fontSize:10,whiteSpace:"nowrap" as const,
              zIndex:999,marginBottom:6,
              boxShadow:"0 4px 16px #00000030",
              transition:"opacity .15s",
              minWidth:180,
            }}>

              {[...history].sort((a:any,b:any)=>a.tanggal?.localeCompare(b.tanggal)).map((h:any,hi:number)=>(
                <div key={hi} style={{display:"flex",justifyContent:"space-between",gap:12,padding:"2px 0",borderBottom:hi<history.length-1?"1px solid #334155":"none"}}>
                  <span style={{color:"#94a3b8"}}>📅 {new Date(h.tanggal).toLocaleDateString("id-ID",{day:"numeric",month:"short",year:"numeric"})}</span>
                  <span style={{color:"#fbbf24"}}>Shift {h.shift}</span>
                  <span style={{color:h.pct>=100?"#4ade80":h.pct>0?"#fb923c":"#94a3b8",fontWeight:700}}>{h.pct}%</span>
                </div>
              ))}
              <div style={{position:"absolute" as const,bottom:-5,left:"50%",transform:"translateX(-50%)",width:0,height:0,borderLeft:"5px solid transparent",borderRight:"5px solid transparent",borderTop:"5px solid #1e293b"}}/>
            </div>
          )}
        </div>
      </td>
    );
  };

  const prosesAda=PROSES_LIST.filter(pr=>allPanels.some(p=>p.pd[pr]!==undefined&&p.pd[pr]>=0));

  return(
    <div style={{display:"flex",flexDirection:"column",gap:10}}>

      {/* Stat row */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8}}>
        {[
          {n:totalPanel,l:"Total Panel",c:"#2563eb",bc:"#2563eb"},
          {n:avgOverall+"%",l:"Avg Overall",c:avgOverall>=70?"#16a34a":avgOverall>=40?"#d97706":"#dc2626",bc:avgOverall>=70?"#16a34a":avgOverall>=40?"#d97706":"#dc2626"},
          {n:selesai,l:"Panel Selesai",c:"#16a34a",bc:"#16a34a"},
          {n:terlambat,l:"Panel Terlambat",c:"#dc2626",bc:"#dc2626"},
        ].map((s,i)=>(
          <div key={i} style={{background:"var(--card-bg,#fff)",border:"1px solid var(--border-color,#eaecf0)",borderTop:"3px solid "+s.bc,borderRadius:8,padding:"10px 13px",textAlign:"center" as const}}>
            <div style={{fontSize:20,fontWeight:700,color:s.c}}>{s.n}</div>
            <div style={{fontSize:9,color:"#94a3b8",marginTop:3,fontWeight:500,textTransform:"uppercase" as const,letterSpacing:.3}}>{s.l}</div>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div style={{background:"var(--card-bg,#fff)",border:"1px solid var(--border-color,#eaecf0)",borderRadius:8,padding:"10px 13px",display:"flex",alignItems:"center",gap:8,flexWrap:"wrap" as const}}>
        <input placeholder="🔍 Cari panel, proyek, WO..."
          value={search} onChange={e=>setSearch(e.target.value)}
          style={{height:28,border:"1px solid #e2e8f0",borderRadius:5,padding:"0 10px",
            fontSize:11,background:"var(--input-bg,#f8fafc)",outline:"none",color:"var(--text-primary,#1e293b)",
            fontFamily:"inherit",flex:1,minWidth:160}}/>
        <select value={woFilter} onChange={e=>{setWoFilter(e.target.value);setPanelFilter("semua");}}
          style={{height:28,border:"1px solid #e2e8f0",borderRadius:5,padding:"0 7px",
            fontSize:11,background:"var(--input-bg,#f8fafc)",outline:"none",color:"var(--text-secondary,#475569)",cursor:"pointer",fontFamily:"inherit"}}>
          <option value="semua">Semua WO</option>
          {woData.map(w=><option key={w.id} value={w.wo}>WO {w.wo} — {w.proyek}</option>)}
        </select>
        <select value={panelFilter} onChange={e=>setPanelFilter(e.target.value)} disabled={woFilter==="semua"}
          style={{height:28,border:"1px solid #e2e8f0",borderRadius:5,padding:"0 7px",
            fontSize:11,background:woFilter==="semua"?"#f1f5f9":"var(--input-bg,#f8fafc)",outline:"none",color:"var(--text-secondary,#475569)",cursor:woFilter==="semua"?"not-allowed":"pointer",fontFamily:"inherit"}}>
          <option value="semua">Semua Panel</option>
          {allPanels.filter((p:any)=>woFilter==="semua"||p.wo===woFilter).map((p:any)=>(
            <option key={p.id} value={p.id}>{p.nama}</option>
          ))}
        </select>
        <div style={{display:"flex",gap:4,alignItems:"center",flexWrap:"wrap" as const}}>
          {[
            {v:"ontrack",l:"On Track",c:"#2563eb"},
            {v:"mendesak",l:"Mendesak H-7",c:"#d97706"},
            {v:"terlambat",l:"Terlambat",c:"#dc2626"},
            {v:"selesai",l:"Selesai",c:"#16a34a"},
          ].map(opt=>{
            const isSel=statusFilter.includes(opt.v);
            return(
              <button key={opt.v} onClick={()=>setStatusFilter(prev=>isSel?prev.filter(x=>x!==opt.v):[...prev,opt.v])}
                style={{height:28,padding:"0 10px",borderRadius:5,border:`1.5px solid ${isSel?opt.c:"#e2e8f0"}`,
                  background:isSel?opt.c+"18":"var(--input-bg,#f8fafc)",color:isSel?opt.c:"var(--text-secondary,#475569)",
                  fontSize:11,fontWeight:isSel?700:500,cursor:"pointer",fontFamily:"inherit",
                  display:"flex",alignItems:"center",gap:4,whiteSpace:"nowrap" as const}}>
                {isSel&&<span style={{width:6,height:6,borderRadius:"50%",background:opt.c}}/>}
                {opt.l}
              </button>
            );
          })}
          {statusFilter.length>0&&(
            <button onClick={()=>setStatusFilter([])}
              style={{height:28,padding:"0 8px",borderRadius:5,border:"1px solid #fecaca",
                background:"#fef2f2",color:"#dc2626",fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>
              ✕ Reset
            </button>
          )}
        </div>
        <span style={{fontSize:10,color:"#94a3b8",marginLeft:"auto"}}>{filtered.length} panel</span>
        <span style={{fontSize:10,color:"#94a3b8",padding:"2px 8px",background:"var(--bg-tertiary,#f1f5f9)",borderRadius:5}}>👁 Read-only</span>
      </div>

      {/* Panel cards dengan komponen */}
      {filtered.length===0?(
        <div style={{background:"var(--card-bg,#fff)",border:"1px solid var(--border-color,#eaecf0)",borderRadius:8,padding:"40px",textAlign:"center" as const,color:"#94a3b8"}}>
          Tidak ada data yang sesuai filter
        </div>
      ):filtered.map((p:any,pi:number)=>{
        const ppct=panelOverall(p);
        const d=daysUntil(p.target);
        const late=isDelayed(p.target);
        const urg=isUrgent(p.target);
        const done=ppct===100;
        const pc=done?"#16a34a":ppct>=70?"#16a34a":ppct>=40?"#d97706":"#dc2626";
        const statusLabel=done?"Selesai":late?"Terlambat":urg?"Mendesak":"On Track";
        const statusColor=done?"#16a34a":late?"#dc2626":urg?"#d97706":"#2563eb";
        const statusBg=done?"#f0fdf4":late?"#fef2f2":urg?"#fffbeb":"#eff6ff";
        const borderColor=done?"#16a34a":late?"#dc2626":urg?"#d97706":"#e2e8f0";
        const cfg=getEffCfg(p.tipe);
        const wps=cfg?.wps||[];
        // Tampilkan BUSBAR jika tipe panel punya komponen busbar (WM) atau ada progress
        const BUSBAR_TIPE=["WM_MS","WM_POLY","FS","F3B"];
        const hasBusbar=BUSBAR_TIPE.includes(p.tipe)||Object.keys(p.busbar_progress||{}).length>0;
        const prosesPanel=PROSES_LIST.filter(pr=>{
          if(pr==="QC TEST"||pr==="PACKING") return false;
          if(pr==="BUSBAR") return hasBusbar;
          return p.pd[pr]!==undefined&&p.pd[pr]>=0;
        });

        return(
          <div key={pi} style={{background:"var(--card-bg,#fff)",border:"1px solid var(--border-color,#eaecf0)",
            borderRadius:8,overflow:"hidden",borderLeft:"3px solid "+borderColor}}>

            {/* Panel header */}
            <div style={{padding:"9px 13px",borderBottom:"1px solid var(--border-color,#eaecf0)",
              display:"flex",alignItems:"center",gap:10,flexWrap:"wrap" as const,background:"var(--bg-secondary,#fafbfc)"}}>
              <span style={{color:"#2563eb",fontWeight:800,fontFamily:"ui-monospace,monospace",fontSize:12}}>WO {p.wo}</span>
              <span style={{fontWeight:700,color:"var(--text-primary,#1e293b)",fontSize:13}}>{p.proyek}</span>
              <span style={{color:"#94a3b8",fontSize:11}}>|</span>
              <span style={{fontWeight:600,color:"var(--text-primary,#1e293b)",fontSize:12}}>{p.nama||"Panel "+(pi+1)}</span>
              {p.tipe&&<span style={{background:"#eff6ff",color:"#2563eb",borderRadius:20,padding:"1px 8px",fontSize:9,fontWeight:600}}>{p.tipe}</span>}
              <span style={{fontSize:11,color:"#94a3b8"}}>📅 {p.target}</span>
              {!done&&<span style={{fontSize:11,fontWeight:600,color:late?"#dc2626":urg?"#d97706":"#16a34a"}}>
                {late?"Terlambat "+Math.abs(d)+" hari":urg?"H-"+d+" Mendesak":"H-"+d}
              </span>}
              <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:8}}>
                {(p.nameplate_progress!==undefined||p.yellowmark_progress!==undefined)&&(
                  <div style={{display:"flex",alignItems:"center",gap:6}}>
                    <span style={{fontSize:9,fontWeight:700,padding:"3px 8px",borderRadius:5,border:`1px solid ${(p.nameplate_progress||0)>=100?"#a5f3fc":"#e2e8f0"}`,background:(p.nameplate_progress||0)>=100?"#ecfeff":"#f8fafc",color:(p.nameplate_progress||0)>=100?"#0891b2":"#94a3b8",whiteSpace:"nowrap" as const}}>Nameplate: {p.nameplate_progress||0}%</span>
                    <span style={{fontSize:9,fontWeight:700,padding:"3px 8px",borderRadius:5,border:`1px solid ${(p.yellowmark_progress||0)>=100?"#fde68a":"#e2e8f0"}`,background:(p.yellowmark_progress||0)>=100?"#fefce8":"#f8fafc",color:(p.yellowmark_progress||0)>=100?"#ca8a04":"#94a3b8",whiteSpace:"nowrap" as const}}>Yellowmark: {p.yellowmark_progress||0}%</span>
                  </div>
                )}
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  <div style={{width:100,height:5,background:"#e2e8f0",borderRadius:99,overflow:"hidden"}}>
                    <div style={{width:ppct+"%",height:"100%",background:pc,borderRadius:99}}/>
                  </div>
                  <span style={{fontSize:13,fontWeight:800,color:pc}}>{ppct}%</span>
                </div>
                <span style={{background:statusBg,color:statusColor,borderRadius:4,padding:"2px 8px",fontSize:10,fontWeight:600}}>{statusLabel}</span>
              </div>
            </div>

            {/* Komponen table */}
            <div style={{overflowX:"auto" as const}}>
              <table style={{width:"100%",borderCollapse:"collapse"}}>
                <thead>
                  <tr>
                    <th style={{...thS,minWidth:50}}>WP</th>
                    <th style={{...thSL,minWidth:180}}>Komponen</th>
                    <th style={{...thS,minWidth:60}}>Kode</th>
                    <th style={{...thS,minWidth:50}}>QTY 🔒</th>
                    {prosesPanel.map(pr=>(
                      <th key={pr} style={{...thS,minWidth:70,borderTop:"3px solid "+((PROSES_COLOR as any)[pr]||"#94a3b8")}}>
                        {pr}
                      </th>
                    ))}
                    <th style={{...thS,minWidth:70,borderTop:"3px solid #0891b2"}}>NAMEPLATE</th>
                    <th style={{...thS,minWidth:70,borderTop:"3px solid #ca8a04"}}>YELLOWMARK</th>
                    <th style={{...thS,minWidth:60,borderTop:"3px solid #16a34a"}}>QC</th>
                    <th style={{...thS,minWidth:60,borderTop:"3px solid #2563eb"}}>PACKING</th>
                  </tr>
                </thead>
                <tbody>
                  {(()=>{
                    const totalRowsPanel=wps.reduce((sum:number,wp:any)=>{
                      const ai=wp.items.filter((it:any)=>(p.checklist?.[it.kode]?.qty||0)>0||(p.checklist?.[it.kode]));
                      return sum+ai.length;
                    },0);
                    const firstRenderedWp=wps.find((wp:any)=>{
                      const ai=wp.items.filter((it:any)=>(p.checklist?.[it.kode]?.qty||0)>0||(p.checklist?.[it.kode]));
                      return ai.length>0;
                    });
                    const qcCl=p.qc_checklist||{};
                    const qcStatuses=["fisik","spesifikasi","baut","test"].map((k:string)=>qcCl[k]?.status||"to_do");
                    const qcStatus=qcStatuses.every((s:string)=>s==="complete")?"complete":qcStatuses.some((s:string)=>s==="in_progress"||s==="complete")?"in_progress":"to_do";
                  return wps.map((wp:any)=>{
                    const wpColor=(WP_COLOR as any)[wp.wp]||"#94a3b8";
                    const activeItems=wp.items.filter((it:any)=>(p.checklist?.[it.kode]?.qty||0)>0||(p.checklist?.[it.kode]));
                    if(!activeItems.length) return null;
                    return activeItems.map((it:any,ii:number)=>{
                      const cl=p.checklist?.[it.kode];
                      const qty=cl?.qty||it.qty||1;
                      const rowBg=wp.wp==="WP1"?"var(--wp1-bg,#fffbeb)":wp.wp==="WP2"?"var(--wp2-bg,#f0fdf4)":wp.wp==="WP3"?"var(--wp3-bg,#eff6ff)":wp.wp==="WP4"?"#fff7ed":"#fafbfc";
                      return(
                        <tr key={it.kode}>
                          {ii===0&&(
                            <td style={{...tdS,background:rowBg,fontWeight:700,fontSize:10}} rowSpan={activeItems.length}>
                              <span style={{background:wpColor,color:"#fff",borderRadius:4,padding:"2px 7px",fontSize:9,fontWeight:700}}>
                                {wp.wp}
                              </span>
                            </td>
                          )}
                          <td style={{...tdSL,background:rowBg,color:"#1e293b",fontWeight:500}}>{it.nama||it.komponen||it.name}</td>
                          <td style={{...tdS,background:rowBg,color:"#94a3b8",fontFamily:"ui-monospace,monospace",fontSize:9}}>{it.kode}</td>
                          <td style={{...tdS,background:rowBg,color:"#475569",fontWeight:600}}>{qty}</td>
                          {prosesPanel.map(pr=>{
                            const pct=cl?.progress?.[pr]??cl?.qtyProses?.[pr]??0;
                            return <ProsesPctCell key={pr} pct={pct} proses={pr} cl={cl} nama={it.nama||it.komponen||it.name}/>;
                          })}
                          {wp===firstRenderedWp&&ii===0&&(
                            <>
                              <td style={{...tdS,fontWeight:700,color:(p.nameplate_progress||0)>=100?"#0891b2":"#94a3b8"}} rowSpan={totalRowsPanel}>{p.nameplate_progress||0}%</td>
                              <td style={{...tdS,fontWeight:700,color:(p.yellowmark_progress||0)>=100?"#ca8a04":"#94a3b8"}} rowSpan={totalRowsPanel}>{p.yellowmark_progress||0}%</td>
                              <td style={{...tdS,fontWeight:700,color:qcStatus==="lolos"?"#16a34a":qcStatus==="gagal"?"#dc2626":"#94a3b8"}} rowSpan={totalRowsPanel}>{qcStatus==="lolos"?"Lolos":qcStatus==="gagal"?"Gagal":"Belum"}</td>
                              <td style={{...tdS,fontWeight:700,color:p.packing_done?"#2563eb":"#94a3b8"}} rowSpan={totalRowsPanel}>{p.packing_done?"Selesai":"Belum"}</td>
                            </>
                          )}
                        </tr>
                      );
                    });
                  });
                  })()}
                  {/* Busbar rows - dari busbar_schedule + busbar_progress */}
                  {(()=>{
                    // Kumpulkan komponen busbar dari raw_schedule busbar_schedule
                    const scheduled=(rawData||[])
                      .filter((r:any)=>r.proses==="BUSBAR"&&Number(r.panel_id||r.panelId)===Number(p.id))
                      .flatMap((r:any)=>Object.values(r.busbar_schedule||{}).flat() as string[]);
                    const fromProgress=Object.keys(p.busbar_progress||{});
                    const busbarKomps=[...new Set([...scheduled,...fromProgress])];
                    if(!busbarKomps.length) return null;
                    const busbarData=Object.fromEntries(busbarKomps.map((k:string)=>
                      [k,(p.busbar_progress||{})[k]||0]
                    ));
                    return(
                    <>
                      <tr>
                        <td colSpan={4+prosesPanel.length} style={{background:"#06b6d418",padding:"4px 10px",
                          borderBottom:"1px solid #e2e8f0",borderTop:"2px solid #06b6d4"}}>
                          <span style={{fontWeight:700,fontSize:10,color:"#06b6d4",
                            textTransform:"uppercase" as const,letterSpacing:.5}}>
                            🔌 Komponen Busbar
                          </span>
                        </td>
                      </tr>
                      {Object.entries(busbarData).map(([nama,pct]:any)=>(
                        <tr key={"busbar-"+nama}>
                          <td style={{...tdS,background:"#f0fdfe"}}></td>
                          <td style={{...tdSL,background:"#f0fdfe",color:"#0e7490",fontWeight:600}}>{nama}</td>
                          <td style={{...tdS,background:"#f0fdfe",color:"#94a3b8",fontSize:9}}>BUSBAR</td>
                          <td style={{...tdS,background:"#f0fdfe"}}>—</td>
                          {prosesPanel.map(pr=>{
                            if(pr!=="BUSBAR") return <td key={pr} style={{...tdS,background:"#f0fdfe",color:"#e2e8f0",fontSize:9}}>—</td>;
                            const isDone=pct>=100;
                            const color=PROSES_COLOR["BUSBAR"]||"#06b6d4";
                            return(
                              <td key={pr} style={{...tdS,background:"#f0fdfe"}} className="hist-cell">
                                <div style={{display:"flex",flexDirection:"column" as const,alignItems:"center",gap:2,position:"relative" as const}}>
                                  <div style={{width:44,height:3,background:"#e2e8f0",borderRadius:99,overflow:"hidden"}}>
                                    <div style={{width:pct+"%",height:"100%",background:isDone?"#16a34a":color,borderRadius:99}}/>
                                  </div>
                                  <span style={{fontSize:9,fontWeight:700,color:isDone?"#16a34a":pct>0?color:"#94a3b8"}}>{pct}%</span>
                                  {pct>0&&(
                                    <div className="hist-tooltip" style={{
                                      opacity:0,visibility:"hidden" as const,
                                      position:"absolute" as const,bottom:"100%",left:"50%",
                                      transform:"translateX(-50%)",
                                      background:"#1e293b",color:"#f1f5f9",
                                      borderRadius:8,padding:"8px 12px",
                                      fontSize:10,whiteSpace:"nowrap" as const,
                                      zIndex:999,marginBottom:6,
                                      boxShadow:"0 4px 16px #00000030",
                                      minWidth:140,
                                    }}>
                                      <div style={{fontWeight:700,color:color,marginBottom:4,borderBottom:"1px solid #334155",paddingBottom:3}}>
                                        {nama}
                                      </div>
                                      <div style={{display:"flex",justifyContent:"space-between",gap:8}}>
                                        <span style={{color:"#94a3b8"}}>Progress</span>
                                        <span style={{color:isDone?"#4ade80":"#fb923c",fontWeight:700}}>{pct}%</span>
                                      </div>
                                      <div style={{position:"absolute" as const,bottom:-5,left:"50%",transform:"translateX(-50%)",width:0,height:0,borderLeft:"5px solid transparent",borderRight:"5px solid transparent",borderTop:"5px solid #1e293b"}}/>
                                    </div>
                                  )}
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </>
                    );
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}
