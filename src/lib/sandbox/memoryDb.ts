// MEMORY DB - basis data TIRUAN di memori untuk sandbox "Raw Schedule per WP" (10 Okt 2026).
// Meniru subset query builder Supabase/PostgREST yang dipakai logika bersama (fcsService, lib/pindahMulti,
// lib/rawPanelOrder, lib/kapasitasHari, Riwayat Qty, notifikasi) supaya logika yang SAMA berjalan terhadap
// SALINAN data. TIDAK ada koneksi jaringan sama sekali di file ini: semua select/insert/update/delete/rpc
// hanya mengubah tabel di memori. Isi awal tabel = snapshot (lib/sandbox/bacaSnapshot.ts, SELECT saja).
//
// RPC yang ditiru lokal (atomik semua-atau-tidak, pesan & kode P0001 seperti server):
//  - pindah_multi_sel_v2  : cek Minggu berkapasitas, timer BUSBAR berjalan, jadwal belum diubah sejak layar
//                           dimuat (4 kolom), lalu tulis 4 kolom; renhar = no-op (sandbox tidak menyentuh
//                           rencana harian). Hasil = snapshot utk Undo, bentuk sama dgn server.
//  - pulihkan_multi_sel_v2: cek 4 kolom masih PERSIS hasil pindah, lalu pulihkan PERSIS keadaan sebelumnya.
//  - pindah_urutan_panel_raw: prioritas semua baris panel + key urutan (+ key panel lain yg di-materialize),
//                           key unik global (bentrok -> 23505 seperti index unik di server).

type Baris = Record<string, any>
type Hasil = { data: any; error: any; count?: number | null }
type Pendengar = (tabel: string) => void

const salin = <T,>(v: T): T => (v === undefined ? v : JSON.parse(JSON.stringify(v)))
const sama = (a: any, b: any) => JSON.stringify(urutKunci(a)) === JSON.stringify(urutKunci(b))
const urutKunci = (v: any): any => Array.isArray(v) ? v.map(urutKunci) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k => [k, urutKunci(v[k])])) : v
const angka = (v: any) => typeof v === 'number' || (typeof v === 'string' && v.trim() !== '' && !isNaN(Number(v)) && !/^\d{4}-\d{2}-\d{2}/.test(v))
const banding = (a: any, b: any) => { if (angka(a) && angka(b)) return Number(a) - Number(b); const x = String(a), y = String(b); return x < y ? -1 : x > y ? 1 : 0 }
const samaNilai = (a: any, b: any) => (a === null || a === undefined || b === null || b === undefined) ? (a ?? null) === (b ?? null) : String(a) === String(b)
const galat = (message: string, code = 'P0001') => ({ message, code, details: null, hint: null })
const isMinggu = (d: string) => new Date(d + 'T00:00:00').getDay() === 0

// kolom hitungan (generated) di server
function kolomHitungan(tabel: string, r: Baris) {
  if (tabel === 'fcs_kapasitas_override') {
    const orang = r.tipe_kapasitas === 'orang'
    r.kapasitas_menit = orang || r.jam_kerja == null ? null : Math.round(Number(r.jam_kerja) * 60 * Number(r.efektivitas_pct ?? 100) / 100)
    r.kapasitas_unit = orang ? (r.jumlah_orang ?? null) : r.kapasitas_menit
  }
}

