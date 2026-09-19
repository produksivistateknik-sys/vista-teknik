import { useState, useMemo } from 'react'
import { downloadFotoSebagaiZip, sanitizeNamaFile, type FotoZipItem } from '../lib/downloadHelpers'
import { getEffCfgGlobal, getBestProgressMap, getRelevantProsesForKode } from '../lib/panelHelpers'
import { PipelineStatusFilterTabs, PIPELINE_STATUS_LIST } from './ui/PipelineStatusFilter'
import { FotoZoomViewer } from './FotoZoomViewer'

const STATUS_LABEL_WK:Record<string,{label:string,bg:string,color:string}>={
  belum:{label:"Belum Mulai",bg:"#f1f5f9",color:"#64748b"},
  proses:{label:"Sedang Dikerjakan",bg:"#fff7ed",color:"#ea580c"},
  selesai:{label:"Selesai",bg:"#f0fdf4",color:"#16a34a"},
}

// Kontribusi WIRING (checklist[kode].pasangKomponenTahap.WIRING) gak punya gating resmi -
// REUSE ambang RAKIT persis kayak yang dipakai LaporanPasangKomponenView buat komponen tahap
// yang sama (Box Control/Pintu), biar definisinya konsisten di kedua laporan.
// BUG FIX (20 Sep 2026, pola sama dengan fix computeProsesStatus di panelHelpers.ts &
// kodePipelineStatusPk di LaporanPasangKomponenView.tsx) - gate ke RAKIT cuma valid kalau
// RAKIT genuinely relevan buat kode ini. Kode beli-jadi (Pintu/Box Control tipe polyester dkk)
// gak punya baris RAKIT di bom_proses_relevan - progressMap["RAKIT"] PERMANEN 0, gate ">0"
// gak akan pernah kebuka -> macet "NOT YET" selamanya walau tahap WIRING-nya genuinely siap
// dikerjakan. Sekarang gate RAKIT cuma dipakai kalau RAKIT ada di relevantProses kode ini;
// kalau enggak, langsung "TO DO".
const RANK_PIPELINE_WK:Record<string,number>={"NOT YET":0,"TO DO":1,"IN PROGRESS":2,"DONE":3}
const kodePipelineStatusWk=(panel:any,kode:string,pct:number):string=>{
  if(pct>=100)return"DONE"
  if(pct>0)return"IN PROGRESS"
  const progressMap=getBestProgressMap(panel.checklist?.[kode])
  const relevantProses=getRelevantProsesForKode(kode,panel.tipe)
  if(!relevantProses.includes("RAKIT"))return"TO DO"
  return(progressMap?.["RAKIT"]||0)>0?"TO DO":"NOT YET"
}
const panelPipelineStatusWk=(panel:any,komponenList:{kode:string,pct:number}[]):string=>{
  if(komponenList.length===0)return"NOT_YET"
  const best=komponenList.map(k=>kodePipelineStatusWk(panel,k.kode,k.pct))
    .reduce((acc,s)=>RANK_PIPELINE_WK[s]>RANK_PIPELINE_WK[acc]?s:acc,"NOT YET")
  if(best==="DONE"||best==="IN PROGRESS")return"IN_PROGRESS"
  if(best==="TO DO")return"TO_DO"
  return"NOT_YET"
}

// Komponen yang punya kontribusi WIRING ke progress PASANG KOMPONEN gabungan (lihat
// PASANG_KOMPONEN_TAHAP_KOMPONEN_NAMA di Vista Pekerja) - dicocokkan lewat nama komponen,
// bukan kode (kode beda-beda per tipe panel, misal Box Control = FS.5 di tipe FS tapi F3B.7
// di tipe F3B).
const WIRING_KOMPONEN_NAMA=["Box Control","Pintu"]

const statusWiringKomponen=(pct:number,jumlahFoto:number)=>{
  if(pct>=100&&jumlahFoto>=1)return"selesai"
  if(pct>0||jumlahFoto>0)return"proses"
  return"belum"
}

