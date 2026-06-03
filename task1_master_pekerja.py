from pathlib import Path

APP_PATH = Path(r"C:\Users\User\vista-teknik\src\App.tsx")
content = APP_PATH.read_text(encoding="utf-8")

# ── Fix 1: Hapus Master Pekerja dari sidebar ──
old_sidebar = "        {id:\"pekerja\",label:\"Master Pekerja\",icon:\"ti ti-users\"},\n"
if old_sidebar in content:
    content = content.replace(old_sidebar, "")
    print("✅ Fix 1: Master Pekerja dihapus dari sidebar")
else:
    print("❌ Fix 1: not found")

# ── Fix 2: Hapus render tab pekerja di main content ──
old_render = "              {tab===\"pekerja\"&&<MasterPekerja pekerja={pekerja} setPekerja={setPekerja} createPekerja={createPekerja} updatePekerja={updatePekerja} removePekerja={removePekerja} logActivity={logActivity} log={log} user={user}/>}\n"
if old_render in content:
    content = content.replace(old_render, "")
    print("✅ Fix 2: Render tab pekerja dihapus dari main")
else:
    print("❌ Fix 2: not found")

# ── Fix 3: Tambah render MasterPekerja di SystemTab ──
# Cari subTab pekerja di SystemTab dan tambah render-nya
old_subtab_render = "          {subTab===\"recycle\"&&<RecycleBinTab user={user}/>}"
new_subtab_render = """          {subTab===\"pekerja\"&&<MasterPekerja pekerja={pekerja} setPekerja={setPekerja} createPekerja={createPekerja} updatePekerja={updatePekerja} removePekerja={removePekerja} logActivity={logActivity} log={log} user={user}/>}
          {subTab===\"recycle\"&&<RecycleBinTab user={user}/>}"""

if old_subtab_render in content:
    content = content.replace(old_subtab_render, new_subtab_render)
    print("✅ Fix 3: Render MasterPekerja ditambah di SystemTab")
else:
    print("❌ Fix 3: not found")

APP_PATH.write_text(content, encoding="utf-8")
print("\n✅ Task 1 Selesai!")
