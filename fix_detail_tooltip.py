from pathlib import Path

APP_PATH = Path(r"C:\Users\User\vista-teknik\src\App.tsx")
content = APP_PATH.read_text(encoding="utf-8")

old = """                          {prosesPanel.map(pr=>{
                            const pct=cl?.progress?.[pr]??cl?.qtyProses?.[pr]??0;
                            const color=(PROSES_COLOR as any)[pr]||"#94a3b8";
                            const isDone=pct===100;
                            return(
                              <td key={pr} style={{...tdS,background:rowBg}}>
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
                            const pct=cl?.progress?.[pr]??cl?.qtyProses?.[pr]??0;
                            return <ProsesPctCell key={pr} pct={pct} proses={pr} cl={cl} nama={it.nama||it.komponen||it.name}/>;
                          })}"""

if old in content:
    content = content.replace(old, new)
    APP_PATH.write_text(content, encoding="utf-8")
    print("✅ DetailProgress tooltip fixed!")
else:
    print("❌ Not found!")
