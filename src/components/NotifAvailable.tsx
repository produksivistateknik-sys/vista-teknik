// Notifikasi "Operator Selesai Lebih Cepat" (fcs_notifikasi tipe available) + modal "Pilih Komponen Lain yang Bisa
// Diambil" (lompat ke modal edit sel hari ini dgn WP & komponen terpilih). DIPINDAH APA ADANYA dari RawSchedule.tsx
// (Tahap 3c migrasi accordion, 10 Okt 2026) supaya tampilan lama & "Raw Schedule per WP" sama. Muat ulang
// (fetchNotifAvailable) dipanggil induk - tampilan lama dari effect realtime kapasitasnya.
import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { TODAY, fmtDate } from '../lib/dateHelpers'
import { Modal } from './ui/Primitives'

export function useNotifAvailable({rawData,woData,getEffCfg,openCellModal,setModalWp,setModalKomponen,setModalBobotPerKomponen}:{
  rawData:any[];woData:any[];getEffCfg:(tipe:string)=>any;openCellModal:(rawId:number,date:string)=>void;
  setModalWp:(v:string)=>void;setModalKomponen:(v:any)=>void;setModalBobotPerKomponen:(f:any)=>void;
}){
  const [notifAvailable,setNotifAvailable]=useState<any[]>([]);
  const fetchNotifAvailable=async()=>{
    const{data}=await supabase.from("fcs_notifikasi").select("*").eq("dibaca",false).eq("tipe","available").order("created_at",{ascending:false});
    setNotifAvailable(data??[]);
  };

  const tandaiNotifDibaca=async(id:number)=>{
    await supabase.from("fcs_notifikasi").update({dibaca:true}).eq("id",id);
    setNotifAvailable(prev=>prev.filter((n:any)=>n.id!==id));
  };

  const [pilihKomponenModal,setPilihKomponenModal]=useState<any>(null);

  const getKomponenBelumDikerjakan=(proses:string):any[]=>{
    const hasil:any[]=[];
    rawData.filter((row:any)=>row.proses===proses).forEach((row:any)=>{
      const panelId=row.panel_id||row.panelId;
      const panelData=woData.flatMap((w:any)=>w.panels||[]).find((p:any)=>Number(p.id)===Number(panelId));
      if(!panelData)return;
      const sudahDitambah=new Set<string>();
      Object.values(row.schedule||{}).forEach((entries:any)=>{
        entries.forEach((entry:any)=>{
          (entry.komponen||[]).forEach((kode:string)=>{
            if(sudahDitambah.has(kode))return;
            const progress=panelData.checklist?.[kode]?.progress?.[proses]||0;
            if(progress>0)return;
            const cfg=getEffCfg(panelData.tipe);
            const item=cfg?.wps.flatMap((w:any)=>w.items).find((it:any)=>it.kode===kode);
            if(!item)return;
            sudahDitambah.add(kode);
            hasil.push({rawId:row.id,panelId,panel:row.panel,proyek:row.proyek,kode,nama:item.nama,wp:entry.wp});
          });
        });
      });
    });
    return hasil;
  };
  const elemenModal=(
    <>
      {pilihKomponenModal&&(
        <Modal title="Pilih Komponen Lain yang Bisa Diambil" onClose={()=>setPilihKomponenModal(null)} width={520}>
          <div style={{fontSize:11,color:"#64748b",marginBottom:12}}>
            Daftar komponen {pilihKomponenModal.proses} yang belum pernah dijadwalkan. Klik salah satu untuk lompat ke baris itu dan tambahkan ke hari ini.
          </div>
          {(()=>{
            const daftarKomponen=getKomponenBelumDikerjakan(pilihKomponenModal.proses);
            if(daftarKomponen.length===0){
              return(<div style={{textAlign:"center",padding:24,color:"#94a3b8",fontSize:12}}>Semua komponen sudah terjadwal</div>);
            }
            return(
              <div style={{display:"flex",flexDirection:"column" as const,gap:6,maxHeight:340,overflowY:"auto" as const}}>
                {daftarKomponen.map((k:any,ki:number)=>(
                  <button key={ki} onClick={async()=>{
                      await tandaiNotifDibaca(pilihKomponenModal.notifId);
                      setPilihKomponenModal(null);
                      openCellModal(k.rawId,TODAY);
                      setModalWp(k.wp);
                      const rowTarget=rawData.find((r:any)=>r.id===k.rawId);
                      const existingEntry=(rowTarget?.schedule?.[TODAY]||[]).find((e:any)=>e.wp===k.wp);
                      const panelDataTarget=woData.flatMap((w:any)=>w.panels||[]).find((p:any)=>Number(p.id)===Number(k.panelId));
                      const komponenLamaBelumSelesai=(existingEntry?.komponen||[]).filter((kd:string)=>{
                        if(kd.startsWith("__wiring_"))return false; // token bobot, bukan komponen asli
                        const progress=panelDataTarget?.checklist?.[kd]?.progress?.[pilihKomponenModal.proses]||0;
                        return progress<100;
                      });
                      setModalKomponen([...new Set([...komponenLamaBelumSelesai,k.kode])]);
                      setModalBobotPerKomponen((prev:any)=>({...prev,[k.kode]:prev[k.kode]??rowTarget?.bobot_komponen?.[k.kode]??"MEDIUM"}));
                    }}
                    style={{textAlign:"left" as const,display:"flex",justifyContent:"space-between",alignItems:"center",border:"1px solid #e2e8f0",borderRadius:8,padding:"10px 12px",cursor:"pointer",background:"#fff"}}>
                    <div>
                      <div style={{fontSize:12,fontWeight:600,color:"#1e293b"}}>{k.nama}<span style={{fontSize:10,color:"#94a3b8",marginLeft:4}}>({k.kode})</span></div>
                      <div style={{fontSize:10,color:"#64748b"}}>{k.panel} · {k.proyek}</div>
                    </div>
                    <i className="ti ti-arrow-right" style={{fontSize:14,color:"#1d4ed8"}}/>
                  </button>
                ))}
              </div>
            );
          })()}
        </Modal>
      )}
    </>
  );
  const elemenBanner=(
    <>
      {notifAvailable.length>0&&(
        <div style={{background:"#eff6ff",border:"1px solid #bfdbfe",borderRadius:8,padding:"12px 14px",marginBottom:14}}>
          <div style={{fontSize:11,fontWeight:700,color:"#1d4ed8",textTransform:"uppercase" as const,letterSpacing:.4,marginBottom:10}}>
            💡 Operator Selesai Lebih Cepat ({notifAvailable.length})
          </div>
          <div style={{display:"flex",flexDirection:"column" as const,gap:8}}>
            {notifAvailable.map((n:any)=>(
              <div key={n.id} style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10,background:"#fff",borderRadius:8,padding:"10px 12px",border:"1px solid #dbeafe"}}>
                <div style={{flex:1}}>
                  <div style={{fontSize:12,color:"#1e293b"}}>
                    <strong>{n.pekerja_nama}</strong> selesai <strong>{n.nama_komponen}</strong> ({n.panel_nama}) lebih cepat
                  </div>
                  <div style={{fontSize:10,color:"#64748b",marginTop:2}}>
                    Rencana selesai {fmtDate(n.tanggal_rencana_selesai)}, aktual {fmtDate(n.tanggal_aktual_selesai)}. Ada komponen lain yang bisa diambil.
                  </div>
                </div>
                <div style={{display:"flex",flexDirection:"column" as const,gap:4}}>
                  <button onClick={()=>setPilihKomponenModal({notifId:n.id,proses:n.proses})}
                    style={{background:"#1d4ed8",border:"none",borderRadius:6,padding:"4px 10px",cursor:"pointer",fontSize:10,color:"#fff",fontWeight:700,whiteSpace:"nowrap" as const}}>Pilih Komponen</button>
                  <button onClick={()=>tandaiNotifDibaca(n.id)}
                    style={{background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:6,padding:"3px 8px",cursor:"pointer",fontSize:10,color:"#64748b",whiteSpace:"nowrap" as const}}>Tandai dibaca</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
  return{fetchNotifAvailable,elemenModal,elemenBanner};
}
