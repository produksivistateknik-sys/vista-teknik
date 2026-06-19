file_path = r"C:\Users\User\vista-teknik\src\services\fcsService.ts"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

with open(file_path + ".bak_before_swap_v2", "w", encoding="utf-8") as f:
    f.write(content)
print("[OK] Backup dibuat")

if "checkKapasitasDanKomponenSwapV2" in content:
    print("[SKIP] Fungsi V2 sudah ada di file, tidak menambah lagi")
else:
    with open("swap_functions_v2_FINAL.ts", "r", encoding="utf-8") as f:
        append_code = f.read()
    
    content = content + "\n\n" + append_code
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)
    print("[OK] Fungsi V2 (checkKapasitasDanKomponenSwapV2, executeSwapKomponenV2) berhasil ditambah (append)")
    print("[INFO] Jalankan: npm run build")
