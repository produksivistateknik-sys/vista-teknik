hooks = {
    'src/hooks/useRawSchedule.ts': (
        "      await rawScheduleService.remove(id, uname)",
        "      const { error } = await supabase.from('raw_schedule').update({deleted_at: new Date().toISOString(), deleted_by: uname}).eq('id', id)\n      if (error) throw new Error(error.message)"
    ),
    'src/hooks/useRenhar.ts': (
        "      await renharService.remove(id)",
        "      const sess2 = JSON.parse(localStorage.getItem('vista_admin_session') || '{}')\n      const uname2 = sess2?.nama || sess2?.name || 'Admin'\n      const { error } = await supabase.from('renhar').update({deleted_at: new Date().toISOString(), deleted_by: uname2}).eq('id', id)\n      if (error) throw new Error(error.message)"
    ),
}

for path, (old, new) in hooks.items():
    with open(path, encoding='utf-8') as f:
        content = f.read()
    content = content.replace(old, new)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print(path, 'done')
