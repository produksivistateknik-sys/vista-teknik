file_path = r"C:\Users\User\vista-teknik\src\App.tsx"

with open(file_path, "r", encoding="utf-8", errors="replace") as f:
    content = f.read()

with open(file_path + ".bak_raw_use_override", "w", encoding="utf-8", errors="replace") as f:
    f.write(content)
print("[OK] Backup dibuat")

# Fix 1: ganti fetchCap query fcs_kapasitas_pekerjaan -> fcs_kapasitas_override (di RawSchedule, baris ~3226)
OLD_FETCHCAP = '''  useEffect(()=>{
    const fetchCap=async()=>{
      const [{data:s},{data:k}]=await Promise.all([
        supabase.from("fcs_schedule").select("tanggal,jenis_pekerjaan,total_menit").neq("status","cancelled"),
        supabase.from("fcs_kapasitas_pekerjaan").select("jenis_pekerjaan,kapasitas_menit_hari"),
      ]);
      setFcsCapData(s??[]);
      setFcsKapasitas(k??[]);
    };
    fetchCap();
    const ch=supabase.channel("realtime-fcs-cap-raw")
      .on("postgres_changes",{event:"*",schema:"public",table:"fcs_schedule"},fetchCap)
      .subscribe();
    return()=>{supabase.removeChannel(ch);};
  },[]);'''

NEW_FETCHCAP = '''  useEffect(()=>{
    const fetchCap=async()=>{
      const [{data:s},{data:k}]=await Promise.all([
        supabase.from("fcs_schedule").select("tanggal,jenis_pekerjaan,total_menit").neq("status","cancelled"),
        supabase.from("fcs_kapasitas_override").select("tanggal,jenis_pekerjaan,kapasitas_menit"),
      ]);
      setFcsCapData(s??[]);
      setFcsKapasitas(k??[]);
    };
    fetchCap();
    const ch=supabase.channel("realtime-fcs-cap-raw")
      .on("postgres_changes",{event:"*",schema:"public",table:"fcs_schedule"},fetchCap)
      .on("postgres_changes",{event:"*",schema:"public",table:"fcs_kapasitas_override"},fetchCap)
      .subscribe();
    return()=>{supabase.removeChannel(ch);};
  },[]);'''

count_fetchcap = content.count(OLD_FETCHCAP)
print(f"  FETCHCAP occurrences: {count_fetchcap}")

# Fix 2: render capacity bar - lookup kapasitas per tanggal+proses (bukan per proses saja)
OLD_RENDER = '''            {days.map(d=>{
              const prosesToShow=filterProses==="ALL"?ALL_PROSES:[filterProses];
              let terpakaiTotal=0;let kapasitasTotal=0;
              prosesToShow.forEach((pr:string)=>{
                const kap=fcsKapasitas.find((k:any)=>k.jenis_pekerjaan===pr);
                const kapVal=kap?.kapasitas_menit_hari||420;
                kapasitasTotal+=kapVal;
                const terpakai=fcsCapData.filter((s:any)=>s.tanggal===d&&s.jenis_pekerjaan===pr).reduce((sum:number,s:any)=>sum+Number(s.total_menit),0);
                terpakaiTotal+=terpakai;
              });
              const pct=kapasitasTotal>0?Math.min(Math.round((terpakaiTotal/kapasitasTotal)*100),100):0;
              const color=pct>=95?"#dc2626":pct>=80?"#f59e0b":"#16a34a";
              const bg=pct>=95?"#fef2f2":pct>=80?"#fffbeb":"#f0fdf4";
              return(
                <div key={d} style={{background:bg,border:`1px solid ${color}30`,borderRadius:8,padding:"8px 12px",minWidth:100,textAlign:"center" as const}}>
                  <div style={{fontSize:10,color:"#64748b",marginBottom:4}}>{getDayLabel(d)}</div>
                  <div style={{width:"100%",height:6,background:"#e2e8f0",borderRadius:99,overflow:"hidden",marginBottom:4}}>
                    <div style={{width:pct+"%",height:"100%",background:color,borderRadius:99}}/>
                  </div>
                  <div style={{fontSize:11,fontWeight:700,color}}>{pct}%</div>
                  <div style={{fontSize:9,color:"#94a3b8"}}>{Math.round(terpakaiTotal)}/{kapasitasTotal} mnt</div>
                </div>
              );'''

NEW_RENDER = '''            {days.map(d=>{
              const prosesToShow=filterProses==="ALL"?ALL_PROSES:[filterProses];
              let terpakaiTotal=0;let kapasitasTotal=0;let adaOverrideCount=0;
              prosesToShow.forEach((pr:string)=>{
                const ov=fcsKapasitas.find((k:any)=>k.jenis_pekerjaan===pr&&k.tanggal===d);
                if(ov){adaOverrideCount++;kapasitasTotal+=Number(ov.kapasitas_menit);}
                const terpakai=fcsCapData.filter((s:any)=>s.tanggal===d&&s.jenis_pekerjaan===pr).reduce((sum:number,s:any)=>sum+Number(s.total_menit),0);
                terpakaiTotal+=terpakai;
              });
              const adaOverride=adaOverrideCount>0;
              const pct=kapasitasTotal>0?Math.min(Math.round((terpakaiTotal/kapasitasTotal)*100),100):0;
              const color=!adaOverride?"#94a3b8":pct>=95?"#dc2626":pct>=80?"#f59e0b":"#16a34a";
              const bg=!adaOverride?"#f8fafc":pct>=95?"#fef2f2":pct>=80?"#fffbeb":"#f0fdf4";
              return(
                <div key={d} style={{background:bg,border:`1px solid ${color}30`,borderRadius:8,padding:"8px 12px",minWidth:100,textAlign:"center" as const}}>
                  <div style={{fontSize:10,color:"#64748b",marginBottom:4}}>{getDayLabel(d)}</div>
                  {!adaOverride?(
                    <div style={{fontSize:9,color:"#dc2626",fontWeight:700,marginBottom:4}}>\u26a0 Belum diatur</div>
                  ):(
                    <>
                      <div style={{width:"100%",height:6,background:"#e2e8f0",borderRadius:99,overflow:"hidden",marginBottom:4}}>
                        <div style={{width:pct+"%",height:"100%",background:color,borderRadius:99}}/>
                      </div>
                      <div style={{fontSize:11,fontWeight:700,color}}>{pct}%</div>
                      <div style={{fontSize:9,color:"#94a3b8"}}>{Math.round(terpakaiTotal)}/{kapasitasTotal} mnt</div>
                    </>
                  )}
                </div>
              );'''

count_render = content.count(OLD_RENDER)
print(f"  RENDER occurrences: {count_render}")

if count_fetchcap >= 1 and count_render == 1:
    content = content.replace(OLD_FETCHCAP, NEW_FETCHCAP)  # replace semua occurrence (RencanaHarian + RawSchedule)
    content = content.replace(OLD_RENDER, NEW_RENDER, 1)  # hanya 1 yang ada render-nya (RawSchedule)
    with open(file_path, "w", encoding="utf-8", errors="replace") as f:
        f.write(content)
    print("[OK] Raw Schedule (+ RencanaHarian fetch) capacity bar sekarang pakai Override Tanggal")
    print("[INFO] Jalankan: npm run build")
else:
    print("[FAIL] Jumlah occurrence tidak sesuai ekspektasi, cek manual")
