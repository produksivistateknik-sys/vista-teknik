// Filter status pipeline (Not Yet/To Do/In Progress/Done), REUSE dari styling pill-button yang
// sudah ada di LaporanQCView.tsx (QC_STATUS_LIST) - dipakai di sub-tab Quality Center lain
// (Nameplate, Komponen, Warehouse, QS) yang sebelumnya gak punya filter status sama sekali.
// QC sendiri TIDAK disentuh/dipindah ke sini - filternya cuma 3-state (To Do/In Progress/
// Complete) dan sudah punya implementasinya sendiri, biar gak ada resiko regresi di situ.
export const PIPELINE_STATUS_LIST=[
  {key:"NOT_YET",label:"Not Yet",color:"#94a3b8",bg:"#f8fafc",icon:"ti ti-lock"},
  {key:"TO_DO",label:"To Do",color:"#64748b",bg:"#f1f5f9",icon:"ti ti-circle-dashed"},
  {key:"IN_PROGRESS",label:"In Progress",color:"#ea580c",bg:"#fff7ed",icon:"ti ti-loader-2"},
  {key:"DONE",label:"Done",color:"#16a34a",bg:"#f0fdf4",icon:"ti ti-circle-check"},
] as const

export type PipelineStatusKey=typeof PIPELINE_STATUS_LIST[number]["key"]

// counts WAJIB dihitung dari data SEBELUM statusFilter diterapkan (biasanya basePool yang
// sudah kena filter search/outstanding-finished, tapi BELUM kena statusFilter) - biar angka di
// tiap tombol tetap nunjukin total yang bener walau salah satu tombol lagi aktif.
export function PipelineStatusFilterTabs({statusList,statusFilter,setStatusFilter,counts}:{
  statusList:readonly{key:string,label:string,color:string,bg:string,icon:string}[]
  statusFilter:string
  setStatusFilter:(k:string)=>void
  counts:Record<string,number>
}){
  const total=statusList.reduce((s,x)=>s+(counts[x.key]||0),0)
  return(
    <div style={{display:"flex",gap:6,marginLeft:"auto",flexWrap:"wrap" as const}}>
      <button onClick={()=>setStatusFilter("ALL")}
        style={{padding:"6px 14px",borderRadius:20,border:statusFilter==="ALL"?"1.5px solid #1d4ed8":"1.5px solid #e2e8f0",
          background:statusFilter==="ALL"?"#1d4ed8":"#fff",color:statusFilter==="ALL"?"#fff":"#64748b",fontSize:11,fontWeight:700,cursor:"pointer"}}>
        Semua ({total})
      </button>
      {statusList.map(s=>(
        <button key={s.key} onClick={()=>setStatusFilter(s.key)}
          style={{padding:"6px 14px",borderRadius:20,border:statusFilter===s.key?`1.5px solid ${s.color}`:"1.5px solid #e2e8f0",
            background:statusFilter===s.key?s.color:"#fff",color:statusFilter===s.key?"#fff":"#64748b",fontSize:11,fontWeight:700,cursor:"pointer"}}>
          {s.label} ({counts[s.key]||0})
        </button>
      ))}
    </div>
  )
}
