import { useState } from 'react'
import { GCss } from '../styles/globalCss'
import { VISTA_LOGO_DATA_URI } from '../lib/logoAsset'

export function LandingPage({onEnter}){
  const [exiting,setExiting]=useState(false);

  const handleEnter=()=>{
    setExiting(true);
    setTimeout(()=>{onEnter();},400);
  };

  return(
    <div style={{minHeight:"100vh",width:"100%",background:"#ffffff",fontFamily:"'Plus Jakarta Sans',sans-serif",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:24,padding:24,
      opacity:exiting?0:1,transform:exiting?"scale(1.04)":"scale(1)",transition:"opacity .4s cubic-bezier(.4,0,.2,1),transform .4s cubic-bezier(.4,0,.2,1)"}}>
      <style>{GCss}</style>
      <style>{`
        @keyframes landFadeIn{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
        .land-logo{animation:landFadeIn .6s cubic-bezier(.22,1,.36,1) forwards}
        .land-tagline{animation:landFadeIn .6s .15s cubic-bezier(.22,1,.36,1) both}
        .land-cta{animation:landFadeIn .6s .3s cubic-bezier(.22,1,.36,1) both}
        .land-cta-btn:hover{background:#e06a10!important;transform:translateY(-1px)}
        .land-cta-btn{transition:all .18s!important}
      `}</style>
      <img src={VISTA_LOGO_DATA_URI} alt="Vista Teknik" className="land-logo" style={{width:260,height:"auto"}}/>
      <p className="land-tagline" style={{fontSize:15,color:"#64748b",margin:0,textAlign:"center",letterSpacing:.3}}>Your electrical safety is our priority</p>
      <button onClick={handleEnter} className="land-cta land-cta-btn"
        style={{marginTop:16,padding:"13px 36px",borderRadius:10,border:"none",background:"#f47920",color:"#fff",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
        Masuk ke Aplikasi
      </button>
    </div>
  );
}
