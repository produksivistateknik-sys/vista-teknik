import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { activityLogService } from '../services/activityLogService'
import { Card } from './ui/Primitives'

// Timer fcs_timer_kerja gak punya mekanisme auto-timeout sama sekali - kalau operator
// tutup app/koneksi putus sebelum klik "Selesai", row-nya nyangkut selesai=NULL selamanya
// (ghost timer). Fitur Arsip Panel yang pertama kali nyenggol masalah ini (blokir arsip
// kalau ada timer aktif) - tool ini buat admin bersihin ghost timer secara manual,
// per-baris, dengan konfirmasi jelas.
export function TimerAktifTab({user}:any){
  const [timers,setTimers]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);
  const [search,setSearch]=useState("");
  const [stopLoadingId,setStopLoadingId]=useState<number|null>(null);
  const [stopAllLoading,setStopAllLoading]=useState(false);

  const fetchTimers=async()=>{
    setLoading(true);
    const{data}=await supabase.from("fcs_timer_kerja").select("*,pekerja(nama)").is("selesai",null).order("mulai",{ascending:true});
    const rows=data??[];
    const panelIds=[...new Set(rows.map((t:any)=>t.panel_id).filter(Boolean))];
    const{data:panels}=panelIds.length>0?await supabase.from("panels").select("id,nama,wo_id").in("id",panelIds):{data:[]};
    const woIds=[...new Set((panels??[]).map((p:any)=>p.wo_id).filter(Boolean))];
    const{data:wos}=woIds.length>0?await supabase.from("work_orders").select("id,wo,proyek").in("id",woIds):{data:[]};
    const panelMap:Record<number,any>={};(panels??[]).forEach((p:any)=>{panelMap[p.id]=p;});
    const woMap:Record<number,any>={};(wos??[]).forEach((w:any)=>{woMap[w.id]=w;});
    const enriched=rows.map((t:any)=>{
      const panel=panelMap[t.panel_id];
      const wo=panel?woMap[panel.wo_id]:null;
      return{...t,_panelNama:panel?.nama||"(panel sudah dihapus/diarsip)",_wo:wo?.wo||"—",_proyek:wo?.proyek||"—"};
    });
    setTimers(enriched);
    setLoading(false);
  };
  useEffect(()=>{fetchTimers();},[]);

  const umurHari=(mulai:string)=>(Date.now()-new Date(mulai).getTime())/86400000;
  const umurColor=(h:number)=>h>7?"#dc2626":h>3?"#ea580c":h>1?"#d97706":"#16a34a";
  const umurLabel=(h:number)=>h<1?Math.round(h*24)+" jam":h.toFixed(1)+" hari";

  const filtered=timers.filter((t:any)=>{
    if(!search)return true;
    const s=search.toLowerCase();
    return t._panelNama?.toLowerCase().includes(s)||t._proyek?.toLowerCase().includes(s)||
      t._wo?.toLowerCase().includes(s)||t.pekerja?.nama?.toLowerCase().includes(s)||
      t.kode_komponen?.toLowerCase().includes(s);
  });

  const forceStop=async(t:any)=>{
    const hari=umurHari(t.mulai).toFixed(1);
    const ok=confirm(
      `Force-stop timer ini?\n\n`+
      `Panel: ${t._panelNama} (WO ${t._wo} - ${t._proyek})\n`+
      `Komponen: ${t.kode_komponen} · ${t.proses}${t.tahap?" · "+t.tahap:""}\n`+
      `Operator: ${t.pekerja?.nama||"?"}\n`+
      `Mulai: ${new Date(t.mulai).toLocaleString("id-ID")} (${hari} hari lalu)\n\n`+
      `Durasi kerja akan diset 0 menit (BUKAN ${hari} hari) - karena kita gak tau berapa lama `+
      `operator BENERAN kerja sebelum lupa/gagal klik Selesai. Kalau dibiarkan durasi asli, `+
      `statistik jam kerja jadi rusak.`
    );
    if(!ok)return;
    setStopLoadingId(t.id);
    const{error}=await supabase.from("fcs_timer_kerja").update({selesai:t.mulai}).eq("id",t.id);
    setStopLoadingId(null);
    if(error){alert("Gagal: "+error.message);return;}
    const sess=JSON.parse(localStorage.getItem("vista_admin_session")||"{}");
    const uname=user?.name||user?.nama||sess?.nama||"Admin";
    await activityLogService.insert({
      user_name:uname,action:"FORCE STOP TIMER",
      description:`Force-stop timer ${t.kode_komponen} (${t.proses}) panel ${t._panelNama} - operator ${t.pekerja?.nama||"?"}, sudah jalan ${hari} hari sejak ${t.mulai}`,
      module:"wo",halaman:"System - Timer Aktif",proyek:t._proyek,panel:t._panelNama,wo_number:t._wo,
    });
    setTimers(prev=>prev.filter((x:any)=>x.id!==t.id));
  };

  const forceStopAll=async()=>{
    if(filtered.length===0)return;
    const ok=confirm(
      `Force-stop SEMUA ${filtered.length} timer yang tampil${search?` (sesuai pencarian "${search}")`:""}?\n\n`+
      `Semua durasi kerja bakal diset 0 menit (bukan durasi ghost aslinya), sama seperti force-stop satu-satu. `+
      `Tindakan ini gak bisa dibatalkan per-item setelah jalan.`
    );
    if(!ok)return;
    setStopAllLoading(true);
    const targets=[...filtered];
    const doneIds=new Set<number>();
    const gagal:string[]=[];
    for(const t of targets){
      const{error}=await supabase.from("fcs_timer_kerja").update({selesai:t.mulai}).eq("id",t.id);
      if(error)gagal.push(`${t._panelNama} (${t.kode_komponen}): ${error.message}`);
      else doneIds.add(t.id);
    }
    setStopAllLoading(false);
    const sukses=doneIds.size;
    if(sukses>0){
      const sess=JSON.parse(localStorage.getItem("vista_admin_session")||"{}");
      const uname=user?.name||user?.nama||sess?.nama||"Admin";
      await activityLogService.insert({
        user_name:uname,action:"FORCE STOP TIMER (BULK)",
        description:`Force-stop massal ${sukses} timer aktif${search?` (filter pencarian: "${search}")`:""} - durasi di-set 0 menit`,
        module:"wo",halaman:"System - Timer Aktif",proyek:"",panel:"",
      });
    }
    setTimers(prev=>prev.filter((x:any)=>!doneIds.has(x.id)));
    if(gagal.length>0){
      alert(`${sukses} timer berhasil di-force-stop.\n\nGagal (${gagal.length}):\n`+gagal.join("\n"));
    } else {
      alert(`${sukses} timer berhasil di-force-stop.`);
    }
  };

  const thS:any={padding:"8px 12px",textAlign:"left",fontSize:10,color:"#64748b",fontWeight:700,background:"#f8fafc"};
  const td:any={padding:"9px 12px",borderTop:"1px solid #f1f5f9",fontSize:12,verticalAlign:"middle"};

  const bucket=(h:number)=>h>7?">7hari":h>3?"3-7hari":h>1?"1-3hari":"<1hari";
  const counts:Record<string,number>={};
  timers.forEach((t:any)=>{const b=bucket(umurHari(t.mulai));counts[b]=(counts[b]||0)+1;});

  return(
    <div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))",gap:10,marginBottom:16}}>
        {[
          {l:"Total Timer Aktif",v:timers.length,c:"#2563eb"},
          {l:"> 7 Hari (ghost)",v:counts[">7hari"]||0,c:"#dc2626"},
          {l:"3-7 Hari",v:counts["3-7hari"]||0,c:"#ea580c"},
          {l:"< 3 Hari (wajar)",v:(counts["<1hari"]||0)+(counts["1-3hari"]||0),c:"#16a34a"},
        ].map((s,i)=>(
          <Card key={i} style={{padding:"12px 16px",borderLeft:`3px solid ${s.c}`}}>
            <div style={{fontSize:20,fontWeight:800,color:s.c}}>{s.v}</div>
            <div style={{fontSize:10,color:"#94a3b8",fontWeight:600,textTransform:"uppercase" as const,letterSpacing:.3,marginTop:2}}>{s.l}</div>
          </Card>
        ))}
      </div>

      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12,flexWrap:"wrap" as const,gap:8}}>
        <p style={{fontSize:12,color:"#64748b",margin:0}}>Timer kerja yang belum di-"Selesai"-in - urut dari yang paling lama nyangkut. Force-stop cuma nutup timer-nya (durasi diset 0), gak ngubah progress/checklist.</p>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Cari panel/proyek/WO/operator..."
            style={{height:32,padding:"0 12px",border:"1px solid #e2e8f0",borderRadius:8,fontSize:12,width:220,outline:"none",fontFamily:"inherit"}}/>
          <button onClick={forceStopAll} disabled={stopAllLoading||filtered.length===0}
            style={{height:32,padding:"0 14px",borderRadius:8,border:"1px solid #fecaca",background:"#fef2f2",color:"#dc2626",
              cursor:(stopAllLoading||filtered.length===0)?"not-allowed":"pointer",fontSize:12,fontWeight:700,fontFamily:"inherit",whiteSpace:"nowrap" as const}}>
            {stopAllLoading?"⏳ Memproses...":`⏹ Force Stop Semua (${filtered.length})`}
          </button>
        </div>
      </div>

      {loading?(
        <div style={{textAlign:"center",padding:48,color:"#94a3b8"}}>Memuat timer aktif...</div>
      ):filtered.length===0?(
        <div style={{textAlign:"center",padding:48,color:"#94a3b8",background:"#fff",borderRadius:10,border:"1px solid #e2e8f0"}}>
          <div style={{fontSize:28,marginBottom:8}}>✅</div>
          Tidak ada timer aktif{search?" yang cocok dengan pencarian":""}
        </div>
      ):(
        <div style={{overflowX:"auto",borderRadius:10,border:"1px solid #e2e8f0"}}>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead><tr>
              <th style={thS}>WO</th>
              <th style={thS}>Proyek</th>
              <th style={thS}>Panel</th>
              <th style={thS}>Komponen / Proses</th>
              <th style={thS}>Operator</th>
              <th style={thS}>Mulai</th>
              <th style={{...thS,textAlign:"center"}}>Umur</th>
              <th style={{...thS,textAlign:"center"}}>Aksi</th>
            </tr></thead>
            <tbody>
              {filtered.map((t:any,i:number)=>{
                const h=umurHari(t.mulai);
                return(
                  <tr key={t.id} style={{background:i%2===0?"#fff":"#f8fafc"}}>
                    <td style={td}>{t._wo}</td>
                    <td style={td}>{t._proyek}</td>
                    <td style={{...td,fontWeight:700,color:"#1e293b"}}>{t._panelNama}</td>
                    <td style={td}>{t.kode_komponen} · {t.proses}{t.tahap?" · "+t.tahap:""}</td>
                    <td style={td}>{t.pekerja?.nama||"?"}</td>
                    <td style={{...td,fontSize:11,color:"#64748b"}}>{new Date(t.mulai).toLocaleString("id-ID")}</td>
                    <td style={{...td,textAlign:"center"}}>
                      <span style={{background:umurColor(h)+"18",color:umurColor(h),borderRadius:20,padding:"2px 9px",fontSize:10,fontWeight:700}}>{umurLabel(h)}</span>
                    </td>
                    <td style={{...td,textAlign:"center"}}>
                      <button onClick={()=>forceStop(t)} disabled={stopLoadingId===t.id}
                        style={{padding:"5px 12px",borderRadius:7,border:"1px solid #fecaca",background:"#fef2f2",color:"#dc2626",cursor:"pointer",fontSize:11,fontWeight:700}}>
                        {stopLoadingId===t.id?"⏳...":"⏹ Force Stop"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
