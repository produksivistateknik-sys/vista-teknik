from pathlib import Path
import re

APP_PATH = Path(r"C:\Users\User\vista-teknik\src\App.tsx")
content = APP_PATH.read_text(encoding="utf-8")

# Cari ProsesPctCell di DetailProgress dan tambah tooltip
old_cell = """  const ProsesPctCell=({pct,proses}:{pct:number|undefined,proses:string})=>{
    if(pct===undefined||pct===null) return <td style={{...tdS,color:"#e2e8f0",fontSize:9}}>—</td>;
    const color=(PROSES_COLOR as any)[proses]||"#94a3b8";
    const isDone=pct===100;
    return(
      <td style={tdS}>
        <div style={{display:"flex",flexDirection:"column" as const,alignItems:"center",gap:2}}>
          <div style={{width:44,height:3,background:"#e2e8f0",borderRadius:99,overflow:"hidden"}}>
            <div style={{width:pct+"%",height:"100%",background:isDone?"#16a34a":color,borderRadius:99}}/>
          </div>
          <span style={{fontSize:9,fontWeight:700,color:isDone?"#16a34a":pct>0?color:"#94a3b8"}}>{pct}%</span>
        </div>
      </td>
    );
  };"""

new_cell = """  const ProsesPctCell=({pct,proses,cl,nama}:{pct:number|undefined,proses:string,cl?:any,nama?:string})=>{
    if(pct===undefined||pct===null) return <td style={{...tdS,color:"#e2e8f0",fontSize:9}}>—</td>;
    const color=(PROSES_COLOR as any)[proses]||"#94a3b8";
    const isDone=pct===100;
    const history=cl?.history?.[proses]||[];
    return(
      <td style={tdS} className="hist-cell">
        <div style={{display:"flex",flexDirection:"column" as const,alignItems:"center",gap:2,position:"relative" as const}}>
          <div style={{width:44,height:3,background:"#e2e8f0",borderRadius:99,overflow:"hidden"}}>
            <div style={{width:pct+"%",height:"100%",background:isDone?"#16a34a":color,borderRadius:99}}/>
          </div>
          <span style={{fontSize:9,fontWeight:700,color:isDone?"#16a34a":pct>0?color:"#94a3b8"}}>{pct}%</span>
          {history.length>0&&(
            <div className="hist-tooltip" style={{
              opacity:0,visibility:"hidden" as const,
              position:"absolute" as const,bottom:"100%",left:"50%",
              transform:"translateX(-50%)",
              background:"#1e293b",color:"#f1f5f9",
              borderRadius:8,padding:"8px 12px",
              fontSize:10,whiteSpace:"nowrap" as const,
              zIndex:999,marginBottom:6,
              boxShadow:"0 4px 16px #00000030",
              transition:"opacity .15s",
              minWidth:180,
            }}>
              <div style={{fontWeight:700,fontSize:11,marginBottom:6,color:color,borderBottom:"1px solid #334155",paddingBottom:4}}>
                {proses}{nama?" — "+nama:""}
              </div>
              {[...history].sort((a:any,b:any)=>a.tanggal?.localeCompare(b.tanggal)).map((h:any,hi:number)=>(
                <div key={hi} style={{display:"flex",justifyContent:"space-between",gap:12,padding:"2px 0",borderBottom:hi<history.length-1?"1px solid #334155":"none"}}>
                  <span style={{color:"#94a3b8"}}>📅 {new Date(h.tanggal).toLocaleDateString("id-ID",{day:"numeric",month:"short",year:"numeric"})}</span>
                  <span style={{color:"#fbbf24"}}>Shift {h.shift}</span>
                  <span style={{color:h.pct>=100?"#4ade80":h.pct>0?"#fb923c":"#94a3b8",fontWeight:700}}>{h.pct}%</span>
                </div>
              ))}
              <div style={{position:"absolute" as const,bottom:-5,left:"50%",transform:"translateX(-50%)",width:0,height:0,borderLeft:"5px solid transparent",borderRight:"5px solid transparent",borderTop:"5px solid #1e293b"}}/>
            </div>
          )}
        </div>
      </td>
    );
  };"""

if old_cell in content:
    content = content.replace(old_cell, new_cell)
    print("✅ ProsesPctCell tooltip added in DetailProgress")
else:
    print("❌ ProsesPctCell not found in DetailProgress")

# Update pemanggilan ProsesPctCell di DetailProgress - tambah cl dan nama
old_call = "              {prosesPanel.map(pr=><ProsesPctCell key={pr} pct={pd[pr]} proses={pr}/>)}"
new_call = """              {prosesPanel.map(pr=>{
                const cl2=p.checklist?.[it.kode];
                return <ProsesPctCell key={pr} pct={pd[pr]} proses={pr} cl={cl2} nama={it.nama||it.komponen||it.name}/>;
              })}"""

if old_call in content:
    content = content.replace(old_call, new_call)
    print("✅ ProsesPctCell call updated with cl and nama")
else:
    print("❌ ProsesPctCell call not found")
    # cari yang ada
    lines = content.splitlines()
    for i, l in enumerate(lines):
        if 'ProsesPctCell' in l and 'pct={pd' in l:
            print(f"  Found at {i+1}: {l.strip()[:80]}")

APP_PATH.write_text(content, encoding="utf-8")
print("\n✅ Selesai!")
