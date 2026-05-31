const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

const newDashboard = `function Dashboard({woData}){
  if(!woData.length) return(
    <div className="fi" style={{textAlign:"center",padding:"60px 20px",color:"#94a3b8"}}>
      <div style={{fontSize:40,marginBottom:12}}>📋</div>
      <div style={{fontSize:14,fontWeight:600,color:"#1e293b"}}>Belum ada Work Order</div>
      <div style={{fontSize:12,marginTop:4}}>Tambahkan WO di Manajemen WO terlebih dahulu</div>
    </div>
  );

  const alerts=woData.filter(w=>woOverall(w)<100&&(isDelayed(w.target)||isUrgent(w.target)));
  const avgOverall=woData.length?Math.round(woData.reduce((a,w)=>a+woOverall(w),0)/woData.length):0;

  const thS={background:"#f8fafc",color:"#64748b",fontWeight:600,padding:"8px 12px",
    textAlign:"left" as const,fontSize:10,textTransform:"uppercase" as const,
    letterSpacing:.4,borderBottom:"1px solid #eaecf0",whiteSpace:"nowrap" as const};
  const tdS={padding:"9px 12px",borderBottom:"1px solid #f5f7fa",
    color:"#374151",verticalAlign:"middle" as const,fontSize:12};

  return(
    <div className="fi" style={{display:"flex",flexDirection:"column",gap:12}}>

      {/* Alert rows */}
      {alerts.map(w=>{
        const d=daysUntil(w.target);
        const isLate=isDelayed(w.target);
        return(
          <div key={w.id} style={{display:"flex",alignItems:"center",gap:10,
            background:isLate?"#fef2f2":"#fffbeb",
            border:"1px solid "+(isLate?"#fecaca":"#fde68a"),
            borderRadius:7,padding:"8px 14px",fontSize:12}}>
            <span style={{color:isLate?"#dc2626":"#d97706",fontSize:13,flexShrink:0}}>●</span>
            <span style={{fontWeight:600,color:isLate?"#dc2626":"#d97706"}}>WO {w.wo} — {w.proyek}</span>
            <span style={{color:isLate?"#7f1d1d":"#78350f",fontSize:11}}>
              {isLate?"Terlambat "+Math.abs(d)+" hari":"H-"+d+" Mendesak"} · Target: {w.target}
            </span>
            <span style={{marginLeft:"auto",background:isLate?"#fef2f2":"#fffbeb",
              color:isLate?"#dc2626":"#d97706",border:"1px solid "+(isLate?"#fecaca":"#fde68a"),
              borderRadius:4,padding:"2px 8px",fontSize:10,fontWeight:600,flexShrink:0}}>
              {isLate?"Terlambat":"Mendesak"}
            </span>
          </div>
        );
      })}

      {/* Stat Cards */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8}}>
        {[
          {n:woData.length,l:"Total Work Order",c:"#2563eb",w:Math.min(woData.length*20,100)},
          {n:woData.reduce((a,w)=>a+w.panels.length,0),l:"Total Panel",c:"#10b981",w:60},
          {n:avgOverall+"%",l:"Avg Progress",c:pColor(avgOverall),w:avgOverall},
          {n:alerts.length,l:"Perlu Perhatian",c:"#dc2626",w:Math.min(alerts.length*25,100)},
        ].map((s,i)=>(
          <div key={i} style={{background:"#fff",border:"1px solid #eaecf0",borderRadius:8,padding:"12px 14px"}}>
            <div style={{fontSize:22,fontWeight:700,color:s.c,lineHeight:1}}>{s.n}</div>
            <div style={{fontSize:9,color:"#94a3b8",marginTop:4,fontWeight:500,textTransform:"uppercase",letterSpacing:.4}}>{s.l}</div>
            <div style={{height:3,background:"#e2e8f0",borderRadius:99,marginTop:10,overflow:"hidden"}}>
              <div style={{width:s.w+"%",height:"100%",background:s.c,borderRadius:99}}/>
            </div>
          </div>
        ))}
      </div>

      {/* Table Card */}
      <div style={{background:"#fff",border:"1px solid #eaecf0",borderRadius:8,overflow:"hidden"}}>
        {/* Tabs */}
        <div style={{display:"flex",borderBottom:"1px solid #eaecf0",padding:"0 5px"}}>
          {["Work Order","Panel List","Peringatan"].map((t,i)=>(
            <div key={t} style={{padding:"9px 14px",fontSize:12,fontWeight:i===0?600:500,
              color:i===0?"#2563eb":"#64748b",cursor:"pointer",
              borderBottom:i===0?"2px solid #2563eb":"2px solid transparent",
              marginBottom:-1}}>
              {t}
            </div>
          ))}
        </div>
        {/* Header */}
        <div style={{padding:"10px 14px",borderBottom:"1px solid #f0f2f5",
          display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <span style={{fontSize:13,fontWeight:600,color:"#0f172a"}}>Daftar Work Order</span>
          <div style={{display:"flex",gap:5}}>
            <button style={{border:"1px solid #e2e8f0",background:"#fff",borderRadius:5,
              padding:"4px 10px",fontSize:10.5,fontWeight:500,cursor:"pointer",color:"#475569",
              display:"inline-flex",alignItems:"center",gap:4,fontFamily:"inherit"}}>
              ⊟ Filter
            </button>
            <button style={{border:"1px solid #2563eb",background:"#2563eb",borderRadius:5,
              padding:"4px 10px",fontSize:10.5,fontWeight:500,cursor:"pointer",color:"#fff",
              display:"inline-flex",alignItems:"center",gap:4,fontFamily:"inherit"}}>
              + Tambah WO
            </button>
          </div>
        </div>
        {/* Table */}
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead>
              <tr>
                {["No WO","Proyek","Target","Panel","Progress","Status","Aksi"].map(h=>(
                  <th key={h} style={thS}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {woData.map((wo,ri)=>{
                const pct=woOverall(wo);
                const d=daysUntil(wo.target);
                const isLate=isDelayed(wo.target);
                const isUrg=isUrgent(wo.target);
                const rBg=ri%2===0?"#fff":"#fafbfc";
                const statusLabel=pct===100?"Selesai":isLate?"Terlambat":isUrg?"Mendesak":"On Track";
                const statusColor=pct===100?"#16a34a":isLate?"#dc2626":isUrg?"#d97706":"#16a34a";
                const statusBg=pct===100?"#f0fdf4":isLate?"#fef2f2":isUrg?"#fffbeb":"#f0fdf4";
                const pbColor=pct===100?"#16a34a":isLate?"#dc2626":isUrg?"#d97706":pColor(pct);
                return(
                  <tr key={wo.id}>
                    <td style={{...tdS,background:rBg}}>
                      <span style={{color:"#2563eb",fontWeight:700,fontFamily:"ui-monospace,monospace",fontSize:11.5}}>WO {wo.wo}</span>
                    </td>
                    <td style={{...tdS,fontWeight:500,color:"#1e293b",background:rBg}}>{wo.proyek}</td>
                    <td style={{...tdS,background:rBg}}>
                      <span style={{color:"#64748b",fontSize:11.5}}>{wo.target}</span>
                      {pct<100&&<span style={{marginLeft:6,fontSize:11,fontWeight:600,
                        color:isLate?"#dc2626":isUrg?"#d97706":"#16a34a"}}>
                        {isLate?"−"+Math.abs(d)+"hr":isUrg?"H-"+d:"H-"+d}
                      </span>}
                    </td>
                    <td style={{...tdS,color:"#64748b",background:rBg}}>{(wo.panels||[]).length} panel</td>
                    <td style={{...tdS,background:rBg}}>
                      <div style={{display:"flex",alignItems:"center",gap:7}}>
                        <div style={{width:64,height:4,background:"#e2e8f0",borderRadius:99,overflow:"hidden",flexShrink:0}}>
                          <div style={{width:pct+"%",height:"100%",background:pbColor,borderRadius:99}}/>
                        </div>
                        <span style={{fontSize:11.5,fontWeight:600,minWidth:30,color:pbColor}}>{pct}%</span>
                      </div>
                    </td>
                    <td style={{...tdS,background:rBg}}>
                      <span style={{background:statusBg,color:statusColor,border:"1px solid "+statusColor+"30",
                        borderRadius:4,padding:"2px 8px",fontSize:10,fontWeight:600}}>
                        {statusLabel}
                      </span>
                    </td>
                    <td style={{...tdS,background:rBg}}>
                      <button style={{border:"1px solid #e2e8f0",background:"#fff",borderRadius:5,
                        padding:"3px 9px",fontSize:10.5,cursor:"pointer",color:"#2563eb",
                        fontWeight:500,fontFamily:"inherit"}}>
                        Detail
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{background:"#f8fafc"}}>
                <td colSpan={4} style={{padding:"8px 12px",fontSize:11,color:"#94a3b8",fontWeight:500}}>
                  {woData.length} work order · rata-rata progress
                </td>
                <td style={{padding:"8px 12px"}}>
                  <div style={{display:"flex",alignItems:"center",gap:7}}>
                    <div style={{width:64,height:4,background:"#e2e8f0",borderRadius:99,overflow:"hidden",flexShrink:0}}>
                      <div style={{width:avgOverall+"%",height:"100%",background:pColor(avgOverall),borderRadius:99}}/>
                    </div>
                    <span style={{fontSize:11.5,fontWeight:600,color:pColor(avgOverall)}}>{avgOverall}%</span>
                  </div>
                </td>
                <td colSpan={2}/>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}`;

// Replace Dashboard function
const startIdx = content.indexOf('function Dashboard({woData}){');
const nextFunc = content.indexOf('\n// ─────', startIdx);
const nextFunc2 = content.indexOf('\nfunction SummaryProgress(', startIdx);
const endIdx = Math.min(
  nextFunc !== -1 ? nextFunc : Infinity,
  nextFunc2 !== -1 ? nextFunc2 : Infinity
);

if(startIdx !== -1 && endIdx !== Infinity){
  content = content.slice(0, startIdx) + newDashboard + '\n' + content.slice(endIdx);
  fs.writeFileSync('src/App.tsx', content, 'utf8');
  console.log('✅ Dashboard updated!');
  console.log('Chars:', content.length);
} else {
  console.log('❌ Dashboard function tidak ditemukan! start:',startIdx,'end:',endIdx);
}