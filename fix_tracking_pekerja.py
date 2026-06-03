from pathlib import Path
import re

APP_PATH = Path(r"C:\Users\User\vista-teknik\src\App.tsx")
content = APP_PATH.read_text(encoding="utf-8")

def find_function_bounds(text, func_name):
    pattern = rf'\nfunction {re.escape(func_name)}\s*\('
    matches = list(re.finditer(pattern, text))
    if not matches:
        return -1, -1
    match = matches[0]
    func_start = match.start() + 1
    i = match.end()
    paren_depth = 1
    while i < len(text) and paren_depth > 0:
        if text[i] == '(': paren_depth += 1
        elif text[i] == ')': paren_depth -= 1
        i += 1
    while i < len(text) and text[i] != '{':
        i += 1
    if i >= len(text): return -1, -1
    depth = 0
    while i < len(text):
        if text[i] == '{': depth += 1
        elif text[i] == '}':
            depth -= 1
            if depth == 0: return func_start, i + 1
        i += 1
    return -1, -1

NEW_TRACKING = r"""function TrackingPekerja({pekerja,renhar,setRenhar,removeRenhar,woData}){
  const [selPekerja,setSelPekerja]=useState<any>(null);
  const [filterDiv,setFilterDiv]=useState("ALL");
  const [search,setSearch]=useState("");
  const [dateFrom,setDateFrom]=useState("");
  const [dateTo,setDateTo]=useState("");
  const [delId,setDelId]=useState<any>(null);

  const operatorDivisi=Object.entries(DIVISI_CONFIG)
    .filter(([k])=>OPERATOR_ROLES.includes(k))
    .map(([k,v]:any)=>({key:k,...v}));

  // Ambil tugas pekerja dari renhar
  const getTugasPerPekerja=(pkrId:number)=>{
    return renhar.filter(r=>(r.pekerja||[]).includes(pkrId));
  };

  // Filter tugas berdasarkan tanggal
  const filterTugas=(tugas:any[])=>{
    return tugas.filter(t=>{
      if(dateFrom&&t.tanggal<dateFrom) return false;
      if(dateTo&&t.tanggal>dateTo) return false;
      return true;
    });
  };

  // Hitung progress per tugas dari checklist panel
  const getProgressTugas=(tugas:any)=>{
    const panel=woData.flatMap((w:any)=>w.panels||[]).find((p:any)=>
      String(p.id)===String(tugas.panel_id||tugas.panelId)
    );
    if(!panel||!panel.checklist) return 0;
    const komps=tugas.komponen||[];
    if(!komps.length) return 0;
    const proses=tugas.proses;
    const vals=komps.map((kode:string)=>{
      const cl=panel.checklist[kode];
      if(!cl) return 0;
      // cek progressByDate untuk tanggal tugas
      const byDate=cl.progressByDate?.[proses];
      if(byDate&&byDate[tugas.tanggal]!==undefined) return byDate[tugas.tanggal];
      return cl.progress?.[proses]||0;
    });
    return Math.round(vals.reduce((a:number,b:number)=>a+b,0)/vals.length);
  };

  // Status berdasarkan progress
  const getStatus=(pct:number)=>{
    if(pct>=100) return{label:"Tercapai",color:"#16a34a",bg:"#f0fdf4"};
    if(pct>0) return{label:"On Progress",color:"#f59e0b",bg:"#fffbeb"};
    return{label:"Belum",color:"#94a3b8",bg:"#f8fafc"};
  };

  // Rekap per tanggal untuk pekerja tertentu
  const getRekapPerTanggal=(pkrId:number)=>{
    const tugas=filterTugas(getTugasPerPekerja(pkrId));
    const byDate:{[d:string]:any[]}={};
    tugas.forEach(t=>{
      if(!byDate[t.tanggal]) byDate[t.tanggal]=[];
      byDate[t.tanggal].push(t);
    });
    return Object.entries(byDate).sort((a,b)=>b[0].localeCompare(a[0])).map(([tgl,tasks])=>{
      const progList=tasks.map(t=>getProgressTugas(t));
      const avgProg=progList.length?Math.round(progList.reduce((a,b)=>a+b,0)/progList.length):0;
      const selesai=progList.filter(p=>p>=100).length;
      return{tanggal:tgl,tasks,avgProg,selesai,total:tasks.length};
    });
  };

  // Stats per pekerja
  const getStatsPekerja=(pkrId:number)=>{
    const tugas=filterTugas(getTugasPerPekerja(pkrId));
    const progList=tugas.map(t=>getProgressTugas(t));
    const selesai=progList.filter(p=>p>=100).length;
    const onProg=progList.filter(p=>p>0&&p<100).length;
    const belum=progList.filter(p=>p===0).length;
    const avg=progList.length?Math.round(progList.reduce((a,b)=>a+b,0)/progList.length):0;
    const hariKerja=new Set(tugas.map(t=>t.tanggal)).size;
    return{total:tugas.length,selesai,onProg,belum,avg,hariKerja};
  };

  // Download PDF per pekerja
  const downloadPDF=(pkrId:number)=>{
    const pkr=pekerja.find(p=>p.id===pkrId);
    if(!pkr) return;
    const dc:any=DIVISI_CONFIG[pkr.divisi]||{};
    const rekap=getRekapPerTanggal(pkrId);
    const stats=getStatsPekerja(pkrId);
    const periodeTxt=dateFrom&&dateTo?dateFrom+' s/d '+dateTo:dateFrom?'Dari '+dateFrom:dateTo?'Sampai '+dateTo:'Semua periode';

    let txt='';
    txt+='═══════════════════════════════════════════════════\n';
    txt+='           LAPORAN KINERJA PEKERJA\n';
    txt+='═══════════════════════════════════════════════════\n\n';
    txt+='Nama    : '+pkr.nama+'\n';
    txt+='Divisi  : '+(dc.label||pkr.divisi)+'\n';
    txt+='Periode : '+periodeTxt+'\n';
    txt+='Dicetak : '+new Date().toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric'})+'\n\n';

    txt+='─────────────────────────────────────────────────\n';
    txt+='RINGKASAN\n';
    txt+='─────────────────────────────────────────────────\n';
    txt+='Total Tugas   : '+stats.total+'\n';
    txt+='Tercapai      : '+stats.selesai+'\n';
    txt+='On Progress   : '+stats.onProg+'\n';
    txt+='Belum Mulai   : '+stats.belum+'\n';
    txt+='Avg Progress  : '+stats.avg+'%\n';
    txt+='Hari Kerja    : '+stats.hariKerja+' hari\n\n';

    txt+='─────────────────────────────────────────────────\n';
    txt+='REKAP PER TANGGAL\n';
    txt+='─────────────────────────────────────────────────\n';
    rekap.forEach(r=>{
      txt+='\n📅 '+fmtDate(r.tanggal)+'\n';
      txt+='   Tugas: '+r.total+' | Selesai: '+r.selesai+' | Avg: '+r.avgProg+'%\n';
      r.tasks.forEach((t:any,i:number)=>{
        const pct=getProgressTugas(t);
        const st=getStatus(pct);
        txt+='   '+(i+1)+'. '+t.proyek+' - '+t.panel+'\n';
        txt+='      Proses: '+t.proses+' | WP: '+t.wp+' | Progress: '+pct+'% ['+st.label+']\n';
        if(t.komponen?.length){
          const panel=woData.flatMap((w:any)=>w.panels||[]).find((p:any)=>String(p.id)===String(t.panel_id||t.panelId));
          const cfg=panel?PANEL_TYPES[panel.tipe]:null;
          const namaKomp=(t.komponen||[]).map((k:string)=>cfg?.wps.flatMap((w:any)=>w.items).find((it:any)=>it.kode===k)?.nama||k).join(', ');
          txt+='      Komponen: '+namaKomp+'\n';
        }
      });
    });
    txt+='\n═══════════════════════════════════════════════════\n';

    const blob=new Blob([txt],{type:'text/plain;charset=utf-8'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url;
    a.download='Laporan_'+pkr.nama.replace(/\s+/g,'_')+'_'+new Date().toISOString().slice(0,10)+'.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredPekerja=pekerja.filter(p=>
    (filterDiv==="ALL"||p.divisi===filterDiv)&&
    p.nama.toLowerCase().includes(search.toLowerCase())
  );

  const thS:any={background:"#1e2330",color:"#c8d0e8",padding:"7px 10px",fontWeight:600,
    fontSize:10,textAlign:"left",whiteSpace:"nowrap",borderRight:"1px solid #ffffff10",
    textTransform:"uppercase",letterSpacing:.4};

  return(
    <div className="fi">
      {/* Filter bar */}
      <div style={{background:"#fff",borderRadius:10,border:"1px solid #e2e8f0",padding:"10px 14px",marginBottom:12,display:"flex",gap:8,flexWrap:"wrap" as const,alignItems:"center"}}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Cari nama pekerja..."
          style={{height:28,padding:"0 10px",border:"1px solid #e2e8f0",borderRadius:7,fontSize:11,background:"#f8fafc",outline:"none",color:"#1e293b",fontFamily:"inherit",width:200}}/>
        <div style={{display:"flex",alignItems:"center",gap:6,fontSize:11,color:"#64748b"}}>
          <span>Dari:</span>
          <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)}
            style={{height:28,padding:"0 8px",border:"1px solid #e2e8f0",borderRadius:7,fontSize:11,background:"#f8fafc",outline:"none",fontFamily:"inherit"}}/>
          <span>Sampai:</span>
          <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)}
            style={{height:28,padding:"0 8px",border:"1px solid #e2e8f0",borderRadius:7,fontSize:11,background:"#f8fafc",outline:"none",fontFamily:"inherit"}}/>
          {(dateFrom||dateTo)&&(
            <button onClick={()=>{setDateFrom("");setDateTo("");}}
              style={{height:28,padding:"0 10px",border:"1px solid #fecaca",background:"#fef2f2",color:"#dc2626",borderRadius:7,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>
              Reset
            </button>
          )}
        </div>
        <div style={{display:"flex",gap:5,flexWrap:"wrap" as const,marginLeft:"auto"}}>
          <button onClick={()=>setFilterDiv("ALL")}
            style={{padding:"3px 10px",borderRadius:20,cursor:"pointer",fontSize:10,fontWeight:700,
              border:filterDiv==="ALL"?"1.5px solid #1d4ed8":"1.5px solid #e2e8f0",
              background:filterDiv==="ALL"?"#1d4ed8":"#fff",color:filterDiv==="ALL"?"#fff":"#64748b"}}>
            Semua ({pekerja.length})
          </button>
          {operatorDivisi.map((d:any)=>{
            const cnt=pekerja.filter((p:any)=>p.divisi===d.key).length;
            const isSel=filterDiv===d.key;
            return(
              <button key={d.key} onClick={()=>setFilterDiv(isSel?"ALL":d.key)}
                style={{padding:"3px 10px",borderRadius:20,cursor:"pointer",fontSize:10,fontWeight:700,
                  border:isSel?`1.5px solid ${d.color}`:"1.5px solid #e2e8f0",
                  background:isSel?d.color+"18":"#fff",color:isSel?d.color:"#64748b"}}>
                {d.label} ({cnt})
              </button>
            );
          })}
        </div>
      </div>

      {/* Tabel pekerja */}
      <div style={{overflowX:"auto" as const,borderRadius:10,border:"1px solid #e2e8f0",marginBottom:12}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
          <thead><tr>
            <th style={{...thS,width:40,textAlign:"center" as const}}>No</th>
            <th style={thS}>Nama Pekerja</th>
            <th style={thS}>Divisi</th>
            <th style={{...thS,textAlign:"center" as const}}>Total Tugas</th>
            <th style={{...thS,textAlign:"center" as const}}>Tercapai</th>
            <th style={{...thS,textAlign:"center" as const}}>On Progress</th>
            <th style={{...thS,textAlign:"center" as const}}>Hari Kerja</th>
            <th style={{...thS,minWidth:100}}>Avg Progress</th>
            <th style={{...thS,textAlign:"center" as const}}>Aksi</th>
          </tr></thead>
          <tbody>
            {filteredPekerja.length===0?(
              <tr><td colSpan={9} style={{textAlign:"center",padding:"32px",color:"#94a3b8"}}>Tidak ada pekerja ditemukan</td></tr>
            ):filteredPekerja.map((p:any,i:number)=>{
              const dc:any=DIVISI_CONFIG[p.divisi]||{};
              const stats=getStatsPekerja(p.id);
              const isSel=selPekerja?.id===p.id;
              const rBg=isSel?"#eff6ff":i%2===0?"#fff":"#f8fafc";
              const td:any={padding:"8px 10px",borderBottom:"1px solid #f1f5f9",borderRight:"1px solid #f1f5f9",background:rBg,verticalAlign:"middle"};
              return(
                <tr key={p.id} style={{cursor:"pointer"}} onClick={()=>setSelPekerja(isSel?null:p)}>
                  <td style={{...td,textAlign:"center" as const,color:"#94a3b8",fontWeight:600}}>{i+1}</td>
                  <td style={{...td,fontWeight:700,color:"#1e293b"}}>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <div style={{width:26,height:26,borderRadius:7,background:dc.bg||"#f1f5f9",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:800,color:dc.color||"#64748b",flexShrink:0}}>
                        {p.nama?.slice(0,2).toUpperCase()}
                      </div>
                      {p.nama}
                    </div>
                  </td>
                  <td style={td}>
                    <span style={{background:dc.bg,color:dc.color,border:`1px solid ${dc.color}30`,borderRadius:20,padding:"2px 8px",fontSize:10,fontWeight:700}}>
                      {dc.icon} {dc.label}
                    </span>
                  </td>
                  <td style={{...td,textAlign:"center" as const,fontWeight:700,color:"#1e293b"}}>{stats.total}</td>
                  <td style={{...td,textAlign:"center" as const}}>
                    <span style={{color:"#16a34a",fontWeight:700}}>{stats.selesai}</span>
                  </td>
                  <td style={{...td,textAlign:"center" as const}}>
                    <span style={{color:"#f59e0b",fontWeight:700}}>{stats.onProg}</span>
                  </td>
                  <td style={{...td,textAlign:"center" as const,color:"#64748b"}}>{stats.hariKerja}</td>
                  <td style={td}>
                    <div style={{display:"flex",alignItems:"center",gap:6}}>
                      <div style={{flex:1,height:5,background:"#e2e8f0",borderRadius:99,overflow:"hidden",minWidth:60}}>
                        <div style={{width:stats.avg+"%",height:"100%",background:stats.avg>=75?"#16a34a":stats.avg>=50?"#f59e0b":"#ef4444",borderRadius:99}}/>
                      </div>
                      <span style={{fontSize:11,fontWeight:700,color:stats.avg>=75?"#16a34a":stats.avg>=50?"#f59e0b":"#ef4444",minWidth:32}}>{stats.avg}%</span>
                    </div>
                  </td>
                  <td style={{...td,textAlign:"center" as const}} onClick={e=>e.stopPropagation()}>
                    <button onClick={()=>downloadPDF(p.id)}
                      style={{background:"#eff6ff",border:"1px solid #bfdbfe",borderRadius:6,padding:"4px 8px",cursor:"pointer",fontSize:11,color:"#1d4ed8",fontWeight:600}}>
                      📄 PDF
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Detail pekerja yang dipilih */}
      {selPekerja&&(()=>{
        const dc:any=DIVISI_CONFIG[selPekerja.divisi]||{};
        const stats=getStatsPekerja(selPekerja.id);
        const rekap=getRekapPerTanggal(selPekerja.id);
        return(
          <div style={{background:"#fff",borderRadius:12,border:"1.5px solid #bfdbfe",overflow:"hidden"}}>
            {/* Header pekerja */}
            <div style={{background:"linear-gradient(135deg,#1e3a8a,#2563eb)",padding:"14px 18px",display:"flex",alignItems:"center",gap:12,justifyContent:"space-between",flexWrap:"wrap" as const}}>
              <div style={{display:"flex",alignItems:"center",gap:12}}>
                <div style={{width:40,height:40,borderRadius:10,background:"rgba(255,255,255,.2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,fontWeight:800,color:"#fff"}}>
                  {selPekerja.nama?.slice(0,2).toUpperCase()}
                </div>
                <div>
                  <div style={{fontWeight:800,fontSize:15,color:"#fff"}}>{selPekerja.nama}</div>
                  <span style={{background:"rgba(255,255,255,.2)",color:"#fff",borderRadius:20,padding:"2px 10px",fontSize:10,fontWeight:600}}>
                    {dc.icon} {dc.label}
                  </span>
                </div>
              </div>
              <div style={{display:"flex",gap:16,flexWrap:"wrap" as const}}>
                {[
                  {l:"Total Tugas",v:stats.total,c:"#fff"},
                  {l:"Tercapai",v:stats.selesai,c:"#86efac"},
                  {l:"On Progress",v:stats.onProg,c:"#fde68a"},
                  {l:"Hari Kerja",v:stats.hariKerja,c:"#bfdbfe"},
                  {l:"Avg %",v:stats.avg+"%",c:"#fff"},
                ].map((s,i)=>(
                  <div key={i} style={{textAlign:"center" as const}}>
                    <div style={{fontSize:20,fontWeight:800,color:s.c}}>{s.v}</div>
                    <div style={{fontSize:9,color:"rgba(255,255,255,.7)",fontWeight:600,textTransform:"uppercase" as const,letterSpacing:.3}}>{s.l}</div>
                  </div>
                ))}
              </div>
              <button onClick={()=>setSelPekerja(null)}
                style={{background:"rgba(255,255,255,.2)",border:"none",borderRadius:8,padding:"6px 12px",cursor:"pointer",color:"#fff",fontSize:12,fontWeight:600}}>
                ✕ Tutup
              </button>
            </div>

            {/* Rekap per tanggal */}
            <div style={{padding:"14px 18px"}}>
              {rekap.length===0?(
                <div style={{textAlign:"center",padding:"32px",color:"#94a3b8",fontSize:13}}>
                  Belum ada data tugas{dateFrom||dateTo?" pada periode ini":""}
                </div>
              ):rekap.map((r:any)=>(
                <div key={r.tanggal} style={{marginBottom:16}}>
                  {/* Header tanggal */}
                  <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8,padding:"6px 12px",background:"#f8fafc",borderRadius:8,border:"1px solid #e2e8f0"}}>
                    <span style={{fontWeight:700,fontSize:12,color:"#1e293b"}}>📅 {fmtDate(r.tanggal)}</span>
                    <span style={{fontSize:11,color:"#64748b"}}>{r.total} tugas</span>
                    <span style={{fontSize:11,color:"#16a34a",fontWeight:600}}>✓ {r.selesai} selesai</span>
                    <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:6}}>
                      <div style={{width:80,height:4,background:"#e2e8f0",borderRadius:99,overflow:"hidden"}}>
                        <div style={{width:r.avgProg+"%",height:"100%",background:r.avgProg>=75?"#16a34a":r.avgProg>=50?"#f59e0b":"#ef4444",borderRadius:99}}/>
                      </div>
                      <span style={{fontSize:11,fontWeight:700,color:r.avgProg>=75?"#16a34a":r.avgProg>=50?"#f59e0b":"#ef4444"}}>{r.avgProg}%</span>
                    </div>
                  </div>

                  {/* Detail tugas per tanggal */}
                  <div style={{overflowX:"auto" as const,borderRadius:8,border:"1px solid #e2e8f0"}}>
                    <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                      <thead><tr>
                        {["No","Proyek","Panel","Proses","WP","Komponen","Progress","Status","Hapus"].map(h=>(
                          <th key={h} style={{background:"#f1f5f9",color:"#64748b",padding:"6px 8px",fontWeight:600,fontSize:9.5,textAlign:"left" as const,whiteSpace:"nowrap" as const,borderRight:"1px solid #e2e8f0",textTransform:"uppercase" as const,letterSpacing:.3}}>{h}</th>
                        ))}
                      </tr></thead>
                      <tbody>
                        {r.tasks.map((t:any,ti:number)=>{
                          const pct=getProgressTugas(t);
                          const st=getStatus(pct);
                          const panelData=woData.flatMap((w:any)=>w.panels||[]).find((p:any)=>String(p.id)===String(t.panel_id||t.panelId));
                          const cfg=panelData?PANEL_TYPES[panelData.tipe]:null;
                          const pc=PROSES_COLOR[t.proses]||"#64748b";
                          const wc=WP_COLOR[t.wp]||"#64748b";
                          const rBg2=ti%2===0?"#fff":"#f8fafc";
                          const td2:any={padding:"6px 8px",borderBottom:"1px solid #f5f7fa",borderRight:"1px solid #f5f7fa",background:rBg2,verticalAlign:"middle"};
                          return(
                            <tr key={t.id||ti}>
                              <td style={{...td2,color:"#94a3b8",fontWeight:600,textAlign:"center" as const}}>{ti+1}</td>
                              <td style={{...td2,fontWeight:600,color:"#475569"}}>{t.proyek}</td>
                              <td style={{...td2,fontWeight:600,color:"#1e293b"}}>{t.panel}</td>
                              <td style={td2}><span style={{background:pc+"18",color:pc,border:`1px solid ${pc}33`,borderRadius:6,padding:"1px 7px",fontSize:10,fontWeight:700}}>{t.proses}</span></td>
                              <td style={td2}><span style={{background:wc,color:"#fff",borderRadius:5,padding:"1px 7px",fontSize:10,fontWeight:700}}>{t.wp}</span></td>
                              <td style={td2}>
                                <div style={{display:"flex",gap:3,flexWrap:"wrap" as const}}>
                                  {(t.komponen||[]).map((k:string)=>{
                                    const item=cfg?.wps.flatMap((w:any)=>w.items).find((it:any)=>it.kode===k);
                                    return(<span key={k} style={{background:"#f1f5f9",borderRadius:4,padding:"1px 6px",fontSize:9.5,color:"#475569",fontWeight:600}}>{item?.nama||k}</span>);
                                  })}
                                </div>
                              </td>
                              <td style={td2}>
                                <div style={{display:"flex",alignItems:"center",gap:5}}>
                                  <div style={{width:50,height:4,background:"#e2e8f0",borderRadius:99,overflow:"hidden"}}>
                                    <div style={{width:pct+"%",height:"100%",background:pct>=100?"#16a34a":pct>0?"#f59e0b":"#e2e8f0",borderRadius:99}}/>
                                  </div>
                                  <span style={{fontSize:10,fontWeight:700,color:pct>=100?"#16a34a":pct>0?"#f59e0b":"#94a3b8"}}>{pct}%</span>
                                </div>
                              </td>
                              <td style={td2}>
                                <span style={{background:st.bg,color:st.color,border:`1px solid ${st.color}30`,borderRadius:20,padding:"2px 8px",fontSize:9.5,fontWeight:700}}>
                                  {st.label}
                                </span>
                              </td>
                              <td style={{...td2,textAlign:"center" as const}}>
                                <button onClick={()=>setDelId(t)}
                                  style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:5,padding:"3px 7px",cursor:"pointer",fontSize:10,color:"#dc2626"}}>
                                  🗑
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Modal hapus */}
      {delId&&(
        <Modal title="Hapus Tugas?" onClose={()=>setDelId(null)} width={380}>
          <div style={{fontSize:13,color:"#475569",marginBottom:8}}>
            Tugas berikut akan dihapus dari rencana harian:
          </div>
          <div style={{background:"#f8fafc",borderRadius:8,padding:"10px 12px",marginBottom:20,fontSize:12}}>
            <div style={{fontWeight:700,color:"#1e293b",marginBottom:4}}>{delId.proyek} — {delId.panel}</div>
            <div style={{color:"#64748b"}}>{delId.proses} · {delId.wp} · {fmtDate(delId.tanggal)}</div>
          </div>
          <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
            <Btn outline color="#64748b" onClick={()=>setDelId(null)}>Batal</Btn>
            <Btn color="#dc2626" onClick={async()=>{
              if(removeRenhar) await removeRenhar(delId.id);
              if(setRenhar) setRenhar((prev:any[])=>prev.filter((r:any)=>r.id!==delId.id));
              setDelId(null);
            }}>Hapus</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}
"""

print("🔄 Replace TrackingPekerja...")
s, e = find_function_bounds(content, "TrackingPekerja")
if s == -1:
    print("❌ TrackingPekerja tidak ditemukan!")
    exit(1)
print(f"   Ditemukan karakter {s}–{e}")
content = content[:s] + NEW_TRACKING + content[e:]
APP_PATH.write_text(content, encoding="utf-8")
print("✅ Selesai!")
