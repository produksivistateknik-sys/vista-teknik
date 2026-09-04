import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { activityLogService } from '../services/activityLogService'
import { calcPanelProgress, getEffCfgGlobal } from '../lib/panelHelpers'
import { Modal } from './ui/Primitives'
import { FotoZoomViewer } from './FotoZoomViewer'
import { isVideoFoto, isGenericFoto } from '../lib/mediaThumb'

const QC_STATUS_LABEL:Record<string,{label:string,color:string,bg:string}>={
  to_do:{label:"To Do",color:"#64748b",bg:"#f1f5f9"},
  in_progress:{label:"In Progress",color:"#ea580c",bg:"#fff7ed"},
  complete:{label:"Complete",color:"#16a34a",bg:"#f0fdf4"},
};

const QC_ITEMS_ARSIP=[
  {key:"fisik",label:"Pemeriksaan Fisik"},
  {key:"spesifikasi",label:"Verifikasi Spesifikasi Komponen"},
  {key:"baut",label:"Pengecekan Kekencangan Baut"},
  {key:"test",label:"QC Test"},
];

// Section "progress+foto flat" - Nameplate/Yellowmark/Assembling/Warehouse/QS semuanya punya
// bentuk sama persis (1 angka progress + 1 array foto langsung di kolom panels), beda dari QC
// (checklist per-item) dan Wiring Control (per-komponen). Sama persis kolom yang dipakai
// LaporanNameplateView/LaporanKomponenProgressView/LaporanPasangKomponenView.
const QC_CENTER_SECTIONS_FLAT=[
  {key:"nameplate",label:"Nameplate",icon:"🏷️",progressField:"nameplate_progress",fotoField:"nameplate_photos"},
  {key:"yellowmark",label:"Yellowmark",icon:"🟡",progressField:"yellowmark_progress",fotoField:"yellowmark_photos"},
  {key:"warehouse",label:"Warehouse",icon:"📦",progressField:"warehouse_progress",fotoField:"warehouse_photos"},
  {key:"qs",label:"QS",icon:"📋",progressField:"qs_progress",fotoField:"qs_photos"},
];

const WIRING_KOMPONEN_NAMA=["Box Control","Pintu"];

// Daftar kode Box Control/Pintu yang relevan buat 1 panel (nama, bukan kode - kode beda-beda
// per tipe panel) - persis sama logic komponenWiringPanel di LaporanWiringKomponenView. REVISI
// (5 Agu 2026): pct sekarang kontribusi tahap WIRING ke progress PASANG KOMPONEN gabungan
// (checklist[kode].pasangKomponenTahap.WIRING), bukan lagi progress["WIRING CONTROL"] yang
// sekarang independen sepenuhnya dari pasang-komponen.
const komponenWiringPanel=(panel:any)=>{
  const cfg=getEffCfgGlobal(panel.tipe);
  if(!cfg)return[];
  const items=cfg.wps.flatMap((w:any)=>w.items);
  return items
    .filter((it:any)=>WIRING_KOMPONEN_NAMA.includes(it.nama)&&(panel.checklist?.[it.kode]?.qty||0)>0)
    .map((it:any)=>{
      const cl=panel.checklist?.[it.kode];
      return{kode:it.kode,nama:it.nama,pct:cl?.pasangKomponenTahap?.WIRING?.progress||0,foto:cl?.fotoPemasangan||[]};
    });
};

const totalFotoQualityCenter=(p:any):number=>{
  const cl=p.qc_checklist||{};
  let total=QC_ITEMS_ARSIP.reduce((s,item)=>s+((cl[item.key]?.foto||[]).length),0);
  QC_CENTER_SECTIONS_FLAT.forEach(s=>{total+=(p[s.fotoField]||[]).length;});
  total+=(p.pasang_komponen_photos||[]).length;
  const checklist=p.checklist||{};
  Object.entries(checklist).forEach(([,val]:any)=>{
    if(val?.fotoPemasangan?.length)total+=val.fotoPemasangan.length;
  });
  return total;
};

