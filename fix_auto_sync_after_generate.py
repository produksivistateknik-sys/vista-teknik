file_path = r"C:\Users\User\vista-teknik\src\App.tsx"

with open(file_path, "r", encoding="utf-8", errors="replace") as f:
    content = f.read()

with open(file_path + ".bak_auto_sync_generate", "w", encoding="utf-8", errors="replace") as f:
    f.write(content)
print("[OK] Backup dibuat")

OLD = '''                  for(const panel of panels){
                    const res=await generateFCSSchedule({
                      woId:fcsModal.id,woNumber:fcsModal.wo,proyek:fcsModal.proyek,
                      panelId:panel.id,panelNama:panel.nama,tipePanel:panel.tipe,
                      checklist:panel.checklist||{},
                      jenisPekerjaan:fcsForm.jenisPekerjaan,
                      tanggalMulai:fcsForm.tanggalMulai,
                      generatedBy:uname,
                    });
                    if(res.success)totalCount+=res.count;
                    else errors.push(panel.nama+": "+(res.error||"Error"));
                  }
                  setFcsResult({totalCount,errors,panels:panels.length});
                  setFcsLoading(false);'''

NEW = '''                  for(const panel of panels){
                    const res=await generateFCSSchedule({
                      woId:fcsModal.id,woNumber:fcsModal.wo,proyek:fcsModal.proyek,
                      panelId:panel.id,panelNama:panel.nama,tipePanel:panel.tipe,
                      checklist:panel.checklist||{},
                      jenisPekerjaan:fcsForm.jenisPekerjaan,
                      tanggalMulai:fcsForm.tanggalMulai,
                      generatedBy:uname,
                    });
                    if(res.success)totalCount+=res.count;
                    else errors.push(panel.nama+": "+(res.error||"Error"));
                  }
                  if(totalCount>0){
                    await syncFCSToRawSchedule(fcsModal.wo,fcsForm.jenisPekerjaan,uname);
                  }
                  setFcsResult({totalCount,errors,panels:panels.length});
                  setFcsLoading(false);'''

count = content.count(OLD)
print(f"  PATTERN occurrences: {count}")

if count == 1:
    content = content.replace(OLD, NEW, 1)
    with open(file_path, "w", encoding="utf-8", errors="replace") as f:
        f.write(content)
    print("[OK] Auto-sync ke Raw Schedule berhasil ditambah setelah generate berhasil")
    print("[INFO] Jalankan: npm run build")
else:
    print(f"[FAIL] PATTERN occurrences = {count}, bukan 1. TIDAK menyimpan apapun")
