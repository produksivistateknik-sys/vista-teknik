import { useState, useRef, useEffect } from 'react'
import { downloadFotoTunggal, sanitizeNamaFile } from '../lib/downloadHelpers'
import { isVideoFoto, isGenericFoto } from '../lib/mediaThumb'

export type FotoViewer = {
  url: string
  uploaded_at?: string
  uploaded_by?: string
  name?: string
  mime?: string
}

// Viewer gaya ClickUp: prev/next antar foto dalam galeri yang sama, toolbar atas rapi
// (nama+posisi, Download, Close), scroll-wheel zoom + drag buat geser waktu di-zoom (mouse),
// pinch dua-jari + drag satu-jari (touch), thumbnail strip di bawah buat lompat foto.
// Dipakai sama semua sub-tab Quality Center (QC/Nameplate/Pasang Komponen/Warehouse/QS).
export function FotoZoomViewer({fotos,startIndex,label,onClose}:{fotos:FotoViewer[],startIndex:number,label?:string,onClose:()=>void}){
  const[index,setIndex]=useState(startIndex)
  const[zoom,setZoom]=useState(1)
  const[pan,setPan]=useState({x:0,y:0})
  const draggingRef=useRef(false)
  const dragStartRef=useRef({x:0,y:0,panX:0,panY:0})
  const pinchStartDist=useRef<number|null>(null)
  const pinchStartZoom=useRef(1)
  const panStartTouchRef=useRef<{x:number,y:number,panX:number,panY:number}|null>(null)

  const foto=fotos[index]
  const isVideo=isVideoFoto(foto)
  const isGeneric=isGenericFoto(foto)
  const resetView=()=>{setZoom(1);setPan({x:0,y:0})}
  const goPrev=()=>{if(index>0){setIndex(index-1);resetView()}}
  const goNext=()=>{if(index<fotos.length-1){setIndex(index+1);resetView()}}

  useEffect(()=>{
    const handler=(e:KeyboardEvent)=>{
      if(e.key==="ArrowLeft")goPrev()
      else if(e.key==="ArrowRight")goNext()
      else if(e.key==="Escape")onClose()
    }
    window.addEventListener("keydown",handler)
    return()=>window.removeEventListener("keydown",handler)
  },[index,fotos.length])

  const handleWheel=(e:any)=>{
    e.preventDefault()
    setZoom(z=>{
      const next=Math.min(4,Math.max(1,z+(e.deltaY<0?0.25:-0.25)))
      if(next===1)setPan({x:0,y:0})
      return next
    })
  }

  const handleMouseDown=(e:any)=>{
    if(zoom<=1)return
    draggingRef.current=true
    dragStartRef.current={x:e.clientX,y:e.clientY,panX:pan.x,panY:pan.y}
  }
  const handleMouseMove=(e:any)=>{
    if(!draggingRef.current)return
    setPan({x:dragStartRef.current.panX+(e.clientX-dragStartRef.current.x),y:dragStartRef.current.panY+(e.clientY-dragStartRef.current.y)})
  }
  const handleMouseUp=()=>{draggingRef.current=false}

  const handleTouchStart=(e:any)=>{
    if(e.touches.length===2){
      const[a,b]=e.touches
      pinchStartDist.current=Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY)
      pinchStartZoom.current=zoom
      panStartTouchRef.current=null
    } else if(e.touches.length===1&&zoom>1){
      const t=e.touches[0]
      panStartTouchRef.current={x:t.clientX,y:t.clientY,panX:pan.x,panY:pan.y}
    }
  }
  const handleTouchMove=(e:any)=>{
    if(e.touches.length===2&&pinchStartDist.current){
      const[a,b]=e.touches
      const dist=Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY)
      const scale=dist/pinchStartDist.current
      const next=Math.min(4,Math.max(1,pinchStartZoom.current*scale))
      setZoom(next)
      if(next===1)setPan({x:0,y:0})
    } else if(e.touches.length===1&&panStartTouchRef.current){
      const t=e.touches[0]
      const st=panStartTouchRef.current
      setPan({x:st.panX+(t.clientX-st.x),y:st.panY+(t.clientY-st.y)})
    }
  }
  const handleTouchEnd=()=>{pinchStartDist.current=null;panStartTouchRef.current=null}

  const fmtTgl=(iso?:string)=>{
    if(!iso)return""
    const d=new Date(iso)
    return d.toLocaleDateString("id-ID",{day:"numeric",month:"short",year:"numeric"})+" "+d.toLocaleTimeString("id-ID",{hour:"2-digit",minute:"2-digit"})
  }

  return(
    <div onClick={onClose} className="no-print"
      style={{position:"fixed" as const,inset:0,background:"rgba(0,0,0,0.92)",zIndex:9999,display:"flex",flexDirection:"column" as const}}>
      {/* Toolbar atas */}
      <div onClick={(e:any)=>e.stopPropagation()}
        style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 18px",background:"linear-gradient(rgba(0,0,0,0.55),transparent)",flexShrink:0}}>
        <div style={{minWidth:0}}>
          <div style={{color:"#fff",fontSize:13,fontWeight:700,whiteSpace:"nowrap" as const,overflow:"hidden",textOverflow:"ellipsis"}}>
            {foto.name||label||"Foto"}{fotos.length>1?` · ${index+1}/${fotos.length}`:""}
          </div>
          {(foto.uploaded_by||foto.uploaded_at)&&(
            <div style={{color:"#cbd5e1",fontSize:11,marginTop:2}}>
              {foto.uploaded_by?`Diupload oleh ${foto.uploaded_by}`:""}{foto.uploaded_at?" · "+fmtTgl(foto.uploaded_at):""}
            </div>
          )}
        </div>
        <div style={{display:"flex",gap:8,flexShrink:0}}>
          <button onClick={()=>downloadFotoTunggal(foto.url,sanitizeNamaFile(foto.name||`${label||"foto"}_${index+1}.jpg`))}
            style={{display:"flex",alignItems:"center",gap:6,background:"rgba(255,255,255,0.15)",color:"#fff",border:"none",borderRadius:8,padding:"8px 14px",fontSize:12,fontWeight:700,cursor:"pointer"}}>
            <i className="ti ti-download" style={{fontSize:15}}/> Download
          </button>
          <button onClick={onClose}
            style={{width:34,height:34,borderRadius:99,background:"rgba(255,255,255,0.15)",color:"#fff",border:"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
            <i className="ti ti-x" style={{fontSize:17}}/>
          </button>
        </div>
      </div>

      {/* Gambar + navigasi prev/next */}
      <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",position:"relative" as const,overflow:"hidden",minHeight:0}}
        onClick={(e:any)=>e.stopPropagation()}>
        {fotos.length>1&&index>0&&(
          <button onClick={goPrev}
            style={{position:"absolute" as const,left:14,top:"50%",transform:"translateY(-50%)",width:40,height:40,borderRadius:99,background:"rgba(255,255,255,0.15)",color:"#fff",border:"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",zIndex:2}}>
            <i className="ti ti-chevron-left" style={{fontSize:20}}/>
          </button>
        )}
        {isVideo?(
          <div style={{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center"}}>
            <video src={foto.url} controls autoPlay style={{maxWidth:"90%",maxHeight:"90%"}}/>
          </div>
        ):isGeneric?(
          <div style={{display:"flex",flexDirection:"column" as const,alignItems:"center",gap:14,color:"#fff"}}>
            <i className="ti ti-file-text" style={{fontSize:64,color:"#94a3b8"}}/>
            <div style={{fontSize:14,fontWeight:600,maxWidth:320,textAlign:"center" as const,wordBreak:"break-all" as const}}>{foto.name||"File"}</div>
            <button onClick={()=>window.open(foto.url,"_blank")}
              style={{display:"flex",alignItems:"center",gap:6,background:"rgba(255,255,255,0.15)",color:"#fff",border:"none",borderRadius:8,padding:"10px 18px",fontSize:13,fontWeight:700,cursor:"pointer"}}>
              <i className="ti ti-external-link" style={{fontSize:15}}/> Buka File
            </button>
          </div>
        ):(
          <div
            onWheel={handleWheel}
            onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}
            onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}
            style={{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center",touchAction:"none" as const,cursor:zoom>1?(draggingRef.current?"grabbing":"grab"):"default"}}>
            <img src={foto.url} draggable={false}
              style={{maxWidth:"90%",maxHeight:"90%",objectFit:"contain" as const,transform:`translate(${pan.x}px,${pan.y}px) scale(${zoom})`,transformOrigin:"center",transition:draggingRef.current?"none":"transform .08s"}}/>
          </div>
        )}
        {fotos.length>1&&index<fotos.length-1&&(
          <button onClick={goNext}
            style={{position:"absolute" as const,right:14,top:"50%",transform:"translateY(-50%)",width:40,height:40,borderRadius:99,background:"rgba(255,255,255,0.15)",color:"#fff",border:"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",zIndex:2}}>
            <i className="ti ti-chevron-right" style={{fontSize:20}}/>
          </button>
        )}
      </div>

      {/* Kontrol zoom + thumbnail strip */}
      <div onClick={(e:any)=>e.stopPropagation()} style={{flexShrink:0,padding:"10px 18px 16px"}}>
        {!isVideo&&!isGeneric&&(
          <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:14,marginBottom:fotos.length>1?12:0}}>
            <button onClick={()=>setZoom(z=>{const n=Math.max(1,z-0.5);if(n===1)setPan({x:0,y:0});return n})}
              style={{width:32,height:32,borderRadius:99,background:"rgba(255,255,255,0.15)",color:"#fff",border:"none",fontSize:17,fontWeight:700,cursor:"pointer"}}>−</button>
            <span style={{color:"#fff",fontSize:12,fontWeight:700,minWidth:40,textAlign:"center" as const}}>{Math.round(zoom*100)}%</span>
            <button onClick={()=>setZoom(z=>Math.min(4,z+0.5))}
              style={{width:32,height:32,borderRadius:99,background:"rgba(255,255,255,0.15)",color:"#fff",border:"none",fontSize:17,fontWeight:700,cursor:"pointer"}}>+</button>
          </div>
        )}
        {fotos.length>1&&(
          <div style={{display:"flex",gap:6,overflowX:"auto" as const,justifyContent:fotos.length<=8?"center":"flex-start",padding:"2px 0"}}>
            {fotos.map((f,fi)=>{
              const fVideo=isVideoFoto(f)
              const fGeneric=isGenericFoto(f)
              return(
                <div key={fi} onClick={()=>{setIndex(fi);resetView()}}
                  style={{position:"relative" as const,width:48,height:48,borderRadius:6,cursor:"pointer",flexShrink:0,overflow:"hidden",
                    background:"#1e293b",display:"flex",alignItems:"center",justifyContent:"center",
                    border:fi===index?"2px solid #fff":"2px solid transparent",opacity:fi===index?1:0.55}}>
                  {fVideo?(
                    <><video src={f.url} muted style={{width:"100%",height:"100%",objectFit:"cover" as const}}/>
                    <i className="ti ti-player-play-filled" style={{position:"absolute" as const,fontSize:14,color:"#fff"}}/></>
                  ):fGeneric?(
                    <i className="ti ti-file-text" style={{fontSize:18,color:"#cbd5e1"}}/>
                  ):(
                    <img src={f.url} style={{width:"100%",height:"100%",objectFit:"cover" as const}}/>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
