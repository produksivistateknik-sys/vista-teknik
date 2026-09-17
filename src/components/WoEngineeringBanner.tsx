import { useWoEngineeringBroadcast } from '../lib/useWoEngineeringBroadcast'

// Banner broadcast "WO diubah Engineering" (17 Sep 2026, fitur baru) - TERPISAH dari bel
// notifikasi (App.tsx, agregat on-the-fly) dan dari fcs_notifikasi (boolean dibaca GLOBAL) -
// lihat lib/useWoEngineeringBroadcast.ts buat penjelasan lengkap kenapa 2 sistem lama itu gak
// dipakai. Menempel di layar sampai user pencet "Sudah Dibaca" - GAK hilang sendiri kayak toast
// biasa. position:"sticky" (BUKAN "fixed", ketemu pas verifikasi live - fixed nimpa header
// aplikasi di bawahnya karena gak ada yang "ngasih tempat", sticky otomatis dorong konten di
// bawahnya turun karena tetap ikut alur dokumen normal, sambil tetap nempel di atas layar pas
// discroll). Warna solid #4338ca (indigo) SENGAJA kuat/kontras tinggi (bukan
// abu-abu gelap kayak banner reload) + font lebih besar dari banner lain di app ini - diminta
// eksplisit user "aku mau banner tersebut terbaca dengan jelas". Warna sama dipakai badge
// "Engineering" di MasterUserTab.tsx (#4338ca) - biar user langsung asosiasi "ini soal
// Engineering" dari warnanya doang, konsisten sama konvensi warna yang sudah ada.
// Kalau >1 event belum dibaca: SATU per waktu (bukan ditumpuk), urut PALING LAMA dulu (FIFO) -
// counter kecil "1/3" nunjukin masih ada berapa nunggu, biar gak berasa "ilang" tau-tau abis
// diklik sekali padahal masih ada 2 lagi.
export function WoEngineeringBanner({akun,topOffset=0}:{akun:string|null,topOffset?:number}){
  const{current,unreadCount,markAsRead}=useWoEngineeringBroadcast(akun)
  if(!current)return null
  const jenisLabel=current.jenis_perubahan==="tambah"?"DITAMBAHKAN":"DIEDIT"
  const waktuRelatif=(()=>{
    const diffMin=Math.round((Date.now()-new Date(current.created_at).getTime())/60000)
    if(diffMin<1)return"baru saja"
    if(diffMin<60)return diffMin+" menit lalu"
    const diffJam=Math.round(diffMin/60)
    if(diffJam<24)return diffJam+" jam lalu"
    return Math.round(diffJam/24)+" hari lalu"
  })()
  return(
    <div style={{position:"sticky",top:topOffset,left:0,right:0,zIndex:10001,
      background:"#4338ca",color:"#fff",boxShadow:"0 2px 12px rgba(67,56,202,0.4)",
      display:"flex",alignItems:"center",justifyContent:"center",gap:14,
      padding:"12px 20px",fontSize:14,flexWrap:"wrap" as const,textAlign:"center" as const}}>
      <span style={{fontSize:20,flexShrink:0}}>🛠️</span>
      <span style={{lineHeight:1.4}}>
        <strong style={{fontSize:15}}>WO {current.wo_number} - {current.proyek}</strong>
        {" "}<strong style={{background:"#ffffff2a",borderRadius:6,padding:"2px 8px"}}>{jenisLabel}</strong>
        {" "}oleh <strong>{current.dilakukan_oleh}</strong>
        <span style={{color:"#e0e7ff",fontWeight:500}}> · {waktuRelatif}</span>
      </span>
      {unreadCount>1&&(
        <span style={{background:"#ffffff2a",borderRadius:20,padding:"3px 10px",fontSize:12,fontWeight:700,flexShrink:0}}>
          1/{unreadCount}
        </span>
      )}
      <button onClick={()=>markAsRead(current.id)}
        style={{padding:"7px 18px",borderRadius:8,border:"none",background:"#fff",color:"#4338ca",
          fontWeight:800,fontSize:13,cursor:"pointer",fontFamily:"inherit",flexShrink:0}}>
        ✓ Sudah Dibaca
      </button>
    </div>
  )
}
