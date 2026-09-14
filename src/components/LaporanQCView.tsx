import { useState, useMemo } from 'react'
import { downloadFotoSebagaiZip, sanitizeNamaFile, type FotoZipItem } from '../lib/downloadHelpers'
import { FotoZoomViewer } from './FotoZoomViewer'
import { isVideoFoto, isGenericFoto } from '../lib/mediaThumb'
import { panelOverall } from '../lib/panelHelpers'

const QC_ITEMS_LAPORAN=[
  {key:"fisik",label:"Pemeriksaan Fisik"},
  {key:"spesifikasi",label:"Verifikasi Spesifikasi Komponen"},
  {key:"baut",label:"Pengecekan Kekencangan Baut"},
  {key:"test",label:"QC Test"},
];

const QC_STATUS_LIST=[
  {key:"to_do",label:"To Do",color:"#64748b",bg:"#f1f5f9",icon:"ti ti-circle-dashed"},
  {key:"in_progress",label:"In Progress",color:"#ea580c",bg:"#fff7ed",icon:"ti ti-loader-2"},
  {key:"complete",label:"Complete",color:"#16a34a",bg:"#f0fdf4",icon:"ti ti-circle-check"},
];

// Redesign list utama (14 Sep 2026, ikut gaya referensi "banner+4 kartu+tabel") - status QC
// sendiri cuma 3-state (to_do/in_progress/complete, lihat QC_STATUS_LIST di atas - TETAP dipakai
// apa adanya di layar DETAIL panel, gak disentuh). Buat 4 kartu ringkasan NOT YET/TO DO/IN
// PROGRESS/DONE yang diminta (vokab sama kayak status pipeline Renhar/Task Monitoring), "to_do"
// dipecah jadi 2: NOT YET (progres produksi panel itu SENDIRI masih 0% - QC memang belum relevan
// dikerjakan) vs TO DO beneran (produksi udah mulai, siap diperiksa QC tapi belum disentuh) -
// gak ada kolom siap pakai buat ini di qc_checklist, jadi dipakai panelOverall() (progres rata-
// rata proses lain di panel itu) sebagai gate, pola SAMA PERSIS gateField di TUGAS_QS_LAPORAN
// (TrackingView.tsx) yang juga nge-gate readiness dari progres tahap sebelumnya.
const STATUS4_LIST=[
  {key:"NOT_YET",label:"Not Yet",color:"#64748b",bg:"#f1f5f9",icon:"ti ti-circle-dashed",desc:"Produksi panel belum mulai"},
  {key:"TO_DO",label:"To Do",color:"#2563eb",bg:"#eff6ff",icon:"ti ti-list-check",desc:"Siap diperiksa, belum disentuh"},
  {key:"IN_PROGRESS",label:"In Progress",color:"#ea580c",bg:"#fff7ed",icon:"ti ti-loader-2",desc:"Sedang diperiksa QC"},
  {key:"DONE",label:"Done",color:"#16a34a",bg:"#f0fdf4",icon:"ti ti-circle-check",desc:"Pemeriksaan QC selesai"},
] as const;