class Kueri implements PromiseLike<Hasil> {
  private op: 'select' | 'insert' | 'update' | 'delete' | 'upsert' = 'select'
  private nilai: any = null
  private saring: ((r: Baris) => boolean)[] = []
  private urut: { kol: string; naik: boolean }[] = []
  private batas: number | null = null
  private rentang: [number, number] | null = null
  private mode: 'banyak' | 'satu' | 'mungkin' = 'banyak'
  private kembalikan = false
  private hitung = false
  constructor(private db: MemoryDb, private tabel: string) {}
  select(_kolom?: string, opsi?: { count?: string; head?: boolean }) { if (this.op !== 'select') this.kembalikan = true; if (opsi?.count) this.hitung = true; return this }
  insert(v: any) { this.op = 'insert'; this.nilai = v; return this }
  upsert(v: any) { this.op = 'upsert'; this.nilai = v; return this }
  update(v: any) { this.op = 'update'; this.nilai = v; return this }
  delete() { this.op = 'delete'; return this }
  eq(k: string, v: any) { this.saring.push(r => samaNilai(r[k], v)); return this }
  neq(k: string, v: any) { this.saring.push(r => !samaNilai(r[k], v)); return this }
  in(k: string, vs: any[]) { const s = new Set((vs || []).map(x => String(x))); this.saring.push(r => r[k] != null && s.has(String(r[k]))); return this }
  is(k: string, v: any) { this.saring.push(r => v === null ? r[k] == null : r[k] === v); return this }
  not(k: string, op: string, v: any) { if (op === 'is' && v === null) this.saring.push(r => r[k] != null); else if (op === 'eq') this.saring.push(r => !samaNilai(r[k], v)); else throw new Error('MemoryDb: not(' + op + ') belum didukung'); return this }
  gte(k: string, v: any) { this.saring.push(r => r[k] != null && banding(r[k], v) >= 0); return this }
  lte(k: string, v: any) { this.saring.push(r => r[k] != null && banding(r[k], v) <= 0); return this }
  gt(k: string, v: any) { this.saring.push(r => r[k] != null && banding(r[k], v) > 0); return this }
  lt(k: string, v: any) { this.saring.push(r => r[k] != null && banding(r[k], v) < 0); return this }
  order(k: string, o?: { ascending?: boolean }) { this.urut.push({ kol: k, naik: o?.ascending !== false }); return this }
  limit(n: number) { this.batas = n; return this }
  range(a: number, b: number) { this.rentang = [a, b]; return this }
  single() { this.mode = 'satu'; return this }
  maybeSingle() { this.mode = 'mungkin'; return this }
  then<A = Hasil, B = never>(ok?: ((v: Hasil) => A | PromiseLike<A>) | null, gagal?: ((e: any) => B | PromiseLike<B>) | null): PromiseLike<A | B> {
    return Promise.resolve().then(() => this.jalankan()).then(ok, gagal)
  }
  private cocok(r: Baris) { return this.saring.every(f => f(r)) }
  private bentuk(rows: Baris[]): Hasil {
    let out = rows
    for (let i = this.urut.length - 1; i >= 0; i--) { const { kol, naik } = this.urut[i]; out = [...out].sort((a, b) => (a[kol] == null ? 1 : b[kol] == null ? -1 : banding(a[kol], b[kol])) * (naik ? 1 : -1)) }
    const total = out.length
    if (this.rentang) out = out.slice(this.rentang[0], this.rentang[1] + 1)
    if (this.batas != null) out = out.slice(0, this.batas)
    const data = salin(out)
    if (this.mode === 'satu') return data.length === 1 ? { data: data[0], error: null } : { data: null, error: galat(`JSON object requested, ${data.length} rows returned`, 'PGRST116') }
    if (this.mode === 'mungkin') return data.length <= 1 ? { data: data[0] ?? null, error: null } : { data: null, error: galat('multiple rows returned', 'PGRST116') }
    return { data, error: null, count: this.hitung ? total : null }
  }
  private jalankan(): Hasil {
    const t = this.db.tabel(this.tabel)
    if (!t) return { data: null, error: galat(`Tabel "${this.tabel}" tidak ada di salinan data uji`, '42P01') }
    const kini = new Date().toISOString()
    if (this.op === 'select') return this.bentuk(t.filter(r => this.cocok(r)))
    if (this.op === 'insert' || this.op === 'upsert') {
      const masuk = (Array.isArray(this.nilai) ? this.nilai : [this.nilai]).map((v: any) => salin(v))
      const hasil: Baris[] = []
      for (const v of masuk) {
        if (this.op === 'upsert' && v.id != null) { const i = t.findIndex(r => samaNilai(r.id, v.id)); if (i >= 0) { const baru = { ...t[i], ...v, updated_at: kini }; kolomHitungan(this.tabel, baru); t[i] = baru; hasil.push(baru); continue } }
        const baru = { id: v.id ?? this.db.idBaru(this.tabel), created_at: kini, updated_at: kini, ...v }
        kolomHitungan(this.tabel, baru); t.push(baru); hasil.push(baru)
      }
      this.db.kabari(this.tabel)
      return this.kembalikan ? this.bentuk(hasil) : { data: null, error: null }
    }
    if (this.op === 'update') {
      const ubah = salin(this.nilai); const hasil: Baris[] = []
      for (let i = 0; i < t.length; i++) if (this.cocok(t[i])) { const baru = { ...t[i], ...ubah, updated_at: ubah.updated_at ?? kini }; kolomHitungan(this.tabel, baru); t[i] = baru; hasil.push(baru) }
      if (hasil.length) this.db.kabari(this.tabel)
      return this.kembalikan ? this.bentuk(hasil) : { data: null, error: null }
    }
    // delete
    const dihapus = t.filter(r => this.cocok(r)); const sisa = t.filter(r => !this.cocok(r))
    this.db.ganti(this.tabel, sisa); if (dihapus.length) this.db.kabari(this.tabel)
    return this.kembalikan ? this.bentuk(dihapus) : { data: null, error: null }
  }
}

