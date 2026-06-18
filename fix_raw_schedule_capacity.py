file_path = r"C:\Users\User\vista-teknik\src\App.tsx"

with open(file_path, "r", encoding="utf-8", errors="replace") as f:
    content = f.read()

with open(file_path + ".bak_raw_capacity", "w", encoding="utf-8", errors="replace") as f:
    f.write(content)
print("[OK] Backup dibuat")

# Fix 1: Tambah state fcsCapacityData di RawSchedule
OLD_STATE = "  const [selPekerja,setSelPekerja]=useState([]);"
NEW_STATE = """  const [selPekerja,setSelPekerja]=useState([]);
  const [fcsCapData,setFcsCapData]=useState<any[]>([]);
  const [fcsKapasitas,setFcsKapasitas]=useState<any[]>([]);

  useEffect(()=>{
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
  },[]);"""

# Fix 2: Tambah capacity utilization bar setelah filter proses, sebelum tabel
OLD_BEFORE_TABLE = """      </div>

      <div style={{overflowX:"auto",overflowY:"auto",maxHeight:"calc(100vh - 120px)",borderRadius:12,border:"1px solid #e2e8f0",boxShadow:"0 1px 4px #00000008"}}>"""

NEW_BEFORE_TABLE = """      </div>

      {fcsCapData.length>0&&(
        <div style={{background:"var(--card-bg,#fff)",border:"1px solid var(--border-color,#e2e8f0)",borderRadius:8,padding:"12px 14px",marginBottom:14}}>
          <div style={{fontSize:11,fontWeight:700,color:"#64748b",textTransform:"uppercase" as const,letterSpacing:.4,marginBottom:10}}>
            \u26a1 Capacity Utilization {filterProses!=="ALL"?"\u2014 "+filterProses:"(semua proses)"}
          </div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap" as const}}>
            {days.map(d=>{
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
              );
            })}
          </div>
        </div>
      )}

      <div style={{overflowX:"auto",overflowY:"auto",maxHeight:"calc(100vh - 120px)",borderRadius:12,border:"1px solid #e2e8f0",boxShadow:"0 1px 4px #00000008"}}>"""

ok1 = OLD_STATE in content
ok2 = OLD_BEFORE_TABLE in content

print(f"  STATE: {'FOUND' if ok1 else 'MISSING'}")
print(f"  TABLE: {'FOUND' if ok2 else 'MISSING'}")

if ok1 and ok2:
    content = content.replace(OLD_STATE, NEW_STATE)
    content = content.replace(OLD_BEFORE_TABLE, NEW_BEFORE_TABLE)
    with open(file_path, "w", encoding="utf-8", errors="replace") as f:
        f.write(content)
    print("[OK] Capacity Utilization bar berhasil ditambah di Raw Schedule")
    print("[INFO] Jalankan: npm run build")
