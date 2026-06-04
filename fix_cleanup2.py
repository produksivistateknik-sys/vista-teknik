from pathlib import Path

APP_PATH = Path(r"C:\Users\User\vista-teknik\src\App.tsx")
content = APP_PATH.read_text(encoding="utf-8")

# Fix 1: Pass woData ke SystemTab sebagai prop
old_systemtab_call = "{tab===\"masteruser\"&&<SystemTab user={user} logActivity={logActivity} activityLog={activityLog} pekerja={pekerja} setPek"
# Cari baris lengkapnya
lines = content.splitlines()
for i, l in enumerate(lines):
    if 'SystemTab' in l and 'tab===' in l:
        old_full = l.strip()
        new_full = old_full.replace(
            "<SystemTab user={user}",
            "<SystemTab user={user} woData={woData}"
        )
        content = content.replace(old_full, new_full)
        print("✅ Fix 1: woData prop added to SystemTab")
        break

# Fix 2: Update SystemTab signature untuk terima woData
old_sig = "function SystemTab({user,activityLog,pekerja,setPekerja,createPekerja,updatePekerja,removePekerja,logActivity}){"
new_sig = "function SystemTab({user,activityLog,pekerja,setPekerja,createPekerja,updatePekerja,removePekerja,logActivity,woData}){"
if old_sig in content:
    content = content.replace(old_sig, new_sig)
    print("✅ Fix 2: SystemTab signature updated")
else:
    print("⚠️  SystemTab signature not found")

# Fix 3: Ganti window.__vt_woData dengan woData prop di backup button
old_win1 = "(window as any).__vt_woData?.forEach((w:any)=>{\n              const pct=woOverall(w);"
new_win1 = "woData?.forEach((w:any)=>{\n              const pct=woOverall(w);"
if old_win1 in content:
    content = content.replace(old_win1, new_win1)
    print("✅ Fix 3a: window.__vt_woData replaced (sheet 1)")
else:
    content = content.replace("(window as any).__vt_woData?.forEach", "woData?.forEach")
    print("✅ Fix 3a: window.__vt_woData replaced via simple replace")

# Fix 4: Hapus window.__vt_woData assignment
old_win_assign = """  (window as any).__vt_woData = woList;
  }"""
new_win_assign = "  }"
if old_win_assign in content:
    content = content.replace(old_win_assign, new_win_assign)
    print("✅ Fix 4: window.__vt_woData assignment removed")
else:
    content = content.replace("    (window as any).__vt_woData = woList;\n", "")
    print("✅ Fix 4: window.__vt_woData assignment removed (variant)")

# Fix 5: Empty catch
old_catch = "}catch{}"
new_catch = "}catch(e){ console.error('Session restore error:',e); }"
if old_catch in content:
    content = content.replace(old_catch, new_catch)
    print("✅ Fix 5: Empty catch fixed")
else:
    print("⚠️  Empty catch not found")

APP_PATH.write_text(content, encoding="utf-8")
print("\n✅ Selesai!")
