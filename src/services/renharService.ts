import { supabase } from '../lib/supabase'
import { activityLogService } from './activityLogService'

export const renharService = {
  async getAll() {
    const { data, error } = await supabase
      .from('renhar').select('*').order('tanggal', { ascending: true })
    if (error) throw new Error(error.message)
    return data ?? []
  },

  async create(payload: any) {
    const { updated_by, ...safe } = payload
    const { data, error } = await supabase
      .from('renhar').insert(safe).select().single()
    if (error) throw new Error(error.message)
    await activityLogService.insert({
      user_name: updated_by || 'Admin',
      action: 'DISTRIBUSI RENHAR',
      description: `Distribusi proses ${safe.proses} - ${safe.panel} (${safe.tanggal})`,
      module: 'rencana',
      halaman: 'Rencana Harian',
      proyek: safe.proyek || '',
      panel: safe.panel || '',
      wo_number: safe.wo_id?.toString() || '',
    })
    return data
  },

  async update(id: number, payload: any) {
    const { updated_by, ...safe } = payload
    const { data, error } = await supabase
      .from('renhar').update({ ...safe, updated_at: new Date().toISOString() })
      .eq('id', id).select().single()
    if (error) throw new Error(error.message)
    await activityLogService.insert({
      user_name: updated_by || 'Admin',
      action: 'UPDATE RENHAR',
      description: `Update distribusi proses ${data.proses} - ${data.panel}`,
      module: 'rencana',
      halaman: 'Rencana Harian',
      proyek: data.proyek || '',
      panel: data.panel || '',
      wo_number: data.wo_id?.toString() || '',
    })
    return data
  },

  async remove(id: number): Promise<void> {
    const { data: old } = await supabase.from('renhar').select('*').eq('id', id).single()
    const { error } = await supabase.from('renhar').delete().eq('id', id)
    if (error) throw new Error(error.message)
    await activityLogService.insert({
      user_name: 'Admin',
      action: 'HAPUS RENHAR',
      description: `Hapus distribusi proses ${old?.proses} - ${old?.panel}`,
      module: 'rencana',
      halaman: 'Rencana Harian',
      proyek: old?.proyek || '',
      panel: old?.panel || '',
    })
  },
}
