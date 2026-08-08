import { useState, useMemo } from 'react'
import { downloadFotoSebagaiZip, sanitizeNamaFile, type FotoZipItem } from '../lib/downloadHelpers'
import { PipelineStatusFilterTabs, PIPELINE_STATUS_LIST } from './ui/PipelineStatusFilter'
import { FotoZoomViewer } from './FotoZoomViewer'

export type TugasKomponenProgress = {
  field: string
  label: string
  icon: string
  color: string
  progressField: string
  fotoField: string
  // gateField opsional (8 Agu 2026): field panel yang jadi penanda "siap dikerjakan" (misal
  // QS baru relevan begitu warehouse_progress>0) - kalau field ini masih 0, status "Not Yet".
  // Kalau gateField gak diisi (mis. Warehouse), tugas ini gak punya gate sama sekali - filter
  // yang dipakai cuma 3-state (To Do/In Progress/Done), sama kayak QC.
  gateField?: string
}

const STATUS_LABEL_KP:Record<string,{label:string,bg:string,color:string}>={
  belum:{label:"Belum Mulai",bg:"#f1f5f9",color:"#64748b"},
  proses:{label:"Sedang Dikerjakan",bg:"#fff7ed",color:"#ea580c"},
  selesai:{label:"Selesai",bg:"#f0fdf4",color:"#16a34a"},
}

// Sama persis kriteria Nameplate/Yellowmark/Pasang Komponen - progress 100% DAN minimal
// 1 foto Pemasangan, biar konsisten di semua tempat.
const statusTugasKp=(pct:number,jumlahFoto:number)=>{
  if(pct>=100&&jumlahFoto>=1)return"selesai"
  if(pct>0||jumlahFoto>0)return"proses"
  return"belum"
}

