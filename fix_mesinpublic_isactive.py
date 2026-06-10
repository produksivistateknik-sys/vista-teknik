file_path = r"C:\Users\User\vista-teknik\src\MesinPublic.tsx"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

OLD = """.eq("mesin_id",mesinId).eq("aktif",true).order("jatuh_tempo",{ascending:true})"""
NEW = """.eq("mesin_id",mesinId).eq("is_active",true).order("jatuh_tempo",{ascending:true})"""

if OLD in content:
    content = content.replace(OLD, NEW)
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)
    print("[OK] Kolom aktif diganti is_active di MesinPublic.tsx")
else:
    print("[FAIL] Pattern tidak ditemukan")
