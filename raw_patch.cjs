const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

const newRaw = `function RawSchedule({woData,rawData,setRawData,renhar,setRenhar,pekerja,createRaw,updateRaw,removeRaw,refetchRaw,createRenhar,updateRenhar,removeRenhar,logActivity,user}:any){
  const [weekOffset,setWeekOffset]=useState(0);
  const [filterProses,setFilterProses]=useState("SEMUA");
  const [showAddModal,setShowAddModal]=useState(false);
  const [addWO,setAddWO]=useState("");
  const [addPanel,setAddPanel]=useState("");
  const [addProses,setAddProses]=useState("POTONG");
  const [addPrioritas,setAddPrioritas]=useState("Sedang");
  const [saving,setSaving]=useState(false);

  const PROSES_LIST=["POTONG","BENDING","STEL","PAINTING","RAKIT","PASANG KOMPONEN","BUSBAR","WIRING CONTROL","WIRING POWER","QC TEST","PACKING"];

  // Generate 7 hari dari weekOffset
  const today=new Date();
  const startOfWeek=new Date(today);
  startOfWeek.setDate(today.getDate()+weekOffset*7-today.getDay()+1);
  const days=Array.from({length:7},(_,i)=>{
    const d=new Date(startOfWeek);
    d.setDate(startOfWeek.getDate()+i);
    return d;
  });
  const fmtDate=(d:Date)=>d.toISOString().slice(0,10);
  const fmtLabel=(d:Date)=>d.toLocaleDateString("id-ID",{day:"numeric",month:"short"});
  const isToday=(d:Date)=>fmtDate(d)===fmtDate(today);

  const filtered=filterProses==="SEMUA"?rawData:rawData.filter((r:any)=>r.proses===filterProses);

  const getWpForDate=(row:any,date:string)=>{
    return (row.jadwal||[]).filter((j:any)=>j.tanggal===date);
  };

  const handleAddWP=async(rowId:string,date:string,wp:string)=>{
    const row=rawData.find((r:any)=>r.id===rowId);
    if(!row) return;
    const existing=row.jadwal||[];
    const newJadwal=[...existing,{tanggal:date,wp,status:"on_progress"}];
    await updateRaw(rowId,{jadwal:newJadwal});
    logActivity?.({action:"Tambah WP "+wp+" ke Raw Schedule",halaman:"Raw Schedule"});
  };

  const handleRemoveWP=async(rowId:string,date:string,wp:string)=>{
    const row=rawData.find((r:any)=>r.id===rowId);
    if(!row) return;
    const newJadwal=(row.jadwal||[]).filter((j:any)=>!(j.tanggal===date&&j.wp===wp));
    await updateRaw(rowId,{jadwal:newJadwal});
  };

  const handleRemoveRow=async(rowId:string)=>{
    if(!confirm("Hapus baris ini?")) return;
    await removeRaw(rowId);
    logActivity?.({action:"Hapus Raw Schedule",halaman:"Raw Schedule"});
  };

  const handleAddRow=async()=>{
    if(!addWO||!addPanel||!addProses) return;
    setSaving(true);
    await createRaw({wo:addWO,panel:addPanel,proses:addProses,prioritas:addPrioritas,jadwal:[]});
    logActivity?.({action:"Tambah Raw Schedule "+addProses+" - "+addPanel,halaman:"Raw Schedule"});
    setShowAddModal(false);
    setSaving(false);
  };

  const thS={background:"#1e3a5f",color:"#fff",fontWeight:600,padding:"7px 10px",
    textAlign:"center" as const,fontSize:9,textTransform:"uppercase" as const,
    letterSpacing:.3,whiteSpace:"nowrap" as const,borderRight:"1px solid rgba(255,255,255,.1)"};
  const thSL={...thS,textAlign:"left" as const};
  const tdS={padding:"6px 10px",borderBottom:"1px solid #f5f7fa",
    verticalAlign:"middle" as const,fontSize:11,borderRight:"1px solid #f5f7fa",
    textAlign:"center" as const,color:"#374151"};
  const tdSL={...tdS,textAlign:"left" as const};

  const weekLabel=weekOffset===0?"Minggu Ini":weekOffset===-1?"Minggu Lalu":weekOffset===1?"Minggu Depan":
    fmtLabel(days[0])+" — "+fmtLabel(days[6]);

  return(
    <div style={{display:"flex",flexDirection:"column",gap:10}}>

      {/* Toolbar */}
      <div style={{background:"#fff",border:"1px solid #eaecf0",borderRadius:8,padding:"10px 13px",
        display:"flex",alignItems:"center",gap:8,flexWrap:"wrap" as const}}>
        <button onClick={()=>setWeekOffset(w=>w-1)}
          style={{height:28,border:"1px solid #e2e8f0",background:"#fff",borderRadius:5,
            padding:"0 10px",fontSize:11,cursor:"pointer",color:"#475569",fontFamily:"inherit",
            display:"flex",alignItems:"center",gap:4}}>
          ◀ Lalu
        </button>
        <button onClick={()=>setWeekOffset(0)}
          style={{height:28,border:"1px solid #bfdbfe",background:"#eff6ff",borderRadius:5,
            padding:"0 10px",fontSize:11,cursor:"pointer",color:"#2563eb",fontWeight:600,fontFamily:"inherit"}}>
          Hari Ini
        </button>
        <button onClick={()=>setWeekOffset(w=>w+1)}
          style={{height:28,border:"1px solid #e2e8f0",background:"#fff",borderRadius:5,
            padding:"0 10px",fontSize:11,cursor:"pointer",color:"#475569",fontFamily:"inherit",
            display:"flex",alignItems:"center",gap:4}}>
          Depan ▶
        </button>
        <span style={{fontSize:11,color:"#64748b",fontWeight:500}}>
          {fmtLabel(days[0])} — {fmtLabel(days[6])} {days[0].getFullYear()}
        </span>
        <div style={{marginLeft:"auto",display:"flex",gap:6}}>
          <button onClick={()=>setShowAddModal(true)}
            style={{height:28,border:"1px solid #2563eb",background:"#2563eb",borderRadius:5,
              padding:"0 12px",fontSize:11,cursor:"pointer",color:"#fff",fontWeight:600,
              fontFamily:"inherit",display:"flex",alignItems:"center",gap:4}}>
            + Tambah Panel
          </button>
        </div>
      </div>

      {/* Filter proses */}
      <div style={{display:"flex",gap:5,flexWrap:"wrap" as const,alignItems:"center"}}>
        <span style={{fontSize:10,color:"#94a3b8",fontWeight:600}}>Proses:</span>
        {["SEMUA",...PROSES_LIST].map(pr=>{
          const color=pr==="SEMUA"?"#2563eb":(PROSES_COLOR as any)[pr]||"#64748b";
          const on=filterProses===pr;
          return(
            <button key={pr} onClick={()=>setFilterProses(pr)}
              style={{border:"1px solid "+(on?color:"#e2e8f0"),
                background:on?color:"#fff",color:on?"#fff":"#64748b",
                borderRadius:20,padding:"2px 10px",fontSize:10,fontWeight:on?600:400,
                cursor:"pointer",fontFamily:"inherit",transition:"all .13s"}}>
              {pr}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap" as const}}>
        <span style={{fontSize:10,color:"#94a3b8",fontWeight:600}}>Legend:</span>
        {[
          {c:"#16a34a",l:"Finish"},
          {c:"#f59e0b",l:"On Progress"},
          {c:"#94a3b8",l:"Belum Mulai"},
        ].map(l=>(
          <div key={l.l} style={{display:"flex",alignItems:"center",gap:4,fontSize:10,color:"#64748b"}}>
            <div style={{width:8,height:8,borderRadius:2,background:l.c,flexShrink:0}}/>
            {l.l}
          </div>
        ))}
        {Object.entries(WP_COLOR as any).map(([wp,c]:any)=>(
          <div key={wp} style={{display:"flex",alignItems:"center",gap:4,fontSize:10,color:"#64748b"}}>
            <div style={{width:8,height:8,borderRadius:"50%",background:c,flexShrink:0}}/>
            {wp}
          </div>
        ))}
      </div>

      {/* Table */}
      <div style={{background:"#fff",border:"1px solid #eaecf0",borderRadius:8,overflow:"hidden"}}>
        <div style={{overflowX:"auto" as const}}>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead>
              <tr>
                <th style={{...thSL,minWidth:70}}>Proyek</th>
                <th style={{...thSL,minWidth:120}}>Panel</th>
                <th style={{...thSL,minWidth:80}}>Proses</th>
                <th style={{...thS,minWidth:70}}>Prioritas</th>
                {days.map(d=>(
                  <th key={fmtDate(d)} style={{...thS,minWidth:90,
                    background:isToday(d)?"#1d4ed8":"#1e3a5f",
                    borderBottom:isToday(d)?"2px solid #60a5fa":"none"}}>
                    {fmtLabel(d)}
                    {isToday(d)&&<div style={{fontSize:7,opacity:.8,marginTop:1}}>Hari Ini</div>}
                  </th>
                ))}
                <th style={{...thS,minWidth:35}}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length===0&&(
                <tr><td colSpan={4+days.length+1} style={{...tdS,textAlign:"center",padding:"32px",color:"#94a3b8"}}>
                  Belum ada jadwal. Klik "+ Tambah Panel" untuk mulai.
                </td></tr>
              )}
              {filtered.map((row:any,ri:number)=>{
                const rowBg=ri%2===0?"#fff":"#fafbfc";
                const prosesColor=(PROSES_COLOR as any)[row.proses]||"#94a3b8";
                const priColor=(PRIORITAS_COLOR as any)[row.prioritas]||"#64748b";
                const priBg=row.prioritas==="Tinggi"?"#fef2f2":row.prioritas==="Sedang"?"#fffbeb":"#f0fdf4";
                return(
                  <tr key={row.id}>
                    <td style={{...tdSL,background:rowBg,fontWeight:500,color:"#1e293b"}}>{row.wo||row.proyek}</td>
                    <td style={{...tdSL,background:rowBg,color:"#475569"}}>{row.panel}</td>
                    <td style={{...tdS,background:rowBg}}>
                      <span style={{background:prosesColor+"20",color:prosesColor,
                        borderRadius:4,padding:"2px 7px",fontSize:9.5,fontWeight:600}}>
                        {row.proses}
                      </span>
                    </td>
                    <td style={{...tdS,background:rowBg}}>
                      <span style={{background:priBg,color:priColor,
                        borderRadius:4,padding:"2px 7px",fontSize:9.5,fontWeight:600}}>
                        {row.prioritas||"Sedang"}
                      </span>
                    </td>
                    {days.map(d=>{
                      const dateStr=fmtDate(d);
                      const wps=getWpForDate(row,dateStr);
                      const todayCell=isToday(d);
                      return(
                        <td key={dateStr} style={{...tdS,background:todayCell?"#eff6ff":rowBg,padding:"4px 6px"}}>
                          <div style={{display:"flex",flexWrap:"wrap" as const,gap:2,justifyContent:"center",minHeight:24}}>
                            {wps.map((j:any,ji:number)=>{
                              const wpColor=(WP_COLOR as any)[j.wp]||"#94a3b8";
                              const isDone=j.status==="finish";
                              return(
                                <span key={ji}
                                  onClick={()=>handleRemoveWP(row.id,dateStr,j.wp)}
                                  style={{background:isDone?"#16a34a":wpColor,color:"#fff",
                                    borderRadius:4,padding:"2px 6px",fontSize:9,fontWeight:700,
                                    cursor:"pointer",display:"inline-flex",alignItems:"center",gap:2}}>
                                  {isDone?"✓ ":""}{j.wp}
                                </span>
                              );
                            })}
                            {wps.length===0&&(
                              <div onClick={()=>{
                                const wp=prompt("Masukkan WP (WP1/WP2/WP3/WP4):");
                                if(wp) handleAddWP(row.id,dateStr,wp.toUpperCase());
                              }}
                                style={{width:"100%",height:22,border:"1px dashed #e2e8f0",
                                  borderRadius:4,display:"flex",alignItems:"center",
                                  justifyContent:"center",color:"#cbd5e1",fontSize:13,
                                  cursor:"pointer",transition:"all .13s"}}
                                onMouseEnter={e=>(e.currentTarget.style.borderColor="#94a3b8")}
                                onMouseLeave={e=>(e.currentTarget.style.borderColor="#e2e8f0")}>
                                +
                              </div>
                            )}
                          </div>
                        </td>
                      );
                    })}
                    <td style={{...tdS,background:rowBg}}>
                      <button onClick={()=>handleRemoveRow(row.id)}
                        style={{border:"none",background:"none",cursor:"pointer",
                          color:"#fca5a5",fontSize:13,padding:"2px 4px",
                          display:"flex",alignItems:"center"}}>
                        <i className="ti ti-trash" aria-hidden="true"/>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Modal */}
      {showAddModal&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.4)",
          display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000}}>
          <div style={{background:"#fff",borderRadius:12,padding:24,width:400,
            boxShadow:"0 20px 60px rgba(0,0,0,.2)"}}>
            <div style={{fontSize:14,fontWeight:700,color:"#0f172a",marginBottom:16}}>Tambah Panel ke Raw Schedule</div>
            {[
              {l:"Proyek / No WO",el:<select value={addWO} onChange={e=>setAddWO(e.target.value)}
                style={{width:"100%",height:34,border:"1px solid #e2e8f0",borderRadius:6,padding:"0 8px",fontSize:12,fontFamily:"inherit",outline:"none",background:"#f8fafc"}}>
                <option value="">-- Pilih WO --</option>
                {woData.map((w:any)=><option key={w.id} value={w.wo}>WO {w.wo} — {w.proyek}</option>)}
              </select>},
              {l:"Nama Panel",el:<input value={addPanel} onChange={e=>setAddPanel(e.target.value)}
                placeholder="contoh: LVMDP 2"
                style={{width:"100%",height:34,border:"1px solid #e2e8f0",borderRadius:6,padding:"0 8px",fontSize:12,fontFamily:"inherit",outline:"none",background:"#f8fafc"}}/>},
              {l:"Proses",el:<select value={addProses} onChange={e=>setAddProses(e.target.value)}
                style={{width:"100%",height:34,border:"1px solid #e2e8f0",borderRadius:6,padding:"0 8px",fontSize:12,fontFamily:"inherit",outline:"none",background:"#f8fafc"}}>
                {["POTONG","BENDING","STEL","PAINTING","RAKIT","PASANG KOMPONEN","BUSBAR","WIRING CONTROL","WIRING POWER","QC TEST","PACKING"].map(p=><option key={p}>{p}</option>)}
              </select>},
              {l:"Prioritas",el:<select value={addPrioritas} onChange={e=>setAddPrioritas(e.target.value)}
                style={{width:"100%",height:34,border:"1px solid #e2e8f0",borderRadius:6,padding:"0 8px",fontSize:12,fontFamily:"inherit",outline:"none",background:"#f8fafc"}}>
                <option>Tinggi</option><option>Sedang</option><option>Rendah</option>
              </select>},
            ].map(f=>(
              <div key={f.l} style={{marginBottom:12}}>
                <div style={{fontSize:11,fontWeight:600,color:"#475569",marginBottom:4,textTransform:"uppercase" as const,letterSpacing:.3}}>{f.l}</div>
                {f.el}
              </div>
            ))}
            <div style={{display:"flex",gap:8,marginTop:16}}>
              <button onClick={()=>setShowAddModal(false)}
                style={{flex:1,height:34,border:"1px solid #e2e8f0",background:"#fff",borderRadius:6,
                  fontSize:12,cursor:"pointer",color:"#475569",fontFamily:"inherit"}}>
                Batal
              </button>
              <button onClick={handleAddRow} disabled={saving}
                style={{flex:1,height:34,border:"none",background:"#2563eb",borderRadius:6,
                  fontSize:12,cursor:"pointer",color:"#fff",fontWeight:600,fontFamily:"inherit"}}>
                {saving?"Menyimpan...":"Tambah"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}`;

const startIdx = content.indexOf('function RawSchedule(');
const endIdx = content.indexOf('\nfunction ManajemenWO(', startIdx);
if(startIdx !== -1 && endIdx !== -1){
  content = content.slice(0, startIdx) + newRaw + '\n' + content.slice(endIdx);
  fs.writeFileSync('src/App.tsx', content, 'utf8');
  console.log('✅ RawSchedule updated!');
} else {
  console.log('❌ start:',startIdx,'end:',endIdx);
}