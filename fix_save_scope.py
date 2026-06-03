from pathlib import Path

APP_PATH = Path(r"C:\Users\User\vista-teknik\src\App.tsx")
content = APP_PATH.read_text(encoding="utf-8")

# Hapus debug log dulu
old_debug = "console.log('DIRTY',String(panelId),kode,nq,oldQty); return{...prev,[String(panelId)]:{...prev[String(panelId)],[kode]:{newQty:nq,oldQty}}};"
new_debug = "return{...prev,[String(panelId)]:{...prev[String(panelId)],[kode]:{newQty:nq,oldQty}}};"
if old_debug in content:
    content = content.replace(old_debug, new_debug)
    print("✅ Debug log removed")

# Fix: saveQtyEdit perlu cari wo dari woData berdasarkan panelId
# karena wo di scope render mungkin stale
old_save = """  const saveQtyEdit=async(wo,panelId)=>{
    const panel=wo.panels.find(p=>p.id===panelId);
    if(!panel)return;
    const{error}=await supabase.from('panels').update({checklist:panel.checklist}).eq('id',panelId);
    if(error){alert('Gagal menyimpan: '+error.message);return;}
    const dirty=dirtyQty[String(panelId)]||{};
    const changes=Object.entries(dirty)
      .filter(([,v])=>(v as any).newQty!==(v as any).oldQty)
      .map(([kode,v])=>{
        const cfg=PANEL_TYPES[panel.tipe];
        const nama=cfg?.wps.flatMap((w:any)=>w.items).find((it:any)=>it.kode===kode)?.nama||kode;
        return nama+': '+(v as any).oldQty+' -> '+(v as any).newQty;
      });
    const sess=JSON.parse(localStorage.getItem('vista_admin_session')||'{}');
    const uname=user?.name||user?.nama||sess?.nama||'Admin';
    await activityLogService.insert({
      user_name:uname,
      action:'EDIT QTY',
      description:'Edit Qty '+panel.nama+' ('+wo.proyek+'): '+changes.join(', '),
      module:'wo',
      halaman:'Manajemen WO',
      proyek:wo.proyek||'',
      panel:panel.nama||'',
      wo_number:wo.wo||'',
    });
    setDirtyQty(prev=>{const n={...prev};delete n[String(panelId)];return n;});
    setOrigChecklist(prev=>{const n={...prev};delete n[String(panelId)];return n;});
  };"""

new_save = """  const saveQtyEdit=async(woArg,panelId)=>{
    // ambil data terbaru dari woData state
    const currentWo=woData.find(w=>w.panels?.some((p:any)=>String(p.id)===String(panelId)))||woArg;
    const panel=currentWo?.panels?.find((p:any)=>String(p.id)===String(panelId));
    if(!panel){alert('Panel tidak ditemukan!');return;}
    console.log('SAVE',panelId,panel.checklist);
    const{error}=await supabase.from('panels').update({checklist:panel.checklist}).eq('id',panel.id);
    if(error){alert('Gagal menyimpan: '+error.message);return;}
    const dirty=dirtyQty[String(panelId)]||{};
    const changes=Object.entries(dirty)
      .filter(([,v])=>(v as any).newQty!==(v as any).oldQty)
      .map(([kode,v])=>{
        const cfg=PANEL_TYPES[panel.tipe];
        const nama=cfg?.wps.flatMap((w:any)=>w.items).find((it:any)=>it.kode===kode)?.nama||kode;
        return nama+': '+(v as any).oldQty+' -> '+(v as any).newQty;
      });
    const sess=JSON.parse(localStorage.getItem('vista_admin_session')||'{}');
    const uname=user?.name||user?.nama||sess?.nama||'Admin';
    const tgl=new Date().toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'});
    await activityLogService.insert({
      user_name:uname,
      action:'EDIT QTY',
      description:'['+tgl+'] Edit Qty '+panel.nama+' ('+currentWo.proyek+'): '+changes.join(', '),
      module:'wo',
      halaman:'Manajemen WO',
      proyek:currentWo.proyek||'',
      panel:panel.nama||'',
      wo_number:currentWo.wo||'',
    });
    setDirtyQty(prev=>{const n={...prev};delete n[String(panelId)];return n;});
    setOrigChecklist(prev=>{const n={...prev};delete n[String(panelId)];return n;});
    alert('Qty berhasil disimpan!');
  };"""

if old_save in content:
    content = content.replace(old_save, new_save)
    print("✅ saveQtyEdit fixed with fresh woData lookup")
else:
    print("❌ saveQtyEdit not found")
    # debug
    idx = content.find("const saveQtyEdit=async")
    if idx != -1:
        print("Found at char:", idx)
        print(repr(content[idx:idx+200]))

APP_PATH.write_text(content, encoding="utf-8")
print("\n✅ Selesai!")
