import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { getLocalDateStr } from '../lib/dateHelpers'
import { KerusakanTab } from './KerusakanTab'
import { MaintenanceRutinTab } from './MaintenanceRutinTab'

export function MaintenancePageTab({user}:any){
  const [subTab,setSubTab]=useState("kerusakan");
  const [mesinList,setMesinList]=useState<any[]>([]);
  const [maintenanceList,setMaintenanceList]=useState<any[]>([]);
  const [rutinList,setRutinList]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);
  useEffect(()=>{
    const load=async()=>{
      setLoading(true);
      const [{data:ms},{data:ml},{data:rl}]=await Promise.all([
        supabase.from("mesin").select("*").is("deleted_at",null).order("kode"),
        supabase.from("maintenance_log").select("*,mesin(nama,kode)").order("created_at",{ascending:false}),
        supabase.from("maintenance_rutin").select("*,mesin(nama,kode)").eq("is_active",true).order("jatuh_tempo"),
      ]);
      setMesinList(ms??[]);setMaintenanceList(ml??[]);setRutinList(rl??[]);setLoading(false);
    };load();
  },[]);
  const today=getLocalDateStr();
  const terlambat=rutinList.filter((r:any)=>r.jatuh_tempo&&r.jatuh_tempo<today);
  const mingguIni=rutinList.filter((r:any)=>{
    if(!r.jatuh_tempo||r.jatuh_tempo<today)return false;
    const diff=(new Date(r.jatuh_tempo).getTime()-new Date(today).getTime())/86400000;
    return diff<=7;
  });
  return(
    <div className="fi">
      <div style={{display:"flex",gap:0,marginBottom:16,background:"var(--card-bg,#fff)",borderRadius:10,border:"1px solid var(--border-color,#e2e8f0)",overflow:"hidden",width:"fit-content"}}>
        {[{id:"kerusakan",label:"Kerusakan"},{id:"rutin",label:"Maintenance Rutin"}].map((t:any)=>(
          <button key={t.id} onClick={()=>setSubTab(t.id)}
            style={{padding:"9px 20px",border:"none",cursor:"pointer",fontSize:12,fontWeight:700,
              background:subTab===t.id?"#1d4ed8":"transparent",
              color:subTab===t.id?"#fff":"#64748b",
              borderRight:"1px solid #e2e8f0",transition:"all .15s"}}>
            {t.label}
          </button>
        ))}
      </div>
      {loading?<div style={{textAlign:"center",padding:"40px",color:"#94a3b8"}}>Memuat data...</div>:
        subTab==="kerusakan"?
        <KerusakanTab mesinList={mesinList} maintenanceList={maintenanceList} setMaintenanceList={setMaintenanceList} user={user}/>:
        <MaintenanceRutinTab mesinList={mesinList} rutinList={rutinList} setRutinList={setRutinList} user={user} today={today} terlambat={terlambat} mingguIni={mingguIni}/>
      }
    </div>
  );
}
