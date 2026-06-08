file_path = r"C:\Users\User\vista-teknik\src\App.tsx"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

with open(file_path + ".bak_review_harian", "w", encoding="utf-8") as f:
    f.write(content)
print("[OK] Backup dibuat")

OLD = """          {dateTasks.map((t,i)=>{
            const pc=PROSES_COLOR[t.proses]||"#475569";
            const wc=WP_COLOR[t.wp]||"#64748b";
            const priColor=PRIORITAS_COLOR[t.prioritas]||"#64748b";
            const panelData=woData.flatMap(w=>w.panels||[]).find(p=>p.id===t.panelId);
            const cfg2=panelData?PANEL_TYPES[panelData.tipe]:null;
            const status=getTaskStatus(t,t.tanggal,t.wp,t.komponen);
            const statusColor=status==="finish"?"#16a34a":status==="on_progress"?"#f59e0b":"#64748b";
            const statusLabel=status==="finish"?"\u2713 Finish":status==="on_progress"?"\u25cf On Progress":"\u25cb Belum Mulai";
            const taskKey=`${t.rawId}-${t.wp}-${t.tanggal}`;
            const isExpanded=expandedTasks[taskKey];
            const grouped={finish:[],on_progress:[],belum_mulai:[]};
            t.komponen.forEach(k=>{
              const s=getKomponenStatus(t.panelId,t.proses,k);
              const item=cfg2?.wps.flatMap(w=>w.items).find(it=>it.kode===k);
              grouped[s].push({kode:k,nama:item?.nama||k});
            });
            const statusGroups=[
              {key:"finish",label:"\u2713 Finish",color:"#16a34a",bg:"#f0fdf4",border:"#bbf7d0"},
              {key:"on_progress",label:"\u25cf On Progress",color:"#f59e0b",bg:"#fffbeb",border:"#fde68a"},
              {key:"belum_mulai",label:"\u25cb Belum Mulai",color:"#64748b",bg:"#f8fafc",border:"#e2e8f0"},
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
                    {isExpanded?"\u25b2 Tutup":"\u25bc Detail Status"}
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
          })}"""

