import { supabase } from '../lib/supabase'

const logActivity = async (user_name: string, action: string, description: string, extra?: any) => {
  await supabase.from('activity_log').insert({
    user_name, action, description,
    module: extra?.module || 'raw',
    halaman: extra?.halaman || 'Raw Schedule',
    proyek: extra?.proyek || '',
    panel: extra?.panel || '',
    wo_number: extra?.wo_number || '',
  })
}

export const rawScheduleService = {
  async getAll() {
    const { data, error } = await supabase.from('raw_schedule').select('*').order('created_at', { ascending: true })
    if (error) throw new Error(error.message)
    return data ?? []
  },

  async create(payload: any, user_name = 'Admin') {
    const { updated_by, ...safe } = payload
    const uname = updated_by || user_name
    const { data, error } = await supabase.from('raw_schedule').insert(safe).select().single()
    if (error) throw new Error(error.message)
    await logActivity(uname, 'TAMBAH RAW SCHEDULE', `Tambah panel ${safe.panel} ke Raw Schedule`, { proyek: safe.proyek, panel: safe.panel, wo_number: safe.wo_id?.toString() })
    return data
  },

  async update(id: number, payload: any, user_name = 'Admin') {
    const { updated_by, ...safe } = payload
    const { data, error } = await supabase.from('raw_schedule').update(safe).eq('id', id).select().single()
    if (error) throw new Error(error.message)
    return data
  },

  async remove(id: number, user_name = 'Admin') {
    const { data: old } = await supabase.from('raw_schedule').select('*').eq('id', id).single()
    const { error } = await supabase.from('raw_schedule').delete().eq('id', id)
    if (error) throw new Error(error.message)
    await logActivity(user_name, 'HAPUS RAW SCHEDULE', `Hapus ${old?.panel} dari Raw Schedule`, { proyek: old?.proyek, panel: old?.panel })
  },
}
