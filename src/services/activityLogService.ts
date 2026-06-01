import { supabase } from '../lib/supabase'

export interface ActivityPayload {
  user_name?: string
  admin_nama?: string
  action: string
  aktivitas: string
  jenis: string
  halaman: string
  wo_no?: string | null
  proyek?: string | null
  panel?: string | null
}

export const activityLogService = {
  async log(payload: ActivityPayload) {
    console.log('[ACTIVITY LOG PAYLOAD]', payload)
    const { error } = await supabase
      .from('activity_log')
      .insert({
        ...payload,
        action: payload.action,
        description: payload.aktivitas,
        table_name: payload.jenis,
        module: payload.jenis,
        action_type: 'update',
        created_at: new Date().toISOString(),
      })
    if (error) {
      console.error('Activity Log Error:', error)
      throw error
    }
  },
  async create(payload: ActivityPayload) {
    return this.log(payload)
  },
}
