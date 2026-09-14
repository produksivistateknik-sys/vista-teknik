import { useState, useMemo } from 'react'
import { downloadFotoSebagaiZip, sanitizeNamaFile, type FotoZipItem } from '../lib/downloadHelpers'
import { calcPanelProgress, isKomponenRelevant, getEffCfgGlobal, computeProsesStatus, getBestProgressMap, getRelevantProsesForKode } from '../lib/panelHelpers'
import { PipelineStatusFilterTabs, PIPELINE_STATUS_LIST } from './ui/PipelineStatusFilter'
import { FotoZoomViewer } from './FotoZoomViewer'

const STATUS_LABEL_PK:Record<string,{label:string,bg:string,color:string}>={
  belum:{label:"Belum Mulai",bg:"#f1f5f9",color:"#64748b"},
  proses:{label:"Sedang Dikerjakan",bg:"#fff7ed",color:"#ea580c"},
  selesai:{label:"Selesai",bg:"#f0fdf4",color:"#16a34a"},
}

// Box Control/Pintu (progress dari checklist[kode].pasangKomponenTahap.ASSEMBLING, BUKAN
// checklist[kode].progress["PASANG KOMPONEN"]) gak punya gating resmi di sistem manapun -
// REUSE ambang RAKIT yang udah dipakai computeProsesStatus buat WIRING CONTROL/POWER (proses
// yang posisinya sama persis di alur kerja, sama-sama "abis RAKIT"). Komponen non-tahap
// (Groundplate dst) pakai computeProsesStatus asli dengan proses="PASANG KOMPONEN".
const RANK_PIPELINE:Record<string,number>={"NOT YET":0,"TO DO":1,"IN PROGRESS":2,"DONE":3}
const kodePipelineStatusPk=(panel:any,kode:string,pct:number,isTahap:boolean):string=>{
  if(pct>=100)return"DONE"
  if(pct>0)return"IN PROGRESS"
  const progressMap=getBestProgressMap(panel.checklist?.[kode])
  if(isTahap)return(progressMap?.["RAKIT"]||0)>0?"TO DO":"NOT YET"
  return computeProsesStatus(progressMap,"PASANG KOMPONEN",getRelevantProsesForKode(kode,panel.tipe))
}
// Roll-up panel = status TERBAIK di antara semua komponennya (begitu ada 1 komponen yang udah
// bisa dikerjakan/jalan, panel dianggap gak "Not Yet" lagi) - DONE per-komponen digambar ulang
// jadi IN_PROGRESS di level panel, karena "Done" panel tetap dari definisi lama (pct rata2>=100
// DAN ada foto) yang sudah dicek duluan sebelum fungsi ini dipanggil.
const panelPipelineStatusPk=(panel:any,komponenList:{kode:string,nama:string,pct:number}[],tahapNama:string[]):string=>{
  if(komponenList.length===0)return"NOT_YET"
  const best=komponenList.map(k=>kodePipelineStatusPk(panel,k.kode,k.pct,tahapNama.includes(k.nama)))
    .reduce((acc,s)=>RANK_PIPELINE[s]>RANK_PIPELINE[acc]?s:acc,"NOT YET")
  if(best==="DONE")return"IN_PROGRESS"
  if(best==="IN PROGRESS")return"IN_PROGRESS"
  if(best==="TO DO")return"TO_DO"
  return"NOT_YET"
}

// Sama kriteria dengan Nameplate/Yellowmark - progress Fabrikasi 100% DAN minimal 1 foto
// Pemasangan, biar konsisten di semua tempat. Progress di sini diambil dari rata-rata
// checklist per-komponen (calcPanelProgress) - Pasang Komponen TETAP proses qty-per-komponen
// biasa, cuma dilihat di sini sebagai satu angka gabungan per panel.
// BUG FIX (14 Agu 2026): "ada foto" sebelumnya cuma dicek dari pasang_komponen_photos
// (galeri panel-wide) - panel yang fotonya cuma ada di checklist[kode].fotoPemasangan
// (galeri per-komponen) salah ke-flag "belum selesai" walau progress 100% dan sudah ada
// dokumentasi foto (dikonfirmasi lewat data live: 4 dari 50 panel kena kasus ini).
// Boolean, bukan angka gabungan - jumlahFoto cuma pernah dipakai buat cek >=1/>0 di sini,
// gak ada tempat lain di laporan ini yang butuh hitungan foto presisi dari nilai ini.
const statusPasangKomponen=(pct:number,adaFoto:boolean)=>{
  if(pct>=100&&adaFoto)return"selesai"
  if(pct>0||adaFoto)return"proses"
  return"belum"
}

