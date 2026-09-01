import "../lib/iteratorPolyfill";
import { useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
// @ts-ignore - Vite `?url` import, sama pola kayak vista-pekerja/src/lib/ocrHelpers.ts
import pdfjsWorkerUrl from "pdfjs-dist/build/pdf.worker.mjs?url";
import { downloadFotoTunggal, sanitizeNamaFile } from "../lib/downloadHelpers";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;

// ─────────────────────────────────────────────────────────────────────────────
// PDF VIEWER (31 Agu 2026, redesign 1 Sep 2026) - halaman FULL buat WO Digital (bukan modal
// overlay lagi) - dipanggil dari WoDigitalTab.tsx yang swap seluruh tampilan list jadi viewer
// ini (pola sama kayak LaporanQCView.tsx: state lokal + early-return, tombol "‹ Kembali" teks
// biasa, TANPA position:fixed/backdrop). Render tiap halaman ke <canvas> lewat pdfjs-dist
// (bukan <iframe>/<embed> ke native PDF viewer browser - gak reliable di semua device/Android
// WebView). Watermark logo Vista otomatis ikut kelihatan (sudah bagian file-nya sendiri).
// ─────────────────────────────────────────────────────────────────────────────
const ZOOM_MIN=0.5,ZOOM_MAX=3,ZOOM_STEP=0.25;

export function PdfViewer({url,title,subtitle,onBack}:{url:string,title:string,subtitle?:string,onBack:()=>void}){
  const canvasRef=useRef<HTMLCanvasElement|null>(null);
  const containerRef=useRef<HTMLDivElement|null>(null);
  const pdfDocRef=useRef<any>(null);
  const renderTaskRef=useRef<any>(null);
  const firstPaintDoneRef=useRef(false);
  const[numPages,setNumPages]=useState(0);
  const[pageIndex,setPageIndex]=useState(0);
  const[loading,setLoading]=useState(true);
  const[error,setError]=useState<string|null>(null);
  const[resizeTick,setResizeTick]=useState(0);
  const[downloading,setDownloading]=useState(false);
  const[zoom,setZoom]=useState(1);
  const[shareMsg,setShareMsg]=useState("");

  useEffect(()=>{
    let cancelled=false;
    firstPaintDoneRef.current=false;
    setLoading(true);setError(null);setPageIndex(0);setNumPages(0);setZoom(1);
    pdfjsLib.getDocument({url}).promise.then((pdf:any)=>{
      if(cancelled)return;
      pdfDocRef.current=pdf;
      setNumPages(pdf.numPages);
    }).catch(()=>{
      if(cancelled)return;
      setError("Gagal memuat PDF. Coba lagi atau buka di tab baru.");
      setLoading(false);
    });
    return()=>{cancelled=true;pdfDocRef.current?.destroy?.();pdfDocRef.current=null;};
  },[url]);

  useEffect(()=>{
    const onResize=()=>setResizeTick(t=>t+1);
    window.addEventListener("resize",onResize);
    window.addEventListener("orientationchange",onResize);
    return()=>{window.removeEventListener("resize",onResize);window.removeEventListener("orientationchange",onResize);};
  },[]);

  // Render 2 tahap (31 Agu 2026, fix "loading lama") - render CEPAT resolusi rendah dulu
  // (langsung tampil, nutup spinner), baru upgrade ke kualitas penuh di background - user gak
  // nunggu kosong. `zoom` ikut jadi dependency biar ganti level zoom juga re-render dgn tajam.
  useEffect(()=>{
    if(!pdfDocRef.current||!canvasRef.current||numPages===0)return;
    let cancelled=false;
    (async()=>{
      try{
        const page=await pdfDocRef.current.getPage(pageIndex+1);
        if(cancelled)return;
        const canvas=canvasRef.current;
        if(!canvas)return;
        const ctx=canvas.getContext("2d");
        if(!ctx)return;
        const containerWidth=containerRef.current?.clientWidth||800;
        const baseViewport=page.getViewport({scale:1});
        // Ukuran CSS (tampilan) TETAP sama di kedua tahap render - cuma resolusi internal
        // canvas (backing store) yang beda, biar gak "lompat" ukuran pas upgrade kualitas.
        const fitScale=Math.min((containerWidth-32)/baseViewport.width,2);
        const cssScale=fitScale*zoom;
        canvas.style.width=(baseViewport.width*cssScale)+"px";
        canvas.style.height=(baseViewport.height*cssScale)+"px";

        const paint=async(backingScale:number)=>{
          const viewport=page.getViewport({scale:backingScale});
          canvas.width=viewport.width;
          canvas.height=viewport.height;
          if(renderTaskRef.current)renderTaskRef.current.cancel();
          const task=page.render({canvasContext:ctx,canvas,viewport});
          renderTaskRef.current=task;
          await task.promise;
        };

        // Tahap 1: cepat, resolusi rendah (langsung muncul, di-upscale CSS - agak blur tapi instan).
        await paint(Math.min(cssScale,1));
        if(cancelled)return;
        if(!firstPaintDoneRef.current){firstPaintDoneRef.current=true;setLoading(false);}

        // Tahap 2: kualitas penuh di background (dpr dibatasi 2x, bukan sampai 3-4x di HP).
        const dpr=Math.min(window.devicePixelRatio||1,2);
        await paint(cssScale*dpr);
      }catch{/* render dibatalkan (ganti halaman/zoom/ukuran cepat) - abaikan */}
    })();
    return()=>{cancelled=true;};
  },[pageIndex,numPages,resizeTick,zoom]);

  useEffect(()=>{
    const onKey=(e:KeyboardEvent)=>{
      if(e.key==="Escape")onBack();
      if(e.key==="ArrowLeft")setPageIndex(p=>Math.max(0,p-1));
      if(e.key==="ArrowRight")setPageIndex(p=>Math.min(numPages-1,p+1));
    };
    window.addEventListener("keydown",onKey);
    return()=>window.removeEventListener("keydown",onKey);
  },[numPages,onBack]);

  const doDownload=async()=>{
    setDownloading(true);
    try{await downloadFotoTunggal(url,sanitizeNamaFile(title)+".pdf");}
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

  const zoomBtnStyle={background:"var(--bg-secondary,#f1f5f9)",border:"1px solid var(--border-color,#e2e8f0)",borderRadius:7,
    width:28,height:28,color:"var(--text-primary,#475569)",fontSize:14,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"} as const;

  return(
    <div className="fi">
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:14,flexWrap:"wrap"}}>
        <button onClick={onBack} style={{display:"flex",alignItems:"center",gap:6,background:"none",border:"none",
          color:"#1d4ed8",fontWeight:700,fontSize:13,cursor:"pointer",padding:0,flexShrink:0}}>
          <i className="ti ti-arrow-left" style={{fontSize:16}}/> Kembali
        </button>
        <div style={{minWidth:0,flex:1}}>
          <div style={{fontWeight:800,fontSize:15,color:"var(--text-primary,#0f172a)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{title}</div>
          <div style={{fontSize:11.5,color:"#94a3b8",marginTop:1}}>
            {subtitle}{subtitle&&numPages>0?" · ":""}{numPages>0?`Halaman ${pageIndex+1} / ${numPages}`:""}
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:10,flexShrink:0,flexWrap:"wrap"}}>
          <div style={{display:"flex",alignItems:"center",gap:4}}>
            <button onClick={()=>setZoom(z=>Math.max(ZOOM_MIN,+(z-ZOOM_STEP).toFixed(2)))} disabled={zoom<=ZOOM_MIN} style={zoomBtnStyle}>−</button>
            <span style={{fontSize:11.5,color:"#64748b",fontWeight:700,width:38,textAlign:"center"}}>{Math.round(zoom*100)}%</span>
            <button onClick={()=>setZoom(z=>Math.min(ZOOM_MAX,+(z+ZOOM_STEP).toFixed(2)))} disabled={zoom>=ZOOM_MAX} style={zoomBtnStyle}>+</button>
          </div>
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

      <div ref={containerRef} style={{background:"var(--bg-secondary,#f1f5f9)",borderRadius:14,border:"1px solid var(--border-color,#e2e8f0)",
        minHeight:"60vh",overflow:"auto",display:"flex",alignItems:"flex-start",justifyContent:"center",padding:16,position:"relative"}}>
        {loading&&(
          <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",color:"#94a3b8",textAlign:"center"}}>
            <i className="ti ti-loader-2" style={{fontSize:32,display:"block",marginBottom:8,animation:"pdfv-spin 1s linear infinite"}}/>
            Memuat PDF...
          </div>
        )}
        {error&&(
          <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",color:"#64748b",textAlign:"center",maxWidth:320}}>
            <i className="ti ti-file-alert" style={{fontSize:32,display:"block",marginBottom:8,color:"#dc2626"}}/>
            {error}
            <div style={{marginTop:12}}>
              <a href={url} target="_blank" rel="noreferrer" style={{color:"#2563eb",fontSize:12,fontWeight:700}}>Buka di tab baru →</a>
            </div>
          </div>
        )}
        <canvas ref={canvasRef} style={{display:(!loading&&!error)?"block":"none",boxShadow:"0 4px 20px rgba(15,23,42,.15)",background:"#fff",flexShrink:0}}/>
        {!loading&&!error&&numPages>1&&pageIndex>0&&(
          <button onClick={()=>setPageIndex(p=>p-1)} style={{position:"absolute",left:16,top:"50%",transform:"translateY(-50%)",
            width:40,height:40,borderRadius:"50%",background:"rgba(15,23,42,.75)",border:"none",color:"#fff",fontSize:18,cursor:"pointer",zIndex:2}}>
            <i className="ti ti-chevron-left"/>
          </button>
        )}
        {!loading&&!error&&numPages>1&&pageIndex<numPages-1&&(
          <button onClick={()=>setPageIndex(p=>p+1)} style={{position:"absolute",right:16,top:"50%",transform:"translateY(-50%)",
            width:40,height:40,borderRadius:"50%",background:"rgba(15,23,42,.75)",border:"none",color:"#fff",fontSize:18,cursor:"pointer",zIndex:2}}>
            <i className="ti ti-chevron-right"/>
          </button>
        )}
      </div>
      <style>{`@keyframes pdfv-spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
