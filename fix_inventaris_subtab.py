file_path = r"C:\Users\User\vista-teknik\src\App.tsx"

with open(file_path, "r", encoding="utf-8") as f:
    lines = f.readlines()

# Backup
with open(file_path + ".bak_inventaris", "w", encoding="utf-8") as f:
    f.writelines(lines)
print("[OK] Backup dibuat")

# ============================================================
# Cari range KomponenStokTab (baris 4940 s/d function berikutnya)
# ============================================================
start_idx = None
end_idx = None
for i, l in enumerate(lines):
    if "function KomponenStokTab" in l:
        start_idx = i
    if start_idx and i > start_idx + 10:
        if l.startswith("function ") or l.startswith("export "):
            end_idx = i
            break

print(f"[INFO] KomponenStokTab: baris {start_idx+1} s/d {end_idx}")

# ============================================================
# Fix 1: Tambah prop invTab ke signature (baris start_idx)
# ============================================================
lines[start_idx] = lines[start_idx].replace(
    "function KomponenStokTab({user,activityLog}:any){",
    "function KomponenStokTab({user,activityLog,invTab=\"data\"}:any){"
)
print("[OK] Signature updated")

# ============================================================
# Fix 2: Wrap form (baris 5157-5183) dengan {invTab==="data"&&( ... )}
# Baris 5157 = index 5156, baris 5183 = index 5182
# ============================================================
form_start = 5156  # index (baris 5157)
form_end = 5182    # index (baris 5183) = </Card>

# Tambah kondisi di awal form
lines[form_start] = "      {invTab===\"data\"&&(\n" + lines[form_start]
# Tambah closing setelah </Card>
lines[form_end] = lines[form_end].rstrip() + "\n      )}\n"
print("[OK] Form wrapped")

# ============================================================
# Fix 3: Wrap tabel komponen (baris 5199-5282) dengan {invTab==="data"&&( ... )}
# Setelah ditambah 2 baris di atas, offset +2
# ============================================================
# Recalculate setelah insert — cari ulang pakai content
content = "".join(lines)

# Ganti {/* Tabel Komponen */} dengan kondisi
OLD_TBL = """      {/* Tabel Komponen */}
      {loading?(
        <div style={{textAlign:"center",padding:32,color:"#94a3b8"}}>Memuat...</div>
      ):(
        <div style={{overflowX:"auto" as const,borderRadius:10,border:"1px solid #e2e8f0",marginBottom:16}}>"""

NEW_TBL = """      {invTab==="data"&&(<>
      {/* Tabel Komponen */}
      {loading?(
        <div style={{textAlign:"center",padding:32,color:"#94a3b8"}}>Memuat...</div>
      ):(
        <div style={{overflowX:"auto" as const,borderRadius:10,border:"1px solid #e2e8f0",marginBottom:16}}>"""

OLD_TBL_END = """        </div>
      )}

      {/* Riwayat Transaksi */}"""

NEW_TBL_END = """        </div>
      )}
      </>)}

      {/* Riwayat Transaksi */}
      {invTab==="riwayat"&&(<>"""

# Cari closing riwayat — tepat sebelum Modal Masuk
OLD_RIW_END = """      </div>

      {/* Modal Masuk */}"""

NEW_RIW_END = """      </div>
      </>)}

      {/* Modal Masuk */}"""

ok1 = OLD_TBL in content
ok2 = OLD_TBL_END in content
ok3 = OLD_RIW_END in content

print(f"  TBL_START: {'FOUND' if ok1 else 'MISSING'}")
print(f"  TBL_END:   {'FOUND' if ok2 else 'MISSING'}")
print(f"  RIW_END:   {'FOUND' if ok3 else 'MISSING'}")

if ok1 and ok2 and ok3:
    content = content.replace(OLD_TBL, NEW_TBL)
    content = content.replace(OLD_TBL_END, NEW_TBL_END)
    content = content.replace(OLD_RIW_END, NEW_RIW_END)

    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)
    print("[OK] Semua wrap berhasil")
else:
    # Tulis versi tanpa form wrap (sudah ada di lines) kembali dulu
    with open(file_path, "w", encoding="utf-8") as f:
        f.writelines(lines)
    print("[FAIL] Pattern tabel/riwayat tidak cocok, file dikembalikan ke versi form-wrap saja")

# ============================================================
# Fix 4: Rename label + tambah InventarisWrapper + update render
# ============================================================
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

OLD_LABEL = """    {id:"stok",label:"\U0001f4e6 Stok Komponen"},"""
NEW_LABEL = """    {id:"stok",label:"\U0001f4e6 Inventaris"},"""

OLD_RENDER = """          {subTab==="stok"&&<KomponenStokTab user={user} activityLog={activityLog}/>}"""
NEW_RENDER = """          {subTab==="stok"&&<InventarisWrapper user={user} activityLog={activityLog}/>}"""

INSERT_BEFORE = "function KomponenStokTab("
NEW_WRAPPER = """function InventarisWrapper({user,activityLog}:any){
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

if OLD_LABEL in content: content=content.replace(OLD_LABEL,NEW_LABEL); print("[OK] Label renamed")
if OLD_RENDER in content: content=content.replace(OLD_RENDER,NEW_RENDER); print("[OK] Render updated")
if INSERT_BEFORE in content: content=content.replace(INSERT_BEFORE,NEW_WRAPPER+INSERT_BEFORE,1); print("[OK] InventarisWrapper inserted")

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)
print("[OK] Selesai — jalankan: npm run build")
