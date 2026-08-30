import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { FotoZoomViewer, type FotoViewer } from "./FotoZoomViewer";
import { Card, Badge, PBar } from "./ui/Primitives";

// ─────────────────────────────────────────────────────────────────────────────
// MOM FAT (30 Agu 2026) - System > MOM FAT, READ-ONLY (admin cuma lihat progress checklist
// hasil OCR dari Vista Pekerja, gak ada checkbox/edit yang bisa diklik di sini). Realtime:
// begitu QC centang/edit poin di Vista Pekerja, halaman ini update otomatis tanpa refresh.
//
// Tabel `mom_fat`/`mom_fat_poin` BELUM masuk supabase-generated.ts - pakai (table as any),
// pola yang sudah ada di codebase ini (lihat ProyekLuarTab.tsx).
// ─────────────────────────────────────────────────────────────────────────────
export function MomFatTab(){
  const[loading,setLoading]=useState(true);
  const[list,setList]=useState<any[]>([]);
  const[progressMap,setProgressMap]=useState<Record<number,{done:number,total:number}>>({});
  const[search,setSearch]=useState("");
  const[expandedId,setExpandedId]=useState<number|null>(null);
  const[poinMap,setPoinMap]=useState<Record<number,any[]>>({});
  const[fotoViewer,setFotoViewer]=useState<{fotos:FotoViewer[],startIndex:number,label:string}|null>(null);

  const fetchList=async()=>{
    setLoading(true);
    const{data}=await supabase.from("mom_fat" as any).select("*").order("created_at",{ascending:false}).limit(200);
    setList(data||[]);
    const{data:poinAll}=await supabase.from("mom_fat_poin" as any).select("mom_fat_id,selesai");
    const map:Record<number,{done:number,total:number}>={};
    (poinAll||[]).forEach((p:any)=>{
      if(!map[p.mom_fat_id])map[p.mom_fat_id]={done:0,total:0};
      map[p.mom_fat_id].total++;
      if(p.selesai)map[p.mom_fat_id].done++;
    });
    setProgressMap(map);
    setLoading(false);
  };
  useEffect(()=>{
    fetchList();
    const ch=supabase.channel("realtime-mom-fat-admin")
      .on("postgres_changes",{event:"*",schema:"public",table:"mom_fat"},fetchList)
      .on("postgres_changes",{event:"*",schema:"public",table:"mom_fat_poin"},fetchList)
      .subscribe();
    return()=>{supabase.removeChannel(ch);};
  },[]);

  // Realtime detail poin - kalau ada record yang lagi diexpand, refetch poin-nya juga tiap
  // ada event (sudah kecover channel di atas via fetchList, tapi poin per-record dimuat lazy
  // di toggleExpand jadi perlu refresh manual saat expanded biar isi detailnya ikut update).
  useEffect(()=>{
    if(expandedId==null)return;
    const ch=supabase.channel("realtime-mom-fat-detail-"+expandedId)
      .on("postgres_changes",{event:"*",schema:"public",table:"mom_fat_poin"},(payload:any)=>{
        const row=payload.new||payload.old;
        if(row?.mom_fat_id===expandedId)fetchPoin(expandedId);
      })
      .subscribe();
    return()=>{supabase.removeChannel(ch);};
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[expandedId]);

  const fetchPoin=async(momFatId:number)=>{
    const{data}=await supabase.from("mom_fat_poin" as any).select("*").eq("mom_fat_id",momFatId).order("urutan",{ascending:true});
    setPoinMap(prev=>({...prev,[momFatId]:data||[]}));
  };
  const toggleExpand=(m:any)=>{
    if(expandedId===m.id){setExpandedId(null);return;}
    setExpandedId(m.id);
    if(!poinMap[m.id])fetchPoin(m.id);
  };

  const filtered=list.filter(m=>{
    const q=search.trim().toLowerCase();
    if(!q)return true;
    return(m.judul||"").toLowerCase().includes(q)||(m.operator_nama||"").toLowerCase().includes(q);
  });

  const statusStyle:any={
    processing:{bg:"#fffbeb",color:"#d97706",label:"Proses OCR..."},
    ready:{bg:"#f0fdf4",color:"#16a34a",label:"Siap"},
    error:{bg:"#fef2f2",color:"#dc2626",label:"Gagal OCR"},
  };

  return(
    <div className="fi">
      <div style={{marginBottom:16}}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Cari judul dokumen / operator..."
          style={{width:"100%",maxWidth:400,padding:"9px 12px",borderRadius:8,border:"1px solid var(--border-color,#e2e8f0)",
            fontSize:13,background:"var(--card-bg,#fff)",color:"var(--text-primary,#1e293b)"}}/>
      </div>

      {loading?(
        <div style={{textAlign:"center",padding:40,color:"#94a3b8"}}>Memuat data...</div>
      ):filtered.length===0?(
        <div style={{textAlign:"center",padding:40,color:"#94a3b8"}}>Tidak ada dokumen MOM FAT.</div>
      ):(
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          {filtered.map(m=>{
            const isExp=expandedId===m.id;
            const st=statusStyle[m.status]||statusStyle.processing;
            const prog=progressMap[m.id]||{done:0,total:0};
            const pct=prog.total>0?Math.round((prog.done/prog.total)*100):0;
            const accent=m.status==="error"?"#dc2626":m.status==="processing"?"#d97706":(pct>=100?"#16a34a":"#3b82f6");
            return(
              <Card key={m.id} style={{padding:0,overflow:"hidden",borderLeft:`3px solid ${accent}`}}>
                <div className="erp-clickable-row" onClick={()=>toggleExpand(m)} style={{padding:"14px 16px",cursor:"pointer",
                  display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap",
                  background:isExp?"#f8faff":"transparent"}}>
                  <div style={{display:"flex",alignItems:"center",gap:12,flex:1,minWidth:0}}>
                    <div style={{width:38,height:38,borderRadius:10,background:accent+"18",display:"flex",
                      alignItems:"center",justifyContent:"center",flexShrink:0}}>
                      <i className="ti ti-file-text" style={{fontSize:18,color:accent}}/>
                    </div>
                    <div style={{minWidth:0,flex:1}}>
                      <div style={{fontWeight:800,fontSize:14,color:"var(--text-primary,#1e293b)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{m.judul}</div>
                      <div style={{fontSize:12,color:"#94a3b8",marginTop:3}}>
                        👤 {m.operator_nama} · {new Date(m.created_at).toLocaleDateString("id-ID",{day:"numeric",month:"short",year:"numeric"})}
                        {m.status==="ready"&&` · ${prog.done}/${prog.total} poin`}
                      </div>
                      {m.status==="ready"&&prog.total>0&&(
                        <div style={{marginTop:8,maxWidth:280}}><PBar pct={pct} h={6}/></div>
                      )}
                    </div>
                  </div>
                  <Badge label={st.label} color={st.color} bg={st.bg}/>
                </div>
                {isExp&&(
                  <div style={{padding:"14px 16px",borderTop:"1px solid var(--border-color,#f1f5f9)"}}>
                    <div style={{display:"flex",alignItems:"center",gap:10,background:"var(--bg-secondary,#f8fafc)",
                      borderRadius:10,padding:"10px 12px",marginBottom:14}}>
                      <i className="ti ti-file-description" style={{fontSize:20,color:"#64748b",flexShrink:0}}/>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:11,color:"#94a3b8"}}>Dokumen asli · diupload {m.operator_nama}</div>
                        <a href={m.file_url} target="_blank" rel="noreferrer" style={{fontSize:12.5,fontWeight:700,color:"#2563eb",textDecoration:"none"}}>
                          Lihat/Download dokumen →
                        </a>
                      </div>
                    </div>
                    {!poinMap[m.id]?(
                      <div style={{fontSize:12,color:"#94a3b8"}}>Memuat checklist...</div>
                    ):poinMap[m.id].length===0?(
                      <div style={{fontSize:12,color:"#94a3b8"}}>Belum ada poin checklist.</div>
                    ):(
                      <div style={{display:"flex",flexDirection:"column",gap:6}}>
                        {poinMap[m.id].map(p=>(
                          <div key={p.id} style={{display:"flex",alignItems:"flex-start",gap:9,padding:"10px 12px",
                            background:p.selesai?"#f0fdf4":"var(--bg-secondary,#f8fafc)",
                            border:`1px solid ${p.selesai?"#bbf7d0":"var(--border-color,#e2e8f0)"}`,borderRadius:8}}>
                            <i className={"ti "+(p.selesai?"ti-square-check":"ti-square")} style={{fontSize:16,color:p.selesai?"#16a34a":"#cbd5e1",marginTop:1,flexShrink:0}}/>
                            <div style={{flex:1,minWidth:0}}>
                              <div style={{fontSize:12.5,color:p.selesai?"#16a34a":"var(--text-primary,#1e293b)",textDecoration:p.selesai?"line-through":"none"}}>{p.teks}</div>
                              {p.dicentang_oleh&&<div style={{fontSize:10,color:"#94a3b8",marginTop:2}}>✓ {p.dicentang_oleh}{p.dicentang_at&&" · "+new Date(p.dicentang_at).toLocaleDateString("id-ID",{day:"numeric",month:"short"})}</div>}
                              {(p.foto||[]).length>0&&(
                                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(56px,1fr))",gap:5,marginTop:6,maxWidth:280}}>
                                  {p.foto.map((f:any,fi:number)=>(
                                    <div key={fi} onClick={()=>setFotoViewer({fotos:p.foto,startIndex:fi,label:p.teks})}
                                      style={{aspectRatio:"1",borderRadius:7,overflow:"hidden",cursor:"pointer",background:"#f1f5f9"}}>
                                      <img src={f.url} loading="lazy" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {fotoViewer&&<FotoZoomViewer fotos={fotoViewer.fotos} startIndex={fotoViewer.startIndex} label={fotoViewer.label} onClose={()=>setFotoViewer(null)}/>}
    </div>
  );
}
