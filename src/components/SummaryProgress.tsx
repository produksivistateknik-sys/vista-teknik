import { useState } from 'react'
import { woOverall, panelOverall, calcPanelProgress } from '../lib/panelHelpers'
import { isDelayed, isUrgent, daysUntil } from '../lib/dateHelpers'
import { PROSES_COLOR } from '../constants/panelTypes'

export function SummaryProgress({woData}:{woData:any[]}){
  const [search,setSearch]=useState("");
  const [statusFilter,setStatusFilter]=useState<string[]>([]);

  const PROSES_LIST=["POTONG","BENDING","STEL","RENDAM","PAINTING","RAKIT","PASANG KOMPONEN","BUSBAR","WIRING CONTROL","WIRING POWER","QC TEST","PACKING"];

  const filtered=woData.filter(w=>{
    const pct=woOverall(w);
    const s=pct===100?"selesai":isDelayed(w.target)?"terlambat":isUrgent(w.target)?"mendesak":"ontrack";
    const matchS=statusFilter.length===0||statusFilter.includes(s);
    const matchQ=!search||(w.wo||"").toLowerCase().includes(search.toLowerCase())||(w.proyek||"").toLowerCase().includes(search.toLowerCase())||(w.panels||[]).some((p:any)=>(p.nama||"").toLowerCase().includes(search.toLowerCase()));
    return matchS&&matchQ;
  });

  const thS={background:"#1e3a5f",color:"#fff",fontWeight:600,padding:"7px 10px",
    textAlign:"center" as const,fontSize:9,textTransform:"uppercase" as const,
    letterSpacing:.3,borderBottom:"1px solid #1e3a5f",whiteSpace:"nowrap" as const,
    borderRight:"1px solid rgba(255,255,255,.1)"};
  const thSL={...thS,textAlign:"left" as const};
  const tdS={padding:"7px 10px",borderBottom:"1px solid #f5f7fa",
    color:"#374151",verticalAlign:"middle" as const,fontSize:11,
    borderRight:"1px solid #f5f7fa",textAlign:"center" as const};
  const tdSL={...tdS,textAlign:"left" as const};

  if(!woData.length) return(
    <div style={{textAlign:"center",padding:"60px 20px",color:"#94a3b8"}}>
      <div style={{fontSize:40,marginBottom:12}}>📊</div>
      <div style={{fontSize:14,fontWeight:600,color:"#1e293b"}}>Belum ada data</div>
    </div>
  );

  const totalPanel=woData.reduce((a,w)=>a+(w.panels||[]).length,0);
  const avgOverall=woData.length?Math.round(woData.reduce((a,w)=>a+woOverall(w),0)/woData.length):0;
  const selesai=woData.filter(w=>woOverall(w)===100).length;
  const mendesak=woData.filter(w=>woOverall(w)<100&&isUrgent(w.target)&&!isDelayed(w.target)).length;
  const terlambat=woData.filter(w=>isDelayed(w.target)&&woOverall(w)<100).length;
  const allPanelsForNp=woData.flatMap((w:any)=>w.panels||[]);
  const belumNameplate=allPanelsForNp.filter((p:any)=>(p.nameplate_progress||0)<100).length;
  const belumYellowmark=allPanelsForNp.filter((p:any)=>(p.yellowmark_progress||0)<100).length;

  const ProsesPctCell=({pct,proses}:{pct:number|undefined,proses:string})=>{
    if(pct===undefined||pct===null) return <td style={{...tdS,color:"#e2e8f0",fontSize:9}}>—</td>;
    const color=(PROSES_COLOR as any)[proses]||"#94a3b8";
    return(
      <td style={tdS}>
        <div style={{display:"flex",flexDirection:"column" as const,alignItems:"center",gap:2}}>
          <div style={{width:44,height:4,background:"#e2e8f0",borderRadius:99,overflow:"hidden"}}>
            <div style={{width:pct+"%",height:"100%",background:color,borderRadius:99}}/>
          </div>
          <span style={{fontSize:9,fontWeight:700,color:pct===100?"#16a34a":pct>0?color:"#94a3b8"}}>{pct}%</span>
        </div>
      </td>
    );
  };

  return(
    <div style={{display:"flex",flexDirection:"column",gap:10}}>

      {/* Stat row */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:8}}>
        {[
          {n:totalPanel,l:"Total Panel",c:"#2563eb",bc:"#2563eb"},
          {n:avgOverall+"%",l:"Avg Overall",c:avgOverall>=70?"#16a34a":avgOverall>=40?"#d97706":"#dc2626",bc:avgOverall>=70?"#16a34a":avgOverall>=40?"#d97706":"#dc2626"},
          {n:selesai,l:"Selesai",c:"#16a34a",bc:"#16a34a"},
          {n:mendesak,l:"Mendesak H-7",c:"#d97706",bc:"#d97706"},
          {n:terlambat,l:"Terlambat",c:"#dc2626",bc:"#dc2626"},
          {n:belumNameplate,l:"Belum Nameplate",c:"#0891b2",bc:"#0891b2"},
          {n:belumYellowmark,l:"Belum Yellowmark",c:"#ca8a04",bc:"#ca8a04"},
        ].map((s,i)=>(
          <div key={i} style={{background:"var(--card-bg,#fff)",border:"1px solid var(--border-color,#eaecf0)",borderTop:"3px solid "+s.bc,borderRadius:8,padding:"10px 13px",textAlign:"center" as const}}>
            <div style={{fontSize:20,fontWeight:700,color:s.c}}>{s.n}</div>
            <div style={{fontSize:9,color:"#94a3b8",marginTop:3,fontWeight:500,textTransform:"uppercase" as const,letterSpacing:.3}}>{s.l}</div>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div style={{background:"var(--card-bg,#fff)",border:"1px solid var(--border-color,#eaecf0)",borderRadius:8,padding:"10px 13px",display:"flex",alignItems:"center",gap:8,flexWrap:"wrap" as const}}>
        <input placeholder="🔍 Cari WO / proyek / panel..."
          value={search} onChange={e=>setSearch(e.target.value)}
          style={{height:28,border:"1px solid #e2e8f0",borderRadius:5,padding:"0 10px",
            fontSize:11,background:"var(--input-bg,#f8fafc)",outline:"none",color:"var(--text-primary,#1e293b)",
            fontFamily:"inherit",flex:1,minWidth:180}}/>
        <div style={{display:"flex",gap:4,flexWrap:"wrap" as const,alignItems:"center"}}>
          {[
            {v:"ontrack",l:"● On Track",c:"#2563eb",bg:"#eff6ff"},
            {v:"mendesak",l:"● Mendesak H-7",c:"#d97706",bg:"#fffbeb"},
            {v:"terlambat",l:"● Terlambat",c:"#dc2626",bg:"#fef2f2"},
            {v:"selesai",l:"✓ Selesai",c:"#16a34a",bg:"#f0fdf4"},
          ].map(f=>{
            const on=statusFilter.includes(f.v);
            return(
              <button key={f.v} onClick={()=>setStatusFilter((prev:string[])=>on?prev.filter(x=>x!==f.v):[...prev,f.v])}
                style={{border:`1.5px solid ${on?f.c:"#e2e8f0"}`,
                  background:on?f.bg:"#fff",color:on?f.c:"#64748b",
                  borderRadius:20,padding:"3px 10px",fontSize:10,fontWeight:on?700:400,
                  cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:4}}>
                {on&&<span style={{width:5,height:5,borderRadius:"50%",background:f.c}}/>}
                {f.l}
              </button>
            );
          })}
          {statusFilter.length>0&&(
            <button onClick={()=>setStatusFilter([])}
              style={{border:"1px solid #fecaca",background:"#fef2f2",color:"#dc2626",
                borderRadius:20,padding:"3px 10px",fontSize:10,cursor:"pointer",fontFamily:"inherit"}}>
              ✕ Reset
            </button>
          )}
        </div>
        <span style={{fontSize:10,color:"#94a3b8",marginLeft:"auto"}}>{filtered.reduce((a,w)=>a+(w.panels||[]).length,0)} panel · {filtered.length} WO</span>
        <span style={{fontSize:10,color:"#94a3b8",padding:"2px 8px",background:"var(--bg-tertiary,#f1f5f9)",borderRadius:5}}>👁 Read-only</span>
      </div>

      {/* Table per WO */}
      {filtered.length===0&&(
        <div style={{background:"var(--card-bg,#fff)",border:"1px solid var(--border-color,#eaecf0)",borderRadius:8,padding:"40px",textAlign:"center" as const,color:"#94a3b8"}}>
          Tidak ada data yang sesuai filter
        </div>
      )}

      {filtered.map(wo=>{
        const pct=woOverall(wo);
        const d=daysUntil(wo.target);
        const late=isDelayed(wo.target);
        const urg=isUrgent(wo.target);
        const done=pct===100;
        const statusLabel=done?"Selesai":late?"Terlambat":urg?"Mendesak H-7":"On Track";
        const statusColor=done?"#16a34a":late?"#dc2626":urg?"#d97706":"#2563eb";
        const statusBg=done?"#f0fdf4":late?"#fef2f2":urg?"#fffbeb":"#eff6ff";
        const pbColor=done?"#16a34a":pct>=70?"#16a34a":pct>=40?"#d97706":"#dc2626";
        const borderColor=done?"#16a34a":late?"#dc2626":urg?"#d97706":"#e2e8f0";
        const panels=wo.panels||[];

        // Gunakan calcPanelProgress untuk dapat data proses
        const panelProgressData=panels.map((p:any)=>calcPanelProgress(p));

        // Proses yang ada data (pct > 0 atau ada di salah satu panel)
        const prosesAda=PROSES_LIST.filter(pr=>
          pr!=="QC TEST"&&pr!=="PACKING"&&panelProgressData.some((pd:any)=>pd[pr]!==undefined)
        );

        // Rata-rata per proses
        const rataProses=(pr:string)=>{
          const vals=panelProgressData.map((pd:any)=>pd[pr]).filter((v:any)=>v!==undefined) as number[];
          if(!vals.length) return undefined;
          return Math.round(vals.reduce((a:number,v:number)=>a+v,0)/vals.length);
        };

        return(
          <div key={wo.id} style={{background:"var(--card-bg,#fff)",border:"1px solid var(--border-color,#eaecf0)",
            borderRadius:8,overflow:"hidden",borderLeft:"3px solid "+borderColor}}>

            {/* WO Header */}
            <div style={{padding:"9px 13px",borderBottom:"1px solid #eaecf0",
              display:"flex",alignItems:"center",gap:10,flexWrap:"wrap" as const,background:"var(--bg-secondary,#fafbfc)"}}>
              <span style={{color:"#2563eb",fontWeight:800,fontFamily:"ui-monospace,monospace",fontSize:12}}>WO {wo.wo}</span>
              <span style={{fontWeight:700,color:"var(--text-primary,#1e293b)",fontSize:13}}>{wo.proyek}</span>
              <span style={{fontSize:11,color:"#94a3b8"}}>📅 {wo.target}</span>
              {!done&&<span style={{fontSize:11,fontWeight:600,color:late?"#dc2626":urg?"#d97706":"#16a34a"}}>
                {late?"Terlambat "+Math.abs(d)+" hari":urg?"H-"+d+" Mendesak":"H-"+d}
              </span>}
              <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:8}}>
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  <div style={{width:100,height:5,background:"#e2e8f0",borderRadius:99,overflow:"hidden"}}>
                    <div style={{width:pct+"%",height:"100%",background:pbColor,borderRadius:99}}/>
                  </div>
                  <span style={{fontSize:12,fontWeight:800,color:pbColor}}>{pct}%</span>
                </div>
                <span style={{background:statusBg,color:statusColor,borderRadius:4,
                  padding:"2px 8px",fontSize:10,fontWeight:600}}>{statusLabel}</span>
              </div>
            </div>

            {/* Panel table */}
            {panels.length>0&&(
              <div style={{overflowX:"auto" as const}}>
                <table style={{width:"100%",borderCollapse:"collapse"}}>
                  <thead>
                    <tr>
                      <th style={{...thSL,minWidth:55}}>WO</th>
                      <th style={{...thSL,minWidth:80}}>Proyek</th>
                      <th style={{...thS,minWidth:35}}>H-</th>
                      <th style={{...thSL,minWidth:130}}>Nama Panel</th>
                      <th style={{...thS,minWidth:45}}>Tipe</th>
                      <th style={{...thS,minWidth:35}}>Qty</th>
                      <th style={{...thS,minWidth:60}}>Overall</th>
                      <th style={{...thS,minWidth:65}}>Status</th>
                      {prosesAda.map(pr=>(
                        <th key={pr} style={{...thS,minWidth:65,borderTop:"3px solid "+((PROSES_COLOR as any)[pr]||"#94a3b8")}}>
                          {pr}
                        </th>
                      ))}
                      <th style={{...thS,minWidth:65,borderTop:"3px solid #0891b2"}}>NAMEPLATE</th>
                      <th style={{...thS,minWidth:65,borderTop:"3px solid #ca8a04"}}>YELLOWMARK</th>
                      <th style={{...thS,minWidth:55,borderTop:"3px solid #16a34a"}}>QC</th>
                      <th style={{...thS,minWidth:55,borderTop:"3px solid #2563eb"}}>PACKING</th>
                    </tr>
                  </thead>
                  <tbody>
                    {panels.map((p:any,pi:number)=>{
                      const pd=panelProgressData[pi];
                      const ppct=panelOverall(p);
                      const pc=ppct===100?"#16a34a":ppct>=70?"#16a34a":ppct>=40?"#d97706":"#dc2626";
                      const ps=ppct===100?"Selesai":ppct>=70?"On Track":ppct>=40?"On Track":"On Track";
                      const pbg=ppct===100?"#f0fdf4":"#eff6ff";
                      const psc=ppct===100?"#16a34a":"#2563eb";
                      return(
                        <tr key={pi}>
                          <td style={{...tdSL,color:"#2563eb",fontWeight:700,fontFamily:"ui-monospace,monospace",fontSize:10}}>{wo.wo}</td>
                          <td style={{...tdSL,color:"#475569",fontSize:10}}>{wo.proyek}</td>
                          <td style={{...tdS,fontWeight:600,color:late?"#dc2626":urg?"#d97706":"#16a34a",fontSize:10}}>
                            {late?"−"+Math.abs(d):d}
                          </td>
                          <td style={{...tdSL,fontWeight:500,color:"#1e293b"}}># {p.nama||p.name||"Panel "+(pi+1)}</td>
                          <td style={tdS}>
                            {p.tipe&&<span style={{background:"#eff6ff",color:"#2563eb",borderRadius:20,padding:"1px 7px",fontSize:9,fontWeight:600}}>{p.tipe}</span>}
                          </td>
                          <td style={tdS}>{p.qty||1}</td>
                          <td style={tdS}>
                            <div style={{display:"flex",flexDirection:"column" as const,alignItems:"center",gap:2}}>
                              <div style={{width:44,height:4,background:"#e2e8f0",borderRadius:99,overflow:"hidden"}}>
                                <div style={{width:ppct+"%",height:"100%",background:pc,borderRadius:99}}/>
                              </div>
                              <span style={{fontSize:9,fontWeight:700,color:pc}}>{ppct}%</span>
                            </div>
                          </td>
                          <td style={tdS}>
                            <span style={{background:pbg,color:psc,borderRadius:4,padding:"1px 6px",fontSize:9,fontWeight:600}}>{ps}</span>
                          </td>
                          {prosesAda.map(pr=><ProsesPctCell key={pr} pct={pd[pr]} proses={pr}/>)}
                          {(()=>{
                            const qcCl=p.qc_checklist||{};
                            const qcStatuses=["fisik","spesifikasi","baut","test"].map((k:string)=>qcCl[k]?.status||"to_do");
                            const qcStatus=qcStatuses.every((s:string)=>s==="complete")?"complete":qcStatuses.some((s:string)=>s==="in_progress"||s==="complete")?"in_progress":"to_do";
                            return(
                              <>
                                <td style={{...tdS,fontWeight:700,color:(p.nameplate_progress||0)>=100?"#0891b2":"#94a3b8"}}>{p.nameplate_progress||0}%</td>
                                <td style={{...tdS,fontWeight:700,color:(p.yellowmark_progress||0)>=100?"#ca8a04":"#94a3b8"}}>{p.yellowmark_progress||0}%</td>
                                <td style={{...tdS,fontWeight:700,color:qcStatus==="complete"?"#16a34a":qcStatus==="in_progress"?"#ea580c":"#94a3b8",fontSize:9}}>{qcStatus==="complete"?"Selesai":qcStatus==="in_progress"?"Proses":"To Do"}</td>
                                <td style={{...tdS,fontWeight:700,color:p.packing_done?"#2563eb":"#94a3b8",fontSize:9}}>{p.packing_done?"Selesai":"Belum"}</td>
                              </>
                            );
                          })()}
                        </tr>
                      );
                    })}
                    {/* Rata-rata row */}
                    <tr style={{background:"#f8fafc"}}>
                      <td colSpan={6} style={{...tdSL,color:"#94a3b8",fontSize:10,fontStyle:"italic" as const}}>Rata-rata ({panels.length} panel)</td>
                      <td style={tdS}>
                        <div style={{display:"flex",flexDirection:"column" as const,alignItems:"center",gap:2}}>
                          <div style={{width:44,height:4,background:"#e2e8f0",borderRadius:99,overflow:"hidden"}}>
                            <div style={{width:pct+"%",height:"100%",background:pbColor,borderRadius:99}}/>
                          </div>
                          <span style={{fontSize:9,fontWeight:700,color:pbColor}}>{pct}%</span>
                        </div>
                      </td>
                      <td style={tdS}/>
                      {prosesAda.map(pr=>{
                        const r=rataProses(pr);
                        const color=(PROSES_COLOR as any)[pr]||"#94a3b8";
                        return <ProsesPctCell key={pr} pct={r} proses={pr}/>;
                      })}
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
