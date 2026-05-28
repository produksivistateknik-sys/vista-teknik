import { supabase } from '../lib/supabase'

export const setAdminSession = async (adminNama: string) => {
  try {
    await supabase.rpc('set_current_admin', { admin_name: adminNama || 'Admin' })
  } catch(e) {
    console.error('[setAdminSession] error:', e)
  }
}

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
  // Set session variable agar trigger bisa baca nama admin
  await setAdminSession(adminNama)
  
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
  // Cari log System yang dibuat dalam 10 detik terakhir
  const tenSecondsAgo = new Date(Date.now() - 10000).toISOString()
  const { data } = await supabase
    .from('activity_log')
    .select('id')
    .eq('admin_nama', 'System')
    .eq('module', module)
    .gte('created_at', tenSecondsAgo)
    .order('created_at', { ascending: false })
    .limit(10)
  if(data && data.length > 0) {
    const { error } = await supabase
      .from('activity_log')
      .update({ admin_nama: adminNama, user_name: adminNama })
      .in('id', data.map((r:any) => r.id))
    if(!error) console.log('[ActivityLog] fixed System ->', adminNama, 'count:', data.length)
    else console.error('[ActivityLog] fixSystemLog error:', error.message)
  }
}

