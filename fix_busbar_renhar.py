from pathlib import Path

APP_PATH = Path(r"C:\Users\User\vista-teknik\src\App.tsx")
content = APP_PATH.read_text(encoding="utf-8")

# Cek apakah createRenhar sudah ada di props RawSchedule
lines = content.splitlines()
for i, l in enumerate(lines[2870:2875], 2871):
    print(f"{i}: {l}")

# Update tombol Selesai untuk juga create/update renhar untuk busbar
old_selesai = """              if(rawRow?.proses==="BUSBAR"){
                const newBusbarSch={...(rawRow?.busbar_schedule||{}),[cellModal.date]:busbarSel};
                setRawData(prev=>prev.map(r=>{
                  if(r.id!==cellModal.rawId)return r;
                  return{...r,busbar_schedule:newBusbarSch};
                }));
                await updateRaw(cellModal.rawId,{busbar_schedule:newBusbarSch});
                const sess=JSON.parse(localStorage.getItem('vista_admin_session')||'{}');
                const uname=user?.name||user?.nama||sess?.nama||'Admin';
                await activityLogService.insert({
                  user_name:uname,
                  action:'JADWAL BUSBAR',
                  description:`Jadwal busbar ${rawRow?.panel} - ${rawRow?.proyek} (${cellModal?.date}): ${busbarSel.join(', ')||'kosong'}`,
                  module:'raw',halaman:'Raw Schedule',
                  proyek:rawRow?.proyek||'',panel:rawRow?.panel||''
                });
              }"""

new_selesai = """              if(rawRow?.proses==="BUSBAR"){
                const newBusbarSch={...(rawRow?.busbar_schedule||{}),[cellModal.date]:busbarSel};
                setRawData(prev=>prev.map(r=>{
                  if(r.id!==cellModal.rawId)return r;
                  return{...r,busbar_schedule:newBusbarSch};
                }));
                await updateRaw(cellModal.rawId,{busbar_schedule:newBusbarSch});
                const sess=JSON.parse(localStorage.getItem('vista_admin_session')||'{}');
                const uname=user?.name||user?.nama||sess?.nama||'Admin';
                // Sync ke renhar
                if(busbarSel.length>0){
                  const existRenhar=renhar.find((r:any)=>
                    (r.raw_id||r.rawId)===cellModal.rawId&&
                    r.tanggal===cellModal.date&&
                    r.wp==="BUSBAR"
                  );
                  const renharPayload={
                    raw_id:cellModal.rawId,
                    wo_id:rawRow?.wo_id||rawRow?.woId,
                    panel_id:rawRow?.panel_id||rawRow?.panelId,
                    panel:rawRow?.panel,
                    proyek:rawRow?.proyek,
                    proses:rawRow?.proses,
                    wp:"BUSBAR",
                    komponen:busbarSel,
                    tanggal:cellModal.date,
                    divisi:"assembling",
                    prioritas:rawRow?.prioritas||"Sedang",
                  };
                  if(existRenhar){
                    await updateRenhar(existRenhar.id,{...renharPayload});
                    setRenhar((prev:any[])=>prev.map((r:any)=>r.id===existRenhar.id?{...r,...renharPayload}:r));
                  } else {
                    const res=await createRenhar(renharPayload);
                    if(res?.success&&res?.data) setRenhar((prev:any[])=>[...prev,res.data]);
                  }
                } else {
                  // Hapus renhar busbar jika kosong
                  const existRenhar=renhar.find((r:any)=>
                    (r.raw_id||r.rawId)===cellModal.rawId&&
                    r.tanggal===cellModal.date&&
                    r.wp==="BUSBAR"
                  );
                  if(existRenhar){
                    await removeRenhar(existRenhar.id);
                    setRenhar((prev:any[])=>prev.filter((r:any)=>r.id!==existRenhar.id));
                  }
                }
                await activityLogService.insert({
                  user_name:uname,
                  action:'JADWAL BUSBAR',
                  description:`Jadwal busbar ${rawRow?.panel} - ${rawRow?.proyek} (${cellModal?.date}): ${busbarSel.join(', ')||'kosong'}`,
                  module:'raw',halaman:'Raw Schedule',
                  proyek:rawRow?.proyek||'',panel:rawRow?.panel||''
                });
              }"""

if old_selesai in content:
    content = content.replace(old_selesai, new_selesai)
    APP_PATH.write_text(content, encoding="utf-8")
    print("✅ Busbar renhar sync added!")
else:
    print("❌ Not found!")
