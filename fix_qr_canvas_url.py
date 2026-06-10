file_path = r"C:\Users\User\vista-teknik\src\App.tsx"

with open(file_path, "r", encoding="utf-8") as f:
    lines = f.readlines()

# Baris 6457 = index 6456
print(f"Baris 6457: {repr(lines[6456].rstrip())}")

lines[6456] = '                  const url="https://vista-teknik-new.vercel.app/mesin?id="+printQR.id;\n'

with open(file_path, "w", encoding="utf-8") as f:
    f.writelines(lines)
print("[OK] URL canvas QR di-hardcode")
print("[INFO] Jalankan: npm run build")
