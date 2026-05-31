const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

// Ganti WP Picker Modal yang sudah ada dengan versi lengkap
const oldModal = `      {/* WP Picker Modal */}
      {wpPicker&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.35)",
          display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000}}
          onClick={()=>setWpPicker(null)}>
          <div onClick={e=>e.stopPropagation()}
            style={{background:"#fff",borderRadius:10,padding:20,minWidth:220,
              boxShadow:"0 20px 60px rgba(0,0,0,.2)"}}>
            <div style={{fontSize:13,fontWeight:700,color:"#0f172a",marginBottom:12}}>
              Pilih WP — {wpPicker.date}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              {Object.entries(WP_COLOR as any).map(([wp,c]:any)=>(
                <button key={wp} onClick={async()=>{
                  await handleAddWP(wpPicker.rowId,wpPicker.date,wp);
                  setWpPicker(null);
                }}
                  style={{height:44,border:"2px solid "+c,background:c+"15",
                    borderRadius:8,cursor:"pointer",fontSize:13,fontWeight:700,
                    color:c,fontFamily:"inherit",transition:"all .13s"}}
                  onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background=c;(e.currentTarget as HTMLElement).style.color="#fff"}}
                  onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background=c+"15";(e.currentTarget as HTMLElement).style.color=c}}>
                  {wp}
                </button>
              ))}
            </div>
            <button onClick={()=>setWpPicker(null)}
              style={{width:"100%",marginTop:12,height:32,border:"1px solid #e2e8f0",
                background:"#f8fafc",borderRadius:6,cursor:"pointer",fontSize:11,
                color:"#64748b",fontFamily:"inherit"}}>
              Batal
            </button>
          </div>
        </div>
      )}`;

const newModal = `      {/* WP Picker Modal */}
      {wpPicker&&(()=>{
        const row=rawData.find((r:any)=>r.id===wpPicker.rowId);
        const panelWO=woData.find((w:any)=>w.wo===row?.wo);
        const panel=(panelWO?.panels||[]).find((p:any)=>p.nama===row?.panel);
        const cfg=panel?.tipe?(PANEL_TYPES as any)[panel.tipe]:null;
        const [selWp,setSelWp]=wpPicker.selWp!==undefined?[wpPicker.selWp,((wp:string)=>setWpPicker((prev:any)=>({...prev,selWp:wp})))]:["WP1",()=>{}];
        const wpDef=cfg?.wps?.find((w:any)=>w.wp===selWp);
        const wpItems=wpDef?.items||[];
        const selKomps=wpPicker.selKomps||[];
        const existingWps=(row?.jadwal||[]).filter((j:any)=>j.tanggal===wpPicker.date);
        const wpHasData=(wp:string)=>existingWps.some((j:any)=>j.wp===wp);

        return(
          <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.45)",
            display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000}}
            onClick={()=>setWpPicker(null)}>
            <div onClick={e=>e.stopPropagation()}
              style={{background:"#fff",borderRadius:12,padding:24,width:560,maxWidth:"95vw",
                maxHeight:"85vh",overflowY:"auto",boxShadow:"0 20px 60px rgba(0,0,0,.25)"}}>

              {/* Header */}
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
                <div style={{fontSize:13,fontWeight:700,color:"#0f172a"}}>TAMBAH WP</div>
                <div style={{fontSize:11,color:"#94a3b8"}}>{wpPicker.date}</div>
              </div>

              {/* WP Selector */}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:16}}>
                {Object.entries(WP_COLOR as any).map(([wp,c]:any)=>{
                  const isSel=selWp===wp;
                  const hasDat=wpHasData(wp);
                  return(
                    <button key={wp}
                      onClick={()=>setWpPicker((prev:any)=>({...prev,selWp:wp,selKomps:[]}))}
                      style={{height:44,border:"2px solid "+(isSel?c:"#e2e8f0"),
                        background:isSel?c+"18":"#fff",borderRadius:8,cursor:"pointer",
                        fontSize:13,fontWeight:700,color:isSel?c:"#64748b",fontFamily:"inherit",
                        display:"flex",alignItems:"center",justifyContent:"center",gap:8,
                        transition:"all .15s"}}>
                      <span style={{width:10,height:10,borderRadius:"50%",background:c,flexShrink:0}}/>
                      {wp}{hasDat?" ✓":""}
                    </button>
                  );
                })}
              </div>

              {/* Komponen list */}
              {wpItems.length>0&&<>
                <div style={{fontSize:11,fontWeight:700,color:"#475569",marginBottom:8,
                  textTransform:"uppercase" as const,letterSpacing:.4}}>
                  PILIH KOMPONEN {selWp}
                </div>
                <div style={{display:"flex",flexWrap:"wrap" as const,gap:6,marginBottom:16}}>
                  {wpItems.map((it:any)=>{
                    const isSel=selKomps.includes(it.kode);
                    const wpC=(WP_COLOR as any)[selWp]||"#94a3b8";
                    return(
                      <button key={it.kode}
                        onClick={()=>setWpPicker((prev:any)=>({
                          ...prev,
                          selKomps:isSel
                            ?prev.selKomps.filter((k:string)=>k!==it.kode)
                            :[...( prev.selKomps||[]),it.kode]
                        }))}
                        style={{border:"1px solid "+(isSel?wpC:"#e2e8f0"),
                          background:isSel?wpC+"15":"#f8fafc",
                          color:isSel?wpC:"#475569",borderRadius:20,
                          padding:"4px 12px",fontSize:11,fontWeight:isSel?600:400,
                          cursor:"pointer",fontFamily:"inherit",transition:"all .13s"}}>
                        {it.nama}
                        <span style={{fontSize:9,color:"#94a3b8",marginLeft:4}}>({it.kode})</span>
                      </button>
                    );
                  })}
                </div>
              </>}

              {/* Tambah button */}
              <button
                onClick={async()=>{
                  await handleAddWP(wpPicker.rowId,wpPicker.date,selWp,selKomps);
                  setWpPicker((prev:any)=>({...prev,selKomps:[]}));
                }}
                style={{width:"100%",height:44,border:"none",
                  background:"#2563eb",borderRadius:8,cursor:"pointer",
                  fontSize:13,fontWeight:700,color:"#fff",fontFamily:"inherit",marginBottom:8}}>
                + Tambah {selWp} ({selKomps.length} komponen)
              </button>

              {/* Selesai */}
              <button onClick={()=>setWpPicker(null)}
                style={{width:"100%",height:36,border:"1px solid #e2e8f0",
                  background:"#16a34a",borderRadius:8,cursor:"pointer",
                  fontSize:12,fontWeight:700,color:"#fff",fontFamily:"inherit"}}>
                Selesai
              </button>
            </div>
          </div>
        );
      })()}`;

