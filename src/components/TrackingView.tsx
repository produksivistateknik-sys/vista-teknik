import { useState } from 'react'
import { LaporanQCView } from './LaporanQCView'
import { LaporanNameplateView } from './LaporanNameplateView'
import { LaporanPasangKomponenView } from './LaporanPasangKomponenView'
import { LaporanWiringKomponenView } from './LaporanWiringKomponenView'
import { LaporanKomponenProgressView } from './LaporanKomponenProgressView'

const TUGAS_WAREHOUSE_LAPORAN={field:"warehouse",label:"Warehouse",icon:"📦",color:"#0d9488",progressField:"warehouse_progress",fotoField:"warehouse_photos"}
// gateField (8 Agu 2026): QS baru dianggap "siap dikerjakan" (bukan Not Yet) begitu
// warehouse_progress panel itu udah mulai (>0) - alur kerja pabrik: QC -> Warehouse -> QS.
// Warehouse sendiri sengaja TANPA gateField (belum ada sinyal readiness yang jelas dari QC),
// jadi filternya tetap 3-state (To Do/In Progress/Done) kayak QC.
const TUGAS_QS_LAPORAN={field:"qs",label:"QS",icon:"📋",color:"#7c3aed",progressField:"qs_progress",fotoField:"qs_photos",gateField:"warehouse_progress"}

// Tab "Komponen" LAMA (TrackingKomponenAdmin, arsip alur lama Assembling/Warehouse/QS) sengaja
// dihilangkan - datanya sudah gak dipakai lagi (Warehouse/QS pindah ke sub-tab sendiri di atas).
// File komponennya TIDAK dihapus (masih ada di repo), cuma gak di-render lagi dari sini.
// Tab "Komponen" di bawah ini BEDA - gabungan Assembling (Pasang Komponen) & Wiring Control
// (Box Control/Pintu), dua-duanya masih data AKTIF.
const SUBTAB_TRACKING=[
  {key:"qc",label:"QC",icon:"ti ti-clipboard-check"},
  {key:"nameplate",label:"Nameplate",icon:"ti ti-tag"},
  {key:"komponen",label:"Komponen",icon:"ti ti-plug"},
  {key:"warehouse",label:"Warehouse",icon:"ti ti-building-warehouse"},
  {key:"qs",label:"QS",icon:"ti ti-clipboard-list"},
] as const

const SUBTAB_KOMPONEN=[
  {key:"assembling",label:"Assembling"},
  {key:"wiring",label:"Wiring Control"},
] as const

export function TrackingView({woData}:{woData:any[]}){
  const[subTab,setSubTab]=useState<typeof SUBTAB_TRACKING[number]["key"]>("qc")
  const[subTabKomponen,setSubTabKomponen]=useState<typeof SUBTAB_KOMPONEN[number]["key"]>("assembling")

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
      <div style={{display:subTab==="komponen"?"block":"none"}}>
        <div style={{display:"flex",gap:8,marginBottom:16}}>
          {SUBTAB_KOMPONEN.map(s=>(
            <button key={s.key} onClick={()=>setSubTabKomponen(s.key)}
              style={{padding:"7px 16px",borderRadius:20,border:`1.5px solid ${subTabKomponen===s.key?"#1d4ed8":"#e2e8f0"}`,
                background:subTabKomponen===s.key?"#1d4ed8":"#fff",color:subTabKomponen===s.key?"#fff":"#64748b",
                cursor:"pointer",fontSize:12.5,fontWeight:700}}>
              {s.label}
            </button>
          ))}
        </div>
        <div style={{display:subTabKomponen==="assembling"?"block":"none"}}><LaporanPasangKomponenView woData={woData}/></div>
        <div style={{display:subTabKomponen==="wiring"?"block":"none"}}><LaporanWiringKomponenView woData={woData}/></div>
      </div>
      <div style={{display:subTab==="warehouse"?"block":"none"}}><LaporanKomponenProgressView woData={woData} tugas={TUGAS_WAREHOUSE_LAPORAN}/></div>
      <div style={{display:subTab==="qs"?"block":"none"}}><LaporanKomponenProgressView woData={woData} tugas={TUGAS_QS_LAPORAN}/></div>
    </div>
  )
}
