import { supabase } from '../lib/supabase'
import type { WorkOrderInsert, WorkOrderUpdate } from '../types/database'

export const workOrderService = {
  async getAll() {
    const { data, error } = await supabase
      .from('work_orders')
      .select('*, panels(*)')
      .is('deleted_at', null)
      .order('created_at', { ascending: true })
    if (error) throw new Error(error.message)
    return data ?? []
  },

  async create(payload: WorkOrderInsert) {
    const { data, error } = await supabase
      .from('work_orders')
      .insert(payload)
      .select('*, panels(*)')
      .single()
    if (error) throw new Error(error.message)
    return data
  },

  async update(id: number, payload: WorkOrderUpdate) {
    const { data, error } = await supabase
      .from('work_orders')
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*, panels(*)')
      .single()
    if (error) throw new Error(error.message)
    return data
  },

  // Soft delete WO + cascade ke panels, raw_schedule, renhar
  async remove(id: number, deletedBy?: string): Promise<void> {
    const now = new Date().toISOString()
    const by = deletedBy || 'Admin'
    // Soft delete WO
    await supabase.from('work_orders')
      .update({ deleted_at: now, deleted_by: by })
      .eq('id', id)
    // Cascade soft delete panels
    await supabase.from('panels')
      .update({ deleted_at: now, deleted_by: by })
      .eq('wo_id', id)
    // Cascade soft delete raw_schedule
    await supabase.from('raw_schedule')
      .update({ deleted_at: now, deleted_by: by })
      .eq('wo_id', id)
    // Cascade soft delete renhar
    await supabase.from('renhar')
      .update({ deleted_at: now, deleted_by: by })
      .eq('wo_id', id)
  },

  // Restore WO + cascade restore semua relasi
  async restore(id: number): Promise<void> {
    await supabase.from('work_orders')
      .update({ deleted_at: null, deleted_by: null })
      .eq('id', id)
    await supabase.from('panels')
      .update({ deleted_at: null, deleted_by: null })
      .eq('wo_id', id)
    await supabase.from('raw_schedule')
      .update({ deleted_at: null, deleted_by: null })
      .eq('wo_id', id)
    await supabase.from('renhar')
      .update({ deleted_at: null, deleted_by: null })
      .eq('wo_id', id)
  },

  async savePanels(woId: number, panels: any[]) {
    await supabase.from('panels').delete().eq('wo_id', woId)
    if (panels.length === 0) return []
    const payload = panels.map((p, i) => ({
      wo_id: woId,
      no_pnl: i + 1,
      nama: p.nama,
      tipe: p.tipe,
      qty: p.qty,
      checklist: p.checklist || {},
    }))
    const { data, error } = await supabase
      .from('panels')
      .insert(payload)
      .select()
    if (error) throw new Error(error.message)
    return data ?? []
  },
}
