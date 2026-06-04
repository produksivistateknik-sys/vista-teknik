from pathlib import Path

APP_PATH = Path(r"C:\Users\User\vista-teknik\src\App.tsx")
content = APP_PATH.read_text(encoding="utf-8")

# Fix: ganti dynamic import SheetJS dengan window.XLSX dari CDN
old_import = """            const XLSX=await import("https://cdn.sheetjs.com/xlsx-0.20.0/package/xlsx.mjs" as any);"""
new_import = """            const XLSX=(window as any).XLSX;
            if(!XLSX){alert("SheetJS belum dimuat, coba refresh halaman.");return;}"""

if old_import in content:
    content = content.replace(old_import, new_import)
    print("✅ Dynamic import replaced with window.XLSX")
else:
    print("❌ Not found")

# Tambah SheetJS CDN script di GCss/head via useEffect di App
old_app_effect = """  useEffect(()=>{
    const saved=localStorage.getItem("vista_admin_session");"""

new_app_effect = """  useEffect(()=>{
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

if old_app_effect in content:
    content = content.replace(old_app_effect, new_app_effect)
    print("✅ SheetJS CDN loader added to App")
else:
    print("❌ App useEffect not found")

APP_PATH.write_text(content, encoding="utf-8")
print("\n✅ Selesai!")
