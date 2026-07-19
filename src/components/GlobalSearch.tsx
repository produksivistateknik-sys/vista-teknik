import { useRef, useEffect } from 'react'
import { woOverall } from '../lib/panelHelpers'
import { isDelayed, isUrgent } from '../lib/dateHelpers'
import { DIVISI_CONFIG } from '../constants/panelTypes'

export function GlobalSearch({show,onClose,query,setQuery,woData,pekerja,setTab}:any){
  const ref=useRef<HTMLInputElement>(null);

  useEffect(()=>{
    if(show) setTimeout(()=>ref.current?.focus(),50);
    else setQuery("");
  },[show]);

  useEffect(()=>{
    const handler=(e:KeyboardEvent)=>{
      if(e.key==="Escape") onClose();
    };
    if(show) window.addEventListener("keydown",handler);
    return()=>window.removeEventListener("keydown",handler);
  },[show]);

  const q=query.toLowerCase().trim();

  const woResults=q?(woData||[]).filter((w:any)=>
    w.wo?.toLowerCase().includes(q)||w.proyek?.toLowerCase().includes(q)
  ).slice(0,5):[];

  const panelResults=q?(woData||[]).flatMap((w:any)=>
    (w.panels||[]).filter((p:any)=>
      p.nama?.toLowerCase().includes(q)||w.proyek?.toLowerCase().includes(q)
    ).map((p:any)=>({...p,wo:w.wo,proyek:w.proyek,woId:w.id}))
  ).slice(0,5):[];

  const pekerjaResults=q?(pekerja||[]).filter((p:any)=>
    p.nama?.toLowerCase().includes(q)
  ).slice(0,4):[];

  const hasResults=woResults.length>0||panelResults.length>0||pekerjaResults.length>0;

  if(!show) return null;

  return(
    <div style={{position:"fixed",inset:0,zIndex:9999,display:"flex",alignItems:"flex-start",
      justifyContent:"center",paddingTop:80,background:"rgba(15,23,42,.6)",backdropFilter:"blur(4px)"}}
      onClick={onClose}>
      <div style={{width:"100%",maxWidth:580,background:"#fff",borderRadius:14,
        boxShadow:"0 24px 64px rgba(0,0,0,.25)",overflow:"hidden"}}
        onClick={e=>e.stopPropagation()}>
        {/* Search input */}
        <div style={{display:"flex",alignItems:"center",gap:12,padding:"14px 18px",
          borderBottom:"1px solid #f1f5f9"}}>
          <i className="ti ti-search" style={{fontSize:18,color:"#94a3b8",flexShrink:0}}/>
          <input ref={ref} value={query} onChange={e=>setQuery(e.target.value)}
            placeholder="Cari work order, panel, proyek, pekerja..."
            style={{flex:1,border:"none",outline:"none",fontSize:15,color:"#0f172a",
              fontFamily:"inherit",background:"transparent"}}/>
          {query&&(
            <button onClick={()=>setQuery("")}
              style={{background:"none",border:"none",cursor:"pointer",color:"#94a3b8",fontSize:14}}>✕</button>
          )}
          <kbd style={{background:"#f1f5f9",border:"1px solid #e2e8f0",borderRadius:5,
            padding:"2px 7px",fontSize:11,color:"#64748b",flexShrink:0}}>Esc</kbd>
        </div>

        {/* Results */}
        <div style={{maxHeight:420,overflowY:"auto" as const}}>
          {!query?(
            <div style={{padding:"32px",textAlign:"center",color:"#94a3b8"}}>
              <i className="ti ti-search" style={{fontSize:32,display:"block",marginBottom:8}}/>
              <div style={{fontSize:13}}>Ketik untuk mencari...</div>
              <div style={{fontSize:11,marginTop:6,color:"#cbd5e1"}}>WO, panel, proyek, pekerja</div>
            </div>
          ):!hasResults?(
            <div style={{padding:"32px",textAlign:"center",color:"#94a3b8"}}>
              <div style={{fontSize:24,marginBottom:8}}>🔍</div>
              <div style={{fontSize:13}}>Tidak ada hasil untuk "<strong>{query}</strong>"</div>
            </div>
          ):(
            <div style={{padding:"8px 0"}}>
              {/* WO Results */}
              {woResults.length>0&&(
                <div>
                  <div style={{padding:"6px 18px 4px",fontSize:10,fontWeight:700,color:"#94a3b8",
                    textTransform:"uppercase" as const,letterSpacing:.8}}>Work Orders</div>
                  {woResults.map((w:any)=>{
                    const pct=woOverall(w);
                    const color=pct===100?"#16a34a":isDelayed(w.target)?"#dc2626":isUrgent(w.target)?"#f59e0b":"#2563eb";
                    return(
                      <div key={w.id} onClick={()=>{setTab("wo");onClose();}}
                        style={{padding:"10px 18px",cursor:"pointer",display:"flex",
                          alignItems:"center",gap:12,transition:"background .1s"}}
                        onMouseEnter={e=>(e.currentTarget.style.background="#f8fafc")}
                        onMouseLeave={e=>(e.currentTarget.style.background="transparent")}>
                        <div style={{width:32,height:32,borderRadius:8,background:"#eff6ff",
                          display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                          <i className="ti ti-file-description" style={{fontSize:16,color:"#2563eb"}}/>
                        </div>
                        <div style={{flex:1}}>
                          <div style={{fontSize:13,fontWeight:700,color:"#1e293b"}}>
                            WO {w.wo} — {w.proyek}
                          </div>
                          <div style={{fontSize:11,color:"#94a3b8",marginTop:1}}>
                            {(w.panels||[]).length} panel · Target: {w.target}
                          </div>
                        </div>
                        <span style={{background:color+"18",color,borderRadius:20,
                          padding:"2px 8px",fontSize:10,fontWeight:700}}>{pct}%</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Panel Results */}
              {panelResults.length>0&&(
                <div>
                  <div style={{padding:"6px 18px 4px",fontSize:10,fontWeight:700,color:"#94a3b8",
                    textTransform:"uppercase" as const,letterSpacing:.8}}>Panels</div>
                  {panelResults.map((p:any,i:number)=>(
                    <div key={i} onClick={()=>{setTab("detail");onClose();}}
                      style={{padding:"10px 18px",cursor:"pointer",display:"flex",
                        alignItems:"center",gap:12}}
                      onMouseEnter={e=>(e.currentTarget.style.background="#f8fafc")}
                      onMouseLeave={e=>(e.currentTarget.style.background="transparent")}>
                      <div style={{width:32,height:32,borderRadius:8,background:"#f0fdf4",
                        display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                        <i className="ti ti-layout-board" style={{fontSize:16,color:"#16a34a"}}/>
                      </div>
                      <div style={{flex:1}}>
                        <div style={{fontSize:13,fontWeight:700,color:"#1e293b"}}>{p.nama}</div>
                        <div style={{fontSize:11,color:"#94a3b8",marginTop:1}}>
                          WO {p.wo} · {p.proyek} · {p.tipe}
                        </div>
                      </div>
                      <i className="ti ti-arrow-right" style={{fontSize:14,color:"#cbd5e1"}}/>
                    </div>
                  ))}
                </div>
              )}

              {/* Pekerja Results */}
              {pekerjaResults.length>0&&(
                <div>
                  <div style={{padding:"6px 18px 4px",fontSize:10,fontWeight:700,color:"#94a3b8",
                    textTransform:"uppercase" as const,letterSpacing:.8}}>Pekerja</div>
                  {pekerjaResults.map((p:any)=>{
                    const dc=(DIVISI_CONFIG as any)[p.divisi]||{};
                    return(
                      <div key={p.id} onClick={()=>{setTab("pekerja");onClose();}}
                        style={{padding:"10px 18px",cursor:"pointer",display:"flex",
                          alignItems:"center",gap:12}}
                        onMouseEnter={e=>(e.currentTarget.style.background="#f8fafc")}
                        onMouseLeave={e=>(e.currentTarget.style.background="transparent")}>
                        <div style={{width:32,height:32,borderRadius:8,background:dc.bg||"#f1f5f9",
                          display:"flex",alignItems:"center",justifyContent:"center",
                          fontSize:12,fontWeight:800,color:dc.color||"#64748b",flexShrink:0}}>
                          {p.nama?.slice(0,2).toUpperCase()}
                        </div>
                        <div style={{flex:1}}>
                          <div style={{fontSize:13,fontWeight:700,color:"#1e293b"}}>{p.nama}</div>
                          <div style={{fontSize:11,color:"#94a3b8",marginTop:1}}>{dc.icon} {dc.label}</div>
                        </div>
                        <i className="ti ti-arrow-right" style={{fontSize:14,color:"#cbd5e1"}}/>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{padding:"8px 18px",borderTop:"1px solid #f1f5f9",display:"flex",
          gap:16,alignItems:"center"}}>
          <span style={{fontSize:10,color:"#94a3b8",display:"flex",alignItems:"center",gap:4}}>
            <kbd style={{background:"#f1f5f9",border:"1px solid #e2e8f0",borderRadius:4,
              padding:"1px 5px",fontSize:10}}>↵</kbd> Navigate
          </span>
          <span style={{fontSize:10,color:"#94a3b8",display:"flex",alignItems:"center",gap:4}}>
            <kbd style={{background:"#f1f5f9",border:"1px solid #e2e8f0",borderRadius:4,
              padding:"1px 5px",fontSize:10}}>Esc</kbd> Tutup
          </span>
          <span style={{fontSize:10,color:"#94a3b8",marginLeft:"auto"}}>
            Vista Teknik Search
          </span>
        </div>
      </div>
    </div>
  );
}
