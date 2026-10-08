import { useRef, useState } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// MEDIA PICKER SHEET - bottom sheet pilihan (Ambil Foto / Rekam Video* / Galeri / Tambahkan File*)
// yang dipasang di depan input file yang sudah ada di tiap lokasi upload foto.
// TIDAK mengubah cara file diproses/disimpan - onFiles() dipanggil dengan
// FileList yang sama persis seperti kalau input file diklik langsung, jadi
// handler existing di tiap komponen (compressImageNp, staging, dst) tetap jalan
// apa adanya. allowVideo/allowAnyFile default false - HANYA QC yang saat ini
// mengaktifkan keduanya (viewer & pipeline upload lain belum siap render
// video/file non-gambar, lihat FotoZoomViewerPekerja).
// ─────────────────────────────────────────────────────────────────────────────
export function MediaPickerSheet({onFiles,disabled,allowVideo=false,allowAnyFile=false,multiple=true,children,triggerStyle,triggerClassName}:{
  onFiles:(files:FileList)=>void,
  disabled?:boolean,
  allowVideo?:boolean,
  allowAnyFile?:boolean,
  multiple?:boolean,
  children:React.ReactNode,
  triggerStyle?:any,
  triggerClassName?:string,
}){
  const[open,setOpen]=useState(false);
  const cameraRef=useRef<HTMLInputElement>(null);
  const videoRef=useRef<HTMLInputElement>(null);
  const galleryRef=useRef<HTMLInputElement>(null);
  const fileRef=useRef<HTMLInputElement>(null);
  const mediaAccept=allowVideo?"image/*,video/*":"image/*";
  // FIX (8 Okt 2026, "Tambah Foto langsung buka GALERI" - Nameplate & Wiring Control sejak video
  // ditambahkan 6 Okt): input kamera dulu accept="image/*,video/*" + capture + multiple. Chrome
  // Android (termasuk PWA dari ikon layar utama) cuma langsung membuka kamera kalau accept berisi
  // SATU jenis media & tanpa multiple - gabungan foto+video membuat banyak HP membuka pemilih/galeri.
  // Sekarang kamera foto & perekam video dipisah, masing-masing 1 jenis media, tanpa multiple
  // (kamera memang cuma menghasilkan 1 file per jepretan). Pilih banyak file tetap lewat Galeri.

  const handlePick=(e:any)=>{
    if(e.target.files&&e.target.files.length>0)onFiles(e.target.files);
    e.target.value="";
  };

  return(
    <>
      <label className={triggerClassName} style={triggerStyle}
        onClick={(e:any)=>{e.preventDefault();if(!disabled)setOpen(true);}}>
        {children}
      </label>
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" disabled={disabled} style={{display:"none"}} onChange={handlePick}/>
      {allowVideo&&<input ref={videoRef} type="file" accept="video/*" capture="environment" disabled={disabled} style={{display:"none"}} onChange={handlePick}/>}
      <input ref={galleryRef} type="file" accept={mediaAccept} multiple={multiple} disabled={disabled} style={{display:"none"}} onChange={handlePick}/>
      {allowAnyFile&&<input ref={fileRef} type="file" multiple={multiple} disabled={disabled} style={{display:"none"}} onChange={handlePick}/>}
      {open&&(
        <div onClick={()=>setOpen(false)}
          style={{position:"fixed" as const,inset:0,background:"rgba(15,23,42,0.5)",zIndex:9998,display:"flex",alignItems:"flex-end" as const}}>
          <div onClick={(e:any)=>e.stopPropagation()}
            style={{width:"100%",background:"#fff",borderRadius:"18px 18px 0 0",padding:"8px 14px calc(14px + env(safe-area-inset-bottom))",boxShadow:"0 -8px 30px rgba(0,0,0,0.18)"}}>
            <div style={{width:36,height:4,borderRadius:99,background:"#e2e8f0",margin:"6px auto 12px"}}/>
            <div style={{fontSize:12,fontWeight:700,color:"#94a3b8",padding:"0 6px 10px"}}>Tambah {allowVideo?"Foto/Video":"Foto"}</div>
            <button onClick={()=>{setOpen(false);cameraRef.current?.click();}}
              style={{width:"100%",display:"flex",alignItems:"center",gap:12,padding:"13px 10px",background:"none",border:"none",borderRadius:10,cursor:"pointer",fontSize:14,fontWeight:600,color:"#1e293b",textAlign:"left" as const}}>
              <span style={{width:36,height:36,borderRadius:10,background:"#eff6ff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:17,flexShrink:0}}>📷</span>
              Ambil Foto
            </button>
            {allowVideo&&(
              <button onClick={()=>{setOpen(false);videoRef.current?.click();}}
                style={{width:"100%",display:"flex",alignItems:"center",gap:12,padding:"13px 10px",background:"none",border:"none",borderRadius:10,cursor:"pointer",fontSize:14,fontWeight:600,color:"#1e293b",textAlign:"left" as const}}>
                <span style={{width:36,height:36,borderRadius:10,background:"#fdf2f8",display:"flex",alignItems:"center",justifyContent:"center",fontSize:17,flexShrink:0}}>🎥</span>
                Rekam Video
              </button>
            )}
            <button onClick={()=>{setOpen(false);galleryRef.current?.click();}}
              style={{width:"100%",display:"flex",alignItems:"center",gap:12,padding:"13px 10px",background:"none",border:"none",borderRadius:10,cursor:"pointer",fontSize:14,fontWeight:600,color:"#1e293b",textAlign:"left" as const}}>
              <span style={{width:36,height:36,borderRadius:10,background:"#f0fdf4",display:"flex",alignItems:"center",justifyContent:"center",fontSize:17,flexShrink:0}}>🖼️</span>
              Dari Galeri
            </button>
            {allowAnyFile&&(
              <button onClick={()=>{setOpen(false);fileRef.current?.click();}}
                style={{width:"100%",display:"flex",alignItems:"center",gap:12,padding:"13px 10px",background:"none",border:"none",borderRadius:10,cursor:"pointer",fontSize:14,fontWeight:600,color:"#1e293b",textAlign:"left" as const}}>
                <span style={{width:36,height:36,borderRadius:10,background:"#fefce8",display:"flex",alignItems:"center",justifyContent:"center",fontSize:17,flexShrink:0}}>📎</span>
                Tambahkan File
              </button>
            )}
            <button onClick={()=>setOpen(false)}
              style={{width:"100%",marginTop:6,padding:"12px 10px",background:"#f8fafc",border:"none",borderRadius:10,cursor:"pointer",fontSize:13,fontWeight:700,color:"#64748b"}}>
              Batal
            </button>
          </div>
        </div>
      )}
    </>
  );
}
