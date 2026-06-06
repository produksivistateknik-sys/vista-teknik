from pathlib import Path

APP_PATH = Path(r"C:\Users\User\vista-teknik\src\App.tsx")
content = APP_PATH.read_text(encoding="utf-8")

# Tambah filter kode ke riwayat
old = """  const riwayat=[...riwayatMasuk,...riwayatKeluar]
    .filter(r=>filterTipe==="ALL"||(filterTipe==="masuk"&&r.tipe==="masuk")||(filterTipe==="keluar"&&r.tipe==="keluar"))
    .sort((a,b)=>b.tanggal?.localeCompare(a.tanggal));"""

new = """  const riwayat=[...riwayatMasuk,...riwayatKeluar]
    .filter(r=>{
      const matchTipe=filterTipe==="ALL"||(filterTipe==="masuk"&&r.tipe==="masuk")||(filterTipe==="keluar"&&r.tipe==="keluar");
      const matchKode=filterKode==="ALL"||r.kode===filterKode;
      const matchSearch=!search||r.nama?.toLowerCase().includes(search.toLowerCase());
      return matchTipe&&matchKode&&matchSearch;
    })
    .sort((a,b)=>b.tanggal?.localeCompare(a.tanggal));"""

if old in content:
    content = content.replace(old, new)
    APP_PATH.write_text(content, encoding="utf-8")
    print("✅ Riwayat filter by kode added!")
else:
    print("❌ Not found!")