// Daftar kode Box Control/Pintu yang relevan buat 1 panel (bisa lebih dari 1 kalau tipe
// panelnya punya lebih dari satu, meski biasanya cuma 1 masing-masing). REVISI (5 Agu 2026):
// pct di sini SEKARANG kontribusi tahap WIRING doang (checklist[kode].pasangKomponenTahap.WIRING)
// - bukan lagi progress["WIRING CONTROL"] (kerja kabel, yang sekarang independen sepenuhnya
// dan gak relevan buat laporan pasang-komponen ini). Fallback ke 0 kalau data lama belum
// pernah disentuh fitur tahap ini sama sekali (panel belum pernah ada kontribusi WIRING).
const komponenWiringPanel=(panel:any)=>{
  const cfg=getEffCfgGlobal(panel.tipe)
  if(!cfg)return[]
  const items=cfg.wps.flatMap((w:any)=>w.items)
  return items
    .filter((it:any)=>WIRING_KOMPONEN_NAMA.includes(it.nama)&&(panel.checklist?.[it.kode]?.qty||0)>0)
    .map((it:any)=>{
      const cl=panel.checklist?.[it.kode]
      return{kode:it.kode,nama:it.nama,pct:cl?.pasangKomponenTahap?.WIRING?.progress||0,foto:cl?.fotoPemasangan||[]}
    })
}

