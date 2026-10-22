// DAFTAR OPERATOR HARIAN (22 Okt 2026, aturan final user) - SATU aturan "siapa mengerjakan komponen X proses P hari D"
// utk aplikasi operator (vista-pekerja kartu proses), Rencana Harian & Tracking Pekerja (vista-teknik).
// SALINAN IDENTIK ada di repo lain (vista-pekerja/src/lib/operatorHarian.ts): KALAU DIUBAH DI SATU REPO, WAJIB DISALIN
// KE REPO LAIN. Murni (tanpa import/query) supaya bisa identik.
// Aturan:
// - Pengerja hari itu = orang yang punya timer (fcs_timer_kerja) komponen+proses+tanggal itu, sesi berjalan MAUPUN
//   selesai (A pagi + B siang = keduanya). Timer "salah pilih" sudah dipindah ke fcs_timer_kerja_batal -> tidak terbaca.
// - Fallback HANYA bila hari itu tidak ada timer sama sekali: nama di progress_checkpoint_log tanggal itu (status
//   'checkpoint'). Daftar renhar TIDAK pernah dianggap pengerja.
// - renhar.pekerja_per_komponen = RENCANA planner: nama yang belum punya timer tampil 'belum_mulai' (hari ini/akan
//   datang) atau 'tidak_mulai' (tanggal lampau, abu-abu) - tetap ditampilkan, tidak dihapus, TIDAK dihitung pengerja.
// - Nama dari hari lain tidak pernah masuk daftar (info "terakhir dikerjakan" = urusan tooltip pemanggil).
export type TimerSesi = { pekerja_id: number | string; mulai?: string | null; selesai?: string | null; durasi_menit?: number | string | null }
export type StatusOperator = 'berjalan' | 'selesai' | 'checkpoint' | 'belum_mulai' | 'tidak_mulai'
export type EntriOperator = { id: number | null; nama: string; status: StatusOperator; menit: number }
export type DaftarOperator = { entri: EntriOperator[]; pengerja: EntriOperator[]; sumber: 'timer' | 'checkpoint' | 'kosong' }

const URUT: Record<StatusOperator, number> = { berjalan: 0, selesai: 1, checkpoint: 2, belum_mulai: 3, tidak_mulai: 4 }

export function statusDihitungPengerja(s: StatusOperator): boolean {
  return s === 'berjalan' || s === 'selesai' || s === 'checkpoint'
}

// Teks checkpoint "RAFIK, FIRMAN" -> ["RAFIK","FIRMAN"] (unik, urutan kemunculan)
export function namaDariCheckpoint(baris: { pekerja_nama?: string | null }[]): string[] {
  return [...new Set((baris || []).flatMap(b => String(b?.pekerja_nama || '').split(',').map(n => n.trim()).filter(Boolean)))]
}

export function daftarOperatorHarian(o: {
  timer: TimerSesi[] // timer komponen+proses+TANGGAL itu saja
  rencanaIds: (number | string)[] // renhar.pekerja_per_komponen[kode] (BUSBAR: semua tahap digabung)
  checkpointNama?: string[] // namaDariCheckpoint(checkpoint komponen+proses+TANGGAL itu)
  namaById: (id: number | string) => string | undefined
  tanggal: string // YYYY-MM-DD yang dilihat
  hariIni: string // YYYY-MM-DD WIB
  sekarangMs?: number
}): DaftarOperator {
  const now = o.sekarangMs ?? Date.now()
  const per = new Map<number, { berjalan: boolean; menit: number }>()
  for (const t of o.timer || []) {
    const id = Number(t.pekerja_id); if (!Number.isFinite(id)) continue
    const a = per.get(id) || { berjalan: false, menit: 0 }
    if (!t.selesai) { a.berjalan = true; if (t.mulai) a.menit += Math.max(0, (now - Date.parse(t.mulai)) / 60000) }
    else a.menit += Number(t.durasi_menit) || (t.mulai ? Math.max(0, (Date.parse(t.selesai) - Date.parse(t.mulai)) / 60000) : 0)
    per.set(id, a)
  }
  const entri: EntriOperator[] = []
  for (const [id, a] of per) entri.push({ id, nama: o.namaById(id) || `#${id}`, status: a.berjalan ? 'berjalan' : 'selesai', menit: Math.round(a.menit) })
  let sumber: DaftarOperator['sumber'] = per.size ? 'timer' : 'kosong'
  if (!per.size && (o.checkpointNama || []).length) {
    sumber = 'checkpoint'
    for (const n of o.checkpointNama || []) entri.push({ id: null, nama: n, status: 'checkpoint', menit: 0 })
  }
  const sudah = new Set(entri.map(e => e.nama.toUpperCase()))
  const lampau = o.tanggal < o.hariIni
  for (const r of o.rencanaIds || []) {
    const id = Number(r); if (!Number.isFinite(id) || per.has(id)) continue
    const nama = o.namaById(id) || `#${id}`
    if (sudah.has(nama.toUpperCase())) continue // sudah tercatat lewat checkpoint (nama sama)
    sudah.add(nama.toUpperCase())
    entri.push({ id, nama, status: lampau ? 'tidak_mulai' : 'belum_mulai', menit: 0 })
  }
  entri.sort((a, b) => URUT[a.status] - URUT[b.status] || a.nama.localeCompare(b.nama))
  return { entri, pengerja: entri.filter(e => statusDihitungPengerja(e.status)), sumber }
}

export const LABEL_STATUS_OPERATOR: Record<StatusOperator, string> = {
  berjalan: 'sedang mengerjakan',
  selesai: 'sudah mengerjakan hari ini',
  checkpoint: 'tercatat di simpan progres (tanpa timer)',
  belum_mulai: 'ditugaskan, belum mulai',
  tidak_mulai: 'ditugaskan, tidak mulai',
}

export function labelMenit(m: number): string {
  const n = Math.round(m || 0)
  return n >= 60 ? `${Math.floor(n / 60)}j ${n % 60}m` : `${n}m`
}
