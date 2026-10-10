// Riwayat Perubahan Qty (qty_change_log, realtime) - tombol 🔔 + laci kanan. DIPINDAH APA ADANYA dari
// RawSchedule.tsx (Tahap 3c migrasi accordion, 10 Okt 2026) supaya tampilan lama & "Raw Schedule per WP" sama.
// Klik baris = saring tampilan ke proyek/panel itu (setFilterProyek/setFilterPanel milik induk).
import { useState, useEffect } from 'react'
import { supabase as supabaseAsli } from '../lib/supabase'
import { WP_COLOR } from '../constants/panelTypes'

// bacaSaja (Raw Schedule per WP, mode baca saja 10 Okt 2026): tombol "✓ Konfirmasi" (tulis qty_change_log) disembunyikan.
// db (opsional): klien bergaya Supabase lain (sandbox Raw Schedule per WP: salinan di memori, tanpa realtime nyata).
export function useRiwayatQty({setFilterProyek,setFilterPanel,bacaSaja=false,db}:{setFilterProyek:(v:string[])=>void;setFilterPanel:(v:string[])=>void;bacaSaja?:boolean;db?:any}){
  const supabase=db??supabaseAsli;
  const [riwayatOpen,setRiwayatOpen]=useState(false);
  const [qtyChangeLog,setQtyChangeLog]=useState<any[]>([]);
  const [qtyChangeUnread,setQtyChangeUnread]=useState(0);
  const fetchQtyChangeLog=async()=>{
    const{data}=await supabase.from("qty_change_log").select("*").order("created_at",{ascending:false}).limit(100);
    setQtyChangeLog(data||[]);
    setQtyChangeUnread((data||[]).filter((d:any)=>!d.is_read).length);
  };
  useEffect(()=>{
    fetchQtyChangeLog();
    const ch=supabase.channel("realtime-qty-change-log-rawschedule")
      .on("postgres_changes",{event:"*",schema:"public",table:"qty_change_log"},fetchQtyChangeLog)
      .subscribe();
    return()=>{supabase.removeChannel(ch);};
  },[]);
  const openRiwayat=()=>{
    setRiwayatOpen(true);
  };
  const confirmQtyChange=async(id:number)=>{
    await supabase.from("qty_change_log").update({is_read:true}).eq("id",id);
    setQtyChangeLog(prev=>prev.map(d=>d.id===id?{...d,is_read:true}:d));
    setQtyChangeUnread(prev=>Math.max(0,prev-1));
  };
  const elemen=(
    <>
      {riwayatOpen&&(
        <div onClick={()=>setRiwayatOpen(false)} style={{position:"fixed" as const,inset:0,background:"rgba(0,0,0,0.4)",zIndex:10000,display:"flex",justifyContent:"flex-end"}}>
          <div onClick={(e:any)=>e.stopPropagation()} style={{width:380,maxWidth:"100%",background:"#fff",height:"100%",padding:20,overflowY:"auto" as const,boxShadow:"-4px 0 20px rgba(0,0,0,0.15)"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
              <div style={{fontWeight:800,fontSize:16}}>Riwayat Perubahan Qty</div>
              <button onClick={()=>setRiwayatOpen(false)} style={{background:"none",border:"none",cursor:"pointer",fontSize:18,color:"#94a3b8"}}>✕</button>
            </div>
            <div style={{fontSize:12,color:"#64748b",marginBottom:16}}>Perubahan qty komponen dari Manajemen WO.</div>
            {qtyChangeLog.length===0?(
              <div style={{textAlign:"center" as const,color:"#94a3b8",fontSize:12,padding:"30px 0"}}>Belum ada riwayat perubahan.</div>
            ):(
              <div style={{display:"flex",flexDirection:"column" as const,gap:8}}>
                {qtyChangeLog.map((d:any)=>{
                  const naik=Number(d.qty_baru)>Number(d.qty_lama);
                  return(
                    <div key={d.id} onClick={()=>{setFilterProyek(d.proyek?[d.proyek]:[]);setFilterPanel(d.panel?[d.panel]:[]);setRiwayatOpen(false);}}
                      title="Klik buat langsung liat baris ini di Raw Schedule"
                      style={{background:"#f8fafc",borderRadius:8,padding:"10px 12px",cursor:"pointer",border:"1px solid transparent",transition:"border-color .15s"}}
                      onMouseEnter={(e:any)=>e.currentTarget.style.borderColor="#93c5fd"}
                      onMouseLeave={(e:any)=>e.currentTarget.style.borderColor="transparent"}>
                      <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"#64748b",marginBottom:4}}>
                        <span>{d.proyek} · {d.panel}</span>
                        <span>{new Date(d.created_at).toLocaleString("id-ID",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})}</span>
                      </div>
                      <div style={{display:"flex",alignItems:"center",gap:8,fontSize:13}}>
                        {d.wp&&<span style={{background:WP_COLOR[d.wp]||"#64748b",color:"#fff",borderRadius:6,padding:"2px 8px",fontSize:11,fontWeight:700}}>{d.wp}</span>}
                        <span style={{flex:1}}>{d.nama_komponen}</span>
                        <span style={{color:"#94a3b8"}}>{d.qty_lama}</span>
                        <span style={{color:"#94a3b8"}}>→</span>
                        <span style={{color:naik?"#16a34a":"#dc2626",fontWeight:700}}>{d.qty_baru}</span>
                      </div>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:6}}>
                        <div style={{fontSize:10,color:"#94a3b8"}}>Diubah oleh {d.changed_by}</div>
                        {d.is_read?(
                          <span style={{fontSize:10,color:"#16a34a",fontWeight:600}}>✓ Sudah dibaca</span>
                        ):bacaSaja?(
                          <span style={{fontSize:10,color:"#94a3b8"}}>Belum dibaca</span>
                        ):(
                          <button onClick={(e:any)=>{e.stopPropagation();confirmQtyChange(d.id);}} style={{padding:"3px 10px",borderRadius:6,border:"1px solid #16a34a",background:"#f0fdf4",color:"#16a34a",fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>✓ Konfirmasi</button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
  return{elemen,openRiwayat,qtyChangeUnread};
}
