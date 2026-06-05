from pathlib import Path

APP_PATH = Path(r"C:\Users\User\vista-teknik\src\App.tsx")
content = APP_PATH.read_text(encoding="utf-8")

old = """                            <div onClick={()=>openCellModal(row.id,d)}
                              style={{width:"100%",height:32,borderRadius:6,cursor:"pointer",border:"1px dashed #e2e8f0",display:"flex",alignItems:"center",justifyContent:"center",color:"#e2e8f0",fontSize:16,transition:"all .15s"}}
                              onMouseEnter={e=>{e.target.style.borderColor="#94a3b8";e.target.style.color="#94a3b8";}}
                              onMouseLeave={e=>{e.target.style.borderColor="#e2e8f0";e.target.style.color="#e2e8f0";}}>+</div>"""

new = """                            <div onClick={()=>openCellModal(row.id,d)}
                              style={{width:"100%",minHeight:32,borderRadius:6,cursor:"pointer",border:"1px dashed #e2e8f0",display:"flex",flexDirection:"column" as const,alignItems:"center",justifyContent:"center",color:"#e2e8f0",fontSize:16,transition:"all .15s",padding:"2px"}}
                              onMouseEnter={(e:any)=>{e.currentTarget.style.borderColor="#94a3b8";e.currentTarget.style.color="#94a3b8";}}
                              onMouseLeave={(e:any)=>{e.currentTarget.style.borderColor="#e2e8f0";e.currentTarget.style.color="#e2e8f0";}}>
                              {row.proses==="BUSBAR"&&busbarEntries.length>0?(
                                <div style={{display:"flex",gap:2,flexWrap:"wrap" as const,justifyContent:"center"}}>
                                  {busbarEntries.map((b:string)=>(
                                    <span key={b} style={{background:(BUSBAR_COLORS[b]||"#64748b")+"22",
                                      color:BUSBAR_COLORS[b]||"#64748b",
                                      border:`1px solid ${BUSBAR_COLORS[b]||"#64748b"}44`,
                                      borderRadius:4,padding:"1px 4px",fontSize:8,fontWeight:700}}>
                                      {b}
                                    </span>
                                  ))}
                                </div>
                              ):(
                                <span>+</span>
                              )}
                            </div>"""

if old in content:
    content = content.replace(old, new)
    APP_PATH.write_text(content, encoding="utf-8")
    print("✅ Busbar badges in empty cell added!")
else:
    print("❌ Not found!")
