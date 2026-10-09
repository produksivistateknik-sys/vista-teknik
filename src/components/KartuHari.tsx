// Kartu hari "📋 <tanggal> · N pekerjaan" (klik header tanggal) + status tugas/komponen per proses. DIPINDAH APA
// ADANYA dari RawSchedule.tsx (Tahap 3d migrasi accordion, 10 Okt 2026) supaya tampilan lama & "Raw Schedule per
// WP" sama (CLAUDE.md B.1). Kartu ini baca-saja - distribusi pekerja dilakukan di tab Rencana Harian.
import { useState, useMemo } from 'react'
import { PROSES_COLOR, WP_COLOR, PRIORITAS_COLOR } from '../constants/panelTypes'
import { fmtDateFull } from '../lib/dateHelpers'
import { Card, Badge } from './ui/Primitives'

// Status komponen / tugas (WP di 1 sel) di 1 proses dari panels.checklist.progress - dipakai grid tampilan lama & kartu hari.
export const statusKomponen=(woData:any,panelId,proses,kode)=>{
  const panelData=woData.flatMap(w=>w.panels||[]).find(p=>p.id===panelId);
  if(!panelData)return"belum_mulai";
  const cl=panelData.checklist?.[kode];
  if(!cl)return"belum_mulai";
  const v=cl.progress?.[proses]||0;
  if(v>=100)return"finish";
  if(v>0)return"on_progress";
  return"belum_mulai";
};

export const statusTugas=(woData:any,row,date,wp,komponen)=>{
  const panelId=row.panel_id||row.panelId;
  const panelData=woData.flatMap(w=>w.panels||[]).find(p=>p.id===panelId);
  if(!panelData)return"belum_mulai";
  const proses=row.proses;
  const allDone=komponen.every(kode=>{
    const cl=panelData.checklist?.[kode];
    if(!cl)return false;
    return(cl.progress?.[proses]||0)>=100;
  });
  if(allDone&&komponen.length>0)return"finish";
  const anyStarted=komponen.some(kode=>{
    const cl=panelData.checklist?.[kode];
    if(!cl)return false;
    return(cl.progress?.[proses]||0)>0;
  });
  if(anyStarted)return"on_progress";
  return"belum_mulai";
};

