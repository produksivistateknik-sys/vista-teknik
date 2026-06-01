import { supabase } from '../lib/supabase'

const logActivity = async (user_name: string, action: string, description: string) => {
  await supabase.from('activity_log').insert({
    user_name, action, description,
    module: 'pekerja',
    halaman: 'Master Pekerja',
  })
}

export const pekerjaService = {
  async getAll() {
    const { data, error } = await supabase.from('pekerja').select('*').order('nama', { ascending: true })
    if (error) throw new Error(error.message)
    return data ?? []
  },

  async create(payload: any, user_name = 'Admin') {
    const { updated_by, ...safe } = payload
    const uname = updated_by || user_name
    const { data, error } = await supabase.from('pekerja').insert(safe).select().single()
    if (error) throw new Error(error.message)
    await logActivity(uname, 'TAMBAH PEKERJA', `Tambah pekerja ${safe.nama} (${safe.divisi})`)
    return data
  },

  async update(id: number, payload: any, user_name = 'Admin') {
    const { updated_by, ...safe } = payload
    const uname = updated_by || user_name
    const { data, error } = await supabase.from('pekerja').update(safe).eq('id', id).select().single()
    if (error) throw new Error(error.message)
    await logActivity(uname, 'EDIT PEKERJA', `Edit pekerja ${safe.nama} (${safe.divisi})`)
    return data
  },

  async remove(id: number, user_name = 'Admin') {
    const { data: old } = await supabase.from('pekerja').select('*').eq('id', id).single()
    const { error } = await supabase.from('pekerja').delete().eq('id', id)
    if (error) throw new Error(error.message)
    await logActivity(user_name, 'HAPUS PEKERJA', `Hapus pekerja ${old?.nama}`)
  },
}
