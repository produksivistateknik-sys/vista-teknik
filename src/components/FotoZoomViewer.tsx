import { useState, useRef } from 'react'
import { downloadFotoTunggal, sanitizeNamaFile } from '../lib/downloadHelpers'

export type FotoViewer = {
  url: string
  uploaded_at?: string
  uploaded_by?: string
  name?: string
  _label?: string
}

// Viewer full-screen dengan zoom (pinch dua-jari di tablet/touchscreen + tombol -/+) dan
// download - dipakai sama semua sub-tab Quality Center (QC/Nameplate/Pasang Komponen/
// Warehouse/QS) biar konsisten, gak copy-paste logic zoom 5x. Pola sama persis viewer di
// Vista Pekerja (NameplateView).
export function FotoZoomViewer({foto,onClose}:{foto:FotoViewer,onClose:()=>void}){
  const[zoom,setZoom]=useState(1)
  const pinchStartDist=useRef<number|null>(null)
  const pinchStartZoom=useRef(1)

  const handleTouchStart=(e:any)=>{
    if(e.touches.length===2){
      const[a,b]=e.touches
      pinchStartDist.current=Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY)
      pinchStartZoom.current=zoom
    }
  }
  const handleTouchMove=(e:any)=>{
    if(e.touches.length===2&&pinchStartDist.current){
      const[a,b]=e.touches
      const dist=Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY)
      const scale=dist/pinchStartDist.current
      setZoom(Math.min(4,Math.max(1,pinchStartZoom.current*scale)))
    }
  }
  const handleTouchEnd=()=>{pinchStartDist.current=null}

  const fmtTgl=(iso?:string)=>{
    if(!iso)return""
    const d=new Date(iso)
    return d.toLocaleDateString("id-ID",{day:"numeric",month:"short",year:"numeric"})+" "+d.toLocaleTimeString("id-ID",{hour:"2-digit",minute:"2-digit"})
  }

  return(
    <div onClick={onClose} className="no-print"
      style={{position:"fixed" as const,inset:0,background:"rgba(0,0,0,0.9)",zIndex:9999,display:"flex",flexDirection:"column" as const,alignItems:"center",justifyContent:"center",padding:20}}>
      <button onClick={onClose}
        style={{position:"absolute" as const,top:16,right:16,width:36,height:36,borderRadius:99,background:"rgba(255,255,255,0.15)",color:"#fff",border:"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
        <i className="ti ti-x" style={{fontSize:18}}/>
      </button>
      <div onClick={(e:any)=>e.stopPropagation()}
        onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}
        style={{overflow:"hidden",maxWidth:"100%",maxHeight:"65vh",touchAction:"none" as const}}>
        <img src={foto.url} draggable={false}
          style={{maxWidth:"100%",maxHeight:"65vh",objectFit:"contain" as const,transform:`scale(${zoom})`,transformOrigin:"center"}}/>
      </div>
      <div onClick={(e:any)=>e.stopPropagation()} style={{display:"flex",alignItems:"center",gap:14,marginTop:14}}>
        <button onClick={()=>setZoom(z=>Math.max(1,z-0.5))}
          style={{width:34,height:34,borderRadius:99,background:"rgba(255,255,255,0.15)",color:"#fff",border:"none",fontSize:18,fontWeight:700,cursor:"pointer"}}>−</button>
        <span style={{color:"#fff",fontSize:12,fontWeight:700,minWidth:40,textAlign:"center" as const}}>{Math.round(zoom*100)}%</span>
        <button onClick={()=>setZoom(z=>Math.min(4,z+0.5))}
          style={{width:34,height:34,borderRadius:99,background:"rgba(255,255,255,0.15)",color:"#fff",border:"none",fontSize:18,fontWeight:700,cursor:"pointer"}}>+</button>
      </div>
      <div onClick={(e:any)=>e.stopPropagation()} style={{marginTop:14,textAlign:"center" as const,color:"#fff"}}>
        <div style={{fontSize:11,color:"#cbd5e1"}}>
          {foto.uploaded_by?`Diupload oleh ${foto.uploaded_by}`:""}{foto.uploaded_at?" · "+fmtTgl(foto.uploaded_at):""}
        </div>
        <button onClick={()=>downloadFotoTunggal(foto.url,sanitizeNamaFile(foto.name||`${foto._label||"foto"}.jpg`))}
          style={{marginTop:10,display:"flex",alignItems:"center",gap:6,background:"#fff",color:"#1e293b",border:"none",borderRadius:8,padding:"8px 16px",fontSize:12,fontWeight:700,cursor:"pointer",marginLeft:"auto",marginRight:"auto"}}>
          <i className="ti ti-download" style={{fontSize:15}}/> Download
        </button>
      </div>
    </div>
  )
}
