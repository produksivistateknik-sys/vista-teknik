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
    // Paginasi eksplisit - Supabase/PostgREST default-nya mentok 1000 baris per request tanpa
    // .range(). Sama kelas bug yang ketemu di renharService/rawScheduleService: kalau work_orders
    // suatu saat tembus 1000 baris, WO di luar 1000 pertama bakal hilang diam2 dari tampilan.
    let all: any[] = []
    let from = 0
    const pageSize = 1000
    while (true) {
      // Embedded panels(*) sengaja dikasih .order() eksplisit juga (bukan cuma work_orders-nya) -
      // tanpa ini urutan array panels per WO gak dijamin konsisten antar-fetch (PostgREST gak
      // ngasih jaminan order default), yang jadi sumber ketidakstabilan tambahan kalau kebetulan
      // ada no_pnl yang duplikat.
      const { data, error } = await supabase.from('work_orders').select('*, panels(*)').or('is_archived.is.null,is_archived.eq.false').order('created_at', { ascending: false }).order('no_pnl', { foreignTable: 'panels', ascending: true }).range(from, from + pageSize - 1)
      if (error) throw new Error(error.message)
      all = all.concat(data ?? [])
      if (!data || data.length < pageSize) break
      from += pageSize
    }
    return all.map(wo => ({
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
        jumlah_cell: p.jumlahCell ?? p.jumlah_cell ?? 0,
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
        jumlah_cell: p.jumlahCell ?? p.jumlah_cell ?? 0,
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
      await supabase.from('fcs_timer_kerja').delete().in('panel_id', idsToDelete)
      await supabase.from('progress_checkpoint_log').delete().in('panel_id', idsToDelete)
      await supabase.from('kendala').delete().in('panel_id', idsToDelete)
      await supabase.from('panels').delete().in('id', idsToDelete)
    }

    // Cache no_pnl max per WO tujuan - panel baru (belum punya id) bisa ke-route ke WO lain
    // (findOrCreateSiblingWO, saat tanggal panel match wo+proyek+target WO yang sudah ada).
    // noPnl yang dihitung di client (buildNp) itu berdasarkan state WO yang lagi diedit, BUKAN
    // WO tujuan sebenarnya - kalau dipercaya mentah-mentah, panel baru bisa nabrak no_pnl yang
    // sudah dipakai WO tujuan (root cause bug nomor panel dobel di WO 042/CIMORY CITEUREUP).
    const maxNoPnlCache: Record<number, number> = {}
    const nextNoPnl = async (targetWoId: number) => {
      if (maxNoPnlCache[targetWoId] === undefined) {
        const { data: rows } = await supabase.from('panels').select('no_pnl').eq('wo_id', targetWoId)
        maxNoPnlCache[targetWoId] = (rows || []).reduce((max, r: any) => Math.max(max, Number(r.no_pnl) || 0), 0)
      }
      maxNoPnlCache[targetWoId] += 1
      return maxNoPnlCache[targetWoId]
    }

    for (const g of groupedPanels) {
      let targetWoId = editWoId
      if (g.tanggal && g.tanggal !== mainTarget) {
        targetWoId = await this.findOrCreateSiblingWO(wo, proyek, g.tanggal, uname)
      }
      for (const p of g.panels) {
        const noPnl = p.id ? (p.noPnl || p.no_pnl || 1) : await nextNoPnl(targetWoId)
        const row = {
          wo_id: targetWoId,
          no_pnl: noPnl,
          nama: p.nama,
          tipe: p.tipe,
          qty: p.qty || 1,
          checklist: p.checklist || {},
          catatan: p.catatan || "",
          tingkat_kesulitan: p.tingkatKesulitan || p.tingkat_kesulitan || "EASY",
          jumlah_cell: p.jumlahCell ?? p.jumlah_cell ?? 0,
        }
        if (p.id) {
          const { error } = await supabase.from('panels').update(row).eq('id', p.id)
          if (error) throw new Error(error.message)
          // FIX (5 Agu 2026): raw_schedule/renhar/fcs_schedule nyimpen wo_id-nya SENDIRI, cache
          // terpisah dari panels.wo_id di atas (panel_id-nya sendiri gak pernah berubah, cuma
          // wo_id yang barusan di-update). Dulu cache ini gak pernah ikut disinkronkan pas panel
          // pindah ke WO sibling (kena split tanggal pengiriman) - bikin baris-baris ini "orphan"
          // (nyantol ke wo_id lama, gak ketemu lagi dari WO yang sekarang beneran punya panelnya),
          // dan kalau WO lama itu belakangan kehabisan panel sama sekali, cleanup di bawah
          // (sisaPanel.length===0) malah ikut MENGHAPUS baris-baris orphan itu karena masih
          // ke-filter wo_id lama - padahal secara logis udah "milik" WO sibling yang baru.
          // Sinkronisasi ini CUMA nyentuh kolom wo_id - schedule/komponen/pekerja/tanggal dkk
          // di 3 tabel ini SAMA SEKALI gak disentuh.
          // AUDIT FIX (5 Agu 2026): dulu 3 query ini gak dicek error-nya sama sekali (beda dari
          // panels.update() tepat di atas yang throw kalau gagal) - kalau salah satu gagal
          // (network blip dll), bug orphan yang baru diperbaiki bisa balik lagi diam-diam tanpa
          // ada tanda apapun. Sekarang konsisten sama pola panels.update() di atas - throw kalau
          // ada yang gagal, biar kelihatan jelas bukan silent-fail lagi.
          // AUDIT FIX (5 Agu 2026): sinkronisasi cuma perlu jalan kalau panel ini BENERAN pindah
          // WO (targetWoId beda dari editWoId) - sebelumnya jalan tanpa syarat buat SETIAP panel
          // existing tiap kali save, termasuk yang gak pindah sama sekali (3 query mubazir per
          // panel per save).
          if (targetWoId !== editWoId) {
            const { error: rawErr } = await supabase.from('raw_schedule').update({ wo_id: targetWoId }).eq('panel_id', p.id)
            if (rawErr) throw new Error('Gagal sinkron wo_id raw_schedule panel ' + p.id + ': ' + rawErr.message)
            const { error: renharErr } = await supabase.from('renhar').update({ wo_id: targetWoId }).eq('panel_id', p.id)
            if (renharErr) throw new Error('Gagal sinkron wo_id renhar panel ' + p.id + ': ' + renharErr.message)
            const { error: fcsErr } = await supabase.from('fcs_schedule').update({ wo_id: targetWoId }).eq('panel_id', p.id)
            if (fcsErr) throw new Error('Gagal sinkron wo_id fcs_schedule panel ' + p.id + ': ' + fcsErr.message)
          }
        } else {
          const { error } = await supabase.from('panels').insert(row)
          if (error) throw new Error(error.message)
        }
      }
    }

    const { data: sisaPanel } = await supabase.from('panels').select('id').eq('wo_id', editWoId).limit(1)
    if (!sisaPanel || sisaPanel.length === 0) {
      // FIX (5 Agu 2026): dulu delete polos by wo_id=editWoId di sini - kalau ada baris
      // raw_schedule/renhar/fcs_schedule yang somehow MASIH ke-tag wo_id lama ini (harusnya udah
      // gak mungkin lagi berkat sinkronisasi wo_id di atas, tapi ini pengaman TAMBAHAN/belt-and-
      // suspenders buat gap yang belum ketauan) PADAHAL panel_id-nya MASIH ADA & aktif (baru
      // dipindah ke WO lain, misal kena split berantai 2x nyaris bersamaan), baris itu HARUS
      // TETAP UTUH - itu tandanya ada gap sinkronisasi, bukan berarti barisnya beneran yatim
      // piatu. Root cause insiden nyata (SWP-01 + 10 panel CIMORY CITEUREUP kehilangan total
      // raw_schedule pas split berantai 2x dalam 44 detik). Sekarang cuma hapus baris yang
      // panel_id-nya BENERAN gak ada lagi di tabel panels (yatim piatu murni, panelnya sendiri
      // udah kehapus dari jalur idsToDelete di atas).
      const cekYatimPiatu = async (table: string, beforeDelete?: (ids: number[]) => Promise<void>) => {
        const { data: candidates } = await supabase.from(table as any).select('id,panel_id').eq('wo_id', editWoId)
        if (!candidates || candidates.length === 0) return
        const panelIds = [...new Set(candidates.map((r: any) => r.panel_id).filter(Boolean))]
        let masihHidup = new Set<number>()
        if (panelIds.length > 0) {
          const { data: alive } = await supabase.from('panels').select('id').in('id', panelIds)
          masihHidup = new Set((alive || []).map((p: any) => p.id))
        }
        const idsAmanDihapus = candidates.filter((r: any) => !r.panel_id || !masihHidup.has(r.panel_id)).map((r: any) => r.id)
        if (idsAmanDihapus.length > 0) {
          if (beforeDelete) await beforeDelete(idsAmanDihapus)
          const { error: cleanupErr } = await supabase.from(table as any).delete().in('id', idsAmanDihapus)
          if (cleanupErr) throw new Error('Gagal cleanup ' + table + ' yatim piatu WO ' + editWoId + ': ' + cleanupErr.message)
        }
      }
      await cekYatimPiatu('renhar')
      await cekYatimPiatu('raw_schedule')
      await cekYatimPiatu('fcs_schedule')
      // BUG FIX (29 Agu 2026): fcs_tracking_komponen & permintaan punya FK constraint ASLI ke
      // work_orders.id (beda dari fcs_schedule yang cuma konvensi kolom tanpa FK sungguhan) tapi
      // dulu SAMA SEKALI gak pernah dibersihkan di sini - itu akar kenapa delete work_orders di
      // bawah bisa 409 diam-diam (kasus nyata: WO id=139/permintaan). Pakai cekYatimPiatu yang
      // SAMA (bukan delete polos by wo_id) - alasannya SAMA PERSIS kenapa renhar/raw_schedule/
      // fcs_schedule pakai orphan-check: panel yang cuma PINDAH ke WO sibling (bukan dihapus)
      // harus tetap punya row permintaan/fcs_tracking_komponen-nya utuh, jangan ikut kehapus
      // cuma karena wo_id-nya masih nyantol ke editWoId (kelas bug yang sama persis dengan
      // insiden CIMORY CITEUREUP yang dijelaskan di komentar atas).
      await cekYatimPiatu('fcs_tracking_komponen')
      await cekYatimPiatu('permintaan', async (permIds) => {
        const { error: piErr } = await supabase.from('permintaan_item').delete().in('permintaan_id', permIds)
        if (piErr) throw new Error('Gagal cleanup permintaan_item yatim piatu WO ' + editWoId + ': ' + piErr.message)
      })
      const { error: delWoErr } = await supabase.from('work_orders').delete().eq('id', editWoId)
      if (delWoErr) {
        // BUG FIX (29 Agu 2026): dulu hasil delete ini gak pernah dicek - kalau gagal (masih ada
        // FK dari tabel yang belum ke-cover cleanup di atas), WO kosong itu diam-diam tetap hidup
        // dengan 0 panel (akar Bug "WO deadline lama masih muncul"). Sekarang minimal ke-log jelas
        // ke console biar ketauan ada gap baru yang perlu ditambahkan ke cleanup di atas - TIDAK
        // throw di sini supaya sisa proses save panel (yang sudah berhasil semua di atas) tetap
        // dianggap sukses, cuma auto-delete WO kosongnya yang gagal.
        console.error('[saveWOWithSplit] Gagal auto-delete WO kosong id=' + editWoId + ': ' + delWoErr.message + ' - kemungkinan masih ada tabel lain yang FK ke work_orders belum ke-cover cleanup di atas.')
      }
    }
  }
}
