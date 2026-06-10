import re

# ============================================================
# 1. Tambah QRCode library di index.html
# ============================================================
index_path = r"C:\Users\User\vista-teknik\index.html"

with open(index_path, "r", encoding="utf-8") as f:
    html = f.read()

OLD_SHEET = """  <script src="https://cdn.sheetjs.com/xlsx-0.20.0/package/dist/xlsx.full.min.js"></script>"""
NEW_SHEET = """  <script src="https://cdn.sheetjs.com/xlsx-0.20.0/package/dist/xlsx.full.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>"""

if OLD_SHEET in html:
    html = html.replace(OLD_SHEET, NEW_SHEET)
    with open(index_path, "w", encoding="utf-8") as f:
        f.write(html)
    print("[OK] QRCode library ditambah ke index.html")
else:
    print("[FAIL] Pattern index.html tidak cocok")

# ============================================================
# 2. Hapus tag <script> invalid di dalam JSX MasterMesinTab
# ============================================================
app_path = r"C:\Users\User\vista-teknik\src\App.tsx"

with open(app_path, "r", encoding="utf-8") as f:
    content = f.read()

with open(app_path + ".bak_qr2", "w", encoding="utf-8") as f:
    f.write(content)

OLD_SCRIPT_TAG = """      <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"/>
    </div>
  );
}"""

NEW_SCRIPT_TAG = """    </div>
  );
}"""

if OLD_SCRIPT_TAG in content:
    content = content.replace(OLD_SCRIPT_TAG, NEW_SCRIPT_TAG)
    with open(app_path, "w", encoding="utf-8") as f:
        f.write(content)
    print("[OK] Tag <script> invalid dihapus dari JSX")
else:
    print("[WARN] Tag script tidak ditemukan — mungkin sudah bersih")

print("[INFO] Jalankan: npm run build")
