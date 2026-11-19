// HAPUS OTOMATIS FOTO/VIDEO MAINTENANCE RUTIN > 30 HARI - logika inti (19 Nov 2026, Tahap 2). Dipisah dari index.ts supaya bisa
// diuji di Node dengan R2 & RPC tiruan. Semua keputusan "boleh dihapus" ada di database (inv_media_rutin_status lewat RPC
// inv_media_rutin_mulai/klaim) - di sini hanya urutan kerja per berkas:
//   klaim (cek ulang + log 'mulai') -> kunci R2 dari URL (host & pola ketat, tanpa decode) -> berkas utama WAJIB ada sebelum dihapus
//   (kecuali log 'berkas_terhapus' membuktikan proses sebelumnya sudah menghapusnya) -> hapus berkas & thumbnail -> pastikan hilang ->
//   log 'berkas_terhapus' -> tandai (inv_media.dihapus_pada + inv_jadwal_selesai.media_dihapus_pada + log 'selesai').
// Berkas utama yang tidak ditemukan & belum pernah dihapus proses ini = GAGAL, tidak ditandai (salah konfigurasi bucket / referensi
// palsu tidak boleh membuat foto "hilang" dari Riwayat). Mati di tengah = aman diulang. 3 gagal beruntun -> berhenti.
// Tiap panggilan R2/RPC dibatasi waktunya; seluruh proses berhenti mengambil berkas baru setelah ~100 dtk.
// Tidak menerima nama berkas dari pemanggil.

export type HasilRpc = { data: unknown; error: { message?: string } | null }
export type Rpc = (nama: string, arg: Record<string, unknown>) => PromiseLike<HasilRpc>
export type R2 = {
  ada: (kunci: string) => Promise<{ ada: boolean; ukuran: number }>
  hapus: (kunci: string) => Promise<void>
}
export type Ringkasan = { jalan: boolean; alasan?: string; run?: string; total_kandidat?: number; diambil?: number; dihapus: number; dilewati: number; gagal: number; byte: number; catatan: string[] }
type Awal = { jalan?: boolean; alasan?: string; total_kandidat?: number; kandidat?: { media_id: number }[] } | null
type Klaim = { ok?: boolean; url?: unknown; thumb?: unknown; sudah_terhapus?: boolean } | null

// Jalur yang boleh dihapus (sama dgn pola fungsi SQL inv_media_rutin_status): maintenance-rutin/<n>/ atau inventaris/<n>/jadwal/<n>/,
// nama <angka>_<huruf/angka/_>.<ekstensi>. Tidak ada %, ?, #, .., \ - kunci dipakai apa adanya (tanpa decodeURIComponent).
const POLA_KUNCI = /^(maintenance-rutin\/[0-9]+|inventaris\/[0-9]+\/jadwal\/[0-9]+)\/[0-9]+_[A-Za-z0-9_]+\.[A-Za-z0-9]{2,5}$/
const WAKTU_R2_MS = 20_000, WAKTU_RPC_MS = 15_000

