file_path = r"C:\Users\User\vista-teknik\src\App.tsx"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# Fix: </Card>} tidak valid JSX - harus pakai conditional wrapper yang benar
OLD = """      {/* Form tambah/edit - hanya tampil di tab Data Komponen */}
      {invTab==="data"&&<Card style={{marginBottom:14}}>"""

NEW = """      {/* Form tambah/edit - hanya tampil di tab Data Komponen */}
      {invTab==="data"&&(<Card style={{marginBottom:14}}>"""

OLD_CLOSE = """        </div>
        </div>
      </Card>}"""

NEW_CLOSE = """        </div>
        </div>
      </Card>)}"""

ok1 = OLD in content
ok2 = OLD_CLOSE in content
print(f"  OPEN:  {'FOUND' if ok1 else 'MISSING'}")
print(f"  CLOSE: {'FOUND' if ok2 else 'MISSING'}")

if ok1 and ok2:
    content = content.replace(OLD, NEW)
    content = content.replace(OLD_CLOSE, NEW_CLOSE)
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)
    print("[OK] JSX fix berhasil")
    print("[INFO] Jalankan: npm run build")
else:
    lines = content.split("\n")
    for i,l in enumerate(lines):
        if "</Card>}" in l:
            print(f"Baris {i+1}: {repr(l)}")
