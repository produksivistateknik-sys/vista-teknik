file_path = r"C:\Users\User\vista-teknik\src\App.tsx"

with open(file_path, "r", encoding="utf-8", errors="replace") as f:
    content = f.read()

with open(file_path + ".bak_override_autoswitch", "w", encoding="utf-8", errors="replace") as f:
    f.write(content)
print("[OK] Backup dibuat")

OLD = """  const saveOverride=async()=>{
    if(!overrideForm.tanggal||!overrideForm.jam_kerja)return;
    if(editOverride){"""

NEW = """  const saveOverride=async()=>{
    if(!overrideForm.tanggal||!overrideForm.jam_kerja)return;
    if(!editOverride){
      const existing=overrideList.find((o:any)=>o.tanggal===overrideForm.tanggal&&o.jenis_pekerjaan===overrideForm.jenis_pekerjaan);
      if(existing){
        setEditOverride(existing);
        setOverrideForm({tanggal:existing.tanggal,jenis_pekerjaan:existing.jenis_pekerjaan,jam_kerja:overrideForm.jam_kerja,efektivitas_pct:overrideForm.efektivitas_pct,keterangan:overrideForm.keterangan});
        return;
      }
    }
    if(editOverride){"""

ok = OLD in content
print(f"  PATTERN: {'FOUND' if ok else 'MISSING'}")

if ok:
    content = content.replace(OLD, NEW)
    with open(file_path, "w", encoding="utf-8", errors="replace") as f:
        f.write(content)
    print("[OK] Auto-switch ke mode Edit jika tanggal+pekerjaan sudah ada")
    print("[INFO] Jalankan: npm run build")
