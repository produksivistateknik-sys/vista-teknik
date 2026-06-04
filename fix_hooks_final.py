from pathlib import Path

APP_PATH = Path(r"C:\Users\User\vista-teknik\src\App.tsx")
content = APP_PATH.read_text(encoding="utf-8")

# 1. Hapus SheetJS useEffect dari posisi salah
old_sheetjs = """  useEffect(()=>{
    // Load SheetJS untuk backup Excel
    if(!(window as any).XLSX){
      const script=document.createElement("script");
      script.src="https://cdn.sheetjs.com/xlsx-0.20.0/package/dist/xlsx.full.min.js";
      script.async=true;
      document.head.appendChild(script);
    }
  },[]);

  useEffect(()=>{
    const saved=localStorage.getItem("vista_admin_session");"""

new_sheetjs = """  useEffect(()=>{
    const saved=localStorage.getItem("vista_admin_session");"""

if old_sheetjs in content:
    content = content.replace(old_sheetjs, new_sheetjs)
    print("✅ SheetJS useEffect removed from wrong position")
else:
    print("❌ SheetJS useEffect not found")

# 2. Tambah SheetJS useEffect setelah semua hooks (sebelum early returns)
old_anchor = """  // Tutup notif saat klik di luar
  useEffect(()=>{"""

new_anchor = """  // Load SheetJS untuk backup Excel
  useEffect(()=>{
    if(!(window as any).XLSX){
      const script=document.createElement("script");
      script.src="https://cdn.sheetjs.com/xlsx-0.20.0/package/dist/xlsx.full.min.js";
      script.async=true;
      document.head.appendChild(script);
    }
  },[]);

  // Tutup notif saat klik di luar
  useEffect(()=>{"""

if old_anchor in content:
    content = content.replace(old_anchor, new_anchor)
    print("✅ SheetJS useEffect moved to correct position")
else:
    print("❌ Anchor not found")

APP_PATH.write_text(content, encoding="utf-8")
print("\n✅ Selesai!")
