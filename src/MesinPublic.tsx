import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'

export default function MesinPublic(){
  const [mesin,setMesin]=useState<any>(null)
  const [rutinList,setRutinList]=useState<any[]>([])
  const [logList,setLogList]=useState<any[]>([])
  const [loading,setLoading]=useState(true)
  const [notFound,setNotFound]=useState(false)

  const mesinId=new URLSearchParams(window.location.search).get("id")

  useEffect(()=>{
    if(!mesinId){setNotFound(true);setLoading(false);return}
    fetchData()
  },[mesinId])

  const fetchData=async()=>{
    const [{data:m},{data:r},{data:l}]=await Promise.all([
      supabase.from("mesin").select("*").eq("id",mesinId).single(),
      supabase.from("maintenance_rutin").select("*").eq("mesin_id",mesinId).eq("is_active",true).order("jatuh_tempo",{ascending:true}),
      supabase.from("maintenance_log").select("*").eq("mesin_id",mesinId).order("created_at",{ascending:false}).limit(5),
    ])
    if(!m){setNotFound(true);setLoading(false);return}
    setMesin(m)
    setRutinList(r??[])
    setLogList(l??[])
    setLoading(false)
  }

  const fmtDate=(d:string)=>d?new Date(d).toLocaleDateString("id-ID",{day:"numeric",month:"short",year:"numeric"}):"-"
  const today=new Date().toISOString().slice(0,10)

  const getDaysLeft=(target:string)=>{
    if(!target)return null
    const diff=Math.ceil((new Date(target).getTime()-new Date(today).getTime())/(1000*60*60*24))
    return diff
  }

  const getDaysBadge=(d:number|null)=>{
    if(d===null)return{label:"—",bg:"#f1f5f9",color:"#64748b"}
    if(d<0)return{label:`Terlambat ${Math.abs(d)} hr`,bg:"#FCEBEB",color:"#A32D2D"}
    if(d<=3)return{label:`H-${d}`,bg:"#FAEEDA",color:"#854F0B"}
    if(d<=7)return{label:`H-${d}`,bg:"#FEF3C7",color:"#92400E"}
    return{label:`H-${d}`,bg:"#EAF3DE",color:"#3B6D11"}
  }

  const STATUS_COLOR:any={aktif:"#16a34a",maintenance:"#f59e0b",nonaktif:"#94a3b8"}
  const LOG_STATUS:any={
    open:{bg:"#FCEBEB",color:"#A32D2D",label:"Open"},
    in_progress:{bg:"#FAEEDA",color:"#854F0B",label:"In Progress"},
    closed:{bg:"#EAF3DE",color:"#3B6D11",label:"Selesai"},
  }

  if(loading)return(
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#f8fafc",fontFamily:"Inter,sans-serif"}}>
      <div style={{color:"#94a3b8",fontSize:14}}>Memuat data mesin...</div>
    </div>
  )

  if(notFound)return(
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#f8fafc",fontFamily:"Inter,sans-serif"}}>
      <div style={{textAlign:"center",color:"#94a3b8"}}>
        <div style={{fontSize:40,marginBottom:12}}>⚙️</div>
        <div style={{fontSize:16,fontWeight:600,color:"#1e293b",marginBottom:6}}>Mesin tidak ditemukan</div>
        <div style={{fontSize:13}}>ID mesin tidak valid atau sudah dihapus</div>
      </div>
    </div>
  )

  const nearestRutin=rutinList[0]
  const daysLeft=getDaysLeft(nearestRutin?.jatuh_tempo)
  const daysBadge=getDaysBadge(daysLeft)
  const lastLog=logList[0]

  return(
    <div style={{minHeight:"100vh",background:"#f0f4f8",fontFamily:"Inter,sans-serif",paddingBottom:32}}>
      {/* Header */}
      <div style={{background:"#1e3a5f",padding:"14px 20px",display:"flex",alignItems:"center",gap:12}}>
        <div style={{width:32,height:32,background:"#3b82f6",borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:700,color:"#fff",flexShrink:0}}>VT</div>
        <div>
          <div style={{fontSize:14,fontWeight:600,color:"#fff"}}>Vista Teknik</div>
          <div style={{fontSize:11,color:"#93c5fd"}}>Info Mesin · Maintenance</div>
        </div>
      </div>

      <div style={{maxWidth:480,margin:"0 auto",padding:"16px 16px 0"}}>

        {/* Mesin Card */}
        <div style={{background:"#fff",borderRadius:12,border:"1px solid #e2e8f0",padding:"14px 16px",marginBottom:12,display:"flex",alignItems:"center",gap:12}}>
          <div style={{width:44,height:44,background:"#EAF3DE",borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:20}}>⚙️</div>
          <div style={{flex:1}}>
            <div style={{fontSize:16,fontWeight:700,color:"#1e293b"}}>{mesin.nama}</div>
            <div style={{fontSize:12,color:"#64748b",marginTop:2,fontFamily:"monospace"}}>{mesin.kode}{mesin.lokasi?" · "+mesin.lokasi:""}</div>
          </div>
          <span style={{background:(STATUS_COLOR[mesin.status]||"#94a3b8")+"18",color:STATUS_COLOR[mesin.status]||"#94a3b8",border:`1px solid ${STATUS_COLOR[mesin.status]||"#94a3b8"}33`,borderRadius:20,padding:"3px 10px",fontSize:11,fontWeight:700}}>
            {mesin.status||"—"}
          </span>
        </div>

        {/* Stat row */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:12}}>
          <div style={{background:"#fff",borderRadius:8,border:"1px solid #e2e8f0",padding:"10px 12px"}}>
            <div style={{fontSize:9,color:"#94a3b8",fontWeight:600,textTransform:"uppercase",letterSpacing:.4,marginBottom:4}}>Status</div>
            <div style={{fontSize:12,fontWeight:700,color:STATUS_COLOR[mesin.status]||"#94a3b8"}}>{mesin.status||"—"}</div>
          </div>
          <div style={{background:"#fff",borderRadius:8,border:"1px solid #e2e8f0",padding:"10px 12px"}}>
            <div style={{fontSize:9,color:"#94a3b8",fontWeight:600,textTransform:"uppercase",letterSpacing:.4,marginBottom:4}}>Maintenance terakhir</div>
            <div style={{fontSize:11,fontWeight:600,color:"#1e293b"}}>{lastLog?fmtDate(lastLog.tgl_perbaikan||lastLog.tgl_kendala):"—"}</div>
          </div>
          <div style={{background:"#fff",borderRadius:8,border:"1px solid #e2e8f0",padding:"10px 12px"}}>
            <div style={{fontSize:9,color:"#94a3b8",fontWeight:600,textTransform:"uppercase",letterSpacing:.4,marginBottom:4}}>Jatuh tempo</div>
            <div style={{fontSize:12,fontWeight:700,color:daysBadge.color}}>{nearestRutin?daysBadge.label:"—"}</div>
          </div>
        </div>

        {/* Jadwal Rutin */}
        <div style={{background:"#fff",borderRadius:12,border:"1px solid #e2e8f0",marginBottom:12,overflow:"hidden"}}>
          <div style={{padding:"10px 14px",borderBottom:"1px solid #f1f5f9",display:"flex",alignItems:"center",gap:6}}>
            <span style={{fontSize:14}}>📅</span>
            <span style={{fontSize:12,fontWeight:700,color:"#1e293b"}}>Jadwal Maintenance Rutin</span>
            <span style={{marginLeft:"auto",fontSize:10,color:"#94a3b8"}}>{rutinList.length} jadwal aktif</span>
          </div>
          {rutinList.length===0?(
            <div style={{padding:"20px",textAlign:"center",color:"#94a3b8",fontSize:12}}>Belum ada jadwal rutin</div>
          ):rutinList.map((r:any,i:number)=>{
            const d=getDaysLeft(r.jatuh_tempo)
            const b=getDaysBadge(d)
            return(
              <div key={i} style={{padding:"10px 14px",borderBottom:i<rutinList.length-1?"1px solid #f1f5f9":"none",display:"flex",alignItems:"center",gap:10}}>
                <div style={{width:8,height:8,borderRadius:"50%",background:b.color,flexShrink:0}}/>
                <div style={{flex:1}}>
                  <div style={{fontSize:12,fontWeight:600,color:"#1e293b"}}>{r.jenis_maintenance}</div>
                  <div style={{fontSize:10,color:"#94a3b8",marginTop:2}}>
                    {r.frekuensi&&<span>{r.frekuensi} · </span>}
                    {r.teknisi&&<span>Teknisi: {r.teknisi}</span>}
                  </div>
                </div>
                <span style={{background:b.bg,color:b.color,borderRadius:20,padding:"2px 9px",fontSize:10,fontWeight:700,whiteSpace:"nowrap"}}>{b.label}</span>
              </div>
            )
          })}
        </div>

        {/* Log Kerusakan */}
        <div style={{background:"#fff",borderRadius:12,border:"1px solid #e2e8f0",overflow:"hidden"}}>
          <div style={{padding:"10px 14px",borderBottom:"1px solid #f1f5f9",display:"flex",alignItems:"center",gap:6}}>
            <span style={{fontSize:14}}>📋</span>
            <span style={{fontSize:12,fontWeight:700,color:"#1e293b"}}>Log Kerusakan Terakhir</span>
          </div>
          {logList.length===0?(
            <div style={{padding:"20px",textAlign:"center",color:"#94a3b8",fontSize:12}}>Belum ada log kerusakan</div>
          ):logList.map((l:any,i:number)=>{
            const ls=LOG_STATUS[l.status]||{bg:"#f1f5f9",color:"#64748b",label:l.status}
            return(
              <div key={i} style={{padding:"10px 14px",borderBottom:i<logList.length-1?"1px solid #f1f5f9":"none",display:"flex",gap:10,alignItems:"flex-start"}}>
                <div style={{fontSize:10,color:"#94a3b8",minWidth:72,flexShrink:0,paddingTop:2}}>{fmtDate(l.tgl_kendala||l.created_at?.slice(0,10))}</div>
                <div style={{flex:1}}>
                  <div style={{fontSize:12,color:"#1e293b",fontWeight:500}}>{l.kendala||"—"}</div>
                  {l.teknisi&&<div style={{fontSize:10,color:"#94a3b8",marginTop:2}}>Teknisi: {l.teknisi}</div>}
                </div>
                <span style={{background:ls.bg,color:ls.color,borderRadius:4,padding:"2px 7px",fontSize:9,fontWeight:700,flexShrink:0}}>{ls.label}</span>
              </div>
            )
          })}
        </div>

        <div style={{textAlign:"center",marginTop:20,fontSize:10,color:"#cbd5e1"}}>Vista Teknik ERP · Data realtime</div>
      </div>
    </div>
  )
}
