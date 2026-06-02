with open('src/hooks/useKendala.ts', encoding='utf-8') as f:
    c = f.read()

c = c.replace(
    "      await kendalaService.remove(id)",
    "      const sess = JSON.parse(localStorage.getItem('vista_admin_session') || '{}')\n      const uname = sess?.nama || sess?.name || 'Admin'\n      const { error } = await supabase.from('kendala').update({deleted_at: new Date().toISOString(), deleted_by: uname}).eq('id', id)\n      if (error) throw new Error(error.message)"
)

with open('src/hooks/useKendala.ts', 'w', encoding='utf-8') as f:
    f.write(c)
print('useKendala done')
