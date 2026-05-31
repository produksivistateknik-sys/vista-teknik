import { supabase } from '../lib/supabase'

export const activityLogService = {
  async create(payload: {
    user_name?: string
    admin_nama?: string
    action: string
    aktivitas: string
    jenis: string
    halaman: string
    wo_no?: string | null
    proyek?: string | null
    panel?: string | null
  }) {
    const { error } = await supabase
      .from('activity_log')
      .insert({
        ...payload,
        created_at: new Date().toISOString(),
      })

    if (error) {
      console.error('Activity Log Error:', error)
    }
  },
}