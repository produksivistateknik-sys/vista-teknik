const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

const newSummary = `function SummaryProgress({woData}:{woData:any[]}){
  const [search,setSearch]=useState("");
  const [statusFilter,setStatusFilter]=useState("semua");

  const filtered=woData.filter(w=>{
    const pct=woOverall(w);
    const s=pct===100?"selesai":isDelayed(w.target)?"terlambat":isUrgent(w.target)?"mendesak":"ontrack";
    const matchS=statusFilter==="semua"||statusFilter===s;
    const matchQ=!search||(w.wo||"").toLowerCase().includes(search.toLowerCase())||(w.proyek||"").toLowerCase().includes(search.toLowerCase());
    return matchS&&matchQ;
  });

  const thS={background:"#f8fafc",color:"#64748b",fontWeight:600,padding:"7px 11px",
    textAlign:"left" as const,fontSize:9.5,textTransform:"uppercase" as const,
    letterSpacing:.4,borderBottom:"1px solid #eaecf0",whiteSpace:"nowrap" as const};
  const tdS={padding:"8px 11px",borderBottom:"1px solid #f5f7fa",
    color:"#374151",verticalAlign:"middle" as const,fontSize:11.5};

  if(!woData.length) return(
    <div style={{textAlign:"center",padding:"60px 20px",color:"#94a3b8"}}>
      <div style={{fontSize:40,marginBottom:12}}>📊</div>
      <div style={{fontSize:14,fontWeight:600,color:"#1e293b"}}>Belum ada data</div>
    </div>
  );

  return(
    <div style={{display:"flex",flexDirection:"column",gap:10}}>

      {/* Header card */}
      <div style={{background:"#fff",border:"1px solid #eaecf0",borderRadius:8,padding:"12px 14px",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap" as const,gap:8}}>
        <div>
          <div style={{fontSize:14,fontWeight:700,color:"#0f172a"}}>Summary Progress</div>
          <div style={{fontSize:11,color:"#94a3b8",marginTop:2}}>Ringkasan progress semua Work Order</div>
        </div>
        <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap" as const}}>
          <input
            placeholder="Cari WO atau proyek..."
            value={search} onChange={e=>setSearch(e.target.value)}
            style={{height:28,border:"1px solid #e2e8f0",borderRadius:5,padding:"0 8px",
              fontSize:11,background:"#f8fafc",outline:"none",color:"#1e293b",
              fontFamily:"inherit",width:180}}/>
          <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}
            style={{height:28,border:"1px solid #e2e8f0",borderRadius:5,padding:"0 7px",
              fontSize:11,background:"#f8fafc",outline:"none",color:"#475569",
              cursor:"pointer",fontFamily:"inherit"}}>
            <option value="semua">Semua Status</option>
            <option value="ontrack">On Track</option>
            <option value="mendesak">Mendesak</option>
            <option value="terlambat">Terlambat</option>
            <option value="selesai">Selesai</option>
          </select>
        </div>
      </div>

      {/* WO Cards */}
      {filtered.length===0&&(
        <div style={{background:"#fff",border:"1px solid #eaecf0",borderRadius:8,padding:"40px",textAlign:"center",color:"#94a3b8"}}>
          Tidak ada data yang sesuai filter
        </div>
      )}

      {filtered.map(wo=>{
        const pct=woOverall(wo);
        const d=daysUntil(wo.target);
        const late=isDelayed(wo.target);
        const urg=isUrgent(wo.target);
        const done=pct===100;
        const statusLabel=done?"Selesai":late?"Terlambat":urg?"Mendesak":"On Track";
        const statusColor=done?"#16a34a":late?"#dc2626":urg?"#d97706":"#16a34a";
        const statusBg=done?"#f0fdf4":late?"#fef2f2":urg?"#fffbeb":"#f0fdf4";
        const pbColor=done?"#16a34a":pct>=70?"#16a34a":pct>=40?"#d97706":"#dc2626";
        const borderColor=done?"#16a34a":late?"#dc2626":urg?"#d97706":"#e2e8f0";

        return(
          <div key={wo.id} style={{background:"#fff",border:"1px solid #eaecf0",
            borderRadius:8,overflow:"hidden",borderLeft:"3px solid "+borderColor}}>

            {/* WO Header */}
            <div style={{padding:"10px 14px",borderBottom:"1px solid #f0f2f5",
              display:"flex",alignItems:"center",gap:10,flexWrap:"wrap" as const}}>
              <span style={{color:"#2563eb",fontWeight:700,fontFamily:"ui-monospace,monospace",fontSize:12}}>WO {wo.wo}</span>
              <span style={{fontWeight:600,color:"#1e293b",fontSize:13}}>{wo.proyek}</span>
              <span style={{fontSize:11,color:"#94a3b8"}}>📅 {wo.target}</span>
              {!done&&<span style={{fontSize:11,fontWeight:600,color:late?"#dc2626":urg?"#d97706":"#16a34a"}}>
                {late?"Terlambat "+Math.abs(d)+" hari":urg?"H-"+d+" Mendesak":"H-"+d}
              </span>}
              <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:8}}>
                <span style={{background:statusBg,color:statusColor,borderRadius:4,
                  padding:"2px 8px",fontSize:10,fontWeight:600}}>{statusLabel}</span>
                <span style={{fontSize:16,fontWeight:800,color:pbColor}}>{pct}%</span>
              </div>
            </div>

            {/* Overall progress bar */}
            <div style={{padding:"8px 14px",borderBottom:"1px solid #f5f7fa",display:"flex",alignItems:"center",gap:10}}>
              <span style={{fontSize:10,color:"#94a3b8",fontWeight:500,width:80,flexShrink:0}}>OVERALL</span>
              <div style={{flex:1,height:6,background:"#e2e8f0",borderRadius:99,overflow:"hidden"}}>
                <div style={{width:pct+"%",height:"100%",background:pbColor,borderRadius:99,transition:"width .3s"}}/>
              </div>
              <span style={{fontSize:11,fontWeight:700,color:pbColor,minWidth:32,textAlign:"right" as const}}>{pct}%</span>
            </div>

            {/* Panel table */}
            {(wo.panels||[]).length>0&&(
              <div style={{overflowX:"auto" as const}}>
                <table style={{width:"100%",borderCollapse:"collapse"}}>
                  <thead>
                    <tr>
                      {["Panel","Progress","Proses Selesai","Status"].map(h=>(
                        <th key={h} style={thS}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(wo.panels||[]).map((p:any,pi:number)=>{
                      const ppct=panelOverall?.(p)??0;
                      const pc=ppct===100?"#16a34a":ppct>=70?"#16a34a":ppct>=40?"#d97706":"#dc2626";
                      const ps=ppct===100?"Selesai":ppct>=70?"On Track":ppct>=40?"Perlu Perhatian":"Terlambat";
                      const pbg=ppct===100?"#f0fdf4":ppct>=70?"#f0fdf4":ppct>=40?"#fffbeb":"#fef2f2";
                      const doneProses=(p.proses||[]).filter((pr:any)=>pr.done||pr.selesai||pr.status==="done").length;
                      const totalProses=(p.proses||[]).length;
                      return(
                        <tr key={pi}>
                          <td style={{...tdS,fontWeight:500,color:"#1e293b"}}>{p.nama||p.name||"Panel "+(pi+1)}</td>
                          <td style={tdS}>
                            <div style={{display:"flex",alignItems:"center",gap:7}}>
                              <div style={{width:80,height:4,background:"#e2e8f0",borderRadius:99,overflow:"hidden",flexShrink:0}}>
                                <div style={{width:ppct+"%",height:"100%",background:pc,borderRadius:99}}/>
                              </div>
                              <span style={{fontSize:11,fontWeight:600,color:pc,minWidth:28}}>{ppct}%</span>
                            </div>
                          </td>
                          <td style={{...tdS,color:"#64748b"}}>
                            {totalProses>0?doneProses+"/"+totalProses+" proses":"-"}
                          </td>
                          <td style={tdS}>
                            <span style={{background:pbg,color:pc,borderRadius:4,padding:"2px 7px",fontSize:9.5,fontWeight:600}}>{ps}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}`;

const startIdx = content.indexOf('function SummaryProgress(');
const endIdx = content.indexOf('\nfunction DetailProgress(', startIdx);
if(startIdx !== -1 && endIdx !== -1){
  content = content.slice(0, startIdx) + newSummary + '\n' + content.slice(endIdx);
  fs.writeFileSync('src/App.tsx', content, 'utf8');
  console.log('✅ SummaryProgress updated!');
} else {
  console.log('❌ start:',startIdx,'end:',endIdx);
}