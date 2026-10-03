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

  // Tandai entri LAMPAU (tanggal < hariIni, belum jejak) kode-kode ini sebagai jejak
  // digeserKe[kode] = tanggal live paling awal (>= hariIni) kode itu di proses yang sama. Cuma
  // proses yang PUNYA jadwal live baru yang ditandai - kalau generator gak sempat menjadwalkan (mis.
  // kapasitas penuh 21 hari), entri lama dibiarkan supaya tetap bisa ditarik Tarik (gak hilang).
  async tandaiJejakSetelahJadwalUlang(panelId: number, kodes: string[], hariIni: string): Promise<string[]> {
    const { data: rows, error } = await supabase.from('raw_schedule').select('id,proses,schedule').eq('panel_id', panelId).is('deleted_at', null)
    if (error) throw new Error('baca raw_schedule (tandai jejak): ' + error.message)
    const ditandai: string[] = []
    for (const row of rows || []) {
      const schedule: any = row.schedule || {}
      let berubah = false
      for (const kode of kodes) {
        const tglLive = Object.keys(schedule).filter(t => t >= hariIni && (schedule[t] || []).some((e: any) => (e.komponen || []).includes(kode) && !(e.digeserKe && e.digeserKe[kode]))).sort()
        if (!tglLive.length) continue
        const tujuan = tglLive[0]
        for (const t of Object.keys(schedule)) {
          if (t >= hariIni) continue
          let kena = false
          const entri = (schedule[t] || []).map((e: any) => {
            if (!(e.komponen || []).includes(kode) || (e.digeserKe && e.digeserKe[kode])) return e
            kena = true
            return { ...e, digeserKe: { ...(e.digeserKe || {}), [kode]: tujuan } }
          })
          if (kena) { schedule[t] = entri; berubah = true; ditandai.push(`${row.proses} ${kode} ${t}->${tujuan}`) }
        }
      }
      if (berubah) {
        const { error: uErr } = await supabase.from('raw_schedule').update({ schedule }).eq('id', row.id)
        if (uErr) throw new Error('update raw_schedule (tandai jejak): ' + uErr.message)
      }
    }
    return ditandai
  },

  // SINKRON JADWAL SETELAH QTY BERUBAH (1 Okt 2026, diminta user) - SATU pintu yang dipanggil
  // semua jalur edit qty (grid per-komponen usePanelQtyEditor & modal Edit WO ManajemenWO):
  // - qty >0 -> 0  : kode dihapus dari raw_schedule live tanggal >= hari ini + renhar tanggal itu
  //                  (aturan lengkap di lib/jadwalQtyHelpers.ts). Histori lampau/jejak utuh.
  // - qty 0 -> >0  : kode dijadwalkan ke semua proses relevan lewat generator FCS yang SUDAH ADA
  //                  (generateAndSaveToRawSchedule mode kodeFilter - estafet/WP/kapasitas sama
  //                  persis Generate Jadwal; WIRING tanpa bobot_komponen = MEDIUM saat dibaca).
  // - qty >0 -> TURUN: sama seperti sebelumnya, angka qtyPerKomponen disesuaikan (syncQtyAfterEdit).
  // - qty >0 -> NAIK (2 Okt 2026, opsi B keputusan user): SISA unit (qty baru - yang sudah dikerjakan
  //                  - yang sudah terjadwal mulai hari ini) dijadwalkan mulai hari ini lewat generator
  //                  FCS mode kodeFilter (sama dgn qty 0 -> >0). Entri LAMPAU kode itu lalu ditandai
  //                  jejak digeserKe[kode] = tanggal jadwal barunya (mekanisme jejak auto-geser), supaya
  //                  Tarik (sapu tanggal lampau) tidak menarik entri lama itu lagi = tidak dobel.
  //                  Persen progres kode itu sudah dihitung ulang SEBELUM ini oleh pemanggil
  //                  (lib/progressQtyHelpers.ts) - generator butuh persen yang benar (skip proses 100%).
  async sinkronJadwalSetelahUbahQty(panelId: number, changes: { kode: string; oldQty: number; newQty: number }[], uname = 'Admin'): Promise<{ belumFcs: boolean }> {
    // FCS CUKUP SEKALI (3 Okt 2026, insiden WO 053 HOTEL JAMBOOLAND: 19 panel baru di-edit qty SEBELUM
    // FCS -> jadwal otomatis cuma utk kode yang qty-nya berubah, baris STEL/FINISHING/QC TEST/PACKING
    // tidak pernah dibuat). Panel yang BELUM punya baris raw_schedule sama sekali = belum di-FCS ->
    // jadwal otomatis DILEWATI total; jadwalnya dibuat lengkap lewat tombol FCS (sekali).
    if (!(await this.panelSudahDiFcs(panelId))) return { belumFcs: true }
    const jadiNol = changes.filter(c => c.oldQty > 0 && c.newQty <= 0).map(c => c.kode)
    const dariNol = changes.filter(c => c.oldQty <= 0 && c.newQty > 0).map(c => c.kode)
    const tetap = changes.filter(c => c.oldQty > 0 && c.newQty > 0 && c.newQty < c.oldQty)
    const naik = changes.filter(c => c.oldQty > 0 && c.newQty > c.oldQty).map(c => c.kode)
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

    if (naik.length > 0 && panel.wo_id) {
      const hasil = await generateAndSaveToRawSchedule(panel.wo_id, hariIni, '__force__' + uname, [panelId], { [panelId]: naik })
      if (!hasil.success) throw new Error('jadwalkan sisa qty: ' + (hasil.error || 'gagal'))
      const jejak = await this.tandaiJejakSetelahJadwalUlang(panelId, naik, hariIni)
      await logActivity(uname, 'QTY NAIK: JADWALKAN SISA', `Panel ${panel.nama}: qty naik, sisa unit dijadwalkan mulai ${hariIni} - ${naik.join(', ')} (${hasil.count} entri baru, ${jejak.length} entri lama ditandai jejak${jejak.length ? ': ' + jejak.join('; ') : ''})`, { panel: panel.nama })
    }
    // Setiap perubahan qty juga MELENGKAPI proses yang belum punya baris di panel ini (mis. qty Box
    // naik dari 0 di tipe yang butuh STEL, padahal baris STEL belum pernah ada).
    if (panel.wo_id) await this.lengkapiProsesPanel(panel.wo_id, [panelId], uname)
    return { belumFcs: false }
  },

  // Panel sudah di-FCS = sudah punya minimal 1 baris raw_schedule (aktif maupun terhapus).
  async panelSudahDiFcs(panelId: number): Promise<boolean> {
    const { data, error } = await supabase.from('raw_schedule').select('id').eq('panel_id', panelId).limit(1)
    if (error) throw new Error('cek jadwal panel: ' + error.message)
    return (data || []).length > 0
  },

  // LENGKAPI proses yang belum punya baris (generator FCS mode hanyaProsesBaru - baris yang sudah
  // ada, termasuk yang isinya dihapus planner, TIDAK disentuh). Mulai hari ini.
  async lengkapiProsesPanel(woId: number, panelIds: number[], uname: string): Promise<number> {
    if (!panelIds.length) return 0
    const hariIni = getLocalDateStr()
    const hasil = await generateAndSaveToRawSchedule(woId, hariIni, '__force__' + uname, panelIds, undefined, { hanyaProsesBaru: true })
    if (!hasil.success && hasil.error !== 'Tidak ada panel yang dipilih') throw new Error('lengkapi proses jadwal: ' + (hasil.error || 'gagal'))
    if (hasil.count > 0) await logActivity(uname, 'LENGKAPI PROSES JADWAL', `Proses yang belum punya baris dilengkapi mulai ${hariIni} untuk panel #${panelIds.join(', #')} (${hasil.count} entri)`)
    return hasil.count
  },

  // PANEL BARU di WO yang SUDAH di-FCS (3 Okt 2026) - dipanggil setelah Simpan Edit WO (Manajemen WO
  // & WO Digital). Dicek PER RECORD WO (wo_id), BUKAN per nomor WO: batch pengiriman baru dgn nomor
  // sama (Tambah WO / split tanggal ke WO baru) tetap butuh FCS sekali. Kalau record WO itu sudah
  // punya jadwal (minimal 1 panel ber-baris raw_schedule), panelnya yang belum punya baris langsung
  // dijadwalkan lengkap mulai hari ini (generator FCS biasa). WO yang belum pernah di-FCS tidak disentuh.
  async jadwalkanPanelBaruSetelahEditWo(woNumber: string, proyek: string, uname: string): Promise<string[]> {
    const { data: wos, error: wErr } = await supabase.from('work_orders').select('id').eq('wo', woNumber).eq('proyek', proyek)
    if (wErr) throw new Error('baca WO: ' + wErr.message)
    const woIds = (wos || []).map((w: any) => w.id)
    if (!woIds.length) return []
    const { data: panels, error: pErr } = await supabase.from('panels').select('id,nama,wo_id').in('wo_id', woIds).is('deleted_at', null).range(0, 4999)
    if (pErr) throw new Error('baca panel: ' + pErr.message)
    if (!(panels || []).length) return []
    const { data: rows, error: rErr } = await supabase.from('raw_schedule').select('panel_id').in('panel_id', panels!.map((p: any) => p.id)).range(0, 9999)
    if (rErr) throw new Error('baca raw_schedule: ' + rErr.message)
    const punyaBaris = new Set((rows || []).map((r: any) => r.panel_id))
    const woSudahFcs = new Set(panels!.filter((p: any) => punyaBaris.has(p.id)).map((p: any) => p.wo_id))
    const baru = panels!.filter((p: any) => !punyaBaris.has(p.id) && woSudahFcs.has(p.wo_id))
    if (!baru.length) return []
    const hariIni = getLocalDateStr()
    const dijadwalkan: string[] = []
    for (const woId of [...new Set(baru.map((p: any) => p.wo_id))]) {
      const ids = baru.filter((p: any) => p.wo_id === woId).map((p: any) => p.id)
      const hasil = await generateAndSaveToRawSchedule(woId, hariIni, '__force__' + uname, ids)
      if (!hasil.success) throw new Error('jadwalkan panel baru: ' + (hasil.error || 'gagal'))
      dijadwalkan.push(...baru.filter((p: any) => ids.includes(p.id)).map((p: any) => p.nama))
    }
    await logActivity(uname, 'PANEL BARU: TAMBAH KE JADWAL', `WO ${woNumber} - ${proyek}: panel baru dijadwalkan otomatis mulai ${hariIni} - ${dijadwalkan.join(', ')}`, { proyek })
    return dijadwalkan
  },
}
