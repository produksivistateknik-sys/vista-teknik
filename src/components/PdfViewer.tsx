import { useEffect, useRef, useState } from "react";
import { downloadFotoTunggal, sanitizeNamaFile } from "../lib/downloadHelpers";

// ─────────────────────────────────────────────────────────────────────────────
// PDF VIEWER (31 Agu 2026, redesign 1 Sep 2026, GANTI ke native embed 1 Sep 2026) - halaman
// FULL buat WO Digital, konten PDF-nya pakai <iframe> ke native PDF viewer browser (BUKAN lagi
// render custom per-halaman ke <canvas> via pdfjs-dist). Alasan ganti:
// - Kualitas zoom gak lagi dibatasi resolusi canvas yang di-render - native viewer browser
//   render ulang di resolusi native tiap kali di-zoom, selalu tajam.
// - Pinch-zoom otomatis native (custom touch handler pinch-zoom canvas DIHAPUS - gak perlu lagi).
// - <iframe src=...> itu resource-load biasa (sama kayak <img>), BUKAN fetch()/XHR - jadi TIDAK
//   butuh header CORS sama sekali buat nampilin PDF-nya (beda kasus sama custom viewer lama yang
//   pakai pdfjs-dist fetch() dan KENA masalah R2 belum ada CORS policy sama sekali - lihat commit
//   sebelumnya). Cache-Control yang udah di-set di upload (r2-storage edge function) tetap kepakai
//   normal lewat cara ini.
// - pdfjs-dist DIHAPUS total dari vista-teknik (cuma dipakai di file ini, gak ada tempat lain -
//   sudah dicek). iteratorPolyfill.ts juga dihapus (cuma buat pdfjs-dist).
//
// UI wrapper (judul "WO [nomor] - [nama proyek]", tombol "‹ Kembali", Bagikan, Download) TETAP
// dipertahankan sama kayak sebelumnya - yang berubah cuma konten PDF-nya. Toolbar zoom (-/100%/+)
// dan navigasi halaman custom (‹ 1/5 ›) DIHAPUS karena browser sudah sediakan sendiri (native PDF
// viewer punya scroll+zoom+page-jump bawaan).
//
// FIX (1 Sep 2026) - PDF di R2 (photo.vistaproduksi.com) beda domain dari app
// (admin.vistaproduksi.com) - HP (Chrome Android) ternyata malah MEN-DOWNLOAD PDF cross-origin
// yang di-iframe-in, bukan nampilin inline (kebijakan browser mobile, dikonfirmasi user coba
// langsung). Fix: proxy lewat rewrite Vercel (/pdf-proxy/* -> photo.vistaproduksi.com/*, lihat
// vercel.json) biar dari sudut pandang browser PDF-nya "1 domain" sama app-nya - iframe src DAN
// fetch() download sama-sama dialihkan ke path proxy ini, sekalian nge-bypass kebutuhan CORS di
// R2 buat tombol Download (fetch jadi same-origin, gak perlu CORS sama sekali).
// ─────────────────────────────────────────────────────────────────────────────
const R2_BASE=import.meta.env.VITE_R2_PUBLIC_BASE_URL as string|undefined;
const toProxyUrl=(u:string)=>(R2_BASE&&u.startsWith(R2_BASE))?("/pdf-proxy"+u.slice(R2_BASE.length)):u;

