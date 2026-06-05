from pathlib import Path

APP_PATH = Path(r"C:\Users\User\vista-teknik\src\App.tsx")
content = APP_PATH.read_text(encoding="utf-8")

# Ganti cell busbar dengan ProsesPctCell yang sudah ada tooltip
old = """                          {prosesPanel.map(pr=>{
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
                          })}"""

new = """                          {prosesPanel.map(pr=>{
                            if(pr!=="BUSBAR") return <td key={pr} style={{...tdS,background:"#f0fdfe",color:"#e2e8f0",fontSize:9}}>—</td>;
                            // Buat fake cl object untuk tooltip
                            const fakeCl={
                              progress:{BUSBAR:pct},
                              history:{BUSBAR:p.busbar_history?.[nama]||[]}
                            };
                            return <ProsesPctCell key={pr} pct={pct} proses={pr} cl={fakeCl} nama={nama}/>;
                          })}"""

if old in content:
    content = content.replace(old, new)
    APP_PATH.write_text(content, encoding="utf-8")
    print("✅ Busbar tooltip added!")
else:
    print("❌ Not found!")
