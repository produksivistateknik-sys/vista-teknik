from pathlib import Path

APP_PATH = Path(r"C:\Users\User\vista-teknik\src\App.tsx")
content = APP_PATH.read_text(encoding="utf-8")

old = """<Btn color="#dc2626" onClick={async()=>{const sess=JSON.parse(localStorage.getItem('vista_admin_session')||'{}');const uname=sess?.nama||sess?.name||'Admin';await supabase.from('work_orders').update({deleted_at:new Date().toISOString(),deleted_by:uname}).eq('id',delId);setWoData(prev=>prev.filter(w=>w.id!==delId));setDelId(null);}}>Hapus</Btn>"""

new = """<Btn color="#dc2626" onClick={async()=>{
  const sess=JSON.parse(localStorage.getItem('vista_admin_session')||'{}');
  const uname=sess?.nama||sess?.name||'Admin';
  const woToDelete=woData.find(w=>w.id===delId);
  // 1. Ambil panel ids
  const panelIds=(woToDelete?.panels||[]).map((p:any)=>p.id);
  // 2. Hapus kendala terkait panel
  if(panelIds.length){
    await supabase.from('kendala').delete().in('panel_id',panelIds);
  }
  // 3. Hapus renhar terkait wo
  await supabase.from('renhar').delete().eq('wo_id',delId);
  // 4. Hapus raw_schedule terkait wo
  await supabase.from('raw_schedule').delete().eq('wo_id',delId);
  // 5. Hapus panels terkait wo
  await supabase.from('panels').delete().eq('wo_id',delId);
  // 6. Hapus work order
  await supabase.from('work_orders').delete().eq('id',delId);
  // 7. Activity log
  await activityLogService.insert({
    user_name:uname,
    action:'HAPUS WO',
    description:'Hapus WO '+woToDelete?.wo+' - '+woToDelete?.proyek+' beserta semua data terkait',
    module:'wo',
    halaman:'Manajemen WO',
    proyek:woToDelete?.proyek||'',
    wo_number:woToDelete?.wo||'',
  });
  // 8. Update local state
  setWoData(prev=>prev.filter(w=>w.id!==delId));
  setRawData(prev=>prev.filter(r=>(r.wo_id||r.woId)!==delId));
  setRenhar(prev=>prev.filter(r=>(r.wo_id||r.woId)!==delId));
  setDelId(null);
}}>Hapus</Btn>"""

if old in content:
    content = content.replace(old, new)
    APP_PATH.write_text(content, encoding="utf-8")
    print("✅ Cascade delete berhasil ditambahkan!")
else:
    print("❌ Pattern not found!")
    # debug
    lines = content.splitlines()
    for i, l in enumerate(lines[3513:3520], 3514):
        print(f"{i}: {l}")
