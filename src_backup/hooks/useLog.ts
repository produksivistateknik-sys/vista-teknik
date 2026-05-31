import { supabase } from '../lib/supabase'

export const useLog = () => {
  const log = async (params: {
    admin_nama: string
    module: string
    action_type: string
    description: string
    proyek?: string
    panel?: string
    wo_number?: string
    halaman?: string
  }) => {
    try {
      const { error } = await supabase.from('activity_log').insert({
        action: params.description,
        admin_nama: params.admin_nama,
        user_name: params.admin_nama,
        module: params.module,
        action_type: params.action_type,
        description: params.description,
        aktivitas: params.description,
        jenis: params.module,
        proyek: params.proyek || '',
        panel: params.panel || '',
        wo_number: params.wo_number || '',
        halaman: params.halaman || '',
        table_name: params.module,
      })
      if (error) console.error('[useLog] error:', error.message)
      else console.log('[useLog] success:', params.description)
    } catch (e) {
      console.error('[useLog] catch:', e)
    }
  }
  return { log }
}
