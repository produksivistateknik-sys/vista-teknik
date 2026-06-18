import shutil

target = r"C:\Users\User\vista-teknik\src\services\fcsService.ts"
backup = target + ".bak_before_override_engine"

shutil.copy(target, backup)
print(f"[OK] Backup dibuat: {backup}")

with open(r"fcsService_FINAL.ts", "r", encoding="utf-8") as f:
    new_content = f.read()

with open(target, "w", encoding="utf-8") as f:
    f.write(new_content)

print("[OK] fcsService.ts berhasil diupdate dengan logic Override Tanggal")
print("[INFO] Jalankan: npm run build")
