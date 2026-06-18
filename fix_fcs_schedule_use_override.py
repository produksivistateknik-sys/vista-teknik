file_path = r"C:\Users\User\vista-teknik\src\App.tsx"

with open(file_path, "r", encoding="utf-8", errors="replace") as f:
    content = f.read()

with open(file_path + ".bak_fcs_use_override", "w", encoding="utf-8", errors="replace") as f:
    f.write(content)
print("[OK] Backup dibuat")

# Fix 1: fetchAll - ganti query fcs_kapasitas_pekerjaan jadi fcs_kapasitas_override
OLD_FETCH = '''      supabase.from("fcs_kapasitas_pekerjaan").select("*")
        .eq("jenis_pekerjaan",filterPekerjaan)
        .single(),
    ]);
    const sd=s??[];
    setScheduleList(sd);
    setKapasitasList(k?[k]:[]);'''

NEW_FETCH = '''      supabase.from("fcs_kapasitas_override").select("*")
        .eq("jenis_pekerjaan",filterPekerjaan)
        .order("tanggal",{ascending:true}),
    ]);
    const sd=s??[];
    setScheduleList(sd);
    setKapasitasList(k??[]);'''

# Fix 2: kapasitasHarian (single value) -> kapasitasOverrideMap (per tanggal)
OLD_KAPHARIAN = "  const kapasitasHarian=kapasitasList[0]?.kapasitas_menit_hari||420;"
NEW_KAPHARIAN = '''  const kapasitasOverrideMap=useMemo(()=>{
    const map:Record<string,number>={};
    kapasitasList.forEach((k:any)=>{map[k.tanggal]=Number(k.kapasitas_menit);});
    return map;
  },[kapasitasList]);'''

# Fix 3: render capacity bar - pakai kapasitasOverrideMap per tanggal, bukan kapasitasHarian fix
OLD_RENDER = '''          <div style={{fontSize:11,fontWeight:700,color:"#64748b",textTransform:"uppercase" as const,letterSpacing:.4,marginBottom:10}}>
            \u26a1 Capacity Utilization \u2014 {filterPekerjaan} ({kapasitasHarian} mnt/hari)
          </div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap" as const}}>
            {tanggalList.slice(0,14).map(tgl=>{
              const terpakai=kapPerTanggal[tgl]||0;
              const pct=Math.min(Math.round((terpakai/kapasitasHarian)*100),100);
              const color=pct>=95?"#dc2626":pct>=80?"#f59e0b":"#16a34a";
              const bg=pct>=95?"#fef2f2":pct>=80?"#fffbeb":"#f0fdf4";
              return(
                <div key={tgl} style={{background:bg,border:`1px solid ${color}30`,borderRadius:8,padding:"8px 12px",minWidth:100,textAlign:"center" as const}}>
                  <div style={{fontSize:10,color:"#64748b",marginBottom:4}}>{fmtDate(tgl)}</div>
                  <div style={{width:"100%",height:6,background:"#e2e8f0",borderRadius:99,overflow:"hidden",marginBottom:4}}>
                    <div style={{width:pct+"%",height:"100%",background:color,borderRadius:99}}/>
                  </div>
                  <div style={{fontSize:11,fontWeight:700,color}}>{pct}%</div>
                  <div style={{fontSize:9,color:"#94a3b8"}}>{terpakai}/{kapasitasHarian} mnt</div>
                </div>
              );
            })}
          </div>'''

NEW_RENDER = '''          <div style={{fontSize:11,fontWeight:700,color:"#64748b",textTransform:"uppercase" as const,letterSpacing:.4,marginBottom:10}}>
            \u26a1 Capacity Utilization \u2014 {filterPekerjaan} (dari Override Tanggal)
          </div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap" as const}}>
            {tanggalList.slice(0,14).map(tgl=>{
              const terpakai=kapPerTanggal[tgl]||0;
              const kapHari=kapasitasOverrideMap[tgl]||0;
              const adaOverride=kapasitasOverrideMap[tgl]!==undefined;
              const pct=kapHari>0?Math.min(Math.round((terpakai/kapHari)*100),100):0;
              const color=!adaOverride?"#94a3b8":pct>=95?"#dc2626":pct>=80?"#f59e0b":"#16a34a";
              const bg=!adaOverride?"#f8fafc":pct>=95?"#fef2f2":pct>=80?"#fffbeb":"#f0fdf4";
              return(
                <div key={tgl} style={{background:bg,border:`1px solid ${color}30`,borderRadius:8,padding:"8px 12px",minWidth:100,textAlign:"center" as const}}>
                  <div style={{fontSize:10,color:"#64748b",marginBottom:4}}>{fmtDate(tgl)}</div>
                  {!adaOverride?(
                    <div style={{fontSize:9,color:"#dc2626",fontWeight:700,marginBottom:4}}>\u26a0 Belum diatur</div>
                  ):(
                    <>
                      <div style={{width:"100%",height:6,background:"#e2e8f0",borderRadius:99,overflow:"hidden",marginBottom:4}}>
                        <div style={{width:pct+"%",height:"100%",background:color,borderRadius:99}}/>
                      </div>
                      <div style={{fontSize:11,fontWeight:700,color}}>{pct}%</div>
                      <div style={{fontSize:9,color:"#94a3b8"}}>{terpakai}/{kapHari} mnt</div>
                    </>
                  )}
                </div>
              );
            })}
          </div>'''

ok1 = OLD_FETCH in content
ok2 = OLD_KAPHARIAN in content
ok3 = OLD_RENDER in content

print(f"  FETCH:    {'FOUND' if ok1 else 'MISSING'}")
print(f"  KAPHARIAN:{'FOUND' if ok2 else 'MISSING'}")
print(f"  RENDER:   {'FOUND' if ok3 else 'MISSING'}")

if ok1 and ok2 and ok3:
    content = content.replace(OLD_FETCH, NEW_FETCH)
    content = content.replace(OLD_KAPHARIAN, NEW_KAPHARIAN)
    content = content.replace(OLD_RENDER, NEW_RENDER)
    with open(file_path, "w", encoding="utf-8", errors="replace") as f:
        f.write(content)
    print("[OK] FCS Schedule capacity bar sekarang pakai Override Tanggal per hari")
    print("[INFO] Jalankan: npm run build")