NEW = """          {(()=>{
            const panelGroupMap:Record<string,any[]>={};
            dateTasks.forEach(t=>{
              const gk=`${t.proyek}__${t.panel}__${t.panelId}`;
              if(!panelGroupMap[gk])panelGroupMap[gk]=[];
              panelGroupMap[gk].push(t);
            });
            return Object.entries(panelGroupMap).map(([gk,tasks],gi)=>{
              const t0=tasks[0];
              const cardKey=`panelcard__${gk}__${selDate}`;
              const isExpanded=expandedTasks[cardKey];
              const panelData=woData.flatMap(w=>w.panels||[]).find(p=>p.id===t0.panelId);
              const cfg2=panelData?PANEL_TYPES[panelData.tipe]:null;
              const allSt=tasks.map(t=>getTaskStatus(t,t.tanggal,t.wp,t.komponen));
              const overallSt=allSt.every(s=>s==="finish")?"finish":allSt.some(s=>s==="on_progress"||s==="finish")?"on_progress":"belum_mulai";
              const stColor=overallSt==="finish"?"#16a34a":overallSt==="on_progress"?"#f59e0b":"#64748b";
              const stLabel=overallSt==="finish"?"\u2713 Finish":overallSt==="on_progress"?"\u25cf On Progress":"\u25cb Belum Mulai";
              return(
                <div key={gi} style={{padding:"10px 14px",borderRadius:10,marginBottom:8,background:"#fff",border:`1.5px solid ${stColor}40`}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                    <div style={{flex:1,minWidth:160}}>
                      <div style={{fontWeight:700,fontSize:13,color:"#1e293b"}}>{t0.proyek}</div>
                      <div style={{fontSize:11,color:"#64748b"}}>{t0.panel}</div>
                    </div>
                    <div style={{display:"flex",gap:4,flexWrap:"wrap",alignItems:"center"}}>
                      {tasks.map((t,ti)=>{
                        const pc=PROSES_COLOR[t.proses]||"#475569";
                        const wc=WP_COLOR[t.wp]||"#64748b";
                        const tSt=getTaskStatus(t,t.tanggal,t.wp,t.komponen);
                        const tDot=tSt==="finish"?"#16a34a":tSt==="on_progress"?"#f59e0b":"#94a3b8";
                        return(
                          <span key={ti} style={{display:"inline-flex",gap:3,alignItems:"center",background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:6,padding:"2px 7px"}}>
                            <span style={{width:6,height:6,borderRadius:"50%",background:tDot,flexShrink:0}}/>
                            <Badge label={t.proses} color={pc}/>
                            <span style={{background:wc,color:"#fff",borderRadius:4,padding:"1px 6px",fontSize:10,fontWeight:700}}>{t.wp}</span>
                          </span>
                        );
                      })}
                      <Badge label={t0.prioritas||"Sedang"} color={PRIORITAS_COLOR[t0.prioritas]||"#64748b"}/>
                      <span style={{fontSize:11,fontWeight:700,color:stColor,whiteSpace:"nowrap"}}>{stLabel}</span>
                    </div>
                    <button onClick={()=>setExpandedTasks(prev=>({...prev,[cardKey]:!prev[cardKey]}))}
                      style={{background:"#f8fafc",border:"1px solid #e2e8f0",color:"#475569",borderRadius:7,padding:"4px 10px",cursor:"pointer",fontSize:11,fontWeight:600,display:"flex",alignItems:"center",gap:4,whiteSpace:"nowrap",flexShrink:0}}>
                      {isExpanded?"\u25b2 Tutup":"\u25bc Detail"}
                    </button>
                  </div>
                  {isExpanded&&(
                    <div style={{marginTop:10,paddingTop:10,borderTop:"1px dashed #e2e8f0",display:"flex",flexDirection:"column",gap:8}}>
                      {tasks.map((t,ti)=>{
                        const pc=PROSES_COLOR[t.proses]||"#475569";
                        const wc=WP_COLOR[t.wp]||"#64748b";
                        const tSt=getTaskStatus(t,t.tanggal,t.wp,t.komponen);
                        const tColor=tSt==="finish"?"#16a34a":tSt==="on_progress"?"#f59e0b":"#64748b";
                        const tLabel=tSt==="finish"?"\u2713 Finish":tSt==="on_progress"?"\u25cf On Progress":"\u25cb Belum Mulai";
                        const grp:{finish:any[],on_progress:any[],belum_mulai:any[]}={finish:[],on_progress:[],belum_mulai:[]};
                        t.komponen.forEach(k=>{
                          const s=getKomponenStatus(t.panelId,t.proses,k);
                          const item=cfg2?.wps.flatMap(w=>w.items).find(it=>it.kode===k);
                          grp[s as keyof typeof grp].push({kode:k,nama:item?.nama||k});
                        });
                        const stGroups=[
                          {key:"finish",label:"\u2713 Finish",color:"#16a34a",bg:"#f0fdf4",border:"#bbf7d0"},
                          {key:"on_progress",label:"\u25cf On Progress",color:"#f59e0b",bg:"#fffbeb",border:"#fde68a"},
                          {key:"belum_mulai",label:"\u25cb Belum Mulai",color:"#64748b",bg:"#f8fafc",border:"#e2e8f0"},
                        ];
                        return(
                          <div key={ti} style={{background:"#f8fafc",borderRadius:8,padding:"8px 12px",border:`1px solid ${tColor}30`}}>
                            <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6,flexWrap:"wrap"}}>
                              <Badge label={t.proses} color={pc}/>
                              <span style={{background:wc,color:"#fff",borderRadius:5,padding:"2px 8px",fontSize:11,fontWeight:700}}>{t.wp}</span>
                              <span style={{fontSize:11,fontWeight:700,color:tColor}}>{tLabel}</span>
                            </div>
                            <div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:4}}>
                              {t.komponen.map(k=>{const item=cfg2?.wps.flatMap(w=>w.items).find(it=>it.kode===k);return <span key={k} style={{background:"#e2e8f0",borderRadius:4,padding:"2px 8px",fontSize:10,color:"#475569",fontWeight:600}}>{item?.nama||k}</span>;})}
                            </div>
                            <div style={{display:"flex",flexDirection:"column",gap:4}}>
                              {stGroups.filter(g=>grp[g.key as keyof typeof grp].length>0).map(g=>(
                                <div key={g.key} style={{background:g.bg,border:`1px solid ${g.border}`,borderRadius:6,padding:"6px 10px"}}>
                                  <div style={{fontWeight:800,fontSize:10,color:g.color,marginBottom:4,letterSpacing:.3}}>{g.label} ({grp[g.key as keyof typeof grp].length})</div>
                                  <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                                    {grp[g.key as keyof typeof grp].map(it=>(<span key={it.kode} style={{background:"#fff",border:`1px solid ${g.border}`,borderRadius:5,padding:"2px 8px",fontSize:10,fontWeight:600,color:"#475569"}}>{it.nama}</span>))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            });
          })()}"""

if OLD in content:
    content = content.replace(OLD, NEW)
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)
    print("[OK] Review Harian diupdate: 1 card per panel + expand detail proses")
    print("[INFO] Jalankan: npm run build")
else:
    print("[FAIL] Masih tidak cocok, dump baris 3765-3830 untuk debug:")
    lines = content.split("\n")
    for i in range(3764, min(3830, len(lines))):
        print(f"  {i+1}: {repr(lines[i])}")
