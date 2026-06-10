file_path = r"C:\Users\User\vista-teknik\src\App.tsx"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

PROD_URL = "https://vista-teknik-new.vercel.app"

# Ganti semua window.location.origin di bagian QR dengan URL production
OLD1 = """const url=window.location.origin+"/mesin?id="+printQR.id;
                const dataUrl=await QRCode.toDataURL(url,"""
NEW1 = f"""const url="{PROD_URL}/mesin?id="+printQR.id;
                const dataUrl=await QRCode.toDataURL(url,"""

OLD2 = """                  if(canvas&&!(canvas as any).__qr_done){
                  (canvas as any).__qr_done=true;
                  const url=window.location.origin+"/mesin?id="+printQR.id;"""
NEW2 = f"""                  if(canvas&&!(canvas as any).__qr_done){{
                  (canvas as any).__qr_done=true;
                  const url="{PROD_URL}/mesin?id="+printQR.id;"""

OLD3 = """              {window.location.origin+"/mesin?id="+printQR.id}"""
NEW3 = f"""              {{"{PROD_URL}/mesin?id="+printQR.id}}"""

ok1 = OLD1 in content
ok2 = OLD2 in content
ok3 = OLD3 in content
print(f"  URL1: {'FOUND' if ok1 else 'MISSING'}")
print(f"  URL2: {'FOUND' if ok2 else 'MISSING'}")
print(f"  URL3: {'FOUND' if ok3 else 'MISSING'}")

if ok1: content = content.replace(OLD1, NEW1)
if ok2: content = content.replace(OLD2, NEW2)
if ok3: content = content.replace(OLD3, NEW3)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)
print(f"[OK] URL QR di-hardcode ke {PROD_URL}")
print("[INFO] Jalankan: npm run build")
