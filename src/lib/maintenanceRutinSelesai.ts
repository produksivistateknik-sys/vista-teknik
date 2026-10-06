// "TANDAI SELESAI" MAINTENANCE RUTIN - satu sumber logika (CLAUDE.md B.1) utk jalur QR
// (MesinPublic.tsx, completed_via "qr_worker") & admin (MaintenanceRutinTab.tsx, "admin").
//
// Insiden 5 Okt 2026 (BAK DEGREASING & BAK AIR, KHOLEL via QR): dulu urutannya update jadwal ->
// upload foto (ukuran asli, tanpa batas waktu) -> BARU simpan log. Upload menggantung di jaringan
// pabrik, halaman ditinggal (item sudah hilang dari layar duluan) -> jadwal maju tapi log & fotonya
// tidak pernah tersimpan. Urutan BARU:
//   1. update jadwal (maintenance_rutin)
//   2. simpan log LANGSUNG dgn foto [] (gagal -> jadwal dikembalikan, error dilempar)
//   3. (pemanggil) catat activity_log
//   4. upload foto SATU PER SATU (dikompres, ada batas waktu), tiap foto berhasil langsung
//      DITEMPEL ke log yg sama -> putus di tengah jalan pun catatan & foto yang sudah terkirim aman.
import { supabase } from './supabase'
import { uploadToR2 } from './r2Client'
import { siapkanMediaUpload, batasWaktuUnggahMs, BATAS_VIDEO_MB } from './siapkanMedia'

export { BATAS_VIDEO_MB }
export type ItemFotoLog = { url: string; type: 'image' | 'video'; uploaded_at: string }
export type FotoGagal = { file: File; alasan: string }

export async function simpanSelesaiMaintenanceRutin(opsi: {
  rutin: any; teknisi: string; via: 'qr_worker' | 'admin'; tanggal: string; jatuhTempoBaru: string; selectRutin?: string
}): Promise<{ rutinBaru: any; logId: number }> {
  const { rutin, teknisi, via, tanggal, jatuhTempoBaru } = opsi
  const lama = { terakhir_dilakukan: rutin.terakhir_dilakukan ?? null, jatuh_tempo: rutin.jatuh_tempo ?? null }
  const { data: rutinBaru, error } = await supabase.from('maintenance_rutin').update({
    terakhir_dilakukan: tanggal, jatuh_tempo: jatuhTempoBaru,
  }).eq('id', rutin.id).select(opsi.selectRutin || '*').single()
  if (error || !rutinBaru) throw error || new Error('Jadwal tidak ditemukan')
  const { data: log, error: eLog } = await supabase.from('maintenance_rutin_log').insert({
    rutin_id: rutin.id, dilakukan_pada: tanggal, teknisi, completed_via: via, foto: [],
  }).select('id').single()
  if (eLog || !log) {
    // Jangan biarkan jadwal maju tanpa catatan - kembalikan ke nilai sebelum ditandai.
    const { error: eBalik } = await supabase.from('maintenance_rutin').update(lama).eq('id', rutin.id)
    if (eBalik) console.error('Gagal mengembalikan jadwal maintenance_rutin', rutin.id, 'setelah log gagal disimpan:', eBalik)
    throw eLog || new Error('Log maintenance tidak tersimpan')
  }
  return { rutinBaru, logId: (log as any).id }
}

// Upload satu per satu & tempel ke log `logId`. Kembalikan daftar file yang gagal (+alasan) supaya
// pemanggil bisa menawarkan "Coba lagi" ke log yang SAMA (tidak bikin log baru/ganda).
export async function unggahFotoKeLogMaintenance(logId: number, rutinId: number, files: File[],
  onProgres?: (terkirim: number, total: number) => void): Promise<{ terkirim: number; gagal: FotoGagal[] }> {
  const gagal: FotoGagal[] = []
  let terkirim = 0
  onProgres?.(0, files.length)
  for (const file of files) {
    try {
      // 6 Okt 2026 - lewat helper bersama siapkanMedia: foto dikompres (gagal -> ukuran asli, sama
      // seperti dulu), video kini DIKOMPRES ke 720p dulu baru dicek batas BATAS_VIDEO_MB (dulu
      // video >50 MB langsung ditolak walau setelah dikompres sebenarnya muat).
      const m = await siapkanMediaUpload(file)
      const video = m.mime.startsWith('video/')
      const key = `maintenance-rutin/${rutinId}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${m.ext}`
      const url = await uploadToR2(m.blob, key, m.contentType, { batasWaktuIzinMs: 30_000, batasWaktuUnggahMs: batasWaktuUnggahMs(m.blob) })
      const item: ItemFotoLog = { url, type: video ? 'video' : 'image', uploaded_at: new Date().toISOString() }
      // Baca foto terkini dulu lalu tambahkan (bukan timpa) - aman kalau sebagian sudah tertempel.
      const { data: cur, error: eBaca } = await supabase.from('maintenance_rutin_log').select('foto').eq('id', logId).single()
      if (eBaca) throw eBaca
      const { error: eTempel } = await supabase.from('maintenance_rutin_log')
        .update({ foto: [...(Array.isArray((cur as any)?.foto) ? (cur as any).foto : []), item] }).eq('id', logId)
      if (eTempel) throw eTempel
      terkirim++
      onProgres?.(terkirim, files.length)
    } catch (err: any) {
      console.error('Upload dokumentasi maintenance rutin gagal:', file.name, err)
      gagal.push({ file, alasan: String(err?.message || err) })
    }
  }
  return { terkirim, gagal }
}
