import { supabase } from '../lib/supabase'

export const activityLogService = {
  async getAll() {
    const { data, error } = await supabase
      .from('activity_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500)
    if (error) throw new Error(error.message)
    return data ?? []
  },
  async log(payload: {
    admin_id?: number,
    admin_nama: string,
    aktivitas: string,
    jenis: string,
    wo_id?: number,
    wo_no?: string,
    halaman?: string,
    data_before?: any,
    data_after?: any,
  }) {
    const { error } = await supabase.from('activity_log').insert({
      user_name: payload.admin_nama,
      action: payload.aktivitas,
      table_name: payload.halaman || '',
      admin_nama: payload.admin_nama,
      aktivitas: payload.aktivitas,
      jenis: payload.jenis,
      wo_no: payload.wo_no || '',
      halaman: payload.halaman || '',
      old_data: payload.data_before || null,
      new_data: payload.data_after || null,
    })
    if (error) console.error('Activity log error:', error.message)
  },
}
