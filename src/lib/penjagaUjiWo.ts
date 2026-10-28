// PENJAGA UJI WO (28 Okt 2026, Tahap A penukaran Raw Schedule) - "Raw Schedule per WP" memakai DATA ASLI, tetapi
// selama uji HANYA jadwal milik WO uji (work_orders.wo = WO_UJI_RAW_PERWP) yang boleh ditulis. SATU titik penjaga
// untuk semua jalur tulis halaman itu:
//  - klien bergaya Supabase (io.db / fcsService / pindahMulti / urutan panel / kapasitas dibuat dgn klien ini):
//    query direkam lalu diputar ulang ke klien asli; tulisan dicek dulu (baris yang kena dibaca dgn saringan yang SAMA).
//      raw_schedule : semua baris yang kena (update/delete) / payload (insert/upsert) wajib wo_id WO uji
//      renhar       : raw_id baris yang kena / payload wajib baris jadwal WO uji
//      activity_log : insert boleh
//      tabel lain   : DITOLAK (kapasitas global, notifikasi, qty_change_log, panels, ...)
//    RPC: pindah_multi_sel_v2 / pulihkan_multi_sel_v2 / ubah_jadwal_multi_v1 / pulihkan_ubah_jadwal_v1 (raw_id wajib WO uji), pindah_urutan_panel_raw (panel WO uji);
//    RPC lain ditolak. Kanal realtime diberi awalan supaya tidak bentrok dgn kanal bernama sama di Raw Schedule lama.
//  - fungsi tulis App (updateRaw/createRaw/renhar create/update/remove) dibungkus dgn aturan yang sama.
// Ditolak = { error: { code: 'P0001', message } } (pola penolakan server -> pesan tampil, tanpa "Ulangi").
// Penukaran nanti = membuat repo TANPA penjaga ini (saklar satu tempat di RawScheduleAccordion).
import { supabase as supabaseAsli } from './supabase'

export const WO_UJI_RAW_PERWP = 'UJI RAW PER WP'

const OP_TULIS = new Set(['insert', 'update', 'upsert', 'delete'])
const SARINGAN = new Set(['eq', 'neq', 'in', 'is', 'gt', 'gte', 'lt', 'lte', 'like', 'ilike', 'match', 'not', 'or', 'filter', 'contains'])
const tolak = (message: string) => ({ data: null, error: { message, code: 'P0001', details: null, hint: null }, count: null, status: 400, statusText: 'Ditolak' })
const pesan = (apa: string) => `Mode uji: hanya jadwal WO "${WO_UJI_RAW_PERWP}" yang boleh diubah dari halaman ini (${apa} ditolak). Tidak ada yang disimpan.`

export type PenjagaUji = {
  klien: any
  rawIdUji: (ids: number[]) => Promise<string | null> // null = semua milik WO uji; string = alasan tolak
  renharIdUji: (ids: number[]) => Promise<string | null>
  woUji: (woId: any) => Promise<string | null>
}

