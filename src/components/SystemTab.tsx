import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { activityLogService } from '../services/activityLogService'
import { woOverall, panelOverall, calcPanelProgress } from '../lib/panelHelpers'
import { isDelayed, isUrgent } from '../lib/dateHelpers'
import { ALL_PROSES, DIVISI_CONFIG } from '../constants/panelTypes'
import { MasterUserTab } from './MasterUserTab'
import { MasterMesinTab } from './MasterMesinTab'
import { MasterPekerja } from './MasterPekerja'
import { InventarisWrapper } from './InventarisWrapper'
import { KapasitasPekerjaanTab } from './KapasitasPekerjaanTab'
import { RecycleBinTab } from './RecycleBinTab'

export function SystemTab({user,activityLog,pekerja,setPekerja,createPekerja,updatePekerja,removePekerja,logActivity,woData}){
  const [subTab,setSubTab]=useState("masteruser");
  const [admins,setAdmins]=useState([]);
  const [mesinList,setMesinList]=useState([]);
  const [maintenanceList,setMaintenanceList]=useState([]);
  const [loading,setLoading]=useState(true);

  useEffect(()=>{
    const fetchAll=async()=>{
      setLoading(true);
      const [{data:ad},{data:ms},{data:ml}]=await Promise.all([
        supabase.from("admins").select("*").order("created_at",{ascending:true}),
        supabase.from("mesin").select("*").is("deleted_at",null).order("kode",{ascending:true}),
        supabase.from("maintenance_log").select("*,mesin(nama,kode)").order("created_at",{ascending:false}),
      ]);
      setAdmins(ad??[]);setMesinList(ms??[]);setMaintenanceList(ml??[]);
      setLoading(false);
    };
    fetchAll();
    const ch=supabase.channel("realtime-maintenance-log")
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"maintenance_log"},
        async(payload)=>{
          const{data}=await supabase.from("maintenance_log").select("*,mesin(nama,kode)").eq("id",payload.new.id).single();
          if(data) setMaintenanceList(prev=>prev.some(m=>m.id===data.id)?prev:[data,...prev]);
        })
      .on("postgres_changes",{event:"UPDATE",schema:"public",table:"maintenance_log"},
        async(payload)=>{
          const{data}=await supabase.from("maintenance_log").select("*,mesin(nama,kode)").eq("id",payload.new.id).single();
          if(data) setMaintenanceList(prev=>prev.map(m=>m.id===data.id?data:m));
        })
      .on("postgres_changes",{event:"DELETE",schema:"public",table:"maintenance_log"},
        (payload)=>{setMaintenanceList(prev=>prev.filter(m=>m.id!==payload.old.id));})
      .subscribe();
    return()=>{supabase.removeChannel(ch);};
  },[]);

  const subTabs=[
    {id:"masteruser",label:"👤 Master User"},
    {id:"mesin",label:"⚙️ Master Mesin"},
    {id:"pekerja",label:"👥 Master Pekerja"},
    {id:"stok",label:"📦 Inventaris"},
    {id:"kapasitas",label:"🗄 Database"},
    {id:"recycle",label:"🗑 Recycle Bin"},
  ];

  return(
    <div className="fi">
      {/* Backup Excel Button */}
      <div style={{display:"flex",justifyContent:"flex-end",marginBottom:12}}>
        <button onClick={async()=>{
          try{
            // Dynamic import SheetJS
            const XLSX=(window as any).XLSX;
            if(!XLSX){alert("SheetJS belum dimuat, coba refresh halaman.");return;}
            const wb=XLSX.utils.book_new();

            // Sheet 1: Work Orders
            const woRows:any[]=[];
            woRows.push(["NO WO","PROYEK","TARGET","TOTAL PANEL","AVG PROGRESS","STATUS"]);
            woData?.forEach((w:any)=>{
              const pct=woOverall(w);
              const status=pct===100?"Selesai":isDelayed(w.target)?"Terlambat":isUrgent(w.target)?"Mendesak":"On Track";
              woRows.push([w.wo,w.proyek,w.target,(w.panels||[]).length+' panel',pct+'%',status]);
            });
            const ws1=XLSX.utils.aoa_to_sheet(woRows);
            XLSX.utils.book_append_sheet(wb,ws1,"Work Orders");

            // Sheet 2: Detail Progress per Panel
            const panelRows:any[]=[];
            panelRows.push(["WO","PROYEK","PANEL","TIPE","QTY","OVERALL",...ALL_PROSES]);
            (window as any).__vt_woData?.forEach((w:any)=>{
              (w.panels||[]).forEach((p:any)=>{
                const pd=calcPanelProgress(p);
                const overall=panelOverall(p);
                panelRows.push([w.wo,w.proyek,p.nama||p.name,p.tipe,
                  Object.values(p.checklist||{}).reduce((a:any,c:any)=>a+(c.qty||0),0),
                  overall+'%',...ALL_PROSES.map(pr=>(pd[pr]||0)+'%')]);
              });
            });
            const ws2=XLSX.utils.aoa_to_sheet(panelRows);
            XLSX.utils.book_append_sheet(wb,ws2,"Progress Panel");

            // Sheet 3: Pekerja
            const pkrRows:any[]=[];
            pkrRows.push(["NAMA","DIVISI"]);
            pekerja?.forEach((p:any)=>{
              const dc=(DIVISI_CONFIG as any)[p.divisi];
              pkrRows.push([p.nama,dc?.label||p.divisi]);
            });
            const ws3=XLSX.utils.aoa_to_sheet(pkrRows);
            XLSX.utils.book_append_sheet(wb,ws3,"Master Pekerja");

            // Sheet 4: Activity Log
            const logRows:any[]=[];
            logRows.push(["WAKTU","USER","AKSI","DESKRIPSI","MODULE","HALAMAN"]);
            activityLog?.slice(0,200).forEach((l:any)=>{
              logRows.push([l.created_at,l.user_name,l.action,l.description,l.module,l.halaman]);
            });
            const ws4=XLSX.utils.aoa_to_sheet(logRows);
            XLSX.utils.book_append_sheet(wb,ws4,"Activity Log");

            // Download
            const tgl=new Date().toISOString().slice(0,10);
            XLSX.writeFile(wb,`Vista_Teknik_Backup_${tgl}.xlsx`);

            // Activity log
            const sess=JSON.parse(localStorage.getItem("vista_admin_session")||"{}");
            await activityLogService.insert({
              user_name:user?.name||user?.nama||sess?.nama||"Admin",
              action:"BACKUP DATA",
              description:"Export backup data ke Excel",
              module:"system",halaman:"System"
            });
          }catch(e){
            alert("Gagal export: "+(e as any).message);
          }
        }}
        style={{display:"flex",alignItems:"center",gap:8,padding:"8px 16px",
          background:"#16a34a",color:"#fff",border:"none",borderRadius:8,
          cursor:"pointer",fontSize:12,fontWeight:700}}>
          📥 Backup ke Excel
        </button>
      </div>

      <div style={{display:"flex",gap:0,marginBottom:20,background:"var(--card-bg,#fff)",borderRadius:10,border:"1px solid var(--border-color,#e2e8f0)",overflow:"hidden"}}>
        {subTabs.map(t=>(
          <button key={t.id} onClick={()=>setSubTab(t.id)}
            style={{flex:1,padding:"10px 16px",border:"none",cursor:"pointer",fontSize:12,fontWeight:700,
              background:subTab===t.id?"#1d4ed8":"transparent",
              color:subTab===t.id?"#fff":"#64748b",
              borderRight:"1px solid #e2e8f0",transition:"all .15s"}}>
            {t.label}
          </button>
        ))}
      </div>
      {loading?(
        <div style={{textAlign:"center",padding:"40px",color:"#94a3b8"}}>Memuat data...</div>
      ):(
        <>
          {subTab==="masteruser"&&<MasterUserTab admins={admins} setAdmins={setAdmins} user={user} pekerja={pekerja}/>}
          {subTab==="mesin"&&<MasterMesinTab mesinList={mesinList} setMesinList={setMesinList} user={user}/>}

          {subTab==="pekerja"&&<MasterPekerja pekerja={pekerja} setPekerja={setPekerja} createPekerja={createPekerja} updatePekerja={updatePekerja} removePekerja={removePekerja} logActivity={logActivity} log={null} user={user}/>}
          {subTab==="stok"&&<InventarisWrapper user={user} activityLog={activityLog}/>}
          {subTab==="kapasitas"&&<KapasitasPekerjaanTab/>}
          {subTab==="recycle"&&<RecycleBinTab user={user}/>}
        </>
      )}
    </div>
  );
}
