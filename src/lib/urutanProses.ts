// URUTAN PROSES PER KOMPONEN (21 Okt 2026, keputusan user) - SATU sumber utk peringatan "urutan proses terbalik"
// di Raw Schedule (semua jalur pindah: seret, multi-pindah, potong/tempel, Pindahin, modal sel, Undo), tanda merah
// di sel, daftar pelanggaran, dan cek Kesehatan Data K17 (cermin SQL - ubah keduanya bersamaan).
// Fungsi murni: data panel & daftar proses relevan diberikan pemanggil.
//
// Aturan (user 21 Okt 2026):
//   POTONG -> BENDING -> STEL -> FINISHING -> RENDAM -> PAINTING -+-> RAKIT -> PASANG KOMPONEN
//                                                                 +-> WIRING CONTROL, WIRING POWER (sejajar RAKIT & satu sama lain)
//   BUSBAR, QC TEST, PACKING (dan NAMEPLATE/YELLOWMARK) dikecualikan.
// - Per KOMPONEN (panel x kode): hanya proses yang relevan utk kode itu (bom_proses_relevan lewat
//   getRelevantProsesForKode) yang dibandingkan; proses tak relevan dilompati.
// - Tanggal = tanggal RENCANA mulai: tanggal live (bukan jejak digeserKe) paling awal kode itu di proses itu.
// - Pelanggaran = proses sesudah MULAI LEBIH AWAL dari proses sebelumnya. Hari yang sama BOLEH.
// - Proses sebelumnya yang sudah 100% -> bukan pelanggaran. Proses sebelumnya sebagian -> tetap pelanggaran.
// - Proses sebelumnya belum terjadwal -> dibandingkan ke proses relevan terjadwal sebelum itu (bukan pelanggaran sendiri).
// Sifatnya PERINGATAN (ada "Tetap pindahkan"), bukan blokir. Menggantikan "lock estafet" lama ModalJadwalSel
// (memblokir, cuma cek "sudah terjadwal", mati sejak 17 Jul 2026 dc89d12) - dihapus 21 Okt 2026.

export const URUTAN_DASAR = ['POTONG', 'BENDING', 'STEL', 'FINISHING', 'RENDAM', 'PAINTING']
// Cabang sesudah PAINTING: proses -> pendahulu di cabangnya sendiri (kosong = langsung ke URUTAN_DASAR).
export const CABANG_SESUDAH_DASAR: Record<string, string[]> = {
  'RAKIT': [],
  'PASANG KOMPONEN': ['RAKIT'],
  'WIRING CONTROL': [],
  'WIRING POWER': [],
}
export const PROSES_DIURUTKAN = [...URUTAN_DASAR, ...Object.keys(CABANG_SESUDAH_DASAR)]

export type PelanggaranUrutan = {
  panelId: number
  kode: string
  prosesAwal: string; tglAwal: string; pctAwal: number
  prosesSesudah: string; tglSesudah: string
}
export const kunciPelanggaran = (p: PelanggaranUrutan) => `${p.panelId}|${p.kode}|${p.prosesAwal}|${p.prosesSesudah}`

export type KonteksUrutan = {
  panelById: (id: number) => { tipe?: string; checklist?: any } | undefined
  prosesRelevan: (kode: string, tipe: string) => string[] // getRelevantProsesForKode
}

// Pendahulu langsung `proses` di antara proses relevan kode ini (null = tidak ada / proses pertama).
export function pendahuluProses(proses: string, relevan: string[]): string | null {
  const dasar = (sampai: number) => { for (let j = sampai; j >= 0; j--) if (relevan.includes(URUTAN_DASAR[j])) return URUTAN_DASAR[j]; return null }
  const i = URUTAN_DASAR.indexOf(proses)
  if (i >= 0) return dasar(i - 1)
  const cabang = CABANG_SESUDAH_DASAR[proses]
  if (!cabang) return null // proses dikecualikan
  for (const c of cabang) if (relevan.includes(c)) return c
  return dasar(URUTAN_DASAR.length - 1)
}

