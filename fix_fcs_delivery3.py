file_path = r"C:\Users\User\vista-teknik\src\App.tsx"

with open(file_path, "r", encoding="utf-8", errors="replace") as f:
    content = f.read()

with open(file_path + ".bak_fcs_delivery4", "w", encoding="utf-8", errors="replace") as f:
    f.write(content)
print("[OK] Backup dibuat")

# Fix: Ambil woData langsung dari Supabase di dalam fetchAll
OLD_SIM = (
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
)

NEW_SIM = (
    "    const wm:Record<string,string>={};\n"
    "    sd.forEach((r:any)=>{if(!wm[r.wo_number]||r.tanggal>wm[r.wo_number])wm[r.wo_number]=r.tanggal;});\n"
    "    const woNums=Object.keys(wm);\n"
    "    if(woNums.length>0){\n"
    "      const{data:woRows}=await supabase.from('work_orders').select('wo,proyek,target').in('wo',woNums);\n"
    "      const woMap2:Record<string,any>={};\n"
    "      (woRows||[]).forEach((w:any)=>{woMap2[w.wo]=w;});\n"
    "      const sim=Object.entries(wm).map(([wn,sf])=>{\n"
    "        const w=woMap2[wn];\n"
    "        const tg=w?.target||null;\n"
    "        let st='no_target';let sl=0;\n"
    "        if(tg){sl=Math.ceil((new Date(sf).getTime()-new Date(tg).getTime())/86400000);if(sl<=-7)st='early';else if(sl<=0)st='ontime';else if(sl<=3)st='warning';else st='late';}\n"
    "        return{woNum:wn,selesaiFCS:sf,target:tg,status:st,selisih:sl,proyek:w?.proyek||wn};\n"
    "      });\n"
    "      setDeliverySim(sim);\n"
    "    }\n"
)

ok = OLD_SIM in content
print(f"  SIM: {'FOUND' if ok else 'MISSING'}")

if ok:
    content = content.replace(OLD_SIM, NEW_SIM)
    with open(file_path, "w", encoding="utf-8", errors="replace") as f:
        f.write(content)
    print("[OK] Delivery sim sekarang query Supabase langsung")
    print("[INFO] Jalankan: npm run build")
else:
    lines = content.split("\n")
    for i,l in enumerate(lines):
        if 'setDeliverySim' in l and 'sim' in l:
            print(f"SIM baris {i+1}:")
            for j in range(max(0,i-8),min(i+2,len(lines))):
                print(repr(lines[j]))
            break
