file_path = r"C:\Users\User\vista-teknik\src\App.tsx"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

with open(file_path + ".bak_inventaris2", "w", encoding="utf-8") as f:
    f.write(content)
print("[OK] Backup dibuat")

# ============================================================
# Pendekatan: display:none instead of conditional JSX
# Jauh lebih aman — tidak ada JSX structure yang berubah
# ============================================================

# Fix 1: Update signature KomponenStokTab
OLD_SIG = """function KomponenStokTab({user,activityLog}:any){"""
NEW_SIG = """function KomponenStokTab({user,activityLog,invTab="data"}:any){"""

# Fix 2: Sembunyikan form pakai style display
OLD_FORM_OPEN = """      {/* Form tambah/edit */}
      <Card style={{marginBottom:14}}>"""
NEW_FORM_OPEN = """      {/* Form tambah/edit */}
      <Card style={{marginBottom:14,display:invTab==="data"?"block":"none"}}>"""

# Fix 3: Sembunyikan tabel komponen + filter pakai div wrapper
OLD_FILTER = """      {/* Filter + Search */}
      <div style={{display:"flex",gap:8,marginBottom:10,flexWrap:"wrap" as const,alignItems:"center"}}>"""
NEW_FILTER = """      {/* Filter + Search */}
      <div style={{display:invTab==="data"?"flex":"none",gap:8,marginBottom:10,flexWrap:"wrap" as const,alignItems:"center"}}>"""

OLD_TBL_WRAP = """      {/* Tabel Komponen */}
      {loading?(
        <div style={{textAlign:"center",padding:32,color:"#94a3b8"}}>Memuat...</div>
      ):(
        <div style={{overflowX:"auto" as const,borderRadius:10,border:"1px solid #e2e8f0",marginBottom:16}}>"""
NEW_TBL_WRAP = """      {/* Tabel Komponen */}
      <div style={{display:invTab==="data"?"block":"none"}}>
      {loading?(
        <div style={{textAlign:"center",padding:32,color:"#94a3b8"}}>Memuat...</div>
      ):(
        <div style={{overflowX:"auto" as const,borderRadius:10,border:"1px solid #e2e8f0",marginBottom:16}}>"""

OLD_TBL_CLOSE = """        </div>
      )}

      {/* Riwayat Transaksi */}"""
NEW_TBL_CLOSE = """        </div>
      )}
      </div>

      {/* Riwayat Transaksi */}"""

# Fix 4: Sembunyikan riwayat transaksi
OLD_RIW = """      {/* Riwayat Transaksi */}
      <div style={{background:"var(--card-bg,#fff)",borderRadius:10,border:"1px solid var(--border-color,#e2e8f0)",overflow:"hidden"}}>"""
NEW_RIW = """      {/* Riwayat Transaksi */}
      <div style={{background:"var(--card-bg,#fff)",borderRadius:10,border:"1px solid var(--border-color,#e2e8f0)",overflow:"hidden",display:invTab==="riwayat"?"block":"none"}}>"""

checks = [
    ("SIG", OLD_SIG),
    ("FORM_OPEN", OLD_FORM_OPEN),
    ("FILTER", OLD_FILTER),
    ("TBL_WRAP", OLD_TBL_WRAP),
    ("TBL_CLOSE", OLD_TBL_CLOSE),
    ("RIW", OLD_RIW),
]
all_ok = True
for name, pattern in checks:
    found = pattern in content
    print(f"  {name}: {'FOUND' if found else 'MISSING'}")
    if not found: all_ok = False

if all_ok:
    content = content.replace(OLD_SIG, NEW_SIG)
    content = content.replace(OLD_FORM_OPEN, NEW_FORM_OPEN)
    content = content.replace(OLD_FILTER, NEW_FILTER)
    content = content.replace(OLD_TBL_WRAP, NEW_TBL_WRAP)
    content = content.replace(OLD_TBL_CLOSE, NEW_TBL_CLOSE)
    content = content.replace(OLD_RIW, NEW_RIW)

    # Fix 5: rename label + wrapper + render
    content = content.replace(
        """    {id:"stok",label:"\U0001f4e6 Stok Komponen"},""",
        """    {id:"stok",label:"\U0001f4e6 Inventaris"},"""
    )
    content = content.replace(
        """          {subTab==="stok"&&<KomponenStokTab user={user} activityLog={activityLog}/>}""",
        """          {subTab==="stok"&&<InventarisWrapper user={user} activityLog={activityLog}/>}"""
    )

    WRAPPER = """function InventarisWrapper({user,activityLog}:any){
  const [invTab,setInvTab]=useState("data");
  const btnS=(active:boolean):any=>({
    padding:"8px 18px",fontSize:12,fontWeight:active?700:500,
    color:active?"#1d4ed8":"#64748b",cursor:"pointer",
    background:active?"#eff6ff":"transparent",
    border:"none",borderBottom:active?"2px solid #1d4ed8":"2px solid transparent",
    fontFamily:"inherit",borderRadius:"6px 6px 0 0",
  });
  return(
    <div>
      <div style={{display:"flex",gap:2,marginBottom:14,borderBottom:"1px solid #e2e8f0"}}>
        <button style={btnS(invTab==="data")} onClick={()=>setInvTab("data")}>\U0001f4cb Data Komponen</button>
        <button style={btnS(invTab==="riwayat")} onClick={()=>setInvTab("riwayat")}>\U0001f552 Riwayat Transaksi</button>
      </div>
      <KomponenStokTab user={user} activityLog={activityLog} invTab={invTab}/>
    </div>
  );
}

"""
    content = content.replace("function KomponenStokTab(", WRAPPER+"function KomponenStokTab(", 1)

    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)
    print("[OK] Semua berhasil — jalankan: npm run build")
else:
    print("[FAIL] Ada pattern missing, file tidak diubah")
