with open('src/App.tsx', encoding='utf-8') as f:
    c = f.read()

# Fix 1: Hapus proses (raw schedule row) - tambah soft delete + activity log
old1 = 'onClick={async()=>{await removeRaw(row.id);setRawData(prev=>prev.filter(r=>r.id!==row.id));}}'
new1 = 'onClick={async()=>{const sess=JSON.parse(localStorage.getItem("vista_admin_session")||"{}");const uname=user?.name||user?.nama||sess?.nama||"Admin";await removeRaw(row.id);await activityLogService.insert({user_name:uname,action:"HAPUS RAW SCHEDULE",description:"Hapus proses "+row.proses+" - "+row.panel+" ("+row.proyek+")",module:"raw",halaman:"Raw Schedule",proyek:row.proyek||"",panel:row.panel||""});setRawData(prev=>prev.filter(r=>r.id!==row.id));}}'

# Fix 2: Hapus WP dari cell - tambah activity log
old2 = '    syncRenharDel(cellModal.rawId,cellModal.date,wp);\n    if(updatedRow) await updateRaw(cellModal.rawId,{schedule:updatedRow.schedule});\n  };'
new2 = '    syncRenharDel(cellModal.rawId,cellModal.date,wp);\n    if(updatedRow) await updateRaw(cellModal.rawId,{schedule:updatedRow.schedule});\n    const sess=JSON.parse(localStorage.getItem("vista_admin_session")||"{}");const uname=user?.name||user?.nama||sess?.nama||"Admin";\n    await activityLogService.insert({user_name:uname,action:"HAPUS WP RAW SCHEDULE",description:"Hapus "+wp+" dari jadwal "+rawRow?.panel+" - "+rawRow?.proyek+" ("+cellModal?.date+")",module:"raw",halaman:"Raw Schedule",proyek:rawRow?.proyek||"",panel:rawRow?.panel||""});\n  };'

if old1 in c:
    c = c.replace(old1, new1)
    print('Fix 1 hapus proses: OK')
else:
    print('Fix 1: pattern not found')

if old2 in c:
    c = c.replace(old2, new2)
    print('Fix 2 hapus WP: OK')
else:
    print('Fix 2: pattern not found')

with open('src/App.tsx', 'w', encoding='utf-8') as f:
    f.write(c)