// Tanggal mulai rencana per "panelId|kode|proses" (live saja, jejak digeserKe tidak dihitung).
export function petaTanggalMulai(rows: any[]): Map<string, string> {
  const m = new Map<string, string>()
  for (const r of rows) {
    if (!PROSES_DIURUTKAN.includes(r.proses) || r.deleted_at) continue
    const pid = Number(r.panel_id ?? r.panelId)
    for (const [tgl, entri] of Object.entries<any>(r.schedule || {})) {
      for (const e of entri || []) for (const k of e.komponen || []) {
        if (typeof k !== 'string' || k.startsWith('__') || e.digeserKe?.[k]) continue
        const key = `${pid}|${k}|${r.proses}`
        const lama = m.get(key)
        if (!lama || tgl < lama) m.set(key, tgl)
      }
    }
  }
  return m
}

// Semua pelanggaran pada `rows` (boleh dibatasi ke panel tertentu).
export function cariPelanggaranUrutan(rows: any[], ctx: KonteksUrutan, hanyaPanel?: Set<number>): PelanggaranUrutan[] {
  const dipakai = hanyaPanel ? rows.filter(r => hanyaPanel.has(Number(r.panel_id ?? r.panelId))) : rows
  const mulai = petaTanggalMulai(dipakai)
  const komponen = new Set<string>()
  for (const key of mulai.keys()) { const i = key.lastIndexOf('|'); komponen.add(key.slice(0, i)) }
  const hasil: PelanggaranUrutan[] = []
  for (const pk of komponen) {
    const j = pk.indexOf('|'); const panelId = Number(pk.slice(0, j)); const kode = pk.slice(j + 1)
    const panel = ctx.panelById(panelId)
    const cl = panel?.checklist?.[kode]
    if (!panel || !cl || !(Number(cl.qty) > 0)) continue
    const relevan = ctx.prosesRelevan(kode, panel.tipe || '').filter(p => PROSES_DIURUTKAN.includes(p))
    for (const x of relevan) {
      const tglX = mulai.get(`${panelId}|${kode}|${x}`)
      if (!tglX) continue
      let a = pendahuluProses(x, relevan)
      while (a && !mulai.has(`${panelId}|${kode}|${a}`)) a = pendahuluProses(a, relevan)
      if (!a) continue
      const tglA = mulai.get(`${panelId}|${kode}|${a}`)!
      if (!(tglX < tglA)) continue // hari sama / sesudah = boleh
      const pctA = Number(cl.progress?.[a]) || 0
      if (pctA >= 100) continue // proses sebelumnya sudah selesai
      hasil.push({ panelId, kode, prosesAwal: a, tglAwal: tglA, pctAwal: pctA, prosesSesudah: x, tglSesudah: tglX })
    }
  }
  return hasil
}

// Pelanggaran BARU akibat perubahan jadwal (rawId -> kolom baru, mis. {schedule}). Pelanggaran lama yang sudah ada
// tidak diperingatkan ulang (tetap terlihat merah). Hanya panel yang barisnya berubah yang dihitung.
export function pelanggaranUrutanBaru(rows: any[], perubahan: Map<number, any>, ctx: KonteksUrutan): PelanggaranUrutan[] {
  const panel = new Set<number>()
  for (const r of rows) if (perubahan.has(r.id) && perubahan.get(r.id)?.schedule !== undefined) panel.add(Number(r.panel_id ?? r.panelId))
  if (panel.size === 0) return []
  const sebelum = new Set(cariPelanggaranUrutan(rows, ctx, panel).map(kunciPelanggaran))
  const sesudahRows = rows.map(r => perubahan.has(r.id) ? { ...r, ...perubahan.get(r.id) } : r)
  return cariPelanggaranUrutan(sesudahRows, ctx, panel).filter(p => !sebelum.has(kunciPelanggaran(p)))
}

const fmtTgl = (d: string) => { const [, m, h] = d.split('-'); return `${Number(h)} ${['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'][Number(m) - 1]}` }
// Satu baris teks pelanggaran, mis. "BENDING (21 Okt) sebelum POTONG (23 Okt, 0%)".
export function teksPelanggaran(p: PelanggaranUrutan): string {
  return `${p.prosesSesudah} (${fmtTgl(p.tglSesudah)}) dijadwalkan sebelum ${p.prosesAwal} (${fmtTgl(p.tglAwal)}, ${Math.round(p.pctAwal)}%)`
}
