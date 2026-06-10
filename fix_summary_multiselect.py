file_path = r"C:\Users\User\vista-teknik\src\App.tsx"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

with open(file_path + ".bak_summary_filter", "w", encoding="utf-8") as f:
    f.write(content)
print("[OK] Backup dibuat")

# Fix 1: logic filter - ubah single match jadi array
OLD_FILTER = """    const matchS=statusFilter==="semua"||statusFilter===s;
    const matchQ=!search||(w.wo||"").toLowerCase().includes(search.toLowerCase())||(w.proyek||"").toLowerCase().includes(search.toLowerCase())||(w.panels||[]).some((p:any)=>(p.nama||"").toLowerCase().includes(search.toLowerCase()));
    return matchS&&matchQ;"""

NEW_FILTER = """    const matchS=statusFilter.length===0||statusFilter.includes(s);
    const matchQ=!search||(w.wo||"").toLowerCase().includes(search.toLowerCase())||(w.proyek||"").toLowerCase().includes(search.toLowerCase())||(w.panels||[]).some((p:any)=>(p.nama||"").toLowerCase().includes(search.toLowerCase()));
    return matchS&&matchQ;"""

# Fix 2: render buttons - ubah single select jadi multi select + hapus "Semua"
OLD_BTNS = """        <div style={{display:"flex",gap:5,flexWrap:"wrap" as const}}>
          {[
            {v:"semua",l:"Semua"},{v:"selesai",l:"\u2713 Selesai"},
            {v:"ontrack",l:"\u25cf On Track"},{v:"mendesak",l:"\u25cf Mendesak H-7"},{v:"terlambat",l:"\u25cf Terlambat"},
          ].map(f=>{
            const colors:any={semua:"#2563eb",selesai:"#16a34a",ontrack:"#2563eb",mendesak:"#d97706",terlambat:"#dc2626"};
            const bgs:any={semua:"#eff6ff",selesai:"#f0fdf4",ontrack:"#eff6ff",mendesak:"#fffbeb",terlambat:"#fef2f2"};
            const on=statusFilter===f.v;
            return(
              <button key={f.v} onClick={()=>setStatusFilter(f.v)}
                style={{border:"1px solid "+(on?colors[f.v]:"#e2e8f0"),
                  background:on?bgs[f.v]:"#fff",color:on?colors[f.v]:"#64748b",
                  borderRadius:20,padding:"3px 10px",fontSize:10,fontWeight:on?600:400,
                  cursor:"pointer",fontFamily:"inherit"}}>
                {f.l}
              </button>
            );
          })}
        </div>"""

NEW_BTNS = """        <div style={{display:"flex",gap:4,flexWrap:"wrap" as const,alignItems:"center"}}>
          {[
            {v:"ontrack",l:"\u25cf On Track",c:"#2563eb",bg:"#eff6ff"},
            {v:"mendesak",l:"\u25cf Mendesak H-7",c:"#d97706",bg:"#fffbeb"},
            {v:"terlambat",l:"\u25cf Terlambat",c:"#dc2626",bg:"#fef2f2"},
            {v:"selesai",l:"\u2713 Selesai",c:"#16a34a",bg:"#f0fdf4"},
          ].map(f=>{
            const on=statusFilter.includes(f.v);
            return(
              <button key={f.v} onClick={()=>setStatusFilter((prev:string[])=>on?prev.filter(x=>x!==f.v):[...prev,f.v])}
                style={{border:`1.5px solid ${on?f.c:"#e2e8f0"}`,
                  background:on?f.bg:"#fff",color:on?f.c:"#64748b",
                  borderRadius:20,padding:"3px 10px",fontSize:10,fontWeight:on?700:400,
                  cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:4}}>
                {on&&<span style={{width:5,height:5,borderRadius:"50%",background:f.c}}/>}
                {f.l}
              </button>
            );
          })}
          {statusFilter.length>0&&(
            <button onClick={()=>setStatusFilter([])}
              style={{border:"1px solid #fecaca",background:"#fef2f2",color:"#dc2626",
                borderRadius:20,padding:"3px 10px",fontSize:10,cursor:"pointer",fontFamily:"inherit"}}>
              \u2715 Reset
            </button>
          )}
        </div>"""

ok1 = OLD_FILTER in content
ok2 = OLD_BTNS in content

print(f"  FILTER: {'FOUND' if ok1 else 'MISSING'}")
print(f"  BTNS:   {'FOUND' if ok2 else 'MISSING'}")

if ok1 and ok2:
    content = content.replace(OLD_FILTER, NEW_FILTER)
    content = content.replace(OLD_BTNS, NEW_BTNS)
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)
    print("[OK] Summary Progress multi-select filter berhasil diterapkan")
    print("[INFO] Jalankan: npm run build")
else:
    if not ok2:
        lines = content.split("\n")
        for i, line in enumerate(lines):
            if 'statusFilter===f.v' in line:
                print(f"\nExact bytes baris {i-3} s/d {i+8}:")
                for j in range(max(0,i-3), min(i+8, len(lines))):
                    print(repr(lines[j]))
                break
