import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { activityLogService } from '../services/activityLogService'
import { calcPanelProgress, getEffCfgGlobal } from '../lib/panelHelpers'
import { Modal } from './ui/Primitives'
import { FotoZoomViewer } from './FotoZoomViewer'

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
  const[subTab,setSubTab]=useState<'panel'|'seksi'>('panel');
  const[panelList,setPanelList]=useState<any[]>([]);
  const[loading,setLoading]=useState(true);
  const[search,setSearch]=useState("");
  const[unarsipLoadingId,setUnarsipLoadingId]=useState<number|null>(null);
  const[expandedWo,setExpandedWo]=useState<Record<number,boolean>>({});
  const[woArchivedMap,setWoArchivedMap]=useState<Record<number,boolean>>({});
  const[qcDetailPanel,setQcDetailPanel]=useState<any>(null);
  const[lightbox,setLightbox]=useState<{fotos:any[],index:number,label:string}|null>(null);

  const fetchPanelArsip=async()=>{
    setLoading(true);
    const{data}=await supabase.from("panels_archived").select("*").order("diarsipkan_pada",{ascending:false});
    setPanelList(data??[]);
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
          <p style={{fontSize:12,color:"#64748b",margin:"4px 0 0"}}>
            {subTab==='panel'?"WO yang punya panel diarsipkan - klik untuk lihat rincian panelnya":"Arsip otomatis per-seksi (Warehouse/QS/QC/Pasang Komponen) - salinan read-only, data live di panel TIDAK dihapus"}
          </p>
        </div>
        {subTab==='panel'&&(
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Cari WO/proyek/panel..."
            style={{height:32,padding:"0 12px",border:"1px solid #e2e8f0",borderRadius:8,fontSize:12,width:240,outline:"none",fontFamily:"inherit"}}/>
        )}
      </div>

      <div style={{display:"flex",gap:6,marginBottom:16,background:"#f1f5f9",borderRadius:10,padding:4,width:"fit-content"}}>
        <button onClick={()=>setSubTab('panel')}
          style={{padding:"7px 16px",borderRadius:8,border:"none",fontSize:12,fontWeight:700,cursor:"pointer",
            background:subTab==='panel'?"#fff":"transparent",color:subTab==='panel'?"#1e293b":"#64748b",
            boxShadow:subTab==='panel'?"0 1px 3px #00000015":"none"}}>
          📦 Arsip Panel
        </button>
        <button onClick={()=>setSubTab('seksi')}
          style={{padding:"7px 16px",borderRadius:8,border:"none",fontSize:12,fontWeight:700,cursor:"pointer",
            background:subTab==='seksi'?"#fff":"transparent",color:subTab==='seksi'?"#1e293b":"#64748b",
            boxShadow:subTab==='seksi'?"0 1px 3px #00000015":"none"}}>
          🗂️ Arsip Seksi
        </button>
      </div>

      {subTab==='seksi'?(
        <ArsipSeksiSection user={user}/>
      ):(
      <>
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
                  <div style={{flex:1,minWidth:0}}>
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
                        <th style={{...thS,textAlign:"center"}}>Aksi</th>
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
                              <td style={{...td,textAlign:"center"}}>
                                <button onClick={()=>unarsipkan(p)} disabled={unarsipLoadingId===p.id}
                                  style={{padding:"5px 12px",borderRadius:7,border:"1px solid #bbf7d0",background:"#f0fdf4",color:"#16a34a",cursor:"pointer",fontSize:11,fontWeight:700}}>
                                  {unarsipLoadingId===p.id?"⏳...":"↩ Unarchive"}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
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
        const pasangKomponenFoto=qcDetailPanel.pasang_komponen_photos||[];
        const pasangKomponenPct=(()=>{try{return calcPanelProgress(qcDetailPanel)["PASANG KOMPONEN"]||0;}catch{return 0;}})();

        const sectionCard=(label:string,icon:string,pct:number|null,fotoList:any[])=>(
          <div key={label} style={{border:"1px solid #e2e8f0",borderRadius:8,padding:12}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
              <span style={{fontWeight:700,fontSize:12,color:"#1e293b"}}>{icon} {label}</span>
              {pct!==null&&<span style={{fontWeight:800,fontSize:12,color:"#1d4ed8"}}>{pct}%</span>}
            </div>
            {fotoList.length>0?(
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(80px,1fr))",gap:6}}>
                {fotoList.map((f:any,fi:number)=>(
                  <img key={fi} src={f.url} onClick={()=>setLightbox({fotos:fotoList,index:fi,label})}
                    style={{width:"100%",aspectRatio:"1",objectFit:"cover" as const,borderRadius:6,border:"1px solid #e2e8f0",cursor:"pointer"}}/>
                ))}
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
                            {fotoList.map((f:any,fi:number)=>(
                              <img key={fi} src={f.url} onClick={()=>setLightbox({fotos:fotoList,index:fi,label:item.label})}
                                style={{width:"100%",aspectRatio:"1",objectFit:"cover" as const,borderRadius:6,border:"1px solid #e2e8f0",cursor:"pointer"}}/>
                            ))}
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
      </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Arsip Seksi - Warehouse/QS/QC/Pasang Komponen. Beda dari Arsip Panel di atas: ini SALINAN
// (bukan pemindahan) yang diisi OTOMATIS oleh trigger DB panels_auto_archive_seksi() begitu
// progress seksi itu 100% - data live di panels TIDAK dihapus/disentuh (lihat komentar di
// migrasi panel_seksi_archived). "Unarchive" di sini murni hapus baris arsip (koreksi status
// "selesai" yang keliru) - TIDAK ada apapun yang perlu direstore karena data aslinya memang
// gak pernah hilang dari panels.
// panel_id/wo_id di panel_seksi_archived SENGAJA tanpa FK - baris arsip di sini TETAP ada
// walau WO/panel sumbernya sudah dihapus dari Manajemen WO (makanya render pakai kolom
// snapshot - wo_number_snapshot/proyek_snapshot/panel_nama - bukan join ke work_orders/panels).
const SEKSI_LABEL:Record<string,{label:string,icon:string,color:string}>={
  warehouse:{label:"Warehouse",icon:"📦",color:"#0d9488"},
  qs:{label:"QS",icon:"📋",color:"#7c3aed"},
  qc:{label:"QC",icon:"🔍",color:"#16a34a"},
  pasang_komponen:{label:"Pasang Komponen",icon:"🔧",color:"#f97316"},
};

function ArsipSeksiSection({user}:any){
  const[rows,setRows]=useState<any[]>([]);
  const[loading,setLoading]=useState(true);
  const[search,setSearch]=useState("");
  const[filterSeksi,setFilterSeksi]=useState<string>("ALL");
  const[expandedWo,setExpandedWo]=useState<Record<string,boolean>>({});
  const[unarsipLoadingId,setUnarsipLoadingId]=useState<number|null>(null);
  const[lightbox,setLightbox]=useState<{fotos:any[],index:number,label:string}|null>(null);

  const fetchRows=async()=>{
    setLoading(true);
    const{data}=await supabase.from("panel_seksi_archived").select("*").order("diarsipkan_pada",{ascending:false});
    setRows(data??[]);
    setLoading(false);
  };
  useEffect(()=>{fetchRows();},[]);

  const unarsipkan=async(row:any)=>{
    if(!confirm(`Hapus arsip "${SEKSI_LABEL[row.seksi]?.label}" untuk panel "${row.panel_nama}" dari daftar arsip?\n\nIni CUMA menghapus catatan arsipnya - data aslinya di panel (progress/foto) TIDAK berubah/hilang, karena arsip ini cuma salinan. Kalau progress-nya memang keliru ke-set 100%, koreksi lewat halaman biasa (Manajemen WO / Vista Pekerja) setelah ini.`))return;
    setUnarsipLoadingId(row.id);
    const{error}=await supabase.from("panel_seksi_archived").delete().eq("id",row.id);
    setUnarsipLoadingId(null);
    if(error){alert("Gagal hapus arsip: "+error.message);return;}
    const sess=JSON.parse(localStorage.getItem("vista_admin_session")||"{}");
    const uname=user?.name||user?.nama||sess?.nama||"Admin";
    await activityLogService.insert({
      user_name:uname,action:"UNARCHIVE SEKSI",
      description:`Hapus arsip ${SEKSI_LABEL[row.seksi]?.label} panel ${row.panel_nama}${row.kode?` (${row.komponen_nama||row.kode})`:""} - WO ${row.wo_number_snapshot||""} - ${row.proyek_snapshot||""}`,
      module:"wo",halaman:"Arsip",proyek:row.proyek_snapshot||"",panel:row.panel_nama||"",wo_number:row.wo_number_snapshot||"",
    });
    setRows(prev=>prev.filter((r:any)=>r.id!==row.id));
  };

  const filtered=rows.filter(r=>
    (filterSeksi==="ALL"||r.seksi===filterSeksi)&&
    (!search||r.panel_nama?.toLowerCase().includes(search.toLowerCase())||r.proyek_snapshot?.toLowerCase().includes(search.toLowerCase())||r.wo_number_snapshot?.toLowerCase().includes(search.toLowerCase()))
  );

  const grouped=useMemo(()=>{
    const map:Record<string,{key:string,wo_number:string,proyek:string,rows:any[]}>={};
    filtered.forEach((r:any)=>{
      const key=String(r.wo_id ?? `noWo_${r.panel_nama}`);
      if(!map[key])map[key]={key,wo_number:r.wo_number_snapshot,proyek:r.proyek_snapshot,rows:[]};
      map[key].rows.push(r);
    });
    return Object.values(map).sort((a,b)=>{
      const latestA=Math.max(...a.rows.map(r=>new Date(r.diarsipkan_pada).getTime()));
      const latestB=Math.max(...b.rows.map(r=>new Date(r.diarsipkan_pada).getTime()));
      return latestB-latestA;
    });
  },[filtered]);

  const fmtTgl=(iso:string)=>iso?new Date(iso).toLocaleDateString("id-ID",{day:"numeric",month:"short",year:"numeric"})+" "+new Date(iso).toLocaleTimeString("id-ID",{hour:"2-digit",minute:"2-digit"}):"—";
  const fotoListOf=(row:any):any[]=>{
    if(row.seksi==="pasang_komponen")return row.data?.fotoPemasangan||[];
    if(row.seksi==="qc"){
      let total:any[]=[];
      ["fisik","spesifikasi","baut","test"].forEach(k=>{total=total.concat(row.data?.[k]?.foto||[]);});
      return total;
    }
    return row.data?.photos||[];
  };

  const thS:any={padding:"8px 12px",textAlign:"left",fontSize:10,color:"#64748b",fontWeight:700,background:"#f8fafc"};
  const td:any={padding:"9px 12px",borderTop:"1px solid #f1f5f9",fontSize:12,verticalAlign:"middle"};

  return(
    <div>
      <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap" as const,alignItems:"center"}}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Cari WO/proyek/panel..."
          style={{height:32,padding:"0 12px",border:"1px solid #e2e8f0",borderRadius:8,fontSize:12,width:240,outline:"none",fontFamily:"inherit"}}/>
        <select value={filterSeksi} onChange={e=>setFilterSeksi(e.target.value)}
          style={{height:32,padding:"0 10px",border:"1px solid #e2e8f0",borderRadius:8,fontSize:12,background:"#fff",fontFamily:"inherit"}}>
          <option value="ALL">Semua Seksi</option>
          {Object.entries(SEKSI_LABEL).map(([k,v])=><option key={k} value={k}>{v.icon} {v.label}</option>)}
        </select>
      </div>

      {loading?(
        <div style={{textAlign:"center",padding:48,color:"#94a3b8"}}>Memuat arsip...</div>
      ):grouped.length===0?(
        <div style={{textAlign:"center",padding:48,color:"#94a3b8",background:"#fff",borderRadius:10,border:"1px solid #e2e8f0"}}>
          <i className="ti ti-archive-off" style={{fontSize:32,display:"block",marginBottom:8}}/>
          Belum ada seksi yang diarsipkan
        </div>
      ):(
        <div style={{display:"flex",flexDirection:"column" as const,gap:8}}>
          {grouped.map(g=>{
            const isExp=!!expandedWo[g.key];
            return(
              <div key={g.key} style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:10,overflow:"hidden"}}>
                <div onClick={()=>setExpandedWo(prev=>({...prev,[g.key]:!prev[g.key]}))}
                  style={{display:"flex",alignItems:"center",gap:10,padding:"12px 16px",cursor:"pointer",background:isExp?"#f8faff":"#fff"}}>
                  <span style={{fontSize:12,color:"#94a3b8"}}>{isExp?"▼":"▶"}</span>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:700,fontSize:13,color:"#1e293b"}}>WO {g.wo_number||"—"} — {g.proyek||"—"}</div>
                    <div style={{fontSize:11,color:"#64748b",marginTop:2}}>{g.rows.length} seksi diarsipkan</div>
                  </div>
                </div>
                {isExp&&(
                  <div style={{overflowX:"auto",borderTop:"1px solid #e2e8f0"}}>
                    <table style={{width:"100%",borderCollapse:"collapse"}}>
                      <thead><tr>
                        <th style={thS}>Panel</th>
                        <th style={thS}>Seksi</th>
                        <th style={{...thS,textAlign:"center"}}>Foto</th>
                        <th style={thS}>Diarsipkan</th>
                        <th style={{...thS,textAlign:"center"}}>Aksi</th>
                      </tr></thead>
                      <tbody>
                        {g.rows.map((r:any,i:number)=>{
                          const si=SEKSI_LABEL[r.seksi]||{label:r.seksi,icon:"📄",color:"#64748b"};
                          const fotoList=fotoListOf(r);
                          return(
                            <tr key={r.id} style={{background:i%2===0?"#fff":"#f8fafc"}}>
                              <td style={{...td,fontWeight:700,color:"#1e293b"}}>{r.panel_nama}</td>
                              <td style={{...td}}>
                                <span style={{background:si.color+"18",color:si.color,borderRadius:20,padding:"2px 9px",fontSize:10,fontWeight:700}}>
                                  {si.icon} {si.label}{r.kode?` — ${r.komponen_nama||r.kode}`:""}
                                </span>
                              </td>
                              <td style={{...td,textAlign:"center"}}>
                                {fotoList.length>0?(
                                  <button onClick={()=>setLightbox({fotos:fotoList,index:0,label:`${si.label} - ${r.panel_nama}`})}
                                    style={{background:"none",border:"none",cursor:"pointer",color:"#1d4ed8",fontSize:11,textDecoration:"underline"}}>
                                    📷 {fotoList.length} foto
                                  </button>
                                ):(
                                  <span style={{fontSize:11,color:"#cbd5e1"}}>—</span>
                                )}
                              </td>
                              <td style={{...td,color:"#94a3b8",fontSize:11}}>{r.diarsipkan_oleh||"—"} · {fmtTgl(r.diarsipkan_pada)}</td>
                              <td style={{...td,textAlign:"center"}}>
                                <button onClick={()=>unarsipkan(r)} disabled={unarsipLoadingId===r.id}
                                  style={{padding:"5px 12px",borderRadius:7,border:"1px solid #bbf7d0",background:"#f0fdf4",color:"#16a34a",cursor:"pointer",fontSize:11,fontWeight:700}}>
                                  {unarsipLoadingId===r.id?"⏳...":"↩ Unarchive"}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {lightbox&&<FotoZoomViewer fotos={lightbox.fotos} startIndex={lightbox.index} label={lightbox.label} onClose={()=>setLightbox(null)}/>}
    </div>
  );
}