export function buatPenjagaUji(woIdUji: () => number[], db: any = supabaseAsli): PenjagaUji {
  const woOk = (w: any) => woIdUji().includes(Number(w))
  const rawIdUji = async (ids: number[]) => {
    const unik = [...new Set(ids.map(Number).filter(x => !isNaN(x)))]
    if (unik.length === 0) return null
    const { data, error } = await db.from('raw_schedule').select('id,wo_id').in('id', unik).range(0, 9999)
    if (error) return 'gagal memeriksa baris jadwal: ' + error.message
    const ada = new Map<number, any>((data || []).map((r: any) => [Number(r.id), r.wo_id]))
    const luar = unik.filter(id => !ada.has(id) || !woOk(ada.get(id)))
    return luar.length ? pesan(`baris jadwal ${luar.slice(0, 5).join(', ')}`) : null
  }
  const renharIdUji = async (ids: number[]) => {
    const unik = [...new Set(ids.map(Number).filter(x => !isNaN(x)))]
    if (unik.length === 0) return null
    const { data, error } = await db.from('renhar').select('id,raw_id').in('id', unik).range(0, 9999)
    if (error) return 'gagal memeriksa rencana harian: ' + error.message
    if ((data || []).length !== unik.length) return pesan('rencana harian yang tidak ditemukan')
    return rawIdUji((data || []).map((r: any) => r.raw_id))
  }
  const panelUji = async (ids: number[]) => {
    const unik = [...new Set(ids.map(Number).filter(x => !isNaN(x)))]
    if (unik.length === 0) return null
    const { data, error } = await db.from('panels').select('id,wo_id').in('id', unik).range(0, 9999)
    if (error) return 'gagal memeriksa panel: ' + error.message
    const ada = new Map<number, any>((data || []).map((p: any) => [Number(p.id), p.wo_id]))
    const luar = unik.filter(id => !ada.has(id) || !woOk(ada.get(id)))
    return luar.length ? pesan(`urutan panel ${luar.slice(0, 5).join(', ')}`) : null
  }

  // Putar ulang rekaman ke klien asli (opsional: ganti operasi & kolom utk membaca baris yang akan kena).
  const putar = (tabel: string, rekaman: [string, any[]][]) => rekaman.reduce((q: any, [k, a]) => q[k](...a), db.from(tabel))
  const barisKena = async (tabel: string, rekaman: [string, any[]][], kolom: string) => {
    const saring = rekaman.filter(([k]) => SARINGAN.has(k))
    if (saring.length === 0) return { error: 'tulisan tanpa saringan baris' } // update/delete seluruh tabel: tidak pernah boleh
    const { data, error } = await putar(tabel, [['select', [kolom]], ...saring, ['range', [0, 9999]]])
    return error ? { error: 'gagal memeriksa baris: ' + error.message } : { data: data || [] }
  }
  const cekTulis = async (tabel: string, rekaman: [string, any[]][]): Promise<string | null> => {
    const [op, arg] = rekaman.find(([k]) => OP_TULIS.has(k))!
    const payload: any[] = op === 'delete' ? [] : Array.isArray(arg[0]) ? arg[0] : [arg[0]]
    if (tabel === 'activity_log') return op === 'insert' ? null : pesan('ubah activity_log')
    if (tabel === 'raw_schedule') {
      if (payload.some(p => p && 'wo_id' in p && !woOk(p.wo_id))) return pesan('jadwal WO lain')
      if (op === 'insert') return payload.every(p => woOk(p?.wo_id)) ? null : pesan('jadwal WO lain')
      if (op === 'upsert') return payload.every(p => woOk(p?.wo_id)) ? null : pesan('jadwal WO lain')
      const r = await barisKena(tabel, rekaman, 'id,wo_id'); if (r.error) return r.error
      return r.data!.every((x: any) => woOk(x.wo_id)) ? null : pesan('jadwal WO lain')
    }
    if (tabel === 'renhar') {
      if (op === 'insert' || op === 'upsert') {
        if (payload.some(p => p?.raw_id == null)) return pesan('rencana harian tanpa baris jadwal')
        return rawIdUji(payload.map(p => p.raw_id))
      }
      if (payload.some(p => p && 'raw_id' in p)) { const a = await rawIdUji(payload.map(p => p.raw_id)); if (a) return a }
      const r = await barisKena(tabel, rekaman, 'id,raw_id'); if (r.error) return r.error
      return rawIdUji(r.data!.map((x: any) => x.raw_id))
    }
    return pesan(`tabel ${tabel}`)
  }

  const kueri = (tabel: string) => {
    const rekaman: [string, any[]][] = []
    const jalankan = async () => {
      if (rekaman.some(([k]) => OP_TULIS.has(k))) {
        const alasan = await cekTulis(tabel, rekaman)
        if (alasan) { console.warn('[penjaga uji WO] ditolak:', tabel, alasan); return tolak(alasan) }
      }
      return putar(tabel, rekaman)
    }
    const p: any = new Proxy({}, {
      get(_t, k: string) {
        if (k === 'then') return (ok: any, gagal: any) => jalankan().then(ok, gagal)
        if (k === 'catch') return (gagal: any) => jalankan().catch(gagal)
        if (k === 'finally') return (f: any) => jalankan().finally(f)
        return (...a: any[]) => { rekaman.push([k, a]); return p }
      },
    })
    return p
  }

  const klien = {
    from: (tabel: string) => kueri(tabel),
    async rpc(nama: string, p: any) {
      let alasan: string | null
      if (nama === 'pindah_multi_sel_v2') alasan = await rawIdUji([...(p?.p_rows || []).map((r: any) => r.raw_id), ...(p?.p_sel || []).map((s: any) => s.raw_id)])
      else if (nama === 'pulihkan_multi_sel_v2') alasan = await rawIdUji((p?.p_snap?.raw || []).map((r: any) => r.raw_id))
      // (B3, 29 Okt 2026) salin/hapus per chip + Undo-nya: semua baris jadwal & renhar yang disentuh wajib milik WO uji
      else if (nama === 'ubah_jadwal_multi_v1') alasan = await rawIdUji([...(p?.p_rows || []).map((r: { raw_id: number }) => r.raw_id), ...(p?.p_renhar || []).map((o: { raw_id: number }) => o.raw_id)])
      else if (nama === 'pulihkan_ubah_jadwal_v1') alasan = await rawIdUji([...(p?.p_snap?.raw || []).map((r: { raw_id: number }) => r.raw_id), ...(p?.p_snap?.renhar_sebelum || []).map((h: { raw_id: number }) => h.raw_id)])
      else if (nama === 'pindah_urutan_panel_raw') alasan = await panelUji([p?.p_panel_id, ...(p?.p_materialize || []).map((m: any) => m.panel_id)].filter(x => x != null))
      else alasan = pesan(`RPC ${nama}`)
      if (alasan) { console.warn('[penjaga uji WO] RPC ditolak:', nama, alasan); return tolak(alasan) }
      return db.rpc(nama, p)
    },
    channel: (nama: string) => db.channel('uji-perwp-' + nama),
    removeChannel: (c: any) => db.removeChannel(c),
  }
  return { klien, rawIdUji, renharIdUji, woUji: async (w: any) => woOk(w) ? null : pesan('jadwal WO lain') }
}
