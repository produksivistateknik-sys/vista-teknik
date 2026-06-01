import { supabase } from '../lib/supabase'

interface LogParams {
  user_id?: string | null
  user_name: string
  action: string
  description: string
  table_name: string
  record_id?: number | string | null
  module?: string
  action_type?: string
  proyek?: string
  panel?: string
  wo_number?: string
  halaman?: string
}

export const activityLogger = async (params: LogParams) => {
  try {
    const payload = {
      user_id: params.user_id || null,
      user_name: params.user_name || 'Unknown',
      action: params.action,
      description: params.description,
      table_name: params.table_name,
      record_id: params.record_id || null,
      admin_nama: params.user_name || 'Unknown',
      aktivitas: params.description,
      module: params.module || 'general',
      action_type: params.action_type || 'update',
      jenis: params.module || 'general',
      proyek: params.proyek || '',
      panel: params.panel || '',
      wo_number: params.wo_number || '',
      halaman: params.halaman || '',
    }
    console.log('[activityLogger] inserting:', payload)
    const { data, error } = await supabase
      .from('activity_log')
      .insert(payload)
      .select()
    if (error) {
      console.error('[activityLogger] ERROR:', error.message, error.details, error.hint)
    } else {
      console.log('[activityLogger] SUCCESS:', params.action, data)
    }
  } catch (e) {
    console.error('[activityLogger] CATCH:', e)
  }
}
