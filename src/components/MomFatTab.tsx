import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { FotoZoomViewer, type FotoViewer } from "./FotoZoomViewer";
import { Card, Badge, PBar } from "./ui/Primitives";
import { MomFatUploadPanel } from "./MomFatUploadPanel";
import { deleteFromR2, extractR2Key } from "../lib/r2Client";
import { activityLogService } from "../services/activityLogService";
import { ThumbMedia } from './ui/ThumbMedia'
import { isVideoFoto } from '../lib/mediaThumb'

// ─────────────────────────────────────────────────────────────────────────────
// MOM FAT (30 Agu 2026) - Report Produksi > MOM FAT. REVISI ALUR (3 Okt 2026, diminta user):
// Admin/Engineering yang UPLOAD dokumen + menyusun poin checklist (MomFatUploadPanel, OCR + koreksi),
// juga edit/tambah/hapus poin, arsip & hapus dokumen di sini. QC di Vista Pekerja cuma centang +
// foto per poin (tidak upload/edit poin lagi). Centang tetap READ-ONLY di sini. Realtime:
// begitu QC centang poin di Vista Pekerja, halaman ini update otomatis tanpa refresh.
//
// Tabel `mom_fat`/`mom_fat_poin` BELUM masuk supabase-generated.ts - pakai (table as any),
// pola yang sudah ada di codebase ini (lihat ProyekLuarTab.tsx).
// ─────────────────────────────────────────────────────────────────────────────
export function MomFatTab({user}:{user?:any}={}){
  const uname=(()=>{try{const sess=JSON.parse(localStorage.getItem("vista_admin_session")||"{}");return user?.name||user?.nama||sess?.nama||"Admin";}catch{return user?.name||user?.nama||"Admin";}})();
  const[showUpload,setShowUpload]=useState(false);
  const[editPoin,setEditPoin]=useState<{id:number,teks:string}|null>(null);
  const[poinBaruMap,setPoinBaruMap]=useState<Record<number,string>>({});
  const[sibukId,setSibukId]=useState<number|null>(null);
  const[loading,setLoading]=useState(true);
  const[list,setList]=useState<any[]>([]);
  const[progressMap,setProgressMap]=useState<Record<number,{done:number,total:number}>>({});
  const[search,setSearch]=useState("");
  const[viewMode,setViewMode]=useState<"aktif"|"arsip">("aktif");
  const[expandedId,setExpandedId]=useState<number|null>(null);
  const[poinMap,setPoinMap]=useState<Record<number,any[]>>({});
  const[fotoViewer,setFotoViewer]=useState<{fotos:FotoViewer[],startIndex:number,label:string}|null>(null);

  // silent (4 Sep 2026, fix pola sama RiwayatGudangTab.tsx) - dipakai listener realtime di bawah
  // (tanpa filter, halaman ini READ-ONLY jadi SEMUA setLoading(true) di sini murni dipicu
  // aktivitas QC di Vista Pekerja) biar list gak "berkedip" tiap ada QC centang/upload apa pun.
  const fetchList=async(silent=false)=>{
    if(!silent)setLoading(true);
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
    if(!silent)setLoading(false);
  };
  useEffect(()=>{
    fetchList();
    const ch=supabase.channel("realtime-mom-fat-admin")
      .on("postgres_changes",{event:"*",schema:"public",table:"mom_fat"},()=>fetchList(true))
      .on("postgres_changes",{event:"*",schema:"public",table:"mom_fat_poin"},()=>fetchList(true))
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

  // ── Kelola dokumen & poin (Admin/Engineering, 3 Okt 2026) ──
  const simpanEditPoin=async(p:any)=>{
    const teks=(editPoin?.teks||"").trim();setEditPoin(null);
    if(!teks||teks===p.teks)return;
    const{error}=await (supabase.from("mom_fat_poin" as any) as any).update({teks}).eq("id",p.id);
    if(error){alert("Gagal menyimpan poin: "+error.message);return;}
    fetchPoin(p.mom_fat_id);
  };
  const hapusPoin=async(p:any)=>{
    if(!confirm(`Hapus poin ini?\n\n"${p.teks}"${p.selesai?"\n\nPoin ini SUDAH dicentang QC.":""}`))return;
    const{error}=await (supabase.from("mom_fat_poin" as any) as any).delete().eq("id",p.id);
    if(error){alert("Gagal menghapus poin: "+error.message);return;}
    fetchPoin(p.mom_fat_id);
  };
  const tambahPoin=async(m:any)=>{
    const teks=(poinBaruMap[m.id]||"").trim();if(!teks)return;
    const poin=poinMap[m.id]||[];
    const urutan=poin.length?Math.max(...poin.map((x:any)=>x.urutan))+1:1;
    const{error}=await (supabase.from("mom_fat_poin" as any) as any).insert({mom_fat_id:m.id,urutan,teks,ocr_confidence:null});
    if(error){alert("Gagal menambah poin: "+error.message);return;}
    setPoinBaruMap(prev=>({...prev,[m.id]:""}));
    fetchPoin(m.id);
  };
  const toggleArsip=async(m:any)=>{
    const{error}=await (supabase.from("mom_fat" as any) as any).update({is_archived:!m.is_archived}).eq("id",m.id);
    if(error){alert("Gagal mengubah arsip: "+error.message);return;}
    fetchList(true);
  };
  const hapusDokumen=async(m:any)=>{
    if(!confirm(`Hapus dokumen "${m.judul}"?\n\nSemua poin checklist & foto QC di dalamnya ikut terhapus permanen dan TIDAK BISA dibatalkan.`))return;
    setSibukId(m.id);
    const{data:poin,error:pErr}=await (supabase.from("mom_fat_poin" as any) as any).select("foto").eq("mom_fat_id",m.id);
    if(pErr){alert("Gagal membaca poin: "+pErr.message);setSibukId(null);return;}
    const{error}=await (supabase.from("mom_fat" as any) as any).delete().eq("id",m.id);
    if(error){alert("Gagal menghapus dokumen: "+error.message);setSibukId(null);return;}
    // file R2 dibersihkan SETELAH row terhapus (gagal hapus file tidak bikin dokumen nyangkut di daftar)
    const urls=[m.file_url,...(poin||[]).flatMap((p:any)=>(p.foto||[]).map((x:any)=>x.url))];
    for(const u of urls){const k=extractR2Key(u||"");if(k)await deleteFromR2(k).catch(e=>console.error("hapus file R2 MOM FAT gagal:",e));}
    await activityLogService.insert({user_name:uname,action:"HAPUS MOM FAT",module:"qc",halaman:"MOM FAT",description:`Hapus MOM FAT "${m.judul}"`});
    setSibukId(null);setExpandedId(null);fetchList(true);
  };

  const filtered=list.filter(m=>{
    const q=search.trim().toLowerCase();
    const matchQ=!q||(m.judul||"").toLowerCase().includes(q)||(m.operator_nama||"").toLowerCase().includes(q);
    if(!matchQ)return false;
    return viewMode==="arsip"?m.is_archived:(q?true:!m.is_archived);
  });

  const statusStyle:any={
    processing:{bg:"#fffbeb",color:"#d97706",label:"Proses OCR..."},
    ready:{bg:"#f0fdf4",color:"#16a34a",label:"Siap"},
    error:{bg:"#fef2f2",color:"#dc2626",label:"Gagal OCR"},
  };

  return(
    <div className="fi">
      <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap"}}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Cari judul dokumen / operator..."
          style={{flex:1,minWidth:200,maxWidth:400,padding:"9px 12px",borderRadius:8,border:"1px solid var(--border-color,#e2e8f0)",
            fontSize:13,background:"var(--card-bg,#fff)",color:"var(--text-primary,#1e293b)"}}/>
        <div style={{display:"flex",gap:6}}>
          <button onClick={()=>setViewMode("aktif")} style={{padding:"9px 14px",borderRadius:8,border:"none",cursor:"pointer",
            fontSize:12.5,fontWeight:700,background:viewMode==="aktif"?"#1d4ed8":"var(--bg-secondary,#f1f5f9)",color:viewMode==="aktif"?"#fff":"#64748b"}}>
            Aktif
          </button>
          <button onClick={()=>setViewMode("arsip")} style={{padding:"9px 14px",borderRadius:8,border:"none",cursor:"pointer",
            fontSize:12.5,fontWeight:700,background:viewMode==="arsip"?"#1d4ed8":"var(--bg-secondary,#f1f5f9)",color:viewMode==="arsip"?"#fff":"#64748b"}}>
            🗄️ Arsip
          </button>
        </div>
        <button onClick={()=>setShowUpload(v=>!v)} style={{marginLeft:"auto",padding:"9px 16px",borderRadius:8,border:"none",cursor:"pointer",
          fontSize:12.5,fontWeight:700,background:"#0f766e",color:"#fff"}}>
          {showUpload?"Tutup Upload":"+ Upload MOM FAT"}
        </button>
      </div>
      {showUpload&&<MomFatUploadPanel uname={uname} onBatal={()=>setShowUpload(false)} onSelesai={()=>{setShowUpload(false);setViewMode("aktif");fetchList(true);}}/>}

      {loading?(
        <div style={{textAlign:"center",padding:40,color:"#94a3b8"}}>Memuat data...</div>
      ):filtered.length===0?(
        <div style={{textAlign:"center",padding:40,color:"#94a3b8"}}>{viewMode==="arsip"?"Belum ada dokumen diarsip.":"Tidak ada dokumen MOM FAT."}</div>
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
                  <div style={{display:"flex",alignItems:"center",gap:6,flexShrink:0}}>
                    {m.is_archived&&<Badge label="Arsip" color="#64748b" bg="#f1f5f9"/>}
                    <Badge label={st.label} color={st.color} bg={st.bg}/>
                  </div>
                </div>
                {isExp&&(
                  <div style={{padding:"14px 16px",borderTop:"1px solid var(--border-color,#f1f5f9)",textAlign:"left"}}>
                    <div style={{display:"flex",alignItems:"center",gap:10,background:"var(--bg-secondary,#f8fafc)",
                      borderRadius:10,padding:"10px 12px",marginBottom:14}}>
                      <i className="ti ti-file-description" style={{fontSize:20,color:"#64748b",flexShrink:0}}/>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:11,color:"#94a3b8"}}>Dokumen asli · diupload {m.operator_nama}</div>
                        <a href={m.file_url} target="_blank" rel="noreferrer" style={{fontSize:12.5,fontWeight:700,color:"#2563eb",textDecoration:"none"}}>
                          Lihat/Download dokumen →
                        </a>
                      </div>
                      <button onClick={()=>toggleArsip(m)} style={{border:"1px solid #e2e8f0",background:"#fff",borderRadius:7,padding:"5px 10px",fontSize:11.5,fontWeight:700,color:"#64748b",cursor:"pointer",fontFamily:"inherit"}}>
                        {m.is_archived?"Batalkan Arsip":"Arsipkan"}
                      </button>
                      <button onClick={()=>hapusDokumen(m)} disabled={sibukId===m.id} style={{border:"1px solid #fecaca",background:"#fff",borderRadius:7,padding:"5px 10px",fontSize:11.5,fontWeight:700,color:"#dc2626",cursor:"pointer",fontFamily:"inherit"}}>
                        {sibukId===m.id?"Menghapus...":"Hapus"}
                      </button>
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
                              {editPoin?.id===p.id?(
                                <input autoFocus value={editPoin.teks} onChange={e=>setEditPoin({id:p.id,teks:e.target.value})} onBlur={()=>simpanEditPoin(p)}
                                  onKeyDown={e=>{if(e.key==="Enter")(e.target as HTMLInputElement).blur();if(e.key==="Escape")setEditPoin(null);}}
                                  style={{width:"100%",textAlign:"left",padding:"5px 8px",borderRadius:6,border:"1.5px solid #2563eb",fontSize:12.5,fontFamily:"inherit",boxSizing:"border-box"}}/>
                              ):(
                                <div onClick={()=>setEditPoin({id:p.id,teks:p.teks})} title="Klik untuk mengedit teks poin" style={{textAlign:"left",fontSize:12.5,color:p.selesai?"#16a34a":"var(--text-primary,#1e293b)",textDecoration:p.selesai?"line-through":"none",cursor:"text"}}>{p.teks}</div>
                              )}
                              {p.dicentang_oleh&&<div style={{fontSize:10,color:"#94a3b8",marginTop:2}}>✓ {p.dicentang_oleh}{p.dicentang_at&&" · "+new Date(p.dicentang_at).toLocaleDateString("id-ID",{day:"numeric",month:"short"})}</div>}
                              {(p.foto||[]).length>0&&(
                                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(56px,1fr))",gap:5,marginTop:6,maxWidth:280}}>
                                  {p.foto.map((f:any,fi:number)=>(
                                    <div key={fi} onClick={()=>setFotoViewer({fotos:p.foto,startIndex:fi,label:p.teks})}
                                      style={{aspectRatio:"1",borderRadius:7,overflow:"hidden",cursor:"pointer",background:"#f1f5f9"}}>
                                      <ThumbMedia url={f.url} video={isVideoFoto(f)}/>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                            <button onClick={()=>hapusPoin(p)} title="Hapus poin" style={{background:"none",border:"none",color:"#cbd5e1",cursor:"pointer",padding:2,flexShrink:0}}>
                              <i className="ti ti-x" style={{fontSize:14}}/>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    {poinMap[m.id]&&(
                      <div style={{display:"flex",gap:8,marginTop:10}}>
                        <input value={poinBaruMap[m.id]||""} onChange={e=>setPoinBaruMap(prev=>({...prev,[m.id]:e.target.value}))} onKeyDown={e=>{if(e.key==="Enter")tambahPoin(m);}}
                          placeholder="Tambah poin checklist..." style={{flex:1,padding:"8px 10px",borderRadius:8,border:"1px solid var(--border-color,#e2e8f0)",fontSize:12.5,fontFamily:"inherit"}}/>
                        <button onClick={()=>tambahPoin(m)} style={{padding:"8px 14px",borderRadius:8,border:"none",background:"#1d4ed8",color:"#fff",fontWeight:700,fontSize:12.5,cursor:"pointer",fontFamily:"inherit"}}>+ Tambah</button>
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
