import { supabase } from '../lib/supabase'
import type { WorkOrderInsert, WorkOrderUpdate } from '../types/database'

export const workOrderService = {
  async getAll() {
    const { data, error } = await supabase
      .from('work_orders')
      .select('*, panels(*)')
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

  async remove(id: number): Promise<void> {
    const { error } = await supabase
      .from('work_orders')
      .delete()
      .eq('id', id)
    if (error) throw new Error(error.message)
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