export function LaporanWiringKomponenView({woData}:{woData:any[]}){
  const[search,setSearch]=useState("")
  const[selectedPanelId,setSelectedPanelId]=useState<number|null>(null)
  const[lightbox,setLightbox]=useState<any>(null)
  const[zipBusy,setZipBusy]=useState<{key:string,done:number,total:number}|null>(null)
  const[statusFilter,setStatusFilter]=useState("ALL")
  // woFilterId (14 Sep 2026, redesign ikut gaya QC) - gantiin selectedWoId(folder-drill) versi
  // lama, sekarang dropdown filter di atas tabel flat. subTab(outstanding/finished) DIHAPUS -
  // kartu Done (klik-toggle) udah nyakup fungsi yang sama.
  const[woFilterId,setWoFilterId]=useState<number|"ALL">("ALL")

  const downloadZipPanelWk=async(panel:any,komponenList:any[])=>{
    const items:FotoZipItem[]=[]
    komponenList.forEach((k:any)=>{
      k.foto.forEach((f:any,fi:number)=>items.push({url:f.url,path:`${sanitizeNamaFile(k.nama)}/foto_${fi+1}.jpg`}))
    })
    if(items.length===0){alert("Belum ada foto untuk panel ini");return}
    const key=`panel_${panel.id}`
    setZipBusy({key,done:0,total:items.length})
    const{gagal}=await downloadFotoSebagaiZip(items,`WiringKomponen_${sanitizeNamaFile(panel.nama)}.zip`,(done,total)=>setZipBusy({key,done,total}))
    setZipBusy(null)
    if(gagal>0)alert(`${gagal} foto gagal diunduh, sisanya berhasil masuk ZIP`)
  }

  const downloadZipProyekWk=async(folder:{woId:number,wo:any,panels:any[]})=>{
    const items:FotoZipItem[]=[]
    folder.panels.forEach((p:any)=>{
      komponenWiringPanel(p).forEach((k:any)=>{
        k.foto.forEach((f:any,fi:number)=>items.push({url:f.url,path:`${sanitizeNamaFile(p.nama)}/${sanitizeNamaFile(k.nama)}/foto_${fi+1}.jpg`}))
      })
    })
    if(items.length===0){alert("Belum ada foto untuk proyek ini");return}
    const key=`wo_${folder.woId}`
    setZipBusy({key,done:0,total:items.length})
    const{gagal}=await downloadFotoSebagaiZip(items,`WiringKomponen_${sanitizeNamaFile(folder.wo?.proyek||folder.wo?.wo||"proyek")}.zip`,(done,total)=>setZipBusy({key,done,total}))
    setZipBusy(null)
    if(gagal>0)alert(`${gagal} foto gagal diunduh, sisanya berhasil masuk ZIP`)
  }

  const allPanels=useMemo(()=>{
    const list:any[]=[]
    ;(woData||[]).forEach((w:any)=>{
      (w.panels||[]).forEach((p:any)=>{
        const komponenList=komponenWiringPanel(p)
        if(komponenList.length===0)return
        list.push({...p,_wo:w,_wkKomponen:komponenList})
      })
    })
    return list
  },[woData])

  const withStatus=useMemo(()=>allPanels.map((p:any)=>{
    const totalFoto=p._wkKomponen.reduce((s:number,k:any)=>s+k.foto.length,0)
    const pctRata=Math.round(p._wkKomponen.reduce((s:number,k:any)=>s+k.pct,0)/p._wkKomponen.length)
    const wkStatus=statusWiringKomponen(pctRata,totalFoto)
    const pipelineStatus=wkStatus==="selesai"?"DONE":panelPipelineStatusWk(p,p._wkKomponen)
    return{...p,_wkPct:pctRata,_wkStatus:wkStatus,_pipelineStatus:pipelineStatus}
  }),[allPanels])

  const bySearch=withStatus.filter((p:any)=>
    !search||p.nama?.toLowerCase().includes(search.toLowerCase())||p._wo?.wo?.toLowerCase().includes(search.toLowerCase())||p._wo?.proyek?.toLowerCase().includes(search.toLowerCase())
  )
  const statusCounts=useMemo(()=>{
    const c:Record<string,number>={}
    bySearch.forEach((p:any)=>{c[p._pipelineStatus]=(c[p._pipelineStatus]||0)+1})
    return c
  },[bySearch])
  const woOptions=useMemo(()=>{
    const map:Record<number,any>={}
    bySearch.forEach((p:any)=>{if(p.wo_id&&!map[p.wo_id])map[p.wo_id]=p._wo})
    return Object.entries(map).map(([id,wo]:any)=>({id:Number(id),wo})).sort((a,b)=>(a.wo?.wo||"").localeCompare(b.wo?.wo||""))
  },[bySearch])
  const filtered=bySearch.filter((p:any)=>{
    const matchStatus=statusFilter==="ALL"||p._pipelineStatus===statusFilter
    const matchWo=woFilterId==="ALL"||p.wo_id===woFilterId
    return matchStatus&&matchWo
  })
  const activeWoFolder=woFilterId!=="ALL"?{woId:woFilterId,wo:woOptions.find(w=>w.id===woFilterId)?.wo,panels:filtered}:null

  const selectedPanel=withStatus.find((p:any)=>p.id===selectedPanelId)

  const fmtTgl=(iso:string)=>{
    if(!iso)return""
    const d=new Date(iso)
    return d.toLocaleDateString("id-ID",{day:"numeric",month:"short",year:"numeric"})+" "+d.toLocaleTimeString("id-ID",{hour:"2-digit",minute:"2-digit"})
  }

  if(selectedPanel){
    const sb=STATUS_LABEL_WK[selectedPanel._wkStatus]
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
          <button onClick={()=>downloadZipPanelWk(selectedPanel,selectedPanel._wkKomponen)} disabled={zipBusy?.key===`panel_${selectedPanel.id}`}
            style={{height:32,padding:"0 14px",borderRadius:7,border:"1px solid #16a34a",background:"#fff",color:"#16a34a",fontSize:12,fontWeight:600,
              cursor:zipBusy?.key===`panel_${selectedPanel.id}`?"not-allowed":"pointer"}}>
            {zipBusy?.key===`panel_${selectedPanel.id}`?`⏳ ${zipBusy.done}/${zipBusy.total}...`:"⬇️ Download Semua Foto (ZIP)"}
          </button>
        </div>

        <div style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:10,padding:20,marginBottom:16}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap" as const,gap:8}}>
            <div>
              <div style={{fontSize:11,color:"#94a3b8"}}>{selectedPanel._wo?.proyek} - {selectedPanel._wo?.wo}</div>
              <div style={{fontSize:18,fontWeight:800,color:"#1e293b"}}>{selectedPanel.nama}</div>
              <div style={{fontSize:11,color:"#94a3b8"}}>Tipe: {selectedPanel.tipe}</div>
            </div>
            <span style={{background:sb.bg,color:sb.color,borderRadius:20,padding:"3px 10px",fontSize:10.5,fontWeight:700}}>{sb.label}</span>
          </div>
        </div>

        {selectedPanel._wkKomponen.map((k:any)=>(
          <div key={k.kode} style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:10,padding:16,marginBottom:12}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10,flexWrap:"wrap" as const,gap:8}}>
              <span style={{fontWeight:700,fontSize:14,color:"#4f46e5"}}>⚡ {k.nama} <span style={{fontWeight:400,color:"#94a3b8",fontSize:11}}>({k.kode})</span></span>
              <span style={{fontSize:11,fontWeight:700,color:k.pct>=100?"#16a34a":"#64748b"}}>Progress {k.pct}%</span>
            </div>
            {k.foto.length>0?(
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(120px,1fr))",gap:8}}>
                {k.foto.map((f:any,fi:number)=>(
                  <div key={fi} onClick={()=>setLightbox({fotos:k.foto,index:fi,label:`${k.nama}_${selectedPanel.nama}`})} style={{cursor:"pointer"}} className="wk-foto-print">
                    <img src={f.url} style={{width:"100%",aspectRatio:"1",objectFit:"cover" as const,borderRadius:6,border:"1px solid #e2e8f0"}}/>
                    <div style={{fontSize:9,color:"#94a3b8",marginTop:3}}>{fmtTgl(f.uploaded_at)}{f.uploaded_by?" · "+f.uploaded_by:""}</div>
                  </div>
                ))}
              </div>
            ):(
              <div style={{fontSize:11,color:"#cbd5e1",fontStyle:"italic" as const}}>Belum ada foto Pemasangan</div>
            )}
          </div>
        ))}

        {lightbox&&<FotoZoomViewer fotos={lightbox.fotos} startIndex={lightbox.index} label={lightbox.label} onClose={()=>setLightbox(null)}/>}

        <style>{`
          @media print {
            .no-print { display: none !important; }
          }
        `}</style>
      </div>
    )
  }

  const total4=bySearch.length
  const count4=(key:string)=>statusCounts[key]||0

  return(
    <div className="fi">
      {/* Banner + 4 kartu + search/filter/tabel - ikut gaya QC (14 Sep 2026), warna ungu/indigo
          dipertahankan biar beda visual sama Assembling. */}
      <div style={{position:"relative" as const,overflow:"hidden",background:"linear-gradient(135deg,#eef2ff,#e0e7ff)",border:"1px solid #c7d2fe",borderRadius:14,padding:"20px 24px",marginBottom:18,display:"flex",alignItems:"center",gap:16}}>
        <div style={{width:56,height:56,borderRadius:14,background:"#4f46e5",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,boxShadow:"0 4px 12px #4f46e54d",zIndex:1}}>
          <i className="ti ti-bolt" style={{fontSize:28,color:"#fff"}}/>
        </div>
        <div style={{flex:1,minWidth:0,zIndex:1}}>
          <div style={{fontSize:19,fontWeight:800,color:"#1e293b"}}>Laporan Wiring Control (Komponen)</div>
          <div style={{fontSize:12.5,fontWeight:500,color:"#334155",marginTop:2}}>Pantau progres wiring per komponen (Box Control/Pintu) tiap panel - status dan dokumentasi foto.</div>
        </div>
        <div style={{position:"absolute" as const,right:-24,top:-30,width:150,height:150,borderRadius:"50%",background:"#4f46e51a"}}/>
        <div style={{position:"absolute" as const,right:60,bottom:-40,width:100,height:100,borderRadius:"50%",background:"#4f46e512"}}/>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:16}}>
        {PIPELINE_STATUS_LIST.map(s=>{
          const n=count4(s.key)
          const pct=total4>0?Math.round(n/total4*100):0
          const active=statusFilter===s.key
          return(
            <button key={s.key} onClick={()=>setStatusFilter(active?"ALL":s.key)}
              style={{textAlign:"left" as const,background:s.bg,border:`1.5px solid ${active?s.color:"transparent"}`,borderRadius:12,
                padding:"14px 16px",cursor:"pointer",boxShadow:active?`0 0 0 3px ${s.color}33`:"0 1px 3px rgba(0,0,0,0.05)",transition:"all .15s"}}>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
                <div style={{width:34,height:34,borderRadius:9,background:"#fff",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                  <i className={s.icon} style={{fontSize:16,color:s.color}}/>
                </div>
                <div style={{fontSize:11,fontWeight:700,color:s.color,textTransform:"uppercase" as const,letterSpacing:.3}}>{s.label}</div>
              </div>
              <div style={{fontSize:24,fontWeight:800,color:"#1e293b"}}>{n}</div>
              <div style={{fontSize:11,fontWeight:600,color:"#475569",marginTop:2}}>{pct}% dari total</div>
            </button>
          )
        })}
      </div>

      <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap" as const,alignItems:"center"}}>
        <input value={search} onChange={(e:any)=>setSearch(e.target.value)} placeholder="🔍 Cari panel, WO, atau proyek..."
          style={{height:36,padding:"0 12px",border:"1px solid #e2e8f0",borderRadius:8,fontSize:12.5,fontWeight:500,background:"#fff",outline:"none",color:"#1e293b",fontFamily:"inherit",flex:"1 1 220px",minWidth:180}}/>
        <select value={woFilterId==="ALL"?"ALL":String(woFilterId)} onChange={(e:any)=>setWoFilterId(e.target.value==="ALL"?"ALL":Number(e.target.value))}
          style={{height:36,padding:"0 10px",border:"1px solid #e2e8f0",borderRadius:8,fontSize:12.5,fontWeight:600,background:"#fff",color:"#1e293b",fontFamily:"inherit",cursor:"pointer"}}>
          <option value="ALL">Semua WO</option>
          {woOptions.map(w=><option key={w.id} value={w.id}>WO {w.wo?.wo} - {w.wo?.proyek}</option>)}
        </select>
        <select value={statusFilter} onChange={(e:any)=>setStatusFilter(e.target.value)}
          style={{height:36,padding:"0 10px",border:"1px solid #e2e8f0",borderRadius:8,fontSize:12.5,fontWeight:600,background:"#fff",color:"#1e293b",fontFamily:"inherit",cursor:"pointer"}}>
          <option value="ALL">Semua Status</option>
          {PIPELINE_STATUS_LIST.map(s=><option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
        {activeWoFolder&&(
          <button onClick={()=>downloadZipProyekWk(activeWoFolder)} disabled={zipBusy?.key===`wo_${activeWoFolder.woId}`}
            style={{height:36,padding:"0 14px",borderRadius:8,border:"1px solid #16a34a",background:"#fff",color:"#16a34a",fontSize:12,fontWeight:600,
              cursor:zipBusy?.key===`wo_${activeWoFolder.woId}`?"not-allowed":"pointer",whiteSpace:"nowrap" as const}}>
            {zipBusy?.key===`wo_${activeWoFolder.woId}`?`⏳ ${zipBusy.done}/${zipBusy.total}...`:"⬇️ ZIP Foto WO Ini"}
          </button>
        )}
      </div>

      {filtered.length===0?(
        <div style={{textAlign:"center",padding:50,color:"#94a3b8",background:"#fff",borderRadius:12,border:"1px solid #e2e8f0"}}>
          <i className="ti ti-clipboard-x" style={{fontSize:36,display:"block",marginBottom:10}}/>
          Tidak ada panel ditemukan
        </div>
      ):(
        <div style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:12,overflowX:"auto" as const}}>
          <table style={{width:"100%",borderCollapse:"collapse" as const,minWidth:760}}>
            <thead>
              <tr style={{background:"#f8fafc",borderBottom:"1.5px solid #e2e8f0"}}>
                {["No","WO / Panel","Proses","Status","Progress","Aksi"].map((h,i)=>(
                  <th key={h} style={{padding:"10px 14px",textAlign:i===0?"center" as const:"left" as const,fontSize:11,fontWeight:800,color:"#475569",textTransform:"uppercase" as const,letterSpacing:.4,whiteSpace:"nowrap" as const}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((p:any,i:number)=>{
                const statusDef=PIPELINE_STATUS_LIST.find(s=>s.key===p._pipelineStatus)||PIPELINE_STATUS_LIST[0]
                return(
                  <tr key={p.id} style={{borderBottom:i<filtered.length-1?"1px solid #f1f5f9":"none"}}>
                    <td style={{padding:"10px 14px",textAlign:"center" as const,fontSize:12,color:"#64748b",fontWeight:700}}>{i+1}</td>
                    <td style={{padding:"10px 14px"}}>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <i className="ti ti-folder" style={{fontSize:16,color:"#94a3b8",flexShrink:0}}/>
                        <div style={{minWidth:0}}>
                          <div style={{fontSize:13,fontWeight:700,color:"#1e293b",whiteSpace:"nowrap" as const}}>{p.nama}</div>
                          <div style={{fontSize:11,fontWeight:600,color:"#64748b"}}>WO {p._wo?.wo} - {p._wo?.proyek}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{padding:"10px 14px"}}>
                      <div style={{display:"flex",alignItems:"center",gap:6,fontSize:12,color:"#475569",fontWeight:600,whiteSpace:"nowrap" as const}}>
                        <i className="ti ti-bolt" style={{fontSize:14,color:"#4f46e5"}}/> Wiring Control
                      </div>
                      <div style={{fontSize:10.5,color:"#94a3b8",marginTop:2}}>{p._wkKomponen.map((k:any)=>k.nama).join(", ")}</div>
                    </td>
                    <td style={{padding:"10px 14px"}}>
                      <span style={{background:statusDef.bg,color:statusDef.color,borderRadius:20,padding:"3px 11px",fontSize:10.5,fontWeight:700,whiteSpace:"nowrap" as const}}>{statusDef.label}</span>
                    </td>
                    <td style={{padding:"10px 14px",minWidth:160}}>
                      <div style={{display:"flex",alignItems:"center",gap:6}}>
                        <div style={{flex:1,height:6,background:"#f1f5f9",borderRadius:99,overflow:"hidden"}}>
                          <div style={{width:`${p._wkPct}%`,height:"100%",background:"#4f46e5",borderRadius:99}}/>
                        </div>
                        <span style={{fontSize:11,fontWeight:700,color:"#475569",minWidth:32,textAlign:"right" as const}}>{p._wkPct}%</span>
                      </div>
                    </td>
                    <td style={{padding:"10px 14px"}}>
                      <button onClick={()=>setSelectedPanelId(p.id)}
                        style={{display:"flex",alignItems:"center",gap:4,height:28,padding:"0 12px",borderRadius:7,border:"1px solid #e0e7ff",background:"#eef2ff",color:"#4f46e5",fontSize:11,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap" as const}}>
                        Detail <i className="ti ti-chevron-right" style={{fontSize:12}}/>
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