export function useKartuHari({rawData,woData,getEffCfg}:{rawData:any[];woData:any[];getEffCfg:(tipe:string)=>any}){
  const [selDate,setSelDate]=useState(null);
  const [expandedTasks,setExpandedTasks]=useState({});
  const getKomponenStatus=(panelId,proses,kode)=>statusKomponen(woData,panelId,proses,kode);
  const getTaskStatus=(row,date,wp,komponen)=>statusTugas(woData,row,date,wp,komponen);
  const PROSES_MARKER_ONLY=["QC TEST","PACKING"];
  const dateTasks=useMemo(()=>{
    if(!selDate)return[];
    const tasks:any[]=[];
    rawData.forEach(r=>{
      if(PROSES_MARKER_ONLY.includes(r.proses))return; // penanda gak lewat renhar/Rilis-Tarik; NAMEPLATE/YELLOWMARK tetap tampil di Rencana Harian lewat baca raw_schedule langsung (lihat RencanaHarian.tsx)
      // WP biasa dari schedule
      (r.schedule?.[selDate]||[]).forEach((e:any)=>{
        tasks.push({rawId:r.id,woId:r.wo_id||r.woId,panelId:r.panel_id||r.panelId,
          proyek:r.proyek,panel:r.panel,proses:r.proses,prioritas:r.prioritas,
          wp:e.wp,komponen:e.komponen,tanggal:selDate});
      });
      // Busbar dari busbar_schedule
      if(r.proses==="BUSBAR"){
        const busbarItems=r.busbar_schedule?.[selDate]||[];
        if(busbarItems.length>0){
          tasks.push({rawId:r.id,woId:r.wo_id||r.woId,panelId:r.panel_id||r.panelId,
            proyek:r.proyek,panel:r.panel,proses:r.proses,prioritas:r.prioritas,
            wp:"BUSBAR",komponen:busbarItems,tanggal:selDate,isBusbar:true});
        }
      }
    });
    return tasks;
  },[rawData,selDate]);
  const elemen=(
    <>
      {selDate&&(
        <Card style={{marginTop:16,border:"1.5px solid #bfdbfe",background:"#f0f8ff"}} className="su">
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,flexWrap:"wrap",gap:8}}>
            <div>
              <div style={{fontWeight:800,fontSize:15,color:"#1d4ed8"}}>📋 {fmtDateFull(selDate)}</div>
              <div style={{fontSize:12,color:"#64748b",marginTop:2}}>{dateTasks.length} pekerjaan · Distribusi dilakukan di tab Rencana Harian</div>
            </div>
            <button onClick={()=>setSelDate(null)} style={{background:"none",border:"none",cursor:"pointer",color:"#94a3b8",fontSize:20}}>✕</button>
          </div>
          {(()=>{
            const panelGroupMap:Record<string,any[]>={};
            dateTasks.forEach(t=>{
              const gk=`${t.proyek}__${t.panel}__${t.panelId}`;
              if(!panelGroupMap[gk])panelGroupMap[gk]=[];
              panelGroupMap[gk].push(t);
            });
            return Object.entries(panelGroupMap).map(([gk,tasks],gi)=>{
              const t0=tasks[0];
              const cardKey=`panelcard__${gk}__${selDate}`;
              const isExpanded=expandedTasks[cardKey];
              const panelData=woData.flatMap(w=>w.panels||[]).find(p=>p.id===t0.panelId);
              const cfg2=panelData?getEffCfg(panelData.tipe):null;
              const allSt=tasks.map(t=>getTaskStatus(t,t.tanggal,t.wp,t.komponen));
              const overallSt=allSt.every(s=>s==="finish")?"finish":allSt.some(s=>s==="on_progress"||s==="finish")?"on_progress":"belum_mulai";
              const stColor=overallSt==="finish"?"#16a34a":overallSt==="on_progress"?"#f59e0b":"#64748b";
              const stLabel=overallSt==="finish"?"✓ Finish":overallSt==="on_progress"?"● On Progress":"○ Belum Mulai";
              return(
                <div key={gi} onClick={()=>setExpandedTasks(prev=>({...prev,[cardKey]:!prev[cardKey]}))} style={{padding:"10px 14px",borderRadius:10,marginBottom:8,background:"#fff",border:`1.5px solid ${stColor}40`,cursor:"pointer",userSelect:"none" as "none"}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                    <div style={{flex:1,minWidth:160}}>
                      <div style={{fontWeight:700,fontSize:13,color:"#1e293b"}}>{t0.proyek}</div>
                      <div style={{fontSize:11,color:"#64748b"}}>{t0.panel}</div>
                    </div>
                    <div style={{display:"flex",gap:4,flexWrap:"wrap",alignItems:"center"}}>
                      {tasks.map((t,ti)=>{
                        const pc=PROSES_COLOR[t.proses]||"#475569";
                        const wc=WP_COLOR[t.wp]||"#64748b";
                        const tSt=getTaskStatus(t,t.tanggal,t.wp,t.komponen);
                        const tDot=tSt==="finish"?"#16a34a":tSt==="on_progress"?"#f59e0b":"#94a3b8";
                        return(
                          <span key={ti} style={{display:"inline-flex",gap:3,alignItems:"center",background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:6,padding:"2px 7px"}}>
                            <span style={{width:6,height:6,borderRadius:"50%",background:tDot,flexShrink:0}}/>
                            <Badge label={t.proses} color={pc}/>
                            <span style={{background:wc,color:"#fff",borderRadius:4,padding:"1px 6px",fontSize:10,fontWeight:700}}>{t.wp}</span>
                          </span>
                        );
                      })}
                      <Badge label={t0.prioritas||"Sedang"} color={PRIORITAS_COLOR[t0.prioritas]||"#64748b"}/>
                      <span style={{fontSize:11,fontWeight:700,color:stColor,whiteSpace:"nowrap"}}>{stLabel}</span>
                    </div>
                    <span style={{color:"#94a3b8",fontSize:14,flexShrink:0,marginLeft:4}}>{isExpanded?"▲":"▼"}</span>
                  </div>
                  {isExpanded&&(
                    <div style={{marginTop:10,paddingTop:10,borderTop:"1px dashed #e2e8f0",display:"flex",flexDirection:"column",gap:8}}>
                      {tasks.map((t,ti)=>{
                        const pc=PROSES_COLOR[t.proses]||"#475569";
                        const wc=WP_COLOR[t.wp]||"#64748b";
                        const tSt=getTaskStatus(t,t.tanggal,t.wp,t.komponen);
                        const tColor=tSt==="finish"?"#16a34a":tSt==="on_progress"?"#f59e0b":"#64748b";
                        const tLabel=tSt==="finish"?"✓ Finish":tSt==="on_progress"?"● On Progress":"○ Belum Mulai";
                        const grp:{finish:any[],on_progress:any[],belum_mulai:any[]}={finish:[],on_progress:[],belum_mulai:[]};
                        t.komponen.forEach(k=>{
                          const s=getKomponenStatus(t.panelId,t.proses,k);
                          const item=cfg2?.wps.flatMap(w=>w.items).find(it=>it.kode===k);
                          grp[s as keyof typeof grp].push({kode:k,nama:item?.nama||k});
                        });
                        const stGroups=[
                          {key:"finish",label:"✓ Finish",color:"#16a34a",bg:"#f0fdf4",border:"#bbf7d0"},
                          {key:"on_progress",label:"● On Progress",color:"#f59e0b",bg:"#fffbeb",border:"#fde68a"},
                          {key:"belum_mulai",label:"○ Belum Mulai",color:"#64748b",bg:"#f8fafc",border:"#e2e8f0"},
                        ];
                        return(
                          <div key={ti} style={{background:"#f8fafc",borderRadius:8,padding:"8px 12px",border:`1px solid ${tColor}30`}}>
                            <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6,flexWrap:"wrap"}}>
                              <Badge label={t.proses} color={pc}/>
                              <span style={{background:wc,color:"#fff",borderRadius:5,padding:"2px 8px",fontSize:11,fontWeight:700}}>{t.wp}</span>
                              <span style={{fontSize:11,fontWeight:700,color:tColor}}>{tLabel}</span>
                            </div>
                            <div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:4}}>
                              {t.komponen.map(k=>{const item=cfg2?.wps.flatMap(w=>w.items).find(it=>it.kode===k);return <span key={k} style={{background:"#e2e8f0",borderRadius:4,padding:"2px 8px",fontSize:10,color:"#475569",fontWeight:600}}>{item?.nama||k}</span>;})}
                            </div>
                            <div style={{display:"flex",flexDirection:"column",gap:4}}>
                              {stGroups.filter(g=>grp[g.key as keyof typeof grp].length>0).map(g=>(
                                <div key={g.key} style={{background:g.bg,border:`1px solid ${g.border}`,borderRadius:6,padding:"6px 10px"}}>
                                  <div style={{fontWeight:800,fontSize:10,color:g.color,marginBottom:4,letterSpacing:.3}}>{g.label} ({grp[g.key as keyof typeof grp].length})</div>
                                  <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                                    {grp[g.key as keyof typeof grp].map(it=>(<span key={it.kode} style={{background:"#fff",border:`1px solid ${g.border}`,borderRadius:5,padding:"2px 8px",fontSize:10,fontWeight:600,color:"#475569"}}>{it.nama}</span>))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            });
          })()}
        </Card>
      )}
    </>
  );
  return{selDate,setSelDate,dateTasks,elemen};
}
