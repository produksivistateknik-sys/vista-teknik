import { supabase } from '../lib/supabase'

const logActivity = async (user_name: string, action: string, description: string, extra?: any) => {
  await supabase.from('activity_log').insert({
    user_name, action, description,
    module: extra?.module || 'raw',
    halaman: extra?.halaman || 'Raw Schedule',
    proyek: extra?.proyek || '',
    panel: extra?.panel || '',
    wo_number: extra?.wo_number || '',
  })
}

export const rawScheduleService = {
  async getAll() {
    // Sama kayak renharService.getAll() - Supabase/PostgREST default-nya mentok 1000 baris
    // tanpa .range() eksplisit. raw_schedule juga udah lama tembus 1000+ baris (raw_id udah
    // sampai 4000-an), jadi tanpa paginasi ini row2 di luar 1000 pertama gak pernah masuk ke
    // rawList sama sekali - bisa bikin gejala yang sama kayak bug renhar (data hilang dari
    // tampilan meski benar di database) buat panel/WP yang row-nya kepotong.
    let all: any[] = []
    let from = 0
    const pageSize = 1000
    while (true) {
      const { data, error } = await supabase.from('raw_schedule').select('*').order('created_at', { ascending: true }).range(from, from + pageSize - 1)
      if (error) throw new Error(error.message)
      all = all.concat(data ?? [])
      if (!data || data.length < pageSize) break
      from += pageSize
    }
    return all
  },

  async create(payload: any, user_name = 'Admin') {
    const { updated_by, ...safe } = payload
    const uname = updated_by || user_name
    const { data, error } = await supabase.from('raw_schedule').insert(safe).select().single()
    if (error) throw new Error(error.message)
    await logActivity(uname, 'TAMBAH RAW SCHEDULE', `Tambah panel ${safe.panel} ke Raw Schedule`, { proyek: safe.proyek, panel: safe.panel, wo_number: safe.wo_id?.toString() })
    return data
  },

  async update(id: number, payload: any, user_name = 'Admin') {
    const { updated_by, ...safe } = payload
    const { data, error } = await supabase.from('raw_schedule').update(safe).eq('id', id).select().single()
    if (error) throw new Error(error.message)
    return data
  },

  async remove(id: number, user_name = 'Admin') {
    const { data: old } = await supabase.from('raw_schedule').select('*').eq('id', id).single()
    const { error } = await supabase.from('raw_schedule').delete().eq('id', id)
    if (error) throw new Error(error.message)
    await logActivity(user_name, 'HAPUS RAW SCHEDULE', `Hapus ${old?.panel} dari Raw Schedule`, { proyek: old?.proyek, panel: old?.panel })
  },

  // FITUR (8 Agu 2026): dipanggil setelah qty komponen diedit di Manajemen WO (grid per-komponen
  // maupun modal Edit WO) - sync qtyPerKomponen yang di-cache di raw_schedule.schedule biar gak
  // basi (dulu cuma dikasih warning manual "cek & tambahkan sendiri"). Komponen yang belum pernah
  // dijadwalkan (gak ada di qtyPerKomponen manapun) DIBIARKAN - sengaja gak bikin row/entry baru,
  // itu tetap lewat Generate Jadwal seperti biasa.
  async syncQtyAfterEdit(panelId: number, changes: { kode: string; newQty: number }[]) {
    if (!changes.length) return
    const { data: rows } = await supabase.from('raw_schedule').select('id,schedule').eq('panel_id', panelId)
    if (!rows || !rows.length) return
    for (const row of rows) {
      const scheduleSrc = row.schedule || {}
      const scheduleNew: any = {}
      Object.keys(scheduleSrc).forEach(tgl => {
        scheduleNew[tgl] = (scheduleSrc[tgl] || []).map((e: any) => ({
          ...e,
          qtyPerKomponen: e.qtyPerKomponen ? { ...e.qtyPerKomponen } : e.qtyPerKomponen,
        }))
      })
      let touched = false
      for (const { kode, newQty } of changes) {
        const occurrences: { tgl: string; idx: number; qty: number }[] = []
        Object.keys(scheduleNew).forEach(tgl => {
          scheduleNew[tgl].forEach((e: any, idx: number) => {
            if (e.qtyPerKomponen && e.qtyPerKomponen[kode] !== undefined) {
              occurrences.push({ tgl, idx, qty: Number(e.qtyPerKomponen[kode]) || 0 })
            }
          })
        })
        if (!occurrences.length) continue
        const sumOld = occurrences.reduce((a, o) => a + o.qty, 0)
        if (sumOld <= 0) continue
        touched = true
        if (occurrences.length === 1) {
          const o = occurrences[0]
          scheduleNew[o.tgl][o.idx].qtyPerKomponen[kode] = newQty
        } else {
          // ke-split di beberapa WP/tanggal (misal pernah digeser) - scale proporsional sesuai
          // rasio alokasi lama, sisa pembulatan dirapihin di occurrence terakhir biar totalnya pas
          let running = 0
          occurrences.forEach((o, i) => {
            const isLast = i === occurrences.length - 1
            const scaled = isLast ? Math.max(0, newQty - running) : Math.max(0, Math.round((o.qty / sumOld) * newQty))
            running += scaled
            scheduleNew[o.tgl][o.idx].qtyPerKomponen[kode] = scaled
          })
        }
      }
      if (touched) {
        await supabase.from('raw_schedule').update({ schedule: scheduleNew }).eq('id', row.id)
      }
    }
  },
}
