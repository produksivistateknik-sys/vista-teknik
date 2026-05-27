function RawSchedule({woData,rawData,setRawData,renhar,setRenhar,pekerja,createRaw,updateRaw,removeRaw,refetchRaw,createRenhar,updateRenhar,removeRenhar}){
  const [weekStart,setWeekStart]=useState(TODAY);
  const [cellModal,setCellModal]=useState(null);
  const [dragInfo,setDragInfo]=useState(null);
  const [dragOverCell,setDragOverCell]=useState(null);
  const [dragMode,setDragMode]=useState(null);
  const [addModal,setAddModal]=useState(false);
  const [selDate,setSelDate]=useState(null);
  const [addForm,setAddForm]=useState({woId:"",panelId:"",prioritas:"Sedang"});
  const [modalWp,setModalWp]=useState("");
  const [modalKomponen,setModalKomponen]=useState([]);
  const [filterProses,setFilterProses]=useState("ALL");
  const [filterProyek,setFilterProyek]=useState("ALL");
  const [filterPanel,setFilterPanel]=useState("ALL");
  const [expandedTasks,setExpandedTasks]=useState({});
  const [assignModal,setAssignModal]=useState(null);
  const [selPekerja,setSelPekerja]=useState([]);

  const getKomponenStatus=(panelId,proses,kode)=>{
    const panelData=woData.flatMap(w=>w.panels||[]).find(p=>p.id===panelId);
    if(!panelData)return"belum_mulai";
    const cl=panelData.checklist?.[kode];
    if(!cl)return"belum_mulai";
    const v=cl.progress?.[proses]||0;
    if(v>=100)return"finish";
    if(v>0)return"on_progress";
    return"belum_mulai";
  };

  const getTaskStatus=(row,date,wp,komponen)=>{
    const panelId=row.panel_id||row.panelId;
    const panelData=woData.flatMap(w=>w.panels||[]).find(p=>p.id===panelId);
    if(!panelData)return"belum_mulai";
    const proses=row.proses;
    const allDone=komponen.every(kode=>{
      const cl=panelData.checklist?.[kode];
      if(!cl)return false;
      return(cl.progress?.[proses]||0)>=100;
    });
    if(allDone&&komponen.length>0)return"finish";
    const anyStarted=komponen.some(kode=>{
      const cl=panelData.checklist?.[kode];
      if(!cl)return false;
      return(cl.progress?.[proses]||0)>0;
    });
    if(anyStarted)return"on_progress";
    return"belum_mulai";
  };

  const isWpDone=(panelData,wp,proses)=>{
    if(!panelData)return false;
    const cfg=PANEL_TYPES[panelData.tipe];
    const wpDef=cfg?.wps.find(w=>w.wp===wp);
    if(!wpDef||!wpDef.items.length)return false;
    return wpDef.items.every(it=>{
      const cl=panelData.checklist?.[it.kode];
      if(!cl)return false;
      return(cl.progress?.[proses]||0)>=100;
    });
  };

  const days=useMemo(()=>Array.from({length:7},(_,i)=>addDays(weekStart,i)),[weekStart]);
  const openCellModal=(rawId,date)=>{setCellModal({rawId,date});setModalWp("");setModalKomponen([]);};
  const rawRow=cellModal?rawData.find(r=>r.id===cellModal.rawId):null;
  const cellEntries=rawRow?.schedule?.[cellModal?.date]||[];
  const livePanelForCell=rawRow?woData.flatMap(w=>w.panels||[]).find(p=>p.id===(rawRow.panel_id||rawRow.panelId)):null;
  const panelCfg=livePanelForCell?PANEL_TYPES[livePanelForCell.tipe]:null;
  const wpItems=panelCfg?.wps.find(w=>w.wp===modalWp)?.items||[];

  const syncRenharKomp=(rawId,date,wp,newKomp)=>{
    setRenhar(prev=>prev.map(r=>((r.raw_id||r.rawId)===rawId&&r.wp===wp&&r.tanggal===date)?{...r,komponen:newKomp}:r));
  };
  const syncRenharDel=(rawId,date,wp)=>{
    setRenhar(prev=>prev.filter(r=>!((r.raw_id||r.rawId)===rawId&&r.wp===wp&&r.tanggal===date)));
  };

  const addEntry=async()=>{
    if(!modalWp||!modalKomponen.length)return;
    let finalKomp=modalKomponen;
    let updatedRow=null;
    setRawData(prev=>prev.map(r=>{
      if(r.id!==cellModal.rawId)return r;
      const newSch={...r.schedule};
      const existing=newSch[cellModal.date]||[];
      const wpEntry=existing.find(e=>e.wp===modalWp);
      let updated;
      if(wpEntry){
        finalKomp=[...new Set([...wpEntry.komponen,...modalKomponen])];
        updated=existing.map(e=>e.wp!==modalWp?e:{...e,komponen:finalKomp});
      } else {
        updated=[...existing,{wp:modalWp,komponen:modalKomponen}];
      }
      newSch[cellModal.date]=updated;
      updatedRow={...r,schedule:newSch};
      return updatedRow;
    }));
    syncRenharKomp(cellModal.rawId,cellModal.date,modalWp,finalKomp);
    setModalWp("");setModalKomponen([]);
    if(updatedRow) await updateRaw(cellModal.rawId,{schedule:updatedRow.schedule});
  };

  const removeEntry=async(wp)=>{
    let updatedRow=null;
    setRawData(prev=>prev.map(r=>{
      if(r.id!==cellModal.rawId)return r;
      const newSch={...r.schedule};
      const updated=(newSch[cellModal.date]||[]).filter(e=>e.wp!==wp);
      if(!updated.length)delete newSch[cellModal.date]; else newSch[cellModal.date]=updated;
      updatedRow={...r,schedule:newSch};
      return updatedRow;
    }));
    syncRenharDel(cellModal.rawId,cellModal.date,wp);
    if(updatedRow) await updateRaw(cellModal.rawId,{schedule:updatedRow.schedule});
  };

  const onDragStart=(e,rawId,date,entries)=>{setDragInfo({rawId,fromDate:date,entries});e.dataTransfer.effectAllowed="copyMove";};
  const onDragOver=(e,rawId,date)=>{e.preventDefault();setDragOverCell({rawId,date});};
  const onDrop=(e,rawId,toDate)=>{
    e.preventDefault();
    if(!dragInfo||dragInfo.fromDate===toDate){setDragOverCell(null);setDragInfo(null);return;}
    setDragMode({...dragInfo,toDate});setDragOverCell(null);
  };

  const confirmDrag=async(mode)=>{
    if(!dragMode)return;
    const{rawId,fromDate,entries,toDate}=dragMode;
    let updatedRow=null;
    setRawData(prev=>prev.map(r=>{
      if(r.id!==rawId)return r;
      const newSch={...r.schedule};
      if(mode==="move")delete newSch[fromDate];
      const existing=newSch[toDate]||[];
      const merged=[...existing];
      entries.forEach(e=>{
        const found=merged.find(m=>m.wp===e.wp);
        if(found)found.komponen=[...new Set([...found.komponen,...e.komponen])];
        else merged.push({...e});
      });
      newSch[toDate]=merged;
      updatedRow={...r,schedule:newSch};
      return updatedRow;
    }));
    if(mode==="move"){
      setRenhar(prev=>prev.map(r=>{
        if((r.raw_id||r.rawId)!==rawId||r.tanggal!==fromDate)return r;
        const entry=entries.find(e=>e.wp===r.wp);
        if(!entry)return r;
        return{...r,tanggal:toDate,komponen:entry.komponen};
      }));
    }
    setDragMode(null);setDragInfo(null);
    if(updatedRow) await updateRaw(rawId,{schedule:updatedRow.schedule});
  };

  const updatePrioritasPanel=async(panelId,val)=>{
    const toUpdate=rawData.filter(r=>(r.panel_id||r.panelId)===panelId);
    setRawData(prev=>prev.map(r=>(r.panel_id||r.panelId)!==panelId?r:{...r,prioritas:val}));
    setRenhar(prev=>prev.map(r=>(r.panel_id||r.panelId)!==panelId?r:{...r,prioritas:val}));
    for(const r of toUpdate){ await updateRaw(r.id,{prioritas:val}); }
  };

  const panelOpts=addForm.woId?woData.find(w=>w.id===Number(addForm.woId))?.panels||[]:[]; 
  const submitAdd=async()=>{
    if(!addForm.woId||!addForm.panelId)return;
    const wo=woData.find(w=>w.id===Number(addForm.woId));
    const p=wo?.panels.find(x=>x.id===Number(addForm.panelId));
    if(!wo||!p)return;
    const existing=rawData.filter(r=>(r.panel_id||r.panelId)===p.id).map(r=>r.proses);
    const toAdd=ALL_PROSES.filter(pr=>!existing.includes(pr));
    if(!toAdd.length){alert("Semua proses panel ini sudah ada!");return;}
    for(const proses of toAdd){
      await createRaw({
        wo_id:wo.id,panel_id:p.id,proyek:wo.proyek,panel:p.nama,
        proses,prioritas:addForm.prioritas,schedule:{}
      });
    }
    await refetchRaw();
    setAddModal(false);setAddForm({woId:"",panelId:"",prioritas:"Sedang"});
  };

  const dateTasks=useMemo(()=>{
    if(!selDate)return[];
    return rawData.flatMap(r=>(r.schedule?.[selDate]||[]).map(e=>({
      rawId:r.id,woId:r.wo_id||r.woId,panelId:r.panel_id||r.panelId,
      proyek:r.proyek,panel:r.panel,proses:r.proses,prioritas:r.prioritas,
      wp:e.wp,komponen:e.komponen,tanggal:selDate
    })));
  },[rawData,selDate]);

  const openAssign=(task)=>{
    const divisi=Object.entries(DIVISI_PROSES).find(([,ps])=>ps.includes(task.proses))?.[0]||"mekanik";
    const existing=renhar.find(r=>(r.raw_id||r.rawId)===task.rawId&&r.wp===task.wp&&r.tanggal===task.tanggal);
    setSelPekerja(existing?.pekerja||[]);
    setAssignModal({task,divisi,existing:existing||null,isExisting:!!existing});
  };

  const confirmDistribute=async()=>{
    if(!assignModal)return;
    const{task,divisi,existing}=assignModal;
    if(existing){
      await updateRenhar(existing.id,{pekerja:selPekerja});
      setRenhar(prev=>prev.map(r=>r.id===existing.id?{...r,pekerja:selPekerja}:r));
    } else {
      const result=await createRenhar({
        raw_id:task.rawId,wo_id:task.woId,panel_id:task.panelId,
        proyek:task.proyek,panel:task.panel,proses:task.proses,
        prioritas:task.prioritas||"Sedang",wp:task.wp,komponen:task.komponen,
        tanggal:task.tanggal,divisi,pekerja:selPekerja,
      });
      if(result?.success&&result.data){setRenhar(prev=>[...prev,result.data]);}
    }
    setAssignModal(null);setSelPekerja([]);
  };

  const distributeAll=async()=>{
    for(const task of dateTasks){
      const divisi=Object.entries(DIVISI_PROSES).find(([,ps])=>ps.includes(task.proses))?.[0]||"mekanik";
      if(renhar.find(r=>(r.raw_id||r.rawId)===task.rawId&&r.wp===task.wp&&r.tanggal===task.tanggal))continue;
      const result=await createRenhar({
        raw_id:task.rawId,wo_id:task.woId,panel_id:task.panelId,
        proyek:task.proyek,panel:task.panel,proses:task.proses,
        prioritas:task.prioritas||"Sedang",wp:task.wp,komponen:task.komponen,
        tanggal:task.tanggal,divisi,pekerja:[],
      });
      if(result?.success&&result.data){setRenhar(prev=>[...prev,result.data]);}
    }
  };

  const thS={background:"#1e3a8a",color:"#fff",padding:"8px 10px",fontWeight:700,fontSize:10,
    whiteSpace:"nowrap",letterSpacing:.3,textAlign:"center",borderRight:"1px solid #ffffff15",
    position:"sticky",top:0,zIndex:3};

  return(
    <div className="fi">
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,flexWrap:"wrap",gap:10}}>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <Btn outline color="#2563eb" style={{padding:"6px 14px",fontSize:12}} onClick={()=>setWeekStart(addDays(weekStart,-7))}>‹ Minggu Lalu</Btn>
          <button onClick={()=>setWeekStart(TODAY)} style={{padding:"6px 14px",borderRadius:8,border:"1.5px solid #e2e8f0",background:weekStart===TODAY?"#eff6ff":"#fff",color:"#2563eb",cursor:"pointer",fontSize:12,fontWeight:700}}>Hari Ini</button>
          <Btn outline color="#2563eb" style={{padding:"6px 14px",fontSize:12}} onClick={()=>setWeekStart(addDays(weekStart,7))}>Minggu Depan ›</Btn>
        </div>
        <Btn color="#1d4ed8" onClick={()=>setAddModal(true)}>+ Tambah Panel</Btn>
      </div>
      <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap",alignItems:"center",background:"#fff",borderRadius:10,padding:"8px 12px",border:"1px solid #e2e8f0"}}>
        <span style={{fontSize:11,color:"#94a3b8",fontWeight:600}}>Filter:</span>
        <select value={filterProyek} onChange={e=>{setFilterProyek(e.target.value);setFilterPanel("ALL");}} style={{padding:"4px 10px",borderRadius:8,border:"1.5px solid #e2e8f0",background:"#f8fafc",fontSize:11,fontWeight:600,color:"#475569",cursor:"pointer"}}>
          <option value="ALL">Semua Proyek</option>
          {[...new Set(rawData.map(r=>r.proyek))].map(p=><option key={p} value={p}>{p}</option>)}
        </select>
        <select value={filterPanel} onChange={e=>setFilterPanel(e.target.value)} style={{padding:"4px 10px",borderRadius:8,border:"1.5px solid #e2e8f0",background:"#f8fafc",fontSize:11,fontWeight:600,color:"#475569",cursor:"pointer",maxWidth:260}}>
          <option value="ALL">Semua Panel</option>
          {[...new Set(rawData.filter(r=>filterProyek==="ALL"||r.proyek===filterProyek).map(r=>r.panel))].map(p=>(<option key={p} value={p}>{p}</option>))}
        </select>
        {(filterProyek!=="ALL"||filterPanel!=="ALL")&&(
          <button onClick={()=>{setFilterProyek("ALL");setFilterPanel("ALL");}} style={{padding:"4px 10px",borderRadius:8,border:"1px solid #fecaca",background:"#fef2f2",color:"#dc2626",fontSize:11,fontWeight:600,cursor:"pointer"}}>✕ Reset</button>
        )}
      </div>
      <div style={{display:"flex",gap:6,marginBottom:12,flexWrap:"wrap",alignItems:"center"}}>
        <span style={{fontSize:11,color:"#64748b",fontWeight:600}}>Filter Proses:</span>
        <button onClick={()=>setFilterProses("ALL")} style={{padding:"3px 12px",borderRadius:20,border:`1.5px solid ${filterProses==="ALL"?"#1d4ed8":"#e2e8f0"}`,background:filterProses==="ALL"?"#1d4ed8":"#fff",color:filterProses==="ALL"?"#fff":"#64748b",cursor:"pointer",fontSize:11,fontWeight:700}}>Semua</button>
        {ALL_PROSES.map(pr=>{const pc=PROSES_COLOR[pr]||"#64748b";const isSel=filterProses===pr;return(<button key={pr} onClick={()=>setFilterProses(isSel?"ALL":pr)} style={{padding:"3px 12px",borderRadius:20,border:`1.5px solid ${isSel?pc:"#e2e8f0"}`,background:isSel?pc+"18":"#fff",color:isSel?pc:"#64748b",cursor:"pointer",fontSize:11,fontWeight:700}}>{pr}</button>);})}
      </div>
      <div style={{display:"flex",gap:6,marginBottom:12,flexWrap:"wrap",alignItems:"center"}}>
        {WP_LIST.map(wp=>(<span key={wp} style={{display:"flex",alignItems:"center",gap:4,fontSize:11,fontWeight:700,color:WP_COLOR[wp],background:WP_COLOR[wp]+"18",border:`1px solid ${WP_COLOR[wp]}33`,borderRadius:20,padding:"2px 10px"}}><span style={{width:7,height:7,borderRadius:"50%",background:WP_COLOR[wp],display:"inline-block"}}/>{wp}</span>))}
        {PRIORITAS.map(p=><Badge key={p} label={p} color={PRIORITAS_COLOR[p]}/>)}
        <span style={{fontSize:11,color:"#16a34a",background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:20,padding:"2px 10px",fontWeight:700}}>✓ Finish</span>
        <span style={{fontSize:11,color:"#f59e0b",background:"#fffbeb",border:"1px solid #fde68a",borderRadius:20,padding:"2px 10px",fontWeight:700}}>● On Progress</span>
        <span style={{fontSize:11,color:"#64748b",background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:20,padding:"2px 10px",fontWeight:700}}>○ Belum Mulai</span>
      </div>
      <div style={{overflowX:"auto",borderRadius:12,border:"1px solid #e2e8f0",boxShadow:"0 1px 4px #00000008"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
          <thead>
            <tr>
              <th style={{...thS,textAlign:"left",minWidth:120,position:"sticky",left:0,zIndex:5}}>PROYEK</th>
              <th style={{...thS,textAlign:"left",minWidth:260,position:"sticky",left:120,zIndex:5}}>PANEL</th>
              <th style={{...thS,minWidth:110,position:"sticky",left:380,zIndex:5}}>PROSES</th>
              <th style={{...thS,minWidth:90,position:"sticky",left:490,zIndex:5}}>PRIORITAS</th>
              {days.map(d=>(
                <th key={d} onClick={()=>setSelDate(d===selDate?null:d)}
                  style={{...thS,minWidth:120,cursor:"pointer",background:d===TODAY?"#1e40af":selDate===d?"#1d4ed8":"#1e3a8a",borderBottom:d===TODAY?"2px solid #60a5fa":selDate===d?"2px solid #93c5fd":"none"}}>
                  <div>{getDayLabel(d)}</div>
                  {d===TODAY&&<div style={{fontSize:9,opacity:.7}}>Hari Ini</div>}
                  {selDate===d&&<div style={{fontSize:9,color:"#93c5fd"}}>▼ Review</div>}
                </th>
              ))}
              <th style={{...thS,minWidth:40,position:"sticky",right:0,zIndex:5}}>✕</th>
            </tr>
          </thead>
          <tbody>
            {(()=>{
              const PRIO_ORDER={"Tinggi":0,"Sedang":1,"Rendah":2};
              const visibleRows=rawData.filter(row=>
                (filterProses==="ALL"||row.proses===filterProses)&&
                (filterProyek==="ALL"||row.proyek===filterProyek)&&
                (filterPanel==="ALL"||row.panel===filterPanel)
              ).sort((a,b)=>{
                const pa=PRIO_ORDER[a.prioritas]??1;const pb=PRIO_ORDER[b.prioritas]??1;
                if(pa!==pb)return pa-pb;
                const aId=a.panel_id||a.panelId;const bId=b.panel_id||b.panelId;
                if(aId!==bId)return aId-bId;
                return 0;
              });
              return visibleRows.map((row,ri)=>{
                const pc=PROSES_COLOR[row.proses]||"#64748b";
                const priColor=PRIORITAS_COLOR[row.prioritas]||"#64748b";
                const rBg=ri%2===0?"#fff":"#f8fafc";
                const prevRow=visibleRows[ri-1];
                const prevPanelId=prevRow?(prevRow.panel_id||prevRow.panelId):null;
                const curPanelId=row.panel_id||row.panelId;
                const isNewPanel=!prevRow||prevPanelId!==curPanelId;
                const panelTopBorder=isNewPanel&&ri>0?"3px solid #1e293b":"1px solid #f1f5f9";
                const td={borderBottom:"1px solid #f1f5f9",borderRight:"1px solid #f1f5f9",background:rBg,padding:"6px 8px",verticalAlign:"middle",borderTop:panelTopBorder};
                return(
                  <tr key={row.id}>
                    <td style={{...td,position:"sticky",left:0,zIndex:2,fontWeight:600,fontSize:11,color:"#475569",whiteSpace:"nowrap"}}>{row.proyek}</td>
                    <td style={{...td,position:"sticky",left:120,zIndex:2,fontWeight:600,fontSize:11,color:"#1e293b",whiteSpace:"nowrap",minWidth:260}}>{row.panel}</td>
                    <td style={{...td,position:"sticky",left:380,zIndex:2,textAlign:"center"}}>
                      <span style={{background:pc+"18",color:pc,border:`1px solid ${pc}33`,borderRadius:6,padding:"2px 8px",fontWeight:700,fontSize:10,whiteSpace:"nowrap"}}>{row.proses}</span>
                    </td>
                    <td style={{...td,position:"sticky",left:490,zIndex:2,textAlign:"center"}}>
                      <select value={row.prioritas||"Sedang"} onChange={e=>updatePrioritasPanel(row.panel_id||row.panelId,e.target.value)}
                        style={{padding:"2px 6px",borderRadius:6,border:`1.5px solid ${priColor}`,background:priColor+"18",color:priColor,fontSize:10,fontWeight:700,cursor:"pointer"}}>
                        {PRIORITAS.map(p=><option key={p} value={p}>{p}</option>)}
                      </select>
                    </td>
                    {days.map(d=>{
                      const entries=row.schedule?.[d]||[];
                      const isOver=dragOverCell?.rawId===row.id&&dragOverCell?.date===d;
                      const isSelDate=selDate===d;
                      return(
                        <td key={d} style={{...td,textAlign:"center",padding:"4px",background:isOver?"#eff6ff":isSelDate&&entries.length?"#f0f9ff":rBg,outline:isOver?"2px dashed #2563eb":"none"}}
                          onDragOver={e=>onDragOver(e,row.id,d)}
                          onDrop={e=>onDrop(e,row.id,d)}
                          onDragLeave={()=>setDragOverCell(null)}>
                          {entries.length>0?(
                            <div draggable onDragStart={e=>onDragStart(e,row.id,d,entries)}
                              onClick={()=>openCellModal(row.id,d)}
                              style={{display:"flex",flexWrap:"wrap",gap:3,justifyContent:"center",cursor:"grab",padding:"3px",borderRadius:6,border:isSelDate?"1px solid #bfdbfe":"1px solid transparent"}}>
                              {entries.map(e=>{
                                const status=getTaskStatus(row,d,e.wp,e.komponen);
                                const statusStyle=status==="finish"?{background:"#16a34a",opacity:.9}:status==="on_progress"?{background:"#f59e0b"}:{background:WP_COLOR[e.wp]||"#64748b"};
                                const statusIcon=status==="finish"?"✓":status==="on_progress"?"●":"";
                                return(<div key={e.wp} style={{...statusStyle,color:"#fff",borderRadius:4,padding:"2px 6px",fontSize:10,fontWeight:700,display:"flex",alignItems:"center",gap:3}}>{statusIcon&&<span style={{fontSize:9}}>{statusIcon}</span>}{e.wp}<span style={{fontSize:9,opacity:.8,marginLeft:2}}>({e.komponen.length})</span></div>);
                              })}
                            </div>
                          ):(
                            <div onClick={()=>openCellModal(row.id,d)}
                              style={{width:"100%",height:32,borderRadius:6,cursor:"pointer",border:"1px dashed #e2e8f0",display:"flex",alignItems:"center",justifyContent:"center",color:"#e2e8f0",fontSize:16,transition:"all .15s"}}
                              onMouseEnter={e=>{e.target.style.borderColor="#94a3b8";e.target.style.color="#94a3b8";}}
                              onMouseLeave={e=>{e.target.style.borderColor="#e2e8f0";e.target.style.color="#e2e8f0";}}>+</div>
                          )}
                        </td>
                      );
                    })}
                    <td style={{...td,textAlign:"center",position:"sticky",right:0,zIndex:2}}>
                      <button onClick={async()=>{await removeRaw(row.id);setRawData(prev=>prev.filter(r=>r.id!==row.id));}} style={{background:"none",border:"none",cursor:"pointer",color:"#fca5a5",fontSize:14}}>🗑</button>
                    </td>
                  </tr>
                );
              });
            })()}
          </tbody>
        </table>
      </div>

      {selDate&&(
        <Card style={{marginTop:16,border:"1.5px solid #bfdbfe",background:"#f0f8ff"}} className="su">
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,flexWrap:"wrap",gap:8}}>
            <div>
              <div style={{fontWeight:800,fontSize:15,color:"#1d4ed8"}}>📋 {fmtDateFull(selDate)}</div>
              <div style={{fontSize:12,color:"#64748b",marginTop:2}}>{dateTasks.length} pekerjaan · Distribusi dilakukan di tab Rencana Harian</div>
            </div>
            <button onClick={()=>setSelDate(null)} style={{background:"none",border:"none",cursor:"pointer",color:"#94a3b8",fontSize:20}}>✕</button>
          </div>
          {dateTasks.map((t,i)=>{
            const pc=PROSES_COLOR[t.proses]||"#475569";
            const wc=WP_COLOR[t.wp]||"#64748b";
            const priColor=PRIORITAS_COLOR[t.prioritas]||"#64748b";
            const panelData=woData.flatMap(w=>w.panels||[]).find(p=>p.id===t.panelId);
            const cfg2=panelData?PANEL_TYPES[panelData.tipe]:null;
            const status=getTaskStatus(t,t.tanggal,t.wp,t.komponen);
            const statusColor=status==="finish"?"#16a34a":status==="on_progress"?"#f59e0b":"#64748b";
            const statusLabel=status==="finish"?"✓ Finish":status==="on_progress"?"● On Progress":"○ Belum Mulai";
            const taskKey=`${t.rawId}-${t.wp}-${t.tanggal}`;
            const isExpanded=expandedTasks[taskKey];
            const grouped={finish:[],on_progress:[],belum_mulai:[]};
            t.komponen.forEach(k=>{
              const s=getKomponenStatus(t.panelId,t.proses,k);
              const item=cfg2?.wps.flatMap(w=>w.items).find(it=>it.kode===k);
              grouped[s].push({kode:k,nama:item?.nama||k});
            });
            const statusGroups=[
              {key:"finish",label:"✓ Finish",color:"#16a34a",bg:"#f0fdf4",border:"#bbf7d0"},
              {key:"on_progress",label:"● On Progress",color:"#f59e0b",bg:"#fffbeb",border:"#fde68a"},
              {key:"belum_mulai",label:"○ Belum Mulai",color:"#64748b",bg:"#f8fafc",border:"#e2e8f0"},
            ];
            return(
              <div key={i} style={{padding:"10px 14px",borderRadius:10,marginBottom:8,background:"#fff",border:`1px solid ${statusColor}30`}}>
                <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap",marginBottom:6}}>
                  <div style={{flex:1,minWidth:160}}>
                    <div style={{fontWeight:700,fontSize:13,color:"#1e293b"}}>{t.proyek}</div>
                    <div style={{fontSize:11,color:"#64748b"}}>{t.panel}</div>
                  </div>
                  <div style={{display:"flex",gap:5,flexWrap:"wrap",alignItems:"center"}}>
                    <Badge label={t.proses} color={pc}/>
                    <span style={{background:wc,color:"#fff",borderRadius:6,padding:"2px 9px",fontSize:11,fontWeight:700}}>{t.wp}</span>
                    <Badge label={t.prioritas||"Sedang"} color={priColor}/>
                    <span style={{fontSize:11,fontWeight:700,color:statusColor}}>{statusLabel}</span>
                  </div>
                </div>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,flexWrap:"wrap"}}>
                  <div style={{display:"flex",gap:4,flexWrap:"wrap",flex:1}}>
                    {t.komponen.map(k=>{const item=cfg2?.wps.flatMap(w=>w.items).find(it=>it.kode===k);return <span key={k} style={{background:"#f1f5f9",borderRadius:4,padding:"2px 8px",fontSize:10,color:"#475569",fontWeight:600}}>{item?.nama||k}</span>;})}
                  </div>
                  <button onClick={()=>setExpandedTasks(prev=>({...prev,[taskKey]:!prev[taskKey]}))}
                    style={{background:"#f8fafc",border:"1px solid #e2e8f0",color:"#475569",borderRadius:7,padding:"4px 10px",cursor:"pointer",fontSize:11,fontWeight:600,display:"flex",alignItems:"center",gap:4,whiteSpace:"nowrap"}}>
                    {isExpanded?"▲ Tutup":"▼ Detail Status"}
                  </button>
                </div>
                {isExpanded&&(
                  <div style={{marginTop:10,paddingTop:10,borderTop:"1px dashed #e2e8f0",display:"flex",flexDirection:"column",gap:8}}>
                    {statusGroups.filter(g=>grouped[g.key].length>0).map(g=>(
                      <div key={g.key} style={{background:g.bg,border:`1px solid ${g.border}`,borderRadius:8,padding:"8px 12px"}}>
                        <div style={{fontWeight:800,fontSize:11,color:g.color,marginBottom:6,letterSpacing:.3}}>{g.label} ({grouped[g.key].length})</div>
                        <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                          {grouped[g.key].map(it=>(<span key={it.kode} style={{background:"#fff",border:`1px solid ${g.border}`,borderRadius:6,padding:"3px 9px",fontSize:11,fontWeight:600,color:"#475569"}}>{it.nama}</span>))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </Card>
      )}

      {cellModal&&rawRow&&(
        <Modal title={`Jadwal ${getDayLabel(cellModal.date)} — ${rawRow.proses}`} onClose={()=>setCellModal(null)} width={520}>
          <div style={{fontSize:12,color:"#64748b",marginBottom:16}}>{rawRow.proyek} · {rawRow.panel}</div>
          {cellEntries.length>0&&(
            <div style={{marginBottom:16}}>
              <Lbl>WP & Komponen Terjadwal</Lbl>
              {cellEntries.map(e=>{
                const wc=WP_COLOR[e.wp]||"#64748b";
                return(
                  <div key={e.wp} style={{background:"#f8fafc",borderRadius:8,padding:"10px 12px",marginBottom:8,border:"1px solid #e2e8f0"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                      <span style={{background:wc,color:"#fff",borderRadius:6,padding:"2px 10px",fontSize:12,fontWeight:700}}>{e.wp}</span>
                      <button onClick={()=>removeEntry(e.wp)} style={{background:"none",border:"none",cursor:"pointer",color:"#fca5a5",fontSize:13}}>✕ Hapus</button>
                    </div>
                    <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                      {e.komponen.map(k=>{const item=panelCfg?.wps.flatMap(w=>w.items).find(it=>it.kode===k);return <span key={k} style={{background:wc+"18",color:wc,border:`1px solid ${wc}33`,borderRadius:4,padding:"2px 8px",fontSize:10,fontWeight:600}}>{item?.nama||k}</span>;})}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <div style={{borderTop:"1px solid #f1f5f9",paddingTop:16}}>
            <Lbl>Tambah WP</Lbl>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
              {WP_LIST.map(wp=>{
                const added=cellEntries.some(e=>e.wp===wp);
                const wpDone=isWpDone(livePanelForCell,wp,rawRow?.proses||"");
                const disabled=added||wpDone;const sel=modalWp===wp;const wc=WP_COLOR[wp];
                return(
                  <button key={wp} onClick={()=>{if(!disabled){setModalWp(sel?"":wp);setModalKomponen([]);}}} disabled={disabled}
                    style={{padding:"8px",borderRadius:8,border:`2px solid ${wpDone?"#16a34a":sel?wc:disabled?"#e2e8f0":"#e2e8f0"}`,background:wpDone?"#f0fdf4":sel?wc+"18":disabled?"#f8fafc":"#f8fafc",cursor:disabled?"not-allowed":"pointer",color:wpDone?"#16a34a":sel?wc:disabled?"#cbd5e1":"#64748b",fontWeight:700,fontSize:12,opacity:1,display:"flex",alignItems:"center",gap:6,justifyContent:"center"}}>
                    {wpDone?(<><span>✅</span>{wp}<span style={{fontSize:10,color:"#16a34a"}}>Selesai</span></>):(<><span style={{width:8,height:8,borderRadius:"50%",background:added?"#e2e8f0":wc}}/>{wp} {added?"(terjadwal)":sel?"✓":""}</>)}
                  </button>
                );
              })}
            </div>
            {modalWp&&wpItems.length>0&&(
              <>
                <Lbl>Pilih Komponen {modalWp}</Lbl>
                <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:14}}>
                  {wpItems.map(it=>{
                    const sel=modalKomponen.includes(it.kode);const wc=WP_COLOR[modalWp]||"#64748b";
                    return(<button key={it.kode} onClick={()=>setModalKomponen(prev=>sel?prev.filter(k=>k!==it.kode):[...prev,it.kode])} style={{padding:"6px 12px",borderRadius:8,border:`1.5px solid ${sel?wc:"#e2e8f0"}`,background:sel?wc+"18":"#f8fafc",color:sel?wc:"#64748b",cursor:"pointer",fontSize:11,fontWeight:600}}>{sel?"✓ ":""}{it.nama}<span style={{fontSize:10,color:"#94a3b8",marginLeft:4}}>({it.kode})</span></button>);
                  })}
                </div>
                <Btn color="#1d4ed8" style={{width:"100%"}} onClick={addEntry} disabled={!modalKomponen.length}>+ Tambah {modalWp} ({modalKomponen.length} komponen)</Btn>
              </>
            )}
          </div>
          <div style={{marginTop:16,display:"flex",justifyContent:"flex-end"}}>
            <Btn color="#16a34a" onClick={()=>setCellModal(null)}>Selesai</Btn>
          </div>
        </Modal>
      )}

      {assignModal&&(()=>{
        const{task,divisi,existing}=assignModal;const dc=DIVISI_CONFIG[divisi];
        const pekerjaDivisi=pekerja.filter(p=>p.divisi===divisi);
        return(
          <Modal title={`${assignModal.isExisting?"Edit":"Distribusi"} Pekerja — ${task.proses}`} onClose={()=>{setAssignModal(null);setSelPekerja([]);}} width={460}>
            <div style={{fontSize:12,color:"#64748b",marginBottom:4}}>{task.proyek} · {task.panel}</div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:16}}>
              <Badge label={task.proses} color={PROSES_COLOR[task.proses]||"#64748b"}/>
              <Badge label={`${task.wp}`} color={WP_COLOR[task.wp]||"#64748b"}/>
              <Badge label={dc.label} color={dc.color}/>
            </div>
            <Lbl>Pilih Pekerja ({dc.label})</Lbl>
            {pekerjaDivisi.length===0?(
              <div style={{padding:"16px",background:"#f8fafc",borderRadius:8,fontSize:12,color:"#94a3b8",textAlign:"center"}}>Belum ada pekerja di divisi {dc.label}.</div>
            ):(
              <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:16}}>
                {pekerjaDivisi.map(p=>{
                  const isSel=selPekerja.includes(p.id);
                  return(
                    <div key={p.id} onClick={()=>setSelPekerja(prev=>isSel?prev.filter(id=>id!==p.id):[...prev,p.id])}
                      style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",borderRadius:10,cursor:"pointer",border:`1.5px solid ${isSel?dc.color:"#e2e8f0"}`,background:isSel?dc.bg:"#f8fafc",transition:"all .15s"}}>
                      <div style={{width:28,height:28,borderRadius:8,background:isSel?dc.color:dc.bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,flexShrink:0}}>{isSel?"✓":dc.icon}</div>
                      <span style={{fontWeight:isSel?700:500,fontSize:13,color:isSel?dc.color:"#475569"}}>{p.nama}</span>
                    </div>
                  );
                })}
              </div>
            )}
            {selPekerja.length>0&&(
              <div style={{padding:"8px 12px",background:"#f0fdf4",borderRadius:8,marginBottom:14,fontSize:12,color:"#16a34a",fontWeight:600}}>
                ✓ {selPekerja.length} pekerja dipilih: {selPekerja.map(id=>pekerja.find(p=>p.id===id)?.nama).filter(Boolean).join(", ")}
              </div>
            )}
            <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
              <Btn outline color="#64748b" onClick={()=>{setAssignModal(null);setSelPekerja([]);}}>Batal</Btn>
              <Btn color="#1d4ed8" onClick={confirmDistribute}>{assignModal.isExisting?"Simpan Perubahan":"Distribusi"}</Btn>
            </div>
          </Modal>
        );
      })()}

      {dragMode&&(
        <Modal title="Pindah atau Copy?" onClose={()=>setDragMode(null)} width={360}>
          <div style={{fontSize:13,color:"#475569",marginBottom:16}}>Dari <strong>{getDayLabel(dragMode.fromDate)}</strong> ke <strong>{getDayLabel(dragMode.toDate)}</strong></div>
          <div style={{display:"flex",gap:10}}>
            <Btn color="#dc2626" style={{flex:1}} onClick={()=>confirmDrag("move")}>📦 Pindah</Btn>
            <Btn color="#2563eb" style={{flex:1}} onClick={()=>confirmDrag("copy")}>📋 Copy</Btn>
          </div>
        </Modal>
      )}

      {addModal&&(
        <Modal title="Tambah Panel ke Raw Schedule" onClose={()=>setAddModal(false)} width={480}>
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <div><Lbl>Work Order</Lbl>
              <Sel value={addForm.woId} onChange={e=>setAddForm({...addForm,woId:e.target.value,panelId:""})}>
                <option value="">-- Pilih WO --</option>
                {woData.map(w=><option key={w.id} value={w.id}>WO {w.wo} — {w.proyek}</option>)}
              </Sel>
            </div>
            <div><Lbl>Panel</Lbl>
              <Sel value={addForm.panelId} onChange={e=>setAddForm({...addForm,panelId:e.target.value})}>
                <option value="">-- Pilih Panel --</option>
                {panelOpts.map(p=><option key={p.id} value={p.id}>#{p.no_pnl||p.noPnl} — {p.nama}</option>)}
              </Sel>
            </div>
            <div><Lbl>Prioritas</Lbl>
              <Sel value={addForm.prioritas} onChange={e=>setAddForm({...addForm,prioritas:e.target.value})}>
                {PRIORITAS.map(p=><option key={p} value={p}>{p}</option>)}
              </Sel>
            </div>
          </div>
          <div style={{display:"flex",gap:10,marginTop:20,justifyContent:"flex-end"}}>
            <Btn outline color="#64748b" onClick={()=>setAddModal(false)}>Batal</Btn>
            <Btn color="#1d4ed8" onClick={submitAdd}>Tambah Panel</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}
