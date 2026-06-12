file_path = r"C:\Users\User\vista-teknik\src\App.tsx"

with open(file_path, "r", encoding="utf-8", errors="replace") as f:
    content = f.read()

with open(file_path + ".bak_fcs_delivery_move", "w", encoding="utf-8", errors="replace") as f:
    f.write(content)
print("[OK] Backup dibuat")

# Hapus delivery sim dari TrackingPekerja (baris ~1015)
OLD_WRONG = (
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
)

DELIVERY_UI = OLD_WRONG

# Cari Filter bar di FCSScheduleTab (baris ~7430 sekarang)
# Kita perlu cari yang tepat di FCSScheduleTab bukan TrackingPekerja
lines = content.split("\n")

# Cari semua "Filter bar" occurrences
filter_bar_positions = []
for i, l in enumerate(lines):
    if '/* Filter bar */' in l:
        filter_bar_positions.append(i)
        print(f"  Filter bar di baris: {i+1}")

# Cari FCSScheduleTab function position
fcs_tab_pos = None
for i, l in enumerate(lines):
    if 'function FCSScheduleTab' in l:
        fcs_tab_pos = i
        print(f"  FCSScheduleTab di baris: {i+1}")
        break

ok_wrong = OLD_WRONG in content
print(f"  WRONG UI: {'FOUND' if ok_wrong else 'MISSING'}")

if ok_wrong and fcs_tab_pos and len(filter_bar_positions) >= 1:
    # Hapus dari posisi salah
    content = content.replace(OLD_WRONG, "", 1)
    print("[OK] Delivery UI dihapus dari TrackingPekerja")
    
    # Sekarang cari Filter bar yang ada di FCSScheduleTab
    lines2 = content.split("\n")
    fcs_filter_idx = None
    for i, l in enumerate(lines2):
        if i > fcs_tab_pos and '/* Filter bar */' in l:
            fcs_filter_idx = i
            print(f"  FCS Filter bar di baris: {i+1}")
            break
    
    if fcs_filter_idx:
        # Insert delivery UI sebelum filter bar di FCSScheduleTab
        lines2.insert(fcs_filter_idx, DELIVERY_UI.rstrip("\n"))
        content = "\n".join(lines2)
        with open(file_path, "w", encoding="utf-8", errors="replace") as f:
            f.write(content)
        print("[OK] Delivery UI dipindah ke FCSScheduleTab")
        print("[INFO] Jalankan: npm run build")
    else:
        print("[FAIL] Filter bar di FCSScheduleTab tidak ditemukan")
        with open(file_path, "w", encoding="utf-8", errors="replace") as f:
            f.write(content)
        print("[INFO] Delivery UI sudah dihapus dari TrackingPekerja, perlu insert manual")
else:
    if not ok_wrong:
        # Cari pattern yang ada
        for i,l in enumerate(lines):
            if 'Simulasi Delivery' in l:
                print(f"Simulasi Delivery di baris {i+1}")
                for j in range(max(0,i-3), min(i+3, len(lines))):
                    print(repr(lines[j][:80]))
