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
  const [rutinLogList,setRutinLogList]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);
  useEffect(()=>{
    const load=async()=>{
      setLoading(true);
      const [{data:ms},{data:ml},{data:rl},{data:rll}]=await Promise.all([
        supabase.from("mesin").select("*").is("deleted_at",null).order("kode"),
        supabase.from("maintenance_log").select("*,mesin(nama,kode)").order("created_at",{ascending:false}),
        supabase.from("maintenance_rutin").select("*,mesin(nama,kode)").eq("is_active",true).order("jatuh_tempo"),
        supabase.from("maintenance_rutin_log").select("*").order("dilakukan_pada",{ascending:false}),
      ]);
      setMesinList(ms??[]);setMaintenanceList(ml??[]);setRutinList(rl??[]);setRutinLogList(rll??[]);setLoading(false);
    };load();
    // mesin bisa diedit dari SystemTab (Master Mesin) sementara tab ini kebuka bareng - refetch
    // silent (gak toggle `loading` yang nutup seluruh tab) biar list mesin di sini gak basi.
    const fetchMesin=async()=>{
      const{data}=await supabase.from("mesin").select("*").is("deleted_at",null).order("kode");
      setMesinList(data??[]);
    };
    // Rutin bisa "Tandai Selesai" dari 2 tempat sekaligus (Vista Teknik ATAU halaman public QR
    // yang di-scan pekerja) - refetch silent biar badge terlambat/jatuh tempo minggu ini di sini
    // auto-update tanpa perlu admin refresh manual, dari mana pun perubahannya datang.
    const fetchRutin=async()=>{
      const [{data:rl},{data:rll}]=await Promise.all([
        supabase.from("maintenance_rutin").select("*,mesin(nama,kode)").eq("is_active",true).order("jatuh_tempo"),
        supabase.from("maintenance_rutin_log").select("*").order("dilakukan_pada",{ascending:false}),
      ]);
      setRutinList(rl??[]);setRutinLogList(rll??[]);
    };
    const ch=supabase.channel("realtime-mesin-maintenance-page")
      .on("postgres_changes",{event:"*",schema:"public",table:"mesin"},fetchMesin)
      .on("postgres_changes",{event:"*",schema:"public",table:"maintenance_rutin"},fetchRutin)
      .on("postgres_changes",{event:"*",schema:"public",table:"maintenance_rutin_log"},fetchRutin)
      .subscribe();
    return()=>{supabase.removeChannel(ch);};
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
        <MaintenanceRutinTab mesinList={mesinList} rutinList={rutinList} setRutinList={setRutinList} rutinLogList={rutinLogList} user={user} today={today} terlambat={terlambat} mingguIni={mingguIni}/>
      }
    </div>
  );
}
