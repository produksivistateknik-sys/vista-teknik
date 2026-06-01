import { supabase } from '../lib/supabase'

const logActivity = async (user_name: string, action: string, description: string, extra?: any) => {
  await supabase.from('activity_log').insert({
    user_name, action, description,
    module: extra?.module || 'wo',
    halaman: extra?.halaman || 'Manajemen WO',
    proyek: extra?.proyek || '',
    panel: extra?.panel || '',
    wo_number: extra?.wo_number || '',
  })
}

export const workOrderService = {
  async getAll() {
    const { data, error } = await supabase.from('work_orders').select('*, panels(*)').order('created_at', { ascending: false })
    if (error) throw new Error(error.message)
    return (data ?? []).map(wo => ({ ...wo, panels: wo.panels ?? [] }))
  },

  async create(payload: any, user_name = 'Admin') {
    const { updated_by, ...safe } = payload
    const uname = updated_by || user_name
    const { data, error } = await supabase.from('work_orders').insert(safe).select().single()
    if (error) throw new Error(error.message)
    await logActivity(uname, 'TAMBAH WO', `Tambah WO ${safe.wo} - ${safe.proyek}`, { wo_number: safe.wo, proyek: safe.proyek })
    return data
  },

  async update(id: number, payload: any, user_name = 'Admin') {
    const { updated_by, ...safe } = payload
    const uname = updated_by || user_name
    const { data, error } = await supabase.from('work_orders').update(safe).eq('id', id).select().single()
    if (error) throw new Error(error.message)
    await logActivity(uname, 'EDIT WO', `Edit WO ${safe.wo} - ${safe.proyek}`, { wo_number: safe.wo, proyek: safe.proyek })
    return data
  },

  async remove(id: number, user_name = 'Admin') {
    const { data: old } = await supabase.from('work_orders').select('*').eq('id', id).single()
    const { error } = await supabase.from('work_orders').delete().eq('id', id)
    if (error) throw new Error(error.message)
    await logActivity(user_name, 'HAPUS WO', `Hapus WO ${old?.wo} - ${old?.proyek}`, { wo_number: old?.wo, proyek: old?.proyek })
  },

  async savePanels(woId: number, panels: any[]) {
    await supabase.from('panels').delete().eq('wo_id', woId)
    if (!panels.length) return
    const rows = panels.map(p => ({ ...p, wo_id: woId }))
    const { error } = await supabase.from('panels').insert(rows)
    if (error) throw new Error(error.message)
  }
}
