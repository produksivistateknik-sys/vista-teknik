// Thumbnail 1 file dokumentasi di grid (6 Okt 2026, dukungan video) - SALINAN vista-pekerja ui/ThumbMedia.tsx -
// tampilan video SAMA PERSIS yang sudah dipakai QCChecklistTab (frame <video> muted + ikon ▶ di
// tengah), foto tetap <img> seperti sebelumnya. Mengisi penuh kotak induknya.
export function ThumbMedia({url,video,radius,contain}:{url:string,video:boolean,radius?:number,contain?:boolean}){
  const fit=contain?"contain" as const:"cover" as const;
  return(
    <div style={{position:"relative" as const,width:"100%",height:"100%",borderRadius:radius,overflow:radius?"hidden":undefined}}>
      {video?(
        // #t=0.1 - biar browser HP (iOS) menampilkan frame pertama, bukan kotak hitam.
        <video src={url+"#t=0.1"} muted playsInline preload="metadata" style={{width:"100%",height:"100%",objectFit:fit,display:"block"}}/>
      ):(
        <img src={url} loading="lazy" style={{width:"100%",height:"100%",objectFit:fit,display:"block"}}/>
      )}
      {video&&(
        <div style={{position:"absolute" as const,inset:0,display:"flex",alignItems:"center",justifyContent:"center",pointerEvents:"none" as const}}>
          <i className="ti ti-player-play-filled" style={{fontSize:20,color:"#fff",filter:"drop-shadow(0 1px 3px rgba(0,0,0,0.5))"}}/>
        </div>
      )}
    </div>
  );
}
