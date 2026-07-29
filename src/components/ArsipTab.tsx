import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { activityLogService } from '../services/activityLogService'
import { Modal } from './ui/Primitives'
import { FotoZoomViewer } from './FotoZoomViewer'

const QC_STATUS_LABEL:Record<string,{label:string,color:string,bg:string}>={
  to_do:{label:"To Do",color:"#64748b",bg:"#f1f5f9"},
  in_progress:{label:"In Progress",color:"#ea580c",bg:"#fff7ed"},
  complete:{label:"Complete",color:"#16a34a",bg:"#f0fdf4"},
};

const QC_ITEMS_ARSIP=[
  {key:"fisik",label:"Pemeriksaan Fisik"},
  {key:"spesifikasi",label:"Verifikasi Spesifikasi Komponen"},
  {key:"baut",label:"Pengecekan Kekencangan Baut"},
  {key:"test",label:"QC Test"},
];

const totalFotoQc=(p:any):number=>{
  const cl=p.qc_checklist||{};
  return QC_ITEMS_ARSIP.reduce((s,item)=>s+((cl[item.key]?.foto||[]).length),0);
};

export function ArsipTab({user,refetchWO}:any){
  const[panelList,setPanelList]=useState<any[]>([]);
  const[loading,setLoading]=useState(true);
  const[search,setSearch]=useState("");
  const[unarsipLoadingId,setUnarsipLoadingId]=useState<number|null>(null);
  const[expandedWo,setExpandedWo]=useState<Record<number,boolean>>({});
  const[woArchivedMap,setWoArchivedMap]=useState<Record<number,boolean>>({});
  const[qcDetailPanel,setQcDetailPanel]=useState<any>(null);
  const[lightbox,setLightbox]=useState<{fotos:any[],index:number,label:string}|null>(null);

  const fetchPanelArsip=async()=>{
    setLoading(true);
    const{data}=await supabase.from("panels_archived").select("*").order("diarsipkan_pada",{ascending:false});
    setPanelList(data??[]);
    setLoading(false);
  };
  useEffect(()=>{fetchPanelArsip();},[]);

  useEffect(()=>{
    const woIds=[...new Set(panelList.map((p:any)=>p.wo_id).filter(Boolean))];
    if(woIds.length===0){setWoArchivedMap({});return;}
    supabase.from("work_orders").select("id,is_archived").in("id",woIds).then(({data}:any)=>{
      const m:Record<number,boolean>={};
      (data??[]).forEach((w:any)=>{m[w.id]=!!w.is_archived;});
      setWoArchivedMap(m);
    });
  },[panelList]);

  const unarsipkan=async(p:any)=>{
    if(!confirm(`Kembalikan panel "${p.nama}" ke tampilan aktif? Semua data (checklist, progress, riwayat timer, QC) dikembalikan utuh.`))return;
    setUnarsipLoadingId(p.id);
    const{error}=await supabase.rpc("unarsip_panel",{p_panel_id:p.id});
    setUnarsipLoadingId(null);
    if(error){alert("Gagal unarchive: "+error.message);return;}
    const sess=JSON.parse(localStorage.getItem("vista_admin_session")||"{}");
    const uname=user?.name||user?.nama||sess?.nama||"Admin";
    await activityLogService.insert({
      user_name:uname,action:"UNARCHIVE PANEL",
      description:"Kembalikan panel "+p.nama+" dari arsip ke WO "+(p.wo_number_snapshot||"")+" - "+(p.proyek_snapshot||""),
      module:"wo",halaman:"Manajemen WO",proyek:p.proyek_snapshot||"",panel:p.nama,wo_number:p.wo_number_snapshot||"",
    });
    setPanelList(prev=>prev.filter((x:any)=>x.id!==p.id));
    if(refetchWO)await refetchWO();
    alert("Panel "+p.nama+" berhasil dikembalikan ke tampilan aktif.");
  };

  const grouped=useMemo(()=>{
    const map:Record<number,{wo_id:number,wo_number:string,proyek:string,panels:any[]}>={};
    panelList.forEach((p:any)=>{
      if(!map[p.wo_id])map[p.wo_id]={wo_id:p.wo_id,wo_number:p.wo_number_snapshot,proyek:p.proyek_snapshot,panels:[]};
      map[p.wo_id].panels.push(p);
    });
    return Object.values(map).sort((a,b)=>{
      const latestA=Math.max(...a.panels.map(p=>new Date(p.diarsipkan_pada).getTime()));
      const latestB=Math.max(...b.panels.map(p=>new Date(p.diarsipkan_pada).getTime()));
      return latestB-latestA;
    });
  },[panelList]);

  const filtered=grouped.filter(g=>
    !search||g.wo_number?.toLowerCase().includes(search.toLowerCase())||g.proyek?.toLowerCase().includes(search.toLowerCase())||
    g.panels.some((p:any)=>p.nama?.toLowerCase().includes(search.toLowerCase()))
  );

  const thS:any={padding:"8px 12px",textAlign:"left",fontSize:10,color:"#64748b",fontWeight:700,background:"#f8fafc"};
  const td:any={padding:"9px 12px",borderTop:"1px solid #f1f5f9",fontSize:12,verticalAlign:"middle"};

  return(
    <div className="fi">
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap" as const,gap:10}}>
        <div>
          <h2 style={{fontSize:18,fontWeight:800,color:"#1e293b",margin:0}}>📦 Arsip</h2>
          <p style={{fontSize:12,color:"#64748b",margin:"4px 0 0"}}>WO yang punya panel diarsipkan - klik untuk lihat rincian panelnya</p>
        </div>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Cari WO/proyek/panel..."
          style={{height:32,padding:"0 12px",border:"1px solid #e2e8f0",borderRadius:8,fontSize:12,width:240,outline:"none",fontFamily:"inherit"}}/>
      </div>

      {loading?(
        <div style={{textAlign:"center",padding:48,color:"#94a3b8"}}>Memuat arsip...</div>
      ):filtered.length===0?(
        <div style={{textAlign:"center",padding:48,color:"#94a3b8",background:"#fff",borderRadius:10,border:"1px solid #e2e8f0"}}>
          <i className="ti ti-archive-off" style={{fontSize:32,display:"block",marginBottom:8}}/>
          Belum ada panel yang diarsipkan
        </div>
      ):(
        <div style={{display:"flex",flexDirection:"column" as const,gap:8}}>
          {filtered.map(g=>{
            const isExp=!!expandedWo[g.wo_id];
            const woPenuh=!!woArchivedMap[g.wo_id];
            return(
              <div key={g.wo_id} style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:10,overflow:"hidden"}}>
                <div onClick={()=>setExpandedWo(prev=>({...prev,[g.wo_id]:!prev[g.wo_id]}))}
                  style={{display:"flex",alignItems:"center",gap:10,padding:"12px 16px",cursor:"pointer",background:isExp?"#f8faff":"#fff"}}>
                  <span style={{fontSize:12,color:"#94a3b8"}}>{isExp?"▼":"▶"}</span>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:700,fontSize:13,color:"#1e293b"}}>WO {g.wo_number} — {g.proyek}</div>
                    <div style={{fontSize:11,color:"#64748b",marginTop:2}}>{g.panels.length} panel diarsipkan</div>
                  </div>
                  <span style={{background:woPenuh?"#fef2f2":"#fffbeb",color:woPenuh?"#dc2626":"#d97706",
                    border:`1px solid ${woPenuh?"#fecaca":"#fde68a"}`,borderRadius:20,padding:"3px 10px",fontSize:10,fontWeight:700,whiteSpace:"nowrap" as const}}>
                    {woPenuh?"📦 Diarsipkan Penuh":"⚠ Sebagian Diarsip - WO masih aktif"}
                  </span>
                </div>
                {isExp&&(
                  <div style={{overflowX:"auto",borderTop:"1px solid #e2e8f0"}}>
                    <table style={{width:"100%",borderCollapse:"collapse"}}>
                      <thead><tr>
                        <th style={thS}>Nama Panel</th>
                        <th style={{...thS,textAlign:"center"}}>Progress</th>
                        <th style={{...thS,textAlign:"center"}}>QC</th>
                        <th style={thS}>Diarsipkan</th>
                        <th style={{...thS,textAlign:"center"}}>Aksi</th>
                      </tr></thead>
                      <tbody>
                        {g.panels.map((p:any,i:number)=>{
                          const qc=p.qc_checklist?._global?.status||"to_do";
                          const qcInfo=QC_STATUS_LABEL[qc]||QC_STATUS_LABEL.to_do;
                          const fotoCount=totalFotoQc(p);
                          return(
                            <tr key={p.id} style={{background:i%2===0?"#fff":"#f8fafc"}}>
                              <td style={{...td,fontWeight:700,color:"#1e293b"}}>{p.nama}</td>
                              <td style={{...td,textAlign:"center",fontWeight:800,color:"#1d4ed8"}}>{p.progress_snapshot??0}%</td>
                              <td style={{...td,textAlign:"center"}}>
                                <button onClick={()=>setQcDetailPanel(p)}
                                  style={{background:"none",border:"none",cursor:"pointer",display:"inline-flex",flexDirection:"column" as const,alignItems:"center",gap:2}}>
                                  <span style={{background:qcInfo.bg,color:qcInfo.color,borderRadius:20,padding:"2px 9px",fontSize:10,fontWeight:700}}>{qcInfo.label}</span>
                                  <span style={{fontSize:9,color:"#94a3b8",textDecoration:"underline"}}>📷 {fotoCount} foto</span>
                                </button>
                              </td>
                              <td style={{...td,color:"#94a3b8",fontSize:11}}>{p.diarsipkan_oleh} · {p.diarsipkan_pada?new Date(p.diarsipkan_pada).toLocaleDateString("id-ID"):"—"}</td>
                              <td style={{...td,textAlign:"center"}}>
                                <button onClick={()=>unarsipkan(p)} disabled={unarsipLoadingId===p.id}
                                  style={{padding:"5px 12px",borderRadius:7,border:"1px solid #bbf7d0",background:"#f0fdf4",color:"#16a34a",cursor:"pointer",fontSize:11,fontWeight:700}}>
                                  {unarsipLoadingId===p.id?"⏳...":"↩ Unarchive"}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {qcDetailPanel&&(()=>{
        const cl=qcDetailPanel.qc_checklist||{};
        const globalData=cl._global||{};
        const status=globalData.status||"to_do";
        const sb=QC_STATUS_LABEL[status]||QC_STATUS_LABEL.to_do;
        const fmtTgl=(iso:string)=>iso?new Date(iso).toLocaleDateString("id-ID",{day:"numeric",month:"short",year:"numeric"})+" "+new Date(iso).toLocaleTimeString("id-ID",{hour:"2-digit",minute:"2-digit"}):"";
        return(
          <Modal title={"Detail QC — "+qcDetailPanel.nama} onClose={()=>setQcDetailPanel(null)} width={600}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
              <div style={{fontSize:11,color:"#94a3b8"}}>
                WO {qcDetailPanel.wo_number_snapshot} — {qcDetailPanel.proyek_snapshot}
              </div>
              <span style={{background:sb.bg,color:sb.color,borderRadius:20,padding:"3px 12px",fontSize:11,fontWeight:700}}>{sb.label}</span>
            </div>
            {(globalData.todo_at||globalData.complete_at||globalData.updated_by)&&(
              <div style={{display:"flex",gap:14,fontSize:11,color:"#64748b",marginBottom:14,flexWrap:"wrap" as const}}>
                {globalData.todo_at&&<span>To Do: {fmtTgl(globalData.todo_at)}</span>}
                {globalData.complete_at&&<span>Selesai: {fmtTgl(globalData.complete_at)}</span>}
                {globalData.updated_by&&<span>oleh {globalData.updated_by}</span>}
              </div>
            )}
            <div style={{maxHeight:420,overflowY:"auto" as const,display:"flex",flexDirection:"column" as const,gap:10}}>
              {QC_ITEMS_ARSIP.map(item=>{
                const data=cl[item.key]||{};
                const fotoList=data.foto||[];
                return(
                  <div key={item.key} style={{border:"1px solid #e2e8f0",borderRadius:8,padding:12}}>
                    <div style={{fontWeight:700,fontSize:12,color:"#1e293b",marginBottom:6}}>{item.label}</div>
                    {data.catatan&&(
                      <div style={{fontSize:11,color:"#475569",background:"#f8fafc",borderRadius:6,padding:"6px 9px",marginBottom:8}}>{data.catatan}</div>
                    )}
                    {fotoList.length>0?(
                      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(80px,1fr))",gap:6}}>
                        {fotoList.map((f:any,fi:number)=>(
                          <img key={fi} src={f.url} onClick={()=>setLightbox({fotos:fotoList,index:fi,label:item.label})}
                            style={{width:"100%",aspectRatio:"1",objectFit:"cover" as const,borderRadius:6,border:"1px solid #e2e8f0",cursor:"pointer"}}/>
                        ))}
                      </div>
                    ):(
                      <div style={{fontSize:11,color:"#cbd5e1",fontStyle:"italic" as const}}>Belum ada foto</div>
                    )}
                  </div>
                );
              })}
            </div>
          </Modal>
        );
      })()}

      {lightbox&&<FotoZoomViewer fotos={lightbox.fotos} startIndex={lightbox.index} label={lightbox.label} onClose={()=>setLightbox(null)}/>}
    </div>
  );
}
