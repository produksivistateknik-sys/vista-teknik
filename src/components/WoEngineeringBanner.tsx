import { useState, useEffect } from 'react'
import { useWoEngineeringBroadcast, type WoEngineeringEvent } from '../lib/useWoEngineeringBroadcast'

// Banner broadcast "WO diubah Engineering" (17 Sep 2026, REDESAIN VISUAL - lihat komentar lama
// di git log kalau perlu histori bentuk sebelumnya: dulu bar tipis full-width solid, sekarang
// kartu mengambang) - TERPISAH dari bel notifikasi (App.tsx, agregat on-the-fly) dan dari
// fcs_notifikasi (boolean dibaca GLOBAL) - lihat lib/useWoEngineeringBroadcast.ts buat
// penjelasan lengkap kenapa 2 sistem lama itu gak dipakai.
//
// position:"fixed" (BUKAN "sticky" kayak versi bar sebelumnya) - kartu ini SENGAJA mengambang
// DI ATAS konten (bukan dorong konten turun) - background semi-transparan + blur (bukan solid
// pekat) justru dirancang biar gak berasa "nutupin", konten di baliknya masih samar keliatan.
// Center-top (bukan full-width lagi) - lebar dibatasi max 440px, sengaja HINDARI pojok kanan-atas
// (bel notifikasi/tombol Admin) dan area search bar (kiri-tengah) - dicek langsung tata letak
// header App.tsx, center-top genuinely kosong di kedua app.
//
// STACK, bukan 1-per-waktu lagi (REVISI dari desain awal 17 Sep 2026 pagi) - bentuk kartu diskrit
// (rounded, shadow, mengambang) jauh lebih cocok ditumpuk vertikal drpd bar tipis full-width yang
// dulu memang perlu dibatasi 1 biar gak jadi tumpukan bar yang berat. Tiap kartu urus animasi
// masuk/keluarnya SENDIRI (WoEngineeringCard di bawah) - keluar dari data (markAsRead) baru
// dipanggil SETELAH animasi keluar selesai, bukan seketika, biar kartu gak "kedip hilang".
export function WoEngineeringBanner({akun,topOffset=0}:{akun:string|null,topOffset?:number}){
  const{unread,markAsRead}=useWoEngineeringBroadcast(akun)
  if(unread.length===0)return null
  return(
    <div style={{position:"fixed",top:16+topOffset,left:"50%",transform:"translateX(-50%)",zIndex:10001,
      display:"flex",flexDirection:"column" as const,gap:10,
      width:"calc(100% - 32px)",maxWidth:440,pointerEvents:"none" as const}}>
      {unread.map(ev=><WoEngineeringCard key={ev.id} event={ev} onRead={markAsRead}/>)}
    </div>
  )
}

function WoEngineeringCard({event,onRead}:{event:WoEngineeringEvent,onRead:(id:number)=>void}){
  // Animasi masuk: mount dengan transform/opacity di posisi "off" (translateY(-24px) opacity 0),
  // 1 frame kemudian (requestAnimationFrame) pindah ke posisi final - transisi CSS yang jalan
  // di antara 2 state ini yang bikin efek slide-down+fade-in, ease-out 320ms.
  const[visible,setVisible]=useState(false)
  // Animasi keluar: klik "Sudah Dibaca" TIDAK langsung markAsRead (itu bakal bikin kartu ilang
  // seketika, gak sempat keliatan animasinya) - set closing dulu (slide-up+fade-out, ease-in
  // 250ms), markAsRead beneran dipanggil di setTimeout SETELAH durasi animasi itu kelar.
  const[closing,setClosing]=useState(false)
  useEffect(()=>{
    const raf=requestAnimationFrame(()=>setVisible(true))
    return()=>cancelAnimationFrame(raf)
  },[])
  const handleRead=()=>{
    setClosing(true)
    setTimeout(()=>onRead(event.id),260)
  }
  const jenisLabel=event.jenis_perubahan==="tambah"?"Ditambahkan":event.jenis_perubahan==="batal"?"Dibatalkan":"Diedit"
  const waktuRelatif=(()=>{
    const diffMin=Math.round((Date.now()-new Date(event.created_at).getTime())/60000)
    if(diffMin<1)return"baru saja"
    if(diffMin<60)return diffMin+" menit lalu"
    const diffJam=Math.round(diffMin/60)
    if(diffJam<24)return diffJam+" jam lalu"
    return Math.round(diffJam/24)+" hari lalu"
  })()
  return(
    <div style={{
      pointerEvents:closing?"none" as const:"auto" as const,
      transform:closing?"translateY(-16px)":visible?"translateY(0)":"translateY(-24px)",
      opacity:closing?0:visible?1:0,
      transition:closing
        ?"transform 250ms cubic-bezier(0.4,0,1,1), opacity 250ms cubic-bezier(0.4,0,1,1)"
        :"transform 320ms cubic-bezier(0.16,1,0.3,1), opacity 320ms ease-out",
      background:"rgba(67,56,202,0.85)",backdropFilter:"blur(14px) saturate(160%)",
      WebkitBackdropFilter:"blur(14px) saturate(160%)",
      border:"1px solid rgba(255,255,255,0.2)",borderRadius:16,
      boxShadow:"0 16px 40px rgba(67,56,202,0.35), 0 4px 14px rgba(15,23,42,0.14)",
      color:"#fff",padding:"14px 16px",fontFamily:"inherit"}}>
      <div style={{display:"flex",alignItems:"flex-start",gap:12}}>
        <div style={{flexShrink:0,width:38,height:38,borderRadius:11,background:"rgba(255,255,255,0.16)",
          display:"flex",alignItems:"center",justifyContent:"center",fontSize:19}}>🛠️</div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:14.5,fontWeight:800,lineHeight:1.35}}>WO {event.wo_number} - {event.proyek}</div>
          <div style={{marginTop:4,display:"flex",alignItems:"center",gap:6,flexWrap:"wrap" as const}}>
            <span style={{background:"rgba(255,255,255,0.18)",borderRadius:6,padding:"2px 8px",fontSize:11,fontWeight:700}}>{jenisLabel}</span>
            <span style={{fontSize:12.5,color:"#e0e7ff"}}>oleh <strong style={{color:"#fff"}}>{event.dilakukan_oleh}</strong></span>
          </div>
        </div>
      </div>
      <div style={{marginTop:12,display:"flex",alignItems:"center",justifyContent:"space-between",gap:10}}>
        <span style={{fontSize:11.5,color:"#c7d2fe"}}>{waktuRelatif}</span>
        <button onClick={handleRead}
          style={{padding:"7px 16px",borderRadius:9,border:"none",background:"#fff",color:"#4338ca",
            fontWeight:800,fontSize:12.5,cursor:"pointer",fontFamily:"inherit",flexShrink:0}}>
          ✓ Sudah Dibaca
        </button>
      </div>
    </div>
  )
}
