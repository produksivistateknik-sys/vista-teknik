from pathlib import Path
import re

APP_PATH = Path(r"C:\Users\User\vista-teknik\src\App.tsx")
content = APP_PATH.read_text(encoding="utf-8")

# ── Task 1: Hapus USERS array dan PEKERJA_SEED ──
old_users = """const USERS = [
  {id:1, name:"Budi Admin",      divisi:"admin"},
  {id:5, name:"Agus Mekanik",    divisi:"mekanik"},
  {id:6, name:"Dedi Mekanik",    divisi:"mekanik"},
  {id:7, name:"Sari Painting",   divisi:"painting"},
  {id:8, name:"Joko Assembling", divisi:"assembling"},
  {id:9, name:"Tono WCtrl",      divisi:"wiring_ctrl"},
  {id:10,name:"Rudi WPwr",       divisi:"wiring_pwr"},
  {id:11,name:"Dewi QC",         divisi:"qc"},
];"""

if old_users in content:
    content = content.replace(old_users, "// USERS array removed - using Supabase operator_users table")
    print("✅ Task 1a: USERS array removed")
else:
    print("⚠️  USERS array not found exact - trying regex")
    content = re.sub(r'const USERS = \[[\s\S]*?\];', '// USERS array removed - using Supabase operator_users table', content)
    print("✅ Task 1a: USERS array removed via regex")

old_seed = "const PEKERJA_SEED=[];"
if old_seed in content:
    content = content.replace(old_seed, "// PEKERJA_SEED removed")
    print("✅ Task 1b: PEKERJA_SEED removed")
else:
    print("⚠️  PEKERJA_SEED not found")

# ── Task 3: Hapus password dari DIVISI_CONFIG ──
# Password divisi tidak boleh hardcoded di frontend
divisi_passwords = [
    (',password:"Admin123"', ''),
    (',password:"mekanik123"', ''),
    (',password:"painting123"', ''),
    (',password:"assembling123"', ''),
    (',password:"wiring123"', ''),
    (',password:"wiringp123"', ''),
    (',password:"qc123"', ''),
]
pw_count = 0
for old, new in divisi_passwords:
    if old in content:
        content = content.replace(old, new)
        pw_count += 1
if pw_count > 0:
    print(f"✅ Task 3: {pw_count} hardcoded passwords removed dari DIVISI_CONFIG")
else:
    print("⚠️  Passwords not found - sudah dihapus sebelumnya atau format berbeda")

APP_PATH.write_text(content, encoding="utf-8")
print("\n✅ Task 1 & 3 Selesai!")
print("Task 2 (Bell) dan Task 4 (Backup Excel) butuh script terpisah")