if(content.includes(oldModal)){
  content = content.replace(oldModal, newModal);
  console.log('✅ Modal replaced');
} else {
  console.log('❌ Modal not found');
}

// Fix handleAddWP untuk terima komponen
const oldAddWP = `  const handleAddWP=async(rowId:string,date:string,wp:string)=>{
    const row=rawData.find((r:any)=>r.id===rowId);
    if(!row) return;
    const existing=row.jadwal||[];
    const newJadwal=[...existing,{tanggal:date,wp,status:"on_progress"}];
    await updateRaw(rowId,{jadwal:newJadwal});
    logActivity?.({action:"Tambah WP "+wp+" ke Raw Schedule",halaman:"Raw Schedule"});
  };`;

const newAddWP = `  const handleAddWP=async(rowId:string,date:string,wp:string,komps:string[]=[])=>{
    const row=rawData.find((r:any)=>r.id===rowId);
    if(!row) return;
    const existing=row.jadwal||[];
    // Cek kalau sudah ada WP di tanggal yang sama, update komponen
    const existIdx=existing.findIndex((j:any)=>j.tanggal===date&&j.wp===wp);
    let newJadwal;
    if(existIdx!==-1){
      newJadwal=existing.map((j:any,i:number)=>
        i===existIdx?{...j,komponen:[...(j.komponen||[]),...komps.filter(k=>!(j.komponen||[]).includes(k))]}:j
      );
    } else {
      newJadwal=[...existing,{tanggal:date,wp,komponen:komps,status:"on_progress"}];
    }
    await updateRaw(rowId,{jadwal:newJadwal});
    logActivity?.({action:"Tambah "+wp+" ("+komps.length+" komponen) ke Raw Schedule",halaman:"Raw Schedule"});
  };`;

if(content.includes(oldAddWP)){
  content = content.replace(oldAddWP, newAddWP);
  console.log('✅ handleAddWP updated');
} else {
  console.log('❌ handleAddWP not found');
}

// Fix chip WP untuk tampilkan jumlah komponen
const oldChip = `                              <span key={ji}
                                  onClick={()=>handleRemoveWP(row.id,dateStr,j.wp)}
                                  style={{background:isDone?"#16a34a":wpColor,color:"#fff",
                                    borderRadius:4,padding:"2px 6px",fontSize:9,fontWeight:700,
                                    cursor:"pointer",display:"inline-flex",alignItems:"center",gap:2}}>
                                  {isDone?"✓ ":""}{j.wp}
                                </span>`;

const newChip = `                              <span key={ji}
                                  onClick={()=>handleRemoveWP(row.id,dateStr,j.wp)}
                                  style={{background:isDone?"#16a34a":wpColor,color:"#fff",
                                    borderRadius:4,padding:"2px 6px",fontSize:9,fontWeight:700,
                                    cursor:"pointer",display:"inline-flex",alignItems:"center",gap:2}}
                                  title={"Klik untuk hapus "+j.wp}>
                                  {isDone?"✓ ":""}{j.wp}{(j.komponen||[]).length>0?" ("+(j.komponen||[]).length+")":""}
                                </span>`;

if(content.includes(oldChip)){
  content = content.replace(oldChip, newChip);
  console.log('✅ WP chip updated');
} else {
  console.log('❌ WP chip not found');
}

// Fix wpPicker state awal - tambah selWp dan selKomps
const oldPicker = `  const [wpPicker,setWpPicker]=useState<{rowId:string,date:string}|null>(null);`;
const newPicker = `  const [wpPicker,setWpPicker]=useState<{rowId:string,date:string,selWp:string,selKomps:string[]}|null>(null);`;
if(content.includes(oldPicker)){
  content = content.replace(oldPicker, newPicker);
  console.log('✅ wpPicker state updated');
} else {
  console.log('❌ wpPicker state not found');
}

// Fix setWpPicker saat klik +
const oldSetPicker = `onClick={()=>setWpPicker({rowId:row.id,date:dateStr})}`;
const newSetPicker = `onClick={()=>setWpPicker({rowId:row.id,date:dateStr,selWp:"WP1",selKomps:[]})}`;
if(content.includes(oldSetPicker)){
  content = content.replace(oldSetPicker, newSetPicker);
  console.log('✅ setWpPicker click updated');
} else {
  console.log('❌ setWpPicker click not found');
}

fs.writeFileSync('src/App.tsx', content, 'utf8');
console.log('\nDone!');