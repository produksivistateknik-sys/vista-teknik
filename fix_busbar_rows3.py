from pathlib import Path

APP_PATH = Path(r"C:\Users\User\vista-teknik\src\App.tsx")
content = APP_PATH.read_text(encoding="utf-8")

old = """                  {/* Busbar rows */}
                  {hasBusbar&&(()=>{
                    const busbarKomps=getBusbarKomponen(p.tipe);
                    const busbarData={...Object.fromEntries(busbarKomps.map((k:string)=>[k,0])),...(p.busbar_progress||{})};
                    return Object.keys(busbarData).length>0;
                  })()&&(
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
                      {Object.entries({...Object.fromEntries(getBusbarKomponen(p.tipe).map((k:string)=>[k,0])),...(p.busbar_progress||{})}).map(([nama,pct]:any)=>("""

new = """                  {/* Busbar rows - dari busbar_schedule + busbar_progress */}
                  {(()=>{
                    // Kumpulkan komponen busbar dari raw_schedule busbar_schedule
                    const scheduled=(rawData||[])
                      .filter((r:any)=>r.proses==="BUSBAR"&&Number(r.panel_id||r.panelId)===Number(p.id))
                      .flatMap((r:any)=>Object.values(r.busbar_schedule||{}).flat() as string[]);
                    const fromProgress=Object.keys(p.busbar_progress||{});
                    const busbarKomps=[...new Set([...scheduled,...fromProgress])];
                    if(!busbarKomps.length) return null;
                    const busbarData=Object.fromEntries(busbarKomps.map((k:string)=>
                      [k,(p.busbar_progress||{})[k]||0]
                    ));
                    return(
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
                      {Object.entries(busbarData).map(([nama,pct]:any)=>("""

if old in content:
    content = content.replace(old, new)
    print("✅ Busbar rows updated!")
else:
    print("❌ Not found!")

# Fix closing tag
old_close = """                      ))}
                    </>
                  )}"""
new_close = """                      ))}
                    </>
                    );
                  })()}"""

if old_close in content:
    content = content.replace(old_close, new_close)
    print("✅ Closing tag fixed!")
else:
    print("❌ Closing not found!")

APP_PATH.write_text(content, encoding="utf-8")
print("\n✅ Selesai!")
