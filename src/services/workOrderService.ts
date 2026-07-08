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
        tingkat_kesulitan: p.tingkatKesulitan || p.tingkat_kesulitan || "EASY",
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
        tingkat_kesulitan: p.tingkatKesulitan || p.tingkat_kesulitan || "EASY",
      }))
      const { error } = await supabase.from('panels').insert(rows)
      if (error) throw new Error(error.message)
    }
  },

  async findOrCreateSiblingWO(wo: string, proyek: string, target: string, uname = 'Admin') {
    const { data: existing } = await supabase.from('work_orders')
      .select('id').eq('wo', wo).eq('proyek', proyek).eq('target', target).limit(1)
    if (existing && existing.length > 0) return existing[0].id
    const { data, error } = await supabase.from('work_orders')
      .insert({ wo, proyek, target }).select().single()
    if (error) throw new Error(error.message)
    await logActivity(uname, 'TAMBAH WO', `Tambah WO ${wo} - ${proyek} (split tanggal ${target})`, { wo_number: wo, proyek })
    return data.id
  },

  async saveWOWithSplit(
    editWoId: number,
    wo: string,
    proyek: string,
    mainTarget: string,
    groupedPanels: { tanggal: string; panels: any[] }[],
    uname = 'Admin'
  ) {
    const { data: existingRows } = await supabase.from('panels').select('id').eq('wo_id', editWoId)
    const existingIds = new Set((existingRows || []).map((p: any) => p.id))

    const allIncomingIds = new Set<number>()
    groupedPanels.forEach(g => g.panels.forEach((p: any) => { if (p.id) allIncomingIds.add(p.id) }))

    const idsToDelete = [...existingIds].filter(id => !allIncomingIds.has(id))
    if (idsToDelete.length > 0) {
      await supabase.from('renhar').delete().in('panel_id', idsToDelete)
      await supabase.from('raw_schedule').delete().in('panel_id', idsToDelete)
      await supabase.from('fcs_schedule').delete().in('panel_id', idsToDelete)
      await supabase.from('panels').delete().in('id', idsToDelete)
    }

    for (const g of groupedPanels) {
      let targetWoId = editWoId
      if (g.tanggal && g.tanggal !== mainTarget) {
        targetWoId = await this.findOrCreateSiblingWO(wo, proyek, g.tanggal, uname)
      }
      for (const p of g.panels) {
        const row = {
          wo_id: targetWoId,
          no_pnl: p.noPnl || p.no_pnl || 1,
          nama: p.nama,
          tipe: p.tipe,
          qty: p.qty || 1,
          checklist: p.checklist || {},
          catatan: p.catatan || "",
          tingkat_kesulitan: p.tingkatKesulitan || p.tingkat_kesulitan || "EASY",
        }
        if (p.id) {
          const { error } = await supabase.from('panels').update(row).eq('id', p.id)
          if (error) throw new Error(error.message)
        } else {
          const { error } = await supabase.from('panels').insert(row)
          if (error) throw new Error(error.message)
        }
      }
    }

    const { data: sisaPanel } = await supabase.from('panels').select('id').eq('wo_id', editWoId).limit(1)
    if (!sisaPanel || sisaPanel.length === 0) {
      await supabase.from('renhar').delete().eq('wo_id', editWoId)
      await supabase.from('raw_schedule').delete().eq('wo_id', editWoId)
      await supabase.from('fcs_schedule').delete().eq('wo_id', editWoId)
      await supabase.from('work_orders').delete().eq('id', editWoId)
    }
  }
}
