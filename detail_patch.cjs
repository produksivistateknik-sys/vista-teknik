const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

const newDetail = `function DetailProgress({woData}:{woData:any[]}){
  const [search,setSearch]=useState("");
  const [woFilter,setWoFilter]=useState("semua");
  const [statusFilter,setStatusFilter]=useState("semua");

  const PROSES_LIST=["POTONG","BENDING","STEL","PAINTING","RAKIT","PASANG KOMPONEN","BUSBAR","WIRING CONTROL","WIRING POWER","QC TEST","PACKING"];

  const allPanels=woData.flatMap(wo=>(wo.panels||[]).map((p:any)=>({
    ...p,
    wo:wo.wo,
    woId:wo.id,
    proyek:wo.proyek,
    target:wo.target,
    pd:calcPanelProgress(p),
  })));

  const filtered=allPanels.filter(p=>{
    const pct=panelOverall(p);
    const s=pct===100?"selesai":isDelayed(p.target)?"terlambat":isUrgent(p.target)?"mendesak":"ontrack";
    const matchS=statusFilter==="semua"||statusFilter===s;
    const matchWO=woFilter==="semua"||p.wo===woFilter;
    const matchQ=!search||
      (p.nama||"").toLowerCase().includes(search.toLowerCase())||
      (p.proyek||"").toLowerCase().includes(search.toLowerCase())||
      (p.wo||"").toLowerCase().includes(search.toLowerCase());
    return matchS&&matchWO&&matchQ;
  });

  const thS={background:"#1e3a5f",color:"#fff",fontWeight:600,padding:"7px 10px",
    textAlign:"center" as const,fontSize:9,textTransform:"uppercase" as const,
    letterSpacing:.3,borderBottom:"1px solid #1e3a5f",whiteSpace:"nowrap" as const,
    borderRight:"1px solid rgba(255,255,255,.1)"};
  const thSL={...thS,textAlign:"left" as const};
  const tdS={padding:"7px 10px",borderBottom:"1px solid #f5f7fa",
    color:"#374151",verticalAlign:"middle" as const,fontSize:11,
    borderRight:"1px solid #f5f7fa",textAlign:"center" as const};
  const tdSL={...tdS,textAlign:"left" as const};

  if(!woData.length) return(
    <div style={{textAlign:"center",padding:"60px 20px",color:"#94a3b8"}}>
      <div style={{fontSize:40,marginBottom:12}}>🔍</div>
      <div style={{fontSize:14,fontWeight:600,color:"#1e293b"}}>Belum ada data</div>
    </div>
  );

  const totalPanel=allPanels.length;
  const avgOverall=totalPanel?Math.round(allPanels.reduce((a,p)=>a+panelOverall(p),0)/totalPanel):0;
  const selesai=allPanels.filter(p=>panelOverall(p)===100).length;
  const terlambat=allPanels.filter(p=>isDelayed(p.target)&&panelOverall(p)<100).length;

  const ProsesPctCell=({pct,proses}:{pct:number|undefined,proses:string})=>{
    if(pct===undefined||pct===null) return <td style={{...tdS,color:"#e2e8f0",fontSize:9}}>—</td>;
    const color=(PROSES_COLOR as any)[proses]||"#94a3b8";
    const isDone=pct===100;
    return(
      <td style={tdS}>
        <div style={{display:"flex",flexDirection:"column" as const,alignItems:"center",gap:2}}>
          <div style={{width:44,height:4,background:"#e2e8f0",borderRadius:99,overflow:"hidden"}}>
            <div style={{width:pct+"%",height:"100%",background:isDone?"#16a34a":color,borderRadius:99}}/>
          </div>
          <span style={{fontSize:9,fontWeight:700,color:isDone?"#16a34a":pct>0?color:"#94a3b8"}}>{pct}%</span>
        </div>
      </td>
    );
  };

  // Proses yang ada di data
  const prosesAda=PROSES_LIST.filter(pr=>allPanels.some(p=>p.pd[pr]!==undefined));

  return(
    <div style={{display:"flex",flexDirection:"column",gap:10}}>

      {/* Stat row */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8}}>
        {[
          {n:totalPanel,l:"Total Panel",c:"#2563eb",bc:"#2563eb"},
          {n:avgOverall+"%",l:"Avg Overall",c:avgOverall>=70?"#16a34a":avgOverall>=40?"#d97706":"#dc2626",bc:avgOverall>=70?"#16a34a":avgOverall>=40?"#d97706":"#dc2626"},
          {n:selesai,l:"Panel Selesai",c:"#16a34a",bc:"#16a34a"},
          {n:terlambat,l:"Panel Terlambat",c:"#dc2626",bc:"#dc2626"},
        ].map((s,i)=>(
          <div key={i} style={{background:"#fff",border:"1px solid #eaecf0",borderTop:"3px solid "+s.bc,borderRadius:8,padding:"10px 13px",textAlign:"center" as const}}>
            <div style={{fontSize:20,fontWeight:700,color:s.c}}>{s.n}</div>
            <div style={{fontSize:9,color:"#94a3b8",marginTop:3,fontWeight:500,textTransform:"uppercase" as const,letterSpacing:.3}}>{s.l}</div>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div style={{background:"#fff",border:"1px solid #eaecf0",borderRadius:8,padding:"10px 13px",display:"flex",alignItems:"center",gap:8,flexWrap:"wrap" as const}}>
        <input placeholder="🔍 Cari panel, proyek, WO..."
          value={search} onChange={e=>setSearch(e.target.value)}
          style={{height:28,border:"1px solid #e2e8f0",borderRadius:5,padding:"0 10px",
            fontSize:11,background:"#f8fafc",outline:"none",color:"#1e293b",
            fontFamily:"inherit",flex:1,minWidth:160}}/>
        <select value={woFilter} onChange={e=>setWoFilter(e.target.value)}
          style={{height:28,border:"1px solid #e2e8f0",borderRadius:5,padding:"0 7px",
            fontSize:11,background:"#f8fafc",outline:"none",color:"#475569",cursor:"pointer",fontFamily:"inherit"}}>
          <option value="semua">Semua WO</option>
          {woData.map(w=><option key={w.id} value={w.wo}>WO {w.wo} — {w.proyek}</option>)}
        </select>
        <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}
          style={{height:28,border:"1px solid #e2e8f0",borderRadius:5,padding:"0 7px",
            fontSize:11,background:"#f8fafc",outline:"none",color:"#475569",cursor:"pointer",fontFamily:"inherit"}}>
          <option value="semua">Semua Status</option>
          <option value="ontrack">On Track</option>
          <option value="mendesak">Mendesak</option>
          <option value="terlambat">Terlambat</option>
          <option value="selesai">Selesai</option>
        </select>
        <span style={{fontSize:10,color:"#94a3b8",marginLeft:"auto"}}>{filtered.length} panel</span>
        <span style={{fontSize:10,color:"#94a3b8",padding:"2px 8px",background:"#f1f5f9",borderRadius:5}}>👁 Read-only</span>
      </div>

      {/* Table */}
      {filtered.length===0?(
        <div style={{background:"#fff",border:"1px solid #eaecf0",borderRadius:8,padding:"40px",textAlign:"center" as const,color:"#94a3b8"}}>
          Tidak ada data yang sesuai filter
        </div>
      ):(
        <div style={{background:"#fff",border:"1px solid #eaecf0",borderRadius:8,overflow:"hidden"}}>
          <div style={{overflowX:"auto" as const}}>
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead>
                <tr>
                  <th style={{...thSL,minWidth:55}}>WO</th>
                  <th style={{...thSL,minWidth:80}}>Proyek</th>
                  <th style={{...thS,minWidth:35}}>H-</th>
                  <th style={{...thSL,minWidth:130}}>Nama Panel</th>
                  <th style={{...thS,minWidth:45}}>Tipe</th>
                  <th style={{...thS,minWidth:35}}>Qty</th>
                  <th style={{...thS,minWidth:60}}>Overall</th>
                  <th style={{...thS,minWidth:65}}>Status</th>
                  {prosesAda.map(pr=>(
                    <th key={pr} style={{...thS,minWidth:65,borderTop:"3px solid "+((PROSES_COLOR as any)[pr]||"#94a3b8")}}>
                      {pr}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((p:any,pi:number)=>{
                  const ppct=panelOverall(p);
                  const d=daysUntil(p.target);
                  const late=isDelayed(p.target);
                  const urg=isUrgent(p.target);
                  const done=ppct===100;
                  const pc=done?"#16a34a":ppct>=70?"#16a34a":ppct>=40?"#d97706":"#dc2626";
                  const ps=done?"Selesai":late?"Terlambat":urg?"Mendesak":"On Track";
                  const pbg=done?"#f0fdf4":late?"#fef2f2":urg?"#fffbeb":"#eff6ff";
                  const psc=done?"#16a34a":late?"#dc2626":urg?"#d97706":"#2563eb";
                  const rowBg=pi%2===0?"#fff":"#fafbfc";
                  return(
                    <tr key={pi}>
                      <td style={{...tdSL,background:rowBg,color:"#2563eb",fontWeight:700,fontFamily:"ui-monospace,monospace",fontSize:10}}>{p.wo}</td>
                      <td style={{...tdSL,background:rowBg,color:"#475569",fontSize:10}}>{p.proyek}</td>
                      <td style={{...tdS,background:rowBg,fontWeight:600,fontSize:10,color:late?"#dc2626":urg?"#d97706":"#16a34a"}}>
                        {late?"−"+Math.abs(d):d}
                      </td>
                      <td style={{...tdSL,background:rowBg,fontWeight:500,color:"#1e293b"}}># {p.nama||p.name||"Panel "+(pi+1)}</td>
                      <td style={{...tdS,background:rowBg}}>
                        {p.tipe&&<span style={{background:"#eff6ff",color:"#2563eb",borderRadius:20,padding:"1px 7px",fontSize:9,fontWeight:600}}>{p.tipe}</span>}
                      </td>
                      <td style={{...tdS,background:rowBg}}>{p.qty||1}</td>
                      <td style={{...tdS,background:rowBg}}>
                        <div style={{display:"flex",flexDirection:"column" as const,alignItems:"center",gap:2}}>
                          <div style={{width:44,height:4,background:"#e2e8f0",borderRadius:99,overflow:"hidden"}}>
                            <div style={{width:ppct+"%",height:"100%",background:pc,borderRadius:99}}/>
                          </div>
                          <span style={{fontSize:9,fontWeight:700,color:pc}}>{ppct}%</span>
                        </div>
                      </td>
                      <td style={{...tdS,background:rowBg}}>
                        <span style={{background:pbg,color:psc,borderRadius:4,padding:"1px 6px",fontSize:9,fontWeight:600}}>{ps}</span>
                      </td>
                      {prosesAda.map(pr=><ProsesPctCell key={pr} pct={p.pd[pr]} proses={pr}/>)}
                    </tr>
                  );
                })}
              </tbody>
              {/* Footer rata-rata */}
              <tfoot>
                <tr style={{background:"#f8fafc"}}>
                  <td colSpan={6} style={{...tdSL,color:"#94a3b8",fontSize:10,fontStyle:"italic" as const}}>
                    Rata-rata ({filtered.length} panel)
                  </td>
                  <td style={tdS}>
                    {(()=>{
                      const avg=filtered.length?Math.round(filtered.reduce((a,p)=>a+panelOverall(p),0)/filtered.length):0;
                      const c=avg>=70?"#16a34a":avg>=40?"#d97706":"#dc2626";
                      return(
                        <div style={{display:"flex",flexDirection:"column" as const,alignItems:"center",gap:2}}>
                          <div style={{width:44,height:4,background:"#e2e8f0",borderRadius:99,overflow:"hidden"}}>
                            <div style={{width:avg+"%",height:"100%",background:c,borderRadius:99}}/>
                          </div>
                          <span style={{fontSize:9,fontWeight:700,color:c}}>{avg}%</span>
                        </div>
                      );
                    })()}
                  </td>
                  <td style={tdS}/>
                  {prosesAda.map(pr=>{
                    const vals=filtered.map(p=>p.pd[pr]).filter((v:any)=>v!==undefined) as number[];
                    const avg=vals.length?Math.round(vals.reduce((a,v)=>a+v,0)/vals.length):undefined;
                    return <ProsesPctCell key={pr} pct={avg} proses={pr}/>;
                  })}
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}`;

const startIdx = content.indexOf('function DetailProgress(');
const endIdx = content.indexOf('\nfunction RawSchedule(', startIdx);
if(startIdx !== -1 && endIdx !== -1){
  content = content.slice(0, startIdx) + newDetail + '\n' + content.slice(endIdx);
  fs.writeFileSync('src/App.tsx', content, 'utf8');
  console.log('✅ DetailProgress updated!');
} else {
  console.log('❌ start:',startIdx,'end:',endIdx);
}