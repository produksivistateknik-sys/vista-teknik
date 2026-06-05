from pathlib import Path

APP_PATH = Path(r"C:\Users\User\vista-teknik\src\App.tsx")
content = APP_PATH.read_text(encoding="utf-8")

# Ganti tombol Selesai dengan fungsi yang save busbar juga
old_selesai = """          <div style={{marginTop:16,display:"flex",justifyContent:"flex-end"}}>
            <Btn color="#16a34a" onClick={()=>setCellModal(null)}>Selesai</Btn>
          </div>
        </Modal>
      )}"""

new_selesai = """          <div style={{marginTop:16,display:"flex",justifyContent:"flex-end"}}>
            <Btn color="#16a34a" onClick={async()=>{
              // Save busbar schedule saat klik Selesai
              if(rawRow?.proses==="BUSBAR"){
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
              }
              setCellModal(null);
            }}>Selesai</Btn>
          </div>
        </Modal>
      )}"""

if old_selesai in content:
    content = content.replace(old_selesai, new_selesai)
    APP_PATH.write_text(content, encoding="utf-8")
    print("✅ Busbar save on Selesai button fixed!")
else:
    print("❌ Not found!")
