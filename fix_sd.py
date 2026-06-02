import os

# ── useRawSchedule.ts ──
with open('src/hooks/useRawSchedule.ts', encoding='utf-8') as f:
    c = f.read()
c = c.replace(
    "      await rawScheduleService.remove(id, uname)",
    "      const { error } = await supabase.from('raw_schedule').update({deleted_at: new Date().toISOString(), deleted_by: uname}).eq('id', id)\n      if (error) throw new Error(error.message)"
)
with open('src/hooks/useRawSchedule.ts', 'w', encoding='utf-8') as f:
    f.write(c)
print('useRawSchedule done')

# ── useRenhar.ts ──
with open('src/hooks/useRenhar.ts', encoding='utf-8') as f:
    c = f.read()
c = c.replace(
    "      await renharService.remove(id)",
    "      const sess2 = JSON.parse(localStorage.getItem('vista_admin_session') || '{}')\n      const uname2 = sess2?.nama || sess2?.name || 'Admin'\n      const { error } = await supabase.from('renhar').update({deleted_at: new Date().toISOString(), deleted_by: uname2}).eq('id', id)\n      if (error) throw new Error(error.message)"
)
with open('src/hooks/useRenhar.ts', 'w', encoding='utf-8') as f:
    f.write(c)
print('useRenhar done')

# ── App.tsx ──
with open('src/App.tsx', encoding='utf-8') as f:
    c = f.read()

# Hapus kendala - soft delete
c = c.replace(
    "removeKendala(k.id)",
    "removeKendala(k.id, user?.name||user?.nama||'Admin')"
)

# Hapus WO soft delete (jika belum)
if "deleted_at:new Date().toISOString(),deleted_by:uname" not in c:
    c = c.replace(
        "await supabase.from('work_orders').delete().eq('id',delId);setWoData(prev=>prev.filter(w=>w.id!==delId));setDelId(null);",
        "const sess=JSON.parse(localStorage.getItem('vista_admin_session')||'{}');const uname=sess?.nama||sess?.name||'Admin';await supabase.from('work_orders').update({deleted_at:new Date().toISOString(),deleted_by:uname}).eq('id',delId);setWoData(prev=>prev.filter(w=>w.id!==delId));setDelId(null);"
    )

with open('src/App.tsx', 'w', encoding='utf-8') as f:
    f.write(c)
print('App.tsx done')
