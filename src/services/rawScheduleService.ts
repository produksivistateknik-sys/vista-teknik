import { supabase } from '../lib/supabase'
import { getLocalDateStr } from '../lib/dateHelpers'
import { hapusKodeDariScheduleMulai, hapusKodeDariRenhar } from '../lib/jadwalQtyHelpers'
import { generateAndSaveToRawSchedule } from './fcsService'

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
      // deleted_at (23 Sep 2026, audit "deleted_at gak difilter") - defensif, sama alasan
      // work_orders di workOrderService.ts (RecycleBinTab.tsx menyiratkan raw_schedule bisa
      // di-soft-delete, tapi TIDAK ADA jalur UI yang benar-benar menulis deleted_at ke tabel ini
      // saat ini - 0 dampak sekarang, jaga-jaga kalau jalurnya suatu saat diaktifkan).
      const { data, error } = await supabase.from('raw_schedule').select('*').is('deleted_at', null).order('created_at', { ascending: true }).range(from, from + pageSize - 1)
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

  // SINKRON JADWAL SETELAH QTY BERUBAH (1 Okt 2026, diminta user) - SATU pintu yang dipanggil
  // semua jalur edit qty (grid per-komponen usePanelQtyEditor & modal Edit WO ManajemenWO):
  // - qty >0 -> 0  : kode dihapus dari raw_schedule live tanggal >= hari ini + renhar tanggal itu
  //                  (aturan lengkap di lib/jadwalQtyHelpers.ts). Histori lampau/jejak utuh.
  // - qty 0 -> >0  : kode dijadwalkan ke semua proses relevan lewat generator FCS yang SUDAH ADA
  //                  (generateAndSaveToRawSchedule mode kodeFilter - estafet/WP/kapasitas sama
  //                  persis Generate Jadwal; WIRING tanpa bobot_komponen = MEDIUM saat dibaca).
  // - qty >0 -> >0 : sama seperti sebelumnya, angka qtyPerKomponen disesuaikan (syncQtyAfterEdit).
  // Persentase progres gak perlu disentuh - dihitung live dari komponen qty>0.
  async sinkronJadwalSetelahUbahQty(panelId: number, changes: { kode: string; oldQty: number; newQty: number }[], uname = 'Admin') {
    const jadiNol = changes.filter(c => c.oldQty > 0 && c.newQty <= 0).map(c => c.kode)
    const dariNol = changes.filter(c => c.oldQty <= 0 && c.newQty > 0).map(c => c.kode)
    const tetap = changes.filter(c => c.oldQty > 0 && c.newQty > 0)
    if (tetap.length > 0) await this.syncQtyAfterEdit(panelId, tetap.map(c => ({ kode: c.kode, newQty: c.newQty })))

    const { data: panel, error: pErr } = await supabase.from('panels').select('id,nama,wo_id').eq('id', panelId).single()
    if (pErr) throw new Error('baca panel: ' + pErr.message)
    const hariIni = getLocalDateStr()

    if (jadiNol.length > 0) {
      const { data: rows, error: rErr } = await supabase.from('raw_schedule').select('id,proses,schedule').eq('panel_id', panelId).is('deleted_at', null)
      if (rErr) throw new Error('baca raw_schedule: ' + rErr.message)
      const terhapus: string[] = []
      for (const row of rows || []) {
        let schedule = row.schedule || {}
        let berubah = false
        for (const kode of jadiNol) {
          const r = hapusKodeDariScheduleMulai(schedule, kode, hariIni)
          if (r.tanggalTerhapus.length) { schedule = r.schedule; berubah = true; terhapus.push(`${row.proses} ${kode} (${r.tanggalTerhapus.join(',')})`) }
        }
        if (berubah) {
          const { error } = await supabase.from('raw_schedule').update({ schedule }).eq('id', row.id)
          if (error) throw new Error('update raw_schedule: ' + error.message)
        }
      }
      const rawIds = (rows || []).map((r: any) => r.id)
      if (rawIds.length > 0) {
        const { data: rh, error: hErr } = await supabase.from('renhar').select('id,komponen,komponen_released,pekerja_per_komponen').in('raw_id', rawIds).gte('tanggal', hariIni).range(0, 4999)
        if (hErr) throw new Error('baca renhar: ' + hErr.message)
        for (const h of rh || []) {
          let cur: any = h
          let patch: any = null
          for (const kode of jadiNol) { const p = hapusKodeDariRenhar(cur, kode); if (p) { patch = p; cur = { ...cur, ...p } } }
          if (!patch) continue
          const { error } = await supabase.from('renhar').update(patch).eq('id', h.id)
          if (error) throw new Error('update renhar: ' + error.message)
        }
      }
      if (terhapus.length) await logActivity(uname, 'QTY 0: HAPUS DARI JADWAL', `Panel ${panel.nama}: qty jadi 0, dihapus dari jadwal hari ini & ke depan - ${terhapus.join('; ')}`, { panel: panel.nama })
    }

    if (dariNol.length > 0 && panel.wo_id) {
      const hasil = await generateAndSaveToRawSchedule(panel.wo_id, hariIni, '__force__' + uname, [panelId], { [panelId]: dariNol })
      if (!hasil.success) throw new Error('jadwalkan komponen baru: ' + (hasil.error || 'gagal'))
      await logActivity(uname, 'QTY DARI 0: TAMBAH KE JADWAL', `Panel ${panel.nama}: qty naik dari 0, dijadwalkan mulai ${hariIni} ke proses relevan - ${dariNol.join(', ')} (${hasil.count} entri)`, { panel: panel.nama })
    }
  },
}
