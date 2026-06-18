file_path = r"C:\Users\User\vista-teknik\src\App.tsx"

with open(file_path, "r", encoding="utf-8", errors="replace") as f:
    content = f.read()

with open(file_path + ".bak_fcs_pilih_panel_ui", "w", encoding="utf-8", errors="replace") as f:
    f.write(content)
print("[OK] Backup dibuat")

# Fix 1: Tambah checkbox list panel SEBELUM grid tanggal+jenis pekerjaan
OLD_GRID = '''          {!fcsResult?(
            <div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>'''

NEW_GRID = '''          {!fcsResult?(
            <div>
              <div style={{marginBottom:14}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                  <div style={{fontSize:11,fontWeight:700,color:"#64748b",textTransform:"uppercase" as const,letterSpacing:.4}}>Pilih Panel ({selectedPanelIds.length}/{(fcsModal.panels||[]).length})</div>
                  <div style={{display:"flex",gap:6}}>
                    <button onClick={()=>setSelectedPanelIds((fcsModal.panels||[]).map((p:any)=>p.id))}
                      style={{fontSize:10,color:"#1d4ed8",background:"none",border:"none",cursor:"pointer",fontWeight:600}}>Pilih Semua</button>
                    <button onClick={()=>setSelectedPanelIds([])}
                      style={{fontSize:10,color:"#dc2626",background:"none",border:"none",cursor:"pointer",fontWeight:600}}>Kosongkan</button>
                  </div>
                </div>
                <div style={{maxHeight:140,overflowY:"auto" as const,border:"1px solid #e2e8f0",borderRadius:8,padding:8}}>
                  {(fcsModal.panels||[]).map((p:any)=>{
                    const checked=selectedPanelIds.includes(p.id);
                    return(
                      <label key={p.id} style={{display:"flex",alignItems:"center",gap:8,padding:"5px 6px",cursor:"pointer",borderRadius:6,background:checked?"#eff6ff":"transparent"}}>
                        <input type="checkbox" checked={checked}
                          onChange={()=>setSelectedPanelIds(prev=>checked?prev.filter(id=>id!==p.id):[...prev,p.id])}/>
                        <span style={{fontSize:12,color:"#1e293b"}}>{p.nama}</span>
                        <span style={{fontSize:10,color:"#94a3b8"}}>({p.tipe})</span>
                      </label>
                    );
                  })}
                </div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>'''

ok1 = OLD_GRID in content
print(f"  GRID: {'FOUND' if ok1 else 'MISSING'}")

# Fix 2: Filter panels di loop generate, dan validasi minimal 1 panel dipilih
OLD_LOOP = '''                <button disabled={fcsLoading} onClick={async()=>{
                  setFcsLoading(true);
                  const sess=JSON.parse(localStorage.getItem("vista_admin_session")||"{}");
                  const uname=user?.name||user?.nama||sess?.nama||"Admin";
                  const panels=fcsModal.panels||[];
                  let totalCount=0;const errors:string[]=[];'''

NEW_LOOP = '''                <button disabled={fcsLoading||selectedPanelIds.length===0} onClick={async()=>{
                  setFcsLoading(true);
                  const sess=JSON.parse(localStorage.getItem("vista_admin_session")||"{}");
                  const uname=user?.name||user?.nama||sess?.nama||"Admin";
                  const panels=(fcsModal.panels||[]).filter((p:any)=>selectedPanelIds.includes(p.id));
                  let totalCount=0;const errors:string[]=[];'''

ok2 = OLD_LOOP in content
print(f"  LOOP: {'FOUND' if ok2 else 'MISSING'}")

# Fix 3: Update style disabled button supaya cocok dengan kondisi baru
OLD_BTNSTYLE = '''                  style={{padding:"8px 20px",borderRadius:8,border:"none",background:fcsLoading?"#94a3b8":"#16a34a",color:"#fff",fontSize:12,fontWeight:700,cursor:fcsLoading?"not-allowed":"pointer",fontFamily:"inherit"}}>
                  {fcsLoading?"Generating...":"\u23f1 Generate Schedule"}'''

NEW_BTNSTYLE = '''                  style={{padding:"8px 20px",borderRadius:8,border:"none",background:(fcsLoading||selectedPanelIds.length===0)?"#94a3b8":"#16a34a",color:"#fff",fontSize:12,fontWeight:700,cursor:(fcsLoading||selectedPanelIds.length===0)?"not-allowed":"pointer",fontFamily:"inherit"}}>
                  {fcsLoading?"Generating...":selectedPanelIds.length===0?"Pilih panel dulu":"\u23f1 Generate Schedule ("+selectedPanelIds.length+" panel)"}'''

ok3 = OLD_BTNSTYLE in content
print(f"  BTNSTYLE: {'FOUND' if ok3 else 'MISSING'}")

if ok1 and ok2 and ok3:
    content = content.replace(OLD_GRID, NEW_GRID)
    content = content.replace(OLD_LOOP, NEW_LOOP)
    content = content.replace(OLD_BTNSTYLE, NEW_BTNSTYLE)
    with open(file_path, "w", encoding="utf-8", errors="replace") as f:
        f.write(content)
    print("[OK] UI checkbox panel + filter generate berhasil ditambah")
    print("[INFO] Jalankan: npm run build")
else:
    print("[FAIL] Ada pattern yang MISSING, TIDAK menyimpan apapun")
