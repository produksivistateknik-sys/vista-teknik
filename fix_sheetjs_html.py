from pathlib import Path

# 1. Hapus SheetJS useEffect dari App.tsx
APP_PATH = Path(r"C:\Users\User\vista-teknik\src\App.tsx")
content = APP_PATH.read_text(encoding="utf-8")

old_sheetjs = """  // Load SheetJS untuk backup Excel
  useEffect(()=>{
    if(!(window as any).XLSX){
      const script=document.createElement("script");
      script.src="https://cdn.sheetjs.com/xlsx-0.20.0/package/dist/xlsx.full.min.js";
      script.async=true;
      document.head.appendChild(script);
    }
  },[]);

  // Tutup notif saat klik di luar"""

new_sheetjs = """  // Tutup notif saat klik di luar"""

if old_sheetjs in content:
    content = content.replace(old_sheetjs, new_sheetjs)
    APP_PATH.write_text(content, encoding="utf-8")
    print("✅ SheetJS useEffect removed from App.tsx")
else:
    print("❌ Not found in App.tsx")

# 2. Tambah SheetJS ke index.html
HTML_PATH = Path(r"C:\Users\User\vista-teknik\index.html")
html = HTML_PATH.read_text(encoding="utf-8")

old_head = "</head>"
new_head = '  <script src="https://cdn.sheetjs.com/xlsx-0.20.0/package/dist/xlsx.full.min.js"></script>\n</head>'

if old_head in html and "sheetjs" not in html.lower():
    html = html.replace(old_head, new_head)
    HTML_PATH.write_text(html, encoding="utf-8")
    print("✅ SheetJS added to index.html")
else:
    print("⚠️  SheetJS already in index.html or head not found")

print("\n✅ Selesai!")
