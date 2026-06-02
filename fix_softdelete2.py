with open('src/App.tsx', encoding='utf-8') as f:
    content = f.read()

# Fix hapus WO - soft delete
old_wo = "await supabase.from('work_orders').delete().eq('id',delId);setWoData(prev=>prev.filter(w=>w.id!==delId));setDelId(null);"
new_wo = "const sess=JSON.parse(localStorage.getItem('vista_admin_session')||'{}');const uname=sess?.nama||sess?.name||'Admin';await supabase.from('work_orders').update({deleted_at:new Date().toISOString(),deleted_by:uname}).eq('id',delId);setWoData(prev=>prev.filter(w=>w.id!==delId));setDelId(null);"
content = content.replace(old_wo, new_wo)

# Fix hapus Kendala - soft delete
old_k = "const { error: delErr } = await supabase.from('kendala').delete().eq('id', id)"
new_k = "const sess=JSON.parse(localStorage.getItem('vista_admin_session')||'{}');const uname=sess?.nama||sess?.name||'Admin';const { error: delErr } = await supabase.from('kendala').update({deleted_at:new Date().toISOString(),deleted_by:uname}).eq('id', id)"
content = content.replace(old_k, new_k)

with open('src/App.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print('App.tsx done')
