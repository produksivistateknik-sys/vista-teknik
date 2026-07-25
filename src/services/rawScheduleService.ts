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
    // Sama kayak renharService.getAll() - Supabase/PostgREST default-nya mentok 1000 baris
    // tanpa .range() eksplisit. raw_schedule juga udah lama tembus 1000+ baris (raw_id udah
    // sampai 4000-an), jadi tanpa paginasi ini row2 di luar 1000 pertama gak pernah masuk ke
    // rawList sama sekali - bisa bikin gejala yang sama kayak bug renhar (data hilang dari
    // tampilan meski benar di database) buat panel/WP yang row-nya kepotong.
    let all: any[] = []
    let from = 0
    const pageSize = 1000
    while (true) {
      const { data, error } = await supabase.from('raw_schedule').select('*').order('created_at', { ascending: true }).range(from, from + pageSize - 1)
      if (error) throw new Error(error.message)
      all = all.concat(data ?? [])
      if (!data || data.length < pageSize) break
      from += pageSize
    }
    return all
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
