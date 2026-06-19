file_path = r"C:\Users\User\vista-teknik\src\App.tsx"

with open(file_path, "r", encoding="utf-8", errors="replace") as f:
    content = f.read()

with open(file_path + ".bak_remove_autosync", "w", encoding="utf-8", errors="replace") as f:
    f.write(content)
print("[OK] Backup dibuat")

OLD = '''                    if(res.success)totalCount+=res.count;
                    else errors.push(panel.nama+": "+(res.error||"Error"));
                  }
                  if(totalCount>0){
                    await syncFCSToRawSchedule(fcsModal.wo,fcsForm.jenisPekerjaan,uname);
                  }
                  setFcsResult({totalCount,errors,panels:panels.length});'''

NEW = '''                    if(res.success)totalCount+=res.count;
                    else errors.push(panel.nama+": "+(res.error||"Error"));
                  }
                  setFcsResult({totalCount,errors,panels:panels.length});'''

count = content.count(OLD)
print(f"  PATTERN occurrences: {count}")

if count == 1:
    content = content.replace(OLD, NEW, 1)
    with open(file_path, "w", encoding="utf-8", errors="replace") as f:
        f.write(content)
    print("[OK] Auto-sync berhasil dihapus, generate sekarang berhenti di FCS Schedule, sync wajib manual")
    print("[INFO] Jalankan: npm run build")
else:
    print(f"[FAIL] PATTERN occurrences = {count}, bukan 1. TIDAK menyimpan apapun")