export function LaporanPasangKomponenView({woData}:{woData:any[]}){
  const[search,setSearch]=useState("")
  const[selectedPanelId,setSelectedPanelId]=useState<number|null>(null)
  const[lightbox,setLightbox]=useState<any>(null)
  const[zipBusy,setZipBusy]=useState<{key:string,done:number,total:number}|null>(null)
  const[statusFilter,setStatusFilter]=useState("ALL")
  // woFilterId (14 Sep 2026, redesign ikut gaya QC) - gantiin selectedWoId(folder-drill) versi
  // lama, sekarang dropdown filter di atas tabel flat. subTab(outstanding/finished) DIHAPUS -
  // kartu Done (klik-toggle) udah nyakup fungsi yang sama.
  const[woFilterId,setWoFilterId]=useState<number|"ALL">("ALL")

  const fotoPkPanel=(panel:any):FotoZipItem[]=>{
    const fotoList=panel.pasang_komponen_photos||[]
    return fotoList.map((f:any,fi:number)=>({url:f.url,path:`foto_${fi+1}.jpg`}))
  }

  const downloadZipPanelPk=async(panel:any)=>{
    const items=fotoPkPanel(panel)
    if(items.length===0){alert("Belum ada foto untuk panel ini");return}
    const key=`panel_${panel.id}`
    setZipBusy({key,done:0,total:items.length})
    const{gagal}=await downloadFotoSebagaiZip(items,`PasangKomponen_${sanitizeNamaFile(panel.nama)}.zip`,(done,total)=>setZipBusy({key,done,total}))
    setZipBusy(null)
    if(gagal>0)alert(`${gagal} foto gagal diunduh, sisanya berhasil masuk ZIP`)
  }

  const downloadZipProyekPk=async(folder:{woId:number,wo:any,panels:any[]})=>{
    const items:FotoZipItem[]=[]
    folder.panels.forEach((p:any)=>{
      fotoPkPanel(p).forEach(it=>items.push({...it,path:`${sanitizeNamaFile(p.nama)}/${it.path}`}))
    })
    if(items.length===0){alert("Belum ada foto untuk proyek ini");return}
    const key=`wo_${folder.woId}`
    setZipBusy({key,done:0,total:items.length})
    const{gagal}=await downloadFotoSebagaiZip(items,`PasangKomponen_${sanitizeNamaFile(folder.wo?.proyek||folder.wo?.wo||"proyek")}.zip`,(done,total)=>setZipBusy({key,done,total}))
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

  // Box Control/Pintu (lihat PASANG_KOMPONEN_TAHAP_KOMPONEN_NAMA di Vista Pekerja) punya
  // progress["PASANG KOMPONEN"] gabungan dari 2 kontribusi terpisah (ASSEMBLING + WIRING) -
  // laporan Assembling ini cuma nampilin kontribusi ASSEMBLING-nya sendiri, bukan angka
  // gabungan, biar konsisten sama laporan Wiring Control yang juga cuma nampilin punya sendiri.
  const KOMPONEN_TAHAP_NAMA=["Box Control","Pintu"]
  const komponenPanel=(panel:any)=>{
    const cfg=getEffCfgGlobal(panel.tipe)
    if(!cfg)return[]
    const items=cfg.wps.flatMap((w:any)=>w.items)
    return items
      .filter((it:any)=>(panel.checklist?.[it.kode]?.qty||0)>0&&isKomponenRelevant(it.kode,panel.tipe,"PASANG KOMPONEN"))
      .map((it:any)=>{
        const cl=panel.checklist?.[it.kode]
        const pct=KOMPONEN_TAHAP_NAMA.includes(it.nama)?(cl?.pasangKomponenTahap?.ASSEMBLING?.progress||0):(cl?.progress?.["PASANG KOMPONEN"]||0)
        return{kode:it.kode,nama:it.nama,pct}
      })
  }

  const withStatus=useMemo(()=>allPanels.map((p:any)=>{
    const pct=calcPanelProgress(p)["PASANG KOMPONEN"]||0
    const adaFoto=(p.pasang_komponen_photos||[]).length>0||Object.values(p.checklist||{}).some((cl:any)=>(cl?.fotoPemasangan||[]).length>0)
    const pkStatus=statusPasangKomponen(pct,adaFoto)
    const pipelineStatus=pkStatus==="selesai"?"DONE":panelPipelineStatusPk(p,komponenPanel(p),KOMPONEN_TAHAP_NAMA)
    return{...p,_pkPct:pct,_pkStatus:pkStatus,_pipelineStatus:pipelineStatus}
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
    const sb=STATUS_LABEL_PK[selectedPanel._pkStatus]
    const foto=selectedPanel.pasang_komponen_photos||[]
    const komponenList=komponenPanel(selectedPanel)
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
          <button onClick={()=>downloadZipPanelPk(selectedPanel)} disabled={zipBusy?.key===`panel_${selectedPanel.id}`}
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
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <span style={{fontSize:12,fontWeight:700,color:selectedPanel._pkPct>=100?"#16a34a":"#64748b"}}>Fabrikasi {selectedPanel._pkPct}%</span>
              <span style={{background:sb.bg,color:sb.color,borderRadius:20,padding:"3px 10px",fontSize:10.5,fontWeight:700}}>{sb.label}</span>
            </div>
          </div>
        </div>

        <div style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:10,padding:16,marginBottom:12}}>
          <div style={{fontSize:9.5,fontWeight:700,color:"#94a3b8",marginBottom:10,letterSpacing:.4}}>SECTION 1 · FABRIKASI PER KOMPONEN</div>
          {komponenList.length===0?(
            <div style={{fontSize:11,color:"#cbd5e1",fontStyle:"italic" as const}}>Tidak ada komponen Pasang Komponen untuk panel ini</div>
          ):(
            <div style={{display:"flex",flexDirection:"column" as const,gap:8}}>
              {komponenList.map((k:any)=>(
                <div key={k.kode} style={{display:"flex",alignItems:"center",gap:10}}>
                  <span style={{flex:1,fontSize:12,color:"#374151",fontWeight:600}}>{k.nama}</span>
                  <div style={{width:100,background:"#e2e8f0",borderRadius:99,height:7,overflow:"hidden"}}>
                    <div style={{width:`${k.pct}%`,height:"100%",background:k.pct>=100?"#16a34a":"#f97316",borderRadius:99}}/>
                  </div>
                  <span style={{fontSize:11,fontWeight:700,color:k.pct>=100?"#16a34a":"#64748b",minWidth:32,textAlign:"right" as const}}>{k.pct}%</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:10,padding:16,marginBottom:12}}>
          <div style={{fontSize:9.5,fontWeight:700,color:"#94a3b8",marginBottom:10,letterSpacing:.4}}>SECTION 2 · PEMASANGAN (FOTO)</div>
          {foto.length>0?(
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(120px,1fr))",gap:8}}>
              {foto.map((f:any,fi:number)=>(
                <div key={fi} onClick={()=>setLightbox({fotos:foto,index:fi,label:`PasangKomponen_${selectedPanel.nama}`})} style={{cursor:"pointer"}} className="pk-foto-print">
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

  const total4=bySearch.length
  const count4=(key:string)=>statusCounts[key]||0

  return(
    <div className="fi">
      {/* Banner + 4 kartu + search/filter/tabel - ikut gaya QC (14 Sep 2026) */}
      <div style={{position:"relative" as const,overflow:"hidden",background:"linear-gradient(135deg,#eff6ff,#dbeafe)",border:"1px solid #bfdbfe",borderRadius:14,padding:"20px 24px",marginBottom:18,display:"flex",alignItems:"center",gap:16}}>
        <div style={{width:56,height:56,borderRadius:14,background:"#1d4ed8",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,boxShadow:"0 4px 12px #1d4ed84d",zIndex:1}}>
          <i className="ti ti-tool" style={{fontSize:28,color:"#fff"}}/>
        </div>
        <div style={{flex:1,minWidth:0,zIndex:1}}>
          <div style={{fontSize:19,fontWeight:800,color:"#1e293b"}}>Laporan Assembling (Pasang Komponen)</div>
          <div style={{fontSize:12.5,fontWeight:500,color:"#334155",marginTop:2}}>Pantau progres fabrikasi dan pemasangan komponen tiap panel - status dan dokumentasi foto.</div>
        </div>
        <div style={{position:"absolute" as const,right:-24,top:-30,width:150,height:150,borderRadius:"50%",background:"#1d4ed81a"}}/>
        <div style={{position:"absolute" as const,right:60,bottom:-40,width:100,height:100,borderRadius:"50%",background:"#1d4ed812"}}/>
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
          <button onClick={()=>downloadZipProyekPk(activeWoFolder)} disabled={zipBusy?.key===`wo_${activeWoFolder.woId}`}
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
                        <i className="ti ti-tool" style={{fontSize:14,color:"#1d4ed8"}}/> Assembling
                      </div>
                    </td>
                    <td style={{padding:"10px 14px"}}>
                      <span style={{background:statusDef.bg,color:statusDef.color,borderRadius:20,padding:"3px 11px",fontSize:10.5,fontWeight:700,whiteSpace:"nowrap" as const}}>{statusDef.label}</span>
                    </td>
                    <td style={{padding:"10px 14px",minWidth:160}}>
                      <div style={{display:"flex",alignItems:"center",gap:6}}>
                        <div style={{flex:1,height:6,background:"#f1f5f9",borderRadius:99,overflow:"hidden"}}>
                          <div style={{width:`${p._pkPct}%`,height:"100%",background:"#1d4ed8",borderRadius:99}}/>
                        </div>
                        <span style={{fontSize:11,fontWeight:700,color:"#475569",minWidth:32,textAlign:"right" as const}}>{p._pkPct}%</span>
                      </div>
                    </td>
                    <td style={{padding:"10px 14px"}}>
                      <button onClick={()=>setSelectedPanelId(p.id)}
                        style={{display:"flex",alignItems:"center",gap:4,height:28,padding:"0 12px",borderRadius:7,border:"1px solid #dbeafe",background:"#eff6ff",color:"#1d4ed8",fontSize:11,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap" as const}}>
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
