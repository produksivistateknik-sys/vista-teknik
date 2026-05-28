import { supabase } from '../lib/supabase'

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
    console.error('[ActivityLog] FAILED:', error.message)
  } else {
    console.log('[ActivityLog] SUCCESS:', description)
  }
}

export const fixSystemLog = async (adminNama: string, module: string) => {
  if(!adminNama || adminNama === 'System') return
  // Update log System terbaru dengan nama admin yang benar
  const { data } = await supabase
    .from('activity_log')
    .select('id')
    .eq('admin_nama', 'System')
    .eq('module', module)
    .order('created_at', { ascending: false })
    .limit(3)
  if(data && data.length > 0) {
    const ids = data.map((r:any) => r.id)
    await supabase
      .from('activity_log')
      .update({ admin_nama: adminNama, user_name: adminNama })
      .in('id', ids)
  }
}
