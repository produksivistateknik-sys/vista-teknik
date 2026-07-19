import { useState, useMemo } from 'react'

const QC_ITEMS_LAPORAN=[
  {key:"fisik",label:"Pemeriksaan Fisik"},
  {key:"spesifikasi",label:"Verifikasi Spesifikasi Komponen"},
  {key:"baut",label:"Pengecekan Kekencangan Baut"},
  {key:"test",label:"QC Test"},
];

const QC_STATUS_LIST=[
  {key:"to_do",label:"To Do",color:"#64748b",bg:"#f1f5f9",icon:"ti ti-circle-dashed"},
  {key:"in_progress",label:"In Progress",color:"#ea580c",bg:"#fff7ed",icon:"ti ti-loader-2"},
  {key:"complete",label:"Complete",color:"#16a34a",bg:"#f0fdf4",icon:"ti ti-circle-check"},
];

export function LaporanQCView({woData}:{woData:any[]}){
  const[search,setSearch]=useState("");
  const[selectedPanelId,setSelectedPanelId]=useState<number|null>(null);
  const[lightbox,setLightbox]=useState<any>(null);
  const[subTab,setSubTab]=useState<"outstanding"|"finished">("outstanding");
  const[statusFilter,setStatusFilter]=useState("ALL");
  const[selectedWoId,setSelectedWoId]=useState<number|null>(null);

  const allPanels=useMemo(()=>{
    const list:any[]=[];
    (woData||[]).forEach((w:any)=>{
      (w.panels||[]).forEach((p:any)=>{
        list.push({...p,_wo:w});
      });
    });
    return list;
  },[woData]);

  const getQcStatus=(panel:any)=>{
    return panel.qc_checklist?._global?.status||"to_do";
  };

  const withStatus=allPanels.map((p:any)=>({...p,_qcStatus:getQcStatus(p)}));
  const outstandingPanels=withStatus.filter((p:any)=>p._qcStatus!=="complete");
  const finishedPanels=withStatus.filter((p:any)=>p._qcStatus==="complete");
  const basePool=subTab==="outstanding"?outstandingPanels:finishedPanels;

  const filtered=basePool.filter((p:any)=>{
    const matchSearch=!search||p.nama?.toLowerCase().includes(search.toLowerCase())||p._wo?.wo?.toLowerCase().includes(search.toLowerCase())||p._wo?.proyek?.toLowerCase().includes(search.toLowerCase());
    const matchStatus=statusFilter==="ALL"||p._qcStatus===statusFilter;
    return matchSearch&&matchStatus;
  });

  const woFolders=useMemo(()=>{
    const map:Record<string,{woId:number,wo:any,panels:any[]}>={};
    filtered.forEach((p:any)=>{
      const key=String(p.wo_id);
      if(!map[key])map[key]={woId:p.wo_id,wo:p._wo,panels:[]};
      map[key].panels.push(p);
    });
    return Object.values(map);
  },[filtered]);

  const selectedFolder=woFolders.find((f:any)=>f.woId===selectedWoId);

  const selectedPanel=allPanels.find((p:any)=>p.id===selectedPanelId);

  const fmtTgl=(iso:string)=>{
    if(!iso)return"";
    const d=new Date(iso);
    return d.toLocaleDateString("id-ID",{day:"numeric",month:"short",year:"numeric"})+" "+d.toLocaleTimeString("id-ID",{hour:"2-digit",minute:"2-digit"});
  };

  const statusBadgeStyle=(status:string)=>{
    if(status==="complete")return{bg:"#f0fdf4",color:"#16a34a",label:"Selesai"};
    if(status==="in_progress")return{bg:"#fff7ed",color:"#ea580c",label:"Sedang Dikerjakan"};
    return{bg:"#f1f5f9",color:"#64748b",label:"To Do"};
  };

  if(selectedPanel){
    const cl=selectedPanel.qc_checklist||{};
    const globalData=selectedPanel.qc_checklist?._global||{};
    const status=getQcStatus(selectedPanel);
    const sb=statusBadgeStyle(status);
    return(
      <div className="fi">
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}} className="no-print">
          <button onClick={()=>setSelectedPanelId(null)}
            style={{height:32,padding:"0 14px",borderRadius:7,border:"1px solid #e2e8f0",background:"#fff",color:"#475569",fontSize:12,fontWeight:600,cursor:"pointer"}}>
            Kembali
          </button>
          <button onClick={()=>window.print()}
            style={{height:32,padding:"0 14px",borderRadius:7,border:"none",background:"#1d4ed8",color:"#fff",fontSize:12,fontWeight:600,cursor:"pointer"}}>
            Print Laporan
          </button>
        </div>

        <div style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:10,padding:20,marginBottom:16}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
            <div>
              <div style={{fontSize:11,color:"#94a3b8"}}>{selectedPanel._wo?.proyek} - {selectedPanel._wo?.wo}</div>
              <div style={{fontSize:18,fontWeight:800,color:"#1e293b"}}>{selectedPanel.nama}</div>
              <div style={{fontSize:11,color:"#94a3b8"}}>Tipe: {selectedPanel.tipe}</div>
            </div>
            <span style={{background:sb.bg,color:sb.color,borderRadius:20,padding:"4px 14px",fontSize:12,fontWeight:700}}>
              {sb.label}
            </span>
          </div>
          <div style={{display:"flex",gap:16,fontSize:11,color:"#64748b"}}>
            {globalData.todo_at&&<span>To Do: {fmtTgl(globalData.todo_at)}</span>}
            {globalData.complete_at&&<span>Selesai: {fmtTgl(globalData.complete_at)}</span>}
            {globalData.updated_by&&<span>oleh {globalData.updated_by}</span>}
          </div>
        </div>

        {QC_ITEMS_LAPORAN.map(item=>{
          const data=cl[item.key]||{};
          const fotoList=data.foto||[];
          return(
            <div key={item.key} style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:10,padding:16,marginBottom:12}}>
              <div style={{marginBottom:8}}>
                <span style={{fontWeight:700,fontSize:14,color:"#1e293b"}}>{item.label}</span>
              </div>
              {data.catatan&&(
                <div style={{fontSize:12,color:"#475569",background:"#f8fafc",borderRadius:6,padding:"8px 10px",marginBottom:10}}>
                  {data.catatan}
                </div>
              )}
              {fotoList.length>0?(
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(120px,1fr))",gap:8}}>
                  {fotoList.map((f:any,fi:number)=>(
                    <div key={fi} onClick={()=>setLightbox(f)} style={{cursor:"pointer"}} className="qc-foto-print">
                      <img src={f.url} style={{width:"100%",aspectRatio:"1",objectFit:"cover" as const,borderRadius:6,border:"1px solid #e2e8f0"}}/>
                      <div style={{fontSize:9,color:"#94a3b8",marginTop:3}}>{fmtTgl(f.uploaded_at)}</div>
                    </div>
                  ))}
                </div>
              ):(
                <div style={{fontSize:11,color:"#cbd5e1",fontStyle:"italic" as const}}>Belum ada foto</div>
              )}
            </div>
          );
        })}

        {lightbox&&(
          <div onClick={()=>setLightbox(null)} className="no-print"
            style={{position:"fixed" as const,inset:0,background:"rgba(0,0,0,0.85)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:9999,padding:20}}>
            <img src={lightbox.url} style={{maxWidth:"90%",maxHeight:"90%",objectFit:"contain" as const,borderRadius:8}}/>
          </div>
        )}

        <style>{`
          @media print {
            .no-print { display: none !important; }
          }
        `}</style>
      </div>
    );
  }

  return(
    <div className="fi">
      <div style={{display:"flex",gap:10,marginBottom:18}}>
        <button onClick={()=>{setSubTab("outstanding");setStatusFilter("ALL");setSelectedWoId(null);}}
          style={{flex:1,padding:"14px 18px",borderRadius:12,border:"none",cursor:"pointer",textAlign:"left" as const,
            background:subTab==="outstanding"?"linear-gradient(135deg,#f59e0b,#ea580c)":"#fff",
            boxShadow:subTab==="outstanding"?"0 4px 14px #ea580c33":"0 1px 3px rgba(0,0,0,0.06)"}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:38,height:38,borderRadius:10,background:subTab==="outstanding"?"#ffffff2a":"#fff7ed",display:"flex",alignItems:"center",justifyContent:"center"}}>
              <i className="ti ti-loader-2" style={{fontSize:18,color:subTab==="outstanding"?"#fff":"#ea580c"}}/>
            </div>
            <div>
              <div style={{fontSize:11,fontWeight:600,color:subTab==="outstanding"?"#ffffffcc":"#94a3b8"}}>Sedang Dikerjakan</div>
              <div style={{fontSize:20,fontWeight:800,color:subTab==="outstanding"?"#fff":"#1e293b"}}>{outstandingPanels.length}</div>
            </div>
          </div>
        </button>
        <button onClick={()=>{setSubTab("finished");setStatusFilter("ALL");setSelectedWoId(null);}}
          style={{flex:1,padding:"14px 18px",borderRadius:12,border:"none",cursor:"pointer",textAlign:"left" as const,
            background:subTab==="finished"?"linear-gradient(135deg,#22c55e,#16a34a)":"#fff",
            boxShadow:subTab==="finished"?"0 4px 14px #16a34a33":"0 1px 3px rgba(0,0,0,0.06)"}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:38,height:38,borderRadius:10,background:subTab==="finished"?"#ffffff2a":"#f0fdf4",display:"flex",alignItems:"center",justifyContent:"center"}}>
              <i className="ti ti-circle-check" style={{fontSize:18,color:subTab==="finished"?"#fff":"#16a34a"}}/>
            </div>
            <div>
              <div style={{fontSize:11,fontWeight:600,color:subTab==="finished"?"#ffffffcc":"#94a3b8"}}>Sudah Selesai QC</div>
              <div style={{fontSize:20,fontWeight:800,color:subTab==="finished"?"#fff":"#1e293b"}}>{finishedPanels.length}</div>
            </div>
          </div>
        </button>
      </div>

      <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap" as const,alignItems:"center"}}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Cari panel, WO, atau proyek..."
          style={{height:34,padding:"0 12px",border:"1px solid #e2e8f0",borderRadius:8,fontSize:12,background:"#fff",outline:"none",color:"#1e293b",fontFamily:"inherit",width:260}}/>
        <div style={{display:"flex",gap:6,marginLeft:"auto",flexWrap:"wrap" as const}}>
          <button onClick={()=>setStatusFilter("ALL")}
            style={{padding:"6px 14px",borderRadius:20,border:statusFilter==="ALL"?"1.5px solid #1d4ed8":"1.5px solid #e2e8f0",
              background:statusFilter==="ALL"?"#1d4ed8":"#fff",color:statusFilter==="ALL"?"#fff":"#64748b",fontSize:11,fontWeight:700,cursor:"pointer"}}>
            Semua
          </button>
          {QC_STATUS_LIST.map(s=>(
            <button key={s.key} onClick={()=>setStatusFilter(s.key)}
              style={{padding:"6px 14px",borderRadius:20,border:statusFilter===s.key?`1.5px solid ${s.color}`:"1.5px solid #e2e8f0",
                background:statusFilter===s.key?s.color:"#fff",color:statusFilter===s.key?"#fff":"#64748b",fontSize:11,fontWeight:700,cursor:"pointer"}}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {selectedFolder?(
        <div>
          <button onClick={()=>setSelectedWoId(null)}
            style={{display:"flex",alignItems:"center",gap:5,background:"none",border:"none",color:"#2563eb",fontWeight:600,fontSize:12.5,cursor:"pointer",marginBottom:14,padding:0}}>
            <i className="ti ti-chevron-left" style={{fontSize:15}}/> Semua Folder
          </button>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14,paddingBottom:10,borderBottom:"2px solid #e2e8f0"}}>
            <div style={{width:40,height:40,borderRadius:10,background:"#eff6ff",display:"flex",alignItems:"center",justifyContent:"center"}}>
              <i className="ti ti-folder-open" style={{fontSize:20,color:"#2563eb"}}/>
            </div>
            <div>
              <div style={{fontWeight:800,fontSize:15,color:"#1e293b"}}>{selectedFolder.wo?.proyek}</div>
              <div style={{fontSize:11.5,color:"#94a3b8"}}>WO {selectedFolder.wo?.wo} - {selectedFolder.panels.length} panel</div>
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:12}}>
            {selectedFolder.panels.map((p:any)=>{
              const statusDef=QC_STATUS_LIST.find(s=>s.key===p._qcStatus)||QC_STATUS_LIST[0];
              const sb=statusBadgeStyle(p._qcStatus);
              return(
                <div key={p.id} onClick={()=>setSelectedPanelId(p.id)}
                  style={{background:"#fff",borderRadius:12,border:"1px solid #e2e8f0",borderLeft:`4px solid ${statusDef.color}`,
                    padding:16,cursor:"pointer",boxShadow:"0 1px 3px rgba(0,0,0,0.05)",transition:"all .15s"}}
                  onMouseEnter={(e:any)=>{e.currentTarget.style.boxShadow="0 6px 16px rgba(0,0,0,0.1)";e.currentTarget.style.transform="translateY(-3px)";}}
                  onMouseLeave={(e:any)=>{e.currentTarget.style.boxShadow="0 1px 3px rgba(0,0,0,0.05)";e.currentTarget.style.transform="translateY(0)";}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
                    <div style={{minWidth:0}}>
                      <div style={{fontSize:14,fontWeight:700,color:"#1e293b",whiteSpace:"nowrap" as const,overflow:"hidden",textOverflow:"ellipsis"}}>{p.nama}</div>
                      <div style={{fontSize:11,color:"#94a3b8"}}>{p.tipe}</div>
                    </div>
                    <div style={{width:34,height:34,borderRadius:9,background:statusDef.bg,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                      <i className={statusDef.icon} style={{fontSize:16,color:statusDef.color}}/>
                    </div>
                  </div>
                  <span style={{background:sb.bg,color:sb.color,borderRadius:20,padding:"3px 10px",fontSize:10.5,fontWeight:700}}>{sb.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      ):woFolders.length===0?(
        <div style={{textAlign:"center",padding:50,color:"#94a3b8",background:"#fff",borderRadius:12,border:"1px solid #e2e8f0"}}>
          <i className="ti ti-clipboard-x" style={{fontSize:36,display:"block",marginBottom:10}}/>
          Tidak ada panel ditemukan
        </div>
      ):(
        <div style={{display:"flex",flexDirection:"column" as const,gap:10}}>
          {woFolders.map((f:any)=>{
            const doneInFolder=f.panels.filter((p:any)=>p._qcStatus==="complete").length;
            const allDone=doneInFolder===f.panels.length;
            return(
              <div key={f.woId} onClick={()=>setSelectedWoId(f.woId)}
                style={{background:"#fff",borderRadius:12,border:"1px solid #e2e8f0",padding:"14px 16px",cursor:"pointer",
                  display:"flex",alignItems:"center",gap:14,boxShadow:"0 1px 3px rgba(0,0,0,0.05)",transition:"all .15s"}}
                onMouseEnter={(e:any)=>{e.currentTarget.style.boxShadow="0 4px 12px rgba(0,0,0,0.08)";e.currentTarget.style.borderColor="#bfdbfe";}}
                onMouseLeave={(e:any)=>{e.currentTarget.style.boxShadow="0 1px 3px rgba(0,0,0,0.05)";e.currentTarget.style.borderColor="#e2e8f0";}}>
                <div style={{width:46,height:46,borderRadius:11,background:allDone?"#f0fdf4":"#eff6ff",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                  <i className="ti ti-folder" style={{fontSize:22,color:allDone?"#16a34a":"#2563eb"}}/>
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:700,fontSize:14,color:"#1e293b",whiteSpace:"nowrap" as const,overflow:"hidden",textOverflow:"ellipsis"}}>{f.wo?.proyek}</div>
                  <div style={{fontSize:11.5,color:"#94a3b8"}}>WO {f.wo?.wo} - {f.panels.length} panel</div>
                </div>
                <span style={{fontSize:10.5,fontWeight:700,color:allDone?"#16a34a":"#64748b",background:allDone?"#f0fdf4":"#f1f5f9",borderRadius:20,padding:"4px 12px",flexShrink:0}}>
                  {doneInFolder}/{f.panels.length} selesai
                </span>
                <i className="ti ti-chevron-right" style={{fontSize:18,color:"#cbd5e1",flexShrink:0}}/>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
