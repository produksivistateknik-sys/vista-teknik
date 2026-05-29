import { supabase } from '../lib/supabase'

export type ActivityPayload = {
  admin_nama: string
  module: 'auth'|'wo'|'raw'|'rencana'|'progress'|'kendala'|'pekerja'|'general'
  action_type: 'create'|'update'|'delete'|'login'|'logout'|'distribute'
  description: string
  wo_number?: string
  halaman?: string
  old_data?: any
  new_data?: any
  proyek?: string
  panel?: string
}

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

  async log(payload: ActivityPayload) {
    const insertData = {
      user_id: null,
      user_name: payload.admin_nama || 'Admin',
      action: payload.description || payload.action_type,
      table_name: payload.halaman || payload.module || '',
      record_id: null,
      old_data: payload.old_data || null,
      new_data: payload.new_data || null,
      admin_nama: payload.admin_nama || 'Admin',
      aktivitas: payload.description || payload.action_type,
      jenis: payload.module || 'general',
      wo_no: payload.wo_number || '',
      halaman: payload.halaman || '',
      module: payload.module || 'general',
      action_type: payload.action_type || 'update',
      description: payload.description || '',
      wo_number: payload.wo_number || '',
      proyek: payload.proyek || '',
      panel: payload.panel || '',
    }
    const { error } = await supabase.from('activity_log').insert(insertData)
    if (error) {
      console.error('[ActivityLog] error:', error.message, error.details)
    } else {
      console.log('[ActivityLog] success:', payload.description)
    }
  },
}

