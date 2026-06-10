file_path = r"C:\Users\User\vista-teknik\src\App.tsx"

with open(file_path, "r", encoding="utf-8") as f:
    lines = f.readlines()

# Baris 6444 (index 6443) adalah </Modal> tanpa )}
# Perlu tambah )} setelah </Modal>
print(f"Baris 6444: {repr(lines[6443].rstrip())}")
print(f"Baris 6445: {repr(lines[6444].rstrip())}")

# Insert )} setelah baris 6444
lines.insert(6444, "      )}\n")
print("[OK] Tambah )} setelah </Modal> delete")

with open(file_path, "w", encoding="utf-8") as f:
    f.writelines(lines)
print("[INFO] Jalankan: npm run build")
