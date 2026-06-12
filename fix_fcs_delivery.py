file_path = r"C:\Users\User\vista-teknik\src\App.tsx"

with open(file_path, "r", encoding="utf-8", errors="replace") as f:
    lines = f.readlines()

print(f"[OK] File dibaca: {len(lines)} baris")

# Backup
with open(file_path + ".bak_fcs_delivery2", "w", encoding="utf-8", errors="replace") as f:
    f.writelines(lines)
print("[OK] Backup dibuat")

content = "".join(lines)

# Fix 1: Tambah state deliverySim setelah syncing state (baris 7305 area)
OLD_STATE = "  const [syncing,setSyncing]=useState(false);\n"
NEW_STATE = "  const [syncing,setSyncing]=useState(false);\n  const [deliverySim,setDeliverySim]=useState<any[]>([]);\n"

# Fix 2: Update fetchAll - ganti setScheduleList(s??[]) di baris 7336
OLD_FETCH = "    setScheduleList(s??[]);\n    setKapasitasList(k?[k]:[]);\n    setLoading(false);\n"
NEW_FETCH = (
    "    const sd=s??[];\n"
    "    setScheduleList(sd);\n"
    "    setKapasitasList(k?[k]:[]);\n"
    "    const wm:Record<string,string>={};\n"
    "    sd.forEach((r:any)=>{if(!wm[r.wo_number]||r.tanggal>wm[r.wo_number])wm[r.wo_number]=r.tanggal;});\n"
    "    const sim=Object.entries(wm).map(([wn,sf])=>{\n"
    "      const w=woData?.find((x:any)=>x.wo===wn);\n"
    "      const tg=w?.target||null;\n"
    "      let st='no_target';let sl=0;\n"
    "      if(tg){sl=Math.ceil((new Date(sf).getTime()-new Date(tg).getTime())/86400000);if(sl<=-7)st='early';else if(sl<=0)st='ontime';else if(sl<=3)st='warning';else st='late';}\n"
    "      return{woNum:wn,selesaiFCS:sf,target:tg,status:st,selisih:sl,proyek:w?.proyek||wn};\n"
    "    });\n"
    "    setDeliverySim(sim);\n"
    "    setLoading(false);\n"
)

# Fix 3: Tambah UI delivery sim sebelum Filter bar (baris 7430)
OLD_FILTER = "      {/* Filter bar */}\n"
NEW_FILTER = (
    "      {deliverySim.length>0&&(\n"
    "        <div style={{background:'var(--card-bg,#fff)',border:'1px solid var(--border-color,#e2e8f0)',borderRadius:8,padding:'12px 14px',marginBottom:14}}>\n"
    "          <div style={{fontSize:11,fontWeight:700,color:'#64748b',textTransform:'uppercase' as const,letterSpacing:.4,marginBottom:10}}>\n"
    "            Simulasi Delivery\n"
    "          </div>\n"
    "          <div style={{display:'flex',gap:8,flexWrap:'wrap' as const}}>\n"
    "            {deliverySim.map((d:any)=>{\n"
    "              const cm:any={early:{bg:'#f0fdf4',br:'#bbf7d0',c:'#16a34a',ic:'OK',lb:'Lebih Awal'},ontime:{bg:'#eff6ff',br:'#bfdbfe',c:'#1d4ed8',ic:'ON',lb:'On Time'},warning:{bg:'#fffbeb',br:'#fde68a',c:'#d97706',ic:'!!',lb:'Hampir Terlambat'},late:{bg:'#fef2f2',br:'#fecaca',c:'#dc2626',ic:'!!',lb:'Terlambat'},no_target:{bg:'#f8fafc',br:'#e2e8f0',c:'#94a3b8',ic:'?',lb:'No Target'}};\n"
    "              const cf=cm[d.status]||cm.no_target;\n"
    "              return(\n"
    "                <div key={d.woNum} style={{background:cf.bg,border:`1.5px solid ${cf.br}`,borderRadius:10,padding:'10px 14px',minWidth:180}}>\n"
    "                  <div style={{fontSize:11,fontWeight:700,color:cf.c,marginBottom:4}}>{cf.lb}</div>\n"
    "                  <div style={{fontSize:12,fontWeight:700,color:'#1e293b',marginBottom:2}}>WO {d.woNum}</div>\n"
    "                  <div style={{fontSize:11,color:'#64748b',marginBottom:6}}>{d.proyek}</div>\n"
    "                  <div style={{fontSize:10,color:'#94a3b8'}}>Selesai FCS: <strong style={{color:'#475569'}}>{new Date(d.selesaiFCS).toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'})}</strong></div>\n"
    "                  {d.target&&<div style={{fontSize:10,color:'#94a3b8',marginTop:2}}>Target: <strong style={{color:'#475569'}}>{new Date(d.target).toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'})}</strong></div>}\n"
    "                  {d.target&&<div style={{marginTop:6,fontSize:11,fontWeight:700,color:cf.c}}>{d.selisih<0?`${Math.abs(d.selisih)} hari lebih awal`:d.selisih===0?'Tepat waktu':`${d.selisih} hari terlambat`}</div>}\n"
    "                </div>\n"
    "              );\n"
    "            })}\n"
    "          </div>\n"
    "        </div>\n"
    "      )}\n"
    "      {/* Filter bar */}\n"
)

ok1 = OLD_STATE in content
ok2 = OLD_FETCH in content
ok3 = OLD_FILTER in content

print(f"  STATE:   {'FOUND' if ok1 else 'MISSING'}")
print(f"  FETCH:   {'FOUND' if ok2 else 'MISSING'}")
print(f"  FILTER:  {'FOUND' if ok3 else 'MISSING'}")

if ok1 and ok2 and ok3:
    content = content.replace(OLD_STATE, NEW_STATE, 1)
    content = content.replace(OLD_FETCH, NEW_FETCH, 1)
    content = content.replace(OLD_FILTER, NEW_FILTER, 1)
    with open(file_path, "w", encoding="utf-8", errors="replace") as f:
        f.write(content)
    print("[OK] Delivery Simulation berhasil ditambah")
    print("[INFO] Jalankan: npm run build")
else:
    lines2 = content.split("\n")
    if not ok1:
        for i,l in enumerate(lines2):
            if 'setSyncing' in l and 'useState' in l:
                print(f"STATE exact: {repr(lines2[i])}")
    if not ok2:
        for i,l in enumerate(lines2):
            if 'setScheduleList(s??' in l:
                print(f"FETCH exact baris {i+1}:")
                for j in range(i,min(i+4,len(lines2))):
                    print(repr(lines2[j]))
    if not ok3:
        for i,l in enumerate(lines2):
            if 'Filter bar' in l and i > 5000:
                print(f"FILTER exact baris {i+1}: {repr(l)}")
