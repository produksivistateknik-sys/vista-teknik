import { useState } from 'react'
import { PANEL_TYPES, ALL_PROSES } from '../constants/panelTypes'
import { isKomponenRelevant } from '../lib/panelHelpers'
import { Card, Lbl, Sel } from './ui/Primitives'

export function TaskMonitoring({woData,livePanelTypes}:{woData:any[],livePanelTypes?:any}){
  const getEffCfg=(tipe:string)=>(livePanelTypes?.[tipe]?.wps?.length>0)?livePanelTypes[tipe]:(PANEL_TYPES as any)[tipe];
  const [selectedWoId,setSelectedWoId]=useState<number|null>(null);
  const [selectedPanelId,setSelectedPanelId]=useState<number|null>(null);

  const PROSES_LABEL:Record<string,string>={
    POTONG:"Potong",BENDING:"Bending",STEL:"Stel",FINISHING:"Finishing",RENDAM:"Rendam",PAINTING:"Painting",
    RAKIT:"Rakit","PASANG KOMPONEN":"Pasang Komponen",
    BUSBAR:"Busbar","WIRING CONTROL":"Wiring Control","WIRING POWER":"Wiring Power",
    "QC TEST":"QC Test",PACKING:"Packing",
  };

  const selectedWo=woData.find((w:any)=>w.id===selectedWoId);
  const panelList=selectedWo?.panels||[];
  const selectedPanel=panelList.find((p:any)=>p.id===selectedPanelId);
  const cfg=selectedPanel?getEffCfg(selectedPanel.tipe):null;

  const getStatus=(kode:string,prosesIdx:number):{status:string;pct:number}|null=>{
    if(!selectedPanel)return null;
    const qty=selectedPanel.checklist?.[kode]?.qty||0;
    if(qty<=0)return null;
    const proses=ALL_PROSES[prosesIdx];
    if(!isKomponenRelevant(kode,selectedPanel.tipe,proses))return null;
    const progress=selectedPanel.checklist?.[kode]?.progress?.[proses]||0;
    if(progress>=100)return{status:"DONE",pct:100};
    if(prosesIdx===0){
      return progress>0?{status:"IN PROGRESS",pct:progress}:{status:"TO DO",pct:0};
    }
    const prosesSebelumnya=ALL_PROSES[prosesIdx-1];
    const progressSebelumnya=selectedPanel.checklist?.[kode]?.progress?.[prosesSebelumnya]||0;
    if(progressSebelumnya<100)return{status:"NOT YET",pct:0};
    return progress>0?{status:"IN PROGRESS",pct:progress}:{status:"TO DO",pct:0};
  };

  const statusStyle:Record<string,{bg:string;color:string;border:string}>={
    "DONE":{bg:"#f0fdf4",color:"#16a34a",border:"#bbf7d0"},
    "IN PROGRESS":{bg:"#eff6ff",color:"#2563eb",border:"#bfdbfe"},
    "TO DO":{bg:"#fffbeb",color:"#d97706",border:"#fde68a"},
    "NOT YET":{bg:"#fef2f2",color:"#dc2626",border:"#fecaca"},
  };

  const progresTotal=(()=>{
    if(!selectedPanel||!cfg)return 0;
    const allItems=cfg.wps.flatMap((w:any)=>w.items);
    let sum=0,count=0;
    allItems.forEach((it:any)=>{
      const qty=selectedPanel.checklist?.[it.kode]?.qty||0;
      if(qty<=0)return;
      ALL_PROSES.forEach((proses:string)=>{
        const progress=selectedPanel.checklist?.[it.kode]?.progress?.[proses]||0;
        sum+=progress;count++;
      });
    });
    return count>0?(sum/count):0;
  })();

  return(
    <div className="fi">
      <div style={{fontWeight:800,fontSize:20,color:"#0f172a",marginBottom:4}}>Task Monitoring</div>
      <div style={{fontSize:13,fontWeight:600,color:"#475569",marginBottom:16}}>Monitoring status estafet per komponen per panel</div>

      <Card style={{marginBottom:16}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <div>
            <Lbl>Pilih Work Order</Lbl>
            <Sel value={selectedWoId??""} onChange={(e:any)=>{setSelectedWoId(e.target.value?Number(e.target.value):null);setSelectedPanelId(null);}}>
              <option value="">-- Pilih Work Order --</option>
              {woData.map((w:any)=>(
                <option key={w.id} value={w.id}>{w.wo} — {w.proyek}</option>
              ))}
            </Sel>
          </div>
          <div>
            <Lbl>Pilih Panel</Lbl>
            <Sel value={selectedPanelId??""} onChange={(e:any)=>setSelectedPanelId(e.target.value?Number(e.target.value):null)} disabled={!selectedWoId}>
              <option value="">-- Pilih Panel --</option>
              {panelList.map((p:any)=>(
                <option key={p.id} value={p.id}>#{p.noPnl||p.no_pnl} {p.nama}</option>
              ))}
            </Sel>
          </div>
        </div>
      </Card>

      {selectedPanel&&cfg&&(
        <>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:16}}>
            <Card>
              <div style={{fontSize:10,fontWeight:700,color:"#94a3b8",textTransform:"uppercase" as const}}>Proyek</div>
              <div style={{fontSize:14,fontWeight:800,color:"#0f172a",marginTop:2}}>{selectedWo.proyek}</div>
            </Card>
            <Card>
              <div style={{fontSize:10,fontWeight:700,color:"#94a3b8",textTransform:"uppercase" as const}}>Nama Panel</div>
              <div style={{fontSize:14,fontWeight:800,color:"#0f172a",marginTop:2}}>{selectedPanel.nama}</div>
            </Card>
            <Card>
              <div style={{fontSize:10,fontWeight:700,color:"#94a3b8",textTransform:"uppercase" as const}}>Target</div>
              <div style={{fontSize:14,fontWeight:800,color:"#0f172a",marginTop:2}}>{selectedWo.target||"-"}</div>
            </Card>
            <Card style={{background:"#eff6ff",border:"1px solid #bfdbfe"}}>
              <div style={{fontSize:10,fontWeight:700,color:"#2563eb",textTransform:"uppercase" as const}}>Progres Total</div>
              <div style={{fontSize:16,fontWeight:800,color:"#1d4ed8",marginTop:2}}>{progresTotal.toFixed(1)}%</div>
            </Card>
          </div>

          <div style={{overflowX:"auto" as const,border:"1px solid #e2e8f0",borderRadius:10}}>
            <table style={{borderCollapse:"collapse" as const,fontSize:11,minWidth:900,width:"100%"}}>
              <thead>
                <tr style={{background:"#1e3a5f"}}>
                  <th style={{padding:"7px 10px",color:"#fff",textAlign:"left" as const,position:"sticky" as const,left:0,background:"#1e3a5f",minWidth:160,zIndex:1,fontSize:9,textTransform:"uppercase" as const,letterSpacing:.3,fontWeight:600,borderRight:"1px solid rgba(255,255,255,.1)"}}>Komponen</th>
                  {ALL_PROSES.map((proses:string)=>(
                    <th key={proses} style={{padding:"7px 10px",color:"#fff",minWidth:90,fontWeight:600,fontSize:9,textTransform:"uppercase" as const,letterSpacing:.3,borderRight:"1px solid rgba(255,255,255,.1)"}}>{PROSES_LABEL[proses]||proses}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cfg.wps.flatMap((wp:any)=>wp.items).map((item:any,ii:number)=>{
                  const qty=selectedPanel.checklist?.[item.kode]?.qty||0;
                  if(qty<=0)return null;
                  return(
                    <tr key={item.kode}>
                      <td style={{padding:"6px 10px",fontWeight:600,color:"#1e293b",background:ii%2===0?"#fff":"#f8fafc",position:"sticky" as const,left:0}}>{item.nama}</td>
                      {ALL_PROSES.map((proses:string,prosesIdx:number)=>{
                        const st=getStatus(item.kode,prosesIdx);
                        return(
                          <td key={proses} style={{padding:4,textAlign:"center" as const,background:ii%2===0?"#fff":"#f8fafc"}}>
                            {st&&(
                              <span style={{background:statusStyle[st.status].bg,color:statusStyle[st.status].color,border:`1px solid ${statusStyle[st.status].border}`,padding:"3px 9px",borderRadius:5,fontWeight:700,fontSize:10,whiteSpace:"nowrap" as const}}>
                                {st.status==="IN PROGRESS"?`IN PROGRESS ${st.pct}%`:st.status}
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div style={{display:"flex",gap:16,marginTop:10,fontSize:11,color:"#64748b",flexWrap:"wrap" as const}}>
            <div style={{display:"flex",alignItems:"center",gap:4}}><span style={{width:10,height:10,borderRadius:2,background:"#166534",display:"inline-block"}}/>Done</div>
            <div style={{display:"flex",alignItems:"center",gap:4}}><span style={{width:10,height:10,borderRadius:2,background:"#16a34a",display:"inline-block"}}/>In progress</div>
            <div style={{display:"flex",alignItems:"center",gap:4}}><span style={{width:10,height:10,borderRadius:2,background:"#fbbf24",display:"inline-block"}}/>To do</div>
            <div style={{display:"flex",alignItems:"center",gap:4}}><span style={{width:10,height:10,borderRadius:2,background:"#ef4444",display:"inline-block"}}/>Not yet</div>
            <div style={{display:"flex",alignItems:"center",gap:4}}><span style={{width:10,height:10,borderRadius:2,background:"#fff",border:"1px solid #e2e8f0",display:"inline-block"}}/>Qty 0 (tidak ditampilkan)</div>
          </div>
        </>
      )}
    </div>
  );
}
