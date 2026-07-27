import { useState } from 'react'
import { LaporanQCView } from './LaporanQCView'
import { LaporanNameplateView } from './LaporanNameplateView'
import { LaporanPasangKomponenView } from './LaporanPasangKomponenView'
import { LaporanKomponenProgressView } from './LaporanKomponenProgressView'
import { TrackingKomponenAdmin } from './TrackingKomponenAdmin'

const TUGAS_WAREHOUSE_LAPORAN={field:"warehouse",label:"Warehouse",icon:"📦",color:"#0d9488",progressField:"warehouse_progress",fotoField:"warehouse_photos"}
const TUGAS_QS_LAPORAN={field:"qs",label:"QS",icon:"📋",color:"#7c3aed",progressField:"qs_progress",fotoField:"qs_photos"}

const SUBTAB_TRACKING=[
  {key:"qc",label:"QC",icon:"ti ti-clipboard-check"},
  {key:"nameplate",label:"Nameplate",icon:"ti ti-tag"},
  {key:"pasangkomponen",label:"Pasang Komponen",icon:"ti ti-plug"},
  {key:"warehouse",label:"Warehouse",icon:"ti ti-building-warehouse"},
  {key:"qs",label:"QS",icon:"ti ti-clipboard-list"},
  {key:"komponen",label:"Komponen",icon:"ti ti-package"},
] as const

export function TrackingView({woData}:{woData:any[]}){
  const[subTab,setSubTab]=useState<typeof SUBTAB_TRACKING[number]["key"]>("qc")

  return(
    <div>
      <div style={{display:"flex",gap:6,marginBottom:18,borderBottom:"1px solid #e2e8f0",flexWrap:"wrap" as const}}>
        {SUBTAB_TRACKING.map(s=>(
          <button key={s.key} onClick={()=>setSubTab(s.key)}
            style={{display:"flex",alignItems:"center",gap:6,padding:"10px 16px",border:"none",background:"none",cursor:"pointer",
              borderBottom:subTab===s.key?"2.5px solid #1d4ed8":"2.5px solid transparent",
              color:subTab===s.key?"#1d4ed8":"#64748b",fontWeight:700,fontSize:13}}>
            <i className={s.icon} style={{fontSize:15}}/> {s.label}
          </button>
        ))}
      </div>
      <div style={{display:subTab==="qc"?"block":"none"}}><LaporanQCView woData={woData}/></div>
      <div style={{display:subTab==="nameplate"?"block":"none"}}><LaporanNameplateView woData={woData}/></div>
      <div style={{display:subTab==="pasangkomponen"?"block":"none"}}><LaporanPasangKomponenView woData={woData}/></div>
      <div style={{display:subTab==="warehouse"?"block":"none"}}><LaporanKomponenProgressView woData={woData} tugas={TUGAS_WAREHOUSE_LAPORAN}/></div>
      <div style={{display:subTab==="qs"?"block":"none"}}><LaporanKomponenProgressView woData={woData} tugas={TUGAS_QS_LAPORAN}/></div>
      <div style={{display:subTab==="komponen"?"block":"none"}}><TrackingKomponenAdmin/></div>
    </div>
  )
}