export function LaporanQCView({woData}:{woData:any[]}){
  const[search,setSearch]=useState("");
  const[selectedPanelId,setSelectedPanelId]=useState<number|null>(null);
  const[lightbox,setLightbox]=useState<any>(null);
  // status4Filter/woFilterId (14 Sep 2026, redesign tabel) - gantiin subTab(outstanding/finished)
  // + selectedWoId(folder-drill) versi lama. Fungsi filter+grouping-nya TETAP ada, cuma bentuknya
  // sekarang dropdown di atas tabel flat, bukan 2 tombol besar + klik folder buat masuk grid.
  const[status4Filter,setStatus4Filter]=useState<string>("ALL");
  const[woFilterId,setWoFilterId]=useState<number|"ALL">("ALL");
  const[zipBusy,setZipBusy]=useState<{key:string,done:number,total:number}|null>(null);

  const fotoQcPanel=(panel:any):FotoZipItem[]=>{
    const cl=panel.qc_checklist||{};
    const items:FotoZipItem[]=[];
    QC_ITEMS_LAPORAN.forEach(item=>{
      const fotoList=cl[item.key]?.foto||[];
      fotoList.forEach((f:any,fi:number)=>{
        items.push({url:f.url,path:`${sanitizeNamaFile(item.label)}/${fi+1}_${sanitizeNamaFile(f.name||"foto.jpg")}`});
      });
    });
    return items;
  };

  const downloadZipPanel=async(panel:any)=>{
    const items=fotoQcPanel(panel);
    if(items.length===0){alert("Belum ada foto untuk panel ini");return;}
    const key=`panel_${panel.id}`;
    setZipBusy({key,done:0,total:items.length});
    const{gagal}=await downloadFotoSebagaiZip(items,`QC_${sanitizeNamaFile(panel.nama)}.zip`,(done,total)=>setZipBusy({key,done,total}));
    setZipBusy(null);
    if(gagal>0)alert(`${gagal} foto gagal diunduh, sisanya berhasil masuk ZIP`);
  };

  const downloadZipProyek=async(folder:{woId:number,wo:any,panels:any[]})=>{
    const items:FotoZipItem[]=[];
    folder.panels.forEach((p:any)=>{
      fotoQcPanel(p).forEach(it=>items.push({...it,path:`${sanitizeNamaFile(p.nama)}/${it.path}`}));
    });
    if(items.length===0){alert("Belum ada foto untuk proyek ini");return;}
    const key=`wo_${folder.woId}`;
    setZipBusy({key,done:0,total:items.length});
    const{gagal}=await downloadFotoSebagaiZip(items,`QC_${sanitizeNamaFile(folder.wo?.proyek||folder.wo?.wo||"proyek")}.zip`,(done,total)=>setZipBusy({key,done,total}));
    setZipBusy(null);
    if(gagal>0)alert(`${gagal} foto gagal diunduh, sisanya berhasil masuk ZIP`);
  };

  const allPanels=useMemo(()=>{
    const list:any[]=[];
    (woData||[]).forEach((w:any)=>{
      (w.panels||[]).forEach((p:any)=>{
        list.push({...p,_wo:w});
      });
    });
    return list;
  },[woData]);

  const getQcStatus=(panel:any)=>{
    return panel.qc_checklist?._global?.status||"to_do";
  };
  // 4-state (lihat komentar STATUS4_LIST) - "to_do" mentah dipecah NOT_YET/TO_DO pakai
  // panelOverall() sbg gate. in_progress/complete cuma diganti nama key (IN_PROGRESS/DONE).
  const getQcStatus4=(panel:any):string=>{
    const raw=getQcStatus(panel);
    if(raw==="complete")return"DONE";
    if(raw==="in_progress")return"IN_PROGRESS";
    return panelOverall(panel)>0?"TO_DO":"NOT_YET";
  };
  // Progress checklist QC (14 Sep 2026) - qc_checklist gak punya field persen siap pakai, jadi
  // dipakai fraksi item QC_ITEMS_LAPORAN (4 item: fisik/spesifikasi/baut/test) yang udah punya
  // MINIMAL 1 foto - angka nyata dari data yang sudah ada, bukan dikarang.
  const qcProgress=(panel:any)=>{
    const cl=panel.qc_checklist||{};
    const done=QC_ITEMS_LAPORAN.filter(item=>(cl[item.key]?.foto||[]).length>0).length;
    return{done,total:QC_ITEMS_LAPORAN.length,pct:Math.round(done/QC_ITEMS_LAPORAN.length*100)};
  };

  const withStatus=allPanels.map((p:any)=>({...p,_qcStatus:getQcStatus(p),_qcStatus4:getQcStatus4(p)}));

  const woOptions=useMemo(()=>{
    const map:Record<number,any>={};
    withStatus.forEach((p:any)=>{if(p.wo_id&&!map[p.wo_id])map[p.wo_id]=p._wo;});
    return Object.entries(map).map(([id,wo]:any)=>({id:Number(id),wo})).sort((a,b)=>(a.wo?.wo||"").localeCompare(b.wo?.wo||""));
  },[withStatus]);

  const filtered=withStatus.filter((p:any)=>{
    const matchSearch=!search||p.nama?.toLowerCase().includes(search.toLowerCase())||p._wo?.wo?.toLowerCase().includes(search.toLowerCase())||p._wo?.proyek?.toLowerCase().includes(search.toLowerCase());
    const matchStatus=status4Filter==="ALL"||p._qcStatus4===status4Filter;
    const matchWo=woFilterId==="ALL"||p.wo_id===woFilterId;
    return matchSearch&&matchStatus&&matchWo;
  });

  // Folder per-WO (dipakai tombol "Download Semua Foto Proyek (ZIP)" - fungsi lama tetap ada,
  // muncul begitu 1 WO spesifik dipilih di dropdown, gak perlu lagi drill masuk folder terpisah).
  const activeWoFolder=woFilterId!=="ALL"?{woId:woFilterId,wo:woOptions.find(w=>w.id===woFilterId)?.wo,panels:filtered}:null;

  const selectedPanel=allPanels.find((p:any)=>p.id===selectedPanelId);

  const fmtTgl=(iso:string)=>{
    if(!iso)return"";
    const d=new Date(iso);
    return d.toLocaleDateString("id-ID",{day:"numeric",month:"short",year:"numeric"})+" "+d.toLocaleTimeString("id-ID",{hour:"2-digit",minute:"2-digit"});
  };

  const statusBadgeStyle=(status:string)=>{
    if(status==="complete")return{bg:"#f0fdf4",color:"#16a34a",label:"Selesai"};
    if(status==="in_progress")return{bg:"#fff7ed",color:"#ea580c",label:"Sedang Dikerjakan"};
    return{bg:"#f1f5f9",color:"#64748b",label:"To Do"};
  };

  if(selectedPanel){
    const cl=selectedPanel.qc_checklist||{};
    const globalData=selectedPanel.qc_checklist?._global||{};
    const status=getQcStatus(selectedPanel);
    const sb=statusBadgeStyle(status);
    return(
      <div className="fi">
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}} className="no-print">
          <button onClick={()=>setSelectedPanelId(null)}
            style={{height:32,padding:"0 14px",borderRadius:7,border:"1px solid #e2e8f0",background:"#fff",color:"#475569",fontSize:12,fontWeight:600,cursor:"pointer"}}>
            Kembali
          </button>
          <button onClick={()=>window.print()}
            style={{height:32,padding:"0 14px",borderRadius:7,border:"none",background:"#1d4ed8",color:"#fff",fontSize:12,fontWeight:600,cursor:"pointer"}}>
            Print Laporan
          </button>
          <button onClick={()=>downloadZipPanel(selectedPanel)} disabled={zipBusy?.key===`panel_${selectedPanel.id}`}
            style={{height:32,padding:"0 14px",borderRadius:7,border:"1px solid #16a34a",background:"#fff",color:"#16a34a",fontSize:12,fontWeight:600,
              cursor:zipBusy?.key===`panel_${selectedPanel.id}`?"not-allowed":"pointer"}}>
            {zipBusy?.key===`panel_${selectedPanel.id}`?`⏳ ${zipBusy.done}/${zipBusy.total}...`:"⬇️ Download Semua Foto (ZIP)"}
          </button>
        </div>

        <div style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:10,padding:20,marginBottom:16}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
            <div>
              <div style={{fontSize:11,color:"#94a3b8"}}>{selectedPanel._wo?.proyek} - {selectedPanel._wo?.wo}</div>
              <div style={{fontSize:18,fontWeight:800,color:"#1e293b"}}>{selectedPanel.nama}</div>
              <div style={{fontSize:11,color:"#94a3b8"}}>Tipe: {selectedPanel.tipe}</div>
            </div>
            <span style={{background:sb.bg,color:sb.color,borderRadius:20,padding:"4px 14px",fontSize:12,fontWeight:700}}>
              {sb.label}
            </span>
          </div>
          <div style={{display:"flex",gap:16,fontSize:11,color:"#64748b"}}>
            {globalData.todo_at&&<span>To Do: {fmtTgl(globalData.todo_at)}</span>}
            {globalData.complete_at&&<span>Selesai: {fmtTgl(globalData.complete_at)}</span>}
            {globalData.updated_by&&<span>oleh {globalData.updated_by}</span>}
          </div>
        </div>

        {QC_ITEMS_LAPORAN.map(item=>{
          const data=cl[item.key]||{};
          const fotoList=data.foto||[];
          return(
            <div key={item.key} style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:10,padding:16,marginBottom:12}}>
              <div style={{marginBottom:8}}>
                <span style={{fontWeight:700,fontSize:14,color:"#1e293b"}}>{item.label}</span>
              </div>
              {data.catatan&&(
                <div style={{fontSize:12,color:"#475569",background:"#f8fafc",borderRadius:6,padding:"8px 10px",marginBottom:10}}>
                  {data.catatan}
                </div>
              )}
              {fotoList.length>0?(
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(120px,1fr))",gap:8}}>
                  {fotoList.map((f:any,fi:number)=>{
                    const fVideo=isVideoFoto(f)
                    const fGeneric=isGenericFoto(f)
                    return(
                      <div key={fi} onClick={()=>{if(fGeneric)window.open(f.url,"_blank");else setLightbox({fotos:fotoList,index:fi,label:item.label})}} style={{cursor:"pointer"}} className="qc-foto-print">
                        <div style={{position:"relative" as const,width:"100%",aspectRatio:"1",objectFit:"cover" as const,borderRadius:6,border:"1px solid #e2e8f0",overflow:"hidden",background:"#f1f5f9",display:fGeneric?"flex":undefined,alignItems:fGeneric?"center" as const:undefined,justifyContent:fGeneric?"center" as const:undefined}}>
                          {fVideo?(
                            <><video src={f.url} muted style={{width:"100%",height:"100%",objectFit:"cover" as const}}/>
                            <i className="ti ti-player-play-filled" style={{position:"absolute" as const,top:"50%",left:"50%",transform:"translate(-50%,-50%)",fontSize:20,color:"#fff",filter:"drop-shadow(0 1px 3px rgba(0,0,0,0.5))"}}/></>
                          ):fGeneric?(
                            <i className="ti ti-file-text" style={{fontSize:22,color:"#64748b"}}/>
                          ):(
                            <img src={f.url} style={{width:"100%",height:"100%",objectFit:"cover" as const}}/>
                          )}
                        </div>
                        <div style={{fontSize:9,color:"#94a3b8",marginTop:3}}>{fmtTgl(f.uploaded_at)}</div>
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

        {lightbox&&<FotoZoomViewer fotos={lightbox.fotos} startIndex={lightbox.index} label={lightbox.label} onClose={()=>setLightbox(null)}/>}

        <style>{`
          @media print {
            .no-print { display: none !important; }
          }
        `}</style>
      </div>
    );
  }

  const total4=withStatus.length;
  const count4=(key:string)=>withStatus.filter((p:any)=>p._qcStatus4===key).length;

  return(
    <div className="fi">
      {/* Banner header (14 Sep 2026, ikut gaya referensi) - warna tema biru yang sudah konsisten
          dipakai di modul lain (tombol Print/Setujui dsb pakai #1d4ed8/#2563eb) - gradient+pola
          lingkaran dekoratif sbg pengganti foto (gak ada asset foto yang cocok). */}
      <div style={{position:"relative" as const,overflow:"hidden",background:"linear-gradient(135deg,#eff6ff,#dbeafe)",border:"1px solid #bfdbfe",borderRadius:14,padding:"20px 24px",marginBottom:18,display:"flex",alignItems:"center",gap:16}}>
        <div style={{width:56,height:56,borderRadius:14,background:"#1d4ed8",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,boxShadow:"0 4px 12px #1d4ed84d",zIndex:1}}>
          <i className="ti ti-clipboard-check" style={{fontSize:28,color:"#fff"}}/>
        </div>
        <div style={{flex:1,minWidth:0,zIndex:1}}>
          <div style={{fontSize:19,fontWeight:800,color:"#1e293b"}}>Laporan QC</div>
          <div style={{fontSize:12.5,fontWeight:500,color:"#334155",marginTop:2}}>Pantau progres pemeriksaan kualitas (Quality Control) tiap panel - status, checklist, dan dokumentasi foto.</div>
        </div>
        <div style={{position:"absolute" as const,right:-24,top:-30,width:150,height:150,borderRadius:"50%",background:"#1d4ed81a"}}/>
        <div style={{position:"absolute" as const,right:60,bottom:-40,width:100,height:100,borderRadius:"50%",background:"#1d4ed812"}}/>
      </div>

      {/* 4 kartu status pipeline NOT YET/TO DO/IN PROGRESS/DONE (bukan Total/Selesai QC/dst
          kayak referensi asli) - vokab sama kayak status pipeline Renhar/Task Monitoring, sesuai
          permintaan. Klik toggle jadi filter tabel, sama kayak 2 tombol besar versi lama. */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:16}}>
        {STATUS4_LIST.map(s=>{
          const n=count4(s.key);
          const pct=total4>0?Math.round(n/total4*100):0;
          const active=status4Filter===s.key;
          return(
            <button key={s.key} onClick={()=>setStatus4Filter(active?"ALL":s.key)}
              style={{textAlign:"left" as const,background:s.bg,border:`1.5px solid ${active?s.color:"transparent"}`,borderRadius:12,
                padding:"14px 16px",cursor:"pointer",boxShadow:active?`0 0 0 3px ${s.color}33`:"0 1px 3px rgba(0,0,0,0.05)",transition:"all .15s"}}>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
                <div style={{width:34,height:34,borderRadius:9,background:"#fff",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                  <i className={s.icon} style={{fontSize:16,color:s.color}}/>
                </div>
                <div style={{fontSize:11,fontWeight:700,color:s.color,textTransform:"uppercase" as const,letterSpacing:.3}}>{s.label}</div>
              </div>
              <div style={{fontSize:24,fontWeight:800,color:"#1e293b"}}>{n}</div>
              <div style={{fontSize:11,fontWeight:600,color:"#475569",marginTop:2}}>{pct}% dari total - {s.desc}</div>
            </button>
          );
        })}
      </div>

      {/* Search + filter (fungsi lama TETAP semua: cari nama/WO/proyek, filter status, filter WO -
          cuma direstyle jadi dropdown, "folder klik" versi lama diganti dropdown WO + tombol ZIP
          proyek muncul otomatis begitu 1 WO dipilih). */}
      <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap" as const,alignItems:"center"}}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Cari panel, WO, atau proyek..."
          style={{height:36,padding:"0 12px",border:"1px solid #e2e8f0",borderRadius:8,fontSize:12.5,fontWeight:500,background:"#fff",outline:"none",color:"#1e293b",fontFamily:"inherit",flex:"1 1 220px",minWidth:180}}/>
        <select value={woFilterId==="ALL"?"ALL":String(woFilterId)} onChange={e=>setWoFilterId(e.target.value==="ALL"?"ALL":Number(e.target.value))}
          style={{height:36,padding:"0 10px",border:"1px solid #e2e8f0",borderRadius:8,fontSize:12.5,fontWeight:600,background:"#fff",color:"#1e293b",fontFamily:"inherit",cursor:"pointer"}}>
          <option value="ALL">Semua WO</option>
          {woOptions.map(w=><option key={w.id} value={w.id}>WO {w.wo?.wo} - {w.wo?.proyek}</option>)}
        </select>
        <select value={status4Filter} onChange={e=>setStatus4Filter(e.target.value)}
          style={{height:36,padding:"0 10px",border:"1px solid #e2e8f0",borderRadius:8,fontSize:12.5,fontWeight:600,background:"#fff",color:"#1e293b",fontFamily:"inherit",cursor:"pointer"}}>
          <option value="ALL">Semua Status</option>
          {STATUS4_LIST.map(s=><option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
        {activeWoFolder&&(
          <button onClick={()=>downloadZipProyek(activeWoFolder)} disabled={zipBusy?.key===`wo_${activeWoFolder.woId}`}
            style={{height:36,padding:"0 14px",borderRadius:8,border:"1px solid #16a34a",background:"#fff",color:"#16a34a",fontSize:12,fontWeight:600,
              cursor:zipBusy?.key===`wo_${activeWoFolder.woId}`?"not-allowed":"pointer",whiteSpace:"nowrap" as const}}>
            {zipBusy?.key===`wo_${activeWoFolder.woId}`?`⏳ ${zipBusy.done}/${zipBusy.total}...`:"⬇️ ZIP Foto WO Ini"}
          </button>
        )}
      </div>

      {/* Tabel (14 Sep 2026, ganti dari folder+grid ke tabel flat sesuai referensi) - data SAMA
          persis (filtered, hasil search+filter status+filter WO di atas), cuma tampilannya. */}
      {filtered.length===0?(
        <div style={{textAlign:"center",padding:50,color:"#94a3b8",background:"#fff",borderRadius:12,border:"1px solid #e2e8f0"}}>
          <i className="ti ti-clipboard-x" style={{fontSize:36,display:"block",marginBottom:10}}/>
          Tidak ada panel ditemukan
        </div>
      ):(
        <div style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:12,overflowX:"auto" as const}}>
          <table style={{width:"100%",borderCollapse:"collapse" as const,minWidth:760}}>
            <thead>
              <tr style={{background:"#f8fafc",borderBottom:"1.5px solid #e2e8f0"}}>
                {["No","WO / Panel","Proses","Status","Progress","Tanggal","Aksi"].map((h,i)=>(
                  <th key={h} style={{padding:"10px 14px",textAlign:i===0?"center" as const:"left" as const,fontSize:11,fontWeight:800,color:"#475569",textTransform:"uppercase" as const,letterSpacing:.4,whiteSpace:"nowrap" as const}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((p:any,i:number)=>{
                const statusDef=STATUS4_LIST.find(s=>s.key===p._qcStatus4)||STATUS4_LIST[0];
                const prog=qcProgress(p);
                const globalData=p.qc_checklist?._global||{};
                const tgl=globalData.complete_at||globalData.todo_at;
                return(
                  <tr key={p.id} style={{borderBottom:i<filtered.length-1?"1px solid #f1f5f9":"none"}}>
                    <td style={{padding:"10px 14px",textAlign:"center" as const,fontSize:12,color:"#64748b",fontWeight:700}}>{i+1}</td>
                    <td style={{padding:"10px 14px"}}>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <i className="ti ti-folder" style={{fontSize:16,color:"#94a3b8",flexShrink:0}}/>
                        <div style={{minWidth:0}}>
                          <div style={{fontSize:13,fontWeight:700,color:"#1e293b",whiteSpace:"nowrap" as const}}>{p.nama}</div>
                          <div style={{fontSize:11,fontWeight:600,color:"#64748b"}}>WO {p._wo?.wo} - {p._wo?.proyek}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{padding:"10px 14px"}}>
                      <div style={{display:"flex",alignItems:"center",gap:6,fontSize:12,color:"#475569",fontWeight:600}}>
                        <i className="ti ti-clipboard-check" style={{fontSize:14,color:"#1d4ed8"}}/> QC
                      </div>
                    </td>
                    <td style={{padding:"10px 14px"}}>
                      <span style={{background:statusDef.bg,color:statusDef.color,borderRadius:20,padding:"3px 11px",fontSize:10.5,fontWeight:700,whiteSpace:"nowrap" as const}}>{statusDef.label}</span>
                    </td>
                    <td style={{padding:"10px 14px",minWidth:140}}>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <div style={{flex:1,height:6,background:"#f1f5f9",borderRadius:99,overflow:"hidden"}}>
                          <div style={{width:`${prog.pct}%`,height:"100%",background:statusDef.color,borderRadius:99}}/>
                        </div>
                        <span style={{fontSize:11,fontWeight:700,color:"#475569",whiteSpace:"nowrap" as const}}>{prog.pct}% ({prog.done}/{prog.total})</span>
                      </div>
                    </td>
                    <td style={{padding:"10px 14px"}}>
                      {tgl?(
                        <div style={{display:"flex",alignItems:"center",gap:5,fontSize:11,fontWeight:600,color:"#475569",whiteSpace:"nowrap" as const}}>
                          <i className="ti ti-calendar-event" style={{fontSize:13,color:"#94a3b8"}}/> {fmtTgl(tgl)}
                        </div>
                      ):<span style={{fontSize:11,fontWeight:600,color:"#cbd5e1"}}>-</span>}
                    </td>
                    <td style={{padding:"10px 14px"}}>
                      <button onClick={()=>setSelectedPanelId(p.id)}
                        style={{display:"flex",alignItems:"center",gap:4,height:28,padding:"0 12px",borderRadius:7,border:"1px solid #dbeafe",background:"#eff6ff",color:"#1d4ed8",fontSize:11,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap" as const}}>
                        Detail <i className="ti ti-chevron-right" style={{fontSize:12}}/>
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
}
