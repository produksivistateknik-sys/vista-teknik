import "../lib/iteratorPolyfill";
import { useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
// @ts-ignore - Vite `?url` import, sama pola kayak vista-pekerja/src/lib/ocrHelpers.ts
import pdfjsWorkerUrl from "pdfjs-dist/build/pdf.worker.mjs?url";
import { downloadFotoTunggal, sanitizeNamaFile } from "../lib/downloadHelpers";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;

// ─────────────────────────────────────────────────────────────────────────────
// PDF VIEWER (31 Agu 2026) - viewer in-app buat WO Digital (construction drawing PDF,
// watermark logo Vista sudah nempel di file-nya sendiri lewat pdfWatermark.ts, jadi otomatis
// ikut kelihatan di sini - gak perlu overlay terpisah). Render tiap halaman ke <canvas> lewat
// pdfjs-dist (bukan <iframe>/<embed> ke native PDF viewer browser - gak reliable di semua
// device/Android WebView, dan gak bisa di-styling konsisten sama tema gelap app).
//
// Bahasa visual (fullscreen dark modal, toolbar atas, tombol panah kiri/kanan, X close, ESC/
// klik-backdrop buat nutup) SENGAJA niru FotoZoomViewer.tsx yang sudah ada, biar konsisten -
// tapi ini file BARU terpisah (bukan reuse komponen itu), karena FotoZoomViewer didesain buat
// foto/video (zoom-pan-pinch), bukan navigasi halaman dokumen.
// ─────────────────────────────────────────────────────────────────────────────
export function PdfViewer({url,title,subtitle,onClose}:{url:string,title:string,subtitle?:string,onClose:()=>void}){
  const canvasRef=useRef<HTMLCanvasElement|null>(null);
  const containerRef=useRef<HTMLDivElement|null>(null);
  const pdfDocRef=useRef<any>(null);
  const renderTaskRef=useRef<any>(null);
  const[numPages,setNumPages]=useState(0);
  const[pageIndex,setPageIndex]=useState(0);
  const[loading,setLoading]=useState(true);
  const[error,setError]=useState<string|null>(null);
  const[resizeTick,setResizeTick]=useState(0);
  const[downloading,setDownloading]=useState(false);

  useEffect(()=>{
    let cancelled=false;
    setLoading(true);setError(null);setPageIndex(0);setNumPages(0);
    pdfjsLib.getDocument({url}).promise.then((pdf:any)=>{
      if(cancelled)return;
      pdfDocRef.current=pdf;
      setNumPages(pdf.numPages);
      setLoading(false);
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

  useEffect(()=>{
    if(!pdfDocRef.current||!canvasRef.current||numPages===0)return;
    let cancelled=false;
    (async()=>{
      try{
        const page=await pdfDocRef.current.getPage(pageIndex+1);
        if(cancelled)return;
        const containerWidth=containerRef.current?.clientWidth||800;
        const baseViewport=page.getViewport({scale:1});
        const fitScale=Math.min((containerWidth-32)/baseViewport.width,2.5);
        const dpr=window.devicePixelRatio||1;
        const viewport=page.getViewport({scale:fitScale*dpr});
        const canvas=canvasRef.current;
        if(!canvas)return;
        canvas.width=viewport.width;
        canvas.height=viewport.height;
        canvas.style.width=(viewport.width/dpr)+"px";
        canvas.style.height=(viewport.height/dpr)+"px";
        const ctx=canvas.getContext("2d");
        if(!ctx)return;
        if(renderTaskRef.current)renderTaskRef.current.cancel();
        const task=page.render({canvasContext:ctx,canvas,viewport});
        renderTaskRef.current=task;
        await task.promise;
      }catch{/* render dibatalkan (ganti halaman cepat) - abaikan */}
    })();
    return()=>{cancelled=true;};
  },[pageIndex,numPages,resizeTick]);

  useEffect(()=>{
    const onKey=(e:KeyboardEvent)=>{
      if(e.key==="Escape")onClose();
      if(e.key==="ArrowLeft")setPageIndex(p=>Math.max(0,p-1));
      if(e.key==="ArrowRight")setPageIndex(p=>Math.min(numPages-1,p+1));
    };
    window.addEventListener("keydown",onKey);
    return()=>window.removeEventListener("keydown",onKey);
  },[numPages,onClose]);

  const doDownload=async()=>{
    setDownloading(true);
    try{await downloadFotoTunggal(url,sanitizeNamaFile(title)+".pdf");}
    catch{alert("Gagal download file.");}
    setDownloading(false);
  };

  return(
    <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.92)",zIndex:9999,display:"flex",flexDirection:"column"}}>
      <div onClick={e=>e.stopPropagation()} style={{padding:"14px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,
        background:"linear-gradient(rgba(0,0,0,0.55),transparent)",flexShrink:0}}>
        <div style={{minWidth:0}}>
          <div style={{color:"#fff",fontWeight:700,fontSize:14,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{title}</div>
          <div style={{color:"rgba(255,255,255,.6)",fontSize:11,marginTop:2}}>
            {subtitle}{subtitle&&numPages>0?" · ":""}{numPages>0?`Halaman ${pageIndex+1} / ${numPages}`:""}
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
          <button onClick={doDownload} disabled={downloading} style={{background:"rgba(255,255,255,.12)",border:"none",borderRadius:8,
            padding:"8px 14px",color:"#fff",fontSize:12,fontWeight:700,cursor:downloading?"default":"pointer",display:"flex",alignItems:"center",gap:6}}>
            <i className="ti ti-download" style={{fontSize:15}}/>{downloading?"Mengunduh...":"Download"}
          </button>
          <button onClick={onClose} style={{background:"rgba(255,255,255,.12)",border:"none",borderRadius:"50%",width:36,height:36,
            color:"#fff",fontSize:16,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
            <i className="ti ti-x"/>
          </button>
        </div>
      </div>

      <div ref={containerRef} onClick={e=>e.stopPropagation()} style={{flex:1,overflow:"auto",display:"flex",alignItems:"flex-start",justifyContent:"center",padding:16,position:"relative"}}>
        {loading&&(
          <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",color:"rgba(255,255,255,.7)",textAlign:"center"}}>
            <i className="ti ti-loader-2" style={{fontSize:32,display:"block",marginBottom:8,animation:"pdfv-spin 1s linear infinite"}}/>
            Memuat PDF...
          </div>
        )}
        {error&&(
          <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",color:"rgba(255,255,255,.8)",textAlign:"center",maxWidth:320}}>
            <i className="ti ti-file-alert" style={{fontSize:32,display:"block",marginBottom:8,color:"#f87171"}}/>
            {error}
            <div style={{marginTop:12}}>
              <a href={url} target="_blank" rel="noreferrer" style={{color:"#60a5fa",fontSize:12,fontWeight:700}}>Buka di tab baru →</a>
            </div>
          </div>
        )}
        {!loading&&!error&&numPages>1&&pageIndex>0&&(
          <button onClick={()=>setPageIndex(p=>p-1)} style={{position:"fixed",left:16,top:"50%",transform:"translateY(-50%)",
            width:44,height:44,borderRadius:"50%",background:"rgba(0,0,0,.5)",border:"none",color:"#fff",fontSize:20,cursor:"pointer",zIndex:2}}>
            <i className="ti ti-chevron-left"/>
          </button>
        )}
        {!loading&&!error&&numPages>1&&pageIndex<numPages-1&&(
          <button onClick={()=>setPageIndex(p=>p+1)} style={{position:"fixed",right:16,top:"50%",transform:"translateY(-50%)",
            width:44,height:44,borderRadius:"50%",background:"rgba(0,0,0,.5)",border:"none",color:"#fff",fontSize:20,cursor:"pointer",zIndex:2}}>
            <i className="ti ti-chevron-right"/>
          </button>
        )}
        <canvas ref={canvasRef} style={{display:(!loading&&!error)?"block":"none",boxShadow:"0 8px 32px rgba(0,0,0,.5)",background:"#fff"}}/>
      </div>
      <style>{`@keyframes pdfv-spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