export function ArsipTab({user,refetchWO}:any){
  // Engineering baca-saja (REVISI 4 Sep 2026 - "WO Digital > Arsip" reuse komponen ini apa
  // adanya) - Unarchive (kembalikan panel ke produksi aktif) tetap admin-only.
  const canUnarsip=["admin"].includes(user?.divisi);
  const[panelList,setPanelList]=useState<any[]>([]);
  const[loading,setLoading]=useState(true);
  const[search,setSearch]=useState("");
  const[unarsipLoadingId,setUnarsipLoadingId]=useState<number|null>(null);
  const[expandedWo,setExpandedWo]=useState<Record<number,boolean>>({});
  const[woArchivedMap,setWoArchivedMap]=useState<Record<number,boolean>>({});
  const[qcDetailPanel,setQcDetailPanel]=useState<any>(null);
  const[lightbox,setLightbox]=useState<{fotos:any[],index:number,label:string}|null>(null);
  const[wiList,setWiList]=useState<any[]>([]);
  const[revList,setRevList]=useState<any[]>([]);

  // Dokumen Gambar Teknik (REVISI 4 Sep 2026) - work_instructions.panel_id di-set NULL kalau
  // panelnya diarsipkan (lihat migration 20260904060000, fix cascade-delete), jadi dicari
  // balik lewat wo_id (bukan panel_id) - SEMUA revisi ditampilkan (bukan cuma current), ini
  // riwayat historis. Fetch independen dari panelList/panels_archived, tabel kecil, gak perlu
  // paginasi .range() sekelas itu.
  const fetchDokumen=async()=>{
    const[{data:wi},{data:rev}]=await Promise.all([
      supabase.from("work_instructions" as any).select("*"),
      supabase.from("wi_revisions" as any).select("*").order("revision_number",{ascending:false}),
    ]);
    setWiList(wi||[]);
    setRevList(rev||[]);
  };
  useEffect(()=>{fetchDokumen();},[]);

  const fetchPanelArsip=async()=>{
    setLoading(true);
    // Paginasi eksplisit by .range() (audit egress Agu 2026) - tanpa ini query diam-diam capped
    // 1000 baris (bug class yang sama kayak saga renhar dulu), padahal arsip cuma nambah terus.
    let all:any[]=[];
    let from=0;
    const pageSize=1000;
    for(;;){
      const{data,error}=await supabase.from("panels_archived").select("*").order("diarsipkan_pada",{ascending:false}).range(from,from+pageSize-1);
      if(error||!data)break;
      all=all.concat(data);
      if(data.length<pageSize)break;
      from+=pageSize;
    }
    setPanelList(all);
    setLoading(false);
  };
  useEffect(()=>{fetchPanelArsip();},[]);

  useEffect(()=>{
    const woIds=[...new Set(panelList.map((p:any)=>p.wo_id).filter(Boolean))];
    if(woIds.length===0){setWoArchivedMap({});return;}
    supabase.from("work_orders").select("id,is_archived").in("id",woIds).then(({data}:any)=>{
      const m:Record<number,boolean>={};
      (data??[]).forEach((w:any)=>{m[w.id]=!!w.is_archived;});
      setWoArchivedMap(m);
    });
  },[panelList]);

  const unarsipkan=async(p:any)=>{
    if(!confirm(`Kembalikan panel "${p.nama}" ke tampilan aktif? Semua data (checklist, progress, riwayat timer, QC) dikembalikan utuh.`))return;
    setUnarsipLoadingId(p.id);
    const{error}=await supabase.rpc("unarsip_panel",{p_panel_id:p.id});
    setUnarsipLoadingId(null);
    if(error){alert("Gagal unarchive: "+error.message);return;}
    const sess=JSON.parse(localStorage.getItem("vista_admin_session")||"{}");
    const uname=user?.name||user?.nama||sess?.nama||"Admin";
    await activityLogService.insert({
      user_name:uname,action:"UNARCHIVE PANEL",
      description:"Kembalikan panel "+p.nama+" dari arsip ke WO "+(p.wo_number_snapshot||"")+" - "+(p.proyek_snapshot||""),
      module:"wo",halaman:"Manajemen WO",proyek:p.proyek_snapshot||"",panel:p.nama,wo_number:p.wo_number_snapshot||"",
    });
    setPanelList(prev=>prev.filter((x:any)=>x.id!==p.id));
    if(refetchWO)await refetchWO();
    alert("Panel "+p.nama+" berhasil dikembalikan ke tampilan aktif.");
  };

  const grouped=useMemo(()=>{
    const map:Record<number,{wo_id:number,wo_number:string,proyek:string,panels:any[]}>={};
    panelList.forEach((p:any)=>{
      if(!map[p.wo_id])map[p.wo_id]={wo_id:p.wo_id,wo_number:p.wo_number_snapshot,proyek:p.proyek_snapshot,panels:[]};
      map[p.wo_id].panels.push(p);
    });
    return Object.values(map).sort((a,b)=>{
      const latestA=Math.max(...a.panels.map(p=>new Date(p.diarsipkan_pada).getTime()));
      const latestB=Math.max(...b.panels.map(p=>new Date(p.diarsipkan_pada).getTime()));
      return latestB-latestA;
    });
  },[panelList]);

  const filtered=grouped.filter(g=>
    !search||g.wo_number?.toLowerCase().includes(search.toLowerCase())||g.proyek?.toLowerCase().includes(search.toLowerCase())||
    g.panels.some((p:any)=>p.nama?.toLowerCase().includes(search.toLowerCase()))
  );

  const thS:any={padding:"8px 12px",textAlign:"left",fontSize:10,color:"#64748b",fontWeight:700,background:"#f8fafc"};
  const td:any={padding:"9px 12px",borderTop:"1px solid #f1f5f9",fontSize:12,verticalAlign:"middle"};

  return(
    <div className="fi">
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap" as const,gap:10}}>
        <div>
          <h2 style={{fontSize:18,fontWeight:800,color:"#1e293b",margin:0}}>📦 Arsip</h2>
          <p style={{fontSize:12,color:"#64748b",margin:"4px 0 0"}}>WO yang punya panel diarsipkan - klik untuk lihat rincian panelnya</p>
        </div>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Cari WO/proyek/panel..."
          style={{height:32,padding:"0 12px",border:"1px solid #e2e8f0",borderRadius:8,fontSize:12,width:240,outline:"none",fontFamily:"inherit"}}/>
      </div>

      {loading?(
        <div style={{textAlign:"center",padding:48,color:"#94a3b8"}}>Memuat arsip...</div>
      ):filtered.length===0?(
        <div style={{textAlign:"center",padding:48,color:"#94a3b8",background:"#fff",borderRadius:10,border:"1px solid #e2e8f0"}}>
          <i className="ti ti-archive-off" style={{fontSize:32,display:"block",marginBottom:8}}/>
          Belum ada panel yang diarsipkan
        </div>
      ):(
        <div style={{display:"flex",flexDirection:"column" as const,gap:8}}>
          {filtered.map(g=>{
            const isExp=!!expandedWo[g.wo_id];
            const woPenuh=!!woArchivedMap[g.wo_id];
            return(
              <div key={g.wo_id} style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:10,overflow:"hidden"}}>
                <div onClick={()=>setExpandedWo(prev=>({...prev,[g.wo_id]:!prev[g.wo_id]}))}
                  style={{display:"flex",alignItems:"center",gap:10,padding:"12px 16px",cursor:"pointer",background:isExp?"#f8faff":"#fff"}}>
                  <span style={{fontSize:12,color:"#94a3b8"}}>{isExp?"▼":"▶"}</span>
                  <div style={{flex:1,minWidth:0,textAlign:"left"}}>
                    <div style={{fontWeight:700,fontSize:13,color:"#1e293b"}}>WO {g.wo_number} — {g.proyek}</div>
                    <div style={{fontSize:11,color:"#64748b",marginTop:2}}>{g.panels.length} panel diarsipkan</div>
                  </div>
                  <span style={{background:woPenuh?"#fef2f2":"#fffbeb",color:woPenuh?"#dc2626":"#d97706",
                    border:`1px solid ${woPenuh?"#fecaca":"#fde68a"}`,borderRadius:20,padding:"3px 10px",fontSize:10,fontWeight:700,whiteSpace:"nowrap" as const}}>
                    {woPenuh?"📦 Diarsipkan Penuh":"⚠ Sebagian Diarsip - WO masih aktif"}
                  </span>
                </div>
                {isExp&&(
                  <div style={{overflowX:"auto",borderTop:"1px solid #e2e8f0"}}>
                    <table style={{width:"100%",borderCollapse:"collapse"}}>
                      <thead><tr>
                        <th style={thS}>Nama Panel</th>
                        <th style={{...thS,textAlign:"center"}}>Progress</th>
                        <th style={{...thS,textAlign:"center"}}>Quality Center</th>
                        <th style={thS}>Diarsipkan</th>
                        {canUnarsip&&<th style={{...thS,textAlign:"center"}}>Aksi</th>}
                      </tr></thead>
                      <tbody>
                        {g.panels.map((p:any,i:number)=>{
                          const qc=p.qc_checklist?._global?.status||"to_do";
                          const qcInfo=QC_STATUS_LABEL[qc]||QC_STATUS_LABEL.to_do;
                          const fotoCount=totalFotoQualityCenter(p);
                          return(
                            <tr key={p.id} style={{background:i%2===0?"#fff":"#f8fafc"}}>
                              <td style={{...td,fontWeight:700,color:"#1e293b"}}>{p.nama}</td>
                              <td style={{...td,textAlign:"center",fontWeight:800,color:"#1d4ed8"}}>{p.progress_snapshot??0}%</td>
                              <td style={{...td,textAlign:"center"}}>
                                <button onClick={()=>setQcDetailPanel(p)}
                                  style={{background:"none",border:"none",cursor:"pointer",display:"inline-flex",flexDirection:"column" as const,alignItems:"center",gap:2}}>
                                  <span style={{background:qcInfo.bg,color:qcInfo.color,borderRadius:20,padding:"2px 9px",fontSize:10,fontWeight:700}}>{qcInfo.label}</span>
                                  <span style={{fontSize:9,color:"#94a3b8",textDecoration:"underline"}}>📷 {fotoCount} foto</span>
                                </button>
                              </td>
                              <td style={{...td,color:"#94a3b8",fontSize:11}}>{p.diarsipkan_oleh} · {p.diarsipkan_pada?new Date(p.diarsipkan_pada).toLocaleDateString("id-ID"):"—"}</td>
                              {canUnarsip&&(
                                <td style={{...td,textAlign:"center"}}>
                                  <button onClick={()=>unarsipkan(p)} disabled={unarsipLoadingId===p.id}
                                    style={{padding:"5px 12px",borderRadius:7,border:"1px solid #bbf7d0",background:"#f0fdf4",color:"#16a34a",cursor:"pointer",fontSize:11,fontWeight:700}}>
                                    {unarsipLoadingId===p.id?"⏳...":"↩ Unarchive"}
                                  </button>
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {(()=>{
                      const docs=wiList.filter((w:any)=>w.wo_id===g.wo_id);
                      if(docs.length===0)return null;
                      return(
                        <div style={{padding:"12px 16px",borderTop:"1px solid #e2e8f0",background:"#fafbff"}}>
                          <div style={{fontWeight:700,fontSize:12,color:"#1e293b",marginBottom:8}}>📄 Dokumen Gambar Teknik</div>
                          <div style={{display:"flex",flexDirection:"column" as const,gap:8}}>
                            {docs.map((wi:any)=>{
                              const revs=revList.filter((r:any)=>r.work_instruction_id===wi.id).sort((a:any,b:any)=>b.revision_number-a.revision_number);
                              return(
                                <div key={wi.id} style={{border:"1px solid #e2e8f0",borderRadius:8,padding:10,background:"#fff"}}>
                                  <div style={{fontWeight:700,fontSize:11.5,color:"#1e293b",marginBottom:6}}>{wi.judul}</div>
                                  <div style={{display:"flex",flexDirection:"column" as const,gap:5}}>
                                    {revs.map((r:any)=>(
                                      <div key={r.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,padding:"5px 8px",background:r.is_current?"#f0fdf4":"#f8fafc",borderRadius:6,border:"1px solid "+(r.is_current?"#bbf7d0":"#e2e8f0")}}>
                                        <div style={{minWidth:0}}>
                                          <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap" as const}}>
                                            <span style={{fontSize:9.5,fontWeight:700,color:r.is_current?"#16a34a":"#64748b",background:r.is_current?"#dcfce7":"#f1f5f9",borderRadius:20,padding:"1px 8px"}}>{r.is_current?"Berlaku":"Tidak Berlaku"}</span>
                                            {r.rev_mark&&<span style={{fontSize:10,color:"#94a3b8"}}>{r.rev_mark}</span>}
                                          </div>
                                          <div style={{fontSize:10,color:"#94a3b8",marginTop:2}}>oleh {r.uploaded_by} · {r.uploaded_at?new Date(r.uploaded_at).toLocaleDateString("id-ID"):"—"}</div>
                                        </div>
                                        <button onClick={()=>window.open(r.file_url,"_blank")}
                                          style={{background:"none",border:"none",fontSize:11,fontWeight:600,color:"#94a3b8",cursor:"pointer",whiteSpace:"nowrap" as const,padding:0}}>Lihat →</button>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {qcDetailPanel&&(()=>{
        const cl=qcDetailPanel.qc_checklist||{};
        const globalData=cl._global||{};
        const status=globalData.status||"to_do";
        const sb=QC_STATUS_LABEL[status]||QC_STATUS_LABEL.to_do;
        const fmtTgl=(iso:string)=>iso?new Date(iso).toLocaleDateString("id-ID",{day:"numeric",month:"short",year:"numeric"})+" "+new Date(iso).toLocaleTimeString("id-ID",{hour:"2-digit",minute:"2-digit"}):"";
        const wiringItems=komponenWiringPanel(qcDetailPanel);
        // BUG FIX (14 Agu 2026): section ini sebelumnya cuma nampilin pasang_komponen_photos
        // (galeri panel-wide) - foto per-komponen (checklist[kode].fotoPemasangan) gak pernah
        // ikut nongol di sini, padahal itu sumber foto utama sejak 8 Agu 2026. Digabung, pola
        // sama kayak totalFotoQualityCenter di atas yang sudah benar gabungin keduanya -
        // dedupe by url biar foto yang kebetulan ada di dua tempat gak dobel ditampilkan.
        const pasangKomponenFoto=(()=>{
          const seen=new Set<string>();
          const out:any[]=[];
          [...(qcDetailPanel.pasang_komponen_photos||[]),...Object.values(qcDetailPanel.checklist||{}).flatMap((c:any)=>c?.fotoPemasangan||[])].forEach((f:any)=>{
            if(f?.url&&!seen.has(f.url)){seen.add(f.url);out.push(f);}
          });
          return out;
        })();
        const pasangKomponenPct=(()=>{try{return calcPanelProgress(qcDetailPanel)["PASANG KOMPONEN"]||0;}catch{return 0;}})();

        const sectionCard=(label:string,icon:string,pct:number|null,fotoList:any[])=>(
          <div key={label} style={{border:"1px solid #e2e8f0",borderRadius:8,padding:12}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
              <span style={{fontWeight:700,fontSize:12,color:"#1e293b"}}>{icon} {label}</span>
              {pct!==null&&<span style={{fontWeight:800,fontSize:12,color:"#1d4ed8"}}>{pct}%</span>}
            </div>
            {fotoList.length>0?(
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(80px,1fr))",gap:6}}>
                {fotoList.map((f:any,fi:number)=>{
                  const fVideo=isVideoFoto(f)
                  const fGeneric=isGenericFoto(f)
                  return(
                    <div key={fi} onClick={()=>{if(fGeneric)window.open(f.url,"_blank");else setLightbox({fotos:fotoList,index:fi,label})}}
                      style={{position:"relative" as const,width:"100%",aspectRatio:"1",objectFit:"cover" as const,borderRadius:6,border:"1px solid #e2e8f0",cursor:"pointer",overflow:"hidden",background:"#f1f5f9",display:fGeneric?"flex":undefined,alignItems:fGeneric?"center" as const:undefined,justifyContent:fGeneric?"center" as const:undefined}}>
                      {fVideo?(
                        <><video src={f.url} muted style={{width:"100%",height:"100%",objectFit:"cover" as const}}/>
                        <i className="ti ti-player-play-filled" style={{position:"absolute" as const,top:"50%",left:"50%",transform:"translate(-50%,-50%)",fontSize:20,color:"#fff",filter:"drop-shadow(0 1px 3px rgba(0,0,0,0.5))"}}/></>
                      ):fGeneric?(
                        <i className="ti ti-file-text" style={{fontSize:22,color:"#64748b"}}/>
                      ):(
                        <img src={f.url} style={{width:"100%",height:"100%",objectFit:"cover" as const}}/>
                      )}
                    </div>
                  )
                })}
              </div>
            ):(
              <div style={{fontSize:11,color:"#cbd5e1",fontStyle:"italic" as const}}>Belum ada foto</div>
            )}
          </div>
        );

        return(
          <Modal title={"Detail Quality Center — "+qcDetailPanel.nama} onClose={()=>setQcDetailPanel(null)} width={620}>
            <div style={{fontSize:11,color:"#94a3b8",marginBottom:14}}>
              WO {qcDetailPanel.wo_number_snapshot} — {qcDetailPanel.proyek_snapshot}
            </div>
            <div style={{maxHeight:460,overflowY:"auto" as const,display:"flex",flexDirection:"column" as const,gap:14}}>

              {/* QC */}
              <div>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
                  <span style={{fontWeight:800,fontSize:13,color:"#1e293b"}}>🔍 QC</span>
                  <span style={{background:sb.bg,color:sb.color,borderRadius:20,padding:"2px 10px",fontSize:10,fontWeight:700}}>{sb.label}</span>
                </div>
                {(globalData.todo_at||globalData.complete_at||globalData.updated_by)&&(
                  <div style={{display:"flex",gap:14,fontSize:10,color:"#64748b",marginBottom:8,flexWrap:"wrap" as const}}>
                    {globalData.todo_at&&<span>To Do: {fmtTgl(globalData.todo_at)}</span>}
                    {globalData.complete_at&&<span>Selesai: {fmtTgl(globalData.complete_at)}</span>}
                    {globalData.updated_by&&<span>oleh {globalData.updated_by}</span>}
                  </div>
                )}
                <div style={{display:"flex",flexDirection:"column" as const,gap:8}}>
                  {QC_ITEMS_ARSIP.map(item=>{
                    const data=cl[item.key]||{};
                    const fotoList=data.foto||[];
                    return(
                      <div key={item.key} style={{border:"1px solid #e2e8f0",borderRadius:8,padding:10}}>
                        <div style={{fontWeight:700,fontSize:11,color:"#1e293b",marginBottom:6}}>{item.label}</div>
                        {data.catatan&&(
                          <div style={{fontSize:11,color:"#475569",background:"#f8fafc",borderRadius:6,padding:"6px 9px",marginBottom:8}}>{data.catatan}</div>
                        )}
                        {fotoList.length>0?(
                          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(80px,1fr))",gap:6}}>
                            {fotoList.map((f:any,fi:number)=>{
                              const fVideo=isVideoFoto(f)
                              const fGeneric=isGenericFoto(f)
                              return(
                                <div key={fi} onClick={()=>{if(fGeneric)window.open(f.url,"_blank");else setLightbox({fotos:fotoList,index:fi,label:item.label})}}
                                  style={{position:"relative" as const,width:"100%",aspectRatio:"1",objectFit:"cover" as const,borderRadius:6,border:"1px solid #e2e8f0",cursor:"pointer",overflow:"hidden",background:"#f1f5f9",display:fGeneric?"flex":undefined,alignItems:fGeneric?"center" as const:undefined,justifyContent:fGeneric?"center" as const:undefined}}>
                                  {fVideo?(
                                    <><video src={f.url} muted style={{width:"100%",height:"100%",objectFit:"cover" as const}}/>
                                    <i className="ti ti-player-play-filled" style={{position:"absolute" as const,top:"50%",left:"50%",transform:"translate(-50%,-50%)",fontSize:20,color:"#fff",filter:"drop-shadow(0 1px 3px rgba(0,0,0,0.5))"}}/></>
                                  ):fGeneric?(
                                    <i className="ti ti-file-text" style={{fontSize:22,color:"#64748b"}}/>
                                  ):(
                                    <img src={f.url} style={{width:"100%",height:"100%",objectFit:"cover" as const}}/>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        ):(
                          <div style={{fontSize:11,color:"#cbd5e1",fontStyle:"italic" as const}}>Belum ada foto</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Nameplate / Yellowmark / Warehouse / QS - bentuk sama (progress + foto flat) */}
              {QC_CENTER_SECTIONS_FLAT.map(s=>
                sectionCard(s.label,s.icon,qcDetailPanel[s.progressField]??0,qcDetailPanel[s.fotoField]||[])
              )}

              {/* Assembling (Pasang Komponen) */}
              {sectionCard("Assembling (Pasang Komponen)","🔧",pasangKomponenPct,pasangKomponenFoto)}

              {/* Wiring Control - per komponen (Box Control/Pintu) */}
              <div>
                <div style={{fontWeight:800,fontSize:13,color:"#1e293b",marginBottom:8}}>🔌 Wiring Control</div>
                {wiringItems.length===0?(
                  <div style={{fontSize:11,color:"#cbd5e1",fontStyle:"italic" as const}}>Tidak ada komponen Box Control/Pintu di panel ini</div>
                ):(
                  <div style={{display:"flex",flexDirection:"column" as const,gap:8}}>
                    {wiringItems.map((it:any)=>sectionCard(it.nama+" ("+it.kode+")","",it.pct,it.foto))}
                  </div>
                )}
              </div>

            </div>
          </Modal>
        );
      })()}

      {lightbox&&<FotoZoomViewer fotos={lightbox.fotos} startIndex={lightbox.index} label={lightbox.label} onClose={()=>setLightbox(null)}/>}
    </div>
  );
}
