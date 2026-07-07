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
    const { data, error } = await supabase.from('work_orders').select('*, panels(*)').or('is_archived.is.null,is_archived.eq.false').order('created_at', { ascending: false })
    if (error) throw new Error(error.message)
    return (data ?? []).map(wo => ({
      ...wo,
      panels: Array.isArray(wo.panels) ? wo.panels.map((p: any) => ({
        ...p,
        noPnl: p.no_pnl,
      })) : []
    }))
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
    const { data: existingRows } = await supabase.from('panels').select('id').eq('wo_id', woId)
    const existingIds = new Set((existingRows || []).map((p: any) => p.id))

    const withId = panels.filter(p => p.id && existingIds.has(p.id))
    const withoutId = panels.filter(p => !p.id || !existingIds.has(p.id))
    const keepIds = new Set(withId.map(p => p.id))
    const idsToDelete = [...existingIds].filter(id => !keepIds.has(id))

    if (idsToDelete.length > 0) {
      await supabase.from('panels').delete().in('id', idsToDelete)
    }

    for (const p of withId) {
      const { error } = await supabase.from('panels').update({
        no_pnl: p.noPnl || p.no_pnl || 1,
        nama: p.nama,
        tipe: p.tipe,
        qty: p.qty || 1,
        checklist: p.checklist || {},
        catatan: p.catatan || "",
      }).eq('id', p.id)
      if (error) throw new Error(error.message)
    }

    if (withoutId.length > 0) {
      const rows = withoutId.map(p => ({
        wo_id: woId,
        no_pnl: p.noPnl || p.no_pnl || 1,
        nama: p.nama,
        tipe: p.tipe,
        qty: p.qty || 1,
        checklist: p.checklist || {},
        catatan: p.catatan || "",
      }))
      const { error } = await supabase.from('panels').insert(rows)
      if (error) throw new Error(error.message)
    }
  }
}
