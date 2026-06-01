import { supabase } from '../lib/supabase'

export interface LogParams {
  user_id?: string | null
  user_name: string
  action: string
  description: string
  table_name: string
  record_id?: string | null
  module?: string
  action_type?: string
  proyek?: string
  panel?: string
  wo_number?: string
  halaman?: string
}

export const activityLogger = async (params: LogParams): Promise<void> => {
  const userName = params.user_name && params.user_name !== 'Unknown' && params.user_name !== ''
    ? params.user_name
    : 'Admin'
  try {
    const { error } = await supabase.from('activity_log').insert({
      user_id: params.user_id || null,
      user_name: userName,
      action: params.action,
      description: params.description,
      table_name: params.table_name,
      record_id: params.record_id || null,
      admin_nama: userName,
      aktivitas: params.description,
      module: params.module || 'general',
      action_type: params.action_type || 'update',
      jenis: params.module || 'general',
      proyek: params.proyek || '',
      panel: params.panel || '',
      wo_number: params.wo_number || '',
      wo_no: params.wo_number || '',
      halaman: params.halaman || '',
    })
    if (error) {
      console.error('[ActivityLog] ERROR:', error.message, error.details)
    } else {
      console.log('[ActivityLog] OK:', params.action, '-', userName)
    }
  } catch (e) {
    console.error('[ActivityLog] CATCH:', e)
  }
}