export class MemoryDb {
  private tabelData = new Map<string, Baris[]>()
  private pendengar = new Set<Pendengar>()
  readonly catatan: any[] = [] // activity_log & catatan RPC (hanya di memori)
  constructor(awal: Record<string, Baris[]>) { for (const [k, v] of Object.entries(awal)) this.tabelData.set(k, salin(v)) }
  tabel(n: string) { return this.tabelData.get(n) }
  ganti(n: string, rows: Baris[]) { this.tabelData.set(n, rows) }
  idBaru(n: string) { const t = this.tabelData.get(n) || []; return t.reduce((m, r) => Math.max(m, Number(r.id) || 0), 0) + 1 }
  dengar(f: Pendengar) { this.pendengar.add(f); return () => { this.pendengar.delete(f) } }
  kabari(n: string) { this.pendengar.forEach(f => { try { f(n) } catch (e) { console.error('[MemoryDb] pendengar gagal:', e) } }) }
  baris(n: string): Baris[] { return this.tabelData.get(n) || [] } // referensi baris (jangan dimutasi pemakai)
  from(n: string) { return new Kueri(this, n) }
  // realtime: tidak ada di sandbox (stub agar pemakai lama tetap jalan)
  channel(_n: string) { const c: any = { on: () => c, subscribe: () => c }; return c }
  removeChannel(_c: any) { return Promise.resolve('ok') }
  async rpc(nama: string, p: any): Promise<Hasil> {
    try {
      if (nama === 'pindah_multi_sel_v2') return this.rpcPindah(p)
      if (nama === 'pulihkan_multi_sel_v2') return this.rpcPulihkan(p)
      if (nama === 'pindah_urutan_panel_raw') return this.rpcUrutan(p)
      return { data: null, error: galat(`RPC "${nama}" tidak tersedia di salinan data uji`, '42883') }
    } catch (e: any) { return { data: null, error: galat(String(e?.message || e), 'XX000') } }
  }
  private empat(r: Baris) { return { schedule: r.schedule || {}, busbar_schedule: r.busbar_schedule || {}, busbar_jejak: r.busbar_jejak || {}, busbar_manual_pin: r.busbar_manual_pin || {} } }
  private rpcPindah(p: any): Hasil {
    const raw = this.baris('raw_schedule'); const byId = new Map(raw.map((r, i) => [Number(r.id), i]))
    const sel = p.p_sel || []; const rows = p.p_rows || []
    if (sel.length === 0) return { data: null, error: galat('Tidak ada sel yang dipindah') }
    // 1) validasi tujuan (atomik)
    for (const s of sel) {
      const i = byId.get(Number(s.raw_id)); if (i === undefined) return { data: null, error: galat(`Baris jadwal ${s.raw_id} tidak ditemukan (mungkin sudah diarsip/dihapus). Muat ulang halaman.`) }
      const r = raw[i]
      if (isMinggu(s.ke) && !this.baris('fcs_kapasitas_override').some(k => k.tanggal === s.ke && k.jenis_pekerjaan === r.proses && ((Number(k.kapasitas_menit) || 0) > 0 || (Number(k.jumlah_orang) || 0) > 0)))
        return { data: null, error: galat(`Dibatalkan: kapasitas Minggu ${s.ke} untuk ${r.proses} belum diatur. Tidak ada yang dipindah.`) }
      if (r.proses === 'BUSBAR' && (s.kode_busbar || []).length) {
        const n = this.baris('fcs_timer_kerja').filter(t => Number(t.panel_id) === Number(r.panel_id) && t.proses === 'BUSBAR' && t.selesai == null && (s.kode_busbar || []).includes(t.kode_komponen)).length
        if (n > 0) return { data: null, error: galat(`Dibatalkan: ada timer BUSBAR yang sedang berjalan (raw ${s.raw_id}). Tidak ada yang dipindah.`) }
      }
    }
    // 2) cek 4 kolom belum berubah, baru tulis semua
    for (const x of rows) {
      const i = byId.get(Number(x.raw_id)); if (i === undefined) return { data: null, error: galat(`Baris jadwal ${x.raw_id} tidak ditemukan (mungkin sudah diarsip/dihapus). Muat ulang halaman.`) }
      const seb = { schedule: x.sebelum?.schedule || {}, busbar_schedule: x.sebelum?.busbar_schedule || {}, busbar_jejak: x.sebelum?.busbar_jejak || {}, busbar_manual_pin: x.sebelum?.busbar_manual_pin || {} }
      if (!sama(this.empat(raw[i]), seb)) return { data: null, error: galat(`Jadwal baris ${x.raw_id} sudah diubah orang lain sejak layar dimuat. Muat ulang halaman lalu ulangi. Tidak ada yang dipindah.`) }
    }
    const kini = new Date().toISOString(); const out: any[] = []
    for (const x of rows) {
      const i = byId.get(Number(x.raw_id))!; const sebelum = salin(this.empat(raw[i]))
      const sesudah = { schedule: x.sesudah?.schedule || {}, busbar_schedule: x.sesudah?.busbar_schedule || {}, busbar_jejak: x.sesudah?.busbar_jejak || {}, busbar_manual_pin: x.sesudah?.busbar_manual_pin || {} }
      raw[i] = { ...raw[i], ...salin(sesudah), updated_at: kini }
      out.push({ raw_id: Number(x.raw_id), sebelum, sesudah: salin(sesudah) })
    }
    this.catatan.push({ user_name: p.p_user, action: 'PINDAH BANYAK SEL', description: `Pindah ${sel.length} sel (salinan uji, ${out.length} baris jadwal)`, module: 'raw', halaman: 'Raw Schedule per WP (uji)', created_at: kini })
    this.kabari('raw_schedule')
    return { data: { versi: 2, raw: out, renhar_sebelum: [], renhar_dibuat: [], renhar_sesudah: [] }, error: null }
  }
  private rpcPulihkan(p: any): Hasil {
    const raw = this.baris('raw_schedule'); const byId = new Map(raw.map((r, i) => [Number(r.id), i]))
    const daftar = p.p_snap?.raw || []
    for (const x of daftar) {
      const i = byId.get(Number(x.raw_id))
      if (i === undefined || !sama(this.empat(raw[i]), x.sesudah)) return { data: null, error: galat(`Tidak bisa dibatalkan: jadwal baris ${x.raw_id} sudah diubah lagi sejak dipindah. Tidak ada yang diubah.`) }
    }
    const kini = new Date().toISOString()
    for (const x of daftar) { const i = byId.get(Number(x.raw_id))!; raw[i] = { ...raw[i], ...salin(x.sebelum), updated_at: kini } }
    this.catatan.push({ user_name: p.p_user, action: 'BATALKAN PINDAH BANYAK SEL', description: `Batalkan pindah (salinan uji, ${daftar.length} baris jadwal)`, module: 'raw', halaman: 'Raw Schedule per WP (uji)', created_at: kini })
    this.kabari('raw_schedule')
    return { data: { ok: true }, error: null }
  }
  private rpcUrutan(p: any): Hasil {
    const urutan = this.baris('raw_schedule_panel_order')
    const kunciBaru = new Map<number, string>()
    if (p.p_order_key != null) kunciBaru.set(Number(p.p_panel_id), p.p_order_key)
    for (const m of p.p_materialize || []) kunciBaru.set(Number(m.panel_id), m.order_key)
    // key unik global (index unik di server)
    const akhir = new Map(urutan.map(o => [Number(o.panel_id), o.order_key]))
    kunciBaru.forEach((k, id) => akhir.set(id, k))
    const dipakai = new Map<string, number>()
    for (const [id, k] of akhir) { if (k == null) continue; if (dipakai.has(k) && dipakai.get(k) !== id) return { data: null, error: galat(`duplicate key value violates unique constraint (order_key ${k})`, '23505') }; dipakai.set(k, id) }
    const kini = new Date().toISOString()
    kunciBaru.forEach((k, id) => { const i = urutan.findIndex(o => Number(o.panel_id) === id); const v = { panel_id: id, order_key: k, updated_at: kini, updated_by: p.p_user }; if (i >= 0) urutan[i] = { ...urutan[i], ...v }; else urutan.push(v) })
    if (p.p_prioritas) { const raw = this.baris('raw_schedule'); raw.forEach((r, i) => { if (Number(r.panel_id) === Number(p.p_panel_id)) raw[i] = { ...r, prioritas: p.p_prioritas, updated_at: kini } }); this.kabari('raw_schedule') }
    // renhar: no-op (sandbox tidak menyentuh rencana harian)
    this.kabari('raw_schedule_panel_order')
    return { data: null, error: null }
  }
}
