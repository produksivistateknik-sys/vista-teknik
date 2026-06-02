with open('src/hooks/usePekerja.ts', encoding='utf-8') as f:
    content = f.read()

old = """  const remove = async (id: number, user_name?: string) => {
    try {
      const sess = JSON.parse(localStorage.getItem('vista_admin_session') || '{}')
      const uname = user_name || sess?.nama || sess?.name || 'Admin'
      await pekerjaService.remove(id, uname)
      setData(prev => prev.filter(r => r.id !== id))
      return { success: true }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Error' }
    }
  }"""

new = """  const remove = async (id: number, user_name?: string) => {
    try {
      const sess = JSON.parse(localStorage.getItem('vista_admin_session') || '{}')
      const uname = user_name || sess?.nama || sess?.name || 'Admin'
      const { error } = await import('../lib/supabase').then(m => m.supabase.from('pekerja').update({deleted_at: new Date().toISOString(), deleted_by: uname}).eq('id', id))
      if (error) throw new Error(error.message)
      setData(prev => prev.filter(r => r.id !== id))
      return { success: true }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Error' }
    }
  }"""

content = content.replace(old, new)
with open('src/hooks/usePekerja.ts', 'w', encoding='utf-8') as f:
    f.write(content)
print('usePekerja done')
