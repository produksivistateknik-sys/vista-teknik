import { useState, useMemo } from 'react'
import { DIVISI_CONFIG } from '../constants/panelTypes'
import { STitle } from './ui/Primitives'

export function KendalaInbox({kendalaLog,removeKendala,user}:any){
  const [selectedProyek,setSelectedProyek]=useState<string|null>(null);
  const [selectedPanel,setSelectedPanel]=useState<string|null>(null);

  const groups=useMemo(()=>{
    const g:Record<string,Record<string,any[]>>={};
    kendalaLog.forEach((k:any)=>{
      const proyek=k.proyek||"Tanpa Proyek";
      const panel=k.panel||"Tanpa Panel";
      if(!g[proyek])g[proyek]={};
      if(!g[proyek][panel])g[proyek][panel]=[];
      g[proyek][panel].push(k);
    });
    return g;
  },[kendalaLog]);

  const downloadWord=(proyek:string,panel:string,items:any[])=>{
    const rows=items.map((k:any)=>`
      <tr>
        <td style="padding:6px;border:1px solid #cbd5e1;">${k.tanggal||"-"}</td>
        <td style="padding:6px;border:1px solid #cbd5e1;">${(DIVISI_CONFIG[k.divisi]?.label)||k.divisi_label||k.divisi||"-"}</td>
        <td style="padding:6px;border:1px solid #cbd5e1;">${k.operator||"-"}</td>
        <td style="padding:6px;border:1px solid #cbd5e1;">${k.proses||"-"}</td>
        <td style="padding:6px;border:1px solid #cbd5e1;">${(k.catatan||"").replace(/</g,"&lt;")}</td>
      </tr>
    `).join("");
    const html=`
      <html><head><meta charset="utf-8"></head>
      <body style="font-family:Calibri,Arial,sans-serif;">
        <h2>Laporan Kendala</h2>
        <p><b>Proyek:</b> ${proyek} &nbsp;&nbsp; <b>Panel:</b> ${panel}</p>
        <table style="border-collapse:collapse;width:100%;">
          <tr style="background:#1d4ed8;color:#fff;">
            <th style="padding:6px;border:1px solid #cbd5e1;">Tanggal</th>
            <th style="padding:6px;border:1px solid #cbd5e1;">Divisi</th>
            <th style="padding:6px;border:1px solid #cbd5e1;">Operator</th>
            <th style="padding:6px;border:1px solid #cbd5e1;">Proses</th>
            <th style="padding:6px;border:1px solid #cbd5e1;">Catatan</th>
          </tr>
          ${rows}
        </table>
      </body></html>
    `;
    const blob=new Blob(['﻿', html], {type:'application/msword'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url;
    a.download=("Kendala_"+proyek+"_"+panel+".doc").replace(/[\/\\?%*:|"<>]/g,"_");
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if(!selectedProyek){
    const proyekKeys=Object.keys(groups).sort();
    return(
      <div className="fi">
        <STitle>Kendala</STitle>
        {proyekKeys.length===0?(
          <div style={{textAlign:"center",padding:"60px 20px",color:"#94a3b8"}}>
            <div style={{fontSize:40,marginBottom:12}}>📭</div>
            <div style={{fontSize:14,fontWeight:600}}>Belum ada catatan kendala</div>
            <div style={{fontSize:12,marginTop:4}}>Catatan dari operator akan muncul di sini</div>
          </div>
        ):(
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:12}}>
            {proyekKeys.map(pj=>{
              const panels=groups[pj];
              const totalCount=Object.values(panels).reduce((s:number,arr:any)=>s+arr.length,0);
              const panelCount=Object.keys(panels).length;
              return(
                <div key={pj} onClick={()=>setSelectedProyek(pj)}
                  style={{cursor:"pointer",background:"var(--card-bg,#fff)",border:"1px solid var(--border-color,#e2e8f0)",borderRadius:10,padding:16,transition:"all .15s"}}>
                  <div style={{fontSize:24,marginBottom:6}}>📁</div>
                  <div style={{fontWeight:700,fontSize:13,color:"#1e293b",marginBottom:4}}>{pj}</div>
                  <div style={{fontSize:11,color:"#64748b"}}>{panelCount} panel · {totalCount} catatan</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  if(selectedProyek&&!selectedPanel){
    const panels=groups[selectedProyek]||{};
    const panelKeys=Object.keys(panels).sort();
    return(
      <div className="fi">
        <button onClick={()=>setSelectedProyek(null)}
          style={{background:"none",border:"none",color:"#1d4ed8",cursor:"pointer",fontSize:12,fontWeight:600,marginBottom:12,padding:0}}>← Kembali ke Proyek</button>
        <STitle>{selectedProyek}</STitle>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:12,marginTop:12}}>
          {panelKeys.map(pnl=>{
            const items=panels[pnl];
            return(
              <div key={pnl} onClick={()=>setSelectedPanel(pnl)}
                style={{cursor:"pointer",background:"var(--card-bg,#fff)",border:"1px solid var(--border-color,#e2e8f0)",borderRadius:10,padding:16}}>
                <div style={{fontSize:24,marginBottom:6}}>🗂️</div>
                <div style={{fontWeight:700,fontSize:13,color:"#1e293b",marginBottom:4}}>{pnl}</div>
                <div style={{fontSize:11,color:"#64748b"}}>{items.length} catatan</div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  const items=[...(groups[selectedProyek]?.[selectedPanel as string]||[])].sort((a:any,b:any)=>(b.ts||"").localeCompare(a.ts||""));
  return(
    <div className="fi">
      <button onClick={()=>setSelectedPanel(null)}
        style={{background:"none",border:"none",color:"#1d4ed8",cursor:"pointer",fontSize:12,fontWeight:600,marginBottom:12,padding:0}}>← Kembali ke {selectedProyek}</button>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap" as const,gap:8}}>
        <STitle style={{marginBottom:0}}>{selectedProyek} — {selectedPanel}</STitle>
        <button onClick={()=>downloadWord(selectedProyek as string,selectedPanel as string,items)}
          style={{padding:"8px 16px",borderRadius:8,border:"none",background:"#1d4ed8",color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
          ⬇ Download Word
        </button>
      </div>
      {items.length===0?(
        <div style={{textAlign:"center",padding:"40px 20px",color:"#94a3b8"}}>Tidak ada catatan</div>
      ):(
        <div style={{display:"flex",flexDirection:"column" as const,gap:10}}>
          {items.map((k:any)=>(
            <div key={k.id} style={{background:"var(--card-bg,#fff)",border:"1px solid var(--border-color,#e2e8f0)",borderRadius:10,padding:"12px 16px"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6,flexWrap:"wrap" as const,gap:6}}>
                <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap" as const}}>
                  <span style={{fontSize:11,fontWeight:700,color:"#1d4ed8"}}>{DIVISI_CONFIG[k.divisi]?.label||k.divisi_label||k.divisi}</span>
                  <span style={{fontSize:11,color:"#94a3b8"}}>·</span>
                  <span style={{fontSize:11,color:"#475569",fontWeight:600}}>{k.operator}</span>
                  <span style={{fontSize:11,color:"#94a3b8"}}>·</span>
                  <span style={{fontSize:11,color:"#94a3b8"}}>{k.tanggal}</span>
                  <span style={{fontSize:10,background:"#f1f5f9",color:"#64748b",borderRadius:20,padding:"1px 8px",fontWeight:600}}>{k.proses}</span>
                </div>
                {user?.role==="admin"&&(
                  <button onClick={()=>removeKendala(k.id)}
                    style={{background:"none",border:"none",color:"#dc2626",cursor:"pointer",fontSize:11}}>Hapus</button>
                )}
              </div>
              <div style={{fontSize:13,color:"#1e293b"}}>{k.catatan}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
