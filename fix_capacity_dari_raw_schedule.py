file_path = r"C:\Users\User\vista-teknik\src\App.tsx"

with open(file_path, "r", encoding="utf-8", errors="replace") as f:
    content = f.read()

with open(file_path + ".bak_capacity_raw", "w", encoding="utf-8", errors="replace") as f:
    f.write(content)
print("[OK] Backup dibuat")

# Fix: Ganti seluruh blok render capacity bar agar hitung dari rawData, bukan fcsCapData
OLD = '''      {fcsCapData.length>0&&(
        <div style={{background:"var(--card-bg,#fff)",border:"1px solid var(--border-color,#e2e8f0)",borderRadius:8,padding:"12px 14px",marginBottom:14}}>
          <div style={{fontSize:11,fontWeight:700,color:"#64748b",textTransform:"uppercase" as const,letterSpacing:.4,marginBottom:10}}>
            \u26a1 Capacity Utilization {filterProses!=="ALL"?"\u2014 "+filterProses:"(semua proses)"}
          </div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap" as const}}>
            {days.map(d=>{
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
              );
            })}
          </div>
        </div>
      )}'''

count = content.count(OLD)
print(f"  PATTERN occurrences: {count}")

NEW = '''      {fcsKapasitas.length>0&&(
        <div style={{background:"var(--card-bg,#fff)",border:"1px solid var(--border-color,#e2e8f0)",borderRadius:8,padding:"12px 14px",marginBottom:14}}>
          <div style={{fontSize:11,fontWeight:700,color:"#64748b",textTransform:"uppercase" as const,letterSpacing:.4,marginBottom:10}}>
            \u26a1 Capacity Utilization {filterProses!=="ALL"?"\u2014 "+filterProses:"(semua proses)"} <span style={{fontWeight:400,fontSize:9,color:"#94a3b8"}}>(dari Raw Schedule)</span>
          </div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap" as const}}>
            {days.map(d=>{
              const prosesToShow=filterProses==="ALL"?ALL_PROSES:[filterProses];
              let terpakaiTotal=0;let kapasitasTotal=0;let adaOverrideCount=0;
              prosesToShow.forEach((pr:string)=>{
                const ov=fcsKapasitas.find((k:any)=>k.jenis_pekerjaan===pr&&k.tanggal===d);
                if(ov){adaOverrideCount++;kapasitasTotal+=Number(ov.kapasitas_menit);}
                rawData.filter((r:any)=>r.proses===pr).forEach((r:any)=>{
                  const panelId=r.panel_id||r.panelId;
                  const panelData=woData.flatMap((w:any)=>w.panels||[]).find((p:any)=>Number(p.id)===Number(panelId));
                  if(!panelData)return;
                  const entries=r.schedule?.[d]||[];
                  entries.forEach((e:any)=>{
                    (e.komponen||[]).forEach((kode:string)=>{
                      const qty=panelData.checklist?.[kode]?.qty||0;
                      const menitPcs=getMenitPerPcs(panelData.tipe,pr,kode);
                      terpakaiTotal+=qty*menitPcs;
                    });
                  });
                });
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
              );
            })}
          </div>
        </div>
      )}'''

if count == 1:
    content = content.replace(OLD, NEW, 1)
    with open(file_path, "w", encoding="utf-8", errors="replace") as f:
        f.write(content)
    print("[OK] Capacity bar sekarang dihitung dari Raw Schedule (schedule + checklist.qty + process_time)")
    print("[INFO] Jalankan: npm run build")
else:
    print(f"[FAIL] PATTERN occurrences = {count}, bukan 1. TIDAK menyimpan apapun")
