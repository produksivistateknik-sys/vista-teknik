from pathlib import Path

APP_PATH = Path(r"C:\Users\User\vista-teknik\src\App.tsx")
content = APP_PATH.read_text(encoding="utf-8")

# 1. Pass rawData ke DetailProgress
old_call = '{tab==="detail"&&<DetailProgress woData={woData}/>}'
new_call = '{tab==="detail"&&<DetailProgress woData={woData} rawData={rawData}/>}'

if old_call in content:
    content = content.replace(old_call, new_call)
    print("✅ rawData passed to DetailProgress!")
else:
    print("❌ Not found!")

# 2. Update DetailProgress function signature
old_sig = 'function DetailProgress({woData}:{woData:any[]})'
new_sig = 'function DetailProgress({woData,rawData}:{woData:any[],rawData:any[]})'

if old_sig in content:
    content = content.replace(old_sig, new_sig)
    print("✅ DetailProgress signature updated!")
else:
    print("❌ Signature not found!")

# 3. Update busbar rows condition - ambil dari busbar_schedule
old_cond = """                  {/* Busbar rows - hanya tampil jika ada progress */}
                  {Object.keys(p.busbar_progress||{}).length>0&&("""

new_cond = """                  {/* Busbar rows - ambil dari busbar_schedule */}
                  {(()=>{
                    const scheduled=rawData
                      .filter((r:any)=>r.proses==="BUSBAR"&&Number(r.panel_id||r.panelId)===Number(p.id))
                      .flatMap((r:any)=>Object.values(r.busbar_schedule||{}).flat() as string[]);
                    const fromProgress=Object.keys(p.busbar_progress||{});
                    const busbarKomps=[...new Set([...scheduled,...fromProgress])];
                    if(!busbarKomps.length) return null;
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
                      {busbarKomps.map((nama:string)=>{
                        const pct=(p.busbar_progress||{})[nama]||0;
                        const isDone=pct>=100;
                        const color=PROSES_COLOR["BUSBAR"]||"#06b6d4";
                        return(
                          <tr key={"busbar-"+nama}>
                            <td style={{...tdS,background:"#f0fdfe"}}></td>
                            <td style={{...tdSL,background:"#f0fdfe",color:"#0e7490",fontWeight:600}}>{nama}</td>
                            <td style={{...tdS,background:"#f0fdfe",color:"#94a3b8",fontSize:9}}>BUSBAR</td>
                            <td style={{...tdS,background:"#f0fdfe"}}>—</td>
                            {prosesPanel.map(pr=>{
                              if(pr!=="BUSBAR") return <td key={pr} style={{...tdS,background:"#f0fdfe",color:"#e2e8f0",fontSize:9}}>—</td>;
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
                        );
                      })}
                    </>
                    );
                  })()}
                  {false&&("""

if old_cond in content:
    content = content.replace(old_cond, new_cond)
    print("✅ Busbar rows updated!")
else:
    print("❌ Condition not found!")

# Hapus closing tag lama yang tidak perlu
old_close = """                  {false&&(
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
                      {Object.entries(p.busbar_progress||{}).length>0 ? Object.entries(p.busbar_progress).map(([nama,pct]:any)=>("""

# Ini mungkin ada sisa dari fix sebelumnya, skip dulu
APP_PATH.write_text(content, encoding="utf-8")
print("\n✅ Selesai!")