// Pesan galat yang masuk log (log bisa dibaca aplikasi): URL & deretan heksa panjang (mis. ID akun di host endpoint) disamarkan.
export const bersihkanPesan = (e: unknown) => String((e as { message?: string } | null)?.message || e)
  .replace(/https?:\/\/[^\s'"<>]+/g, '[url]').replace(/\b[0-9a-f]{24,}\b/gi, '[id]').slice(0, 500)

function batasi<T>(janji: PromiseLike<T>, ms: number, apa: string): Promise<T> {
  let t: ReturnType<typeof setTimeout> | undefined
  return Promise.race([
    Promise.resolve(janji),
    new Promise<T>((_, tolak) => { t = setTimeout(() => tolak(new Error(apa + ': waktu habis')), ms) }),
  ]).finally(() => { if (t !== undefined) clearTimeout(t) })
}

export function kunciR2(url: unknown, basisUrl: string): string | null {
  if (typeof url !== 'string' || !basisUrl) return null
  const basis = basisUrl.replace(/\/+$/, '') + '/'
  if (!basis.startsWith('https://') || !url.startsWith(basis)) return null
  const kunci = url.slice(basis.length)
  return POLA_KUNCI.test(kunci) ? kunci : null
}

export async function prosesHapus(o: { rpc: Rpc; r2: R2; basisUrl: string; pemicu: 'cron' | 'manual'; runId: string; batasWaktuMs?: number; sekarang?: () => number }): Promise<Ringkasan> {
  const jam = o.sekarang || (() => Date.now())
  const mulaiPada = jam()
  const batasWaktu = o.batasWaktuMs ?? 100_000   // Edge Function dibatasi ~150 dtk; sisanya utk mencatat akhir
  const panggil = async (nama: string, arg: Record<string, unknown>) => {
    const { data, error } = await batasi(o.rpc(nama, arg), WAKTU_RPC_MS, nama)
    if (error) throw new Error(`${nama}: ${error.message || JSON.stringify(error)}`)
    return data
  }
  const r2ada = (k: string) => batasi(o.r2.ada(k), WAKTU_R2_MS, 'R2 cek ' + k)
  const r2hapus = (k: string) => batasi(o.r2.hapus(k), WAKTU_R2_MS, 'R2 hapus ' + k)
  const awal = await panggil('inv_media_rutin_mulai', { p_run: o.runId, p_pemicu: o.pemicu }) as Awal
  if (!awal?.jalan) return { jalan: false, alasan: awal?.alasan || 'tidak jalan', dihapus: 0, dilewati: 0, gagal: 0, byte: 0, catatan: [] }
  const daftar = Array.isArray(awal.kandidat) ? awal.kandidat : []
  const h: Ringkasan = { jalan: true, run: o.runId, total_kandidat: awal.total_kandidat, diambil: daftar.length, dihapus: 0, dilewati: 0, gagal: 0, byte: 0, catatan: [] }
  let gagalBeruntun = 0
  for (const k of daftar) {
    if (jam() - mulaiPada > batasWaktu) { h.catatan.push('berhenti: batas waktu proses - sisanya di proses berikutnya'); break }
    try {
      const klaim = await panggil('inv_media_rutin_klaim', { p_run: o.runId, p_media_id: k.media_id }) as Klaim
      if (!klaim?.ok) { h.dilewati++; continue }
      const kunciUtama = kunciR2(klaim.url, o.basisUrl)
      const kunciThumb = klaim.thumb == null ? undefined : kunciR2(klaim.thumb, o.basisUrl)
      if (!kunciUtama || kunciThumb === null) throw new Error('jalur berkas tidak sesuai pola/host R2 - tidak dihapus')
      let ukuran = 0
      for (const kunci of kunciThumb ? [kunciUtama, kunciThumb] : [kunciUtama]) {
        const sebelum = await r2ada(kunci)
        if (!sebelum.ada && kunci === kunciUtama && !klaim.sudah_terhapus) {
          throw new Error('berkas utama tidak ditemukan di R2 sebelum dihapus - tidak ditandai (cek berkas / konfigurasi bucket)')
        }
        ukuran += sebelum.ukuran
        if (sebelum.ada) {
          // hapus melempar galat (mis. waktu habis) padahal R2 sudah menghapus -> cek ulang; masih ada = benar-benar gagal
          try { await r2hapus(kunci) } catch (e) { if ((await r2ada(kunci)).ada) throw e }
        }
        const sesudah = await r2ada(kunci)
        if (sesudah.ada) throw new Error('berkas masih ada setelah dihapus: ' + kunci)
      }
      await panggil('inv_media_rutin_terhapus', { p_run: o.runId, p_media_id: k.media_id, p_ukuran: ukuran })
      await panggil('inv_media_rutin_tandai', { p_run: o.runId, p_media_id: k.media_id, p_ukuran: ukuran })
      h.dihapus++; h.byte += ukuran; gagalBeruntun = 0
    } catch (e) {
      h.gagal++; gagalBeruntun++
      const pesan = bersihkanPesan(e)
      try {
        const { error } = await batasi(o.rpc('inv_media_rutin_gagal', { p_run: o.runId, p_media_id: k.media_id, p_pesan: pesan }), WAKTU_RPC_MS, 'catat gagal')
        if (error) h.catatan.push(`media ${k.media_id}: gagal dicatat di log (${error.message || 'galat'})`)
      } catch (e2) { h.catatan.push(`media ${k.media_id}: gagal dicatat di log (${bersihkanPesan(e2)})`) }
      h.catatan.push(`media ${k.media_id}: ${pesan}`.slice(0, 300))
      if (gagalBeruntun >= 3) { h.catatan.push('berhenti: 3 gagal beruntun'); break }
    }
  }
  try { await panggil('inv_media_rutin_akhiri', { p_run: o.runId, p_ringkasan: h }) }
  catch (e) { h.catatan.push('gagal mencatat akhir proses: ' + bersihkanPesan(e).slice(0, 200)) }
  return h
}
