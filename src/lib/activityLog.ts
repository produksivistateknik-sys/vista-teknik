import { supabase } from '../lib/supabase'

// Global log function - bisa dipanggil langsung tanpa props
export const createLog = async (
  adminNama: string,
  module: string,
  actionType: string,
  description: string,
  woNumber?: string,
  halaman?: string,
  oldData?: any,
  newData?: any
) => {
  console.log('[ActivityLog] creating log:', description)
  const { error } = await supabase.from('activity_log').insert({
    user_id: null,
    user_name: adminNama || 'Admin',
    action: description,
    table_name: halaman || module || '',
    record_id: null,
    old_data: oldData || null,
    new_data: newData || null,
    admin_nama: adminNama || 'Admin',
    aktivitas: description,
    jenis: module,
    wo_no: woNumber || '',
    halaman: halaman || '',
    module: module,
    action_type: actionType,
    description: description,
    wo_number: woNumber || '',
  })
  if (error) {
    console.error('[ActivityLog] FAILED:', error.message, error)
  } else {
    console.log('[ActivityLog] SUCCESS:', description)
  }
}
