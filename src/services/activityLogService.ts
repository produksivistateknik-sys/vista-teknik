import { supabase } from '../lib/supabase'

export const activityLogService = {
  async insert(payload: {
    user_name: string
    action: string
    description: string
    module: string
    halaman?: string
    proyek?: string
    panel?: string
    wo_number?: string
  }) {
    const { error } = await supabase.from('activity_log').insert({
      user_name: payload.user_name || 'Admin',
      action: payload.action,
      description: payload.description,
      module: payload.module,
      halaman: payload.halaman || '',
      proyek: payload.proyek || '',
      panel: payload.panel || '',
      wo_number: payload.wo_number || '',
    })
    if (error) console.error('[ActivityLog] ERROR:', error.message)
    else console.log('[ActivityLog] OK:', payload.action, '-', payload.user_name)
  }
}
