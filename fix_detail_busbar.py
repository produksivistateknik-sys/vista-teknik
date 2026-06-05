from pathlib import Path

APP_PATH = Path(r"C:\Users\User\vista-teknik\src\App.tsx")
content = APP_PATH.read_text(encoding="utf-8")

# Cari exact pattern dari baris 2888-2896
old = """                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function RawSchedule("""

new = """                  {/* Busbar rows */}
                  {p.busbar_progress&&Object.keys(p.busbar_progress).length>0&&(
                    <>
                      <tr>
                        <td colSpan={4+prosesPanel.length} style={{background:"#06b6d418",padding:"4px 10px",
                          borderBottom:"1px solid #e2e8f0",borderTop:"2px solid #06b6d4"}}>
                          <span style={{fontWeight:700,fontSize:10,color:"#06b6d4",
                            textTransform:"uppercase" as const,letterSpacing:.5}}>
                            🔌 Komponen Busbar
                          </span>
                        </td>
                      </tr>
                      {Object.entries(p.busbar_progress).map(([nama,pct]:any)=>(
                        <tr key={"busbar-"+nama}>
                          <td style={{...tdS,background:"#f0fdfe"}}></td>
                          <td style={{...tdSL,background:"#f0fdfe",color:"#0e7490",fontWeight:600}}>{nama}</td>
                          <td style={{...tdS,background:"#f0fdfe",color:"#94a3b8",fontSize:9}}>BUSBAR</td>
                          <td style={{...tdS,background:"#f0fdfe"}}>—</td>
                          {prosesPanel.map(pr=>{
                            if(pr!=="BUSBAR") return <td key={pr} style={{...tdS,background:"#f0fdfe",color:"#e2e8f0",fontSize:9}}>—</td>;
                            const isDone=pct>=100;
                            const color=PROSES_COLOR["BUSBAR"]||"#06b6d4";
                            return(
                              <td key={pr} style={{...tdS,background:"#f0fdfe"}}>
                                <div style={{display:"flex",flexDirection:"column" as const,alignItems:"center",gap:2}}>
                                  <div style={{width:44,height:3,background:"#e2e8f0",borderRadius:99,overflow:"hidden"}}>
                                    <div style={{width:pct+"%",height:"100%",background:isDone?"#16a34a":color,borderRadius:99}}/>
                                  </div>
                                  <span style={{fontSize:9,fontWeight:700,color:isDone?"#16a34a":pct>0?color:"#94a3b8"}}>{pct}%</span>
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function RawSchedule("""

if old in content:
    content = content.replace(old, new)
    APP_PATH.write_text(content, encoding="utf-8")
    print("✅ Busbar rows added to DetailProgress!")
else:
    print("❌ Not found!")
    lines = content.splitlines()
    for i, l in enumerate(lines[2885:2900], 2886):
        print(f"  {i}: {repr(l)}")
