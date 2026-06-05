from pathlib import Path

APP_PATH = Path(r"C:\Users\User\vista-teknik\src\App.tsx")
content = APP_PATH.read_text(encoding="utf-8")

old = """                          {prosesPanel.map(pr=>{
                            if(pr!=="BUSBAR") return <td key={pr} style={{...tdS,background:"#f0fdfe",color:"#e2e8f0",fontSize:9}}>—</td>;
                            // Buat fake cl object untuk tooltip
                            const fakeCl={
                              progress:{BUSBAR:pct},
                              history:{BUSBAR:p.busbar_history?.[nama]||[]}
                            };
                            return <ProsesPctCell key={pr} pct={pct} proses={pr} cl={fakeCl} nama={nama}/>;
                          })}"""

new = """                          {prosesPanel.map(pr=>{
                            if(pr!=="BUSBAR") return <td key={pr} style={{...tdS,background:"#f0fdfe",color:"#e2e8f0",fontSize:9}}>—</td>;
                            const isDone=pct>=100;
                            const color=PROSES_COLOR["BUSBAR"]||"#06b6d4";
                            return(
                              <td key={pr} style={{...tdS,background:"#f0fdfe"}} className="hist-cell">
                                <div style={{display:"flex",flexDirection:"column" as const,alignItems:"center",gap:2,position:"relative" as const}}>
                                  <div style={{width:44,height:3,background:"#e2e8f0",borderRadius:99,overflow:"hidden"}}>
                                    <div style={{width:pct+"%",height:"100%",background:isDone?"#16a34a":color,borderRadius:99}}/>
                                  </div>
                                  <span style={{fontSize:9,fontWeight:700,color:isDone?"#16a34a":pct>0?color:"#94a3b8"}}>{pct}%</span>
                                  {pct>0&&(
                                    <div className="hist-tooltip" style={{
                                      opacity:0,visibility:"hidden" as const,
                                      position:"absolute" as const,bottom:"100%",left:"50%",
                                      transform:"translateX(-50%)",
                                      background:"#1e293b",color:"#f1f5f9",
                                      borderRadius:8,padding:"8px 12px",
                                      fontSize:10,whiteSpace:"nowrap" as const,
                                      zIndex:999,marginBottom:6,
                                      boxShadow:"0 4px 16px #00000030",
                                      minWidth:140,
                                    }}>
                                      <div style={{fontWeight:700,color:color,marginBottom:4,borderBottom:"1px solid #334155",paddingBottom:3}}>
                                        {nama}
                                      </div>
                                      <div style={{display:"flex",justifyContent:"space-between",gap:8}}>
                                        <span style={{color:"#94a3b8"}}>Progress</span>
                                        <span style={{color:isDone?"#4ade80":"#fb923c",fontWeight:700}}>{pct}%</span>
                                      </div>
                                      <div style={{position:"absolute" as const,bottom:-5,left:"50%",transform:"translateX(-50%)",width:0,height:0,borderLeft:"5px solid transparent",borderRight:"5px solid transparent",borderTop:"5px solid #1e293b"}}/>
                                    </div>
                                  )}
                                </div>
                              </td>
                            );
                          })}"""

if old in content:
    content = content.replace(old, new)
    APP_PATH.write_text(content, encoding="utf-8")
    print("✅ Busbar simple tooltip added!")
else:
    print("❌ Not found!")