// Sama persis pola LaporanNameplateView/LaporanPasangKomponenView, digenerikkan buat 1 tugas
// (Warehouse ATAU QS) - dipakai 2x di TrackingView.tsx dengan config beda-beda.
export function LaporanKomponenProgressView({woData,tugas}:{woData:any[],tugas:TugasKomponenProgress}){
  const[search,setSearch]=useState("")
  const[selectedPanelId,setSelectedPanelId]=useState<number|null>(null)
  const[lightbox,setLightbox]=useState<any>(null)
  const[subTab,setSubTab]=useState<"outstanding"|"finished">("outstanding")
  const[selectedWoId,setSelectedWoId]=useState<number|null>(null)
  const[zipBusy,setZipBusy]=useState<{key:string,done:number,total:number}|null>(null)
  const[statusFilter,setStatusFilter]=useState("ALL")
  const statusListTugas=tugas.gateField?PIPELINE_STATUS_LIST:PIPELINE_STATUS_LIST.filter(s=>s.key!=="NOT_YET")

  const fotoKpPanel=(panel:any):FotoZipItem[]=>{
    const fotoList=panel[tugas.fotoField]||[]
    return fotoList.map((f:any,fi:number)=>({url:f.url,path:`foto_${fi+1}.jpg`}))
  }

  const downloadZipPanelKp=async(panel:any)=>{
    const items=fotoKpPanel(panel)
    if(items.length===0){alert("Belum ada foto untuk panel ini");return}
    const key=`panel_${panel.id}`
    setZipBusy({key,done:0,total:items.length})
    const{gagal}=await downloadFotoSebagaiZip(items,`${sanitizeNamaFile(tugas.label)}_${sanitizeNamaFile(panel.nama)}.zip`,(done,total)=>setZipBusy({key,done,total}))
    setZipBusy(null)
    if(gagal>0)alert(`${gagal} foto gagal diunduh, sisanya berhasil masuk ZIP`)
  }

  const downloadZipProyekKp=async(folder:{woId:number,wo:any,panels:any[]})=>{
    const items:FotoZipItem[]=[]
    folder.panels.forEach((p:any)=>{
      fotoKpPanel(p).forEach(it=>items.push({...it,path:`${sanitizeNamaFile(p.nama)}/${it.path}`}))
    })
    if(items.length===0){alert("Belum ada foto untuk proyek ini");return}
    const key=`wo_${folder.woId}`
    setZipBusy({key,done:0,total:items.length})
    const{gagal}=await downloadFotoSebagaiZip(items,`${sanitizeNamaFile(tugas.label)}_${sanitizeNamaFile(folder.wo?.proyek||folder.wo?.wo||"proyek")}.zip`,(done,total)=>setZipBusy({key,done,total}))
    setZipBusy(null)
    if(gagal>0)alert(`${gagal} foto gagal diunduh, sisanya berhasil masuk ZIP`)
  }

  const allPanels=useMemo(()=>{
    const list:any[]=[]
    ;(woData||[]).forEach((w:any)=>{
      (w.panels||[]).forEach((p:any)=>{
        list.push({...p,_wo:w})
      })
    })
    return list
  },[woData])

  const withStatus=useMemo(()=>allPanels.map((p:any)=>{
    const pct=p[tugas.progressField]||0
    const foto=p[tugas.fotoField]||[]
    const kpStatus=statusTugasKp(pct,foto.length)
    const gateReady=tugas.gateField?(p[tugas.gateField]||0)>0:true
    const pipelineStatus=kpStatus==="selesai"?"DONE":!gateReady?"NOT_YET":kpStatus==="proses"?"IN_PROGRESS":"TO_DO"
    return{...p,_kpStatus:kpStatus,_pipelineStatus:pipelineStatus}
  }),[allPanels,tugas])

  const outstandingPanels=withStatus.filter((p:any)=>p._kpStatus!=="selesai")
  const finishedPanels=withStatus.filter((p:any)=>p._kpStatus==="selesai")
  const basePool=subTab==="outstanding"?outstandingPanels:finishedPanels

  const bySearch=basePool.filter((p:any)=>
    !search||p.nama?.toLowerCase().includes(search.toLowerCase())||p._wo?.wo?.toLowerCase().includes(search.toLowerCase())||p._wo?.proyek?.toLowerCase().includes(search.toLowerCase())
  )
  const statusCounts=useMemo(()=>{
    const c:Record<string,number>={}
    bySearch.forEach((p:any)=>{c[p._pipelineStatus]=(c[p._pipelineStatus]||0)+1})
    return c
  },[bySearch])
  const filtered=bySearch.filter((p:any)=>statusFilter==="ALL"||p._pipelineStatus===statusFilter)

  const woFolders=useMemo(()=>{
    const map:Record<string,{woId:number,wo:any,panels:any[]}>={}
    filtered.forEach((p:any)=>{
      const key=String(p.wo_id)
      if(!map[key])map[key]={woId:p.wo_id,wo:p._wo,panels:[]}
      map[key].panels.push(p)
    })
    return Object.values(map)
  },[filtered])

  const selectedFolder=woFolders.find((f:any)=>f.woId===selectedWoId)
  const selectedPanel=withStatus.find((p:any)=>p.id===selectedPanelId)

  const fmtTgl=(iso:string)=>{
    if(!iso)return""
    const d=new Date(iso)
    return d.toLocaleDateString("id-ID",{day:"numeric",month:"short",year:"numeric"})+" "+d.toLocaleTimeString("id-ID",{hour:"2-digit",minute:"2-digit"})
  }

  if(selectedPanel){
    const foto=selectedPanel[tugas.fotoField]||[]
    const sb=STATUS_LABEL_KP[selectedPanel._kpStatus]
    return(
      <div className="fi">
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16,flexWrap:"wrap" as const}} className="no-print">
          <button onClick={()=>setSelectedPanelId(null)}
            style={{height:32,padding:"0 14px",borderRadius:7,border:"1px solid #e2e8f0",background:"#fff",color:"#475569",fontSize:12,fontWeight:600,cursor:"pointer"}}>
            Kembali
          </button>
          <button onClick={()=>window.print()}
            style={{height:32,padding:"0 14px",borderRadius:7,border:"none",background:"#1d4ed8",color:"#fff",fontSize:12,fontWeight:600,cursor:"pointer"}}>
            Print Laporan
          </button>
          <button onClick={()=>downloadZipPanelKp(selectedPanel)} disabled={zipBusy?.key===`panel_${selectedPanel.id}`}
            style={{height:32,padding:"0 14px",borderRadius:7,border:"1px solid #16a34a",background:"#fff",color:"#16a34a",fontSize:12,fontWeight:600,
              cursor:zipBusy?.key===`panel_${selectedPanel.id}`?"not-allowed":"pointer"}}>
            {zipBusy?.key===`panel_${selectedPanel.id}`?`⏳ ${zipBusy.done}/${zipBusy.total}...`:"⬇️ Download Semua Foto (ZIP)"}
          </button>
        </div>

        <div style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:10,padding:20,marginBottom:16}}>
          <div style={{fontSize:11,color:"#94a3b8"}}>{selectedPanel._wo?.proyek} - {selectedPanel._wo?.wo}</div>
          <div style={{fontSize:18,fontWeight:800,color:"#1e293b"}}>{selectedPanel.nama}</div>
          <div style={{fontSize:11,color:"#94a3b8"}}>Tipe: {selectedPanel.tipe}</div>
        </div>

        <div style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:10,padding:16,marginBottom:12}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10,flexWrap:"wrap" as const,gap:8}}>
            <span style={{fontWeight:700,fontSize:14,color:tugas.color}}>{tugas.icon} {tugas.label}</span>
            <span style={{background:sb.bg,color:sb.color,borderRadius:20,padding:"3px 10px",fontSize:10.5,fontWeight:700}}>{sb.label}</span>
          </div>
          {foto.length>0?(
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(120px,1fr))",gap:8}}>
              {foto.map((f:any,fi:number)=>(
                <div key={fi} onClick={()=>setLightbox({fotos:foto,index:fi,label:`${tugas.label}_${selectedPanel.nama}`})} style={{cursor:"pointer"}} className="kp-foto-print">
                  <img src={f.url} style={{width:"100%",aspectRatio:"1",objectFit:"cover" as const,borderRadius:6,border:"1px solid #e2e8f0"}}/>
                  <div style={{fontSize:9,color:"#94a3b8",marginTop:3}}>{fmtTgl(f.uploaded_at)}{f.uploaded_by?" · "+f.uploaded_by:""}</div>
                </div>
              ))}
            </div>
          ):(
            <div style={{fontSize:11,color:"#cbd5e1",fontStyle:"italic" as const}}>Belum ada foto Pemasangan</div>
          )}
        </div>

        {lightbox&&<FotoZoomViewer fotos={lightbox.fotos} startIndex={lightbox.index} label={lightbox.label} onClose={()=>setLightbox(null)}/>}

        <style>{`
          @media print {
            .no-print { display: none !important; }
          }
        `}</style>
      </div>
    )
  }

  return(
    <div className="fi">
      <div style={{display:"flex",gap:10,marginBottom:18}}>
        <button onClick={()=>{setSubTab("outstanding");setStatusFilter("ALL");setSelectedWoId(null)}}
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
        <button onClick={()=>{setSubTab("finished");setStatusFilter("ALL");setSelectedWoId(null)}}
          style={{flex:1,padding:"14px 18px",borderRadius:12,border:"none",cursor:"pointer",textAlign:"left" as const,
            background:subTab==="finished"?"linear-gradient(135deg,#22c55e,#16a34a)":"#fff",
            boxShadow:subTab==="finished"?"0 4px 14px #16a34a33":"0 1px 3px rgba(0,0,0,0.06)"}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:38,height:38,borderRadius:10,background:subTab==="finished"?"#ffffff2a":"#f0fdf4",display:"flex",alignItems:"center",justifyContent:"center"}}>
              <i className="ti ti-circle-check" style={{fontSize:18,color:subTab==="finished"?"#fff":"#16a34a"}}/>
            </div>
            <div>
              <div style={{fontSize:11,fontWeight:600,color:subTab==="finished"?"#ffffffcc":"#94a3b8"}}>{tugas.label} Selesai</div>
              <div style={{fontSize:20,fontWeight:800,color:subTab==="finished"?"#fff":"#1e293b"}}>{finishedPanels.length}</div>
            </div>
          </div>
        </button>
      </div>

      <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap" as const,alignItems:"center"}}>
        <input value={search} onChange={(e:any)=>setSearch(e.target.value)} placeholder="Cari panel, WO, atau proyek..."
          style={{height:34,padding:"0 12px",border:"1px solid #e2e8f0",borderRadius:8,fontSize:12,background:"#fff",outline:"none",color:"#1e293b",fontFamily:"inherit",width:260}}/>
        <PipelineStatusFilterTabs statusList={statusListTugas} statusFilter={statusFilter} setStatusFilter={setStatusFilter} counts={statusCounts}/>
      </div>

      {selectedFolder?(
        <div>
          <button onClick={()=>setSelectedWoId(null)}
            style={{display:"flex",alignItems:"center",gap:5,background:"none",border:"none",color:"#2563eb",fontWeight:600,fontSize:12.5,cursor:"pointer",marginBottom:14,padding:0}}>
            <i className="ti ti-chevron-left" style={{fontSize:15}}/> Semua Folder
          </button>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14,paddingBottom:10,borderBottom:"2px solid #e2e8f0",flexWrap:"wrap" as const}}>
            <div style={{width:40,height:40,borderRadius:10,background:"#eff6ff",display:"flex",alignItems:"center",justifyContent:"center"}}>
              <i className="ti ti-folder-open" style={{fontSize:20,color:"#2563eb"}}/>
            </div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontWeight:800,fontSize:15,color:"#1e293b"}}>{selectedFolder.wo?.proyek}</div>
              <div style={{fontSize:11.5,color:"#94a3b8"}}>WO {selectedFolder.wo?.wo} - {selectedFolder.panels.length} panel</div>
            </div>
            <button onClick={()=>downloadZipProyekKp(selectedFolder)} disabled={zipBusy?.key===`wo_${selectedFolder.woId}`}
              style={{height:32,padding:"0 14px",borderRadius:7,border:"1px solid #16a34a",background:"#fff",color:"#16a34a",fontSize:12,fontWeight:600,
                cursor:zipBusy?.key===`wo_${selectedFolder.woId}`?"not-allowed":"pointer",whiteSpace:"nowrap" as const}}>
              {zipBusy?.key===`wo_${selectedFolder.woId}`?`⏳ ${zipBusy.done}/${zipBusy.total}...`:"⬇️ Download Semua Foto Proyek (ZIP)"}
            </button>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:12}}>
            {selectedFolder.panels.map((p:any)=>{
              const sb=STATUS_LABEL_KP[p._kpStatus]
              return(
                <div key={p.id} onClick={()=>setSelectedPanelId(p.id)}
                  style={{background:"#fff",borderRadius:12,border:"1px solid #e2e8f0",borderLeft:`4px solid ${p._kpStatus==="selesai"?"#16a34a":"#ea580c"}`,
                    padding:16,cursor:"pointer",boxShadow:"0 1px 3px rgba(0,0,0,0.05)",transition:"all .15s"}}
                  onMouseEnter={(e:any)=>{e.currentTarget.style.boxShadow="0 6px 16px rgba(0,0,0,0.1)";e.currentTarget.style.transform="translateY(-3px)"}}
                  onMouseLeave={(e:any)=>{e.currentTarget.style.boxShadow="0 1px 3px rgba(0,0,0,0.05)";e.currentTarget.style.transform="translateY(0)"}}>
                  <div style={{fontSize:14,fontWeight:700,color:"#1e293b",whiteSpace:"nowrap" as const,overflow:"hidden",textOverflow:"ellipsis",marginBottom:2}}>{p.nama}</div>
                  <div style={{fontSize:11,color:"#94a3b8",marginBottom:10}}>{p.tipe}</div>
                  <span style={{fontSize:9.5,fontWeight:700,background:sb.bg,color:sb.color,borderRadius:6,padding:"3px 8px",whiteSpace:"nowrap" as const}}>{sb.label}</span>
                </div>
              )
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
            const doneInFolder=f.panels.filter((p:any)=>p._kpStatus==="selesai").length
            const allDone=doneInFolder===f.panels.length
            return(
              <div key={f.woId} onClick={()=>setSelectedWoId(f.woId)}
                style={{background:"#fff",borderRadius:12,border:"1px solid #e2e8f0",padding:"14px 16px",cursor:"pointer",
                  display:"flex",alignItems:"center",gap:14,boxShadow:"0 1px 3px rgba(0,0,0,0.05)",transition:"all .15s"}}
                onMouseEnter={(e:any)=>{e.currentTarget.style.boxShadow="0 4px 12px rgba(0,0,0,0.08)";e.currentTarget.style.borderColor="#bfdbfe"}}
                onMouseLeave={(e:any)=>{e.currentTarget.style.boxShadow="0 1px 3px rgba(0,0,0,0.05)";e.currentTarget.style.borderColor="#e2e8f0"}}>
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
            )
          })}
        </div>
      )}
    </div>
  )
}