export function PdfViewer({url,title,subtitle,onBack}:{url:string,title:string,subtitle?:string,onBack:()=>void}){
  const proxyUrl=toProxyUrl(url);
  const[loading,setLoading]=useState(true);
  const[downloading,setDownloading]=useState(false);
  const[shareMsg,setShareMsg]=useState("");
  const timeoutRef=useRef<ReturnType<typeof setTimeout>|null>(null);

  useEffect(()=>{
    setLoading(true);
    // <iframe> gak punya onError yang reliable buat kegagalan load PDF (404/network gagal
    // biasanya cuma nampilin halaman kosong/error bawaan browser DI DALAM iframe, gak nge-trigger
    // event JS) - fallback timeout biar user gak ketahan liat spinner selamanya kalau gagal.
    if(timeoutRef.current)clearTimeout(timeoutRef.current);
    timeoutRef.current=setTimeout(()=>{setLoading(false);},15000);
    return()=>{if(timeoutRef.current)clearTimeout(timeoutRef.current);};
  },[url]);

  const onIframeLoad=()=>{
    if(timeoutRef.current)clearTimeout(timeoutRef.current);
    setLoading(false);
  };

  const doDownload=async()=>{
    setDownloading(true);
    try{await downloadFotoTunggal(proxyUrl,sanitizeNamaFile(title)+".pdf");}
    catch{alert("Gagal download file.");}
    setDownloading(false);
  };

  const doShare=async()=>{
    if((navigator as any).share){
      try{await (navigator as any).share({title,url});}catch{/* dibatalkan user - abaikan */}
      return;
    }
    try{
      await navigator.clipboard.writeText(url);
      setShareMsg("Link disalin!");
      setTimeout(()=>setShareMsg(""),1800);
    }catch{alert("Gagal membagikan link.");}
  };

  return(
    <div className="fi">
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:14,flexWrap:"wrap"}}>
        <button onClick={onBack} style={{display:"flex",alignItems:"center",gap:6,background:"none",border:"none",
          color:"#1d4ed8",fontWeight:700,fontSize:13,cursor:"pointer",padding:0,flexShrink:0}}>
          <i className="ti ti-arrow-left" style={{fontSize:16}}/> Kembali
        </button>
        <div style={{minWidth:0,flex:1}}>
          <div style={{fontWeight:800,fontSize:15,color:"var(--text-primary,#0f172a)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{title}</div>
          {subtitle&&<div style={{fontSize:11.5,color:"#94a3b8",marginTop:1}}>{subtitle}</div>}
        </div>
        <div style={{display:"flex",alignItems:"center",gap:10,flexShrink:0,flexWrap:"wrap"}}>
          <div style={{position:"relative"}}>
            <button onClick={doShare} style={{background:"var(--bg-secondary,#f1f5f9)",border:"1px solid var(--border-color,#e2e8f0)",borderRadius:8,
              padding:"7px 12px",color:"var(--text-primary,#475569)",fontSize:12,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:6}}>
              <i className="ti ti-share" style={{fontSize:14}}/>Bagikan
            </button>
            {shareMsg&&<div style={{position:"absolute",top:"calc(100% + 6px)",right:0,background:"#0f172a",color:"#fff",fontSize:11,fontWeight:600,
              padding:"5px 10px",borderRadius:6,whiteSpace:"nowrap",zIndex:3}}>{shareMsg}</div>}
          </div>
          <button onClick={doDownload} disabled={downloading} style={{background:"#1d4ed8",border:"none",borderRadius:8,
            padding:"7px 14px",color:"#fff",fontSize:12,fontWeight:700,cursor:downloading?"default":"pointer",display:"flex",alignItems:"center",gap:6}}>
            <i className="ti ti-download" style={{fontSize:14}}/>{downloading?"Mengunduh...":"Download"}
          </button>
        </div>
      </div>

      <div style={{background:"var(--bg-secondary,#f1f5f9)",borderRadius:14,border:"1px solid var(--border-color,#e2e8f0)",
        height:"75vh",overflow:"hidden",position:"relative"}}>
        {loading&&(
          <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",
            color:"#94a3b8",background:"var(--bg-secondary,#f1f5f9)",zIndex:1}}>
            <i className="ti ti-loader-2" style={{fontSize:32,marginBottom:8,animation:"pdfv-spin 1s linear infinite"}}/>
            Memuat PDF...
          </div>
        )}
        <iframe src={proxyUrl} title={title} onLoad={onIframeLoad}
          style={{width:"100%",height:"100%",border:"none"}}/>
      </div>
      <style>{`@keyframes pdfv-spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
