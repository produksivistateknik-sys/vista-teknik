// SIAPKAN FILE DOKUMENTASI SEBELUM UPLOAD (6 Okt 2026, dukungan video di semua fitur dokumentasi).
// SALINAN di vista-pekerja/src/lib/siapkanMedia.ts - ubah keduanya kalau diubah (beda cuma fungsi
// kompres foto yang diimpor: kompresFoto di sini, compressImageNp di vista-pekerja).
//
// - Foto  : dikompres seperti sebelumnya (JPEG maks 1600px). Gagal kompres -> kirim ukuran asli
//           (perilaku lama jalur Maintenance Rutin, satu-satunya pemakai sebelum helper ini ada).
// - Video : dikompres di HP lewat WebCodecs (library mediabunny, dimuat lazy HANYA saat ada video)
//           ke sisi pendek 720p. HP tidak mendukung / kompres gagal / hasil malah lebih besar ->
//           kirim file asli. Setelah itu wajib <= BATAS_VIDEO_MB.
// - Lainnya (QC "Tambahkan File"): dikirim apa adanya.
import { kompresFoto } from './kompresFoto'
import { uploadToR2 } from './r2Client'

export const BATAS_VIDEO_MB = 50
// Batas file video MENTAH saat dipilih (sebelum kompres) - 1 menit video HP 1080p ~100-150 MB;
// batas BATAS_VIDEO_MB tetap dicek SETELAH kompres.
export const BATAS_VIDEO_MENTAH_MB = 500
const SISI_PENDEK_VIDEO = 720
const BITRATE_VIDEO = 1_500_000
// Video kecil (klip pendek) tidak perlu dikompres - hemat waktu & baterai HP operator.
const LEWATI_KOMPRES_DI_BAWAH = 5 * 1024 * 1024
const BATAS_WAKTU_KOMPRES_MS = 4 * 60 * 1000
const EKSTENSI_VIDEO = /\.(mp4|m4v|mov|3gp|3g2|webm|mkv)$/i

export type MediaSiapUpload = { blob: Blob; contentType: string; ext: string; mime: string }

export const isFileVideo = (f: File) => f.type.startsWith('video/') || (!f.type && EKSTENSI_VIDEO.test(f.name))

const ekstensiNama = (f: File, cadangan: string) => {
  const dot = f.name.lastIndexOf('.')
  return dot > 0 && dot < f.name.length - 1 ? f.name.slice(dot + 1).toLowerCase() : cadangan
}

// Batas waktu PUT ke R2 sesuai ukuran - video 50 MB di sinyal lapangan butuh jauh lebih lama dari
// foto 0,4 MB. Minimal 3 menit (nilai lama Maintenance Rutin), +15 detik per MB.
export const batasWaktuUnggahMs = (blob: Blob) => Math.max(180_000, Math.ceil(blob.size / 1048576) * 15_000)

// null = tidak dikompres (tidak didukung/gagal/tidak perlu) -> pemanggil kirim file asli.
export async function kompresVideo(file: File): Promise<Blob | null> {
  if (file.size <= LEWATI_KOMPRES_DI_BAWAH) return null
  if (typeof (globalThis as any).VideoEncoder === 'undefined') return null
  let conversion: any = null
  try {
    const mb = await import('mediabunny')
    const input = new mb.Input({ source: new mb.BlobSource(file), formats: mb.ALL_FORMATS })
    const output = new mb.Output({ format: new mb.Mp4OutputFormat({ fastStart: 'in-memory' }), target: new mb.BufferTarget() })
    conversion = await mb.Conversion.init({
      input, output, showWarnings: false,
      // Audio TIDAK diatur -> disalin apa adanya (AAC dari kamera HP), tidak perlu encoder audio.
      video: (track: any) => {
        const w = track.displayWidth, h = track.displayHeight
        const ukuran = Math.min(w, h) > SISI_PENDEK_VIDEO ? (w <= h ? { width: SISI_PENDEK_VIDEO } : { height: SISI_PENDEK_VIDEO }) : {}
        return { ...ukuran, codec: 'avc', bitrate: BITRATE_VIDEO }
      },
    })
    // Ada track yang dibuang (mis. encoder H.264 tidak tersedia, audio tidak bisa disalin) -> jangan
    // kirim video tanpa gambar/suara, pakai file asli saja.
    if (!conversion.isValid || conversion.discardedTracks.length > 0) return null
    let pewaktu: any
    await Promise.race([
      conversion.execute(),
      new Promise((_, tolak) => { pewaktu = setTimeout(() => tolak(new Error('kompres video terlalu lama')), BATAS_WAKTU_KOMPRES_MS) }),
    ]).finally(() => clearTimeout(pewaktu))
    const buf = (output.target as any).buffer as ArrayBuffer | null
    if (!buf || buf.byteLength === 0 || buf.byteLength >= file.size) return null
    return new Blob([buf], { type: 'video/mp4' })
  } catch (err) {
    console.warn('Kompres video gagal, dikirim ukuran asli:', file.name, err)
    try { await conversion?.cancel?.() } catch { /* abaikan */ }
    return null
  }
}

export async function siapkanMediaUpload(file: File): Promise<MediaSiapUpload> {
  if (isFileVideo(file)) {
    const hasil = await kompresVideo(file)
    const blob: Blob = hasil || file
    const tipe = hasil ? 'video/mp4' : (file.type || 'video/mp4')
    if (blob.size > BATAS_VIDEO_MB * 1024 * 1024) {
      throw new Error(`video ${(blob.size / 1048576).toFixed(0)} MB, maksimal ${BATAS_VIDEO_MB} MB - rekam lebih pendek`)
    }
    return { blob, contentType: tipe, ext: hasil ? 'mp4' : ekstensiNama(file, 'mp4'), mime: tipe }
  }
  if (file.type.startsWith('image/')) {
    try {
      return { blob: await kompresFoto(file), contentType: 'image/jpeg', ext: 'jpg', mime: 'image/jpeg' }
    } catch (e) {
      console.warn('Kompres foto gagal, dikirim ukuran asli:', e)
      return { blob: file, contentType: file.type, ext: ekstensiNama(file, 'jpg'), mime: file.type }
    }
  }
  const tipe = file.type || 'application/octet-stream'
  return { blob: file, contentType: tipe, ext: ekstensiNama(file, 'bin'), mime: tipe }
}

// Siapkan + unggah 1 file ke R2 di bawah `prefixKey` (mis. "proyek-luar/12"). Dilempar kalau gagal -
// pemanggil WAJIB menangkap & memberi tahu operator (jangan diam-diam dilewati). Hasil siap ditempel
// ke array foto JSONB: {url, mime, name} - `mime` dipakai viewer/grid utk mengenali video.
export async function unggahMediaKeR2(file: File, prefixKey: string): Promise<{ url: string; mime: string; name: string }> {
  const m = await siapkanMediaUpload(file)
  const key = `${prefixKey}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${m.ext}`
  const url = await uploadToR2(m.blob, key, m.contentType, { batasWaktuIzinMs: 30_000, batasWaktuUnggahMs: batasWaktuUnggahMs(m.blob) })
  // Nama ikut ekstensi file yang BENAR-BENAR tersimpan (foto HEIC/PNG dikompres jadi .jpg, video jadi .mp4)
  // - dipakai sbg nama file saat diunduh.
  const dot = file.name.lastIndexOf('.')
  return { url, mime: m.mime, name: (dot > 0 ? file.name.slice(0, dot) : file.name) + '.' + m.ext }
}
