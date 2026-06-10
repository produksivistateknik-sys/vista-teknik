file_path = r"C:\Users\User\vista-teknik\src\App.tsx"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

OLD = """        is_active:true,"""
NEW = """        is_active:true,is_active:true,"""

# Lebih targeted - cari di fungsi save yang baru kita tambah
OLD_INSERT = """      const{data}=await supabase.from("maintenance_rutin").insert({
        mesin_id:Number(form.mesin_id),jenis_maintenance:form.jenis_maintenance.trim(),
        frekuensi:form.frekuensi,teknisi:form.teknisi,
        terakhir_dilakukan:form.terakhir_dilakukan||null,
        jatuh_tempo:form.jatuh_tempo||null,catatan:form.catatan,
        aktif:true,
      }).select("*,mesin(nama,kode)").single();"""

NEW_INSERT = """      const{data}=await supabase.from("maintenance_rutin").insert({
        mesin_id:Number(form.mesin_id),jenis_maintenance:form.jenis_maintenance.trim(),
        frekuensi:form.frekuensi,teknisi:form.teknisi,
        terakhir_dilakukan:form.terakhir_dilakukan||null,
        jatuh_tempo:form.jatuh_tempo||null,catatan:form.catatan,
        is_active:true,
      }).select("*,mesin(nama,kode)").single();"""

if OLD_INSERT in content:
    content = content.replace(OLD_INSERT, NEW_INSERT)
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)
    print("[OK] Kolom aktif diganti is_active")
    print("[INFO] Jalankan: npm run build")
else:
    print("[FAIL] Pattern tidak cocok")
    lines = content.split("\n")
    for i,l in enumerate(lines):
        if 'aktif:true' in l:
            print(f"Baris {i+1}: {repr(l)}")
